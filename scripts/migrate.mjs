import { readFile } from 'node:fs/promises'
import { neon } from '@neondatabase/serverless'
try { process.loadEnvFile('.dev.vars') } catch {}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing. Add it to .dev.vars.')
const sql=neon(process.env.DATABASE_URL)
await sql`CREATE TABLE IF NOT EXISTS invoiceui_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`
function splitStatements(sqlText) {
  const statements = []
  let current = ''
  let inDollarQuote = false
  for (let i = 0; i < sqlText.length; i++) {
    if (sqlText.slice(i, i + 2) === '$$') {
      inDollarQuote = !inDollarQuote
      current += '$$'
      i++
      continue
    }
    if (sqlText[i] === ';' && !inDollarQuote) {
      if (current.trim()) statements.push(current.trim())
      current = ''
      continue
    }
    current += sqlText[i]
  }
  if (current.trim()) statements.push(current.trim())
  return statements
}

for(const name of ['0001_workspace.sql', '0002_row_level_security.sql', '0003_app_role_rls.sql']) {
 const rows=await sql`SELECT name FROM invoiceui_migrations WHERE name=${name}`
 if(rows.length){console.log(`${name}: already applied`);continue}
 const source=await readFile(new URL(`../migrations/${name}`,import.meta.url),'utf8')
 const statements=splitStatements(source.replace(/^--.*$/gm,''))
 await sql.transaction([...statements.map(statement=>sql.query(statement,[])),sql`INSERT INTO invoiceui_migrations(name) VALUES(${name})`])
 console.log(`${name}: applied`)
}
