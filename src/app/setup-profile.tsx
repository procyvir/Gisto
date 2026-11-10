import { Link } from 'expo-router';
import { reload, sendEmailVerification, signOut } from 'firebase/auth';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, C, Input, s } from '../components/ui';
import { createProfile, USERNAME_RE } from '../lib/api';
import { CITIES } from '../lib/constants';
import { useAuth } from '../lib/auth';
import { auth } from '../lib/firebase';

export default function SetupProfile() {
  const { user } = useAuth();
  const [username, setUsername] = useState('');
  const [city, setCity] = useState(CITIES[0]);
  const [agreed, setAgreed] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [verified, setVerified] = useState(!!user?.emailVerified);
  const [info, setInfo] = useState('');

  const checkVerified = async () => {
    if (!user) return;
    setErr('');
    await reload(user).catch(() => {});
    if (user.emailVerified) {
      await user.getIdToken(true); // refresh token so security rules see email_verified
      setVerified(true);
    } else setErr("Not verified yet. Open the link in the email we sent, then tap again.");
  };

  const resend = async () => {
    if (!user) return;
    await sendEmailVerification(user).catch(() => {});
    setInfo(`Sent again to ${user.email}. Check spam too.`);
  };

  if (!verified)
    return (
      <ScrollView style={s.screen} contentContainerStyle={{ padding: 24, gap: 12 }}>
        <Text style={s.h1}>Check your email</Text>
        <Text style={s.body}>
          We sent a verification link to {user?.email}. Open it, then come back here. Verified accounts keep Gisto
          free of spam and fake profiles.
        </Text>
        <Text style={s.error}>{err}</Text>
        {!!info && <Text style={{ color: C.accent }}>{info}</Text>}
        <Button title="I've verified my email" onPress={checkVerified} />
        <Button title="Resend email" ghost onPress={resend} />
        <Button title="Sign out" ghost onPress={() => signOut(auth)} />
      </ScrollView>
    );

  const go = async () => {
    setErr('');
    const u = username.trim();
    if (!USERNAME_RE.test(u)) return setErr('Username: 3–16 letters, numbers, _ or .');
    if (!agreed) return setErr('Please accept the community rules to continue.');
    if (!user) return;
    setBusy(true);
    try {
      await createProfile(user.uid, u, city);
      // The auth provider sees the new profile and opens the app.
    } catch (e) {
      setErr((e as Error).message || 'Could not create profile. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
        <Text style={s.body}>Step 2 of 2: how people will see you.</Text>
        <Input placeholder="Username" autoCapitalize="none" autoCorrect={false} maxLength={16} value={username} onChangeText={setUsername} />
        <Text style={[s.sub, { marginTop: 6 }]}>Where are you?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CITIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCity(c)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 99,
                borderWidth: 1,
                borderColor: city === c ? C.accent : C.line,
                backgroundColor: city === c ? '#1f4a33' : C.card,
              }}
            >
              <Text style={{ color: C.text, fontSize: 13 }}>{c}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => setAgreed(!agreed)} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 10 }}>
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              borderWidth: 2,
              borderColor: C.accent,
              backgroundColor: agreed ? C.accent : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {agreed && <Text style={{ color: '#04210f', fontWeight: '900' }}>✓</Text>}
          </View>
          <Text style={[s.body, { flex: 1 }]}>
            I am 13 or older and agree to the{' '}
            <Link href="/terms" style={{ color: C.accent }}>community rules & terms</Link>. No harassment, hate or sexual content.
          </Text>
        </Pressable>
        <Text style={s.error}>{err}</Text>
        <Button title="Start chatting" onPress={go} loading={busy} />
        <Button title="Sign out" ghost onPress={() => signOut(auth)} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
