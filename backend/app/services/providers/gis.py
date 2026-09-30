"""Demo GIS provider - loads the fictional ward GeoJSON boundaries."""

from __future__ import annotations

import json
from typing import Any

from ...config import DATA_DIR
from .base import GISProvider

GEOJSON = DATA_DIR / "wards_demo.geojson"


class DemoGISProvider(GISProvider):
    name = "DemoGISProvider"
    demo = True

    def __init__(self) -> None:
        if not GEOJSON.exists():
            raise FileNotFoundError(f"Demo ward geojson not found: {GEOJSON}")
        raw = GEOJSON.read_text(encoding="utf-8")
        self.geojson: dict[str, Any] = json.loads(raw)

    def fetch_wards_geojson(self) -> dict[str, Any]:
        return self.geojson