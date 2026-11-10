# Gisto

A light, Naija-flavoured chat app: public chat rooms, buddies, private chats, and credits that unlock ranks.
Built with **Expo (React Native)** for Android and iPhone from one codebase, with **Firebase** for login,
real-time chat, and server logic.

| Feature | Where |
| --- | --- |
| Email sign-up, verification, password reset | `src/app/(auth)`, `src/app/setup-profile.tsx` |
| Unique usernames, city | `createProfile` in `src/lib/api.ts` |
| Live chat rooms (10 rooms, with online counts) | `src/app/room/[id].tsx` |
| Buddies, online/offline status, user search | `src/app/(tabs)/buddies.tsx` |
| Private chats with unread markers and push notifications | `src/app/chat/[uid].tsx`, `functions/src/index.ts` |
| Credits and ranks (Fresh → Regular → Gister → Influencer → Oga → Odogwu) | `functions/src/index.ts`, `src/app/(tabs)/me.tsx` |
| Report, block, word filter, ban, community rules (App Store guideline 1.2) | `src/app/user/[uid].tsx`, `src/lib/filter.ts`, `firestore.rules` |
| In-app account deletion (required by Apple and Google) | `deleteAccount` function, Me tab |

Credits can't be faked: only Cloud Functions can change them (see `firestore.rules`).

---

## Part 1: Run it on your phone (about 1 hour)

You need a computer (Windows, Mac or Linux) with **Node.js 22 or newer** and **Git**.

### 1. Create the Firebase project
1. Go to <https://console.firebase.google.com> → **Add project** → name it `gisto`.
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** → production mode → pick a region close to your users
   (e.g. `europe-west1` is closest to Nigeria among common options).
4. **Project settings (⚙️) → Your apps → Web (`</>`)** → register an app called `gisto`. Copy the config values.
5. **Upgrade to the Blaze (pay-as-you-go) plan.** Cloud Functions require it. Small apps stay inside the free
   allowance; set a **budget alert** (e.g. $10) under Billing so you are never surprised.

### 2. Configure the app
```bash
git clone https://github.com/<your-username>/gisto.git
cd gisto
npm install
cp .env.example .env      # Windows: copy .env.example .env
```
Fill `.env` with the values from step 1.4 and your support email.

### 3. Deploy the backend
```bash
npm install -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc   # then put your project id in it
cd functions && npm install && cd ..
firebase deploy --only firestore,functions
```
If you picked a Firestore region other than `us-central1`, change `region` in `functions/src/index.ts`
and `EXPO_PUBLIC_FIREBASE_REGION` in `.env` to match before deploying.

### 4. Open it on your phone
```bash
npx expo start
```
Install **Expo Go** from the Play Store / App Store and scan the QR code. Sign up with two different emails
(on two phones, or sign out and in) to see live chat working. Push notifications need a real build (Part 2).

### 5. (Optional) Test the security rules
Needs Java installed: `cd rules-tests && npm install && npm test`.

---

## Part 2: Publish to Google Play and the App Store

### Accounts you need (in your name, you pay these directly)
| Account | Cost | Notes |
| --- | --- | --- |
| Expo account (<https://expo.dev>) | Free | Builds both apps in the cloud. No Mac needed. |
| Google Play Console | US$25 once | ID verification. **New personal accounts must run a closed test with 12 testers for 14 continuous days** before going live. An organization account (needs a free D-U-N-S number) skips this. |
| Apple Developer Program | US$99/year | Enrol as individual or as an organization (D-U-N-S). |

Before paying, search both stores for "Gisto" to make sure the name is free. Pick a unique bundle id
too: change `com.gisto.app` in `app.json` (e.g. `com.yourname.gisto`) **before the first build**; it can't
change after publishing.

### Build and submit
```bash
npm install -g eas-cli
eas login
eas init                      # links the project, adds projectId (enables push)
eas env:create                # add each EXPO_PUBLIC_ value from .env for the "production" environment
eas build --platform android --profile production
eas build --platform ios --profile production
eas submit --platform android
eas submit --platform ios
```
EAS walks you through signing keys and Apple certificates. Let it manage them.

For iPhone push notifications, EAS will offer to create the push key during the iOS build. Say yes.

### Store listing checklist
- [ ] App icon 1024×1024 and splash: replace the files in `assets/`.
- [ ] Screenshots (phone): rooms list, a room chat, buddies, Me/ranks.
- [ ] **Privacy policy URL** and **support URL**. Both stores require public pages. You can publish the
      text in `src/app/terms.tsx`, expanded, on any website or a free Google Site. Have a lawyer review it.
- [ ] **Google Play Data safety** form: collects email, username, messages, approximate city; not sold;
      users can request deletion in-app.
- [ ] **Apple privacy labels**: same answers as above. "Data linked to you: Contact info (email),
      User content (messages), Identifiers (user id)."
- [ ] Age rating: answer "yes" to user-generated content and unrestricted chat; expect 13+ / Teen or higher.
- [ ] **Apple review notes**: give a working test login (verified email + password) and explain safety:
      > Gisto has a word filter on all messages, a Report option on every user (tap a name or long-press a
      > message), Block (hides all their messages and stops private chats), a zero-tolerance community rules
      > screen accepted at sign-up, verified-email accounts with persistent usernames (no anonymous or random
      > chat), in-app account deletion (Me → Delete my account), and reports reviewed within 24 hours.

### Running moderation (do this daily once live)
Apple requires "timely responses" to reports.
1. Firebase console → Firestore → `reports` collection: read new reports.
2. To delete a bad message: open `rooms/<room>/messages/<id>` (or `chats/...`) and delete it.
3. To ban someone: open `users/<uid>` and add a field `banned` = `true` (boolean). They can no longer post.
   For serious cases also disable their login under Authentication.

---

## Project layout
```
src/app/            screens (Expo Router: every file is a screen)
src/components/     ChatView and shared UI
src/lib/            Firebase setup, data functions, auth state, push, word filter
functions/          Cloud Functions: credits, daily bonus, push, account deletion
firestore.rules     security rules (who can read/write what)
rules-tests/        automated tests for the rules
eas.json            build profiles for the stores
```

## Changing things
- **Rooms:** edit `ROOMS` in `src/lib/constants.ts` **and** `roomIds()` in `firestore.rules`, then redeploy rules.
- **Credits:** amounts and the daily cap are at the top of `functions/src/index.ts`. Rank thresholds are
  `RANKS` in `src/lib/constants.ts`.
- **Word filter:** `src/lib/filter.ts`.

## Ideas for version 2
Phone-number login, photo sharing (needs image moderation), group chats, buddy requests that need
approval, room moderators, and Firebase App Check to block scripted abuse.
