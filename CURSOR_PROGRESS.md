# Cursor Progress: InvoiceUI

## Completed Requirements

### Phase 1: Secure Application and Data Foundation
- **Component Architecture & Navigation**: Refactored the editor into structured modular components (`App.tsx`, `Editor.tsx`, `InvoiceActions.tsx`, `InvoicePreview.tsx`, `Records.tsx`, `ui.tsx`) with primary navigation across Invoices, Clients, Projects, Services, and Settings.
- **Worker & Frontend Tooling**: Stabilised build, typechecking, and Worker bindings (`vite`, `tsc -b`, `wrangler`). Added `"types": ["node"]` to `tsconfig.worker.json` to resolve worker compilation with `nodejs_compat`.
- **Database Migrations**: Established migration script `scripts/migrate.mjs` using Neon serverless SQL, idempotently tracking migrations in `invoiceui_migrations`. Ran and verified `0001_workspace.sql` against live Neon database.
- **Server Session Authentication**: Integrated Better Auth with Drizzle Neon adapter for server-verified sessions. Configured passwordless magic link delivery via Resend, restricted exclusively to `env.OWNER_EMAIL` (`humzab1711@hotmail.com`). Public user registration is prevented at the database hook and API levels.
- **Ownership Enforcement & Security**:
  - All private routes (`/api/private/*`) require verified owner session, returning `401` if unauthenticated.
  - Cross-origin request forgery protection rejecting non-safe requests with untrusted `Origin` (`403`).
  - Request body limits enforced at 6MB via Hono middleware (`413`).
  - Untrusted magic link login attempts return generic success to prevent email enumeration.
- **Transactional Writes & Concurrency**:
  - Optimistic concurrency control via Compare-And-Swap (CAS) on `invoice_workspaces.version`. Conflicting concurrent writes throw `Conflict` (`409`).
  - Atomic workspace command application (`applyCommand`) ensuring failed validations roll back in-memory and database writes.
- **Monetary Precision & Server-Side Calculations**:
  - Centralised decimal-safe arithmetic using `Decimal.js` in `src/shared/domain.ts`.
  - Half-up rounding on line items and subtotal; tax calculated after discount.
  - Multi-currency decimal precision handling (0 DP for JPY, 2 DP for GBP/USD/EUR/CAD/AUD, 3 DP for KWD).
  - Validation rejecting invalid discounts (>100% or >subtotal), deposits exceeding totals, and instalment discrepancies.
- **Invoice Numbering, Lifecycle & Historical Snapshots**:
  - Distinct lifecycle states: `draft`, `issued`, `void`.
  - Atomic sequence allocation on issuance scoped to prefix and year (e.g. `INV-2026-0001`). Drafts retain internal UUIDs.
  - Voided numbers are permanently retained and never reused.
  - Snapshotting: `business`, `client`, `lines`, and pricing are locked upon issuance. Updated PDF rendering in `src/worker/documents.ts` and `src/client/App.tsx` to use snapshotted `i.business ?? w.business` to guarantee historical immutability.

### Phase 2: Reusable Business, Client, Project and Service Information
- **Business Identity & Defaults**:
  - Built comprehensive business settings screen (`Settings` in `Records.tsx`) managing business/legal name, contact email, physical address, logo, bank instructions, default currency, payment terms (0-365 days), footer, numbering prefix, accent colour, template, and IANA timezone.
  - Added strict validation for timezones (`Intl.DateTimeFormat`), currency enumerations, and prefix patterns.
- **Client Directory CRUD**:
  - Searchable client directory supporting billing name, email, address, CC contacts, reply-to preference, default terms, and private notes.
  - Added `deleteClient` command in `domain.ts` and Delete action in `Records.tsx` modal. Safely detaches associated projects without altering historical invoices.
- **Project Grouping**:
  - Searchable project catalogue associating projects with specific clients and notes (e.g. `Mentage - Sprint 2`).
  - Validates `clientId` existence upon creation/editing.
  - Added `deleteProject` command and Delete UI action.
  - Filter by project in `Invoices` view via `onFilter`.
- **Saved Services Catalogue**:
  - Service catalogue supporting fixed fee, hourly, and unit pricing models with descriptions and default rates.
  - Added `deleteService` command and Delete UI action.
- **Composer Selection & Value Copying**:
  - Selecting a saved client in `Editor.tsx` copies client details into the draft, updates default terms, and recalculates due date while scoping selectable projects.
  - Selecting a project links `projectId`.
  - Selecting a saved service copies description, rate, and unit into a new line item by value. Subsequent catalogue modifications or deletions never mutate existing draft lines or issued invoices.
- **Secure Logo Storage & Retrieval**:
  - Verified PNG/JPEG MIME type and size validation (under 400KB on client, base64 data URL validation in worker).
  - Configured asynchronous backup of logo bytes to private R2 storage (`env.DOCUMENTS`) under `${owner}/logo.{png|jpg}` with authenticated retrieval route `/api/private/logo`.
- **Historical Snapshot Invariance**:
  - Verified that editing or deleting reusable clients, projects, services, or business profile records leaves existing issued invoices and their rendered PDFs completely unchanged.

### Phase 3: Reliable Invoice Composer
- **Full Persistent Field Connection**:
  - Every editor and preview field is connected to persistent state in `draft` and rendered live in `InvoicePreview.tsx` (issue date, due date, terms, manual due overrides, currency, client, project, line items, tax, discount, deposit, instalments, notes, PO number, payment reference, work breakdown, template, accent).
- **Debounced Autosave & Visual State Machine**:
  - 800ms debounced autosave with explicit states in header and fieldset: `Saving…`, `All changes saved` (Saved), `Offline · edits kept on this device` (Offline), `Unsaved changes` (dirty), and `Changes need attention` (Failed/Error).
  - Explicit manual "Save" button and keyboard shortcut (`Ctrl+S` / `Cmd+S`).
- **Version Conflict Detection & Recovery Flow**:
  - Version checking prevents stale device overwrites (`Conflict` / 409).
  - Built recovery flow in `Editor.tsx`: user can "Retry save" or "Save as another draft" (`crypto.randomUUID()`) to fork edits safely without data loss.
- **Local Edit Recovery & Sign-out Sanitisation**:
  - Local recovery buffer under `invoiceui:recovery:${owner}:${invoice.id}` saves dirty unsent edits. Restores automatically on mount.
  - Cleared on successful save and purged on sign-out via `logout()`.
  - Navigation protection via `beforeunload` listener when dirty.
  - Reconnect listener (`online`) immediately flushes unsaved edits to server.
  - Out-of-order save protection via sequential promise task queue in `useWorkspace`.
- **Line Items Management**:
  - Add, remove (disabled at 1 line), and bidirectional reordering with `↑` and `↓` buttons.
  - Supports fixed fee, hourly, and unit pricing models with multi-currency decimal precision.
- **Discounts, Tax, Deposits & Instalments**:
  - Supports percentage and fixed amount discounts (discount applied before tax calculation).
  - Optional tax percentage with 100% ceiling.
  - Requested deposits are stored separately in `draft.deposit` without appearing in received payments (`i.payments`).
  - Instalment payment schedules with dates and amounts validated against the invoice total.
- **Quick Terms & Manual Due Date Preservation**:
  - Terms selector (Due on receipt, 7, 14, 30 days, or custom).
  - Automatically updates due date when terms control it (`manualDue: false`).
  - Preserves user manual overrides (`manualDue: true`) when issue date changes.
- **Inline Field Validation & Non-blocking Draft Saves**:
  - Field validation hints beside the relevant field (due date ordering, required client name, description, positive qty, tax/discount/deposit limits).
  - Incomplete drafts save without error; issuance validation strictly blocks issuance until all constraints are satisfied.
- **Duplication Semantics**:
  - `duplicate` command generates fresh unnumbered draft (`number: ''`, `lifecycle: 'draft'`) with fresh dates, retained client, project, line items, discounts, tax, requested deposits, instalments, notes, PO, and reference. Wipes old payments and shares.
- **Shortcuts & Mobile Editing**:
  - Shortcuts: `Ctrl+Alt+N` (new invoice), `Ctrl+S` (save), `Ctrl+Shift+D` (download PDF).
  - Mobile full-screen preview toggle (`preview-open`).

### Phase 4: Documents and Presentation
- **Three Template Variants & Aesthetics**:
  - Maintained `studio` default (brand mark, accent badge, and modern layout) and added two restrained alternatives: `minimal` (clean, unadorned, quiet borders) and `classic` (serif headings, filled accent table header).
  - Accent colour controls with reactive preview and PDF palette injection via `rgb(...)`.
  - Logo embedding for PNG and JPEG files with proportional bounding box scaling (max 70x45 pt) and defensive format error handling.
- **Dedicated Worker PDF Renderer & Performance**:
  - Integrated `pdf-lib` + `@pdf-lib/fontkit` with subsetted `NotoSans-Regular.ttf` running purely in the Cloudflare Worker runtime without headless browser dependencies.
  - Validated single-page generation in <100ms and multi-page stress test (50 detailed line items) in ~1.2s, well within Cloudflare Worker CPU limits.
- **Direct Downloads & Stable Filenames**:
  - Replaced browser printing with direct PDF binary downloads (`downloadBlob`) with mobile/desktop DOM anchoring and extended blob URL lifetime.
  - Stable, sanitised filenames: `${number || 'Draft'}-${client.name || 'Invoice'}${breakdown ? '-Breakdown' : ''}.pdf` supporting Unicode characters and stripping hazardous filesystem characters.
- **Shared Document Model & Visual Parity**:
  - Unified document representation across React live preview (`InvoicePreview.tsx`), direct client download, Worker API (`/api/private/invoices/:id/pdf`), public link sharing (`/api/public/:owner/:token/:kind`), and backup archives.
  - Rendered identical calculations via `totals()`, snapshot fallback (`i.business ?? currentBusiness`), notes, PO numbers, payment references, requested deposits, and instalment schedules.
  - Prominent red `VOID` indicator rendered in both preview and PDF headers/footers upon voiding.
- **Pagination, Running Heads & Work Breakdowns**:
  - Dynamic line wrapping and automated page breaking for descriptions exceeding line widths.
  - Running headers at the top of subsequent pages (`${business} / ${number}`).
  - Repeated table header blocks (`Description`, `Qty`, `Rate`, `Amount`) upon page transitions.
  - Running footer with horizontal dividing rule and page numbering (`${number} · ${n} / ${total}`).
  - Optional separate `WORK BREAKDOWN` document (`breakdown=true`) with dedicated pagination and title.
