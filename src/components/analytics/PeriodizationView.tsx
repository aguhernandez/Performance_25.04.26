import { useMemo, useState } from 'react';
import type { Session, Athlete } from '../../lib/database.types';
import type { DailyBannisterResult } from '../../lib/engine/types';
import {
  analyzeBlock,
  compareBlocks,
  simulateTaper,
  compareSeasons,
} from '../../lib/engine/periodization';

interface Props {
  sessions: Session[];
  athlete: Athlete;
  fitnessHistory: DailyBannisterResult[];
}

type Tab = 'blocks' | 'taper' | 'seasons';

export function PeriodizationView({ sessions, athlete, fitnessHistory }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('blocks');

  const [blockAStart, setBlockAStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 56);
    return d.toISOString().split('T')[0];
  });
  const [blockAEnd, setBlockAEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().split('T')[0];
  });
  const [blockBStart, setBlockBStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 28);
    return d.toISOString().split('T')[0];
  });
  const [blockBEnd, setBlockBEnd] = useState(() => new Date().toISOString().split('T')[0]);

  const [eventDate, setEventDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 21);
    return d.toISOString().split('T')[0];
  });
  const [taperWeeks, setTaperWeeks] = useState(3);

  const fitnessMap = useMemo(() => fitnessHistory.map(h => ({ date: h.date, fitness: h.fitness })), [fitnessHistory]);

  const blockComparison = useMemo(() =>
    compareBlocks(sessions, blockAStart, blockAEnd, blockBStart, blockBEnd, fitnessMap),
    [sessions, blockAStart, blockAEnd, blockBStart, blockBEnd, fitnessMap]
  );

  const avgWeeklyImpulse = useMemo(() => {
    if (sessions.length === 0) return 200;
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 28);
    const recent = sessions.filter(s => new Date(s.session_date) >= cutoff);
    const total = recent.reduce((sum, s) => sum + s.impulse, 0);
    return total / 4 || 200;
  }, [sessions]);

  const taperSim = useMemo(() => {
    const current = fitnessHistory[fitnessHistory.length - 1];
    return simulateTaper(
      current?.fitness ?? 30,
      current?.fatigue ?? 20,
      athlete.tau_fitness || 42,
      athlete.tau_fatigue || 7,
      avgWeeklyImpulse,
      eventDate,
      taperWeeks
    );
  }, [fitnessHistory, avgWeeklyImpulse, athlete, eventDate, taperWeeks]);

  const seasonComparison = useMemo(() =>
    compareSeasons(sessions, fitnessMap),
    [sessions, fitnessMap]
  );

  const blockTypeColors: Record<string, string> = {
    endurance: '#2A1F4A',
    cycling: '#2A1F4A',
    running: '#8A6900',
    strength: '#8A6900',
    beach_volleyball: '#2A1F4A',
    other: '#94a3b8',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-gray-900 dark:text-white">Periodization & Planning</h2>
          <p className="font-body text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">
            Compare training blocks, simulate tapers, and analyze seasons
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {(['blocks', 'taper', 'seasons'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md font-body text-[12px] font-medium transition-all ${
                activeTab === tab ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200'
              }`}
            >
              {tab === 'blocks' ? 'Block Comparison' : tab === 'taper' ? 'Taper Simulator' : 'Season Comparison'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'blocks' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-900 border-2 border-[#2A1F4A]/20 dark:border-[#B8A9E5]/30 rounded-xl p-4">
              <h4 className="font-heading text-[13px] font-bold text-[#2A1F4A] dark:text-[#B8A9E5] mb-3">Block A</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-body text-[11px] text-gray-500 dark:text-gray-400 block mb-1">Start</label>
                  <input type="date" value={blockAStart} onChange={e => setBlockAStart(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 font-body text-[12px] focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="font-body text-[11px] text-gray-500 dark:text-gray-400 block mb-1">End</label>
                  <input type="date" value={blockAEnd} onChange={e => setBlockAEnd(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 font-body text-[12px] focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 border-2 border-[#2A1F4A]/20 dark:border-[#B8A9E5]/30 rounded-xl p-4">
              <h4 className="font-heading text-[13px] font-bold text-[#2A1F4A] dark:text-[#B8A9E5] mb-3">Block B</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-body text-[11px] text-gray-500 dark:text-gray-400 block mb-1">Start</label>
                  <input type="date" value={blockBStart} onChange={e => setBlockBStart(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 font-body text-[12px] focus:outline-none focus:ring-1 focus:ring-green-400" />
                </div>
                <div>
                  <label className="font-body text-[11px] text-gray-500 dark:text-gray-400 block mb-1">End</label>
                  <input type="date" value={blockBEnd} onChange={e => setBlockBEnd(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 font-body text-[12px] focus:outline-none focus:ring-1 focus:ring-green-400" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Avg Weekly Impulse', a: blockComparison.blockA.avgWeeklyImpulse, b: blockComparison.blockB.avgWeeklyImpulse, unit: 'IF' },
              { label: 'Total Sessions', a: blockComparison.blockA.totalSessions, b: blockComparison.blockB.totalSessions, unit: '' },
              { label: 'Peak Week', a: blockComparison.blockA.peakWeekImpulse, b: blockComparison.blockB.peakWeekImpulse, unit: 'IF' },
              { label: 'Fitness Gain', a: blockComparison.blockA.fitnessGain, b: blockComparison.blockB.fitnessGain, unit: '' },
            ].map(metric => {
              const diff = Number(metric.b) - Number(metric.a);
              const pct = Number(metric.a) > 0 ? (diff / Number(metric.a)) * 100 : 0;
              return (
                <div key={metric.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                  <p className="font-body text-[10px] text-gray-400 uppercase tracking-wide mb-2">{metric.label}</p>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-1 mb-1">
                        <div className="w-2 h-2 rounded-full bg-[#2A1F4A] dark:bg-[#B8A9E5]" />
                        <span className="font-body text-[11px] text-gray-500 dark:text-gray-400">A</span>
                        <span className="font-heading text-[14px] font-bold text-gray-800 dark:text-gray-100 ml-1">{typeof metric.a === 'number' ? metric.a.toFixed(1) : metric.a}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-[#F7C843]" />
                        <span className="font-body text-[11px] text-gray-500 dark:text-gray-400">B</span>
                        <span className="font-heading text-[14px] font-bold text-gray-800 dark:text-gray-100 ml-1">{typeof metric.b === 'number' ? metric.b.toFixed(1) : metric.b}</span>
                      </div>
                    </div>
                    <span className={`font-body text-[12px] font-medium px-1.5 py-0.5 rounded ${diff > 0 ? 'bg-[#2A1F4A]/5 dark:bg-[#B8A9E5]/10 text-[#2A1F4A] dark:text-[#B8A9E5]' : diff < 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                      {diff > 0 ? '+' : ''}{pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[blockComparison.blockA, blockComparison.blockB].map((block, idx) => (
              <div key={idx} className={`bg-white dark:bg-gray-900 border-2 rounded-xl p-5 ${idx === 0 ? 'border-[#2A1F4A]/20 dark:border-[#B8A9E5]/30' : 'border-[#2A1F4A]/20 dark:border-[#B8A9E5]/30'}`}>
                <h4 className={`font-heading text-[14px] font-bold mb-3 ${idx === 0 ? 'text-[#2A1F4A] dark:text-[#B8A9E5]' : 'text-[#2A1F4A] dark:text-[#B8A9E5]'}`}>
                  {block.label}: {block.startDate} → {block.endDate}
                </h4>
                <div className="space-y-2">
                  {Object.entries(block.byType).map(([type, data]) => {
                    const pct = block.totalImpulse > 0 ? (data.impulse / block.totalImpulse) * 100 : 0;
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-body text-[11px] text-gray-600 dark:text-gray-300 capitalize">{type.replace('_', ' ')}</span>
                          <span className="font-body text-[11px] text-gray-400">{data.sessions} sessions · {data.impulse.toFixed(0)} impulse</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: blockTypeColors[type] ?? '#94a3b8' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-2">
                  <div>
                    <p className="font-body text-[10px] text-gray-400">Fitness Start</p>
                    <p className="font-heading text-[15px] font-bold text-gray-700 dark:text-gray-200">{block.fitnessStart.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="font-body text-[10px] text-gray-400">Fitness End</p>
                    <p className="font-heading text-[15px] font-bold text-gray-700 dark:text-gray-200">{block.fitnessEnd.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'taper' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <h3 className="font-heading text-[14px] font-bold text-gray-900 dark:text-white mb-4">Taper Configuration</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="font-body text-[12px] text-gray-600 dark:text-gray-300 block mb-1.5">Target Event Date</label>
                <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 font-body text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div>
                <label className="font-body text-[12px] text-gray-600 dark:text-gray-300 block mb-1.5">Taper Duration</label>
                <div className="flex gap-2">
                  {[2, 3, 4].map(w => (
                    <button key={w} onClick={() => setTaperWeeks(w)}
                      className={`flex-1 py-2 rounded-lg font-body text-[12px] font-medium transition-all ${taperWeeks === w ? 'bg-[#F7C843] text-[#2A1F4A]' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:bg-gray-700'}`}>
                      {w}w
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-end">
                <div className="w-full p-3 bg-[#F7C843]/20 dark:bg-[#F7C843]/10 rounded-lg border border-[#F7C843]/40 dark:border-[#F7C843]/30">
                  <p className="font-body text-[10px] text-[#8A6900] dark:text-[#F7C843] uppercase tracking-wide">Expected Form at Event</p>
                  <p className="font-heading text-[22px] font-bold text-[#8A6900] dark:text-[#F7C843] mt-0.5">
                    {taperSim.expectedFormAtEvent.toFixed(1)}
                  </p>
                  <p className="font-body text-[10px] text-[#8A6900] dark:text-[#F7C843]">Peak: {taperSim.peakFormDate}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <h3 className="font-heading text-[14px] font-bold text-gray-900 dark:text-white mb-4">Week-by-Week Taper Plan</h3>
            <div className="space-y-3">
              {taperSim.weeks.map(week => (
                <div key={week.weekNumber} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <span className="font-heading text-[14px] font-bold text-gray-600 dark:text-gray-300">W{week.weekNumber}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-body text-[12px] text-gray-600 dark:text-gray-300">{week.weekStart}</span>
                      <span className="font-body text-[12px] font-medium text-gray-700 dark:text-gray-200">
                        {Math.round(week.taperMultiplier * 100)}% of normal load
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#F7C843]/20 dark:bg-[#F7C843]/10 transition-all"
                        style={{ width: `${week.taperMultiplier * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="font-body text-[9px] text-gray-400">Target Impulse</p>
                      <p className="font-heading text-[13px] font-bold text-gray-700 dark:text-gray-200">{week.targetLoad.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="font-body text-[9px] text-gray-400">Fitness</p>
                      <p className="font-heading text-[13px] font-bold text-[#2A1F4A] dark:text-[#B8A9E5]">{week.projectedFitness.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="font-body text-[9px] text-gray-400">Form</p>
                      <p className={`font-heading text-[13px] font-bold ${week.projectedForm > 0 ? 'text-[#2A1F4A] dark:text-[#B8A9E5]' : 'text-red-500'}`}>
                        {week.projectedForm > 0 ? '+' : ''}{week.projectedForm.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'seasons' && (
        <div className="space-y-4">
          {seasonComparison.seasons.length < 2 ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
              <p className="font-body text-[14px] text-gray-500 dark:text-gray-400">Need sessions from at least 2 different years for season comparison</p>
              <p className="font-body text-[12px] text-gray-400 mt-1">Keep training and come back next season!</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                {seasonComparison.seasons.map(season => (
                  <div key={season.year} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                    <h3 className="font-heading text-[18px] font-bold text-gray-900 dark:text-white mb-3">{season.year}</h3>
                    <div className="space-y-2">
                      {[
                        { label: 'Total Sessions', value: season.totalSessions },
                        { label: 'Total Impulse', value: season.totalImpulse.toFixed(0) },
                        { label: 'Avg Weekly Impulse', value: season.avgWeeklyImpulse.toFixed(1) },
                        { label: 'Peak Week', value: season.peakWeekImpulse.toFixed(0) },
                        { label: 'Peak Fitness', value: season.peakFitness.toFixed(2) },
                      ].map(row => (
                        <div key={row.label} className="flex justify-between items-center">
                          <span className="font-body text-[11px] text-gray-500 dark:text-gray-400">{row.label}</span>
                          <span className="font-heading text-[13px] font-bold text-gray-800 dark:text-gray-100">{row.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4">
                      <p className="font-body text-[10px] text-gray-400 mb-2">Monthly load distribution</p>
                      <div className="flex items-end gap-0.5 h-12">
                        {season.monthly.map(m => {
                          const maxMonthImpulse = Math.max(...season.monthly.map(x => x.impulse));
                          const h = maxMonthImpulse > 0 ? (m.impulse / maxMonthImpulse) * 100 : 0;
                          return (
                            <div key={m.month} className="flex-1 bg-[#2A1F4A] dark:bg-[#B8A9E5] rounded-sm transition-all hover:opacity-80"
                              style={{ height: `${h}%` }} title={`${m.month}: ${m.impulse.toFixed(0)} impulse`} />
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="font-body text-[9px] text-gray-300">Jan</span>
                        <span className="font-body text-[9px] text-gray-300">Dec</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {seasonComparison.seasons.length >= 2 && (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                  <h3 className="font-heading text-[14px] font-bold text-gray-900 dark:text-white mb-4">Year-over-Year Growth</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <th className="font-body text-[11px] text-gray-400 text-left pb-2">Metric</th>
                          {seasonComparison.seasons.map(s => (
                            <th key={s.year} className="font-body text-[11px] text-gray-400 text-right pb-2">{s.year}</th>
                          ))}
                          <th className="font-body text-[11px] text-gray-400 text-right pb-2">Growth</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: 'Avg Weekly Impulse', key: 'avgWeeklyImpulse' as const },
                          { label: 'Total Sessions', key: 'totalSessions' as const },
                          { label: 'Peak Fitness', key: 'peakFitness' as const },
                          { label: 'Peak Week Impulse', key: 'peakWeekImpulse' as const },
                        ].map(row => {
                          const first = seasonComparison.seasons[0][row.key] as number;
                          const last = seasonComparison.seasons[seasonComparison.seasons.length - 1][row.key] as number;
                          const growth = first > 0 ? ((last - first) / first) * 100 : 0;
                          return (
                            <tr key={row.label} className="border-b border-gray-50">
                              <td className="font-body text-[12px] text-gray-600 dark:text-gray-300 py-2">{row.label}</td>
                              {seasonComparison.seasons.map(s => (
                                <td key={s.year} className="font-body text-[12px] text-gray-700 dark:text-gray-200 text-right py-2">
                                  {typeof s[row.key] === 'number' ? (s[row.key] as number).toFixed(1) : s[row.key]}
                                </td>
                              ))}
                              <td className={`font-body text-[12px] font-medium text-right py-2 ${growth > 0 ? 'text-[#2A1F4A] dark:text-[#B8A9E5]' : growth < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                {growth > 0 ? '+' : ''}{growth.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
