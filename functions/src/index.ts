import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

initializeApp();
const db = getFirestore();

// Keep functions in the same region as EXPO_PUBLIC_FIREBASE_REGION in the app.
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const MESSAGE_CREDITS = 2;
const DAILY_MESSAGE_CAP = 100; // most credits a user can earn from messages per day
const BUDDY_CREDITS = 5;
const DAILY_BONUS = 10;

// "Today" in West Africa Time, so the day rolls over at midnight in Nigeria.
const today = () => new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);

// ---------- Credits: messages ----------
async function awardForMessage(uid: string) {
  const ref = db.doc(`users/${uid}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const d = snap.data()!;
    const day = today();
    const earnedToday = d.creditsDay === day ? d.creditsToday ?? 0 : 0;
    const award = earnedToday + MESSAGE_CREDITS <= DAILY_MESSAGE_CAP ? MESSAGE_CREDITS : 0;
    tx.update(ref, {
      msgsSent: FieldValue.increment(1),
      credits: FieldValue.increment(award),
      creditsDay: day,
      creditsToday: earnedToday + award,
    });
  });
}

export const onRoomMessage = onDocumentCreated('rooms/{roomId}/messages/{msgId}', async (event) => {
  const uid = event.data?.get('uid');
  if (typeof uid === 'string') await awardForMessage(uid);
});

// ---------- Private messages: credits + push notification ----------
export const onChatMessage = onDocumentCreated('chats/{chatId}/messages/{msgId}', async (event) => {
  const msg = event.data?.data();
  if (!msg || typeof msg.uid !== 'string') return;
  await awardForMessage(msg.uid);

  const chat = (await db.doc(`chats/${event.params.chatId}`).get()).data();
  const to = (chat?.members as string[] | undefined)?.find((m) => m !== msg.uid);
  if (!to) return;
  const recipient = (await db.doc(`users/${to}`).get()).data();
  if (!recipient || (recipient.blocked as string[] | undefined)?.includes(msg.uid)) return;
  const token = (await db.doc(`users/${to}/private/push`).get()).get('token');
  if (typeof token !== 'string' || !token.startsWith('ExponentPushToken')) return;

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: token,
        title: msg.username,
        body: String(msg.text).slice(0, 140),
        sound: 'default',
        channelId: 'messages',
        data: { type: 'chat', uid: msg.uid, username: msg.username },
      }),
    });
    const out = (await res.json()) as { data?: { status?: string; details?: { error?: string } } };
    if (out.data?.details?.error === 'DeviceNotRegistered') await db.doc(`users/${to}/private/push`).delete();
  } catch (e) {
    logger.warn('push failed', e);
  }
});

// ---------- Credits: new buddy (once per pair, ever) ----------
export const onBuddyAdded = onDocumentCreated('users/{uid}/buddies/{otherUid}', async (event) => {
  const { uid, otherUid } = event.params;
  if (uid === otherUid) return;
  const marker = db.doc(`users/${uid}/private/buddyAwards`);
  await db.runTransaction(async (tx) => {
    const m = await tx.get(marker);
    const awarded: string[] = m.get('uids') ?? [];
    if (awarded.includes(otherUid)) return;
    tx.set(marker, { uids: FieldValue.arrayUnion(otherUid) }, { merge: true });
    tx.update(db.doc(`users/${uid}`), { credits: FieldValue.increment(BUDDY_CREDITS) });
  });
});

// ---------- Daily login bonus ----------
export const claimDailyBonus = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const ref = db.doc(`users/${uid}`);
  const awarded = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get('lastDaily') === today()) return 0;
    tx.update(ref, { lastDaily: today(), credits: FieldValue.increment(DAILY_BONUS) });
    return DAILY_BONUS;
  });
  return { awarded };
});

// ---------- Account deletion (required by Apple and Google) ----------
export const deleteAccount = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const userRef = db.doc(`users/${uid}`);
  const user = (await userRef.get()).data();

  // Anonymise messages they sent (kept so conversations still make sense).
  const sent = await db.collectionGroup('messages').where('uid', '==', uid).get();
  for (let i = 0; i < sent.docs.length; i += 400) {
    const batch = db.batch();
    sent.docs.slice(i, i + 400).forEach((d) => batch.update(d.ref, { username: 'Deleted user' }));
    await batch.commit();
  }
  const chats = await db.collection('chats').where('members', 'array-contains', uid).get();
  for (const c of chats.docs) await c.ref.update({ [`names.${uid}`]: 'Deleted user' });

  // Remove this user from other people's buddy lists.
  const asBuddy = await db.collectionGroup('buddies').where('username', '==', user?.username ?? '__none__').get();
  for (const b of asBuddy.docs) if (b.id === uid) await b.ref.delete();

  if (user?.usernameLower) await db.doc(`usernames/${user.usernameLower}`).delete();
  await db.recursiveDelete(userRef); // profile, buddies, push token
  await getAuth().deleteUser(uid);
  logger.info('account deleted', { uid });
  return { ok: true };
});
