import type { AppState, HelpRequest, PurchaseRecord } from "@/lib/inventory-types";

export type ProviderAutomationKey = "push" | "sms" | "email" | "retailer" | "ai" | "inbox";

export type ProviderAutomationStatus = {
  key: ProviderAutomationKey;
  label: string;
  configured: boolean;
  endpoint?: string;
  summary: string;
  nextStep: string;
};

const providerDefinitions: Record<ProviderAutomationKey, { label: string; envKey: string; summary: string; nextStep: string }> = {
  push: {
    label: "Background push",
    envKey: "NEXT_PUBLIC_MOM_HOME_PUSH_ENDPOINT",
    summary: "Remote reminders and helper nudges through a protected push service.",
    nextStep: "Connect a server endpoint that owns push subscriptions and credentials."
  },
  sms: {
    label: "SMS sending",
    envKey: "NEXT_PUBLIC_MOM_HOME_SMS_ENDPOINT",
    summary: "Send helper texts through a provider instead of only opening device drafts.",
    nextStep: "Connect a protected SMS endpoint; keep non-911 helper wording."
  },
  email: {
    label: "Email sending",
    envKey: "NEXT_PUBLIC_MOM_HOME_EMAIL_ENDPOINT",
    summary: "Send helper emails or household summaries through a provider.",
    nextStep: "Connect a protected email endpoint and require user review before send."
  },
  retailer: {
    label: "Retailer checks",
    envKey: "NEXT_PUBLIC_MOM_HOME_RETAILER_ENDPOINT",
    summary: "Refresh prices, availability, and checked-at timestamps from approved sources.",
    nextStep: "Connect official retailer/product APIs; avoid brittle scraping as a core dependency."
  },
  ai: {
    label: "Remote AI summaries",
    envKey: "NEXT_PUBLIC_MOM_HOME_AI_ENDPOINT",
    summary: "Rewrite local dockets or suggest review items without changing records automatically.",
    nextStep: "Connect a review-first AI endpoint; vault plaintext must remain excluded."
  },
  inbox: {
    label: "Receipt inbox parsing",
    envKey: "NEXT_PUBLIC_MOM_HOME_INBOX_ENDPOINT",
    summary: "Import receipt emails with explicit permission into the existing review queue.",
    nextStep: "Connect an inbox provider and keep every import review-first."
  }
};

function configuredEndpoint(envKey: string) {
  const value = process.env[envKey]?.trim();
  return value || undefined;
}

export function getProviderAutomationStatuses(): ProviderAutomationStatus[] {
  return (Object.keys(providerDefinitions) as ProviderAutomationKey[]).map((key) => {
    const definition = providerDefinitions[key];
    const endpoint = configuredEndpoint(definition.envKey);
    return {
      key,
      label: definition.label,
      configured: Boolean(endpoint),
      endpoint,
      summary: definition.summary,
      nextStep: definition.nextStep
    };
  });
}

export function providerAutomationCounts(state: AppState) {
  const openHelpRequests = state.helpRequests.filter((request) => request.status === "Open");
  const urgentHelpRequests = openHelpRequests.filter((request) => request.urgency === "Urgent");
  const purchasesNeedingProviderReview = state.purchaseRecords.filter((purchase) => !purchase.checkedAt || purchase.reorderRecommendation === "Compare first");
  const receiptImportsNeedingReview = state.purchaseImportQueue.filter((entry) => entry.status === "Needs review");
  const calendarReminders = state.calendarEntries.filter((entry) => entry.reminderMinutesBefore !== undefined);
  const taskReminders = state.tasks.filter((task) => task.reminderAt);

  return {
    pushCandidates: calendarReminders.length + taskReminders.length,
    smsCandidates: openHelpRequests.length,
    emailCandidates: openHelpRequests.length,
    retailerCandidates: purchasesNeedingProviderReview.length,
    aiCandidates: purchasesNeedingProviderReview.length + receiptImportsNeedingReview.length,
    inboxCandidates: receiptImportsNeedingReview.length,
    urgentHelpRequests: urgentHelpRequests.length
  };
}

export function buildProviderAutomationPreview(state: AppState) {
  const counts = providerAutomationCounts(state);
  return [
    `${counts.pushCandidates} reminders could use background push once a push provider is connected.`,
    `${counts.smsCandidates} open help requests could use SMS provider sending after review.`,
    `${counts.emailCandidates} open help requests could use email provider sending after review.`,
    `${counts.retailerCandidates} purchases could use retailer price/availability checks.`,
    `${counts.aiCandidates} purchase/import records could use a remote AI summary after review.`,
    `${counts.inboxCandidates} receipt imports are already in the review-first queue.`
  ];
}

export function buildHelpProviderPayload(request: HelpRequest, state: AppState) {
  const contact = state.helperContacts.find((entry) => entry.id === request.contactId);
  return {
    kind: "help_request",
    request: {
      id: request.id,
      title: request.title,
      details: request.details ?? "",
      urgency: request.urgency,
      nonEmergencyNotice: "This is a helper alert from Mom Home, not emergency dispatch or 911.",
      createdAt: request.createdAt
    },
    contact: contact
      ? {
          name: contact.name,
          phone: contact.phone ?? "",
          email: contact.email ?? "",
          relationship: contact.relationship ?? ""
        }
      : null
  };
}

export function buildRetailerProviderPayload(purchase: PurchaseRecord) {
  return {
    kind: "purchase_check",
    purchase: {
      id: purchase.id,
      productName: purchase.productName,
      brand: purchase.brand ?? "",
      storeName: purchase.storeName ?? "",
      sellerName: purchase.sellerName ?? "",
      productUrl: purchase.productUrl ?? "",
      totalPrice: purchase.totalPrice ?? "",
      unitPrice: purchase.unitPrice ?? "",
      recommendation: purchase.reorderRecommendation,
      checkedAt: purchase.checkedAt ?? ""
    },
    rules: {
      reviewRequiredBeforeSaving: true,
      noAutomaticPurchase: true
    }
  };
}
