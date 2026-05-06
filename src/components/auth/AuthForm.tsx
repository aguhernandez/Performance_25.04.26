import { useState } from 'react';
import { Activity, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AuthFormProps {
  onAuth: () => void;
}

export function AuthForm({ onAuth }: AuthFormProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
      onAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-amber-50 rounded-full blur-3xl opacity-40" />
        <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-purple-50 rounded-full blur-3xl opacity-40" />
      </div>

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="relative">
              <Activity className="w-7 h-7" style={{ color: '#514163' }} />
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: '#fdda36' }} />
            </div>
            <span className="font-heading text-2xl font-bold tracking-tight" style={{ color: '#514163' }}>ASC</span>
            <span className="font-heading text-2xl font-bold tracking-tight" style={{ color: '#fdda36' }}>Impulse</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <Zap className="w-3.5 h-3.5" style={{ color: '#fdda36' }} />
            <span className="font-body text-[11px] text-gray-500 uppercase tracking-widest">Performance Vector Engine</span>
          </div>
          <p className="font-body text-gray-600 text-[13px]">Impulse-response performance modeling</p>
        </div>

        <div className="bg-white border border-[#e5e7eb] rounded-2xl p-6 shadow-sm">
          <div className="flex mb-5 bg-gray-100 rounded-lg p-0.5">
            {(['login', 'signup'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-1.5 rounded-md font-body text-[12px] font-medium transition-all ${
                  mode === m
                    ? 'bg-[#fdda36] text-[#514163]'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block font-body text-[11px] uppercase text-gray-500 mb-1.5 tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="athlete@example.com"
                className="asc-input"
              />
            </div>
            <div>
              <label className="block font-body text-[11px] uppercase text-gray-500 mb-1.5 tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                minLength={6}
                className="asc-input"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                <p className="font-body text-[12px] text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-[13px] py-2.5 mt-1"
            >
              {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        <div className="mt-4 text-center">
          <p className="font-body text-[10px] text-gray-400">
            Impulse–Response · Performance Vector · Personalized Modeling
          </p>
        </div>
      </div>
    </div>
  );
}
