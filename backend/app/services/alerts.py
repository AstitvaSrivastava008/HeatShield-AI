"""
Alert Center - generates prototype alerts from the ward risk view and the
5-day forecast trend. Alerts are deterministic demo/diagnostic messages
labelled as such.
"""

from __future__ import annotations

from typing import Any

from .risk import RiskService

ALERT_TEMPLATES = {
    "EXTREME": [
        "Human heat risk is expected to increase tomorrow.",
        "Activate cooling centres and increase health monitoring now.",
    ],
    "HIGH": [
        "Elevated thermal stress predicted within 48 hours.",
        "Issue targeted outdoor-worker advisory.",
    ],
    "MODERATE": [
        "Monitor forecast and vulnerable population exposure.",
        "Issue public awareness notification.",
    ],
}


def generate_alerts(risk: RiskService, scenario: str | None = None) -> list[dict[str, Any]]:
    wards = risk.all_wards(scenario)
    forecast = risk.forecast(scenario)
    day_map = {f["day_label"]: f for f in forecast}
    tomorrow = day_map.get("Day 2") or day_map.get("Day 1")

    alerts: list[dict[str, Any]] = []
    for ward in wards:
        level = ward["risk_level"]
        if level not in ALERT_TEMPLATES:
            continue
        message = ALERT_TEMPLATES[level][0]
        # EXTREME wards get the "increase tomorrow" framing only when the
        # forecast supports it (risk on the rise towards the peak).
        if level == "EXTREME" and tomorrow and tomorrow["risk_level"] in ("HIGH", "EXTREME"):
            message = ALERT_TEMPLATES["EXTREME"][0]
        elif level == "EXTREME":
            message = ALERT_TEMPLATES["EXTREME"][1]
        alerts.append(
            {
                "id": f"ALT-{ward['ward_id']}",
                "severity": level,
                "ward_id": ward["ward_id"],
                "ward_name": ward["ward_name"],
                "risk_score": ward["risk_score"],
                "message": message,
                "timestamp": "demo-time",
                "demo": True,
            }
        )
    # Sort most severe first.
    order = {"EXTREME": 0, "HIGH": 1, "MODERATE": 2, "LOW": 3}
    alerts.sort(key=lambda a: order[a["severity"]])
    return alerts