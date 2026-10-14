export interface PowerStream {
  /** seconds between samples as recorded; resampling normalizes to 1 Hz */
  times: number[];
  watts: (number | null)[];
}

export interface CleanedSeries {
  watts: number[];
  totalSeconds: number;
  missingPct: number;
  hasPower: boolean;
}

export interface SessionPowerStats {
  avgWatts: number;
  np: number;
  vi: number;
  totalSeconds: number;
  missingPct: number;
}

export interface MmpPoint {
  durationS: number;
  watts: number;
}

export const MEAN_MAX_DURATIONS = [
  1, 5, 10, 15, 30, 60, 120, 180, 300, 480, 600, 720, 900, 1200, 1800, 2700, 3600,
];

export const MIN_STREAM_SECONDS = 300;
export const MAX_MISSING_PCT = 0.20;
export const MAX_INTERPOLATION_GAP = 5;

/**
 * Resample a raw power stream to 1 Hz. Gaps ≤ 5 s are linearly interpolated;
 * gaps > 5 s count as 0 W (coasting). Returns null when the activity has no
 * usable power data.
 */
export function cleanPowerStream(stream: PowerStream): CleanedSeries | null {
  const { times, watts } = stream;
  if (times.length === 0 || watts.length !== times.length) return null;

  const t0 = times[0];
  const tEnd = times[times.length - 1];
  if (tEnd <= t0) return null;

  const out: number[] = [];
  let missing = 0;
  let total = 0;

  for (let t = t0; t <= tEnd; t++) {
    const value = sampleAt(times, watts, t, t0, tEnd);
    if (value === null) {
      missing++;
    } else {
      out.push(value);
    }
    total++;
  }

  if (total === 0) return null;
  const missingPct = missing / total;

  return {
    watts: out,
    totalSeconds: total,
    missingPct,
    // "power" here means present samples; the ≥5 min requirement is checked
    // against samples with real (non-zero) watts in computePowerStats
    hasPower: missingPct <= MAX_MISSING_PCT,
  };
}

function sampleAt(
  times: number[],
  watts: (number | null)[],
  t: number,
  t0: number,
  tEnd: number
): number | null {
  if (t < times[0] || t > tEnd) return null;

  // Exact or bracketing samples
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] < t) lo = mid + 1;
    else hi = mid;
  }

  if (times[lo] === t) {
    const w = watts[lo];
    return w === null ? null : w;
  }

  const prevIdx = lo - 1;
  if (prevIdx < 0) return null;
  const tPrev = times[prevIdx];
  const tNext = times[lo];
  const gap = tNext - tPrev;

  const wPrev = watts[prevIdx];
  const wNext = watts[lo];

  if (wPrev === null || wNext === null) return null;
  if (gap > MAX_INTERPOLATION_GAP) return 0;

  const frac = (t - tPrev) / gap;
  return wPrev + (wNext - wPrev) * frac;
}

export function computePowerStats(clean: CleanedSeries): SessionPowerStats | null {
  if (!clean.hasPower) return null;

  const n = clean.watts.length;
  if (n < MIN_STREAM_SECONDS) return null;

  let sum = 0;
  let secondsWithPower = 0;
  for (const w of clean.watts) {
    sum += w;
    if (w > 0) secondsWithPower++;
  }
  if (secondsWithPower < MIN_STREAM_SECONDS) return null;

  const avg = sum / n;
  const np = computeNp(clean.watts);

  return {
    avgWatts: Math.round(avg),
    np: Math.round(np),
    vi: avg > 0 ? Math.round((np / avg) * 100) / 100 : 0,
    totalSeconds: clean.totalSeconds,
    missingPct: clean.missingPct,
  };
}

/**
 * Normalized Power: 30 s rolling mean → raise each to the 4th power →
 * mean → 4th root.
 */
export function computeNp(watts: number[]): number {
  const n = watts.length;
  if (n === 0) return 0;
  if (n < 30) {
    let sum = 0;
    for (const w of watts) sum += w;
    return sum / n;
  }

  const rolling = rollingMean(watts, 30);
  let sum = 0;
  for (const m of rolling) {
    sum += Math.pow(m, 4);
  }
  return Math.pow(sum / rolling.length, 0.25);
}

