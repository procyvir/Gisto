import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// Values come from your Firebase project (Project settings → Your apps → Web app).
// Put them in a .env file (see .env.example). EXPO_PUBLIC_ values are bundled into the app,
// which is normal for Firebase client config — security comes from firestore.rules.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const isFirstInit = getApps().length === 0;
export const app = isFirstInit ? initializeApp(firebaseConfig) : getApp();

// getReactNativePersistence is only exported from the React Native build of firebase/auth,
// so TypeScript's default resolution doesn't see it. It keeps users signed in between launches.
const getReactNativePersistence = (FirebaseAuth as unknown as {
  getReactNativePersistence: (s: typeof AsyncStorage) => FirebaseAuth.Persistence;
}).getReactNativePersistence;

export const auth = isFirstInit
  ? FirebaseAuth.initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : FirebaseAuth.getAuth(app);

export const db = getFirestore(app);
export const functions = getFunctions(app, process.env.EXPO_PUBLIC_FIREBASE_REGION || 'us-central1');
