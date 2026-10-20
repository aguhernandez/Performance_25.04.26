import { Zap, LogOut } from 'lucide-react';
import type { Athlete } from '../../lib/database.types';
import { useLanguage } from '../../contexts/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useAuth } from '../../contexts/AuthContext';

interface HeaderProps {
  athlete: Athlete | null;
  onSignOut: () => void;
}

export function Header({ athlete, onSignOut }: HeaderProps) {
  const { t } = useLanguage();
  const { user, profile } = useAuth();

  const displayName = user?.name || user?.email?.split('@')[0] || athlete?.name || '';
  const role = profile?.role ?? (user?.role === 'trainer' ? 'coach' : user?.role);
  const roleLabel =
    role === 'admin' ? t('admin') :
    role === 'coach' ? t('coach') :
    t('athlete');
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <>
    <header className="flex lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-700 h-14 items-center justify-between pl-14 pr-4">
      <div className="flex min-w-0 items-center gap-2">
        <img src="/asciende_the_athletes_support_platform.png" alt="Asciende" className="h-6 w-auto max-w-[120px]" />
        <span className="font-body text-[11px] text-gray-400 truncate">{t('performanceVector')}</span>
      </div>
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        {displayName && <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ backgroundColor: '#F7C843', color: '#2A1F4A' }}>{avatarLetter}</span>}
      </div>
    </header>
    <header className="hidden lg:flex fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 h-16 items-center justify-between px-8">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <img src="/asciende_the_athletes_support_platform.png" alt="Asciende" className="h-7 w-auto" />
          <span className="font-body font-light text-[13px] ml-1 text-gray-400">{t('performanceVector')}</span>
        </div>
        <div className="h-5 w-px bg-gray-200 mx-1" />
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-gray-200 bg-gray-50">
          <Zap className="w-3.5 h-3.5" style={{ color: '#F7C843' }} />
          <span className="font-body text-[10px] text-gray-600 uppercase tracking-widest">{t('vectorEngine')}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <LanguageSwitcher />
        {displayName && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-body text-[11px] text-gray-500 leading-none">{roleLabel}</p>
              <p className="font-body text-[13px] font-semibold text-gray-900 leading-none mt-0.5">{displayName}</p>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold" style={{ backgroundColor: '#F7C843', color: '#2A1F4A' }}>
              {avatarLetter}
            </div>
          </div>
        )}
        <button
          onClick={onSignOut}
          className="flex items-center gap-1.5 text-[12px] text-red-500 hover:text-red-600 hover:bg-red-50 px-3 py-1 rounded-lg transition-colors font-body"
        >
          <LogOut className="w-3.5 h-3.5" />
          {t('signOut')}
        </button>
      </div>
    </header>
    </>
  );
}
