import { useMemo, useState } from 'react';
import type { Athlete } from '../../lib/database.types';
import {
  generatePDCCurve,
  formatDuration,
  getPowerZones,
} from '../../lib/engine/powerDurationCurve';
import { useLanguage } from '../../contexts/LanguageContext';
import type { AthleteCpData } from '../../hooks/useAthleteCpModel';

interface Props {
  athlete: Athlete;
  cpData: AthleteCpData;
}

const PERIOD_COLORS = ['#2563eb', '#16a34a', '#d97706', '#94a3b8'];

export function PowerDurationView({ athlete, cpData }: Props) {
  const { t } = useLanguage();
  const [hoveredDuration, setHoveredDuration] = useState<number | null>(null);

  const cpModel = cpData.cpModel;
  const hasModel = !!cpModel && cpModel.status === 'ok' && cpModel.cp > 0;

  const pdcCurve = useMemo(() =>
    hasModel && cpModel
      ? generatePDCCurve({ cp: cpModel.cp, wPrime: cpModel.wPrimeJ })
      : [],
    [hasModel, cpModel]
  );
  const zonesCp = hasModel && cpModel ? cpModel.cp : athlete.cp_watts || 200;
  const powerZones = useMemo(() => getPowerZones(zonesCp), [zonesCp]);

  const mmpPeriods = useMemo(() => {
    const now = new Date();
    const defs = [
      { label: '30 days', days: 30 },
      { label: '90 days', days: 90 },
      { label: '180 days', days: 180 },
      { label: 'All time', days: 9999 },
    ];
    return defs.map(p => {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - p.days);
      const cutoffStr = cutoff.toISOString().split('T')[0];
      const best = new Map<number, { duration: number; power: number }>();
      for (const r of cpData.mmpRows) {
        if (r.date < cutoffStr) continue;
        const existing = best.get(r.duration_s);
        if (!existing || r.watts > existing.power) {
          best.set(r.duration_s, { duration: r.duration_s, power: Math.round(r.watts) });
        }
      }
      return {
        label: p.label,
        points: Array.from(best.values()).sort((a, b) => a.duration - b.duration),
      };
    });
  }, [cpData.mmpRows]);

  const selectedPeriod = mmpPeriods[mmpPeriods.length - 1];
  const allTimeData = selectedPeriod;

  const maxPower = useMemo(() => {
    const allPowers = [
      ...pdcCurve.map(p => p.power),
      ...allTimeData.points.map(p => p.power),
    ];
    return allPowers.length > 0 ? Math.max(...allPowers) * 1.1 : 600;
  }, [pdcCurve, allTimeData.points]);

  const chartWidth = 700;
  const chartHeight = 280;
  const padding = { top: 20, right: 20, bottom: 40, left: 55 };

  const xScale = (dur: number) => {
    const logMin = Math.log10(5);
    const logMax = Math.log10(7200);
    const logVal = Math.log10(Math.max(5, dur));
    return padding.left + ((logVal - logMin) / (logMax - logMin)) * (chartWidth - padding.left - padding.right);
  };

  const yScale = (power: number) => {
    return padding.top + chartHeight - padding.bottom - (power / maxPower) * (chartHeight - padding.top - padding.bottom);
  };

  const pdcPath = pdcCurve.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(p.duration)} ${yScale(p.power)}`
  ).join(' ');

  const mmpPath = allTimeData.points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(p.duration)} ${yScale(p.power)}`
  ).join(' ');

  const periodPath = mmpPeriods[0].points.length > 0
    ? mmpPeriods[0].points.map((p, i) =>
        `${i === 0 ? 'M' : 'L'} ${xScale(p.duration)} ${yScale(p.power)}`
      ).join(' ')
    : null;

  const yTicks = [0, 100, 200, 300, 400, 500, 600].filter(v => v <= maxPower);
  const xTickDurations = [10, 30, 60, 300, 600, 1800, 3600];

  const bodyWeightKg = athlete.weight_kg || 70;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-gray-900">{t('pdcTitle')}</h2>
          <p className="font-body text-[13px] text-gray-500 mt-0.5">
            {t('pdcSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {cpData.loading && <span className="font-body text-[11px] text-gray-400">{t('loadingAthlete')}</span>}
        </div>
      </div>

      {!hasModel ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <p className="font-body text-[14px] text-gray-500">{t('noPowerDataAvailable')}</p>
          <p className="font-body text-[12px] text-gray-400 mt-1">
            {cpModel?.reason === 'insufficient_data' || cpModel?.status === 'insufficient_data'
              ? t('noPowerDataDesc')
              : t('noPowerDataDesc')}
          </p>
        </div>
      ) : (
      <>
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: t('criticalPower'), value: `${cpModel?.cp ?? 0}W`, sub: `${((cpModel?.cp ?? 0) / bodyWeightKg).toFixed(2)} W/kg`, color: '#2563eb' },
          { label: t('wPrime'), value: `${Math.round((cpModel?.wPrimeJ ?? 0) / 1000 * 10) / 10} kJ`, sub: `${cpModel?.wPrimeJ ?? 0}J`, color: '#d97706' },
          { label: t('peakPower'), value: cpModel && cpModel.pMax > 0 ? `${cpModel.pMax}W` : '—', sub: cpModel && cpModel.pMax > 0 ? `${(cpModel.pMax / bodyWeightKg).toFixed(2)} W/kg` : 'no 1 s stream data', color: '#16a34a' },
          { label: t('modelFit'), value: cpModel ? `${Math.round(cpModel.r2 * 100)}%` : '—', sub: `${cpModel?.nPoints ?? 0} points · ${cpModel?.confidence ?? 'low'}`, color: '#6b7280' },
        ].map(card => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="font-body text-[11px] text-gray-500 uppercase tracking-wide mb-1">{card.label}</p>
            <p className="font-heading text-[22px] font-bold" style={{ color: card.color }}>{card.value}</p>
            <p className="font-body text-[11px] text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-5 mb-4">
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-0.5 bg-blue-600" />
            <span className="font-body text-[11px] text-gray-500">{t('pdcModel')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-0.5 bg-gray-400" />
            <span className="font-body text-[11px] text-gray-500">{t('allTimeMmp')}</span>
          </div>
          {periodPath && (
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-0.5" style={{ backgroundColor: PERIOD_COLORS[0] }} />
              <span className="font-body text-[11px] text-gray-500">Last 30 days</span>
            </div>
          )}
        </div>

        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full"
          style={{ height: 280 }}
          onMouseLeave={() => setHoveredDuration(null)}
        >
          {yTicks.map(v => (
            <g key={v}>
              <line
                x1={padding.left} y1={yScale(v)}
                x2={chartWidth - padding.right} y2={yScale(v)}
                stroke="#f1f5f9" strokeWidth="1"
              />
              <text
                x={padding.left - 6} y={yScale(v) + 4}
                textAnchor="end" fontSize="10" fill="#94a3b8"
                fontFamily="system-ui"
              >
                {v}
              </text>
            </g>
          ))}

          {xTickDurations.map(dur => (
            <g key={dur}>
              <line
                x1={xScale(dur)} y1={padding.top}
                x2={xScale(dur)} y2={chartHeight - padding.bottom}
                stroke="#f1f5f9" strokeWidth="1"
              />
              <text
                x={xScale(dur)} y={chartHeight - padding.bottom + 14}
                textAnchor="middle" fontSize="10" fill="#94a3b8"
                fontFamily="system-ui"
              >
                {formatDuration(dur)}
              </text>
            </g>
          ))}

          {mmpPath && (
            <path
              d={mmpPath}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {periodPath && (
            <path
              d={periodPath}
              fill="none"
              stroke={PERIOD_COLORS[0]}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4 2"
            />
          )}

          <path
            d={pdcPath}
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {allTimeData.points.map(pt => (
            <circle
              key={pt.duration}
              cx={xScale(pt.duration)}
              cy={yScale(pt.power)}
              r={hoveredDuration === pt.duration ? 6 : 4}
              fill="white"
              stroke="#2563eb"
              strokeWidth="2"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredDuration(pt.duration)}
            />
          ))}

          {hoveredDuration && (() => {
            const pt = allTimeData.points.find(p => p.duration === hoveredDuration);
            if (!pt) return null;
            const cx = xScale(pt.duration);
            const cy = yScale(pt.power);
            return (
              <g>
                <rect x={cx + 8} y={cy - 22} width={90} height={40} rx="4" fill="white" stroke="#e2e8f0" strokeWidth="1" />
                <text x={cx + 13} y={cy - 8} fontSize="11" fill="#1e293b" fontFamily="system-ui" fontWeight="bold">{pt.power}W</text>
                <text x={cx + 13} y={cy + 6} fontSize="10" fill="#64748b" fontFamily="system-ui">{formatDuration(pt.duration)}</text>
                <text x={cx + 13} y={cy + 18} fontSize="10" fill="#64748b" fontFamily="system-ui">{(pt.power / bodyWeightKg).toFixed(2)} W/kg</text>
              </g>
            );
          })()}

          <text x={padding.left - 35} y={chartHeight / 2} fontSize="11" fill="#94a3b8" fontFamily="system-ui" transform={`rotate(-90, ${padding.left - 35}, ${chartHeight / 2})`} textAnchor="middle">{t('powerW')}</text>
          <text x={chartWidth / 2} y={chartHeight - 2} fontSize="11" fill="#94a3b8" fontFamily="system-ui" textAnchor="middle">{t('duration')}</text>
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-heading text-[14px] font-bold text-gray-900 mb-4">{t('powerZones')}</h3>
          <div className="space-y-2">
            {powerZones.map(zone => {
              const maxW = zone.max === 9999 ? (cpModel?.pMax || zonesCp * 1.5) : zone.max;
              const widthPct = Math.min(100, ((maxW - zone.min) / (cpModel?.pMax || zonesCp * 1.5)) * 100);
              return (
                <div key={zone.zone} className="flex items-center gap-3">
                  <span className="font-body text-[11px] text-gray-400 w-4">{zone.zone}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-body text-[11px] text-gray-700">{zone.name}</span>
                      <span className="font-body text-[11px] text-gray-400">
                        {zone.min}–{zone.max === 9999 ? `${cpModel?.pMax || zonesCp * 1.5}+` : zone.max}W
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${widthPct}%`, backgroundColor: zone.color }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-heading text-[14px] font-bold text-gray-900 mb-4">{t('mmpRecords')}</h3>
          {allTimeData.points.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <p className="font-body text-[13px]">{t('noPowerDataAvailable')}</p>
              <p className="font-body text-[11px] mt-1">{t('noPowerDataDesc')}</p>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-52">
              {allTimeData.points.map(pt => {
                const periodPt = mmpPeriods[0].points.find(p => p.duration === pt.duration);
                const isRecent = periodPt && periodPt.power >= pt.power * 0.98;
                return (
                  <div key={pt.duration} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                    <span className="font-body text-[12px] text-gray-600">{formatDuration(pt.duration)}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-body text-[12px] text-gray-400">{(pt.power / bodyWeightKg).toFixed(2)} W/kg</span>
                      <span className={`font-heading text-[13px] font-bold ${isRecent ? 'text-green-600' : 'text-gray-800'}`}>
                        {pt.power}W
                      </span>
                      {isRecent && (
                        <span className="font-body text-[9px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full">{t('recent')}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
