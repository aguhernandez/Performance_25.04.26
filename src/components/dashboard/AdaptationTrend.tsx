import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import type { AdaptationTrend as AdaptationTrendType, TauParameters } from '../../lib/engine/types';

interface AdaptationTrendProps {
  trend: AdaptationTrendType;
  tau: TauParameters;
  performanceIndex: number;
  baselinePerformance: number;
}

const TREND_ICONS = {
  improving: TrendingUp,
  declining: TrendingDown,
  plateau: Minus,
  insufficient_data: AlertCircle,
};

const TREND_COLORS = {
  improving: '#22c55e',
  declining: '#ef4444',
  plateau: '#f59e0b',
  insufficient_data: '#64748b',
};

export function AdaptationTrend({ trend, tau, performanceIndex, baselinePerformance }: AdaptationTrendProps) {
  const Icon = TREND_ICONS[trend.direction];
  const color = TREND_COLORS[trend.direction];

  return (
    <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-white">Adaptation Analysis</h3>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-800/60 border border-slate-700/40">
          <Icon className="w-3 h-3" style={{ color }} />
          <span className="text-[10px] font-mono" style={{ color }}>{trend.direction.replace('_', ' ').toUpperCase()}</span>
        </div>
      </div>

      <div className="rounded-lg bg-slate-800/30 border border-slate-700/20 p-3">
        <p className="text-[12px] text-slate-300">{trend.label}</p>
        <div className="flex gap-4 mt-2">
          <div>
            <p className="text-[10px] text-slate-500 font-mono uppercase">Fitness Rate</p>
            <p
              className="text-[14px] font-bold font-mono"
              style={{ color: trend.fitnessChangeRate > 0 ? '#22c55e' : trend.fitnessChangeRate < 0 ? '#ef4444' : '#94a3b8' }}
            >
              {trend.fitnessChangeRate > 0 ? '+' : ''}{(trend.fitnessChangeRate * 100).toFixed(1)}%
            </p>
          </div>
          <div className="w-px bg-slate-700/40" />
          <div>
            <p className="text-[10px] text-slate-500 font-mono uppercase">Weekly Trend</p>
            <p className="text-[14px] font-bold font-mono text-slate-300">
              {trend.weeklyTrend > 0 ? '+' : ''}{trend.weeklyTrend.toFixed(1)}%/wk
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-slate-800/20 p-2.5 border border-slate-700/20">
          <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">Perf. Index</p>
          <p className="text-[18px] font-bold text-white">{performanceIndex.toFixed(0)}</p>
          <p className="text-[10px] text-slate-600">vs. baseline 100</p>
        </div>
        <div className="rounded-lg bg-slate-800/20 p-2.5 border border-slate-700/20">
          <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">Baseline</p>
          <p className="text-[18px] font-bold text-white">{baselinePerformance.toFixed(2)}</p>
          <p className="text-[10px] text-slate-600">fitness units</p>
        </div>
      </div>

      <div className="border-t border-slate-800/60 pt-3">
        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mb-2">Personalized Parameters</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <p className="text-[10px] text-slate-500 font-mono">τ₁</p>
            <p className="text-[13px] font-bold text-cyan-400 font-mono">{tau.tauFitness}d</p>
            <p className="text-[9px] text-slate-600">fitness</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-500 font-mono">τ₂</p>
            <p className="text-[13px] font-bold text-orange-400 font-mono">{tau.tauFatigue}d</p>
            <p className="text-[9px] text-slate-600">fatigue</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-500 font-mono">k</p>
            <p className="text-[13px] font-bold text-amber-400 font-mono">{tau.kMultiplier}</p>
            <p className="text-[9px] text-slate-600">multiplier</p>
          </div>
        </div>
      </div>
    </div>
  );
}
