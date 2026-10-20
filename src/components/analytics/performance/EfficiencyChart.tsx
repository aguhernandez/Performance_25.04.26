import { useMemo, useState } from 'react';
import type { EffRow } from './usePerformanceData';
import { ChartCard, QualityBadge, LegendDot, EmptyState, svgTooltip, fmtDay, weekStartISO } from './shared';

const W = 980;
const H = 300;
const PAD = { top: 16, right: 52, bottom: 34, left: 46 };

const EF_COLOR = '#2A1F4A';
const DEC_COLOR = '#8A6900';
const EF_MA_COLOR = '#78658C';
const DEC_MA_COLOR = '#F7C843';

const VI_EXCLUDE_THRESHOLD = 1.10;

export function EfficiencyChart({ rows, efMovingAvg, decouplingMovingAvg }: {
  rows: EffRow[];
  efMovingAvg: { weekStart: string; value: number }[];
  decouplingMovingAvg: { weekStart: string; value: number }[];
}) {
  const [hover, setHover] = useState<EffRow | null>(null);

  const points = useMemo(
    () => rows.filter(r => r.ef !== null || r.decoupling !== null),
    [rows]
  );

  const efVals = points.map(r => r.ef).filter((v): v is number => v !== null);
  const decVals = points.map(r => r.decoupling).filter((v): v is number => v !== null);

  const efMin = efVals.length > 0 ? Math.min(...efVals) - 0.2 : 0;
  const efMax = efVals.length > 0 ? Math.max(...efVals) + 0.2 : 1;
  const decMin = Math.min(0, decVals.length > 0 ? Math.min(...decVals) : 0) - 2;
  const decMax = Math.max(10, decVals.length > 0 ? Math.max(...decVals) : 10) + 2;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const xOf = (i: number) => PAD.left + (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const yEf = (v: number) => PAD.top + plotH - ((v - efMin) / (efMax - efMin)) * plotH;
  const yDec = (v: number) => PAD.top + plotH - ((v - decMin) / (decMax - decMin)) * plotH;

  const seriesPath = (key: 'ef' | 'decoupling', yF: (v: number) => number) => {
    let started = false;
    let path = '';
    points.forEach((r, i) => {
      const v = r[key];
      if (v === null) return;
      path += `${started ? 'L' : 'M'} ${xOf(i)} ${yF(v)} `;
      started = true;
    });
    return path.trim();
  };

  const maPath = (rows: { weekStart: string; value: number }[], yF: (v: number) => number, include: (r: EffRow) => boolean) => {
    if (rows.length === 0) return '';
    // Anchor each weekly value at the x of that week's last ride so the
    // moving average aligns with the underlying per-ride points.
    const xForWeek = (wk: string) => {
      let lastIdx = -1;
      points.forEach((r, i) => {
        if (include(r) && weekStartISO(r.date) === wk) lastIdx = i;
      });
      if (lastIdx >= 0) return xOf(lastIdx);
      const firstAfter = points.findIndex(r => r.date > wk);
      return xOf(firstAfter === -1 ? points.length - 1 : firstAfter);
    };
    return rows.map((r, i) => `${i === 0 ? 'M' : 'L'} ${xForWeek(r.weekStart)} ${yF(r.value)} `).join(' ').trim();
  };

  const efTickStep = (efMax - efMin) > 1.5 ? 0.5 : 0.25;
  const efTicks: number[] = [];
  for (let v = Math.ceil(efMin / efTickStep) * efTickStep; v <= efMax; v += efTickStep) efTicks.push(Math.round(v * 100) / 100);

  const decTicks: number[] = [];
  for (let v = Math.floor(decMin / 5) * 5; v <= decMax; v += 5) decTicks.push(v);

  const xTickEvery = Math.max(1, Math.ceil(points.length / 8));

  return (
    <ChartCard
      title="Aerobic Efficiency"
      subtitle="EF (watts / HR) and decoupling % per steady ride (≥ 60 min) with 4-week moving averages"
      controls={<QualityBadge quality="measured" />}
    >
      {points.length === 0 ? (
        <EmptyState title="Requires power stream data" desc="EF and decoupling are computed from real power and heart-rate streams of steady rides of 60 minutes or longer." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 mb-2">
            <LegendDot color={EF_COLOR} label="EF" />
            <LegendDot color={EF_MA_COLOR} label="EF 4-week avg" />
            <LegendDot color={DEC_COLOR} label="Decoupling %" />
            <LegendDot color={DEC_MA_COLOR} label="Decoupling 4-week avg" />
            <span className="text-[10px] text-gray-400 italic">VI &gt; 1.10: variable ride, excluded from decoupling</span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} onMouseLeave={() => setHover(null)}>
            {efTicks.map(v => (
              <g key={`ef-${v}`}>
                <line x1={PAD.left} y1={yEf(v)} x2={W - PAD.right} y2={yEf(v)} stroke="var(--chart-grid)" strokeWidth="1" />
                <text x={PAD.left - 6} y={yEf(v) + 4} textAnchor="end" fontSize="10" fill={EF_COLOR} fontFamily="system-ui">{v.toFixed(1)}</text>
              </g>
            ))}
            {decTicks.map(v => (
              <g key={`dec-${v}`}>
                <text x={W - PAD.right + 6} y={yDec(v) + 4} fontSize="10" fill={DEC_COLOR} fontFamily="system-ui">{v}%</text>
              </g>
            ))}

            {/* raw EF line */}
            <path d={seriesPath('ef', yEf)} fill="none" stroke={EF_COLOR} strokeWidth="1.5" strokeLinejoin="round" />
            {/* raw decoupling line */}
            <path d={seriesPath('decoupling', yDec)} fill="none" stroke={DEC_COLOR} strokeWidth="1.5" strokeDasharray="4 2" strokeLinejoin="round" />

            {/* 4-week moving averages (VI > 1.10 rides excluded from decoupling MA) */}
            <path d={maPath(efMovingAvg, yEf, () => true)} fill="none" stroke={EF_MA_COLOR} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
            <path d={maPath(decouplingMovingAvg, yDec, r => !(r.vi !== null && r.vi > VI_EXCLUDE_THRESHOLD))} fill="none" stroke={DEC_MA_COLOR} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />

            {/* points — VI > 1.10 faded */}
            {points.map((r, i) => {
              const faded = r.vi !== null && r.vi > VI_EXCLUDE_THRESHOLD;
              return (
                <g key={r.activityId} onMouseEnter={() => setHover(r)} opacity={faded ? 0.35 : 1}>
                  {r.ef !== null && <circle cx={xOf(i)} cy={yEf(r.ef)} r="3" fill="white" stroke={EF_COLOR} strokeWidth="1.5" style={{ cursor: 'pointer' }} />}
                  {r.decoupling !== null && <circle cx={xOf(i)} cy={yDec(r.decoupling)} r="3" fill="white" stroke={DEC_COLOR} strokeWidth="1.5" style={{ cursor: 'pointer' }} />}
                  <rect x={xOf(i) - 6} y={PAD.top} width="12" height={plotH} fill="transparent" />
                </g>
              );
            })}

            {points.map((r, i) =>
              i % xTickEvery === 0 ? (
                <text key={`x-${r.activityId}`} x={xOf(i)} y={H - PAD.bottom + 16} textAnchor="middle" fontSize="10" fill="var(--chart-label)" fontFamily="system-ui">
                  {fmtDay(r.date)}
                </text>
              ) : null
            )}

            {hover && (() => {
              const i = points.findIndex(r => r.activityId === hover.activityId);
              return (
                <g>
                  {svgTooltip(xOf(i), PAD.top + plotH / 2, [
                    { text: fmtDay(hover.date), bold: true },
                    { text: `EF: ${hover.ef !== null ? hover.ef.toFixed(2) : '—'}`, color: EF_COLOR },
                    { text: `Decoupling: ${hover.decoupling !== null ? `${hover.decoupling.toFixed(1)}%` : '—'}`, color: DEC_COLOR },
                    ...(hover.avgPower !== null ? [{ text: `Avg power: ${Math.round(hover.avgPower)} W`, color: '#64748b' }] : []),
                    ...(hover.avgHr !== null ? [{ text: `Avg HR: ${Math.round(hover.avgHr)} bpm`, color: '#64748b' }] : []),
                    ...(hover.vi !== null ? [{ text: `VI: ${hover.vi.toFixed(2)}`, color: '#64748b' }] : []),
                  ], 160, W)}
                </g>
              );
            })()}
          </svg>
        </>
      )}
    </ChartCard>
  );
}
