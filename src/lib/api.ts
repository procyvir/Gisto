import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import { cleanText, MAX_MESSAGE } from './filter';
import { ONLINE_WINDOW_MS } from './constants';

export type Profile = {
  uid: string;
  username: string;
  city: string;
  credits: number;
  msgsSent: number;
  blocked: string[];
  banned?: boolean;
  lastSeen?: Timestamp;
  createdAt?: Timestamp;
};

export type Message = { id: string; uid: string; username: string; text: string; createdAt?: Timestamp };

export type Chat = {
  id: string;
  members: string[];
  names: Record<string, string>;
  lastText?: string;
  lastUid?: string;
  lastAt?: Timestamp;
  reads?: Record<string, Timestamp>;
};

export const USERNAME_RE = /^[A-Za-z0-9_.]{3,16}$/;

// ---------- Profiles ----------
export async function createProfile(uid: string, username: string, city: string) {
  const lower = username.toLowerCase();
  await runTransaction(db, async (tx) => {
    const nameRef = doc(db, 'usernames', lower);
    if ((await tx.get(nameRef)).exists()) throw new Error('That username is taken. Try another.');
    tx.set(nameRef, { uid });
    tx.set(doc(db, 'users', uid), {
      username,
      usernameLower: lower,
      city,
      credits: 0,
      msgsSent: 0,
      blocked: [],
      acceptedTermsAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
    });
  });
}

export function watchProfile(uid: string, cb: (p: Profile | null) => void) {
  return onSnapshot(doc(db, 'users', uid), (s) => cb(s.exists() ? ({ uid: s.id, ...(s.data() as Omit<Profile, 'uid'>) }) : null));
}

export async function getProfile(uid: string): Promise<Profile | null> {
  const s = await getDoc(doc(db, 'users', uid));
  return s.exists() ? ({ uid: s.id, ...(s.data() as Omit<Profile, 'uid'>) }) : null;
}

export async function findUserByName(username: string) {
  const s = await getDoc(doc(db, 'usernames', username.toLowerCase()));
  return s.exists() ? (s.data().uid as string) : null;
}

export function heartbeat(uid: string) {
  return updateDoc(doc(db, 'users', uid), { lastSeen: serverTimestamp() }).catch(() => {});
}

export function isOnline(p?: { lastSeen?: Timestamp } | null) {
  return !!p?.lastSeen && Date.now() - p.lastSeen.toMillis() < ONLINE_WINDOW_MS;
}

export async function savePushToken(uid: string, token: string) {
  await setDoc(doc(db, 'users', uid, 'private', 'push'), { token, updatedAt: serverTimestamp() });
}

// ---------- Rooms ----------
export function watchRoom(roomId: string, cb: (m: Message[]) => void) {
  const q = query(collection(db, 'rooms', roomId, 'messages'), orderBy('createdAt', 'desc'), limit(60));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, 'id'>) })).reverse()));
}

export async function sendRoomMessage(roomId: string, me: Profile, raw: string) {
  const text = cleanText(raw.trim()).slice(0, MAX_MESSAGE);
  if (!text) return;
  await addDoc(collection(db, 'rooms', roomId, 'messages'), {
    uid: me.uid,
    username: me.username,
    text,
    createdAt: serverTimestamp(),
  });
}

export function enterRoom(roomId: string, uid: string) {
  return setDoc(doc(db, 'rooms', roomId, 'presence', uid), { lastSeen: serverTimestamp() }).catch(() => {});
}

export function leaveRoom(roomId: string, uid: string) {
  return deleteDoc(doc(db, 'rooms', roomId, 'presence', uid)).catch(() => {});
}

export async function roomOnlineCount(roomId: string) {
  const since = Timestamp.fromMillis(Date.now() - ONLINE_WINDOW_MS);
  const q = query(collection(db, 'rooms', roomId, 'presence'), where('lastSeen', '>', since));
  try {
    return (await getCountFromServer(q)).data().count;
  } catch {
    return 0;
  }
}

