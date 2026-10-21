import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, ArrowLeft, BarChart3, ClipboardList, FlaskConical, Heart,
  LayoutDashboard, UserRound, Utensils, Zap,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type {
  Athlete, HrvLog, HrvLogInsert, LabTest, LabTestInsert, NutritionLog,
  RaceScheduleEntry, RaceScheduleInsert, Session, SessionInsert,
  TrainingBlock, TrainingBlockInsert, HealthHistoryEntry, HealthHistoryInsert,
} from '../../lib/database.types';
import type { RosterRow } from '../../lib/rosterAlerts';
import { useEngine } from '../../hooks/useEngine';
import { hubWorkoutsToSessions } from '../../lib/hub/hubImport';
import { useAthleteCpModel } from '../../hooks/useAthleteCpModel';
import type { HubSnapshot } from '../../hooks/useHubData';
import { useLanguage } from '../../contexts/LanguageContext';
import { PerformanceView } from '../analytics/performance/PerformanceView';
import { AnalyticsView } from '../analytics/AnalyticsView';
import { DashboardView } from '../dashboard/DashboardView';
import { SessionList } from '../sessions/SessionList';
import { LabView } from '../lab/LabView';
import { NutritionView } from '../nutrition/NutritionView';
import { HrvView } from '../hrv/HrvView';
import { AthleteProfile } from '../athlete/AthleteProfile';
import { SimulatorView } from '../simulator/SimulatorView';
import {
  insertThresholdRow,
  requestRecompute,
  requestFullRecompute,
} from '../../lib/engine/loadPersistence';

type WorkspaceTab = 'dashboard' | 'performance' | 'analytics' | 'sessions' | 'lab' | 'nutrition' | 'hrv' | 'profile' | 'simulator';

