import { useEffect, useMemo, useState } from 'react';
import type { Athlete } from '../../../lib/database.types';
import { loadDailyLoad, loadDailyState } from '../../../lib/engine/loadPersistence';
import { loadActivityMmp, loadActivityMetrics, loadActivityDurability, loadWeeklyLoad, type ActivityMmpRow, type ActivityMetricsRow, type ActivityDurabilityRow, type WeeklyLoadRow } from '../../../lib/engine/cpPersistence';
import { addDays, daysBetween, toISODate, weekStartISO } from './shared';

export interface PmcDay {
  date: string;
  /** stacked bar segments, one per sport with impulse > 0 */
  bySport: { sport: string; impulse: number; quality: string }[];
  total: number;
  fitness: number | null;
  fatigue: number | null;
  form: number | null;
  rampRate: number | null;
  /** lowest provenance across the day's rows — drives the point badge */
  quality: 'measured' | 'modelled' | 'estimated';
  isWarmUp: boolean;
}

export interface PdcPoint {
  duration_s: number;
  watts: number;
  date: string;
  activity_id: string;
}

export interface WeeklyRow {
  weekStart: string;
  bySport: { sport: string; impulse: number }[];
  total: number;
  rampRate: number | null;
}

export interface EffRow {
  date: string;
  activityId: string;
  ef: number | null;
  decoupling: number | null;
  avgPower: number | null;
  avgHr: number | null;
  vi: number | null;
}

export interface DurabilityCell {
  watts: number | null;
  date: string | null;
  activityId: string | null;
}

export interface DurabilityGroup {
  kjThreshold: number;
  cells: { duration300: DurabilityCell; duration1200: DurabilityCell };
}

export interface DurabilityWindow {
  key: string;
  label: string;
  groups: DurabilityGroup[];
}

export interface PerformanceData {
  pmcDays: PmcDay[];
  pmcStart: string | null;
  historyDays: number;
  /** true when history < 120 days */
  historyIncomplete: boolean;
  pdcWindows: { key: string; label: string; points: PdcPoint[] }[];
  cpModel: {
    cp: number;
    wPrimeJ: number;
    pMax: number;
    r2: number;
    confidence: 'high' | 'medium' | 'low';
    deltaFromLab: number | null;
  } | null;
  weekly: WeeklyRow[];
  weeklyLoad: WeeklyLoadRow[];
  currentWeekStart: string | null;
  efficiency: EffRow[];
  durability: DurabilityWindow[];
  efMovingAvg: { weekStart: string; value: number }[];
  decouplingMovingAvg: { weekStart: string; value: number }[];
  loading: boolean;
  error: string | null;
}

const WARM_UP_DAYS = 120;

const PDC_WINDOWS = [
  { key: '42d', label: 'Last 42 days', days: 42 },
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: 'all', label: 'All time', days: 9999 },
];

function aggregateQuality(qualities: string[]): 'measured' | 'modelled' | 'estimated' {
  if (qualities.includes('measured')) return 'measured';
  if (qualities.includes('modelled')) return 'modelled';
  return 'estimated';
}

