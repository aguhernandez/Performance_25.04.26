import type { Session } from '../database.types';

export type BlockType = 'base' | 'build' | 'peak' | 'race' | 'transition' | 'taper';
export type MesocycleType = 'accumulation' | 'intensification' | 'realization' | 'recovery';

export interface TrainingBlock {
  id: string;
  label: string;
  type: BlockType;
  startDate: string;
  endDate: string;
  targetLoadPerWeek: number;
  actualLoadPerWeek?: number;
  notes: string;
  weeks: number;
}

export interface Mesocycle {
  id: string;
  label: string;
  type: MesocycleType;
  blocks: TrainingBlock[];
  startDate: string;
  endDate: string;
  weeks: number;
}

export interface PeriodizationPlan {
  id: string;
  label: string;
  targetEvent?: string;
  targetDate?: string;
  mesocycles: Mesocycle[];
  totalWeeks: number;
}

export interface BlockComparison {
  blockA: BlockAnalysis;
  blockB: BlockAnalysis;
  delta: {
    avgWeeklyImpulse: number;
    avgSessionLoad: number;
    sessionCount: number;
    fitnessGain: number;
    byType: Record<string, number>;
  };
}

export interface BlockAnalysis {
  label: string;
  startDate: string;
  endDate: string;
  totalSessions: number;
  totalImpulse: number;
  avgWeeklyImpulse: number;
  avgSessionLoad: number;
  byType: Record<string, { sessions: number; impulse: number }>;
  weeklyImpulse: { weekStart: string; impulse: number }[];
  peakWeekImpulse: number;
  fitnessStart: number;
  fitnessEnd: number;
  fitnessGain: number;
}

export function analyzeBlock(
  sessions: Session[],
  startDate: string,
  endDate: string,
  label: string,
  fitnessHistory?: { date: string; fitness: number }[]
): BlockAnalysis {
  const blockSessions = sessions.filter(s =>
    s.session_date >= startDate && s.session_date <= endDate
  );

  const totalSessions = blockSessions.length;
  const totalImpulse = blockSessions.reduce((sum, s) => sum + s.impulse, 0);

  const start = new Date(startDate);
  const end = new Date(endDate);
  const weeks = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)));
  const avgWeeklyImpulse = totalImpulse / weeks;
  const avgSessionLoad = totalSessions > 0 ? totalImpulse / totalSessions : 0;

  const byType: Record<string, { sessions: number; impulse: number }> = {};
  for (const s of blockSessions) {
    if (!byType[s.session_type]) byType[s.session_type] = { sessions: 0, impulse: 0 };
    byType[s.session_type].sessions++;
    byType[s.session_type].impulse += s.impulse;
  }

  const weeklyMap = new Map<string, number>();
  for (const s of blockSessions) {
    const d = new Date(s.session_date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    const weekStart = d.toISOString().split('T')[0];
    weeklyMap.set(weekStart, (weeklyMap.get(weekStart) ?? 0) + s.impulse);
  }

  const weeklyImpulse = Array.from(weeklyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, impulse]) => ({ weekStart, impulse: Math.round(impulse * 10) / 10 }));

  const peakWeekImpulse = weeklyImpulse.length > 0 ? Math.max(...weeklyImpulse.map(w => w.impulse)) : 0;

  let fitnessStart = 0;
  let fitnessEnd = 0;
  if (fitnessHistory && fitnessHistory.length > 0) {
    const startSnap = fitnessHistory.find(h => h.date >= startDate);
    const endSnap = [...fitnessHistory].reverse().find(h => h.date <= endDate);
    fitnessStart = startSnap?.fitness ?? 0;
    fitnessEnd = endSnap?.fitness ?? 0;
  }

  return {
    label,
    startDate,
    endDate,
    totalSessions,
    totalImpulse: Math.round(totalImpulse * 10) / 10,
    avgWeeklyImpulse: Math.round(avgWeeklyImpulse * 10) / 10,
    avgSessionLoad: Math.round(avgSessionLoad * 10) / 10,
    byType,
    weeklyImpulse,
    peakWeekImpulse: Math.round(peakWeekImpulse * 10) / 10,
    fitnessStart: Math.round(fitnessStart * 100) / 100,
    fitnessEnd: Math.round(fitnessEnd * 100) / 100,
    fitnessGain: Math.round((fitnessEnd - fitnessStart) * 100) / 100,
  };
}

export function compareBlocks(
  sessions: Session[],
  blockAStart: string,
  blockAEnd: string,
  blockBStart: string,
  blockBEnd: string,
  fitnessHistory?: { date: string; fitness: number }[]
): BlockComparison {
  const blockA = analyzeBlock(sessions, blockAStart, blockAEnd, 'Block A', fitnessHistory);
  const blockB = analyzeBlock(sessions, blockBStart, blockBEnd, 'Block B', fitnessHistory);

  const allTypes = new Set([...Object.keys(blockA.byType), ...Object.keys(blockB.byType)]);
  const byTypeDelta: Record<string, number> = {};
  for (const type of allTypes) {
    const a = blockA.byType[type]?.impulse ?? 0;
    const b = blockB.byType[type]?.impulse ?? 0;
    byTypeDelta[type] = Math.round((b - a) * 10) / 10;
  }

  return {
    blockA,
    blockB,
    delta: {
      avgWeeklyImpulse: Math.round((blockB.avgWeeklyImpulse - blockA.avgWeeklyImpulse) * 10) / 10,
      avgSessionLoad: Math.round((blockB.avgSessionLoad - blockA.avgSessionLoad) * 10) / 10,
      sessionCount: blockB.totalSessions - blockA.totalSessions,
      fitnessGain: Math.round((blockB.fitnessGain - blockA.fitnessGain) * 100) / 100,
      byType: byTypeDelta,
    },
  };
}

