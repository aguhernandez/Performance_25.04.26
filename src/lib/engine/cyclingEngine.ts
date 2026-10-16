/**
 * cyclingEngine.ts — Contrarreloj (TT). Portable: sin React, sin DOM, sin Supabase.
 *
 * Sentido de cálculo: POTENCIA → VELOCIDAD → TIEMPO (forward). Es lo contrario de los papers de Berg/Sitko,
 * que invierten la ecuación (velocidad → potencia) con supuestos. Aquí la potencia sale del atleta.
 *
 *   P_pedal·η = [ ½·ρ·CdA(β)·Va·(v+v_viento) + Crr·m·g·cosθ + m·g·senθ ]·v + m_ef·v·dv/dt     (Martin et al. 1998)
 *
 * Entradas que vienen de otras secciones de Asciende (cargar a mano por ahora):
 *   - athlete.pdCurve  → curva potencia-duración (mean-max). Sección Performance.
 *   - rider.cda_m2, cdaYaw, crr → sección Biomecánica. Si faltan, se usan valores ASUMIDOS y el resultado lo avisa.
 *
 * NO modela: curvas/frenadas/giros, semáforos, rebufo, viento variable en el tiempo, Crr dependiente de la velocidad,
 * calor/hidratación sobre la potencia, cambios de posición durante la prueba.
 * Todo lo marcado HEURÍSTICA no tiene validación propia: backtestear con CRIs reales antes de publicar.
 */

// ───────────────────────── Tipos ─────────────────────────

export type Lang = 'es' | 'en';
export type Severity = 'info' | 'warning' | 'danger';
export interface CyclingMessage { code: string; severity?: Severity; params?: Record<string, number | string> }

export interface PDPoint { duration_s: number; power_w: number }

export interface AthletePowerInput {
  /** Curva mean-max en estado descansado: [{duration_s, power_w}]. Idealmente con puntos entre 2 y 60 min. */
  pdCurve?: PDPoint[];
  /** Alternativa si no hay curva: CP y W' ya calculados. */
  cp_w?: number;
  wprime_j?: number;
  /** Altitud a la que se midió la curva/CP (default 0). */
  testAltitude_m?: number;
  /** Multiplicador por durabilidad/fatiga previa (default 1; p. ej. 0.97 si compite fatigado). */
  durabilityFactor?: number;
}

export interface RiderInput {
  mass_kg: number; // ciclista con ropa
  equipmentMass_kg?: number; // bici + casco + zapatillas + bidón (default 9.5, ASUMIDO)
  cda_m2?: number; // área de arrastre (default 0.23, ASUMIDO)
  /** Tabla CdA vs yaw de túnel de viento. Si existe, reemplaza a cda_m2 según el ángulo de viento. */
  cdaYaw?: { yaw_deg: number; cda_m2: number }[];
  crr?: number; // default 0.0035, ASUMIDO
  drivetrainEff?: number; // default 0.975, ASUMIDO
  wheelInertiaMass_kg?: number; // masa equivalente de ruedas (default 0.14)
}

export interface Weather {
  temperature_c: number;
  humidity_percent: number;
  /** Presión (hPa) a la elevación media del recorrido. Si falta, se estima con la atmósfera estándar. */
  pressure_hpa?: number;
}

export interface WindSegment {
  fromKm: number;
  toKm: number;
  headwind_ms?: number; // + en contra, − a favor
  crosswind_ms?: number;
  speed_ms?: number; // alternativa: velocidad + dirección DESDE donde sopla (grados)
  from_deg?: number;
}
export interface WindInput {
  global?: { speed_ms: number; from_deg: number }; // requiere GPX (rumbo)
  segments?: WindSegment[]; // pisan al global; el último que coincide gana
}

export interface CourseSegment {
  startKm: number;
  length_m: number;
  grade: number; // m/m
  bearing_deg: number | null;
  elevation_m: number;
}
export interface Course {
  source: 'gpx' | 'flat';
  distance_km: number;
  totalAscent_m: number;
  meanElevation_m: number;
  segments: CourseSegment[];
  messages: CyclingMessage[];
}

export type PlanMode = 'even' | 'fixed' | 'custom';
export interface TTPlan {
  mode: PlanMode;
  /** 'even': porcentaje del esfuerzo máximo sostenible (default 1.0). */
  effort?: number;
  /** 'fixed': potencia constante en W. */
  power_w?: number;
  /** 'custom': potencia por km (se repite el último valor si faltan). */
  powerByKm?: number[];
}

export interface TTInput {
  course: Course;
  rider: RiderInput;
  athlete: AthletePowerInput;
  weather: Weather;
  wind?: WindInput;
  plan?: TTPlan; // default { mode: 'even' }
  options?: SimOptions;
}
export interface SimOptions {
  startSpeed_ms?: number; // default 1.5 (salida de rampa/parado: aproximado)
  maxSpeed_ms?: number; // default 22 (≈79 km/h): por encima se asume frenado
  extraHeadwind_ms?: number; // para sensibilidad
}

export interface TTSplit {
  km: number; // km al final del parcial
  time_s: number;
  speed_kmh: number;
  power_w: number;
  grade_pct: number;
  headwind_ms: number;
  elevation_m: number;
}

