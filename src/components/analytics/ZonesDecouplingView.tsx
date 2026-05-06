import { useMemo, useState } from 'react';
import type { Session, Athlete } from '../../lib/database.types';
import { computeZoneDistribution, formatTime } from '../../lib/engine/trainingZones';
import { computeEfficiencyFactor, computeStaminaDurability } from '../../lib/engine/decoupling';

interface Props {
  sessions: Session[];
  athlete: Athlete;
}

const DIST_LABELS: Record<string, string> = {
  polarized: 'Polarized',
  pyramidal: 'Pyramidal',
  threshold: 'Threshold Dominant',
  sweet_spot: 'Sweet Spot',
  mixed: 'Mixed',
};

const DIST_DESCRIPTIONS: Record<string, string> = {
  polarized: 'Mostly Z1-2 with significant high-intensity work — classic elite pattern',
  pyramidal: 'Volume decreasing as intensity rises — traditional base model',
  threshold: 'Heavy emphasis on Z4 — common in trained athletes',
  sweet_spot: 'Emphasis on Z3-4 range — high volume quality approach',
  mixed: 'No dominant pattern — consider more structure',
};

export function ZonesDecouplingView({ sessions, athlete }: Props) {
  const [activeTab, setActiveTab] = useState<'zones' | 'efficiency' | 'stamina'>('zones');
  const [windowDays, setWindowDays] = useState(90);

  const filteredSessions = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - windowDays);
    return sessions.filter(s => new Date(s.session_date) >= cutoff);
  }, [sessions, windowDays]);

  const zoneDistribution = useMemo(() =>
    computeZoneDistribution(
      filteredSessions,
      athlete.cp_watts || 250,
      athlete.max_hr || 185,
      athlete.resting_hr || 50
    ),
    [filteredSessions, athlete]
  );

  const efTrend = useMemo(() => computeEfficiencyFactor(sessions), [sessions]);
  const staminaDurability = useMemo(() => computeStaminaDurability(sessions), [sessions]);

  const efChartW = 700;
  const efChartH = 200;
  const efPad = { top: 15, right: 20, bottom: 35, left: 50 };

  const efValues = efTrend.entries.map(e => e.ef);
  const efMin = efValues.length > 0 ? Math.min(...efValues) * 0.9 : 0;
  const efMax = efValues.length > 0 ? Math.max(...efValues) * 1.1 : 2;

  const efPath = efTrend.entries.map((e, i) => {
    const x = efPad.left + (i / Math.max(1, efTrend.entries.length - 1)) * (efChartW - efPad.left - efPad.right);
    const y = efPad.top + efChartH - efPad.bottom - ((e.ef - efMin) / (efMax - efMin)) * (efChartH - efPad.top - efPad.bottom);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-gray-900">Zones, Efficiency & Durability</h2>
          <p className="font-body text-[13px] text-gray-500 mt-0.5">
            Training stress distribution, aerobic efficiency factor, and stamina metrics
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['zones', 'efficiency', 'stamina'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md font-body text-[12px] font-medium transition-all ${
                activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'zones' ? 'Zone Distribution' : tab === 'efficiency' ? 'Efficiency Factor' : 'Stamina & Durability'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'zones' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 justify-end">
            {[30, 90, 180, 365].map(d => (
              <button
                key={d}
                onClick={() => setWindowDays(d)}
                className={`px-3 py-1.5 rounded-lg font-body text-[12px] font-medium transition-all ${
                  windowDays === d ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 col-span-2">
              <div className="flex items-center justify-between mb-1">
                <p className="font-body text-[11px] text-gray-500 uppercase tracking-wide">Distribution Type</p>
                <span className="font-body text-[11px] text-gray-400">{formatTime(zoneDistribution.totalTimeSeconds)} total</span>
              </div>
              <p className="font-heading text-[18px] font-bold text-gray-900 mb-0.5">{DIST_LABELS[zoneDistribution.distributionType]}</p>
              <p className="font-body text-[12px] text-gray-500">{DIST_DESCRIPTIONS[zoneDistribution.distributionType]}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="font-body text-[11px] text-gray-500 uppercase tracking-wide mb-2">Balance</p>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="font-body text-[11px] text-gray-600">Low (Z1-2)</span>
                  <span className="font-heading text-[13px] font-bold text-green-600">{zoneDistribution.z1Pct.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-body text-[11px] text-gray-600">Tempo (Z3)</span>
                  <span className="font-heading text-[13px] font-bold text-amber-600">{zoneDistribution.z2Pct.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-body text-[11px] text-gray-600">High (Z4-7)</span>
                  <span className="font-heading text-[13px] font-bold text-red-600">{zoneDistribution.z3to7Pct.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-heading text-[14px] font-bold text-gray-900 mb-4">Time in Zone</h3>
            {zoneDistribution.totalTimeSeconds === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-400">
                <p className="font-body text-[13px]">No session data with power or HR for this period</p>
              </div>
            ) : (
              <div className="space-y-3">
                {zoneDistribution.zones.map(zone => (
                  <div key={zone.zone} className="flex items-center gap-4">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: zone.color + '20' }}>
                      <span className="font-body text-[10px] font-bold" style={{ color: zone.color }}>{zone.zone}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-body text-[12px] text-gray-700">{zone.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-body text-[11px] text-gray-400">{formatTime(zone.timeSeconds)}</span>
                          <span className="font-body text-[11px] font-medium text-gray-600 w-10 text-right">{zone.timePct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${zone.timePct}%`, backgroundColor: zone.color }}
                        />
                      </div>
                    </div>
                    <span className="font-body text-[11px] text-gray-400 w-16 text-right">
                      {zone.minPower}–{zone.maxPower === 9999 ? '∞' : zone.maxPower}W
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="h-5 flex rounded-full overflow-hidden">
                {zoneDistribution.zones.filter(z => z.timePct > 0).map(zone => (
                  <div
                    key={zone.zone}
                    style={{ width: `${zone.timePct}%`, backgroundColor: zone.color }}
                    title={`Z${zone.zone}: ${zone.timePct.toFixed(1)}%`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'efficiency' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Average EF', value: efTrend.avgEF.toFixed(2), unit: 'W/bpm', color: '#2563eb' },
              { label: 'EF Trend', value: `${efTrend.efTrendPct > 0 ? '+' : ''}${efTrend.efTrendPct.toFixed(1)}%`, unit: '', color: efTrend.efTrend === 'improving' ? '#16a34a' : efTrend.efTrend === 'declining' ? '#ef4444' : '#6b7280' },
              { label: 'Aerobic Fitness', value: efTrend.aerobicFitnessTrend, unit: '', color: efTrend.aerobicFitnessTrend === 'improving' ? '#16a34a' : efTrend.aerobicFitnessTrend === 'declining' ? '#ef4444' : '#6b7280' },
            ].map(card => (
              <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="font-body text-[11px] text-gray-500 uppercase tracking-wide mb-1">{card.label}</p>
                <p className="font-heading text-[22px] font-bold capitalize" style={{ color: card.color }}>{card.value}</p>
                {card.unit && <p className="font-body text-[11px] text-gray-400">{card.unit}</p>}
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-heading text-[14px] font-bold text-gray-900 mb-1">Efficiency Factor Over Time</h3>
            <p className="font-body text-[12px] text-gray-500 mb-4">Power / Heart Rate — rising EF = improving aerobic fitness</p>

            {efTrend.entries.length < 3 ? (
              <div className="flex items-center justify-center h-40 text-gray-400">
                <p className="font-body text-[13px]">Need power + HR data from at least 3 sessions</p>
              </div>
            ) : (
              <svg viewBox={`0 0 ${efChartW} ${efChartH}`} className="w-full" style={{ height: 200 }}>
                {[efMin, (efMin + efMax) / 2, efMax].map((v, i) => {
                  const y = efPad.top + efChartH - efPad.bottom - ((v - efMin) / (efMax - efMin)) * (efChartH - efPad.top - efPad.bottom);
                  return (
                    <g key={i}>
                      <line x1={efPad.left} y1={y} x2={efChartW - efPad.right} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                      <text x={efPad.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="system-ui">{v.toFixed(2)}</text>
                    </g>
                  );
                })}

                <path d={efPath} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />

                {efTrend.entries.map((e, i) => {
                  const x = efPad.left + (i / Math.max(1, efTrend.entries.length - 1)) * (efChartW - efPad.left - efPad.right);
                  const y = efPad.top + efChartH - efPad.bottom - ((e.ef - efMin) / (efMax - efMin)) * (efChartH - efPad.top - efPad.bottom);
                  return (
                    <circle key={i} cx={x} cy={y} r="3.5" fill="white" stroke="#2563eb" strokeWidth="2" />
                  );
                })}
              </svg>
            )}

            <div className="mt-4">
              <h4 className="font-body text-[11px] text-gray-400 uppercase tracking-wide mb-2">Recent sessions</h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {efTrend.entries.slice(-8).reverse().map(e => (
                  <div key={e.sessionId} className="flex items-center justify-between py-1 border-b border-gray-50">
                    <div>
                      <span className="font-body text-[12px] text-gray-700">{e.title}</span>
                      <span className="font-body text-[10px] text-gray-400 ml-2">{e.date}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-body text-[11px] text-gray-500">{e.power}W / {e.hr}bpm</span>
                      <span className="font-heading text-[13px] font-bold text-blue-600">{e.ef}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'stamina' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                title: 'Stamina',
                value: staminaDurability.stamina,
                label: staminaDurability.staminaLabel,
                description: 'Ability to maintain power relative to aerobic capacity over time',
                color: '#2563eb',
                detail: `EF dropoff: ${staminaDurability.efDropoff.toFixed(1)}%`,
              },
              {
                title: 'Durability',
                value: staminaDurability.durability,
                label: staminaDurability.durabilityLabel,
                description: 'Absolute aerobic efficiency in long sessions (90+ min)',
                color: '#16a34a',
                detail: `Long session EF: ${staminaDurability.longSessionEF.toFixed(2)} W/bpm`,
              },
            ].map(metric => (
              <div key={metric.title} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-body text-[11px] text-gray-400 uppercase tracking-wide">{metric.title}</p>
                    <p className="font-heading text-[15px] font-bold mt-0.5" style={{ color: metric.color }}>{metric.label}</p>
                  </div>
                  <div className="relative w-16 h-16">
                    <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="#f1f5f9" strokeWidth="6" />
                      <circle cx="32" cy="32" r="28" fill="none" stroke={metric.color} strokeWidth="6"
                        strokeDasharray={`${(metric.value / 100) * 175.9} 175.9`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-heading text-[15px] font-bold text-gray-800">{metric.value}</span>
                    </div>
                  </div>
                </div>
                <p className="font-body text-[12px] text-gray-500 mb-2">{metric.description}</p>
                <p className="font-body text-[11px] text-gray-400">{metric.detail}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-heading text-[14px] font-bold text-gray-900 mb-4">Efficiency Breakdown</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Short Session EF', value: staminaDurability.shortSessionEF.toFixed(2), sub: '<60 min sessions', color: '#d97706' },
                { label: 'Long Session EF', value: staminaDurability.longSessionEF.toFixed(2), sub: '>90 min sessions', color: '#2563eb' },
                { label: 'EF Dropoff', value: `${staminaDurability.efDropoff.toFixed(1)}%`, sub: staminaDurability.efDropoff < 5 ? 'Excellent durability' : staminaDurability.efDropoff < 10 ? 'Good' : 'Work on long efforts', color: staminaDurability.efDropoff < 5 ? '#16a34a' : staminaDurability.efDropoff < 10 ? '#d97706' : '#ef4444' },
              ].map(item => (
                <div key={item.label} className="p-4 bg-gray-50 rounded-xl">
                  <p className="font-body text-[10px] text-gray-400 uppercase tracking-wide mb-1">{item.label}</p>
                  <p className="font-heading text-[20px] font-bold" style={{ color: item.color }}>{item.value}</p>
                  <p className="font-body text-[11px] text-gray-500 mt-0.5">{item.sub}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <h4 className="font-body text-[12px] font-medium text-blue-800 mb-1">What does this mean?</h4>
              <p className="font-body text-[12px] text-blue-700">
                {staminaDurability.efDropoff < 5
                  ? 'Your efficiency barely drops in long sessions — excellent durability. You are well-adapted to sustained efforts.'
                  : staminaDurability.efDropoff < 10
                  ? 'Moderate efficiency drop in long sessions. Consider adding more long aerobic work (Z2) to improve durability.'
                  : 'Significant efficiency loss in long sessions. Prioritize long steady-state training to build aerobic base and durability.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
