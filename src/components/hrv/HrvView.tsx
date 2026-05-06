import { useState } from 'react';
import { Plus, Heart, TrendingUp, TrendingDown, Minus, Trash2, AlertTriangle } from 'lucide-react';
import type { HrvLog, HrvLogInsert, Athlete } from '../../lib/database.types';
import { analyzeHrv } from '../../lib/engine/hrvAnalyzer';
import { useLanguage } from '../../contexts/LanguageContext';

interface HrvViewProps {
  hrvLogs: HrvLog[];
  athlete: Athlete;
  onAdd: (log: HrvLogInsert) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function HrvView({ hrvLogs, athlete, onAdd, onDelete }: HrvViewProps) {
  const { t } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [rmssd, setRmssd] = useState('');
  const [sdnn, setSdnn] = useState('');
  const [hrvScore, setHrvScore] = useState('');
  const [morningHr, setMorningHr] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analysis = analyzeHrv(hrvLogs.map(h => ({
    date: h.log_date,
    rmssd: h.rmssd,
    sdnn: h.sdnn,
    hrv_score: h.hrv_score,
    morning_hr: h.morning_hr,
  })));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onAdd({
        athlete_id: athlete.id,
        log_date: date,
        rmssd: rmssd ? parseFloat(rmssd) : undefined,
        sdnn: sdnn ? parseFloat(sdnn) : undefined,
        hrv_score: hrvScore ? parseFloat(hrvScore) : undefined,
        morning_hr: morningHr ? parseInt(morningHr) : undefined,
        notes: notes || undefined,
      });
      setShowForm(false);
      setRmssd(''); setSdnn(''); setHrvScore(''); setMorningHr(''); setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save HRV log');
    } finally {
      setLoading(false);
    }
  };

  const trendIcon = analysis.trend7d === 'rising'
    ? <TrendingUp className="w-4 h-4 text-green-500" />
    : analysis.trend7d === 'falling'
    ? <TrendingDown className="w-4 h-4 text-red-400" />
    : <Minus className="w-4 h-4 text-slate-400" />;

  const trendColor = analysis.trend7d === 'rising' ? '#22c55e' : analysis.trend7d === 'falling' ? '#ef4444' : '#94a3b8';

  const recentLogs = [...hrvLogs].sort((a, b) => b.log_date.localeCompare(a.log_date)).slice(0, 30);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-white">{t('hrvTracking')}</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">{t('hrvSubtitle')}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-[#070b12] font-semibold text-[12px] px-3 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('logHrv')}
        </button>
      </div>

      {analysis.trend7d !== 'insufficient_data' && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4">
            <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">{t('baseline28d')}</p>
            <p className="text-[22px] font-bold font-mono text-cyan-400">{analysis.baseline}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">{t('rmssdMs')}</p>
          </div>

          <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4">
            <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">{t('current')}</p>
            <p className="text-[22px] font-bold font-mono" style={{ color: analysis.isSuppressed ? '#ef4444' : '#22c55e' }}>
              {analysis.current ?? '—'}
            </p>
            <p className="text-[10px] text-slate-600 mt-0.5">{t('rmssdMs')}</p>
          </div>

          <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4">
            <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">{t('sevenDTrend')}</p>
            <div className="flex items-center gap-1.5 mt-1">
              {trendIcon}
              <p className="text-[15px] font-semibold capitalize" style={{ color: trendColor }}>
                {analysis.trend7d}
              </p>
            </div>
            <p className="text-[10px] text-slate-600 mt-0.5">{t('weekOverWeek')}</p>
          </div>

          <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4">
            <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">{t('suppression')}</p>
            <p className="text-[22px] font-bold font-mono" style={{ color: analysis.isSuppressed ? '#ef4444' : '#22c55e' }}>
              {(analysis.suppressionPct * 100).toFixed(0)}%
            </p>
            <p className="text-[10px] text-slate-600 mt-0.5">{t('belowBaseline')}</p>
          </div>
        </div>
      )}

      {analysis.recommendation && (
        <div className={`border rounded-xl px-4 py-3 flex items-start gap-3 ${
          analysis.isSuppressed ? 'bg-red-500/5 border-red-500/20' : 'bg-green-500/5 border-green-500/20'
        }`}>
          <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${analysis.isSuppressed ? 'text-red-400' : 'text-green-400'}`} />
          <p className="text-[12px] text-slate-300">{analysis.recommendation}</p>
        </div>
      )}

      {analysis.trend7d !== 'insufficient_data' && (
        <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[12px] font-semibold text-white">{t('modelImpact')}</h3>
            <span className="text-[10px] text-slate-500 font-mono">{t('hrvFatigueAdjust')}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/20 text-center">
              <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">{t('fatigueFactor')}</p>
              <p className="text-[18px] font-bold font-mono" style={{ color: analysis.fatigueFactor < 0.9 ? '#ef4444' : '#22c55e' }}>
                {(analysis.fatigueFactor * 100).toFixed(0)}%
              </p>
              <p className="text-[9px] text-slate-600 mt-0.5">{t('ofNormalFatigueDecay')}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/20 text-center">
              <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">{t('formAdjustment')}</p>
              <p className="text-[18px] font-bold font-mono" style={{ color: analysis.formAdjustment < 0.9 ? '#ef4444' : '#22c55e' }}>
                ×{analysis.formAdjustment.toFixed(2)}
              </p>
              <p className="text-[9px] text-slate-600 mt-0.5">{t('appliedToForm')}</p>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-[#0d1420] border border-slate-800/60 rounded-xl p-4">
          <h3 className="text-[13px] font-semibold text-white mb-4">{t('logMorningHrv')}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1.5">{t('date')}</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-cyan-500/50" />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1.5">{t('morningHr')}</label>
                <input type="number" value={morningHr} onChange={e => setMorningHr(e.target.value)} placeholder="52"
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: t('rmssd'), value: rmssd, set: setRmssd, placeholder: '65', hint: t('primaryHrvMetric') },
                { label: t('sdnn'), value: sdnn, set: setSdnn, placeholder: '45', hint: t('globalHrv') },
                { label: t('hrvScore'), value: hrvScore, set: setHrvScore, placeholder: '75', hint: t('appScore') },
              ].map(({ label, value, set, placeholder, hint }) => (
                <div key={label}>
                  <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">{label}</label>
                  <input type="number" value={value} onChange={e => set(e.target.value)} placeholder={placeholder} step="0.1"
                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50" />
                  <p className="text-[9px] text-slate-600 mt-0.5">{hint}</p>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1.5">{t('notes')}</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('feltWellRested')}
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50" />
            </div>
            {error && <p className="text-[12px] text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={loading}
                className="flex-1 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-[#070b12] font-semibold text-[13px] py-2 rounded-lg transition-colors">
                {loading ? t('saving') : t('saveHrvLog')}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg border border-slate-700/50 text-slate-400 hover:text-white text-[13px] transition-colors">
                {t('cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-2">
        {recentLogs.length === 0 && !showForm && (
          <div className="text-center py-12 bg-[#0d1420] border border-slate-800/60 rounded-xl">
            <Heart className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-slate-500 text-[13px]">{t('noHrvData')}</p>
            <p className="text-slate-600 text-[12px] mt-1">{t('noHrvDataDesc')}</p>
          </div>
        )}

        {recentLogs.map(log => (
          <div key={log.id} className="bg-[#0d1420] border border-slate-800/60 rounded-xl px-4 py-3 flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center flex-shrink-0">
              <Heart className="w-4 h-4 text-pink-400" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-medium text-white">
                {new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {log.rmssd && `RMSSD: ${log.rmssd}ms`}
                {log.sdnn && ` · SDNN: ${log.sdnn}ms`}
                {log.morning_hr && ` · Morning HR: ${log.morning_hr}bpm`}
              </p>
            </div>
            {log.rmssd && (
              <div className="text-right">
                <p className="text-[10px] text-slate-600 font-mono uppercase">{t('rmssd')}</p>
                <p className="text-[16px] font-bold font-mono text-cyan-400">{log.rmssd}</p>
              </div>
            )}
            {log.hrv_score && (
              <div className="text-right">
                <p className="text-[10px] text-slate-600 font-mono uppercase">{t('score')}</p>
                <p className="text-[16px] font-bold font-mono" style={{ color: log.hrv_score > 70 ? '#22c55e' : log.hrv_score > 50 ? '#f59e0b' : '#ef4444' }}>
                  {log.hrv_score}
                </p>
              </div>
            )}
            {log.notes && (
              <p className="text-[11px] text-slate-500 max-w-[120px] truncate">{log.notes}</p>
            )}
            <button onClick={() => onDelete(log.id)} className="text-slate-600 hover:text-red-400 transition-colors ml-2">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
