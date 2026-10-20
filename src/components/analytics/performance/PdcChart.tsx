import { useMemo, useState } from 'react';
import type { PdcPoint } from './usePerformanceData';
import { ChartCard, QualityBadge, RangeSelector, LegendDot, EmptyState, svgTooltip } from './shared';

const RANGES = [
  { key: '42d', label: '42d' },
  { key: '90d', label: '90d' },
  { key: 'all', label: 'All' },
];

const SERIES_COLORS: Record<string, string> = {
  '42d': '#2A1F4A',
  '90d': '#2A1F4A',
  'all': '#94a3b8',
};

const W = 980;
const H = 320;
const PAD = { top: 16, right: 24, bottom: 34, left: 52 };

const X_TICKS = [1, 5, 10, 30, 60, 300, 600, 1200, 1800, 3600];
const MIN_T = 1;
const MAX_T = 3600;

function fmtDur(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${s / 3600}h`;
}

interface CpModelSummary {
  cp: number;
  wPrimeJ: number;
  pMax: number;
  r2: number;
  confidence: 'high' | 'medium' | 'low';
  deltaFromLab: number | null;
}

export function PdcChart({ windows, cpModel, hasStreams }: {
  windows: { key: string; label: string; points: PdcPoint[] }[];
  cpModel: CpModelSummary | null;
  hasStreams: boolean;
}) {
  const [range, setRange] = useState('all');
  const [hover, setHover] = useState<{ window: string; point: PdcPoint } | null>(null);

  const showModel = !!cpModel && cpModel.confidence !== undefined;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const xOf = (t: number) => PAD.left + ((Math.log10(t) - Math.log10(MIN_T)) / (Math.log10(MAX_T) - Math.log10(MIN_T))) * plotW;
  const maxPower = useMemo(() => {
    let m = 300;
    for (const w of windows) for (const p of w.points) m = Math.max(m, p.watts);
    if (showModel && cpModel) m = Math.max(m, cpModel.pMax);
    return Math.ceil((m * 1.08) / 50) * 50;
  }, [windows, showModel, cpModel]);
  const yOf = (p: number) => PAD.top + plotH - (p / maxPower) * plotH;

  // Model curve points: 1 s to 1 h.
  const modelCurve = useMemo(() => {
    if (!showModel || !cpModel) return null;
    const ts = [1, 2, 5, 10, 20, 30, 60, 120, 300, 600, 1200, 1800, 2700, 3600];
    return ts.map(t => ({ t, p: cpModel.cp + cpModel.wPrimeJ / t }));
  }, [showModel, cpModel]);

  const yTicks = useMemo(() => {
    const step = maxPower > 800 ? 200 : maxPower > 400 ? 100 : 50;
    const ticks = [];
    for (let v = 0; v <= maxPower; v += step) ticks.push(v);
    return ticks;
  }, [maxPower]);

  const activePoints = windows.find(w => w.key === range)?.points ?? [];

  const linkFor = (activityId: string) => `#/sessions?activity=${activityId}`;

  return (
    <ChartCard
      title="Power Duration Curve"
      subtitle="Best efforts per duration from power streams · modelled CP curve overlaid when the fit is usable"
      controls={
        <div className="flex items-center gap-3">
          <QualityBadge quality="measured" />
          {showModel && <QualityBadge quality="modelled" />}
          <RangeSelector options={RANGES} value={range} onChange={setRange} />
        </div>
      }
    >
      {!hasStreams ? (
        <EmptyState title="Requires power stream data" desc="Upload or connect activities with power streams — the curve is built from real stream data, never estimated." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 mb-2">
            {windows.filter(w => w.points.length > 0).map(w => (
              <LegendDot key={w.key} color={SERIES_COLORS[w.key]} label={w.label} />
            ))}
            {showModel && <LegendDot color="#111827" label="CP model P = CP + W'/t" />}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} onMouseLeave={() => setHover(null)}>
            {yTicks.map(v => (
              <g key={v}>
                <line x1={PAD.left} y1={yOf(v)} x2={W - PAD.right} y2={yOf(v)} stroke="var(--chart-grid)" strokeWidth="1" />
                <text x={PAD.left - 6} y={yOf(v) + 4} textAnchor="end" fontSize="10" fill="var(--chart-label)" fontFamily="system-ui">{v}</text>
              </g>
            ))}
            {X_TICKS.map(t => (
              <g key={t}>
                <line x1={xOf(t)} y1={PAD.top} x2={xOf(t)} y2={PAD.top + plotH} stroke="#f8fafc" strokeWidth="1" />
                <text x={xOf(t)} y={H - PAD.bottom + 16} textAnchor="middle" fontSize="10" fill="var(--chart-label)" fontFamily="system-ui">{fmtDur(t)}</text>
              </g>
            ))}

            {/* all-time (background) */}
            {windows.find(w => w.key === 'all')!.points.length > 0 && range !== 'all' && (
              <path
                d={windows.find(w => w.key === 'all')!.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.duration_s)} ${yOf(p.watts)}`).join(' ')}
                fill="none"
                stroke={SERIES_COLORS['all']}
                strokeWidth="2"
                strokeLinejoin="round"
              />
            )}

            {/* 90-day (background for 42d selection) */}
            {range === '42d' && windows.find(w => w.key === '90d')!.points.length > 0 && (
              <path
                d={windows.find(w => w.key === '90d')!.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.duration_s)} ${yOf(p.watts)}`).join(' ')}
                fill="none"
                stroke={SERIES_COLORS['90d']}
                strokeWidth="2"
                strokeLinejoin="round"
              />
            )}

            {/* selected series on top */}
            {activePoints.length > 0 && (
              <path
                d={activePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.duration_s)} ${yOf(p.watts)}`).join(' ')}
                fill="none"
                stroke={SERIES_COLORS[range]}
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            )}

            {/* modelled CP curve */}
            {modelCurve && (
              <path
                d={modelCurve.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${xOf(pt.t)} ${yOf(pt.p)}`).join(' ')}
                fill="none"
                stroke="#111827"
                strokeWidth="2"
                strokeDasharray="6 3"
              />
            )}

            {/* CP level line */}
            {showModel && (
              <>
                <line x1={PAD.left} y1={yOf(cpModel!.cp)} x2={W - PAD.right} y2={yOf(cpModel!.cp)} stroke="#111827" strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
                <text x={W - PAD.right - 4} y={yOf(cpModel!.cp) - 4} textAnchor="end" fontSize="10" fill="#374151" fontFamily="system-ui">CP {cpModel!.cp}W</text>
              </>
            )}

            {/* hover points (selected series) */}
            {activePoints.map(p => (
              <circle
                key={p.duration_s}
                cx={xOf(p.duration_s)}
                cy={yOf(p.watts)}
                r={hover?.point === p ? 5 : 3}
                fill="white"
                stroke={SERIES_COLORS[range]}
                strokeWidth="2"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHover({ window: range, point: p })}
              />
            ))}

            {hover && (() => {
              const p = hover.point;
              const lines = [
                { text: `${p.watts} W · ${fmtDur(p.duration_s)}`, bold: true },
                { text: p.date, color: '#64748b' },
              ];
              return (
                <g>
                  {svgTooltip(xOf(p.duration_s), yOf(p.watts), lines, 130, W)}
                  <a href={linkFor(p.activity_id)}>
                    <text
                      x={xOf(p.duration_s) + 130 + 24 > W ? xOf(p.duration_s) - 140 : xOf(p.duration_s) + 22}
                      y={yOf(p.watts) + (yOf(p.watts) > H / 2 ? 48 : -38)}
                      fontSize="10"
                      fill="#2A1F4A"
                      fontFamily="system-ui"
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      View activity
                    </text>
                  </a>
                </g>
              );
            })()}
          </svg>

          {cpModel && (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              {[
                { label: 'CP', value: `${cpModel.cp} W` },
                { label: "W'", value: `${(cpModel.wPrimeJ / 1000).toFixed(1)} kJ` },
                { label: 'Pmax', value: `${cpModel.pMax} W` },
                { label: 'R²', value: cpModel.r2.toFixed(3) },
                { label: 'Confidence', value: cpModel.confidence },
                { label: 'Model − lab CP', value: cpModel.deltaFromLab !== null ? `${cpModel.deltaFromLab > 0 ? '+' : ''}${cpModel.deltaFromLab} W` : '—' },
              ].map(c => (
                <div key={c.label}>
                  <p className="font-body text-[10px] text-gray-400 uppercase tracking-wide">{c.label}</p>
                  <p className="font-heading text-[15px] font-bold text-gray-800 dark:text-gray-100 capitalize">{c.value}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </ChartCard>
  );
}
