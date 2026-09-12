import { Resend } from 'resend'
import { Buffer } from 'node:buffer'
import { neon } from '@neondatabase/serverless'
import { status, runSchedules, today, totals } from '../shared/domain'
import { filename } from '../shared/pdf'
import { document } from './documents'
import { read, update } from './store'

export async function deliver(env:Env,owner:string,messageId:string){if(!env.RESEND_API_KEY)return;const claim=crypto.randomUUID();let claimed=false;
 const envelope=await update(env,owner,w=>{claimed=false;const m=w.messages.find(m=>m.id===messageId);if(!m)return w;const i=w.invoices.find(i=>i.id===m.invoiceId);if(!i)return w;
 const day=today(w.business.timezone);const isPaused=Boolean(i.reminder?.pausedUntil&&i.reminder.pausedUntil>=day);const bal=totals(i,w.creditNotes).balance;const isPaidOrNoBal=Number(bal)<=0;
 if(i.lifecycle!=='issued'||(m.kind==='reminder'&&(status(i,day,w.creditNotes)!=='overdue'||!i.reminder.enabled||!w.business.autoReminders||isPaused||isPaidOrNoBal||w.messages.some(prev=>prev.invoiceId===i.id&&prev.status==='bounced')))){if(['queued','sending'].includes(m.status))m.status='cancelled';return w}
 if(m.status==='sending'&&m.attempted&&Date.now()-Date.parse(m.attempted)<300000)return w;if(m.status!=='queued'&&m.status!=='sending')return w;
 if(m.attempted&&Date.now()-Date.parse(m.attempted)>23*60*60*1000){m.status='uncertain';m.error='Delivery outcome is uncertain. Check Resend before creating another email.';return w}
 m.status='sending';m.attempted??=new Date().toISOString();m.error=claim;claimed=true;return w});
 if(!claimed)return;const message=envelope.data.messages.find(m=>m.id===messageId)!;const invoice=envelope.data.invoices.find(i=>i.id===message.invoiceId)!;
 try{const attachments=[{filename:filename(invoice),content:Buffer.from(await document(env,owner,envelope.data,invoice)).toString('base64')}];if(invoice.breakdown)attachments.push({filename:filename(invoice,true),content:Buffer.from(await document(env,owner,envelope.data,invoice,true)).toString('base64')});
 for(const att of invoice.attachments||[]){if(att.visibility==='client'&&att.dataUrl){const base64=att.dataUrl.includes(',')?att.dataUrl.split(',')[1]:att.dataUrl;attachments.push({filename:att.name,content:base64})}}
 const fresh=await read(env,owner);const current=fresh.data.invoices.find(i=>i.id===invoice.id);const freshDay=today(fresh.data.business.timezone);const freshPaused=Boolean(current?.reminder?.pausedUntil&&current.reminder.pausedUntil>=freshDay);const freshBal=current?totals(current,fresh.data.creditNotes).balance:'0';const freshPaid=Number(freshBal)<=0;
 if(!current||current.lifecycle!=='issued'||(message.kind==='reminder'&&(status(current,freshDay,fresh.data.creditNotes)!=='overdue'||!current.reminder.enabled||!fresh.data.business.autoReminders||freshPaused||freshPaid||fresh.data.messages.some(prev=>prev.invoiceId===current.id&&prev.status==='bounced')))){await update(env,owner,w=>{const m=w.messages.find(m=>m.id===messageId);if(m)m.status='cancelled';return w});return}
 const {data,error}=await new Resend(env.RESEND_API_KEY).emails.send({from:env.EMAIL_FROM,to:message.to,cc:message.cc,replyTo:message.replyTo||undefined,subject:message.subject,text:message.body,attachments},{idempotencyKey:`invoiceui/${owner}/${message.id}`});
 if(error)throw new Error(error.message||'Email provider rejected the request');
 await update(env,owner,w=>{const m=w.messages.find(m=>m.id===messageId)!;m.providerId=data!.id;if(m.status==='sending')m.status='sent';m.error=undefined;return w})
 }catch(err){const msg=err instanceof Error?err.message:'Delivery failed';await update(env,owner,w=>{const m=w.messages.find(m=>m.id===messageId);if(m?.status==='sending'&&m.error===claim){m.status='failed';m.error=msg}return w})}
}
export async function scheduled(env:Env){if(!env.DATABASE_URL)return;const sql=neon(env.DATABASE_URL);const owners=await sql`SELECT w.owner_id FROM invoice_workspaces w JOIN auth_user u ON u.id=w.owner_id WHERE lower(u.email)=${env.OWNER_EMAIL.toLowerCase()}`;for(const row of owners){const e=await update(env,row.owner_id,w=>runSchedules(w));if(env.RESEND_API_KEY){for(const m of e.data.messages.filter(m=>['queued'].includes(m.status)).slice(0,10))await deliver(env,row.owner_id,m.id)}}}
