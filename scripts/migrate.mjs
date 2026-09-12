import { readFile } from 'node:fs/promises'
import { neon } from '@neondatabase/serverless'
try { process.loadEnvFile('.dev.vars') } catch {}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing. Add it to .dev.vars.')
const sql=neon(process.env.DATABASE_URL)
await sql`CREATE TABLE IF NOT EXISTS invoiceui_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`
for(const name of ['0001_workspace.sql']) {
 const rows=await sql`SELECT name FROM invoiceui_migrations WHERE name=${name}`
 if(rows.length){console.log(`${name}: already applied`);continue}
 const source=await readFile(new URL(`../migrations/${name}`,import.meta.url),'utf8')
 // These schema-only migrations contain no function bodies or embedded semicolons.
 const statements=source.replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean)
 await sql.transaction([...statements.map(statement=>sql.query(statement,[])),sql`INSERT INTO invoiceui_migrations(name) VALUES(${name})`])
 console.log(`${name}: applied`)
}
