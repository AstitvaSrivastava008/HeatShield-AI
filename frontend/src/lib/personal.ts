/**
 * Personal heatwave risk - on-device profile logic for the "My Heat Risk" modal.
 *
 * PRIVACY CONTRACT (deliberate design constraint, not an accident):
 *   - Age is collected as a coarse BAND, never a date of birth.
 *   - Location is read once via a one-shot `getCurrentPosition` and is NEVER
 *     sent to the backend, never written to storage, and never tracked
 *     continuously (`watchPosition` is not used anywhere).
 *   - The coordinates are resolved to a ward polygon on the client and then
 *     discarded - the only thing that leaves the browser is the ward's already
 *     public aggregate weather, plus two anonymous 0-1 ratios.
 *   - Nothing is persisted. Closing the tab forgets everything unless the user
 *     explicitly ticks "remember on this device", which stores only the age
 *     band, the work type and the chosen ward id in localStorage. Coordinates
 *     are never included in that record.
 *
 * The `elderly_density` / `outdoor_worker_density` values below are the two
 * vulnerability features the existing model already consumes
 * (backend/app/ml/dataset.py), so a personal score is directly comparable to a
 * ward score rather than being a separate, unvalidated scale.
 */

import type { RiskLevel, WardSummary } from "@/services/types";
import { riskLevelFromScore } from "@/lib/risk";

// ---------------------------------------------------------------------------
// Profile shape
// ---------------------------------------------------------------------------

export type AgeBandId = "u18" | "a18_40" | "a41_60" | "a60_70" | "a70p";
export type WorkTypeId = "outdoor" | "mixed" | "indoor";

export interface AgeBand {
  id: AgeBandId;
  label: string;
  /** Maps to the model's `elderly_density` feature (a 0-1 population share). */
  elderlyDensity: number;
  /** One line on why this band matters for heat physiology. */
  note: string;
}

export interface WorkType {
  id: WorkTypeId;
  label: string;
  /** Maps to the model's `outdoor_worker_density` feature. */
  outdoorWorkerDensity: number;
  note: string;
}

export interface PersonalProfile {
  ageBand: AgeBandId;
  workType: WorkTypeId;
  /** Ward resolved on-device. Null until the user picks one or grants location. */
  wardId: string | null;
  /** How wardId was established - surfaced verbatim in the privacy notice. */
  locationSource: "gps" | "manual" | null;
  /** Distance from the GPS fix to the matched ward centroid, in km. */
  distanceKm: number | null;
  cooledAccess: boolean;
  headCover: boolean;
  hydrates: boolean;
  healthSensitive: boolean;
}

export const AGE_BANDS: AgeBand[] = [
  {
    id: "u18",
    label: "Under 18",
    elderlyDensity: 0.02,
    note: "Children heat up and dehydrate faster than adults, and rarely self-report thirst.",
  },
  {
    id: "a18_40",
    label: "18 - 40",
    elderlyDensity: 0.03,
    note: "Heat tolerance is usually highest here, but sustained exertion still accumulates heat strain.",
  },
  {
    id: "a41_60",
    label: "41 - 60",
    elderlyDensity: 0.08,
    note: "Recovery from heat stress starts to slow, and cardiovascular strain becomes noticeable.",
  },
  {
    id: "a60_70",
    label: "60 - 70",
    elderlyDensity: 0.35,
    note: "Sweating efficiency and skin blood flow decline - a real rise in heat illness risk.",
  },
  {
    id: "a70p",
    label: "70 and above",
    elderlyDensity: 0.62,
    note: "Highest heat mortality band. Heat exhaustion can develop with little warning and often without thirst.",
  },
];

export const WORK_TYPES: WorkType[] = [
  {
    id: "outdoor",
    label: "Mostly outdoor",
    outdoorWorkerDensity: 0.85,
    note: "Full radiant load. WBGT and solar radiation dominate your heat strain.",
  },
  {
    id: "mixed",
    label: "Mixed indoor / outdoor",
    outdoorWorkerDensity: 0.4,
    note: "You shuttle between cooled rooms and hot outdoor air, so your body never acclimatises.",
  },
  {
    id: "indoor",
    label: "Mostly indoor",
    outdoorWorkerDensity: 0.08,
    note: "Low radiant load, but heat still piles up in unventilated rooms and commutes.",
  },
];

