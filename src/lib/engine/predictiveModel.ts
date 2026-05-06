import type { DailyBannisterResult, PredictedPoint, TauParameters } from './types';

const DEFAULT_PLANNED_IMPULSE = 0.15;

export function generatePredictiveCurve(
  currentHistory: DailyBannisterResult[],
  tau: TauParameters,
  daysAhead = 28,
  plannedImpulsePerDay?: number
): PredictedPoint[] {
  if (currentHistory.length === 0) return [];

  const last = currentHistory[currentHistory.length - 1];
  let fitness = last.fitness;
  let fatigue = last.fatigue;

  const recentAvgImpulse = computeRecentAvgImpulse(currentHistory, 14);
  const plannedImpulse = plannedImpulsePerDay ?? recentAvgImpulse * 0.8;

  const points: PredictedPoint[] = [];
  const startDate = new Date(last.date);

  for (let i = 1; i <= daysAhead; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    const isTrainingDay = isTypicalTrainingDay(date);
    const impulse = isTrainingDay ? plannedImpulse : 0;

    fitness = fitness * Math.exp(-1 / tau.tauFitness) + impulse;
    fatigue = fatigue * Math.exp(-1 / tau.tauFatigue) + impulse * tau.kMultiplier;

    points.push({
      date: date.toISOString().split('T')[0],
      fitness: r4(fitness),
      fatigue: r4(fatigue),
      form: r4(fitness - fatigue),
      predicted: true,
    });
  }

  return points;
}

export function generateTaperPrediction(
  currentHistory: DailyBannisterResult[],
  tau: TauParameters,
  taperStartDays: number,
  taperReductionPct: number,
  raceDay: number
): PredictedPoint[] {
  if (currentHistory.length === 0) return [];

  const last = currentHistory[currentHistory.length - 1];
  let fitness = last.fitness;
  let fatigue = last.fatigue;

  const recentAvgImpulse = computeRecentAvgImpulse(currentHistory, 14);
  const points: PredictedPoint[] = [];
  const startDate = new Date(last.date);

  for (let i = 1; i <= raceDay; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    let impulse = 0;
    if (i <= taperStartDays) {
      impulse = isTypicalTrainingDay(date) ? recentAvgImpulse : 0;
    } else {
      const taperFraction = 1 - (taperReductionPct / 100);
      impulse = isTypicalTrainingDay(date) ? recentAvgImpulse * taperFraction : 0;
    }

    fitness = fitness * Math.exp(-1 / tau.tauFitness) + impulse;
    fatigue = fatigue * Math.exp(-1 / tau.tauFatigue) + impulse * tau.kMultiplier;

    points.push({
      date: date.toISOString().split('T')[0],
      fitness: r4(fitness),
      fatigue: r4(fatigue),
      form: r4(fitness - fatigue),
      predicted: true,
    });
  }

  return points;
}

export function findOptimalPeakWindow(
  history: DailyBannisterResult[],
  tau: TauParameters
): { date: string; form: number; daysFromNow: number } | null {
  const predicted = generatePredictiveCurve(history, tau, 42);
  if (predicted.length === 0) return null;

  const best = predicted.reduce((prev, curr) => curr.form > prev.form ? curr : prev);
  const today = new Date();
  const peakDate = new Date(best.date);
  const daysFromNow = Math.round((peakDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return { date: best.date, form: best.form, daysFromNow };
}

function computeRecentAvgImpulse(
  history: DailyBannisterResult[],
  days: number
): number {
  const recent = history.slice(-days);
  const nonZero = recent.filter(d => d.impulse > 0);
  if (nonZero.length === 0) return DEFAULT_PLANNED_IMPULSE;
  return nonZero.reduce((sum, d) => sum + d.impulse, 0) / nonZero.length;
}

function isTypicalTrainingDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0;
}

function r4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
