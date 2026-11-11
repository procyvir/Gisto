import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { watchBuddies } from '../lib/api';
import { Avatar, C, s } from './ui';

type Person = { uid: string; username: string };

// Tick buddies to add to a group. `exclude` hides people already in the group.
export function BuddyPicker({
  uid,
  selected,
  onChange,
  exclude = [],
}: {
  uid: string;
  selected: Person[];
  onChange: (p: Person[]) => void;
  exclude?: string[];
}) {
  const [buddies, setBuddies] = useState<Person[]>([]);
  useEffect(() => watchBuddies(uid, setBuddies), [uid]);
  const list = buddies.filter((b) => !exclude.includes(b.uid));
  const isOn = (b: Person) => selected.some((x) => x.uid === b.uid);
  const toggle = (b: Person) => onChange(isOn(b) ? selected.filter((x) => x.uid !== b.uid) : [...selected, b]);

  if (!list.length)
    return (
      <Text style={[s.sub, { padding: 14 }]}>
        {buddies.length ? 'All your buddies are already in this group.' : 'Add buddies first: tap a name in any room, or search on the Buddies tab.'}
      </Text>
    );

  return (
    <View>
      {list.map((b) => (
        <Pressable key={b.uid} style={s.row} onPress={() => toggle(b)} accessibilityRole="checkbox" accessibilityState={{ checked: isOn(b) }}>
          <Avatar name={b.username} />
          <Text style={[s.title, { flex: 1 }]}>{b.username}</Text>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: C.accent,
              backgroundColor: isOn(b) ? C.accent : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isOn(b) && <Text style={{ color: '#04210f', fontWeight: '900', fontSize: 13 }}>✓</Text>}
          </View>
        </Pressable>
      ))}
    </View>
  );
}
