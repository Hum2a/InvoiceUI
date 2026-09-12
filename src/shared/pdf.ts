import { PDFDocument, rgb, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import Decimal from 'decimal.js'
import { totals, money, precision, quoteTotals, formatClientAddressLines, formatAddress, type Business, type Invoice, type CreditNote, type Receipt, type ClientStatement, type Quote, type Client } from './domain'

function formatBusinessPdfLines(b: Business): string[] {
  return [formatAddress(b), b.email, b.taxId ? `Tax ID: ${b.taxId}` : ''].filter(Boolean)
}

function formatClientPdfLines(client: Partial<Client>): string[] {
  const lines: string[] = []
  if (client.contact?.trim()) lines.push(`Attn: ${client.contact.trim()}`)
  lines.push(...formatClientAddressLines(client))
  if (client.phone?.trim()) lines.push(`Tel: ${client.phone.trim()}`)
  if (client.email?.trim()) lines.push(client.email.trim())
  if (client.taxId?.trim()) lines.push(`Tax ID: ${client.taxId.trim()}`)
  return lines
}

export function filename(i:Invoice,breakdown=false){return `${i.number||'Draft'}-${i.client.name||'Invoice'}${breakdown?'-Breakdown':''}`.replace(/[^\p{L}\p{N}._-]+/gu,'-').slice(0,160)+'.pdf'}
export function filenameCreditNote(c:CreditNote){return `${c.number}-${c.client.name||'CreditNote'}`.replace(/[^\p{L}\p{N}._-]+/gu,'-').slice(0,160)+'.pdf'}
export function filenameReceipt(r:Receipt){return `${r.number}-${r.client.name||'Receipt'}${r.reversed?'-REVERSED':''}`.replace(/[^\p{L}\p{N}._-]+/gu,'-').slice(0,160)+'.pdf'}
export function filenameStatement(s:ClientStatement){return `Statement-${s.client.name||'Client'}-${s.startDate}-to-${s.endDate}`.replace(/[^\p{L}\p{N}._-]+/gu,'-').slice(0,160)+'.pdf'}
export function filenameQuote(q:Quote){return `${q.quoteNumber}-Rev${q.revision}-${q.client.name||'Quote'}`.replace(/[^\p{L}\p{N}._-]+/gu,'-').slice(0,160)+'.pdf'}

export async function renderPDF(invoice:Invoice,currentBusiness:Business,fontBytes:Uint8Array,breakdown=false):Promise<Uint8Array>{
 const b=invoice.business??currentBusiness;const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);const font=await pdf.embedFont(fontBytes,{subset:true});const ink=rgb(.1,.1,.12);const grey=rgb(.43,.43,.47);const pale=rgb(.97,.97,.96);const accent=rgb(...([1,3,5].map(x=>parseInt(invoice.accent.slice(x,x+2),16)/255) as [number,number,number]));let page!:PDFPage;let y=0;const pages:PDFPage[]=[];const width=595.28;const height=841.89;const margin=45;
 const newPage=()=>{page=pdf.addPage([width,height]);pages.push(page);y=height-50;page.drawText(`${b.name||'Your business'}  /  ${invoice.number||'DRAFT'}${invoice.lifecycle==='void'?' · VOID':''}`,{x:margin,y,font,size:9,color:grey});y-=35;};newPage();
 const wrap=(input:string,max:number,size=10)=>{const out:string[]=[];for(const paragraph of input.replace(/\r/g,'').split('\n')){let line='';for(const char of paragraph){if(font.widthOfTextAtSize(line+char,size)>max&&line){out.push(line);line=char}else line+=char}out.push(line)}return out};
 const ensure=(n:number)=>{if(y-n<55)newPage()};
 const text=(value:string,size=10,max=width-margin*2,color=ink)=>{for(const line of wrap(value,max,size)){ensure(size+6);page.drawText(line,{x:margin,y,font,size,color});y-=size+6}};
 const pair=(label:string,value:string,strong=false)=>{ensure(25);page.drawText(label,{x:330,y,font,size:strong?13:10,color:strong?ink:grey});page.drawText(value,{x:width-margin-font.widthOfTextAtSize(value,strong?13:10),y,font,size:strong?13:10,color:ink});y-=25};
 if(invoice.template==='studio'){page!.drawRectangle({x:margin,y:y-8,width:40,height:40,color:accent});page!.drawText('✦'.replace('✦','+'),{x:margin+13,y:y+4,font,size:20,color:ink});y-=40}
 text(breakdown?'WORK BREAKDOWN':'INVOICE',30);
 if(invoice.lifecycle==='void'){text(`${invoice.number||'DRAFT'} · VOID`,12,500,rgb(.8,0,0));y-=12}
 else{text(invoice.number||'DRAFT · Not issued',11,500,grey);y-=12}
 if(b.logo){try{const bytes=Uint8Array.from(atob(b.logo.split(',')[1]),c=>c.charCodeAt(0));const image=b.logo.startsWith('data:image/png')?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);const scale=Math.min(70/image.width,45/image.height);page!.drawImage(image,{x:width-margin-image.width*scale,y:height-125,width:image.width*scale,height:image.height*scale})}catch{throw new Error('The saved logo could not be rendered. Use a valid PNG or JPEG.')}}
 text(b.name||'Your business',12);text(formatBusinessPdfLines(b).join('\n'),9,480,grey);y-=18;text('BILLED TO',9,500,grey);text(invoice.client.name||'Client name',12);text(formatClientPdfLines(invoice.client).join('\n'),9,480,grey);y-=12;text(`Issued: ${invoice.issueDate}     Due: ${invoice.dueDate}`,10);if(invoice.po)text(`Purchase order: ${invoice.po}`,9);if(invoice.reference)text(`Reference: ${invoice.reference}`,9);y-=18;
 if(breakdown){text(invoice.breakdown||'No additional breakdown supplied.',10)}else{
 const header=()=>{ensure(35);page.drawRectangle({x:margin,y:y-7,width:width-margin*2,height:25,color:invoice.template==='classic'?accent:pale});for(const [label,x] of [['Description',margin+8],['Qty',335],['Rate',390],['Amount',470]] as const)page.drawText(label,{x,y,font,size:9,color:invoice.template==='classic'?ink:grey});y-=30};header();const t=totals(invoice);
 for(let idx=0;idx<invoice.lines.length;idx++){const line=invoice.lines[idx];if(line.group&&(idx===0||line.group!==invoice.lines[idx-1].group)){if(y<85){newPage();header()}page.drawText(line.group.toUpperCase(),{x:margin+8,y,font,size:8.5,color:grey});y-=16}const description=wrap(line.description||'Untitled service',265,10);for(let n=0;n<description.length;n++){if(y<75){newPage();header()}page.drawText(description[n],{x:margin+8,y,font,size:10,color:ink});if(n===0){page.drawText(line.quantity,{x:335,y,font,size:9,color:ink});page.drawText(money(line.rate,invoice.currency),{x:390,y,font,size:9,color:ink});const value=money(t.lineTotals[idx],invoice.currency);page.drawText(value,{x:width-margin-8-font.widthOfTextAtSize(value,9),y,font,size:9,color:ink})}y-=16}y-=12}
 ensure(155);y-=10;pair('Subtotal',money(t.subtotal,invoice.currency));if(Number(t.discount))pair('Discount',`−${money(t.discount,invoice.currency)}`);if(Number(invoice.tax))pair(`Tax (${invoice.tax}%)`,money(t.tax,invoice.currency));pair('Total',money(t.total,invoice.currency),true);
 if(Number(invoice.deposit))text(`Requested deposit: ${money(invoice.deposit,invoice.currency)}`,10);for(const item of invoice.instalments)text(`Instalment ${item.date}: ${money(item.amount,invoice.currency)}`,10);
 if(invoice.notes){y-=15;text('NOTES',9,500,grey);text(invoice.notes,10)}if(b.bank){y-=15;text('PAYMENT DETAILS',9,500,grey);text(b.bank,10);text(`Payment reference: ${invoice.reference||invoice.number||'Draft'}`,9)}if(b.footer){y-=15;text(b.footer,10)}
 }
 pages.forEach((p,n)=>{p.drawLine({start:{x:margin,y:40},end:{x:width-margin,y:40},thickness:.5,color:rgb(.88,.88,.88)});p.drawText(`${invoice.number||'DRAFT'}${invoice.lifecycle==='void'?' · VOID':''} · ${n+1} / ${pages.length}`,{x:margin,y:25,font,size:8,color:grey})});pdf.setTitle(`${invoice.number||'Draft'} ${breakdown?'breakdown':'invoice'}`);pdf.setAuthor(b.name);return pdf.save()
}

