import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { C, s } from '../../components/ui';
import { roomOnlineCount } from '../../lib/api';
import { ROOMS } from '../../lib/constants';

const sections = Object.entries(
  ROOMS.reduce<Record<string, typeof ROOMS>>((acc, r) => {
    (acc[r.topic] ||= []).push(r);
    return acc;
  }, {})
).map(([title, data]) => ({ title, data }));

export default function Rooms() {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useFocusEffect(
    useCallback(() => {
      let live = true;
      Promise.all(ROOMS.map(async (r) => [r.id, await roomOnlineCount(r.id)] as const)).then((pairs) => {
        if (live) setCounts(Object.fromEntries(pairs));
      });
      return () => {
        live = false;
      };
    }, [])
  );

  return (
    <SectionList
      style={s.screen}
      sections={sections}
      keyExtractor={(r) => r.id}
      renderSectionHeader={({ section }) => <Text style={s.section}>{section.title}</Text>}
      renderItem={({ item: r }) => (
        <Pressable
          style={({ pressed }) => [s.row, pressed && { backgroundColor: C.card }]}
          onPress={() => router.push({ pathname: '/room/[id]', params: { id: r.id } })}
        >
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.them, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20 }}>{r.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{r.name}</Text>
            <Text style={s.sub} numberOfLines={1}>
              {counts[r.id] !== undefined ? `${counts[r.id]} online · ` : ''}
              {r.blurb}
            </Text>
          </View>
          <Text style={{ color: C.muted, fontSize: 18 }}>›</Text>
        </Pressable>
      )}
    />
  );
}