// ---------- Buddies ----------
export function watchBuddies(uid: string, cb: (b: { uid: string; username: string }[]) => void) {
  return onSnapshot(collection(db, 'users', uid, 'buddies'), (s) =>
    cb(s.docs.map((d) => ({ uid: d.id, username: d.data().username as string })))
  );
}

export async function addBuddy(me: string, other: { uid: string; username: string }) {
  await setDoc(doc(db, 'users', me, 'buddies', other.uid), { username: other.username, addedAt: serverTimestamp() });
}

export function removeBuddy(me: string, other: string) {
  return deleteDoc(doc(db, 'users', me, 'buddies', other));
}

// ---------- Private chats ----------
export const chatIdFor = (a: string, b: string) => (a < b ? `${a}_${b}` : `${b}_${a}`);

export function watchChats(uid: string, cb: (c: Chat[]) => void) {
  const q = query(collection(db, 'chats'), where('members', 'array-contains', uid), orderBy('lastAt', 'desc'), limit(50));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Chat, 'id'>) }))));
}

export function watchChatMessages(chatId: string, cb: (m: Message[]) => void) {
  const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'), limit(80));
  return onSnapshot(
    q,
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, 'id'>) })).reverse()),
    () => cb([]) // chat doc may not exist yet
  );
}

export async function sendPrivateMessage(me: Profile, other: { uid: string; username: string }, raw: string) {
  const text = cleanText(raw.trim()).slice(0, MAX_MESSAGE);
  if (!text) return;
  const id = chatIdFor(me.uid, other.uid);
  const chatRef = doc(db, 'chats', id);
  const members = [me.uid, other.uid].sort();
  const exists = (await getDoc(chatRef).catch(() => null))?.exists();
  if (!exists) {
    await setDoc(chatRef, {
      members,
      names: { [me.uid]: me.username, [other.uid]: other.username },
      lastText: text,
      lastUid: me.uid,
      lastAt: serverTimestamp(),
      reads: { [me.uid]: serverTimestamp() },
    });
  } else {
    await updateDoc(chatRef, {
      lastText: text,
      lastUid: me.uid,
      lastAt: serverTimestamp(),
      [`reads.${me.uid}`]: serverTimestamp(),
    });
  }
  await addDoc(collection(db, 'chats', id, 'messages'), {
    uid: me.uid,
    username: me.username,
    text,
    createdAt: serverTimestamp(),
  });
}

export function markChatRead(chatId: string, uid: string) {
  return updateDoc(doc(db, 'chats', chatId), { [`reads.${uid}`]: serverTimestamp() }).catch(() => {});
}

export function isUnread(c: Chat, uid: string) {
  if (!c.lastAt || c.lastUid === uid) return false;
  const r = c.reads?.[uid];
  return !r || r.toMillis() < c.lastAt.toMillis();
}

// ---------- Safety ----------
export function blockUser(me: string, other: string) {
  return updateDoc(doc(db, 'users', me), { blocked: arrayUnion(other) });
}

export function unblockUser(me: string, other: string) {
  return updateDoc(doc(db, 'users', me), { blocked: arrayRemove(other) });
}

export async function reportUser(reporter: string, target: string, reason: string, message?: Message, where?: string) {
  await addDoc(collection(db, 'reports'), {
    reporter,
    target,
    reason,
    messageText: message?.text ?? null,
    messageId: message?.id ?? null,
    where: where ?? null,
    status: 'open',
    createdAt: serverTimestamp(),
  });
}

// ---------- Server actions (Cloud Functions) ----------
export async function claimDailyBonus(): Promise<{ awarded: number }> {
  const res = await httpsCallable<unknown, { awarded: number }>(functions, 'claimDailyBonus')({});
  return res.data;
}

export async function deleteMyAccount() {
  await httpsCallable(functions, 'deleteAccount')({});
}
