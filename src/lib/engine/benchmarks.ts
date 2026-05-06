import type { Athlete } from '../database.types';
import type { PDCModel } from './powerDurationCurve';

export interface BenchmarkPercentile {
  metric: string;
  value: number;
  percentile: number;
  label: string;
  category: string;
  unit: string;
}

export interface PopulationBenchmarks {
  sport: string;
  gender: 'male' | 'female' | 'unknown';
  metrics: BenchmarkPercentile[];
  overallPercentile: number;
  tier: 'elite' | 'competitive' | 'trained' | 'recreational' | 'beginner';
}

const CYCLING_MALE_BENCHMARKS = {
  vo2max: [30, 38, 45, 53, 60, 68, 75, 82],
  cpPerKg: [1.5, 2.0, 2.6, 3.2, 3.8, 4.4, 5.0, 5.8],
  ftpPerKg: [1.4, 1.9, 2.4, 3.0, 3.6, 4.2, 4.8, 5.5],
  wPrimeKj: [5, 8, 12, 16, 20, 25, 30, 38],
};

const CYCLING_FEMALE_BENCHMARKS = {
  vo2max: [28, 34, 40, 46, 52, 58, 64, 70],
  cpPerKg: [1.2, 1.7, 2.2, 2.7, 3.2, 3.8, 4.3, 4.9],
  ftpPerKg: [1.1, 1.6, 2.0, 2.5, 3.0, 3.6, 4.1, 4.7],
  wPrimeKj: [4, 6, 9, 12, 15, 19, 23, 28],
};

const RUNNING_MALE_BENCHMARKS = {
  vo2max: [32, 40, 47, 54, 61, 67, 73, 80],
  vdot: [28, 35, 42, 50, 57, 63, 69, 76],
};

const RUNNING_FEMALE_BENCHMARKS = {
  vo2max: [28, 35, 41, 47, 53, 58, 64, 70],
  vdot: [24, 30, 36, 43, 49, 55, 61, 67],
};

const PERCENTILE_LABELS = [5, 15, 30, 50, 70, 85, 95, 99];

function getPercentile(value: number, benchmarkArray: number[]): number {
  for (let i = benchmarkArray.length - 1; i >= 0; i--) {
    if (value >= benchmarkArray[i]) {
      return PERCENTILE_LABELS[i];
    }
  }
  return 1;
}

function getPercentileLabel(pct: number): string {
  if (pct >= 95) return 'Elite';
  if (pct >= 85) return 'Excellent';
  if (pct >= 70) return 'Good';
  if (pct >= 50) return 'Average';
  if (pct >= 30) return 'Below Average';
  if (pct >= 15) return 'Fair';
  return 'Developing';
}

function getTier(overallPct: number): PopulationBenchmarks['tier'] {
  if (overallPct >= 90) return 'elite';
  if (overallPct >= 70) return 'competitive';
  if (overallPct >= 50) return 'trained';
  if (overallPct >= 25) return 'recreational';
  return 'beginner';
}

