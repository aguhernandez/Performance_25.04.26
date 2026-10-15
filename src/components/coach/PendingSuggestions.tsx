import { Check, Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Athlete } from '../../lib/database.types';
import type { RosterRow } from '../../lib/rosterAlerts';
import { insertThresholdRow, requestRecompute } from '../../lib/engine/loadPersistence';

/**
 * Pending threshold suggestions: athletes whose stream-based model CP
 * differs from the stored profile CP by > 5% (or none stored). Apply writes
 * the suggested value to athletes.cp_watts; the existing recompute flow
 * picks it up from there.
 */
export function PendingSuggestions({ rows, athleteNames }: {
  rows: RosterRow[];
  athleteNames: Record<string, string>;
}) {
  const [applying, setApplying] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const pending = rows.filter(
    r => r.cp_suggestion_pending && r.suggested_cp !== null && !applied.has(r.athlete_id)
  );

  if (pending.length === 0) return null;

  const apply = async (row: RosterRow) => {
    setApplying(row.athlete_id);
    try {
      const { data: athlete, error } = await supabase
        .from('athletes')
        .update({ cp_watts: Math.round(Number(row.suggested_cp)) })
        .eq('id', row.athlete_id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (athlete) {
        // Same path as a manual threshold edit: new threshold history row,
        // then a coalesced delta recompute from today forward.
        const today = new Date().toISOString().split('T')[0];
        await insertThresholdRow(athlete as Athlete, today, 'model');
        requestRecompute(athlete as Athlete, today, {
          onError: e => console.error('recompute after CP suggestion failed', e),
        });
      }
      setApplied(prev => new Set(prev).add(row.athlete_id));
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-amber-500" />
        <h3 className="font-heading text-[14px] font-bold text-gray-900">Pending threshold suggestions</h3>
        <span className="text-[10px] text-gray-400 italic">alerts, not medical diagnoses</span>
      </div>
      <ul className="space-y-2">
        {pending.map(row => (
          <li
            key={row.athlete_id}
            className="flex items-center justify-between gap-3 bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2"
          >
            <div>
              <p className="font-body text-[13px] font-semibold text-gray-800">
                {athleteNames[row.athlete_id] ?? row.name}
              </p>
              <p className="font-body text-[11px] text-gray-500">
                Model CP {Math.round(Number(row.suggested_cp))} W
                {row.cp_watts || row.ftp_watts
                  ? ` · profile ${Math.round(Number(row.cp_watts ?? row.ftp_watts))} W`
                  : ' · no CP stored'}
              </p>
            </div>
            <button
              onClick={() => apply(row)}
              disabled={applying === row.athlete_id}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              {applying === row.athlete_id ? 'Applying…' : 'Apply'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
