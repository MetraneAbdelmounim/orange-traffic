"""
Lecture des alarmes NTCIP 1202 (unitAlarmStatus1/2, shortAlarmStatus)
sur un contrôleur Oriux ATC-1500, en lecture seule (SNMP GET).

OID confirmés par l'ingénieur du client :
    unitAlarmStatus2 : 1.3.6.1.4.1.1206.4.2.1.3.7
    unitAlarmStatus1 : 1.3.6.1.4.1.1206.4.2.1.3.8
    shortAlarmStatus : 1.3.6.1.4.1.1206.4.2.1.3.9

Usage:
    python atc1500_alarm_status.py <ip> [community] [port]
"""

import asyncio
import io
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", newline="\n")

from pysnmp.hlapi.v1arch.asyncio import (
    CommunityData,
    ObjectIdentity,
    ObjectType,
    SnmpDispatcher,
    UdpTransportTarget,
    get_cmd,
)

OID_UNIT_ALARM_STATUS_2 = "1.3.6.1.4.1.1206.4.2.1.3.7"
OID_UNIT_ALARM_STATUS_1 = "1.3.6.1.4.1.1206.4.2.1.3.8"
OID_SHORT_ALARM_STATUS = "1.3.6.1.4.1.1206.4.2.1.3.9"

# Table confirmée par l'ingénieur du client (unitAlarmStatus1)
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

# Table officielle fournie par le client. Bits 5-7 = Reserved, volontairement
# absents (jamais affichés comme alarme utilisateur).
UNIT_ALARM_STATUS_2_BITS = {
    4: "Stop Time - entrée Stop Time active",
    3: "External Start - entrée External Start active",
    2: "Response Fault - défaut de réponse NEMA TS2 Port 1",
    1: "Low Battery - tension batterie trop faible",
    0: "Power Restart - alimentation revenue après interruption",
}

# Table officielle fournie par le client (résumé rapide des alarmes).
SHORT_ALARM_STATUS_BITS = {
    7: "Critical Alarm - Stop Time actif",
    6: "Non-Critical Alarm - entrée d'alarme physique active",
    5: "Detector Fault - défaut détecteur",
    4: "Coordination Alarm - problème de coordination",
    3: "Local Override - override/local control",
    2: "Local Cycle Zero - cycle local passé par zéro",
    1: "T&F Flash - Local Flash ou MMU Flash actif",
    0: "Preempt - préemption active",
}


def decode_bits(value, bit_table):
    active = [label for bit, label in bit_table.items() if value & (1 << bit)]
    return active


async def snmp_get_int(dispatcher, target, community, oid):
    error_indication, error_status, error_index, var_binds = await get_cmd(
        dispatcher, community, target, ObjectType(ObjectIdentity(oid))
    )
    if error_indication:
        return None, str(error_indication)
    if error_status:
        return None, f"{error_status.prettyPrint()} at {error_index}"
    for _, val in var_binds:
        return int(val), None
    return None, "no data"


async def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    ip = sys.argv[1]
    community = sys.argv[2] if len(sys.argv) > 2 else "public"
    port = int(sys.argv[3]) if len(sys.argv) > 3 else 161

    dispatcher = SnmpDispatcher()
    target = await UdpTransportTarget.create((ip, port), timeout=5, retries=2)
    comm = CommunityData(community, mpModel=0)  # SNMPv1

    print(f"=== Statut alarmes NTCIP - {ip}:{port} (communauté='{community}') ===\n")

    try:
        for label, oid, bit_table in (
            ("unitAlarmStatus1", OID_UNIT_ALARM_STATUS_1, UNIT_ALARM_STATUS_1_BITS),
            ("unitAlarmStatus2", OID_UNIT_ALARM_STATUS_2, UNIT_ALARM_STATUS_2_BITS),
        ):
            value, err = await snmp_get_int(dispatcher, target, comm, oid)
            if err:
                print(f"{label}: ERREUR -> {err}")
                continue
            active = decode_bits(value, bit_table)
            print(f"{label} = {value} (0b{value:08b})")
            if active:
                for a in active:
                    print(f"    [X] {a}")
            else:
                print("    (aucune alarme active)")
            print()

        value, err = await snmp_get_int(dispatcher, target, comm, OID_SHORT_ALARM_STATUS)
        if err:
            print(f"shortAlarmStatus: ERREUR -> {err}")
        else:
            active = decode_bits(value, SHORT_ALARM_STATUS_BITS)
            print(f"shortAlarmStatus = {value} (0b{value:08b})")
            if active:
                for a in active:
                    print(f"    [X] {a}")
            else:
                print("    (aucune alarme active)")

    finally:
        dispatcher.transport_dispatcher.close_dispatcher()


if __name__ == "__main__":
    asyncio.run(main())
