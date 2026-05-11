import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, ExternalLink, X, Zap } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';

interface LoginModalProps {
  onClose: () => void;
}

const HUB_REGISTER_URL = 'https://hub.asciende.pro/register';

export function LoginModal({ onClose }: LoginModalProps) {
  const { t, lang, setLang } = useLanguage();
  const { loginWithCredentials, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [visible, setVisible] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError(null);
    setSubmitting(true);

    const { error: authError } = await loginWithCredentials(email.trim(), password);

    if (authError) {
      setError(authError.includes('credentials') || authError.includes('Invalid') || authError.includes('401')
        ? t('loginErrorGeneric')
        : authError);
      setSubmitting(false);
    }
    // On success, AuthContext state update causes App.tsx to re-render away from landing — no close needed
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className={`relative w-full max-w-sm transition-all duration-200 ${visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
        style={{
          background: 'linear-gradient(145deg, #0f0f18 0%, #0a0a0f 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(253,218,54,0.06)',
        }}
      >
        {/* Glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px"
          style={{ background: 'linear-gradient(to right, transparent, rgba(253,218,54,0.4), transparent)' }} />

        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-0">
          <div className="flex flex-col gap-0.5">
            <img src="/asciende_the_athletes_support_platform.png" alt="Asciende" className="h-6 w-auto brightness-0 invert" />
            <span className="font-body text-[9px] text-gray-600 tracking-widest uppercase">Vector Engine</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <div className="flex items-center rounded-lg border border-white/8 overflow-hidden">
              {(['es', 'en'] as const).map(l => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`px-2 py-0.5 font-body text-[10px] uppercase tracking-wider transition-colors ${
                    lang === l ? 'bg-white/10 text-white font-semibold' : 'text-gray-600 hover:text-gray-400'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="px-6 pt-6 pb-2">
          <h2 className="font-heading font-bold text-white text-[20px] leading-tight">{t('loginModalTitle')}</h2>
          <p className="font-body text-[12px] text-gray-500 mt-1">{t('loginModalSubtitle')}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 pt-4 flex flex-col gap-4">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="font-body text-[11px] font-medium text-gray-400 uppercase tracking-wider">
              {t('loginEmail')}
            </label>
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('loginEmailPlaceholder')}
              required
              autoComplete="email"
              className="w-full px-4 py-3 rounded-xl font-body text-[13px] text-white placeholder-gray-600 outline-none transition-all focus:ring-1"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                // @ts-ignore
                '--tw-ring-color': 'rgba(253,218,54,0.3)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(253,218,54,0.3)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="font-body text-[11px] font-medium text-gray-400 uppercase tracking-wider">
              {t('loginPassword')}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('loginPasswordPlaceholder')}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 pr-10 rounded-xl font-body text-[13px] text-white placeholder-gray-600 outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(253,218,54,0.3)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
              <p className="font-body text-[12px] text-red-400 leading-relaxed">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !email.trim() || !password}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-body font-bold text-[13px] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            style={{ backgroundColor: '#fdda36', color: '#0a0a0f' }}
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-black/20 animate-spin" style={{ borderTopColor: '#0a0a0f' }} />
                {t('loginSubmitting')}
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                {t('loginSubmit')}
              </>
            )}
          </button>

          {/* Register link */}
          <p className="font-body text-[11px] text-gray-600 text-center">
            {t('loginNoAccount')}{' '}
            <a
              href={HUB_REGISTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 transition-colors hover:opacity-80"
              style={{ color: '#fdda36' }}
            >
              {t('loginRegister')}
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <span className="font-body text-[10px] text-gray-700 tracking-wider uppercase">{t('loginFallback')}</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          </div>

          {/* Hub redirect fallback */}
          <button
            type="button"
            onClick={login}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-body text-[12px] font-medium transition-all hover:bg-white/5 active:scale-[0.98]"
            style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
          >
            {t('loginGoHub')}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
