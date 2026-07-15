"use client";

import { buildProviderAutomationPreview, getProviderAutomationStatuses } from "@/lib/provider-automations";
import type { AppState } from "@/lib/inventory-types";

type ProviderAutomationPanelProps = {
  state: AppState;
};

export function ProviderAutomationPanel({ state }: ProviderAutomationPanelProps) {
  const statuses = getProviderAutomationStatuses();
  const preview = buildProviderAutomationPreview(state);
  const configuredCount = statuses.filter((status) => status.configured).length;

  return (
    <div className="panel">
      <div className="section-head">
        <div>
          <h2>Provider automations</h2>
          <p className="muted">Optional live-provider layer for push, SMS, email, retailer checks, remote AI, and receipt inbox parsing.</p>
        </div>
        <span className="badge">{configuredCount}/{statuses.length} connected</span>
      </div>

      <div className="notice-card">
        <strong>Safe boundary</strong>
        <p>Mom Home stays local-first. Provider automations need protected endpoints, live credentials, and user review before sending messages, importing receipts, saving AI summaries, or updating prices.</p>
      </div>

      <div className="stats-grid mini-stats">
        {statuses.map((status) => (
          <div key={status.key}>
            <strong>{status.configured ? "Ready" : "Setup"}</strong>
            <span>{status.label}</span>
          </div>
        ))}
      </div>

      <div className="stack-list">
        {statuses.map((status) => (
          <article className="mini-card" key={status.key}>
            <div className="section-head compact">
              <div>
                <strong>{status.label}</strong>
                <p className="meta">{status.summary}</p>
              </div>
              <span className={`badge ${status.configured ? "plenty" : "neutral"}`}>{status.configured ? "Endpoint set" : "Needs endpoint"}</span>
            </div>
            <p className="hint">{status.configured ? "Endpoint configured in the deployed environment." : status.nextStep}</p>
          </article>
        ))}
      </div>

      <div className="callout-list">
        {preview.map((line) => <p key={line} className="meta">• {line}</p>)}
      </div>
    </div>
  );
}
