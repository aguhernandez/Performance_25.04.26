import type {
  CompartmentTau,
  CompartmentState,
  DailyCompartmentResult,
  MultiCompartmentState,
  PhysiologicalProfile,
} from './types';

interface CompartmentImpulsePoint {
  date: string;
  aerobic: number;
  glycolytic: number;
  neuromuscular: number;
}

export function buildCompartmentTau(profile: PhysiologicalProfile): CompartmentTau {
  const { vo2max, vlamax, leanMassKg, weightKg, cpWatts } = profile;

  const cpPerKg = weightKg > 0 ? cpWatts / weightKg : 3.5;
  const leanFraction = weightKg > 0 ? leanMassKg / weightKg : 0.85;

  const aeroFitnessFactor = clamp((vo2max - 30) / 55, 0, 1);
  const aeroCapFactor = clamp((cpPerKg - 2.0) / 5.0, 0, 1);
  const glycoFactor = clamp(vlamax / 0.6, 0, 1);
  const neuroFactor = clamp(leanFraction, 0.6, 1.0);

  const aerobic: import('./types').TauParameters = {
    tauFitness: clamp(42 + aeroFitnessFactor * 10 + aeroCapFactor * 5, 30, 55),
    tauFatigue: clamp(7 + aeroFitnessFactor * 2 - glycoFactor * 1, 5, 12),
    kMultiplier: clamp(2.0 + glycoFactor * 0.5 - aeroCapFactor * 0.3, 1.6, 3.0),
  };

  const glycolytic: import('./types').TauParameters = {
    tauFitness: clamp(28 + glycoFactor * 8 - aeroFitnessFactor * 3, 20, 38),
    tauFatigue: clamp(4 + glycoFactor * 2, 3, 7),
    kMultiplier: clamp(2.5 + glycoFactor * 0.8, 2.0, 3.8),
  };

  const neuromuscular: import('./types').TauParameters = {
    tauFitness: clamp(35 + neuroFactor * 12 - glycoFactor * 3, 25, 48),
    tauFatigue: clamp(5 + neuroFactor * 2, 4, 9),
    kMultiplier: clamp(1.8 + neuroFactor * 0.6, 1.5, 2.8),
  };

  return { aerobic, glycolytic, neuromuscular };
}