export interface TTResult {
  plan: 'even' | 'fixed' | 'custom' | 'optimized';
  distance_km: number;
  time_s: number;
  avgSpeed_kmh: number;
  avgPower_w: number;
  np_w: number; // potencia "normalizada" 4ª potencia ponderada por tiempo
  variabilityIndex: number;
  work_kj: number;
  targetPower_w: number | null; // potencia sostenible usada como objetivo (even/optimized)
  sustainableDuration_s: number;
  wPrimeMin_j: number | null; // mínimo balance W' (Skiba diferencial); <0 = no sostenible según el modelo CP
  airDensity_kgm3: number;
  totalAscent_m: number;
  splits: TTSplit[];
  profile: { km: number; elevation_m: number; speed_kmh: number; power_w: number; time_s: number }[]; // ~cada 100 m
  messages: CyclingMessage[];
  dataQuality: {
    cda: 'provided' | 'assumed';
    crr: 'provided' | 'assumed';
    drivetrainEff: 'provided' | 'assumed';
    equipmentMass: 'provided' | 'assumed';
    athleteModel: 'pdCurve' | 'cp-wprime';
    wind: 'none' | 'global' | 'manual';
    course: 'gpx' | 'flat';
  };
}

// ───────────────────────── Utilidades ─────────────────────────

const G = 9.80665;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function interpPts(pts: [number, number][], x: number): number {
  if (x <= pts[0][0]) return pts[0][1];
  const last = pts[pts.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return last[1];
}

export function formatHMS(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return '--:--:--';
  const t = Math.round(totalSeconds);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Pérdida de VO2max por altitud (%), mismo modelo que simulationEngine (≈6.5 %/1000 m desde 600 m). HEURÍSTICA con variabilidad individual. */
export function altitudeVO2maxLossPct(alt: number): number {
  if (alt <= 600) return 0;
  const loss = 6.5 * (Math.min(alt, 3000) - 600) / 1000 + (alt > 3000 ? 8.0 * (alt - 3000) / 1000 : 0);
  return Math.min(80, loss);
}

/** Densidad del aire (kg/m³) con humedad. T en °C, p en Pa. */
export function airDensity(temp_c: number, humidity_percent: number, pressure_pa: number): number {
  const T = temp_c + 273.15;
  const es = 610.78 * Math.pow(10, (7.5 * temp_c) / (temp_c + 237.3));
  const pv = clamp(humidity_percent, 0, 100) / 100 * es;
  const pd = pressure_pa - pv;
  return pd / (287.058 * T) + pv / (461.495 * T);
}

const isaPressurePa = (h: number) => 101325 * Math.pow(1 - 2.25577e-5 * h, 5.25588);

// ───────────────────────── Modelo del atleta (potencia-duración) ─────────────────────────

export interface FittedPowerModel {
  cp_w: number;
  wprime_j: number;
  source: 'pdCurve' | 'cp-wprime';
  r2: number | null;
  pointsUsed: number;
  /** Potencia máxima sostenible (W) para una duración (s). */
  sustainable: (duration_s: number) => number;
  /** Se usó extrapolación fuera del rango de la curva. */
  extrapolated: (duration_s: number) => boolean;
}

const LONG_DURATION_EXPONENT = -0.07; // HEURÍSTICA: decaimiento de potencia en >30 min si la curva no llega

/** Ajusta CP y W' (modelo trabajo-tiempo) con puntos entre 2 y 30 min. */
export function fitPowerDuration(points: PDPoint[]): { cp_w: number; wprime_j: number; r2: number; n: number } | null {
  const pts = points.filter((p) => p.duration_s >= 120 && p.duration_s <= 1800 && p.power_w > 0);
  if (pts.length < 2) return null;
  const xs = pts.map((p) => p.duration_s), ys = pts.map((p) => p.power_w * p.duration_s);
  const n = pts.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); syy += (ys[i] - my) ** 2; }
  if (sxx === 0) return null;
  const cp = sxy / sxx, wp = my - cp * mx;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { cp_w: cp, wprime_j: wp, r2, n };
}

