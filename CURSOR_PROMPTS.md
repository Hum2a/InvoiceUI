# Cursor prompts for InvoiceUI

Open `E:\Humza\Programming\Clients\Invoices\InvoiceUI` in Cursor. Use the setup prompt followed by Prompt 1. Work through the remaining prompts in order, one phase at a time. In a new chat, paste the setup prompt again before the phase prompt.

`IMPLEMENTATION_PLAN.md` is the full feature specification. These prompts reference its numbered sections so requirements are not lost or repeatedly pasted. The older README contains future ideas that are outside the agreed plan; the implementation plan takes precedence.

## Setup prompt — paste at the start of each Cursor chat

```text
You are continuing my existing InvoiceUI application. Read applicable repository instructions, IMPLEMENTATION_PLAN.md, and CURSOR_PROGRESS.md if it exists. Inspect only the code relevant to the requested phase before editing. Preserve existing work and the current editor/preview layout; verify the actual implementation rather than assuming the scaffold or documentation proves a feature works.

Keep React + Vite, Tailwind, shadcn, Motion, selected Animated UI/React Bits/Magic UI components, Hono, Neon and Resend. Deploy the frontend and API as one Cloudflare Worker; private R2 storage and managed services may support it. Default to GBP and Europe/London, with optional tax and owner-only access. Target domain: invoiceui.humza.website.

Read AGENTS.md and follow the shared numbered rules in .ai/rules for the current task. Mandatory UI requirement: shadcn/ui, Motion (motion.dev), Animate UI (the requested Animated/Animation UI), Magic UI and React Bits must all have genuine rendered usage across the finished product. Use the appropriate library for each component; unused dependencies and hand-built lookalikes do not satisfy this. Maintain component source/licence/usage records as required by rule 02.

Implement the requested phase end to end, including UI, API, migrations and relevant checks. Make reasonable routine decisions and proceed. Ask only for genuinely missing information at the point it is needed; continue independent work if credentials are unavailable. Never pretend mocked integrations are live. Use current official documentation when integrating provider APIs. Keep secrets out of source and logs.

Be economical: give a short plan, avoid unrelated refactors, repeated full-repository reads, unnecessary dependencies, long explanations and repeated tests without new changes. Do not delegate to additional agents. Run meaningful checks for changed behavior plus the build/type checks appropriate to the phase. Fix failures you introduce. Do not mark acceptance criteria complete without evidence.

Keep a concise CURSOR_PROGRESS.md containing completed requirements, important decisions, migrations/setup still needed, checks and results, blockers and the next step. At the end, briefly report what works, what was verified and anything blocked. Finish this phase before beginning another. Do not deploy production or send real customer messages as part of a development phase. Historical invoice import, Stripe/card collection and automatic currency conversion are outside this plan.
```

## Prompt 1 — secure foundation

```text
Implement every requirement and completion check in section 1 of IMPLEMENTATION_PLAN.md: Secure application and data foundation.

Refactor the editor into maintainable components with Invoices, Clients, Projects, Services and Settings navigation. Stabilise local frontend/API development, migrations and Worker bindings. Implement established authentication with verified server sessions, owner-only access and no public registration; prefer passwordless if compatible with the selected integration. Use configured owner email rather than inventing one.

Enforce authenticated business ownership on all private operations. Add validation, state-change protection, request limits, consistent errors, constraints, indexes, pagination and atomic invoice/line writes. Centralise decimal-safe monetary calculations and server-side totals.

Separate draft/issued/void lifecycle from delivery and payment state. Allocate business-scoped invoice numbers atomically at issuance, never reuse voided numbers, and snapshot business/client/pricing/template details so issued invoices remain historical records. Verify unauthenticated/cross-business denial, concurrent numbering, transaction rollback and money edge cases. Prepare document snapshot contracts for later PDF work.
```

## Prompt 2 — business, clients, projects and services

```text
Implement every requirement and completion check in section 2 of IMPLEMENTATION_PLAN.md: Reusable business, client and project information. Build working authenticated CRUD screens and APIs, not placeholders.

Add business identity/contact/address/logo/bank settings, currency, payment terms, footer and optional tax identifiers. Add searchable clients with billing information, recipients, CC, reply-to preferences, terms and notes. Add projects associated with clients and invoice history. Add saved services supporting fixed/hourly/unit rates and descriptions. Copy service values into drafts rather than dynamically linking historical pricing. Store logos privately with type/size validation and controlled retrieval.

Connect selectors to the invoice composer so choosing a client, project and service produces a useful populated draft. Verify that editing reusable information does not change issued invoice snapshots. Use synthetic examples; do not import sibling folders of real invoices.
```

## Prompt 3 — reliable composer and autosave

```text
Implement every requirement and completion check in section 3 of IMPLEMENTATION_PLAN.md: Reliable invoice composer.

Connect every editor and preview field to persistent data, including real business details and dates. Add debounced autosave with Saving/Saved/Offline/Failed states, explicit save/retry, version conflict detection and a clear recovery flow. Add local unsent-edit recovery, reconnect handling, navigation protection and removal of private local data on sign-out. Guard against stale/out-of-order saves and isolate recovery data by user/business.

Implement duplicate-as-new-unnumbered-draft, fresh dates, line add/remove/reorder, fixed fees/hours/quantities/descriptions, amount/percentage discounts, optional tax, currencies, deposit requests and instalment schedules. Keep requested deposits separate from received payments. Add receipt/7/14/30/custom terms while preserving manual due-date overrides, notes, purchase orders, payment references and optional task/hour/deliverable breakdowns.

Include searchable selectors, field validation, new/save/download shortcuts and mobile editing/full-screen preview. Incomplete drafts must save but fail issuance validation. Verify refresh/recovery, duplication, two-device conflicts and preview/server total agreement. If direct PDF download awaits phase 4, retain a clearly described existing print action until it is wired there.
```

