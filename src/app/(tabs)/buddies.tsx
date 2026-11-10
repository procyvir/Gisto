import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Avatar, Button, C, Input, s } from '../../components/ui';
import { Chat, findUserByName, getProfile, isOnline, isUnread, Profile, watchBuddies, watchChats } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function Buddies() {
  const { profile } = useAuth();
  const router = useRouter();
  const [buddies, setBuddies] = useState<{ uid: string; username: string }[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [info, setInfo] = useState<Record<string, Profile | null>>({});
  const [search, setSearch] = useState('');
  const [searchErr, setSearchErr] = useState('');
  const me = profile!.uid;

  useEffect(() => watchBuddies(me, setBuddies), [me]);
  useEffect(() => watchChats(me, setChats), [me]);

  // Fetch buddies' profiles for online status (refreshes every minute).
  useEffect(() => {
    const load = () =>
      Promise.all(buddies.map(async (b) => [b.uid, await getProfile(b.uid).catch(() => null)] as const)).then((p) =>
        setInfo(Object.fromEntries(p))
      );
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [buddies]);

  const blocked = profile?.blocked ?? [];
  const visibleChats = useMemo(
    () => chats.filter((c) => !c.members.some((m) => m !== me && blocked.includes(m))),
    [chats, blocked, me]
  );
  const online = buddies.filter((b) => isOnline(info[b.uid]));
  const offline = buddies.filter((b) => !isOnline(info[b.uid]));

  const openChat = (uid: string, username: string) =>
    router.push({ pathname: '/chat/[uid]', params: { uid, username } });

  const find = async () => {
    setSearchErr('');
    const name = search.trim();
    if (!name) return;
    const uid = await findUserByName(name).catch(() => null);
    if (!uid) return setSearchErr('No user with that username.');
    if (uid === me) return setSearchErr("That's you 🙂");
    setSearch('');
    router.push({ pathname: '/user/[uid]', params: { uid } });
  };

  const BuddyRow = ({ b }: { b: { uid: string; username: string } }) => (
    <Pressable style={s.row} onPress={() => openChat(b.uid, b.username)}>
      <Avatar name={b.username} online={isOnline(info[b.uid])} />
      <View style={{ flex: 1 }}>
        <Text style={s.title}>{b.username}</Text>
        <Text style={s.sub}>{info[b.uid]?.city ?? ''}</Text>
      </View>
    </Pressable>
  );

  return (
    <ScrollView style={s.screen}>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 12 }}>
        <Input
          style={{ flex: 1 }}
          placeholder="Find by username"
          autoCapitalize="none"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={find}
        />
        <Button title="Find" onPress={find} style={{ marginTop: 0, paddingHorizontal: 18 }} />
      </View>
      {!!searchErr && <Text style={[s.error, { paddingHorizontal: 14, paddingTop: 6 }]}>{searchErr}</Text>}

      {visibleChats.length > 0 && <Text style={s.section}>Recent chats</Text>}
      {visibleChats.map((c) => {
        const other = c.members.find((m) => m !== me)!;
        const name = c.names?.[other] ?? 'User';
        const unread = isUnread(c, me);
        return (
          <Pressable key={c.id} style={s.row} onPress={() => openChat(other, name)}>
            <Avatar name={name} />
            <View style={{ flex: 1 }}>
              <Text style={[s.title, unread && { color: C.accent }]}>{name}</Text>
              <Text style={s.sub} numberOfLines={1}>
                {c.lastUid === me ? 'You: ' : ''}
                {c.lastText}
              </Text>
            </View>
            {unread && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent }} />}
          </Pressable>
        );
      })}

      {online.length > 0 && <Text style={s.section}>Online ({online.length})</Text>}
      {online.map((b) => <BuddyRow key={b.uid} b={b} />)}
      {offline.length > 0 && <Text style={s.section}>Offline ({offline.length})</Text>}
      {offline.map((b) => <BuddyRow key={b.uid} b={b} />)}

      {buddies.length === 0 && (
        <Text style={[s.sub, { padding: 14 }]}>
          No buddies yet. Join a room and tap someone's name to add them, or search by username above.
        </Text>
      )}
    </ScrollView>
  );
}
