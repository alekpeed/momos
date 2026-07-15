"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { addMonths, format, parseISO, subMonths } from "date-fns";
import {
  blankCalendarEntry,
  blankContainer,
  blankHelpRequest,
  blankHelperContact,
  calmSounds,
  blankEnergyJournalEntry,
  blankIdeaBoard,
  blankIdeaBoardPlacement,
  blankIdeaBoardSection,
  blankIdeaCard,
  blankItem,
  blankLocation,
  blankOrder,
  blankPurchase,
  blankPurchaseImportReview,
  blankSupplementItem,
  blankVaultRecord,
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
  ideaContentTypes,
  ideaPriorities,
  ideaPurposes,
  ideaStatuses,
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
import { FocusSeason, playCalmSound } from "@/app/focus-season";
import { CloudSettings } from "@/app/cloud-settings";
import { ProviderAutomationPanel } from "@/app/provider-automation-panel";
import { CloudImage, CloudMediaLink } from "@/app/cloud-media";
import type {
  AppState,
  CalendarEntry,
  CalendarRepeat,
  CalmSound,
  Condition,
  Container,
  CommandTask,
  EnergyJournalEntry,
  FlagShape,
  HelpRequest,
  HelperContact,
  IdeaBoard,
  IdeaBoardPlacement,
  IdeaBoardSection,
  IdeaCard,
  IdeaContentType,
  IdeaPriority,
  IdeaStatus,
  Item,
  Location,
  LocationType,
  OrderEntry,
  OrderStatus,
  PurchaseImportReview,
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
  VaultRecord,
  View
} from "@/lib/inventory-types";

const appBasePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

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

function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function loadDataUrlImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be read"));
    image.src = dataUrl;
  });
}

async function inspectIdeaImage(dataUrl: string) {
  const image = await loadDataUrlImage(dataUrl);
  const canvas = document.createElement("canvas");
  const sampleSize = 12;
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { palette: [] as string[], signature: "" };
  context.drawImage(image, 0, 0, sampleSize, sampleSize);
  const pixels = context.getImageData(0, 0, sampleSize, sampleSize).data;
  const buckets = new Map<string, { count: number; red: number; green: number; blue: number }>();
  const signatureBits: string[] = [];
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 40) continue;
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const brightness = (red + green + blue) / 3;
    signatureBits.push(brightness > 128 ? "1" : "0");
    const key = `${Math.round(red / 32) * 32}-${Math.round(green / 32) * 32}-${Math.round(blue / 32) * 32}`;
    const bucket = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
    bucket.count += 1;
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    buckets.set(key, bucket);
  }
  const palette = Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((bucket) => rgbToHex(Math.round(bucket.red / bucket.count), Math.round(bucket.green / bucket.count), Math.round(bucket.blue / bucket.count)));
  return { palette, signature: signatureBits.join("").slice(0, 144) };
}

function signatureSimilarity(a?: string, b?: string) {
  if (!a || !b || a.length !== b.length) return 0;
  let matches = 0;
  for (let index = 0; index < a.length; index += 1) if (a[index] === b[index]) matches += 1;
  return matches / a.length;
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

const unreadableLocalBackupPrefix = `${STORAGE_KEY}-unreadable`;

function preserveUnreadableLocalBackup(rawState: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  localStorage.setItem(`${unreadableLocalBackupPrefix}-${stamp}`, rawState);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(kilobytes >= 100 ? 0 : 1)} KB`;
  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(megabytes >= 10 ? 1 : 2)} MB`;
}

