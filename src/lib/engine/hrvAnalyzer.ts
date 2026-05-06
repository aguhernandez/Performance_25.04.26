export interface HrvDataPoint {
  date: string;
  rmssd?: number | null;
  sdnn?: number | null;
  hrv_score?: number | null;
  morning_hr?: number | null;
}

export interface HrvAnalysis {
  baseline: number;
  current: number | null;
  trend7d: 'rising' | 'falling' | 'stable' | 'insufficient_data';
  suppressionPct: number;
  isSuppressed: boolean;
  fatigueFactor: number;
  formAdjustment: number;
  recommendation: string | null;
}

export function analyzeHrv(hrv_logs: HrvDataPoint[]): HrvAnalysis {
  const sorted = [...hrv_logs]
    .filter(h => h.rmssd !== null && h.rmssd !== undefined && h.rmssd > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length < 3) {
    return {
      baseline: 0,
      current: null,
      trend7d: 'insufficient_data',
      suppressionPct: 0,
      isSuppressed: false,
      fatigueFactor: 1.0,
      formAdjustment: 1.0,
      recommendation: null,
    };
  }

  const rmssdValues = sorted.map(h => h.rmssd as number);
  const recent7 = rmssdValues.slice(-7);
  const prior7 = rmssdValues.slice(-14, -7);

  const baseline = rmssdValues.slice(-28).reduce((a, b) => a + b, 0) / Math.min(28, rmssdValues.length);
  const current = recent7[recent7.length - 1] ?? null;

  const avg7 = recent7.reduce((a, b) => a + b, 0) / recent7.length;
  const avgPrior = prior7.length > 0 ? prior7.reduce((a, b) => a + b, 0) / prior7.length : avg7;

  const trend7d = avg7 > avgPrior * 1.05 ? 'rising' : avg7 < avgPrior * 0.95 ? 'falling' : 'stable';

  const suppressionPct = baseline > 0 ? Math.max(0, (baseline - avg7) / baseline) : 0;
  const isSuppressed = suppressionPct > 0.1;

  let fatigueFactor = 1.0;
  let formAdjustment = 1.0;

  if (isSuppressed) {
    fatigueFactor = 0.75 + (1 - suppressionPct) * 0.25;
    formAdjustment = 0.8 + (1 - suppressionPct) * 0.2;
  } else if (trend7d === 'rising') {
    formAdjustment = 1.05;
  }

  let recommendation: string | null = null;
  if (suppressionPct > 0.2) {
    recommendation = `HRV suppressed ${(suppressionPct * 100).toFixed(0)}% below baseline — prioritize recovery today.`;
  } else if (trend7d === 'falling' && suppressionPct > 0.1) {
    recommendation = 'Declining HRV trend — consider reducing intensity this week.';
  } else if (trend7d === 'rising') {
    recommendation = 'Rising HRV — parasympathetic recovery improving. Good window for quality training.';
  }

  return {
    baseline: Math.round(baseline * 10) / 10,
    current,
    trend7d,
    suppressionPct: Math.round(suppressionPct * 1000) / 1000,
    isSuppressed,
    fatigueFactor: Math.round(fatigueFactor * 1000) / 1000,
    formAdjustment: Math.round(formAdjustment * 1000) / 1000,
    recommendation,
  };
}

export function computeHrvAdjustedForm(form: number, analysis: HrvAnalysis): number {
  if (!analysis.current || analysis.trend7d === 'insufficient_data') return form;
  return form * analysis.formAdjustment;
}
