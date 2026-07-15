# Provider Automations

Mom Home now has a safe provider-automation readiness layer for optional live services. The app still works local-first when no provider endpoints are configured.

## Supported Provider Slots

These public environment variables are checked at build/deploy time:

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

## Current App Behavior

The More screen shows a Provider automations panel with connection status and counts for records that could use provider support. With no endpoints configured, it acts as a readiness checklist and does not call any live services.
