import { useMemo, useState } from 'react';
import type { Session, Athlete, LabTest } from '../../lib/database.types';
import type { DailyBannisterResult } from '../../lib/engine/types';
import { extractMMP, fitPDCModel } from '../../lib/engine/powerDurationCurve';
import { computePopulationBenchmarks, computeGoalProgress } from '../../lib/engine/benchmarks';

interface Props {
  sessions: Session[];
  athlete: Athlete;
  labTests: LabTest[];
  fitnessHistory: DailyBannisterResult[];
}

interface GoalInput {
  label: string;
  metric: string;
  targetValue: number;
  currentValue: number;
  unit: string;
}

const TIER_COLORS: Record<string, string> = {
  elite: '#7c3aed',
  competitive: '#2563eb',
  trained: '#16a34a',
  recreational: '#d97706',
  beginner: '#94a3b8',
};

export function BenchmarksGoalsView({ sessions, athlete, labTests, fitnessHistory }: Props) {
  const [activeTab, setActiveTab] = useState<'benchmarks' | 'goals'>('benchmarks');
  const [goalInputs, setGoalInputs] = useState<GoalInput[]>([
    { label: 'Critical Power', metric: 'cp', targetValue: 300, currentValue: athlete.cp_watts || 0, unit: 'W' },
    { label: 'CP per kg', metric: 'cpPerKg', targetValue: 4.0, currentValue: athlete.cp_watts && athlete.weight_kg ? athlete.cp_watts / athlete.weight_kg : 0, unit: 'W/kg' },
    { label: 'VO2max', metric: 'vo2max', targetValue: 60, currentValue: athlete.vo2max || 0, unit: 'ml/kg/min' },
  ]);

  const pdcModel = useMemo(() => {
    const mmpProfile = extractMMP(sessions);
    return fitPDCModel(mmpProfile.points.map(p => ({ duration: p.duration, power: p.power })), athlete.cp_watts);
  }, [sessions, athlete.cp_watts]);

  const benchmarks = useMemo(() =>
    computePopulationBenchmarks(athlete, pdcModel),
    [athlete, pdcModel]
  );

  const cpHistory = useMemo(() => {
    return labTests
      .filter(t => t.cp_watts)
      .map(t => ({ date: t.test_date, value: t.cp_watts! }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [labTests]);

  const fitnessHistoryMapped = useMemo(() =>
    fitnessHistory.map(h => ({ date: h.date, value: h.fitness })),
    [fitnessHistory]
  );

  const goals = useMemo(() =>
    goalInputs.map(g => {
      const history = g.metric === 'cp' ? cpHistory :
                     g.metric === 'fitness' ? fitnessHistoryMapped : [];
      return computeGoalProgress(g.label, g.metric, g.currentValue, g.targetValue, g.unit, history);
    }),
    [goalInputs, cpHistory, fitnessHistoryMapped]
  );

  const updateGoal = (index: number, field: keyof GoalInput, value: string | number) => {
    setGoalInputs(prev => prev.map((g, i) => i === index ? { ...g, [field]: value } : g));
  };

  const addGoal = () => {
    setGoalInputs(prev => [...prev, {
      label: 'New Goal',
      metric: 'fitness',
      targetValue: 50,
      currentValue: fitnessHistory[fitnessHistory.length - 1]?.fitness ?? 0,
      unit: '',
    }]);
  };

  const removeGoal = (index: number) => {
    setGoalInputs(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-gray-900">Benchmarks & Goals</h2>
          <p className="font-body text-[13px] text-gray-500 mt-0.5">
            Compare performance to population standards and track your targets
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['benchmarks', 'goals'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md font-body text-[12px] font-medium transition-all ${
                activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'benchmarks' ? 'Population Benchmarks' : 'My Goals'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'benchmarks' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="font-body text-[12px] text-gray-500 uppercase tracking-wide mb-1">Overall Percentile</p>
                <div className="flex items-baseline gap-3">
                  <span className="font-heading text-[42px] font-bold text-gray-900">{benchmarks.overallPercentile}</span>
                  <span className="font-body text-[16px] text-gray-500">th percentile</span>
                </div>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
                  style={{ backgroundColor: TIER_COLORS[benchmarks.tier] + '15' }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TIER_COLORS[benchmarks.tier] }} />
                  <span className="font-heading text-[15px] font-bold capitalize" style={{ color: TIER_COLORS[benchmarks.tier] }}>
                    {benchmarks.tier}
                  </span>
                </div>
                <p className="font-body text-[11px] text-gray-400 mt-1 capitalize">{benchmarks.sport} athlete</p>
              </div>
            </div>

            <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden mb-1">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${benchmarks.overallPercentile}%`,
                  background: `linear-gradient(to right, #94a3b8, ${TIER_COLORS[benchmarks.tier]})`,
                }}
              />
            </div>
            <div className="flex justify-between">
              <span className="font-body text-[10px] text-gray-400">Beginner</span>
              <span className="font-body text-[10px] text-gray-400">Recreational</span>
              <span className="font-body text-[10px] text-gray-400">Trained</span>
              <span className="font-body text-[10px] text-gray-400">Competitive</span>
              <span className="font-body text-[10px] text-gray-400">Elite</span>
            </div>
          </div>

          <div className="space-y-3">
            {benchmarks.metrics.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                <p className="font-body text-[14px] text-gray-500">Complete your athlete profile to see benchmark comparisons</p>
                <p className="font-body text-[12px] text-gray-400 mt-1">Add VO2max, CP, FTP, and weight data</p>
              </div>
            ) : (
              benchmarks.metrics.map(metric => (
                <div key={metric.metric} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-body text-[11px] text-gray-400 uppercase tracking-wide">{metric.category}</p>
                      <p className="font-heading text-[16px] font-bold text-gray-900 mt-0.5">{metric.metric}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-heading text-[24px] font-bold text-gray-900">{metric.value} <span className="font-body text-[14px] text-gray-400">{metric.unit}</span></p>
                      <p className="font-body text-[12px] font-medium" style={{ color: metric.percentile >= 70 ? '#16a34a' : metric.percentile >= 50 ? '#d97706' : '#6b7280' }}>
                        {metric.label}
                      </p>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${metric.percentile}%`,
                          background: metric.percentile >= 85 ? '#7c3aed' : metric.percentile >= 70 ? '#2563eb' : metric.percentile >= 50 ? '#16a34a' : metric.percentile >= 30 ? '#d97706' : '#94a3b8',
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="font-body text-[9px] text-gray-300">5th</span>
                      <span className="font-body text-[9px] text-gray-300">25th</span>
                      <span className="font-body text-[9px] text-gray-300">50th</span>
                      <span className="font-body text-[9px] text-gray-300">75th</span>
                      <span className="font-body text-[9px] text-gray-300">95th</span>
                    </div>
                  </div>
                  <div className="mt-2 text-right">
                    <span className="font-body text-[11px] text-gray-500">{metric.percentile}th percentile</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'goals' && (
        <div className="space-y-4">
          {goals.map((goal, i) => (
            <div key={goal.id + i} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 grid grid-cols-4 gap-3 mr-4">
                  <div>
                    <label className="font-body text-[11px] text-gray-500 block mb-1">Label</label>
                    <input
                      value={goalInputs[i]?.label ?? ''}
                      onChange={e => updateGoal(i, 'label', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 font-body text-[12px] focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="font-body text-[11px] text-gray-500 block mb-1">Current</label>
                    <input
                      type="number"
                      value={goalInputs[i]?.currentValue ?? ''}
                      onChange={e => updateGoal(i, 'currentValue', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 font-body text-[12px] focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="font-body text-[11px] text-gray-500 block mb-1">Target</label>
                    <input
                      type="number"
                      value={goalInputs[i]?.targetValue ?? ''}
                      onChange={e => updateGoal(i, 'targetValue', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 font-body text-[12px] focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="font-body text-[11px] text-gray-500 block mb-1">Unit</label>
                    <input
                      value={goalInputs[i]?.unit ?? ''}
                      onChange={e => updateGoal(i, 'unit', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 font-body text-[12px] focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                </div>
                <button onClick={() => removeGoal(i)} className="text-gray-300 hover:text-red-400 transition-colors mt-5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-body text-[11px] text-gray-500">Progress</span>
                  <span className="font-body text-[11px] font-medium text-gray-700">{goal.progressPct.toFixed(1)}%</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, goal.progressPct)}%`,
                      backgroundColor: goal.progressPct >= 90 ? '#16a34a' : goal.progressPct >= 60 ? '#d97706' : '#2563eb',
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-body text-[11px] text-gray-400">
                    {goal.currentValue} {goal.unit} → {goal.targetValue} {goal.unit}
                  </span>
                  <div className="flex items-center gap-3">
                    {goal.estimatedWeeksToTarget !== null && (
                      <span className="font-body text-[11px] text-gray-500">
                        ~{goal.estimatedWeeksToTarget} weeks to target
                      </span>
                    )}
                    {goal.estimatedWeeksToTarget !== null && (
                      <span className={`font-body text-[10px] px-2 py-0.5 rounded-full ${goal.onTrack ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                        {goal.onTrack ? 'On track' : 'Needs attention'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={addGoal}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl font-body text-[13px] text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all"
          >
            + Add Goal
          </button>
        </div>
      )}
    </div>
  );
}
