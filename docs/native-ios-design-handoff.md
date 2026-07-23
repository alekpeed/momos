# Native Swift iOS Design Handoff

This document is a packageable brief for a third-party designer or Swift/iOS
team. It describes the current Mom Home product, the interim iOS interface to
request, the non-negotiable product boundaries, and the assets/specifications the
team should return.

## Copy-Paste Vendor Brief

> We are designing an interim native iOS interface for **Mom Home**, a calm
> household command center for one primary user, "Mom," and optional helpers.
> The current implementation is a local-first web/PWA app with working flows for
> Today, tasks, calendar, inventory, places/bins, low stock, orders, purchases,
> supplements, ideas, helper alerts, exports/backup, cloud protection, and an
> encrypted local vault. We are **not** asking for the final graphical/3D
> interface yet. That will be a separate future design project. For now, design a
> nicer, elegant, native Swift/iOS interface that preserves the existing product
> model and actions.
>
> Please produce a polished iPhone-first design system and screen set that could
> be implemented in SwiftUI. The design should feel calm, warm, trustworthy,
> legible, and highly usable for an older or overwhelmed household manager. It
> should not feel like a generic enterprise dashboard, a medical app, a game, or
> a sci-fi interface. Do not invent a replacement product concept. Use the
> existing Mom Home screens, records, and action flows as the source of truth.
>
> The immediate goal is an interim native interface that looks much better than
> the current functional web UI, while keeping every major action easy to find.
> The later fully graphical/3D interface should remain possible, so please keep
> the design modular and avoid locking the product into a heavy visual metaphor.

## Product Context

Mom Home is a local-first household command center. It helps Mom remember,
organize, and hand off household work without needing a complicated productivity
system.

Current implemented areas:

- Today front door with daily signals, quick actions, focus options, and
  shortcuts.
- Tasks with custom flags, tags, stars, due dates, quick wins, projects,
  dependencies, and helper-needed states.
- Calendar with dated tasks, events, reminders, recurrence, and selected-day
  agenda.
- Inventory with items, locations, containers/bins, photos, low-stock paths, and
  QR labels.
- Orders and purchase history with delivery watch and replacement intelligence
  foundations.
- Supplements with logs, count warnings, reports, and cautious health copy.
- Ideas / Visual Planner with boards, sections, cards, photos, links, filters,
  comparison, archive/restore, and conversion actions.
- Help and alerts with helper contacts, help requests, urgent non-911 language,
  SMS/email/copy fallback, and provider endpoint readiness.
- Export, backup, restore, cloud protection, and encrypted local vault.

The repository estimates the overall project at 82% complete because the local
app is mostly code-complete, but production validation, live iPhone QA, live
providers, automatic sync, visual polish, and security validation remain.

## Design Goal

Create a native iOS design direction that is:

- **Calm:** reduces overwhelm and avoids clutter.
- **Elegant:** polished enough to feel custom and cared for.
- **Legible:** large type, clear hierarchy, visible states, strong contrast.
- **Action-oriented:** every card should answer "what can Mom do now?"
- **Forgiving:** empty states, confirmation steps, and restore/destructive flows
  should feel safe.
- **Local-first:** should work conceptually without internet or provider setup.
- **Helper-aware:** helper actions exist, but Mom remains in control.
- **Vault-safe:** private vault content must remain visually and conceptually
  separate.

## Non-Negotiable Boundaries

- Do **not** replace the product with a new app idea.
- Do **not** design the future 3D/graphical interface as the immediate build.
- Do **not** rely on live AI, live retailers, live SMS/email sending, or live
  push as required for the base experience.
- Do **not** hide critical task names, warnings, quantities, dates, or backup
  language behind tiny text or ellipses.
- Do **not** assign fixed meanings to user-defined flags or colors. Mom defines
  those meanings.
- Do **not** make the vault feel casually accessible. It is private, encrypted,
  and excluded from helper/AI/report flows.
- Do **not** make urgent helper alerts look like emergency dispatch. The app must
  remain clear that it is not 911 or iPhone Emergency SOS.

## Recommended Interim Interface Direction

Use a refined native SwiftUI style called **Quiet Household**:

