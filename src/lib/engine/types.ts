import type { Athlete, Session, NutritionLog } from '../database.types';

export interface PhysiologicalProfile {
  vo2max: number;
  vlamax: number;
  leanMassKg: number;
  weightKg: number;
  cpWatts: number;
  maxHr: number;
  restingHr: number;
  hrvBaseline?: number;
  bodyFatPct?: number;
  jumpHeightCm?: number;
  runVdot?: number;
}

export interface TauParameters {
  tauFitness: number;
  tauFatigue: number;
  kMultiplier: number;
}

export interface CompartmentTau {
  aerobic: TauParameters;
  glycolytic: TauParameters;
  neuromuscular: TauParameters;
}

export interface CompartmentState {
  fitness: number;
  fatigue: number;
  form: number;
}

export interface MultiCompartmentState {
  aerobic: CompartmentState;
  glycolytic: CompartmentState;
  neuromuscular: CompartmentState;
  total: CompartmentState;
  weights: { aerobic: number; glycolytic: number; neuromuscular: number };
}

export interface DailyCompartmentResult {
  date: string;
  aerobic: CompartmentState;
  glycolytic: CompartmentState;
  neuromuscular: CompartmentState;
  total: CompartmentState;
  impulse: { aerobic: number; glycolytic: number; neuromuscular: number; total: number };
}

export interface BeachVolleyballData {
  jumpCount: number;
  jumpHeightCm?: number;
  sprintCount: number;
  avgSprintDistanceM?: number;
  rallyDurationMin: number;
  accelerationCount?: number;
  avgHr?: number;
  rpe?: number;
}

export interface EnduranceImpulseInput {
  durationMin: number;
  avgPowerWatts?: number;
  normalizedPowerWatts?: number;
  avgHr?: number;
  cpWatts: number;
  maxHr: number;
  restingHr: number;
  rpe?: number;
}

export interface StrengthExerciseInput {
  name: string;
  sets: number;
  reps: number;
  loadKg: number;
  barVelocityMs?: number;
  rir: number;
}

export interface StrengthImpulseInput {
  exercises: StrengthExerciseInput[];
  durationMin?: number;
}

export interface DailyImpulseInput {
  date: string;
  enduranceSessions: EnduranceImpulseInput[];
  strengthSessions: StrengthImpulseInput[];
  otherImpulse?: number;
  sportWeights: {
    endurance: number;
    strength: number;
    other: number;
  };
  nutrition?: NutritionModifier;
}

export interface NutritionModifier {
  calorieBalance?: number;
  proteinGrams?: number;
  proteinPerKg?: number;
  carbsGrams?: number;
  fatGrams?: number;
  sleepHours?: number;
  sleepQuality?: number;
  energyAvailability?: number;
  complianceScore?: number;
}

export interface NutritionComplianceResult {
  energyAvailability: number;
  proteinAdherence: number;
  carbAdherence: number;
  fatAdherence: number;
  overallCompliance: number;
  recoveryScore: number;
  recommendation: string;
  deficit: boolean;
  excess: boolean;
}

export interface SessionImpulse {
  date: string;
  impulse: number;
  sessionId?: string;
  sessionType: 'endurance' | 'strength' | 'other' | 'beach_volleyball' | 'running' | 'cycling';
  compartmentImpulse: { aerobic: number; glycolytic: number; neuromuscular: number };
  breakdown: {
    rawImpulse: number;
    modifier: number;
    final: number;
  };
}

export interface BannisterState {
  fitness: number;
  fatigue: number;
  form: number;
  recoveryRatio: number;
  tau: TauParameters;
}

export interface DailyBannisterResult {
  date: string;
  fitness: number;
  fatigue: number;
  form: number;
  recoveryRatio: number;
  impulse: number;
  tauFitness: number;
  tauFatigue: number;
  kMultiplier: number;
}

export interface EngineOutput {
  current: BannisterState;
  multiCompartment: MultiCompartmentState;
  history: DailyBannisterResult[];
  compartmentHistory: DailyCompartmentResult[];
  warnings: EngineWarning[];
  recommendations: EngineRecommendation[];
  adaptationTrend: AdaptationTrend;
  predictedPerformance: number;
  predictedHistory: PredictedPoint[];
  baselinePerformance: number;
  performanceIndex: number;
  sportBreakdown: SportBreakdown;
  tau: CompartmentTau;
}

export interface PredictedPoint {
  date: string;
  fitness: number;
  fatigue: number;
  form: number;
  predicted: true;
}

export interface SportBreakdown {
  endurance: { sessions: number; totalImpulse: number; avgImpulse: number };
  strength: { sessions: number; totalImpulse: number; avgImpulse: number };
  beachVolley: { sessions: number; totalImpulse: number; avgImpulse: number };
  running: { sessions: number; totalImpulse: number; avgImpulse: number };
  cycling: { sessions: number; totalImpulse: number; avgImpulse: number };
}

export interface EngineWarning {
  type: 'overreaching' | 'underload' | 'acute_fatigue' | 'stagnation' | 'nutrition_deficit' | 'nutrition_excess' | 'hrv_suppression' | 'compartment_imbalance';
  severity: 'low' | 'medium' | 'high';
  message: string;
  value: number;
  threshold: number;
}

export interface EngineRecommendation {
  category: 'load' | 'recovery' | 'nutrition' | 'training' | 'testing';
  priority: 'low' | 'medium' | 'high';
  title: string;
  detail: string;
  actionable: string;
}

export interface AdaptationTrend {
  direction: 'improving' | 'declining' | 'plateau' | 'insufficient_data';
  fitnessChangeRate: number;
  fatigueChangeRate: number;
  weeklyTrend: number;
  label: string;
}

export interface WeeklyLoadEntry {
  weekStart: string;
  totalImpulse: number;
  sessionCount: number;
  byType: Record<string, number>;
}

export { Athlete, Session, NutritionLog };
