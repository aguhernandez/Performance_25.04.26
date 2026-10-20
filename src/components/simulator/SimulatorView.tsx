import { useState } from 'react';
import {
  Save, Trash2, Play, AlertTriangle, Info, XCircle, CheckCircle2, Timer,
} from 'lucide-react';
import type { Athlete, Session } from '../../lib/database.types';
import {
  simulateRace, simulateInverse, simulateAltitude, simulateAltitudeBlock,
  formatPace, formatTime, formatEngineMessage,
  type AthletePhysioProfile, type RaceScenario, type RaceSimResult,
  type AltitudeSimResult, type InverseSimResult, type AltitudeBlockResult,
  type Lang, type EngineMessage, type Terrain, type Strategy, type GlycogenState,
} from '../../lib/engine/simulationEngine';
import { useSimulationProfile, useRaceScenarios } from '../../hooks/useSimulation';
import { useLanguage } from '../../contexts/LanguageContext';
import { CyclingTtSimulator } from './CyclingTtSimulator';

type Tool = 'race' | 'inverse' | 'altitude' | 'block' | 'cycling';

const SEV_ICON: Record<string, typeof Info> = { danger: XCircle, warning: AlertTriangle, info: Info };
const SEV_COLOR: Record<string, string> = { danger: '#8A6900', warning: '#8A6900', info: '#2A1F4A' };

