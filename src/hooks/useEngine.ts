import { useMemo } from 'react';
import type { Athlete, Session } from '../lib/database.types';
import { computeEngineOutput } from '../lib/engine/bannisterModel';
import type { EngineOutput } from '../lib/engine/types';

export function useEngine(
  athlete: Athlete | null,
  sessions: Session[],
  options?: { includeStrength?: boolean; cpModel?: { cpWatts: number; confidence: 'high' | 'medium' | 'low' } }
): EngineOutput | null {
  const includeStrength = options?.includeStrength ?? true;
  const cpModel = options?.cpModel;

  return useMemo(() => {
    if (!athlete) return null;
    return computeEngineOutput(sessions, athlete, { includeStrength, cpModel });
  }, [athlete, sessions, includeStrength, cpModel?.cpWatts, cpModel?.confidence]);
}
