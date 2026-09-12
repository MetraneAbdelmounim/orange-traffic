"""
SNMP-facing service for the Orange Traffic supervision platform.

Responsibilities:
  * run the background poller that keeps MongoDB current with the alarm
    status of every ATC-1500 controller;
  * expose an on-demand poll so the UI's "Rafraîchir maintenant" does not
    have to wait for the next scheduled sweep.

Read endpoints are deliberately absent — telemetry is served by the Node API
straight from MongoDB, so a page render never touches a controller.
"""

import asyncio
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

import config
import store
from poller import poller

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)
log = logging.getLogger("orange-traffic-poller")

if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())


@asynccontextmanager
async def lifespan(_: FastAPI):
    await store.connect()
    await poller.start()
    log.info(
        "Poller started — sweeping every %ss with %s concurrent controllers",
        config.POLL_INTERVAL_SECONDS,
        config.POLL_CONCURRENCY,
    )
    try:
        yield
    finally:
        await poller.stop()
        await store.close()
        log.info("Shutdown complete")


app = FastAPI(title="Orange Traffic SNMP poller", version="1.0.0", lifespan=lifespan)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "db": store.is_connected(),
        "lastSweepSeconds": poller.last_sweep_duration,
        "controllers": poller.last_sweep_controllers,
    }


@app.post("/control/poll/{ip}")
async def poll_now(ip: str):
    """
    Re-reads one controller on demand and returns its fresh status.

    The scheduled sweep runs every POLL_INTERVAL_SECONDS, so without this an
    operator who just fixed a fault in the field would keep seeing the stale
    alarm until the next sweep comes round.
    """
    controller = await store.find_controller_by_ip(ip)
    if controller is None:
        raise HTTPException(status_code=404, detail=f"Contrôleur inconnu : {ip}")

    await poller.poll_now(controller)

    fresh = await store.controller_status(controller["_id"])
    return {"success": True, **fresh}


@app.exception_handler(HTTPException)
async def http_exception_handler(_, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "message": exc.detail},
    )
