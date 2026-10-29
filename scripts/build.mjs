import fs from 'node:fs/promises';

import path from 'node:path';

import crypto from 'node:crypto';

import {fileURLToPath} from 'node:url';

import {build,transform} from 'esbuild';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);

const dist=path.join(root,'dist');await fs.rm(dist,{recursive:true,force:true});await fs.mkdir(path.join(dist,'assets'),{recursive:true}); // start clean: no stale hashed files

const hash=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,14);

// The shell of /v/<token> (the page friends open). Its script is src/vaquita-public.js.
const VAQUITA_PAGE=`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<title>Vaquita</title>
<link rel="icon" href="/icon.svg">
<style>
:root{--bg:#f2f2f7;--card:#fff;--text:#111;--muted:#6e6e73;--line:rgba(60,60,67,.18);--tint:#515cce;--in:#248a3d;--out:#c4302b;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#000;--card:#1c1c1e;--text:#fff;--muted:#98989f;--line:rgba(84,84,88,.6);--tint:#b0b8ff;--in:#30d158;--out:#ff6961}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.4 -apple-system,BlinkMacSystemFont,Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:520px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 28px) 16px calc(env(safe-area-inset-bottom,0px) + 32px)}
h1{font-size:34px;line-height:1.1;letter-spacing:-.02em;margin:2px 0 4px}.kind{color:var(--tint);font-weight:600;font-size:14px;margin:0}.muted{color:var(--muted);margin:0 0 4px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));background:var(--card);border-radius:14px;margin:18px 0}.kpis div{padding:12px 14px;border-left:1px solid var(--line)}.kpis div:first-child{border:0}.kpis span{display:block;font-size:13px;color:var(--muted)}.kpis b{font-size:20px}
.card{background:var(--card);border-radius:14px;padding:14px 16px;margin:0 0 14px}.card h2{font-size:20px;margin:0 0 6px;display:flex;justify-content:space-between;align-items:baseline}.card h2 small{font-size:14px;color:var(--muted);font-weight:500}
.list{list-style:none;margin:0;padding:0}.list li{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--line)}.list li:first-child{border:0}.list small{display:block;color:var(--muted);font-size:13px}
em{font-style:normal;font-size:14px;color:var(--muted);white-space:nowrap}em.in{color:var(--in)}em.out{color:var(--out)}.ok{color:var(--in);font-weight:600;margin:4px 0}
.alias{display:block;margin-top:2px;padding:0;border:0;background:none;color:var(--tint);font:inherit;font-size:13px;cursor:pointer}
.actions{display:grid;gap:10px;margin:18px 0 10px}.actions a,.actions button{display:block;text-align:center;padding:14px;border-radius:14px;border:0;font:inherit;font-weight:600;background:var(--card);color:var(--text);text-decoration:none;cursor:pointer}.actions .primary{background:var(--tint);color:#fff}
@media (prefers-color-scheme:dark){.actions .primary{color:#111}}
.foot{color:var(--muted);font-size:13px;text-align:center}
</style>
</head>
<body><main id="app"><p class="muted">Cargando…</p></main><script src="__SCRIPT__"></script></body>
</html>
`;


async function asset(name,ext,source){const text=ext==='json'?source:(await transform(source,{loader:ext,minifyWhitespace:true,minifySyntax:true,minifyIdentifiers:false,target:'es2022'})).code;const url='/assets/'+name+'-'+hash(text)+'.'+ext;await fs.writeFile(path.join(dist,url),text);return url}

// Browser storage and root routing must be installed before any module starts.

const bridge=await asset('bridge','js',await fs.readFile('src/module-bridge.js','utf8')),after=await asset('module-after','js',await fs.readFile('src/module-after.js','utf8'));

// foco only: the immersive Concentración stage and its scenes.
const focusStage=await asset('focus-stage','js',await fs.readFile('src/focus-stage.js','utf8'));
const focusSound=await asset('focus-sound','js',await fs.readFile('src/focus-sound.js','utf8'));
const lectaPlus=await asset('lecta-plus','js',await fs.readFile('src/lecta-plus.js','utf8'));
const numioPlus=await asset('numio-plus','js',await fs.readFile('src/numio-plus.js','utf8')); // Balance, ¿puedo gastar?, suscripciones, resúmenes
// numio · Vaquitas (dividir gastos): the screen and its maths bundled as one classic script
const numioVaquitas=await asset('numio-vaquitas','js',(await build({entryPoints:['src/numio-vaquitas.js'],bundle:true,format:'iife',target:'es2022',write:false})).outputFiles[0].text);
const widgets=await asset('widgets','js',await fs.readFile('src/widgets.js','utf8')); // nubo's home widgets with real data
const lectaEditor=await asset('lecta-editor','js',await fs.readFile('src/lecta-editor.js','utf8')); // the full-screen note editor, after everything else touched the form
const lectaExtras=[];for(const name of ['lecta-notes','lecta-audio','lecta-draw','lecta-books','lecta-english'])lectaExtras.push(await asset(name,'js',await fs.readFile('src/'+name+'.js','utf8')));

