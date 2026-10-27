import { useState, type ReactNode } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { buildPhotoDraft, choosePhoto, uploadPhotoDraft, type PhotoDraft, type SourcePhoto } from '@/lib/photos';
import type { ItemInput } from '@/lib/api';
import { colors, radius, specialtyColors, specialtyLabels } from '@/lib/theme';
import {
  CATEGORIES,
  CONDITION_LABELS,
  CONDITIONS,
  SPECIALTIES,
  type Condition,
  type Item,
  type Specialty,
} from '@/lib/types';
import { Button, Card, Chip, Field, Label, styles as ui } from './ui';
import { Stepper } from './Stepper';
import { PhotoCropper } from './PhotoCropper';

export function ItemForm({
  initial,
  submitLabel,
  onSubmit,
  footer,
}: {
  initial?: Item;
  submitLabel: string;
  onSubmit: (input: ItemInput) => Promise<void>;
  footer?: ReactNode;
}) {
  const pending = initial?.qty_pending ?? 0;
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial?.photo_url ?? null);
  const [draft, setDraft] = useState<PhotoDraft | null>(null); // new photo, not yet uploaded
  const [cropping, setCropping] = useState<SourcePhoto | null>(null);
  const [cropBusy, setCropBusy] = useState(false);
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'Other');
  const [specialty, setSpecialty] = useState<Specialty>(initial?.specialty ?? 'robotics');
  const [condition, setCondition] = useState<Condition>(initial?.condition ?? 'good');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [total, setTotalRaw] = useState(initial?.qty_total ?? 1);
  const [available, setAvailableRaw] = useState(initial?.qty_available ?? 0);
  const [busy, setBusy] = useState(false);

  // in_use is always derived so in_use + available + pending = total holds.
  const free = total - pending;
  const inUse = free - available;

  const setTotal = (t: number) => {
    const nt = Math.max(pending, t);
    setTotalRaw(nt);
    setAvailableRaw((a) => Math.min(a, nt - pending));
  };
  const setAvailable = (a: number) => setAvailableRaw(Math.max(0, Math.min(free, a)));
  const setInUse = (u: number) => setAvailableRaw(free - Math.max(0, Math.min(free, u)));

  const pickPhoto = async () => {
    const src = await choosePhoto();
    if (src) setCropping(src);
  };

  const finishCrop = async (rect: Parameters<typeof buildPhotoDraft>[1]) => {
    if (!cropping) return;
    setCropBusy(true);
    try {
      const d = await buildPhotoDraft(cropping, rect);
      setDraft(d);
      setPhotoUrl(d.square.uri);
      setCropping(null);
    } catch (e) {
      Alert.alert('Could not crop photo', (e as Error).message);
    } finally {
      setCropBusy(false);
    }
  };

  const submit = async () => {
    if (!name.trim()) return Alert.alert('Name needed', 'Give the item a name.');
    if (total < 1 && !initial) return Alert.alert('Quantity needed', 'Total must be at least 1.');
    setBusy(true);
    try {
      const photos = draft
        ? await uploadPhotoDraft(draft)
        : { photo_url: initial?.photo_url ?? null, photo_full_url: initial?.photo_full_url ?? null };
      await onSubmit({
        name: name.trim(),
        ...photos,
        category,
        specialty,
        condition,
        notes: notes.trim(),
        qty_total: total,
        qty_in_use: inUse,
        qty_available: available,
      });
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={ui.screen}>
      {cropping && (
        <PhotoCropper photo={cropping} busy={cropBusy} onCancel={() => setCropping(null)} onDone={finishCrop} />
      )}
      <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={pickPhoto}
          style={[s.photo, photoUrl ? s.photoFilled : null]}
          accessibilityLabel="Take or upload photo"
        >
          {photoUrl ? (
            <>
              <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <View style={s.photoEdit}>
                <MaterialCommunityIcons name="camera-retake-outline" size={18} color="#fff" />
                <Text style={s.photoEditText}>Change</Text>
              </View>
            </>
          ) : (
            <>
              <MaterialCommunityIcons name="camera-plus-outline" size={40} color={colors.primary} />
              <Text style={s.photoText}>Tap to take/upload photo</Text>
            </>
          )}
        </Pressable>

        <Field label="Name" placeholder="e.g. NEO brushless motor" value={name} onChangeText={setName} maxLength={80} />

        <Label>Category</Label>
        <View style={s.wrap}>
          {CATEGORIES.map((c) => (
            <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>

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

        <Label>Condition</Label>
        <View style={s.wrap}>
          {CONDITIONS.map((c) => (
            <Chip key={c} label={CONDITION_LABELS[c]} selected={condition === c} onPress={() => setCondition(c)} />
          ))}
        </View>

        <Label>Quantity</Label>
        <Card style={{ paddingVertical: 6, marginBottom: 14 }}>
          <Stepper label="Total" value={total} onChange={setTotal} min={Math.max(pending, initial ? 0 : 1)} editable />
          <View style={s.divider} />
          <Stepper label="In use" hint="Kept by your team" value={inUse} onChange={setInUse} min={0} max={free} editable />
          <Stepper
            label="Available"
            hint="Flagged for the community"
            value={available}
            onChange={setAvailable}
            min={0}
            max={free}
            editable
          />
          <Stepper label="Pending" hint="Set by requests only" value={pending} readOnly />
          <Text style={s.sum}>
            {inUse} in use + {available} available + {pending} pending = {total} total
          </Text>
        </Card>

        <Field label="Notes" placeholder="Anything a borrower should know" value={notes} onChangeText={setNotes} multiline />

        <Button title={submitLabel} onPress={submit} loading={busy} />
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  photo: {
    height: 200,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 18,
  },
  // Photos are cropped square when picked, so preview them square: no extra zoom.
  photoFilled: {
    height: undefined,
    width: '100%',
    maxWidth: 360,
    aspectRatio: 1,
    alignSelf: 'center',
    borderStyle: 'solid',
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  photoText: { marginTop: 8, color: colors.primary, fontWeight: '700', fontSize: 15 },
  photoEdit: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  photoEditText: { color: '#fff', fontWeight: '700', marginLeft: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  sum: { fontSize: 12, color: colors.muted, textAlign: 'center', paddingVertical: 8 },
});
