import type { Athlete, Session, NutritionLog, HrvLog, LabTest } from '../database.types';
import type { HubSnapshot } from '../../hooks/useHubData';
import { HubApiError, type HubPowerStream } from './hubApiService';

export const PERFORMANCE_BRIDGE = 'https://ngkcbygyoobqhlmlnuvl.supabase.co/functions/v1/performance-hub-bridge';
// The satellite JWT is issued by Hub, independently of Performance's local DB session.
export async function performanceRead<T>(path: string, token: string, params: Record<string, string>): Promise<T> {
  const jwt = localStorage.getItem('hub_session_token');
  if (!jwt) throw new HubApiError(401, 'Inicia sesión en Hub para consultar los datos del atleta');
  const url = new URL(`${PERFORMANCE_BRIDGE}/${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { headers: { Authorization: `Bearer ${jwt}`, 'X-Planner-Token': token } });
  const body = await response.json();
  if (!response.ok) throw new HubApiError(response.status, body.error ?? 'Error de lectura del Hub');
  return body as T;
}

// JSON at the integration boundary is normalized here, never cast directly to UI types.
type Row = Record<string, any>;
export interface HubContextResponse { athlete: Row; data: Record<string, Row[]>; errors: Record<string, string> }
const num = (value: unknown): number | null => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const date = (value: unknown) => String(value ?? '').slice(0, 10);
const sortDate = <T extends Row>(rows: T[], key: string) => [...rows].sort((a, b) => String(b[key] ?? '').localeCompare(String(a[key] ?? '')));
export function sportType(value: unknown): Session['session_type'] {
  const sport = String(value ?? '').toLowerCase().replace(/[ _-]/g, '');
  if (['ride', 'virtualride', 'ebikeride', 'cycling', 'bike', 'mountainbike', 'gravelride'].includes(sport)) return 'cycling';
  if (['run', 'virtualrun', 'trailrun', 'running', 'trailrunning'].includes(sport)) return 'running';
  if (['strength', 'gym', 'weighttraining', 'strengthtraining', 'crossfit'].includes(sport)) return 'strength';
  if (sport === 'yoga' || sport === 'other') return 'other';
  return 'endurance';
}

export function normalizeHubContext(response: HubContextResponse): HubSnapshot {
  const { data: d, athlete } = response;
  const passports = sortDate(d.passport ?? [], 'measurement_date');
  const passport = passports.find(p => p.status === 'active') ?? null;
  const measurements = [
    ...(d.kerr ?? []).map(m => ({ measured_at: date(m.measurement_date ?? m.created_at), method: 'Kerr', weight_kg: num(m.body_mass_kg ?? m.weight_median), height_cm: num(m.height_cm ?? m.height_median), fat_pct: num(m.fat_pct ?? m.fat_mass_pct), fat_mass_kg: num(m.fat_mass_kg), lean_mass_kg: null, muscle_mass_kg: num(m.muscle_mass_kg), bone_mass_kg: num(m.bone_mass_kg) })),
    ...(d.anthropometry ?? []).map(m => ({ measured_at: date(m.calculated_at), method: 'ISAK', weight_kg: num(m.weight_avg), height_cm: num(m.height_avg), fat_pct: num(m.fat_percentage), fat_mass_kg: num(m.fat_mass_kg), lean_mass_kg: num(m.lean_mass_kg), muscle_mass_kg: null, bone_mass_kg: null })),
    ...(d.bioimpedance ?? []).map(m => ({ measured_at: date(m.measurement_date), method: 'Bioimpedancia', weight_kg: num(m.weight), height_cm: num(m.height), fat_pct: num(m.adipose_tissue_percent), fat_mass_kg: num(m.adipose_tissue_kg), lean_mass_kg: num(m.weight) !== null && num(m.adipose_tissue_kg) !== null ? Number(m.weight) - Number(m.adipose_tissue_kg) : null, muscle_mass_kg: num(m.muscle_mass_kg), bone_mass_kg: num(m.bone_tissue_kg) })),
    ...(d.measurements ?? []).map(m => ({ measured_at: date(m.measurement_date), method: 'Antropometría', weight_kg: num(m.body_mass_median), height_cm: num(m.stature_median), fat_pct: null, fat_mass_kg: null, lean_mass_kg: null, muscle_mass_kg: null, bone_mass_kg: null })),
  ].sort((a, b) => b.measured_at.localeCompare(a.measured_at));
  const wellness = sortDate(d.wellness ?? [], 'checkin_date').map(w => ({
    checkin_date: date(w.checkin_date), fatigue: num(w.fatigue_level_10) ?? (num(w.fatigue_level) === null ? null : Number(w.fatigue_level) * 2),
    sleep_quality: num(w.sleep_quality_10) ?? (num(w.sleep_quality) === null ? null : Number(w.sleep_quality) * 2),
    sleep_hours: num(w.sleep_hours) ?? ({ '>8h': 8.5, '7-8h': 7.5, '6-7h': 6.5, '<6h': 5.5 } as Record<string, number>)[w.sleep_duration] ?? null, hrv: num(w.hrv), resting_hr: num(w.rhr), stress: num(w.stress_level_10) ?? (num(w.stress_level) === null ? null : Number(w.stress_level) * 2),
    motivation: num(w.motivation_10) ?? (num(w.motivation) === null ? null : Number(w.motivation) * 2), muscle_soreness: num(w.muscle_soreness), general_wellbeing: num(w.wellness_score_100) === null ? num(w.overall_score) : Number(w.wellness_score_100) / 10, notes: w.general_notes ?? w.injury_notes ?? null,
  }));
  const body = measurements[0];
  return {
    athleteProfile: { athlete: { id: athlete.id, full_name: athlete.full_name, email: athlete.email, sport: athlete.sport, date_of_birth: athlete.date_of_birth, gender: athlete.gender }, body_composition: body ? { fat_mass_kg: body.fat_mass_kg, lean_mass_kg: body.lean_mass_kg, fat_percent: body.fat_pct, measurement_date: body.measured_at } : null, nutrition_targets: null },
    biologicalPassport: { active_passport: passport as any, passport_history: passports as any },
    anthropometry: { measurements },
    wellness: { latest: wellness[0] ?? null, averages: null, checkins: wellness },
    nutritionData: { plans: [...(d.nutrition ?? []), ...(d.nutritionPlans ?? []).filter(p => !(d.nutrition ?? []).some(n => n.plan_date === p.plan_date))].map(n => ({ plan_date: date(n.plan_date), plan_name: n.plan_name ?? null, fuel_day_type: n.fuel_day_type ?? null, target_kcal: num(n.target_kcal), target_protein_g: num(n.target_protein_g), target_carbs_g: num(n.target_carbs_g), target_fat_g: num(n.target_fat_g), adherence_pct: num(n.adherence_score) })) },
    foodDiary: { entries: (d.diary ?? []).map(n => ({ diary_date: date(n.start_date), total_kcal: num(n.total_calories), total_protein_g: num(n.total_protein_g), total_carbs_g: num(n.total_carbs_g), total_fat_g: num(n.total_fat_g) })) },
    trainingSchedule: { workouts: hubSessions(response, '').map(s => ({ id: s.id, scheduled_date: s.session_date, name: s.title, sport: s.sub_sport ?? s.session_type, workout_type: s.session_type, status: 'completed', estimated_duration_minutes: null, actual_duration_minutes: s.duration_min, tss: null, intensity_zone: null })), weekly_loads: [] },
    habits: null, enduranceData: { plans: (d.endurancePlans ?? []).map(p => ({ week_start_date: date(p.week_start_date), plan_name: p.plan_name ?? null, total_hours: num(p.summary?.total_hours), total_tss: num(p.summary?.total_tss), sessions: num(p.summary?.sessions), notes: p.notes ?? null })) },
    context: response,
  };
}

const baseSession = (id: string, athleteId: string, day: string, title: string, sport: unknown): Session => ({
  id: `hub:${id}`, athlete_id: athleteId, session_date: day, session_type: sportType(sport), sub_sport: String(sport ?? ''), title, notes: 'Fuente: Hub', duration_min: 0, avg_power_watts: null, normalized_power_watts: null, avg_hr: null, max_hr: null, rpe: null, distance_km: null, elevation_m: null, strength_exercises: null, impulse: 0, raw_data: { hub_readonly: true }, sport_specific_data: null, training_intention: null, temperature_c: null, humidity_pct: null, altitude_m_env: null, zone_distribution: null, perceived_difficulty: null, how_felt: null, created_at: day,
});

export function hubSessions(context: HubContextResponse, athleteId: string): Session[] {
  const d = context.data;
  const sessions: Session[] = [];
  const linked = new Set<string>();
  for (const a of d.external ?? []) {
    if ((d.external ?? []).some(other => other.fused_activity_id === a.id)) continue; // Keep the imported activity, suppress its linked GPS copy.
    const s = baseSession(`external:${a.id}`, athleteId, date(a.local_date ?? a.start_time), a.name ?? a.sport_type, a.sport_type);
    Object.assign(s, { duration_min: (num(a.duration_seconds) ?? 0) / 60, avg_power_watts: num(a.average_power ?? a.average_watts), normalized_power_watts: num(a.weighted_avg_watts), avg_hr: num(a.average_heartrate), max_hr: num(a.max_heartrate), distance_km: num(a.distance_meters) === null ? null : Number(a.distance_meters) / 1000, elevation_m: num(a.elevation_gain_meters), rpe: num(a.user_rpe), notes: a.user_notes ?? `Fuente: Hub / ${a.source}` });
    s.raw_data = { hub_readonly: true, hub_activity_id: a.id, hub_source: 'external', hub_athlete_id: context.athlete.id, hub_email: context.athlete.email, streams_available: a.streams_fetched, has_power: a.has_power, has_hr: a.has_heartrate };
    linked.add(String(a.id)); linked.add(String(a.external_id));
    if (a.imported_to_training_log_id) linked.add(a.imported_to_training_log_id);
    sessions.push(s);
  }
  for (const a of d.executed ?? []) {
    const remoteId = a.raw?.external_activity_id ?? a.raw?.external_id ?? a.ow_event_id;
    if (remoteId && linked.has(String(remoteId))) continue;
    const s = baseSession(`executed:${a.id}`, athleteId, date(a.start_time), a.raw?.name ?? a.sport_raw ?? a.sport_category, a.sport_category ?? a.sport_raw);
    Object.assign(s, { duration_min: (num(a.duration_seconds) ?? 0) / 60, avg_hr: num(a.avg_hr), max_hr: num(a.max_hr), distance_km: num(a.distance_m) === null ? null : Number(a.distance_m) / 1000 });
    s.raw_data = { hub_readonly: true, hub_activity_id: a.id, hub_source: 'executed', hub_athlete_id: context.athlete.id, hub_email: context.athlete.email };
    sessions.push(s);
  }
  for (const w of d.completed ?? []) {
    const s = baseSession(`completed:${w.id}`, athleteId, date(w.scheduled_date), w.workout_name, w.sport);
    Object.assign(s, { duration_min: (num(w.duration_seconds) ?? 0) / 60, rpe: num(w.rpe), notes: w.notes ?? 'Fuente: Hub / registro manual' });
    s.raw_data = { hub_readonly: true, hub_workout_id: w.id, hub_planned_workout_id: w.planned_workout_id, hub_time_in_zones: w.time_in_zones, hub_intervals: w.intervals, hub_wellness: w.wellness };
    if (w.time_in_zones && typeof w.time_in_zones === 'object') s.zone_distribution = { z1_min: (num(w.time_in_zones.z1) ?? 0) / 60, z2_min: (num(w.time_in_zones.z2) ?? 0) / 60, z3_min: (num(w.time_in_zones.z3) ?? 0) / 60, z4_min: (num(w.time_in_zones.z4) ?? 0) / 60, z5_min: (num(w.time_in_zones.z5) ?? 0) / 60 };
    // Suppress only an explicit link, never two unrelated sessions on the same date.
    if (!(d.external ?? []).some(a => a.imported_to_training_log_id === w.id || (w.planned_workout_id && a.planned_workout_id === w.planned_workout_id))) sessions.push(s);
  }
  for (const w of d.strength ?? []) {
    const logs = (d.strengthLogs ?? []).filter(l => l.athlete_workout_id === w.id);
    if (w.status !== 'completed' && !logs.length) continue;
    const s = baseSession(`strength:${w.id}`, athleteId, date(w.completed_at ?? logs[0]?.logged_at ?? w.scheduled_date), w.external_title ?? w.workout?.name ?? 'Fuerza', 'strength');
    s.strength_exercises = logs.map(l => ({ name: String(l.workout_exercise_id ?? 'Ejercicio'), sets: 1, reps: num(l.reps_completed) ?? 0, load_kg: num(l.weight_used) ?? 0, rir: num(l.rir) ?? 0, ...(num(l.bar_speed) !== null ? { bar_velocity_ms: Number(l.bar_speed) } : {}) }));
    s.rpe = num(w.rpe); s.notes = w.raw_description ?? 'Fuente: Hub / fuerza';
    s.raw_data = { hub_readonly: true, hub_workout_id: w.id, duration_missing: true };
    if ((!w.external_id || !linked.has(String(w.external_id))) && !logs.some(l => l.external_activity_id && linked.has(String(l.external_activity_id)))) sessions.push(s);
  }
  for (const w of d.extra ?? []) {
    const s = baseSession(`extra:${w.id}`, athleteId, date(w.training_date), w.activity_name, 'other');
    // Hub stores free-text duration; do not interpret "1h" as one minute.
    const duration = String(w.duration ?? '').trim();
    const minutes = duration.match(/^(\d+(?:\.\d+)?)\s*(?:min(?:utos?|utes?)?)?$/i);
    const hours = duration.match(/^(\d+(?:\.\d+)?)\s*h(?:oras?|ours?)?$/i);
    s.duration_min = minutes ? Number(minutes[1]) : hours ? Number(hours[1]) * 60 : 0;
    s.notes = w.notes ?? 'Fuente: Hub / entrenamiento extra';
    sessions.push(s);
  }
  return sessions.sort((a, b) => b.session_date.localeCompare(a.session_date));
}

export function mergeHubWorkspace(athlete: Athlete | null, sessions: Session[], nutrition: NutritionLog[], hrv: HrvLog[], labs: LabTest[], snapshot: HubSnapshot) {
  const context = snapshot.context;
  if (!athlete || !context) return { athlete, sessions, nutritionLogs: nutrition, hrvLogs: hrv, labTests: labs };
  const passport = snapshot.biologicalPassport?.active_passport;
  const mergedAthlete = { ...athlete };
  const set = (key: keyof Athlete, value: unknown) => { const n = num(value); if (n !== null && n > 0) Object.assign(mergedAthlete, { [key]: n }); };
  set('vo2max', passport?.vo2max); set('ftp_watts', passport?.ftp_watts); set('cp_watts', passport?.critical_power); set('hr_lt2_bpm', passport?.lt2_hr);
  set('weight_kg', snapshot.anthropometry?.measurements.find(m => m.weight_kg !== null)?.weight_kg ?? passport?.weight_kg); set('lean_mass_kg', snapshot.anthropometry?.measurements.find(m => m.lean_mass_kg !== null)?.lean_mass_kg ?? passport?.lean_mass_kg); set('resting_hr', snapshot.wellness?.latest?.resting_hr);
  const pace = String(passport?.running_threshold_pace ?? '').match(/^(\d{1,2}):(\d{2})(?:\s*\/\s*km)?$/);
  if (pace && Number(pace[2]) < 60 && Number(pace[1]) * 60 + Number(pace[2]) > 0) set('threshold_speed_kmh', 3600 / (Number(pace[1]) * 60 + Number(pace[2])));
  const remote = hubSessions(context, athlete.id);
  const remoteIds = new Set(remote.flatMap(s => [s.raw_data?.hub_activity_id, s.raw_data?.hub_workout_id]).filter(Boolean));
  const local = sessions.filter(s => !remoteIds.has(s.raw_data?.hub_activity_id) && !remoteIds.has(s.raw_data?.hub_workout_id));
  const hrvRemote: HrvLog[] = (snapshot.wellness?.checkins ?? []).filter(w => w.hrv !== null || w.resting_hr !== null).map(w => ({ id: `hub:hrv:${w.checkin_date}`, athlete_id: athlete.id, log_date: w.checkin_date, rmssd: null, sdnn: null, hrv_score: null, hrv_ms: w.hrv, morning_hr: w.resting_hr, notes: 'Hub: VFC en milisegundos; la fuente no especifica RMSSD/SDNN.', created_at: w.checkin_date }));
  const actualByDate = new Map<string, NutritionLog>();
  for (const n of context.data.nutrition ?? []) {
    if (n.actual_kcal == null) continue;
    actualByDate.set(date(n.plan_date), { id: `hub:nutrition:${n.id}`, athlete_id: athlete.id, log_date: date(n.plan_date), calories: Number(n.actual_kcal), protein_g: num(n.actual_protein_g) ?? 0, carbs_g: num(n.actual_carbs_g) ?? 0, fat_g: num(n.actual_fat_g) ?? 0, hydration_ml: 0, sleep_hours: 0, sleep_quality: null, notes: 'Fuente: consumo real del Hub', created_at: n.created_at });
  }
  const actualDates = new Set(actualByDate.keys());
  for (const n of snapshot.foodDiary?.entries ?? []) {
    if (actualDates.has(n.diary_date) || n.total_kcal === null) continue;
    const previous = actualByDate.get(n.diary_date);
    actualByDate.set(n.diary_date, { id: `hub:diary:${n.diary_date}`, athlete_id: athlete.id, log_date: n.diary_date, calories: (previous?.calories ?? 0) + n.total_kcal, protein_g: (previous?.protein_g ?? 0) + (n.total_protein_g ?? 0), carbs_g: (previous?.carbs_g ?? 0) + (n.total_carbs_g ?? 0), fat_g: (previous?.fat_g ?? 0) + (n.total_fat_g ?? 0), hydration_ml: 0, sleep_hours: 0, sleep_quality: null, notes: 'Fuente: diario alimentario del Hub', created_at: n.diary_date });
  }
  for (const log of actualByDate.values()) {
    const wellness = snapshot.wellness?.checkins.find(w => w.checkin_date === log.log_date);
    log.sleep_hours = wellness?.sleep_hours ?? 0;
    log.sleep_quality = wellness?.sleep_quality ?? null;
  }
  const hrvDates = new Set(hrvRemote.map(h => h.log_date));
  return { athlete: mergedAthlete, sessions: [...local, ...remote].sort((a, b) => b.session_date.localeCompare(a.session_date)), nutritionLogs: [...nutrition.filter(n => !actualByDate.has(n.log_date)), ...actualByDate.values()].sort((a, b) => b.log_date.localeCompare(a.log_date)), hrvLogs: [...hrv.filter(h => !hrvDates.has(h.log_date)), ...hrvRemote], labTests: [...labs, ...(context.data.passport ?? []).map(p => ({ id: `hub:passport:${p.id}`, athlete_id: athlete.id, test_date: date(p.measurement_date), test_type: p.source_test_type ?? 'Pasaporte Hub', vo2max: num(p.vo2max), vlamax: num(p.lab_payload?.vlamax), cp_watts: num(p.critical_power), ftp_watts: num(p.ftp_watts), lactate_threshold_1_watts: num(p.lt1_power), lactate_threshold_2_watts: num(p.lt2_power), lactate_threshold_1_hr: num(p.lt1_hr), lactate_threshold_2_hr: num(p.lt2_hr), fat_max_watts: null, notes: 'Fuente: pasaporte biológico del Hub', raw_data: { ...(p.lab_payload ?? {}), hub_passport_id: p.id, hub_readonly: true }, created_at: p.created_at }))] };
}

export async function fetchHubContext(token: string, athleteEmail: string) {
  return performanceRead<HubContextResponse>('context', token, athleteEmail.includes('@') ? { athlete_email: athleteEmail } : { athlete_id: athleteEmail });
}
export async function fetchHubStream(token: string, athleteEmail: string, activityId: string, source = 'external'): Promise<HubPowerStream> {
  const result = await performanceRead<Row>('streams', token, { ...(athleteEmail.includes('@') ? { athlete_email: athleteEmail } : { athlete_id: athleteEmail }), activity_id: activityId, source });
  if (result.series === null || Array.isArray(result.series?.time_s)) return result as HubPowerStream;
  // Open Wearables uses named, timestamped samples; Strava uses parallel arrays.
  const named = (result.timeseries ?? result.series ?? {}) as Record<string, { timestamp: number; value: number }[]>;
  const points = Object.values(named).filter(Array.isArray).flat();
  const timestamps = [...new Set(points.map(p => p.timestamp).filter(Number.isFinite))].sort((a, b) => a - b);
  const start = timestamps[0] ?? 0;
  const values = (pattern: RegExp) => {
    const entries = Object.entries(named).filter(([key]) => pattern.test(key)).flatMap(([, rows]) => rows);
    if (!entries.length) return null;
    const byTime = new Map(entries.map(p => [p.timestamp, p.value]));
    return timestamps.map(t => byTime.get(t) ?? null);
  };
  return { activity_id: activityId, activity_date: result.activity_date ?? String(result.window?.start_time ?? '').slice(0, 10), sport: result.sport ?? null, series: { time_s: timestamps.map(t => (t - start) / 1000), watts: values(/power/i), hr: values(/heart.?rate|^hr$/i) ?? undefined, speed: values(/speed|velocity/i) ?? undefined, altitude: values(/altitude|elevation/i) ?? undefined } };
}
