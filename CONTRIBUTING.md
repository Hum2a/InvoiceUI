# Contributing

InvoiceUI is a private product. Changes should stay aligned with [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). If you are not the owner, agree scope before opening a large pull request.

## Development setup

1. Install **Node.js 22+** and npm.
2. `npm install`
3. Copy `.dev.vars.example` to `.dev.vars` and fill secrets. Never commit `.dev.vars`, `.env` or `.env.local`.
4. `npm run db:migrate`
5. `npm run dev:api` and `npm run dev` (see [README.md](README.md)).

Use synthetic clients and invoices. Do not import real historical invoice folders.

## Working on a change

- Keep the React/Vite + Hono + Neon + single-Worker architecture unless the task explicitly changes it.
- Prefer existing components and `src/shared/domain.ts` for money and lifecycle rules. Do not use binary floating point for totals.
- Issued invoices are historical records: do not rewrite snapshots when editing business, client or service catalogues.
- UI work must use the required libraries documented in the project rules (shadcn/ui, Motion, Animate UI, Magic UI, React Bits) with genuine rendered usage, not unused imports.

### Agent instructions

Canonical rules live in `.cursor/rules`. After editing them, run:

```bash
npm run sync:agents
```

Do not hand-edit generated copies (`AGENTS.md`, `.claude/rules`, and other adapters).

## Checks

Run what you changed, plus:

```bash
npm run check
npm test
npm run build
```

Fix failures you introduce. Do not mark a feature complete because the scaffold, a TODO or a green typecheck exists - the UI/API behaviour has to work.

Playwright (`npm run test:e2e`) is reserved for browser flows when a Playwright config is present; CI currently runs Vitest only.

## Pull requests

- One concern per PR where practical.
- Describe the behaviour change, migrations and how you verified it.
- Include screenshots or PDF pages for visual document work.
- Never paste secrets, production dumps or live customer data.
- Do not deploy production or email real clients as part of a development PR.

## Commits

Write a short message that explains *why*. Do not commit `node_modules`, build output, recovery copies of `node_modules`, or environment files.
