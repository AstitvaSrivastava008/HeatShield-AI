"""
ML model service - loads the trained XGBoost risk model and serves
predictions plus an honest explainability view.

Explainability (drivers) comes from SHAP when installed; otherwise it falls
back to the model's built-in feature importance. The UI clearly labels the
origin (`shap` vs `model_feature_importance`). We never fake SHAP values:
if SHAP is unavailable every exiting consumer sees `explainer: fallback`.

Prototype confidence is the calibration width of the held-out test error
(Mean Absolute Error scaled by 100), reported as "prototype model confidence"
- NOT a validated accuracy figure.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from .. import config
from .dataset import COLUMNS, FEATURES, generate_demo_dataset

logger = logging.getLogger("heatshield.ml")

ARTIFACT = config.MODEL_ARTIFACT
META_PATH = config.MODEL_META


def risk_level(score: float) -> str:
    if score <= 25:
        return "LOW"
    if score <= 50:
        return "MODERATE"
    if score <= 75:
        return "HIGH"
    return "EXTREME"


class HeatRiskModel:
    def __init__(self) -> None:
        self.model: Any = None
        self.meta: dict[str, Any] = {}
        self._shap_available: bool = False
        self.load()

    # -- loading ------------------------------------------------------------
    def load(self) -> None:
        if ARTIFACT.exists() and META_PATH.exists():
            try:
                self.model = joblib.load(ARTIFACT)
                self.meta = json.loads(META_PATH.read_text(encoding="utf-8"))
                logger.info("Loaded trained risk model from %s", ARTIFACT)
            except Exception as exc:  # pragma: no cover - defensive fallback
                logger.warning("Could not load model artifact (%s); rebuilding fallback", exc)
                self._train_fallback()
        else:
            logger.warning("No trained model artifact; training lightweight fallback model")
            self._train_fallback()
        self._resolve_shap()

    def _train_fallback(self) -> None:
        """Quick fallback so the API always answers, even before train_model.py."""
        import xgboost as xgb
        from sklearn.model_selection import train_test_split

        df = generate_demo_dataset(n=1500, seed=7)
        X = df[FEATURES]
        y = df["human_heat_risk_score"]
        Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=7)
        model = xgb.XGBRegressor(
            n_estimators=180, max_depth=5, learning_rate=0.06, subsample=0.85,
            colsample_bytree=0.85, objective="reg:squarederror", random_state=7,
        )
        model.fit(Xtr, ytr)
        yp = model.predict(Xte)
        mae = float(np.mean(np.abs(yp - yte)))
        r2 = float(np.clip(1 - np.var(yte - yp) / np.var(yte), -np.inf, 1.0))
        self.model = model
        self.meta = {
            "trained_on": "fallback_on_demand",
            "demo_data": True,
            "model": "xgboost-regressor",
            "features": FEATURES,
            "metrics": {"mae_score_points": round(mae, 2), "r2": round(r2, 3)},
            "n_samples": int(len(df)),
            "generated_at": "runtime_fallback",
        }
        logger.info("Trained fallback model (mae=%.2f r2=%.3f)", mae, r2)

    def _resolve_shap(self) -> None:
        try:
            import shap  # noqa: F401

            self._shap_available = True
        except Exception:
            self._shap_available = False

    # -- prediction ---------------------------------------------------------
    def predict(self, features: dict[str, float]) -> dict[str, Any]:
        row = pd.DataFrame([{f: features[f] for f in FEATURES}])
        score = float(np.clip(self.model.predict(row)[0], 0.0, 100.0))
        return {
            "risk_score": round(score, 1),
            "risk_level": risk_level(score),
            "features": {f: round(float(features[f]), 4) for f in FEATURES},
        }

    # -- explainability -----------------------------------------------------
    def explain(
        self, features: dict[str, float]
    ) -> dict[str, Any]:
        X = pd.DataFrame([{f: features[f] for f in FEATURES}])
        contributions: list[dict[str, Any]] = []
        explainer_source = "model_feature_importance"

        if self._shap_available:
            try:
                import shap

                explainer = shap.Explainer(self.model, feature_names=FEATURES)
                sv = explainer(X)
                vals = np.asarray(sv.values[0]) if hasattr(sv.values, "ndim") else sv.values
                row = X.iloc[0]
                for i, f in enumerate(FEATURES):
                    contributions.append(
                        {
                            "feature": f,
                            "value": float(row[f]),
                            "contribution": float(vals[i]),  # shap units = risk score points
                            "direction": "up" if vals[i] >= 0 else "down",
                        }
                    )
                explainer_source = "shap"
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning("SHAP explainer failed (%s); using fallback importance", exc)
                self._shap_available = False

        if explainer_source != "shap":
            # Fallback: signed gain-based importance from the XGBoost model.
            importances = self.model.feature_importances_
            importance_sum = float(np.sum(importances)) or 1.0
            # Direction heuristic from a local finite-difference of the model.
            base = self.model.predict(X)[0]
            for i, f in enumerate(FEATURES):
                row = X.iloc[0].copy()
                delta = row[f] * 0.02 + 1e-6
                row[f] += delta
                sign = 1.0 if self.model.predict(pd.DataFrame([row]))[0] >= base else -1.0
                share = importances[i] / importance_sum
                contributions.append(
                    {
                        "feature": f,
                        "value": float(X.iloc[0][f]),
                        "contribution": float(sign * share),
                        "direction": "up" if sign >= 0 else "down",
                    }
                )

        contributions.sort(key=lambda c: abs(c["contribution"]), reverse=True)
        total = sum(abs(c["contribution"]) for c in contributions) or 1.0
        for c in contributions:
            c["percent_contribution"] = round(100.0 * abs(c["contribution"]) / total, 1)
        return {
            "explainer": explainer_source,
            "contributions": contributions,
            "note": (
                "SHAP values (absolute contribution to the prototype model's risk score)."
                if explainer_source == "shap"
                else "Model feature importance fallback with direction heuristic (SHAP not available on this machine)."
            ),
        }

    def model_info(self) -> dict[str, Any]:
        info = dict(self.meta)
        info["risk_levels"] = {
            "LOW": config.RISK_THRESHOLDS["LOW"],
            "MODERATE": config.RISK_THRESHOLDS["MODERATE"],
            "HIGH": config.RISK_THRESHOLDS["HIGH"],
            "EXTREME": config.RISK_THRESHOLDS["EXTREME"],
        }
        info["explainer_available"] = self._shap_available
        info["confidence_definition"] = (
            "Prototype model confidence = (1 - MAE/100) on held-out synthetic data. "
            "Not a validated accuracy metric."
        )
        info["demo_note"] = "Model trained on synthetic demonstration data. NOT real-world validated."
        return info


_model: HeatRiskModel | None = None


def get_model() -> HeatRiskModel:
    global _model
    if _model is None:
        _model = HeatRiskModel()
    return _model