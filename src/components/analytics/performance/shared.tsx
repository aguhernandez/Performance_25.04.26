import type { ReactNode } from 'react';

export const SPORT_COLORS: Record<string, string> = {
  endurance: '#2A1F4A',
  cycling: '#8A6900',
  running: '#6b7280',
  strength: '#8A6900',
  beach_volleyball: '#2A1F4A',
  other: '#94a3b8',
};

export type Quality = 'measured' | 'modelled' | 'estimated';

export const QUALITY_META: Record<Quality, { label: string; color: string; bg: string }> = {
  measured: { label: 'Measured', color: '#2A1F4A', bg: 'rgba(42,31,74,0.10)' },
  modelled: { label: 'Modelled', color: '#8A6900', bg: 'rgba(247,200,67,0.18)' },
  estimated: { label: 'Estimated', color: '#6b7280', bg: 'rgba(107,114,128,0.10)' },
};

export function QualityBadge({ quality }: { quality: Quality }) {
  const meta = QUALITY_META[quality];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded font-body text-[9px] font-semibold uppercase tracking-wide"
      style={{ color: meta.color, backgroundColor: meta.bg }}
    >
      {meta.label}
    </span>
  );
}

export function RangeSelector({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      {options.map(opt => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`px-2 py-1 rounded-md font-body text-[11px] transition-all ${
            value === opt.key ? 'bg-[#F7C843] text-[#2A1F4A]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <span className="font-body text-[10px] text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  controls,
  children,
}: {
  title: string;
  subtitle?: string;
  controls?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-heading text-[14px] font-bold text-gray-900 dark:text-white">{title}</h3>
          {subtitle && <p className="font-body text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {controls && <div className="flex-shrink-0">{controls}</div>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <p className="font-body text-[13px]">{title}</p>
      {desc && <p className="font-body text-[11px] mt-1">{desc}</p>}
    </div>
  );
}

export function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

export function daysBetween(a: string, b: string): number {
  const ms = new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime();
  return Math.round(ms / 86400000);
}

export function fmtDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function weekStartISO(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return toISODate(d);
}

export function svgTooltip(
  x: number,
  y: number,
  lines: { text: string; color?: string; bold?: boolean }[],
  width: number,
  chartWidth: number
) {
  const h = 14 + lines.length * 15;
  const w = width;
  const flip = x + w + 12 > chartWidth;
  const bx = flip ? x - w - 12 : x + 12;
  const by = Math.max(8, Math.min(y - h / 2, 300 - h));
  return (
    <g>
      <rect x={bx} y={by} width={w} height={h} rx="6" fill="var(--chart-card-background)" stroke="var(--chart-grid)" strokeWidth="1" />
      {lines.map((line, i) => (
        <text
          key={i}
          x={bx + 10}
          y={by + 20 + i * 15}
          fontSize="11"
          fill={line.color ?? 'var(--chart-label)'}
          fontFamily="system-ui"
          fontWeight={line.bold ? 'bold' : 'normal'}
        >
          {line.text}
        </text>
      ))}
    </g>
  );
}
