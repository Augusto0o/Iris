// Reads the text recognised from a photo and proposes the fields to save. Everything is a suggestion:
// the review form shows it and you correct what is wrong before saving.
const MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const PROVIDERS=['Edenor','Edesur','EPEC','EPE','Edelap','Edea','Metrogas','Naturgy','Camuzzi','Litoral Gas','Ecogas','AySA','ABSA','Aguas Cordobesas','Telecom','Personal','Movistar','Claro','Fibertel','Telecentro','DirecTV','Flow','Starlink','ABL','ARBA','AGIP','Rentas','Expensas','Municipalidad'];
const norm=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const pad=n=>String(n).padStart(2,'0');

// "1.234.567,89" · "$ 45.000" · "45000,5" → number (Argentine format; a point followed by 3 digits is thousands).
export function parseAmount(raw){
 let t=String(raw).replace(/[^\d.,]/g,'');if(!t)return null;
 if(/,\d{1,2}$/.test(t))t=t.replace(/\./g,'').replace(',','.');
 else if(/\.\d{1,2}$/.test(t)&&!/\.\d{3}$/.test(t))t=t.replace(/,/g,'');
 else t=t.replace(/[.,]/g,'');
 const n=Number(t);return Number.isFinite(n)&&n>0?Math.round(n*100)/100:null;
}
const AMOUNT=/\$\s*\d[\d.,]*|\b\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?\b|\b\d+,\d{2}\b/g;
export function amounts(line){return [...String(line).matchAll(AMOUNT)].map(m=>parseAmount(m[0])).filter(v=>v!=null)}

// dd/mm/yyyy, dd-mm-yy, dd.mm.yyyy, "15 de octubre de 2026" → "2026-10-15".
export function dates(line){
 const out=[],s=String(line);
 for(const m of s.matchAll(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/g)){let [,d,mo,y]=m;y=y.length===2?'20'+y:y;if(+mo>=1&&+mo<=12&&+d>=1&&+d<=31)out.push(`${y}-${pad(mo)}-${pad(d)}`)}
 for(const m of norm(s).matchAll(/\b(\d{1,2})\s+de\s+([a-z]+)(?:\s+(?:de|del)\s+(\d{4}))?/g)){const mo=MONTHS.indexOf(m[2]);if(mo>=0&&m[3])out.push(`${m[3]}-${pad(mo+1)}-${pad(m[1])}`)}
 return out;
}
const lines=text=>String(text||'').split(/\r?\n/).map(l=>l.replace(/\s+/g,' ').trim()).filter(Boolean);
const near=(ls,re)=>ls.findIndex(l=>re.test(norm(l)));

// Service bill: provider, total to pay, due date, billing period.
export function parseBill(text,{services=[]}={}){
 const ls=lines(text),flat=norm(ls.join(' '));
 const known=services.find(s=>s.name&&flat.includes(norm(s.name)));
 const provider=known?.name||PROVIDERS.find(p=>new RegExp('\\b'+norm(p)+'\\b').test(flat))||(ls[0]||'').slice(0,60);
 let amount=null;
 for(const re of [/total\s+a\s+pagar|importe\s+a\s+pagar|a\s+pagar/,/total/,/importe|monto|saldo/]){const i=near(ls,re);if(i<0)continue;const a=[...amounts(ls[i]),...amounts(ls[i+1]||'')];if(a.length){amount=Math.max(...a);break}}
 if(amount==null){const all=ls.flatMap(amounts);if(all.length)amount=Math.max(...all)}
 let due=null;const vi=near(ls,/venc|vto\b|pagar\s+antes|fecha\s+limite/);if(vi>=0)due=[...dates(ls[vi]),...dates(ls[vi+1]||'')][0]||null;
 const anyDate=ls.flatMap(dates);if(!due)due=anyDate.sort().at(-1)||null;
 let period=null;const pi=near(ls,/periodo|período|mes\s+de|facturacion/);
 const src=pi>=0?norm(ls[pi]+' '+(ls[pi+1]||'')):flat;
 const mm=/\b(\d{1,2})\s*[\/-]\s*(\d{4})\b/.exec(src);const named=new RegExp('\\b('+MONTHS.join('|')+')\\b(?:\\s+(?:de\\s+)?(\\d{4}))?').exec(src);
 if(mm&&+mm[1]>=1&&+mm[1]<=12)period=`${mm[2]}-${pad(mm[1])}`;else if(named)period=`${named[2]||(due||'').slice(0,4)||new Date().getFullYear()}-${pad(MONTHS.indexOf(named[1])+1)}`;
 if(!period&&due)period=due.slice(0,7);
 return {provider,serviceId:known?.id||null,amount,due,period};
}

