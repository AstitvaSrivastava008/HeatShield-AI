import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import { useApp } from "@/context/AppContext";
import { riskLevelFromScore } from "@/lib/risk";
import type { WardSummary } from "@/services/types";

/** Whole-extent framing: keeps a margin of context around every ward. */
const OVERVIEW_PADDING: L.PointTuple = [32, 32];

/**
 * Framing when a single ward is focused. The generous padding means the
 * neighbouring wards stay on screen as context instead of the view jumping
 * into a full-screen polygon, and maxZoom caps the zoom so a single small
 * ward can never blow up to an over-zoomed tile view.
 */
const FOCUS_PADDING: L.PointTuple = [96, 96];
const FOCUS_MAX_ZOOM = 14;

const MIN_ZOOM = 11;
const MAX_ZOOM = 17;

interface ViewHandle {
  reset: () => void;
}

/**
 * Owns the camera. Two independent intents:
 *   1. frame the whole municipality whenever the dataset changes, and
 *   2. frame one ward only in response to an explicit map click.
 * Ward selection coming from a list, an alert or the detail panel never moves
 * the camera - only a click on the map itself does.
 */
function MapView({
  extent,
  focus,
  handleRef,
}: {
  extent: L.LatLngBounds | null;
  focus: { bounds: L.LatLngBounds; token: number } | null;
  handleRef: React.MutableRefObject<ViewHandle | null>;
}) {
  const map = useMap();

  const frameAll = () => {
    if (extent) map.fitBounds(extent, { padding: OVERVIEW_PADDING });
  };

  useEffect(() => {
    handleRef.current = { reset: frameAll };
    return () => {
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, extent]);

  useEffect(() => {
    frameAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extent, map]);

  useEffect(() => {
    if (!focus) return;
    map.fitBounds(focus.bounds, { padding: FOCUS_PADDING, maxZoom: FOCUS_MAX_ZOOM });
  }, [focus, map]);

  return null;
}

function styleFor(ward: WardSummary, selected: boolean) {
  const color = riskLevelFromScore(ward.risk_score);
  const palette: Record<string, { fill: string }> = {
    LOW: { fill: "#16a34a" },
    MODERATE: { fill: "#f59e0b" },
    HIGH: { fill: "#f97316" },
    EXTREME: { fill: "#dc2626" },
  };
  const c = palette[color];
  return {
    fillColor: c.fill,
    weight: selected ? 2.5 : 1,
    color: selected ? "#0f172a" : "rgba(15,23,42,0.45)",
    opacity: selected ? 1 : 0.6,
    fillOpacity: selected ? 0.85 : 0.55,
    dashArray: selected ? undefined : "2 3",
  };
}

function popupHtml(ward: WardSummary): string {
  const score = Math.round(ward.risk_score);
  const color =
    score > 75 ? "#dc2626" : score > 50 ? "#f97316" : score > 25 ? "#f59e0b" : "#16a34a";
  return `
    <div style="font-family:Inter,system-ui,sans-serif;min-width:190px">
      <div style="font-size:13px;font-weight:600;color:#0f172a">${ward.ward_name}</div>
      <div style="font-size:12px;color:#64748b">Ward ${ward.ward_id.replace("W", "")}</div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:6px">
        <span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${color}"></span>
        <span style="font-size:13px;font-weight:700;color:#0f172a">${score}/100</span>
        <span style="font-size:11px;font-weight:600;color:${color}">${
          score > 75 ? "EXTREME" : score > 50 ? "HIGH" : score > 25 ? "MODERATE" : "LOW"
        }</span>
      </div>
      <div style="font-size:12px;color:#334155;margin-top:3px">WBGT ${ward.wbgt}°C · HI ${ward.heat_index}°C</div>
      <div style="font-size:11px;color:#7c8ba1;margin-top:6px">Simulated demo risk. Click map panel for details.</div>
    </div>`;
}

export default function WardMap({
  wards,
  loading,
  error,
  minHeight = 440,
}: {
  wards: WardSummary[];
  loading: boolean;
  error: string | null;
  minHeight?: number;
}) {
  const { selectedWardId, setSelectedWardId } = useApp();

  const collection = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: wards
        .map((w) => w.boundary)
        .filter((b): b is NonNullable<typeof b> => b != null),
    };
  }, [wards]);

  const extent = useMemo<L.LatLngBounds | null>(() => {
    if (!collection.features.length) return null;
    try {
      return L.geoJSON(collection).getBounds();
    } catch {
      return null;
    }
  }, [collection]);

  /** Stops the user scrolling or zooming off into empty space. */
  const maxBounds = useMemo(() => extent?.pad(0.35) ?? undefined, [extent]);

  const [focus, setFocus] = useState<{ bounds: L.LatLngBounds; token: number } | null>(null);
  const viewRef = useRef<ViewHandle | null>(null);

  const focusWard = (ward: WardSummary) => {
    if (!ward.boundary) return;
    let bounds: L.LatLngBounds;
    try {
      bounds = L.geoJSON(ward.boundary).getBounds();
    } catch {
      return;
    }
    // The token guarantees a re-click on the already-selected ward re-frames.
    setFocus((prev) => ({ bounds, token: (prev?.token ?? 0) + 1 }));
  };

  const resetView = () => {
    setFocus(null);
    viewRef.current?.reset();
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <div style={{ height: minHeight, width: "100%" }} className="relative z-0">
        <MapContainer
          style={{ height: "100%", width: "100%" }}
          bounds={extent ?? undefined}
          boundsOptions={{ padding: OVERVIEW_PADDING }}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          maxBounds={maxBounds}
          scrollWheelZoom={false}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapView extent={extent} focus={focus} handleRef={viewRef} />
          {collection.features.length > 0 && (
            <GeoJSON
              key={`${selectedWardId ?? "none"}`}
              data={collection}
              style={(feature) =>
                styleFor(
                  wards.find((w) => w.ward_id === feature?.properties?.ward_id) ??
                    ({} as WardSummary),
                  feature?.properties?.ward_id === selectedWardId
                )
              }
              onEachFeature={(feature, layer) => {
                const wardId = feature.properties?.ward_id as string;
                const ward = wards.find((w) => w.ward_id === wardId);
                layer.on({
                  click: () => {
                    setSelectedWardId(wardId);
                    if (ward) {
                      layer.bindPopup(popupHtml(ward), { closeButton: false });
                      focusWard(ward);
                    }
                  },
                  mouseover: (e) => {
                    const l = e.target as L.Path;
                    l.setStyle({
                      fillOpacity: 0.9,
                      weight: 2,
                      color: "rgba(15,23,42,0.7)",
                    });
                  },
                  mouseout: (e) => {
                    const l = e.target as L.Path;
                    const w = wards.find((x) => x.ward_id === wardId);
                    l.setStyle(styleFor(w ?? ({} as WardSummary), wardId === selectedWardId));
                    if (l.isPopupOpen()) (l as L.Layer).closePopup();
                  },
                });
                if (ward) {
                  layer.bindTooltip(`<b>${ward.ward_name}</b> · ${ward.risk_score}/100`, {
                    sticky: true,
                    className: "hs-tooltip",
                  });
                  // The GeoJSON layer remounts on selection change, so a popup
                  // bound by the previous layer is gone. Re-open it for the
                  // ward that is still selected.
                  if (wardId === selectedWardId) {
                    layer.bindPopup(popupHtml(ward), { closeButton: false });
                  }
                }
              }}
            />
          )}
        </MapContainer>
      </div>

      {loading && (
        <div className="absolute inset-0 z-[500] grid place-items-center bg-white/70">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 shadow-lg">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-700" />
            Loading ward risk…
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-[500] grid place-items-center bg-white/80 p-4">
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-slate-200 bg-white/95 p-3 shadow-lg">
        <p className="label mb-1.5">Heat Risk</p>
        <ul className="space-y-1.5 text-xs font-medium text-slate-700">
          {(
            [
              ["LOW", "#16a34a"],
              ["MODERATE", "#f59e0b"],
              ["HIGH", "#f97316"],
              ["EXTREME", "#dc2626"],
            ] as const
          ).map(([label, color]) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-sm border border-black/10"
                style={{ backgroundColor: color }}
              />
              {label}
            </li>
          ))}
        </ul>
        <p className="mt-2 border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">
          Simulated ward boundaries
        </p>
      </div>

      <button
        type="button"
        onClick={resetView}
        className="pointer-events-auto absolute right-3 top-3 z-[500] btn-secondary"
      >
        Reset view
      </button>
    </div>
  );
}