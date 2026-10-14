import {
  cleanPowerStream,
  computePowerStats,
  computeNp,
  computeMeanMaxPower,
  fitCpModel,
  cpConfidence,
  computePerRideMetrics,
  MEAN_MAX_DURATIONS,
} from '../src/lib/engine/powerAnalysis';

function constantStream(seconds: number, watts: number, sampleEvery = 1): { times: number[]; watts: (number | null)[] } {
  const times: number[] = [];
  const w: (number | null)[] = [];
  for (let t = 0; t < seconds; t += sampleEvery) {
    times.push(t);
    w.push(watts);
  }
  return { times, watts: w };
}

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${msg}`);
  }
}

function approx(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

// 1. Constant 200 W stream, 10 min at 1 Hz
{
  const clean = cleanPowerStream(constantStream(600, 200));
  assert(clean !== null, 'constant stream cleaned');
  if (clean) {
    assert(clean.missingPct === 0, 'no missing samples');
    assert(clean.totalSeconds === 600, '600 seconds total');
    const stats = computePowerStats(clean);
    assert(stats !== null && stats.avgWatts === 200, 'avg = 200 W');
    assert(stats !== null && approx(stats.np, 200, 1), 'NP = 200 W for constant power');
    assert(stats !== null && approx(stats.vi, 1.0, 0.01), 'VI = 1.00 for constant power');
    const mmp = computeMeanMaxPower(clean);
    const d300 = mmp.find(p => p.durationS === 300);
    assert(d300 !== undefined && d300.watts === 200, 'MMP@300s = 200 W');
    assert(!mmp.some(p => p.durationS === 1200), 'durations longer than activity skipped');
  }
}

// 2. Gap handling: 10 s gap should be zeros (>5s), 3 s gap interpolated
{
  const times: number[] = [];
  const watts: (number | null)[] = [];
  // 0..99 at 100W
  for (let t = 0; t < 100; t++) { times.push(t); watts.push(100); }
  // 10 s gap: t=100..109 missing (gap of 10 s from t=99 to t=110)
  // 110..199 at 100W
  for (let t = 110; t < 200; t++) { times.push(t); watts.push(100); }
  // 3 s gap: t=200..202 missing, resumes at 203 (gap 3 s ≤ 5)
  for (let t = 203; t < 620; t++) { times.push(t); watts.push(100); }

  const clean = cleanPowerStream({ times, watts });
  assert(clean !== null, 'gapped stream cleaned');
  if (clean) {
    // first 10 s gap counts as 0 W; second 3 s gap interpolated to 100
    assert(clean.missingPct === 0, 'interpolated gaps are not missing');
    const stats = computePowerStats(clean);
    assert(stats !== null, 'stats computed for gapped stream');
    if (stats) {
      // total 620 s, 10 s of zeros → avg ≈ (610*100)/620 ≈ 98.4
      assert(approx(stats.avgWatts, 98.4, 0.5), `avg ≈ 98.4 W (got ${stats.avgWatts})`);
    }
  }
}

// 3. Discard: too short (<5 min of power)
{
  const clean = cleanPowerStream(constantStream(299, 250));
  const stats = clean ? computePowerStats(clean) : null;
  assert(stats === null, 'activity <5 min of power discarded');
}

// 4. Discard: >20% missing
{
  // 100 s on, 100 s off pattern → 50% missing over 600 s
  const times: number[] = [];
  const watts: (number | null)[] = [];
  for (let t = 0; t < 1200; t += 2) {
    times.push(t);
    watts.push(t % 4 === 0 ? 200 : null);
  }
  const clean = cleanPowerStream({ times, watts });
  const stats = clean ? computePowerStats(clean) : null;
  assert(stats === null, 'activity with >20% missing samples discarded');
}

// 5. NP against known synthetic case: 30 s blocks of 100 W / 300 W over 120 s → avg 200, NP > avg
{
  const watts: number[] = [];
  for (let i = 0; i < 120; i++) watts.push(Math.floor(i / 30) % 2 === 0 ? 100 : 300);
  const np = computeNp(watts);
  assert(np > 200, `NP of variable power exceeds avg (got ${np.toFixed(1)})`);
}

// 6. MMP prefix-sum spot check: single spike
{
  const watts = new Array(600).fill(100);
  watts[300] = 1000; // 1 s spike
  const clean = cleanPowerStream({ times: Array.from({ length: 600 }, (_, i) => i), watts });
  assert(clean !== null, 'spike stream cleaned');
  if (clean) {
    const mmp = computeMeanMaxPower(clean);
    const d1 = mmp.find(p => p.durationS === 1);
    assert(d1 !== undefined && d1.watts === 1000, 'MMP@1s catches the 1000 W spike');
    const d60 = mmp.find(p => p.durationS === 60);
    // 60 s window containing the spike: (59*100 + 1000)/60 = 115
    assert(d60 !== undefined && approx(d60.watts, 115, 1), `MMP@60s ≈ 115 W (got ${d60?.watts})`);
  }
}

// 7. CP model: synthetic MMP points on work = 250·t + 18000
{
  const points = [300, 480, 600, 900, 1200, 1800].map(d => ({
    durationS: d,
    watts: Math.round((250 * d + 18000) / d),
    date: new Date().toISOString().split('T')[0],
    activityId: 'a1',
  }));
  const reg = fitCpModel(points);
  assert(reg.status === 'ok', 'CP fit ok on synthetic data');
  if (reg.status === 'ok') {
    assert(reg.cp === 250, `CP = 250 (got ${reg.cp})`);
    assert(approx(reg.wPrimeJ, 18000, 200), `W′ ≈ 18000 J (got ${reg.wPrimeJ})`);
    assert(reg.r2 > 0.999, `R² ≈ 1 (got ${reg.r2})`);
    assert(cpConfidence(reg) === 'high' || cpConfidence(reg) === 'medium', `confidence high/medium (got ${cpConfidence(reg)})`);
  }
}

// 8. CP model: insufficient data (only 2 points)
{
  const points = [
    { durationS: 300, watts: 300, date: new Date().toISOString().split('T')[0], activityId: 'a1' },
    { durationS: 900, watts: 260, date: new Date().toISOString().split('T')[0], activityId: 'a2' },
  ];
  const reg = fitCpModel(points);
  assert(reg.status === 'insufficient_data', 'insufficient: <3 points');
  assert(reg.cp === 0, 'no CP number when insufficient');
}

// 9. CP model: duration range too narrow
{
  const points = [300, 420, 480, 540].map(d => ({
    durationS: d,
    watts: 260,
    date: new Date().toISOString().split('T')[0],
    activityId: 'a1',
  }));
  const reg = fitCpModel(points);
  assert(reg.status === 'insufficient_data', 'insufficient: longest/shortest < 2.5');
}

// 10. CP model: no point ≥ 480 s
{
  const points = [180, 300, 420].map(d => ({
    durationS: d,
    watts: 280,
    date: new Date().toISOString().split('T')[0],
    activityId: 'a1',
  }));
  const reg = fitCpModel(points);
  assert(reg.status === 'insufficient_data', 'insufficient: no point ≥ 480 s');
}

// 11. CP model: stale points outside 90-day window excluded
{
  const old = new Date();
  old.setDate(old.getDate() - 200);
  const points = [
    { durationS: 300, watts: 400, date: old.toISOString().split('T')[0], activityId: 'a1' },
    { durationS: 900, watts: 330, date: old.toISOString().split('T')[0], activityId: 'a2' },
    { durationS: 1800, watts: 290, date: old.toISOString().split('T')[0], activityId: 'a3' },
  ];
  const reg = fitCpModel(points);
  assert(reg.status === 'insufficient_data', 'insufficient: all points outside 90-day window');
}

// 12. Per-ride metrics: steady ride ≥60 min, VI 1.0 → decoupling ≈ 0
{
  const times: number[] = [];
  const watts: (number | null)[] = [];
  const hr: (number | null)[] = [];
  for (let t = 0; t < 3900; t++) {
    times.push(t);
    watts.push(200);
    hr.push(150);
  }
  const clean = cleanPowerStream({ times, watts });
  const stats = clean ? computePowerStats(clean) : null;
  assert(clean !== null && stats !== null, 'steady ride prepared');
  if (clean && stats) {
    const metrics = computePerRideMetrics(clean, hr, stats);
    assert(metrics.ef !== null && approx(metrics.ef, 200 / 150, 0.01), `EF ≈ 1.33 (got ${metrics.ef})`);
    assert(metrics.decouplingPct !== null && approx(metrics.decouplingPct, 0, 0.5), `decoupling ≈ 0% (got ${metrics.decouplingPct})`);
  }
}

// 13. Per-ride metrics: no decoupling for short rides
{
  const times: number[] = [];
  const watts: (number | null)[] = [];
  const hr: (number | null)[] = [];
  for (let t = 0; t < 1800; t++) {
    times.push(t);
    watts.push(200);
    hr.push(150);
  }
  const clean = cleanPowerStream({ times, watts });
  const stats = clean ? computePowerStats(clean) : null;
  if (clean && stats) {
    const metrics = computePerRideMetrics(clean, hr, stats);
    assert(metrics.ef !== null, 'EF computed for short ride');
    assert(metrics.decouplingPct === null, 'no decoupling for rides <60 min');
  }
}

// 14. MEAN_MAX_DURATIONS match the spec list
{
  const expected = [1, 5, 10, 15, 30, 60, 120, 180, 300, 480, 600, 720, 900, 1200, 1800, 2700, 3600];
  assert(JSON.stringify(MEAN_MAX_DURATIONS) === JSON.stringify(expected), 'MEAN_MAX_DURATIONS matches spec');
}

console.log(process.exitCode === 1 ? 'SOME TESTS FAILED' : 'ALL TESTS PASSED');
