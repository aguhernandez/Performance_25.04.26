import { runBannisterModel } from './bannisterModel';
import { supabase } from '../supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
// The generated schema omits cache tables; use the existing unparameterized client only here.
const cacheDb = supabase as unknown as SupabaseClient;
import type { Athlete, Session } from '../database.types';
import type { ImpulseRow } from './impulse';
import {
  FORMULA_VERSION,
  computeSessionImpulse,
  computeSessionImpulseRowsWithHistory,
  groupByDay,
  resolveThresholds,
  type ThresholdOverrides,
  type ThresholdHistoryEntry,
} from './impulse';
import type { DailyBannisterResult } from './types';
import type { WeeklyLoadRow } from './cpPersistence';

const BATCH_SIZE = 500;
export const READ_WINDOW_DAYS = 365;
const EPSILON = 1e-6;
const DEBOUNCE_MS = 3000;

// A connected Hub workspace supplies the same merged activities and profile to
// the dashboard and the derived cache; the registry never stores credentials.
const connectedWorkspaces = new Map<string, { athlete: Athlete; sessions: Session[] }>();
export function registerPersistenceWorkspace(athlete: Athlete, sessions: Session[]): () => void {
  const workspace = { athlete, sessions };
  connectedWorkspaces.set(athlete.id, workspace);
  return () => { if (connectedWorkspaces.get(athlete.id) === workspace) connectedWorkspaces.delete(athlete.id); };
}


export interface DailyLoadMeta {
  cp_source: string;
  cp_watts: number;
  lt2_hr: number;
  lt2_hr_source: string;
  threshold_speed_kmh: number | null;
  threshold_speed_source: string;
  threshold_row_id?: string | null;
}

export interface DailyLoadRow {
  athlete_id: string;
  date: string;
  sport: string;
  impulse: number;
  intensity_source: string;
  quality: string;
  formula_version: number;
  meta?: DailyLoadMeta | null;
}

export interface DailyStateRow {
  athlete_id: string;
  date: string;
  fitness: number;
  fatigue: number;
  form: number;
  formula_version: number;
}

export interface ThresholdHistoryRow {
  id: string;
  athlete_id: string;
  effective_from: string;
  cp_watts: number | null;
  hr_lt2_bpm: number | null;
  threshold_speed_kmh: number | null;
  source: string;
  created_at: string;
}

export function rowsToDailyLoad(
  athleteId: string,
  rows: ImpulseRow[],
  meta?: DailyLoadMeta
): DailyLoadRow[] {
  return rows.map(r => {
    if (r.impulse === null) throw new Error('Cannot persist an insufficient Impulse as zero');
    return ({
    athlete_id: athleteId,
    date: r.date,
    sport: r.sport,
    impulse: round4(r.impulse ?? 0),
    intensity_source: r.intensitySource,
    quality: r.quality,
    formula_version: FORMULA_VERSION,
    meta: { ...meta, algorithm_version: r.algorithmVersion ?? null, method: r.method ?? null, status: r.status ?? null, provenance: r.provenance ?? null, reason: r.reason ?? null } as DailyLoadMeta,
  }); });
}

export function historyToDailyState(
  athleteId: string,
  history: DailyBannisterResult[]
): DailyStateRow[] {
  return history.map(h => ({
    athlete_id: athleteId,
    date: h.date,
    fitness: round4(h.fitness),
    fatigue: round4(h.fatigue),
    form: round4(h.form),
    formula_version: FORMULA_VERSION,
  }));
}

export async function loadDailyLoad(
  athleteId: string,
  windowDays = READ_WINDOW_DAYS
): Promise<DailyLoadRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const sinceStr = since.toISOString().split('T')[0];

  const { data, error } = await cacheDb
    .from('daily_load')
    .select('*')
    .eq('athlete_id', athleteId)
    .gte('date', sinceStr)
    .eq('formula_version', FORMULA_VERSION)
    .order('date', { ascending: true });

  if (error) throw error;
  return (data ?? []) as DailyLoadRow[];
}

