# MomOS User Manual

## Overview

MomOS is an iPhone-friendly home screen app for household inventory, tasks, ordering, and simple daily planning.

Main sections:

- Today: a switchable daily command center built from current household data.
- Tasks: custom tasks with Mom's own flags, tags, stars, due dates, and notes.
- Calendar: calendar entries, dated tasks, recurrence, reminders, and nag mode.
- Inventory: household items, photos, quantities, locations, and purchase history.
- Purchases: saved receipts, vendors, order numbers, screenshots, and reorder notes.
- Supplements: bottles, remaining count, reorder timing, and taken logs.
- Ideas: visual planning boards for inspiration, future purchases, repairs, recipes, and projects.
- More: cloud protection, settings, exports, backup restore, helper handoff text, iPhone install steps, and extra household areas.

## Today

Use Today when she opens the app and wants to understand what matters now.

- Tap Task to add anything that needs doing.
- Tap Event to add something to the calendar.
- Tap Order to add something to buy.
- Tap Energy to record how she feels. This is only a journal entry. Recent notes can be reviewed for memory, but they do not make the app suggest, rank, or alert on tasks unless she asks for that later.

The daily brief currently summarizes saved app data directly. It does not call an AI service yet. A later AI connection can rewrite and expand the summary without changing the underlying household records.

## Today Lenses

Today has five lenses. A lens is a different way to look at the same household data.

The important rule: there is still only one set of real data. A task, supplement, purchase, order item, location, or helper request should not be duplicated just because Mom changes views. The lens changes the presentation, not the truth.

Available Today lenses:

- Briefing Desk: a practical daily brief with live signals and pinned counts. Best when she wants a clear summary.
- Command Compass: a bold control surface with DO, BUY, TAKE, and WATCH zones. Best when she wants fast orientation and a direct next action.
- Household Radar: an attention map where important signals move closer to the center. Best for unpredictable days when she wants to know what is pinging for attention.
- Verb Universe: a minimalist verb-based home screen with DO, BUY, TAKE, WATCH, and HELP orbiting one central focus. Best when she wants a clean front door that reveals depth only after she chooses a verb.
- Verb Portals: a more atmospheric version of the verb idea where each verb feels like entering a focused room. Best as design inspiration or an optional mode if it remains easy to navigate.

Possible additional view:

- Project Constellation: a relationship map for projects, dependencies, inventory, ordering, and helper access. This is better as a map or project view than the default daily home screen.

Rejected as default daily direction:

- Living Timeline: a day-flow view. It is elegant, but too structured for Mom's unpredictable day-to-day style.

Suggested behavior:

1. Tap Brief, Compass, Radar, Universe, or Portals at the top of Today.
2. The selected lens is saved as the default.
3. Tap Chief, Errands, Household, or Quiet to narrow the same live signals.
4. Chief shows the broad daily picture.
5. Errands concentrates on buying and help signals.
6. Household concentrates on tasks, records, and things being watched.
7. Quiet removes proactive task signals and keeps only calendar and record-keeping signals.
8. Energy journal data is record-only unless Mom explicitly asks AI to use it.

## Focus Season

Focus Season is an adjustable timer on Today. It can be used for a specific open task or simply for whatever Mom chooses to work on.

1. Choose a task under `Focus on`, or leave it set to `Anything I choose`.
2. Choose 5, 15, 25, 45, or 60 minutes, or type any value from 1 to 180 minutes.
3. Tap `Start`. Use `Pause` when needed; `Restart` starts the selected length again.
4. When a task is selected, `Open task` returns to its full record.

The timer keeps its place if the page refreshes. While MomOS is open, it can play a gentle chime and show a device notification when alerts have been enabled. It is not a background iPhone timer yet.

## Help Requests And Alerts

Use Help requests when Mom needs another person to step in. This area is for human handoff, not emergency dispatch.

