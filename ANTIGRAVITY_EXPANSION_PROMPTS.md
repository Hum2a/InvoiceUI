# Antigravity expansion prompts

These prompts work in Antigravity or Cursor. Open InvoiceUI as the workspace. Finish the active phase before starting a new wave. EXPANDED_PRODUCT_SPEC.md is a proposed backlog; each prompt authorises only its named subset when the owner submits it. Do not run all prompts automatically.

## Shared preamble — include when starting a fresh chat

```text
Continue the existing InvoiceUI application. Read AGENTS.md, applicable numbered project rules, CURSOR_PROGRESS.md and only the relevant sections of EXPANDED_PRODUCT_SPEC.md. Inspect current code before deciding what is missing. Preserve work from other agents, current integrations and the editor/live-preview layout. Do not restart completed phases.

The five-library UI requirement remains mandatory: shadcn/ui, Motion, Animate UI, Magic UI and React Bits must have real appropriate rendered usage across the product. Follow the current repository source-of-truth and synchronization instructions; do not assume an old rule directory is canonical.

Implement the requested subset end to end with meaningful acceptance checks. Reuse working behavior; do not build duplicate workflows. Make routine decisions autonomously, flag truly missing inputs at the point they block work, and continue independent work. Keep reports and context reads concise. Update CURSOR_PROGRESS.md without overwriting other agents' entries. Do not deploy or send real customer messages as part of this implementation request. Unselected backlog items remain proposals.
```

## A1 — faster setup and composing

```text
Implement EXPANDED_PRODUCT_SPEC.md A01–A04: resumable first-invoice setup, predictable client defaults, invoice content starters/service bundles and faster line entry. Preserve existing autosave, conflict recovery, service selection and draft/issue contracts. Test switching clients on a populated draft, starter duplication safety, malformed pasted amounts and keyboard editing. Finish with working UI and the stated acceptance criteria, not just data fields.
```

## A2 — review, navigation and daily management

```text
Implement EXPANDED_PRODUCT_SPEC.md A05–A08: review-before-issue/send, command menu/saved views/navigation memory, safe selected bulk operations and a unified activity timeline. Integrate the existing issue/send/payment events rather than creating parallel state. Ensure the reviewed version is the issued version, repeated actions are safe and bulk partial failures are visible. Keep bulk email/issue/mark-paid out of scope.
```

## B1 — financial corrections and allocation

```text
Implement EXPANDED_PRODUCT_SPEC.md B01 and B03 together: immutable invoice corrections/credit documents and canonical client payments with allocations, unapplied credit and refunds. First write a concise balance/state contract and migration plan consistent with existing data; then implement it. Preserve historical records and existing payment behavior through the migration. Verify partial credits, already-paid invoices, overpayments, concurrent allocations, retries and reversals. Consult current authoritative requirements before making jurisdiction-specific compliance claims. Do not run destructive production-data tests or treat the proposal as accounting advice.
```

## B2 — receipts, statements and follow-up experience

```text
Implement EXPANDED_PRODUCT_SPEC.md B02, B04 and B05: payment receipts/client statements, explicit internal versus client-visible notes/attachments, and an owner attention queue with pauseable reminder controls. Reuse the existing PDF, private storage and delivery pipeline. Verify statement reconciliation per currency, receipt reversal history, no leakage of internal material and a fresh payment check before every reminder send. If B01/B03 are not implemented, explicitly scope statements/receipts to the existing ledger and document the missing credit/allocation integration instead of inventing balances.
```

## C1 — quotes to invoices (optional)

```text
Implement only EXPANDED_PRODUCT_SPEC.md C01: versioned quotes/estimates, owner-recorded acceptance and safe conversion to an unissued invoice. Keep numbering and lifecycle separate from invoices; preserve the accepted revision and prevent duplicate conversions. Add navigation only for working screens. Online client acceptance, legal signature guarantees, work logs and milestones are outside this prompt.
```

## C2 — project work and milestone billing (optional)

```text
Implement EXPANDED_PRODUCT_SPEC.md C02 and C03: manual billable work entries and optional project milestone billing. Prevent duplicate billing with persisted draft reservations and atomic issuance. Define reservation release and void/correction behavior explicitly. Keep agreed project value, work billed and payments received distinct. Include an attached breakdown and tests for deposit/final billing without double charges. A live timer, expense tracker and automatic currency conversion are outside scope.
```

## D — select one convenience module (optional)

```text
Implement only this selected module from EXPANDED_PRODUCT_SPEC.md: [replace with D01 overview metrics, D02 installable mobile experience, D03 client account view, or D04 multiple business profiles]. Meet its stated boundaries and verify the affected permissions, persistence and mobile behavior. Other D modules remain unselected. Do not infer authorization for payment integrations, teams or public registration.
```
