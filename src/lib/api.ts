import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
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

// ---------- Group chats ----------
export const MAX_GROUP = 50;

export type Group = {
  id: string;
  name: string;
  ownerUid: string;
  admins: string[];
  members: string[];
  memberNames: Record<string, string>;
  lastText?: string;
  lastUid?: string;
  lastAt?: Timestamp;
  reads?: Record<string, Timestamp>;
};

export function watchGroups(uid: string, cb: (g: Group[]) => void) {
  const q = query(collection(db, 'groups'), where('members', 'array-contains', uid), orderBy('lastAt', 'desc'), limit(50));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Group, 'id'>) }))));
}

export function watchGroup(id: string, cb: (g: Group | null) => void) {
  return onSnapshot(
    doc(db, 'groups', id),
    (s) => cb(s.exists() ? ({ id: s.id, ...(s.data() as Omit<Group, 'id'>) }) : null),
    () => cb(null) // no longer a member
  );
}

export async function createGroup(me: Profile, name: string, people: { uid: string; username: string }[]) {
  const clean = cleanText(name.trim()).slice(0, 40);
  const members = [me.uid, ...people.map((p) => p.uid).filter((u) => u !== me.uid)];
  const memberNames: Record<string, string> = { [me.uid]: me.username };
  people.forEach((p) => (memberNames[p.uid] = p.username));
  const text = `${me.username} created the group`;
  const ref = await addDoc(collection(db, 'groups'), {
    name: clean,
    ownerUid: me.uid,
    admins: [me.uid],
    members,
    memberNames,
    lastText: text,
    lastUid: me.uid,
    lastAt: serverTimestamp(),
    reads: { [me.uid]: serverTimestamp() },
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export function watchGroupMessages(groupId: string, cb: (m: Message[]) => void) {
  const q = query(collection(db, 'groups', groupId, 'messages'), orderBy('createdAt', 'desc'), limit(80));
  return onSnapshot(
    q,
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, 'id'>) })).reverse()),
    () => cb([])
  );
}

export async function sendGroupMessage(groupId: string, me: Profile, raw: string) {
  const text = cleanText(raw.trim()).slice(0, MAX_MESSAGE);
  if (!text) return;
  await addDoc(collection(db, 'groups', groupId, 'messages'), {
    uid: me.uid,
    username: me.username,
    text,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'groups', groupId), {
    lastText: `${me.username}: ${text}`.slice(0, 120),
    lastUid: me.uid,
    lastAt: serverTimestamp(),
    [`reads.${me.uid}`]: serverTimestamp(),
  }).catch(() => {});
}

export function markGroupRead(groupId: string, uid: string) {
  return updateDoc(doc(db, 'groups', groupId), { [`reads.${uid}`]: serverTimestamp() }).catch(() => {});
}

export function renameGroup(g: Group, name: string) {
  return updateDoc(doc(db, 'groups', g.id), { name: cleanText(name.trim()).slice(0, 40) });
}

export function addGroupMembers(g: Group, people: { uid: string; username: string }[]) {
  const fresh = people.filter((p) => !g.members.includes(p.uid));
  if (!fresh.length) return Promise.resolve();
  if (g.members.length + fresh.length > MAX_GROUP) throw new Error(`Groups can have up to ${MAX_GROUP} members.`);
  const update: Record<string, unknown> = { members: arrayUnion(...fresh.map((p) => p.uid)) };
  fresh.forEach((p) => (update[`memberNames.${p.uid}`] = p.username));
  return updateDoc(doc(db, 'groups', g.id), update);
}

export function removeGroupMember(g: Group, uid: string) {
  return updateDoc(doc(db, 'groups', g.id), {
    members: arrayRemove(uid),
    admins: arrayRemove(uid),
    [`memberNames.${uid}`]: deleteField(),
  });
}

export function setGroupAdmin(g: Group, uid: string, admin: boolean) {
  return updateDoc(doc(db, 'groups', g.id), { admins: admin ? arrayUnion(uid) : arrayRemove(uid) });
}

export const leaveGroup = (g: Group, uid: string) => removeGroupMember(g, uid);

export function isGroupUnread(g: Group, uid: string) {
  if (!g.lastAt || g.lastUid === uid) return false;
  const r = g.reads?.[uid];
  return !r || r.toMillis() < g.lastAt.toMillis();
}
