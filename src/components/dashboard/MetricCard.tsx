import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  accent?: string;
  icon?: ReactNode;
  badge?: { label: string; color: string };
  trend?: number;
}

export function MetricCard({
  label,
  value,
  unit,
  subtext,
  accent = '#06b6d4',
  icon,
  badge,
  trend,
}: MetricCardProps) {
  return (
    <div className="relative bg-[#0d1420] border border-slate-800/60 rounded-xl p-4 overflow-hidden group hover:border-slate-700/60 transition-colors duration-200">
      <div
        className="absolute inset-x-0 top-0 h-px opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}40, transparent)` }}
      />
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-mono uppercase tracking-widest text-slate-500">{label}</span>
        {icon && <div className="text-slate-600 group-hover:text-slate-400 transition-colors">{icon}</div>}
      </div>

      <div className="flex items-end gap-1.5">
        <span className="text-3xl font-bold tabular-nums tracking-tight" style={{ color: accent }}>
          {typeof value === 'number' ? value.toFixed(1) : value}
        </span>
        {unit && <span className="text-sm text-slate-500 mb-1">{unit}</span>}
      </div>

      {(subtext || badge || trend !== undefined) && (
        <div className="flex items-center gap-2 mt-2">
          {badge && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded font-mono"
              style={{ color: badge.color, backgroundColor: `${badge.color}15`, border: `1px solid ${badge.color}30` }}
            >
              {badge.label}
            </span>
          )}
          {subtext && <span className="text-[11px] text-slate-500">{subtext}</span>}
          {trend !== undefined && (
            <span className={`text-[11px] font-mono ml-auto ${trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-slate-500'}`}>
              {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
