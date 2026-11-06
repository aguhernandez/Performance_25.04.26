import type { BannisterState } from '../../lib/engine/types';
export function FormGauge({ state }: { state: BannisterState }) {
  return <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
    <h3 className="text-[13px] font-semibold">Load balance</h3>
    <p className="text-[11px] text-gray-500 mt-1">Impulse v1 · Performance 42/7. These values describe modeled load, not physiological readiness.</p>
    <div className="grid grid-cols-2 gap-3 mt-4">{[['Fitness', state.fitness], ['Fatigue', state.fatigue], ['Form (Fitness − Fatigue)', state.form]].map(([label, value]) => <div key={label}><p className="text-[10px] text-gray-500 uppercase">{label}</p><p className="text-xl font-bold tabular-nums">{Number(value).toFixed(2)}</p></div>)}</div>
  </div>;
}
