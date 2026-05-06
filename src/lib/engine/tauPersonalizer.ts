import type { PhysiologicalProfile, TauParameters } from './types';

const TAU_FITNESS_BASE = 42;
const TAU_FATIGUE_BASE = 7;
const K_MULTIPLIER_BASE = 2.0;

const TAU_FITNESS_MIN = 28;
const TAU_FITNESS_MAX = 55;
const TAU_FATIGUE_MIN = 4;
const TAU_FATIGUE_MAX = 12;
const K_MIN = 1.5;
const K_MAX = 3.5;

export function individualizedTau(profile: PhysiologicalProfile): TauParameters {
  const vo2maxFactor = computeVo2maxFactor(profile.vo2max);
  const vlamaxFactor = computeVlamaxFactor(profile.vlamax);
  const leanMassFactor = computeLeanMassFactor(profile.leanMassKg, profile.weightKg);
  const aerobicCapacityFactor = computeAerobicCapacityFactor(profile.cpWatts, profile.weightKg);

  const tauFitness = clamp(
    TAU_FITNESS_BASE * vo2maxFactor * leanMassFactor * aerobicCapacityFactor,
    TAU_FITNESS_MIN,
    TAU_FITNESS_MAX
  );

  const tauFatigue = clamp(
    TAU_FATIGUE_BASE * vlamaxFactor * (1 / leanMassFactor),
    TAU_FATIGUE_MIN,
    TAU_FATIGUE_MAX
  );

  const kMultiplier = clamp(
    K_MULTIPLIER_BASE * vlamaxFactor * (1 / aerobicCapacityFactor),
    K_MIN,
    K_MAX
  );

  return {
    tauFitness: round(tauFitness, 2),
    tauFatigue: round(tauFatigue, 2),
    kMultiplier: round(kMultiplier, 3),
  };
}

function computeVo2maxFactor(vo2max: number): number {
  const normalized = (vo2max - 30) / (85 - 30);
  const clamped = clamp(normalized, 0, 1);
  return 0.9 + clamped * 0.25;
}

function computeVlamaxFactor(vlamax: number): number {
  const normalized = vlamax / 0.6;
  const clamped = clamp(normalized, 0, 1);
  return 0.8 + clamped * 0.4;
}

function computeLeanMassFactor(leanMassKg: number, weightKg: number): number {
  const leanFraction = weightKg > 0 ? leanMassKg / weightKg : 0.85;
  const clamped = clamp(leanFraction, 0.6, 1.0);
  return 0.9 + clamped * 0.15;
}

function computeAerobicCapacityFactor(cpWatts: number, weightKg: number): number {
  const cpPerKg = weightKg > 0 ? cpWatts / weightKg : 3.5;
  const normalized = (cpPerKg - 2.0) / (7.0 - 2.0);
  const clamped = clamp(normalized, 0, 1);
  return 0.9 + clamped * 0.25;
}

export function updateTauFromHistory(
  baseTau: TauParameters,
  recentFitnessGainRate: number,
  recentFatigueDecayRate: number
): TauParameters {
  const fitnessAdaptation = clamp(1 + recentFitnessGainRate * 0.1, 0.85, 1.15);
  const fatigueAdaptation = clamp(1 + recentFatigueDecayRate * 0.1, 0.85, 1.15);

  return {
    tauFitness: clamp(baseTau.tauFitness * fitnessAdaptation, TAU_FITNESS_MIN, TAU_FITNESS_MAX),
    tauFatigue: clamp(baseTau.tauFatigue * fatigueAdaptation, TAU_FATIGUE_MIN, TAU_FATIGUE_MAX),
    kMultiplier: baseTau.kMultiplier,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
