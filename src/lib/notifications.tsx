import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { fetchNotifications, markNotificationsRead } from './api';
import type { AppNotification } from './types';

interface NotificationsState {
  items: AppNotification[];
  unread: number;
  loaded: boolean;
  refresh: () => Promise<void>;
  markRead: (ids?: string[]) => Promise<void>;
  /** Mark one read and go to the screen it's about. */
  open: (n: AppNotification) => void;
}

const Ctx = createContext<NotificationsState | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  // Tagged with the user it belongs to, so a sign-out/sign-in never shows stale rows.
  const [state, setState] = useState<{ uid: string | null; items: AppNotification[]; loaded: boolean }>({
    uid: null,
    items: [],
    loaded: false,
  });

  const refresh = useCallback(async () => {
    if (!uid) return;
    try {
      const items = await fetchNotifications();
      setState({ uid, items, loaded: true });
    } catch {
      setState((s) => (s.uid === uid ? { ...s, loaded: true } : { uid, items: [], loaded: true }));
    }
  }, [uid]);

  useEffect(() => {
    if (!uid) return;

    // Live: any insert/update to my notification rows triggers a refresh.
    // The first load happens once the channel reports in, so nothing created
    // between "load" and "subscribed" is missed; on failure we still load.
    const channel = supabase
      .channel(`notifications:${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => refresh())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => refresh())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') refresh();
      });

    // Catch up after the app was in the background (live events may be missed).
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });

    return () => {
      supabase.removeChannel(channel);
      sub.remove();
    };
  }, [uid, refresh]);

  const mine = state.uid === uid ? state : { uid, items: [] as AppNotification[], loaded: false };
  const unread = mine.items.filter((n) => !n.read_at).length;

  const markRead = useCallback(
    async (ids?: string[]) => {
      const now = new Date().toISOString();
      setState((s) => ({
        ...s,
        items: s.items.map((n) => (!n.read_at && (!ids || ids.includes(n.id)) ? { ...n, read_at: now } : n)),
      }));
      try {
        await markNotificationsRead(ids);
      } catch {
        refresh();
      }
    },
    [refresh],
  );

  const open = useCallback(
    (n: AppNotification) => {
      if (!n.read_at) markRead([n.id]);
      if (n.request_id) {
        router.push({ pathname: '/requests/[id]', params: { id: n.request_id } });
      } else if (n.type === 'wishlist_match' && n.item_id) {
        router.push({ pathname: '/community/[id]', params: { id: n.item_id } });
      } else if (n.type === 'wishlist_match') {
        router.push('/wishlist');
      }
    },
    [markRead],
  );

  return (
    <Ctx.Provider value={{ items: mine.items, unread, loaded: mine.loaded, refresh, markRead, open }}>
      {children}
    </Ctx.Provider>
  );
}

export function useNotifications(): NotificationsState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}
