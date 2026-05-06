import { useState } from 'react';
import { Save, User, AlertTriangle, CheckCircle, Trophy, Calendar, Shield, Plus, Trash2, Activity, ChevronDown, ChevronUp, Database } from 'lucide-react';
import type { Athlete, AthleteInsert, Session, TrainingBlock, TrainingBlockInsert, RaceScheduleEntry, RaceScheduleInsert, HealthHistoryEntry, HealthHistoryInsert } from '../../lib/database.types';
import { individualizedTau } from '../../lib/engine/tauPersonalizer';
import { generateDemoSessions } from '../../lib/demoData';
import { useLanguage } from '../../contexts/LanguageContext';

interface AthleteProfileProps {
  athlete: Athlete | null;
  userId: string;
  onSave: (data: Omit<AthleteInsert, 'user_id'>) => Promise<void>;
  onUpdate: (data: Partial<Athlete>) => Promise<void>;
  sessions?: Session[];
  raceSchedule?: RaceScheduleEntry[];
  trainingBlocks?: TrainingBlock[];
  healthHistory?: HealthHistoryEntry[];
  onAddRace?: (race: RaceScheduleInsert) => Promise<void>;
  onUpdateRace?: (id: string, data: Partial<RaceScheduleEntry>) => Promise<void>;
  onDeleteRace?: (id: string) => Promise<void>;
  onAddBlock?: (block: TrainingBlockInsert) => Promise<void>;
  onDeleteBlock?: (id: string) => Promise<void>;
  onAddHealthEvent?: (event: HealthHistoryInsert) => Promise<void>;
  onDeleteHealthEvent?: (id: string) => Promise<void>;
  onAddSession?: (sessions: import('../../lib/database.types').SessionInsert[]) => Promise<void>;
}

type Tab = 'profile' | 'races' | 'blocks' | 'health';

const SPORT_OPTIONS = ['cycling', 'running', 'triathlon', 'swimming', 'rowing', 'crossfit', 'other'];
const BLOCK_TYPES = ['base', 'build', 'peak', 'taper', 'recovery'] as const;
const EVENT_TYPES = ['injury', 'illness', 'surgery', 'medication_start', 'medication_end', 'other'] as const;
const PRIORITY_COLORS: Record<string, string> = { a: '#ef4444', b: '#f59e0b', c: '#0ea5e9' };

function validateProfile(form: Record<string, string>): string[] {
  const issues: string[] = [];
  const vo2 = parseFloat(form.vo2max);
  const vla = parseFloat(form.vlamax);
  const cp = parseInt(form.cp_watts);
  const ftp = parseInt(form.ftp_watts);
  const maxHr = parseInt(form.max_hr);
  const restHr = parseInt(form.resting_hr);
  const weight = parseFloat(form.weight_kg);

  if (vo2 < 20 || vo2 > 90) issues.push('VO2max should be between 20 and 90 ml/kg/min');
  if (vla < 0.1 || vla > 1.5) issues.push('vLamax should be between 0.1 and 1.5 mmol/l/s');
  if (cp > 0 && ftp > 0 && ftp > cp * 1.05) issues.push('FTP should not exceed CP — typically FTP ≈ 95% of CP');
  if (maxHr > 0 && restHr > 0 && restHr >= maxHr) issues.push('Resting HR must be lower than Max HR');
  if (cp > 0 && weight > 0 && cp / weight > 8) issues.push('W/kg ratio above 8 is unusually high — check Critical Power value');
  if (cp > 0 && weight > 0 && cp / weight < 0.5) issues.push('W/kg ratio below 0.5 is unusually low — check Critical Power value');
  return issues;
}

