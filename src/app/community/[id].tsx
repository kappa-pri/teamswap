import { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchItem } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, radius } from '@/lib/theme';
import { CONDITION_LABELS, type Item } from '@/lib/types';
import { Button, Empty, InfoBox, Loading, styles as ui } from '@/components/ui';
import { FlagBadge } from '@/components/FlagBadge';
import { RoleBadge } from '@/components/RoleBadge';

export default function TheirItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [item, setItem] = useState<Item | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      fetchItem(id).then(setItem, () => setItem(null));
    }, [id]),
  );

  if (item === undefined) return <Loading />;
  if (item === null) return <Empty icon="alert-circle-outline" title="Item not found" body="It may have been removed." />;

  const mine = item.owner_id === session?.user.id;
  const canRequest = !mine && item.qty_available > 0;

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.scroll}>
      <Stack.Screen options={{ title: item.name }} />

      <InfoBox label="Owner" onPress={() => router.push({ pathname: '/profile/[id]', params: { id: item.owner_id } })}>
        <View style={s.ownerRow}>
          <Text style={s.ownerName} numberOfLines={1}>
            {item.owner?.team_name ?? 'Unknown team'}
          </Text>
          {item.owner && <RoleBadge role={item.owner.role} showLabel />}
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.faint} style={{ marginLeft: 'auto' }} />
        </View>
      </InfoBox>

      {item.photo_url ? (
        <Image source={{ uri: item.photo_url }} style={s.photo} />
      ) : (
        <View style={[s.photo, s.noPhoto]}>
          <MaterialCommunityIcons name="image-off-outline" size={40} color={colors.faint} />
        </View>
      )}

      <View style={s.titleRow}>
        <Text style={[ui.h1, { flexShrink: 1, marginRight: 10 }]}>{item.name}</Text>
        <FlagBadge specialty={item.specialty} />
      </View>
      <Text style={[ui.muted, { marginBottom: 16 }]}>
        {CONDITION_LABELS[item.condition]} condition · {item.category}
      </Text>

      <InfoBox label="Quantity available">
        <Text style={s.qty}>
          {item.qty_available} <Text style={ui.muted}>/ {item.qty_total} total</Text>
        </Text>
      </InfoBox>
      <InfoBox label="Notes">{item.notes || 'No notes from the owner.'}</InfoBox>

      {mine ? (
        <Text style={[ui.muted, { textAlign: 'center', marginTop: 8 }]}>This is your item.</Text>
      ) : (
        <Button
          title={canRequest ? 'Request this item' : 'Nothing available right now'}
          icon="hand-extended-outline"
          disabled={!canRequest}
          onPress={() => router.push({ pathname: '/request/[itemId]', params: { itemId: item.id } })}
          style={{ marginTop: 8 }}
        />
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ownerName: { fontSize: 17, fontWeight: '800', color: colors.text, flexShrink: 1 },
  photo: { width: '100%', aspectRatio: 1, borderRadius: radius.lg, marginBottom: 16, backgroundColor: colors.card },
  noPhoto: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 },
  qty: { fontSize: 22, fontWeight: '800', color: colors.text },
});
