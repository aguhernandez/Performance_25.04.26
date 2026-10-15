/**
 * simulationEngine.ts — v2 (portable, sin React, sin LanguageContext)
 *
 * Cambios respecto a v1:
 *  - Modelo único "ritmo fijo, esfuerzo variable": terreno y calor SUBEN la demanda (%VO2max), no bajan el ritmo.
 *  - Costo de carrera y fracción sostenible por duración: Daniels-Gilbert. RE medida escala el costo.
 *  - Tiempo predicho = suma de splits (incluye deriva por fatiga, deshidratación y pared de glucógeno).
 *  - Estrategias normalizadas: conservan el ritmo medio; el efecto es fisiológico, aplicado UNA vez.
 *  - Deshidratación sobre masa corporal; sudor escala con gasto metabólico y WBGT; ingesta de fluidos como input.
 *  - Altitud: ~6.5 %/1000 m desde 600 m (8 %/1000 m sobre 3000 m), con rango de incertidumbre.
 *  - FC, lactato, zonas y sustratos se derivan de los datos de laboratorio del atleta cuando existen.
 *  - Glucógeno con carga previa e ingesta de CHO; "pared" al 15 % del stock, no al vaciado total.
 *  - Aclimatación y bloque de altitud por dosis (altitud × horas/día), con rango bajo/central/alto.
 *  - Simulador inverso consistente con el directo (misma f(t), mismas correcciones).
 *  - Mensajes como { code, params }: se formatean con formatEngineMessage(msg, 'es'|'en'). Sin tGlobal.
 *
 * Todo lo marcado "HEURÍSTICA" es una aproximación sin validación propia. Validar contra tiempos reales
 * antes de usar comercialmente.
 */

// ───────────────────────── Tipos ─────────────────────────

export type Lang = 'es' | 'en';
export type Severity = 'info' | 'warning' | 'danger';
export interface EngineMessage {
  code: string;
  severity?: Severity;
  params?: Record<string, number | string>;
}

export interface LactatePoint {
  speed_kmh: number;
  lactate_mmol: number;
}

export interface AthletePhysioProfile {
  vo2max: number; // ml/kg/min
  lt1_hr?: number | null;
  lt2_hr?: number | null;
  lt1_pace?: string | null; // "m:ss" /km
  lt2_pace?: string | null;
  lt1_power?: number | null;
  lt2_power?: number | null;
  weight_kg?: number; // default 70
  hr_max?: number;
  hr_rest?: number | null; // NUEVO (default estimado 55)
  running_economy?: number | null; // ml O2/kg/km MEDIDA (150-300). Si no hay, se usa Daniels
  lt1_vo2?: number | null; // ml/kg/min
  lt2_vo2?: number | null;
  fatmax_hr?: number | null;
  lactate_curve?: LactatePoint[] | null; // NUEVO: curva lactato-velocidad del test
}

export type Terrain = 'flat' | 'rolling' | 'hilly';
export type Strategy = 'even' | 'positive' | 'negative';
export type GlycogenState = 'depleted' | 'normal' | 'loaded';

export interface RaceScenario {
  distance_km: number;
  name: string;
  targetPace_min_km: number;
  terrain: Terrain;
  temperature_c: number;
  humidity_percent: number;
  altitude_m: number;
  strategy: Strategy;
  carbIntake_g_h?: number; // default 0
  fluidIntake_L_h?: number; // default 0.4
  glycogenState?: GlycogenState; // default 'normal'
}

export interface AltitudeScenario {
  altitude_m: number;
  exposure_days: number;
  training_load: 'rest' | 'light' | 'moderate' | 'hard';
  hoursPerDay?: number; // default 24 (vivir en altitud); LHTL ≈ 12-16
}

export type Feasibility = 'optimal' | 'challenging' | 'limit' | 'impossible';
export type BonkRisk = 'none' | 'low' | 'moderate' | 'high';

export interface RaceSplit {
  km: number; // km al final del tramo
  pace_min_km: number;
  paceStr: string;
  hr: number;
  percentVO2max: number; // vs VO2max ajustado por altitud
  fatigue: number; // 0-100
  lactate_mmol: number;
  glycogenRemaining_g: number;
  dehydration_pct: number;
  zone: string;
}

export interface ZoneShare {
  name: string;
  percent: number;
  color: string;
}

export interface DataQuality {
  runningEconomy: 'measured' | 'daniels';
  hr: 'lab' | 'karvonen';
  hrMax: 'measured' | 'lt2-derived' | 'default';
  lt1: 'lab' | 'pace' | 'default';
  lt2: 'lab' | 'pace' | 'default';
  lactate: 'lab-curve' | 'generic';
  fatmax: 'lab' | 'default';
  assumedFueling: string[]; // inputs no provistos y valores asumidos
}

export interface RaceSimResult {
  predictedTime_min: number; // suma de splits (con deriva)
  avgPace_min_km: number;
  sustainableTime_min: number; // tiempo máximo sostenible (ratio = 1), sin deriva
  sustainablePace_min_km: number;
  percentVO2max: number; // medio, vs VO2max ajustado
  sustainableFraction: number; // f(t) Daniels-Gilbert (0-1)
  feasibilityRatio: number; // demanda / (f(t) × VO2max_ef). 1.0 = esfuerzo máximo sostenible
  feasibility: Feasibility;
  effectiveVO2max: number;
  avgHR: number;
  kcal: number;
  carbsUsed_g: number; // CHO oxidado total
  glycogenUsed_g: number;
  exogenousCarbs_g: number;
  fatUsed_g: number;
  dehydration_pct: number; // % masa corporal, final
  sweatRate_L_h: number;
  sweatLoss_L: number;
  glycogenStart_g: number;
  glycogenDepletionKm: number | null; // km de la "pared" (15 % del stock)
  bonkRisk: BonkRisk;
  runningEconomy: number; // ml/kg/km efectivo en el ritmo objetivo
  runningEconomySource: 'measured' | 'daniels';
  wbgt: number;
  heatSlowdown_pct: number;
  altitudeLoss_pct: number;
  thresholds: { lt1Pct: number; lt2Pct: number; lt1Lactate: number; lt2Lactate: number };
  zones: ZoneShare[];
  splits: RaceSplit[]; // alimenta los 5 gráficos
  riskFlags: EngineMessage[];
  recommendations: EngineMessage[];
  dataQuality: DataQuality;
}

