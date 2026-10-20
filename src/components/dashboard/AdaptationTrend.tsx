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
  improving: 'var(--chart-fitness)',
  declining: 'var(--chart-fatigue)',
  plateau: 'var(--chart-form)',
  insufficient_data: 'var(--chart-form)',
};

export function AdaptationTrend({ trend, tau, performanceIndex, baselinePerformance }: AdaptationTrendProps) {
  const Icon = TREND_ICONS[trend.direction];
  const color = TREND_COLORS[trend.direction];

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white">Adaptation Analysis</h3>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <Icon className="w-3 h-3" style={{ color }} />
          <span className="text-[10px] font-mono" style={{ color }}>{trend.direction.replace('_', ' ').toUpperCase()}</span>
        </div>
      </div>

      <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3">
        <p className="text-[12px] text-gray-700 dark:text-gray-300">{trend.label}</p>
        <div className="flex gap-4 mt-2">
          <div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono uppercase">Fitness Rate</p>
            <p
              className="text-[14px] font-bold font-mono"
              style={{ color: trend.fitnessChangeRate > 0 ? 'var(--chart-fitness)' : trend.fitnessChangeRate < 0 ? 'var(--chart-fatigue)' : 'var(--chart-form)' }}
            >
              {trend.fitnessChangeRate > 0 ? '+' : ''}{(trend.fitnessChangeRate * 100).toFixed(1)}%
            </p>
          </div>
          <div className="w-px bg-gray-200 dark:bg-gray-700/40" />
          <div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono uppercase">Weekly Trend</p>
            <p className="text-[14px] font-bold font-mono text-gray-700 dark:text-gray-300">
              {trend.weeklyTrend > 0 ? '+' : ''}{trend.weeklyTrend.toFixed(1)}%/wk
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2.5 border border-gray-200 dark:border-gray-700">
          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono uppercase mb-1">Perf. Index</p>
          <p className="text-[18px] font-bold text-gray-900 dark:text-white">{performanceIndex.toFixed(0)}</p>
          <p className="text-[10px] text-gray-600 dark:text-gray-500">vs. baseline 100</p>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2.5 border border-gray-200 dark:border-gray-700">
          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono uppercase mb-1">Baseline</p>
          <p className="text-[18px] font-bold text-gray-900 dark:text-white">{baselinePerformance.toFixed(2)}</p>
          <p className="text-[10px] text-gray-600 dark:text-gray-500">fitness units</p>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono uppercase tracking-widest mb-2">Personalized Parameters</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">τ₁</p>
            <p className="text-[13px] font-bold text-[#2A1F4A] dark:text-[#B8A9E5] font-mono">{tau.tauFitness}d</p>
            <p className="text-[9px] text-gray-600 dark:text-gray-500">fitness</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">τ₂</p>
            <p className="text-[13px] font-bold text-[#8A6900] dark:text-[#F7C843] font-mono">{tau.tauFatigue}d</p>
            <p className="text-[9px] text-gray-600 dark:text-gray-500">fatigue</p>
          </div>
        </div>
      </div>
    </div>
  );
}