1. From Today, tap `Ask help`, or open More → Help requests.
2. Add trusted helper contacts with phone and/or email.
3. Create a help request with a title, details, urgency, optional related task, and optional related order.
4. Use `Copy`, `Text`, or `Email` to send the prepared message through the device. MomOS does not silently send messages.
5. Mark the request resolved or cancelled when it is handled.

The urgent helper alert is clearly labeled as not 911. If there is a real emergency, call 911 or local emergency services.

Delivery watch lists ordered or purchased items with expected delivery dates. Late or due-today deliveries can become help requests.

## Tasks

Tasks can be simple or detailed.

Each task can have:

- A full title that wraps instead of being cut off.
- Notes.
- Status.
- Due date.
- Stars.
- Effort or size.
- Project.
- Tasks that must happen first.
- Custom flags.
- Custom tags.
- A related inventory item.
- A help-needed marker.

## Task Projects And Sequencing

Projects group related tasks, such as a kitchen cleanout or bathroom project.

To add a project:

1. Go to Tasks.
2. Find Project map.
3. Tap Add project.
4. Enter the project name.
5. Pick an optional color.
6. Add notes if helpful.
7. Tap Save project.

To make one task wait for another:

1. Go to Tasks.
2. Tap Edit on the task that has to wait.
3. Under Must happen first, select the task or tasks that need to be finished first.
4. Tap Save task.

Use the Next up filter to see tasks that are not blocked by unfinished earlier tasks.

MomOS prevents circular waiting loops. For example, if Task A already waits on Task B, the app will not let Task B be changed to wait on Task A.

The Project map shows each project as a readable tree/list plus a small flowchart preview of which tasks unlock other tasks.

## Custom Flags

Mom defines every flag herself.

To add a flag:

1. Go to Tasks.
2. Tap Add flag.
3. Enter the flag name.
4. Pick the color.
5. Pick the shape.
6. Add an optional symbol.
7. Write what the flag means to her.
8. Tap Save flag.

The app does not decide what any color means.

## Custom Tags

Tags are optional labels Mom can create and combine with flags.

To add a tag:

1. Go to Tasks.
2. Tap Add tag.
3. Enter the tag name.
4. Pick an optional color.
5. Tap Save tag.

## Stars

Stars are controlled in More.

Available star systems:

- 0 to 3 stars.
- 0 to 5 stars.
- One gold star.
- Stars off.

Changing the star system keeps existing tasks but lowers star counts if needed.

## Calendar

Calendar combines calendar entries and dated tasks.

The month grid shows:

- A round color marker for each calendar entry.
- A square blue marker when a task is due.
- A count when the day contains anything scheduled.
- A clear outline around the selected day.

Tap a day to open its agenda. The Coming up section shows the next twelve calendar entries and dated tasks within sixty days.

Calendar entries can include:

- Title and notes.
- Date, start time, and end time, or all day.
- Location.
- A custom color.
- Daily, weekly, monthly, or yearly recurrence.
- An optional end date for recurrence.
- A reminder time.
- Nag mode with a custom repeat interval.
- A linked task.

To add an entry:

1. Open Calendar.
2. Tap the day you want.
3. Tap Add event or Add in the selected-day panel.
4. Enter only the details that are useful.
5. Tap Save entry.

Device alerts require permission. In this local MVP, reminders and repeat alerts can alert while MomOS is open. True background iPhone push notifications require the later cloud notification service. Calendar entries are already structured for that upgrade.

Task reminders use the Reminder field inside the task editor and appear alongside calendar entries.

## Inventory

Inventory stores physical household items.

Each item can include:

- Name.
- Category.
- Location.
- Container or bin.
- Quantity status.
- Count and unit.
- Condition.
- Photo.
- Expiration date.
- Preferred store.
- Product link.
- Notes.

Incomplete records are okay. A name and location are enough to start.

When an item is opened, the detail screen shows:

- Photo or item placeholder.
- Category, location, quantity status, and condition.
- Count, container, preferred store, last purchase, brand, and expiration.
- Whether there is an active order for that item.
- Notes.
- Actions for adding a purchase, reordering, opening a product link, editing the item, copying a link, or deleting the item.
- Purchase history for that item.

