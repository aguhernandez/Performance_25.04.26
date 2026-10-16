import { useMemo, useState, useEffect, useRef } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useLanguage } from './contexts/LanguageContext';
import LocalDevMode from './components/dev/LocalDevMode';
import { useAthleteData } from './hooks/useAthleteData';
import { useEngine } from './hooks/useEngine';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { SessionList } from './components/sessions/SessionList';
import { LabView } from './components/lab/LabView';
import { NutritionView } from './components/nutrition/NutritionView';
import { AthleteProfile } from './components/athlete/AthleteProfile';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import { HrvView } from './components/hrv/HrvView';
import { SettingsView } from './components/settings/SettingsView';
import { useHubData } from './hooks/useHubData';
import { useAthleteCpModel } from './hooks/useAthleteCpModel';
import { useCoachAssignment } from './hooks/useCoachAssignment';
import type { ThresholdOverrides } from './lib/engine/impulse';
import { LandingPage } from './components/landing/LandingPage';
import { UnderConstructionModal } from './components/UnderConstructionModal';
import { CoachView } from './components/coach/CoachView';
import { CoachRosterView } from './components/coach/CoachRosterView';
import { CoachAthletePerformanceView } from './components/coach/CoachAthletePerformanceView';
import type { RosterRow } from './lib/rosterAlerts';
import { SimulatorView } from './components/simulator/SimulatorView';
import { Activity } from 'lucide-react';

