# Supabase Setup For MomOS

MomOS works without Supabase. Do this setup only when cloud accounts and backups are ready to be tested.

## What This Foundation Provides

- Email and password accounts.
- A separate household shared by approved members.
- Owner, admin, helper, and viewer roles.
- A protected household snapshot with numbered revisions.
- Private photo and receipt storage.
- An activity record for cloud backups.
- A future home for push-notification subscriptions.
- Local browser saving even when the internet or Supabase is unavailable.

The private vault is not part of the household snapshot. Helpers and admins cannot receive vault access through this permission system.

## Create The Supabase Project

1. Sign in at Supabase and create a project.
2. Open the SQL Editor.
3. Open `supabase/migrations/202607100001_cloud_foundation.sql` from this project.
4. Paste the complete SQL file into the SQL Editor.
5. Run it once.
6. Open Project Settings, then API.
7. Copy the Project URL.
8. Copy the publishable key. Never use the service-role key in this app.

## Connect The Local App

1. Make a file named `.env.local` beside `package.json`.
2. Use `.env.example` as the template.
3. Put the Project URL after `NEXT_PUBLIC_SUPABASE_URL=`.
4. Put the publishable key after `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`.
5. Restart the local MomOS server.
6. Open More, then Cloud protection.

The `.gitignore` file prevents `.env.local` from being committed to Git.

## First Account And Household

1. In More, open Cloud protection.
2. Choose Create account.
3. Enter a name, email, and password.
4. Confirm the email if the Supabase project requires confirmation.
5. Sign in.
6. Choose Create Mom's House.

Creating the cloud household uploads the current local data. It does not remove the device copy.

## Backup And Restore

- Back up this device sends the current device data to the selected cloud household.
- Check cloud backup only reads its date and revision first.
- Restore to this device appears after that review step.
- Restore asks for confirmation before replacing the current browser state.
- Downloaded JSON backups remain separate and are never changed by cloud restore.

The first cloud version intentionally uses explicit backup and restore controls. Automatic two-way synchronization needs record-level conflict handling and deletion history before it is safe for daily use on two devices.

## Photos

When a cloud backup finds a locally stored photo, it moves a cloud copy into the private `household-media` bucket and stores a protected reference in the cloud snapshot. Household members receive temporary signed links when viewing those photos.

The bucket is limited to 10 MB per file and accepts common image formats and PDF files. Storage policies require household membership for reading and an owner, admin, or helper role for uploading or changing files.

## Permission Rules

- Owner: controls the household and membership.
- Admin: manages shared household data and members.
- Helper: can update shared household work but cannot manage access.
- Viewer: read-only household access.
- Vault: excluded from this shared snapshot and restricted to its future separate encryption system.

Inviting another person by email will be added through a protected server function. The database invitation and membership structures are already present, but the client does not expose an unsafe direct invitation shortcut.