const sharedCSS=await fs.readFile('src/module-unified.css','utf8');

const modules={};

for(const id of ['centro','iris','mi-espacio','journal','organizador']){

 let html=await fs.readFile('legacy/'+id+'.html','utf8');
 // Product labels change; stable routes and storage identifiers remain intact.
 for(const [oldName,newName] of [['Mi espacio','domo'],['Organizador','foco'],['Journal','lecta'],['Iris','numio'],['Centro','nubo']])html=html.replace(new RegExp('\\b'+oldName+'\\b','g'),newName);
 html=html.replace('>centro<','>nubo<');
 for(const [before,after] of [['>ORGANIZADOR<','>FOCO<'],['>JOURNAL<','>LECTA<'],['>IRIS<','>NUMIO<'],['>MI ESPACIO<','>DOMO<']])html=html.replaceAll(before,after);

 // Settings: the name is optional (appearance can change without it) and density is always compact.
 const must=(from,to)=>{if(!html.includes(from))throw Error(id+': no encontré '+from.slice(0,60));html=html.replaceAll(from,to)};
 if(id==='centro'||id==='iris'){
  must('<label>Tu nombre<input name="name" value="${esc(state.name)}" required maxlength="30"></label>','<label>Tu nombre (opcional)<input name="name" value="${esc(state.name)}" maxlength="30" autocomplete="off"></label>');
  must("state.name=d.get('name').trim()||'Augusto';","state.name=d.get('name').trim();");
  html=html.replace(/<fieldset class="density-options">[\s\S]*?<\/fieldset>/,'<input type="hidden" name="compact" value="true">');
  must("modal('Ajustes de tu centro',","modal('Ajustes',");
  if(id==='iris'){html=html.replace(/<h3>Densidad<\/h3><div class="iris-density">[\s\S]*?<\/div>(?=<button onclick="categorySettings\(\)">)/,'');if(html.includes('iris-density">'))throw Error('iris: quedó el selector de densidad')}
 }else{
  html=html.replace(/<div><h3>Densidad<\/h3>[\s\S]*?<\/div><\/div><div><h3>Tus datos/,'<div><h3>Tus datos');
  if(html.includes('<h3>Densidad</h3>'))throw Error(id+': quedó el selector de densidad');
 }
 if(id==='centro')must('placeholder="Buscar en tu centro…"','placeholder="Buscar en nubo…"');
 // Actividad already has its own tab: "Más" (which only offered Actividad and Ajustes) becomes Ajustes.
 if(id==='centro')must(`'<button onclick="centroMore()">'+icon('more')+'Más</button>'`,`'<button onclick="settings()">'+icon('settings')+'Ajustes</button>'`);
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
 if(id==='centro')html=html.replace('</body>','<script src="'+widgets+'"></script></body>');
 if(id==='iris')html=html.replace('</body>','<script src="'+numioPlus+'"></script><script src="'+numioVaquitas+'"></script></body>');
 if(id==='organizador')html=html.replace('</body>','<script src="'+focusStage+'"></script><script src="'+focusSound+'"></script></body>');
 if(id==='journal')html=html.replace('</body>',lectaExtras.map(src=>'<script src="'+src+'"></script>').join('')+'<script src="'+lectaPlus+'"></script><script src="'+lectaEditor+'"></script></body>'); // knowledge graph, AI on notes, ideas // after the app and module-after

 modules[id]={entry:await asset(id+'-view','json',JSON.stringify({html})),css:cssURL,js:jsURL};

}

const defaultConfig=JSON.parse(await fs.readFile('src/public-config.json','utf8'));const config={url:process.env.PUBLIC_SUPABASE_URL||defaultConfig.url||'',key:process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY||defaultConfig.key||''};

if(config.key&&/sb_secret_|service_role/.test(config.key))throw Error('Never put a secret/service role key in the browser.');

if(config.url&&!/^https:\/\/[^/]+\.supabase\.co\/?$/.test(config.url))throw Error('Use the HTTPS URL from the Supabase project.');

if(config.key.split('.').length===3){try{const claims=JSON.parse(Buffer.from(config.key.split('.')[1],'base64url'));if(claims.role!=='anon')throw Error('Only anon or publishable keys are permitted.')}catch{throw Error('Invalid public Supabase key.')}}

await build({entryPoints:['src/main.js'],bundle:true,splitting:true,format:'esm',target:'es2022',outdir:'dist/assets',entryNames:'[name]',chunkNames:'chunk-[hash]',minify:true,define:{__MODULES__:JSON.stringify(modules),__CONFIG__:JSON.stringify(config)},metafile:true}).then(result=>fs.writeFile('dist/build-meta.json',JSON.stringify(result.metafile)));

