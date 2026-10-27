import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, specialtyColors, specialtyLabels } from '@/lib/theme';
import { CATEGORIES, SPECIALTIES, type Specialty } from '@/lib/types';
import { Button, Chip, Label } from './ui';

export interface FeedFilters {
  query: string;
  specialty: Specialty | null;
  category: string | null;
}

export const NO_FILTERS: FeedFilters = { query: '', specialty: null, category: null };

export function countFilters(f: FeedFilters): number {
  return (f.query.trim() ? 1 : 0) + (f.specialty ? 1 : 0) + (f.category ? 1 : 0);
}

/** Bottom sheet for the feed's filter icon. Edits a draft; applies on "Show results". */
export function FeedFilterSheet({
  initial,
  onApply,
  onClose,
}: {
  initial: FeedFilters;
  onApply: (f: FeedFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>Filter feed</Text>
            <Pressable onPress={() => setDraft(NO_FILTERS)} hitSlop={10}>
              <Text style={s.clear}>Clear all</Text>
            </Pressable>
          </View>

          <View style={s.search}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.muted} />
            <TextInput
              value={draft.query}
              onChangeText={(query) => setDraft((d) => ({ ...d, query }))}
              placeholder="Search parts or teams"
              placeholderTextColor={colors.faint}
              style={s.searchInput}
              returnKeyType="search"
              onSubmitEditing={() => onApply(draft)}
            />
          </View>

          <Label>Specialty tag</Label>
          <View style={s.wrap}>
            <Chip label="All" selected={!draft.specialty} onPress={() => setDraft((d) => ({ ...d, specialty: null }))} />
            {SPECIALTIES.map((t) => (
              <Chip
                key={t}
                label={specialtyLabels[t]}
                color={specialtyColors[t]}
                selected={draft.specialty === t}
                onPress={() => setDraft((d) => ({ ...d, specialty: d.specialty === t ? null : t }))}
              />
            ))}
          </View>

          <Label>Category</Label>
          <View style={s.wrap}>
            <Chip label="Any" selected={!draft.category} onPress={() => setDraft((d) => ({ ...d, category: null }))} color={colors.text} />
            {CATEGORIES.map((c) => (
              <Chip
                key={c}
                label={c}
                color={colors.text}
                selected={draft.category === c}
                onPress={() => setDraft((d) => ({ ...d, category: d.category === c ? null : c }))}
              />
            ))}
          </View>

          <Button title="Show results" onPress={() => onApply(draft)} style={{ marginTop: 8 }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 20,
    paddingBottom: 36,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 19, fontWeight: '800', color: colors.text },
  clear: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchInput: { flex: 1, paddingVertical: 11, marginLeft: 6, fontSize: 16, color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
});
