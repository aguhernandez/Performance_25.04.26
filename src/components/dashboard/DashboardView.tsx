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
        <Activity className="w-10 h-10 text-slate-700 mb-3" />
        <p className="text-slate-500">{t('noEngineData')}</p>
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
          accent="#0ea5e9"
          icon={<Activity className="w-4 h-4" />}
        />
        <MetricCard
          label={t('fatigue')}
          value={current.fatigue}
          subtext={`τ₂ = ${current.tau.tauFatigue}d`}
          accent="#f97316"
          icon={<Dumbbell className="w-4 h-4" />}
        />
        <MetricCard
          label={t('form')}
          value={current.form >= 0 ? `+${current.form.toFixed(2)}` : current.form.toFixed(2)}
          subtext={t('fitnessMinus')}
          accent={current.form >= 0 ? '#22c55e' : '#ef4444'}
        />
        <MetricCard
          label={t('perfIndex')}
          value={performanceIndex}
          unit="pts"
          subtext={`${t('baseline')}: ${baselinePerformance.toFixed(2)}`}
          accent="#0ea5e9"
          trend={performanceIndex - 100}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-800/40 border border-slate-700/40 rounded-xl p-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-cyan-500 text-[#070b12]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'alerts' && alertCount > 0 && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === 'alerts' ? 'bg-[#070b12]/30 text-[#070b12]' : 'bg-red-500/20 text-red-400'}`}>
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
            <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4">
              <h3 className="text-[13px] font-semibold text-white mb-3">{t('athleteProfileCard')}</h3>
              <div className="space-y-2">
                {[
                  { label: 'VO2max', value: `${athlete.vo2max} ml/kg/min`, color: '#0ea5e9' },
                  { label: 'vLamax', value: `${athlete.vlamax} mmol/l/s`, color: '#f97316' },
                  { label: 'CP', value: `${athlete.cp_watts} W`, color: '#22c55e' },
                  { label: t('leanMass'), value: `${athlete.lean_mass_kg} kg`, color: '#f59e0b' },
                  { label: t('weight'), value: `${athlete.weight_kg} kg`, color: '#94a3b8' },
                  { label: 'w/kg (CP)', value: `${(athlete.cp_watts / athlete.weight_kg).toFixed(2)} W/kg`, color: '#0ea5e9' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-800/40 last:border-0">
                    <span className="text-[11px] text-slate-500 font-mono">{label}</span>
                    <span className="text-[12px] font-medium font-mono" style={{ color }}>{value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-800/40">
                <p className="text-[10px] text-slate-500 uppercase font-mono tracking-widest mb-2">{t('sevenDayImpulse')}</p>
                <div className="flex items-end gap-1">
                  <span className="text-[22px] font-bold text-cyan-400 tabular-nums font-mono">
                    {avgImpulse.toFixed(3)}
                  </span>
                  <span className="text-[11px] text-slate-500 mb-1">{t('auSession')}</span>
                </div>
                <p className="text-[10px] text-slate-600">{recentSessions.length} {t('sessionsInWindow')}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[13px] font-semibold text-white">{t('physiologicalParams')}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{t('personalizedTau')}</p>
              </div>
              <FlaskConical className="w-4 h-4 text-slate-600" />
            </div>
            <div className="grid grid-cols-6 gap-3">
              {[
                { label: t('tauFitness'), value: `${current.tau.tauFitness}d`, desc: t('longTermAdaptation'), color: '#0ea5e9' },
                { label: t('tauFatigue'), value: `${current.tau.tauFatigue}d`, desc: t('shortTermStress'), color: '#f97316' },
                { label: t('kMultiplier'), value: current.tau.kMultiplier.toString(), desc: t('fatigueAmplification'), color: '#f59e0b' },
                { label: t('recoveryRatio'), value: `${(current.recoveryRatio * 100).toFixed(0)}%`, desc: t('fatFitRatio'), color: current.recoveryRatio > 1.2 ? '#ef4444' : current.recoveryRatio < 0.6 ? '#64748b' : '#22c55e' },
                { label: t('predictedPerf'), value: predictedPerformance.toFixed(2), desc: t('relativeBaseline'), color: '#0ea5e9' },
                { label: t('sessions90d'), value: sessions.filter(s => {
                  const d = new Date(s.session_date);
                  const cutoff = new Date();
                  cutoff.setDate(cutoff.getDate() - 90);
                  return d >= cutoff;
                }).length.toString(), desc: t('trainingFrequency'), color: '#22c55e' },
              ].map(({ label, value, desc, color }) => (
                <div key={label} className="text-center p-2 rounded-lg bg-slate-800/20 border border-slate-700/20">
                  <p className="text-[10px] text-slate-500 font-mono mb-1">{label}</p>
                  <p className="text-[16px] font-bold font-mono" style={{ color }}>{value}</p>
                  <p className="text-[9px] text-slate-600 mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'compartments' && (
        <CompartmentsPanel
          current={multiCompartment}
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
            athlete={athlete}
            sessions={sessions}
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
