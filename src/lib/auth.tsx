import { onAuthStateChanged, User } from 'firebase/auth';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { claimDailyBonus, heartbeat, Profile, watchProfile } from './api';
import { auth } from './firebase';
import { registerForPush } from './push';

type AuthState = {
  user: User | null;
  profile: Profile | null;
  loading: boolean; // true until we know whether a user and profile exist
};

const Ctx = createContext<AuthState>({ user: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setAuthReady(true);
        if (!u) {
          setProfile(null);
          setProfileReady(true);
        }
      }),
    []
  );

  useEffect(() => {
    if (!user) return;
    setProfileReady(false);
    return watchProfile(user.uid, (p) => {
      setProfile(p);
      setProfileReady(true);
    });
  }, [user]);

  // Presence, daily bonus and push registration once the profile exists.
  const hasProfile = !!profile;
  useEffect(() => {
    if (!user || !hasProfile) return;
    heartbeat(user.uid);
    claimDailyBonus().catch(() => {});
    registerForPush(user.uid).catch(() => {});
    const t = setInterval(() => heartbeat(user.uid), 60_000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        heartbeat(user.uid);
        claimDailyBonus().catch(() => {});
      }
    });
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [user, hasProfile]);

  return (
    <Ctx.Provider value={{ user, profile, loading: !authReady || (!!user && !profileReady) }}>{children}</Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
