import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius } from '@/lib/theme';
import { DAY_LETTERS, monthTitle, parseISODate, toISODate, todayISO } from '@/lib/dates';

export interface CalendarMarker {
  date: string;
  color: string;
}

/**
 * Month calendar.
 * - `shadeWeekdays`: days of week (0=Sun…6=Sat) to shade, e.g. requester's available days
 * - selected date is outlined
 * - `markers`: small colored dots (e.g. the other party's suggestion)
 */
export function Calendar({
  value,
  onChange,
  minDate,
  shadeWeekdays = [],
  markers = [],
  disabled = false,
}: {
  value: string | null;
  onChange?: (date: string) => void;
  minDate?: string;
  shadeWeekdays?: number[];
  markers?: CalendarMarker[];
  disabled?: boolean;
}) {
  const start = parseISODate(value ?? minDate ?? todayISO());
  const [cursor, setCursor] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const today = todayISO();

  const weeks = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells: (string | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(toISODate(new Date(cursor.y, cursor.m, d)));
    while (cells.length % 7) cells.push(null);
    const rows: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cursor]);

  const move = (delta: number) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  return (
    <View style={[styles.wrap, disabled && { opacity: 0.6 }]}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => move(-1)} accessibilityLabel="Previous month">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{monthTitle(cursor.y, cursor.m)}</Text>
        <Pressable hitSlop={10} onPress={() => move(1)} accessibilityLabel="Next month">
          <MaterialCommunityIcons name="chevron-right" size={26} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.week}>
        {DAY_LETTERS.map((l, i) => (
          <Text key={i} style={[styles.dow, shadeWeekdays.includes(i) && { color: colors.primary }]}>
            {l}
          </Text>
        ))}
      </View>
      {weeks.map((row, ri) => (
        <View key={ri} style={styles.week}>
          {row.map((date, ci) => {
            if (!date) return <View key={ci} style={styles.cell} />;
            const blocked = disabled || (minDate ? date < minDate : false);
            const shaded = shadeWeekdays.includes(ci);
            const selected = date === value;
            const dots = markers.filter((mk) => mk.date === date);
            return (
              <Pressable
                key={ci}
                style={styles.cell}
                disabled={blocked || !onChange}
                onPress={() => onChange?.(date)}
                accessibilityLabel={date}
                accessibilityState={{ selected, disabled: blocked }}
              >
                <View
                  style={[
                    styles.day,
                    shaded && styles.shaded,
                    selected && styles.selected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      date === today && styles.todayText,
                      blocked && { color: colors.faint },
                      selected && { fontWeight: '800' },
                    ]}
                  >
                    {Number(date.slice(8))}
                  </Text>
                </View>
                <View style={styles.dots}>
                  {dots.map((d, i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: d.color }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, paddingHorizontal: 4 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  week: { flexDirection: 'row' },
  dow: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.muted, paddingVertical: 4 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  day: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  shaded: { backgroundColor: colors.shade },
  selected: { borderColor: colors.primary },
  dayText: { fontSize: 15, color: colors.text },
  todayText: { color: colors.primary, fontWeight: '800' },
  dots: { flexDirection: 'row', height: 6, marginTop: 1 },
  dot: { width: 5, height: 5, borderRadius: 3, marginHorizontal: 1 },
});
