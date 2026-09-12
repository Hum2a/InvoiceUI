import { describe, it, expect } from 'vitest'
import { app } from '../src/worker/index'
import { DEV_ORIGINS, auth } from '../src/worker/auth'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function createTestEnv(): Env {
  return {
    APP_URL: 'https://invoiceui.humza.website',
    OWNER_EMAIL: 'humzab1711@hotmail.com',
    EMAIL_FROM: 'Invoices <invoices@humza.website>',
    DATABASE_URL: 'postgresql://fake:fake@ep-fake.neon.tech/neondb',
    BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long-1234567890',
    RESEND_API_KEY: 're_test_fake_api_key',
    DOCUMENTS: {
      get: async () => null,
      put: async () => {},
    } as unknown as R2Bucket,
    ASSETS: {
      fetch: async () => new Response(new Uint8Array([0, 1, 2, 3])),
    } as unknown as Fetcher,
  }
}

describe('Wave E: Row Level Security and Dev Origin Support', () => {
  it('allows state-changing requests from 127.0.0.1:5173 and localhost:5173 in local dev', async () => {
    const env = createTestEnv()

    // 127.0.0.1:5173 is a trusted dev origin; unauthenticated request proceeds past origin check to auth check (401)
    const resLocal1 = await app.request('/api/private/command', {
      method: 'POST',
      headers: {
        Origin: 'http://127.0.0.1:5173',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ version: 0, command: { type: 'archive', id: 'fake', value: true } }),
    }, env)
    expect(resLocal1.status).toBe(401)
    const data1 = await resLocal1.json() as { error: string }
    expect(data1.error).toBe('Sign in to continue')

    // localhost:5173 is also trusted
    const resLocal2 = await app.request('/api/private/command', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ version: 0, command: { type: 'archive', id: 'fake', value: true } }),
    }, env)
    expect(resLocal2.status).toBe(401)

    // untrusted external origin is rejected with 403 Forbidden
    const resUntrusted = await app.request('/api/private/command', {
      method: 'POST',
      headers: {
        Origin: 'https://attacker.evil.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ version: 0, command: { type: 'archive', id: 'fake', value: true } }),
    }, env)
    expect(resUntrusted.status).toBe(403)
    const dataUntrusted = await resUntrusted.json() as { error: string }
    expect(dataUntrusted.error).toBe('Untrusted request origin')
  })

  it('configures Better Auth with dev origins and dynamic baseURL', () => {
    const env = createTestEnv()

    expect(DEV_ORIGINS).toContain('http://localhost:5173')
    expect(DEV_ORIGINS).toContain('http://127.0.0.1:5173')

    const authInstanceDev = auth(env, 'http://127.0.0.1:5173')
    expect(authInstanceDev.options.baseURL).toBe('http://127.0.0.1:5173')
    expect(authInstanceDev.options.trustedOrigins).toContain('http://127.0.0.1:5173')
    expect(authInstanceDev.options.trustedOrigins).toContain(env.APP_URL)

    const authInstanceProd = auth(env)
    expect(authInstanceProd.options.baseURL).toBe(env.APP_URL)
  })

  it('validates RLS migrations enforce FORCE ROW LEVEL SECURITY and unprivileged role', () => {
    const rlsMigration = readFileSync(resolve(__dirname, '../migrations/0002_row_level_security.sql'), 'utf8')
    expect(rlsMigration).toContain('ALTER TABLE invoice_workspaces ENABLE ROW LEVEL SECURITY')
    expect(rlsMigration).toContain('ALTER TABLE invoice_workspaces FORCE ROW LEVEL SECURITY')
    expect(rlsMigration).toContain('CREATE POLICY invoice_workspaces_tenant_isolation')
    expect(rlsMigration).toContain("current_setting('app.current_user_id', true)")
    expect(rlsMigration).toContain("current_setting('app.service_role', true) = 'worker'")

    const roleMigration = readFileSync(resolve(__dirname, '../migrations/0003_app_role_rls.sql'), 'utf8')
    expect(roleMigration).toContain('invoiceui_app')
    expect(roleMigration).toContain('NOBYPASSRLS')
    expect(roleMigration).toContain('GRANT ALL ON TABLE invoice_workspaces TO invoiceui_app')
    expect(roleMigration).toContain('GRANT invoiceui_app TO CURRENT_USER')
  })
})
