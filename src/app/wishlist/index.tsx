import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { deleteWishlistEntry, fetchMyWishlist } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import { daysUntil, formatDate } from '@/lib/dates';
import type { WishlistEntry } from '@/lib/types';
import { Empty, Fab, Loading, styles as ui } from '@/components/ui';
import { FlagBadge } from '@/components/FlagBadge';
import { SwipeReveal } from '@/components/SwipeReveal';

export default function Wishlist() {
  const [entries, setEntries] = useState<WishlistEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setEntries(await fetchMyWishlist());
      setError(null);
    } catch (e) {
      setEntries((prev) => prev ?? []);
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const remove = async (entry: WishlistEntry) => {
    setEntries((prev) => prev?.filter((e) => e.id !== entry.id) ?? null);
    try {
      await deleteWishlistEntry(entry.id);
    } catch (e) {
      Alert.alert('Could not delete', (e as Error).message);
      load();
    }
  };

  if (!entries) return <Loading />;

  return (
    <View style={ui.screen}>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
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
          entries.length > 0 ? (
            <Text style={[ui.muted, { fontSize: 12, marginBottom: 10 }]}>
              Tap to see matches · Hold to edit · Swipe left to delete
            </Text>
          ) : null
        }
        ListEmptyComponent={
          error ? (
            <Empty icon="cloud-alert-outline" title="Couldn’t load your wishlist" body={error} />
          ) : (
            <Empty
              icon="star-outline"
              title="Your wishlist is empty"
              body="Add parts you need. We’ll show how many teams have a match available right now."
            />
          )
        }
        ListFooterComponent={
          <View style={s.footer}>
            <MaterialCommunityIcons name="calendar-remove-outline" size={16} color={colors.muted} />
            <Text style={s.footerText}>Entries are removed automatically after their need-by date.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <SwipeReveal onDelete={() => remove(item)} deleteLabel="Delete">
            {(open, close) => (
              <WishCard
                entry={item}
                onPress={() =>
                  open ? close() : router.push({ pathname: '/wishlist/[id]', params: { id: item.id, name: item.name } })
                }
                onLongPress={() => {
                  close();
                  router.push({ pathname: '/wishlist/[id]/edit', params: { id: item.id } });
                }}
              />
            )}
          </SwipeReveal>
        )}
      />
      <Fab onPress={() => router.push('/wishlist/new')} bottom={36} />
    </View>
  );
}

function WishCard({
  entry: e,
  onPress,
  onLongPress,
}: {
  entry: WishlistEntry;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const left = daysUntil(e.need_by);
  const soon = left <= 3;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [s.card, e.urgent && s.cardUrgent, pressed && { opacity: 0.9 }]}
    >
      <View style={s.top}>
        <Text style={s.name} numberOfLines={2}>
          {e.name}
        </Text>
        {e.urgent && (
          <View style={s.urgent}>
            <MaterialCommunityIcons name="alert-circle" size={13} color="#fff" />
            <Text style={s.urgentText}>URGENT</Text>
          </View>
        )}
      </View>
      <View style={s.metaRow}>
        <FlagBadge specialty={e.specialty} size="sm" />
        <Text style={s.meta}>Need {e.qty_needed}</Text>
        <Text style={[s.meta, soon && { color: colors.danger, fontWeight: '700' }]}>
          by {formatDate(e.need_by)}
          {left === 0 ? ' (today)' : left > 0 && left <= 7 ? ` (${left}d)` : ''}
        </Text>
      </View>
      {e.match_count > 0 ? (
        <View style={s.match}>
          <MaterialCommunityIcons name="check-decagram" size={18} color={colors.success} />
          <Text style={s.matchText}>
            {e.match_count} match{e.match_count === 1 ? '' : 'es'} available now
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.success} />
        </View>
      ) : (
        <View style={s.noMatch}>
          <MaterialCommunityIcons name="bell-outline" size={15} color={colors.faint} />
          <Text style={s.noMatchText}>No matches yet — we’ll notify you</Text>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardUrgent: { borderColor: colors.danger, borderLeftWidth: 4 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  name: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.text },
  urgent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.danger,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  urgentText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  meta: { fontSize: 14, color: colors.muted },
  match: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: colors.successSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  matchText: { flex: 1, color: colors.success, fontWeight: '800', fontSize: 15 },
  noMatch: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  noMatchText: { color: colors.faint, fontSize: 13, fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20 },
  footerText: { fontSize: 12, color: colors.muted, textAlign: 'center' },
});