// Rental contract: title, address, start/end, rent, deposit, expenses, payment day.
export function parseContract(text){
 const ls=lines(text),flat=ls.join(' '),f=norm(flat);
 const titleLine=ls.find(l=>/contrato/i.test(l))||ls[0]||'Contrato';
 const ds=[...new Set(ls.flatMap(dates))].sort();
 const after=(re)=>{const m=new RegExp(re.source+'[^$\\d]{0,40}(\\$\\s*\\d[\\d.,]*|\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?)').exec(f);return m?parseAmount(m[m.length-1]):null};
 // the address runs to the end of its line (abbreviations like "Av." keep their point)
 const addrLine=ls.map(l=>/(?:inmueble\s+(?:sito|ubicado)\s+en|ubicado\s+en|sito\s+en|domicilio\s+(?:en|de))\s+(.{4,120})/i.exec(l)).find(Boolean);
 const addr=addrLine?[addrLine[0],addrLine[1].replace(/[.;]\s*$/,'').slice(0,90)]:null;
 const day=/(?:dia|del)\s+(\d{1,2})\s+(?:de\s+cada\s+mes|al\s+\d{1,2}\s+de\s+cada\s+mes)/.exec(f)||/antes\s+del\s+dia\s+(\d{1,2})/.exec(f);
 return {
  name:titleLine.slice(0,80),
  address:addr?addr[1].trim():'',
  start:ds[0]||'',end:ds.length>1?ds.at(-1):'',
  rent:after(/(?:alquiler|canon\s+locativo|precio\s+(?:mensual|del\s+alquiler)|suma\s+mensual)/)||0,
  deposit:after(/(?:deposito|garantia)/)||0,
  expenses:after(/expensas/)||0,
  day:day&&+day[1]>=1&&+day[1]<=31?+day[1]:10,
 };
}

// Handwritten or printed text: a title and paragraphs (joins words cut with a hyphen at the end of a line).
export function parseText(text){
 const raw=String(text||'').replace(/-\n(\p{Ll})/gu,'$1').replace(/[ \t]+/g,' ');
 const paras=raw.split(/\n\s*\n/).map(p=>p.split('\n').map(l=>l.trim()).filter(Boolean).join(' ')).filter(Boolean);
 const first=(paras[0]||'').split(/(?<=[.!?])\s/)[0]||'';
 return {title:(first.length>3?first:'Texto digitalizado').slice(0,80),paragraphs:paras};
}
export const escapeHtml=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const toNoteHtml=paragraphs=>paragraphs.map(p=>'<p>'+escapeHtml(p)+'</p>').join('');

// To-do list: one task per line, without bullets, numbers or check boxes; wrapped lines that start in lower case join the previous one.
export function parseTaskLines(text){
 const out=[];
 for(const raw of String(text||'').split(/\r?\n/)){
  const line=raw.replace(/^\s*(?:[-–—•·*+>□☐☑✓✔]|\[[ xX✓]?\]|\(?\d{1,2}[.)-])\s*/,'').replace(/\s+/g,' ').trim();
  if(line.length<2)continue;
  if(out.length&&/^\p{Ll}/u.test(line)&&!/^[-–—•·*+□☐\[]|^\s*\d{1,2}[.)]/.test(raw.trim()))out[out.length-1]+=' '+line;else out.push(line);
 }
 return out.map(t=>t.slice(0,240));
}

