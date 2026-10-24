import type { Session, Athlete } from '../database.types';
import {
  cleanPowerStream,
  computePowerStats,
  computeMeanMaxPower,
  computePerRideMetrics,
  type PowerStream,
} from './powerAnalysis';
import { saveActivityMmp, saveActivityMetrics, saveActivityDurability, loadExistingFingerprints, type ActivityMmpRow, type ActivityMetricsRow, type ActivityDurabilityRow } from './cpPersistence';
import { computeWbalSummary, computeDurabilityRows } from './wbal';
import type { HubPowerStream } from '../hub/hubApiService';

export interface IngestResult {
  processed: number;
  skipped: number;
  discarded: number;
  wbalComputed: number;
  durabilityRows: number;
}

/** CP + W′ in effect for a ride date; W′ must come from a high-confidence model. */
export interface IngestThresholds {
  cpWatts: number;
  wPrimeJ: number | null;
}

function fingerprint(stream: PowerStream): string {
  // Cheap stable hash of the watt series so re-ingestion only recomputes
  // when the stream actually changed.
  let h = 5381;
  for (let i = 0; i < stream.watts.length; i++) {
    const w = stream.watts[i];
    h = ((h * 33) ^ (w === null ? -1 : w)) >>> 0;
  }
  h = ((h * 33) ^ stream.times.length) >>> 0;
  return `v1-${h.toString(16)}-${stream.times.length}`;
}

function toPowerStream(hub: HubPowerStream): PowerStream | null {
  if (!hub.series || !Array.isArray(hub.series.time_s) || !Array.isArray(hub.series.watts)) return null;
  if (hub.series.time_s.length === 0) return null;
  return { times: hub.series.time_s, watts: hub.series.watts };
}

/**
 * Ingest power streams for a set of sessions: compute NP/VI/MMP/EF/decoupling
 * from the REAL stream (never session averages) and persist to activity_mmp /
 * activity_metrics. Activities are computed only when first ingested or when
 * their stream fingerprint changed.
 */
export async function ingestPowerStreams(
  athlete: Athlete,
  sessions: Session[],
  streams: HubPowerStream[],
  thresholdsForDate?: (date: string) => IngestThresholds | null
): Promise<IngestResult> {
  const result: IngestResult = { processed: 0, skipped: 0, discarded: 0, wbalComputed: 0, durabilityRows: 0 };
  if (streams.length === 0) return result;

  const fingerprints = await loadExistingFingerprints(athlete.id);
  const sessionById = new Map(sessions.flatMap(s => [[s.id, s] as const, ...(typeof s.raw_data?.hub_activity_id === 'string' ? [[s.raw_data.hub_activity_id, s] as const] : [])]));
  const mmpRows: ActivityMmpRow[] = [];
  const metricsRows: ActivityMetricsRow[] = [];
  const durabilityAllRows: ActivityDurabilityRow[] = [];

  for (const hub of streams) {
    const session = sessionById.get(hub.activity_id);
    if (!session) {
      result.skipped++;
      continue;
    }

    const stream = toPowerStream(hub);
    if (!stream) {
      result.discarded++;
      continue;
    }

    const fp = fingerprint(stream);
    if (fingerprints.get(session.id) === fp) {
      result.skipped++;
      continue;
    }

    const clean = cleanPowerStream(stream);
    if (!clean) {
      result.discarded++;
      continue;
    }

    const stats = computePowerStats(clean);
    if (!stats) {
      // <5 min of power or >20% missing → no MMP point, no metrics
      result.discarded++;
      continue;
    }

    const mmp = computeMeanMaxPower(clean);
    for (const pt of mmp) {
      mmpRows.push({
        activity_id: session.id,
        athlete_id: athlete.id,
        date: session.session_date,
        duration_s: pt.durationS,
        watts: pt.watts,
        np: stats.np,
        vi: stats.vi,
        source: 'stream',
      });
    }

    const hrSeries = hub.series?.hr ?? null;
    const perRide = hrSeries
      ? computePerRideMetrics(clean, hrSeries, stats)
      : { ef: null, decouplingPct: null };

    // W′bal + durability: only with a stream and the CP in effect for the
    // ride date; W′bal additionally requires a high-confidence W′.
    let minWbalKj: number | null = null;
    let minWbalPct: number | null = null;
    let secondsBelow25: number | null = null;
    let durabilityRows: ActivityDurabilityRow[] = [];
    const thresholds = thresholdsForDate?.(session.session_date) ?? null;
    if (thresholds && thresholds.cpWatts > 0) {
      durabilityRows = computeDurabilityRows(clean, session.id, athlete.id, session.session_date);
      result.durabilityRows += durabilityRows.length;
      if (thresholds.wPrimeJ && thresholds.wPrimeJ > 0) {
        const wbal = computeWbalSummary(clean, thresholds.cpWatts, thresholds.wPrimeJ);
        minWbalKj = wbal.minWbalKj;
        minWbalPct = wbal.minWbalPct;
        secondsBelow25 = wbal.secondsBelow25;
        result.wbalComputed++;
      }
    }

    metricsRows.push({
      activity_id: session.id,
      athlete_id: athlete.id,
      date: session.session_date,
      avg_power_watts: stats.avgWatts,
      np_watts: stats.np,
      vi: stats.vi,
      avg_hr: hrSeries ? avgOf(hrSeries) : null,
      ef: perRide.ef,
      decoupling_pct: perRide.decouplingPct,
      stream_fingerprint: fp,
      min_wbal_kj: minWbalKj,
      min_wbal_pct: minWbalPct,
      seconds_below_25pct: secondsBelow25,
    });
    durabilityAllRows.push(...durabilityRows);

    result.processed++;
  }

  await saveActivityMmp(mmpRows);
  for (const row of metricsRows) {
    await saveActivityMetrics(row);
  }
  await saveActivityDurability(durabilityAllRows);

  return result;
}

function avgOf(series: (number | null)[]): number | null {
  let sum = 0;
  let count = 0;
  for (const v of series) {
    if (v !== null && v > 0) {
      sum += v;
      count++;
    }
  }
  return count > 0 ? Math.round(sum / count) : null;
}