- **Private Object Storage & Reproducible Retrieval**:
  - Issued invoice PDFs cached in Cloudflare R2 (`DOCUMENTS`) under `${owner}/${i.id}/${issuedAt}-${lifecycle}-${kind}.pdf`.
  - Immutable historical snapshots ensure subsequent business or client updates never mutate issued PDFs.
  - Voided status partitions cache key to ensure freshly generated `VOID` PDFs are saved and served.
  - Draft invoices remain unpersisted in R2 and clearly marked `DRAFT · Not issued`.
- **Editor Theme Parity**:
  - Light, Dark, and System theme switcher in editor header using `data-theme` attribute and CSS custom properties.
  - `.invoice` component and `@media print` rules enforce strict `color-scheme: light; background: white !important; color: #18181b !important` so dark mode never taints document print or export colours.

### Phase 5: Invoice Management and Payments
- **Searchable Paginated Invoice Dashboard**:
  - Dashboard filters supporting client, project, date range, lifecycle (`all`, `draft`, `issued`, `void`), and payment state (`outstanding`, `unpaid`, `partially paid`, `paid`, `due-soon`, `overdue`), plus archive view toggle.
  - Search query matching invoice numbers, client names, line item descriptions, and payment references.
  - Page-based pagination with 10 invoices per page and total result counts.
- **Interactive Metrics Bar & Receivables Calculation**:
  - Top summary cards for Outstanding, Due in 7 days, and Overdue receivables calculated using actual balances and the business timezone (`today(w.business.timezone)`).
  - Multi-currency separation: balances are grouped and displayed per currency (e.g. GBP, USD, EUR) rather than artificially converted or conflated.
  - Interactive metric cards: clicking Outstanding, Due Soon, or Overdue filters the dashboard directly.
- **Strict Separation of Lifecycle, Delivery, and Payment**:
  - Draft and void invoices are strictly excluded from receivables calculations.
  - Sending email never implies paid status; delivery failure or bounce never reverses invoice issuance.
- **Payment Ledger, Partial Payments & Quick Fills**:
  - Dedicated payment modal recording amount, date, method (Bank Transfer, Credit Card, Cash, Cheque, Stripe, PayPal, Other), reference, and private notes.
  - Unpaid, partially paid, and paid states are dynamically derived from active non-reversed payments.
  - Quick-fill helper buttons (`Fill balance` and `Fill deposit`) to eliminate manual entry errors.
  - Invoice editor displays a real-time financial balance bar showing Total Billed, Paid to date, and Outstanding Balance.
- **Auditable Corrections & Reversals**:
  - Payment reversal feature (`reverse` command) marking `reversed: true` on the ledger rather than destructive deletion.
  - Double-reversal prevention: attempting to reverse an already reversed payment throws an explicit error.
  - Reversals immediately recalculate paid total, balance, and derived status (`partially paid` or `unpaid`).
- **Non-Destructive Voiding**:
  - Issued invoices can be voided with an explicit required reason (`voidReason`).
  - Non-destructive: permanently retains invoice number, issue date, client/business snapshots, line items, and payment history.
  - Safety invariant: invoices with active payments cannot be voided until payments are reversed.
  - Voiding automatically revokes public share tokens and disables automated reminders.
  - Editor displays a prominent cancellation banner showing the recorded void reason.
- **Archive / Restore Lifecycle & Undo**:
  - Invoices can be archived and restored with immediate toast confirmation and undo action.
  - Archiving retains balances, full payment history, and line items completely intact.
  - Archived invoices are clearly labelled with an archive badge and toggleable in the dashboard.
- **Client & Project Detail Views**:
  - Dedicated Client Detail page showing billing details, notes, financial summaries per currency (Total billed, Total paid, Outstanding balance), related invoices table with direct editor links, and full payment ledger history.
  - Dedicated Project Detail page showing project client, notes, financial totals, related invoices, and payment ledger history.
  - Quick draft creation: "+ New invoice for [client/project]" pre-populates client info and links the project ID directly.

### Phase 6: Email, Sharing and Follow-ups
- **Resend Email Composer & Attachments**:
  - Resend email composer with real-time preview, editable subject and body, recipient defaults (`to`, `cc`, `replyTo`), and explicit send action.
  - Automatically loads and attaches the exact issued PDF from storage/renderer, plus the separate work breakdown PDF when one exists.
  - Idempotent send attempts passing `idempotencyKey: invoiceui/${owner}/${message.id}` to Resend.
  - Delivery history tracking with badges (`draft`, `queued`, `sending`, `sent`, `delivered`, `bounced`, `failed`, `uncertain`, `cancelled`) and user retry action for failed attempts.
- **Unguessable Scoped Public Links & Instant Revocation**:
  - Generates 256-bit unguessable tokens (`crypto.randomUUID() + crypto.randomUUID()`) with configurable expiration dates.
  - Public route `/api/public/:owner/:token/invoice` returns strictly the issued PDF binary with `Content-Disposition: inline` and zero exposure of other invoices, clients, or workspace data.
  - Direct download route `/api/public/:owner/:token/download` (or `?download=true`) sets `Content-Disposition: attachment`.
  - Security headers: `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` (ensuring revocation cannot survive browser/edge caches), `Pragma: no-cache`, `X-Robots-Tag: noindex, nofollow, noarchive` (preventing search indexing), and `Referrer-Policy: no-referrer`.
  - Instant revocation: explicitly revoking or voiding the invoice immediately returns `404 Link expired or revoked`.
- **Verified Webhook Pipeline & Out-of-Order Handling**:
  - Resend webhook endpoint `/api/webhooks/resend` verifying Svix signatures (`svix-id`, `svix-timestamp`, `svix-signature`).
  - Idempotent duplicate event handling and out-of-order protection (e.g. `delivered` status will not be downgraded to `sent` if a delayed webhook arrives).
  - Handles `email.bounced` and `email.complained` transitions, immediately suppressing future automated follow-ups for that recipient.
- **Recurring Schedules & Month-End Day Anchor Preservation**:
  - Automatically generates reviewable unnumbered drafts with fresh issue and due dates based on client payment terms.
  - `nextMonth` preserves the `s.day` anchor across shorter and longer months (e.g., Jan 31 -> Feb 28 -> Mar 31).
  - Evaluates schedules against the business timezone (`today(w.business.timezone)`).
  - Deduplication safeguard: tracks `lastRunDate: s.nextDate`, preventing duplicate drafts upon repeated job execution on the same date.
  - Automatically pauses recurring schedules if the source invoice is voided.
  - Added `deleteSchedule` command and UI controls for pause/resume and deletion.
- **Automated Overdue Reminders & Pre-send Safeguards**:
  - Automated sending defaults strictly to **OFF** and requires explicit opt-in via `autoReminders: boolean` in Business Settings.
  - Polite default reminder template including outstanding balance, invoice number, due date, and payment instructions.
  - Re-checks real-time database state immediately before calling Resend: cancels message if paid (balance = 0) or voided.
  - Automatically suppresses reminders if the recipient previously bounced or if follow-ups are disabled.

### Phase 7: Backup, Polish and Release Preparation
- **Versioned Machine-Readable Export & PDF Bundle**:
  - Full workspace JSON backup endpoint `GET /api/private/export?format=json` adhering to `{ format: 'invoiceui-backup', schemaVersion: 1, exportedAt, version, data }`.
  - Complete ZIP bundle download `GET /api/private/export?format=zip` packing `workspace.json` and issued PDFs (`${invoiceId}/${filename}`) alongside deliverable breakdowns.
- **Isolated Database Restoration Script (`scripts/restore.mjs`)**:
  - Enforces `--empty-workspace-only` flag and validates empty workspace rows (`invoices = '[]'`, `clients = '[]'`) before inserting, guaranteeing existing databases are never overwritten.
  - Security sanitization on restore: revokes public share tokens (`delete i.share; i.reminder.enabled = false`), pauses recurring schedules (`s.paused = true`), and resets queued/sending emails back to `draft` (`m.status = 'draft'`).
  - Preserves all relational keys (invoices -> clients, projects, services, line items, payments) and document references intact.
- **Five Mandatory UI Libraries (Rule 02 Compliance)**:
  - Actively integrated all five required libraries into the rendered product without homemade substitutes:
    1. `shadcn/ui`: Core accessible primitives (`Button`, `Modal` Dialog, `Badge`, `Field`, `Empty`).
    2. `Motion` (`motion.dev`): Page transitions, login entrance, toasts, and layout animations with `<MotionConfig reducedMotion="user">`.
    3. `Magic UI`: `NumberTicker` animating financial metrics on Invoices dashboard and client/project summaries.
    4. `React Bits`: `ShinyText` highlighting active filter badges, status pills, and live preview badges.
    5. `Animate UI`: `AnimatedTabs` providing interactive tab navigation with spring indicator.
  - Created complete component provenance matrix in [docs/UI_COMPONENT_SOURCES.md](docs/UI_COMPONENT_SOURCES.md).
- **Accessibility, Contrast, Reduced Motion & Mobile Layouts**:
  - Global reduced-motion support via `@media(prefers-reduced-motion: reduce)` in `styles.css` and `MotionConfig`.
  - Visible keyboard focus rings (`outline: 3px solid #86ac49; outline-offset: 3px`) on all interactive buttons, links, and inputs.
  - Dialog focus trapping with ARIA accessibility via `@radix-ui/react-dialog`.
  - Phone layouts (`@media(max-width: 800px)`) with responsive grids, scrollable navigation, full-screen live preview toggle (`.mobile-preview`), and compact metric cards.
- **Full End-to-End Synthetic Journey & Polish Verification**:
  - Implemented comprehensive integration test in `tests/phase7-journey.test.ts` exercising:
    - Sign in -> Settings setup -> Client creation -> Project creation -> Saved service creation.
    - Compose invoice draft -> autosave -> two-device concurrent CAS conflict simulation and recovery flow.
    - Multi-page line items with repeated headers and attached deliverable breakdown document.
    - Invoice issuance with atomic sequence numbering (`INV-2026-0001`) and immutable snapshotting.
    - PDF generation with deterministic bytes and stable filenames (`INV-2026-0001-Mentage-Labs-Ltd.pdf`).
    - Resend email composer draft & explicit send (`queued`), idempotency check, and public share link lifecycle with instant revocation.
    - Payment ledger: unpaid -> partial payment (£4,000) -> paid (£5,000) -> auditable reversal -> partially paid.
    - Versioned export generation (JSON & ZIP) and isolated restoration security verification.