function MsgList({ msgs, lang }: { msgs: EngineMessage[]; lang: Lang }) {
  if (msgs.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {msgs.map((m, i) => {
        const Icon = SEV_ICON[m.severity ?? 'info'] ?? Info;
        const color = SEV_COLOR[m.severity ?? 'info'] ?? '#2A1F4A';
        return (
          <li key={i} className="flex items-start gap-2 font-body text-[12px] text-gray-600 dark:text-gray-300">
            <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color }} />
            <span>{formatEngineMessage(m, lang)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="font-heading text-lg font-bold mt-0.5" style={{ color: color ?? '#111827' }}>{value}</p>
      {sub && <p className="font-body text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

const FEAS_COLOR: Record<string, string> = {
  optimal: '#2A1F4A', challenging: '#8A6900', limit: '#8A6900', impossible: '#8A6900',
};

type SaveFn = (kind: 'race' | 'inverse' | 'altitude' | 'altitude_block' | 'cycling_tt', name: string, params: Record<string, unknown>, result: Record<string, unknown> | null) => Promise<void>;

function SaveButton({ saved, onClick, lang }: { saved: boolean; onClick: () => void; lang: Lang }) {
  return (
    <button onClick={onClick} disabled={saved} className="flex items-center gap-2 px-3 py-2 text-[12px] font-body rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-800 disabled:opacity-50 transition-colors">
      <Save className="w-3.5 h-3.5" /> {saved ? (lang === 'es' ? 'Guardado' : 'Saved') : (lang === 'es' ? 'Guardar' : 'Save')}
    </button>
  );
}

// ───────────────────────── Race simulator ─────────────────────────

function RaceSimulator({ profile, lang, onSave }: {
  profile: AthletePhysioProfile;
  lang: Lang;
  onSave: SaveFn;
}) {
  const [d, setD] = useState(42.195);
  const [name, setName] = useState('Maratón');
  const [pace, setPace] = useState('4:30');
  const [terrain, setTerrain] = useState<Terrain>('flat');
  const [temp, setTemp] = useState(18);
  const [rh, setRh] = useState(55);
  const [alt, setAlt] = useState(0);
  const [strategy, setStrategy] = useState<Strategy>('even');
  const [carbs, setCarbs] = useState(60);
  const [fluid, setFluid] = useState(0.5);
  const [gly, setGly] = useState<GlycogenState>('normal');
  const [result, setResult] = useState<RaceSimResult | null>(null);
  const [saved, setSaved] = useState(false);

  const parsePaceInput = (s: string) => {
    const parts = s.split(':').map(x => Number(x) || 0);
    if (parts.length === 2) return parts[0] + parts[1] / 60;
    return Number(s);
  };

  const run = () => {
    const targetPace = parsePaceInput(pace);
    if (!(targetPace > 0) || !(d > 0)) { setResult(null); return; }
    const scenario: RaceScenario = {
      distance_km: d, name, targetPace_min_km: targetPace, terrain,
      temperature_c: temp, humidity_percent: rh, altitude_m: alt,
      strategy, carbIntake_g_h: carbs, fluidIntake_L_h: fluid, glycogenState: gly,
    };
    try { setResult(simulateRace(profile, scenario)); setSaved(false); } catch { setResult(null); }
  };

  const save = async () => {
    if (!result) return;
    await onSave('race', name, {
      distance_km: d, targetPace_min_km: pace, terrain, temperature_c: temp,
      humidity_percent: rh, altitude_m: alt, strategy, carbIntake_g_h: carbs,
      fluidIntake_L_h: fluid, glycogenState: gly,
    }, {
      predictedTime_min: result.predictedTime_min, feasibility: result.feasibility,
      feasibilityRatio: result.feasibilityRatio, sustainablePace_min_km: result.sustainablePace_min_km,
    });
    setSaved(true);
  };

  const FEAS_LABEL: Record<string, string> = {
    optimal: lang === 'es' ? 'Óptimo' : 'Optimal',
    challenging: lang === 'es' ? 'Exigente' : 'Challenging',
    limit: lang === 'es' ? 'Límite' : 'At the limit',
    impossible: lang === 'es' ? 'No sostenible' : 'Not sustainable',
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Nombre' : 'Name'}</span>
          <input value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full px-3 py-2 text-[13px] font-body border border-gray-200 dark:border-gray-700 rounded-lg" />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Distancia (km)' : 'Distance (km)'}</span>
          <input type="number" min={1} step={0.1} value={d} onChange={e => setD(Number(e.target.value))} className="mt-1 w-full px-3 py-2 text-[13px] font-mono border border-gray-200 dark:border-gray-700 rounded-lg" />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Ritmo (min/km)' : 'Pace (min/km)'}</span>
          <input value={pace} onChange={e => setPace(e.target.value)} placeholder="4:30" className="mt-1 w-full px-3 py-2 text-[13px] font-mono border border-gray-200 dark:border-gray-700 rounded-lg" />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Terreno' : 'Terrain'}</span>
          <select value={terrain} onChange={e => setTerrain(e.target.value as Terrain)} className="mt-1 w-full px-3 py-2 text-[13px] font-body border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="flat">{lang === 'es' ? 'Llano' : 'Flat'}</option>
            <option value="rolling">{lang === 'es' ? 'Ondulado' : 'Rolling'}</option>
            <option value="hilly">{lang === 'es' ? 'Colinas' : 'Hilly'}</option>
          </select>
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Temp. (°C)' : 'Temp (°C)'}</span>
          <input type="number" value={temp} onChange={e => setTemp(Number(e.target.value))} className="mt-1 w-full px-3 py-2 text-[13px] font-mono border border-gray-200 dark:border-gray-700 rounded-lg" />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Humedad (%)' : 'Humidity (%)'}</span>
          <input type="number" min={5} max={99} value={rh} onChange={e => setRh(Number(e.target.value))} className="mt-1 w-full px-3 py-2 text-[13px] font-mono border border-gray-200 dark:border-gray-700 rounded-lg" />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Altitud (m)' : 'Altitude (m)'}</span>
          <input type="number" value={alt} onChange={e => setAlt(Number(e.target.value))} className="mt-1 w-full px-3 py-2 text-[13px] font-mono border border-gray-200 dark:border-gray-700 rounded-lg" />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Estrategia' : 'Strategy'}</span>
          <select value={strategy} onChange={e => setStrategy(e.target.value as Strategy)} className="mt-1 w-full px-3 py-2 text-[13px] font-body border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="even">{lang === 'es' ? 'Uniforme' : 'Even'}</option>
            <option value="positive">{lang === 'es' ? 'Positiva' : 'Positive'}</option>
            <option value="negative">{lang === 'es' ? 'Negativa' : 'Negative'}</option>
          </select>
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">CHO g/h</span>
          <input type="number" min={0} max={120} value={carbs} onChange={e => setCarbs(Number(e.target.value))} className="mt-1 w-full px-3 py-2 text-[13px] font-mono border border-gray-200 dark:border-gray-700 rounded-lg" />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Líquidos L/h' : 'Fluids L/h'}</span>
          <input type="number" min={0} max={1.5} step={0.1} value={fluid} onChange={e => setFluid(Number(e.target.value))} className="mt-1 w-full px-3 py-2 text-[13px] font-mono border border-gray-200 dark:border-gray-700 rounded-lg" />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Glucógeno' : 'Glycogen'}</span>
          <select value={gly} onChange={e => setGly(e.target.value as GlycogenState)} className="mt-1 w-full px-3 py-2 text-[13px] font-body border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="depleted">{lang === 'es' ? 'Bajo' : 'Depleted'}</option>
            <option value="normal">{lang === 'es' ? 'Normal' : 'Normal'}</option>
            <option value="loaded">{lang === 'es' ? 'Cargado' : 'Loaded'}</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button onClick={run} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold font-body rounded-lg bg-[#F7C843] text-[#2A1F4A] hover:bg-[#E7B92D] transition-colors">
            <Play className="w-3.5 h-3.5" /> {lang === 'es' ? 'Simular' : 'Simulate'}
          </button>
          {result && <SaveButton saved={saved} onClick={save} lang={lang} />}
        </div>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label={lang === 'es' ? 'Tiempo predicho' : 'Predicted time'} value={formatTime(result.predictedTime_min)} sub={`${formatPace(result.avgPace_min_km)} /km`} />
            <Stat
              label={lang === 'es' ? 'Viabilidad' : 'Feasibility'}
              value={FEAS_LABEL[result.feasibility]}
              sub={`${Math.round(result.feasibilityRatio * 100)} %`}
              color={FEAS_COLOR[result.feasibility]}
            />
            <Stat label={lang === 'es' ? 'Sostenible' : 'Sustainable'} value={formatPace(result.sustainablePace_min_km)} sub={formatTime(result.sustainableTime_min)} />
            <Stat label={lang === 'es' ? 'FC media' : 'Avg HR'} value={String(result.avgHR)} sub={`${Math.round(result.percentVO2max)} % VO2max`} />
            <Stat label={lang === 'es' ? 'Deshidratación' : 'Dehydration'} value={`${result.dehydration_pct} %`} sub={`${result.sweatRate_L_h} L/h`} color={result.dehydration_pct > 2 ? '#8A6900' : undefined} />
            <Stat label={lang === 'es' ? 'Pared' : 'Wall'} value={result.glycogenDepletionKm !== null ? `km ${result.glycogenDepletionKm}` : (lang === 'es' ? '—' : '—')} color={result.glycogenDepletionKm !== null ? '#8A6900' : '#2A1F4A'} />
            <Stat label="WBGT" value={`${result.wbgt} °C`} sub={`+${result.heatSlowdown_pct} %`} />
            <Stat label={lang === 'es' ? 'Energía' : 'Energy'} value={`${result.kcal} kcal`} sub={`${result.carbsUsed_g} g CHO · ${result.fatUsed_g} g fat`} />
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
            <MsgList msgs={result.riskFlags} lang={lang} />
            <MsgList msgs={result.recommendations} lang={lang} />
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto">
            <table className="w-full text-[12px] font-body">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2 text-left font-semibold">km</th>
                  <th className="px-3 py-2 text-right font-semibold">{lang === 'es' ? 'Ritmo' : 'Pace'}</th>
                  <th className="px-3 py-2 text-right font-semibold">FC</th>
                  <th className="px-3 py-2 text-right font-semibold">% VO2max</th>
                  <th className="px-3 py-2 text-right font-semibold">{lang === 'es' ? 'Lactato' : 'Lactate'}</th>
                  <th className="px-3 py-2 text-right font-semibold">{lang === 'es' ? 'Glucógeno' : 'Glycogen'}</th>
                  <th className="px-3 py-2 text-right font-semibold">{lang === 'es' ? 'Deshidr.' : 'Dehydr.'}</th>
                  <th className="px-3 py-2 text-right font-semibold">{lang === 'es' ? 'Zona' : 'Zone'}</th>
                </tr>
              </thead>
              <tbody>
                {result.splits.map((s, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-3 py-1.5 font-mono text-gray-700 dark:text-gray-200">{s.km}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-700 dark:text-gray-200">{s.paceStr}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-600 dark:text-gray-300">{s.hr}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-600 dark:text-gray-300">{s.percentVO2max}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-600 dark:text-gray-300">{s.lactate_mmol}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-600 dark:text-gray-300">{s.glycogenRemaining_g}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-600 dark:text-gray-300">{s.dehydration_pct} %</td>
                    <td className="px-3 py-1.5 text-right text-gray-500 dark:text-gray-400">{s.zone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Inverse simulator ─────────────────────────

function InverseSimulator({ profile, lang, onSave }: {
  profile: AthletePhysioProfile;
  lang: Lang;
  onSave: SaveFn;
}) {
  const [d, setD] = useState(42.195);
  const [targetH, setTargetH] = useState('3:00:00');
  const [terrain, setTerrain] = useState<Terrain>('flat');
  const [temp, setTemp] = useState(18);
  const [rh, setRh] = useState(55);
  const [alt, setAlt] = useState(0);
  const [result, setResult] = useState<InverseSimResult | null>(null);
  const [saved, setSaved] = useState(false);

  const parseHMS = (s: string) => {
    const parts = s.split(':').map(x => Number(x) || 0);
    if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
    if (parts.length === 2) return parts[0] + parts[1] / 60;
    return NaN;
  };

  const run = () => {
    const targetTime = parseHMS(targetH);
    if (!(targetTime > 0)) { setResult(null); return; }
    try {
      setResult(simulateInverse(targetTime, { distance_km: d, terrain, temperature_c: temp, humidity_percent: rh, altitude_m: alt }, profile.vo2max, { running_economy: profile.running_economy }));
      setSaved(false);
    } catch { setResult(null); }
  };

  const save = async () => {
    if (!result) return;
    await onSave('inverse', `${lang === 'es' ? 'Objetivo' : 'Goal'} ${d} km · ${targetH}`, {
      distance_km: d, target_time_min: targetH, terrain, temperature_c: temp, humidity_percent: rh, altitude_m: alt,
    }, { requiredVO2max: result.requiredVO2max, gap: result.gap, currentSustainableTime_min: result.currentSustainableTime_min });
    setSaved(true);
  };

  const sev = result?.feasibilityComment.severity ?? 'info';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Distancia (km)' : 'Distance (km)'}</span>
          <input type="number" min={1} step={0.1} value={d} onChange={e => setD(Number(e.target.value))} className="mt-1 w-full px-3 py-2 text-[13px] font-mono border border-gray-200 dark:border-gray-700 rounded-lg" />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Objetivo (h:mm:ss)' : 'Target (h:mm:ss)'}</span>
          <input value={targetH} onChange={e => setTargetH(e.target.value)} placeholder="3:00:00" className="mt-1 w-full px-3 py-2 text-[13px] font-mono border border-gray-200 dark:border-gray-700 rounded-lg" />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Terreno' : 'Terrain'}</span>
          <select value={terrain} onChange={e => setTerrain(e.target.value as Terrain)} className="mt-1 w-full px-3 py-2 text-[13px] font-body border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="flat">{lang === 'es' ? 'Llano' : 'Flat'}</option>
            <option value="rolling">{lang === 'es' ? 'Ondulado' : 'Rolling'}</option>
            <option value="hilly">{lang === 'es' ? 'Colinas' : 'Hilly'}</option>
          </select>
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Temp. (°C)' : 'Temp (°C)'}</span>
          <input type="number" value={temp} onChange={e => setTemp(Number(e.target.value))} className="mt-1 w-full px-3 py-2 text-[13px] font-mono border border-gray-200 dark:border-gray-700 rounded-lg" />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Altitud (m)' : 'Altitude (m)'}</span>
          <input type="number" value={alt} onChange={e => setAlt(Number(e.target.value))} className="mt-1 w-full px-3 py-2 text-[13px] font-mono border border-gray-200 dark:border-gray-700 rounded-lg" />
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={run} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold font-body rounded-lg bg-[#F7C843] text-[#2A1F4A] hover:bg-[#E7B92D] transition-colors">
          <Play className="w-3.5 h-3.5" /> {lang === 'es' ? 'Calcular' : 'Calculate'}
        </button>
        {result && <SaveButton saved={saved} onClick={save} lang={lang} />}
      </div>

      {result && (
        <div className="space-y-4">
          <div className={`rounded-xl px-4 py-3 flex items-center gap-2 border ${
            sev === 'danger' ? 'bg-red-50 border-red-100' : sev === 'warning' ? 'bg-[#F7C843]/20 dark:bg-[#F7C843]/10 border-[#F7C843]/40 dark:border-[#F7C843]/30' : 'bg-[#2A1F4A]/5 dark:bg-[#B8A9E5]/10 border-[#2A1F4A]/20 dark:border-[#B8A9E5]/30'
          }`}>
            {sev === 'danger' ? <XCircle className="w-4 h-4 text-red-500" /> : sev === 'warning' ? <AlertTriangle className="w-4 h-4 text-[#8A6900] dark:text-[#F7C843]" /> : <CheckCircle2 className="w-4 h-4 text-[#2A1F4A] dark:text-[#B8A9E5]" />}
            <p className="font-body text-[13px] text-gray-700 dark:text-gray-200">{formatEngineMessage(result.feasibilityComment, lang)}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="VO2max " value={String(profile.vo2max)} sub={lang === 'es' ? 'actual' : 'current'} />
            <Stat label={lang === 'es' ? 'VO2max requerido' : 'Required VO2max'} value={String(result.requiredVO2max)} color={result.gap > 0 ? '#8A6900' : '#2A1F4A'} />
            <Stat label={lang === 'es' ? 'Brecha' : 'Gap'} value={`${result.gap > 0 ? '+' : ''}${result.gap}`} sub={lang === 'es' ? 'ml/kg/min' : 'ml/kg/min'} />
            <Stat label={lang === 'es' ? 'Hoy, sostenible' : 'Today, sustainable'} value={formatTime(result.currentSustainableTime_min)} sub={`${formatPace(result.currentSustainablePace_min_km)} /km`} />
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto">
            <table className="w-full text-[12px] font-body">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2 text-left font-semibold">{lang === 'es' ? 'Semana' : 'Week'}</th>
                  <th className="px-3 py-2 text-right font-semibold">VO2max</th>
                  <th className="px-3 py-2 text-right font-semibold">{lang === 'es' ? 'Tiempo' : 'Time'}</th>
                  <th className="px-3 py-2 text-right font-semibold">{lang === 'es' ? 'Ritmo' : 'Pace'}</th>
                  <th className="px-3 py-2 text-right font-semibold">{lang === 'es' ? 'vs objetivo' : 'vs target'}</th>
                </tr>
              </thead>
              <tbody>
                {result.projection.map(p => (
                  <tr key={p.week} className="border-b border-gray-50">
                    <td className="px-3 py-1.5 font-mono text-gray-700 dark:text-gray-200">{p.week}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-700 dark:text-gray-200">{p.projectedVO2max}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-700 dark:text-gray-200">{formatTime(p.projectedTime_min)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-600 dark:text-gray-300">{formatPace(p.projectedPace_min_km)}</td>
                    <td className="px-3 py-1.5 text-right font-mono" style={{ color: p.targetReached ? '#2A1F4A' : '#8A6900' }}>
                      {p.targetReached ? '✓' : `+${p.diffVsTarget_min.toFixed(1)} min`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-1">
            {result.assumptions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 font-body text-[11px] text-gray-400">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" /> {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Altitude simulator ─────────────────────────

function AltitudeSimulator({ profile, lang, onSave }: {
  profile: AthletePhysioProfile;
  lang: Lang;
  onSave: SaveFn;
}) {
  const [alt, setAlt] = useState(2400);
  const [days, setDays] = useState(21);
  const [hpd, setHpd] = useState(24);
  const [load, setLoad] = useState<'rest' | 'light' | 'moderate' | 'hard'>('moderate');
  const [result, setResult] = useState<AltitudeSimResult | null>(null);
  const [saved, setSaved] = useState(false);

  const run = () => {
    try {
      setResult(simulateAltitude(profile, { altitude_m: alt, exposure_days: days, training_load: load, hoursPerDay: hpd }));
      setSaved(false);
    } catch { setResult(null); }
  };

  const save = async () => {
    if (!result) return;
    await onSave('altitude', `${alt} m · ${days} d`, {
      altitude_m: alt, exposure_days: days, training_load: load, hoursPerDay: hpd,
    }, { vo2maxReduction_pct: result.vo2maxReduction_pct, hbMassGain_pct: result.hbMassGain_pct, performanceLoss_pct: result.performanceLoss_pct });
    setSaved(true);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Altitud (m)' : 'Altitude (m)'}</span>
          <input type="number" value={alt} onChange={e => setAlt(Number(e.target.value))} className="mt-1 w-full px-3 py-2 text-[13px] font-mono border border-gray-200 dark:border-gray-700 rounded-lg" />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Días de exposición' : 'Exposure days'}</span>
          <input type="number" min={1} max={28} value={days} onChange={e => setDays(Number(e.target.value))} className="mt-1 w-full px-3 py-2 text-[13px] font-mono border border-gray-200 dark:border-gray-700 rounded-lg" />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Horas/día en altitud' : 'Hours/day at altitude'}</span>
          <input type="number" min={8} max={24} value={hpd} onChange={e => setHpd(Number(e.target.value))} className="mt-1 w-full px-3 py-2 text-[13px] font-mono border border-gray-200 dark:border-gray-700 rounded-lg" />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Carga de entrenamiento' : 'Training load'}</span>
          <select value={load} onChange={e => setLoad(e.target.value as typeof load)} className="mt-1 w-full px-3 py-2 text-[13px] font-body border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="rest">{lang === 'es' ? 'Descanso' : 'Rest'}</option>
            <option value="light">{lang === 'es' ? 'Suave' : 'Light'}</option>
            <option value="moderate">{lang === 'es' ? 'Moderada' : 'Moderate'}</option>
            <option value="hard">{lang === 'es' ? 'Intensa' : 'Hard'}</option>
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={run} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold font-body rounded-lg bg-[#F7C843] text-[#2A1F4A] hover:bg-[#E7B92D] transition-colors">
          <Play className="w-3.5 h-3.5" /> {lang === 'es' ? 'Simular' : 'Simulate'}
        </button>
        {result && <SaveButton saved={saved} onClick={save} lang={lang} />}
      </div>

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label={lang === 'es' ? 'Pérdida VO2max' : 'VO2max loss'} value={`${result.vo2maxReduction_pct} %`} sub={`${result.vo2maxReductionRange_pct[0]}–${result.vo2maxReductionRange_pct[1]} %`} color="#8A6900" />
            <Stat label={lang === 'es' ? 'Pérdida rendimiento' : 'Performance loss'} value={`${result.performanceLoss_pct} %`} />
            <Stat label="SpO2" value={`${result.spo2Rest} %`} sub={lang === 'es' ? 'reposo' : 'rest'} />
            <Stat label="Hb-mass" value={`+${result.hbMassGain_pct} %`} sub={lang === 'es' ? 'al final de la exposición' : 'at exposure end'} color="#2A1F4A" />
            <Stat label="pO2 alveolar" value={String(result.alveolarPO2)} sub="mmHg" />
            <Stat label={lang === 'es' ? 'Aumento FC' : 'HR increase'} value={`+${result.hrIncrease_bpm} bpm`} />
            <Stat label={lang === 'es' ? 'Ventilación' : 'Ventilation'} value={`+${result.ventilationIncrease_pct} %`} />
            <Stat label="PB" value={`${result.barometric_mmHg} mmHg`} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <p className="font-body text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">{lang === 'es' ? 'Alertas y recomendaciones' : 'Alerts & recommendations'}</p>
              <div className="space-y-3">
                <MsgList msgs={result.riskFlags} lang={lang} />
                <MsgList msgs={result.recommendations} lang={lang} />
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <p className="font-body text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">{lang === 'es' ? 'Aclimatación día a día' : 'Day-by-day acclimatization'}</p>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-[12px] font-body">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                      <th className="px-2 py-1.5 text-left font-semibold">{lang === 'es' ? 'Día' : 'Day'}</th>
                      <th className="px-2 py-1.5 text-right font-semibold">VO2max</th>
                      <th className="px-2 py-1.5 text-right font-semibold">% {lang === 'es' ? 'nivel mar' : 'sea level'}</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Hb</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.acclimatization.map(a => (
                      <tr key={a.day} className="border-b border-gray-50">
                        <td className="px-2 py-1 font-mono text-gray-700 dark:text-gray-200">{a.day}</td>
                        <td className="px-2 py-1 text-right font-mono text-gray-700 dark:text-gray-200">{a.vo2max}</td>
                        <td className="px-2 py-1 text-right font-mono text-gray-600 dark:text-gray-300">{a.vo2maxPctOfSeaLevel}</td>
                        <td className="px-2 py-1 text-right font-mono text-gray-600 dark:text-gray-300">+{a.hbMassGain_pct}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Altitude block comparator ─────────────────────────

function BlockSimulator({ profile, lang, onSave }: {
  profile: AthletePhysioProfile;
  lang: Lang;
  onSave: SaveFn;
}) {
  const [alt, setAlt] = useState(2400);
  const [days, setDays] = useState(21);
  const [hpd, setHpd] = useState(14);
  const [d, setD] = useState(42.195);
  const [pace, setPace] = useState('4:30');
  const [result, setResult] = useState<AltitudeBlockResult | null>(null);
  const [saved, setSaved] = useState(false);

  const parsePaceInput = (s: string) => {
    const parts = s.split(':').map(x => Number(x) || 0);
    if (parts.length === 2) return parts[0] + parts[1] / 60;
    return Number(s);
  };

  const run = () => {
    const targetPace = parsePaceInput(pace);
    if (!(targetPace > 0)) { setResult(null); return; }
    try {
      setResult(simulateAltitudeBlock(profile, { altitude_m: alt, days, hoursPerDay: hpd, distance_km: d, targetPace_min_km: targetPace }));
      setSaved(false);
    } catch { setResult(null); }
  };

  const save = async () => {
    if (!result) return;
    await onSave('altitude_block', `${alt} m · ${days} d · ${d} km`, {
      altitude_m: alt, days, hoursPerDay: hpd, distance_km: d, targetPace_min_km: pace,
    }, { hbMassGain_pct: result.hbMassGain_pct, timeSaving_min: result.timeSaving_min.central, doseHours: result.doseHours });
    setSaved(true);
  };

  const fmtMin = (m: number) => (m >= 0 ? `−${m.toFixed(1)} min` : `+${Math.abs(m).toFixed(1)} min`);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Altitud (m)' : 'Altitude (m)'}</span>
          <input type="number" value={alt} onChange={e => setAlt(Number(e.target.value))} className="mt-1 w-full px-3 py-2 text-[13px] font-mono border border-gray-200 dark:border-gray-700 rounded-lg" />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Días' : 'Days'}</span>
          <input type="number" min={1} max={28} value={days} onChange={e => setDays(Number(e.target.value))} className="mt-1 w-full px-3 py-2 text-[13px] font-mono border border-gray-200 dark:border-gray-700 rounded-lg" />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Horas/día' : 'Hours/day'}</span>
          <input type="number" min={8} max={24} value={hpd} onChange={e => setHpd(Number(e.target.value))} className="mt-1 w-full px-3 py-2 text-[13px] font-mono border border-gray-200 dark:border-gray-700 rounded-lg" />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Distancia (km)' : 'Distance (km)'}</span>
          <input type="number" min={1} step={0.1} value={d} onChange={e => setD(Number(e.target.value))} className="mt-1 w-full px-3 py-2 text-[13px] font-mono border border-gray-200 dark:border-gray-700 rounded-lg" />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wide text-gray-400">{lang === 'es' ? 'Ritmo (min/km)' : 'Pace (min/km)'}</span>
          <input value={pace} onChange={e => setPace(e.target.value)} placeholder="4:30" className="mt-1 w-full px-3 py-2 text-[13px] font-mono border border-gray-200 dark:border-gray-700 rounded-lg" />
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={run} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold font-body rounded-lg bg-[#F7C843] text-[#2A1F4A] hover:bg-[#E7B92D] transition-colors">
          <Play className="w-3.5 h-3.5" /> {lang === 'es' ? 'Comparar' : 'Compare'}
        </button>
        {result && <SaveButton saved={saved} onClick={save} lang={lang} />}
      </div>

      {result && (
        <div className="space-y-4">
          {result.doseWarning && (
            <div className="rounded-xl px-4 py-3 flex items-center gap-2 bg-[#F7C843]/20 dark:bg-[#F7C843]/10 border border-[#F7C843]/40 dark:border-[#F7C843]/30">
              <AlertTriangle className="w-4 h-4 text-[#8A6900] dark:text-[#F7C843]" />
              <p className="font-body text-[12px] text-[#8A6900] dark:text-[#F7C843]">
                {lang === 'es'
                  ? 'Dosis insuficiente: se recomiendan ≥2100 m y ≥250 horas de exposición.'
                  : 'Insufficient dose: ≥2100 m and ≥250 exposure hours recommended.'}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Hb-mass" value={`+${result.hbMassGain_pct} %`} sub={`${result.doseHours} h`} color="#2A1F4A" />
            <Stat label={`VO2max ${lang === 'es' ? 'antes → después' : 'before → after'}`} value={`${result.vo2max.before} → ${result.vo2max.afterCentral}`} sub={lang === 'es' ? 'escenario central' : 'central scenario'} />
            <Stat label={lang === 'es' ? 'Ahorro (central)' : 'Saving (central)'} value={fmtMin(result.timeSaving_min.central)} sub={`rango ${fmtMin(result.timeSaving_min.low)} / ${fmtMin(result.timeSaving_min.high)}`} color="#2A1F4A" />
            <Stat label={lang === 'es' ? 'Ritmo óptimo al volver' : 'Optimal pace on return'} value={`${formatPace(result.optimalReturnPace_min_km)} /km`} />
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <p className="font-body text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
              {lang === 'es' ? `Carrera de referencia: ${formatTime(result.before.sustainableTime_min)} sostenible → ${formatTime(result.after.sustainableTime_min)} tras el bloque` : `Reference race: ${formatTime(result.before.sustainableTime_min)} sustainable → ${formatTime(result.after.sustainableTime_min)} after the block`}
            </p>
            <MsgList msgs={result.altitude.riskFlags} lang={lang} />
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Main view ─────────────────────────

export function SimulatorView({ athlete, sessions, athleteEmail }: { athlete: Athlete; sessions: Session[]; athleteEmail: string }) {
  const { lang } = useLanguage();
  const { profile, labTest, loading: profileLoading } = useSimulationProfile(athlete);
  const { scenarios, loading: scenLoading, error: scenarioError, save, remove } = useRaceScenarios(athlete.id);
  const [tool, setTool] = useState<Tool>('race');

  const TOOLS: { id: Tool; label: string; desc: string }[] = [
    { id: 'race', label: lang === 'es' ? 'Carrera' : 'Race', desc: lang === 'es' ? 'Ritmo, calor, altitud, glucógeno' : 'Pace, heat, altitude, glycogen' },
    { id: 'inverse', label: lang === 'es' ? 'Objetivo inverso' : 'Inverse goal', desc: 'VO2max ' + (lang === 'es' ? 'necesario' : 'required') },
    { id: 'altitude', label: lang === 'es' ? 'Altitud' : 'Altitude', desc: lang === 'es' ? 'Aclimatación y pérdida' : 'Acclimatization & loss' },
    { id: 'block', label: lang === 'es' ? 'Bloque altitud' : 'Altitude block', desc: lang === 'es' ? 'Antes vs después' : 'Before vs after' },
    { id: 'cycling', label: lang === 'es' ? 'Contrarreloj bici' : 'Cycling TT', desc: lang === 'es' ? 'Potencia, recorrido, viento' : 'Power, course, wind' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-gray-900 dark:text-white">{lang === 'es' ? 'Simulador' : 'Simulator'}</h1>
        <p className="font-body text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">
          {lang === 'es'
            ? 'Modelo Daniels-Gilbert con datos del laboratorio' + (labTest ? ` · último test ${labTest.test_date}` : ' · sin test de laboratorio, se usan valores del perfil')
            : 'Daniels-Gilbert model with lab data' + (labTest ? ` · last test ${labTest.test_date}` : ' · no lab test, profile values used')}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TOOLS.map(t => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            className={`flex-shrink-0 flex flex-col items-start px-4 py-3 rounded-xl border transition-all ${
              tool === t.id ? 'bg-[#F7C843] border-[#F7C843] text-[#2A1F4A]' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
            }`}
          >
            <span className={`font-body text-[12px] font-semibold ${tool === t.id ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'}`}>{t.label}</span>
            <span className={`font-body text-[10px] mt-0.5 ${tool === t.id ? 'text-gray-300' : 'text-gray-400'}`}>{t.desc}</span>
          </button>
        ))}
      </div>

      {profileLoading ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center font-body text-[13px] text-gray-400">
          {lang === 'es' ? 'Cargando perfil fisiológico…' : 'Loading physiological profile…'}
        </div>
      ) : (
        <>
          {tool === 'race' && <RaceSimulator profile={profile} lang={lang} onSave={save} />}
          {tool === 'inverse' && <InverseSimulator profile={profile} lang={lang} onSave={save} />}
          {tool === 'altitude' && <AltitudeSimulator profile={profile} lang={lang} onSave={save} />}
          {tool === 'block' && <BlockSimulator profile={profile} lang={lang} onSave={save} />}
          {tool === 'cycling' && <CyclingTtSimulator athlete={athlete} sessions={sessions} athleteEmail={athleteEmail} onSave={save} />}

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-[14px] font-bold text-gray-900 dark:text-white">
                {lang === 'es' ? 'Escenarios guardados' : 'Saved scenarios'}
              </h3>
              <span className="font-mono text-[10px] text-gray-400">{scenarios.length}</span>
            </div>
            {scenarioError && (
              <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-body text-[12px] text-red-700">
                {scenarioError}
              </p>
            )}
            {scenLoading ? (
              <p className="font-body text-[12px] text-gray-400">…</p>
            ) : scenarios.length === 0 ? (
              <p className="font-body text-[12px] text-gray-400">
                {lang === 'es' ? 'Todavía no guardaste ningún escenario.' : 'No saved scenarios yet.'}
              </p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {scenarios.map(s => {
                  const r = s.result as Record<string, number | string> | null;
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="font-body text-[13px] font-semibold text-gray-800 dark:text-gray-100 truncate">
                          {s.name}
                          <span className="ml-2 text-[10px] font-mono text-gray-400 uppercase">{s.kind}</span>
                        </p>
                        {r && (
                          <p className="font-body text-[11px] text-gray-500 dark:text-gray-400 truncate">
                            {typeof r.predictedTime_min === 'number' && `${lang === 'es' ? 'pred' : 'pred'} ${formatTime(r.predictedTime_min)} · `}
                            {typeof r.feasibilityRatio === 'number' && `${Math.round(r.feasibilityRatio * 100)} % · `}
                            {typeof r.requiredVO2max === 'number' && `VO2max ${r.requiredVO2max} · `}
                            {typeof r.timeSaving_min === 'number' && `${fmtMinLocal(r.timeSaving_min)} · `}
                            {typeof r.hbMassGain_pct === 'number' && `Hb +${r.hbMassGain_pct} %`}
                            {typeof r.time_s === 'number' && `${formatHMSLocal(r.time_s)} · `}
                            {typeof r.avgPower_w === 'number' && `${Math.round(r.avgPower_w)} W`}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-body text-[11px] text-gray-400">{new Date(s.created_at).toLocaleDateString()}</span>
                        <button onClick={() => remove(s.id)} className="text-gray-300 hover:text-red-500 transition-colors" title={lang === 'es' ? 'Eliminar' : 'Delete'}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function fmtMinLocal(m: number): string {
  return m >= 0 ? `−${m.toFixed(1)} min` : `+${Math.abs(m).toFixed(1)} min`;
}

function formatHMSLocal(totalSeconds: number): string {
  const t = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
