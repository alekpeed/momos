# Mom Home Roadmap

Current progress snapshot: see [Mom Home Project Status](./project-status.md). Current continuation instructions are in [Mom Home Handoff](./HANDOFF.md). Speculative and provider-dependent ideas are tracked in [Future Ideas / Backlog](./future-backlog.md).

## Design Direction Hold

Visual home-screen concepts and graphical interface exploration are intentionally
deferred. The app should continue using the current functional UI while Mom
Home's new visual direction is developed separately. Do not treat previous
Compass, Radar, Briefing, Universe, Portals, or other visual mockups as approved
product requirements. The stable data, navigation, accessibility, and action
contracts remain active so a future design can be installed without rewriting
the household engine.

Small interface placeholder previews may exist inside the app as functional
concept samples, but they must remain opt-in, use existing Mom Home actions, and
avoid replacing the current Today front door until a graphical direction is
explicitly approved.

## Phase 1: Local MVP

Status: complete from the repository/code side. See [Phase 1 Local MVP Audit](./phase-1-audit.md) and [Phase 1 Completion Note](./phase-1-completion.md) for implementation status and final live validation steps.

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

Status: complete from the repository/code side. See [Phase 2 Completion Note](./phase-2-completion.md).

- iPhone visual QA preparation and responsive polish.
- Larger tap targets where needed.
- More forgiving empty states.
- Better photo compression.
- Backup import/restore confidence.
- User manual refinements.
- Supplement tracker.
- Calm screen with selected sound options.
- Adjustable focus timer.
- Task sequencing design: prerequisites, blocked-by counts, project trees, branch views, and unlock-path review.


## Ideas / Visual Planner Track

Status tracking: see [Ideas / Visual Planner](./ideas-visual-planner.md). First local board-list UI is started.

This is a new planning track for Pinterest-like boards that connect visual ideas
to tasks, inventory, purchases, rooms, and projects. The first version should be
local-first and action-oriented: boards, sections, idea cards, fast capture,
search/filtering, archive/restore, and links into existing Mom Home records.

## Phase 3: Cloud Sync And Sharing

Status: complete from the repository/code side. See [Phase 3 Completion Note](./phase-3-completion.md).

- Secure Firebase integration, membership roles, Firestore security rules, private media storage, and manual backup/restore foundation completed in code.
- Firebase production configuration readiness and deployment verification checklist.
- Login.
- Cloud database.
- Cloud photo storage.
- Shared access for son/helper.
- Explicit admin/helper/viewer roles.
- Permission model.
- Audit log for helper actions.
- Offline-friendly sync strategy.

## Phase 4: Reminders And Help

Status: complete from the repository/code side. See [Phase 4 Completion Note](./phase-4-completion.md).

- Device/browser reminder foundation and permission status.
- Default nag/repeat interval setting for open-app reminders.
- Help request button from Today and the Alerts screen.
- Emergency-style helper alert with clear non-911 wording.
- SMS/email/copy handoff fallback through the device apps.
- Delivery reminder tracking from manually entered orders.
- Flowchart preview for dependent tasks and project unlocks.

## Phase 5: Purchases And AI

Status: complete from the repository/code side as a local-first, review-first purchase intelligence layer. See [Phase 5 Completion Note](./phase-5-completion.md).

- Receipt screenshot and receipt/email text capture.
- Digital receipt links.
- Purchase import review queue.
- Local AI-style daily purchase docket summary.
- Local search for same items, substitutes, comparison candidates, and avoid/outlier records.
- Provider adapter placeholders and boundaries for Amazon, Walmart, Home Depot, and other retailers.
- Confidence labels and checked-at timestamps.

## Phase 6: Vault

Status: complete from the repository/code side as a local encrypted vault foundation. See [Phase 6 Completion Note](./phase-6-completion.md).

- Client-side encrypted vault records.
- Alphanumeric passphrase.
- No biometrics by default.
- Local lock/unlock controls.
- Recovery-key workflow documented as future live/security validation.
- Vault excluded from helper/admin access, AI summaries, and normal reports by default.
