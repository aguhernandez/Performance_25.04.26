import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { RosterRow } from '../lib/rosterAlerts';
import { useCoachHubSync, type HubSyncStatus } from './useCoachHubSync';

export interface RosterState {
  rows: RosterRow[];
  loading: boolean;
  error: string | null;
  hubSyncStatus: HubSyncStatus;
  hubSyncedCount: number;
  hubSyncError: string | null;
}

/**
 * Loads the full coach roster through the single coach_roster() RPC —
 * one query for the entire page, no per-athlete fetches.
 *
 * On load, also triggers a Hub sync (via useCoachHubSync) that pulls
 * coach-athlete assignments from the Hub using the JWT / X-Planner-Token
 * and stores the Hub coach reference on each local athlete. The roster is
 * refetched after a successful sync so newly-discovered athletes appear.
 */
export function useCoachRoster(
  coachHubId?: string | null,
  coachEmail?: string | null
): RosterState & { refetch: () => void } {
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refetch = useCallback(() => setTick(t => t + 1), []);

  const hubSync = useCoachHubSync(coachHubId, coachEmail);

  // Refetch the roster after a successful Hub sync so newly-synced
  // athletes appear in the RPC result.
  useEffect(() => {
    if (hubSync.status === 'synced' && hubSync.syncedCount > 0) {
      setTick(t => t + 1);
    }
  }, [hubSync.status, hubSync.syncedCount]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      const rpcArgs = coachHubId
        ? { p_coach_hub_id: coachHubId }
        : {};

      const { data, error: err } = await supabase.rpc('coach_roster', rpcArgs);
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
  }, [tick, coachHubId]);

  return {
    rows,
    loading,
    error,
    hubSyncStatus: hubSync.status,
    hubSyncedCount: hubSync.syncedCount,
    hubSyncError: hubSync.error,
    refetch,
  };
}
