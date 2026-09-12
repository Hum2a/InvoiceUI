import { z } from 'zod'
import Decimal from 'decimal.js'

const text = z.string().max(4000)
const id = z.string().uuid()
const date = z.iso.date()
const amount = z.string().regex(/^\d{1,9}(\.\d{1,4})?$/, 'Use a positive number with up to four decimal places')
const email = z.union([z.email(), z.literal('')])
export const businessSchema = z.object({
  name: text,
  email,
  address: text,
  addressLine1: text.optional(),
  addressLine2: text.optional(),
  city: text.optional(),
  state: text.optional(),
  postalCode: text.optional(),
  country: text.optional(),
  bank: text,
  bankName: text.optional(),
  bankId: z.string().optional(),
  accountName: text.optional(),
  accountNumber: text.optional(),
  sortCode: text.optional(),
  iban: text.optional(),
  bic: text.optional(),
  bankLogo: z.string().max(600000).optional(),
  footer: text,
  taxId: text,
  logo: z.string().max(600000),
  currency: z.enum(['GBP','USD','EUR','CAD','AUD','JPY','KWD']),
  terms: z.number().int().min(0).max(365),
  prefix: z.string().regex(/^[A-Za-z0-9-]{1,20}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  template: z.enum(['studio','minimal','classic']),
  timezone: z.string().refine(v => { try { new Intl.DateTimeFormat('en', {timeZone:v}); return true } catch {return false} }),
  autoReminders: z.boolean().default(false),
  onboardingDismissed: z.boolean().default(false).optional()
})
export * from './banks'
export const portalNoticeSchema = z.object({ id: z.string(), date, amount: amount.optional(), reference: text.optional(), notes: text.optional(), created: z.string() })
export type PortalNotice = z.infer<typeof portalNoticeSchema>
export const clientPortalSchema = z.object({ token: z.string(), expires: date, allowedInvoiceIds: z.array(z.string()).optional(), allowStatements: z.boolean().default(true).optional(), allowAttachments: z.boolean().default(true).optional(), paymentNotices: z.array(portalNoticeSchema).default([]).optional() })
export type ClientPortalConfig = z.infer<typeof clientPortalSchema>
export const clientSchema = z.object({id, name: text, email, address: text, contact: text.optional(), phone: text.optional(), addressLine1: text.optional(), addressLine2: text.optional(), city: text.optional(), state: text.optional(), postalCode: text.optional(), country: text.optional(), taxId: text.optional(), cc: z.array(z.email()).max(10), replyTo: email, terms: z.number().int().min(0).max(365), notes: text, currency: z.enum(['GBP','USD','EUR','CAD','AUD','JPY','KWD']).optional(), template: z.enum(['studio','minimal','classic']).optional(), paymentInstructions: text.optional(), rateOverrides: z.record(z.string(), amount).optional(), portal: clientPortalSchema.optional()})

export const COMMON_COUNTRIES = [
  'United Kingdom',
  'United States',
  'Canada',
  'Australia',
  'Ireland',
  'Germany',
  'France',
  'Netherlands',
  'Spain',
  'Italy',
  'Switzerland',
  'Belgium',
  'Austria',
  'Sweden',
  'Norway',
  'Denmark',
  'New Zealand',
  'Singapore',
  'United Arab Emirates',
  'Kuwait',
  'Japan',
] as const

export interface CountryFieldLabels {
  postalCodeLabel: string
  postalCodePlaceholder: string
  stateLabel: string
  statePlaceholder: string
  taxIdLabel: string
  taxIdPlaceholder: string
  phonePlaceholder: string
}

export function getCountryFieldLabels(country?: string): CountryFieldLabels {
  const c = (country || '').trim().toLowerCase()
  if (c === 'united kingdom' || c === 'uk' || c === 'gb' || c === 'great britain') {
    return {
      postalCodeLabel: 'Postcode',
      postalCodePlaceholder: 'e.g. EC1A 1BB',
      stateLabel: 'County / Region (optional)',
      statePlaceholder: 'e.g. Greater London',
      taxIdLabel: 'VAT number / Company Reg (optional)',
      taxIdPlaceholder: 'e.g. GB123456789 or 12345678',
      phonePlaceholder: 'e.g. +44 20 7946 0192',
    }
  }
  if (c === 'united states' || c === 'usa' || c === 'us') {
    return {
      postalCodeLabel: 'ZIP code',
      postalCodePlaceholder: 'e.g. 90210',
      stateLabel: 'State',
      statePlaceholder: 'e.g. CA or California',
      taxIdLabel: 'EIN / Tax ID (optional)',
      taxIdPlaceholder: 'e.g. 12-3456789',
      phonePlaceholder: 'e.g. +1 (555) 234-5678',
    }
  }
  if (c === 'canada' || c === 'ca') {
    return {
      postalCodeLabel: 'Postal code',
      postalCodePlaceholder: 'e.g. M5V 2T6',
      stateLabel: 'Province / Territory',
      statePlaceholder: 'e.g. ON or Ontario',
      taxIdLabel: 'BN / GST/HST number (optional)',
      taxIdPlaceholder: 'e.g. 123456789 RT 0001',
      phonePlaceholder: 'e.g. +1 (416) 555-0199',
    }
  }
  if (c === 'australia' || c === 'au') {
    return {
      postalCodeLabel: 'Postcode',
      postalCodePlaceholder: 'e.g. 2000',
      stateLabel: 'State / Territory',
      statePlaceholder: 'e.g. NSW',
      taxIdLabel: 'ABN / ACN (optional)',
      taxIdPlaceholder: 'e.g. 51 824 753 556',
      phonePlaceholder: 'e.g. +61 2 9876 5432',
    }
  }
  if (c === 'ireland' || c === 'ie') {
    return {
      postalCodeLabel: 'Eircode / Postcode',
      postalCodePlaceholder: 'e.g. D02 X285',
      stateLabel: 'County (optional)',
      statePlaceholder: 'e.g. Co. Dublin',
      taxIdLabel: 'VAT / Tax number (optional)',
      taxIdPlaceholder: 'e.g. IE1234567T',
      phonePlaceholder: 'e.g. +353 1 234 5678',
    }
  }
  if (c === 'germany' || c === 'deutschland' || c === 'de') {
    return {
      postalCodeLabel: 'Postleitzahl (PLZ)',
      postalCodePlaceholder: 'e.g. 10115',
      stateLabel: 'Bundesland / State (optional)',
      statePlaceholder: 'e.g. Berlin',
      taxIdLabel: 'USt-IdNr. / Steuernummer (optional)',
      taxIdPlaceholder: 'e.g. DE123456789',
      phonePlaceholder: 'e.g. +49 30 1234567',
    }
  }
  if (c === 'france' || c === 'fr') {
    return {
      postalCodeLabel: 'Code postal',
      postalCodePlaceholder: 'e.g. 75001',
      stateLabel: 'Region / Departement (optional)',
      statePlaceholder: 'e.g. Ile-de-France',
      taxIdLabel: 'Numero de TVA / SIREN (optional)',
      taxIdPlaceholder: 'e.g. FR12345678901',
      phonePlaceholder: 'e.g. +33 1 23 45 67 89',
    }
  }
  return {
    postalCodeLabel: 'Postal / ZIP code',
    postalCodePlaceholder: 'e.g. Postal code',
    stateLabel: 'State / County / Province',
    statePlaceholder: 'e.g. Region or Province',
    taxIdLabel: 'Tax ID / VAT number (optional)',
    taxIdPlaceholder: 'Tax or registration identifier',
    phonePlaceholder: 'e.g. +44 20 7946 0192',
  }
}

export interface Addressable {
  address?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

export function formatAddressLines(target: Addressable): string[] {
  const hasSeparated = Boolean(
    target.addressLine1?.trim() ||
    target.addressLine2?.trim() ||
    target.city?.trim() ||
    target.state?.trim() ||
    target.postalCode?.trim() ||
    target.country?.trim()
  )
  if (!hasSeparated) {
    if (!target.address?.trim()) return []
    return target.address.split('\n').map(l => l.trim()).filter(Boolean)
  }
  const lines: string[] = []
  if (target.addressLine1?.trim()) lines.push(target.addressLine1.trim())
  if (target.addressLine2?.trim()) lines.push(target.addressLine2.trim())
  const cityStateZip = [target.city?.trim(), target.state?.trim(), target.postalCode?.trim()].filter(Boolean).join(', ')
  if (cityStateZip) lines.push(cityStateZip)
  if (target.country?.trim()) lines.push(target.country.trim())
  return lines
}

export function formatAddress(target: Addressable): string {
  const lines = formatAddressLines(target)
  if (lines.length > 0) return lines.join('\n')
  return target.address?.trim() || ''
}

export const formatClientAddressLines = formatAddressLines
export const formatClientAddress = formatAddress
export const milestoneSchema = z.object({id, projectId:z.string(), title:text, description:text.optional(), amount, order:z.number().int().min(1), status:z.enum(['pending','reserved','billed']).default('pending'), isDeposit:z.boolean().default(false), reservedDraftId:z.string().optional(), billedInvoiceId:z.string().optional(), billedAt:z.string().optional(), created:z.string(), updated:z.string()})
export type Milestone = z.infer<typeof milestoneSchema>
export const projectSchema = z.object({id, name:text, clientId:z.string(), notes:text, agreedAmount:amount.optional(), currency:businessSchema.shape.currency.optional(), milestones:z.array(milestoneSchema).optional()})
export const workEntrySchema = z.object({id, clientId:z.string(), projectId:z.string().optional(), date, description:text, quantity:amount, rate:amount, unit:z.enum(['hour','fixed','unit']).default('hour'), billable:z.boolean().default(true), status:z.enum(['unbilled','reserved','billed','discarded']).default('unbilled'), reservedDraftId:z.string().optional(), billedInvoiceId:z.string().optional(), billedAt:z.string().optional(), created:z.string(), updated:z.string()})
export type WorkEntry = z.infer<typeof workEntrySchema>
export const serviceSchema = z.object({id, name:text, description:text, rate:amount, unit:z.enum(['fixed','hour','unit'])})
export const lineSchema = z.object({id, description:text, quantity:amount, rate:amount, unit:z.enum(['fixed','hour','unit']), group: text.optional()})
export const starterLineSchema = z.object({id, description:text, quantity:amount, rate:amount, unit:z.enum(['fixed','hour','unit']), group: text.optional()})
export const starterSchema = z.object({id, name:text, description:text, lines:z.array(starterLineSchema).min(1).max(100), terms:z.number().int().min(0).max(365).optional(), notes:text.optional(), favourite:z.boolean().default(false)})
export const attachmentSchema = z.object({id, name: z.string().min(1).max(200), size: z.number().int().min(1).max(5_000_000), mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg']), dataUrl: z.string().max(7_500_000), visibility: z.enum(['internal', 'client']).default('internal'), created: z.string()})
export const draftSchema = z.object({id, clientId:z.string(), projectId:z.string(), client:clientSchema, issueDate:date, dueDate:date, terms:z.number().int().min(0).max(365), manualDue:z.boolean(), currency:businessSchema.shape.currency, lines:z.array(lineSchema).min(1).max(100), tax:amount.refine(v=>new Decimal(v).lte(100)), discount:amount, discountType:z.enum(['amount','percent']), deposit:amount, notes:text, internalNotes:text.default('').optional(), attachments:z.array(attachmentSchema).max(20).default([]).optional(), po:text, reference:text, breakdown:text, instalments:z.array(z.object({date,amount})).max(24), template:businessSchema.shape.template, accent:businessSchema.shape.accent, replacementOf:z.string().optional(), convertedFromQuoteId:z.string().optional(), convertedFromQuoteNumber:z.string().optional(), reservedWorkEntryIds:z.array(z.string()).optional(), reservedMilestoneId:z.string().optional()})
export const paymentSchema=z.object({id,amount:amount,date,method:text,reference:text,notes:text,reversed:z.boolean()})
export const creditNoteSchema=z.object({id,number:z.string(),invoiceId:id,invoiceNumber:z.string(),clientId:id,client:clientSchema,business:businessSchema.nullable(),issueDate:date,reason:z.string().min(1).max(1000),currency:businessSchema.shape.currency,lines:z.array(lineSchema).min(1).max(100),subtotal:amount,tax:amount,taxAmount:amount,total:amount,replacementDraftId:id.optional(),created:z.string(),issuedAt:z.string()})
export const paymentAllocationSchema=z.object({id,invoiceId:id,amount:amount,created:z.string(),reversed:z.boolean().default(false)})
export const paymentRefundSchema=z.object({id,amount:amount,date,reference:text,notes:text,created:z.string()})
export const clientPaymentSchema=z.object({id,clientId:id,currency:businessSchema.shape.currency,amount:amount,date,method:text,reference:text,notes:text,allocations:z.array(paymentAllocationSchema),unallocated:amount,refunds:z.array(paymentRefundSchema),reversed:z.boolean().default(false),created:z.string(),updated:z.string()})
export const receiptAllocationSchema=z.object({invoiceId:id,invoiceNumber:z.string(),amount,balanceRemaining:amount})
export const receiptSchema=z.object({id,number:z.string(),paymentId:id,clientId:id,client:clientSchema,business:businessSchema.nullable(),date,currency:businessSchema.shape.currency,amount,method:text,reference:text,notes:text,allocations:z.array(receiptAllocationSchema),unallocated:amount,reversed:z.boolean().default(false),reversedAt:z.string().optional(),created:z.string()})
export const quoteAcceptanceSchema=z.object({date,method:z.enum(['email','in_person','verbal','signed_document','other']),reference:text.optional(),notes:text.optional(),recordedAt:z.string()})
export const quoteSchema=z.object({id,quoteNumber:z.string(),revision:z.number().int().min(1),status:z.enum(['draft','sent','accepted','declined','expired','superseded']),clientId:z.string(),projectId:z.string().optional(),client:clientSchema,issueDate:date,expiryDate:date,currency:businessSchema.shape.currency,lines:z.array(lineSchema).min(1).max(100),tax:amount.refine(v=>new Decimal(v).lte(100)),discount:amount,discountType:z.enum(['amount','percent']),scope:text.optional(),notes:text,acceptance:quoteAcceptanceSchema.optional(),declinedReason:text.optional(),convertedInvoiceId:z.string().optional(),supersededBy:z.string().optional(),supersededAt:z.string().optional(),template:businessSchema.shape.template,accent:businessSchema.shape.accent,created:z.string(),updated:z.string()})
export const scheduleSchema=z.object({id,invoiceId:id,nextDate:date,day:z.number().int().min(1).max(31),months:z.number().int().min(1).max(12),paused:z.boolean(),lastRunDate:date.optional()})
export const messageSchema=z.object({id,invoiceId:id,kind:z.enum(['invoice','reminder']),to:z.email(),cc:z.array(z.email()).max(10),replyTo:email,subject:z.string().min(1).max(200),body:z.string().min(1).max(10000),status:z.enum(['draft','queued','sending','sent','delivered','bounced','failed','cancelled','uncertain']),created:z.string(),providerId:z.string().optional(),attempted:z.string().optional(),error:z.string().optional()})
export type Business=z.infer<typeof businessSchema>
export type Client=z.infer<typeof clientSchema>
export type Project=z.infer<typeof projectSchema>
export type Service=z.infer<typeof serviceSchema>
export type Starter=z.infer<typeof starterSchema>
export type Line=z.infer<typeof lineSchema>
export type Attachment=z.infer<typeof attachmentSchema>
export type Draft=z.infer<typeof draftSchema>
export type Payment=z.infer<typeof paymentSchema>
export type CreditNote=z.infer<typeof creditNoteSchema>
export type PaymentAllocation=z.infer<typeof paymentAllocationSchema>
export type PaymentRefund=z.infer<typeof paymentRefundSchema>
export type ClientPayment=z.infer<typeof clientPaymentSchema>
export type ReceiptAllocation=z.infer<typeof receiptAllocationSchema>
export type Receipt=z.infer<typeof receiptSchema>
export type QuoteAcceptance=z.infer<typeof quoteAcceptanceSchema>
export type Quote=z.infer<typeof quoteSchema>
export type Message=z.infer<typeof messageSchema>
export interface StatementEntry{id:string;date:string;type:'invoice'|'creditNote'|'payment'|'refund';reference:string;description:string;charges:string;credits:string;balance:string}
export interface ClientStatement{clientId:string;client:Client;business:Business;currency:Business['currency'];startDate:string;endDate:string;openingBalance:string;periodCharges:string;periodCredits:string;periodPayments:string;periodRefunds:string;closingBalance:string;entries:StatementEntry[];generatedAt:string}
export interface AttentionItem{id:string;kind:'unsent'|'delivery_failed'|'overdue'|'unreviewed_draft'|'payment_notice';title:string;detail:string;invoiceId?:string;invoiceNumber?:string;clientId?:string;clientName?:string;amount?:string;currency?:string;date?:string;pausedUntil?:string;pauseReason?:string;paymentNoticeId?:string}
export type Invoice=Draft & { number:string; lifecycle:'draft'|'issued'|'void'; archived:boolean; business:Business|null; payments:Payment[]; created:string; updated:string; issuedAt?:string; voidReason?:string; share?:{token:string;expires:string}; reminder:{enabled:boolean;days:number;lastDate:string;pausedUntil?:string;pauseReason?:string}; internalNotes?:string; attachments?:Attachment[]; creditNoteIds?:string[]; replacementOf?:string; replacementDraftId?:string; convertedFromQuoteId?:string; convertedFromQuoteNumber?:string; reservedWorkEntryIds?:string[]; reservedMilestoneId?:string }
export const businessProfileSchema=z.object({id,name:text,isDefault:z.boolean().default(false),business:businessSchema,clients:z.array(clientSchema),projects:z.array(projectSchema),services:z.array(serviceSchema),starters:z.array(starterSchema),invoices:z.array(z.any()),creditNotes:z.array(creditNoteSchema).optional(),payments:z.array(clientPaymentSchema).optional(),receipts:z.array(receiptSchema).optional(),quotes:z.array(quoteSchema).optional(),workEntries:z.array(workEntrySchema).optional(),schedules:z.array(scheduleSchema),messages:z.array(messageSchema),sequence:z.record(z.string(),z.number()),audit:z.array(z.object({id:z.string(),at:z.string(),action:text,invoiceId:z.string().optional()})),created:z.string(),updated:z.string()})
export type BusinessProfile=z.infer<typeof businessProfileSchema>
export interface Workspace {schemaVersion:1; business:Business; clients:Client[]; projects:Project[]; services:Service[]; starters:Starter[]; invoices:Invoice[]; creditNotes?:CreditNote[]; payments?:ClientPayment[]; receipts?:Receipt[]; quotes?:Quote[]; workEntries?:WorkEntry[]; schedules:z.infer<typeof scheduleSchema>[]; messages:Message[]; sequence:Record<string,number>; audit:{id:string;at:string;action:string;invoiceId?:string}[]; activeProfileId?:string; profiles?:BusinessProfile[]}
export type Envelope={version:number;data:Workspace}
export function today(timezone='Europe/London',now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export function addDays(value:string,days:number){const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
export function nextMonth(value:string,months:number,day:number){const d=new Date(value+'T12:00:00Z');d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString().slice(0,10)}
export function emptyWorkspace():Workspace{const initialBusiness:Business={name:'',email:'',address:'',addressLine1:'',addressLine2:'',city:'',state:'',postalCode:'',country:'',bank:'',footer:'Thank you for your business.',taxId:'',logo:'',currency:'GBP',terms:30,prefix:'INV',accent:'#bef264',template:'studio',timezone:'Europe/London',autoReminders:false,onboardingDismissed:false};const profileId=crypto.randomUUID();const defaultProfile:BusinessProfile={id:profileId,name:'Primary Profile',isDefault:true,business:initialBusiness,clients:[],projects:[],services:[],starters:[],invoices:[],creditNotes:[],payments:[],receipts:[],quotes:[],workEntries:[],schedules:[],messages:[],sequence:{},audit:[],created:new Date().toISOString(),updated:new Date().toISOString()};return {schemaVersion:1,business:initialBusiness,clients:[],projects:[],services:[],starters:[],invoices:[],creditNotes:[],payments:[],receipts:[],quotes:[],workEntries:[],schedules:[],messages:[],sequence:{},audit:[],activeProfileId:profileId,profiles:[defaultProfile]}}
export function ensureProfiles(w:Workspace):Workspace{if(!w.profiles||w.profiles.length===0){const profileId=w.activeProfileId||crypto.randomUUID();const defaultProfile:BusinessProfile={id:profileId,name:w.business.name?`${w.business.name} (Primary)`:'Primary Profile',isDefault:true,business:structuredClone(w.business),clients:structuredClone(w.clients||[]),projects:structuredClone(w.projects||[]),services:structuredClone(w.services||[]),starters:structuredClone(w.starters||[]),invoices:structuredClone(w.invoices||[]),creditNotes:structuredClone(w.creditNotes||[]),payments:structuredClone(w.payments||[]),receipts:structuredClone(w.receipts||[]),quotes:structuredClone(w.quotes||[]),workEntries:structuredClone(w.workEntries||[]),schedules:structuredClone(w.schedules||[]),messages:structuredClone(w.messages||[]),sequence:structuredClone(w.sequence||{}),audit:structuredClone(w.audit||[]),created:new Date().toISOString(),updated:new Date().toISOString()};w.profiles=[defaultProfile];w.activeProfileId=profileId}if(!w.activeProfileId||!w.profiles.some(p=>p.id===w.activeProfileId)){w.activeProfileId=w.profiles[0].id}return w}
export function blankClient():Client{return {id:crypto.randomUUID(),name:'',email:'',address:'',contact:'',phone:'',addressLine1:'',addressLine2:'',city:'',state:'',postalCode:'',country:'',taxId:'',cc:[],replyTo:'',terms:30,notes:''}}
export function newInvoice(w:Workspace):Invoice{const now=new Date().toISOString();const issueDate=today(w.business.timezone);return {id:crypto.randomUUID(),number:'',lifecycle:'draft',archived:false,business:null,clientId:'',projectId:'',client:blankClient(),issueDate,dueDate:addDays(issueDate,w.business.terms),terms:w.business.terms,manualDue:false,currency:w.business.currency,lines:[{id:crypto.randomUUID(),description:'',quantity:'1',rate:'0',unit:'fixed'}],tax:'0',discount:'0',discountType:'amount',deposit:'0',notes:'',internalNotes:'',attachments:[],po:'',reference:'',breakdown:'',instalments:[],template:w.business.template,accent:w.business.accent,payments:[],creditNoteIds:[],created:now,updated:now,reminder:{enabled:false,days:7,lastDate:''}}}
export function precision(currency:string){return new Intl.NumberFormat('en',{style:'currency',currency}).resolvedOptions().maximumFractionDigits ?? 2}
export function totals(i:Draft & {payments?:Payment[]; creditNoteIds?:string[]}, allCreditNotes:CreditNote[]=[]){const dp=precision(i.currency);const round=(v:Decimal)=>v.toDecimalPlaces(dp,Decimal.ROUND_HALF_UP);const lineTotals=i.lines.map(l=>round(new Decimal(l.quantity||0).mul(l.rate||0)));const subtotal=lineTotals.reduce((a,b)=>a.add(b),new Decimal(0));const discount=round(i.discountType==='percent'?subtotal.mul(i.discount||0).div(100):new Decimal(i.discount||0));const net=Decimal.max(0,subtotal.sub(discount));const tax=round(net.mul(i.tax||0).div(100));const total=net.add(tax);const matchingCredits=(allCreditNotes||[]).filter(c=>c.invoiceId===i.id);const credited=matchingCredits.reduce((a,c)=>a.add(c.total||0),new Decimal(0));const adjustedTotal=Decimal.max(0,total.sub(credited));const paid=(i.payments??[]).filter(p=>!p.reversed).reduce((a,p)=>a.add(p.amount),new Decimal(0));const balance=Decimal.max(0,adjustedTotal.sub(paid));const overpayment=Decimal.max(0,paid.sub(adjustedTotal));return {lineTotals:lineTotals.map(x=>x.toFixed(dp)),subtotal:subtotal.toFixed(dp),discount:discount.toFixed(dp),tax:tax.toFixed(dp),total:total.toFixed(dp),credited:credited.toFixed(dp),adjustedTotal:adjustedTotal.toFixed(dp),paid:paid.toFixed(dp),balance:balance.toFixed(dp),overpayment:overpayment.toFixed(dp)}}
export const money=(value:string|number,currency:string)=>new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(Number(value))
export function status(i:Invoice,day=today(),allCreditNotes:CreditNote[]=[]){if(i.lifecycle!=='issued')return i.lifecycle;const t=totals(i,allCreditNotes);if(new Decimal(t.adjustedTotal).lte(0)&&new Decimal(t.credited).gt(0))return 'credited';if(new Decimal(t.balance).lte(0))return 'paid';if(i.dueDate<day)return 'overdue';return new Decimal(t.paid).gt(0)?'partially paid':'unpaid'}
export function clientAvailableCredit(clientId:string,currency:string,payments:ClientPayment[]=[]):string{const dp=precision(currency);const sum=payments.filter(p=>p.clientId===clientId&&p.currency===currency&&!p.reversed).reduce((acc,p)=>acc.add(p.unallocated||0),new Decimal(0));return sum.toFixed(dp)}
export function suggestPaymentAllocations(amountToAllocate:string|number,currency:string,invoices:Invoice[],creditNotes:CreditNote[]=[]):{invoiceId:string;invoiceNumber:string;balance:string;amount:string}[]{const dp=precision(currency);let rem=new Decimal(amountToAllocate);const eligible=invoices.filter(i=>i.lifecycle==='issued'&&i.currency===currency&&new Decimal(totals(i,creditNotes).balance).gt(0)).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));const result:{invoiceId:string;invoiceNumber:string;balance:string;amount:string}[]=[];for(const inv of eligible){if(rem.lte(0))break;const bal=new Decimal(totals(inv,creditNotes).balance);const alloc=Decimal.min(bal,rem);if(alloc.gt(0)){result.push({invoiceId:inv.id,invoiceNumber:inv.number||'Invoice',balance:bal.toFixed(dp),amount:alloc.toFixed(dp)});rem=rem.sub(alloc)}}return result}
export function quoteTotals(q: { lines: Line[]; currency: string; discount: string; discountType: 'amount' | 'percent'; tax: string }) {
  const dp = precision(q.currency);
  const round = (v: Decimal) => v.toDecimalPlaces(dp, Decimal.ROUND_HALF_UP);
  const lineTotals = q.lines.map(l => round(new Decimal(l.quantity || 0).mul(l.rate || 0)));
  const subtotal = lineTotals.reduce((a, b) => a.add(b), new Decimal(0));
  const discount = round(q.discountType === 'percent' ? subtotal.mul(q.discount || 0).div(100) : new Decimal(q.discount || 0));
  const net = Decimal.max(0, subtotal.sub(discount));
  const tax = round(net.mul(q.tax || 0).div(100));
  const total = net.add(tax);
  return {
    lineTotals: lineTotals.map(x => x.toFixed(dp)),
    subtotal: subtotal.toFixed(dp),
    discount: discount.toFixed(dp),
    tax: tax.toFixed(dp),
    total: total.toFixed(dp),
  };
}
export function quoteStatus(q: Quote, day = today()) {
  if (q.status === 'accepted' || q.status === 'declined' || q.status === 'superseded') {
    return q.status;
  }
  if (q.expiryDate < day) {
    return 'expired';
  }
  return q.status;
}
export function newQuote(w: Workspace) {
  const issueDate = today(w.business.timezone);
  return {
    id: crypto.randomUUID(),
    clientId: '',
    projectId: '',
    client: blankClient(),
    issueDate,
    expiryDate: addDays(issueDate, 30),
    currency: w.business.currency,
    lines: [{ id: crypto.randomUUID(), description: '', quantity: '1', rate: '0', unit: 'fixed' as const }],
    tax: '0',
    discount: '0',
    discountType: 'amount' as const,
    scope: '',
    notes: '',
    template: w.business.template,
    accent: w.business.accent,
  };
}
export function formatWorkBreakdown(entries: WorkEntry[], currency: string): string {
  if (!entries.length) return '';
  const lines: string[] = ['Work log breakdown:'];
  let total = new Decimal(0);
  for (const entry of entries) {
    const lineTotal = new Decimal(entry.quantity || 0).mul(entry.rate || 0);
    total = total.add(lineTotal);
    const unitLabel = entry.unit === 'hour' ? 'hr' : entry.unit;
    lines.push(
      `${entry.date} - ${entry.description} (${entry.quantity} ${unitLabel} @ ${money(entry.rate, currency)} = ${money(lineTotal.toString(), currency)})`
    );
  }
  lines.push(`Total logged work: ${money(total.toString(), currency)}`);
  return lines.join('\n');
}
export function projectFinancials(project: Project, w: Workspace) {
  const currency = project.currency || w.business.currency;
  const dp = precision(currency);
  const round = (v: Decimal) => v.toDecimalPlaces(dp, Decimal.ROUND_HALF_UP);
  const milestones = project.milestones || [];
  const milestoneSum = milestones.reduce((acc, m) => acc.add(m.amount || 0), new Decimal(0));
  const agreed = project.agreedAmount ? new Decimal(project.agreedAmount) : milestoneSum;
  const projectInvoices = (w.invoices || []).filter(i => i.projectId === project.id);
  const drafts = projectInvoices.filter(i => i.lifecycle === 'draft');
  const issuedInvoices = projectInvoices.filter(i => i.lifecycle === 'issued');
  const drafted = drafts.reduce((acc, i) => acc.add(totals(i).total), new Decimal(0));
  const issued = issuedInvoices.reduce((acc, i) => acc.add(totals(i, w.creditNotes).total), new Decimal(0));
  const projectCredits = (w.creditNotes || []).filter(cn => issuedInvoices.some(i => i.id === cn.invoiceId));
  const credited = projectCredits.reduce((acc, cn) => acc.add(cn.total || 0), new Decimal(0));
  const received = issuedInvoices.flatMap(i => i.payments || [])
    .filter(p => !p.reversed)
    .reduce((acc, p) => acc.add(p.amount || 0), new Decimal(0));
  const netIssued = Decimal.max(0, issued.sub(credited));
  const totalCommitted = netIssued.add(drafted);
  const remainingToBill = Decimal.max(0, agreed.sub(totalCommitted));
  return {
    agreed: round(agreed).toFixed(dp),
    drafted: round(drafted).toFixed(dp),
    issued: round(issued).toFixed(dp),
    credited: round(credited).toFixed(dp),
    received: round(received).toFixed(dp),
    remainingToBill: round(remainingToBill).toFixed(dp),
    currency,
  };
}
export function issueErrors(i:Invoice,b:Business){const errors:string[]=[];const hasBusinessAddress=Boolean(b.address?.trim()||b.addressLine1?.trim()||b.city?.trim()||b.postalCode?.trim());if(!b.name.trim()||!hasBusinessAddress)errors.push('Add your business name and address in Settings.');if(!i.client.name.trim())errors.push('Add a client name.');if(i.lines.some(l=>!l.description.trim()||new Decimal(l.quantity).lte(0)))errors.push('Each line needs a description and a quantity above zero.');if(i.dueDate<i.issueDate)errors.push('Due date must not precede issue date.');const t=totals(i);if(new Decimal(i.discount).lt(0)||(i.discountType==='percent'&&new Decimal(i.discount).gt(100))||new Decimal(t.discount).gt(t.subtotal))errors.push('Discount exceeds the subtotal.');if(new Decimal(i.deposit).gt(t.total))errors.push('Requested deposit exceeds the total.');if(i.instalments.length&&i.instalments.reduce((a,x)=>a.add(x.amount),new Decimal(0)).gt(t.total))errors.push('Instalments exceed the total.');return errors}
export const commandSchema=z.discriminatedUnion('type',[
  z.object({type:z.literal('business'),value:businessSchema}),z.object({type:z.literal('client'),value:clientSchema}),z.object({type:z.literal('project'),value:projectSchema}),z.object({type:z.literal('service'),value:serviceSchema}),z.object({type:z.literal('starter'),value:starterSchema}),z.object({type:z.literal('draft'),value:draftSchema}),
  z.object({type:z.literal('deleteDraft'),id}),
  z.object({type:z.literal('deleteClient'),id}),z.object({type:z.literal('deleteProject'),id}),z.object({type:z.literal('deleteService'),id}),z.object({type:z.literal('deleteStarter'),id}),
  z.object({type:z.literal('dismissOnboarding'),dismissed:z.boolean()}),
  z.object({type:z.literal('issue'),id}),z.object({type:z.literal('duplicate'),id,newId:id}),z.object({type:z.literal('archive'),id,value:z.boolean()}),z.object({type:z.literal('void'),id,reason:z.string().min(1).max(1000)}),z.object({type:z.literal('payment'),id,value:paymentSchema}),z.object({type:z.literal('reverse'),id,paymentId:id}),
  z.object({type:z.literal('creditNote'),invoiceId:id,reason:z.string().min(1).max(1000),lines:z.array(lineSchema).min(1).max(100),tax:amount.refine(v=>new Decimal(v).lte(100)),replacement:z.boolean().default(false)}),
  z.object({type:z.literal('clientPayment'),value:z.object({id,clientId:id,currency:businessSchema.shape.currency,amount,date,method:text,reference:text,notes:text,allocations:z.array(z.object({invoiceId:id,amount}))})}),
  z.object({type:z.literal('allocatePayment'),paymentId:id,allocations:z.array(z.object({invoiceId:id,amount})).min(1)}),
  z.object({type:z.literal('refundPayment'),paymentId:id,refund:z.object({amount,date,reference:text,notes:text})}),
  z.object({type:z.literal('reverseClientPayment'),paymentId:id}),
  z.object({type:z.literal('pauseReminder'),id,pausedUntil:date.optional(),pauseReason:text.optional()}),
  z.object({type:z.literal('updateInternalNotes'),invoiceId:id,notes:text}),
  z.object({type:z.literal('attachment'),invoiceId:id,value:attachmentSchema}),
  z.object({type:z.literal('deleteAttachment'),invoiceId:id,attachmentId:id}),
  z.object({type:z.literal('updateAttachmentVisibility'),invoiceId:id,attachmentId:id,visibility:z.enum(['internal','client'])}),
  z.object({type:z.literal('createQuote'),value:z.object({id,clientId:z.string(),projectId:z.string().optional(),client:clientSchema,issueDate:date,expiryDate:date,currency:businessSchema.shape.currency,lines:z.array(lineSchema).min(1).max(100),tax:amount.refine(v=>new Decimal(v).lte(100)),discount:amount,discountType:z.enum(['amount','percent']),scope:text.optional(),notes:text,template:businessSchema.shape.template,accent:businessSchema.shape.accent})}),
  z.object({type:z.literal('updateQuote'),value:z.object({id,clientId:z.string(),projectId:z.string().optional(),client:clientSchema,issueDate:date,expiryDate:date,currency:businessSchema.shape.currency,lines:z.array(lineSchema).min(1).max(100),tax:amount.refine(v=>new Decimal(v).lte(100)),discount:amount,discountType:z.enum(['amount','percent']),scope:text.optional(),notes:text,template:businessSchema.shape.template,accent:businessSchema.shape.accent})}),
  z.object({type:z.literal('sendQuote'),id}),
  z.object({type:z.literal('reviseQuote'),id,newId:id}),
  z.object({type:z.literal('acceptQuote'),id,acceptance:quoteAcceptanceSchema}),
  z.object({type:z.literal('declineQuote'),id,reason:z.string().min(1).max(1000)}),
  z.object({type:z.literal('convertQuoteToInvoice'),id}),
  z.object({type:z.literal('deleteQuote'),id}),
  z.object({type:z.literal('createWorkEntry'),value:z.object({id:id.optional(),clientId:z.string(),projectId:z.string().optional(),date,description:text,quantity:amount,rate:amount,unit:z.enum(['hour','fixed','unit']).default('hour'),billable:z.boolean().default(true)})}),
  z.object({type:z.literal('updateWorkEntry'),value:z.object({id,clientId:z.string(),projectId:z.string().optional(),date,description:text,quantity:amount,rate:amount,unit:z.enum(['hour','fixed','unit']),billable:z.boolean()})}),
  z.object({type:z.literal('deleteWorkEntry'),id}),
  z.object({type:z.literal('billWorkEntries'),entryIds:z.array(id).min(1),draftId:id.optional()}),
  z.object({type:z.literal('releaseWorkEntries'),draftId:id}),
  z.object({type:z.literal('createMilestone'),value:z.object({id:id.optional(),projectId:z.string(),title:text,description:text.optional(),amount,order:z.number().int().min(1),isDeposit:z.boolean().default(false)})}),
  z.object({type:z.literal('updateMilestone'),value:z.object({id,projectId:z.string(),title:text,description:text.optional(),amount,order:z.number().int().min(1),isDeposit:z.boolean()})}),
  z.object({type:z.literal('deleteMilestone'),id}),
  z.object({type:z.literal('billMilestone'),milestoneId:id,draftId:id.optional()}),
  z.object({type:z.literal('releaseMilestone'),draftId:id}),
  z.object({type:z.literal('share'),id,expires:date}),z.object({type:z.literal('revoke'),id}),z.object({type:z.literal('schedule'),value:scheduleSchema}),z.object({type:z.literal('deleteSchedule'),id}),z.object({type:z.literal('reminder'),id,enabled:z.boolean(),days:z.number().int().min(1).max(90)}),z.object({type:z.literal('message'),value:messageSchema}),z.object({type:z.literal('send'),id}),
  z.object({type:z.literal('sharePortal'),clientId:id,expires:date,allowedInvoiceIds:z.array(id).optional(),allowStatements:z.boolean().optional(),allowAttachments:z.boolean().optional()}),
  z.object({type:z.literal('revokePortal'),clientId:id}),
  z.object({type:z.literal('recordClientPaymentNotice'),clientId:id,token:z.string(),notice:z.object({id:id.optional(),date,amount:amount.optional(),reference:text.optional(),notes:text.optional()})}),
  z.object({type:z.literal('dismissPaymentNotice'),clientId:id,noticeId:z.string()}),
  z.object({type:z.literal('createBusinessProfile'),value:z.object({id:id.optional(),name:text,business:businessSchema.optional(),switchImmediately:z.boolean().default(false)})}),
  z.object({type:z.literal('switchBusinessProfile'),profileId:id}),
  z.object({type:z.literal('updateBusinessProfile'),profileId:id,name:text.optional(),isDefault:z.boolean().optional()}),
  z.object({type:z.literal('deleteBusinessProfile'),profileId:id}),
])
export type Command=z.infer<typeof commandSchema>
function upsert<T extends {id:string}>(list:T[],item:T){const n=list.findIndex(x=>x.id===item.id);if(n<0)list.unshift(item);else list[n]=item}
export function applyCommand(source:Workspace,raw:Command,now=new Date()):Workspace{const c=commandSchema.parse(raw);const w=structuredClone(source);w.starters = w.starters || [];w.creditNotes = w.creditNotes || [];w.payments = w.payments || [];w.receipts = w.receipts || [];w.quotes = w.quotes || [];w.workEntries = w.workEntries || [];ensureProfiles(w);const stamp=now.toISOString();const find=(key:string)=>{const i=w.invoices.find(i=>i.id===key);if(!i)throw new Error('Invoice not found');return i};
  switch(c.type){
  case 'business':w.business=c.value;break;
  case 'client':if(!c.value.name.trim())throw new Error('Client name is required');upsert(w.clients,c.value);break;
  case 'project':if(!c.value.name.trim())throw new Error('Project name is required');if(c.value.clientId&&!w.clients.some(x=>x.id===c.value.clientId))throw new Error('Client not found');upsert(w.projects,c.value);break;
  case 'service':if(!c.value.name.trim())throw new Error('Service name is required');upsert(w.services,c.value);break;
  case 'starter':if(!c.value.name.trim())throw new Error('Starter name is required');upsert(w.starters,c.value);break;
  case 'deleteDraft':{
    const i=find(c.id);
    if(i.lifecycle!=='draft')throw new Error('Only unissued draft invoices can be deleted. Use void for issued invoices.');
    for(const e of (w.workEntries||[])){
      if(e.reservedDraftId===c.id&&e.status==='reserved'){
        e.status='unbilled';
        e.reservedDraftId=undefined;
        e.updated=stamp;
      }
    }
    for(const p of w.projects){
      for(const m of p.milestones||[]){
        if(m.reservedDraftId===c.id&&m.status==='reserved'){
          m.status='pending';
          m.reservedDraftId=undefined;
          m.updated=stamp;
        }
      }
    }
    w.messages=(w.messages||[]).filter(m=>m.invoiceId!==c.id);
    w.schedules=(w.schedules||[]).filter(s=>s.invoiceId!==c.id);
    w.invoices=w.invoices.filter(x=>x.id!==c.id);
    break;
  }
  case 'deleteClient':{
    w.clients=w.clients.filter(x=>x.id!==c.id);
    w.projects=w.projects.map(p=>p.clientId===c.id?{...p,clientId:''}:p);
    w.workEntries=(w.workEntries||[]).filter(e=>e.clientId!==c.id||e.status==='billed');
    w.quotes=(w.quotes||[]).filter(q=>q.clientId!==c.id||q.status==='accepted');
    break;
  }
  case 'deleteProject':{
    w.projects=w.projects.filter(x=>x.id!==c.id);
    for(const e of (w.workEntries||[])){if(e.projectId===c.id){e.projectId=undefined;e.updated=stamp}}
    for(const q of (w.quotes||[])){if(q.projectId===c.id){q.projectId=undefined;q.updated=stamp}}
    break;
  }
  case 'deleteService':w.services=w.services.filter(x=>x.id!==c.id);break;
  case 'deleteStarter':w.starters=w.starters.filter(x=>x.id!==c.id);break;
  case 'dismissOnboarding':w.business.onboardingDismissed=c.dismissed;break;
  case 'draft':{const old=w.invoices.find(i=>i.id===c.value.id);if(old&&old.lifecycle!=='draft')throw new Error('Issued invoices cannot be edited. Duplicate or void it.');if(c.value.clientId&&!w.clients.some(x=>x.id===c.value.clientId))throw new Error('Client not found');if(c.value.projectId&&!w.projects.some(x=>x.id===c.value.projectId))throw new Error('Project not found');upsert(w.invoices,{...(old??newInvoice(w)),...c.value,updated:stamp});break}
  case 'issue':{const i=find(c.id);if(i.lifecycle!=='draft')throw new Error('Only drafts can be issued');const errors=issueErrors(i,w.business);if(errors.length)throw new Error(errors.join(' '));const series=w.business.prefix+'-'+i.issueDate.slice(0,4);const number=(w.sequence[series]??0)+1;w.sequence[series]=number;i.number=series+'-'+String(number).padStart(4,'0');i.lifecycle='issued';i.issuedAt=stamp;i.business=structuredClone(w.business);const reservedWorkIds=new Set([...(i.reservedWorkEntryIds||[]),...(w.workEntries||[]).filter(e=>e.reservedDraftId===i.id).map(e=>e.id)]);for(const e of (w.workEntries||[])){if(reservedWorkIds.has(e.id)){e.status='billed';e.billedInvoiceId=i.id;e.billedAt=stamp;e.reservedDraftId=undefined;e.updated=stamp}}for(const p of w.projects){for(const m of p.milestones||[]){if(m.reservedDraftId===i.id||(i.reservedMilestoneId&&m.id===i.reservedMilestoneId)){m.status='billed';m.billedInvoiceId=i.id;m.billedAt=stamp;m.reservedDraftId=undefined;m.updated=stamp}}}i.updated=stamp;break}
  case 'duplicate':{const old=find(c.id);if(w.invoices.some(x=>x.id===c.newId))throw new Error('Duplicate already exists');const fresh=newInvoice(w);const issueDate=fresh.issueDate;const dueDate=addDays(issueDate,old.terms);w.invoices.unshift({...fresh,id:c.newId,number:'',lifecycle:'draft',archived:false,business:null,clientId:old.clientId,projectId:old.projectId,client:structuredClone(old.client),issueDate,dueDate,terms:old.terms,manualDue:old.manualDue,currency:old.currency,lines:structuredClone(old.lines),tax:old.tax,discount:old.discount,discountType:old.discountType,deposit:old.deposit,instalments:structuredClone(old.instalments),notes:old.notes,internalNotes:old.internalNotes,attachments:structuredClone(old.attachments),po:old.po,reference:old.reference,breakdown:old.breakdown,template:old.template,accent:old.accent,payments:[],creditNoteIds:[],share:undefined,issuedAt:undefined,voidReason:undefined,created:stamp,updated:stamp,reminder:{enabled:false,days:7,lastDate:''}});break}
  case 'archive':find(c.id).archived=c.value;break;
  case 'void':{const i=find(c.id);if(i.lifecycle!=='issued')throw new Error('Only issued invoices can be voided');if(new Decimal(totals(i,w.creditNotes).paid).gt(0))throw new Error('Reverse recorded payments before voiding');i.lifecycle='void';i.voidReason=c.reason;i.share=undefined;i.reminder.enabled=false;break}
  case 'payment':{const i=find(c.id);if(i.lifecycle!=='issued')throw new Error('Issue the invoice before recording payment');if(i.payments.some(p=>p.id===c.value.id))throw new Error('Payment already recorded');const dp=precision(i.currency);const currentTotals=totals(i,w.creditNotes);if(new Decimal(c.value.amount).lte(0)||new Decimal(c.value.amount).gt(currentTotals.balance)||new Decimal(c.value.amount).decimalPlaces()>dp)throw new Error('Enter a payment above zero, no greater than the outstanding balance, using the currency precision');i.payments.push({...c.value,reversed:false});w.payments.unshift({id:c.value.id,clientId:i.clientId,currency:i.currency,amount:new Decimal(c.value.amount).toFixed(dp),date:c.value.date,method:c.value.method,reference:c.value.reference,notes:c.value.notes,allocations:[{id:crypto.randomUUID(),invoiceId:i.id,amount:new Decimal(c.value.amount).toFixed(dp),created:stamp,reversed:false}],unallocated:new Decimal(0).toFixed(dp),refunds:[],reversed:false,created:stamp,updated:stamp});const year=stamp.slice(0,4);const rctPrefix=w.business.prefix?`${w.business.prefix}-RCT-${year}`:`RCT-${year}`;const rctSeq=(w.sequence[rctPrefix]??0)+1;w.sequence[rctPrefix]=rctSeq;const rctNumber=`${rctPrefix}-${String(rctSeq).padStart(4,'0')}`;const balAfter=Decimal.max(0,new Decimal(currentTotals.balance).sub(c.value.amount));w.receipts.unshift({id:crypto.randomUUID(),number:rctNumber,paymentId:c.value.id,clientId:i.clientId,client:structuredClone(i.client),business:structuredClone(i.business??w.business),date:c.value.date,currency:i.currency,amount:new Decimal(c.value.amount).toFixed(dp),method:c.value.method,reference:c.value.reference,notes:c.value.notes,allocations:[{invoiceId:i.id,invoiceNumber:i.number||'Invoice',amount:new Decimal(c.value.amount).toFixed(dp),balanceRemaining:balAfter.toFixed(dp)}],unallocated:'0.00',reversed:false,created:stamp});break}
  case 'reverse':{const p=find(c.id).payments.find(p=>p.id===c.paymentId);if(!p)throw new Error('Payment not found');if(p.reversed)throw new Error('Payment is already reversed');p.reversed=true;const cp=w.payments.find(x=>x.id===c.paymentId);if(cp){cp.reversed=true;cp.allocations.forEach(a=>{a.reversed=true});cp.unallocated='0.00'}const r=w.receipts.find(x=>x.paymentId===c.paymentId);if(r){r.reversed=true;r.reversedAt=stamp}break}
  case 'creditNote':{const inv=find(c.invoiceId);if(inv.lifecycle!=='issued')throw new Error('Only issued invoices can be credited');const dp=precision(inv.currency);const round=(v:Decimal)=>v.toDecimalPlaces(dp,Decimal.ROUND_HALF_UP);const currentTotals=totals(inv,w.creditNotes);const currentEligible=new Decimal(currentTotals.adjustedTotal);if(currentEligible.lte(0))throw new Error('This invoice is already fully credited');const lineTotals=c.lines.map(l=>round(new Decimal(l.quantity||0).mul(l.rate||0)));const subtotal=lineTotals.reduce((a,b)=>a.add(b),new Decimal(0));const taxAmount=round(subtotal.mul(c.tax||0).div(100));const creditTotal=subtotal.add(taxAmount);if(creditTotal.lte(0))throw new Error('Credit amount must be greater than zero');if(creditTotal.gt(currentEligible))throw new Error(`Credit amount exceeds remaining eligible invoice balance (${currentEligible.toFixed(dp)})`);const year=stamp.slice(0,4);const prefix=w.business.prefix?`${w.business.prefix}-CR-${year}`:`CR-${year}`;const seq=(w.sequence[prefix]??0)+1;w.sequence[prefix]=seq;const creditNumber=`${prefix}-${String(seq).padStart(4,'0')}`;let replacementDraftId:string|undefined=undefined;if(c.replacement){const fresh=newInvoice(w);fresh.clientId=inv.clientId;fresh.client=structuredClone(inv.client);fresh.projectId=inv.projectId;fresh.currency=inv.currency;fresh.terms=inv.terms;fresh.dueDate=addDays(fresh.issueDate,inv.terms);fresh.lines=inv.lines.map(l=>({...structuredClone(l),id:crypto.randomUUID()}));fresh.tax=inv.tax;fresh.discount=inv.discount;fresh.discountType=inv.discountType;fresh.notes=inv.notes;fresh.internalNotes=inv.internalNotes;fresh.template=inv.template;fresh.accent=inv.accent;fresh.replacementOf=inv.id;fresh.created=stamp;fresh.updated=stamp;replacementDraftId=fresh.id;w.invoices.unshift(fresh);inv.replacementDraftId=fresh.id}const note:CreditNote={id:crypto.randomUUID(),number:creditNumber,invoiceId:inv.id,invoiceNumber:inv.number||'Invoice',clientId:inv.clientId,client:structuredClone(inv.client),business:structuredClone(inv.business??w.business),issueDate:today(w.business.timezone,now),reason:c.reason,currency:inv.currency,lines:c.lines,subtotal:subtotal.toFixed(dp),tax:c.tax,taxAmount:taxAmount.toFixed(dp),total:creditTotal.toFixed(dp),replacementDraftId,created:stamp,issuedAt:stamp};w.creditNotes.unshift(note);inv.creditNoteIds=inv.creditNoteIds||[];inv.creditNoteIds.push(note.id);const updatedTotals=totals(inv,w.creditNotes);const excessPaid=new Decimal(updatedTotals.overpayment);if(excessPaid.gt(0)){let remainingExcess=excessPaid;for(const cp of w.payments){if(remainingExcess.lte(0))break;if(cp.clientId!==inv.clientId||cp.currency!==inv.currency||cp.reversed)continue;const alloc=cp.allocations.find(a=>a.invoiceId===inv.id&&!a.reversed);if(alloc){const allocAmount=new Decimal(alloc.amount);const deduct=Decimal.min(allocAmount,remainingExcess);alloc.amount=allocAmount.sub(deduct).toFixed(dp);cp.unallocated=new Decimal(cp.unallocated).add(deduct).toFixed(dp);remainingExcess=remainingExcess.sub(deduct)}}let remainingReduction=excessPaid;for(let idx=inv.payments.length-1;idx>=0;idx--){if(remainingReduction.lte(0))break;const p=inv.payments[idx];if(p.reversed)continue;const pAmt=new Decimal(p.amount);const red=Decimal.min(pAmt,remainingReduction);p.amount=pAmt.sub(red).toFixed(dp);remainingReduction=remainingReduction.sub(red);if(new Decimal(p.amount).eq(0)){inv.payments.splice(idx,1)}}}inv.updated=stamp;break}
  case 'clientPayment':{const client=w.clients.find(x=>x.id===c.value.clientId);if(!client)throw new Error('Client not found');const dp=precision(c.value.currency);const totalAmount=new Decimal(c.value.amount);if(totalAmount.lte(0))throw new Error('Payment amount must be greater than zero');let allocatedSum=new Decimal(0);const builtAllocations:PaymentAllocation[]=[];for(const al of c.value.allocations){const targetInv=w.invoices.find(x=>x.id===al.invoiceId);if(!targetInv)throw new Error(`Invoice not found for allocation (${al.invoiceId})`);if(targetInv.clientId!==c.value.clientId)throw new Error('Cross-client allocation is rejected');if(targetInv.currency!==c.value.currency)throw new Error('Cross-currency allocation is rejected');if(targetInv.lifecycle!=='issued')throw new Error('Allocations can only be made to issued invoices');const allocAmount=new Decimal(al.amount);if(allocAmount.lte(0))throw new Error('Allocation amount must be greater than zero');const invBal=new Decimal(totals(targetInv,w.creditNotes).balance);if(allocAmount.gt(invBal))throw new Error(`Allocation of ${allocAmount.toFixed(dp)} exceeds invoice ${targetInv.number||'draft'} balance of ${invBal.toFixed(dp)}`);allocatedSum=allocatedSum.add(allocAmount);builtAllocations.push({id:crypto.randomUUID(),invoiceId:al.invoiceId,amount:allocAmount.toFixed(dp),created:stamp,reversed:false});targetInv.payments.push({id:crypto.randomUUID(),amount:allocAmount.toFixed(dp),date:c.value.date,method:c.value.method,reference:c.value.reference,notes:c.value.notes,reversed:false});targetInv.updated=stamp}if(allocatedSum.gt(totalAmount))throw new Error(`Allocations sum (${allocatedSum.toFixed(dp)}) exceeds payment amount (${totalAmount.toFixed(dp)})`);const unallocated=totalAmount.sub(allocatedSum).toFixed(dp);const cp:ClientPayment={id:c.value.id,clientId:c.value.clientId,currency:c.value.currency,amount:totalAmount.toFixed(dp),date:c.value.date,method:c.value.method,reference:c.value.reference,notes:c.value.notes,allocations:builtAllocations,unallocated,refunds:[],reversed:false,created:stamp,updated:stamp};w.payments.unshift(cp);const year=stamp.slice(0,4);const rctPrefix=w.business.prefix?`${w.business.prefix}-RCT-${year}`:`RCT-${year}`;const rctSeq=(w.sequence[rctPrefix]??0)+1;w.sequence[rctPrefix]=rctSeq;const rctNumber=`${rctPrefix}-${String(rctSeq).padStart(4,'0')}`;const rctAllocations=c.value.allocations.map(al=>{const inv=w.invoices.find(x=>x.id===al.invoiceId)!;const remainingBal=totals(inv,w.creditNotes).balance;return {invoiceId:al.invoiceId,invoiceNumber:inv.number||'Invoice',amount:new Decimal(al.amount).toFixed(dp),balanceRemaining:remainingBal}});w.receipts.unshift({id:crypto.randomUUID(),number:rctNumber,paymentId:c.value.id,clientId:client.id,client:structuredClone(client),business:structuredClone(w.business),date:c.value.date,currency:c.value.currency,amount:totalAmount.toFixed(dp),method:c.value.method,reference:c.value.reference,notes:c.value.notes,allocations:rctAllocations,unallocated,reversed:false,created:stamp});break}
  case 'allocatePayment':{const cp=w.payments.find(p=>p.id===c.paymentId);if(!cp)throw new Error('Payment not found');if(cp.reversed)throw new Error('Cannot allocate a reversed payment');const dp=precision(cp.currency);const available=new Decimal(cp.unallocated);let requestedSum=new Decimal(0);for(const al of c.allocations){const targetInv=w.invoices.find(x=>x.id===al.invoiceId);if(!targetInv)throw new Error(`Invoice not found (${al.invoiceId})`);if(targetInv.clientId!==cp.clientId)throw new Error('Cross-client allocation is rejected');if(targetInv.currency!==cp.currency)throw new Error('Cross-currency allocation is rejected');if(targetInv.lifecycle!=='issued')throw new Error('Allocations can only be made to issued invoices');const allocAmount=new Decimal(al.amount);if(allocAmount.lte(0))throw new Error('Allocation amount must be greater than zero');const invBal=new Decimal(totals(targetInv,w.creditNotes).balance);if(allocAmount.gt(invBal))throw new Error(`Allocation of ${allocAmount.toFixed(dp)} exceeds invoice balance of ${invBal.toFixed(dp)}`);requestedSum=requestedSum.add(allocAmount);cp.allocations.push({id:crypto.randomUUID(),invoiceId:al.invoiceId,amount:allocAmount.toFixed(dp),created:stamp,reversed:false});targetInv.payments.push({id:crypto.randomUUID(),amount:allocAmount.toFixed(dp),date:cp.date,method:cp.method,reference:cp.reference,notes:cp.notes,reversed:false});targetInv.updated=stamp}if(requestedSum.gt(available))throw new Error(`Allocations sum (${requestedSum.toFixed(dp)}) exceeds available unallocated credit (${available.toFixed(dp)})`);cp.unallocated=available.sub(requestedSum).toFixed(dp);cp.updated=stamp;break}
  case 'refundPayment':{const cp=w.payments.find(p=>p.id===c.paymentId);if(!cp)throw new Error('Payment not found');if(cp.reversed)throw new Error('Cannot refund a reversed payment');const dp=precision(cp.currency);const available=new Decimal(cp.unallocated);const refundAmt=new Decimal(c.refund.amount);if(refundAmt.lte(0))throw new Error('Refund amount must be greater than zero');if(refundAmt.gt(available))throw new Error(`Refund amount (${refundAmt.toFixed(dp)}) exceeds available unallocated credit (${available.toFixed(dp)})`);cp.unallocated=available.sub(refundAmt).toFixed(dp);cp.refunds.push({id:crypto.randomUUID(),amount:refundAmt.toFixed(dp),date:c.refund.date,reference:c.refund.reference,notes:c.refund.notes,created:stamp});cp.updated=stamp;break}
  case 'reverseClientPayment':{const cp=w.payments.find(p=>p.id===c.paymentId);if(!cp)throw new Error('Payment not found');if(cp.reversed)throw new Error('Payment is already reversed');for(const al of cp.allocations){if(al.reversed)continue;al.reversed=true;const targetInv=w.invoices.find(x=>x.id===al.invoiceId);if(targetInv){const p=targetInv.payments.find(x=>!x.reversed&&x.amount===al.amount);if(p)p.reversed=true;targetInv.updated=stamp}}cp.unallocated='0.00';cp.reversed=true;cp.updated=stamp;const r=w.receipts.find(x=>x.paymentId===c.paymentId);if(r){r.reversed=true;r.reversedAt=stamp}break}
  case 'pauseReminder':{const i=find(c.id);if(i.lifecycle!=='issued')throw new Error('Only issued invoices have reminders');i.reminder.pausedUntil=c.pausedUntil;i.reminder.pauseReason=c.pauseReason;i.updated=stamp;break}
  case 'updateInternalNotes':{const i=find(c.invoiceId);i.internalNotes=c.notes;i.updated=stamp;break}
  case 'attachment':{const i=find(c.invoiceId);i.attachments=i.attachments||[];upsert(i.attachments,c.value);i.updated=stamp;break}
  case 'deleteAttachment':{const i=find(c.invoiceId);i.attachments=(i.attachments||[]).filter(a=>a.id!==c.attachmentId);i.updated=stamp;break}
  case 'updateAttachmentVisibility':{const i=find(c.invoiceId);const a=(i.attachments||[]).find(x=>x.id===c.attachmentId);if(!a)throw new Error('Attachment not found');a.visibility=c.visibility;i.updated=stamp;break}
  case 'share':{const i=find(c.id);if(i.lifecycle!=='issued')throw new Error('Only issued invoices can be shared');if(c.expires<today(w.business.timezone,now))throw new Error('Expiry must be in the future');i.share={token:crypto.randomUUID()+crypto.randomUUID(),expires:c.expires};break}
  case 'revoke':find(c.id).share=undefined;break;
  case 'schedule':find(c.value.invoiceId);upsert(w.schedules,c.value);break;
  case 'deleteSchedule':w.schedules=w.schedules.filter(s=>s.id!==c.id);break;
  case 'reminder':{const i=find(c.id);if(i.lifecycle!=='issued')throw new Error('Issue the invoice first');i.reminder={...i.reminder,enabled:c.enabled,days:c.days};break}
  case 'message':{const i=find(c.value.invoiceId);if(i.lifecycle!=='issued')throw new Error('Issue the invoice before preparing email');const old=w.messages.find(m=>m.id===c.value.id);if(old&&old.status!=='draft')throw new Error('This email is already queued or sent');upsert(w.messages,{...c.value,status:'draft',created:stamp,providerId:undefined,attempted:undefined,error:undefined});break}
  case 'createQuote':{
    if(!c.value.client.name.trim())throw new Error('Client name is required');
    const year=stamp.slice(0,4);
    const prefix=w.business.prefix?`${w.business.prefix}-QT-${year}`:`QT-${year}`;
    const seq=(w.sequence[prefix]??0)+1;
    w.sequence[prefix]=seq;
    const quoteNumber=`${prefix}-${String(seq).padStart(4,'0')}`;
    const q:Quote={
      id:c.value.id,
      quoteNumber,
      revision:1,
      status:'draft',
      clientId:c.value.clientId,
      projectId:c.value.projectId,
      client:structuredClone(c.value.client),
      issueDate:c.value.issueDate,
      expiryDate:c.value.expiryDate,
      currency:c.value.currency,
      lines:structuredClone(c.value.lines),
      tax:c.value.tax,
      discount:c.value.discount,
      discountType:c.value.discountType,
      scope:c.value.scope,
      notes:c.value.notes,
      template:c.value.template,
      accent:c.value.accent,
      created:stamp,
      updated:stamp,
    };
    w.quotes.unshift(q);
    break;
  }
  case 'updateQuote':{
    const q=w.quotes.find(x=>x.id===c.value.id);
    if(!q)throw new Error('Quote not found');
    if(q.status!=='draft')throw new Error('Only draft quotes can be edited. Revise the quote instead.');
    if(!c.value.client.name.trim())throw new Error('Client name is required');
    q.clientId=c.value.clientId;
    q.projectId=c.value.projectId;
    q.client=structuredClone(c.value.client);
    q.issueDate=c.value.issueDate;
    q.expiryDate=c.value.expiryDate;
    q.currency=c.value.currency;
    q.lines=structuredClone(c.value.lines);
    q.tax=c.value.tax;
    q.discount=c.value.discount;
    q.discountType=c.value.discountType;
    q.scope=c.value.scope;
    q.notes=c.value.notes;
    q.template=c.value.template;
    q.accent=c.value.accent;
    q.updated=stamp;
    break;
  }
  case 'sendQuote':{
    const q=w.quotes.find(x=>x.id===c.id);
    if(!q)throw new Error('Quote not found');
    if(q.status!=='draft')throw new Error('Only draft quotes can be sent');
    q.status='sent';
    q.updated=stamp;
    break;
  }
  case 'reviseQuote':{
    const q=w.quotes.find(x=>x.id===c.id);
    if(!q)throw new Error('Quote not found');
    if(q.status==='superseded')throw new Error('This quote revision is already superseded');
    if(w.quotes.some(x=>x.id===c.newId))throw new Error('Duplicate quote ID');
    q.status='superseded';
    q.supersededBy=c.newId;
    q.supersededAt=stamp;
    q.updated=stamp;
    const rev:Quote={
      ...structuredClone(q),
      id:c.newId,
      revision:q.revision+1,
      status:'draft',
      acceptance:undefined,
      declinedReason:undefined,
      convertedInvoiceId:undefined,
      supersededBy:undefined,
      supersededAt:undefined,
      lines:q.lines.map(l=>({...structuredClone(l),id:crypto.randomUUID()})),
      created:stamp,
      updated:stamp,
    };
    w.quotes.unshift(rev);
    break;
  }
  case 'acceptQuote':{
    const q=w.quotes.find(x=>x.id===c.id);
    if(!q)throw new Error('Quote not found');
    if(q.status==='accepted')throw new Error('Quote is already accepted');
    if(q.status==='superseded')throw new Error('Cannot accept a superseded quote revision');
    q.status='accepted';
    q.acceptance=c.acceptance;
    q.updated=stamp;
    break;
  }
  case 'declineQuote':{
    const q=w.quotes.find(x=>x.id===c.id);
    if(!q)throw new Error('Quote not found');
    if(q.status==='accepted')throw new Error('Cannot decline an accepted quote');
    if(q.status==='superseded')throw new Error('Cannot decline a superseded quote revision');
    q.status='declined';
    q.declinedReason=c.reason;
    q.updated=stamp;
    break;
  }
  case 'convertQuoteToInvoice':{
    const q=w.quotes.find(x=>x.id===c.id);
    if(!q)throw new Error('Quote not found');
    if(q.status!=='accepted')throw new Error('Only accepted quotes can be converted to invoices');
    if(q.convertedInvoiceId&&w.invoices.some(i=>i.id===q.convertedInvoiceId)){
      break;
    }
    const existing=w.invoices.find(i=>i.convertedFromQuoteId===q.id);
    if(existing){
      q.convertedInvoiceId=existing.id;
      break;
    }
    const inv=newInvoice(w);
    inv.clientId=q.clientId;
    inv.client=structuredClone(q.client);
    inv.projectId=q.projectId||'';
    inv.currency=q.currency;
    inv.lines=q.lines.map(l=>({...structuredClone(l),id:crypto.randomUUID()}));
    inv.tax=q.tax;
    inv.discount=q.discount;
    inv.discountType=q.discountType;
    inv.notes=q.notes;
    inv.breakdown=q.scope||'';
    inv.template=q.template;
    inv.accent=q.accent;
    inv.convertedFromQuoteId=q.id;
    inv.convertedFromQuoteNumber=`${q.quoteNumber} (Rev ${q.revision})`;
    inv.created=stamp;
    inv.updated=stamp;
    w.invoices.unshift(inv);
    q.convertedInvoiceId=inv.id;
    q.updated=stamp;
    break;
  }
  case 'deleteQuote':{
    const q=w.quotes.find(x=>x.id===c.id);
    if(!q)throw new Error('Quote not found');
    if(q.convertedInvoiceId)throw new Error('Converted quotes cannot be deleted');
    if(q.status==='accepted')throw new Error('Accepted quotes cannot be deleted');
    w.quotes=w.quotes.filter(x=>x.id!==c.id);
    break;
  }
  case 'createWorkEntry':{
    if(!w.clients.some(x=>x.id===c.value.clientId))throw new Error('Client not found');
    if(c.value.projectId&&!w.projects.some(x=>x.id===c.value.projectId))throw new Error('Project not found');
    w.workEntries = w.workEntries || [];
    const entryId=c.value.id||crypto.randomUUID();
    if(w.workEntries.some(x=>x.id===entryId))throw new Error('Work entry already exists');
    const entry:WorkEntry={
      id:entryId,
      clientId:c.value.clientId,
      projectId:c.value.projectId,
      date:c.value.date,
      description:c.value.description,
      quantity:c.value.quantity,
      rate:c.value.rate,
      unit:c.value.unit,
      billable:c.value.billable,
      status:'unbilled',
      created:stamp,
      updated:stamp,
    };
    w.workEntries.unshift(entry);
    break;
  }
  case 'updateWorkEntry':{
    const allEntries = w.workEntries || [];
    const entry=allEntries.find(x=>x.id===c.value.id);
    if(!entry)throw new Error('Work entry not found');
    if(entry.status==='billed')throw new Error('Billed work entries cannot be edited');
    if(entry.status==='reserved')throw new Error('Reserved work entries cannot be edited while in a draft invoice');
    if(!w.clients.some(x=>x.id===c.value.clientId))throw new Error('Client not found');
    if(c.value.projectId&&!w.projects.some(x=>x.id===c.value.projectId))throw new Error('Project not found');
    entry.clientId=c.value.clientId;
    entry.projectId=c.value.projectId;
    entry.date=c.value.date;
    entry.description=c.value.description;
    entry.quantity=c.value.quantity;
    entry.rate=c.value.rate;
    entry.unit=c.value.unit;
    entry.billable=c.value.billable;
    entry.updated=stamp;
    break;
  }
  case 'deleteWorkEntry':{
    const allEntries = w.workEntries || [];
    const entry=allEntries.find(x=>x.id===c.id);
    if(!entry)throw new Error('Work entry not found');
    if(entry.status==='billed')throw new Error('Billed work entries cannot be deleted');
    if(entry.status==='reserved')throw new Error('Reserved work entries cannot be deleted while in a draft invoice');
    w.workEntries=allEntries.filter(x=>x.id!==c.id);
    break;
  }
  case 'billWorkEntries':{
    const allEntries = w.workEntries || [];
    const selected=c.entryIds.map(eid=>{
      const entry=allEntries.find(e=>e.id===eid);
      if(!entry)throw new Error(`Work entry not found (${eid})`);
      return entry;
    });
    for(const e of selected){
      if(e.status!=='unbilled'){
        throw new Error(`Cannot bill work entry "${e.description}": entry is already ${e.status}`);
      }
      if(!e.billable){
        throw new Error(`Cannot bill non-billable work entry "${e.description}"`);
      }
    }
    const clientIds=new Set(selected.map(e=>e.clientId));
    if(clientIds.size>1){
      throw new Error('All billed work entries must belong to the same client');
    }
    const clientId=selected[0].clientId;
    const client=w.clients.find(x=>x.id===clientId);
    if(!client)throw new Error('Client not found');
    const projectIds=new Set(selected.map(e=>e.projectId).filter(Boolean));
    const commonProjectId=projectIds.size===1?Array.from(projectIds)[0]:'';
    let draft:Invoice;
    if(c.draftId){
      draft=find(c.draftId);
      if(draft.lifecycle!=='draft')throw new Error('Only draft invoices can receive billed work entries');
    }else{
      draft=newInvoice(w);
      draft.clientId=client.id;
      draft.client=structuredClone(client);
      if(client.currency)draft.currency=client.currency;
      if(client.terms!==undefined)draft.terms=client.terms;
      draft.dueDate=addDays(draft.issueDate,draft.terms);
      if(commonProjectId)draft.projectId=commonProjectId;
      draft.lines=[];
      w.invoices.unshift(draft);
    }
    const newLines:Line[]=selected.map(e=>{
      const proj=e.projectId?w.projects.find(p=>p.id===e.projectId):undefined;
      return {
        id:crypto.randomUUID(),
        description:e.description,
        quantity:e.quantity,
        rate:e.rate,
        unit:e.unit,
        group:proj?.name,
      };
    });
    if(c.draftId&&draft.lines.length>0&&draft.lines[0].description!==''){
      draft.lines.push(...newLines);
    }else{
      draft.lines=newLines;
    }
    draft.reservedWorkEntryIds=Array.from(new Set([...(draft.reservedWorkEntryIds||[]),...selected.map(e=>e.id)]));
    const existingBreakdown=draft.breakdown?draft.breakdown+'\n\n':'';
    draft.breakdown=existingBreakdown+formatWorkBreakdown(selected,draft.currency);
    for(const e of selected){
      e.status='reserved';
      e.reservedDraftId=draft.id;
      e.updated=stamp;
    }
    draft.updated=stamp;
    break;
  }
  case 'releaseWorkEntries':{
    for(const e of (w.workEntries||[])){
      if(e.reservedDraftId===c.draftId&&e.status==='reserved'){
        e.status='unbilled';
        e.reservedDraftId=undefined;
        e.updated=stamp;
      }
    }
    const d=w.invoices.find(i=>i.id===c.draftId);
    if(d){
      d.reservedWorkEntryIds=undefined;
      d.updated=stamp;
    }
    break;
  }
  case 'createMilestone':{
    const proj=w.projects.find(p=>p.id===c.value.projectId);
    if(!proj)throw new Error('Project not found');
    proj.milestones=proj.milestones||[];
    const milestoneId=c.value.id||crypto.randomUUID();
    if(proj.milestones.some(m=>m.id===milestoneId))throw new Error('Milestone already exists');
    const m:Milestone={
      id:milestoneId,
      projectId:c.value.projectId,
      title:c.value.title,
      description:c.value.description,
      amount:c.value.amount,
      order:c.value.order,
      status:'pending',
      isDeposit:c.value.isDeposit,
      created:stamp,
      updated:stamp,
    };
    proj.milestones.push(m);
    proj.milestones.sort((a,b)=>a.order-b.order);
    break;
  }
  case 'updateMilestone':{
    let targetMilestone:Milestone|undefined;
    let targetProject:Project|undefined;
    for(const p of w.projects){
      const found=(p.milestones||[]).find(m=>m.id===c.value.id);
      if(found){
        targetMilestone=found;
        targetProject=p;
        break;
      }
    }
    if(!targetMilestone||!targetProject)throw new Error('Milestone not found');
    if(targetMilestone.status==='billed')throw new Error('Billed milestones cannot be edited');
    if(targetMilestone.status==='reserved')throw new Error('Reserved milestones cannot be edited while in a draft invoice');
    targetMilestone.title=c.value.title;
    targetMilestone.description=c.value.description;
    targetMilestone.amount=c.value.amount;
    targetMilestone.order=c.value.order;
    targetMilestone.isDeposit=c.value.isDeposit;
    targetMilestone.updated=stamp;
    targetProject.milestones=(targetProject.milestones||[]).sort((a,b)=>a.order-b.order);
    break;
  }
  case 'deleteMilestone':{
    let targetMilestone:Milestone|undefined;
    let targetProject:Project|undefined;
    for(const p of w.projects){
      const found=(p.milestones||[]).find(m=>m.id===c.id);
      if(found){
        targetMilestone=found;
        targetProject=p;
        break;
      }
    }
    if(!targetMilestone||!targetProject)throw new Error('Milestone not found');
    if(targetMilestone.status==='billed')throw new Error('Billed milestones cannot be deleted');
    if(targetMilestone.status==='reserved')throw new Error('Reserved milestones cannot be deleted while in a draft invoice');
    targetProject.milestones=(targetProject.milestones||[]).filter(m=>m.id!==c.id);
    break;
  }
  case 'billMilestone':{
    let targetMilestone:Milestone|undefined;
    let targetProject:Project|undefined;
    for(const p of w.projects){
      const found=(p.milestones||[]).find(m=>m.id===c.milestoneId);
      if(found){
        targetMilestone=found;
        targetProject=p;
        break;
      }
    }
    if(!targetMilestone||!targetProject)throw new Error('Milestone not found');
    if(targetMilestone.status!=='pending'){
      throw new Error(`Cannot bill milestone "${targetMilestone.title}": milestone is already ${targetMilestone.status}`);
    }
    const client=w.clients.find(x=>x.id===targetProject.clientId);
    let draft:Invoice;
    if(c.draftId){
      draft=find(c.draftId);
      if(draft.lifecycle!=='draft')throw new Error('Only draft invoices can receive billed milestones');
    }else{
      draft=newInvoice(w);
      if(client){
        draft.clientId=client.id;
        draft.client=structuredClone(client);
        if(client.currency)draft.currency=client.currency;
        if(client.terms!==undefined)draft.terms=client.terms;
        draft.dueDate=addDays(draft.issueDate,draft.terms);
      }
      if(targetProject.currency)draft.currency=targetProject.currency;
      draft.projectId=targetProject.id;
      w.invoices.unshift(draft);
    }
    const desc=`${targetProject.name} - ${targetMilestone.title}${targetMilestone.description?`: ${targetMilestone.description}`:''}`;
    const line:Line={
      id:crypto.randomUUID(),
      description:desc,
      quantity:'1',
      rate:targetMilestone.amount,
      unit:'fixed',
      group:targetProject.name,
    };
    if(c.draftId&&draft.lines.length>0&&draft.lines[0].description!==''){
      draft.lines.push(line);
    }else{
      draft.lines=[line];
    }
    draft.reservedMilestoneId=targetMilestone.id;
    draft.breakdown=targetMilestone.isDeposit
      ? `Project milestone billing: Deposit for ${targetProject.name} (${money(targetMilestone.amount,draft.currency)})`
      : `Project milestone billing: ${targetMilestone.title} for ${targetProject.name} (${money(targetMilestone.amount,draft.currency)})`;
    targetMilestone.status='reserved';
    targetMilestone.reservedDraftId=draft.id;
    targetMilestone.updated=stamp;
    draft.updated=stamp;
    break;
  }
  case 'releaseMilestone':{
    for(const p of w.projects){
      for(const m of p.milestones||[]){
        if(m.reservedDraftId===c.draftId&&m.status==='reserved'){
          m.status='pending';
          m.reservedDraftId=undefined;
          m.updated=stamp;
        }
      }
    }
    const d=w.invoices.find(i=>i.id===c.draftId);
    if(d){
      d.reservedMilestoneId=undefined;
      d.updated=stamp;
    }
    break;
  }
  case 'send':{const m=w.messages.find(m=>m.id===c.id);if(!m)throw new Error('Email not found');if(!['draft','failed'].includes(m.status))throw new Error('This email is already queued or sent');const i=find(m.invoiceId);if(i.lifecycle!=='issued')throw new Error('Invoice cannot be sent');m.status='queued';m.attempted=undefined;m.error=undefined;break}
  case 'sharePortal':{
    const client=w.clients.find(x=>x.id===c.clientId);
    if(!client)throw new Error('Client not found');
    if(c.expires<today(w.business.timezone,now))throw new Error('Expiry must be in the future');
    const token=crypto.randomUUID().replace(/-/g,'')+crypto.randomUUID().replace(/-/g,'');
    client.portal={
      token,
      expires:c.expires,
      allowedInvoiceIds:c.allowedInvoiceIds,
      allowStatements:c.allowStatements??true,
      allowAttachments:c.allowAttachments??true,
      paymentNotices:client.portal?.paymentNotices||[],
    };
    break;
  }
  case 'revokePortal':{
    const client=w.clients.find(x=>x.id===c.clientId);
    if(!client)throw new Error('Client not found');
    if(client.portal){
      client.portal.token='';
      client.portal.allowedInvoiceIds=[];
    }
    break;
  }
  case 'recordClientPaymentNotice':{
    const client=w.clients.find(x=>x.id===c.clientId);
    if(!client)throw new Error('Client not found');
    if(!client.portal||!client.portal.token||client.portal.token!==c.token){
      throw new Error('Invalid or revoked portal token');
    }
    if(client.portal.expires<today(w.business.timezone,now)){
      throw new Error('Portal link has expired');
    }
    const noticeId=c.notice.id||crypto.randomUUID();
    client.portal.paymentNotices=client.portal.paymentNotices||[];
    client.portal.paymentNotices.unshift({
      id:noticeId,
      date:c.notice.date,
      amount:c.notice.amount,
      reference:c.notice.reference,
      notes:c.notice.notes,
      created:stamp,
    });
    break;
  }
  case 'dismissPaymentNotice':{
    const client=w.clients.find(x=>x.id===c.clientId);
    if(!client)throw new Error('Client not found');
    if(client.portal?.paymentNotices){
      client.portal.paymentNotices=client.portal.paymentNotices.filter(n=>n.id!==c.noticeId);
    }
    break;
  }
  case 'createBusinessProfile':{
    ensureProfiles(w);
    const profileId=c.value.id||crypto.randomUUID();
    if(w.profiles!.some(p=>p.id===profileId))throw new Error('Business profile already exists');
    const baseBiz=c.value.business||structuredClone(w.business);
    const newProf:BusinessProfile={
      id:profileId,
      name:c.value.name.trim()||'New Profile',
      isDefault:false,
      business:{
        ...baseBiz,
        name:c.value.business?.name||c.value.name.trim()||baseBiz.name,
      },
      clients:[],
      projects:[],
      services:structuredClone(w.services||[]),
      starters:structuredClone(w.starters||[]),
      invoices:[],
      creditNotes:[],
      payments:[],
      receipts:[],
      quotes:[],
      workEntries:[],
      schedules:[],
      messages:[],
      sequence:{},
      audit:[{id:crypto.randomUUID(),at:stamp,action:`Created profile ${c.value.name}`}],
      created:stamp,
      updated:stamp,
    };
    w.profiles!.push(newProf);
    if(c.value.switchImmediately){
      const current=w.profiles!.find(p=>p.id===w.activeProfileId);
      if(current){
        current.business=structuredClone(w.business);
        current.clients=structuredClone(w.clients);
        current.projects=structuredClone(w.projects);
        current.services=structuredClone(w.services);
        current.starters=structuredClone(w.starters);
        current.invoices=structuredClone(w.invoices);
        current.creditNotes=structuredClone(w.creditNotes||[]);
        current.payments=structuredClone(w.payments||[]);
        current.receipts=structuredClone(w.receipts||[]);
        current.quotes=structuredClone(w.quotes||[]);
        current.workEntries=structuredClone(w.workEntries||[]);
        current.schedules=structuredClone(w.schedules||[]);
        current.messages=structuredClone(w.messages||[]);
        current.sequence=structuredClone(w.sequence||{});
        current.audit=structuredClone(w.audit||[]);
        current.updated=stamp;
      }
      w.activeProfileId=newProf.id;
      w.business=structuredClone(newProf.business);
      w.clients=[];
      w.projects=[];
      w.services=structuredClone(newProf.services);
      w.starters=structuredClone(newProf.starters);
      w.invoices=[];
      w.creditNotes=[];
      w.payments=[];
      w.receipts=[];
      w.quotes=[];
      w.workEntries=[];
      w.schedules=[];
      w.messages=[];
      w.sequence={};
      w.audit=structuredClone(newProf.audit);
    }
    break;
  }
  case 'switchBusinessProfile':{
    ensureProfiles(w);
    if(w.activeProfileId===c.profileId)break;
    const target=w.profiles!.find(p=>p.id===c.profileId);
    if(!target)throw new Error('Target business profile not found');
    const current=w.profiles!.find(p=>p.id===w.activeProfileId);
    if(current){
      current.business=structuredClone(w.business);
      current.clients=structuredClone(w.clients);
      current.projects=structuredClone(w.projects);
      current.services=structuredClone(w.services);
      current.starters=structuredClone(w.starters);
      current.invoices=structuredClone(w.invoices);
      current.creditNotes=structuredClone(w.creditNotes||[]);
      current.payments=structuredClone(w.payments||[]);
      current.receipts=structuredClone(w.receipts||[]);
      current.quotes=structuredClone(w.quotes||[]);
      current.workEntries=structuredClone(w.workEntries||[]);
      current.schedules=structuredClone(w.schedules||[]);
      current.messages=structuredClone(w.messages||[]);
      current.sequence=structuredClone(w.sequence||{});
      current.audit=structuredClone(w.audit||[]);
      current.updated=stamp;
    }
    w.activeProfileId=target.id;
    w.business=structuredClone(target.business);
    w.clients=structuredClone(target.clients);
    w.projects=structuredClone(target.projects);
    w.services=structuredClone(target.services);
    w.starters=structuredClone(target.starters);
    w.invoices=structuredClone(target.invoices);
    w.creditNotes=structuredClone(target.creditNotes||[]);
    w.payments=structuredClone(target.payments||[]);
    w.receipts=structuredClone(target.receipts||[]);
    w.quotes=structuredClone(target.quotes||[]);
    w.workEntries=structuredClone(target.workEntries||[]);
    w.schedules=structuredClone(target.schedules||[]);
    w.messages=structuredClone(target.messages||[]);
    w.sequence=structuredClone(target.sequence||{});
    w.audit=structuredClone(target.audit||[]);
    break;
  }
  case 'updateBusinessProfile':{
    ensureProfiles(w);
    const target=w.profiles!.find(p=>p.id===c.profileId);
    if(!target)throw new Error('Business profile not found');
    if(c.name!==undefined){
      if(!c.name.trim())throw new Error('Profile name is required');
      target.name=c.name.trim();
    }
    if(c.isDefault){
      w.profiles!.forEach(p=>{p.isDefault=(p.id===target.id)});
    }
    target.updated=stamp;
    break;
  }
  case 'deleteBusinessProfile':{
    ensureProfiles(w);
    if(w.profiles!.length<=1)throw new Error('Cannot delete the only business profile');
    const target=w.profiles!.find(p=>p.id===c.profileId);
    if(!target)throw new Error('Business profile not found');
    if(target.isDefault)throw new Error('Cannot delete the default business profile');
    if(w.activeProfileId===c.profileId)throw new Error('Switch to another profile before deleting this one');
    w.profiles=w.profiles!.filter(p=>p.id!==c.profileId);
    break;
  }
  }
  if(w.profiles&&w.activeProfileId){
    const activeProf=w.profiles.find(p=>p.id===w.activeProfileId);
    if(activeProf){
      activeProf.business=structuredClone(w.business);
      activeProf.clients=structuredClone(w.clients);
      activeProf.projects=structuredClone(w.projects);
      activeProf.services=structuredClone(w.services);
      activeProf.starters=structuredClone(w.starters);
      activeProf.invoices=structuredClone(w.invoices);
      activeProf.creditNotes=structuredClone(w.creditNotes||[]);
      activeProf.payments=structuredClone(w.payments||[]);
      activeProf.receipts=structuredClone(w.receipts||[]);
      activeProf.quotes=structuredClone(w.quotes||[]);
      activeProf.workEntries=structuredClone(w.workEntries||[]);
      activeProf.schedules=structuredClone(w.schedules||[]);
      activeProf.messages=structuredClone(w.messages||[]);
      activeProf.sequence=structuredClone(w.sequence||{});
      activeProf.audit=structuredClone(w.audit||[]);
      activeProf.updated=stamp;
    }
  }
  w.audit.unshift({id:crypto.randomUUID(),at:stamp,action:c.type,invoiceId:'id' in c?c.id:undefined});return w
}
export function reminderMessage(i:Invoice,b:Business):Message{return {id:crypto.randomUUID(),invoiceId:i.id,kind:'reminder',to:i.client.email,cc:i.client.cc,replyTo:i.client.replyTo||b.email,subject:`Payment reminder: ${i.number}`,body:`Hello ${i.client.name},\n\nA quick reminder that ${money(totals(i).balance,i.currency)} remains outstanding for ${i.number}, due on ${i.dueDate}. Please let me know if you need anything from me.\n\nThank you,\n${b.name}`,status:'draft',created:new Date().toISOString()}}
export function runSchedules(source:Workspace,now=new Date()):Workspace{const w=structuredClone(source);w.starters = w.starters || [];w.creditNotes = w.creditNotes || [];w.payments = w.payments || [];w.receipts = w.receipts || [];const day=today(w.business.timezone,now);for(const s of w.schedules){if(s.paused||s.nextDate>day)continue;const original=w.invoices.find(i=>i.id===s.invoiceId);if(!original||original.lifecycle==='void'){s.paused=true;continue}if(s.lastRunDate===s.nextDate)continue;const fresh=newInvoice(w);w.invoices.unshift({...original,...fresh,client:structuredClone(original.client),clientId:original.clientId,projectId:original.projectId,lines:structuredClone(original.lines),currency:original.currency,tax:original.tax,notes:original.notes,internalNotes:original.internalNotes,attachments:structuredClone(original.attachments),breakdown:original.breakdown,discount:original.discount,discountType:original.discountType,issueDate:s.nextDate,dueDate:addDays(s.nextDate,original.terms),share:undefined,issuedAt:undefined,voidReason:undefined});s.lastRunDate=s.nextDate;s.nextDate=nextMonth(s.nextDate,s.months,s.day)}for(const i of w.invoices){if(!w.business.autoReminders||!i.reminder.enabled||status(i,day,w.creditNotes)!=='overdue'||!i.client.email)continue;if(i.reminder.pausedUntil&&i.reminder.pausedUntil>day)continue;const t=totals(i,w.creditNotes);if(new Decimal(t.balance).lte(0)||i.lifecycle!=='issued')continue;if(w.messages.some(m=>m.invoiceId===i.id&&m.status==='bounced'))continue;const last=i.reminder.lastDate||i.dueDate;if(addDays(last,i.reminder.days)>day)continue;if(w.messages.some(m=>m.invoiceId===i.id&&m.kind==='reminder'&&['draft','queued','sending'].includes(m.status)))continue;const m=reminderMessage(i,i.business??w.business);m.status='queued';w.messages.unshift(m);i.reminder.lastDate=day}return w}
export function buildClientStatement(w:Workspace,clientId:string,currency:Business['currency'],startDate:string,endDate:string,now=new Date()):ClientStatement{const client=w.clients.find(c=>c.id===clientId);if(!client)throw new Error('Client not found');const dp=precision(currency);const round=(v:Decimal)=>v.toDecimalPlaces(dp,Decimal.ROUND_HALF_UP);const allInvoices=(w.invoices||[]).filter(i=>i.clientId===clientId&&i.currency===currency&&i.lifecycle==='issued');const allCredits=(w.creditNotes||[]).filter(cn=>cn.clientId===clientId&&cn.currency===currency);const allPayments=(w.payments||[]).filter(p=>p.clientId===clientId&&p.currency===currency&&!p.reversed);let openingCharges=new Decimal(0);for(const inv of allInvoices.filter(i=>i.issueDate<startDate)){openingCharges=openingCharges.add(totals(inv).total)}let openingCredits=new Decimal(0);for(const cn of allCredits.filter(c=>c.issueDate<startDate)){openingCredits=openingCredits.add(cn.total)}let openingPayments=new Decimal(0);let openingRefunds=new Decimal(0);for(const p of allPayments){if(p.date<startDate){openingPayments=openingPayments.add(p.amount)}for(const r of p.refunds||[]){if(r.date<startDate){openingRefunds=openingRefunds.add(r.amount)}}}const openingBalance=round(openingCharges.sub(openingCredits).sub(openingPayments.sub(openingRefunds)));const entries:StatementEntry[]=[];let periodCharges=new Decimal(0);let periodCredits=new Decimal(0);let periodPayments=new Decimal(0);let periodRefunds=new Decimal(0);type RawItem={date:string;type:'invoice'|'creditNote'|'payment'|'refund';ref:string;desc:string;charge:Decimal;credit:Decimal};const rawItems:RawItem[]=[];for(const inv of allInvoices.filter(i=>i.issueDate>=startDate&&i.issueDate<=endDate)){const amt=new Decimal(totals(inv).total);periodCharges=periodCharges.add(amt);rawItems.push({date:inv.issueDate,type:'invoice',ref:inv.number||'Invoice',desc:`Invoice issued - Due ${inv.dueDate}`,charge:amt,credit:new Decimal(0)})}for(const cn of allCredits.filter(c=>c.issueDate>=startDate&&c.issueDate<=endDate)){const amt=new Decimal(cn.total);periodCredits=periodCredits.add(amt);rawItems.push({date:cn.issueDate,type:'creditNote',ref:cn.number,desc:`Credit note against ${cn.invoiceNumber} (${cn.reason})`,charge:new Decimal(0),credit:amt})}for(const p of allPayments){if(p.date>=startDate&&p.date<=endDate){const amt=new Decimal(p.amount);periodPayments=periodPayments.add(amt);rawItems.push({date:p.date,type:'payment',ref:p.reference?`Ref: ${p.reference}`:`Payment via ${p.method}`,desc:`Payment received (${p.method})`,charge:new Decimal(0),credit:amt})}for(const r of p.refunds||[]){if(r.date>=startDate&&r.date<=endDate){const amt=new Decimal(r.amount);periodRefunds=periodRefunds.add(amt);rawItems.push({date:r.date,type:'refund',ref:r.reference?`Ref: ${r.reference}`:'Refund',desc:`Refund from credit${r.notes?` - ${r.notes}`:''}`,charge:amt,credit:new Decimal(0)})}}}rawItems.sort((a,b)=>a.date.localeCompare(b.date));let runningBalance=openingBalance;for(const item of rawItems){runningBalance=runningBalance.add(item.charge).sub(item.credit);entries.push({id:crypto.randomUUID(),date:item.date,type:item.type,reference:item.ref,description:item.desc,charges:item.charge.gt(0)?item.charge.toFixed(dp):'',credits:item.credit.gt(0)?item.credit.toFixed(dp):'',balance:runningBalance.toFixed(dp)})}const netPayments=periodPayments.sub(periodRefunds);const closingBalance=openingBalance.add(periodCharges).sub(periodCredits).sub(netPayments);return {clientId,client:structuredClone(client),business:structuredClone(w.business),currency,startDate,endDate,openingBalance:openingBalance.toFixed(dp),periodCharges:periodCharges.toFixed(dp),periodCredits:periodCredits.toFixed(dp),periodPayments:periodPayments.toFixed(dp),periodRefunds:periodRefunds.toFixed(dp),closingBalance:closingBalance.toFixed(dp),entries,generatedAt:today(w.business.timezone,now)}}
export function getAttentionQueueItems(w:Workspace,now=new Date()):AttentionItem[]{const items:AttentionItem[]=[];const day=today(w.business.timezone,now);const nowMs=now.getTime();for(const i of w.invoices||[]){if(i.lifecycle==='issued'){const t=totals(i,w.creditNotes);if(new Decimal(t.balance).gt(0)&&status(i,day,w.creditNotes)==='overdue'){items.push({id:`overdue-${i.id}`,kind:'overdue',title:`Overdue invoice: ${i.number}`,detail:`${money(t.balance,i.currency)} due since ${i.dueDate} for ${i.client.name}`,invoiceId:i.id,invoiceNumber:i.number,clientId:i.clientId,clientName:i.client.name,amount:t.balance,currency:i.currency,date:i.dueDate,pausedUntil:i.reminder.pausedUntil,pauseReason:i.reminder.pauseReason})}const messages=(w.messages||[]).filter(m=>m.invoiceId===i.id);const hasSentMessage=messages.some(m=>['sent','delivered'].includes(m.status));const issuedMs=i.issuedAt?new Date(i.issuedAt).getTime():0;if(!hasSentMessage&&issuedMs>0&&nowMs-issuedMs>=24*3600*1000){items.push({id:`unsent-${i.id}`,kind:'unsent',title:`Unsent invoice: ${i.number}`,detail:`Issued ${i.issueDate} (${money(t.total,i.currency)}) but no email has been sent yet`,invoiceId:i.id,invoiceNumber:i.number,clientId:i.clientId,clientName:i.client.name,amount:t.total,currency:i.currency,date:i.issueDate})}}else if(i.lifecycle==='draft'&&(i.replacementOf||(w.schedules||[]).some(s=>s.invoiceId===i.id))){items.push({id:`draft-${i.id}`,kind:'unreviewed_draft',title:`Draft awaiting review`,detail:i.replacementOf?`Replacement draft created following credit note for ${i.client.name}`:`Recurring draft awaiting review for ${i.client.name}`,invoiceId:i.id,clientId:i.clientId,clientName:i.client.name,currency:i.currency,date:i.issueDate})}}for(const m of w.messages||[]){if(['failed','bounced'].includes(m.status)){const inv=w.invoices.find(x=>x.id===m.invoiceId);items.push({id:`delivery-${m.id}`,kind:'delivery_failed',title:`Delivery ${m.status}: ${m.subject}`,detail:`Attempt to send to ${m.to} failed: ${m.error||'Delivery failure'}`,invoiceId:m.invoiceId,invoiceNumber:inv?.number,clientId:inv?.clientId,clientName:inv?.client.name,date:m.attempted||m.created})}}for(const c of w.clients||[]){for(const notice of c.portal?.paymentNotices||[]){items.push({id:`payment-notice-${notice.id}`,kind:'payment_notice',title:`Payment reported: ${c.name}`,detail:`Client reported payment of ${notice.amount?money(notice.amount,c.currency||w.business.currency):'an amount'} on ${notice.date}${notice.reference?` (Ref: ${notice.reference})`:''}`,clientId:c.id,clientName:c.name,amount:notice.amount,currency:c.currency||w.business.currency,date:notice.date,paymentNoticeId:notice.id})}}return items}
export function buildClientPortalView(w:Workspace,token:string,now=new Date()){const client=(w.clients||[]).find(c=>c.portal&&c.portal.token===token);if(!client||!client.portal||!client.portal.token)throw new Error('Client portal link not found or revoked');const day=today(w.business.timezone,now);if(client.portal.expires<day)throw new Error('Client portal link has expired');let eligibleInvoices=(w.invoices||[]).filter(i=>i.clientId===client.id&&i.lifecycle==='issued');if(client.portal.allowedInvoiceIds&&client.portal.allowedInvoiceIds.length>0){const allowedSet=new Set(client.portal.allowedInvoiceIds);eligibleInvoices=eligibleInvoices.filter(i=>allowedSet.has(i.id))}const currency=client.currency||w.business.currency;const dp=precision(currency);let totalBalanceDue=new Decimal(0);const invoiceSummaries=eligibleInvoices.map(inv=>{const t=totals(inv,w.creditNotes||[]);if(inv.currency===currency){totalBalanceDue=totalBalanceDue.add(t.balance)}return {id:inv.id,number:inv.number,issueDate:inv.issueDate,dueDate:inv.dueDate,total:t.total,paid:t.paid,balance:t.balance,status:status(inv,day,w.creditNotes||[]),currency:inv.currency,hasBreakdown:Boolean(inv.breakdown&&inv.breakdown.trim().length>0)}});const attachments:{id:string;name:string;size:number;mimeType:string;invoiceNumber:string;created:string}[]=[];if(client.portal.allowAttachments!==false){for(const inv of eligibleInvoices){for(const att of inv.attachments||[]){if(att.visibility==='client'){attachments.push({id:att.id,name:att.name,size:att.size,mimeType:att.mimeType,invoiceNumber:inv.number,created:att.created})}}}}let statementSummary:{startDate:string;endDate:string;openingBalance:string;periodCharges:string;periodCredits:string;periodPayments:string;periodRefunds:string;closingBalance:string;entries:StatementEntry[]} | undefined=undefined;if(client.portal.allowStatements!==false){try{const yearStart=`${day.slice(0,4)}-01-01`;const stmt=buildClientStatement(w,client.id,currency,yearStart,day,now);statementSummary={startDate:stmt.startDate,endDate:stmt.endDate,openingBalance:stmt.openingBalance,periodCharges:stmt.periodCharges,periodCredits:stmt.periodCredits,periodPayments:stmt.periodPayments,periodRefunds:stmt.periodRefunds,closingBalance:stmt.closingBalance,entries:stmt.entries}}catch{}}return {clientId:client.id,client:{name:client.name,email:client.email,address:client.address,contact:client.contact,phone:client.phone,country:client.country,taxId:client.taxId,currency:client.currency},business:{name:w.business.name,email:w.business.email,address:w.business.address,taxId:w.business.taxId,currency:w.business.currency,logo:w.business.logo,bank:client.paymentInstructions||w.business.bank},totalBalanceDue:totalBalanceDue.toFixed(dp),currency,invoices:invoiceSummaries,allowStatements:client.portal.allowStatements!==false,statementSummary,allowAttachments:client.portal.allowAttachments!==false,attachments,paymentNotices:client.portal.paymentNotices||[],expires:client.portal.expires}}
export function createFromStarter(w: Workspace, starterId: string, clientId?: string): Invoice {
 const s = (w.starters || []).find(x => x.id === starterId);
 if (!s) throw new Error('Starter not found');
 const fresh = newInvoice(w);
 if (clientId) {
  const c = w.clients.find(x => x.id === clientId);
  if (c) {
   fresh.clientId = c.id;
   fresh.client = structuredClone(c);
   if (c.currency) fresh.currency = c.currency;
   if (c.terms !== undefined) fresh.terms = c.terms;
   if (c.template) fresh.template = c.template;
  }
 }
 if (s.terms !== undefined && (!clientId || !fresh.clientId)) {
  fresh.terms = s.terms;
 }
 fresh.dueDate = addDays(fresh.issueDate, fresh.terms);
 fresh.lines = s.lines.map(l => ({ ...structuredClone(l), id: crypto.randomUUID() }));
 if (s.notes) fresh.notes = s.notes;
 return fresh;
}

export function createFromLastInvoice(w: Workspace, clientId: string): Invoice {
 const c = w.clients.find(x => x.id === clientId);
 if (!c) throw new Error('Client not found');
 const clientInvoices = w.invoices.filter(i => i.clientId === clientId).sort((a, b) => b.updated.localeCompare(a.updated));
 if (!clientInvoices.length) throw new Error('No previous invoice for this client');
 const last = clientInvoices[0];
 const fresh = newInvoice(w);
 fresh.clientId = c.id;
 fresh.client = structuredClone(c);
 fresh.projectId = last.projectId;
 fresh.terms = last.terms;
 fresh.manualDue = last.manualDue;
 fresh.dueDate = addDays(fresh.issueDate, fresh.terms);
 fresh.currency = last.currency;
 fresh.lines = last.lines.map(l => ({ ...structuredClone(l), id: crypto.randomUUID() }));
 fresh.tax = last.tax;
 fresh.discount = last.discount;
 fresh.discountType = last.discountType;
 fresh.notes = last.notes;
 fresh.template = last.template;
 fresh.accent = last.accent;
 return fresh;
}

export function resolveClientDefaults(client: Client | undefined, business: Business) {
 return {
  currency: client?.currency || business.currency,
  terms: client?.terms ?? business.terms,
  template: client?.template || business.template,
  paymentInstructions: client?.paymentInstructions || business.bank,
 };
}

function splitCsvLine(raw: string): string[] {
 const cols: string[] = [];
 let cur = '';
 let inQuotes = false;
 for (let i = 0; i < raw.length; i++) {
  const ch = raw[i];
  if (ch === '"') {
   if (inQuotes && raw[i + 1] === '"') {
    cur += '"';
    i++;
   } else {
    inQuotes = !inQuotes;
   }
  } else if (ch === ',' && !inQuotes) {
   cols.push(cur.trim());
   cur = '';
  } else {
   cur += ch;
  }
 }
 cols.push(cur.trim());
 return cols;
}

export function parseTabularLines(input: string): { valid: Array<z.infer<typeof lineSchema>>; errors: Array<{ row: number; raw: string; reason: string }> } {
 const rows = input.split(/\r?\n/).filter(r => r.trim().length > 0);
 const valid: Array<z.infer<typeof lineSchema>> = [];
 const errors: Array<{ row: number; raw: string; reason: string }> = [];

 for (let idx = 0; idx < rows.length; idx++) {
  const raw = rows[idx];
  const lower = raw.toLowerCase();
  if (idx === 0 && lower.includes('desc') && (lower.includes('qty') || lower.includes('rate') || lower.includes('amount') || lower.includes('price'))) {
   continue;
  }

  let cols: string[] = [];
  if (raw.includes('\t')) {
   cols = raw.split('\t').map(c => c.trim());
  } else if (raw.includes('|')) {
   cols = raw.split('|').map(c => c.trim()).filter(Boolean);
  } else if (raw.includes(',')) {
   cols = splitCsvLine(raw);
  } else {
   cols = [raw.trim()];
  }

  if (cols.length < 2) {
   errors.push({ row: idx + 1, raw, reason: 'Line must contain at least a description and an amount or rate.' });
   continue;
  }


  let description = '';
  let rawQty = '1';
  let rawRate = '0';
  let rawUnit: 'fixed' | 'hour' | 'unit' = 'fixed';
  let group: string | undefined = undefined;

  if (cols.length === 2) {
   description = cols[0];
   rawRate = cols[1];
  } else if (cols.length === 3) {
   description = cols[0];
   rawQty = cols[1];
   rawRate = cols[2];
  } else if (cols.length === 4) {
   description = cols[0];
   rawQty = cols[1];
   rawRate = cols[2];
   const u = cols[3].toLowerCase();
   rawUnit = /hour|hr/.test(u) ? 'hour' : /unit/.test(u) ? 'unit' : 'fixed';
  } else {
   description = cols[0];
   rawQty = cols[1];
   rawRate = cols[2];
   const u = cols[3].toLowerCase();
   rawUnit = /hour|hr/.test(u) ? 'hour' : /unit/.test(u) ? 'unit' : 'fixed';
   group = cols.slice(4).join(' ').trim() || undefined;
  }

  if (!description.trim()) {
   errors.push({ row: idx + 1, raw, reason: 'Description cannot be empty.' });
   continue;
  }

  const cleanQty = rawQty.replace(/[$£€¥,]/g, '').trim();
  const cleanRate = rawRate.replace(/[$£€¥,]/g, '').trim();

  const qtyValid = /^\d{1,9}(\.\d{1,4})?$/.test(cleanQty) && Number(cleanQty) > 0;
  const rateValid = /^\d{1,9}(\.\d{1,4})?$/.test(cleanRate) && Number(cleanRate) >= 0;

  if (!qtyValid || !rateValid) {
   const issues: string[] = [];
   if (!qtyValid) issues.push(`Quantity '${rawQty}' is invalid or not greater than zero`);
   if (!rateValid) issues.push(`Rate '${rawRate}' is invalid or negative`);
   errors.push({ row: idx + 1, raw, reason: issues.join('; ') });
   continue;
  }

  valid.push({
   id: crypto.randomUUID(),
   description,
   quantity: cleanQty,
   rate: cleanRate,
   unit: rawUnit,
   ...(group ? { group } : {})
  });
 }

 return { valid, errors };
}

export interface InvoiceWarning {
 id: string;
 type: 'duplicate' | 'missing-bank' | 'old-date' | 'past-due';
 title: string;
 message: string;
 matchedInvoiceId?: string;
}

export function detectInvoiceWarnings(draft: Draft, workspace: Workspace, now = new Date()): InvoiceWarning[] {
 const warnings: InvoiceWarning[] = [];
 const todayStr = today(workspace.business.timezone, now);

 if (draft.clientId) {
  const draftTotal = totals(draft).total;
  const match = workspace.invoices.find(other => {
   if (other.id === draft.id || other.clientId !== draft.clientId || other.lifecycle === 'void') return false;
   const daysDiff = Math.abs((new Date(draft.issueDate).getTime() - new Date(other.issueDate).getTime()) / (1000 * 60 * 60 * 24));
   if (daysDiff <= 60 && totals(other).total === draftTotal) return true;
   if (draft.projectId && other.projectId === draft.projectId && other.issueDate.slice(0, 7) === draft.issueDate.slice(0, 7)) return true;
   return false;
  });

  if (match) {
   warnings.push({
    id: 'warn-duplicate',
    type: 'duplicate',
    title: 'Possible duplicate invoice',
    message: `A similar invoice exists for this client (${match.number || 'Draft'}, ${money(totals(match).total, match.currency)} on ${match.issueDate}). Check to confirm this is not an unintentional duplicate.`,
    matchedInvoiceId: match.id,
   });
  }
 }

 const hasBank = Boolean((workspace.business.bank || '').trim() || (draft.client.paymentInstructions || '').trim());
 if (!hasBank) {
  warnings.push({
   id: 'warn-missing-bank',
   type: 'missing-bank',
   title: 'Missing payment instructions',
   message: 'No bank details or payment instructions provided in Settings or Client profile. Your client may not know where to send payment.',
  });
 }

 const daysOld = (new Date(todayStr).getTime() - new Date(draft.issueDate).getTime()) / (1000 * 60 * 60 * 24);
 if (daysOld > 90) {
  warnings.push({
   id: 'warn-old-date',
   type: 'old-date',
   title: 'Issue date is over 90 days ago',
   message: `The invoice issue date is set to ${draft.issueDate}, which is more than 90 days in the past.`,
  });
 }

 if (draft.dueDate < todayStr) {
  warnings.push({
   id: 'warn-past-due',
   type: 'past-due',
   title: 'Due date is in the past',
   message: `The payment due date is set to ${draft.dueDate}, which is already past today (${todayStr}).`,
  });
 }

 return warnings;
}

export interface TimelineEvent {
 id: string;
 at: string;
 formattedDate: string;
 type: 'created' | 'updated' | 'issued' | 'payment' | 'reversal' | 'delivery' | 'share' | 'revoke' | 'reminder' | 'void' | 'archive';
 title: string;
 detail: string;
 category: 'Lifecycle' | 'Payment' | 'Delivery' | 'Sharing' | 'System';
 status?: string;
 isPrivate?: boolean;
}

export function formatTimelineDate(isoString: string, timezone = 'Europe/London'): string {
 try {
  const d = new Date(isoString);
  return new Intl.DateTimeFormat('en-GB', {
   timeZone: timezone,
   day: 'numeric',
   month: 'short',
   year: 'numeric',
   hour: '2-digit',
   minute: '2-digit',
  }).format(d);
 } catch {
  return isoString;
 }
}

export function buildInvoiceTimeline(i: Invoice, w: Workspace): TimelineEvent[] {
 const events: TimelineEvent[] = [];
 const tz = w.business.timezone || 'Europe/London';

 events.push({
  id: `event-created-${i.id}`,
  at: i.created,
  formattedDate: formatTimelineDate(i.created, tz),
  type: 'created',
  category: 'Lifecycle',
  title: i.replacementOf ? 'Replacement draft created' : 'Draft created',
  detail: i.replacementOf
   ? `Replacement draft created following credit note for invoice ${w.invoices.find(x => x.id === i.replacementOf)?.number || 'original invoice'}`
   : `Initial draft created for ${i.client.name || 'unnamed client'}`,
  isPrivate: true,
 });

 if (i.updated && i.updated !== i.created && (!i.issuedAt || i.updated < i.issuedAt)) {
  events.push({
   id: `event-updated-${i.id}`,
   at: i.updated,
   formattedDate: formatTimelineDate(i.updated, tz),
   type: 'updated',
   category: 'Lifecycle',
   title: 'Draft updated',
   detail: 'Draft modifications saved',
   isPrivate: true,
  });
 }

 if (i.issuedAt) {
  events.push({
   id: `event-issued-${i.id}`,
   at: i.issuedAt,
   formattedDate: formatTimelineDate(i.issuedAt, tz),
   type: 'issued',
   category: 'Lifecycle',
   title: `Invoice issued (${i.number})`,
   detail: `Locked with total ${money(totals(i, w.creditNotes).total, i.currency)}, due on ${i.dueDate}`,
   status: 'issued',
   isPrivate: false,
  });
 }

 for (const cn of (w.creditNotes || []).filter(c => c.invoiceId === i.id)) {
  events.push({
   id: `event-credit-${cn.id}`,
   at: cn.issuedAt || cn.created,
   formattedDate: formatTimelineDate(cn.issuedAt || cn.created, tz),
   type: 'void',
   category: 'Lifecycle',
   title: `Credit note issued (${cn.number})`,
   detail: `Credited ${money(cn.total, cn.currency)} against charges. Reason: ${cn.reason}${cn.replacementDraftId ? ' (Replacement draft generated)' : ''}`,
   status: 'credited',
   isPrivate: false,
  });
 }

 if (i.lifecycle === 'void') {
  const voidAudit = (w.audit || []).find(a => a.invoiceId === i.id && a.action === 'void');
  const voidAt = voidAudit ? voidAudit.at : i.updated;
  events.push({
   id: `event-void-${i.id}`,
   at: voidAt,
   formattedDate: formatTimelineDate(voidAt, tz),
   type: 'void',
   category: 'Lifecycle',
   title: 'Invoice voided',
   detail: `Reason: ${i.voidReason || 'No reason provided'}`,
   status: 'void',
   isPrivate: false,
  });
 }

 for (const p of i.payments || []) {
  const payDateIso = p.date.includes('T') ? p.date : `${p.date}T12:00:00.000Z`;
  if (p.reversed) {
   events.push({
    id: `event-pay-rev-${p.id}`,
    at: payDateIso,
    formattedDate: formatTimelineDate(payDateIso, tz),
    type: 'reversal',
    category: 'Payment',
    title: `Payment reversed: ${money(p.amount, i.currency)}`,
    detail: `Original payment on ${p.date} via ${p.method}${p.reference ? ` (Ref: ${p.reference})` : ''} was reversed`,
    status: 'reversed',
    isPrivate: false,
   });
  } else {
   events.push({
    id: `event-pay-${p.id}`,
    at: payDateIso,
    formattedDate: formatTimelineDate(payDateIso, tz),
    type: 'payment',
    category: 'Payment',
    title: `Payment recorded: ${money(p.amount, i.currency)}`,
    detail: `Received via ${p.method}${p.reference ? ` (Ref: ${p.reference})` : ''}${p.notes ? ` - ${p.notes}` : ''}`,
    status: 'paid',
    isPrivate: false,
   });
  }
 }

 const messages = (w.messages || []).filter(m => m.invoiceId === i.id);
 for (const m of messages) {
  const deliveryAt = m.attempted || m.created;
  events.push({
   id: `event-msg-${m.id}`,
   at: deliveryAt,
   formattedDate: formatTimelineDate(deliveryAt, tz),
   type: 'delivery',
   category: 'Delivery',
   title: m.kind === 'reminder' ? 'Reminder email' : 'Invoice email',
   detail: `To: ${m.to}${m.cc && m.cc.length ? ` (CC: ${m.cc.join(', ')})` : ''} - Status: ${m.status}${m.error ? ` (${m.error})` : ''}`,
   status: m.status,
   isPrivate: false,
  });
 }

 if (i.share) {
  const shareAudit = (w.audit || []).find(a => a.invoiceId === i.id && a.action === 'share');
  const shareAt = shareAudit ? shareAudit.at : i.updated;
  events.push({
   id: `event-share-${i.id}`,
   at: shareAt,
   formattedDate: formatTimelineDate(shareAt, tz),
   type: 'share',
   category: 'Sharing',
   title: 'Public view link active',
   detail: `Secure link expires on ${i.share.expires}`,
   status: 'active',
   isPrivate: true,
  });
 }

 const revokeAudit = (w.audit || []).find(a => a.invoiceId === i.id && a.action === 'revoke');
 if (revokeAudit && !i.share) {
  events.push({
   id: `event-revoke-${revokeAudit.id}`,
   at: revokeAudit.at,
   formattedDate: formatTimelineDate(revokeAudit.at, tz),
   type: 'revoke',
   category: 'Sharing',
   title: 'Public link revoked',
   detail: 'Public viewing token was immediately revoked and disabled',
   status: 'revoked',
   isPrivate: true,
  });
 }

 if (i.reminder && i.reminder.enabled) {
  const remAudit = (w.audit || []).find(a => a.invoiceId === i.id && a.action === 'reminder');
  const remAt = remAudit ? remAudit.at : i.updated;
  events.push({
   id: `event-rem-${i.id}`,
   at: remAt,
   formattedDate: formatTimelineDate(remAt, tz),
   type: 'reminder',
   category: 'System',
   title: 'Automated reminders enabled',
   detail: `Interval: every ${i.reminder.days} days after due date`,
   status: 'enabled',
   isPrivate: true,
  });
 }

 return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function diffDays(date1: string, date2: string): number {
  const d1 = new Date(date1 + 'T00:00:00Z');
  const d2 = new Date(date2 + 'T00:00:00Z');
  return Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
}

export type OverviewPeriod = 'all' | 'this-month' | 'last-month' | 'this-quarter' | 'this-year' | 'custom';

export interface OverviewMetricsOptions {
  period: OverviewPeriod;
  startDate?: string;
  endDate?: string;
  asOfDate?: string;
}

export interface AgeingBucketMetrics {
  key: '1-30' | '31-60' | '61-90' | '91+';
  label: string;
  count: number;
  amount: string;
  invoiceIds: string[];
}

export interface CurrencyOverviewMetrics {
  currency: string;
  invoiced: {
    amount: string;
    count: number;
    invoiceIds: string[];
  };
  cashReceived: {
    amount: string;
    count: number;
    invoiceIds: string[];
  };
  outstanding: {
    amount: string;
    count: number;
    invoiceIds: string[];
  };
  dueSoon: {
    amount: string;
    count: number;
    invoiceIds: string[];
  };
  overdue: {
    amount: string;
    count: number;
    invoiceIds: string[];
  };
  ageing: {
    '1-30': AgeingBucketMetrics;
    '31-60': AgeingBucketMetrics;
    '61-90': AgeingBucketMetrics;
    '91+': AgeingBucketMetrics;
  };
}

export interface OverviewReport {
  period: OverviewPeriod;
  startDate?: string;
  endDate?: string;
  asOfDate: string;
  currencies: Record<string, CurrencyOverviewMetrics>;
  allCurrencies: string[];
}

export function getPeriodRange(
  period: OverviewPeriod,
  todayStr: string,
  customStart?: string,
  customEnd?: string
): { startDate?: string; endDate?: string } {
  if (period === 'all') {
    return { startDate: undefined, endDate: undefined };
  }
  if (period === 'custom') {
    return {
      startDate: customStart && customStart.trim() ? customStart.trim() : undefined,
      endDate: customEnd && customEnd.trim() ? customEnd.trim() : undefined,
    };
  }

  const [yearStr, monthStr] = todayStr.split('-');
  const y = Number(yearStr);
  const m = Number(monthStr);

  if (period === 'this-month') {
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const mm = String(m).padStart(2, '0');
    return {
      startDate: `${y}-${mm}-01`,
      endDate: `${y}-${mm}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  if (period === 'last-month') {
    let lmYear = y;
    let lmMonth = m - 1;
    if (lmMonth === 0) {
      lmMonth = 12;
      lmYear -= 1;
    }
    const lastDay = new Date(Date.UTC(lmYear, lmMonth, 0)).getUTCDate();
    const mm = String(lmMonth).padStart(2, '0');
    return {
      startDate: `${lmYear}-${mm}-01`,
      endDate: `${lmYear}-${mm}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  if (period === 'this-quarter') {
    const q = Math.floor((m - 1) / 3);
    const qStartMonth = q * 3 + 1;
    const qEndMonth = q * 3 + 3;
    const lastDay = new Date(Date.UTC(y, qEndMonth, 0)).getUTCDate();
    return {
      startDate: `${y}-${String(qStartMonth).padStart(2, '0')}-01`,
      endDate: `${y}-${String(qEndMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  if (period === 'this-year') {
    return {
      startDate: `${y}-01-01`,
      endDate: `${y}-12-31`,
    };
  }

  return { startDate: undefined, endDate: undefined };
}

export function calculateOverviewMetrics(w: Workspace, options: OverviewMetricsOptions): OverviewReport {
  const asOfDate = options.asOfDate || today(w.business.timezone);
  const { startDate, endDate } = getPeriodRange(options.period, asOfDate, options.startDate, options.endDate);

  const currencySet = new Set<string>();
  if (w.business.currency) currencySet.add(w.business.currency);
  for (const inv of w.invoices) {
    if (inv.currency) currencySet.add(inv.currency);
  }
  for (const p of w.payments || []) {
    if (p.currency) currencySet.add(p.currency);
  }
  const allCurrencies = Array.from(currencySet);
  if (!allCurrencies.length) allCurrencies.push('GBP');

  const currencies: Record<string, CurrencyOverviewMetrics> = {};
  const creditNotes = w.creditNotes || [];

  for (const cur of allCurrencies) {
    currencies[cur] = {
      currency: cur,
      invoiced: { amount: '0.00', count: 0, invoiceIds: [] },
      cashReceived: { amount: '0.00', count: 0, invoiceIds: [] },
      outstanding: { amount: '0.00', count: 0, invoiceIds: [] },
      dueSoon: { amount: '0.00', count: 0, invoiceIds: [] },
      overdue: { amount: '0.00', count: 0, invoiceIds: [] },
      ageing: {
        '1-30': { key: '1-30', label: '1-30 days', count: 0, amount: '0.00', invoiceIds: [] },
        '31-60': { key: '31-60', label: '31-60 days', count: 0, amount: '0.00', invoiceIds: [] },
        '61-90': { key: '61-90', label: '61-90 days', count: 0, amount: '0.00', invoiceIds: [] },
        '91+': { key: '91+', label: '91+ days', count: 0, amount: '0.00', invoiceIds: [] },
      },
    };
  }

  // 1. Invoiced (filter by issueDate, excluding drafts and voids)
  for (const inv of w.invoices) {
    if (inv.lifecycle !== 'issued') continue;
    if (startDate && inv.issueDate < startDate) continue;
    if (endDate && inv.issueDate > endDate) continue;

    const cur = inv.currency || w.business.currency;
    const curMetrics = currencies[cur];
    if (!curMetrics) continue;

    const t = totals(inv, creditNotes);
    const netBilled = new Decimal(t.adjustedTotal);
    curMetrics.invoiced.amount = new Decimal(curMetrics.invoiced.amount).add(netBilled).toFixed(precision(cur));
    curMetrics.invoiced.count += 1;
    curMetrics.invoiced.invoiceIds.push(inv.id);
  }

  // 2. Cash Received (filter by payment date, accounting for unreversed payments & refunds)
  if (w.payments && w.payments.length > 0) {
    for (const cp of w.payments) {
      if (cp.reversed) continue;
      if (startDate && cp.date < startDate) continue;
      if (endDate && cp.date > endDate) continue;

      const cur = cp.currency || w.business.currency;
      const curMetrics = currencies[cur];
      if (!curMetrics) continue;

      let netPayment = new Decimal(cp.amount);
      for (const rf of cp.refunds || []) {
        if (startDate && rf.date < startDate) continue;
        if (endDate && rf.date > endDate) continue;
        netPayment = netPayment.sub(rf.amount);
      }
      curMetrics.cashReceived.amount = new Decimal(curMetrics.cashReceived.amount).add(netPayment).toFixed(precision(cur));
      curMetrics.cashReceived.count += 1;
      for (const al of cp.allocations || []) {
        if (!al.reversed && !curMetrics.cashReceived.invoiceIds.includes(al.invoiceId)) {
          curMetrics.cashReceived.invoiceIds.push(al.invoiceId);
        }
      }
    }
  } else {
    // Fallback for workspaces where w.payments is not populated
    for (const inv of w.invoices) {
      const cur = inv.currency || w.business.currency;
      const curMetrics = currencies[cur];
      if (!curMetrics) continue;

      for (const p of inv.payments || []) {
        if (p.reversed) continue;
        if (startDate && p.date < startDate) continue;
        if (endDate && p.date > endDate) continue;

        curMetrics.cashReceived.amount = new Decimal(curMetrics.cashReceived.amount).add(p.amount).toFixed(precision(cur));
        curMetrics.cashReceived.count += 1;
        if (!curMetrics.cashReceived.invoiceIds.includes(inv.id)) {
          curMetrics.cashReceived.invoiceIds.push(inv.id);
        }
      }
    }
  }

  // 3. Outstanding (unpaid balance on issued invoices within period issueDate, or all active)
  for (const inv of w.invoices) {
    if (inv.lifecycle !== 'issued') continue;
    if (options.period !== 'all') {
      if (startDate && inv.issueDate < startDate) continue;
      if (endDate && inv.issueDate > endDate) continue;
    }

    const cur = inv.currency || w.business.currency;
    const curMetrics = currencies[cur];
    if (!curMetrics) continue;

    const t = totals(inv, creditNotes);
    const bal = new Decimal(t.balance);
    if (bal.gt(0)) {
      curMetrics.outstanding.amount = new Decimal(curMetrics.outstanding.amount).add(bal).toFixed(precision(cur));
      curMetrics.outstanding.count += 1;
      curMetrics.outstanding.invoiceIds.push(inv.id);
    }
  }

  // 4. Due soon (issued invoices due in next 7 days from asOfDate with balance > 0)
  const weekFromNow = addDays(asOfDate, 7);
  for (const inv of w.invoices) {
    if (inv.lifecycle !== 'issued') continue;

    const cur = inv.currency || w.business.currency;
    const curMetrics = currencies[cur];
    if (!curMetrics) continue;

    const t = totals(inv, creditNotes);
    const bal = new Decimal(t.balance);
    if (bal.gt(0) && inv.dueDate >= asOfDate && inv.dueDate <= weekFromNow) {
      curMetrics.dueSoon.amount = new Decimal(curMetrics.dueSoon.amount).add(bal).toFixed(precision(cur));
      curMetrics.dueSoon.count += 1;
      curMetrics.dueSoon.invoiceIds.push(inv.id);
    }
  }

  // 5. Overdue & Ageing Buckets (issued invoices with dueDate < asOfDate and balance > 0)
  for (const inv of w.invoices) {
    if (inv.lifecycle !== 'issued') continue;

    const cur = inv.currency || w.business.currency;
    const curMetrics = currencies[cur];
    if (!curMetrics) continue;

    const t = totals(inv, creditNotes);
    const bal = new Decimal(t.balance);
    if (bal.gt(0) && inv.dueDate < asOfDate) {
      curMetrics.overdue.amount = new Decimal(curMetrics.overdue.amount).add(bal).toFixed(precision(cur));
      curMetrics.overdue.count += 1;
      curMetrics.overdue.invoiceIds.push(inv.id);

      const days = diffDays(asOfDate, inv.dueDate);
      let bucketKey: '1-30' | '31-60' | '61-90' | '91+' | null = null;
      if (days >= 1 && days <= 30) {
        bucketKey = '1-30';
      } else if (days >= 31 && days <= 60) {
        bucketKey = '31-60';
      } else if (days >= 61 && days <= 90) {
        bucketKey = '61-90';
      } else if (days >= 91) {
        bucketKey = '91+';
      }

      if (bucketKey) {
        const b = curMetrics.ageing[bucketKey];
        b.amount = new Decimal(b.amount).add(bal).toFixed(precision(cur));
        b.count += 1;
        b.invoiceIds.push(inv.id);
      }
    }
  }

  return {
    period: options.period,
    startDate,
    endDate,
    asOfDate,
    currencies,
    allCurrencies,
  };
}



