import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fetchCoachAthletes, type HubCoachAthlete } from '../lib/hub/hubApiService';

export type HubSyncStatus = 'idle' | 'syncing' | 'synced' | 'failed' | 'no_token';

export interface UseCoachHubSyncReturn {
  status: HubSyncStatus;
  syncedCount: number;
  error: string | null;
  sync: () => Promise<void>;
}

const SESSION_TOKEN_KEY = 'hub_session_token';

/**
 * Reads coach-athlete assignments from the Hub (source of truth) and syncs
 * them into the local Supabase tables:
 *   - `coach_athletes` (coach_id ↔ athlete_id links)
 *   - `athletes.coach_id` (denormalized coach reference on the athlete row)
 *
 * Token resolution order:
 *   1. The coach's own `hub_planner_token` (if active)
 *   2. The admin profile's `hub_planner_token` (shared admin connection)
 *   3. The JWT session token from localStorage (Hub login)
 *
 * Hub athletes without a local `athletes` row are created with a minimal
 * placeholder so the roster RPC can return them.
 */
export function useCoachHubSync(
  coachHubId: string | null | undefined,
  coachEmail: string | null | undefined
): UseCoachHubSyncReturn {
  const [status, setStatus] = useState<HubSyncStatus>('idle');
  const [syncedCount, setSyncedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    if (!coachHubId || !coachEmail) {
      setStatus('idle');
      return;
    }

    setStatus('syncing');
    setError(null);

    try {
      // Step 1: resolve a valid Hub token
      const token = await resolveHubToken(coachHubId);
      if (!token) {
        setStatus('no_token');
        return;
      }

      // Step 2: fetch this coach's athletes from the Hub
      let hubAthletes: HubCoachAthlete[] = [];
      try {
        const resp = await fetchCoachAthletes(token, coachEmail);
        hubAthletes = resp.athletes ?? [];
      } catch (err) {
        console.warn('[CoachHubSync] fetchCoachAthletes failed:', err);
        setStatus('failed');
        setError('No se pudieron obtener los atletas del Hub');
        return;
      }

      if (hubAthletes.length === 0) {
        setStatus('synced');
        setSyncedCount(0);
        return;
      }

      // Step 3: match Hub athletes to local athletes via email → profiles → athletes
      const hubEmails = hubAthletes.map(h => h.email);

      const { data: matchedProfiles } = await supabase
        .from('profiles')
        .select('hub_user_id, email')
        .in('email', hubEmails);

      const emailToHubUserId = new Map<string, string>();
      if (matchedProfiles) {
        for (const p of matchedProfiles) {
          if (p.email) emailToHubUserId.set(p.email.toLowerCase(), p.hub_user_id);
        }
      }

      // For each Hub athlete, find or create a local athlete row
      let count = 0;
      for (const hubA of hubAthletes) {
        const hubUserId = emailToHubUserId.get(hubA.email.toLowerCase()) ?? hubA.id;

        // Check if a local athlete exists for this user_id
        const { data: existing, error: lookupErr } = await supabase
          .from('athletes')
          .select('id, coach_id')
          .eq('user_id', hubUserId)
          .maybeSingle();

        if (lookupErr) {
          console.warn(`[CoachHubSync] Could not find athlete for ${hubA.email}:`, lookupErr);
          continue;
        }

        let athleteId: string;

        if (existing) {
          athleteId = existing.id;
          if (existing.coach_id !== coachHubId) {
            const { error: updateErr } = await supabase
              .from('athletes')
              .update({ coach_id: coachHubId })
              .eq('id', athleteId);
            if (updateErr) {
              console.warn(`[CoachHubSync] Could not update coach for ${hubA.email}:`, updateErr);
              continue;
            }
          }
        } else {
          const { data: newAthlete, error: createErr } = await supabase
            .from('athletes')
            .insert({
              user_id: hubUserId,
              name: hubA.full_name || hubA.email.split('@')[0],
              sport: hubA.sport || 'cycling',
              coach_id: coachHubId,
              tau_fitness: 42,
              tau_fatigue: 7,
              onboarding_completed: false,
            })
            .select('id')
            .maybeSingle();

          if (newAthlete) {
            athleteId = newAthlete.id;
          } else if (createErr?.code === '23505') {
            const { data: racedAthlete, error: raceLookupErr } = await supabase
              .from('athletes')
              .select('id')
              .eq('user_id', hubUserId)
              .maybeSingle();
            if (raceLookupErr || !racedAthlete) {
              console.warn(`[CoachHubSync] Could not resolve concurrent athlete for ${hubA.email}:`, raceLookupErr ?? createErr);
              continue;
            }
            athleteId = racedAthlete.id;
          } else {
            console.warn(`[CoachHubSync] Could not create athlete for ${hubA.email}:`, createErr);
            continue;
          }
        }

        // Upsert coach_athletes link (coach_id as UUID)
        const { error: linkErr } = await supabase
          .from('coach_athletes')
          .upsert(
            { coach_id: coachHubId, athlete_id: athleteId },
            { onConflict: 'coach_id,athlete_id' }
          );

        if (linkErr) {
          console.warn(`[CoachHubSync] Could not link athlete ${athleteId}:`, linkErr);
        }

        count++;
      }

      setSyncedCount(count);
      setStatus('synced');
    } catch (err) {
      console.error('[CoachHubSync] Sync failed:', err);
      setStatus('failed');
      setError(err instanceof Error ? err.message : 'Sync failed');
    }
  }, [coachHubId, coachEmail]);

  useEffect(() => {
    if (coachHubId && coachEmail) {
      sync();
    }
  }, [sync, coachHubId, coachEmail]);

  return { status, syncedCount, error, sync };
}

/**
 * Resolve a valid Hub token for API calls.
 * Tries: coach's own planner token → admin's planner token → JWT session token.
 */
async function resolveHubToken(coachHubId: string): Promise<string | null> {
  // 1. Coach's own planner token
  const { data: coachProfile } = await supabase
    .from('profiles')
    .select('hub_planner_token, hub_connection_active')
    .eq('hub_user_id', coachHubId)
    .maybeSingle();

  if (coachProfile?.hub_planner_token && coachProfile?.hub_connection_active) {
    return coachProfile.hub_planner_token;
  }

  // 2. Admin's planner token (shared connection)
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('hub_planner_token')
    .eq('role', 'admin')
    .eq('hub_connection_active', true)
    .maybeSingle();

  if (adminProfile?.hub_planner_token) {
    return adminProfile.hub_planner_token;
  }

  // 3. JWT session token from localStorage (Hub login)
  const jwt = localStorage.getItem(SESSION_TOKEN_KEY);
  if (jwt) {
    return jwt;
  }

  return null;
}
