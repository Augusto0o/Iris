import test from 'node:test';import assert from 'node:assert/strict';
import {readJSON,buildRequest,callClaude,checkUser} from '../api/ai-core.mjs';
import {aiContext,buildSearchIndex} from '../src/search.js';

test('AI answers are read even inside a code fence or a sentence',()=>{
 assert.deepEqual(readJSON('{"a":1}'),{a:1});assert.deepEqual(readJSON('```json\n{"a":2}\n```'),{a:2});
 assert.deepEqual(readJSON('Acá va: {"items":[{"title":"X"}]} listo'),{items:[{title:'X'}]});
 assert.throws(()=>readJSON('nada'));
});
test('Recommendations: prompt carries what you saved, the answer is cleaned up',async()=>{
 const req=buildRequest({task:'recommend',kind:'movies',saved:[{title:'Relatos salvajes',creator:'Szifron',status:'Vista',rating:5}],wish:'algo de suspenso'});
 assert.match(req.messages[0].content,/Relatos salvajes · Szifron · Vista · 5\/5/);assert.match(req.messages[0].content,/suspenso/);
 let sent;const fake=async(url,init)=>{sent={url,init:JSON.parse(init.body),headers:init.headers};return {ok:true,json:async()=>({content:[{type:'text',text:'{"items":[{"title":"Nueve reinas","creator":"Fabián Bielinsky","year":"2000","why":"Estafas y vueltas de tuerca."},{"title":""}]}'}]})}};
 const out=await callClaude(req,{apiKey:'k',fetch:fake});
 assert.equal(sent.url,'https://api.anthropic.com/v1/messages');assert.equal(sent.headers['x-api-key'],'k');assert.equal(sent.headers['anthropic-version'],'2023-06-01');
 assert.equal(sent.init.model,'claude-sonnet-5-5');assert.ok(!('temperature' in sent.init));
 assert.deepEqual(out,{items:[{title:'Nueve reinas',original:'',creator:'Fabián Bielinsky',year:'2000',genre:'',synopsis:'',why:'Estafas y vueltas de tuerca.'}]});
});
test('Questions: refs only point at records that were sent',async()=>{
 const req=buildRequest({task:'ask',question:'¿cuánto pagué de luz?',items:[{app:'numio',kind:'Gasto',title:'Edenor',amount:45000.5,currency:'ARS'}]});
 assert.match(req.messages[0].content,/\[0\] numio · Gasto · Edenor · 45000.5 ARS/);
 const out=await callClaude(req,{apiKey:'k',fetch:async()=>({ok:true,json:async()=>({content:[{type:'text',text:'{"answer":"Pagaste $ 45.000,50.","refs":[0,7,"x"]}'}]})})});
 assert.deepEqual(out,{answer:'Pagaste $ 45.000,50.',refs:[0]});
 assert.throws(()=>buildRequest({task:'otra'}),/desconocida/);
});
test('Only a signed-in account (and, if set, an allowed e-mail) can use it',async()=>{
 const ok=async()=>({ok:true,json:async()=>({id:'u1',email:'Franco@Mail.com'})});
 await assert.rejects(checkUser('',{url:'https://x',key:'k',fetch:ok}),/Iniciá sesión/);
 assert.equal((await checkUser('t',{url:'https://x',key:'k',fetch:ok})).id,'u1');
 assert.equal((await checkUser('t',{url:'https://x',key:'k',allowed:'franco@mail.com',fetch:ok})).id,'u1');
 await assert.rejects(checkUser('t',{url:'https://x',key:'k',allowed:'otro@mail.com',fetch:ok}),/no puede/);
 await assert.rejects(checkUser('t',{url:'https://x',key:'k',fetch:async()=>({ok:false})}),/venció/);
});
test('The AI gets the records that match any word of the question first',()=>{
 const data={'iris03':JSON.stringify({expenses:[{id:'e1',text:'Edenor luz',amount:45000,category:'Servicios'},{id:'e2',text:'Supermercado',amount:20000,category:'Comida'}]})};
 const entries=buildSearchIndex(k=>data[k]??null);
 const ctx=aiContext(entries,'¿Cuánto gasté en luz?',4);
 assert.equal(ctx[0].id,'e1');assert.equal(ctx.length,2);
});

