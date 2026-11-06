import { useMemo, useState } from 'react';
import type { DailyBannisterResult, PredictedPoint } from '../../lib/engine/types';

interface PerformanceChartProps { history: DailyBannisterResult[]; windowDays?: number; predictedHistory?: PredictedPoint[] }
type Series = 'fitness' | 'fatigue' | 'form';
const series: Record<Series, { label: string; color: string }> = {
  fitness: { label: 'Fitness', color: 'var(--chart-fitness)' },
  fatigue: { label: 'Fatigue', color: 'var(--chart-fatigue)' },
  form: { label: 'Form', color: 'var(--chart-form)' },
};
const width = 800, height = 300, left = 65, right = 20, top = 20, bottom = 45;
const plotWidth = width - left - right, plotHeight = height - top - bottom;

export function PerformanceChart({ history, windowDays = 90, predictedHistory = [] }: PerformanceChartProps) {
  const [selected, setSelected] = useState<Set<Series>>(new Set(['fitness', 'fatigue', 'form']));
  const [hover, setHover] = useState<number | null>(null);
  const actual = useMemo(() => history.slice(-windowDays), [history, windowDays]);
  const data = useMemo(() => [...actual.map(d => ({ ...d, projected: false })), ...predictedHistory.map(d => ({ ...d, projected: true }))], [actual, predictedHistory]);
  const values = data.flatMap(d => [...selected].map(k => d[k]));
  const min = Math.min(0, ...values), max = Math.max(1, ...values);
  const range = max - min || 1;
  const x = (i: number) => left + i / Math.max(1, data.length - 1) * plotWidth;
  const y = (v: number) => top + (max - v) / range * plotHeight;
  const path = (key: Series, start: number, end: number) => data.slice(start, end).map((d, i) => `${i ? 'L' : 'M'}${x(start + i)},${y(d[key])}`).join(' ');
  const ticks = data.length ? [...new Set(Array.from({ length: Math.min(6, data.length) }, (_, i) => Math.round(i * (data.length - 1) / Math.max(1, Math.min(6, data.length) - 1))))] : [];
  const move = (event: React.MouseEvent<SVGSVGElement>) => {
    const point = event.currentTarget.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix || !data.length) return;
    const sx = point.matrixTransform(matrix.inverse()).x;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round((sx - left) / plotWidth * (data.length - 1)))));
  };
  return <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><div><h3 className="text-[13px] font-semibold">Impulse–Response Model</h3><p className="text-[11px] text-gray-500">Impulse v1 · Performance 42/7</p></div>
      <div className="flex gap-2">{(Object.keys(series) as Series[]).map(key => <button key={key} type="button" aria-pressed={selected.has(key)} className={`text-xs px-2 py-1 rounded ${selected.has(key) ? 'bg-gray-100 dark:bg-gray-800' : 'opacity-40'}`} onClick={() => setSelected(old => { const next = new Set(old); if (next.has(key)) { if (next.size > 1) next.delete(key); } else next.add(key); return next; })}><span style={{ color: series[key].color }}>●</span> {series[key].label}</button>)}</div></div>
    {data.length ? <><svg className="w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Fitness, fatigue and form over time" onMouseMove={move} onMouseLeave={() => setHover(null)}>
      {Array.from({ length: 5 }, (_, i) => { const v = min + range * i / 4; return <g key={i}><line x1={left} x2={width-right} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" strokeDasharray="4 5"/><text x={left-8} y={y(v)+4} textAnchor="end" fontSize="11" fill="var(--chart-label)">{v.toFixed(1)}</text></g>; })}
      {ticks.map(i => <text key={i} x={x(i)} y={height-14} textAnchor={i === 0 ? 'start' : i === data.length-1 ? 'end' : 'middle'} fontSize="11" fill="var(--chart-label)">{data[i].date}</text>)}
      {(Object.keys(series) as Series[]).filter(k => selected.has(k)).map(k => <g key={k}><path d={path(k, 0, actual.length)} fill="none" stroke={series[k].color} strokeWidth="2.5"/><path d={predictedHistory.length ? path(k, Math.max(0, actual.length-1), data.length) : ''} fill="none" stroke={series[k].color} strokeWidth="2" strokeDasharray="6 4"/></g>)}
      {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={top} y2={height-bottom} stroke="var(--chart-label)" strokeDasharray="3 3"/>}
    </svg>{hover !== null && <div className="text-xs text-gray-600 dark:text-gray-300 flex flex-wrap gap-3" aria-live="polite"><span>{data[hover].date} {data[hover].projected ? '· Projection' : '· Actual'}</span>{(Object.keys(series) as Series[]).filter(k => selected.has(k)).map(k => <span key={k} style={{ color: series[k].color }}>{series[k].label}: {data[hover][k].toFixed(2)}</span>)}{'impulse' in data[hover] && <span>Impulse: {Number(data[hover].impulse).toFixed(2)}</span>}</div>}</> : <p className="text-sm text-gray-500">No calculable Impulse data available.</p>}
    {predictedHistory.length > 0 && <p className="text-xs text-gray-500">Dashed lines: projection</p>}
  </div>;
}
