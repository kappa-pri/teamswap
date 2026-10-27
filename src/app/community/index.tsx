import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchCommunity, fetchSavedIds, saveItem, unsaveItem } from '@/lib/api';
import { colors } from '@/lib/theme';
import type { Item } from '@/lib/types';
import { Button } from '@/components/ui';
import { FeedCard } from '@/components/FeedCard';
import { countFilters, FeedFilterSheet, NO_FILTERS, type FeedFilters } from '@/components/FeedFilter';

/** Full-screen, vertically paged community feed: one item per screen. */
export default function BrowseFeed() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Item>>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [height, setHeight] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<FeedFilters>(NO_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Items and bookmarks load independently: a bookmark problem must never hide the feed.
  const load = useCallback(async () => {
    const [list, ids] = await Promise.allSettled([fetchCommunity(), fetchSavedIds()]);
    if (list.status === 'fulfilled') {
      setItems(list.value);
      setLoadError(null);
    } else {
      setItems((prev) => prev ?? []);
      setLoadError(list.reason instanceof Error ? list.reason.message : String(list.reason));
    }
    if (ids.status === 'fulfilled') setSaved(ids.value);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      // White status bar text over photos; back to dark when leaving.
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, [load]),
  );

  const visible = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return (items ?? []).filter(
      (i) =>
        (!filters.specialty || i.specialty === filters.specialty) &&
        (!filters.category || i.category === filters.category) &&
        (!q || `${i.name} ${i.category} ${i.notes} ${i.owner?.team_name ?? ''}`.toLowerCase().includes(q)),
    );
  }, [items, filters]);

  const toggleSave = async (item: Item) => {
    const wasSaved = saved.has(item.id);
    const flip = (on: boolean) =>
      setSaved((prev) => {
        const next = new Set(prev);
        if (on) next.add(item.id);
        else next.delete(item.id);
        return next;
      });
    flip(!wasSaved);
    try {
      await (wasSaved ? unsaveItem(item.id) : saveItem(item.id));
    } catch (e) {
      flip(wasSaved);
      Alert.alert('Could not update Saved Items', (e as Error).message);
    }
  };

  const applyFilters = (f: FeedFilters) => {
    setFilters(f);
    setFilterOpen(false);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const activeFilters = countFilters(filters);

  return (
    <View style={s.screen} onLayout={(e) => setHeight(Math.round(e.nativeEvent.layout.height))}>
      {items === null || height === 0 ? (
        <View style={s.center}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={visible}
          keyExtractor={(i) => i.id}
          pagingEnabled
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          getItemLayout={(_d, index) => ({ length: height, offset: height * index, index })}
          initialNumToRender={2}
          windowSize={3}
          maxToRenderPerBatch={2}
          refreshControl={
            <RefreshControl
              tintColor="#fff"
              progressViewOffset={insets.top + 48}
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }
          ListEmptyComponent={
            <View style={[s.center, { height }]}>
              {loadError ? (
                <>
                  <MaterialCommunityIcons name="cloud-alert-outline" size={48} color="#bbb" />
                  <Text style={s.emptyTitle}>Couldn’t load the community feed</Text>
                  <Text style={s.emptyBody}>{loadError}</Text>
                  <Button title="Try again" variant="secondary" onPress={load} style={{ marginTop: 16 }} />
                </>
              ) : items.length > 0 ? (
                <>
                  <MaterialCommunityIcons name="filter-off-outline" size={48} color="#bbb" />
                  <Text style={s.emptyTitle}>No items match your filters</Text>
                  <Text style={s.emptyBody}>Try a different tag, category or search.</Text>
                  <Button title="Clear filters" variant="secondary" onPress={() => applyFilters(NO_FILTERS)} style={{ marginTop: 16 }} />
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="compass-off-outline" size={48} color="#bbb" />
                  <Text style={s.emptyTitle}>Nothing shared yet</Text>
                  <Text style={s.emptyBody}>
                    When other teams flag spare parts as available, they’ll show up here.{'\n\n'}
                    Your own items don’t appear in this feed. Sign in with a different account to see them.
                  </Text>
                </>
              )}
            </View>
          }
          renderItem={({ item, index }) => (
            <FeedCard
              item={item}
              height={height}
              saved={saved.has(item.id)}
              bottomInset={insets.bottom}
              showSwipeHint={index === 0 && visible.length > 1}
              onOpen={() => router.push({ pathname: '/community/[id]', params: { id: item.id } })}
              onProfile={() => router.push({ pathname: '/profile/[id]', params: { id: item.owner_id } })}
              onRequest={() => router.push({ pathname: '/request/[itemId]', params: { itemId: item.id } })}
              onToggleSave={() => toggleSave(item)}
            />
          )}
        />
      )}

      {/* Top bar: back · title · filter */}
      <View style={[s.topBar, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.topBtn} accessibilityLabel="Back">
          <MaterialCommunityIcons name="chevron-left" size={30} color="#fff" />
        </Pressable>
        <Text style={s.topTitle}>Browse Community</Text>
        <Pressable onPress={() => setFilterOpen(true)} hitSlop={10} style={s.topBtn} accessibilityLabel="Filter">
          <MaterialCommunityIcons name="tune-variant" size={24} color="#fff" />
          {activeFilters > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{activeFilters}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {filterOpen && <FeedFilterSheet initial={filters} onApply={applyFilters} onClose={() => setFilterOpen(false)} />}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 12, textAlign: 'center' },
  emptyBody: { color: '#bbb', fontSize: 14, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  topBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
