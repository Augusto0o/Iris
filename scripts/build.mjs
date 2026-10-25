import fs from 'node:fs/promises';

import path from 'node:path';

import crypto from 'node:crypto';

import {fileURLToPath} from 'node:url';

import {build,transform} from 'esbuild';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);

const dist=path.join(root,'dist');await fs.mkdir(path.join(dist,'assets'),{recursive:true});

const hash=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,14);

async function asset(name,ext,source){const text=ext==='json'?source:(await transform(source,{loader:ext,minifyWhitespace:true,minifySyntax:true,minifyIdentifiers:false,target:'es2022'})).code;const url='/assets/'+name+'-'+hash(text)+'.'+ext;await fs.writeFile(path.join(dist,url),text);return url}

// Browser storage and root routing must be installed before any module starts.

const bridge=await asset('bridge','js',await fs.readFile('src/module-bridge.js','utf8')),after=await asset('module-after','js',await fs.readFile('src/module-after.js','utf8'));

const sharedCSS=await fs.readFile('src/module-unified.css','utf8');

const modules={};

for(const id of ['centro','iris','mi-espacio','journal','organizador']){

 let html=await fs.readFile('legacy/'+id+'.html','utf8');
 // Product labels change; stable routes and storage identifiers remain intact.
 for(const [oldName,newName] of [['Mi espacio','domo'],['Organizador','foco'],['Journal','lecta'],['Iris','numio'],['Centro','nubo']])html=html.replace(new RegExp('\\b'+oldName+'\\b','g'),newName);
 html=html.replace('>centro<','>nubo<');
 for(const [before,after] of [['>ORGANIZADOR<','>FOCO<'],['>JOURNAL<','>LECTA<'],['>IRIS<','>NUMIO<'],['>MI ESPACIO<','>DOMO<']])html=html.replaceAll(before,after);

 if(id==='centro'){

  html=html.replace(/const initial=\{[\s\S]*?\};let state;/,"const initial={theme:'light',name:'',compact:false,widgets:{iris:true,space:true,tasks:true,notes:true},tasks:[],expenses:[],paid:false,notes:[]};let state;");

  html=html.replaceAll('opening:520000','opening:0').replaceAll('${greeting()}, ${esc(state.name)}.', '${greeting()}${state.name?", "+esc(state.name):""}.');

 }

 const styles=[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n')+'\n'+sharedCSS;

 let js=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');

 // All module changes stay inside the root; no cross-domain location.assign.

 js=js.replaceAll('window.location.assign(destination)','parent.EcosystemHost.switchApp(destination)');

 const cssURL=await asset('style','css',styles),jsURL=await asset(id,'js',js);

 html=html.replace(/<style>[\s\S]*?<\/style>/g,'').replace(/<script>[\s\S]*?<\/script>/g,'');

 html=html.replace('<html lang="es">','<html lang="es" data-module="'+id+'">').replace('</head>','<base href="/"><link rel="stylesheet" href="'+cssURL+'"><script src="'+bridge+'"></script></head>').replace('</body>','<script src="'+jsURL+'"></script><script src="'+after+'"></script></body>');

 modules[id]={entry:await asset(id+'-view','json',JSON.stringify({html})),css:cssURL,js:jsURL};

}

const defaultConfig=JSON.parse(await fs.readFile('src/public-config.json','utf8'));const config={url:process.env.PUBLIC_SUPABASE_URL||defaultConfig.url||'',key:process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY||defaultConfig.key||''};

if(config.key&&/sb_secret_|service_role/.test(config.key))throw Error('Never put a secret/service role key in the browser.');

if(config.url&&!/^https:\/\/[^/]+\.supabase\.co\/?$/.test(config.url))throw Error('Use the HTTPS URL from the Supabase project.');

if(config.key.split('.').length===3){try{const claims=JSON.parse(Buffer.from(config.key.split('.')[1],'base64url'));if(claims.role!=='anon')throw Error('Only anon or publishable keys are permitted.')}catch{throw Error('Invalid public Supabase key.')}}

await build({entryPoints:['src/main.js'],bundle:true,splitting:true,format:'esm',target:'es2022',outdir:'dist/assets',entryNames:'[name]',chunkNames:'chunk-[hash]',minify:true,define:{__MODULES__:JSON.stringify(modules),__CONFIG__:JSON.stringify(config)},metafile:true}).then(result=>fs.writeFile('dist/build-meta.json',JSON.stringify(result.metafile)));

const main=await fs.readFile('dist/assets/main.js','utf8'),css=await fs.readFile('dist/assets/main.css','utf8');

const mainURL='/assets/main-'+hash(main)+'.js',cssURL='/assets/main-'+hash(css)+'.css';await fs.rename('dist/assets/main.js','dist'+mainURL);await fs.rename('dist/assets/main.css','dist'+cssURL);

let index=await fs.readFile('index.html','utf8');index=index.replace('/assets/main.js',mainURL).replace('/assets/main.css',cssURL);await fs.writeFile('dist/index.html',index);await fs.cp('public','dist',{recursive:true});

// Only public app code is cached. Auth and user-data requests bypass the worker.

const version=hash(index+main),precache=['/',mainURL,cssURL,'/manifest.webmanifest','/icon-192.png','/icon-512.png','/nubo-192.png','/nubo-512.png'];

const sw=`const CACHE='ecosystem-${version}',SHELL=${JSON.stringify(precache)};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL))));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ecosystem-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/'))return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('/')));return}if(u.pathname.startsWith('/assets/')||SHELL.includes(u.pathname))e.respondWith(caches.open(CACHE).then(async c=>{const hit=await c.match(e.request);if(hit)return hit;const r=await fetch(e.request);if(r.ok)c.put(e.request,r.clone());return r}));});`;

await fs.writeFile('dist/sw.js',sw+'\n'+await fs.readFile('public/push-worker.js','utf8'));await fs.writeFile('dist/module-manifest.json',JSON.stringify(modules));

console.log('Built one PWA with five lazy, retained spaces. Root JS '+Math.round(Buffer.byteLength(main)/1024)+' KB; Supabase loads separately.');