- Warm off-white or soft cream base.
- Deep sage / muted teal primary actions.
- Soft clay, oatmeal, lavender-gray, and warm gold accents.
- Rounded cards with subtle depth, not glassmorphism everywhere.
- Large titles, readable body text, and generous spacing.
- Bottom tab bar for the six primary sections.
- Contextual action sheets for secondary actions.
- Calm inline progress/status indicators rather than noisy badges.
- Optional lightweight motion for transitions, but no distracting animation.

The style should feel like a premium home organizer, not a hospital dashboard or
project-management SaaS tool.

## Primary Navigation

Keep the six main destinations aligned with the current app:

1. **Today** — daily front door.
2. **Tasks** — task list, filters, projects, flags, tags.
3. **Calendar** — month/week/day agenda and reminders.
4. **Inventory** — items, search, photos, low-stock, item detail/history.
5. **Ideas** — visual boards/cards and planning.
6. **More** — settings, cloud, exports, backup/restore, manual, secondary areas.

Secondary sections can live behind More, contextual cards, or related shortcuts:

- Low stock.
- Places and bins.
- Orders.
- Purchases.
- Supplements.
- Help manual.
- Help requests / alerts.
- Calm screen.
- Printable/export report.
- Private vault.

## Required Screen Set

The designer should produce at least these iPhone screens:

### 1. Today

Purpose: calm daily entry point.

Must show:

- Date and household name.
- 3-5 primary signals, such as Do, Buy, Take, Watch, Help.
- Quick wins.
- Today calendar/agenda preview.
- Low-stock or order nudge if relevant.
- Calm/focus affordance.
- One obvious Add action.

Design notes:

- Today should not feel like a dense dashboard.
- Use calm cards and progressive disclosure.
- Avoid replacing Today with the future 3D interface.

### 2. Tasks

Must show:

- Task filters: Open, Next up, Today, Starred, Quick wins, Help, All.
- Task cards with status, due date, stars, flags/tags, effort, project, blocked
  state, and help-needed state.
- Add/edit task flow.
- Project/dependency preview.

Design notes:

- Blocked tasks must explain what unlocks them.
- Long task titles must wrap.

### 3. Calendar

Must show:

- Month or week/date selector.
- Selected-day agenda.
- Dated tasks and calendar entries.
- Reminder state.
- Add event / add dated task actions.

### 4. Inventory

Must show:

- Search.
- Item list.
- Quantity status.
- Location/container.
- Photo thumbnail.
- Item detail with add-to-order and purchase history affordances.
- Low-stock path.

### 5. Places and Bins

Must show:

- Location hierarchy.
- Container/bin list.
- QR label affordance.
- Items in a selected bin/place.

### 6. Orders and Purchases

Must show:

- To-order list by urgency/status.
- Purchase history detail.
- Reorder/replacement review areas.
- Receipt/email import review as "review before saving," not automatic import.

### 7. Supplements

Must show:

- Supplement list.
- Remaining count / low threshold.
- Dose instructions as user-entered reference copy.
- Log taken action.
- Report/export affordance.

Design notes:

- Avoid medical recommendation language.

### 8. Ideas / Visual Planner

Must show:

- Boards.
- Sections.
- Idea cards with photo/link/note/product fields.
- Favorite/compare states.
- Search/filter/sort.
- Convert idea to task/order/item/project/reminder.

### 9. Help and Alerts

Must show:

- Helper contacts.
- Help requests.
- Urgent non-911 alert language.
- Copy, text draft, email draft, and provider-send status if configured.

### 10. More / Settings / Backup / Cloud

Must show:

- Settings.
- User manual.
- Cloud protection status.
- Export and backup actions.
- Restore with preview before replacing data.
- Private vault entry.

### 11. Vault

Must show:

- Locked state.
- Unlock passphrase flow.
- Add encrypted note flow.
- Clear warning that forgotten passphrases may not be recoverable.
- Separation from helper/admin/AI/report flows.

## Native iOS / SwiftUI Implementation Expectations

Ask the designer to think in SwiftUI components, even if they work in Figma:

- `TabView` for the main six tabs.
- `NavigationStack` per tab.
- Reusable card components for task, item, order, purchase, idea, supplement, and
  help request summaries.
- Large tap targets, ideally 44pt minimum.
- Dynamic Type support.
- Light mode first; dark mode optional but useful.
- VoiceOver labels for icon-only controls.
- Safe-area-aware bottom navigation.
- Confirmation dialogs for destructive/restore/vault actions.
- Native share sheet affordances for exports/helper handoffs.
- Camera/photo picker affordances for item and idea photos.
- QR scanning/label surfaces for places and bins.

