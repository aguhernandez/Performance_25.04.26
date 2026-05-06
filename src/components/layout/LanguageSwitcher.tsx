import { useLanguage } from '../../contexts/LanguageContext';

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
      <button
        onClick={() => setLang('es')}
        className={`px-2.5 py-1 rounded-md text-[11px] font-body font-semibold transition-colors ${
          lang === 'es'
            ? 'bg-white text-[#514163] shadow-sm'
            : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        ES
      </button>
      <button
        onClick={() => setLang('en')}
        className={`px-2.5 py-1 rounded-md text-[11px] font-body font-semibold transition-colors ${
          lang === 'en'
            ? 'bg-white text-[#514163] shadow-sm'
            : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        EN
      </button>
    </div>
  );
}
