import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Message } from '../lib/api';
import { MAX_MESSAGE } from '../lib/filter';
import { C, colorFor } from './ui';

type Props = {
  messages: Message[];
  myUid: string;
  blocked: string[];
  showNames: boolean; // rooms show sender names; private chats don't
  onSend: (text: string) => Promise<void>;
  placeholder: string;
  header?: React.ReactNode;
  where?: string; // e.g. "room:lagos", passed to the profile screen for reports
};

const fmt = (m: Message) =>
  m.createdAt ? m.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'sending…';

export function ChatView({ messages, myUid, blocked, showNames, onSend, placeholder, header, where }: Props) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const list = useRef<FlatList<Message>>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const visible = messages.filter((m) => !blocked.includes(m.uid));

  useEffect(() => {
    const t = setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [visible.length]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    setErr('');
    try {
      await onSend(t);
    } catch (e) {
      setText(t);
      setErr('Message not sent. Check your connection and try again.');
    }
  };

  const openUser = (m: Message) =>
    router.push({ pathname: '/user/[uid]', params: { uid: m.uid, msgId: m.id, msgText: m.text, where: where ?? '' } });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {header}
      <FlatList
        ref={list}
        data={visible}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12, gap: 6 }}
        ListEmptyComponent={<Text style={st.empty}>No messages yet. Say hi 👋</Text>}
        renderItem={({ item: m }) => {
          const mine = m.uid === myUid;
          return (
            <Pressable
              onLongPress={() => !mine && openUser(m)}
              style={[st.msg, mine ? st.me : st.them]}
            >
              {showNames && !mine && (
                <Text onPress={() => openUser(m)} style={[st.who, { color: colorFor(m.username) }]}>
                  {m.username}
                </Text>
              )}
              <Text style={st.text}>{m.text}</Text>
              <Text style={st.time}>{fmt(m)}</Text>
            </Pressable>
          );
        }}
      />
      {!!err && <Text style={st.err}>{err}</Text>}
      <View style={[st.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={C.muted}
          maxLength={MAX_MESSAGE}
          style={st.input}
          multiline
        />
        <Pressable accessibilityRole="button" onPress={send} style={st.send}>
          <Text style={{ color: '#04210f', fontWeight: '800' }}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  msg: { maxWidth: '80%', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12 },
  me: { backgroundColor: C.me, alignSelf: 'flex-end', borderBottomRightRadius: 3 },
  them: { backgroundColor: C.them, alignSelf: 'flex-start', borderBottomLeftRadius: 3 },
  who: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  text: { color: C.text, fontSize: 15, lineHeight: 20 },
  time: { color: '#b9d3c3', opacity: 0.7, fontSize: 10, textAlign: 'right', marginTop: 2 },
  empty: { color: C.muted, textAlign: 'center', marginTop: 40 },
  err: { color: C.danger, fontSize: 12, paddingHorizontal: 14, paddingBottom: 4 },
  bar: { flexDirection: 'row', gap: 8, paddingHorizontal: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.panel },
  input: { flex: 1, backgroundColor: C.card, borderColor: C.line, borderWidth: 1, color: C.text, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, maxHeight: 110 },
  send: { backgroundColor: C.accent, borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center' },
});
