import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * True when the signed-in user (as an athlete) has an assigned coach —
 * either via athletes.coach_id or the coach_athletes assignment table.
 * Read via one RPC-free query; a failed lookup simply means "no coach".
 */
export function useCoachAssignment(userId: string | null | undefined): boolean {
  const [assigned, setAssigned] = useState(false);

  useEffect(() => {
    if (!userId) {
      setAssigned(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data: athlete } = await supabase
          .from('athletes')
          .select('id, coach_id')
          .eq('user_id', userId)
          .maybeSingle();
        if (cancelled) return;
        if (athlete?.coach_id) {
          setAssigned(true);
          return;
        }
        if (athlete?.id) {
          const { data: ca } = await supabase
            .from('coach_athletes')
            .select('id')
            .eq('athlete_id', athlete.id)
            .limit(1);
          if (cancelled) return;
          setAssigned(!!ca && ca.length > 0);
          return;
        }
        setAssigned(false);
      } catch {
        if (!cancelled) setAssigned(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return assigned;
}
