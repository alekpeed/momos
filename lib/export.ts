import type {
  AppState,
  CommandTask,
  Container,
  Item,
  Location,
  OrderEntry,
  PurchaseRecord,
  SupplementItem,
  SupplementLog,
  TaskFlag,
  TaskProject,
  TaskTag
} from "./inventory-types";

function csvCell(value?: string) {
  const safe = value ?? "";
  return `"${safe.replaceAll('"', '""')}"`;
}

export function downloadText(filename: string, text: string, type: string) {
  const payload = type === "text/csv" ? `\uFEFF${text}` : text;
  const blob = new Blob([payload], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function itemsToCsv(items: Item[], locations: Location[], containers: Container[]) {
  const header = [
    "name",
    "category",
    "location",
    "container",
    "quantity_status",
    "quantity_number",
    "unit",
    "condition",
    "notes",
    "preferred_store"
  ];
  const rows = items.map((item) => [
    item.name,
    item.category,
    locations.find((location) => location.id === item.locationId)?.name ?? "",
    containers.find((container) => container.id === item.containerId)?.name ?? "",
    item.quantityStatus,
    item.quantityNumber ?? "",
    item.unit ?? "",
    item.condition,
    item.notes ?? "",
    item.preferredStore ?? ""
  ]);
  return ["sep=,", header, ...rows].map((row) => (Array.isArray(row) ? row.map(csvCell).join(",") : row)).join("\n");
}

export function purchasesToCsv(purchases: PurchaseRecord[], state: AppState) {
  const header = [
    "item",
    "product_name",
    "store_or_vendor",
    "seller",
    "brand",
    "purchase_date",
    "order_number",
    "quantity",
    "unit_size",
    "total_price",
    "unit_price",
    "product_url",
    "receipt_url",
    "receipt_photo_saved",
    "preference",
    "reorder_recommendation",
    "notes"
  ];
  const rows = purchases.map((purchase) => [
    state.items.find((item) => item.id === purchase.itemId)?.name ?? "",
    purchase.productName,
    purchase.storeName ?? "",
    purchase.sellerName ?? "",
    purchase.brand ?? "",
    purchase.purchasedAt ?? "",
    purchase.orderNumber ?? "",
    purchase.quantityPurchased ?? "",
    purchase.unitSize ?? "",
    purchase.totalPrice ?? "",
    purchase.unitPrice ?? "",
    purchase.productUrl ?? "",
    purchase.receiptUrl ?? "",
    purchase.receiptPhotoUrl ? "yes" : "no",
    purchase.purchasePreference,
    purchase.reorderRecommendation,
    purchase.notes ?? ""
  ]);
  return ["sep=,", header, ...rows].map((row) => (Array.isArray(row) ? row.map(csvCell).join(",") : row)).join("\n");
}

export function ordersToCsv(orders: OrderEntry[], state: AppState) {
  const header = [
    "item",
    "quantity",
    "status",
    "urgency",
    "store_or_vendor",
    "preferred_brand",
    "estimated_price",
    "product_url",
    "order_number",
    "tracking_url",
    "expected_delivery_date",
    "ordered_at",
    "received_at",
    "notes"
  ];
  const rows = orders.map((order) => [
    order.name,
    order.quantity ?? "",
    order.status,
    order.urgency,
    order.preferredStore ?? "",
    order.preferredBrand ?? "",
    order.estimatedPrice ?? "",
    order.replacementUrl ?? "",
    order.orderNumber ?? "",
    order.trackingUrl ?? "",
    order.expectedDeliveryDate ?? "",
    order.orderedAt ?? "",
    order.receivedAt ?? "",
    order.notes ?? ""
  ]);
  return ["sep=,", header, ...rows].map((row) => (Array.isArray(row) ? row.map(csvCell).join(",") : row)).join("\n");
}

export function tasksToCsv(tasks: CommandTask[], flags: TaskFlag[], tags: TaskTag[], projects: TaskProject[] = []) {
  const header = [
    "title",
    "status",
    "stars",
    "project",
    "blocked_by",
    "flags",
    "tags",
    "due_date",
    "effort",
    "help_requested",
    "notes"
  ];
  const rows = tasks.map((task) => [
    task.title,
    task.status,
    String(task.starCount),
    projects.find((project) => project.id === task.projectId)?.name ?? "",
    task.dependencyIds.map((id) => tasks.find((entry) => entry.id === id)?.title ?? "").filter(Boolean).join("; "),
    task.flagIds.map((id) => flags.find((flag) => flag.id === id)?.name ?? "").filter(Boolean).join("; "),
    task.tagIds.map((id) => tags.find((tag) => tag.id === id)?.name ?? "").filter(Boolean).join("; "),
    task.dueDate ?? "",
    task.effort,
    task.helpRequested ? "yes" : "no",
    task.notes ?? ""
  ]);
  return ["sep=,", header, ...rows].map((row) => (Array.isArray(row) ? row.map(csvCell).join(",") : row)).join("\n");
}

export function supplementsToCsv(supplements: SupplementItem[], logs: SupplementLog[]) {
  const header = [
    "name",
    "brand",
    "dose_instructions",
    "pills_per_bottle",
    "pills_remaining",
    "reorder_threshold",
    "preferred_store",
    "product_url",
    "times_taken_logged",
    "last_taken",
    "notes"
  ];
  const rows = supplements.map((supplement) => {
    const supplementLogs = logs
      .filter((log) => log.supplementItemId === supplement.id)
      .sort((a, b) => b.takenAt.localeCompare(a.takenAt));
    return [
      supplement.name,
      supplement.brand ?? "",
      supplement.doseInstructions ?? "",
      supplement.pillsPerBottle ?? "",
      supplement.pillsRemaining ?? "",
      supplement.reorderThreshold ?? "",
      supplement.preferredStore ?? "",
      supplement.productUrl ?? "",
      String(supplementLogs.length),
      supplementLogs[0]?.takenAt ?? "",
      supplement.notes ?? ""
    ];
  });
  return ["sep=,", header, ...rows].map((row) => (Array.isArray(row) ? row.map(csvCell).join(",") : row)).join("\n");
}
