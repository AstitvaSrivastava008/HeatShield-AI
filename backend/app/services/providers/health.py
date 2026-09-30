"""Demo health provider - loads the synthetic (proxy) health table.

IMPORTANT: these are INVENTED proxy counts for pipeline demonstration.
They are not real hospital / mortality statistics and are labelled as such
everywhere they are surfaced to the UI.
"""

from __future__ import annotations

from typing import Any

import pandas as pd

from ...config import DATA_DIR
from .base import HealthDataProvider

HEALTH_CSV = DATA_DIR / "health_demo.csv"


class DemoHealthProvider(HealthDataProvider):
    name = "DemoHealthProvider"
    demo = True

    def __init__(self) -> None:
        if not HEALTH_CSV.exists():
            raise FileNotFoundError(f"Demo health file not found: {HEALTH_CSV}")
        self.df = pd.read_csv(HEALTH_CSV, comment="#")

    def fetch_health_proxy(self, ward_id: str | None = None) -> list[dict[str, Any]]:
        rows = self.df.to_dict(orient="records")
        if ward_id:
            rows = [r for r in rows if str(r["ward_id"]) == ward_id]
        return rows