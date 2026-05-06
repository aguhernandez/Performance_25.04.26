import { useMemo, useState } from 'react';
import type { Session, Athlete } from '../../lib/database.types';
import { buildTSSSummary, computeCTLATL } from '../../lib/engine/tssMetrics';
import { computeACWR, getACWRColor, getACWRLabel } from '../../lib/engine/acwr';

interface Props {
  sessions: Session[];
  athlete: Athlete;
}

const TYPE_COLORS: Record<string, string> = {
  pTSS: '#2563eb',
  hrTSS: '#16a34a',
  rTSS: '#d97706',
  sTSS: '#dc2626',
  bvTSS: '#7c3aed',
};

const TYPE_LABELS: Record<string, string> = {
  pTSS: 'Power TSS',
  hrTSS: 'HR TSS',
  rTSS: 'Running TSS',
  sTSS: 'Strength TSS',
  bvTSS: 'Beach Volley TSS',
};

export function TSSLoadView({ sessions, athlete }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'acwr' | 'weekly'>('overview');
  const [showWeeks, setShowWeeks] = useState(16);

  const tssSummary = useMemo(() => buildTSSSummary(sessions, athlete), [sessions, athlete]);
  const { history: ctlHistory } = useMemo(() => computeCTLATL(tssSummary.entries), [tssSummary.entries]);
  const acwrSummary = useMemo(() => computeACWR(tssSummary.entries), [tssSummary.entries]);

  const recentWeekly = tssSummary.weekly.slice(-showWeeks);
  const chartWidth = 700;
  const chartHeight = 200;
  const padding = { top: 15, right: 20, bottom: 35, left: 55 };

  const maxWeeklyTSS = recentWeekly.length > 0 ? Math.max(...recentWeekly.map(w => w.tss)) * 1.1 : 100;
  const xStep = recentWeekly.length > 1 ? (chartWidth - padding.left - padding.right) / (recentWeekly.length - 1) : 0;

  const ctlRecent = ctlHistory.slice(-90);
  const maxCTL = ctlRecent.length > 0 ? Math.max(...ctlRecent.map(h => Math.max(h.ctl, h.atl))) * 1.2 : 100;

  const ctlPath = ctlRecent.map((h, i) => {
    const x = padding.left + (i / (ctlRecent.length - 1)) * (chartWidth - padding.left - padding.right);
    const y = padding.top + chartHeight - padding.bottom - (h.ctl / maxCTL) * (chartHeight - padding.top - padding.bottom);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const atlPath = ctlRecent.map((h, i) => {
    const x = padding.left + (i / (ctlRecent.length - 1)) * (chartWidth - padding.left - padding.right);
    const y = padding.top + chartHeight - padding.bottom - (h.atl / maxCTL) * (chartHeight - padding.top - padding.bottom);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const tsbPath = ctlRecent.map((h, i) => {
    const x = padding.left + (i / (ctlRecent.length - 1)) * (chartWidth - padding.left - padding.right);
    const midY = padding.top + chartHeight - padding.bottom - (0 / maxCTL) * (chartHeight - padding.top - padding.bottom);
    const y = midY - (h.tsb / maxCTL) * (chartHeight - padding.top - padding.bottom);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const acwrRecent = acwrSummary.history.slice(-60);
  const acwrChartH = 180;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-gray-900">Training Load & TSS</h2>
          <p className="font-body text-[13px] text-gray-500 mt-0.5">
            CTL · ATL · TSB — Training Stress Balance across all modalities
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['overview', 'acwr', 'weekly'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md font-body text-[12px] font-medium transition-all ${
                activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'overview' ? 'CTL/ATL/TSB' : tab === 'acwr' ? 'ACWR' : 'Weekly TSS'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'CTL (Fitness)', value: tssSummary.ctl.toFixed(1), sub: '42-day avg load', color: '#2563eb' },
          { label: 'ATL (Fatigue)', value: tssSummary.atl.toFixed(1), sub: '7-day avg load', color: '#ef4444' },
          { label: 'TSB (Form)', value: tssSummary.tsb.toFixed(1), sub: tssSummary.tsb > 5 ? 'Fresh — ready to race' : tssSummary.tsb < -20 ? 'Fatigued' : 'Balanced', color: tssSummary.tsb > 0 ? '#16a34a' : '#ef4444' },
          { label: 'Avg Weekly TSS', value: `${tssSummary.avgWeeklyTSS}`, sub: `${tssSummary.entries.length} sessions total`, color: '#6b7280' },
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
          <div className="flex items-center gap-5 mb-4">
            <h3 className="font-heading text-[14px] font-bold text-gray-900 flex-1">CTL · ATL · TSB — 90 Days</h3>
            <div className="flex items-center gap-1.5"><div className="w-6 h-0.5 bg-blue-600" /><span className="font-body text-[11px] text-gray-500">CTL</span></div>
            <div className="flex items-center gap-1.5"><div className="w-6 h-0.5 bg-red-500" /><span className="font-body text-[11px] text-gray-500">ATL</span></div>
            <div className="flex items-center gap-1.5"><div className="w-6 h-0.5 bg-green-500 border-dashed" style={{ borderTop: '2px dashed #16a34a' }} /><span className="font-body text-[11px] text-gray-500">TSB</span></div>
          </div>
          {ctlRecent.length < 5 ? (
            <div className="flex items-center justify-center h-40 text-gray-400">
              <p className="font-body text-[13px]">Not enough data — add training sessions to see CTL/ATL trends</p>
            </div>
          ) : (
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full" style={{ height: 200 }}>
              {[0, maxCTL * 0.25, maxCTL * 0.5, maxCTL * 0.75, maxCTL].map((v, i) => {
                const y = padding.top + chartHeight - padding.bottom - (v / maxCTL) * (chartHeight - padding.top - padding.bottom);
                return (
                  <g key={i}>
                    <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                    <text x={padding.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="system-ui">{Math.round(v)}</text>
                  </g>
                );
              })}
              <path d={tsbPath} fill="none" stroke="#16a34a" strokeWidth="1.5" strokeDasharray="3 2" strokeLinecap="round" />
              <path d={atlPath} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
              <path d={ctlPath} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          )}

          <div className="mt-4">
            <h4 className="font-body text-[12px] text-gray-500 uppercase tracking-wide mb-3">TSS by Modality (last 30 days)</h4>
            <div className="grid grid-cols-5 gap-3">
              {Object.entries(TYPE_LABELS).map(([key, label]) => {
                const recent = tssSummary.entries.filter(e => {
                  const cutoff = new Date();
                  cutoff.setDate(cutoff.getDate() - 30);
                  return new Date(e.date) >= cutoff && e.tssType === key;
                });
                const total = recent.reduce((sum, e) => sum + e.tss, 0);
                if (total === 0) return null;
                return (
                  <div key={key} className="text-center">
                    <div className="w-8 h-8 rounded-full mx-auto flex items-center justify-center mb-1" style={{ backgroundColor: TYPE_COLORS[key] + '20' }}>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TYPE_COLORS[key] }} />
                    </div>
                    <p className="font-heading text-[14px] font-bold text-gray-800">{Math.round(total)}</p>
                    <p className="font-body text-[10px] text-gray-400">{label.split(' ')[0]}</p>
                  </div>
                );
              }).filter(Boolean)}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'acwr' && (
        <div className="space-y-4">
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
                <p className="font-body text-[13px]">Need more training data to show ACWR trends</p>
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

                {acwrRecent.map((h, i) => {
                  const x = padding.left + (i / (acwrRecent.length - 1)) * (chartWidth - padding.left - padding.right);
                  const y = 10 + (acwrChartH - 30) - ((h.acwr / 2) * (acwrChartH - 30));
                  return (
                    <circle key={i} cx={x} cy={y} r="3"
                      fill={getACWRColor(h.riskZone)} fillOpacity="0.8" />
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
        </div>
      )}

      {activeTab === 'weekly' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-[14px] font-bold text-gray-900">Weekly TSS Distribution</h3>
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
              <p className="font-body text-[13px]">No training data available</p>
            </div>
          ) : (
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full" style={{ height: 200 }}>
              {[0, maxWeeklyTSS * 0.5, maxWeeklyTSS].map((v, i) => {
                const y = padding.top + chartHeight - padding.bottom - (v / maxWeeklyTSS) * (chartHeight - padding.top - padding.bottom);
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
                const barH = (week.tss / maxWeeklyTSS) * (chartHeight - padding.top - padding.bottom);
                const y = chartHeight - padding.bottom - barH;

                const tssTypes = Object.entries(week.byType).filter(([k]) => k !== 'total');
                let yOffset = chartHeight - padding.bottom;
                const segments = tssTypes.map(([type, val]) => {
                  const h = (val / maxWeeklyTSS) * (chartHeight - padding.top - padding.bottom);
                  yOffset -= h;
                  return { type, h, y: yOffset };
                });

                return (
                  <g key={week.weekStart}>
                    {segments.map(seg => (
                      <rect
                        key={seg.type}
                        x={x + 1}
                        y={seg.y}
                        width={barWidth}
                        height={seg.h}
                        fill={TYPE_COLORS[seg.type] ?? '#94a3b8'}
                        fillOpacity="0.85"
                        rx="1"
                      />
                    ))}
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
            {Object.entries(TYPE_LABELS).map(([key, label]) => {
              const hasData = tssSummary.entries.some(e => e.tssType === key);
              if (!hasData) return null;
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: TYPE_COLORS[key] }} />
                  <span className="font-body text-[10px] text-gray-500">{label}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="font-body text-[10px] text-gray-400 text-left pb-1.5">Week</th>
                  <th className="font-body text-[10px] text-gray-400 pb-1.5">Total TSS</th>
                  <th className="font-body text-[10px] text-gray-400 pb-1.5">CTL</th>
                  <th className="font-body text-[10px] text-gray-400 pb-1.5">ATL</th>
                  <th className="font-body text-[10px] text-gray-400 pb-1.5">TSB</th>
                </tr>
              </thead>
              <tbody>
                {recentWeekly.slice(-8).map(week => (
                  <tr key={week.weekStart} className="border-b border-gray-50">
                    <td className="font-body text-[11px] text-gray-600 text-left py-1">{week.weekStart}</td>
                    <td className={`font-body text-[11px] py-1 ${week.tss > tssSummary.avgWeeklyTSS * 1.2 ? 'text-orange-600 font-medium' : 'text-gray-700'}`}>{week.tss.toFixed(0)}</td>
                    <td className="font-body text-[11px] text-blue-600 py-1">{week.ctl.toFixed(1)}</td>
                    <td className="font-body text-[11px] text-red-500 py-1">{week.atl.toFixed(1)}</td>
                    <td className={`font-body text-[11px] py-1 ${week.tsb > 0 ? 'text-green-600' : 'text-red-500'}`}>{week.tsb > 0 ? '+' : ''}{week.tsb.toFixed(1)}</td>
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
