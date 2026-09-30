"""Demo weather provider - loads the synthetic forecast table."""

from __future__ import annotations

from typing import Any

import pandas as pd

from ...config import DATA_DIR
from .base import WeatherProvider

WEATHER_CSV = DATA_DIR / "weather_demo.csv"


class DemoWeatherProvider(WeatherProvider):
    name = "DemoWeatherProvider"
    demo = True

    def __init__(self) -> None:
        if not WEATHER_CSV.exists():
            raise FileNotFoundError(f"Demo weather file not found: {WEATHER_CSV}")
        # '#' lines carry the demo-data documentation header.
        self.df = pd.read_csv(WEATHER_CSV, comment="#")

    def fetch_forecast(self) -> list[dict[str, Any]]:
        cols = [
            "day_label", "date", "temp_max_c", "temp_mean_c", "temp_min_c",
            "humidity_mean_pct", "wind_speed_ms", "solar_radiation_proxy",
        ]
        return self.df[cols].to_dict(orient="records")

    def baseline_conditions(self) -> dict[str, float]:
        # 'Today' represented by the Day-1 row of the synthetic forecast.
        row = self.df.iloc[0]
        return {
            "temperature": float(row["temp_mean_c"]),
            "humidity": float(row["humidity_mean_pct"]),
            "wind_speed": float(row["wind_speed_ms"]),
            "solar_radiation": float(row["solar_radiation_proxy"]),
        }