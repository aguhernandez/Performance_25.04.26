import { useMemo, useState } from 'react';
import type { DailyBannisterResult, PredictedPoint } from '../../lib/engine/types';

interface PerformanceChartProps {
  history: DailyBannisterResult[];
  windowDays?: number;
  predictedHistory?: PredictedPoint[];
}

const CHART_HEIGHT = 220;
const CHART_PADDING = { top: 16, bottom: 32, left: 48, right: 16 };

type SeriesKey = 'fitness' | 'fatigue' | 'form';

const SERIES_CONFIG: Record<SeriesKey, { color: string; label: string; dash?: string }> = {
  fitness: { color: '#0ea5e9', label: 'Fitness' },
  fatigue: { color: '#f97316', label: 'Fatigue' },
  form: { color: '#22c55e', label: 'Form' },
};

export function PerformanceChart({ history, windowDays = 90, predictedHistory = [] }: PerformanceChartProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: DailyBannisterResult } | null>(null);
  const [activeSeries, setActiveSeries] = useState<Set<SeriesKey>>(new Set(['fitness', 'fatigue', 'form']));

  const data = useMemo(() => history.slice(-windowDays), [history, windowDays]);

  const { minY, maxY, chartWidth, chartHeight, points, predictedPaths } = useMemo(() => {
    const cw = 100;
    const ch = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

    if (data.length === 0) return { minY: 0, maxY: 1, chartWidth: cw, chartHeight: ch, points: {}, predictedPaths: {} };

    const allValues = [
      ...data.flatMap(d => [d.fitness, d.fatigue, d.form]),
      ...predictedHistory.flatMap(d => [d.fitness, d.fatigue, d.form]),
    ];
    const minY = Math.min(0, ...allValues);
    const maxY = Math.max(...allValues) * 1.1;
    const range = maxY - minY || 1;

    const totalPoints = data.length + predictedHistory.length;
    const toX = (i: number) => (i / Math.max(totalPoints - 1, 1)) * cw;
    const toY = (v: number) => ch - ((v - minY) / range) * ch;

    const buildPath = (key: SeriesKey) => {
      return data.map((d, i) => {
        const x = toX(i);
        const y = toY(d[key]);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      }).join(' ');
    };

    const buildPredictedPath = (key: SeriesKey) => {
      if (predictedHistory.length === 0) return '';
      const offset = data.length;
      return predictedHistory.map((d, i) => {
        const x = toX(offset + i);
        const y = toY(d[key]);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      }).join(' ');
    };

    return {
      minY,
      maxY,
      chartWidth: cw,
      chartHeight: ch,
      points: {
        fitness: buildPath('fitness'),
        fatigue: buildPath('fatigue'),
        form: buildPath('form'),
        toX,
        toY,
      },
      predictedPaths: {
        fitness: buildPredictedPath('fitness'),
        fatigue: buildPredictedPath('fatigue'),
        form: buildPredictedPath('form'),
      },
    };
  }, [data, predictedHistory]);

  const toggleSeries = (key: SeriesKey) => {
    setActiveSeries(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (data.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const svgWidth = rect.width;
    const plotWidth = svgWidth - CHART_PADDING.left - CHART_PADDING.right;
    const mouseX = e.clientX - rect.left - CHART_PADDING.left;
    const idx = Math.round((mouseX / plotWidth) * (data.length - 1));
    const clampedIdx = Math.max(0, Math.min(idx, data.length - 1));
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, data: data[clampedIdx] });
  };

  const yLabels = useMemo(() => {
    const count = 4;
    const range = maxY - minY;
    return Array.from({ length: count + 1 }, (_, i) => {
      const v = minY + (range * i) / count;
      return { value: v, y: CHART_HEIGHT - CHART_PADDING.bottom - (i / count) * (CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom) };
    });
  }, [minY, maxY]);

  const xLabels = useMemo(() => {
    if (data.length < 2) return [];
    const step = Math.max(1, Math.floor(data.length / 6));
    return data.filter((_, i) => i % step === 0 || i === data.length - 1).map((d, _, arr) => {
      const idx = data.indexOf(d);
      const pct = idx / Math.max(data.length - 1, 1);
      const date = new Date(d.date);
      const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return { label, pct };
    });
  }, [data]);

  return (
    <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[13px] font-semibold text-white">Impulse–Response Model</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Bannister physiological response over time</p>
        </div>
        <div className="flex items-center gap-2">
          {(Object.entries(SERIES_CONFIG) as [SeriesKey, typeof SERIES_CONFIG[SeriesKey]][]).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => toggleSeries(key)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono transition-all ${
                activeSeries.has(key)
                  ? 'bg-slate-800/60 text-slate-300'
                  : 'text-slate-600 opacity-40'
              }`}
            >
              <span
                className="w-2.5 h-0.5 rounded-full inline-block"
                style={{ backgroundColor: cfg.color, opacity: activeSeries.has(key) ? 1 : 0.3 }}
              />
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full" style={{ height: CHART_HEIGHT }}>
        <svg
          className="w-full h-full"
          viewBox={`0 0 ${100 + CHART_PADDING.left + CHART_PADDING.right} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        >
          <defs>
            {(Object.entries(SERIES_CONFIG) as [SeriesKey, typeof SERIES_CONFIG[SeriesKey]][]).map(([key, cfg]) => (
              <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={cfg.color} stopOpacity="0.15" />
                <stop offset="100%" stopColor={cfg.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          <g transform={`translate(${CHART_PADDING.left}, ${CHART_PADDING.top})`}>
            {yLabels.map(({ value, y }, i) => (
              <g key={i}>
                <line
                  x1={0} y1={y - CHART_PADDING.top}
                  x2={chartWidth} y2={y - CHART_PADDING.top}
                  stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2"
                />
                <text
                  x={-4} y={y - CHART_PADDING.top + 3}
                  textAnchor="end"
                  fontSize="5"
                  fill="#475569"
                  fontFamily="monospace"
                >
                  {value.toFixed(1)}
                </text>
              </g>
            ))}

            {(Object.entries(SERIES_CONFIG) as [SeriesKey, typeof SERIES_CONFIG[SeriesKey]][]).map(([key, cfg]) => {
              if (!activeSeries.has(key) || !points[key as keyof typeof points]) return null;
              const path = points[key as keyof typeof points] as string;
              return (
                <g key={key}>
                  <path
                    d={`${path} L${chartWidth},${CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom} L0,${CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom} Z`}
                    fill={`url(#grad-${key})`}
                  />
                  <path
                    d={path}
                    fill="none"
                    stroke={cfg.color}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}

            {(Object.entries(SERIES_CONFIG) as [SeriesKey, typeof SERIES_CONFIG[SeriesKey]][]).map(([key, cfg]) => {
              if (!activeSeries.has(key)) return null;
              const path = predictedPaths[key as keyof typeof predictedPaths] as string;
              if (!path) return null;
              return (
                <path
                  key={`pred-${key}`}
                  d={path}
                  fill="none"
                  stroke={cfg.color}
                  strokeWidth="1"
                  strokeDasharray="3,2"
                  strokeOpacity="0.5"
                  strokeLinecap="round"
                />
              );
            })}

            {xLabels.map(({ label, pct }, i) => (
              <text
                key={i}
                x={pct * chartWidth}
                y={chartHeight + 14}
                textAnchor="middle"
                fontSize="4.5"
                fill="#475569"
                fontFamily="monospace"
              >
                {label}
              </text>
            ))}
          </g>
        </svg>

        {tooltip && (
          <div
            className="absolute pointer-events-none bg-[#0a0f1c] border border-slate-700/60 rounded-lg p-2.5 shadow-2xl z-10 min-w-[140px]"
            style={{
              left: Math.min(tooltip.x + 12, 500),
              top: Math.max(tooltip.y - 80, 4),
            }}
          >
            <p className="text-[10px] text-slate-500 font-mono mb-1.5">{tooltip.data.date}</p>
            {(Object.entries(SERIES_CONFIG) as [SeriesKey, typeof SERIES_CONFIG[SeriesKey]][]).map(([key, cfg]) => (
              <div key={key} className="flex justify-between gap-4 items-center">
                <span className="text-[10px] font-mono" style={{ color: cfg.color }}>{cfg.label}</span>
                <span className="text-[11px] font-bold text-white tabular-nums">
                  {tooltip.data[key].toFixed(2)}
                </span>
              </div>
            ))}
            <div className="border-t border-slate-800 mt-1.5 pt-1.5">
              <div className="flex justify-between gap-4">
                <span className="text-[10px] font-mono text-slate-500">Impulse</span>
                <span className="text-[10px] text-slate-400 tabular-nums">{tooltip.data.impulse.toFixed(3)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {data.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-slate-600 text-sm">No session data – add sessions to model performance</p>
        </div>
      )}
    </div>
  );
}
