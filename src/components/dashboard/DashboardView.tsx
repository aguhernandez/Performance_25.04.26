import { useState } from 'react';
import { Activity, Dumbbell, FlaskConical, BarChart3, Layers, Utensils, Bell, Link2 } from 'lucide-react';
import type { EngineOutput } from '../../lib/engine/types';
import type { Athlete, Session, NutritionLog } from '../../lib/database.types';
import { MetricCard } from './MetricCard';
import { PerformanceChart } from './PerformanceChart';
import { WarningBanner } from './WarningBanner';
import { AdaptationTrend } from './AdaptationTrend';
import { FormGauge } from './FormGauge';
import { CompartmentsPanel } from './CompartmentsPanel';
import { LoadHeatmap } from './LoadHeatmap';
import { NutritionCompliancePanel } from './NutritionCompliancePanel';
import { SportTrendsPanel } from './SportTrendsPanel';
import { AlertsRecommendationsPanel } from './AlertsRecommendationsPanel';
import { ExportPanel } from '../export/ExportPanel';
import { SharePanel } from '../share/SharePanel';
import { HubDataPanel } from '../hub/HubDataPanel';
import { useLanguage } from '../../contexts/LanguageContext';
import { analyzeNutritionCompliance } from '../../lib/engine/nutritionAnalyzer';
import type { HubSnapshot } from '../../hooks/useHubData';

interface DashboardViewProps {
  engine: EngineOutput | null;
  athlete: Athlete;
  sessions: Session[];
  nutritionLogs: NutritionLog[];
  userId: string;
  hubConnected: boolean;
  hubSnapshot: HubSnapshot;
  hubLoading: boolean;
  hubError: string | null;
  athleteEmail: string | null;
  onRefreshHub: () => void;
}

type Tab = 'overview' | 'compartments' | 'load' | 'analytics' | 'alerts' | 'hub';

