"""MongoDB access for the SNMP polling service."""

import logging
from datetime import datetime, timezone
from typing import List, Optional

from motor.motor_asyncio import AsyncIOMotorClient

import config

log = logging.getLogger(__name__)

_client: Optional[AsyncIOMotorClient] = None
_db = None

READINGS = "readings"

CONTROLLER_FIELDS = {
    "ip": 1,
    "port": 1,
    "community": 1,
    "nom": 1,
    "project": 1,
    "lastSnapshot": 1,
}


async def connect() -> None:
    global _client, _db
    _client = AsyncIOMotorClient(config.MONGO_URL, serverSelectionTimeoutMS=5000)
    _db = _client[config.MONGO_DB]
    await _db.command("ping")
    await _ensure_timeseries()
    log.info("Connected to MongoDB at %s", config.MONGO_URL)


async def close() -> None:
    if _client is not None:
        _client.close()


async def _ensure_timeseries() -> None:
    """
    Creates `readings` as a time-series collection if it does not exist yet.

    Whichever service touches it first must create it with the right options —
    a plain collection created by accident cannot be converted in place.
    """
    names = await _db.list_collection_names()
    if READINGS in names:
        return

    await _db.create_collection(
        READINGS,
        timeseries={"timeField": "ts", "metaField": "meta", "granularity": "minutes"},
        expireAfterSeconds=config.READING_RETENTION_DAYS * 24 * 60 * 60,
    )
    log.info("Created time-series collection '%s'", READINGS)


async def list_controllers() -> List[dict]:
    return await _db.controllers.find({}, CONTROLLER_FIELDS).to_list(length=None)


async def find_controller_by_ip(ip: str) -> Optional[dict]:
    return await _db.controllers.find_one({"ip": ip}, CONTROLLER_FIELDS)


async def save_controller_poll(
    controller_id,
    project_id,
    reachable: bool,
    snapshot: dict,
    new_flags: List[str],
    cleared_flags: List[str],
) -> None:
    """
    Records one sweep of a controller: the denormalised latest snapshot on the
    controller document, an immutable point in the readings time series, and
    one AlarmEvent document per flag transition (appeared/cleared).

    A failed read stores `reachable: false` with the previous snapshot's alarm
    values left untouched (only reachability/error/measuredAt change) — a
    controller that cannot currently be reached should not appear to have
    magically cleared all its alarms.
    """
    now = datetime.now(timezone.utc)

    update = {"status": reachable, "lastSnapshot": snapshot}
    if reachable:
        update["lastSeenAt"] = now

    await _db.controllers.update_one({"_id": controller_id}, {"$set": update})

    if reachable:
        await _db[READINGS].insert_one(
            {
                "ts": now,
                "meta": {"controller": controller_id, "project": project_id},
                "reachable": True,
                "unitAlarmStatus1": snapshot.get("unitAlarmStatus1"),
                "unitAlarmStatus2": snapshot.get("unitAlarmStatus2"),
                "shortAlarmStatus": snapshot.get("shortAlarmStatus"),
                "activeFlags": snapshot.get("activeFlags", []),
            }
        )

    events = [
        {
            "controller": controller_id,
            "project": project_id,
            "flag": flag,
            "sourceObject": _source_for_flag(flag),
            "state": "active",
            "occurredAt": now,
            "createdAt": now,
            "updatedAt": now,
        }
        for flag in new_flags
    ] + [
        {
            "controller": controller_id,
            "project": project_id,
            "flag": flag,
            "sourceObject": _source_for_flag(flag),
            "state": "cleared",
            "occurredAt": now,
            "createdAt": now,
            "updatedAt": now,
        }
        for flag in cleared_flags
    ]
    if events:
        await _db.alarmevents.insert_many(events)


def _source_for_flag(flag: str) -> str:
    if flag.startswith("shortAlarmStatus"):
        return "shortAlarmStatus"
    # unitAlarmStatus1 labels come from decode.UNIT_ALARM_STATUS_1_BITS.
    from decode import UNIT_ALARM_STATUS_1_BITS

    if flag in UNIT_ALARM_STATUS_1_BITS.values():
        return "unitAlarmStatus1"
    return "unitAlarmStatus2"


async def controller_status(controller_id) -> dict:
    doc = await _db.controllers.find_one(
        {"_id": controller_id}, {"status": 1, "lastSeenAt": 1, "lastSnapshot.measuredAt": 1}
    ) or {}
    measured = (doc.get("lastSnapshot") or {}).get("measuredAt")
    return {
        "status": bool(doc.get("status")),
        "lastSeenAt": doc.get("lastSeenAt").isoformat() if doc.get("lastSeenAt") else None,
        "measuredAt": measured.isoformat() if measured else None,
    }


def is_connected() -> bool:
    return _db is not None
