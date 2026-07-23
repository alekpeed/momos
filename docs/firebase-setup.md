# Firebase setup

MomOS remains fully usable in local mode until Firebase is configured. Firebase adds optional cloud accounts, household backups, private photo storage, and restore across devices.

## Create the project

1. Open the [Firebase console](https://console.firebase.google.com/) and create a project such as `mom-home`.
2. Register a **Web** app. Copy its public Web App configuration values.
3. In **Authentication**, enable **Email/Password**.
4. In **Firestore Database**, create a database in Production mode.
5. In **Storage**, create the default bucket. Firebase may require the Blaze plan for Cloud Storage.

## Add the public web configuration

1. Copy `.env.example` to `.env.local`.
2. Keep `NEXT_PUBLIC_CLOUD_PROVIDER=firebase`.
3. Paste the Web App configuration values into the matching `NEXT_PUBLIC_FIREBASE_*` entries.
4. Restart the development server.

The Web App configuration is intended to be present in browser code. Do not put a Firebase service-account JSON file, private key, or password in this project.

## Publish the rules

1. In Firebase Console, open **Firestore Database > Rules** and replace its contents with `firebase/firestore.rules`.
2. Open **Storage > Rules** and replace its contents with `firebase/storage.rules`.
3. Publish both before creating a household in MomOS.

The rules allow household members to read their own household, permit the owner and approved editors to save data, and block everyone else. Media uploads are limited to images or PDFs under 15 MB.

## First backup

1. Open MomOS and use **More > Cloud protection**.
2. Create an email/password account.
3. Create the household and choose **Back up this device**.

Local saving remains on. Restoring a cloud backup asks before replacing the data currently shown on a device.

## Shared household access

After publishing the Firestore rules, the household owner can make a one-use invitation code from **More > Cloud protection > Shared access**. The recipient signs into their own MomOS account, pastes the code, and sends a request. The owner must explicitly approve it before the recipient receives access.

The owner can change a member's role, remove a member, decline a request, or revoke an unused code at any time. Invitation codes expire after seven days. The private vault is excluded from household sharing.

## Current scope

Firebase now supports sign-in, household creation, manual backup/restore, private media URLs, and owner-approved shared household invitations. Push notifications and background automation are next cloud features.


## Production readiness checklist

Before treating cloud as live for Mom:

1. Confirm all required `NEXT_PUBLIC_FIREBASE_*` values are present. Cloud protection now lists missing public keys when configuration is incomplete.
2. Enable Email/Password Authentication.
3. Publish `firebase/firestore.rules` and `firebase/storage.rules`.
4. Create a test owner account, create a household, and run **Back up this device**.
5. Upload at least one item photo and confirm it is moved to private household media storage during cloud backup.
6. Create helper, admin, and viewer invitations, then verify the owner approval step before access appears.
7. Confirm recent household activity records backup/access actions.
8. Turn off network temporarily, try a cloud backup, then reconnect and use the queued backup retry control.

Local browser saving remains the safety net even when cloud is unavailable.
