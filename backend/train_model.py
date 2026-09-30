"""
Train the HEATSHIELD AI human-heat-risk model on SYNTHETIC demo data.

Steps:
  1. Generate synthetic training data (clearly labelled demo).
  2. Validate feature columns.
  3. Train an XGBoost regressor.
  4. Evaluate on a held-out split (MAE, RMSE, R2).
  5. Save the model + metadata + feature importance to app/ml/artifacts/.

IMPORTANT:
  - The dataset and therefore all metrics are from SYNTHETIC demonstration
    data. They describe how well the model fits the synthetic generator,
    NOT real-world predictive skill. Reported as such everywhere.

Run:  python backend/train_model.py
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.ml.dataset import FEATURES, generate_demo_dataset  # noqa: E402

ARTIFACT_DIR = Path(__file__).resolve().parent / "app" / "ml" / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "risk_model.json"
META_PATH = ARTIFACT_DIR / "model_meta.json"


def main() -> None:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(123)

    df = generate_demo_dataset(n=6000, seed=123)
    missing = [c for c in FEATURES if c not in df.columns]
    if missing:
        raise ValueError(f"Missing feature columns in generated demo data: {missing}")
    if "human_heat_risk_score" not in df.columns:
        raise ValueError("Missing target column 'human_heat_risk_score'")

    X = df[FEATURES]
    y = df["human_heat_risk_score"]

    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=123)

    import xgboost as xgb

    model = xgb.XGBRegressor(
        n_estimators=400,
        max_depth=6,
        learning_rate=0.045,
        subsample=0.9,
        colsample_bytree=0.9,
        reg_lambda=1.5,
        reg_alpha=0.3,
        objective="reg:squarederror",
        random_state=123,
        eval_metric="mae",
    )
    model.fit(Xtr, ytr, eval_set=[(Xte, yte)], verbose=False)

    yp = model.predict(Xte)
    mae = float(np.mean(np.abs(yp - yte)))
    rmse = float(np.sqrt(np.mean((yp - yte) ** 2)))
    ss_res = float(np.sum((yte - yp) ** 2))
    ss_tot = float(np.sum((yte - yte.mean()) ** 2))
    r2 = float(1.0 - ss_res / ss_tot)

    importance = {
        str(k): round(float(v), 4)
        for k, v in zip(FEATURES, model.feature_importances_)
    }
    importance = dict(sorted(importance.items(), key=lambda kv: -kv[1]))

    meta = {
        "model": "xgboost-regressor",
        "objective": "reg:squarederror",
        "features": FEATURES,
        "n_samples": int(len(df)),
        "n_train": int(len(Xtr)),
        "n_test": int(len(Xte)),
        "train_test_split": "80/20 stratified random",
        "metrics": {
            "mae_score_points": round(mae, 2),
            "rmse_score_points": round(rmse, 2),
            "r2": round(r2, 3),
            "metric_note": (
                "Prototype evaluation on SYNTHETIC demonstration data only. "
                "Does NOT represent real-world model accuracy."
            ),
        },
        "feature_importance": importance,
        "trained_on": "synthetic_demo_data",
        "demo_data": True,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    import joblib

    joblib.dump(model, MODEL_PATH)
    META_PATH.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print("=" * 72)
    print("HEATSHIELD AI - model training complete")
    print("=" * 72)
    print(f" samples          : {int(len(df))}")
    print(f" features         : {len(FEATURES)}")
    print("=" * 72)
    print(" PROTOYPE EVALUATION ON SYNTHETIC DEMO DATA (not real-world accuracy)")
    print("=" * 72)
    print(f" MAE  (score pts) : {mae:.2f}")
    print(f" RMSE (score pts) : {rmse:.2f}")
    print(f" R2               : {r2:.3f}")
    print("=" * 72)
    print(" Feature importance (gain):")
    for k, v in importance.items():
        print(f"   {k:<26} {v:.4f}")
    print("=" * 72)
    print(f" model saved -> {MODEL_PATH}")
    print(f" metadata  -> {META_PATH}")


if __name__ == "__main__":
    main()