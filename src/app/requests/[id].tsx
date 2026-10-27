import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchRequest, fetchRequestContacts } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, radius } from '@/lib/theme';
import { formatDate } from '@/lib/dates';
import type { ItemRequest, RequestContacts } from '@/lib/types';
import { Button, Empty, InfoBox, Label, Loading, styles as ui } from '@/components/ui';
import { ReviewRequest } from '@/components/ReviewRequest';
import { Exchange } from '@/components/Exchange';
import { DayPicker } from '@/components/DayPicker';
import { AvailabilityList } from '@/components/AvailabilityTimes';

export default function RequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const me = session?.user.id ?? '';
  const [req, setReq] = useState<ItemRequest | null | undefined>(undefined);
  const [contacts, setContacts] = useState<RequestContacts | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetchRequest(id);
      setReq(r);
      // RLS only returns contacts once approved; skip the call before then.
      if (r && (r.status === 'approved' || r.status === 'received')) {
        setContacts(await fetchRequestContacts(id));
      }
    } catch {
      setReq((prev) => prev ?? null);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (req === undefined) return <Loading />;
  if (req === null) return <Empty icon="alert-circle-outline" title="Request not found" />;

  const isOwner = req.owner_id === me;
  const title =
    req.status === 'approved' || req.status === 'received' ? 'Contact revealed' : isOwner ? 'Review request' : 'Your request';

  let body;
  if (req.status === 'pending' && isOwner) {
    body = <ReviewRequest request={req} onDecided={load} />;
  } else if (req.status === 'approved' || req.status === 'received') {
    body = <Exchange request={req} contacts={contacts} me={me} onChanged={load} />;
  } else if (req.status === 'pending') {
    body = <Waiting request={req} />;
  } else {
    body = <Denied request={req} isOwner={isOwner} />;
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      {body}
    </>
  );
}

function Summary({ request: r }: { request: ItemRequest }) {
  return (
    <>
      <InfoBox label="Item">{`${r.qty} × ${r.item_name}`}</InfoBox>
      <InfoBox label="What it’s for">{r.purpose || '—'}</InfoBox>
      <InfoBox label="Need by">{formatDate(r.need_by)}</InfoBox>
      <InfoBox label="Your suggested pickup">{formatDate(r.requester_suggested_date)}</InfoBox>
      <Label>Your available days</Label>
      <DayPicker value={r.available_days} />
      <AvailabilityList days={r.available_days} windows={r.available_windows} />
    </>
  );
}

function Waiting({ request: r }: { request: ItemRequest }) {
  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.scroll}>
      <View style={[s.state, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
        <MaterialCommunityIcons name="timer-sand" size={30} color={colors.primary} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.stateTitle}>Request sent</Text>
          <Text style={ui.muted}>
            Waiting for {r.owner?.team_name ?? 'the owner'} to approve or deny. Your contact info stays hidden until
            they approve.
          </Text>
        </View>
      </View>
      <Summary request={r} />
    </ScrollView>
  );
}

function Denied({ request: r, isOwner }: { request: ItemRequest; isOwner: boolean }) {
  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.scroll}>
      <View style={[s.state, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
        <MaterialCommunityIcons name="close-circle-outline" size={30} color={colors.danger} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.stateTitle}>{isOwner ? 'You declined this request' : 'Not this time'}</Text>
          <Text style={ui.muted}>
            {isOwner
              ? `The ${r.qty} unit${r.qty === 1 ? '' : 's'} went back to available.`
              : `${r.owner?.team_name ?? 'The owner'} couldn’t share ${r.item_name} right now. No contact info was shared.`}
          </Text>
        </View>
      </View>
      {!isOwner && (
        <>
          <Summary request={r} />
          <Button title="Browse other parts" icon="compass-outline" onPress={() => router.push('/community')} />
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  state: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 18,
  },
  stateTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 2 },
});
