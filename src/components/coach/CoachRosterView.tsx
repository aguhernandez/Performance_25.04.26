import { useMemo, useState } from 'react';
import { Search, ChevronDown, ChevronUp, RefreshCw, Users } from 'lucide-react';
import { useCoachRoster } from '../../hooks/useCoachRoster';
import {
  rosterAlerts,
  worstLevel,
  LEVEL_COLORS,
  type RosterRow,
  type AlertLevel,
} from '../../lib/rosterAlerts';
import { RosterWeeklyStack } from './RosterWeeklyStack';
import { PendingSuggestions } from './PendingSuggestions';

type SortKey = 'name' | 'fitness' | 'fatigue' | 'form' | 'ramp_rate' | 'impulse_7d' | 'last_session_date';
type Dir = 'asc' | 'desc';

const COLUMNS: { key: SortKey | null; label: string; align?: string }[] = [
  { key: 'name', label: 'Athlete' },
  { key: 'fitness', label: 'Fitness', align: 'text-right' },
  { key: 'fatigue', label: 'Fatigue', align: 'text-right' },
  { key: 'form', label: 'Form', align: 'text-right' },
  { key: 'ramp_rate', label: 'Ramp', align: 'text-right' },
  { key: 'impulse_7d', label: '7d impulse', align: 'text-right' },
  { key: 'last_session_date', label: 'Last session', align: 'text-right' },
];

const LEVEL_ORDER: Record<AlertLevel, number> = { red: 0, amber: 1, info: 2, ok: 3 };

