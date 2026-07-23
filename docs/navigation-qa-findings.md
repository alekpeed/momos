# Navigation QA Findings

This file records navigation QA passes against the [MomOS App Map](./app-map.md)
and [Navigation QA Checklist](./navigation-qa-checklist.md).

## Pass 1: Static Code Review

**Method:** Reviewed view rendering, `setView(...)` calls, form open helpers,
export actions, print actions, and clipboard actions in `app/page.tsx` against
the documented map and checklist.

**Result:** No blocking navigation mismatches were found in static review. The
major documented routes and button destinations have corresponding code paths.

## Confirmed Static Coverage

| Area | Static finding |
| --- | --- |
| Bottom navigation | Main nav buttons map to Today, Tasks, Calendar, Inventory, and More; report view hides the bottom nav. |
| Today | Add task, Add event, Add order, Quick wins, Calendar, Low stock, Purchases, and Today signal routing have code paths. |
| Tasks | Add/edit task, filters, project task opening, project creation, flags, and tags have code paths. |
| Calendar | Add event, Add task, day selection, month movement, selected-day add, event edit/delete, linked task open, and coming-up selection have code paths. |
| Inventory | Add item, open item detail, add purchase, reorder/add order, edit item, and quantity status actions have code paths. |
| Low stock | Add to order, open item, and quantity-status actions have code paths. |
| Places and bins | Container URL routing, item detail routing, QR download, and scan-link copy have code paths. |
| Orders | Add/edit order, More back link, and order list rendering have code paths. |
| Purchases | Purchase list, purchase export, purchase card order action, and More back link have code paths. |
| Supplements | Add/edit supplement, logging, PDF export, CSV export, print-report routing, and More back link have code paths. |
| More/help/report | Manual open/back, exports, backup restore review, report routing, and secondary page links have code paths. |

## Needs Manual Browser Verification

These items cannot be fully proven by static review and should be checked in a
running browser, then on iPhone Safari:

| Check | Why manual verification is needed |
| --- | --- |
| Clipboard copy actions | Browser permissions and HTTPS/context behavior can affect clipboard writes. |
| QR label download/open behavior | Needs confirmation that the generated label is readable and useful on device/print. |
| File downloads | Browser/device download handling differs between desktop and iPhone Safari. |
| JSON restore preview and confirmation | Must confirm the user-facing sequence feels safe and understandable. |
| Browser print/report flow | Print behavior differs across desktop, iPhone share sheet, and PWA mode. |
| Notification permission state | Browser and iPhone handling can vary and may need copy adjustments. |
| Tap targets | Requires actual touch/device review; static code cannot confirm comfort. |

## Issues Found

No code changes were required from the static pass. The next QA pass should be a
real click-through using `npm run dev` or a deployed preview, with results copied
into the issue template below.

## Manual Finding Template

```text
Date:
Tester/device/browser:
Page:
Button/action:
Expected:
Actual:
Severity: Broken / Confusing / Copy issue / Layout issue
Recommended fix:
Screenshot/video:
```

## Pass 2: Ideas Static QA And Cleanup

**Method:** Reviewed Ideas-specific view rendering, board/section/card forms, smart collections, conversion actions, archive/trash recovery, image palette/signature behavior, and docs against the Ideas QA checklist. Details are recorded in [Ideas QA Findings](./ideas-qa-findings.md).

**Result:** No blocking static Ideas navigation mismatch remains. Ideas is ready for Phase 2 usability polish and later live device validation.

## Pass 3: Local Validation Command Pass

**Date:** 2026-07-14

**Method:** Ran the repository handoff startup checks locally: `npm run typecheck`,
`npm run build`, and `npm run lint`. The first lint attempt reported that
ESLint was not present in `node_modules`; running `npm install` restored the
locked development dependencies, and the lint rerun passed cleanly.

**Result:** No code issues were found by local type checking, production build,
or lint. Remaining QA items still require a browser, iPhone Safari/Home Screen,
or live provider credentials.

## Recommended Follow-Up

1. Run the checklist in desktop browser against a local or preview build.
2. Repeat the highest-priority flows on iPhone Safari.
3. During Phase 2, fix any live-device issues found during browser/iPhone validation.
4. Update this findings file after each QA pass.
