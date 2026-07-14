"use client";

import { useMemo, useState } from "react";

type HelpSection = {
  title: string;
  summary: string;
  steps: string[];
  note?: string;
};

const helpSections: HelpSection[] = [
  { title: "Start Here", summary: "Today is the daily home screen. The bottom bar moves between the main household areas.", steps: ["Use the plus button to add an inventory item.", "Use Today to add a task, event, order, or energy note.", "Use More for settings, exports, cloud protection, and this manual."] },
  { title: "Today And Its Views", summary: "Today changes presentation without duplicating household data.", steps: ["Choose a View: Brief, Compass, Radar, Universe, or Portals.", "Choose Chief, Errands, Household, or Quiet to change the current focus.", "Tap any visible signal to open its real task, order, supplement, or calendar area."], note: "Quiet view never uses energy notes to assign tasks." },
  { title: "Focus Season", summary: "Focus Season is an adjustable timer for a task or any bit of work you choose.", steps: ["Open Today and choose a task or leave Focus on set to Anything I choose.", "Pick a quick time or type a length from 1 to 180 minutes.", "Tap Start, then Pause or Restart whenever needed.", "Use Open task to return to the selected task."], note: "The timer keeps its place through refreshes. It can chime and show a device alert while Mom Home is open and alerts are enabled." },
  { title: "Tasks, Projects, Flags, And Tags", summary: "Tasks can carry custom flags, custom tags, stars, dates, notes, projects, and prerequisites.", steps: ["Open Tasks and tap Add.", "Choose only the flags, tags, and stars that are meaningful to you.", "Use a project when several tasks belong together, or tap Add task inside a project to start with it already selected.", "Use Project map to see what is ready now, what is waiting, and what is already finished.", "Add a prerequisite when one task truly must happen before another."], note: "Flags and tags have no preset meanings. Their definitions belong to Mom." },
  { title: "Calendar And Reminders", summary: "Calendar stores events, dated tasks, repeats, reminders, and optional nag intervals.", steps: ["Open Calendar and select a day.", "Tap Add event and enter the useful details.", "Choose a reminder and nag interval only when wanted.", "Allow notifications when the browser asks if device alerts are desired."], note: "Background iPhone alerts need the later notification service. While Mom Home is open, reminder checks are active." },
  { title: "Inventory, Low Stock, And Bins", summary: "Inventory records what the household has, where it lives, and whether it needs attention.", steps: ["Add an item with its name, category, location, and quantity status.", "Add a photo when it makes the item easier to recognize.", "Use Places to make locations and storage containers.", "Open a container to create or download its QR label."], note: "Incomplete records are fine. Add only what is known today." },
  { title: "To-Order And Deliveries", summary: "To-order tracks replacements from any store or vendor.", steps: ["Add an order manually or start one from inventory or purchase history.", "Mark it Ordered when placed and Received when it arrives.", "Use Edit delivery for the order number, tracking link, and expected delivery date.", "Search by order number, tracking link, vendor, or expected date when needed."], note: "Expected-delivery signals are reminders based on saved dates, not live carrier claims." },
  { title: "Purchases And Receipts", summary: "Purchase history remembers where something came from and whether it was worth buying again.", steps: ["Open Purchases or an inventory item and tap Add purchase.", "Enter the vendor, price, order number, link, or receipt details you have.", "Attach a receipt or order screenshot if useful.", "Use the saved preference to mark reorder same, compare first, substitute, or avoid."], note: "The lowest saved price is a record of entered totals. Check package size before comparing." },
  { title: "Supplements", summary: "Supplements track bottle information and a simple taken history. They do not provide medical advice.", steps: ["Add a bottle with its dose instructions and remaining count.", "Set a reorder level if that is useful.", "Tap Log 1 taken or Log amount when it is taken.", "Use Download PDF or Export CSV when a report is wanted."] },
  { title: "Cloud, Helpers, And Privacy", summary: "Cloud protection keeps local saving on and adds deliberate backup, restore, and sharing controls.", steps: ["Create or sign in to a cloud account from More.", "Create Mom's House to make the first protected household.", "Use Back up this device after important changes.", "Create a helper, viewer, or admin invitation only when sharing is wanted."], note: "Cloud access is deliberate backup and restore, not silent two-way synchronization. Private vault records are never included in shared access." },
  { title: "Export And Restore", summary: "Exports make portable copies. Restore replaces current browser data only after review and confirmation.", steps: ["Use More > Export to download JSON, CSV, text, or printable reports.", "Choose a JSON backup under Restore backup.", "Review the household name, date, record counts, and warnings first.", "Download current data before restoring if an extra safety copy would feel better.", "Tap Restore this backup and confirm only when it is the intended file."] },
  { title: "Put Mom Home On iPhone", summary: "Mom Home is a web app that can live on an iPhone Home Screen without the App Store.", steps: ["Open the deployed Mom Home website in Safari.", "Tap Share, then Add to Home Screen.", "Tap Add, then open Mom Home from its new icon.", "Keep Safari and iOS updated for the best install behavior."], note: "The basic app shell can survive brief connection interruptions after a successful open. Cloud backup and restore still need internet." }
];

export function HelpCenter({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleSections = useMemo(
    () => helpSections.filter((section) => !normalizedQuery || [section.title, section.summary, section.note, ...section.steps].filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery)),
    [normalizedQuery]
  );

  return (
    <section className="help-page">
      <div className="section-head">
        <div>
          <span className="today-eyebrow">Mom Home guide</span>
          <h2>User Manual</h2>
          <p className="muted">A quick map first, then clear steps when a detail is needed.</p>
        </div>
        <button className="ghost-button" onClick={onBack}>Back</button>
      </div>

      <div className="help-overview">
        <strong>Today</strong><span>daily priorities and lenses</span>
        <strong>Tasks</strong><span>work, projects, flags, and stars</span>
        <strong>Calendar</strong><span>events and reminders</span>
        <strong>Inventory</strong><span>items, bins, ordering, and purchase records</span>
        <strong>More</strong><span>supplements, settings, protection, export, and help</span>
      </div>

      <label className="label help-search">
        <span>Search the manual</span>
        <input className="field" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="For example: receipt, reminder, backup, flags" />
      </label>

      <div className="help-sections">
        {visibleSections.map((section) => (
          <article className="help-section" key={section.title}>
            <h3>{section.title}</h3>
            <p>{section.summary}</p>
            <ol>{section.steps.map((step) => <li key={step}>{step}</li>)}</ol>
            {section.note ? <p className="help-note"><strong>Good to know:</strong> {section.note}</p> : null}
          </article>
        ))}
        {!visibleSections.length ? <p className="empty">No manual section matches that search.</p> : null}
      </div>
    </section>
  );
}
