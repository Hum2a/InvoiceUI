# InvoiceUI — expanded product specification

Status: proposed additions for review, 2026-09-12. This document specifies future work; it does not claim the features are implemented or authorise implementing every idea at once. Preserve the active Antigravity phase. Select a wave using ANTIGRAVITY_EXPANSION_PROMPTS.md after a stable checkpoint.

## Existing coverage and actual gaps

The original IMPLEMENTATION_PLAN.md and CURSOR_PROMPTS.md already cover authentication, business/client/project/service records, autosave/offline recovery, edit conflicts, duplication, tax/discounts/deposits/instalments, templates, PDF downloads, payment tracking, filtering, recurring drafts, reminders, sharing, exports and responsive/accessibility work. These are not new omissions.

New proposals below fill missing workflows and make broad existing requirements more precise. The progress file reports work through phase 4 at review time; this is a progress report, not an independent code audit. Do not restart completed phases or assume a documented feature passes its acceptance criteria.

Default product direction: an exceptionally fast private invoicing workspace for freelance/client work. Expand into quotes and project billing when those features are selected. Keep optional business-management ideas out of the critical path.

## Product experience

- Primary flow: select client → choose starter or enter work → review → issue → download or send. Keep advanced fields collapsed until needed, then remember the user's preference.
- Main navigation: Overview, Invoices, Clients, Projects, Services, Settings. Add Quotes and Work only when those modules exist. Put receipts, statements and corrections in relevant invoice/client screens rather than adding a menu for everything.
- Give each screen one obvious primary action. Use precise labels: Save draft, Issue invoice, Send email, Record payment. Each performs only its stated action unless a combined action has an explicit review step.
- Preserve the editor/live-preview layout. Use shadcn/ui for controls, Motion for transitions, and real Animate UI, Magic UI and React Bits components across the product. Keep animation purposeful, accessible and out of documents. Do not pick specific registry APIs until checked against current official sources.
- Keep operational messages in plain language. Never label an invoice "sent" because its PDF was generated, or "paid" because a customer clicked a button.

## Wave A — make routine invoicing faster

### A01. Guided first invoice and resumable setup — new

Provide a short checklist for business identity, bank instructions, client and first invoice. Let the owner save partial setup and return later. Show a synthetic preview with clearly labelled example information; never persist example bank/client details as the owner's real records. Skip irrelevant tax questions when tax is off.

Done when: a new user can complete the first real draft without reading technical documentation; reopening resumes setup; missing issuance requirements link directly to their fields. Dismissing onboarding does not block normal navigation.

### A02. Client defaults with predictable precedence — strengthens existing defaults

Allow client-specific currency, terms, preferred template, delivery contacts, payment instructions and service-rate overrides. Resolve values as explicit invoice override → client default → business default. Copy resolved values into drafts. Changing a selected client must explain which fields will change and preserve explicit manual overrides unless the user elects to reset them.

Done when: two clients can use different rates/terms without repeated typing; switching clients never silently changes manually entered rates or currencies on populated lines. Issued snapshots remain unchanged.

### A03. Invoice starters and service bundles — new

Save reusable multi-line starters such as "Website sprint", "Monthly maintenance" or "Design milestone". These are content presets, separate from visual document templates. Include line groups, descriptions, terms and reusable notes. Support favourites and create-from-last-invoice for a selected client.

Done when: a starter creates a fresh unnumbered draft; old payments, delivery records, private notes, public tokens and issue metadata are never copied. Starter changes do not alter existing invoices.

### A04. Faster line-item entry — strengthens composer

Add duplicate line, insert above/below, keyboard movement, accessible reordering, optional line groups/subheadings and a sticky total. Permit pasting a simple tabular block of description/quantity/rate with a mapping/validation preview. Keep ordinary paste into text fields unchanged. Support undo for local line edits without trying to undo issued documents or remote sends.

Done when: an owner can enter ten lines largely by keyboard; ambiguous numeric formats produce a preview/error rather than silently changing amounts; paste is atomic and can be undone before saving. Grouping does not alter arithmetic.

### A05. Review before issue and send — new explicit workflow

Add a compact review sheet showing client, recipient/CC, dates, currency, totals, payment instructions, selected attachments and the document preview. Separate blocking errors from warnings. Warn on likely duplicates based on client/project/period/amount, empty payment instructions and unusually old dates, without pretending similarity proves a duplicate.

Offer clearly named Issue and download and Issue and prepare email actions. Actual email sending remains explicit. Revalidate the latest draft on the server; double clicks and retries must not issue twice. If delivery fails after issuance, keep the issued record and retry delivery only.

Done when: stale unsaved edits cannot be issued accidentally; errors link to fields; confirmation reflects the exact version issued; warnings may be acknowledged without weakening real validation.

### A06. Command menu, saved views and remembered position — strengthens navigation

