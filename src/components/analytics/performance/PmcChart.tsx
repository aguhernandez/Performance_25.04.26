import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { PmcDay } from './usePerformanceData';
import { ChartCard, QualityBadge, RangeSelector, LegendDot, SPORT_COLORS, svgTooltip, fmtDay, addDays } from './shared';

const RANGES = [
  { key: '6w', label: '6w', days: 42 },
  { key: '3m', label: '3m', days: 91 },
  { key: '6m', label: '6m', days: 182 },
  { key: '1y', label: '1y', days: 365 },
];

const W = 980;
const H = 320;
const PAD = { top: 16, right: 52, bottom: 28, left: 46 };

export function PmcChart({ days, pmcStart, historyIncomplete }: {
  days: PmcDay[];
  pmcStart: string | null;
  historyIncomplete: boolean;
}) {
  const [range, setRange] = useState('3m');
  const [hover, setHover] = useState<PmcDay | null>(null);

  const rangeDays = RANGES.find(r => r.key === range)?.days ?? 91;
  const today = useMemo(() => days.length > 0 ? days[days.length - 1].date : null, [days]);

  const visible = useMemo(() => {
    if (!today) return [];
    const cutoff = addDays(today, -(rangeDays - 1));
    return days.filter(d => d.date >= cutoff);
  }, [days, today, rangeDays]);

  const sports = useMemo(() => {
    const set = new Set<string>();
    for (const d of visible) for (const s of d.bySport) set.add(s.sport);
    return Array.from(set);
  }, [visible]);

  const maxImpulse = useMemo(
    () => Math.max(10, ...visible.map(d => d.total)) * 1.1,
    [visible]
  );
  const maxState = useMemo(
    () => Math.max(10, ...visible.map(d => Math.max(d.fitness ?? 0, d.fatigue ?? 0))) * 1.1,
    [visible]
  );

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const xOf = (i: number, n: number) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yLoad = (v: number) => PAD.top + plotH - (v / maxImpulse) * plotH;
  const yState = (v: number) => PAD.top + plotH - (v / maxState) * plotH;

  const warmUpCutoffIdx = pmcStart
    ? visible.findIndex(d => !d.isWarmUp)
    : -1;

  const linePath = (key: 'fitness' | 'fatigue' | 'form') => {
    let started = false;
    let path = '';
    visible.forEach((d, i) => {
      const v = d[key];
      if (v === null) return;
      path += `${started ? 'L' : 'M'} ${xOf(i, visible.length)} ${yState(v)} `;
      started = true;
    });
    return path.trim();
  };

  const formArea = () => {
    let up = '';
    let down = '';
    let startedUp = false;
    let startedDown = false;
    let lastUpIdx = -1;
    let lastDownIdx = -1;
    let firstUpIdx = -1;
    let firstDownIdx = -1;
    visible.forEach((d, i) => {
      if (d.form === null) return;
      const x = xOf(i, visible.length);
      if (d.form >= 0) {
        up += `${startedUp ? 'L' : 'M'} ${x} ${yState(d.form)} `;
        if (firstUpIdx === -1) firstUpIdx = i;
        lastUpIdx = i;
        startedUp = true;
      } else {
        down += `${startedDown ? 'L' : 'M'} ${x} ${yState(d.form)} `;
        if (firstDownIdx === -1) firstDownIdx = i;
        lastDownIdx = i;
        startedDown = true;
      }
    });
    if (up) up += `L ${xOf(lastUpIdx, visible.length)} ${yState(0)} L ${xOf(firstUpIdx, visible.length)} ${yState(0)} Z`;
    if (down) down += `L ${xOf(lastDownIdx, visible.length)} ${yState(0)} L ${xOf(firstDownIdx, visible.length)} ${yState(0)} Z`;
    return { up, down };
  };
  const areas = formArea();

  const xTickEvery = Math.max(1, Math.ceil(visible.length / 8));

  return (
    <ChartCard
      title="Performance Manager (PMC)"
      subtitle="Daily impulse stacked by sport · Fitness / Fatigue / Form from the Bannister model"
      controls={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <QualityBadge quality="measured" />
            <QualityBadge quality="modelled" />
            <QualityBadge quality="estimated" />
          </div>
          <RangeSelector options={RANGES} value={range} onChange={setRange} />
        </div>
      }
    >
      {historyIncomplete && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-[#F7C843]/20 dark:bg-[#F7C843]/10 border border-[#F7C843]/40 dark:border-[#F7C843]/30">
          <AlertTriangle className="w-4 h-4 text-[#8A6900] dark:text-[#F7C843] flex-shrink-0" />
          <p className="font-body text-[11px] text-[#8A6900] dark:text-[#F7C843]">
            History is under 120 days — Fitness, Fatigue and Form are still warming up and should be read as directional, not absolute.
          </p>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="font-body text-[13px] text-gray-400 text-center py-10">No daily_state history yet — save a session to start the model.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 mb-2">
            {sports.map(s => <LegendDot key={s} color={SPORT_COLORS[s] ?? '#94a3b8'} label={s.replace('_', ' ')} />)}
            <LegendDot color="#2A1F4A" label="Fitness" />
            <LegendDot color="#8A6900" label="Fatigue" />
            <LegendDot color="#2A1F4A" label="Form" />
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} onMouseLeave={() => setHover(null)}>
            {/* warm-up shading */}
            {warmUpCutoffIdx > 0 && (
              <rect
                x={PAD.left}
                y={PAD.top}
                width={xOf(warmUpCutoffIdx - 1, visible.length) - PAD.left}
                height={plotH}
                fill="var(--chart-label)"
                fillOpacity="0.08"
              />
            )}
            {warmUpCutoffIdx > 0 && (
              <text x={xOf(Math.min(warmUpCutoffIdx - 1, 2), visible.length)} y={PAD.top + 14} fontSize="10" fill="var(--chart-label)" fontFamily="system-ui">warm-up</text>
            )}

            {/* impulse y-grid */}
            {[0, maxImpulse * 0.5, maxImpulse].map((v, i) => (
              <g key={i}>
                <line x1={PAD.left} y1={yLoad(v)} x2={W - PAD.right} y2={yLoad(v)} stroke="var(--chart-grid)" strokeWidth="1" />
                <text x={PAD.left - 6} y={yLoad(v) + 4} textAnchor="end" fontSize="10" fill="var(--chart-label)" fontFamily="system-ui">{Math.round(v)}</text>
              </g>
            ))}

            {/* stacked impulse bars */}
            {visible.map((d, i) => {
              const barW = Math.max(2, Math.min(18, plotW / visible.length - 2));
              const x = xOf(i, visible.length) - barW / 2;
              let yCursor = yLoad(0);
              return (
                <g key={d.date} onMouseEnter={() => setHover(d)}>
                  {d.bySport.map(seg => {
                    const h = (seg.impulse / maxImpulse) * plotH;
                    const y = yCursor - h;
                    yCursor = y;
                    return (
                      <rect
                        key={seg.sport}
                        x={x}
                        y={y}
                        width={barW}
                        height={Math.max(0, h)}
                        fill={SPORT_COLORS[seg.sport] ?? '#94a3b8'}
                        fillOpacity="0.85"
                        rx="1"
                      />
                    );
                  })}
                  <rect x={x - 2} y={PAD.top} width={barW + 4} height={plotH} fill="transparent" />
                </g>
              );
            })}

            {/* form shaded areas */}
            {areas.down && <path d={areas.down} fill="#ef4444" fillOpacity="0.12" stroke="none" />}
            {areas.up && <path d={areas.up} fill="#2A1F4A" fillOpacity="0.12" stroke="none" />}

            {/* state lines */}
            <path d={linePath('fitness')} fill="none" stroke="#2A1F4A" strokeWidth="2" strokeLinejoin="round" />
            <path d={linePath('fatigue')} fill="none" stroke="#8A6900" strokeWidth="2" strokeLinejoin="round" />
            <path d={linePath('form')} fill="none" stroke="#2A1F4A" strokeWidth="2" strokeLinejoin="round" />

            {/* x labels */}
            {visible.map((d, i) =>
              i % xTickEvery === 0 ? (
                <text key={d.date} x={xOf(i, visible.length)} y={H - PAD.bottom + 16} textAnchor="middle" fontSize="10" fill="var(--chart-label)" fontFamily="system-ui">
                  {fmtDay(d.date)}
                </text>
              ) : null
            )}

            {/* hover marker + tooltip */}
            {hover && (() => {
              const idx = visible.findIndex(d => d.date === hover.date);
              const x = xOf(idx, visible.length);
              const lines = [
                { text: fmtDay(hover.date), bold: true },
                { text: 'Fitness ' + (hover.fitness ?? 0).toFixed(1), color: '#2A1F4A' },
                { text: 'Fatigue ' + (hover.fatigue ?? 0).toFixed(1), color: '#8A6900' },
                { text: 'Form ' + (hover.form ?? 0).toFixed(1), color: '#2A1F4A' },
                { text: 'Ramp rate ' + (hover.rampRate !== null ? hover.rampRate.toFixed(1) : '—'), color: '#64748b' },
              ];
              return (
                <g>
                  <line x1={x} y1={PAD.top} x2={x} y2={PAD.top + plotH} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
                  {svgTooltip(x, PAD.top + plotH / 2, [
                    ...lines,
                    ...hover.bySport.map(seg => ({ text: `${seg.sport.replace('_', ' ')}: ${seg.impulse.toFixed(1)}`, color: SPORT_COLORS[seg.sport] ?? '#94a3b8' })),
                  ], 150, W)}
                </g>
              );
            })()}
          </svg>
        </>
      )}
    </ChartCard>
  );
}
