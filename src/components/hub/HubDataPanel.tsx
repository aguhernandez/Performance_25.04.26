import { useState } from 'react';
import { RefreshCw, Link2, Link2Off, AlertCircle, ChevronDown, ChevronUp, Activity, Heart, Zap, Scale, Utensils, Moon, Droplets, TrendingUp, Calendar } from 'lucide-react';
import type { HubSnapshot } from '../../hooks/useHubData';

interface HubDataPanelProps {
  hubConnected: boolean;
  snapshot: HubSnapshot;
  loading: boolean;
  error: string | null;
  athleteEmail: string | null;
  onRefresh: () => void;
}

function StatPill({ label, value, unit }: { label: string; value: string | number | null; unit?: string }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-gray-50 border border-[#e5e7eb] min-w-[80px]">
      <span className="font-heading text-[15px] font-bold text-gray-900">
        {typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 1) : value}
        {unit && <span className="font-body text-[10px] text-gray-400 ml-0.5">{unit}</span>}
      </span>
      <span className="font-body text-[10px] text-gray-500 text-center leading-tight mt-0.5">{label}</span>
    </div>
  );
}

function Section({ title, icon, children, defaultOpen = true }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#e5e7eb] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/80 hover:bg-gray-100/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{icon}</span>
          <span className="font-body text-[13px] font-semibold text-gray-800">{title}</span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

function WellnessBar({ label, value, max = 10, color }: { label: string; value: number | null; max?: number; color: string }) {
  if (value === null) return null;
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <span className="font-body text-[11px] text-gray-500 w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="font-body text-[11px] text-gray-700 w-6 text-right">{value}</span>
    </div>
  );
}

