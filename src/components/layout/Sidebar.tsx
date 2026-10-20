import { BarChart2, FlaskConical, Utensils, User, Home, TrendingUp, Heart, Menu, X, Settings, Users, Timer, Globe, Moon, Sun, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

type View = 'dashboard' | 'sessions' | 'lab' | 'nutrition' | 'profile' | 'analytics' | 'hrv' | 'settings' | 'simulator';

interface SidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
  role?: 'athlete' | 'coach' | 'admin';
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
  onSignOut: () => void;
}

export function Sidebar({ activeView, onViewChange, role = 'athlete', theme, onThemeToggle, onSignOut }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t, lang, setLang } = useLanguage();

  const athleteNavItems: { view: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { view: 'dashboard', label: t('home'), icon: Home },
    { view: 'sessions', label: t('sessions'), icon: BarChart2 },
    { view: 'analytics', label: t('analytics'), icon: TrendingUp },
    { view: 'simulator', label: 'Simulador', icon: Timer },
    { view: 'hrv', label: t('hrv'), icon: Heart },
    { view: 'lab', label: t('labTests'), icon: FlaskConical },
    { view: 'nutrition', label: t('nutrition'), icon: Utensils },
    { view: 'profile', label: t('athleteProfile'), icon: User },
    { view: 'settings', label: 'Configuracion', icon: Settings },
  ];

  const coachNavItems: { view: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { view: 'dashboard', label: t('myAthletes'), icon: Users },
    { view: 'settings', label: 'Configuracion', icon: Settings },
  ];

  const navItems = role === 'coach' ? coachNavItems : athleteNavItems;

  const handleNav = (view: View) => {
    onViewChange(view);
    setMobileOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir navegación"
        className="lg:hidden fixed top-3 left-3 z-50 w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm"
      >
        <Menu className="w-4 h-4 text-gray-600" />
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 flex flex-col h-full shadow-xl pt-[env(safe-area-inset-top)]">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-800">
              <img src="/asciende_the_athletes_support_platform.png" alt="Asciende" className="h-7 w-auto" />
              <button onClick={() => setMobileOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
              {navItems.map(({ view, label, icon: Icon }) => {
                const active = activeView === view;
                return (
                  <button
                    key={view}
                    onClick={() => handleNav(view)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-150 ${
                      active ? 'bg-[#F7C843] text-[#2A1F4A] font-body font-bold' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-body font-medium'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-[13px] whitespace-nowrap">{label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-gray-200 dark:border-gray-800 px-3 py-3 space-y-1">
              <div className="flex items-center gap-2">
                <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')} className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 font-body text-[13px]">
                  <Globe className="w-5 h-5" /><span>{lang === 'es' ? 'Español' : 'English'}</span>
                </button>
                <button onClick={onThemeToggle} aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
                  {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              </div>
              <button onClick={onSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 font-body text-[13px]">
                <LogOut className="w-5 h-5" /><span>{t('signOut')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-20 hover:w-64 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700 flex-col transition-all duration-300 ease-in-out group z-40">
        {/* Logo strip */}
        <div className="flex items-center justify-center h-16 border-b border-gray-200 dark:border-gray-700 overflow-hidden px-3 shrink-0">
          <img src="/Asciendefavicon.png" alt="Asciende" className="h-7 w-7 object-contain group-hover:hidden" />
          <img src="/asciende_the_athletes_support_platform.png" alt="Asciende" className="hidden group-hover:block h-7 w-auto object-contain" />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ view, label, icon: Icon }) => {
            const active = activeView === view;
            return (
              <button
                key={view}
                onClick={() => onViewChange(view)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-150 ${
                  active
                    ? 'bg-[#F7C843] text-[#2A1F4A] font-body font-bold'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-body font-medium'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-[13px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                  {label}
                </span>
                {active && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: '#2A1F4A' }} />
                )}
              </button>
            );
          })}
        </nav>

        {role !== 'coach' && (
          <div className="px-3 pb-4">
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3">
              <p className="font-body text-[9px] text-gray-400 uppercase tracking-widest mb-1 opacity-0 group-hover:opacity-100 transition-opacity">Model</p>
              <p className="font-body text-[11px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">{t('impulseResponse')}</p>
              <div className="mt-2 space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex justify-between">
                  <span className="font-body text-[10px] text-gray-500">τ₁ {t('fitness')}</span>
                  <span className="font-body text-[10px] text-gray-400">30–50d</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-body text-[10px] text-gray-500">τ₂ {t('fatigue')}</span>
                  <span className="font-body text-[10px] text-gray-400">5–10d</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-3 space-y-1 shrink-0">
          <div className="flex items-center justify-center group-hover:justify-start gap-1">
            <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')} title={lang === 'es' ? 'Cambiar idioma a English' : 'Change language to Español'} className="flex items-center justify-center gap-2 w-9 h-9 group-hover:w-auto group-hover:flex-1 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
              <Globe className="w-4 h-4 shrink-0" /><span className="hidden group-hover:inline font-body text-[11px] font-semibold">{lang.toUpperCase()}</span>
            </button>
            <button onClick={onThemeToggle} title={theme === 'dark' ? 'Light theme' : 'Dark theme'} aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} className="flex items-center justify-center gap-2 w-9 h-9 group-hover:flex-1 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
              {theme === 'dark' ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}<span className="hidden group-hover:inline font-body text-[11px] font-medium">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
          <button onClick={onSignOut} title={t('signOut')} className="w-full h-9 flex items-center justify-center group-hover:justify-start gap-3 group-hover:px-3 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <LogOut className="w-4 h-4 shrink-0" /><span className="hidden group-hover:inline font-body text-[11px] font-medium whitespace-nowrap">{t('signOut')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
