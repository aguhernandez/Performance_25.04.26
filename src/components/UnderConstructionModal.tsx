import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import type { Lang } from '../lib/i18n/translations';

export function UnderConstructionModal() {
  const { language, setLanguage, t } = useLanguage();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    document.body.style.overflow = isVisible ? 'hidden' : 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <img src="/asciende_the_athletes_support_platform.png" alt="Asciende" className="h-8 w-auto" />
        </div>

        {/* Title and Message */}
        <div className="text-center space-y-3">
          <h1 className="font-heading font-black text-2xl" style={{ color: '#514163' }}>
            {t('underConstructionTitle')}
          </h1>
          <p className="font-body text-sm text-gray-600 leading-relaxed">
            {t('underConstructionMessage')}
          </p>
        </div>

        {/* Language Selector */}
        <div className="flex gap-3 items-center justify-center border-t border-gray-200 pt-6">
          <span className="font-body text-xs text-gray-500 uppercase tracking-widest">Language:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setLanguage('en')}
              className={`px-4 py-2 rounded-lg font-body font-semibold text-xs transition-all ${
                language === 'en'
                  ? 'bg-[#fdda36] text-[#514163]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              English
            </button>
            <button
              onClick={() => setLanguage('es')}
              className={`px-4 py-2 rounded-lg font-body font-semibold text-xs transition-all ${
                language === 'es'
                  ? 'bg-[#fdda36] text-[#514163]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Español
            </button>
          </div>
        </div>

        {/* Button */}
        <button
          onClick={() => setIsVisible(false)}
          className="w-full py-3 rounded-lg font-body font-semibold text-sm transition-all"
          style={{
            backgroundColor: '#fdda36',
            color: '#514163',
            hover: { backgroundColor: '#f0cc2e' }
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0cc2e')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fdda36')}
        >
          {t('underConstructionButton')}
        </button>
      </div>
    </div>
  );
}
