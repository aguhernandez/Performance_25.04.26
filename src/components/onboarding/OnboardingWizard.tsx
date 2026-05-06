import { useState } from 'react';
import { ChevronRight, ChevronLeft, Activity, Target, Dumbbell, FlaskConical, Check } from 'lucide-react';
import type { AthleteInsert } from '../../lib/database.types';

interface OnboardingWizardProps {
  userId: string;
  onComplete: (data: Omit<AthleteInsert, 'user_id'>) => Promise<void>;
}

type Step = 'identity' | 'physiology' | 'goals' | 'confirm';

const STEPS: { id: Step; label: string; icon: React.ElementType }[] = [
  { id: 'identity', label: 'About You', icon: Activity },
  { id: 'physiology', label: 'Physiology', icon: FlaskConical },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'confirm', label: 'Confirm', icon: Check },
];

const SPORT_OPTIONS = [
  { value: 'cycling', label: 'Cycling', emoji: '🚴' },
  { value: 'running', label: 'Running', emoji: '🏃' },
  { value: 'triathlon', label: 'Triathlon', emoji: '🏊' },
  { value: 'swimming', label: 'Swimming', emoji: '🏊' },
  { value: 'beach_volleyball', label: 'Beach Volleyball', emoji: '🏐' },
  { value: 'crossfit', label: 'CrossFit', emoji: '🏋️' },
  { value: 'other', label: 'Other', emoji: '⚡' },
];

const GOAL_OPTIONS = [
  { value: 'ftp_improvement', label: 'Improve FTP / Threshold Power' },
  { value: 'endurance', label: 'Build Endurance Base' },
  { value: 'race_prep', label: 'Prepare for a Race' },
  { value: 'weight_loss', label: 'Weight Management' },
  { value: 'general_fitness', label: 'General Fitness' },
  { value: 'vo2max', label: 'Maximize VO2max' },
];

const EXPERIENCE_OPTIONS = [
  { value: 1, label: 'Beginner (< 1 year)' },
  { value: 2, label: 'Intermediate (1–3 years)' },
  { value: 5, label: 'Advanced (3–7 years)' },
  { value: 10, label: 'Elite (7+ years)' },
];

const TIMELINE_OPTIONS = [
  { value: 8, label: '8 weeks' },
  { value: 12, label: '12 weeks' },
  { value: 16, label: '16 weeks' },
  { value: 24, label: '6 months' },
  { value: 52, label: '1 year' },
];

