import type { Athlete, Session } from '../database.types';

export type IntensitySource = 'power' | 'hr' | 'pace' | 'rpe' | 'default';
export type ImpulseQuality = 'measured' | 'estimated';

export interface ImpulseRow {
  date: string;
  sport: string;
  impulse: number;
  intensitySource: IntensitySource;
  quality: ImpulseQuality;
}

export interface ImpulseThresholds {
  cpWatts: number;
  lt2Hr: number;
  maxHr: number;
  restingHr: number;
  thresholdSpeedKmh: number | null;
  hasActiveCpModel: boolean;
  hasActiveLt2Hr: boolean;
}

export const DEFAULT_RPE = 6;
export const IF_MIN = 0;
export const IF_MAX = 1.5;
export const FORMULA_VERSION = 1;

export const DEFAULT_TAU_FITNESS = 42;
export const DEFAULT_TAU_FATIGUE = 7;
export const TAU_FITNESS_MIN = 28;
export const TAU_FITNESS_MAX = 60;
export const TAU_FATIGUE_MIN = 4;
export const TAU_FATIGUE_MAX = 10;

export function clampIf(value: number): number {
  return Math.max(IF_MIN, Math.min(IF_MAX, value));
}

export function powerBasedIf(npWatts: number, cpWatts: number): { if: number; source: IntensitySource } {
  const cp = cpWatts > 0 ? cpWatts : 1;
  return { if: clampIf(npWatts / cp), source: 'power' };
}

export function hrBasedIf(avgHr: number, restingHr: number, lt2Hr: number): { if: number; source: IntensitySource } {
  const denom = lt2Hr - restingHr;
  const intensity = denom > 0 ? (avgHr - restingHr) / denom : 0;
  return { if: clampIf(intensity), source: 'hr' };
}

export function paceBasedIf(
  distanceKm: number,
  durationMin: number,
  thresholdSpeedKmh: number | null
): { if: number; source: IntensitySource } {
  if (!thresholdSpeedKmh || durationMin <= 0) return { if: 0, source: 'pace' };
  const speedKmh = distanceKm / (durationMin / 60);
  return { if: clampIf(speedKmh / thresholdSpeedKmh), source: 'pace' };
}

export function srpeBasedIf(rpe?: number | null): {
  if: number;
  source: IntensitySource;
  quality: ImpulseQuality;
} {
  const usedDefault = !(rpe && rpe > 0);
  const effectiveRpe = usedDefault ? DEFAULT_RPE : rpe;
  const intensity = 0.45 + 0.06 * effectiveRpe;
  return {
    if: clampIf(intensity),
    source: usedDefault ? 'default' : 'rpe',
    quality: usedDefault ? 'estimated' : 'measured',
  };
}

export function impulseFromIf(durationMin: number, intensityFactor: number): number {
  const hours = durationMin / 60;
  return hours * intensityFactor * intensityFactor * 100;
}

export interface CpModelOverride {
  cpWatts: number;
  confidence: 'high' | 'medium' | 'low';
}

export type ThresholdSource = 'passport' | 'profile' | 'fallback';

export interface ThresholdResolution {
  cpWatts: number;
  cpSource: ThresholdSource;
  lt2Hr: number;
  lt2HrSource: ThresholdSource;
  thresholdSpeedKmh: number | null;
  thresholdSpeedSource: ThresholdSource;
}

export interface ThresholdOverrides {
  /** Active passport values, when the Hub passport is connected */
  passport?: { lt2Hr: number | null; thresholdSpeedKmh: number | null } | null;
  cpModel?: CpModelOverride;
}

