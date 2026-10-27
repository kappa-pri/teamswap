import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/lib/theme';
import { DAY_SHORT } from '@/lib/dates';

/** Sun–Sat multi-select day buttons. Pass no onChange for a read-only display. */
export function DayPicker({ value, onChange }: { value: number[]; onChange?: (days: number[]) => void }) {
  const toggle = (d: number) =>
    onChange?.(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort());
  return (
    <View style={styles.row}>
      {DAY_SHORT.map((label, d) => {
        const on = value.includes(d);
        return (
          <Pressable
            key={d}
            disabled={!onChange}
            onPress={() => toggle(d)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            style={[styles.day, on && styles.on]}
          >
            <Text style={[styles.text, on && styles.onText]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  day: {
    flex: 1,
    marginHorizontal: 2,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  on: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { fontSize: 13, fontWeight: '700', color: colors.text },
  onText: { color: '#fff' },
});
