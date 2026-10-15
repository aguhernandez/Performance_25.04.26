// Alert thresholds for the coach roster — single source of truth,
// configurable later without touching component code.

export const ROSTER_ALERTS = {
  rampRate: { amber: 6, red: 8 },
  form: { amber: -30, red: -40 },
  impulseRatio: { amber: 1.3 },
  monotony: { amber: 2.0 },
  staleDays: { info: 5 },
  estimatedShare: { info: 0.5 },
} as const;

export type AlertLevel = 'red' | 'amber' | 'info' | 'ok';

export interface RosterAlert {
  level: AlertLevel;
  reason: string;
}

export interface RosterRow {
  athlete_id: string;
  name: string;
  sport: string;
  coach_id: string | null;
  coach_name: string | null;
  fitness: number | null;
  fatigue: number | null;
  form: number | null;
  ramp_rate: number | null;
  impulse_7d: number | null;
  avg_weekly_impulse_prev_4w: number | null;
  last_session_date: string | null;
  estimated_share_14d: number | null;
  latest_monotony: number | null;
  cp_watts: number | null;
  ftp_watts: number | null;
  suggested_cp: number | null;
  cp_suggestion_pending: boolean;
}

export function daysSince(dateISO: string | null, todayISO: string): number | null {
  if (!dateISO) return null;
  return Math.round(
    (Date.parse(todayISO) - Date.parse(dateISO)) / 86400000
  );
}

/** Row-level alerts, worst first. Levels: red > amber > info. */
export function rosterAlerts(row: RosterRow, todayISO: string): RosterAlert[] {
  const alerts: RosterAlert[] = [];
  const T = ROSTER_ALERTS;

  if (row.ramp_rate !== null) {
    const r = Number(row.ramp_rate);
    if (r > T.rampRate.red) alerts.push({ level: 'red', reason: `Ramp rate ${r.toFixed(1)} (red > ${T.rampRate.red})` });
    else if (r > T.rampRate.amber) alerts.push({ level: 'amber', reason: `Ramp rate ${r.toFixed(1)} (amber > ${T.rampRate.amber})` });
  }

  if (row.form !== null) {
    const f = Number(row.form);
    if (f < T.form.red) alerts.push({ level: 'red', reason: `Form ${f.toFixed(0)} (red < ${T.form.red})` });
    else if (f < T.form.amber) alerts.push({ level: 'amber', reason: `Form ${f.toFixed(0)} (amber < ${T.form.amber})` });
  }

  if (
    row.impulse_7d !== null &&
    row.avg_weekly_impulse_prev_4w !== null &&
    Number(row.avg_weekly_impulse_prev_4w) > 0
  ) {
    const ratio = Number(row.impulse_7d) / Number(row.avg_weekly_impulse_prev_4w);
    if (ratio > T.impulseRatio.amber) {
      alerts.push({ level: 'amber', reason: `7-day impulse ${ratio.toFixed(2)}× the previous 4-week average` });
    }
  }

  if (row.latest_monotony !== null && Number(row.latest_monotony) > T.monotony.amber) {
    alerts.push({ level: 'amber', reason: `Monotony ${Number(row.latest_monotony).toFixed(2)} (> ${T.monotony.amber})` });
  }

  const since = daysSince(row.last_session_date, todayISO);
  if (since !== null && since >= T.staleDays.info) {
    alerts.push({ level: 'info', reason: `No session in ${since} days` });
  }

  if (row.estimated_share_14d !== null && Number(row.estimated_share_14d) > T.estimatedShare.info) {
    alerts.push({ level: 'info', reason: 'Low data quality — mostly estimated load in the last 14 days' });
  }

  if (row.cp_suggestion_pending) {
    alerts.push({ level: 'info', reason: 'Pending model-CP suggestion' });
  }

  const rank: Record<AlertLevel, number> = { red: 0, amber: 1, info: 2, ok: 3 };
  return alerts.sort((a, b) => rank[a.level] - rank[b.level]);
}

export function worstLevel(alerts: RosterAlert[]): AlertLevel {
  if (alerts.length === 0) return 'ok';
  return alerts[0].level;
}

export const LEVEL_COLORS: Record<AlertLevel, string> = {
  red: '#dc2626',
  amber: '#f59e0b',
  info: '#3b82f6',
  ok: '#22c55e',
};

export function formLabel(form: number | null): { label: string; color: string } | null {
  if (form === null) return null;
  const f = Number(form);
  if (f > 15) return { label: 'Fresh', color: '#0ea5e9' };
  if (f >= -10) return { label: 'Balanced', color: '#22c55e' };
  if (f >= -30) return { label: 'Productive load', color: '#f59e0b' };
  return { label: 'High fatigue', color: '#dc2626' };
}
