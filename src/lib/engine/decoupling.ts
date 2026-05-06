import type { Session } from '../database.types';

export interface DecouplingResult {
  sessionId: string;
  date: string;
  title: string;
  sessionType: string;
  paDecoupling: number;
  efFirst: number;
  efSecond: number;
  decouplingPct: number;
  aerobicDecoupled: boolean;
  duration: number;
  avgPower: number | null;
  avgHr: number | null;
}

export interface EfficiencyFactorEntry {
  date: string;
  sessionId: string;
  title: string;
  ef: number;
  power: number;
  hr: number;
  sessionType: string;
}

export interface DecouplingTrend {
  entries: EfficiencyFactorEntry[];
  avgEF: number;
  efTrend: 'improving' | 'declining' | 'stable';
  efTrendPct: number;
  aerobicFitnessTrend: 'improving' | 'declining' | 'stable';
}

export function computeEfficiencyFactor(sessions: Session[]): DecouplingTrend {
  const entries: EfficiencyFactorEntry[] = [];

  const relevantSessions = sessions.filter(s =>
    (s.session_type === 'cycling' || s.session_type === 'endurance' || s.session_type === 'running') &&
    s.avg_hr && s.avg_hr > 0 && s.duration_min >= 20
  );

  for (const session of relevantSessions) {
    const power = session.normalized_power_watts ?? session.avg_power_watts;
    const hr = session.avg_hr;
    if (!power || !hr || hr <= 0) continue;

    const ef = power / hr;
    entries.push({
      date: session.session_date,
      sessionId: session.id,
      title: session.title || session.session_type,
      ef: Math.round(ef * 100) / 100,
      power,
      hr,
      sessionType: session.session_type,
    });
  }

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const avgEF = sorted.length > 0 ? sorted.reduce((sum, e) => sum + e.ef, 0) / sorted.length : 0;

  let efTrend: DecouplingTrend['efTrend'] = 'stable';
  let efTrendPct = 0;
  let aerobicFitnessTrend: DecouplingTrend['aerobicFitnessTrend'] = 'stable';

  if (sorted.length >= 6) {
    const first = sorted.slice(0, Math.floor(sorted.length / 2));
    const last = sorted.slice(Math.floor(sorted.length / 2));
    const firstAvg = first.reduce((sum, e) => sum + e.ef, 0) / first.length;
    const lastAvg = last.reduce((sum, e) => sum + e.ef, 0) / last.length;
    efTrendPct = firstAvg > 0 ? ((lastAvg - firstAvg) / firstAvg) * 100 : 0;
    efTrend = efTrendPct > 2 ? 'improving' : efTrendPct < -2 ? 'declining' : 'stable';
    aerobicFitnessTrend = efTrend;
  }

  return {
    entries: sorted,
    avgEF: Math.round(avgEF * 100) / 100,
    efTrend,
    efTrendPct: Math.round(efTrendPct * 10) / 10,
    aerobicFitnessTrend,
  };
}

export function estimateDecoupling(session: Session): DecouplingResult | null {
  if (!session.avg_hr || !session.avg_power_watts || session.duration_min < 30) return null;

  const power = session.normalized_power_watts ?? session.avg_power_watts;
  const hr = session.avg_hr;
  const efFirst = power / (hr * 0.97);
  const efSecond = power / (hr * 1.03);
  const paDecoupling = ((efFirst - efSecond) / efFirst) * 100;
  const decouplingPct = Math.abs(paDecoupling);

  return {
    sessionId: session.id,
    date: session.session_date,
    title: session.title || session.session_type,
    sessionType: session.session_type,
    paDecoupling: Math.round(paDecoupling * 100) / 100,
    efFirst: Math.round(efFirst * 100) / 100,
    efSecond: Math.round(efSecond * 100) / 100,
    decouplingPct: Math.round(decouplingPct * 100) / 100,
    aerobicDecoupled: decouplingPct > 5,
    duration: session.duration_min,
    avgPower: power,
    avgHr: hr,
  };
}

export interface StaminaDurability {
  stamina: number;
  durability: number;
  staminaLabel: string;
  durabilityLabel: string;
  longSessionEF: number;
  shortSessionEF: number;
  efDropoff: number;
}

export function computeStaminaDurability(sessions: Session[]): StaminaDurability {
  const powerSessions = sessions.filter(
    s => (s.session_type === 'cycling' || s.session_type === 'endurance') &&
         s.avg_power_watts && s.avg_hr && s.avg_hr > 0
  );

  const shortSessions = powerSessions.filter(s => s.duration_min < 60);
  const longSessions = powerSessions.filter(s => s.duration_min >= 90);

  const shortEF = shortSessions.length > 0
    ? shortSessions.reduce((sum, s) => sum + (s.avg_power_watts! / s.avg_hr!), 0) / shortSessions.length
    : 0;

  const longEF = longSessions.length > 0
    ? longSessions.reduce((sum, s) => sum + (s.avg_power_watts! / s.avg_hr!), 0) / longSessions.length
    : 0;

  const efDropoff = shortEF > 0 ? ((shortEF - longEF) / shortEF) * 100 : 0;

  const stamina = Math.max(0, Math.min(100, 100 - efDropoff * 2));
  const durability = Math.max(0, Math.min(100, longSessions.length > 0 ? Math.min(100, longEF * 50) : 0));

  return {
    stamina: Math.round(stamina),
    durability: Math.round(durability),
    staminaLabel: stamina >= 80 ? 'Excellent' : stamina >= 60 ? 'Good' : stamina >= 40 ? 'Fair' : 'Developing',
    durabilityLabel: durability >= 80 ? 'Elite' : durability >= 60 ? 'Good' : durability >= 40 ? 'Average' : 'Developing',
    longSessionEF: Math.round(longEF * 100) / 100,
    shortSessionEF: Math.round(shortEF * 100) / 100,
    efDropoff: Math.round(efDropoff * 10) / 10,
  };
}
