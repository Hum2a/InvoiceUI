import { readFile } from 'node:fs/promises'
import { neon } from '@neondatabase/serverless'
try { process.loadEnvFile('.dev.vars') } catch {}
const [file,ownerEmail,flag]=process.argv.slice(2)
if(!file||!ownerEmail||flag!=='--empty-workspace-only')throw new Error('Usage: node scripts/restore.mjs backup.json owner@email --empty-workspace-only')
const backup=JSON.parse(await readFile(file,'utf8'))
if(backup.format!=='invoiceui-backup'||backup.schemaVersion!==1||backup.data?.schemaVersion!==1||!Array.isArray(backup.data.invoices))throw new Error('Unsupported backup format')
if(JSON.stringify(backup.data).length>5_000_000)throw new Error('Backup exceeds workspace capacity')
// Public links never survive a restore; queued emails must be reviewed again.
for(const i of backup.data.invoices){delete i.share;i.reminder.enabled=false}
for(const s of backup.data.schedules)s.paused=true
for(const m of backup.data.messages)if(['queued','sending'].includes(m.status))m.status='draft'
const sql=neon(process.env.DATABASE_URL)
const [user]=await sql`SELECT id FROM auth_user WHERE lower(email)=${ownerEmail.toLowerCase()}`
if(!user)throw new Error('Sign in once as the target owner before restoring')
const result=await sql`INSERT INTO invoice_workspaces(owner_id,data) VALUES(${user.id},${JSON.stringify(backup.data)}::jsonb) ON CONFLICT (owner_id) DO UPDATE SET data=excluded.data,version=invoice_workspaces.version+1 WHERE invoice_workspaces.data->'invoices'='[]'::jsonb AND invoice_workspaces.data->'clients'='[]'::jsonb AND invoice_workspaces.data->'services'='[]'::jsonb AND invoice_workspaces.data->'projects'='[]'::jsonb RETURNING version`
if(!result.length)throw new Error('Restore refused: target workspace is not empty')
console.log('Backup restored. Links revoked, automation paused. Keep the PDF archive from your backup.')