export function buildPowerModel(a: AthletePowerInput): { model: FittedPowerModel; messages: CyclingMessage[] } {
  const messages: CyclingMessage[] = [];
  let cp: number, wp: number, r2: number | null = null, used = 0;
  let curve: [number, number][] = [];
  let source: 'pdCurve' | 'cp-wprime' = 'cp-wprime';

  if (a.pdCurve && a.pdCurve.length >= 2) {
    source = 'pdCurve';
    const sorted = [...a.pdCurve].filter((p) => p.duration_s > 0 && p.power_w > 0).sort((x, y) => x.duration_s - y.duration_s);
    let runMin = Infinity; // mean-max debe ser no creciente: se corrige con mínimo acumulado
    curve = sorted.map((p) => { runMin = Math.min(runMin, p.power_w); return [p.duration_s, runMin] as [number, number]; });
    const fit = fitPowerDuration(sorted);
    if (fit) { cp = fit.cp_w; wp = fit.wprime_j; r2 = fit.r2; used = fit.n; }
    else if (a.cp_w && a.wprime_j) { cp = a.cp_w; wp = a.wprime_j; source = 'pdCurve'; }
    else throw new Error('pdCurve: se necesitan ≥2 puntos entre 2 y 30 min para ajustar CP/W\' (o pasar cp_w y wprime_j).');
    if (curve.length < 3 || curve[curve.length - 1][0] < 1200) messages.push({ code: 'pd.fewPoints', severity: 'warning' });
  } else if (a.cp_w && a.wprime_j) {
    cp = a.cp_w; wp = a.wprime_j;
  } else {
    throw new Error('athlete: pasar pdCurve (≥2 puntos) o cp_w + wprime_j.');
  }
  if (wp < 3000 || wp > 60000) messages.push({ code: 'pd.wprimeOdd', severity: 'warning', params: { wprime: Math.round(wp) } });

  const cpPow = (t: number) => (t <= 1800 ? cp + wp / t : (cp + wp / 1800) * Math.pow(t / 1800, LONG_DURATION_EXPONENT));
  const covered = (t: number) => curve.length >= 3 && t >= curve[0][0] && t <= curve[curve.length - 1][0];
  const beyond = (t: number) => curve.length >= 3 && t > curve[curve.length - 1][0];

  const sustainable = (t: number): number => {
    if (covered(t)) return interpPts(curve.map(([d, p]) => [Math.log(d), p] as [number, number]), Math.log(t));
    if (beyond(t)) {
      const [t2, p2] = curve[curve.length - 1], [t1, p1] = curve[curve.length - 2];
      const b = clamp(Math.log(p2 / p1) / Math.log(t2 / t1), -0.12, -0.03);
      return p2 * Math.pow(t / t2, Number.isFinite(b) ? b : LONG_DURATION_EXPONENT);
    }
    return cpPow(t);
  };
  const extrapolated = (t: number) => (source === 'pdCurve' ? !covered(t) : t > 1800);

  return { model: { cp_w: cp, wprime_j: wp, source, r2, pointsUsed: used, sustainable, extrapolated }, messages };
}

// ───────────────────────── Recorrido: GPX y llano ─────────────────────────

interface GPXPoint { lat: number; lon: number; ele: number | null }

export function parseGPX(xml: string): GPXPoint[] {
  const pts: GPXPoint[] = [];
  const re = /<(trkpt|rtept)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const lat = /lat\s*=\s*"([^"]+)"/.exec(m[2]), lon = /lon\s*=\s*"([^"]+)"/.exec(m[2]);
    if (!lat || !lon) continue;
    const ele = m[3] ? /<ele>\s*([-+\d.eE]+)\s*<\/ele>/.exec(m[3]) : null;
    pts.push({ lat: parseFloat(lat[1]), lon: parseFloat(lon[1]), ele: ele ? parseFloat(ele[1]) : null });
  }
  return pts;
}

