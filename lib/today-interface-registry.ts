import type { TodayLens } from "./inventory-types";

export type TodayInterfaceId = Exclude<TodayLens, "last-used">;

export type TodayInterfaceAssetSlot = {
  id: string;
  purpose: string;
};

export type TodayInterfaceDefinition = {
  id: TodayInterfaceId;
  shortLabel: string;
  settingsLabel: string;
  assetSlots: TodayInterfaceAssetSlot[];
};

// This registry is the one place a new installed Today design must be declared.
export const todayInterfaceOptions: TodayInterfaceDefinition[] = [
  { id: "briefing", shortLabel: "Brief", settingsLabel: "Briefing Desk", assetSlots: [] },
  { id: "compass", shortLabel: "Compass", settingsLabel: "Command Compass", assetSlots: [{ id: "backdrop", purpose: "Optional visual field behind the compass controls." }] },
  { id: "radar", shortLabel: "Radar", settingsLabel: "Household Radar", assetSlots: [{ id: "backdrop", purpose: "Optional visual field behind the radar controls." }] },
  { id: "verb-universe", shortLabel: "Universe", settingsLabel: "Verb Universe", assetSlots: [{ id: "backdrop", purpose: "Optional visual field behind the verb controls." }] },
  { id: "verb-portals", shortLabel: "Portals", settingsLabel: "Verb Portals", assetSlots: [{ id: "backdrop", purpose: "Optional visual texture behind the portal controls." }] }
];

export function isTodayInterfaceId(value: string): value is TodayInterfaceId {
  return todayInterfaceOptions.some((option) => option.id === value);
}
