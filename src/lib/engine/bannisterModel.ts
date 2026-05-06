import type {
  DailyBannisterResult,
  EngineOutput,
  BannisterState,
  TauParameters,
  AdaptationTrend,
  PhysiologicalProfile,
  SportBreakdown,
} from './types';
import type { Session, NutritionLog } from '../database.types';
import { computeWarnings, computeRecommendations } from './warningLogic';
import {
  buildCompartmentTau,
  runMultiCompartmentModel,
  getCurrentMultiCompartmentState,
  sessionToCompartmentImpulse,
} from './multiCompartmentModel';
import { generatePredictiveCurve } from './predictiveModel';
import { computeSleepFatigueDecayModifier } from './environmentalModifiers';

export interface SessionPoint {
  date: string;
  impulse: number;
  sessionType?: string;
  rawData?: Record<string, unknown>;
}

export function runBannisterModel(
  sessions: SessionPoint[],
  tau: TauParameters,
  windowDays = 365,
  sleepMap?: Map<string, number>
): DailyBannisterResult[] {
  if (sessions.length === 0) return [];

  const sorted = [...sessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const startDate = new Date(sorted[0].date);
  startDate.setDate(startDate.getDate() - 7);
  const endDate = new Date();

  const allDates = generateDateRange(startDate, endDate);
  const impulseMap = buildImpulseMap(sorted);

  const results: DailyBannisterResult[] = [];
  let fitness = 0;
  let fatigue = 0;

  const limitedDates = allDates.slice(-windowDays);

  for (const date of limitedDates) {
    const dayImpulse = impulseMap.get(date) ?? 0;
    const sleepHours = sleepMap?.get(date);
    const sleepDecay = computeSleepFatigueDecayModifier(sleepHours);
    const adjustedTauFatigue = tau.tauFatigue / sleepDecay;

    fitness = fitness * Math.exp(-1 / tau.tauFitness) + dayImpulse;
    fatigue = fatigue * Math.exp(-1 / adjustedTauFatigue) + dayImpulse * tau.kMultiplier;

    results.push({
      date,
      fitness: r4(fitness),
      fatigue: r4(fatigue),
      form: r4(fitness - fatigue),
      recoveryRatio: r4(fitness > 0 ? fatigue / fitness : 0),
      impulse: dayImpulse,
      tauFitness: tau.tauFitness,
      tauFatigue: tau.tauFatigue,
      kMultiplier: tau.kMultiplier,
    });
  }

  return results;
}

export function computeEngineOutput(
  sessions: SessionPoint[],
  tau: TauParameters,
  profile?: PhysiologicalProfile,
  rawSessions?: Session[],
  nutritionLogs?: NutritionLog[]
): EngineOutput {
  const sleepMap = nutritionLogs
    ? new Map(nutritionLogs.map(n => [n.log_date, n.sleep_hours]))
    : undefined;

  const history = runBannisterModel(sessions, tau, 365, sleepMap);

  const cur = history.length > 0 ? history[history.length - 1] : null;

  const currentState: BannisterState = {
    fitness: cur?.fitness ?? 0,
    fatigue: cur?.fatigue ?? 0,
    form: cur?.form ?? 0,
    recoveryRatio: cur?.recoveryRatio ?? 0,
    tau,
  };

  const defaultProfile: PhysiologicalProfile = profile ?? {
    vo2max: 50, vlamax: 0.4, leanMassKg: 65, weightKg: 75,
    cpWatts: 250, maxHr: 185, restingHr: 50,
  };

  const compartmentTau = buildCompartmentTau(defaultProfile);

  const compartmentPoints = sessions.map(s => {
    const comp = sessionToCompartmentImpulse(s.sessionType ?? 'endurance', s.impulse, s.rawData);
    return { date: s.date, ...comp };
  });

  const compartmentHistory = runMultiCompartmentModel(compartmentPoints, compartmentTau, 365);
  const multiCompartment = getCurrentMultiCompartmentState(compartmentHistory, compartmentTau, defaultProfile);

  const warnings = computeWarnings(currentState, history, multiCompartment);
  const recommendations = computeRecommendations(currentState, history, multiCompartment, defaultProfile);
  const adaptationTrend = computeAdaptationTrend(history);
  const baselinePerformance = computeBaseline(history);
  const predictedPerformance = computePredicted(currentState.form, baselinePerformance);
  const performanceIndex = baselinePerformance > 0 ? (predictedPerformance / baselinePerformance) * 100 : 100;
  const predictedHistory = generatePredictiveCurve(history, tau, 28);
  const sportBreakdown = computeSportBreakdown(rawSessions ?? []);

  return {
    current: currentState,
    multiCompartment,
    history,
    compartmentHistory,
    warnings,
    recommendations,
    adaptationTrend,
    predictedPerformance: r2(predictedPerformance),
    predictedHistory,
    baselinePerformance: r2(baselinePerformance),
    performanceIndex: r2(performanceIndex),
    sportBreakdown,
    tau: compartmentTau,
  };
}

function computeAdaptationTrend(history: DailyBannisterResult[]): AdaptationTrend {
  if (history.length < 14) {
    return { direction: 'insufficient_data', fitnessChangeRate: 0, fatigueChangeRate: 0, weeklyTrend: 0, label: 'Insufficient data' };
  }

  const r7 = history.slice(-7);
  const p7 = history.slice(-14, -7);
  const rF = avg(r7.map(d => d.fitness));
  const pF = avg(p7.map(d => d.fitness));
  const rFat = avg(r7.map(d => d.fatigue));
  const pFat = avg(p7.map(d => d.fatigue));

  const fitnessChangeRate = pF > 0 ? (rF - pF) / pF : 0;
  const fatigueChangeRate = pFat > 0 ? (rFat - pFat) / pFat : 0;
  const weeklyTrend = fitnessChangeRate * 100;

  const direction: AdaptationTrend['direction'] = fitnessChangeRate > 0.02 ? 'improving' : fitnessChangeRate < -0.02 ? 'declining' : 'plateau';
  const label = direction === 'improving' ? 'Fitness accumulating' : direction === 'declining' ? 'Fitness declining – review load' : 'Stable – consider load variation';

  return { direction, fitnessChangeRate: r4(fitnessChangeRate), fatigueChangeRate: r4(fatigueChangeRate), weeklyTrend: r2(weeklyTrend), label };
}

function computeBaseline(history: DailyBannisterResult[]): number {
  if (history.length < 30) return history.length > 0 ? avg(history.map(d => d.fitness)) : 1;
  const sorted = [...history].sort((a, b) => b.fitness - a.fitness);
  return avg(sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.1))).map(d => d.fitness));
}

