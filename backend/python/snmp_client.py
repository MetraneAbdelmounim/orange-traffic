"""
Thin async SNMP GET wrapper around pysnmp's v1arch API.

Validated manually against a real ATC-1500 (see `atc1500_snmp_test.py` /
`atc1500_alarm_status.py` at the repo root): this model answers only to
SNMPv1 (mpModel=0) — SNMPv2c GET requests time out systematically, even
though nmap's own probe (which defaults to v1) gets an answer.

Every read is tolerant of failure: a timeout, a malformed response or an
unsupported OID all come back as `None` rather than raising, so one missing
object group (e.g. phase/detector tables, never confirmed on this firmware)
never aborts an entire controller sweep.
"""

import logging
from typing import Dict, Optional

from pysnmp.hlapi.v1arch.asyncio import (
    CommunityData,
    ObjectIdentity,
    ObjectType,
    SnmpDispatcher,
    UdpTransportTarget,
    get_cmd,
)

log = logging.getLogger(__name__)


async def get_group(
    ip: str,
    port: int,
    community: str,
    oids: Dict[str, str],
    timeout: float,
    retries: int,
) -> Dict[str, Optional[object]]:
    """
    Reads a group of named OIDs from one controller.

    Returns a dict keyed the same as `oids`, each value either the decoded
    SNMP value (int for Integer/Counter/Gauge, str otherwise) or None if that
    particular OID could not be read.
    """
    results: Dict[str, Optional[object]] = {key: None for key in oids}

    dispatcher = SnmpDispatcher()
    try:
        target = await UdpTransportTarget.create((ip, port), timeout=timeout, retries=retries)
        community_data = CommunityData(community, mpModel=0)  # SNMPv1 only

        for key, oid in oids.items():
            try:
                error_indication, error_status, error_index, var_binds = await get_cmd(
                    dispatcher, community_data, target, ObjectType(ObjectIdentity(oid))
                )
                if error_indication or error_status:
                    continue
                for _, value in var_binds:
                    results[key] = _coerce(value)
            except Exception as exc:  # noqa: BLE001 - one bad OID must not sink the group
                log.debug("SNMP GET failed for %s %s: %s", ip, oid, exc)
    finally:
        dispatcher.transport_dispatcher.close_dispatcher()

    return results


def _coerce(value):
    """Converts a pysnmp value object into a plain int or str."""
    try:
        return int(value)
    except (TypeError, ValueError):
        pass
    try:
        return bytes(value).decode("utf-8", errors="replace").strip("\x00").strip()
    except Exception:  # noqa: BLE001
        return str(value)


async def any_reachable(results: Dict[str, Optional[object]]) -> bool:
    return any(v is not None for v in results.values())
