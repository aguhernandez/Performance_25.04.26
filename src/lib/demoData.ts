import type { SessionInsert } from './database.types';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function rand(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

type SessionPattern = {
  dayOffset: number;
  type: SessionInsert['session_type'];
  title: string;
  duration: number;
  rpe: number;
  avgPower?: number;
  avgHr?: number;
  distance?: number;
  elevation?: number;
  intention?: string;
};

const WEEK_PATTERN: Omit<SessionPattern, 'dayOffset'>[] = [
  { type: 'cycling', title: 'Zone 2 Base Ride', duration: 90, rpe: 5, avgPower: 200, avgHr: 140, distance: 45, intention: 'aerobic' },
  { type: 'strength', title: 'Lower Body Strength', duration: 60, rpe: 7, intention: 'power' },
  { type: 'cycling', title: 'Threshold Intervals', duration: 75, rpe: 8, avgPower: 260, avgHr: 163, distance: 38, intention: 'threshold' },
  { type: 'running', title: 'Easy Run', duration: 40, rpe: 4, avgHr: 132, distance: 6, intention: 'aerobic' },
  { type: 'cycling', title: 'Long Endurance Ride', duration: 150, rpe: 6, avgPower: 185, avgHr: 138, distance: 75, elevation: 800, intention: 'aerobic' },
];

export function generateDemoSessions(athleteId: string, cpWatts = 250): SessionInsert[] {
  const sessions: SessionInsert[] = [];
  const totalDays = 90;
  const sessionDayOffsets: SessionPattern[] = [];

  for (let week = 0; week < 13; week++) {
    const isTaperWeek = week >= 11;
    const isRecoveryWeek = week === 3 || week === 7;
    const loadMultiplier = isTaperWeek ? 0.55 : isRecoveryWeek ? 0.65 : 1.0;

    WEEK_PATTERN.forEach((pattern, dayInWeek) => {
      const dayOffset = totalDays - (week * 7) - dayInWeek - 1;
      if (dayOffset < 0) return;

      if (dayInWeek === 3 && Math.random() < 0.3) return;

      sessionDayOffsets.push({
        ...pattern,
        dayOffset,
        duration: Math.round(pattern.duration * loadMultiplier * (0.9 + Math.random() * 0.2)),
        rpe: Math.max(1, Math.min(10, Math.round(pattern.rpe * loadMultiplier + (Math.random() - 0.5)))),
        avgPower: pattern.avgPower ? Math.round(pattern.avgPower * (0.95 + Math.random() * 0.1)) : undefined,
        avgHr: pattern.avgHr ? Math.round(pattern.avgHr * (0.97 + Math.random() * 0.06)) : undefined,
        distance: pattern.distance ? Math.round(pattern.distance * loadMultiplier * (0.9 + Math.random() * 0.2) * 10) / 10 : undefined,
      });
    });
  }

  for (const s of sessionDayOffsets) {
    let impulse = 0;
    if (s.type === 'cycling' || s.type === 'endurance') {
      const relIntensity = s.avgPower ? (s.avgPower / cpWatts) : (s.rpe / 10);
      impulse = (s.duration / 60) * Math.pow(relIntensity, 2);
    } else if (s.type === 'running') {
      impulse = (s.duration / 60) * Math.pow((s.rpe / 10) * 0.9, 2);
    } else if (s.type === 'strength') {
      impulse = (s.duration / 60) * 0.15 * (s.rpe / 10);
    }

    sessions.push({
      athlete_id: athleteId,
      session_date: daysAgo(s.dayOffset),
      session_type: s.type,
      title: s.title,
      duration_min: s.duration,
      rpe: s.rpe,
      avg_power_watts: s.avgPower,
      avg_hr: s.avgHr,
      distance_km: s.distance,
      elevation_m: s.elevation,
      impulse: Math.round(impulse * 10000) / 10000,
      notes: '',
      training_intention: s.intention as SessionInsert['training_intention'],
    });
  }

  return sessions.sort((a, b) => b.session_date.localeCompare(a.session_date));
}

export const DEMO_NUTRITION_LOG_TEMPLATE = {
  calories: 2800,
  protein_g: 155,
  carbs_g: 380,
  fat_g: 85,
  hydration_ml: 2800,
  sleep_hours: 7.5,
  sleep_quality: 4,
};
