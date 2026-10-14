import type { Session } from '../database.types';

export interface PDCPoint {
  duration: number;
  power: number;
  date?: string;
  sessionId?: string;
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

const PERIOD_DURATIONS = [1, 5, 10, 15, 30, 60, 120, 180, 300, 480, 600, 720, 900, 1200, 1800, 2700, 3600];

/**
 * Build MMP profile ONLY from real stream-derived points (activity_mmp rows).
 * There is no extrapolation: an activity without a power stream contributes
 * no points.
 */
export function extractMMPFromRows(
  rows: { duration_s: number; watts: number; date: string; activity_id: string }[]
): MMPProfile {
  const bestByDuration = new Map<number, MMPEntry>();
  for (const r of rows) {
    const existing = bestByDuration.get(r.duration_s);
    if (!existing || r.watts > existing.power) {
      bestByDuration.set(r.duration_s, {
        duration: r.duration_s,
        power: Math.round(r.watts),
        date: r.date,
        sessionId: r.activity_id,
      });
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
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const periodBest = new Map<number, MMPEntry>();
    for (const r of rows) {
      if (r.date < cutoffStr) continue;
      const existing = periodBest.get(r.duration_s);
      if (!existing || r.watts > existing.power) {
        periodBest.set(r.duration_s, {
          duration: r.duration_s,
          power: Math.round(r.watts),
          date: r.date,
          sessionId: r.activity_id,
        });
      }
    }

    return {
      label: p.label,
      days: p.days,
      points: Array.from(periodBest.values()).sort((a, b) => a.duration - b.duration),
    };
  });

  return { points, periods };
}

/**
 * Extract MMP profile from sessions that carry pre-computed stream metrics in
 * raw_data (written by ingestion). Sessions without raw_data.power_mmp are
 * skipped — no average-power extrapolation.
 */
export function extractMMP(sessions: Session[]): MMPProfile {
  const rows: { duration_s: number; watts: number; date: string; activity_id: string }[] = [];

  for (const s of sessions) {
    const raw = s.raw_data as { power_mmp?: { duration_s: number; watts: number }[] } | null;
    if (!raw?.power_mmp) continue;
    for (const pt of raw.power_mmp) {
      rows.push({
        duration_s: pt.duration_s,
        watts: pt.watts,
        date: s.session_date,
        activity_id: s.id,
      });
    }
  }

  return extractMMPFromRows(rows);
}

export function generatePDCCurve(model: { cp: number; wPrime: number }, durations: number[] = PERIOD_DURATIONS): PDCPoint[] {
  return durations.map(dur => ({
    duration: dur,
    power: Math.round(model.cp + model.wPrime / dur),
  }));
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
    { zone: 4, name: 'Threshold', min: Math.round(cp * 0.90), max: Math.round(cp * 1.05), color: '#f59e0b' },
    { zone: 5, name: 'VO2max', min: Math.round(cp * 1.05), max: Math.round(cp * 1.20), color: '#ef4444' },
    { zone: 6, name: 'Anaerobic', min: Math.round(cp * 1.20), max: Math.round(cp * 1.50), color: '#dc2626' },
    { zone: 7, name: 'Neuromuscular', min: Math.round(cp * 1.50), max: 9999, color: '#111827' },
  ];
}