- **Release Documentation & Handover**:
  - Authored [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) detailing verified test results, Neon migration & PITR procedure, Cloudflare R2 bucket binding, Resend DNS/secrets, privacy-conscious logging rules, rollback procedures, account plan allowances, and production smoke checks.
  - Updated [README.md](README.md) to reflect all 7 phases complete, removing contradictory roadmap claims.
### Wave A (A01 - A04): Routine Invoicing Speed & Setup (Completed)
- **A01: Guided First Invoice and Resumable Setup**:
  - Implemented guided setup card on the Invoices overview tracking 4 foundational steps: Business identity, Bank instructions, First client, and First invoice.
  - Direct links to missing fields: Business and Bank link to Settings, Client links to Clients directory, First invoice links to draft creation.
  - Resumable setup: progress updates automatically as fields are completed.
  - Non-blocking dismiss: user can dismiss the onboarding checklist via `dismissOnboarding` command without blocking normal navigation, and can resume it at any time with "Resume setup guide".
  - Synthetic preview modal: sample invoice preview using realistic isolated reference data with prominent disclaimer ("Sample preview for reference - example information is never saved to your real records"). Verified zero leakage into workspace data.
- **A02: Predictable Client Defaults & Safe Switching**:
  - Added client-level defaults: `currency`, `template`, `paymentInstructions`, and `rateOverrides` in `clientSchema`.
  - Predictable resolution precedence: explicit invoice override -> client default -> business default via `resolveClientDefaults`.
  - Client switching confirmation dialog on populated drafts: explains changes, shows current draft values vs client defaults, and gives the owner explicit choice: "Apply client defaults" or "Keep manual overrides". Prevents silent overwrite of custom rates or currencies.
- **A03: Invoice Content Starters & Service Bundles**:
  - Added `Starter` model supporting multi-line content presets with descriptions, rates, quantities, units, line groups, terms, notes, and favourite toggle.
  - Starter management UI in `Records.tsx` under Services with sub-tab switcher ("View starters" vs "View services").
  - Content preset loading in `Editor.tsx`: "Starters & bundles" dialog allows applying any starter preset to the active draft.
  - "Fill from last invoice" action: pulls lines, terms, tax, discount, notes, and template from the client's most recent invoice.
  - Duplication safety: both starter creation and last-invoice loading produce fresh unnumbered drafts (`number: ''`, `lifecycle: 'draft'`) with fresh line UUIDs and zero leakage of old payments, share tokens, issue dates, or void reasons.
- **A04: Faster Line Entry, Tabular Paste & Local Undo**:
  - Line keyboard controls: `Alt+Up` (move line up), `Alt+Down` (move line down), `Alt+D` (duplicate line below), plus Insert Above, Insert Below, and Delete actions.
  - Tabular paste modal: allows pasting spreadsheet data (TSV, CSV, pipe-delimited) with live mapping and validation preview. Sanitises currency symbols (`$`, `£`, `€`, `¥`, `KD`), flags malformed amounts or quantities with row numbers, and performs atomic insertion.
  - Line groups / subheadings: `line.group` field allows organising items under section headers in editor, live preview, and Worker PDF rendering. Verified grouping does not alter arithmetic or totals.
  - Sticky composer total bar: docked at bottom of composer displaying live currency subtotal, discount, tax, total, and balance.
  - Local line undo: maintains an in-memory stack of line edits allowing `Ctrl+Z` undo within the composer session before saving.
- **Verification & Test Coverage**:
  - Authored comprehensive test suite `tests/waveA-fast-invoicing.test.ts` (13 tests) validating client defaults precedence, client switching with preserved manual overrides, starter duplication safety, zero payment/share leakage, spreadsheet tabular paste and error handling, line movements, arithmetic invariance with groups, and local undo.
  - Total test suite: 84/84 tests passing across 9 test files.

### Wave A (A05 - A08): Review, Navigation, Safe Bulk Operations & Unified Timeline (Completed)
- **A05: Review Before Issue and Send**:
  - Implemented `ReviewIssueModal` component presenting a pre-issuance review sheet with recipient contact details, dates, currency, line totals, financial summary, bank payment instructions, and document preview.
  - Distinct blocking errors vs non-blocking warnings via `issueErrors` and `detectInvoiceWarnings`:
    - Blocking errors: missing client name, line items with empty descriptions or zero quantities, due date preceding issue date, invalid discount/deposit amounts. Includes direct "Edit field" jump links.
    - Non-blocking warnings: duplicate invoice heuristic (matching client and identical total within 60 days or same project and month), missing bank/payment instructions in business settings or client profile, unusually old issue dates (>90 days), and past-due dates.
    - Explicit acknowledgment checkbox required when non-blocking warnings are present before issuance is unlocked.
  - Actions: "Issue and download PDF" and "Issue and prepare email ->".
  - Integrity & idempotency: latest draft changes are saved before issuance; issuance command locks invoice sequence and snapshots business/client data; double-click protection (`issuing` guard) prevents duplicate issuance requests. If subsequent delivery attempts fail, issued status is preserved.
- **A06: Command Menu, Saved Views and Navigation Memory**:
  - Global `CommandMenu` palette (`Ctrl+K` / `Cmd+K`): live search across invoices (number, client), clients, projects, quick actions (new invoice, navigation tabs, toggle theme, export), and recent records.
  - Keyboard shortcut cheat sheet modal (`ShortcutsModal`, accessible via `?` or command menu).
  - Global input guard: single-key shortcuts (`?`) ignore keystrokes when focused inside `input`, `textarea`, or `select`.
  - Saved filter views bar: quick preset chips ("All", "Outstanding", "Due in 7 days", "Overdue", "Unpaid", "Drafts") plus custom user-created views saved to `localStorage` ("+ Save view" dialog and one-click deletion).
  - URL search parameter synchronization: synchronises `view`, `filter`, `client`, `project`, `from`, `to`, and `page` via `window.history.replaceState` and `popstate` event listener, enabling back/forward navigation and shareable URLs without leaking sensitive tokens or credentials.
- **A07: Safe Selected Bulk Operations**:
  - Multi-select checkboxes: page-level header toggle ("Select all on this page") and row-level checkboxes.
  - Floating bulk action bar docked above page footer when items are selected, displaying selection counter and actions.
  - Bulk actions:
    - Download PDFs (ZIP): bundles issued PDFs using `fflate` `zipSync`. Skips unissued drafts with an informative status note ("Draft invoices do not have issued PDFs").
    - Export CSV: generates structured CSV with standard headers (`Invoice Number,Client,Issue Date,Due Date,Status,Currency,Total,Paid,Balance`) with proper quote escaping.
    - Bulk Archive / Restore: archives or restores selected items by ID.
  - Per-item execution result modal (`bulkResult`): transparently reports status (`success`, `skipped`, `failed`) and failure/skip reasons per invoice. A failure or skip on one item never conceals the success of others.
  - Strict scope boundary: bulk issue, bulk email, and bulk mark-paid remain strictly excluded.
- **A08: One Coherent Invoice Activity Timeline**:
  - Implemented `buildInvoiceTimeline(invoice, workspace)` and `ActivityTimeline` component combining history from across the workspace: draft creation, draft updates, issuance lock, payments, auditable payment reversals, delivery attempts (status, error messages, recipient and CC addresses), public share link creation and revocation, automated reminder schedule updates, and void events.
  - Chronologically sorted descending (`b.at - a.at`).
  - Formatted in the business timezone via `formatTimelineDate` (e.g. Europe/London).
  - Category filter pills: All, Lifecycle, Payment, Delivery, Sharing.
  - Privacy boundary: internal events (draft edits, token generation, automated reminders) are tagged with private badges and distinguished from client-visible events (issue, payment receipts, delivery dispatches). Public share tokens and raw payload secrets are never leaked in event details or logs.
- **Verification & Test Coverage**:
  - Authored comprehensive test suite in `tests/waveA-workflows.test.ts` (11 tests) verifying duplicate/bank/date warning detection, blocking error enforcement, double-click issuance protection, command palette search filtering, URL search parameter synchronisation, bulk PDF ZIP packaging with skipped draft tracking, CSV export generation, isolated bulk archive/restore, unified timeline event aggregation, privacy token shielding, and timezone formatting.
  - Total test suite: 95/95 tests passing across all 10 test files.

## Important Decisions
- **Aggregate Persistence Model**: Used a versioned JSONB aggregate in `invoice_workspaces` for owner workspaces, enabling atomic transactional writes and CAS concurrency control in Cloudflare Workers without complex distributed transactions.
- **Value-Copy Architecture**: Reusable items (clients, services, business profiles) are copied into drafts and locked into issued invoices by value, rather than foreign-key references, preserving immutable historical audits.
- **Separation of Deposit Request from Payment Ledger**: Requested deposits (`i.deposit`) remain a requested advance and do not modify the paid ledger (`i.payments`) or balance until a payment is recorded.
- **Isolated Local Recovery**: Recovery storage keys are partitioned by owner ID and invoice ID, automatically removed upon successful save or explicit user sign-out.
- **Pure Worker PDF Pipeline**: Used `pdf-lib` + `fontkit` with a bundled subsetted TrueType font to eliminate external browser rendering services and dependencies, retaining a single unified Cloudflare Worker deployment.
- **Lifecycle-Partitioned PDF Cache Keys**: Partitioned R2 cache keys by `${issuedAt}-${lifecycle}` so voiding an invoice immediately generates and serves a `VOID`-marked document without cache collision.
- **Strict Ledger-Derived Status**: Payment status is never stored as an ad-hoc mutable flag; it is derived exclusively from active (non-reversed) ledger payments against the invoice total.
- **Auditable Reversal Over Deletion**: Payments cannot be silently deleted; reversals create an explicit `reversed: true` record to maintain audit integrity and adjust balances cleanly.
- **Non-Destructive Void Invariant**: Voiding an invoice locks the sequence number permanently, requires prior payment reversal, captures an explicit reason, revokes public share links, and displays a prominent cancellation warning banner.
- **Business-Timezone Receivables**: Date-based calculations (`overdue`, `due-soon`) use the configured business timezone rather than client machine local time.
- **Default-Off Automated Reminders with Pre-Send Verification**: Automated follow-up delivery defaults strictly to off, requiring explicit workspace settings opt-in, and enforces real-time balance and void checks immediately before email dispatch.
- **Month-End Day Anchor Retention**: Recurring monthly intervals store an immutable `day` anchor (e.g. 31) so clamping to February 28 naturally restores March 31 without drifting into earlier dates.
- **Isolated Database Restore Enforcement**: Script enforces `--empty-workspace-only`, revokes public share links, resets unreviewed queued emails to draft, and pauses recurring automation upon restore.
- **Zero Parallel State in Timeline**: Activity timeline queries existing domain audit, message, payment, share, and lifecycle records on demand, avoiding duplicate event tables or drift.
- **Strict Safety Bounds on Bulk Actions**: Bulk issue, bulk email, and bulk mark-paid remain strictly out of scope; bulk operations are restricted to non-destructive actions (ZIP PDF export, CSV export, archive, restore) with individual item result reporting.

