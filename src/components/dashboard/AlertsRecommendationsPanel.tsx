import { useState } from 'react';
import {
  AlertTriangle, TrendingDown, Zap, MinusCircle, CheckCircle2,
  ChevronDown, ChevronUp, Target, Dumbbell, FlaskConical, Apple, RefreshCw
} from 'lucide-react';
import type { EngineWarning, EngineRecommendation } from '../../lib/engine/types';

interface AlertsRecommendationsPanelProps {
  warnings: EngineWarning[];
  recommendations: EngineRecommendation[];
}

const WARNING_CONFIG: Record<string, { icon: typeof AlertTriangle; border: string; bg: string; iconColor: string }> = {
  overreaching: { icon: AlertTriangle, border: 'border-red-500/30', bg: 'bg-red-500/5', iconColor: 'text-red-400' },
  underload: { icon: TrendingDown, border: 'border-slate-600/30', bg: 'bg-gray-50 dark:bg-gray-800', iconColor: 'text-gray-600 dark:text-gray-400' },
  acute_fatigue: { icon: Zap, border: 'border-[#F7C843]/40', bg: 'bg-[#F7C843]/10', iconColor: 'text-[#8A6900] dark:text-[#F7C843]' },
  stagnation: { icon: MinusCircle, border: 'border-[#2A1F4A]/20 dark:border-[#B8A9E5]/30', bg: 'bg-[#2A1F4A]/5 dark:bg-[#B8A9E5]/10', iconColor: 'text-[#2A1F4A] dark:text-[#B8A9E5]' },
  nutrition_deficit: { icon: Apple, border: 'border-red-500/30', bg: 'bg-red-500/5', iconColor: 'text-red-400' },
  nutrition_excess: { icon: Apple, border: 'border-[#F7C843]/40', bg: 'bg-[#F7C843]/10', iconColor: 'text-[#8A6900] dark:text-[#F7C843]' },
  hrv_suppression: { icon: Zap, border: 'border-orange-500/30', bg: 'bg-orange-500/5', iconColor: 'text-[#8A6900] dark:text-[#F7C843]' },
  compartment_imbalance: { icon: MinusCircle, border: 'border-[#2A1F4A]/20 dark:border-[#B8A9E5]/30', bg: 'bg-[#2A1F4A]/5 dark:bg-[#B8A9E5]/10', iconColor: 'text-[#2A1F4A] dark:text-[#B8A9E5]' },
};

const REC_ICON: Record<string, typeof Target> = {
  load: Target,
  recovery: RefreshCw,
  nutrition: Apple,
  training: Dumbbell,
  testing: FlaskConical,
};

const REC_COLOR: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#64748b',
};

export function AlertsRecommendationsPanel({ warnings, recommendations }: AlertsRecommendationsPanelProps) {
  const [expandedRec, setExpandedRec] = useState<string | null>(null);
  const [tab, setTab] = useState<'warnings' | 'recommendations'>('warnings');

  const hasWarnings = warnings.length > 0;
  const hasRecs = recommendations.length > 0;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white">Alerts & Recommendations</h3>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {(['warnings', 'recommendations'] as const).map(t => {
            const count = t === 'warnings' ? warnings.length : recommendations.length;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono capitalize transition-all ${
                  tab === t ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                {t}
                {count > 0 && (
                  <span
                    className="text-[9px] px-1 rounded-full font-bold"
                    style={{
                      backgroundColor: t === 'warnings' && count > 0 ? '#ef444430' : '#2A1F4A20',
                      color: t === 'warnings' && count > 0 ? '#ef4444' : '#2A1F4A',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'warnings' && (
        <div className="space-y-2">
          {warnings.length === 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              <p className="text-[12px] text-green-400">No active warnings. Physiological parameters within normal range.</p>
            </div>
          )}
          {warnings.map((w, i) => {
            const cfg = WARNING_CONFIG[w.type] ?? WARNING_CONFIG.stagnation;
            const Icon = cfg.icon;
            const sevColor = w.severity === 'high' ? '#ef4444' : w.severity === 'medium' ? '#f59e0b' : '#64748b';
            return (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.border} ${cfg.bg}`}>
                <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.iconColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                      style={{ color: sevColor, backgroundColor: `${sevColor}20` }}
                    >
                      {w.severity.toUpperCase()}
                    </span>
                    <span className="text-[9px] font-mono text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {w.type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[9px] font-mono text-gray-600 dark:text-gray-500 ml-auto">
                      {w.value.toFixed(3)} / {w.threshold}
                    </span>
                  </div>
                  <p className="text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed">{w.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'recommendations' && (
        <div className="space-y-2">
          {recommendations.length === 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <CheckCircle2 className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              <p className="text-[12px] text-gray-500 dark:text-gray-400">No specific recommendations at this time. Continue current protocol.</p>
            </div>
          )}
          {recommendations.map((rec, i) => {
            const Icon = REC_ICON[rec.category] ?? Target;
            const priColor = REC_COLOR[rec.priority];
            const key = `${rec.title}-${i}`;
            const expanded = expandedRec === key;
            return (
              <div key={i} className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 dark:bg-gray-800 transition-colors"
                  onClick={() => setExpandedRec(expanded ? null : key)}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${priColor}15`, border: `1px solid ${priColor}30` }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: priColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[12px] font-medium text-gray-900 dark:text-white">{rec.title}</p>
                      <span
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                        style={{ color: priColor, backgroundColor: `${priColor}15` }}
                      >
                        {rec.priority.toUpperCase()}
                      </span>
                      <span className="text-[9px] text-gray-500 dark:text-gray-400 capitalize ml-1">{rec.category}</span>
                    </div>
                    {!expanded && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{rec.detail}</p>}
                  </div>
                  {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 flex-shrink-0" />}
                </button>
                {expanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 px-3 pb-3 pt-2 space-y-2">
                    <p className="text-[12px] text-gray-600 dark:text-gray-400 leading-relaxed">{rec.detail}</p>
                    <div
                      className="rounded-lg p-2.5 text-[11px] leading-relaxed"
                      style={{ backgroundColor: `${priColor}08`, borderLeft: `2px solid ${priColor}` }}
                    >
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Action: </span>
                      <span className="text-gray-600 dark:text-gray-400">{rec.actionable}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
