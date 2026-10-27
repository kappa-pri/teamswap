import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/lib/theme';
import { setSplit } from '@/lib/api';
import type { Item } from '@/lib/types';
import { Stepper } from './Stepper';
import { Button } from './ui';

/** Bottom sheet: pick how many in-use units to flag as available. */
export function FlagSheet({
  item,
  onClose,
  onSaved,
}: {
  item: Item | null;
  onClose: () => void;
  onSaved: (item: Item) => void;
}) {
  const [n, setN] = useState(1);
  const [saving, setSaving] = useState(false);

  if (!item) return null;
  const canFlag = item.qty_in_use;

  const save = async () => {
    setSaving(true);
    try {
      const updated = await setSplit(item, item.qty_available + n);
      onSaved(updated);
      onClose();
    } catch (e) {
      Alert.alert('Could not flag', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Flag “{item.name}” as available</Text>
        {canFlag === 0 ? (
          <Text style={styles.sub}>
            All {item.qty_total} units are already flagged or pending. Nothing left in use to flag.
          </Text>
        ) : (
          <>
            <Text style={styles.sub}>
              {item.qty_available} already available · {item.qty_in_use} in use
            </Text>
            <Stepper label="Units to flag" value={n} onChange={setN} min={1} max={canFlag} editable />
            <Text style={styles.preview}>
              Community will see {item.qty_available + n} / {item.qty_total} available
            </Text>
          </>
        )}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Button title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          {canFlag > 0 && (
            <Button title={`Flag ${n}`} variant="success" icon="flag-variant" onPress={save} loading={saving} style={{ flex: 1 }} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 20,
    paddingBottom: 36,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  sub: { fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: 8 },
  preview: { fontSize: 13, color: colors.success, fontWeight: '700', marginTop: 4 },
});
