# Navigation QA Checklist

Use this checklist with the [Mom Home App Map](./app-map.md). It is a manual
click-through script for confirming that each documented button goes to the
expected page, form, or action before larger design changes are made.

## How To Use This Checklist

- Start from a fresh browser session or a known JSON backup.
- Keep browser dev tools closed unless debugging a failure.
- Check on desktop first, then repeat priority paths on iPhone Safari.
- Mark each row as Pass, Needs copy change, Needs layout change, or Broken.
- Do not redesign during the pass; capture findings first.

## Global Navigation

| Check | Expected result | Status |
| --- | --- | --- |
| Tap Today in bottom nav | Opens the Today home screen. |  |
| Tap Tasks in bottom nav | Opens the Tasks page. |  |
| Tap Calendar in bottom nav | Opens the Calendar page. |  |
| Tap Inventory in bottom nav | Opens the Inventory page. |  |
| Tap Ideas in bottom nav | Opens the Ideas page. |  |
| Tap More in bottom nav | Opens the More page. |  |
| Open printable report | Bottom nav is hidden while report is open. |  |

## Today Page

| Check | Expected result | Status |
| --- | --- | --- |
| Tap Add task | Opens the task form on Tasks. |  |
| Tap Add event | Opens the event form on Calendar. |  |
| Tap Add order | Opens the order form on Orders. |  |
| Tap Log energy | Shows the energy form on Today. |  |
| Tap Quick wins | Opens Tasks filtered to quick wins. |  |
| Tap Calendar shortcut | Opens Calendar. |  |
| Tap Low stock shortcut | Opens Low stock. |  |
| Tap Purchases shortcut | Opens Purchases. |  |
| Tap Calm shortcut | Opens Calm. |  |
| Tap Calm screen from Focus Season | Opens Calm. |  |
| Tap a task/do Today signal | Opens Tasks. |  |
| Tap a buy Today signal | Opens Orders. |  |
| Tap a take Today signal | Opens Supplements. |  |
| Tap a watch/calendar Today signal | Opens Calendar. |  |

## Tasks Page

| Check | Expected result | Status |
| --- | --- | --- |
| Tap Add | Opens blank task form. |  |
| Tap each task filter chip | Task list scope changes without leaving Tasks. |  |
| Tap Edit on a task | Opens that task in the task form. |  |
| Tap Done on a task | Task status changes to Done. |  |
| Tap Waiting on a task | Task status changes to Waiting. |  |
| Tap Delete on a task | Browser confirmation appears before deletion. |  |
| Tap Add project | Opens project form. |  |
| Tap Add task inside a project | Opens task form with project selected. |  |
| Tap Show/Hide finished | Finished project tasks toggle visibility. |  |
| Tap Add flag | Opens flag form. |  |
| Tap Add tag | Opens tag form. |  |


## Calm Page

| Check | Expected result | Status |
| --- | --- | --- |
| Tap Back to Today | Opens Today. |  |
| Change selected sound | Calm sound setting updates. |  |
| Tap Play sound | Browser plays or permits the selected generated sound. |  |
| Tap Use silent | Sound changes to Silent. |  |
| Tap timer preset | Focus Season duration updates without starting the timer. |  |
| Tap Open Focus Season | Opens Today. |  |
| Tap Show quick wins | Opens Tasks filtered to quick wins. |  |
| Tap Log energy | Shows energy journal form. |  |
| Tap Open help | Opens Help. |  |

## Calendar Page

| Check | Expected result | Status |
| --- | --- | --- |
| Tap Add event | Opens calendar form. |  |
| Tap Add task | Opens task form on Tasks. |  |
| Tap Previous / Next | Calendar month changes. |  |
| Tap Today | Calendar returns to today's month/date. |  |
| Tap a day cell | Selected-day agenda changes. |  |
| Tap Add in selected day | Opens event form for selected day. |  |
| Tap Edit on an event | Opens that event in the calendar form. |  |
| Tap Open task on linked event | Opens linked task on Tasks. |  |
| Tap Delete on event | Browser confirmation appears before deletion. |  |
| Tap Coming up row | Calendar selects that row's date. |  |

## Inventory, Low Stock, And Places

| Check | Expected result | Status |
| --- | --- | --- |
| Open Inventory from bottom nav | Item list appears. |  |
| Add or edit an item | Item form opens and saves back to Inventory. |  |
| Tap Open item | Item detail appears. |  |
| Tap Add to order from item | Order form opens on Orders. |  |
| Tap Mark plenty / Mark out | Quantity status updates. |  |
| Open Low stock from Today or More | Low-stock page appears. |  |
| Tap Open item from Low stock | Opens item detail on Inventory. |  |
| Open Places and bins from More | Places page appears. |  |
| Add/edit a location | Location form opens and saves. |  |
| Add/edit a bin | Container form opens and saves. |  |
| Tap Copy scan link | Bin scan URL is copied when clipboard is available. |  |
| Tap Download QR | QR label action completes. |  |


## Ideas