export interface AltitudeSimResult {
  barometric_mmHg: number;
  alveolarPO2: number;
  spo2Rest: number;
  spo2Exercise: number;
  vo2maxReduction_pct: number;
  vo2maxReductionRange_pct: [number, number];
  adjustedVO2max: number;
  hrIncrease_bpm: number;
  ventilationIncrease_pct: number;
  performanceLoss_pct: number;
  hbMassGain_pct: number; // al final de la exposición
  acclimatization: {
    day: number;
    vo2max: number;
    vo2maxPctOfSeaLevel: number;
    hbMassGain_pct: number;
    lossRecovered_pct: number;
    performanceLoss_pct: number;
  }[];
  zones: { minAlt: number; maxAlt: number | null; lossFrom_pct: number; lossTo_pct: number | null; code: string; color: string }[];
  riskFlags: EngineMessage[];
  recommendations: EngineMessage[];
}

export interface InverseSimResult {
  requiredVO2max: number;
  currentVO2max: number;
  gap: number;
  targetPace_min_km: number;
  sustainableFraction: number;
  currentSustainablePace_min_km: number;
  currentSustainableTime_min: number;
  feasibilityComment: EngineMessage;
  projection: {
    week: number;
    projectedVO2max: number;
    projectedTime_min: number;
    projectedPace_min_km: number;
    diffVsTarget_min: number; // >0 = más lento que el objetivo
    targetReached: boolean;
  }[];
  assumptions: string[];
}

export interface AltitudeBlockResult {
  altitude: AltitudeSimResult;
  hbMassGain_pct: number;
  vo2max: { before: number; afterLow: number; afterCentral: number; afterHigh: number };
  before: RaceSimResult;
  after: RaceSimResult; // escenario central
  timeSaving_min: { low: number; central: number; high: number }; // por tiempo sostenible
  optimalReturnPace_min_km: number;
  doseHours: number;
  doseWarning: boolean;
}

// ───────────────────────── Utilidades ─────────────────────────

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function interp(pts: [number, number][], x: number): number {
  if (!pts.length) return NaN;
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

export function parsePace(str?: string | null): number | null {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d+):(\d{1,2})(?:\.\d+)?$/);
  if (!m) return null;
  const v = parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
  return v > 0 ? v : null;
}

