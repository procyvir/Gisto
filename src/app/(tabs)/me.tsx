import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Avatar, Button, C, Card, s } from '../../components/ui';
import { deleteMyAccount } from '../../lib/api';
import { CONTACT_EMAIL, RANKS, rankOf } from '../../lib/constants';
import { useAuth } from '../../lib/auth';
import { auth } from '../../lib/firebase';

export default function Me() {
  const { profile } = useAuth();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!profile) return null;
  const r = rankOf(profile.credits);

  const doDelete = async () => {
    setBusy(true);
    setErr('');
    try {
      await deleteMyAccount();
      await signOut(auth);
    } catch {
      setErr('Could not delete your account. Check your connection and try again.');
      setBusy(false);
    }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 30 }}>
      <Card style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <Avatar name={profile.username} size={52} />
        <View>
          <Text style={s.h1}>{profile.username}</Text>
          <Text style={s.sub}>
            {profile.city}
            {profile.createdAt ? ` · since ${profile.createdAt.toDate().toLocaleDateString()}` : ''}
          </Text>
        </View>
      </Card>

      <Card>
        <Text style={s.sub}>Credits</Text>
        <Text style={{ color: C.text, fontSize: 30, fontWeight: '800' }}>🪙 {profile.credits}</Text>
        <View style={{ height: 8, backgroundColor: '#0c150f', borderRadius: 99, overflow: 'hidden', marginVertical: 8 }}>
          <View style={{ width: `${Math.round(r.progress * 100)}%`, height: '100%', backgroundColor: C.accent }} />
        </View>
        <Text style={s.sub}>
          {r.next ? `${r.next[1] - profile.credits} more to reach ${r.next[0]}` : 'Top rank reached 👑'}
        </Text>
      </Card>

      <Card>
        <Text style={[s.title, { marginBottom: 6 }]}>Ranks</Text>
        {RANKS.map(([name, min], i) => (
          <View key={name} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={{ color: i === r.index ? C.gold : C.text, fontWeight: i === r.index ? '700' : '400' }}>
              {i <= r.index ? '✅' : '🔒'} {name}
            </Text>
            <Text style={s.sub}>{min}</Text>
          </View>
        ))}
        <Text style={[s.sub, { marginTop: 8 }]}>
          Earn credits: message +2 (up to 100 a day), new buddy +5, daily login +10.
        </Text>
      </Card>

      <Card>
        <Text style={s.title}>Stats</Text>
        <Text style={[s.sub, { marginTop: 6 }]}>Messages sent: {profile.msgsSent}</Text>
      </Card>

      <View style={{ paddingHorizontal: 14, marginTop: 6 }}>
        <Button title="Blocked users" ghost onPress={() => router.push('/blocked')} />
        <Button title="Community rules & terms" ghost onPress={() => router.push('/terms')} />
        <Text style={[s.sub, { textAlign: 'center', marginTop: 10 }]}>Support: {CONTACT_EMAIL}</Text>
        <Button title="Sign out" onPress={() => signOut(auth)} />
        {!confirmDelete ? (
          <Button title="Delete my account" ghost danger onPress={() => setConfirmDelete(true)} />
        ) : (
          <Card style={{ marginHorizontal: 0 }}>
            <Text style={s.body}>
              This permanently deletes your profile, credits, buddies and login. Messages you sent will show as
              "Deleted user". This cannot be undone.
            </Text>
            <Button title="Yes, delete permanently" danger loading={busy} onPress={doDelete} />
            <Button title="Cancel" ghost onPress={() => setConfirmDelete(false)} />
            <Text style={s.error}>{err}</Text>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}
