import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { useAuth } from '@/lib/auth';
import { updateMyContacts, updateMyProfile } from '@/lib/api';
import type { Contacts, Profile, Role } from '@/lib/types';
import { Button, Empty, Field, Label, styles } from '@/components/ui';
import { RolePicker } from '@/components/RolePicker';

export default function Account() {
  const { profile, contacts, signOut } = useAuth();
  if (!profile || !contacts) {
    return (
      <>
        <Empty icon="cloud-off-outline" title="Couldn’t load your account" body="Check your connection and try again." />
        <Button title="Sign out" variant="danger" onPress={signOut} style={{ margin: 16 }} icon="logout" />
      </>
    );
  }
  return <AccountForm profile={profile} contacts={contacts} />;
}

function AccountForm({ profile, contacts }: { profile: Profile; contacts: Contacts }) {
  const { session, refresh, signOut } = useAuth();
  const [teamName, setTeamName] = useState(profile.team_name);
  const [role, setRole] = useState<Role>(profile.role);
  const [phone, setPhone] = useState(contacts.phone);
  const [email, setEmail] = useState(contacts.email);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!teamName.trim()) return;
    setBusy(true);
    try {
      await updateMyProfile({ team_name: teamName.trim(), role });
      await updateMyContacts({ phone: phone.trim(), email: email.trim() });
      await refresh();
      Alert.alert('Saved', 'Your account details are updated.');
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.muted, { marginBottom: 16 }]}>Signed in as {session?.user.email}</Text>
        <Field label="Team / school name" value={teamName} onChangeText={setTeamName} maxLength={60} />
        <Label>Role</Label>
        <RolePicker value={role} onChange={setRole} />
        <Label>Default contact info for requests</Label>
        <Field placeholder="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Button title="Save changes" onPress={save} loading={busy} disabled={!teamName.trim()} />
        <Button title="Sign out" variant="danger" onPress={signOut} style={{ marginTop: 24 }} icon="logout" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
