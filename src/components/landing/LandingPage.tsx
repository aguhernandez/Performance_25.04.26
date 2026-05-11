import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowRight, BarChart2, Brain, ChevronRight, FlaskConical, Globe, Layers, TrendingUp, Zap } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { LoginModal } from '../auth/LoginModal';
import type { Lang } from '../../lib/i18n/translations';

interface LandingPageProps {
  onLogin: () => void;
}

function AnimatedGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let animId: number;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = 'rgba(253,218,54,0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      const points = 120;
      const t = frame * 0.012;

      // Fitness curve (CTL)
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(253,218,54,0.7)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= points; i++) {
        const x = (i / points) * w;
        const base = Math.sin(i * 0.06 + t * 0.4) * 15;
        const trend = (i / points) * 35;
        const y = h * 0.45 - base - trend + Math.sin(t * 0.3 + i * 0.02) * 6;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Fatigue curve (ATL)
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(239,68,68,0.5)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i <= points; i++) {
        const x = (i / points) * w;
        const base = Math.sin(i * 0.12 + t * 0.7) * 22;
        const trend = (i / points) * 20;
        const y = h * 0.48 - base - trend + Math.cos(t * 0.5 + i * 0.03) * 8;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Form curve (TSB)
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(52,211,153,0.5)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i <= points; i++) {
        const x = (i / points) * w;
        const base = Math.sin(i * 0.08 + t * 0.5 + 1) * 18;
        const y = h * 0.55 - base + Math.sin(t * 0.2 + i * 0.04) * 5;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Floating dots (impulse events)
      for (let i = 0; i < 5; i++) {
        const prog = ((t * 0.3 + i * 0.2) % 1);
        const x = prog * w;
        const y = h * 0.45 - Math.sin(prog * Math.PI) * 30 - prog * 35 + Math.sin(t + i) * 6;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(253,218,54,0.8)';
        ctx.fill();
      }

      frame++;
      animId = requestAnimationFrame(draw);
    };

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}

