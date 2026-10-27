import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { Button, Field, styles } from '@/components/ui';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) Alert.alert('Sign in failed', error.message);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.scroll, { flexGrow: 1, justifyContent: 'center' }]} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <MaterialCommunityIcons name="robot-industrial" size={56} color={colors.primary} />
            <Text style={[styles.h1, { marginTop: 8 }]}>TeamSwap</Text>
            <Text style={[styles.muted, { marginTop: 4, textAlign: 'center' }]}>
              Share spare parts between robotics, drone and Roboboat teams.
            </Text>
          </View>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
          <Link
            href={{ pathname: '/forgot-password', params: email.trim() ? { email: email.trim() } : {} }}
            style={{ color: colors.primary, fontWeight: '600', fontSize: 14, alignSelf: 'flex-end', marginTop: -6, marginBottom: 16 }}
          >
            Forgot password?
          </Link>
          <Button title="Sign in" onPress={signIn} loading={busy} disabled={!email || !password} />
          <View style={{ alignItems: 'center', marginTop: 20 }}>
            <Link href="/sign-up" style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}>
              New here? Create an account
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
