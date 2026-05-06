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
  underload: { icon: TrendingDown, border: 'border-slate-600/30', bg: 'bg-slate-800/20', iconColor: 'text-slate-400' },
  acute_fatigue: { icon: Zap, border: 'border-amber-500/30', bg: 'bg-amber-500/5', iconColor: 'text-amber-400' },
  stagnation: { icon: MinusCircle, border: 'border-sky-500/30', bg: 'bg-sky-500/5', iconColor: 'text-sky-400' },
  nutrition_deficit: { icon: Apple, border: 'border-red-500/30', bg: 'bg-red-500/5', iconColor: 'text-red-400' },
  nutrition_excess: { icon: Apple, border: 'border-amber-500/30', bg: 'bg-amber-500/5', iconColor: 'text-amber-400' },
  hrv_suppression: { icon: Zap, border: 'border-orange-500/30', bg: 'bg-orange-500/5', iconColor: 'text-orange-400' },
  compartment_imbalance: { icon: MinusCircle, border: 'border-cyan-500/30', bg: 'bg-cyan-500/5', iconColor: 'text-cyan-400' },
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
    <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-white">Alerts & Recommendations</h3>
        <div className="flex items-center gap-1 bg-slate-800/40 rounded-lg p-0.5">
          {(['warnings', 'recommendations'] as const).map(t => {
            const count = t === 'warnings' ? warnings.length : recommendations.length;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono capitalize transition-all ${
                  tab === t ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {t}
                {count > 0 && (
                  <span
                    className="text-[9px] px-1 rounded-full font-bold"
                    style={{
                      backgroundColor: t === 'warnings' && count > 0 ? '#ef444430' : '#0ea5e930',
                      color: t === 'warnings' && count > 0 ? '#ef4444' : '#0ea5e9',
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
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                      {w.type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[9px] font-mono text-slate-600 ml-auto">
                      {w.value.toFixed(3)} / {w.threshold}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-300 leading-relaxed">{w.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'recommendations' && (
        <div className="space-y-2">
          {recommendations.length === 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/20 border border-slate-700/30">
              <CheckCircle2 className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <p className="text-[12px] text-slate-500">No specific recommendations at this time. Continue current protocol.</p>
            </div>
          )}
          {recommendations.map((rec, i) => {
            const Icon = REC_ICON[rec.category] ?? Target;
            const priColor = REC_COLOR[rec.priority];
            const key = `${rec.title}-${i}`;
            const expanded = expandedRec === key;
            return (
              <div key={i} className="bg-slate-800/30 border border-slate-700/20 rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-800/30 transition-colors"
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
                      <p className="text-[12px] font-medium text-white">{rec.title}</p>
                      <span
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                        style={{ color: priColor, backgroundColor: `${priColor}15` }}
                      >
                        {rec.priority.toUpperCase()}
                      </span>
                      <span className="text-[9px] text-slate-500 capitalize ml-1">{rec.category}</span>
                    </div>
                    {!expanded && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{rec.detail}</p>}
                  </div>
                  {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />}
                </button>
                {expanded && (
                  <div className="border-t border-slate-700/20 px-3 pb-3 pt-2 space-y-2">
                    <p className="text-[12px] text-slate-400 leading-relaxed">{rec.detail}</p>
                    <div
                      className="rounded-lg p-2.5 text-[11px] leading-relaxed"
                      style={{ backgroundColor: `${priColor}08`, borderLeft: `2px solid ${priColor}` }}
                    >
                      <span className="font-semibold text-slate-300">Action: </span>
                      <span className="text-slate-400">{rec.actionable}</span>
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
