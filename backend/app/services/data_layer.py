"""
Local persistent data layer (SQLite) for the HEATSHIELD AI prototype.

Ward boundaries, vulnerability and weather tables are mirrored from the demo
data files into SQLite on first start so the whole backend reads through one
storage interface. The schema is deliberately provider-agnostic:

  - replace sqlite3.connect with a Postgres/PostGIS client and update
    `db_uri` in config -> nothing else in the codebase changes.

All ward/health/vulnerability values are DEMO / SYNTHETIC (prototype only).
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from .. import config
from .providers import base as providers_base
from .providers.gis import DemoGISProvider
from .providers.health import DemoHealthProvider
from .providers.vulnerability import DemoVulnerabilityProvider
from .providers.weather import DemoWeatherProvider

APP_README = """
HEATSHIELD AI - LOCAL PROTOTYPE DATABASE
All stored values are DEMO / SYNTHETIC data for prototype demonstration only.
Can be deleted; it is rebuilt from /data/*.csv and wards_demo.geojson on startup.
"""


class DataLayer:
    def __init__(self) -> None:
        Path(config.DATABASE_URL.replace("sqlite:///", "")).parent.mkdir(parents=True, exist_ok=True)
        self.db_path = config.DATABASE_URL.replace("sqlite:///", "")
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._create_tables()
        self._seed_from_providers()

    # -- schema -------------------------------------------------------------
    def _create_tables(self) -> None:
        with self.conn:
            self.conn.execute("CREATE TABLE IF NOT EXISTS app_readme (note TEXT)")
            self.conn.execute(
                """
                CREATE TABLE IF NOT EXISTS wards (
                    ward_id TEXT PRIMARY KEY,
                    ward_name TEXT,
                    boundary_json TEXT,
                    centroid_east REAL,
                    centroid_north REAL,
                    temp_offset_c REAL,
                    green_cover_index REAL
                )
                """
            )
            self.conn.execute(
                """
                CREATE TABLE IF NOT EXISTS vulnerability (
                    ward_id TEXT PRIMARY KEY,
                    population INTEGER,
                    elderly_fraction REAL,
                    outdoor_worker_fraction REAL,
                    population_density_index REAL,
                    hospital_proximity_km REAL,
                    cooling_centre_count INTEGER,
                    FOREIGN KEY (ward_id) REFERENCES wards(ward_id)
                )
                """
            )
            self.conn.execute(
                """
                CREATE TABLE IF NOT EXISTS weather_forecast (
                    day_label TEXT,
                    date TEXT,
                    temp_max_c REAL,
                    temp_mean_c REAL,
                    temp_min_c REAL,
                    humidity_mean_pct REAL,
                    wind_speed_ms REAL,
                    solar_radiation_proxy REAL,
                    PRIMARY KEY (day_label)
                )
                """
            )
            self.conn.execute(
                """
                CREATE TABLE IF NOT EXISTS health_proxy (
                    ward_id TEXT,
                    date TEXT,
                    heat_illness_consults_proxy INTEGER,
                    ambulance_dispatch_proxy INTEGER,
                    note TEXT,
                    PRIMARY KEY (ward_id, date)
                )
                """
            )

    # -- seeding ------------------------------------------------------------
    def _seed_from_providers(self) -> None:
        with self.conn:
            self.conn.execute("DELETE FROM app_readme")
            self.conn.execute("INSERT INTO app_readme (note) VALUES (?)", (APP_README,))

            gis: DemoGISProvider = providers_base.ACTIVE_PROVIDERS["gis"]  # type: ignore[assignment]
            vuln: DemoVulnerabilityProvider = providers_base.ACTIVE_PROVIDERS["vulnerability"]  # type: ignore[assignment]
            health: DemoHealthProvider = providers_base.ACTIVE_PROVIDERS["health"]  # type: ignore[assignment]
            weather: DemoWeatherProvider = providers_base.ACTIVE_PROVIDERS["weather"]  # type: ignore[assignment]

            self.conn.execute("DELETE FROM wards")
            for f in gis.fetch_wards_geojson()["features"]:
                p = f["properties"]
                cen = p.get("centroid", [0, 0])
                self.conn.execute(
                    "INSERT INTO wards (ward_id, ward_name, boundary_json, centroid_east, centroid_north, temp_offset_c, green_cover_index) "
                    "VALUES (?,?,?,?,?,?,?)",
                    (
                        p["ward_id"], p["ward_name"], json.dumps(f),
                        cen[0], cen[1], p["temp_offset_c"], p["green_cover_index"],
                    ),
                )

            self.conn.execute("DELETE FROM vulnerability")
            for v in vuln.fetch_ward_vulnerability():
                self.conn.execute(
                    "INSERT INTO vulnerability (ward_id, population, elderly_fraction, outdoor_worker_fraction, "
                    "population_density_index, hospital_proximity_km, cooling_centre_count) VALUES (?,?,?,?,?,?,?)",
                    (
                        v["ward_id"], int(v["population"]), float(v["elderly_fraction"]),
                        float(v["outdoor_worker_fraction"]), float(v["population_density_index"]),
                        float(v["hospital_proximity_km"]), int(v["cooling_centre_count"]),
                    ),
                )

            self.conn.execute("DELETE FROM weather_forecast")
            for w in weather.fetch_forecast():
                self.conn.execute(
                    "INSERT INTO weather_forecast (day_label, date, temp_max_c, temp_mean_c, temp_min_c, "
                    "humidity_mean_pct, wind_speed_ms, solar_radiation_proxy) VALUES (?,?,?,?,?,?,?,?)",
                    (
                        w["day_label"], w["date"], w["temp_max_c"], w["temp_mean_c"], w["temp_min_c"],
                        w["humidity_mean_pct"], w["wind_speed_ms"], w["solar_radiation_proxy"],
                    ),
                )

            self.conn.execute("DELETE FROM health_proxy")
            for h in health.fetch_health_proxy():
                self.conn.execute(
                    "INSERT INTO health_proxy (ward_id, date, heat_illness_consults_proxy, ambulance_dispatch_proxy, note) "
                    "VALUES (?,?,?,?,?)",
                    (h["ward_id"], h["date"], int(h["heat_illness_consults_proxy"]),
                     int(h["ambulance_dispatch_proxy"]), h.get("note", "synthetic proxy")),
                )

    # -- queries ------------------------------------------------------------
    def all_wards(self) -> list[dict[str, Any]]:
        rows = self.conn.execute("SELECT * FROM wards ORDER BY ward_id").fetchall()
        return [dict(r) for r in rows]

    def ward(self, ward_id: str) -> dict[str, Any] | None:
        row = self.conn.execute("SELECT * FROM wards WHERE ward_id = ?", (ward_id,)).fetchone()
        return dict(row) if row else None

    def vulnerability(self) -> list[dict[str, Any]]:
        rows = self.conn.execute("SELECT * FROM vulnerability ORDER BY ward_id").fetchall()
        return [dict(r) for r in rows]

    def weather_forecast(self) -> list[dict[str, Any]]:
        rows = self.conn.execute("SELECT * FROM weather_forecast").fetchall()
        return [dict(r) for r in rows]

    def health_proxy(self, ward_id: str | None = None) -> list[dict[str, Any]]:
        if ward_id:
            rows = self.conn.execute(
                "SELECT * FROM health_proxy WHERE ward_id = ? ORDER BY date", (ward_id,)
            ).fetchall()
        else:
            rows = self.conn.execute("SELECT * FROM health_proxy ORDER BY ward_id, date").fetchall()
        return [dict(r) for r in rows]

    def close(self) -> None:
        self.conn.close()