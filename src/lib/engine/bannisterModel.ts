import type { Athlete, Session } from '../database.types';
import type { EngineOutput, BannisterState, AdaptationTrend, SportBreakdown, TauParameters, DailyBannisterResult } from './types';
import { computeWarnings, computeRecommendations } from './warningLogic';
import {
  buildCompartmentTau,
  runMultiCompartmentModel,
  getCurrentMultiCompartmentState,
  sessionToCompartmentImpulse,
} from './multiCompartmentModel';
import { generatePredictiveCurve } from './predictiveModel';
import {
  computeSessionImpulse,
  groupByDay,
  effectiveDailyImpulse,
  athleteTau,
  resolveThresholds,
  FORMULA_VERSION,
} from './impulse';
import type { CpModelOverride } from './impulse';

export const SEED_WINDOW_DAYS = 28;
export const WARM_UP_DAYS = 120;
export const READ_WINDOW_DAYS = 365;

export interface DailyEngineDay extends DailyBannisterResult {
  rampRate: number;
  isWarmUp: boolean;
  formulaVersion: number;
}

export interface EngineContext {
  includeStrength: boolean;
  startFitness?: number;
  startFatigue?: number;
  cpModel?: CpModelOverride;
}

export function runBannisterModel(
  sessions: Session[],
  athlete: Athlete,
  context: EngineContext
): { history: DailyEngineDay[]; tau: TauParameters } {
  const tau = athleteTau(athlete);
  if (sessions.length === 0) return { history: [], tau };

  const thresholds = resolveThresholds(athlete, context.cpModel);
  const rows = sessions.map(s => computeSessionImpulse(s, thresholds));
  const daily = groupByDay(rows);

  const sorted = [...sessions]
    .map(s => s.session_date)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const firstDate = new Date(sorted[0]);
  const endDate = new Date();

  const allDates: string[] = [];
  const cursor = new Date(firstDate);
  while (cursor <= endDate) {
    allDates.push(cursor.toISOString().split('T')[0]);
    cursor.setDate(cursor.getDate() + 1);
  }
  const limitedDates = allDates.slice(-READ_WINDOW_DAYS);

  const seedDates = limitedDates.slice(0, SEED_WINDOW_DAYS);
  const seedSum = seedDates.reduce(
    (sum, d) => sum + (daily.get(d) ? effectiveDailyImpulse(daily.get(d)!, context.includeStrength) : 0),
    0
  );
  const meanDailyImpulse = seedDates.length > 0 ? seedSum / seedDates.length : 0;

  let fitness = context.startFitness ?? meanDailyImpulse;
  let fatigue = context.startFatigue ?? meanDailyImpulse;

  const history: DailyEngineDay[] = [];
  const warmUpCutoff = limitedDates.length - WARM_UP_DAYS;

  for (let i = SEED_WINDOW_DAYS; i < limitedDates.length; i++) {
    const date = limitedDates[i];
    const day = daily.get(date);
    const dayImpulse = day ? effectiveDailyImpulse(day, context.includeStrength) : 0;

    fitness = fitness + (dayImpulse - fitness) * (1 - Math.exp(-1 / tau.tauFitness));
    fatigue = fatigue + (dayImpulse - fatigue) * (1 - Math.exp(-1 / tau.tauFatigue));

    const rampStart = Math.max(0, i - 7);
    const rampFitness = history.length >= 7
      ? history[history.length - 7].fitness
      : fitness;

    history.push({
      date,
      fitness: r4(fitness),
      fatigue: r4(fatigue),
      form: r4(fitness - fatigue),
      recoveryRatio: r4(fitness > 0 ? fatigue / fitness : 0),
      impulse: r4(dayImpulse),
      tauFitness: tau.tauFitness,
      tauFatigue: tau.tauFatigue,
      rampRate: r4(fitness - rampFitness),
      isWarmUp: i < warmUpCutoff,
      formulaVersion: FORMULA_VERSION,
    });
  }

  return { history, tau };
}

