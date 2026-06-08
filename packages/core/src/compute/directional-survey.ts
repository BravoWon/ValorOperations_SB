/**
 * Minimum-curvature directional-survey engine — the foundational survey
 * primitive: station-by-station position propagation (TVD / north / east /
 * vertical-section / closure / dogleg-severity) plus interpolation at an
 * arbitrary measured depth.
 *
 * Pure and deterministic (no Date.now / Math.random); returns `warnings: string[]`
 * rather than throwing, matching the rest of @valor/core. Geometry is
 * unit-agnostic: MD/TVD/N/E are all in one length unit (ft or m) and angles are
 * in degrees — the panel layer handles imperial⇄metric display. Dogleg, build,
 * and turn rates are normalized per `courseLength` (default 100 ft / use 30 for m).
 *
 * Tie-in: an implicit surface origin (MD 0, inc 0, azi 0) anchors the first
 * segment, so a survey that starts below surface is tied vertically to surface
 * (inc 0 means the origin's azimuth never enters the math).
 */

export interface SurveyStation {
  md: number; // measured depth (length units)
  inc: number; // inclination (degrees, 0 = vertical)
  azi: number; // azimuth (degrees, 0–360, 0 = north)
}

export interface SurveyOptions {
  /** Vertical-section reference azimuth (deg). Defaults to the final closure azimuth. */
  vsAzimuth?: number;
  /** Normalization length for dls/build/turn rates. Default 100 (ft); use 30 for metres. */
  courseLength?: number;
}

export interface StationResult extends SurveyStation {
  tvd: number;
  north: number;
  east: number;
  dls: number; // dogleg severity, deg per courseLength
  buildRate: number; // Δinc, deg per courseLength
  turnRate: number; // Δazi, deg per courseLength (signed, shortest way)
  closure: number; // horizontal displacement from origin
  closureAzimuth: number; // deg, 0–360
  vs: number; // vertical section along vsAzimuth
}

export interface SurveySummary {
  vsAzimuth: number;
  courseLength: number;
  totalMd: number;
  totalTvd: number;
  closure: number;
  closureAzimuth: number;
  vs: number;
  maxDls: number;
}

export interface SurveyComputation {
  stations: StationResult[];
  summary: SurveySummary;
  warnings: string[];
}

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
const norm360 = (deg: number): number => ((deg % 360) + 360) % 360;
/** Shortest signed difference b−a wrapped to (−180, 180]. */
const angleDelta = (a: number, b: number): number => {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
};

/** Minimum-curvature ratio factor for a dogleg of `beta` radians. */
function ratioFactor(beta: number): number {
  if (beta < 1e-9) return 1; // straight segment → limit of (2/β)tan(β/2) is 1
  return (2 / beta) * Math.tan(beta / 2);
}

interface Step {
  dTvd: number;
  dNorth: number;
  dEast: number;
  doglegDeg: number;
}

/** One minimum-curvature step between two stations (angles in degrees). */
function step(a: SurveyStation, b: SurveyStation): Step {
  const i1 = a.inc * RAD;
  const i2 = b.inc * RAD;
  const da = (b.azi - a.azi) * RAD;
  const dMd = b.md - a.md;

  const cosBeta = clamp(Math.cos(i2 - i1) - Math.sin(i1) * Math.sin(i2) * (1 - Math.cos(da)), -1, 1);
  const beta = Math.acos(cosBeta);
  const rf = ratioFactor(beta);
  const half = dMd / 2;

  return {
    dTvd: half * (Math.cos(i1) + Math.cos(i2)) * rf,
    dNorth: half * (Math.sin(i1) * Math.cos(a.azi * RAD) + Math.sin(i2) * Math.cos(b.azi * RAD)) * rf,
    dEast: half * (Math.sin(i1) * Math.sin(a.azi * RAD) + Math.sin(i2) * Math.sin(b.azi * RAD)) * rf,
    doglegDeg: beta * DEG,
  };
}

/**
 * Propagate a station list through the minimum-curvature method. Stations are
 * sorted by MD (a warning is emitted if reordering was needed). Returns a result
 * per input station plus a trajectory summary.
 */