export interface TaperSimulation {
  weeks: TaperWeek[];
  peakFormDate: string;
  expectedFormAtEvent: number;
  currentFitness: number;
  expectedFitnessAtEvent: number;
  taperMultipliers: number[];
}

export interface TaperWeek {
  weekNumber: number;
  weekStart: string;
  targetLoad: number;
  taperMultiplier: number;
  projectedFitness: number;
  projectedFatigue: number;
  projectedForm: number;
}

export function simulateTaper(
  currentFitness: number,
  currentFatigue: number,
  tauFitness: number,
  tauFatigue: number,
  avgWeeklyLoad: number,
  eventDate: string,
  taperWeeks = 3
): TaperSimulation {
  const event = new Date(eventDate);
  const now = new Date();
  const daysToEvent = Math.max(0, Math.ceil((event.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const taperDays = taperWeeks * 7;

  const multipliers = [0.7, 0.5, 0.3];
  const weeks: TaperWeek[] = [];

  let fitness = currentFitness;
  let fatigue = currentFatigue;

  const dailyLoad = avgWeeklyLoad / 7;

  for (let w = 0; w < taperWeeks; w++) {
    const multiplier = multipliers[w] ?? 0.3;
    const weeklyTargetLoad = avgWeeklyLoad * multiplier;
    const dailyTargetLoad = weeklyTargetLoad / 7;

    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() + w * 7);

    for (let d = 0; d < 7; d++) {
      fitness = fitness + (dailyTargetLoad - fitness) * (1 - Math.exp(-1 / tauFitness));
      fatigue = fatigue + (dailyTargetLoad - fatigue) * (1 - Math.exp(-1 / tauFatigue));
    }

    weeks.push({
      weekNumber: w + 1,
      weekStart: weekStart.toISOString().split('T')[0],
      targetLoad: Math.round(weeklyTargetLoad * 10) / 10,
      taperMultiplier: multiplier,
      projectedFitness: Math.round(fitness * 100) / 100,
      projectedFatigue: Math.round(fatigue * 100) / 100,
      projectedForm: Math.round((fitness - fatigue) * 100) / 100,
    });
  }

  const remainingDays = daysToEvent - taperDays;
  if (remainingDays > 0) {
    const reducedLoad = dailyLoad * 0.2;
    for (let d = 0; d < Math.min(remainingDays, 7); d++) {
      fitness = fitness + (reducedLoad - fitness) * (1 - Math.exp(-1 / tauFitness));
      fatigue = fatigue + (reducedLoad - fatigue) * (1 - Math.exp(-1 / tauFatigue));
    }
  }

  const peakFormDay = new Date(event);
  peakFormDay.setDate(peakFormDay.getDate() - 1);

  return {
    weeks,
    peakFormDate: peakFormDay.toISOString().split('T')[0],
    expectedFormAtEvent: Math.round((fitness - fatigue) * 100) / 100,
    currentFitness,
    expectedFitnessAtEvent: Math.round(fitness * 100) / 100,
    taperMultipliers: multipliers,
  };
}

export interface SeasonComparison {
  seasons: SeasonData[];
}

export interface SeasonData {
  year: number;
  startDate: string;
  endDate: string;
  totalSessions: number;
  totalImpulse: number;
  avgWeeklyImpulse: number;
  peakFitness: number;
  peakWeekImpulse: number;
  byType: Record<string, number>;
  monthly: { month: string; impulse: number }[];
}

export function compareSeasons(
  sessions: Session[],
  fitnessHistory: { date: string; fitness: number }[]
): SeasonComparison {
  const yearMap = new Map<number, Session[]>();

  for (const s of sessions) {
    const year = new Date(s.session_date).getFullYear();
    if (!yearMap.has(year)) yearMap.set(year, []);
    yearMap.get(year)!.push(s);
  }

  const seasons: SeasonData[] = [];

  for (const [year, yearlySessions] of yearMap.entries()) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const totalSessions = yearlySessions.length;
    const totalImpulse = yearlySessions.reduce((sum, s) => sum + s.impulse, 0);
    const weeksInYear = 52;
    const avgWeeklyImpulse = totalImpulse / weeksInYear;

    const yearFitness = fitnessHistory.filter(h => h.date.startsWith(String(year)));
    const peakFitness = yearFitness.length > 0 ? Math.max(...yearFitness.map(h => h.fitness)) : 0;

    const weeklyMap = new Map<string, number>();
    for (const s of yearlySessions) {
      const d = new Date(s.session_date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      const weekStart = d.toISOString().split('T')[0];
      weeklyMap.set(weekStart, (weeklyMap.get(weekStart) ?? 0) + s.impulse);
    }
    const peakWeekImpulse = weeklyMap.size > 0 ? Math.max(...weeklyMap.values()) : 0;

    const byType: Record<string, number> = {};
    for (const s of yearlySessions) {
      byType[s.session_type] = (byType[s.session_type] ?? 0) + s.impulse;
    }

    const monthlyMap = new Map<string, number>();
    for (const s of yearlySessions) {
      const month = s.session_date.substring(0, 7);
      monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + s.impulse);
    }
    const monthly = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, impulse]) => ({ month, impulse: Math.round(impulse * 10) / 10 }));

    seasons.push({
      year,
      startDate,
      endDate,
      totalSessions,
      totalImpulse: Math.round(totalImpulse * 10) / 10,
      avgWeeklyImpulse: Math.round(avgWeeklyImpulse * 10) / 10,
      peakFitness: Math.round(peakFitness * 100) / 100,
      peakWeekImpulse: Math.round(peakWeekImpulse * 10) / 10,
      byType,
      monthly,
    });
  }

  return { seasons: seasons.sort((a, b) => a.year - b.year) };
}
