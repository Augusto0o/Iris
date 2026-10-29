// Scanned pages, recordings and photos under drawings live in IndexedDB (plenty of room), not in the app data
// (localStorage: a few MB for everything). Records keep only a reference ("scan-…" / "media-…"), resolved when shown.
const DB='nubo-scans',STORE='images';
let dbPromise=null;
function db(){
 if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>{dbPromise=null;reject(r.error)}});
 return dbPromise;
}
const tx=async(mode,run)=>{const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction(STORE,mode),req=run(t.objectStore(STORE));t.oncomplete=()=>resolve(req?.result);t.onerror=t.onabort=()=>reject(t.error||Error('No se pudo guardar la imagen.'))})};
const id=()=>(crypto.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2));
export async function putScan(blob,prefix='scan'){const key=(prefix==='media'?'media-':'scan-')+id();await tx('readwrite',s=>s.put(blob,key));return key}
export async function getMedia(key){return /^(scan|media)-[\w-]{6,64}$/.test(key||'')?await tx('readonly',s=>s.get(key)):null}
export async function removeMedia(key){if(/^(scan|media)-[\w-]{6,64}$/.test(key||'')){const u=urls.get(key);if(u){URL.revokeObjectURL(u);urls.delete(key)}await tx('readwrite',s=>s.delete(key))}}
const urls=new Map();
export async function scanURL(key){
 if(!/^(scan|media)-[\w-]{6,64}$/.test(key||''))return '';
 if(urls.has(key))return urls.get(key);
 const blob=await tx('readonly',s=>s.get(key));if(!blob)return '';
 const url=URL.createObjectURL(blob);urls.set(key,url);return url;
}
export const canvasBlob=(canvas,type='image/jpeg',quality=.8)=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('No se pudo preparar la imagen.')),type,quality));
