import type { EngineOutput, DailyBannisterResult } from '../engine/types';
import type { Athlete, Session, NutritionLog } from '../database.types';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function sparkline(history: DailyBannisterResult[], key: 'fitness' | 'fatigue' | 'form', color: string): string {
  const recent = history.slice(-60);
  if (recent.length < 2) return '';
  const vals = recent.map(d => d[key]);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const W = 200, H = 40;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  }).join(' ');
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}

function buildHtml(engine: EngineOutput, athlete: Athlete, sessions: Session[], nutritionLogs: NutritionLog[]): string {
  const { current, history, warnings, recommendations, multiCompartment, sportBreakdown, performanceIndex, baselinePerformance, adaptationTrend } = engine;

  const recentSessions = [...sessions].sort((a, b) => b.session_date.localeCompare(a.session_date)).slice(0, 10);

  const warnRows = warnings.map(w => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-transform:capitalize">${w.type.replace(/_/g, ' ')}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-transform:capitalize;color:${w.severity === 'high' ? '#dc2626' : w.severity === 'medium' ? '#d97706' : '#64748b'}">${w.severity}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${w.message}</td>
    </tr>`).join('');

  const recRows = recommendations.map(r => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-weight:600">${r.title}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-transform:capitalize;color:${r.priority === 'high' ? '#dc2626' : r.priority === 'medium' ? '#d97706' : '#64748b'}">${r.priority}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${r.actionable}</td>
    </tr>`).join('');

  const sessionRows = recentSessions.map(s => `
    <tr>
      <td style="padding:5px 10px;border-bottom:1px solid #e2e8f0">${formatDate(s.session_date)}</td>
      <td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;text-transform:capitalize">${s.session_type.replace(/_/g, ' ')}</td>
      <td style="padding:5px 10px;border-bottom:1px solid #e2e8f0">${s.title || '—'}</td>
      <td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${s.duration_min}min</td>
      <td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${s.impulse.toFixed(3)}</td>
      <td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${s.rpe ?? '—'}</td>
    </tr>`).join('');

  const fitnessSpark = sparkline(history, 'fitness', '#0ea5e9');
  const fatigueSpark = sparkline(history, 'fatigue', '#f97316');
  const formSpark = sparkline(history, 'form', current.form >= 0 ? '#22c55e' : '#ef4444');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>ASC Impulse Engine — Performance Report: ${athlete.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #1e293b; background: #fff; }
  .page { max-width: 900px; margin: 0 auto; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0ea5e9; padding-bottom: 16px; margin-bottom: 24px; }
  .header-left h1 { font-size: 20px; font-weight: 700; color: #0f172a; }
  .header-left p { color: #64748b; font-size: 11px; margin-top: 2px; }
  .header-right { text-align: right; }
  .header-right .meta { font-size: 10px; color: #94a3b8; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #0ea5e9; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }
  .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .metric-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
  .metric-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 4px; }
  .metric-value { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .metric-sub { font-size: 9px; color: #94a3b8; margin-top: 2px; }
  .sparkline-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .spark-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
  .spark-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { padding: 7px 10px; text-align: left; background: #f1f5f9; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
  th:last-child, td:last-child { text-align: right; }
  .comp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .comp-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
  .comp-name { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
  .comp-row { display: flex; justify-content: space-between; font-size: 10px; padding: 2px 0; }
  .comp-row span:first-child { color: #94a3b8; }
  .profile-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .profile-item { padding: 6px 0; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; }
  .profile-item .lbl { color: #94a3b8; font-size: 10px; }
  .profile-item .val { font-weight: 600; font-size: 11px; }
  .trend-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
  .sport-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .sport-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; text-align: center; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; color: #94a3b8; font-size: 9px; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 20px; }
  }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="header-left">
      <h1>ASC Impulse Engine</h1>
      <p>Scientific Performance Report — ${athlete.name}</p>
    </div>
    <div class="header-right">
      <p class="meta">Generated: ${formatDate(new Date().toISOString())}</p>
      <p class="meta">Sport: ${athlete.sport}</p>
      <p class="meta">Sessions: ${sessions.length} total</p>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Current Performance State</div>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Fitness</div>
        <div class="metric-value" style="color:#0ea5e9">${current.fitness.toFixed(2)}</div>
        <div class="metric-sub">τ₁ = ${current.tau.tauFitness}d</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Fatigue</div>
        <div class="metric-value" style="color:#f97316">${current.fatigue.toFixed(2)}</div>
        <div class="metric-sub">τ₂ = ${current.tau.tauFatigue}d</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Form</div>
        <div class="metric-value" style="color:${current.form >= 0 ? '#22c55e' : '#ef4444'}">${current.form >= 0 ? '+' : ''}${current.form.toFixed(2)}</div>
        <div class="metric-sub">Fitness − Fatigue</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Performance Index</div>
        <div class="metric-value" style="color:#0f172a">${performanceIndex}</div>
        <div class="metric-sub">Baseline: ${baselinePerformance.toFixed(2)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Recovery Ratio</div>
        <div class="metric-value" style="color:${current.recoveryRatio > 1.2 ? '#ef4444' : current.recoveryRatio < 0.6 ? '#64748b' : '#22c55e'}">${(current.recoveryRatio * 100).toFixed(0)}%</div>
        <div class="metric-sub">Fat / Fit ratio</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Adaptation Trend</div>
        <div class="metric-value" style="font-size:13px;color:#0f172a;padding-top:4px">${adaptationTrend.label}</div>
        <div class="metric-sub">${adaptationTrend.direction}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">k Multiplier</div>
        <div class="metric-value" style="color:#0f172a">${current.tau.kMultiplier.toFixed(2)}</div>
        <div class="metric-sub">Fatigue amplification</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Weekly Trend</div>
        <div class="metric-value" style="color:${adaptationTrend.weeklyTrend >= 0 ? '#22c55e' : '#ef4444'}">${adaptationTrend.weeklyTrend >= 0 ? '+' : ''}${adaptationTrend.weeklyTrend.toFixed(3)}</div>
        <div class="metric-sub">Fitness/week</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">60-Day Trends</div>
    <div class="sparkline-grid">
      <div class="spark-card">
        <div class="spark-label">Fitness</div>
        ${fitnessSpark}
      </div>
      <div class="spark-card">
        <div class="spark-label">Fatigue</div>
        ${fatigueSpark}
      </div>
      <div class="spark-card">
        <div class="spark-label">Form</div>
        ${formSpark}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Multi-Compartment State</div>
    <div class="comp-grid">
      ${(['aerobic', 'glycolytic', 'neuromuscular'] as const).map(c => {
        const cs = multiCompartment[c];
        const colors: Record<string, string> = { aerobic: '#0ea5e9', glycolytic: '#f97316', neuromuscular: '#22c55e' };
        return `<div class="comp-card">
          <div class="comp-name" style="color:${colors[c]}">${c}</div>
          <div class="comp-row"><span>Fitness</span><span style="font-weight:600">${cs.fitness.toFixed(3)}</span></div>
          <div class="comp-row"><span>Fatigue</span><span style="font-weight:600">${cs.fatigue.toFixed(3)}</span></div>
          <div class="comp-row"><span>Form</span><span style="font-weight:600;color:${cs.form >= 0 ? '#22c55e' : '#ef4444'}">${cs.form >= 0 ? '+' : ''}${cs.form.toFixed(3)}</span></div>
        </div>`;
      }).join('')}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Sport Breakdown</div>
    <div class="sport-grid">
      ${Object.entries(sportBreakdown).map(([sport, data]) => `
        <div class="sport-card">
          <div style="font-size:10px;font-weight:700;text-transform:capitalize;color:#475569;margin-bottom:4px">${sport.replace(/([A-Z])/g, ' $1')}</div>
          <div style="font-size:16px;font-weight:700">${data.sessions}</div>
          <div style="font-size:9px;color:#94a3b8">sessions</div>
          <div style="font-size:11px;font-weight:600;color:#0ea5e9;margin-top:2px">${data.totalImpulse.toFixed(2)}</div>
          <div style="font-size:9px;color:#94a3b8">total impulse</div>
        </div>`).join('')}
    </div>
  </div>

  ${warnings.length > 0 ? `
  <div class="section">
    <div class="section-title">Active Warnings</div>
    <table>
      <thead><tr><th>Type</th><th>Severity</th><th>Message</th></tr></thead>
      <tbody>${warnRows}</tbody>
    </table>
  </div>` : ''}

  ${recommendations.length > 0 ? `
  <div class="section">
    <div class="section-title">Recommendations</div>
    <table>
      <thead><tr><th>Title</th><th>Priority</th><th>Action</th></tr></thead>
      <tbody>${recRows}</tbody>
    </table>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Athlete Profile</div>
    <div class="profile-grid">
      ${[
        ['VO2max', `${athlete.vo2max} ml/kg/min`],
        ['vLamax', `${athlete.vlamax} mmol/l/s`],
        ['CP', `${athlete.cp_watts} W`],
        ['W/kg (CP)', `${(athlete.cp_watts / athlete.weight_kg).toFixed(2)} W/kg`],
        ['Lean Mass', `${athlete.lean_mass_kg} kg`],
        ['Body Weight', `${athlete.weight_kg} kg`],
        ['Max HR', `${athlete.max_hr} bpm`],
        ['Resting HR', `${athlete.resting_hr} bpm`],
        ['τ₁ Fitness', `${current.tau.tauFitness}d`],
      ].map(([lbl, val]) => `
        <div class="profile-item">
          <span class="lbl">${lbl}</span>
          <span class="val">${val}</span>
        </div>`).join('')}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Recent Sessions (last 10)</div>
    <table>
      <thead><tr><th>Date</th><th>Type</th><th>Title</th><th style="text-align:right">Duration</th><th style="text-align:right">Impulse</th><th style="text-align:right">RPE</th></tr></thead>
      <tbody>${sessionRows}</tbody>
    </table>
  </div>

  ${nutritionLogs.length > 0 ? `
  <div class="section">
    <div class="section-title">Recent Nutrition (last 7 days)</div>
    <table>
      <thead><tr><th>Date</th><th style="text-align:right">Calories</th><th style="text-align:right">Protein</th><th style="text-align:right">Carbs</th><th style="text-align:right">Fat</th><th style="text-align:right">Sleep</th></tr></thead>
      <tbody>
        ${[...nutritionLogs].sort((a, b) => b.log_date.localeCompare(a.log_date)).slice(0, 7).map(l => `
          <tr>
            <td style="padding:5px 10px;border-bottom:1px solid #e2e8f0">${formatDate(l.log_date)}</td>
            <td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${l.calories} kcal</td>
            <td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${l.protein_g.toFixed(0)}g</td>
            <td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${l.carbs_g.toFixed(0)}g</td>
            <td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${l.fat_g.toFixed(0)}g</td>
            <td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${l.sleep_hours}h</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <div class="footer">
    <span>ASC Impulse Engine — Bannister Impulse-Response Model</span>
    <span>Generated ${new Date().toISOString()}</span>
  </div>

</div>
</body>
</html>`;
}

export function exportPdfReport(engine: EngineOutput, athlete: Athlete, sessions: Session[], nutritionLogs: NutritionLog[]) {
  const html = buildHtml(engine, athlete, sessions, nutritionLogs);
  const win = window.open('', '_blank', 'width=1000,height=800');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.addEventListener('load', () => {
    setTimeout(() => win.print(), 300);
  });
}
