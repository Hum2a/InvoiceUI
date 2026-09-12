# InvoiceUI implementation plan

## Scope and assumptions

Implement every quality-of-life feature proposed in this conversation while retaining the current editor/preview layout. Start as Humza's private invoice workspace, with a database structure that supports separately owned businesses. Default to GBP and Europe/London; tax is opt-in and never assumed to apply. Public registration is disabled initially.

Retain React, Vite, Tailwind, Hono, Neon and Resend, deployed as one Cloudflare Worker plus managed storage/services. Use shadcn for accessible controls, Motion for transitions, and selected Animated UI, React Bits and Magic UI components for small enhancements. Respect reduced-motion preferences. Confirm current integration guidance before implementing provider-specific APIs.

This is a plan, not a claim that the features already work. No production deployment or external provisioning is part of writing this plan.

## Current baseline

The editor renders a live preview but stores data only in React state. Dates in the preview are hardcoded, business details are placeholders, and Templates/Email buttons have no handlers. PDF download opens browser printing. There is no authentication or ownership filtering in the invoice API. Invoice and line inserts are not atomic. Currency calculations use floating-point numbers. The schema and API are initial scaffolds, and the frontend does not call the API.

The production build and Worker dry run previously passed; neither verifies these missing workflows.

## 1. Secure application and data foundation

- Split the editor into maintainable components; add navigation for Invoices, Clients, Projects, Services and Settings.
- Stabilise dependencies and local frontend/API development; establish database migration tooling and generated Worker bindings.
- Integrate established authentication with verified server sessions. Proposed default: passwordless, restricted to the owner's approved email, using Resend delivery where supported by the chosen auth integration.
- Require authenticated ownership on every private route, including document downloads and uploads. Protect state changes and provide consistent API errors and request-size limits.
- Make business ownership mandatory; add constraints, useful indexes, pagination and transactional invoice/line writes.
- Centralise decimal-safe money calculations, rounding rules and currency precision. Recalculate totals on the server.
- Model lifecycle separately from delivery and payment history: draft, issued or void; derive unpaid/partially paid/paid and overdue from recorded payments and dates.
- Allocate invoice numbers atomically on issuance, scoped to business and numbering series. Drafts use internal IDs; issued numbers are retained and never reused after voiding.
- Snapshot client, business, pricing and template details on issuance so later settings edits cannot change a historical invoice.

Completion: unauthenticated and cross-business requests cannot access data; concurrent invoice issuance cannot duplicate numbers; failed line writes roll back the invoice; money edge cases have meaningful tests.

## 2. Reusable business, client and project information

- Business settings: display/legal name, logo, address, contact details, bank instructions, default currency, payment terms, footer and optional tax identifiers.
- Client directory with searchable selection, billing address, main recipient, CC contacts, reply-to preference, terms and notes.
- Project grouping with client association and invoice history, including names such as Mentage — Sprint 2.
- Saved services with descriptions, fixed/hourly/unit pricing and default rates; selecting a service copies values into the invoice so later catalogue edits do not change old work.
- Secure logo storage with file type/size validation; proposed storage is private Cloudflare R2 with controlled retrieval.

Completion: selecting a client, project and saved service produces a usable populated draft; changes to reusable records leave issued invoices intact.

## 3. Reliable invoice composer

- Connect every field to saved data and preview, including issue date, due date and real business details.
- Debounced autosave with Saving, Saved, Offline and Failed states; explicit save/retry controls.
- Version checks prevent one device silently overwriting newer edits from another. Offer a clear conflict recovery flow.
- Local recovery buffer for unsent edits; reconnect/retry handling, unsaved navigation protection, and clearing private local data on sign-out.
- Duplicate invoice with fresh dates and an unnumbered draft; retain client, project and line details.
- Add, remove and reorder line items; support fixed fees, hours, quantities and optional descriptions.
- Support amount/percentage discounts, optional tax, deposits, instalment schedules and currency selection. Distinguish requested deposits from received payments.
- Quick payment terms: receipt, 7, 14, 30 days or custom. Recalculate due dates only while terms control them; preserve manual overrides.
- Optional notes, purchase-order numbers, payment references and an attached task/hour/deliverable breakdown.
- Searchable selectors, validation beside the relevant field, keyboard shortcuts for new/save/download, and mobile editing with full-screen preview.

Completion: draft creation, refresh, offline recovery, duplication and continuation on another device work; preview and stored totals agree; incomplete drafts can save without being issuable.

## 4. Documents and presentation