function computePredicted(form: number, baseline: number): number {
  if (baseline <= 0) return 0;
  return baseline * (1 + (form / baseline) * 0.3);
}

function computeSportBreakdown(sessions: Session[]): SportBreakdown {
  const entry = (types: string[]) => {
    const f = sessions.filter(s => types.includes(s.session_type));
    const t = f.reduce((s, ss) => s + ss.impulse, 0);
    return { sessions: f.length, totalImpulse: r3(t), avgImpulse: f.length > 0 ? r3(t / f.length) : 0 };
  };
  return {
    endurance: entry(['endurance']),
    strength: entry(['strength']),
    beachVolley: entry(['beach_volleyball']),
    running: entry(['running']),
    cycling: entry(['cycling']),
  };
}

function buildImpulseMap(sessions: SessionPoint[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sessions) map.set(s.date, (map.get(s.date) ?? 0) + s.impulse);
  return map;
}

function generateDateRange(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) { dates.push(current.toISOString().split('T')[0]); current.setDate(current.getDate() + 1); }
  return dates;
}

function avg(v: number[]): number { return v.length === 0 ? 0 : v.reduce((a, b) => a + b, 0) / v.length; }
function r4(v: number): number { return Math.round(v * 10000) / 10000; }
function r3(v: number): number { return Math.round(v * 1000) / 1000; }
function r2(v: number): number { return Math.round(v * 100) / 100; }
