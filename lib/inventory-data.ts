import { format } from "date-fns";
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
  Urgency
} from "./inventory-types";
import { todayInterfaceOptions } from "./today-interface-registry";

export const STORAGE_KEY = "mom-inventory-state-v1";
export const HOUSEHOLD_ID = "household-demo";

export const categories = [
  "Pantry",
  "Refrigerator",
  "Freezer",
  "Cleaning supplies",
  "Paper goods",
  "Toiletries",
  "Medicine / health",
  "Kitchenware",
  "Appliances",
  "Tools",
  "Hardware",
  "Batteries",
  "Light bulbs",
  "Electronics",
  "Cables / chargers",
  "Linens",
  "Seasonal items",
  "Emergency supplies",
  "Documents / manuals",
  "Miscellaneous"
];

export const quantityStatuses: QuantityStatus[] = ["Unknown", "Plenty", "Enough", "Low", "Very low", "Out", "Too much"];
export const conditionValues: Condition[] = ["Unknown", "New", "Good", "Used", "Worn", "Damaged", "Broken", "Expired"];
export const locationTypes: LocationType[] = [
  "Room",
  "Closet",
  "Cabinet",
  "Drawer",
  "Shelf",
  "Bin",
  "Box",
  "Fridge",
  "Freezer",
  "Basement area",
  "Garage area",
  "Other"
];
export const urgencies: Urgency[] = ["Buy now", "Needed soon", "Refill when convenient", "Watch only"];
export const orderStatuses: OrderStatus[] = ["Needed", "Ordered", "Purchased", "Received", "Cancelled", "Not needed anymore"];
export const purchasePreferences: PurchasePreference[] = ["Preferred", "Acceptable", "Do not buy again", "Unknown"];
export const reorderRecommendations: ReorderRecommendation[] = ["Reorder same", "Compare first", "Substitute okay", "Avoid", "Unknown"];
export const starModes: StarMode[] = ["0-3", "0-5", "gold", "off"];
export const todayLenses: TodayLens[] = [...todayInterfaceOptions.map((option) => option.id), "last-used"];
export const taskStatuses: TaskStatus[] = ["Open", "Doing", "Waiting", "Done", "Skipped", "Cancelled"];
export const taskEfforts: TaskEffort[] = ["Unsorted", "Tiny", "Quick win", "Medium", "Big project", "Needs help"];
export const flagShapes: FlagShape[] = ["Flag", "Circle", "Square", "Diamond", "Star", "Heart", "Custom"];
export const calendarRepeats: CalendarRepeat[] = ["Never", "Daily", "Weekly", "Monthly", "Yearly"];

export const nowIso = () => new Date().toISOString();
export const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
export const normalize = (value: string) => value.trim().toLowerCase();

export const blankItem = (locations: Location[]): Partial<Item> => ({
  name: "",
  category: "Miscellaneous",
  locationId: locations[0]?.id ?? "",
  containerId: "",
  quantityStatus: "Unknown",
  condition: "Unknown",
  notes: ""
});

export const blankLocation = (): Partial<Location> => ({
  name: "",
  type: "Room",
  parentLocationId: "",
  notes: ""
});

export const blankContainer = (locations: Location[]): Partial<Container> => ({
  name: "",
  containerCode: "",
  category: "Miscellaneous",
  locationId: locations[0]?.id ?? "",
  notes: ""
});

export const blankOrder = (): Partial<OrderEntry> => ({
  name: "",
  quantity: "",
  urgency: "Needed soon",
  preferredStore: "",
  status: "Needed",
  orderNumber: "",
  trackingUrl: "",
  expectedDeliveryDate: "",
  notes: ""
});

export const blankPurchase = (item?: Item): Partial<PurchaseRecord> => ({
  itemId: item?.id ?? "",
  productName: item?.name ?? "",
  storeName: item?.preferredStore ?? "",
  sellerName: "",
  brand: item?.brand ?? "",
  purchasedAt: new Date().toISOString().slice(0, 10),
  orderNumber: "",
  purchasePreference: "Unknown",
  reorderRecommendation: "Compare first"
});

export const blankTask = (): Partial<CommandTask> => ({
  title: "",
  notes: "",
  status: "Open",
  starCount: 0,
  flagIds: [],
  tagIds: [],
  dueDate: "",
  effort: "Unsorted",
  projectId: "",
  dependencyIds: [],
  helpRequested: false
});

