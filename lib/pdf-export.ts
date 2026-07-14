import type { SupplementItem, SupplementLog } from "./inventory-types";

function displayDateTime(value?: string) {
  if (!value) return "Not logged";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.replace("T", " ") : date.toLocaleString();
}

export async function downloadSupplementsPdf(
  supplements: SupplementItem[],
  logs: SupplementLog[],
  householdName: string
) {
  const { jsPDF } = await import("jspdf");
  const document = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 46;
  const contentWidth = pageWidth - margin * 2;
  const generatedAt = new Date().toLocaleString();
  const lowCount = supplements.filter((supplement) => {
    const remaining = Number(supplement.pillsRemaining);
    const threshold = Number(supplement.reorderThreshold);
    return Number.isFinite(remaining) && Number.isFinite(threshold) && threshold > 0 && remaining <= threshold;
  }).length;
  let y = margin;

  const addFooter = () => {
    const pages = document.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      document.setPage(page);
      document.setDrawColor(216, 222, 227);
      document.line(margin, pageHeight - 32, pageWidth - margin, pageHeight - 32);
      document.setFont("helvetica", "normal");
      document.setFontSize(8);
      document.setTextColor(102, 115, 111);
      document.text(`Mom Home | Supplements | Page ${page} of ${pages}`, margin, pageHeight - 18);
      document.text(generatedAt, pageWidth - margin, pageHeight - 18, { align: "right" });
    }
  };

  const newPage = () => {
    document.addPage();
    y = margin;
  };

  const ensureSpace = (height: number) => {
    if (y + height > pageHeight - 52) newPage();
  };

  const addWrapped = (text: string, x: number, width: number, lineHeight = 13) => {
    const lines = document.splitTextToSize(text, width) as string[];
    document.text(lines, x, y);
    y += lines.length * lineHeight;
  };

  document.setFillColor(37, 80, 71);
  document.rect(0, 0, pageWidth, 102, "F");
  document.setTextColor(255, 255, 255);
  document.setFont("helvetica", "bold");
  document.setFontSize(22);
  document.text("Supplement Report", margin, 48);
  document.setFont("helvetica", "normal");
  document.setFontSize(10);
  document.text(householdName, margin, 68);
  document.text("Bottle inventory and taken history. Not medical advice.", margin, 84);
  y = 126;

  const stats = [
    [String(supplements.length), "Tracked bottles"],
    [String(lowCount), "Low bottles"],
    [String(logs.length), "Taken logs"]
  ];
  const statGap = 8;
  const statWidth = (contentWidth - statGap * 2) / 3;
  stats.forEach(([value, label], index) => {
    const x = margin + index * (statWidth + statGap);
    document.setFillColor(247, 248, 245);
    document.setDrawColor(216, 222, 227);
    document.roundedRect(x, y, statWidth, 50, 4, 4, "FD");
    document.setTextColor(31, 42, 39);
    document.setFont("helvetica", "bold");
    document.setFontSize(16);
    document.text(value, x + 10, y + 21);
    document.setTextColor(102, 115, 111);
    document.setFontSize(8);
    document.text(label, x + 10, y + 38);
  });
  y += 76;

  document.setTextColor(31, 42, 39);
  document.setFont("helvetica", "bold");
  document.setFontSize(14);
  document.text("Bottle inventory", margin, y);
  y += 18;

  if (!supplements.length) {
    document.setFont("helvetica", "normal");
    document.setFontSize(10);
    document.setTextColor(102, 115, 111);
    document.text("No supplements have been added.", margin, y);
    y += 20;
  }

  supplements.forEach((supplement) => {
    const supplementLogs = logs
      .filter((log) => log.supplementItemId === supplement.id)
      .sort((a, b) => b.takenAt.localeCompare(a.takenAt));
    const remaining = Number(supplement.pillsRemaining);
    const threshold = Number(supplement.reorderThreshold);
    const isLow = Number.isFinite(remaining) && Number.isFinite(threshold) && threshold > 0 && remaining <= threshold;
    const details = [
      `Brand: ${supplement.brand || "Not entered"}`,
      `Remaining: ${supplement.pillsRemaining || "Not counted"}`,
      `Bottle size: ${supplement.pillsPerBottle || "Not entered"}`,
      `Reorder at: ${supplement.reorderThreshold || "Not set"}`,
      `Last logged: ${displayDateTime(supplementLogs[0]?.takenAt)}`,
      `Preferred store: ${supplement.preferredStore || "Not entered"}`
    ];
    const extraLines = [
      supplement.doseInstructions ? `Bottle directions: ${supplement.doseInstructions}` : "",
      supplement.notes ? `Notes: ${supplement.notes}` : "",
      supplement.productUrl ? `Product link: ${supplement.productUrl}` : ""
    ].filter(Boolean);
    const estimatedLines = details.length + extraLines.reduce((total, line) => total + (document.splitTextToSize(line, contentWidth - 24) as string[]).length, 0);
    const cardHeight = 50 + estimatedLines * 13;
    ensureSpace(cardHeight + 12);

    document.setFillColor(isLow ? 255 : 251, isLow ? 245 : 252, isLow ? 235 : 251);
    document.setDrawColor(isLow ? 169 : 216, isLow ? 120 : 222, isLow ? 45 : 227);
    const cardTop = y;
    document.roundedRect(margin, cardTop, contentWidth, cardHeight, 4, 4, "FD");
    y += 18;
    document.setTextColor(31, 42, 39);
    document.setFont("helvetica", "bold");
    document.setFontSize(11);
    document.text(supplement.name, margin + 12, y);
    if (isLow) {
      document.setTextColor(154, 52, 30);
      document.setFontSize(8);
      document.text("LOW", pageWidth - margin - 12, y, { align: "right" });
    }
    y += 15;
    document.setTextColor(102, 115, 111);
    document.setFont("helvetica", "normal");
    document.setFontSize(9);
    details.forEach((detail) => {
      document.text(detail, margin + 12, y);
      y += 13;
    });
    extraLines.forEach((line) => addWrapped(line, margin + 12, contentWidth - 24));
    y = cardTop + cardHeight + 26;
  });

  ensureSpace(66);
  document.setTextColor(31, 42, 39);
  document.setFont("helvetica", "bold");
  document.setFontSize(14);
  document.text("Recent taken history", margin, y);
  y += 18;

  const recentLogs = [...logs].sort((a, b) => b.takenAt.localeCompare(a.takenAt)).slice(0, 20);
  if (!recentLogs.length) {
    document.setFont("helvetica", "normal");
    document.setFontSize(10);
    document.setTextColor(102, 115, 111);
    document.text("No taken history has been logged.", margin, y);
  } else {
    recentLogs.forEach((log) => {
      ensureSpace(34);
      const supplement = supplements.find((entry) => entry.id === log.supplementItemId);
      document.setFont("helvetica", "bold");
      document.setFontSize(10);
      document.setTextColor(31, 42, 39);
      document.text(supplement?.name ?? "Deleted supplement", margin, y);
      document.setFont("helvetica", "normal");
      document.setTextColor(102, 115, 111);
      document.text(`${log.amountTaken || "1"} taken | ${displayDateTime(log.takenAt)}`, pageWidth - margin, y, { align: "right" });
      y += 13;
      if (log.notes) addWrapped(log.notes, margin, contentWidth);
      y += 7;
    });
  }

  addFooter();
  document.save("mom-supplements-report.pdf");
}
