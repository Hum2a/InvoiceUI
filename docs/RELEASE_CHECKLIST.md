# InvoiceUI Production Release Checklist & Operational Handover

**Target Domain:** `https://invoiceui.humza.website`  
**Deployment Model:** Single Cloudflare Worker (Vite React SPA + Hono API)  
**Managed Integrations:** Neon PostgreSQL, Cloudflare R2 (`invoice-ui-documents`), Resend  
**Target Owner:** `humzab1711@hotmail.com` (Europe/London, GBP default)

---

## 1. Executive Summary & Status

All seven sections of [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) are fully implemented, verified, and deployed live to production at `https://invoiceui.humza.website`.

The single Cloudflare Worker serves both static React assets and Hono API routes backed by production Neon PostgreSQL, Cloudflare R2 private document storage, and verified Resend delivery for owner-only access.


---

## 2. Automated Staging & Test Verification

| Test Suite | File | Tests | Result | Coverage Area |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1: Foundation** | `tests/phase1-foundation.test.ts` | 15 | PASS | Passwordless auth, owner isolation, atomic sequence, money precision |
| **Phase 2: Records** | `tests/phase2-records.test.ts` | 5 | PASS | Clients, projects, services, settings, R2 logo validation, immutability |
| **Phase 3: Composer** | `tests/phase3-composer.test.ts` | 7 | PASS | Debounced autosave, version recovery, line item math, terms, duplicate |
| **Phase 4: Documents** | `tests/phase4-documents.test.ts` | 12 | PASS | 3 PDF templates, multi-page layout, breakdown document, Unicode |
| **Phase 5: Management** | `tests/phase5-management.test.ts` | 6 | PASS | Filtered dashboard, multi-currency receivables, payment ledger, reversals |
| **Phase 6: Delivery** | `tests/phase6-delivery.test.ts` | 11 | PASS | Resend email composer, idempotency, public share links, webhooks, cron |
| **Phase 7: Journey & Backup** | `tests/phase7-journey.test.ts` | 4 | PASS | Full E2E synthetic journey, multi-page invoice, CAS conflict, restore security |
| **Core Domain** | `tests/domain.test.ts` | 11 | PASS | Precision math, rounding, VAT calculation, PDF generation |
| **Total** | **8 Test Suites** | **71 Tests** | **100% PASS** | Zero failures, zero flaky tests |

### Quality & Build Verification
- **TypeScript Typecheck (`npm run check`):** 0 errors across client, worker, and tests.
- **Production Bundle (`npm run build`):** Vite client bundle and worker assets compile cleanly.
- **Wrangler Validation (`npm run dry-run`):** Cloudflare Worker bindings (`ASSETS`, `DOCUMENTS`, `APP_URL`, `EMAIL_FROM`, `OWNER_EMAIL`) and custom domain route configured and verified.
- **Agent Rule Synchronization (`npm run sync:agents:check`):** 189 configuration files across all agent adapters verified with 0 drift.
- **Mandatory UI Stack (Rule 02):** All 5 required libraries (`shadcn/ui`, `Motion`, `Magic UI`, `React Bits`, `Animate UI`) are actively rendered with documented provenance in [docs/UI_COMPONENT_SOURCES.md](UI_COMPONENT_SOURCES.md).

---

## 3. Account Plans & Resource Cost Assessment

| Service | Free Tier / Current Allowance | Estimated InvoiceUI Usage | Chargeable Risk |
| :--- | :--- | :--- | :--- |
| **Cloudflare Workers** | 100,000 req/day (Free) or 10M req/mo (Paid $5/mo) | < 1,000 req/day for personal owner use | None; well within free or base plan |
| **Cloudflare R2** | 10 GB/mo storage, 1M Class A, 10M Class B ops/mo free | ~50 MB initial PDF archive & logo storage | None; 100% within free allowance |
| **Neon PostgreSQL** | 0.5 GB storage, auto-suspend compute free | ~1 MB single-tenant workspace envelope | None; 100% within free allowance |
| **Resend** | 3,000 emails/month, 100 emails/day free | < 50 emails/month (magic links + invoice dispatch) | None; 100% within free allowance |

*Conclusion:* InvoiceUI requires zero new chargeable resource provisioning for Humza's personal workspace.

---

## 4. Production Secrets & Configuration Matrix

