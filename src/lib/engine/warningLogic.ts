import type {
  BannisterState,
  EngineWarning,
  EngineRecommendation,
  DailyBannisterResult,
  MultiCompartmentState,
  PhysiologicalProfile,
} from './types';

const OVERREACHING_THRESHOLD = 1.2;
const UNDERLOAD_THRESHOLD = 0.6;
const ACUTE_FATIGUE_THRESHOLD = 0.95;
const STAGNATION_DAYS = 21;

export function computeWarnings(
  current: BannisterState,
  history: DailyBannisterResult[],
  mc?: MultiCompartmentState
): EngineWarning[] {
  const warnings: EngineWarning[] = [];
  const ratio = current.fitness > 0 ? current.fatigue / current.fitness : 0;

  if (ratio > OVERREACHING_THRESHOLD) {
    warnings.push({
      type: 'overreaching',
      severity: ratio > 1.5 ? 'high' : 'medium',
      message: `Fatigue/Fitness ratio at ${(ratio * 100).toFixed(0)}% — Overreaching risk. Reduce load immediately.`,
      value: ratio,
      threshold: OVERREACHING_THRESHOLD,
    });
  }

  if (ratio < UNDERLOAD_THRESHOLD && current.fitness > 0) {
    warnings.push({
      type: 'underload',
      severity: 'low',
      message: `Fatigue/Fitness ratio at ${(ratio * 100).toFixed(0)}% — Training stimulus may be insufficient for adaptation.`,
      value: ratio,
      threshold: UNDERLOAD_THRESHOLD,
    });
  }

  if (current.fitness > 0 && current.fatigue > current.fitness * ACUTE_FATIGUE_THRESHOLD && ratio <= OVERREACHING_THRESHOLD) {
    warnings.push({
      type: 'acute_fatigue',
      severity: 'medium',
      message: `Acute fatigue approaching fitness level — sub-optimal performance window. Consider 24–48h recovery.`,
      value: current.fatigue / current.fitness,
      threshold: ACUTE_FATIGUE_THRESHOLD,
    });
  }

  if (history.length >= STAGNATION_DAYS) {
    const recent = history.slice(-STAGNATION_DAYS);
    const maxF = Math.max(...recent.map(d => d.fitness));
    const minF = Math.min(...recent.map(d => d.fitness));
    const variability = maxF > 0 ? (maxF - minF) / maxF : 0;

    if (variability < 0.05 && current.fitness > 0) {
      warnings.push({
        type: 'stagnation',
        severity: 'low',
        message: `Fitness variance < 5% over ${STAGNATION_DAYS} days — potential adaptation plateau. Consider load variation or periodization shift.`,
        value: variability,
        threshold: 0.05,
      });
    }
  }

  if (mc) {
    const { aerobic, glycolytic, neuromuscular } = mc;
    const maxComp = Math.max(aerobic.fitness, glycolytic.fitness, neuromuscular.fitness);
    if (maxComp > 0) {
      const minComp = Math.min(aerobic.fitness, glycolytic.fitness, neuromuscular.fitness);
      const imbalance = (maxComp - minComp) / maxComp;
      if (imbalance > 0.7) {
        warnings.push({
          type: 'compartment_imbalance',
          severity: 'low',
          message: `Significant compartment imbalance detected (${(imbalance * 100).toFixed(0)}% gap). Consider cross-training to balance aerobic, glycolytic, and neuromuscular systems.`,
          value: imbalance,
          threshold: 0.7,
        });
      }
    }
  }

  return warnings;
}