export function computeSurvey(input: SurveyStation[], opts: SurveyOptions = {}): SurveyComputation {
  const warnings: string[] = [];
  const courseLength = opts.courseLength && opts.courseLength > 0 ? opts.courseLength : 100;

  // Normalize: drop non-finite rows, normalize azimuth, sort by MD.
  const cleaned = input
    .filter((s) => Number.isFinite(s.md) && Number.isFinite(s.inc) && Number.isFinite(s.azi))
    .map((s) => ({ md: s.md, inc: s.inc, azi: norm360(s.azi) }));
  if (cleaned.length !== input.length) warnings.push('Some survey rows were dropped (non-numeric values).');

  const sorted = [...cleaned].sort((a, b) => a.md - b.md);
  if (sorted.some((s, i) => i > 0 && s.md === sorted[i - 1]!.md)) {
    warnings.push('Two stations share the same measured depth.');
  }
  if (cleaned.some((s, i) => i > 0 && s.md < cleaned[i - 1]!.md)) {
    warnings.push('Stations were reordered to increasing measured depth.');
  }
  if (sorted.some((s) => s.inc < 0 || s.inc > 180)) {
    warnings.push('An inclination is outside the expected 0–180° range.');
  }

  // Propagate from an implicit surface tie-in (0/0/0).
  let prev: SurveyStation = { md: 0, inc: 0, azi: 0 };
  let tvd = 0;
  let north = 0;
  let east = 0;
  const positions = sorted.map((s) => {
    const seg = step(prev, s);
    tvd += seg.dTvd;
    north += seg.dNorth;
    east += seg.dEast;
    const dMd = s.md - prev.md;
    const per = dMd > 0 ? courseLength / dMd : 0;
    const closure = Math.hypot(north, east);
    const result = {
      ...s,
      tvd,
      north,
      east,
      dls: seg.doglegDeg * per,
      buildRate: (s.inc - prev.inc) * per,
      turnRate: angleDelta(prev.azi, s.azi) * per,
      closure,
      closureAzimuth: closure < 1e-9 ? 0 : norm360(Math.atan2(east, north) * DEG),
      vs: 0, // filled below once the VS azimuth is known
    };
    prev = s;
    return result;
  });

  // VS azimuth defaults to the final closure azimuth (VS = closure at TD).
  const last = positions[positions.length - 1];
  const vsAzimuth =
    opts.vsAzimuth !== undefined && Number.isFinite(opts.vsAzimuth)
      ? norm360(opts.vsAzimuth)
      : (last?.closureAzimuth ?? 0);
  for (const p of positions) {
    p.vs = p.closure * Math.cos((p.closureAzimuth - vsAzimuth) * RAD);
  }

  if (positions.length < 1) warnings.push('At least one survey station is required.');
  const maxDls = positions.reduce((m, p) => Math.max(m, p.dls), 0);
  if (maxDls > 10) warnings.push(`High dogleg severity (${maxDls.toFixed(1)}°/${courseLength}).`);

  const summary: SurveySummary = {
    vsAzimuth,
    courseLength,
    totalMd: last?.md ?? 0,
    totalTvd: last?.tvd ?? 0,
    closure: last?.closure ?? 0,
    closureAzimuth: last?.closureAzimuth ?? 0,
    vs: last?.vs ?? 0,
    maxDls,
  };

  return { stations: positions, summary, warnings };
}

/**
 * Position at an arbitrary measured depth. Inclination/azimuth are linearly
 * interpolated between the bracketing stations, then a minimum-curvature step is
 * taken from the lower station's computed position. Returns null if `md` is
 * outside the surveyed range or fewer than one station exists.
 */
export function interpolateAtMd(
  input: SurveyStation[],
  md: number,
  opts: SurveyOptions = {},
): StationResult | null {
  if (!Number.isFinite(md)) return null;
  const computed = computeSurvey(input, opts);
  const stations = computed.stations;
  if (stations.length === 0) return null;

  // Exact hit.
  const exact = stations.find((s) => s.md === md);
  if (exact) return exact;

  if (md < (stations[0]?.md ?? 0)) {
    // Between the implicit surface tie-in and the first station.
    if (md < 0) return null;
    return interpolateSegment({ md: 0, inc: 0, azi: 0 }, stations[0]!, stations[0]!, md, opts, 0, 0, 0);
  }

  for (let i = 0; i < stations.length - 1; i++) {
    const lo = stations[i]!;
    const hi = stations[i + 1]!;
    if (md > lo.md && md < hi.md) {
      return interpolateSegment(lo, hi, lo, md, opts, lo.tvd, lo.north, lo.east);
    }
  }
  return null; // beyond the deepest station
}

