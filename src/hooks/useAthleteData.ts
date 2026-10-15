import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Athlete, Session, LabTest, NutritionLog, HrvLog, HrvLogInsert, TrainingBlock, TrainingBlockInsert, RaceScheduleEntry, RaceScheduleInsert, HealthHistoryEntry, HealthHistoryInsert } from '../lib/database.types';
import {
  persistDailyImpulse,
  rollForwardDailyState,
  requestRecompute,
  requestFullRecompute,
  seedThresholdsFromProfile,
  insertThresholdRow,
} from '../lib/engine/loadPersistence';
import type { ThresholdOverrides } from '../lib/engine/impulse';

export interface AthleteDataState {
  athlete: Athlete | null;
  sessions: Session[];
  labTests: LabTest[];
  nutritionLogs: NutritionLog[];
  hrvLogs: HrvLog[];
  trainingBlocks: TrainingBlock[];
  raceSchedule: RaceScheduleEntry[];
  healthHistory: HealthHistoryEntry[];
  loading: boolean;
  error: string | null;
}

export function useAthleteData(
  userId: string | null,
  thresholdOverridesRef?: { current: ThresholdOverrides | undefined }
) {
  const [state, setState] = useState<AthleteDataState>({
    athlete: null,
    sessions: [],
    labTests: [],
    nutritionLogs: [],
    hrvLogs: [],
    trainingBlocks: [],
    raceSchedule: [],
    healthHistory: [],
    loading: true,
    error: null,
  });

  const readOverrides = useCallback(
    () => (thresholdOverridesRef ? thresholdOverridesRef.current : undefined),
    [thresholdOverridesRef]
  );

  const runPersistence = useCallback(async (athlete: Athlete) => {
    try {
      const { data: sessions, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('athlete_id', athlete.id)
        .order('session_date', { ascending: true });
      if (error) throw error;
      await persistDailyImpulse(athlete, (sessions ?? []) as Session[], readOverrides());
    } catch (err) {
      console.error('daily persistence failed', err);
    }
  }, [readOverrides]);

  /** Delta recompute from the earliest affected session date (coalesced 3 s). */
  const queueDelta = useCallback(
    (athlete: Athlete, minDate: string | null) => {
      requestRecompute(athlete, minDate, {
        onError: err => console.error('delta recompute failed', err),
      });
    },
    []
  );

  const queueFull = useCallback((athlete: Athlete) => {
    requestFullRecompute(athlete, {
      onError: err => console.error('full recompute failed', err),
    });
  }, []);

  /** Seed the threshold history once from the profile, effective from the first session. */
  const ensureThresholdSeed = useCallback(async (athlete: Athlete, firstSessionDate: string) => {
    try {
      const { data: existing } = await supabase
        .from('athlete_thresholds')
        .select('id')
        .eq('athlete_id', athlete.id)
        .limit(1)
        .maybeSingle();
      if (!existing) {
        await seedThresholdsFromProfile(athlete, firstSessionDate);
      }
    } catch (err) {
      console.error('threshold seed failed', err);
    }
  }, []);

  /** Insert a new threshold row at the edit's effective date (idempotent per date). */
  const seedThresholdsFromProfileOrInsert = useCallback(
    async (athlete: Athlete, effectiveFrom: string) => {
      try {
        await insertThresholdRow(athlete, effectiveFrom, 'profile');
      } catch (err) {
        console.error('threshold insert failed', err);
      }
    },
    []
  );

  const loadAll = useCallback(async () => {
    if (!userId) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    const { data: athleteData, error: athleteError } = await supabase
      .from('athletes')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (athleteError) {
      setState(prev => ({ ...prev, loading: false, error: athleteError.message }));
      return;
    }

    if (!athleteData) {
      setState(prev => ({ ...prev, loading: false, athlete: null }));
      return;
    }

    const [sessionsRes, labRes, nutritionRes, hrvRes, blocksRes, racesRes, healthRes] = await Promise.all([
      supabase.from('sessions').select('*').eq('athlete_id', athleteData.id).order('session_date', { ascending: false }).limit(365),
      supabase.from('lab_tests').select('*').eq('athlete_id', athleteData.id).order('test_date', { ascending: false }),
      supabase.from('nutrition_logs').select('*').eq('athlete_id', athleteData.id).order('log_date', { ascending: false }).limit(90),
      supabase.from('hrv_logs').select('*').eq('athlete_id', athleteData.id).order('log_date', { ascending: false }).limit(90),
      supabase.from('training_blocks').select('*').eq('athlete_id', athleteData.id).order('start_date', { ascending: false }),
      supabase.from('race_schedule').select('*').eq('athlete_id', athleteData.id).order('race_date', { ascending: true }),
      supabase.from('athlete_health_history').select('*').eq('athlete_id', athleteData.id).order('event_date', { ascending: false }),
    ]);

    const { data: lastState } = await supabase
      .from('daily_state')
      .select('date')
      .eq('athlete_id', athleteData.id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastState && lastState.date) {
      try {
        await rollForwardDailyState(athleteData.id, lastState.date);
      } catch (err) {
        console.error('daily state roll-forward failed', err);
      }
    }

    setState({
      athlete: athleteData as Athlete,
      sessions: (sessionsRes.data ?? []) as Session[],
      labTests: (labRes.data ?? []) as LabTest[],
      nutritionLogs: (nutritionRes.data ?? []) as NutritionLog[],
      hrvLogs: (hrvRes.data ?? []) as HrvLog[],
      trainingBlocks: (blocksRes.data ?? []) as TrainingBlock[],
      raceSchedule: (racesRes.data ?? []) as RaceScheduleEntry[],
      healthHistory: (healthRes.data ?? []) as HealthHistoryEntry[],
      loading: false,
      error: sessionsRes.error?.message ?? labRes.error?.message ?? null,
    });
  }, [userId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const createAthlete = useCallback(async (data: Omit<import('../lib/database.types').AthleteInsert, 'user_id'>) => {
    if (!userId) return null;
    const { data: created, error } = await supabase
      .from('athletes')
      .insert({ ...data, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    await loadAll();
    return created;
  }, [userId, loadAll]);

  const updateAthlete = useCallback(async (rawUpdates: Partial<Athlete> & { effective_from_override?: string }) => {
    if (!state.athlete) return;
    const prev = state.athlete;
    const { effective_from_override: effectiveFromOverride, ...updates } = rawUpdates;
    const thresholdFieldsChanged =
      (updates.cp_watts !== undefined && updates.cp_watts !== prev.cp_watts) ||
      (updates.ftp_watts !== undefined && updates.ftp_watts !== prev.ftp_watts) ||
      (updates.hr_lt2_bpm !== undefined && updates.hr_lt2_bpm !== prev.hr_lt2_bpm) ||
      (updates.threshold_speed_kmh !== undefined && updates.threshold_speed_kmh !== prev.threshold_speed_kmh);
    const tauChanged =
      (updates.tau_fitness !== undefined && updates.tau_fitness !== prev.tau_fitness) ||
      (updates.tau_fatigue !== undefined && updates.tau_fatigue !== prev.tau_fatigue);

    const { error } = await supabase
      .from('athletes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', prev.id);
    if (error) throw error;

    const updated = { ...prev, ...updates } as Athlete;

    if (thresholdFieldsChanged) {
      // New threshold history row effective from the edit date (editable via
      // effective_from_override); recompute only from that date forward.
      const effectiveFrom = effectiveFromOverride ?? new Date().toISOString().split('T')[0];
      await seedThresholdsFromProfileOrInsert(updated, effectiveFrom);
      await loadAll();
      queueDelta(updated, effectiveFrom);
    } else if (tauChanged) {
      const confirmed = window.confirm('This recalculates the full history: tau affects the whole training series, so every day from the first session onward will be recomputed.');
      if (!confirmed) {
        await loadAll();
        return;
      }
      await loadAll();
      queueFull(updated);
    } else {
      await loadAll();
      if (prev) queueDelta(prev, null);
    }
  }, [state.athlete, loadAll, queueDelta, queueFull]);

  const addSession = useCallback(async (session: import('../lib/database.types').SessionInsert) => {
    const { data, error } = await supabase
      .from('sessions')
      .insert(session)
      .select()
      .single();
    if (error) throw error;
    const created = data as { session_date: string } | null;
    await loadAll();
    if (created && state.athlete) {
      await ensureThresholdSeed(state.athlete, created.session_date);
      queueDelta(state.athlete, created.session_date);
    }
    return data;
  }, [loadAll, state.athlete, queueDelta]);

  const addSessions = useCallback(async (sessions: import('../lib/database.types').SessionInsert[]) => {
    const CHUNK = 50;
    for (let i = 0; i < sessions.length; i += CHUNK) {
      const { error } = await supabase.from('sessions').insert(sessions.slice(i, i + CHUNK));
      if (error) throw error;
    }
    await loadAll();
    if (state.athlete && sessions.length > 0) {
      const minDate = sessions.reduce(
        (min, s) => (s.session_date && s.session_date < min ? s.session_date : min),
        sessions[0].session_date ?? new Date().toISOString().split('T')[0]
      );
      await ensureThresholdSeed(state.athlete, minDate);
      // ONE coalesced recompute from the min date for the whole import.
      queueDelta(state.athlete, minDate);
    }
  }, [loadAll, state.athlete, queueDelta]);

  const deleteSession = useCallback(async (id: string) => {
    const { data: existing } = await supabase
      .from('sessions')
      .select('session_date')
      .eq('id', id)
      .maybeSingle();
    const deletedDate = (existing as { session_date: string } | null)?.session_date ?? null;
    const { error } = await supabase.from('sessions').delete().eq('id', id);
    if (error) throw error;
    await loadAll();
    if (state.athlete) queueDelta(state.athlete, deletedDate);
  }, [loadAll, state.athlete, queueDelta]);

  const addLabTest = useCallback(async (test: import('../lib/database.types').LabTestInsert) => {
    const { data, error } = await supabase
      .from('lab_tests')
      .insert(test)
      .select()
      .single();
    if (error) throw error;
    await loadAll();
    return data;
  }, [loadAll]);

  const addHrvLog = useCallback(async (log: HrvLogInsert) => {
    const { data, error } = await supabase.from('hrv_logs').insert(log).select().single();
    if (error) throw error;
    await loadAll();
    return data;
  }, [loadAll]);

  const deleteHrvLog = useCallback(async (id: string) => {
    const { error } = await supabase.from('hrv_logs').delete().eq('id', id);
    if (error) throw error;
    await loadAll();
  }, [loadAll]);

  const addTrainingBlock = useCallback(async (block: TrainingBlockInsert) => {
    const { data, error } = await supabase.from('training_blocks').insert(block).select().single();
    if (error) throw error;
    await loadAll();
    return data;
  }, [loadAll]);

  const deleteTrainingBlock = useCallback(async (id: string) => {
    const { error } = await supabase.from('training_blocks').delete().eq('id', id);
    if (error) throw error;
    await loadAll();
  }, [loadAll]);

  const addRace = useCallback(async (race: RaceScheduleInsert) => {
    const { data, error } = await supabase.from('race_schedule').insert(race).select().single();
    if (error) throw error;
    await loadAll();
    return data;
  }, [loadAll]);

  const updateRace = useCallback(async (id: string, updates: Partial<RaceScheduleEntry>) => {
    const { error } = await supabase.from('race_schedule').update(updates).eq('id', id);
    if (error) throw error;
    await loadAll();
  }, [loadAll]);

  const deleteRace = useCallback(async (id: string) => {
    const { error } = await supabase.from('race_schedule').delete().eq('id', id);
    if (error) throw error;
    await loadAll();
  }, [loadAll]);

  const addHealthEvent = useCallback(async (event: HealthHistoryInsert) => {
    const { data, error } = await supabase.from('athlete_health_history').insert(event).select().single();
    if (error) throw error;
    await loadAll();
    return data;
  }, [loadAll]);

  const deleteHealthEvent = useCallback(async (id: string) => {
    const { error } = await supabase.from('athlete_health_history').delete().eq('id', id);
    if (error) throw error;
    await loadAll();
  }, [loadAll]);

  return {
    ...state,
    refetch: loadAll,
    createAthlete,
    updateAthlete,
    addSession,
    addSessions,
    deleteSession,
    addLabTest,
    addHrvLog,
    deleteHrvLog,
    addTrainingBlock,
    deleteTrainingBlock,
    addRace,
    updateRace,
    deleteRace,
    addHealthEvent,
    deleteHealthEvent,
  };
}
