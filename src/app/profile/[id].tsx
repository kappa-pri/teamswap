import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchProfile, fetchSharedItemsOf } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, roleIcons, roleLabels } from '@/lib/theme';
import { CONDITION_LABELS, type Item, type Profile } from '@/lib/types';
import { Button, Empty, Loading, StatusPill, styles as ui } from '@/components/ui';
import { ItemRow } from '@/components/ItemRow';

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [items, setItems] = useState<Item[]>([]);

  useFocusEffect(
    useCallback(() => {
      Promise.all([fetchProfile(id), fetchSharedItemsOf(id)]).then(
        ([p, i]) => {
          setProfile(p);
          setItems(i);
        },
        () => setProfile(null),
      );
    }, [id]),
  );

  if (profile === undefined) return <Loading />;
  if (profile === null) return <Empty icon="account-question-outline" title="Profile not found" />;
  const isMe = id === session?.user.id;

  return (
    <FlatList
      style={ui.screen}
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      data={items}
      keyExtractor={(i) => i.id}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListHeaderComponent={
        <View style={s.header}>
          <Stack.Screen options={{ title: profile.team_name }} />
          <View style={s.avatar}>
            <MaterialCommunityIcons name={roleIcons[profile.role]} size={40} color="#fff" />
          </View>
          <Text style={[ui.h1, { textAlign: 'center' }]}>{profile.team_name}</Text>
          <Text style={[ui.muted, { marginTop: 4 }]}>{roleLabels[profile.role]}</Text>
          {isMe && (
            <Button title="Edit my account" variant="secondary" onPress={() => router.push('/account')} style={{ marginTop: 14, alignSelf: 'stretch' }} />
          )}
          <Text style={[ui.label, { alignSelf: 'flex-start', marginTop: 24 }]}>Shared with the community</Text>
        </View>
      }
      ListEmptyComponent={<Empty icon="package-variant" title="Nothing shared right now" />}
      renderItem={({ item }) => (
        <ItemRow
          photo={item.photo_url}
          name={item.name}
          specialty={item.specialty}
          status={<StatusPill text={`${item.qty_available} available`} tone="success" />}
          meta={`${CONDITION_LABELS[item.condition]} · ${item.category}`}
          onPress={() =>
            router.push(
              isMe
                ? { pathname: '/item/[id]', params: { id: item.id } }
                : { pathname: '/community/[id]', params: { id: item.id } },
            )
          }
        />
      )}
    />
  );
}

const s = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: 6 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
});
