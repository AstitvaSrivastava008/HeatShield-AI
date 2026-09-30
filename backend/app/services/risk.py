"""
Risk orchestration - combines weather, vulnerability, health proxy and ML
output into the ward-level human-risk view, the 5-day forecast and the
dashboard KPIs.

Everything under the hood uses DEMO / SYNTHETIC data - see config.PROJECT.
"""

from __future__ import annotations

import math
from typing import Any

from .. import config
from ..ml.model_service import get_model, risk_level
from ..thermal.thermal_engine import calculate_all
from .data_layer import DataLayer
from .recommendations import recommendations_for

# ---------------------------------------------------------------------------
# One-click demo scenarios -> offsets applied on top of the demo baseline
# (city ~38.4 deg C = heatwave Day 1 peak, RH ~44%, wind ~3.2 m/s,
# solar ~640 W/m2). Offsets are tuned so the four scenarios show a credible,
# visibly different spread of ward risk (MODERATE..EXTREME) for the demo:
# normal (mixed) -> high heat (widespread) -> extreme heatwave (citywide)
# -> extreme + higher vulnerability (citywide, elevated drivers).
# ---------------------------------------------------------------------------
SCENARIOS: dict[str, dict[str, float]] = {
    "normal": {
        "label": "Normal Day",
        "temp": -4.5, "humidity": -8.0, "wind": 1.4, "solar": -160.0,
        "elderly_scale": 1.0, "worker_scale": 1.0, "pop_scale": 1.0,
    },
    "high_heat": {
        "label": "High Heat",
        "temp": -2.0, "humidity": -2.0, "wind": 1.0, "solar": -60.0,
        "elderly_scale": 1.0, "worker_scale": 1.0, "pop_scale": 1.0,
    },
    "extreme_heat": {
        "label": "Extreme Heatwave",
        "temp": 4.4, "humidity": 15.0, "wind": -0.8, "solar": 150.0,
        "elderly_scale": 1.0, "worker_scale": 1.0, "pop_scale": 1.0,
    },
    "extreme_vulnerable": {
        "label": "Extreme Heat + Higher Vulnerability",
        "temp": 4.4, "humidity": 15.0, "wind": -0.8, "solar": 150.0,
        "elderly_scale": 1.30, "worker_scale": 1.25, "pop_scale": 1.15,
    },
}


def get_scenario(scenario: str | None) -> dict[str, float]:
    return SCENARIOS.get(scenario or "normal", SCENARIOS["normal"])


def _hist_impact(elderly: float, outdoor_worker: float, pop_density: float) -> float:
    return max(0.05, min(0.9, 0.18 + 0.45 * elderly + 0.35 * outdoor_worker + 0.10 * pop_density))


