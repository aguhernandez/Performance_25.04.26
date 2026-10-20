import { useLanguage } from '../../contexts/LanguageContext';

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
      <button
        onClick={() => setLang('es')}
        className={`px-2.5 py-1 rounded-md text-[11px] font-body font-semibold transition-colors ${
          lang === 'es'
            ? 'bg-white dark:bg-gray-900 text-[#2A1F4A] shadow-sm'
            : 'text-gray-400 hover:text-gray-600 dark:text-gray-300'
        }`}
      >
        ES
      </button>
      <button
        onClick={() => setLang('en')}
        className={`px-2.5 py-1 rounded-md text-[11px] font-body font-semibold transition-colors ${
          lang === 'en'
            ? 'bg-white dark:bg-gray-900 text-[#2A1F4A] shadow-sm'
            : 'text-gray-400 hover:text-gray-600 dark:text-gray-300'
        }`}
      >
        EN
      </button>
    </div>
  );
}
