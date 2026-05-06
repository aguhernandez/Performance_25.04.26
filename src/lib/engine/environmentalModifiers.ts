export interface EnvironmentalContext {
  temperatureC?: number;
  humidityPct?: number;
  altitudeM?: number;
}

export function applyEnvironmentalStress(
  baseImpulse: number,
  env: EnvironmentalContext
): { modifiedImpulse: number; modifier: number; factors: string[] } {
  let modifier = 1.0;
  const factors: string[] = [];

  if (env.temperatureC !== undefined) {
    if (env.temperatureC > 30) {
      const heatBoost = (env.temperatureC - 25) * 0.025;
      modifier *= 1 + heatBoost;
      factors.push(`Heat stress +${(heatBoost * 100).toFixed(0)}% (${env.temperatureC}°C)`);
    } else if (env.temperatureC > 25) {
      const heatBoost = (env.temperatureC - 25) * 0.02;
      modifier *= 1 + heatBoost;
      factors.push(`Mild heat +${(heatBoost * 100).toFixed(0)}% (${env.temperatureC}°C)`);
    } else if (env.temperatureC < 5) {
      modifier *= 1.05;
      factors.push('Cold stress +5%');
    }
  }

  if (env.altitudeM !== undefined && env.altitudeM > 1500) {
    const altEffect = Math.min((env.altitudeM - 1500) / 8000, 0.2);
    modifier *= 1 + altEffect;
    factors.push(`Altitude stress +${(altEffect * 100).toFixed(0)}% (${env.altitudeM}m)`);
  }

  if (env.humidityPct !== undefined && env.humidityPct > 70 && (env.temperatureC ?? 20) > 20) {
    modifier *= 1.04;
    factors.push('High humidity +4%');
  }

  modifier = Math.min(modifier, 1.5);

  return {
    modifiedImpulse: baseImpulse * modifier,
    modifier: Math.round(modifier * 1000) / 1000,
    factors,
  };
}

export function computeSleepFatigueDecayModifier(sleepHours?: number): number {
  if (sleepHours === undefined) return 1.0;
  if (sleepHours < 5) return 0.45;
  if (sleepHours < 6) return 0.65;
  if (sleepHours < 7) return 0.82;
  if (sleepHours >= 8.5) return 1.25;
  if (sleepHours >= 8) return 1.15;
  return 1.0;
}

export function computeTrainingIntentionModifier(intention?: string | null): number {
  switch (intention) {
    case 'recovery': return 0.6;
    case 'aerobic': return 0.9;
    case 'threshold': return 1.1;
    case 'vo2max': return 1.3;
    case 'power': return 1.4;
    default: return 1.0;
  }
}
