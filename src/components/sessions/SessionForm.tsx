import { useState } from 'react';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { SessionInsert, StrengthExercise, SessionType, TrainingIntention, ZoneDistribution } from '../../lib/database.types';
import { sessionToImpulseInput } from '../../lib/engine/impulseCalculator';
import { calculateBeachVolleyballImpulse } from '../../lib/engine/beachVolleyCalculator';
import type { Athlete } from '../../lib/database.types';
import { useLanguage } from '../../contexts/LanguageContext';

interface SessionFormProps {
  athleteId: string;
  athlete: Athlete;
  onSubmit: (session: SessionInsert) => Promise<void>;
  onCancel: () => void;
}

interface ExerciseRow {
  name: string;
  sets: number;
  reps: number;
  load_kg: number;
  bar_velocity_ms: string;
  rir: number;
}

interface BeachVolleyRow {
  jumpCount: string;
  jumpHeightCm: string;
  sprintCount: string;
  avgSprintDistanceM: string;
  rallyDurationMin: string;
  accelerationCount: string;
}

const defaultExercise: ExerciseRow = {
  name: '',
  sets: 3,
  reps: 8,
  load_kg: 60,
  bar_velocity_ms: '',
  rir: 2,
};

const defaultBeachVolley: BeachVolleyRow = {
  jumpCount: '60',
  jumpHeightCm: '',
  sprintCount: '20',
  avgSprintDistanceM: '',
  rallyDurationMin: '',
  accelerationCount: '',
};

const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: 'endurance', label: 'Endurance' },
  { value: 'strength', label: 'Strength' },
  { value: 'beach_volleyball', label: 'Beach Volleyball' },
  { value: 'running', label: 'Running' },
  { value: 'cycling', label: 'Cycling' },
  { value: 'other', label: 'Other' },
];

