import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, radius } from '@/lib/theme';
import { DAY_SHORT, formatWindow } from '@/lib/dates';
import type { AvailabilityWindows, TimeWindow } from '@/lib/types';
import { TimeRangeEditor } from './TimeRange';

export const DEFAULT_WINDOW: TimeWindow = { all_day: true };
const DEFAULT_RANGE = { start: '15:00', end: '18:00' };

/** For each selected day: an "All day" switch, or a from–to time window. */
export function AvailabilityTimesEditor({
  days,
  windows,
  onChange,
}: {
  days: number[];
  windows: AvailabilityWindows;
  onChange: (w: AvailabilityWindows) => void;
}) {
  if (days.length === 0) return null;
  const set = (d: number, w: TimeWindow) => onChange({ ...windows, [String(d)]: w });
  const first = windows[String(days[0])] ?? DEFAULT_WINDOW;

  return (
    <View style={s.card}>
      {days.map((d, i) => {
        const w = windows[String(d)] ?? DEFAULT_WINDOW;
        return (
          <View key={d} style={[s.row, i > 0 && s.divider]}>
            <View style={s.head}>
              <Text style={s.day}>{DAY_SHORT[d]}</Text>
              <Text style={s.allDay}>All day</Text>
              <Switch
                value={w.all_day}
                onValueChange={(on) => set(d, on ? { all_day: true } : { all_day: false, ...DEFAULT_RANGE })}
                trackColor={{ true: colors.primary, false: colors.border }}
                accessibilityLabel={`${DAY_SHORT[d]} all day`}
              />
            </View>
            {!w.all_day && (
              <View style={{ marginTop: 8 }}>
                <TimeRangeEditor
                  start={w.start}
                  end={w.end}
                  onChange={(start, end) => set(d, { all_day: false, start, end })}
                />
              </View>
            )}
          </View>
        );
      })}
      {days.length > 1 && (
        <Pressable
          onPress={() => onChange(Object.fromEntries(days.map((d) => [String(d), first])))}
          style={({ pressed }) => [s.copy, pressed && { opacity: 0.6 }]}
        >
          <Text style={s.copyText}>
            Use {DAY_SHORT[days[0]]}’s times ({formatWindow(first)}) for all days
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** Read-only list, e.g. "Mon · 3:00 PM – 6:00 PM". */
export function AvailabilityList({ days, windows }: { days: number[]; windows: AvailabilityWindows }) {
  if (days.length === 0) return null;
  return (
    <View style={s.card}>
      {days.map((d, i) => (
        <View key={d} style={[s.listRow, i > 0 && s.divider]}>
          <Text style={s.day}>{DAY_SHORT[d]}</Text>
          <Text style={s.listTime}>{formatWindow(windows?.[String(d)])}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  row: { paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  head: { flexDirection: 'row', alignItems: 'center' },
  day: { width: 48, fontSize: 15, fontWeight: '800', color: colors.text },
  allDay: { flex: 1, textAlign: 'right', marginRight: 8, fontSize: 14, color: colors.muted, fontWeight: '600' },
  copy: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },
  copyText: { color: colors.primary, fontWeight: '700', fontSize: 14, textAlign: 'center' },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  listTime: { fontSize: 15, color: colors.text, fontWeight: '600' },
});