export function ageBand(id: AgeBandId): AgeBand {
  return AGE_BANDS.find((b) => b.id === id) ?? AGE_BANDS[1];
}

export function workType(id: WorkTypeId): WorkType {
  return WORK_TYPES.find((w) => w.id === id) ?? WORK_TYPES[2];
}

export const EMPTY_PROFILE: PersonalProfile = {
  ageBand: "a18_40",
  workType: "indoor",
  wardId: null,
  locationSource: null,
  distanceKm: null,
  cooledAccess: true,
  headCover: false,
  hydrates: true,
  healthSensitive: false,
};

// ---------------------------------------------------------------------------
// On-device location -> ward
// ---------------------------------------------------------------------------

const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
): number {
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad;
  const dLon = (bLon - aLon) * toRad;
  const lat1 = aLat * toRad;
  const lat2 = bLat * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Standard ray-casting point-in-polygon on a GeoJSON Polygon exterior ring.
 * Coordinates are [lon, lat] pairs, as per RFC 7946.
 */
export function pointInPolygon(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const straddles = yi > lat !== yj > lat;
    if (straddles && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export interface WardMatch {
  ward: WardSummary;
  method: "polygon" | "centroid";
  distanceKm: number;
}

/**
 * Resolves a coordinate to a ward entirely in the browser. Tries a real
 * polygon hit first, then falls back to the nearest centroid so a user just
 * outside the demo boundary still gets a sensible answer instead of an error.
 */
export function matchWard(wards: WardSummary[], lat: number, lon: number): WardMatch | null {
  if (!wards.length) return null;

  for (const ward of wards) {
    const geom = ward.boundary?.geometry;
    if (!geom || geom.type !== "Polygon") continue;
    const ring = geom.coordinates[0];
    if (!ring?.length) continue;
    if (pointInPolygon(lon, lat, ring)) {
      return { ward, method: "polygon", distanceKm: 0 };
    }
  }

  let best: WardMatch | null = null;
  for (const ward of wards) {
    if (!ward.centroid) continue;
    const [cLon, cLat] = ward.centroid;
    const d = haversineKm(lat, lon, cLat, cLon);
    if (!best || d < best.distanceKm) {
      best = { ward, method: "centroid", distanceKm: d };
    }
  }
  return best;
}

/** One-shot browser geolocation. Never watches, never stores. */
export function requestPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This browser does not expose a geolocation API."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => {
        const messages: Record<number, string> = {
          1: "Location permission was denied. You can still pick your ward manually below.",
          2: "Your location could not be determined. Please pick your ward manually below.",
          3: "Locating timed out. Please pick your ward manually below.",
        };
        reject(new Error(messages[err.code] ?? err.message));
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        // Re-use a fix up to 10 minutes old rather than re-acquiring the GPS chip.
        maximumAge: 600000,
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Personal risk assessment
// ---------------------------------------------------------------------------

export interface ExposureModifier {
  label: string;
  delta: number;
  reason: string;
}

/**
 * Transparent, capped adjustments from the yes/no exposure factors. These are
 * NOT part of the trained model - they are shown to the user as an explicit
 * signed breakdown so the number is never a black box.
 */
export function exposureModifiers(p: PersonalProfile): ExposureModifier[] {
  const out: ExposureModifier[] = [];
  if (!p.cooledAccess) {
    out.push({
      label: "No reliable cooling at hand",
      delta: 4,
      reason: "Without cooled or shaded space nearby the body cannot shed heat between exposures.",
    });
  }
  if (p.workType === "outdoor" && !p.headCover) {
    out.push({
      label: "Outdoor work without head cover",
      delta: 3,
      reason: "Direct solar load on the head adds roughly 15-20% to radiant heat gain.",
    });
  }
  if (!p.hydrates) {
    out.push({
      label: "Infrequent hydration",
      delta: 3,
      reason: "Dehydration begins before thirst is felt, which reduces sweating capacity.",
    });
  }
  if (p.healthSensitive) {
    out.push({
      label: "Heat-sensitive health condition or medication",
      delta: 6,
      reason: "Cardiac, respiratory and kidney conditions, and some medicines, impair heat regulation.",
    });
  }
  if (ageBand(p.ageBand).elderlyDensity >= 0.35) {
    out.push({
      label: "Age 60+",
      delta: 4,
      reason: "Reduced sweating and circulation means slower recovery from each hot spell.",
    });
  }
  return out;
}

export interface PersonalAssessment {
  /** Model output, 0-100, using the ward's own weather + the two profile ratios. */
  modelScore: number;
  /** Sum of the exposure modifiers above. */
  modifier: number;
  /** modelScore + modifier, clamped. The number shown to the user. */
  score: number;
  level: RiskLevel;
  ward: WardSummary;
  band: AgeBand;
  work: WorkType;
  modifiers: ExposureModifier[];
  /** Human-readable one-liner, e.g. "72/100 - EXTREME". */
  headline: string;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function assessPersonal(
  modelScore: number,
  ward: WardSummary,
  profile: PersonalProfile
): PersonalAssessment {
  const band = ageBand(profile.ageBand);
  const work = workType(profile.workType);
  const modifiers = exposureModifiers(profile);
  const modifier = modifiers.reduce((s, m) => s + m.delta, 0);
  const score = clamp(modelScore + modifier, 0, 100);
  return {
    modelScore,
    modifier,
    score,
    level: riskLevelFromScore(score),
    ward,
    band,
    work,
    modifiers,
    headline: `${Math.round(score)}/100 - ${riskLevelFromScore(score)}`,
  };
}

// ---------------------------------------------------------------------------
// Personalised guidance
// ---------------------------------------------------------------------------

/** WBGT thresholds for unacclimatised adults (ISO 7243 / OSHA guidance). */
function wbgtBand(wbgt: number): { label: string; text: string } {
  if (wbgt >= 32) {
    return {
      label: "Extreme heat stress",
      text: "At this WBGT the body cannot dissipate heat fast enough. Limit exertion to short, shaded breaks.",
    };
  }
  if (wbgt >= 30) {
    return {
      label: "High heat stress",
      text: "Sustained exertion in the sun is unsafe for you right now. Rest and cool down every 20-30 minutes.",
    };
  }
  if (wbgt >= 28) {
    return {
      label: "Moderate heat stress",
      text: "Manageable in shade, but plan shade and water deliberately rather than assuming you can push through.",
    };
  }
  if (wbgt >= 26) {
    return {
      label: "Elevated but tolerable",
      text: "Comfortable if you keep water within reach and take breaks in shade.",
    };
  }
  return {
    label: "Low heat stress",
    text: "Conditions are mild. Normal precautions are enough today.",
  };
}

export interface PersonalGuidance {
  band: string;
  bandText: string;
  /** Ordered, de-duplicated actions. Specific to this person, not the ward. */
  actions: string[];
  /** Clinical red flags for this person specifically. */
  redFlags: string[];
  coolingSitesNote: string | null;
}

export function personalGuidance(
  a: PersonalAssessment,
  level: RiskLevel
): PersonalGuidance {
  const { ward, band, work } = a;
  const wb = wbgtBand(ward.wbgt);
  const actions: string[] = [];
  const redFlags: string[] = [];

  actions.push(
    `${ward.ward_name} right now: ${ward.temperature} °C air, ${ward.humidity}% humidity, WBGT ${ward.wbgt} °C - ${wb.text.toLowerCase()}`
  );

  if (work.id === "outdoor") {
    const { cooling_centre_count, ward_name } = ward;
    actions.push(
      level === "EXTREME" || level === "HIGH"
        ? "Shift your outdoor hours to before 10:00 or after 16:30. The 11:00-16:00 block is the most dangerous part of the day."
        : "Plan your outdoor hours around early morning and late afternoon, and take a shaded break every 30 minutes."
    );
    actions.push(
      "Carry water with you rather than relying on a single break to drink - about 250 ml every 20 minutes of exertion."
    );
    if (cooling_centre_count > 0) {
      actions.push(
        `There ${cooling_centre_count === 1 ? "is 1 cooling centre" : `are ${cooling_centre_count} cooling centres`} in ${ward_name}. Use one if you feel overheated rather than pushing on.`
      );
    } else {
      actions.push(
        `${ward_name} has no cooling centre in the demo data, so plan shade and water before you leave home.`
      );
    }
  } else if (work.id === "mixed") {
    actions.push(
      "You move between cooled and hot spaces, so your body never adapts. Treat each outdoor leg as a separate exposure and cool down properly between them."
    );
    actions.push("Carry a bottle with you for the outdoor legs, including short commutes.");
  } else {
    actions.push(
      "You spend most of the day indoors: the main risk is a room that traps heat. Open windows early and again after sunset, and check the room temperature rather than assuming it is cool."
    );
    actions.push("Your commute and any time parked in a vehicle are your highest-exposure moments today - plan for them.");
  }

  // Age-specific physiology.
  if (band.id === "a70p" || band.id === "a60_70") {
    actions.push(
      "Stay in a cooled or shaded space during the peak hours. Do not rely on feeling thirsty as a signal to drink."
    );
    redFlags.push("Confusion, slurred speech or dizziness - call for help immediately, do not try to rest it out.");
    redFlags.push("Cool, clammy skin despite a high temperature - this can indicate heat stroke, not heat exhaustion.");
  } else if (band.id === "u18") {
    actions.push(
      "If you are supervising a child outdoors, set a water and shade break on a timer - children will not ask for it."
    );
    redFlags.push("A child who becomes quiet, drowsy or unusually irritable in the heat needs to be cooled immediately.");
  } else {
    redFlags.push("Headache, nausea, heavy sweating and weakness mean heat exhaustion: stop, cool, and drink. If symptoms worsen or persist past an hour, seek medical care.");
  }

  actions.push(...exposureModifierActions(a));

  return {
    band: wb.label,
    bandText: wb.text,
    actions: dedupe(actions),
    redFlags: dedupe(redFlags),
    coolingSitesNote:
      ward.cooling_centre_count > 0
        ? `${ward.cooling_centre_count} cooling centre(s) recorded in ${ward.ward_name}.`
        : `No cooling centre recorded in ${ward.ward_name}.`,
  };
}

function exposureModifierActions(a: PersonalAssessment): string[] {
  const out: string[] = [];
  const has = (needle: string) => a.modifiers.some((m) => m.label === needle);
  if (has("No reliable cooling at hand")) {
    out.push("Identify one cooled or shaded spot you can reach within five minutes, and use it as your reset point.");
  }
  if (has("Outdoor work without head cover")) {
    out.push("Add a wide-brim hat, cloth wrap or umbrella - covering the head measurably cuts radiant heat gain.");
  }
  if (has("Infrequent hydration")) {
    out.push("Set a repeating drink reminder. You will be behind on fluid before you feel thirsty.");
  }
  if (has("Heat-sensitive health condition or medication")) {
    out.push("If you are on medication that affects fluid balance or sweating, ask your prescriber how to adjust during a heatwave.");
  }
  return out;
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

// ---------------------------------------------------------------------------
// Optional local persistence (explicit opt-in, never coordinates)
// ---------------------------------------------------------------------------

const STORAGE_KEY = "heatshield.personal.v1";

export function saveProfile(p: PersonalProfile): void {
  try {
    const { ageBand: ab, workType: wt, wardId } = p;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ageBand: ab,
        workType: wt,
        wardId,
        cooledAccess: p.cooledAccess,
        headCover: p.headCover,
        hydrates: p.hydrates,
        healthSensitive: p.healthSensitive,
      })
    );
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). Non-fatal.
  }
}

export function loadProfile(): PersonalProfile | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersonalProfile>;
    if (!parsed.ageBand || !parsed.workType) return null;
    return {
      ...EMPTY_PROFILE,
      ...parsed,
      // A remembered ward is a manual choice, never a remembered coordinate.
      locationSource: null,
      distanceKm: null,
    };
  } catch {
    return null;
  }
}

export function clearProfile(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
