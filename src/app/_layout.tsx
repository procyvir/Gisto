import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { C, Loading } from '../components/ui';
import { AuthProvider, useAuth } from '../lib/auth';

function RootStack() {
  const { user, profile, loading } = useAuth();
  if (loading) return <Loading />;
  const signedIn = !!user && !!profile;
  const needsProfile = !!user && !profile;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: C.panel },
        headerTintColor: C.text,
        headerTransparent: false,
        contentStyle: { backgroundColor: C.bg },
      }}
    >
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={needsProfile}>
        <Stack.Screen name="setup-profile" options={{ title: 'Create your profile', headerBackVisible: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="room/[id]" options={{ title: 'Room' }} />
        <Stack.Screen name="chat/[uid]" options={{ title: 'Chat' }} />
        <Stack.Screen name="user/[uid]" options={{ title: 'Profile', presentation: 'modal' }} />
        <Stack.Screen name="blocked" options={{ title: 'Blocked users' }} />
      </Stack.Protected>
      <Stack.Screen name="terms" options={{ title: 'Community rules & terms' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootStack />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
