"""
HEATSHIELD AI - FastAPI backend entrypoint.

SENSE -> UNDERSTAND -> PREDICT -> EXPLAIN -> ACT

Everything served here is computed from DEMO / SYNTHETIC data for the
SIH26083 prototype demonstration.
"""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router
from .config import PROJECT
from .services.data_layer import DataLayer
from .services.providers import ACTIVE_PROVIDERS
from .services.providers.gis import DemoGISProvider
from .services.providers.health import DemoHealthProvider
from .services.providers.vulnerability import DemoVulnerabilityProvider
from .services.providers.weather import DemoWeatherProvider

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("heatshield")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Register demo providers - future real APIs register here instead.
    ACTIVE_PROVIDERS["weather"] = DemoWeatherProvider()
    ACTIVE_PROVIDERS["vulnerability"] = DemoVulnerabilityProvider()
    ACTIVE_PROVIDERS["health"] = DemoHealthProvider()
    ACTIVE_PROVIDERS["gis"] = DemoGISProvider()

    db = DataLayer()
    ACTIVE_PROVIDERS["_db"] = db

    from .services.risk import RiskService

    ACTIVE_PROVIDERS["_risk"] = RiskService(db)
    logger.info("HEATSHIELD AI backend ready (all data simulated).")
    yield
    db.close()


app = FastAPI(
    title=f"{PROJECT['name']} API",
    description=(
        f"{PROJECT['subtitle']}. All data are simulated demo data for prototype "
        "demonstration (SIH26083), not real-world measurements."
    ),
    version="0.1.0-demo",
    lifespan=lifespan,
    docs_url="/docs",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # local prototype only
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": PROJECT["name"],
        "message": PROJECT["tagline"],
        "docs": "/docs",
        "demo_disclaimer": PROJECT["demo_disclaimer"],
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False)