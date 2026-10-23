import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { fetchHubContext, normalizeHubContext, type HubContextResponse } from '../lib/hub/hubContext';
import type { HubAthleteProfile, HubBiologicalPassport, HubTrainingSchedule, HubNutritionData, HubWellnessData, HubAnthropometry, HubAthleteHabits, HubEnduranceData, HubFoodDiary } from '../lib/hub/hubApiService';
interface HubTokenRow { hub_planner_token: string | null; hub_token_label: string | null; hub_connection_active: boolean }
interface HubTokenConfig { token: string; label: string | null; active: boolean }
export interface HubSnapshot {
  athleteProfile: HubAthleteProfile | null;
  biologicalPassport: HubBiologicalPassport | null;
  trainingSchedule: HubTrainingSchedule | null;
  nutritionData: HubNutritionData | null;
  wellness: HubWellnessData | null;
  anthropometry: HubAnthropometry | null;
  habits: HubAthleteHabits | null;
  enduranceData: HubEnduranceData | null;
  foodDiary: HubFoodDiary | null;
  context?: HubContextResponse;
}
export const EMPTY_HUB_SNAPSHOT: HubSnapshot = { athleteProfile: null, biologicalPassport: null, trainingSchedule: null, nutritionData: null, wellness: null, anthropometry: null, habits: null, enduranceData: null, foodDiary: null };
export function useHubData(profileId: string | undefined) {
  const [tokenConfig, setTokenConfig] = useState<HubTokenConfig | null>(null);
  const [snapshot, setSnapshot] = useState<HubSnapshot>(EMPTY_HUB_SNAPSHOT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    generation.current++;
    setTokenConfig(null); setSnapshot(EMPTY_HUB_SNAPSHOT); setError(null); setLoading(false);
    if (profileId) void (async () => {
      let { data, error: configError } = await supabase.from('profiles').select('hub_planner_token, hub_token_label, hub_connection_active').eq('id', profileId).maybeSingle<HubTokenRow>();
      if (!data?.hub_planner_token && !configError) {
        const shared = await supabase.from('profiles').select('hub_planner_token, hub_token_label, hub_connection_active').eq('role', 'admin').eq('hub_connection_active', true).limit(1).maybeSingle<HubTokenRow>();
        data = shared.data; configError = shared.error;
      }
      if (!active) return;
      if (configError) { setError(configError.message); return; }
      if (data?.hub_planner_token && data?.hub_connection_active) setTokenConfig({ token: data.hub_planner_token, label: data.hub_token_label, active: true });
    })();
    return () => { active = false; generation.current++; };
  }, [profileId]);
  const refresh = useCallback(async (athleteEmail: string) => {
    const request = ++generation.current;
    setSnapshot(EMPTY_HUB_SNAPSHOT); setError(null);
    if (!tokenConfig?.token) { setLoading(false); return; }
    setLoading(true);
    try {
      const context = await fetchHubContext(tokenConfig.token, athleteEmail);
      if (request !== generation.current) return;
      setSnapshot(normalizeHubContext(context));
      const failures = Object.keys(context.errors);
      if (failures.length) setError(`Hub: no se pudieron leer ${failures.join(', ')}. El resto de los datos está disponible.`);
    } catch (err) {
      if (request === generation.current) setError(err instanceof Error ? err.message : 'No se pudo consultar el Hub');
    } finally { if (request === generation.current) setLoading(false); }
  }, [tokenConfig]);
  const fetchSection = useCallback(async (_section: keyof HubSnapshot, athleteEmail: string, _dateFrom?: string, _dateTo?: string) => refresh(athleteEmail), [refresh]);
  return { hubConnected: !!tokenConfig?.active, tokenConfig, snapshot, loading, error, athleteHubId: snapshot.athleteProfile?.athlete.id ?? null, refresh, fetchSection };
}