export const blankCalendarEntry = (date?: string): Partial<CalendarEntry> => ({
  title: "",
  date: date || format(new Date(), "yyyy-MM-dd"),
  startTime: "09:00",
  endTime: "",
  allDay: false,
  location: "",
  color: "#37685f",
  repeat: "Never",
  repeatUntil: "",
  reminderMinutesBefore: 30,
  nagEnabled: false,
  nagIntervalMinutes: 15,
  linkedTaskId: "",
  notes: ""
});

export const blankTaskProject = (): Partial<TaskProject> => ({
  name: "",
  color: "#37685f",
  notes: ""
});

export const blankTaskFlag = (): Partial<TaskFlag> => ({
  name: "",
  color: "#37685f",
  shape: "Flag",
  meaning: ""
});

export const blankTaskTag = (): Partial<TaskTag> => ({
  name: "",
  color: ""
});

export const blankEnergyJournalEntry = (): Partial<EnergyJournalEntry> => ({
  recordedAt: new Date().toISOString().slice(0, 10),
  energyLabel: "",
  notes: ""
});

export const blankSupplementItem = (): Partial<SupplementItem> => ({
  name: "",
  brand: "",
  doseInstructions: "",
  pillsPerBottle: "",
  pillsRemaining: "",
  reorderThreshold: "",
  preferredStore: "",
  productUrl: "",
  notes: ""
});

export const blankSupplementLog = (supplement?: SupplementItem): Partial<SupplementLog> => ({
  supplementItemId: supplement?.id ?? "",
  takenAt: new Date().toISOString().slice(0, 16),
  amountTaken: "1",
  notes: ""
});

