"""Background sweep that keeps the datastore current with live SNMP reads."""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

import config
import ntcip
import store
from decode import decode_snapshot, decode_snapshot_alarms
from snmp_client import get_group

log = logging.getLogger(__name__)


class Poller:
    """
    Periodically reads every controller over SNMP and writes the result to
    MongoDB — the same inversion used by the reference MPPT platform: device
    I/O happens on a fixed schedule regardless of how many people are
    watching, and one unreachable controller never blocks the rest.
    """

    def __init__(self) -> None:
        self._task: Optional[asyncio.Task] = None
        self._stopping = asyncio.Event()
        self.last_sweep_duration: Optional[float] = None
        self.last_sweep_controllers: int = 0

    async def start(self) -> None:
        self._task = asyncio.create_task(self._run(), name="poller")

    async def stop(self) -> None:
        self._stopping.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _run(self) -> None:
        while not self._stopping.is_set():
            started = asyncio.get_running_loop().time()
            try:
                await self.sweep()
            except Exception:
                # A failed sweep must never end the loop.
                log.exception("Poll sweep failed")

            self.last_sweep_duration = asyncio.get_running_loop().time() - started
            log.info(
                "Sweep finished in %.1fs (%d controllers)",
                self.last_sweep_duration,
                self.last_sweep_controllers,
            )

            delay = max(0.0, config.POLL_INTERVAL_SECONDS - self.last_sweep_duration)
            try:
                await asyncio.wait_for(self._stopping.wait(), timeout=delay)
            except asyncio.TimeoutError:
                pass

    async def sweep(self) -> None:
        controllers = await store.list_controllers()
        self.last_sweep_controllers = len(controllers)

        semaphore = asyncio.Semaphore(config.POLL_CONCURRENCY)

        async def guarded(controller):
            async with semaphore:
                return await self._poll_controller(controller)

        # return_exceptions keeps one failing controller from cancelling the sweep.
        await asyncio.gather(*(guarded(c) for c in controllers), return_exceptions=True)

    async def poll_now(self, controller: dict) -> None:
        """Re-reads one controller immediately, outside the scheduled sweep."""
        await self._poll_controller(controller)

    async def _poll_controller(self, controller: dict) -> None:
        ip = controller.get("ip")
        if not ip:
            return

        port = controller.get("port") or config.SNMP_PORT_DEFAULT
        community = controller.get("community") or config.DEFAULT_SNMP_COMMUNITY

        system_values = await get_group(
            ip, port, community, ntcip.SYSTEM_OIDS, config.SNMP_TIMEOUT, config.SNMP_RETRIES
        )
        alarm_values = await get_group(
            ip, port, community, ntcip.ALARM_OIDS, config.SNMP_TIMEOUT, config.SNMP_RETRIES
        )

        reachable = any(v is not None for v in {**system_values, **alarm_values}.values())

        snapshot = {
            "reachable": reachable,
            "measuredAt": datetime.now(timezone.utc) if reachable else controller.get("lastSnapshot", {}).get("measuredAt"),
            "error": None if reachable else "Aucune réponse SNMP",
            "sysDescr": system_values.get("sysDescr"),
            "sysUpTimeTicks": system_values.get("sysUpTimeTicks"),
            "unitAlarmStatus1": alarm_values.get("unitAlarmStatus1"),
            "unitAlarmStatus2": alarm_values.get("unitAlarmStatus2"),
            "shortAlarmStatus": alarm_values.get("shortAlarmStatus"),
        }
        snapshot["activeFlags"] = decode_snapshot(
            snapshot["unitAlarmStatus1"], snapshot["unitAlarmStatus2"], snapshot["shortAlarmStatus"]
        )
        snapshot["alarms"] = decode_snapshot_alarms(
            snapshot["unitAlarmStatus1"], snapshot["unitAlarmStatus2"], snapshot["shortAlarmStatus"]
        )

        # Best-effort groups — never affect `reachable`, timeout is normal.
        phase_values = await get_group(
            ip, port, community, ntcip.PHASE_OIDS, config.SNMP_TIMEOUT, config.SNMP_RETRIES
        )
        snapshot["phaseStatus"] = phase_values if ntcip.is_group_supported(phase_values) else None

        detector_values = await get_group(
            ip, port, community, ntcip.DETECTOR_OIDS, config.SNMP_TIMEOUT, config.SNMP_RETRIES
        )
        snapshot["detectorStatus"] = (
            detector_values if ntcip.is_group_supported(detector_values) else None
        )

        previous_flags = set((controller.get("lastSnapshot") or {}).get("activeFlags") or [])
        current_flags = set(snapshot["activeFlags"])
        new_flags = sorted(current_flags - previous_flags)
        cleared_flags = sorted(previous_flags - current_flags)

        await store.save_controller_poll(
            controller_id=controller["_id"],
            project_id=controller.get("project"),
            reachable=reachable,
            snapshot=snapshot,
            new_flags=new_flags,
            cleared_flags=cleared_flags,
        )


poller = Poller()
