import { useState, type ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, specialtyColors, specialtyLabels } from '@/lib/theme';
import { formatDate, todayISO } from '@/lib/dates';
import { SPECIALTIES, type Specialty, type WishlistInput } from '@/lib/types';
import { Button, Card, Chip, Field, Label, styles as ui } from './ui';
import { Stepper } from './Stepper';
import { Calendar } from './Calendar';

export function WishlistForm({
  initial,
  submitLabel,
  onSubmit,
  footer,
}: {
  initial?: WishlistInput;
  submitLabel: string;
  onSubmit: (input: WishlistInput) => Promise<void>;
  footer?: ReactNode;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [specialty, setSpecialty] = useState<Specialty>(initial?.specialty ?? 'robotics');
  const [qty, setQty] = useState(initial?.qty_needed ?? 1);
  const [needBy, setNeedBy] = useState<string | null>(initial?.need_by ?? null);
  const [urgent, setUrgent] = useState(initial?.urgent ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return Alert.alert('Name needed', 'What part are you looking for?');
    if (!needBy) return Alert.alert('Need-by date needed', 'Pick the latest date you need it by.');
    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), specialty, qty_needed: qty, need_by: needBy, urgent, notes: notes.trim() });
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={ui.screen}>
      <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled">
        <Field
          label="Item name"
          placeholder="e.g. NEO brushless motor"
          value={name}
          onChangeText={setName}
          maxLength={80}
        />
        <Text style={[ui.muted, { fontSize: 12, marginTop: -8, marginBottom: 14 }]}>
          Matches are other teams’ items whose name contains all of these words. Tag, condition and quantity don’t affect matches.
        </Text>

        <Label>Specialty tag</Label>
        <View style={s.wrap}>
          {SPECIALTIES.map((t) => (
            <Chip
              key={t}
              label={specialtyLabels[t]}
              selected={specialty === t}
              color={specialtyColors[t]}
              onPress={() => setSpecialty(t)}
            />
          ))}
        </View>

        <Card style={{ paddingVertical: 4, marginBottom: 14 }}>
          <Stepper label="Quantity needed" value={qty} onChange={setQty} min={1} max={9999} editable />
        </Card>

        <Label>Need by</Label>
        <Text style={[ui.muted, { marginTop: -2, marginBottom: 8 }]}>
          {needBy ? `Latest date: ${formatDate(needBy)}` : 'The latest date you need it by.'}
        </Text>
        <Calendar value={needBy} onChange={setNeedBy} minDate={todayISO()} />

        <View style={[s.urgentRow, urgent && s.urgentOn]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={22} color={urgent ? colors.danger : colors.muted} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.urgentTitle}>Mark as urgent</Text>
            <Text style={ui.muted}>Shows an urgent badge and sorts to the top.</Text>
          </View>
          <Switch
            value={urgent}
            onValueChange={setUrgent}
            trackColor={{ true: colors.danger, false: colors.border }}
            accessibilityLabel="Mark as urgent"
          />
        </View>

        <Field label="Notes (optional)" placeholder="Specs, alternatives that would work…" value={notes} onChangeText={setNotes} multiline maxLength={1000} />

        <Button title={submitLabel} onPress={submit} loading={busy} />
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  urgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 14,
  },
  urgentOn: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  urgentTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
});
