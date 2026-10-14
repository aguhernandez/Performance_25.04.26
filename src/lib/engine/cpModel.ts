import type { Athlete } from '../database.types';
import { fitCpModel, cpConfidence } from './powerAnalysis';

export interface CpModelResult {
  cp: number;
  wPrimeJ: number;
  pMax: number;
  r2: number;
  seCp: number;
  nPoints: number;
  windowDays: number;
  confidence: 'high' | 'medium' | 'low';
  status: 'ok' | 'insufficient_data';
  reason?: string;
  /** delta = modelled − lab/profile CP (null when no lab reference) */
  deltaFromLab: number | null;
}

export interface CpModelInput {
  athlete: Athlete;
  /** best per-duration MMP rows from activity_mmp (already athlete-level max) */
  mmpWattsByDuration: { durationS: number; watts: number; date: string; activityId: string }[];
  /** lab-tested or profile CP used as reference; null when absent */
  labCp: number | null;
  /** best measured 1-s watts from any stream; null when none */
  best1sWatts: number | null;
}

/**
 * Fit the CP model from real-stream MMP points. Returns status
 * 'insufficient_data' with NO numbers when requirements aren't met. Lab and
 * modelled CP stay separate — delta = modelled − lab is exposed, never forced.
 */
export function computeCpModel(input: CpModelInput): CpModelResult {
  const regression = fitCpModel(
    input.mmpWattsByDuration.map(p => ({
      durationS: p.durationS,
      watts: p.watts,
      date: p.date,
      activityId: p.activityId,
    }))
  );
  const confidence = cpConfidence(regression);

  const status = regression.status;
  const insufficient = status !== 'ok';

  return {
    cp: insufficient ? 0 : regression.cp,
    wPrimeJ: insufficient ? 0 : regression.wPrimeJ,
    pMax: insufficient || input.best1sWatts === null ? 0 : Math.round(input.best1sWatts),
    r2: insufficient ? 0 : regression.r2,
    seCp: insufficient ? 0 : regression.seCp,
    nPoints: regression.nPoints,
    windowDays: regression.windowDays,
    confidence: insufficient ? 'low' : (confidence ?? 'low'),
    status,
    reason: regression.reason,
    deltaFromLab:
      insufficient || input.labCp === null || input.labCp <= 0
        ? null
        : regression.cp - input.labCp,
  };
}
