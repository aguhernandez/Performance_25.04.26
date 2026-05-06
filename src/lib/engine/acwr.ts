import type { TSSEntry } from './tssMetrics';

export interface ACWRPoint {
  date: string;
  acuteLoad: number;
  chronicLoad: number;
  acwr: number;
  dailyTSS: number;
  riskZone: 'safe' | 'caution' | 'danger' | 'underload';
}

export interface ACWRSummary {
  history: ACWRPoint[];
  current: ACWRPoint | null;
  riskZone: 'safe' | 'caution' | 'danger' | 'underload';
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  peakACWR: number;
  avgACWR: number;
  consecutiveDaysInDanger: number;
}

export function computeACWR(
  tssEntries: TSSEntry[],
  acuteDays = 7,
  chronicDays = 28
): ACWRSummary {
  if (tssEntries.length === 0) {
    return {
      history: [],
      current: null,
      riskZone: 'safe',
      trendDirection: 'stable',
      peakACWR: 0,
      avgACWR: 0,
      consecutiveDaysInDanger: 0,
    };
  }

  const sorted = [...tssEntries].sort((a, b) => a.date.localeCompare(b.date));
  const startDate = new Date(sorted[0].date);
  startDate.setDate(startDate.getDate() - chronicDays);
  const endDate = new Date();

  const dailyTSSMap = new Map<string, number>();
  for (const e of sorted) {
    dailyTSSMap.set(e.date, (dailyTSSMap.get(e.date) ?? 0) + e.tss);
  }

  const allDates: string[] = [];
  const cur = new Date(startDate);
  while (cur <= endDate) {
    allDates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }

  const history: ACWRPoint[] = [];

  for (let i = chronicDays; i < allDates.length; i++) {
    const date = allDates[i];
    const acuteStart = Math.max(0, i - acuteDays);
    const chronicStart = Math.max(0, i - chronicDays);

    const acuteSlice = allDates.slice(acuteStart, i);
    const chronicSlice = allDates.slice(chronicStart, i);

    const acuteSum = acuteSlice.reduce((sum, d) => sum + (dailyTSSMap.get(d) ?? 0), 0);
    const chronicSum = chronicSlice.reduce((sum, d) => sum + (dailyTSSMap.get(d) ?? 0), 0);

    const acuteLoad = acuteSum / acuteDays;
    const chronicLoad = chronicSum / chronicDays;
    const acwr = chronicLoad > 0 ? acuteLoad / chronicLoad : 0;
    const dailyTSS = dailyTSSMap.get(date) ?? 0;

    history.push({
      date,
      acuteLoad: Math.round(acuteLoad * 10) / 10,
      chronicLoad: Math.round(chronicLoad * 10) / 10,
      acwr: Math.round(acwr * 100) / 100,
      dailyTSS: Math.round(dailyTSS * 10) / 10,
      riskZone: classifyACWR(acwr),
    });
  }

  const current = history[history.length - 1] ?? null;
  const recentHistory = history.slice(-14);

  const acwrValues = recentHistory.map(h => h.acwr).filter(v => v > 0);
  const avgACWR = acwrValues.length > 0 ? acwrValues.reduce((a, b) => a + b, 0) / acwrValues.length : 0;
  const peakACWR = acwrValues.length > 0 ? Math.max(...acwrValues) : 0;

  const first7 = recentHistory.slice(0, 7).map(h => h.acwr);
  const last7 = recentHistory.slice(-7).map(h => h.acwr);
  const avg7Start = first7.length > 0 ? first7.reduce((a, b) => a + b, 0) / first7.length : 0;
  const avg7End = last7.length > 0 ? last7.reduce((a, b) => a + b, 0) / last7.length : 0;
  const trendDirection: ACWRSummary['trendDirection'] =
    avg7End > avg7Start + 0.05 ? 'increasing' : avg7End < avg7Start - 0.05 ? 'decreasing' : 'stable';

  let consecutiveDaysInDanger = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].riskZone === 'danger') consecutiveDaysInDanger++;
    else break;
  }

  return {
    history,
    current,
    riskZone: current?.riskZone ?? 'safe',
    trendDirection,
    peakACWR: Math.round(peakACWR * 100) / 100,
    avgACWR: Math.round(avgACWR * 100) / 100,
    consecutiveDaysInDanger,
  };
}

function classifyACWR(acwr: number): ACWRPoint['riskZone'] {
  if (acwr === 0) return 'underload';
  if (acwr < 0.8) return 'underload';
  if (acwr <= 1.3) return 'safe';
  if (acwr <= 1.5) return 'caution';
  return 'danger';
}

export function getACWRColor(zone: ACWRPoint['riskZone']): string {
  switch (zone) {
    case 'safe': return '#22c55e';
    case 'caution': return '#f59e0b';
    case 'danger': return '#ef4444';
    case 'underload': return '#94a3b8';
  }
}

export function getACWRLabel(zone: ACWRPoint['riskZone']): string {
  switch (zone) {
    case 'safe': return 'Optimal Load';
    case 'caution': return 'Elevated Risk';
    case 'danger': return 'High Injury Risk';
    case 'underload': return 'Underloaded';
  }
}
