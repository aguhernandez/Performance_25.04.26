import { useState } from 'react';
import type { HubContextResponse } from '../../lib/hub/hubContext';

export function HubPlanCalendar({ context }: { context: HubContextResponse }) {
  const [limit, setLimit] = useState(25);
  const rows = [
    ...(context.data.plannedEndurance ?? []).map(w => ({ id: `endurance:${w.id}`, date: String(w.scheduled_date), name: String(w.name ?? 'Entrenamiento'), source: String(w.planner_source ?? 'Hub'), status: String(w.status ?? 'planned') })),
    ...(context.data.strength ?? []).map(w => ({ id: `strength:${w.id}`, date: String(w.scheduled_date), name: String(w.external_title ?? w.workout?.name ?? 'Fuerza'), source: String(w.source ?? 'Hub'), status: String(w.status ?? 'planned') })),
    ...(context.data.endurancePlans ?? []).flatMap(p => (Array.isArray(p.plan_data?.days) ? p.plan_data.days : []).map((w: Record<string, unknown>, i: number) => ({ id: `week:${p.id}:${i}`, date: String(w.date ?? w.scheduled_date ?? p.week_start_date), name: String(w.name ?? w.title ?? p.plan_name ?? 'Entrenamiento'), source: String(p.planner_source ?? 'Hub'), status: 'planned' }))),
  ].sort((a, b) => b.date.localeCompare(a.date));
  if (!rows.length) return null;
  return <details className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
    <summary className="cursor-pointer text-sm font-semibold">Calendario planificado en Hub · {rows.length} registros</summary>
    <p className="my-3 text-xs text-gray-500">La planificación se consulta como contexto. Los modelos de carga usan las sesiones realizadas que aparecen debajo.</p>
    <div className="max-h-96 overflow-y-auto space-y-2">{rows.slice(0, limit).map(w => <div key={w.id} className="flex flex-wrap gap-3 text-xs"><span>{w.date.slice(0, 10)}</span><span className="flex-1">{w.name}</span><span>{w.source} · {w.status}</span></div>)}</div>
    {limit < rows.length && <button className="mt-3 text-xs underline" onClick={() => setLimit(n => n + 25)}>Mostrar más</button>}
  </details>;
}
