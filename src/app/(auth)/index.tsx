import { Link, useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button, C, Input, s } from '../../components/ui';
import { auth } from '../../lib/firebase';
import { authError } from '../../lib/errors';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const go = async () => {
    setErr('');
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      setErr(authError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
        <Text style={{ fontSize: 48, fontWeight: '900', textAlign: 'center', color: C.text }}>
          <Text style={{ color: C.accent }}>G</Text>isto
        </Text>
        <Text style={{ color: C.muted, textAlign: 'center', marginBottom: 16 }}>
          Chat rooms, buddies and ranks.{'\n'}Built light for low data.
        </Text>
        <Input placeholder="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} />
        <Input placeholder="Password" secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} onSubmitEditing={go} />
        <Text style={s.error}>{err}</Text>
        <Button title="Sign in" onPress={go} loading={busy} />
        <Button title="Create a new account" ghost onPress={() => router.push('/sign-up')} />
        <View style={{ alignItems: 'center', marginTop: 12, gap: 10 }}>
          <Link href="/forgot" style={{ color: C.accent }}>Forgot password?</Link>
          <Link href="/terms" style={{ color: C.muted, fontSize: 12 }}>Community rules & terms</Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
