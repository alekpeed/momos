# Provider Automations

MomOS now has a safe provider-automation readiness layer for optional live services. The app still works local-first when no provider endpoints are configured.

## Supported Provider Slots

These public environment variables are checked at build/deploy time:

They must be set before running `next build`. Next.js embeds these public endpoint URLs in the browser bundle; changing them requires a rebuild and redeploy.

| Capability | Environment variable | Purpose |
| --- | --- | --- |
| Background push | `NEXT_PUBLIC_MOM_HOME_PUSH_ENDPOINT` | Remote reminder and helper nudges through a protected push service. |
| SMS sending | `NEXT_PUBLIC_MOM_HOME_SMS_ENDPOINT` | Helper texts through a provider after user review. |
| Email sending | `NEXT_PUBLIC_MOM_HOME_EMAIL_ENDPOINT` | Helper emails or household summaries through a provider after user review. |
| Retailer checks | `NEXT_PUBLIC_MOM_HOME_RETAILER_ENDPOINT` | Price, availability, and checked-at refreshes from approved provider APIs. |
| Remote AI summaries | `NEXT_PUBLIC_MOM_HOME_AI_ENDPOINT` | Review-first docket rewriting or suggestions without automatic record changes. |
| Receipt inbox parsing | `NEXT_PUBLIC_MOM_HOME_INBOX_ENDPOINT` | Explicit-permission receipt email import into the existing review queue. |

## Safety Rules

- Do not put provider secrets directly in browser code or `NEXT_PUBLIC_*` values.
- Each endpoint must be a protected service that owns its own credentials server-side.
- Provider output must stay review-first before sending messages, importing receipts, saving AI summaries, or changing prices.
- Vault plaintext remains excluded from provider payloads.
- Urgent helper alerts remain non-911 helper messages and must not claim emergency dispatch.
- Retailer integrations should prefer official APIs or approved product/search providers instead of brittle scraping.

## Helper Email Endpoint Contract

When `NEXT_PUBLIC_MOM_HOME_EMAIL_ENDPOINT` is configured, open help requests show a **Provider email** action next to the local Email draft fallback. The browser sends a reviewed `POST` request to that endpoint with JSON shaped like:

```json
{
  "kind": "help_request",
  "channel": "email",
  "request": {
    "id": "help-request-id",
    "title": "What Mom needs",
    "details": "Optional details",
    "urgency": "Soon",
    "nonEmergencyNotice": "This is a helper alert from MomOS, not emergency dispatch or 911.",
    "createdAt": "ISO timestamp"
  },
  "contact": {
    "name": "Helper name",
    "phone": "optional",
    "email": "helper@example.com",
    "relationship": "optional"
  },
  "message": {
    "to": "helper@example.com",
    "subject": "What Mom needs",
    "body": "Reviewed helper message text"
  },
  "review": {
    "reviewedByUser": true,
    "sentFrom": "MomOS"
  }
}
```

The endpoint should return any 2xx status for success. Non-2xx responses are shown to Mom as provider send failures, and the request remains available for local copy, SMS draft, or Email draft fallback.

## Current App Behavior

The More screen shows a Provider automations panel with connection status and counts for records that could use provider support. With no endpoints configured, it acts as a readiness checklist and does not call any live services. When the email endpoint is configured, Help requests can send reviewed provider email while preserving Copy, SMS draft, and Email draft fallbacks.
