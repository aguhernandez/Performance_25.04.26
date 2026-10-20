import { useState } from 'react';
import type { Session, Athlete, LabTest } from '../../lib/database.types';
import type { EngineOutput } from '../../lib/engine/types';
import { useLanguage } from '../../contexts/LanguageContext';
import { PowerDurationView } from './PowerDurationView';
import { PerformanceView } from './performance/PerformanceView';
import { FitnessSignatureView } from './FitnessSignatureView';
import { ImpulseLoadView } from './ImpulseLoadView';
import { PeriodizationView } from './PeriodizationView';
import { BenchmarksGoalsView } from './BenchmarksGoalsView';
import { ZonesDecouplingView } from './ZonesDecouplingView';
import type { AthleteCpData } from '../../hooks/useAthleteCpModel';

interface Props {
  sessions: Session[];
  athlete: Athlete;
  labTests: LabTest[];
  engine: EngineOutput | null;
  cpData: AthleteCpData;
  coachAssigned?: boolean;
  onUpdateAthlete?: (updates: Record<string, number | null>) => Promise<void>;
}

type AnalyticsTab =
  | 'performance'
  | 'pdc'
  | 'signature'
  | 'load'
  | 'periodization'
  | 'benchmarks'
  | 'zones';

export function AnalyticsView({ sessions, athlete, labTests, engine, cpData, coachAssigned = false, onUpdateAthlete }: Props) {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('pdc');
  const { t } = useLanguage();

  const TABS: { id: AnalyticsTab; label: string; description: string }[] = [
    { id: 'performance', label: 'Performance', description: 'PMC · PDC · Weekly Load · Efficiency' },
    { id: 'pdc', label: t('pdcTitle'), description: "PDC · MMP · W' · CP Model" },
    { id: 'signature', label: t('fsTitle').split(' ')[0] + ' Signature', description: "CP · FTP · W' Evolution" },
    { id: 'load', label: t('impulseLoadTab'), description: t('impulseLoadTabDesc') },
    { id: 'periodization', label: t('periodizationTitle').split(' ')[0], description: 'Blocks · Taper · Seasons' },
    { id: 'benchmarks', label: t('benchmarksTitle').split(' ')[0] + ' & Goals', description: 'Population Percentiles' },
    { id: 'zones', label: t('zonesTitle').split(',')[0], description: 'Distribution · EF · Stamina' },
  ];

  const fitnessHistory = engine?.history ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-gray-900 dark:text-white">{t('analyticsTitle')}</h1>
        <p className="font-body text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">
          {t('analyticsSubtitle')}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 flex flex-col items-start px-4 py-3 rounded-xl border transition-all ${
              activeTab === tab.id
                ? 'bg-[#F7C843] border-[#F7C843] text-[#2A1F4A]'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 hover:bg-gray-50 dark:bg-gray-800'
            }`}
          >
            <span className={`font-body text-[12px] font-semibold ${activeTab === tab.id ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'}`}>
              {tab.label}
            </span>
            <span className={`font-body text-[10px] mt-0.5 ${activeTab === tab.id ? 'text-gray-300' : 'text-gray-400'}`}>
              {tab.description}
            </span>
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'performance' && (
          <PerformanceView
            athlete={athlete}
            coachAssigned={coachAssigned}
            onUpdateAthlete={onUpdateAthlete ?? (async () => {})}
          />
        )}
        {activeTab === 'pdc' && (
          <PowerDurationView athlete={athlete} cpData={cpData} />
        )}
        {activeTab === 'signature' && (
          <FitnessSignatureView athlete={athlete} labTests={labTests} cpData={cpData} />
        )}
        {activeTab === 'load' && (
          <ImpulseLoadView sessions={sessions} athlete={athlete} />
        )}
        {activeTab === 'periodization' && (
          <PeriodizationView sessions={sessions} athlete={athlete} fitnessHistory={fitnessHistory} />
        )}
        {activeTab === 'benchmarks' && (
          <BenchmarksGoalsView athlete={athlete} labTests={labTests} fitnessHistory={fitnessHistory} cpData={cpData} />
        )}
        {activeTab === 'zones' && (
          <ZonesDecouplingView sessions={sessions} athlete={athlete} />
        )}
      </div>
    </div>
  );
}
