import { supabase } from '../supabase';
import { fitCpModel, cpConfidence, type CpRegression, type CpConfidence, type MmpInputPoint } from './powerAnalysis';
import { computeCpModel, type CpModelResult } from './cpModel';

const BATCH_SIZE = 500;

export interface ActivityMmpRow {
  activity_id: string;
  athlete_id: string;
  date: string;
  duration_s: number;
  watts: number;
  np: number | null;
  vi: number | null;
  source: string;
}

export interface ActivityMetricsRow {
  activity_id: string;
  athlete_id: string;
  date: string;
  avg_power_watts: number | null;
  np_watts: number | null;
  vi: number | null;
  avg_hr: number | null;
  ef: number | null;
  decoupling_pct: number | null;
  stream_fingerprint: string | null;
}

export interface StoredCpModel {
  cp: number;
  wPrimeJ: number;
  r2: number;
  seCp: number;
  nPoints: number;
  windowDays: number;
  confidence: CpConfidence;
  status: 'ok' | 'insufficient_data';
  reason?: string;
}

export async function saveActivityMmp(rows: ActivityMmpRow[]): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('activity_mmp')
      .upsert(chunk, { onConflict: 'activity_id,duration_s' });
    if (error) throw error;
  }
}

export async function saveActivityMetrics(row: ActivityMetricsRow): Promise<void> {
  const { error } = await supabase
    .from('activity_metrics')
    .upsert(row, { onConflict: 'activity_id' });
  if (error) throw error;
}

export async function loadActivityMmp(
  athleteId: string,
  windowDays = 365
): Promise<ActivityMmpRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const sinceStr = since.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('activity_mmp')
    .select('activity_id,athlete_id,date,duration_s,watts,np,vi,source')
    .eq('athlete_id', athleteId)
    .gte('date', sinceStr)
    .order('date', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ActivityMmpRow[];
}

export async function loadActivityMetrics(
  athleteId: string,
  windowDays = 365
): Promise<ActivityMetricsRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const sinceStr = since.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('activity_metrics')
    .select('*')
    .eq('athlete_id', athleteId)
    .gte('date', sinceStr)
    .order('date', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ActivityMetricsRow[];
}

export async function loadExistingFingerprints(
  athleteId: string
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('activity_metrics')
    .select('activity_id,stream_fingerprint')
    .eq('athlete_id', athleteId);

  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of (data ?? []) as { activity_id: string; stream_fingerprint: string | null }[]) {
    if (row.stream_fingerprint) map.set(row.activity_id, row.stream_fingerprint);
  }
  return map;
}

/**
 * Athlete-level MMP for any period: max per duration across stored rows,
 * keeping date and activity_id of the best effort. fitCpModel runs on those
 * best points.
 */
export function fitAthleteCpModel(
  mmpRows: ActivityMmpRow[],
  today: Date = new Date()
): { regression: CpRegression; confidence: CpConfidence | null; bestPoints: MmpInputPoint[] } {
  const bestByDuration = new Map<number, MmpInputPoint>();
  for (const r of mmpRows) {
    const existing = bestByDuration.get(r.duration_s);
    if (!existing || r.watts > existing.watts) {
      bestByDuration.set(r.duration_s, {
        durationS: r.duration_s,
        watts: r.watts,
        date: r.date,
        activityId: r.activity_id,
      });
    }
  }

  const bestPoints = Array.from(bestByDuration.values()).sort((a, b) => a.durationS - b.durationS);
  const regression = fitCpModel(bestPoints, today);
  return { regression, confidence: cpConfidence(regression), bestPoints };
}

export function toStoredCpModel(
  regression: CpRegression,
  confidence: CpConfidence | null
): StoredCpModel {
  return {
    cp: regression.cp,
    wPrimeJ: regression.wPrimeJ,
    r2: regression.r2,
    seCp: regression.seCp,
    nPoints: regression.nPoints,
    windowDays: regression.windowDays,
    confidence: confidence ?? 'low',
    status: regression.status,
    reason: regression.reason,
  };
}

export { computeCpModel, type CpModelResult };
