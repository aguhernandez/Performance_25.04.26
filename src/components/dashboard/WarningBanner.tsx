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
    bgColor: 'bg-gray-50 dark:bg-gray-800',
    iconColor: 'text-gray-600 dark:text-gray-400',
    badgeColor: 'bg-gray-200 dark:bg-gray-700/40 text-gray-600 dark:text-gray-400',
  },
  acute_fatigue: {
    icon: Zap,
    borderColor: 'border-[#F7C843]/40 dark:border-[#F7C843]/30',
    bgColor: 'bg-[#F7C843]/20 dark:bg-[#F7C843]/10',
    iconColor: 'text-[#8A6900] dark:text-[#F7C843]',
    badgeColor: 'bg-[#F7C843]/20 dark:bg-[#F7C843]/10 text-[#8A6900] dark:text-[#F7C843]',
  },
  stagnation: {
    icon: MinusCircle,
    borderColor: 'border-[#2A1F4A]/20 dark:border-[#B8A9E5]/30',
    bgColor: 'bg-[#2A1F4A]/5 dark:bg-[#B8A9E5]/10',
    iconColor: 'text-[#2A1F4A] dark:text-[#B8A9E5]',
    badgeColor: 'bg-[#2A1F4A]/10 text-[#2A1F4A] dark:bg-[#B8A9E5]/10 dark:text-[#B8A9E5]',
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
                <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {warning.type.replace('_', ' ')}
                </span>
              </div>
              <p className="text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed">{warning.message}</p>
            </div>
            <button
              onClick={() => setDismissed(prev => new Set([...prev, key]))}
              className="text-gray-600 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
