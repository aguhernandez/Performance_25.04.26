import type {
  EnduranceImpulseInput,
  StrengthImpulseInput,
  StrengthExerciseInput,
  NutritionModifier,
} from './types';

export function calculateEnduranceImpulse(input: EnduranceImpulseInput): number {
  const { durationMin, avgPowerWatts, normalizedPowerWatts, avgHr, cpWatts, maxHr, restingHr, rpe } = input;

  let relativeIntensity = 0;

  if (normalizedPowerWatts && cpWatts > 0) {
    relativeIntensity = normalizedPowerWatts / cpWatts;
  } else if (avgPowerWatts && cpWatts > 0) {
    relativeIntensity = avgPowerWatts / cpWatts;
  } else if (avgHr && maxHr > 0 && restingHr >= 0) {
    const hrReserve = maxHr - restingHr;
    if (hrReserve > 0) {
      relativeIntensity = (avgHr - restingHr) / hrReserve;
    }
  } else if (rpe) {
    relativeIntensity = rpe / 10;
  }

  relativeIntensity = Math.max(0, Math.min(relativeIntensity, 2.0));

  const durationHours = durationMin / 60;
  const impulse = durationHours * Math.pow(relativeIntensity, 2);

  return Math.max(0, impulse);
}

export function calculateStrengthExerciseImpulse(exercise: StrengthExerciseInput): number {
  const { sets, reps, loadKg, barVelocityMs, rir } = exercise;

  const effortFactor = Math.max(0, Math.min((10 - rir) / 10, 1.0));

  const velocityFactor = barVelocityMs && barVelocityMs > 0
    ? 1 / barVelocityMs
    : 2.5;

  const normalizedVelocity = Math.min(velocityFactor, 5.0);

  const totalVolume = loadKg * reps * sets;

  const impulse = totalVolume * normalizedVelocity * effortFactor * 0.001;

  return Math.max(0, impulse);
}

export function calculateStrengthImpulse(input: StrengthImpulseInput): number {
  const { exercises } = input;

  const totalImpulse = exercises.reduce((sum, ex) => {
    return sum + calculateStrengthExerciseImpulse(ex);
  }, 0);

  return totalImpulse;
}

export function applyNutritionModifier(
  baseImpulse: number,
  nutrition: NutritionModifier | undefined,
  sessionType: 'endurance' | 'strength' | 'other'
): number {
  if (!nutrition) return baseImpulse;

  let modifier = 1.0;

  if (nutrition.sleepHours !== undefined) {
    if (nutrition.sleepHours < 6) {
      modifier *= 0.85;
    } else if (nutrition.sleepHours >= 8) {
      modifier *= 1.05;
    }
  }

  if (nutrition.sleepQuality !== undefined) {
    const qualityMod = 0.9 + (nutrition.sleepQuality / 5) * 0.2;
    modifier *= qualityMod;
  }

  if (sessionType === 'strength' && nutrition.proteinGrams !== undefined) {
    if (nutrition.proteinGrams > 1.8) {
      modifier *= 1.03;
    } else if (nutrition.proteinGrams < 1.0) {
      modifier *= 0.95;
    }
  }

  return baseImpulse * modifier;
}

export function combineSessionImpulses(
  enduranceImpulse: number,
  strengthImpulse: number,
  otherImpulse: number,
  sportWeights: { endurance: number; strength: number; other: number }
): number {
  const totalWeight = sportWeights.endurance + sportWeights.strength + sportWeights.other;
  const wE = sportWeights.endurance / totalWeight;
  const wS = sportWeights.strength / totalWeight;
  const wO = sportWeights.other / totalWeight;

  return (enduranceImpulse * wE) + (strengthImpulse * wS) + (otherImpulse * wO);
}

export function sessionToImpulseInput(
  session: import('../database.types').Session,
  athlete: import('../database.types').Athlete
): number {
  if (session.session_type === 'endurance') {
    return calculateEnduranceImpulse({
      durationMin: session.duration_min,
      avgPowerWatts: session.avg_power_watts ?? undefined,
      normalizedPowerWatts: session.normalized_power_watts ?? undefined,
      avgHr: session.avg_hr ?? undefined,
      cpWatts: athlete.cp_watts,
      maxHr: athlete.max_hr,
      restingHr: athlete.resting_hr,
      rpe: session.rpe ?? undefined,
    });
  }

  if (session.session_type === 'strength') {
    const exercises = (session.strength_exercises as import('../database.types').StrengthExercise[]) ?? [];
    return calculateStrengthImpulse({
      exercises: exercises.map(ex => ({
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        loadKg: ex.load_kg,
        barVelocityMs: ex.bar_velocity_ms,
        rir: ex.rir,
      })),
      durationMin: session.duration_min,
    });
  }

  if (session.rpe && session.duration_min) {
    return (session.duration_min / 60) * (session.rpe / 10) * 0.5;
  }

  return 0;
}
