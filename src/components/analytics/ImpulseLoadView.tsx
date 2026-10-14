import { useMemo, useState } from 'react';
import type { Session, Athlete } from '../../lib/database.types';
import { computeDailyImpulseRows, groupByDay, effectiveDailyImpulse, FORMULA_VERSION } from '../../lib/engine/impulse';
import { computeACWR, getACWRColor, getACWRLabel } from '../../lib/engine/acwr';
import { useLanguage } from '../../contexts/LanguageContext';

interface Props {
  sessions: Session[];
  athlete: Athlete;
}

const SPORT_COLORS: Record<string, string> = {
  endurance: '#2563eb',
  cycling: '#7c3aed',
  running: '#d97706',
  strength: '#dc2626',
  beach_volleyball: '#16a34a',
  other: '#94a3b8',
};

const SOURCE_LABELS: Record<string, string> = {
  power: 'Power',
  hr: 'HR',
  pace: 'Pace',
  rpe: 'sRPE',
  default: 'Default',
};

export function ImpulseLoadView({ sessions, athlete }: Props) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'acwr' | 'weekly'>('overview');
  const [showWeeks, setShowWeeks] = useState(16);
  const [includeStrength, setIncludeStrength] = useState(true);

  const rows = useMemo(() => computeDailyImpulseRows(sessions, athlete), [sessions, athlete]);
  const daily = useMemo(() => groupByDay(rows), [rows]);

  const dailyEntries = useMemo(
    () => Array.from(daily.values()).map(d => ({
      date: d.date,
      impulse: effectiveDailyImpulse(d, includeStrength),
    })),
    [daily, includeStrength]
  );

  const totalImpulse = dailyEntries.reduce((s, d) => s + d.impulse, 0);
  const daysWithTraining = dailyEntries.filter(d => d.impulse > 0).length;
  const avgDaily = daysWithTraining > 0 ? totalImpulse / daysWithTraining : 0;

  const measuredRows = rows.filter(r => r.quality === 'measured').length;
  const measuredPct = rows.length > 0 ? Math.round((measuredRows / rows.length) * 100) : 0;

  const acwrSummary = useMemo(() => computeACWR(dailyEntries), [dailyEntries]);

  const weekly = useMemo(() => {
    const weeklyMap = new Map<string, { total: number; byType: Record<string, number> }>();
    for (const row of rows) {
      if (row.sport === 'strength' && !includeStrength) continue;
      const d = new Date(row.date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      const weekStart = d.toISOString().split('T')[0];
      let w = weeklyMap.get(weekStart);
      if (!w) {
        w = { total: 0, byType: {} };
        weeklyMap.set(weekStart, w);
      }
      w.total += row.impulse;
      w.byType[row.sport] = (w.byType[row.sport] ?? 0) + row.impulse;
    }
    return Array.from(weeklyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([weekStart, w]) => ({ weekStart, ...w }));
  }, [rows, includeStrength]);

  const recentWeekly = weekly.slice(-showWeeks);
  const chartWidth = 700;
  const chartHeight = 200;
  const padding = { top: 15, right: 20, bottom: 35, left: 55 };

  const maxWeekly = recentWeekly.length > 0 ? Math.max(...recentWeekly.map(w => w.total)) * 1.1 : 10;

  const acwrRecent = acwrSummary.history.slice(-60);
  const acwrChartH = 180;

  const sportTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      if (row.sport === 'strength' && !includeStrength) continue;
      map.set(row.sport, (map.get(row.sport) ?? 0) + row.impulse);
    }
    return map;
  }, [rows, includeStrength]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-gray-900">{t('impulseLoadTitle')}</h2>
          <p className="font-body text-[13px] text-gray-500 mt-0.5">
            {t('impulseLoadSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeStrength}
              onChange={e => setIncludeStrength(e.target.checked)}
              className="w-4 h-4 accent-gray-900"
            />
            <span className="font-body text-[12px] text-gray-600">{t('includeStrength')}</span>
          </label>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['overview', 'acwr', 'weekly'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-md font-body text-[12px] font-medium transition-all ${
                  activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'overview' ? t('impulseOverviewTab') : tab === 'acwr' ? 'ACWR' : t('impulseWeeklyTab')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: t('fitnessLabel'), value: '—', sub: t('fitnessDesc'), color: '#2563eb' },
          { label: t('avgDailyImpulse'), value: avgDaily.toFixed(1), sub: `${daysWithTraining} ${t('trainingDays')}`, color: '#16a34a' },
          { label: t('totalImpulseLabel'), value: Math.round(totalImpulse).toString(), sub: `${rows.length} ${t('sessionsTotal')}`, color: '#6b7280' },
          { label: t('measuredQuality'), value: `${measuredPct}%`, sub: t('measuredQualityDesc'), color: measuredPct >= 70 ? '#16a34a' : '#f59e0b' },
        ].map(card => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="font-body text-[11px] text-gray-500 uppercase tracking-wide mb-1">{card.label}</p>
            <p className="font-heading text-[22px] font-bold" style={{ color: card.color }}>{card.value}</p>
            <p className="font-body text-[11px] text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-heading text-[14px] font-bold text-gray-900 mb-4">{t('impulseBySport')}</h3>
          <div className="grid grid-cols-3 gap-3">
            {Array.from(sportTotals.entries()).map(([sport, total]) => {
              const pct = totalImpulse > 0 ? (total / totalImpulse) * 100 : 0;
              return (
                <div key={sport} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SPORT_COLORS[sport] ?? '#94a3b8' }} />
                    <span className="font-body text-[11px] text-gray-600 capitalize">{sport.replace('_', ' ')}</span>
                  </div>
                  <p className="font-heading text-[16px] font-bold text-gray-800">{Math.round(total)}</p>
                  <div className="h-1 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: SPORT_COLORS[sport] ?? '#94a3b8' }} />
                  </div>
                </div>
              );
            })}
            {sportTotals.size === 0 && (
              <p className="font-body text-[13px] text-gray-400 col-span-3 text-center py-6">{t('noTrainingData')}</p>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100">
            <h4 className="font-body text-[12px] text-gray-500 uppercase tracking-wide mb-3">{t('intensitySources')}</h4>
            <div className="flex flex-wrap gap-3">
              {Object.entries(SOURCE_LABELS).map(([source, label]) => {
                const count = rows.filter(r => r.intensitySource === source).length;
                if (count === 0) return null;
                return (
                  <div key={source} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5">
                    <span className="font-body text-[11px] text-gray-500">{label}</span>
                    <span className="font-heading text-[12px] font-bold text-gray-800">{count}</span>
                  </div>
                );
              })}
            </div>
            <p className="font-body text-[10px] text-gray-400 mt-2">
              {t('formulaVersion')} v{FORMULA_VERSION}
            </p>
          </div>
        </div>
      )}

      {activeTab === 'acwr' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-[14px] font-bold text-gray-900">Acute:Chronic Workload Ratio</h3>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getACWRColor(acwrSummary.riskZone) }} />
              <span className="font-body text-[12px] font-medium" style={{ color: getACWRColor(acwrSummary.riskZone) }}>
                {getACWRLabel(acwrSummary.riskZone)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-5">
            {[
              { label: 'Current ACWR', value: acwrSummary.current?.acwr.toFixed(2) ?? '—', color: getACWRColor(acwrSummary.riskZone) },
              { label: 'Acute Load (7d)', value: acwrSummary.current?.acuteLoad.toFixed(1) ?? '—', color: '#d97706' },
              { label: 'Chronic Load (28d)', value: acwrSummary.current?.chronicLoad.toFixed(1) ?? '—', color: '#6b7280' },
              { label: 'Trend', value: acwrSummary.trendDirection, color: acwrSummary.trendDirection === 'increasing' ? '#ef4444' : acwrSummary.trendDirection === 'decreasing' ? '#16a34a' : '#6b7280' },
            ].map(c => (
              <div key={c.label} className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="font-body text-[10px] text-gray-400 uppercase tracking-wide mb-1">{c.label}</p>
                <p className="font-heading text-[18px] font-bold capitalize" style={{ color: c.color }}>{c.value}</p>
              </div>
            ))}
          </div>

          {acwrRecent.length < 7 ? (
            <div className="flex items-center justify-center h-32 text-gray-400">
              <p className="font-body text-[13px]">{t('needMoreDataAcwr')}</p>
            </div>
          ) : (
            <svg viewBox={`0 0 ${chartWidth} ${acwrChartH}`} className="w-full" style={{ height: acwrChartH }}>
              {[0.6, 0.8, 1.0, 1.3, 1.5, 1.8].map(line => {
                const y = 10 + (acwrChartH - 30) - ((line / 2) * (acwrChartH - 30));
                const isZone = line === 0.8 || line === 1.3;
                return (
                  <g key={line}>
                    <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y}
                      stroke={isZone ? '#fde68a' : '#f1f5f9'} strokeWidth={isZone ? 1.5 : 1}
                      strokeDasharray={isZone ? '4 2' : undefined} />
                    <text x={padding.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="system-ui">{line}</text>
                  </g>
                );
              })}
              {(() => {
                const acwrPath = acwrRecent.map((h, i) => {
                  const x = padding.left + (i / (acwrRecent.length - 1)) * (chartWidth - padding.left - padding.right);
                  const y = 10 + (acwrChartH - 30) - ((h.acwr / 2) * (acwrChartH - 30));
                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ');
                return <path d={acwrPath} fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" />;
              })()}
              {acwrRecent.map((h, i) => {
                const x = padding.left + (i / (acwrRecent.length - 1)) * (chartWidth - padding.left - padding.right);
                const y = 10 + (acwrChartH - 30) - ((h.acwr / 2) * (acwrChartH - 30));
                return (
                  <circle key={i} cx={x} cy={y} r="3" fill={getACWRColor(h.riskZone)} fillOpacity="0.8" />
                );
              })}
            </svg>
          )}

          <div className="flex items-center gap-4 mt-3">
            {[
              { color: '#94a3b8', label: 'Underload (<0.8)' },
              { color: '#22c55e', label: 'Optimal (0.8-1.3)' },
              { color: '#f59e0b', label: 'Caution (1.3-1.5)' },
              { color: '#ef4444', label: 'High Risk (>1.5)' },
            ].map(z => (
              <div key={z.label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: z.color }} />
                <span className="font-body text-[10px] text-gray-500">{z.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'weekly' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-[14px] font-bold text-gray-900">{t('weeklyImpulseDistribution')}</h3>
            <div className="flex items-center gap-2">
              {[8, 16, 26, 52].map(w => (
                <button
                  key={w}
                  onClick={() => setShowWeeks(w)}
                  className={`px-2 py-1 rounded-md font-body text-[11px] transition-all ${
                    showWeeks === w ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {w}w
                </button>
              ))}
            </div>
          </div>

          {recentWeekly.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400">
              <p className="font-body text-[13px]">{t('noTrainingData')}</p>
            </div>
          ) : (
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full" style={{ height: 200 }}>
              {[0, maxWeekly * 0.5, maxWeekly].map((v, i) => {
                const y = padding.top + chartHeight - padding.bottom - (v / maxWeekly) * (chartHeight - padding.top - padding.bottom);
                return (
                  <g key={i}>
                    <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                    <text x={padding.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="system-ui">{Math.round(v)}</text>
                  </g>
                );
              })}
              {recentWeekly.map((week, i) => {
                const barWidth = Math.max(4, (chartWidth - padding.left - padding.right) / recentWeekly.length - 2);
                const x = padding.left + i * ((chartWidth - padding.left - padding.right) / recentWeekly.length);
                const barH = (week.total / maxWeekly) * (chartHeight - padding.top - padding.bottom);
                const y = chartHeight - padding.bottom - barH;
                return (
                  <g key={week.weekStart}>
                    <rect x={x + 1} y={y} width={barWidth} height={Math.max(0, barH)} fill="#2563eb" fillOpacity="0.85" rx="1" />
                    {recentWeekly.length <= 12 && (
                      <text x={x + barWidth / 2} y={chartHeight - padding.bottom + 12} textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="system-ui">
                        {week.weekStart.substring(5, 10)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}

          <div className="flex flex-wrap items-center gap-4 mt-4">
            {Object.entries(SPORT_COLORS).map(([sport, color]) => {
              if (!sportTotals.has(sport)) return null;
              return (
                <div key={sport} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="font-body text-[10px] text-gray-500 capitalize">{sport.replace('_', ' ')}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="font-body text-[10px] text-gray-400 text-left pb-1.5">{t('week')}</th>
                  <th className="font-body text-[10px] text-gray-400 pb-1.5">{t('totalImpulseLabel')}</th>
                  <th className="font-body text-[10px] text-gray-400 pb-1.5">{t('fitnessLabel')}</th>
                </tr>
              </thead>
              <tbody>
                {recentWeekly.slice(-8).map(week => (
                  <tr key={week.weekStart} className="border-b border-gray-50">
                    <td className="font-body text-[11px] text-gray-600 text-left py-1">{week.weekStart}</td>
                    <td className={`font-body text-[11px] py-1 ${week.total > avgDaily * 7 * 1.2 ? 'text-orange-600 font-medium' : 'text-gray-700'}`}>{week.total.toFixed(0)}</td>
                    <td className="font-body text-[11px] text-blue-600 py-1">{Object.entries(week.byType).map(([k, v]) => `${k}: ${Math.round(v)}`).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
