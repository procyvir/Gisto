import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { Button, Input, s } from '../../components/ui';
import { authError } from '../../lib/errors';
import { auth } from '../../lib/firebase';

// Step 1: email + password. Step 2 (username, city, terms) is /setup-profile,
// which also catches anyone whose profile creation was interrupted.
export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setErr('');
    if (password.length < 8) return setErr('Use at least 8 characters for your password.');
    if (password !== confirm) return setErr('Passwords do not match.');
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await sendEmailVerification(cred.user).catch(() => {});
    } catch (e) {
      setErr(authError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
        <Text style={s.body}>Step 1 of 2: your login details.</Text>
        <Input placeholder="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} />
        <Input placeholder="Password (8+ characters)" secureTextEntry autoComplete="new-password" value={password} onChangeText={setPassword} />
        <Input placeholder="Confirm password" secureTextEntry value={confirm} onChangeText={setConfirm} onSubmitEditing={go} />
        <Text style={s.error}>{err}</Text>
        <Button title="Continue" onPress={go} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
