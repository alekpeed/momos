export type View = "home" | "tasks" | "calendar" | "items" | "low" | "places" | "orders" | "purchases" | "supplements" | "more" | "help" | "report";

export type QuantityStatus =
  | "Unknown"
  | "Plenty"
  | "Enough"
  | "Low"
  | "Very low"
  | "Out"
  | "Too much";

export type Condition =
  | "Unknown"
  | "New"
  | "Good"
  | "Used"
  | "Worn"
  | "Damaged"
  | "Broken"
  | "Expired";

export type LocationType =
  | "Room"
  | "Closet"
  | "Cabinet"
  | "Drawer"
  | "Shelf"
  | "Bin"
  | "Box"
  | "Fridge"
  | "Freezer"
  | "Basement area"
  | "Garage area"
  | "Other";

export type Urgency = "Buy now" | "Needed soon" | "Refill when convenient" | "Watch only";
export type OrderStatus = "Needed" | "Ordered" | "Purchased" | "Received" | "Cancelled" | "Not needed anymore";

export type PurchasePreference = "Preferred" | "Acceptable" | "Do not buy again" | "Unknown";
export type ReorderRecommendation = "Reorder same" | "Compare first" | "Substitute okay" | "Avoid" | "Unknown";
export type StarMode = "0-3" | "0-5" | "gold" | "off";
export type TodayLens = "briefing" | "compass" | "radar" | "verb-universe" | "verb-portals" | "last-used";
export type TaskStatus = "Open" | "Doing" | "Waiting" | "Done" | "Skipped" | "Cancelled";
export type TaskEffort = "Tiny" | "Quick win" | "Medium" | "Big project" | "Needs help" | "Unsorted";
export type FlagShape = "Flag" | "Circle" | "Square" | "Diamond" | "Star" | "Heart" | "Custom";
export type CalendarRepeat = "Never" | "Daily" | "Weekly" | "Monthly" | "Yearly";

export type Item = {
  id: string;
  householdId: string;
  locationId: string;
  containerId?: string;
  name: string;
  normalizedName: string;
  category: string;
  brand?: string;
  barcode?: string;
  quantityStatus: QuantityStatus;
  quantityNumber?: string;
  unit?: string;
  condition: Condition;
  notes?: string;
  photoUrl?: string;
  expirationDate?: string;
  preferredStore?: string;
  replacementUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type Location = {
  id: string;
  householdId: string;
  parentLocationId?: string;
  name: string;
  type: LocationType;
  notes?: string;
  photoUrl?: string;
  qrCodeValue: string;
  lastReviewedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type Container = {
  id: string;
  householdId: string;
  locationId: string;
  name: string;
  containerCode: string;
  category: string;
  notes?: string;
  outsidePhotoUrl?: string;
  insidePhotoUrl?: string;
  qrCodeValue: string;
  lastReviewedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type OrderEntry = {
  id: string;
  householdId: string;
  itemId?: string;
  name: string;
  quantity?: string;
  urgency: Urgency;
  preferredBrand?: string;
  preferredStore?: string;
  estimatedPrice?: string;
  replacementUrl?: string;
  orderNumber?: string;
  trackingUrl?: string;
  expectedDeliveryDate?: string;
  orderedAt?: string;
  receivedAt?: string;
  notes?: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseRecord = {
  id: string;
  householdId: string;
  itemId: string;
  purchasedAt?: string;
  storeName?: string;
  sellerName?: string;
  productName: string;
  brand?: string;
  quantityPurchased?: string;
  unitSize?: string;
  totalPrice?: string;
  unitPrice?: string;
  productUrl?: string;
  receiptUrl?: string;
  receiptPhotoUrl?: string;
  orderNumber?: string;
  notes?: string;
  purchasePreference: PurchasePreference;
  reorderRecommendation: ReorderRecommendation;
  createdAt: string;
  updatedAt: string;
};

export type TaskFlag = {
  id: string;
  householdId: string;
  name: string;
  color: string;
  shape: FlagShape;
  symbol?: string;
  meaning?: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskProject = {
  id: string;
  householdId: string;
  name: string;
  color?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskTag = {
  id: string;
  householdId: string;
  name: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
};

export type CommandTask = {
  id: string;
  householdId: string;
  title: string;
  notes?: string;
  status: TaskStatus;
  starCount: number;
  flagIds: string[];
  tagIds: string[];
  dueDate?: string;
  reminderAt?: string;
  effort: TaskEffort;
  projectId?: string;
  dependencyIds: string[];
  relatedItemId?: string;
  relatedOrderEntryId?: string;
  relatedPurchaseRecordId?: string;
  helpRequested: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CalendarEntry = {
  id: string;
  householdId: string;
  title: string;
  notes?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  location?: string;
  color: string;
  repeat: CalendarRepeat;
  repeatUntil?: string;
  reminderMinutesBefore?: number;
  nagEnabled: boolean;
  nagIntervalMinutes?: number;
  linkedTaskId?: string;
  createdAt: string;
  updatedAt: string;
};

export type EnergyJournalEntry = {
  id: string;
  householdId: string;
  recordedAt: string;
  energyLabel?: string;
  notes?: string;
  createdAt: string;
};

export type SupplementItem = {
  id: string;
  householdId: string;
  name: string;
  brand?: string;
  bottlePhotoUrl?: string;
  doseInstructions?: string;
  pillsPerBottle?: string;
  pillsRemaining?: string;
  reorderThreshold?: string;
  preferredStore?: string;
  productUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type SupplementLog = {
  id: string;
  householdId: string;
  supplementItemId: string;
  takenAt: string;
  amountTaken?: string;
  notes?: string;
  createdAt: string;
};

export type AppSettings = {
  starMode: StarMode;
  todayLens: TodayLens;
};

export type FocusSeason = {
  durationMinutes: number;
  remainingSeconds: number;
  running: boolean;
  taskId?: string;
  endsAt?: string;
  completedAt?: string;
};

export type AppState = {
  household: {
    id: string;
    name: string;
    ownerName: string;
    setupComplete: boolean;
  };
  items: Item[];
  locations: Location[];
  containers: Container[];
  orderEntries: OrderEntry[];
  purchaseRecords: PurchaseRecord[];
  tasks: CommandTask[];
  calendarEntries: CalendarEntry[];
  taskProjects: TaskProject[];
  taskFlags: TaskFlag[];
  taskTags: TaskTag[];
  energyJournal: EnergyJournalEntry[];
  supplementItems: SupplementItem[];
  supplementLogs: SupplementLog[];
  focusSeason: FocusSeason;
  settings: AppSettings;
};
