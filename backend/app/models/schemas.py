"""Pydantic request/response schemas for the HEATSHIELD AI API."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PredictRiskRequest(BaseModel):
    temperature: float = Field(ge=-10, le=60, description="Air temperature, deg C")
    humidity: float = Field(ge=0, le=100, description="Relative humidity, %")
    wind_speed: float = Field(ge=0, le=40, description="Wind speed, m/s")
    solar_radiation: float = Field(ge=0, le=1400, description="Solar radiation proxy, W/m2")
    elderly_density: float = Field(ge=0, le=1, description="Elderly population fraction")
    outdoor_worker_density: float = Field(ge=0, le=1, description="Outdoor worker fraction")
    population_density: float = Field(ge=0, le=1, description="Population density index (0-1)")


class PredictRiskResponse(BaseModel):
    risk_score: float
    risk_level: str
    confidence: float = Field(description="Prototype model confidence = 1 - MAE/100 (not validated accuracy)")
    explainer: str = Field(description="shap | model_feature_importance")


class ThermalStressRequest(BaseModel):
    temperature: float = Field(ge=-10, le=60)
    humidity: float = Field(ge=0, le=100)
    wind_speed: float = Field(ge=0, le=40)
    solar_radiation: float = Field(ge=0, le=1400)


class SimulateRequest(BaseModel):
    temperature: float = Field(ge=25, le=50)
    humidity: float = Field(ge=10, le=95)
    wind_speed: float = Field(ge=0, le=12)
    solar_radiation: float = Field(ge=0, le=1200)
    elderly_scale: float = Field(default=1.0, ge=0.5, le=1.5)
    outdoor_worker_scale: float = Field(default=1.0, ge=0.5, le=1.5)
    population_density_scale: float = Field(default=1.0, ge=0.5, le=1.5)


class HealthResponse(BaseModel):
    status: str
    service: str
    problem_statement: str
    demo_data: bool
    model_loaded: bool
    model_explainer: str
    providers: dict[str, str]
    note: str


class WardSummary(BaseModel):
    ward_count: int
    scenario: str
    demo_note: str


class GenericNote(BaseModel):
    demo_note: str = (
        "All HEATSHIELD AI prototype responses derive from simulated demo data. "
        "Not real-world measurements."
    )