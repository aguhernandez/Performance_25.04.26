import { getFormLabel, getRecoveryRatioLabel } from '../../lib/engine/warningLogic';
import type { BannisterState } from '../../lib/engine/types';

interface FormGaugeProps {
  state: BannisterState;
}

export function FormGauge({ state }: FormGaugeProps) {
  const formInfo = getFormLabel(state.form, state.fitness);
  const recoveryInfo = getRecoveryRatioLabel(state.recoveryRatio);

  const ratio = state.fitness > 0 ? state.fatigue / state.fitness : 0;
  const clampedRatio = Math.min(ratio, 2);
  const gaugePct = (clampedRatio / 2) * 100;

  const gaugeColor =
    ratio < 0.6 ? '#64748b' :
    ratio < 0.8 ? '#22c55e' :
    ratio < 1.0 ? '#f59e0b' :
    ratio < 1.2 ? '#fb923c' :
    '#ef4444';

  return (
    <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-semibold text-white">Readiness State</h3>
        <span
          className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full"
          style={{ color: formInfo.color, backgroundColor: `${formInfo.color}15`, border: `1px solid ${formInfo.color}30` }}
        >
          {formInfo.label}
        </span>
      </div>

      <p className="text-[11px] text-slate-500 mb-4">{formInfo.description}</p>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] text-slate-500 font-mono uppercase">Fatigue / Fitness Ratio</span>
          <span className="text-[12px] font-mono font-bold" style={{ color: gaugeColor }}>
            {(ratio * 100).toFixed(0)}%
          </span>
        </div>
        <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(gaugePct, 100)}%`,
              background: `linear-gradient(90deg, #22c55e, ${gaugeColor})`,
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-sky-400/50"
            style={{ left: '60%' }}
            title="Optimal upper bound"
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-slate-600 font-mono">0%</span>
          <span className="text-[9px] text-slate-600 font-mono">↑120% overreaching</span>
          <span className="text-[9px] text-slate-600 font-mono">200%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/40">
        <div>
          <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">Fitness</p>
          <p className="text-[20px] font-bold text-sky-400 tabular-nums">{state.fitness.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">Fatigue</p>
          <p className="text-[20px] font-bold text-orange-400 tabular-nums">{state.fatigue.toFixed(2)}</p>
        </div>
        <div className="col-span-2">
          <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">Form (Fitness − Fatigue)</p>
          <p
            className="text-[20px] font-bold tabular-nums"
            style={{ color: state.form >= 0 ? '#22c55e' : '#ef4444' }}
          >
            {state.form >= 0 ? '+' : ''}{state.form.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-800/40">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500 font-mono uppercase">Recovery Status</span>
          <span className="text-[11px] font-mono font-semibold" style={{ color: recoveryInfo.color }}>
            {recoveryInfo.label}
          </span>
        </div>
      </div>
    </div>
  );
}
