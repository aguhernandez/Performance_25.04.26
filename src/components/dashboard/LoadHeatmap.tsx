import { useMemo } from 'react';
import type { Session } from '../../lib/database.types';

interface LoadHeatmapProps {
  sessions: Session[];
  weekCount?: number;
}

const TYPE_COLORS: Record<string, string> = {
  endurance: '#0ea5e9',
  strength: '#f97316',
  beach_volleyball: '#22c55e',
  running: '#f59e0b',
  cycling: '#a78bfa',
  other: '#64748b',
};

function getImpulseColor(impulse: number, maxImpulse: number): string {
  if (impulse === 0) return 'transparent';
  const intensity = Math.min(impulse / maxImpulse, 1);
  if (intensity < 0.2) return '#0ea5e9' + '30';
  if (intensity < 0.4) return '#0ea5e9' + '55';
  if (intensity < 0.6) return '#0ea5e9' + '80';
  if (intensity < 0.8) return '#0ea5e9' + 'aa';
  return '#0ea5e9';
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function LoadHeatmap({ sessions, weekCount = 16 }: LoadHeatmapProps) {
  const { grid, maxImpulse, weekLabels, weeklyTotals } = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() - mondayOffset + 6);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - weekCount * 7 + 1);

    const impulseByDate = new Map<string, { impulse: number; type: string }>();
    for (const s of sessions) {
      const key = s.session_date;
      const existing = impulseByDate.get(key);
      if (!existing || s.impulse > existing.impulse) {
        impulseByDate.set(key, { impulse: s.impulse, type: s.session_type });
      }
    }

    const weeks: { date: string; impulse: number; type: string; isToday: boolean }[][] = [];
    const weeklyTotals: { label: string; total: number }[] = [];
    let maxImpulse = 0;

    const current = new Date(startDate);
    for (let w = 0; w < weekCount; w++) {
      const week: { date: string; impulse: number; type: string; isToday: boolean }[] = [];
      let weekTotal = 0;
      const weekStart = new Date(current);

      for (let d = 0; d < 7; d++) {
        const dateStr = current.toISOString().split('T')[0];
        const data = impulseByDate.get(dateStr);
        const impulse = data?.impulse ?? 0;
        maxImpulse = Math.max(maxImpulse, impulse);
        weekTotal += impulse;
        week.push({
          date: dateStr,
          impulse,
          type: data?.type ?? '',
          isToday: dateStr === today.toISOString().split('T')[0],
        });
        current.setDate(current.getDate() + 1);
      }

      weeks.push(week);
      weeklyTotals.push({
        label: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        total: Math.round(weekTotal * 1000) / 1000,
      });
    }

    return { grid: weeks, maxImpulse, weekLabels: weeklyTotals.map(w => w.label), weeklyTotals };
  }, [sessions, weekCount]);

  return (
    <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[13px] font-semibold text-white">Load Heatmap</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Daily impulse intensity over {weekCount} weeks</p>
        </div>
        <div className="flex items-center gap-3">
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-[9px] text-slate-500 capitalize">{type.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-1">
        <div className="flex flex-col justify-around pt-0 pb-0 mr-1">
          {DAYS.map((d, i) => (
            <span key={i} className="text-[9px] text-slate-600 font-mono h-5 flex items-center">{d}</span>
          ))}
        </div>

        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-1" style={{ minWidth: `${weekCount * 28}px` }}>
            {grid.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day, di) => {
                  const isEmpty = day.impulse === 0;
                  const color = TYPE_COLORS[day.type] ?? '#0ea5e9';
                  const intensity = maxImpulse > 0 ? day.impulse / maxImpulse : 0;
                  const opacity = isEmpty ? 0 : Math.max(0.1, intensity);

                  return (
                    <div
                      key={di}
                      className="w-5 h-5 rounded-sm cursor-pointer transition-all hover:scale-110 relative group"
                      style={{
                        backgroundColor: isEmpty ? '#1e293b' : color,
                        opacity: isEmpty ? 0.2 : opacity + 0.2,
                        border: day.isToday ? '1px solid #0ea5e9' : '1px solid transparent',
                      }}
                      title={`${day.date}: ${day.impulse.toFixed(3)} au${day.type ? ` (${day.type})` : ''}`}
                    >
                      {day.impulse > 0 && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#0a0f1c] border border-slate-700/60 rounded px-2 py-1 text-[9px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none shadow-xl">
                          <p className="font-mono">{day.date}</p>
                          <p className="text-cyan-400">{day.impulse.toFixed(3)} au</p>
                          <p className="text-slate-400 capitalize">{day.type?.replace('_', ' ')}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/40">
        <p className="text-[10px] text-slate-500 font-mono uppercase mb-2">Weekly Impulse Totals</p>
        <div className="flex gap-1 overflow-x-auto">
          {weeklyTotals.map((w, i) => {
            const maxWeekly = Math.max(...weeklyTotals.map(t => t.total));
            const barH = maxWeekly > 0 ? (w.total / maxWeekly) * 32 : 0;
            return (
              <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0 group cursor-pointer">
                <span className="text-[8px] text-slate-600 font-mono opacity-0 group-hover:opacity-100 transition-opacity">{w.total}</span>
                <div className="w-full flex flex-col-reverse" style={{ height: 32 }}>
                  <div
                    className="w-full rounded-sm bg-cyan-500/30 border border-cyan-500/20 transition-all"
                    style={{ height: `${barH}px` }}
                  />
                </div>
                <span className="text-[7px] text-slate-600 font-mono truncate w-full text-center">{w.label.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
