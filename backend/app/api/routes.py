"""Routers - a small router per resource keeps future real-data adapters clean."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from .. import config
from ..models.schemas import PredictRiskRequest, SimulateRequest, ThermalStressRequest
from ..ml.dataset import FEATURES
from ..ml.model_service import get_model
from ..services.alerts import generate_alerts
from ..services.data_layer import DataLayer
from ..services.providers import ACTIVE_PROVIDERS
from ..services.recommendations import recommendations_for
from ..services.risk import RiskService, SCENARIOS
from ..thermal.thermal_engine import calculate_all

logger = logging.getLogger("heatshield.api")

router = APIRouter(prefix="/api")


def _deps() -> tuple[DataLayer, RiskService]:
    db: DataLayer = ACTIVE_PROVIDERS["_db"]
    risk: RiskService = ACTIVE_PROVIDERS["_risk"]
    return db, risk


# ---------------------------------------------------------------------------
# Meta
# ---------------------------------------------------------------------------
@router.get("/health")
def health() -> dict[str, Any]:
    model = get_model()
    return {
        "status": "ok",
        "service": config.PROJECT["name"],
        "problem_statement": config.PROJECT["problem_statement"],
        "tagline": config.PROJECT["tagline"],
        "demo_data": True,
        "model_loaded": model.model is not None,
        "model_explainer": "shap" if model.model_info()["explainer_available"] else "model_feature_importance",
        "providers": {
            name: p.name for name, p in ACTIVE_PROVIDERS.items() if not name.startswith("_")
        },
        "note": config.PROJECT["demo_disclaimer"],
    }


@router.get("/model-info")
def model_info() -> dict[str, Any]:
    return get_model().model_info()


# ---------------------------------------------------------------------------
# Wards / map
# ---------------------------------------------------------------------------
@router.get("/wards")
def wards(
    scenario: str | None = Query(None, description="Demo scenario id: normal|high_heat|extreme_heat|extreme_vulnerable"),
) -> dict[str, Any]:
    _, risk = _deps()
    ward_list = risk.all_wards(scenario)
    return {
        "scenario": scenario or "normal",
        "ward_count": len(ward_list),
        "wards": ward_list,
        "demo_note": "Simulated ward boundaries & risk - prototype demonstration only.",
    }


@router.get("/ward/{ward_id}")
def ward_detail(
    ward_id: str,
    scenario: str | None = Query(None),
) -> dict[str, Any]:
    _, risk = _deps()
    detail = risk.ward_detail(ward_id, scenario)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Ward {ward_id} not found (demo dataset has W01..W12)")
    return detail


@router.get("/risk-drivers/{ward_id}")
def risk_drivers(ward_id: str) -> dict[str, Any]:
    _, risk = _deps()
    detail = risk.ward_detail(ward_id)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Ward {ward_id} not found")
    return {
        "ward_id": ward_id,
        "ward_name": detail["ward_name"],
        "explain": detail["explain"],
        "demo_note": "Illustrative prototype model contribution - NOT a scientific attribution record.",
    }


# ---------------------------------------------------------------------------
# Forecast
# ---------------------------------------------------------------------------
@router.get("/forecast")
def forecast(
    scenario: str | None = Query(None),
) -> dict[str, Any]:
    _, risk = _deps()
    return {
        "horizon_days": 5,
        "days": risk.forecast(scenario),
        "scenario": scenario or "normal",
        "demo_note": "Synthetic 5-day forecast - prototype demonstration only.",
    }


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------
@router.get("/alerts")
def alerts(scenario: str | None = Query(None)) -> dict[str, Any]:
    _, risk = _deps()
    return {
        "alerts": generate_alerts(risk, scenario),
        "scenario": scenario or "normal",
        "demo_note": "Prototype-generated alerts from simulated risk - not official alerts.",
    }


# ---------------------------------------------------------------------------
# Recommendations
# ---------------------------------------------------------------------------
@router.get("/recommendations/{risk_level}")
def recommendations(risk_level: str) -> dict[str, Any]:
    return recommendations_for(risk_level)


@router.get("/recommendations")
def recommendations_all() -> dict[str, Any]:
    return {"levels": [recommendations_for(l) for l in ("EXTREME", "HIGH", "MODERATE", "LOW")]}


# ---------------------------------------------------------------------------
# Predictions / thermal
# ---------------------------------------------------------------------------
@router.post("/predict-risk", response_model=None)
def predict_risk(req: PredictRiskRequest) -> dict[str, Any]:
    model = get_model()
    features = {
        "temperature": req.temperature,
        "humidity": req.humidity,
        "wind_speed": req.wind_speed,
        "solar_radiation": req.solar_radiation,
        "elderly_density": req.elderly_density,
        "outdoor_worker_density": req.outdoor_worker_density,
        "population_density": req.population_density,
    }
    thermal = calculate_all(req.temperature, req.humidity, req.wind_speed, req.solar_radiation)
    full = {
        **features,
        "wbgt": thermal["wbgt"],
        "utci": thermal["utci"],
        "heat_index": thermal["heat_index"],
        "historical_heat_impact_proxy": round(
            0.18 + 0.45 * req.elderly_density + 0.35 * req.outdoor_worker_density + 0.10 * req.population_density,
            4,
        ),
    }
    pred = model.predict(full)
    info = model.model_info()
    mae = info.get("metrics", {}).get("mae_score_points", 5.0)
    confidence = round(max(0.0, min(1.0, 1.0 - mae / 100.0)), 2)
    explain = model.explain(full)
    return {
        **pred,
        "confidence": confidence,
        "explainer": explain["explainer"],
        "confidence_label": "Prototype model confidence (1 - MAE/100 on synthetic held-out data). Not validated accuracy.",
    }


@router.post("/thermal-stress")
def thermal_stress(req: ThermalStressRequest) -> dict[str, Any]:
    return calculate_all(req.temperature, req.humidity, req.wind_speed, req.solar_radiation)


@router.post("/simulate")
def simulate(req: SimulateRequest) -> dict[str, Any]:
    _, risk = _deps()
    return risk.simulate(
        req.temperature, req.humidity, req.wind_speed, req.solar_radiation,
        elderly_scale=req.elderly_scale,
        outdoor_worker_scale=req.outdoor_worker_scale,
        population_density_scale=req.population_density_scale,
    )


@router.get("/scenarios")
def scenarios() -> dict[str, Any]:
    return {
        "scenarios": [
            {"id": sid, "label": s["label"], "demo": True}
            for sid, s in SCENARIOS.items()
        ],
        "demo_note": "One-click demo scenarios adjust simulated conditions.",
    }


@router.get("/features")
def features() -> dict[str, Any]:
    return {
        "features": FEATURES,
        "target": "human_heat_risk_score",
        "demo_note": "Prototype ML feature list.",
    }