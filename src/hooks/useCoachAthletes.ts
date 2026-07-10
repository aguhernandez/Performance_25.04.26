import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fetchCoachAthletes, type HubCoachAthlete } from '../lib/hub/hubApiService';
import type { Athlete, Session, LabTest, HrvLog } from '../lib/database.types';

export interface AthleteWithData {
  athlete: Athlete;
  sessions: Session[];
  labTests: LabTest[];
  hrvLogs: HrvLog[];
  latestSession: Session | null;
  hubAthlete: HubCoachAthlete | null;
  hasLocalProfile: boolean;
}

export interface CoachAthletesState {
  athletes: AthleteWithData[];
  loading: boolean;
  error: string | null;
}

function buildPlaceholderAthlete(hubAthlete: HubCoachAthlete): Athlete {
  return {
    id: hubAthlete.id,
    user_id: hubAthlete.id,
    name: hubAthlete.full_name || hubAthlete.email.split('@')[0],
    sport: hubAthlete.sport || 'cycling',
    vo2max: null,
    vlamax: null,
    lean_mass_kg: null,
    weight_kg: null,
    cp_watts: null,
    ftp_watts: null,
    max_hr: null,
    resting_hr: null,
    sport_weights: null,
    tau_fitness: 42,
    tau_fatigue: 7,
    k_multiplier: 2.0,
    hrv_baseline: null,
    running_vdot: null,
    run_threshold_pace: null,
    jump_height_cm: null,
    body_fat_pct: null,
    training_experience_years: null,
    primary_goal: null,
    goal_timeline_weeks: null,
    onboarding_completed: false,
    coach_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Athlete;
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

    // Step 1: Get planner token and coach email from profiles
    const { data: coachProfile } = await supabase
      .from('profiles')
      .select('hub_planner_token, hub_connection_active, email')
      .eq('hub_user_id', coachId)
      .maybeSingle();

    const plannerToken = coachProfile?.hub_planner_token;
    const hubActive = coachProfile?.hub_connection_active;
    const coachEmail = coachProfile?.email;

    // Use planner token if configured, otherwise fall back to session token (JWT from Hub login)
    const sessionToken = localStorage.getItem('hub_session_token');
    const effectiveToken = (plannerToken && hubActive) ? plannerToken : sessionToken;

    // Step 2: Fetch athletes from Hub (source of truth)
    let hubAthletes: HubCoachAthlete[] = [];
    if (effectiveToken && coachEmail) {
      try {
        const hubResponse = await fetchCoachAthletes(effectiveToken, coachEmail);
        hubAthletes = hubResponse.athletes ?? [];
      } catch (err) {
        console.warn('[CoachAthletes] Hub fetch failed, falling back to local only:', err);
      }
    }

    // Step 3: Fetch local athletes assigned to this coach
    const { data: localAthletes, error: localError } = await supabase
      .from('athletes')
      .select('*')
      .eq('coach_id', coachId)
      .order('name', { ascending: true });

    if (localError) {
      setState({ athletes: [], loading: false, error: localError.message });
      return;
    }

    // Step 4: If Hub returned athletes, merge with local. Otherwise use local only.
    let mergedAthletes: AthleteWithData[] = [];

    if (hubAthletes.length > 0) {
      // Match Hub athletes to local profiles via email
      const hubEmails = hubAthletes.map(h => h.email);
      let emailToLocalAthlete = new Map<string, Athlete>();

      if (hubEmails.length > 0) {
        const { data: matchedProfiles } = await supabase
          .from('profiles')
          .select('hub_user_id, email')
          .in('email', hubEmails);

        const emailToUserId = new Map<string, string>();
        if (matchedProfiles) {
          for (const p of matchedProfiles) {
            emailToUserId.set(p.email, p.hub_user_id);
          }
        }

        const localByUserId = new Map<string, Athlete>();
        for (const a of localAthletes ?? []) {
          if (a.user_id) localByUserId.set(a.user_id, a as Athlete);
        }

        for (const hubA of hubAthletes) {
          const userId = emailToUserId.get(hubA.email) ?? hubA.id;
          const localMatch = localByUserId.get(userId);
          if (localMatch) {
            emailToLocalAthlete.set(hubA.email, localMatch);
          }
        }
      }

      const processedLocalIds = new Set<string>();
      for (const hubAthlete of hubAthletes) {
        const localMatch = emailToLocalAthlete.get(hubAthlete.email);
        if (localMatch) {
          processedLocalIds.add(localMatch.id);
          mergedAthletes.push({
            athlete: localMatch,
            sessions: [],
            labTests: [],
            hrvLogs: [],
            latestSession: null,
            hubAthlete,
            hasLocalProfile: true,
          });
        } else {
          mergedAthletes.push({
            athlete: buildPlaceholderAthlete(hubAthlete),
            sessions: [],
            labTests: [],
            hrvLogs: [],
            latestSession: null,
            hubAthlete,
            hasLocalProfile: false,
          });
        }
      }
    } else {
      // No Hub connection or Hub returned empty — use local only
      for (const local of localAthletes ?? []) {
        mergedAthletes.push({
          athlete: local as Athlete,
          sessions: [],
          labTests: [],
          hrvLogs: [],
          latestSession: null,
          hubAthlete: null,
          hasLocalProfile: true,
        });
      }
    }

    // Step 5: Load training data for athletes with local profiles
    const localIds = mergedAthletes
      .filter(a => a.hasLocalProfile)
      .map(a => a.athlete.id);

    if (localIds.length > 0) {
      const [sessionsRes, labRes, hrvRes] = await Promise.all([
        supabase
          .from('sessions')
          .select('*')
          .in('athlete_id', localIds)
          .order('session_date', { ascending: false })
          .limit(500),
        supabase
          .from('lab_tests')
          .select('*')
          .in('athlete_id', localIds)
          .order('test_date', { ascending: false }),
        supabase
          .from('hrv_logs')
          .select('*')
          .in('athlete_id', localIds)
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

      for (const item of mergedAthletes) {
        if (item.hasLocalProfile) {
          const sessions = sessionsByAthlete.get(item.athlete.id) ?? [];
          item.sessions = sessions;
          item.labTests = labsByAthlete.get(item.athlete.id) ?? [];
          item.hrvLogs = hrvByAthlete.get(item.athlete.id) ?? [];
          item.latestSession = sessions[0] ?? null;
        }
      }
    }

    setState({ athletes: mergedAthletes, loading: false, error: null });
  }, [coachId]);

  useEffect(() => {
    loadAthletes();
  }, [loadAthletes]);

  return { ...state, refetch: loadAthletes };
}
