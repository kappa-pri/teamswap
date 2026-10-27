import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, roleIcons, roleLabels } from '@/lib/theme';
import type { Role } from '@/lib/types';

export function RoleBadge({ role, showLabel = false }: { role: Role; showLabel?: boolean }) {
  return (
    <View style={styles.badge} accessibilityLabel={roleLabels[role]}>
      <MaterialCommunityIcons name={roleIcons[role]} size={14} color={colors.primary} />
      {showLabel && <Text style={styles.text}>{roleLabels[role]}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: 'center',
  },
  text: { fontSize: 12, fontWeight: '700', color: colors.primary, marginLeft: 4 },
});
