import { supabase } from '../supabase';
import type { ImpulseRow } from './impulse';
import { FORMULA_VERSION } from './impulse';
import type { DailyBannisterResult } from './types';

const BATCH_SIZE = 500;

export interface DailyLoadRow {
  athlete_id: string;
  date: string;
  sport: string;
  impulse: number;
  intensity_source: string;
  quality: string;
  formula_version: number;
}

export interface DailyStateRow {
  athlete_id: string;
  date: string;
  fitness: number;
  fatigue: number;
  form: number;
  formula_version: number;
}

export function rowsToDailyLoad(
  athleteId: string,
  rows: ImpulseRow[]
): DailyLoadRow[] {
  return rows.map(r => ({
    athlete_id: athleteId,
    date: r.date,
    sport: r.sport,
    impulse: round4(r.impulse),
    intensity_source: r.intensitySource,
    quality: r.quality,
    formula_version: FORMULA_VERSION,
  }));
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
  windowDays = 365
): Promise<DailyLoadRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const sinceStr = since.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_load')
    .select('*')
    .eq('athlete_id', athleteId)
    .gte('date', sinceStr)
    .order('date', { ascending: true });

  if (error) throw error;
  return (data ?? []) as DailyLoadRow[];
}

export async function loadDailyState(
  athleteId: string,
  windowDays = 365
): Promise<DailyStateRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const sinceStr = since.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_state')
    .select('*')
    .eq('athlete_id', athleteId)
    .gte('date', sinceStr)
    .order('date', { ascending: true });

  if (error) throw error;
  return (data ?? []) as DailyStateRow[];
}

export async function saveDailyImpulse(
  athleteId: string,
  rows: ImpulseRow[]
): Promise<void> {
  if (rows.length === 0) return;
  const payload = rowsToDailyLoad(athleteId, rows);
  for (let i = 0; i < payload.length; i += BATCH_SIZE) {
    const chunk = payload.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
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
    const { error } = await supabase
      .from('daily_state')
      .upsert(chunk, { onConflict: 'athlete_id,date' });
    if (error) throw error;
  }
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
