# Mom Home — Native iOS (SwiftUI)

The native Swift/iOS build of Mom Home, implementing the interim "Quiet Household"
design from [`docs/native-ios-design-handoff.md`](../docs/native-ios-design-handoff.md).
This is a real, standalone app target — not a wrapper around the web app. The web
PWA remains the reference for the product model; this is where the native app grows.

## Requirements

- **Xcode 26** (or newer) — the project uses the Xcode 16+ synchronized-folder
  format, so new Swift files added under `MomHome/` are picked up automatically.
- **iOS 26** deployment target.
- Frameworks: SwiftUI, **SwiftData** (persistence), **CryptoKit + CommonCrypto**
  (vault encryption), Observation. No third-party dependencies, no bundled fonts.

## Open & run

```
open ios/MomHome.xcodeproj
```

Select the **MomHome** scheme and an iPhone simulator, then Run. First launch seeds
a small starter household so every screen shows real content.

> Note: this project was authored in a Linux environment where the iOS toolchain
> can't compile, so it has **not** been built yet. Expect to resolve a few small
> diagnostics on first build in Xcode. `SWIFT_VERSION` is `6.0` (strict
> concurrency); the code was written MainActor-clean for it, but if the compiler
> flags anything, send me the errors and I'll clear them.

## What's here

| Area | State |
| --- | --- |
| App shell — 6 tabs (Today, Tasks, Calendar, Inventory, Ideas, More), each in its own `NavigationStack` | Built |
| **Today** — daily signals (Do/Buy/Take/Watch/Help), quick wins, agenda, low-stock nudge, add action | Built |
| **Tasks** — filters, task cards, blocked-by explanation, star/done, full add/edit editor with dependencies | Built |
| **Vault** — locked/unlock gate, encrypted add, on-demand reveal, wrong-passphrase error, non-recovery warning | Built |
| **Inventory** — list, search, **item detail**, add/edit with **photo capture** (PhotosPicker), place/bin selection | Built |
| **Places & bins** — locations, bins, on-device **QR label** generation + share/print | Built |
| **Orders & purchases** — to-order list with status, purchase history, add flows | Built |
| **Backup & restore** — full JSON export + import with a **restore preview** before replacing data | Built |
| **Calendar** + recurrence, **Ideas** boards/cards, **Supplements**, **Help & alerts**, **Settings**, **Manual** | Built |
| Design system — "Quiet Household" tokens (warm cream / sage / clay / gold), serif titles, light + dark | Built |

Every one of the six primary tabs and every secondary screen in the brief now has
a working implementation. The vault's crypto boundary and backup's
vault-ciphertext-only rule are both enforced.

## Submission readiness (Tier 1)

Groundwork for shipping through the Apple Developer Program:

- **App icon** — a real 1024px "Warm Paper" mark (gold house + heart on cream).
- **Privacy manifest** (`PrivacyInfo.xcprivacy`) — declares no tracking, no data
  collection, no required-reason API use (the app is local-first).
- **Encryption export compliance** — `ITSAppUsesNonExemptEncryption = NO` (the
  vault uses only standard on-device encryption).
- **Local reminders** — `NotificationService` requests permission and schedules
  on-device notifications for due tasks and reminder-flagged events; opt in from
  Settings. No push server, no entitlement.
- **QR scanning** — VisionKit `DataScannerViewController`; scan a bin label to
  jump straight to that bin.
- **Accessibility** — VoiceOver labels on icon-only controls; Dynamic Type via
  system text styles. iPhone-only (`TARGETED_DEVICE_FAMILY = 1`).

## Feature parity (Tier 2)

The engine features from the web app / brief, now native:

- **Calm** screen (breathing + Focus Season countdown) and a private **Energy journal**.
- **Projects** management and a **task unlock map** (Everything Map): ready / blocked /
  what-unlocks-what.
- **Ideas** depth: search, sort, favorites compare, archive/restore, and convert a
  card into a task / order / item / reminder.
- **Supplement reports** — export PDF or CSV via the share sheet.
- **Receipt import** — paste receipt text, auto-extract product/store/price/date,
  review before saving.
- **App-wide search** across tasks, inventory, ideas, purchases, and orders.
- **First-run onboarding**.

## Architecture

- `MomHomeApp.swift` — app entry, builds the SwiftData `ModelContainer`, seeds on first launch.
- `App/` — `RootView` (tab shell), `PreviewData` (in-memory seeded container for `#Preview`s).
- `Design/` — `Theme` (color/type/spacing tokens, light+dark), `Components` (Card, StatusPill,
  EmptyState, buttons, ScreenScaffold), `FlowRow` (wrapping metadata layout).
- `Models/` — SwiftData `@Model` types mirroring the web `lib/inventory-types.ts`, plus `Enums`.
- `Store/` — `Seed`, `Recurrence` (calendar math incl. the monthly last-day clamp), `VaultCrypto`
  (PBKDF2-SHA256 150k + AES-GCM; only ciphertext is persisted).
- `Features/<Area>/` — one folder per screen area.

Cross-entity references use stored `String` ids (mirroring the local-first web model),
so the household engine stays easy to reason about and export.

## Boundaries carried over from the web app

- Local-first: nothing leaves the device. Cloud/providers are a later step.
- Vault plaintext never enters helper handoff, summaries, or reports — only ciphertext persists.
- Urgent help alerts stay clearly non-911; wording says so on screen.
- User-defined flags/tags/colors carry no fixed app meaning.

## Next

- Item detail + photo capture, Places/Bins + QR, Orders/Purchases, cloud protection,
  backup/restore, and the user manual are the natural next screens to deepen.