export async function renderCreditNotePDF(note:CreditNote,currentBusiness:Business,fontBytes:Uint8Array):Promise<Uint8Array>{
 const b=note.business??currentBusiness;const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);const font=await pdf.embedFont(fontBytes,{subset:true});const ink=rgb(.1,.1,.12);const grey=rgb(.43,.43,.47);const pale=rgb(.97,.97,.96);const alertRed=rgb(.85,.25,.2);let page!:PDFPage;let y=0;const pages:PDFPage[]=[];const width=595.28;const height=841.89;const margin=45;
 const newPage=()=>{page=pdf.addPage([width,height]);pages.push(page);y=height-50;page.drawText(`${b.name||'Your business'}  /  ${note.number}`,{x:margin,y,font,size:9,color:grey});y-=35;};newPage();
 const wrap=(input:string,max:number,size=10)=>{const out:string[]=[];for(const paragraph of input.replace(/\r/g,'').split('\n')){let line='';for(const char of paragraph){if(font.widthOfTextAtSize(line+char,size)>max&&line){out.push(line);line=char}else line+=char}out.push(line)}return out};
 const ensure=(n:number)=>{if(y-n<55)newPage()};
 const text=(value:string,size=10,max=width-margin*2,color=ink)=>{for(const line of wrap(value,max,size)){ensure(size+6);page.drawText(line,{x:margin,y,font,size,color});y-=size+6}};
 const pair=(label:string,value:string,strong=false)=>{ensure(25);page.drawText(label,{x:330,y,font,size:strong?13:10,color:strong?ink:grey});page.drawText(value,{x:width-margin-font.widthOfTextAtSize(value,strong?13:10),y,font,size:strong?13:10,color:ink});y-=25};
 text('CREDIT NOTE',30,width-margin*2,alertRed);text(`Number: ${note.number}  ·  Original invoice: ${note.invoiceNumber}`,11,500,grey);y-=12;
 if(b.logo){try{const bytes=Uint8Array.from(atob(b.logo.split(',')[1]),c=>c.charCodeAt(0));const image=b.logo.startsWith('data:image/png')?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);const scale=Math.min(70/image.width,45/image.height);page!.drawImage(image,{x:width-margin-image.width*scale,y:height-125,width:image.width*scale,height:image.height*scale})}catch{}}
 text(b.name||'Your business',12);text(formatBusinessPdfLines(b).join('\n'),9,480,grey);y-=18;text('CREDITED TO',9,500,grey);text(note.client.name||'Client name',12);text(formatClientPdfLines(note.client).join('\n'),9,480,grey);y-=12;text(`Credit date: ${note.issueDate}`,10);text(`Reason: ${note.reason}`,10,width-margin*2,ink);y-=18;
 const header=()=>{ensure(35);page.drawRectangle({x:margin,y:y-7,width:width-margin*2,height:25,color:pale});for(const [label,x] of [['Credited Item / Description',margin+8],['Qty',335],['Rate',390],['Amount',470]] as const)page.drawText(label,{x,y,font,size:9,color:grey});y-=30};header();
 const dp=precision(note.currency);
 for(let idx=0;idx<note.lines.length;idx++){const line=note.lines[idx];const description=wrap(line.description||'Credited service',265,10);const lineTotal=new Decimal(line.quantity||0).mul(line.rate||0).toFixed(dp);for(let n=0;n<description.length;n++){if(y<75){newPage();header()}page.drawText(description[n],{x:margin+8,y,font,size:10,color:ink});if(n===0){page.drawText(line.quantity,{x:335,y,font,size:9,color:ink});page.drawText(money(line.rate,note.currency),{x:390,y,font,size:9,color:ink});const value=money(lineTotal,note.currency);page.drawText(value,{x:width-margin-8-font.widthOfTextAtSize(value,9),y,font,size:9,color:ink})}y-=16}y-=12}
 ensure(130);y-=10;pair('Credited Subtotal',money(note.subtotal,note.currency));if(Number(note.tax)>0)pair(`Tax Adjustment (${note.tax}%)`,money(note.taxAmount,note.currency));pair('Total Credited',money(note.total,note.currency),true);
 pages.forEach((p,n)=>{p.drawLine({start:{x:margin,y:40},end:{x:width-margin,y:40},thickness:.5,color:rgb(.88,.88,.88)});p.drawText(`${note.number} · Credited against ${note.invoiceNumber} · ${n+1} / ${pages.length}`,{x:margin,y:25,font,size:8,color:grey})});pdf.setTitle(`${note.number} Credit Note`);pdf.setAuthor(b.name);return pdf.save()
}

