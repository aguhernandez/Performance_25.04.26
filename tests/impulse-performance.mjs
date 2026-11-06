import { build } from 'esbuild';
import assert from 'node:assert/strict';

async function moduleAt(file) {
  const out = await build({entryPoints:[file], bundle:true, platform:'node', format:'esm', write:false,
    plugins: [{ name: 'stub-supabase', setup(b) { b.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path:'supabase', namespace:'stub' })); b.onLoad({ filter: /.*/, namespace:'stub' }, () => ({ contents:'export const supabase = {}', loader:'js' })); } }] });
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
}
const v1 = await moduleAt('src/lib/engine/impulseV1.ts');
for (const [input, expected] of [
  [{sport:'cycling',durationMinutes:60,normalizedPowerWatts:250,ftp:250}, [100,'calculated','cycling_np_if_ftp']],
  [{sport:'cycling',durationMinutes:60,avgPowerWatts:200,ftp:250}, [64,'estimated','cycling_avg_power_ftp']],
  [{sport:'running',durationMinutes:60,adjustedPacePerKm:5,thresholdPacePerKm:4}, [64,'calculated','running_adjusted_pace_threshold']],
  [{sport:'running',durationMinutes:60,avgPacePerKm:5,thresholdPacePerKm:4}, [64,'estimated','running_average_pace_threshold']],
  [{sport:'swimming',durationMinutes:60,avgPacePerKm:4,thresholdPacePerKm:2}, [12.5,'estimated','swimming_threshold_pace_if3']],
  [{sport:'cycling',durationMinutes:0,manualImpulse:0}, [0,'manual','manual']],
  [{sport:'cycling',durationMinutes:60}, [null,'insufficient',null]],
]) { const r = v1.calculateImpulse(input); assert.deepEqual([r.impulse,r.status,r.method], expected); assert.equal(r.algorithmVersion,'impulse-v1'); }
const engine = await moduleAt('src/lib/engine/bannisterModel.ts');
const impulse = await moduleAt('src/lib/engine/impulse.ts');
const persistence = await moduleAt('src/lib/engine/loadPersistence.ts');
const athlete={id:'test',ftp_watts:250,cp_watts:300,tau_fitness:42,tau_fatigue:7,resting_hr:60,max_hr:180,threshold_speed_kmh:null};
const d=new Date();d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-2);
const date=d.toISOString().slice(0,10);
const session={session_date:date,session_type:'cycling',duration_min:60,normalized_power_watts:250,avg_power_watts:null,distance_km:null,raw_data:null,sub_sport:null};
const h=engine.runBannisterModel([session],athlete,{includeStrength:true}).history;
assert.deepEqual(h,persistence.computeCalendarHistory(athlete,[session]));
assert.equal(h.length,3);assert.equal(h[0].impulse,100);assert.equal(h[1].impulse,0);
assert.ok(Math.abs(h[0].fitness-100*(1-Math.exp(-1/42))) < 0.0001);
assert.ok(Math.abs(h[0].fatigue-100*(1-Math.exp(-1/7))) < 0.0001);
assert.ok(h[1].fitness<h[0].fitness && h[1].fatigue<h[0].fatigue);
const missing={...session, normalized_power_watts:null};
assert.equal(impulse.computeSessionImpulse(missing,impulse.resolveThresholds(athlete)).impulse,null);
assert.equal(engine.runBannisterModel([missing],athlete,{includeStrength:true}).history.length,0);
assert.throws(() => persistence.rowsToDailyLoad('test',[impulse.computeSessionImpulse(missing,impulse.resolveThresholds(athlete))]));
console.log('Impulse v1, curve consistency and insufficient data: passed');
