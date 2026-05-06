import type { Session } from '../database.types';

export interface ZoneEntry {
  zone: number;
  name: string;
  color: string;
  minPower: number;
  maxPower: number;
  minHR?: number;
  maxHR?: number;
  timeSeconds: number;
  timePct: number;
  tss: number;
}

export interface ZoneDistribution {
  zones: ZoneEntry[];
  totalTimeSeconds: number;
  polarizationIndex: number;
  pyramidScore: number;
  distributionType: 'polarized' | 'pyramidal' | 'threshold' | 'sweet_spot' | 'mixed';
  z1Pct: number;
  z2Pct: number;
  z3to7Pct: number;
}

export function computeZoneDistribution(
  sessions: Session[],
  cp: number,
  maxHr: number,
  restHr: number
): ZoneDistribution {
  const zoneDefs = getPowerZoneDefinitions(cp, maxHr, restHr);
  const zoneTimeMap = new Map<number, number>();

  for (let i = 1; i <= 7; i++) zoneTimeMap.set(i, 0);

  for (const session of sessions) {
    const durationSec = session.duration_min * 60;
    if (durationSec <= 0) continue;

    const power = session.normalized_power_watts ?? session.avg_power_watts;
    const hr = session.avg_hr;

    let zone = 3;
    if (power) {
      zone = getZoneByPower(power, zoneDefs);
    } else if (hr) {
      zone = getZoneByHR(hr, maxHr, restHr);
    } else if (session.rpe) {
      zone = getZoneByRPE(session.rpe);
    }

    zoneTimeMap.set(zone, (zoneTimeMap.get(zone) ?? 0) + durationSec);
  }

  const totalTimeSeconds = Array.from(zoneTimeMap.values()).reduce((a, b) => a + b, 0);

  const zones: ZoneEntry[] = zoneDefs.map(def => {
    const timeSeconds = zoneTimeMap.get(def.zone) ?? 0;
    const timePct = totalTimeSeconds > 0 ? (timeSeconds / totalTimeSeconds) * 100 : 0;
    const tss = estimateZoneTSS(def.zone, timeSeconds / 3600);
    return {
      ...def,
      timeSeconds,
      timePct: Math.round(timePct * 10) / 10,
      tss: Math.round(tss * 10) / 10,
    };
  });

  const z1z2Time = (zoneTimeMap.get(1) ?? 0) + (zoneTimeMap.get(2) ?? 0);
  const z3to7Time = Array.from({ length: 5 }, (_, i) => zoneTimeMap.get(i + 3) ?? 0).reduce((a, b) => a + b, 0);
  const z3time = zoneTimeMap.get(3) ?? 0;
  const z4to7Time = Array.from({ length: 4 }, (_, i) => zoneTimeMap.get(i + 4) ?? 0).reduce((a, b) => a + b, 0);

  const z1Pct = totalTimeSeconds > 0 ? (z1z2Time / totalTimeSeconds) * 100 : 0;
  const z2Pct = totalTimeSeconds > 0 ? (z3time / totalTimeSeconds) * 100 : 0;
  const z3to7Pct = totalTimeSeconds > 0 ? (z4to7Time / totalTimeSeconds) * 100 : 0;

  const polarizationIndex = z3to7Pct > 0 ? z1Pct / z3to7Pct : 0;

  const distributionType = classifyDistribution(z1Pct, z2Pct, z3to7Pct);

  const highLowRatio = z1Pct > 0 ? z3to7Pct / z1Pct : 0;

  return {
    zones,
    totalTimeSeconds,
    polarizationIndex: Math.round(polarizationIndex * 100) / 100,
    pyramidScore: Math.round(highLowRatio * 100) / 100,
    distributionType,
    z1Pct: Math.round(z1Pct * 10) / 10,
    z2Pct: Math.round(z2Pct * 10) / 10,
    z3to7Pct: Math.round(z3to7Pct * 10) / 10,
  };
}

function classifyDistribution(
  z1z2Pct: number,
  z3Pct: number,
  z4to7Pct: number
): ZoneDistribution['distributionType'] {
  if (z1z2Pct >= 70 && z4to7Pct >= 15) return 'polarized';
  if (z1z2Pct >= 60 && z3Pct >= 20 && z3Pct > z4to7Pct) return 'pyramidal';
  if (z3Pct >= 35) return 'threshold';
  if (z3Pct >= 25 && z4to7Pct >= 10) return 'sweet_spot';
  return 'mixed';
}

function getPowerZoneDefinitions(cp: number, maxHr: number, restHr: number) {
  const hrRange = maxHr - restHr;
  return [
    { zone: 1, name: 'Active Recovery', color: '#94a3b8', minPower: 0, maxPower: Math.round(cp * 0.55), minHR: restHr, maxHR: Math.round(restHr + hrRange * 0.60) },
    { zone: 2, name: 'Endurance', color: '#22c55e', minPower: Math.round(cp * 0.55), maxPower: Math.round(cp * 0.75), minHR: Math.round(restHr + hrRange * 0.60), maxHR: Math.round(restHr + hrRange * 0.72) },
    { zone: 3, name: 'Tempo', color: '#84cc16', minPower: Math.round(cp * 0.75), maxPower: Math.round(cp * 0.90), minHR: Math.round(restHr + hrRange * 0.72), maxHR: Math.round(restHr + hrRange * 0.83) },
    { zone: 4, name: 'Threshold', color: '#f59e0b', minPower: Math.round(cp * 0.90), maxPower: Math.round(cp * 1.05), minHR: Math.round(restHr + hrRange * 0.83), maxHR: Math.round(restHr + hrRange * 0.91) },
    { zone: 5, name: 'VO2max', color: '#ef4444', minPower: Math.round(cp * 1.05), maxPower: Math.round(cp * 1.20), minHR: Math.round(restHr + hrRange * 0.91), maxHR: Math.round(restHr + hrRange * 0.97) },
    { zone: 6, name: 'Anaerobic', color: '#dc2626', minPower: Math.round(cp * 1.20), maxPower: Math.round(cp * 1.50), minHR: Math.round(restHr + hrRange * 0.97), maxHR: maxHr },
    { zone: 7, name: 'Neuromuscular', color: '#111827', minPower: Math.round(cp * 1.50), maxPower: 9999, minHR: maxHr, maxHR: 999 },
  ];
}

function getZoneByPower(power: number, zones: ReturnType<typeof getPowerZoneDefinitions>): number {
  for (let i = zones.length - 1; i >= 0; i--) {
    if (power >= zones[i].minPower) return zones[i].zone;
  }
  return 1;
}

function getZoneByHR(hr: number, maxHr: number, restHr: number): number {
  const hrr = (hr - restHr) / (maxHr - restHr);
  if (hrr < 0.60) return 1;
  if (hrr < 0.72) return 2;
  if (hrr < 0.83) return 3;
  if (hrr < 0.91) return 4;
  if (hrr < 0.97) return 5;
  return 6;
}

function getZoneByRPE(rpe: number): number {
  if (rpe <= 3) return 1;
  if (rpe <= 4) return 2;
  if (rpe <= 6) return 3;
  if (rpe <= 7) return 4;
  if (rpe <= 8) return 5;
  if (rpe <= 9) return 6;
  return 7;
}

function estimateZoneTSS(zone: number, hours: number): number {
  const intensityFactors = [0.55, 0.68, 0.83, 0.97, 1.10, 1.30, 1.50];
  const if_ = intensityFactors[zone - 1] ?? 0.68;
  return hours * Math.pow(if_, 2) * 100;
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
