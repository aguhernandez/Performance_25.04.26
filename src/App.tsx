import { useEffect, useState } from 'react';
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
import { Activity, Zap } from 'lucide-react';

type View = 'dashboard' | 'sessions' | 'lab' | 'nutrition' | 'profile' | 'analytics' | 'hrv' | 'settings';

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

function HubRedirectScreen({ onLogin }: { onLogin: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-amber-50 rounded-full blur-3xl opacity-40" />
        <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-slate-50 rounded-full blur-3xl opacity-40" />
      </div>
      <div className="w-full max-w-sm relative text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="relative">
            <Activity className="w-7 h-7" style={{ color: '#514163' }} />
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: '#fdda36' }} />
          </div>
          <span className="font-heading text-2xl font-bold" style={{ color: '#514163' }}>ASC</span>
          <span className="font-heading text-2xl font-bold" style={{ color: '#fdda36' }}>Impulse</span>
        </div>
        <div className="bg-white border border-[#e5e7eb] rounded-2xl p-8 shadow-sm">
          <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: '#fdda36' }}>
            <Zap className="w-6 h-6" style={{ color: '#514163' }} />
          </div>
          <h2 className="font-heading text-lg font-bold text-gray-900 mb-2">{t('authRequired')}</h2>
          <p className="font-body text-[13px] text-gray-500 mb-6">
            {t('authRedirecting')}
          </p>
          <button
            onClick={onLogin}
            className="btn-primary w-full text-[13px] py-2.5"
          >
            {t('goToHub')}
          </button>
        </div>
        <p className="font-body text-[10px] text-gray-400 mt-4">
          {t('brandTagline')}
        </p>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, profile, loading, hasToken, isDevMode, login, logout, setDevProfile } = useAuth();
  const { t } = useLanguage();
  const [activeView, setActiveView] = useState<View>('dashboard');

  useEffect(() => {
    if (!loading && !user && !hasToken && !isDevMode) {
      login();
    }
  }, [user, loading, hasToken, isDevMode, login]);

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
  } = useAthleteData(user?.id ?? null);

  const engine = useEngine(athlete, sessions, nutritionLogs);

  const {
    hubConnected,
    snapshot: hubSnapshot,
    loading: hubLoading,
    error: hubError,
    refresh: refreshHub,
  } = useHubData(profile?.id);

  if (loading) {
    return <LoadingScreen message={t('verifyingAccess')} />;
  }

  if (isDevMode && !user) {
    return <LocalDevMode onProfileSelected={setDevProfile} />;
  }

  if (!user && !hasToken && !isDevMode) {
    return <HubRedirectScreen onLogin={login} />;
  }

  if (!user && !isDevMode) {
    return <LoadingScreen message={t('initializing')} />;
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
  return <AppContent />;
}