- Preserve the current template and add two restrained alternatives with accent-colour and logo controls.
- Add direct PDF downloads with stable filenames derived from invoice number and client, using a dedicated document renderer.
- Validate renderer compatibility and long-document performance in the Worker early in this phase; if a browser-rendering binding is needed, retain the same application deployment.
- Use one document data model for preview, PDF, email attachments and public viewing; verify visual parity.
- Render long descriptions, repeated table headers, page numbers, sensible page breaks and a separate optional breakdown document.
- Store versioned issued PDFs in private object storage for reproducible downloads and attachments; draft previews remain clearly draft documents.
- Add editor light/dark/system themes without altering the invoice's print colours.

Completion: one-page and long invoices, Unicode text, multiple currencies, all templates and breakdown attachments download correctly on desktop and mobile. Inspect rendered pages, not just successful HTTP responses.

## 5. Invoice management and payments

- Searchable, paginated invoice dashboard with client, project, date and lifecycle/payment filters.
- Outstanding, due-soon and overdue views, calculated from outstanding balances and the business timezone. Display separate totals per currency.
- Payment ledger with amount, date, method, reference and notes; support partial payments, deposits and corrections/reversals with history.
- Show issued/sent/delivered as distinct events; sending must not imply payment, and delivery failure must not undo issuance.
- Archive/restore and undo for reversible actions; void issued invoices with a retained reason/history instead of deleting their records.
- Client and project detail pages with related invoice and payment history.

Completion: balances and status update correctly after partial payments and reversals; void/draft invoices are excluded from receivables; archiving does not erase balances or history.

## 6. Email, sharing and follow-ups

- Resend email composer with preview, editable subject/message, saved recipient/CC/reply-to information and exact issued PDF attachments.
- Explicit send action, durable send records, idempotency keys and visible retry/failure states to prevent duplicate messages.
- Verify email webhook signatures and handle duplicate/out-of-order sent, delivered and bounced events.
- Secure client viewing/download links without sign-in, using unguessable tokens, optional expiry, immediate revocation and scoped document access. Exclude public invoice pages from indexing.
- Draft polite overdue reminders for review. Automated sending remains off until enabled in settings.
- Recurring schedules create reviewable drafts with new dates; handle month-end, timezone changes, pauses and repeated job execution without duplicates.
- Optional reminder schedules respect current balance, paused follow-ups, bounced recipients and a fresh payment check before sending.
- Use scheduled handlers and, if needed, queue consumers in the same Worker deployment for durable background delivery.

Completion: duplicate requests/events do not duplicate sends or recurring drafts; revocation prevents further retrieval; paid and void invoices do not receive scheduled overdue reminders.

## 7. Backup, polish and launch

- Export invoices, clients, projects, services, payments and business settings in machine-readable form, plus a bundle of issued PDFs. Document export versions and a tested restore procedure.
- Complete loading, empty, error and offline states; keyboard focus, accessible dialogs, contrast, reduced motion and small-screen layouts.
- Use all requested UI libraries selectively with documented component provenance and licences, keeping the established layout coherent.
- Exercise the full journey: sign in → configure business → choose client → draft/autosave → issue → PDF → email/share → partial payment → paid → export.
- Test with synthetic data, including a multi-page invoice and a two-device edit conflict. Do not import existing invoice files without a separate import decision.
- Configure production Neon, private file storage, Resend sender domain/secrets, authentication settings and Cloudflare custom domain invoiceui.humza.website.
- Validate database migrations/backups, logs without sensitive payloads, rollback steps and production smoke checks. Confirm actual account plans and any new resource costs before provisioning chargeable services.

Completion: all acceptance checks pass in staging; production is reachable on the custom domain and the owner can complete the real workflow from desktop and phone.

## Milestones and dependencies

1. Phases 1–3: private, persistent invoice workspace.
2. Phases 4–5: daily-use invoicing, downloads and payment tracking.
3. Phase 6: client delivery, sharing and opt-in automation.
4. Phase 7: complete release and operational handover.

Data/authentication must precede private APIs. The document snapshot model must precede email/share links. The payment ledger and safe send retries must precede automated reminders. Settings and templates must precede recurring drafts.

## Required setup information

- Owner login email and preferred authentication method; default proposal is passwordless owner-only access.
- Real business/bank details, logo, numbering preference and whether tax fields apply.
- Cloudflare account/zone access, Neon database access, and Resend sender verification/API credentials via local secret files or provider secret storage.

These inputs are needed at their integration stages; they do not block component development and synthetic-data testing. Online card collection, automatic currency conversion and historical invoice import are separate future scope, not dependencies of this plan.
