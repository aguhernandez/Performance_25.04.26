import { useMemo, useState } from 'react';
import type { DailyCompartmentResult } from '../../lib/engine/types';

interface CompartmentsPanelProps {
  history: DailyCompartmentResult[];
  windowDays?: number;
}

const COMPARTMENTS = [
  { key: 'aerobic' as const, label: 'Aerobic', color: '#0ea5e9', desc: 'Oxidative — endurance base' },
  { key: 'glycolytic' as const, label: 'Glycolytic', color: '#f97316', desc: 'Anaerobic — speed endurance' },
  { key: 'neuromuscular' as const, label: 'Neuromuscular', color: '#a78bfa', desc: 'Strength — explosive power' },
];

const MINI_H = 80;
const PAD = { t: 6, b: 14, l: 28, r: 6 };

export function CompartmentsPanel({ history, windowDays = 90 }: CompartmentsPanelProps) {
  const [activeMetric, setActiveMetric] = useState<'fitness' | 'fatigue' | 'form'>('fitness');

  const data = useMemo(() => history.slice(-windowDays), [history, windowDays]);

  if (data.length === 0) {
    return (
      <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4">
        <h3 className="text-[13px] font-semibold text-white mb-2">Multi-Compartment Model</h3>
        <p className="text-slate-600 text-[12px]">Add sessions to visualize compartment dynamics</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-semibold text-white">Multi-Compartment Model</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Aerobic · Glycolytic · Neuromuscular — independent decay systems</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-800/40 rounded-lg p-0.5">
          {(['fitness', 'fatigue', 'form'] as const).map(m => (
            <button
              key={m}
              onClick={() => setActiveMetric(m)}
              className={`px-2 py-1 rounded-md text-[10px] font-mono uppercase transition-all ${
                activeMetric === m ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {COMPARTMENTS.map(({ key, label, color, desc }) => (
          <CompartmentMiniChart
            key={key}
            data={data}
            compartmentKey={key}
            metric={activeMetric}
            label={label}
            color={color}
            desc={desc}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/40">
        {COMPARTMENTS.map(({ key, label, color }) => {
          const last = data[data.length - 1];
          const state = last[key];
          return (
            <div key={key} className="text-center">
              <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">{label}</p>
              <div className="flex justify-center gap-3">
                <div>
                  <p className="text-[9px] text-slate-600">Fit</p>
                  <p className="text-[13px] font-bold font-mono" style={{ color }}>{state.fitness.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-600">Fat</p>
                  <p className="text-[13px] font-bold font-mono text-orange-400">{state.fatigue.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-600">Form</p>
                  <p className={`text-[13px] font-bold font-mono ${state.form >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {state.form >= 0 ? '+' : ''}{state.form.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface MiniChartProps {
  data: DailyCompartmentResult[];
  compartmentKey: 'aerobic' | 'glycolytic' | 'neuromuscular';
  metric: 'fitness' | 'fatigue' | 'form';
  label: string;
  color: string;
  desc: string;
}

function CompartmentMiniChart({ data, compartmentKey, metric, label, color, desc }: MiniChartProps) {
  const path = useMemo(() => {
    if (data.length === 0) return '';
    const values = data.map(d => d[compartmentKey][metric]);
    const minV = Math.min(0, ...values);
    const maxV = Math.max(...values) || 1;
    const range = maxV - minV;
    const cw = 100;
    const ch = MINI_H - PAD.t - PAD.b;
    return values.map((v, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * cw;
      const y = ch - ((v - minV) / range) * ch;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }, [data, compartmentKey, metric]);

  const lastVal = data.length > 0 ? data[data.length - 1][compartmentKey][metric] : 0;

  return (
    <div
      className="rounded-lg p-2.5 border"
      style={{ backgroundColor: `${color}08`, borderColor: `${color}20` }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold" style={{ color }}>{label}</span>
        <span
          className="text-[11px] font-bold font-mono"
          style={{ color: metric === 'form' ? (lastVal >= 0 ? '#22c55e' : '#ef4444') : color }}
        >
          {metric === 'form' && lastVal >= 0 ? '+' : ''}{lastVal.toFixed(2)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${100 + PAD.l + PAD.r} ${MINI_H}`}
        className="w-full"
        style={{ height: MINI_H }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`mg-${compartmentKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <g transform={`translate(${PAD.l}, ${PAD.t})`}>
          {path && (
            <>
              <path
                d={`${path} L100,${MINI_H - PAD.t - PAD.b} L0,${MINI_H - PAD.t - PAD.b} Z`}
                fill={`url(#mg-${compartmentKey})`}
              />
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </>
          )}
        </g>
      </svg>
      <p className="text-[9px] text-slate-600 mt-1">{desc}</p>
    </div>
  );
}
