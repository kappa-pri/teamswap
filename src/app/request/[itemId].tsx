import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { fetchItem, submitRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, radius } from '@/lib/theme';
import { formatDate, todayISO } from '@/lib/dates';
import type { AvailabilityWindows, Item } from '@/lib/types';
import { Button, Empty, Field, Label, Loading, styles as ui } from '@/components/ui';
import { DayPicker } from '@/components/DayPicker';
import { AvailabilityTimesEditor, DEFAULT_WINDOW } from '@/components/AvailabilityTimes';
import { Calendar } from '@/components/Calendar';
import { FlagBadge } from '@/components/FlagBadge';

export default function RequestForm() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { contacts } = useAuth();
  const [item, setItem] = useState<Item | null | undefined>(undefined);
  const [qtyText, setQtyText] = useState('1');
  const [purpose, setPurpose] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [windows, setWindows] = useState<AvailabilityWindows>({});
  const [needBy, setNeedBy] = useState<string | null>(null);
  const [pickup, setPickup] = useState<string | null>(null);
  const [phone, setPhone] = useState(contacts?.phone ?? '');
  const [email, setEmail] = useState(contacts?.email ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchItem(itemId).then(setItem, () => setItem(null));
  }, [itemId]);

  if (item === undefined) return <Loading />;
  if (item === null) return <Empty icon="alert-circle-outline" title="Item not found" />;

  const max = item.qty_available;
  const qty = parseInt(qtyText, 10);
  const qtyValid = !Number.isNaN(qty) && qty >= 1 && qty <= max;
  const today = todayISO();

  const missing = [
    !qtyValid && `a quantity between 1 and ${max}`,
    !purpose.trim() && 'what it will be used for',
    days.length === 0 && 'at least one available day',
    !needBy && 'a need-by date',
    !pickup && 'a suggested pickup date',
    !phone.trim() && !email.trim() && 'a phone or email',
  ].filter(Boolean) as string[];

  const submit = async () => {
    if (missing.length) return Alert.alert('Almost there', `Please add ${missing.join(', ')}.`);
    setBusy(true);
    try {
      const id = await submitRequest({
        itemId: item.id,
        qty,
        purpose: purpose.trim(),
        availableDays: days,
        // Only selected days, each with a window (defaults to all day).
        availableWindows: Object.fromEntries(days.map((d) => [String(d), windows[String(d)] ?? DEFAULT_WINDOW])),
        needBy: needBy!,
        suggestedDate: pickup,
        phone: phone.trim(),
        email: email.trim(),
      });
      router.replace({ pathname: '/requests/[id]', params: { id } });
    } catch (e) {
      Alert.alert('Could not send request', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={ui.screen}>
      <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.itemRow}>
          <Text style={[ui.h2, { flexShrink: 1, marginRight: 10 }]}>{item.name}</Text>
          <FlagBadge specialty={item.specialty} size="sm" />
        </View>
        <Text style={[ui.muted, { marginBottom: 18 }]}>from {item.owner?.team_name}</Text>

        <Label>Quantity needed</Label>
        <View style={s.fraction}>
          <TextInput
            value={qtyText}
            onChangeText={(t) => setQtyText(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            selectTextOnFocus
            style={[s.qtyInput, !qtyValid && qtyText !== '' && { borderColor: colors.danger, color: colors.danger }]}
            accessibilityLabel="Quantity needed"
          />
          <Text style={s.fractionText}>/ {max} available</Text>
        </View>

        <Field
          label="What will this be used for?"
          placeholder="e.g. Replacing a burnt-out drive motor before regionals"
          value={purpose}
          onChangeText={setPurpose}
          multiline
        />

        <Label>Days you’re available</Label>
        <DayPicker value={days} onChange={setDays} />
        {days.length > 0 && (
          <Text style={[ui.muted, { marginTop: -6, marginBottom: 8 }]}>When are you free on those days?</Text>
        )}
        <AvailabilityTimesEditor days={days} windows={windows} onChange={setWindows} />

        <Label>Need it by</Label>
        <Calendar value={needBy} onChange={setNeedBy} minDate={today} />

        <Label>Suggested pickup date</Label>
        <Text style={[ui.muted, { marginTop: -2, marginBottom: 8 }]}>
          Shaded days match your available days. {pickup ? `Selected: ${formatDate(pickup)}` : ''}
        </Text>
        <Calendar
          value={pickup}
          onChange={setPickup}
          minDate={today}
          shadeWeekdays={days}
          markers={needBy ? [{ date: needBy, color: colors.danger }] : []}
        />
        {needBy && (
          <View style={[ui.row, { marginTop: -6, marginBottom: 14 }]}>
            <View style={s.legendDot} />
            <Text style={ui.muted}>Need-by date ({formatDate(needBy)})</Text>
          </View>
        )}
        {pickup && needBy && pickup > needBy && (
          <Text style={[s.warn]}>Heads up: this pickup date is after your need-by date.</Text>
        )}

        <Label>Contact info to share if approved</Label>
        <Text style={[ui.muted, { marginTop: -2, marginBottom: 8 }]}>
          Only shown to the owner once they approve.
        </Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="Phone"
          placeholderTextColor={colors.faint}
          keyboardType="phone-pad"
          style={[ui.input, { marginBottom: 10 }]}
        />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.faint}
          autoCapitalize="none"
          keyboardType="email-address"
          style={[ui.input, { marginBottom: 20 }]}
        />

        <Button title="Submit request" icon="send" onPress={submit} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  itemRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  fraction: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  qtyInput: {
    width: 80,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 8,
  },
  fractionText: { fontSize: 20, fontWeight: '700', color: colors.muted, marginLeft: 10 },
  legendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, marginRight: 6 },
  warn: { color: colors.warning, fontWeight: '600', marginTop: -6, marginBottom: 14 },
});
