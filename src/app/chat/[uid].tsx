import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChatView } from '../../components/ChatView';
import { Button, C, s } from '../../components/ui';
import {
  chatIdFor,
  getProfile,
  isOnline,
  markChatRead,
  Message,
  Profile,
  sendPrivateMessage,
  unblockUser,
  watchChatMessages,
} from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function ChatScreen() {
  const { uid: otherUid = '', username: passedName } = useLocalSearchParams<{ uid: string; username?: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const [other, setOther] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const chatId = profile ? chatIdFor(profile.uid, otherUid) : '';

  useEffect(() => {
    getProfile(otherUid).then(setOther).catch(() => setOther(null));
  }, [otherUid]);

  useEffect(() => {
    if (!chatId) return;
    return watchChatMessages(chatId, (m) => {
      setMessages(m);
      if (m.length && profile) markChatRead(chatId, profile.uid);
    });
  }, [chatId, profile?.uid]);

  if (!profile) return null;
  const name = other?.username ?? passedName ?? 'User';
  const iBlocked = profile.blocked?.includes(otherUid);

  return (
    <>
      <Stack.Screen
        options={{
          title: name,
          headerRight: () => (
            <Pressable onPress={() => router.push({ pathname: '/user/[uid]', params: { uid: otherUid } })} hitSlop={10}>
              <Text style={{ color: C.accent, fontSize: 22 }}>⋯</Text>
            </Pressable>
          ),
        }}
      />
      {iBlocked ? (
        <View style={[s.screen, { padding: 24 }]}>
          <Text style={s.body}>You blocked {name}. Unblock to see and send messages.</Text>
          <Button title="Unblock" onPress={() => unblockUser(profile.uid, otherUid)} />
        </View>
      ) : !other && !passedName ? (
        <View style={[s.screen, { padding: 24 }]}>
          <Text style={s.body}>This account no longer exists.</Text>
        </View>
      ) : (
        <ChatView
          messages={messages}
          myUid={profile.uid}
          blocked={[]}
          showNames={false}
          where={`chat:${chatId}`}
          placeholder="Type a message…"
          onSend={(t) => sendPrivateMessage(profile, { uid: otherUid, username: name }, t)}
          header={
            <View style={{ paddingVertical: 6, alignItems: 'center', backgroundColor: '#14211a' }}>
              <Text style={{ color: C.muted, fontSize: 11 }}>
                {isOnline(other) ? '🟢 Online now' : 'Offline · they will see it later'}
              </Text>
            </View>
          }
        />
      )}
    </>
  );
}
