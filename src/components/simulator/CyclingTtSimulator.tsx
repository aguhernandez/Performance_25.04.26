import { useMemo, useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { AlertTriangle, Info, Play, Save, Upload, RefreshCw } from 'lucide-react';
import type { Athlete, Session } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import { fetchActivityPowerStreams } from '../../lib/hub/hubApiService';
import { ingestPowerStreams } from '../../lib/engine/streamIngest';
import {
  courseFlat, courseFromGPX, formatCyclingMessage, formatHMS, optimizeTimeTrial, simulateTimeTrial,
  type Course, type TTInput, type TTResult, type PlanMode,
} from '../../lib/engine/cyclingEngine';
import { useAthleteCpModel } from '../../hooks/useAthleteCpModel';
import { useLanguage } from '../../contexts/LanguageContext';

type SaveFn = (kind: 'cycling_tt', name: string, params: Record<string, unknown>, result: Record<string, unknown> | null) => Promise<void>;

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block">
    <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[10px] leading-snug text-gray-400">{hint}</span>}
  </label>;
}

function NumberInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} type="number" className={`mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 font-mono text-[13px] text-gray-800 dark:text-gray-100 ${props.className ?? ''}`} />;
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
    <p className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
    <p className="mt-0.5 font-heading text-lg font-bold text-gray-900 dark:text-white">{value}</p>
    {sub && <p className="font-body text-[11px] text-gray-400">{sub}</p>}
  </div>;
}

