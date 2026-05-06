import type { DailyBannisterResult } from './types';

export interface InjuryRiskResult {
  score: number;
  level: 'low' | 'moderate' | 'high' | 'very_high';
  factors: InjuryRiskFactor[];
  primaryReason: string | null;
}

export interface InjuryRiskFactor {
  name: string;
  value: number;
  threshold: number;
  triggered: boolean;
  contribution: number;
}

export function computeInjuryRisk(
  history: DailyBannisterResult[],
  acwr: number
): InjuryRiskResult {
  if (history.length < 7) {
    return { score: 0, level: 'low', factors: [], primaryReason: null };
  }

  const factors: InjuryRiskFactor[] = [];

  const last7 = history.slice(-7);
  const prev7 = history.slice(-14, -7);
  const last7Total = last7.reduce((s, d) => s + d.impulse, 0);
  const prev7Total = prev7.reduce((s, d) => s + d.impulse, 0) || 1;
  const weeklyLoadIncrease = last7Total / prev7Total;

  factors.push({
    name: 'Weekly Load Increase',
    value: weeklyLoadIncrease,
    threshold: 1.3,
    triggered: weeklyLoadIncrease > 1.3,
    contribution: weeklyLoadIncrease > 1.5 ? 4 : weeklyLoadIncrease > 1.3 ? 2.5 : 0,
  });

  const acwrFactor: InjuryRiskFactor = {
    name: 'ACWR',
    value: acwr,
    threshold: 1.3,
    triggered: acwr > 1.3,
    contribution: acwr > 1.5 ? 4 : acwr > 1.3 ? 2 : 0,
  };
  factors.push(acwrFactor);

  const last4Weeks = history.slice(-28);
  const weeklyTotals: number[] = [];
  for (let w = 0; w < 4; w++) {
    const week = last4Weeks.slice(w * 7, (w + 1) * 7);
    weeklyTotals.push(week.reduce((s, d) => s + d.impulse, 0));
  }
  const weekMean = weeklyTotals.reduce((a, b) => a + b, 0) / 4;
  const weekStd = Math.sqrt(weeklyTotals.reduce((s, v) => s + Math.pow(v - weekMean, 2), 0) / 4);
  const monotony = weekMean > 0 ? weekStd / weekMean : 0;

  factors.push({
    name: 'Training Monotony',
    value: monotony,
    threshold: 0.3,
    triggered: monotony < 0.3 && weekMean > 0,
    contribution: (monotony < 0.15 && weekMean > 0) ? 2 : (monotony < 0.3 && weekMean > 0) ? 1 : 0,
  });

  const last5 = history.slice(-5);
  const hasRecovery = last5.some(d => d.impulse < 0.01);
  const consecutiveLoad = last5.filter(d => d.impulse > 0.05).length;

  factors.push({
    name: 'Consecutive Load Days',
    value: consecutiveLoad,
    threshold: 5,
    triggered: consecutiveLoad >= 5 && !hasRecovery,
    contribution: consecutiveLoad >= 5 && !hasRecovery ? 1.5 : 0,
  });

  const totalScore = factors.reduce((sum, f) => sum + f.contribution, 0);
  const normalizedScore = Math.min(10, totalScore);

  const level: InjuryRiskResult['level'] =
    normalizedScore >= 7 ? 'very_high' :
    normalizedScore >= 5 ? 'high' :
    normalizedScore >= 3 ? 'moderate' : 'low';

  const triggered = factors.filter(f => f.triggered).sort((a, b) => b.contribution - a.contribution);
  const primaryReason = triggered[0]?.name ?? null;

  return {
    score: Math.round(normalizedScore * 10) / 10,
    level,
    factors,
    primaryReason,
  };
}

export function getInjuryRiskColor(level: InjuryRiskResult['level']): string {
  switch (level) {
    case 'low': return '#22c55e';
    case 'moderate': return '#f59e0b';
    case 'high': return '#f97316';
    case 'very_high': return '#ef4444';
  }
}
