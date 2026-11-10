import { Tabs } from 'expo-router/js-tabs';
import { Text } from 'react-native';
import { C } from '../../components/ui';
import { rankOf } from '../../lib/constants';
import { useAuth } from '../../lib/auth';

const icon = (e: string) => ({ focused }: { focused: boolean }) => (
  <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>{e}</Text>
);

export default function TabsLayout() {
  const { profile } = useAuth();
  const credits = profile?.credits ?? 0;
  const headerRight = () => (
    <Text style={{ color: C.gold, marginRight: 14, fontWeight: '700' }}>
      🪙 {credits} · {rankOf(credits).name}
    </Text>
  );
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C.panel },
        headerTintColor: C.text,
        headerRight,
        tabBarStyle: { backgroundColor: C.panel, borderTopColor: C.line },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.muted,
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Rooms', tabBarIcon: icon('💬') }} />
      <Tabs.Screen name="buddies" options={{ title: 'Buddies', tabBarIcon: icon('👥') }} />
      <Tabs.Screen name="me" options={{ title: 'Me', tabBarIcon: icon('⭐') }} />
    </Tabs>
  );
}
