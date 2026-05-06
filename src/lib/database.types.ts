export interface Database {
  public: {
    Tables: {
      athletes: {
        Row: Athlete;
        Insert: AthleteInsert;
        Update: Partial<AthleteInsert>;
      };
      sessions: {
        Row: Session;
        Insert: SessionInsert;
        Update: Partial<SessionInsert>;
      };
      lab_tests: {
        Row: LabTest;
        Insert: LabTestInsert;
        Update: Partial<LabTestInsert>;
      };
      nutrition_logs: {
        Row: NutritionLog;
        Insert: NutritionLogInsert;
        Update: Partial<NutritionLogInsert>;
      };
      performance_snapshots: {
        Row: PerformanceSnapshot;
        Insert: PerformanceSnapshotInsert;
        Update: Partial<PerformanceSnapshotInsert>;
      };
      shareable_links: {
        Row: ShareableLink;
        Insert: ShareableLinkInsert;
        Update: Partial<ShareableLinkInsert>;
      };
    };
  };
}

export interface Athlete {
  id: string;
  user_id: string;
  name: string;
  sport: string;
  vo2max: number;
  vlamax: number;
  lean_mass_kg: number;
  weight_kg: number;
  cp_watts: number;
  ftp_watts: number;
  max_hr: number;
  resting_hr: number;
  sport_weights: SportWeights;
  tau_fitness: number;
  tau_fatigue: number;
  k_multiplier: number;
  training_experience_years: number;
  primary_goal: string;
  goal_timeline_weeks: number;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface AthleteInsert {
  user_id: string;
  name: string;
  sport?: string;
  vo2max?: number;
  vlamax?: number;
  lean_mass_kg?: number;
  weight_kg?: number;
  cp_watts?: number;
  ftp_watts?: number;
  max_hr?: number;
  resting_hr?: number;
  sport_weights?: SportWeights;
  tau_fitness?: number;
  tau_fatigue?: number;
  k_multiplier?: number;
}

export interface SportWeights {
  endurance: number;
  strength: number;
  other: number;
}

export type SessionType = 'endurance' | 'strength' | 'other' | 'beach_volleyball' | 'running' | 'cycling';

export interface Session {
  id: string;
  athlete_id: string;
  session_date: string;
  session_type: SessionType;
  title: string;
  notes: string;
  duration_min: number;
  avg_power_watts: number | null;
  normalized_power_watts: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  rpe: number | null;
  distance_km: number | null;
  elevation_m: number | null;
  strength_exercises: StrengthExercise[] | null;
  impulse: number;
  raw_data: Record<string, unknown> | null;
  sub_sport: string | null;
  sport_specific_data: Record<string, unknown> | null;
  training_intention: TrainingIntention | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  altitude_m_env: number | null;
  zone_distribution: ZoneDistribution | null;
  perceived_difficulty: number | null;
  how_felt: string | null;
  created_at: string;
}

export type TrainingIntention = 'aerobic' | 'threshold' | 'vo2max' | 'power' | 'recovery' | 'other';

export interface ZoneDistribution {
  z1_min: number;
  z2_min: number;
  z3_min: number;
  z4_min: number;
  z5_min: number;
}

export interface SessionInsert {
  athlete_id: string;
  session_date: string;
  session_type: SessionType;
  title?: string;
  notes?: string;
  duration_min: number;
  avg_power_watts?: number;
  normalized_power_watts?: number;
  avg_hr?: number;
  max_hr?: number;
  rpe?: number;
  distance_km?: number;
  elevation_m?: number;
  strength_exercises?: StrengthExercise[];
  impulse?: number;
  raw_data?: Record<string, unknown>;
  sub_sport?: string;
  sport_specific_data?: Record<string, unknown>;
  training_intention?: TrainingIntention;
  temperature_c?: number;
  humidity_pct?: number;
  altitude_m_env?: number;
  zone_distribution?: ZoneDistribution;
  perceived_difficulty?: number;
  how_felt?: string;
}

export interface StrengthExercise {
  name: string;
  sets: number;
  reps: number;
  load_kg: number;
  bar_velocity_ms?: number;
  rir: number;
}

export interface LabTest {
  id: string;
  athlete_id: string;
  test_date: string;
  test_type: string;
  vo2max: number | null;
  vlamax: number | null;
  cp_watts: number | null;
  ftp_watts: number | null;
  lactate_threshold_1_watts: number | null;
  lactate_threshold_2_watts: number | null;
  lactate_threshold_1_hr: number | null;
  lactate_threshold_2_hr: number | null;
  fat_max_watts: number | null;
  notes: string;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export interface LabTestInsert {
  athlete_id: string;
  test_date: string;
  test_type?: string;
  vo2max?: number;
  vlamax?: number;
  cp_watts?: number;
  ftp_watts?: number;
  lactate_threshold_1_watts?: number;
  lactate_threshold_2_watts?: number;
  lactate_threshold_1_hr?: number;
  lactate_threshold_2_hr?: number;
  fat_max_watts?: number;
  notes?: string;
  raw_data?: Record<string, unknown>;
}

export interface NutritionLog {
  id: string;
  athlete_id: string;
  log_date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  hydration_ml: number;
  sleep_hours: number;
  sleep_quality: number | null;
  notes: string;
  created_at: string;
}

export interface NutritionLogInsert {
  athlete_id: string;
  log_date: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  hydration_ml?: number;
  sleep_hours?: number;
  sleep_quality?: number;
  notes?: string;
}

export interface PerformanceSnapshot {
  id: string;
  athlete_id: string;
  snapshot_date: string;
  fitness: number;
  fatigue: number;
  form: number;
  recovery_ratio: number;
  tau_fitness_used: number | null;
  tau_fatigue_used: number | null;
  k_used: number | null;
  notes: string;
  created_at: string;
}

export interface PerformanceSnapshotInsert {
  athlete_id: string;
  snapshot_date: string;
  fitness: number;
  fatigue: number;
  form: number;
  recovery_ratio: number;
  tau_fitness_used?: number;
  tau_fatigue_used?: number;
  k_used?: number;
  notes?: string;
}

export interface HrvLog {
  id: string;
  athlete_id: string;
  log_date: string;
  rmssd: number | null;
  sdnn: number | null;
  hrv_score: number | null;
  morning_hr: number | null;
  notes: string | null;
  created_at: string;
}

export interface HrvLogInsert {
  athlete_id: string;
  log_date: string;
  rmssd?: number;
  sdnn?: number;
  hrv_score?: number;
  morning_hr?: number;
  notes?: string;
}

export interface BodyComposition {
  id: string;
  athlete_id: string;
  measured_at: string;
  weight_kg: number;
  fat_pct: number | null;
  lean_mass_kg: number | null;
  water_pct: number | null;
  muscle_mass_kg: number | null;
  method: string | null;
  notes: string | null;
  created_at: string;
}

export interface BodyCompositionInsert {
  athlete_id: string;
  measured_at: string;
  weight_kg: number;
  fat_pct?: number;
  lean_mass_kg?: number;
  water_pct?: number;
  muscle_mass_kg?: number;
  method?: string;
  notes?: string;
}

export interface ShareableLink {
  id: string;
  athlete_id: string;
  user_id: string;
  token: string;
  label: string;
  expires_at: string | null;
  include_nutrition: boolean;
  include_sessions: boolean;
  include_lab: boolean;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
}

export interface ShareableLinkInsert {
  athlete_id: string;
  user_id: string;
  token: string;
  label?: string;
  expires_at?: string;
  include_nutrition?: boolean;
  include_sessions?: boolean;
  include_lab?: boolean;
}

export interface TrainingBlock {
  id: string;
  athlete_id: string;
  block_type: 'base' | 'build' | 'peak' | 'taper' | 'recovery';
  start_date: string;
  end_date: string;
  target_focus: string;
  planned_impulse: number | null;
  notes: string;
  created_at: string;
}

export interface TrainingBlockInsert {
  athlete_id: string;
  block_type: 'base' | 'build' | 'peak' | 'taper' | 'recovery';
  start_date: string;
  end_date: string;
  target_focus?: string;
  planned_impulse?: number;
  notes?: string;
}

export interface RaceScheduleEntry {
  id: string;
  athlete_id: string;
  race_name: string;
  race_date: string;
  race_type: string;
  distance_km: number | null;
  goal_duration_min: number | null;
  priority: 'a' | 'b' | 'c';
  taper_start_date: string | null;
  taper_reduction_pct: number;
  notes: string;
  completed: boolean;
  actual_duration_min: number | null;
  result_notes: string | null;
  created_at: string;
}

export interface RaceScheduleInsert {
  athlete_id: string;
  race_name: string;
  race_date: string;
  race_type?: string;
  distance_km?: number;
  goal_duration_min?: number;
  priority?: 'a' | 'b' | 'c';
  taper_start_date?: string;
  taper_reduction_pct?: number;
  notes?: string;
}

export interface HealthHistoryEntry {
  id: string;
  athlete_id: string;
  event_date: string;
  event_type: 'injury' | 'illness' | 'surgery' | 'medication_start' | 'medication_end' | 'other';
  description: string;
  affected_systems: string[];
  recovery_expected_days: number | null;
  is_current: boolean;
  notes: string;
  created_at: string;
}

export interface HealthHistoryInsert {
  athlete_id: string;
  event_date: string;
  event_type: 'injury' | 'illness' | 'surgery' | 'medication_start' | 'medication_end' | 'other';
  description: string;
  affected_systems?: string[];
  recovery_expected_days?: number;
  is_current?: boolean;
  notes?: string;
}
