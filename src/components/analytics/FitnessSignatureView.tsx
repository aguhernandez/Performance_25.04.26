import { useMemo, useState } from 'react';
import type { Session, Athlete, LabTest } from '../../lib/database.types';
import { extractMMP, fitPDCModel } from '../../lib/engine/powerDurationCurve';
import { getFTPHistory } from '../../lib/engine/benchmarks';
import { useLanguage } from '../../contexts/LanguageContext';

interface Props {
  sessions: Session[];
  athlete: Athlete;
  labTests: LabTest[];
}

interface SignaturePoint {
  date: string;
  cp: number;
  wPrime: number;
  pMax: number;
  ftpWatts: number;
  cpPerKg: number;
  source: 'lab' | 'derived';
}

export function FitnessSignatureView({ sessions, athlete, labTests }: Props) {
  const { t } = useLanguage();
  const [selectedMetric, setSelectedMetric] = useState<'cp' | 'wPrime' | 'pMax' | 'cpPerKg'>('cp');

  const ftpHistory = useMemo(() => getFTPHistory(labTests), [labTests]);

  const signatureHistory = useMemo((): SignaturePoint[] => {
    const points: SignaturePoint[] = [];
    const weightKg = athlete.weight_kg || 70;

    for (const labEntry of ftpHistory) {
      points.push({
        date: labEntry.date,
        cp: labEntry.cp,
        wPrime: labEntry.cp * 60 * 0.15,
        pMax: labEntry.cp * 3,
        ftpWatts: labEntry.ftp,
        cpPerKg: weightKg > 0 ? labEntry.cp / weightKg : 0,
        source: 'lab',
      });
    }

    if (points.length === 0) {
      const mmpProfile = extractMMP(sessions);
      const model = fitPDCModel(mmpProfile.points.map(p => ({ duration: p.duration, power: p.power })), athlete.cp_watts);
      if (model.cp > 0) {
        points.push({
          date: new Date().toISOString().split('T')[0],
          cp: model.cp,
          wPrime: model.wPrime,
          pMax: model.pMax,
          ftpWatts: Math.round(model.cp * 0.95),
          cpPerKg: weightKg > 0 ? model.cp / weightKg : 0,
          source: 'derived',
        });
      }
    }

    if (athlete.cp_watts) {
      const hasCurrentLab = points.some(p => {
        const today = new Date().toISOString().split('T')[0];
        return p.date === today && p.source === 'lab';
      });
      if (!hasCurrentLab) {
        const mmpProfile = extractMMP(sessions);
        const model = fitPDCModel(mmpProfile.points.map(p => ({ duration: p.duration, power: p.power })), athlete.cp_watts);
        points.push({
          date: new Date().toISOString().split('T')[0],
          cp: model.cp > 0 ? model.cp : athlete.cp_watts,
          wPrime: model.wPrime > 0 ? model.wPrime : athlete.cp_watts * 60 * 0.15,
          pMax: model.pMax > 0 ? model.pMax : athlete.cp_watts * 3,
          ftpWatts: athlete.ftp_watts || Math.round(athlete.cp_watts * 0.95),
          cpPerKg: (athlete.weight_kg || 70) > 0 ? (model.cp > 0 ? model.cp : athlete.cp_watts) / (athlete.weight_kg || 70) : 0,
          source: 'derived',
        });
      }
    }

    return points.sort((a, b) => a.date.localeCompare(b.date));
  }, [sessions, athlete, ftpHistory]);

  const metrics = {
    cp: { label: t('criticalPower'), unit: 'W', color: '#2563eb' },
    wPrime: { label: t('wPrimeKj'), unit: 'kJ', color: '#d97706' },
    pMax: { label: t('peakPower'), unit: 'W', color: '#16a34a' },
    cpPerKg: { label: t('cpKg'), unit: 'W/kg', color: '#dc2626' },
  };

  const currentMetric = metrics[selectedMetric];
  const values = signatureHistory.map(p => {
    if (selectedMetric === 'wPrime') return { ...p, displayVal: Math.round(p.wPrime / 1000 * 10) / 10 };
    if (selectedMetric === 'cpPerKg') return { ...p, displayVal: Math.round(p.cpPerKg * 100) / 100 };
    return { ...p, displayVal: p[selectedMetric] };
  });

  const current = signatureHistory[signatureHistory.length - 1];
  const previous = signatureHistory[signatureHistory.length - 2];

  const chartWidth = 700;
  const chartHeight = 220;
  const padding = { top: 20, right: 20, bottom: 35, left: 55 };

  const allVals = values.map(v => v.displayVal).filter(v => v > 0);
  const minVal = allVals.length > 0 ? Math.min(...allVals) * 0.9 : 0;
  const maxVal = allVals.length > 0 ? Math.max(...allVals) * 1.1 : 100;

  const dates = values.map(v => v.date);
  const xScale = (i: number) => {
    if (values.length <= 1) return chartWidth / 2;
    return padding.left + (i / (values.length - 1)) * (chartWidth - padding.left - padding.right);
  };
  const yScale = (val: number) => {
    return padding.top + chartHeight - padding.bottom - ((val - minVal) / (maxVal - minVal)) * (chartHeight - padding.top - padding.bottom);
  };

  const pathStr = values.length > 1
    ? values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v.displayVal)}`).join(' ')
    : null;

  const areaPath = values.length > 1
    ? `${pathStr} L ${xScale(values.length - 1)} ${chartHeight - padding.bottom} L ${xScale(0)} ${chartHeight - padding.bottom} Z`
    : null;

  const trend = values.length >= 2 ? values[values.length - 1].displayVal - values[0].displayVal : 0;
  const trendPct = values.length >= 2 && values[0].displayVal > 0 ? (trend / values[0].displayVal) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-gray-900">{t('fsTitle')}</h2>
          <p className="font-body text-[13px] text-gray-500 mt-0.5">
            {t('fsSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {Object.entries(metrics).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setSelectedMetric(key as typeof selectedMetric)}
              className={`px-3 py-1.5 rounded-lg font-body text-[12px] font-medium transition-all ${
                selectedMetric === key ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={selectedMetric === key ? { backgroundColor: meta.color } : {}}
            >
              {meta.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: t('currentCp'),
            value: current ? `${current.cp}W` : '—',
            sub: current ? `${current.cpPerKg.toFixed(2)} W/kg` : '—',
            color: '#2563eb',
          },
          {
            label: t('currentWPrime'),
            value: current ? `${Math.round(current.wPrime / 1000 * 10) / 10} kJ` : '—',
            sub: current ? `${current.wPrime}J total` : '—',
            color: '#d97706',
          },
          {
            label: t('peakPower'),
            value: current ? `${current.pMax}W` : '—',
            sub: current ? `${(current.pMax / (athlete.weight_kg || 70)).toFixed(2)} W/kg` : '—',
            color: '#16a34a',
          },
          {
            label: t('cpTrend'),
            value: trendPct !== 0 ? `${trendPct > 0 ? '+' : ''}${trendPct.toFixed(1)}%` : '—',
            sub: values.length > 1 ? t('vsFirstTest') : t('vsBaseline'),
            color: trendPct > 0 ? '#16a34a' : trendPct < 0 ? '#ef4444' : '#6b7280',
          },
        ].map(card => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="font-body text-[11px] text-gray-500 uppercase tracking-wide mb-1">{card.label}</p>
            <p className="font-heading text-[22px] font-bold" style={{ color: card.color }}>{card.value}</p>
            <p className="font-body text-[11px] text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-[14px] font-bold text-gray-900">{currentMetric.label} Over Time</h3>
          <div className="flex items-center gap-2">
            {trend !== 0 && (
              <span className={`font-body text-[12px] font-medium px-2 py-0.5 rounded-full ${trend > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {trend > 0 ? '+' : ''}{trendPct.toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {values.length < 2 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <p className="font-body text-[13px]">{t('notEnoughTrendData')}</p>
            <p className="font-body text-[11px] mt-1">{t('addLabTestsDesc')}</p>
          </div>
        ) : (
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full" style={{ height: 220 }}>
            {[minVal, (minVal + maxVal) / 2, maxVal].map((v, i) => (
              <g key={i}>
                <line x1={padding.left} y1={yScale(v)} x2={chartWidth - padding.right} y2={yScale(v)} stroke="#f1f5f9" strokeWidth="1" />
                <text x={padding.left - 6} y={yScale(v) + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="system-ui">
                  {selectedMetric === 'cpPerKg' ? v.toFixed(2) : selectedMetric === 'wPrime' ? v.toFixed(1) : Math.round(v)}
                </text>
              </g>
            ))}

            {areaPath && (
              <path d={areaPath} fill={currentMetric.color} fillOpacity="0.08" />
            )}
            {pathStr && (
              <path d={pathStr} fill="none" stroke={currentMetric.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {values.map((v, i) => (
              <g key={i}>
                <circle
                  cx={xScale(i)} cy={yScale(v.displayVal)} r="5"
                  fill="white" stroke={currentMetric.color} strokeWidth="2.5"
                />
                {v.source === 'lab' && (
                  <circle cx={xScale(i)} cy={yScale(v.displayVal)} r="2.5" fill={currentMetric.color} />
                )}
                <text
                  x={xScale(i)} y={chartHeight - padding.bottom + 14}
                  textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="system-ui"
                >
                  {dates[i]?.substring(2, 7)}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-heading text-[14px] font-bold text-gray-900 mb-4">{t('testHistory')}</h3>
        {signatureHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-gray-400">
            <p className="font-body text-[13px]">{t('noLabTestsRecorded')}</p>
            <p className="font-body text-[11px] mt-1">{t('goToLabTests')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="font-body text-[11px] text-gray-400 text-left pb-2">{t('date')}</th>
                  <th className="font-body text-[11px] text-gray-400 text-right pb-2">{t('cpW')}</th>
                  <th className="font-body text-[11px] text-gray-400 text-right pb-2">{t('ftpW')}</th>
                  <th className="font-body text-[11px] text-gray-400 text-right pb-2">{t('wPrimeKj')}</th>
                  <th className="font-body text-[11px] text-gray-400 text-right pb-2">{t('cpKg')}</th>
                  <th className="font-body text-[11px] text-gray-400 text-right pb-2">{t('source')}</th>
                  <th className="font-body text-[11px] text-gray-400 text-right pb-2">{t('deltaCp')}</th>
                </tr>
              </thead>
              <tbody>
                {signatureHistory.map((entry, i) => {
                  const prev = i > 0 ? signatureHistory[i - 1] : null;
                  const delta = prev ? entry.cp - prev.cp : null;
                  return (
                    <tr key={entry.date} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="font-body text-[12px] text-gray-700 py-2">{entry.date}</td>
                      <td className="font-heading text-[13px] font-bold text-blue-600 text-right py-2">{entry.cp}</td>
                      <td className="font-body text-[12px] text-gray-600 text-right py-2">{entry.ftpWatts}</td>
                      <td className="font-body text-[12px] text-gray-600 text-right py-2">{Math.round(entry.wPrime / 1000 * 10) / 10}</td>
                      <td className="font-body text-[12px] text-gray-600 text-right py-2">{entry.cpPerKg.toFixed(2)}</td>
                      <td className="text-right py-2">
                        <span className={`font-body text-[10px] px-1.5 py-0.5 rounded-full ${entry.source === 'lab' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                          {entry.source}
                        </span>
                      </td>
                      <td className={`font-body text-[12px] text-right py-2 ${delta === null ? '' : delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}W`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {previous && current && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-heading text-[14px] font-bold text-gray-900 mb-4">Latest vs Previous</h3>
          <div className="grid grid-cols-2 gap-6">
            {[
              { label: 'Critical Power', prev: previous.cp, curr: current.cp, unit: 'W' },
              { label: "W' Anaerobic", prev: Math.round(previous.wPrime / 100) / 10, curr: Math.round(current.wPrime / 100) / 10, unit: 'kJ' },
              { label: 'Peak Power', prev: previous.pMax, curr: current.pMax, unit: 'W' },
              { label: 'CP per kg', prev: previous.cpPerKg.toFixed(2), curr: current.cpPerKg.toFixed(2), unit: 'W/kg' },
            ].map(row => {
              const prevNum = typeof row.prev === 'string' ? parseFloat(row.prev) : row.prev;
              const currNum = typeof row.curr === 'string' ? parseFloat(row.curr) : row.curr;
              const diff = currNum - prevNum;
              const diffPct = prevNum > 0 ? (diff / prevNum) * 100 : 0;
              return (
                <div key={row.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-body text-[11px] text-gray-500">{row.label}</p>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="font-heading text-[18px] font-bold text-gray-900">{row.curr} {row.unit}</span>
                      <span className="font-body text-[11px] text-gray-400">prev: {row.prev}</span>
                    </div>
                  </div>
                  <span className={`font-body text-[13px] font-medium px-2 py-1 rounded-lg ${diff > 0 ? 'bg-green-50 text-green-700' : diff < 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                    {diff > 0 ? '+' : ''}{diffPct.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
