import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  fetchAthleteProfile,
  fetchBiologicalPassport,
  fetchTrainingSchedule,
  fetchNutritionData,
  fetchWellness,
  fetchAnthropometry,
  fetchAthleteHabits,
  fetchEnduranceData,
  fetchFoodDiary,
  HubApiError,
  type HubAthleteProfile,
  type HubBiologicalPassport,
  type HubTrainingSchedule,
  type HubNutritionData,
  type HubWellnessData,
  type HubAnthropometry,
  type HubAthleteHabits,
  type HubEnduranceData,
  type HubFoodDiary,
} from '../lib/hub/hubApiService';

interface HubTokenConfig {
  token: string;
  label: string | null;
  active: boolean;
}

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
}

interface UseHubDataReturn {
  hubConnected: boolean;
  tokenConfig: HubTokenConfig | null;
  snapshot: HubSnapshot;
  loading: boolean;
  error: string | null;
  athleteHubId: string | null;
  refresh: (athleteEmail: string) => Promise<void>;
  fetchSection: (section: keyof HubSnapshot, athleteEmail: string, dateFrom?: string, dateTo?: string) => Promise<void>;
}

const EMPTY_SNAPSHOT: HubSnapshot = {
  athleteProfile: null,
  biologicalPassport: null,
  trainingSchedule: null,
  nutritionData: null,
  wellness: null,
  anthropometry: null,
  habits: null,
  enduranceData: null,
  foodDiary: null,
};

function getDateRange(daysBack = 30): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

export function useHubData(profileId: string | undefined): UseHubDataReturn {
  const [tokenConfig, setTokenConfig] = useState<HubTokenConfig | null>(null);
  const [snapshot, setSnapshot] = useState<HubSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [athleteHubId, setAthleteHubId] = useState<string | null>(null);

  useEffect(() => {
    if (profileId) {
      loadTokenConfig(profileId);
    }
  }, [profileId]);

  const loadTokenConfig = async (pid: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('hub_planner_token, hub_token_label, hub_connection_active')
      .eq('id', pid)
      .maybeSingle();

    if (data?.hub_planner_token && data?.hub_connection_active) {
      setTokenConfig({
        token: data.hub_planner_token,
        label: data.hub_token_label,
        active: data.hub_connection_active,
      });
    } else {
      setTokenConfig(null);
    }
  };

  const refresh = useCallback(async (athleteEmail: string) => {
    if (!tokenConfig?.token) return;
    const token = tokenConfig.token;
    setLoading(true);
    setError(null);

    try {
      const profileData = await fetchAthleteProfile(token, athleteEmail);
      setAthleteHubId(profileData.athlete.id);
      setSnapshot(prev => ({ ...prev, athleteProfile: profileData }));

      const { from, to } = getDateRange(30);

      const [passport, schedule, nutrition, wellness, anthropometry, habits, endurance, diary] = await Promise.allSettled([
        fetchBiologicalPassport(token, athleteEmail),
        fetchTrainingSchedule(token, athleteEmail, from, to),
        fetchNutritionData(token, athleteEmail, from, to),
        fetchWellness(token, athleteEmail, from, to),
        fetchAnthropometry(token, athleteEmail, 10),
        fetchAthleteHabits(token, athleteEmail, 30),
        fetchEnduranceData(token, athleteEmail, from, to),
        fetchFoodDiary(token, athleteEmail, from, to),
      ]);

      setSnapshot(prev => ({
        ...prev,
        biologicalPassport: passport.status === 'fulfilled' ? passport.value : prev.biologicalPassport,
        trainingSchedule: schedule.status === 'fulfilled' ? schedule.value : prev.trainingSchedule,
        nutritionData: nutrition.status === 'fulfilled' ? nutrition.value : prev.nutritionData,
        wellness: wellness.status === 'fulfilled' ? wellness.value : prev.wellness,
        anthropometry: anthropometry.status === 'fulfilled' ? anthropometry.value : prev.anthropometry,
        habits: habits.status === 'fulfilled' ? habits.value : prev.habits,
        enduranceData: endurance.status === 'fulfilled' ? endurance.value : prev.enduranceData,
        foodDiary: diary.status === 'fulfilled' ? diary.value : prev.foodDiary,
      }));
    } catch (err) {
      if (err instanceof HubApiError) {
        if (err.status === 401) setError('Token de Hub invalido o inactivo');
        else if (err.status === 404) setError('Atleta no encontrado en el Hub');
        else setError(`Error del Hub: ${err.message}`);
      } else {
        setError('No se pudo conectar al Hub');
      }
    } finally {
      setLoading(false);
    }
  }, [tokenConfig]);

  const fetchSection = useCallback(async (
    section: keyof HubSnapshot,
    athleteEmail: string,
    dateFrom?: string,
    dateTo?: string
  ) => {
    if (!tokenConfig?.token) return;
    const token = tokenConfig.token;
    const { from, to } = getDateRange(30);
    const df = dateFrom ?? from;
    const dt = dateTo ?? to;

    try {
      let result: HubSnapshot[typeof section] = null;
      switch (section) {
        case 'athleteProfile':
          result = await fetchAthleteProfile(token, athleteEmail);
          break;
        case 'biologicalPassport':
          result = await fetchBiologicalPassport(token, athleteEmail);
          break;
        case 'trainingSchedule':
          result = await fetchTrainingSchedule(token, athleteEmail, df, dt);
          break;
        case 'nutritionData':
          result = await fetchNutritionData(token, athleteEmail, df, dt);
          break;
        case 'wellness':
          result = await fetchWellness(token, athleteEmail, df, dt);
          break;
        case 'anthropometry':
          result = await fetchAnthropometry(token, athleteEmail, 10);
          break;
        case 'habits':
          result = await fetchAthleteHabits(token, athleteEmail, 30);
          break;
        case 'enduranceData':
          result = await fetchEnduranceData(token, athleteEmail, df, dt);
          break;
        case 'foodDiary':
          result = await fetchFoodDiary(token, athleteEmail, df, dt);
          break;
      }
      setSnapshot(prev => ({ ...prev, [section]: result }));
    } catch {
    }
  }, [tokenConfig]);

  return {
    hubConnected: !!tokenConfig?.active,
    tokenConfig,
    snapshot,
    loading,
    error,
    athleteHubId,
    refresh,
    fetchSection,
  };
}
