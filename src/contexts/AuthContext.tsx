import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getSupabaseClientAsync,
  getSupabaseClient,
  storeAnonKey,
} from '@/lib/supabase';

export type ConnectionStatus = 'initialising' | 'connected' | 'needs_key' | 'error';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  connectionStatus: ConnectionStatus;
  /** Resolved from the backend; never inferred from a client-side identifier. */
  isPlatformOwner: boolean;
  /** True while the backend owner check is still in progress for this user. */
  isPlatformOwnerLoading: boolean;
  /** Last-resort manual key — only called from LoginPage when auto-init fails */
  setManualKey: (key: string) => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, niche: string) => Promise<{ error: Error | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

// A revoked/expired browser refresh token is a local sign-in problem, not
// evidence that the shared SWISH OnSpace Cloud backend is offline.
function isInvalidStoredSession(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const authError = error as { code?: unknown; message?: unknown };
  const code = String(authError.code || '').toLowerCase();
  const message = String(authError.message || '').toLowerCase();
  return ['refresh_token_not_found', 'refresh_token_already_used', 'invalid_refresh_token', 'invalid_grant'].includes(code)
    || (/refresh[ _-]?token/.test(message) && /(invalid|expired|missing|not found|already used)/.test(message));
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [session, setSession]         = useState<Session | null>(null);
  const [loading, setLoading]         = useState(true);
  const [connectionStatus, setStatus] = useState<ConnectionStatus>('initialising');
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);
  const [isPlatformOwnerLoading, setIsPlatformOwnerLoading] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);
  const previousUserId = useRef<string | null | undefined>(undefined);
  const qc = useQueryClient();

  const attachAuthListener = useCallback(() => {
    // Clean up any existing subscription first
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }

    const sb = getSupabaseClient();
    if (!sb) return;

    let active = true;
    let authRevision = 0;
    const applySession = (next: Session | null) => {
      if (!active) return;
      const nextId = next?.user.id ?? null;
      if (previousUserId.current !== nextId) {
        qc.clear();
        previousUserId.current = nextId;
        // Prevent a previous account's client state from carrying into this one.
        setIsPlatformOwner(false);
        setIsPlatformOwnerLoading(Boolean(nextId));
      }
      setSession(next);
      setUser(next?.user ?? null);
      setStatus('connected');
      setLoading(false);
    };
    // Subscribe first so a late getSession response cannot replace a newer login.
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, next) => {
      authRevision += 1;
      applySession(next);
    });
    const revision = authRevision;
    const recoverSession = (error: unknown) => {
      if (!active || revision !== authRevision) return;
      if (!isInvalidStoredSession(error)) {
        // The backend or authentication gateway may be unreachable. Keep
        // existing credentials intact so a retry can restore the session.
        console.warn('[SWISH] Session restoration failed; existing session preserved');
        setStatus('error');
        setLoading(false);
        return;
      }
      // Only a confirmed invalid refresh token should clear local auth state.
      // Do not delete the public backend key or erase inventory/niche settings.
      void sb.auth.signOut({ scope: 'local' }).then(({ error: signOutError }) => {
        if (!active) return;
        if (signOutError) {
          setStatus('error');
          setLoading(false);
          return;
        }
        applySession(null);
      }).catch(() => {
        if (!active) return;
        setStatus('error');
        setLoading(false);
      });
    };
    void sb.auth.getSession().then(({ data, error }) => {
      if (!active || revision !== authRevision) return;
      if (error) { recoverSession(error); return; }
      applySession(data.session);
    }).catch(recoverSession);
    unsubRef.current = () => { active = false; subscription.unsubscribe(); };
  }, [qc]);

  // Auto-initialise on mount — never requires user interaction under normal conditions
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = await getSupabaseClientAsync();
        if (cancelled) return;
        if (!sb) {
          // No key found after all resolution steps
          setStatus('needs_key');
          setLoading(false);
          return;
        }
        setStatus('connected');
        attachAuthListener();
      } catch {
        if (!cancelled) {
          setStatus('error');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; unsubRef.current?.(); unsubRef.current = null; };
  }, [attachAuthListener]);

  // Privileged UI is based on the same backend RPC as the native app. Failure
  // leaves this false, so a browser-side error can never grant owner access.
  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setIsPlatformOwner(false);
      setIsPlatformOwnerLoading(false);
      return () => { cancelled = true; };
    }
    void (async () => {
      try {
        const sb = getSupabaseClient() || await getSupabaseClientAsync();
        if (!sb) return;
        const { data, error } = await sb.rpc('swish_is_platform_owner');
        if (!cancelled && !error) setIsPlatformOwner(data === true);
      } catch {
        // Backend authorization remains authoritative; errors grant nothing.
      } finally {
        if (!cancelled) setIsPlatformOwnerLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  /** Called only when auto-init fails and user provides key via LoginPage */
  const setManualKey = useCallback((key: string) => {
    storeAnonKey(key); // stores in localStorage + builds client
    setStatus('connected');
    setLoading(true);
    // Give the client a tick to register
    setTimeout(() => attachAuthListener(), 50);
  }, [attachAuthListener]);

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    const sb = getSupabaseClient() || await getSupabaseClientAsync();
    if (!sb) return { error: new Error('Backend not connected') };
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  };

  const signUp = async (email: string, password: string, fullName: string, niche: string): Promise<{ error: Error | null; needsEmailConfirmation: boolean }> => {
    const sb = getSupabaseClient() || await getSupabaseClientAsync();
    if (!sb) return { error: new Error('Backend not connected'), needsEmailConfirmation: false };

    const { data, error } = await sb.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          preferred_niche: niche,
          onboarding_status: 'started',
          signup_source: 'swish_web',
        },
      },
    });
    return {
      error: error ? new Error(error.message) : null,
      needsEmailConfirmation: !error && !data.session,
    };
  };

  const signOut = async () => {
    // IMPORTANT: sign out does NOT destroy backend configuration.
    // We only end the user's session. The anon key remains in localStorage
    // so the next sign-in requires no manual key entry.
    const sb = getSupabaseClient();
    if (sb) {
      const { error } = await sb.auth.signOut();
      if (error) { toast.error(error.message); return; }
    }
    qc.clear();
    previousUserId.current = null;
    setIsPlatformOwner(false);
    setIsPlatformOwnerLoading(false);
    localStorage.removeItem('swish_active_niche');
    localStorage.removeItem('swish_active_niche_name');
    delete document.documentElement.dataset.niche;
    setUser(null);
    setSession(null);
    // Do NOT call resetClient() or clearStoredAnonKey() here.
    // The backend connection remains active; only the auth session is cleared.
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, connectionStatus, isPlatformOwner, isPlatformOwnerLoading, setManualKey, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
