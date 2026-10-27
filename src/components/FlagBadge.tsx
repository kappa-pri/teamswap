import { StyleSheet, Text, View } from 'react-native';
import { specialtyColors, specialtyLabels } from '@/lib/theme';
import type { Specialty } from '@/lib/types';

/**
 * Closed pennant badge: a short pole, then a solid flag body that tapers to a
 * single point (no notch), with the tag text inside the flag.
 */
export function FlagBadge({ specialty, size = 'md' }: { specialty: Specialty; size?: 'sm' | 'md' }) {
  const color = specialtyColors[specialty];
  const h = size === 'sm' ? 20 : 24;
  return (
    <View style={styles.wrap} accessibilityLabel={`${specialtyLabels[specialty]} tag`}>
      <View style={[styles.pole, { height: h + 6, backgroundColor: color }]} />
      <View style={[styles.body, { height: h, backgroundColor: color, paddingHorizontal: size === 'sm' ? 6 : 8 }]}>
        <Text style={[styles.text, { fontSize: size === 'sm' ? 11 : 12 }]} numberOfLines={1}>
          {specialtyLabels[specialty]}
        </Text>
      </View>
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: h / 2,
          borderBottomWidth: h / 2,
          borderLeftWidth: h / 2.2,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: color,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', alignSelf: 'flex-start' },
  pole: { width: 2.5, borderRadius: 2, marginRight: 1 },
  body: { justifyContent: 'center', borderTopLeftRadius: 2, borderBottomLeftRadius: 2 },
  text: { color: '#fff', fontWeight: '800', letterSpacing: 0.3 },
});