| Check | Expected result | Status |
| --- | --- | --- |
| Open Ideas from bottom nav | Ideas board page appears. |  |
| Tap Add board | Board form appears. |  |
| Save a board with a name | Board appears in the active board list. |  |
| Open a board | Board detail, budget, filters, and card area appear. |  |
| Add/edit/remove a section | Section strip updates and cards stay on the board. |  |
| Add an idea card with note/link/photo fields | Card appears on the selected board. |  |
| Search/filter/sort cards | Board card list changes without deleting data. |  |
| Favorite cards and compare favorites | Comparison area shows selected favorite cards. |  |
| Copy card to another board | Same card appears on the other board without duplicate card details. |  |
| Convert card to task/order/item/project/reminder | Connected Mom Home record is created and the card remains. |  |
| Archive/delete/restore cards | Card leaves active list and can be restored from archive/trash. |  |
| Export or print a board | Board report action runs. |  |
| Archive and restore a board | Board leaves active list and can be restored. |  |

## Orders And Purchases

| Check | Expected result | Status |
| --- | --- | --- |
| Open Orders from More or Today | Orders page appears. |  |
| Tap Add order | Order form opens. |  |
| Tap Needed / Ordered / Received / All | Order list filters change. |  |
| Edit an order | Existing order opens in order form. |  |
| Open Purchases from More or Today | Purchases page appears. |  |
| Open an inventory item and tap Add purchase | Purchase form opens for that item. |  |
| Tap purchase filter chips | Purchase list filters change. |  |
| Tap Add to order from purchase | Order form opens on Orders. |  |
| Tap product/receipt links when present | External link opens. |  |

## Supplements, Reports, And More

| Check | Expected result | Status |
| --- | --- | --- |
| Open Supplements from More or Today signal | Supplements page appears. |  |
| Tap Add supplement | Supplement form opens. |  |
| Tap Log 1 taken / Log amount | Supplement log is added. |  |
| Tap Download PDF | Supplement PDF downloads. |  |
| Tap Print report | Report view opens and browser print starts. |  |
| Tap Open manual from More | Help page opens. |  |
| Tap Back in Help | Returns to More. |  |
| Tap Printable report from More | Report view opens. |  |
| Tap Back to More in report | Returns to More. |  |
| Tap Download JSON backup | JSON file downloads. |  |
| Choose JSON backup file | Restore preview appears before any replacement. |  |
| Tap Cancel backup review | Restore preview closes with no data change. |  |

## Findings Template

Copy this section for each issue found.

```text
Page:
Button/action:
Expected:
Actual:
Severity: Broken / Confusing / Copy issue / Layout issue
Device/browser:
Screenshot needed: Yes / No
Notes:
```


## Cloud Protection QA

| Check | Expected result | Status |
| --- | --- | --- |
| Open More with cloud unconfigured | Cloud protection lists local mode and missing public configuration keys. |  |
| Sign in or create account when configured | Account flow completes without changing local data. |  |
| Create household | A cloud household appears and the first backup is saved. |  |
| Back up this device while online | Cloud revision increments and latest backup metadata updates. |  |
| Back up this device while offline | A pending cloud backup is queued locally for retry. |  |
| Retry queued backup when online | Queued copy uploads and clears from the device. |  |
| Check cloud backup | Restore review appears before replacing local data. |  |
| Create helper/admin/viewer invite as owner | Invite code appears and requires approval after recipient requests access. |  |
| Approve/reject/remove/update role | People/access lists refresh and recent activity records the action. |  |


## Phase 4 Alerts QA

- [ ] From Today, tap `Ask help`; confirm the Alerts screen opens with the help request form.
- [ ] Add a helper contact with phone/email; confirm it appears in Helper contacts.
- [ ] Create a normal help request; confirm Copy, Text, Email, Resolve, and Cancel controls are visible.
- [ ] Create an urgent helper alert; confirm non-911 wording remains visible.
- [ ] Add an ordered item with an expected delivery date; confirm it appears in Delivery reminder watch.
- [ ] Enable a calendar nag reminder and confirm the default repeat interval setting is respected.
- [ ] Open Tasks → Project map and confirm the task unlock flowchart preview is readable.

## Phase 5 Purchases / AI QA

- [ ] Open Purchases and confirm the local Purchase AI docket appears.
- [ ] Tap `Import text`, paste receipt/email text, and confirm a review queue card appears.
- [ ] Review an import as a purchase and confirm the purchase form is prefilled.
- [ ] Save receipt text and confirm the purchase card says the receipt is saved.
- [ ] Tap `Refresh local matches` and confirm checked-at/local summary fields update.

## Phase 6 Vault QA

- [ ] Open More → Private vault.
- [ ] Create an encrypted vault note with a passphrase of at least 8 characters.
- [ ] Confirm the note is unreadable until the passphrase is entered.
- [ ] Unlock with the correct passphrase, then lock it again.
- [ ] Try a wrong passphrase and confirm the app shows an error without revealing plaintext.
- [ ] Confirm vault plaintext does not appear in Assistant handoff or printable reports.