## Low Stock

Low Stock is the practical attention list for household items.

It shows:

- Items that are out now.
- Items that are running low.
- Total items needing attention.
- Items marked too much, so Mom knows not to buy them yet.

Each low-stock card shows the count, store, last purchase, active order status, notes, and quick actions.

Use Low Stock to:

1. Add an item to To-order.
2. Open the full item detail.
3. Mark an item plenty after restocking.
4. Mark an item out if it is gone.

## Places And Bins

Places are rooms, closets, cabinets, shelves, drawers, or other storage areas.

Bins are containers inside places. Each bin can have:

- Name.
- Code.
- Category.
- Notes.
- Outside photo.
- Inside photo.
- QR label.

QR labels open the matching bin when scanned.

The Places and Bins screen shows:

- Total places.
- Total bins.
- Items assigned to bins.
- Empty bins.

Each bin card shows:

- Bin code.
- Bin location.
- Whether the bin was opened from a QR scan.
- Notes.
- A “what is in here” list.
- A QR label download button.
- A scan-link copy button.

Tap an item inside a bin to open that item detail.

## To-Order List

Use To-order for things to buy or replace.

Each order entry can include:

- Item name.
- Quantity.
- Store or vendor.
- Preferred brand.
- Estimated price.
- Product link.
- Order number.
- Tracking link.
- Expected delivery date.
- Urgency.
- Status.
- Notes.

Order entries can come from:

- A low-stock inventory item.
- A saved purchase.
- A manual entry.

To-order filters:

- Needed: things that still need action.
- Ordered: things ordered or purchased but not received.
- Received: things that arrived.
- All: every order entry.

Common actions:

1. Tap Ordered when an item has been ordered.
2. Tap Received when it arrives.
3. Tap Back to needed if it still needs action.
4. Tap Open item to see the linked inventory item.
5. Tap Product link to open the saved product page.
6. Tap Edit delivery to add or change an order number, tracking link, or expected delivery date. Tap Track delivery to open the carrier or store page.

When Mom marks an entry Ordered or Received, MomOS records that date automatically. These details are optional and work with any store or vendor; they do not sign in to, read, or control any store account.

Web links can be pasted with or without `https://`. MomOS adds the secure web prefix when it is missing and only opens normal `http` or `https` addresses.

The main search also finds saved order number, tracking link, expected delivery date, and ordered/received dates.

For an active order with an expected delivery date, MomOS shows `Expected today`, `Expected tomorrow`, or `Past expected date`. This is a reminder based on the saved date, not a live carrier-status claim.

## Purchase Import And Local AI Docket

Purchases can store receipt links, receipt photos, receipt/email text, notes, recommendations, and local AI-style summaries.

1. Go to Purchases.
2. Tap `Import text` to paste receipt text, email text, or a manual purchase note.
3. Review the suggested product, store, price, and date before saving it as a purchase.
4. Use the local Purchase AI docket to find missing receipts, compare-first purchases, avoid/do-not-buy records, and unchecked records.
5. Open a purchase and tap `Refresh local matches` to build replacement/substitute options from saved item links and prior purchases.

No remote AI, inbox reader, or retailer API is called by this local docket. Provider-backed automation can be added later after explicit setup.

## Private Vault

The Private Vault stores encrypted notes in this browser.

1. Go to More → Private vault.
2. Add a title, optional visible hint, private note, and passphrase.
3. Tap `Encrypt and save`.
4. To read a note, type the passphrase and tap `Unlock`.
5. Tap `Lock` to hide the plaintext again.

If the passphrase is forgotten, MomOS cannot recover the vault note. Vault plaintext is not included in helper handoff, AI-style summaries, or normal reports.

## Supplements

Supplements track bottles and simple taken history.

Each supplement can include:

