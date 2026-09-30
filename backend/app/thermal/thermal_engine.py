"""
Thermal stress engine for HEATSHIELD AI.

Computes three human thermal-stress metrics from basic weather inputs:

    1. Heat Index            (NWS Rothfusz regression, the official NOAA formula
                             for heat index, applicable at T >= 27C)
    2. WBGT - Wet Bulb Globe Temperature
                             (outdoor, full-sun WBGT = 0.7*Tnwb + 0.2*Tg + 0.1*Ta
                             with Stull (2011) natural wet-bulb temperature and a
                             simplified black-globe model)
    3. UTCI - Universal Thermal Climate Index
                             NO official polynomial implementation is shipped in
                             this prototype. We provide a documented, physically
                             motivated PROXY derived from the same variables
                             (air temp, humidity, wind, radiant load) and clearly
                             label it as an approximation.

Assumptions & units
-------------------
- temperature            : degrees Celsius
- humidity               : relative humidity in percent (0-100)
- wind_speed             : metres per second at ~10 m
- solar_radiation        : clear-sky irradiance proxy (W/m2, 0-1200)

All simplified approximations are intentionally labelled. For a production
system, replace `calculate_utci` with the official UTCI polynomial (Bröde et
al., 2012) and validate WBGT against local observer measurements.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

# ---------------------------------------------------------------------------
# HEAT INDEX (NOAA / National Weather Service)
# ---------------------------------------------------------------------------
# Rothfusz (1990) regression on the Steadman model.
# Valid fitting range ~ T = 27..43 C, RH = 40..100 %.
# Below 27 C the formula overestimates; we clamp to air temperature there.
# ---------------------------------------------------------------------------


def _degrees_f(celsius: float) -> float:
    return celsius * 9.0 / 5.0 + 32.0


def _degrees_c(fahrenheit: float) -> float:
    return (fahrenheit - 32.0) * 5.0 / 9.0


def heat_index(temp_c: float, humidity_pct: float) -> float:
    if temp_c < 27.0:
        # Outside the Rothfusz fitting range: report air temperature (documented).
        return round(temp_c, 1)
    t = _degrees_f(temp_c)
    r = humidity_pct
    hi = (
        -42.379
        + 2.04901523 * t
        + 10.14333127 * r
        - 0.22475541 * t * r
        - 6.83783e-3 * t * t
        - 5.481717e-2 * r * r
        + 1.22874e-3 * t * t * r
        + 8.5282e-4 * t * r * r
        - 1.99e-6 * t * t * r * r
    )
    # Adjustments recommended by NWS for humid / dry regimes
    if r < 13 and 80 <= t <= 112:
        adj = ((13 - r) / 4) * math.sqrt((17 - abs(t - 95.0)) / 17)
        hi -= adj
    elif r > 85 and 80 <= t <= 87:
        adj = ((r - 85) / 10) * ((87 - t) / 5)
        hi += adj
    # If the adjusted figure is below the air temperature, use air temp.
    hi = max(hi, t)
    return round(_degrees_c(hi), 1)


# ---------------------------------------------------------------------------
# WET BULB GLOBE TEMPERATURE (outdoor, full-sun)
# ---------------------------------------------------------------------------
# WBGT_out = 0.7*Tnwb + 0.2*Tg + 0.1*Ta
#   Tnwb : natural wet-bulb temperature (deg C)  -> Stull (2011) closed form
#   Tg   : 150 mm black-globe temperature (deg C)
#   Ta   : shade dry-bulb air temperature (deg C)
#
# Globe temperature from a simplified radiative-convective balance:
#   Tg ~ Ta + (alpha * I) / (h + sigma_appx)
# where I is solar irradiance (W/m2). We calibrate to a still-air, brightly
# sunlit black globe so that Tg >= Ta always. This is a documented
# approximation; a real station uses a measured globe thermometer.
# ---------------------------------------------------------------------------


def _stull_natural_wet_bulb(temp_c: float, rh_pct: float) -> float:
    """Stull (2011) closed-form natural wet-bulb temperature (deg C)."""
    t_c = temp_c
    rh = rh_pct
    tnw = (
        t_c * math.atan(0.151977 * (rh + 8.313659) ** 0.5)
        + math.atan(t_c + rh)
        - math.atan(rh - 1.676331)
        + 0.00391838 * rh ** 1.5 * math.atan(0.023101 * rh)
        - 4.686035
    )
    return tnw


def _globe_temperature(temp_c: float, solar_rad: float, wind_ms: float) -> float:
    """Simplified black-globe temperature (documented approximation)."""
    # Convective conductance rises with wind speed (diminishing returns).
    conv = 4.0 + 6.0 * math.sqrt(max(wind_ms, 0.5))
    # Radiative absorption for a matte-black globe: alpha ~ 0.9.
    absorbed = 0.9 * max(solar_rad, 0.0)
    # Globe reaches a temperature rise where absorbed radiation balances
    # convective + radiative loss. Modelled simply here.
    static_rise = absorbed / (conv + 8.0)
    rise = static_rise * (1.0 / (1.0 + 0.35 * math.log10(1.0 + max(wind_ms, 0.0))))
    return temp_c + rise


def wbgt(temp_c: float, humidity_pct: float, solar_rad: float, wind_ms: float) -> float:
    tnwb = _stull_natural_wet_bulb(temp_c, humidity_pct)
    tg = _globe_temperature(temp_c, solar_rad, wind_ms)
    wb = 0.7 * tnwb + 0.2 * tg + 0.1 * temp_c
    return round(wb, 1)


# ---------------------------------------------------------------------------
# UTCI - Universal Thermal Climate Index (PROXY)
# ---------------------------------------------------------------------------
# The official UTCI uses a high-order polynomial in air temperature, humidity,
# wind and radiant temperature (Bröde et al. 2012). The full coefficient set
# is not implemented here. We provide a documented linearised PROXY built on
# the same physical drivers:
#
#   utci_proxy = Ta
#              + humidity_term(Ta, RH)     (humidity hurts when Ta is high)
#              - wind_term(Ta, wind)       (wind cools, capped)
#              + radiant_term(Ta, solar)   (sun radiation adds load, minus wind)
#
# It is NOT the official UTCI and must only be used for demonstration.
# ---------------------------------------------------------------------------


def utci_proxy(temp_c: float, humidity_pct: float, wind_ms: float, solar_rad: float) -> float:
    ta = temp_c
    # Humidity only meaningfully increases perceived strain when the air is warm.
    if ta >= 26.0:
        humidity_term = ((humidity_pct - 45.0) / 100.0) * max(0.0, ta - 25.0) * 0.55
    else:
        humidity_term = (humidity_pct - 45.0) / 100.0 * 2.5
    # Wind cooling on skin, capped (dampened at very high temps where wind
    # can actually *warm* skin above ~33C air temp -- neglected here).
    if ta < 33.0:
        wind_term = min(6.0, 3.5 * wind_ms**0.6)
    else:
        wind_term = min(3.0, 1.5 * wind_ms**0.6)
    # Radiant load: absorbed solar raises the effective radiant temperature.
    radiant_term = (max(solar_rad, 0.0) / 1000.0) * 7.0 / (1.0 + 0.4 * wind_ms)
    return round(ta + max(0.0, humidity_term) - wind_term + radiant_term, 1)


# ---------------------------------------------------------------------------
# Convenience API
# ---------------------------------------------------------------------------


@dataclass
class ThermalMetrics:
    heat_index: float
    wbgt: float
    utci: float
    notes: list[str]


SCIENCE_NOTES = [
    "Heat Index: NOAA/NWS Rothfusz regression on Steadman model (official formula, valid T>=27C).",
    "WBGT: outdoor full-sun formula 0.7*Tnwb+0.2*Tg+0.1*Ta; Tnwb from Stull (2011).",
    "Globe temperature: simplified radiative-convective model (not a measured 150mm globe).",
    "UTCI: documented PROXY only (humidity+wind+radiant terms). Not the official UTCI polynomial.",
    "Units: temperature C, humidity %, wind m/s, solar W/m2.",
]


def calculate_all(temp_c: float, humidity_pct: float, wind_ms: float, solar_rad: float) -> dict:
    return {
        "heat_index": heat_index(temp_c, humidity_pct),
        "wbgt": wbgt(temp_c, humidity_pct, solar_rad, wind_ms),
        "utci": utci_proxy(temp_c, humidity_pct, wind_ms, solar_rad),
        "units": {
            "temperature": "celsius",
            "humidity": "percent_relative_humidity",
            "wind": "m/s",
            "solar_radiation": "W/m2_clear_sky_proxy",
        },
        "notes": SCIENCE_NOTES,
    }