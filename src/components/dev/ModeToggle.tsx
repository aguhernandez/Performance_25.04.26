import { useAuth } from '../../contexts/AuthContext';
import { Code2, Globe } from 'lucide-react';

export default function ModeToggle() {
  const { isDevMode, toggleDevMode } = useAuth();

  const handleToggle = () => {
    const newMode = !isDevMode;
    const msg = newMode
      ? 'Cambiar a Modo Desarrollo? Podras seleccionar perfiles de prueba sin autenticacion del HUB. La pagina se recargara.'
      : 'Cambiar a Modo Produccion? Necesitaras autenticarte via hub.asciende.pro. La pagina se recargara.';
    if (confirm(msg)) toggleDevMode(newMode);
  };

  return (
    <button
      onClick={handleToggle}
      title={isDevMode ? 'Modo Desarrollo activo - Click para cambiar a Produccion' : 'Modo Produccion activo - Click para cambiar a Desarrollo'}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
        isDevMode
          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
      }`}
    >
      {isDevMode ? <Code2 className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
      {isDevMode ? 'Dev' : 'Prod'}
    </button>
  );
}