export function CoachRosterView({
  role,
  onOpenAthlete,
  athleteNames,
}: {
  role: string;
  onOpenAthlete: (row: RosterRow) => void;
  athleteNames: Record<string, string>;
}) {
  const { rows, loading, error, refetch } = useCoachRoster();
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<Dir>('asc');
  const [coachFilter, setCoachFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const todayISO = new Date().toISOString().split('T')[0];
  const isHead = role === 'head_coach' || role === 'admin';

  const withAlerts = useMemo(
    () => rows.map(r => ({ row: r, alerts: rosterAlerts(r, todayISO) })),
    [rows, todayISO]
  );

  const coachOptions = useMemo(() => {
    if (!isHead) return [];
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.coach_id) map.set(r.coach_id, r.coach_name || r.coach_id.slice(0, 8));
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows, isHead]);

  const visible = useMemo(() => {
    let list = withAlerts;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(x => x.row.name.toLowerCase().includes(q) || (x.row.sport || '').toLowerCase().includes(q));
    }
    if (isHead && coachFilter !== 'all') {
      list = list.filter(x => x.row.coach_id === coachFilter);
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === 'name') return a.row.name.localeCompare(b.row.name) * dir;
      if (sortKey === 'last_session_date') {
        const av = a.row.last_session_date ?? '';
        const bv = b.row.last_session_date ?? '';
        return av.localeCompare(bv) * dir;
      }
      const av = a.row[sortKey] !== null ? Number(a.row[sortKey]) : -Infinity;
      const bv = b.row[sortKey] !== null ? Number(b.row[sortKey]) : -Infinity;
      return (av - bv) * dir;
    });
  }, [withAlerts, query, sortKey, sortDir, coachFilter, isHead]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gray-900">Coach Roster</h1>
          <p className="font-body text-sm text-gray-500 mt-1">
            {rows.length} athletes · alerts, not medical diagnoses
          </p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-3 py-2 text-xs font-body text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search athletes…"
            className="w-full pl-9 pr-3 py-2 text-[13px] font-body border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
        </div>
        {isHead && coachOptions.length > 0 && (
          <select
            value={coachFilter}
            onChange={e => setCoachFilter(e.target.value)}
            className="px-3 py-2 text-[13px] font-body border border-gray-200 rounded-lg bg-white"
          >
            <option value="all">All coaches</option>
            {coachOptions.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-gray-200 rounded-full animate-spin mx-auto mb-3" style={{ borderTopColor: '#F7C843' }} />
          <p className="font-body text-sm text-gray-500">Loading roster…</p>
        </div>
      ) : error ? (
        <div className="py-16 text-center border border-red-100 bg-red-50 rounded-2xl">
          <p className="font-body text-sm text-red-600">{error}</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-gray-200 rounded-2xl">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-body font-semibold text-gray-500">No athletes found</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] font-body">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="w-8 px-3 py-2.5" />
                  {COLUMNS.map(c => (
                    <th
                      key={c.key}
                      className={`px-3 py-2.5 text-left font-semibold text-gray-500 text-[11px] uppercase tracking-wide cursor-pointer select-none hover:text-gray-700 ${c.align ?? ''}`}
                      onClick={() => c.key && toggleSort(c.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.label}
                        {sortKey === c.key && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </span>
                    </th>
                  ))}
                  {isHead && <th className="px-3 py-2.5 text-left font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Coach</th>}
                  <th className="w-10 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {visible.map(({ row, alerts }) => {
                  const level = worstLevel(alerts);
                  const expanded = expandedId === row.athlete_id;
                  return (
                    <tr
                      key={row.athlete_id}
                      className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer transition-colors"
                      onClick={() => onOpenAthlete(row)}
                    >
                      <td className="px-3 py-2.5">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: LEVEL_COLORS[level] }}
                          title={alerts.length > 0 ? alerts.map(a => a.reason).join('\n') : 'No alerts'}
                        />
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-gray-900">{row.name}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{row.fitness !== null ? Number(row.fitness).toFixed(0) : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{row.fatigue !== null ? Number(row.fatigue).toFixed(0) : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">
                        {row.form !== null ? (Number(row.form) > 0 ? '+' : '') + Number(row.form).toFixed(0) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right" style={{ color: level === 'red' || level === 'amber' ? LEVEL_COLORS[level] : undefined }}>
                        {row.ramp_rate !== null ? Number(row.ramp_rate).toFixed(1) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{row.impulse_7d !== null ? Number(row.impulse_7d).toFixed(1) : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">
                        {row.last_session_date
                          ? new Date(row.last_session_date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
                          : '—'}
                      </td>
                      {isHead && <td className="px-3 py-2.5 text-gray-600">{row.coach_name || '—'}</td>}
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={e => { e.stopPropagation(); setExpandedId(expanded ? null : row.athlete_id); }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {isHead && (
                <tfoot>
                  <tr className="bg-gray-50/80 font-semibold text-gray-700">
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2">Total ({visible.length})</td>
                    {COLUMNS.slice(1, 6).map(c => <td key={c.key} className="px-3 py-2" />)}
                    <td className="px-3 py-2 text-right">
                      {visible.reduce((s, x) => s + (x.row.impulse_7d !== null ? Number(x.row.impulse_7d) : 0), 0).toFixed(0)}
                    </td>
                    <td className="px-3 py-2" />
                    {isHead && <td className="px-3 py-2" />}
                    <td className="px-3 py-2" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {expandedId && (() => {
            const item = withAlerts.find(x => x.row.athlete_id === expandedId);
            if (!item) return null;
            return (
              <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/40">
                <p className="font-body text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Alert reasons</p>
                {item.alerts.length === 0 ? (
                  <p className="font-body text-[12px] text-gray-400">No alerts for this athlete.</p>
                ) : (
                  <ul className="space-y-1">
                    {item.alerts.map((a, i) => (
                      <li key={i} className="font-body text-[12px] text-gray-600 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: LEVEL_COLORS[a.level] }} />
                        {a.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })()}
        </div>
      )}

      <PendingSuggestions rows={rows} athleteNames={athleteNames} />

      <RosterWeeklyStack athleteIds={rows.map(r => r.athlete_id)} athleteNames={athleteNames} />
    </div>
  );
}
