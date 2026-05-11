import { BarChart2, FlaskConical, Utensils, User, LayoutDashboard, TrendingUp, Heart, Menu, X, Settings } from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

type View = 'dashboard' | 'sessions' | 'lab' | 'nutrition' | 'profile' | 'analytics' | 'hrv' | 'settings';

interface SidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useLanguage();

  const navItems: { view: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { view: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { view: 'sessions', label: t('sessions'), icon: BarChart2 },
    { view: 'analytics', label: t('analytics'), icon: TrendingUp },
    { view: 'hrv', label: t('hrv'), icon: Heart },
    { view: 'lab', label: t('labTests'), icon: FlaskConical },
    { view: 'nutrition', label: t('nutrition'), icon: Utensils },
    { view: 'profile', label: t('athleteProfile'), icon: User },
    { view: 'settings', label: 'Configuracion', icon: Settings },
  ];

  const handleNav = (view: View) => {
    onViewChange(view);
    setMobileOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 shadow-sm"
      >
        <Menu className="w-4 h-4 text-gray-600" />
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 bg-white flex flex-col h-full shadow-xl">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
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
                      active ? 'bg-[#fdda36] text-[#514163] font-body font-bold' : 'text-[#4b5563] hover:bg-gray-100 font-body font-medium'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-[13px] whitespace-nowrap">{label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      <aside className="hidden lg:flex fixed left-0 top-16 bottom-0 w-20 hover:w-64 bg-white border-r border-[#e5e7eb] flex-col transition-all duration-300 ease-in-out group z-40">
        {/* Logo strip */}
        <div className="flex items-center justify-center h-12 border-b border-[#e5e7eb] overflow-hidden px-3 shrink-0">
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
                    ? 'bg-[#fdda36] text-[#514163] font-body font-bold'
                    : 'text-[#4b5563] hover:bg-gray-100 font-body font-medium'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-[13px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                  {label}
                </span>
                {active && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: '#514163' }} />
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-3 pb-4">
          <div className="rounded-xl bg-gray-50 border border-[#e5e7eb] p-3">
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
      </aside>
    </>
  );
}
