// Run from this folder: npm test   (needs Java; starts the Firestore emulator)
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';

let env;
const A = 'aaa', B = 'bbb';

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'gisto-test',
    firestore: { rules: readFileSync('../firestore.rules', 'utf8') },
  });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, name] of [[A, 'Ade'], [B, 'Bola']]) {
      await setDoc(doc(db, 'users', uid), { username: name, usernameLower: name.toLowerCase(), city: 'Lagos', credits: 0, msgsSent: 0, blocked: [] });
      await setDoc(doc(db, 'usernames', name.toLowerCase()), { uid });
    }
  });
});

const as = (uid) => env.authenticatedContext(uid, { email_verified: true }).firestore();
const chatId = [A, B].sort().join('_');

test('cannot give yourself credits', async () => {
  await assertFails(updateDoc(doc(as(A), 'users', A), { credits: 9999 }));
  await assertSucceeds(updateDoc(doc(as(A), 'users', A), { city: 'Abuja' }));
});

test('cannot edit someone else', async () => {
  await assertFails(updateDoc(doc(as(A), 'users', B), { city: 'Kano' }));
});

test('room message must use your own name', async () => {
  const col = collection(as(A), 'rooms', 'lagos', 'messages');
  await assertSucceeds(addDoc(col, { uid: A, username: 'Ade', text: 'hi', createdAt: serverTimestamp() }));
  await assertFails(addDoc(col, { uid: A, username: 'Bola', text: 'hi', createdAt: serverTimestamp() }));
  await assertFails(addDoc(col, { uid: B, username: 'Bola', text: 'hi', createdAt: serverTimestamp() }));
});

test('unknown rooms are rejected', async () => {
  await assertFails(addDoc(collection(as(A), 'rooms', 'secret', 'messages'), { uid: A, username: 'Ade', text: 'hi', createdAt: serverTimestamp() }));
});

test('private chat: members only, block respected', async () => {
  const db = as(A);
  await assertSucceeds(setDoc(doc(db, 'chats', chatId), { members: [A, B].sort(), names: { [A]: 'Ade', [B]: 'Bola' }, lastText: 'hi', lastUid: A, lastAt: serverTimestamp(), reads: {} }));
  await assertSucceeds(addDoc(collection(db, 'chats', chatId, 'messages'), { uid: A, username: 'Ade', text: 'hi', createdAt: serverTimestamp() }));
  await assertSucceeds(getDocs(query(collection(db, 'chats'), where('members', 'array-contains', A))));
  await assertFails(getDoc(doc(env.authenticatedContext('ccc').firestore(), 'chats', chatId)));
  await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'users', B), { blocked: [A] }));
  await assertFails(addDoc(collection(db, 'chats', chatId, 'messages'), { uid: A, username: 'Ade', text: 'again', createdAt: serverTimestamp() }));
});

test('banned users cannot post', async () => {
  await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'users', A), { banned: true }));
  await assertFails(addDoc(collection(as(A), 'rooms', 'lagos', 'messages'), { uid: A, username: 'Ade', text: 'hi', createdAt: serverTimestamp() }));
});

test('signup claims a free username only', async () => {
  const db = as('ccc');
  await assertFails(setDoc(doc(db, 'usernames', 'ade'), { uid: 'ccc' }));
  await assertSucceeds(setDoc(doc(db, 'usernames', 'chidi'), { uid: 'ccc' }));
});

test('unverified email cannot post', async () => {
  const db = env.authenticatedContext(A, { email_verified: false }).firestore();
  await assertFails(addDoc(collection(db, 'rooms', 'lagos', 'messages'), { uid: A, username: 'Ade', text: 'hi', createdAt: serverTimestamp() }));
});