export function runMultiCompartmentModel(
  sessions: CompartmentImpulsePoint[],
  tau: CompartmentTau,
  windowDays = 180
): DailyCompartmentResult[] {
  if (sessions.length === 0) return [];

  const sorted = [...sessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const startDate = new Date(sorted[0].date);
  startDate.setDate(startDate.getDate() - 7);
  const endDate = new Date();

  const allDates = generateDateRange(startDate, endDate).slice(-windowDays);
  const impulseMap = buildCompartmentImpulseMap(sorted);

  const results: DailyCompartmentResult[] = [];

  let aeroFitness = 0, aeroFatigue = 0;
  let glycoFitness = 0, glycoFatigue = 0;
  let neuroFitness = 0, neuroFatigue = 0;

  for (const date of allDates) {
    const imp = impulseMap.get(date) ?? { aerobic: 0, glycolytic: 0, neuromuscular: 0 };

    aeroFitness = aeroFitness * Math.exp(-1 / tau.aerobic.tauFitness) + imp.aerobic;
    aeroFatigue = aeroFatigue * Math.exp(-1 / tau.aerobic.tauFatigue) + imp.aerobic * tau.aerobic.kMultiplier;

    glycoFitness = glycoFitness * Math.exp(-1 / tau.glycolytic.tauFitness) + imp.glycolytic;
    glycoFatigue = glycoFatigue * Math.exp(-1 / tau.glycolytic.tauFatigue) + imp.glycolytic * tau.glycolytic.kMultiplier;

    neuroFitness = neuroFitness * Math.exp(-1 / tau.neuromuscular.tauFitness) + imp.neuromuscular;
    neuroFatigue = neuroFatigue * Math.exp(-1 / tau.neuromuscular.tauFatigue) + imp.neuromuscular * tau.neuromuscular.kMultiplier;

    const aerobic: CompartmentState = {
      fitness: r4(aeroFitness),
      fatigue: r4(aeroFatigue),
      form: r4(aeroFitness - aeroFatigue),
    };
    const glycolytic: CompartmentState = {
      fitness: r4(glycoFitness),
      fatigue: r4(glycoFatigue),
      form: r4(glycoFitness - glycoFatigue),
    };
    const neuromuscular: CompartmentState = {
      fitness: r4(neuroFitness),
      fatigue: r4(neuroFatigue),
      form: r4(neuroFitness - neuroFatigue),
    };

    const totalImpulse = imp.aerobic + imp.glycolytic + imp.neuromuscular;
    const totalFitness = aeroFitness + glycoFitness + neuroFitness;
    const totalFatigue = aeroFatigue + glycoFatigue + neuroFatigue;

    results.push({
      date,
      aerobic,
      glycolytic,
      neuromuscular,
      total: {
        fitness: r4(totalFitness),
        fatigue: r4(totalFatigue),
        form: r4(totalFitness - totalFatigue),
      },
      impulse: {
        aerobic: r4(imp.aerobic),
        glycolytic: r4(imp.glycolytic),
        neuromuscular: r4(imp.neuromuscular),
        total: r4(totalImpulse),
      },
    });
  }

  return results;
}

export function getCurrentMultiCompartmentState(
  history: DailyCompartmentResult[],
  tau: CompartmentTau,
  profile: PhysiologicalProfile
): MultiCompartmentState {
  const last = history[history.length - 1];
  if (!last) {
    const zero: CompartmentState = { fitness: 0, fatigue: 0, form: 0 };
    return {
      aerobic: zero,
      glycolytic: zero,
      neuromuscular: zero,
      total: zero,
      weights: { aerobic: 0.6, glycolytic: 0.25, neuromuscular: 0.15 },
    };
  }

  const weights = computeCompartmentWeights(profile);

  return {
    aerobic: last.aerobic,
    glycolytic: last.glycolytic,
    neuromuscular: last.neuromuscular,
    total: last.total,
    weights,
  };
}

export function computeCompartmentWeights(
  profile: PhysiologicalProfile
): { aerobic: number; glycolytic: number; neuromuscular: number } {
  const { vo2max, vlamax, leanMassKg, weightKg } = profile;
  const leanFraction = weightKg > 0 ? leanMassKg / weightKg : 0.85;

  const aeroScore = clamp(vo2max / 80, 0.3, 1.0);
  const glycoScore = clamp(vlamax / 0.6, 0.2, 1.0);
  const neuroScore = clamp(leanFraction, 0.5, 1.0);

  const total = aeroScore + glycoScore * 0.5 + neuroScore * 0.3;

  return {
    aerobic: r3(aeroScore / total),
    glycolytic: r3((glycoScore * 0.5) / total),
    neuromuscular: r3((neuroScore * 0.3) / total),
  };
}

export function sessionToCompartmentImpulse(
  sessionType: string,
  totalImpulse: number,
  rawData?: Record<string, unknown>
): { aerobic: number; glycolytic: number; neuromuscular: number } {
  const bvData = rawData?.beachVolleyball as Record<string, unknown> | undefined;

  if (sessionType === 'strength') {
    return {
      aerobic: totalImpulse * 0.1,
      glycolytic: totalImpulse * 0.3,
      neuromuscular: totalImpulse * 0.6,
    };
  }

  if (sessionType === 'beach_volleyball') {
    const jumpFraction = bvData ? 0.35 : 0.30;
    return {
      aerobic: totalImpulse * 0.40,
      glycolytic: totalImpulse * (1 - jumpFraction - 0.25),
      neuromuscular: totalImpulse * jumpFraction,
    };
  }

  if (sessionType === 'running') {
    return {
      aerobic: totalImpulse * 0.70,
      glycolytic: totalImpulse * 0.20,
      neuromuscular: totalImpulse * 0.10,
    };
  }

  if (sessionType === 'cycling') {
    return {
      aerobic: totalImpulse * 0.75,
      glycolytic: totalImpulse * 0.20,
      neuromuscular: totalImpulse * 0.05,
    };
  }

  return {
    aerobic: totalImpulse * 0.65,
    glycolytic: totalImpulse * 0.25,
    neuromuscular: totalImpulse * 0.10,
  };
}

function buildCompartmentImpulseMap(
  sessions: CompartmentImpulsePoint[]
): Map<string, { aerobic: number; glycolytic: number; neuromuscular: number }> {
  const map = new Map<string, { aerobic: number; glycolytic: number; neuromuscular: number }>();
  for (const s of sessions) {
    const existing = map.get(s.date) ?? { aerobic: 0, glycolytic: 0, neuromuscular: 0 };
    map.set(s.date, {
      aerobic: existing.aerobic + s.aerobic,
      glycolytic: existing.glycolytic + s.glycolytic,
      neuromuscular: existing.neuromuscular + s.neuromuscular,
    });
  }
  return map;
}

function generateDateRange(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function r4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function r3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
