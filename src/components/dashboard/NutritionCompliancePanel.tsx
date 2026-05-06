import type { NutritionLog } from '../../lib/database.types';
import type { NutritionComplianceResult } from '../../lib/engine/types';
import { AlertCircle, CheckCircle, Info, TrendingDown } from 'lucide-react';

interface NutritionCompliancePanelProps {
  logs: NutritionLog[];
  compliance: NutritionComplianceResult;
  weightKg: number;
}

function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function NutritionCompliancePanel({ logs, compliance, weightKg }: NutritionCompliancePanelProps) {
  const recentLogs = logs.slice(0, 7);
  const avgSleep = recentLogs.length > 0 ? recentLogs.reduce((s, l) => s + l.sleep_hours, 0) / recentLogs.length : 0;

  const eaColor = compliance.energyAvailability < 25 ? '#ef4444' : compliance.energyAvailability > 55 ? '#f59e0b' : '#22c55e';
  const overallColor = compliance.overallCompliance < 50 ? '#ef4444' : compliance.overallCompliance < 75 ? '#f59e0b' : '#22c55e';

  const AlertIcon = compliance.deficit ? AlertCircle : compliance.excess ? TrendingDown : compliance.overallCompliance > 75 ? CheckCircle : Info;
  const alertColor = compliance.deficit ? '#ef4444' : compliance.excess ? '#f59e0b' : compliance.overallCompliance > 75 ? '#22c55e' : '#0ea5e9';

  return (
    <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-semibold text-white">Nutrition & Recovery</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">14-day compliance – modifying effective impulse</p>
        </div>
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-mono font-bold"
          style={{ color: overallColor, backgroundColor: `${overallColor}15`, border: `1px solid ${overallColor}30` }}
        >
          {compliance.overallCompliance.toFixed(0)}%
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-[10px] text-slate-500 font-mono uppercase">Energy Availability</span>
            <span className="text-[10px] font-mono" style={{ color: eaColor }}>{compliance.energyAvailability.toFixed(0)} kcal/kg LM</span>
          </div>
          <ScoreBar value={compliance.energyAvailability} max={60} color={eaColor} />
          <p className="text-[9px] text-slate-600 mt-0.5">Target: 30–45 kcal/kg lean mass</p>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <span className="text-[10px] text-slate-500 font-mono uppercase">Recovery Score</span>
            <span className="text-[10px] font-mono text-cyan-400">{compliance.recoveryScore.toFixed(0)}%</span>
          </div>
          <ScoreBar value={compliance.recoveryScore} max={100} color="#0ea5e9" />
          <p className="text-[9px] text-slate-600 mt-0.5">Sleep duration + quality weighted</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Protein', value: compliance.proteinAdherence, unit: '%', color: '#22c55e', target: `${(weightKg * 1.8).toFixed(0)}g target` },
          { label: 'Carbs', value: compliance.carbAdherence, unit: '%', color: '#f59e0b', target: `${(weightKg * 5).toFixed(0)}g target` },
          { label: 'Fat', value: compliance.fatAdherence, unit: '%', color: '#a78bfa', target: '≥20% total kcal' },
        ].map(({ label, value, color, target }) => (
          <div key={label} className="bg-slate-800/30 rounded-lg p-2.5 border border-slate-700/20">
            <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">{label}</p>
            <p className="text-[18px] font-bold font-mono" style={{ color: value >= 80 ? color : value >= 60 ? '#f59e0b' : '#ef4444' }}>
              {value.toFixed(0)}%
            </p>
            <p className="text-[9px] text-slate-600">{target}</p>
          </div>
        ))}
      </div>

      <div
        className="flex items-start gap-2.5 p-3 rounded-lg border"
        style={{ borderColor: `${alertColor}30`, backgroundColor: `${alertColor}08` }}
      >
        <AlertIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: alertColor }} />
        <p className="text-[11px] text-slate-300 leading-relaxed">{compliance.recommendation}</p>
      </div>

      {recentLogs.length > 0 && (
        <div className="border-t border-slate-800/40 pt-3">
          <p className="text-[10px] text-slate-500 font-mono uppercase mb-2">7-Day Sleep Trend</p>
          <div className="flex items-end gap-1 h-10">
            {recentLogs.slice(0, 7).reverse().map((log, i) => {
              const h = Math.min((log.sleep_hours / 9) * 40, 40);
              const color = log.sleep_hours >= 8 ? '#22c55e' : log.sleep_hours >= 7 ? '#f59e0b' : '#ef4444';
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group">
                  <div
                    className="w-full rounded-sm transition-all"
                    style={{ height: `${h}px`, backgroundColor: color, opacity: 0.7 }}
                    title={`${log.log_date}: ${log.sleep_hours}h`}
                  />
                  <span className="text-[8px] text-slate-600 font-mono">{log.sleep_hours.toFixed(0)}</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-slate-600">7d ago</span>
            <span className="text-[9px] text-slate-400 font-mono">Avg: {avgSleep.toFixed(1)}h</span>
            <span className="text-[9px] text-slate-600">Today</span>
          </div>
        </div>
      )}
    </div>
  );
}