export async function renderReceiptPDF(receipt:Receipt,currentBusiness:Business,fontBytes:Uint8Array):Promise<Uint8Array>{
 const b=receipt.business??currentBusiness;const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);const font=await pdf.embedFont(fontBytes,{subset:true});const ink=rgb(.1,.1,.12);const grey=rgb(.43,.43,.47);const pale=rgb(.97,.97,.96);const alertRed=rgb(.85,.25,.2);const successGreen=rgb(.15,.55,.3);let page!:PDFPage;let y=0;const pages:PDFPage[]=[];const width=595.28;const height=841.89;const margin=45;
 const newPage=()=>{page=pdf.addPage([width,height]);pages.push(page);y=height-50;page.drawText(`${b.name||'Your business'}  /  ${receipt.number}${receipt.reversed?' · REVERSED':''}`,{x:margin,y,font,size:9,color:grey});y-=35;};newPage();
 const wrap=(input:string,max:number,size=10)=>{const out:string[]=[];for(const paragraph of input.replace(/\r/g,'').split('\n')){let line='';for(const char of paragraph){if(font.widthOfTextAtSize(line+char,size)>max&&line){out.push(line);line=char}else line+=char}out.push(line)}return out};
 const ensure=(n:number)=>{if(y-n<55)newPage()};
 const text=(value:string,size=10,max=width-margin*2,color=ink)=>{for(const line of wrap(value,max,size)){ensure(size+6);page.drawText(line,{x:margin,y,font,size,color});y-=size+6}};
 const pair=(label:string,value:string,strong=false)=>{ensure(25);page.drawText(label,{x:330,y,font,size:strong?13:10,color:strong?ink:grey});page.drawText(value,{x:width-margin-font.widthOfTextAtSize(value,strong?13:10),y,font,size:strong?13:10,color:ink});y-=25};
 text('PAYMENT RECEIPT',30,width-margin*2,receipt.reversed?alertRed:successGreen);
 if(receipt.reversed){text(`Number: ${receipt.number}  ·  REVERSED on ${receipt.reversedAt||'unknown date'}`,11,500,alertRed);y-=12}
 else{text(`Number: ${receipt.number}`,11,500,grey);y-=12}
 if(b.logo){try{const bytes=Uint8Array.from(atob(b.logo.split(',')[1]),c=>c.charCodeAt(0));const image=b.logo.startsWith('data:image/png')?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);const scale=Math.min(70/image.width,45/image.height);page!.drawImage(image,{x:width-margin-image.width*scale,y:height-125,width:image.width*scale,height:image.height*scale})}catch{}}
 text(b.name||'Your business',12);text(formatBusinessPdfLines(b).join('\n'),9,480,grey);y-=18;text('RECEIVED FROM',9,500,grey);text(receipt.client.name||'Client name',12);text(formatClientPdfLines(receipt.client).join('\n'),9,480,grey);y-=12;text(`Payment date: ${receipt.date}     Method: ${receipt.method.toUpperCase()}`,10);if(receipt.reference)text(`Reference: ${receipt.reference}`,9);y-=18;
 const header=()=>{ensure(35);page.drawRectangle({x:margin,y:y-7,width:width-margin*2,height:25,color:pale});for(const [label,x] of [['Applied To / Allocation',margin+8],['Amount Applied',430]] as const)page.drawText(label,{x,y,font,size:9,color:grey});y-=30};header();
 for(const alloc of receipt.allocations){ensure(22);page.drawText(`Invoice ${alloc.invoiceNumber}`,{x:margin+8,y,font,size:10,color:ink});const val=money(alloc.amount,receipt.currency);page.drawText(val,{x:width-margin-8-font.widthOfTextAtSize(val,9),y,font,size:9,color:ink});y-=20}
 if(Number(receipt.unallocated)>0){ensure(22);page.drawText('Unallocated client balance (credit held)',{x:margin+8,y,font,size:10,color:grey});const unallocVal=money(receipt.unallocated,receipt.currency);page.drawText(unallocVal,{x:width-margin-8-font.widthOfTextAtSize(unallocVal,9),y,font,size:9,color:ink});y-=20}
 ensure(90);y-=10;pair('Total Received',money(receipt.amount,receipt.currency),true);
 if(receipt.notes){y-=15;text('NOTES',9,500,grey);text(receipt.notes,10)}
 pages.forEach((p,n)=>{p.drawLine({start:{x:margin,y:40},end:{x:width-margin,y:40},thickness:.5,color:rgb(.88,.88,.88)});p.drawText(`${receipt.number}${receipt.reversed?' · REVERSED':''} · ${n+1} / ${pages.length}`,{x:margin,y:25,font,size:8,color:grey})});pdf.setTitle(`${receipt.number} Payment Receipt`);pdf.setAuthor(b.name);return pdf.save()
}

