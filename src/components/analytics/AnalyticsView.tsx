import { useState } from 'react';
import type { Session, Athlete, LabTest } from '../../lib/database.types';
import type { EngineOutput } from '../../lib/engine/types';
import { useLanguage } from '../../contexts/LanguageContext';
import { PowerDurationView } from './PowerDurationView';
import { FitnessSignatureView } from './FitnessSignatureView';
import { TSSLoadView } from './TSSLoadView';
import { PeriodizationView } from './PeriodizationView';
import { BenchmarksGoalsView } from './BenchmarksGoalsView';
import { ZonesDecouplingView } from './ZonesDecouplingView';

interface Props {
  sessions: Session[];
  athlete: Athlete;
  labTests: LabTest[];
  engine: EngineOutput | null;
}

type AnalyticsTab =
  | 'pdc'
  | 'signature'
  | 'load'
  | 'periodization'
  | 'benchmarks'
  | 'zones';

export function AnalyticsView({ sessions, athlete, labTests, engine }: Props) {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('pdc');
  const { t } = useLanguage();

  const TABS: { id: AnalyticsTab; label: string; description: string }[] = [
    { id: 'pdc', label: t('pdcTitle'), description: "PDC · MMP · W' · CP Model" },
    { id: 'signature', label: t('fsTitle').split(' ')[0] + ' Signature', description: "CP · FTP · W' Evolution" },
    { id: 'load', label: 'TSS & Load', description: 'CTL · ATL · TSB · ACWR' },
    { id: 'periodization', label: t('periodizationTitle').split(' ')[0], description: 'Blocks · Taper · Seasons' },
    { id: 'benchmarks', label: t('benchmarksTitle').split(' ')[0] + ' & Goals', description: 'Population Percentiles' },
    { id: 'zones', label: t('zonesTitle').split(',')[0], description: 'Distribution · EF · Stamina' },
  ];

  const fitnessHistory = engine?.history ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-gray-900">{t('analyticsTitle')}</h1>
        <p className="font-body text-[13px] text-gray-500 mt-0.5">
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
                ? 'bg-gray-900 border-gray-900 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span className={`font-body text-[12px] font-semibold ${activeTab === tab.id ? 'text-white' : 'text-gray-700'}`}>
              {tab.label}
            </span>
            <span className={`font-body text-[10px] mt-0.5 ${activeTab === tab.id ? 'text-gray-300' : 'text-gray-400'}`}>
              {tab.description}
            </span>
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'pdc' && (
          <PowerDurationView sessions={sessions} athlete={athlete} />
        )}
        {activeTab === 'signature' && (
          <FitnessSignatureView sessions={sessions} athlete={athlete} labTests={labTests} />
        )}
        {activeTab === 'load' && (
          <TSSLoadView sessions={sessions} athlete={athlete} />
        )}
        {activeTab === 'periodization' && (
          <PeriodizationView sessions={sessions} athlete={athlete} fitnessHistory={fitnessHistory} />
        )}
        {activeTab === 'benchmarks' && (
          <BenchmarksGoalsView sessions={sessions} athlete={athlete} labTests={labTests} fitnessHistory={fitnessHistory} />
        )}
        {activeTab === 'zones' && (
          <ZonesDecouplingView sessions={sessions} athlete={athlete} />
        )}
      </div>
    </div>
  );
}
