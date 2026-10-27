import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius } from '@/lib/theme';
import { timeAgo } from '@/lib/dates';
import type { AppNotification, NotificationType } from '@/lib/types';

export const NOTIFICATION_ICONS: Record<
  NotificationType,
  { icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string; bg: string }
> = {
  request_received: { icon: 'inbox-arrow-down', color: colors.warning, bg: colors.warningSoft },
  request_approved: { icon: 'handshake', color: colors.success, bg: colors.successSoft },
  request_denied: { icon: 'close-circle-outline', color: colors.danger, bg: colors.dangerSoft },
  wishlist_match: { icon: 'star-check', color: '#CA8A04', bg: '#FEF7DC' },
  final_date_set: { icon: 'calendar-check', color: colors.primary, bg: colors.primarySoft },
  item_sent: { icon: 'truck-delivery-outline', color: colors.success, bg: colors.successSoft },
  item_received: { icon: 'package-variant-closed-check', color: colors.success, bg: colors.successSoft },
};

export function NotificationRow({
  n,
  onPress,
  compact = false,
}: {
  n: AppNotification;
  onPress: () => void;
  /** Smaller single-line style for the Home preview. */
  compact?: boolean;
}) {
  const meta = NOTIFICATION_ICONS[n.type];
  const unread = !n.read_at;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${n.title}. ${n.body}`}
      style={({ pressed }) => [compact ? s.compact : s.row, unread && !compact && s.unreadRow, pressed && { opacity: 0.7 }]}
    >
      <View style={[compact ? s.iconSm : s.icon, { backgroundColor: meta.bg }]}>
        <MaterialCommunityIcons name={meta.icon} size={compact ? 15 : 20} color={meta.color} />
      </View>
      <View style={{ flex: 1, marginLeft: compact ? 8 : 12 }}>
        <Text style={[compact ? s.titleSm : s.title, unread && s.bold]} numberOfLines={compact ? 1 : 2}>
          {n.title}
        </Text>
        {!compact && !!n.body && (
          <Text style={s.body} numberOfLines={2}>
            {n.body}
          </Text>
        )}
      </View>
      <View style={s.right}>
        <Text style={s.time}>{timeAgo(n.created_at)}</Text>
        {unread && <View style={s.dot} />}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  unreadRow: { backgroundColor: '#F4F7FF', borderColor: '#C9D6FB' },
  compact: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconSm: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, color: colors.text, fontWeight: '600' },
  titleSm: { fontSize: 13, color: colors.text },
  bold: { fontWeight: '800' },
  body: { fontSize: 13, color: colors.muted, marginTop: 2 },
  right: { alignItems: 'flex-end', marginLeft: 8, gap: 6 },
  time: { fontSize: 12, color: colors.faint },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
});