function estimatePhysiology(sport: string, experienceYears: number, weightKg: number) {
  const base = { vo2max: 45, cp_watts: 220, ftp_watts: 210, max_hr: 185, resting_hr: 60 };
  const sportBonus: Record<string, Partial<typeof base>> = {
    cycling: { vo2max: 5, cp_watts: 30 },
    running: { vo2max: 5 },
    triathlon: { vo2max: 3 },
    swimming: { vo2max: 2 },
  };
  const expMultiplier = 1 + Math.min(experienceYears / 10, 0.4) * 0.5;
  const bonus = sportBonus[sport] ?? {};
  return {
    vo2max: Math.round(((base.vo2max + (bonus.vo2max ?? 0)) * expMultiplier) * 10) / 10,
    cp_watts: Math.round((base.cp_watts + (bonus.cp_watts ?? 0)) * expMultiplier),
    ftp_watts: Math.round((base.ftp_watts + (bonus.cp_watts ?? 0)) * expMultiplier),
    max_hr: base.max_hr,
    resting_hr: base.resting_hr,
    lean_mass_kg: Math.round(weightKg * 0.85),
    vlamax: sport === 'cycling' ? 0.35 : 0.45,
  };
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>('identity');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [sport, setSport] = useState('cycling');
  const [weightKg, setWeightKg] = useState('75');
  const [experienceYears, setExperienceYears] = useState(2);

  const [vo2max, setVo2max] = useState('');
  const [cpWatts, setCpWatts] = useState('');
  const [ftpWatts, setFtpWatts] = useState('');
  const [maxHr, setMaxHr] = useState('185');
  const [restingHr, setRestingHr] = useState('60');
  const [hasLabData, setHasLabData] = useState(false);

  const [primaryGoal, setPrimaryGoal] = useState('general_fitness');
  const [goalTimelineWeeks, setGoalTimelineWeeks] = useState(16);

  const stepIndex = STEPS.findIndex(s => s.id === step);
  const isLast = step === 'confirm';

  const estimated = estimatePhysiology(sport, experienceYears, parseFloat(weightKg) || 75);

  const getPhysioValues = () => ({
    vo2max: parseFloat(vo2max) || estimated.vo2max,
    cp_watts: parseInt(cpWatts) || estimated.cp_watts,
    ftp_watts: parseInt(ftpWatts) || estimated.ftp_watts,
    max_hr: parseInt(maxHr) || 185,
    resting_hr: parseInt(restingHr) || 60,
  });

  const handleNext = () => {
    if (step === 'identity') setStep('physiology');
    else if (step === 'physiology') setStep('goals');
    else if (step === 'goals') setStep('confirm');
  };

  const handleBack = () => {
    if (step === 'physiology') setStep('identity');
    else if (step === 'goals') setStep('physiology');
    else if (step === 'confirm') setStep('goals');
  };

  const handleComplete = async () => {
    setLoading(true);
    setError(null);
    try {
      const physio = getPhysioValues();
      const weight = parseFloat(weightKg) || 75;
      const sportWeightMap: Record<string, { endurance: number; strength: number; other: number }> = {
        cycling: { endurance: 0.85, strength: 0.10, other: 0.05 },
        running: { endurance: 0.85, strength: 0.10, other: 0.05 },
        triathlon: { endurance: 0.80, strength: 0.10, other: 0.10 },
        beach_volleyball: { endurance: 0.30, strength: 0.30, other: 0.40 },
        crossfit: { endurance: 0.20, strength: 0.60, other: 0.20 },
        swimming: { endurance: 0.80, strength: 0.15, other: 0.05 },
      };
      const sportWeights = sportWeightMap[sport] ?? { endurance: 0.6, strength: 0.3, other: 0.1 };

      await onComplete({
        name,
        sport,
        vo2max: physio.vo2max,
        vlamax: estimated.vlamax,
        lean_mass_kg: Math.round(weight * 0.85),
        weight_kg: weight,
        cp_watts: physio.cp_watts,
        ftp_watts: physio.ftp_watts,
        max_hr: physio.max_hr,
        resting_hr: physio.resting_hr,
        sport_weights: sportWeights,
        training_experience_years: experienceYears,
        primary_goal: primaryGoal,
        goal_timeline_weeks: goalTimelineWeeks,
        onboarding_completed: true,
      } as Omit<AthleteInsert, 'user_id'>);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 'identity') return name.trim().length > 0 && parseFloat(weightKg) > 0;
    return true;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Activity className="w-6 h-6" style={{ color: '#514163' }} />
            <span className="font-heading text-xl font-bold" style={{ color: '#514163' }}>ASC</span>
            <span className="font-heading text-xl font-bold" style={{ color: '#fdda36' }}>Impulse</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-gray-900 mb-1">Welcome to your performance engine</h1>
          <p className="font-body text-[13px] text-gray-500">Complete your athlete profile in 4 quick steps</p>
        </div>

        <div className="flex items-center justify-between mb-8 px-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = s.id === step;
            const done = i < stepIndex;
            return (
              <div key={s.id} className="flex flex-col items-center gap-1 flex-1">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                    done ? 'border-green-500 bg-green-50' :
                    active ? 'border-[#fdda36] bg-[#fdda36]/10' :
                    'border-gray-200 bg-white'
                  }`}
                >
                  {done ? <Check className="w-4 h-4 text-green-500" /> : <Icon className={`w-4 h-4 ${active ? 'text-[#514163]' : 'text-gray-400'}`} />}
                </div>
                <span className={`font-body text-[10px] ${active ? 'text-[#514163] font-semibold' : 'text-gray-400'}`}>{s.label}</span>
                {i < STEPS.length - 1 && (
                  <div className={`absolute w-px h-0 hidden`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          {step === 'identity' && (
            <div className="space-y-5">
              <div>
                <h2 className="font-heading text-[17px] font-bold text-gray-900 mb-1">Tell us about you</h2>
                <p className="font-body text-[12px] text-gray-500">Basic info to personalize your model</p>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-1.5">Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Athlete name"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] text-gray-900 focus:outline-none focus:border-[#fdda36] focus:ring-2 focus:ring-[#fdda36]/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-2">Primary Sport</label>
                <div className="grid grid-cols-2 gap-2">
                  {SPORT_OPTIONS.map(s => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setSport(s.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                        sport === s.value
                          ? 'border-[#fdda36] bg-[#fdda36]/10 text-[#514163] font-semibold'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-base">{s.emoji}</span>
                      <span className="font-body text-[12px]">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-1.5">Body Weight (kg)</label>
                  <input
                    type="number"
                    value={weightKg}
                    onChange={e => setWeightKg(e.target.value)}
                    min="30"
                    max="200"
                    step="0.1"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] text-gray-900 focus:outline-none focus:border-[#fdda36]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-1.5">Training Experience</label>
                  <select
                    value={experienceYears}
                    onChange={e => setExperienceYears(parseInt(e.target.value))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] text-gray-900 focus:outline-none focus:border-[#fdda36]"
                  >
                    {EXPERIENCE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 'physiology' && (
            <div className="space-y-5">
              <div>
                <h2 className="font-heading text-[17px] font-bold text-gray-900 mb-1">Physiological Parameters</h2>
                <p className="font-body text-[12px] text-gray-500">These personalize the Bannister model. We've estimated values from your profile — refine if you have lab data.</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="font-body text-[11px] text-amber-700">
                  <strong>Estimated values</strong> based on your sport and experience. You can leave these as-is and the model will refine over time as you log sessions.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasLab"
                  checked={hasLabData}
                  onChange={e => setHasLabData(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="hasLab" className="font-body text-[12px] text-gray-600 cursor-pointer">
                  I have recent lab test results (VO2max, CP, FTP)
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'VO2max (ml/kg/min)', value: vo2max, set: setVo2max, est: estimated.vo2max.toString(), step: '0.5', hint: 'Aerobic capacity' },
                  { label: 'Critical Power (W)', value: cpWatts, set: setCpWatts, est: estimated.cp_watts.toString(), step: '5', hint: 'Max sustainable power' },
                  { label: 'FTP (W)', value: ftpWatts, set: setFtpWatts, est: estimated.ftp_watts.toString(), step: '5', hint: '~95% of Critical Power' },
                  { label: 'Max HR (bpm)', value: maxHr, set: setMaxHr, est: '185', step: '1', hint: 'Max heart rate' },
                  { label: 'Resting HR (bpm)', value: restingHr, set: setRestingHr, est: '60', step: '1', hint: 'Morning resting HR' },
                ].map(({ label, value, set, est, step: s, hint }) => (
                  <div key={label}>
                    <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">{label}</label>
                    <input
                      type="number"
                      value={hasLabData ? value : ''}
                      onChange={e => set(e.target.value)}
                      placeholder={est}
                      step={s}
                      disabled={!hasLabData}
                      className={`w-full border rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-[#fdda36] ${
                        hasLabData ? 'border-gray-200 text-gray-900' : 'border-gray-100 text-gray-400 bg-gray-50 cursor-not-allowed'
                      }`}
                    />
                    <p className="text-[9px] text-gray-400 mt-0.5">{hasLabData ? hint : `Est: ${est}`}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'goals' && (
            <div className="space-y-5">
              <div>
                <h2 className="font-heading text-[17px] font-bold text-gray-900 mb-1">What are you training for?</h2>
                <p className="font-body text-[12px] text-gray-500">Your goal shapes recommendations and load targets</p>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-2">Primary Goal</label>
                <div className="space-y-2">
                  {GOAL_OPTIONS.map(g => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setPrimaryGoal(g.value)}
                      className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl border text-left transition-all ${
                        primaryGoal === g.value
                          ? 'border-[#fdda36] bg-[#fdda36]/10 text-[#514163] font-semibold'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {primaryGoal === g.value && <Check className="w-3.5 h-3.5 text-[#514163] flex-shrink-0" />}
                      <span className="font-body text-[13px]">{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-2">Timeline</label>
                <div className="grid grid-cols-3 gap-2">
                  {TIMELINE_OPTIONS.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setGoalTimelineWeeks(t.value)}
                      className={`px-3 py-2 rounded-xl border text-center transition-all ${
                        goalTimelineWeeks === t.value
                          ? 'border-[#fdda36] bg-[#fdda36]/10 text-[#514163] font-semibold'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span className="font-body text-[12px]">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-5">
              <div>
                <h2 className="font-heading text-[17px] font-bold text-gray-900 mb-1">Ready to launch</h2>
                <p className="font-body text-[12px] text-gray-500">Here's a summary of your athlete profile</p>
              </div>

              {(() => {
                const physio = getPhysioValues();
                const weight = parseFloat(weightKg) || 75;
                return (
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                      <p className="font-body text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Identity</p>
                      <div className="flex justify-between">
                        <span className="font-body text-[13px] text-gray-600">Name</span>
                        <span className="font-body text-[13px] font-semibold text-gray-900">{name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-body text-[13px] text-gray-600">Sport</span>
                        <span className="font-body text-[13px] font-semibold text-gray-900 capitalize">{sport}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-body text-[13px] text-gray-600">Weight</span>
                        <span className="font-body text-[13px] font-semibold text-gray-900">{weight} kg</span>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                      <p className="font-body text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Physiology {!hasLabData && '(Estimated)'}</p>
                      {[
                        ['VO2max', `${physio.vo2max} ml/kg/min`],
                        ['Critical Power', `${physio.cp_watts} W (${(physio.cp_watts / weight).toFixed(1)} W/kg)`],
                        ['FTP', `${physio.ftp_watts} W`],
                        ['Max HR', `${physio.max_hr} bpm`],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="font-body text-[13px] text-gray-600">{k}</span>
                          <span className="font-body text-[13px] font-semibold text-gray-900">{v}</span>
                        </div>
                      ))}
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                      <p className="font-body text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Goals</p>
                      <div className="flex justify-between">
                        <span className="font-body text-[13px] text-gray-600">Goal</span>
                        <span className="font-body text-[13px] font-semibold text-gray-900 capitalize">{primaryGoal.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-body text-[13px] text-gray-600">Timeline</span>
                        <span className="font-body text-[13px] font-semibold text-gray-900">{goalTimelineWeeks} weeks</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="font-body text-[11px] text-blue-700">
                  The model will refine these estimates as you log sessions. You can update your profile at any time in Settings.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <p className="font-body text-[12px] text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:border-gray-300 font-body text-[13px] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={isLast ? handleComplete : handleNext}
              disabled={!canProceed() || loading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-body font-semibold text-[13px] transition-all disabled:opacity-50"
              style={{ backgroundColor: '#fdda36', color: '#514163' }}
            >
              {loading ? 'Creating profile...' : isLast ? 'Launch my engine' : (
                <>
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-6">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-1.5 rounded-full transition-all ${
                i === stepIndex ? 'w-6 bg-[#514163]' : i < stepIndex ? 'w-3 bg-[#fdda36]' : 'w-3 bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
