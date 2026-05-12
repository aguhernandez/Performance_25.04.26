import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Athlete, Session, LabTest, HrvLog } from '../lib/database.types';

export interface AthleteWithData {
  athlete: Athlete;
  sessions: Session[];
  labTests: LabTest[];
  hrvLogs: HrvLog[];
  latestSession: Session | null;
}

export interface CoachAthletesState {
  athletes: AthleteWithData[];
  loading: boolean;
  error: string | null;
}

export function useCoachAthletes(coachId: string | null) {
  const [state, setState] = useState<CoachAthletesState>({
    athletes: [],
    loading: true,
    error: null,
  });

  const loadAthletes = useCallback(async () => {
    if (!coachId) {
      setState({ athletes: [], loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    const { data: athleteRows, error: athleteError } = await supabase
      .from('athletes')
      .select('*')
      .eq('coach_id', coachId)
      .order('name', { ascending: true });

    if (athleteError) {
      setState({ athletes: [], loading: false, error: athleteError.message });
      return;
    }

    if (!athleteRows || athleteRows.length === 0) {
      setState({ athletes: [], loading: false, error: null });
      return;
    }

    const athleteIds = athleteRows.map(a => a.id);

    const [sessionsRes, labRes, hrvRes] = await Promise.all([
      supabase
        .from('sessions')
        .select('*')
        .in('athlete_id', athleteIds)
        .order('session_date', { ascending: false })
        .limit(500),
      supabase
        .from('lab_tests')
        .select('*')
        .in('athlete_id', athleteIds)
        .order('test_date', { ascending: false }),
      supabase
        .from('hrv_logs')
        .select('*')
        .in('athlete_id', athleteIds)
        .order('log_date', { ascending: false })
        .limit(300),
    ]);

    const sessionsByAthlete = new Map<string, Session[]>();
    const labsByAthlete = new Map<string, LabTest[]>();
    const hrvByAthlete = new Map<string, HrvLog[]>();

    for (const s of sessionsRes.data ?? []) {
      const arr = sessionsByAthlete.get(s.athlete_id) ?? [];
      arr.push(s as Session);
      sessionsByAthlete.set(s.athlete_id, arr);
    }
    for (const l of labRes.data ?? []) {
      const arr = labsByAthlete.get(l.athlete_id) ?? [];
      arr.push(l as LabTest);
      labsByAthlete.set(l.athlete_id, arr);
    }
    for (const h of hrvRes.data ?? []) {
      const arr = hrvByAthlete.get(h.athlete_id) ?? [];
      arr.push(h as HrvLog);
      hrvByAthlete.set(h.athlete_id, arr);
    }

    const athletes: AthleteWithData[] = athleteRows.map(a => {
      const sessions = sessionsByAthlete.get(a.id) ?? [];
      return {
        athlete: a as Athlete,
        sessions,
        labTests: labsByAthlete.get(a.id) ?? [],
        hrvLogs: hrvByAthlete.get(a.id) ?? [],
        latestSession: sessions[0] ?? null,
      };
    });

    setState({ athletes, loading: false, error: null });
  }, [coachId]);

  useEffect(() => {
    loadAthletes();
  }, [loadAthletes]);

  return { ...state, refetch: loadAthletes };
}
