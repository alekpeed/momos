# Mom Home — Feature Checklist (native iOS)

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

## Design & submission readiness
- [x] "Warm Paper" design system (light + dark)
- [x] Category color code (Do purple, Buy sage, Take amber, Watch periwinkle, Help rose)
- [x] App icon (gold house + heart)
- [x] Privacy manifest (`PrivacyInfo.xcprivacy`)
- [x] Encryption export compliance (`ITSAppUsesNonExemptEncryption = NO`)
- [x] Accessibility: VoiceOver labels on icon-only controls, Dynamic Type
- [x] iPhone-only target

---

## Not yet built (planned)

### Cloud sync & sharing (Tier 3 — needs Firebase/Supabase accounts)
- [ ] Sign in / accounts
- [ ] Cloud database + cloud photo storage
- [ ] Shared access for a helper (son)
- [ ] Roles & permissions
- [ ] Audit log of helper actions
- [ ] Offline-friendly sync

### Ideas under consideration
- [ ] **Explain mode** — a switch that turns the app into a guided state where tapping
  any control tells her what it does and how to use it, instead of performing the
  action. (See discussion; strong candidate.)
- [ ] Calm ambient sounds
- [ ] Personalized guide (her name, real helper names)

---

## Build & release status (tiers)
- **Tier 0 — first compile in Xcode:** pending (needs Apple Developer setup)
- **Tier 1 — submission readiness:** done
- **Tier 2 — feature parity:** done
- **Tier 3 — cloud + sharing:** planned (needs accounts)
- **Tier 4 — App Store submission:** pending (needs a running build for screenshots)