## Data Model Summary For Designers

Use these nouns exactly in labels, screens, and component names where practical:

- Household.
- Item.
- Location.
- Container / Bin.
- Order.
- Purchase.
- Receipt import.
- Task.
- Project.
- Dependency / blocked by.
- Flag.
- Tag.
- Star.
- Calendar entry.
- Reminder.
- Supplement.
- Supplement log.
- Idea board.
- Idea card.
- Helper contact.
- Help request.
- Alert.
- Backup.
- Restore preview.
- Cloud protection.
- Private vault.

## Deliverables To Request From The Designer

Minimum useful package:

1. **Figma file** with named pages:
   - Product overview.
   - Design system.
   - iPhone screens.
   - Components.
   - Interaction notes.
   - Accessibility notes.
2. **Clickable prototype** covering:
   - Today → task/order/calendar/inventory paths.
   - Inventory item detail → add to order/purchase history.
   - Help request → copy/text/email flow.
   - Backup/restore preview.
   - Vault locked/unlocked state.
3. **Design tokens**:
   - Colors.
   - Type scale.
   - Spacing.
   - Corner radii.
   - Shadows/elevation.
   - Icon style.
4. **SwiftUI component inventory**:
   - Tab bar.
   - Top header.
   - Section header.
   - Primary card.
   - Status pill.
   - Signal card.
   - Empty state.
   - Form row.
   - Confirmation panel.
5. **Screen-by-screen implementation notes**:
   - Data shown.
   - Primary actions.
   - Secondary actions.
   - Empty states.
   - Error/warning states.
6. **Exported assets**:
   - App icon direction.
   - Any custom icons as SVG/PDF vector assets.
   - Placeholder illustrations if used.

## Example Instruction Email

Subject: Native iOS design brief for Mom Home interim interface

Hi — I need an interim native iOS interface designed for Mom Home.

The current app is a working local-first household command center. I am planning
a more ambitious graphical/3D interface later, but this project is **not** that
final interface. For now, I need a polished, calm, elegant SwiftUI-ready iPhone
design that preserves the existing product structure and actions.

Please use the attached/native handoff as the product source of truth. The main
six areas are Today, Tasks, Calendar, Inventory, Ideas, and More. Secondary areas
include Low stock, Places/Bins, Orders, Purchases, Supplements, Help/Alerts,
Backup/Restore, Cloud protection, Calm, and Private Vault.

The design should feel warm, trustworthy, premium, and simple. It should be very
legible, use large tap targets, support Dynamic Type, and make backup/restore,
helper alerts, and vault privacy feel safe. Please do not invent a different app
or use live AI/retailer/SMS/push services as required assumptions.

Requested deliverables:

- Figma design system.
- iPhone screen set.
- Clickable prototype.
- SwiftUI component inventory.
- Design tokens.
- Accessibility notes.
- Exported vector/icon assets.

Please start with Today, Tasks, Inventory, Help/Alerts, Backup/Restore, and Vault
as the highest-priority screens.

## Files To Send With This Brief

Send these repository docs to the designer with this handoff:

- `docs/native-ios-design-handoff.md` — this package.
- `docs/project-status.md` — current completion and remaining validation.
- `docs/roadmap.md` — active/deferred roadmap boundaries.
- `docs/app-map.md` — current page/action map.
- `docs/architecture.md` — product/data boundaries.
- `docs/future-backlog.md` — future ideas that should not be treated as current
  scope unless explicitly approved.
- `docs/provider-automations.md` — provider boundaries and review-first rules.
- `docs/phase-6-completion.md` — vault/security boundary details.

## Acceptance Criteria

A design pass is successful if a Swift/iOS developer can answer:

- What are the main tabs?
- What records exist?
- What actions exist on each screen?
- Which actions are local-only?
- Which actions require review before saving/sending?
- Which areas are future/provider-dependent?
- Which areas are private and excluded from helper/AI/report flows?
- What visual tokens and reusable SwiftUI components should be built?

The design should be attractive enough to use as the interim native app, but
modular enough that the later graphical/3D interface can replace the front door
without rewriting the whole household engine.