function inspectBackup(file: File, input: unknown): BackupPreflight {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Backup is not an object.");
  const source = input as Record<string, unknown>;
  const collections = ["items", "locations", "containers", "orderEntries", "purchaseRecords", "purchaseImportQueue", "tasks", "calendarEntries", "supplementItems", "ideaBoards", "ideaCards", "helperContacts", "helpRequests"];
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
  const localBackupSize = useMemo(() => new Blob([JSON.stringify(state)]).size, [state]);
  const localBackupSizeLabel = formatBytes(localBackupSize);
  const localBackupSizeTone = localBackupSize > 4 * 1024 * 1024 ? "attention" : localBackupSize > 2 * 1024 * 1024 ? "watch" : "ok";
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
  const [showVaultForm, setShowVaultForm] = useState(false);
  const [showIdeaBoardForm, setShowIdeaBoardForm] = useState(false);
  const [showIdeaSectionForm, setShowIdeaSectionForm] = useState(false);
  const [showIdeaCardForm, setShowIdeaCardForm] = useState(false);
  const [showIdeaTrash, setShowIdeaTrash] = useState(false);
  const [showIdeaCompare, setShowIdeaCompare] = useState(false);
  const [showHelpRequestForm, setShowHelpRequestForm] = useState(false);
  const [showHelperContactForm, setShowHelperContactForm] = useState(false);
  const [editingHelpRequestId, setEditingHelpRequestId] = useState("");
  const [editingHelperContactId, setEditingHelperContactId] = useState("");
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
  const [purchaseImportDraft, setPurchaseImportDraft] = useState<Partial<PurchaseImportReview>>(() => blankPurchaseImportReview());
  const [showPurchaseImportForm, setShowPurchaseImportForm] = useState(false);
  const [taskDraft, setTaskDraft] = useState<Partial<CommandTask>>(() => blankTask());
  const [vaultDraft, setVaultDraft] = useState<Partial<VaultRecord>>(() => blankVaultRecord());
  const [vaultPlaintext, setVaultPlaintext] = useState("");
  const [vaultPassphrase, setVaultPassphrase] = useState("");
  const [vaultUnlockPassphrase, setVaultUnlockPassphrase] = useState("");
  const [unlockedVaultText, setUnlockedVaultText] = useState<Record<string, string>>({});
  const [vaultMessage, setVaultMessage] = useState("");
  const [taskFormMessage, setTaskFormMessage] = useState("");
  const [projectDraft, setProjectDraft] = useState<Partial<TaskProject>>(() => blankTaskProject());
  const [flagDraft, setFlagDraft] = useState<Partial<TaskFlag>>(() => blankTaskFlag());
  const [tagDraft, setTagDraft] = useState<Partial<TaskTag>>(() => blankTaskTag());
  const [energyDraft, setEnergyDraft] = useState<Partial<EnergyJournalEntry>>(() => blankEnergyJournalEntry());
  const [ideaBoardDraft, setIdeaBoardDraft] = useState<Partial<IdeaBoard>>(() => blankIdeaBoard());
  const [ideaSectionDraft, setIdeaSectionDraft] = useState<Partial<IdeaBoardSection>>(() => blankIdeaBoardSection());
  const [ideaCardDraft, setIdeaCardDraft] = useState<Partial<IdeaCard>>(() => blankIdeaCard());
  const [ideaPlacementDraft, setIdeaPlacementDraft] = useState<Partial<IdeaBoardPlacement>>(() => blankIdeaBoardPlacement());
  const [activeIdeaBoardId, setActiveIdeaBoardId] = useState("");
  const [ideaStatusFilter, setIdeaStatusFilter] = useState<IdeaStatus | "All">("All");
  const [ideaPriorityFilter, setIdeaPriorityFilter] = useState<IdeaPriority | "All">("All");
  const [ideaContentFilter, setIdeaContentFilter] = useState<IdeaContentType | "All">("All");
  const [ideaTagFilter, setIdeaTagFilter] = useState("");
  const [ideaPriceFilter, setIdeaPriceFilter] = useState<"All" | "Under50" | "MissingPrice">("All");
  const [ideaSort, setIdeaSort] = useState<"custom" | "newest" | "oldest" | "priority" | "price" | "status" | "updated" | "alpha">("custom");
  const [helpRequestDraft, setHelpRequestDraft] = useState<Partial<HelpRequest>>(() => blankHelpRequest());
  const [helperContactDraft, setHelperContactDraft] = useState<Partial<HelperContact>>(() => blankHelperContact());
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
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setState(migrateState(JSON.parse(saved)));
        } catch {
          preserveUnreadableLocalBackup(saved);
          setState(seedState());
          setBackupMessage("Mom Home could not read the saved browser data, so it opened a fresh local copy and preserved the unreadable data under a recovery key.");
        }
      }
    } catch {
      setBackupMessage("Mom Home could not open browser storage. Export a backup before making important changes if this message keeps appearing.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      setBackupMessage("Mom Home could not save to browser storage. Download a JSON backup before closing this page.");
    }
  }, [loaded, state]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${appBasePath}/sw.js`).catch(() => undefined);
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
  const activeIdeaBoards = useMemo(
    () => state.ideaBoards.filter((board) => !board.archivedAt).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [state.ideaBoards]
  );
  const archivedIdeaBoards = useMemo(
    () => state.ideaBoards.filter((board) => board.archivedAt).sort((a, b) => a.name.localeCompare(b.name)),
    [state.ideaBoards]
  );
  const selectedIdeaBoard = activeIdeaBoards.find((board) => board.id === activeIdeaBoardId) ?? activeIdeaBoards[0];
  const selectedIdeaBoardId = selectedIdeaBoard?.id ?? "";
  const selectedIdeaSections = useMemo(
    () => state.ideaBoardSections.filter((section) => section.boardId === selectedIdeaBoardId).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [selectedIdeaBoardId, state.ideaBoardSections]
  );
  const activeIdeaCards = useMemo(() => state.ideaCards.filter((card) => !card.deletedAt), [state.ideaCards]);
  const archivedIdeaCards = useMemo(() => activeIdeaCards.filter((card) => card.archivedAt), [activeIdeaCards]);
  const activeIdeaTags = useMemo(
    () => Array.from(new Set(activeIdeaCards.flatMap((card) => card.tags))).sort((a, b) => a.localeCompare(b)),
    [activeIdeaCards]
  );
  const ideaBoardCards = useMemo(() => {
    const placements = state.ideaBoardPlacements.filter((placement) => placement.boardId === selectedIdeaBoardId);
    const query = normalize(search);
    const priorityWeight: Record<IdeaPriority, number> = { High: 0, Medium: 1, Low: 2, None: 3 };
    const withPlacement = placements
      .map((placement) => {
        const card = state.ideaCards.find((entry) => entry.id === placement.cardId);
        return card && !card.deletedAt && !card.archivedAt ? { card, placement } : undefined;
      })
      .filter(Boolean) as { card: IdeaCard; placement: IdeaBoardPlacement }[];
    const filtered = withPlacement.filter(({ card, placement }) => {
      const linkedItem = card.relatedItemId ? state.items.find((item) => item.id === card.relatedItemId)?.name ?? "" : "";
      const haystack = [card.title, card.notes ?? "", card.sourceUrl ?? "", card.sourceSite ?? "", card.storeOrSeller ?? "", card.color ?? "", card.dimensions ?? "", card.stackName ?? "", linkedItem, ...card.tags].join(" ");
      if (query && !normalize(haystack).includes(query)) return false;
      if (ideaStatusFilter !== "All" && card.status !== ideaStatusFilter) return false;
      if (ideaPriorityFilter !== "All" && card.priority !== ideaPriorityFilter) return false;
      if (ideaContentFilter !== "All" && card.contentType !== ideaContentFilter) return false;
      if (ideaTagFilter && !card.tags.includes(ideaTagFilter)) return false;
      const numericPrice = Number(String(card.price ?? "").replace(/[$,\s]/g, ""));
      if (ideaPriceFilter === "Under50" && (!Number.isFinite(numericPrice) || numericPrice > 50)) return false;
      if (ideaPriceFilter === "MissingPrice" && card.price) return false;
      return Boolean(placement.boardId === selectedIdeaBoardId);
    });
    return [...filtered].sort((a, b) => {
      if (ideaSort === "newest") return b.card.createdAt.localeCompare(a.card.createdAt);
      if (ideaSort === "oldest") return a.card.createdAt.localeCompare(b.card.createdAt);
      if (ideaSort === "priority") return priorityWeight[a.card.priority] - priorityWeight[b.card.priority];
      if (ideaSort === "price") return Number(String(a.card.price ?? "").replace(/[$,\s]/g, "") || Infinity) - Number(String(b.card.price ?? "").replace(/[$,\s]/g, "") || Infinity);
      if (ideaSort === "status") return a.card.status.localeCompare(b.card.status);
      if (ideaSort === "updated") return b.card.updatedAt.localeCompare(a.card.updatedAt);
      if (ideaSort === "alpha") return a.card.title.localeCompare(b.card.title);
      return a.placement.sortOrder - b.placement.sortOrder || a.card.title.localeCompare(b.card.title);
    });
  }, [ideaContentFilter, ideaPriceFilter, ideaPriorityFilter, ideaSort, ideaStatusFilter, ideaTagFilter, search, selectedIdeaBoardId, state.ideaBoardPlacements, state.ideaCards, state.items]);
  const favoriteIdeaCards = ideaBoardCards.filter(({ placement }) => placement.favorite).slice(0, 4);
  const filteredIdeaBoards = useMemo(() => {
    const query = normalize(search);
    if (!query) return activeIdeaBoards;
    return activeIdeaBoards.filter((board) => {
      const room = board.roomLocationId ? state.locations.find((location) => location.id === board.roomLocationId)?.name ?? "" : "";
      return [board.name, board.description ?? "", room].some((value) => normalize(value).includes(query));
    });
  }, [activeIdeaBoards, search, state.locations]);
  const ideaBoardBudget = useMemo(() => {
    const priced = ideaBoardCards
      .map(({ card }) => ({ card, price: Number(String(card.price ?? "").replace(/[$,\s]/g, "")) }))
      .filter((entry) => Number.isFinite(entry.price));
    const total = priced.reduce((sum, entry) => sum + entry.price, 0);
    const purchased = priced.filter((entry) => entry.card.status === "Purchased" || entry.card.status === "Completed").reduce((sum, entry) => sum + entry.price, 0);
    return { total, purchased, remaining: Math.max(0, total - purchased) };
  }, [ideaBoardCards]);
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

    state.orderEntries
      .filter((entry) => ["Ordered", "Purchased"].includes(entry.status) && entry.expectedDeliveryDate && entry.expectedDeliveryDate <= todayIso)
      .slice(0, 2)
      .forEach((entry) => signals.push({
        id: `watch-order-${entry.id}`,
        kind: "watch",
        title: `${entry.name} delivery`,
        detail: entry.expectedDeliveryDate === todayIso ? "Expected today" : `Expected ${entry.expectedDeliveryDate}`,
        actionLabel: "Orders"
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

  const deliveryWatchOrders = useMemo(() => state.orderEntries
    .filter((entry) => ["Ordered", "Purchased"].includes(entry.status) && Boolean(entry.expectedDeliveryDate))
    .sort((a, b) => (a.expectedDeliveryDate ?? "9999-12-31").localeCompare(b.expectedDeliveryDate ?? "9999-12-31")), [state.orderEntries]);

  const openHelpRequests = useMemo(() => state.helpRequests
    .filter((request) => !["Resolved", "Cancelled"].includes(request.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [state.helpRequests]);

  const preferredHelperContacts = useMemo(() => [...state.helperContacts]
    .sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.name.localeCompare(b.name)), [state.helperContacts]);

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

  const purchaseDocket = useMemo(() => {
    const missingReceipts = state.purchaseRecords.filter((purchase) => !purchase.receiptUrl && !purchase.receiptPhotoUrl && !purchase.receiptText);
    const compareFirst = state.purchaseRecords.filter((purchase) => purchase.reorderRecommendation === "Compare first");
    const avoid = state.purchaseRecords.filter((purchase) => purchase.reorderRecommendation === "Avoid" || purchase.purchasePreference === "Do not buy again");
    const unchecked = state.purchaseRecords.filter((purchase) => !purchase.checkedAt);
    return { missingReceipts, compareFirst, avoid, unchecked };
  }, [state.purchaseRecords]);

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

  function exportFilename(label: string, extension: string) {
    return `mom-home-${label}-${todayIso}.${extension}`;
  }

  function downloadJsonBackup(filename = exportFilename("full-backup", "json")) {
    downloadText(filename, JSON.stringify(state, null, 2), "application/json");
  }

  function taskEmptyMessage() {
    if (search.trim()) return "No tasks match that search. Try a shorter word, a flag name, a tag, or a project name.";
    if (!state.tasks.length) return "No tasks yet. Add one small task, then use stars, flags, tags, or a project only if they help.";
    if (taskScope === "next") return "Nothing is ready right now. Waiting tasks below name what has to happen first.";
    if (taskScope === "today") return "Nothing is due today. Add a due date to a task if it should show here and on Calendar.";
    if (taskScope === "starred") return "No starred tasks yet. Edit a task and choose stars for anything that should stand out.";
    if (taskScope === "quick") return "No quick wins marked yet. Edit a task and set effort to Tiny or Quick win.";
    if (taskScope === "help") return "No help requests right now. Edit a task and mark it as needing help when someone else should step in.";
    if (taskScope === "all") return "No tasks saved yet. Add one small task to get started.";
    return "No open tasks right now. Use All if you want to see finished, skipped, or cancelled tasks.";
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
      if (signal.id.startsWith("watch-order")) {
        setOrderScope("ordered");
        setView("orders");
      } else {
        setView("calendar");
      }
      return;
    }
    if (helpTasks.length) {
      setTaskScope("help");
      setView("tasks");
    } else {
      setView("alerts");
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

  function helperContactLabel(contactId?: string) {
    const contact = state.helperContacts.find((entry) => entry.id === contactId) ?? preferredHelperContacts[0];
    if (!contact) return "No helper selected";
    return [contact.name, contact.relationship].filter(Boolean).join(" - ");
  }

  function helpRequestText(request: HelpRequest) {
    const relatedTask = state.tasks.find((task) => task.id === request.relatedTaskId);
    const relatedOrder = state.orderEntries.find((order) => order.id === request.relatedOrderEntryId);
    return [
      request.urgency === "Urgent" ? "URGENT helper request from Mom Home (not a 911/emergency service)." : "Helper request from Mom Home.",
      `Need: ${request.title}`,
      request.details ? `Details: ${request.details}` : "",
      relatedTask ? `Related task: ${relatedTask.title}` : "",
      relatedOrder ? `Related order/delivery: ${relatedOrder.name}${relatedOrder.expectedDeliveryDate ? `, expected ${relatedOrder.expectedDeliveryDate}` : ""}` : "",
      "If this is a real emergency, call 911 or local emergency services."
    ].filter(Boolean).join("\n");
  }

  function openHelpRequestForm(request?: HelpRequest, seed?: Partial<HelpRequest>) {
    setEditingHelpRequestId(request?.id ?? "");
    setHelpRequestDraft(request ? { ...request } : { ...blankHelpRequest(), ...seed });
    setShowHelpRequestForm(true);
    setView("alerts");
  }

  function saveHelpRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!helpRequestDraft.title?.trim()) return;
    const now = nowIso();
    const request: HelpRequest = {
      id: helpRequestDraft.id ?? makeId("help-request"),
      householdId: HOUSEHOLD_ID,
      title: helpRequestDraft.title.trim(),
      details: helpRequestDraft.details?.trim() || undefined,
      urgency: helpRequestDraft.urgency ?? "Soon",
      status: helpRequestDraft.status ?? "Open",
      contactId: helpRequestDraft.contactId || undefined,
      relatedTaskId: helpRequestDraft.relatedTaskId || undefined,
      relatedOrderEntryId: helpRequestDraft.relatedOrderEntryId || undefined,
      createdAt: helpRequestDraft.createdAt ?? now,
      updatedAt: now,
      sentAt: helpRequestDraft.sentAt,
      resolvedAt: helpRequestDraft.resolvedAt
    };
    setState((current) => ({
      ...current,
      helpRequests: editingHelpRequestId
        ? current.helpRequests.map((entry) => entry.id === request.id ? request : entry)
        : [request, ...current.helpRequests]
    }));
    setHelpRequestDraft(blankHelpRequest());
    setEditingHelpRequestId("");
    setShowHelpRequestForm(false);
  }

  function updateHelpRequestStatus(request: HelpRequest, status: HelpRequest["status"]) {
    const now = nowIso();
    setState((current) => ({
      ...current,
      helpRequests: current.helpRequests.map((entry) => entry.id === request.id ? {
        ...entry,
        status,
        updatedAt: now,
        sentAt: status === "Sent" ? now : entry.sentAt,
        resolvedAt: status === "Resolved" ? now : entry.resolvedAt
      } : entry)
    }));
  }

  function openHelperContactForm(contact?: HelperContact) {
    setEditingHelperContactId(contact?.id ?? "");
    setHelperContactDraft(contact ? { ...contact } : blankHelperContact());
    setShowHelperContactForm(true);
    setView("alerts");
  }

  function saveHelperContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!helperContactDraft.name?.trim()) return;
    const now = nowIso();
    const contact: HelperContact = {
      id: helperContactDraft.id ?? makeId("helper"),
      householdId: HOUSEHOLD_ID,
      name: helperContactDraft.name.trim(),
      phone: helperContactDraft.phone?.trim() || undefined,
      email: helperContactDraft.email?.trim() || undefined,
      relationship: helperContactDraft.relationship?.trim() || undefined,
      preferred: Boolean(helperContactDraft.preferred),
      createdAt: helperContactDraft.createdAt ?? now,
      updatedAt: now
    };
    setState((current) => ({
      ...current,
      helperContacts: editingHelperContactId
        ? current.helperContacts.map((entry) => entry.id === contact.id ? contact : entry)
        : [contact, ...current.helperContacts]
    }));
    setHelperContactDraft(blankHelperContact());
    setEditingHelperContactId("");
    setShowHelperContactForm(false);
  }

  function deleteHelperContact(contactId: string) {
    const contact = state.helperContacts.find((entry) => entry.id === contactId);
    if (!window.confirm(`Delete helper contact${contact ? `: ${contact.name}` : ""}? Help requests will stay saved.`)) return;
    setState((current) => ({
      ...current,
      helperContacts: current.helperContacts.filter((entry) => entry.id !== contactId),
      helpRequests: current.helpRequests.map((request) => request.contactId === contactId ? { ...request, contactId: undefined, updatedAt: nowIso() } : request)
    }));
  }

  function copyHelpRequest(request: HelpRequest) {
    navigator.clipboard?.writeText(helpRequestText(request)).catch(() => undefined);
  }

  function helpRequestHref(request: HelpRequest, channel: "email" | "sms") {
    const contact = state.helperContacts.find((entry) => entry.id === request.contactId) ?? preferredHelperContacts[0];
    const body = encodeURIComponent(helpRequestText(request));
    if (channel === "email") return `mailto:${contact?.email ?? ""}?subject=${encodeURIComponent(request.title)}&body=${body}`;
    return `sms:${contact?.phone ?? ""}?&body=${body}`;
  }

  function updateDefaultNagIntervalMinutes(minutes: number) {
    setState((current) => ({ ...current, settings: { ...current.settings, defaultNagIntervalMinutes: Math.max(5, Math.min(120, minutes)) } }));
  }

  function bytesToBase64(bytes: Uint8Array) {
    return btoa(String.fromCharCode(...bytes));
  }

  function base64ToBytes(value: string) {
    return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
  }

  async function deriveVaultKey(passphrase: string, salt: Uint8Array<ArrayBuffer>) {
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  async function encryptVaultText(plaintext: string, passphrase: string) {
    const salt = crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>;
    const iv = crypto.getRandomValues(new Uint8Array(12)) as Uint8Array<ArrayBuffer>;
    const key = await deriveVaultKey(passphrase, salt);
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
    return { encryptedPayload: bytesToBase64(new Uint8Array(encrypted)), salt: bytesToBase64(salt), iv: bytesToBase64(iv) };
  }

  async function decryptVaultText(record: VaultRecord, passphrase: string) {
    const key = await deriveVaultKey(passphrase, base64ToBytes(record.salt));
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(record.iv) }, key, base64ToBytes(record.encryptedPayload));
    return new TextDecoder().decode(decrypted);
  }

  async function saveVaultRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vaultDraft.title?.trim() || !vaultPlaintext.trim() || vaultPassphrase.length < 8) {
      setVaultMessage("Add a title, private note, and passphrase of at least 8 characters.");
      return;
    }
    const now = nowIso();
    const encrypted = await encryptVaultText(vaultPlaintext, vaultPassphrase);
    const record: VaultRecord = {
      id: vaultDraft.id ?? makeId("vault"),
      householdId: HOUSEHOLD_ID,
      title: vaultDraft.title.trim(),
      category: vaultDraft.category ?? "Other",
      encryptedPayload: encrypted.encryptedPayload,
      salt: encrypted.salt,
      iv: encrypted.iv,
      kdf: "PBKDF2-SHA256",
      noteHint: vaultDraft.noteHint?.trim() || undefined,
      createdAt: vaultDraft.createdAt ?? now,
      updatedAt: now
    };
    setState((current) => ({ ...current, vaultRecords: [record, ...current.vaultRecords.filter((entry) => entry.id !== record.id)] }));
    setVaultDraft(blankVaultRecord());
    setVaultPlaintext("");
    setVaultPassphrase("");
    setShowVaultForm(false);
    setVaultMessage("Encrypted vault note saved locally. Keep the passphrase somewhere safe; it cannot be recovered from the app.");
  }

  async function unlockVaultRecord(record: VaultRecord) {
    try {
      const plaintext = await decryptVaultText(record, vaultUnlockPassphrase);
      setUnlockedVaultText((current) => ({ ...current, [record.id]: plaintext }));
      setVaultMessage("Vault note unlocked on this screen only.");
    } catch {
      setVaultMessage("Could not unlock that vault note. Check the passphrase.");
    }
  }

  function deleteVaultRecord(recordId: string) {
    if (!window.confirm("Delete this encrypted vault note? This cannot be undone unless you have a backup.")) return;
    setState((current) => ({ ...current, vaultRecords: current.vaultRecords.filter((entry) => entry.id !== recordId) }));
    setUnlockedVaultText((current) => {
      const next = { ...current };
      delete next[recordId];
      return next;
    });
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
      nagIntervalMinutes: calendarDraft.nagEnabled ? calendarDraft.nagIntervalMinutes || state.settings.defaultNagIntervalMinutes : undefined,
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

  function openIdeaBoardForm(board?: IdeaBoard) {
    setIdeaBoardDraft(board ? { ...board } : { ...blankIdeaBoard(), sortOrder: state.ideaBoards.length });
    setShowIdeaBoardForm(true);
    setView("ideas");
  }

  function saveIdeaBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ideaBoardDraft.name?.trim()) return;
    const now = nowIso();
    const isEdit = Boolean(ideaBoardDraft.id);
    const board: IdeaBoard = {
      id: ideaBoardDraft.id ?? makeId("idea-board"),
      householdId: HOUSEHOLD_ID,
      name: ideaBoardDraft.name.trim(),
      description: ideaBoardDraft.description || undefined,
      roomLocationId: ideaBoardDraft.roomLocationId || undefined,
      archivedAt: ideaBoardDraft.archivedAt || undefined,
      sortOrder: ideaBoardDraft.sortOrder ?? state.ideaBoards.length,
      createdAt: ideaBoardDraft.createdAt ?? now,
      updatedAt: now
    };
    setState((current) => ({
      ...current,
      ideaBoards: isEdit ? current.ideaBoards.map((entry) => (entry.id === board.id ? board : entry)) : [board, ...current.ideaBoards]
    }));
    setActiveIdeaBoardId(board.id);
    setIdeaBoardDraft(blankIdeaBoard());
    setShowIdeaBoardForm(false);
  }

  function archiveIdeaBoard(boardId: string) {
    const board = state.ideaBoards.find((entry) => entry.id === boardId);
    const ok = window.confirm(`Archive idea board: ${board?.name ?? "this board"}? Cards will stay saved and searchable.`);
    if (!ok) return;
    const now = nowIso();
    setState((current) => ({
      ...current,
      ideaBoards: current.ideaBoards.map((entry) => entry.id === boardId ? { ...entry, archivedAt: now, updatedAt: now } : entry)
    }));
  }

  function restoreIdeaBoard(boardId: string) {
    const now = nowIso();
    setState((current) => ({
      ...current,
      ideaBoards: current.ideaBoards.map((entry) => entry.id === boardId ? { ...entry, archivedAt: undefined, updatedAt: now } : entry)
    }));
  }

  function openIdeaSectionForm(section?: IdeaBoardSection) {
    if (!selectedIdeaBoardId && !section?.boardId) return;
    setIdeaSectionDraft(section ? { ...section } : { ...blankIdeaBoardSection(selectedIdeaBoardId), sortOrder: selectedIdeaSections.length });
    setShowIdeaSectionForm(true);
    setView("ideas");
  }

  function saveIdeaSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ideaSectionDraft.name?.trim() || !ideaSectionDraft.boardId) return;
    const now = nowIso();
    const isEdit = Boolean(ideaSectionDraft.id);
    const section: IdeaBoardSection = {
      id: ideaSectionDraft.id ?? makeId("idea-section"),
      householdId: HOUSEHOLD_ID,
      boardId: ideaSectionDraft.boardId,
      name: ideaSectionDraft.name.trim(),
      description: ideaSectionDraft.description || undefined,
      sortOrder: ideaSectionDraft.sortOrder ?? selectedIdeaSections.length,
      createdAt: ideaSectionDraft.createdAt ?? now,
      updatedAt: now
    };
    setState((current) => ({
      ...current,
      ideaBoardSections: isEdit ? current.ideaBoardSections.map((entry) => entry.id === section.id ? section : entry) : [section, ...current.ideaBoardSections]
    }));
    setIdeaSectionDraft(blankIdeaBoardSection(selectedIdeaBoardId));
    setShowIdeaSectionForm(false);
  }

  function deleteIdeaSection(sectionId: string) {
    const section = state.ideaBoardSections.find((entry) => entry.id === sectionId);
    const ok = window.confirm(`Remove section: ${section?.name ?? "this section"}? Cards stay on the board.`);
    if (!ok) return;
    setState((current) => ({
      ...current,
      ideaBoardSections: current.ideaBoardSections.filter((entry) => entry.id !== sectionId),
      ideaBoardPlacements: current.ideaBoardPlacements.map((placement) => placement.sectionId === sectionId ? { ...placement, sectionId: undefined, updatedAt: nowIso() } : placement)
    }));
  }

  function openIdeaCardForm(card?: IdeaCard, placement?: IdeaBoardPlacement) {
    if (!selectedIdeaBoardId && !placement?.boardId) return;
    setIdeaCardDraft(card ? { ...card, tags: card.tags } : blankIdeaCard());
    setIdeaPlacementDraft(placement ? { ...placement } : { ...blankIdeaBoardPlacement(selectedIdeaBoardId), sortOrder: ideaBoardCards.length });
    setShowIdeaCardForm(true);
    setView("ideas");
  }

  async function saveIdeaCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ideaCardDraft.title?.trim() || !ideaPlacementDraft.boardId) return;
    const form = new FormData(event.currentTarget);
    const imageFile = form.get("ideaImage") as File;
    const now = nowIso();
    const isEdit = Boolean(ideaCardDraft.id);
    const cardId = ideaCardDraft.id ?? makeId("idea-card");
    const imageUrl = await fileToDataUrl(imageFile?.size ? imageFile : undefined);
    const imageInspection = imageUrl ? await inspectIdeaImage(imageUrl).catch(() => ({ palette: [] as string[], signature: "" })) : undefined;
    const price = ideaCardDraft.price || undefined;
    const previous = ideaCardDraft.id ? state.ideaCards.find((card) => card.id === ideaCardDraft.id) : undefined;
    const priceHistory = [...(previous?.priceHistory ?? ideaCardDraft.priceHistory ?? [])];
    if (price && price !== previous?.price) priceHistory.unshift({ price, checkedAt: now });
    const card: IdeaCard = {
      id: cardId,
      householdId: HOUSEHOLD_ID,
      title: ideaCardDraft.title.trim(),
      contentType: ideaCardDraft.contentType || "Note",
      status: ideaCardDraft.status || "Saved",
      priority: ideaCardDraft.priority || "None",
      notes: ideaCardDraft.notes || undefined,
      imageUrls: imageUrl ? [imageUrl, ...(ideaCardDraft.imageUrls ?? [])] : (ideaCardDraft.imageUrls ?? []),
      imageSignature: imageInspection?.signature || ideaCardDraft.imageSignature || undefined,
      colorPalette: imageInspection?.palette.length ? imageInspection.palette : (ideaCardDraft.colorPalette ?? []),
      sourceUrl: normalizeWebUrl(ideaCardDraft.sourceUrl || "") || undefined,
      sourceTitle: ideaCardDraft.sourceTitle || undefined,
      sourceSite: ideaCardDraft.sourceSite || undefined,
      storeOrSeller: ideaCardDraft.storeOrSeller || undefined,
      price,
      priceCheckedAt: price ? now : ideaCardDraft.priceCheckedAt,
      targetPrice: ideaCardDraft.targetPrice || undefined,
      priceHistory,
      dimensions: ideaCardDraft.dimensions || undefined,
      color: ideaCardDraft.color || imageInspection?.palette[0] || undefined,
      quantity: ideaCardDraft.quantity || undefined,
      purpose: ideaCardDraft.purpose,
      expirationDate: ideaCardDraft.expirationDate || undefined,
      seasonalMonth: ideaCardDraft.seasonalMonth || undefined,
      budgetCategory: ideaCardDraft.budgetCategory || undefined,
      alternativeForCardId: ideaCardDraft.alternativeForCardId || undefined,
      stackName: ideaCardDraft.stackName || undefined,
      currentPhotoUrl: ideaCardDraft.currentPhotoUrl || undefined,
      completedPhotoUrl: ideaCardDraft.completedPhotoUrl || undefined,
      actualCost: ideaCardDraft.actualCost || undefined,
      completedAt: ideaCardDraft.completedAt || undefined,
      availabilityStatus: ideaCardDraft.availabilityStatus || undefined,
      fitNotes: ideaCardDraft.fitNotes || undefined,
      tags: Array.from(new Set((ideaCardDraft.tags ?? []).map((tag: string) => tag.trim()).filter(Boolean))),
      roomLocationId: ideaCardDraft.roomLocationId || undefined,
      relatedItemId: ideaCardDraft.relatedItemId || undefined,
      relatedTaskId: ideaCardDraft.relatedTaskId || undefined,
      relatedProjectId: ideaCardDraft.relatedProjectId || undefined,
      relatedCalendarEntryId: ideaCardDraft.relatedCalendarEntryId || undefined,
      relatedOrderEntryId: ideaCardDraft.relatedOrderEntryId || undefined,
      relatedPurchaseRecordId: ideaCardDraft.relatedPurchaseRecordId || undefined,
      archivedAt: ideaCardDraft.archivedAt || undefined,
      deletedAt: ideaCardDraft.deletedAt || undefined,
      createdAt: ideaCardDraft.createdAt ?? now,
      updatedAt: now
    };
    const placement: IdeaBoardPlacement = {
      id: ideaPlacementDraft.id ?? makeId("idea-placement"),
      householdId: HOUSEHOLD_ID,
      cardId,
      boardId: ideaPlacementDraft.boardId,
      sectionId: ideaPlacementDraft.sectionId || undefined,
      favorite: Boolean(ideaPlacementDraft.favorite),
      sortOrder: ideaPlacementDraft.sortOrder ?? ideaBoardCards.length,
      createdAt: ideaPlacementDraft.createdAt ?? now,
      updatedAt: now
    };
    setState((current) => {
      const withoutDuplicatePlacements = current.ideaBoardPlacements.filter((entry) => !(entry.cardId === cardId && entry.boardId === placement.boardId && entry.id !== placement.id));
      return {
        ...current,
        ideaCards: isEdit ? current.ideaCards.map((entry) => entry.id === card.id ? card : entry) : [card, ...current.ideaCards],
        ideaBoardPlacements: isEdit && current.ideaBoardPlacements.some((entry) => entry.id === placement.id)
          ? withoutDuplicatePlacements.map((entry) => entry.id === placement.id ? placement : entry)
          : [placement, ...withoutDuplicatePlacements]
      };
    });
    setActiveIdeaBoardId(placement.boardId);
    setIdeaCardDraft(blankIdeaCard());
    setIdeaPlacementDraft(blankIdeaBoardPlacement(placement.boardId));
    setShowIdeaCardForm(false);
  }

  function updateIdeaCard(cardId: string, updates: Partial<IdeaCard>) {
    const now = nowIso();
    setState((current) => ({ ...current, ideaCards: current.ideaCards.map((card) => card.id === cardId ? { ...card, ...updates, updatedAt: now } : card) }));
  }

  function deleteIdeaCard(card: IdeaCard) {
    const ok = window.confirm(`Delete idea card: ${card.title}? It can be restored from archive/trash.`);
    if (!ok) return;
    updateIdeaCard(card.id, { deletedAt: nowIso() });
  }

  function toggleIdeaFavorite(placementId: string) {
    const now = nowIso();
    setState((current) => ({
      ...current,
      ideaBoardPlacements: current.ideaBoardPlacements.map((placement) => placement.id === placementId ? { ...placement, favorite: !placement.favorite, updatedAt: now } : placement)
    }));
  }

  function copyIdeaToBoard(cardId: string, boardId: string) {
    if (!boardId || state.ideaBoardPlacements.some((placement) => placement.cardId === cardId && placement.boardId === boardId)) return;
    const now = nowIso();
    setState((current) => ({
      ...current,
      ideaBoardPlacements: [{ id: makeId("idea-placement"), householdId: HOUSEHOLD_ID, cardId, boardId, favorite: false, sortOrder: current.ideaBoardPlacements.length, createdAt: now, updatedAt: now }, ...current.ideaBoardPlacements]
    }));
  }

  function convertIdeaToTask(card: IdeaCard) {
    const now = nowIso();
    const taskId = makeId("task");
    const task: CommandTask = { id: taskId, householdId: HOUSEHOLD_ID, title: card.title, notes: card.notes || `From idea: ${card.sourceUrl ?? card.sourceTitle ?? "saved idea"}`, status: "Open", starCount: card.priority === "High" ? Math.min(1, maxStars()) : 0, flagIds: [], tagIds: [], effort: "Unsorted", projectId: card.relatedProjectId, dependencyIds: [], relatedItemId: card.relatedItemId, relatedOrderEntryId: card.relatedOrderEntryId, relatedPurchaseRecordId: card.relatedPurchaseRecordId, helpRequested: false, createdAt: now, updatedAt: now };
    setState((current) => ({ ...current, tasks: [task, ...current.tasks], ideaCards: current.ideaCards.map((entry) => entry.id === card.id ? { ...entry, relatedTaskId: taskId, updatedAt: now } : entry) }));
  }

  function convertIdeaToOrder(card: IdeaCard) {
    const now = nowIso();
    const orderId = makeId("order");
    const order: OrderEntry = { id: orderId, householdId: HOUSEHOLD_ID, itemId: card.relatedItemId, name: card.title, quantity: card.quantity, urgency: card.priority === "High" ? "Buy now" : "Watch only", preferredStore: card.storeOrSeller, estimatedPrice: card.price, replacementUrl: card.sourceUrl, notes: card.notes, status: "Needed", createdAt: now, updatedAt: now };
    setState((current) => ({ ...current, orderEntries: [order, ...current.orderEntries], ideaCards: current.ideaCards.map((entry) => entry.id === card.id ? { ...entry, relatedOrderEntryId: orderId, status: "Buying", updatedAt: now } : entry) }));
  }

  function convertIdeaToProject(card: IdeaCard) {
    const now = nowIso();
    const projectId = makeId("project");
    const project: TaskProject = { id: projectId, householdId: HOUSEHOLD_ID, name: card.title, color: "#37685f", notes: card.notes || "Created from an Ideas card.", createdAt: now, updatedAt: now };
    setState((current) => ({ ...current, taskProjects: [project, ...current.taskProjects], ideaCards: current.ideaCards.map((entry) => entry.id === card.id ? { ...entry, relatedProjectId: projectId, updatedAt: now } : entry) }));
  }

  function convertIdeaToInventoryItem(card: IdeaCard) {
    const now = nowIso();
    const itemId = makeId("item");
    const item: Item = { id: itemId, householdId: HOUSEHOLD_ID, locationId: card.roomLocationId || state.locations[0]?.id || "", name: card.title, normalizedName: normalize(card.title), category: "Miscellaneous", brand: card.storeOrSeller, quantityStatus: "Unknown", quantityNumber: card.quantity, condition: "Unknown", notes: card.notes, photoUrl: card.imageUrls[0], preferredStore: card.storeOrSeller, replacementUrl: card.sourceUrl, createdAt: now, updatedAt: now };
    setState((current) => ({ ...current, items: [item, ...current.items], ideaCards: current.ideaCards.map((entry) => entry.id === card.id ? { ...entry, relatedItemId: itemId, updatedAt: now } : entry) }));
  }

  function addIdeaCalendarReminder(card: IdeaCard) {
    const now = nowIso();
    const entryId = makeId("calendar");
    const entry: CalendarEntry = { id: entryId, householdId: HOUSEHOLD_ID, title: card.expirationDate ? `${card.title} deadline` : `Review idea: ${card.title}`, date: card.expirationDate || todayIso, startTime: "09:00", allDay: false, color: "#37685f", repeat: "Never", nagEnabled: false, notes: [card.notes, card.sourceUrl].filter(Boolean).join("\n"), createdAt: now, updatedAt: now };
    setState((current) => ({ ...current, calendarEntries: [entry, ...current.calendarEntries], ideaCards: current.ideaCards.map((candidate) => candidate.id === card.id ? { ...candidate, relatedCalendarEntryId: entryId, updatedAt: now } : candidate) }));
  }

  function ideaBoardExportText(board: IdeaBoard) {
    const rows = ideaBoardCards.map(({ card }) => `- ${card.title} [${card.status}/${card.priority}] ${card.price ? `$${card.price}` : ""}\n  ${[card.notes, card.sourceUrl, card.storeOrSeller, card.dimensions, card.color].filter(Boolean).join(" | ")}`);
    return [`${board.name} Ideas`, board.description ?? "", `Estimated total: ${money(String(ideaBoardBudget.total))}`, ...rows].filter(Boolean).join("\n\n");
  }

  function resetIdeaFilters() {
    setIdeaStatusFilter("All");
    setIdeaPriorityFilter("All");
    setIdeaContentFilter("All");
    setIdeaTagFilter("");
    setIdeaPriceFilter("All");
    setIdeaSort("custom");
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

  function updateCalmSound(calmSound: CalmSound) {
    setState((current) => ({
      ...current,
      settings: { ...current.settings, calmSound }
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
      receiptText: purchaseDraft.receiptText?.trim() || undefined,
      orderNumber: purchaseDraft.orderNumber || undefined,
      notes: purchaseDraft.notes || undefined,
      aiSummary: purchaseDraft.aiSummary || buildPurchaseSummary(purchaseDraft),
      aiConfidence: purchaseDraft.aiConfidence || "Medium",
      checkedAt: purchaseDraft.checkedAt || now,
      replacementOptions: purchaseDraft.replacementOptions ?? [],
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

  function buildPurchaseSummary(purchase: Partial<PurchaseRecord>) {
    const facts = [
      purchase.storeName ? `Vendor: ${purchase.storeName}` : "",
      purchase.totalPrice ? `Price: ${money(purchase.totalPrice)}` : "",
      purchase.reorderRecommendation ? `Recommendation: ${purchase.reorderRecommendation}` : "",
      purchase.purchasePreference ? `Preference: ${purchase.purchasePreference}` : ""
    ].filter(Boolean);
    return facts.length ? facts.join(" | ") : "Saved purchase memory; review before reordering.";
  }

  function buildReplacementOptions(purchase: PurchaseRecord): NonNullable<PurchaseRecord["replacementOptions"]> {
    const item = state.items.find((entry) => entry.id === purchase.itemId);
    const similarPurchases = state.purchaseRecords
      .filter((entry) => entry.id !== purchase.id)
      .filter((entry) => normalize(entry.productName).includes(normalize(item?.name ?? purchase.productName).slice(0, 8)) || entry.itemId === purchase.itemId)
      .slice(0, 3);
    const options: NonNullable<PurchaseRecord["replacementOptions"]> = similarPurchases.map((entry) => ({
      id: makeId("replacement-option"),
      title: entry.productName,
      storeName: purchaseSource(entry),
      productUrl: entry.productUrl,
      estimatedPrice: entry.totalPrice,
      notes: entry.reorderRecommendation,
      confidence: entry.itemId === purchase.itemId ? "High" as const : "Medium" as const,
      checkedAt: nowIso()
    }));
    if (item?.replacementUrl) {
      options.unshift({ id: makeId("replacement-option"), title: `${item.name} saved replacement link`, productUrl: item.replacementUrl, storeName: item.preferredStore || undefined, confidence: "High", checkedAt: nowIso() });
    }
    return options;
  }

  function refreshPurchaseIntelligence(purchase: PurchaseRecord) {
    const options = buildReplacementOptions(purchase);
    const summary = buildPurchaseSummary({ ...purchase, replacementOptions: options });
    setState((current) => ({
      ...current,
      purchaseRecords: current.purchaseRecords.map((entry) => entry.id === purchase.id ? { ...entry, replacementOptions: options, aiSummary: summary, aiConfidence: options.length ? "High" : "Medium", checkedAt: nowIso(), updatedAt: nowIso() } : entry)
    }));
  }

  function parsePurchaseImportText(text: string) {
    const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const priceMatch = text.match(/\$?([0-9]+\.[0-9]{2})/);
    const dateMatch = text.match(/(20\d{2}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/20\d{2})/);
    return {
      productName: lines.find((line) => !/total|subtotal|visa|mastercard|receipt/i.test(line)) ?? lines[0] ?? "Imported purchase",
      storeName: lines[0] ?? "",
      totalPrice: priceMatch?.[1],
      purchasedAt: dateMatch?.[1]?.includes("/") ? format(new Date(dateMatch[1]), "yyyy-MM-dd") : dateMatch?.[1]
    };
  }

  function savePurchaseImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!purchaseImportDraft.rawText?.trim()) return;
    const parsed = parsePurchaseImportText(purchaseImportDraft.rawText);
    const now = nowIso();
    const review: PurchaseImportReview = {
      id: purchaseImportDraft.id ?? makeId("purchase-import"),
      householdId: HOUSEHOLD_ID,
      source: purchaseImportDraft.source ?? "Receipt text",
      rawText: purchaseImportDraft.rawText.trim(),
      suggestedProductName: parsed.productName,
      suggestedStoreName: parsed.storeName,
      suggestedTotalPrice: parsed.totalPrice,
      suggestedPurchasedAt: parsed.purchasedAt,
      status: "Needs review",
      createdAt: purchaseImportDraft.createdAt ?? now,
      updatedAt: now
    };
    setState((current) => ({ ...current, purchaseImportQueue: [review, ...current.purchaseImportQueue] }));
    setPurchaseImportDraft(blankPurchaseImportReview());
    setShowPurchaseImportForm(false);
  }

  function startPurchaseFromImport(review: PurchaseImportReview) {
    const item = selectedItem ?? state.items[0];
    if (!item) return;
    setSelectedItemId(item.id);
    setPurchaseDraft({
      ...blankPurchase(item),
      productName: review.suggestedProductName ?? "Imported purchase",
      storeName: review.suggestedStoreName ?? "",
      totalPrice: review.suggestedTotalPrice ?? "",
      purchasedAt: review.suggestedPurchasedAt ?? localDateIso(new Date()),
      receiptText: review.rawText,
      notes: `Imported from ${review.source}. Review before saving.`
    });
    setShowPurchaseForm(true);
    setState((current) => ({ ...current, purchaseImportQueue: current.purchaseImportQueue.map((entry) => entry.id === review.id ? { ...entry, status: "Imported", updatedAt: nowIso() } : entry) }));
  }

  function dismissPurchaseImport(reviewId: string) {
    setState((current) => ({ ...current, purchaseImportQueue: current.purchaseImportQueue.map((entry) => entry.id === reviewId ? { ...entry, status: "Dismissed", updatedAt: nowIso() } : entry) }));
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
          {entry.nagEnabled ? <span>Repeats every {entry.nagIntervalMinutes || 15} min while open</span> : null}
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
            <p className="muted">Only title and date are required. Times, repeats, reminders, linked tasks, and notes are optional.</p>
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
                <span className="hint">Optional. Leave blank if the repeat should keep showing.</span>
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
            <span className="hint">Alerts work while Mom Home is open or installed. Use Help requests for human follow-up; provider-backed remote push is tracked separately.</span>
          </label>
          {calendarDraft.reminderMinutesBefore !== undefined ? (
            <div className="nag-settings">
              <label className="check-label">
                <input type="checkbox" checked={Boolean(calendarDraft.nagEnabled)} onChange={(event) => setCalendarDraft({ ...calendarDraft, nagEnabled: event.target.checked })} />
                <span>Repeat the reminder while Mom Home is open</span>
              </label>
              {calendarDraft.nagEnabled ? (
                <label className="label">
                  <span>Repeat alert every</span>
                  <select className="field" value={calendarDraft.nagIntervalMinutes ?? state.settings.defaultNagIntervalMinutes} onChange={(event) => setCalendarDraft({ ...calendarDraft, nagIntervalMinutes: Number(event.target.value) })}>
                    {[5, 10, 15, 30, 60, 120].map((minutes) => <option value={minutes} key={minutes}>{minutes} minutes</option>)}
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

  function renderIdeaBoardForm() {
    const isEdit = Boolean(ideaBoardDraft.id);
    return (
      <form className="form-panel" onSubmit={saveIdeaBoard}>
        <div className="section-head">
          <div>
            <h3>{isEdit ? "Edit idea board" : "Add idea board"}</h3>
            <p className="muted">Start with the collection name. Cards, sections, and comparisons come next.</p>
          </div>
        </div>
        <div className="form-grid">
          <label className="label">
            <span>Board name</span>
            <input className="field" required value={ideaBoardDraft.name ?? ""} onChange={(event) => setIdeaBoardDraft({ ...ideaBoardDraft, name: event.target.value })} placeholder="Kitchen Ideas" />
          </label>
          <label className="label">
            <span>Room or area</span>
            <select className="field" value={ideaBoardDraft.roomLocationId ?? ""} onChange={(event) => setIdeaBoardDraft({ ...ideaBoardDraft, roomLocationId: event.target.value })}>
              <option value="">No room yet</option>
              {state.locations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}
            </select>
          </label>
        </div>
        <label className="label">
          <span>Notes</span>
          <textarea className="textarea" value={ideaBoardDraft.description ?? ""} onChange={(event) => setIdeaBoardDraft({ ...ideaBoardDraft, description: event.target.value })} placeholder="What this board is for, what Mom is deciding, or who to ask." />
        </label>
        <div className="form-actions">
          <button className="button" type="submit">{isEdit ? "Save board" : "Add board"}</button>
          <button className="ghost-button" type="button" onClick={() => { setShowIdeaBoardForm(false); setIdeaBoardDraft(blankIdeaBoard()); }}>Cancel</button>
        </div>
      </form>
    );
  }

  function renderIdeaBoardCard(board: IdeaBoard) {
    const room = board.roomLocationId ? state.locations.find((location) => location.id === board.roomLocationId)?.name : undefined;
    const placementCount = state.ideaBoardPlacements.filter((placement) => placement.boardId === board.id).length;
    const sectionCount = state.ideaBoardSections.filter((section) => section.boardId === board.id).length;
    return (
      <article className={`mini-card idea-board-card ${selectedIdeaBoardId === board.id ? "active" : ""}`} key={board.id}>
        <div className="card-row">
          <div>
            <h3>{board.name}</h3>
            <p className="meta">{room ? `${room} · ` : ""}{placementCount} cards · {sectionCount} sections</p>
          </div>
          <span className="badge">Board</span>
        </div>
        {board.description ? <p>{board.description}</p> : <p className="muted">No notes yet. Use this board to collect photos, links, products, and project ideas.</p>}
        <div className="inline-actions">
          <button className="small-button" onClick={() => setActiveIdeaBoardId(board.id)}>Open</button>
          <button className="small-button" onClick={() => openIdeaBoardForm(board)}>Edit</button>
          <button className="ghost-button" onClick={() => archiveIdeaBoard(board.id)}>Archive</button>
        </div>
      </article>
    );
  }

  function renderIdeaSectionForm() {
    return (
      <form className="form-panel" onSubmit={saveIdeaSection}>
        <h3>{ideaSectionDraft.id ? "Edit section" : "Add section"}</h3>
        <div className="form-grid">
          <label className="label"><span>Section name</span><input className="field" required value={ideaSectionDraft.name ?? ""} onChange={(event) => setIdeaSectionDraft({ ...ideaSectionDraft, name: event.target.value })} placeholder="Lighting" /></label>
          <label className="label"><span>Notes</span><input className="field" value={ideaSectionDraft.description ?? ""} onChange={(event) => setIdeaSectionDraft({ ...ideaSectionDraft, description: event.target.value })} /></label>
        </div>
        <div className="form-actions"><button className="button" type="submit">Save section</button><button className="ghost-button" type="button" onClick={() => setShowIdeaSectionForm(false)}>Cancel</button></div>
      </form>
    );
  }

  function renderIdeaCardForm() {
    const duplicateLink = ideaCardDraft.sourceUrl ? state.ideaCards.find((card) => card.id !== ideaCardDraft.id && card.sourceUrl && normalize(card.sourceUrl) === normalize(normalizeWebUrl(ideaCardDraft.sourceUrl || "") || "")) : undefined;
    const duplicateTitle = ideaCardDraft.title ? state.ideaCards.find((card) => card.id !== ideaCardDraft.id && normalize(card.title) === normalize(ideaCardDraft.title || "")) : undefined;
    const duplicateImage = ideaCardDraft.imageSignature ? state.ideaCards.find((card) => card.id !== ideaCardDraft.id && signatureSimilarity(card.imageSignature, ideaCardDraft.imageSignature) > 0.9) : undefined;
    return (
      <form className="form-panel idea-card-form" onSubmit={saveIdeaCard}>
        <div className="section-head">
          <div><h3>{ideaCardDraft.id ? "Edit idea card" : "Add idea card"}</h3><p className="muted">Save quickly now. Details, links, comparisons, and connected tasks can be filled in when useful.</p></div>
        </div>
        {duplicateLink || duplicateTitle || duplicateImage ? <p className="notice">Possible duplicate: {duplicateLink?.title ?? duplicateTitle?.title ?? duplicateImage?.title}. You can still keep both.</p> : null}
        <div className="form-grid">
          <label className="label"><span>Title</span><textarea className="textarea title-area" required value={ideaCardDraft.title ?? ""} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, title: event.target.value })} placeholder="Blue storage cabinet" /></label>
          <label className="label"><span>Board</span><select className="field" value={ideaPlacementDraft.boardId ?? selectedIdeaBoardId} onChange={(event) => setIdeaPlacementDraft({ ...ideaPlacementDraft, boardId: event.target.value, sectionId: "" })}>{activeIdeaBoards.map((board) => <option value={board.id} key={board.id}>{board.name}</option>)}</select></label>
          <label className="label"><span>Section</span><select className="field" value={ideaPlacementDraft.sectionId ?? ""} onChange={(event) => setIdeaPlacementDraft({ ...ideaPlacementDraft, sectionId: event.target.value })}><option value="">No section</option>{state.ideaBoardSections.filter((section) => section.boardId === (ideaPlacementDraft.boardId || selectedIdeaBoardId)).map((section) => <option value={section.id} key={section.id}>{section.name}</option>)}</select></label>
          <label className="label"><span>Type</span><select className="field" value={ideaCardDraft.contentType ?? "Note"} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, contentType: event.target.value as IdeaContentType })}>{ideaContentTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label className="label"><span>Status</span><select className="field" value={ideaCardDraft.status ?? "Saved"} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, status: event.target.value as IdeaStatus })}>{ideaStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="label"><span>Priority</span><select className="field" value={ideaCardDraft.priority ?? "None"} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, priority: event.target.value as IdeaPriority })}>{ideaPriorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
          <label className="label"><span>Reason saved</span><select className="field" value={ideaCardDraft.purpose ?? "Research"} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, purpose: event.target.value as IdeaCard["purpose"] })}>{ideaPurposes.map((purpose) => <option key={purpose}>{purpose}</option>)}</select></label>
          <label className="label"><span>Image / screenshot</span><input className="field" type="file" name="ideaImage" accept="image/*" capture="environment" /><span className="hint">Take a photo or upload a saved screenshot.</span></label>
          <label className="label"><span>Source link</span><input className="field" value={ideaCardDraft.sourceUrl ?? ""} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, sourceUrl: event.target.value })} placeholder="https://..." /></label>
          <label className="label"><span>Source title</span><input className="field" value={ideaCardDraft.sourceTitle ?? ""} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, sourceTitle: event.target.value })} /></label>
          <label className="label"><span>Website / store / seller</span><input className="field" value={ideaCardDraft.storeOrSeller ?? ""} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, storeOrSeller: event.target.value, sourceSite: event.target.value })} /></label>
          <label className="label"><span>Price</span><input className="field" value={ideaCardDraft.price ?? ""} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, price: event.target.value })} placeholder="49.99" /></label>
          <label className="label"><span>Target price</span><input className="field" value={ideaCardDraft.targetPrice ?? ""} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, targetPrice: event.target.value })} /></label>
          <label className="label"><span>Dimensions</span><input className="field" value={ideaCardDraft.dimensions ?? ""} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, dimensions: event.target.value })} /></label>
          <label className="label"><span>Color</span><input className="field" value={ideaCardDraft.color ?? ""} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, color: event.target.value })} /><span className="hint">If an image is added, Mom Home extracts a palette and fills this with the first color.</span></label>
          <label className="label"><span>Quantity</span><input className="field" value={ideaCardDraft.quantity ?? ""} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, quantity: event.target.value })} /></label>
          <label className="label"><span>Room / area</span><select className="field" value={ideaCardDraft.roomLocationId ?? ""} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, roomLocationId: event.target.value })}><option value="">No room yet</option>{state.locations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}</select></label>
          <label className="label"><span>Tags</span><input className="field" value={(ideaCardDraft.tags ?? []).join(", ")} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} placeholder="Gift, Kitchen, Under $50" /></label>
          <label className="label"><span>Sale / return / deadline</span><input className="field" type="date" value={ideaCardDraft.expirationDate ?? ""} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, expirationDate: event.target.value })} /></label>
          <label className="label"><span>Seasonal month</span><input className="field" value={ideaCardDraft.seasonalMonth ?? ""} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, seasonalMonth: event.target.value })} placeholder="November" /></label>
          <label className="label"><span>Budget group</span><input className="field" value={ideaCardDraft.budgetCategory ?? ""} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, budgetCategory: event.target.value })} /></label>
          <label className="label"><span>Idea stack</span><input className="field" value={ideaCardDraft.stackName ?? ""} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, stackName: event.target.value })} placeholder="Guest room plan" /></label>
          <label className="label"><span>Availability / link note</span><input className="field" value={ideaCardDraft.availabilityStatus ?? ""} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, availabilityStatus: event.target.value })} placeholder="In stock, sold out, link changed" /></label>
          <label className="label"><span>Fit / measurement notes</span><input className="field" value={ideaCardDraft.fitNotes ?? ""} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, fitNotes: event.target.value })} /></label>
          <label className="label"><span>Related inventory</span><select className="field" value={ideaCardDraft.relatedItemId ?? ""} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, relatedItemId: event.target.value })}><option value="">None</option>{state.items.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label className="label"><span>Related task</span><select className="field" value={ideaCardDraft.relatedTaskId ?? ""} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, relatedTaskId: event.target.value })}><option value="">None</option>{state.tasks.map((task) => <option value={task.id} key={task.id}>{task.title}</option>)}</select></label>
          <label className="label"><span>Related project</span><select className="field" value={ideaCardDraft.relatedProjectId ?? ""} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, relatedProjectId: event.target.value })}><option value="">None</option>{state.taskProjects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
        </div>
        <label className="label"><span>Notes / recipe / saved description</span><textarea className="textarea" value={ideaCardDraft.notes ?? ""} onChange={(event) => setIdeaCardDraft({ ...ideaCardDraft, notes: event.target.value })} /></label>
        <label className="check-label"><input type="checkbox" checked={Boolean(ideaPlacementDraft.favorite)} onChange={(event) => setIdeaPlacementDraft({ ...ideaPlacementDraft, favorite: event.target.checked })} /><span>Favorite on this board</span></label>
        <div className="form-actions"><button className="button" type="submit">Save idea</button><button className="ghost-button" type="button" onClick={() => { setShowIdeaCardForm(false); setIdeaCardDraft(blankIdeaCard()); }}>Cancel</button></div>
      </form>
    );
  }

  function renderIdeaCard({ card, placement }: { card: IdeaCard; placement: IdeaBoardPlacement }) {
    const section = placement.sectionId ? state.ideaBoardSections.find((entry) => entry.id === placement.sectionId)?.name : "Unsectioned";
    const similarItems = state.items.filter((item) => normalize(item.name).includes(normalize(card.title)) || normalize(card.title).includes(normalize(item.name))).slice(0, 3);
    const similarCards = state.ideaCards.filter((candidate) => candidate.id !== card.id && !candidate.deletedAt && (normalize(candidate.title) === normalize(card.title) || (card.sourceUrl && candidate.sourceUrl === card.sourceUrl) || signatureSimilarity(candidate.imageSignature, card.imageSignature) > 0.9)).slice(0, 3);
    const target = Number(String(card.targetPrice ?? "").replace(/[$,\s]/g, ""));
    const current = Number(String(card.price ?? "").replace(/[$,\s]/g, ""));
    const targetReached = Number.isFinite(target) && Number.isFinite(current) && current <= target;
    return (
      <article className="idea-card" key={placement.id}>
        {card.imageUrls[0] ? <CloudImage className="idea-card-image" src={card.imageUrls[0]} alt="" /> : <div className="idea-card-image empty-image">{card.contentType}</div>}
        <div className="idea-card-body">
          <div className="card-row"><h3>{card.title}</h3><button className="small-button" onClick={() => toggleIdeaFavorite(placement.id)}>{placement.favorite ? "★" : "☆"}</button></div>
          <p className="meta">{section} · {card.contentType} · {card.status} · {card.priority}</p>
          {card.notes ? <p>{card.notes}</p> : null}
          <div className="token-row">{card.tags.map((tag) => <button className="filter-chip" key={tag} onClick={() => setIdeaTagFilter(tag)}>#{tag}</button>)}</div>
          <div className="idea-facts"><span>{card.storeOrSeller || card.sourceSite || "No source"}</span><span>{card.price ? money(card.price) : "No price"}</span><span>{card.dimensions || "No dimensions"}</span><span>{card.color || "No color"}</span></div>
          {targetReached ? <p className="notice">Target price reached.</p> : null}
          {similarItems.length ? <p className="notice">Already-owned check: similar inventory may exist — {similarItems.map((item) => item.name).join(", ")}.</p> : null}
          {similarCards.length ? <p className="notice">Duplicate check: similar saved ideas — {similarCards.map((idea) => idea.title).join(", ")}.</p> : null}
          {card.colorPalette?.length ? <div className="palette-row" aria-label="Extracted colors">{card.colorPalette.map((color) => <span key={color} title={color} style={{ background: color }} />)}</div> : null}
          {card.availabilityStatus ? <p className="meta">Availability/link note: {card.availabilityStatus}</p> : null}
          {card.fitNotes ? <p className="meta">Fit notes: {card.fitNotes}</p> : null}
          <div className="inline-actions">
            <button className="small-button" onClick={() => openIdeaCardForm(card, placement)}>Edit</button>
            <button className="small-button" onClick={() => updateIdeaCard(card.id, { archivedAt: nowIso() })}>Archive</button>
            <button className="danger-button" onClick={() => deleteIdeaCard(card)}>Delete</button>
            <button className="ghost-button" disabled={Boolean(card.relatedTaskId)} onClick={() => convertIdeaToTask(card)}>{card.relatedTaskId ? "Task linked" : "Make task"}</button>
            <button className="ghost-button" disabled={Boolean(card.relatedOrderEntryId)} onClick={() => convertIdeaToOrder(card)}>{card.relatedOrderEntryId ? "Order linked" : "Make order"}</button>
            <button className="ghost-button" disabled={Boolean(card.relatedItemId)} onClick={() => convertIdeaToInventoryItem(card)}>{card.relatedItemId ? "Item linked" : "Make item"}</button>
            <button className="ghost-button" disabled={Boolean(card.relatedProjectId)} onClick={() => convertIdeaToProject(card)}>{card.relatedProjectId ? "Project linked" : "Make project"}</button>
            <button className="ghost-button" disabled={Boolean(card.relatedCalendarEntryId)} onClick={() => addIdeaCalendarReminder(card)}>{card.relatedCalendarEntryId ? "Reminder linked" : "Add reminder"}</button>
            {card.sourceUrl ? <CloudMediaLink className="small-button link-button" href={card.sourceUrl} target="_blank" rel="noreferrer">Open source</CloudMediaLink> : null}
          </div>
          <label className="label compact-label"><span>Copy to another board</span><select className="field" defaultValue="" onChange={(event) => { copyIdeaToBoard(card.id, event.target.value); event.currentTarget.value = ""; }}><option value="">Choose board</option>{activeIdeaBoards.filter((board) => board.id !== placement.boardId).map((board) => <option value={board.id} key={board.id}>{board.name}</option>)}</select></label>
        </div>
      </article>
    );
  }

  function renderTaskForm() {
    const max = maxStars();
    return (
      <form className="form-panel" onSubmit={saveTask}>
        <h2>{taskDraft.id ? "Edit task" : "Add task"}</h2>
        <p className="muted">Only the task name is required. Use dates, reminders, stars, flags, tags, and projects when they make the task easier to find.</p>
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
            <p className="meta">Choose another task only when this task cannot start until that one is finished.</p>
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
            <p className="meta">Flags are custom visual markers. They do not mean urgent, important, or anything else unless Mom decides that.</p>
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
            <p className="meta">Tags are custom search words for grouping tasks her way.</p>
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
    const activeSequencedTasks = state.tasks.filter((task) => !isFinishedTask(task));
    const activeTaskCount = activeSequencedTasks.length;
    const readySequencedTasks = activeSequencedTasks.filter((task) => !activeBlockers(task).length && task.status !== "Waiting");
    const blockedSequencedTasks = activeSequencedTasks.filter((task) => activeBlockers(task).length);
    const unlockers = activeSequencedTasks
      .map((task) => ({ task, unlocks: activeSequencedTasks.filter((candidate) => (candidate.dependencyIds ?? []).includes(task.id)) }))
      .filter((entry) => entry.unlocks.length)
      .sort((a, b) => b.unlocks.length - a.unlocks.length)
      .slice(0, 6);
    return (
      <div className="project-map">
        <article className="project-card task-flow-card everything-map">
          <div className="section-head compact">
            <div>
              <h3>Everything Map</h3>
              <p className="meta">A household-wide dependency view that explains what is available now, what is waiting, and which tasks unlock other work.</p>
            </div>
          </div>
          <div className="stats-grid mini-stats">
            <div><strong>{activeTaskCount}</strong><span>active tasks</span></div>
            <div><strong>{readySequencedTasks.length}</strong><span>ready now</span></div>
            <div><strong>{blockedSequencedTasks.length}</strong><span>blocked</span></div>
            <div><strong>{unlockers.length}</strong><span>unlock paths</span></div>
          </div>
          {unlockers.length ? (
            <div className="flowchart-preview" aria-label="Task unlock flowchart">
              {unlockers.map(({ task, unlocks }) => unlocks.map((unlock) => <div key={`${task.id}-${unlock.id}`}>{task.title} → {unlock.title}</div>))}
            </div>
          ) : null}
          {unlockers.length ? (
            <div className="flow-list">
              {unlockers.map(({ task, unlocks }) => (
                <div className="flow-row" key={task.id}>
                  <button className="text-button" type="button" onClick={() => openTaskForm(task)}>{task.title}</button>
                  <span>unlocks</span>
                  <strong>{unlocks.map((entry) => entry.title).join(", ")}</strong>
                </div>
              ))}
            </div>
          ) : <p className="meta">No active dependencies yet. Add prerequisites on task cards to build the map.</p>}
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
              {!tasks.length ? <li className="meta">No tasks in this project yet. Add the first task, then add prerequisites only when the order truly matters.</li> : null}
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
            <p className="meta">Loose tasks are okay. Move a task into a project only when it belongs with a larger goal.</p>
            <ol className="sequence-list">
              {orderProjectTasks(showCompletedProjectTasks ? looseTasks : looseTasks.filter((task) => !isFinishedTask(task))).map(renderSequenceTask)}
            </ol>
          </article>
        ) : null}
        {!groups.length && !looseTasks.length ? <div className="empty">No project map yet. Add a task first, then add a project only if several tasks belong together.</div> : null}
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
    const recentEnergyEntries = state.energyJournal.slice(0, 3);
    return (
      <>
      <form className="form-panel" onSubmit={saveEnergyJournal}>
        <h2>Energy journal</h2>
        <p className="muted">This is a private-feeling note for patterns and memory. It does not create tasks, rank tasks, or alert anyone unless Mom asks for that later.</p>
        <div className="form-grid">
          <label className="label">
            <span>Date</span>
            <input className="field" type="date" value={energyDraft.recordedAt ?? todayIso} onChange={(event) => setEnergyDraft({ ...energyDraft, recordedAt: event.target.value })} />
          </label>
          <label className="label">
            <span>Energy / motivation note</span>
            <input className="field" placeholder="Example: tired but okay, focused, low-energy morning" value={energyDraft.energyLabel ?? ""} onChange={(event) => setEnergyDraft({ ...energyDraft, energyLabel: event.target.value })} />
            <span className="hint">Use any words that feel natural. No score is required.</span>
          </label>
          <label className="label">
            <span>Notes</span>
            <textarea className="textarea" placeholder="Optional: sleep, pain, mood, weather, visitors, or anything worth remembering." value={energyDraft.notes ?? ""} onChange={(event) => setEnergyDraft({ ...energyDraft, notes: event.target.value })} />
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
      <div className="panel" style={{ marginTop: 12 }}>
        <div className="section-head">
          <div>
            <h2>Recent energy notes</h2>
            <p className="muted">Shown for memory only. They do not change task suggestions.</p>
          </div>
        </div>
        <div className="grid card-list">
          {recentEnergyEntries.map((entry) => (
            <article className="mini-card" key={entry.id}>
              <div className="card-row">
                <strong>{entry.recordedAt}</strong>
                {entry.energyLabel ? <span className="badge">{entry.energyLabel}</span> : null}
              </div>
              {entry.notes ? <p className="meta">{entry.notes}</p> : null}
            </article>
          ))}
          {!recentEnergyEntries.length ? <div className="empty">No energy notes yet. Add one if it would help Mom remember patterns later.</div> : null}
        </div>
      </div>
      </>
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
            <span className="hint">Large photos are reduced before saving so local backups stay smaller.</span>
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
            <span className="hint">Large photos are reduced before saving so local backups stay smaller.</span>
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
    const hasReceipt = Boolean(purchase.receiptUrl || purchase.receiptPhotoUrl || purchase.receiptText);
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

        {purchase.aiSummary ? <p className="purchase-note"><strong>Local docket:</strong> {purchase.aiSummary} {purchase.aiConfidence ? `(${purchase.aiConfidence} confidence)` : ""}</p> : null}
        {purchase.checkedAt ? <p className="meta">Checked {purchase.checkedAt.slice(0, 10)}</p> : null}
        {purchase.replacementOptions?.length ? (
          <div className="replacement-options">
            {purchase.replacementOptions.map((option) => (
              <span key={option.id}>{option.title} · {option.storeName || "Store unknown"} · {option.estimatedPrice ? money(option.estimatedPrice) : "Price unknown"} · {option.confidence}</span>
            ))}
          </div>
        ) : null}
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
          <button className="small-button" onClick={() => refreshPurchaseIntelligence(purchase)}>Refresh local matches</button>
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
        <p className="muted">A manual receipt line is enough. Links and photos are optional; use the recommendation to remember whether to reorder or compare later.</p>
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
            <span>Receipt or email text</span>
            <textarea className="textarea" value={purchaseDraft.receiptText ?? ""} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, receiptText: event.target.value })} />
            <span className="hint">Paste text here when a screenshot is hard to read. This stays local unless included in a backup.</span>
          </label>
          <label className="label">
            <span>Receipt or order screenshot</span>
            <input className="field" type="file" name="receiptPhoto" accept="image/*" capture="environment" />
            <span className="hint">Large receipt photos are reduced before saving. Keep the link too if you have one.</span>
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
            <span>Local AI-style summary</span>
            <input className="field" value={purchaseDraft.aiSummary ?? ""} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, aiSummary: event.target.value })} />
            <span className="hint">Generated from saved fields, not from a remote AI provider.</span>
          </label>
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
          <button className="ghost-button" onClick={() => downloadText(exportFilename("supplements", "csv"), supplementsToCsv(state.supplementItems, state.supplementLogs), "text/csv")}>Export CSV</button>
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
          <button className="button secondary" onClick={() => downloadText(exportFilename("report", "txt"), buildTextReport(), "text/plain")}>
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

  function renderHelperContactForm() {
    return (
      <form className="form-panel" onSubmit={saveHelperContact}>
        <div className="section-head">
          <div>
            <h2>{editingHelperContactId ? "Edit helper contact" : "Add helper contact"}</h2>
            <p className="muted">Contacts are local. Buttons use this device's Mail or Messages app; Mom Home does not send silently.</p>
          </div>
          <button className="ghost-button" type="button" onClick={() => setShowHelperContactForm(false)}>Close</button>
        </div>
        <div className="form-grid">
          <label className="label"><span>Name</span><input className="field" required value={helperContactDraft.name ?? ""} onChange={(event) => setHelperContactDraft({ ...helperContactDraft, name: event.target.value })} /></label>
          <div className="form-row">
            <label className="label"><span>Phone</span><input className="field" type="tel" value={helperContactDraft.phone ?? ""} onChange={(event) => setHelperContactDraft({ ...helperContactDraft, phone: event.target.value })} /></label>
            <label className="label"><span>Email</span><input className="field" type="email" value={helperContactDraft.email ?? ""} onChange={(event) => setHelperContactDraft({ ...helperContactDraft, email: event.target.value })} /></label>
          </div>
          <label className="label"><span>Relationship / note</span><input className="field" value={helperContactDraft.relationship ?? ""} onChange={(event) => setHelperContactDraft({ ...helperContactDraft, relationship: event.target.value })} /></label>
          <label className="check-label"><input type="checkbox" checked={Boolean(helperContactDraft.preferred)} onChange={(event) => setHelperContactDraft({ ...helperContactDraft, preferred: event.target.checked })} /><span>Preferred helper</span></label>
        </div>
        <div className="inline-actions"><button className="button" type="submit">Save contact</button></div>
      </form>
    );
  }

  function renderHelpRequestForm() {
    return (
      <form className="form-panel" onSubmit={saveHelpRequest}>
        <div className="section-head">
          <div>
            <h2>{editingHelpRequestId ? "Edit help request" : "Ask for help"}</h2>
            <p className="muted">Use this for helper follow-up. It is not an emergency service or automatic dispatch.</p>
          </div>
          <button className="ghost-button" type="button" onClick={() => setShowHelpRequestForm(false)}>Close</button>
        </div>
        <div className="form-grid">
          <label className="label"><span>What is needed?</span><textarea className="textarea title-area" required value={helpRequestDraft.title ?? ""} onChange={(event) => setHelpRequestDraft({ ...helpRequestDraft, title: event.target.value })} /></label>
          <label className="label"><span>Details</span><textarea className="textarea" value={helpRequestDraft.details ?? ""} onChange={(event) => setHelpRequestDraft({ ...helpRequestDraft, details: event.target.value })} /></label>
          <div className="form-row">
            <label className="label"><span>Urgency</span><select className="field" value={helpRequestDraft.urgency ?? "Soon"} onChange={(event) => setHelpRequestDraft({ ...helpRequestDraft, urgency: event.target.value as HelpRequest["urgency"] })}>{["Question", "Soon", "Urgent"].map((urgency) => <option key={urgency}>{urgency}</option>)}</select></label>
            <label className="label"><span>Helper</span><select className="field" value={helpRequestDraft.contactId ?? ""} onChange={(event) => setHelpRequestDraft({ ...helpRequestDraft, contactId: event.target.value })}><option value="">Choose when sending</option>{preferredHelperContacts.map((contact) => <option value={contact.id} key={contact.id}>{helperContactLabel(contact.id)}</option>)}</select></label>
          </div>
          <div className="form-row">
            <label className="label"><span>Related task</span><select className="field" value={helpRequestDraft.relatedTaskId ?? ""} onChange={(event) => setHelpRequestDraft({ ...helpRequestDraft, relatedTaskId: event.target.value })}><option value="">None</option>{state.tasks.map((task) => <option value={task.id} key={task.id}>{task.title}</option>)}</select></label>
            <label className="label"><span>Related order/delivery</span><select className="field" value={helpRequestDraft.relatedOrderEntryId ?? ""} onChange={(event) => setHelpRequestDraft({ ...helpRequestDraft, relatedOrderEntryId: event.target.value })}><option value="">None</option>{state.orderEntries.map((order) => <option value={order.id} key={order.id}>{order.name}</option>)}</select></label>
          </div>
        </div>
        <div className="inline-actions"><button className="button" type="submit">Save help request</button></div>
      </form>
    );
  }

  function renderPurchaseImportForm() {
    return (
      <form className="form-panel" onSubmit={savePurchaseImport}>
        <div className="section-head">
          <div>
            <h3>Add receipt/email text to review queue</h3>
            <p className="muted">Paste a receipt, email, or manual note. Mom Home suggests fields locally; nothing is imported until reviewed.</p>
          </div>
          <button className="ghost-button" type="button" onClick={() => setShowPurchaseImportForm(false)}>Close</button>
        </div>
        <label className="label"><span>Source</span><select className="field" value={purchaseImportDraft.source ?? "Receipt text"} onChange={(event) => setPurchaseImportDraft({ ...purchaseImportDraft, source: event.target.value as PurchaseImportReview["source"] })}>{["Receipt text", "Email text", "Manual note"].map((source) => <option key={source}>{source}</option>)}</select></label>
        <label className="label"><span>Text to review</span><textarea className="textarea" required value={purchaseImportDraft.rawText ?? ""} onChange={(event) => setPurchaseImportDraft({ ...purchaseImportDraft, rawText: event.target.value })} /></label>
        <button className="button" type="submit">Add to review queue</button>
      </form>
    );
  }

  function renderVaultView() {
    return (
      <section className="vault-page">
        <div className="section-head">
          <div>
            <span className="today-eyebrow">Private vault</span>
            <h2>Encrypted local notes</h2>
            <p className="muted">Vault notes are encrypted in this browser before saving. Helpers, cloud handoff, and AI summaries do not receive the plaintext.</p>
          </div>
          <div className="inline-actions"><button className="button" onClick={() => setShowVaultForm(true)}>Add vault note</button><button className="ghost-button" onClick={() => setView("more")}>Back</button></div>
        </div>
        <div className="notice"><strong>Passphrase warning:</strong> If the passphrase is forgotten, Mom Home cannot recover these notes. Export backups still contain only encrypted vault payloads.</div>
        {vaultMessage ? <p className="notice">{vaultMessage}</p> : null}
        {showVaultForm ? (
          <form className="form-panel" onSubmit={saveVaultRecord}>
            <div className="form-grid">
              <label className="label"><span>Title</span><input className="field" required value={vaultDraft.title ?? ""} onChange={(event) => setVaultDraft({ ...vaultDraft, title: event.target.value })} /></label>
              <label className="label"><span>Category</span><select className="field" value={vaultDraft.category ?? "Other"} onChange={(event) => setVaultDraft({ ...vaultDraft, category: event.target.value as VaultRecord["category"] })}>{["Account", "Document", "Medical", "Home", "Other"].map((category) => <option key={category}>{category}</option>)}</select></label>
              <label className="label"><span>Hint visible without passphrase</span><input className="field" value={vaultDraft.noteHint ?? ""} onChange={(event) => setVaultDraft({ ...vaultDraft, noteHint: event.target.value })} /></label>
              <label className="label"><span>Private note</span><textarea className="textarea" required value={vaultPlaintext} onChange={(event) => setVaultPlaintext(event.target.value)} /></label>
              <label className="label"><span>Passphrase</span><input className="field" type="password" minLength={8} required value={vaultPassphrase} onChange={(event) => setVaultPassphrase(event.target.value)} /></label>
            </div>
            <div className="inline-actions"><button className="button" type="submit">Encrypt and save</button><button className="ghost-button" type="button" onClick={() => setShowVaultForm(false)}>Cancel</button></div>
          </form>
        ) : null}
        <div className="grid card-list">
          {state.vaultRecords.map((record) => (
            <article className="mini-card vault-card" key={record.id}>
              <div className="item-title-row"><strong>{record.title}</strong><span className="badge">{record.category}</span></div>
              <p className="meta">{record.noteHint || "No visible hint."} | {record.kdf}</p>
              {unlockedVaultText[record.id] ? <pre className="schema vault-plaintext">{unlockedVaultText[record.id]}</pre> : null}
              <div className="inline-actions"><input className="field compact-pass" type="password" placeholder="Passphrase" value={vaultUnlockPassphrase} onChange={(event) => setVaultUnlockPassphrase(event.target.value)} /><button className="small-button" onClick={() => unlockVaultRecord(record)}>Unlock</button><button className="ghost-button" onClick={() => setUnlockedVaultText((current) => ({ ...current, [record.id]: "" }))}>Lock</button><button className="danger-button" onClick={() => deleteVaultRecord(record.id)}>Delete</button></div>
            </article>
          ))}
          {!state.vaultRecords.length ? <div className="empty">No vault notes yet. Add only information that truly needs extra protection.</div> : null}
        </div>
      </section>
    );
  }

  function renderAlertsView() {
    return (
      <section className="alerts-page">
        <div className="section-head">
          <div>
            <span className="today-eyebrow">Phase 4</span>
            <h2>Help requests & reminders</h2>
            <p className="muted">One place for repeat reminders, delivery watch items, and messages Mom can hand to a helper.</p>
          </div>
          <button className="ghost-button" onClick={() => setView("home")}>Back to Today</button>
        </div>

        <div className="alert-warning">
          <strong>Not for emergencies.</strong> Mom Home can prepare helper text, email, or SMS drafts, but it does not call 911, dispatch help, or guarantee delivery.
          {!state.settings.helperAlertDisclaimerAccepted ? <button className="small-button" onClick={() => setState((current) => ({ ...current, settings: { ...current.settings, helperAlertDisclaimerAccepted: true } }))}>I understand</button> : null}
        </div>

        <div className="quick-actions">
          <button className="button" onClick={() => openHelpRequestForm()}>Ask for help</button>
          <button className="button secondary" onClick={() => openHelpRequestForm(undefined, { urgency: "Urgent", title: "Please check on this now" })}>Urgent helper alert</button>
          <button className="ghost-button" onClick={() => openHelperContactForm()}>Add helper contact</button>
          <button className="ghost-button" onClick={requestNotificationPermission}>Enable device alerts</button>
        </div>
        <p className="meta">Device alert status: {notificationPermission}. Default repeat interval: {state.settings.defaultNagIntervalMinutes} minutes.</p>

        {showHelperContactForm ? renderHelperContactForm() : null}
        {showHelpRequestForm ? renderHelpRequestForm() : null}

        <div className="grid two-col">
          <div className="panel">
            <div className="section-head"><div><h3>Helper contacts</h3><p className="muted">Saved locally for fast SMS/email drafts.</p></div></div>
            <div className="stack-list">
              {preferredHelperContacts.map((contact) => (
                <article className="mini-card" key={contact.id}>
                  <strong>{contact.name}{contact.preferred ? " ★" : ""}</strong>
                  <p className="meta">{[contact.relationship, contact.phone, contact.email].filter(Boolean).join(" | ") || "No phone/email saved yet."}</p>
                  <div className="inline-actions"><button className="small-button" onClick={() => openHelperContactForm(contact)}>Edit</button><button className="ghost-button" onClick={() => deleteHelperContact(contact.id)}>Delete</button></div>
                </article>
              ))}
              {!preferredHelperContacts.length ? <div className="empty">No helper contacts yet. Add one trusted person for faster handoff drafts.</div> : null}
            </div>
          </div>

          <div className="panel">
            <div className="section-head"><div><h3>Open help requests</h3><p className="muted">Copy, email, text, resolve, or keep for later.</p></div></div>
            <div className="stack-list">
              {openHelpRequests.map((request) => (
                <article className={`mini-card ${request.urgency === "Urgent" ? "urgent-card" : ""}`} key={request.id}>
                  <div className="item-title-row"><strong>{request.title}</strong><span className="badge">{request.urgency}</span></div>
                  <p className="meta">{request.details || "No extra details."}</p>
                  <p className="meta">Helper: {helperContactLabel(request.contactId)} | Status: {request.status}</p>
                  <div className="inline-actions">
                    <button className="small-button" onClick={() => copyHelpRequest(request)}>Copy</button>
                    <a className="small-button" href={helpRequestHref(request, "sms")} onClick={() => updateHelpRequestStatus(request, "Sent")}>Text</a>
                    <a className="small-button" href={helpRequestHref(request, "email")} onClick={() => updateHelpRequestStatus(request, "Sent")}>Email</a>
                    <button className="ghost-button" onClick={() => openHelpRequestForm(request)}>Edit</button>
                    <button className="ghost-button" onClick={() => updateHelpRequestStatus(request, "Resolved")}>Resolve</button>
                    <button className="ghost-button" onClick={() => updateHelpRequestStatus(request, "Cancelled")}>Cancel</button>
                  </div>
                </article>
              ))}
              {!openHelpRequests.length ? <div className="empty">No open help requests. Use Ask for help when someone else should step in.</div> : null}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="section-head"><div><h3>Delivery reminder watch</h3><p className="muted">Ordered and purchased items with expected delivery dates are listed here for follow-up.</p></div><button className="ghost-button" onClick={() => { setOrderScope("ordered"); setView("orders"); }}>Open orders</button></div>
          <div className="stack-list">
            {deliveryWatchOrders.map((order) => {
              const late = Boolean(order.expectedDeliveryDate && order.expectedDeliveryDate < todayIso);
              return <article className={`mini-card ${late ? "urgent-card" : ""}`} key={order.id}>
                <div className="item-title-row"><strong>{order.name}</strong><span className="badge">{late ? "Late" : order.expectedDeliveryDate === todayIso ? "Today" : "Watching"}</span></div>
                <p className="meta">Expected: {order.expectedDeliveryDate || "No date"}{order.trackingUrl ? " | Tracking saved" : ""}</p>
                <div className="inline-actions">
                  {order.trackingUrl ? <a className="small-button" href={normalizeWebUrl(order.trackingUrl) ?? order.trackingUrl} target="_blank" rel="noreferrer">Track</a> : null}
                  <button className="small-button" onClick={() => openHelpRequestForm(undefined, { title: `Check delivery: ${order.name}`, details: `Expected delivery: ${order.expectedDeliveryDate || "not set"}.`, relatedOrderEntryId: order.id, urgency: late ? "Soon" : "Question" })}>Ask helper</button>
                </div>
              </article>;
            })}
            {!deliveryWatchOrders.length ? <div className="empty">No active delivery reminders. Add an expected delivery date to an ordered item.</div> : null}
          </div>
        </div>
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
              <button className="small-button" onClick={() => openHelpRequestForm()}>Ask help</button>
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
            calmSound={state.settings.calmSound}
            onChange={(focusSeason) => setState((current) => ({ ...current, focusSeason }))}
            onOpenTask={openTaskForm}
            onOpenCalm={() => setView("calm")}
          />

          {showEnergyForm ? renderEnergyForm() : null}

          <div className="today-footer-actions">
            <button onClick={() => { setTaskScope("quick"); setView("tasks"); }}>Quick wins <strong>{quickWinTasks.length}</strong></button>
            <button onClick={() => setView("calendar")}>Calendar <strong>{dueTodayTasks.length + state.calendarEntries.filter((entry) => calendarEntryOccursOnDate(entry, todayIso)).length}</strong></button>
            <button onClick={() => setView("low")}>Low stock <strong>{lowItems.length}</strong></button>
            <button onClick={() => setView("purchases")}>Purchases <strong>{state.purchaseRecords.length}</strong></button>
            <button onClick={() => setView("calm")}>Calm</button>
            <button onClick={() => setView("alerts")}>Help <strong>{openHelpRequests.length}</strong></button>
          </div>
        </section>
      ) : null}

      {view === "tasks" ? (
        <section>
          <div className="section-head">
            <div>
              <h2>Tasks</h2>
              <p className="muted">Things to do, what matters most, and what has to happen first. Start simple; organization can be added later.</p>
            </div>
            <button className="button" onClick={() => openTaskForm()}>
              Add task
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
                <p className="muted">A planning view for projects and prerequisites. This is for organizing tasks, not a new page Mom has to manage.</p>
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
                <p className="muted">No meanings are preset. Mom defines them, and they can be changed later.</p>
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
              {!state.taskFlags.length && !state.taskTags.length ? <div className="empty">No custom flags or tags yet. Add these only after Mom knows what labels would help her find tasks faster.</div> : null}
            </div>
          </div>
        </section>
      ) : null}

      {view === "ideas" ? (
        <section>
          <div className="section-head">
            <div>
              <h2>Ideas</h2>
              <p className="muted">Pinterest-style planning that stays useful: boards, sections, cards, links, decisions, shopping, tasks, and inventory connections.</p>
            </div>
            <div className="inline-actions">
              <button className="button" onClick={() => openIdeaBoardForm()}>Add board</button>
              <button className="button secondary" disabled={!selectedIdeaBoardId} onClick={() => openIdeaCardForm()}>Add card</button>
            </div>
          </div>

          <div className="ideas-dashboard">
            <article className="stat-card"><span>Active boards</span><strong>{activeIdeaBoards.length}</strong></article>
            <article className="stat-card"><span>Active cards</span><strong>{activeIdeaCards.filter((card) => !card.archivedAt).length}</strong></article>
            <article className="stat-card"><span>Archived</span><strong>{archivedIdeaBoards.length + archivedIdeaCards.length}</strong></article>
            <article className="stat-card"><span>Board estimate</span><strong>{money(String(ideaBoardBudget.total))}</strong></article>
          </div>

          {showIdeaBoardForm ? renderIdeaBoardForm() : null}
          {showIdeaSectionForm ? renderIdeaSectionForm() : null}
          {showIdeaCardForm ? renderIdeaCardForm() : null}

          <div className="panel" style={{ marginTop: 12 }}>
            <div className="section-head">
              <div><h2>Boards</h2><p className="muted">Kitchen Ideas, Garden, Gifts, Recipes, Repairs, Future Purchases, Decorating, Seasonal Plans.</p></div>
            </div>
            <div className="grid card-list">
              {filteredIdeaBoards.map(renderIdeaBoardCard)}
              {!filteredIdeaBoards.length ? <div className="empty">No idea boards yet. Add one board first, then add cards inside it.</div> : null}
            </div>
          </div>

          {selectedIdeaBoard ? (
            <div className="panel idea-board-detail" style={{ marginTop: 12 }}>
              <div className="section-head">
                <div>
                  <span className="cloud-kicker">Selected board</span>
                  <h2>{selectedIdeaBoard.name}</h2>
                  <p className="muted">{selectedIdeaBoard.description || "Collect, compare, and turn ideas into real tasks, orders, inventory, or projects."}</p>
                </div>
                <div className="inline-actions">
                  <button className="button" onClick={() => openIdeaCardForm()}>Add card</button>
                  <button className="button secondary" onClick={() => openIdeaSectionForm()}>Add section</button>
                  <button className="ghost-button" onClick={() => downloadText(exportFilename(`${selectedIdeaBoard.name}-ideas`, "txt"), ideaBoardExportText(selectedIdeaBoard), "text/plain")}>Export board</button>
                  <button className="ghost-button" onClick={() => window.print()}>Print</button>
                </div>
              </div>

              <div className="idea-board-stats">
                <span>Total estimate: <strong>{money(String(ideaBoardBudget.total))}</strong></span>
                <span>Purchased/completed: <strong>{money(String(ideaBoardBudget.purchased))}</strong></span>
                <span>Remaining estimate: <strong>{money(String(ideaBoardBudget.remaining))}</strong></span>
              </div>

              <div className="filters ideas-filters">
                <select className="field" value={ideaStatusFilter} onChange={(event) => setIdeaStatusFilter(event.target.value as typeof ideaStatusFilter)}><option value="All">All statuses</option>{ideaStatuses.map((status) => <option value={status} key={status}>{status}</option>)}</select>
                <select className="field" value={ideaPriorityFilter} onChange={(event) => setIdeaPriorityFilter(event.target.value as typeof ideaPriorityFilter)}><option value="All">All priorities</option>{ideaPriorities.map((priority) => <option value={priority} key={priority}>{priority}</option>)}</select>
                <select className="field" value={ideaContentFilter} onChange={(event) => setIdeaContentFilter(event.target.value as typeof ideaContentFilter)}><option value="All">All types</option>{ideaContentTypes.map((type) => <option value={type} key={type}>{type}</option>)}</select>
                <select className="field" value={ideaTagFilter} onChange={(event) => setIdeaTagFilter(event.target.value)}><option value="">All tags</option>{activeIdeaTags.map((tag) => <option value={tag} key={tag}>{tag}</option>)}</select>
                <select className="field" value={ideaPriceFilter} onChange={(event) => setIdeaPriceFilter(event.target.value as typeof ideaPriceFilter)}><option value="All">All prices</option><option value="Under50">Under $50</option><option value="MissingPrice">Missing price</option></select>
                <select className="field" value={ideaSort} onChange={(event) => setIdeaSort(event.target.value as typeof ideaSort)}><option value="custom">Custom order</option><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="priority">Priority</option><option value="price">Price</option><option value="status">Status</option><option value="updated">Recently updated</option><option value="alpha">Alphabetical</option></select><button className="ghost-button" onClick={resetIdeaFilters}>Reset filters</button>
              </div>

              {selectedIdeaSections.length ? <div className="idea-section-strip">{selectedIdeaSections.map((section) => <span className="filter-chip" key={section.id}>{section.name}<button className="text-button" onClick={() => openIdeaSectionForm(section)}>Edit</button><button className="text-button" onClick={() => deleteIdeaSection(section.id)}>Remove</button></span>)}</div> : <p className="meta">No sections yet. Add sections like Furniture, Lighting, Paint, Storage, Appliances, or Plants if they help.</p>}

              {showIdeaCompare && favoriteIdeaCards.length ? (
                <div className="comparison-table">
                  {favoriteIdeaCards.map(({ card }) => <div key={card.id}><strong>{card.title}</strong><span>{card.price ? money(card.price) : "No price"}</span><span>{card.dimensions || "No dimensions"}</span><span>{card.color || "No color"}</span><span>{card.storeOrSeller || card.sourceSite || "No store"}</span><span>{card.status}</span></div>)}
                </div>
              ) : null}
              {showIdeaCompare && !favoriteIdeaCards.length ? <p className="notice">Favorite up to four cards on this board to compare them.</p> : null}
              <button className="ghost-button" onClick={() => setShowIdeaCompare((current) => !current)}>{showIdeaCompare ? "Hide comparison" : "Compare favorites"}</button>

              <div className="idea-card-grid">
                {ideaBoardCards.map(renderIdeaCard)}
                {!ideaBoardCards.length ? <div className="empty">No cards match this board/filter yet. Add a photo, screenshot, link, note, product, recipe, document, inventory item, task, or project.</div> : null}
              </div>
            </div>
          ) : null}

          <div className="panel" style={{ marginTop: 12 }}>
            <div className="section-head"><div><h2>Smart collections</h2><p className="muted">Automatic views from saved card data.</p></div><button className="ghost-button" onClick={() => setShowIdeaTrash((current) => !current)}>{showIdeaTrash ? "Hide archive/trash" : "Show archive/trash"}</button></div>
            <div className="quick-actions"><button className="filter-chip" onClick={() => { resetIdeaFilters(); setIdeaPriorityFilter("High"); }}>High priority</button><button className="filter-chip" onClick={() => { resetIdeaFilters(); setIdeaStatusFilter("Approved"); }}>Approved not purchased</button><button className="filter-chip" onClick={() => { resetIdeaFilters(); setIdeaPriceFilter("Under50"); }}>Under $50</button><button className="filter-chip" onClick={() => { resetIdeaFilters(); setIdeaPriceFilter("MissingPrice"); }}>Missing prices</button><button className="filter-chip" onClick={() => { resetIdeaFilters(); setIdeaContentFilter("Product"); }}>Products</button></div>
            {showIdeaTrash ? <div className="grid">{state.ideaCards.filter((card) => card.archivedAt || card.deletedAt).map((card) => <article className="mini-card" key={card.id}><strong>{card.title}</strong><p className="meta">{card.deletedAt ? "Deleted" : "Archived"}</p><button className="small-button" onClick={() => updateIdeaCard(card.id, { archivedAt: undefined, deletedAt: undefined })}>Restore</button></article>)}{archivedIdeaBoards.map((board) => <article className="mini-card" key={board.id}><strong>{board.name}</strong><p className="meta">Archived board</p><button className="small-button" onClick={() => restoreIdeaBoard(board.id)}>Restore</button></article>)}</div> : null}
          </div>
        </section>
      ) : null}

      {view === "calendar" ? (
        <section className="calendar-view">
          <div className="section-head calendar-page-head">
            <div>
              <h2>Calendar</h2>
              <p className="muted">Events and dated tasks in one place. Reminders are helpful while the app is open; true background push is later.</p>
            </div>
            <div className="inline-actions">
              <button className="button" onClick={() => openCalendarForm()}>Add event</button>
              <button className="ghost-button" onClick={() => openTaskForm()}>Add task</button>
            </div>
          </div>

          <div className={`calendar-alert-status permission-${notificationPermission}`}>
            <div>
              <strong>{notificationPermission === "granted" ? "Device alerts enabled" : notificationPermission === "denied" ? "Device alerts blocked" : notificationPermission === "unsupported" ? "Device alerts unavailable" : "Device alerts off"}</strong>
              <span>{notificationPermission === "granted" ? "Reminders and repeat alerts run while Mom Home is open." : "Calendar entries still appear normally; alerts can be enabled when needed."}</span>
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
                <button className="small-button" onClick={() => openCalendarForm()}>Add event</button>
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
                {!selectedCalendarEntries.length && !selectedCalendarTasks.length ? <div className="calendar-empty-day">Nothing scheduled. The day is open. Add an event here, or add a due date to a task.</div> : null}
              </div>
            </div>
          </div>

          <div className="panel calendar-upcoming">
            <div className="section-head">
              <div>
                <h2>Coming up</h2>
                <p className="muted">The next twelve events and dated tasks in the next sixty days.</p>
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
              {!upcomingCalendarItems.length ? <div className="empty">Nothing dated in the next sixty days. Add a calendar entry or give a task a due date.</div> : null}
            </div>
          </div>
        </section>
      ) : null}

      {view === "items" ? (
        <section>
          <div className="section-head">
            <div>
              <h2>Inventory</h2>
              <p className="muted">Search, count, and locate household items. Add partial records now; details can be filled in later.</p>
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
            {!filteredItems.length ? (
              <div className="empty">
                {state.items.length ? "No matching items yet. Try All, Low, Out, Too much, or a simpler search word." : "No items yet. Add the first item with only the name and location if that is all you know."}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {view === "low" ? (
        <section>
          <div className="section-head">
            <div>
              <h2>Low stock</h2>
              <p className="muted">Items that are out, running low, or marked as too much so Mom knows what to buy or avoid.</p>
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

          {!lowItems.length ? (
            <div className="empty">Nothing is marked low or out right now. If something should be here, open Inventory and mark it Low, Very low, or Out.</div>
          ) : null}

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
              <p className="muted">Rooms, shelves, closets, and bins. Start with broad places first, then add bins when labels would help.</p>
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
                  <span className="hint">Large bin photos are reduced before saving.</span>
                </label>
                <label className="label">
                  <span>Inside photo</span>
                  <input className="field" type="file" name="insidePhoto" accept="image/*" capture="environment" />
                  <span className="hint">Use this when the inside view helps identify what belongs here.</span>
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
            {!state.locations.length ? <div className="empty">No places yet. Add a room, closet, shelf, or garage area before assigning items to it.</div> : null}
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
                <p className="muted">Print or save a label, then scan it later to reopen this bin and see what belongs inside.</p>
              </div>
            </div>
            <div className="grid">
              {!state.containers.length ? <div className="empty">No bins yet. Add a bin when a container needs a printed label or scan link.</div> : null}
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
                      <p className="meta">Scanning this label opens Mom Home directly to this bin.</p>
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
              <p className="muted">Track what still needs buying, what is on the way, and what has already arrived.</p>
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
              <p className="muted">Use Needed before buying, Ordered or Purchased after checkout, and Received when it arrives.</p>
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
                      Edit order
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
            {!filteredOrders.length ? (
              <div className="empty">
                {state.orderEntries.length
                  ? "No order entries match this filter. Try All, or add a new order from a low-stock item."
                  : "No order entries yet. Add one manually here, or use Add to order from a low-stock or inventory item."}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {view === "purchases" ? (
        <section>
          <div className="section-head">
            <div>
              <h2>Purchases</h2>
              <p className="muted">Saved purchase memory from inventory items: what worked, what to compare, and what to avoid next time.</p>
            </div>
            <div className="inline-actions">
              <button className="ghost-button" onClick={() => setView("more")}>
                Back
              </button>
              <button className="button" onClick={() => setShowPurchaseImportForm(true)}>
                Import text
              </button>
              <button className="ghost-button" onClick={() => downloadText(exportFilename("purchases", "csv"), purchasesToCsv(state.purchaseRecords, state), "text/csv")}>
                Export CSV
              </button>
            </div>
          </div>

          {showPurchaseImportForm ? renderPurchaseImportForm() : null}

          <div className="panel purchase-ai-panel">
            <div className="section-head compact"><div><h3>Purchase AI docket (local)</h3><p className="muted">A local, review-first summary. Provider AI can replace this later without changing the records.</p></div></div>
            <div className="stats-grid mini-stats">
              <div><strong>{purchaseDocket.missingReceipts.length}</strong><span>missing receipts</span></div>
              <div><strong>{purchaseDocket.compareFirst.length}</strong><span>compare first</span></div>
              <div><strong>{purchaseDocket.avoid.length}</strong><span>avoid</span></div>
              <div><strong>{purchaseDocket.unchecked.length}</strong><span>unchecked</span></div>
            </div>
            {state.purchaseImportQueue.filter((entry) => entry.status === "Needs review").length ? (
              <div className="stack-list">
                {state.purchaseImportQueue.filter((entry) => entry.status === "Needs review").map((entry) => (
                  <article className="mini-card" key={entry.id}>
                    <strong>{entry.suggestedProductName || "Imported text"}</strong>
                    <p className="meta">{[entry.source, entry.suggestedStoreName, entry.suggestedTotalPrice ? money(entry.suggestedTotalPrice) : ""].filter(Boolean).join(" | ")}</p>
                    <div className="inline-actions"><button className="small-button" onClick={() => startPurchaseFromImport(entry)}>Review as purchase</button><button className="ghost-button" onClick={() => dismissPurchaseImport(entry.id)}>Dismiss</button></div>
                  </article>
                ))}
              </div>
            ) : <p className="meta">No receipt/email text waiting for review.</p>}
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
            {!filteredPurchases.length ? (
              <div className="empty">
                {state.purchaseRecords.length
                  ? "No purchases match this filter. Try All, or change a saved purchase recommendation from an item record."
                  : "No purchase history yet. Open an inventory item and choose Add purchase to save where it came from."}
              </div>
            ) : null}
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
            <button className="ghost-button" onClick={() => downloadText(exportFilename("supplements", "csv"), supplementsToCsv(state.supplementItems, state.supplementLogs), "text/csv")}>Export CSV</button>
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



      {view === "calm" ? (
        <section className="calm-page">
          <div className="section-head">
            <div>
              <span className="today-eyebrow">Calm</span>
              <h2>Take a quiet minute</h2>
              <p className="muted">A simple screen for a reset, breathing, or waiting for the Focus Season timer. Nothing is logged unless Mom chooses to log energy.</p>
            </div>
            <button className="ghost-button" onClick={() => setView("home")}>Back to Today</button>
          </div>

          <div className="calm-hero" aria-live="polite">
            <div className="calm-orb" />
            <h3>Breathe in. Breathe out.</h3>
            <p>One small next step is enough.</p>
          </div>

          <div className="grid two-col">
            <div className="panel">
              <h3>Sound</h3>
              <label className="label">
                <span>Selected sound</span>
                <select className="field" value={state.settings.calmSound} onChange={(event) => updateCalmSound(event.target.value as CalmSound)}>
                  {calmSounds.map((sound) => <option value={sound} key={sound}>{sound === "silent" ? "Silent" : sound[0].toUpperCase() + sound.slice(1)}</option>)}
                </select>
              </label>
              <div className="inline-actions" style={{ marginTop: 12 }}>
                <button className="button" type="button" onClick={() => playCalmSound(state.settings.calmSound)}>Play sound</button>
                <button className="ghost-button" type="button" onClick={() => updateCalmSound("silent")}>Use silent</button>
              </div>
              <p className="meta">Sounds are generated on this device. If the browser blocks audio, tap Play sound once first.</p>
            </div>

            <div className="panel">
              <h3>Focus timer</h3>
              <p className="muted">Use any timer length from 1 to 180 minutes. The timer keeps its place across refreshes while Mom Home stays on this device.</p>
              <div className="inline-actions">
                {[5, 10, 25, 45].map((minutes) => (
                  <button className="small-button" key={minutes} onClick={() => setState((current) => ({ ...current, focusSeason: { ...current.focusSeason, durationMinutes: minutes, remainingSeconds: minutes * 60, running: false, endsAt: undefined, completedAt: undefined } }))}>{minutes} min</button>
                ))}
              </div>
              <button className="button secondary" style={{ marginTop: 12 }} onClick={() => setView("home")}>Open Focus Season</button>
            </div>
          </div>

          <div className="panel">
            <h3>If Mom feels stuck</h3>
            <div className="quick-actions">
              <button className="button" onClick={() => { setTaskScope("quick"); setView("tasks"); }}>Show quick wins</button>
              <button className="ghost-button" onClick={() => setShowEnergyForm(true)}>Log energy</button>
              <button className="ghost-button" onClick={() => setView("help")}>Open help</button>
            </div>
            {showEnergyForm ? renderEnergyForm() : null}
          </div>
        </section>
      ) : null}

      {view === "alerts" ? renderAlertsView() : null}

      {view === "vault" ? renderVaultView() : null}

      {view === "help" ? <HelpCenter onBack={() => setView("more")} /> : null}

      {view === "more" ? (
        <section className="grid">
          <CloudSettings state={state} onRestore={(cloudState) => setState(migrateState(cloudState))} />

          <ProviderAutomationPanel state={state} />

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
            <label className="label" style={{ marginTop: 12 }}>
              <span>Calm sound</span>
              <select className="field" value={state.settings.calmSound} onChange={(event) => updateCalmSound(event.target.value as CalmSound)}>
                {calmSounds.map((sound) => <option value={sound} key={sound}>{sound === "silent" ? "Silent" : sound[0].toUpperCase() + sound.slice(1)}</option>)}
              </select>
              <span className="hint">Used by the Calm screen and the Focus Season finish sound.</span>
            </label>
            <label className="label" style={{ marginTop: 12 }}>
              <span>Default repeat alert interval</span>
              <select className="field" value={state.settings.defaultNagIntervalMinutes} onChange={(event) => updateDefaultNagIntervalMinutes(Number(event.target.value))}>
                {[5, 10, 15, 30, 60, 120].map((minutes) => <option value={minutes} key={minutes}>{minutes} minutes</option>)}
              </select>
              <span className="hint">Used when a calendar reminder is set to repeat while Mom Home is open.</span>
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
              <button className="ghost-button" onClick={() => downloadText(exportFilename("assistant-docket", "txt"), assistantExportText() || "No priority tasks right now.", "text/plain")}>
                Download text
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="section-head">
              <div>
                <h2>Export</h2>
                <p className="muted">Downloads are safe copies. Use the full JSON backup before big edits, device changes, or restore tests.</p>
              </div>
            </div>
            <p className="meta">Full backup is the most important file. Filenames include today's date so backups are easier to compare later. CSV files are for spreadsheets and checking lists; they are not complete restore files.</p>
            <p className="meta"><strong>Current local backup size:</strong> {localBackupSizeLabel}. {localBackupSizeTone === "attention" ? "Download a backup soon and consider replacing large photos if saving starts failing." : localBackupSizeTone === "watch" ? "Still okay, but photos are the main reason this grows." : "Healthy size for local saving."}</p>
            <div className="quick-actions">
              <button className="button" onClick={() => { setReportScope("all"); setView("report"); }}>
                View printable report
              </button>
              <button className="button secondary" onClick={() => downloadText(exportFilename("report", "txt"), buildTextReport(), "text/plain")}>
                Download report text
              </button>
              <button className="button" onClick={() => downloadJsonBackup()}>
                Download full backup
              </button>
              <button className="button secondary" onClick={() => downloadText(exportFilename("items", "csv"), itemsToCsv(state.items, state.locations, state.containers), "text/csv")}>
                Item data file
              </button>
              <button className="ghost-button" onClick={() => downloadText(exportFilename("purchases", "csv"), purchasesToCsv(state.purchaseRecords, state), "text/csv")}>
                Purchase data file
              </button>
              <button className="ghost-button" onClick={() => downloadText(exportFilename("to-order", "csv"), ordersToCsv(state.orderEntries, state), "text/csv")}>
                To-order data file
              </button>
              <button className="ghost-button" onClick={() => downloadText(exportFilename("tasks", "csv"), tasksToCsv(state.tasks, state.taskFlags, state.taskTags, state.taskProjects), "text/csv")}>
                Task data file
              </button>
              <button className="ghost-button" onClick={() => downloadText(exportFilename("supplements", "csv"), supplementsToCsv(state.supplementItems, state.supplementLogs), "text/csv")}>
                Supplement data file
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="section-head">
              <div>
                <h2>Restore backup</h2>
                <p className="muted">Restore replaces the data in this browser. Choose a file, review it first, then download the current data before replacing anything.</p>
              </div>
            </div>
            <label className="label">
              <span>Backup file</span>
              <input className="field" type="file" accept="application/json,.json" onChange={importBackup} />
              <span className="hint">Selecting a file only opens a review. It does not restore yet.</span>
            </label>
            {backupPreflight ? (
              <div className="backup-preflight">
                <div className="section-head">
                  <div>
                    <span className="cloud-kicker">Review before restore</span>
                    <h3>{backupPreflight.fileName}</h3>
                  </div>
                  <span className="badge low">Review only - not restored yet</span>
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
                  <span>{backupPreflight.state.purchaseImportQueue.length} purchase imports</span>
                  <span>{backupPreflight.state.supplementItems.length} supplements</span>
                  <span>{backupPreflight.state.calendarEntries.length} calendar entries</span>
                  <span>{backupPreflight.state.ideaCards.length} idea cards</span>
                  <span>{backupPreflight.state.helpRequests.length} help requests</span>
                  <span>{backupPreflight.state.vaultRecords.length} vault records</span>
                </div>
                {backupPreflight.warnings.length ? (
                  <ul className="backup-preflight-warnings">
                    {backupPreflight.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                ) : <p className="backup-preflight-clear">This looks like a complete Mom Home backup.</p>}
                <p className="meta"><strong>Before restoring:</strong> download the current data first if there is anything here you may want back.</p>
                <div className="inline-actions">
                  <button className="button secondary" onClick={() => downloadJsonBackup(exportFilename("before-restore", "json"))}>Download current data first</button>
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
              <button className="ghost-button" onClick={() => setView("calm")}>
                Calm screen
              </button>
              <button className="ghost-button" onClick={() => setView("alerts")}>
                Help requests
              </button>
              <button className="ghost-button" onClick={() => setView("items")}>
                Inventory
              </button>
              <button className="ghost-button" onClick={() => setView("ideas")}>
                Ideas
              </button>
              <button className="ghost-button" onClick={() => setView("supplements")}>
                Supplements
              </button>
              <button className="ghost-button" onClick={() => setView("vault")}>
                Private vault
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
          ["ideas", "Ideas"],
          ["more", "More"]
        ].map(([key, label]) => (
          <button key={key} className={`nav-tab ${view === key || (key === "more" && (view === "help" || view === "alerts" || view === "vault")) ? "active" : ""}`} onClick={() => setView(key as View)}>
            {label}
          </button>
        ))}
      </nav> : null}
    </main>
  );
}