export function CyclingTtSimulator({ athlete, sessions, athleteEmail, onSave }: { athlete: Athlete; sessions: Session[]; athleteEmail: string; onSave: SaveFn }) {
  const { lang } = useLanguage();
  const es = lang === 'es';
  const cpData = useAthleteCpModel(athlete);
  const [course, setCourse] = useState<Course | null>(null);
  const [courseName, setCourseName] = useState('');
  const [distance, setDistance] = useState(40);
  const [elevation, setElevation] = useState(0);
  const [mass, setMass] = useState(athlete.weight_kg || 75);
  const [equipmentMass, setEquipmentMass] = useState('');
  const [cda, setCda] = useState('');
  const [crr, setCrr] = useState('');
  const [drivetrainEff, setDrivetrainEff] = useState('');
  const [temperature, setTemperature] = useState(18);
  const [humidity, setHumidity] = useState(55);
  const [pressure, setPressure] = useState('');
  const [headwind, setHeadwind] = useState(0);
  const [testAltitude, setTestAltitude] = useState(0);
  const [durabilityFactor, setDurabilityFactor] = useState(1);
  const [usePerformanceCurve, setUsePerformanceCurve] = useState(true);
  const [manualCp, setManualCp] = useState(String(athlete.cp_watts || athlete.ftp_watts || ''));
  const [manualWPrimeKj, setManualWPrimeKj] = useState('');
  const [mode, setMode] = useState<PlanMode>('even');
  const [effortPct, setEffortPct] = useState(100);
  const [fixedPower, setFixedPower] = useState(athlete.cp_watts || athlete.ftp_watts || 250);
  const [customPower, setCustomPower] = useState('');
  const [result, setResult] = useState<TTResult | null>(null);
  const [optimized, setOptimized] = useState<{ even: TTResult; optimized: TTResult; gain_s: number; gain_pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const pdCurve = useMemo(() => cpData.mmpRows.map(r => ({ duration_s: r.duration_s, power_w: r.watts })), [cpData.mmpRows]);
  const cpModel = cpData.cpModel?.status === 'ok' ? cpData.cpModel : null;
  const curveCanFit = pdCurve.filter(p => p.duration_s >= 120 && p.duration_s <= 1800).length >= 2;
  const autoCp = cpModel?.cp ?? 0;
  const autoWPrime = cpModel?.wPrimeJ ?? 0;

  const syncPowerStreams = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const { data: profile, error: profileError } = await (supabase as any)
        .from('profiles')
        .select('hub_planner_token, hub_connection_active')
        .eq('id', athlete.user_id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile?.hub_planner_token || !profile?.hub_connection_active) {
        throw new Error(es ? 'Conecta primero el HUB en Ajustes.' : 'Connect the HUB in Settings first.');
      }
      if (!athleteEmail) throw new Error(es ? 'No hay email de atleta para consultar el HUB.' : 'Athlete email is missing for the HUB request.');
      const cyclingSessions = sessions.filter(s => {
        const subSport = (s.sub_sport ?? '').toLowerCase();
        return s.session_type === 'cycling' || subSport.includes('cycl') || subSport.includes('bike');
      });
      if (cyclingSessions.length === 0) throw new Error(es ? 'No hay sesiones de ciclismo sincronizables.' : 'No cycling sessions are available to sync.');
      const dates = cyclingSessions.map(s => s.session_date).sort();
      const latestDate = new Date(`${dates[dates.length - 1]}T00:00:00`);
      const earliestDate = new Date(latestDate);
      earliestDate.setDate(earliestDate.getDate() - 364);
      const dateFrom = earliestDate.toISOString().slice(0, 10);
      const streams = await fetchActivityPowerStreams(profile.hub_planner_token, athleteEmail, dateFrom, dates[dates.length - 1]);
      const result = await ingestPowerStreams(athlete, cyclingSessions, streams);
      cpData.refresh();
      setSyncMessage(es
        ? `Sincronización lista: ${result.processed} procesadas, ${result.skipped} sin cambios/sin sesión, ${result.discarded} descartadas.`
        : `Sync complete: ${result.processed} processed, ${result.skipped} unchanged/no session, ${result.discarded} discarded.`);
    } catch (e) {
      setSyncMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  };

  const inputForSimulation = (selectedMode: PlanMode = mode): TTInput => {
    const activeCourse = course ?? courseFlat({ distance_km: distance, elevation_m: elevation });
    const useCurve = usePerformanceCurve && curveCanFit;
    const cp = usePerformanceCurve ? (autoCp || Number(manualCp)) : Number(manualCp);
    const wp = usePerformanceCurve ? (autoWPrime || (Number(manualWPrimeKj) * 1000)) : Number(manualWPrimeKj) * 1000;
    const power = {
      ...(useCurve ? { pdCurve } : {}),
      ...(cp > 0 ? { cp_w: cp } : {}),
      ...(wp > 0 ? { wprime_j: wp } : {}),
      testAltitude_m: testAltitude,
      durabilityFactor,
    };
    const rider = {
      mass_kg: Number(mass),
      ...(equipmentMass.trim() ? { equipmentMass_kg: Number(equipmentMass) } : {}),
      ...(cda.trim() ? { cda_m2: Number(cda) } : {}),
      ...(crr.trim() ? { crr: Number(crr) } : {}),
      ...(drivetrainEff.trim() ? { drivetrainEff: Number(drivetrainEff) } : {}),
    };
    const wind = headwind !== 0
      ? { segments: [{ fromKm: 0, toKm: activeCourse.distance_km, headwind_ms: headwind }] }
      : undefined;
    const plan = selectedMode === 'even'
      ? { mode: 'even' as const, effort: effortPct / 100 }
      : selectedMode === 'fixed'
        ? { mode: 'fixed' as const, power_w: Number(fixedPower) }
        : { mode: 'custom' as const, powerByKm: customPower.split(',').map(v => Number(v.trim())).filter(v => v > 0) };
    return {
      course: activeCourse,
      rider,
      athlete: power,
      weather: { temperature_c: temperature, humidity_percent: humidity, ...(pressure.trim() ? { pressure_hpa: Number(pressure) } : {}) },
      wind,
      plan,
    };
  };

  const run = () => {
    setError(null); setOptimized(null); setSaved(false);
    try {
      if (!usePerformanceCurve || !curveCanFit) {
        const cp = usePerformanceCurve ? (autoCp || Number(manualCp)) : Number(manualCp);
        const wp = usePerformanceCurve ? (autoWPrime || Number(manualWPrimeKj) * 1000) : Number(manualWPrimeKj) * 1000;
        if (!(cp > 0) || !(wp > 0)) throw new Error(es ? 'Faltan datos de CP y W′. Carga una curva de Performance o introduce ambos valores.' : 'CP and W′ are missing. Load a Performance curve or enter both values.');
      }
      if (mode === 'custom' && !customPower.split(',').some(v => Number(v.trim()) > 0)) throw new Error(es ? 'Introduce al menos una potencia para el plan personalizado.' : 'Enter at least one power value for the custom plan.');
      setResult(simulateTimeTrial(inputForSimulation()));
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const runOptimization = () => {
    setError(null); setSaved(false);
    try {
      const output = optimizeTimeTrial(inputForSimulation('even'));
      setOptimized(output); setResult(output.optimized);
    } catch (e) {
      setOptimized(null); setError(e instanceof Error ? e.message : String(e));
    }
  };

  const uploadGpx = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = courseFromGPX(await file.text());
      setCourse(parsed); setCourseName(file.name); setError(null); setResult(null); setOptimized(null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const saveScenario = async () => {
    if (!result) return;
    const input = inputForSimulation(optimized ? 'even' : mode);
    await onSave('cycling_tt', courseName || `${result.distance_km} km TT`, {
      course: { source: input.course.source, distance_km: input.course.distance_km, totalAscent_m: input.course.totalAscent_m },
      rider: input.rider, athlete: { ...input.athlete, pdCurve: undefined }, weather: input.weather, wind: input.wind,
      plan: input.plan,
    }, { time_s: result.time_s, avgPower_w: result.avgPower_w, avgSpeed_kmh: result.avgSpeed_kmh, wPrimeMin_j: result.wPrimeMin_j, plan: result.plan });
    setSaved(true);
  };

  const qualityLabel = (key: string, state: string) => `${key}: ${state === 'provided' || state === 'pdCurve' ? (es ? 'informado/medido' : 'provided/measured') : (es ? 'asumido' : 'assumed')}`;

  return <div className="space-y-5">
    <div>
      <h2 className="font-heading text-xl font-bold text-gray-900 dark:text-white">{es ? 'Contrarreloj en bici' : 'Cycling time trial'}</h2>
      <p className="mt-0.5 font-body text-[13px] text-gray-500 dark:text-gray-400">{es ? 'Potencia → velocidad → tiempo, con perfil del recorrido y condiciones ambientales.' : 'Power → speed → time using course profile and environmental conditions.'}</p>
    </div>

    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <h3 className="mb-3 font-heading text-[14px] font-bold text-gray-800 dark:text-gray-100">{es ? 'Datos de Performance' : 'Performance data'}</h3>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
        <div className="text-[12px] text-gray-600 dark:text-gray-300">
          <p className="font-semibold">{cpData.loading ? (es ? 'Cargando curva…' : 'Loading power curve…') : `${pdCurve.length} ${es ? 'puntos MMP de streams guardados' : 'stored stream MMP points'}`}</p>
          {cpModel && <p className="mt-1">CP {Math.round(cpModel.cp)} W · W′ {(cpModel.wPrimeJ / 1000).toFixed(1)} kJ · R² {cpModel.r2.toFixed(3)} · {es ? `confianza ${cpModel.confidence}` : `${cpModel.confidence} confidence`}</p>}
          <p className="mt-1 text-[10px] text-gray-400">{es ? 'El simulador usa la curva MMP guardada en Performance. La curva no indica si el esfuerzo fue en estado descansado.' : 'Uses the MMP curve saved in Performance. The curve does not identify rested efforts.'}</p>
        </div>
        <label className="flex items-center gap-2 text-[12px] text-gray-700 dark:text-gray-200">
          <input type="checkbox" checked={usePerformanceCurve} onChange={e => setUsePerformanceCurve(e.target.checked)} />
          {es ? 'Usar curva de Performance' : 'Use Performance curve'}
        </label>
        <button onClick={() => void syncPowerStreams()} disabled={syncing || cpData.loading} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-[11px] text-gray-700 dark:text-gray-200 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />{syncing ? (es ? 'Sincronizando…' : 'Syncing…') : (es ? 'Traer streams del HUB' : 'Sync HUB power streams')}
        </button>
      </div>
      {syncMessage && <p role="status" className="mt-2 text-[11px] text-gray-600 dark:text-gray-300">{syncMessage}</p>}
      {(!usePerformanceCurve || !curveCanFit) && <div className="mt-3 grid grid-cols-2 gap-3 md:max-w-md">
        <Field label="CP (W)"><NumberInput min={1} value={manualCp} onChange={e => setManualCp(e.target.value)} placeholder={es ? 'Potencia crítica' : 'Critical power'} /></Field>
        <Field label="W′ (kJ)"><NumberInput min={0.1} step={0.1} value={manualWPrimeKj} onChange={e => setManualWPrimeKj(e.target.value)} placeholder={es ? 'Capacidad W′' : 'W′ capacity'} /></Field>
      </div>}
      {cpData.error && <p className="mt-2 text-[11px] text-[#8A6900] dark:text-[#F7C843]">{es ? 'No se pudo leer Performance; puedes introducir CP y W′ manualmente.' : 'Could not load Performance data; CP and W′ can be entered manually.'}</p>}
    </section>

    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <h3 className="mb-3 font-heading text-[14px] font-bold text-gray-800 dark:text-gray-100">{es ? 'Recorrido' : 'Course'}</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label={es ? 'Archivo GPX' : 'GPX file'} hint={courseName || (es ? 'Sin archivo: se usa un circuito llano.' : 'No file: a flat course is used.')}>
          <span className="mt-1 flex items-center gap-2">
            <input type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" onChange={e => void uploadGpx(e.target.files?.[0])} className="min-w-0 text-[11px] text-gray-500 dark:text-gray-400" />
            <Upload className="h-4 w-4 shrink-0 text-gray-400" />
          </span>
        </Field>
        <Field label={es ? 'Distancia llano (km)' : 'Flat course distance (km)'}><NumberInput min={0.2} step={0.1} value={distance} onChange={e => setDistance(Number(e.target.value))} /></Field>
        <Field label={es ? 'Altitud llano (m)' : 'Flat course elevation (m)'}><NumberInput value={elevation} onChange={e => setElevation(Number(e.target.value))} /></Field>
        <Field label={es ? 'Viento frente (+) / cola (−), m/s' : 'Headwind (+) / tailwind (−), m/s'}><NumberInput step={0.1} value={headwind} onChange={e => setHeadwind(Number(e.target.value))} /></Field>
      </div>
      {course && <button onClick={() => { setCourse(null); setCourseName(''); }} className="mt-2 text-[11px] text-[#2A1F4A] dark:text-[#B8A9E5] underline">{es ? `Usar recorrido llano (${course.distance_km.toFixed(1)} km)` : `Use flat course (${course.distance_km.toFixed(1)} km)`}</button>}
      {course && <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">{course.distance_km.toFixed(2)} km · +{Math.round(course.totalAscent_m)} m · {course.segments.length} {es ? 'tramos' : 'segments'}</p>}
    </section>

    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <h3 className="mb-3 font-heading text-[14px] font-bold text-gray-800 dark:text-gray-100">{es ? 'Atleta, bici y ambiente' : 'Rider, bike and conditions'}</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label={es ? 'Masa ciclista + ropa (kg)' : 'Rider + clothing mass (kg)'}><NumberInput min={30} step={0.1} value={mass} onChange={e => setMass(Number(e.target.value))} /></Field>
        <Field label={es ? 'Bici y equipo (kg)' : 'Bike and equipment (kg)'} hint={es ? 'Vacío = 9,5 kg asumidos' : 'Blank = assumed 9.5 kg'}><NumberInput min={0} step={0.1} value={equipmentMass} onChange={e => setEquipmentMass(e.target.value)} placeholder="9.5" /></Field>
        <Field label="CdA (m²)" hint={es ? 'Vacío = 0,23 asumido; afecta mucho el tiempo absoluto.' : 'Blank = assumed 0.23; strongly affects absolute time.'}><NumberInput min={0.05} step={0.001} value={cda} onChange={e => setCda(e.target.value)} placeholder="0.23" /></Field>
        <Field label="Crr" hint={es ? 'Vacío = 0,0035 asumido' : 'Blank = assumed 0.0035'}><NumberInput min={0.0001} step={0.0001} value={crr} onChange={e => setCrr(e.target.value)} placeholder="0.0035" /></Field>
        <Field label={es ? 'Eficiencia transmisión' : 'Drivetrain efficiency'} hint={es ? 'Vacío = 0,975 asumido' : 'Blank = assumed 0.975'}><NumberInput min={0.8} max={1} step={0.001} value={drivetrainEff} onChange={e => setDrivetrainEff(e.target.value)} placeholder="0.975" /></Field>
        <Field label={es ? 'Temperatura (°C)' : 'Temperature (°C)'}><NumberInput value={temperature} onChange={e => setTemperature(Number(e.target.value))} /></Field>
        <Field label={es ? 'Humedad (%)' : 'Humidity (%)'}><NumberInput min={0} max={100} value={humidity} onChange={e => setHumidity(Number(e.target.value))} /></Field>
        <Field label={es ? 'Presión (hPa)' : 'Pressure (hPa)'} hint={es ? 'Vacío = estimación estándar por altitud' : 'Blank = standard atmosphere estimate'}><NumberInput min={300} max={1100} step={0.1} value={pressure} onChange={e => setPressure(e.target.value)} placeholder={es ? 'Automática' : 'Automatic'} /></Field>
        <Field label={es ? 'Altitud del test CP (m)' : 'CP test altitude (m)'}><NumberInput value={testAltitude} onChange={e => setTestAltitude(Number(e.target.value))} /></Field>
        <Field label={es ? 'Factor de durabilidad' : 'Durability factor'} hint="1 = sin ajuste; 0.97 = −3 % de potencia"><NumberInput min={0.5} max={1.2} step={0.01} value={durabilityFactor} onChange={e => setDurabilityFactor(Number(e.target.value))} /></Field>
      </div>
    </section>

    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <h3 className="mb-3 font-heading text-[14px] font-bold text-gray-800 dark:text-gray-100">{es ? 'Plan de potencia' : 'Power plan'}</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label={es ? 'Tipo de plan' : 'Plan type'}><select value={mode} onChange={e => setMode(e.target.value as PlanMode)} className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-[13px]">
          <option value="even">{es ? 'Uniforme sostenible' : 'Even sustainable'}</option>
          <option value="fixed">{es ? 'Potencia constante' : 'Fixed power'}</option>
          <option value="custom">{es ? 'Potencia por km' : 'Power by km'}</option>
        </select></Field>
        {mode === 'even' && <Field label={es ? 'Esfuerzo (% sostenible)' : 'Effort (% sustainable)'}><NumberInput min={50} max={120} value={effortPct} onChange={e => setEffortPct(Number(e.target.value))} /></Field>}
        {mode === 'fixed' && <Field label={es ? 'Potencia (W)' : 'Power (W)'}><NumberInput min={1} value={fixedPower} onChange={e => setFixedPower(Number(e.target.value))} /></Field>}
        {mode === 'custom' && <Field label={es ? 'Vatios por km, separados por coma' : 'Watts per km, comma-separated'} hint={es ? 'El último valor se repite hasta el final.' : 'The last value repeats to the finish.'}><input value={customPower} onChange={e => setCustomPower(e.target.value)} placeholder="280, 300, 290" className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 font-mono text-[13px]" /></Field>}
        <div className="flex items-end gap-2">
          <button onClick={run} className="flex items-center gap-2 rounded-lg bg-[#F7C843] px-4 py-2 text-[13px] font-semibold text-[#2A1F4A] hover:bg-[#E7B92D]"><Play className="h-3.5 w-3.5" />{es ? 'Simular' : 'Simulate'}</button>
          <button onClick={runOptimization} disabled={mode !== 'even'} title={es ? 'Optimiza el reparto manteniendo el NP objetivo' : 'Optimizes pacing while keeping target NP'} className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-[12px] text-gray-700 dark:text-gray-200 disabled:opacity-40">{es ? 'Optimizar' : 'Optimize'}</button>
        </div>
      </div>
    </section>

    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">{error}</div>}
    {result && <div className="space-y-4">
      {optimized && <div className="rounded-lg border border-[#2A1F4A]/20 dark:border-[#B8A9E5]/30 bg-[#2A1F4A]/5 dark:bg-[#B8A9E5]/10 p-3 text-[12px] text-[#2A1F4A] dark:text-[#B8A9E5]">{es ? 'Optimización del modelo: ' : 'Model optimization: '}{formatHMS(optimized.even.time_s)} → {formatHMS(optimized.optimized.time_s)} · {es ? 'ahorro estimado' : 'estimated saving'} {optimized.gain_s.toFixed(1)} s ({optimized.gain_pct.toFixed(2)}%). {es ? 'Es una mejora simulada, no una garantía en carrera.' : 'This is a simulated gain, not a race guarantee.'}</div>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label={es ? 'Tiempo' : 'Time'} value={formatHMS(result.time_s)} sub={`${result.distance_km.toFixed(2)} km`} />
        <Card label={es ? 'Velocidad media' : 'Average speed'} value={`${result.avgSpeed_kmh.toFixed(1)} km/h`} />
        <Card label={es ? 'Potencia media' : 'Average power'} value={`${Math.round(result.avgPower_w)} W`} sub={`NP ${Math.round(result.np_w)} W`} />
        <Card label="VI" value={result.variabilityIndex.toFixed(3)} sub={`${Math.round(result.totalAscent_m)} m D+`} />
        <Card label={es ? 'Objetivo sostenible' : 'Sustainable target'} value={result.targetPower_w ? `${Math.round(result.targetPower_w)} W` : '—'} />
        <Card label="W′ mínimo" value={result.wPrimeMin_j === null ? '—' : `${(result.wPrimeMin_j / 1000).toFixed(2)} kJ`} />
        <Card label="CdA / Crr" value={`${qualityLabel('CdA', result.dataQuality.cda)} · ${qualityLabel('Crr', result.dataQuality.crr)}`} />
        <Card label={es ? 'Modelo / viento' : 'Model / wind'} value={`${result.dataQuality.athleteModel} · ${result.dataQuality.wind}`} sub={`${result.airDensity_kgm3.toFixed(3)} kg/m³`} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <div className="space-y-1">
          {result.messages.map((m, i) => <p key={i} className="flex items-start gap-2 text-[11px] text-gray-600 dark:text-gray-300"><span className="mt-0.5 text-[#8A6900] dark:text-[#F7C843]">{m.severity === 'warning' || m.severity === 'danger' ? <AlertTriangle className="h-3.5 w-3.5" /> : <Info className="h-3.5 w-3.5" />}</span>{formatCyclingMessage(m, es ? 'es' : 'en')}</p>)}
          <p className="text-[10px] text-gray-400">{qualityLabel('transmisión', result.dataQuality.drivetrainEff)} · {qualityLabel(es ? 'masa del equipo' : 'equipment mass', result.dataQuality.equipmentMass)} · {result.dataQuality.course}</p>
        </div>
        <button onClick={() => void saveScenario()} disabled={saved} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-[12px] text-gray-700 dark:text-gray-200 disabled:opacity-50"><Save className="h-3.5 w-3.5" />{saved ? (es ? 'Guardado' : 'Saved') : (es ? 'Guardar escenario' : 'Save scenario')}</button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <table className="w-full text-[11px]">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400"><tr>{[es ? 'km' : 'km', es ? 'Tiempo' : 'Time', es ? 'Velocidad' : 'Speed', es ? 'Potencia' : 'Power', es ? 'Pendiente' : 'Grade', es ? 'Viento frente' : 'Headwind'].map(x => <th key={x} className="px-3 py-2 text-right font-semibold first:text-left">{x}</th>)}</tr></thead>
          <tbody>{result.splits.map((s, i) => <tr key={i} className="border-t border-gray-50 text-gray-700 dark:text-gray-200"><td className="px-3 py-1.5 font-mono">{s.km.toFixed(1)}</td><td className="px-3 py-1.5 text-right font-mono">{formatHMS(s.time_s)}</td><td className="px-3 py-1.5 text-right font-mono">{s.speed_kmh.toFixed(1)}</td><td className="px-3 py-1.5 text-right font-mono">{Math.round(s.power_w)}</td><td className="px-3 py-1.5 text-right font-mono">{s.grade_pct.toFixed(1)}%</td><td className="px-3 py-1.5 text-right font-mono">{s.headwind_ms.toFixed(1)} m/s</td></tr>)}</tbody>
        </table>
      </div>
    </div>}
  </div>;
}
