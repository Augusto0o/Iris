export const MODULE_KEYS=Object.freeze(Object.assign(Object.create(null),{centro:'centro035',iris:'iris03', 'mi-espacio':'ecosistema03-space',journal:'ecosistema03-journal',organizador:'ecosistema03-organizer'}));
const KNOWN=new Set(Object.values(MODULE_KEYS));
export class Vault{
 constructor(storage,onchange=()=>{}){this.store=storage;this.owner='guest';this.onchange=onchange}
 prefix(){return 'ecosystem:v1:'+this.owner+':'}
 key(k){return this.prefix()+k}
 getItem(k){return this.store.getItem(this.key(k))}
 setItem(k,value){const old=this.getItem(k);this.store.setItem(this.key(k),String(value));if(old!==String(value))this.onchange(k,String(value))}
 removeItem(k){this.store.removeItem(this.key(k))}
 keys(){const p=this.prefix();return Array.from({length:this.store.length},(_,i)=>this.store.key(i)).filter(k=>k?.startsWith(p)).map(k=>k.slice(p.length))}
 importLegacy(){for(const key of KNOWN){if(this.getItem(key)!==null)continue;const value=this.store.getItem(key);if(value!==null){try{if(typeof JSON.parse(value)==='object')this.store.setItem(this.key(key),value)}catch{}}}}
 export(){return {format:'ecosistema-personal',version:1,exportedAt:new Date().toISOString(),modules:Object.fromEntries(Object.entries(MODULE_KEYS).map(([id,key])=>[id,this.getItem(key)]).filter(([,v])=>v!==null).map(([id,v])=>[id,JSON.parse(v)]))}}
 validateBackup(data){if(data?.format!=='ecosistema-personal'||data.version!==1||!data.modules||typeof data.modules!=='object')throw Error('Esta copia no pertenece al Ecosistema Personal.');const rows=[];for(const [id,payload]of Object.entries(data.modules)){if(!MODULE_KEYS[id]||!payload||Array.isArray(payload)||typeof payload!=='object')throw Error('La copia tiene un espacio no válido.');const value=JSON.stringify(payload);if(value.length>12_000_000)throw Error('Un espacio supera el tamaño permitido.');rows.push([MODULE_KEYS[id],value])}return rows}
 import(data){const rows=this.validateBackup(data);for(const [key,value]of rows)this.setItem(key,value)}
}
