import { useState, useEffect } from 'react';

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

const HUB_URL = 'https://hub.asciende.pro';
const SESSION_TOKEN_KEY = 'hub_session_token';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded);
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

export function useSatelliteAuth() {
  const [user, setUser] = useState<HubUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('session_token');
    if (tokenFromUrl) {
      localStorage.setItem(SESSION_TOKEN_KEY, tokenFromUrl);
      const cleanUrl = window.location.href.split('?')[0];
      window.history.replaceState({}, '', cleanUrl);
    }
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem(SESSION_TOKEN_KEY);
      if (!token) {
        setUser(null);
        return;
      }

      setHasToken(true);
      const payload = decodeJwtPayload(token);

      if (!payload) {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        setUser(null);
        setHasToken(false);
        return;
      }

      if (isTokenExpired(payload)) {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        setUser(null);
        setHasToken(false);
        return;
      }

      const hubUser = extractUserFromPayload(payload);

      if (hubUser) {
        setUser(hubUser);
      } else {
        await checkAuthViaProxy(token);
      }
    } catch (error) {
      const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.error('[Auth] Check failed:', msg);
      setAuthError(msg);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const checkAuthViaProxy = async (token: string) => {
    try {
      const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hub-auth-proxy`;
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const raw = data.user ?? (data.id ? data : null);
        if (raw?.id) {
          setUser({
            id: raw.id,
            email: raw.email,
            name: raw.name,
            role: raw.role ?? 'athlete',
            active_plan: raw.active_plan,
            membership_slug: raw.membership_slug ?? 'inicia',
            membership_name: raw.membership_name ?? 'Asciende Inicia',
          });
        } else {
          localStorage.removeItem(SESSION_TOKEN_KEY);
          setUser(null);
          setHasToken(false);
        }
      } else {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        setUser(null);
        setHasToken(false);
      }
    } catch {
      localStorage.removeItem(SESSION_TOKEN_KEY);
      setUser(null);
      setHasToken(false);
    }
  };

  const login = () => {
    const currentUrl = window.location.href.split('?')[0];
    window.location.href = `${HUB_URL}?redirect=${encodeURIComponent(currentUrl)}`;
  };

  const logout = async () => {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    setUser(null);
    setHasToken(false);
    window.location.href = HUB_URL;
  };

  return { user, loading, hasToken, authError, login, logout };
}
