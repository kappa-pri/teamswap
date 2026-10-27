import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { fetchHomeCounts, fetchMyWishlist } from '@/lib/api';
import { colors, radius, roleIcons } from '@/lib/theme';
import { DashedCallout, Fab, styles as ui } from '@/components/ui';
import { NotificationRow } from '@/components/NotificationRow';
import { useNotifications } from '@/lib/notifications';

const QUIPS = [
  'Got spare servos? Someone out there needs them.',
  'One team’s leftovers, another team’s season saver.',
  'Less hoarding, more building.',
  'Your parts bin called. It wants to make friends.',
  'Swap a part, save a build.',
  'Nothing says teamwork like a spare battery.',
  'Ready to clear out the workshop?',
];

type Counts = Awaited<ReturnType<typeof fetchHomeCounts>>;

export default function Home() {
  const { profile, refresh } = useAuth();
  const notifs = useNotifications();
  const refreshNotifs = notifs.refresh;
  const [counts, setCounts] = useState<Counts | null>(null);
  const [wish, setWish] = useState<{ total: number; urgent: number; matched: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const quip = useMemo(() => QUIPS[new Date().getDate() % QUIPS.length], []);

  const load = useCallback(async () => {
    // Each section loads on its own so one failure doesn't blank the rest.
    const [c, w] = await Promise.allSettled([fetchHomeCounts(), fetchMyWishlist()]);
    if (c.status === 'fulfilled') setCounts(c.value);
    if (w.status === 'fulfilled') {
      setWish({
        total: w.value.length,
        urgent: w.value.filter((e) => e.urgent).length,
        matched: w.value.filter((e) => e.match_count > 0).length,
      });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      refreshNotifs();
    }, [load, refreshNotifs]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), refresh(), refreshNotifs()]);
    setRefreshing(false);
  };

  const pendingTitle = !counts
    ? 'Requests'
    : counts.incomingPending > 0
      ? `${counts.incomingPending} request${counts.incomingPending === 1 ? '' : 's'} waiting on you`
      : 'No requests waiting on you';
  const pendingSub = counts
    ? [
        counts.outgoingPending > 0 && `${counts.outgoingPending} you sent still pending`,
        counts.activeExchanges > 0 && `${counts.activeExchanges} active exchange${counts.activeExchanges === 1 ? '' : 's'}`,
      ]
        .filter(Boolean)
        .join(' · ') || 'Tap to see all requests'
    : undefined;

  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={[ui.scroll, { paddingBottom: 120 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Top row: notifications widget (left) + smaller account widget (right) */}
        <View style={s.topRow}>
          <Pressable
            onPress={() => router.push('/notifications')}
            style={({ pressed }) => [s.widget, s.notifWidget, pressed && { opacity: 0.85 }]}
            accessibilityLabel={`Notifications, ${notifs.unread} unread`}
          >
            <View style={s.widgetHead}>
              <View>
                <MaterialCommunityIcons name={notifs.unread > 0 ? 'bell-ring' : 'bell-outline'} size={22} color={colors.text} />
                {notifs.unread > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{notifs.unread > 99 ? '99+' : notifs.unread}</Text>
                  </View>
                )}
              </View>
              <Text style={s.widgetTitle}>Notifications</Text>
              <Text style={s.seeAll}>See all</Text>
            </View>
            {notifs.items.length === 0 ? (
              <Text style={s.caughtUp}>{notifs.loaded ? 'You’re all caught up.' : 'Loading…'}</Text>
            ) : (
              notifs.items.slice(0, 3).map((n) => <NotificationRow key={n.id} n={n} compact onPress={() => notifs.open(n)} />)
            )}
          </Pressable>

          <Pressable
            onPress={() => router.push('/account')}
            style={({ pressed }) => [s.widget, s.accountWidget, pressed && { opacity: 0.85 }]}
            accessibilityLabel="My account"
          >
            <View style={s.avatar}>
              <MaterialCommunityIcons name={profile ? roleIcons[profile.role] : 'account'} size={26} color="#fff" />
            </View>
            <Text style={s.accountName} numberOfLines={2}>
              {profile?.team_name ?? 'Account'}
            </Text>
            <Text style={s.accountLabel}>Account</Text>
          </Pressable>
        </View>

        <View style={s.header}>
          <Text style={s.greeting}>Hey, {profile?.team_name ?? 'there'} 👋</Text>
          <Text style={s.quip}>{quip}</Text>
        </View>

        <EntryCard
          icon="package-variant-closed"
          title="My Inventory"
          subtitle="Track your parts and flag spares for others"
          color={colors.primary}
          onPress={() => router.push('/inventory')}
        />
        <EntryCard
          icon="compass-outline"
          title="Browse Community"
          subtitle="See what other teams have up for grabs"
          color="#0E9C9A"
          onPress={() => router.push('/community')}
        />
        <EntryCard
          icon="star-outline"
          title="My Wishlist"
          subtitle={
            !wish
              ? 'Parts your team needs'
              : wish.total === 0
                ? 'Nothing on your wishlist yet'
                : [
                    `${wish.total} entr${wish.total === 1 ? 'y' : 'ies'}`,
                    wish.urgent > 0 && `${wish.urgent} urgent`,
                    wish.matched > 0 ? `${wish.matched} with matches` : 'no matches yet',
                  ]
                    .filter(Boolean)
                    .join(' · ')
          }
          color="#CA8A04"
          onPress={() => router.push('/wishlist')}
        />
        <EntryCard
          icon="bookmark-multiple-outline"
          title="Saved Items"
          subtitle={
            counts
              ? counts.savedItems > 0
                ? `${counts.savedItems} bookmarked item${counts.savedItems === 1 ? '' : 's'}`
                : 'Nothing bookmarked yet'
              : 'Items you bookmarked from the feed'
          }
          color="#C2410C"
          onPress={() => router.push('/saved')}
        />

        <Text style={[ui.label, { marginTop: 20, marginBottom: 10 }]}>Status</Text>
        <DashedCallout
          icon="inbox-arrow-down-outline"
          title={pendingTitle}
          subtitle={pendingSub}
          tone={counts && counts.incomingPending > 0 ? 'warning' : 'primary'}
          onPress={() => router.push('/requests')}
        />
        <DashedCallout
          icon="flag-variant-outline"
          title={
            !counts
              ? 'Flagged as available'
              : counts.flaggedItems > 0
                ? `${counts.flaggedUnits} unit${counts.flaggedUnits === 1 ? '' : 's'} flagged across ${counts.flaggedItems} item${counts.flaggedItems === 1 ? '' : 's'}`
                : 'Nothing flagged as available yet'
          }
          subtitle={counts && counts.flaggedItems === 0 ? 'Swipe an item in My Inventory to share spares' : 'Visible to the community now'}
          tone="success"
          onPress={() => router.push({ pathname: '/inventory', params: { status: 'available' } })}
        />
      </ScrollView>
      <Fab onPress={() => router.push('/item/new')} bottom={36} />
    </SafeAreaView>
  );
}

function EntryCard({
  icon,
  title,
  subtitle,
  color,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.entry, { opacity: pressed ? 0.85 : 1 }]}>
      <View style={[s.entryIcon, { backgroundColor: color }]}>
        <MaterialCommunityIcons name={icon} size={28} color="#fff" />
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={s.entryTitle}>{title}</Text>
        <Text style={s.entrySub}>{subtitle}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={26} color={colors.faint} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  header: { marginBottom: 20 },
  topRow: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 18 },
  widget: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 12 },
  notifWidget: { flex: 1 },
  widgetHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  widgetTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text },
  seeAll: { fontSize: 13, fontWeight: '700', color: colors.primary },
  badge: { position: 'absolute', top: -6, right: -9, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.card },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  caughtUp: { fontSize: 13, color: colors.muted, paddingVertical: 6 },
  accountWidget: { width: 96, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  accountName: { fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'center' },
  accountLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  greeting: { fontSize: 28, fontWeight: '800', color: colors.text },
  quip: { fontSize: 15, color: colors.muted, marginTop: 4, lineHeight: 20 },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  entryIcon: { width: 54, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  entryTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  entrySub: { fontSize: 14, color: colors.muted, marginTop: 2 },
});
