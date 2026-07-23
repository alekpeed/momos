# MomOS Handoff

This file is the current repository handoff for the next builder. It summarizes what is complete, what was verified in code, and what still requires live device/provider validation.

## Current Repository State

- Phase 1 local MVP: code complete.
- Phase 2 Mom-ready polish: code complete.
- Phase 3 cloud sync/sharing foundation: code complete.
- Phase 4 reminders/help: code complete.
- Phase 5 purchases and AI-style local intelligence: code complete locally and review-first.
- Phase 6 encrypted vault foundation: code complete locally.

See `docs/project-status.md` for percentages and `docs/roadmap.md` for the phase list.

## What Was Verified In Code

- TypeScript type checking passes with `npm run typecheck`.
- Production build passes with `npm run build`.
- Lint runs non-interactively with `npm run lint`; the latest local pass completed with no ESLint warnings or errors after dependencies were installed with `npm install`.
- JSON backup/restore recognizes core records, Ideas, helper records, purchase import queue entries, and encrypted vault records.

## Important Boundaries

- MomOS remains local-first even when cloud backup is configured.
- Provider-backed push, SMS/email sending, retailer checks, remote AI, and email inbox parsing now have endpoint readiness slots, but still require protected live provider services, credentials, and explicit validation.
- Vault records are encrypted locally with a passphrase. The app cannot recover forgotten passphrases.
- Vault plaintext must stay out of helper handoff, AI-style summaries, cloud member flows, and printable reports.
- Urgent helper alerts are not emergency dispatch and must keep non-911 wording.

## Remaining Work

These are validation/provider tasks, not missing local repository features:

1. Run the navigation QA checklist on a real iPhone/Safari install.
2. Validate camera/photo upload, QR scanning, print/save-PDF, and JSON backup/restore on target devices.
3. Validate live Firebase or Supabase credentials, rules, storage, household sharing, and queued offline backup retry.
4. Validate notification permission behavior on target iPhone/Home Screen setup.
5. Validate SMS and email draft links on the target devices.
6. Validate receipt/email import examples, retailer/provider links, and any future AI/provider adapter against real services.
7. Validate vault passphrase handling, recovery-key ceremony design, backup/restore behavior, and security posture before storing irreplaceable secrets.

## How To Continue

- Start by running `npm run typecheck`, `npm run build`, and `npm run lint`.
- Use `docs/navigation-qa-checklist.md` for live click-through testing.
- Record real issues in `docs/navigation-qa-findings.md` or a new dated QA note before changing behavior.
- Fix only confirmed issues unless a new scoped phase is explicitly requested.
