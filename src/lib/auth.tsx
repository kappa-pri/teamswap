import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { fetchMyContacts, fetchProfile } from './api';
import type { Contacts, Profile } from './types';

interface AuthState {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  contacts: Contacts | null;
  /**
   * True while the forgot-password screen is mid-reset. Verifying the emailed
   * code signs the user in, and this keeps them on that screen until the new
   * password is saved.
   */
  recovering: boolean;
  setRecovering: (v: boolean) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contacts, setContacts] = useState<Contacts | null>(null);
  const [recovering, setRecovering] = useState(false);

  const load = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      setContacts(null);
      return;
    }
    try {
      const [p, c] = await Promise.all([fetchProfile(s.user.id), fetchMyContacts()]);
      setProfile(p);
      setContacts(c);
    } catch {
      // Network hiccup: screens will still work and can retry via refresh().
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await load(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Defer so we don't call Supabase from inside its own auth callback.
      setTimeout(() => load(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const refresh = useCallback(() => load(session), [load, session]);
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ ready, session, profile, contacts, recovering, setRecovering, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