test('Providers: order, one key each, next provider when one fails',async()=>{
 const {providersFrom,callAI}=await import('../api/ai-core.mjs');
 assert.deepEqual(providersFrom({GEMINI_API_KEY:'g',XAI_API_KEY:'x'}).map(p=>p.name),['gemini','gemini','grok']);
 assert.deepEqual(providersFrom({GROQ_API_KEY:'q',GEMINI_API_KEY:'g'}).map(p=>p.name+':'+p.model).slice(0,4),['groq:openai/gpt-oss-120b','groq:openai/gpt-oss-20b','groq:llama-3.1-8b-instant','gemini:gemini-flash-latest']);
 assert.deepEqual(providersFrom({GEMINI_API_KEY:'g',GEMINI_MODEL:'gemini-flash-latest'}).map(p=>p.name+':'+p.model),['gemini:gemini-flash-latest']);
 assert.deepEqual(providersFrom({AI_PROVIDERS:'gemini, grok',GEMINI_API_KEY:'g',GEMINI_MODEL:'gemini-flash-latest',XAI_API_KEY:'x',XAI_MODEL:'grok-x'}).map(p=>p.name+':'+p.model),['gemini:gemini-flash-latest','grok:grok-x']);
 const req=buildRequest({task:'ask',question:'¿luz?',items:[{app:'numio',kind:'Gasto',title:'Edenor'}]});
 const calls=[];
 const fake=async(url,init)=>{const body=JSON.parse(init.body);calls.push({url,headers:init.headers,body});
  if(url.includes('x.ai'))return {ok:false,status:429,json:async()=>({error:'Out of credits'})};
  return {ok:true,json:async()=>({candidates:[{content:{parts:[{thought:true,text:'pensando'},{text:'{"answer":"Edenor.","refs":[0]}'}]}}]})}};
 const out=await callAI(req,{providers:providersFrom({AI_PROVIDERS:'grok,gemini',XAI_API_KEY:'x',GEMINI_API_KEY:'g'}),fetch:fake});
 assert.deepEqual(out,{answer:'Edenor.',refs:[0],provider:'Gemini'});
 assert.equal(calls[0].url,'https://api.x.ai/v1/chat/completions');assert.equal(calls[0].headers.authorization,'Bearer x');
 assert.equal(calls[0].body.messages[0].role,'system');assert.equal(calls[0].body.model,'grok-4.1-fast');
 assert.equal(calls[1].url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent');
 assert.equal(calls[1].headers['x-goog-api-key'],'g');assert.equal(calls[1].body.generationConfig.responseMimeType,'application/json');
 assert.match(calls[1].body.systemInstruction.parts[0].text,/buscador inteligente de nubo/);
 await assert.rejects(callAI(req,{providers:[]}),/GROQ_API_KEY/);
 await assert.rejects(callAI(req,{providers:providersFrom({XAI_API_KEY:'x'}),fetch:fake}),/Grok: Out of credits/);
});
test('Grok answers are read from the chat format',async()=>{
 const {providersFrom,callAI}=await import('../api/ai-core.mjs');
 const req=buildRequest({task:'recommend',kind:'books',saved:[]});
 const out=await callAI(req,{providers:providersFrom({XAI_API_KEY:'x'}),fetch:async()=>({ok:true,json:async()=>({choices:[{message:{content:'```json\n{"items":[{"title":"Rayuela","creator":"Julio Cortázar","year":"1963","why":"Un clásico para jugar con el orden."}]}\n```'}}]})})});
 assert.equal(out.items[0].title,'Rayuela');assert.equal(out.provider,'Grok');
});

test('Groq: free provider in the OpenAI format; a model out of quota moves on to the next',async()=>{
 const {providersFrom,callAI}=await import('../api/ai-core.mjs');
 const req=buildRequest({task:'recommend',kind:'music',saved:[]});const seen=[];
 const out=await callAI(req,{providers:providersFrom({GROQ_API_KEY:'gsk'}),fetch:async(url,init)=>{const b=JSON.parse(init.body);seen.push(url+' '+b.model);
  if(/gpt-oss/.test(b.model)){assert.equal(b.reasoning_effort,'low');assert.ok(b.max_tokens>=2000)}assert.deepEqual(b.response_format,{type:'json_object'});
  if(b.model==='openai/gpt-oss-120b')return {ok:false,status:429,json:async()=>({error:{message:'Rate limit reached'}})};
  return {ok:true,json:async()=>({choices:[{message:{content:'{"items":[{"title":"Clics modernos","creator":"Charly García","year":"1983","why":"Un clásico."}]}'}}]})}}});
 assert.equal(out.provider,'Groq');assert.equal(out.items[0].title,'Clics modernos');
 assert.deepEqual(seen,['https://api.groq.com/openai/v1/chat/completions openai/gpt-oss-120b','https://api.groq.com/openai/v1/chat/completions openai/gpt-oss-20b']);
});

test('lecta actions: transform, tasks and a map that is always a valid tree',async()=>{
 const {treeOf}=await import('../api/ai-core.mjs');
 assert.match(buildRequest({task:'transform',action:'fix',text:'ola q tal'}).system,/Corregí ortografía/);
 assert.throws(()=>buildRequest({task:'transform',action:'borrar',text:'hola'}),/Acción/);
 assert.throws(()=>buildRequest({task:'map',text:''}),/No hay texto/);
 const tasks=buildRequest({task:'tasks',text:'Mañana llamar al plomero',today:'2026-10-26'});assert.match(tasks.system,/2026-10-26/);
 assert.deepEqual(tasks.shape({tasks:[{title:'Llamar al plomero',date:'2026-10-27',priority:'Alta'},{title:'',date:'x'},{title:'Pagar',date:'mañana',priority:'Urgente'}]}).tasks,[{title:'Llamar al plomero',date:'2026-10-27',priority:'Alta'},{title:'Pagar',date:'',priority:'Media'}]);
 const t=treeOf([{id:'a',text:'Raíz'},{id:'b',text:'Hijo',parent:'a'},{id:'c',text:'Ciclo',parent:'d'},{id:'d',text:'Ciclo 2',parent:'c'},{id:'b',text:'Repetido',parent:'zz'},{id:'e',text:'',parent:'a'}]);
 assert.equal(t.filter(n=>!n.parent).length,1);assert.equal(new Set(t.map(n=>n.id)).size,t.length);
 const byId=Object.fromEntries(t.map(n=>[n.id,n]));for(const n of t){let c=n,k=0;while(c.parent&&k<10){c=byId[c.parent];k++}assert.ok(k<10&&!c.parent,'reaches the root: '+n.id)}
});

test('Speech to text: Groq Whisper first, Gemini if it fails',async()=>{
 const {transcribe}=await import('../api/ai-core.mjs');const calls=[];
 const fake=async(url,init)=>{calls.push(url);if(url.includes('groq'))return {ok:false,status:429,json:async()=>({error:{message:'Rate limit'}})};return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Hola, esto es una prueba.'}]}}]})}};
 const out=await transcribe(Buffer.from([1,2,3]),{type:'audio/mp4',env:{GROQ_API_KEY:'q',GEMINI_API_KEY:'g'},fetch:fake});
 assert.deepEqual(out,{text:'Hola, esto es una prueba.',provider:'Gemini'});
 assert.equal(calls.filter(u=>u.includes('groq.com/openai/v1/audio/transcriptions')).length,2);
 const ok=await transcribe(Buffer.from([1]),{env:{GROQ_API_KEY:'q'},fetch:async(url,init)=>{assert.equal(init.body.get('model'),'whisper-large-v3-turbo');assert.equal(init.body.get('language'),'es');return {ok:true,json:async()=>({text:' Texto. '})}}});
 assert.deepEqual(ok,{text:'Texto.',provider:'Groq'});
 await assert.rejects(transcribe(Buffer.from([1]),{env:{}}),/GROQ_API_KEY/);
});

test('Resumen sin spoilers: the prompt forbids spoilers and the answer is cleaned up',async()=>{
 const req=buildRequest({task:'about',kind:'película',title:'Ella',original:'Her',creator:'Spike Jonze',year:'2013',synopsis:'Un hombre se enamora de un sistema operativo.'});
 assert.match(req.system,/SIN SPOILERS/);assert.match(req.messages[0].content,/Título original: Her/);assert.match(req.messages[0].content,/Dirección: Spike Jonze/);
 const out=req.shape({summary:'Uno.\nDos.',forWho:'Para románticos',mood:['melancólica','tierna','x'.repeat(40)]});
 assert.equal(out.summary,'Uno.\nDos.');assert.equal(out.forWho,'Para románticos');assert.equal(out.mood.length,3);assert.ok(out.mood[2].length<=24);
 assert.throws(()=>buildRequest({task:'about',title:''}));
});

test('Movie info: TMDB gives the Spanish synopsis, the poster and the platforms in Argentina',async()=>{
 const {movieInfo}=await import('../api/movie.js');const calls=[];
 const fake=async url=>{calls.push(url);const u=new URL(url);
  if(u.pathname.endsWith('/search/movie'))return {ok:true,json:async()=>({results:[{id:1,title:'Ella',original_title:'Her',release_date:'2013-12-18'},{id:2,title:'Her',original_title:'Her',release_date:'1999-01-01'}]})};
  if(u.pathname.endsWith('/movie/1'))return {ok:true,json:async()=>({id:1,title:'Ella',original_title:'Her',release_date:'2013-12-18',poster_path:'/p.jpg',overview:'Theodore se enamora de Samantha, un sistema operativo.',runtime:126,genres:[{name:'Romance'}],
   'watch/providers':{results:{AR:{link:'https://www.themoviedb.org/movie/1/watch?locale=AR',flatrate:[{provider_name:'Netflix',logo_path:'/n.png'}],rent:[{provider_name:'Apple TV',logo_path:'/a.png'}]}}}})};
  return {ok:false,status:404}};
 const r=await movieInfo({title:'Ella',original:'Her',year:'2013'},{fetch:fake,env:{TMDB_API_KEY:'abc'}});
 assert.equal(r.source,'tmdb');assert.equal(r.poster,'https://image.tmdb.org/t/p/w500/p.jpg');assert.match(r.synopsis,/Samantha/);assert.equal(r.runtime,126);
 assert.deepEqual(r.providers.map(p=>p.name+':'+p.kind),['Netflix:stream','Apple TV:rent']);assert.match(r.link,/locale=AR/);
 assert.ok(calls[0].includes('api_key=abc')&&calls[0].includes('language=es-AR'));
});

test('Movie info without TMDB: poster from Apple or Wikipedia, and a JustWatch search instead of platforms',async()=>{
 const {movieInfo}=await import('../api/movie.js');
 const fake=async url=>{const u=new URL(url);
  if(u.hostname==='itunes.apple.com')return {ok:true,json:async()=>({results:[{trackName:'The Thing',releaseDate:'1982-06-25T07:00:00Z',artworkUrl100:'https://is1.mzstatic.com/x/100x100bb.jpg'}]})};
  if(u.hostname==='es.wikipedia.org')return {ok:true,json:async()=>({query:{pages:{9:{index:1,title:'La cosa (película de 1982)',extract:'La cosa (The Thing) es una película de 1982 dirigida por John Carpenter. Un equipo en la Antártida encuentra algo que no es lo que parece.'}}}})};
  return {ok:true,json:async()=>({query:{pages:{}}})}};
 const r=await movieInfo({title:'La cosa',original:'The Thing',year:'1982'},{fetch:fake,env:{}});
 assert.equal(r.poster,'https://is1.mzstatic.com/x/600x900bb.jpg');assert.match(r.synopsis,/Antártida/);assert.deepEqual(r.providers,[]);assert.equal(r.tmdb,false);
 assert.equal(r.link,'https://www.justwatch.com/ar/buscar?q=La%20cosa');
});

test('Free books: Gutenberg search results and a clean text without the license header',async()=>{
 const {searchBooks,cleanGutenberg}=await import('../api/book.js');
 const fake=async url=>({ok:true,text:async()=>JSON.stringify({results:[{id:2000,title:'Don Quijote',authors:[{name:'Cervantes Saavedra, Miguel de'}],languages:['es'],formats:{'image/jpeg':'https://x/c.jpg'},download_count:9}]})});
 const r=await searchBooks('quijote','es',{fetch:fake});assert.deepEqual(r[0],{id:2000,title:'Don Quijote',author:'Miguel de Cervantes Saavedra',languages:['es'],cover:'https://x/c.jpg',downloads:9,source:'gutenberg'});
 assert.equal(cleanGutenberg('Title: X\n*** START OF THE PROJECT GUTENBERG EBOOK X ***\nEn un lugar\n\n\n\nde la Mancha\n*** END OF THE PROJECT GUTENBERG EBOOK X ***\nLicense'),'En un lugar\n\nde la Mancha');
});
test('Money and statements: the AI answer is checked before the app uses it',()=>{
 const st=buildRequest({task:'statement',text:'VISA GALICIA resumen '.repeat(5)}).shape({card:'Visa Galicia',last4:'12-34',closing:'2026-10-23',due:'2026-11-05',total:'120.500,00',minimum:12000,items:[{date:'2026-10-02',text:'Super',amount:'15000',currency:'ARS'},{text:'',amount:1}]});
 assert.equal(st.last4,'1234');assert.equal(st.due,'2026-11-05');assert.equal(st.items.length,1);
 const m=buildRequest({task:'money',facts:{disponible:1000},question:'una cena'});assert.match(m.system,/conviene hacer este gasto/);
 assert.equal(m.shape({verdict:'no',answer:'Mejor no.',tips:['Esperá al cobro']}).verdict,'no');
 const l=buildRequest({task:'lesson',level:'B1',topic:'pedir un aumento'});assert.match(l.system,/B1/);
 assert.throws(()=>l.shape({title:'x',vocab:[],dialogue:[]}));
 const c=buildRequest({task:'correct',text:'I go yesterday to the office',level:'A2'}).shape({corrected:'I went to the office yesterday.',mistakes:[{wrong:'go',right:'went',why:'pasado'}],words:[{en:'yesterday',es:'ayer'}]});
 assert.equal(c.mistakes[0].right,'went');assert.equal(c.words[0].es,'ayer');
});
