// nubo · AI. Pure logic for /api/ai: checks the request, builds the prompt, calls the AI (Groq, Gemini, Grok or Claude)
// and turns the answer into data the apps can show. The keys live only on the server (Vercel environment variables).
export const MODEL_DEFAULT='claude-sonnet-5-5';
const KINDS={movies:'películas',music:'música (álbumes o artistas)',books:'libros'};
// amounts as the model may write them: 1500.5, "1.500,50" (Argentina) or "$ 1,500.50"
export const amountOf=v=>{if(typeof v==='number')return Number.isFinite(v)?Math.round(v*100)/100:0;let t=String(v??'').replace(/[^\d.,-]/g,'');if(/,\d{1,2}$/.test(t))t=t.replace(/\./g,'').replace(',','.');else t=t.replace(/,/g,'');const n=Number(t);return Number.isFinite(n)?Math.round(n*100)/100:0};
const clip=(v,n)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);

// The model is asked for JSON only; this finds the JSON even if it comes wrapped in a code fence or a sentence.
// Line breaks typed inside a string (not allowed in JSON) are escaped, so "summary":"one\n two" still reads.
function escapeInStrings(t){let out='',inStr=false,esc=false;for(const ch of t){if(inStr){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch==='"')inStr=false;else if(ch==='\n'){out+='\\n';continue}else if(ch==='\r'){continue}else if(ch==='\t'){out+='\\t';continue}}else if(ch==='"')inStr=true;out+=ch}return out}
export function readJSON(text){
 const t=String(text||'').trim();
 for(const candidate of [t,t.replace(/^```(?:json)?\s*|\s*```$/g,'')]){try{return JSON.parse(candidate)}catch{}try{return JSON.parse(escapeInStrings(candidate))}catch{}}
 const start=t.search(/[[{]/);if(start<0)throw Error('La IA no devolvió datos.');
 const open=t[start],close=open==='{'?'}':']',end=t.lastIndexOf(close);
 try{return JSON.parse(t.slice(start,end+1))}catch{throw Error('La IA devolvió una respuesta que no se pudo leer.')}
}

export function buildRequest(body){
 if(!body||typeof body!=='object')throw Object.assign(Error('Pedido vacío.'),{status:400});
 const today=clip(body.today,10)||new Date().toISOString().slice(0,10);
 if(body.task==='recommend'){
  const kind=KINDS[body.kind]?body.kind:null;if(!kind)throw Object.assign(Error('Tipo de recomendación desconocido.'),{status:400});
  const saved=(Array.isArray(body.saved)?body.saved:[]).slice(0,80).map(s=>({title:clip(s.title,120),creator:clip(s.creator,80),status:clip(s.status,30),rating:Number.isFinite(+s.rating)&&+s.rating>0?+s.rating:undefined}));
  const wish=clip(body.wish,300),exclude=(Array.isArray(body.exclude)?body.exclude:[]).slice(0,120).map(t=>clip(t,80)).filter(Boolean);
  return {max_tokens:1500,
   system:`Sos el recomendador personal de nubo, la app de Franco (Argentina). Recomendás ${KINDS[kind]} con criterio, en español rioplatense, breve y cálido. `+
    `Basate en lo que ya guardó: qué terminó, qué puntuó alto, qué quiere ver o leer. No repitas nada de su lista. Mezclá algo seguro con algún descubrimiento menos obvio. `+
    `Solo obras reales y verificables; si no estás seguro de un dato (año, autor), dejalo vacío. `+
    `Respondé SOLO con JSON: {"items":[{"title":"","original":"","creator":"","year":"","genre":"","synopsis":"","why":""}]} con 6 elementos. "title" es el título como se conoce en Argentina y "original" el título original. "creator" es director, artista o autor. "genre" es un género breve en español. "synopsis" es de qué trata, sin spoilers: 2 o 3 oraciones con el planteo, el tono y qué la hace especial, hasta 420 caracteres (para música: cómo suena). Todo en español, aunque la obra sea en otro idioma. "why" es una frase de hasta 140 caracteres que conecte con sus gustos.`,
   messages:[{role:'user',content:`Fecha: ${today}.\nLo que tiene guardado (${KINDS[kind]}):\n${saved.length?saved.map(s=>`- ${s.title}${s.creator?' · '+s.creator:''}${s.status?' · '+s.status:''}${s.rating?' · '+s.rating+'/5':''}`).join('\n'):'(todavía nada: recomendá clásicos accesibles y variados)'}\n${wish?`Lo que busca ahora: ${wish}\n`:''}${exclude.length?`Ya le mostré estas, no las repitas: ${exclude.join('; ')}\n`:''}Dame las 6 recomendaciones.`}],
   shape:data=>({items:(Array.isArray(data?.items)?data.items:[]).slice(0,8).map(i=>({title:clip(i.title,120),original:clip(i.original,120),creator:clip(i.creator,80),year:clip(i.year,10).replace(/[^\d]/g,'').slice(0,4),genre:clip(i.genre,40),synopsis:clip(i.synopsis,500),why:clip(i.why,200)})).filter(i=>i.title)})};
 }
 if(body.task==='ask'){
  const question=clip(body.question,400);if(question.length<2)throw Object.assign(Error('Escribí una pregunta.'),{status:400});
  const items=(Array.isArray(body.items)?body.items:[]).slice(0,120).map((e,i)=>`[${i}] ${clip(e.app,12)} · ${clip(e.kind,30)} · ${clip(e.title,120)}${e.subtitle?' · '+clip(e.subtitle,160):''}${Number.isFinite(+e.amount)&&e.amount!==null&&e.amount!==''?' · '+e.amount+' '+clip(e.currency||'ARS',4):''}${e.text?' — '+clip(e.text,220):''}`);
  return {max_tokens:900,
   system:`Sos el buscador inteligente de nubo, la app personal de Franco, que reúne numio (finanzas), domo (hogar), lecta (notas, libros, películas, música) y foco (tareas, hábitos, agenda). `+
    `Respondé su pregunta usando SOLO los registros que te paso; si no alcanzan, decilo con honestidad y sugerí qué buscar. Español rioplatense, directo, hasta 3 frases. Sumá importes si te lo pide y mostrá la cuenta. `+
    `Respondé SOLO con JSON: {"answer":"","refs":[números de los registros que usaste, los más relevantes primero, hasta 6]}.`,
   messages:[{role:'user',content:`Fecha: ${today}.\nRegistros:\n${items.join('\n')||'(no hay registros que coincidan)'}\n\nPregunta: ${question}`}],
   shape:data=>({answer:clip(data?.answer,1200),refs:(Array.isArray(data?.refs)?data.refs:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<items.length).slice(0,6)})};
 }
 // What a film or book is about, without spoilers (the "Resumen sin spoilers" button, like in Personal OS)
 if(body.task==='about'){
  const kind=body.kind==='libro'?'libro':'película',title=clip(body.title,160);if(!title)throw Object.assign(Error('Falta el título.'),{status:400});
  const facts=[`${kind==='libro'?'Libro':'Película'}: «${title}»`,body.original&&clip(body.original,160)!==title?`Título original: ${clip(body.original,160)}`:'',body.creator?`${kind==='libro'?'Autor':'Dirección'}: ${clip(body.creator,120)}`:'',body.year?`Año: ${clip(body.year,4)}`:'',body.synopsis?`Sinopsis de referencia: ${clip(body.synopsis,1500)}`:''].filter(Boolean).join('\n');
  return {max_tokens:900,
   system:`Sos el crítico amigo de lecta, la app de Franco (Argentina). Contá de qué trata la obra SIN SPOILERS: nada del giro central, del final ni de quién muere o quién es culpable. Usá lo que sepas de la obra real; la sinopsis de referencia es solo una ayuda. Si no la conocés, basate en esa sinopsis y no inventes datos. `+
    `Español rioplatense, cálido y concreto. En "summary", 110 a 170 palabras en 2 párrafos (separados con \n): el planteo y los temas principales, y después el tono, el ritmo y por qué vale la pena. En "forWho", una frase: a quién le puede gustar. En "mood", hasta 4 palabras sueltas sobre el clima (ej.: "melancólica", "tensa"). `+
    `Respondé SOLO con JSON: {"summary":"","forWho":"","mood":[""]}.`,
   messages:[{role:'user',content:facts}],
   shape:data=>({summary:String(data?.summary??'').slice(0,2400).trim(),forWho:clip(data?.forWho,240),mood:(Array.isArray(data?.mood)?data.mood:[]).map(m=>clip(m,24)).filter(Boolean).slice(0,4)})};
 }
 // lecta · English: correct a text, a tutor to talk with, a new lesson in the app's own format
 const LEVELS=['A1','A2','B1','B2','C1'];
 if(body.task==='correct'){const text=clip(body.text,6000);if(text.length<3)throw Object.assign(Error('Escribí algo en inglés primero.'),{status:400});
  return {max_tokens:1800,system:`Sos un profesor de inglés paciente para Franco (hispanohablante de Argentina, nivel ${LEVELS.includes(body.level)?body.level:'A2'}). Corregí su texto en inglés. `+
   `"corrected": el texto completo corregido, natural, sin cambiar lo que quiso decir. "mistakes": hasta 8 errores {"wrong":"","right":"","why":"explicación breve en español"}. "better": una o dos frases que sonarían más naturales. "level": nivel MCER estimado del texto. "words": hasta 6 palabras o expresiones útiles del texto o de la corrección {"en":"","es":"","example":""}. "praise": una frase corta en español sobre lo que hizo bien. `+
   `Respondé SOLO con JSON: {"corrected":"","mistakes":[],"better":[],"level":"","words":[],"praise":""}.`,messages:[{role:'user',content:text}],
   shape:d=>({corrected:clip(d?.corrected,8000),mistakes:(Array.isArray(d?.mistakes)?d.mistakes:[]).slice(0,8).map(m=>({wrong:clip(m.wrong,200),right:clip(m.right,200),why:clip(m.why,300)})).filter(m=>m.wrong||m.right),
    better:(Array.isArray(d?.better)?d.better:[]).map(x=>clip(x,300)).filter(Boolean).slice(0,3),level:clip(d?.level,4),words:(Array.isArray(d?.words)?d.words:[]).slice(0,6).map(w=>({en:clip(w.en,80),es:clip(w.es,120),example:clip(w.example,200)})).filter(w=>w.en&&w.es),praise:clip(d?.praise,200)})};}
 if(body.task==='tutor'){const level=LEVELS.includes(body.level)?body.level:'A2',scene=clip(body.scene,120)||'charla libre';
  const msgs=(Array.isArray(body.messages)?body.messages:[]).slice(-16).map(m=>({role:m.role==='assistant'?'assistant':'user',content:clip(m.content,800)})).filter(m=>m.content);
  if(!msgs.length||msgs.at(-1).role!=='user')msgs.push({role:'user',content:'(Start the conversation.)'});
  if(msgs[0].role!=='user')msgs.unshift({role:'user',content:'(Start the conversation.)'});
  return {max_tokens:700,system:`You are a friendly English conversation partner for Franco, a Spanish speaker from Argentina (CEFR ${level}). Scenario: ${scene}. Keep the conversation going: reply in simple, natural English for his level (1–3 short sentences) and end with a question. `+
   `If his last message has mistakes, put a gentle correction in "fix" (the corrected sentence) and "why" (very short, in Spanish); otherwise leave them empty. "es" is the Spanish translation of your reply. Respond ONLY with JSON: {"reply":"","es":"","fix":"","why":""}.`,messages:msgs,
   shape:d=>({reply:clip(d?.reply,700),es:clip(d?.es,700),fix:clip(d?.fix,400),why:clip(d?.why,300)})};}
 if(body.task==='lesson'){const level=LEVELS.includes(body.level)?body.level:'A2',topic=clip(body.topic,120);
  return {max_tokens:3500,system:`Armá una lección de inglés de 8 minutos para Franco (Argentina), nivel ${level}${topic?', sobre: '+topic:', sobre una situación útil de la vida cotidiana o del trabajo que elijas vos'}. Explicaciones en español rioplatense, ejemplos en inglés natural. `+
   `Respondé SOLO con JSON con esta forma exacta: {"title":"(en español)","topic":"(en inglés)","vocab":[{"en":"","es":"","example":""}] (8),"grammar":{"title":"","explain":"","examples":[{"en":"","es":""}] (3),"exercises":[{"prompt":"con ___","options":["","",""],"answer":"(una de las options)"}] (3)},"dialogue":[{"speaker":"A","en":"","es":""}] (6 a 8, A y B),"questions":[{"q":"","options":["","",""],"answer":0}] (2, answer es el índice),"speak":[{"en":"","es":""}] (3)}.`,
   messages:[{role:'user',content:'Nueva lección, por favor.'}],
   shape:d=>{const arr=(v,n)=>(Array.isArray(v)?v:[]).slice(0,n);const pair=x=>({en:clip(x?.en,240),es:clip(x?.es,240)});
    const out={title:clip(d?.title,80),topic:clip(d?.topic,80),level,minutes:8,vocab:arr(d?.vocab,10).map(v=>({...pair(v),example:clip(v?.example,240)})).filter(v=>v.en&&v.es),
     grammar:{title:clip(d?.grammar?.title,120),explain:clip(d?.grammar?.explain,800),examples:arr(d?.grammar?.examples,4).map(pair).filter(x=>x.en),exercises:arr(d?.grammar?.exercises,4).map(x=>{const options=arr(x?.options,4).map(o=>clip(o,60)).filter(Boolean);return {prompt:clip(x?.prompt,200),options,answer:options.includes(clip(x?.answer,60))?clip(x.answer,60):options[0]}}).filter(x=>x.prompt&&x.options.length>=2)},
     dialogue:arr(d?.dialogue,10).map(x=>({speaker:x?.speaker==='B'?'B':'A',...pair(x)})).filter(x=>x.en),questions:arr(d?.questions,3).map(x=>{const options=arr(x?.options,4).map(o=>clip(o,120)).filter(Boolean);return {q:clip(x?.q,200),options,answer:Math.min(options.length-1,Math.max(0,parseInt(x?.answer,10)||0))}}).filter(x=>x.q&&x.options.length>=2),speak:arr(d?.speak,4).map(pair).filter(x=>x.en)};
    if(!out.title||out.vocab.length<4||!out.dialogue.length)throw Object.assign(Error('La IA armó una lección incompleta. Probá de nuevo.'),{status:502});return out}};}
 // numio · money: advice on the month and "¿puedo hacer este gasto?" from the numbers the app already computed
 if(body.task==='money'){const facts=clip(JSON.stringify(body.facts||{}),6000),question=clip(body.question,300);
  return {max_tokens:1200,system:`Sos el asesor financiero personal de numio para Franco (Argentina, pesos; inflación alta: pensá en términos del mes). No sos un asesor matriculado: das orientación práctica, no recomendaciones de inversión. Usá SOLO los números que te paso; no inventes ingresos ni gastos. Español rioplatense, directo y amable. `+
   (question?`Responde si conviene hacer este gasto: "${question}". "verdict" es "si", "con cuidado" o "no". "answer": 2 o 3 frases con la cuenta (cuánto le queda por día después del gasto, qué compromisos vienen). "tips": hasta 3 alternativas o condiciones (cuotas, esperar al cobro, recortar algo concreto).`:
    `"answer": un diagnóstico del mes en 2 o 3 frases. "tips": de 3 a 5 recomendaciones concretas para recortar o reordenar, cada una con la categoría y un monto estimado de ahorro cuando se pueda. "verdict" vacío.`)+
   ` Respondé SOLO con JSON: {"verdict":"","answer":"","tips":[""]}.`,messages:[{role:'user',content:'Datos del mes (JSON):\n'+facts}],
   shape:d=>({verdict:['si','con cuidado','no'].includes(String(d?.verdict||'').toLowerCase().replace('sí','si'))?String(d.verdict).toLowerCase().replace('sí','si'):'',answer:clip(d?.answer,900),tips:(Array.isArray(d?.tips)?d.tips:[]).map(t=>clip(t,300)).filter(Boolean).slice(0,5)})};}
 // numio · a credit card statement (text from a PDF or a photo) turned into data
 if(body.task==='statement'){const text=clip(body.text,14000);if(text.length<40)throw Object.assign(Error('No encontré texto en el resumen.'),{status:400});
  return {max_tokens:3000,system:`Leé el resumen de tarjeta de crédito de un banco argentino y extraé los datos. Fechas como AAAA-MM-DD (hoy es ${today}). Importes como número sin separador de miles y con punto decimal. Si un dato no está, dejalo vacío. `+
   `"card": nombre de la tarjeta (ej. "Visa Galicia"), "last4": últimos 4 dígitos, "closing": fecha de cierre actual, "due": vencimiento actual, "nextClosing" y "nextDue": los próximos si figuran, "total": saldo a pagar en pesos, "totalUSD": en dólares, "minimum": pago mínimo, "items": hasta 60 consumos del período {"date":"","text":"","amount":0,"currency":"ARS|USD","installment":"3/6 si es en cuotas"}. `+
   `Respondé SOLO con JSON: {"card":"","last4":"","closing":"","due":"","nextClosing":"","nextDue":"","total":0,"totalUSD":0,"minimum":0,"items":[]}.`,messages:[{role:'user',content:text}],
   shape:d=>{const day=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v:'',num=amountOf;
    return {card:clip(d?.card,60),last4:String(d?.last4??'').replace(/\D/g,'').slice(-4),closing:day(d?.closing),due:day(d?.due),nextClosing:day(d?.nextClosing),nextDue:day(d?.nextDue),total:num(d?.total),totalUSD:num(d?.totalUSD),minimum:num(d?.minimum),
     items:(Array.isArray(d?.items)?d.items:[]).slice(0,60).map(i=>({date:day(i?.date),text:clip(i?.text,120),amount:num(i?.amount),currency:i?.currency==='USD'?'USD':'ARS',installment:clip(i?.installment,10)})).filter(i=>i.text&&i.amount)}}};}
 // lecta: actions on a text (like Personal OS: select text → ask the AI)
 const text=clip(body.text,12000);
 if(['transform','tasks','map'].includes(body.task)&&text.length<3)throw Object.assign(Error('No hay texto para trabajar.'),{status:400});
 const base='Sos el asistente de escritura de lecta, el cuaderno de Franco (Argentina). Español rioplatense salvo que se pida otro idioma. ';
 if(body.task==='transform'){
  const ACTIONS={summary:'Resumí el texto en 3 a 6 oraciones claras, sin perder lo importante.',explain:'Explicá el texto en palabras simples, como a alguien que no lo conoce, con un ejemplo si ayuda.',
   fix:'Corregí ortografía, gramática y puntuación sin cambiar el estilo ni el sentido. Devolvé el texto completo corregido.',rewrite:'Reescribí el texto más claro y fluido, con el mismo sentido y un largo parecido.',
   english:'Traducí el texto al inglés natural.',spanish:'Traducí el texto al español rioplatense natural.',ideas:'Sacá las ideas clave del texto como una lista de 3 a 8 puntos breves, uno por línea, empezando con "- ".'};
  const action=ACTIONS[body.action]?body.action:null;if(!action)throw Object.assign(Error('Acción desconocida.'),{status:400});
  return {max_tokens:2500,system:base+ACTIONS[action]+' Respondé SOLO con JSON: {"text":""}. Usá \n para separar párrafos o puntos.',
   messages:[{role:'user',content:`Texto:\n${text}`}],shape:data=>({text:String(data?.text??'').slice(0,20000).trim()})};
 }
 if(body.task==='tasks'){
  return {max_tokens:1500,system:base+`Convertí el texto en tareas concretas y accionables (verbo al principio, hasta 120 caracteres). Si el texto menciona una fecha, ponela como AAAA-MM-DD tomando como hoy ${today}; si no, dejala vacía. Prioridad: Alta, Media o Baja. Como máximo 12. Respondé SOLO con JSON: {"tasks":[{"title":"","date":"","priority":"Media"}]}.`,
   messages:[{role:'user',content:`Texto:\n${text}`}],
   shape:data=>({tasks:(Array.isArray(data?.tasks)?data.tasks:[]).slice(0,12).map(t=>({title:clip(t.title,240),date:/^\d{4}-\d{2}-\d{2}$/.test(t.date||'')?t.date:'',priority:['Alta','Media','Baja'].includes(t.priority)?t.priority:'Media'})).filter(t=>t.title)})};
 }
 if(body.task==='map'){
  const KIND={mental:'un mapa mental: una idea central, ramas principales y detalles',conceptual:'un mapa conceptual: conceptos y cómo se relacionan, con el concepto más general en la raíz',flujo:'un diagrama de flujo como árbol: el inicio en la raíz y cada paso como hijo del anterior'};
  const kind=KIND[body.kind]?body.kind:'mental';
  return {max_tokens:2500,system:base+`Convertí el texto en ${KIND[kind]}. Entre 5 y 30 nodos, cada uno de hasta 60 caracteres. Es un árbol: cada nodo tiene un padre salvo la raíz (parent vacío). Ids cortos: n1, n2… Respondé SOLO con JSON: {"title":"","nodes":[{"id":"n1","text":"","parent":""}]}.`,
   messages:[{role:'user',content:`Texto:\n${text}`}],shape:data=>({title:clip(data?.title,100)||'Mapa',nodes:treeOf(data?.nodes)})};
 }
 throw Object.assign(Error('Tarea desconocida.'),{status:400});
}
// Keeps a valid tree (one root, known parents, no cycles, ≤100 nodes) whatever the model returned.
export function treeOf(raw){
 const list=(Array.isArray(raw)?raw:[]).slice(0,100).map((n,i)=>({id:String(n?.id||'n'+(i+1)).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,40)||'n'+(i+1),text:clip(n?.text,200),parent:String(n?.parent||'').replace(/[^a-zA-Z0-9_-]/g,'')})).filter(n=>n.text);
 const seen=new Set(),nodes=[];for(const n of list){if(seen.has(n.id))n.id=n.id+'_'+nodes.length;seen.add(n.id);nodes.push(n)}
 if(!nodes.length)return [];
 const ids=new Set(nodes.map(n=>n.id)),root=nodes.find(n=>!n.parent||!ids.has(n.parent))||nodes[0];root.parent='';
 for(const n of nodes){if(n===root)continue;if(!ids.has(n.parent)||n.parent===n.id)n.parent=root.id;
  let cur=n,steps=0;const path=new Set([n.id]);while(cur.parent&&steps++<120){if(path.has(cur.parent)){n.parent=root.id;break}path.add(cur.parent);cur=nodes.find(x=>x.id===cur.parent)}}
 return nodes;
}

// ---- Providers ---------------------------------------------------------------------------------------------
// Groq (free, console.groq.com) first, then Gemini (free tier, aistudio.google.com), Grok (xAI) and Claude.
// Only providers with a key in Vercel are used, one key each; within a provider, if a model is out of quota
// the next one of the list is tried.
export const PROVIDERS={
 groq:{env:'GROQ_API_KEY',model:'GROQ_MODEL',default:'openai/gpt-oss-120b,openai/gpt-oss-20b,llama-3.1-8b-instant',name:'Groq'},
 gemini:{env:'GEMINI_API_KEY',model:'GEMINI_MODEL',default:'gemini-flash-latest,gemini-flash-lite-latest',name:'Gemini'},
 grok:{env:'XAI_API_KEY',model:'XAI_MODEL',default:'grok-4.1-fast',name:'Grok'},
 claude:{env:'ANTHROPIC_API_KEY',model:'AI_MODEL',default:MODEL_DEFAULT,name:'Claude'},
};
const fail=(message,status=502,retry=true)=>Object.assign(Error(message),{status,retry});
async function post(f,url,headers,body,timeout){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{const response=await f(url,{method:'POST',signal:controller.signal,headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>null);return {response,data}}
 catch(e){if(e.name==='AbortError')throw fail('La IA tardó demasiado. Probá de nuevo.',504);throw fail('No se pudo conectar con la IA.')}
 finally{clearTimeout(timer)}
}
// gpt-oss models think before answering: they get room for it, little thinking and JSON mode, so the answer is never cut.
const chat=(url,label)=>async(req,{key,model,f,timeout})=>{
 const thinks=/gpt-oss/.test(model),body={model,max_tokens:thinks?req.max_tokens+2000:req.max_tokens,messages:[{role:'system',content:req.system},...req.messages],response_format:{type:'json_object'}};
 if(thinks)body.reasoning_effort='low';
 const {response,data}=await post(f,url,{authorization:'Bearer '+key},body,timeout);
 if(!response.ok)throw fail(label+' ('+model+'): '+(data?.error?.message||data?.error||response.status));
 return data?.choices?.[0]?.message?.content||'';
};
const SEND={
 groq:chat('https://api.groq.com/openai/v1/chat/completions','Groq'),
 async grok(req,{key,model,f,timeout}){
  const {response,data}=await post(f,'https://api.x.ai/v1/chat/completions',{authorization:'Bearer '+key},
   {model,max_tokens:req.max_tokens,messages:[{role:'system',content:req.system},...req.messages]},timeout);
  if(!response.ok)throw fail('Grok: '+(data?.error?.message||data?.error||response.status));
  return data?.choices?.[0]?.message?.content||'';
 },
 async gemini(req,{key,model,f,timeout}){
  const {response,data}=await post(f,'https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{'x-goog-api-key':key},
   {systemInstruction:{parts:[{text:req.system}]},contents:req.messages.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})),
    generationConfig:{responseMimeType:'application/json',maxOutputTokens:8192}},timeout); // newer models think first: leave room
  if(!response.ok)throw fail('Gemini: '+(data?.error?.message||response.status));
  return (data?.candidates?.[0]?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('');
 },
 async claude(req,{key,model,f,timeout}){
  const {response,data}=await post(f,'https://api.anthropic.com/v1/messages',{'x-api-key':key,'anthropic-version':'2023-06-01'},
   {model,max_tokens:req.max_tokens,system:req.system,messages:req.messages},timeout);
  if(!response.ok)throw fail('Claude: '+(data?.error?.message||response.status));
  return (data?.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
 },
};
// Which providers to try, in order: AI_PROVIDERS (e.g. "grok,gemini") or grok → gemini → claude; only those with a key.
export function providersFrom(env){
 const order=String(env.AI_PROVIDERS||'groq,gemini,grok,claude').split(',').map(s=>s.trim().toLowerCase()).filter(n=>PROVIDERS[n]);
 return [...new Set(order)].filter(n=>env[PROVIDERS[n].env]).flatMap(n=>String(env[PROVIDERS[n].model]||PROVIDERS[n].default).split(',').map(m=>m.trim()).filter(Boolean).map(model=>({name:n,key:env[PROVIDERS[n].env],model})));
}
export async function callAI(request,{providers,fetch:f=fetch,timeout=40000}){
 if(!providers.length)throw fail('Falta configurar la IA: agregá GROQ_API_KEY (Groq, gratis) o GEMINI_API_KEY (Gemini) en Vercel.',503,false);
 const errors=[];
 for(const p of providers){
  try{const text=await SEND[p.name](request,{key:p.key,model:p.model,f,timeout});
   try{return {...request.shape(readJSON(text)),provider:PROVIDERS[p.name].name}}catch{throw fail(PROVIDERS[p.name].name+' devolvió una respuesta que no se pudo leer.')}}
  catch(e){errors.push(e.message)}
 }
 throw fail(providers.length>1?'Ninguna IA respondió ('+errors.join(' · ')+').':errors[0]);
}
// Kept for callers of the first version.
export const callClaude=(request,{apiKey,model=MODEL_DEFAULT,fetch:f=fetch,timeout})=>callAI(request,{providers:[{name:'claude',key:apiKey,model}],fetch:f,timeout}).then(({provider,...r})=>r);

// Only a signed-in nubo account (optionally only these e-mails) can spend the key.
export async function checkUser(token,{url,key,allowed='',fetch:f=fetch}){
 if(!token)throw Object.assign(Error('Iniciá sesión en nubo para usar la IA.'),{status:401});
 const response=await f(url.replace(/\/$/,'')+'/auth/v1/user',{headers:{apikey:key,authorization:'Bearer '+token}});
 const user=response.ok?await response.json():null;
 if(!user?.id)throw Object.assign(Error('Tu sesión venció. Volvé a iniciar sesión.'),{status:401});
 const list=allowed.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(list.length&&!list.includes(String(user.email||'').toLowerCase()))throw Object.assign(Error('Esta cuenta no puede usar la IA.'),{status:403});
 return user;
}

// ---- Speech to text (recordings) ---------------------------------------------------------------------------
// Groq's Whisper first (free); Gemini as a fallback. `audio` is the file as a Buffer, ≤ 4 MB per piece.
export async function transcribe(audio,{type='audio/mp4',env,fetch:f=fetch,timeout=55000}){
 const errors=[],ext=/webm/.test(type)?'webm':/wav/.test(type)?'wav':/mpeg|mp3/.test(type)?'mp3':'m4a';
 if(env.GROQ_API_KEY)for(const model of String(env.GROQ_STT_MODEL||'whisper-large-v3-turbo,whisper-large-v3').split(',').map(s=>s.trim()).filter(Boolean)){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{const form=new FormData();form.append('file',new Blob([audio],{type}),'grabacion.'+ext);form.append('model',model);form.append('language','es');form.append('response_format','json');form.append('temperature','0');
   const r=await f('https://api.groq.com/openai/v1/audio/transcriptions',{method:'POST',signal:controller.signal,headers:{authorization:'Bearer '+env.GROQ_API_KEY},body:form});
   const data=await r.json().catch(()=>null);if(r.ok&&typeof data?.text==='string')return {text:data.text.trim(),provider:'Groq'};errors.push('Groq ('+model+'): '+(data?.error?.message||r.status))}
  catch(e){errors.push('Groq: '+(e.name==='AbortError'?'tardó demasiado':e.message))}finally{clearTimeout(timer)}
 }
 if(env.GEMINI_API_KEY){const model=String(env.GEMINI_MODEL||'gemini-flash-latest').split(',')[0].trim();
  try{const {response,data}=await post(f,'https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{'x-goog-api-key':env.GEMINI_API_KEY},
    {contents:[{role:'user',parts:[{inline_data:{mime_type:type,data:Buffer.from(audio).toString('base64')}},{text:'Transcribí este audio en español, palabra por palabra, con puntuación. Devolvé solo el texto.'}]}]},timeout);
   const text=(data?.candidates?.[0]?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('').trim();if(response.ok&&text)return {text,provider:'Gemini'};errors.push('Gemini: '+(data?.error?.message||response.status))}
  catch(e){errors.push('Gemini: '+e.message)}}
 if(!env.GROQ_API_KEY&&!env.GEMINI_API_KEY)throw fail('Falta configurar la IA: agregá GROQ_API_KEY en Vercel para pasar audio a texto.',503,false);
 throw fail('No se pudo pasar el audio a texto ('+errors.join(' · ')+').');
}
