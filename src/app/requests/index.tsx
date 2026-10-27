import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchMyRequests } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import { formatDate } from '@/lib/dates';
import type { ItemRequest } from '@/lib/types';
import { Empty, Loading, StatusPill, styles as ui } from '@/components/ui';
import { RoleBadge } from '@/components/RoleBadge';
import { Thumb } from '@/components/ItemRow';

const ORDER = { pending: 0, approved: 1, received: 2, denied: 3 } as const;

function requestStatusPill(r: ItemRequest, incoming: boolean) {
  switch (r.status) {
    case 'pending':
      return incoming ? <StatusPill text="Needs your answer" tone="warning" /> : <StatusPill text="Waiting for owner" tone="primary" />;
    case 'approved':
      if (r.sent_at) return <StatusPill text={incoming ? 'Sent · awaiting receipt' : 'Sent · mark received'} tone="success" />;
      return <StatusPill text={r.final_date ? `Pickup ${formatDate(r.final_date)}` : 'Approved · coordinate'} tone="success" />;
    case 'denied':
      return <StatusPill text="Declined" tone="danger" />;
    case 'received':
      return <StatusPill text="Received" tone="muted" />;
  }
}

export default function Requests() {
  const { itemId, itemName } = useLocalSearchParams<{ itemId?: string; itemName?: string }>();
  const [data, setData] = useState<{ incoming: ItemRequest[]; outgoing: ItemRequest[] } | null>(null);
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetchMyRequests();
      setData({ incoming: r.incoming, outgoing: r.outgoing });
    } catch {
      setData((prev) => prev ?? { incoming: [], outgoing: [] });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const effectiveTab = itemId ? 'incoming' : tab;
  const rows = useMemo(() => {
    const list = (data?.[effectiveTab] ?? []).filter((r) => !itemId || r.item_id === itemId);
    return [...list].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  }, [data, effectiveTab, itemId]);

  if (!data) return <Loading />;
  const waiting = data.incoming.filter((r) => r.status === 'pending').length;

  return (
    <FlatList
      style={ui.screen}
      data={rows}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
      ListHeaderComponent={
        <>
          {itemId && <Stack.Screen options={{ title: itemName ? `Requests · ${itemName}` : 'Item requests' }} />}
          {!itemId && (
            <View style={s.tabs}>
              {(['incoming', 'outgoing'] as const).map((t) => (
                <Pressable key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabOn]}>
                  <Text style={[s.tabText, tab === t && s.tabTextOn]}>
                    {t === 'incoming' ? `Incoming${waiting ? ` (${waiting})` : ''}` : 'Sent'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      }
      ListEmptyComponent={
        <Empty
          icon="inbox-outline"
          title={effectiveTab === 'incoming' ? 'No incoming requests' : 'You haven’t requested anything yet'}
          body={effectiveTab === 'incoming' ? 'Requests for your flagged items show up here.' : 'Find parts in Browse Community.'}
        />
      }
      renderItem={({ item: r }) => {
        const incoming = effectiveTab === 'incoming';
        const other = incoming ? r.requester : r.owner;
        return (
          <Pressable
            onPress={() => router.push({ pathname: '/requests/[id]', params: { id: r.id } })}
            style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}
          >
            <Thumb uri={r.item?.photo_url ?? null} size={56} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.title} numberOfLines={1}>
                {r.item_name}
              </Text>
              <View style={[ui.row, { gap: 6, marginVertical: 3 }]}>
                <Text style={s.team} numberOfLines={1}>
                  {incoming ? 'From ' : 'To '}
                  {other?.team_name ?? 'Unknown'}
                </Text>
                {other && <RoleBadge role={other.role} />}
              </View>
              <Text style={ui.muted}>
                Qty {r.qty} · Need by {formatDate(r.need_by)}
              </Text>
              <View style={{ marginTop: 6 }}>{requestStatusPill(r, incoming)}</View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.faint} />
          </Pressable>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: radius.md, padding: 3, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  tabOn: { backgroundColor: colors.card },
  tabText: { fontWeight: '700', color: colors.muted },
  tabTextOn: { color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  team: { fontSize: 14, fontWeight: '600', color: colors.text, flexShrink: 1 },
});