export function HubDataPanel({ hubConnected, snapshot, loading, error, athleteEmail, onRefresh }: HubDataPanelProps) {
  if (!hubConnected) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-[#e5e7eb]">
        <Link2Off className="w-4 h-4 text-gray-300 flex-shrink-0" />
        <p className="font-body text-[12px] text-gray-400">
          Hub no conectado. Configura el token en Configuracion para ver datos del Hub.
        </p>
      </div>
    );
  }

  if (!athleteEmail) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-[#e5e7eb]">
        <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <p className="font-body text-[12px] text-gray-500">
          Configura el email del atleta en su perfil para cargar datos del Hub.
        </p>
      </div>
    );
  }

  const hasData = Object.values(snapshot).some(v => v !== null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="font-body text-[12px] text-gray-500">Datos del Hub</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e5e7eb] text-[11px] font-body font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Cargando...' : hasData ? 'Actualizar' : 'Cargar datos'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-[12px] font-body text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {!hasData && !loading && !error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
          <Link2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <p className="font-body text-[12px] text-blue-700">
            Presiona "Cargar datos" para sincronizar informacion del atleta desde el Hub.
          </p>
        </div>
      )}

      {snapshot.athleteProfile && (
        <Section title="Perfil del Atleta" icon={<Activity className="w-3.5 h-3.5" />}>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center font-heading font-bold text-[14px] text-white flex-shrink-0" style={{ backgroundColor: '#514163' }}>
                {snapshot.athleteProfile.athlete.full_name.charAt(0)}
              </div>
              <div>
                <p className="font-body text-[13px] font-semibold text-gray-800">{snapshot.athleteProfile.athlete.full_name}</p>
                <p className="font-body text-[11px] text-gray-400">{snapshot.athleteProfile.athlete.sport} · {snapshot.athleteProfile.athlete.email}</p>
              </div>
            </div>
            {snapshot.athleteProfile.body_composition && (
              <div className="flex flex-wrap gap-2">
                <StatPill label="Masa Grasa" value={snapshot.athleteProfile.body_composition.fat_mass_kg} unit="kg" />
                <StatPill label="Masa Magra" value={snapshot.athleteProfile.body_composition.lean_mass_kg} unit="kg" />
                <StatPill label="% Grasa" value={snapshot.athleteProfile.body_composition.fat_percent} unit="%" />
              </div>
            )}
            {snapshot.athleteProfile.nutrition_targets && (
              <div className="flex flex-wrap gap-2">
                <StatPill label="Target kcal" value={snapshot.athleteProfile.nutrition_targets.target_kcal} unit="kcal" />
                <StatPill label="Proteina" value={snapshot.athleteProfile.nutrition_targets.target_protein_g} unit="g" />
                <StatPill label="Carbos" value={snapshot.athleteProfile.nutrition_targets.target_carbs_g} unit="g" />
                <StatPill label="Grasas" value={snapshot.athleteProfile.nutrition_targets.target_fat_g} unit="g" />
              </div>
            )}
          </div>
        </Section>
      )}

      {snapshot.biologicalPassport?.active_passport && (
        <Section title="Pasaporte Biologico" icon={<Zap className="w-3.5 h-3.5" />}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <StatPill label="VO2max" value={snapshot.biologicalPassport.active_passport.vo2max} unit="ml/kg/min" />
              <StatPill label="FTP" value={snapshot.biologicalPassport.active_passport.ftp_watts} unit="W" />
              <StatPill label="LT1" value={snapshot.biologicalPassport.active_passport.lt1_power} unit="W" />
              <StatPill label="LT2" value={snapshot.biologicalPassport.active_passport.lt2_power} unit="W" />
              <StatPill label="FC LT1" value={snapshot.biologicalPassport.active_passport.lt1_hr} unit="bpm" />
              <StatPill label="FC LT2" value={snapshot.biologicalPassport.active_passport.lt2_hr} unit="bpm" />
            </div>
            <div className="flex items-center gap-3 mt-1">
              {snapshot.biologicalPassport.active_passport.athlete_level && (
                <span className="font-body text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                  {snapshot.biologicalPassport.active_passport.athlete_level}
                </span>
              )}
              {snapshot.biologicalPassport.active_passport.training_age_years !== null && (
                <span className="font-body text-[11px] text-gray-500">
                  {snapshot.biologicalPassport.active_passport.training_age_years} anos de entrenamiento
                </span>
              )}
              {snapshot.biologicalPassport.active_passport.measurement_date && (
                <span className="font-body text-[11px] text-gray-400">
                  · {snapshot.biologicalPassport.active_passport.measurement_date}
                </span>
              )}
            </div>
          </div>
        </Section>
      )}

      {snapshot.wellness && (
        <Section title="Wellness (ultimo check-in)" icon={<Heart className="w-3.5 h-3.5" />}>
          {snapshot.wellness.latest ? (
            <div className="space-y-2">
              <p className="font-body text-[11px] text-gray-400 mb-3">{snapshot.wellness.latest.checkin_date}</p>
              <WellnessBar label="Fatiga" value={snapshot.wellness.latest.fatigue} color="#ef4444" />
              <WellnessBar label="Calidad sueno" value={snapshot.wellness.latest.sleep_quality} color="#3b82f6" />
              <WellnessBar label="Motivacion" value={snapshot.wellness.latest.motivation} color="#22c55e" />
              <WellnessBar label="Estres" value={snapshot.wellness.latest.stress} color="#f97316" />
              <WellnessBar label="Dolor muscular" value={snapshot.wellness.latest.muscle_soreness} color="#a855f7" />
              <WellnessBar label="Forma general" value={snapshot.wellness.latest.general_wellbeing} color="#14b8a6" />
              {snapshot.wellness.latest.hrv !== null && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#e5e7eb]">
                  <Heart className="w-3 h-3 text-red-400" />
                  <span className="font-body text-[11px] text-gray-600">HRV: <strong>{snapshot.wellness.latest.hrv}</strong></span>
                  {snapshot.wellness.latest.resting_hr !== null && (
                    <span className="font-body text-[11px] text-gray-600 ml-2">FC reposo: <strong>{snapshot.wellness.latest.resting_hr} bpm</strong></span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="font-body text-[12px] text-gray-400">Sin check-ins recientes</p>
          )}
        </Section>
      )}

      {snapshot.anthropometry?.measurements?.length ? (
        <Section title="Composicion Corporal" icon={<Scale className="w-3.5 h-3.5" />} defaultOpen={false}>
          <div className="space-y-3">
            {snapshot.anthropometry.measurements.slice(0, 3).map((m, i) => (
              <div key={i} className="border-b border-[#e5e7eb] last:border-0 pb-2 last:pb-0">
                <p className="font-body text-[11px] text-gray-400 mb-2">{m.measured_at} {m.method ? `· ${m.method}` : ''}</p>
                <div className="flex flex-wrap gap-2">
                  <StatPill label="Peso" value={m.weight_kg} unit="kg" />
                  {m.fat_pct !== null && <StatPill label="% Grasa" value={m.fat_pct} unit="%" />}
                  {m.lean_mass_kg !== null && <StatPill label="Magra" value={m.lean_mass_kg} unit="kg" />}
                  {m.muscle_mass_kg !== null && <StatPill label="Muscular" value={m.muscle_mass_kg} unit="kg" />}
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {snapshot.habits?.habits?.length ? (
        <Section title="Habitos" icon={<TrendingUp className="w-3.5 h-3.5" />} defaultOpen={false}>
          <div className="space-y-2">
            {snapshot.habits.averages && (
              <div className="flex gap-3 mb-3">
                {snapshot.habits.averages.sleep_hours !== null && (
                  <div className="flex items-center gap-1.5">
                    <Moon className="w-3 h-3 text-blue-400" />
                    <span className="font-body text-[12px] text-gray-600">{snapshot.habits.averages.sleep_hours?.toFixed(1)}h sueno</span>
                  </div>
                )}
                {snapshot.habits.averages.hydration_ml !== null && (
                  <div className="flex items-center gap-1.5">
                    <Droplets className="w-3 h-3 text-cyan-400" />
                    <span className="font-body text-[12px] text-gray-600">{Math.round((snapshot.habits.averages.hydration_ml ?? 0) / 1000 * 10) / 10}L hidratacion</span>
                  </div>
                )}
              </div>
            )}
            {snapshot.habits.habits.filter(h => h.is_active).slice(0, 5).map((h, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="font-body text-[12px] text-gray-700 truncate flex-1">{h.habit_name}</span>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {h.current_streak_days !== null && h.current_streak_days > 0 && (
                    <span className="font-body text-[10px] text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
                      {h.current_streak_days}d
                    </span>
                  )}
                  {h.compliance_pct !== null && (
                    <span className="font-body text-[11px] font-semibold" style={{ color: h.compliance_pct >= 80 ? '#22c55e' : h.compliance_pct >= 50 ? '#f97316' : '#ef4444' }}>
                      {Math.round(h.compliance_pct)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {snapshot.nutritionData?.plans?.length ? (
        <Section title="Nutricion (ultimos 7 dias)" icon={<Utensils className="w-3.5 h-3.5" />} defaultOpen={false}>
          <div className="space-y-1.5">
            {snapshot.nutritionData.plans.slice(-7).reverse().map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  p.fuel_day_type === 'green' ? 'bg-green-500' :
                  p.fuel_day_type === 'yellow' ? 'bg-amber-400' :
                  p.fuel_day_type === 'red' ? 'bg-red-400' : 'bg-gray-300'
                }`} />
                <span className="font-body text-[11px] text-gray-500 w-20 flex-shrink-0">{p.plan_date}</span>
                <span className="font-body text-[11px] text-gray-700 flex-1 truncate">{p.plan_name || '—'}</span>
                {p.target_kcal !== null && (
                  <span className="font-body text-[11px] text-gray-500 flex-shrink-0">{p.target_kcal} kcal</span>
                )}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {snapshot.trainingSchedule?.weekly_loads?.length ? (
        <Section title="Carga semanal (Hub)" icon={<Calendar className="w-3.5 h-3.5" />} defaultOpen={false}>
          <div className="space-y-2">
            {snapshot.trainingSchedule.weekly_loads.slice(-4).reverse().map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="font-body text-[11px] text-gray-400 w-20 flex-shrink-0">{w.week_start}</span>
                <div className="flex-1">
                  <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-gray-100">
                    <div className="bg-green-400 h-full" style={{ width: `${w.intensity_distribution?.green ?? 0}%` }} />
                    <div className="bg-amber-400 h-full" style={{ width: `${w.intensity_distribution?.yellow ?? 0}%` }} />
                    <div className="bg-red-400 h-full" style={{ width: `${w.intensity_distribution?.red ?? 0}%` }} />
                  </div>
                </div>
                <span className="font-body text-[11px] text-gray-600 w-16 text-right flex-shrink-0">{w.total_tss} TSS</span>
                {w.adherence_pct !== null && (
                  <span className="font-body text-[11px] flex-shrink-0" style={{ color: w.adherence_pct >= 80 ? '#22c55e' : '#f97316' }}>
                    {Math.round(w.adherence_pct)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