export function AthleteProfile({
  athlete,
  userId,
  onSave,
  onUpdate,
  sessions = [],
  raceSchedule = [],
  trainingBlocks = [],
  healthHistory = [],
  onAddRace,
  onUpdateRace,
  onDeleteRace,
  onAddBlock,
  onDeleteBlock,
  onAddHealthEvent,
  onDeleteHealthEvent,
  onAddSession,
}: AthleteProfileProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const [form, setForm] = useState({
    name: athlete?.name ?? '',
    sport: athlete?.sport ?? 'cycling',
    vo2max: athlete?.vo2max?.toString() ?? '50',
    vlamax: athlete?.vlamax?.toString() ?? '0.4',
    lean_mass_kg: athlete?.lean_mass_kg?.toString() ?? '70',
    weight_kg: athlete?.weight_kg?.toString() ?? '75',
    cp_watts: athlete?.cp_watts?.toString() ?? '250',
    ftp_watts: athlete?.ftp_watts?.toString() ?? '235',
    max_hr: athlete?.max_hr?.toString() ?? '185',
    resting_hr: athlete?.resting_hr?.toString() ?? '50',
    sport_weights_endurance: (athlete?.sport_weights as { endurance: number } | undefined)?.endurance?.toString() ?? '0.7',
    sport_weights_strength: (athlete?.sport_weights as { strength: number } | undefined)?.strength?.toString() ?? '0.2',
    sport_weights_other: (athlete?.sport_weights as { other: number } | undefined)?.other?.toString() ?? '0.1',
  });

  const [raceForm, setRaceForm] = useState({ race_name: '', race_date: '', race_type: 'road', distance_km: '', goal_duration_min: '', priority: 'a' as 'a' | 'b' | 'c', notes: '' });
  const [showRaceForm, setShowRaceForm] = useState(false);
  const [blockForm, setBlockForm] = useState({ block_type: 'base' as typeof BLOCK_TYPES[number], start_date: '', end_date: '', target_focus: '', notes: '' });
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [healthForm, setHealthForm] = useState({ event_date: new Date().toISOString().split('T')[0], event_type: 'injury' as typeof EVENT_TYPES[number], description: '', recovery_expected_days: '', is_current: false, notes: '' });
  const [showHealthForm, setShowHealthForm] = useState(false);

  const setF = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const validationIssues = validateProfile(form);

  const computedTau = (() => {
    try {
      return individualizedTau({
        vo2max: parseFloat(form.vo2max) || 50,
        vlamax: parseFloat(form.vlamax) || 0.4,
        leanMassKg: parseFloat(form.lean_mass_kg) || 70,
        weightKg: parseFloat(form.weight_kg) || 75,
        cpWatts: parseInt(form.cp_watts) || 250,
        maxHr: parseInt(form.max_hr) || 185,
        restingHr: parseInt(form.resting_hr) || 50,
      });
    } catch {
      return null;
    }
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data: Omit<AthleteInsert, 'user_id'> = {
        name: form.name,
        sport: form.sport,
        vo2max: parseFloat(form.vo2max) || 50,
        vlamax: parseFloat(form.vlamax) || 0.4,
        lean_mass_kg: parseFloat(form.lean_mass_kg) || 70,
        weight_kg: parseFloat(form.weight_kg) || 75,
        cp_watts: parseInt(form.cp_watts) || 250,
        ftp_watts: parseInt(form.ftp_watts) || 235,
        max_hr: parseInt(form.max_hr) || 185,
        resting_hr: parseInt(form.resting_hr) || 50,
        sport_weights: {
          endurance: parseFloat(form.sport_weights_endurance) || 0.7,
          strength: parseFloat(form.sport_weights_strength) || 0.2,
          other: parseFloat(form.sport_weights_other) || 0.1,
        },
      };
      if (athlete) {
        await onUpdate(data);
      } else {
        await onSave(data);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddRace || !athlete) return;
    await onAddRace({
      athlete_id: athlete.id,
      race_name: raceForm.race_name,
      race_date: raceForm.race_date,
      race_type: raceForm.race_type,
      distance_km: raceForm.distance_km ? parseFloat(raceForm.distance_km) : undefined,
      goal_duration_min: raceForm.goal_duration_min ? parseInt(raceForm.goal_duration_min) : undefined,
      priority: raceForm.priority,
      notes: raceForm.notes || undefined,
    });
    setRaceForm({ race_name: '', race_date: '', race_type: 'road', distance_km: '', goal_duration_min: '', priority: 'a', notes: '' });
    setShowRaceForm(false);
  };

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddBlock || !athlete) return;
    await onAddBlock({
      athlete_id: athlete.id,
      block_type: blockForm.block_type,
      start_date: blockForm.start_date,
      end_date: blockForm.end_date,
      target_focus: blockForm.target_focus || undefined,
      notes: blockForm.notes || undefined,
    });
    setBlockForm({ block_type: 'base', start_date: '', end_date: '', target_focus: '', notes: '' });
    setShowBlockForm(false);
  };

  const handleAddHealthEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddHealthEvent || !athlete) return;
    await onAddHealthEvent({
      athlete_id: athlete.id,
      event_date: healthForm.event_date,
      event_type: healthForm.event_type,
      description: healthForm.description,
      recovery_expected_days: healthForm.recovery_expected_days ? parseInt(healthForm.recovery_expected_days) : undefined,
      is_current: healthForm.is_current,
      notes: healthForm.notes || undefined,
    });
    setHealthForm({ event_date: new Date().toISOString().split('T')[0], event_type: 'injury', description: '', recovery_expected_days: '', is_current: false, notes: '' });
    setShowHealthForm(false);
  };

  const handleLoadDemo = async () => {
    if (!onAddSession || !athlete) return;
    setDemoLoading(true);
    try {
      const demoSessions = generateDemoSessions(athlete.id, athlete.cp_watts ?? 250);
      await onAddSession(demoSessions);
    } finally {
      setDemoLoading(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: t('physiology'), icon: User },
    { id: 'races', label: t('races'), icon: Trophy },
    { id: 'blocks', label: t('blocks'), icon: Calendar },
    { id: 'health', label: t('health'), icon: Shield },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-white">{t('athleteProfileTitle')}</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">{t('athleteProfileSubtitle')}</p>
        </div>
        {athlete && sessions.length < 5 && onAddSession && (
          <button
            onClick={handleLoadDemo}
            disabled={demoLoading}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 font-semibold text-[12px] px-3 py-2 rounded-lg transition-colors"
          >
            <Database className="w-3.5 h-3.5" />
            {demoLoading ? t('loadingDots') : t('loadDemoData')}
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-slate-800/40 p-1 rounded-xl">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[12px] font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#0d1420] text-white border border-slate-700/50'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'profile' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {validationIssues.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-[12px] font-semibold text-amber-400">{t('profileValidationIssues')}</p>
              </div>
              {validationIssues.map((issue, i) => (
                <p key={i} className="text-[11px] text-amber-300/80 pl-6">• {issue}</p>
              ))}
            </div>
          )}

          {validationIssues.length === 0 && form.name && (
            <div className="bg-green-500/5 border border-green-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <p className="text-[12px] text-green-400">{t('profileParamsValid')}</p>
            </div>
          )}

          <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4 space-y-3">
            <h3 className="text-[12px] font-mono uppercase tracking-wider text-slate-400">{t('identity')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1.5">{t('fullName')}</label>
                <input type="text" value={form.name} onChange={e => setF('name', e.target.value)} required
                  placeholder={t('athleteNamePlaceholder')}
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50" />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1.5">{t('primarySport')}</label>
                <select value={form.sport} onChange={e => setF('sport', e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-cyan-500/50 capitalize">
                  {SPORT_OPTIONS.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-mono uppercase tracking-wider text-slate-400">{t('physiologicalParameters')}</h3>
              <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors">
                {showAdvanced ? <><ChevronUp className="w-3.5 h-3.5" /> {t('less')}</> : <><ChevronDown className="w-3.5 h-3.5" /> {t('advanced')}</>}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { field: 'vo2max', label: 'VO2max', unit: 'ml/kg/min', step: '0.1', hint: t('aerobicCapacity') },
                { field: 'vlamax', label: 'vLamax', unit: 'mmol/l/s', step: '0.001', hint: t('anaerobicCapacity') },
                { field: 'cp_watts', label: t('cp'), unit: 'W', step: '1', hint: t('powerAtCp') },
                { field: 'ftp_watts', label: t('ftp'), unit: 'W', step: '1', hint: t('approx95cp') },
                { field: 'max_hr', label: t('maxHr'), unit: 'bpm', step: '1', hint: t('maximumHr') },
                { field: 'resting_hr', label: t('restingHr'), unit: 'bpm', step: '1', hint: t('morningRestingHr') },
                { field: 'weight_kg', label: t('weight'), unit: 'kg', step: '0.1', hint: t('totalBodyWeight') },
                { field: 'lean_mass_kg', label: t('leanMass'), unit: 'kg', step: '0.1', hint: t('fatFreeMass') },
              ].map(({ field, label, unit, step, hint }) => (
                <div key={field}>
                  <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">{label}</label>
                  <div className="relative">
                    <input type="number" value={form[field as keyof typeof form]} onChange={e => setF(field, e.target.value)}
                      step={step} min="0"
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 pr-8 text-[13px] text-white focus:outline-none focus:border-cyan-500/50" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 font-mono pointer-events-none">{unit}</span>
                  </div>
                  <p className="text-[9px] text-slate-600 mt-0.5">{hint}</p>
                </div>
              ))}
            </div>

            {showAdvanced && (
              <div className="pt-3 border-t border-slate-800/40 space-y-3">
                <p className="text-[11px] text-slate-500">{t('sportWeights')}</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { field: 'sport_weights_endurance', label: t('endurance'), hint: 'e.g. 0.7' },
                    { field: 'sport_weights_strength', label: t('strength'), hint: 'e.g. 0.2' },
                    { field: 'sport_weights_other', label: t('other'), hint: 'e.g. 0.1' },
                  ].map(({ field, label, hint }) => (
                    <div key={field}>
                      <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">{label}</label>
                      <input type="number" value={form[field as keyof typeof form]} onChange={e => setF(field, e.target.value)}
                        step="0.01" min="0" max="1"
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-cyan-500/50" />
                      <p className="text-[9px] text-slate-600 mt-0.5">{hint}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-600">{t('weightsNormalized')}</p>
              </div>
            )}
          </div>

          {computedTau && (
            <div className="bg-[#0d1420] border border-cyan-500/20 rounded-xl p-4">
              <h3 className="text-[12px] font-mono uppercase tracking-wider text-cyan-500/70 mb-3">{t('tauPreview')}</h3>
              <p className="text-[11px] text-slate-500 mb-3">{t('tauPreviewDesc')}</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: t('tauFitness'), value: `${computedTau.tauFitness}d`, desc: t('longTermAdaptationConst'), color: '#0ea5e9' },
                  { label: t('tauFatigue'), value: `${computedTau.tauFatigue}d`, desc: t('shortTermStressConst'), color: '#f97316' },
                  { label: t('kMultiplier'), value: computedTau.kMultiplier.toString(), desc: t('fatigueAmplificationFactor'), color: '#f59e0b' },
                ].map(({ label, value, desc, color }) => (
                  <div key={label} className="text-center p-3 rounded-lg bg-slate-800/30 border border-slate-700/20">
                    <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">{label}</p>
                    <p className="text-[20px] font-bold font-mono" style={{ color }}>{value}</p>
                    <p className="text-[9px] text-slate-600 mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <p className="text-[12px] text-red-400">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-[#070b12] font-semibold text-[13px] py-3 rounded-lg transition-colors">
            {saved ? (
              <><CheckCircle className="w-4 h-4" /> {t('saved')}</>
            ) : (
              <><Save className="w-4 h-4" />{loading ? t('saving') : athlete ? t('updateProfile') : t('createProfile')}</>
            )}
          </button>
        </form>
      )}

      {activeTab === 'races' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-slate-500">{raceSchedule.length} {t('racesScheduled')}</p>
            <button
              onClick={() => setShowRaceForm(!showRaceForm)}
              className="flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-[#070b12] font-semibold text-[12px] px-3 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('addRace')}
            </button>
          </div>

          {showRaceForm && (
            <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4">
              <h3 className="text-[13px] font-semibold text-white mb-4">{t('newRace')}</h3>
              <form onSubmit={handleAddRace} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1">{t('raceName')}</label>
                    <input type="text" value={raceForm.race_name} onChange={e => setRaceForm(p => ({ ...p, race_name: e.target.value }))} required placeholder="e.g. Tour de Valle 2026"
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1">{t('raceDate')}</label>
                    <input type="date" value={raceForm.race_date} onChange={e => setRaceForm(p => ({ ...p, race_date: e.target.value }))} required
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-cyan-500/50" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1">{t('raceType')}</label>
                    <input type="text" value={raceForm.race_type} onChange={e => setRaceForm(p => ({ ...p, race_type: e.target.value }))} placeholder="road, trail, crit..."
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1">{t('distanceKm')}</label>
                    <input type="number" value={raceForm.distance_km} onChange={e => setRaceForm(p => ({ ...p, distance_km: e.target.value }))} placeholder="80"
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1">{t('goalMin')}</label>
                    <input type="number" value={raceForm.goal_duration_min} onChange={e => setRaceForm(p => ({ ...p, goal_duration_min: e.target.value }))} placeholder="150"
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1">{t('priority')}</label>
                    <select value={raceForm.priority} onChange={e => setRaceForm(p => ({ ...p, priority: e.target.value as 'a' | 'b' | 'c' }))}
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-cyan-500/50">
                      <option value="a">{t('priorityAPeak')}</option>
                      <option value="b">{t('priorityBImportant')}</option>
                      <option value="c">{t('priorityCTraining')}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1">{t('notes')}</label>
                  <input type="text" value={raceForm.notes} onChange={e => setRaceForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes..."
                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50" />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-[#070b12] font-semibold text-[13px] py-2 rounded-lg transition-colors">{t('addRace')}</button>
                  <button type="button" onClick={() => setShowRaceForm(false)} className="px-4 py-2 rounded-lg border border-slate-700/50 text-slate-400 hover:text-white text-[13px] transition-colors">{t('cancel')}</button>
                </div>
              </form>
            </div>
          )}

          <div className="space-y-2">
            {raceSchedule.length === 0 && !showRaceForm && (
              <div className="text-center py-12 bg-[#0d1420] border border-slate-800/60 rounded-xl">
                <Trophy className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-slate-500 text-[13px]">{t('noRacesScheduled')}</p>
                <p className="text-slate-600 text-[12px] mt-1">{t('addTargetRaces')}</p>
              </div>
            )}
            {[...raceSchedule].sort((a, b) => a.race_date.localeCompare(b.race_date)).map(race => {
              const daysUntil = Math.ceil((new Date(race.race_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              const isPast = daysUntil < 0;
              return (
                <div key={race.id} className="bg-[#0d1420] border border-slate-800/60 rounded-xl px-4 py-3 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${PRIORITY_COLORS[race.priority]}15`, border: `1px solid ${PRIORITY_COLORS[race.priority]}30` }}>
                    <Trophy className="w-4 h-4" style={{ color: PRIORITY_COLORS[race.priority] }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-white truncate">{race.race_name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {new Date(race.race_date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                      {race.distance_km && ` · ${race.distance_km}km`}
                      {race.race_type && ` · ${race.race_type}`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded uppercase" style={{ color: PRIORITY_COLORS[race.priority], backgroundColor: `${PRIORITY_COLORS[race.priority]}15` }}>
                      {race.priority.toUpperCase()}-Race
                    </span>
                    {!isPast && (
                      <p className="text-[11px] text-slate-500 mt-0.5">{daysUntil}{t('daysAway')}</p>
                    )}
                    {isPast && (
                      <p className="text-[11px] text-slate-600 mt-0.5">{t('completed')}</p>
                    )}
                  </div>
                  {onDeleteRace && (
                    <button onClick={() => onDeleteRace(race.id)} className="text-slate-600 hover:text-red-400 transition-colors ml-2">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'blocks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-slate-500">{trainingBlocks.length} {t('trainingBlocks')}</p>
            <button
              onClick={() => setShowBlockForm(!showBlockForm)}
              className="flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-[#070b12] font-semibold text-[12px] px-3 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('addBlock')}
            </button>
          </div>

          {showBlockForm && (
            <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4">
              <h3 className="text-[13px] font-semibold text-white mb-4">{t('newTrainingBlock')}</h3>
              <form onSubmit={handleAddBlock} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1">{t('blockType')}</label>
                    <select value={blockForm.block_type} onChange={e => setBlockForm(p => ({ ...p, block_type: e.target.value as typeof BLOCK_TYPES[number] }))}
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-cyan-500/50 capitalize">
                      {BLOCK_TYPES.map(bt => <option key={bt} value={bt} className="capitalize">{bt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1">{t('startDate')}</label>
                    <input type="date" value={blockForm.start_date} onChange={e => setBlockForm(p => ({ ...p, start_date: e.target.value }))} required
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-cyan-500/50" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1">{t('endDate')}</label>
                    <input type="date" value={blockForm.end_date} onChange={e => setBlockForm(p => ({ ...p, end_date: e.target.value }))} required
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-cyan-500/50" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1">{t('targetFocus')}</label>
                  <input type="text" value={blockForm.target_focus} onChange={e => setBlockForm(p => ({ ...p, target_focus: e.target.value }))} placeholder={t('targetFocusPlaceholder')}
                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50" />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-[#070b12] font-semibold text-[13px] py-2 rounded-lg transition-colors">{t('addBlock')}</button>
                  <button type="button" onClick={() => setShowBlockForm(false)} className="px-4 py-2 rounded-lg border border-slate-700/50 text-slate-400 hover:text-white text-[13px] transition-colors">{t('cancel')}</button>
                </div>
              </form>
            </div>
          )}

          <div className="space-y-2">
            {trainingBlocks.length === 0 && !showBlockForm && (
              <div className="text-center py-12 bg-[#0d1420] border border-slate-800/60 rounded-xl">
                <Calendar className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-slate-500 text-[13px]">{t('noBlocksDefined')}</p>
                <p className="text-slate-600 text-[12px] mt-1">{t('structureSeason')}</p>
              </div>
            )}
            {[...trainingBlocks].sort((a, b) => a.start_date.localeCompare(b.start_date)).map(block => {
              const blockColors: Record<string, string> = { base: '#0ea5e9', build: '#f59e0b', peak: '#ef4444', taper: '#22c55e', recovery: '#8b5cf6' };
              const color = blockColors[block.block_type] ?? '#94a3b8';
              const days = Math.ceil((new Date(block.end_date).getTime() - new Date(block.start_date).getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={block.id} className="bg-[#0d1420] border border-slate-800/60 rounded-xl px-4 py-3 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}>
                    <Activity className="w-4 h-4" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-white capitalize">{block.block_type} {t('blockLabel')}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {new Date(block.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → {new Date(block.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {block.target_focus && ` · ${block.target_focus}`}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-500 flex-shrink-0">{days}d</span>
                  {onDeleteBlock && (
                    <button onClick={() => onDeleteBlock(block.id)} className="text-slate-600 hover:text-red-400 transition-colors ml-2">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'health' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-slate-500">{healthHistory.length} {t('healthEvents')}</p>
            <button
              onClick={() => setShowHealthForm(!showHealthForm)}
              className="flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-[#070b12] font-semibold text-[12px] px-3 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('logEvent')}
            </button>
          </div>

          {showHealthForm && (
            <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4">
              <h3 className="text-[13px] font-semibold text-white mb-4">{t('newHealthEvent')}</h3>
              <form onSubmit={handleAddHealthEvent} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1">{t('eventDate')}</label>
                    <input type="date" value={healthForm.event_date} onChange={e => setHealthForm(p => ({ ...p, event_date: e.target.value }))} required
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-cyan-500/50" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1">{t('eventType')}</label>
                    <select value={healthForm.event_type} onChange={e => setHealthForm(p => ({ ...p, event_type: e.target.value as typeof EVENT_TYPES[number] }))}
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-cyan-500/50 capitalize">
                      {EVENT_TYPES.map(et => <option key={et} value={et} className="capitalize">{et.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1">{t('recoveryDays')}</label>
                    <input type="number" value={healthForm.recovery_expected_days} onChange={e => setHealthForm(p => ({ ...p, recovery_expected_days: e.target.value }))} placeholder="7"
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1">{t('description')}</label>
                  <input type="text" value={healthForm.description} onChange={e => setHealthForm(p => ({ ...p, description: e.target.value }))} required placeholder="e.g. Left knee pain, mild respiratory infection..."
                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50" />
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="is_current" checked={healthForm.is_current} onChange={e => setHealthForm(p => ({ ...p, is_current: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-cyan-500/30" />
                  <label htmlFor="is_current" className="text-[12px] text-slate-400">{t('currentlyAffecting')}</label>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-[#070b12] font-semibold text-[13px] py-2 rounded-lg transition-colors">{t('logEvent')}</button>
                  <button type="button" onClick={() => setShowHealthForm(false)} className="px-4 py-2 rounded-lg border border-slate-700/50 text-slate-400 hover:text-white text-[13px] transition-colors">{t('cancel')}</button>
                </div>
              </form>
            </div>
          )}

          <div className="space-y-2">
            {healthHistory.length === 0 && !showHealthForm && (
              <div className="text-center py-12 bg-[#0d1420] border border-slate-800/60 rounded-xl">
                <Shield className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-slate-500 text-[13px]">{t('noHealthEvents')}</p>
                <p className="text-slate-600 text-[12px] mt-1">{t('trackHealthEvents')}</p>
              </div>
            )}
            {[...healthHistory].sort((a, b) => b.event_date.localeCompare(a.event_date)).map(event => {
              const eventColors: Record<string, string> = { injury: '#ef4444', illness: '#f59e0b', surgery: '#f97316', medication_start: '#0ea5e9', medication_end: '#22c55e', other: '#94a3b8' };
              const color = eventColors[event.event_type] ?? '#94a3b8';
              return (
                <div key={event.id} className="bg-[#0d1420] border border-slate-800/60 rounded-xl px-4 py-3 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}>
                    <Shield className="w-4 h-4" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium text-white truncate">{event.description}</p>
                      {event.is_current && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 flex-shrink-0">{t('activeStatus')}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {` · ${event.event_type.replace('_', ' ')}`}
                      {event.recovery_expected_days && ` · ~${event.recovery_expected_days}d ${t('recoveryLabel')}`}
                    </p>
                  </div>
                  {onDeleteHealthEvent && (
                    <button onClick={() => onDeleteHealthEvent(event.id)} className="text-slate-600 hover:text-red-400 transition-colors ml-2">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
