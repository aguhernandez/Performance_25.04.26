import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
  Athlete,
  LabTest,
  RaceScenarioInsert,
  RaceScenarioKind,
  RaceScenarioRecord,
} from '../lib/database.types';
import type { AthletePhysioProfile, LactatePoint } from '../lib/engine/simulationEngine';

/**
 * Builds the engine's AthletePhysioProfile from the athlete record and the
 * most recent lab test, preferring measured lab values over profile fields.
 * Maps what exists; everything else falls back to engine defaults.
 */
export function buildPhysioProfile(athlete: Athlete | null, lab: LabTest | null): AthletePhysioProfile {
  if (!athlete) return { vo2max: 50 };
  const vo2max = lab?.vo2max ?? athlete.vo2max ?? 50;
  const profile: AthletePhysioProfile = {
    vo2max,
    weight_kg: athlete.weight_kg ?? undefined,
    hr_max: athlete.max_hr ?? undefined,
    hr_rest: athlete.resting_hr ?? undefined,
    lt2_hr: lab?.lactate_threshold_2_hr ?? athlete.hr_lt2_bpm ?? null,
    lt1_hr: lab?.lactate_threshold_1_hr ?? null,
  };
  if (lab?.fat_max_watts) profile.fatmax_hr = null; // watts, not HR — engine wants HR; skip
  const raw = lab?.raw_data as Record<string, unknown> | null | undefined;
  if (raw) {
    const re = Number(raw.running_economy);
    if (isFinite(re) && re > 150 && re < 300) profile.running_economy = re;
    const lt1Vo2 = Number(raw.lt1_vo2);
    if (isFinite(lt1Vo2) && lt1Vo2 > 0) profile.lt1_vo2 = lt1Vo2;
    const lt2Vo2 = Number(raw.lt2_vo2);
    if (isFinite(lt2Vo2) && lt2Vo2 > 0) profile.lt2_vo2 = lt2Vo2;
    const lt1Pace = typeof raw.lt1_pace === 'string' ? raw.lt1_pace : null;
    if (lt1Pace) profile.lt1_pace = lt1Pace;
    const lt2Pace = typeof raw.lt2_pace === 'string' ? raw.lt2_pace : null;
    if (lt2Pace) profile.lt2_pace = lt2Pace;
    const curve = raw.lactate_curve;
    if (Array.isArray(curve) && curve.length >= 3) {
      const pts: LactatePoint[] = [];
      for (const p of curve) {
        const speed = Number((p as Record<string, unknown>).speed_kmh);
        const mmol = Number((p as Record<string, unknown>).lactate_mmol);
        if (isFinite(speed) && isFinite(mmol)) pts.push({ speed_kmh: speed, lactate_mmol: mmol });
      }
      if (pts.length >= 3) profile.lactate_curve = pts;
    }
  }
  // Threshold pace from stored threshold speed (km/h → min/km).
  if (!profile.lt2_pace && athlete.threshold_speed_kmh) {
    const kmh = Number(athlete.threshold_speed_kmh);
    if (kmh > 5 && kmh < 30) profile.lt2_pace = (60 / kmh).toFixed(2).replace(/\.00$/, '');
  }
  return profile;
}

export function useSimulationProfile(athlete: Athlete | null) {
  const [labTest, setLabTest] = useState<LabTest | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!athlete?.id) {
      setLabTest(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('lab_tests')
        .select('*')
        .eq('athlete_id', athlete.id)
        .order('test_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setLabTest((data as LabTest | null) ?? null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [athlete?.id]);

  const profile = buildPhysioProfile(athlete, labTest);
  return { profile, labTest, loading };
}

export function useRaceScenarios(athleteId: string | null | undefined) {
  const [scenarios, setScenarios] = useState<RaceScenarioRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!athleteId) {
      setScenarios([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('race_scenarios')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error) setScenarios((data ?? []) as RaceScenarioRecord[]);
    setLoading(false);
  }, [athleteId]);

  useEffect(() => { refetch(); }, [refetch]);

  const save = useCallback(async (kind: RaceScenarioKind, name: string, params: Record<string, unknown>, result: Record<string, unknown> | null) => {
    if (!athleteId) return;
    const row: RaceScenarioInsert = { athlete_id: athleteId, kind, name, params, result };
    const { error } = await supabase.from('race_scenarios').insert(row);
    if (!error) await refetch();
  }, [athleteId, refetch]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('race_scenarios').delete().eq('id', id);
    if (!error) setScenarios(prev => prev.filter(s => s.id !== id));
  }, []);

  return { scenarios, loading, save, remove };
}
