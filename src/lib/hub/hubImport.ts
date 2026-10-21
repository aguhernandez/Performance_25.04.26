import type { HubTrainingSchedule, HubPowerStream } from './hubApiService';
import type { SessionInsert, SessionType } from '../database.types';

const SPORT_MAP: Record<string, SessionType> = {
  cycling: 'cycling',
  bike: 'cycling',
  run: 'running',
  running: 'running',
  swim: 'endurance',
  swiming: 'endurance',
  strength: 'strength',
  weight_training: 'strength',
  crossfit: 'strength',
  hike: 'endurance',
  walk: 'endurance',
  yoga: 'other',
  default: 'endurance',
};

function mapSport(sport: string | null | undefined): SessionType {
  if (!sport) return 'endurance';
  const lower = sport.toLowerCase().trim();
  return SPORT_MAP[lower] ?? 'endurance';
}

function workoutTypeToTss(workout: HubTrainingSchedule['workouts'][number]): number {
  if (workout.tss !== null && workout.tss > 0) return workout.tss;
  const dur = workout.actual_duration_minutes ?? workout.estimated_duration_minutes ?? 0;
  const intensityGuess =
    workout.intensity_zone === 'red' ? 1.1 :
    workout.intensity_zone === 'yellow' ? 0.85 : 0.7;
  return (dur / 60) * intensityGuess * intensityGuess * 100;
}

/**
 * Convert Hub training schedule workouts into local SessionInsert rows.
 * Each workout becomes one session with an impulse estimate from TSS.
 */
export function hubWorkoutsToSessions(
  workouts: HubTrainingSchedule['workouts'],
  athleteId: string
): SessionInsert[] {
  return workouts
    .filter(w => w.status === 'completed' || w.status === 'done' || w.actual_duration_minutes !== null)
    .map(w => {
      const duration = w.actual_duration_minutes ?? w.estimated_duration_minutes ?? 0;
      const tss = workoutTypeToTss(w);
      return {
        athlete_id: athleteId,
        session_date: w.scheduled_date,
        session_type: mapSport(w.sport),
        title: w.name || `${w.sport ?? 'Training'} — Hub`,
        duration_min: duration,
        impulse: tss,
        rpe: null,
        avg_power_watts: null,
        avg_hr: null,
        distance_km: null,
        notes: `Imported from Hub (Strava). Workout type: ${w.workout_type}. Status: ${w.status}.`,
        raw_data: { hub_workout_id: w.id, hub_tss: w.tss, hub_intensity_zone: w.intensity_zone },
      } as SessionInsert;
    });
}

/**
 * Convert Hub power-stream activities into SessionInsert rows.
 * These have richer data (power, HR series) so we can compute avg power/HR.
 */
export function hubPowerStreamsToSessions(
  streams: HubPowerStream[],
  athleteId: string
): SessionInsert[] {
  return streams.map(s => {
    const watts = s.series?.watts ?? [];
    const hr = s.series?.hr ?? [];
    const validWatts = watts.filter((w): w is number => w !== null && w > 0);
    const validHr = hr.filter((h): h is number => h !== null && h > 0);
    const avgPower = validWatts.length > 0 ? validWatts.reduce((a, b) => a + b, 0) / validWatts.length : null;
    const avgHr = validHr.length > 0 ? validHr.reduce((a, b) => a + b, 0) / validHr.length : null;
    const durationMin = Math.round((s.series?.time_s?.length ?? 0) / 60);

    return {
      athlete_id: athleteId,
      session_date: s.activity_date,
      session_type: mapSport(s.sport),
      title: `Hub Activity ${s.activity_id.slice(0, 8)}`,
      duration_min: durationMin,
      avg_power_watts: avgPower ? Math.round(avgPower) : null,
      avg_hr: avgHr ? Math.round(avgHr) : null,
      impulse: 0, // will be computed by the engine on recompute
      distance_km: null,
      notes: `Imported from Hub power stream. Activity ID: ${s.activity_id}.`,
      raw_data: { hub_activity_id: s.activity_id, stream_points: s.series?.time_s?.length ?? 0 },
    } as SessionInsert;
  });
}
