const HUB_API_BASE = 'https://ngkcbygyoobqhlmlnuvl.supabase.co/functions/v1/planner-hub-api';

export type PlannerTokenType = 'lab' | 'endurance' | 'nutrition' | 'academy' | 'motion' | 'performance';

export interface HubAthleteProfile {
  athlete: {
    id: string;
    full_name: string;
    email: string;
    sport: string;
    date_of_birth: string | null;
    gender: string | null;
  };
  body_composition: {
    fat_mass_kg: number | null;
    lean_mass_kg: number | null;
    fat_percent: number | null;
    measurement_date: string | null;
  } | null;
  nutrition_targets: {
    target_kcal: number | null;
    target_protein_g: number | null;
    target_carbs_g: number | null;
    target_fat_g: number | null;
  } | null;
}

export interface HubBiologicalPassport {
  active_passport: {
    vo2max: number | null;
    ftp_watts: number | null;
    lt1_power: number | null;
    lt2_power: number | null;
    lt1_hr: number | null;
    lt2_hr: number | null;
    power_zones_json: Record<string, [number, number]> | null;
    hr_zones_json: Record<string, [number, number]> | null;
    training_zones: Record<string, unknown> | null;
    vam: number | null;
    pam: number | null;
    measurement_date: string | null;
    source: string | null;
    athlete_level: string | null;
    training_age_years: number | null;
  } | null;
  passport_history: Array<{
    measurement_date: string;
    vo2max: number | null;
    ftp_watts: number | null;
    source: string | null;
  }>;
}

export interface HubTrainingSchedule {
  workouts: Array<{
    id: string;
    scheduled_date: string;
    name: string;
    sport: string;
    workout_type: string;
    status: string;
    estimated_duration_minutes: number | null;
    actual_duration_minutes: number | null;
    tss: number | null;
    intensity_zone: 'green' | 'yellow' | 'red' | null;
  }>;
  weekly_loads: Array<{
    week_start: string;
    total_tss: number;
    total_hours: number;
    intensity_distribution: { green: number; yellow: number; red: number };
    adherence_pct: number | null;
  }>;
}

export interface HubNutritionData {
  plans: Array<{
    plan_date: string;
    plan_name: string | null;
    fuel_day_type: 'green' | 'yellow' | 'red' | null;
    target_kcal: number | null;
    target_protein_g: number | null;
    target_carbs_g: number | null;
    target_fat_g: number | null;
    adherence_pct: number | null;
  }>;
}

export interface HubWellnessData {
  latest: {
    checkin_date: string;
    fatigue: number | null;
    sleep_quality: number | null;
    hrv: number | null;
    resting_hr: number | null;
    stress: number | null;
    motivation: number | null;
    muscle_soreness: number | null;
    general_wellbeing: number | null;
    notes: string | null;
  } | null;
  averages: {
    fatigue: number | null;
    sleep_quality: number | null;
    hrv: number | null;
    resting_hr: number | null;
    stress: number | null;
    motivation: number | null;
  } | null;
  checkins: Array<{
    checkin_date: string;
    fatigue: number | null;
    sleep_quality: number | null;
    hrv: number | null;
    resting_hr: number | null;
    general_wellbeing: number | null;
  }>;
}

export interface HubAnthropometry {
  measurements: Array<{
    measured_at: string;
    method: string | null;
    weight_kg: number | null;
    fat_pct: number | null;
    lean_mass_kg: number | null;
    muscle_mass_kg: number | null;
    bone_mass_kg: number | null;
    fat_mass_kg: number | null;
  }>;
}

export interface HubAthleteHabits {
  habits: Array<{
    habit_name: string;
    category: string;
    is_active: boolean;
    compliance_pct: number | null;
    current_streak_days: number | null;
  }>;
  averages: {
    sleep_hours: number | null;
    hydration_ml: number | null;
  } | null;
}

export interface HubEnduranceData {
  plans: Array<{
    week_start_date: string;
    plan_name: string | null;
    total_hours: number | null;
    total_tss: number | null;
    sessions: number | null;
    notes: string | null;
  }>;
}

export interface HubFoodDiary {
  entries: Array<{
    diary_date: string;
    total_kcal: number | null;
    total_protein_g: number | null;
    total_carbs_g: number | null;
    total_fat_g: number | null;
  }>;
}

export interface HubConnectionStatus {
  connected: boolean;
  tokenValid: boolean;
  error: string | null;
  checkedAt: string | null;
}

