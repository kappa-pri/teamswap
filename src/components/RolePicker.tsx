import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, roleIcons, roleLabels } from '@/lib/theme';
import { ROLES, type Role } from '@/lib/types';

export function RolePicker({ value, onChange }: { value: Role | null; onChange: (r: Role) => void }) {
  return (
    <View style={styles.grid}>
      {ROLES.map((r) => {
        const on = value === r;
        return (
          <Pressable
            key={r}
            onPress={() => onChange(r)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={[styles.card, on && styles.on]}
          >
            <MaterialCommunityIcons name={roleIcons[r]} size={28} color={on ? '#fff' : colors.primary} />
            <Text style={[styles.text, on && { color: '#fff' }]}>{roleLabels[r]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 14 },
  card: {
    width: '48.5%',
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  on: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { marginTop: 6, fontSize: 14, fontWeight: '700', color: colors.text },
});