// /v/<token>: the read-only page of a shared vaquita (friends open it from WhatsApp, no account needed)
{const js=(await build({entryPoints:['src/vaquita-public.js'],bundle:true,format:'iife',target:'es2022',minify:true,write:false,define:{__CONFIG__:JSON.stringify(config)}})).outputFiles[0].text;const url='/assets/vaquita-'+hash(js)+'.js';await fs.writeFile('dist'+url,js);await fs.writeFile('dist/v.html',VAQUITA_PAGE.replace('__SCRIPT__',url))}
const main=await fs.readFile('dist/assets/main.js','utf8'),css=await fs.readFile('dist/assets/main.css','utf8');

const mainURL='/assets/main-'+hash(main)+'.js',cssURL='/assets/main-'+hash(css)+'.css';await fs.rename('dist/assets/main.js','dist'+mainURL);await fs.rename('dist/assets/main.css','dist'+cssURL);

let index=await fs.readFile('index.html','utf8');index=index.replace('/assets/main.js',mainURL).replace('/assets/main.css',cssURL);await fs.writeFile('dist/index.html',index);await fs.cp('public','dist',{recursive:true});
// The five app icons live in one file (src/brand-icons.json); they are written out as /brand/*.svg too.
const BRAND_ICONS=JSON.parse(await fs.readFile('src/brand-icons.json','utf8'));await fs.mkdir('dist/brand',{recursive:true});for(const [f,svg] of Object.entries(BRAND_ICONS))await fs.writeFile('dist/brand/'+f,svg);
// Digitize: the text reader runs on the phone. Worker, engine (three builds; the browser picks one) and Spanish data.
await fs.mkdir('dist/ocr/core',{recursive:true});await fs.mkdir('dist/ocr/lang',{recursive:true});
await fs.copyFile('node_modules/tesseract.js/dist/worker.min.js','dist/ocr/worker.min.js');
for(const f of ['tesseract-core-lstm.wasm.js','tesseract-core-simd-lstm.wasm.js','tesseract-core-relaxedsimd-lstm.wasm.js'])await fs.copyFile('node_modules/tesseract.js-core/'+f,'dist/ocr/core/'+f);
await fs.copyFile('node_modules/@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz','dist/ocr/lang/spa.traineddata.gz');
// PDF reader for card statements (loaded only when a PDF is chosen).
await fs.mkdir('dist/pdf',{recursive:true});for(const f of ['pdf.min.mjs','pdf.worker.min.mjs'])await fs.copyFile('node_modules/pdfjs-dist/legacy/build/'+f,'dist/pdf/'+f);

// App icons travel inside the code (data URIs): an icon never fails to load on a slow or missing connection.
{const svg={};for(const [f,text] of Object.entries(BRAND_ICONS))svg['/brand/'+f]='data:image/svg+xml;base64,'+Buffer.from(text).toString('base64');
 const swap=t=>t.replace(/\/brand\/(?:nubo|numio|domo|lecta|foco)-(?:light|dark)\.svg/g,m=>svg[m]||m);
 for(const dir of ['dist/assets','dist']){for(const f of await fs.readdir(dir)){if(!/\.(js|css|html)$/.test(f))continue;const file=path.join(dir,f),text=await fs.readFile(file,'utf8'),next=swap(text);if(next!==text)await fs.writeFile(file,next)}}}
// Only public app code is cached. Auth and user-data requests bypass the worker.

const version=hash(index+main),precache=['/',mainURL,cssURL,'/manifest.webmanifest','/icon-192.png','/icon-512.png','/nubo-192.png','/nubo-512.png',...Object.keys(BRAND_ICONS).map(f=>'/brand/'+f)];

const sw=`const CACHE='ecosystem-${version}',SHELL=${JSON.stringify(precache)};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL))));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ecosystem-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/'))return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('/')));return}if(u.pathname.startsWith('/assets/')||SHELL.includes(u.pathname))e.respondWith(caches.open(CACHE).then(async c=>{const hit=await c.match(e.request);if(hit)return hit;const r=await fetch(e.request);if(r.ok)c.put(e.request,r.clone());return r}));});`;

await fs.writeFile('dist/sw.js',sw+'\n'+await fs.readFile('public/push-worker.js','utf8'));await fs.writeFile('dist/module-manifest.json',JSON.stringify(modules));

// Old product names must not reach the interface (internal ids such as "iris" or "centro" stay).
for(const file of await fs.readdir('dist/assets')){if(!/\.(js|json)$/.test(file))continue;const text=await fs.readFile('dist/assets/'+file,'utf8');for(const old of ['Buscar en tu centro','Ajustes de tu centro','Cuentas de Iris','Mi espacio ·','Organizador ·','Journal ·','Iris ·'])if(text.includes(old))throw Error('Nombre viejo visible en '+file+': '+old)}
console.log('Built one PWA with five lazy, retained spaces. Root JS '+Math.round(Buffer.byteLength(main)/1024)+' KB; Supabase loads separately.');
