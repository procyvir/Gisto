import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Avatar, Button, s } from '../components/ui';
import { getProfile, unblockUser } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Blocked() {
  const { profile } = useAuth();
  const [names, setNames] = useState<Record<string, string>>({});
  const blocked = profile?.blocked ?? [];

  useEffect(() => {
    Promise.all(blocked.map(async (id) => [id, (await getProfile(id).catch(() => null))?.username ?? 'Deleted user'] as const)).then(
      (p) => setNames(Object.fromEntries(p))
    );
  }, [blocked.join(',')]);

  if (!profile) return null;
  return (
    <ScrollView style={s.screen}>
      {blocked.length === 0 && <Text style={[s.sub, { padding: 16 }]}>You haven't blocked anyone.</Text>}
      {blocked.map((id) => (
        <View key={id} style={s.row}>
          <Avatar name={names[id] ?? '?'} />
          <Text style={[s.title, { flex: 1 }]}>{names[id] ?? '…'}</Text>
          <Button title="Unblock" ghost onPress={() => unblockUser(profile.uid, id)} style={{ marginTop: 0, paddingHorizontal: 14, paddingVertical: 8 }} />
        </View>
      ))}
    </ScrollView>
  );
}
