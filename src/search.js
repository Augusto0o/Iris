// One search across the ecosystem. Reads each app's saved data (the same storage the apps use), so it works
// even when an app is not loaded. Each entry knows where to open: app, screen and record.
const APPS={
 iris:{name:'numio',key:'iris03'},
 'mi-espacio':{name:'domo',key:'ecosistema03-space'},
 journal:{name:'lecta',key:'ecosistema03-journal'},
 organizador:{name:'foco',key:'ecosistema03-organizer'},
};
// [label, icon, screen to open first] per collection.
const KINDS={
 iris:{expenses:['Gasto','wallet'],incomes:['Ingreso','plus'],accounts:['Cuenta','wallet'],transfers:['Transferencia','wallet'],cards:['Tarjeta','wallet'],cardPurchases:['Compra con tarjeta','wallet'],services:['Servicio','zap'],loans:['Préstamo','wallet'],goals:['Ahorro','wallet']},
 'mi-espacio':{contracts:['Vivienda','home','contracts'],services:['Servicio','zap','services'],inventory:['Inventario','box','inventory'],maintenance:['Mantenimiento','wrench','maintenance'],moving:['Mudanza','check','moving'],budget:['Presupuesto','wallet','budget'],recipes:['Receta','utensils','recipes'],homePayments:['Pago del hogar','wallet','budget'],pantry:['Despensa','box','recipes'],shopping:['Compra','check','recipes']},
 journal:{notes:['Nota','note','notes'],drawings:['Dibujo','pen','drawings'],maps:['Mapa mental','network','maps'],recordings:['Grabación','mic','recordings'],library:['Biblioteca','book','library'],vocabulary:['Vocabulario','english','english'],movieLists:['Lista de películas','film','movies'],quotes:['Frase','quote','quotes'],links:['Enlace','link','links'],documents:['Documento','file','documents'],artworks:['Obra de arte','art','art'],englishWriting:['Escritura en inglés','english','english'],playlists:['Playlist','music','music']},
 organizador:{tasks:['Tarea','check','tasks'],projects:['Proyecto','folder','projects'],events:['Evento','calendar','calendar'],routines:['Rutina','repeat','routines'],habits:['Hábito','heart','habits']},
};
const TITLE=['title','name','text','word','quote','label'];
const SKIP=/^(id|image|audio|data|related|createdAt|updatedAt|deletedAt|order)$/;

export const normalize=t=>String(t??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLocaleLowerCase();
// "2026-10-10" → "10 oct" (with the year when it is not the current one).
export function shortDate(iso,now=new Date()){
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||'');if(!m)return iso;
 const months=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
 return +m[3]+' '+months[+m[2]-1]+(+m[1]!==now.getFullYear()?' '+m[1]:'');
}
const plain=t=>String(t).replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();

function words(record){
 const out=[];
 for(const [k,v] of Object.entries(record)){
  if(SKIP.test(k)||v==null)continue;
  if(typeof v==='string'&&!v.startsWith('data:'))out.push(plain(v));
  else if(typeof v==='number')out.push(String(v));
  else if(Array.isArray(v))for(const x of v)if(typeof x==='string')out.push(x);else if(x&&typeof x.text==='string')out.push(x.text);
 }
 return out.join(' ').slice(0,4000);
}

export function buildSearchIndex(read){
 const entries=[];
 for(const [app,{name,key}] of Object.entries(APPS)){
  let data;try{data=JSON.parse(read(key)||'null')}catch{data=null}
  if(!data||typeof data!=='object')continue;
  const source=app==='iris'?data:data.records||{};
  for(const [kind,[label,icon,view]] of Object.entries(KINDS[app])){
   for(const r of Array.isArray(source[kind])?source[kind]:[]){
    if(!r||typeof r!=='object'||!r.id||r.archived||r.deletedAt)continue;
    const title=plain(TITLE.map(f=>r[f]).find(v=>typeof v==='string'&&v.trim())||label);
    const detail=[r.category,r.method,r.notebook,r.date&&shortDate(r.date),r.priority].filter(v=>typeof v==='string'&&v).join(' · ');
    entries.push({app,appName:name,kind,label,icon,view,id:String(r.id),title,subtitle:name+' · '+label+(detail?' · '+detail:''),
     amount:typeof r.amount==='number'?r.amount:undefined,currency:r.currency,text:normalize(title+' '+words(r)+' '+label+' '+name)});
   }
  }
 }
 return entries;
}

export function search(entries,query,limit=60){
 const terms=normalize(query).split(/\s+/).filter(Boolean);if(!terms.length)return [];
 const hits=[];
 for(const e of entries){
  if(!terms.every(t=>e.text.includes(t)))continue;
  const t=normalize(e.title);hits.push({e,score:terms.reduce((s,w)=>s+(t.startsWith(w)?3:t.includes(w)?2:1),0)});
 }
 return hits.sort((a,b)=>b.score-a.score).slice(0,limit).map(h=>h.e);
}

// Records to hand the AI for a free question: any word may match (a question rarely matches every word),
// the best matches first; with few matches the rest of your records fill in so it still has context.
const STOP=new Set('que cual cuales cuanto cuanta cuantos cuantas como donde cuando para por con sin los las del una uno unos unas mis tus sus este esta estos estas ese esa hay tengo tiene tenia fue era son esta estan algo alguna algun todo toda todos todas mas menos muy entre desde hasta sobre the and'.split(' '));
export function aiContext(entries,question,limit=80){
 const words=normalize(question).split(/[^a-z0-9ñ]+/).filter(w=>w.length>2&&!STOP.has(w)).map(w=>w.length>4?w.replace(/(es|s)$/,''):w);
 const scored=entries.map((e,i)=>({e,i,score:words.reduce((s,w)=>s+(e.text.includes(w)?(normalize(e.title).includes(w)?3:1):0),0)}));
 const hits=scored.filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.i-b.i).slice(0,limit).map(x=>x.e);
 if(hits.length<limit/2)for(const e of entries){if(hits.length>=limit)break;if(!hits.includes(e))hits.push(e)}
 return hits;
}
