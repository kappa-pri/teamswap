import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { AuthProvider, useAuth } from '@/lib/auth';
import { NotificationsProvider } from '@/lib/notifications';
import { isConfigured } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { Loading, styles } from '@/components/ui';

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <StatusBar style="dark" />
        <RootStack />
      </NotificationsProvider>
    </AuthProvider>
  );
}

function RootStack() {
  const { ready, session, recovering } = useAuth();
  // During a password reset the user is briefly signed in but must stay on the
  // reset screen until the new password is saved.
  const signedIn = !!session && !recovering;

  if (!isConfigured) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={styles.h2}>Supabase keys missing</Text>
        <Text style={[styles.muted, { textAlign: 'center', marginTop: 8 }]}>
          Copy .env.example to .env, add your project URL and anon/publishable key, then restart with
          {'\n'}npx expo start --clear
        </Text>
      </View>
    );
  }
  if (!ready) return <Loading />;

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
        <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="inventory/index" options={{ title: 'My Inventory' }} />
        <Stack.Screen name="item/new" options={{ title: 'Add Item', presentation: 'modal' }} />
        <Stack.Screen name="item/[id]/index" options={{ title: 'Item' }} />
        <Stack.Screen name="item/[id]/edit" options={{ title: 'Edit Item', presentation: 'modal' }} />
        <Stack.Screen name="community/index" options={{ headerShown: false }} />
        <Stack.Screen name="saved" options={{ title: 'Saved Items' }} />
        <Stack.Screen name="wishlist/index" options={{ title: 'My Wishlist' }} />
        <Stack.Screen name="wishlist/new" options={{ title: 'Add to Wishlist', presentation: 'modal' }} />
        <Stack.Screen name="wishlist/[id]/index" options={{ title: 'Matches' }} />
        <Stack.Screen name="wishlist/[id]/edit" options={{ title: 'Edit Wishlist Entry', presentation: 'modal' }} />
        <Stack.Screen name="community/[id]" options={{ title: 'Item' }} />
        <Stack.Screen name="request/[itemId]" options={{ title: 'Request Item' }} />
        <Stack.Screen name="requests/index" options={{ title: 'Requests' }} />
        <Stack.Screen name="requests/[id]" options={{ title: 'Request' }} />
        <Stack.Screen name="profile/[id]" options={{ title: 'Profile' }} />
        <Stack.Screen name="account" options={{ title: 'My Account' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      </Stack.Protected>
    </Stack>
  );
}
