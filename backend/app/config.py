"""Central configuration for HEATSHIELD AI backend."""

from __future__ import annotations

from pathlib import Path

# Repo layout:
#   heatshield-ai/backend/app/config.py  -> parents[3] is repo root
REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data"

# Local prototype database (SQLite). Postgres/PostGIS can replace this later
# by swapping DataLayer.db_uri (structure stays the same).
DATABASE_URL = "sqlite:///" + str(REPO_ROOT / "backend" / "heatshield_local.db")

MODEL_ARTIFACT = Path(__file__).resolve().parent / "ml" / "artifacts" / "risk_model.json"
MODEL_META = Path(__file__).resolve().parent / "ml" / "artifacts" / "model_meta.json"

RISK_THRESHOLDS = {
    "LOW": (0, 25),
    "MODERATE": (26, 50),
    "HIGH": (51, 75),
    "EXTREME": (76, 100),
}

PROJECT = {
    "name": "HEATSHIELD AI",
    "subtitle": "Extreme Heat Early Warning & Human Risk Intelligence",
    "problem_statement": "SIH26083 - Extreme Heatwave Early Warning and Human Thermal Stress Index",
    "tagline": "From weather forecasting to human risk forecasting.",
    "demo_disclaimer": "All data are simulated demo data generated for prototype demonstration. Not real-world measurements.",
}