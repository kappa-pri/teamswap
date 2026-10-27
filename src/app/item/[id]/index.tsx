import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchItem, fetchItemRequestCounts, setSplit } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, radius } from '@/lib/theme';
import { CONDITION_LABELS, type Item } from '@/lib/types';
import { Card, Empty, InfoBox, Loading, styles as ui } from '@/components/ui';
import { FlagBadge } from '@/components/FlagBadge';
import { Stepper } from '@/components/Stepper';

export default function MyItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [item, setItem] = useState<Item | null | undefined>(undefined);
  const [counts, setCounts] = useState({ pending: 0, approved: 0 });
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const [it, c] = await Promise.all([fetchItem(id), fetchItemRequestCounts(id)]);
      setItem(it);
      setCounts(c);
    } catch {
      setItem((prev) => prev ?? null);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const notMine = !!item && item.owner_id !== session?.user.id;
  useEffect(() => {
    // Someone else's item: show the community view instead.
    if (notMine) router.replace({ pathname: '/community/[id]', params: { id } });
  }, [notMine, id]);

  if (item === undefined || notMine) return <Loading />;
  if (item === null) return <Empty icon="alert-circle-outline" title="Item not found" />;

  const free = item.qty_total - item.qty_pending;

  // Live stepper: update immediately, persist after a short pause.
  const changeAvailable = (available: number) => {
    const a = Math.max(0, Math.min(free, available));
    const next = { ...item, qty_available: a, qty_in_use: free - a };
    setItem(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        setItem(await setSplit(next, a));
      } catch (e) {
        Alert.alert('Could not update', (e as Error).message);
        load();
      } finally {
        setSaving(false);
      }
    }, 500);
  };

  const openRequests = counts.pending + counts.approved;

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.scroll}>
      <Stack.Screen
        options={{
          title: item.name,
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/item/[id]/edit', params: { id: item.id } })}
              hitSlop={10}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '700', marginLeft: 4, fontSize: 16 }}>Edit</Text>
            </Pressable>
          ),
        }}
      />
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

      <Card style={{ paddingVertical: 6, marginBottom: 14 }}>
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total</Text>
          <Text style={s.totalValue}>{item.qty_total}</Text>
        </View>
        <View style={s.divider} />
        <Stepper
          label="In use"
          hint="Kept by your team"
          value={item.qty_in_use}
          min={0}
          max={free}
          onChange={(u) => changeAvailable(free - u)}
        />
        <Stepper
          label="Available"
          hint="Visible to the community"
          value={item.qty_available}
          min={0}
          max={free}
          onChange={changeAvailable}
        />
        <Stepper label="Pending" hint="Reserved by requests" value={item.qty_pending} readOnly />
        <Text style={s.saving}>{saving ? 'Saving…' : ' '}</Text>
      </Card>

      <InfoBox label="Notes">{item.notes || 'No notes yet.'}</InfoBox>

      <Pressable
        onPress={() => router.push({ pathname: '/requests', params: { itemId: item.id, itemName: item.name } })}
        style={({ pressed }) => [s.link, { opacity: pressed ? 0.8 : 1 }]}
      >
        <MaterialCommunityIcons name="inbox-arrow-down-outline" size={22} color={colors.primary} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.linkTitle}>Incoming requests for this item</Text>
          <Text style={ui.muted}>
            {openRequests === 0
              ? 'None open right now'
              : [counts.pending > 0 && `${counts.pending} waiting on you`, counts.approved > 0 && `${counts.approved} approved`]
                  .filter(Boolean)
                  .join(' · ')}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={colors.primary} />
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 1, borderRadius: radius.lg, marginBottom: 16, backgroundColor: colors.card },
  noPhoto: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: 20, fontWeight: '800', color: colors.text, marginRight: 42 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
  saving: { fontSize: 12, color: colors.muted, textAlign: 'right', paddingBottom: 4 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: 14,
  },
  linkTitle: { fontSize: 15, fontWeight: '700', color: colors.primary },
});
