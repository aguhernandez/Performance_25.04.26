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
    <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
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

  const eaColor = compliance.energyAvailability < 25 ? '#ef4444' : compliance.energyAvailability > 55 ? '#8A6900' : '#2A1F4A';
  const overallColor = compliance.overallCompliance < 50 ? '#ef4444' : compliance.overallCompliance < 75 ? '#8A6900' : '#2A1F4A';

  const AlertIcon = compliance.deficit ? AlertCircle : compliance.excess ? TrendingDown : compliance.overallCompliance > 75 ? CheckCircle : Info;
  const alertColor = compliance.deficit ? '#ef4444' : compliance.excess ? '#8A6900' : compliance.overallCompliance > 75 ? '#2A1F4A' : '#8A6900';

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white">Nutrition & Recovery</h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">14-day compliance – modifying effective impulse</p>
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
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono uppercase">Energy Availability</span>
            <span className="text-[10px] font-mono" style={{ color: eaColor }}>{compliance.energyAvailability.toFixed(0)} kcal/kg LM</span>
          </div>
          <ScoreBar value={compliance.energyAvailability} max={60} color={eaColor} />
          <p className="text-[9px] text-gray-600 dark:text-gray-500 mt-0.5">Target: 30–45 kcal/kg lean mass</p>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono uppercase">Recovery Score</span>
            <span className="text-[10px] font-mono text-[#2A1F4A] dark:text-[#B8A9E5]">{compliance.recoveryScore.toFixed(0)}%</span>
          </div>
          <ScoreBar value={compliance.recoveryScore} max={100} color="#2A1F4A" />

          <p className="text-[9px] text-gray-600 dark:text-gray-500 mt-0.5">Sleep duration + quality weighted</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Protein', value: compliance.proteinAdherence, unit: '%', color: '#2A1F4A', target: `${(weightKg * 1.8).toFixed(0)}g target` },
          { label: 'Carbs', value: compliance.carbAdherence, unit: '%', color: '#8A6900', target: `${(weightKg * 5).toFixed(0)}g target` },
          { label: 'Fat', value: compliance.fatAdherence, unit: '%', color: '#2A1F4A', target: '≥20% total kcal' },
        ].map(({ label, value, color, target }) => (
          <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5 border border-gray-200 dark:border-gray-700">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono uppercase mb-1">{label}</p>
            <p className="text-[18px] font-bold font-mono" style={{ color: value >= 80 ? color : value >= 60 ? '#8A6900' : '#ef4444' }}>

              {value.toFixed(0)}%
            </p>
            <p className="text-[9px] text-gray-600 dark:text-gray-500">{target}</p>
          </div>
        ))}
      </div>

      <div
        className="flex items-start gap-2.5 p-3 rounded-lg border"
        style={{ borderColor: `${alertColor}30`, backgroundColor: `${alertColor}08` }}
      >
        <AlertIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: alertColor }} />
        <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed">{compliance.recommendation}</p>
      </div>

      {recentLogs.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono uppercase mb-2">7-Day Sleep Trend</p>
          <div className="flex items-end gap-1 h-10">
            {recentLogs.slice(0, 7).reverse().map((log, i) => {
              const h = Math.min((log.sleep_hours / 9) * 40, 40);
              const color = log.sleep_hours >= 8 ? '#2A1F4A' : log.sleep_hours >= 7 ? '#8A6900' : '#ef4444';
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group">
                  <div
                    className="w-full rounded-sm transition-all"
                    style={{ height: `${h}px`, backgroundColor: color, opacity: 0.7 }}
                    title={`${log.log_date}: ${log.sleep_hours}h`}
                  />
                  <span className="text-[8px] text-gray-600 dark:text-gray-500 font-mono">{log.sleep_hours.toFixed(0)}</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-gray-600 dark:text-gray-500">7d ago</span>
            <span className="text-[9px] text-gray-600 dark:text-gray-400 font-mono">Avg: {avgSleep.toFixed(1)}h</span>
            <span className="text-[9px] text-gray-600 dark:text-gray-500">Today</span>
          </div>
        </div>
      )}
    </div>
  );
}
