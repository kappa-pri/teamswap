import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchMyItems } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import { CONDITION_LABELS, type Item } from '@/lib/types';
import { Chip, Empty, Fab, Loading, styles as ui } from '@/components/ui';
import { ItemRow, ItemStatus } from '@/components/ItemRow';
import { SwipeRow } from '@/components/SwipeRow';
import { FlagSheet } from '@/components/FlagSheet';

type StatusFilter = 'all' | 'available' | 'pending' | 'kept';
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Flagged available' },
  { key: 'pending', label: 'Pending' },
  { key: 'kept', label: 'Not shared' },
];

export default function Inventory() {
  const params = useLocalSearchParams<{ status?: StatusFilter }>();
  const [items, setItems] = useState<Item[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>(params.status ?? 'all');
  const [category, setCategory] = useState<string | null>(null);
  const [flagging, setFlagging] = useState<Item | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await fetchMyItems());
    } catch {
      setItems((prev) => prev ?? []);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const categories = useMemo(() => [...new Set((items ?? []).map((i) => i.category))].sort(), [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter((i) => {
      if (q && !`${i.name} ${i.notes} ${i.category}`.toLowerCase().includes(q)) return false;
      if (category && i.category !== category) return false;
      if (status === 'available' && i.qty_available === 0) return false;
      if (status === 'pending' && i.qty_pending === 0) return false;
      if (status === 'kept' && (i.qty_available > 0 || i.qty_pending > 0)) return false;
      return true;
    });
  }, [items, query, status, category]);

  if (!items) return <Loading />;

  return (
    <View style={ui.screen}>
      <FlatList
        data={visible}
        keyExtractor={(i) => i.id}
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
          <View style={{ marginBottom: 6 }}>
            <View style={s.search}>
              <MaterialCommunityIcons name="magnify" size={20} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search your parts"
                placeholderTextColor={colors.faint}
                style={s.searchInput}
                clearButtonMode="while-editing"
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 2 }}>
              {STATUS_FILTERS.map((f) => (
                <Chip key={f.key} label={f.label} selected={status === f.key} onPress={() => setStatus(f.key)} />
              ))}
            </ScrollView>
            {categories.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Chip label="Any category" selected={!category} onPress={() => setCategory(null)} color={colors.text} />
                {categories.map((c) => (
                  <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} color={colors.text} />
                ))}
              </ScrollView>
            )}
            {items.length > 0 && (
              <View style={s.hint}>
                <MaterialCommunityIcons name="gesture-swipe-left" size={16} color={colors.muted} />
                <Text style={s.hintText}>Tap to open · Swipe left to flag · Hold to edit</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          items.length === 0 ? (
            <Empty icon="package-variant" title="Your inventory is empty" body="Tap + to add your first part." />
          ) : (
            <Empty icon="filter-off-outline" title="No items match" body="Try a different search or filter." />
          )
        }
        renderItem={({ item }) => (
          <SwipeRow label="Flag available" onSwipe={() => setFlagging(item)}>
            <ItemRow
              photo={item.photo_url}
              name={item.name}
              specialty={item.specialty}
              status={<ItemStatus item={item} />}
              meta={`Qty ${item.qty_total} · ${item.category} · ${CONDITION_LABELS[item.condition]}`}
              onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
              onLongPress={() => router.push({ pathname: '/item/[id]/edit', params: { id: item.id } })}
            />
          </SwipeRow>
        )}
      />
      <Fab onPress={() => router.push('/item/new')} bottom={36} />
      <FlagSheet
        key={flagging?.id ?? 'none'}
        item={flagging}
        onClose={() => setFlagging(null)}
        onSaved={(u) => setItems((prev) => prev?.map((i) => (i.id === u.id ? u : i)) ?? null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: { flex: 1, paddingVertical: 11, marginLeft: 6, fontSize: 16, color: colors.text },
  hint: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  hintText: { marginLeft: 6, fontSize: 12, color: colors.muted },
});
