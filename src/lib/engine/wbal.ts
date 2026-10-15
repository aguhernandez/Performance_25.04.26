import type { CleanedSeries } from './powerAnalysis';

export interface WbalSummary {
  minWbalKj: number;
  minWbalPct: number;
  secondsBelow25: number;
}

export interface WbalSeriesPoint {
  t: number;
  wbalJ: number;
}

const KJ = 1000;

function tauW(cpWatts: number, watts: ArrayLike<number>): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < watts.length; i++) {
    const p = watts[i];
    if (p > 0 && p < cpWatts) {
      sum += p;
      n++;
    }
  }
  const dCp = Math.max(0, cpWatts - (n > 0 ? sum / n : 0));
  return 546 * Math.exp(-0.01 * dCp) + 316;
}

function runWbal(clean: CleanedSeries, cpWatts: number, wPrimeJ: number, sampleEveryS: number): {
  minJ: number;
  secondsBelow25: number;
  series: WbalSeriesPoint[];
} {
  const watts = clean.watts;
  const tau = tauW(cpWatts, watts);
  const decay = Math.exp(-sampleEveryS / tau);
  let expended = 0;
  let minJ = wPrimeJ;
  let secondsBelow25 = 0;
  const series: WbalSeriesPoint[] = [{ t: 0, wbalJ: wPrimeJ }];
  for (let i = 0; i < watts.length; i++) {
    const p = Math.max(0, watts[i]);
    expended = expended * decay + Math.max(0, p - cpWatts) * sampleEveryS;
    const wbal = Math.max(0, wPrimeJ - expended);
    if (wbal < minJ) minJ = wbal;
    if (wbal < 0.25 * wPrimeJ) secondsBelow25 += sampleEveryS;
    if ((i + 1) % sampleEveryS === 0) series.push({ t: i + 1, wbalJ: wbal });
  }
  return { minJ, secondsBelow25, series };
}

export function computeWbalSummary(
  clean: CleanedSeries,
  cpWatts: number,
  wPrimeJ: number
): WbalSummary {
  const { minJ, secondsBelow25 } = runWbal(clean, cpWatts, wPrimeJ, 1);
  return {
    minWbalKj: Math.round((minJ / KJ) * 100) / 100,
    minWbalPct: Math.round((minJ / wPrimeJ) * 1000) / 10,
    secondsBelow25,
  };
}

export function computeWbalSeries(
  clean: CleanedSeries,
  cpWatts: number,
  wPrimeJ: number
): WbalSeriesPoint[] {
  return runWbal(clean, cpWatts, wPrimeJ, 5).series;
}

export const DURABILITY_KJ_THRESHOLDS = [0, 1000, 2000] as const;
export const DURABILITY_DURATIONS_S = [300, 1200] as const;

export interface DurabilityInputRow {
  activity_id: string;
  athlete_id: string;
  date: string;
  kj_threshold: number;
  duration_s: number;
  watts: number;
}

export function computeDurabilityRows(
  clean: CleanedSeries,
  activityId: string,
  athleteId: string,
  date: string
): DurabilityInputRow[] {
  const watts = clean.watts;
  const cumJ = new Array<number>(watts.length);
  let acc = 0;
  for (let i = 0; i < watts.length; i++) {
    acc += Math.max(0, watts[i]);
    cumJ[i] = acc;
  }
  const totalKj = acc / KJ;
  const rows: DurabilityInputRow[] = [];
  for (const thresholdKj of DURABILITY_KJ_THRESHOLDS) {
    if (thresholdKj > 0 && totalKj < thresholdKj) continue;
    let start = 0;
    if (thresholdKj > 0) {
      const targetJ = thresholdKj * KJ;
      start = cumJ.findIndex(c => c >= targetJ);
      if (start < 0) continue;
    }
    for (const durationS of DURABILITY_DURATIONS_S) {
      if (watts.length - start < durationS) continue;
      let windowSum = 0;
      for (let i = start; i < start + durationS; i++) windowSum += Math.max(0, watts[i]);
      let best = windowSum;
      for (let s = start + 1; s + durationS <= watts.length; s++) {
        windowSum += Math.max(0, watts[s + durationS - 1]) - Math.max(0, watts[s - 1]);
        if (windowSum > best) best = windowSum;
      }
      rows.push({
        activity_id: activityId,
        athlete_id: athleteId,
        date,
        kj_threshold: thresholdKj,
        duration_s: durationS,
        watts: Math.round(best / durationS),
      });
    }
  }
  return rows;
}
