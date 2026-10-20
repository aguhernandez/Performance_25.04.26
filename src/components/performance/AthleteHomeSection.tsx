import { useMemo, useState } from 'react';
import { Link2, Pencil } from 'lucide-react';
import type { Athlete } from '../../lib/database.types';
import { usePerformanceData } from '../analytics/performance/usePerformanceData';
import { PmcChart } from '../analytics/performance/PmcChart';
import { WeeklyImpulseChart } from '../analytics/performance/WeeklyImpulseChart';
import { PdcChart } from '../analytics/performance/PdcChart';
import { DurabilityChart } from '../analytics/performance/DurabilityChart';
import { EfficiencyChart } from '../analytics/performance/EfficiencyChart';
import { formLabel } from '../../lib/rosterAlerts';
import { weekStartISO, toISODate, addDays } from '../analytics/performance/shared';

function TodayCard({ data }: { data: ReturnType<typeof usePerformanceData> }) {
  const last = data.pmcDays[data.pmcDays.length - 1] ?? null;
  if (!last) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
        <h3 className="font-heading text-[14px] font-bold text-gray-900 dark:text-white mb-1">Today</h3>
        <p className="font-body text-[12px] text-gray-400">No model history yet — save a session to start.</p>
      </div>
    );
  }
  const fl = formLabel(last.form);

  // This week's impulse vs the previous 4 full weeks' average.
  const curWeek = weekStartISO(last.date);
  const thisWeek = data.weeklyLoad.find(w => w.week_start === curWeek);
  const prevWeeks = data.weeklyLoad.filter(w => w.week_start < curWeek).slice(-4);
  const prevAvg = prevWeeks.length > 0
    ? prevWeeks.reduce((s, w) => s + Number(w.total_impulse), 0) / prevWeeks.length
    : null;
  const thisTotal = thisWeek ? Number(thisWeek.total_impulse) : null;
  const ratio = thisTotal !== null && prevAvg !== null && prevAvg > 0 ? thisTotal / prevAvg : null;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading text-[14px] font-bold text-gray-900 dark:text-white">Today</h3>
        {fl && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ color: fl.color, backgroundColor: `${fl.color}14` }}
          >
            {fl.label}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-mono">Fitness</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white font-mono">{last.fitness.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-mono">Form</p>
          <p className="text-xl font-bold font-mono" style={{ color: fl?.color ?? '#111827' }}>
            {(last.form ?? 0) > 0 ? '+' : ''}{last.form.toFixed(0)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-mono">Ramp rate</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white font-mono">
            {last.rampRate !== null ? last.rampRate.toFixed(1) : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-mono">This week</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white font-mono">
            {thisTotal !== null ? thisTotal.toFixed(0) : '—'}
            {ratio !== null && (
              <span
                className="text-[11px] font-body font-medium ml-1"
                style={{ color: ratio > 1.3 ? '#8A6900' : '#6b7280' }}
              >
                {ratio.toFixed(2)}× prev 4w
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function ThresholdsTauEditor({ athlete, canEdit, onSave }: {
  athlete: Athlete;
  canEdit: boolean;
  onSave: (updates: Record<string, number | null>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cp, setCp] = useState('');
  const [lt2, setLt2] = useState('');
  const [tauF, setTauF] = useState('');
  const [tauK, setTauK] = useState('');

  const start = () => {
    setCp(String(athlete.cp_watts ?? athlete.ftp_watts ?? ''));
    setLt2(String(athlete.hr_lt2_bpm ?? ''));
    setTauF(String(athlete.tau_fitness ?? 42));
    setTauK(String(athlete.tau_fatigue ?? 7));
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const updates: Record<string, number | null> = {};
      if (cp.trim()) updates.cp_watts = Number(cp);
      if (lt2.trim()) updates.hr_lt2_bpm = Number(lt2);
      if (tauF.trim()) updates.tau_fitness = Number(tauF);
      if (tauK.trim()) updates.tau_fatigue = Number(tauK);
      await onSave(updates);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading text-[14px] font-bold text-gray-900 dark:text-white">Thresholds & tau</h3>
        {canEdit && !editing && (
          <button onClick={start} className="flex items-center gap-1 text-[12px] text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-gray-100">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        )}
        {!canEdit && <span className="text-[10px] text-gray-400 italic">Read-only — managed by your coach</span>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-mono">CP</p>
          <p className="text-[15px] font-bold text-gray-900 dark:text-white font-mono">{athlete.cp_watts || athlete.ftp_watts || '—'} W</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-mono">LT2 HR</p>
          <p className="text-[15px] font-bold text-gray-900 dark:text-white font-mono">{athlete.hr_lt2_bpm ?? '—'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-mono">Tau fitness</p>
          <p className="text-[15px] font-bold text-gray-900 dark:text-white font-mono">{athlete.tau_fitness ?? 42}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-mono">Tau fatigue</p>
          <p className="text-[15px] font-bold text-gray-900 dark:text-white font-mono">{athlete.tau_fatigue ?? 7}</p>
        </div>
      </div>
      {editing && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'CP (W)', value: cp, set: setCp },
              { label: 'LT2 HR', value: lt2, set: setLt2 },
              { label: 'Tau fitness', value: tauF, set: setTauF },
              { label: 'Tau fatigue', value: tauK, set: setTauK },
            ].map(f => (
              <label key={f.label} className="block">
                <span className="text-[10px] uppercase tracking-wide text-gray-400 font-mono">{f.label}</span>
                <input
                  value={f.value}
                  onChange={e => f.set(e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg"
                />
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-[#F7C843] text-[#2A1F4A] hover:bg-[#E7B92D] disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-[12px] rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AthleteHomeSection({ athlete, coachAssigned, onUpdateAthlete }: {
  athlete: Athlete;
  coachAssigned: boolean;
  onUpdateAthlete: (updates: Record<string, number | null>) => Promise<void>;
}) {
  const data = usePerformanceData(athlete);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Connect-your-data banner: no session day in the last 14 days.
  const hasRecentSessions = useMemo(() => {
    const cutoff = addDays(toISODate(new Date()), -14);
    return data.pmcDays.some(d => d.total > 0 && d.date >= cutoff);
  }, [data.pmcDays]);

  if (data.loading) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center font-body text-[13px] text-gray-400">
        Loading performance…
      </div>
    );
  }
  if (data.error) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-red-200 rounded-2xl p-6 text-center font-body text-[13px] text-red-600">
        {data.error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!hasRecentSessions && (
        <div className="flex items-center gap-3 bg-[#F7C843]/20 dark:bg-[#F7C843]/10 border border-[#F7C843]/40 dark:border-[#F7C843]/30 rounded-xl px-4 py-3">
          <Link2 className="w-4 h-4 text-[#8A6900] dark:text-[#F7C843] flex-shrink-0" />
          <p className="font-body text-[12px] text-[#8A6900] dark:text-[#F7C843]">
            No sessions in the last 14 days — connect your data source to keep the model up to date.
          </p>
        </div>
      )}

      <TodayCard data={data} />

      <ThresholdsTauEditor athlete={athlete} canEdit={!coachAssigned} onSave={onUpdateAthlete} />

      {!advancedOpen ? (
        <button
          onClick={() => setAdvancedOpen(true)}
          className="w-full py-2.5 text-[12px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-gray-100 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:bg-gray-800 transition-colors"
        >
          Show advanced — power curve, durability, efficiency, W′bal, Foster
        </button>
      ) : (
        <>
          <button
            onClick={() => setAdvancedOpen(false)}
            className="text-[12px] font-semibold text-gray-400 hover:text-gray-600 dark:text-gray-300"
          >
            Hide advanced
          </button>
          <PmcChart days={data.pmcDays} pmcStart={data.pmcStart} historyIncomplete={data.historyIncomplete} />
          <WeeklyImpulseChart
            weekly={data.weekly}
            weeklyLoad={data.weeklyLoad}
            currentWeekStart={data.currentWeekStart}
            quality={data.pmcDays.length > 0 ? data.pmcDays[data.pmcDays.length - 1].quality : 'estimated'}
          />
          <PdcChart
            windows={data.pdcWindows}
            cpModel={data.cpModel}
            hasStreams={data.pdcWindows.some(w => w.points.length > 0)}
          />
          <DurabilityChart windows={data.durability} />
          <EfficiencyChart
            rows={data.efficiency}
            efMovingAvg={data.efMovingAvg}
            decouplingMovingAvg={data.decouplingMovingAvg}
          />
        </>
      )}
    </div>
  );
}
