"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { addMonths, format, parseISO, subMonths } from "date-fns";
import {
  blankCalendarEntry,
  blankContainer,
  blankEnergyJournalEntry,
  blankItem,
  blankLocation,
  blankOrder,
  blankPurchase,
  blankSupplementItem,
  blankSupplementLog,
  blankTask,
  blankTaskFlag,
  blankTaskProject,
  blankTaskTag,
  calendarRepeats,
  categories,
  conditionValues,
  flagShapes,
  fileToDataUrl,
  getLastPurchase,
  getPurchasePriceSummary,
  HOUSEHOLD_ID,
  locationTypes,
  makeId,
  migrateState,
  normalize,
  nowIso,
  orderStatuses,
  purchasePreferences,
  quantityStatuses,
  reorderRecommendations,
  seedState,
  starModes,
  STORAGE_KEY,
  taskEfforts,
  taskStatuses,
  urgencies
} from "@/lib/inventory-data";
import { calendarDaysForMonth, calendarEntryOccursOnDate, calendarTimeLabel, localDateIso, upcomingCalendarOccurrences } from "@/lib/calendar";
import { downloadText, itemsToCsv, ordersToCsv, purchasesToCsv, supplementsToCsv, tasksToCsv } from "@/lib/export";
import { downloadSupplementsPdf } from "@/lib/pdf-export";
import { normalizeWebUrl } from "@/lib/web-url";
import { isTodayInterfaceId, todayInterfaceOptions, type TodayInterfaceId } from "@/lib/today-interface-registry";
import { TodayLenses, type TodayFocus, type TodaySignal, type TodaySignalKind, type TodayStat } from "@/app/today-lenses";
import { HelpCenter } from "@/app/help-center";
import { FocusSeason } from "@/app/focus-season";
import { CloudSettings } from "@/app/cloud-settings";
import { CloudImage, CloudMediaLink } from "@/app/cloud-media";
import type {
  AppState,
  CalendarEntry,
  CalendarRepeat,
  Condition,
  Container,
  CommandTask,
  EnergyJournalEntry,
  FlagShape,
  Item,
  Location,
  LocationType,
  OrderEntry,
  OrderStatus,
  PurchasePreference,
  PurchaseRecord,
  QuantityStatus,
  ReorderRecommendation,
  StarMode,
  SupplementItem,
  SupplementLog,
  TaskEffort,
  TaskFlag,
  TaskProject,
  TaskStatus,
  TaskTag,
  TodayLens,
  Urgency,
  View
} from "@/lib/inventory-types";

function statusClass(status: QuantityStatus) {
  if (status === "Low" || status === "Very low") return "badge low";
  if (status === "Out") return "badge out";
  if (status === "Plenty" || status === "Enough") return "badge plenty";
  if (status === "Too much") return "badge overstock";
  return "badge";
}

function money(value?: string) {
  if (!value) return "";
  const number = Number(value);
  return Number.isFinite(number) ? `$${number.toFixed(2)}` : value;
}

