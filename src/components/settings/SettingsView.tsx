import { useState, useEffect } from 'react';
import { Settings, Link2, Link2Off, Key, Trash2, Save, Eye, EyeOff, CheckCircle, AlertCircle, Loader, User, Shield, Bell, Globe, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { testHubToken } from '../../lib/hub/hubApiService';
import type { HubConnectionStatus } from '../../lib/hub/hubApiService';
import { recalculateHistory } from '../../lib/engine/loadPersistence';
import type { Athlete, Session } from '../../lib/database.types';

interface ProfileSettings {
  hub_planner_token: string | null;
  hub_token_label: string | null;
  hub_token_set_at: string | null;
  hub_connection_active: boolean;
}

export function SettingsView() {
  const { user, profile } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [settings, setSettings] = useState<ProfileSettings>({
    hub_planner_token: null,
    hub_token_label: null,
    hub_token_set_at: null,
    hub_connection_active: false,
  });

  const [tokenInput, setTokenInput] = useState('');
  const [tokenLabelInput, setTokenLabelInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<HubConnectionStatus | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'connection' | 'account' | 'notifications'>('connection');
  const [recalcState, setRecalcState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [recalcMessage, setRecalcMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, [profile?.id, user?.id]);

  const loadSettings = async () => {
    const profileId = profile?.id || user?.id;
    if (!profileId) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('hub_planner_token, hub_token_label, hub_token_set_at, hub_connection_active')
      .eq('id', profileId)
      .maybeSingle();

    if (!error && data) {
      setSettings(data as ProfileSettings);
    }
  };

  const handleTestConnection = async () => {
    const token = tokenInput || settings.hub_planner_token;
    if (!token) return;
    setTesting(true);
    setConnectionStatus(null);
    try {
      const status = await testHubToken(token);
      setConnectionStatus(status);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveToken = async () => {
    const profileId = profile?.id || user?.id;
    if (!profileId || !tokenInput.trim()) return;
    if (!tokenInput.startsWith('planner_')) {
      setError('El token debe tener el formato: planner_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          hub_planner_token: tokenInput.trim(),
          hub_token_label: tokenLabelInput.trim() || 'Performance Satellite',
          hub_token_set_at: new Date().toISOString(),
          hub_connection_active: true,
        })
        .eq('id', profileId);

      if (updateError) throw updateError;

      setSettings(prev => ({
        ...prev,
        hub_planner_token: tokenInput.trim(),
        hub_token_label: tokenLabelInput.trim() || 'Performance Satellite',
        hub_token_set_at: new Date().toISOString(),
        hub_connection_active: true,
      }));
      setTokenInput('');
      setTokenLabelInput('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError('Error al guardar el token. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeToken = async () => {
    const profileId = profile?.id || user?.id;
    if (!profileId) return;
    if (!confirm('¿Seguro que quieres eliminar el token? La conexion con el Hub se desactivara.')) return;
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          hub_planner_token: null,
          hub_token_label: null,
          hub_token_set_at: null,
          hub_connection_active: false,
        })
        .eq('id', profileId);

      if (updateError) throw updateError;

      setSettings({
        hub_planner_token: null,
        hub_token_label: null,
        hub_token_set_at: null,
        hub_connection_active: false,
      });
      setConnectionStatus(null);
    } finally {
      setSaving(false);
    }
  };

  const maskToken = (token: string) => {
    return token.substring(0, 12) + '••••••••••••••••••••' + token.substring(token.length - 4);
  };

  // One-time full-history backfill (admin/coach). Idempotent: upserts on
  // unique keys, so re-running overwrites the same rows with the same values.
  const handleRecalculateHistory = async () => {
    setRecalcState('running');
    setRecalcMessage(null);
    try {
      const { data: athletes, error: athletesError } = await supabase
        .from('athletes')
        .select('*');
      if (athletesError) throw athletesError;

      let totalDays = 0;
      for (const athlete of (athletes ?? []) as Athlete[]) {
        const { data: sessions, error: sessionsError } = await supabase
          .from('sessions')
          .select('*')
          .eq('athlete_id', athlete.id)
          .order('session_date', { ascending: true });
        if (sessionsError) throw sessionsError;
        const result = await recalculateHistory(athlete, (sessions ?? []) as Session[]);
        totalDays += result.dailyStateCount;
      }
      setRecalcState('done');
      setRecalcMessage(`Historial recalculado: ${totalDays} dias materializados.`);
    } catch (err) {
      setRecalcState('error');
      setRecalcMessage(err instanceof Error ? err.message : 'Error al recalcular el historial.');
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const tabs = [
    { id: 'connection' as const, label: 'Conexion Hub', icon: Link2 },
    { id: 'account' as const, label: 'Cuenta', icon: User },
    { id: 'notifications' as const, label: 'Notificaciones', icon: Bell },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#F7C843' }}>
            <Settings className="w-4.5 h-4.5" style={{ color: '#2A1F4A' }} />
          </div>
          <h1 className="font-heading text-2xl font-bold text-gray-900 dark:text-white">Configuracion</h1>
        </div>
        <p className="font-body text-[13px] text-gray-500 dark:text-gray-400 ml-12">Ajustes de tu perfil y conexiones externas</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-body font-medium transition-all ${
              activeTab === id
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'connection' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center gap-3">
                <Link2 className="w-4 h-4 text-gray-400" />
                <div>
                  <h2 className="font-body text-[14px] font-semibold text-gray-800 dark:text-gray-100">Conexion con Asciende Hub</h2>
                  <p className="font-body text-[12px] text-gray-500 dark:text-gray-400">Este satelite se conecta al Hub para leer y enviar datos de atletas</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {settings.hub_connection_active && settings.hub_planner_token ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-[#2A1F4A]/5 dark:bg-[#B8A9E5]/10 border border-[#2A1F4A]/20 dark:border-[#B8A9E5]/30">
                    <CheckCircle className="w-5 h-5 text-[#2A1F4A] dark:text-[#B8A9E5] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-[13px] font-semibold text-[#2A1F4A] dark:text-[#B8A9E5]">Conexion activa</p>
                      <p className="font-body text-[12px] text-[#2A1F4A] dark:text-[#B8A9E5] truncate">
                        {settings.hub_token_label || 'Performance Satellite'}
                      </p>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-[#2A1F4A] dark:bg-[#B8A9E5] animate-pulse flex-shrink-0" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <p className="font-body text-[11px] text-gray-400 uppercase tracking-wider mb-1">Token</p>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-[12px] text-gray-700 dark:text-gray-200 flex-1 truncate">
                          {showToken ? settings.hub_planner_token : maskToken(settings.hub_planner_token)}
                        </p>
                        <button
                          onClick={() => setShowToken(!showToken)}
                          className="text-gray-400 hover:text-gray-600 dark:text-gray-300 flex-shrink-0"
                        >
                          {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <p className="font-body text-[11px] text-gray-400 uppercase tracking-wider mb-1">Configurado</p>
                      <p className="font-body text-[12px] text-gray-700 dark:text-gray-200">
                        {settings.hub_token_set_at ? formatDate(settings.hub_token_set_at) : '—'}
                      </p>
                    </div>
                  </div>

                  {connectionStatus && (
                    <div className={`flex items-start gap-3 p-3 rounded-xl text-[12px] font-body ${
                      connectionStatus.tokenValid
                        ? 'bg-[#2A1F4A]/5 dark:bg-[#B8A9E5]/10 text-[#2A1F4A] dark:text-[#B8A9E5] border border-[#2A1F4A]/20 dark:border-[#B8A9E5]/30'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                      {connectionStatus.tokenValid
                        ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      }
                      <span>
                        {connectionStatus.tokenValid
                          ? 'Token verificado. La conexion con el Hub esta funcionando correctamente.'
                          : (connectionStatus.error || 'No se pudo verificar el token.')}
                      </span>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={handleTestConnection}
                        disabled={testing}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-[13px] font-body font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:bg-gray-800 transition-colors disabled:opacity-50"
                      >
                        {testing ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                        {testing ? 'Verificando...' : 'Verificar conexion'}
                      </button>
                      <button
                        onClick={handleRevokeToken}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-[13px] font-body font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar token
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <Link2Off className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="font-body text-[13px] font-semibold text-gray-700 dark:text-gray-200">Sin conexion activa</p>
                    <p className="font-body text-[12px] text-gray-400">
                      {isAdmin ? 'Pega el token generado en el Hub para activar la conexion.' : 'El administrador debe configurar el token de conexion.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {isAdmin && !settings.hub_connection_active && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-gray-400" />
                  <div>
                    <h2 className="font-body text-[14px] font-semibold text-gray-800 dark:text-gray-100">Administrar token de conexion</h2>
                    <p className="font-body text-[12px] text-gray-500 dark:text-gray-400">Solo visible para administradores</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="p-4 rounded-xl bg-[#F7C843]/20 dark:bg-[#F7C843]/10 border border-[#F7C843]/40 dark:border-[#F7C843]/30">
                  <p className="font-body text-[12px] text-[#8A6900] dark:text-[#F7C843] font-semibold mb-1">Como obtener el token</p>
                  <ol className="font-body text-[12px] text-[#8A6900] dark:text-[#F7C843] space-y-1 list-decimal list-inside">
                    <li>Ir al Hub → Settings → External Planners</li>
                    <li>Click en "New token"</li>
                    <li>Planner type: <strong>performance</strong></li>
                    <li>Click "Generate token" y copiar inmediatamente</li>
                    <li>Pegarlo en el campo de abajo</li>
                  </ol>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-[12px] font-body text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                {saveSuccess && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-[#2A1F4A]/5 dark:bg-[#B8A9E5]/10 border border-[#2A1F4A]/20 dark:border-[#B8A9E5]/30 text-[12px] font-body text-[#2A1F4A] dark:text-[#B8A9E5]">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    Token guardado correctamente. Conexion activada.
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="font-body text-[12px] font-medium text-gray-700 dark:text-gray-200 mb-1.5 block">
                      Etiqueta del token
                    </label>
                    <input
                      type="text"
                      value={tokenLabelInput}
                      onChange={e => setTokenLabelInput(e.target.value)}
                      placeholder="Performance Satellite"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 font-body text-[13px] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F7C843] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="font-body text-[12px] font-medium text-gray-700 dark:text-gray-200 mb-1.5 block">
                      Token del Hub <span className="text-gray-400 font-normal">(formato: planner_...)</span>
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={showToken ? 'text' : 'password'}
                        value={tokenInput}
                        onChange={e => { setTokenInput(e.target.value); setError(null); }}
                        placeholder="planner_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 font-mono text-[13px] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F7C843] focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-300"
                      >
                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="font-body text-[11px] text-gray-400 mt-1.5">
                      El token solo se muestra una vez en el Hub. Guardalo en un lugar seguro.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={handleSaveToken}
                    disabled={!tokenInput.trim() || saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-body font-semibold text-[#2A1F4A] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#F7C843' }}
                  >
                    {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Guardando...' : 'Guardar token'}
                  </button>
                  {tokenInput.trim() && (
                    <button
                      onClick={handleTestConnection}
                      disabled={testing}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-[13px] font-body font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      {testing ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                      {testing ? 'Verificando...' : 'Probar token'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-gray-400" />
                <div>
                  <h2 className="font-body text-[14px] font-semibold text-gray-800 dark:text-gray-100">Endpoints disponibles</h2>
                  <p className="font-body text-[12px] text-gray-500 dark:text-gray-400">API del Hub que este satelite puede usar</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { method: 'GET', path: '/athlete-profile', desc: 'Perfil del atleta' },
                  { method: 'GET', path: '/biological-passport', desc: 'VO2max, FTP, zonas' },
                  { method: 'GET', path: '/endurance-data', desc: 'Sesiones de endurance' },
                  { method: 'GET', path: '/training-schedule', desc: 'Calendario de entrenamientos' },
                  { method: 'GET', path: '/wellness', desc: 'Wellness / check-ins' },
                  { method: 'GET', path: '/anthropometry', desc: 'Composicion corporal' },
                  { method: 'POST', path: '/push-training-log', desc: 'Enviar log de entrenamiento' },
                  { method: 'POST', path: '/push-lab-passport', desc: 'Enviar resultados de test' },
                ].map(({ method, path, desc }) => (
                  <div key={path} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                      method === 'GET' ? 'bg-[#2A1F4A]/5 dark:bg-[#B8A9E5]/10 text-[#2A1F4A] dark:text-[#B8A9E5]' : 'bg-[#2A1F4A]/5 dark:bg-[#B8A9E5]/10 text-[#2A1F4A] dark:text-[#B8A9E5]'
                    }`}>
                      {method}
                    </span>
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-gray-700 dark:text-gray-200 truncate">{path}</p>
                      <p className="font-body text-[11px] text-gray-400">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'account' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-gray-400" />
              <h2 className="font-body text-[14px] font-semibold text-gray-800 dark:text-gray-100">Informacion de cuenta</h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <p className="font-body text-[11px] text-gray-400 uppercase tracking-wider mb-1">Nombre</p>
                <p className="font-body text-[14px] text-gray-800 dark:text-gray-100 font-medium">{user?.name || profile?.full_name || '—'}</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <p className="font-body text-[11px] text-gray-400 uppercase tracking-wider mb-1">Email</p>
                <p className="font-body text-[14px] text-gray-800 dark:text-gray-100 font-medium truncate">{user?.email || '—'}</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <p className="font-body text-[11px] text-gray-400 uppercase tracking-wider mb-1">Rol</p>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-body font-semibold ${
                    user?.role === 'admin' ? 'bg-[#F7C843]/20 dark:bg-[#F7C843]/10 text-[#8A6900] dark:text-[#F7C843]' :
                    user?.role === 'trainer' ? 'bg-[#2A1F4A]/5 dark:bg-[#B8A9E5]/10 text-[#2A1F4A] dark:text-[#B8A9E5]' :
                    'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                  }`}>
                    {user?.role === 'admin' && <Shield className="w-3 h-3" />}
                    {user?.role === 'admin' ? 'Administrador' : user?.role === 'trainer' ? 'Coach' : 'Atleta'}
                  </span>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <p className="font-body text-[11px] text-gray-400 uppercase tracking-wider mb-1">Membresia</p>
                <p className="font-body text-[14px] text-gray-800 dark:text-gray-100 font-medium">{user?.membership_name || '—'}</p>
              </div>
            </div>
            <p className="font-body text-[12px] text-gray-400">
              Los datos de cuenta se sincronizan desde el Hub. Para modificarlos, accede a tu perfil en hub.asciende.pro.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4 text-gray-400" />
              <h2 className="font-body text-[14px] font-semibold text-gray-800 dark:text-gray-100">Notificaciones</h2>
            </div>
          </div>
          <div className="p-6">
            <p className="font-body text-[13px] text-gray-500 dark:text-gray-400">Las preferencias de notificaciones estaran disponibles proximamente.</p>
          </div>
        </div>
      )}

      {(isAdmin || user?.role === 'trainer') && (
        <div className="mt-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-4 h-4 text-gray-400" />
              <div>
                <h2 className="font-body text-[14px] font-semibold text-gray-800 dark:text-gray-100">Recalcular historial</h2>
                <p className="font-body text-[12px] text-gray-500 dark:text-gray-400">Backfill completo de daily_load / daily_state desde la primera sesion a hoy. Idempotente.</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-3">
              <button
                onClick={handleRecalculateHistory}
                disabled={recalcState === 'running'}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-body font-semibold text-[#2A1F4A] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#F7C843' }}
              >
                {recalcState === 'running' ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {recalcState === 'running' ? 'Recalculando...' : 'Recalcular historial'}
              </button>
            </div>
            {recalcMessage && (
              <div className={`mt-4 flex items-center gap-2 p-3 rounded-xl text-[12px] font-body ${
                recalcState === 'done'
                  ? 'bg-[#2A1F4A]/5 dark:bg-[#B8A9E5]/10 text-[#2A1F4A] dark:text-[#B8A9E5] border border-[#2A1F4A]/20 dark:border-[#B8A9E5]/30'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {recalcState === 'done' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                {recalcMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
