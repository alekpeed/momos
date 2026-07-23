# MomOS — Feature Checklist (native iOS)

The running source of truth for what's planned vs. built in the native SwiftUI app.
Web app is retired; "done" means done in the native app.

**Legend:** `[x]` in the app · `[~]` partial / simpler than the original web version · `[ ]` planned, not yet built

_Last updated: 2026-07-23_

---

## Inventory & storage
- [x] Inventory records (name, category, quantity, notes)
- [x] Rooms / locations & bins
- [x] Item photos (camera / library)
- [x] Low-stock view (Low/Out surface on Today)
- [x] QR labels for bins
- [x] QR **scanning** to open a bin _(new in native)_

## Tasks
- [x] Custom tasks (add/edit, done/waiting)
- [x] Stars, effort sizes, quick wins
- [x] Tags
- [~] Custom flags (native uses star + "needs a hand" + tags instead of a separate flag object)
- [x] Prerequisites / blocked-by, project grouping
- [x] Task unlock map (dependency "flowchart")

## Calendar & reminders
- [x] Calendar with events
- [x] Recurring events (daily/weekly/monthly/yearly, with last-day clamp)
- [x] Local reminders + permission handling
- [x] Default nag / repeat interval setting

## Orders & purchases
- [x] To-order list (status, store, expected delivery date)
- [x] Purchase history
- [x] Receipt text capture + import review
- [~] Delivery reminder "watch" (date tracked; no dedicated watch screen)
- [ ] AI-style purchase docket / replacement & substitute suggestions
- [ ] Retailer provider adapters, confidence + checked-at labels

## Supplements
- [x] Tracker, log taken, low-count warning
- [x] PDF and CSV report export

## Ideas / Visual Planner
- [x] Boards & cards (note, link, photo)
- [x] Favorites + compare
- [x] Search / sort
- [x] Archive / restore
- [x] Convert a card → task / order / item / reminder
- [ ] Sections, budget/comparison, color extraction, duplicate-image detection, smart collections

## Help & alerts
- [x] Helper contacts
- [x] Help requests via text / email / copy (pre-written)
- [x] Urgent, clearly non-911 wording

## Calm, energy & wellbeing
- [x] Calm screen with breathing + adjustable Focus Season timer
- [~] Calm sound options (timer/breathing yes; audio not yet)
- [x] Energy journal (private)

## Private vault
- [x] Client-side encrypted notes (AES-GCM + PBKDF2)
- [x] Alphanumeric passphrase, no biometrics, local lock/unlock
- [x] Excluded from helper / AI / reports
- [ ] Recovery-key ceremony (always future)

## Data & foundation
- [x] Local-first storage (SwiftData)
- [x] Full JSON backup + restore with preview
- [x] App-wide search _(new in native)_
- [x] First-run onboarding _(new in native)_
- [~] General CSV/text export of all data (JSON backup + supplement CSV exist; no universal CSV dump)

## Guided help (Explain mode)
- [x] Explain-mode engine — a switch that intercepts taps and, instead of acting,
  shows a plain-language explanation; a top banner, a dashed cue on each control,
  and an explanation card
- [x] Toggle in Settings, plus a floating "?" button on every screen to turn it
  on from anywhere (and the banner's Done to turn it off)
- [x] Every screen wired — Today, Tasks, Calendar, Inventory, Low stock, Places
  & bins, Orders, Purchases, Ideas, Supplements, Help, Vault, and More all
  explain their controls (37 explanations)

## Design & submission readiness
- [x] "Warm Paper" design system (light + dark)
- [x] Category color code (Do purple, Buy sage, Take amber, Watch periwinkle, Help rose)
- [x] App icon (gold house + heart)
- [x] Privacy manifest (`PrivacyInfo.xcprivacy`)
- [x] Encryption export compliance (`ITSAppUsesNonExemptEncryption = NO`)
- [x] Accessibility: VoiceOver labels on icon-only controls, Dynamic Type
- [x] iPhone-only target

---

## In progress / planned

### Cloud sync & sharing (Tier 3 — Firebase, project `kmos-3da65`)

Native Firebase (Auth + Firestore + Storage) is now wired into the Xcode project
and the security rules are written. What's coded vs. still pending:

- [x] Firebase SDK linked into the app (SPM: Auth, Firestore, Storage)
- [x] Sign in / create account (email + password)
- [x] Household create + membership
- [x] Shared access for a helper — invite codes + join by code
- [x] Roles & permissions (owner / helper / viewer) enforced in Firestore rules
- [x] Audit log of cloud actions (append-only)
- [x] Firestore + Storage security rules (`firebase/`)
- [ ] **Cloud data sync** — pushing/pulling items, tasks, etc. (next increment)
- [ ] **Cloud photo storage** — uploading item/receipt images (next increment)
- [ ] Offline-friendly sync (Firestore's offline cache; wired with data sync)
- [ ] **Your console steps** — register the iOS app, download
  `GoogleService-Info.plist`, enable Email/Password auth, publish the rules
  (see `docs/firebase-setup.md`)

> Note on the invite model: the current flow is a **self-join code** (owner makes
> a time-limited code; whoever enters it joins immediately with that role), which
> is simpler than the original "owner approves each request." Say the word to add
> the approval step back.

### Ideas under consideration
- [ ] Calm ambient sounds
- [ ] Personalized guide (her name, real helper names)

---

## Build & release status (tiers)
- **Tier 0 — compiles:** ✅ done — green on a macOS runner (Xcode 26 / iOS 26
  Simulator) via `.github/workflows/ios-build.yml`. Device signing / TestFlight
  still needs your Apple Developer account.
- **Tier 1 — submission readiness:** done
- **Tier 2 — feature parity:** done
- **Tier 3 — cloud + sharing:** in progress on Firebase (`kmos-3da65`). Accounts,
  household, sharing/roles, audit log, and security rules are coded; **cloud data
  sync + photo upload are the next increment**, and the Firebase console steps
  (`docs/firebase-setup.md`) are still yours to do before cloud goes live.
- **Tier 4 — App Store submission:** pending (needs a running build for screenshots)