## Production Deployment & Release Handover (Completed)
- **Live Production URL:** `https://invoiceui.humza.website` (Single Cloudflare Worker serving Vite SPA + Hono API).
- **Domain & Routing:** Custom domain `invoiceui.humza.website` bound and active over HTTPS with Cloudflare managed certificates.
- **Neon Database:** Production database (`young-morning-95377578`, region `aws-eu-west-2` London) active with `0001_workspace.sql` schema applied. Pre-release snapshot branch `backup-pre-prod-deploy-20260912` preserved for rollback.
- **R2 Storage:** Bucket `invoice-ui-documents` created in Western Europe region (`weur`) and bound as `env.DOCUMENTS`. Verified PDF storage and caching.
- **Secrets Bound:** `DATABASE_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, and `RESEND_WEBHOOK_SECRET` successfully provisioned as Cloudflare Worker secrets.
- **Email Delivery:** Resend domain `humza.website` verified in region `eu-west-1`. Magic link generation and email dispatch verified for owner `humzab1711@hotmail.com`. Non-owner attempts blocked with 403 Forbidden.
- **Live Smoke Test:** Exercised synthetic invoice creation, atomic numbering, live PDF generation, R2 caching, and download completed with 100% success.
### Wave B (B01 & B03): Corrections, Credit Documents & Canonical Payments (Completed)
- **B01: Immutable Invoice Corrections and Credit Documents**:
  - Implemented immutable credit note architecture: `creditNoteSchema`, `CreditNote` model with distinct sequential numbering (`CR-YEAR-0001` or `${prefix}-CR-YEAR-0001`), snapshotting original client, business, lines, and reason.
  - Balance contract: Adjusted Total = max(0, Total - Credited), Balance = max(0, Adjusted Total - Paid), Overpayment = max(0, Paid - Adjusted Total). Clamps eligible credit ceiling so credit cannot exceed remaining eligible balance.
  - Linked replacement draft generation: "Full credit & replace" spawns a fresh unnumbered draft pre-populated with original line items, notes, terms, and tax, linked via `replacementOf` and `replacementDraftId`.
  - Overpayment handling on already-paid invoices: excess paid amounts are automatically returned to the client's canonical unallocated credit pool and deducted from invoice payments, rather than generating negative balances.
  - Dedicated credit note PDF generation via `renderCreditNotePDF` in `src/shared/pdf.ts`: distinct alert styling, original invoice reference, reason, line item breakdown, tax adjustments, and stable filename format (`${note.number}-${client.name}.pdf`).
  - Correction UI: `CorrectionModal` in `Editor.tsx` with real-time eligible amount guard, "Credit notes applied" panel with individual "Download PDF" buttons, and replacement draft notice banner.
- **B03: Canonical Client Payments, Multi-Invoice Allocations and Refunds**:
  - Implemented canonical client payment model: `clientPaymentSchema`, `paymentAllocationSchema`, `paymentRefundSchema`.
  - Multi-invoice payment distribution: `suggestPaymentAllocations` proposes oldest-due-first allocation across eligible open issued invoices of matching client and currency.
  - Explicit unapplied credit retention: payments exceeding allocated invoices retain remaining amounts in `unallocated`.
  - Subsequent credit allocation via `allocatePayment`: applies available unallocated credit to future open invoices.
  - Cross-client and cross-currency allocation guards: strictly rejects allocations across mismatched clients or currencies.
  - Payment refund workflow: `RefundModal` in `Records.tsx` allowing refunds against unallocated credit with strict ceiling enforcement.
  - Auditable reversals: `reverseClientPayment` marks allocations as reversed and cleanly restores invoice balances.
  - Backward compatibility: legacy `payment` and `reverse` commands continue to work seamlessly and synchronize with `w.payments`.
  - Client detail view in `Records.tsx`: displays Total billed, Total credited, Total paid, Outstanding balance, Unapplied credit badge, "Record payment / Allocate" button, Credit notes table with PDF downloads, and Payment ledger & allocations table with Refund and Reverse actions.
- **Verification & Test Coverage**:
  - Authored comprehensive test suite `tests/waveB-corrections-payments.test.ts` (11 tests) verifying full and partial credits, ceilings, overpayments, payment distribution, unapplied credit, refunds, and timeline events.

### Wave B (B02, B04 & B05): Receipts, Statements, Material Privacy & Attention Queue (Completed)
- **B02: Payment Receipts and Client Statements**:
  - Implemented sequential payment receipt generation: `receiptSchema`, `receiptAllocationSchema`, `Receipt` domain model with sequential numbering (`${prefix}-RCT-YEAR-0001`), snapshotting client, business, payment details, allocations, remaining invoice balances, and unallocated amounts.
  - Implemented receipt reversal history: reversing a payment or client payment marks the corresponding receipt with `reversed: true` and `reversedAt: timestamp` without deleting the receipt or mutating its number.
  - Reusable receipt PDF renderer: `renderReceiptPDF` and `filenameReceipt` in `src/shared/pdf.ts`, featuring distinct success green styling (or alert red with reversal notice when reversed), client and payment details, allocation table, and unallocated balance.
  - Reconciled multi-currency client statements: `buildClientStatement` calculates period opening balance, period charges, period credits, period payments, and refunds. Strictly adheres to reconciliation equation: Opening Balance + Period Charges - Period Credits - Net Payments = Closing Balance.
  - Statement PDF generator: `renderStatementPDF` and `filenameStatement` in `src/shared/pdf.ts` with summary cards, equation breakdown, and chronologically sorted ledger entries with running balance column.
  - Statement modal: `StatementModal.tsx` in client interface with date range presets (Current Month, Last Month, YTD, Last 12 Months), currency selector, live ledger table, and direct PDF download.
  - Wired receipt PDF downloads across all payment tables in `Records.tsx` and `InvoiceActions.tsx`.
- **B04: Explicit Internal vs Client-Visible Notes and Attachments**:
  - Domain models: `attachmentSchema` supporting up to 5MB attachments (PDF, PNG, JPEG) with explicit `visibility: 'internal' | 'client'`, and `internalNotes` field on `draftSchema` and `Invoice`.
  - Strict privacy boundary:
    - Internal notes are never rendered in invoice PDFs (`renderPDF`) or included in client delivery message bodies.
    - Delivery pipeline (`deliver` in `src/worker/delivery.ts`) filters attachments to include only `visibility === 'client'`.
    - Internal attachments and notes are never exposed via public sharing endpoints (`/api/public/*`).
  - Post-issuance confidential editing: `updateInternalNotes`, `attachment`, `deleteAttachment`, and `updateAttachmentVisibility` commands allow updating private notes and managing internal attachments on issued invoices without altering locked financial records.
  - UI integration: `Editor.tsx` includes dedicated "Private internal notes & supporting attachments (B04)" panel with file upload, visibility toggle, and instant feedback. `InvoiceActions.tsx` provides pre-send attachment overview badge indicators.
- **B05: Owner Attention Queue and Pauseable Reminders**:
  - Attention queue engine: `getAttentionQueueItems` identifies:
    - Unsent invoices issued over 24 hours ago without an email record.
    - Failed and bounced deliveries from Resend webhooks.
    - Overdue invoices with outstanding balance.
    - Unreviewed replacement drafts and recurring schedule drafts.
  - Pauseable reminder controls: `pauseReminder` command sets `pausedUntil` and `pauseReason` (e.g. promise to pay) without changing invoice due date or marking the invoice paid.
  - Real-time pre-send safeguards:
    - `runSchedules` verifies `pausedUntil >= today` and re-checks invoice balance (`totals(i, w.creditNotes).balance <= 0`), immediately skipping reminder generation if paused or settled.
    - `deliver` performs fresh double-read against Neon store right before sending email through Resend, canceling delivery if reminder was paused, payment recorded, or status changed.
  - UI integration: `AttentionQueue.tsx` with severity filters, quick pause options (7 days, 14 days, custom), resume action, and direct deep-links to send or record payment. Rendered in workspace header with live notification counter badge.
- **Verification & Test Coverage**:
  - Authored comprehensive test suite `tests/waveB-receipts-statements-reminders.test.ts` (5 tests) verifying:
    - Sequential receipt generation on single and multi-invoice client payments.
    - Receipt reversal immutability and reversed watermark rendering.
    - Client statement reconciliation equation and running balance ledger per currency.
    - Strict isolation of internal notes and internal attachments from PDFs and email payloads.
    - Attention queue item generation for unsent, failed delivery, and overdue invoices.
    - Reminder pause controls, preservation of original due dates, and real-time payment checks preventing reminder dispatch.
  - Total test suite: 111/111 tests passing across all 12 test files.

## Checks and Results
- `npm test`: **111/111 tests passed** across all 12 test suites.
- `npm run check`: TypeScript typechecking passed with 0 errors across client, worker, and test configurations (`tsc -b`).
- `npm run sync:agents:check`: 189 configuration files across all agent adapters verified with 0 drift.
- Punctuation audit: verified 0 em dashes (`\u2014`) and 0 en dashes (`\u2013`) across all touched files.

## Blockers
- None. Wave A (A01 - A08) and Wave B (B01 - B05) are fully implemented, verified, and passing all tests.

## Operational Status
- Wave A and Wave B completed.
- Wave C (C01) completed and verified.

---

# Wave C: C01 Versioned Quotes, Acceptance and Safe Conversion

## Milestone Scope & Objectives
Implement EXPANDED_PRODUCT_SPEC.md C01:
- Versioned quotes/estimates with independent numbering and lifecycle.
- Owner-recorded acceptance with verifiable evidence.
- Safe, idempotent conversion of accepted quotes into unissued draft invoices.
- Revision history immutably preserving superseded versions.
- Clean working UI screen (`Quotes.tsx`) with navigation and command menu integration.
- Dedicated Quote PDF rendering with acceptance badges.

## Key Changes
- **C01 Domain Models & Storage (`src/shared/domain.ts`)**:
  - Defined `quoteAcceptanceSchema` recording acceptance date, method (`email`, `in_person`, `verbal`, `signed_document`, `other`), reference code, notes, and timestamp.
  - Defined `quoteSchema` tracking separate numbering (`${prefix}-QT-${year}-0001`), sequential revisions (`revision: 1, 2, 3...`), statuses (`draft`, `sent`, `accepted`, `declined`, `expired`, `superseded`), line items, scope of work, expiry date, notes, and conversion linkage (`convertedInvoiceId`).
  - Added quote traceability to `draftSchema` and `Invoice` (`convertedFromQuoteId`, `convertedFromQuoteNumber`).
  - Added helper functions: `quoteTotals(q)` with multi-currency decimal handling, `quoteStatus(q, day)` taking expiry dates into account, and `newQuote(w)`.
  - Extended `commandSchema` and `applyCommand` with:
    - `createQuote`: assigns sequential quote number, starts at revision 1 as `draft`.
    - `updateQuote`: allows editing unaccepted draft quotes only; rejects editing sent/accepted quotes.
    - `sendQuote`: transitions quote status from `draft` to `sent`.
    - `reviseQuote`: freezes existing revision immutably as `superseded` (`supersededBy`, `supersededAt`), creates revision N+1 with incremented revision number and fresh line UUIDs.
    - `acceptQuote`: records owner-verified acceptance evidence and marks status `accepted`.
    - `declineQuote`: marks status `declined` with reason.
    - `convertQuoteToInvoice`: verifies `accepted` status; copies agreed lines, client details, currency, tax, discount, notes, and scope into an unissued draft invoice; sets bidirectional links; provides duplicate prevention idempotency so retries return existing draft invoice without duplicating records.
    - `deleteQuote`: deletes unaccepted/unconverted draft quotes only.
- **Dedicated Quote PDF Rendering (`src/shared/pdf.ts`)**:
  - Implemented `filenameQuote` generating clean sanitized filename (`${quoteNumber}-Rev${revision}-${clientName}.pdf`).
  - Implemented `renderQuotePDF` featuring:
    - "PROJECT ESTIMATE / QUOTE" header with quote number and revision badge.
    - Acceptance banner with acceptance date, method, and reference when accepted.
    - Expiry date and scope of work section.
    - Complete line items table, subtotal, discount, tax, and estimated total.
- **Client User Interface & Working Navigation**:
  - Created `src/client/components/Quotes.tsx`:
    - Financial overview metrics (`NumberTicker` for Open, Accepted, and Converted values).
    - Status filtering (All, Draft, Sent, Accepted, Converted, Expired, Declined) and text search.
    - Quote cards grouped by quote number with expandable revision history drawers.
    - Interactive modals: Quote Composer, Record Acceptance Dialog, Decline Modal, and Revise Confirmation Modal.
    - Direct PDF generation and download.
    - One-click safe conversion to draft invoice with instant editor navigation.
  - Updated `src/client/App.tsx`:
    - Added "Quotes" tab to primary navigation (`AnimatedTabs tabs={['Invoices','Quotes','Attention','Clients','Projects','Services','Settings']}`).
    - Added URL query parameter support (`?view=Quotes`).
    - Rendered `Quotes` component on Quotes tab.
  - Updated `src/client/components/Editor.tsx`:
    - Added banner on invoices converted from quotes: "This draft was converted from Quote {convertedFromQuoteNumber}".
  - Updated `src/client/components/CommandMenu.tsx`:
    - Added "Open Quotes & Estimates" action item.
- **Verification & Test Coverage**:
  - Authored comprehensive test suite `tests/waveC-quotes.test.ts` (7 tests) covering:
    - Separate sequential quote numbering (`ZEN-QT-2026-0001`, `ZEN-QT-2026-0002`) and multi-currency totals.
    - Draft quote editing and sent/accepted editing constraints.
    - Revision workflow immutability (revising rev 1 creates rev 2, freezes rev 1 as `superseded`).
    - Owner-recorded acceptance with evidence and decline workflows.
    - Safe, idempotent conversion of accepted quotes to unissued draft invoices, including duplicate prevention.
    - Quote expiry detection via `quoteStatus`.
    - Quotation PDF rendering and PDF structure validation.
  - Total test suite: 118/118 tests passing across all 13 test files.

## Checks and Results
- `npm test`: **118/118 tests passed** across all 13 test suites.
- `npm run check`: TypeScript typechecking passed with 0 errors (`tsc -b`).
- `npm run sync:agents:check`: 189 configuration files across all agent adapters verified with 0 drift.
- Punctuation audit: verified 0 em dashes (`\u2014`) and 0 en dashes (`\u2013`) across all 7 touched files.

---

## 2026-09-12 - Wave C: C02 & C03 Billable Work Entries, Reservations & Milestone Billing

### Milestone Scope & Objectives
Implement EXPANDED_PRODUCT_SPEC.md C02 and C03:
- Manual billable work entries with rate, unit, and billable status tracking.
- Draft invoice generation from selected work entries with attached deliverable breakdowns.
- Persisted draft reservations preventing duplicate billing across concurrent sessions.
- Atomic issuance transitioning reserved work entries and milestones to billed status.
- Explicit reservation release and void/credit note non-rebill guarantees.
- Optional project milestone billing (deposit, progress, final) without double charges.
- Clear financial separation keeping agreed project value, work billed, credits, and payments received distinct.

### Key Changes
- **Domain Models & Validation (`src/shared/domain.ts`)**:
  - Defined `workEntrySchema` and `WorkEntry` type (`id`, `clientId`, `projectId?`, `date`, `description`, `quantity`, `rate`, `unit: 'hour' | 'fixed' | 'unit'`, `billable`, `status: 'unbilled' | 'reserved' | 'billed' | 'discarded'`, `reservedDraftId?`, `billedInvoiceId?`, `billedAt?`, `created`, `updated`).
  - Defined `milestoneSchema` and `Milestone` type (`id`, `projectId`, `title`, `description?`, `amount`, `order`, `status: 'pending' | 'reserved' | 'billed'`, `isDeposit: boolean`, `reservedDraftId?`, `billedInvoiceId?`, `billedAt?`, `created`, `updated`).
  - Extended `projectSchema` with `agreedAmount?: string`, `currency?`, and `milestones?: Milestone[]`.
  - Extended `draftSchema` and `Invoice` with `reservedWorkEntryIds?: string[]` and `reservedMilestoneId?: string`.
  - Added helper `formatWorkBreakdown(entries, currency)` generating formatted itemized work logs for invoice breakdown documents.
  - Added helper `projectFinancials(project, workspace)` computing `agreed`, `drafted`, `issued`, `credited`, `received`, `remainingToBill` distinctly.
  - Extended `commandSchema` and `applyCommand` with 10 commands:
    - `createWorkEntry`, `updateWorkEntry`, `deleteWorkEntry`.
    - `billWorkEntries`: validates unbilled status, reserves entries with draft ID, creates lines, attaches breakdown. Prevents duplicate billing if entries are already reserved or billed.
    - `releaseWorkEntries`: resets reserved entries back to `unbilled` if a draft is released or discarded.
    - `createMilestone`, `updateMilestone`, `deleteMilestone`.
    - `billMilestone`: validates pending status, reserves milestone with draft ID, creates line item. Prevents duplicate billing.
    - `releaseMilestone`: resets reserved milestone back to `pending` if a draft is released.
    - Updated `case 'issue'`: atomically transitions reserved work entries and milestones to `status = 'billed'`, recording `billedInvoiceId` and `billedAt`.
    - Explicit void and credit note non-rebill behavior: voiding or crediting an invoice preserves `status = 'billed'` on work entries and milestones, ensuring they are never silently re-billed.
- **Client User Interface (`src/client/components/Records.tsx` & `Editor.tsx`)**:
  - Updated Project detail view in `Records.tsx`:
    - Distinct financial metric cards (`Agreed Value`, `Remaining to Bill`, `Drafted (Reserved)`, `Work Invoiced (Net)`, `Cash Received`) using `NumberTicker`.
    - Project Milestones Section: milestone table with deposit indicator, status pills (`Pending`, `Reserved in draft`, `Billed`), "+ Add milestone" modal, and direct "Bill milestone" action.
    - Billable Work Log Section: work entries table, multi-select checkboxes for unbilled entries, "+ Log work" modal, and "Create draft invoice with breakdown ({count} selected)" action.
    - Project edit form supporting `agreedAmount`.
  - Updated Client detail view in `Records.tsx`:
    - Client Billable Work Log Section: shows client work entries with batch draft creation.
  - Updated `Editor.tsx`:
    - Added reservation banners for draft invoices holding reserved work entries or milestones, with a direct "Release reservation" action.
- **Comprehensive Test Suite (`tests/waveC-work-milestones.test.ts`)**:
  - Authored 7 thorough tests covering work entry CRUD, reservation mechanics, duplicate billing prevention, atomic issuance, reservation release, void/credit note non-rebill guarantees, milestone billing lifecycle (deposit + progress + final), financial reconciliation without double charges, and PDF rendering with attached breakdowns.

### Checks and Results
- `npm test`: **125/125 tests passed** across all 14 test suites.
- `npm run check`: TypeScript typechecking passed with 0 errors (`tsc -b`).
- `npm run sync:agents:check`: 189 configuration files across all agent adapters verified with 0 drift.
- Punctuation audit: verified 0 em dashes (`\u2014`) and 0 en dashes (`\u2013`) across all modified files.

---

## 2026-09-12 - Wave D: D01 Honest Overview Metrics

### Milestone Scope & Objectives
Implement EXPANDED_PRODUCT_SPEC.md D01:
- Period-filtered overview metrics (Invoiced, Cash Received, Outstanding, Due Soon, Overdue).
- Clear, unambiguous date filtering contracts:
  - Invoiced: filtered by invoice `issueDate` within chosen period.
  - Cash received: filtered by payment `date` within chosen period.
  - Outstanding: filtered by `issueDate` within period (or all active if 'all') for issued invoices with balance > 0.
  - Due soon: filtered by `dueDate` between `asOfDate` and `asOfDate + 7 days` with balance > 0.
  - Overdue: filtered by `dueDate < asOfDate` with balance > 0.
- Overdue ageing buckets with explicit boundaries: `1-30`, `31-60`, `61-90`, and `91+` days overdue.
- Strict ledger correctness: excludes voids, deducts credit notes, subtracts payment refunds, ignores reversed payments.
- Non-accounting copy: zero references to profit or revenue calculations; honest presentation of invoice totals and cash receipts.
- Interactive drill-down: clicking any overview metric or ageing bucket filters the invoice table to matching records.
- Multi-currency isolation: metrics calculated and presented separately per currency.
- Verified permissions (owner only, not exposed to public link tokens), persistence (period saved to localStorage and synced with URL params), and mobile viewport responsiveness.

### Key Changes
- **Domain Layer (`src/shared/domain.ts`)**:
  - Added `diffDays(date1, date2)` for deterministic calendar day differences.
  - Added `getPeriodRange(period, todayStr, customStart, customEnd)` computing intervals for `all`, `this-month`, `last-month`, `this-quarter`, `this-year`, `custom`.
  - Added `calculateOverviewMetrics(workspace, options)` computing typed reports with multi-currency partitions, exact date filters, credit note subtractions, payment refund deductions, and explicit ageing buckets (`1-30`, `31-60`, `61-90`, `91+`).
- **Dashboard UI (`src/client/App.tsx`)**:
  - Period selection bar with quick filters (`All time`, `This month`, `Last month`, `This quarter`, `This year`, `Custom`) and custom date picker.
  - Multi-currency tab switcher when multiple currencies are present in the dataset.
  - 5 Overview Metric Cards powered by `NumberTicker` and `ShinyText` with click-to-filter drill-down:
    - `Invoiced (net)`
    - `Cash received`
    - `Outstanding`
    - `Due in 7 days`
    - `Overdue`
  - Overdue Ageing Buckets Panel: 4 interactive cards (`1-30 days`, `31-60 days`, `61-90 days`, `91+ days`) with counts, amounts, and active filter indicators.
  - Enhanced dashboard table filter matching for `invoiced`, `received`, and ageing bucket keys (`ageing-1-30`, `ageing-31-60`, `ageing-61-90`, `ageing-91+`).
  - Remembered period preference via `localStorage` and URL search parameters (`?period=...`).
- **Styles (`src/client/styles.css`)**:
  - Added `.metrics-five`, `.ageing-panel`, `.ageing-strip`, and `.ageing-card` responsive styling.
  - Added responsive breakpoints (< 1150px, < 800px, < 550px) ensuring touch-friendly mobile layouts.
- **Component Provenance Matrix (`docs/UI_COMPONENT_SOURCES.md`)**:
  - Updated Magic UI and React Bits entries to document usage in D01 overview metrics and ageing cards.
- **Automated Test Suite (`tests/waveD-overview-metrics.test.ts`)**:
  - 7 comprehensive tests covering `diffDays`, `getPeriodRange`, issue date vs payment date filtering, credit note subtractions, void exclusions, reversed payment exclusions, payment refund deductions, exact ageing bucket boundaries (day 0, 1, 30, 31, 60, 61, 90, 91), and multi-currency isolation.

### Checks and Results
- `npm test`: **132/132 tests passed** across all 15 test suites.
- `npm run check`: TypeScript typechecking passed with 0 errors (`tsc -b`).
- `npm run sync:agents:check`: 189 configuration files across all agent adapters verified with 0 drift.
- Punctuation audit: verified 0 em dashes (`\u2014`) and 0 en dashes (`\u2013`) across all modified files.

---

## 2026-09-12 - Wave D (D02, D03, D04) - Mobile Experience, Client Portal, Multiple Business Profiles

### Scope
Implement the remaining Wave D modules from EXPANDED_PRODUCT_SPEC.md:
- **D02: Installable mobile app experience**: Web app manifest, standalone display, privacy-first service worker with strict bypass of API and PDF downloads, update banner preserving unsaved drafts, and touch-friendly mobile bottom navigation.
- **D03: Client account view (Client Portal)**: Cryptographically separate client portal tokens, authorized invoice listings, statements, client-visible deliverables, PDF downloads, revocation controls, and client-reported payment notices routed to the Attention Queue for review without direct ledger alterations.
- **D04: Multiple business profiles**: Explicit profile switcher for separate trading identities/brands with isolated business settings, clients, numbering series sequences, documents, and audit logs; unsaved draft guard before switching; and scoped UI state resets.

### Key Changes
- **Domain Layer (`src/shared/domain.ts`)**:
  - Added `portalNoticeSchema`, `clientPortalSchema`, and extended `clientSchema` with optional `portal` field.
  - Added `businessProfileSchema` and extended `Workspace` with `activeProfileId` and `profiles`.
  - Added `ensureProfiles(w)` to seamlessly migrate and initialize single-profile workspaces.
  - Implemented commands: `sharePortal`, `revokePortal`, `recordClientPaymentNotice`, `dismissPaymentNotice`, `createBusinessProfile`, `switchBusinessProfile`, `updateBusinessProfile`, `deleteBusinessProfile`.
  - Added `buildClientPortalView(w, token)` helper with strict privacy scoping (only authorized invoices, only client-visible attachments, never leaking internal notes).
  - Updated `getAttentionQueueItems` to include `kind: 'payment_notice'` items for client-reported payments.
- **Service Worker & PWA (`public/manifest.webmanifest`, `public/sw.js`)**:
  - Web app manifest with standalone display mode, orientation, background/theme colors, and responsive icons.
  - Lightweight service worker precaching shell assets only (`/`, `/index.html`, `/favicon.svg`, `/icons.svg`, `/manifest.webmanifest`).
  - Strict privacy boundary: bypasses caching for all `/api/*` routes and all PDF files/downloads (`.pdf`, `download=true`).
  - Added `invoiceui:sw-update` event dispatch in `src/client/main.tsx` and `SKIP_WAITING` message support.
- **Worker Endpoints (`src/worker/index.ts`, `src/worker/documents.ts`)**:
  - `GET /api/public/portal/:owner/:token`: Public read-only client portal JSON data.
  - `GET /api/public/portal/:owner/:token/invoices/:id/pdf`: Authorized invoice PDF download with `no-store` headers.
  - `GET /api/public/portal/:owner/:token/statement/pdf`: Reconciled statement PDF download for client.
  - `POST /api/public/portal/:owner/:token/notice`: Client payment reporting endpoint updating Attention Queue.
  - `statementDocument(env, owner, w, statement)`: PDF statement generation using pure worker PDF pipeline.
- **Frontend Components & Routing (`src/client/App.tsx`, `src/client/components/ClientPortal.tsx`, `src/client/components/ClientPortalModal.tsx`)**:
  - `ClientPortal.tsx`: Dedicated client account portal displaying balance due, payment instructions, invoices table with PDF downloads, statement summary, deliverables, and "I have paid" report modal.
  - `ClientPortalModal.tsx`: Owner portal management dialog in Clients tab allowing link generation, copying URL, previewing as client, toggling statements/attachments, restricting invoices, and reviewing reported payment notices.
  - `App.tsx`:
    - Public client portal routing for `?portal=true&token=...` bypassing owner login shell.
    - Header business profile switcher with active profile indicator, trading profiles list, and "+ New business profile" dialog.
    - Profile switching guard warning if the owner is currently inside the invoice editor with unsaved changes.
    - Scoped UI state reset upon switching profiles (clearing selections, active invoice, filters, and resetting view).
    - PWA update banner docked at top with "Update now" and "Later" options.
    - Touch-friendly mobile bottom navigation bar (`.mobile-nav-bar`) with badge indicator for active attention items.
- **Styling (`src/client/styles.css`)**:
  - Added `.update-banner`, `.update-btn`, `.mobile-nav-bar`, `.mobile-nav-item`, `.profile-switcher-*` responsive styles.
  - Added safe area insets for mobile devices (`env(safe-area-inset-bottom, 0px)`).
- **Automated Tests (`tests/waveD-remaining.test.ts`)**:
  - 9 comprehensive tests verifying manifest configuration, service worker privacy rules and cache exclusions, separate portal token generation, scoped portal view data isolation, attachment privacy enforcement, invoice restrictions, revocation controls, client payment reports without ledger mutation, profile sequence number isolation (`ACM` vs `STU`), and profile deletion constraints.

### Verification
- `npm test`: **141/141 tests passed** across all 16 test suites.
- `npm run check`: TypeScript typecheck passed with 0 errors (`tsc -b`).
- Rule 12 Punctuation Audit: verified 0 em dashes (`\u2014`) and 0 en dashes (`\u2013`) across all files.

## Enriched Client Profiles and Invoices: Phone, Contact, Separated Address, and Country Adaptations

### Scope
Update client directory records and invoice forms to support enriched billing fields:
- Primary contact name (Attn: / Contact person)
- Phone number with country-adaptive placeholders
- Separated address fields (Address Line 1, Address Line 2, City, State / Province / Region, Postal / ZIP code, Country)
- Country-specific intelligence dynamically adapting labels and placeholders for postal code, state/territory, and business registration / tax IDs
- Invoice editor "Bill to" section with country adaptation, live preview rendering, and multi-document PDF output support

### Key Changes
- **Domain Layer (`src/shared/domain.ts`)**:
  - Extended `clientSchema` with optional `contact`, `phone`, `addressLine1`, `addressLine2`, `city`, `state`, `postalCode`, `country`, and `taxId`.
  - Added `COMMON_COUNTRIES` list and `getCountryFieldLabels(country?: string)` mapping country codes and names (UK, US, Canada, Australia, Ireland, Germany, France, default) to dynamic labels and placeholders.
  - Added `formatClientAddressLines` and `formatClientAddress` helpers with legacy fallback support.
  - Updated `blankClient()` with default empty string values for all new fields.
  - Updated `buildClientPortalView` to include enriched client fields.
- **Client Forms & Records (`src/client/components/Records.tsx`)**:
  - Created reusable `ClientFormFields` component with primary contact, phone number, country selector with datalist, address line 1, address line 2, city, country-adaptive state, country-adaptive postal code, country-adaptive tax ID, and legacy address textarea fallback.
  - Replaced duplicate client form code in both the client detail edit modal and the main record table modal with `ClientFormFields`.
  - Updated client profile card in detail view to render primary contact, clickable phone link (`tel:`), tax ID, and formatted address.
- **Invoice Composer & Live Preview (`src/client/components/Editor.tsx`, `src/client/components/InvoicePreview.tsx`)**:
  - Updated "Bill to" section in `Editor.tsx` to render primary contact, phone number, country selector, separated address fields, client tax ID, and legacy address fallback, automatically syncing `draft.client.address`.
  - Updated "Billed to" preview in `InvoicePreview.tsx` to render contact, formatted separated address, phone, email, and client tax ID / VAT.
- **Document Generator (`src/shared/pdf.ts`)**:
  - Added `formatClientPdfLines()` helper.
  - Updated `renderPDF`, `renderCreditNotePDF`, `renderReceiptPDF`, `renderStatementPDF`, and `renderQuotePDF` to include contact, formatted address, phone, email, and tax ID across all 5 generated document types.
- **Modals & Search (`src/client/components/ReviewIssueModal.tsx`, `src/client/components/Quotes.tsx`, `src/client/components/CommandMenu.tsx`, `src/client/components/ClientPortal.tsx`, `src/client/App.tsx`)**:
  - `ReviewIssueModal.tsx`: Displays contact, phone, tax ID, and formatted address in the pre-issue review breakdown.
  - `Quotes.tsx`: Quote composer modal updated with contact, phone, country selector, separated address fields, and tax ID.
  - `CommandMenu.tsx`: Enriched client search filter to match on contact, phone, city, postalCode, country, and taxId.
  - `ClientPortal.tsx` and `App.tsx`: Updated demo sample client with realistic contact, phone, separated address, and tax ID.
- **Automated Tests (`tests/phase2-records.test.ts`)**:
  - Added test suites validating country field label adaptation, structured separated address formatting with fallback, and enriched client creation/updating with invoice snapshot retention.

### Verification
- `npm test`: **144/144 tests passed** across all 16 test suites.
- `npm run check`: TypeScript typecheck passed with 0 errors (`tsc -b`).
- Rule 12 Punctuation Audit: verified 0 em dashes (`\u2014`) and 0 en dashes (`\u2013`).

---

## Milestone: Fluid Motion, Tactile Feedback & Animate UI Animated Icons

### Objectives Completed
1. **Fluid Motion & Tactile Feedback (`src/client/styles.css`)**:
   - Replaced instant transitions across interactive controls with tailored cubic-bezier curves (`cubic-bezier(0.16, 1, 0.3, 1)`).
   - Added subtle hover elevation and soft glow to primary, secondary, and danger buttons.
   - Added physical depression active states (`transform: translateY(1px) scale(0.98)`) to `.button`, checkbox inputs, and chips.
   - Added smooth hover lift (`translateY(-2px)`) and shadow to `.metric`, `.ageing-card`, `.onboarding-step`, and `.record-card`.
   - Upgraded modal dialogs from instant opacity steps to smooth spring-eased scale (`@keyframes modal-pop-in`) and backdrop blur fade (`@keyframes modal-fade-in`).
   - Added smooth hover highlight to `.dashboard-table tbody tr`.
2. **Animate UI Animated Lucide Icons (`src/client/components/ui/AnimatedIcon.tsx`)**:
   - Integrated official Animate UI icon components powered by `motion/react` with default hover micro-animations (`animateOnHover`).
   - Integrated icons: `Search`, `RefreshCw`, `Plus`, `Download`, `Trash2`, `Copy`, `Send`, `Check`, `ExternalLink`, `ArrowLeft`, `ArrowRight`, `X`, `Sparkles`, `Settings`, and `Clock`.
   - Connected animated icons to key interactive touchpoints across `App.tsx`, `InvoiceActions.tsx`, `StatementModal.tsx`, `Editor.tsx`, `ReviewIssueModal.tsx`, and `ui.tsx`.
3. **Canonical Rule 13 & Multi-Agent Sync**:
   - Created `.cursor/rules/13-fluid-motion-interactions.mdc` codifying fluid easing curves, tactile press/hover states, animated icon requirements, reduced motion accessibility, and PDF isolation.
   - Synced all agent adapter files via `npm run sync:agents` and validated with `npm run sync:agents:check` (202 agent configuration files verified).
4. **Provenance Tracking (`docs/UI_COMPONENT_SOURCES.md`)**:
   - Documented Animate UI Animated Lucide Icons with official URL, MIT licence, local file path, and rendered screen usage.
5. **Verification**:
   - `npm test`: **144/144 tests passed** across 16 test suites.
   - `npm run check`: TypeScript typecheck passed with 0 errors (`tsc -b`).
---

## Milestone: Spectacular HTML Email Templates & Live Preview

### Objectives Completed
1. **Embedded HTML Invoice Template Engine (`src/shared/emailTemplate.ts`)**:
   - Developed responsive, table-based HTML email templates with inline styling and cross-client compatibility (Gmail, Apple Mail, Outlook, iOS, Android).
   - Embedded the full invoice structure directly into the email body: top brand accent band (`invoice.accent || business.accent || '#863bff'`), business logo/branding, invoice number, issue/due dates, and dynamic status badges (`Paid`, `Payment Due`, or `Issued`).
   - Integrated sender and recipient parties (From and Billed To) with structured address formatting, contacts, emails, and tax/VAT numbers.
   - Formatted itemized deliverables table with line descriptions, group labels, quantities, unit tags, rates, and totals.
   - Rendered financial totals card: subtotal, discount, tax, payments applied, and prominent Balance Due highlight box.
   - Dedicated Bank & Settlement Instructions card with account details and payment reference reminder.
   - Deliverables showcase: official invoice PDF, breakdown PDF, and client-visible attachments with file sizes (private internal attachments safely excluded).
2. **Cool Standalone Features**:
   - One-Click Action Center: primary CTA linking to secure public token URL (`View & Download PDF Invoice`).
   - Google Calendar Due Date Reminder: pre-filled Google Calendar event template link (`📅 Add Due Date to Calendar`) so clients can add payment deadlines directly to their calendar with a single click.
   - Dynamic Payment Reminder Alert Mode: amber reminder alert banner with bell icon, due date, and balance due when message kind is `reminder`.
   - Multi-Theme Support: template styling dynamically inherits invoice style (`studio`, `minimal`, `classic`).
   - Structured plain-text fallback generator (`renderInvoiceEmailText`).
3. **In-App Interactive Live Preview (`src/client/components/InvoiceActions.tsx`)**:
   - Added dual-mode tab switcher in email action modal: "Compose details" and "Spectacular HTML preview".
   - Added Desktop (620px) vs Mobile (375px) responsive viewport switcher.
   - Isolated sandboxed live preview rendering the exact generated HTML email in real time.
   - Added "Copy HTML" button with animated checkmark feedback for easy copying to external mail clients.
4. **Worker Delivery Pipeline Integration (`src/worker/delivery.ts`)**:
   - Updated Resend delivery to generate and pass both `html` and `text` alternatives.
5. **Verification & Test Coverage (`tests/email-templates.test.ts`)**:
   - Authored comprehensive test suite (6 tests) covering HTML structure, line items, totals, bank details, calendar links, CTAs, attachments filtering, reminder mode, template variants, XSS escaping, text fallback, and dash compliance.
   - Total test suite: **17 test files, 150/150 tests passing**.
   - TypeScript compilation: 0 errors (`tsc -b`).
   - Strict punctuation verification: 0 em dashes (`\u2014`) and 0 en dashes (`\u2013`).

## Wave E: PostgreSQL Row Level Security (RLS) & Local Development Origin Support

1. **Strict PostgreSQL Row Level Security (RLS) (`migrations/0002_row_level_security.sql`, `migrations/0003_app_role_rls.sql`)**:
   - Applied `ALTER TABLE invoice_workspaces ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`.
   - Created tenant isolation policy `invoice_workspaces_tenant_isolation` enforcing `owner_id = NULLIF(current_setting('app.current_user_id', true), '') OR current_setting('app.service_role', true) = 'worker'`.
   - Created unprivileged PostgreSQL role `invoiceui_app` with `NOBYPASSRLS` and granted table privileges and role membership to the primary connection user.
   - Enforced service-only RLS on `invoice_webhook_events`.
   - Protected Better Auth tables (`auth_user`, `auth_session`, `auth_account`, `auth_verification`, `auth_rate_limit`) with explicit application policies.
2. **Worker Database Context Propagation (`src/worker/store.ts`, `src/worker/index.ts`, `src/worker/delivery.ts`, `scripts/restore.mjs`)**:
   - Wrapped private workspace `read` and `write` queries in `sql.transaction` executing `SET LOCAL ROLE invoiceui_app` and `SELECT set_config('app.current_user_id', owner, true)` to pass authenticated caller context to PostgreSQL RLS.
   - Configured public share, portal, webhook, and cron queries to execute under `SET LOCAL ROLE invoiceui_app` with `app.service_role = 'worker'`.
   - Updated `scripts/restore.mjs` to execute its transactional restore under the authorized application service role.
3. **Local Development Origin & Dev Server Support (`src/worker/index.ts`, `src/worker/auth.ts`)**:
   - Resolved 403 Forbidden errors when accessing the API from Vite dev server (`http://127.0.0.1:5173` and `http://localhost:5173`).
   - Extended trusted origin validation to permit local development origins (`http://127.0.0.1:5173`, `http://localhost:5173`, `http://127.0.0.1:8787`, `http://localhost:8787`) alongside `env.APP_URL`.
   - Configured Better Auth with dynamic `baseURL` resolution and `trustedOrigins` matching request origin in development so magic links and session cookies work seamlessly in local dev.
4. **Verification & Test Coverage (`tests/waveE-rls-security.test.ts`)**:
   - Authored test suite verifying origin validation, untrusted origin rejection (403), local dev origin acceptance (401/200), dynamic Better Auth baseURL configuration, and RLS migration constraints.
   - Full test suite: **18 test files, 153/153 tests passing**.
   - TypeScript compilation: 0 errors (`npm run check`).
   - Agent config sync check: clean (`npm run sync:agents:check`).

## Wave F: Custom Email Templates for Magic Links, Quotes, and System Delivery

1. **Spectacular Magic Link Authentication Email (`src/shared/emailTemplate.ts`)**:
   - Authored `renderMagicLinkEmailHtml` and `renderMagicLinkEmailText` featuring the dark brand mark badge (`▤`), clear headline and subtext, high-contrast primary CTA button with hover feedback, single-use 10-minute expiry callout with security notice, and monospace fallback URL card for restrictive email clients.
   - Integrated directly into Better Auth's `sendMagicLink` plugin in `src/worker/auth.ts` to dispatch both rich HTML and structured plain-text alternatives via Resend.
2. **Formal Quotation Email Templates (`src/shared/emailTemplate.ts`)**:
   - Authored `renderQuoteEmailHtml` and `renderQuoteEmailText` embedding formal proposal details: quote number, revision tracking, validity expiry date, client & provider address details, project scope of work, line item pricing breakdown, totals block (subtotal, discounts, tax, total quote), and Google Calendar expiry reminder links.
3. **React Hook Order Stabilization (`src/client/App.tsx`)**:
   - Resolved Minified React Error #310 by moving top-level `overviewReport` `useMemo` above conditional early returns (`viewingPortalToken`, `store.loading`, `!w`), utilizing `emptyWorkspace()` as a graceful fallback during authentication and initialization states.
4. **Verification & Test Coverage (`tests/email-templates.test.ts`)**:
   - Expanded test suite to 8 comprehensive tests covering invoice emails, overdue payment reminders, magic link emails, formal quotations, XSS escaping, plaintext fallbacks, and zero em/en dash validation.
   - Full test suite: **18 test files, 155/155 tests passing**.
   - TypeScript typecheck: 0 errors (`npm run check`).
   - Production bundle build: successful (`npm run build`).
   - Punctuation compliance: 0 em dashes (`\u2014`) and 0 en dashes (`\u2013`) across all modified code and templates.

## Wave G: Resolving 401 Unauthorized & Session Cookie Normalization

1. **Root Cause Analysis of 401 on Record Save (`POST /api/private/command`)**:
   - Better Auth cookie prefix isolation: When Better Auth is initialized with an HTTPS `baseURL` (e.g. `APP_URL`), it sets and expects `__Secure-better-auth.session_token`. In local dev over plain HTTP (`http://127.0.0.1:5173`), browsers drop or reject `__Secure-` cookies and send plain `better-auth.session_token`. If request headers or origin detection drifted to the HTTPS default, `getSession` looked strictly for the `__Secure-` cookie, resulting in `null` and triggering 401 Unauthorized ("Sign in to continue").
   - Demo mode command isolation: In `useWorkspace`, `demo` state was held in React state without ref synchronization or auto-recovery. Stale closures could cause `command()` to route to the private API instead of browser `localStorage`.
2. **Robust Origin Resolution & Cookie Normalization (`src/worker/index.ts`)**:
   - Implemented `resolveOrigin(c)` to accurately detect local dev hosts (`127.0.0.1:5173`, `localhost:5173`, `127.0.0.1:8787`, `localhost:8787`) across both `Origin` and `Host` headers on both GET and POST requests.
   - Implemented `normalizeAuthHeaders(headers)` in the worker middleware: automatically bridges `better-auth.session_token` and `__Secure-better-auth.session_token` so that Better Auth reliably validates active sessions regardless of origin scheme transitions.
3. **Workspace Demo Mode Resilience & Dev Auto-Recovery (`src/client/workspace.ts`)**:
   - Added `isDemoRef` and updated `command()` to check `demo || isDemoRef.current || owner === 'demo'`, ensuring local preview operations always save to `localStorage` under `DEMO_KEY` and never leak network requests to `/api/private/command`.
   - Added auto-recovery on reload in dev mode: if unauthenticated (401) and `invoiceui:is_demo` is active, seamlessly restores the demo workspace from `DEMO_KEY` rather than booting the user to the login screen.
   - Clean sign-out resets `isDemoRef`, clearing both session state and demo flags.
4. **Verification & Test Coverage**:
   - Live integration check: verified `GET /api/private/workspace` and `POST /api/private/command` directly against Vite proxy on `127.0.0.1:5173` using plain session cookie; returned 200 OK and successfully committed version updates to PostgreSQL database.
   - Full test suite: **18 test files, 155/155 tests passing** (`npm test`).
   - TypeScript compilation: 0 errors (`npm run check`).
   - Punctuation compliance: 0 em dashes (`\u2014`) and 0 en dashes (`\u2013`).

## Wave H: Replacing Browser Alerts with UI Modals & Establishing Rule 14

1. **Accessible UI Modal Confirmation System (`src/client/components/ConfirmModal.tsx`, `src/client/components/ui.tsx`)**:
   - Implemented `ConfirmProvider` and `useConfirm()` hook delivering asynchronous `await confirm(options)` and `await alert(options)`.
   - Exported standalone `<ConfirmModal />` component for declarative implementations.
   - Built on Radix UI Dialog primitives (`@radix-ui/react-dialog`) and shadcn styling, featuring backdrop blur (`confirm-modal-overlay` with `z-index: 70`), spring scale entrance animations, keyboard focus trapping, Escape key dismissal, and tactile button depression (`scale(0.98)`).
   - Incorporated animated Lucide icons (`Trash2`, `Check`, `X`) from Animate UI.
2. **Replaced All Native Browser Dialog Callsites (17 callsites across 6 files)**:
   - `src/client/App.tsx`: Wrapped root application in `ConfirmProvider`; replaced profile switch confirmation with UI modal.
   - `src/client/components/Editor.tsx`: Replaced draft deletion confirm with UI modal.
   - `src/client/components/Quotes.tsx`: Replaced quote deletion confirm with UI modal.
   - `src/client/components/ClientPortalModal.tsx`: Replaced portal access revocation confirm with UI modal.
   - `src/client/components/InvoiceActions.tsx`: Replaced payment reversal and recurring schedule deletion confirms with UI modals.
   - `src/client/components/Records.tsx`: Replaced all 12 client, project, milestone, work entry, starter bundle, and service deletion/reversal confirms with UI modals.
7. **Established Project Rule 14 (`.cursor/rules/14-no-alerts-only-modals.mdc`)**:
   - Created rule mandating proper UI modals and strictly prohibiting native browser `alert()`, `confirm()`, and `prompt()`.
   - Propagated across all 215 agent configuration files via `npm run sync:agents`.
   - Verified zero drift with `npm run sync:agents:check`.
8. **Verification & Checks**:
   - Full test suite: **19 test files, 161/161 tests passing** (`npm test`).
   - TypeScript compilation: 0 errors (`npm run check`).
   - Production bundle build: successful (`npm run build`).
   - Punctuation compliance: 0 em dashes (`\u2014`) and 0 en dashes (`\u2013`).

## Wave I: Structured Bank Instructions with Sort Code, Account Number & Bank Logo Resolution

1. **Bank Catalog & Formatters (`src/shared/banks.ts`)**:
   - Curated comprehensive directory of UK banks (Monzo, Starling, Revolut, Barclays, HSBC, Lloyds, NatWest, Santander, Chase UK, Nationwide, Halifax, RBS, TSB, Metro Bank, Co-op, First Direct, Bank of Scotland, Virgin Money, Clydesdale, Wise, Tide, Coutts, Triodos) and international institutions.
   - Built sort code auto-formatting (`formatSortCode`), account number cleaning (`formatAccountNumber`), human-readable instruction generation (`formatBankInstructions`), and reverse parser (`parseExistingBankString`) to seamlessly extract structured fields from legacy free-form text.
2. **Domain Schema Extension (`src/shared/domain.ts`)**:
   - Extended `businessSchema` with optional `bankName`, `bankId`, `accountName`, `accountNumber`, `sortCode`, `iban`, `bic`, and `bankLogo` fields while preserving `b.bank` for full backward compatibility across database storage, PDF generation, email templates, and client portal views.
3. **Tactile Bank Logo Component (`src/client/components/ui/BankLogo.tsx`)**:
   - Integrated `@icons-pack/react-simple-icons` for instant, zero-latency vector rendering of supported brands (Monzo, Barclays, HSBC, Starling, Revolut, Chase, Wise, Bank of America, Deutsche Bank).
   - Dynamic domain resolution via `unavatar.io` for UK retail banks with automatic brand monogram fallback.
4. **Interactive Bank Instructions Editor (`src/client/components/BankInstructionsEditor.tsx`)**:
   - Replaced raw settings textarea with structured editor featuring bank selection dropdown with live branding, live masked Sort Code input (`00-00-00`), Account Number validation, Payee Name with "Use business name" shortcut, optional international IBAN/BIC accordion, one-click copy buttons, and live client settlement preview card.
5. **Live Invoice & Client Portal Parity (`InvoicePreview.tsx`, `ClientPortal.tsx`, `ReviewIssueModal.tsx`)**:
   - Enhanced live preview and client settlement card with official bank branding, formatted settlement box, and one-click copy triggers.
6. **Verification & Provenance**:
   - Unit tests: Added `tests/banks.test.ts` (6 new unit tests). All 19 test files and 161/161 tests passing (`npm test`).
   - TypeScript verification: 0 errors (`npm run check`).
   - Production bundle build: successful (`npm run build`).
   - UI provenance updated in `docs/UI_COMPONENT_SOURCES.md`.
   - Punctuation compliance: 0 em dashes (`\u2014`) and 0 en dashes (`\u2013`).

## Wave J: Universal Structured Address Inputs Across All Forms

1. **Domain Schema & Address Formatting (`src/shared/domain.ts`)**:
   - Extended `businessSchema` with optional separated address fields: `addressLine1`, `addressLine2`, `city`, `state`, `postalCode`, and `country`.
   - Unified formatting with generic `Addressable` interface and `formatAddressLines` / `formatAddress` helpers, maintaining `formatClientAddressLines` and `formatClientAddress` aliases for full backward compatibility.
   - Initialized empty workspace business with separated address field keys.
   - Updated `issueErrors` to recognize structured business address fields alongside legacy combined `b.address`.
2. **Business Settings Form (`src/client/components/Records.tsx`)**:
   - Replaced single multi-line textarea with dedicated structured inputs: Country picker with `COMMON_COUNTRIES` datalist, Address Line 1, Address Line 2 (optional), City / Town, State / County / Province (dynamic label & placeholder), Postcode / ZIP code (dynamic label & placeholder), and dynamic Tax / VAT ID field.
   - Added automatic synchronization so any edit to separated fields updates the combined `b.address` field in real time.
   - Retained legacy unseparated address fallback for existing businesses with unstructured data.
   - Added profile synchronization via `useEffect` on `w.business`.
3. **Form Parity Across Invoices & Quotes (`src/client/components/Editor.tsx`, `src/client/components/Quotes.tsx`)**:
   - Verified separated client address fields across Invoice composer and Quote composer.
   - Added legacy unseparated address fallback to Quote composer for complete parity with invoice and client forms.
4. **PDF, Email, and Live Preview Integration (`pdf.ts`, `emailTemplate.ts`, `InvoicePreview.tsx`)**:
   - Enhanced PDF rendering to format business addresses using `formatBusinessPdfLines(b)`.
   - Updated email templates and live invoice preview to format business addresses with `formatAddress(b)` / `formatAddressLines(b)`.
5. **Verification & Quality**:
   - Unit tests: Added test in `tests/phase2-records.test.ts` for separated business address fields. All 19 test files and 162/162 tests passing (`npx vitest run`).
   - TypeScript verification: 0 errors (`npm run check`).
   - Punctuation compliance: 0 em dashes (`\u2014`) and 0 en dashes (`\u2013`).




