import type { Session } from '../database.types';

export interface GlycogenState {
  muscleGlycogen: number;
  liverGlycogen: number;
  depletionRisk: 'low' | 'moderate' | 'high';
  recommendation: string | null;
}

export function computeGlycogenState(
  sessions: Session[],
  carbsGPerDay: number | undefined
): GlycogenState {
  if (sessions.length === 0) {
    return {
      muscleGlycogen: 1.0,
      liverGlycogen: 1.0,
      depletionRisk: 'low',
      recommendation: null,
    };
  }

  const last48h = sessions.filter(s => {
    const diff = (Date.now() - new Date(s.session_date).getTime()) / (1000 * 60 * 60);
    return diff <= 48;
  });

  let depletionIndex = 0;

  for (const s of last48h) {
    const durationHours = s.duration_min / 60;
    const intensity = s.rpe ? s.rpe / 10 : 0.6;

    if (durationHours > 1.5 && intensity > 0.75) {
      depletionIndex += durationHours * intensity * 0.5;
    } else if (durationHours > 2) {
      depletionIndex += durationHours * 0.3;
    }
  }

  const carbReplenishment = carbsGPerDay ? Math.min(1.0, carbsGPerDay / 400) : 0.5;
  depletionIndex *= (1 - carbReplenishment * 0.5);

  const muscleGlycogen = Math.max(0.2, 1 - depletionIndex * 0.35);
  const liverGlycogen = Math.max(0.1, 1 - depletionIndex * 0.5);

  const depletionRisk: GlycogenState['depletionRisk'] =
    muscleGlycogen < 0.5 ? 'high' :
    muscleGlycogen < 0.75 ? 'moderate' : 'low';

  let recommendation: string | null = null;
  if (depletionRisk === 'high') {
    recommendation = 'Glycogen levels likely depleted. Consume 1–1.5g carbs/kg within 30min of next session and prioritize high-carb meals.';
  } else if (depletionRisk === 'moderate') {
    recommendation = 'Moderate glycogen depletion — ensure adequate carbohydrate intake (6–8g/kg/day) before next hard session.';
  }

  return {
    muscleGlycogen: Math.round(muscleGlycogen * 100) / 100,
    liverGlycogen: Math.round(liverGlycogen * 100) / 100,
    depletionRisk,
    recommendation,
  };
}