export function DashboardView({ engine, athlete, sessions, nutritionLogs, userId, hubConnected, hubSnapshot, hubLoading, hubError, athleteEmail, onRefreshHub }: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { t } = useLanguage();

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: t('overview'), icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'compartments', label: t('compartments'), icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'load', label: t('load'), icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'analytics', label: t('nutritionSports'), icon: <Utensils className="w-3.5 h-3.5" /> },
    { id: 'alerts', label: t('alerts'), icon: <Bell className="w-3.5 h-3.5" /> },
    { id: 'hub', label: 'Hub', icon: <Link2 className="w-3.5 h-3.5" /> },
  ];

  if (!engine) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Activity className="w-10 h-10 text-gray-700 dark:text-gray-300 mb-3" />
        <p className="text-gray-500 dark:text-gray-400">{t('noEngineData')}</p>
      </div>
    );
  }

  const { current, history, warnings, recommendations, adaptationTrend, performanceIndex, baselinePerformance, predictedPerformance, multiCompartment, compartmentHistory, predictedHistory, sportBreakdown } = engine;

  const recentSessions = sessions.slice(0, 7);
  const totalLoad = recentSessions.reduce((sum, s) => sum + s.impulse, 0);
  const avgImpulse = recentSessions.length > 0 ? totalLoad / recentSessions.length : 0;
  const alertCount = warnings.length + recommendations.filter(r => r.priority === 'high').length;

  return (
    <div className="space-y-4">
      {warnings.length > 0 && <WarningBanner warnings={warnings} />}

      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          label={t('fitness')}
          value={current.fitness}
          subtext={`τ₁ = ${current.tau.tauFitness}d`}
          accent="var(--chart-fitness)"
          icon={<Activity className="w-4 h-4" />}
        />
        <MetricCard
          label={t('fatigue')}
          value={current.fatigue}
          subtext={`τ₂ = ${current.tau.tauFatigue}d`}
          accent="var(--chart-fatigue)"
          icon={<Dumbbell className="w-4 h-4" />}
        />
        <MetricCard
          label={t('form')}
          value={current.form >= 0 ? `+${current.form.toFixed(2)}` : current.form.toFixed(2)}
          subtext={t('fitnessMinus')}
          accent={current.form >= 0 ? 'var(--chart-fitness)' : 'var(--chart-fatigue)'}
        />
        <MetricCard
          label={t('perfIndex')}
          value={performanceIndex}
          unit="pts"
          subtext={`${t('baseline')}: ${baselinePerformance.toFixed(2)}`}
          accent="var(--chart-fitness)"
          trend={performanceIndex - 100}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#F7C843] text-[#2A1F4A]'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'alerts' && alertCount > 0 && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === 'alerts' ? 'bg-[#2A1F4A]/10 text-[#2A1F4A] dark:bg-[#F7C843]/15 dark:text-[#F7C843]' : 'bg-red-500/20 text-red-500 dark:text-red-400'}`}>
                  {alertCount}
                </span>
              )}
              {tab.id === 'hub' && hubConnected && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <SharePanel athleteId={athlete.id} userId={userId} />
          <ExportPanel
            engine={engine}
            athlete={athlete}
            sessions={sessions}
            nutritionLogs={nutritionLogs}
          />
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <PerformanceChart history={history} windowDays={90} predictedHistory={predictedHistory} />
            </div>
            <div>
              <FormGauge state={current} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <AdaptationTrend
                trend={adaptationTrend}
                tau={current.tau}
                performanceIndex={performanceIndex}
                baselinePerformance={baselinePerformance}
              />
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-3">{t('athleteProfileCard')}</h3>
              <div className="space-y-2">
                {[
                  { label: 'VO2max', value: `${athlete.vo2max} ml/kg/min`, color: 'var(--chart-fitness)' },
                  { label: 'vLamax', value: `${athlete.vlamax} mmol/l/s`, color: 'var(--chart-fatigue)' },
                  { label: 'CP', value: `${athlete.cp_watts} W`, color: 'var(--chart-fitness)' },
                  { label: t('leanMass'), value: `${athlete.lean_mass_kg} kg`, color: 'var(--chart-fatigue)' },
                  { label: t('weight'), value: `${athlete.weight_kg} kg`, color: 'var(--chart-form)' },
                  { label: 'w/kg (CP)', value: `${(athlete.cp_watts / athlete.weight_kg).toFixed(2)} W/kg`, color: 'var(--chart-fitness)' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center py-1.5 border-b border-gray-200 dark:border-gray-700 last:border-0">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">{label}</span>
                    <span className="text-[12px] font-medium font-mono" style={{ color }}>{value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-mono tracking-widest mb-2">{t('sevenDayImpulse')}</p>
                <div className="flex items-end gap-1">
                  <span className="text-[22px] font-bold text-[#2A1F4A] dark:text-[#B8A9E5] tabular-nums font-mono">
                    {avgImpulse.toFixed(3)}
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">{t('auSession')}</span>
                </div>
                <p className="text-[10px] text-gray-600 dark:text-gray-500">{recentSessions.length} {t('sessionsInWindow')}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white">{t('physiologicalParams')}</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{t('personalizedTau')}</p>
              </div>
              <FlaskConical className="w-4 h-4 text-gray-600 dark:text-gray-500" />
            </div>
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: t('tauFitness'), value: `${current.tau.tauFitness}d`, desc: t('longTermAdaptation'), color: 'var(--chart-fitness)' },
                { label: t('tauFatigue'), value: `${current.tau.tauFatigue}d`, desc: t('shortTermStress'), color: 'var(--chart-fatigue)' },
                { label: t('recoveryRatio'), value: `${(current.recoveryRatio * 100).toFixed(0)}%`, desc: t('fatFitRatio'), color: current.recoveryRatio > 1.2 ? 'var(--chart-fatigue)' : 'var(--chart-form)' },
                { label: t('predictedPerf'), value: predictedPerformance.toFixed(2), desc: t('relativeBaseline'), color: 'var(--chart-fitness)' },
                { label: t('sessions90d'), value: sessions.filter(s => {
                  const d = new Date(s.session_date);
                  const cutoff = new Date();
                  cutoff.setDate(cutoff.getDate() - 90);
                  return d >= cutoff;
                }).length.toString(), desc: t('trainingFrequency'), color: 'var(--chart-form)' },
              ].map(({ label, value, desc, color }) => (
                <div key={label} className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono mb-1">{label}</p>
                  <p className="text-[16px] font-bold font-mono" style={{ color }}>{value}</p>
                  <p className="text-[9px] text-gray-600 dark:text-gray-500 mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'compartments' && (
        <CompartmentsPanel
          history={compartmentHistory}
        />
      )}

      {activeTab === 'load' && (
        <LoadHeatmap sessions={sessions} />
      )}

      {activeTab === 'analytics' && (
        <div className="grid grid-cols-2 gap-4">
          <NutritionCompliancePanel
            logs={nutritionLogs}
            compliance={analyzeNutritionCompliance(nutritionLogs, athlete.weight_kg ?? 75, athlete.lean_mass_kg ?? (athlete.weight_kg ?? 75) * 0.85)}
            weightKg={athlete.weight_kg ?? 75}
          />
          <SportTrendsPanel
            sessions={sessions}
            sportBreakdown={sportBreakdown}
          />
        </div>
      )}

      {activeTab === 'alerts' && (
        <AlertsRecommendationsPanel
          warnings={warnings}
          recommendations={recommendations}
        />
      )}

      {activeTab === 'hub' && (
        <HubDataPanel
          hubConnected={hubConnected}
          snapshot={hubSnapshot}
          loading={hubLoading}
          error={hubError}
          athleteEmail={athleteEmail}
          onRefresh={onRefreshHub}
        />
      )}
    </div>
  );
}
