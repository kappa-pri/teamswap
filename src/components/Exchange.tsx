import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { confirmFinalDate, markReceived, markSent, suggestPickupDate } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import { formatDate, formatRange, parseISODate, timeAgo, todayISO } from '@/lib/dates';
import type { ItemRequest, RequestContacts } from '@/lib/types';
import { Button, Card, Label, styles as ui } from './ui';
import { Calendar } from './Calendar';
import { RoleBadge } from './RoleBadge';
import { TimeRangeEditor } from './TimeRange';
import { AvailabilityList } from './AvailabilityTimes';

const OWNER_COLOR = '#8A4FE0';
const REQUESTER_COLOR = colors.primary;

/**
 * "Contact revealed" screen. Owner and requester each get their own version:
 * each has their own calendar to suggest a pickup date.
 */
export function Exchange({
  request: r,
  contacts,
  me,
  onChanged,
}: {
  request: ItemRequest;
  contacts: RequestContacts | null;
  me: string;
  onChanged: () => void;
}) {
  const isOwner = me === r.owner_id;
  const other = isOwner ? r.requester : r.owner;
  const otherId = isOwner ? r.requester_id : r.owner_id;
  const myDate = isOwner ? r.owner_suggested_date : r.requester_suggested_date;
  const theirDate = isOwner ? r.requester_suggested_date : r.owner_suggested_date;
  const [draft, setDraft] = useState<string | null>(null);
  const selected = draft ?? myDate;
  const [busy, setBusy] = useState<'date' | 'final' | 'received' | 'sent' | null>(null);
  const [dropDraft, setDropDraft] = useState<{ start: string; end: string } | null>(null);
  const savedDrop = r.dropoff_start && r.dropoff_end ? { start: r.dropoff_start, end: r.dropoff_end } : null;
  const drop = dropDraft ?? savedDrop ?? suggestedDropoff(r, selected);
  const done = r.status === 'received';

  const phone = isOwner ? contacts?.requester_phone : contacts?.owner_phone;
  const email = isOwner ? contacts?.requester_email : contacts?.owner_email;
  const myPhone = isOwner ? contacts?.owner_phone : contacts?.requester_phone;
  const myEmail = isOwner ? contacts?.owner_email : contacts?.requester_email;

  const run = async (kind: 'date' | 'final' | 'received' | 'sent', fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
      onChanged();
    } catch (e) {
      Alert.alert('Something went wrong', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pickDate = (d: string) => {
    setDraft(d);
    run('date', () => suggestPickupDate(r.id, d));
  };

  // Receiver only: closes the exchange and removes the units from the owner's inventory.
  const confirmReceived = () =>
    Alert.alert(
      'Mark as received?',
      `Only tap this once you have the item. It closes the exchange and removes ${r.qty} unit${r.qty === 1 ? '' : 's'} of “${r.item_name}” from ${r.owner?.team_name ?? 'the owner'}’s inventory.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark received', onPress: () => run('received', () => markReceived(r.id)) },
      ],
    );

  // Giver only: lets the receiver know it's on its way / handed off.
  const confirmSent = () =>
    Alert.alert('Mark as sent?', `${r.requester?.team_name ?? 'The requester'} will be notified that ${r.item_name} is on its way.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark sent', onPress: () => run('sent', () => markSent(r.id)) },
    ]);

  const ownerDate = r.owner_suggested_date;
  const requesterDate = r.requester_suggested_date;
  const bothSuggested = !!ownerDate && !!requesterDate;
  const agree = bothSuggested && ownerDate === requesterDate;
  const finalCandidate = selected;
  const dropText = savedDrop ? `Drop-off ${formatRange(savedDrop.start, savedDrop.end)}` : null;
  // Owner confirms date + window together; requester confirms the date only.
  const alreadyConfirmed =
    r.final_date === finalCandidate &&
    (!isOwner || (savedDrop?.start === drop.start && savedDrop?.end === drop.end));
  const confirmTitle = !finalCandidate
    ? 'Pick a date to confirm'
    : alreadyConfirmed
      ? `Final date confirmed · ${formatDate(finalCandidate)}`
      : isOwner
        ? `Confirm ${formatDate(finalCandidate)} · ${formatRange(drop.start, drop.end)}`
        : `Confirm final date · ${formatDate(finalCandidate)}`;

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.scroll}>
      <View style={[s.banner, done && { backgroundColor: colors.bg, borderColor: colors.border }]}>
        <MaterialCommunityIcons
          name={done ? 'check-decagram' : 'handshake-outline'}
          size={34}
          color={done ? colors.muted : colors.success}
        />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.bannerTitle}>{done ? 'Exchange complete' : 'Approved — it’s a match!'}</Text>
          <Text style={ui.muted}>
            {done
              ? `${r.qty} × ${r.item_name} received${r.final_date ? ` · ${formatDate(r.final_date)}` : ''}${dropText ? ` · ${dropText}` : ''}.`
              : isOwner
                ? `You approved ${r.qty} × ${r.item_name}. Contact info is now unlocked for both of you.`
                : `${r.owner?.team_name ?? 'The owner'} approved ${r.qty} × ${r.item_name}. Contact info is now unlocked.`}
          </Text>
        </View>
      </View>

      <Label>{isOwner ? 'Requester' : 'Owner'} contact</Label>
      <Card style={{ marginBottom: 16 }}>
        <Pressable
          onPress={() => router.push({ pathname: '/profile/[id]', params: { id: otherId } })}
          style={[ui.row, { gap: 8, marginBottom: 10 }]}
        >
          <Text style={s.otherName}>{other?.team_name ?? 'Unknown'}</Text>
          {other && <RoleBadge role={other.role} showLabel />}
        </Pressable>
        <ContactLine icon="phone-outline" value={phone} onPress={phone ? () => Linking.openURL(`tel:${phone}`) : undefined} />
        <ContactLine icon="email-outline" value={email} onPress={email ? () => Linking.openURL(`mailto:${email}`) : undefined} />
        <Text style={[ui.muted, { fontSize: 12, marginTop: 8 }]}>
          You shared: {[myPhone, myEmail].filter(Boolean).join(' · ') || 'nothing'}
        </Text>
      </Card>

      {r.final_date && (
        <View style={s.final}>
          <MaterialCommunityIcons name="calendar-check" size={24} color={colors.success} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={s.finalText}>Final pickup date: {formatDate(r.final_date)}</Text>
            <Text style={[s.finalSub, !dropText && { color: colors.warning }]}>
              {dropText ??
                (isOwner ? 'Add your drop-off window below and confirm again.' : 'Waiting for the owner to set a drop-off time.')}
            </Text>
          </View>
        </View>
      )}

      {!done && (
        <>
          <Label>Your suggested pickup date</Label>
          <Text style={[ui.muted, { marginTop: -2, marginBottom: 8 }]}>
            Shaded days are when the requester said they’re free. Tap a day to suggest it.
          </Text>
          <Calendar
            value={selected}
            onChange={pickDate}
            minDate={todayISO()}
            shadeWeekdays={r.available_days}
            markers={[
              { date: r.need_by, color: colors.danger },
              ...(theirDate ? [{ date: theirDate, color: isOwner ? REQUESTER_COLOR : OWNER_COLOR }] : []),
              ...(r.final_date ? [{ date: r.final_date, color: colors.success }] : []),
            ]}
          />
          <View style={[ui.row, { marginTop: -6, marginBottom: 14, columnGap: 14, rowGap: 6, flexWrap: 'wrap' }]}>
            <View style={ui.row}>
              <View style={[s.dot, { backgroundColor: colors.danger }]} />
              <Text style={ui.muted}>Need by {formatDate(r.need_by)}</Text>
            </View>
            {theirDate && (
              <View style={ui.row}>
                <View style={[s.dot, { backgroundColor: isOwner ? REQUESTER_COLOR : OWNER_COLOR }]} />
                <Text style={ui.muted}>{isOwner ? 'Requester' : 'Owner'}’s suggestion</Text>
              </View>
            )}
            {r.final_date && (
              <View style={ui.row}>
                <View style={[s.dot, { backgroundColor: colors.success }]} />
                <Text style={ui.muted}>Final date</Text>
              </View>
            )}
          </View>

          {isOwner && (
            <>
              <Label>Requester is free</Label>
              <AvailabilityList days={r.available_days} windows={r.available_windows} />
              <Label>Your drop-off window</Label>
              <Text style={[ui.muted, { marginTop: -2, marginBottom: 8 }]}>
                When you’ll drop the item off on the final date.
              </Text>
              <View style={{ marginBottom: 16 }}>
                <TimeRangeEditor start={drop.start} end={drop.end} onChange={(start, end) => setDropDraft({ start, end })} />
              </View>
            </>
          )}
        </>
      )}

      {bothSuggested ? (
        <>
          <View style={s.sideBySide}>
            <DateBox label="Owner suggested" date={ownerDate} color={OWNER_COLOR} mine={isOwner} />
            <DateBox label="Requester suggested" date={requesterDate} color={REQUESTER_COLOR} mine={!isOwner} />
          </View>
          <Text style={[ui.muted, { textAlign: 'center', marginBottom: 14 }]}>
            {agree
              ? 'You both picked the same day 🎉'
              : 'Dates differ — sort it out by phone or email, then confirm the final date.'}
          </Text>
        </>
      ) : (
        !done && (
          <Text style={[ui.muted, { textAlign: 'center', marginBottom: 14 }]}>
            {!theirDate
              ? `Waiting for ${other?.team_name ?? 'the other team'} to suggest a date.`
              : 'Pick a day above to suggest your own date.'}
          </Text>
        )
      )}

      {!done && (
        <>
          <Button
            title={confirmTitle}
            icon="calendar-check"
            variant="secondary"
            disabled={!finalCandidate || alreadyConfirmed || busy === 'date'}
            loading={busy === 'final'}
            onPress={() =>
              finalCandidate &&
              run('final', async () => {
                await confirmFinalDate(r.id, finalCandidate, isOwner ? drop : undefined);
                setDropDraft(null);
              })
            }
            style={{ marginBottom: 10 }}
          />
          {!isOwner && (
            <Text style={[ui.muted, { fontSize: 12, textAlign: 'center', marginTop: -4, marginBottom: 10 }]}>
              The owner adds the drop-off time when they confirm.
            </Text>
          )}
          {isOwner ? (
            <>
              <Button
                title={r.sent_at ? `Marked as sent ${sentAgo(r.sent_at)}` : 'Mark as sent'}
                icon={r.sent_at ? 'check' : 'truck-delivery-outline'}
                variant="success"
                disabled={!!r.sent_at}
                loading={busy === 'sent'}
                onPress={confirmSent}
              />
              <Text style={[ui.muted, { fontSize: 12, textAlign: 'center', marginTop: 8 }]}>
                {r.sent_at
                  ? `Waiting for ${r.requester?.team_name ?? 'the requester'} to mark it received. It leaves your inventory then.`
                  : 'Tap once you’ve sent or handed it off. It leaves your inventory when they mark it received.'}
              </Text>
            </>
          ) : (
            <>
              {r.sent_at && (
                <View style={s.sentNote}>
                  <MaterialCommunityIcons name="truck-check-outline" size={20} color={colors.success} />
                  <Text style={s.sentNoteText}>
                    {r.owner?.team_name ?? 'The owner'} marked this as sent {sentAgo(r.sent_at)}
                  </Text>
                </View>
              )}
              <Button
                title="Mark as received"
                icon="package-variant-closed-check"
                variant="success"
                loading={busy === 'received'}
                onPress={confirmReceived}
              />
              <Text style={[ui.muted, { fontSize: 12, textAlign: 'center', marginTop: 8 }]}>
                Tap once you have it. That completes the exchange.
              </Text>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function ContactLine({
  icon,
  value,
  onPress,
}: {
  icon: 'phone-outline' | 'email-outline';
  value?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[ui.row, { paddingVertical: 6 }]}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
      <Text style={[s.contact, !value && { color: colors.faint }]} selectable>
        {value || 'Not shared'}
      </Text>
    </Pressable>
  );
}

function DateBox({ label, date, color, mine }: { label: string; date: string | null; color: string; mine: boolean }) {
  return (
    <View style={[s.dateBox, { borderColor: color }]}>
      <Text style={[s.dateLabel, { color }]}>
        {label}
        {mine ? ' (you)' : ''}
      </Text>
      <Text style={s.dateValue}>{formatDate(date)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 18,
  },
  bannerTitle: { fontSize: 19, fontWeight: '800', color: colors.text, marginBottom: 2 },
  otherName: { fontSize: 20, fontWeight: '800', color: colors.text, flexShrink: 1 },
  contact: { fontSize: 17, color: colors.text, marginLeft: 10, fontWeight: '600' },
  final: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
  },
  finalText: { fontSize: 16, fontWeight: '800', color: colors.success },
  finalSub: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  sentNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 10,
  },
  sentNoteText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.success },
  sideBySide: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  dateBox: { flex: 1, borderWidth: 1.5, borderRadius: radius.md, padding: 12, backgroundColor: colors.card },
  dateLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  dateValue: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 4 },
});

/** Default drop-off: the requester's window for that weekday, else 3–5 PM. */
function suggestedDropoff(r: ItemRequest, date: string | null): { start: string; end: string } {
  const w = date ? r.available_windows?.[String(parseISODate(date).getDay())] : undefined;
  return w && !w.all_day ? { start: w.start, end: w.end } : { start: '15:00', end: '17:00' };
}

/** "just now", "5m ago", "2d ago", or "on Tue, Oct 14". */
function sentAgo(iso: string): string {
  const t = timeAgo(iso);
  if (t === 'now') return 'just now';
  return /^\d+[mhd]$/.test(t) ? `${t} ago` : `on ${t}`;
}