export function computePopulationBenchmarks(
  athlete: Athlete,
  pdcModel?: PDCModel
): PopulationBenchmarks {
  const sport = athlete.sport?.toLowerCase() ?? 'cycling';
  const weightKg = athlete.weight_kg || 70;
  const vo2max = athlete.vo2max || 0;
  const cp = pdcModel?.cp ?? athlete.cp_watts ?? 0;
  const ftp = athlete.ftp_watts ?? cp;
  const wPrime = pdcModel?.wPrime ?? 0;

  const cpPerKg = weightKg > 0 ? cp / weightKg : 0;
  const ftpPerKg = weightKg > 0 ? ftp / weightKg : 0;
  const wPrimeKj = wPrime / 1000;

  const isMale = true;
  const gender = isMale ? 'male' : 'female';

  const metrics: BenchmarkPercentile[] = [];
  const percentiles: number[] = [];

  if (sport.includes('cycl') || sport.includes('endur')) {
    const bench = isMale ? CYCLING_MALE_BENCHMARKS : CYCLING_FEMALE_BENCHMARKS;

    if (vo2max > 0) {
      const pct = getPercentile(vo2max, bench.vo2max);
      percentiles.push(pct);
      metrics.push({
        metric: 'VO2max',
        value: vo2max,
        percentile: pct,
        label: getPercentileLabel(pct),
        category: 'Aerobic Capacity',
        unit: 'ml/kg/min',
      });
    }

    if (cpPerKg > 0) {
      const pct = getPercentile(cpPerKg, bench.cpPerKg);
      percentiles.push(pct);
      metrics.push({
        metric: 'CP / kg',
        value: Math.round(cpPerKg * 100) / 100,
        percentile: pct,
        label: getPercentileLabel(pct),
        category: 'Threshold Power',
        unit: 'W/kg',
      });
    }

    if (ftpPerKg > 0) {
      const pct = getPercentile(ftpPerKg, bench.ftpPerKg);
      percentiles.push(pct);
      metrics.push({
        metric: 'FTP / kg',
        value: Math.round(ftpPerKg * 100) / 100,
        percentile: pct,
        label: getPercentileLabel(pct),
        category: 'Functional Threshold',
        unit: 'W/kg',
      });
    }

    if (wPrimeKj > 0) {
      const pct = getPercentile(wPrimeKj, bench.wPrimeKj);
      percentiles.push(pct);
      metrics.push({
        metric: "W'",
        value: Math.round(wPrimeKj * 10) / 10,
        percentile: pct,
        label: getPercentileLabel(pct),
        category: 'Anaerobic Capacity',
        unit: 'kJ',
      });
    }
  } else if (sport.includes('run')) {
    const bench = isMale ? RUNNING_MALE_BENCHMARKS : RUNNING_FEMALE_BENCHMARKS;

    if (vo2max > 0) {
      const pct = getPercentile(vo2max, bench.vo2max);
      percentiles.push(pct);
      metrics.push({
        metric: 'VO2max',
        value: vo2max,
        percentile: pct,
        label: getPercentileLabel(pct),
        category: 'Aerobic Capacity',
        unit: 'ml/kg/min',
      });
    }

    const vdot = athlete.vo2max ?? 0;
    if (vdot > 0) {
      const pct = getPercentile(vdot, bench.vdot);
      percentiles.push(pct);
      metrics.push({
        metric: 'VDOT',
        value: vdot,
        percentile: pct,
        label: getPercentileLabel(pct),
        category: 'Running Performance',
        unit: '',
      });
    }
  }

  if (metrics.length === 0) {
    if (vo2max > 0) {
      const refBench = isMale ? CYCLING_MALE_BENCHMARKS.vo2max : CYCLING_FEMALE_BENCHMARKS.vo2max;
      const pct = getPercentile(vo2max, refBench);
      percentiles.push(pct);
      metrics.push({
        metric: 'VO2max',
        value: vo2max,
        percentile: pct,
        label: getPercentileLabel(pct),
        category: 'Aerobic Capacity',
        unit: 'ml/kg/min',
      });
    }
  }

  const overallPercentile = percentiles.length > 0
    ? Math.round(percentiles.reduce((a, b) => a + b, 0) / percentiles.length)
    : 0;

  return {
    sport,
    gender,
    metrics,
    overallPercentile,
    tier: getTier(overallPercentile),
  };
}

export function getFTPHistory(labTests: import('../database.types').LabTest[]): { date: string; ftp: number; cp: number; source: string }[] {
  const history: { date: string; ftp: number; cp: number; source: string }[] = [];

  for (const test of labTests) {
    if (test.ftp_watts || test.cp_watts) {
      history.push({
        date: test.test_date,
        ftp: test.ftp_watts ?? test.cp_watts ?? 0,
        cp: test.cp_watts ?? test.ftp_watts ?? 0,
        source: test.test_type || 'Lab Test',
      });
    }
  }

  return history.sort((a, b) => a.date.localeCompare(b.date));
}

export interface AthleteGoal {
  id: string;
  label: string;
  metric: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  targetDate?: string;
  progressPct: number;
  estimatedWeeksToTarget: number | null;
  weeklyImprovementRate: number;
  onTrack: boolean;
}

export function computeGoalProgress(
  label: string,
  metric: string,
  currentValue: number,
  targetValue: number,
  unit: string,
  historicalValues: { date: string; value: number }[],
  targetDate?: string
): AthleteGoal {
  const progressPct = targetValue > 0 ? Math.min(100, (currentValue / targetValue) * 100) : 0;

  let weeklyImprovementRate = 0;
  if (historicalValues.length >= 2) {
    const sorted = [...historicalValues].sort((a, b) => a.date.localeCompare(b.date));
    const oldest = sorted[0];
    const newest = sorted[sorted.length - 1];
    const daysDiff = Math.max(1, (new Date(newest.date).getTime() - new Date(oldest.date).getTime()) / (1000 * 60 * 60 * 24));
    const weeksDiff = daysDiff / 7;
    weeklyImprovementRate = weeksDiff > 0 ? (newest.value - oldest.value) / weeksDiff : 0;
  }

  let estimatedWeeksToTarget: number | null = null;
  if (weeklyImprovementRate > 0 && currentValue < targetValue) {
    estimatedWeeksToTarget = Math.ceil((targetValue - currentValue) / weeklyImprovementRate);
  }

  let onTrack = false;
  if (targetDate && estimatedWeeksToTarget !== null) {
    const weeksToDeadline = Math.ceil((new Date(targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7));
    onTrack = estimatedWeeksToTarget <= weeksToDeadline;
  } else if (estimatedWeeksToTarget !== null) {
    onTrack = estimatedWeeksToTarget <= 52;
  }

  return {
    id: `${metric}-goal`,
    label,
    metric,
    targetValue,
    currentValue,
    unit,
    targetDate,
    progressPct: Math.round(progressPct * 10) / 10,
    estimatedWeeksToTarget,
    weeklyImprovementRate: Math.round(weeklyImprovementRate * 100) / 100,
    onTrack,
  };
}
