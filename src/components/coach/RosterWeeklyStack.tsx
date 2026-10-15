import { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface WeeklyStackRow {
  week_start: string;
  athlete_id: string;
  total_impulse: number;
}

const W = 900;
const H = 220;
const PAD = { top: 14, right: 16, bottom: 26, left: 40 };

/** Stacked weekly impulse per athlete for the last 8 weeks — one query on weekly_load. */
export function RosterWeeklyStack({ athleteIds, athleteNames }: {
  athleteIds: string[];
  athleteNames: Record<string, string>;
}) {
  const [rows, setRows] = useState<WeeklyStackRow[]>([]);
  const idsKey = [...athleteIds].sort().join(',');

  useEffect(() => {
    if (athleteIds.length === 0) {
      setRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 63);
      const { data, error } = await supabase
        .from('weekly_load')
        .select('week_start, athlete_id, total_impulse')
        .in('athlete_id', athleteIds)
        .gte('week_start', since.toISOString().split('T')[0])
        .order('week_start', { ascending: true });
      if (cancelled || error) return;
      setRows((data ?? []) as WeeklyStackRow[]);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const weeks = useMemo(
    () => Array.from(new Set(rows.map(r => r.week_start))).sort().slice(-8),
    [rows]
  );
  const athletes = useMemo(
    () => Array.from(new Set(rows.map(r => r.athlete_id))),
    [rows]
  );
  const byWeekAthlete = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(`${r.week_start}|${r.athlete_id}`, Number(r.total_impulse));
    return m;
  }, [rows]);

  if (rows.length === 0 || weeks.length === 0) return null;

  const maxTotal =
    Math.max(
      10,
      ...weeks.map(wk => athletes.reduce((s, a) => s + (byWeekAthlete.get(`${wk}|${a}`) ?? 0), 0))
    ) * 1.1;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-gray-400" />
        <h3 className="font-heading text-[14px] font-bold text-gray-900">Weekly impulse — last 8 weeks</h3>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        {[0, maxTotal / 2, maxTotal].map((v, i) => {
          const y = PAD.top + plotH - (v / maxTotal) * plotH;
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#f1f5f9" />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{Math.round(v)}</text>
            </g>
          );
        })}
        {weeks.map((wk, wi) => {
          const slot = plotW / weeks.length;
          const barW = Math.min(30, Math.max(6, slot - 6));
          const x = PAD.left + wi * slot + (slot - barW) / 2;
          let yCursor = PAD.top + plotH;
          return (
            <g key={wk}>
              {athletes.map((a, ai) => {
                const v = byWeekAthlete.get(`${wk}|${a}`) ?? 0;
                if (v <= 0) return null;
                const h = (v / maxTotal) * plotH;
                const y = yCursor - h;
                yCursor = y;
                const hue = (ai * 137) % 360;
                return (
                  <rect key={a} x={x} y={y} width={barW} height={Math.max(0, h)} fill={`hsl(${hue} 55% 55%)`} fillOpacity="0.85" rx="1">
                    <title>{`${athleteNames[a] ?? a.slice(0, 8)} — ${v.toFixed(0)} — week of ${wk}`}</title>
                  </rect>
                );
              })}
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="9" fill="#94a3b8">
                {new Date(wk + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
