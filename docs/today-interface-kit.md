# Today Interface Kit

> **Status: deferred visual work.** This document describes the technical
> boundary for a future interface replacement. It does not approve, require,
> or endorse any previous visual concept or graphical mockup.

## Purpose

Today designs are presentation layers. They never read browser storage, Firebase, inventory records, or task records directly. The app converts the live household state into a small, stable interface contract first.

This lets a new graphical home screen be installed without changing the household engine.

## The Contract

Use `TodayInterfaceContract` from `app/today-ui/contract.ts`.

It provides:

- The selected design id and current focus.
- Ready-to-display signals: title, detail, action label, and category.
- Summary statistics.
- The current daily brief.
- Callbacks for changing focus, changing interface, selecting a signal, and opening its real destination.

Do not import `AppState`, Firebase helpers, or local-storage helpers into a Today design component.

## Add A New Interface Later

1. Add the new id to `TodayLens` in `lib/inventory-types.ts`.
2. Register its short and settings labels in `lib/today-interface-registry.ts`.
3. Build one React component that accepts `TodayInterfaceContract`.
4. Add the component to `app/today-lenses.tsx`, or replace the built-in renderer with a dedicated registry renderer when several custom packs exist.
5. Use `onOpenSignal` for every actionable visual target. A visual tile must not invent its own navigation or read private data.
6. Run `npm.cmd run typecheck` and test the view at an iPhone width before making it selectable.

## Graphical Assets

Place installable image assets in `public/today-designs/<design-id>/`.

Use assets as decoration, texture, or a backdrop. Do not bake the only labels or the only touch targets into an image. Every touch target remains a real HTML button or link positioned over or beside the image. This keeps the design readable, tappable, searchable, and adaptable when Mom's data changes.

The `assetSlots` field in the registry documents where a design may accept optional artwork. A missing asset must leave the interface fully usable.

## Safety Rules

- Keep text as live HTML so no task title is truncated by the image.
- Use `overflow-wrap: anywhere` for user-entered titles and notes.
- Preserve visible focus states and button labels.
- Do not place the private vault, account credentials, or helper permissions inside a graphical design asset.
- A new design may change presentation, but it must not change household data unless Mom taps a real control and confirms the action where appropriate.
