# Firebase setup

Mom Home remains fully usable in local mode until Firebase is configured. Firebase adds optional cloud accounts, household backups, private photo storage, and restore across devices.

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
3. Publish both before creating a household in Mom Home.

The rules allow household members to read their own household, permit the owner and approved editors to save data, and block everyone else. Media uploads are limited to images or PDFs under 15 MB.

## First backup

1. Open Mom Home and use **More > Cloud protection**.
2. Create an email/password account.
3. Create the household and choose **Back up this device**.

Local saving remains on. Restoring a cloud backup asks before replacing the data currently shown on a device.

## Shared household access

After publishing the Firestore rules, the household owner can make a one-use invitation code from **More > Cloud protection > Shared access**. The recipient signs into their own Mom Home account, pastes the code, and sends a request. The owner must explicitly approve it before the recipient receives access.

The owner can change a member's role, remove a member, decline a request, or revoke an unused code at any time. Invitation codes expire after seven days. The private vault is excluded from household sharing.

## Current scope

Firebase now supports sign-in, household creation, manual backup/restore, private media URLs, and owner-approved shared household invitations. Push notifications and background automation are next cloud features.
