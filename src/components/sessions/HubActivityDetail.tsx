import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useHubData } from '../../hooks/useHubData';
import { fetchHubStream } from '../../lib/hub/hubContext';
import { cleanPowerStream, computePowerStats } from '../../lib/engine/powerAnalysis';
import type { HubPowerStream } from '../../lib/hub/hubApiService';
import type { Session } from '../../lib/database.types';

type Channel = 'speed' | 'hr' | 'watts' | 'altitude' | 'cadence';
const CHANNELS: { key: Channel; label: string; unit: string }[] = [{ key: 'speed', label: 'Velocidad', unit: 'km/h' }, { key: 'hr', label: 'Pulso', unit: 'bpm' }, { key: 'watts', label: 'Potencia', unit: 'W' }, { key: 'altitude', label: 'Altitud', unit: 'm' }, { key: 'cadence', label: 'Cadencia', unit: 'rpm' }];
export function HubActivityDetail({ session }: { session: Session }) {
  const { profile } = useAuth();
  const { tokenConfig, error: configError } = useHubData(profile?.id);
  const [stream, setStream] = useState<HubPowerStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState<Channel>('speed');
  useEffect(() => {
    let active = true;
    setStream(null); setError(null);
    if (!tokenConfig?.token || !session.raw_data?.hub_activity_id) return;
    setLoading(true);
    void fetchHubStream(tokenConfig.token, String(session.raw_data.hub_athlete_id), String(session.raw_data.hub_activity_id), String(session.raw_data.hub_source))
      .then(result => { if (active) { setStream(result); const available = CHANNELS.find(c => result.series?.[c.key]?.length); if (available) setChannel(available.key); } })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'No se pudieron leer las series'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session.id, tokenConfig?.token]);
  const stats = useMemo(() => {
    if (session.session_type !== 'cycling' || !stream?.series?.watts) return null;
    const clean = cleanPowerStream({ times: stream.series.time_s, watts: stream.series.watts });
    return clean ? computePowerStats(clean) : null;
  }, [stream, session.session_type]);
  const channels = CHANNELS.filter(c => stream?.series?.[c.key]?.some(v => v !== null));
  const selected = CHANNELS.find(c => c.key === channel)!;
  const plot = useMemo(() => {
    const values = stream?.series?.[channel] ?? [];
    const times = stream?.series?.time_s ?? [];
    const points = values.flatMap((value, index) => value === null || !Number.isFinite(value) || !Number.isFinite(times[index]) ? [] : [{ t: times[index], v: channel === 'speed' ? value * 3.6 : value }]);
    if (!points.length) return null;
    let low = Infinity, high = -Infinity;
    for (const p of points) { low = Math.min(low, p.v); high = Math.max(high, p.v); }
    const start = points[0].t, duration = Math.max(1, points[points.length - 1].t - start);
    const stride = Math.max(1, Math.ceil(points.length / 1000));
    const path = points.filter((_, i) => i % stride === 0).map(p => `${20 + (p.t - start) / duration * 600},${150 - (p.v - low) / Math.max(1, high - low) * 130}`).join(' ');
    return { path, low, high, duration };
  }, [stream, channel]);
  return <div className="space-y-3 text-xs">
    <p className="text-gray-500">Fuente: Hub · {session.sub_sport || session.session_type}. Los datos originales se conservan en Hub.</p>
    {(error || configError) && <p role="alert" className="text-amber-700">{error || configError}</p>}
    {loading && <p>Consultando series del Hub…</p>}
    {!session.raw_data?.hub_activity_id && <p>Registro manual sin telemetría asociada.</p>}
    {stream && <>
      <div className="flex flex-wrap gap-2">{channels.map(c => <button key={c.key} className={`rounded border px-3 py-1 ${channel === c.key ? 'bg-yellow-100 text-purple-950' : ''}`} onClick={() => setChannel(c.key)}>{c.label}</button>)}</div>
      {!channels.length && <p>Esta actividad no tiene series disponibles en Hub.</p>}
      {plot && <div><p>{selected.label}: {plot.low.toFixed(1)}–{plot.high.toFixed(1)} {selected.unit} · {(plot.duration / 60).toFixed(1)} min</p><svg viewBox="0 0 640 170" role="img" aria-label={`${selected.label} a lo largo del entrenamiento`} className="w-full max-w-3xl"><polyline points={plot.path} fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></div>}
      {stats && <p>Potencia normalizada: {Math.round(stats.np)} W · VI: {stats.vi.toFixed(2)} · Potencia media: {Math.round(stats.avgWatts)} W</p>}
      {!stream.series?.watts?.length && <p>Sin potencia medida.</p>}
      {!stream.series?.hr?.length && <p>Sin pulso medido.</p>}
    </>}
  </div>;
}
