import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Athlete } from '../../lib/database.types';
import { PerformanceView } from '../analytics/performance/PerformanceView';
import type { RosterRow } from '../../lib/rosterAlerts';
import {
  insertThresholdRow,
  requestRecompute,
  requestFullRecompute,
} from '../../lib/engine/loadPersistence';

/**
 * Coach-facing read-with-edit view of one athlete's Performance page,
 * opened from a roster row click. Reuses the athlete PerformanceView with
 * coach edit rights (thresholds + tau); edit path follows the athlete flow
 * (threshold history row + delta recompute; tau confirm + full recompute).
 */
export function CoachAthletePerformanceView({ row, onBack }: {
  row: RosterRow;
  onBack: () => void;
}) {
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAthlete(null);
    setError(null);
    (async () => {
      const { data, error: err } = await supabase
        .from('athletes')
        .select('*')
        .eq('id', row.athlete_id)
        .maybeSingle();
      if (cancelled) return;
      if (err) setError('Could not load this athlete.');
      else if (!data) setError('Athlete not found.');
      else setAthlete(data as Athlete);
    })();
    return () => { cancelled = true; };
  }, [row.athlete_id]);

  const handleUpdate = useMemo(() => {
    return async (updates: Record<string, number | null>) => {
      if (!athlete) return;
      const prev = athlete;
      const thresholdFieldsChanged =
        (updates.cp_watts !== undefined && updates.cp_watts !== prev.cp_watts) ||
        (updates.ftp_watts !== undefined && updates.ftp_watts !== prev.ftp_watts) ||
        (updates.hr_lt2_bpm !== undefined && updates.hr_lt2_bpm !== prev.hr_lt2_bpm) ||
        (updates.threshold_speed_kmh !== undefined && updates.threshold_speed_kmh !== prev.threshold_speed_kmh);
      const tauChanged =
        (updates.tau_fitness !== undefined && updates.tau_fitness !== prev.tau_fitness) ||
        (updates.tau_fatigue !== undefined && updates.tau_fatigue !== prev.tau_fatigue);

      const { error: err } = await supabase
        .from('athletes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', prev.id);
      if (err) throw err;

      const updated = { ...prev, ...updates } as Athlete;
      setAthlete(updated);

      if (thresholdFieldsChanged) {
        await insertThresholdRow(updated, new Date().toISOString().split('T')[0], 'profile');
        requestRecompute(updated, new Date().toISOString().split('T')[0], {
          onError: e => console.error('delta recompute failed', e),
        });
      } else if (tauChanged) {
        const confirmed = window.confirm(
          'This recalculates the full history: tau affects the whole training series, so every day from the first session onward will be recomputed.'
        );
        if (!confirmed) return;
        requestFullRecompute(updated, {
          onError: e => console.error('full recompute failed', e),
        });
      }
    };
  }, [athlete]);

  if (error) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-2 font-body text-[13px] text-gray-500 hover:text-gray-800">
          <ArrowLeft className="w-4 h-4" /> Back to roster
        </button>
        <div className="bg-white border border-red-200 rounded-2xl p-8 text-center font-body text-[13px] text-red-600">{error}</div>
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-2 font-body text-[13px] text-gray-500 hover:text-gray-800">
          <ArrowLeft className="w-4 h-4" /> Back to roster
        </button>
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center font-body text-[13px] text-gray-400">
          Loading athlete…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 font-body text-[13px] text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to roster
      </button>
      <div>
        <h1 className="font-heading text-2xl font-bold text-gray-900">{row.name}</h1>
        <p className="font-body text-[13px] text-gray-500 mt-0.5">
          {row.sport || 'Athlete'} · coach view — you can adjust thresholds and tau
        </p>
      </div>
      <PerformanceView athlete={athlete} coachAssigned={true} onUpdateAthlete={handleUpdate} />
    </div>
  );
}
