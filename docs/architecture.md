# MomOS MVP Architecture

## App Map

The current page and button flow is tracked in [MomOS App Map](./app-map.md). Use that document before changing navigation or adding major new screens.

## Current MVP

- Next.js, React, and TypeScript.
- Mobile-first PWA with an install manifest, iPhone/Android PNG icons, and a production-only service worker that caches the app shell without caching arbitrary external requests.
- Browser local storage under `mom-inventory-state-v1`.
- Photo support through iPhone camera/file input, stored as data URLs for the local MVP.
- QR generation for storage containers with scan URLs that open the matching bin.
- Custom task system with user-defined flags, tags, star mode, due dates, quick wins, and helper handoff text.
- Energy journal records that never drive proactive task suggestions unless Mom asks later.
- CSV, plain text, and JSON export from the device.

## Data Boundaries

The local state uses the same nouns as the future database:

- households
- users
- household_members
- locations
- containers
- items
- order_list_entries
- purchase_records
- tasks
- task_flags
- task_tags
- energy_journal
- supplement_items
- supplement_logs
- helper_access_grants
- help_requests
- alert_events
- encrypted_vault_records
- vault_recovery_keys
- receipts
- replacement_searches
- replacement_options
- audit_sessions
- photos
- ai_logs

## Command Center Rules

- Flags and tags are fully user-defined. The app must not assign fixed meanings like "red means urgent."
- Tasks can combine flags, tags, stars, due dates, effort size, and help requests.
- Tasks should later support sequencing: prerequisites, blocked-by counts, project branches, and an "Everything Map" that shows what unlocks what.
- Star mode is a setting: off, one gold star, 0-3 stars, or 0-5 stars.
- Long task names must wrap. The UI should not hide critical wording behind ellipses.
- Energy notes are journaling data. AI may use them only after a direct user request.

## Purchase History And Replacement Search

Purchase history should be added before live retail search. The useful first version is manual: store, date, product name, quantity, price, product link, receipt link/photo, and whether the household liked that purchase.

Replacement search should sit on top of purchase history later. It should compare same-item matches, close substitutes, same-price options, cheaper alternatives, premium alternatives, and a few outliers. Every result needs a checked-at timestamp because prices and availability change.

The app should avoid brittle retailer scraping as a core dependency. Prefer official APIs, affiliate/product APIs, retailer-supported search endpoints, user-provided links, server-side providers, or AI-assisted research with confidence labels.

## Sequencing And Project Maps

The future task system should support several ways to see the same work:

- Tree view: good for household projects like "Kitchen" or "Bathroom project."
- Branch view: good for grouped subprojects and parallel work.
- Flowchart view: good when tasks unlock other tasks.
- Everything Map: one full household dependency map across projects, errands, inventory, ordering, and helper work.

Every blocked task should explain why it is blocked, how many prerequisites remain, and which prerequisite tasks unlock it.

## Helper Access, Vault, And Alerts

Helper access should be explicit and reversible. Mom can grant admin/helper access, but the private vault remains excluded.

The vault should be client-side encrypted before cloud sync. There should be no hidden backdoor. Recovery can use a user-approved recovery key flow, not silent access.

Emergency alerts can notify helpers, but the app must clearly say it is not a substitute for 911 or iPhone Emergency SOS.

## Supabase Cloud Bridge

The first cloud foundation keeps local storage as the always-available device copy and adds an explicit Supabase household snapshot:

1. Local edits continue to save immediately in the browser.
2. Cloud protection can upload a numbered household snapshot on request.
3. Restore first shows the cloud revision and date, then asks before replacing device data.
4. Row-level security limits every snapshot and media file to household members.
5. Owner, admin, helper, and viewer permissions are enforced in Postgres.
6. Local data-URL photos are moved into a private Storage bucket during cloud backup.

Automatic two-way synchronization is deliberately deferred until record-level conflict resolution, deletion tombstones, and an offline queue are implemented. A silent last-writer-wins system would be too risky for two daily users.

The next repository layer should split the AppState snapshot into record-level operations while preserving the current local fallback.

AI should sit behind a separate adapter and only create suggested actions until the user confirms them.

## Ideas / Visual Planner Architecture Notes

The Ideas section is being added as a local-first domain before any AI, retail
search, or scraping features. It uses separate board, section, card, and
placement records so one idea card can appear on multiple boards without
duplicating the underlying saved source. Idea cards should link to existing
inventory, task, calendar, order, purchase, and project records instead of
replacing those domains.

See [Ideas / Visual Planner](./ideas-visual-planner.md) for the product scope.

## Future backlog note

Speculative visual concepts, provider-dependent automation, AI behavior, and vault/security ideas should be tracked in [Future Ideas / Backlog](./future-backlog.md) until they are promoted into a scoped roadmap phase.
