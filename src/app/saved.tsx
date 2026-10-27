import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchMyPendingRequestItemIds, fetchSavedItems, unsaveItem, type SavedEntry } from '@/lib/api';
import { colors } from '@/lib/theme';
import { CONDITION_LABELS } from '@/lib/types';
import { Button, Empty, Loading, StatusPill, styles as ui } from '@/components/ui';
import { ItemRow } from '@/components/ItemRow';
import { RoleBadge } from '@/components/RoleBadge';

/** Bookmarked community items. Separate from the wishlist: no deadlines or matching. */
export default function SavedItems() {
  const [entries, setEntries] = useState<SavedEntry[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [saved, mine] = await Promise.allSettled([fetchSavedItems(), fetchMyPendingRequestItemIds()]);
    // Hide rows whose item was deleted (cascade normally removes them anyway).
    if (saved.status === 'fulfilled') setEntries(saved.value.filter((e) => e.item));
    else setEntries((prev) => prev ?? []);
    if (mine.status === 'fulfilled') setPending(mine.value);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const remove = async (entry: SavedEntry) => {
    const id = entry.item!.id;
    setEntries((prev) => prev?.filter((e) => e.item?.id !== id) ?? null);
    try {
      await unsaveItem(id);
    } catch (e) {
      Alert.alert('Could not remove', (e as Error).message);
      load();
    }
  };

  if (!entries) return <Loading />;

  return (
    <FlatList
      style={ui.screen}
      data={entries}
      keyExtractor={(e) => e.item!.id}
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
      ListEmptyComponent={
        <>
          <Empty
            icon="bookmark-outline"
            title="No saved items yet"
            body="Tap the bookmark on any item in Browse Community to keep it here for later."
          />
          <Button title="Browse Community" icon="compass-outline" onPress={() => router.push('/community')} />
        </>
      }
      renderItem={({ item: entry }) => {
        const item = entry.item!;
        return (
          <ItemRow
            photo={item.photo_url}
            name={item.name}
            specialty={item.specialty}
            status={
              pending.has(item.id) ? (
                <StatusPill text="Pending" tone="warning" />
              ) : item.qty_available > 0 ? (
                <StatusPill text={`${item.qty_available} available`} tone="success" />
              ) : (
                <StatusPill text="None available right now" tone="muted" />
              )
            }
            meta={`${CONDITION_LABELS[item.condition]} · ${item.category}`}
            footer={
              item.owner ? (
                <View style={s.owner}>
                  <Text style={s.ownerText} numberOfLines={1}>
                    {item.owner.team_name}
                  </Text>
                  <RoleBadge role={item.owner.role} />
                </View>
              ) : null
            }
            right={
              <Pressable
                onPress={() => remove(entry)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.name} from Saved Items`}
                style={({ pressed }) => [s.bookmark, pressed && { opacity: 0.5 }]}
              >
                <MaterialCommunityIcons name="bookmark" size={26} color={colors.primary} />
              </Pressable>
            }
            onPress={() => router.push({ pathname: '/community/[id]', params: { id: item.id } })}
          />
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  owner: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  ownerText: { fontSize: 13, fontWeight: '700', color: colors.text, flexShrink: 1 },
  bookmark: { padding: 6 },
});