type View = 'dashboard' | 'sessions' | 'lab' | 'nutrition' | 'profile' | 'analytics' | 'hrv' | 'settings' | 'simulator';

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <Activity className="w-10 h-10" style={{ color: '#514163' }} />
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: '#fdda36' }} />
        </div>
        <div className="w-8 h-8 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: '#fdda36' }} />
        <p className="font-body text-[13px] text-gray-500">{message}</p>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, profile, loading, hasToken, isDevMode, login, logout, setDevProfile } = useAuth();
  const { t } = useLanguage();
  const [activeView, setActiveView] = useState<View>('dashboard');

  // Hash deep-links (e.g. #/sessions?activity=…) open the target view on load.
  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      const view = hash.split('?')[0] as View;
      if (['dashboard', 'sessions', 'lab', 'nutrition', 'profile', 'analytics', 'hrv', 'settings', 'simulator'].includes(view)) {
        setActiveView(view);
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  // Hub passport + CP-model thresholds live in a ref so the data hook reads
  // the latest values at mutation time regardless of render order.
  const [passportLt2Hr, setPassportLt2Hr] = useState<number | null>(null);
  const [passportThresholdSpeed, setPassportThresholdSpeed] = useState<number | null>(null);
  const thresholdOverridesRef = useRef<ThresholdOverrides>({});

  const passportOverrides = useMemo<ThresholdOverrides>(
    () => ({
      passport: { lt2Hr: passportLt2Hr, thresholdSpeedKmh: passportThresholdSpeed },
    }),
    [passportLt2Hr, passportThresholdSpeed]
  );

  const {
    athlete,
    sessions,
    labTests,
    nutritionLogs,
    hrvLogs,
    raceSchedule,
    trainingBlocks,
    healthHistory,
    loading: dataLoading,
    createAthlete,
    updateAthlete,
    addSession,
    addSessions,
    deleteSession,
    addLabTest,
    addHrvLog,
    deleteHrvLog,
    addTrainingBlock,
    deleteTrainingBlock,
    addRace,
    updateRace,
    deleteRace,
    addHealthEvent,
    deleteHealthEvent,
    refetch,
  } = useAthleteData(user?.id ?? null, thresholdOverridesRef);

  const cpData = useAthleteCpModel(athlete);

  const cpModelOverride =
    cpData.cpModel && cpData.cpModel.status === 'ok'
      ? { cpWatts: cpData.cpModel.cp, confidence: cpData.cpModel.confidence }
      : undefined;

  const thresholdOverridesWithCp = useMemo<ThresholdOverrides>(
    () => ({ ...passportOverrides, cpModel: cpModelOverride }),
    [passportOverrides, cpModelOverride?.cpWatts, cpModelOverride?.confidence]
  );
  thresholdOverridesRef.current = thresholdOverridesWithCp;

  const engine = useEngine(athlete, sessions, { cpModel: cpModelOverride });

  // Athlete home: thresholds/tau are read-only when a coach is assigned.
  const coachAssigned = useCoachAssignment(user?.id ?? null);

  const {
    hubConnected,
    snapshot: hubSnapshot,
    loading: hubLoading,
    error: hubError,
    refresh: refreshHub,
  } = useHubData(profile?.id);

  // Pull threshold values from the active Hub passport when it loads
  const passport = hubSnapshot.biologicalPassport?.active_passport ?? null;
  const passportEmail = hubSnapshot.athleteProfile?.athlete?.email ?? null;
  useEffect(() => {
    if (!passport) {
      setPassportLt2Hr(null);
      setPassportThresholdSpeed(null);
      return;
    }
    setPassportLt2Hr(passport.lt2_hr ?? null);
    // The Hub passport does not expose threshold speed; VT2 speed is not
    // available from this endpoint, so it stays on the profile/fallback chain.
    setPassportThresholdSpeed(null);
  }, [passport, passportEmail]);

  if (loading) {
    return <LoadingScreen message={t('verifyingAccess')} />;
  }

  if (isDevMode && !user) {
    return <LocalDevMode onProfileSelected={setDevProfile} />;
  }

  if (!user && !hasToken && !isDevMode) {
    return <LandingPage onLogin={login} />;
  }

  if (!user && !isDevMode) {
    return <LoadingScreen message={t('initializing')} />;
  }

  // Coach / head coach role — bypass athlete data flow and show coach dashboard.
  // The roster is the coach home; clicking a row opens that athlete's
  // Performance view in read-with-edit mode. Head coach sees the same roster
  // with an extra coach column + filter and totals row, read-only editing.
  const isCoachRole = profile?.role === 'coach' || profile?.role === 'head_coach' || profile?.role === 'admin';
  const [rosterAthlete, setRosterAthlete] = useState<RosterRow | null>(null);

  if (isCoachRole) {
    const role = profile?.role ?? 'coach';
    return (
      <div className="min-h-screen bg-white">
        <Header athlete={null} onSignOut={logout} />
        <Sidebar activeView={activeView} onViewChange={setActiveView} role="coach" />
        <main className="pt-16 lg:pl-20 min-h-screen w-full">
          <div className="p-6 w-full max-w-[1400px]">
            {activeView === 'settings' ? (
              <SettingsView />
            ) : rosterAthlete ? (
              <CoachAthletePerformanceView
                row={rosterAthlete}
                onBack={() => setRosterAthlete(null)}
              />
            ) : (
              <CoachRosterView
                role={role}
                onOpenAthlete={setRosterAthlete}
                athleteNames={{}}
              />
            )}
          </div>
        </main>
      </div>
    );
  }

  if (dataLoading) {
    return <LoadingScreen message={t('loadingAthlete')} />;
  }

  if (!athlete && activeView !== 'profile' && activeView !== 'settings') {
    return (
      <OnboardingWizard
        userId={user?.id ?? ''}
        onComplete={createAthlete}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header athlete={athlete} onSignOut={logout} />
      <Sidebar activeView={activeView} onViewChange={setActiveView} />

      <main className="pt-16 lg:pt-0 lg:pl-20 min-h-screen w-full">
        <div className="p-6 w-full max-w-[1400px]">
          {activeView === 'dashboard' && athlete && (
            <DashboardView
              engine={engine}
              athlete={athlete}
              sessions={sessions}
              nutritionLogs={nutritionLogs}
              userId={user?.id ?? ''}
              hubConnected={hubConnected}
              hubSnapshot={hubSnapshot}
              hubLoading={hubLoading}
              hubError={hubError}
              athleteEmail={user?.email ?? null}
              onRefreshHub={() => user?.email && refreshHub(user.email)}
            />
          )}

          {activeView === 'sessions' && athlete && (
            <SessionList
              sessions={sessions}
              athlete={athlete}
              onAdd={addSession}
              onDelete={deleteSession}
            />
          )}

          {activeView === 'lab' && athlete && (
            <LabView
              labTests={labTests}
              athlete={athlete}
              onAdd={addLabTest}
            />
          )}

          {activeView === 'nutrition' && athlete && (
            <NutritionView
              logs={nutritionLogs}
              athlete={athlete}
              onAdd={refetch}
            />
          )}

          {activeView === 'analytics' && athlete && (
            <AnalyticsView
              sessions={sessions}
              athlete={athlete}
              labTests={labTests}
              engine={engine}
              cpData={cpData}
              coachAssigned={coachAssigned}
              onUpdateAthlete={updateAthlete}
            />
          )}

          {activeView === 'hrv' && athlete && (
            <HrvView
              hrvLogs={hrvLogs}
              athlete={athlete}
              onAdd={addHrvLog}
              onDelete={deleteHrvLog}
            />
          )}

          {activeView === 'simulator' && athlete && (
            <SimulatorView athlete={athlete} sessions={sessions} athleteEmail={user?.email ?? ''} />
          )}

          {activeView === 'settings' && (
            <SettingsView />
          )}

          {activeView === 'profile' && (
            <AthleteProfile
              athlete={athlete}
              userId={user?.id ?? ''}
              onSave={createAthlete}
              onUpdate={updateAthlete}
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
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <>
      <UnderConstructionModal />
      <AppContent />
    </>
  );
}
