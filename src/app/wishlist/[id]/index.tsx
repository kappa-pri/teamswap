import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchWishlistMatches } from '@/lib/api';
import { colors } from '@/lib/theme';
import { CONDITION_LABELS, type Item } from '@/lib/types';
import { Button, Empty, Loading, StatusPill, styles as ui } from '@/components/ui';
import { ItemRow } from '@/components/ItemRow';
import { RoleBadge } from '@/components/RoleBadge';

/** Community items that match one wishlist entry right now. */
export default function WishlistMatches() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchWishlistMatches(id).then(
        (list) => {
          setItems(list);
          setError(null);
        },
        (e: Error) => {
          setItems([]);
          setError(e.message);
        },
      );
    }, [id]),
  );

  const edit = () => router.push({ pathname: '/wishlist/[id]/edit', params: { id } });

  return (
    <>
      <Stack.Screen
        options={{
          title: name ? `Matches · ${name}` : 'Matches',
          headerRight: () => (
            <Pressable onPress={edit} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.primary} />
              <Text style={s.edit}>Edit</Text>
            </Pressable>
          ),
        }}
      />
      {!items ? (
        <Loading />
      ) : (
        <FlatList
          style={ui.screen}
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListHeaderComponent={
            items.length > 0 ? (
              <Text style={[ui.muted, { marginBottom: 10 }]}>
                {items.length} item{items.length === 1 ? '' : 's'} from other teams available now
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <>
              <Empty
                icon={error ? 'cloud-alert-outline' : 'bell-outline'}
                title={error ? 'Couldn’t load matches' : 'No matches yet'}
                body={error ?? 'We’ll notify you when another team flags a matching part as available.'}
              />
              <Button title="Edit this entry" variant="secondary" icon="pencil-outline" onPress={edit} />
            </>
          }
          renderItem={({ item }) => (
            <ItemRow
              photo={item.photo_url}
              name={item.name}
              specialty={item.specialty}
              status={<StatusPill text={`${item.qty_available} available`} tone="success" />}
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
              onPress={() => router.push({ pathname: '/community/[id]', params: { id: item.id } })}
            />
          )}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  edit: { color: colors.primary, fontWeight: '700', marginLeft: 4, fontSize: 16 },
  owner: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  ownerText: { fontSize: 13, fontWeight: '700', color: colors.text, flexShrink: 1 },
});