- Name.
- Brand.
- Bottle photo.
- Dose instructions from the bottle.
- Pills per bottle.
- Pills left.
- Reorder threshold.
- Preferred store.
- Product link.
- Notes.

To mark a supplement taken:

1. Go to Supplements.
2. Tap Taken for a quick one-pill log.
3. Or tap Log details to choose the amount, time, and notes.

When an amount is logged, the app subtracts that amount from pills left when a number is available.

The four summary boxes show the number of tracked bottles, low bottles, empty bottles, and saved taken logs. A bottle is marked low when its remaining count reaches the reorder point saved for that bottle.

The export buttons have different jobs:

- Download PDF saves a polished supplement report directly to the device.
- Print report opens the browser's print screen. On an iPhone, this can also be used to share or save through the system print options.
- Export CSV saves the underlying supplement data for spreadsheet programs and future data transfers.

This section is for tracking only. It does not give medical advice.

## Purchase History

Purchase history stores what was bought before. It is not limited to any one store. It can be used for Amazon, Walmart, Home Depot, Costco, a pharmacy, a local shop, a direct vendor, a marketplace seller, or a manually entered receipt.

Each purchase can include:

- Product name.
- Store or vendor.
- Seller or marketplace.
- Brand.
- Date.
- Order number.
- Quantity.
- Unit size.
- Price.
- Product link.
- Receipt link.
- Receipt photo or order screenshot.
- Notes.
- Whether to reorder, compare first, substitute, or avoid.

The Purchases screen shows all saved purchases in one place.

At the top of Purchases, the dashboard shows:

- Saved purchases.
- Reorder same.
- Compare first.
- Avoid.
- Purchases with a receipt or screenshot.

Use Purchases to:

1. Search saved purchases and receipts.
2. Filter by reorder same, compare first, or avoid.
3. Open the linked inventory item.
4. Use an old purchase to start a new order entry.
5. Open product links, receipt links, or saved receipt screenshots.

Each purchase card separates vendor, total price, brand, amount, receipt status, preference, order number, notes, and actions so Mom does not have to read one long compressed line.

Inside an inventory item's Purchase history, MomOS shows the number of recorded purchases and the lowest saved total price. This is a simple record of what was entered, not an automatic store-price comparison. Check package size and unit size before deciding that one saved total is the better deal.


## Ideas

Ideas is the visual planning area. Use it for boards like Kitchen Ideas, Garden, Gifts, Recipes, Repairs, Future Purchases, Decorating, or Seasonal Plans.

Current actions:

1. Tap Ideas in the bottom navigation.
2. Add boards and optional sections.
3. Add cards from a photo, screenshot, link, note, product, recipe, document, inventory item, task, or project. When an image is added, MomOS extracts a small color palette and creates a simple local image fingerprint for duplicate warnings.
4. Search, filter, sort, favorite, compare, archive, restore, copy to another board, export, or print board ideas.
5. Convert useful cards into tasks, orders, inventory items, projects, or calendar reminders while keeping the original idea card saved.

## Assistant Handoff

More includes a clean helper summary.

It includes:

- Starred tasks.
- Today's tasks.
- Quick wins.
- Help-requested tasks.
- Flags, tags, stars, and notes.
- Orders that are in transit, with expected arrival, order number, vendor, tracking link, and notes when saved.
- Things that still need buying.

Nothing is shortened.

## Export And Backup

More can export dated files so backups and reports are easier to compare later. The Export panel also shows the approximate current local backup size, which helps explain when photos are making the browser backup large:

- Printable report and report text.
- Full JSON backup.
- Item CSV.
- To-order CSV, including delivery details when saved.
- Purchase CSV.
- Task CSV.
- Supplement CSV.
- Assistant handoff text.

More can also restore a JSON backup made by this app. First choose the backup file and review its household name, file date, record counts, and any warnings. Nothing changes during that review. Mom can download the current data first, then tap Restore this backup and confirm the final replacement. CSV files are helpful for spreadsheets, but the full JSON backup is the restore file. If restoring, use Download current data first so the current browser data has its own dated safety copy.

