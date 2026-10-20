import { useState } from 'react';
import { ArrowLeft, Users, Activity, TrendingUp, Heart, Zap, Calendar, ChevronRight, RefreshCw, CircleUser as UserCircle } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useCoachAthletes, type AthleteWithData } from '../../hooks/useCoachAthletes';
import { useEngine } from '../../hooks/useEngine';
import { useAthleteCpModel } from '../../hooks/useAthleteCpModel';
import { DashboardView } from '../dashboard/DashboardView';
import { SessionList } from '../sessions/SessionList';
import { AnalyticsView } from '../analytics/AnalyticsView';
import { HrvView } from '../hrv/HrvView';
import type { HubSnapshot } from '../../hooks/useHubData';

type AthleteView = 'dashboard' | 'sessions' | 'analytics' | 'hrv';

const EMPTY_HUB_SNAPSHOT: HubSnapshot = {
  athleteProfile: null,
  biologicalPassport: null,
  trainingSchedule: null,
  nutritionData: null,
  wellness: null,
  anthropometry: null,
  habits: null,
  enduranceData: null,
  foodDiary: null,
};

interface AthleteDetailProps {
  athleteData: AthleteWithData;
  onBack: () => void;
}

function AthleteDetail({ athleteData, onBack }: AthleteDetailProps) {
  const { t, lang } = useLanguage();
  const [activeView, setActiveView] = useState<AthleteView>('dashboard');
  const engine = useEngine(
    athleteData.hasLocalProfile ? athleteData.athlete : null,
    athleteData.sessions
  );
  const cpData = useAthleteCpModel(athleteData.hasLocalProfile ? athleteData.athlete : null);

  const tabs: { view: AthleteView; label: string }[] = [
    { view: 'dashboard', label: t('dashboard') },
    { view: 'sessions', label: t('sessions') },
    { view: 'analytics', label: t('analytics') },
    { view: 'hrv', label: t('hrv') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-body text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('backToAthletes')}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 flex items-center gap-6">
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0" style={{ backgroundColor: '#F7C843', color: '#2A1F4A' }}>
          {athleteData.athlete.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="font-heading font-bold text-gray-900 dark:text-white text-xl">{athleteData.athlete.name}</h2>
          <p className="font-body text-sm text-gray-400 capitalize">
            {athleteData.athlete.sport} · {athleteData.sessions.length} {t('sessionCount').toLowerCase()}
            {!athleteData.hasLocalProfile && (
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#2A1F4A]/5 dark:bg-[#B8A9E5]/10 text-[#2A1F4A] dark:text-[#B8A9E5] border border-[#2A1F4A]/20 dark:border-[#B8A9E5]/30">
                Hub
              </span>
            )}
          </p>
        </div>
        <div className="ml-auto flex gap-6 text-center">
          <div>
            <p className="font-body text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest">VO2max</p>
            <p className="font-body text-lg font-bold text-gray-900 dark:text-white">{athleteData.athlete.vo2max ?? '—'}</p>
          </div>
          <div>
            <p className="font-body text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest">CP</p>
            <p className="font-body text-lg font-bold text-gray-900 dark:text-white">{athleteData.athlete.cp_watts ?? '—'}W</p>
          </div>
          <div>
            <p className="font-body text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest">FTP</p>
            <p className="font-body text-lg font-bold text-gray-900 dark:text-white">{athleteData.athlete.ftp_watts ?? '—'}W</p>
          </div>
        </div>
      </div>

      {!athleteData.hasLocalProfile && (
        <div className="bg-[#2A1F4A]/5 dark:bg-[#B8A9E5]/10 border border-[#2A1F4A]/20 dark:border-[#B8A9E5]/30 rounded-xl p-4 flex items-start gap-3">
          <UserCircle className="w-5 h-5 text-[#2A1F4A] dark:text-[#B8A9E5] shrink-0 mt-0.5" />
          <div>
            <p className="font-body text-sm font-medium text-[#2A1F4A] dark:text-[#B8A9E5]">
              {lang === 'es'
                ? 'Este atleta aún no ha ingresado a Performance Vector'
                : 'This athlete has not yet logged into Performance Vector'}
            </p>
            <p className="font-body text-xs text-[#2A1F4A] dark:text-[#B8A9E5] mt-0.5">
              {lang === 'es'
                ? 'Los datos de entrenamiento se mostrarán cuando el atleta inicie sesión y complete su perfil.'
                : 'Training data will appear once the athlete logs in and completes their profile.'}
            </p>
          </div>
        </div>
      )}

      {athleteData.hasLocalProfile && (
        <>
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
            {tabs.map(tab => (
              <button
                key={tab.view}
                onClick={() => setActiveView(tab.view)}
                className={`px-4 py-2 text-sm font-body font-medium transition-colors border-b-2 -mb-px ${
                  activeView === tab.view
                    ? 'border-[#2A1F4A] text-[#2A1F4A]'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div>
            {activeView === 'dashboard' && engine && (
              <DashboardView
                engine={engine}
                athlete={athleteData.athlete}
                sessions={athleteData.sessions}
                nutritionLogs={[]}
                userId={athleteData.athlete.user_id ?? ''}
                hubConnected={false}
                hubSnapshot={EMPTY_HUB_SNAPSHOT}
                hubLoading={false}
                hubError={null}
                athleteEmail={null}
                onRefreshHub={() => {}}
              />
            )}
            {activeView === 'sessions' && (
              <SessionList
                sessions={athleteData.sessions}
                athlete={athleteData.athlete}
                onAdd={async () => {}}
                onDelete={async () => {}}
              />
            )}
            {activeView === 'analytics' && engine && (
              <AnalyticsView
                sessions={athleteData.sessions}
                athlete={athleteData.athlete}
                labTests={athleteData.labTests}
                engine={engine}
                cpData={cpData}
              />
            )}
            {activeView === 'hrv' && (
              <HrvView
                hrvLogs={athleteData.hrvLogs}
                athlete={athleteData.athlete}
                onAdd={async () => {}}
                onDelete={async () => {}}
              />
            )}
            {activeView === 'dashboard' && !engine && (
              <div className="py-20 text-center text-gray-400 font-body text-sm">
                {t('noEngineData')}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface AthleteCardProps {
  athleteData: AthleteWithData;
  onClick: () => void;
}

function AthleteCard({ athleteData, onClick }: AthleteCardProps) {
  const { t } = useLanguage();
  const { athlete, sessions, latestSession, hasLocalProfile } = athleteData;
  const engine = useEngine(hasLocalProfile ? athlete : null, sessions);

  const fitness = engine && isFinite(engine.current.fitness) ? Math.round(engine.current.fitness) : null;
  const fatigue = engine && isFinite(engine.current.fatigue) ? Math.round(engine.current.fatigue) : null;
  const form = engine && isFinite(engine.current.form) ? Math.round(engine.current.form) : null;

  const formColor = form === null ? '#6b7280'
    : form > 5 ? '#2A1F4A'
    : form > -10 ? '#8A6900'
    : '#ef4444';

  const lastDate = latestSession
    ? new Date(latestSession.session_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 hover:border-[#2A1F4A] hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold shrink-0" style={{ backgroundColor: '#F7C843', color: '#2A1F4A' }}>
          {athlete.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-body font-semibold text-gray-900 dark:text-white text-sm truncate">{athlete.name}</h3>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#2A1F4A] transition-colors shrink-0 ml-2" />
          </div>
          <p className="font-body text-xs text-gray-400 capitalize mt-0.5">
            {athlete.sport}
            {!hasLocalProfile && (
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#2A1F4A]/5 dark:bg-[#B8A9E5]/10 text-[#2A1F4A] dark:text-[#B8A9E5] border border-[#2A1F4A]/20 dark:border-[#B8A9E5]/30">
                Hub
              </span>
            )}
          </p>
          {athleteData.hubAthlete?.email && (
            <p className="font-body text-[11px] text-gray-400 mt-0.5 truncate">{athleteData.hubAthlete.email}</p>
          )}

          {/* Metrics row */}
          <div className="mt-3 flex gap-4">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#2A1F4A] dark:text-[#B8A9E5]" />
              <span className="font-body text-xs text-gray-500 dark:text-gray-400">{t('fitness')}</span>
              <span className="font-body text-xs font-semibold text-gray-900 dark:text-white">{fitness ?? '—'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#8A6900] dark:text-[#F7C843]" />
              <span className="font-body text-xs text-gray-500 dark:text-gray-400">{t('fatigue')}</span>
              <span className="font-body text-xs font-semibold text-gray-900 dark:text-white">{fatigue ?? '—'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" style={{ color: formColor }} />
              <span className="font-body text-xs text-gray-500 dark:text-gray-400">{t('form')}</span>
              <span className="font-body text-xs font-semibold" style={{ color: formColor }}>{form !== null ? (form > 0 ? '+' : '') + form : '—'}</span>
            </div>
          </div>

          {/* Last session + session count */}
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-400 font-body">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {lastDate ? `${t('lastSession')}: ${lastDate}` : t('noSessions')}
            </span>
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              {sessions.length} {t('sessions').toLowerCase()}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

interface CoachViewProps {
  coachId: string;
}

export function CoachView({ coachId }: CoachViewProps) {
  const { t, lang } = useLanguage();
  const { athletes, loading, error, hubStatus, refetch } = useCoachAthletes(coachId);
  const [selectedAthlete, setSelectedAthlete] = useState<AthleteWithData | null>(null);

  if (selectedAthlete) {
    return (
      <AthleteDetail
        athleteData={selectedAthlete}
        onBack={() => setSelectedAthlete(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-2xl text-gray-900 dark:text-white">{t('coachDashboard')}</h1>
          <p className="font-body text-sm text-gray-500 dark:text-gray-400 mt-1">{t('coachDashboardSubtitle')}</p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-3 py-2 text-xs font-body text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:bg-gray-800 rounded-lg transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="font-body text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t('myAthletes')}</span>
          </div>
          <p className="font-body text-2xl font-bold text-gray-900 dark:text-white">{athletes.length}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-gray-400" />
            <span className="font-body text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t('sessions')}</span>
          </div>
          <p className="font-body text-2xl font-bold text-gray-900 dark:text-white">{athletes.reduce((s, a) => s + a.sessions.length, 0)}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <Heart className="w-4 h-4 text-gray-400" />
            <span className="font-body text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t('hrv')}</span>
          </div>
          <p className="font-body text-2xl font-bold text-gray-900 dark:text-white">{athletes.reduce((s, a) => s + a.hrvLogs.length, 0)}</p>
        </div>
      </div>

      {/* Hub connection status */}
      {hubStatus === 'failed' && (
        <div className="bg-[#F7C843]/20 dark:bg-[#F7C843]/10 border border-[#F7C843]/40 dark:border-[#F7C843]/30 rounded-xl p-3 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#F7C843] shrink-0" />
          <p className="font-body text-xs text-[#8A6900] dark:text-[#F7C843]">
            {lang === 'es'
              ? 'No se pudo conectar al Hub. Mostrando atletas locales.'
              : 'Could not connect to Hub. Showing local athletes only.'}
          </p>
        </div>
      )}

      {/* Athletes list */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-gray-200 dark:border-gray-700 rounded-full animate-spin mx-auto mb-3" style={{ borderTopColor: '#F7C843' }} />
          <p className="font-body text-sm text-gray-500 dark:text-gray-400">{t('loadingAthletes')}</p>
        </div>
      ) : error ? (
        <div className="py-20 text-center">
          <p className="font-body text-sm text-red-500">{error}</p>
        </div>
      ) : athletes.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-body font-semibold text-gray-500 dark:text-gray-400">{t('noAthletesFound')}</p>
          <p className="font-body text-sm text-gray-400 mt-1 max-w-sm mx-auto">{t('noAthletesDesc')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {athletes.map(athleteData => (
            <AthleteCard
              key={athleteData.athlete.id}
              athleteData={athleteData}
              onClick={() => setSelectedAthlete(athleteData)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
