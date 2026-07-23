# Ideas / Visual Planner

## Purpose

The Ideas section is a Pinterest-like planning space for MomOS. It should not
be a passive image collection. Each saved idea should be searchable, organized,
actionable, and connectable to the rest of the household app.

Possible product names: **Ideas**, **Boards**, **Inspiration**, or **Visual
Planner**.

## Product Principle

**Pinterest + project planning + inventory awareness + purchase tracking.**

Every card should help Mom remember, compare, decide, buy, plan, or complete
something.


## Implementation Status

The local-first implementation now includes boards, sections, cards, placements,
search/filter/sort, archive/restore, favorites, board export/print, basic
budget/comparison views, duplicate/owned-item hints, local image-signature checks,
automatic color-palette extraction, and conversion actions into
tasks, orders, inventory items, projects, and reminders.

## Core Objects

### Board

A board is a visual collection such as Kitchen Ideas, Garden, Gifts, Recipes,
Repairs, Future Purchases, Decorating, or Seasonal Plans.

Fields to plan for:

- Name.
- Description.
- Room/location link.
- Archived state.
- Created/updated dates.
- Custom sort order.

### Board Section

A board section is a smaller category inside a board, such as Furniture,
Lighting, Paint, Storage, Appliances, or Plants.

Fields to plan for:

- Board ID.
- Name.
- Description.
- Custom sort order.

### Idea Card

An idea card is the underlying saved idea. It should be able to appear on more
than one board without duplicating the actual saved record.

Supported content types:

- Photo or screenshot.
- Web link.
- Product.
- Note.
- Recipe.
- Document.
- Existing inventory item.
- Existing task or project.

Fields to plan for:

- Title.
- Notes/description.
- Images.
- Source URL.
- Source page title.
- Website, store, or seller.
- Price and price date.
- Dimensions.
- Color.
- Quantity.
- Date saved.
- Priority.
- Status.
- Tags.
- Room/location link.
- Inventory/task/project/order/purchase links.
- Archived/deleted state.

### Board Placement

A placement connects an idea card to a board and optional section. This allows a
card to appear in multiple boards without duplicating the card.

Fields to plan for:

- Card ID.
- Board ID.
- Section ID.
- Custom sort order.
- Pinned/favorite state for that board.

## Practical Statuses

Cards should support these decision statuses:

- Saved.
- Considering.
- Approved.
- Buying.
- Purchased.
- Completed.
- Rejected.

## MVP Scope

The first version should stay small and local-first:

1. Boards list.
2. Board detail with sections.
3. Add card from photo, upload, link, note, or inventory item.
4. Basic card fields: title, note, image, source URL, store, price, tags,
   priority, status.
5. Search by title, notes, tags, store, source, and linked inventory item.
6. Filter by board, section, status, priority, tag, room, and content type.
7. Favorite, archive, restore, edit, and delete.
8. Link card to an inventory item, task, project, calendar entry, order, or
   purchase.
9. Convert a card into a task or order while keeping the original idea linked.
10. Board print/export as a clean report.

## Advanced Local Scope

These capabilities are represented in the local model/UI where practical. External live checks remain future cloud/API work:

- Make This Real: convert a board or idea stack into a project with tasks,
  shopping items, budget, target date, and linked cards.
- Room-aware boards with room measurements, existing inventory, repairs, colors,
  and furniture.
- Duplicate detection for links, images, products, and near-identical cards.
- Already-owned warnings based on inventory.
- Visual comparison mode for two to four cards.
- Budget view by board, section, store, and project.
- Measurement matching against rooms, shelves, doors, and walls.
- Color extraction and palette search.
- Shopping list extraction grouped by store, department, project, and priority.
- Price history and target-price reminders.
- Alternatives attached beneath a main card.
- Before-and-after planning.
- Idea stacks for coordinated room plans.
- Expiration reminders for sales, coupons, reservations, returns, and seasonal
  availability.
- Seasonal resurfacing.
- Smart collections such as Under $50, Approved but not purchased, Kitchen
  ideas, or Items with missing prices.
- Completion memory with final photos, actual cost, completion date, and notes.
- Broken-link and availability notes are stored manually; automatic live checks require network/provider automation later.

## Fast Capture Requirements

The Add flow should offer:

- Take a photo.
- Upload an image.
- Paste a link.
- Write a note.
- Add from inventory.
- Add from an existing project or task.

The first screen should not ask for every field. It should let Mom save quickly
and fill details later.

## Connection Rules

Ideas should connect to existing MomOS records without replacing them:

- Card to task.
- Card to calendar entry.
- Card to inventory item.
- Card to order entry.
- Card to purchase record.
- Card to task project.

When a card becomes a task, order, purchase, or inventory item, the original card
should remain linked as the memory/source.

## Source Preservation

Cards should stay understandable even if a webpage disappears. Save:

- Original URL.
- Website or seller name.
- Page title.
- Original image.
- Date saved.
- Last known price.
- Short saved text description.

## Design Guardrails

- Keep board browsing visual but action-oriented.
- Full details should open only when a card is selected.
- Do not require AI, retailer APIs, or scraping for the first version.
- Do not duplicate inventory/purchase/task data; link to it.
- Keep tags flexible and user-defined.
- Archived items stay searchable.
- Deleting should be recoverable where possible.


## Current Implementation Status

The local Ideas section is implemented as a practical Phase 2 feature:

- Ideas appears in the bottom navigation.
- Mom can add, edit, archive, and restore boards.
- Boards support sections, board export, print, budget totals, and comparison of favorites.
- Cards support images, links, notes, products, recipes, documents, prices, dimensions, colors, extracted color palettes, quantities, tags, purpose, priority, status, room links, source preservation, deadlines, seasonal notes, availability/fit notes, stacks, and related app records.
- Cards can be archived, restored, deleted/restored, favorited, copied to another board, checked for duplicate links/titles/image signatures, checked against similar inventory names, filtered through smart collections, and converted into tasks, orders, inventory items, projects, or calendar reminders.
- Backup/restore carries the Ideas data collections.
- Static Ideas QA and cleanup are recorded in [Ideas QA Findings](./ideas-qa-findings.md).

Automatic web availability checks and retailer price refreshes still require a later provider/cloud layer. Basic image similarity and color extraction now run locally from saved images.