function rollingMean(values: number[], window: number): number[] {
  const out: number[] = [];
  let windowSum = 0;
  for (let i = 0; i < values.length; i++) {
    windowSum += values[i];
    if (i >= window) windowSum -= values[i - window];
    if (i >= window - 1) out.push(windowSum / window);
  }
  return out;
}

/**
 * Mean-maximal power for standard durations using a prefix-sum sliding
 * window. Durations longer than the activity are skipped.
 */
export function computeMeanMaxPower(clean: CleanedSeries): MmpPoint[] {
  const points: MmpPoint[] = [];
  const n = clean.watts.length;

  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + clean.watts[i];

  for (const dur of MEAN_MAX_DURATIONS) {
    if (dur > n) continue;
    let best = -Infinity;
    for (let start = 0; start + dur <= n; start++) {
      const avg = (prefix[start + dur] - prefix[start]) / dur;
      if (avg > best) best = avg;
    }
    if (best > 0) {
      points.push({ durationS: dur, watts: Math.round(best) });
    }
  }

  return points;
}

export interface CpRegression {
  cp: number;
  wPrimeJ: number;
  r2: number;
  seCp: number;
  nPoints: number;
  windowDays: number;
  status: 'ok' | 'insufficient_data';
  reason?: string;
}

export interface MmpInputPoint {
  durationS: number;
  watts: number;
  date: string;
  activityId: string;
}

export const CP_WINDOW_DAYS = 90;
export const CP_MIN_POINTS = 3;
export const CP_MIN_DURATION_S = 180;
export const CP_MAX_DURATION_S = 1800;
export const CP_MIN_LONGEST_RATIO = 2.5;
export const CP_MIN_LONG_POINT_S = 480;

export const CP_HIGH_R2 = 0.98;
export const CP_MEDIUM_R2 = 0.95;
export const CP_HIGH_WINDOW_DAYS = 90;
export const CP_HIGH_SE_W = 5;

/**
 * OLS fit of work = CP·t + W′ using athlete MMP points between 180–1800 s.
 * Returns status 'insufficient_data' (and no numbers) when requirements are
 * not met: ≥3 points, longest/shortest ≥ 2.5, at least one point ≥ 480 s.
 */
export function fitCpModel(
  points: MmpInputPoint[],
  today: Date = new Date()
): CpRegression {
  const inWindow = points.filter(p => {
    const age = (today.getTime() - new Date(p.date).getTime()) / 86400000;
    return age <= CP_WINDOW_DAYS;
  });

  const candidates = inWindow
    .filter(p => p.durationS >= CP_MIN_DURATION_S && p.durationS <= CP_MAX_DURATION_S)
    .sort((a, b) => a.durationS - b.durationS);

  if (candidates.length < CP_MIN_POINTS) {
    return { cp: 0, wPrimeJ: 0, r2: 0, seCp: 0, nPoints: candidates.length, windowDays: CP_WINDOW_DAYS, status: 'insufficient_data', reason: 'need_3_points_180_1800s' };
  }

  const shortest = candidates[0].durationS;
  const longest = candidates[candidates.length - 1].durationS;
  if (longest / shortest < CP_MIN_LONGEST_RATIO) {
    return { cp: 0, wPrimeJ: 0, r2: 0, seCp: 0, nPoints: candidates.length, windowDays: CP_WINDOW_DAYS, status: 'insufficient_data', reason: 'duration_range_too_narrow' };
  }

  if (!candidates.some(p => p.durationS >= CP_MIN_LONG_POINT_S)) {
    return { cp: 0, wPrimeJ: 0, r2: 0, seCp: 0, nPoints: candidates.length, windowDays: CP_WINDOW_DAYS, status: 'insufficient_data', reason: 'need_point_480s_or_longer' };
  }

  // OLS on work = CP·t + W′ (work in joules, t in seconds)
  const n = candidates.length;
  let sumT = 0;
  let sumW = 0;
  let sumTT = 0;
  let sumTW = 0;
  for (const p of candidates) {
    const work = p.watts * p.durationS;
    sumT += p.durationS;
    sumW += work;
    sumTT += p.durationS * p.durationS;
    sumTW += p.durationS * work;
  }
  const denom = n * sumTT - sumT * sumT;
  if (denom === 0) {
    return { cp: 0, wPrimeJ: 0, r2: 0, seCp: 0, nPoints: n, windowDays: CP_WINDOW_DAYS, status: 'insufficient_data', reason: 'degenerate_fit' };
  }

  const cp = (n * sumTW - sumT * sumW) / denom;
  const wPrimeJ = (sumW - cp * sumT) / n;

  // R² and SE of CP on the work-vs-time regression
  const meanW = sumW / n;
  let ssTot = 0;
  let ssRes = 0;
  for (const p of candidates) {
    const work = p.watts * p.durationS;
    const predicted = cp * p.durationS + wPrimeJ;
    ssTot += Math.pow(work - meanW, 2);
    ssRes += Math.pow(work - predicted, 2);
  }
  const r2 = ssTot === 0 ? 0 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));

  const sigma2 = n > 2 ? ssRes / (n - 2) : 0;
  const seCp = sumTT === 0 ? 0 : Math.sqrt(sigma2 * n / denom);

  return {
    cp: Math.round(cp),
    wPrimeJ: Math.max(0, Math.round(wPrimeJ)),
    r2: Math.round(r2 * 10000) / 10000,
    seCp: Math.round(seCp * 10) / 10,
    nPoints: n,
    windowDays: CP_WINDOW_DAYS,
    status: 'ok',
  };
}

