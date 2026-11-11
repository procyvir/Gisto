import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Button, C, GroupIcon, s } from '../../components/ui';
import { Group, isGroupUnread, watchGroups } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function Groups() {
  const { profile } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const me = profile!.uid;
  useEffect(() => watchGroups(me, setGroups), [me]);

  return (
    <FlatList
      style={s.screen}
      data={groups}
      keyExtractor={(g) => g.id}
      ListHeaderComponent={
        <View style={{ paddingHorizontal: 14, paddingBottom: 6 }}>
          <Button title="➕ New group" onPress={() => router.push('/group/new')} />
        </View>
      }
      ListEmptyComponent={
        <Text style={[s.sub, { padding: 14 }]}>
          No groups yet. Start one with your buddies: family, classmates, your football crew.
        </Text>
      }
      renderItem={({ item: g }) => {
        const unread = isGroupUnread(g, me);
        return (
          <Pressable style={s.row} onPress={() => router.push({ pathname: '/group/[id]', params: { id: g.id } })}>
            <GroupIcon name={g.name} />
            <View style={{ flex: 1 }}>
              <Text style={[s.title, unread && { color: C.accent }]}>{g.name}</Text>
              <Text style={s.sub} numberOfLines={1}>
                {g.lastText ?? `${g.members.length} members`}
              </Text>
            </View>
            {unread && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent }} />}
          </Pressable>
        );
      }}
    />
  );
}