export function usePerformanceData(athlete: Athlete | null): PerformanceData {
  const [dailyLoad, setDailyLoad] = useState<Awaited<ReturnType<typeof loadDailyLoad>>>([]);
  const [dailyState, setDailyState] = useState<Awaited<ReturnType<typeof loadDailyState>>>([]);
  const [mmp, setMmp] = useState<ActivityMmpRow[]>([]);
  const [metrics, setMetrics] = useState<ActivityMetricsRow[]>([]);
  const [durability, setDurability] = useState<ActivityDurabilityRow[]>([]);
  const [weeklyLoad, setWeeklyLoad] = useState<WeeklyLoadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  void tick; void setTick;

  useEffect(() => {
    if (!athlete?.id) {
      setDailyLoad([]);
      setDailyState([]);
      setMmp([]);
      setMetrics([]);
      setDurability([]);
      setWeeklyLoad([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // 730-day window so "all time" covers more than the 365-day default.
        const [loadRows, stateRows, mmpRows, metricRows, durabilityRows, weeklyRows] = await Promise.all([
          loadDailyLoad(athlete.id, 730),
          loadDailyState(athlete.id, 730),
          loadActivityMmp(athlete.id, 730),
          loadActivityMetrics(athlete.id, 730),
          loadActivityDurability(athlete.id, 9999),
          loadWeeklyLoad(athlete.id, 730),
        ]);
        if (cancelled) return;
        setDailyLoad(loadRows);
        setDailyState(stateRows);
        setMmp(mmpRows);
        setMetrics(metricRows);
        setDurability(durabilityRows);
        setWeeklyLoad(weeklyRows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load performance data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [athlete?.id, tick]);

  return useMemo(() => {
    const today = toISODate(new Date());

    // --- PMC days (bars from daily_load, lines from daily_state) ---------
    const stateByDate = new Map(dailyState.map(r => [r.date, r]));
    const loadByDate = new Map<string, { bySport: { sport: string; impulse: number; quality: string }[]; qualities: string[] }>();
    for (const r of dailyLoad) {
      let day = loadByDate.get(r.date);
      if (!day) {
        day = { bySport: [], qualities: [] };
        loadByDate.set(r.date, day);
      }
      if (Number(r.impulse) > 0) {
        day.bySport.push({ sport: r.sport, impulse: Number(r.impulse), quality: r.quality });
      }
      day.qualities.push(r.quality);
    }

    const dates = [...stateByDate.keys()].sort();
    const pmcStart = dates.length > 0 ? dates[0] : null;
    const historyDays = pmcStart ? daysBetween(pmcStart, today) + 1 : 0;

    // Ramp rate = fitness − fitness 7 days prior, computed once.
    const rampByDate = new Map<string, number>();
    for (let i = 0; i < dates.length; i++) {
      const cur = Number(stateByDate.get(dates[i])!.fitness);
      const prior = Number(stateByDate.get(dates[Math.max(0, i - 7)])!.fitness);
      rampByDate.set(dates[i], cur - prior);
    }

    const pmcDays: PmcDay[] = dates.map((date, idx) => {
      const s = stateByDate.get(date)!;
      const day = loadByDate.get(date);
      return {
        date,
        bySport: day?.bySport ?? [],
        total: (day?.bySport ?? []).reduce((sum, seg) => sum + seg.impulse, 0),
        fitness: Number(s.fitness),
        fatigue: Number(s.fatigue),
        form: Number(s.form),
        rampRate: rampByDate.get(date) ?? null,
        quality: aggregateQuality(day?.qualities ?? []),
        isWarmUp: idx < dates.length - WARM_UP_DAYS,
      };
    });

    // --- PDC windows from activity_mmp ----------------------------------
    const pdcWindows = PDC_WINDOWS.map(w => {
      const cutoff = w.days >= 9999 ? null : addDays(today, -w.days);
      const best = new Map<number, PdcPoint>();
      for (const r of mmp) {
        if (cutoff && r.date < cutoff) continue;
        const cur = best.get(r.duration_s);
        if (!cur || Number(r.watts) > cur.watts) {
          best.set(r.duration_s, {
            duration_s: r.duration_s,
            watts: Math.round(Number(r.watts)),
            date: r.date,
            activity_id: r.activity_id,
          });
        }
      }
      const points = Array.from(best.values()).sort((a, b) => a.duration_s - b.duration_s);
      return { key: w.key, label: w.label, points };
    });

    // --- CP model summary: P = CP + W'/t on (1/t, P) over 180–1800 s -----
    let cpModel: PerformanceData['cpModel'] = null;
    const allTime = pdcWindows[pdcWindows.length - 1].points;
    if (allTime.length > 0 && athlete) {
      const fit = allTime.filter(p => p.duration_s >= 180 && p.duration_s <= 1800);
      const n = fit.length;
      if (n >= 3) {
        let sx = 0, sy = 0, sxx = 0, sxy = 0;
        for (const p of fit) {
          const x = 1 / p.duration_s;
          const y = p.watts;
          sx += x; sy += y; sxx += x * x; sxy += x * y;
        }
        const denom = n * sxx - sx * sx;
        if (Math.abs(denom) > 1e-9) {
          const wPrimeJ = (n * sxy - sx * sy) / denom;
          const cp = (sy - wPrimeJ * sx) / n;
          if (cp > 0 && wPrimeJ > 0) {
            const yMean = sy / n;
            let ssTot = 0, ssRes = 0;
            for (const p of fit) {
              const pred = cp + wPrimeJ / p.duration_s;
              ssTot += (p.watts - yMean) ** 2;
              ssRes += (p.watts - pred) ** 2;
            }
            const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
            const labCp = athlete.cp_watts || athlete.ftp_watts || 0;
            const hasLab = labCp > 0;
            const confidence: 'high' | 'medium' | 'low' = r2 >= 0.95 && n >= 5 ? 'high' : r2 >= 0.85 ? 'medium' : 'low';
            cpModel = {
              cp: Math.round(cp),
              wPrimeJ: Math.round(wPrimeJ),
              pMax: Math.round(cp + wPrimeJ),
              r2,
              confidence,
              deltaFromLab: hasLab ? Math.round(cp - labCp) : null,
            };
          }
        }
      }
    }

    // --- Weekly impulse by sport + weekly ramp rate ----------------------
    const weeklyMap = new Map<string, { bySport: Map<string, number> }>();
    for (const r of dailyLoad) {
      const wk = weekStartISO(r.date);
      let w = weeklyMap.get(wk);
      if (!w) {
        w = { bySport: new Map() };
        weeklyMap.set(wk, w);
      }
      w.bySport.set(r.sport, (w.bySport.get(r.sport) ?? 0) + Number(r.impulse));
    }
    const weekly: WeeklyRow[] = Array.from(weeklyMap.keys()).sort().map(weekStart => {
      const w = weeklyMap.get(weekStart)!;
      const rampDates = dates.filter(d => d >= weekStart && d < addDays(weekStart, 7));
      const rampRate = rampDates.length > 0
        ? Number(stateByDate.get(rampDates[rampDates.length - 1])?.fitness ?? 0)
          - Number(stateByDate.get(weekStart)?.fitness ?? 0)
        : null;
      const bySport = Array.from(w.bySport.entries()).map(([sport, impulse]) => ({ sport, impulse }));
      return {
        weekStart,
        bySport,
        total: bySport.reduce((sum, s) => sum + s.impulse, 0),
        rampRate,
      };
    });

    // --- Efficiency rows from activity_metrics ---------------------------
    const steady = new Map<string, EffRow>();
    for (const r of metrics) {
      if (r.ef === null && r.decoupling_pct === null) continue;
      steady.set(r.activity_id, {
        date: r.date,
        activityId: r.activity_id,
        ef: r.ef !== null ? Number(r.ef) : null,
        decoupling: r.decoupling_pct !== null ? Number(r.decoupling_pct) : null,
        avgPower: r.avg_power_watts !== null ? Number(r.avg_power_watts) : null,
        avgHr: r.avg_hr !== null ? Number(r.avg_hr) : null,
        vi: r.vi !== null ? Number(r.vi) : null,
      });
    }
    const efficiency = Array.from(steady.values()).sort((a, b) => a.date.localeCompare(b.date));

    // 4-week moving averages of weekly EF/decoupling means.
    const efByWeek = new Map<string, { sum: number; n: number }>();
    const decByWeek = new Map<string, { sum: number; n: number }>();
    for (const e of efficiency) {
      const wk = weekStartISO(e.date);
      if (e.ef !== null) {
        const cur = efByWeek.get(wk) ?? { sum: 0, n: 0 };
        cur.sum += e.ef; cur.n += 1;
        efByWeek.set(wk, cur);
      }
      if (e.decoupling !== null) {
        const cur = decByWeek.get(wk) ?? { sum: 0, n: 0 };
        cur.sum += e.decoupling; cur.n += 1;
        decByWeek.set(wk, cur);
      }
    }
    const weekKeys = Array.from(new Set([...efByWeek.keys(), ...decByWeek.keys()])).sort();
    const movingAvg = (m: Map<string, { sum: number; n: number }>) =>
      weekKeys.map((wk, i) => {
        const slice = weekKeys.slice(Math.max(0, i - 3), i + 1);
        let sum = 0, n = 0;
        for (const k of slice) {
          const v = m.get(k);
          if (v && v.n > 0) { sum += v.sum; n += v.n; }
        }
        return { weekStart: wk, value: n > 0 ? sum / n : 0 };
      });

    const curWeekStart = weekStartISO(today);

    return {
      pmcDays,
      pmcStart,
      historyDays,
      historyIncomplete: historyDays < WARM_UP_DAYS,
      pdcWindows,
      cpModel,
      weekly: weekly.slice(-26),
      weeklyLoad,
      currentWeekStart: curWeekStart,
      efficiency,
      durability,
      efMovingAvg: movingAvg(efByWeek),
      decouplingMovingAvg: movingAvg(decByWeek),
      loading,
      error,
    };
  }, [dailyLoad, dailyState, mmp, metrics, durability, weeklyLoad, athlete, loading, error]);
}
