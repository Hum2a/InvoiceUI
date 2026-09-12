import { betterAuth } from 'better-auth'
import { magicLink } from 'better-auth/plugins'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { drizzle } from 'drizzle-orm/neon-http'
import { Resend } from 'resend'
import * as schema from './auth-schema'
import { renderMagicLinkEmailHtml, renderMagicLinkEmailText } from '../shared/emailTemplate'

export const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
]

export function auth(env: Env, requestOrigin?: string) {
  const isDev = Boolean(requestOrigin && DEV_ORIGINS.includes(requestOrigin))
  const baseURL = isDev ? requestOrigin! : env.APP_URL
  const trustedOrigins = Array.from(new Set([env.APP_URL, ...DEV_ORIGINS]))

  return betterAuth({
    appName: 'InvoiceUI',
    baseURL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(drizzle(env.DATABASE_URL, { schema }), { provider: 'pg', schema }),
    trustedOrigins,
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 20 },
    session: { expiresIn: 60 * 60 * 24 * 7 },
    databaseHooks: {
      user: {
        create: {
          before: async user => (user.email.toLowerCase() === env.OWNER_EMAIL.toLowerCase() ? { data: user } : false),
        },
      },
    },
    plugins: [
      magicLink({
        storeToken: 'hashed',
        expiresIn: 600,
        rateLimit: { window: 60, max: 3 },
        sendMagicLink: async ({ email, url }) => {
          if (email.toLowerCase() !== env.OWNER_EMAIL.toLowerCase()) return
          if (isDev) {
            console.log(`[InvoiceUI Dev] Magic link for ${email}: ${url}`)
          }
          const { error } = await new Resend(env.RESEND_API_KEY).emails.send({
            from: env.EMAIL_FROM,
            to: email,
            subject: 'Sign in to InvoiceUI',
            html: renderMagicLinkEmailHtml({ email, url, expiresInMinutes: 10 }),
            text: renderMagicLinkEmailText({ email, url, expiresInMinutes: 10 }),
          })
          if (error) throw new Error('Sign-in email could not be sent')
        },
      }),
    ],
  })
}
