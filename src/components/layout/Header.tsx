import { Zap } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export function Header() {
  const { t } = useLanguage();

  return (
    <>
    <header className="flex lg:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-900/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-700 h-14 items-center justify-between pl-14 pr-4">
      <div className="flex min-w-0 items-center gap-2">
        <img src="/asciende_the_athletes_support_platform.png" alt="Asciende" className="h-6 w-auto max-w-[120px]" />
        <span className="font-body text-[11px] text-gray-400 truncate">{t('performanceVector')}</span>
      </div>
    </header>
    <header className="hidden lg:flex fixed top-0 left-20 right-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 h-16 items-center justify-between px-8">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <img src="/asciende_the_athletes_support_platform.png" alt="Asciende" className="h-7 w-auto" />
          <span className="font-body font-light text-[13px] ml-1 text-gray-400">{t('performanceVector')}</span>
        </div>
        <div className="h-5 w-px bg-gray-200 dark:bg-gray-700 mx-1" />
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <Zap className="w-3.5 h-3.5" style={{ color: '#F7C843' }} />
          <span className="font-body text-[10px] text-gray-600 dark:text-gray-300 uppercase tracking-widest">{t('vectorEngine')}</span>
        </div>
      </div>

      <div className="font-body text-[12px] text-gray-500 dark:text-gray-400">{t('brandTagline')}</div>

    </header>
    </>
  );
}
