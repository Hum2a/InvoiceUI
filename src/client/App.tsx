import { useEffect,useState,useRef,useMemo } from 'react'
import { MotionConfig,motion } from 'motion/react'
import { newInvoice,totals,status,today,money,addDays,emptyWorkspace,getAttentionQueueItems,calculateOverviewMetrics,diffDays,getPeriodRange,type Invoice,type Business,type Client,type OverviewPeriod } from '../shared/domain'
import { api,downloadBlob,useWorkspace } from './workspace'
import { Button,Badge,Empty,Modal } from './components/ui'
import {
  Search,
  RefreshCw,
  Plus,
  ArrowLeft,
  ArrowRight,
  Download,
  Trash2,
  ExternalLink,
} from './components/ui/AnimatedIcon'
import { NumberTicker } from './components/ui/NumberTicker'
import { ShinyText } from './components/ui/ShinyText'
import { AnimatedTabs } from './components/ui/AnimatedTabs'
import { Editor } from './components/Editor'
import { Records,Settings } from './components/Records'
import { InvoiceActions } from './components/InvoiceActions'
import { InvoicePreview } from './components/InvoicePreview'
import { CommandMenu,ShortcutsModal } from './components/CommandMenu'
import { AttentionQueue } from './components/AttentionQueue'
import { Quotes } from './components/Quotes'
import { ClientPortal } from './components/ClientPortal'

const sampleBusiness: Business = {
  name: 'Acme Studio Ltd',
  email: 'hello@acmestudio.example',
  address: '12 Studio Walk\nLondon EC1A 1BB\nUnited Kingdom',
  bank: 'Bank: Example Bank UK\nAccount: 12345678\nSort Code: 00-11-22',
  currency: 'GBP',
  terms: 14,
  prefix: 'INV',
  accent: '#7c3aed',
  template: 'studio',
  timezone: 'Europe/London',
  autoReminders: false,
  taxId: 'GB123456789',
  footer: 'Thank you for your business. Payment is due within 14 days.',
  logo: '',
  onboardingDismissed: false,
};

const sampleClient: Client = {
  id: 'sample-client-id',
  name: 'Globex Corporation',
  contact: 'Arthur Dent',
  phone: '+44 161 496 0123',
  email: 'accounts@globex.example',
  country: 'United Kingdom',
  addressLine1: '45 Innovation Way',
  addressLine2: 'Tech Park, Floor 3',
  city: 'Manchester',
  state: 'Greater Manchester',
  postalCode: 'M1 2AB',
  taxId: 'GB987654321',
  address: '45 Innovation Way\nTech Park, Floor 3\nManchester, Greater Manchester, M1 2AB\nUnited Kingdom',
  cc: [],
  replyTo: '',
  terms: 14,
  notes: 'Sample client for preview purposes only.',
  currency: 'GBP',
  template: 'studio',
};

const sampleInvoice: Invoice = {
  id: 'sample-invoice-id',
  number: 'INV-2026-0001',
  lifecycle: 'issued',
  archived: false,
  clientId: sampleClient.id,
  projectId: '',
  client: sampleClient,
  issueDate: '2026-09-12',
  dueDate: '2026-09-26',
  terms: 14,
  manualDue: false,
  currency: 'GBP',
  lines: [
    { id: 'sample-line-1', description: 'Brand Identity & Design System', quantity: '1', rate: '2400.00', unit: 'fixed', group: 'Design' },
    { id: 'sample-line-2', description: 'Interactive Frontend Development', quantity: '35', rate: '85.00', unit: 'hour', group: 'Engineering' },
    { id: 'sample-line-3', description: 'Deployment & Domain Configuration', quantity: '1', rate: '450.00', unit: 'fixed', group: 'Infrastructure' },
  ],
  tax: '20',
  discount: '0',
  discountType: 'amount',
  deposit: '0',
  notes: 'Sample invoice preview for reference only.',
  po: 'PO-9842',
  reference: 'INV-2026-0001',
  breakdown: '',
  instalments: [],
  template: 'studio',
  accent: '#7c3aed',
  payments: [],
  created: '2026-09-12T10:00:00.000Z',
  updated: '2026-09-12T10:00:00.000Z',
  issuedAt: '2026-09-12T10:00:00.000Z',
  business: sampleBusiness,
  reminder: { enabled: false, days: 7, lastDate: '' },
};

interface SavedView {
  id: string
  name: string
  filter: string
  client?: string
  project?: string
}

