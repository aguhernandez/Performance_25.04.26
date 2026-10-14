import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Athlete } from '../lib/database.types';
import { loadActivityMmp, fitAthleteCpModel } from '../lib/engine/cpPersistence';
import { computeCpModel, type CpModelResult } from '../lib/engine/cpModel';
import { extractMMPFromRows } from '../lib/engine/powerDurationCurve';

export interface AthleteCpData {
  cpModel: CpModelResult | null;
  /** raw activity_mmp rows for MMP charts (already athlete-scoped) */
  mmpRows: { duration_s: number; watts: number; date: string; activity_id: string }[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useAthleteCpModel(athlete: Athlete | null): AthleteCpData {
  const [rows, setRows] = useState<AthleteCpData['mmpRows']>([]);
  const [metrics1s, setMetrics1s] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = () => setTick(t => t + 1);

  useEffect(() => {
    if (!athlete?.id) {
      setRows([]);
      setMetrics1s(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const mmp = await loadActivityMmp(athlete.id, 365);
        if (cancelled) return;
        setRows(mmp.map(r => ({
          duration_s: r.duration_s,
          watts: r.watts,
          date: r.date,
          activity_id: r.activity_id,
        })));

        const { data } = await supabase
          .from('activity_mmp')
          .select('watts')
          .eq('athlete_id', athlete.id)
          .eq('duration_s', 1)
          .order('watts', { ascending: false })
          .limit(1);
        if (cancelled) return;
        const best1s = data && data.length > 0 ? Number((data[0] as { watts: number }).watts) : null;
        setMetrics1s(best1s);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load power data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [athlete?.id, tick]);

  const cpModel = useMemo(() => {
    if (!athlete) return null;
    const labCp = athlete.cp_watts || athlete.ftp_watts || null;
    return computeCpModel({
      athlete,
      mmpWattsByDuration: rows.map(r => ({
        durationS: r.duration_s,
        watts: r.watts,
        date: r.date,
        activityId: r.activity_id,
      })),
      labCp,
      best1sWatts: metrics1s,
    });
  }, [athlete, rows, metrics1s]);

  return { cpModel, mmpRows: rows, loading, error, refresh };
}

export function useMmpProfile(mmpRows: AthleteCpData['mmpRows']) {
  return useMemo(() => extractMMPFromRows(mmpRows), [mmpRows]);
}
