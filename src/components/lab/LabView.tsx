import { useState } from 'react';
import { FlaskConical, Plus, ChevronDown } from 'lucide-react';
import type { LabTest, LabTestInsert, Athlete } from '../../lib/database.types';
import { useLanguage } from '../../contexts/LanguageContext';

interface LabViewProps {
  labTests: LabTest[];
  athlete: Athlete;
  onAdd: (test: LabTestInsert) => Promise<void>;
}

const TEST_TYPES = ['ramp', 'incremental', 'step', 'time_trial', 'blood_lactate', 'metabolic', 'other'];

export function LabView({ labTests, athlete, onAdd }: LabViewProps) {
  const { t } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    test_date: new Date().toISOString().split('T')[0],
    test_type: 'ramp',
    vo2max: '',
    vlamax: '',
    cp_watts: '',
    ftp_watts: '',
    lt1_watts: '',
    lt2_watts: '',
    lt1_hr: '',
    lt2_hr: '',
    fat_max_watts: '',
    notes: '',
  });

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onAdd({
        athlete_id: athlete.id,
        test_date: form.test_date,
        test_type: form.test_type,
        vo2max: form.vo2max ? parseFloat(form.vo2max) : undefined,
        vlamax: form.vlamax ? parseFloat(form.vlamax) : undefined,
        cp_watts: form.cp_watts ? parseInt(form.cp_watts) : undefined,
        ftp_watts: form.ftp_watts ? parseInt(form.ftp_watts) : undefined,
        lactate_threshold_1_watts: form.lt1_watts ? parseInt(form.lt1_watts) : undefined,
        lactate_threshold_2_watts: form.lt2_watts ? parseInt(form.lt2_watts) : undefined,
        lactate_threshold_1_hr: form.lt1_hr ? parseInt(form.lt1_hr) : undefined,
        lactate_threshold_2_hr: form.lt2_hr ? parseInt(form.lt2_hr) : undefined,
        fat_max_watts: form.fat_max_watts ? parseInt(form.fat_max_watts) : undefined,
        notes: form.notes,
      });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save lab test');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-white">{t('laboratoryTesting')}</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">{t('labSubtitle')}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-[#070b12] font-semibold text-[12px] px-3 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('addLabTest')}
        </button>
      </div>

      {showForm && (
        <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4">
          <h3 className="text-[13px] font-semibold text-white mb-4">{t('newLabTest')}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1.5">{t('date')}</label>
                <input type="date" value={form.test_date} onChange={e => set('test_date', e.target.value)} required
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-cyan-500/50" />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1.5">{t('testType')}</label>
                <div className="relative">
                  <select value={form.test_type} onChange={e => set('test_type', e.target.value)}
                    className="w-full appearance-none bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-cyan-500/50 pr-8">
                    {TEST_TYPES.map(tt => <option key={tt} value={tt}>{tt.replace('_', ' ')}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {[
                { field: 'vo2max', label: 'VO2max (ml/kg/min)', placeholder: athlete.vo2max.toString() },
                { field: 'vlamax', label: 'vLamax (mmol/l/s)', placeholder: athlete.vlamax.toString() },
                { field: 'cp_watts', label: 'CP (W)', placeholder: athlete.cp_watts.toString() },
                { field: 'ftp_watts', label: 'FTP (W)', placeholder: athlete.ftp_watts.toString() },
                { field: 'lt1_watts', label: 'LT1 (W)', placeholder: '' },
                { field: 'lt2_watts', label: 'LT2 (W)', placeholder: '' },
                { field: 'lt1_hr', label: 'LT1 HR (bpm)', placeholder: '' },
                { field: 'lt2_hr', label: 'LT2 HR (bpm)', placeholder: '' },
                { field: 'fat_max_watts', label: 'FatMax (W)', placeholder: '' },
              ].map(({ field, label, placeholder }) => (
                <div key={field}>
                  <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1.5">{label}</label>
                  <input type="number" value={form[field as keyof typeof form]} onChange={e => set(field, e.target.value)}
                    placeholder={placeholder} step="0.01"
                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[12px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50" />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1.5">{t('notes')}</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none"
                placeholder={t('testConditions')} />
            </div>

            {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"><p className="text-[12px] text-red-400">{error}</p></div>}

            <div className="flex gap-2">
              <button type="submit" disabled={loading}
                className="flex-1 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-[#070b12] font-semibold text-[13px] py-2.5 rounded-lg transition-colors">
                {loading ? t('saving') : t('saveLabTest')}
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
        {labTests.map(test => (
          <div key={test.id} className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-cyan-400" />
                  <p className="text-[13px] font-semibold text-white capitalize">{test.test_type.replace('_', ' ')} Protocol</p>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {new Date(test.test_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: 'VO2max', value: test.vo2max, unit: 'ml/kg/min', color: '#0ea5e9' },
                { label: 'vLamax', value: test.vlamax, unit: 'mmol/l/s', color: '#f97316' },
                { label: 'CP', value: test.cp_watts, unit: 'W', color: '#22c55e' },
                { label: 'FTP', value: test.ftp_watts, unit: 'W', color: '#f59e0b' },
                { label: 'FatMax', value: test.fat_max_watts, unit: 'W', color: '#94a3b8' },
                { label: 'LT1', value: test.lactate_threshold_1_watts, unit: 'W', color: '#22d3ee' },
                { label: 'LT2', value: test.lactate_threshold_2_watts, unit: 'W', color: '#f97316' },
                { label: 'LT1 HR', value: test.lactate_threshold_1_hr, unit: 'bpm', color: '#22c55e' },
                { label: 'LT2 HR', value: test.lactate_threshold_2_hr, unit: 'bpm', color: '#ef4444' },
              ].filter(item => item.value !== null && item.value !== undefined).map(({ label, value, unit, color }) => (
                <div key={label} className="bg-slate-800/30 rounded-lg p-2 text-center border border-slate-700/20">
                  <p className="text-[9px] font-mono text-slate-500 uppercase mb-0.5">{label}</p>
                  <p className="text-[14px] font-bold font-mono" style={{ color }}>{Number(value).toFixed(label === 'vLamax' ? 3 : 0)}</p>
                  <p className="text-[9px] text-slate-600">{unit}</p>
                </div>
              ))}
            </div>
            {test.notes && <p className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-800/40">{test.notes}</p>}
          </div>
        ))}

        {labTests.length === 0 && !showForm && (
          <div className="text-center py-12 bg-[#0d1420] border border-slate-800/60 rounded-xl">
            <FlaskConical className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-slate-500 text-[13px]">{t('noLabTests')}</p>
            <p className="text-slate-600 text-[12px] mt-1">{t('noLabTestsDesc')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
