import type { DailyBannisterResult, DailyCompartmentResult, EngineOutput } from '../engine/types';
import type { Session, NutritionLog } from '../database.types';

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map(row => row.map(escape).join(',')).join('\n');
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportBannisterHistory(history: DailyBannisterResult[], athleteName: string) {
  const headers = ['Date', 'Fitness', 'Fatigue', 'Form', 'RecoveryRatio', 'Impulse', 'TauFitness', 'TauFatigue', 'kMultiplier'];
  const rows = history.map(d => [d.date, d.fitness, d.fatigue, d.form, d.recoveryRatio, d.impulse, d.tauFitness, d.tauFatigue, d.kMultiplier]);
  downloadCsv(toCsv(headers, rows), `${athleteName}_bannister_history_${today()}.csv`);
}

export function exportCompartmentHistory(history: DailyCompartmentResult[], athleteName: string) {
  const headers = [
    'Date',
    'Aerobic_Fitness', 'Aerobic_Fatigue', 'Aerobic_Form',
    'Glycolytic_Fitness', 'Glycolytic_Fatigue', 'Glycolytic_Form',
    'Neuromuscular_Fitness', 'Neuromuscular_Fatigue', 'Neuromuscular_Form',
    'Total_Fitness', 'Total_Fatigue', 'Total_Form',
    'Impulse_Aerobic', 'Impulse_Glycolytic', 'Impulse_Neuromuscular', 'Impulse_Total',
  ];
  const rows = history.map(d => [
    d.date,
    d.aerobic.fitness, d.aerobic.fatigue, d.aerobic.form,
    d.glycolytic.fitness, d.glycolytic.fatigue, d.glycolytic.form,
    d.neuromuscular.fitness, d.neuromuscular.fatigue, d.neuromuscular.form,
    d.total.fitness, d.total.fatigue, d.total.form,
    d.impulse.aerobic, d.impulse.glycolytic, d.impulse.neuromuscular, d.impulse.total,
  ]);
  downloadCsv(toCsv(headers, rows), `${athleteName}_compartment_history_${today()}.csv`);
}

export function exportSessions(sessions: Session[], athleteName: string) {
  const headers = ['Date', 'Type', 'Title', 'Duration_min', 'Impulse', 'AvgPower_W', 'NP_W', 'AvgHR', 'RPE', 'Distance_km', 'Elevation_m', 'Notes'];
  const rows = sessions.map(s => [
    s.session_date,
    s.session_type,
    s.title,
    s.duration_min,
    s.impulse,
    s.avg_power_watts ?? '',
    s.normalized_power_watts ?? '',
    s.avg_hr ?? '',
    s.rpe ?? '',
    s.distance_km ?? '',
    s.elevation_m ?? '',
    s.notes,
  ]);
  downloadCsv(toCsv(headers, rows), `${athleteName}_sessions_${today()}.csv`);
}

export function exportNutrition(logs: NutritionLog[], athleteName: string) {
  const headers = ['Date', 'Calories', 'Protein_g', 'Carbs_g', 'Fat_g', 'Hydration_ml', 'Sleep_h', 'SleepQuality', 'Notes'];
  const rows = logs.map(l => [l.log_date, l.calories, l.protein_g, l.carbs_g, l.fat_g, l.hydration_ml, l.sleep_hours, l.sleep_quality ?? '', l.notes]);
  downloadCsv(toCsv(headers, rows), `${athleteName}_nutrition_${today()}.csv`);
}

export function exportFullReport(engine: EngineOutput, sessions: Session[], athleteName: string) {
  exportBannisterHistory(engine.history, athleteName);
  setTimeout(() => exportCompartmentHistory(engine.compartmentHistory, athleteName), 300);
  setTimeout(() => exportSessions(sessions, athleteName), 600);
}

export function exportTrainingPeaksCsv(sessions: Session[], athleteName: string) {
  const headers = [
    'Date', 'Title', 'WorkoutType', 'Description',
    'TimeTotalInHours', 'DistanceInMeters', 'MaximumHeartRateinBPM',
    'AverageHeartRateinBPM', 'PowerAverageinWatts', 'PowerNormalizedinWatts',
    'ElevationGainInMeters', 'RPE', 'Feeling',
  ];
  const typeMap: Record<string, string> = {
    cycling: 'Bike',
    running: 'Run',
    strength: 'Strength',
    endurance: 'Bike',
    swimming: 'Swim',
    beach_volleyball: 'Other',
    other: 'Other',
  };
  const rows = sessions.map(s => [
    s.session_date,
    s.title || `${typeMap[s.session_type] ?? 'Other'} Session`,
    typeMap[s.session_type] ?? 'Other',
    s.notes || '',
    (s.duration_min / 60).toFixed(4),
    s.distance_km ? (s.distance_km * 1000).toFixed(0) : '',
    s.max_hr ?? '',
    s.avg_hr ?? '',
    s.avg_power_watts ?? '',
    s.normalized_power_watts ?? '',
    s.elevation_m ?? '',
    s.rpe ?? '',
    s.how_felt ?? '',
  ]);
  downloadCsv(toCsv(headers, rows), `${athleteName}_TrainingPeaks_${today()}.csv`);
}

export function exportMonthlySummary(sessions: Session[], athleteName: string) {
  const monthMap: Record<string, { sessions: number; totalMin: number; totalImpulse: number; avgRpe: number; rpeCount: number; types: Set<string> }> = {};
  for (const s of sessions) {
    const month = s.session_date.substring(0, 7);
    if (!monthMap[month]) monthMap[month] = { sessions: 0, totalMin: 0, totalImpulse: 0, avgRpe: 0, rpeCount: 0, types: new Set() };
    const m = monthMap[month];
    m.sessions++;
    m.totalMin += s.duration_min;
    m.totalImpulse += s.impulse;
    if (s.rpe) { m.avgRpe += s.rpe; m.rpeCount++; }
    m.types.add(s.session_type);
  }
  const headers = ['Month', 'Sessions', 'TotalHours', 'TotalImpulse', 'AvgImpulse', 'AvgRPE', 'SportTypes'];
  const rows = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).map(([month, m]) => [
    month,
    m.sessions,
    (m.totalMin / 60).toFixed(1),
    m.totalImpulse.toFixed(3),
    (m.totalImpulse / m.sessions).toFixed(3),
    m.rpeCount > 0 ? (m.avgRpe / m.rpeCount).toFixed(1) : '',
    [...m.types].join(';'),
  ]);
  downloadCsv(toCsv(headers, rows), `${athleteName}_monthly_summary_${today()}.csv`);
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}
