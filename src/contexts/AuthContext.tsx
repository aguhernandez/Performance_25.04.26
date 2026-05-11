import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type MembershipSlug = 'inicia' | 'intermediate' | 'pro';

export interface HubUser {
  id: string;
  email: string;
  name?: string;
  role: 'athlete' | 'trainer' | 'admin';
  active_plan?: string[];
  membership_slug: MembershipSlug;
  membership_name: string;
}

export interface Profile {
  id: string;
  hub_user_id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'coach' | 'athlete';
}

export function hasAIAccess(membershipSlug?: MembershipSlug): boolean {
  return membershipSlug === 'intermediate' || membershipSlug === 'pro';
}

export function hasMembershipAccess(userSlug: MembershipSlug | undefined, requiredSlugs: MembershipSlug[]): boolean {
  if (!userSlug) return false;
  return requiredSlugs.includes(userSlug);
}

const HUB_URL = 'https://hub.asciende.pro';
const SESSION_TOKEN_KEY = 'hub_session_token';
const DEV_MODE_KEY = 'asc_impulse_dev_mode';

function getDevModePreference(): boolean {
  const localPref = localStorage.getItem(DEV_MODE_KEY);
  if (localPref !== null) return localPref === 'true';
  return import.meta.env.VITE_FORCE_DEV_MODE === 'true';
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function isTokenExpired(payload: Record<string, unknown>): boolean {
  if (typeof payload.exp !== 'number') return false;
  return Date.now() / 1000 > payload.exp;
}

function extractUserFromPayload(payload: Record<string, unknown>): HubUser | null {
  const sub = payload.sub ?? payload.user_id ?? payload.id;
  const email = payload.email;
  if (!sub || !email) return null;
  return {
    id: String(sub),
    email: String(email),
    name: payload.name ? String(payload.name) : undefined,
    role: (payload.role as HubUser['role']) ?? 'athlete',
    active_plan: Array.isArray(payload.active_plan) ? payload.active_plan : undefined,
    membership_slug: (payload.membership_slug as MembershipSlug) ?? 'inicia',
    membership_name: payload.membership_name ? String(payload.membership_name) : 'Asciende Inicia',
  };
}

interface AuthContextType {
  user: HubUser | null;
  profile: Profile | null;
  loading: boolean;
  hasToken: boolean;
  isDevMode: boolean;
  login: () => void;
  loginWithCredentials: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => void;
  setDevProfile: (profile: Profile) => void;
  setUser: (user: HubUser) => void;
  setProfile: (profile: Profile) => void;
  toggleDevMode: (enabled: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<HubUser | null>(null);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);

  useEffect(() => {
    const devMode = getDevModePreference();
    setIsDevMode(devMode);

    if (devMode) {
      setLoading(false);
    } else {
      checkHubAuth();
    }
  }, []);

  const checkHubAuth = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = urlParams.get('session_token');

      if (tokenFromUrl) {
        localStorage.setItem(SESSION_TOKEN_KEY, tokenFromUrl);
        window.history.replaceState({}, '', window.location.href.split('?')[0]);
      }

      const token = localStorage.getItem(SESSION_TOKEN_KEY);
      if (!token) return;

      setHasToken(true);
      const payload = decodeJwtPayload(token);

      if (!payload || isTokenExpired(payload)) {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        setHasToken(false);
        return;
      }

      const hubUser = extractUserFromPayload(payload);
      if (hubUser) {
        setUserState(hubUser);
        await syncProfile(hubUser);
      } else {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        setHasToken(false);
      }
    } catch (error) {
      console.error('[Auth] Check failed:', error);
      localStorage.removeItem(SESSION_TOKEN_KEY);
      setHasToken(false);
    } finally {
      setLoading(false);
    }
  };

  const syncProfile = async (hubUser: HubUser) => {
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('hub_user_id', hubUser.id)
        .maybeSingle();

      if (fetchError) { console.error('❌ Error fetching profile:', fetchError); return; }

      if (existing) {
        setProfileState(existing);
      } else {
        const normalizedRole = hubUser.role === 'trainer' ? 'coach' : hubUser.role;
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: hubUser.id,
            email: hubUser.email,
            full_name: hubUser.name || hubUser.email,
            hub_user_id: hubUser.id,
            role: normalizedRole,
          })
          .select()
          .single();

        if (createError) { console.error('❌ Error creating profile:', createError); return; }
        setProfileState(newProfile);
      }
    } catch (error) {
      console.error('💥 Profile sync failed:', error);
    }
  };

  const loginWithCredentials = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const res = await fetch('https://ngkcbygyoobqhlmlnuvl.supabase.co/functions/v1/academy-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { error: data?.error ?? data?.message ?? 'Authentication failed' };
      }

      const token: string | undefined = data?.token ?? data?.access_token ?? data?.session?.access_token;
      if (!token) return { error: 'No token received from Hub' };

      localStorage.setItem(SESSION_TOKEN_KEY, token);
      setHasToken(true);

      const payload = decodeJwtPayload(token);
      if (!payload || isTokenExpired(payload)) {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        setHasToken(false);
        return { error: 'Invalid or expired token' };
      }

      const hubUser = extractUserFromPayload(payload);
      if (!hubUser) {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        setHasToken(false);
        return { error: 'Could not extract user from token' };
      }

      setUserState(hubUser);
      await syncProfile(hubUser);
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Network error' };
    }
  };

  const login = () => {
    if (isDevMode) return;
    const currentUrl = window.location.href.split('?')[0];
    window.location.href = `${HUB_URL}?redirect=${encodeURIComponent(currentUrl)}`;
  };

  const logout = () => {
    if (isDevMode) {
      setUserState(null);
      setProfileState(null);
      return;
    }
    localStorage.removeItem(SESSION_TOKEN_KEY);
    setUserState(null);
    setProfileState(null);
    setHasToken(false);
    window.location.href = HUB_URL;
  };

  const setDevProfile = (devProfile: Profile) => {
    setProfileState(devProfile);
    setUserState({
      id: devProfile.hub_user_id,
      email: devProfile.email,
      name: devProfile.full_name,
      role: devProfile.role === 'coach' ? 'trainer' : devProfile.role,
      membership_slug: 'pro',
      membership_name: 'Asciende Pro (Dev)',
    });
    setHasToken(true);
  };

  const toggleDevMode = (enabled: boolean) => {
    localStorage.setItem(DEV_MODE_KEY, String(enabled));
    if (!enabled) {
      setUserState(null);
      setProfileState(null);
      setHasToken(false);
    }
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      hasToken,
      isDevMode,
      login,
      loginWithCredentials,
      logout,
      setDevProfile,
      setUser: setUserState,
      setProfile: setProfileState,
      toggleDevMode,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
