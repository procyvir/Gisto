import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Avatar, Badge, Button, C, Card, s } from '../../components/ui';
import { addBuddy, blockUser, getProfile, isOnline, Profile, removeBuddy, reportUser, unblockUser, watchBuddies } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { rankOf } from '../../lib/constants';

const REASONS = ['Harassment or bullying', 'Hate speech', 'Sexual content', 'Spam or scam', 'Threats or violence', 'Pretending to be someone', 'Under 13'];

export default function UserScreen() {
  const { uid = '', msgId, msgText, where } = useLocalSearchParams<{ uid: string; msgId?: string; msgText?: string; where?: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const [other, setOther] = useState<Profile | null | undefined>(undefined);
  const [buddyIds, setBuddyIds] = useState<string[]>([]);
  const [reporting, setReporting] = useState(false);
  const [notice, setNotice] = useState('');
  const me = profile?.uid ?? '';

  useEffect(() => {
    getProfile(uid).then(setOther).catch(() => setOther(null));
  }, [uid]);
  useEffect(() => (me ? watchBuddies(me, (b) => setBuddyIds(b.map((x) => x.uid))) : undefined), [me]);

  if (!profile) return null;
  if (other === undefined) return <View style={s.screen} />;
  if (other === null)
    return (
      <View style={[s.screen, { padding: 24 }]}>
        <Text style={s.body}>This account no longer exists.</Text>
      </View>
    );

  const isBuddy = buddyIds.includes(uid);
  const isBlocked = profile.blocked?.includes(uid);
  const rank = rankOf(other.credits ?? 0);

  const report = async (reason: string) => {
    await reportUser(me, uid, reason, msgId ? { id: msgId, text: msgText ?? '', uid, username: other.username } : undefined, where);
    setReporting(false);
    setNotice('Thanks. Our team reviews reports within 24 hours. You can also block this user.');
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 30 }}>
      <Card style={{ alignItems: 'center', gap: 6 }}>
        <Avatar name={other.username} size={72} online={isOnline(other)} />
        <Text style={s.h1}>{other.username}</Text>
        <Badge>{rank.name}</Badge>
        <Text style={s.sub}>
          {other.city} · {isOnline(other) ? 'online now' : 'offline'}
        </Text>
      </Card>

      <View style={{ paddingHorizontal: 14 }}>
        {!isBlocked && (
          <>
            <Button
              title="Send private message"
              onPress={() => router.replace({ pathname: '/chat/[uid]', params: { uid, username: other.username } })}
            />
            {isBuddy ? (
              <Button title="Remove buddy" ghost onPress={() => removeBuddy(me, uid)} />
            ) : (
              <Button
                title="➕ Add as buddy"
                ghost
                onPress={() => addBuddy(me, { uid, username: other.username }).then(() => setNotice('Added! +5 credits'))}
              />
            )}
          </>
        )}
        {isBlocked ? (
          <Button title="Unblock" ghost onPress={() => unblockUser(me, uid)} />
        ) : (
          <Button
            title="Block"
            ghost
            danger
            onPress={() =>
              blockUser(me, uid).then(() => setNotice(`${other.username} is blocked. You won't see their messages.`))
            }
          />
        )}
        <Button title="Report" ghost danger onPress={() => setReporting(!reporting)} />

        {reporting && (
          <Card style={{ marginHorizontal: 0 }}>
            <Text style={[s.title, { marginBottom: 6 }]}>What's wrong?</Text>
            {msgText ? <Text style={[s.sub, { marginBottom: 8 }]}>Reporting message: "{msgText}"</Text> : null}
            {REASONS.map((r) => (
              <Pressable key={r} onPress={() => report(r)} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Text style={s.body}>{r}</Text>
              </Pressable>
            ))}
          </Card>
        )}
        {!!notice && <Text style={{ color: C.accent, marginTop: 12, textAlign: 'center' }}>{notice}</Text>}
      </View>
    </ScrollView>
  );
}
