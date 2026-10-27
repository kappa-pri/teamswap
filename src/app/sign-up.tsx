import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { Role } from '@/lib/types';
import { Button, Field, Label, styles } from '@/components/ui';
import { RolePicker } from '@/components/RolePicker';

export default function SignUp() {
  const [teamName, setTeamName] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const valid = teamName.trim() && role && email.trim() && password.length >= 6;

  const submit = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { team_name: teamName.trim(), role, phone: phone.trim() } },
    });
    setBusy(false);
    if (error) return Alert.alert('Could not create account', error.message);
    if (!data.session) {
      Alert.alert(
        'Check your email',
        'Supabase sent a confirmation link. For development you can turn off "Confirm email" in Supabase → Authentication → Sign In / Providers → Email, then sign in.',
      );
    }
    // With a session, the root layout switches to the app automatically.
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Field label="Team / school name" placeholder="e.g. Team 4207" value={teamName} onChangeText={setTeamName} maxLength={60} />
        <Label>I am a…</Label>
        <RolePicker value={role} onChange={setRole} />
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
        <Text style={[styles.muted, { marginTop: -6, marginBottom: 14 }]}>
          Your phone and email are only shown to another team after you approve their request, or they approve yours.
        </Text>
        <Field label="Password (6+ characters)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
        <Button title="Create account" onPress={submit} loading={busy} disabled={!valid} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