function VectorField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let animId: number;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const t = frame * 0.008;
      const cols = Math.floor(w / 50);
      const rows = Math.floor(h / 50);

      for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= cols; c++) {
          const x = c * 50;
          const y = r * 50;
          const nx = x / w;
          const ny = y / h;
          const angle = Math.sin(nx * 3 + t) * Math.cos(ny * 2 + t * 0.7) * Math.PI;
          const len = 14 + Math.sin(nx * 4 + ny * 3 + t) * 6;

          const ex = x + Math.cos(angle) * len;
          const ey = y + Math.sin(angle) * len;

          const alpha = 0.12 + Math.abs(Math.sin(nx * 2 + ny + t * 0.5)) * 0.1;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(253,218,54,${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.moveTo(x, y);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(ex, ey, 1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(253,218,54,${alpha * 1.5})`;
          ctx.fill();
        }
      }

      frame++;
      animId = requestAnimationFrame(draw);
    };

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-40" />;
}

function MiniChart({ type }: { type: 'ctl' | 'atl' | 'tsb' | 'acwr' | 'pdc' | 'hrv' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let frame = 0;
    let animId: number;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const t = frame * 0.015;
      const pts = 50;
      ctx.beginPath();
      let color = 'rgba(253,218,54,0.8)';
      if (type === 'atl') color = 'rgba(239,68,68,0.7)';
      if (type === 'tsb') color = 'rgba(52,211,153,0.7)';
      if (type === 'acwr') color = 'rgba(251,146,60,0.7)';
      if (type === 'hrv') color = 'rgba(96,165,250,0.7)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      for (let i = 0; i <= pts; i++) {
        const x = (i / pts) * w;
        let y: number;
        if (type === 'ctl') y = h * 0.6 - Math.sin(i * 0.15 + t * 0.5) * h * 0.25 - (i / pts) * h * 0.2;
        else if (type === 'atl') y = h * 0.5 - Math.sin(i * 0.25 + t * 0.8) * h * 0.35;
        else if (type === 'tsb') y = h * 0.5 - Math.sin(i * 0.1 + t * 0.3 + 1) * h * 0.3;
        else if (type === 'acwr') y = h * 0.55 - Math.abs(Math.sin(i * 0.12 + t * 0.4)) * h * 0.35;
        else if (type === 'pdc') y = h * 0.8 - Math.pow(i / pts, 0.3) * h * 0.6;
        else y = h * 0.5 - Math.sin(i * 0.2 + t * 0.6) * h * 0.25 + Math.cos(i * 0.3 + t) * h * 0.1;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Fill under curve
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
      ctx.fillStyle = color.replace('0.8', '0.08').replace('0.7', '0.06');
      ctx.fill();

      frame++;
      animId = requestAnimationFrame(draw);
    };
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    draw();
    return () => cancelAnimationFrame(animId);
  }, [type]);
  return <canvas ref={canvasRef} className="w-full h-full" />;
}

const MODULES = [
  { key: 'landingMod1' as const, icon: BarChart2, color: '#fdda36', bg: 'rgba(253,218,54,0.1)', chart: 'ctl' as const },
  { key: 'landingMod2' as const, icon: Activity, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', chart: 'atl' as const },
  { key: 'landingMod3' as const, icon: TrendingUp, color: '#34d399', bg: 'rgba(52,211,153,0.1)', chart: 'tsb' as const },
  { key: 'landingMod4' as const, icon: Brain, color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', chart: 'hrv' as const },
  { key: 'landingMod5' as const, icon: Zap, color: '#f97316', bg: 'rgba(249,115,22,0.1)', chart: 'acwr' as const },
  { key: 'landingMod6' as const, icon: Layers, color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', chart: 'pdc' as const },
];

const CARDS = [
  { titleKey: 'landingCard1Title' as const, descKey: 'landingCard1Desc' as const, chart: 'ctl' as const, badge: 'Bannister Model', color: '#fdda36' },
  { titleKey: 'landingCard2Title' as const, descKey: 'landingCard2Desc' as const, chart: 'atl' as const, badge: 'ATL Dynamics', color: '#ef4444' },
  { titleKey: 'landingCard3Title' as const, descKey: 'landingCard3Desc' as const, chart: 'tsb' as const, badge: 'CTL Curves', color: '#34d399' },
  { titleKey: 'landingCard4Title' as const, descKey: 'landingCard4Desc' as const, chart: 'hrv' as const, badge: 'TSB Form', color: '#60a5fa' },
  { titleKey: 'landingCard5Title' as const, descKey: 'landingCard5Desc' as const, chart: 'pdc' as const, badge: 'Forecast', color: '#f97316' },
  { titleKey: 'landingCard6Title' as const, descKey: 'landingCard6Desc' as const, chart: 'acwr' as const, badge: 'ACWR Risk', color: '#a78bfa' },
];

const WORKFLOWS = [
  { titleKey: 'landingWf1Title' as const, descKey: 'landingWf1Desc' as const, icon: Brain },
  { titleKey: 'landingWf2Title' as const, descKey: 'landingWf2Desc' as const, icon: Zap },
  { titleKey: 'landingWf3Title' as const, descKey: 'landingWf3Desc' as const, icon: TrendingUp },
  { titleKey: 'landingWf4Title' as const, descKey: 'landingWf4Desc' as const, icon: BarChart2 },
];

const ECOSYSTEM = [
  { titleKey: 'landingEco1' as const, descKey: 'landingEco1Desc' as const, icon: FlaskConical, angle: -90 },
  { titleKey: 'landingEco2' as const, descKey: 'landingEco2Desc' as const, icon: Activity, angle: -30 },
  { titleKey: 'landingEco3' as const, descKey: 'landingEco3Desc' as const, icon: Layers, angle: 30 },
  { titleKey: 'landingEco4' as const, descKey: 'landingEco4Desc' as const, icon: Globe, angle: 90 },
  { titleKey: 'landingEco5' as const, descKey: 'landingEco5Desc' as const, icon: Brain, angle: 150 },
];

export function LandingPage({ onLogin }: LandingPageProps) {
  const { t, lang, setLang } = useLanguage();
  const [heroVisible, setHeroVisible] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(id);
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const openLogin = () => setShowLogin(true);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ background: 'linear-gradient(to bottom, rgba(10,10,15,0.95) 0%, rgba(10,10,15,0.0) 100%)' }}>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Activity className="w-5 h-5" style={{ color: '#514163' }} />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#fdda36' }} />
          </div>
          <span className="font-heading text-[15px] font-bold text-white tracking-tight">ASC</span>
          <span className="font-heading text-[15px] font-bold tracking-tight" style={{ color: '#fdda36' }}>Impulse</span>
          <span className="hidden sm:inline font-body text-[10px] text-gray-600 ml-2 tracking-widest uppercase">Vector Engine</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Language switcher */}
          <div className="flex items-center gap-1 rounded-lg border border-white/10 overflow-hidden">
            {(['es', 'en'] as Lang[]).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-2.5 py-1 font-body text-[11px] uppercase tracking-wider transition-colors ${
                  lang === l ? 'bg-[#fdda36] text-[#0a0a0f] font-semibold' : 'text-gray-400 hover:text-white'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <button
            onClick={() => scrollToSection('explore')}
            className="hidden sm:flex items-center gap-1 font-body text-[12px] text-gray-400 hover:text-white transition-colors px-3 py-1.5"
          >
            {t('landingExplore')}
          </button>
          <button
            onClick={openLogin}
            className="flex items-center gap-1.5 font-body text-[12px] font-semibold px-4 py-1.5 rounded-lg transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: '#fdda36', color: '#0a0a0f' }}
          >
            {t('landingLogin')}
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 overflow-hidden">
        <VectorField />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] rounded-full blur-[120px]" style={{ background: 'radial-gradient(circle, rgba(253,218,54,0.04) 0%, transparent 70%)' }} />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full blur-[100px]" style={{ background: 'radial-gradient(circle, rgba(81,65,99,0.08) 0%, transparent 70%)' }} />
        </div>
        <div className={`relative z-10 max-w-4xl transition-all duration-1000 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-8 font-body text-[11px] tracking-widest uppercase"
            style={{ borderColor: 'rgba(253,218,54,0.2)', color: '#fdda36', background: 'rgba(253,218,54,0.05)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#fdda36' }} />
            Performance Intelligence · Mathematical Modeling
          </div>
          <h1 className="font-heading font-black leading-[1.05] mb-6" style={{ fontSize: 'clamp(2.4rem, 6vw, 5rem)' }}>
            <span className="block text-white">{t('landingHero1')}</span>
            <span className="block" style={{ color: '#fdda36' }}>{t('landingHero2')}</span>
            <span className="block text-white/70">{t('landingHero3')}</span>
          </h1>
          <p className="font-body text-[15px] text-gray-400 max-w-2xl mx-auto leading-relaxed mb-10">
            {t('landingSubHero')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => scrollToSection('explore')}
              className="flex items-center gap-2 font-body font-semibold text-[13px] px-7 py-3 rounded-xl transition-all hover:opacity-90 active:scale-95"
              style={{ backgroundColor: '#fdda36', color: '#0a0a0f' }}
            >
              {t('landingExplore')}
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={openLogin}
              className="flex items-center gap-2 font-body font-semibold text-[13px] px-7 py-3 rounded-xl border transition-all hover:bg-white/5 active:scale-95"
              style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}
            >
              {t('landingLogin')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Animated graph strip at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-32 opacity-30">
          <AnimatedGraph />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-24" style={{ background: 'linear-gradient(to top, #0a0a0f, transparent)' }} />
      </section>

      {/* Performance Model Preview */}
      <section id="explore" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-4 font-body text-[10px] tracking-widest uppercase"
              style={{ borderColor: 'rgba(253,218,54,0.15)', color: 'rgba(253,218,54,0.7)', background: 'rgba(253,218,54,0.04)' }}>
              Analytical Cards
            </div>
            <h2 className="font-heading font-bold text-white mb-3" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.5rem)' }}>{t('landingPreviewTitle')}</h2>
            <p className="font-body text-gray-500 max-w-xl mx-auto text-[14px]">{t('landingPreviewSubtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {CARDS.map((card) => (
              <div
                key={card.titleKey}
                className="rounded-2xl border overflow-hidden group hover:border-opacity-60 transition-all duration-300 hover:-translate-y-1"
                style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
              >
                <div className="h-28 relative overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)' }}>
                  <MiniChart type={card.chart} />
                  <div className="absolute bottom-2 right-2">
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${card.color}18`, color: card.color, border: `1px solid ${card.color}30` }}>
                      {card.badge}
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-heading font-bold text-white text-[14px] mb-2">{t(card.titleKey)}</h3>
                  <p className="font-body text-gray-500 text-[12px] leading-relaxed">{t(card.descKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modeling Modules */}
      <section className="py-20 px-6" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-4 font-body text-[10px] tracking-widest uppercase"
              style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
              Modules
            </div>
            <h2 className="font-heading font-bold text-white mb-3" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)' }}>{t('landingModulesTitle')}</h2>
            <p className="font-body text-gray-500 max-w-xl mx-auto text-[14px]">{t('landingModulesSubtitle')}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {MODULES.map((mod) => {
              const Icon = mod.icon;
              return (
                <div
                  key={mod.key}
                  className="rounded-xl p-5 border flex flex-col gap-3 cursor-default group hover:-translate-y-0.5 transition-all duration-200"
                  style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center transition-all group-hover:scale-105" style={{ backgroundColor: mod.bg }}>
                    <Icon className="w-4 h-4" style={{ color: mod.color }} />
                  </div>
                  <div className="h-12">
                    <MiniChart type={mod.chart} />
                  </div>
                  <p className="font-body text-[12px] font-semibold text-white leading-snug">{t(mod.key)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-6 font-body text-[10px] tracking-widest uppercase"
                style={{ borderColor: 'rgba(253,218,54,0.15)', color: 'rgba(253,218,54,0.6)', background: 'rgba(253,218,54,0.04)' }}>
                Workflow
              </div>
              <h2 className="font-heading font-bold text-white mb-4" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)' }}>{t('landingWorkflowTitle')}</h2>
              <p className="font-body text-gray-500 text-[14px] leading-relaxed mb-8">{t('landingWorkflowSubtitle')}</p>
              <button
                onClick={openLogin}
                className="inline-flex items-center gap-2 font-body font-semibold text-[13px] px-6 py-2.5 rounded-xl transition-all hover:opacity-90 active:scale-95"
                style={{ backgroundColor: '#fdda36', color: '#0a0a0f' }}
              >
                {t('landingLogin')}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {WORKFLOWS.map((wf) => {
                const Icon = wf.icon;
                return (
                  <div
                    key={wf.titleKey}
                    className="rounded-xl p-5 border"
                    style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: 'rgba(253,218,54,0.08)' }}>
                      <Icon className="w-4 h-4" style={{ color: '#fdda36' }} />
                    </div>
                    <h3 className="font-heading font-bold text-white text-[13px] mb-1.5">{t(wf.titleKey)}</h3>
                    <p className="font-body text-gray-500 text-[12px] leading-relaxed">{t(wf.descKey)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Ecosystem */}
      <section className="py-24 px-6" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-4 font-body text-[10px] tracking-widest uppercase"
              style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
              Ecosystem
            </div>
            <h2 className="font-heading font-bold text-white mb-3" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)' }}>{t('landingEcosystemTitle')}</h2>
            <p className="font-body text-gray-500 max-w-xl mx-auto text-[14px]">{t('landingEcosystemSubtitle')}</p>
          </div>

          {/* System map */}
          <div className="relative flex items-center justify-center" style={{ height: '380px' }}>
            {/* Center node */}
            <div className="absolute z-10 flex flex-col items-center justify-center w-28 h-28 rounded-full border-2 text-center"
              style={{ background: 'linear-gradient(135deg, rgba(253,218,54,0.15), rgba(253,218,54,0.05))', borderColor: 'rgba(253,218,54,0.4)' }}>
              <Zap className="w-6 h-6 mb-1" style={{ color: '#fdda36' }} />
              <span className="font-heading font-black text-[13px]" style={{ color: '#fdda36' }}>{t('landingEcoCentral')}</span>
              <span className="font-body text-[9px] text-gray-500 leading-tight mt-0.5">{t('landingEcoCentralDesc')}</span>
            </div>

            {/* Satellite nodes */}
            {ECOSYSTEM.map((eco, i) => {
              const rad = 155;
              const angleRad = (eco.angle * Math.PI) / 180;
              const x = Math.cos(angleRad) * rad;
              const y = Math.sin(angleRad) * rad;
              const Icon = eco.icon;
              return (
                <div key={eco.titleKey}>
                  {/* Connection line */}
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ left: 0, top: 0 }}
                  >
                    <line
                      x1="50%"
                      y1="50%"
                      x2={`calc(50% + ${x}px)`}
                      y2={`calc(50% + ${y}px)`}
                      stroke="rgba(253,218,54,0.12)"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                  </svg>
                  <div
                    className="absolute z-10 flex flex-col items-center text-center group"
                    style={{
                      transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                      left: '50%',
                      top: '50%',
                      width: '90px',
                    }}
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-2 border transition-all group-hover:scale-105"
                      style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
                      <Icon className="w-5 h-5 text-gray-400" />
                    </div>
                    <span className="font-body text-[11px] font-semibold text-white">{t(eco.titleKey)}</span>
                    <span className="font-body text-[9px] text-gray-600 leading-tight mt-0.5">{t(eco.descKey)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full blur-[120px]"
            style={{ background: 'radial-gradient(ellipse, rgba(253,218,54,0.04) 0%, transparent 70%)' }} />
        </div>
        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-8 border"
            style={{ background: 'rgba(253,218,54,0.08)', borderColor: 'rgba(253,218,54,0.2)' }}>
            <Zap className="w-7 h-7" style={{ color: '#fdda36' }} />
          </div>
          <h2 className="font-heading font-black text-white mb-4" style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)' }}>
            {t('landingHero2')}
          </h2>
          <p className="font-body text-gray-500 text-[14px] mb-10 max-w-lg mx-auto leading-relaxed">
            {t('landingSubHero')}
          </p>
          <button
            onClick={openLogin}
            className="inline-flex items-center gap-2 font-body font-bold text-[14px] px-10 py-4 rounded-xl transition-all hover:opacity-90 active:scale-95 shadow-lg"
            style={{ backgroundColor: '#fdda36', color: '#0a0a0f', boxShadow: '0 0 40px rgba(253,218,54,0.2)' }}
          >
            {t('landingLogin')}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-6" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: '#514163' }} />
            <span className="font-body text-[11px] text-gray-600">{t('landingFooterTagline')}</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-white/5 overflow-hidden">
            {(['es', 'en'] as Lang[]).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-2.5 py-1 font-body text-[10px] uppercase tracking-wider transition-colors ${
                  lang === l ? 'bg-white/10 text-white font-semibold' : 'text-gray-600 hover:text-gray-400'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