function deliveryDateSignal(expectedDate: string | undefined, status: OrderStatus, todayIso: string) {
  if (!expectedDate || ["Received", "Cancelled", "Not needed anymore"].includes(status)) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expectedDate)) return { label: `Expected ${expectedDate}`, tone: "badge" };
  if (expectedDate < todayIso) return { label: `Past expected date: ${expectedDate}`, tone: "badge out" };
  if (expectedDate === todayIso) return { label: "Expected today", tone: "badge low" };
  const tomorrow = new Date(`${todayIso}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (expectedDate === localDateIso(tomorrow)) return { label: "Expected tomorrow", tone: "badge ready" };
  return { label: `Expected ${expectedDate}`, tone: "badge" };
}

type BackupPreflight = {
  fileName: string;
  sizeBytes: number;
  modifiedAt: string;
  state: AppState;
  warnings: string[];
};

function inspectBackup(file: File, input: unknown): BackupPreflight {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Backup is not an object.");
  const source = input as Record<string, unknown>;
  const collections = ["items", "locations", "containers", "orderEntries", "purchaseRecords", "tasks", "calendarEntries", "supplementItems"];
  const recognizedCollections = collections.filter((key) => Array.isArray(source[key]));
  const warnings: string[] = [];
  if (!recognizedCollections.length) warnings.push("This file does not contain recognizable Mom Home record lists.");
  if (!source.household || typeof source.household !== "object") warnings.push("The backup does not include a household name. A default name will be used if restored.");
  if (!source.settings || typeof source.settings !== "object") warnings.push("The backup does not include settings. Current default settings will be used if restored.");
  return {
    fileName: file.name,
    sizeBytes: file.size,
    modifiedAt: new Date(file.lastModified).toLocaleString(),
    state: migrateState(input),
    warnings
  };
}

export default function Home() {
  const seeded = useMemo(() => seedState(), []);
  const [state, setState] = useState<AppState>(() => seeded);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>("home");
  const [search, setSearch] = useState("");
  const [showItemForm, setShowItemForm] = useState(false);
  const [showCalendarForm, setShowCalendarForm] = useState(false);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [showContainerForm, setShowContainerForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string>("");
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [showTagForm, setShowTagForm] = useState(false);
  const [showEnergyForm, setShowEnergyForm] = useState(false);
  const [showSupplementForm, setShowSupplementForm] = useState(false);
  const [showSupplementLogForm, setShowSupplementLogForm] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [backupPreflight, setBackupPreflight] = useState<BackupPreflight | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [itemDraft, setItemDraft] = useState<Partial<Item>>(() => blankItem(seeded.locations));
  const [calendarDraft, setCalendarDraft] = useState<Partial<CalendarEntry>>(() => blankCalendarEntry());
  const [locationDraft, setLocationDraft] = useState<Partial<Location>>(() => blankLocation());
  const [containerDraft, setContainerDraft] = useState<Partial<Container>>(() => blankContainer(seeded.locations));
  const [orderDraft, setOrderDraft] = useState<Partial<OrderEntry>>(() => blankOrder());
  const [purchaseDraft, setPurchaseDraft] = useState<Partial<PurchaseRecord>>(() => blankPurchase());
  const [taskDraft, setTaskDraft] = useState<Partial<CommandTask>>(() => blankTask());
  const [taskFormMessage, setTaskFormMessage] = useState("");
  const [projectDraft, setProjectDraft] = useState<Partial<TaskProject>>(() => blankTaskProject());
  const [flagDraft, setFlagDraft] = useState<Partial<TaskFlag>>(() => blankTaskFlag());
  const [tagDraft, setTagDraft] = useState<Partial<TaskTag>>(() => blankTaskTag());
  const [energyDraft, setEnergyDraft] = useState<Partial<EnergyJournalEntry>>(() => blankEnergyJournalEntry());
  const [supplementDraft, setSupplementDraft] = useState<Partial<SupplementItem>>(() => blankSupplementItem());
  const [supplementLogDraft, setSupplementLogDraft] = useState<Partial<SupplementLog>>(() => blankSupplementLog());
  const [taskScope, setTaskScope] = useState<"open" | "next" | "today" | "starred" | "quick" | "help" | "all">("open");
  const [showCompletedProjectTasks, setShowCompletedProjectTasks] = useState(false);
  const [orderScope, setOrderScope] = useState<"needed" | "ordered" | "received" | "all">("needed");
  const [purchaseScope, setPurchaseScope] = useState<"all" | "reorder" | "compare" | "avoid">("all");
  const [reportScope, setReportScope] = useState<"all" | "supplements">("all");
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [activeContainerCode, setActiveContainerCode] = useState("");
  const [todayFocus, setTodayFocus] = useState<TodayFocus>("overview");
  const [activeTodayKind, setActiveTodayKind] = useState<TodaySignalKind>("do");
  const initialCalendarDate = localDateIso(new Date());
  const [calendarMonth, setCalendarMonth] = useState(`${initialCalendarDate.slice(0, 7)}-01`);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(initialCalendarDate);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const sentReminders = useRef(new Set<string>());

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setState(migrateState(JSON.parse(saved)));
      } catch {
        setState(seedState());
      }
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [loaded, state]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    setNotificationPermission("Notification" in window ? Notification.permission : "unsupported");
  }, []);

  useEffect(() => {
    if (!loaded || notificationPermission !== "granted" || !("Notification" in window)) return;
    const checkReminders = () => {
      const now = new Date();
      const dateIso = localDateIso(now);
      state.calendarEntries.forEach((entry) => {
        if (entry.reminderMinutesBefore === undefined || !calendarEntryOccursOnDate(entry, dateIso)) return;
        const occurrence = new Date(`${dateIso}T${entry.startTime || "09:00"}`);
        const reminderTime = new Date(occurrence.getTime() - entry.reminderMinutesBefore * 60_000);
        if (now < reminderTime || now.getTime() > occurrence.getTime() + 12 * 60 * 60_000) return;
        const bucket = entry.nagEnabled
          ? Math.floor((now.getTime() - reminderTime.getTime()) / ((entry.nagIntervalMinutes || 15) * 60_000))
          : 0;
        const reminderKey = `calendar-${entry.id}-${dateIso}-${bucket}`;
        if (sentReminders.current.has(reminderKey)) return;
        sentReminders.current.add(reminderKey);
        new Notification(entry.title, {
          body: [calendarTimeLabel(entry), entry.location].filter(Boolean).join(" | ") || "Calendar reminder",
          tag: reminderKey
        });
      });
      state.tasks.forEach((task) => {
        if (!task.reminderAt || ["Done", "Skipped", "Cancelled"].includes(task.status)) return;
        const reminderTime = new Date(task.reminderAt);
        if (now < reminderTime || now.getTime() > reminderTime.getTime() + 24 * 60 * 60_000) return;
        const reminderKey = `task-${task.id}-${task.reminderAt}`;
        if (sentReminders.current.has(reminderKey)) return;
        sentReminders.current.add(reminderKey);
        new Notification(task.title, { body: "Task reminder", tag: reminderKey });
      });
    };
    checkReminders();
    const timer = window.setInterval(checkReminders, 30_000);
    return () => window.clearInterval(timer);
  }, [loaded, notificationPermission, state.calendarEntries, state.tasks]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const container = params.get("container");
    const item = params.get("item");
    if (container) {
      setActiveContainerCode(container);
      setView("places");
    }
    if (item) {
      setSelectedItemId(item);
      setView("items");
    }
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  useEffect(() => {
    async function makeCodes() {
      const entries = await Promise.all(
        state.containers.map(async (container) => {
          const url = `${window.location.origin}${window.location.pathname}?container=${encodeURIComponent(container.containerCode)}`;
          return [container.id, await QRCode.toDataURL(url, { margin: 1, width: 280 })] as const;
        })
      );
      setQrImages(Object.fromEntries(entries));
    }
    makeCodes().catch(() => setQrImages({}));
  }, [state.containers]);

  const selectedItem = state.items.find((item) => item.id === selectedItemId);
  const lowItems = useMemo(
    () => state.items.filter((item) => ["Low", "Very low", "Out"].includes(item.quantityStatus)),
    [state.items]
  );
  const outItems = useMemo(() => state.items.filter((item) => item.quantityStatus === "Out"), [state.items]);
  const runningLowItems = useMemo(() => state.items.filter((item) => item.quantityStatus === "Low" || item.quantityStatus === "Very low"), [state.items]);
  const overstockItems = useMemo(() => state.items.filter((item) => item.quantityStatus === "Too much"), [state.items]);
  const todayIso = localDateIso(new Date());
  const activeTasks = useMemo(
    () => state.tasks.filter((task) => !["Done", "Skipped", "Cancelled"].includes(task.status)),
    [state.tasks]
  );
  const dueTodayTasks = useMemo(
    () => activeTasks.filter((task) => task.dueDate === todayIso),
    [activeTasks, todayIso]
  );
  const starredTasks = useMemo(
    () => activeTasks.filter((task) => task.starCount > 0).sort((a, b) => b.starCount - a.starCount),
    [activeTasks]
  );
  const quickWinTasks = useMemo(
    () => activeTasks.filter((task) => task.effort === "Tiny" || task.effort === "Quick win"),
    [activeTasks]
  );
  const helpTasks = useMemo(
    () => activeTasks.filter((task) => task.helpRequested || task.effort === "Needs help"),
    [activeTasks]
  );
  const finishedTaskCount = useMemo(
    () => state.tasks.filter((task) => ["Done", "Skipped", "Cancelled"].includes(task.status)).length,
    [state.tasks]
  );
  const nextUpTasks = useMemo(
    () =>
      activeTasks.filter((task) =>
        (task.dependencyIds ?? []).every((dependencyId) => {
          const dependency = state.tasks.find((entry) => entry.id === dependencyId);
          return !dependency || ["Done", "Skipped", "Cancelled"].includes(dependency.status);
        })
      ),
    [activeTasks, state.tasks]
  );
  const monthCalendarDays = useMemo(() => calendarDaysForMonth(calendarMonth), [calendarMonth]);
  const selectedCalendarEntries = useMemo(
    () => state.calendarEntries.filter((entry) => calendarEntryOccursOnDate(entry, selectedCalendarDate)).sort((a, b) => (a.startTime || "00:00").localeCompare(b.startTime || "00:00")),
    [selectedCalendarDate, state.calendarEntries]
  );
  const selectedCalendarTasks = useMemo(
    () => activeTasks.filter((task) => task.dueDate === selectedCalendarDate),
    [activeTasks, selectedCalendarDate]
  );
  const upcomingCalendarItems = useMemo(() => {
    const events = upcomingCalendarOccurrences(state.calendarEntries, todayIso, 60).map(({ entry, dateIso }) => ({
      id: `event-${entry.id}-${dateIso}`,
      title: entry.title,
      dateIso,
      time: entry.allDay ? "All day" : entry.startTime || "",
      color: entry.color,
      kind: "Event" as const
    }));
    const tasks = activeTasks
      .filter((task) => task.dueDate && task.dueDate >= todayIso)
      .map((task) => ({ id: `task-${task.id}`, title: task.title, dateIso: task.dueDate || todayIso, time: "", color: "#315f8b", kind: "Task" as const }));
    return [...events, ...tasks].sort((a, b) => `${a.dateIso}T${a.time}`.localeCompare(`${b.dateIso}T${b.time}`)).slice(0, 12);
  }, [activeTasks, state.calendarEntries, todayIso]);
  const todaySignals = useMemo<TodaySignal[]>(() => {
    const signals: TodaySignal[] = [];
    const lowSupplementSignals = state.supplementItems.filter((supplement) => {
      const remaining = Number(supplement.pillsRemaining);
      const threshold = Number(supplement.reorderThreshold);
      return Number.isFinite(remaining) && Number.isFinite(threshold) && threshold > 0 && remaining <= threshold;
    });
    const readyTasks = [...nextUpTasks].sort((a, b) => {
      const aToday = a.dueDate === todayIso ? 1 : 0;
      const bToday = b.dueDate === todayIso ? 1 : 0;
      return bToday - aToday || b.starCount - a.starCount || a.title.localeCompare(b.title);
    });
    readyTasks.slice(0, 3).forEach((task) => {
      signals.push({
        id: `do-${task.id}`,
        kind: "do",
        title: task.title,
        detail: [task.dueDate === todayIso ? "Due today" : "Ready now", task.starCount ? `${task.starCount} ${task.starCount === 1 ? "star" : "stars"}` : "", task.effort].filter(Boolean).join(" | "),
        actionLabel: "Open"
      });
    });

    state.orderEntries.filter((entry) => entry.status === "Needed").slice(0, 3).forEach((entry) => {
      signals.push({
        id: `buy-${entry.id}`,
        kind: "buy",
        title: entry.name,
        detail: [entry.quantity, entry.urgency, entry.preferredStore].filter(Boolean).join(" | ") || "Needs ordering",
        actionLabel: "Review"
      });
    });

    if (lowSupplementSignals.length) {
      lowSupplementSignals.slice(0, 2).forEach((supplement) => signals.push({
        id: `take-${supplement.id}`,
        kind: "take",
        title: `${supplement.name} bottle`,
        detail: `${supplement.pillsRemaining || "0"} left | reorder at ${supplement.reorderThreshold || "not set"}`,
        actionLabel: "Open"
      }));
    } else if (state.supplementItems.length) {
      const logsToday = state.supplementLogs.filter((log) => log.takenAt.startsWith(todayIso)).length;
      signals.push({
        id: "take-supplement-records",
        kind: "take",
        title: "Supplement records",
        detail: `${state.supplementItems.length} ${state.supplementItems.length === 1 ? "bottle" : "bottles"} tracked | ${logsToday} ${logsToday === 1 ? "log" : "logs"} today`,
        actionLabel: "Open"
      });
    }

    state.calendarEntries
      .filter((entry) => calendarEntryOccursOnDate(entry, todayIso))
      .slice(0, 2)
      .forEach((entry) => signals.push({
        id: `watch-calendar-${entry.id}`,
        kind: "watch",
        title: entry.title,
        detail: [calendarTimeLabel(entry), entry.location].filter(Boolean).join(" | "),
        actionLabel: "Calendar"
      }));
    activeTasks
      .filter((task) => (task.dependencyIds ?? []).some((dependencyId) => {
        const dependency = state.tasks.find((entry) => entry.id === dependencyId);
        return dependency && !["Done", "Skipped", "Cancelled"].includes(dependency.status);
      }))
      .slice(0, 2)
      .forEach((task) => signals.push({
        id: `watch-blocked-${task.id}`,
        kind: "watch",
        title: `${task.title} is waiting`,
        detail: "A prerequisite is still open.",
        actionLabel: "Trace"
      }));

    helpTasks.slice(0, 2).forEach((task) => signals.push({
      id: `help-${task.id}`,
      kind: "help",
      title: task.title,
      detail: task.notes || "Help requested",
      actionLabel: "Open"
    }));
    return signals;
  }, [activeTasks, helpTasks, nextUpTasks, state.calendarEntries, state.orderEntries, state.supplementItems, state.supplementLogs, state.tasks, todayIso]);

  const focusedTodaySignals = useMemo(() => {
    if (todayFocus === "errands") return todaySignals.filter((signal) => signal.kind === "buy" || signal.kind === "help");
    if (todayFocus === "household") return todaySignals.filter((signal) => ["do", "take", "watch"].includes(signal.kind));
    if (todayFocus === "quiet") return todaySignals.filter((signal) => signal.kind === "take" || signal.kind === "watch");
    return todaySignals;
  }, [todayFocus, todaySignals]);

  const todayBrief = useMemo(() => {
    if (todayFocus === "quiet") {
      return {
        title: "The house can stay quiet.",
        text: "Only calendar and record-keeping signals are shown. Energy notes are not used to suggest tasks unless Mom explicitly asks later."
      };
    }
    const firstDo = focusedTodaySignals.find((signal) => signal.kind === "do");
    const firstWatch = focusedTodaySignals.find((signal) => signal.kind === "watch");
    const firstBuy = focusedTodaySignals.find((signal) => signal.kind === "buy");
    if (firstDo) return { title: firstDo.title, text: `${firstDo.detail}. The rest of the household picture remains available below without forcing a schedule.` };
    if (firstWatch) return { title: firstWatch.title, text: `${firstWatch.detail}. It is visible because it is scheduled or waiting, not because the app is assigning work.` };
    if (firstBuy) return { title: firstBuy.title, text: `${firstBuy.detail}. Saved purchasing information can support comparison before any order is placed.` };
    return { title: "Nothing is demanding attention.", text: "The household record is current enough for a quiet front page. Add something only when it is useful." };
  }, [focusedTodaySignals, todayFocus]);

  const todayStats = useMemo<TodayStat[]>(() => {
    const blocked = activeTasks.filter((task) => (task.dependencyIds ?? []).some((dependencyId) => {
      const dependency = state.tasks.find((entry) => entry.id === dependencyId);
      return dependency && !["Done", "Skipped", "Cancelled"].includes(dependency.status);
    })).length;
    return [
      { label: "ready actions", value: nextUpTasks.length, tone: "calm" },
      { label: "today", value: dueTodayTasks.length + state.calendarEntries.filter((entry) => calendarEntryOccursOnDate(entry, todayIso)).length, tone: dueTodayTasks.length ? "attention" : "calm" },
      { label: "buy signals", value: state.orderEntries.filter((entry) => entry.status === "Needed").length, tone: "attention" },
      { label: "blocked paths", value: blocked, tone: blocked ? "urgent" : "calm" }
    ];
  }, [activeTasks, dueTodayTasks.length, nextUpTasks.length, state.calendarEntries, state.orderEntries, state.tasks, todayIso]);
  const resolvedTodayLens: TodayInterfaceId = state.settings.todayLens === "last-used" || !isTodayInterfaceId(state.settings.todayLens) ? "briefing" : state.settings.todayLens;
  const reorderablePurchases = useMemo(
    () => state.purchaseRecords.filter((purchase) => purchase.reorderRecommendation === "Reorder same"),
    [state.purchaseRecords]
  );
  const filteredOrders = useMemo(() => {
    const scoped = state.orderEntries.filter((entry) => {
      if (orderScope === "needed") return entry.status === "Needed";
      if (orderScope === "ordered") return entry.status === "Ordered" || entry.status === "Purchased";
      if (orderScope === "received") return entry.status === "Received";
      return true;
    });
    const q = normalize(search);
    const sorted = [...scoped].sort((a, b) =>
      (b.updatedAt ?? b.createdAt ?? "").localeCompare(a.updatedAt ?? a.createdAt ?? "")
    );
    if (!q) return sorted;
    return sorted.filter((entry) => {
      const item = state.items.find((candidate) => candidate.id === entry.itemId);
      return [
        entry.name,
        entry.quantity,
        entry.urgency,
        entry.status,
        entry.preferredBrand,
        entry.preferredStore,
        entry.estimatedPrice,
        entry.replacementUrl,
        entry.orderNumber,
        entry.trackingUrl,
        entry.expectedDeliveryDate,
        entry.orderedAt,
        entry.receivedAt,
        entry.notes,
        item?.name,
        item?.category,
        item?.preferredStore
      ]
        .filter(Boolean)
        .some((value) => normalize(String(value)).includes(q));
    });
  }, [orderScope, search, state.items, state.orderEntries]);
  const orderCounts = useMemo(
    () => ({
      needed: state.orderEntries.filter((entry) => entry.status === "Needed").length,
      ordered: state.orderEntries.filter((entry) => entry.status === "Ordered" || entry.status === "Purchased").length,
      received: state.orderEntries.filter((entry) => entry.status === "Received").length,
      all: state.orderEntries.length
    }),
    [state.orderEntries]
  );
  const lowSupplements = useMemo(
    () =>
      state.supplementItems.filter((supplement) => {
        const remaining = Number(supplement.pillsRemaining);
        const threshold = Number(supplement.reorderThreshold);
        return Number.isFinite(remaining) && Number.isFinite(threshold) && threshold > 0 && remaining <= threshold;
      }),
    [state.supplementItems]
  );
  const recentSupplementLogs = useMemo(
    () => [...state.supplementLogs].sort((a, b) => b.takenAt.localeCompare(a.takenAt)).slice(0, 8),
    [state.supplementLogs]
  );
  const supplementCounts = useMemo(
    () => ({
      tracked: state.supplementItems.length,
      low: lowSupplements.length,
      out: state.supplementItems.filter((supplement) => Number(supplement.pillsRemaining) === 0).length,
      logs: state.supplementLogs.length
    }),
    [lowSupplements.length, state.supplementItems, state.supplementLogs.length]
  );
  const scopedTasks = useMemo(() => {
    const pool =
      taskScope === "today"
        ? dueTodayTasks
        : taskScope === "next"
          ? nextUpTasks
        : taskScope === "starred"
          ? starredTasks
          : taskScope === "quick"
            ? quickWinTasks
            : taskScope === "help"
              ? helpTasks
              : taskScope === "all"
                ? state.tasks
                : activeTasks;
    const q = normalize(search);
    if (!q) return pool;
    return pool.filter((task) => {
      const relatedItem = state.items.find((item) => item.id === task.relatedItemId);
      const flags = task.flagIds.map((id) => state.taskFlags.find((flag) => flag.id === id)?.name);
      const tags = task.tagIds.map((id) => state.taskTags.find((tag) => tag.id === id)?.name);
      const project = state.taskProjects.find((entry) => entry.id === task.projectId);
      const blockers = (task.dependencyIds ?? []).map((id) => state.tasks.find((entry) => entry.id === id)?.title);
      return [
        task.title,
        task.notes,
        task.status,
        task.effort,
        task.dueDate,
        task.reminderAt,
        project?.name,
        relatedItem?.name,
        relatedItem?.category,
        ...flags,
        ...tags,
        ...blockers
      ]
        .filter(Boolean)
        .some((value) => normalize(String(value)).includes(q));
    });
  }, [activeTasks, dueTodayTasks, helpTasks, nextUpTasks, quickWinTasks, search, starredTasks, state.items, state.taskFlags, state.taskProjects, state.taskTags, state.tasks, taskScope]);

  const filteredItems = useMemo(() => {
    const q = normalize(search);
    if (!q) return state.items;
    return state.items.filter((item) => {
      const location = locationName(item.locationId);
      const container = containerName(item.containerId);
      const purchase = getLastPurchase(item.id, state.purchaseRecords);
      return [
        item.name,
        item.category,
        item.brand,
        item.barcode,
        item.quantityStatus,
        item.condition,
        item.notes,
        item.preferredStore,
        location,
        container,
        purchase?.storeName,
        purchase?.sellerName,
        purchase?.brand,
        purchase?.productName,
        purchase?.orderNumber,
        purchase?.notes
      ]
        .filter(Boolean)
        .some((value) => normalize(String(value)).includes(q));
    });
  }, [search, state.items, state.locations, state.containers, state.purchaseRecords]);

  const filteredPurchases = useMemo(() => {
    const scoped = state.purchaseRecords.filter((purchase) => {
      if (purchaseScope === "reorder") return purchase.reorderRecommendation === "Reorder same";
      if (purchaseScope === "compare") return purchase.reorderRecommendation === "Compare first";
      if (purchaseScope === "avoid") return purchase.reorderRecommendation === "Avoid" || purchase.purchasePreference === "Do not buy again";
      return true;
    });
    const q = normalize(search);
    const sorted = [...scoped].sort((a, b) => (b.purchasedAt ?? b.createdAt).localeCompare(a.purchasedAt ?? a.createdAt));
    if (!q) return sorted;
    return sorted.filter((purchase) => {
      const item = state.items.find((entry) => entry.id === purchase.itemId);
      return [
        purchase.productName,
        purchase.storeName,
        purchase.sellerName,
        purchase.brand,
        purchase.orderNumber,
        purchase.productUrl,
        purchase.receiptUrl,
        purchase.purchasePreference,
        purchase.reorderRecommendation,
        purchase.notes,
        item?.name,
        item?.category
      ]
        .filter(Boolean)
        .some((value) => normalize(String(value)).includes(q));
    });
  }, [purchaseScope, search, state.items, state.purchaseRecords]);

  const purchaseCounts = useMemo(
    () => ({
      all: state.purchaseRecords.length,
      reorder: state.purchaseRecords.filter((purchase) => purchase.reorderRecommendation === "Reorder same").length,
      compare: state.purchaseRecords.filter((purchase) => purchase.reorderRecommendation === "Compare first").length,
      avoid: state.purchaseRecords.filter((purchase) => purchase.reorderRecommendation === "Avoid" || purchase.purchasePreference === "Do not buy again").length,
      receipts: state.purchaseRecords.filter((purchase) => purchase.receiptUrl || purchase.receiptPhotoUrl).length
    }),
    [state.purchaseRecords]
  );

  const filteredSupplements = useMemo(() => {
    const q = normalize(search);
    if (!q) return state.supplementItems;
    return state.supplementItems.filter((supplement) =>
      [
        supplement.name,
        supplement.brand,
        supplement.doseInstructions,
        supplement.pillsRemaining,
        supplement.reorderThreshold,
        supplement.preferredStore,
        supplement.productUrl,
        supplement.notes
      ]
        .filter(Boolean)
        .some((value) => normalize(String(value)).includes(q))
    );
  }, [search, state.supplementItems]);

  function locationName(id?: string) {
    return state.locations.find((location) => location.id === id)?.name ?? "No location";
  }

  function containerName(id?: string) {
    return state.containers.find((container) => container.id === id)?.name ?? "";
  }

  function maxStars() {
    if (state.settings.starMode === "0-3") return 3;
    if (state.settings.starMode === "0-5") return 5;
    if (state.settings.starMode === "gold") return 1;
    return 0;
  }

  function starLabel(starCount: number) {
    if (state.settings.starMode === "off" || starCount <= 0) return "No stars";
    if (state.settings.starMode === "gold") return "Gold star";
    return `${starCount}/${maxStars()} stars`;
  }

  function purchaseSource(purchase: PurchaseRecord) {
    return [purchase.storeName, purchase.sellerName].filter(Boolean).join(" / ") || "Unknown vendor";
  }

  function linkedItem(entry: OrderEntry) {
    return state.items.find((item) => item.id === entry.itemId);
  }

  function taskEmptyMessage() {
    if (search.trim()) return "Nothing matches that search.";
    if (taskScope === "next") return "Nothing is ready right now. Check the project map below for what is waiting.";
    if (taskScope === "today") return "Nothing is due today.";
    if (taskScope === "starred") return "No starred tasks yet.";
    if (taskScope === "quick") return "No quick wins marked yet.";
    if (taskScope === "help") return "No help requests right now.";
    if (taskScope === "all") return "No tasks saved yet.";
    return "No open tasks right now.";
  }

  function changeTodayLens(lens: TodayInterfaceId) {
    setState((current) => ({ ...current, settings: { ...current.settings, todayLens: lens } }));
  }

  function changeTodayFocus(focus: TodayFocus) {
    setTodayFocus(focus);
    if (focus === "errands") setActiveTodayKind("buy");
    else if (focus === "quiet") setActiveTodayKind("take");
    else setActiveTodayKind("do");
  }

  function openTodaySignal(signal: TodaySignal) {
    if (signal.kind === "do") {
      setTaskScope("next");
      setView("tasks");
      return;
    }
    if (signal.kind === "buy") {
      setOrderScope("needed");
      setView("orders");
      return;
    }
    if (signal.kind === "take") {
      setView("supplements");
      return;
    }
    if (signal.kind === "watch") {
      setView("calendar");
      return;
    }
    if (helpTasks.length) {
      setTaskScope("help");
      setView("tasks");
    } else {
      setView("more");
    }
  }

  function flagById(id: string) {
    return state.taskFlags.find((flag) => flag.id === id);
  }

  function tagById(id: string) {
    return state.taskTags.find((tag) => tag.id === id);
  }

  function projectById(id?: string) {
    return state.taskProjects.find((project) => project.id === id);
  }

  function activeBlockers(task: CommandTask) {
    return (task.dependencyIds ?? [])
      .map((id) => state.tasks.find((entry) => entry.id === id))
      .filter((entry): entry is CommandTask => entry !== undefined)
      .filter((entry) => !["Done", "Skipped", "Cancelled"].includes(entry.status));
  }

  function isFinishedTask(task: CommandTask) {
    return ["Done", "Skipped", "Cancelled"].includes(task.status);
  }

  function taskMapRank(task: CommandTask) {
    if (isFinishedTask(task)) return 4;
    if (activeBlockers(task).length) return 3;
    if (task.status === "Waiting") return 2;
    if (task.status === "Doing") return 0;
    return 1;
  }

  function orderProjectTasks(tasks: CommandTask[]) {
    return [...tasks].sort((a, b) => {
      const rankDifference = taskMapRank(a) - taskMapRank(b);
      if (rankDifference) return rankDifference;
      const dueDifference = (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");
      if (dueDifference) return dueDifference;
      const starDifference = b.starCount - a.starCount;
      if (starDifference) return starDifference;
      return a.title.localeCompare(b.title);
    });
  }

  function dependencyCreatesCycle(taskId: string, dependencyIds: string[]) {
    const taskById = new Map(state.tasks.map((task) => [task.id, task]));
    const reachesTask = (currentId: string, visited: Set<string>): boolean => {
      if (currentId === taskId) return true;
      if (visited.has(currentId)) return false;
      visited.add(currentId);
      return (taskById.get(currentId)?.dependencyIds ?? []).some((nextId) => reachesTask(nextId, visited));
    };
    return dependencyIds.some((dependencyId) => reachesTask(dependencyId, new Set<string>()));
  }

  function toggleDraftListValue(key: "flagIds" | "tagIds", id: string) {
    const current = Array.isArray(taskDraft[key]) ? taskDraft[key] ?? [] : [];
    const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
    setTaskDraft({ ...taskDraft, [key]: next });
  }

  function toggleTaskDependency(id: string) {
    const current = Array.isArray(taskDraft.dependencyIds) ? taskDraft.dependencyIds ?? [] : [];
    if (!current.includes(id) && taskDraft.id && dependencyCreatesCycle(taskDraft.id, [...current, id])) {
      const task = state.tasks.find((entry) => entry.id === id);
      setTaskFormMessage(`${task?.title ?? "That task"} already waits on this task, so it cannot also be a prerequisite.`);
      return;
    }
    const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
    setTaskFormMessage("");
    setTaskDraft({ ...taskDraft, dependencyIds: next });
  }

  function setTaskStarDraft(count: number) {
    setTaskDraft({ ...taskDraft, starCount: Math.min(count, maxStars()) });
  }

  async function requestNotificationPermission() {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  }

  function openCalendarForm(entry?: CalendarEntry) {
    const draft = entry ? { ...entry } : blankCalendarEntry(selectedCalendarDate);
    setCalendarDraft(draft);
    setShowCalendarForm(true);
    setView("calendar");
  }

  function saveCalendarEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!calendarDraft.title?.trim() || !calendarDraft.date) return;
    const now = nowIso();
    const isEdit = Boolean(calendarDraft.id);
    const entry: CalendarEntry = {
      id: calendarDraft.id ?? makeId("calendar"),
      householdId: HOUSEHOLD_ID,
      title: calendarDraft.title.trim(),
      notes: calendarDraft.notes || undefined,
      date: calendarDraft.date,
      startTime: calendarDraft.allDay ? undefined : calendarDraft.startTime || undefined,
      endTime: calendarDraft.allDay ? undefined : calendarDraft.endTime || undefined,
      allDay: Boolean(calendarDraft.allDay),
      location: calendarDraft.location || undefined,
      color: calendarDraft.color || "#37685f",
      repeat: calendarDraft.repeat || "Never",
      repeatUntil: calendarDraft.repeat === "Never" ? undefined : calendarDraft.repeatUntil || undefined,
      reminderMinutesBefore: calendarDraft.reminderMinutesBefore,
      nagEnabled: calendarDraft.reminderMinutesBefore !== undefined && Boolean(calendarDraft.nagEnabled),
      nagIntervalMinutes: calendarDraft.nagEnabled ? calendarDraft.nagIntervalMinutes || 15 : undefined,
      linkedTaskId: calendarDraft.linkedTaskId || undefined,
      createdAt: calendarDraft.createdAt ?? now,
      updatedAt: now
    };
    setState((current) => ({
      ...current,
      calendarEntries: isEdit
        ? current.calendarEntries.map((candidate) => candidate.id === entry.id ? entry : candidate)
        : [entry, ...current.calendarEntries]
    }));
    setSelectedCalendarDate(entry.date);
    setCalendarMonth(`${entry.date.slice(0, 7)}-01`);
    setCalendarDraft(blankCalendarEntry(entry.date));
    setShowCalendarForm(false);
  }

  function deleteCalendarEntry(entryId: string) {
    const entry = state.calendarEntries.find((candidate) => candidate.id === entryId);
    const ok = window.confirm(`Delete calendar entry: ${entry?.title ?? "this entry"}?`);
    if (!ok) return;
    setState((current) => ({ ...current, calendarEntries: current.calendarEntries.filter((candidate) => candidate.id !== entryId) }));
  }

  function selectCalendarDay(dateIso: string) {
    setSelectedCalendarDate(dateIso);
    if (!dateIso.startsWith(calendarMonth.slice(0, 7))) setCalendarMonth(`${dateIso.slice(0, 7)}-01`);
  }

  function moveCalendarMonth(direction: -1 | 1) {
    const next = direction === -1 ? subMonths(parseISO(calendarMonth), 1) : addMonths(parseISO(calendarMonth), 1);
    setCalendarMonth(format(next, "yyyy-MM-01"));
  }

  function openTaskForm(task?: CommandTask) {
    setTaskDraft(task ? { ...task } : blankTask());
    setTaskFormMessage("");
    setShowTaskForm(true);
    setView("tasks");
  }

  function openProjectTaskForm(projectId: string) {
    setTaskDraft({ ...blankTask(), projectId });
    setTaskFormMessage("");
    setShowTaskForm(true);
    setView("tasks");
  }

  function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskDraft.title?.trim()) return;
    const now = nowIso();
    const isEdit = Boolean(taskDraft.id);
    const taskId = taskDraft.id ?? makeId("task");
    const dependencyIds = (taskDraft.dependencyIds ?? []).filter((id) => id !== taskId);
    if (dependencyCreatesCycle(taskId, dependencyIds)) {
      setTaskFormMessage("This task would create a circular waiting loop. Remove one of the prerequisites and save again.");
      return;
    }
    const task: CommandTask = {
      id: taskId,
      householdId: HOUSEHOLD_ID,
      title: taskDraft.title.trim(),
      notes: taskDraft.notes || undefined,
      status: taskDraft.status || "Open",
      starCount: Math.min(taskDraft.starCount ?? 0, maxStars()),
      flagIds: taskDraft.flagIds ?? [],
      tagIds: taskDraft.tagIds ?? [],
      dueDate: taskDraft.dueDate || undefined,
      reminderAt: taskDraft.reminderAt || undefined,
      effort: taskDraft.effort || "Unsorted",
      projectId: taskDraft.projectId || undefined,
      dependencyIds,
      relatedItemId: taskDraft.relatedItemId || undefined,
      relatedOrderEntryId: taskDraft.relatedOrderEntryId || undefined,
      relatedPurchaseRecordId: taskDraft.relatedPurchaseRecordId || undefined,
      helpRequested: Boolean(taskDraft.helpRequested),
      createdAt: taskDraft.createdAt ?? now,
      updatedAt: now
    };
    setState((current) => ({
      ...current,
      tasks: isEdit ? current.tasks.map((entry) => (entry.id === task.id ? task : entry)) : [task, ...current.tasks]
    }));
    setTaskFormMessage("");
    setShowTaskForm(false);
    setTaskDraft(blankTask());
  }

  function saveTaskProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectDraft.name?.trim()) return;
    const now = nowIso();
    const isEdit = Boolean(projectDraft.id);
    const project: TaskProject = {
      id: projectDraft.id ?? makeId("project"),
      householdId: HOUSEHOLD_ID,
      name: projectDraft.name.trim(),
      color: projectDraft.color || "#37685f",
      notes: projectDraft.notes || undefined,
      createdAt: projectDraft.createdAt ?? now,
      updatedAt: now
    };
    setState((current) => ({
      ...current,
      taskProjects: isEdit ? current.taskProjects.map((entry) => (entry.id === project.id ? project : entry)) : [project, ...current.taskProjects]
    }));
    setProjectDraft(blankTaskProject());
    setShowProjectForm(false);
  }

  function deleteTaskProject(projectId: string) {
    const project = state.taskProjects.find((entry) => entry.id === projectId);
    const ok = window.confirm(`Delete project: ${project?.name ?? "this project"}? Tasks will stay, but become unassigned.`);
    if (!ok) return;
    setState((current) => ({
      ...current,
      taskProjects: current.taskProjects.filter((entry) => entry.id !== projectId),
      tasks: current.tasks.map((task) => (task.projectId === projectId ? { ...task, projectId: undefined, updatedAt: nowIso() } : task))
    }));
  }

  function updateTaskStatus(taskId: string, status: TaskStatus) {
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, status, updatedAt: nowIso() } : task))
    }));
  }

  function deleteTask(taskId: string) {
    const task = state.tasks.find((entry) => entry.id === taskId);
    const ok = window.confirm(`Delete task: ${task?.title ?? "this task"}?`);
    if (!ok) return;
    setState((current) => ({
      ...current,
      tasks: current.tasks.filter((entry) => entry.id !== taskId)
    }));
  }

  function saveTaskFlag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!flagDraft.name?.trim()) return;
    const now = nowIso();
    const isEdit = Boolean(flagDraft.id);
    const flag: TaskFlag = {
      id: flagDraft.id ?? makeId("flag"),
      householdId: HOUSEHOLD_ID,
      name: flagDraft.name.trim(),
      color: flagDraft.color || "#37685f",
      shape: flagDraft.shape || "Flag",
      symbol: flagDraft.symbol || undefined,
      meaning: flagDraft.meaning || undefined,
      createdAt: flagDraft.createdAt ?? now,
      updatedAt: now
    };
    setState((current) => ({
      ...current,
      taskFlags: isEdit ? current.taskFlags.map((entry) => (entry.id === flag.id ? flag : entry)) : [flag, ...current.taskFlags]
    }));
    setFlagDraft(blankTaskFlag());
    setShowFlagForm(false);
  }

  function deleteTaskFlag(flagId: string) {
    const flag = state.taskFlags.find((entry) => entry.id === flagId);
    const ok = window.confirm(`Delete flag: ${flag?.name ?? "this flag"}?`);
    if (!ok) return;
    setState((current) => ({
      ...current,
      taskFlags: current.taskFlags.filter((entry) => entry.id !== flagId),
      tasks: current.tasks.map((task) => ({ ...task, flagIds: task.flagIds.filter((id) => id !== flagId) }))
    }));
  }

  function saveTaskTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tagDraft.name?.trim()) return;
    const now = nowIso();
    const isEdit = Boolean(tagDraft.id);
    const tag: TaskTag = {
      id: tagDraft.id ?? makeId("tag"),
      householdId: HOUSEHOLD_ID,
      name: tagDraft.name.trim(),
      color: tagDraft.color || undefined,
      createdAt: tagDraft.createdAt ?? now,
      updatedAt: now
    };
    setState((current) => ({
      ...current,
      taskTags: isEdit ? current.taskTags.map((entry) => (entry.id === tag.id ? tag : entry)) : [tag, ...current.taskTags]
    }));
    setTagDraft(blankTaskTag());
    setShowTagForm(false);
  }

  function deleteTaskTag(tagId: string) {
    const tag = state.taskTags.find((entry) => entry.id === tagId);
    const ok = window.confirm(`Delete tag: ${tag?.name ?? "this tag"}?`);
    if (!ok) return;
    setState((current) => ({
      ...current,
      taskTags: current.taskTags.filter((entry) => entry.id !== tagId),
      tasks: current.tasks.map((task) => ({ ...task, tagIds: task.tagIds.filter((id) => id !== tagId) }))
    }));
  }

  function saveEnergyJournal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!energyDraft.energyLabel?.trim() && !energyDraft.notes?.trim()) return;
    const now = nowIso();
    const entry: EnergyJournalEntry = {
      id: makeId("energy"),
      householdId: HOUSEHOLD_ID,
      recordedAt: energyDraft.recordedAt || todayIso,
      energyLabel: energyDraft.energyLabel || undefined,
      notes: energyDraft.notes || undefined,
      createdAt: now
    };
    setState((current) => ({ ...current, energyJournal: [entry, ...current.energyJournal] }));
    setEnergyDraft(blankEnergyJournalEntry());
    setShowEnergyForm(false);
  }

  function updateStarMode(starMode: StarMode) {
    const max = starMode === "0-3" ? 3 : starMode === "0-5" ? 5 : starMode === "gold" ? 1 : 0;
    setState((current) => ({
      ...current,
      settings: { ...current.settings, starMode },
      tasks: current.tasks.map((task) => ({ ...task, starCount: Math.min(task.starCount, max) }))
    }));
  }

  function updateTodayLens(todayLens: TodayLens) {
    setState((current) => ({
      ...current,
      settings: { ...current.settings, todayLens }
    }));
  }

  function openSupplementForm(supplement?: SupplementItem) {
    setSupplementDraft(supplement ? { ...supplement } : blankSupplementItem());
    setShowSupplementForm(true);
    setView("supplements");
  }

  async function saveSupplement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supplementDraft.name?.trim()) return;
    const data = new FormData(event.currentTarget);
    const bottlePhoto = data.get("bottlePhoto") as File;
    const now = nowIso();
    const isEdit = Boolean(supplementDraft.id);
    const supplement: SupplementItem = {
      id: supplementDraft.id ?? makeId("supp"),
      householdId: HOUSEHOLD_ID,
      name: supplementDraft.name.trim(),
      brand: supplementDraft.brand || undefined,
      bottlePhotoUrl: (await fileToDataUrl(bottlePhoto?.size ? bottlePhoto : undefined)) ?? supplementDraft.bottlePhotoUrl,
      doseInstructions: supplementDraft.doseInstructions || undefined,
      pillsPerBottle: supplementDraft.pillsPerBottle || undefined,
      pillsRemaining: supplementDraft.pillsRemaining || undefined,
      reorderThreshold: supplementDraft.reorderThreshold || undefined,
      preferredStore: supplementDraft.preferredStore || undefined,
      productUrl: normalizeWebUrl(supplementDraft.productUrl),
      notes: supplementDraft.notes || undefined,
      createdAt: supplementDraft.createdAt ?? now,
      updatedAt: now
    };
    setState((current) => ({
      ...current,
      supplementItems: isEdit
        ? current.supplementItems.map((entry) => (entry.id === supplement.id ? supplement : entry))
        : [supplement, ...current.supplementItems]
    }));
    setSupplementDraft(blankSupplementItem());
    setShowSupplementForm(false);
  }

  function deleteSupplement(supplementId: string) {
    const supplement = state.supplementItems.find((entry) => entry.id === supplementId);
    const ok = window.confirm(`Delete supplement: ${supplement?.name ?? "this supplement"}?`);
    if (!ok) return;
    setState((current) => ({
      ...current,
      supplementItems: current.supplementItems.filter((entry) => entry.id !== supplementId),
      supplementLogs: current.supplementLogs.filter((entry) => entry.supplementItemId !== supplementId)
    }));
  }

  function openSupplementLogForm(supplement: SupplementItem) {
    setSupplementLogDraft(blankSupplementLog(supplement));
    setShowSupplementLogForm(true);
    setView("supplements");
  }

  function saveSupplementLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supplementLogDraft.supplementItemId) return;
    const now = nowIso();
    const log: SupplementLog = {
      id: makeId("supplog"),
      householdId: HOUSEHOLD_ID,
      supplementItemId: supplementLogDraft.supplementItemId,
      takenAt: supplementLogDraft.takenAt || new Date().toISOString().slice(0, 16),
      amountTaken: supplementLogDraft.amountTaken || undefined,
      notes: supplementLogDraft.notes || undefined,
      createdAt: now
    };
    const amount = Number(log.amountTaken);
    setState((current) => ({
      ...current,
      supplementLogs: [log, ...current.supplementLogs],
      supplementItems: current.supplementItems.map((supplement) => {
        if (supplement.id !== log.supplementItemId) return supplement;
        const remaining = Number(supplement.pillsRemaining);
        if (!Number.isFinite(remaining) || !Number.isFinite(amount) || amount <= 0) {
          return { ...supplement, updatedAt: now };
        }
        return { ...supplement, pillsRemaining: String(Math.max(remaining - amount, 0)), updatedAt: now };
      })
    }));
    setSupplementLogDraft(blankSupplementLog());
    setShowSupplementLogForm(false);
  }

  function quickLogSupplement(supplement: SupplementItem) {
    const now = nowIso();
    const log: SupplementLog = {
      id: makeId("supplog"),
      householdId: HOUSEHOLD_ID,
      supplementItemId: supplement.id,
      takenAt: new Date().toISOString().slice(0, 16),
      amountTaken: "1",
      createdAt: now
    };
    const remaining = Number(supplement.pillsRemaining);
    setState((current) => ({
      ...current,
      supplementLogs: [log, ...current.supplementLogs],
      supplementItems: current.supplementItems.map((entry) =>
        entry.id === supplement.id && Number.isFinite(remaining)
          ? { ...entry, pillsRemaining: String(Math.max(remaining - 1, 0)), updatedAt: now }
          : entry
      )
    }));
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setBackupPreflight(inspectBackup(file, JSON.parse(text)));
      setBackupMessage("Backup ready for review. Nothing has been changed.");
    } catch {
      setBackupPreflight(null);
      setBackupMessage("That backup file could not be read.");
    } finally {
      event.target.value = "";
    }
  }

  function cancelBackupRestore() {
    setBackupPreflight(null);
    setBackupMessage("Backup review cancelled. Nothing was changed.");
  }

  function confirmBackupRestore() {
    if (!backupPreflight) return;
    const ok = window.confirm(`Restore ${backupPreflight.fileName}? It will replace the current data in this browser.`);
    if (!ok) return;
    setState(backupPreflight.state);
    setBackupPreflight(null);
    setBackupMessage("Backup restored.");
  }

  function setItemDetail(itemId: string) {
    setSelectedItemId(itemId);
    setView("items");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0 });
      const url = new URL(window.location.href);
      url.searchParams.set("item", itemId);
      url.searchParams.delete("container");
      window.history.replaceState(null, "", url);
    }
  }

  function closeItemDetail() {
    setSelectedItemId("");
    setShowPurchaseForm(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("item");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }

  function copyItemLink(itemId: string) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("item", itemId);
    url.searchParams.delete("container");
    navigator.clipboard?.writeText(url.toString()).catch(() => undefined);
  }

  function openItemForm(item?: Item) {
    setItemDraft(item ? { ...item } : blankItem(state.locations));
    setShowItemForm(true);
    setView("items");
  }

  function openOrderForm(name?: string, itemId?: string, purchase?: PurchaseRecord) {
    setEditingOrderId("");
    setOrderDraft({
      ...blankOrder(),
      itemId,
      name: purchase?.productName ?? name ?? "",
      quantity: purchase ? [purchase.quantityPurchased, purchase.unitSize].filter(Boolean).join(" ") : "",
      preferredBrand: purchase?.brand ?? "",
      preferredStore: purchase ? purchaseSource(purchase) : "",
      estimatedPrice: purchase?.totalPrice ?? "",
      replacementUrl: purchase?.productUrl ?? ""
    });
    setShowOrderForm(true);
    setView("orders");
  }

  function editOrder(entry: OrderEntry) {
    setEditingOrderId(entry.id);
    setOrderDraft({ ...entry });
    setShowOrderForm(true);
  }

  function openPurchaseForm(item: Item, purchase?: PurchaseRecord) {
    setPurchaseDraft(purchase ? { ...purchase } : blankPurchase(item));
    setSelectedItemId(item.id);
    setShowPurchaseForm(true);
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!itemDraft.name?.trim() || !itemDraft.locationId) return;
    const data = new FormData(event.currentTarget);
    const photoFile = data.get("photo") as File;
    const photoUrl = await fileToDataUrl(photoFile?.size ? photoFile : undefined);
    const now = nowIso();
    const isEdit = Boolean(itemDraft.id);
    const item: Item = {
      id: itemDraft.id ?? makeId("item"),
      householdId: HOUSEHOLD_ID,
      locationId: itemDraft.locationId,
      containerId: itemDraft.containerId || undefined,
      name: itemDraft.name.trim(),
      normalizedName: normalize(itemDraft.name),
      category: itemDraft.category || "Miscellaneous",
      brand: itemDraft.brand || undefined,
      barcode: itemDraft.barcode || undefined,
      quantityStatus: itemDraft.quantityStatus || "Unknown",
      quantityNumber: itemDraft.quantityNumber || undefined,
      unit: itemDraft.unit || undefined,
      condition: itemDraft.condition || "Unknown",
      notes: itemDraft.notes || undefined,
      photoUrl: photoUrl ?? itemDraft.photoUrl,
      expirationDate: itemDraft.expirationDate || undefined,
      preferredStore: itemDraft.preferredStore || undefined,
      replacementUrl: normalizeWebUrl(itemDraft.replacementUrl),
      createdAt: itemDraft.createdAt ?? now,
      updatedAt: now
    };
    setState((current) => ({
      ...current,
      items: isEdit ? current.items.map((entry) => (entry.id === item.id ? item : entry)) : [item, ...current.items]
    }));
    setItemDetail(item.id);
    setShowItemForm(false);
  }

  function deleteItem(itemId: string) {
    const item = state.items.find((entry) => entry.id === itemId);
    const ok = window.confirm(`Delete ${item?.name ?? "this item"} and its purchase history?`);
    if (!ok) return;
    setState((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== itemId),
      orderEntries: current.orderEntries.map((entry) => (entry.itemId === itemId ? { ...entry, itemId: undefined } : entry)),
      purchaseRecords: current.purchaseRecords.filter((purchase) => purchase.itemId !== itemId)
    }));
    closeItemDetail();
  }

  function saveLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!locationDraft.name?.trim()) return;
    const now = nowIso();
    const location: Location = {
      id: makeId("loc"),
      householdId: HOUSEHOLD_ID,
      parentLocationId: locationDraft.parentLocationId || undefined,
      name: locationDraft.name.trim(),
      type: locationDraft.type || "Other",
      notes: locationDraft.notes || undefined,
      qrCodeValue: `mom-inventory://location/${locationDraft.name.trim()}`,
      createdAt: now,
      updatedAt: now
    };
    setState((current) => ({ ...current, locations: [...current.locations, location] }));
    setShowLocationForm(false);
    setLocationDraft(blankLocation());
  }

  async function saveContainer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!containerDraft.name?.trim() || !containerDraft.locationId || !containerDraft.containerCode?.trim()) return;
    const data = new FormData(event.currentTarget);
    const outsideFile = data.get("outsidePhoto") as File;
    const insideFile = data.get("insidePhoto") as File;
    const now = nowIso();
    const container: Container = {
      id: makeId("con"),
      householdId: HOUSEHOLD_ID,
      locationId: containerDraft.locationId,
      name: containerDraft.name.trim(),
      containerCode: containerDraft.containerCode.trim(),
      category: containerDraft.category || "Miscellaneous",
      notes: containerDraft.notes || undefined,
      outsidePhotoUrl: await fileToDataUrl(outsideFile?.size ? outsideFile : undefined),
      insidePhotoUrl: await fileToDataUrl(insideFile?.size ? insideFile : undefined),
      qrCodeValue: `mom-inventory://container/${containerDraft.containerCode.trim()}`,
      lastReviewedAt: now.slice(0, 10),
      createdAt: now,
      updatedAt: now
    };
    setState((current) => ({ ...current, containers: [container, ...current.containers] }));
    setShowContainerForm(false);
    setContainerDraft(blankContainer(state.locations));
  }

  function saveOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orderDraft.name?.trim()) return;
    const now = nowIso();
    const existingEntry = state.orderEntries.find((entry) => entry.id === editingOrderId);
    const status = orderDraft.status || "Needed";
    const entry: OrderEntry = {
      id: existingEntry?.id ?? makeId("order"),
      householdId: HOUSEHOLD_ID,
      itemId: orderDraft.itemId,
      name: orderDraft.name.trim(),
      quantity: orderDraft.quantity || undefined,
      urgency: orderDraft.urgency || "Needed soon",
      preferredBrand: orderDraft.preferredBrand || undefined,
      preferredStore: orderDraft.preferredStore || undefined,
      estimatedPrice: orderDraft.estimatedPrice || undefined,
      replacementUrl: normalizeWebUrl(orderDraft.replacementUrl),
      orderNumber: orderDraft.orderNumber || undefined,
      trackingUrl: normalizeWebUrl(orderDraft.trackingUrl),
      expectedDeliveryDate: orderDraft.expectedDeliveryDate || undefined,
      orderedAt: orderDraft.orderedAt ?? (status === "Ordered" || status === "Purchased" || status === "Received" ? now : undefined),
      receivedAt: orderDraft.receivedAt ?? (status === "Received" ? now : undefined),
      notes: orderDraft.notes || undefined,
      status,
      createdAt: existingEntry?.createdAt ?? now,
      updatedAt: now
    };
    setState((current) => ({
      ...current,
      orderEntries: existingEntry ? current.orderEntries.map((candidate) => (candidate.id === entry.id ? entry : candidate)) : [entry, ...current.orderEntries]
    }));
    setShowOrderForm(false);
    setEditingOrderId("");
    setOrderDraft(blankOrder());
  }

  async function savePurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!purchaseDraft.itemId || !purchaseDraft.productName?.trim()) return;
    const data = new FormData(event.currentTarget);
    const receiptFile = data.get("receiptPhoto") as File;
    const now = nowIso();
    const isEdit = Boolean(purchaseDraft.id);
    const purchase: PurchaseRecord = {
      id: purchaseDraft.id ?? makeId("purchase"),
      householdId: HOUSEHOLD_ID,
      itemId: purchaseDraft.itemId,
      purchasedAt: purchaseDraft.purchasedAt || undefined,
      storeName: purchaseDraft.storeName || undefined,
      sellerName: purchaseDraft.sellerName || undefined,
      productName: purchaseDraft.productName.trim(),
      brand: purchaseDraft.brand || undefined,
      quantityPurchased: purchaseDraft.quantityPurchased || undefined,
      unitSize: purchaseDraft.unitSize || undefined,
      totalPrice: purchaseDraft.totalPrice || undefined,
      unitPrice: purchaseDraft.unitPrice || undefined,
      productUrl: normalizeWebUrl(purchaseDraft.productUrl),
      receiptUrl: normalizeWebUrl(purchaseDraft.receiptUrl),
      receiptPhotoUrl: (await fileToDataUrl(receiptFile?.size ? receiptFile : undefined)) ?? purchaseDraft.receiptPhotoUrl,
      orderNumber: purchaseDraft.orderNumber || undefined,
      notes: purchaseDraft.notes || undefined,
      purchasePreference: purchaseDraft.purchasePreference || "Unknown",
      reorderRecommendation: purchaseDraft.reorderRecommendation || "Compare first",
      createdAt: purchaseDraft.createdAt ?? now,
      updatedAt: now
    };
    setState((current) => ({
      ...current,
      purchaseRecords: isEdit
        ? current.purchaseRecords.map((entry) => (entry.id === purchase.id ? purchase : entry))
        : [purchase, ...current.purchaseRecords]
    }));
    setShowPurchaseForm(false);
    setPurchaseDraft(blankPurchase(selectedItem));
  }

  function deletePurchase(purchaseId: string) {
    const purchase = state.purchaseRecords.find((entry) => entry.id === purchaseId);
    const ok = window.confirm(`Delete purchase record for ${purchase?.productName ?? "this item"}?`);
    if (!ok) return;
    setState((current) => ({
      ...current,
      purchaseRecords: current.purchaseRecords.filter((entry) => entry.id !== purchaseId)
    }));
    setShowPurchaseForm(false);
    setPurchaseDraft(blankPurchase(selectedItem));
  }

  function updateItemStatus(itemId: string, quantityStatus: QuantityStatus) {
    setState((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? { ...item, quantityStatus, updatedAt: nowIso() } : item))
    }));
  }

  function markOrderedStatus(entryId: string, status: OrderStatus) {
    const now = nowIso();
    setState((current) => ({
      ...current,
      orderEntries: current.orderEntries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              status,
              orderedAt: entry.orderedAt ?? (status === "Ordered" || status === "Purchased" || status === "Received" ? now : undefined),
              receivedAt: entry.receivedAt ?? (status === "Received" ? now : undefined),
              updatedAt: now
            }
          : entry
      )
    }));
  }

  function renderItemCard(item: Item) {
    const lastPurchase = getLastPurchase(item.id, state.purchaseRecords);
    return (
      <article className="card" key={item.id}>
        <div className="thumb">{item.photoUrl ? <CloudImage src={item.photoUrl} alt="" /> : "Photo"}</div>
        <div>
          <div className="card-row">
            <h3>{item.name}</h3>
            <span className={statusClass(item.quantityStatus)}>{item.quantityStatus}</span>
          </div>
          <p className="meta">
            {item.category} | {locationName(item.locationId)}
            {item.containerId ? ` | ${containerName(item.containerId)}` : ""}
          </p>
          <p className="meta">
            {item.quantityNumber ? `${item.quantityNumber} ${item.unit ?? ""}` : "No exact count"} | {item.condition}
          </p>
          {lastPurchase ? (
            <p className="meta">
              Last bought {lastPurchase.purchasedAt || "date unknown"} at {lastPurchase.storeName || "unknown store"}
              {lastPurchase.totalPrice ? ` for ${money(lastPurchase.totalPrice)}` : ""}
            </p>
          ) : null}
          {item.notes ? <p className="meta">{item.notes}</p> : null}
          <div className="inline-actions" style={{ marginTop: 8 }}>
            <button className="small-button" onClick={() => setItemDetail(item.id)}>
              Details
            </button>
            <button className="small-button" onClick={() => openOrderForm(item.name, item.id, lastPurchase)}>
              Add to order
            </button>
            <button className="small-button" onClick={() => updateItemStatus(item.id, "Plenty")}>
              Mark plenty
            </button>
            <button className="small-button" onClick={() => updateItemStatus(item.id, "Out")}>
              Mark out
            </button>
          </div>
        </div>
      </article>
    );
  }

  function renderLowStockCard(item: Item) {
    const lastPurchase = getLastPurchase(item.id, state.purchaseRecords);
    const activeOrders = state.orderEntries.filter((entry) => entry.itemId === item.id && entry.status !== "Cancelled" && entry.status !== "Received");
    const isOverstock = item.quantityStatus === "Too much";
    return (
      <article className={`low-stock-card ${item.quantityStatus === "Out" ? "is-out" : isOverstock ? "is-overstock" : "is-low"}`} key={item.id}>
        <div className="low-stock-topline">
          <div>
            <span className="low-stock-eyebrow">{item.category}</span>
            <h3>{item.name}</h3>
            <p className="meta">
              {locationName(item.locationId)}
              {item.containerId ? ` | ${containerName(item.containerId)}` : ""}
            </p>
          </div>
          <span className={statusClass(item.quantityStatus)}>{item.quantityStatus}</span>
        </div>

        <div className="low-stock-facts">
          <div>
            <span>Count</span>
            <strong>{item.quantityNumber ? `${item.quantityNumber} ${item.unit ?? ""}`.trim() : "Not entered"}</strong>
          </div>
          <div>
            <span>Store</span>
            <strong>{item.preferredStore || lastPurchase?.storeName || "Any"}</strong>
          </div>
          <div>
            <span>Last bought</span>
            <strong>{lastPurchase ? `${lastPurchase.purchasedAt || "Date unknown"}${lastPurchase.totalPrice ? ` | ${money(lastPurchase.totalPrice)}` : ""}` : "No purchase saved"}</strong>
          </div>
          <div>
            <span>Order status</span>
            <strong>{activeOrders.length ? `${activeOrders.length} active` : "Not ordered"}</strong>
          </div>
        </div>

        {item.notes ? <p className="low-stock-note">{item.notes}</p> : null}

        <div className="low-stock-actions">
          {!isOverstock ? (
            <button className="small-button" onClick={() => openOrderForm(item.name, item.id, lastPurchase)}>
              Add to order
            </button>
          ) : null}
          <button className="small-button" onClick={() => setItemDetail(item.id)}>
            Open item
          </button>
          {isOverstock ? (
            <button className="small-button" onClick={() => updateItemStatus(item.id, "Enough")}>
              Mark enough
            </button>
          ) : (
            <button className="small-button" onClick={() => updateItemStatus(item.id, "Plenty")}>
              Mark plenty
            </button>
          )}
          <button className="small-button" onClick={() => updateItemStatus(item.id, "Out")}>
            Mark out
          </button>
        </div>
      </article>
    );
  }

  function renderFlagPills(flagIds: string[]) {
    if (!flagIds.length) return null;
    return (
      <div className="token-row">
        {flagIds.map((id) => {
          const flag = flagById(id);
          if (!flag) return null;
          return (
            <span className="flag-token" style={{ borderColor: flag.color }} key={id}>
              <span className="flag-dot" style={{ background: flag.color }} />
              {flag.symbol ? `${flag.symbol} ` : ""}
              {flag.name}
            </span>
          );
        })}
      </div>
    );
  }

  function renderTagPills(tagIds: string[]) {
    if (!tagIds.length) return null;
    return (
      <div className="token-row">
        {tagIds.map((id) => {
          const tag = tagById(id);
          if (!tag) return null;
          return (
            <span className="tag-token" style={tag.color ? { borderColor: tag.color } : undefined} key={id}>
              #{tag.name}
            </span>
          );
        })}
      </div>
    );
  }

  function renderStars(task: CommandTask) {
    const max = maxStars();
    if (!max) return <span className="muted">No stars</span>;
    return (
      <span className="stars" aria-label={starLabel(task.starCount)}>
        {Array.from({ length: max }).map((_, index) => (
          <span key={index} className={index < task.starCount ? "star filled" : "star"}>
            *
          </span>
        ))}
      </span>
    );
  }

  function renderTaskCard(task: CommandTask) {
    const relatedItem = state.items.find((item) => item.id === task.relatedItemId);
    const project = projectById(task.projectId);
    const blockers = activeBlockers(task);
    return (
      <article className="task-card" key={task.id}>
        <div className="card-row">
          <h3>{task.title}</h3>
          <span className="badge">{task.status}</span>
          {blockers.length ? <span className="badge blocked">Blocked</span> : <span className="badge ready">Ready now</span>}
        </div>
        <p className="meta">
          {renderStars(task)} | {task.effort}
          {task.dueDate ? ` | Due ${task.dueDate}` : ""}
          {task.helpRequested ? " | Help requested" : ""}
        </p>
        {renderFlagPills(task.flagIds)}
        {renderTagPills(task.tagIds)}
        {project ? <p className="meta">Project: {project.name}</p> : null}
        {blockers.length ? <p className="meta">Do first: {blockers.map((entry) => entry.title).join(", ")}</p> : null}
        {relatedItem ? <p className="meta">Related item: {relatedItem.name}</p> : null}
        {task.notes ? <p className="meta">{task.notes}</p> : null}
        {task.reminderAt ? <p className="meta">Reminder: {task.reminderAt.replace("T", " ")}</p> : null}
        <div className="inline-actions" style={{ marginTop: 8 }}>
          <button className="small-button" onClick={() => openTaskForm(task)}>
            Edit
          </button>
          <button className="small-button" onClick={() => updateTaskStatus(task.id, "Done")}>
            Done
          </button>
          <button className="small-button" onClick={() => updateTaskStatus(task.id, "Waiting")}>
            Waiting
          </button>
          <button className="danger-button" onClick={() => deleteTask(task.id)}>
            Delete
          </button>
        </div>
      </article>
    );
  }

  function reminderLabel(minutes?: number) {
    if (minutes === undefined) return "No reminder";
    if (minutes === 0) return "At start time";
    if (minutes === 1440) return "1 day before";
    if (minutes === 60) return "1 hour before";
    return `${minutes} minutes before`;
  }

  function renderCalendarEntryCard(entry: CalendarEntry, occurrenceDate = selectedCalendarDate) {
    const linkedTask = state.tasks.find((task) => task.id === entry.linkedTaskId);
    return (
      <article className="calendar-entry-card" style={{ borderLeftColor: entry.color }} key={`${entry.id}-${occurrenceDate}`}>
        <div className="calendar-entry-topline">
          <div>
            <span className="calendar-entry-time">{calendarTimeLabel(entry)}</span>
            <h3>{entry.title}</h3>
          </div>
          {entry.repeat !== "Never" ? <span className="badge">{entry.repeat}</span> : null}
        </div>
        <div className="calendar-entry-meta">
          {entry.location ? <span>{entry.location}</span> : null}
          {entry.reminderMinutesBefore !== undefined ? <span>{reminderLabel(entry.reminderMinutesBefore)}</span> : null}
          {entry.nagEnabled ? <span>Nag every {entry.nagIntervalMinutes || 15} min</span> : null}
          {linkedTask ? <span>Task: {linkedTask.title}</span> : null}
        </div>
        {entry.notes ? <p className="calendar-entry-note">{entry.notes}</p> : null}
        <div className="calendar-entry-actions">
          <button className="small-button" onClick={() => openCalendarForm(entry)}>Edit</button>
          {linkedTask ? <button className="small-button" onClick={() => openTaskForm(linkedTask)}>Open task</button> : null}
          <button className="danger-button" onClick={() => deleteCalendarEntry(entry.id)}>Delete</button>
        </div>
      </article>
    );
  }

  function renderCalendarForm() {
    return (
      <form className="form-panel calendar-form" onSubmit={saveCalendarEntry}>
        <div className="section-head">
          <div>
            <h2>{calendarDraft.id ? "Edit calendar entry" : "Add calendar entry"}</h2>
            <p className="muted">No category is required. Use only the details that help.</p>
          </div>
          <button className="ghost-button" type="button" onClick={() => setShowCalendarForm(false)}>Close</button>
        </div>
        <div className="form-grid">
          <label className="label">
            <span>Title</span>
            <textarea className="textarea title-area" required value={calendarDraft.title ?? ""} onChange={(event) => setCalendarDraft({ ...calendarDraft, title: event.target.value })} />
          </label>
          <div className="form-row">
            <label className="label">
              <span>Date</span>
              <input className="field" type="date" required value={calendarDraft.date ?? ""} onChange={(event) => setCalendarDraft({ ...calendarDraft, date: event.target.value })} />
            </label>
            <label className="label">
              <span>Color</span>
              <input className="field color-field" type="color" value={calendarDraft.color ?? "#37685f"} onChange={(event) => setCalendarDraft({ ...calendarDraft, color: event.target.value })} />
            </label>
          </div>
          <label className="check-label">
            <input type="checkbox" checked={Boolean(calendarDraft.allDay)} onChange={(event) => setCalendarDraft({ ...calendarDraft, allDay: event.target.checked })} />
            <span>All day</span>
          </label>
          {!calendarDraft.allDay ? (
            <div className="form-row">
              <label className="label">
                <span>Start time</span>
                <input className="field" type="time" value={calendarDraft.startTime ?? ""} onChange={(event) => setCalendarDraft({ ...calendarDraft, startTime: event.target.value })} />
              </label>
              <label className="label">
                <span>End time</span>
                <input className="field" type="time" value={calendarDraft.endTime ?? ""} onChange={(event) => setCalendarDraft({ ...calendarDraft, endTime: event.target.value })} />
              </label>
            </div>
          ) : null}
          <label className="label">
            <span>Location</span>
            <input className="field" value={calendarDraft.location ?? ""} onChange={(event) => setCalendarDraft({ ...calendarDraft, location: event.target.value })} />
          </label>
          <div className="form-row">
            <label className="label">
              <span>Repeat</span>
              <select className="field" value={calendarDraft.repeat ?? "Never"} onChange={(event) => setCalendarDraft({ ...calendarDraft, repeat: event.target.value as CalendarRepeat })}>
                {calendarRepeats.map((repeat) => <option key={repeat}>{repeat}</option>)}
              </select>
            </label>
            {calendarDraft.repeat !== "Never" ? (
              <label className="label">
                <span>Repeat until</span>
                <input className="field" type="date" min={calendarDraft.date} value={calendarDraft.repeatUntil ?? ""} onChange={(event) => setCalendarDraft({ ...calendarDraft, repeatUntil: event.target.value })} />
              </label>
            ) : null}
          </div>
          <label className="label">
            <span>Reminder</span>
            <select className="field" value={calendarDraft.reminderMinutesBefore ?? ""} onChange={(event) => setCalendarDraft({ ...calendarDraft, reminderMinutesBefore: event.target.value === "" ? undefined : Number(event.target.value) })}>
              <option value="">No reminder</option>
              <option value="0">At start time</option>
              <option value="15">15 minutes before</option>
              <option value="30">30 minutes before</option>
              <option value="60">1 hour before</option>
              <option value="1440">1 day before</option>
            </select>
          </label>
          {calendarDraft.reminderMinutesBefore !== undefined ? (
            <div className="nag-settings">
              <label className="check-label">
                <input type="checkbox" checked={Boolean(calendarDraft.nagEnabled)} onChange={(event) => setCalendarDraft({ ...calendarDraft, nagEnabled: event.target.checked })} />
                <span>Nag mode</span>
              </label>
              {calendarDraft.nagEnabled ? (
                <label className="label">
                  <span>Repeat alert every</span>
                  <select className="field" value={calendarDraft.nagIntervalMinutes ?? 15} onChange={(event) => setCalendarDraft({ ...calendarDraft, nagIntervalMinutes: Number(event.target.value) })}>
                    {[5, 10, 15, 30, 60].map((minutes) => <option value={minutes} key={minutes}>{minutes} minutes</option>)}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
          <label className="label">
            <span>Linked task</span>
            <select className="field" value={calendarDraft.linkedTaskId ?? ""} onChange={(event) => setCalendarDraft({ ...calendarDraft, linkedTaskId: event.target.value })}>
              <option value="">No linked task</option>
              {state.tasks.map((task) => <option value={task.id} key={task.id}>{task.title}</option>)}
            </select>
          </label>
          <label className="label">
            <span>Notes</span>
            <textarea className="textarea" value={calendarDraft.notes ?? ""} onChange={(event) => setCalendarDraft({ ...calendarDraft, notes: event.target.value })} />
          </label>
          <div className="inline-actions">
            <button className="button" type="submit">Save entry</button>
            <button className="ghost-button" type="button" onClick={() => setShowCalendarForm(false)}>Cancel</button>
            {calendarDraft.id ? <button className="danger-button" type="button" onClick={() => deleteCalendarEntry(calendarDraft.id as string)}>Delete</button> : null}
          </div>
        </div>
      </form>
    );
  }

  function renderTaskForm() {
    const max = maxStars();
    return (
      <form className="form-panel" onSubmit={saveTask}>
        <h2>{taskDraft.id ? "Edit task" : "Add task"}</h2>
        <p className="muted">Flags, tags, and stars can all stack. Mom decides what they mean.</p>
        <div className="form-grid">
          <label className="label">
            <span>Task</span>
            <textarea className="textarea title-area" required value={taskDraft.title ?? ""} onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })} />
          </label>
          <div className="form-row">
            <label className="label">
              <span>Status</span>
              <select className="field" value={taskDraft.status ?? "Open"} onChange={(event) => setTaskDraft({ ...taskDraft, status: event.target.value as TaskStatus })}>
                {taskStatuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <label className="label">
              <span>Due date</span>
              <input className="field" type="date" value={taskDraft.dueDate ?? ""} onChange={(event) => setTaskDraft({ ...taskDraft, dueDate: event.target.value })} />
            </label>
          </div>
          <label className="label">
            <span>Reminder</span>
            <input className="field" type="datetime-local" value={taskDraft.reminderAt ?? ""} onChange={(event) => setTaskDraft({ ...taskDraft, reminderAt: event.target.value })} />
            <span className="hint">Optional. Alerts run while Mom Home is open in this build.</span>
          </label>
          <label className="label">
            <span>Stars</span>
            <div className="star-picker">
              {max ? (
                Array.from({ length: max + 1 }).map((_, count) => (
                  <button className={`star-choice ${taskDraft.starCount === count ? "active" : ""}`} type="button" key={count} onClick={() => setTaskStarDraft(count)}>
                    {count === 0 ? "0" : "*".repeat(count)}
                  </button>
                ))
              ) : (
                <span className="muted">Stars are off in Settings.</span>
              )}
            </div>
          </label>
          <label className="label">
            <span>Effort / size</span>
            <select className="field" value={taskDraft.effort ?? "Unsorted"} onChange={(event) => setTaskDraft({ ...taskDraft, effort: event.target.value as TaskEffort })}>
              {taskEfforts.map((effort) => (
                <option key={effort}>{effort}</option>
              ))}
            </select>
          </label>
          <label className="label">
            <span>Project</span>
            <select className="field" value={taskDraft.projectId ?? ""} onChange={(event) => setTaskDraft({ ...taskDraft, projectId: event.target.value })}>
              <option value="">No project</option>
              {state.taskProjects.map((project) => (
                <option value={project.id} key={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <div className="choice-panel">
            <strong>Do these first</strong>
            {state.tasks.filter((task) => task.id !== taskDraft.id).length ? (
              <div className="token-row">
                {state.tasks.filter((task) => task.id !== taskDraft.id).map((task) => {
                  const selected = (taskDraft.dependencyIds ?? []).includes(task.id);
                  const wouldLoop = Boolean(taskDraft.id && !selected && dependencyCreatesCycle(taskDraft.id, [...(taskDraft.dependencyIds ?? []), task.id]));
                  return (
                  <button className={`choice-token ${selected ? "active" : ""}`} type="button" key={task.id} onClick={() => toggleTaskDependency(task.id)} disabled={wouldLoop} title={wouldLoop ? "This would create a circular dependency." : undefined}>
                    {task.title}
                  </button>
                  );
                })}
              </div>
            ) : (
              <p className="meta">Add another task first if this one needs to wait.</p>
            )}
          </div>
          {taskFormMessage ? <p className="notice">{taskFormMessage}</p> : null}
          <label className="label">
            <span>Related inventory item</span>
            <select className="field" value={taskDraft.relatedItemId ?? ""} onChange={(event) => setTaskDraft({ ...taskDraft, relatedItemId: event.target.value })}>
              <option value="">None</option>
              {state.items.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div className="choice-panel">
            <strong>Flags</strong>
            {state.taskFlags.length ? (
              <div className="token-row">
                {state.taskFlags.map((flag) => (
                  <button className={`choice-token ${(taskDraft.flagIds ?? []).includes(flag.id) ? "active" : ""}`} type="button" key={flag.id} onClick={() => toggleDraftListValue("flagIds", flag.id)}>
                    <span className="flag-dot" style={{ background: flag.color }} />
                    {flag.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="meta">No flags yet. Add custom flags below.</p>
            )}
          </div>
          <div className="choice-panel">
            <strong>Tags</strong>
            {state.taskTags.length ? (
              <div className="token-row">
                {state.taskTags.map((tag) => (
                  <button className={`choice-token ${(taskDraft.tagIds ?? []).includes(tag.id) ? "active" : ""}`} type="button" key={tag.id} onClick={() => toggleDraftListValue("tagIds", tag.id)}>
                    #{tag.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="meta">No tags yet. Add custom tags below.</p>
            )}
          </div>
          <label className="label">
            <span>Notes</span>
            <textarea className="textarea" value={taskDraft.notes ?? ""} onChange={(event) => setTaskDraft({ ...taskDraft, notes: event.target.value })} />
          </label>
          <label className="check-label">
            <input type="checkbox" checked={Boolean(taskDraft.helpRequested)} onChange={(event) => setTaskDraft({ ...taskDraft, helpRequested: event.target.checked })} />
            Mark as needing help
          </label>
          <div className="inline-actions">
            <button className="button" type="submit">
              Save task
            </button>
            <button className="ghost-button" type="button" onClick={() => setShowTaskForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  }

  function renderFlagForm() {
    return (
      <form className="form-panel" onSubmit={saveTaskFlag}>
        <h2>{flagDraft.id ? "Edit flag" : "Add custom flag"}</h2>
        <div className="form-grid">
          <label className="label">
            <span>Flag name</span>
            <input className="field" required value={flagDraft.name ?? ""} onChange={(event) => setFlagDraft({ ...flagDraft, name: event.target.value })} />
          </label>
          <div className="form-row">
            <label className="label">
              <span>Color</span>
              <input className="field color-field" type="color" value={flagDraft.color ?? "#37685f"} onChange={(event) => setFlagDraft({ ...flagDraft, color: event.target.value })} />
            </label>
            <label className="label">
              <span>Shape</span>
              <select className="field" value={flagDraft.shape ?? "Flag"} onChange={(event) => setFlagDraft({ ...flagDraft, shape: event.target.value as FlagShape })}>
                {flagShapes.map((shape) => (
                  <option key={shape}>{shape}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="label">
            <span>Optional symbol</span>
            <input className="field" maxLength={4} value={flagDraft.symbol ?? ""} onChange={(event) => setFlagDraft({ ...flagDraft, symbol: event.target.value })} />
          </label>
          <label className="label">
            <span>What this flag means to her</span>
            <textarea className="textarea" value={flagDraft.meaning ?? ""} onChange={(event) => setFlagDraft({ ...flagDraft, meaning: event.target.value })} />
          </label>
          <div className="inline-actions">
            <button className="button" type="submit">
              Save flag
            </button>
            <button className="ghost-button" type="button" onClick={() => setShowFlagForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  }

  function renderProjectForm() {
    return (
      <form className="form-panel" onSubmit={saveTaskProject}>
        <h2>{projectDraft.id ? "Edit project" : "Add project"}</h2>
        <div className="form-grid">
          <label className="label">
            <span>Project name</span>
            <input className="field" required value={projectDraft.name ?? ""} onChange={(event) => setProjectDraft({ ...projectDraft, name: event.target.value })} />
          </label>
          <label className="label">
            <span>Color</span>
            <input className="field color-field" type="color" value={projectDraft.color ?? "#37685f"} onChange={(event) => setProjectDraft({ ...projectDraft, color: event.target.value })} />
          </label>
          <label className="label">
            <span>Notes</span>
            <textarea className="textarea" value={projectDraft.notes ?? ""} onChange={(event) => setProjectDraft({ ...projectDraft, notes: event.target.value })} />
          </label>
          <div className="inline-actions">
            <button className="button" type="submit">
              Save project
            </button>
            <button className="ghost-button" type="button" onClick={() => setShowProjectForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  }

  function renderProjectMap() {
    const groups = state.taskProjects.map((project) => ({
      project,
      tasks: state.tasks.filter((task) => task.projectId === project.id)
    }));
    const looseTasks = state.tasks.filter((task) => !task.projectId);
    const activeTaskCount = activeTasks.length;
    const blockedTasks = activeTasks.filter((task) => activeBlockers(task).length);
    const readyTasks = activeTasks.filter((task) => !activeBlockers(task).length && task.status !== "Waiting");
    const unlockerTasks = orderProjectTasks(state.tasks.filter((task) =>
      !isFinishedTask(task) && activeTasks.some((candidate) => (candidate.dependencyIds ?? []).includes(task.id))
    ));
    const renderSequenceTask = (task: CommandTask) => {
      const blockers = activeBlockers(task);
      const finished = isFinishedTask(task);
      const isPaused = task.status === "Waiting" && !blockers.length;
      const label = finished ? task.status : blockers.length ? `Waiting on ${blockers.length}` : isPaused ? "Paused" : task.status === "Doing" ? "In progress" : "Ready now";
      const badgeClass = finished ? "badge" : blockers.length ? "badge blocked" : isPaused ? "badge low" : "badge ready";
      return (
        <li className="sequence-task" key={task.id}>
          <div className="sequence-line">
            <strong>{task.title}</strong>
            <span className={badgeClass}>{label}</span>
          </div>
          <p className="meta">
            {task.dueDate ? `Due ${task.dueDate}` : "No date"}
            {task.effort !== "Unsorted" ? ` | ${task.effort}` : ""}
            {blockers.length ? ` | Do first: ${blockers.map((entry) => entry.title).join(", ")}` : ""}
          </p>
          <button className="text-button" type="button" onClick={() => openTaskForm(task)}>
            Open task
          </button>
        </li>
      );
    };
    return (
      <div className="project-map">
        <article className="project-card everything-map">
          <div className="card-row">
            <h3>Everything Map</h3>
            <span className="badge ready">{readyTasks.length} ready</span>
            {blockedTasks.length ? <span className="badge blocked">{blockedTasks.length} blocked</span> : null}
          </div>
          <p className="meta">A household-wide dependency view that explains what is available now, what is waiting, and which tasks unlock other work.</p>
          <div className="everything-map-grid">
            <div>
              <span>Active tasks</span>
              <strong>{activeTaskCount}</strong>
            </div>
            <div>
              <span>Ready now</span>
              <strong>{readyTasks.length}</strong>
            </div>
            <div>
              <span>Waiting paths</span>
              <strong>{blockedTasks.length}</strong>
            </div>
            <div>
              <span>Unlock keys</span>
              <strong>{unlockerTasks.length}</strong>
            </div>
          </div>
          {unlockerTasks.length ? (
            <div className="unlock-list" aria-label="Tasks that unlock other tasks">
              {unlockerTasks.slice(0, 5).map((task) => {
                const unlocks = activeTasks.filter((candidate) => (candidate.dependencyIds ?? []).includes(task.id));
                return (
                  <div className="unlock-row" key={task.id}>
                    <div>
                      <strong>{task.title}</strong>
                      <p className="meta">Unlocks {unlocks.length}: {unlocks.slice(0, 3).map((entry) => entry.title).join(", ")}{unlocks.length > 3 ? `, +${unlocks.length - 3} more` : ""}</p>
                    </div>
                    <button className="text-button" type="button" onClick={() => openTaskForm(task)}>Open</button>
                  </div>
                );
              })}
              {unlockerTasks.length > 5 ? <p className="meta">{unlockerTasks.length - 5} more unlocking task{unlockerTasks.length - 5 === 1 ? "" : "s"} are lower in the map.</p> : null}
            </div>
          ) : (
            <p className="meta">No active dependencies yet. Add prerequisites on task cards to build the map.</p>
          )}
        </article>
        {groups.map(({ project, tasks }) => {
          const orderedTasks = orderProjectTasks(tasks);
          const finished = tasks.filter(isFinishedTask);
          const active = tasks.filter((task) => !isFinishedTask(task));
          const ready = active.filter((task) => !activeBlockers(task).length && task.status !== "Waiting");
          const visibleTasks = showCompletedProjectTasks ? orderedTasks : orderedTasks.filter((task) => !isFinishedTask(task));
          const progress = tasks.length ? Math.round((finished.length / tasks.length) * 100) : 0;
          return (
          <article className="project-card" key={project.id}>
            <div className="card-row">
              <span className="flag-dot" style={{ background: project.color ?? "#37685f" }} />
              <h3>{project.name}</h3>
            </div>
            {project.notes ? <p className="meta">{project.notes}</p> : null}
            {tasks.length ? (
              <>
                <div className="project-progress-label">
                  <span>{active.length ? `${active.length} remaining` : "All tasks finished"}</span>
                  <span>{ready.length} ready now</span>
                </div>
                <div className="project-progress" role="progressbar" aria-label={`${project.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                  <span style={{ width: `${progress}%`, background: project.color ?? "#37685f" }} />
                </div>
                <p className="meta">{finished.length} of {tasks.length} finished</p>
              </>
            ) : null}
            <ol className="sequence-list">
              {visibleTasks.map(renderSequenceTask)}
              {!showCompletedProjectTasks && finished.length ? <li className="meta">{finished.length} finished task{finished.length === 1 ? "" : "s"} hidden.</li> : null}
              {!tasks.length ? <li className="meta">No tasks added to this project yet.</li> : null}
            </ol>
            <div className="inline-actions">
              <button className="small-button" type="button" onClick={() => openProjectTaskForm(project.id)}>
                Add task
              </button>
              <button className="small-button" onClick={() => { setProjectDraft({ ...project }); setShowProjectForm(true); }}>
                Edit
              </button>
              <button className="danger-button" onClick={() => deleteTaskProject(project.id)}>
                Delete
              </button>
            </div>
          </article>
          );
        })}
        {looseTasks.length ? (
          <article className="project-card">
            <h3>Not in a project yet</h3>
            <ol className="sequence-list">
              {orderProjectTasks(showCompletedProjectTasks ? looseTasks : looseTasks.filter((task) => !isFinishedTask(task))).map(renderSequenceTask)}
            </ol>
          </article>
        ) : null}
        {!groups.length && !looseTasks.length ? <div className="empty">No projects or tasks yet.</div> : null}
      </div>
    );
  }

  function renderTagForm() {
    return (
      <form className="form-panel" onSubmit={saveTaskTag}>
        <h2>{tagDraft.id ? "Edit tag" : "Add custom tag"}</h2>
        <div className="form-grid">
          <label className="label">
            <span>Tag name</span>
            <input className="field" required value={tagDraft.name ?? ""} onChange={(event) => setTagDraft({ ...tagDraft, name: event.target.value })} />
          </label>
          <label className="label">
            <span>Optional color</span>
            <input className="field color-field" type="color" value={tagDraft.color || "#ffffff"} onChange={(event) => setTagDraft({ ...tagDraft, color: event.target.value })} />
          </label>
          <div className="inline-actions">
            <button className="button" type="submit">
              Save tag
            </button>
            <button className="ghost-button" type="button" onClick={() => setShowTagForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  }

  function renderEnergyForm() {
    return (
      <form className="form-panel" onSubmit={saveEnergyJournal}>
        <h2>Energy journal</h2>
        <p className="muted">This is a record only. The app will not suggest tasks from energy unless she asks.</p>
        <div className="form-grid">
          <label className="label">
            <span>Date</span>
            <input className="field" type="date" value={energyDraft.recordedAt ?? todayIso} onChange={(event) => setEnergyDraft({ ...energyDraft, recordedAt: event.target.value })} />
          </label>
          <label className="label">
            <span>Energy / motivation note</span>
            <input className="field" value={energyDraft.energyLabel ?? ""} onChange={(event) => setEnergyDraft({ ...energyDraft, energyLabel: event.target.value })} />
          </label>
          <label className="label">
            <span>Notes</span>
            <textarea className="textarea" value={energyDraft.notes ?? ""} onChange={(event) => setEnergyDraft({ ...energyDraft, notes: event.target.value })} />
          </label>
          <div className="inline-actions">
            <button className="button" type="submit">
              Save note
            </button>
            <button className="ghost-button" type="button" onClick={() => setShowEnergyForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  }

  function renderSupplementCard(supplement: SupplementItem) {
    const remaining = Number(supplement.pillsRemaining);
    const threshold = Number(supplement.reorderThreshold);
    const isOut = Number.isFinite(remaining) && remaining === 0;
    const isLow = Number.isFinite(remaining) && Number.isFinite(threshold) && threshold > 0 && remaining <= threshold;
    const lastLog = state.supplementLogs
      .filter((log) => log.supplementItemId === supplement.id)
      .sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0];
    return (
      <article className={`supplement-card ${isOut ? "supplement-out" : isLow ? "supplement-low" : "supplement-ok"}`} key={supplement.id}>
        <div className="supplement-topline">
          <div className="supplement-identity">
            <div className="supplement-photo">{supplement.bottlePhotoUrl ? <CloudImage src={supplement.bottlePhotoUrl} alt={`${supplement.name} bottle`} /> : "Bottle"}</div>
            <div>
              <span className="supplement-eyebrow">{supplement.brand || "Brand not entered"}</span>
              <h3>{supplement.name}</h3>
            </div>
          </div>
          {isOut ? <span className="badge out">Out</span> : isLow ? <span className="badge low">Low</span> : <span className="badge plenty">Stocked</span>}
        </div>

        <div className="supplement-facts">
          <div><span>Remaining</span><strong>{supplement.pillsRemaining || "Not counted"}</strong></div>
          <div><span>Reorder at</span><strong>{supplement.reorderThreshold || "Not set"}</strong></div>
          <div><span>Bottle size</span><strong>{supplement.pillsPerBottle || "Not entered"}</strong></div>
          <div><span>Last taken</span><strong>{lastLog ? lastLog.takenAt.replace("T", " ") : "Not logged"}</strong></div>
        </div>

        {supplement.doseInstructions ? <p className="supplement-directions"><strong>Bottle directions:</strong> {supplement.doseInstructions}</p> : null}
        {supplement.preferredStore ? <p className="supplement-store">Preferred store: <strong>{supplement.preferredStore}</strong></p> : null}
        {supplement.notes ? <p className="supplement-note">{supplement.notes}</p> : null}

        <div className="supplement-actions">
          <button className="button" onClick={() => quickLogSupplement(supplement)}>Log 1 taken</button>
          <button className="small-button" onClick={() => openSupplementLogForm(supplement)}>Log amount</button>
          <button className="small-button" onClick={() => openSupplementForm(supplement)}>Edit</button>
          {normalizeWebUrl(supplement.productUrl) ? <a className="small-button link-button" href={normalizeWebUrl(supplement.productUrl)} target="_blank" rel="noreferrer">Product link</a> : null}
          <button className="danger-button" onClick={() => deleteSupplement(supplement.id)}>Delete</button>
        </div>
      </article>
    );
  }

  function renderSupplementForm() {
    return (
      <form className="form-panel" onSubmit={saveSupplement}>
        <h2>{supplementDraft.id ? "Edit supplement" : "Add supplement"}</h2>
        <p className="muted">For tracking bottles, remaining count, and reorder timing. This is not medical advice.</p>
        <div className="form-grid">
          <label className="label">
            <span>Supplement name</span>
            <input className="field" required value={supplementDraft.name ?? ""} onChange={(event) => setSupplementDraft({ ...supplementDraft, name: event.target.value })} />
          </label>
          <label className="label">
            <span>Brand</span>
            <input className="field" value={supplementDraft.brand ?? ""} onChange={(event) => setSupplementDraft({ ...supplementDraft, brand: event.target.value })} />
          </label>
          <label className="label">
            <span>Bottle photo</span>
            <input className="field" type="file" name="bottlePhoto" accept="image/*" capture="environment" />
          </label>
          {supplementDraft.bottlePhotoUrl ? <CloudImage className="photo-preview" src={supplementDraft.bottlePhotoUrl} alt="" /> : null}
          <label className="label">
            <span>Dose instructions from bottle</span>
            <textarea className="textarea" value={supplementDraft.doseInstructions ?? ""} onChange={(event) => setSupplementDraft({ ...supplementDraft, doseInstructions: event.target.value })} />
          </label>
          <div className="form-row">
            <label className="label">
              <span>Pills per bottle</span>
              <input className="field" inputMode="decimal" value={supplementDraft.pillsPerBottle ?? ""} onChange={(event) => setSupplementDraft({ ...supplementDraft, pillsPerBottle: event.target.value })} />
            </label>
            <label className="label">
              <span>Pills left</span>
              <input className="field" inputMode="decimal" value={supplementDraft.pillsRemaining ?? ""} onChange={(event) => setSupplementDraft({ ...supplementDraft, pillsRemaining: event.target.value })} />
            </label>
          </div>
          <label className="label">
            <span>Reorder when left reaches</span>
            <input className="field" inputMode="decimal" value={supplementDraft.reorderThreshold ?? ""} onChange={(event) => setSupplementDraft({ ...supplementDraft, reorderThreshold: event.target.value })} />
          </label>
          <div className="form-row">
            <label className="label">
              <span>Preferred store</span>
              <input className="field" value={supplementDraft.preferredStore ?? ""} onChange={(event) => setSupplementDraft({ ...supplementDraft, preferredStore: event.target.value })} />
            </label>
            <label className="label">
              <span>Product link</span>
              <input className="field" inputMode="url" value={supplementDraft.productUrl ?? ""} onChange={(event) => setSupplementDraft({ ...supplementDraft, productUrl: event.target.value })} />
            </label>
          </div>
          <label className="label">
            <span>Notes</span>
            <textarea className="textarea" value={supplementDraft.notes ?? ""} onChange={(event) => setSupplementDraft({ ...supplementDraft, notes: event.target.value })} />
          </label>
          <div className="inline-actions">
            <button className="button" type="submit">
              Save supplement
            </button>
            <button className="ghost-button" type="button" onClick={() => setShowSupplementForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  }

  function renderSupplementLogForm() {
    const supplement = state.supplementItems.find((entry) => entry.id === supplementLogDraft.supplementItemId);
    return (
      <form className="form-panel" onSubmit={saveSupplementLog}>
        <h2>Log taken</h2>
        <p className="muted">{supplement ? supplement.name : "Choose a supplement"}.</p>
        <div className="form-grid">
          <label className="label">
            <span>Supplement</span>
            <select className="field" required value={supplementLogDraft.supplementItemId ?? ""} onChange={(event) => setSupplementLogDraft({ ...supplementLogDraft, supplementItemId: event.target.value })}>
              <option value="">Choose one</option>
              {state.supplementItems.map((entry) => (
                <option value={entry.id} key={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <label className="label">
              <span>Date and time</span>
              <input className="field" type="datetime-local" value={supplementLogDraft.takenAt ?? ""} onChange={(event) => setSupplementLogDraft({ ...supplementLogDraft, takenAt: event.target.value })} />
            </label>
            <label className="label">
              <span>Amount</span>
              <input className="field" inputMode="decimal" value={supplementLogDraft.amountTaken ?? ""} onChange={(event) => setSupplementLogDraft({ ...supplementLogDraft, amountTaken: event.target.value })} />
            </label>
          </div>
          <label className="label">
            <span>Notes</span>
            <textarea className="textarea" value={supplementLogDraft.notes ?? ""} onChange={(event) => setSupplementLogDraft({ ...supplementLogDraft, notes: event.target.value })} />
          </label>
          <div className="inline-actions">
            <button className="button" type="submit">
              Save log
            </button>
            <button className="ghost-button" type="button" onClick={() => setShowSupplementLogForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  }

  function assistantExportText() {
    const taskSections = [
      ["STARRED", starredTasks],
      ["TODAY", dueTodayTasks],
      ["QUICK WINS", quickWinTasks],
      ["HELP REQUESTED", helpTasks]
    ];
    const taskText = taskSections
      .map(([title, tasks]) => {
        const taskList = tasks as CommandTask[];
        if (!taskList.length) return "";
        return `${title}\n${taskList
          .map((task, index) => {
            const flags = task.flagIds.map((id) => flagById(id)?.name).filter(Boolean).join(", ");
            const tags = task.tagIds.map((id) => tagById(id)?.name).filter(Boolean).join(", ");
            return `${index + 1}. ${task.title}${task.starCount ? ` (${starLabel(task.starCount)})` : ""}${flags ? ` | Flags: ${flags}` : ""}${tags ? ` | Tags: ${tags}` : ""}${task.notes ? `\n   Notes: ${task.notes}` : ""}`;
          })
          .join("\n")}`;
      })
      .filter(Boolean)
      .join("\n\n");
    const deliveryOrders = state.orderEntries.filter((entry) => ["Ordered", "Purchased"].includes(entry.status));
    const neededOrders = state.orderEntries.filter((entry) => entry.status === "Needed");
    const orderText = [
      ["ORDERS AND ARRIVALS", deliveryOrders],
      ["STILL NEEDS BUYING", neededOrders]
    ]
      .map(([title, orders]) => {
        const orderList = orders as OrderEntry[];
        if (!orderList.length) return "";
        return `${title}\n${orderList
          .map((entry, index) => {
            const details = [
              entry.status,
              entry.quantity ? `Quantity: ${entry.quantity}` : "",
              entry.preferredStore ? `Vendor: ${entry.preferredStore}` : "",
              entry.orderNumber ? `Order: ${entry.orderNumber}` : "",
              entry.expectedDeliveryDate ? `Expected: ${entry.expectedDeliveryDate}` : "",
              entry.trackingUrl ? `Tracking: ${entry.trackingUrl}` : "",
              entry.notes ? `Notes: ${entry.notes}` : ""
            ].filter(Boolean);
            return `${index + 1}. ${entry.name}${details.length ? ` | ${details.join(" | ")}` : ""}`;
          })
          .join("\n")}`;
      })
      .filter(Boolean)
      .join("\n\n");
    return [taskText, orderText].filter(Boolean).join("\n\n");
  }

  function renderItemForm() {
    return (
      <form className="form-panel" onSubmit={saveItem}>
        <h2>{itemDraft.id ? "Edit item" : "Add item"}</h2>
        <p className="muted">Only the name, location, category, and status matter.</p>
        <div className="form-grid">
          <label className="label">
            <span>Item name</span>
            <input className="field" required value={itemDraft.name ?? ""} onChange={(event) => setItemDraft({ ...itemDraft, name: event.target.value })} />
          </label>
          <div className="form-row">
            <label className="label">
              <span>Category</span>
              <select className="field" value={itemDraft.category ?? "Miscellaneous"} onChange={(event) => setItemDraft({ ...itemDraft, category: event.target.value })}>
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label className="label">
              <span>Status</span>
              <select className="field" value={itemDraft.quantityStatus ?? "Unknown"} onChange={(event) => setItemDraft({ ...itemDraft, quantityStatus: event.target.value as QuantityStatus })}>
                {quantityStatuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="label">
            <span>Location</span>
            <select className="field" required value={itemDraft.locationId ?? ""} onChange={(event) => setItemDraft({ ...itemDraft, locationId: event.target.value })}>
              {state.locations.map((location) => (
                <option value={location.id} key={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            <span>Container or bin</span>
            <select className="field" value={itemDraft.containerId ?? ""} onChange={(event) => setItemDraft({ ...itemDraft, containerId: event.target.value })}>
              <option value="">None</option>
              {state.containers.map((container) => (
                <option value={container.id} key={container.id}>
                  {container.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <label className="label">
              <span>Count</span>
              <input className="field" inputMode="decimal" value={itemDraft.quantityNumber ?? ""} onChange={(event) => setItemDraft({ ...itemDraft, quantityNumber: event.target.value })} />
            </label>
            <label className="label">
              <span>Unit</span>
              <input className="field" placeholder="rolls, boxes" value={itemDraft.unit ?? ""} onChange={(event) => setItemDraft({ ...itemDraft, unit: event.target.value })} />
            </label>
          </div>
          <label className="label">
            <span>Condition</span>
            <select className="field" value={itemDraft.condition ?? "Unknown"} onChange={(event) => setItemDraft({ ...itemDraft, condition: event.target.value as Condition })}>
              {conditionValues.map((condition) => (
                <option key={condition}>{condition}</option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <label className="label">
              <span>Preferred store</span>
              <input className="field" value={itemDraft.preferredStore ?? ""} onChange={(event) => setItemDraft({ ...itemDraft, preferredStore: event.target.value })} />
            </label>
            <label className="label">
              <span>Replacement link</span>
              <input className="field" inputMode="url" value={itemDraft.replacementUrl ?? ""} onChange={(event) => setItemDraft({ ...itemDraft, replacementUrl: event.target.value })} />
            </label>
          </div>
          <label className="label">
            <span>Photo</span>
            <input className="field" type="file" name="photo" accept="image/*" capture="environment" />
          </label>
          <label className="label">
            <span>Notes</span>
            <textarea className="textarea" value={itemDraft.notes ?? ""} onChange={(event) => setItemDraft({ ...itemDraft, notes: event.target.value })} />
          </label>
          <div className="inline-actions">
            <button className="button" type="submit">
              Save item
            </button>
            <button className="ghost-button" type="button" onClick={() => setShowItemForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  }

  function renderItemDetail(item: Item) {
    const purchases = state.purchaseRecords.filter((purchase) => purchase.itemId === item.id);
    const lastPurchase = getLastPurchase(item.id, purchases);
    const priceSummary = getPurchasePriceSummary(item.id, state.purchaseRecords);
    const linkedOrders = state.orderEntries.filter((entry) => entry.itemId === item.id && entry.status !== "Cancelled" && entry.status !== "Received");
    const itemCount = item.quantityNumber ? `${item.quantityNumber} ${item.unit ?? ""}`.trim() : "Not entered";
    const lastPurchaseText = lastPurchase
      ? `${lastPurchase.purchasedAt || "Date unknown"} from ${purchaseSource(lastPurchase)}${lastPurchase.totalPrice ? `, ${money(lastPurchase.totalPrice)}` : ""}`
      : "No purchase saved";
    return (
      <section className="detail-panel item-detail">
        <div className="item-detail-hero">
          <div className="item-photo-large">{item.photoUrl ? <CloudImage src={item.photoUrl} alt="" /> : <span>Item</span>}</div>
          <div className="item-hero-copy">
            <span className="item-eyebrow">{item.category}</span>
            <h2>{item.name}</h2>
            <p className="muted">{locationName(item.locationId)}</p>
            <div className="token-row">
              <span className={statusClass(item.quantityStatus)}>{item.quantityStatus}</span>
              <span className="badge">{item.condition}</span>
              {linkedOrders.length ? <span className="badge ready">{linkedOrders.length} active order{linkedOrders.length === 1 ? "" : "s"}</span> : null}
            </div>
          </div>
          <button className="icon-button" aria-label="Close details" onClick={closeItemDetail}>
            x
          </button>
        </div>

        <div className="item-detail-grid">
          <div>
            <span>Count</span>
            <strong>{itemCount}</strong>
          </div>
          <div>
            <span>Container</span>
            <strong>{containerName(item.containerId) || "None"}</strong>
          </div>
          <div>
            <span>Preferred store</span>
            <strong>{item.preferredStore || lastPurchase?.storeName || "Any"}</strong>
          </div>
          <div>
            <span>Last bought</span>
            <strong>{lastPurchaseText}</strong>
          </div>
          <div>
            <span>Brand</span>
            <strong>{item.brand || lastPurchase?.brand || "Unknown"}</strong>
          </div>
          <div>
            <span>Expiration</span>
            <strong>{item.expirationDate || "Not entered"}</strong>
          </div>
          <div>
            <span>Recorded purchases</span>
            <strong>{priceSummary.purchaseCount || "None"}</strong>
          </div>
          <div>
            <span>Lowest saved total</span>
            <strong>
              {priceSummary.lowestPrice === undefined
                ? "No price saved"
                : `${money(String(priceSummary.lowestPrice))}${priceSummary.lowestPurchase?.storeName ? ` at ${priceSummary.lowestPurchase.storeName}` : ""}`}
            </strong>
          </div>
        </div>

        {item.notes ? <p className="item-note">{item.notes}</p> : null}

        <div className="item-actions">
          <button className="button" onClick={() => openPurchaseForm(item)}>
            Add purchase
          </button>
          <button className="ghost-button" onClick={() => openOrderForm(item.name, item.id, lastPurchase)}>
            Reorder
          </button>
          {normalizeWebUrl(item.replacementUrl) ? (
            <a className="ghost-button link-button" href={normalizeWebUrl(item.replacementUrl)} target="_blank" rel="noreferrer">
              Product link
            </a>
          ) : null}
          <button className="ghost-button" onClick={() => openItemForm(item)}>
            Edit item
          </button>
          <button className="ghost-button" onClick={() => copyItemLink(item.id)}>
            Copy link
          </button>
          <button className="danger-button" onClick={() => deleteItem(item.id)}>
            Delete
          </button>
        </div>

        {showPurchaseForm && purchaseDraft.itemId === item.id ? renderPurchaseForm(item) : null}

        <div className="section-head" style={{ marginTop: 16 }}>
          <div>
            <h2>Purchase history</h2>
            <p className="muted">Receipts, links, and what to buy again. Lowest saved total compares {priceSummary.pricedPurchaseCount || "no"} recorded price{priceSummary.pricedPurchaseCount === 1 ? "" : "s"}; check package sizes before comparing.</p>
          </div>
        </div>
        <div className="grid">
          {purchases.map((purchase) => renderPurchaseCard(purchase))}
          {!purchases.length ? <div className="empty">No purchases saved yet.</div> : null}
        </div>
      </section>
    );
  }

  function renderPurchaseCard(purchase: PurchaseRecord) {
    const item = state.items.find((entry) => entry.id === purchase.itemId);
    const hasReceipt = Boolean(purchase.receiptUrl || purchase.receiptPhotoUrl);
    const purchaseCardClass =
      purchase.reorderRecommendation === "Reorder same"
        ? "purchase-card purchase-reorder"
        : purchase.reorderRecommendation === "Avoid" || purchase.purchasePreference === "Do not buy again"
          ? "purchase-card purchase-avoid"
          : "purchase-card purchase-compare";
    return (
      <article className={purchaseCardClass} key={purchase.id}>
        <div className="purchase-topline">
          <div>
            <span className="purchase-eyebrow">{purchase.purchasedAt || "Date unknown"}</span>
            <h3>{purchase.productName}</h3>
          </div>
          <span className="badge">{purchase.reorderRecommendation}</span>
        </div>

        <div className="purchase-facts">
          <div>
            <span>Vendor</span>
            <strong>{purchaseSource(purchase)}</strong>
          </div>
          <div>
            <span>Total</span>
            <strong>{purchase.totalPrice ? money(purchase.totalPrice) : "Unknown"}</strong>
          </div>
          <div>
            <span>Brand</span>
            <strong>{purchase.brand || "Unknown"}</strong>
          </div>
          <div>
            <span>Amount</span>
            <strong>{[purchase.quantityPurchased || "Any", purchase.unitSize].filter(Boolean).join(" / ")}</strong>
          </div>
          <div>
            <span>Receipt</span>
            <strong>{hasReceipt ? "Saved" : "Not saved"}</strong>
          </div>
          <div>
            <span>Preference</span>
            <strong>{purchase.purchasePreference}</strong>
          </div>
        </div>

        <div className="purchase-trail">
          {item ? (
            <span>
              Linked item: <strong>{item.name}</strong>
            </span>
          ) : null}
          {purchase.orderNumber ? (
            <span>
              Order: <strong>{purchase.orderNumber}</strong>
            </span>
          ) : null}
        </div>

        {purchase.notes ? <p className="purchase-note">{purchase.notes}</p> : null}
        <div className="purchase-actions">
          {normalizeWebUrl(purchase.productUrl) ? (
            <a className="small-button link-button" href={normalizeWebUrl(purchase.productUrl)} target="_blank" rel="noreferrer">
              Product link
            </a>
          ) : null}
          {normalizeWebUrl(purchase.receiptUrl) ? (
            <a className="small-button link-button" href={normalizeWebUrl(purchase.receiptUrl)} target="_blank" rel="noreferrer">
              Receipt link
            </a>
          ) : null}
          {purchase.receiptPhotoUrl ? (
            <CloudMediaLink className="small-button link-button" href={purchase.receiptPhotoUrl} target="_blank" rel="noreferrer">
              Receipt photo
            </CloudMediaLink>
          ) : null}
          {item ? (
            <button className="small-button" onClick={() => setItemDetail(item.id)}>
              Open item
            </button>
          ) : null}
          <button className="small-button" onClick={() => openOrderForm(item?.name ?? purchase.productName, purchase.itemId, purchase)}>
            Use for order
          </button>
          {item ? (
            <button className="small-button" onClick={() => openPurchaseForm(item, purchase)}>
              Edit
            </button>
          ) : null}
          <button className="danger-button" onClick={() => deletePurchase(purchase.id)}>
            Delete
          </button>
        </div>
      </article>
    );
  }

  function renderPurchaseForm(item: Item) {
    return (
      <form className="form-panel nested-form" onSubmit={savePurchase}>
        <h2>{purchaseDraft.id ? "Edit purchase" : "Add purchase"}</h2>
        <p className="muted">A manual receipt line is enough. Links and photos are optional.</p>
        <div className="form-grid">
          <label className="label">
            <span>Product name</span>
            <input className="field" required value={purchaseDraft.productName ?? ""} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, productName: event.target.value })} />
          </label>
          <div className="form-row">
            <label className="label">
              <span>Store or vendor</span>
              <input className="field" value={purchaseDraft.storeName ?? ""} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, storeName: event.target.value })} />
            </label>
            <label className="label">
              <span>Seller or marketplace</span>
              <input className="field" placeholder="Optional" value={purchaseDraft.sellerName ?? ""} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, sellerName: event.target.value })} />
            </label>
          </div>
          <div className="form-row">
            <label className="label">
              <span>Brand</span>
              <input className="field" value={purchaseDraft.brand ?? ""} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, brand: event.target.value })} />
            </label>
            <label className="label">
              <span>Date</span>
              <input className="field" type="date" value={purchaseDraft.purchasedAt ?? ""} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, purchasedAt: event.target.value })} />
            </label>
          </div>
          <label className="label">
            <span>Order number</span>
            <input className="field" value={purchaseDraft.orderNumber ?? ""} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, orderNumber: event.target.value })} />
          </label>
          <div className="form-row">
            <label className="label">
              <span>Quantity</span>
              <input className="field" inputMode="decimal" value={purchaseDraft.quantityPurchased ?? ""} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, quantityPurchased: event.target.value })} />
            </label>
            <label className="label">
              <span>Unit size</span>
              <input className="field" placeholder="12 rolls, 24 pack" value={purchaseDraft.unitSize ?? ""} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, unitSize: event.target.value })} />
            </label>
          </div>
          <div className="form-row">
            <label className="label">
              <span>Total price</span>
              <input className="field" inputMode="decimal" value={purchaseDraft.totalPrice ?? ""} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, totalPrice: event.target.value })} />
            </label>
            <label className="label">
              <span>Unit price</span>
              <input className="field" inputMode="decimal" value={purchaseDraft.unitPrice ?? ""} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, unitPrice: event.target.value })} />
            </label>
          </div>
          <label className="label">
            <span>Product link</span>
            <input className="field" inputMode="url" value={purchaseDraft.productUrl ?? ""} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, productUrl: event.target.value })} />
          </label>
          <label className="label">
            <span>Digital receipt link</span>
            <input className="field" inputMode="url" value={purchaseDraft.receiptUrl ?? ""} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, receiptUrl: event.target.value })} />
          </label>
          <label className="label">
            <span>Receipt or order screenshot</span>
            <input className="field" type="file" name="receiptPhoto" accept="image/*" capture="environment" />
          </label>
          {purchaseDraft.receiptPhotoUrl ? (
            <p className="meta">Receipt photo already saved. Choose a new photo only if replacing it.</p>
          ) : null}
          <div className="form-row">
            <label className="label">
              <span>Preference</span>
              <select className="field" value={purchaseDraft.purchasePreference ?? "Unknown"} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, purchasePreference: event.target.value as PurchasePreference })}>
                {purchasePreferences.map((preference) => (
                  <option key={preference}>{preference}</option>
                ))}
              </select>
            </label>
            <label className="label">
              <span>Reorder</span>
              <select className="field" value={purchaseDraft.reorderRecommendation ?? "Compare first"} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, reorderRecommendation: event.target.value as ReorderRecommendation })}>
                {reorderRecommendations.map((recommendation) => (
                  <option key={recommendation}>{recommendation}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="label">
            <span>Notes</span>
            <textarea className="textarea" value={purchaseDraft.notes ?? ""} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, notes: event.target.value })} />
          </label>
          <input type="hidden" value={item.id} readOnly />
          <div className="inline-actions">
            <button className="button" type="submit">
              Save purchase
            </button>
            <button className="ghost-button" type="button" onClick={() => setShowPurchaseForm(false)}>
              Cancel
            </button>
            {purchaseDraft.id ? (
              <button className="danger-button" type="button" onClick={() => deletePurchase(purchaseDraft.id as string)}>
                Delete purchase
              </button>
            ) : null}
          </div>
        </div>
      </form>
    );
  }

  function buildTextReport() {
    const lines: string[] = [];
    const neededOrders = state.orderEntries.filter((entry) => entry.status === "Needed");
    const activeOrderEntries = state.orderEntries.filter((entry) => entry.status === "Ordered" || entry.status === "Purchased");
    const addSection = (title: string, entries: string[]) => {
      lines.push("", title, "-".repeat(title.length));
      lines.push(...(entries.length ? entries : ["None right now."]));
    };
    const taskLine = (task: CommandTask) =>
      [
        task.title,
        task.dueDate ? `due ${task.dueDate}` : "",
        task.starCount ? `${task.starCount} star${task.starCount === 1 ? "" : "s"}` : "",
        task.status,
        task.effort,
        task.notes ? `notes: ${task.notes}` : ""
      ].filter(Boolean).join(" | ");
    const orderLine = (entry: OrderEntry) =>
      [
        entry.name,
        entry.status,
        entry.urgency,
        entry.quantity ?? "",
        entry.preferredBrand ? `brand: ${entry.preferredBrand}` : "",
        entry.preferredStore ?? "",
        entry.estimatedPrice ? `est. ${money(entry.estimatedPrice)}` : "",
        entry.expectedDeliveryDate ? `expected ${entry.expectedDeliveryDate}` : "",
        entry.orderNumber ? `order ${entry.orderNumber}` : "",
        entry.notes ? `notes: ${entry.notes}` : ""
      ].filter(Boolean).join(" | ");

    lines.push("Mom Home Report");
    lines.push(`Generated ${new Date().toLocaleString()}`);
    lines.push(`Household: ${state.household.name}`);
    lines.push("");
    lines.push(`Open tasks: ${activeTasks.length}`);
    lines.push(`Due today: ${dueTodayTasks.length}`);
    lines.push(`Low or out items: ${lowItems.length}`);
    lines.push(`Need ordering: ${neededOrders.length}`);
    lines.push(`Supplements: ${state.supplementItems.length}`);
    lines.push(`Saved purchases: ${state.purchaseRecords.length}`);

    addSection("Starred Tasks", starredTasks.map(taskLine));
    addSection("Today", dueTodayTasks.map(taskLine));
    addSection(
      "Calendar - Next 60 Days",
      upcomingCalendarItems.map((item) => [item.dateIso, item.time, item.kind, item.title].filter(Boolean).join(" | "))
    );
    addSection(
      "Low Stock",
      lowItems.map((item) =>
        [
          item.name,
          item.quantityStatus,
          item.quantityNumber ? `${item.quantityNumber} ${item.unit ?? ""}`.trim() : "",
          locationName(item.locationId),
          item.notes ? `notes: ${item.notes}` : ""
        ].filter(Boolean).join(" | ")
      )
    );
    addSection(
      "To Order",
      neededOrders.map(orderLine)
    );
    addSection(
      "Ordered Or Purchased",
      activeOrderEntries.map(orderLine)
    );
    addSection(
      "Supplements",
      state.supplementItems.map((supplement) =>
        [
          supplement.name,
          supplement.brand ?? "",
          `${supplement.pillsRemaining || "?"} left`,
          supplement.reorderThreshold ? `reorder at ${supplement.reorderThreshold}` : "",
          supplement.doseInstructions ?? "",
          supplement.notes ? `notes: ${supplement.notes}` : ""
        ].filter(Boolean).join(" | ")
      )
    );
    addSection(
      "Recent Purchases",
      state.purchaseRecords.slice(0, 10).map((purchase) =>
        [
          purchase.productName,
          purchaseSource(purchase),
          purchase.brand ?? "",
          purchase.purchasedAt ?? "",
          purchase.orderNumber ? `order: ${purchase.orderNumber}` : "",
          purchase.totalPrice ? money(purchase.totalPrice) : "",
          purchase.notes ? `notes: ${purchase.notes}` : ""
        ].filter(Boolean).join(" | ")
      )
    );

    return lines.join("\n").trim() + "\n";
  }

  function renderSupplementReportView() {
    const generatedAt = new Date().toLocaleString();
    const reportLogs = [...state.supplementLogs].sort((a, b) => b.takenAt.localeCompare(a.takenAt)).slice(0, 20);
    return (
      <section className="report-view">
        <div className="report-actions no-print">
          <button className="ghost-button" onClick={() => setView("supplements")}>Back to supplements</button>
          <button className="button" onClick={() => window.print()}>Print</button>
          <button className="button secondary" onClick={() => downloadSupplementsPdf(state.supplementItems, state.supplementLogs, state.household.name)}>Download PDF</button>
          <button className="ghost-button" onClick={() => downloadText("mom-supplements.csv", supplementsToCsv(state.supplementItems, state.supplementLogs), "text/csv")}>Export CSV</button>
        </div>

        <article className="report-page">
          <header className="report-header">
            <div>
              <h2>Supplement Report</h2>
              <p className="muted">Generated {generatedAt}</p>
            </div>
            <p className="report-household">{state.household.name}</p>
          </header>

          <p className="muted">Bottle inventory and taken history. Not medical advice.</p>

          <div className="report-summary">
            <div className="report-stat"><strong>{supplementCounts.tracked}</strong><span>Tracked bottles</span></div>
            <div className="report-stat"><strong>{supplementCounts.low}</strong><span>Low bottles</span></div>
            <div className="report-stat"><strong>{supplementCounts.logs}</strong><span>Taken logs</span></div>
          </div>

          <section className="report-section">
            <h3>Bottle inventory</h3>
            <ul>
              {state.supplementItems.length ? state.supplementItems.map((supplement) => {
                const logs = state.supplementLogs.filter((log) => log.supplementItemId === supplement.id).sort((a, b) => b.takenAt.localeCompare(a.takenAt));
                return (
                  <li key={supplement.id}>
                    <strong>{supplement.name}</strong>
                    <div className="report-meta">
                      {supplement.brand ? <span>{supplement.brand}</span> : null}
                      <span>{supplement.pillsRemaining || "Not counted"} left</span>
                      {supplement.pillsPerBottle ? <span>{supplement.pillsPerBottle} per bottle</span> : null}
                      {supplement.reorderThreshold ? <span>Reorder at {supplement.reorderThreshold}</span> : null}
                      <span>Last taken {logs[0]?.takenAt.replace("T", " ") || "not logged"}</span>
                      {supplement.preferredStore ? <span>{supplement.preferredStore}</span> : null}
                    </div>
                    {supplement.doseInstructions ? <p><strong>Bottle directions:</strong> {supplement.doseInstructions}</p> : null}
                    {supplement.notes ? <p>{supplement.notes}</p> : null}
                  </li>
                );
              }) : <li className="report-empty">No supplements have been added.</li>}
            </ul>
          </section>

          <section className="report-section">
            <h3>Recent taken history</h3>
            <ul>
              {reportLogs.length ? reportLogs.map((log) => (
                <li key={log.id}>
                  <strong>{state.supplementItems.find((supplement) => supplement.id === log.supplementItemId)?.name ?? "Deleted supplement"}</strong>
                  <div className="report-meta"><span>{log.amountTaken || "1"} taken</span><span>{log.takenAt.replace("T", " ")}</span></div>
                  {log.notes ? <p>{log.notes}</p> : null}
                </li>
              )) : <li className="report-empty">No taken history has been logged.</li>}
            </ul>
          </section>
        </article>
      </section>
    );
  }

  function renderReportView() {
    if (reportScope === "supplements") return renderSupplementReportView();
    const generatedAt = new Date().toLocaleString();
    const neededOrders = state.orderEntries.filter((entry) => entry.status === "Needed");
    const activeOrderEntries = state.orderEntries.filter((entry) => entry.status === "Ordered" || entry.status === "Purchased");

    return (
      <section className="report-view">
        <div className="report-actions no-print">
          <button className="ghost-button" onClick={() => setView("more")}>
            Back
          </button>
          <button className="button" onClick={() => window.print()}>
            Print / Save PDF
          </button>
          <button className="button secondary" onClick={() => downloadText("mom-home-report.txt", buildTextReport(), "text/plain")}>
            Download text
          </button>
        </div>

        <article className="report-page">
          <header className="report-header">
            <div>
              <h2>Mom Home Report</h2>
              <p className="muted">Generated {generatedAt}</p>
            </div>
            <p className="report-household">{state.household.name}</p>
          </header>

          <div className="report-summary">
            <div className="report-stat">
              <strong>{activeTasks.length}</strong>
              <span>Open tasks</span>
            </div>
            <div className="report-stat">
              <strong>{dueTodayTasks.length}</strong>
              <span>Due today</span>
            </div>
            <div className="report-stat">
              <strong>{lowItems.length}</strong>
              <span>Low or out items</span>
            </div>
            <div className="report-stat">
              <strong>{neededOrders.length}</strong>
              <span>Need ordering</span>
            </div>
            <div className="report-stat">
              <strong>{state.supplementItems.length}</strong>
              <span>Supplements</span>
            </div>
            <div className="report-stat">
              <strong>{state.purchaseRecords.length}</strong>
              <span>Saved purchases</span>
            </div>
          </div>

          <section className="report-section">
            <h3>Starred Tasks</h3>
            <ul>
              {starredTasks.length ? (
                starredTasks.map((task) => (
                  <li key={task.id}>
                    <strong>{task.title}</strong>
                    <div className="report-meta">
                      {task.dueDate ? <span>Due {task.dueDate}</span> : null}
                      {task.starCount ? <span>{task.starCount} star{task.starCount === 1 ? "" : "s"}</span> : null}
                      <span>{task.status}</span>
                      <span>{task.effort}</span>
                    </div>
                    {task.notes ? <p>{task.notes}</p> : null}
                  </li>
                ))
              ) : (
                <li className="report-empty">None right now.</li>
              )}
            </ul>
          </section>

          <section className="report-section">
            <h3>Today</h3>
            <ul>
              {dueTodayTasks.length ? (
                dueTodayTasks.map((task) => (
                  <li key={task.id}>
                    <strong>{task.title}</strong>
                    <div className="report-meta">
                      {task.dueDate ? <span>Due {task.dueDate}</span> : null}
                      {task.starCount ? <span>{task.starCount} star{task.starCount === 1 ? "" : "s"}</span> : null}
                      <span>{task.status}</span>
                      <span>{task.effort}</span>
                    </div>
                    {task.notes ? <p>{task.notes}</p> : null}
                  </li>
                ))
              ) : (
                <li className="report-empty">None right now.</li>
              )}
            </ul>
          </section>

          <section className="report-section">
            <h3>Calendar - Next 60 Days</h3>
            <ul>
              {upcomingCalendarItems.length ? upcomingCalendarItems.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <div className="report-meta">
                    <span>{item.dateIso}</span>
                    {item.time ? <span>{item.time}</span> : null}
                    <span>{item.kind}</span>
                  </div>
                </li>
              )) : <li className="report-empty">None right now.</li>}
            </ul>
          </section>

          <section className="report-section">
            <h3>Low Stock</h3>
            <ul>
              {lowItems.length
                ? lowItems.map((item) => (
                    <li key={item.id}>
                      <strong>{item.name}</strong>
                      <div className="report-meta">
                        <span>{item.quantityStatus}</span>
                        {item.quantityNumber ? <span>{item.quantityNumber} {item.unit}</span> : null}
                        <span>{locationName(item.locationId)}</span>
                      </div>
                      {item.notes ? <p>{item.notes}</p> : null}
                    </li>
                  ))
                : <li className="report-empty">None right now.</li>}
            </ul>
          </section>

          <section className="report-section">
            <h3>To Order</h3>
            <ul>
              {neededOrders.length
                ? neededOrders.map((entry) => (
                    <li key={entry.id}>
                      <strong>{entry.name}</strong>
                      <div className="report-meta">
                        <span>{entry.status}</span>
                        <span>{entry.urgency}</span>
                        {entry.quantity ? <span>{entry.quantity}</span> : null}
                        {entry.preferredBrand ? <span>{entry.preferredBrand}</span> : null}
                        {entry.preferredStore ? <span>{entry.preferredStore}</span> : null}
                        {entry.estimatedPrice ? <span>Est. {money(entry.estimatedPrice)}</span> : null}
                      </div>
                      {entry.notes ? <p>{entry.notes}</p> : null}
                    </li>
                  ))
                : <li className="report-empty">None right now.</li>}
            </ul>
          </section>

          <section className="report-section">
            <h3>Ordered Or Purchased</h3>
            <ul>
              {activeOrderEntries.length
                ? activeOrderEntries.map((entry) => (
                    <li key={entry.id}>
                      <strong>{entry.name}</strong>
                      <div className="report-meta">
                        <span>{entry.status}</span>
                        <span>{entry.urgency}</span>
                        {entry.quantity ? <span>{entry.quantity}</span> : null}
                        {entry.preferredBrand ? <span>{entry.preferredBrand}</span> : null}
                        {entry.preferredStore ? <span>{entry.preferredStore}</span> : null}
                        {entry.estimatedPrice ? <span>Est. {money(entry.estimatedPrice)}</span> : null}
                      </div>
                      {entry.notes ? <p>{entry.notes}</p> : null}
                    </li>
                  ))
                : <li className="report-empty">None right now.</li>}
            </ul>
          </section>

          <section className="report-section">
            <h3>Supplements</h3>
            <ul>
              {state.supplementItems.length
                ? state.supplementItems.map((supplement) => (
                    <li key={supplement.id}>
                      <strong>{supplement.name}</strong>
                      <div className="report-meta">
                        {supplement.brand ? <span>{supplement.brand}</span> : null}
                        <span>{supplement.pillsRemaining || "?"} left</span>
                        {supplement.reorderThreshold ? <span>Reorder at {supplement.reorderThreshold}</span> : null}
                      </div>
                      {supplement.doseInstructions ? <p>{supplement.doseInstructions}</p> : null}
                      {supplement.notes ? <p>{supplement.notes}</p> : null}
                    </li>
                  ))
                : <li className="report-empty">None right now.</li>}
            </ul>
          </section>

          <section className="report-section">
            <h3>Recent Purchases</h3>
            <ul>
              {state.purchaseRecords.length
                ? state.purchaseRecords.slice(0, 10).map((purchase) => (
                    <li key={purchase.id}>
                      <strong>{purchase.productName}</strong>
                      <div className="report-meta">
                        <span>{purchaseSource(purchase)}</span>
                        {purchase.brand ? <span>{purchase.brand}</span> : null}
                        {purchase.purchasedAt ? <span>{purchase.purchasedAt}</span> : null}
                        {purchase.orderNumber ? <span>Order {purchase.orderNumber}</span> : null}
                        {purchase.totalPrice ? <span>{money(purchase.totalPrice)}</span> : null}
                      </div>
                      {purchase.notes ? <p>{purchase.notes}</p> : null}
                    </li>
                  ))
                : <li className="report-empty">None right now.</li>}
            </ul>
          </section>
        </article>
      </section>
    );
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="brand-row">
          <div>
            <h1 className="brand-title">Mom Home</h1>
            <p className="brand-subtitle">{state.household.name}</p>
          </div>
          <button className="icon-button" aria-label="Add item" onClick={() => openItemForm()}>
            +
          </button>
        </div>
        <div className="search-wrap">
          <input className="search-input" type="search" placeholder="Search tasks, items, supplements, purchases..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </header>

      {view === "home" ? (
        <section className="today-page">
          <div className="today-page-head">
            <div>
              <span className="today-date">{format(parseISO(todayIso), "EEEE, MMMM d")}</span>
              <h2>Today</h2>
            </div>
            <div className="today-quick-tools">
              <button className="small-button" onClick={() => openTaskForm()}>Add task</button>
              <button className="small-button" onClick={() => openCalendarForm()}>Add event</button>
              <button className="small-button" onClick={() => openOrderForm()}>Add order</button>
              <button className="small-button" onClick={() => setShowEnergyForm(true)}>Log energy</button>
            </div>
          </div>

          <TodayLenses
            lens={resolvedTodayLens}
            focus={todayFocus}
            signals={focusedTodaySignals}
            selectedKind={activeTodayKind}
            briefTitle={todayBrief.title}
            briefText={todayBrief.text}
            stats={todayStats}
            onLensChange={changeTodayLens}
            onFocusChange={changeTodayFocus}
            onKindChange={setActiveTodayKind}
            onOpenSignal={openTodaySignal}
          />

          <FocusSeason
            value={state.focusSeason}
            tasks={state.tasks}
            onChange={(focusSeason) => setState((current) => ({ ...current, focusSeason }))}
            onOpenTask={openTaskForm}
          />

          {showEnergyForm ? renderEnergyForm() : null}

          <div className="today-footer-actions">
            <button onClick={() => { setTaskScope("quick"); setView("tasks"); }}>Quick wins <strong>{quickWinTasks.length}</strong></button>
            <button onClick={() => setView("calendar")}>Calendar <strong>{dueTodayTasks.length + state.calendarEntries.filter((entry) => calendarEntryOccursOnDate(entry, todayIso)).length}</strong></button>
            <button onClick={() => setView("low")}>Low stock <strong>{lowItems.length}</strong></button>
            <button onClick={() => setView("purchases")}>Purchases <strong>{state.purchaseRecords.length}</strong></button>
          </div>
        </section>
      ) : null}

      {view === "tasks" ? (
        <section>
          <div className="section-head">
            <div>
              <h2>Tasks</h2>
              <p className="muted">Things to do, what matters most, and what has to happen first.</p>
            </div>
            <button className="button" onClick={() => openTaskForm()}>
              Add
            </button>
          </div>

          {showTaskForm ? renderTaskForm() : null}

          <div className="filters">
            {[
              ["open", "Open"],
              ["next", "Next up"],
              ["today", "Today"],
              ["starred", "Starred"],
              ["quick", "Quick wins"],
              ["help", "Help"],
              ["all", "All"]
            ].map(([scope, label]) => (
              <button className={`filter-chip ${taskScope === scope ? "active" : ""}`} key={scope} onClick={() => setTaskScope(scope as typeof taskScope)}>
                {label}
              </button>
            ))}
          </div>

          <div className="grid card-list">
            {scopedTasks.map(renderTaskCard)}
            {!scopedTasks.length ? <div className="empty">{taskEmptyMessage()}</div> : null}
          </div>

          <div className="panel" style={{ marginTop: 12 }}>
            <div className="section-head">
              <div>
                <h2>Project map</h2>
                <p className="muted">Start with ready tasks. Waiting tasks name the prerequisite that needs attention.</p>
              </div>
              <div className="inline-actions">
                {finishedTaskCount ? (
                  <button className="ghost-button" type="button" onClick={() => setShowCompletedProjectTasks((current) => !current)}>
                    {showCompletedProjectTasks ? "Hide finished" : `Show finished (${finishedTaskCount})`}
                  </button>
                ) : null}
                <button className="button" onClick={() => { setProjectDraft(blankTaskProject()); setShowProjectForm(true); }}>
                  Add project
                </button>
              </div>
            </div>
            {showProjectForm ? renderProjectForm() : null}
            {renderProjectMap()}
          </div>

          <div className="panel" style={{ marginTop: 12 }}>
            <div className="section-head">
              <div>
                <h2>Custom flags and tags</h2>
                <p className="muted">No meanings are preset. Mom defines them.</p>
              </div>
            </div>
            <div className="quick-actions">
              <button className="button" onClick={() => { setFlagDraft(blankTaskFlag()); setShowFlagForm(true); }}>
                Add flag
              </button>
              <button className="button secondary" onClick={() => { setTagDraft(blankTaskTag()); setShowTagForm(true); }}>
                Add tag
              </button>
            </div>
            {showFlagForm ? renderFlagForm() : null}
            {showTagForm ? renderTagForm() : null}
            <div className="grid" style={{ marginTop: 12 }}>
              {state.taskFlags.map((flag) => (
                <article className="mini-card" key={flag.id}>
                  <div className="card-row">
                    <span className="flag-token" style={{ borderColor: flag.color }}>
                      <span className="flag-dot" style={{ background: flag.color }} />
                      {flag.symbol ? `${flag.symbol} ` : ""}
                      {flag.name}
                    </span>
                    <button className="small-button" onClick={() => { setFlagDraft({ ...flag }); setShowFlagForm(true); }}>
                      Edit
                    </button>
                    <button className="danger-button" onClick={() => deleteTaskFlag(flag.id)}>
                      Delete
                    </button>
                  </div>
                  {flag.meaning ? <p className="meta">{flag.meaning}</p> : null}
                </article>
              ))}
              {state.taskTags.map((tag) => (
                <article className="mini-card" key={tag.id}>
                  <div className="card-row">
                    <span className="tag-token" style={tag.color ? { borderColor: tag.color } : undefined}>
                      #{tag.name}
                    </span>
                    <button className="small-button" onClick={() => { setTagDraft({ ...tag }); setShowTagForm(true); }}>
                      Edit
                    </button>
                    <button className="danger-button" onClick={() => deleteTaskTag(tag.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
              {!state.taskFlags.length && !state.taskTags.length ? <div className="empty">No custom flags or tags yet.</div> : null}
            </div>
          </div>
        </section>
      ) : null}

      {view === "calendar" ? (
        <section className="calendar-view">
          <div className="section-head calendar-page-head">
            <div>
              <h2>Calendar</h2>
              <p className="muted">Events and dated tasks in one place.</p>
            </div>
            <div className="inline-actions">
              <button className="button" onClick={() => openCalendarForm()}>Add event</button>
              <button className="ghost-button" onClick={() => openTaskForm()}>Add task</button>
            </div>
          </div>

          <div className={`calendar-alert-status permission-${notificationPermission}`}>
            <div>
              <strong>{notificationPermission === "granted" ? "Device alerts enabled" : notificationPermission === "denied" ? "Device alerts blocked" : notificationPermission === "unsupported" ? "Device alerts unavailable" : "Device alerts off"}</strong>
              <span>{notificationPermission === "granted" ? "Reminders and nag mode run while Mom Home is open." : "Calendar entries still appear normally."}</span>
            </div>
            {notificationPermission === "default" ? <button className="small-button" onClick={requestNotificationPermission}>Enable alerts</button> : null}
          </div>

          {showCalendarForm ? renderCalendarForm() : null}

          <div className="calendar-layout">
            <div className="panel calendar-panel">
              <div className="calendar-toolbar">
                <button className="small-button" aria-label="Previous month" title="Previous month" onClick={() => moveCalendarMonth(-1)}>Previous</button>
                <h2>{format(parseISO(calendarMonth), "MMMM yyyy")}</h2>
                <div className="calendar-toolbar-actions">
                  <button className="small-button" onClick={() => { setCalendarMonth(`${todayIso.slice(0, 7)}-01`); setSelectedCalendarDate(todayIso); }}>Today</button>
                  <button className="small-button" aria-label="Next month" title="Next month" onClick={() => moveCalendarMonth(1)}>Next</button>
                </div>
              </div>
              <div className="calendar-weekdays" aria-hidden="true">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className="calendar-grid" role="grid" aria-label={format(parseISO(calendarMonth), "MMMM yyyy")}>
                {monthCalendarDays.map((day) => {
                  const events = state.calendarEntries.filter((entry) => calendarEntryOccursOnDate(entry, day.dateIso));
                  const tasks = activeTasks.filter((task) => task.dueDate === day.dateIso);
                  return (
                    <button
                      className={`calendar-day ${day.inMonth ? "" : "outside"} ${day.dateIso === todayIso ? "today" : ""} ${day.dateIso === selectedCalendarDate ? "selected" : ""}`}
                      key={day.dateIso}
                      role="gridcell"
                      aria-label={`${format(parseISO(day.dateIso), "MMMM d, yyyy")}. ${events.length} events. ${tasks.length} tasks.`}
                      onClick={() => selectCalendarDay(day.dateIso)}
                    >
                      <span className="calendar-day-number">{day.dayNumber}</span>
                      <span className="calendar-day-markers">
                        {events.slice(0, 3).map((entry) => <i key={entry.id} style={{ background: entry.color }} />)}
                        {tasks.length ? <i className="task-marker" /> : null}
                      </span>
                      {events.length + tasks.length ? <span className="calendar-day-count">{events.length + tasks.length}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="panel calendar-day-panel">
              <div className="section-head">
                <div>
                  <span className="calendar-panel-eyebrow">Selected day</span>
                  <h2>{format(parseISO(selectedCalendarDate), "EEEE, MMMM d")}</h2>
                </div>
                <button className="small-button" onClick={() => openCalendarForm()}>Add</button>
              </div>
              <div className="calendar-day-agenda">
                {selectedCalendarEntries.map((entry) => renderCalendarEntryCard(entry))}
                {selectedCalendarTasks.map((task) => (
                  <article className="calendar-task-row" key={task.id}>
                    <div>
                      <span>Task</span>
                      <strong>{task.title}</strong>
                      {task.reminderAt ? <small>Reminder {task.reminderAt.replace("T", " ")}</small> : null}
                    </div>
                    <button className="small-button" onClick={() => openTaskForm(task)}>Open</button>
                  </article>
                ))}
                {!selectedCalendarEntries.length && !selectedCalendarTasks.length ? <div className="calendar-empty-day">Nothing scheduled. The day is open.</div> : null}
              </div>
            </div>
          </div>

          <div className="panel calendar-upcoming">
            <div className="section-head">
              <div>
                <h2>Coming up</h2>
                <p className="muted">The next twelve events and dated tasks.</p>
              </div>
            </div>
            <div className="calendar-upcoming-list">
              {upcomingCalendarItems.map((item) => (
                <button className="calendar-upcoming-row" key={item.id} onClick={() => selectCalendarDay(item.dateIso)}>
                  <span className="calendar-upcoming-date"><strong>{format(parseISO(item.dateIso), "MMM d")}</strong><small>{format(parseISO(item.dateIso), "EEE")}</small></span>
                  <i style={{ background: item.color }} />
                  <span className="calendar-upcoming-copy"><strong>{item.title}</strong><small>{[item.kind, item.time].filter(Boolean).join(" | ")}</small></span>
                </button>
              ))}
              {!upcomingCalendarItems.length ? <div className="empty">Nothing dated in the next sixty days.</div> : null}
            </div>
          </div>
        </section>
      ) : null}

      {view === "items" ? (
        <section>
          <div className="section-head">
            <div>
              <h2>Inventory</h2>
              <p className="muted">Searchable household items.</p>
            </div>
            <button className="button" onClick={() => openItemForm()}>
              Add
            </button>
          </div>

          {showItemForm ? renderItemForm() : null}
          {selectedItem ? renderItemDetail(selectedItem) : null}

          <div className="filters">
            {["All", "Low", "Out", "Too much"].map((filter) => (
              <button className="filter-chip" key={filter} onClick={() => setSearch(filter === "All" ? "" : filter)}>
                {filter}
              </button>
            ))}
          </div>
          <div className="grid card-list">
            {filteredItems.map(renderItemCard)}
            {!filteredItems.length ? <div className="empty">No matching items yet.</div> : null}
          </div>
        </section>
      ) : null}

      {view === "low" ? (
        <section>
          <div className="section-head">
            <div>
              <h2>Low stock</h2>
              <p className="muted">What needs attention before the next shopping run.</p>
            </div>
            <button className="ghost-button" onClick={() => setView("more")}>
              Back
            </button>
          </div>

          <div className="low-stock-dashboard">
            <div className="low-stock-stat urgent">
              <strong>{outItems.length}</strong>
              <span>Out now</span>
            </div>
            <div className="low-stock-stat">
              <strong>{runningLowItems.length}</strong>
              <span>Running low</span>
            </div>
            <div className="low-stock-stat">
              <strong>{lowItems.length}</strong>
              <span>Total attention</span>
            </div>
            <div className="low-stock-stat muted-stat">
              <strong>{overstockItems.length}</strong>
              <span>Do not buy yet</span>
            </div>
          </div>

          {outItems.length ? (
            <div className="attention-section">
              <div className="section-head">
                <div>
                  <h2>Out now</h2>
                  <p className="muted">Buy or order these first.</p>
                </div>
              </div>
              <div className="grid card-list">{outItems.map(renderLowStockCard)}</div>
            </div>
          ) : null}

          {runningLowItems.length ? (
            <div className="attention-section">
              <div className="section-head">
                <div>
                  <h2>Running low</h2>
                  <p className="muted">Still usable, but worth planning.</p>
                </div>
              </div>
              <div className="grid card-list">{runningLowItems.map(renderLowStockCard)}</div>
            </div>
          ) : null}

          {!lowItems.length ? <div className="empty">No low-stock items.</div> : null}

          {overstockItems.length ? (
            <div className="attention-section">
              <div className="section-head">
                <div>
                  <h2>Do not buy yet</h2>
                  <p className="muted">Marked as too much.</p>
                </div>
              </div>
              <div className="grid card-list">{overstockItems.map(renderLowStockCard)}</div>
            </div>
          ) : null}
        </section>
      ) : null}

      {view === "places" ? (
        <section>
          <div className="section-head">
            <div>
              <h2>Places and bins</h2>
              <p className="muted">Rooms, shelves, closets, and storage containers.</p>
            </div>
            <button className="ghost-button" onClick={() => setView("more")}>
              Back
            </button>
          </div>
          <div className="quick-actions" style={{ marginBottom: 12 }}>
            <button className="button" onClick={() => setShowLocationForm(true)}>
              Add place
            </button>
            <button className="button secondary" onClick={() => setShowContainerForm(true)}>
              Add bin
            </button>
          </div>

          <div className="places-dashboard">
            <div className="places-stat">
              <strong>{state.locations.length}</strong>
              <span>Places</span>
            </div>
            <div className="places-stat">
              <strong>{state.containers.length}</strong>
              <span>Bins</span>
            </div>
            <div className="places-stat">
              <strong>{state.items.filter((item) => item.containerId).length}</strong>
              <span>Items in bins</span>
            </div>
            <div className="places-stat">
              <strong>{state.containers.filter((container) => !state.items.some((item) => item.containerId === container.id)).length}</strong>
              <span>Empty bins</span>
            </div>
          </div>

          {showLocationForm ? (
            <form className="form-panel" onSubmit={saveLocation}>
              <h2>Add location</h2>
              <div className="form-grid">
                <label className="label">
                  <span>Name</span>
                  <input className="field" required value={locationDraft.name ?? ""} onChange={(event) => setLocationDraft({ ...locationDraft, name: event.target.value })} />
                </label>
                <div className="form-row">
                  <label className="label">
                    <span>Type</span>
                    <select className="field" value={locationDraft.type ?? "Room"} onChange={(event) => setLocationDraft({ ...locationDraft, type: event.target.value as LocationType })}>
                      {locationTypes.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                  <label className="label">
                    <span>Inside</span>
                    <select className="field" value={locationDraft.parentLocationId ?? ""} onChange={(event) => setLocationDraft({ ...locationDraft, parentLocationId: event.target.value })}>
                      <option value="">Top level</option>
                      {state.locations.map((location) => (
                        <option value={location.id} key={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="label">
                  <span>Notes</span>
                  <textarea className="textarea" value={locationDraft.notes ?? ""} onChange={(event) => setLocationDraft({ ...locationDraft, notes: event.target.value })} />
                </label>
                <div className="inline-actions">
                  <button className="button" type="submit">
                    Save place
                  </button>
                  <button className="ghost-button" type="button" onClick={() => setShowLocationForm(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          ) : null}

          {showContainerForm ? (
            <form className="form-panel" onSubmit={saveContainer}>
              <h2>Add storage bin</h2>
              <div className="form-grid">
                <label className="label">
                  <span>Container name</span>
                  <input className="field" required value={containerDraft.name ?? ""} onChange={(event) => setContainerDraft({ ...containerDraft, name: event.target.value })} />
                </label>
                <div className="form-row">
                  <label className="label">
                    <span>Code</span>
                    <input className="field" required placeholder="B-04" value={containerDraft.containerCode ?? ""} onChange={(event) => setContainerDraft({ ...containerDraft, containerCode: event.target.value })} />
                  </label>
                  <label className="label">
                    <span>Category</span>
                    <select className="field" value={containerDraft.category ?? "Miscellaneous"} onChange={(event) => setContainerDraft({ ...containerDraft, category: event.target.value })}>
                      {categories.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="label">
                  <span>Location</span>
                  <select className="field" required value={containerDraft.locationId ?? ""} onChange={(event) => setContainerDraft({ ...containerDraft, locationId: event.target.value })}>
                    {state.locations.map((location) => (
                      <option value={location.id} key={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="label">
                  <span>Outside photo</span>
                  <input className="field" type="file" name="outsidePhoto" accept="image/*" capture="environment" />
                </label>
                <label className="label">
                  <span>Inside photo</span>
                  <input className="field" type="file" name="insidePhoto" accept="image/*" capture="environment" />
                </label>
                <label className="label">
                  <span>Contents and notes</span>
                  <textarea className="textarea" value={containerDraft.notes ?? ""} onChange={(event) => setContainerDraft({ ...containerDraft, notes: event.target.value })} />
                </label>
                <div className="inline-actions">
                  <button className="button" type="submit">
                    Save bin
                  </button>
                  <button className="ghost-button" type="button" onClick={() => setShowContainerForm(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          ) : null}

          <div className="location-tree">
            {state.locations.map((location) => {
              const children = state.locations.filter((entry) => entry.parentLocationId === location.id);
              const locationItems = state.items.filter((item) => item.locationId === location.id);
              const locationContainers = state.containers.filter((container) => container.locationId === location.id);
              return (
                <article className="location-card" key={location.id}>
                  <div className="place-topline">
                    <div>
                      <span className="place-eyebrow">{location.type}</span>
                      <h3>{location.name}</h3>
                    </div>
                    <span className="badge">{locationItems.length} items</span>
                  </div>
                  {location.parentLocationId ? <p className="meta">Inside {locationName(location.parentLocationId)}</p> : null}
                  {location.notes ? <p className="meta">{location.notes}</p> : null}
                  <div className="place-facts">
                    <div>
                      <span>Bins</span>
                      <strong>{locationContainers.length}</strong>
                    </div>
                    <div>
                      <span>Child places</span>
                      <strong>{children.length}</strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="panel" style={{ marginTop: 12 }}>
            <div className="section-head">
              <div>
                <h2>Storage containers</h2>
                <p className="muted">Print or save the QR image for labels.</p>
              </div>
            </div>
            <div className="grid">
              {state.containers.map((container) => {
                const contents = state.items.filter((item) => item.containerId === container.id);
                const isActive = activeContainerCode && activeContainerCode === container.containerCode;
                return (
                  <article className={`container-card bin-card ${isActive ? "active-bin" : ""}`} key={container.id}>
                    <div className="bin-topline">
                      <div>
                        <span className="place-eyebrow">Code {container.containerCode}</span>
                        <h3>{container.name}</h3>
                        <p className="meta">
                          {container.category} | {locationName(container.locationId)}
                        </p>
                      </div>
                      {isActive ? <span className="badge ready">Scanned</span> : <span className="badge">{contents.length} items</span>}
                    </div>
                    {container.notes ? <p className="bin-note">{container.notes}</p> : null}
                    <div className="bin-contents">
                      <h4>What is in here</h4>
                      {contents.length ? (
                        <div className="bin-item-list">
                          {contents.map((item) => (
                            <button className="bin-item-row" key={item.id} onClick={() => setItemDetail(item.id)}>
                              <span>{item.name}</span>
                              <small>{item.quantityStatus}</small>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="meta">No item records in this bin yet.</p>
                      )}
                    </div>
                    <div className="qr-box">
                      {qrImages[container.id] ? <img src={qrImages[container.id]} alt={`QR for ${container.name}`} /> : <div className="thumb">QR</div>}
                      <div className="bin-actions">
                        <button
                          className="small-button"
                          onClick={() =>
                            downloadText(
                              `${container.containerCode}-qr.svg`,
                              `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="500"><rect width="100%" height="100%" fill="white"/><text x="210" y="48" text-anchor="middle" font-family="Arial" font-size="28" font-weight="700">${container.name}</text><image href="${qrImages[container.id] ?? ""}" x="70" y="80" width="280" height="280"/><text x="210" y="410" text-anchor="middle" font-family="Arial" font-size="24">${container.containerCode}</text></svg>`,
                              "image/svg+xml"
                            )
                          }
                        >
                          Download label
                        </button>
                        <button className="small-button" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}?container=${encodeURIComponent(container.containerCode)}`).catch(() => undefined)}>
                          Copy scan link
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {view === "orders" ? (
        <section>
          <div className="section-head">
            <div>
              <h2>To-order list</h2>
              <p className="muted">Track what needs buying, what is ordered, and what was received.</p>
            </div>
            <div className="inline-actions">
              <button className="ghost-button" onClick={() => setView("more")}>
                Back
              </button>
              <button className="button" onClick={() => openOrderForm()}>
                Add
              </button>
            </div>
          </div>

          <div className="filters">
            {[
              ["needed", "Needed"],
              ["ordered", "Ordered"],
              ["received", "Received"],
              ["all", "All"]
            ].map(([scope, label]) => (
              <button className={`filter-chip ${orderScope === scope ? "active" : ""}`} key={scope} onClick={() => setOrderScope(scope as typeof orderScope)}>
                {label}
              </button>
            ))}
          </div>

          <div className="order-dashboard">
            {[
              ["needed", "Need to buy", orderCounts.needed],
              ["ordered", "On the way", orderCounts.ordered],
              ["received", "Received", orderCounts.received],
              ["all", "Total", orderCounts.all]
            ].map(([scope, label, count]) => (
              <button className={`order-stat ${orderScope === scope ? "active" : ""}`} key={scope} onClick={() => setOrderScope(scope as typeof orderScope)}>
                <strong>{count}</strong>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {showOrderForm ? (
            <form className="form-panel" onSubmit={saveOrder}>
              <h2>{editingOrderId ? "Update order" : "Add to order"}</h2>
              <div className="form-grid">
                <label className="label">
                  <span>Item</span>
                  <input className="field" required value={orderDraft.name ?? ""} onChange={(event) => setOrderDraft({ ...orderDraft, name: event.target.value })} />
                </label>
                <div className="form-row">
                  <label className="label">
                    <span>Quantity</span>
                    <input className="field" value={orderDraft.quantity ?? ""} onChange={(event) => setOrderDraft({ ...orderDraft, quantity: event.target.value })} />
                  </label>
                  <label className="label">
                    <span>Store or vendor</span>
                    <input className="field" value={orderDraft.preferredStore ?? ""} onChange={(event) => setOrderDraft({ ...orderDraft, preferredStore: event.target.value })} />
                  </label>
                </div>
                <div className="form-row">
                  <label className="label">
                    <span>Preferred brand</span>
                    <input className="field" value={orderDraft.preferredBrand ?? ""} onChange={(event) => setOrderDraft({ ...orderDraft, preferredBrand: event.target.value })} />
                  </label>
                  <label className="label">
                    <span>Estimated price</span>
                    <input className="field" inputMode="decimal" value={orderDraft.estimatedPrice ?? ""} onChange={(event) => setOrderDraft({ ...orderDraft, estimatedPrice: event.target.value })} />
                  </label>
                </div>
                <label className="label">
                  <span>Product link</span>
                  <input className="field" inputMode="url" value={orderDraft.replacementUrl ?? ""} onChange={(event) => setOrderDraft({ ...orderDraft, replacementUrl: event.target.value })} />
                </label>
                <div className="form-row">
                  <label className="label">
                    <span>Order number</span>
                    <input className="field" value={orderDraft.orderNumber ?? ""} onChange={(event) => setOrderDraft({ ...orderDraft, orderNumber: event.target.value })} />
                  </label>
                  <label className="label">
                    <span>Expected delivery</span>
                    <input className="field" type="date" value={orderDraft.expectedDeliveryDate ?? ""} onChange={(event) => setOrderDraft({ ...orderDraft, expectedDeliveryDate: event.target.value })} />
                  </label>
                </div>
                <label className="label">
                  <span>Tracking link</span>
                  <input className="field" inputMode="url" value={orderDraft.trackingUrl ?? ""} onChange={(event) => setOrderDraft({ ...orderDraft, trackingUrl: event.target.value })} />
                </label>
                <label className="label">
                  <span>Urgency</span>
                  <select className="field" value={orderDraft.urgency ?? "Needed soon"} onChange={(event) => setOrderDraft({ ...orderDraft, urgency: event.target.value as Urgency })}>
                    {urgencies.map((urgency) => (
                      <option key={urgency}>{urgency}</option>
                    ))}
                  </select>
                </label>
                <label className="label">
                  <span>Status</span>
                  <select className="field" value={orderDraft.status ?? "Needed"} onChange={(event) => setOrderDraft({ ...orderDraft, status: event.target.value as OrderStatus })}>
                    {orderStatuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label className="label">
                  <span>Notes</span>
                  <textarea className="textarea" value={orderDraft.notes ?? ""} onChange={(event) => setOrderDraft({ ...orderDraft, notes: event.target.value })} />
                </label>
                <div className="inline-actions">
                  <button className="button" type="submit">
                    {editingOrderId ? "Save changes" : "Save order"}
                  </button>
                  <button className="ghost-button" type="button" onClick={() => { setShowOrderForm(false); setEditingOrderId(""); setOrderDraft(blankOrder()); }}>
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          ) : null}

          <div className="grid card-list">
            {filteredOrders.map((entry) => {
              const item = linkedItem(entry);
              const deliverySignal = deliveryDateSignal(entry.expectedDeliveryDate, entry.status, todayIso);
              const orderCardClass =
                entry.status === "Needed"
                  ? "order-card order-needed"
                  : entry.status === "Ordered" || entry.status === "Purchased"
                    ? "order-card order-ordered"
                    : entry.status === "Received"
                      ? "order-card order-received"
                      : "order-card order-muted";
              return (
                <article className={orderCardClass} key={entry.id}>
                  <div className="order-topline">
                    <div>
                      <span className="order-eyebrow">{entry.urgency}</span>
                      <h3>{entry.name}</h3>
                    </div>
                    <div className="token-row">
                      <span className="badge">{entry.status}</span>
                      {deliverySignal ? <span className={deliverySignal.tone}>{deliverySignal.label}</span> : null}
                    </div>
                  </div>

                  <div className="order-facts">
                    <div>
                      <span>Quantity</span>
                      <strong>{entry.quantity || "Any"}</strong>
                    </div>
                    <div>
                      <span>Store</span>
                      <strong>{entry.preferredStore || "Any"}</strong>
                    </div>
                    <div>
                      <span>Brand</span>
                      <strong>{entry.preferredBrand || "Any"}</strong>
                    </div>
                    <div>
                      <span>Est. price</span>
                      <strong>{entry.estimatedPrice ? money(entry.estimatedPrice) : "Unknown"}</strong>
                    </div>
                  </div>

                  {item ? (
                    <p className="order-linked">
                      Linked inventory item: <strong>{item.name}</strong>
                    </p>
                  ) : null}
                  {normalizeWebUrl(entry.replacementUrl) ? (
                    <a className="meta plain-link" href={normalizeWebUrl(entry.replacementUrl)} target="_blank" rel="noreferrer">
                      Product link
                    </a>
                  ) : null}
                  {entry.orderNumber || entry.expectedDeliveryDate || entry.orderedAt || entry.receivedAt ? (
                    <div className="order-facts">
                      {entry.orderNumber ? <div><span>Order no.</span><strong>{entry.orderNumber}</strong></div> : null}
                      {entry.expectedDeliveryDate ? <div><span>Expected</span><strong>{entry.expectedDeliveryDate}</strong></div> : null}
                      {entry.orderedAt ? <div><span>Ordered</span><strong>{new Date(entry.orderedAt).toLocaleDateString()}</strong></div> : null}
                      {entry.receivedAt ? <div><span>Received</span><strong>{new Date(entry.receivedAt).toLocaleDateString()}</strong></div> : null}
                    </div>
                  ) : null}
                  {normalizeWebUrl(entry.trackingUrl) ? (
                    <a className="meta plain-link" href={normalizeWebUrl(entry.trackingUrl)} target="_blank" rel="noreferrer">
                      Track delivery
                    </a>
                  ) : null}
                  {entry.notes ? <p className="order-note">{entry.notes}</p> : null}
                  <div className="order-actions">
                    {item ? (
                      <button className="small-button" onClick={() => setItemDetail(item.id)}>
                        Open item
                      </button>
                    ) : null}
                    <button className="small-button" onClick={() => editOrder(entry)}>
                      Edit delivery
                    </button>
                    {entry.status !== "Needed" ? (
                      <button className="small-button" onClick={() => markOrderedStatus(entry.id, "Needed")}>
                        Back to needed
                      </button>
                    ) : null}
                    {entry.status !== "Ordered" ? (
                      <button className="small-button" onClick={() => markOrderedStatus(entry.id, "Ordered")}>
                        Ordered
                      </button>
                    ) : null}
                    {entry.status !== "Received" ? (
                      <button className="small-button" onClick={() => markOrderedStatus(entry.id, "Received")}>
                        Received
                      </button>
                    ) : null}
                    {entry.status !== "Cancelled" ? (
                      <button className="danger-button" onClick={() => markOrderedStatus(entry.id, "Cancelled")}>
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
            {!filteredOrders.length ? <div className="empty">No matching order entries.</div> : null}
          </div>
        </section>
      ) : null}

      {view === "purchases" ? (
        <section>
          <div className="section-head">
            <div>
              <h2>Purchases</h2>
              <p className="muted">Receipts, vendors, order numbers, and reorder memory.</p>
            </div>
            <div className="inline-actions">
              <button className="ghost-button" onClick={() => setView("more")}>
                Back
              </button>
              <button className="ghost-button" onClick={() => downloadText("mom-inventory-purchases.csv", purchasesToCsv(state.purchaseRecords, state), "text/csv")}>
                Export CSV
              </button>
            </div>
          </div>

          <div className="filters">
            {[
              ["all", "All"],
              ["reorder", "Reorder same"],
              ["compare", "Compare first"],
              ["avoid", "Avoid"]
            ].map(([scope, label]) => (
              <button className={`filter-chip ${purchaseScope === scope ? "active" : ""}`} key={scope} onClick={() => setPurchaseScope(scope as typeof purchaseScope)}>
                {label}
              </button>
            ))}
          </div>

          <div className="purchase-dashboard">
            {[
              ["all", "Saved purchases", purchaseCounts.all],
              ["reorder", "Reorder same", purchaseCounts.reorder],
              ["compare", "Compare first", purchaseCounts.compare],
              ["avoid", "Avoid", purchaseCounts.avoid]
            ].map(([scope, label, count]) => (
              <button className={`purchase-stat ${purchaseScope === scope ? "active" : ""}`} key={scope} onClick={() => setPurchaseScope(scope as typeof purchaseScope)}>
                <strong>{count}</strong>
                <span>{label}</span>
              </button>
            ))}
            <div className="purchase-receipt-stat">
              <strong>{purchaseCounts.receipts}</strong>
              <span>With receipt or screenshot</span>
            </div>
          </div>

          <div className="grid card-list">
            {filteredPurchases.map((purchase) => renderPurchaseCard(purchase))}
            {!filteredPurchases.length ? <div className="empty">No matching purchases yet.</div> : null}
          </div>
        </section>
      ) : null}

      {view === "supplements" ? (
        <section>
          <div className="section-head">
            <div>
              <h2>Supplements</h2>
              <p className="muted">Bottle inventory, remaining counts, and taken history. Not medical advice.</p>
            </div>
            <div className="inline-actions">
              <button className="ghost-button" onClick={() => setView("more")}>
                Back
              </button>
              <button className="button" onClick={() => openSupplementForm()}>
                Add
              </button>
            </div>
          </div>

          <div className="supplement-dashboard">
            <div className="supplement-stat"><strong>{supplementCounts.tracked}</strong><span>Tracked bottles</span></div>
            <div className={`supplement-stat ${supplementCounts.low ? "attention" : ""}`}><strong>{supplementCounts.low}</strong><span>Low bottles</span></div>
            <div className={`supplement-stat ${supplementCounts.out ? "urgent" : ""}`}><strong>{supplementCounts.out}</strong><span>Out now</span></div>
            <div className="supplement-stat"><strong>{supplementCounts.logs}</strong><span>Taken logs</span></div>
          </div>

          <div className="supplement-tools">
            <button className="button secondary" onClick={() => { setSupplementLogDraft(blankSupplementLog()); setShowSupplementLogForm(true); }}>Log taken</button>
            <button className="button" onClick={() => downloadSupplementsPdf(state.supplementItems, state.supplementLogs, state.household.name)}>Download PDF</button>
            <button className="ghost-button" onClick={() => { setReportScope("supplements"); setView("report"); window.setTimeout(() => window.print(), 250); }}>Print report</button>
            <button className="ghost-button" onClick={() => downloadText("mom-supplements.csv", supplementsToCsv(state.supplementItems, state.supplementLogs), "text/csv")}>Export CSV</button>
          </div>

          {showSupplementForm ? renderSupplementForm() : null}
          {showSupplementLogForm ? renderSupplementLogForm() : null}

          {lowSupplements.length ? (
            <div className="supplement-alert">
              <div>
                <strong>Needs restocking</strong>
                <span>{lowSupplements.length} {lowSupplements.length === 1 ? "bottle is" : "bottles are"} at or below the saved reorder point.</span>
              </div>
              <div className="supplement-alert-list">
                {lowSupplements.map((supplement) => <span key={supplement.id}>{supplement.name}: {supplement.pillsRemaining || "0"} left</span>)}
              </div>
            </div>
          ) : null}

          <div className="grid card-list supplement-list">
            {filteredSupplements.map(renderSupplementCard)}
            {!filteredSupplements.length ? <div className="empty">No matching supplements yet.</div> : null}
          </div>

          <div className="panel supplement-history">
            <div className="section-head">
              <div>
                <h2>Recent logs</h2>
                <p className="muted">The eight most recent entries, newest first.</p>
              </div>
            </div>
            <div className="grid">
              {recentSupplementLogs.map((log) => {
                const supplement = state.supplementItems.find((entry) => entry.id === log.supplementItemId);
                return (
                  <article className="supplement-log" key={log.id}>
                    <div className="card-row">
                      <h3>{supplement?.name ?? "Deleted supplement"}</h3>
                      <span className="badge">{log.amountTaken || "1"} taken</span>
                    </div>
                    <time>{log.takenAt.replace("T", " ")}</time>
                    {log.notes ? <p className="meta">{log.notes}</p> : null}
                  </article>
                );
              })}
              {!recentSupplementLogs.length ? <div className="empty">No supplement logs yet.</div> : null}
            </div>
          </div>
        </section>
      ) : null}

      {view === "report" ? renderReportView() : null}

      {view === "help" ? <HelpCenter onBack={() => setView("more")} /> : null}

      {view === "more" ? (
        <section className="grid">
          <CloudSettings state={state} onRestore={(cloudState) => setState(migrateState(cloudState))} />

          <div className="panel">
            <div className="section-head">
              <div>
                <h2>User Manual</h2>
                <p className="muted">Clear steps for every main part of Mom Home.</p>
              </div>
              <button className="button" onClick={() => setView("help")}>Open manual</button>
            </div>
          </div>

          <div className="panel">
            <div className="section-head">
              <div>
                <h2>Put on iPhone Home Screen</h2>
                <p className="muted">Use Safari for the best PWA behavior.</p>
              </div>
            </div>
            <ol className="install-steps">
              <li>Open this website in Safari.</li>
              <li>Tap the Share button.</li>
              <li>Tap Add to Home Screen.</li>
              <li>Tap Add.</li>
              <li>Open Mom Home from the Home Screen.</li>
            </ol>
          </div>

          <div className="panel">
            <div className="section-head">
              <div>
                <h2>Settings</h2>
                <p className="muted">Personal preferences Mom can change any time.</p>
              </div>
            </div>
            <label className="label">
              <span>Star system</span>
              <select className="field" value={state.settings.starMode} onChange={(event) => updateStarMode(event.target.value as StarMode)}>
                {starModes.map((mode) => (
                  <option value={mode} key={mode}>
                    {mode === "0-3" ? "0 to 3 stars" : mode === "0-5" ? "0 to 5 stars" : mode === "gold" ? "One gold star" : "Stars off"}
                  </option>
                ))}
              </select>
            </label>
            <label className="label" style={{ marginTop: 12 }}>
              <span>Default Today lens</span>
              <select className="field" value={state.settings.todayLens} onChange={(event) => updateTodayLens(event.target.value as TodayLens)}>
                {todayInterfaceOptions.map((option) => <option value={option.id} key={option.id}>{option.settingsLabel}</option>)}
                <option value="last-used">Last used</option>
              </select>
              <span className="hint">Changes which working Today lens opens by default.</span>
            </label>
          </div>

          <div className="panel">
            <div className="section-head">
              <div>
                <h2>Assistant handoff</h2>
                <p className="muted">Clean task summary for a helper. Nothing is shortened.</p>
              </div>
            </div>
            <textarea className="textarea handoff-text" readOnly value={assistantExportText() || "No starred, dated, quick win, or help-requested tasks right now."} />
            <div className="inline-actions" style={{ marginTop: 10 }}>
              <button className="button" onClick={() => navigator.clipboard?.writeText(assistantExportText() || "No priority tasks right now.").catch(() => undefined)}>
                Copy text
              </button>
              <button className="ghost-button" onClick={() => downloadText("mom-assistant-docket.txt", assistantExportText() || "No priority tasks right now.", "text/plain")}>
                Download text
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="section-head">
              <div>
                <h2>Export</h2>
                <p className="muted">Keep a backup or move data later.</p>
              </div>
            </div>
            <div className="quick-actions">
              <button className="button" onClick={() => { setReportScope("all"); setView("report"); }}>
                View printable report
              </button>
              <button className="button" onClick={() => downloadText("mom-inventory.json", JSON.stringify(state, null, 2), "application/json")}>
                Download full backup
              </button>
              <button className="button secondary" onClick={() => downloadText("mom-inventory-items.csv", itemsToCsv(state.items, state.locations, state.containers), "text/csv")}>
                Item data file
              </button>
              <button className="ghost-button" onClick={() => downloadText("mom-inventory-purchases.csv", purchasesToCsv(state.purchaseRecords, state), "text/csv")}>
                Purchase data file
              </button>
              <button className="ghost-button" onClick={() => downloadText("mom-to-order.csv", ordersToCsv(state.orderEntries, state), "text/csv")}>
                To-order data file
              </button>
              <button className="ghost-button" onClick={() => downloadText("mom-tasks.csv", tasksToCsv(state.tasks, state.taskFlags, state.taskTags, state.taskProjects), "text/csv")}>
                Task data file
              </button>
              <button className="ghost-button" onClick={() => downloadText("mom-supplements.csv", supplementsToCsv(state.supplementItems, state.supplementLogs), "text/csv")}>
                Supplement data file
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="section-head">
              <div>
                <h2>Restore backup</h2>
                <p className="muted">Use this only when putting a saved backup back into this browser.</p>
              </div>
            </div>
            <label className="label">
              <span>Backup file</span>
              <input className="field" type="file" accept="application/json,.json" onChange={importBackup} />
            </label>
            {backupPreflight ? (
              <div className="backup-preflight">
                <div className="section-head">
                  <div>
                    <span className="cloud-kicker">Review before restore</span>
                    <h3>{backupPreflight.fileName}</h3>
                  </div>
                  <span className="badge low">Current browser data will be replaced</span>
                </div>
                <div className="backup-preflight-facts">
                  <div><span>Household</span><strong>{backupPreflight.state.household.name || "Unnamed household"}</strong></div>
                  <div><span>Backup file</span><strong>{Math.max(1, Math.round(backupPreflight.sizeBytes / 1024))} KB</strong></div>
                  <div><span>File modified</span><strong>{backupPreflight.modifiedAt}</strong></div>
                </div>
                <div className="backup-preflight-counts">
                  <span>{backupPreflight.state.items.length} items</span>
                  <span>{backupPreflight.state.tasks.length} tasks</span>
                  <span>{backupPreflight.state.orderEntries.length} orders</span>
                  <span>{backupPreflight.state.purchaseRecords.length} purchases</span>
                  <span>{backupPreflight.state.supplementItems.length} supplements</span>
                  <span>{backupPreflight.state.calendarEntries.length} calendar entries</span>
                </div>
                {backupPreflight.warnings.length ? (
                  <ul className="backup-preflight-warnings">
                    {backupPreflight.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                ) : <p className="backup-preflight-clear">This looks like a complete Mom Home backup.</p>}
                <div className="inline-actions">
                  <button className="button secondary" onClick={() => downloadText("mom-home-before-restore.json", JSON.stringify(state, null, 2), "application/json")}>Download current data first</button>
                  <button className="button" onClick={confirmBackupRestore}>Restore this backup</button>
                  <button className="ghost-button" onClick={cancelBackupRestore}>Cancel</button>
                </div>
              </div>
            ) : null}
            {backupMessage ? <p className="notice" style={{ marginTop: 10 }}>{backupMessage}</p> : null}
          </div>

          <div className="panel">
            <div className="section-head">
              <div>
                <h2>Household areas</h2>
                <p className="muted">Extra screens kept one tap away.</p>
              </div>
            </div>
            <div className="quick-actions">
              <button className="button" onClick={() => setView("orders")}>
                To-order
              </button>
              <button className="button secondary" onClick={() => setView("places")}>
                Places
              </button>
              <button className="ghost-button" onClick={() => setView("purchases")}>
                Purchases
              </button>
              <button className="ghost-button" onClick={() => setView("low")}>
                Low stock
              </button>
              <button className="ghost-button" onClick={() => setView("items")}>
                Inventory
              </button>
              <button className="ghost-button" onClick={() => setView("supplements")}>
                Supplements
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="section-head">
              <div>
                <h2>Technical notes</h2>
                <p className="muted">For future cloud sync, AI help, and helper access.</p>
              </div>
            </div>
            <pre className="schema">{`tables:
households, users, household_members
locations, containers, items
order_list_entries, purchase_records
receipts, replacement_searches
replacement_options, audit_sessions
tasks, task_projects, task_dependencies
task_flags, task_tags, energy_journal
calendar_entries, calendar_reminders
supplement_items, supplement_logs, supplement_stock_events
helper_access_grants, help_requests, alert_events
encrypted_vault_records, vault_recovery_keys
photos, ai_logs

AI layer later:
database context -> provider adapter -> suggested actions -> user confirmation`}</pre>
          </div>

          <div className="notice">
            <strong>Data note:</strong> Local saving always stays active. When Supabase is connected, cloud backup and private photo transfer are available from Cloud protection above.
          </div>
        </section>
      ) : null}

      {view !== "report" ? <nav className="nav-tabs" aria-label="Main">
        {[
          ["home", "Today"],
          ["tasks", "Tasks"],
          ["calendar", "Calendar"],
          ["items", "Inventory"],
          ["more", "More"]
        ].map(([key, label]) => (
          <button key={key} className={`nav-tab ${view === key || (key === "more" && view === "help") ? "active" : ""}`} onClick={() => setView(key as View)}>
            {label}
          </button>
        ))}
      </nav> : null}
    </main>
  );
}
