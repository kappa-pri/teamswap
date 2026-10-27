import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius } from '@/lib/theme';
import { FlagBadge } from './FlagBadge';
import type { Item, Specialty } from '@/lib/types';
import { StatusPill } from './ui';

export function Thumb({ uri, size = 64 }: { uri: string | null; size?: number }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius.sm, backgroundColor: colors.bg }} />
  ) : (
    <View style={[styles.placeholder, { width: size, height: size }]}>
      <MaterialCommunityIcons name="cog-outline" size={size * 0.45} color={colors.faint} />
    </View>
  );
}

/** Shared list-card pattern for inventory, browse and profile lists. */
export function ItemRow({
  photo,
  name,
  specialty,
  status,
  meta,
  footer,
  right,
  onPress,
  onLongPress,
}: {
  photo: string | null;
  name: string;
  specialty: Specialty;
  status?: ReactNode;
  meta: string;
  footer?: ReactNode;
  /** Replaces the chevron, e.g. a bookmark button. */
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#FAFBFE' }]}
    >
      <Thumb uri={photo} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.badges}>
          <FlagBadge specialty={specialty} size="sm" />
          {status ? <View style={{ marginLeft: 8, flexDirection: 'row', gap: 6 }}>{status}</View> : null}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
        {footer}
      </View>
      {right ?? <MaterialCommunityIcons name="chevron-right" size={22} color={colors.faint} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholder: {
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, marginLeft: 12, marginRight: 4 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  badges: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  meta: { fontSize: 13, color: colors.muted },
});

export function ItemStatus({ item }: { item: Item }) {
  return (
    <>
      {item.qty_available > 0 && <StatusPill text={`${item.qty_available} available`} tone="success" />}
      {item.qty_pending > 0 && <StatusPill text={`${item.qty_pending} pending`} tone="warning" />}
      {item.qty_available === 0 && item.qty_pending === 0 && <StatusPill text="Not shared" tone="muted" />}
    </>
  );
}
