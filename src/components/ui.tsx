import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius } from '@/lib/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = {
    primary: { bg: colors.primary, fg: '#fff', border: colors.primary },
    success: { bg: colors.success, fg: '#fff', border: colors.success },
    danger: { bg: colors.card, fg: colors.danger, border: colors.danger },
    secondary: { bg: colors.card, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: off ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon && <MaterialCommunityIcons name={icon} size={18} color={palette.fg} style={{ marginRight: 8 }} />}
          <Text style={[styles.buttonText, { color: palette.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label && <Label>{label}</Label>}
      <TextInput
        placeholderTextColor={colors.faint}
        {...props}
        style={[styles.input, props.multiline && { minHeight: 88, textAlignVertical: 'top' }, style]}
      />
    </View>
  );
}

/** A read-only bordered box, styled to match inputs (used for owner / qty / notes). */
export function InfoBox({
  label,
  children,
  onPress,
}: {
  label: string;
  children: ReactNode;
  onPress?: () => void;
}) {
  const body = (
    <View style={styles.infoBox}>
      <Text style={styles.infoLabel}>{label}</Text>
      {typeof children === 'string' ? <Text style={styles.infoText}>{children}</Text> : children}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({
  label,
  selected,
  onPress,
  color = colors.primary,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected ? { backgroundColor: color, borderColor: color } : { backgroundColor: colors.card },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? '#fff' : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Fab({ onPress, bottom = 24 }: { onPress: () => void; bottom?: number }) {
  return (
    <Pressable
      accessibilityLabel="Add item"
      onPress={onPress}
      style={({ pressed }) => [styles.fab, { bottom, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
    >
      <MaterialCommunityIcons name="plus" size={30} color="#fff" />
    </Pressable>
  );
}

export function DashedCallout({
  icon,
  title,
  subtitle,
  tone = 'primary',
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  tone?: 'primary' | 'success' | 'warning';
  onPress?: () => void;
}) {
  const c = { primary: colors.primary, success: colors.success, warning: colors.warning }[tone];
  const bg = { primary: colors.primarySoft, success: colors.successSoft, warning: colors.warningSoft }[tone];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.callout, { borderColor: c, backgroundColor: bg, opacity: pressed ? 0.8 : 1 }]}>
      <MaterialCommunityIcons name={icon} size={22} color={c} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.calloutTitle, { color: c }]}>{title}</Text>
        {subtitle ? <Text style={styles.calloutSub}>{subtitle}</Text> : null}
      </View>
      {onPress && <MaterialCommunityIcons name="chevron-right" size={22} color={c} />}
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

export function Empty({ icon, title, body }: { icon: IconName; title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <MaterialCommunityIcons name={icon} size={44} color={colors.faint} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
    </View>
  );
}

export function StatusPill({ text, tone }: { text: string; tone: 'muted' | 'primary' | 'success' | 'warning' | 'danger' }) {
  const map = {
    muted: [colors.bg, colors.muted],
    primary: [colors.primarySoft, colors.primary],
    success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning],
    danger: [colors.dangerSoft, colors.danger],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 48 },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  infoBox: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  infoLabel: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  infoText: { fontSize: 16, color: colors.text },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 12,
  },
  calloutTitle: { fontSize: 15, fontWeight: '700' },
  calloutSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  empty: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 12, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: colors.muted, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
  h1: { fontSize: 26, fontWeight: '800', color: colors.text },
  h2: { fontSize: 20, fontWeight: '800', color: colors.text },
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
  muted: { fontSize: 14, color: colors.muted },
  section: { marginTop: 18, marginBottom: 8 },
});