Add Ctrl/Cmd+K for searching invoices/clients/projects and running safe actions, a discoverable shortcut reference, recent records, saved filter views and remembered column/sort preferences. Preserve list position and filters when returning from an invoice. Filters should be represented in a shareable authenticated URL where practical; do not put customer names or secrets in URLs unnecessarily.

Done when: "Mentage overdue" can be reached through a saved view, back navigation preserves the table, and keyboard actions do not fire while typing in an input. State-changing commands open the normal review flow.

### A07. Useful bulk operations — new

Support selected PDF downloads as a ZIP, filtered CSV export, archive and restore. Clearly distinguish "this page" from "all matching results". Show progress and per-item failure/retry results. Recheck permissions and eligibility for every item on the server.

Done when: a failure on one invoice does not hide which others succeeded; retry does not duplicate actions; selection stays tied to IDs. Exclude bulk issue, bulk email and bulk mark-paid from the first version.

### A08. One coherent invoice activity timeline — strengthens scattered history

Combine creation, edits, issuance, delivery attempts/events, public link creation/revocation, payments, reversals, reminders and void/correction events into one chronological view. Show meaningful summaries and timestamps in the business timezone. Keep private notes separate from externally visible events.

Done when: the owner can explain the current balance and last delivery attempt from one screen. Do not expose secret links or detailed private change payloads in logs or public pages. A download is not proof a named person read an invoice.

## Wave B — close payment and document workflow gaps

### B01. Corrections and credit documents — new, high-value domain work

Add a guided "Correct this invoice" action for issued documents. Preserve the original invoice and PDF. Create a linked replacement draft when appropriate; create a separately numbered credit document for reductions, with reason, date and line/tax breakdown derived from the original. Keep credits, payments and refunds as distinct events.

Define a balance contract before coding: valid invoice charges minus applied credits minus net allocated payments equals amount due. Overpayment is a separate credit balance, not a negative "unpaid" invoice. Guard against applying the same credit twice or crediting more than the eligible amount. Never allow arbitrary draft editing of issued financial history.

Done when: full/partial credits, an already partially paid invoice, reversal of an allocation and replacement linkage reconcile correctly; original issued bytes remain downloadable. Validate jurisdiction-specific document/tax requirements against current authoritative guidance before describing the feature as compliant. This proposal is product scope, not an accounting ruling.

### B02. Payment receipts and client statements — new

Offer a receipt after recording a payment with amount/date/method/reference, allocations and remaining balance. Give receipts stable identities; reversing a payment must retain its original receipt and visibly identify the reversal. A receipt proves a recorded payment, not a bank-verified settlement unless a future integration actually verifies it.

Generate client statements for a chosen period, with opening balance, invoices, credits, payments, closing balance and document links. Separate currencies. Preview before downloading/sending; use the existing delivery system.

Done when: statement opening + period charges − credits − net payments equals closing balance for each currency, including activity before the period and corrected payments.

### B03. Allocate a payment across invoices — new

Record one client payment and allocate it across several eligible invoices of the same currency. Suggest oldest due first, but let the owner edit allocations. Retain unapplied overpayment explicitly. Record refunds against available credit and preserve allocation/reversal history.

Done when: allocated plus unallocated amounts reconcile to the payment, cross-client/cross-currency allocation is rejected, and concurrent allocation cannot spend the same available balance twice. Introduce a canonical payment record rather than copying a payment into several invoices.

### B04. Private notes, attachments and client-visible content — strengthens breakdown support

Separate internal notes from notes printed on the invoice. Attach supporting documents with explicit "internal only" or "include for client" visibility, defaulting to internal. Keep private R2 storage, validated types/sizes, immutable versions and server-side ownership checks. Preview the exact attachment set before email/share; edits after sending do not rewrite the delivery record.

Done when: internal notes and attachments cannot leak through PDF, public views, API responses or outbound email. Suspicious active content is not rendered inline as trusted HTML. Existing work-breakdown downloads continue to work.

### B05. Reminder controls and an owner attention queue — strengthens automation

Add "Needs attention" for unsent issued invoices, failed/bounced delivery, overdue balances, conflicts and recurring drafts awaiting review. Add next reminder time, pause-until date, reason and preview. A client promise-to-pay date may pause reminders but must not mark paid or change the original due date.

Done when: a fresh payment cancels an otherwise eligible reminder; dismissing a notification does not change the financial state; recurring failures are deduplicated. Default to in-app notifications; external owner notifications are opt-in and avoid sensitive payloads.

## Wave C — optional quote-to-invoice and project billing

### C01. Quotes / estimates with revisions — new module

Create a clearly labelled quote document with separate numbering, expiry, scope and optional notes. Track draft, sent, accepted, declined, expired and superseded versions. Retain the exact version offered and any acceptance evidence. Start with owner-recorded acceptance; a future client acceptance link needs a clear identity/authority and consent design.

Convert an accepted quote into an unissued invoice by copying the agreed version, preserving a link and preventing accidental duplicate conversion. Do not assume quote acceptance means payment or that an online click establishes legally sufficient acceptance in every jurisdiction.

