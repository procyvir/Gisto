import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChatView } from '../../components/ChatView';
import { C, s } from '../../components/ui';
import { Group, markGroupRead, Message, sendGroupMessage, watchGroup, watchGroupMessages } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function GroupChat() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const uid = profile?.uid;

  useEffect(() => watchGroup(id, setGroup), [id]);
  useEffect(() => {
    if (!id || !uid) return;
    return watchGroupMessages(id, (m) => {
      setMessages(m);
      if (m.length) markGroupRead(id, uid);
    });
  }, [id, uid]);

  if (!profile) return null;
  if (group === undefined) return <View style={s.screen} />;
  if (group === null || !group.members.includes(profile.uid))
    return (
      <View style={[s.screen, { padding: 24 }]}>
        <Stack.Screen options={{ title: 'Group' }} />
        <Text style={s.body}>You're not in this group any more.</Text>
      </View>
    );

  return (
    <>
      <Stack.Screen
        options={{
          title: group.name,
          headerRight: () => (
            <Pressable onPress={() => router.push({ pathname: '/group-info/[id]', params: { id } })} hitSlop={10}>
              <Text style={{ color: C.accent, fontSize: 22 }}>⋯</Text>
            </Pressable>
          ),
        }}
      />
      <ChatView
        messages={messages}
        myUid={profile.uid}
        blocked={profile.blocked ?? []}
        showNames
        where={`group:${id}`}
        placeholder="Message the group…"
        onSend={(t) => sendGroupMessage(id, profile, t)}
        header={
          <Pressable
            onPress={() => router.push({ pathname: '/group-info/[id]', params: { id } })}
            style={{ paddingVertical: 6, alignItems: 'center', backgroundColor: '#14211a' }}
          >
            <Text style={{ color: C.muted, fontSize: 11 }}>{group.members.length} members · tap for group info</Text>
          </Pressable>
        }
      />
    </>
  );
}