class RiskService:
    def __init__(self, db: DataLayer) -> None:
        self.db = db
        self.model = get_model()

    # ------------------------------------------------------------------
    # ward-level computations
    # ------------------------------------------------------------------
    def ward_conditions(
        self, ward: dict[str, Any], vuln: dict[str, Any], scenario: dict[str, float]
    ) -> dict[str, float]:
        temp_city = 38.4 + scenario.get("temp", 0.0)
        hum_city = 44.0 + scenario.get("humidity", 0.0)
        wind_city = max(0.4, 3.2 + scenario.get("wind", 0.0))
        solar_city = 640.0 + scenario.get("solar", 0.0)
        green = float(ward.get("green_cover_index", 0.3))
        rh = hum_city - 2.0 * green
        solar = solar_city * (1.0 - 0.12 * green)
        return {
            "temperature": round(temp_city + float(ward.get("temp_offset_c", 0.0)), 1),
            "humidity": round(max(12.0, min(95.0, rh)), 1),
            "wind_speed": round(wind_city, 1),
            "solar_radiation": round(max(0.0, solar), 1),
        }

    def ward_features(
        self, cond: dict[str, float], vuln: dict[str, Any], scenario: dict[str, float]
    ) -> dict[str, float]:
        thermal = calculate_all(
            cond["temperature"], cond["humidity"], cond["wind_speed"], cond["solar_radiation"]
        )
        pop = max(1, int(vuln["population"]))
        senior = float(vuln["elderly_fraction"]) * scenario.get("elderly_scale", 1.0)
        worker = float(vuln["outdoor_worker_fraction"]) * scenario.get("worker_scale", 1.0)
        density = float(vuln["population_density_index"]) * scenario.get("pop_scale", 1.0)
        return {
            "temperature": cond["temperature"],
            "humidity": cond["humidity"],
            "wind_speed": cond["wind_speed"],
            "solar_radiation": cond["solar_radiation"],
            "wbgt": thermal["wbgt"],
            "utci": thermal["utci"],
            "heat_index": thermal["heat_index"],
            "elderly_density": round(min(0.5, senior), 4),
            "outdoor_worker_density": round(min(0.6, worker), 4),
            "population_density": round(min(1.0, density), 4),
            "historical_heat_impact_proxy": round(
                _hist_impact(senior, worker, density), 4
            ),
        }

    def compute_ward(
        self, ward: dict[str, Any], vuln: dict[str, Any], scenario: dict[str, float]
    ) -> dict[str, Any]:
        cond = self.ward_conditions(ward, vuln, scenario)
        features = self.ward_features(cond, vuln, scenario)
        pred = self.model.predict(features)
        centroid = ward.get("centroid_east", 0.0), ward.get("centroid_north", 0.0)
        return {
            "ward_id": ward["ward_id"],
            "ward_name": ward["ward_name"],
            "centroid": list(centroid) if centroid[0] else None,
            "boundary": json_parse(ward.get("boundary_json")),
            "temperature": features["temperature"],
            "humidity": features["humidity"],
            "wind_speed": features["wind_speed"],
            "solar_radiation": features["solar_radiation"],
            "wbgt": features["wbgt"],
            "utci": features["utci"],
            "heat_index": features["heat_index"],
            "population": int(vuln["population"]),
            "elderly_fraction": round(float(vuln["elderly_fraction"]), 4),
            "outdoor_worker_fraction": round(float(vuln["outdoor_worker_fraction"]), 4),
            "population_density_index": round(float(vuln["population_density_index"]), 4),
            "hospital_proximity_km": float(vuln["hospital_proximity_km"]),
            "cooling_centre_count": int(vuln["cooling_centre_count"]),
            "risk_score": pred["risk_score"],
            "risk_level": pred["risk_level"],
            "demo": True,
        }

    def all_wards(self, scenario: str | None = None) -> list[dict[str, Any]]:
        scen = get_scenario(scenario)
        vuln_by_id = {v["ward_id"]: v for v in self.db.vulnerability()}
        wards = []
        for ward in self.db.all_wards():
            v = vuln_by_id.get(ward["ward_id"])
            if v is None:
                continue
            wards.append(self.compute_ward(ward, v, scen))
        return wards

    def ward_detail(self, ward_id: str, scenario: str | None = None) -> dict[str, Any] | None:
        scen = get_scenario(scenario)
        ward = self.db.ward(ward_id)
        if ward is None:
            return None
        vuln = next(
            (v for v in self.db.vulnerability() if v["ward_id"] == ward_id), None
        )
        if vuln is None:
            return None
        rec = self.compute_ward(ward, vuln, scen)
        features = self.ward_features(
            self.ward_conditions(ward, vuln, scen), vuln, scen
        )
        explain = self.model.explain(features)
        return {
            **rec,
            "explain": explain,
            "recommendations": recommendations_for(rec["risk_level"]),
            "health_proxy": self.db.health_proxy(ward_id),
            "demo_note": "Simulated ward data - prototype demonstration only.",
        }

    # ------------------------------------------------------------------
    # summary / KPIs
    # ------------------------------------------------------------------
    def summary(self, scenario: str | None = None) -> dict[str, Any]:
        wards = self.all_wards(scenario)
        max_ward = max(wards, key=lambda w: w["risk_score"])
        high_wards = [w for w in wards if w["risk_level"] in ("HIGH", "EXTREME")]
        vuln_pop = sum(w["population"] for w in high_wards)
        alerts = len(high_wards)
        return {
            "current_risk_level": max_ward["risk_level"],
            "current_risk_score": max_ward["risk_score"],
            "highest_risk_ward": max_ward["ward_id"],
            "highest_risk_ward_name": max_ward["ward_name"],
            "forecast_horizon_days": 5,
            "vulnerable_population_demo_estimate": vuln_pop,
            "active_alerts": alerts,
            "wards_at": {
                "LOW": sum(1 for w in wards if w["risk_level"] == "LOW"),
                "MODERATE": sum(1 for w in wards if w["risk_level"] == "MODERATE"),
                "HIGH": sum(1 for w in wards if w["risk_level"] == "HIGH"),
                "EXTREME": sum(1 for w in wards if w["risk_level"] == "EXTREME"),
            },
            "demo_note": "KPI figures are computed from simulated demo data (demo estimates).",
        }

    # ------------------------------------------------------------------
    # forecast
    # ------------------------------------------------------------------
    def forecast(self, scenario: str | None = None) -> list[dict[str, Any]]:
        scen = get_scenario(scenario)
        rows = self.db.weather_forecast() or []
        vulns = self.db.vulnerability()
        # City-average vulnerability profile (weighted by population) used to
        # represent "the city" for the headline forecast line.
        total_pop = sum(max(1, v["population"]) for v in vulns) or 1.0
        avg_vuln = {
            "elderly_fraction": sum(
                v["elderly_fraction"] * v["population"] for v in vulns
            ) / total_pop,
            "outdoor_worker_fraction": sum(
                v["outdoor_worker_fraction"] * v["population"] for v in vulns
            ) / total_pop,
            "population_density_index": sum(
                v["population_density_index"] * v["population"] for v in vulns
            ) / total_pop,
            "population": int(total_pop),
        }
        out = []
        for row in rows:
            temp_mean = float(row["temp_mean_c"]) + scen.get("temp", 0.0)
            humidity = min(95.0, float(row["humidity_mean_pct"]) + scen.get("humidity", 0.0))
            wind = max(0.4, float(row["wind_speed_ms"]) + scen.get("wind", 0.0))
            solar = max(0.0, float(row["solar_radiation_proxy"]) + scen.get("solar", 0.0))
            thermal = calculate_all(temp_mean, humidity, wind, solar)
            features = {
                "temperature": round(temp_mean, 1),
                "humidity": round(humidity, 1),
                "wind_speed": round(wind, 1),
                "solar_radiation": round(solar, 1),
                "wbgt": thermal["wbgt"],
                "utci": thermal["utci"],
                "heat_index": thermal["heat_index"],
                "elderly_density": round(
                    min(0.5, avg_vuln["elderly_fraction"] * scen.get("elderly_scale", 1.0)), 4
                ),
                "outdoor_worker_density": round(
                    min(0.6, avg_vuln["outdoor_worker_fraction"] * scen.get("worker_scale", 1.0)), 4
                ),
                "population_density": round(
                    min(1.0, avg_vuln["population_density_index"] * scen.get("pop_scale", 1.0)), 4
                ),
                "historical_heat_impact_proxy": round(
                    _hist_impact(
                        avg_vuln["elderly_fraction"],
                        avg_vuln["outdoor_worker_fraction"],
                        avg_vuln["population_density_index"],
                    ),
                    4,
                ),
            }
            pred = self.model.predict(features)
            out.append(
                {
                    "day_label": row["day_label"],
                    "date": row["date"],
                    "temp_max_c": round(float(row["temp_max_c"]) + scen.get("temp", 0.0), 1),
                    "temp_mean_c": round(temp_mean, 1),
                    "humidity_mean_pct": round(humidity, 1),
                    "wind_speed_ms": round(wind, 1),
                    "solar_radiation_proxy": round(solar, 1),
                    "heat_index": thermal["heat_index"],
                    "wbgt": thermal["wbgt"],
                    "utci": thermal["utci"],
                    "risk_score": pred["risk_score"],
                    "risk_level": pred["risk_level"],
                    "demo": True,
                }
            )
        return out

    # ------------------------------------------------------------------
    # simulate (scenario simulator)
    # ------------------------------------------------------------------
    def simulate(
        self,
        temperature: float,
        humidity: float,
        wind_speed: float,
        solar_radiation: float,
        elderly_scale: float = 1.0,
        outdoor_worker_scale: float = 1.0,
        population_density_scale: float = 1.0,
    ) -> dict[str, Any]:
        scenario = {
            "temp": float(temperature) - 38.4,
            "humidity": float(humidity) - 44.0,
            "wind": float(wind_speed) - 3.2,
            "solar": float(solar_radiation) - 640.0,
            "elderly_scale": elderly_scale,
            "worker_scale": outdoor_worker_scale,
            "pop_scale": population_density_scale,
        }
        wards = self.all_wards_from_scenario(scenario)
        max_ward = max(wards, key=lambda w: w["risk_score"])
        high_wards = [w for w in wards if w["risk_level"] in ("HIGH", "EXTREME")]
        thermal = calculate_all(temperature, humidity, wind_speed, solar_radiation)
        representative = max_ward
        pred = {"risk_score": representative["risk_score"], "risk_level": representative["risk_level"]}
        return {
            "conditions": {
                "temperature": round(float(temperature), 1),
                "humidity": round(float(humidity), 1),
                "wind_speed": round(float(wind_speed), 1),
                "solar_radiation": round(float(solar_radiation), 1),
            },
            "thermal": thermal,
            "prediction": pred,
            "summary": {
                "current_risk_level": max_ward["risk_level"],
                "highest_risk_ward": max_ward["ward_id"],
                "vulnerable_population_demo_estimate": sum(w["population"] for w in high_wards),
                "active_alerts": len(high_wards),
            },
            "wards": wards,
            "demo_note": "Simulated conditions from the Heat Scenario Simulator - prototype demonstration.",
        }

    def all_wards_from_scenario(self, scenario: dict[str, float]) -> list[dict[str, Any]]:
        vuln_by_id = {v["ward_id"]: v for v in self.db.vulnerability()}
        wards = []
        for ward in self.db.all_wards():
            v = vuln_by_id.get(ward["ward_id"])
            if v is None:
                continue
            wards.append(self.compute_ward(ward, v, scenario))
        return wards


def json_parse(raw: str | None) -> Any:
    import json

    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None