"""
Generate demo/synthetic data for the HEATSHIELD AI prototype.

==========================================================================
DEMO / SYNTHETIC DATA FOR PROTOTYPE DEMONSTRATION ONLY.
==========================================================================
Every value produced by this script is fabricated for the Smart India
Hackathon 2026 (SIH26083) demonstration prototype. It does NOT represent
real measurements, real hospitals, real mortality figures, or any real
government dataset. The city, wards, people and health counts are fictional.

Outputs (written next to this script):
  weather_demo.csv          - synthetic 5-day forecast for the demo city
  vulnerability_demo.csv    - synthetic ward vulnerability profile
  health_demo.csv           - synthetic heat-illness proxy counts (not real data)
  wards_demo.geojson        - fictional ward boundaries (GeoJSON polygons)

Run:  python data/generate_demo_data.py
"""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path

OUT = Path(__file__).resolve().parent

DEMO_NOTE = "DEMO/SYNTHETIC DATA - generated for prototype demonstration only. Not real-world data."

# Fictional demo municipality centroid (roughly central India, chosen only so
# the map looks geographically plausible; the wards below are invented).
BASE_LAT = 21.1450
BASE_LON = 79.0800

# ---------------------------------------------------------------------------
# 12 fictional wards. Vulnerability values are invented for the demo.
# ---------------------------------------------------------------------------
WARDS = [
    # id, name, grid col, row, elderly_frac, outdoor_worker_frac, population,
    # pop_density(0-1), hospital_proximity_km, green_cover(0-1), baseline temp offset
    ("W01", "Ward 01 - Riverside",     0, 0, 0.11, 0.14, 18400, 0.42, 3.1, 0.55, -0.4),
    ("W02", "Ward 02 - Station Area",  1, 0, 0.16, 0.24, 26100, 0.78, 1.2, 0.22,  0.9),
    ("W03", "Ward 03 - Market Quarter",2, 0, 0.13, 0.31, 31200, 0.88, 1.8, 0.15,  1.4),
    ("W04", "Ward 04 - Old Town",      3, 0, 0.22, 0.12, 22800, 0.71, 2.4, 0.28,  0.6),
    ("W05", "Ward 05 - North Fields",  0, 1, 0.14, 0.38, 15600, 0.31, 5.6, 0.62, -0.8),
    ("W06", "Ward 06 - Tech Corridor", 1, 1, 0.08, 0.09, 24500, 0.64, 2.0, 0.41,  0.3),
    ("W07", "Ward 07 - Industrial Belt",2, 1, 0.19, 0.42, 28900, 0.82, 4.2, 0.11,  1.8),
    ("W08", "Ward 08 - Lake View",     3, 1, 0.15, 0.11, 19700, 0.48, 2.7, 0.58, -0.6),
    ("W09", "Ward 09 - South Transit", 0, 2, 0.12, 0.29, 21400, 0.66, 3.4, 0.25,  0.7),
    ("W10", "Ward 10 - Hospital Hills",1, 2, 0.27, 0.08, 17300, 0.39, 0.8, 0.66, -0.5),
    ("W11", "Ward 11 - Canal Pada",    2, 2, 0.18, 0.35, 23600, 0.55, 4.8, 0.34,  0.2),
    ("W12", "Ward 12 - South Extension",3, 2, 0.10, 0.17, 27400, 0.73, 2.2, 0.36,  0.5),
]

CELL_DEG = 0.030  # ~3.3 km cells


def ward_polygon(col: int, row: int) -> list[list[list[float]]]:
    """Build a slightly irregular rectangle so boundaries do not look perfect."""
    west = BASE_LON + (col - 2.0) * CELL_DEG
    east = west + CELL_DEG * 0.97
    north = BASE_LAT + (1.0 - row) * CELL_DEG
    south = north - CELL_DEG * 0.94
    # small deterministic jitter on shared-looking corners
    j = 0.0016
    ring = [
        [west, north],
        [west + CELL_DEG * 0.45, north + j],
        [east - j, north],
        [east, north - CELL_DEG * 0.5],
        [east + j * 0.5, south + CELL_DEG * 0.4],
        [east - CELL_DEG * 0.3, south],
        [west + j, south - j],
        [west - j * 0.5, south + CELL_DEG * 0.55],
        [west, north],
    ]
    return [ring]


