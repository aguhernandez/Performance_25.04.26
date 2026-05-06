import { useMemo } from 'react';
import type { Athlete, Session, NutritionLog } from '../lib/database.types';
import { individualizedTau } from '../lib/engine/tauPersonalizer';
import { sessionToImpulseInput } from '../lib/engine/impulseCalculator';
import { computeEngineOutput } from '../lib/engine/bannisterModel';
import { calculateBeachVolleyballImpulse } from '../lib/engine/beachVolleyCalculator';
import type { EngineOutput, PhysiologicalProfile } from '../lib/engine/types';
import { applyEnvironmentalStress, computeTrainingIntentionModifier } from '../lib/engine/environmentalModifiers';

export function useEngine(
  athlete: Athlete | null,
  sessions: Session[],
  nutritionLogs?: NutritionLog[]
): EngineOutput | null {
  return useMemo(() => {
    if (!athlete) return null;

    const extAthlete = athlete as unknown as Record<string, unknown>;

    const profile: PhysiologicalProfile = {
      vo2max: athlete.vo2max,
      vlamax: athlete.vlamax,
      leanMassKg: athlete.lean_mass_kg,
      weightKg: athlete.weight_kg,
      cpWatts: athlete.cp_watts,
      maxHr: athlete.max_hr,
      restingHr: athlete.resting_hr,
      hrvBaseline: extAthlete.hrv_baseline as number | undefined,
      bodyFatPct: extAthlete.body_fat_pct as number | undefined,
      jumpHeightCm: extAthlete.jump_height_cm as number | undefined,
    };

    const tau = individualizedTau(profile);

    const sessionPoints = sessions.map(s => {
      let impulse = s.impulse > 0 ? s.impulse : 0;

      if (impulse === 0) {
        if (s.session_type === 'beach_volleyball') {
          const bvRaw = (s.raw_data as Record<string, unknown>)?.beachVolleyball as Record<string, unknown> | undefined;
          if (bvRaw) {
            const result = calculateBeachVolleyballImpulse(
              {
                jumpCount: (bvRaw.jumpCount as number) ?? 60,
                jumpHeightCm: bvRaw.jumpHeightCm as number | undefined,
                sprintCount: (bvRaw.sprintCount as number) ?? 20,
                avgSprintDistanceM: bvRaw.avgSprintDistanceM as number | undefined,
                rallyDurationMin: (bvRaw.rallyDurationMin as number) ?? s.duration_min * 0.5,
                accelerationCount: bvRaw.accelerationCount as number | undefined,
                avgHr: s.avg_hr ?? undefined,
                rpe: s.rpe ?? undefined,
              },
              {
                maxHr: athlete.max_hr,
                restingHr: athlete.resting_hr,
                jumpHeightCmBaseline: (extAthlete.jump_height_cm as number | undefined) ?? 35,
              }
            );
            impulse = result.total;
          } else {
            impulse = sessionToImpulseInput(s, athlete);
          }
        } else {
          impulse = sessionToImpulseInput(s, athlete);
        }
      }

      const intentionMod = computeTrainingIntentionModifier(s.training_intention);
      impulse *= intentionMod;

      const envResult = applyEnvironmentalStress(impulse, {
        temperatureC: s.temperature_c ?? undefined,
        humidityPct: s.humidity_pct ?? undefined,
        altitudeM: s.altitude_m_env ?? undefined,
      });
      impulse = envResult.modifiedImpulse;

      return {
        date: s.session_date,
        impulse,
        sessionType: s.session_type,
        rawData: s.raw_data ?? undefined,
      };
    });

    return computeEngineOutput(sessionPoints, tau, profile, sessions, nutritionLogs);
  }, [athlete, sessions, nutritionLogs]);
}