export type CpConfidence = 'high' | 'medium' | 'low';

export function cpConfidence(reg: CpRegression): CpConfidence | null {
  if (reg.status !== 'ok') return null;
  if (reg.r2 >= CP_HIGH_R2 && reg.windowDays <= CP_HIGH_WINDOW_DAYS && reg.seCp <= CP_HIGH_SE_W) return 'high';
  if (reg.r2 >= CP_MEDIUM_R2) return 'medium';
  return 'low';
}

export interface PerRideMetrics {
  ef: number | null;
  decouplingPct: number | null;
}

export const DECOUPLING_MIN_SECONDS = 3600;
export const DECOUPLING_MAX_VI = 1.10;

/**
 * Efficiency Factor (NP / avg HR) and cardiac decoupling for rides ≥ 60 min
 * with VI < 1.10.
 */
export function computePerRideMetrics(
  clean: CleanedSeries,
  hrStream: (number | null)[],
  stats: SessionPowerStats
): PerRideMetrics {
  const result: PerRideMetrics = { ef: null, decouplingPct: null };

  if (hrStream.length !== clean.watts.length) return result;

  const pairs: { w: number; hr: number }[] = [];
  for (let i = 0; i < clean.watts.length; i++) {
    const hr = hrStream[i];
    if (hr !== null && hr > 0 && clean.watts[i] > 0) {
      pairs.push({ w: clean.watts[i], hr });
    }
  }
  if (pairs.length === 0) return result;

  const np = computeNp(pairs.map(p => p.w));
  const avgHr = pairs.reduce((a, p) => a + p.hr, 0) / pairs.length;
  if (avgHr <= 0) return result;

  result.ef = Math.round((np / avgHr) * 1000) / 1000;

  const half = Math.floor(pairs.length / 2);
  if (stats.totalSeconds >= DECOUPLING_MIN_SECONDS && stats.vi < DECOUPLING_MAX_VI && half > 0) {
    const efOf = (slice: { w: number; hr: number }[]): number => {
      const sliceNp = computeNp(slice.map(p => p.w));
      const sliceHr = slice.reduce((a, p) => a + p.hr, 0) / slice.length;
      return sliceHr > 0 ? sliceNp / sliceHr : 0;
    };
    const efFirst = efOf(pairs.slice(0, half));
    const efSecond = efOf(pairs.slice(half));
    if (efFirst > 0) {
      result.decouplingPct = Math.round(((efFirst - efSecond) / efFirst) * 10000) / 100;
    }
  }

  return result;
}