export function resolveThresholds(
  athlete: Athlete,
  overrides?: ThresholdOverrides
): ImpulseThresholds & { resolution: ThresholdResolution } {
  const passport = overrides?.passport ?? null;
  const cpModel = overrides?.cpModel;

  // CP: modelled (high/medium confidence) > profile
  const profileCp = athlete.cp_watts || athlete.ftp_watts || 0;
  const modelUsable =
    cpModel && cpModel.cpWatts > 0 && (cpModel.confidence === 'high' || cpModel.confidence === 'medium');
  const cpWatts = modelUsable ? cpModel!.cpWatts : profileCp;
  const cpSource: ThresholdSource = modelUsable ? 'passport' : 'profile';

  // LT2 HR: passport > profile column > 0.9 x max HR
  const passportLt2 = passport?.lt2Hr ?? null;
  const profileLt2 = athlete.hr_lt2_bpm ?? null;
  let lt2Hr: number;
  let lt2HrSource: ThresholdSource;
  if (passportLt2 && passportLt2 > 0) {
    lt2Hr = passportLt2;
    lt2HrSource = 'passport';
  } else if (profileLt2 && profileLt2 > 0) {
    lt2Hr = profileLt2;
    lt2HrSource = 'profile';
  } else {
    lt2Hr = athlete.max_hr ? Math.round(0.9 * athlete.max_hr) : 170;
    lt2HrSource = 'fallback';
  }

  // Threshold speed: passport > profile column > null (HR fallback)
  const passportSpeed = passport?.thresholdSpeedKmh ?? null;
  const profileSpeed = athlete.threshold_speed_kmh ?? null;
  let thresholdSpeedKmh: number | null = null;
  let thresholdSpeedSource: ThresholdSource = 'fallback';
  if (passportSpeed && passportSpeed > 0) {
    thresholdSpeedKmh = passportSpeed;
    thresholdSpeedSource = 'passport';
  } else if (profileSpeed && profileSpeed > 0) {
    thresholdSpeedKmh = profileSpeed;
    thresholdSpeedSource = 'profile';
  }

  return {
    cpWatts,
    lt2Hr,
    maxHr: athlete.max_hr || 185,
    restingHr: athlete.resting_hr ?? 60,
    thresholdSpeedKmh,
    hasActiveCpModel: !!modelUsable,
    hasActiveLt2Hr: lt2HrSource !== 'fallback',
    resolution: { cpWatts, cpSource, lt2Hr, lt2HrSource, thresholdSpeedKmh, thresholdSpeedSource },
  };
}

export function computeSessionImpulse(
  session: Session,
  thresholds: ImpulseThresholds
): ImpulseRow {  const base: ImpulseRow = {
    date: session.session_date,
    sport: session.session_type,
    impulse: 0,
    intensitySource: 'default',
    quality: 'estimated',
  };

  if (session.duration_min <= 0) return base;

  const np = session.normalized_power_watts ?? session.avg_power_watts ?? null;
  const isEnduranceType =
    session.session_type === 'endurance' || session.session_type === 'cycling';

  if (isEnduranceType && np !== null && thresholds.cpWatts > 0) {
    const { if: intensity } = powerBasedIf(np, thresholds.cpWatts);
    return {
      ...base,
      impulse: impulseFromIf(session.duration_min, intensity),
      intensitySource: 'power',
      quality: 'measured',
    };
  }

  if (
    session.session_type === 'running' &&
    session.distance_km !== null &&
    session.distance_km > 0 &&
    thresholds.thresholdSpeedKmh
  ) {
    const { if: intensity } = paceBasedIf(
      session.distance_km,
      session.duration_min,
      thresholds.thresholdSpeedKmh
    );
    return {
      ...base,
      impulse: impulseFromIf(session.duration_min, intensity),
      intensitySource: 'pace',
      quality: 'measured',
    };
  }

  const isAerobicType = isEnduranceType || session.session_type === 'running';
  if (
    isAerobicType &&
    session.avg_hr !== null &&
    session.avg_hr > thresholds.restingHr
  ) {
    const { if: intensity } = hrBasedIf(
      session.avg_hr,
      thresholds.restingHr,
      thresholds.lt2Hr
    );
    return {
      ...base,
      impulse: impulseFromIf(session.duration_min, intensity),
      intensitySource: 'hr',
      quality: 'measured',
    };
  }

  const { if: intensity, source, quality } = srpeBasedIf(session.rpe);
  return {
    ...base,
    impulse: impulseFromIf(session.duration_min, intensity),
    intensitySource: source,
    quality,
  };
}

export function computeSessionImpulseFor(
  sessionLike: Partial<Session>,
  athlete: Athlete
): ImpulseRow {
  const thresholds = resolveThresholds(athlete);
  const session: Session = {
    id: '',
    athlete_id: athlete.id,
    session_date: sessionLike.session_date ?? new Date().toISOString().split('T')[0],
    session_type: sessionLike.session_type ?? 'endurance',
    duration_min: sessionLike.duration_min ?? 0,
    distance_km: sessionLike.distance_km ?? null,
    avg_hr: sessionLike.avg_hr ?? null,
    max_hr: sessionLike.max_hr ?? null,
    avg_power_watts: sessionLike.avg_power_watts ?? null,
    normalized_power_watts: sessionLike.normalized_power_watts ?? null,
    rpe: sessionLike.rpe ?? null,
    impulse: 0,
    notes: null,
    temperature_c: null,
    humidity_pct: null,
    altitude_m_env: null,
    training_intention: null,
    zone_distribution: null,
    raw_data: null,
    strength_exercises: null,
    sub_sport: null,
    sport_specific_data: null,
    created_at: '',
  } as unknown as Session;
  return computeSessionImpulse(session, thresholds);
}

