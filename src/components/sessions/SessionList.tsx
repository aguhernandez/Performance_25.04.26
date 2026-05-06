import { useState } from 'react';
import { Trash2, Plus, ChevronDown, ChevronUp, Activity, Dumbbell, MoreHorizontal, Bike, Waves } from 'lucide-react';
import type { Session, Athlete, SessionType } from '../../lib/database.types';
import type { SessionInsert } from '../../lib/database.types';
import { SessionForm } from './SessionForm';
import { SessionFilters, applySessionFilters } from './SessionFilters';
import type { SessionFilterState } from './SessionFilters';

interface SessionListProps {
  sessions: Session[];
  athlete: Athlete;
  onAdd: (session: SessionInsert) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const TYPE_CONFIG: Record<SessionType, { icon: React.ElementType; color: string; label: string }> = {
  endurance: { icon: Activity, color: '#0ea5e9', label: 'Endurance' },
  strength: { icon: Dumbbell, color: '#f97316', label: 'Strength' },
  beach_volleyball: { icon: Waves, color: '#22c55e', label: 'Beach Volleyball' },
  running: { icon: Activity, color: '#a78bfa', label: 'Running' },
  cycling: { icon: Bike, color: '#f59e0b', label: 'Cycling' },
  other: { icon: MoreHorizontal, color: '#94a3b8', label: 'Other' },
};

export function SessionList({ sessions, athlete, onAdd, onDelete }: SessionListProps) {
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<SessionFilterState>({
    search: '',
    type: 'all',
    sortBy: 'date_desc',
    minImpulse: '',
  });

  const filteredSessions = applySessionFilters(sessions, filters);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAdd = async (session: SessionInsert) => {
    await onAdd(session);
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-white">Training Sessions</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">{sessions.length} sessions logged</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-[#070b12] font-semibold text-[12px] px-3 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Log Session
        </button>
      </div>

      <SessionFilters
        filters={filters}
        onChange={setFilters}
        totalCount={sessions.length}
        filteredCount={filteredSessions.length}
      />

      {showForm && (
        <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4">
          <h3 className="text-[13px] font-semibold text-white mb-4">New Session</h3>
          <SessionForm
            athleteId={athlete.id}
            athlete={athlete}
            onSubmit={handleAdd}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      <div className="space-y-2">
        {filteredSessions.map(session => {
          const typeConf = TYPE_CONFIG[session.session_type];
          const Icon = typeConf.icon;
          const expanded = expandedId === session.id;

          return (
            <div
              key={session.id}
              className="bg-[#0d1420] border border-slate-800/60 rounded-xl overflow-hidden hover:border-slate-700/60 transition-colors"
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${typeConf.color}15`, border: `1px solid ${typeConf.color}25` }}
                >
                  <Icon className="w-4 h-4" style={{ color: typeConf.color }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-white truncate">
                      {session.title || `${typeConf.label} Session`}
                    </p>
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ color: typeConf.color, backgroundColor: `${typeConf.color}15` }}
                    >
                      {typeConf.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {new Date(session.session_date).toLocaleDateString('en-US', {
                      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                    })}
                    {session.duration_min > 0 && ` · ${session.duration_min}min`}
                    {session.avg_power_watts && ` · ${session.avg_power_watts}W avg`}
                    {session.avg_hr && ` · ${session.avg_hr}bpm`}
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-600 font-mono uppercase">Impulse</p>
                    <p className="text-[13px] font-bold font-mono text-cyan-400">{session.impulse.toFixed(3)}</p>
                  </div>
                  {session.rpe && (
                    <div className="text-right">
                      <p className="text-[10px] text-slate-600 font-mono uppercase">RPE</p>
                      <p className="text-[13px] font-bold font-mono text-slate-300">{session.rpe}/10</p>
                    </div>
                  )}
                  <button
                    onClick={() => setExpandedId(expanded ? null : session.id)}
                    className="text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(session.id)}
                    disabled={deletingId === session.id}
                    className="text-slate-600 hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="border-t border-slate-800/40 px-4 py-3 bg-slate-800/10">
                  <div className="grid grid-cols-4 gap-3 text-[11px]">
                    {session.normalized_power_watts && (
                      <div>
                        <p className="text-slate-500 font-mono uppercase">NP</p>
                        <p className="text-white font-medium">{session.normalized_power_watts}W</p>
                      </div>
                    )}
                    {session.distance_km && (
                      <div>
                        <p className="text-slate-500 font-mono uppercase">Distance</p>
                        <p className="text-white font-medium">{session.distance_km}km</p>
                      </div>
                    )}
                    {session.elevation_m && (
                      <div>
                        <p className="text-slate-500 font-mono uppercase">Elevation</p>
                        <p className="text-white font-medium">{session.elevation_m}m</p>
                      </div>
                    )}
                    {session.max_hr && (
                      <div>
                        <p className="text-slate-500 font-mono uppercase">Max HR</p>
                        <p className="text-white font-medium">{session.max_hr}bpm</p>
                      </div>
                    )}
                  </div>
                  {session.notes && (
                    <p className="text-[12px] text-slate-400 mt-2 border-t border-slate-800/40 pt-2">{session.notes}</p>
                  )}
                  {session.strength_exercises && Array.isArray(session.strength_exercises) && session.strength_exercises.length > 0 && (
                    <div className="mt-2 border-t border-slate-800/40 pt-2">
                      <p className="text-[10px] text-slate-500 font-mono uppercase mb-1.5">Exercises</p>
                      <div className="space-y-1">
                        {(session.strength_exercises as import('../../lib/database.types').StrengthExercise[]).map((ex, i) => (
                          <div key={i} className="flex items-center gap-3 text-[11px]">
                            <span className="text-slate-300 font-medium min-w-[120px]">{ex.name || `Exercise ${i + 1}`}</span>
                            <span className="text-slate-500">{ex.sets}×{ex.reps} @ {ex.load_kg}kg</span>
                            <span className="text-slate-600">RIR {ex.rir}</span>
                            {ex.bar_velocity_ms && <span className="text-slate-600">{ex.bar_velocity_ms}m/s</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredSessions.length === 0 && !showForm && (
          <div className="text-center py-12 bg-[#0d1420] border border-slate-800/60 rounded-xl">
            <Activity className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            {sessions.length === 0 ? (
              <>
                <p className="text-slate-500 text-[13px]">No sessions logged yet</p>
                <p className="text-slate-600 text-[12px] mt-1">Add your first training session to start modeling performance</p>
              </>
            ) : (
              <>
                <p className="text-slate-500 text-[13px]">No sessions match your filters</p>
                <p className="text-slate-600 text-[12px] mt-1">Try adjusting your search or filter criteria</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
