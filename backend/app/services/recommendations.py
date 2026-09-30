"""
AI Heat Action Engine - converts risk level into recommended actions.

The actions are PROTOYPE RECOMMENDATIONS. HEATSHIELD does not (and should
not be presented as) automatically controlling government infrastructure;
these are decision-support suggestions for human authorities.
"""

from __future__ import annotations

RISK_ACTIONS: dict[str, dict] = {
    "EXTREME": {
        "level": "EXTREME",
        "heading": "Activation & protection",
        "actions": [
            "Activate cooling centres immediately",
            "Issue public health heat alert to residents",
            "Prepare nearby hospitals for heat-illness admissions",
            "Restrict / shift outdoor work hours (avoid 11:00-16:00)",
            "Daily monitoring of vulnerable population register",
            "Standby for emergency ambulance dispatch",
        ],
    },
    "HIGH": {
        "level": "HIGH",
        "heading": "Elevated monitoring",
        "actions": [
            "Increase ward health monitoring frequency",
            "Issue targeted outdoor-worker heat advisory",
            "Pre-position hospital & ambulance readiness",
            "Pre-cool public buildings / open cooling points",
            "Advise hydration & rest protocols for outdoor staff",
        ],
    },
    "MODERATE": {
        "level": "MODERATE",
        "heading": "Awareness & watch",
        "actions": [
            "Public awareness notification (hydration, shade)",
            "Continue hourly forecast monitoring",
            "Track vulnerable population exposure lists",
            "Verify cooling centre readiness",
        ],
    },
    "LOW": {
        "level": "LOW",
        "heading": "Routine monitoring",
        "actions": [
            "Routine forecast & thermal stress monitoring",
            "Maintain readiness for forecast escalation",
            "Audit vulnerable-population registers",
        ],
    },
}

PROTOTYPE_NOTE = "Prototype Recommended Actions - decision support for human authorities, not automatic control of infrastructure."


def recommendations_for(risk_level: str) -> dict:
    key = (risk_level or "LOW").upper()
    if key not in RISK_ACTIONS:
        key = "LOW"
    return {"prototype_note": PROTOTYPE_NOTE, **RISK_ACTIONS[key]}