import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { ChatView } from '../../components/ChatView';
import { C } from '../../components/ui';
import { enterRoom, leaveRoom, Message, roomOnlineCount, sendRoomMessage, watchRoom } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { ROOMS } from '../../lib/constants';

export default function RoomScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const room = ROOMS.find((r) => r.id === id);
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [online, setOnline] = useState<number | null>(null);
  const uid = profile?.uid;

  useEffect(() => {
    if (!room) return;
    return watchRoom(room.id, setMessages);
  }, [room]);

  // Room presence: refresh every minute while the screen is open.
  useEffect(() => {
    if (!room || !uid) return;
    const ping = () => enterRoom(room.id, uid).then(() => roomOnlineCount(room.id)).then(setOnline);
    ping();
    const t = setInterval(ping, 60_000);
    return () => {
      clearInterval(t);
      leaveRoom(room.id, uid);
    };
  }, [room, uid]);

  if (!room || !profile) return <Text style={{ color: C.text, padding: 20 }}>Room not found.</Text>;

  return (
    <>
      <Stack.Screen options={{ title: `${room.icon} ${room.name}` }} />
      <ChatView
        messages={messages}
        myUid={profile.uid}
        blocked={profile.blocked ?? []}
        showNames
        where={`room:${room.id}`}
        placeholder="Message the room…"
        onSend={(t) => sendRoomMessage(room.id, profile, t)}
        header={
          <View style={{ paddingVertical: 6, alignItems: 'center', backgroundColor: '#14211a' }}>
            <Text style={{ color: C.muted, fontSize: 11 }}>
              {online !== null ? `${online} online · ` : ''}Tap a name to add, chat, block or report
            </Text>
          </View>
        }
      />
    </>
  );
}
