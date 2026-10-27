import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius } from '@/lib/theme';
import { formatTime, nextTime, TIME_OPTIONS } from '@/lib/dates';

const ROW_H = 48;

/** A tappable time "pill" that opens a bottom-sheet list of half-hour times. */
function TimeSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (t: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const index = Math.max(0, options.indexOf(value));
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityLabel={`${label}: ${formatTime(value)}`}
        style={({ pressed }) => [s.pill, pressed && { opacity: 0.7 }]}
      >
        <Text style={s.pillLabel}>{label}</Text>
        <Text style={s.pillValue}>{formatTime(value)}</Text>
      </Pressable>
      <Modal transparent animationType="slide" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)} />
        <View style={s.sheet}>
          <Text style={s.sheetTitle}>{label} time</Text>
          <FlatList
            data={options}
            keyExtractor={(t) => t}
            initialScrollIndex={Math.max(0, index - 2)}
            getItemLayout={(_d, i) => ({ length: ROW_H, offset: ROW_H * i, index: i })}
            renderItem={({ item }) => {
              const on = item === value;
              return (
                <Pressable
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                  style={[s.option, on && s.optionOn]}
                >
                  <Text style={[s.optionText, on && { color: colors.primary, fontWeight: '800' }]}>{formatTime(item)}</Text>
                  {on && <MaterialCommunityIcons name="check" size={20} color={colors.primary} />}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

/** Start/end pickers. End is always kept after start. */
export function TimeRangeEditor({
  start,
  end,
  onChange,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}) {
  const startOptions = TIME_OPTIONS.slice(0, -1); // need room for an end time
  const endOptions = TIME_OPTIONS.filter((t) => t > start);
  return (
    <View style={s.range}>
      <TimeSelect
        label="From"
        value={start}
        options={startOptions}
        onChange={(t) => onChange(t, end > t ? end : (nextTime(t) ?? end))}
      />
      <Text style={s.dash}>–</Text>
      <TimeSelect label="To" value={end} options={endOptions} onChange={(t) => onChange(start, t)} />
    </View>
  );
}

const s = StyleSheet.create({
  range: { flexDirection: 'row', alignItems: 'center' },
  dash: { marginHorizontal: 8, fontSize: 18, color: colors.muted, fontWeight: '700' },
  pill: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  pillLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  pillValue: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: 16,
    paddingBottom: 28,
    maxHeight: '55%',
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: colors.text, paddingHorizontal: 20, marginBottom: 8 },
  option: {
    height: ROW_H,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionOn: { backgroundColor: colors.primarySoft },
  optionText: { fontSize: 17, color: colors.text },
});