export async function renderStatementPDF(statement:ClientStatement,currentBusiness:Business,fontBytes:Uint8Array):Promise<Uint8Array>{
 const b=statement.business??currentBusiness;const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);const font=await pdf.embedFont(fontBytes,{subset:true});const ink=rgb(.1,.1,.12);const grey=rgb(.43,.43,.47);const pale=rgb(.97,.97,.96);let page!:PDFPage;let y=0;const pages:PDFPage[]=[];const width=595.28;const height=841.89;const margin=45;
 const newPage=()=>{page=pdf.addPage([width,height]);pages.push(page);y=height-50;page.drawText(`${b.name||'Your business'}  /  Statement of Account`,{x:margin,y,font,size:9,color:grey});y-=35;};newPage();
 const wrap=(input:string,max:number,size=10)=>{const out:string[]=[];for(const paragraph of input.replace(/\r/g,'').split('\n')){let line='';for(const char of paragraph){if(font.widthOfTextAtSize(line+char,size)>max&&line){out.push(line);line=char}else line+=char}out.push(line)}return out};
 const ensure=(n:number)=>{if(y-n<55)newPage()};
 const text=(value:string,size=10,max=width-margin*2,color=ink)=>{for(const line of wrap(value,max,size)){ensure(size+6);page.drawText(line,{x:margin,y,font,size,color});y-=size+6}};
 const pair=(label:string,value:string,strong=false)=>{ensure(25);page.drawText(label,{x:330,y,font,size:strong?13:10,color:strong?ink:grey});page.drawText(value,{x:width-margin-font.widthOfTextAtSize(value,strong?13:10),y,font,size:strong?13:10,color:ink});y-=25};
 text('STATEMENT OF ACCOUNT',26);text(`Period: ${statement.startDate} to ${statement.endDate}  ·  Currency: ${statement.currency}`,11,500,grey);y-=12;
 if(b.logo){try{const bytes=Uint8Array.from(atob(b.logo.split(',')[1]),c=>c.charCodeAt(0));const image=b.logo.startsWith('data:image/png')?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);const scale=Math.min(70/image.width,45/image.height);page!.drawImage(image,{x:width-margin-image.width*scale,y:height-125,width:image.width*scale,height:image.height*scale})}catch{}}
 text(b.name||'Your business',12);text(formatBusinessPdfLines(b).join('\n'),9,480,grey);y-=18;text('STATEMENT FOR',9,500,grey);text(statement.client.name||'Client name',12);text(formatClientPdfLines(statement.client).join('\n'),9,480,grey);y-=12;text(`Generated on: ${statement.generatedAt}`,10);y-=16;
 ensure(110);pair('Opening Balance',money(statement.openingBalance,statement.currency));pair('Total Invoiced / Charges',money(statement.periodCharges,statement.currency));if(Number(statement.periodCredits)>0)pair('Total Credits Issued',`−${money(statement.periodCredits,statement.currency)}`);pair('Total Payments Received',`−${money(new Decimal(statement.periodPayments).sub(statement.periodRefunds).toFixed(precision(statement.currency)),statement.currency)}`);pair('Closing Balance Due',money(statement.closingBalance,statement.currency),true);y-=10;
 const header=()=>{ensure(35);page.drawRectangle({x:margin,y:y-7,width:width-margin*2,height:25,color:pale});for(const [label,x] of [['Date',margin+8],['Reference',margin+80],['Description',margin+175],['Charges',380],['Credits',440],['Balance',495]] as const)page.drawText(label,{x,y,font,size:8.5,color:grey});y-=30};header();
 ensure(20);page.drawText(statement.startDate,{x:margin+8,y,font,size:8.5,color:grey});page.drawText('OPENING',{x:margin+80,y,font,size:8.5,color:grey});page.drawText('Opening balance for period',{x:margin+175,y,font,size:8.5,color:grey});const openVal=money(statement.openingBalance,statement.currency);page.drawText(openVal,{x:width-margin-8-font.widthOfTextAtSize(openVal,8.5),y,font,size:8.5,color:ink});y-=16;
 for(const entry of statement.entries){ensure(20);page.drawText(entry.date,{x:margin+8,y,font,size:8.5,color:ink});page.drawText(entry.reference.slice(0,18),{x:margin+80,y,font,size:8.5,color:ink});page.drawText(entry.description.slice(0,32),{x:margin+175,y,font,size:8.5,color:ink});if(entry.charges){const chg=money(entry.charges,statement.currency);page.drawText(chg,{x:425-font.widthOfTextAtSize(chg,8.5),y,font,size:8.5,color:ink})}if(entry.credits){const crd=money(entry.credits,statement.currency);page.drawText(crd,{x:485-font.widthOfTextAtSize(crd,8.5),y,font,size:8.5,color:ink})}const bal=money(entry.balance,statement.currency);page.drawText(bal,{x:width-margin-8-font.widthOfTextAtSize(bal,8.5),y,font,size:8.5,color:ink});y-=16}
 pages.forEach((p,n)=>{p.drawLine({start:{x:margin,y:40},end:{x:width-margin,y:40},thickness:.5,color:rgb(.88,.88,.88)});p.drawText(`Statement · ${statement.client.name} · ${n+1} / ${pages.length}`,{x:margin,y:25,font,size:8,color:grey})});pdf.setTitle(`Statement ${statement.client.name} ${statement.startDate} to ${statement.endDate}`);pdf.setAuthor(b.name);return pdf.save()
}

