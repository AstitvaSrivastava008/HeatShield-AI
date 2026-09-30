"""
Data-provider interfaces for HEATSHIELD AI.

The API layer *only* depends on these abstract interfaces. The demo
implementation ships with the prototype; production deployments replace the
"Demo" providers with adapters for real weather APIs, GIS services, health
systems and vulnerability datasets (see README "Real data integration").

This keeps the pipeline identical no matter where the data comes from.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class WeatherProvider(ABC):
    name: str = "abstract"
    demo: bool = True

    @abstractmethod
    def fetch_forecast(self) -> list[dict[str, Any]]:
        """Return a list of daily forecast records (ISO dates)."""

    @abstractmethod
    def baseline_conditions(self) -> dict[str, float]:
        """Return representative 'today' conditions (temp/rh/wind/solar)."""


class VulnerabilityDataProvider(ABC):
    name: str = "abstract"
    demo: bool = True

    @abstractmethod
    def fetch_ward_vulnerability(self, ward_id: str | None = None) -> list[dict[str, Any]]:
        """Return vulnerability profile per ward (population, elderly, workers...)."""


class HealthDataProvider(ABC):
    name: str = "abstract"
    demo: bool = True

    @abstractmethod
    def fetch_health_proxy(self, ward_id: str | None = None) -> list[dict[str, Any]]:
        """Return synthetic/proxy health indicators per ward (demo only)."""


class GISProvider(ABC):
    name: str = "abstract"
    demo: bool = True

    @abstractmethod
    def fetch_wards_geojson(self) -> dict[str, Any]:
        """Return a GeoJSON FeatureCollection of ward boundaries."""


# List of active providers (registered in order of resolution).
ACTIVE_PROVIDERS: dict[str, WeatherProvider | VulnerabilityDataProvider | HealthDataProvider | GISProvider] = {}