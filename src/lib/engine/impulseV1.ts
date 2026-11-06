// Impulse v1: calculateImpulse copied from Endurance d1728f0; keep formulas synchronized.
export const IMPULSE_ALGORITHM_VERSION = 'impulse-v1';
export const DEFAULT_TAU_CHRONIC = 28;
export const DEFAULT_TAU_ACUTE = 7;

export type ImpulseStatus = 'calculated' | 'estimated' | 'manual' | 'insufficient';
export type ImpulseMethod =
  | 'cycling_np_if_ftp'
  | 'cycling_avg_power_ftp'
  | 'running_adjusted_pace_threshold'
  | 'running_average_pace_threshold'
  | 'swimming_css_pace_if3'
  | 'swimming_threshold_pace_if3'
  | 'planned_steps'
  | 'manual';

export interface ImpulseResult {
  impulse: number | null;
  status: ImpulseStatus;
  method: ImpulseMethod | null;
  algorithmVersion: string;
  reason?: string;
}

export interface ImpulseInput {
  sport: 'cycling' | 'running' | 'swimming';
  durationMinutes: number;
  normalizedPowerWatts?: number | null;
  avgPowerWatts?: number | null;
  ftp?: number | null;
  avgPacePerKm?: number | null;
  adjustedPacePerKm?: number | null;
  thresholdPacePerKm?: number | null;
  manualImpulse?: number | null;
}

function invalidDuration(minutes: number): boolean {
  return !Number.isFinite(minutes) || minutes <= 0;
}

function result(
  impulse: number | null,
  status: ImpulseStatus,
  method: ImpulseMethod | null,
  reason?: string,
): ImpulseResult {
  return {
    impulse: impulse == null ? null : Math.round(impulse * 100) / 100,
    status,
    method,
    algorithmVersion: IMPULSE_ALGORITHM_VERSION,
    reason,
  };
}

function tssEquivalent(durationMinutes: number, intensityFactor: number, exponent: 2 | 3): number {
  return (durationMinutes / 60) * Math.pow(intensityFactor, exponent) * 100;
}

export function calculateImpulse(input: ImpulseInput): ImpulseResult {
  if (input.manualImpulse != null && Number.isFinite(input.manualImpulse) && input.manualImpulse >= 0) {
    return result(input.manualImpulse, 'manual', 'manual');
  }

  if (invalidDuration(input.durationMinutes)) {
    return result(null, 'insufficient', null, 'Duration must be greater than zero');
  }

  if (input.sport === 'cycling') {
    const power = input.normalizedPowerWatts ?? input.avgPowerWatts;
    if (power != null && input.ftp != null && power > 0 && input.ftp > 0) {
      const intensityFactor = power / input.ftp;
      const method = input.normalizedPowerWatts != null
        ? 'cycling_np_if_ftp'
        : 'cycling_avg_power_ftp';
      const status: ImpulseStatus = input.normalizedPowerWatts != null ? 'calculated' : 'estimated';
      return result(tssEquivalent(input.durationMinutes, intensityFactor, 2), status, method);
    }
    return result(null, 'insufficient', null, 'Cycling requires NP or average power plus FTP');
  }

  if (input.sport === 'running') {
    if (input.thresholdPacePerKm == null || input.thresholdPacePerKm <= 0) {
      return result(null, 'insufficient', null, 'Running requires a threshold pace');
    }
    const pace = input.adjustedPacePerKm ?? input.avgPacePerKm;
    if (pace == null || pace <= 0) {
      return result(null, 'insufficient', null, 'Running requires average or adjusted pace');
    }
    const adjusted = input.adjustedPacePerKm != null;
    return result(
      tssEquivalent(input.durationMinutes, input.thresholdPacePerKm / pace, 2),
      adjusted ? 'calculated' : 'estimated',
      adjusted ? 'running_adjusted_pace_threshold' : 'running_average_pace_threshold',
      adjusted ? undefined : 'Average pace is not equivalent to grade-adjusted pace',
    );
  }

  if (input.thresholdPacePerKm == null || input.thresholdPacePerKm <= 0) {
    return result(null, 'insufficient', null, 'Swimming requires CSS or a threshold pace');
  }
  if (input.avgPacePerKm == null || input.avgPacePerKm <= 0) {
    return result(null, 'insufficient', null, 'Swimming requires average pace');
  }
  return result(
    tssEquivalent(input.durationMinutes, input.thresholdPacePerKm / input.avgPacePerKm, 3),
    'estimated',
    'swimming_threshold_pace_if3',
    'Swimming uses a provisional sTSS-style IF^3 method; it is not a validated cross-sport equivalence',
  );
}

