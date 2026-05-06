import { useMemo, useState } from 'react';
import type { Session } from '../../lib/database.types';
import type { SportBreakdown } from '../../lib/engine/types';

interface SportTrendsPanelProps {
  sessions: Session[];
  sportBreakdown: SportBreakdown;
}

const SPORT_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  endurance: { label: 'Endurance', color: '#0ea5e9', icon: 'EN' },
  cycling: { label: 'Cycling', color: '#a78bfa', icon: 'CY' },
  running: { label: 'Running', color: '#f59e0b', icon: 'RN' },
  beach_volleyball: { label: 'Beach Volleyball', color: '#22c55e', icon: 'BV' },
  strength: { label: 'Strength', color: '#f97316', icon: 'ST' },
  other: { label: 'Other', color: '#64748b', icon: 'OT' },
};

export function SportTrendsPanel({ sessions, sportBreakdown }: SportTrendsPanelProps) {
  const [view, setView] = useState<'distribution' | 'trend'>('distribution');

  const { distribution, weeklyTrend } = useMemo(() => {
    const totalImpulse = sessions.reduce((s, ss) => s + ss.impulse, 0);

    const distribution = Object.entries(SPORT_CONFIG).map(([type, cfg]) => {
      const typeSessions = sessions.filter(s => s.session_type === type);
      const typeImpulse = typeSessions.reduce((s, ss) => s + ss.impulse, 0);
      return {
        type,
        label: cfg.label,
        color: cfg.color,
        sessions: typeSessions.length,
        impulse: typeImpulse,
        pct: totalImpulse > 0 ? (typeImpulse / totalImpulse) * 100 : 0,
      };
    }).filter(d => d.sessions > 0);

    const weeks: Record<string, Record<string, number>> = {};
    const sortedSessions = [...sessions].sort((a, b) => a.session_date.localeCompare(b.session_date));

    for (const s of sortedSessions) {
      const d = new Date(s.session_date);
      const dayOfWeek = d.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(d);
      monday.setDate(d.getDate() - mondayOffset);
      const weekKey = monday.toISOString().split('T')[0];
      if (!weeks[weekKey]) weeks[weekKey] = {};
      weeks[weekKey][s.session_type] = (weeks[weekKey][s.session_type] ?? 0) + s.impulse;
    }

    const weeklyTrend = Object.entries(weeks)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8)
      .map(([weekStart, byType]) => ({
        weekStart,
        label: new Date(weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        byType,
        total: Object.values(byType).reduce((a, b) => a + b, 0),
      }));

    return { distribution, weeklyTrend };
  }, [sessions]);

  const maxWeeklyTotal = Math.max(...weeklyTrend.map(w => w.total), 0.001);

  return (
    <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-semibold text-white">Sport Breakdown</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Impulse distribution across training modalities</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-800/40 rounded-lg p-0.5">
          {(['distribution', 'trend'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2 py-1 rounded-md text-[10px] font-mono capitalize transition-all ${
                view === v ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === 'distribution' && (
        <>
          <div className="flex rounded-lg overflow-hidden h-3">
            {distribution.map(d => (
              <div
                key={d.type}
                style={{ width: `${d.pct}%`, backgroundColor: d.color }}
                className="transition-all"
                title={`${d.label}: ${d.pct.toFixed(1)}%`}
              />
            ))}
          </div>

          <div className="space-y-2">
            {distribution.sort((a, b) => b.impulse - a.impulse).map(d => (
              <div key={d.type} className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                  style={{ backgroundColor: `${d.color}20`, color: d.color }}
                >
                  {SPORT_CONFIG[d.type]?.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[11px] text-slate-300">{d.label}</span>
                    <span className="text-[11px] font-mono text-slate-400">{d.sessions} sessions</span>
                  </div>
                  <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${d.pct}%`, backgroundColor: d.color }}
                    />
                  </div>
                </div>
                <div className="text-right flex-shrink-0 w-16">
                  <p className="text-[12px] font-bold font-mono" style={{ color: d.color }}>{d.impulse.toFixed(2)}</p>
                  <p className="text-[9px] text-slate-500">{d.pct.toFixed(1)}%</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-5 gap-2 pt-2 border-t border-slate-800/40">
            {[
              { label: 'Endurance', data: sportBreakdown.endurance, color: '#0ea5e9' },
              { label: 'Cycling', data: sportBreakdown.cycling, color: '#a78bfa' },
              { label: 'Running', data: sportBreakdown.running, color: '#f59e0b' },
              { label: 'Beach VB', data: sportBreakdown.beachVolley, color: '#22c55e' },
              { label: 'Strength', data: sportBreakdown.strength, color: '#f97316' },
            ].map(({ label, data, color }) => (
              <div key={label} className="text-center">
                <p className="text-[9px] text-slate-500 font-mono uppercase mb-0.5">{label}</p>
                <p className="text-[13px] font-bold font-mono" style={{ color }}>{data.sessions}</p>
                <p className="text-[9px] text-slate-600">sessions</p>
              </div>
            ))}
          </div>
        </>
      )}

      {view === 'trend' && weeklyTrend.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-slate-500 font-mono uppercase">Weekly impulse by sport (8 weeks)</p>
          <div className="space-y-1">
            {weeklyTrend.map((week, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[9px] text-slate-600 font-mono w-14 flex-shrink-0">{week.label}</span>
                <div className="flex-1 flex h-5 rounded overflow-hidden gap-px">
                  {Object.entries(week.byType).map(([type, impulse]) => {
                    const cfg = SPORT_CONFIG[type];
                    const pct = week.total > 0 ? (impulse / week.total) * 100 : 0;
                    const barWidth = (week.total / maxWeeklyTotal) * 100;
                    return (
                      <div
                        key={type}
                        style={{
                          width: `${(pct / 100) * barWidth}%`,
                          backgroundColor: cfg?.color ?? '#64748b',
                          minWidth: impulse > 0 ? '2px' : 0,
                        }}
                        title={`${cfg?.label ?? type}: ${impulse.toFixed(3)}`}
                        className="opacity-70 hover:opacity-100 transition-opacity"
                      />
                    );
                  })}
                </div>
                <span className="text-[10px] font-mono text-slate-400 w-10 text-right">{week.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap pt-1">
            {Object.entries(SPORT_CONFIG).map(([type, cfg]) => (
              <div key={type} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: cfg.color }} />
                <span className="text-[9px] text-slate-500">{cfg.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {weeklyTrend.length === 0 && (
        <p className="text-slate-600 text-[12px]">Add sessions to see weekly trends</p>
      )}
    </div>
  );
}