export function SessionForm({ athleteId, athlete, onSubmit, onCancel }: SessionFormProps) {
  const { t } = useLanguage();
  const [type, setType] = useState<SessionType>('endurance');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState('');
  const [durationMin, setDurationMin] = useState('60');
  const [avgPower, setAvgPower] = useState('');
  const [normalizedPower, setNormalizedPower] = useState('');
  const [avgHr, setAvgHr] = useState('');
  const [rpe, setRpe] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [elevationM, setElevationM] = useState('');
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<ExerciseRow[]>([{ ...defaultExercise }]);
  const [beachVolley, setBeachVolley] = useState<BeachVolleyRow>({ ...defaultBeachVolley });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [trainingIntention, setTrainingIntention] = useState<TrainingIntention | ''>('');
  const [temperatureC, setTemperatureC] = useState('');
  const [humidityPct, setHumidityPct] = useState('');
  const [altitudeMEnv, setAltitudeMEnv] = useState('');
  const [perceivedDifficulty, setPerceivedDifficulty] = useState('');
  const [howFelt, setHowFelt] = useState('');
  const [zoneZ1, setZoneZ1] = useState('');
  const [zoneZ2, setZoneZ2] = useState('');
  const [zoneZ3, setZoneZ3] = useState('');
  const [zoneZ4, setZoneZ4] = useState('');
  const [zoneZ5, setZoneZ5] = useState('');

  const addExercise = () => setExercises(prev => [...prev, { ...defaultExercise }]);
  const removeExercise = (i: number) => setExercises(prev => prev.filter((_, idx) => idx !== i));
  const updateExercise = (i: number, field: keyof ExerciseRow, value: string | number) => {
    setExercises(prev => prev.map((ex, idx) => idx === i ? { ...ex, [field]: value } : ex));
  };
  const setBv = (field: keyof BeachVolleyRow, value: string) =>
    setBeachVolley(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const strengthExercises: StrengthExercise[] = type === 'strength'
        ? exercises.map(ex => ({
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            load_kg: ex.load_kg,
            bar_velocity_ms: ex.bar_velocity_ms ? parseFloat(ex.bar_velocity_ms) : undefined,
            rir: ex.rir,
          }))
        : [];

      const bvRaw = type === 'beach_volleyball' ? {
        jumpCount: parseFloat(beachVolley.jumpCount) || 60,
        jumpHeightCm: beachVolley.jumpHeightCm ? parseFloat(beachVolley.jumpHeightCm) : undefined,
        sprintCount: parseFloat(beachVolley.sprintCount) || 20,
        avgSprintDistanceM: beachVolley.avgSprintDistanceM ? parseFloat(beachVolley.avgSprintDistanceM) : undefined,
        rallyDurationMin: beachVolley.rallyDurationMin ? parseFloat(beachVolley.rallyDurationMin) : (parseFloat(durationMin) * 0.5),
        accelerationCount: beachVolley.accelerationCount ? parseFloat(beachVolley.accelerationCount) : undefined,
      } : undefined;

      const hasZoneData = zoneZ1 || zoneZ2 || zoneZ3 || zoneZ4 || zoneZ5;
      const zoneDistribution: ZoneDistribution | undefined = hasZoneData ? {
        z1_min: parseFloat(zoneZ1) || 0,
        z2_min: parseFloat(zoneZ2) || 0,
        z3_min: parseFloat(zoneZ3) || 0,
        z4_min: parseFloat(zoneZ4) || 0,
        z5_min: parseFloat(zoneZ5) || 0,
      } : undefined;

      const draftSession: SessionInsert = {
        athlete_id: athleteId,
        session_date: date,
        session_type: type,
        title: title || SESSION_TYPES.find(t => t.value === type)!.label + ' Session',
        notes,
        duration_min: parseFloat(durationMin) || 0,
        avg_power_watts: avgPower ? parseInt(avgPower) : undefined,
        normalized_power_watts: normalizedPower ? parseInt(normalizedPower) : undefined,
        avg_hr: avgHr ? parseInt(avgHr) : undefined,
        rpe: rpe ? parseInt(rpe) : undefined,
        distance_km: distanceKm ? parseFloat(distanceKm) : undefined,
        elevation_m: elevationM ? parseInt(elevationM) : undefined,
        strength_exercises: type === 'strength' ? strengthExercises : undefined,
        impulse: 0,
        raw_data: bvRaw ? { beachVolleyball: bvRaw } : undefined,
        training_intention: trainingIntention || undefined,
        temperature_c: temperatureC ? parseFloat(temperatureC) : undefined,
        humidity_pct: humidityPct ? parseInt(humidityPct) : undefined,
        altitude_m_env: altitudeMEnv ? parseInt(altitudeMEnv) : undefined,
        perceived_difficulty: perceivedDifficulty ? parseInt(perceivedDifficulty) : undefined,
        how_felt: howFelt || undefined,
        zone_distribution: zoneDistribution,
      };

      let impulse = 0;
      if (type === 'beach_volleyball' && bvRaw) {
        const result = calculateBeachVolleyballImpulse(
          { ...bvRaw, avgHr: avgHr ? parseInt(avgHr) : undefined, rpe: rpe ? parseInt(rpe) : undefined },
          {
            maxHr: athlete.max_hr,
            restingHr: athlete.resting_hr,
            jumpHeightCmBaseline: 35,
          }
        );
        impulse = result.total;
      } else {
        impulse = sessionToImpulseInput(
          { ...draftSession, id: '', impulse: 0, raw_data: null, max_hr: null, sub_sport: null, sport_specific_data: null, created_at: '' } as never,
          athlete
        );
      }

      await onSubmit({ ...draftSession, impulse });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save session');
    } finally {
      setLoading(false);
    }
  };

  const isEnduranceLike = type === 'endurance' || type === 'running' || type === 'cycling';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">{t('date')}</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
          />
        </div>
        <div>
          <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">{t('type')}</label>
          <div className="relative">
            <select
              value={type}
              onChange={e => setType(e.target.value as SessionType)}
              className="w-full appearance-none bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-cyan-500/50 pr-8"
            >
              {SESSION_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">{t('title')}</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={t('titlePlaceholder')}
          className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">{t('durationMin')}</label>
          <input
            type="number"
            value={durationMin}
            onChange={e => setDurationMin(e.target.value)}
            min="0"
            required
            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <div>
          <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">{t('rpe')}</label>
          <input
            type="number"
            value={rpe}
            onChange={e => setRpe(e.target.value)}
            min="1"
            max="10"
            placeholder="6"
            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
      </div>

      {isEnduranceLike && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Avg Power (W)</label>
            <input
              type="number"
              value={avgPower}
              onChange={e => setAvgPower(e.target.value)}
              placeholder={athlete.cp_watts.toString()}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">NP (W)</label>
            <input
              type="number"
              value={normalizedPower}
              onChange={e => setNormalizedPower(e.target.value)}
              placeholder="NP"
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Avg HR (bpm)</label>
            <input
              type="number"
              value={avgHr}
              onChange={e => setAvgHr(e.target.value)}
              placeholder="150"
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Distance (km)</label>
            <input
              type="number"
              value={distanceKm}
              onChange={e => setDistanceKm(e.target.value)}
              placeholder="50"
              step="0.1"
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Elevation (m)</label>
            <input
              type="number"
              value={elevationM}
              onChange={e => setElevationM(e.target.value)}
              placeholder="500"
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>
      )}

      {type === 'beach_volleyball' && (
        <div className="space-y-2">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">{t('beachVolleyball')}</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { field: 'jumpCount' as const, label: 'Jump Count / Saltos', placeholder: '60' },
              { field: 'jumpHeightCm' as const, label: 'Jump Height (cm)', placeholder: '50' },
              { field: 'sprintCount' as const, label: 'Sprint Count / Sprints', placeholder: '20' },
              { field: 'avgSprintDistanceM' as const, label: 'Avg Sprint (m)', placeholder: '8' },
              { field: 'rallyDurationMin' as const, label: 'Rally Duration (min)', placeholder: `${(parseFloat(durationMin) * 0.5).toFixed(0)}` },
              { field: 'accelerationCount' as const, label: 'Accelerations', placeholder: '40' },
            ].map(({ field, label, placeholder }) => (
              <div key={field}>
                <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1.5">{label}</label>
                <input
                  type="number"
                  value={beachVolley[field]}
                  onChange={e => setBv(field, e.target.value)}
                  placeholder={placeholder}
                  min="0"
                  step="1"
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[12px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1.5">Avg HR (bpm)</label>
            <input
              type="number"
              value={avgHr}
              onChange={e => setAvgHr(e.target.value)}
              placeholder="160"
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[12px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>
      )}

      {type === 'strength' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-mono uppercase tracking-wider text-slate-500">{t('exercises')}</label>
            <button
              type="button"
              onClick={addExercise}
              className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <Plus className="w-3 h-3" /> {t('addExercise')}
            </button>
          </div>
          {exercises.map((ex, i) => (
            <div key={i} className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={ex.name}
                  onChange={e => updateExercise(i, 'name', e.target.value)}
                  placeholder={t('exerciseName')}
                  className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded px-2.5 py-1.5 text-[12px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                />
                {exercises.length > 1 && (
                  <button type="button" onClick={() => removeExercise(i)} className="text-slate-600 hover:text-red-400 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { field: 'sets' as const, label: t('sets'), placeholder: '3' },
                  { field: 'reps' as const, label: t('reps'), placeholder: '8' },
                  { field: 'load_kg' as const, label: t('loadKg'), placeholder: '60' },
                  { field: 'rir' as const, label: t('rir'), placeholder: '2' },
                ].map(({ field, label, placeholder }) => (
                  <div key={field}>
                    <label className="block text-[9px] text-slate-600 font-mono uppercase mb-1">{label}</label>
                    <input
                      type="number"
                      value={ex[field]}
                      onChange={e => updateExercise(i, field, parseFloat(e.target.value) || 0)}
                      placeholder={placeholder}
                      min="0"
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1.5 text-[12px] text-white focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-[9px] text-slate-600 font-mono uppercase mb-1">{t('velMs')}</label>
                  <input
                    type="number"
                    value={ex.bar_velocity_ms}
                    onChange={e => updateExercise(i, 'bar_velocity_ms', e.target.value)}
                    placeholder="0.5"
                    step="0.01"
                    min="0"
                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1.5 text-[12px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-300 transition-colors"
        >
          {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {showAdvanced ? t('hide') : t('show')} {t('advancedFields')}
        </button>
      </div>

      {showAdvanced && (
        <div className="space-y-3 bg-slate-800/20 border border-slate-700/30 rounded-lg p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{t('trainingIntent')}</p>
          <div className="grid grid-cols-3 gap-2">
            {(['aerobic', 'threshold', 'vo2max', 'power', 'recovery', 'other'] as TrainingIntention[]).map(intent => (
              <button
                key={intent}
                type="button"
                onClick={() => setTrainingIntention(trainingIntention === intent ? '' : intent)}
                className={`px-2 py-1.5 rounded-lg border text-[11px] capitalize transition-colors ${
                  trainingIntention === intent
                    ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400'
                    : 'border-slate-700/40 text-slate-500 hover:text-slate-400'
                }`}
              >
                {intent}
              </button>
            ))}
          </div>

          {isEnduranceLike && (
            <>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 pt-1">{t('zoneDistribution')}</p>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { z: 'Z1', value: zoneZ1, set: setZoneZ1, color: '#22c55e' },
                  { z: 'Z2', value: zoneZ2, set: setZoneZ2, color: '#86efac' },
                  { z: 'Z3', value: zoneZ3, set: setZoneZ3, color: '#f59e0b' },
                  { z: 'Z4', value: zoneZ4, set: setZoneZ4, color: '#f97316' },
                  { z: 'Z5', value: zoneZ5, set: setZoneZ5, color: '#ef4444' },
                ].map(({ z, value, set, color }) => (
                  <div key={z}>
                    <label className="block text-[9px] font-mono uppercase mb-1" style={{ color }}>{z}</label>
                    <input type="number" value={value} onChange={e => set(e.target.value)} placeholder="0" min="0"
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1.5 text-[12px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50" />
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 pt-1">{t('environment')}</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: t('tempC'), value: temperatureC, set: setTemperatureC, placeholder: '22' },
              { label: t('humidity'), value: humidityPct, set: setHumidityPct, placeholder: '60' },
              { label: t('altitude'), value: altitudeMEnv, set: setAltitudeMEnv, placeholder: '0' },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label}>
                <label className="block text-[9px] font-mono uppercase text-slate-500 mb-1">{label}</label>
                <input type="number" value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1.5 text-[12px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50" />
              </div>
            ))}
          </div>

          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 pt-1">{t('subjectiveFeedback')}</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] font-mono uppercase text-slate-500 mb-1">{t('difficulty')}</label>
              <input type="number" value={perceivedDifficulty} onChange={e => setPerceivedDifficulty(e.target.value)} min="1" max="10" placeholder="7"
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1.5 text-[12px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50" />
            </div>
            <div>
              <label className="block text-[9px] font-mono uppercase text-slate-500 mb-1">{t('howYouFelt')}</label>
              <select value={howFelt} onChange={e => setHowFelt(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1.5 text-[12px] text-white focus:outline-none focus:border-cyan-500/50">
                <option value="">Select...</option>
                {[t('fresh'), t('good'), t('moderate'), t('tired'), t('exhausted')].map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">{t('notes')}</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none"
          placeholder={t('sessionNotes')}
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <p className="text-[12px] text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-[#070b12] font-semibold text-[13px] py-2.5 rounded-lg transition-colors"
        >
          {loading ? t('saving') : t('saveSession')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-lg border border-slate-700/50 text-slate-400 hover:text-white text-[13px] transition-colors"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}
