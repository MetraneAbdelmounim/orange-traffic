"""
Bit-level decoding of the NTCIP 1202 alarm objects.

Ported from `atc1500_alarm_status.py`, validated manually against a real
ATC-1500 bench unit (10.8.3.20) — unitAlarmStatus1 read back as 64, decoded
to a single active flag ("Local Free"), matching a third-party SNMP tool's
raw reading.
"""

# Confirmed by the client's own network engineer, cross-checked against the
# NTCIP 1202 standard.
UNIT_ALARM_STATUS_1_BITS = {
    7: "CoordActive - coordination active",
    6: "Local Free - le contrôleur ne suit pas la coordination",
    5: "Local Flash - entrée Local Flash active",
    4: "MMU Flash - entrée MMU Flash active trop longtemps",
    3: "Cycle Fail - défaut de cycle",
    2: "Coord Fail - défaut de coordination",
    1: "Coord Fault - défaut de coordination en cours",
    0: "Cycle Fault - défaut de cycle",
}

# NOT confirmed by the client — taken from general NTCIP 1202 documentation.
# Kept separate so callers/UI can flag this table as unverified for this model.
UNIT_ALARM_STATUS_2_BITS = {
    4: "Stop Time",
    3: "External Start",
    2: "Response Fault",
    1: "Low Battery",
    0: "Power Restart",
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
    return [label for bit, label in bit_table.items() if value & (1 << bit)]


def decode_snapshot(unit_alarm_status_1, unit_alarm_status_2, short_alarm_status) -> list:
    """Combined, de-duplicated flag list across all three alarm objects."""
    flags = []
    flags += decode_bits(unit_alarm_status_1, UNIT_ALARM_STATUS_1_BITS)
    flags += decode_bits(unit_alarm_status_2, UNIT_ALARM_STATUS_2_BITS)
    if short_alarm_status:
        flags.append(f"shortAlarmStatus actif (valeur brute {short_alarm_status})")
    return flags
