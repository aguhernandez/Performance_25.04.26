import { useState } from 'react';
import { User, Award, Shield, Activity, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../contexts/AuthContext';

interface LocalDevModeProps {
  onProfileSelected: (profile: Profile) => void;
}

const roles = [
  {
    key: 'athlete' as const,
    label: 'Atleta',
    description: 'Ver sesiones y rastrear rendimiento',
    icon: User,
    color: 'text-sky-600',
    bg: 'bg-sky-50',
    hoverBg: 'group-hover:bg-sky-100',
  },
  {
    key: 'coach' as const,
    label: 'Coach',
    description: 'Crear y gestionar sesiones de entrenamiento',
    icon: Award,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    hoverBg: 'group-hover:bg-emerald-100',
  },
  {
    key: 'admin' as const,
    label: 'Admin',
    description: 'Acceso completo de gestión del sistema',
    icon: Shield,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    hoverBg: 'group-hover:bg-amber-100',
  },
];

export default function LocalDevMode({ onProfileSelected }: LocalDevModeProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectProfile = async (role: 'athlete' | 'coach' | 'admin') => {
    setLoading(role);
    setError(null);

    try {
      const devEmail = `dev-${role}@local.dev`;
      const devName = role === 'athlete' ? 'Atleta de Prueba' : role === 'coach' ? 'Coach de Prueba' : 'Admin de Prueba';

      const { data: existing, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', devEmail)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        onProfileSelected(existing as Profile);
        return;
      }

      const newId = crypto.randomUUID();
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: newId,
          email: devEmail,
          full_name: devName,
          role,
          hub_user_id: `dev-${role}-${newId}`,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      onProfileSelected(newProfile as Profile);
    } catch (err) {
      console.error('Error creating dev profile:', err);
      setError(err instanceof Error ? err.message : 'No se pudo crear el perfil de desarrollo');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: '#fdda36' }} />
        <div className="absolute top-1/4 -left-20 w-96 h-96 rounded-full blur-3xl opacity-20" style={{ backgroundColor: '#fdda36' }} />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full blur-3xl opacity-10" style={{ backgroundColor: '#514163' }} />
      </div>

      <div className="w-full max-w-xl relative">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-5">
            <div className="relative">
              <Activity className="w-7 h-7" style={{ color: '#514163' }} />
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: '#fdda36' }} />
            </div>
            <span className="font-heading text-2xl font-bold" style={{ color: '#514163' }}>ASC</span>
            <span className="font-heading text-2xl font-bold" style={{ color: '#fdda36' }}>Impulse</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold mb-4 border" style={{ backgroundColor: '#fffbeb', color: '#92400e', borderColor: '#fcd34d' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            MODO DESARROLLO LOCAL
          </div>

          <h1 className="font-heading text-2xl font-bold text-gray-900 mb-2">Selecciona un Perfil</h1>
          <p className="font-body text-[13px] text-gray-500">
            Elige el tipo de perfil para continuar sin conectar al HUB
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl border flex items-start gap-2.5 text-[12px]" style={{ backgroundColor: '#fef2f2', borderColor: '#fca5a5', color: '#b91c1c' }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {roles.map(({ key, label, description, icon: Icon, color, bg, hoverBg }) => (
            <button
              key={key}
              onClick={() => selectProfile(key)}
              disabled={loading !== null}
              className={`group relative flex flex-col items-center p-5 rounded-2xl border-2 transition-all duration-200 text-left
                ${loading === key ? 'border-gray-300 bg-gray-50 opacity-70' : 'border-gray-100 bg-white hover:border-gray-300 hover:shadow-md'}
                disabled:cursor-not-allowed`}
            >
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 transition-colors ${bg} ${hoverBg}`}>
                {loading === key ? (
                  <div className="w-5 h-5 border-2 border-gray-300 rounded-full animate-spin" style={{ borderTopColor: '#514163' }} />
                ) : (
                  <Icon className={`w-6 h-6 ${color}`} />
                )}
              </div>
              <span className="font-heading text-[13px] font-semibold text-gray-900 mb-1">{label}</span>
              <span className="font-body text-[11px] text-gray-500 text-center leading-relaxed">{description}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 p-4 rounded-xl border border-amber-200 bg-amber-50">
          <p className="font-body text-[11px] text-amber-800 leading-relaxed">
            <strong>Nota:</strong> Este modo crea perfiles de prueba en la base de datos local y no requiere conexion al HUB. En produccion, la autenticacion sera manejada por <strong>hub.asciende.pro</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