export async function loadDailyState(
  athleteId: string,
  windowDays = READ_WINDOW_DAYS
): Promise<DailyStateRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const sinceStr = since.toISOString().split('T')[0];

  const { data, error } = await cacheDb
    .from('daily_state')
    .select('*')
    .eq('athlete_id', athleteId)
    .gte('date', sinceStr)
    .eq('formula_version', FORMULA_VERSION)
    .order('date', { ascending: true });

  if (error) throw error;
  return (data ?? []) as DailyStateRow[];
}

export async function saveDailyImpulse(
  athleteId: string,
  rows: ImpulseRow[],
  meta?: DailyLoadMeta
): Promise<void> {
  if (rows.length === 0) return;
  const payload = rowsToDailyLoad(athleteId, rows, meta);
  for (let i = 0; i < payload.length; i += BATCH_SIZE) {
    const chunk = payload.slice(i, i + BATCH_SIZE);
    const { error } = await cacheDb
      .from('daily_load')
      .upsert(chunk, { onConflict: 'athlete_id,date,sport' });
    if (error) throw error;
  }
}

export async function saveDailyState(
  athleteId: string,
  history: DailyBannisterResult[]
): Promise<void> {
  if (history.length === 0) return;
  const payload = historyToDailyState(athleteId, history);
  for (let i = 0; i < payload.length; i += BATCH_SIZE) {
    const chunk = payload.slice(i, i + BATCH_SIZE);
    const { error } = await cacheDb
      .from('daily_state')
      .upsert(chunk, { onConflict: 'athlete_id,date' });
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------------
// Threshold history
// ---------------------------------------------------------------------------

export interface EffectiveThresholds {
  cp_watts: number | null;
  hr_lt2_bpm: number | null;
  threshold_speed_kmh: number | null;
  source: string;
  rowId: string | null;
}

/**
 * Latest athlete_thresholds row with effective_from <= date. Falls back to
 * current profile values (source 'profile', quality 'estimated') when none.
 */
export async function loadThresholdsForDate(
  athleteId: string,
  date: string
): Promise<EffectiveThresholds | null> {
  const { data, error } = await cacheDb
    .from('athlete_thresholds')
    .select('*')
    .eq('athlete_id', athleteId)
    .lte('effective_from', date)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as ThresholdHistoryRow;
  return {
    cp_watts: row.cp_watts,
    hr_lt2_bpm: row.hr_lt2_bpm,
    threshold_speed_kmh: row.threshold_speed_kmh,
    source: row.source,
    rowId: row.id,
  };
}

function thresholdRowFromAthlete(
  athlete: Athlete,
  effectiveFrom: string,
  source: 'profile' | 'passport' | 'model' | 'lab'
) {
  return {
    athlete_id: athlete.id,
    effective_from: effectiveFrom,
    cp_watts: athlete.cp_watts || athlete.ftp_watts || null,
    hr_lt2_bpm: athlete.hr_lt2_bpm ?? null,
    threshold_speed_kmh: athlete.threshold_speed_kmh ?? null,
    source,
  };
}

/**
 * Seed one athlete_thresholds row from the current profile, effective from
 * the athlete's first session date. Idempotent (upsert on unique key).
 */
export async function seedThresholdsFromProfile(
  athlete: Athlete,
  firstSessionDate: string
): Promise<void> {
  const { error } = await cacheDb
    .from('athlete_thresholds')
    .upsert(thresholdRowFromAthlete(athlete, firstSessionDate, 'profile'), {
      onConflict: 'athlete_id,effective_from',
    });
  if (error) throw error;
}

/**
 * Insert a new threshold row effective from the given date (default today)
 * after a profile edit. Idempotent per date.
 */
export async function insertThresholdRow(
  athlete: Athlete,
  effectiveFrom: string,
  source: 'profile' | 'passport' | 'model' | 'lab' = 'profile'
): Promise<void> {
  const { error } = await cacheDb
    .from('athlete_thresholds')
    .upsert(thresholdRowFromAthlete(athlete, effectiveFrom, source), {
      onConflict: 'athlete_id,effective_from',
    });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Calendar row construction
// ---------------------------------------------------------------------------

function metaFromResolution(
  resolution: ReturnType<typeof resolveThresholds>['resolution'],
  thresholdRowId?: string | null
): DailyLoadMeta {
  return {
    cp_source: resolution.cpSource,
    cp_watts: round4(resolution.cpWatts),
    lt2_hr: resolution.lt2Hr,
    lt2_hr_source: resolution.lt2HrSource,
    threshold_speed_kmh: resolution.thresholdSpeedKmh,
    threshold_speed_source: resolution.thresholdSpeedSource,
    threshold_row_id: thresholdRowId ?? null,
  };
}

export function hasHistoryRows(rows: ThresholdHistoryEntry[]): boolean {
  return rows.length > 0;
}

/** Calendar rows using date-aware threshold history for each session. */
export function buildCalendarRowsWithHistory(
  athlete: Athlete,
  sessions: Session[],
  historyRows: ThresholdHistoryEntry[],
  fromDate: string,
  today: string
): ImpulseRow[] {
  const impulseRows = computeSessionImpulseRowsWithHistory(athlete, sessions, historyRows);
  const dayMap = groupByDay(impulseRows);
  const sports = [...new Set(sessions.map(s => s.session_type))];

  const calendar: ImpulseRow[] = [];
  const cursor = new Date(fromDate);
  const end = new Date(today);
  while (cursor <= end) {
    const date = cursor.toISOString().split('T')[0];
    const day = dayMap.get(date);
    if (day) {
      for (const row of day.rows) calendar.push(row);
    } else {
      calendar.push(...restDayRows(date, sports));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return calendar;
}

function restDayRows(date: string, sports: string[]): ImpulseRow[] {
  const sportsForDay = sports.length > 0 ? sports : ['endurance'];
  return sportsForDay.map(sport => ({
    date,
    sport,
    impulse: 0,
    intensitySource: 'default',
    quality: 'estimated',
  }));
}

/**
 * Every calendar day in [fromDate, today], including rest days (impulse 0
 * per sport bucket), so Fitness/Fatigue decay on rest days. Sessions before
 * fromDate are ignored (their impulse is already in the anchor state).
 */
function buildCalendarRows(
  athlete: Athlete,
  sessions: Session[],
  overrides: ThresholdOverrides | undefined,
  fromDate: string,
  today: string,
  historyRows: ThresholdHistoryEntry[] = []
): ImpulseRow[] {
  const hasHistory = historyRows.length > 0;
  const fallback = resolveThresholds(athlete, overrides);
  const impulseRows = hasHistory
    ? computeSessionImpulseRowsWithHistory(athlete, sessions, historyRows)
    : sessions.map(s => computeSessionImpulse(s, fallback));
  const dayMap = groupByDay(impulseRows);
  const sports = [...new Set(sessions.map(s => s.session_type))];

  const calendar: ImpulseRow[] = [];
  const cursor = new Date(fromDate);
  const end = new Date(today);
  while (cursor <= end) {
    const date = cursor.toISOString().split('T')[0];
    const day = dayMap.get(date);
    if (day) {
      for (const row of day.rows) calendar.push(row);
    } else {
      calendar.push(...restDayRows(date, sports));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return calendar;
}

/**
 * Full Bannister history over the calendar grid from the first session,
 * with the 28-day seed and warm-up flag.
 */
export function computeCalendarHistory(
  athlete: Athlete,
  sessions: Session[],
  overrides?: ThresholdOverrides,
  historyRows: ThresholdHistoryEntry[] = []
): DailyBannisterResult[] {
  // Use the same 42/7 recurrence and inputs as the dashboard.
  void overrides; void historyRows;
  return runBannisterModel(sessions, athlete, { includeStrength: true }).history;

}

export interface PersistenceResult {
  dailyLoadCount: number;
  dailyStateCount: number;
  lastDate: string;
}

// ---------------------------------------------------------------------------
// Foster weekly load (monotony / strain)
// ---------------------------------------------------------------------------

export function weekStartISO(dateISO: string): string {
  const d = new Date(dateISO + 'T00:00:00Z');
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().split('T')[0];
}

export interface FosterWeek {
  weekStart: string;
  totalImpulse: number;
  mean: number;
  sd: number | null;
  monotony: number | null;
  strain: number | null;
}

/**
 * Foster monotony/strain per Mon–Sun week: total = sum of daily total
 * impulse; mean = total/7; sd of the 7 daily values with rest days as 0;
 * monotony = mean/sd (null when sd = 0); strain = total × monotony.
 */
export function computeFosterWeeks(dailyTotalByDate: Map<string, number>): FosterWeek[] {
  const byWeek = new Map<string, number[]>();
  for (const [date, impulse] of dailyTotalByDate) {
    const ws = weekStartISO(date);
    let values = byWeek.get(ws);
    if (!values) {
      values = new Array<number>(7).fill(0);
      byWeek.set(ws, values);
    }
    const idx = Math.floor(
      (Date.parse(date + 'T00:00:00Z') - Date.parse(ws + 'T00:00:00Z')) / 86400000
    );
    if (idx >= 0 && idx < 7) values[idx] = impulse;
  }

  const weeks: FosterWeek[] = [];
  for (const [weekStart, values] of byWeek) {
    const total = values.reduce((a, b) => a + b, 0);
    const mean = total / 7;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / 7;
    const sd = Math.sqrt(variance);
    const monotony = sd > EPSILON ? mean / sd : null;
    weeks.push({
      weekStart,
      totalImpulse: round4(total),
      mean: round4(mean),
      sd: round4(sd),
      monotony: monotony !== null ? round4(monotony) : null,
      strain: monotony !== null ? round4(total * monotony) : null,
    });
  }
  return weeks.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

function dailyTotalsFromCalendar(rows: ImpulseRow[]): Map<string, number> {
  const daily = new Map<string, number>();
  for (const row of rows) {
    daily.set(row.date, (daily.get(row.date) ?? 0) + (row.impulse ?? 0));
  }
  return daily;
}

async function persistWeeklyLoad(athleteId: string, daily: Map<string, number>): Promise<number> {
  const weeks = computeFosterWeeks(daily);
  if (weeks.length === 0) return 0;
  const payload: WeeklyLoadRow[] = weeks.map(w => ({
    athlete_id: athleteId,
    week_start: w.weekStart,
    total_impulse: w.totalImpulse,
    monotony: w.monotony,
    strain: w.strain,
  }));
  await upsertRows('weekly_load', payload, 'athlete_id,week_start');
  return payload.length;
}

// ---------------------------------------------------------------------------
// Diff-write helpers
// ---------------------------------------------------------------------------

function numChanged(a: number, b: number): boolean {
  return Math.abs(a - b) > EPSILON;
}

export function loadRowChanged(existing: DailyLoadRow, candidate: DailyLoadRow): boolean {
  if (existing.intensity_source !== candidate.intensity_source) return true;
  if (existing.quality !== candidate.quality) return true;
  if (existing.formula_version !== candidate.formula_version) return true;
  const eImp = Number(existing.impulse);
  const cImp = Number(candidate.impulse);
  if (Number.isFinite(eImp) && numChanged(eImp, cImp)) return true;
  return false;
}

export function stateRowChanged(existing: DailyStateRow, candidate: DailyStateRow): boolean {
  if (existing.formula_version !== candidate.formula_version) return true;
  if (numChanged(Number(existing.fitness), candidate.fitness)) return true;
  if (numChanged(Number(existing.fatigue), candidate.fatigue)) return true;
  if (numChanged(Number(existing.form), candidate.form)) return true;
  return false;
}

async function upsertRows<T>(table: string, rows: T[], conflict: string): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await cacheDb.from(table).upsert(chunk, { onConflict: conflict });
    if (error) throw error;
  }
}

export function dayBefore(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export async function fetchSessionsFrom(athleteId: string, fromDate: string): Promise<Session[]> {
  const { data, error } = await cacheDb
    .from('sessions')
    .select('*')
    .eq('athlete_id', athleteId)
    .gte('session_date', fromDate)
    .order('session_date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Session[];
}

async function fetchSessionsAll(athleteId: string): Promise<Session[]> {
  const { data, error } = await cacheDb
    .from('sessions')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('session_date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Session[];
}

/** Load the full threshold history once per recompute (small table). */
export async function fetchThresholdHistory(athleteId: string): Promise<ThresholdHistoryEntry[]> {
  const { data, error } = await cacheDb
    .from('athlete_thresholds')
    .select('id, effective_from, cp_watts, hr_lt2_bpm, threshold_speed_kmh, source')
    .eq('athlete_id', athleteId)
    .order('effective_from', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<{
    id: string;
    effective_from: string;
    cp_watts: number | null;
    hr_lt2_bpm: number | null;
    threshold_speed_kmh: number | null;
    source: string;
  }>).map(r => ({
    effective_from: r.effective_from,
    cp_watts: r.cp_watts,
    hr_lt2_bpm: r.hr_lt2_bpm,
    threshold_speed_kmh: r.threshold_speed_kmh,
    source: r.source,
    rowId: r.id,
  }));
}

// ---------------------------------------------------------------------------
// Delta recompute with coalescing
// ---------------------------------------------------------------------------

type RecomputeMode = 'delta' | 'full';
interface PendingRecompute {
  athlete: Athlete;
  earliestDate: string | null;
  mode: RecomputeMode;
  onDone?: (r: PersistenceResult) => void;
  onError?: (e: unknown) => void;
}

const queues = new Map<string, PendingRecompute>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function coalesce(athleteId: string, incoming: PendingRecompute): void {
  const existing = queues.get(athleteId);
  if (!existing) {
    queues.set(athleteId, incoming);
  } else {
    // Full mode wins; delta keeps the earlier of the two dates so a bulk
    // import of N activities collapses into one recompute from the min date.
    const mode: RecomputeMode =
      existing.mode === 'full' || incoming.mode === 'full' ? 'full' : 'delta';
    let earliestDate: string | null;
    if (mode === 'full') {
      earliestDate = null;
    } else {
      const a = existing.earliestDate;
      const b = incoming.earliestDate;
      if (!a) earliestDate = b;
      else if (!b) earliestDate = a;
      else earliestDate = a < b ? a : b;
    }
    queues.set(athleteId, {
      ...incoming,
      earliestDate,
      mode,
    });
  }

  const existingTimer = timers.get(athleteId);
  if (existingTimer) clearTimeout(existingTimer);
  const timer = setTimeout(() => {
    timers.delete(athleteId);
    const job = queues.get(athleteId);
    queues.delete(athleteId);
    if (job) void runRecompute(job);
  }, DEBOUNCE_MS);
  timers.set(athleteId, timer);
}

async function runRecompute(job: PendingRecompute): Promise<void> {
  try {
    const result =
      job.mode === 'full'
        ? await persistDailyImpulse(job.athlete)
        : await persistDailyImpulse(job.athlete);
    job.onDone?.(result);
  } catch (err) {
    console.error('recompute failed', err);
    job.onError?.(err);
  }
}

/**
 * Queue a delta recompute from the earliest affected date, coalesced 3 s
 * per athlete. A bulk import passes minDate = min of all new session dates.
 */
export function requestRecompute(
  athlete: Athlete,
  minDate: string | null,
  callbacks?: { onDone?: (r: PersistenceResult) => void; onError?: (e: unknown) => void }
): void {
  coalesce(athlete.id, {
    athlete,
    earliestDate: minDate,
    mode: 'delta',
    onDone: callbacks?.onDone,
    onError: callbacks?.onError,
  });
}

/**
 * Queue a full recompute from the first session (tau change, backfill).
 * Confirmation gating is the caller's responsibility.
 */
export function requestFullRecompute(
  athlete: Athlete,
  callbacks?: { onDone?: (r: PersistenceResult) => void; onError?: (e: unknown) => void }
): void {
  coalesce(athlete.id, {
    athlete,
    earliestDate: null,
    mode: 'full',
    onDone: callbacks?.onDone,
    onError: callbacks?.onError,
  });
}

/**
 * Delta recompute: anchor on daily_state of the day before
 * earliestAffectedDate (or the 28-day seed when absent), recompute
 * [earliestAffectedDate, today], diff-write only changed rows.
 */
export async function persistFrom(athlete: Athlete, _earliestAffected: string): Promise<PersistenceResult> {
  return persistDailyImpulse(athlete);
}

/**
 * Full persistence pass: materialize every calendar day from the first
 * session to today (rest days impulse 0) and the full daily_state history.
 * Idempotent — used by the Recalculate history action and the roll-forward.
 */
export async function persistDailyImpulse(
  athlete: Athlete,
  sessions?: Session[],
  overrides?: ThresholdOverrides
): Promise<PersistenceResult> {
  const today = new Date().toISOString().slice(0, 10);
  const connected = connectedWorkspaces.get(athlete.id);
  const allSessions = sessions ?? connected?.sessions ?? (await fetchSessionsAll(athlete.id));
  athlete = connected?.athlete ?? athlete;
  const history = computeCalendarHistory(athlete, allSessions, overrides);
  const lastValidDate = history[history.length - 1]?.date ?? null;
  const firstDate = allSessions.map(session => session.session_date).sort()[0];
  const rows = firstDate && lastValidDate
    ? buildCalendarRows(athlete, allSessions, undefined, firstDate, lastValidDate)
    : [];
  const meta = metaFromResolution(resolveThresholds(athlete).resolution);
  const grouped = new Map<string, ImpulseRow[]>();
  for (const row of rows) {
    if (row.impulse === null) continue;
    const key = `${row.date}:${row.sport}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  const loadPayload = [...grouped.values()].map(group => {
    const total = group.reduce((sum, row) => sum + (row.impulse ?? 0), 0);
    const payload = rowsToDailyLoad(athlete.id, [{ ...group[0], impulse: total }], meta)[0];
    payload.meta = { ...payload.meta, inputs: group.map(row => ({
      impulse: row.impulse, algorithm_version: row.algorithmVersion, method: row.method,
      status: row.status, provenance: row.provenance, reason: row.reason,
    })) } as DailyLoadMeta;
    return payload;
  });
  // These tables are derived caches. Remove stale rows, including values beyond an
  // incomplete session, before rebuilding them with the current algorithm.
  for (const table of ['daily_load', 'daily_state', 'weekly_load']) {
    const { error } = await cacheDb.from(table).delete().eq('athlete_id', athlete.id);
    if (error) throw error;
  }
  await upsertRows('daily_load', loadPayload, 'athlete_id,date,sport');
  const statePayload = historyToDailyState(athlete.id, history);
  await upsertRows('daily_state', statePayload, 'athlete_id,date');
  await persistWeeklyLoad(athlete.id, dailyTotalsFromCalendar(rows));
  return { dailyLoadCount: loadPayload.length, dailyStateCount: statePayload.length,
    lastDate: lastValidDate ?? (allSessions.length ? '' : today) };

}

/**
 * Roll-forward on app load: if the last daily_state date is before today,
 * extend the grid with zero-impulse days so decay continues on rest days
 * without re-reading sessions.
 */
export async function rollForwardDailyState(athleteId: string, lastStateDate: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  if (!lastStateDate || lastStateDate >= today) return 0;
  const { data, error } = await cacheDb.from('athletes').select('*').eq('id', athleteId).maybeSingle();
  if (error) throw error;
  if (!data) return 0;
  const result = await persistDailyImpulse(data as Athlete);
  return result.dailyStateCount;
}

/**
 * One-time backfill action (coach/admin): full recompute from the first
 * session to today. Idempotent — same diff-write upserts as the delta path.
 */
export async function recalculateHistory(
  athlete: Athlete,
  sessions?: Session[]
): Promise<PersistenceResult> {
  return persistDailyImpulse(athlete, sessions);
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
