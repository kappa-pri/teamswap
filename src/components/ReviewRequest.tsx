import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { decideRequest } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import { countdownLabel, daysUntil, formatDate } from '@/lib/dates';
import type { ItemRequest } from '@/lib/types';
import { Button, InfoBox, Label, styles as ui } from './ui';
import { RoleBadge } from './RoleBadge';
import { DayPicker } from './DayPicker';
import { AvailabilityList } from './AvailabilityTimes';
import { FlagBadge } from './FlagBadge';

/** Owner's approve / deny screen for a pending request. */
export function ReviewRequest({ request: r, onDecided }: { request: ItemRequest; onDecided: () => void }) {
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null);
  const left = daysUntil(r.need_by);
  const urgent = left <= 3;

  const decide = async (approve: boolean) => {
    setBusy(approve ? 'approve' : 'deny');
    try {
      await decideRequest(r.id, approve);
      onDecided();
    } catch (e) {
      Alert.alert('Something went wrong', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const confirmDeny = () =>
    Alert.alert('Deny this request?', `${r.qty} unit${r.qty === 1 ? '' : 's'} go back to available.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Deny', style: 'destructive', onPress: () => decide(false) },
    ]);

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.scroll}>
      <Text style={[ui.label, { marginBottom: 4 }]}>Request from</Text>
      <View style={s.nameRow}>
        <Pressable
          onPress={() => router.push({ pathname: '/profile/[id]', params: { id: r.requester_id } })}
          accessibilityRole="button"
          accessibilityHint="Opens this team’s profile"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, flexShrink: 1 })}
        >
          <Text style={s.name}>{r.requester?.team_name ?? 'Unknown team'}</Text>
        </Pressable>
        {r.requester && <RoleBadge role={r.requester.role} showLabel />}
      </View>

      <View style={[ui.row, { marginTop: 14, marginBottom: 14, gap: 8, flexWrap: 'wrap' }]}>
        <Text style={ui.muted}>For your</Text>
        <Text style={[ui.body, { fontWeight: '700' }]}>{r.item_name}</Text>
        {r.item && <FlagBadge specialty={r.item.specialty} size="sm" />}
      </View>

      <InfoBox label="Quantity requested">
        <Text style={s.qty}>
          {r.qty}
          {r.item ? <Text style={ui.muted}> of {r.item.qty_total} total</Text> : null}
        </Text>
      </InfoBox>
      <InfoBox label="What it’s for">{r.purpose || '—'}</InfoBox>

      <Label>Their available days</Label>
      <DayPicker value={r.available_days} />
      <AvailabilityList days={r.available_days} windows={r.available_windows} />

      <View style={[s.needBy, urgent ? s.needByUrgent : null]}>
        <MaterialCommunityIcons name="calendar-alert" size={28} color={urgent ? colors.danger : colors.warning} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={s.needByLabel}>Needed by {formatDate(r.need_by)}</Text>
          <Text style={[s.countdown, { color: urgent ? colors.danger : colors.warning }]}>{countdownLabel(r.need_by)}</Text>
        </View>
      </View>

      <Text style={[ui.muted, { marginBottom: 14, textAlign: 'center' }]}>
        Approving shares your contact info with them, and theirs with you.
      </Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="Deny" variant="danger" icon="close" onPress={confirmDeny} loading={busy === 'deny'} disabled={!!busy} style={{ flex: 1 }} />
        <Button title="Approve" variant="success" icon="check" onPress={() => decide(true)} loading={busy === 'approve'} disabled={!!busy} style={{ flex: 1 }} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  name: { fontSize: 30, fontWeight: '900', color: colors.text },
  qty: { fontSize: 22, fontWeight: '800', color: colors.text },
  needBy: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 16,
  },
  needByUrgent: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  needByLabel: { fontSize: 17, fontWeight: '800', color: colors.text },
  countdown: { fontSize: 15, fontWeight: '700', marginTop: 2 },
});
