"""
Test SNMP pour Oriux ATC-1500 (NTCIP).
Usage:
    python atc1500_snmp_test.py <ip> [community] [port]

Exemples:
    python atc1500_snmp_test.py 192.168.1.100
    python atc1500_snmp_test.py 192.168.1.100 public 161
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
    walk_cmd,
)

SYSTEM_OID = "1.3.6.1.2.1.1"
NTCIP_OID = "1.3.6.1.4.1.1206"

SYSTEM_SCALARS = {
    "sysDescr": "1.3.6.1.2.1.1.1.0",
    "sysUpTime": "1.3.6.1.2.1.1.3.0",
    "sysContact": "1.3.6.1.2.1.1.4.0",
    "sysName": "1.3.6.1.2.1.1.5.0",
    "sysLocation": "1.3.6.1.2.1.1.6.0",
}


async def snmp_get(dispatcher, target, community, oid):
    error_indication, error_status, error_index, var_binds = await get_cmd(
        dispatcher, community, target, ObjectType(ObjectIdentity(oid))
    )
    if error_indication:
        return None, str(error_indication)
    if error_status:
        return None, f"{error_status.prettyPrint()} at {error_index}"
    for name, val in var_binds:
        return f"{name} = {val}", None
    return None, "no data"


async def snmp_walk(dispatcher, target, community, base_oid, limit=200):
    results = []
    count = 0
    async for error_indication, error_status, error_index, var_binds in walk_cmd(
        dispatcher, community, target, ObjectType(ObjectIdentity(base_oid))
    ):
        if error_indication:
            results.append((None, str(error_indication)))
            break
        if error_status:
            results.append((None, f"{error_status.prettyPrint()} at {error_index}"))
            break
        for name, val in var_binds:
            results.append((f"{name} = {val}", None))
        count += 1
        if count >= limit:
            results.append((None, f"(arrêté après {limit} lignes, augmenter --limit)"))
            break
    return results


async def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    ip = sys.argv[1]
    community = sys.argv[2] if len(sys.argv) > 2 else "public"
    port = int(sys.argv[3]) if len(sys.argv) > 3 else 161

    print(f"=== Test SNMP sur {ip}:{port} (communauté='{community}') ===\n")

    dispatcher = SnmpDispatcher()
    target = await UdpTransportTarget.create((ip, port), timeout=5, retries=2)
    comm = CommunityData(community, mpModel=0)  # mpModel=0 => SNMPv1 (ce device ne répond pas en v2c)

    try:
        print("--- 1. GET des OID système de base ---")
        any_success = False
        for label, oid in SYSTEM_SCALARS.items():
            line, err = await snmp_get(dispatcher, target, comm, oid)
            if err:
                print(f"  {label}: ERREUR -> {err}")
            else:
                print(f"  {label}: {line}")
                any_success = True

        if not any_success:
            print(
                "\nAucune réponse SNMP reçue. Vérifiez : IP correcte, "
                "contrôleur allumé/joignable (ping), SNMP activé sur le device, "
                "communauté correcte, et qu'aucun firewall ne bloque le port UDP/161."
            )
            return

        print("\n--- 2. WALK de la branche système (1.3.6.1.2.1.1) ---")
        for line, err in await snmp_walk(dispatcher, target, comm, SYSTEM_OID):
            print(f"  ERREUR: {err}" if err else f"  {line}")

        print(f"\n--- 3. WALK de la branche NTCIP ({NTCIP_OID}) ---")
        ntcip_results = await snmp_walk(dispatcher, target, comm, NTCIP_OID, limit=500)
        if not ntcip_results:
            print("  (rien reçu sous cette branche - le device ne l'expose peut-être pas)")
        for line, err in ntcip_results:
            print(f"  ERREUR: {err}" if err else f"  {line}")

    finally:
        dispatcher.transport_dispatcher.close_dispatcher()


if __name__ == "__main__":
    asyncio.run(main())
