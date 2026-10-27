import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { useNotifications } from '@/lib/notifications';
import { colors } from '@/lib/theme';
import { Empty, Loading, styles as ui } from '@/components/ui';
import { NotificationRow } from '@/components/NotificationRow';

export default function Notifications() {
  const { items, unread, loaded, refresh, markRead, open } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  if (!loaded) return <Loading />;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () =>
            unread > 0 ? (
              <Pressable onPress={() => markRead()} hitSlop={10}>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}>Mark all read</Text>
              </Pressable>
            ) : null,
        }}
      />
      <FlatList
        style={ui.screen}
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          items.length > 0 ? (
            <Text style={[ui.muted, { marginBottom: 10 }]}>
              {unread > 0 ? `${unread} unread` : 'All caught up'}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <Empty
            icon="bell-outline"
            title="No notifications yet"
            body="You’ll hear about new requests, approvals and denials, and new wishlist matches here."
          />
        }
        ListFooterComponent={
          items.length > 0 ? (
            <Text style={[ui.muted, { fontSize: 12, textAlign: 'center', marginTop: 16 }]}>
              Notifications are kept for 90 days.
            </Text>
          ) : null
        }
        renderItem={({ item }) => <NotificationRow n={item} onPress={() => open(item)} />}
      />
    </>
  );
}