export function computeDailyImpulseRows(
  sessions: Session[],
  athlete: Athlete
): ImpulseRow[] {
  const thresholds = resolveThresholds(athlete);
  return sessions.map(s => computeSessionImpulse(s, thresholds));
}

/**
 * Date-aware thresholds: for each session date pick the threshold-history
 * row with the latest effective_from <= date; fall back to the current
 * profile (quality 'estimated') when no row covers that date.
 * historyRows: rows sorted by effective_from ascending, loaded once per
 * recompute to avoid per-session queries.
 */
export interface ThresholdHistoryEntry {
  effective_from: string;
  cp_watts: number | null;
  hr_lt2_bpm: number | null;
  threshold_speed_kmh: number | null;
  source: string;
  rowId: string;
}

export function thresholdsForDate(
  athlete: Athlete,
  date: string,
  historyRows: ThresholdHistoryEntry[]
): { thresholds: ImpulseThresholds; quality: ImpulseQuality; rowId: string | null } {
  let matched: ThresholdHistoryEntry | null = null;
  for (const row of historyRows) {
    if (row.effective_from <= date) matched = row;
    else break;
  }

  const fallback = resolveThresholds(athlete);
  if (!matched) {
    return { thresholds: fallback, quality: 'estimated', rowId: null };
  }

  const fromRow: ImpulseThresholds = {
    cpWatts: matched.cp_watts ?? fallback.cpWatts,
    lt2Hr: matched.hr_lt2_bpm ?? fallback.lt2Hr,
    maxHr: athlete.max_hr || 185,
    restingHr: athlete.resting_hr ?? 60,
    thresholdSpeedKmh: matched.threshold_speed_kmh ?? fallback.thresholdSpeedKmh,
    hasActiveCpModel: fallback.hasActiveCpModel,
    hasActiveLt2Hr: matched.hr_lt2_bpm !== null || fallback.hasActiveLt2Hr,
  };
  return { thresholds: fromRow, quality: 'measured', rowId: matched.rowId };
}

/**
 * Compute impulse rows per session using date-aware thresholds from the
 * history table (rows sorted ascending by effective_from).
 */
export function computeSessionImpulseRowsWithHistory(
  athlete: Athlete,
  sessions: Session[],
  historyRows: ThresholdHistoryEntry[]
): ImpulseRow[] {
  const sorted = [...historyRows].sort((a, b) => a.effective_from.localeCompare(b.effective_from));
  return sessions.map(session => {
    const { thresholds, quality } = thresholdsForDate(athlete, session.session_date, sorted);
    const row = computeSessionImpulse(session, thresholds);
    // Session-level quality reflects threshold provenance; source-level
    // quality (measured power/HR vs estimated sRPE) is kept from the row.
    return row;
  });
}

export interface DailyTotal {
  date: string;
  totalImpulse: number;
  enduranceImpulse: number;
  strengthImpulse: number;
  rows: ImpulseRow[];
}

export function groupByDay(rows: ImpulseRow[]): Map<string, DailyTotal> {
  const map = new Map<string, DailyTotal>();
  for (const row of rows) {
    let entry = map.get(row.date);
    if (!entry) {
      entry = { date: row.date, totalImpulse: 0, enduranceImpulse: 0, strengthImpulse: 0, rows: [] };
      map.set(row.date, entry);
    }
    entry.totalImpulse += row.impulse;
    if (row.sport === 'strength') entry.strengthImpulse += row.impulse;
    else entry.enduranceImpulse += row.impulse;
    entry.rows.push(row);
  }
  return map;
}

export function effectiveDailyImpulse(
  day: DailyTotal,
  includeStrength: boolean
): number {
  return includeStrength ? day.totalImpulse : day.enduranceImpulse;
}

export interface AthleteTauRefs {
  tau_fitness?: number | null;
  tau_fatigue?: number | null;
}

export function athleteTau(athlete: AthleteTauRefs): { tauFitness: number; tauFatigue: number } {
  return {
    tauFitness: clampTau(athlete.tau_fitness ?? DEFAULT_TAU_FITNESS, TAU_FITNESS_MIN, TAU_FITNESS_MAX),
    tauFatigue: clampTau(athlete.tau_fatigue ?? DEFAULT_TAU_FATIGUE, TAU_FATIGUE_MIN, TAU_FATIGUE_MAX),
  };
}

function clampTau(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
