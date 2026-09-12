# Changelog

All notable changes to InvoiceUI are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project does not yet use tagged public releases.

## Unreleased

### Added

- GitHub community files, CI workflow and Dependabot configuration.
- Agent-config sync from Cursor rules, skills and ignores (`npm run sync:agents`).

### Security

- Expanded `.gitignore` for secrets, Neon/Wrangler local state, test output and agent transcripts.

## Development (phases 1-5)

Implemented against [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md); details and verification notes live in [CURSOR_PROGRESS.md](CURSOR_PROGRESS.md).

### Added

- Owner-only Better Auth magic-link sessions and private API enforcement.
- Workspace persistence on Neon with optimistic concurrency.
- Business, client, project and service records with value-copy into drafts.
- Invoice composer: autosave, conflict recovery, local offline drafts, numbering on issue.
- Worker PDF renderer (three templates, breakdown documents, R2 cache for issued files).
- Dashboard, multi-currency receivables, payment ledger, void/archive.

### Notes

- Phases 6-7 (email/sharing/reminders and release polish) remain in progress.
- Card collection, automatic FX and historical invoice import are out of scope.
