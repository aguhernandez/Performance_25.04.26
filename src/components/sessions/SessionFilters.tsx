import { Search, X, SlidersHorizontal } from 'lucide-react';
import type { SessionType } from '../../lib/database.types';

export interface SessionFilterState {
  search: string;
  type: SessionType | 'all';
  sortBy: 'date_desc' | 'date_asc' | 'impulse_desc' | 'duration_desc';
  minImpulse: string;
}

interface SessionFiltersProps {
  filters: SessionFilterState;
  onChange: (f: SessionFilterState) => void;
  totalCount: number;
  filteredCount: number;
}

const TYPE_OPTIONS: { value: SessionType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'cycling', label: 'Cycling' },
  { value: 'running', label: 'Running' },
  { value: 'strength', label: 'Strength' },
  { value: 'beach_volleyball', label: 'Beach Volleyball' },
  { value: 'other', label: 'Other' },
];

const SORT_OPTIONS: { value: SessionFilterState['sortBy']; label: string }[] = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc', label: 'Oldest first' },
  { value: 'impulse_desc', label: 'Highest impulse' },
  { value: 'duration_desc', label: 'Longest session' },
];

export function SessionFilters({ filters, onChange, totalCount, filteredCount }: SessionFiltersProps) {
  const set = (partial: Partial<SessionFilterState>) => onChange({ ...filters, ...partial });
  const hasFilters = filters.search || filters.type !== 'all' || filters.minImpulse;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={filters.search}
            onChange={e => set({ search: e.target.value })}
            placeholder="Search sessions..."
            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-8 pr-3 py-2 text-[12px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        <select
          value={filters.type}
          onChange={e => set({ type: e.target.value as SessionFilterState['type'] })}
          className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[12px] text-white focus:outline-none focus:border-cyan-500/50"
        >
          {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select
          value={filters.sortBy}
          onChange={e => set({ sortBy: e.target.value as SessionFilterState['sortBy'] })}
          className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[12px] text-white focus:outline-none focus:border-cyan-500/50"
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <div className="relative">
          <SlidersHorizontal className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
          <input
            type="number"
            value={filters.minImpulse}
            onChange={e => set({ minImpulse: e.target.value })}
            placeholder="Min impulse"
            step="0.01"
            min="0"
            className="w-[120px] bg-slate-800/50 border border-slate-700/50 rounded-lg pl-7 pr-2 py-2 text-[12px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        {hasFilters && (
          <button
            onClick={() => onChange({ search: '', type: 'all', sortBy: 'date_desc', minImpulse: '' })}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {hasFilters && (
        <p className="text-[11px] text-slate-500">
          Showing {filteredCount} of {totalCount} sessions
        </p>
      )}
    </div>
  );
}

export function applySessionFilters(
  sessions: import('../../lib/database.types').Session[],
  filters: SessionFilterState
): import('../../lib/database.types').Session[] {
  let result = [...sessions];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(s =>
      s.title?.toLowerCase().includes(q) ||
      s.notes?.toLowerCase().includes(q) ||
      s.session_type.includes(q)
    );
  }

  if (filters.type !== 'all') {
    result = result.filter(s => s.session_type === filters.type);
  }

  if (filters.minImpulse) {
    const min = parseFloat(filters.minImpulse);
    if (!isNaN(min)) result = result.filter(s => s.impulse >= min);
  }

  switch (filters.sortBy) {
    case 'date_asc':
      result.sort((a, b) => a.session_date.localeCompare(b.session_date));
      break;
    case 'impulse_desc':
      result.sort((a, b) => b.impulse - a.impulse);
      break;
    case 'duration_desc':
      result.sort((a, b) => b.duration_min - a.duration_min);
      break;
    default:
      result.sort((a, b) => b.session_date.localeCompare(a.session_date));
  }

  return result;
}
