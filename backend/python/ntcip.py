"""
NTCIP object groups polled from an ATC-1500 controller.

Two confidence levels, per the implementation plan:

* SYSTEM_OIDS / ALARM_OIDS — verified by hand against a real bench unit
  (10.8.3.20): SNMPv1 GET, values decoded and cross-checked against a
  third-party tool (SnmpGet.exe) and the client's own NTCIP 1202 bit table.
* PHASE_OIDS / DETECTOR_OIDS — standard NTCIP 1202 object names, but their
  numeric OIDs here are **not confirmed** on this firmware (no official MIB
  file was available while building this). They are polled best-effort: a
  timeout is normal and stored as `None`, never treated as a controller
  fault. Replace these OIDs once the vendor's own MIB is on hand.
"""

# --- Confirmed, required every sweep ----------------------------------------

SYSTEM_OIDS = {
    "sysDescr": "1.3.6.1.2.1.1.1.0",
    "sysUpTimeTicks": "1.3.6.1.2.1.1.3.0",
}

# unitAlarmStatus1/2 and shortAlarmStatus, per NTCIP 1202 — OIDs confirmed by
# the client's network engineer and validated against the real controller.
ALARM_OIDS = {
    "unitAlarmStatus2": "1.3.6.1.4.1.1206.4.2.1.3.7",
    "unitAlarmStatus1": "1.3.6.1.4.1.1206.4.2.1.3.8",
    "shortAlarmStatus": "1.3.6.1.4.1.1206.4.2.1.3.9",
}

# --- Best-effort, unconfirmed on this model ---------------------------------

# Representative phase-group-1 status objects. NTCIP 1202 defines these as a
# table (one row per phase group); only the first row is sampled here as a
# smoke test until the real table layout is confirmed.
PHASE_OIDS = {
    "phaseStatusGroupReds": "1.3.6.1.4.1.1206.4.2.1.1.5.1.2.1",
    "phaseStatusGroupYellows": "1.3.6.1.4.1.1206.4.2.1.1.5.1.3.1",
    "phaseStatusGroupGreens": "1.3.6.1.4.1.1206.4.2.1.1.5.1.4.1",
}

# Representative vehicle-detector-1 status.
DETECTOR_OIDS = {
    "vehicleDetectorAlarms_1": "1.3.6.1.4.1.1206.4.2.1.9.1.2.1",
}


def is_group_supported(values: dict) -> bool:
    """A best-effort group counts as supported once any of its OIDs answers."""
    return any(v is not None for v in values.values())