export function seedState(): AppState {
  const now = nowIso();
  const kitchen: Location = {
    id: "loc-kitchen",
    householdId: HOUSEHOLD_ID,
    name: "Kitchen",
    type: "Room",
    notes: "Main kitchen area.",
    qrCodeValue: "mom-inventory://location/loc-kitchen",
    createdAt: now,
    updatedAt: now
  };
  const pantry: Location = {
    id: "loc-pantry",
    householdId: HOUSEHOLD_ID,
    parentLocationId: kitchen.id,
    name: "Kitchen pantry",
    type: "Closet",
    notes: "Good first area for a quick inventory pass.",
    qrCodeValue: "mom-inventory://location/loc-pantry",
    lastReviewedAt: now.slice(0, 10),
    createdAt: now,
    updatedAt: now
  };
  const basement: Location = {
    id: "loc-basement",
    householdId: HOUSEHOLD_ID,
    name: "Basement storage shelves",
    type: "Basement area",
    qrCodeValue: "mom-inventory://location/loc-basement",
    createdAt: now,
    updatedAt: now
  };
  const bin: Container = {
    id: "con-b04",
    householdId: HOUSEHOLD_ID,
    locationId: basement.id,
    name: "Basement Bin B-04",
    containerCode: "B-04",
    category: "Seasonal items",
    notes: "Christmas lights, spare candles, extension cords.",
    qrCodeValue: "mom-inventory://container/B-04",
    lastReviewedAt: now.slice(0, 10),
    createdAt: now,
    updatedAt: now
  };
  const starterProject: TaskProject = {
    id: "project-pantry-reset",
    householdId: HOUSEHOLD_ID,
    name: "Pantry reset",
    color: "#37685f",
    notes: "Example project showing how tasks can belong to a larger household effort.",
    createdAt: now,
    updatedAt: now
  };

  return {
    household: {
      id: HOUSEHOLD_ID,
      name: "Mom's House",
      ownerName: "Mom",
      setupComplete: true
    },
    locations: [kitchen, pantry, basement],
    containers: [bin],
    items: [
      {
        id: "item-paper-towels",
        householdId: HOUSEHOLD_ID,
        locationId: pantry.id,
        name: "Paper towels",
        normalizedName: "paper towels",
        category: "Paper goods",
        quantityStatus: "Low",
        quantityNumber: "1",
        unit: "roll",
        condition: "Good",
        notes: "Add to Costco or grocery order.",
        preferredStore: "Costco",
        createdAt: now,
        updatedAt: now
      },
      {
        id: "item-aa-batteries",
        householdId: HOUSEHOLD_ID,
        locationId: basement.id,
        containerId: bin.id,
        name: "AA batteries",
        normalizedName: "aa batteries",
        category: "Batteries",
        quantityStatus: "Enough",
        quantityNumber: "2",
        unit: "packs",
        condition: "New",
        notes: "In basement bin B-04.",
        createdAt: now,
        updatedAt: now
      },
      {
        id: "item-glass-cleaner",
        householdId: HOUSEHOLD_ID,
        locationId: pantry.id,
        name: "Glass cleaner",
        normalizedName: "glass cleaner",
        category: "Cleaning supplies",
        quantityStatus: "Too much",
        quantityNumber: "4",
        unit: "bottles",
        condition: "Good",
        notes: "Do not buy more right now.",
        createdAt: now,
        updatedAt: now
      }
    ],
    orderEntries: [
      {
        id: "order-paper-towels",
        householdId: HOUSEHOLD_ID,
        itemId: "item-paper-towels",
        name: "Paper towels",
        quantity: "1 large pack",
        urgency: "Needed soon",
        preferredStore: "Costco",
        status: "Needed",
        createdAt: now,
        updatedAt: now
      }
    ],
    purchaseRecords: [
      {
        id: "purchase-paper-towels",
        householdId: HOUSEHOLD_ID,
        itemId: "item-paper-towels",
        purchasedAt: "2026-06-12",
        storeName: "Costco",
        productName: "Paper towels large pack",
        quantityPurchased: "1",
        unitSize: "12 rolls",
        totalPrice: "24.99",
        notes: "Good value. Reorder this if available.",
        purchasePreference: "Preferred",
        reorderRecommendation: "Reorder same",
        createdAt: now,
        updatedAt: now
      }
    ],
    tasks: [
      {
        id: "task-review-pantry",
        householdId: HOUSEHOLD_ID,
        title: "Review one pantry shelf",
        notes: "A starter task. Edit or delete it when Mom defines her own system.",
        status: "Open",
        starCount: 1,
        flagIds: [],
        tagIds: [],
        dueDate: now.slice(0, 10),
        effort: "Quick win",
        projectId: starterProject.id,
        dependencyIds: [],
        relatedItemId: "item-paper-towels",
        helpRequested: false,
        createdAt: now,
        updatedAt: now
      }
    ],
    calendarEntries: [],
    taskProjects: [starterProject],
    taskFlags: [],
    taskTags: [],
    energyJournal: [],
    supplementItems: [
      {
        id: "supp-vitamin-d",
        householdId: HOUSEHOLD_ID,
        name: "Vitamin D",
        brand: "",
        doseInstructions: "Example only. Replace with Mom's actual bottle directions.",
        pillsPerBottle: "120",
        pillsRemaining: "30",
        reorderThreshold: "14",
        preferredStore: "",
        notes: "Starter supplement record. Edit or delete it.",
        createdAt: now,
        updatedAt: now
      }
    ],
    supplementLogs: [],
    focusSeason: {
      durationMinutes: 25,
      remainingSeconds: 25 * 60,
      running: false
    },
    settings: {
      starMode: "0-5",
      todayLens: "briefing"
    }
  };
}

