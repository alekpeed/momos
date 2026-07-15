# Future Ideas / Backlog

This backlog captures ideas, speculative concepts, provider-dependent features,
and larger product directions that should not be lost. The phased roadmap remains
the official build order. This file is the parking lot for ideas until they are
ready to become scoped phase work.

## How To Use This Backlog

- Keep ideas here when they are useful but not ready for implementation.
- Move an idea into `docs/roadmap.md` when it has a clear phase, acceptance
  criteria, and implementation path.
- Do not treat visual concepts, AI behavior, provider integrations, or vault
  workflows as approved product requirements until they are promoted out of this
  backlog.
- Prefer small, Mom-usable slices over large abstract redesigns.

## Design And Visual Direction

Status: on hold until a separate design pass.

- Home-screen visual concepts: Compass, Radar, Briefing, Universe, Portals, and
  other visual front-door explorations.
- Future graphical navigation layers, provided they do not rewrite the stable
  data, navigation, accessibility, and action contracts.
- Possible user-facing task/project map design brief, if Mom actually needs a
  visual map rather than the current project/task flow review.

## Ideas / Visual Planner Later Layers

Status: local-first Ideas is implemented; live/provider features remain future.

- Automatic broken-link checks.
- Live availability checks.
- Retailer price refreshes and price-drop alerts.
- More advanced product matching across stores.
- Provider-backed rating, availability, and seller checks.
- More advanced image similarity beyond the local signature heuristic.
- More automated idea-to-shopping-list and idea-to-project workflows if Mom uses
  Ideas heavily.

## Phase 4 Follow-Ups: Reminders And Help

Status: Phase 4 code is complete; provider endpoint readiness is visible in the app, but live send/push providers still require protected endpoints and validation.

- Provider-backed true background push beyond the current device/browser notification foundation using the provider endpoint slot.
- Real SMS/email send providers, if drafts through the device apps are not enough, using the provider endpoint slots.
- Escalation/audit provider for helper alerts if Mom needs confirmed receipt.
- More visual task-map design work only if the current flowchart preview is not enough after live use.

## Phase 5 Candidates: Purchases And AI

Status: Phase 5 code is complete locally; provider endpoint readiness is visible in the app, but live inbox, retailer, and remote AI providers still require protected endpoints and validation.

- Live email inbox parsing with explicit permission using the receipt inbox endpoint slot.
- Remote AI daily docket provider, if local summaries are not enough, using the remote AI endpoint slot.
- Retailer/provider adapters for Amazon, Walmart, Home Depot, Costco, pharmacies, and other stores using the retailer endpoint slot.
- Live price refreshes, availability checks, and checked-at timestamps from provider APIs.
- AI use of energy journal data only after direct user request.

## Phase 6 Candidates: Vault And Security

Status: Phase 6 code is complete locally; these are security/live-validation follow-ups.

- Recovery-key workflow ceremony and UX validation.
- Multi-device encrypted sync design.
- Lockdown mode expansion for future helper/cloud flows.
- External security review before storing irreplaceable secrets.
- No hidden backdoor for helper, admin, developer, or AI access.

## Live Validation / Provider Validation

Status: not feature work, but still important before Mom depends on the app.

- Real iPhone Safari install and tap-through validation.
- iPhone camera/photo upload validation.
- QR scan validation with a printed or displayed label.
- Browser print/save-PDF validation.
- Live Firebase project validation with Authentication, Firestore, Storage, and
  published rules.
- Live provider/API validation for any future retailer, SMS, email, push, or AI
  integrations.

## Promotion Checklist

Before moving a backlog idea into active work, answer:

1. What problem does this solve for Mom?
2. Is this local-only, cloud-backed, provider/API-backed, or AI-backed?
3. What is the smallest useful version?
4. What data does it read or write?
5. What could go wrong or confuse Mom?
6. Does it need live device/provider validation?
