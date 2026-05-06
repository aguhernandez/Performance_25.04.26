import type { BeachVolleyballData } from './types';

const JUMP_BASE_IMPULSE = 0.00012;
const SPRINT_BASE_IMPULSE = 0.00045;
const RALLY_INTENSITY = 0.65;
const ACCELERATION_IMPULSE = 0.0003;

export function calculateBeachVolleyballImpulse(
  data: BeachVolleyballData,
  profile: {
    maxHr: number;
    restingHr: number;
    jumpHeightCmBaseline: number;
  }
): {
  total: number;
  aerobic: number;
  glycolytic: number;
  neuromuscular: number;
  breakdown: {
    jumpImpulse: number;
    sprintImpulse: number;
    rallyImpulse: number;
    accelerationImpulse: number;
  };
} {
  const {
    jumpCount,
    jumpHeightCm,
    sprintCount,
    avgSprintDistanceM,
    rallyDurationMin,
    accelerationCount,
    avgHr,
    rpe,
  } = data;

  const effectiveJumpHeight = jumpHeightCm ?? profile.jumpHeightCmBaseline;
  const heightFactor = clamp(effectiveJumpHeight / profile.jumpHeightCmBaseline, 0.5, 1.8);
  const effortFactor = rpe ? clamp(rpe / 8, 0.5, 1.2) : 1.0;

  const jumpImpulse = jumpCount * JUMP_BASE_IMPULSE * heightFactor * effortFactor;

  const sprintDist = avgSprintDistanceM ?? 8;
  const sprintImpulse = sprintCount * SPRINT_BASE_IMPULSE * (sprintDist / 8) * effortFactor;

  const hrIntensity = avgHr && profile.maxHr > 0 && profile.restingHr >= 0
    ? (avgHr - profile.restingHr) / (profile.maxHr - profile.restingHr)
    : RALLY_INTENSITY;
  const clampedHrIntensity = clamp(hrIntensity, 0.3, 1.0);
  const rallyImpulse = (rallyDurationMin / 60) * Math.pow(clampedHrIntensity, 2);

  const accelCount = accelerationCount ?? sprintCount * 2;
  const accelerationImpulse = accelCount * ACCELERATION_IMPULSE * effortFactor;

  const total = jumpImpulse + sprintImpulse + rallyImpulse + accelerationImpulse;

  return {
    total: r4(total),
    aerobic: r4(rallyImpulse * 0.85 + jumpImpulse * 0.05),
    glycolytic: r4(sprintImpulse * 0.6 + accelerationImpulse * 0.5 + rallyImpulse * 0.15),
    neuromuscular: r4(jumpImpulse * 0.95 + sprintImpulse * 0.4 + accelerationImpulse * 0.5),
    breakdown: {
      jumpImpulse: r4(jumpImpulse),
      sprintImpulse: r4(sprintImpulse),
      rallyImpulse: r4(rallyImpulse),
      accelerationImpulse: r4(accelerationImpulse),
    },
  };
}

export function estimateBeachVolleyballRpe(data: BeachVolleyballData): number {
  const { jumpCount, sprintCount, rallyDurationMin, accelerationCount } = data;

  const jumpLoad = jumpCount * 0.015;
  const sprintLoad = sprintCount * 0.025;
  const enduranceLoad = (rallyDurationMin / 60) * 4;
  const accelLoad = (accelerationCount ?? sprintCount * 2) * 0.01;

  const rawRpe = jumpLoad + sprintLoad + enduranceLoad + accelLoad;
  return clamp(Math.round(rawRpe), 1, 10);
}

export function getBeachVolleyLoadCategory(impulse: number): {
  label: string;
  color: string;
} {
  if (impulse < 0.05) return { label: 'Recovery', color: '#64748b' };
  if (impulse < 0.15) return { label: 'Light', color: '#22c55e' };
  if (impulse < 0.30) return { label: 'Moderate', color: '#f59e0b' };
  if (impulse < 0.50) return { label: 'Heavy', color: '#fb923c' };
  return { label: 'Maximal', color: '#ef4444' };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function r4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