Done when: revising a sent quote preserves the older version, the owner can see which version was accepted, and conversion retries cannot create duplicate invoices. Client links are version-scoped and revocable.

### C02. Billable work log and draft invoice generation — new module

Track manual time/work entries per client/project: date, description, duration or quantity, rate, billable flag and draft-billing linkage. Let the owner select unbilled entries and create a grouped draft with a work breakdown. Capture the applied rate when billing rather than changing past work when catalogue rates change.

Done when: two open sessions cannot invoice the same entry twice. Define reserved-for-draft versus billed-on-issuance states, release reservations when a draft is discarded, and never automatically rebill work just because an issued invoice is voided. A running timer is optional later.

### C03. Project milestones and remaining-to-bill — new module

Define an optional agreed project amount, currency and milestones. Show agreed, drafted, issued, credited, received and remaining-to-bill as distinct values. Create milestone drafts without duplicating earlier billing. A requested deposit is part of the agreed total unless explicitly defined otherwise.

Done when: deposit/final invoice flows cannot charge the same project value twice, change orders update the agreement explicitly, and cash received is never presented as the same thing as work invoiced. No multi-currency budget conversion in this module.

## Wave D — optional convenience and business overview

### D01. Honest overview metrics

Show invoiced, cash received, outstanding, due soon and overdue for a chosen period, separately per currency. Define whether each metric filters by issue date, payment date or due date. Add ageing buckets with explicit boundaries, e.g. 1–30, 31–60, 61–90 and 91+ days overdue. Exclude voids and apply credits correctly. Clicking a metric opens matching records. Do not label receipts as profit or promise an accounting revenue calculation.

### D02. Installable mobile app experience

Add an installable PWA shell, home-screen icon and suitable mobile navigation. Extend existing draft recovery without claiming full offline access. Do not cache private API responses or invoice PDFs by default in a service worker. Show app-update availability and preserve unsaved edits before refreshing. Issuing/sending/recording payments remains online unless a separate reviewed offline transaction design is selected.

### D03. Client account view

Optional separately scoped client portal showing only selected invoices, balances, statements and attachments for that client. Never broaden an existing single-invoice public token into client-wide access. Allow revocation and provide accessible mobile downloads. "I have paid" creates a pending owner-review message, not a ledger payment. Treat portal access as a larger privacy feature, not a free extension of a public PDF link.

### D04. Multiple business profiles

Optional explicit business switcher for separate trading identities/brands, each with isolated settings, clients, numbering, documents and permissions. Switching prompts to resolve unsaved work and clears scoped UI state. The original plan only required ownership-ready data, not a full switcher. Do not add teams/roles or public registration implicitly.

## Make already-promised behavior explicit

These are refinements of existing scope, not new standalone modules:

- **Recurring drafts:** show the next occurrences and billing period before enabling; define whether a schedule copies frozen content or current defaults. Preview the change rather than silently replacing rates.
- **History:** preserve original issued documents when voided; offer a clearly labelled current void representation separately. Versioning must not make the original inaccessible.
- **Defaults and deletion:** archive referenced client/service records where appropriate. Existing drafts and issued snapshots must survive catalogue changes predictably.
- **Delivery:** model issue success, PDF generation, queue acceptance, provider acceptance, delivery and bounce separately. A timeout after sending is not automatically safe to resend.
- **Money:** specify discount/tax ordering, rounding and currency precision once; preview, server, exports and PDFs use the same contract. Mixed tax rates and inclusive/exclusive pricing require a separate explicit extension if needed.
- **Settings:** show owner-friendly integration health and last successful export; expose status, not secrets or raw configuration dumps. Support test actions using synthetic data.
- **Documents:** support copy invoice number/reference, copy payment instructions and a clear download action. Avoid claiming bank-specific payment QR support without an explicitly supported format.
- **Search and accessibility:** meaningful empty states, clear filters, remembered preferences, keyboard alternatives to drag actions and plain-language error recovery.

## Implementation boundaries and sequencing

Recommended order: finish the active original phase → Wave A → remaining original phases → Wave B → selected C/D modules. Move B01 earlier only if the core lifecycle is still being designed and doing so avoids a second migration. Do not interrupt an agent midway through a migration or create overlapping application edits.

For each selected module, first map existing UI/API/data to the requirement and implement only missing behavior. Add stable IDs, business ownership, versioning and immutable document/event relationships where required. Fit current persistence where reasonable; financial allocations need atomic operations, not a cosmetic data shape. Keep provider integrations inside the agreed architecture.

Each feature handoff records what changed, actual acceptance checks, remaining limitations and any necessary setup. Distinguish spec coverage from implementation verification. The scope does not include Stripe, live bank feeds, automatic FX, tax filing, full expense accounting, AI-generated invoices or importing historical client folders. Those need separate decisions.
