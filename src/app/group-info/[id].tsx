import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BuddyPicker } from '../../components/BuddyPicker';
import { Avatar, Badge, Button, C, Card, GroupIcon, Input, s } from '../../components/ui';
import { addGroupMembers, Group, leaveGroup, MAX_GROUP, removeGroupMember, renameGroup, setGroupAdmin, watchGroup } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function GroupInfo() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null | undefined>(undefined);
  const [adding, setAdding] = useState<{ uid: string; username: string }[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => watchGroup(id, setGroup), [id]);
  if (!profile || group === undefined) return <View style={s.screen} />;
  if (group === null || !group.members.includes(profile.uid))
    return (
      <View style={[s.screen, { padding: 24 }]}>
        <Text style={s.body}>You're not in this group any more.</Text>
      </View>
    );

  const me = profile.uid;
  const iAmAdmin = group.admins.includes(me);
  const run = (p: Promise<unknown>) => p.then(() => setErr('')).catch((e) => setErr((e as Error).message || 'Something went wrong.'));
  const sorted = [...group.members].sort((a, b) => Number(group.admins.includes(b)) - Number(group.admins.includes(a)));

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 30 }}>
      <Card style={{ alignItems: 'center', gap: 6 }}>
        <GroupIcon name={group.name} size={64} />
        {editing ? (
          <View style={{ width: '100%', gap: 4 }}>
            <Input value={name} onChangeText={setName} maxLength={40} autoFocus />
            <Button title="Save name" onPress={() => run(renameGroup(group, name).then(() => setEditing(false)))} />
          </View>
        ) : (
          <Text style={s.h1}>{group.name}</Text>
        )}
        <Text style={s.sub}>
          {group.members.length} of {MAX_GROUP} members
        </Text>
        {iAmAdmin && !editing && (
          <Text style={{ color: C.accent }} onPress={() => (setName(group.name), setEditing(true))}>
            Rename group
          </Text>
        )}
      </Card>

      {iAmAdmin && (
        <View style={{ paddingHorizontal: 14 }}>
          <Button title={showAdd ? 'Cancel' : '➕ Add members'} ghost onPress={() => (setShowAdd(!showAdd), setAdding([]))} />
        </View>
      )}
      {showAdd && (
        <>
          <BuddyPicker uid={me} selected={adding} onChange={setAdding} exclude={group.members} />
          {adding.length > 0 && (
            <View style={{ paddingHorizontal: 14 }}>
              <Button
                title={`Add ${adding.length}`}
                onPress={() => run(addGroupMembers(group, adding).then(() => (setShowAdd(false), setAdding([]))))}
              />
            </View>
          )}
        </>
      )}

      <Text style={s.section}>Members</Text>
      {sorted.map((uid) => {
        const uname = group.memberNames?.[uid] ?? 'User';
        const isAdmin = group.admins.includes(uid);
        const open = selected === uid && uid !== me;
        return (
          <View key={uid}>
            <Pressable style={s.row} onPress={() => setSelected(open ? null : uid)}>
              <Avatar name={uname} />
              <Text style={[s.title, { flex: 1 }]}>
                {uname}
                {uid === me ? ' (you)' : ''}
              </Text>
              {uid === group.ownerUid ? <Badge>Owner</Badge> : isAdmin ? <Badge color={C.accent}>Admin</Badge> : null}
            </Pressable>
            {open && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingBottom: 10 }}>
                <Button title="Profile" ghost style={{ marginTop: 0, paddingHorizontal: 14 }} onPress={() => router.push({ pathname: '/user/[uid]', params: { uid, where: `group:${id}` } })} />
                {iAmAdmin && uid !== group.ownerUid && (
                  <>
                    <Button
                      title={isAdmin ? 'Remove admin' : 'Make admin'}
                      ghost
                      style={{ marginTop: 0, paddingHorizontal: 14 }}
                      onPress={() => run(setGroupAdmin(group, uid, !isAdmin))}
                    />
                    <Button
                      title="Remove"
                      ghost
                      danger
                      style={{ marginTop: 0, paddingHorizontal: 14 }}
                      onPress={() => run(removeGroupMember(group, uid).then(() => setSelected(null)))}
                    />
                  </>
                )}
              </View>
            )}
          </View>
        );
      })}

      <View style={{ paddingHorizontal: 14 }}>
        <Text style={[s.error, { marginTop: 8 }]}>{err}</Text>
        {!confirmLeave ? (
          <Button title="Leave group" ghost danger onPress={() => setConfirmLeave(true)} />
        ) : (
          <Card style={{ marginHorizontal: 0 }}>
            <Text style={s.body}>
              Leave "{group.name}"? You'll stop getting its messages.
              {iAmAdmin && group.admins.length === 1 && group.members.length > 1 ? ' Another member will become admin.' : ''}
            </Text>
            <Button title="Yes, leave" danger onPress={() => run(leaveGroup(group, me).then(() => router.dismissTo('/groups')))} />
            <Button title="Cancel" ghost onPress={() => setConfirmLeave(false)} />
          </Card>
        )}
      </View>
    </ScrollView>
  );
}