// Mercado Pago receipt (screenshot of "Comprobante de transferencia" / "Comprobante de pago"):
// amount, who you paid, date and time, operation number (to avoid loading it twice) and whether money came in.
export function parseReceipt(text){
 const ls=lines(text),n=ls.map(norm),flat=n.join(' ');
 const incoming=/\b(te enviaron|recibiste|te transfirieron|ingreso de dinero|cobraste)\b/.test(flat);
 const mp=/mercado\s*pago|comprobante de (transferencia|pago)|numero de operacion|codigo de identificacion/.test(flat);
 // the amount: the "$ 12.300" that stands alone (the big number), else the first money figure
 let amount=null;
 for(const l of ls){const m=/^\$\s*([\d.,]+)\s*$/.exec(l.replace(/\s+/g,' '));if(m){amount=parseAmount(m[1]);if(amount)break}}
 if(amount==null){const i=n.findIndex(l=>/\b(pagaste|transferiste|enviaste|monto|total|importe)\b/.test(l));const a=i>=0?[...amounts(ls[i]),...amounts(ls[i+1]||'')]:[];amount=a[0]??ls.flatMap(amounts)[0]??null}
 // who: "Para Juan Pérez" / "A Juan Pérez" / "Destinatario" / "Pagaste a Kiosco X" (the next line when the label is alone)
 const clean=t=>String(t||'').replace(/\b(cuit|cuil|cvu|cbu|dni|alias)\b.*$/i,'').replace(/[|•·]+/g,' ').replace(/\s+/g,' ').trim().slice(0,60);
 let who='';
 for(let i=0;i<ls.length&&!who;i++){const l=n[i];
  let m=/^(para|destinatario|destino|a)\s*:?\s*(.*)$/.exec(l);
  if(m&&!/^(las|la|los|el)\b/.test(m[2])){who=clean(m[2]?ls[i].slice(ls[i].length-m[2].length):ls[i+1]);continue}
  m=/\b(pagaste|transferiste|enviaste)\b.*?\ba\s+(.+)$/.exec(l);if(m)who=clean(ls[i].slice(ls[i].length-m[2].length));
  if(incoming&&!who){m=/^(de|remitente|te envio|te enviaron)\s*:?\s*(.*)$/.exec(l);if(m&&!/^(dinero|plata|un pago|una transferencia)\b/.test(m[2]))who=clean(m[2]?ls[i].slice(ls[i].length-m[2].length):ls[i+1])}}
 if(/^\$|^\d/.test(who))who='';
 // when: "25 de octubre de 2026, a las 14:32" or "25/10/2026 14:32"
 const date=ls.flatMap(dates)[0]||(()=>{const m=new RegExp('\\b(\\d{1,2})\\s+de\\s+('+MONTHS.join('|')+')\\b').exec(flat);if(!m)return null;const y=new Date().getFullYear();return `${y}-${pad(MONTHS.indexOf(m[2])+1)}-${pad(m[1])}`})();
 const time=(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\s*(hs|h\b)?/.exec(flat)||[]).slice(1,3).join(':')||null;
 // operation number: digits after its label (same line or the next)
 let operation=null;
 for(let i=0;i<ls.length&&!operation;i++)if(/(n(ro|umero|°|º|\.)?\s*de\s*operacion|operacion\s*(n|nro|numero)|id de (la )?(transaccion|operacion)|codigo de (identificacion|operacion))/.test(n[i])){const m=/(\d[\d\s-]{6,})/.exec(ls[i])||/(\d[\d\s-]{6,})/.exec(ls[i+1]||'');if(m)operation=m[1].replace(/\D/g,'')}
 const kind=/transferencia|transferiste|enviaste|cvu|cbu/.test(flat)?'transfer':/\bqr\b|pagaste|comprobante de pago/.test(flat)?'payment':'other';
 return {amount,who,date,time,operation,incoming,kind,isMercadoPago:mp};
}
