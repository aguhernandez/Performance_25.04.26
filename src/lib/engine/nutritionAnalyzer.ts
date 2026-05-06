import type { NutritionLog } from '../database.types';
import type { NutritionComplianceResult } from './types';

const KCAL_PER_KG_LEAN_THRESHOLD = 30;
const PROTEIN_PER_KG_MIN = 1.6;
const PROTEIN_PER_KG_OPTIMAL = 1.8;
const CARB_PER_KG_ENDURANCE = 5.0;
const FAT_FRACTION_MIN = 0.20;

export function analyzeNutritionCompliance(
  logs: NutritionLog[],
  weightKg: number,
  leanMassKg: number,
  lookbackDays = 14
): NutritionComplianceResult {
  const recent = logs.slice(0, lookbackDays);

  if (recent.length === 0) {
    return {
      energyAvailability: 0,
      proteinAdherence: 0,
      carbAdherence: 0,
      fatAdherence: 0,
      overallCompliance: 0,
      recoveryScore: 0,
      recommendation: 'No nutrition data available. Log daily intake to enable model adjustments.',
      deficit: false,
      excess: false,
    };
  }

  const avgCalories = avg(recent.map(l => l.calories));
  const avgProtein = avg(recent.map(l => l.protein_g));
  const avgCarbs = avg(recent.map(l => l.carbs_g));
  const avgFat = avg(recent.map(l => l.fat_g));
  const avgSleep = avg(recent.map(l => l.sleep_hours));
  const avgSleepQ = avg(recent.filter(l => l.sleep_quality).map(l => l.sleep_quality!));

  const restingEE = weightKg * 25;
  const trainingEE = weightKg * 8;
  const energyAvailability = Math.max(0, avgCalories - trainingEE) / leanMassKg;

  const proteinTarget = weightKg * PROTEIN_PER_KG_OPTIMAL;
  const proteinAdherence = clamp((avgProtein / proteinTarget) * 100, 0, 120);

  const carbTarget = weightKg * CARB_PER_KG_ENDURANCE;
  const carbAdherence = clamp((avgCarbs / carbTarget) * 100, 0, 130);

  const fatTargetCals = avgCalories * FAT_FRACTION_MIN;
  const fatActualCals = avgFat * 9;
  const fatAdherence = clamp((fatActualCals / Math.max(fatTargetCals, 1)) * 100, 0, 150);

  const sleepScore = clamp(avgSleep / 9 * 100, 0, 100);
  const sleepQScore = avgSleepQ > 0 ? clamp(avgSleepQ / 5 * 100, 0, 100) : 60;
  const recoveryScore = sleepScore * 0.6 + sleepQScore * 0.4;

  const eaScore = clamp(energyAvailability / KCAL_PER_KG_LEAN_THRESHOLD * 100, 0, 100);
  const overallCompliance = (eaScore * 0.3 + proteinAdherence * 0.3 + carbAdherence * 0.2 + fatAdherence * 0.1 + recoveryScore * 0.1);

  const deficit = energyAvailability < 25;
  const excess = energyAvailability > 55;

  let recommendation = '';
  if (deficit) {
    recommendation = `Energy availability (${energyAvailability.toFixed(0)} kcal/kg lean mass) is below the 30 kcal threshold. Risk of RED-S. Increase caloric intake, especially carbohydrates.`;
  } else if (avgProtein < weightKg * PROTEIN_PER_KG_MIN) {
    recommendation = `Protein intake (${(avgProtein / weightKg).toFixed(2)} g/kg) below minimum ${PROTEIN_PER_KG_MIN} g/kg. Compromises neuromuscular recovery and lean mass retention.`;
  } else if (avgSleep < 7) {
    recommendation = `Average sleep (${avgSleep.toFixed(1)}h) below optimal 8h. Fatigue time constant is effectively shortened — prioritize sleep for accelerated recovery.`;
  } else if (excess) {
    recommendation = `Energy availability (${energyAvailability.toFixed(0)} kcal/kg) is elevated. Surplus may support hypertrophy but monitor body composition trends.`;
  } else if (carbAdherence < 60) {
    recommendation = `Carbohydrate intake is low for training load. Glycolytic compartment recovery may be compromised. Increase peri-training carbohydrate intake.`;
  } else {
    recommendation = `Nutrition profile is well-calibrated. Energy availability and macronutrient distribution support current training load.`;
  }

  return {
    energyAvailability: r2(energyAvailability),
    proteinAdherence: r2(proteinAdherence),
    carbAdherence: r2(carbAdherence),
    fatAdherence: r2(fatAdherence),
    overallCompliance: r2(overallCompliance),
    recoveryScore: r2(recoveryScore),
    recommendation,
    deficit,
    excess,
  };
}

export function computeNutritionImpulseModifier(
  logs: NutritionLog[],
  weightKg: number
): number {
  const last3 = logs.slice(0, 3);
  if (last3.length === 0) return 1.0;

  const avgCalories = avg(last3.map(l => l.calories));
  const avgProtein = avg(last3.map(l => l.protein_g));
  const avgSleep = avg(last3.map(l => l.sleep_hours));

  const calorieBaseline = weightKg * 35;
  const calMod = clamp(avgCalories / calorieBaseline, 0.8, 1.1);

  const proteinMod = clamp(avgProtein / (weightKg * 1.8), 0.9, 1.05);

  const sleepMod =
    avgSleep < 6 ? 0.85 :
    avgSleep < 7 ? 0.93 :
    avgSleep >= 8 ? 1.05 :
    1.0;

  return clamp(calMod * proteinMod * sleepMod, 0.75, 1.1);
}

export function getWeeklyNutritionTrend(
  logs: NutritionLog[],
  weightKg: number
): { week: string; energyAvailability: number; proteinAdherence: number; avgSleep: number }[] {
  const result: { week: string; energyAvailability: number; proteinAdherence: number; avgSleep: number }[] = [];
  const sorted = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date));

  for (let i = 0; i < sorted.length; i += 7) {
    const week = sorted.slice(i, i + 7);
    if (week.length === 0) continue;
    const avgCal = avg(week.map(l => l.calories));
    const trainingEE = weightKg * 8;
    const leanMass = weightKg * 0.85;
    const ea = Math.max(0, avgCal - trainingEE) / leanMass;
    const prot = avg(week.map(l => l.protein_g));
    const protTarget = weightKg * 1.8;
    result.push({
      week: week[0].log_date,
      energyAvailability: r2(ea),
      proteinAdherence: r2((prot / protTarget) * 100),
      avgSleep: r2(avg(week.map(l => l.sleep_hours))),
    });
  }

  return result.slice(-8);
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}
