import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Athlete, Session, LabTest, NutritionLog, HrvLog, HrvLogInsert, TrainingBlock, TrainingBlockInsert, RaceScheduleEntry, RaceScheduleInsert, HealthHistoryEntry, HealthHistoryInsert } from '../lib/database.types';

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

export function useAthleteData(userId: string | null) {
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

  const updateAthlete = useCallback(async (updates: Partial<Athlete>) => {
    if (!state.athlete) return;
    const { error } = await supabase
      .from('athletes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', state.athlete.id);
    if (error) throw error;
    await loadAll();
  }, [state.athlete, loadAll]);

  const addSession = useCallback(async (session: import('../lib/database.types').SessionInsert) => {
    const { data, error } = await supabase
      .from('sessions')
      .insert(session)
      .select()
      .single();
    if (error) throw error;
    await loadAll();
    return data;
  }, [loadAll]);

  const addSessions = useCallback(async (sessions: import('../lib/database.types').SessionInsert[]) => {
    const CHUNK = 50;
    for (let i = 0; i < sessions.length; i += CHUNK) {
      const { error } = await supabase.from('sessions').insert(sessions.slice(i, i + CHUNK));
      if (error) throw error;
    }
    await loadAll();
  }, [loadAll]);

  const deleteSession = useCallback(async (id: string) => {
    const { error } = await supabase.from('sessions').delete().eq('id', id);
    if (error) throw error;
    await loadAll();
  }, [loadAll]);

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
