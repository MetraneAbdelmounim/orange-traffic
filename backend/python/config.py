"""Environment-driven configuration for the SNMP polling service."""

import os


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


IS_PRODUCTION = os.environ.get("NODE_ENV") == "production"

MONGO_URL = os.environ.get(
    "MONGO_URL",
    "mongodb://mongo:27017/orangetraffic" if IS_PRODUCTION else "mongodb://127.0.0.1:27017/orangetraffic",
)
MONGO_DB = os.environ.get("MONGO_DB", "orangetraffic")

# --- Polling -----------------------------------------------------------------
POLL_INTERVAL_SECONDS = _int("POLL_INTERVAL_SECONDS", 60)
# Controllers read concurrently. Bounded so a large fleet does not open
# hundreds of UDP sockets at once.
POLL_CONCURRENCY = _int("POLL_CONCURRENCY", 16)
# Hard ceiling on one controller's poll (all 4 OID groups, each with its own
# SNMP_TIMEOUT x (SNMP_RETRIES+1) budget per OID). Without this, a single
# pathological controller could — worst case — hold its semaphore slot for
# minutes and delay the freshness of every other controller in the fleet, since
# a sweep only completes once every controller's poll has settled.
CONTROLLER_POLL_TIMEOUT = _float("CONTROLLER_POLL_TIMEOUT", 20.0)
# A controller only flips to the "unreachable" (red) display state after this
# many consecutive failed sweeps; a single failed sweep shows as "degraded"
# (amber) instead. Absorbs an isolated dropped UDP packet without a false
# "Unreachable" — a real outage is still caught within ~2 sweep intervals.
DEGRADED_FAILURE_THRESHOLD = _int("DEGRADED_FAILURE_THRESHOLD", 1)

READING_RETENTION_DAYS = _int("READING_RETENTION_DAYS", 90)

# --- SNMP ----------------------------------------------------------------
# Verified empirically against a real ATC-1500 bench unit: it answers only to
# SNMPv1 GET requests (mpModel=0) and never to SNMPv2c — GETBULK is therefore
# unavailable, every read is a plain GET.
SNMP_PORT_DEFAULT = _int("SNMP_PORT_DEFAULT", 161)
SNMP_TIMEOUT = _float("SNMP_TIMEOUT", 5.0)
SNMP_RETRIES = _int("SNMP_RETRIES", 1)
DEFAULT_SNMP_COMMUNITY = os.environ.get("DEFAULT_SNMP_COMMUNITY", "public")

# --- Recovery watch ------------------------------------------------------
# After an operator-triggered poll, an immediate re-read is enough — unlike
# the MPPT platform this service does not issue restarts, so no recovery loop
# is needed here.
