import { useMemo, useState } from 'react';
import type { WeeklyRow } from './usePerformanceData';
import type { WeeklyLoadRow } from '../../../lib/engine/cpPersistence';
import { ChartCard, QualityBadge, LegendDot, RangeSelector, SPORT_COLORS, EmptyState, svgTooltip, fmtDay, weekStartISO } from './shared';

const W = 980;
const H = 300;
const PAD = { top: 16, right: 52, bottom: 34, left: 46 };

const MONOTONY_REF = 2.0;
const STRAIN_COLOR = '#b45309';
const MONOTONY_COLOR = '#0f766e';

type Mode = 'impulse' | 'foster';

export function WeeklyImpulseChart({ weekly, weeklyLoad, currentWeekStart, quality }: {
  weekly: WeeklyRow[];
  weeklyLoad: WeeklyLoadRow[];
  currentWeekStart: string | null;
  quality: 'measured' | 'modelled' | 'estimated';
}) {
  const [mode, setMode] = useState<Mode>('impulse');
  const [hover, setHover] = useState<{ weekStart: string } | null>(null);

  const fosterByWeek = useMemo(() => {
    const m = new Map<string, WeeklyLoadRow>();
    for (const r of weeklyLoad) m.set(r.week_start, r);
    return m;
  }, [weeklyLoad]);

  const weeks = useMemo(
    () =>
      weekly.map(w => {
        const f = fosterByWeek.get(w.weekStart) ?? null;
        return {
          weekStart: w.weekStart,
          bySport: w.bySport,
          total: w.total,
          rampRate: w.rampRate,
          strain: f ? Number(f.strain) : null,
          monotony: f ? (f.monotony !== null ? Number(f.monotony) : null) : null,
          totalImpulseStored: f ? Number(f.total_impulse) : null,
          partial: currentWeekStart !== null && w.weekStart === currentWeekStart,
        };
      }),
    [weekly, fosterByWeek, currentWeekStart]
  );

  const maxTotal = useMemo(() => Math.max(10, ...weeks.map(w => w.total)) * 1.1, [weeks]);
  const maxRamp = useMemo(() => {
    const vals = weeks.map(w => Math.abs(w.rampRate ?? 0)).filter(v => v > 0);
    return vals.length > 0 ? Math.max(...vals) * 1.2 : 1;
  }, [weeks]);
  const maxStrain = useMemo(() => {
    const vals = weeks.map(w => w.strain ?? 0).filter(v => v > 0);
    return vals.length > 0 ? Math.max(...vals) * 1.1 : 100;
  }, [weeks]);
  const maxMonotony = useMemo(() => {
    const vals = weeks.map(w => w.monotony ?? 0).filter(v => v > 0);
    return Math.max(3, ...vals) * 1.15;
  }, [weeks]);

  const sports = useMemo(() => {
    const set = new Set<string>();
    for (const w of weeks) for (const s of w.bySport) set.add(s.sport);
    return Array.from(set);
  }, [weeks]);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const yLoad = (v: number) => PAD.top + plotH - (v / maxTotal) * plotH;
  const yRamp = (v: number) => PAD.top + plotH / 2 - (v / maxRamp) * (plotH / 2);
  const yStrain = (v: number) => PAD.top + plotH - (v / maxStrain) * plotH;
  const yMon = (v: number) => PAD.top + plotH - (v / maxMonotony) * plotH;

  const rampPath = useMemo(() => {
    let started = false;
    let path = '';
    weeks.forEach((w, i) => {
      if (w.rampRate === null) return;
      const x = PAD.left + (i + 0.5) * (plotW / weeks.length);
      path += `${started ? 'L' : 'M'} ${x} ${yRamp(w.rampRate)} `;
      started = true;
    });
    return path.trim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks, maxRamp]);

  const monotonyPath = useMemo(() => {
    let started = false;
    let path = '';
    weeks.forEach((w, i) => {
      if (w.monotony === null) return;
      const x = PAD.left + (i + 0.5) * (plotW / weeks.length);
      path += `${started ? 'L' : 'M'} ${x} ${yMon(w.monotony)} `;
      started = true;
    });
    return path.trim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks, maxMonotony]);

  const foster = mode === 'foster';
  const xTickEvery = Math.max(1, Math.ceil(weeks.length / 10));

  return (
    <ChartCard
      title={foster ? 'Monotony & Strain (Foster)' : 'Weekly Impulse by Sport'}
      subtitle={
        foster
          ? 'Weekly strain (bars) and monotony (line, dashed reference at 2.0)'
          : 'Stacked weekly load with 7-day fitness ramp rate'
      }
      controls={
        <div className="flex items-center gap-3">
          <QualityBadge quality={quality} />
          <RangeSelector
            options={[
              { key: 'impulse', label: 'Impulse' },
              { key: 'foster', label: 'Monotony & Strain' },
            ]}
            value={mode}
            onChange={k => setMode(k as Mode)}
          />
        </div>
      }
    >
      {weeks.length === 0 ? (
        <EmptyState title="No training data yet" desc="Weekly impulse appears once sessions are saved." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 mb-2">
            {foster ? (
              <>
                <LegendDot color={STRAIN_COLOR} label="Strain" />
                <LegendDot color={MONOTONY_COLOR} label="Monotony" />
              </>
            ) : (
              <>
                {sports.map(s => <LegendDot key={s} color={SPORT_COLORS[s] ?? '#94a3b8'} label={s.replace('_', ' ')} />)}
                <LegendDot color="#0ea5e9" label="Ramp rate" />
              </>
            )}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} onMouseLeave={() => setHover(null)}>
            {foster
              ? [0, maxStrain * 0.5, maxStrain].map((v, i) => (
                  <g key={i}>
                    <line x1={PAD.left} y1={yStrain(v)} x2={W - PAD.right} y2={yStrain(v)} stroke="#f1f5f9" strokeWidth="1" />
                    <text x={PAD.left - 6} y={yStrain(v) + 4} textAnchor="end" fontSize="10" fill={STRAIN_COLOR} fontFamily="system-ui">{Math.round(v)}</text>
                  </g>
                ))
              : [0, maxTotal * 0.5, maxTotal].map((v, i) => (
                  <g key={i}>
                    <line x1={PAD.left} y1={yLoad(v)} x2={W - PAD.right} y2={yLoad(v)} stroke="#f1f5f9" strokeWidth="1" />
                    <text x={PAD.left - 6} y={yLoad(v) + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="system-ui">{Math.round(v)}</text>
                  </g>
                ))}

            {weeks.map((w, i) => {
              const slot = plotW / weeks.length;
              const barW = Math.max(4, Math.min(26, slot - 3));
              const x = PAD.left + i * slot + (slot - barW) / 2;
              let yCursor = foster ? yStrain(0) : yLoad(0);
              const isHover = hover?.weekStart === w.weekStart;
              return (
                <g key={w.weekStart} onMouseEnter={() => setHover({ weekStart: w.weekStart })}>
                  {foster ? (
                    w.strain !== null && (
                      <rect
                        x={x}
                        y={yStrain(w.strain)}
                        width={barW}
                        height={Math.max(0, yStrain(0) - yStrain(w.strain))}
                        fill={STRAIN_COLOR}
                        fillOpacity="0.85"
                        rx="1"
                      />
                    )
                  ) : (
                    w.bySport.map(seg => {
                      const h = (seg.impulse / maxTotal) * plotH;
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
                    })
                  )}
                  {w.partial && (
                    <text x={x + barW / 2} y={PAD.top + 2} textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="system-ui" fontStyle="italic">
                      partial
                    </text>
                  )}
                  <rect x={x - 2} y={PAD.top} width={barW + 4} height={plotH} fill="transparent" />
                </g>
              );
            })}

            {/* lines */}
            {!foster && <path d={rampPath} fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinejoin="round" />}
            {foster && (
              <>
                <line
                  x1={PAD.left}
                  y1={yMon(MONOTONY_REF)}
                  x2={W - PAD.right}
                  y2={yMon(MONOTONY_REF)}
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeDasharray="5 4"
                />
                <text x={W - PAD.right - 4} y={yMon(MONOTONY_REF) - 5} textAnchor="end" fontSize="9" fill="#94a3b8" fontFamily="system-ui">2.0</text>
                <path d={monotonyPath} fill="none" stroke={MONOTONY_COLOR} strokeWidth="2" strokeLinejoin="round" />
              </>
            )}

            {/* x labels */}
            {weeks.map((w, i) =>
              i % xTickEvery === 0 ? (
                <text key={w.weekStart} x={PAD.left + (i + 0.5) * (plotW / weeks.length)} y={H - PAD.bottom + 16} textAnchor="middle" fontSize="10" fill="#94a3b8" fontFamily="system-ui">
                  {fmtDay(w.weekStart)}
                </text>
              ) : null
            )}

            {hover && (() => {
              const w = weeks.find(v => v.weekStart === hover.weekStart);
              if (!w) return null;
              const i = weeks.findIndex(v => v.weekStart === hover.weekStart);
              const x = PAD.left + (i + 0.5) * (plotW / weeks.length);
              const lines = foster
                ? [
                    { text: `Week of ${fmtDay(w.weekStart)}${w.partial ? ' (partial)' : ''}`, bold: true },
                    { text: `Total impulse: ${w.totalImpulseStored !== null ? w.totalImpulseStored.toFixed(1) : w.total.toFixed(1)}`, color: '#1e293b' },
                    { text: `Daily mean: ${(w.totalImpulseStored !== null ? w.totalImpulseStored / 7 : w.total / 7).toFixed(2)}`, color: '#64748b' },
                    { text: `Monotony: ${w.monotony !== null ? w.monotony.toFixed(2) : '—'}`, color: MONOTONY_COLOR },
                    { text: `Strain: ${w.strain !== null ? w.strain.toFixed(1) : '—'}`, color: STRAIN_COLOR },
                  ]
                : [
                    { text: `Week of ${fmtDay(w.weekStart)}${w.partial ? ' (partial)' : ''}`, bold: true },
                    { text: `Total: ${w.total.toFixed(1)}`, color: '#1e293b' },
                    ...w.bySport.map(seg => ({ text: `${seg.sport.replace('_', ' ')}: ${seg.impulse.toFixed(1)}`, color: SPORT_COLORS[seg.sport] ?? '#94a3b8' })),
                    { text: `Ramp rate: ${w.rampRate !== null ? w.rampRate.toFixed(1) : '—'}`, color: '#0ea5e9' },
                  ];
              return (
                <g>
                  {svgTooltip(x, PAD.top + plotH / 2, lines, 170, W)}
                </g>
              );
            })()}
          </svg>
        </>
      )}
    </ChartCard>
  );
}
