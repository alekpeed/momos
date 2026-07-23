# Phase 1 Local MVP Audit

This audit translates the Phase 1 roadmap into a practical checklist for keeping
MomOS's first usable version stable before new cloud, AI, vault, or major
visual-direction work continues.

## Scope Guardrails

- Keep the app usable as a local-first iPhone PWA.
- Preserve the existing `AppState` snapshot model and Firebase integration while
  Phase 1 is being hardened.
- Do not require cloud sign-in, AI services, retailer APIs, or vault encryption
  for Phase 1 completion.
- Prefer small safety, clarity, export, and iPhone usability improvements over
  new interface concepts.

## Checklist

| Roadmap item | Current status | Evidence in repo | Post-completion validation |
| --- | --- | --- | --- |
| iPhone-first PWA | Code complete | Manifest, icons, service worker, mobile-first app shell | Live install/open/Add to Home Screen check. |
| Local browser storage | Complete | `STORAGE_KEY` local snapshot, migration path, unreadable backup preservation, and backup-size indicator | Live Safari storage and failure-message check. |
| Inventory records | Complete | Item forms, cards, detail view, CSV export | Live add/edit/search check. |
| Locations and bins | Complete | Location/container forms and bin detail views | Live bin assignment and empty-bin check. |
| Item photos | Complete | File-to-data-URL local photo flow with downscaling and JPEG compaction | Live iPhone camera/HEIC check. |
| QR labels for bins | Complete | QR generation for container scan URLs | Live printed/downloaded QR scan check. |
| Low-stock view | Complete | Low-stock item cards and order actions | Live low/out/too-much flow check. |
| To-order list | Complete | Order entries, order status filters, CSV export | Live needed/ordered/received flow check. |
| Purchase history | Complete | Purchase records, item purchase history, purchase CSV | Live item-based purchase entry check. |
| Custom tasks | Complete | Task forms, task filters, task cards, task CSV | Live long-title/reminder/tap-target check. |
| Custom flags and tags | Complete | User-defined flags and tags | Live custom marker clarity check. |
| Star settings | Complete | Configurable star modes | Live off/gold/3-star/5-star check. |
| Simple calendar | Complete | Calendar entries, recurrence, agenda, reminders while app is open | Live recurrence and open-app reminder check. |
| Energy journal | Complete | Energy journal entries with recent-note review | Live add/review note check. |
| CSV, text, and JSON export | Complete | Export helpers, dated filenames, report text download, and More screen buttons | Live Safari download/restore review check. |

## Completion Status

Phase 1 is complete from the repository/code side. See
[Phase 1 Completion Note](./phase-1-completion.md) for the final live validation
checklist before Phase 2 design and polish work.
