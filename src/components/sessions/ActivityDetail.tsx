import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fetchPowerStream, type HubPowerStream } from '../../lib/hub/hubApiService';
import { cleanPowerStream } from '../../lib/engine/powerAnalysis';
import { computeCpModel } from '../../lib/engine/cpModel';
import { computeWbalSeries, type WbalSeriesPoint } from '../../lib/engine/wbal';
import type { Session, Athlete } from '../../lib/database.types';

interface MetricsRow {
  np_watts: number | null;
  vi: number | null;
  ef: number | null;
  decoupling_pct: number | null;
  min_wbal_kj: number | null;
  min_wbal_pct: number | null;
  seconds_below_25pct: number | null;
}

interface ThresholdRow {
  cp_watts: number | null;
}

interface MmpRow {
  duration_s: number;
  watts: number;
  date: string;
  activity_id: string;
}

const W = 640;
const H = 170;
const PAD = { top: 10, right: 12, bottom: 20, left: 40 };

function Chip({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div
      className="px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
      title={label}
    >
      <span className="text-[9px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-mono">{label}</span>
      <span className={`ml-1.5 text-[11px] font-semibold font-mono ${warn ? 'text-[#8A6900] dark:text-[#F7C843]' : 'text-gray-900 dark:text-white'}`}>{value}</span>
    </div>
  );
}

/**
 * Activity detail panel: NP/VI/EF/decoupling + W'bal chips from stored
 * activity_metrics, and an on-demand W'bal chart fetched from the power
 * stream (downsampled to 1 point / 5 s, never stored).
 */