def write_weather() -> None:
    """
    Synthetic 5-day forecast (Day 1 .. Day 5) for the demo city.
    A heatwave builds from Day 3 onward so the product story
    "risk detected 3-5 days before peak heat" is visible in the chart.
    """
    path = OUT / "weather_demo.csv"
    days = [
        # day, date, tmax, tmin, rh_mean, wind, solar, note
        (1, "2026-05-11", 38.4, 26.1, 44, 3.2, 640, "Pre-heatwave baseline"),
        (2, "2026-05-12", 40.1, 27.3, 47, 2.8, 690, "Heat building"),
        (3, "2026-05-13", 41.8, 28.4, 52, 2.2, 745, "Heatwave onset"),
        (4, "2026-05-14", 43.0, 29.6, 56, 1.8, 790, "Peak approach"),
        (5, "2026-05-15", 43.6, 30.2, 59, 1.5, 810, "Peak heat day"),
    ]
    with path.open("w", newline="", encoding="utf-8") as fh:
        fh.write(f"# {DEMO_NOTE}\n")
        fh.write("# Synthetic 5-day forecast for the fictional demo city.\n")
        fh.write("# Units: temp_c=Celsius, wind_ms=m/s, solar_proxy=W/m2 (clear-sky index x1000), humidity=%RH\n")
        w = csv.writer(fh)
        w.writerow(
            [
                "day_label", "date", "temp_max_c", "temp_mean_c", "temp_min_c",
                "humidity_mean_pct", "wind_speed_ms", "solar_radiation_proxy", "note",
            ]
        )
        for label, date, tmax, tmin, rh, wind, solar, note in days:
            tmean = round((tmax + tmin) / 2, 1)
            w.writerow([f"Day {label}", date, tmax, tmean, tmin, rh, wind, solar, note])
    print(f"wrote {path}")


def write_vulnerability() -> None:
    path = OUT / "vulnerability_demo.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        fh.write(f"# {DEMO_NOTE}\n")
        fh.write("# Synthetic ward vulnerability profile. Population figures are invented.\n")
        w = csv.writer(fh)
        w.writerow(
            [
                "ward_id", "ward_name", "population", "elderly_fraction",
                "outdoor_worker_fraction", "population_density_index",
                "hospital_proximity_km", "green_cover_index", "cooling_centre_count",
            ]
        )
        for wid, name, _c, _r, eld, outw, pop, dens, hosp, green, _off in WARDS:
            cooling = 0 if hosp > 4 else (1 if dens > 0.5 else 2)
            w.writerow([wid, name, pop, eld, outw, dens, hosp, green, cooling])
    print(f"wrote {path}")


def write_health() -> None:
    """
    Synthetic heat-illness consultation proxy.
    IMPORTANT: these are invented numbers used only to exercise the demo
    data pipeline. They are NOT hospital statistics of any real place.
    """
    path = OUT / "health_demo.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        fh.write(f"# {DEMO_NOTE}\n")
        fh.write("# Synthetic heat-illness consultation PROXY counts (invented).\n")
        fh.write("# NOT real hospital data. Used only to demonstrate the HealthDataProvider interface.\n")
        w = csv.writer(fh)
        w.writerow(
            [
                "ward_id", "date", "heat_illness_consults_proxy",
                "ambulance_dispatch_proxy", "note",
            ]
        )
        dates = ["2026-05-11", "2026-05-12", "2026-05-13", "2026-05-14", "2026-05-15"]
        for wid, _n, _c, _r, eld, outw, pop, dens, _h, _g, _off in WARDS:
            base = pop / 1000 * (0.4 + eld * 2 + outw * 1.5) * dens
            for i, date in enumerate(dates):
                scale = 1 + 0.18 * i
                consults = round(base * scale)
                amb = round(base * scale * 0.12)
                w.writerow([wid, date, consults, amb, "synthetic proxy"])
    print(f"wrote {path}")


def write_wards_geojson() -> None:
    path = OUT / "wards_demo.geojson"
    features = []
    for wid, name, col, row, eld, outw, pop, dens, hosp, green, toff in WARDS:
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "ward_id": wid,
                    "ward_name": name,
                    "demo_data": True,
                    "temp_offset_c": round(toff, 2),
                    "elderly_fraction": eld,
                    "outdoor_worker_fraction": outw,
                    "population": pop,
                    "population_density_index": dens,
                    "hospital_proximity_km": hosp,
                    "green_cover_index": green,
                    "centroid": [
                        round(BASE_LON + (col - 1.5) * CELL_DEG, 5),
                        round(BASE_LAT + (0.5 - row) * CELL_DEG, 5),
                    ],
                },
                "geometry": {"type": "Polygon", "coordinates": ward_polygon(col, row)},
            }
        )
    fc = {
        "type": "FeatureCollection",
        "name": "heatshield_demo_wards",
        "demo_note": DEMO_NOTE,
        "features": features,
    }
    path.write_text(json.dumps(fc, indent=2), encoding="utf-8")
    print(f"wrote {path} ({len(features)} wards)")


def main() -> None:
    write_weather()
    write_vulnerability()
    write_health()
    write_wards_geojson()
    print("done - all files are DEMO/SYNTHETIC data for prototype demonstration only.")


if __name__ == "__main__":
    main()
