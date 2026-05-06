import type { Session } from '../database.types';
import type { Athlete } from '../database.types';

export interface TSSEntry {
  date: string;
  sessionId: string;
  sessionType: string;
  tss: number;
  tssType: 'pTSS' | 'hrTSS' | 'rTSS' | 'sTSS' | 'bvTSS';
  intensity: number;
  duration: number;
  title: string;
}

export interface TSSSummary {
  entries: TSSEntry[];
  daily: { date: string; tss: number; byType: Record<string, number> }[];
  weekly: { weekStart: string; tss: number; byType: Record<string, number>; ctl: number; atl: number; tsb: number }[];
  ctl: number;
  atl: number;
  tsb: number;
  avgWeeklyTSS: number;
}

export function computeAllTSS(sessions: Session[], athlete: Athlete): TSSEntry[] {
  const entries: TSSEntry[] = [];
  const cp = athlete.cp_watts || 250;
  const ftp = athlete.ftp_watts || cp;
  const maxHr = athlete.max_hr || 185;
  const restHr = athlete.resting_hr || 50;

  for (const session of sessions) {
    const dur = session.duration_min;
    if (dur <= 0) continue;

    let tss = 0;
    let intensity = 0;
    let tssType: TSSEntry['tssType'] = 'hrTSS';

    const type = session.session_type;

    if ((type === 'cycling' || type === 'endurance') && session.normalized_power_watts) {
      const np = session.normalized_power_watts;
      const if_ = np / ftp;
      intensity = if_;
      tss = (dur * 60 * np * if_) / (ftp * 3600) * 100;
      tssType = 'pTSS';
    } else if (type === 'running' && session.avg_hr) {
      const hrr = (session.avg_hr - restHr) / (maxHr - restHr);
      intensity = hrr;
      tss = computeHrTSS(dur, hrr);
      tssType = 'rTSS';
    } else if (session.avg_hr) {
      const hrr = (session.avg_hr - restHr) / (maxHr - restHr);
      intensity = hrr;
      tss = computeHrTSS(dur, hrr);
      tssType = 'hrTSS';
    } else if (type === 'strength') {
      const rpe = session.rpe ?? 7;
      intensity = rpe / 10;
      tss = computeStrengthTSS(dur, rpe, session.strength_exercises?.length ?? 1);
      tssType = 'sTSS';
    } else if (type === 'beach_volleyball') {
      const rpe = session.rpe ?? 7;
      intensity = rpe / 10;
      tss = computeHrTSS(dur, rpe / 10);
      tssType = 'bvTSS';
    } else {
      const rpe = session.rpe ?? 6;
      intensity = rpe / 10;
      tss = computeHrTSS(dur, rpe / 10);
      tssType = 'hrTSS';
    }

    entries.push({
      date: session.session_date,
      sessionId: session.id,
      sessionType: type,
      tss: Math.round(tss * 10) / 10,
      tssType,
      intensity: Math.round(intensity * 100) / 100,
      duration: dur,
      title: session.title || type,
    });
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

function computeHrTSS(durationMin: number, hrReserveRatio: number): number {
  const clampedHRR = Math.min(1, Math.max(0, hrReserveRatio));
  return (durationMin / 60) * Math.pow(clampedHRR, 2) * 100;
}

function computeStrengthTSS(durationMin: number, rpe: number, exerciseCount: number): number {
  const rpeMultiplier = Math.pow(rpe / 10, 1.5);
  const volumeMultiplier = Math.min(2.0, 1 + (exerciseCount - 1) * 0.1);
  return (durationMin / 60) * rpeMultiplier * volumeMultiplier * 75;
}

export function computeCTLATL(tssEntries: TSSEntry[], ctlDays = 42, atlDays = 7): {
  history: { date: string; ctl: number; atl: number; tsb: number; dailyTSS: number }[];
  current: { ctl: number; atl: number; tsb: number };
} {
  if (tssEntries.length === 0) {
    return { history: [], current: { ctl: 0, atl: 0, tsb: 0 } };
  }

  const sorted = [...tssEntries].sort((a, b) => a.date.localeCompare(b.date));
  const startDate = new Date(sorted[0].date);
  startDate.setDate(startDate.getDate() - 7);
  const endDate = new Date();

  const dailyTSSMap = new Map<string, number>();
  for (const entry of sorted) {
    dailyTSSMap.set(entry.date, (dailyTSSMap.get(entry.date) ?? 0) + entry.tss);
  }

  const dates: string[] = [];
  const cur = new Date(startDate);
  while (cur <= endDate) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }

  const history: { date: string; ctl: number; atl: number; tsb: number; dailyTSS: number }[] = [];
  let ctl = 0;
  let atl = 0;

  for (const date of dates) {
    const dailyTSS = dailyTSSMap.get(date) ?? 0;
    ctl = ctl + (dailyTSS - ctl) * (1 - Math.exp(-1 / ctlDays));
    atl = atl + (dailyTSS - atl) * (1 - Math.exp(-1 / atlDays));
    history.push({
      date,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round((ctl - atl) * 10) / 10,
      dailyTSS: Math.round(dailyTSS * 10) / 10,
    });
  }

  const last = history[history.length - 1];
  return {
    history,
    current: { ctl: last?.ctl ?? 0, atl: last?.atl ?? 0, tsb: last?.tsb ?? 0 },
  };
}

export function buildTSSSummary(sessions: Session[], athlete: Athlete): TSSSummary {
  const entries = computeAllTSS(sessions, athlete);
  const { history, current } = computeCTLATL(entries);

  const dailyMap = new Map<string, Record<string, number>>();
  for (const e of entries) {
    if (!dailyMap.has(e.date)) dailyMap.set(e.date, {});
    const day = dailyMap.get(e.date)!;
    day[e.tssType] = (day[e.tssType] ?? 0) + e.tss;
    day['total'] = (day['total'] ?? 0) + e.tss;
  }

  const daily = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, byType]) => ({ date, tss: byType['total'] ?? 0, byType }));

  const weeklyMap = new Map<string, Record<string, number>>();
  for (const e of entries) {
    const d = new Date(e.date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    const weekStart = d.toISOString().split('T')[0];
    if (!weeklyMap.has(weekStart)) weeklyMap.set(weekStart, {});
    const week = weeklyMap.get(weekStart)!;
    week[e.tssType] = (week[e.tssType] ?? 0) + e.tss;
    week['total'] = (week['total'] ?? 0) + e.tss;
  }

  const histMap = new Map(history.map(h => [h.date, h]));

  const weekly = Array.from(weeklyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, byType]) => {
      const endOfWeek = new Date(weekStart);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      const endStr = endOfWeek.toISOString().split('T')[0];
      const snap = histMap.get(endStr) ?? histMap.get(weekStart);
      return {
        weekStart,
        tss: Math.round((byType['total'] ?? 0) * 10) / 10,
        byType,
        ctl: snap?.ctl ?? 0,
        atl: snap?.atl ?? 0,
        tsb: snap?.tsb ?? 0,
      };
    });

  const avgWeeklyTSS = weekly.length > 0 ? weekly.reduce((sum, w) => sum + w.tss, 0) / weekly.length : 0;

  return {
    entries,
    daily,
    weekly,
    ctl: current.ctl,
    atl: current.atl,
    tsb: current.tsb,
    avgWeeklyTSS: Math.round(avgWeeklyTSS),
  };
}