export class HubApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HubApiError';
  }
}

async function hubFetch<T>(
  path: string,
  token: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(HUB_API_BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url.toString(), {
    headers: {
      'X-Planner-Token': token,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new HubApiError(response.status, body.error || response.statusText);
  }

  return response.json() as Promise<T>;
}

export async function testHubToken(token: string): Promise<HubConnectionStatus> {
  try {
    await hubFetch('/athlete-profile', token, { athlete_email: 'probe@asciende.pro' });
    return { connected: true, tokenValid: true, error: null, checkedAt: new Date().toISOString() };
  } catch (err) {
    if (err instanceof HubApiError) {
      if (err.status === 401) {
        return { connected: true, tokenValid: false, error: 'Token invalido o inactivo', checkedAt: new Date().toISOString() };
      }
      if (err.status === 404) {
        return { connected: true, tokenValid: true, error: null, checkedAt: new Date().toISOString() };
      }
    }
    return { connected: false, tokenValid: false, error: 'No se pudo conectar al Hub', checkedAt: new Date().toISOString() };
  }
}

export async function fetchAthleteProfile(token: string, athleteEmail: string): Promise<HubAthleteProfile> {
  return hubFetch<HubAthleteProfile>('/athlete-profile', token, { athlete_email: athleteEmail });
}

export async function fetchBiologicalPassport(token: string, athleteEmail: string): Promise<HubBiologicalPassport> {
  return hubFetch<HubBiologicalPassport>('/biological-passport', token, { athlete_email: athleteEmail });
}

export async function fetchTrainingSchedule(
  token: string,
  athleteEmail: string,
  dateFrom: string,
  dateTo: string
): Promise<HubTrainingSchedule> {
  return hubFetch<HubTrainingSchedule>('/training-schedule', token, {
    athlete_email: athleteEmail,
    date_from: dateFrom,
    date_to: dateTo,
  });
}

export async function fetchNutritionData(
  token: string,
  athleteEmail: string,
  dateFrom: string,
  dateTo: string
): Promise<HubNutritionData> {
  return hubFetch<HubNutritionData>('/nutrition-data', token, {
    athlete_email: athleteEmail,
    date_from: dateFrom,
    date_to: dateTo,
  });
}

export async function fetchWellness(
  token: string,
  athleteEmail: string,
  dateFrom: string,
  dateTo: string
): Promise<HubWellnessData> {
  return hubFetch<HubWellnessData>('/wellness', token, {
    athlete_email: athleteEmail,
    date_from: dateFrom,
    date_to: dateTo,
  });
}

export async function fetchAnthropometry(
  token: string,
  athleteEmail: string,
  limit = 10
): Promise<HubAnthropometry> {
  return hubFetch<HubAnthropometry>('/anthropometry', token, {
    athlete_email: athleteEmail,
    limit: String(limit),
  });
}

export async function fetchAthleteHabits(
  token: string,
  athleteEmail: string,
  days = 30
): Promise<HubAthleteHabits> {
  return hubFetch<HubAthleteHabits>('/athlete-habits', token, {
    athlete_email: athleteEmail,
    days: String(days),
  });
}

export async function fetchEnduranceData(
  token: string,
  athleteEmail: string,
  dateFrom: string,
  dateTo: string
): Promise<HubEnduranceData> {
  return hubFetch<HubEnduranceData>('/endurance-data', token, {
    athlete_email: athleteEmail,
    date_from: dateFrom,
    date_to: dateTo,
  });
}

export async function fetchFoodDiary(
  token: string,
  athleteEmail: string,
  dateFrom: string,
  dateTo: string
): Promise<HubFoodDiary> {
  return hubFetch<HubFoodDiary>('/food-diary', token, {
    athlete_email: athleteEmail,
    date_from: dateFrom,
    date_to: dateTo,
  });
}

export interface HubCoachAthlete {
  id: string;
  email: string;
  full_name: string;
  sport: string;
  date_of_birth: string | null;
  gender: string | null;
  membership_slug: string | null;
  membership_name: string | null;
}

export interface HubCoachAthletesResponse {
  athletes: HubCoachAthlete[];
  count: number;
}

export async function fetchCoachAthletes(token: string, coachEmail: string): Promise<HubCoachAthletesResponse> {
  return hubFetch<HubCoachAthletesResponse>('/coach-athletes', token, { coach_email: coachEmail });
}