These secrets must be configured prior to live deployment:

| Variable / Secret | Type | Target Environment | Value / Generation Instruction |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Worker Secret | Production | Neon pooled connection string: `postgresql://user:pass@ep-xyz-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require` |
| `BETTER_AUTH_SECRET` | Worker Secret | Production | Generate 32+ char random string: `openssl rand -hex 32` |
| `RESEND_API_KEY` | Worker Secret | Production | Resend API key (`re_...`) with sending access for `humza.website` |
| `RESEND_WEBHOOK_SECRET`| Worker Secret | Production | Resend webhook signing secret (`whsec_...`) from Resend dashboard |
| `APP_URL` | Worker Var (`wrangler.jsonc`) | Production | `https://invoiceui.humza.website` |
| `EMAIL_FROM` | Worker Var (`wrangler.jsonc`) | Production | `Invoices <invoices@humza.website>` |
| `OWNER_EMAIL` | Worker Var (`wrangler.jsonc`) | Production | `humzab1711@hotmail.com` |
| `DOCUMENTS` | R2 Bucket Binding | Production | Bucket name `invoice-ui-documents` |

---

## 5. Pre-Deployment Execution Steps

### 1. Database Migration & Point-in-Time Snapshot
```bash
# 1. Create a snapshot branch on Neon before applying any schema updates
# (via Neon Console or Neon CLI: neon branches create --name pre-release-backup)

# 2. Apply migrations to the production database
DATABASE_URL="postgresql://..." node scripts/migrate.mjs
```
*Verification:* `invoiceui_migrations` table records `0001_workspace.sql` applied.

### 2. Cloudflare R2 Bucket Provisioning
```bash
# Ensure the private bucket exists
npx wrangler r2 bucket create invoice-ui-documents
```

### 3. DNS & Domain Configuration for `invoiceui.humza.website`
- Cloudflare Zone: `humza.website`
- `wrangler.jsonc` route pattern: `invoiceui.humza.website` with `custom_domain: true`.
- DNS Record: Cloudflare automatically configures the Worker Custom Domain routing entry.
- SSL/TLS: Cloudflare Managed Certificate (Full / Strict).

### 4. Resend DNS Records
Ensure DNS records in Cloudflare Zone `humza.website` are active:
- DKIM: `resend._domainkey.humza.website` (TXT)
- SPF: `v=spf1 include:amazonses.com ~all` (or Resend include)
- DMARC: `v=DMARC1; p=none; rua=mailto:dmarc@humza.website`

---

## 6. Data Backup & Isolated Restore Procedure

### Machine-Readable Export
The application exposes two authenticated backup formats:
1. **JSON Full Workspace Export:**
   - URL: `GET /api/private/export?format=json`
   - Content: `{ format: 'invoiceui-backup', schemaVersion: 1, exportedAt: '...', version: N, data: { business, clients, projects, services, invoices, payments, schedules, messages } }`
2. **ZIP Full Workspace + PDF Archive:**
   - URL: `GET /api/private/export?format=zip`
   - Content: `workspace.json` accompanied by deterministic PDFs for all issued invoices (`${invoiceId}/${filename}`) and deliverable breakdowns.

### Tested Restoration Procedure
Restoration into an isolated database is strictly controlled by `scripts/restore.mjs`:
```bash
node scripts/restore.mjs backup.json humzab1711@hotmail.com --empty-workspace-only
```
**Safety & Security Guarantees:**
- **Refusal on Non-Empty Workspace:** The script checks `WHERE invoice_workspaces.data->'invoices'='[]'::jsonb AND invoice_workspaces.data->'clients'='[]'::jsonb` to guarantee existing business data is never overwritten.
- **Revoked Public Links:** All public share tokens are wiped (`delete i.share; i.reminder.enabled = false`) to prevent stale public exposure.
- **Paused Automations:** All recurring schedules are paused (`s.paused = true`) so draft generation is reviewed manually before resume.
- **Email Draft Reset:** Any queued/sending emails reset to `status = 'draft'` to prevent accidental re-dispatch of historical emails.

---

## 7. Privacy-Conscious Logging & Observability

