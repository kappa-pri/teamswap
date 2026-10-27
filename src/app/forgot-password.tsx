import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button, Field, styles } from '@/components/ui';

/**
 * Two-step reset using the emailed code (no deep links, so it works in Expo Go):
 *   1. send a recovery email   2. enter the code + a new password
 * Requires the Supabase "Reset password" email template to include {{ .Token }}.
 */
export default function ForgotPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { setRecovering } = useAuth();
  const [email, setEmail] = useState(params.email ?? '');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);

  // If the user leaves after the code was accepted but before the new password
  // saved, sign them back out so the reset isn't half-finished.
  const pendingSignOut = useRef(false);
  useEffect(
    () => () => {
      if (pendingSignOut.current) supabase.auth.signOut();
      setRecovering(false);
    },
    [setRecovering],
  );

  const sendCode = async () => {
    const e = email.trim();
    if (!e) return Alert.alert('Email needed', 'Enter the email you signed up with.');
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(e);
    setBusy(false);
    if (error) return Alert.alert('Could not send code', error.message);
    setStep('code');
    Alert.alert('Check your email', `If ${e} has an account, a reset code is on its way.`);
  };

  const reset = async () => {
    if (!verified && !/^\d{6,10}$/.test(code.trim())) {
      return Alert.alert('Code needed', 'Enter the code from the email.');
    }
    if (password.length < 6) return Alert.alert('Password too short', 'Use at least 6 characters.');
    if (password !== confirm) return Alert.alert('Passwords don’t match', 'Type the same new password twice.');

    setBusy(true);
    try {
      if (!verified) {
        // Verifying signs the user in; keep this screen up until the password is saved.
        setRecovering(true);
        const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
        if (error) {
          setRecovering(false);
          throw error;
        }
        pendingSignOut.current = true;
        setVerified(true);
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      pendingSignOut.current = false;
      Alert.alert('Password updated', 'You’re signed in with your new password.');
      setRecovering(false); // root layout switches to the app
    } catch (e) {
      Alert.alert('Could not reset password', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {step === 'email' ? (
          <>
            <Text style={[styles.muted, { marginBottom: 16 }]}>
              Enter your account email and we’ll send you a code to reset your password.
            </Text>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <Button title="Send reset code" icon="email-fast-outline" onPress={sendCode} loading={busy} disabled={!email.trim()} />
          </>
        ) : (
          <>
            <Text style={[styles.muted, { marginBottom: 16 }]}>
              {verified
                ? 'Code accepted. Choose your new password.'
                : `Enter the code we emailed to ${email.trim()}, then choose a new password.`}
            </Text>
            {!verified && (
              <Field
                label="Reset code"
                value={code}
                onChangeText={(t) => setCode(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={10}
              />
            )}
            <Field
              label="New password (6+ characters)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />
            <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
            <Button title="Reset password" icon="lock-reset" onPress={reset} loading={busy} />
            {!verified && (
              <Button title="Send a new code" variant="ghost" onPress={sendCode} disabled={busy} style={{ marginTop: 8 }} />
            )}
          </>
        )}
        <Button title="Back to sign in" variant="ghost" onPress={() => router.back()} disabled={busy} style={{ marginTop: 8 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
