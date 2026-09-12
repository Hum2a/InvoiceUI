import { renderPDF, renderStatementPDF } from '../shared/pdf'
import type { Invoice, Workspace, ClientStatement } from '../shared/domain'

export async function document(env:Env,owner:string,w:Workspace,i:Invoice,breakdown=false){
  const key=`${owner}/${i.id}/${i.issuedAt||'draft'}-${i.lifecycle}-${breakdown?'breakdown':'invoice'}.pdf`;
  if(i.issuedAt&&env.DOCUMENTS){
    const existing=await env.DOCUMENTS.get(key);
    if(existing)return new Uint8Array(await existing.arrayBuffer());
  }
  const response=await env.ASSETS.fetch(new Request(env.APP_URL+'/fonts/NotoSans-Regular.ttf'));
  if(!response.ok)throw new Error('Document font missing');
  const bytes=await renderPDF(i,i.business??w.business,new Uint8Array(await response.arrayBuffer()),breakdown);
  if(i.issuedAt&&env.DOCUMENTS)await env.DOCUMENTS.put(key,bytes,{httpMetadata:{contentType:'application/pdf'}});
  return bytes;
}

export async function statementDocument(env:Env,owner:string,w:Workspace,statement:ClientStatement){
  const response=await env.ASSETS.fetch(new Request(env.APP_URL+'/fonts/NotoSans-Regular.ttf'));
  if(!response.ok)throw new Error('Document font missing');
  return await renderStatementPDF(statement,w.business,new Uint8Array(await response.arrayBuffer()));
}