export function computeEngineOutput(
  sessions: Session[],
  athlete: Athlete,
  context: EngineContext
): EngineOutput {
  const { history, tau } = runBannisterModel(sessions, athlete, context);
  const cur = history.length > 0 ? history[history.length - 1] : null;

  const currentState: BannisterState = {
    fitness: cur?.fitness ?? 0,
    fatigue: cur?.fatigue ?? 0,
    form: cur?.form ?? 0,
    recoveryRatio: cur?.recoveryRatio ?? 0,
    tau,
  };

  const profile = {
    vo2max: athlete.vo2max ?? 50,
    vlamax: athlete.vlamax ?? 0.4,
    leanMassKg: athlete.lean_mass_kg ?? 65,
    weightKg: athlete.weight_kg ?? 75,
    cpWatts: athlete.cp_watts ?? 250,
    maxHr: athlete.max_hr ?? 185,
    restingHr: athlete.resting_hr ?? 50,
  };

  const compartmentTau = buildCompartmentTau(profile);

  const thresholds = resolveThresholds(athlete, context.cpModel);
  const compartmentPoints = sessions.map(s => {
    const row = computeSessionImpulse(s, thresholds);
    const comp = sessionToCompartmentImpulse(row.sport, row.impulse, undefined);
    return { date: row.date, ...comp };
  });

  const compartmentHistory = runMultiCompartmentModel(compartmentPoints, compartmentTau, READ_WINDOW_DAYS);
  const multiCompartment = getCurrentMultiCompartmentState(compartmentHistory, compartmentTau, profile);

  const warnings = computeWarnings(currentState, history, multiCompartment);
  const recommendations = computeRecommendations(currentState, history, multiCompartment, profile);
  const adaptationTrend = computeAdaptationTrend(history);
  const baselinePerformance = computeBaseline(history);
  const predictedPerformance = computePredicted(currentState.form, baselinePerformance);
  const performanceIndex = baselinePerformance > 0 ? (predictedPerformance / baselinePerformance) * 100 : 100;
  const predictedHistory = generatePredictiveCurve(history, tau, 28);
  const sportBreakdown = computeSportBreakdown(sessions, thresholds);

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

function computeAdaptationTrend(history: DailyEngineDay[]): AdaptationTrend {
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

function computeBaseline(history: DailyEngineDay[]): number {
  if (history.length < 30) return history.length > 0 ? avg(history.map(d => d.fitness)) : 1;
  const sorted = [...history].sort((a, b) => b.fitness - a.fitness);
  return avg(sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.1))).map(d => d.fitness));
}

function computePredicted(form: number, baseline: number): number {
  if (baseline <= 0) return 0;
  return baseline * (1 + (form / baseline) * 0.3);
}

function computeSportBreakdown(sessions: Session[], thresholds: ReturnType<typeof resolveThresholds>): SportBreakdown {
  const rows = sessions.map(s => computeSessionImpulse(s, thresholds));
  const entry = (sport: string) => {
    const f = rows.filter(r => r.sport === sport);
    const t = f.reduce((sum, r) => sum + r.impulse, 0);
    return { sessions: f.length, totalImpulse: r3(t), avgImpulse: f.length > 0 ? r3(t / f.length) : 0 };
  };
  return {
    endurance: entry('endurance'),
    strength: entry('strength'),
    beachVolley: entry('beach_volleyball'),
    running: entry('running'),
    cycling: entry('cycling'),
  };
}

function avg(v: number[]): number { return v.length === 0 ? 0 : v.reduce((a, b) => a + b, 0) / v.length; }
function r4(v: number): number { return Math.round(v * 10000) / 10000; }
function r3(v: number): number { return Math.round(v * 1000) / 1000; }
function r2(v: number): number { return Math.round(v * 100) / 100; }
