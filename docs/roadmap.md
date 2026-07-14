# Mom Home Roadmap

## Design Direction Hold

Visual home-screen concepts and graphical interface exploration are intentionally
deferred. The app should continue using the current functional UI while Mom
Home's new visual direction is developed separately. Do not treat previous
Compass, Radar, Briefing, Universe, Portals, or other visual mockups as approved
product requirements. The stable data, navigation, accessibility, and action
contracts remain active so a future design can be installed without rewriting
the household engine.

## Phase 1: Local MVP

- iPhone-first PWA.
- Local browser storage.
- Inventory records.
- Locations and bins.
- Item photos.
- QR labels for bins.
- Low-stock view.
- To-order list.
- Purchase history.
- Custom tasks.
- Custom flags and tags.
- Star settings.
- Simple calendar.
- Energy journal.
- CSV, text, and JSON export.

## Phase 2: Mom-Ready Polish

- iPhone visual QA.
- Larger tap targets where needed.
- More forgiving empty states.
- Better photo compression.
- Backup import.
- User manual refinements.
- Supplement tracker.
- Calm screen with selected sound options.
- Adjustable focus timer.
- Task sequencing design: prerequisites, blocked-by counts, project trees, branch views, and Everything Map.

## Phase 3: Cloud Sync And Sharing

- Secure Firebase integration, membership roles, Firestore security rules, private media storage, and manual backup/restore foundation completed in code.
- Firebase production configuration and deployment verification.
- Login.
- Cloud database.
- Cloud photo storage.
- Shared access for son/helper.
- Explicit admin toggle.
- Permission model.
- Audit log for helper actions.
- Offline-friendly sync strategy.

## Phase 4: Reminders And Help

- Push reminders.
- Nag mode settings.
- Help request button.
- Emergency-style helper alert.
- SMS/email handoff fallback.
- Delivery reminder tracking from manually entered orders.
- Flowchart view for dependent tasks and project unlocks.

## Phase 5: Purchases And AI

- Receipt screenshot capture.
- Digital receipt links.
- Email parsing pipeline.
- Purchase import review queue.
- AI daily docket summary.
- AI search for same items, substitutes, price comparisons, and outliers.
- Store/provider adapter layer for Amazon, Walmart, Home Depot, and other retailers.
- Confidence labels and checked-at timestamps.

## Phase 6: Vault

- Client-side encrypted vault.
- Alphanumeric passphrase.
- No biometrics by default.
- Lockdown mode.
- Recovery-key workflow.
- Vault excluded from helper/admin access by default.
