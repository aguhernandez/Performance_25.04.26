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
          <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">{t('laboratoryTesting')}</h2>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">{t('labSubtitle')}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-[#F7C843] hover:bg-[#E7B92D] text-[#2A1F4A] font-semibold text-[12px] px-3 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('addLabTest')}
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-4">{t('newLabTest')}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-gray-500 dark:text-gray-400 mb-1.5">{t('date')}</label>
                <input type="date" value={form.test_date} onChange={e => set('test_date', e.target.value)} required
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-[13px] text-gray-900 dark:text-white focus:outline-none focus:border-[#F7C843]" />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-gray-500 dark:text-gray-400 mb-1.5">{t('testType')}</label>
                <div className="relative">
                  <select value={form.test_type} onChange={e => set('test_type', e.target.value)}
                    className="w-full appearance-none bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-[13px] text-gray-900 dark:text-white focus:outline-none focus:border-[#F7C843] pr-8">
                    {TEST_TYPES.map(tt => <option key={tt} value={tt}>{tt.replace('_', ' ')}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 dark:text-gray-400 pointer-events-none" />
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
                  <label className="block text-[10px] font-mono uppercase text-gray-500 dark:text-gray-400 mb-1.5">{label}</label>
                  <input type="number" value={form[field as keyof typeof form]} onChange={e => set(field, e.target.value)}
                    placeholder={placeholder} step="0.01"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-[12px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#F7C843]" />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-gray-500 dark:text-gray-400 mb-1.5">{t('notes')}</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-[13px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#F7C843] resize-none"
                placeholder={t('testConditions')} />
            </div>

            {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"><p className="text-[12px] text-red-400">{error}</p></div>}

            <div className="flex gap-2">
              <button type="submit" disabled={loading}
                className="flex-1 bg-[#F7C843] hover:bg-[#E7B92D] disabled:opacity-50 text-[#2A1F4A] font-semibold text-[13px] py-2.5 rounded-lg transition-colors">
                {loading ? t('saving') : t('saveLabTest')}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:text-white text-[13px] transition-colors">
                {t('cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-2">
        {labTests.map(test => (
          <div key={test.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-[#2A1F4A] dark:text-[#B8A9E5]" />
                  <p className="text-[13px] font-semibold text-gray-900 dark:text-white capitalize">{test.test_type.replace('_', ' ')} Protocol</p>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {new Date(test.test_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: 'VO2max', value: test.vo2max, unit: 'ml/kg/min', color: '#2A1F4A' },
                { label: 'vLamax', value: test.vlamax, unit: 'mmol/l/s', color: '#8A6900' },
                { label: 'CP', value: test.cp_watts, unit: 'W', color: '#2A1F4A' },
                { label: 'FTP', value: test.ftp_watts, unit: 'W', color: '#8A6900' },
                { label: 'FatMax', value: test.fat_max_watts, unit: 'W', color: '#94a3b8' },
                { label: 'LT1', value: test.lactate_threshold_1_watts, unit: 'W', color: '#2A1F4A' },
                { label: 'LT2', value: test.lactate_threshold_2_watts, unit: 'W', color: '#8A6900' },
                { label: 'LT1 HR', value: test.lactate_threshold_1_hr, unit: 'bpm', color: '#2A1F4A' },
                { label: 'LT2 HR', value: test.lactate_threshold_2_hr, unit: 'bpm', color: '#ef4444' },
              ].filter(item => item.value !== null && item.value !== undefined).map(({ label, value, unit, color }) => (
                <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center border border-gray-200 dark:border-gray-700">
                  <p className="text-[9px] font-mono text-gray-500 dark:text-gray-400 uppercase mb-0.5">{label}</p>
                  <p className="text-[14px] font-bold font-mono" style={{ color }}>{Number(value).toFixed(label === 'vLamax' ? 3 : 0)}</p>
                  <p className="text-[9px] text-gray-500 dark:text-gray-400">{unit}</p>
                </div>
              ))}
            </div>
            {test.notes && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">{test.notes}</p>}
          </div>
        ))}

        {labTests.length === 0 && !showForm && (
          <div className="text-center py-12 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
            <FlaskConical className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-400 text-[13px]">{t('noLabTests')}</p>
            <p className="text-gray-500 dark:text-gray-400 text-[12px] mt-1">{t('noLabTestsDesc')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
