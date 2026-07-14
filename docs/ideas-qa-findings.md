# Ideas QA Findings

This records the final static QA and cleanup pass for the local-first Ideas / Visual Planner feature.

## Pass 1: Static Ideas QA And Cleanup

**Method:** Reviewed the Ideas view, board/section/card forms, card actions, filters, smart collections, duplicate checks, conversion actions, archive/trash restore, export/print controls, migration defaults, and user-facing docs against `docs/ideas-visual-planner.md` and `docs/navigation-qa-checklist.md`.

**Result:** Ideas is ready to move out of active feature cleanup and into Phase 2 usability polish. No known blocking code-path mismatch remains from static review.

## Confirmed Static Coverage

| Area | Static finding |
| --- | --- |
| Boards | Add, edit, open, archive, restore, room assignment, and selected-board behavior have code paths. |
| Sections | Add, edit, remove, and placement cleanup have code paths. |
| Cards | Add, edit, archive, delete/restore, source fields, tags, status, priority, purpose, price, dimensions, colors, quantity, room, deadline, seasonal notes, stack, availability/fit notes, and related records have code paths. |
| Images | Uploaded images run through local data-URL handling, palette extraction, signature creation, first-color fallback, and duplicate-image comparison. |
| Search/filter/sort | Board cards support search plus status, priority, type, tag, price, and sort controls, with a reset action. |
| Smart collections | High priority, approved, under-$50, missing-price, and product views set filters without deleting data. |
| Comparison | Favorite cards can be compared; the empty comparison state explains that favorites are needed. |
| Conversions | Idea cards can create linked tasks, orders, inventory items, projects, and calendar reminders; conversion buttons disable after linking. |
| Recovery | Archived/deleted cards and archived boards can be restored from the archive/trash view. |
| Export/print | Selected board export and print actions have code paths. |
| Backup/restore | Ideas data is included in state, migration defaults, and restore preflight counts. |

## Cleanup Completed

- Removed an unused color-distance helper.
- Added price filtering for Under $50 and Missing price smart collections.
- Added Reset filters for Ideas board filters.
- Made smart collection buttons reset other Ideas filters before applying their own filter.
- Set newly saved boards/cards as the active board context.
- Added delete confirmation for Ideas cards.
- Disabled conversion buttons after a card is already linked to the created record.
- Added an empty comparison message when no favorites are selected.

## Remaining Manual Device Checks

These are not blockers for moving to Phase 2, but they should still be checked in a browser and eventually on Mom's iPhone:

| Check | Why manual verification is still needed |
| --- | --- |
| Photo upload and palette extraction | Needs a real browser file picker/camera flow. |
| Board print flow | Browser/iPhone print and save-as-PDF behavior varies by device. |
| Export download | iPhone Safari/PWA download handling can differ from desktop. |
| Tap comfort | Static review cannot prove thumb comfort on Mom's actual iPhone. |

## Conclusion

The Ideas feature is complete from the local/code side for this phase. The next project work should move to Phase 2 Mom-ready polish rather than more Ideas feature cleanup.