export function App(){const store=useWorkspace();const [view,setView]=useState('Invoices');const [selected,setSelected]=useState('');const [query,setQuery]=useState('');const [filter,setFilter]=useState('all');const [client,setClient]=useState('');const [project,setProject]=useState('');const [from,setFrom]=useState('');const [to,setTo]=useState('');const [archived,setArchived]=useState(false);const [page,setPage]=useState(0);const [action,setAction]=useState<{name:string;invoice:Invoice}|null>(null);const [notice,setNotice]=useState('');const [undo,setUndo]=useState<Invoice|null>(null);const [theme,setTheme]=useState(localStorage.getItem('invoiceui:theme')||'system');const [email,setEmail]=useState('');const [signing,setSigning]=useState(false);const [refreshKey,setRefreshKey]=useState(0);const [sampleModalOpen,setSampleModalOpen]=useState(false);const [commandOpen,setCommandOpen]=useState(false);const [shortcutsOpen,setShortcutsOpen]=useState(false);const [selectedIds,setSelectedIds]=useState<Set<string>>(new Set());const [saveViewModalOpen,setSaveViewModalOpen]=useState(false);const [newViewName,setNewViewName]=useState('');const [savedViews,setSavedViews]=useState<SavedView[]>(()=>{try{return JSON.parse(localStorage.getItem('invoiceui:saved-views')||'[]')}catch{return []}});const [bulkResult,setBulkResult]=useState<{title:string;items:{id:string;name:string;status:'success'|'skipped'|'failed';reason?:string}[]}|null>(null);
 const [overviewPeriod, setOverviewPeriod] = useState<OverviewPeriod>(() => {
  try {
   const saved = localStorage.getItem('invoiceui:overview-period') as OverviewPeriod;
   return saved && ['all', 'this-month', 'last-month', 'this-quarter', 'this-year', 'custom'].includes(saved) ? saved : 'all';
  } catch {
   return 'all';
  }
 });
 const [customPeriodStart, setCustomPeriodStart] = useState<string>(() => {
  try {
   return localStorage.getItem('invoiceui:overview-from') || '';
  } catch {
   return '';
  }
 });
 const [customPeriodEnd, setCustomPeriodEnd] = useState<string>(() => {
  try {
   return localStorage.getItem('invoiceui:overview-to') || '';
  } catch {
   return '';
  }
 });
 const [selectedCurrency, setSelectedCurrency] = useState<string>('');
 const [swUpdateWorker, setSwUpdateWorker] = useState<ServiceWorker | null>(null);
 const [viewingPortalToken, setViewingPortalToken] = useState<string | null>(() => {
   if (typeof window === 'undefined') return null;
   const p = new URLSearchParams(window.location.search);
   return p.get('portal') === 'true' && p.get('token') ? p.get('token') : null;
 });
 const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
 const [newProfileModalOpen, setNewProfileModalOpen] = useState(false);
 const [newProfileName, setNewProfileName] = useState('');
 const [newProfileCurrency, setNewProfileCurrency] = useState<Business['currency']>('GBP');
 const [newProfilePrefix, setNewProfilePrefix] = useState('INV');
 const [newProfileAccent, setNewProfileAccent] = useState('#863bff');
 const [newProfileTemplate, setNewProfileTemplate] = useState<Business['template']>('studio');

 useEffect(() => {
   const handleSwUpdate = (e: Event) => {
     const custom = e as CustomEvent<{ registration: ServiceWorkerRegistration; worker: ServiceWorker }>;
     if (custom.detail?.worker) {
       setSwUpdateWorker(custom.detail.worker);
     }
   };
   window.addEventListener('invoiceui:sw-update', handleSwUpdate);
   return () => window.removeEventListener('invoiceui:sw-update', handleSwUpdate);
 }, []);
 const w=store.envelope?.data;
 useEffect(()=>{localStorage.setItem('invoiceui:theme',theme);const match=window.matchMedia('(prefers-color-scheme: dark)');const apply=()=>document.documentElement.dataset.theme=theme==='system'?(match.matches?'dark':'light'):theme;apply();match.addEventListener('change',apply);return()=>match.removeEventListener('change',apply)},[theme]);
 const toggleTheme=()=>{setTheme(t=>t==='dark'?'light':'dark')};
 useEffect(()=>{if(typeof window==='undefined')return;const p=new URLSearchParams(window.location.search);const v=p.get('view');if(v&&['Invoices','Quotes','Attention','Clients','Projects','Services','Settings'].includes(v))setView(v);const f=p.get('filter');if(f)setFilter(f);const c=p.get('client');if(c)setClient(c);const pr=p.get('project');if(pr)setProject(pr);const fr=p.get('from');if(fr)setFrom(fr);const toDate=p.get('to');if(toDate)setTo(toDate);const pg=p.get('page');if(pg&&!isNaN(Number(pg)))setPage(Number(pg));const pPeriod=p.get('period') as OverviewPeriod;if(pPeriod&&['all','this-month','last-month','this-quarter','this-year','custom'].includes(pPeriod))setOverviewPeriod(pPeriod);const pFrom=p.get('periodFrom');if(pFrom)setCustomPeriodStart(pFrom);const pTo=p.get('periodTo');if(pTo)setCustomPeriodEnd(pTo)},[]);
 useEffect(()=>{if(typeof window==='undefined')return;const p=new URLSearchParams();if(view!=='Invoices')p.set('view',view);if(filter!=='all')p.set('filter',filter);if(client)p.set('client',client);if(project)p.set('project',project);if(from)p.set('from',from);if(to)p.set('to',to);if(overviewPeriod!=='all')p.set('period',overviewPeriod);if(overviewPeriod==='custom'){if(customPeriodStart)p.set('periodFrom',customPeriodStart);if(customPeriodEnd)p.set('periodTo',customPeriodEnd)}if(page>0)p.set('page',String(page));const qs=p.toString()?'?'+p.toString():window.location.pathname;window.history.replaceState(null,'',qs)},[view,filter,client,project,from,to,overviewPeriod,customPeriodStart,customPeriodEnd,page]);
 useEffect(()=>{if(typeof window==='undefined')return;const onPopState=()=>{const p=new URLSearchParams(window.location.search);setView(p.get('view')||'Invoices');setFilter(p.get('filter')||'all');setClient(p.get('client')||'');setProject(p.get('project')||'');setFrom(p.get('from')||'');setTo(p.get('to')||'');setPage(Number(p.get('page'))||0);const pPeriod=p.get('period') as OverviewPeriod;setOverviewPeriod(pPeriod&&['all','this-month','last-month','this-quarter','this-year','custom'].includes(pPeriod)?pPeriod:'all');setCustomPeriodStart(p.get('periodFrom')||'');setCustomPeriodEnd(p.get('periodTo')||'')};window.addEventListener('popstate',onPopState);return()=>window.removeEventListener('popstate',onPopState)},[]);
 const create=async()=>{if(!w)return;try{const i=newInvoice(w);await store.command({type:'draft',value:i});setSelected(i.id);setView('Editor')}catch(e){setNotice(e instanceof Error?e.message:'Could not create invoice')}};

 const createFor=async(clientId?:string,projectId?:string)=>{if(!w)return;try{const i=newInvoice(w);if(clientId){const c=w.clients.find(x=>x.id===clientId);if(c){i.clientId=c.id;i.client=structuredClone(c);i.terms=c.terms;i.dueDate=addDays(i.issueDate,c.terms)}}if(projectId)i.projectId=projectId;await store.command({type:'draft',value:i});setSelected(i.id);setView('Editor')}catch(e){setNotice(e instanceof Error?e.message:'Could not create invoice')}};
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.altKey&&e.key.toLowerCase()==='n'){e.preventDefault();void create()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setCommandOpen(v=>!v)}if(e.key==='?'){const el=document.activeElement as HTMLElement|null;if(!el||(el.tagName!=='INPUT'&&el.tagName!=='TEXTAREA'&&el.tagName!=='SELECT')){e.preventDefault();setShortcutsOpen(true)}}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[w]);
 useEffect(()=>{setPage(0);setSelectedIds(new Set())},[query,filter,client,project,from,to,archived]);
  const overviewReport = useMemo(() => {
    const targetW = w || emptyWorkspace();
    const overviewDay = today(targetW.business?.timezone || 'Europe/London');
    return calculateOverviewMetrics(targetW, {
      period: overviewPeriod,
      startDate: customPeriodStart,
      endDate: customPeriodEnd,
      asOfDate: overviewDay,
    });
  }, [w, overviewPeriod, customPeriodStart, customPeriodEnd]);
 async function download(i:Invoice,breakdown=false){if(!w)return;if(store.demo){const {renderPDF,filename}=await import('../shared/pdf');const font=new Uint8Array(await(await fetch('/fonts/NotoSans-Regular.ttf')).arrayBuffer());const bytes=await renderPDF(i,i.business??w.business,font,breakdown);downloadBlob(new Blob([new Uint8Array(bytes)],{type:'application/pdf'}),filename(i,breakdown))}else{const response=await fetch(`/api/private/invoices/${i.id}/pdf?breakdown=${breakdown}`);if(!response.ok)throw new Error('Could not download the document');const {filename}=await import('../shared/pdf');downloadBlob(await response.blob(),filename(i,breakdown))}}
 async function exportData(zip:boolean){if(!w)return;try{setNotice('Preparing your export…');if(store.demo){const backup={format:'invoiceui-backup',schemaVersion:1,exportedAt:new Date().toISOString(),...store.envelope};if(zip){const {zipSync,strToU8}=await import('fflate');const {renderPDF,filename}=await import('../shared/pdf');const font=new Uint8Array(await(await fetch('/fonts/NotoSans-Regular.ttf')).arrayBuffer());const files:Record<string,Uint8Array>={'workspace.json':strToU8(JSON.stringify(backup,null,2))};for(const i of w.invoices.filter(i=>i.issuedAt)){files[`${i.id}/${filename(i)}`]=await renderPDF(i,i.business??w.business,font);if(i.breakdown)files[`${i.id}/${filename(i,true)}`]=await renderPDF(i,i.business??w.business,font,true)}downloadBlob(new Blob([new Uint8Array(zipSync(files))]),'InvoiceUI-backup.zip')}else downloadBlob(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),'InvoiceUI-backup.json')}else{const response=await fetch('/api/private/export?format='+(zip?'zip':'json'));if(!response.ok)throw new Error('Export could not be created');downloadBlob(await response.blob(),`InvoiceUI-backup.${zip?'zip':'json'}`)}setNotice('Export downloaded.')}catch(e){setNotice(e instanceof Error?e.message:'Export failed')}}
 async function doAction(name:string,i:Invoice){try{if(name==='duplicate'){const id=crypto.randomUUID();await store.command({type:'duplicate',id:i.id,newId:id});setSelected(id);setView('Editor');setNotice('Duplicated as a fresh draft.')}else if(name==='archive'){await store.command({type:'archive',id:i.id,value:!i.archived});setUndo(i);setNotice(i.archived?'Invoice restored.':'Invoice archived.');setView('Invoices')}else setAction({name,invoice:i})}catch(e){setNotice(e instanceof Error?e.message:'Action failed')}}
 const saveCustomView=()=>{if(!newViewName.trim())return;const nextView:SavedView={id:crypto.randomUUID(),name:newViewName.trim(),filter,client:client||undefined,project:project||undefined};const updated=[...savedViews,nextView];setSavedViews(updated);localStorage.setItem('invoiceui:saved-views',JSON.stringify(updated));setNewViewName('');setSaveViewModalOpen(false);setNotice(`Saved view "${nextView.name}" created.`)};
 const deleteCustomView=(id:string)=>{const updated=savedViews.filter(v=>v.id!==id);setSavedViews(updated);localStorage.setItem('invoiceui:saved-views',JSON.stringify(updated))};
 const applyView=(v:{filter:string;client?:string;project?:string})=>{setFilter(v.filter);setClient(v.client||'');setProject(v.project||'')};

 async function downloadSelectedZip(invoicesToDownload:Invoice[]){if(!w||!invoicesToDownload.length)return;try{setNotice('Preparing ZIP download…');const {zipSync,strToU8}=await import('fflate');const {renderPDF,filename}=await import('../shared/pdf');const font=new Uint8Array(await(await fetch('/fonts/NotoSans-Regular.ttf')).arrayBuffer());const files:Record<string,Uint8Array>={};const items:{id:string;name:string;status:'success'|'skipped'|'failed';reason?:string}[]=[];for(const inv of invoicesToDownload){const label=inv.number||`Draft (${inv.client.name||'Client'})`;if(inv.lifecycle!=='issued'){items.push({id:inv.id,name:label,status:'skipped',reason:'Draft invoices do not have issued PDFs'});continue}try{const pdfBytes=await renderPDF(inv,inv.business??w.business,font);files[`${filename(inv)}`]=new Uint8Array(pdfBytes);items.push({id:inv.id,name:label,status:'success'})}catch(err){items.push({id:inv.id,name:label,status:'failed',reason:err instanceof Error?err.message:'Render error'})}}if(Object.keys(files).length>0){const zipped=zipSync(files);downloadBlob(new Blob([new Uint8Array(zipped)],{type:'application/zip'}),'InvoiceUI-selected.zip')}setBulkResult({title:'PDF ZIP download results',items});setSelectedIds(new Set())}catch(e){setNotice(e instanceof Error?e.message:'Bulk PDF download failed')}}
 function exportSelectedCsv(invoicesToExport:Invoice[]){if(!invoicesToExport.length)return;const header='Invoice Number,Client,Issue Date,Due Date,Status,Currency,Total,Paid,Balance\n';const rows=invoicesToExport.map(i=>{const t=totals(i);const s=status(i);return `"${i.number||'Draft'}","${i.client.name.replace(/"/g,'""')}","${i.issueDate}","${i.dueDate}","${s}","${i.currency}","${t.total}","${t.paid}","${t.balance}"`}).join('\n');downloadBlob(new Blob([header+rows],{type:'text/csv'}),'InvoiceUI-selected.csv');setNotice(`Exported ${invoicesToExport.length} invoices to CSV.`);setSelectedIds(new Set())}
 async function bulkArchive(targetValue:boolean,invoicesToArchive:Invoice[]){if(!w||!invoicesToArchive.length)return;const items:{id:string;name:string;status:'success'|'skipped'|'failed';reason?:string}[]=[];for(const inv of invoicesToArchive){const label=inv.number||`Draft (${inv.client.name||'Client'})`;try{await store.command({type:'archive',id:inv.id,value:targetValue});items.push({id:inv.id,name:label,status:'success'})}catch(err){items.push({id:inv.id,name:label,status:'failed',reason:err instanceof Error?err.message:'Archive failed'})}}setBulkResult({title:targetValue?'Bulk archive results':'Bulk restore results',items});setSelectedIds(new Set())}

 if (viewingPortalToken) {
   return (
     <ClientPortal
       owner={store.owner || 'owner'}
       token={viewingPortalToken}
       onClose={() => {
         setViewingPortalToken(null)
         const p = new URLSearchParams(window.location.search)
         p.delete('portal')
         p.delete('token')
         const qs = p.toString() ? '?' + p.toString() : window.location.pathname
         window.history.replaceState(null, '', qs)
       }}
     />
   )
 }

 if(store.loading)return <div className="login"><div className="brand-mark pulse">▤</div><p>Opening your workspace…</p></div>;
 if(!w)return <MotionConfig reducedMotion="user"><main className="login"><motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="login-card"><div className="brand-mark">▤</div><p className="eyebrow mt-6">InvoiceUI</p><h1>A little less admin.<br/>A lot more headspace.</h1><p className="muted">Your private workspace for beautiful invoices.</p><form onSubmit={e=>{e.preventDefault();setSigning(true);setNotice('');void api('/api/auth/sign-in/magic-link',{method:'POST',body:JSON.stringify({email,callbackURL:window.location.origin})}).then(()=>setNotice('Check your inbox for your sign-in link.')).catch(e=>setNotice(e.message)).finally(()=>setSigning(false))}}><label className="field mt-6"><span>Email address</span><input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><Button variant="primary" className="w-full mt-3" type="submit" disabled={signing||!store.config.configured||!store.config.emailEnabled}>{signing?'Sending link…':'Email me a sign-in link →'}</Button></form>{(!store.config.configured||!store.config.emailEnabled)&&<p className="notice mt-4">Your workspace is awaiting its database and email connection.</p>}{(notice||store.error)&&<p className="alert mt-3" role="status">{notice||store.error}</p>}{import.meta.env.DEV&&<Button className="w-full mt-4" onClick={store.startDemo}>Open local preview</Button>}<p className="fine-print mt-5">Private access · No passwords to remember</p></motion.div></main></MotionConfig>;
 const invoice=w.invoices.find(i=>i.id===selected);const day=today(w.business.timezone);
 const activeCurrency=selectedCurrency&&overviewReport.currencies[selectedCurrency]?selectedCurrency:(w.business.currency&&overviewReport.currencies[w.business.currency]?w.business.currency:overviewReport.allCurrencies[0]||'GBP');
 const curMetrics=overviewReport.currencies[activeCurrency]||{currency:activeCurrency,invoiced:{amount:'0.00',count:0,invoiceIds:[]},cashReceived:{amount:'0.00',count:0,invoiceIds:[]},outstanding:{amount:'0.00',count:0,invoiceIds:[]},dueSoon:{amount:'0.00',count:0,invoiceIds:[]},overdue:{amount:'0.00',count:0,invoiceIds:[]},ageing:{'1-30':{key:'1-30' as const,label:'1-30 days',count:0,amount:'0.00',invoiceIds:[]},'31-60':{key:'31-60' as const,label:'31-60 days',count:0,amount:'0.00',invoiceIds:[]},'61-90':{key:'61-90' as const,label:'61-90 days',count:0,amount:'0.00',invoiceIds:[]},'91+':{key:'91+' as const,label:'91+ days',count:0,amount:'0.00',invoiceIds:[]}}};

 const handleSwitchProfile = async (profileId: string) => {
   if (!w) return
   if (w.activeProfileId === profileId) {
     setProfileDropdownOpen(false)
     return
   }
   if (view === 'Editor') {
     const confirmSwitch = window.confirm(
       'You are currently in the invoice editor. Switching profiles will close the editor. Unsaved draft edits are kept in local recovery storage. Continue?'
     )
     if (!confirmSwitch) {
       setProfileDropdownOpen(false)
       return
     }
   }
   try {
     await store.command({ type: 'switchBusinessProfile', profileId })
     setSelected('')
     setView('Invoices')
     setClient('')
     setProject('')
     setSelectedIds(new Set())
     setFilter('all')
     setQuery('')
     setPage(0)
     setProfileDropdownOpen(false)
     const targetProf = (w.profiles || []).find(p => p.id === profileId)
     setNotice(`Switched to business profile "${targetProf?.name || 'Profile'}".`)
   } catch (e) {
     setNotice(e instanceof Error ? e.message : 'Could not switch profile')
   }
 }

 const handleCreateProfile = async (e: React.FormEvent) => {
   e.preventDefault()
   if (!w || !newProfileName.trim()) return
   try {
     const newId = crypto.randomUUID()
     await store.command({
       type: 'createBusinessProfile',
       value: {
         id: newId,
         name: newProfileName.trim(),
         business: {
           ...structuredClone(w.business),
           name: newProfileName.trim(),
           currency: newProfileCurrency,
           prefix: newProfilePrefix.trim() || 'INV',
           accent: newProfileAccent,
           template: newProfileTemplate,
         },
         switchImmediately: true,
       },
     })
     setSelected('')
     setView('Invoices')
     setClient('')
     setProject('')
     setSelectedIds(new Set())
     setFilter('all')
     setQuery('')
     setPage(0)
     setNewProfileModalOpen(false)
     setProfileDropdownOpen(false)
     setNewProfileName('')
     setNotice(`Created and switched to profile "${newProfileName.trim()}".`)
   } catch (err) {
     setNotice(err instanceof Error ? err.message : 'Could not create profile')
   }
 }

 const attentionCount = w ? getAttentionQueueItems(w).length : 0

 const matches=w.invoices.filter(i=>{if(i.archived!==archived)return false;if(client&&i.clientId!==client)return false;if(project&&i.projectId!==project)return false;if(from&&i.issueDate<from)return false;if(to&&i.issueDate>to)return false;const t=totals(i,w.creditNotes);const bal=Number(t.balance);const paid=Number(t.paid);if(filter!=='all'){if(filter==='draft'||filter==='void'){if(i.lifecycle!==filter)return false}else if(filter==='issued'){if(i.lifecycle!=='issued')return false}else if(filter==='invoiced'){if(i.lifecycle!=='issued')return false;if(overviewReport.startDate&&i.issueDate<overviewReport.startDate)return false;if(overviewReport.endDate&&i.issueDate>overviewReport.endDate)return false}else if(filter==='received'){if(i.lifecycle!=='issued')return false;const hasPayment=(i.payments||[]).some(p=>{if(p.reversed)return false;if(overviewReport.startDate&&p.date<overviewReport.startDate)return false;if(overviewReport.endDate&&p.date>overviewReport.endDate)return false;return true});if(!hasPayment&&paid<=0)return false}else if(filter==='outstanding'){if(i.lifecycle!=='issued'||bal<=0)return false;if(overviewPeriod!=='all'){if(overviewReport.startDate&&i.issueDate<overviewReport.startDate)return false;if(overviewReport.endDate&&i.issueDate>overviewReport.endDate)return false}}else if(filter==='unpaid'){if(i.lifecycle!=='issued'||bal<=0||paid>0)return false}else if(filter==='partially paid'){if(i.lifecycle!=='issued'||bal<=0||paid<=0)return false}else if(filter==='paid'){if(i.lifecycle!=='issued'||bal>0)return false}else if(filter==='overdue'){if(i.lifecycle!=='issued'||bal<=0||i.dueDate>=day)return false}else if(filter==='due-soon'){const week=addDays(day,7);if(i.lifecycle!=='issued'||bal<=0||i.dueDate<day||i.dueDate>week)return false}else if(filter==='ageing-1-30'){if(i.lifecycle!=='issued'||bal<=0||i.dueDate>=day)return false;const days=diffDays(day,i.dueDate);if(days<1||days>30)return false}else if(filter==='ageing-31-60'){if(i.lifecycle!=='issued'||bal<=0||i.dueDate>=day)return false;const days=diffDays(day,i.dueDate);if(days<31||days>60)return false}else if(filter==='ageing-61-90'){if(i.lifecycle!=='issued'||bal<=0||i.dueDate>=day)return false;const days=diffDays(day,i.dueDate);if(days<61||days>90)return false}else if(filter==='ageing-91+'){if(i.lifecycle!=='issued'||bal<=0||i.dueDate>=day)return false;const days=diffDays(day,i.dueDate);if(days<91)return false}else if(status(i,day,w.creditNotes)!==filter)return false}return `${i.number} ${i.client.name} ${w.projects.find(p=>p.id===i.projectId)?.name||''}`.toLowerCase().includes(query.toLowerCase())}).sort((a,b)=>b.updated.localeCompare(a.updated));

 const hasBusiness=Boolean(w.business.name.trim()&&w.business.address.trim());
 const hasBank=Boolean(w.business.bank.trim());
 const hasClient=w.clients.length>0;
 const hasInvoice=w.invoices.length>0;
 const setupSteps=[
  {id:'business',label:'Business identity',done:hasBusiness,action:()=>setView('Settings'),actionLabel:hasBusiness?'Edit business':'Add business'},
  {id:'bank',label:'Bank instructions',done:hasBank,action:()=>setView('Settings'),actionLabel:hasBank?'Edit bank':'Add bank'},
  {id:'client',label:'First client',done:hasClient,action:()=>setView('Clients'),actionLabel:hasClient?'View clients':'Add client'},
  {id:'invoice',label:'First invoice',done:hasInvoice,action:()=>void create(),actionLabel:hasInvoice?'Open invoice':'Create draft'}
 ];
 const completedSteps=setupSteps.filter(s=>s.done).length;
 const setupComplete=completedSteps===setupSteps.length;
 const showOnboarding=!w.business.onboardingDismissed&&!setupComplete;

 const pageItems=matches.slice(page*15,page*15+15);
 const allPageSelected=pageItems.length>0&&pageItems.every(i=>selectedIds.has(i.id));
 const toggleSelectAllPage=()=>{if(allPageSelected){const next=new Set(selectedIds);pageItems.forEach(i=>next.delete(i.id));setSelectedIds(next)}else{const next=new Set(selectedIds);pageItems.forEach(i=>next.add(i.id));setSelectedIds(next)}};
 const toggleSelectOne=(id:string)=>{const next=new Set(selectedIds);if(next.has(id))next.delete(id);else next.add(id);setSelectedIds(next)};
 const selectedInvoices=w.invoices.filter(i=>selectedIds.has(i.id));

 return <MotionConfig reducedMotion="user"><div className="app-shell">{swUpdateWorker && (
   <div className="update-banner" role="status" aria-live="polite">
     <div className="flex items-center gap-2">
       <span aria-hidden="true">🚀</span>
       <span>A new version of InvoiceUI is available. Updating now preserves your unsaved drafts.</span>
     </div>
     <div className="update-banner-actions">
       <button
         type="button"
         className="update-btn"
         onClick={() => {
           swUpdateWorker.postMessage({ type: 'SKIP_WAITING' })
           window.location.reload()
         }}
       >
         Update now
       </button>
       <button
         type="button"
         className="button ghost text-xs py-1 px-2"
         onClick={() => setSwUpdateWorker(null)}
       >
         Later
       </button>
     </div>
   </div>
 )}<header className="app-header"><div className="flex items-center gap-3"><button className="app-brand" onClick={()=>setView('Invoices')}><span>▤</span> InvoiceUI</button><div className="profile-switcher-container"><button type="button" className="profile-switcher-btn" onClick={()=>setProfileDropdownOpen(o=>!o)} aria-label="Switch business profile" title="Switch business profile"><span className="profile-dot" style={{backgroundColor:w.business.accent||'#863bff'}}/><span className="profile-name">{w.business.name||'Personal Workspace'}</span><span className="text-[10px] opacity-60">▼</span></button>{profileDropdownOpen&&<div className="profile-dropdown-menu"><div className="profile-dropdown-header">Trading Profiles</div>{(w.profiles||[]).map(p=>{const isCurrent=p.id===w.activeProfileId;return <button key={p.id} type="button" className={`profile-dropdown-item ${isCurrent?'active':''}`} onClick={()=>void handleSwitchProfile(p.id)}><span className="profile-dot" style={{backgroundColor:p.business.accent||'#863bff'}}/><span className="flex-1 truncate">{p.name}</span>{p.isDefault&&<span className="text-[9px] opacity-50 uppercase">Default</span>}{isCurrent&&<span className="text-xs">✓</span>}</button>})}<div className="profile-dropdown-divider"/><button type="button" className="profile-dropdown-item new-profile" onClick={()=>{setProfileDropdownOpen(false);setNewProfileModalOpen(true)}}><span>+</span><span>New business profile</span></button></div>}</div></div><AnimatedTabs tabs={['Invoices','Quotes','Attention','Clients','Projects','Services','Settings']} activeTab={view==='Editor'?'Invoices':view} onTabChange={tab=>{setView(tab);setNotice('')}}/><div className="header-actions"><button type="button" className="button ghost text-xs flex items-center gap-1.5" onClick={()=>setCommandOpen(true)} title="Global command palette (Ctrl+K)"><Search size={13} animateOnHover /><span>Search</span><span className="command-shortcut">Ctrl K</span></button><select aria-label="Editor theme" value={theme} onChange={e=>setTheme(e.target.value)}><option value="system">◐ System</option><option value="light">☀ Light</option><option value="dark">☾ Dark</option></select><Button variant="ghost" onClick={()=>void store.refresh().then(()=>{setRefreshKey(k=>k+1);setNotice('Workspace refreshed. Unsaved edits are kept for recovery.')}).catch(e=>setNotice(e.message))}><RefreshCw size={12} animateOnHover className="mr-1 inline" />Refresh</Button><Button variant="ghost" onClick={()=>void store.logout().catch(e=>setNotice(e.message))}>Sign out</Button></div></header>{store.demo&&<div className="demo-banner">Local preview · saved in this browser · email and public links are unavailable</div>}<main className="workspace-main">{notice&&<div className="toast" role="status"><span>{notice}</span><div className="actions">{undo&&<Button onClick={()=>void store.command({type:'archive',id:undo.id,value:undo.archived}).then(()=>{setUndo(null);setNotice('Archive action undone.')})}>Undo</Button>}<Button variant="ghost" aria-label="Dismiss notification" onClick={()=>{setNotice('');setUndo(null)}}>×</Button></div></div>}
   {view==='Invoices'&&<><div className="page-heading"><div><p className="eyebrow">A clearer picture</p><h1>Your work. Well accounted for.</h1><p className="muted">Create, send and keep track of every invoice.</p></div><div className="flex items-center gap-2">{!showOnboarding&&!setupComplete&&<Button variant="ghost" className="text-xs" onClick={()=>void store.command({type:'dismissOnboarding',dismissed:false})}>Resume setup guide</Button>}<Button variant="primary" onClick={()=>void create()}><Plus size={13} animateOnHover className="mr-1 inline" />New invoice</Button></div></div>
  {showOnboarding&&<div className="onboarding-card" role="region" aria-label="First-invoice setup checklist"><div className="flex justify-between items-start gap-4 flex-wrap"><div><div className="flex items-center gap-2"><span className="eyebrow">Guided setup</span><span className="group-badge">{completedSteps} of 4 complete</span></div><h2 className="text-lg font-semibold mt-1">Get ready for your first invoice</h2><p className="muted text-sm mt-0.5">Set up your business identity, bank instructions and first client. Progress is saved automatically.</p></div><div className="flex items-center gap-2"><Button variant="secondary" onClick={()=>setSampleModalOpen(true)}>Preview sample invoice</Button><Button variant="ghost" onClick={()=>void store.command({type:'dismissOnboarding',dismissed:true})}>Dismiss</Button></div></div><div className="onboarding-steps">{setupSteps.map(s=><div key={s.id} className={`onboarding-step ${s.done?'complete':''}`}><div><div className="flex items-center justify-between"><span className="text-xs font-semibold text-[var(--muted)]">{s.done?'✓ Completed':'To do'}</span></div><p className="font-medium text-sm mt-1">{s.label}</p></div><Button variant={s.done?'ghost':'secondary'} className="text-xs w-full mt-2" onClick={s.action}>{s.actionLabel} →</Button></div>)}</div></div>}
  <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Select overview period"><span className="text-xs font-semibold text-[var(--muted)] mr-1">Period:</span>{(['all','this-month','last-month','this-quarter','this-year','custom'] as const).map(pKey=>{const labels:Record<typeof pKey,string>={all:'All time','this-month':'This month','last-month':'Last month','this-quarter':'This quarter','this-year':'This year',custom:'Custom'};const isActive=overviewPeriod===pKey;return <button key={pKey} type="button" className={`saved-view-chip ${isActive?'active':''}`} onClick={()=>{setOverviewPeriod(pKey);localStorage.setItem('invoiceui:overview-period',pKey)}}>{labels[pKey]}</button>})}</div>{overviewReport.allCurrencies.length>1&&<div className="flex items-center gap-1" role="group" aria-label="Select overview currency"><span className="text-xs font-semibold text-[var(--muted)] mr-1">Currency:</span>{overviewReport.allCurrencies.map(cur=><button key={cur} type="button" className={`saved-view-chip ${activeCurrency===cur?'active':''}`} onClick={()=>setSelectedCurrency(cur)}>{cur}</button>)}</div>}</div>
  {overviewPeriod==='custom'&&<div className="flex flex-wrap items-center gap-3 p-3 mb-4 rounded-xl bg-[var(--soft)] border border-[var(--line)]"><span className="text-xs font-medium text-[var(--muted)]">Custom date range:</span><label className="flex items-center gap-1.5 text-xs"><span>From</span><input type="date" className="px-2 py-1 text-xs rounded border border-[var(--line)] bg-[var(--card)]" value={customPeriodStart} onChange={e=>{setCustomPeriodStart(e.target.value);localStorage.setItem('invoiceui:overview-from',e.target.value)}}/></label><label className="flex items-center gap-1.5 text-xs"><span>To</span><input type="date" className="px-2 py-1 text-xs rounded border border-[var(--line)] bg-[var(--card)]" value={customPeriodEnd} onChange={e=>{setCustomPeriodEnd(e.target.value);localStorage.setItem('invoiceui:overview-to',e.target.value)}}/></label>{(customPeriodStart||customPeriodEnd)&&<Button variant="ghost" className="text-xs h-7 py-0 px-2" onClick={()=>{setCustomPeriodStart('');setCustomPeriodEnd('');localStorage.removeItem('invoiceui:overview-from');localStorage.removeItem('invoiceui:overview-to')}}>Clear dates</Button>}</div>}
  <div className="metrics-five">{[
   {key:'invoiced',label:'Invoiced (net)',filterKey:'invoiced',amount:curMetrics.invoiced.amount,count:curMetrics.invoiced.count,finePrint:'Billed to clients in period',countLabel:`${curMetrics.invoiced.count} ${curMetrics.invoiced.count===1?'invoice':'invoices'}`},
   {key:'cashReceived',label:'Cash received',filterKey:'received',amount:curMetrics.cashReceived.amount,count:curMetrics.cashReceived.count,finePrint:'Collected in bank in period',countLabel:`${curMetrics.cashReceived.count} ${curMetrics.cashReceived.count===1?'payment':'payments'}`},
   {key:'outstanding',label:'Outstanding',filterKey:'outstanding',amount:curMetrics.outstanding.amount,count:curMetrics.outstanding.count,finePrint:'Awaiting client settlement',countLabel:`${curMetrics.outstanding.count} ${curMetrics.outstanding.count===1?'invoice':'invoices'}`},
   {key:'dueSoon',label:'Due in 7 days',filterKey:'due-soon',amount:curMetrics.dueSoon.amount,count:curMetrics.dueSoon.count,finePrint:'Upcoming due dates',countLabel:`${curMetrics.dueSoon.count} ${curMetrics.dueSoon.count===1?'invoice':'invoices'}`},
   {key:'overdue',label:'Overdue',filterKey:'overdue',amount:curMetrics.overdue.amount,count:curMetrics.overdue.count,finePrint:'Past payment deadline',countLabel:`${curMetrics.overdue.count} ${curMetrics.overdue.count===1?'invoice':'invoices'}`}
  ].map(card=>{const activeMetric=filter===card.filterKey;return <div className={`metric transition-all ${activeMetric?'ring-2 ring-lime-500 bg-[var(--soft)]':''}`} style={{cursor:'pointer'}} key={card.key} role="button" tabIndex={0} onClick={()=>{if(activeMetric)setFilter('all');else{setFilter(card.filterKey);if(card.filterKey==='invoiced'&&overviewReport.startDate){setFrom(overviewReport.startDate);if(overviewReport.endDate)setTo(overviewReport.endDate)}}}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){if(activeMetric)setFilter('all');else{setFilter(card.filterKey);if(card.filterKey==='invoiced'&&overviewReport.startDate){setFrom(overviewReport.startDate);if(overviewReport.endDate)setTo(overviewReport.endDate)}}}}}><div className="flex justify-between items-center"><p className="eyebrow">{card.label}</p>{activeMetric&&<ShinyText className="text-[10px] uppercase font-bold">Active filter ×</ShinyText>}</div><p className="metric-value"><NumberTicker value={Number(card.amount)} currency={curMetrics.currency}/></p><div className="flex justify-between items-center mt-1 text-[var(--muted)]"><p className="fine-print">{card.finePrint}</p><span className="text-[11px] font-medium">{card.countLabel}</span></div></div>})}</div>
  <div className="ageing-panel"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold">Overdue Ageing</h2><p className="muted text-xs">Unpaid balances categorized by days past payment due date.</p></div><span className="text-xs text-[var(--muted)] font-medium">Total overdue: {curMetrics.overdue.count} {curMetrics.overdue.count===1?'invoice':'invoices'}</span></div><div className="ageing-strip">{(['1-30','31-60','61-90','91+'] as const).map(bKey=>{const b=curMetrics.ageing[bKey];const fKey=`ageing-${bKey}`;const isActive=filter===fKey;return <div key={bKey} role="button" tabIndex={0} className={`ageing-card ${isActive?'active':''}`} onClick={()=>setFilter(isActive?'all':fKey)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setFilter(isActive?'all':fKey)}}><div className="flex justify-between items-center"><span className="text-xs font-semibold text-[var(--ink)]">{b.label}</span>{isActive&&<ShinyText className="text-[10px] uppercase font-bold">Active ×</ShinyText>}</div><p className="ageing-amount"><NumberTicker value={Number(b.amount)} currency={curMetrics.currency}/></p><div className="flex justify-between items-center text-xs text-[var(--muted)]"><span>{b.count} {b.count===1?'invoice':'invoices'}</span><span className="text-[10px] uppercase font-medium tracking-wide">Filter</span></div></div>})}</div></div>

  <div className="saved-views-bar"><span className="text-xs font-semibold text-[var(--muted)] mr-1">Views:</span>{[{name:'All',filter:'all'},{name:'Outstanding',filter:'outstanding'},{name:'Due in 7 days',filter:'due-soon'},{name:'Overdue',filter:'overdue'},{name:'Unpaid',filter:'unpaid'},{name:'Drafts',filter:'draft'}].map(v=><button key={v.name} type="button" className={`saved-view-chip ${filter===v.filter&&!client&&!project?'active':''}`} onClick={()=>applyView(v)}>{v.name}</button>)}{savedViews.map(sv=><span key={sv.id} className={`saved-view-chip ${filter===sv.filter&&client===sv.client&&project===sv.project?'active':''}`} onClick={()=>applyView(sv)}>{sv.name}<button type="button" className="opacity-60 hover:opacity-100 text-xs ml-1" onClick={e=>{e.stopPropagation();deleteCustomView(sv.id)}} title="Delete saved view">×</button></span>)}<Button variant="ghost" className="text-xs h-7 py-0 px-2" onClick={()=>setSaveViewModalOpen(true)}>+ Save view</Button></div>
  <section className="panel invoice-list"><div className="list-toolbar"><input className="search" aria-label="Search invoices" placeholder="Search invoices, clients or projects…" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Filter invoice status" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="issued">All issued</option><option value="invoiced">Invoiced in period</option><option value="outstanding">Outstanding (unpaid balance)</option><option value="unpaid">Unpaid</option><option value="partially paid">Partially paid</option><option value="paid">Paid</option><option value="received">Payments received in period</option><option value="due-soon">Due in 7 days</option><option value="overdue">Overdue</option><option value="ageing-1-30">Overdue: 1-30 days</option><option value="ageing-31-60">Overdue: 31-60 days</option><option value="ageing-61-90">Overdue: 61-90 days</option><option value="ageing-91+">Overdue: 91+ days</option><option value="void">Void</option></select><label className="check"><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>Archived</label></div><details className="filter-details"><summary>Client, project & date filters</summary><div className="form-grid four"><select aria-label="Filter client" value={client} onChange={e=>setClient(e.target.value)}><option value="">All clients</option>{w.clients.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select><select aria-label="Filter project" value={project} onChange={e=>setProject(e.target.value)}><option value="">All projects</option>{w.projects.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select><input aria-label="From issue date" type="date" value={from} onChange={e=>setFrom(e.target.value)}/><input aria-label="To issue date" type="date" value={to} onChange={e=>setTo(e.target.value)}/></div><Button variant="ghost" onClick={()=>{setClient('');setProject('');setFrom('');setTo('');setFilter('all');setQuery('')}}>Clear filters</Button></details>{!matches.length?<Empty title={w.invoices.length?'No matching invoices':'Your first invoice starts here'} detail={w.invoices.length?'Try another search or clear your filters.':'Add your business details, then turn your work into a beautiful invoice.'} action={<Button onClick={()=>void create()}><Plus size={13} animateOnHover className="mr-1 inline" />Create invoice</Button>}/>:<><div className="table-scroll"><table className="dashboard-table"><thead><tr><th style={{width:'36px'}}><input type="checkbox" aria-label="Select all on this page" checked={allPageSelected} onChange={toggleSelectAllPage}/></th><th>Invoice / client</th><th>Status</th><th>Due</th><th>Total</th><th>Balance</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{pageItems.map(i=><tr key={i.id} className={selectedIds.has(i.id)?'bg-[var(--soft)]':''}><td><input type="checkbox" aria-label={`Select invoice ${i.number||'draft'}`} checked={selectedIds.has(i.id)} onChange={()=>toggleSelectOne(i.id)}/></td><td><button className="invoice-link" onClick={()=>{setSelected(i.id);setView('Editor')}}>{i.number||'Draft invoice'}</button><p className="muted">{i.client.name||'No client yet'}</p></td><td><Badge>{status(i,day,w.creditNotes)}</Badge></td><td>{i.dueDate}</td><td>{money(totals(i,w.creditNotes).total,i.currency)}</td><td>{i.lifecycle==='issued'?money(totals(i,w.creditNotes).balance,i.currency):'-'}</td><td><Button variant="ghost" aria-label={`Open ${i.number||'draft invoice'}`} onClick={()=>{setSelected(i.id);setView('Editor')}}><ExternalLink size={13} animateOnHover /></Button></td></tr>)}</tbody></table></div><div className="pagination"><span className="muted">{matches.length} invoices · Page {page+1}</span><div className="actions"><Button disabled={page===0} onClick={()=>setPage(p=>p-1)}><ArrowLeft size={12} animateOnHover className="mr-1 inline" />Previous</Button><Button disabled={(page+1)*15>=matches.length} onClick={()=>setPage(p=>p+1)}>Next<ArrowRight size={12} animateOnHover className="ml-1 inline" /></Button></div></div></>}</section></>}

  {view==='Quotes'&&w&&<Quotes workspace={w} onCommand={store.command} onSelectInvoice={id=>{setSelected(id);setView('Editor')}} setNotice={setNotice} demo={store.demo}/>}
  {view==='Attention'&&w&&<div className="panel space-y-4"><AttentionQueue workspace={w} onSelectInvoice={inv=>{setSelected(inv.id);setView('Editor')}} onAction={(act,inv)=>setAction({name:act,invoice:inv})} onCommand={store.command}/></div>}
  {view==='Editor'&&invoice&&<Editor key={`${invoice.id}-${invoice.lifecycle}-${refreshKey}`} invoice={invoice} workspace={w} owner={store.owner} onCommand={store.command} onDownload={download} onAction={(n,i)=>void doAction(n,i)}/>}
  {(['Clients','Projects','Services'] as const).map(kind=>view===kind&&<Records key={kind} kind={kind} workspace={w} owner={store.owner} onCommand={store.command} onFilter={(k,id)=>{setClient(k==='Clients'?id:'');setProject(k==='Projects'?id:'');setView('Invoices')}} onSelectInvoice={id=>{setSelected(id);setView('Editor')}} onCreateInvoice={createFor} onOpenPreview={token=>setViewingPortalToken(token)}/>)}
  {view==='Settings'&&<Settings key={refreshKey} workspace={w} onCommand={store.command} onExport={zip=>void exportData(zip)}/>}</main><footer className="app-footer">InvoiceUI · A little less admin <span>Search: Ctrl K · New: Ctrl Alt N · Save: Ctrl S · PDF: Ctrl Shift D</span></footer>{action&&<InvoiceActions key={action.name+'-'+action.invoice.id} action={action.name} invoice={action.invoice} workspace={w} owner={store.owner} demo={store.demo} emailEnabled={store.config.emailEnabled} onCommand={store.command} onClose={()=>setAction(null)}/>}{sampleModalOpen&&<Modal open={sampleModalOpen} onClose={()=>setSampleModalOpen(false)} title="Sample invoice preview" description="Example invoice preview for reference only - sample data is strictly isolated and never saved to your records."><div className="max-h-[70vh] overflow-y-auto p-4 bg-[var(--soft)] rounded-xl border border-[var(--line)]"><div className="p-3 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">Sample preview: This demonstrates how your finished documents and PDF exports will look once your business and client details are added. None of this sample data is saved into your workspace.</div><InvoicePreview invoice={sampleInvoice} business={sampleBusiness}/></div><div className="flex justify-end gap-2 mt-4"><Button variant="primary" onClick={()=>setSampleModalOpen(false)}>Close preview</Button></div></Modal>}
  {commandOpen&&<CommandMenu open={commandOpen} onClose={()=>setCommandOpen(false)} workspace={w} onSelectInvoice={id=>{setSelected(id);setView('Editor')}} onSelectClient={id=>{setClient(id);setView('Clients')}} onSelectProject={id=>{setProject(id);setView('Projects')}} onCreateInvoice={()=>void create()} onNavigate={v=>{setView(v);setNotice('')}} onExport={zip=>void exportData(zip)} onToggleTheme={toggleTheme} onOpenShortcuts={()=>setShortcutsOpen(true)}/>}
  {shortcutsOpen&&<ShortcutsModal open={shortcutsOpen} onClose={()=>setShortcutsOpen(false)}/>}
  {saveViewModalOpen&&<Modal open={saveViewModalOpen} onClose={()=>setSaveViewModalOpen(false)} title="Save current filter view" description="Save the active filter, client and project setup as a quick view on your toolbar."><div className="space-y-4"><label className="field"><span>View name</span><input autoFocus value={newViewName} onChange={e=>setNewViewName(e.target.value)} placeholder="e.g. Mentage overdue"/></label><div className="flex justify-end gap-2"><Button onClick={()=>setSaveViewModalOpen(false)}>Cancel</Button><Button variant="primary" disabled={!newViewName.trim()} onClick={saveCustomView}>Save view</Button></div></div></Modal>}
  {selectedIds.size>0&&<div className="bulk-action-bar" role="toolbar" aria-label="Bulk actions"><span className="bulk-counter">{selectedIds.size} selected</span><div className="bulk-actions-group"><Button onClick={()=>void downloadSelectedZip(selectedInvoices)}><Download size={13} animateOnHover className="mr-1.5 inline" />Download PDFs (ZIP)</Button><Button onClick={()=>exportSelectedCsv(selectedInvoices)}>Export CSV</Button><Button onClick={()=>void bulkArchive(!archived,selectedInvoices)}><Trash2 size={13} animateOnHover className="mr-1.5 inline" />{archived?'Restore selected':'Archive selected'}</Button><Button variant="ghost" onClick={()=>setSelectedIds(new Set())}>Deselect</Button></div></div>}
  {bulkResult&&<Modal open onClose={()=>setBulkResult(null)} title={bulkResult.title} description="Review execution results for the selected invoices."><div className="space-y-3"><div className="table-scroll max-h-60"><table className="dashboard-table"><thead><tr><th>Invoice</th><th>Result</th><th>Note</th></tr></thead><tbody>{bulkResult.items.map(item=><tr key={item.id}><td>{item.name}</td><td><Badge className={item.status}>{item.status}</Badge></td><td className="text-xs text-[var(--muted)]">{item.reason||'Completed'}</td></tr>)}</tbody></table></div><div className="flex justify-end"><Button variant="primary" onClick={()=>setBulkResult(null)}>Close</Button></div></div></Modal>}
  {newProfileModalOpen&&(
    <Modal open={newProfileModalOpen} onClose={()=>setNewProfileModalOpen(false)} title="Create business profile" description="Add another brand or trading identity with isolated settings, sequence numbers, clients and documents.">
      <form onSubmit={handleCreateProfile} className="space-y-4">
        <label className="field"><span>Profile / Brand Name</span><input required autoFocus value={newProfileName} onChange={e=>setNewProfileName(e.target.value)} placeholder="e.g. Acme Consultancy or Design Studio"/></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="field"><span>Default Currency</span><select value={newProfileCurrency} onChange={e=>setNewProfileCurrency(e.target.value as Business['currency'])}><option value="GBP">GBP (£)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option><option value="CAD">CAD ($)</option><option value="AUD">AUD ($)</option><option value="JPY">JPY (¥)</option><option value="KWD">KWD (KD)</option></select></label>
          <label className="field"><span>Invoice Prefix</span><input required pattern="^[A-Za-z0-9-]{1,20}$" value={newProfilePrefix} onChange={e=>setNewProfilePrefix(e.target.value.toUpperCase())} placeholder="e.g. ACM"/></label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="field"><span>Accent Color</span><div className="flex items-center gap-2"><input type="color" value={newProfileAccent} onChange={e=>setNewProfileAccent(e.target.value)} className="w-9 h-9 p-0.5 rounded cursor-pointer border border-[var(--line)]"/><input type="text" pattern="^#[0-9a-fA-F]{6}$" value={newProfileAccent} onChange={e=>setNewProfileAccent(e.target.value)} className="text-xs font-mono"/></div></label>
          <label className="field"><span>Template Style</span><select value={newProfileTemplate} onChange={e=>setNewProfileTemplate(e.target.value as Business['template'])}><option value="studio">Studio</option><option value="minimal">Minimal</option><option value="classic">Classic</option></select></label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={()=>setNewProfileModalOpen(false)}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={!newProfileName.trim()}>Create & switch profile</Button>
        </div>
      </form>
    </Modal>
  )}
  <nav className="mobile-nav-bar" aria-label="Mobile navigation">
    <button type="button" className={`mobile-nav-item ${view==='Invoices'||view==='Editor'?'active':''}`} onClick={()=>{setView('Invoices');setNotice('')}}>
      <span className="mobile-nav-icon">▤</span>
      <span className="mobile-nav-label">Invoices</span>
    </button>
    <button type="button" className={`mobile-nav-item ${view==='Quotes'?'active':''}`} onClick={()=>{setView('Quotes');setNotice('')}}>
      <span className="mobile-nav-icon">✦</span>
      <span className="mobile-nav-label">Quotes</span>
    </button>
    <button type="button" className={`mobile-nav-item ${view==='Attention'?'active':''}`} onClick={()=>{setView('Attention');setNotice('')}}>
      <span className="mobile-nav-icon">🔔</span>
      <span className="mobile-nav-label">Attention</span>
      {attentionCount>0&&<span className="mobile-nav-badge">{attentionCount}</span>}
    </button>
    <button type="button" className={`mobile-nav-item ${view==='Clients'?'active':''}`} onClick={()=>{setView('Clients');setNotice('')}}>
      <span className="mobile-nav-icon">👥</span>
      <span className="mobile-nav-label">Clients</span>
    </button>
    <button type="button" className={`mobile-nav-item ${view==='Settings'?'active':''}`} onClick={()=>{setView('Settings');setNotice('')}}>
      <span className="mobile-nav-icon">⚙</span>
      <span className="mobile-nav-label">Settings</span>
    </button>
  </nav></div></MotionConfig>
}