export function ActivityDetail({ session, athlete }: { session: Session; athlete: Athlete }) {
  const [metrics, setMetrics] = useState<MetricsRow | null>(null);
  const [metricsLoaded, setMetricsLoaded] = useState(false);
  const [cp, setCp] = useState<number | null>(null);
  const [wPrimeJ, setWPrimeJ] = useState<number | null>(null);
  const [series, setSeries] = useState<WbalSeriesPoint[] | null>(null);
  const [wbalState, setWbalState] = useState<'idle' | 'loading' | 'no-stream' | 'no-cp' | 'ready'>('idle');
  const [hover, setHover] = useState<{ x: number; y: number; point: WbalSeriesPoint } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMetricsLoaded(false);
      setMetrics(null);
      const [{ data: m }, { data: t }, { data: mmp }, { data: best1s }] = await Promise.all([
        supabase
          .from('activity_metrics')
          .select('np_watts,vi,ef,decoupling_pct,min_wbal_kj,min_wbal_pct,seconds_below_25pct')
          .eq('activity_id', session.id)
          .maybeSingle(),
        supabase
          .from('athlete_thresholds')
          .select('cp_watts')
          .eq('athlete_id', athlete.id)
          .lte('effective_from', session.session_date)
          .order('effective_from', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('activity_mmp')
          .select('duration_s,watts,date,activity_id')
          .eq('athlete_id', athlete.id)
          .order('date', { ascending: true }),
        supabase
          .from('activity_mmp')
          .select('watts')
          .eq('athlete_id', athlete.id)
          .eq('duration_s', 1)
          .order('watts', { ascending: false })
          .limit(1),
      ]);
      if (cancelled) return;
      setMetrics((m as unknown as MetricsRow) ?? null);
      setCp(t ? (t as unknown as ThresholdRow).cp_watts : null);

      // Same client-side CP fit the analytics page uses; W′bal needs the
      // W′ only when the model confidence is high.
      const mmpRows = (mmp ?? []) as unknown as MmpRow[];
      const model = computeCpModel({
        athlete,
        mmpWattsByDuration: mmpRows.map(r => ({
          durationS: r.duration_s,
          watts: r.watts,
          date: r.date,
          activityId: r.activity_id,
        })),
        labCp: athlete.cp_watts || athlete.ftp_watts || null,
        best1sWatts: best1s && best1s.length > 0 ? Number((best1s[0] as { watts: number }).watts) : null,
      });
      setWPrimeJ(model.status === 'ok' && model.confidence === 'high' ? model.wPrimeJ : null);
      setMetricsLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [session.id, session.session_date, athlete.id]);

  const loadWbal = async () => {
    if (wbalState === 'loading') return;
    setWbalState('loading');
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('hub_planner_token, hub_connection_active')
        .eq('id', athlete.user_id)
        .maybeSingle();
      if (!profile?.hub_planner_token || !profile?.hub_connection_active) {
        setWbalState('no-stream');
        return;
      }
      const stream: HubPowerStream = await fetchPowerStream(
        profile.hub_planner_token,
        session.athlete_id ? (athlete.email ?? '') : '',
        session.id
      );
      if (!stream?.series?.watts?.length) {
        setWbalState('no-stream');
        return;
      }
      const clean = cleanPowerStream({ times: stream.series.time_s, watts: stream.series.watts });
      const cpWatts = cp ?? null;
      if (!clean || !cpWatts || cpWatts <= 0) {
        setWbalState('no-cp');
        return;
      }
      if (!wPrimeJ) {
        setWbalState('no-cp');
        return;
      }
      setSeries(computeWbalSeries(clean, cpWatts, wPrimeJ));
      setWbalState('ready');
    } catch {
      setWbalState('no-stream');
    }
  };

  const chart = useMemo(() => {
    if (!series) return null;
    const wbalKj = (p: WbalSeriesPoint) => (wPrimeJ ? p.wbalJ / 1000 : 0);
    const wPrimeKj = wPrimeJ ? wPrimeJ / 1000 : 0;
    const vals = series.map(wbalKj);
    const max = wPrimeKj;
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const xOf = (t: number) => {
      const lastT = series[series.length - 1]?.t ?? 1;
      return PAD.left + (t / Math.max(1, lastT)) * plotW;
    };
    const yOf = (v: number) => PAD.top + plotH - (Math.max(0, Math.min(v, max)) / max) * plotH;
    const warnY = yOf(0.25 * wPrimeKj);
    return { xOf, yOf, warnY, wPrimeKj, plotH };
  }, [series, wPrimeJ]);

  const efWarn = metrics?.vi !== null && metrics?.vi !== undefined && metrics.vi > 1.1;

  return (
    <div className="space-y-3">
      {metricsLoaded ? (
        metrics ? (
          <div className="flex flex-wrap gap-1.5">
            <Chip label="NP" value={metrics.np_watts !== null ? `${Math.round(Number(metrics.np_watts))}W` : '—'} />
            <Chip label="VI" value={metrics.vi !== null ? Number(metrics.vi).toFixed(2) : '—'} warn={efWarn} />
            <Chip label="EF" value={metrics.ef !== null ? Number(metrics.ef).toFixed(2) : '—'} />
            <Chip label="Decoupling" value={metrics.decoupling_pct !== null ? `${Number(metrics.decoupling_pct).toFixed(1)}%` : '—'} />
            <Chip label="W′bal min" value={metrics.min_wbal_kj !== null ? `${Number(metrics.min_wbal_kj).toFixed(1)}kJ` : '—'} />
            <Chip label="W′bal min %" value={metrics.min_wbal_pct !== null ? `${Number(metrics.min_wbal_pct).toFixed(0)}%` : '—'} />
            <Chip label="<25% time" value={metrics.seconds_below_25pct !== null ? `${metrics.seconds_below_25pct}s` : '—'} />
          </div>
        ) : (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 italic">
            No stored stream metrics for this session — requires power stream ingestion.
          </p>
        )
      ) : (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">Loading metrics…</p>
      )}

      <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
        {wbalState === 'idle' && (
          <button
            onClick={loadWbal}
            className="text-[11px] font-medium text-[#2A1F4A] dark:text-[#B8A9E5] hover:text-[#2A1F4A] dark:text-[#B8A9E5] transition-colors"
          >
            Load W′bal chart
          </button>
        )}
        {wbalState === 'loading' && <p className="text-[11px] text-gray-500 dark:text-gray-400">Loading W′bal…</p>}
        {wbalState === 'no-stream' && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 italic">Requires power stream</p>
        )}
        {wbalState === 'no-cp' && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 italic">Requires high-confidence CP</p>
        )}
        {wbalState === 'ready' && series && chart && (
          <div>
            <p className="text-[10px] font-mono uppercase text-gray-500 dark:text-gray-400 mb-1">
              W′ balance — CP {Math.round(cp!)}W · W′ {Math.round(wPrimeJ! / 100) / 10}kJ
            </p>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} onMouseLeave={() => setHover(null)}>
              <rect
                x={PAD.left}
                y={chart.warnY}
                width={W - PAD.left - PAD.right}
                height={PAD.top + chart.plotH - chart.warnY}
                fill="#fbbf24"
                opacity="0.12"
              />
              <path
                d={series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${chart.xOf(p.t)} ${chart.yOf(chart.wPrimeKj - p.wbalJ / 1000)} `).join('')}
                fill="none"
                stroke="#2A1F4A"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <line
                x1={PAD.left}
                y1={chart.warnY}
                x2={W - PAD.right}
                y2={chart.warnY}
                stroke="#8A6900"
                strokeWidth="1"
                strokeDasharray="4 3"
              />
              {[0, 0.5, 1].map(frac => (
                <text
                  key={frac}
                  x={PAD.left - 5}
                  y={chart.yOf(chart.wPrimeKj * frac) + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="#64748b"
                  fontFamily="system-ui"
                >
                  {(chart.wPrimeKj * frac).toFixed(1)}
                </text>
              ))}
              {[0, 0.5, 1].map(frac => (
                <text
                  key={`x-${frac}`}
                  x={chart.xOf((series[series.length - 1]?.t ?? 1) * frac)}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#64748b"
                  fontFamily="system-ui"
                >
                  {Math.round(((series[series.length - 1]?.t ?? 0) * frac) / 60)}min
                </text>
              ))}
              <rect
                x={PAD.left}
                y={PAD.top}
                width={W - PAD.left - PAD.right}
                height={chart.plotH}
                fill="transparent"
                onMouseMove={e => {
                  const rect = (e.target as SVGRectElement).getBoundingClientRect();
                  const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  const idx = Math.round(frac * (series.length - 1));
                  const point = series[Math.max(0, Math.min(series.length - 1, idx))];
                  setHover({ x: chart.xOf(point.t), y: chart.yOf(chart.wPrimeKj - point.wbalJ / 1000), point });
                }}
              />
              {hover && (
                <g>
                  <line x1={hover.x} y1={PAD.top} x2={hover.x} y2={PAD.top + chart.plotH} stroke="var(--chart-label)" strokeWidth="0.5" />
                  <circle cx={hover.x} cy={hover.y} r="3" fill="#2A1F4A" />
                  <text
                    x={Math.min(hover.x + 6, W - 70)}
                    y={Math.max(12, hover.y - 6)}
                    fontSize="10"
                    fill="var(--chart-grid)"
                    fontFamily="system-ui"
                  >
                    {(hover.point.wbalJ / 1000).toFixed(1)} kJ · {Math.floor(hover.point.t / 60)}:{String(hover.point.t % 60).padStart(2, '0')}
                  </text>
                </g>
              )}
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
