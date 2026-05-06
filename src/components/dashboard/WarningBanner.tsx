import { AlertTriangle, TrendingDown, Zap, MinusCircle, X } from 'lucide-react';
import { useState } from 'react';
import type { EngineWarning } from '../../lib/engine/types';

interface WarningBannerProps {
  warnings: EngineWarning[];
}

const WARNING_CONFIG = {
  overreaching: {
    icon: AlertTriangle,
    borderColor: 'border-red-500/30',
    bgColor: 'bg-red-500/5',
    iconColor: 'text-red-400',
    badgeColor: 'bg-red-500/10 text-red-400',
  },
  underload: {
    icon: TrendingDown,
    borderColor: 'border-slate-600/30',
    bgColor: 'bg-slate-800/30',
    iconColor: 'text-slate-400',
    badgeColor: 'bg-slate-700/40 text-slate-400',
  },
  acute_fatigue: {
    icon: Zap,
    borderColor: 'border-amber-500/30',
    bgColor: 'bg-amber-500/5',
    iconColor: 'text-amber-400',
    badgeColor: 'bg-amber-500/10 text-amber-400',
  },
  stagnation: {
    icon: MinusCircle,
    borderColor: 'border-sky-500/30',
    bgColor: 'bg-sky-500/5',
    iconColor: 'text-sky-400',
    badgeColor: 'bg-sky-500/10 text-sky-400',
  },
};

const SEVERITY_LABELS: Record<string, string> = {
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
};

export function WarningBanner({ warnings }: WarningBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = warnings.filter(w => !dismissed.has(`${w.type}-${w.value}`));

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((warning) => {
        const config = WARNING_CONFIG[warning.type];
        const Icon = config.icon;
        const key = `${warning.type}-${warning.value}`;
        return (
          <div
            key={key}
            className={`flex items-start gap-3 p-3 rounded-lg border ${config.borderColor} ${config.bgColor}`}
          >
            <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.iconColor}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${config.badgeColor}`}>
                  {SEVERITY_LABELS[warning.severity]}
                </span>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                  {warning.type.replace('_', ' ')}
                </span>
              </div>
              <p className="text-[12px] text-slate-300 leading-relaxed">{warning.message}</p>
            </div>
            <button
              onClick={() => setDismissed(prev => new Set([...prev, key]))}
              className="text-slate-600 hover:text-slate-400 transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