const toRad = (d: number) => (d * Math.PI) / 180;
function haversine(a: GPXPoint, b: GPXPoint): number {
  const R = 6371000, dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function bearing(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export interface GPXOptions { step_m?: number; smooth_m?: number; maxGrade?: number }

/** Convierte un GPX en un recorrido remuestreado (default 25 m), con elevación suavizada (150 m) para no inflar el desnivel por ruido GPS. */
export function courseFromGPX(xml: string, opts: GPXOptions = {}): Course {
  const step = opts.step_m ?? 25, maxGrade = opts.maxGrade ?? 0.2;
  const raw = parseGPX(xml);
  if (raw.length < 2) throw new Error('GPX: menos de 2 puntos válidos.');
  const messages: CyclingMessage[] = [];
  const hasEle = raw.some((p) => p.ele !== null);
  if (!hasEle) messages.push({ code: 'gpx.noElevation', severity: 'warning' });

  const cum: number[] = [0];
  for (let i = 1; i < raw.length; i++) cum.push(cum[i - 1] + haversine(raw[i - 1], raw[i]));
  const total = cum[cum.length - 1];
  if (total < 200) throw new Error('GPX: recorrido demasiado corto.');

  // elevación faltante: interpolar con el último valor conocido
  let lastEle = raw.find((p) => p.ele !== null)?.ele ?? 0;
  const eleRaw = raw.map((p) => { if (p.ele !== null) lastEle = p.ele; return lastEle; });

  const N = Math.ceil(total / step);
  const dists: number[] = Array.from({ length: N + 1 }, (_, i) => Math.min(i * step, total));
  const lat: number[] = [], lon: number[] = [], ele: number[] = [];
  let j = 0;
  for (const d of dists) {
    while (j < cum.length - 2 && cum[j + 1] < d) j++;
    const span = cum[j + 1] - cum[j], f = span > 0 ? clamp((d - cum[j]) / span, 0, 1) : 0;
    lat.push(raw[j].lat + (raw[j + 1].lat - raw[j].lat) * f);
    lon.push(raw[j].lon + (raw[j + 1].lon - raw[j].lon) * f);
    ele.push(eleRaw[j] + (eleRaw[j + 1] - eleRaw[j]) * f);
  }
  const w = Math.max(1, Math.round((opts.smooth_m ?? 150) / step) | 1);
  const half = (w - 1) / 2;
  const sm = ele.map((_, i) => {
    let s = 0, c = 0;
    for (let k = Math.max(0, i - half); k <= Math.min(N, i + half); k++) { s += ele[k]; c++; }
    return s / c;
  });
  const k = Math.max(1, Math.ceil(100 / step));
  const segments: CourseSegment[] = [];
  let ascent = 0, eleSum = 0;
  for (let i = 0; i < N; i++) {
    const len = dists[i + 1] - dists[i];
    const dEle = sm[i + 1] - sm[i];
    if (dEle > 0) ascent += dEle;
    const a = Math.max(0, i - 1), b = Math.min(N, i + k);
    segments.push({
      startKm: dists[i] / 1000, length_m: len, grade: clamp(len > 0 ? dEle / len : 0, -maxGrade, maxGrade),
      bearing_deg: bearing({ lat: lat[a], lon: lon[a] }, { lat: lat[b], lon: lon[b] }), elevation_m: (sm[i] + sm[i + 1]) / 2,
    });
    eleSum += (sm[i] + sm[i + 1]) / 2;
  }
  return { source: 'gpx', distance_km: total / 1000, totalAscent_m: ascent, meanElevation_m: eleSum / N, segments, messages };
}

export interface FlatCourseInput {
  distance_km: number;
  elevation_m?: number; // altitud del recorrido (default 0)
  step_m?: number;
  /** Pendientes manuales por tramo (opcional). */
  grades?: { fromKm: number; toKm: number; grade: number }[];
}

/** Recorrido "simulacro": llano (o con pendientes manuales). El viento se define por km en `wind.segments`. */
export function courseFlat(input: FlatCourseInput): Course {
  const step = input.step_m ?? 25, total = input.distance_km * 1000;
  if (!(total > 0)) throw new Error('courseFlat: distancia inválida.');
  const N = Math.ceil(total / step);
  const segments: CourseSegment[] = [];
  let ele = input.elevation_m ?? 0, ascent = 0, eleSum = 0;
  for (let i = 0; i < N; i++) {
    const start = i * step, len = Math.min(step, total - start), mid = (start + len / 2) / 1000;
    const g = input.grades?.filter((x) => mid >= x.fromKm && mid < x.toKm).pop()?.grade ?? 0;
    if (g > 0) ascent += g * len;
    ele += g * len;
    eleSum += ele;
    segments.push({ startKm: start / 1000, length_m: len, grade: g, bearing_deg: null, elevation_m: ele });
  }
  return { source: 'flat', distance_km: input.distance_km, totalAscent_m: ascent, meanElevation_m: eleSum / N, segments, messages: [] };
}

// ───────────────────────── Preparación y simulación física ─────────────────────────

interface Prepared {
  n: number;
  len: Float64Array; startM: Float64Array; grade: Float64Array; ele: Float64Array;
  rho: Float64Array; head: Float64Array; cross: Float64Array;
  mTotal: number; mEff: number; crr: number; eta: number; cda: number; cdaYaw: [number, number][] | null;
  vmax: number; v0: number; distance_m: number; meanRho: number;
  dq: Pick<TTResult['dataQuality'], 'cda' | 'crr' | 'drivetrainEff' | 'equipmentMass' | 'wind' | 'course'>;
  messages: CyclingMessage[];
}

function prepare(course: Course, rider: RiderInput, weather: Weather, wind: WindInput | undefined, opts: SimOptions = {}): Prepared {
  const n = course.segments.length;
  if (!(rider.mass_kg > 30)) throw new Error('rider.mass_kg inválido.');
  const messages: CyclingMessage[] = [...course.messages];
  const cdaProvided = rider.cda_m2 !== undefined || !!rider.cdaYaw?.length;
  const cda = rider.cda_m2 ?? (rider.cdaYaw?.length ? rider.cdaYaw[0].cda_m2 : 0.23);
  if (!cdaProvided) messages.push({ code: 'cda.assumed', severity: 'warning', params: { cda } });
  if (rider.crr === undefined) messages.push({ code: 'crr.assumed', severity: 'info' });
  const crr = rider.crr ?? 0.0035, eta = rider.drivetrainEff ?? 0.975;
  const eq = rider.equipmentMass_kg ?? 9.5;
  const mTotal = rider.mass_kg + eq;
  const mEff = mTotal + (rider.wheelInertiaMass_kg ?? 0.14);

  const hRef = course.meanElevation_m;
  const pRef = weather.pressure_hpa !== undefined ? weather.pressure_hpa * 100 : isaPressurePa(hRef);
  const len = new Float64Array(n), startM = new Float64Array(n), grade = new Float64Array(n), ele = new Float64Array(n);
  const rho = new Float64Array(n), head = new Float64Array(n), cross = new Float64Array(n);
  let rhoSum = 0, windKind: 'none' | 'global' | 'manual' = 'none';

  for (let i = 0; i < n; i++) {
    const s = course.segments[i];
    len[i] = s.length_m; startM[i] = s.startKm * 1000; grade[i] = s.grade; ele[i] = s.elevation_m;
    const p = pRef * Math.pow((1 - 2.25577e-5 * s.elevation_m) / (1 - 2.25577e-5 * hRef), 5.25588);
    rho[i] = airDensity(weather.temperature_c - 0.0065 * (s.elevation_m - hRef), weather.humidity_percent, p);
    rhoSum += rho[i];

    const km = s.startKm + s.length_m / 2000;
    let h = 0, c = 0;
    if (wind?.global && s.bearing_deg !== null) {
      const rel = toRad(wind.global.from_deg - s.bearing_deg);
      h = wind.global.speed_ms * Math.cos(rel); c = wind.global.speed_ms * Math.sin(rel);
      windKind = 'global';
    }
    const w = wind?.segments?.filter((x) => km >= x.fromKm && km < x.toKm).pop();
    if (w) {
      windKind = 'manual';
      if (w.headwind_ms !== undefined || w.crosswind_ms !== undefined) { h = w.headwind_ms ?? 0; c = w.crosswind_ms ?? 0; }
      else if (w.speed_ms !== undefined && w.from_deg !== undefined && s.bearing_deg !== null) {
        const rel = toRad(w.from_deg - s.bearing_deg); h = w.speed_ms * Math.cos(rel); c = w.speed_ms * Math.sin(rel);
      } else if (w.speed_ms !== undefined) { h = w.speed_ms; c = 0; }
    }
    head[i] = h + (opts.extraHeadwind_ms ?? 0); cross[i] = c;
  }
  if (wind?.global && course.source === 'flat') messages.push({ code: 'wind.globalNeedsGpx', severity: 'warning' });
  messages.push({ code: 'model.limits', severity: 'info' });

  return {
    n, len, startM, grade, ele, rho, head, cross, mTotal, mEff, crr, eta, cda,
    cdaYaw: rider.cdaYaw?.length ? [...rider.cdaYaw].sort((a, b) => a.yaw_deg - b.yaw_deg).map((x) => [x.yaw_deg, x.cda_m2] as [number, number]) : null,
    vmax: opts.maxSpeed_ms ?? 22, v0: opts.startSpeed_ms ?? 1.5, distance_m: startM[n - 1] + len[n - 1],
    meanRho: rhoSum / n,
    dq: {
      cda: cdaProvided ? 'provided' : 'assumed', crr: rider.crr !== undefined ? 'provided' : 'assumed',
      drivetrainEff: rider.drivetrainEff !== undefined ? 'provided' : 'assumed',
      equipmentMass: rider.equipmentMass_kg !== undefined ? 'provided' : 'assumed', wind: windKind, course: course.source,
    },
    messages,
  };
}

interface Sim { time_s: number; dt: Float64Array; v: Float64Array; capped: boolean }

function runSim(p: Prepared, P: ArrayLike<number>): Sim {
  const dt = new Float64Array(p.n), vArr = new Float64Array(p.n);
  let v = Math.max(0.5, p.v0), t = 0, capped = false;
  for (let i = 0; i < p.n; i++) {
    const theta = Math.atan(p.grade[i]);
    const fFixed = p.mTotal * G * (p.crr * Math.cos(theta) + Math.sin(theta));
    const pw = Math.max(0, P[i]) * p.eta;
    let vmid = v, v1 = v;
    for (let it = 0; it < 3; it++) {
      const va = vmid + p.head[i];
      const vtot = Math.sqrt(va * va + p.cross[i] * p.cross[i]);
      let cda = p.cda;
      if (p.cdaYaw) cda = interpPts(p.cdaYaw, (Math.atan2(Math.abs(p.cross[i]), Math.abs(va)) * 180) / Math.PI);
      const fRes = fFixed + 0.5 * p.rho[i] * cda * vtot * va;
      const v1sq = v * v + (2 * (pw / Math.max(vmid, 0.5) - fRes) * p.len[i]) / p.mEff;
      v1 = Math.sqrt(Math.max(v1sq, 0.25));
      vmid = Math.max(0.5, (v + v1) / 2);
    }
    if (v1 > p.vmax) { v1 = p.vmax; capped = true; }
    dt[i] = p.len[i] / vmid; vArr[i] = vmid; t += dt[i]; v = v1;
  }
  return { time_s: t, dt, v: vArr, capped };
}

function metrics(p: Prepared, sim: Sim, P: ArrayLike<number>) {
  let e = 0, e4 = 0;
  for (let i = 0; i < p.n; i++) { const w = Math.max(0, P[i]); e += w * sim.dt[i]; e4 += w ** 4 * sim.dt[i]; }
  const avg = e / sim.time_s, np = Math.pow(e4 / sim.time_s, 0.25);
  return { avg, np, vi: np / avg, work_kj: e / 1000 };
}

/** Balance de W' (Skiba, forma diferencial). Devuelve el mínimo en J. */
function wPrimeMin(sim: Sim, P: ArrayLike<number>, cp: number, wp: number): number {
  let bal = wp, min = wp;
  for (let i = 0; i < sim.dt.length; i++) {
    const pw = Math.max(0, P[i]), dt = sim.dt[i];
    if (pw > cp) bal -= (pw - cp) * dt;
    else { const tau = 546 * Math.exp(-0.01 * (cp - pw)) + 316; bal += (wp - bal) * (1 - Math.exp(-dt / tau)); }
    if (bal < min) min = bal;
  }
  return min;
}

function powerFactor(course: Course, a: AthletePowerInput): number {
  const test = 1 - altitudeVO2maxLossPct(a.testAltitude_m ?? 0) / 100;
  const race = 1 - altitudeVO2maxLossPct(course.meanElevation_m) / 100;
  return (race / test) * (a.durabilityFactor ?? 1); // HEURÍSTICA: la potencia aeróbica sigue al VO2max
}

function evenPlan(p: Prepared, model: FittedPowerModel, factor: number) {
  let T = p.distance_m / 11, P = 0, sim: Sim = null as unknown as Sim, arr = new Float64Array(p.n);
  for (let k = 0; k < 8; k++) {
    P = model.sustainable(T) * factor;
    arr = new Float64Array(p.n).fill(P);
    sim = runSim(p, arr);
    if (Math.abs(sim.time_s - T) < 0.3) break;
    T = 0.5 * (T + sim.time_s);
  }
  return { P, arr, sim, targetT: T };
}

function buildResult(
  p: Prepared, course: Course, sim: Sim, P: ArrayLike<number>, plan: TTResult['plan'],
  model: FittedPowerModel, target: number | null, extra: CyclingMessage[]
): TTResult {
  const m = metrics(p, sim, P);
  const messages = [...p.messages, ...extra];
  const wmin = wPrimeMin(sim, P, model.cp_w, model.wprime_j);
  if (wmin < 0) messages.push({ code: 'wbal.negative', severity: 'danger', params: { kj: (-wmin / 1000).toFixed(1) } });
  if (sim.capped) messages.push({ code: 'speed.capped', severity: 'info' });
  if (model.extrapolated(sim.time_s)) messages.push({ code: 'pd.extrapolated', severity: 'warning', params: { min: Math.round(sim.time_s / 60) } });
  if (course.meanElevation_m > 600) messages.push({ code: 'power.altitude', severity: 'info', params: { pct: altitudeVO2maxLossPct(course.meanElevation_m).toFixed(1) } });

  const splits: TTSplit[] = [], profile: TTResult['profile'] = [];
  let kmIdx = 0, tAcc = 0, dAcc = 0, eAcc = 0, gAcc = 0, hAcc = 0, eleAcc = 0, cum = 0, t = 0, nextProf = 0;
  const flush = (endKm: number) => {
    if (dAcc <= 0) return;
    splits.push({ km: Math.round(endKm * 1000) / 1000, time_s: tAcc, speed_kmh: (dAcc / tAcc) * 3.6, power_w: eAcc / tAcc,
      grade_pct: (gAcc / dAcc) * 100, headwind_ms: hAcc / dAcc, elevation_m: eleAcc / dAcc });
    tAcc = dAcc = eAcc = gAcc = hAcc = eleAcc = 0;
  };
  for (let i = 0; i < p.n; i++) {
    const idx = Math.floor((p.startM[i] + p.len[i] / 2) / 1000);
    if (idx !== kmIdx) { flush(idx); kmIdx = idx; }
    tAcc += sim.dt[i]; dAcc += p.len[i]; eAcc += P[i] * sim.dt[i]; gAcc += p.grade[i] * p.len[i]; hAcc += p.head[i] * p.len[i]; eleAcc += p.ele[i] * p.len[i];
    cum += p.len[i]; t += sim.dt[i];
    if (cum >= nextProf) {
      profile.push({ km: Math.round((cum / 1000) * 100) / 100, elevation_m: Math.round(p.ele[i] * 10) / 10, speed_kmh: Math.round(sim.v[i] * 36) / 10, power_w: Math.round(P[i]), time_s: Math.round(t) });
      nextProf += 100;
    }
  }
  flush(cum / 1000);

  return {
    plan, distance_km: course.distance_km, time_s: sim.time_s, avgSpeed_kmh: (p.distance_m / sim.time_s) * 3.6,
    avgPower_w: m.avg, np_w: m.np, variabilityIndex: m.vi, work_kj: m.work_kj, targetPower_w: target,
    sustainableDuration_s: sim.time_s, wPrimeMin_j: wmin, airDensity_kgm3: p.meanRho, totalAscent_m: course.totalAscent_m,
    splits, profile, messages,
    dataQuality: { ...p.dq, athleteModel: model.source },
  };
}

// ───────────────────────── API principal ─────────────────────────

/** Simula una contrarreloj con un plan de potencia dado (even / fixed / custom). */
export function simulateTimeTrial(input: TTInput): TTResult {
  const p = prepare(input.course, input.rider, input.weather, input.wind, input.options);
  const { model, messages: mm } = buildPowerModel(input.athlete);
  const plan = input.plan ?? { mode: 'even' as PlanMode };
  const factor = powerFactor(input.course, input.athlete);

  if (plan.mode === 'even') {
    const e = evenPlan(p, model, factor * (plan.effort ?? 1));
    return buildResult(p, input.course, e.sim, e.arr, 'even', model, e.P, mm);
  }
  const P = new Float64Array(p.n);
  if (plan.mode === 'fixed') {
    if (!(plan.power_w && plan.power_w > 0)) throw new Error("plan 'fixed' requiere power_w.");
    P.fill(plan.power_w);
  } else {
    if (!plan.powerByKm?.length) throw new Error("plan 'custom' requiere powerByKm.");
    for (let i = 0; i < p.n; i++) P[i] = plan.powerByKm[Math.min(plan.powerByKm.length - 1, Math.floor((p.startM[i] + p.len[i] / 2) / 1000))];
  }
  const sim = runSim(p, P);
  return buildResult(p, input.course, sim, P, plan.mode, model, null, mm);
}

export interface OptimizerOptions {
  blockLength_km?: number; // default 1
  maxDeviation?: number; // ± fracción respecto de la media (default 0.12)
  passes?: number; // default 4
}

/**
 * Optimiza el reparto de potencia manteniendo la MISMA potencia normalizada (4ª potencia) que el plan uniforme.
 * Conservador: el objetivo se fija con la duración del plan uniforme (no se premia haber bajado el tiempo).
 * La ganancia es del modelo; en la práctica suele ser pequeña (segundos a ~1 %) y exige ejecutar el plan con precisión.
 */
export function optimizeTimeTrial(input: TTInput, o: OptimizerOptions = {}): { even: TTResult; optimized: TTResult; gain_s: number; gain_pct: number } {
  const p = prepare(input.course, input.rider, input.weather, input.wind, input.options);
  const { model, messages: mm } = buildPowerModel(input.athlete);
  const factor = powerFactor(input.course, input.athlete) * (input.plan?.effort ?? 1);
  const ev = evenPlan(p, model, factor);
  const Pt = ev.P;

  const blockM = (o.blockLength_km ?? 1) * 1000, bound = o.maxDeviation ?? 0.12, passes = o.passes ?? 4;
  const nb = Math.max(1, Math.round(p.distance_m / blockM));
  const blockOf = new Int32Array(p.n);
  for (let i = 0; i < p.n; i++) blockOf[i] = Math.min(nb - 1, Math.floor(((p.startM[i] + p.len[i] / 2) / p.distance_m) * nb));

  let w = Float64Array.from(ev.sim.dt);
  const buildP = (m: Float64Array): Float64Array => {
    let s4 = 0, sw = 0;
    for (let i = 0; i < p.n; i++) { s4 += w[i] * m[blockOf[i]] ** 4; sw += w[i]; }
    const s = Pt / Math.pow(s4 / sw, 0.25);
    const out = new Float64Array(p.n);
    for (let i = 0; i < p.n; i++) out[i] = s * m[blockOf[i]];
    return out;
  };

  const m = new Float64Array(nb).fill(1);
  let bestP = buildP(m), best = runSim(p, bestP);
  const deltas = [0.04, 0.02, 0.01, 0.005, 0.0025];
  for (let pass = 0; pass < passes; pass++) {
    const d = deltas[Math.min(pass, deltas.length - 1)];
    for (let b = 0; b < nb; b++) {
      for (const dir of [1, -1]) {
        const cand = Float64Array.from(m);
        cand[b] = clamp(cand[b] + dir * d, 1 - bound, 1 + bound);
        if (cand[b] === m[b]) continue;
        const Pc = buildP(cand), sc = runSim(p, Pc);
        if (sc.time_s < best.time_s - 1e-6) { m.set(cand); best = sc; bestP = Pc; break; }
      }
    }
    w = Float64Array.from(best.dt);
    bestP = buildP(m); best = runSim(p, bestP);
  }
  // Re-normalización final: NP real (con los tiempos finales) = potencia objetivo
  for (let k = 0; k < 4; k++) {
    const mt = metrics(p, best, bestP), scale = Pt / mt.np;
    bestP = bestP.map((x) => x * scale); best = runSim(p, bestP);
  }

  const even = buildResult(p, input.course, ev.sim, ev.arr, 'even', model, Pt, mm);
  const optimized = buildResult(p, input.course, best, bestP, 'optimized', model, Pt, mm);
  const gain = even.time_s - optimized.time_s;
  return { even, optimized, gain_s: gain, gain_pct: (gain / even.time_s) * 100 };
}

/** Cuánto cambia el tiempo (a potencia constante) al variar cada parámetro. Útil para decidir qué medir mejor. */
export function sensitivityTimeTrial(input: TTInput): { label: string; delta_s: number }[] {
  const base = simulateTimeTrial({ ...input, plan: { mode: 'even' } });
  const P0 = base.targetPower_w as number;
  const run = (rider: RiderInput, weather: Weather, opts: SimOptions = {}, powerAdj = 0) => {
    const p = prepare(input.course, rider, weather, input.wind, { ...input.options, ...opts });
    return runSim(p, new Float64Array(p.n).fill(P0 + powerAdj)).time_s;
  };
  const r = input.rider, w = input.weather;
  const cda0 = r.cda_m2 ?? 0.23, crr0 = r.crr ?? 0.0035, eta0 = r.drivetrainEff ?? 0.975;
  const t0 = run(r, w);
  const out: { label: string; delta_s: number }[] = [];
  const add = (label: string, t: number) => out.push({ label, delta_s: Math.round((t - t0) * 10) / 10 });
  add('CdA +0.010 m²', run({ ...r, cda_m2: cda0 + 0.01, cdaYaw: undefined }, w));
  add('CdA −0.010 m²', run({ ...r, cda_m2: cda0 - 0.01, cdaYaw: undefined }, w));
  add('Masa +1 kg', run({ ...r, mass_kg: r.mass_kg + 1 }, w));
  add('Crr +0.001', run({ ...r, crr: crr0 + 0.001 }, w));
  add('Eficiencia transmisión −1 %', run({ ...r, drivetrainEff: eta0 - 0.01 }, w));
  add('Potencia +5 W', run(r, w, {}, 5));
  add('Viento de frente +1 m/s (todo el recorrido)', run(r, w, { extraHeadwind_ms: 1 }));
  add('Temperatura +5 °C', run(r, { ...w, temperature_c: w.temperature_c + 5 }));
  return out;
}

// ───────────────────────── Calibración y validación ─────────────────────────

/**
 * CdA a partir de un tramo ESTABLE (velocidad y potencia constantes, sin aceleración). Útil para la sección de Biomecánica.
 * Requiere conocer el viento (ideal: velódromo, o ida y vuelta promediando). Con viento mal medido el error es grande.
 */
export function estimateCdA(i: {
  power_w: number; speed_ms: number; mass_kg: number; crr?: number; rho: number; eta?: number; headwind_ms?: number; grade?: number;
}): number {
  const theta = Math.atan(i.grade ?? 0), eta = i.eta ?? 0.975, crr = i.crr ?? 0.0035;
  const fRest = i.mass_kg * G * (crr * Math.cos(theta) + Math.sin(theta));
  const va = i.speed_ms + (i.headwind_ms ?? 0);
  return ((i.power_w * eta) / i.speed_ms - fRest) / (0.5 * i.rho * va * va);
}

/** Resume el error del modelo contra resultados reales. Umbral sugerido: MAPE ≤ 2 % antes de usarlo con clientes. */
export function backtest(rows: { predicted_s: number; actual_s: number }[], thresholdPct = 2) {
  if (!rows.length) throw new Error('backtest: sin datos');
  const errs = rows.map((r) => ((r.predicted_s - r.actual_s) / r.actual_s) * 100);
  const mape = errs.reduce((s, e) => s + Math.abs(e), 0) / errs.length;
  const bias = errs.reduce((s, e) => s + e, 0) / errs.length;
  const rmse_s = Math.sqrt(rows.reduce((s, r) => s + (r.predicted_s - r.actual_s) ** 2, 0) / rows.length);
  return { n: rows.length, mapePct: mape, biasPct: bias, rmse_s, ready: mape <= thresholdPct && rows.length >= 8 };
}

// ───────────────────────── Mensajes ─────────────────────────

const MESSAGES: Record<Lang, Record<string, string>> = {
  es: {
    'cda.assumed': 'CdA no informado: se usó {cda} m² (ASUMIDO). El tiempo absoluto no es confiable hasta cargar el CdA medido.',
    'crr.assumed': 'Crr no informado: se usó 0.0035 (asumido).',
    'model.limits': 'No modela curvas, frenadas, rebufo ni viento variable en el tiempo.',
    'pd.fewPoints': 'La curva potencia-duración tiene pocos puntos o no llega a 20 min: la potencia sostenible se extrapola.',
    'pd.wprimeOdd': "W' ajustado ({wprime} J) fuera de lo habitual: revisar la curva.",
    'pd.extrapolated': 'Duración de ~{min} min fuera del rango de la curva: potencia sostenible extrapolada.',
    'wbal.negative': "El plan agota W' por {kj} kJ según el modelo CP: no sostenible tal como está.",
    'speed.capped': 'Hubo tramos con velocidad limitada por frenado (descensos): potencia inútil allí.',
    'power.altitude': 'Altitud media de carrera: la potencia sostenible se redujo {pct} % (estimado, varía por atleta).',
    'gpx.noElevation': 'El GPX no tiene elevación: se asumió recorrido llano.',
    'wind.globalNeedsGpx': 'El viento global necesita rumbo (GPX). Con recorrido llano definí el viento por km.',
  },
  en: {
    'cda.assumed': 'CdA not provided: {cda} m² was used (ASSUMED). Absolute time is unreliable until a measured CdA is loaded.',
    'crr.assumed': 'Crr not provided: 0.0035 used (assumed).',
    'model.limits': 'Does not model corners, braking, drafting or time-varying wind.',
    'pd.fewPoints': 'Power-duration curve has few points or does not reach 20 min: sustainable power is extrapolated.',
    'pd.wprimeOdd': "Fitted W' ({wprime} J) is unusual: check the curve.",
    'pd.extrapolated': 'Duration of ~{min} min is outside the curve range: sustainable power extrapolated.',
    'wbal.negative': "Plan depletes W' by {kj} kJ under the CP model: not sustainable as is.",
    'speed.capped': 'Some sections were speed-capped by braking (descents): power is wasted there.',
    'power.altitude': 'Mean race altitude: sustainable power reduced {pct} % (estimate, varies by athlete).',
    'gpx.noElevation': 'GPX has no elevation: course assumed flat.',
    'wind.globalNeedsGpx': 'Global wind needs heading (GPX). On a flat course define wind per km.',
  },
};

export function formatCyclingMessage(msg: { code: string; params?: Record<string, number | string> }, lang: Lang = 'es'): string {
  const tpl = MESSAGES[lang][msg.code] ?? msg.code;
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (msg.params && msg.params[k] !== undefined ? String(msg.params[k]) : `{${k}}`));
}
