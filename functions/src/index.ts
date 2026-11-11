import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
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

// ---------- Push notifications (Expo push service) ----------
type PushMsg = { title: string; body: string; data: Record<string, string> };

// Sends to each recipient who has a push token and hasn't blocked the sender.
async function pushTo(recipients: string[], senderUid: string, msg: PushMsg) {
  const targets: { uid: string; token: string }[] = [];
  for (const uid of recipients) {
    if (uid === senderUid) continue;
    const [user, push] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`users/${uid}/private/push`).get()]);
    if (!user.exists || (user.get('blocked') as string[] | undefined)?.includes(senderUid)) continue;
    const token = push.get('token');
    if (typeof token === 'string' && token.startsWith('ExponentPushToken')) targets.push({ uid, token });
  }
  for (let i = 0; i < targets.length; i += 100) {
    const batch = targets.slice(i, i + 100);
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(
          batch.map((t) => ({ to: t.token, title: msg.title, body: msg.body, sound: 'default', channelId: 'messages', data: msg.data }))
        ),
      });
      const out = (await res.json()) as { data?: { details?: { error?: string } }[] };
      await Promise.all(
        (out.data ?? []).map((r, j) =>
          r.details?.error === 'DeviceNotRegistered' ? db.doc(`users/${batch[j].uid}/private/push`).delete() : null
        )
      );
    } catch (e) {
      logger.warn('push failed', e);
    }
  }
}

// ---------- Private messages: credits + push notification ----------
export const onChatMessage = onDocumentCreated('chats/{chatId}/messages/{msgId}', async (event) => {
  const msg = event.data?.data();
  if (!msg || typeof msg.uid !== 'string') return;
  await awardForMessage(msg.uid);
  const chat = (await db.doc(`chats/${event.params.chatId}`).get()).data();
  const members = (chat?.members as string[] | undefined) ?? [];
  await pushTo(members, msg.uid, {
    title: msg.username,
    body: String(msg.text).slice(0, 140),
    data: { type: 'chat', uid: msg.uid, username: msg.username },
  });
});

// ---------- Group messages: credits + push to members ----------
export const onGroupMessage = onDocumentCreated('groups/{groupId}/messages/{msgId}', async (event) => {
  const msg = event.data?.data();
  if (!msg || typeof msg.uid !== 'string') return;
  await awardForMessage(msg.uid);
  const group = (await db.doc(`groups/${event.params.groupId}`).get()).data();
  if (!group) return;
  await pushTo((group.members as string[]) ?? [], msg.uid, {
    title: String(group.name),
    body: `${msg.username}: ${String(msg.text).slice(0, 120)}`,
    data: { type: 'group', groupId: event.params.groupId },
  });
});

// ---------- Groups: keep an admin when the last admin leaves ----------
export const onGroupUpdated = onDocumentUpdated('groups/{groupId}', async (event) => {
  const after = event.data?.after.data();
  if (!after) return;
  const members = (after.members as string[]) ?? [];
  const admins = ((after.admins as string[]) ?? []).filter((a) => members.includes(a));
  if (members.length === 0) {
    await db.recursiveDelete(event.data!.after.ref); // everyone left
  } else if (admins.length === 0) {
    await event.data!.after.ref.update({ admins: [members[0]], ownerUid: members[0] });
  } else if (!members.includes(after.ownerUid)) {
    await event.data!.after.ref.update({ ownerUid: admins[0] });
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

  // Leave every group (onGroupUpdated hands admin to someone else).
  const groups = await db.collection('groups').where('members', 'array-contains', uid).get();
  for (const g of groups.docs)
    await g.ref.update({
      members: FieldValue.arrayRemove(uid),
      admins: FieldValue.arrayRemove(uid),
      [`memberNames.${uid}`]: FieldValue.delete(),
    });

  // Remove this user from other people's buddy lists.
  const asBuddy = await db.collectionGroup('buddies').where('username', '==', user?.username ?? '__none__').get();
  for (const b of asBuddy.docs) if (b.id === uid) await b.ref.delete();

  if (user?.usernameLower) await db.doc(`usernames/${user.usernameLower}`).delete();
  await db.recursiveDelete(userRef); // profile, buddies, push token
  await getAuth().deleteUser(uid);
  logger.info('account deleted', { uid });
  return { ok: true };
});