export function formatPace(minPerKm: number): string {
  if (!isFinite(minPerKm) || minPerKm <= 0) return '--:--';
  let m = Math.floor(minPerKm);
  let s = Math.round((minPerKm - m) * 60);
  if (s === 60) { m += 1; s = 0; }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatTime(totalMin: number): string {
  if (!isFinite(totalMin) || totalMin < 0) return '--:--:--';
  const total = Math.round(totalMin * 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function buildProfileSummary(p: AthletePhysioProfile) {
  return {
    lt1_hr: p.lt1_hr ?? null,
    lt2_hr: p.lt2_hr ?? null,
    lt2_pace: p.lt2_pace ?? null,
    hr_max: p.hr_max ?? null,
    running_economy: p.running_economy ?? null,
  };
}

// ───────────────────────── Modelo de costo y sostenibilidad ─────────────────────────

/** Daniels-Gilbert: costo de oxígeno (ml/kg/min), v en m/min. */
export const danielsCost = (v: number) => -4.6 + 0.182258 * v + 0.000104 * v * v;

/** Daniels-Gilbert: fracción sostenible del VO2max para una duración t (min). */
export const danielsFraction = (t: number) =>
  0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);

/** RE de referencia (ml/kg/km) equivalente a Daniels a ~15 km/h (velocidad típica de test en cinta). */
const RE_REF = 190;

/** Velocidad (m/min) en plano y nivel del mar cuyo costo = vo2 (ml/kg/min). */
function speedForVO2(vo2: number, scale = 1): number {
  const a = 0.000104, b = 0.182258, c = 4.6 + vo2 / scale;
  return (-b + Math.sqrt(b * b + 4 * a * c)) / (2 * a);
}

function reScale(p: AthletePhysioProfile): { scale: number; source: 'measured' | 'daniels' } {
  const re = p.running_economy;
  if (re && re > 150 && re < 300) return { scale: clamp(re / RE_REF, 0.88, 1.15), source: 'measured' };
  return { scale: 1, source: 'daniels' };
}

const TERRAIN_COST: Record<Terrain, number> = { flat: 1.0, rolling: 1.04, hilly: 1.09 }; // HEURÍSTICA (costo metabólico medio)

// ───────────────────────── Ambiente ─────────────────────────

/** Bulbo húmedo (Stull 2011). T °C, RH %. */
function wetBulb(T: number, RH: number): number {
  const rh = clamp(RH, 5, 99);
  return (
    T * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(T + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
    4.686035
  );
}

/** WBGT a la sombra, sin radiación solar (subestima con sol). */
export function wbgtShade(T: number, RH: number): number {
  return 0.7 * wetBulb(T, RH) + 0.3 * T;
}

/** Enlentecimiento fraccional por calor a esfuerzo constante. HEURÍSTICA basada en Ely et al. 2007: crece con la duración. */
function heatSlowdown(wbgt: number, durationMin: number): number {
  return Math.max(0, wbgt - 10) * (0.0008 + 0.0032 * Math.min(durationMin / 240, 1));
}

/** Pérdida de VO2max por altitud (%). Atletas entrenados: ~6.3-6.5 %/1000 m desde ~600 m (Wehrlin & Hallén 2006; Fulco 1998). */
export function altitudeVO2maxLossPct(alt: number): number {
  if (alt <= 600) return 0;
  const loss = 6.5 * (Math.min(alt, 3000) - 600) / 1000 + (alt > 3000 ? 8.0 * (alt - 3000) / 1000 : 0);
  return Math.min(80, loss);
}

// ───────────────────────── Umbrales, FC, lactato, sustratos ─────────────────────────

interface Thresholds {
  lt1: { pct: number; source: 'lab' | 'pace' | 'default' };
  lt2: { pct: number; source: 'lab' | 'pace' | 'default' };
}

function resolveThresholds(p: AthletePhysioProfile, scale: number): Thresholds {
  const pick = (vo2: number | null | undefined, pace: string | null | undefined, def: number) => {
    if (vo2 && vo2 > 0) return { pct: vo2 / p.vo2max, source: 'lab' as const };
    const pc = parsePace(pace);
    if (pc) return { pct: (danielsCost(1000 / pc) * scale) / p.vo2max, source: 'pace' as const };
    return { pct: def, source: 'default' as const };
  };
  const lt1 = pick(p.lt1_vo2, p.lt1_pace, 0.7);
  const lt2 = pick(p.lt2_vo2, p.lt2_pace, 0.85);
  lt1.pct = clamp(lt1.pct, 0.45, 0.9);
  lt2.pct = clamp(lt2.pct, lt1.pct + 0.05, 0.97);
  return { lt1, lt2 };
}

function buildHRCurve(p: AthletePhysioProfile, hrMax: number, thr: Thresholds) {
  const hrRest = p.hr_rest && p.hr_rest > 30 ? p.hr_rest : 55;
  const raw: [number, number][] = [[3.5, hrRest]];
  if (p.lt1_hr) raw.push([thr.lt1.pct * p.vo2max, p.lt1_hr]);
  if (p.lt2_hr) raw.push([thr.lt2.pct * p.vo2max, p.lt2_hr]);
  raw.push([p.vo2max, hrMax]);
  raw.sort((a, b) => a[0] - b[0]);
  const pts: [number, number][] = [];
  for (const pt of raw) if (!pts.length || pt[1] > pts[pts.length - 1][1]) pts.push(pt);
  const inv: [number, number][] = pts.map(([x, y]) => [y, x]);
  return {
    source: (p.lt1_hr || p.lt2_hr ? 'lab' : 'karvonen') as 'lab' | 'karvonen',
    hrAt: (vo2: number) => (vo2 >= p.vo2max ? hrMax : interp(pts, vo2)),
    vo2At: (hr: number) => interp(inv, hr),
  };
}

/** Fracción de la energía aportada por grasa (curva continua). HEURÍSTICA; el punto medio se ancla a fatmax_hr si existe. */
function fatEnergyFraction(rel: number, midpointPct: number): number {
  return 0.7 / (1 + Math.exp((rel * 100 - midpointPct) / 8));
}

const kcalPerLO2 = (fatFrac: number) => 5.047 - 0.361 * fatFrac; // 5.047 (CHO) → 4.686 (grasa)

// ───────────────────────── Simulador de carrera ─────────────────────────

const STRATEGY_SHAPE: Record<Strategy, number> = { even: 0, positive: 0.04, negative: -0.03 };
const STRATEGY_FADE: Record<Strategy, number> = { even: 1.0, positive: 1.25, negative: 0.9 }; // HEURÍSTICA
const GLYCOGEN_G_PER_KG: Record<GlycogenState, number> = { depleted: 4.5, normal: 6.5, loaded: 8.5 }; // stock total aprox. (Burke 2011)
const ZONE_COLORS = ['#22c55e', '#84cc16', '#f59e0b', '#ef4444', '#dc2626', '#991b1b'];

function ratioAtPace(
  pace: number, distance: number, vo2maxEff: number, scale: number, tm: number, wbgt: number
): number {
  const T = pace * distance;
  const heatMult = 1 + 1.2 * heatSlowdown(wbgt, T);
  const demand = danielsCost(1000 / pace) * scale * tm * heatMult;
  return demand / vo2maxEff / danielsFraction(T);
}

function solveSustainablePace(
  distance: number, vo2maxEff: number, scale: number, tm: number, wbgt: number
): number {
  let lo = 2.0, hi = 20.0;
  if (ratioAtPace(hi, distance, vo2maxEff, scale, tm, wbgt) > 1) return hi;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (ratioAtPace(mid, distance, vo2maxEff, scale, tm, wbgt) > 1) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function simulateRace(profile: AthletePhysioProfile, scenario: RaceScenario): RaceSimResult {
  const d = scenario.distance_km;
  const targetPace = scenario.targetPace_min_km;
  if (!(d > 0) || !(targetPace > 0) || !(profile.vo2max > 0)) throw new Error('simulateRace: distancia, ritmo y VO2max deben ser > 0');

  const weight = profile.weight_kg ?? 70;
  const { scale, source: reSource } = reScale(profile);
  const altLoss = altitudeVO2maxLossPct(scenario.altitude_m);
  const vo2maxEff = profile.vo2max * (1 - altLoss / 100);
  const wbgt = wbgtShade(scenario.temperature_c, scenario.humidity_percent);
  const tm = TERRAIN_COST[scenario.terrain];

  const hrMaxSource: DataQuality['hrMax'] = profile.hr_max ? 'measured' : profile.lt2_hr ? 'lt2-derived' : 'default';
  const hrMax = profile.hr_max ?? (profile.lt2_hr ? Math.round(profile.lt2_hr / 0.92) : 185);
  const thr = resolveThresholds(profile, scale);
  const hrCurve = buildHRCurve(profile, hrMax, thr);

  // Lactato
  const curve = (profile.lactate_curve ?? []).filter((p) => p.speed_kmh > 0).sort((a, b) => a.speed_kmh - b.speed_kmh);
  const hasCurve = curve.length >= 3;
  const curvePts: [number, number][] = curve.map((p) => [p.speed_kmh, p.lactate_mmol]);
  const speedKmhOfPct = (pct: number) => (speedForVO2(pct * profile.vo2max, scale) * 60) / 1000;
  const lt1Speed = parsePace(profile.lt1_pace) ? 60 / (parsePace(profile.lt1_pace) as number) : speedKmhOfPct(thr.lt1.pct);
  const lt2Speed = parsePace(profile.lt2_pace) ? 60 / (parsePace(profile.lt2_pace) as number) : speedKmhOfPct(thr.lt2.pct);
  const lt1Lactate = hasCurve ? interp(curvePts, lt1Speed) : 2.0;
  const lt2Lactate = hasCurve ? interp(curvePts, lt2Speed) : 4.0;
  const lactateSteady = (rel: number): number => {
    if (hasCurve) return interp(curvePts, (speedForVO2(rel * profile.vo2max, scale) * 60) / 1000);
    const anchors: [number, number][] = [[0.4, 1.0], [thr.lt1.pct, lt1Lactate], [thr.lt2.pct, lt2Lactate], [1.0, 9.0], [1.15, 13.0]];
    return interp(anchors, rel);
  };
  const lactateAt = (rel: number, tMin: number): number => {
    const lss = lactateSteady(rel);
    const base = 1 + (Math.min(lss, lt2Lactate) - 1) * (1 - Math.exp(-tMin / 5));
    const excess = Math.max(0, lss - lt2Lactate) * (1 - Math.exp(-tMin / 15));
    return Math.min(18, Math.max(0.6, base + excess));
  };

  // Sustratos
  let fatMidpoint = 60;
  let fatmaxSource: 'lab' | 'default' = 'default';
  if (profile.fatmax_hr) {
    const v = hrCurve.vo2At(profile.fatmax_hr);
    if (isFinite(v)) { fatMidpoint = clamp((v / profile.vo2max) * 100 - 3, 40, 80); fatmaxSource = 'lab'; }
  }

  // Fueling (con defaults explícitos)
  const assumedFueling: string[] = [];
  const carbIntake = scenario.carbIntake_g_h ?? (assumedFueling.push('carbIntake=0 g/h'), 0);
  const fluidIntake = scenario.fluidIntake_L_h ?? (assumedFueling.push('fluidIntake=0.4 L/h'), 0.4);
  const gState = scenario.glycogenState ?? (assumedFueling.push('glycogenState=normal'), 'normal' as GlycogenState);
  const glycogenStart = weight * GLYCOGEN_G_PER_KG[gState];
  const wallThreshold = 0.15 * glycogenStart;
  const exoOxPerHour = Math.min(carbIntake, 90) * 0.8; // HEURÍSTICA: eficiencia intestinal/oxidación

  const nSeg = clamp(Math.ceil(d), 5, 20);
  const segLen = d / nSeg;

  function run(Tguess: number) {
    const heatMult = 1 + 1.2 * heatSlowdown(wbgt, Tguess);
    const demandTarget = danielsCost(1000 / targetPace) * scale * tm * heatMult;
    const ratio = demandTarget / vo2maxEff / danielsFraction(Tguess);

    const fadeBase =
      ratio <= 0.85 ? 0.015 : ratio <= 1 ? 0.015 + ((ratio - 0.85) / 0.15) * 0.035 : Math.min(0.25, 0.05 + (ratio - 1) * 0.8);
    const fadeMult = STRATEGY_FADE[scenario.strategy];
    const a = STRATEGY_SHAPE[scenario.strategy];

    let glycogen = glycogenStart, cumSweat = 0, cumFluid = 0, elapsed = 0;
    let wallKm: number | null = null;
    let kcal = 0, cho = 0, fat = 0, glyUsed = 0, exo = 0, sweatRateMax = 0;
    let hrW = 0, relW = 0;
    const zoneTime = [0, 0, 0, 0, 0, 0];
    const splits: RaceSplit[] = [];
    const mid12 = (thr.lt1.pct + thr.lt2.pct) / 2;
    const z5Hi = Math.max(0.95, thr.lt2.pct + 0.03);
    const zoneNames = ['Z1-Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7'];
    const zoneOf = (r: number) => (r < thr.lt1.pct ? 0 : r < mid12 ? 1 : r < thr.lt2.pct ? 2 : r < z5Hi ? 3 : r < 1.02 ? 4 : 5);

    for (let i = 0; i < nSeg; i++) {
      const fracMid = (i + 0.5) / nSeg;
      const fracEnd = (i + 1) / nSeg;
      const shape = 1 + a * (2 * fracMid - 1); // media exacta = 1 → conserva el ritmo medio
      const dehydStart = (Math.max(0, cumSweat - cumFluid) / weight) * 100;
      const fracPost = wallKm !== null ? clamp((fracMid * d - wallKm) / Math.max(d - wallKm, 0.001), 0, 1) : 0;
      const delta =
        fadeBase * fadeMult * Math.pow(fracMid, 1.5) +
        0.01 * Math.max(0, dehydStart - 2) +
        (wallKm !== null ? 0.06 + 0.19 * fracPost : 0); // HEURÍSTICA

      const pace = targetPace * shape * (1 + delta);
      const v = 1000 / pace;
      const time = segLen * pace;
      const hours = time / 60;
      const costO2 = danielsCost(v) * scale * tm; // ml/kg/min (costo mecánico, sin estrés térmico)
      const rel = (costO2 * heatMult) / vo2maxEff; // intensidad relativa (incluye calor)
      const fatFrac = fatEnergyFraction(Math.min(rel, 1), fatMidpoint);
      const o2L = (costO2 * weight * time) / 1000;
      const segKcal = o2L * kcalPerLO2(fatFrac);
      const segCho = (segKcal * (1 - fatFrac)) / 4;
      const segFat = (segKcal * fatFrac) / 9;
      const segExo = Math.min(segCho, exoOxPerHour * hours);
      const segGly = Math.max(0, segCho - segExo);

      const gBefore = glycogen;
      glycogen = Math.max(0, glycogen - segGly);
      if (wallKm === null && glycogen <= wallThreshold) {
        const f = segGly > 0 ? clamp((gBefore - wallThreshold) / segGly, 0, 1) : 0;
        wallKm = i * segLen + f * segLen;
      }

      const sweatRate = clamp(0.0009 * (segKcal / hours) * (0.6 + 0.04 * Math.max(0, wbgt - 5)), 0.3, 2.5);
      sweatRateMax = Math.max(sweatRateMax, sweatRate);
      cumSweat += sweatRate * hours;
      cumFluid += fluidIntake * hours;
      const dehydEnd = (Math.max(0, cumSweat - cumFluid) / weight) * 100;

      const hrBase = hrCurve.hrAt(clamp(rel, 0, 1.05) * profile.vo2max);
      const hr = Math.min(hrMax, Math.round(hrBase * (1 + 0.04 * fracMid + 0.008 * ((dehydStart + dehydEnd) / 2))));
      elapsed += time;
      const fatigue = Math.min(100, (delta / 0.12) * 100);
      const zi = zoneOf(rel);

      kcal += segKcal; cho += segCho; fat += segFat; glyUsed += segGly; exo += segExo;
      hrW += hr * time; relW += rel * time; zoneTime[zi] += time;

      splits.push({
        km: Math.round(fracEnd * d * 100) / 100,
        pace_min_km: pace,
        paceStr: formatPace(pace),
        hr,
        percentVO2max: Math.round(rel * 1000) / 10,
        fatigue: Math.round(fatigue),
        lactate_mmol: Math.round(lactateAt(rel, elapsed) * 10) / 10,
        glycogenRemaining_g: Math.round(glycogen),
        dehydration_pct: Math.round(dehydEnd * 100) / 100,
        zone: zoneNames[zi],
      });
    }
    return {
      ratio, heatMult, totalTime: elapsed, kcal, cho, fat, glyUsed, exo, wallKm, glycogenEnd: glycogen,
      avgHR: hrW / elapsed, avgRel: relW / elapsed, zoneTime, splits, sweatRateMax,
      dehydFinal: (Math.max(0, cumSweat - cumFluid) / weight) * 100, sweatLoss: cumSweat,
    };
  }

  let T = d * targetPace;
  let r = run(T);
  for (let i = 0; i < 4; i++) { T = r.totalTime; r = run(T); }

  const sustainablePace = solveSustainablePace(d, vo2maxEff, scale, tm, wbgt);
  const fT = danielsFraction(r.totalTime);
  const ratio = r.ratio;
  const feasibility: Feasibility = ratio <= 0.9 ? 'optimal' : ratio <= 1.0 ? 'challenging' : ratio <= 1.08 ? 'limit' : 'impossible';

  const remainingPct = (r.glycogenEnd / glycogenStart) * 100;
  const bonkRisk: BonkRisk = r.wallKm !== null ? 'high' : remainingPct < 25 ? 'moderate' : remainingPct < 35 ? 'low' : 'none';

  const zoneTotal = r.zoneTime.reduce((s, x) => s + x, 0) || 1;
  const zones: ZoneShare[] = ['Z1-Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7'].map((name, i) => ({
    name, percent: Math.round((r.zoneTime[i] / zoneTotal) * 100), color: ZONE_COLORS[i],
  }));

  const avgPaceTotal = r.totalTime / d;
  const re = (danielsCost(1000 / targetPace) * scale * 1000) / (1000 / targetPace); // ml/kg/km

  // Alertas
  const hours = r.totalTime / 60;
  const riskFlags: EngineMessage[] = [];
  if (ratio > 1.0) riskFlags.push({ code: 'risk.aboveSustainable', severity: 'danger', params: { pct: Math.round(ratio * 100) } });
  else if (ratio > 0.92) riskFlags.push({ code: 'risk.nearLimit', severity: 'warning', params: { pct: Math.round(ratio * 100) } });
  if (r.dehydFinal > 4) riskFlags.push({ code: 'risk.dehydration', severity: 'danger', params: { pct: r.dehydFinal.toFixed(1) } });
  else if (r.dehydFinal > 2) riskFlags.push({ code: 'risk.dehydration', severity: 'warning', params: { pct: r.dehydFinal.toFixed(1) } });
  if (r.cho > 300 && d >= 21) riskFlags.push({ code: 'risk.carbsHigh', severity: 'info', params: { g: Math.round(r.cho) } });
  if (scenario.altitude_m > 2500) riskFlags.push({ code: 'risk.altitude', severity: 'warning', params: { loss: altLoss.toFixed(1) } });
  if (wbgt >= 28) riskFlags.push({ code: 'risk.heat', severity: 'danger', params: { wbgt: wbgt.toFixed(1) } });
  else if (wbgt >= 23) riskFlags.push({ code: 'risk.heat', severity: 'warning', params: { wbgt: wbgt.toFixed(1) } });
  if (r.wallKm !== null) riskFlags.push({ code: 'risk.wall', severity: 'danger', params: { km: r.wallKm.toFixed(1) } });
  if (scenario.strategy === 'positive' && d >= 10) riskFlags.push({ code: 'risk.positiveSplit', severity: 'warning' });

  // Recomendaciones
  const recommendations: EngineMessage[] = [];
  if (ratio > 0.95) recommendations.push({ code: 'rec.slowDown', params: { pace: formatPace(sustainablePace) } });
  if (r.dehydFinal > 2) recommendations.push({ code: 'rec.hydration', params: { ml: Math.round(r.sweatRateMax * 700) } });
  if (r.wallKm !== null || bonkRisk === 'moderate') {
    const deficit = Math.max(0, r.cho - (glycogenStart - wallThreshold));
    recommendations.push({ code: 'rec.carbs', params: { gh: Math.round(clamp(deficit / Math.max(hours, 0.1) / 0.8, 30, 90)) } });
  }
  if (r.wallKm !== null) recommendations.push({ code: 'rec.gelsBeforeWall', params: { km: Math.max(0, r.wallKm - 3).toFixed(0) } });
  if (scenario.altitude_m > 1000) recommendations.push({ code: 'rec.acclimatize' });
  if (wbgt > 18) recommendations.push({ code: 'rec.precool' });
  if (reSource === 'measured' && (profile.running_economy as number) > 215) recommendations.push({ code: 'rec.improveRE' });
  if (scenario.strategy === 'negative') recommendations.push({ code: 'rec.negativeGood' });

  const dataQuality: DataQuality = {
    runningEconomy: reSource, hr: hrCurve.source, hrMax: hrMaxSource,
    lt1: thr.lt1.source, lt2: thr.lt2.source,
    lactate: hasCurve ? 'lab-curve' : 'generic', fatmax: fatmaxSource, assumedFueling,
  };
  if (reSource === 'daniels' || hrCurve.source === 'karvonen' || thr.lt2.source === 'default') {
    recommendations.push({ code: 'rec.testData' });
  }
  if (!recommendations.length) recommendations.push({ code: 'rec.allGood' });

  return {
    predictedTime_min: r.totalTime,
    avgPace_min_km: avgPaceTotal,
    sustainableTime_min: sustainablePace * d,
    sustainablePace_min_km: sustainablePace,
    percentVO2max: Math.round(r.avgRel * 1000) / 10,
    sustainableFraction: fT,
    feasibilityRatio: ratio,
    feasibility,
    effectiveVO2max: vo2maxEff,
    avgHR: Math.round(r.avgHR),
    kcal: Math.round(r.kcal),
    carbsUsed_g: Math.round(r.cho),
    glycogenUsed_g: Math.round(r.glyUsed),
    exogenousCarbs_g: Math.round(r.exo),
    fatUsed_g: Math.round(r.fat),
    dehydration_pct: Math.round(r.dehydFinal * 10) / 10,
    sweatRate_L_h: Math.round(r.sweatRateMax * 100) / 100,
    sweatLoss_L: Math.round(r.sweatLoss * 100) / 100,
    glycogenStart_g: Math.round(glycogenStart),
    glycogenDepletionKm: r.wallKm !== null ? Math.round(r.wallKm * 10) / 10 : null,
    bonkRisk,
    runningEconomy: Math.round(re),
    runningEconomySource: reSource,
    wbgt: Math.round(wbgt * 10) / 10,
    heatSlowdown_pct: Math.round(heatSlowdown(wbgt, r.totalTime) * 1000) / 10,
    altitudeLoss_pct: Math.round(altLoss * 10) / 10,
    thresholds: { lt1Pct: thr.lt1.pct, lt2Pct: thr.lt2.pct, lt1Lactate, lt2Lactate },
    zones, splits: r.splits, riskFlags, recommendations, dataQuality,
  };
}

// ───────────────────────── Simulador inverso ─────────────────────────

export type InverseScenario = Pick<RaceScenario, 'distance_km'> &
  Partial<Pick<RaceScenario, 'terrain' | 'temperature_c' | 'humidity_percent' | 'altitude_m'>>;

const TRAINABLE_CEILING = (vo2max: number) =>
  vo2max < 40 ? 0.2 : vo2max < 50 ? 0.12 : vo2max < 60 ? 0.08 : vo2max < 70 ? 0.05 : 0.03; // HEURÍSTICA: techo de mejora relativa del VO2max

export function simulateInverse(
  targetTime_min: number,
  scenario: InverseScenario,
  currentVO2max: number,
  opts: { running_economy?: number | null } = {}
): InverseSimResult {
  const d = scenario.distance_km;
  if (!(d > 0) || !(targetTime_min > 0) || !(currentVO2max > 0)) throw new Error('simulateInverse: parámetros inválidos');
  const { scale } = reScale({ vo2max: currentVO2max, running_economy: opts.running_economy });
  const tm = TERRAIN_COST[scenario.terrain ?? 'flat'];
  const wbgt = wbgtShade(scenario.temperature_c ?? 18, scenario.humidity_percent ?? 55);
  const altFactor = 1 - altitudeVO2maxLossPct(scenario.altitude_m ?? 0) / 100;

  const targetPace = targetTime_min / d;
  const heatMult = 1 + 1.2 * heatSlowdown(wbgt, targetTime_min);
  const demand = danielsCost(1000 / targetPace) * scale * tm * heatMult;
  const f = danielsFraction(targetTime_min);
  const requiredVO2max = demand / (f * altFactor); // sin 85 % fijo: usa f(t) igual que el directo
  const gap = requiredVO2max - currentVO2max;

  const sustainable = (vo2max: number) => solveSustainablePace(d, vo2max * altFactor, scale, tm, wbgt);
  const curPace = sustainable(currentVO2max);

  const ceiling = TRAINABLE_CEILING(currentVO2max);
  const projection = [4, 8, 12, 16, 20, 24].map((week) => {
    const proj = currentVO2max * (1 + ceiling * (1 - Math.exp(-week / 12)));
    const pace = sustainable(proj);
    const time = pace * d;
    return {
      week, projectedVO2max: Math.round(proj * 10) / 10, projectedTime_min: time, projectedPace_min_km: pace,
      diffVsTarget_min: time - targetTime_min, targetReached: time <= targetTime_min,
    };
  });

  const feasibilityComment: EngineMessage =
    gap <= 0 ? { code: 'inv.reached', severity: 'info' }
    : gap < 3 ? { code: 'inv.short', severity: 'info' }
    : gap < 8 ? { code: 'inv.demanding', severity: 'warning' }
    : { code: 'inv.longterm', severity: 'danger' };

  return {
    requiredVO2max: Math.round(requiredVO2max * 10) / 10,
    currentVO2max,
    gap: Math.round(gap * 10) / 10,
    targetPace_min_km: targetPace,
    sustainableFraction: f,
    currentSustainablePace_min_km: curPace,
    currentSustainableTime_min: curPace * d,
    feasibilityComment,
    projection,
    assumptions: [
      `Mejora máxima de VO2max ${Math.round(ceiling * 100)} % (según nivel), curva exponencial τ=12 sem.`,
      'No modela mejoras de RE ni de umbral, que en atletas entrenados pesan más que el VO2max.',
    ],
  };
}

// ───────────────────────── Simulador de altitud ─────────────────────────

const SPO2_REST: [number, number][] = [
  [0, 98], [1000, 97], [1500, 96], [2500, 94], [3500, 91], [4500, 86], [5500, 81], [6500, 76], [8000, 70],
];

/** Ganancia de masa de Hb (%) por dosis: ~1.1 %/100 h a ≥2100-2500 m (Gore 2013). Tope 6 %. */
export function hbMassGainPct(alt: number, days: number, hoursPerDay = 24): number {
  const dose = clamp((alt - 1800) / 600, 0, 1);
  return Math.min(6, 1.1 * ((days * hoursPerDay) / 100) * dose);
}

/** Cambio relativo de velocidad sostenible ante un cambio de VO2max, a 90 % del VO2max (elasticidad ~0.8 en Daniels). */
function speedLossPct(vo2max: number, vo2maxAdj: number): number {
  const v0 = speedForVO2(0.9 * vo2max);
  const v1 = speedForVO2(0.9 * vo2maxAdj);
  return (1 - v1 / v0) * 100;
}

export const ALTITUDE_COMPENSATORY = [
  { code: 'alt.comp.epo', timeframe: '24-48 h' },
  { code: 'alt.comp.dpg', timeframe: '2-3 d' },
  { code: 'alt.comp.erythro', timeframe: '7-14 d' },
  { code: 'alt.comp.hbmass', timeframe: '14-21 d+' },
];

export function simulateAltitude(profile: AthletePhysioProfile, scenario: AltitudeScenario): AltitudeSimResult {
  const alt = scenario.altitude_m;
  const hpd = scenario.hoursPerDay ?? 24;
  const loss = altitudeVO2maxLossPct(alt);
  const lossRange: [number, number] = [Math.round(loss * 0.7 * 10) / 10, Math.round(Math.min(80, loss * 1.3) * 10) / 10];
  const vo2Adj = profile.vo2max * (1 - loss / 100);

  const PB = 760 * Math.exp(-alt / 7924);
  const PiO2 = 0.2093 * (PB - 47);
  const PaCO2 = clamp(40 - 0.0028 * alt, 17, 40);
  const PAO2 = Math.round(PiO2 - PaCO2 / 0.85);
  const spo2Rest = Math.round(interp(SPO2_REST, alt));
  const spo2Ex = Math.round(clamp(spo2Rest - (0.5 + (2.5 * alt) / 1000), 50, 99));

  const days = Math.min(Math.max(Math.round(scenario.exposure_days), 1), 28);
  const schedule = [];
  for (let day = 0; day <= days; day++) {
    const hb = hbMassGainPct(alt, day, hpd);
    const recovered = 0.15 * (1 - Math.exp(-day / 7)); // HEURÍSTICA: la aclimatación recupera poco VO2max
    const base = profile.vo2max * (1 - (loss / 100) * (1 - recovered));
    const vo2 = base * (1 + 0.007 * hb);
    const lostAcute = profile.vo2max - vo2Adj;
    schedule.push({
      day,
      vo2max: Math.round(vo2 * 10) / 10,
      vo2maxPctOfSeaLevel: Math.round((vo2 / profile.vo2max) * 1000) / 10,
      hbMassGain_pct: Math.round(hb * 10) / 10,
      lossRecovered_pct: lostAcute > 0 ? Math.round(clamp(((vo2 - vo2Adj) / lostAcute) * 100, 0, 100)) : 0,
      performanceLoss_pct: Math.round(speedLossPct(profile.vo2max, vo2) * 10) / 10,
    });
  }

  const zoneDefs: [number, number | null, string, string][] = [
    [0, 600, 'alt.zone.sea', '#22c55e'],
    [600, 1500, 'alt.zone.mild', '#84cc16'],
    [1500, 2500, 'alt.zone.moderate', '#f59e0b'],
    [2500, 3500, 'alt.zone.high', '#ef4444'],
    [3500, 5000, 'alt.zone.veryHigh', '#dc2626'],
    [5000, null, 'alt.zone.extreme', '#991b1b'],
  ];
  const zones = zoneDefs.map(([minAlt, maxAlt, code, color]) => ({
    minAlt, maxAlt, code, color,
    lossFrom_pct: Math.round(altitudeVO2maxLossPct(minAlt) * 10) / 10,
    lossTo_pct: maxAlt === null ? null : Math.round(altitudeVO2maxLossPct(maxAlt) * 10) / 10,
  }));

  const riskFlags: EngineMessage[] = [];
  if (alt > 2500) riskFlags.push({ code: 'alt.risk.moderate', severity: 'warning', params: { loss: loss.toFixed(1) } });
  if (alt > 3500) riskFlags.push({ code: 'alt.risk.ams', severity: 'danger' });
  if (alt > 4000 && scenario.training_load === 'hard') riskFlags.push({ code: 'alt.risk.hardLoad', severity: 'danger' });
  if (spo2Rest < 90) riskFlags.push({ code: 'alt.risk.spo2', severity: 'danger', params: { spo2: spo2Rest } });
  if (scenario.exposure_days < 3 && alt > 2500) riskFlags.push({ code: 'alt.risk.shortExposure', severity: 'info' });
  if (scenario.exposure_days >= 21 && alt >= 2200 && alt <= 3000) riskFlags.push({ code: 'alt.risk.lhtl', severity: 'info' });

  const rec: EngineMessage[] = [];
  if (alt >= 2000 && alt <= 3000) rec.push({ code: 'alt.rec.lhtl' });
  if (alt > 1500) rec.push({ code: 'alt.rec.hydration' });
  if (alt > 1500 && scenario.training_load !== 'rest') {
    rec.push({ code: 'alt.rec.reduceLoad', params: { pct: alt > 3000 ? '40-50' : '15-25', sec: Math.round((alt / 100) * 2) } });
  }
  if (alt > 1500) rec.push({ code: 'alt.rec.iron' });
  if (scenario.exposure_days >= 14) rec.push({ code: 'alt.rec.recovery' });
  if (spo2Rest < 90) rec.push({ code: 'alt.rec.medical' });
  if (alt > 1500) rec.push({ code: 'alt.rec.nutrition' });

  return {
    barometric_mmHg: Math.round(PB),
    alveolarPO2: PAO2,
    spo2Rest, spo2Exercise: spo2Ex,
    vo2maxReduction_pct: Math.round(loss * 10) / 10,
    vo2maxReductionRange_pct: lossRange,
    adjustedVO2max: Math.round(vo2Adj * 10) / 10,
    hrIncrease_bpm: Math.round((alt / 1000) * 3.5), // HEURÍSTICA: FC submáxima aguda
    ventilationIncrease_pct: Math.round((alt / 1000) * 12), // HEURÍSTICA
    performanceLoss_pct: Math.round(speedLossPct(profile.vo2max, vo2Adj) * 10) / 10,
    hbMassGain_pct: schedule[schedule.length - 1].hbMassGain_pct,
    acclimatization: schedule,
    zones, riskFlags, recommendations: rec,
  };
}

// ───────────────────────── Comparador de bloque de altitud ─────────────────────────

export interface AltitudeBlockInput {
  altitude_m: number;
  days: number;
  hoursPerDay?: number; // default 14 (LHTH típico)
  distance_km: number;
  targetPace_min_km: number;
}

export function simulateAltitudeBlock(profile: AthletePhysioProfile, input: AltitudeBlockInput): AltitudeBlockResult {
  const hpd = input.hoursPerDay ?? 14;
  const altSim = simulateAltitude(profile, { altitude_m: input.altitude_m, exposure_days: input.days, training_load: 'moderate', hoursPerDay: hpd });
  const hb = hbMassGainPct(input.altitude_m, input.days, hpd);
  // Hb → VO2max: 0 % (no respondedor/destreno), 0.7 % central, 1.0 % alto por cada 1 % de Hb. HEURÍSTICA
  const boost = { low: 0, central: profile.vo2max * hb * 0.007, high: profile.vo2max * hb * 0.01 };
  const base: RaceScenario = {
    distance_km: input.distance_km, name: 'ref', targetPace_min_km: input.targetPace_min_km, terrain: 'flat',
    temperature_c: 18, humidity_percent: 55, altitude_m: 0, strategy: 'even',
  };
  const before = simulateRace(profile, base);
  const afterLow = simulateRace({ ...profile, vo2max: profile.vo2max + boost.low }, base);
  const afterCentral = simulateRace({ ...profile, vo2max: profile.vo2max + boost.central }, base);
  const afterHigh = simulateRace({ ...profile, vo2max: profile.vo2max + boost.high }, base);
  const doseHours = input.days * hpd;
  return {
    altitude: altSim,
    hbMassGain_pct: Math.round(hb * 10) / 10,
    vo2max: {
      before: profile.vo2max,
      afterLow: Math.round((profile.vo2max + boost.low) * 10) / 10,
      afterCentral: Math.round((profile.vo2max + boost.central) * 10) / 10,
      afterHigh: Math.round((profile.vo2max + boost.high) * 10) / 10,
    },
    before, after: afterCentral,
    // El ahorro se mide en tiempo SOSTENIBLE (el tiempo "predicho" a ritmo fijo no depende del VO2max).
    timeSaving_min: {
      low: before.sustainableTime_min - afterLow.sustainableTime_min,
      central: before.sustainableTime_min - afterCentral.sustainableTime_min,
      high: before.sustainableTime_min - afterHigh.sustainableTime_min,
    },
    optimalReturnPace_min_km: afterCentral.sustainablePace_min_km,
    doseHours,
    doseWarning: input.altitude_m < 2100 || doseHours < 250,
  };
}

// ───────────────────────── Mensajes (i18n sin dependencias) ─────────────────────────

const MESSAGES: Record<Lang, Record<string, string>> = {
  es: {
    'risk.aboveSustainable': 'El ritmo objetivo exige el {pct} % de lo que el atleta puede sostener en esta duración: no es sostenible.',
    'risk.nearLimit': 'El ritmo objetivo exige el {pct} % de lo sostenible: margen mínimo.',
    'risk.dehydration': 'Deshidratación estimada de {pct} % de la masa corporal.',
    'risk.carbsHigh': 'Oxidación de carbohidratos alta ({g} g): planificá la ingesta.',
    'risk.altitude': 'Altitud >2500 m: pérdida estimada de VO2max de {loss} % (con variabilidad individual).',
    'risk.heat': 'Estrés térmico alto (WBGT estimado {wbgt} °C, sin radiación solar).',
    'risk.wall': 'Riesgo de "pared" por glucógeno hacia el km {km}.',
    'risk.positiveSplit': 'Salir rápido aumenta el costo y la caída en la segunda mitad.',
    'rec.slowDown': 'Ritmo máximo sostenible estimado: {pace} /km.',
    'rec.hydration': 'Reponer ~{ml} ml/h para limitar la pérdida de masa corporal.',
    'rec.carbs': 'Ingerir ~{gh} g/h de carbohidratos para evitar la pared.',
    'rec.gelsBeforeWall': 'Empezar a ingerir carbohidratos antes del km {km}.',
    'rec.acclimatize': 'Aclimatar o llegar con margen si la carrera es en altitud.',
    'rec.precool': 'Considerar pre-enfriamiento y manejo térmico.',
    'rec.improveRE': 'Economía de carrera medida alta: trabajar técnica, fuerza y pliometría.',
    'rec.negativeGood': 'Estrategia negative split: reduce la caída tardía.',
    'rec.testData': 'Hay datos estimados (RE, FC, umbrales): un test de laboratorio mejora la precisión.',
    'rec.allGood': 'Sin alertas relevantes.',
    'inv.reached': 'El VO2max actual ya alcanza el requerido para este objetivo.',
    'inv.short': 'Brecha pequeña: alcanzable a corto plazo.',
    'inv.demanding': 'Objetivo exigente: meses de entrenamiento específico.',
    'inv.longterm': 'Brecha muy grande: objetivo de largo plazo o poco realista con el VO2max actual.',
    'alt.risk.moderate': 'Altitud moderada: pérdida estimada de VO2max de {loss} %.',
    'alt.risk.ams': 'Riesgo de mal agudo de montaña (AMS): ascenso gradual.',
    'alt.risk.hardLoad': 'Carga intensa a gran altitud: riesgo elevado.',
    'alt.risk.spo2': 'SpO2 en reposo estimada de {spo2} %.',
    'alt.risk.shortExposure': 'Menos de 3 días: aclimatación mínima.',
    'alt.risk.lhtl': 'Exposición prolongada a 2200-3000 m: rango del protocolo LHTL.',
    'alt.rec.lhtl': 'Altitud en rango LHTL (2000-3000 m): mantener sesiones intensas más abajo si es posible.',
    'alt.rec.hydration': 'Aumentar la hidratación (mayor pérdida respiratoria).',
    'alt.rec.reduceLoad': 'Reducir la carga {pct} %; intervalos más cortos (~{sec} s).',
    'alt.rec.iron': 'Controlar ferritina y hierro antes y después.',
    'alt.rec.recovery': 'Más recuperación tras 14+ días de exposición.',
    'alt.rec.medical': 'Monitoreo médico recomendado (SpO2 baja).',
    'alt.rec.nutrition': 'Priorizar carbohidratos y hierro en la dieta.',
    'alt.zone.sea': 'Nivel del mar / sin efecto',
    'alt.zone.mild': 'Efecto leve',
    'alt.zone.moderate': 'Altitud moderada',
    'alt.zone.high': 'Gran altitud',
    'alt.zone.veryHigh': 'Muy gran altitud',
    'alt.zone.extreme': 'Extrema (sin habitación permanente >5500 m)',
    'alt.comp.epo': 'Aumento de EPO',
    'alt.comp.dpg': 'Aumento de 2,3-DPG',
    'alt.comp.erythro': 'Eritropoyesis',
    'alt.comp.hbmass': 'Aumento de masa de hemoglobina',
  },
  en: {
    'risk.aboveSustainable': 'Target pace demands {pct} % of what the athlete can sustain for this duration: not sustainable.',
    'risk.nearLimit': 'Target pace demands {pct} % of sustainable: minimal margin.',
    'risk.dehydration': 'Estimated dehydration of {pct} % of body mass.',
    'risk.carbsHigh': 'High carbohydrate oxidation ({g} g): plan your fueling.',
    'risk.altitude': 'Altitude >2500 m: estimated VO2max loss of {loss} % (large individual variability).',
    'risk.heat': 'High heat stress (estimated WBGT {wbgt} °C, no solar load).',
    'risk.wall': 'Glycogen "wall" risk around km {km}.',
    'risk.positiveSplit': 'Starting fast raises cost and second-half fade.',
    'rec.slowDown': 'Estimated maximal sustainable pace: {pace} /km.',
    'rec.hydration': 'Replace ~{ml} ml/h to limit body-mass loss.',
    'rec.carbs': 'Take in ~{gh} g/h of carbohydrate to avoid the wall.',
    'rec.gelsBeforeWall': 'Start fueling before km {km}.',
    'rec.acclimatize': 'Acclimatize or arrive early if racing at altitude.',
    'rec.precool': 'Consider pre-cooling and heat management.',
    'rec.improveRE': 'Measured running economy is high: work on technique, strength and plyometrics.',
    'rec.negativeGood': 'Negative split reduces late-race fade.',
    'rec.testData': 'Some inputs are estimated (RE, HR, thresholds): a lab test improves accuracy.',
    'rec.allGood': 'No relevant alerts.',
    'inv.reached': 'Current VO2max already meets the requirement for this goal.',
    'inv.short': 'Small gap: achievable short-term.',
    'inv.demanding': 'Demanding goal: months of specific training.',
    'inv.longterm': 'Very large gap: long-term or unrealistic with current VO2max.',
    'alt.risk.moderate': 'Moderate altitude: estimated VO2max loss of {loss} %.',
    'alt.risk.ams': 'Acute mountain sickness (AMS) risk: ascend gradually.',
    'alt.risk.hardLoad': 'Hard training at high altitude: elevated risk.',
    'alt.risk.spo2': 'Estimated resting SpO2 of {spo2} %.',
    'alt.risk.shortExposure': 'Under 3 days: minimal acclimatization.',
    'alt.risk.lhtl': 'Prolonged exposure at 2200-3000 m: within the LHTL protocol range.',
    'alt.rec.lhtl': 'Altitude within LHTL range (2000-3000 m): keep hard sessions lower if possible.',
    'alt.rec.hydration': 'Increase hydration (higher respiratory loss).',
    'alt.rec.reduceLoad': 'Reduce load by {pct} %; shorter intervals (~{sec} s).',
    'alt.rec.iron': 'Check ferritin and iron before and after.',
    'alt.rec.recovery': 'Add recovery after 14+ days of exposure.',
    'alt.rec.medical': 'Medical monitoring advised (low SpO2).',
    'alt.rec.nutrition': 'Prioritize carbohydrate and iron intake.',
    'alt.zone.sea': 'Sea level / no effect',
    'alt.zone.mild': 'Mild effect',
    'alt.zone.moderate': 'Moderate altitude',
    'alt.zone.high': 'High altitude',
    'alt.zone.veryHigh': 'Very high altitude',
    'alt.zone.extreme': 'Extreme (no permanent habitation >5500 m)',
    'alt.comp.epo': 'EPO increase',
    'alt.comp.dpg': '2,3-DPG increase',
    'alt.comp.erythro': 'Erythropoiesis',
    'alt.comp.hbmass': 'Hemoglobin mass increase',
  },
};

export function formatEngineMessage(msg: { code: string; params?: Record<string, number | string> }, lang: Lang = 'es'): string {
  const tpl = MESSAGES[lang][msg.code] ?? msg.code;
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (msg.params && msg.params[k] !== undefined ? String(msg.params[k]) : `{${k}}`));
}
