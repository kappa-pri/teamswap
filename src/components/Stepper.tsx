import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius } from '@/lib/theme';

/** Tap-precise +/- stepper. Optionally lets you type the number directly. */
export function Stepper({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  editable = false,
  readOnly = false,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange?: (n: number) => void;
  min?: number;
  max?: number;
  editable?: boolean;
  readOnly?: boolean;
}) {
  // Typing buffer; null when not editing so the shown value always follows `value`.
  const [text, setText] = useState<string | null>(null);

  const set = (n: number) => onChange?.(Math.max(min, Math.min(max, n)));
  const canDec = !readOnly && value > min;
  const canInc = !readOnly && value < max;

  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {readOnly ? (
        <View style={styles.readOnly}>
          <MaterialCommunityIcons name="lock-outline" size={14} color={colors.muted} />
          <Text style={styles.readOnlyValue}>{value}</Text>
        </View>
      ) : (
        <View style={styles.controls}>
          <Pressable
            accessibilityLabel={`Decrease ${label}`}
            hitSlop={8}
            disabled={!canDec}
            onPress={() => set(value - 1)}
            style={[styles.btn, !canDec && styles.btnOff]}
          >
            <MaterialCommunityIcons name="minus" size={22} color={canDec ? colors.text : colors.faint} />
          </Pressable>
          {editable ? (
            <TextInput
              value={text ?? String(value)}
              onFocus={() => setText(String(value))}
              onChangeText={(t) => setText(t.replace(/[^0-9]/g, ''))}
              onEndEditing={() => {
                const n = parseInt(text ?? '', 10);
                if (!Number.isNaN(n)) set(n);
                setText(null);
              }}
              keyboardType="number-pad"
              style={[styles.value, styles.valueInput]}
              selectTextOnFocus
            />
          ) : (
            <Text style={styles.value}>{value}</Text>
          )}
          <Pressable
            accessibilityLabel={`Increase ${label}`}
            hitSlop={8}
            disabled={!canInc}
            onPress={() => set(value + 1)}
            style={[styles.btn, !canInc && styles.btnOff]}
          >
            <MaterialCommunityIcons name="plus" size={22} color={canInc ? colors.text : colors.faint} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  label: { fontSize: 16, fontWeight: '600', color: colors.text },
  hint: { fontSize: 12, color: colors.muted, marginTop: 2 },
  controls: { flexDirection: 'row', alignItems: 'center' },
  btn: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOff: { backgroundColor: colors.bg },
  value: { minWidth: 52, textAlign: 'center', fontSize: 20, fontWeight: '800', color: colors.text },
  valueInput: {
    borderBottomWidth: 1.5,
    borderColor: colors.border,
    marginHorizontal: 6,
    paddingVertical: 2,
  },
  readOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 42,
  },
  readOnlyValue: { fontSize: 20, fontWeight: '800', color: colors.muted, marginLeft: 6 },
});