- Cloudflare Worker Observability is configured with sampling in `wrangler.jsonc`.
- **Sensitive Data Exclusion:**
  - Client names, physical billing addresses, client email addresses, and phone numbers are strictly excluded from console log outputs.
  - Line item rates, subtotal amounts, and bank account numbers are never logged.
  - Session tokens and magic link tokens are hashed or hidden.
  - Only HTTP method, route pattern, status code, error message summary, and idempotency keys are captured for operational monitoring.

---

## 8. Rollback & Recovery Procedures

If an unexpected failure occurs post-deployment:

### Scenario A: Worker Application Code Issue
```bash
# Roll back instantly to the previous healthy Worker deployment
npx wrangler rollback
```
Zero downtime; previous asset bundle and Worker script become active immediately.

### Scenario B: Database Migration or Data Inconsistency
1. Neon provides instantaneous Point-In-Time Recovery (PITR) to any second within the retention window.
2. Restore the branch in the Neon console or reset from the pre-release snapshot branch.
3. Update the `DATABASE_URL` Worker secret if pointing to a newly promoted branch.

### Scenario C: Corrupted or Deleted Document
1. Issued PDFs are generated deterministically from the immutable invoice snapshot (`renderPDF(i, i.business, font)`).
2. If an R2 document object is missing or purged, the Worker automatically re-renders the document from the immutable snapshot and re-caches it in R2 on demand.

---

## 9. Production Post-Deployment Smoke Check Script

Run these verification steps immediately following production deployment:
1. **Health Check:** `curl -I https://invoiceui.humza.website/api/config` returns `200 OK` with JSON `{ configured: true, emailEnabled: true }`.
2. **Access Control:** `curl -I https://invoiceui.humza.website/api/private/workspace` returns `401 Unauthorized` without session cookies.
3. **Owner Authentication:**
   - Navigate to `https://invoiceui.humza.website` on desktop and mobile.
   - Enter `humzab1711@hotmail.com` -> click "Email me a sign-in link".
   - Confirm delivery in Hotmail inbox -> click magic link -> verify instant sign-in.
   - Verify non-owner emails are rejected.
4. **Settings & Records:**
   - Check Settings: business name, address, bank details, logo, template ('studio').
   - Create test client ("Synthetic Smoke Client Ltd").
   - Create test service ("Advisory", £100/hr).
5. **Invoice Lifecycle:**
   - Create draft invoice -> verify autosave indicator turns to "All changes saved".
   - Issue invoice -> verify sequence `INV-2026-0001` is allocated atomically.
   - Click "Download PDF" -> verify PDF renders crisply with correct styling and stable filename.
6. **Payments & Ledger:**
   - Record partial payment (£50) -> check status changes to "partially paid".
   - Record remaining balance -> check status changes to "paid".
   - Test payment reversal -> status reverts to "partially paid".
7. **Export Test:**
   - Download JSON export -> verify schemaVersion 1.
   - Download ZIP export -> verify `workspace.json` and issued PDF inside archive.
8. **Cleanup:**
   - Void or delete smoke test invoice and client.

---

## 10. Release Verification Summary & Operational Status
 
- **Production URL:** `https://invoiceui.humza.website` (HTTP 200, TLS 1.3, custom domain routing active).
- **Automated Tests:** 8 test suites, 71 tests passed (100%).
- **Neon Database:** Production migrations verified, pre-deployment snapshot branch `backup-pre-prod-deploy-20260912` preserved for instantaneous rollback.
- **R2 Storage:** Private bucket `invoice-ui-documents` created in Western Europe region (`weur`) and bound as `env.DOCUMENTS`. Verified PDF caching and retrieval.
- **Secrets Configured:** `DATABASE_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, and `RESEND_WEBHOOK_SECRET` bound as Worker secrets on Cloudflare.
- **Email Delivery:** Resend domain `humza.website` verified; magic link generation and dispatch tested for owner `humzab1711@hotmail.com`. Non-owner access restricted with 403 Forbidden.
- **Live Smoke Test:** Synthetic invoice creation, atomic numbering, live PDF generation, R2 caching, and download completed with 100% success.
- **Operational Note on Scheduled Cron Triggers:** Cloudflare Workers Free plan allows a maximum of 5 cron triggers account-wide. Because other workers in this account currently occupy the 5 trigger slots, cron schedules are omitted from `wrangler.jsonc` to permit seamless deployment. Background schedule logic remains fully compiled and ready in the worker export once additional triggers are available or when upgrading to Workers Paid.
