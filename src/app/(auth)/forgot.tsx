import { sendPasswordResetEmail } from 'firebase/auth';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Button, C, Input, s } from '../../components/ui';
import { authError } from '../../lib/errors';
import { auth } from '../../lib/firebase';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMsg('If that email has an account, a reset link is on its way. Check your inbox and spam.');
    } catch (e) {
      setErr(authError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 24, gap: 12 }}>
      <Input placeholder="Your email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Text style={s.error}>{err}</Text>
      {!!msg && <Text style={{ color: C.accent }}>{msg}</Text>}
      <Button title="Send reset link" onPress={go} loading={busy} />
    </ScrollView>
  );
}
