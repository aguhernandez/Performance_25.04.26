import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import type { DurabilityWindow, DurabilityCell } from './usePerformanceData';
import { ChartCard, RangeSelector, EmptyState } from './shared';

const KJ_LABELS: Record<number, string> = { 0: 'Fresh', 1000: 'After 1000 kJ', 2000: 'After 2000 kJ' };

function CellBar({ cell, pct, color }: {
  cell: DurabilityCell;
  pct: number | null;
  color: string;
}) {
  const [hover, setHover] = useState(false);
  const has = cell.watts !== null && cell.watts > 0;
  return (
    <div className="flex flex-col items-center relative">
      {hover && has && (
        <div className="absolute -top-14 z-10 bg-gray-900 text-white rounded-lg px-3 py-2 whitespace-nowrap">
          <p className="text-[11px] font-semibold">{Math.round(cell.watts!)} W</p>
          <p className="text-[10px] text-gray-300">
            {cell.date ? new Date(cell.date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''}
            {cell.activityId ? ` · Activity ${cell.activityId.slice(0, 8)}` : ''}
          </p>
        </div>
      )}
      <div
        className="w-full rounded-t-md transition-all"
        style={{
          height: has ? `${Math.max(4, pct ?? 60)}%` : '4px',
          minHeight: 4,
          backgroundColor: has ? color : '#f1f5f9',
          opacity: hover ? 0.85 : 1,
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      />
      <p className="font-mono text-[10px] mt-1" style={{ color: has ? '#334155' : '#94a3b8' }}>
        {has ? `${Math.round(cell.watts!)} W` : 'No data'}
      </p>
      {has && pct !== null && (
        <p className="text-[9px]" style={{ color: pct >= 0 ? '#16a34a' : '#dc2626' }}>
          {pct >= 0 ? '+' : ''}{pct.toFixed(0)}%
        </p>
      )}
      {has && pct === null && <p className="text-[9px] text-gray-300">—</p>}
    </div>
  );
}

export function DurabilityChart({ windows }: { windows: DurabilityWindow[] }) {
  const [range, setRange] = useState('42d');
  const active = windows.find(w => w.key === range) ?? windows[0];
  const anyData = windows.some(w =>
    w.groups.some(g => g.cells.duration300.watts !== null || g.cells.duration1200.watts !== null)
  );

  const fresh300 = active.groups.find(g => g.kjThreshold === 0)?.cells.duration300.watts ?? null;
  const fresh1200 = active.groups.find(g => g.kjThreshold === 0)?.cells.duration1200.watts ?? null;

  return (
    <ChartCard
      title="Durability"
      subtitle="Mean-max power after 0 / 1000 / 2000 kJ of prior work — 5 min and 20 min"
      controls={
        <RangeSelector
          options={[{ key: '42d', label: '42d' }, { key: '90d', label: '90d' }, { key: 'all', label: 'All time' }]}
          value={range}
          onChange={setRange}
        />
      }
    >
      {!anyData ? (
        <EmptyState
          title="Requires power stream"
          desc="Durability is computed from power streams at ingestion; a ride must contain 1000 / 2000 kJ of cumulative work for those slots to fill."
        />
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <FlaskConical className="w-3 h-3" />
              Measured: best recorded effort
            </span>
          </div>
          <div className="grid grid-cols-2 gap-6">
            {([300, 1200] as const).map(durationS => {
              const fresh = durationS === 300 ? fresh300 : fresh1200;
              return (
                <div key={durationS} className="space-y-2">
                  <p className="text-[11px] font-semibold text-gray-700">
                    {durationS === 300 ? '5 min' : '20 min'} mean-max
                  </p>
                  {active.groups.map(g => {
                    const cell = durationS === 300 ? g.cells.duration300 : g.cells.duration1200;
                    const pct =
                      fresh !== null && fresh > 0 && cell.watts !== null && g.kjThreshold !== 0
                        ? ((cell.watts - fresh) / fresh) * 100
                        : null;
                    return (
                      <div key={g.kjThreshold} className="space-y-0.5">
                        <p className="text-[10px] text-gray-400">{KJ_LABELS[g.kjThreshold]}</p>
                        <CellBar
                          cell={cell}
                          pct={pct}
                          color={g.kjThreshold === 0 ? '#0ea5e9' : g.kjThreshold === 1000 ? '#f59e0b' : '#ef4444'}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-400 mt-3">
            Reflects the best effort recorded after that work, not necessarily a maximal effort.
          </p>
        </>
      )}
    </ChartCard>
  );
}
