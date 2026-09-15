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

    async def poll_now(self, controller: dict) -> bool:
        """Re-reads one controller immediately, outside the scheduled sweep. Returns whether the device actually answered."""
        return await self._poll_controller(controller)

    async def _poll_controller(self, controller: dict) -> bool:
        ip = controller.get("ip")
        if not ip:
            return False

        nom = controller.get("nom") or ip
        t0 = asyncio.get_running_loop().time()
        try:
            snapshot, reachable = await asyncio.wait_for(
                self._read_snapshot(controller, ip), timeout=config.CONTROLLER_POLL_TIMEOUT
            )
        except asyncio.TimeoutError:
            log.info("%s (%s): poll timed out after %.1fs (hard cap)", nom, ip, config.CONTROLLER_POLL_TIMEOUT)
            snapshot = self._unreachable_snapshot(controller, "timeout", f"Poll exceeded {config.CONTROLLER_POLL_TIMEOUT:.0f}s")
            reachable = False

        previous_flags = set((controller.get("lastSnapshot") or {}).get("activeFlags") or [])
        current_flags = set(snapshot["activeFlags"])
        new_flags = sorted(current_flags - previous_flags)
        cleared_flags = sorted(previous_flags - current_flags)
        if new_flags or cleared_flags:
            log.info("%s (%s): alarm transition — new=%s cleared=%s", nom, ip, new_flags, cleared_flags)

        await store.save_controller_poll(
            controller_id=controller["_id"],
            project_id=controller.get("project"),
            reachable=reachable,
            snapshot=snapshot,
            new_flags=new_flags,
            cleared_flags=cleared_flags,
        )
        log.debug("%s (%s): poll settled in %.2fs, reachable=%s", nom, ip, asyncio.get_running_loop().time() - t0, reachable)
        return reachable

    async def _read_snapshot(self, controller: dict, ip: str) -> "tuple[dict, bool]":
        """Runs the 4 SNMP OID groups for one controller and builds its new snapshot."""
        port = controller.get("port") or config.SNMP_PORT_DEFAULT
        community = controller.get("community") or config.DEFAULT_SNMP_COMMUNITY
        nom = controller.get("nom") or ip

        log.debug("%s (%s): SNMP request sent (system + alarm groups)", nom, ip)
        system_values, system_failure = await get_group(
            ip, port, community, ntcip.SYSTEM_OIDS, config.SNMP_TIMEOUT, config.SNMP_RETRIES
        )
        alarm_values, alarm_failure = await get_group(
            ip, port, community, ntcip.ALARM_OIDS, config.SNMP_TIMEOUT, config.SNMP_RETRIES
        )
        log.debug("%s (%s): SNMP response received — unitAlarmStatus1=%s unitAlarmStatus2=%s shortAlarmStatus=%s",
                   nom, ip, alarm_values.get("unitAlarmStatus1"), alarm_values.get("unitAlarmStatus2"), alarm_values.get("shortAlarmStatus"))

        reachable = any(v is not None for v in {**system_values, **alarm_values}.values())

        if reachable:
            snapshot = {
                "reachable": True,
                "measuredAt": datetime.now(timezone.utc),
                "error": None,
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
            log.debug("%s (%s): alarm decoded — active=%s", nom, ip, snapshot["activeFlags"])
        else:
            # Prefer the more specific SNMP-level failure over a bare timeout
            # when both groups failed for different reasons — it's the more
            # actionable one to show an operator (e.g. a stale community
            # string won't be fixed by waiting, unlike a dropped packet).
            failure = alarm_failure or system_failure
            reason = failure["reason"] if failure else "timeout"
            detail = failure["detail"] if failure else "Aucune réponse SNMP"
            snapshot = self._unreachable_snapshot(controller, reason, detail)
            log.info("%s (%s): unreachable — %s (%s)", nom, ip, reason, detail)

        # Best-effort groups — never affect `reachable`, timeout is normal.
        phase_values, _ = await get_group(
            ip, port, community, ntcip.PHASE_OIDS, config.SNMP_TIMEOUT, config.SNMP_RETRIES
        )
        snapshot["phaseStatus"] = phase_values if ntcip.is_group_supported(phase_values) else None

        detector_values, _ = await get_group(
            ip, port, community, ntcip.DETECTOR_OIDS, config.SNMP_TIMEOUT, config.SNMP_RETRIES
        )
        snapshot["detectorStatus"] = (
            detector_values if ntcip.is_group_supported(detector_values) else None
        )

        return snapshot, reachable

    @staticmethod
    def _unreachable_snapshot(controller: dict, reason: str, detail: str) -> dict:
        """
        A failed sweep must not be misread as "no alarm" (section 32 of the
        brief) — it carries forward the last confirmed alarm state instead of
        clearing it, and `reason`/`error` say precisely why this poll failed
        rather than a single generic "no response" message. `communicationState`
        (reachable/degraded/unreachable) is derived downstream from
        `consecutiveFailures`, tracked by store.save_controller_poll.
        """
        previous = controller.get("lastSnapshot") or {}
        return {
            "reachable": False,
            "measuredAt": previous.get("measuredAt"),
            "error": detail,
            "errorReason": reason,
            "sysDescr": previous.get("sysDescr"),
            "sysUpTimeTicks": previous.get("sysUpTimeTicks"),
            "unitAlarmStatus1": previous.get("unitAlarmStatus1"),
            "unitAlarmStatus2": previous.get("unitAlarmStatus2"),
            "shortAlarmStatus": previous.get("shortAlarmStatus"),
            "activeFlags": previous.get("activeFlags") or [],
            "alarms": previous.get("alarms") or [],
        }


poller = Poller()