/** Full coach workspace for an assigned athlete; uses the same athlete views and tools. */
export function CoachAthletePerformanceView({ row, onBack, coachId, hubConnected, hubSnapshot, hubLoading, hubError, onRefreshHub }: {
  row: RosterRow;
  onBack: () => void;
  coachId: string;
  hubConnected: boolean;
  hubSnapshot: HubSnapshot;
  hubLoading: boolean;
  hubError: string | null;
  onRefreshHub: (athleteEmail: string) => Promise<void>;
}) {
  const { lang } = useLanguage();
  const es = lang === 'es';
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [labTests, setLabTests] = useState<LabTest[]>([]);
  const [nutritionLogs, setNutritionLogs] = useState<NutritionLog[]>([]);
  const [hrvLogs, setHrvLogs] = useState<HrvLog[]>([]);
  const [raceSchedule, setRaceSchedule] = useState<RaceScheduleEntry[]>([]);
  const [trainingBlocks, setTrainingBlocks] = useState<TrainingBlock[]>([]);
  const [healthHistory, setHealthHistory] = useState<HealthHistoryEntry[]>([]);
  const [athleteEmail, setAthleteEmail] = useState('');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hubSyncMessage, setHubSyncMessage] = useState<string | null>(null);
  const refreshRequestedRef = useRef(false);
  const importedForAthleteRef = useRef<string | null>(null);

  useEffect(() => {
    setActiveTab('dashboard');
    refreshRequestedRef.current = false;
    importedForAthleteRef.current = null;
    setHubSyncMessage(null);
  }, [row.athlete_id]);

  const reloadRelatedData = useCallback(async () => {
    const [sessionsRes, labsRes, nutritionRes, hrvRes, racesRes, blocksRes, healthRes, profileRes] = await Promise.all([
      supabase.from('sessions').select('*').eq('athlete_id', row.athlete_id).order('session_date', { ascending: false }).limit(365),
      supabase.from('lab_tests').select('*').eq('athlete_id', row.athlete_id).order('test_date', { ascending: false }),
      supabase.from('nutrition_logs').select('*').eq('athlete_id', row.athlete_id).order('log_date', { ascending: false }).limit(90),
      supabase.from('hrv_logs').select('*').eq('athlete_id', row.athlete_id).order('log_date', { ascending: false }).limit(90),
      supabase.from('race_schedule').select('*').eq('athlete_id', row.athlete_id).order('race_date', { ascending: true }),
      supabase.from('training_blocks').select('*').eq('athlete_id', row.athlete_id).order('start_date', { ascending: false }),
      supabase.from('athlete_health_history').select('*').eq('athlete_id', row.athlete_id).order('event_date', { ascending: false }),
      supabase.from('profiles').select('email').or(`id.eq.${athlete?.user_id ?? ''},hub_user_id.eq.${athlete?.user_id ?? ''}`).maybeSingle(),
    ]);

    const firstError = sessionsRes.error ?? labsRes.error ?? nutritionRes.error ?? hrvRes.error ?? racesRes.error ?? blocksRes.error ?? healthRes.error;
    if (firstError) throw firstError;
    setSessions((sessionsRes.data ?? []) as Session[]);
    setLabTests((labsRes.data ?? []) as LabTest[]);
    setNutritionLogs((nutritionRes.data ?? []) as NutritionLog[]);
    setHrvLogs((hrvRes.data ?? []) as HrvLog[]);
    setRaceSchedule((racesRes.data ?? []) as RaceScheduleEntry[]);
    setTrainingBlocks((blocksRes.data ?? []) as TrainingBlock[]);
    setHealthHistory((healthRes.data ?? []) as HealthHistoryEntry[]);
    setAthleteEmail((profileRes.data as { email?: string } | null)?.email ?? '');
  }, [row.athlete_id, athlete?.user_id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAthlete(null);
    (async () => {
      const { data, error: loadError } = await supabase
        .from('athletes')
        .select('*')
        .eq('id', row.athlete_id)
        .maybeSingle();
      if (cancelled) return;
      if (loadError) throw loadError;
      if (!data) throw new Error('Athlete not found.');
      const selectedAthlete = data as Athlete;
      setAthlete(selectedAthlete);
      const [sessionsRes, labsRes, nutritionRes, hrvRes, racesRes, blocksRes, healthRes, profileRes] = await Promise.all([
        supabase.from('sessions').select('*').eq('athlete_id', row.athlete_id).order('session_date', { ascending: false }).limit(365),
        supabase.from('lab_tests').select('*').eq('athlete_id', row.athlete_id).order('test_date', { ascending: false }),
        supabase.from('nutrition_logs').select('*').eq('athlete_id', row.athlete_id).order('log_date', { ascending: false }).limit(90),
        supabase.from('hrv_logs').select('*').eq('athlete_id', row.athlete_id).order('log_date', { ascending: false }).limit(90),
        supabase.from('race_schedule').select('*').eq('athlete_id', row.athlete_id).order('race_date', { ascending: true }),
        supabase.from('training_blocks').select('*').eq('athlete_id', row.athlete_id).order('start_date', { ascending: false }),
        supabase.from('athlete_health_history').select('*').eq('athlete_id', row.athlete_id).order('event_date', { ascending: false }),
        supabase.from('profiles').select('email').or(`id.eq.${selectedAthlete.user_id},hub_user_id.eq.${selectedAthlete.user_id}`).maybeSingle(),
      ]);
      if (cancelled) return;
      const firstError = sessionsRes.error ?? labsRes.error ?? nutritionRes.error ?? hrvRes.error ?? racesRes.error ?? blocksRes.error ?? healthRes.error;
      if (firstError) throw firstError;
      setSessions((sessionsRes.data ?? []) as Session[]);
      setLabTests((labsRes.data ?? []) as LabTest[]);
      setNutritionLogs((nutritionRes.data ?? []) as NutritionLog[]);
      setHrvLogs((hrvRes.data ?? []) as HrvLog[]);
      setRaceSchedule((racesRes.data ?? []) as RaceScheduleEntry[]);
      setTrainingBlocks((blocksRes.data ?? []) as TrainingBlock[]);
      setHealthHistory((healthRes.data ?? []) as HealthHistoryEntry[]);
      setAthleteEmail((profileRes.data as { email?: string } | null)?.email ?? '');
      setLoading(false);
    })().catch(err => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Could not load this athlete.');
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [row.athlete_id]);

  const addSessions = useCallback(async (items: SessionInsert[]) => {
    if (items.length) {
      const { error: insertError } = await supabase.from('sessions').insert(items);
      if (insertError) throw insertError;
    }
    await reloadRelatedData();
    if (athlete && items.length) {
      const firstDate = items.reduce((min, item) => item.session_date < min ? item.session_date : min, items[0].session_date);
      requestRecompute(athlete, firstDate, { onError: err => console.error('session recompute failed', err) });
    }
  }, [athlete, reloadRelatedData]);

  useEffect(() => {
    if (!athleteEmail || !hubConnected || refreshRequestedRef.current) return;
    refreshRequestedRef.current = true;
    setHubSyncMessage(es ? 'Sincronizando entrenamientos del Hub…' : 'Syncing Hub training…');
    void onRefreshHub(athleteEmail);
  }, [athleteEmail, hubConnected, onRefreshHub, es]);

  useEffect(() => {
    const schedule = hubSnapshot.trainingSchedule;
    const hubProfileEmail = hubSnapshot.athleteProfile?.athlete.email;
    if (!athlete || !athleteEmail || hubProfileEmail !== athleteEmail || !schedule || importedForAthleteRef.current === athlete.id) return;

    const existingIds = new Set(
      sessions.map(session => {
        const raw = session.raw_data;
        return raw && typeof raw.hub_workout_id === 'string' ? raw.hub_workout_id : null;
      }).filter((id): id is string => id !== null)
    );
    const newWorkouts = schedule.workouts.filter(workout =>
      (workout.status === 'completed' || workout.status === 'done' || workout.actual_duration_minutes !== null) &&
      !existingIds.has(workout.id)
    );

    importedForAthleteRef.current = athlete.id;
    if (newWorkouts.length === 0) {
      setHubSyncMessage(es ? 'Entrenamientos del Hub ya sincronizados.' : 'Hub training is already synchronized.');
      return;
    }

    const importedSessions = hubWorkoutsToSessions(newWorkouts, athlete.id);
    void addSessions(importedSessions)
      .then(() => setHubSyncMessage(es ? `${newWorkouts.length} entrenamientos del Hub añadidos a las sesiones.` : `${newWorkouts.length} Hub workouts added to sessions.`))
      .catch(() => {
        importedForAthleteRef.current = null;
        setHubSyncMessage(es ? 'No se pudieron sincronizar los entrenamientos del Hub.' : 'Hub training could not be synchronized.');
      });
  }, [athlete, athleteEmail, hubConnected, hubSnapshot, sessions, addSessions, es]);

  const cpData = useAthleteCpModel(athlete);
  const cpModelOverride = cpData.cpModel?.status === 'ok'
    ? { cpWatts: cpData.cpModel.cp, confidence: cpData.cpModel.confidence }
    : undefined;
  const engine = useEngine(athlete, sessions, { cpModel: cpModelOverride });

  const handleUpdate = useCallback(async (rawUpdates: Partial<Athlete> & { effective_from_override?: string }) => {
    if (!athlete) return;
    const { effective_from_override: effectiveFromOverride, ...updates } = rawUpdates;
    const thresholdFieldsChanged =
      (updates.cp_watts !== undefined && updates.cp_watts !== athlete.cp_watts) ||
      (updates.ftp_watts !== undefined && updates.ftp_watts !== athlete.ftp_watts) ||
      (updates.hr_lt2_bpm !== undefined && updates.hr_lt2_bpm !== athlete.hr_lt2_bpm) ||
      (updates.threshold_speed_kmh !== undefined && updates.threshold_speed_kmh !== athlete.threshold_speed_kmh);
    const tauChanged =
      (updates.tau_fitness !== undefined && updates.tau_fitness !== athlete.tau_fitness) ||
      (updates.tau_fatigue !== undefined && updates.tau_fatigue !== athlete.tau_fatigue);
    const { error: updateError } = await supabase
      .from('athletes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', athlete.id);
    if (updateError) throw updateError;
    const updated = { ...athlete, ...updates } as Athlete;
    setAthlete(updated);
    if (thresholdFieldsChanged) {
      const effectiveDate = effectiveFromOverride ?? new Date().toISOString().split('T')[0];
      await insertThresholdRow(updated, effectiveDate, 'profile');
      requestRecompute(updated, effectiveDate, { onError: err => console.error('delta recompute failed', err) });
    } else if (tauChanged) {
      const confirmed = window.confirm('This recalculates the full history because tau affects every training day. Continue?');
      if (confirmed) requestFullRecompute(updated, { onError: err => console.error('full recompute failed', err) });
    }
  }, [athlete]);

  const handlePerformanceUpdate = useCallback((updates: Record<string, number | null>) =>
    handleUpdate(updates as Partial<Athlete>), [handleUpdate]);

  const addSession = useCallback(async (session: SessionInsert) => {
    const { data, error: insertError } = await supabase.from('sessions').insert(session).select().single();
    if (insertError) throw insertError;
    await reloadRelatedData();
    if (athlete && data?.session_date) requestRecompute(athlete, data.session_date, { onError: err => console.error('session recompute failed', err) });
  }, [athlete, reloadRelatedData]);

  const deleteSession = useCallback(async (id: string) => {
    const { data: existing } = await supabase.from('sessions').select('session_date').eq('id', id).maybeSingle();
    const { error: deleteError } = await supabase.from('sessions').delete().eq('id', id);
    if (deleteError) throw deleteError;
    await reloadRelatedData();
    if (athlete) requestRecompute(athlete, existing?.session_date ?? null, { onError: err => console.error('session recompute failed', err) });
  }, [athlete, reloadRelatedData]);

  const addLabTest = useCallback(async (test: LabTestInsert) => {
    const { error: insertError } = await supabase.from('lab_tests').insert(test);
    if (insertError) throw insertError;
    await reloadRelatedData();
  }, [reloadRelatedData]);

  const addHrvLog = useCallback(async (log: HrvLogInsert) => {
    const { error: insertError } = await supabase.from('hrv_logs').insert(log);
    if (insertError) throw insertError;
    await reloadRelatedData();
  }, [reloadRelatedData]);

  const deleteHrvLog = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase.from('hrv_logs').delete().eq('id', id);
    if (deleteError) throw deleteError;
    await reloadRelatedData();
  }, [reloadRelatedData]);

  const addRace = useCallback(async (race: RaceScheduleInsert) => {
    const { error: insertError } = await supabase.from('race_schedule').insert(race);
    if (insertError) throw insertError;
    await reloadRelatedData();
  }, [reloadRelatedData]);

  const updateRace = useCallback(async (id: string, updates: Partial<RaceScheduleEntry>) => {
    const { error: updateError } = await supabase.from('race_schedule').update(updates).eq('id', id);
    if (updateError) throw updateError;
    await reloadRelatedData();
  }, [reloadRelatedData]);

  const deleteRace = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase.from('race_schedule').delete().eq('id', id);
    if (deleteError) throw deleteError;
    await reloadRelatedData();
  }, [reloadRelatedData]);

  const addTrainingBlock = useCallback(async (block: TrainingBlockInsert) => {
    const { error: insertError } = await supabase.from('training_blocks').insert(block);
    if (insertError) throw insertError;
    await reloadRelatedData();
  }, [reloadRelatedData]);

  const deleteTrainingBlock = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase.from('training_blocks').delete().eq('id', id);
    if (deleteError) throw deleteError;
    await reloadRelatedData();
  }, [reloadRelatedData]);

  const addHealthEvent = useCallback(async (event: HealthHistoryInsert) => {
    const { error: insertError } = await supabase.from('athlete_health_history').insert(event);
    if (insertError) throw insertError;
    await reloadRelatedData();
  }, [reloadRelatedData]);

  const deleteHealthEvent = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase.from('athlete_health_history').delete().eq('id', id);
    if (deleteError) throw deleteError;
    await reloadRelatedData();
  }, [reloadRelatedData]);

  const addNutrition = useCallback(() => { void reloadRelatedData(); }, [reloadRelatedData]);

  const handleWorkspaceTabChange = (tab: WorkspaceTab) => {
    setActiveTab(tab);
  };

  const tabs: { id: WorkspaceTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: es ? 'Resumen' : 'Dashboard', icon: LayoutDashboard },
    { id: 'performance', label: es ? 'Rendimiento' : 'Performance', icon: Activity },
    { id: 'analytics', label: es ? 'Analítica' : 'Analytics', icon: BarChart3 },
    { id: 'sessions', label: es ? 'Sesiones' : 'Sessions', icon: ClipboardList },
    { id: 'lab', label: es ? 'Laboratorio' : 'Lab', icon: FlaskConical },
    { id: 'nutrition', label: es ? 'Nutrición' : 'Nutrition', icon: Utensils },
    { id: 'hrv', label: 'HRV', icon: Heart },
    { id: 'profile', label: es ? 'Perfil del atleta' : 'Athlete Profile', icon: UserRound },
    { id: 'simulator', label: es ? 'Simulador' : 'Simulator', icon: Zap },
  ];

  if (loading) {
    return <WorkspaceMessage onBack={onBack} message={es ? 'Cargando datos del atleta…' : 'Loading athlete data…'} isSpanish={es} />;
  }
  if (error || !athlete) {
    return <WorkspaceMessage onBack={onBack} message={error ?? (es ? 'No se encontró el atleta.' : 'Athlete not found.')} isError isSpanish={es} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button onClick={onBack} className="mb-3 flex items-center gap-2 font-body text-[12px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> {es ? 'Volver a la lista' : 'Back to roster'}
          </button>
          <h1 className="font-heading text-2xl font-bold text-gray-900 dark:text-white">{athlete.name}</h1>
          <p className="font-body text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">{athlete.sport || row.sport || 'Athlete'} · {es ? 'espacio de entrenador' : 'coach workspace'}</p>
        </div>
        {cpData.loading && <span className="font-body text-[11px] text-gray-400">{es ? 'Cargando datos de potencia…' : 'Loading power data…'}</span>}
      </div>

      <nav aria-label={es ? 'Espacio del atleta' : 'Athlete workspace'} className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700 pb-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={activeTab === id}
            aria-current={activeTab === id ? 'page' : undefined}
            onClick={() => handleWorkspaceTabChange(id)}
            className={`flex shrink-0 items-center gap-2 rounded-t-lg px-3 py-2.5 font-body text-[12px] font-medium transition-all duration-150 ${activeTab === id ? 'border-b-2 border-[#F7C843] bg-[#F7C843]/15 text-[#2A1F4A] dark:text-[#F7C843]' : 'border-b-2 border-transparent text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}
          >
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
        <span className="h-1.5 w-1.5 rounded-full bg-[#F7C843]" />
        {es ? 'Vista activa' : 'Active view'}: {tabs.find(tab => tab.id === activeTab)?.label}
      </div>

      <div key={activeTab}>
      {activeTab === 'dashboard' && engine && (
        <DashboardView
          engine={engine}
          athlete={athlete}
          sessions={sessions}
          nutritionLogs={nutritionLogs}
          userId={coachId}
          hubConnected={hubConnected}
          hubSnapshot={hubSnapshot}
          hubLoading={hubLoading}
          hubError={hubError}
          athleteEmail={athleteEmail || null}
          onRefreshHub={() => { if (athleteEmail) void onRefreshHub(athleteEmail); }}
        />
      )}
      {activeTab === 'dashboard' && hubSyncMessage && (
        <p className="mt-3 font-body text-[11px] text-gray-500 dark:text-gray-400">{hubSyncMessage}</p>
      )}
      {activeTab === 'dashboard' && !engine && <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Performance model is not available yet.</div>}
      {activeTab === 'performance' && <PerformanceView athlete={athlete} coachAssigned onUpdateAthlete={handlePerformanceUpdate} />}
      {activeTab === 'analytics' && <AnalyticsView sessions={sessions} athlete={athlete} labTests={labTests} engine={engine} cpData={cpData} coachAssigned onUpdateAthlete={handlePerformanceUpdate} />}
      {activeTab === 'sessions' && <SessionList sessions={sessions} athlete={athlete} onAdd={addSession} onDelete={deleteSession} />}
      {activeTab === 'lab' && <LabView labTests={labTests} athlete={athlete} onAdd={addLabTest} />}
      {activeTab === 'nutrition' && <NutritionView logs={nutritionLogs} athlete={athlete} onAdd={addNutrition} />}
      {activeTab === 'hrv' && <HrvView hrvLogs={hrvLogs} athlete={athlete} onAdd={addHrvLog} onDelete={deleteHrvLog} />}
      {activeTab === 'profile' && (
        <AthleteProfile
          athlete={athlete}
          userId={athlete.user_id}
          onSave={async () => { throw new Error('Athlete profile is already created.'); }}
          onUpdate={handleUpdate}
          sessions={sessions}
          raceSchedule={raceSchedule}
          trainingBlocks={trainingBlocks}
          healthHistory={healthHistory}
          onAddRace={addRace}
          onUpdateRace={updateRace}
          onDeleteRace={deleteRace}
          onAddBlock={addTrainingBlock}
          onDeleteBlock={deleteTrainingBlock}
          onAddHealthEvent={addHealthEvent}
          onDeleteHealthEvent={deleteHealthEvent}
          onAddSession={addSessions}
        />
      )}
      {activeTab === 'simulator' && <SimulatorView athlete={athlete} sessions={sessions} athleteEmail={athleteEmail} />}
      </div>
    </div>
  );
}

function WorkspaceMessage({ onBack, message, isError = false, isSpanish = false }: { onBack: () => void; message: string; isError?: boolean; isSpanish?: boolean }) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 font-body text-[13px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white">
        <ArrowLeft className="w-4 h-4" /> {isSpanish ? 'Volver a la lista' : 'Back to roster'}
      </button>
      <div className={`rounded-2xl border bg-white p-10 text-center font-body text-[13px] dark:bg-gray-900 ${isError ? 'border-red-200 text-red-600' : 'border-gray-200 text-gray-400'}`}>
        {message}
      </div>
    </div>
  );
}