function interpolateSegment(
  lo: SurveyStation,
  hi: SurveyStation,
  base: StationResult | SurveyStation,
  md: number,
  opts: SurveyOptions,
  baseTvd: number,
  baseNorth: number,
  baseEast: number,
): StationResult {
  const courseLength = opts.courseLength && opts.courseLength > 0 ? opts.courseLength : 100;
  const t = (md - lo.md) / (hi.md - lo.md);
  const inc = lo.inc + (hi.inc - lo.inc) * t;
  const azi = norm360(lo.azi + angleDelta(lo.azi, hi.azi) * t);
  const target: SurveyStation = { md, inc, azi };
  const seg = step({ md: lo.md, inc: lo.inc, azi: lo.azi }, target);
  const tvd = baseTvd + seg.dTvd;
  const north = baseNorth + seg.dNorth;
  const east = baseEast + seg.dEast;
  const dMd = md - lo.md;
  const per = dMd > 0 ? courseLength / dMd : 0;
  const closure = Math.hypot(north, east);
  const closureAzimuth = closure < 1e-9 ? 0 : norm360(Math.atan2(east, north) * DEG);
  const vsAzimuth = opts.vsAzimuth !== undefined && Number.isFinite(opts.vsAzimuth) ? norm360(opts.vsAzimuth) : closureAzimuth;
  return {
    md,
    inc,
    azi,
    tvd,
    north,
    east,
    dls: seg.doglegDeg * per,
    buildRate: (inc - lo.inc) * per,
    turnRate: angleDelta(lo.azi, azi) * per,
    closure,
    closureAzimuth,
    vs: closure * Math.cos((closureAzimuth - vsAzimuth) * RAD),
  };
}

// --- Registry: drives the panel (mirrors the field_defs / hydraulics pattern) ---

export interface SurveyColumnSpec {
  key: keyof SurveyStation;
  label: string;
  unit: string;
  unitQuantity?: 'length';
  min: number;
  max: number;
  decimals: number;
}

export const SURVEY_INPUT_COLUMNS: SurveyColumnSpec[] = [
  { key: 'md', label: 'MD', unit: 'ft', unitQuantity: 'length', min: 0, max: 50000, decimals: 1 },
  { key: 'inc', label: 'Inc', unit: '°', min: 0, max: 180, decimals: 2 },
  { key: 'azi', label: 'Azi', unit: '°', min: 0, max: 360, decimals: 2 },
];

export interface SurveyOutputColumnSpec {
  key: keyof Omit<StationResult, keyof SurveyStation>;
  label: string;
  unit: string;
  unitQuantity?: 'length';
  decimals: number;
}

export const SURVEY_OUTPUT_COLUMNS: SurveyOutputColumnSpec[] = [
  { key: 'tvd', label: 'TVD', unit: 'ft', unitQuantity: 'length', decimals: 1 },
  { key: 'north', label: 'N/S', unit: 'ft', unitQuantity: 'length', decimals: 1 },
  { key: 'east', label: 'E/W', unit: 'ft', unitQuantity: 'length', decimals: 1 },
  { key: 'vs', label: 'VS', unit: 'ft', unitQuantity: 'length', decimals: 1 },
  { key: 'closure', label: 'Closure', unit: 'ft', unitQuantity: 'length', decimals: 1 },
  { key: 'closureAzimuth', label: 'Closure azi', unit: '°', decimals: 1 },
  { key: 'dls', label: 'DLS', unit: '°/100', decimals: 2 },
];

/** A short demo survey (a vertical-then-build curve) for the panel seed. */
export const DEFAULT_SURVEY: SurveyStation[] = [
  { md: 0, inc: 0, azi: 0 },
  { md: 2000, inc: 0, azi: 0 },
  { md: 2500, inc: 15, azi: 90 },
  { md: 3000, inc: 35, azi: 90 },
  { md: 3500, inc: 60, azi: 92 },
  { md: 4000, inc: 88, azi: 93 },
  { md: 5000, inc: 90, azi: 93 },
];