The PDF report opens a print screen. Choose Save as PDF if the browser asks for a printer.

## Calm Screen

The Calm screen is a quiet reset page. It can play the selected local sound, switch to silent mode, open quick wins, open help, or let Mom log energy. The Focus Season timer also uses the selected calm sound when it finishes while MomOS is open.

## iPhone Home Screen

Use Safari to install MomOS on an iPhone:

1. Open the deployed MomOS website in Safari.
2. Tap the Share button.
3. Tap Add to Home Screen.
4. Tap Add.
5. Open MomOS from the new Home Screen icon.

After the app has opened successfully once while connected, its basic app shell is kept available for brief connection interruptions. Household records remain on the device through the browser's local storage. Cloud backup and restore still need an internet connection.

## Cloud Protection

MomOS always saves locally in the browser. If Firebase or Supabase has been connected, More also shows account and cloud protection controls. Cloud protection shows whether the device is online, the latest cloud revision, and whether a failed cloud backup is queued for retry.

To create the first cloud household:

1. Open More.
2. Find Cloud protection.
3. Create an account or sign in.
4. Tap Create Mom's House.
5. Wait for the confirmation that the device was backed up.

If the account password is forgotten, open **More > Cloud protection**, type the account email, and tap **Forgot password?**. The reset instructions go to that email address. Changing a password does not alter household records or local app data.

To protect newer changes, tap Back up this device. Photos saved inside the app are copied to private cloud storage during that backup.

MomOS automatically reduces oversized camera photos before saving them locally or sending them to cloud storage. Most large item, bin, receipt, and bottle photos are downscaled and saved as compact JPEGs. GIFs, SVGs, and files a browser cannot safely process are kept as originally selected.

To restore:

1. Tap Check cloud backup.
2. Review its date and revision number.
3. Tap Restore to this device.
4. Confirm the replacement.

Cloud restore does not alter any JSON backup files previously downloaded from the app.

The first cloud version uses deliberate backup and restore buttons. It does not silently overwrite another person's work. Automatic two-way synchronization will be added after conflict handling and deletion history are complete.

Cloud roles are owner, admin, helper, and viewer. The private vault is not included in cloud household data or helper access.

### Sharing A Household

Only the owner can add people. The owner opens **More > Cloud protection > Shared access**, chooses an access level, and taps **Create invitation**. MomOS creates a one-use code that expires after seven days. The owner can copy that code and send it however they prefer.

The recipient must create or sign into their own MomOS account. In **More > Cloud protection**, they paste the code under **Join a shared household** and tap **Request access**. Nothing is shared at that point. The owner must return to **Shared access** and tap **Approve** before the recipient can see the household. The recipient then taps **Check for approved access**, chooses the household if needed, and uses **Check cloud backup > Restore to this device** to load the latest shared copy.

Sharing currently uses deliberate cloud backups. An owner, admin, or helper chooses **Back up this device** when they want their latest changes shared. A viewer can check and restore the current shared backup but cannot upload changes. MomOS will not silently overwrite another person's work.

The owner can later change a person's role, remove them immediately, revoke unused invitation codes, or decline a pending request. There is no secret access path and no one, including an admin or helper, can enter the future private vault through household sharing.

Shared access also shows a short household activity history for backups and permission changes. It is a practical record of what changed, not a surveillance tool.

## Future Sequencing

Future task views should show which tasks depend on other tasks.

Planned views:

- Tree view for projects and subprojects.
- Branch view for parallel parts of a project.
- Flowchart view for tasks that unlock other tasks.
- Everything Map for all household projects in one dependency map.

Blocked tasks should show what must happen first.

## Future Safety Notes

Emergency alerts will be helper notifications only. They will not replace 911 or iPhone Emergency SOS.

The private vault will not use a hidden backdoor. Helper/admin access will not include the vault unless Mom explicitly designs that later.