export function computeRecommendations(
  current: BannisterState,
  history: DailyBannisterResult[],
  mc: MultiCompartmentState,
  profile: PhysiologicalProfile
): EngineRecommendation[] {
  const recs: EngineRecommendation[] = [];
  const ratio = current.fitness > 0 ? current.fatigue / current.fitness : 0;

  if (ratio > OVERREACHING_THRESHOLD) {
    recs.push({
      category: 'recovery',
      priority: 'high',
      title: 'Mandatory Recovery Block',
      detail: `Fatigue/Fitness ratio (${(ratio * 100).toFixed(0)}%) exceeds the 120% overreaching threshold. Continued training at this level risks non-functional overreaching.`,
      actionable: 'Reduce training volume by 40–60% for 5–7 days. Prioritize sleep (≥9h), increase protein to ≥2.0g/kg, and consider active recovery sessions only.',
    });
  }

  if (ratio < UNDERLOAD_THRESHOLD && current.fitness > 0) {
    recs.push({
      category: 'load',
      priority: 'medium',
      title: 'Increase Training Stimulus',
      detail: `Low fatigue/fitness ratio (${(ratio * 100).toFixed(0)}%) suggests insufficient adaptation stimulus. Fitness gains are likely being limited.`,
      actionable: 'Progressively increase training volume or intensity. Add one quality session per week targeting glycolytic or neuromuscular systems depending on sport priorities.',
    });
  }

  if (history.length >= STAGNATION_DAYS) {
    const recent = history.slice(-STAGNATION_DAYS);
    const maxF = Math.max(...recent.map(d => d.fitness));
    const minF = Math.min(...recent.map(d => d.fitness));
    const variability = maxF > 0 ? (maxF - minF) / maxF : 0;

    if (variability < 0.05 && current.fitness > 0) {
      recs.push({
        category: 'training',
        priority: 'medium',
        title: 'Periodization Shift Required',
        detail: `Fitness has been stable within ${(variability * 100).toFixed(1)}% for ${STAGNATION_DAYS} days. Classic adaptation plateau — body has accommodated current stimuli.`,
        actionable: 'Implement a 2-week overload block (increase volume 15–25%), followed by a 7-day deload. Alternatively, shift the dominant training zone to break the stagnation.',
      });
    }
  }

  if (profile.vo2max < 45) {
    recs.push({
      category: 'testing',
      priority: 'low',
      title: 'Lab Testing Recommended',
      detail: `VO2max of ${profile.vo2max} ml/kg/min is limiting aerobic time constant precision. Updated lab data would improve tau personalization.`,
      actionable: 'Schedule an incremental VO2max test or ramp test. Also consider a blood lactate profile to precisely identify LT1/LT2 boundaries.',
    });
  }

  const bvFit = mc.neuromuscular.fitness;
  const aeroFit = mc.aerobic.fitness;
  if (aeroFit > 0 && bvFit / aeroFit < 0.2 && bvFit > 0) {
    recs.push({
      category: 'training',
      priority: 'low',
      title: 'Neuromuscular Underdevelopment',
      detail: `Neuromuscular compartment (${mc.neuromuscular.fitness.toFixed(2)}) is significantly below aerobic fitness. This may limit explosive performance in beach volleyball and sprint efforts.`,
      actionable: 'Add 2x plyometric or strength sessions per week for 4–6 weeks. Focus on compound movements (squats, jumps) with RIR 2–3 and progressive load.',
    });
  }

  if (current.form > 0 && ratio < 0.85) {
    recs.push({
      category: 'training',
      priority: 'medium',
      title: 'Optimal Performance Window',
      detail: `Current form (${current.form >= 0 ? '+' : ''}${current.form.toFixed(2)}) and recovery ratio (${(ratio * 100).toFixed(0)}%) indicate readiness for peak-performance efforts.`,
      actionable: 'Schedule high-intensity sessions, time trials, or competitions in the next 3–5 days. Take advantage of this performance window before fatigue re-accumulates.',
    });
  }

  return recs;
}

export function getFormLabel(form: number, fitness: number): {
  label: string;
  color: string;
  description: string;
} {
  const ratio = fitness > 0 ? form / fitness : 0;

  if (ratio > 0.15) return { label: 'Peak', color: '#22c55e', description: 'Optimal performance window' };
  if (ratio > 0.05) return { label: 'Primed', color: '#86efac', description: 'Good readiness, fitness accumulating' };
  if (ratio > -0.05) return { label: 'Transitional', color: '#f59e0b', description: 'Balanced – building phase' };
  if (ratio > -0.2) return { label: 'Building', color: '#fb923c', description: 'High training stress – adaptation loading' };
  return { label: 'Fatigued', color: '#ef4444', description: 'Recovery required before peak performance' };
}

export function getRecoveryRatioLabel(ratio: number): { label: string; color: string } {
  if (ratio < 0.6) return { label: 'Underloaded', color: '#94a3b8' };
  if (ratio < 0.8) return { label: 'Fresh', color: '#22c55e' };
  if (ratio < 1.0) return { label: 'Loaded', color: '#f59e0b' };
  if (ratio < 1.2) return { label: 'Heavy', color: '#fb923c' };
  return { label: 'Overreaching', color: '#ef4444' };
}
