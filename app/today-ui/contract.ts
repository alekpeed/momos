import type { TodayInterfaceId } from "@/lib/today-interface-registry";

export type TodaySignalKind = "do" | "buy" | "take" | "watch" | "help";
export type TodayFocus = "overview" | "errands" | "household" | "quiet";

export type TodaySignal = {
  id: string;
  kind: TodaySignalKind;
  title: string;
  detail: string;
  actionLabel: string;
};

export type TodayStat = {
  label: string;
  value: number;
  tone?: "calm" | "attention" | "urgent";
};

// New graphical Today designs consume this contract instead of reaching into app state.
export type TodayInterfaceContract = {
  lens: TodayInterfaceId;
  focus: TodayFocus;
  signals: TodaySignal[];
  selectedKind: TodaySignalKind;
  briefTitle: string;
  briefText: string;
  stats: TodayStat[];
  onLensChange: (lens: TodayInterfaceId) => void;
  onFocusChange: (focus: TodayFocus) => void;
  onKindChange: (kind: TodaySignalKind) => void;
  onOpenSignal: (signal: TodaySignal) => void;
};
