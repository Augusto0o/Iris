// GET /api/book?q=quijote&lang=es · search free, public-domain books (Project Gutenberg, via Gutendex; Gutenberg's
// own catalogue as a fallback). GET /api/book?id=2000 · the full text of one of them, to read inside lecta.
// Only public-domain works: free and legal to read.
const clip=(v,n)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
const cover=id=>`https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
const author=name=>{const s=clip(name,120);const m=/^([^,]+),\s*(.+)$/.exec(s);return m?`${m[2]} ${m[1]}`:s};
async function getText(fetch,url,ms=9000){const r=await fetch(url,{signal:AbortSignal.timeout(ms),headers:{'user-agent':'nubo-lecta/1.0 (personal reader)'}});if(!r.ok)throw Object.assign(Error('HTTP '+r.status),{status:r.status});return r.text()}

export async function searchBooks(q,lang,{fetch=globalThis.fetch}={}){
 const query=clip(q,120);if(query.length<2)throw Object.assign(Error('Escribí al menos dos letras.'),{status:400});
 const langs=lang==='all'?'':lang==='en'?'en':'es';
 try{const data=JSON.parse(await getText(fetch,'https://gutendex.com/books?'+new URLSearchParams({search:query,...(langs?{languages:langs}:{})}),8000));
  return (data.results||[]).slice(0,20).map(b=>({id:b.id,title:clip(b.title,200),author:author(b.authors?.[0]?.name||''),languages:b.languages||[],cover:b.formats?.['image/jpeg']||cover(b.id),downloads:b.download_count||0,source:'gutenberg'}))}
 catch{
  const xml=await getText(fetch,'https://www.gutenberg.org/ebooks/search.opds/?'+new URLSearchParams({query:query+(langs?' l.'+langs:'')}));
  const out=[];for(const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)){const e=m[1],id=/\/ebooks\/(\d+)/.exec(e)?.[1];if(!id)continue;
   const title=/<title[^>]*>([\s\S]*?)<\/title>/.exec(e)?.[1]||'',who=/<content[^>]*>([\s\S]*?)<\/content>/.exec(e)?.[1]||'';
   out.push({id:+id,title:clip(title.replace(/&amp;/g,'&'),200),author:clip(who.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&'),120),languages:langs?[langs]:[],cover:cover(id),downloads:0,source:'gutenberg'})}
  return out.slice(0,20)}
}
// The book itself, without Project Gutenberg's license header and footer (they stay linked in the reader).
export function cleanGutenberg(raw){let t=String(raw||'').replace(/\r\n?/g,'\n');
 const start=t.search(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i);if(start>=0)t=t.slice(t.indexOf('\n',start)+1);
 const end=t.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i);if(end>=0)t=t.slice(0,end);
 return t.replace(/\n{3,}/g,'\n\n').trim()}
export async function bookText(id,{fetch=globalThis.fetch}={}){const n=Number(id);if(!Number.isInteger(n)||n<1||n>999999)throw Object.assign(Error('Libro desconocido.'),{status:400});
 let raw='';for(const url of [`https://www.gutenberg.org/cache/epub/${n}/pg${n}.txt`,`https://www.gutenberg.org/ebooks/${n}.txt.utf-8`]){try{raw=await getText(fetch,url,15000);break}catch{}}
 if(!raw)throw Object.assign(Error('No se pudo descargar el libro. Probá de nuevo.'),{status:502});
 const title=/^Title:\s*(.+)$/m.exec(raw)?.[1]||'',who=/^Author:\s*(.+)$/m.exec(raw)?.[1]||'',language=/^Language:\s*(.+)$/m.exec(raw)?.[1]||'';
 const text=cleanGutenberg(raw).slice(0,3_800_000);
 return {id:n,title:clip(title,200),author:clip(who,120),language:clip(language,30),text,epub:`https://www.gutenberg.org/ebooks/${n}.epub3.images`,page:`https://www.gutenberg.org/ebooks/${n}`}}

export default async function handler(req,res){
 const send=(status,data,cache)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':cache||'no-store'});res.end(JSON.stringify(data))};
 if(req.method!=='GET')return send(405,{error:'Usá GET.'});
 try{const u=new URL(req.url,'https://nubo.local'),id=u.searchParams.get('id');
  if(id)return send(200,await bookText(id),'public, max-age=86400, s-maxage=2592000');
  send(200,{books:await searchBooks(u.searchParams.get('q')||'',u.searchParams.get('lang')||'es')},'public, max-age=3600, s-maxage=86400')}
 catch(e){send(e.status&&e.status<500?e.status:502,{error:e.status&&e.status<500?e.message:'La biblioteca gratuita no respondió. Probá en un rato.'})}
}
