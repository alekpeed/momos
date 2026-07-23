# Firebase setup — native MomOS (iOS)

MomOS is local-first: it works fully offline with SwiftData, and Firebase is an
**optional** layer that adds a cloud account, cross-device sync, private photo
storage, and shared household access for a helper. Nothing leaves the device
until you sign in and turn cloud on.

This is the checklist for the **native iOS app** (bundle id `com.momhome.app`),
using the existing Firebase project **`kmos-3da65`** and **Email/Password**
sign-in. These are the steps only you can do in the console — the app code,
Firestore rules, and Storage rules are already in the repo.

> Scope note (read this): the current sharing model is a **self-join invite
> code**, not owner-approved. The owner generates a time-limited code; whoever
> enters a valid code joins immediately with the role the code specifies. That is
> a deliberate simplification of the original "owner approves each request" flow.
> If you want the approval step back, say so and it goes on the checklist.

---

## 1. Register the iOS app (console)

1. Open the [Firebase console](https://console.firebase.google.com/) and select
   the **`kmos-3da65`** project.
2. Project settings → **Your apps** → add an **iOS** app.
3. **Apple bundle ID:** `com.momhome.app` (must match exactly).
4. App nickname: `MomOS` (optional). App Store ID: leave blank for now.
5. Download **`GoogleService-Info.plist`**.

## 2. Add `GoogleService-Info.plist` to the Xcode project

1. Put the file at `ios/MomHome/GoogleService-Info.plist`.
2. It's picked up automatically — the target uses Xcode's synchronized-folder
   format, so any file under `MomHome/` is included in the build.
3. **Do not commit this file** if the repo is public. It contains project
   identifiers (not secrets, but there's no reason to publish them). It's already
   covered by `.gitignore` — verify before pushing.

## 3. Enable Email/Password sign-in (console)

1. **Authentication** → **Get started** (if first time).
2. **Sign-in method** → **Email/Password** → enable the first toggle
   (leave passwordless "Email link" off).

## 4. Create Firestore + Storage (console)

1. **Firestore Database** → **Create database** → **Production mode** →
   pick a region close to home and finish.
2. **Storage** → **Get started** → **Production mode**. Cloud Storage requires
   the **Blaze** (pay-as-you-go) plan; for one household the usage sits in the
   free tier, but the plan must be enabled.

## 5. Publish the security rules (console)

1. **Firestore Database → Rules** → paste the contents of
   [`firebase/firestore.rules`](../firebase/firestore.rules) → **Publish**.
2. **Storage → Rules** → paste the contents of
   [`firebase/storage.rules`](../firebase/storage.rules) → **Publish**.
3. Publish **both** before creating a household in the app.

What the rules enforce:

- A user only reads a household they are an **active member** of.
- Only **owner** or **helper** may write records or upload media; a **viewer**
  is read-only.
- The **audit log is append-only** — no edits, no deletes.
- Media uploads are limited to **images or PDFs under 15 MB**.
- Invite codes are validated server-side: correct role, `pending`, not expired.

---

## Firestore data model (reference)

```
households/{hid}
  { name, ownerId, createdAt }

  households/{hid}/members/{uid}
    { role: 'owner'|'helper'|'viewer', status: 'active', invitedBy, inviteToken }

  households/{hid}/invites/{token}
    { role, email, status: 'pending'|'used'|'revoked', expiresAt, createdBy }

  households/{hid}/records/{docId}
    { kind, recordId, payload, deleted, updatedAt, updatedBy }

  households/{hid}/audit/{docId}
    { userId, action, detail, createdAt }

users/{uid}
  { name }
```

`records` is the sync channel: each MomOS entity (item, task, order, …) is one
document keyed by its local id, so a device can push changes and pull others'
changes without a schema migration. The private **vault stays on-device** and is
never synced.

---

## Verify (after console steps)

1. Build MomOS on a device/simulator with `GoogleService-Info.plist` present.
2. **More → Cloud** → create an email/password account.
3. Create a household, confirm the owner `members/{uid}` doc appears in Firestore.
4. Add an item with a photo, turn on sync, confirm a `records/*` doc and a media
   file under `households/{hid}/…` in Storage.
5. Generate an invite code; on a second account, enter it and confirm the new
   `members/{uid}` doc with the expected role.
6. Turn off the network, make a change, reconnect — the SDK's offline queue
   flushes automatically.

Local SwiftData saving stays on the whole time; cloud is additive, never the
only copy.