export function migrateState(input: unknown): AppState {
  const fallback = seedState();
  if (!input || typeof input !== "object") return fallback;
  const partial = input as Partial<AppState>;
  const tasks = Array.isArray(partial.tasks)
    ? partial.tasks.map((task) => ({
        ...task,
        flagIds: Array.isArray(task.flagIds) ? task.flagIds : [],
        tagIds: Array.isArray(task.tagIds) ? task.tagIds : [],
        dependencyIds: Array.isArray(task.dependencyIds) ? task.dependencyIds : []
      }))
    : fallback.tasks;
  const purchaseRecords = Array.isArray(partial.purchaseRecords)
    ? partial.purchaseRecords.map((purchase) => ({
        ...purchase,
        purchasePreference: purchase.purchasePreference ?? "Unknown",
        reorderRecommendation: purchase.reorderRecommendation ?? "Compare first"
      }))
    : [];
  const orderEntries = Array.isArray(partial.orderEntries)
    ? partial.orderEntries.map((entry) => ({
        ...entry,
        status: entry.status ?? "Needed",
        createdAt: entry.createdAt ?? nowIso(),
        updatedAt: entry.updatedAt ?? entry.createdAt ?? nowIso()
      }))
    : fallback.orderEntries;
  const storedFocusSeason = partial.focusSeason;
  const durationMinutes = Number(storedFocusSeason?.durationMinutes);
  const remainingSeconds = Number(storedFocusSeason?.remainingSeconds);
  const focusSeason = {
    ...fallback.focusSeason,
    ...(storedFocusSeason ?? {}),
    durationMinutes: Number.isFinite(durationMinutes) && durationMinutes >= 1 && durationMinutes <= 180 ? Math.round(durationMinutes) : fallback.focusSeason.durationMinutes,
    remainingSeconds: Number.isFinite(remainingSeconds) && remainingSeconds >= 0 ? Math.round(remainingSeconds) : fallback.focusSeason.remainingSeconds,
    running: Boolean(storedFocusSeason?.running),
    taskId: storedFocusSeason?.taskId || undefined,
    endsAt: storedFocusSeason?.endsAt || undefined,
    completedAt: storedFocusSeason?.completedAt || undefined
  };
  return {
    ...fallback,
    ...partial,
    household: { ...fallback.household, ...(partial.household ?? {}) },
    items: Array.isArray(partial.items) ? partial.items : fallback.items,
    locations: Array.isArray(partial.locations) ? partial.locations : fallback.locations,
    containers: Array.isArray(partial.containers) ? partial.containers : fallback.containers,
    orderEntries,
    purchaseRecords,
    tasks,
    calendarEntries: Array.isArray(partial.calendarEntries)
      ? partial.calendarEntries.map((entry) => ({
          ...entry,
          color: entry.color || "#37685f",
          repeat: entry.repeat || "Never",
          allDay: Boolean(entry.allDay),
          nagEnabled: Boolean(entry.nagEnabled)
        }))
      : [],
    taskProjects: Array.isArray(partial.taskProjects) ? partial.taskProjects : fallback.taskProjects,
    taskFlags: Array.isArray(partial.taskFlags) ? partial.taskFlags : [],
    taskTags: Array.isArray(partial.taskTags) ? partial.taskTags : [],
    energyJournal: Array.isArray(partial.energyJournal) ? partial.energyJournal : [],
    supplementItems: Array.isArray(partial.supplementItems) ? partial.supplementItems : fallback.supplementItems,
    supplementLogs: Array.isArray(partial.supplementLogs) ? partial.supplementLogs : [],
    focusSeason,
    settings: { ...fallback.settings, ...(partial.settings ?? {}) }
  };
}

export function getLastPurchase(itemId: string, purchases: PurchaseRecord[]) {
  return purchases
    .filter((purchase) => purchase.itemId === itemId)
    .sort((a, b) => (b.purchasedAt ?? b.createdAt).localeCompare(a.purchasedAt ?? a.createdAt))[0];
}

export function getPurchasePriceSummary(itemId: string, purchases: PurchaseRecord[]) {
  const itemPurchases = purchases.filter((purchase) => purchase.itemId === itemId);
  const pricedPurchases = itemPurchases
    .map((purchase) => ({ purchase, price: Number(String(purchase.totalPrice ?? "").replace(/[$,\s]/g, "")) }))
    .filter((entry) => Number.isFinite(entry.price));
  const lowest = [...pricedPurchases].sort((a, b) => a.price - b.price)[0];
  return {
    purchaseCount: itemPurchases.length,
    pricedPurchaseCount: pricedPurchases.length,
    lowestPurchase: lowest?.purchase,
    lowestPrice: lowest?.price
  };
}

const CAMERA_IMAGE_MAX_EDGE = 1920;
const CAMERA_IMAGE_MIN_BYTES = 1024 * 1024;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImageFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The image could not be read."));
    };
    image.src = url;
  });
}

async function compactCameraImage(file: File) {
  const original = await readFileAsDataUrl(file);
  const image = await loadImageFile(file);
  const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, CAMERA_IMAGE_MAX_EDGE / longestEdge);

  if (scale === 1 && file.size < CAMERA_IMAGE_MIN_BYTES) return original;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) return original;

  const isPng = file.type === "image/png";
  if (!isPng) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const compacted = canvas.toDataURL(isPng ? "image/png" : "image/jpeg", isPng ? undefined : 0.82);
  return compacted.length < original.length ? compacted : original;
}

export async function fileToDataUrl(file?: File) {
  if (!file) return undefined;
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return readFileAsDataUrl(file);
  }

  try {
    return await compactCameraImage(file);
  } catch {
    // A browser may not be able to draw every camera format, especially HEIC.
    return readFileAsDataUrl(file);
  }
}
