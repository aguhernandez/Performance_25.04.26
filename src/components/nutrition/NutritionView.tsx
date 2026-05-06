import { useState } from 'react';
import { Plus, Utensils } from 'lucide-react';
import type { NutritionLog, NutritionLogInsert, Athlete } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../contexts/LanguageContext';

interface NutritionViewProps {
  logs: NutritionLog[];
  athlete: Athlete;
  onAdd: () => void;
}

export function NutritionView({ logs, athlete, onAdd }: NutritionViewProps) {
  const { t } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    log_date: new Date().toISOString().split('T')[0],
    calories: '',
    protein_g: '',
    carbs_g: '',
    fat_g: '',
    hydration_ml: '',
    sleep_hours: '8',
    sleep_quality: '3',
    notes: '',
  });

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.from('nutrition_logs').upsert({
        athlete_id: athlete.id,
        log_date: form.log_date,
        calories: form.calories ? parseInt(form.calories) : 0,
        protein_g: form.protein_g ? parseFloat(form.protein_g) : 0,
        carbs_g: form.carbs_g ? parseFloat(form.carbs_g) : 0,
        fat_g: form.fat_g ? parseFloat(form.fat_g) : 0,
        hydration_ml: form.hydration_ml ? parseInt(form.hydration_ml) : 0,
        sleep_hours: parseFloat(form.sleep_hours) || 8,
        sleep_quality: parseInt(form.sleep_quality) || 3,
        notes: form.notes,
      }, { onConflict: 'athlete_id,log_date' });

      if (error) throw error;
      setShowForm(false);
      onAdd();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const proteinTarget = athlete.weight_kg * 1.8;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-white">{t('nutritionRecovery')}</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">{t('nutritionSubtitle')}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-[#070b12] font-semibold text-[12px] px-3 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('logDay')}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('proteinTarget'), value: `${proteinTarget.toFixed(0)}g/day`, desc: `1.8g × ${athlete.weight_kg}kg`, color: '#22c55e' },
          { label: t('avgSleep14d'), value: logs.slice(0, 14).length > 0 ? `${(logs.slice(0, 14).reduce((s, l) => s + l.sleep_hours, 0) / logs.slice(0, 14).length).toFixed(1)}h` : '—', desc: t('recent14d'), color: '#0ea5e9' },
          { label: t('avgCalories14d'), value: logs.slice(0, 14).length > 0 ? `${Math.round(logs.slice(0, 14).reduce((s, l) => s + l.calories, 0) / logs.slice(0, 14).length)}` : '—', desc: t('kcalDay'), color: '#f59e0b' },
        ].map(({ label, value, desc, color }) => (
          <div key={label} className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4">
            <p className="text-[10px] font-mono uppercase text-slate-500 mb-1">{label}</p>
            <p className="text-[20px] font-bold font-mono" style={{ color }}>{value}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4">
          <h3 className="text-[13px] font-semibold text-white mb-4">{t('logDay')}</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1.5">{t('date')}</label>
              <input type="date" value={form.log_date} onChange={e => set('log_date', e.target.value)} required
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-cyan-500/50" />
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { field: 'calories', label: t('calories'), placeholder: '2500' },
                { field: 'protein_g', label: t('protein'), placeholder: proteinTarget.toFixed(0) },
                { field: 'carbs_g', label: t('carbs'), placeholder: '300' },
                { field: 'fat_g', label: t('fat'), placeholder: '80' },
                { field: 'hydration_ml', label: t('hydration'), placeholder: '2500' },
                { field: 'sleep_hours', label: t('sleep'), placeholder: '8' },
              ].map(({ field, label, placeholder }) => (
                <div key={field}>
                  <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1.5">{label}</label>
                  <input type="number" value={form[field as keyof typeof form]} onChange={e => set(field, e.target.value)}
                    placeholder={placeholder} step="0.1" min="0"
                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[12px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50" />
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1.5">{t('sleepQuality')}</label>
                <input type="number" value={form.sleep_quality} onChange={e => set('sleep_quality', e.target.value)}
                  min="1" max="5" step="1"
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[12px] text-white focus:outline-none focus:border-cyan-500/50" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1.5">{t('notes')}</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none"
                placeholder={t('feelNotes')} />
            </div>
            {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"><p className="text-[12px] text-red-400">{error}</p></div>}
            <div className="flex gap-2">
              <button type="submit" disabled={loading}
                className="flex-1 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-[#070b12] font-semibold text-[13px] py-2.5 rounded-lg transition-colors">
                {loading ? t('saving') : t('saveLog')}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-lg border border-slate-700/50 text-slate-400 hover:text-white text-[13px] transition-colors">
                {t('cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-2">
        {logs.map(log => {
          const proteinRatio = proteinTarget > 0 ? (log.protein_g / proteinTarget) * 100 : 0;
          return (
            <div key={log.id} className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-medium text-white">
                  {new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < (log.sleep_quality ?? 0) ? 'bg-cyan-400' : 'bg-slate-700'}`} />
                  ))}
                  <span className="text-[10px] text-slate-500 ml-1">{log.sleep_hours}h sleep</span>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2 text-[11px]">
                <div><p className="text-slate-500 font-mono">Cals</p><p className="text-white font-medium">{log.calories}</p></div>
                <div>
                  <p className="text-slate-500 font-mono">Protein</p>
                  <p className={`font-medium ${proteinRatio >= 100 ? 'text-green-400' : proteinRatio >= 75 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {log.protein_g.toFixed(0)}g
                  </p>
                </div>
                <div><p className="text-slate-500 font-mono">Carbs</p><p className="text-white font-medium">{log.carbs_g.toFixed(0)}g</p></div>
                <div><p className="text-slate-500 font-mono">Fat</p><p className="text-white font-medium">{log.fat_g.toFixed(0)}g</p></div>
                <div><p className="text-slate-500 font-mono">H₂O</p><p className="text-white font-medium">{log.hydration_ml}ml</p></div>
              </div>
              {log.notes && <p className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-800/40">{log.notes}</p>}
            </div>
          );
        })}

        {logs.length === 0 && !showForm && (
          <div className="text-center py-12 bg-[#0d1420] border border-slate-800/60 rounded-xl">
            <Utensils className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-slate-500 text-[13px]">{t('noNutritionLogs')}</p>
            <p className="text-slate-600 text-[12px] mt-1">{t('noNutritionLogsDesc')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