export async function renderQuotePDF(quote:Quote,currentBusiness:Business,fontBytes:Uint8Array):Promise<Uint8Array>{
 const b=currentBusiness;const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);const font=await pdf.embedFont(fontBytes,{subset:true});const ink=rgb(.1,.1,.12);const grey=rgb(.43,.43,.47);const pale=rgb(.97,.97,.96);const accent=rgb(...([1,3,5].map(x=>parseInt(quote.accent.slice(x,x+2),16)/255) as [number,number,number]));const green=rgb(.15,.55,.3);const red=rgb(.85,.25,.2);let page!:PDFPage;let y=0;const pages:PDFPage[]=[];const width=595.28;const height=841.89;const margin=45;
 const newPage=()=>{page=pdf.addPage([width,height]);pages.push(page);y=height-50;page.drawText(`${b.name||'Your business'}  /  ${quote.quoteNumber} (Rev ${quote.revision})`,{x:margin,y,font,size:9,color:grey});y-=35;};newPage();
 const wrap=(input:string,max:number,size=10)=>{const out:string[]=[];for(const paragraph of input.replace(/\r/g,'').split('\n')){let line='';for(const char of paragraph){if(font.widthOfTextAtSize(line+char,size)>max&&line){out.push(line);line=char}else line+=char}out.push(line)}return out};
 const ensure=(n:number)=>{if(y-n<55)newPage()};
 const text=(value:string,size=10,max=width-margin*2,color=ink)=>{for(const line of wrap(value,max,size)){ensure(size+6);page.drawText(line,{x:margin,y,font,size,color});y-=size+6}};
 const pair=(label:string,value:string,strong=false)=>{ensure(25);page.drawText(label,{x:330,y,font,size:strong?13:10,color:strong?ink:grey});page.drawText(value,{x:width-margin-font.widthOfTextAtSize(value,strong?13:10),y,font,size:strong?13:10,color:ink});y-=25};
 if(quote.template==='studio'){page.drawRectangle({x:margin,y:y-8,width:40,height:40,color:accent});page.drawText('+',{x:margin+13,y:y+4,font,size:20,color:ink});y-=40}
 text('PROJECT ESTIMATE / QUOTE',26);text(`${quote.quoteNumber}  ·  Revision ${quote.revision}`,11,500,grey);y-=12;
 if(quote.status==='accepted'&&quote.acceptance){ensure(30);page.drawRectangle({x:margin,y:y-5,width:width-margin*2,height:26,color:rgb(.9,.98,.92)});page.drawText(`ACCEPTED on ${quote.acceptance.date} via ${quote.acceptance.method.replace('_',' ')}${quote.acceptance.reference?` (Ref: ${quote.acceptance.reference})`:''}`,{x:margin+10,y:y+3,font,size:9.5,color:green});y-=34}
 else if(quote.status==='declined'){ensure(30);page.drawRectangle({x:margin,y:y-5,width:width-margin*2,height:26,color:rgb(.99,.92,.92)});page.drawText(`DECLINED${quote.declinedReason?`: ${quote.declinedReason}`:''}`,{x:margin+10,y:y+3,font,size:9.5,color:red});y-=34}
 else if(quote.status==='superseded'){ensure(30);page.drawRectangle({x:margin,y:y-5,width:width-margin*2,height:26,color:pale});page.drawText('SUPERSEDED BY LATER REVISION',{x:margin+10,y:y+3,font,size:9.5,color:grey});y-=34}
 if(b.logo){try{const bytes=Uint8Array.from(atob(b.logo.split(',')[1]),c=>c.charCodeAt(0));const image=b.logo.startsWith('data:image/png')?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);const scale=Math.min(70/image.width,45/image.height);page.drawImage(image,{x:width-margin-image.width*scale,y:height-125,width:image.width*scale,height:image.height*scale})}catch{}}
 text(b.name||'Your business',12);text(formatBusinessPdfLines(b).join('\n'),9,480,grey);y-=18;text('PREPARED FOR',9,500,grey);text(quote.client.name||'Client name',12);text(formatClientPdfLines(quote.client).join('\n'),9,480,grey);y-=12;text(`Quote Date: ${quote.issueDate}     Valid Until: ${quote.expiryDate}`,10);y-=18;
 if(quote.scope){text('SCOPE OF WORK',9,500,grey);text(quote.scope,10);y-=14}
 const header=()=>{ensure(35);page.drawRectangle({x:margin,y:y-7,width:width-margin*2,height:25,color:quote.template==='classic'?accent:pale});for(const [label,x] of [['Description',margin+8],['Qty',335],['Rate',390],['Amount',470]] as const)page.drawText(label,{x,y,font,size:9,color:quote.template==='classic'?ink:grey});y-=30};header();
 const t=quoteTotals(quote);
 for(let idx=0;idx<quote.lines.length;idx++){const line=quote.lines[idx];const description=wrap(line.description||'Estimated service',265,10);for(let n=0;n<description.length;n++){if(y<75){newPage();header()}page.drawText(description[n],{x:margin+8,y,font,size:10,color:ink});if(n===0){page.drawText(line.quantity,{x:335,y,font,size:9,color:ink});page.drawText(money(line.rate,quote.currency),{x:390,y,font,size:9,color:ink});const value=money(t.lineTotals[idx],quote.currency);page.drawText(value,{x:width-margin-8-font.widthOfTextAtSize(value,9),y,font,size:9,color:ink})}y-=16}y-=12}
 ensure(130);y-=10;pair('Subtotal',money(t.subtotal,quote.currency));if(Number(t.discount))pair('Discount',`-${money(t.discount,quote.currency)}`);if(Number(quote.tax))pair(`Tax (${quote.tax}%)`,money(t.tax,quote.currency));pair('Total Estimate',money(t.total,quote.currency),true);
 if(quote.notes){y-=15;text('NOTES & TERMS',9,500,grey);text(quote.notes,10)}
 pages.forEach((p,n)=>{p.drawLine({start:{x:margin,y:40},end:{x:width-margin,y:40},thickness:.5,color:rgb(.88,.88,.88)});p.drawText(`${quote.quoteNumber} · Rev ${quote.revision} · ${n+1} / ${pages.length}`,{x:margin,y:25,font,size:8,color:grey})});pdf.setTitle(`${quote.quoteNumber} Rev ${quote.revision} Estimate`);pdf.setAuthor(b.name);return pdf.save()
}


