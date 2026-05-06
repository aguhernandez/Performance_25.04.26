import type { Session } from '../database.types';

export interface PDCPoint {
  duration: number;
  power: number;
  date?: string;
  sessionId?: string;
}

export interface PDCModel {
  cp: number;
  wPrime: number;
  pMax: number;
  r2: number;
  points: PDCPoint[];
}

export interface MMPEntry {
  duration: number;
  power: number;
  date: string;
  sessionId: string;
}

export interface MMPProfile {
  points: MMPEntry[];
  periods: {
    label: string;
    days: number;
    points: MMPEntry[];
  }[];
}

const STANDARD_DURATIONS = [1, 2, 5, 10, 20, 30, 60, 120, 180, 300, 600, 1200, 1800, 3600, 5400, 7200];

export function extractMMP(sessions: Session[]): MMPProfile {
  const powerSessions = sessions.filter(
    s => (s.session_type === 'cycling' || s.session_type === 'endurance') &&
         s.avg_power_watts && s.duration_min > 0
  );

  const allPoints: MMPEntry[] = [];

  for (const session of powerSessions) {
    const durationSec = session.duration_min * 60;
    const power = session.normalized_power_watts ?? session.avg_power_watts ?? 0;
    if (power <= 0) continue;

    for (const dur of STANDARD_DURATIONS) {
      if (dur <= durationSec) {
        const estimatedPower = estimatePowerForDuration(power, durationSec, dur);
        if (estimatedPower > 0) {
          allPoints.push({
            duration: dur,
            power: Math.round(estimatedPower),
            date: session.session_date,
            sessionId: session.id,
          });
        }
      }
    }
  }

  const bestByDuration = new Map<number, MMPEntry>();
  for (const pt of allPoints) {
    const existing = bestByDuration.get(pt.duration);
    if (!existing || pt.power > existing.power) {
      bestByDuration.set(pt.duration, pt);
    }
  }

  const points = Array.from(bestByDuration.values()).sort((a, b) => a.duration - b.duration);

  const now = new Date();
  const periods = [
    { label: '30 days', days: 30 },
    { label: '90 days', days: 90 },
    { label: '180 days', days: 180 },
    { label: 'All time', days: 9999 },
  ].map(p => {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - p.days);
    const periodSessions = powerSessions.filter(s => new Date(s.session_date) >= cutoff);

    const periodPoints: MMPEntry[] = [];
    const periodBest = new Map<number, MMPEntry>();

    for (const session of periodSessions) {
      const durationSec = session.duration_min * 60;
      const power = session.normalized_power_watts ?? session.avg_power_watts ?? 0;
      if (power <= 0) continue;

      for (const dur of STANDARD_DURATIONS) {
        if (dur <= durationSec) {
          const estimatedPower = estimatePowerForDuration(power, durationSec, dur);
          if (estimatedPower > 0) {
            const entry: MMPEntry = {
              duration: dur,
              power: Math.round(estimatedPower),
              date: session.session_date,
              sessionId: session.id,
            };
            const existing = periodBest.get(dur);
            if (!existing || entry.power > existing.power) {
              periodBest.set(dur, entry);
            }
          }
        }
      }
    }

    periodPoints.push(...Array.from(periodBest.values()).sort((a, b) => a.duration - b.duration));
    return { label: p.label, days: p.days, points: periodPoints };
  });

  return { points, periods };
}

function estimatePowerForDuration(avgPower: number, totalDurationSec: number, targetDurSec: number): number {
  if (targetDurSec >= totalDurationSec) return avgPower;
  const ratio = Math.pow(totalDurationSec / targetDurSec, 0.07);
  return avgPower * ratio;
}

export function fitPDCModel(points: PDCPoint[], cpFromProfile?: number): PDCModel {
  if (points.length < 3) {
    const cp = cpFromProfile ?? 200;
    return {
      cp,
      wPrime: cp * 60 * 0.15,
      pMax: cp * 3,
      r2: 0,
      points,
    };
  }

  const validPoints = points.filter(p => p.duration >= 2 && p.duration <= 3600 && p.power > 0);
  if (validPoints.length < 3) {
    const cp = cpFromProfile ?? 200;
    return { cp, wPrime: cp * 60 * 0.15, pMax: cp * 3, r2: 0, points };
  }

  let bestCp = 0;
  let bestWPrime = 0;
  let bestR2 = -Infinity;

  for (let cp = 100; cp <= 600; cp += 2) {
    const wValues = validPoints.map(p => (p.power - cp) * p.duration);
    const wPrime = wValues.reduce((a, b) => a + b, 0) / wValues.length;
    if (wPrime <= 0) continue;

    const predicted = validPoints.map(p => cp + wPrime / p.duration);
    const actual = validPoints.map(p => p.power);
    const r2 = computeR2(actual, predicted);

    if (r2 > bestR2) {
      bestR2 = r2;
      bestCp = cp;
      bestWPrime = wPrime;
    }
  }

  if (cpFromProfile && Math.abs(bestCp - cpFromProfile) > 50) {
    bestCp = cpFromProfile;
    const wValues = validPoints.map(p => (p.power - bestCp) * p.duration);
    bestWPrime = Math.max(1000, wValues.reduce((a, b) => a + b, 0) / wValues.length);
  }

  const shortPoints = validPoints.filter(p => p.duration <= 10);
  const pMax = shortPoints.length > 0
    ? Math.max(...shortPoints.map(p => p.power))
    : bestCp * 3;

  return {
    cp: Math.round(bestCp),
    wPrime: Math.round(Math.max(0, bestWPrime)),
    pMax: Math.round(pMax),
    r2: Math.max(0, Math.min(1, bestR2)),
    points: validPoints,
  };
}

export function generatePDCCurve(model: PDCModel, durations = STANDARD_DURATIONS): PDCPoint[] {
  return durations.map(dur => ({
    duration: dur,
    power: Math.round(model.cp + model.wPrime / dur),
  }));
}

function computeR2(actual: number[], predicted: number[]): number {
  const mean = actual.reduce((a, b) => a + b, 0) / actual.length;
  const ssTot = actual.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
  const ssRes = actual.reduce((sum, v, i) => sum + Math.pow(v - predicted[i], 2), 0);
  return ssTot === 0 ? 0 : 1 - ssRes / ssTot;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export function getPowerZones(cp: number): { zone: number; name: string; min: number; max: number; color: string }[] {
  return [
    { zone: 1, name: 'Active Recovery', min: 0, max: Math.round(cp * 0.55), color: '#94a3b8' },
    { zone: 2, name: 'Endurance', min: Math.round(cp * 0.55), max: Math.round(cp * 0.75), color: '#22c55e' },
    { zone: 3, name: 'Tempo', min: Math.round(cp * 0.75), max: Math.round(cp * 0.90), color: '#f59e0b' },
    { zone: 4, name: 'Threshold', min: Math.round(cp * 0.90), max: Math.round(cp * 1.05), color: '#ef4444' },
    { zone: 5, name: 'VO2max', min: Math.round(cp * 1.05), max: Math.round(cp * 1.20), color: '#dc2626' },
    { zone: 6, name: 'Anaerobic', min: Math.round(cp * 1.20), max: Math.round(cp * 1.50), color: '#7f1d1d' },
    { zone: 7, name: 'Neuromuscular', min: Math.round(cp * 1.50), max: 9999, color: '#111827' },
  ];
}
