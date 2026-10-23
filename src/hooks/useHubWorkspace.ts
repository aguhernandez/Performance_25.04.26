import { useEffect, useMemo, useState } from 'react';
import type { Athlete, Session, NutritionLog, HrvLog, LabTest } from '../lib/database.types';
import type { HubSnapshot } from './useHubData';
import { mergeHubWorkspace, fetchHubStream } from '../lib/hub/hubContext';
import { cleanPowerStream, computeMeanMaxPower, computePowerStats, computePerRideMetrics } from '../lib/engine/powerAnalysis';
import { computeDurabilityRows } from '../lib/engine/wbal';
import type { ActivityMmpRow, ActivityMetricsRow, ActivityDurabilityRow } from '../lib/engine/cpPersistence';

export function useHubWorkspace(athlete: Athlete | null, sessions: Session[], nutrition: NutritionLog[], hrv: HrvLog[], labs: LabTest[], snapshot: HubSnapshot, token?: string) {
  const workspace = useMemo(() => mergeHubWorkspace(athlete, sessions, nutrition, hrv, labs, snapshot), [athlete, sessions, nutrition, hrv, labs, snapshot]);
  const [power, setPower] = useState<{ owner: string; rows: ActivityMmpRow[]; metrics: ActivityMetricsRow[]; durability: ActivityDurabilityRow[]; error: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setPower(null);
    if (!athlete || !snapshot.context || !token) return;
    const id = athlete.id;
    const remote = workspace.sessions.filter(s => s.session_type === 'cycling' && s.raw_data?.hub_source === 'external' && (s.raw_data?.has_power || s.avg_power_watts !== null));
    void (async () => {
      const rows: ActivityMmpRow[] = [];
      const metrics: ActivityMetricsRow[] = [];
      const durability: ActivityDurabilityRow[] = [];
      let failed = 0;
      // Fetch one activity at a time: streams stay in memory only during calculation.
      for (const session of remote) {
        if (cancelled) return;
        try {
          const hub = await fetchHubStream(token, String(session.raw_data?.hub_email), String(session.raw_data?.hub_activity_id));
          if (cancelled) return;
          if (!hub.series?.watts) continue;
          const clean = cleanPowerStream({ times: hub.series.time_s, watts: hub.series.watts });
          if (!clean) continue;
          const stats = computePowerStats(clean);
          if (!stats) continue;
          const perRide = hub.series.hr ? computePerRideMetrics(clean, hub.series.hr, stats) : { ef: null, decouplingPct: null };
          metrics.push({ activity_id: session.id, athlete_id: id, date: session.session_date, avg_power_watts: stats.avgWatts, np_watts: stats.np, vi: stats.vi, avg_hr: session.avg_hr, ef: perRide.ef, decoupling_pct: perRide.decouplingPct, stream_fingerprint: null });
          durability.push(...computeDurabilityRows(clean, session.id, id, session.session_date));
          for (const point of computeMeanMaxPower(clean)) rows.push({ activity_id: session.id, athlete_id: id, date: session.session_date, duration_s: point.durationS, watts: point.watts, np: stats.np, vi: stats.vi, source: 'hub' });
        } catch { failed++; }
      }
      if (!cancelled) setPower({ owner: id, rows, metrics, durability, error: failed ? `No se pudieron analizar las series de ${failed} actividades del Hub.` : null });
    })();
    return () => { cancelled = true; };
  }, [athlete?.id, snapshot.context, token]);
  return { ...workspace, metrics: power?.owner === athlete?.id ? power?.metrics : undefined, durability: power?.owner === athlete?.id ? power?.durability : undefined, mmpRows: power?.owner === athlete?.id ? power?.rows : undefined, powerError: power?.owner === athlete?.id ? power?.error : null };
}
