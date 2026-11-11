import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { BuddyPicker } from '../../components/BuddyPicker';
import { Button, Input, s } from '../../components/ui';
import { createGroup, MAX_GROUP } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function NewGroup() {
  const { profile } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [people, setPeople] = useState<{ uid: string; username: string }[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!profile) return null;

  const go = async () => {
    setErr('');
    if (!name.trim()) return setErr('Give the group a name.');
    if (!people.length) return setErr('Pick at least one buddy.');
    if (people.length + 1 > MAX_GROUP) return setErr(`Groups can have up to ${MAX_GROUP} members.`);
    setBusy(true);
    try {
      const id = await createGroup(profile, name, people);
      router.replace({ pathname: '/group/[id]', params: { id } });
    } catch {
      setErr('Could not create the group. Check your connection and try again.');
      setBusy(false);
    }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 30 }}>
      <View style={{ padding: 14, gap: 8 }}>
        <Input placeholder="Group name (e.g. Class of 2015)" maxLength={40} value={name} onChangeText={setName} />
      </View>
      <Text style={s.section}>Add buddies ({people.length} selected)</Text>
      <BuddyPicker uid={profile.uid} selected={people} onChange={setPeople} />
      <View style={{ paddingHorizontal: 14 }}>
        <Text style={[s.error, { marginTop: 8 }]}>{err}</Text>
        <Button title="Create group" onPress={go} loading={busy} />
      </View>
    </ScrollView>
  );
}
