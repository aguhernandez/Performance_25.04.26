import type { Athlete } from '../../../lib/database.types';
import { usePerformanceData } from './usePerformanceData';
import { PmcChart } from './PmcChart';
import { PdcChart } from './PdcChart';
import { WeeklyImpulseChart } from './WeeklyImpulseChart';
import { DurabilityChart } from './DurabilityChart';
import { EfficiencyChart } from './EfficiencyChart';
import { AthleteHomeSection } from '../../performance/AthleteHomeSection';
import { EmptyState } from './shared';

export function PerformanceView({ athlete, coachAssigned, onUpdateAthlete }: {
  athlete: Athlete;
  coachAssigned: boolean;
  onUpdateAthlete: (updates: Record<string, number | null>) => Promise<void>;
}) {
  const data = usePerformanceData(athlete);

  if (data.loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
        <p className="font-body text-[13px] text-gray-400">Loading performance data…</p>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-8 text-center">
        <p className="font-body text-[13px] text-red-600">{data.error}</p>
      </div>
    );
  }

  const hasStreams = data.pdcWindows.some(w => w.points.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold text-gray-900">Performance</h2>
        <p className="font-body text-[13px] text-gray-500 mt-0.5">
          Persistent model history — impulse, fitness, power and efficiency from stored daily and stream data
        </p>
      </div>

      <AthleteHomeSection athlete={athlete} coachAssigned={coachAssigned} onUpdateAthlete={onUpdateAthlete} />

      <PmcChart days={data.pmcDays} pmcStart={data.pmcStart} historyIncomplete={data.historyIncomplete} />

      <PdcChart windows={data.pdcWindows} cpModel={data.cpModel} hasStreams={hasStreams} />

      <DurabilityChart windows={data.durability} />

      <WeeklyImpulseChart
        weekly={data.weekly}
        weeklyLoad={data.weeklyLoad}
        currentWeekStart={data.currentWeekStart}
        quality={
          data.pmcDays.length > 0
            ? data.pmcDays[data.pmcDays.length - 1].quality
            : 'estimated'
        }
      />

      <EfficiencyChart
        rows={data.efficiency}
        efMovingAvg={data.efMovingAvg}
        decouplingMovingAvg={data.decouplingMovingAvg}
      />

      {!hasStreams && data.pmcDays.length === 0 && (
        <EmptyState title="No performance data yet" desc="Save sessions or connect power streams to populate these charts. Durability and W′bal additionally require a high-confidence critical power model." />
      )}
    </div>
  );
}
