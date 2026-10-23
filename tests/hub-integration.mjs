import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'performance-hub-test-'));
try {
  await build({ entryPoints: ['src/lib/hub/hubContext.ts'], outfile: join(dir, 'context.mjs'), bundle: true, platform: 'node', format: 'esm' });
  const { normalizeHubContext, mergeHubWorkspace, hubSessions, sportType, fetchHubContext, fetchHubStream } = await import(pathToFileURL(join(dir, 'context.mjs')));
  const context = { athlete: { id: 'hub-athlete', email: 'athlete@example.test', full_name: 'Test Athlete', sport: 'running' }, errors: {}, data: {
    external: [
      { id: 'ride', external_id: 'strava-ride', local_date: '2026-10-20', sport_type: 'Ride', name: 'Ride', duration_seconds: 3600, average_watts: 200, distance_meters: 30000, has_power: true },
      { id: 'run', local_date: '2026-10-19', sport_type: 'Run', name: 'Run', duration_seconds: 1800, distance_meters: 5000, average_power: null, average_heartrate: null },
    ],
    completed: [{ id: 'manual', scheduled_date: '2026-10-19', sport: 'run', workout_name: 'Second run', duration_seconds: 1200, time_in_zones: { z1: 600, z2: 600 } }],
    strength: [{ id: 'gym', status: 'completed', scheduled_date: '2026-10-18', workout: { name: 'Strength', duration_minutes: 60 } }, { id: 'future', status: 'planned', scheduled_date: '2026-10-25' }],
    extra: [{ id: 'extra', training_date: '2026-10-17', activity_name: 'Walk', duration: '1h' }],
    passport: [{ id: 'passport', status: 'active', measurement_date: '2026-10-01', critical_power: 270, ftp_watts: 255, running_threshold_pace: '4:30', weight_kg: 80 }],
    bioimpedance: [{ measurement_date: '2026-10-21', weight: 73, adipose_tissue_kg: 10, adipose_tissue_percent: 13.7 }],
    wellness: [{ checkin_date: '2026-10-20', hrv: 65, rhr: 48, sleep_hours: 7, fatigue_level: 3 }],
    nutrition: [{ id: 'daily', plan_date: '2026-10-20', target_kcal: 2500, actual_kcal: 2200, actual_protein_g: 120 }],
    diary: [{ start_date: '2026-10-20', total_calories: 200 }, { start_date: '2026-10-19', total_calories: 300 }, { start_date: '2026-10-19', total_calories: 400 }],
  } };
  const snapshot = normalizeHubContext(context);
  const athlete = { id: 'local-athlete', user_id: 'hub-athlete', name: 'Test Athlete', weight_kg: 75, lean_mass_kg: 65, cp_watts: 0, ftp_watts: 0, max_hr: 185, resting_hr: 60 };
  const oldCopy = { id: 'old-local-copy', raw_data: { hub_activity_id: 'ride' } };
  const workspace = mergeHubWorkspace(athlete, [oldCopy], [], [], [], snapshot);
  assert.equal(workspace.sessions.length, 5, 'all completed origins included; planned rows excluded; old import deduplicated');
  assert.equal(workspace.sessions.find(s => s.title === 'Second run').zone_distribution.z1_min, 10, 'Hub zone durations are seconds; Performance stores minutes');
  assert.equal(workspace.sessions.filter(s => s.session_date === '2026-10-19').length, 2, 'two separate same-day workouts must not be merged');
  assert.equal(workspace.sessions.find(s => s.title === 'Ride').session_type, 'cycling');
  assert.equal(workspace.sessions.find(s => s.title === 'Run').session_type, 'running');
  assert.equal(workspace.sessions.find(s => s.title === 'Run').avg_power_watts, null, 'missing power must not become zero or invented watts');
  assert.equal(workspace.sessions.find(s => s.title === 'Walk').duration_min, 60, 'hour strings must be parsed as hours');
  assert.equal(workspace.sessions.find(s => s.session_type === 'strength').duration_min, 0, 'planned duration must not masquerade as executed duration');
  assert.equal(workspace.athlete.weight_kg, 73);
  assert.equal(workspace.athlete.lean_mass_kg, 63);
  assert.equal(workspace.athlete.cp_watts, 270);
  assert.ok(Math.abs(workspace.athlete.threshold_speed_kmh - 13.3333) < 0.001);
  assert.equal(athlete.weight_kg, 75, 'merging Hub context must not mutate the local profile');
  assert.equal(workspace.hrvLogs[0].hrv_ms, 65);
  assert.equal(workspace.hrvLogs[0].rmssd, null, 'generic HRV must not be mislabeled RMSSD');
  assert.equal(workspace.nutritionLogs.find(n => n.log_date === '2026-10-20').calories, 2200, 'do not double-count daily totals and diary');
  assert.equal(workspace.nutritionLogs.find(n => n.log_date === '2026-10-19').calories, 700, 'sum multiple diary sessions on the same date');
  assert.equal(workspace.labTests[0].cp_watts, 270);
  assert.equal(sportType('VirtualRide'), 'cycling');
  assert.equal(sportType('Trail Run'), 'running');
  const fused = structuredClone(context);
  fused.data.external.push({ id: 'gps-copy', local_date: '2026-10-20', sport_type: 'Ride' });
  fused.data.external[0].fused_activity_id = 'gps-copy';
  assert.equal(hubSessions(fused, athlete.id).length, 5, 'fused GPS duplicate suppressed; imported activity retained');
  let request;
  globalThis.localStorage = { getItem: () => 'signed-hub-jwt' };
  globalThis.fetch = async (url, options) => { request = { url: String(url), options }; return { ok: true, json: async () => context }; };
  await fetchHubContext('performance-token', 'athlete@example.test');
  assert.equal(request.options.headers.Authorization, 'Bearer signed-hub-jwt');
  assert.equal(request.options.headers['X-Planner-Token'], 'performance-token');
  await fetchHubContext('performance-token', 'a-valid-hub-id');
  assert.ok(request.url.includes('athlete_id=a-valid-hub-id'), 'lookup must work for athletes without a local profile/email');
  globalThis.localStorage = { getItem: () => null };
  await assert.rejects(() => fetchHubContext('performance-token', 'athlete@example.test'), /Inicia sesión/);
  globalThis.localStorage = { getItem: () => 'signed-hub-jwt' };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ series: { heart_rate: [{ timestamp: 1000, value: 100 }, { timestamp: 2000, value: 110 }] } }) });
  const stream = await fetchHubStream('performance-token', 'athlete@example.test', 'wearable-session', 'executed');
  assert.deepEqual(stream.series.time_s, [0, 1]);
  assert.deepEqual(stream.series.hr, [100, 110]);
  assert.equal(stream.series.watts, null);
  await build({ entryPoints: ['src/lib/engine/hrvAnalyzer.ts'], outfile: join(dir, 'hrv.mjs'), bundle: true, platform: 'node', format: 'esm' });
  const { analyzeHrv } = await import(pathToFileURL(join(dir, 'hrv.mjs')));
  const hrv = analyzeHrv([40, 50, 60].map((value, index) => ({ date: `2026-10-${18 + index}`, hrv_ms: value })));
  assert.equal(hrv.baseline, 50);
  assert.equal(hrv.current, 60, 'Hub generic HRV must reach the trend model without relabeling RMSSD');
  const old = new Date(); old.setDate(old.getDate() - 120);
  const today = new Date().toISOString().slice(0, 10);
  globalThis.__liveFixture = { athlete, live: { sessions: [{ ...workspace.sessions[0], session_date: old.toISOString().slice(0, 10) }, { ...workspace.sessions[0], session_date: today }], mmpRows: [{ activity_id: 'remote-ride', duration_s: 300, watts: 300, date: today }] } };
  await build({ stdin: { contents: `import React from 'react'; import {renderToString} from 'react-dom/server'; import {usePerformanceData} from './src/components/analytics/performance/usePerformanceData'; function Probe(){ globalThis.__liveResult=usePerformanceData(globalThis.__liveFixture.athlete, globalThis.__liveFixture.live); return null; } renderToString(React.createElement(Probe));`, resolveDir: process.cwd(), loader: 'tsx' }, outfile: join(dir, 'live.mjs'), banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" }, bundle: true, platform: 'node', format: 'esm', define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://example.supabase.co'), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('test-key') } });
  await import(pathToFileURL(join(dir, 'live.mjs')));
  assert.ok(globalThis.__liveResult.pmcDays.some(d => d.total > 0), 'Hub completed sessions must reach PMC, not only SessionList');
  assert.equal(globalThis.__liveResult.pdcWindows.find(w => w.key === 'all').points[0].watts, 300, 'Hub stream-derived MMP must reach Performance charts');
  assert.equal(globalThis.__liveResult.loading, false);
  console.log('PASS: Hub calendar, sources, deduplication, sport capabilities, body composition, passport, nutrition, HRV, dual authentication, stable identity and wearable-series adapter.');
} finally { await rm(dir, { recursive: true, force: true }); }
