import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { roleIcons, specialtyColors } from '@/lib/theme';
import { CONDITION_LABELS, type Item } from '@/lib/types';
import { FlagBadge } from './FlagBadge';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/**
 * One full-screen item in the community feed. Tapping the card opens Item
 * Detail (theirs); the right rail has profile, request and save.
 */
export function FeedCard({
  item,
  height,
  saved,
  bottomInset,
  showSwipeHint,
  onOpen,
  onProfile,
  onRequest,
  onToggleSave,
}: {
  item: Item;
  height: number;
  saved: boolean;
  bottomInset: number;
  showSwipeHint: boolean;
  onOpen: () => void;
  onProfile: () => void;
  onRequest: () => void;
  onToggleSave: () => void;
}) {
  const tint = specialtyColors[item.specialty];
  return (
    <Pressable onPress={onOpen} style={[s.card, { height }]} accessibilityLabel={`Open ${item.name}`}>
      {item.photo_url || item.photo_full_url ? (
        // Fill the screen from the uncropped photo (phone photos are already tall, so
        // little is cut). Older items without one fall back to the square crop.
        <Image source={{ uri: (item.photo_full_url ?? item.photo_url)! }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, s.noPhoto, { backgroundColor: tint }]}>
          <MaterialCommunityIcons name="cog-outline" size={120} color="rgba(255,255,255,0.35)" />
          <Text style={s.noPhotoText}>No photo yet</Text>
        </View>
      )}

      {/* Shade the top (for the bar) and bottom (for the text) so white text stays readable. */}
      <LinearGradient colors={['rgba(0,0,0,0.45)', 'transparent']} style={s.topShade} pointerEvents="none" />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.75)']}
        style={[s.bottomShade, { height: height * 0.45 }]}
        pointerEvents="none"
      />

      <View style={[s.info, { bottom: bottomInset + 24 }]} pointerEvents="none">
        <View style={s.titleRow}>
          <Text style={s.name} numberOfLines={2}>
            {item.name}
          </Text>
        </View>
        <FlagBadge specialty={item.specialty} />
        <Text style={s.meta}>
          {item.qty_available} available · {CONDITION_LABELS[item.condition]}
        </Text>
        <View style={s.ownerRow}>
          {item.owner && <MaterialCommunityIcons name={roleIcons[item.owner.role]} size={16} color="#fff" />}
          <Text style={s.owner} numberOfLines={1}>
            {item.owner?.team_name ?? 'Unknown team'}
          </Text>
        </View>
      </View>

      <View style={[s.rail, { bottom: bottomInset + 28 }]}>
        <RailButton icon="account-circle-outline" label="Profile" onPress={onProfile} />
        <RailButton icon="hand-extended-outline" label="Request" onPress={onRequest} />
        <RailButton
          icon={saved ? 'bookmark' : 'bookmark-outline'}
          label={saved ? 'Saved' : 'Save'}
          onPress={onToggleSave}
          active={saved}
        />
      </View>

      {showSwipeHint && (
        <View style={[s.hint, { bottom: bottomInset + 4 }]} pointerEvents="none">
          <MaterialCommunityIcons name="chevron-double-up" size={18} color="rgba(255,255,255,0.8)" />
          <Text style={s.hintText}>Swipe up for more</Text>
        </View>
      )}
    </Pressable>
  );
}

function RailButton({
  icon,
  label,
  onPress,
  active,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.railBtn, pressed && { transform: [{ scale: 0.92 }] }]}
    >
      <View style={[s.railIcon, active && s.railIconOn]}>
        <MaterialCommunityIcons name={icon} size={28} color={active ? '#FFD34D' : '#fff'} />
      </View>
      <Text style={s.railLabel}>{label}</Text>
    </Pressable>
  );
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } };

const s = StyleSheet.create({
  card: { width: '100%', backgroundColor: '#000', overflow: 'hidden' },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  noPhotoText: { color: 'rgba(255,255,255,0.7)', fontWeight: '700', marginTop: 8 },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 140 },
  bottomShade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  info: { position: 'absolute', left: 16, right: 96, gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 26, fontWeight: '900', color: '#fff', ...shadow },
  meta: { fontSize: 16, fontWeight: '700', color: '#fff', ...shadow },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  owner: { fontSize: 15, fontWeight: '700', color: '#fff', flexShrink: 1, ...shadow },
  rail: { position: 'absolute', right: 12, alignItems: 'center', gap: 18 },
  railBtn: { alignItems: 'center' },
  railIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  railIconOn: { backgroundColor: 'rgba(0,0,0,0.55)' },
  railLabel: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 4, ...shadow },
  hint: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  hintText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
});
