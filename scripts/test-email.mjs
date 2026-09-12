#!/usr/bin/env node

/**
 * InvoiceUI Developer Email Testing Script
 *
 * Usage:
 *   node scripts/test-email.mjs [--to=email@example.com] [--scenario=smoke|invoice|reminder|magic-link] [--dry-run] [--note="Custom note"]
 *
 * Examples:
 *   node scripts/test-email.mjs --dry-run
 *   node scripts/test-email.mjs --to=humzab1711@hotmail.com --scenario=smoke
 *   node scripts/test-email.mjs --to=humzab1711@hotmail.com --scenario=invoice
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resend } from 'resend'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

// Load .dev.vars if available
const devVarsPath = path.join(rootDir, '.dev.vars')
const envVars = { ...process.env }
if (fs.existsSync(devVarsPath)) {
  const content = fs.readFileSync(devVarsPath, 'utf8')
  content.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim()
      let val = trimmed.slice(eqIdx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!envVars[key]) envVars[key] = val
    }
  })
}

// Defaults from environment or fallback constants
const RESEND_API_KEY = envVars.RESEND_API_KEY || ''
const EMAIL_FROM = envVars.EMAIL_FROM || 'Invoices <invoices@humza.website>'
const OWNER_EMAIL = envVars.OWNER_EMAIL || 'humzab1711@hotmail.com'
const APP_URL = envVars.APP_URL || 'https://invoiceui.humza.website'

// Parse command line arguments
const args = process.argv.slice(2)
const options = {
  to: OWNER_EMAIL,
  scenario: 'smoke',
  dryRun: false,
  note: '',
}

for (const arg of args) {
  if (arg === '--dry-run') options.dryRun = true
  else if (arg.startsWith('--to=')) options.to = arg.slice(5).trim()
  else if (arg.startsWith('--scenario=')) options.scenario = arg.slice(11).trim().toLowerCase()
  else if (arg.startsWith('--note=')) options.note = arg.slice(7).trim()
  else if (arg === '--help' || arg === '-h') {
    console.log(`
InvoiceUI Email Testing CLI
---------------------------
Options:
  --to=<email>             Target recipient email (defaults to OWNER_EMAIL)
  --scenario=<type>        Email scenario: smoke, invoice, reminder, magic-link (default: smoke)
  --dry-run                Render and inspect headers without sending via Resend
  --note=<text>            Add a custom note to test dynamic payload
  --help                   Show this help message
`)
    process.exit(0)
  }
}

// Deliverability headers helper
function getHeaders(scenario, messageId) {
  const headers = {
    'Auto-Submitted': 'auto-generated',
    'X-Auto-Response-Suppress': 'OOF, AutoReply',
    'X-Entity-Ref-ID': `invoiceui-cli/${messageId}`,
  }
  if (scenario === 'reminder') {
    headers['List-Unsubscribe'] = `<mailto:${OWNER_EMAIL}?subject=Unsubscribe%20Invoice%20Reminders>`
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
  }
  return headers
}

async function run() {
  console.log('\n[InvoiceUI DevTools] Outbound Email Deliverability Tester')
  console.log('---------------------------------------------------------')
  console.log(`Scenario:       ${options.scenario.toUpperCase()}`)
  console.log(`Target To:      ${options.to}`)
  console.log(`Sending From:   ${EMAIL_FROM}`)
  console.log(`App URL:        ${APP_URL}`)
  console.log(`Mode:           ${options.dryRun ? 'DRY-RUN (Simulated)' : 'LIVE SEND'}`)
  console.log('---------------------------------------------------------')

  const messageId = crypto.randomUUID()
  const headers = getHeaders(options.scenario, messageId)
  const timestamp = new Date().toISOString()

  let subject = `[InvoiceUI Test] Deliverability Smoke Check (${options.scenario})`
  let text = `InvoiceUI Outbound Deliverability Test\nScenario: ${options.scenario}\nTarget: ${options.to}\nTimestamp: ${timestamp}\n\nDeliverability headers verified.`
  let html = `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; background: #f4f4f5; padding: 24px; color: #18181b;">
  <div style="max-width: 540px; margin: 0 auto; background: #fff; padding: 24px; border-radius: 12px; border: 1px solid #e4e4e7;">
    <h2 style="margin-top: 0; color: #047857;">✓ Deliverability Test (${options.scenario.toUpperCase()})</h2>
    <p>This is a developer test email dispatched to verify Resend deliverability and anti-spam headers.</p>
    <table style="width: 100%; font-size: 13px; margin: 16px 0; border-collapse: collapse;">
      <tr><td style="padding: 4px 0; color: #71717a;">Recipient:</td><td>${options.to}</td></tr>
      <tr><td style="padding: 4px 0; color: #71717a;">Sending From:</td><td>${EMAIL_FROM}</td></tr>
      <tr><td style="padding: 4px 0; color: #71717a;">Timestamp:</td><td>${timestamp}</td></tr>
      <tr><td style="padding: 4px 0; color: #71717a;">App URL:</td><td>${APP_URL}</td></tr>
    </table>
    ${options.note ? `<div style="background: #eff6ff; padding: 12px; border-radius: 8px; font-size: 13px; color: #1e3a8a;"><strong>Custom Note:</strong> ${options.note}</div>` : ''}
    <p style="font-size: 11px; color: #71717a; border-top: 1px solid #e4e4e7; padding-top: 12px; margin-top: 20px;">
      Auto-Submitted: auto-generated · Suppression: OOF, AutoReply · Delivered via Resend
    </p>
  </div>
</body>
</html>`

  if (options.scenario === 'invoice') {
    subject = `[Test Invoice] INV-2026-SAMPLE from Acme Studio Ltd`
    text = `Invoice INV-2026-SAMPLE for GBP 1,230.00 is ready for review.\n\nNotice: This is a developer test email.`
  } else if (options.scenario === 'reminder') {
    subject = `[Test Reminder] Overdue payment reminder: INV-2026-SAMPLE`
    text = `Friendly reminder: Invoice INV-2026-SAMPLE is past due.\n\nNotice: This is a developer test email.`
  } else if (options.scenario === 'magic-link') {
    subject = `[Test Auth] Sign in to InvoiceUI (Preview)`
    text = `Sign in link: ${APP_URL}/?test_magic_link=true\n\nNotice: This is a developer test email.`
  }

  if (options.dryRun) {
    console.log('\n[Dry Run Result] Email prepared successfully:')
    console.log(`Subject:        ${subject}`)
    console.log(`Headers:        ${JSON.stringify(headers, null, 2)}`)
    console.log(`Plaintext preview (first 120 chars):`)
    console.log(text.slice(0, 120) + '...\n')
    console.log('✓ Dry-run completed. No API requests were sent.')
    return
  }

  if (!RESEND_API_KEY) {
    console.error('\n✕ Error: RESEND_API_KEY is not set.')
    console.error('Please configure RESEND_API_KEY in .dev.vars or your environment.\n')
    process.exit(1)
  }

  console.log('\nConnecting to Resend API and dispatching message...')
  const start = Date.now()

  try {
    const resend = new Resend(RESEND_API_KEY)
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: options.to,
      replyTo: OWNER_EMAIL,
      subject,
      text,
      html,
      headers,
    })

    const latency = Date.now() - start

    if (error) {
      console.error(`\n✕ Resend API rejected message (${latency}ms):`)
      console.error(`  Code/Message: ${error.message}`)
      if (error.message?.toLowerCase().includes('domain')) {
        console.error('  Troubleshooting: Verify your domain SPF/DKIM at https://resend.com/domains')
      }
      process.exit(1)
    }

    console.log(`\n✓ Email dispatched successfully in ${latency}ms!`)
    console.log(`  Resend Email ID: ${data?.id}`)
    console.log(`  Recipient:       ${options.to}`)
    console.log(`  From:            ${EMAIL_FROM}`)
    console.log('\nCheck your recipient inbox and spam folder for delivery verification.\n')
  } catch (err) {
    console.error(`\n✕ Network or execution error: ${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  }
}

run()
