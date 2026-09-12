# Security policy

InvoiceUI stores invoices, client details, bank instructions and authentication sessions. Treat production data as confidential.

## Supported versions

Only the `main` branch and the currently deployed Worker are supported. Do not run unreleased forks against production Neon or R2.

## Report a vulnerability

**Do not open a public issue** for security problems.

1. Use GitHub **Privately report a vulnerability** on this repository if it is available.
2. Otherwise email the repository owner. Include a short description, impact, and steps to reproduce with **synthetic** data only.

You should receive an acknowledgement within a few days. Please do not disclose the issue publicly until a fix is deployed or you are told it is not a vulnerability.

## What to include

- Affected route, Worker binding or script
- Whether unauthenticated or cross-owner access is possible
- Whether secrets, session cookies or documents can leak
- A minimal reproduction that does not use real client records

## What not to include

- Production `.dev.vars`, `.env.local` or Worker secret values
- Live `DATABASE_URL` strings
- Real magic-link URLs, session cookies or public share tokens
- Customer names, bank details or issued PDFs

## Application rules (for reporters and contributors)

- Private APIs must require a verified owner session. Do not trust client-supplied owner IDs.
- Public invoice links must be unguessable, scoped, expirable and immediately revocable.
- Logs must not contain secrets, magic links, cookies or bank information.
- Tests and fixtures must stay synthetic.

## Secrets

Rotate any credential that may have been committed or pasted into a ticket:

```bash
wrangler secret put DATABASE_URL
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put RESEND_API_KEY
wrangler secret put RESEND_WEBHOOK_SECRET
```

Revoke the previous value in Neon, Resend and Cloudflare as well.
