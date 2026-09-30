"""
Synthetic training-data generator for the HEATSHIELD AI risk model.

==========================================================================
SYNTHETIC DATA - generated for prototype demonstration only.
==========================================================================
The target `human_heat_risk_score` is derived from a physically-motivated
rating function plus noise so that the model learns a plausible, monotonic
mapping from heat stress + vulnerability inputs to risk. This is NOT a
validated clinical/health model and must not be used for real decisions.

The same generator backs `train_model.py` and the runtime (model rebuild
path), so training and serving use identical feature semantics.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.thermal.thermal_engine import calculate_all

FEATURES = [
    "temperature",
    "humidity",
    "wind_speed",
    "solar_radiation",
    "wbgt",
    "utci",
    "heat_index",
    "elderly_density",
    "outdoor_worker_density",
    "population_density",
    "historical_heat_impact_proxy",
]

COLUMNS = FEATURES + ["human_heat_risk_score"]


def synthetic_risk_target(row: pd.Series) -> float:
    """
    Rating function used ONLY to synthesise demo labels.
    Calibrated so that plausible Indian summer conditions spread across
    LOW..EXTREME. Clipped to 0..100.
    """
    wbgt = float(row["wbgt"])
    utci = float(row["utci"])
    hi = float(row["heat_index"])
    risk = (
        3.2 * (wbgt - 26.0)
        + 1.6 * (utci - 26.0)
        + 0.9 * (hi - 28.0)
        + row["elderly_density"] * 70.0
        + row["outdoor_worker_density"] * 45.0
        + row["population_density"] * 18.0
        + row["historical_heat_impact_proxy"] * 10.0
    )
    return float(np.clip(risk, 0.0, 100.0))


def generate_demo_dataset(
    n: int = 5000,
    seed: int = 42,
    longitude: float = 79.08,
    latitude: float = 21.15,
) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    # Concentration towards hot, humid pre-monsoon summer days is intentional:
    # it makes the synthetic dataset match the demo story (heatwave season).
    temperature = rng.normal(34.0, 5.0, n)
    temperature = np.clip(temperature, 25.0, 46.0)
    humidity = np.clip(rng.normal(48.0, 16.0, n), 15.0, 95.0)
    wind_speed = np.clip(rng.lognormal(mean=1.0, sigma=0.45, size=n), 0.4, 8.0)
    solar_radiation = np.clip(rng.normal(620.0, 220.0, n), 120.0, 1050.0)
    elderly_density = np.clip(rng.normal(0.16, 0.06, n), 0.04, 0.32)
    outdoor_worker_density = np.clip(rng.normal(0.22, 0.10, n), 0.04, 0.48)
    population_density = np.clip(rng.normal(0.58, 0.20, n), 0.15, 0.95)
    historical_heat_impact_proxy = np.clip(rng.normal(0.4, 0.18, n), 0.05, 0.85)

    thermal = [
        calculate_all(t, r, w, s)
        for t, r, w, s in zip(temperature, humidity, wind_speed, solar_radiation)
    ]

    df = pd.DataFrame(
        {
            "longitude": np.full(n, longitude),
            "latitude": np.full(n, latitude),
            "temperature": temperature,
            "humidity": humidity,
            "wind_speed": wind_speed,
            "solar_radiation": solar_radiation,
            "wbgt": [x["wbgt"] for x in thermal],
            "utci": [x["utci"] for x in thermal],
            "heat_index": [x["heat_index"] for x in thermal],
            "elderly_density": elderly_density,
            "outdoor_worker_density": outdoor_worker_density,
            "population_density": population_density,
            "historical_heat_impact_proxy": historical_heat_impact_proxy,
        }
    )
    noise = rng.normal(0.0, 4.0, n)
    df["human_heat_risk_score"] = (
        df.apply(synthetic_risk_target, axis=1) + noise
    ).clip(0.0, 100.0)
    return df.drop(columns=["longitude", "latitude"])


if __name__ == "__main__":
    out = generate_demo_dataset(200)
    print(out.head())
    print(out[["human_heat_risk_score"]].describe())