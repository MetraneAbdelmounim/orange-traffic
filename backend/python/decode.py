"""
Bit-level decoding of the NTCIP 1202 alarm objects.

`UNIT_ALARM_STATUS_1_BITS` was confirmed by the client's own network
engineer, cross-checked against the NTCIP 1202 standard, and validated
manually against a real ATC-1500 bench unit (10.8.3.20) — unitAlarmStatus1
read back as 64, decoded to a single active flag ("Local Free"), matching a
third-party SNMP tool's raw reading.

`UNIT_ALARM_STATUS_2_BITS` and `SHORT_ALARM_STATUS_BITS` were subsequently
supplied by the client as the official bit tables and supersede the earlier
placeholder values ported from general documentation.
"""

# Confirmed by the client's own network engineer, cross-checked against the
# NTCIP 1202 standard, and validated against the real controller.
UNIT_ALARM_STATUS_1_BITS = {
    7: {"label": "CoordActive - coordination active", "criticality": "warning"},
    6: {"label": "Local Free - le contrôleur ne suit pas la coordination", "criticality": "warning"},
    5: {"label": "Local Flash - entrée Local Flash active", "criticality": "warning"},
    4: {"label": "MMU Flash - entrée MMU Flash active trop longtemps", "criticality": "warning"},
    3: {"label": "Cycle Fail - défaut de cycle", "criticality": "warning"},
    2: {"label": "Coord Fail - défaut de coordination", "criticality": "warning"},
    1: {"label": "Coord Fault - défaut de coordination en cours", "criticality": "warning"},
    0: {"label": "Cycle Fault - défaut de cycle", "criticality": "warning"},
}

# Official table supplied by the client. Bits 5-7 are Reserved and are
# deliberately absent from this table — decode_bits() only ever reports bits
# it has an entry for, so a reserved bit being set never surfaces as a
# user-facing alarm.
UNIT_ALARM_STATUS_2_BITS = {
    4: {"label": "Stop Time - entrée Stop Time active", "criticality": "warning"},
    3: {"label": "External Start - entrée External Start active", "criticality": "warning"},
    2: {"label": "Response Fault - défaut de réponse NEMA TS2 Port 1", "criticality": "warning"},
    1: {"label": "Low Battery - tension batterie trop faible", "criticality": "warning"},
    0: {"label": "Power Restart - alimentation revenue après interruption", "criticality": "warning"},
}

# Official table supplied by the client. Only bit 7 (Stop Time) is the
# "Critical Alarm" tier; every other bit is a warning-level condition.
SHORT_ALARM_STATUS_BITS = {
    7: {"label": "Critical Alarm - Stop Time actif", "criticality": "critical"},
    6: {"label": "Non-Critical Alarm - entrée d'alarme physique active", "criticality": "warning"},
    5: {"label": "Detector Fault - défaut détecteur", "criticality": "warning"},
    4: {"label": "Coordination Alarm - problème de coordination", "criticality": "warning"},
    3: {"label": "Local Override - override/local control", "criticality": "warning"},
    2: {"label": "Local Cycle Zero - cycle local passé par zéro", "criticality": "warning"},
    1: {"label": "T&F Flash - Local Flash ou MMU Flash actif", "criticality": "warning"},
    0: {"label": "Preempt - préemption active", "criticality": "warning"},
}


def decode_bits(value, bit_table: dict) -> list:
    """
    Returns the list of active flag labels for a bitmask value.

    Always a list — empty when `value` is 0 or None, so a caller never needs
    to special-case "no alarms" versus "some alarms": the UI rule is simply
    "render this list of strings", never "render this raw integer".
    """
    if not value:
        return []
    return [entry["label"] for bit, entry in bit_table.items() if value & (1 << bit)]


def decode_alarms(value, bit_table: dict, source_object: str) -> list:
    """
    Structured decode: one dict per active bit, carrying everything the UI
    needs to explain an alarm without re-deriving it — the label, which bit
    and raw value produced it, which NTCIP object it came from, and its
    criticality tier (client-defined: only shortAlarmStatus bit 7 is
    "critical", everything else is "warning").
    """
    if not value:
        return []
    return [
        {
            "label": entry["label"],
            "bit": bit,
            "value": 1 << bit,
            "sourceObject": source_object,
            "criticality": entry["criticality"],
        }
        for bit, entry in bit_table.items()
        if value & (1 << bit)
    ]


def decode_snapshot(unit_alarm_status_1, unit_alarm_status_2, short_alarm_status) -> list:
    """Combined, flat flag-label list across all three alarm objects (legacy shape, kept for history/back-compat)."""
    flags = []
    flags += decode_bits(unit_alarm_status_1, UNIT_ALARM_STATUS_1_BITS)
    flags += decode_bits(unit_alarm_status_2, UNIT_ALARM_STATUS_2_BITS)
    flags += decode_bits(short_alarm_status, SHORT_ALARM_STATUS_BITS)
    return flags


def decode_snapshot_alarms(unit_alarm_status_1, unit_alarm_status_2, short_alarm_status) -> list:
    """Combined structured alarm list (see decode_alarms) across all three objects."""
    alarms = []
    alarms += decode_alarms(unit_alarm_status_1, UNIT_ALARM_STATUS_1_BITS, "unitAlarmStatus1")
    alarms += decode_alarms(unit_alarm_status_2, UNIT_ALARM_STATUS_2_BITS, "unitAlarmStatus2")
    alarms += decode_alarms(short_alarm_status, SHORT_ALARM_STATUS_BITS, "shortAlarmStatus")
    return alarms