## Prompt 4 — templates and real PDF downloads

```text
Implement every requirement and completion check in section 4 of IMPLEMENTATION_PLAN.md: Documents and presentation.

Preserve the current template and add two restrained alternatives, logo and accent controls. Replace print-only download behavior with direct PDF files and stable invoice-number/client filenames. First validate a dedicated renderer in the actual Worker runtime, including long-document performance. If needed, use a compatible browser-rendering binding while retaining the single Worker application architecture.

Use a shared document model for preview, PDF, later email attachments and public viewing. Support long descriptions, repeated table headers, page numbers, sensible pagination and an optional separate breakdown document. Store versioned issued PDFs privately for reproducible retrieval, using issued snapshots; clearly mark draft documents. Add light/dark/system editor themes without changing document print colours.

Render and visually inspect one-page and multi-page documents, Unicode, supported currencies and all templates. Verify download behavior on desktop/mobile and preview/PDF parity. A successful HTTP response alone is not sufficient verification.
```

## Prompt 5 — dashboard and payment tracking

```text
Implement every requirement and completion check in section 5 of IMPLEMENTATION_PLAN.md: Invoice management and payments.

Build a searchable paginated invoice dashboard with client/project/date/lifecycle/payment filters and outstanding/due-soon/overdue views. Calculate these using actual balances and business timezone. Keep totals separate per currency.

Add a payment ledger with amount/date/method/reference/notes, partial payments, received deposits and auditable corrections/reversals. Derive unpaid/partially-paid/paid status from the ledger. Keep issue/send/delivery events separate; sending never means paid and delivery failure never reverses issuance.

Add archive/restore and appropriate undo, plus voiding issued invoices with retained reason/history rather than destructive deletion. Add client/project detail pages showing invoice/payment history. Verify partial payments and reversals, exclusion of draft/void invoices from receivables, and retention of balances/history after archiving.
```

## Prompt 6 — email, sharing, reminders and recurring drafts

```text
Implement every requirement and completion check in section 6 of IMPLEMENTATION_PLAN.md: Email, sharing and follow-ups.

Add a Resend composer with preview, editable subject/message, recipient/CC/reply-to defaults and exact stored issued PDF attachments. Require an explicit send action. Persist delivery attempts with idempotency, safe retry/failure states, verified webhook signatures and duplicate/out-of-order event handling. Test with mocked delivery or an explicitly configured test recipient; do not email real clients during development.

Add unguessable scoped public viewing/download tokens, optional expiry, immediate revocation and no-index pages. Ensure revoked access cannot survive public caching and no unrelated business data is exposed.

Draft polite overdue reminders for review. Automated sending must default off and require explicit settings opt-in. Add recurring schedules that generate reviewable drafts, handling month-end, timezone behavior, pauses and duplicate job execution. Optional reminder schedules must check current balances immediately before sending and respect void/paid state, paused follow-ups and bounced recipients.

Use scheduled handlers and durable queued processing where needed within the same Worker deployment. Verify duplicate requests/jobs/webhooks cannot duplicate messages or drafts, revocation blocks retrieval, and paid/void invoices cannot receive scheduled overdue reminders.
```

## Prompt 7 — backup, polish and release preparation

```text
Implement section 7 of IMPLEMENTATION_PLAN.md through staging validation and production release preparation. Actual production deployment is a separate prompt below.

Add versioned machine-readable export of invoices, clients, projects, services, payments and business settings, plus a bundle of issued PDFs. Document and test restoration into an isolated database, including record relationships and document references.

Complete loading/empty/error/offline states, keyboard focus, accessible dialogs, contrast, reduced motion and phone layouts. Integrate requested UI libraries selectively with provenance/licences, preserving a coherent design. Exercise the complete sign-in → settings → client → draft/autosave → issue → PDF → email/share → partial payment → paid → export journey using synthetic data. Include long invoices and a two-device editing conflict.

Prepare Neon migrations/backups, private storage bindings, Resend sender/secrets, auth settings, Cloudflare domain configuration for invoiceui.humza.website, privacy-conscious logging, rollback instructions and production smoke checks. Verify current account plans before any chargeable provisioning; document missing access or configuration rather than claiming it works. Update README to reflect the actual implemented state and remove contradictory roadmap/status claims.

Produce a concise release checklist with verified results and genuine blockers. Do not deploy production in this phase.
```

## Prompt 8 — deploy when ready

```text
Release the completed InvoiceUI application to invoiceui.humza.website using the prepared single Cloudflare Worker deployment.

Read CURSOR_PROGRESS.md and the release checklist. Verify staging checks and resolve release blockers. Inspect available account configuration without exposing secrets. Use the intended Cloudflare account/zone, production Neon database, private storage and verified Resend sender. If a required credential, owner identity or paid resource decision is missing, ask specifically for it while completing independent preparation.

Back up any existing production data before migrations and preserve rollback capability. Apply reviewed migrations, configure secrets/bindings/domain routing, deploy, and check HTTPS, owner authentication, private-route access controls, persistence and PDF download using synthetic data. Do not send a real customer email for a smoke test. Report the live URL, checks performed and any remaining setup honestly. Update the progress and operational documentation.
```

## Recovery prompt — if Cursor stops mid-phase

```text
Continue the current InvoiceUI phase from CURSOR_PROGRESS.md. Inspect the current code and changes before acting. Complete the unfinished requirements and relevant verification, preserving completed work. Do not restart the project or repeat successful checks unless something relevant changed. Update the progress file and briefly report results and blockers.
```
