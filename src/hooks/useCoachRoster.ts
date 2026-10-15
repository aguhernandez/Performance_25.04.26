import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { RosterRow } from '../lib/rosterAlerts';

export interface RosterState {
  rows: RosterRow[];
  loading: boolean;
  error: string | null;
}

/**
 * Loads the full coach roster through the single coach_roster() RPC —
 * one query for the entire page, no per-athlete fetches.
 */
export function useCoachRoster(): RosterState & { refetch: () => void } {
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase.rpc('coach_roster');
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setRows([]);
      } else {
        setRows((data ?? []) as unknown as RosterRow[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tick]);

  return { rows, loading, error, refetch };
}
