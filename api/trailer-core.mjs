// The build embeds the existing standalone pages in this module. No account keys.
const SITE_PAGES = {}; // BUILD_EMBED_PAGES
const trailerCache=new Map(),inflight=new Map(),rateBuckets=new Map();
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const plain=r=>r?.simpleText||(r?.runs||[]).map(x=>x.text||'').join('');
export function youtubeInitialData(html){
  const marker=/\b(?:var\s+)?ytInitialData\s*=\s*|window\["ytInitialData"\]\s*=\s*/g;const match=marker.exec(html);if(!match)return null;
  let begin=html.indexOf('{',marker.lastIndex),depth=0,quoted=false,escaped=false;
  for(let i=begin;i<html.length;i++){const c=html[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue}if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){try{return JSON.parse(html.slice(begin,i+1))}catch{return null}}}return null;
}
export function youtubeTrailerCandidates(data,title,original,language){
  const rows=[],walk=value=>{if(!value||typeof value!=='object')return;if(value.videoRenderer)rows.push(value.videoRenderer);for(const [key,child]of Object.entries(value))if(key!=='videoRenderer'){if(Array.isArray(child))child.forEach(walk);else if(child&&typeof child==='object')walk(child)}};walk(data);
  const stop=new Set(['the','a','an','el','la','los','las','de','del','en','un','una','pelicula']);const variants=[title,original].filter(Boolean).map(s=>normalize(s).split(/[^a-z0-9]+/).filter(w=>w.length>1&&!stop.has(w)));
  return rows.map(r=>{const label=plain(r.title),channel=plain(r.ownerText||r.longBylineText),text=normalize(label+' '+channel),duration=plain(r.lengthText),parts=duration.split(':').map(Number),seconds=parts.length===2?parts[0]*60+parts[1]:9999;
    const coverage=Math.max(0,...variants.map(words=>words.length?words.filter(w=>text.includes(w)).length/words.length:0));
    const latino=/latino|latinoamerica|doblaje latino|audio latino|mexico|argentina|subtitulado/.test(text),spain=/castellano|espana|\bes-es\b|sony pictures espana|warner bros\. espana/.test(text)&&!latino;
    const spanish=latino||spain||/espanol|doblado/.test(text),english=/english|official.*trailer/.test(text),trailer=/trailer|teaser|avance/.test(text),bad=/reaccion|reaction|analisis|analysis|explicad|explicacion|ending|resumen|review|recap|pelicula completa|full movie|escena|scene|soundtrack|fan made|fanmade|concept trailer/.test(text);
    const official=/oficial|official|warner|universal|paramount|disney|sony pictures|20th century|a24|marvel|netflix|lionsgate/.test(text);
    return {id:r.videoId,title:label,channel,language:spanish?'es':english?'en':'und',score:coverage*50+(spanish?25:0)+(latino?30:0)-(spain?20:0)+(official?12:0)+(/warner|universal|paramount|disney|sony pictures|20th century|a24|marvel|netflix|lionsgate|hbo/.test(normalize(channel))?18:0)+(trailer?10:0),valid:!!r.videoId&&/^[-\w]{11}$/.test(r.videoId)&&coverage>=.6&&trailer&&!bad&&seconds>=20&&seconds<=480};
  }).filter(r=>r.valid).sort((a,b)=>b.score-a.score).map(({valid,score,...row})=>row);
}
async function youtubeSearch(query,title,original,language){const response=await fetch('https://www.youtube.com/results?'+new URLSearchParams({search_query:query,hl:language==='es'?'es':'en',gl:'AR'}),{signal:AbortSignal.timeout(8500),headers:{Accept:'text/html'}});if(!response.ok)throw Error('YouTube unavailable');const html=await response.text();if(html.length>5000000)throw Error('Search too large');const data=youtubeInitialData(html);if(!data)throw Error('Search unavailable');return youtubeTrailerCandidates(data,title,original,language)}
// Spanish from Latin America first: TMDB's trailers for Mexico/Argentina (when TMDB_API_KEY is set), then YouTube.
async function tmdbTrailers(title,original,year){const key=String(globalThis.process?.env?.TMDB_API_KEY||'').trim();if(!key)return [];
 const bearer=/^ey/.test(key),call=async(path,params)=>{const u=new URL('https://api.themoviedb.org/3/'+path);for(const [k,v]of Object.entries(params))if(v)u.searchParams.set(k,v);if(!bearer)u.searchParams.set('api_key',key);const r=await fetch(u,{headers:bearer?{authorization:'Bearer '+key}:{},signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error('TMDB');return r.json()};
 const res=await call('search/movie',{query:original||title,year,language:'es-MX'}),want=[original,title].filter(Boolean).map(normalize);
 const hit=(res.results||[]).find(m=>want.includes(normalize(m.original_title))||want.includes(normalize(m.title)))||(res.results||[])[0];if(!hit)return [];
 const v=await call('movie/'+hit.id+'/videos',{language:'es-MX',include_video_language:'es,en'}),rows=(v.results||[]).filter(x=>x.site==='YouTube'&&/^[-\w]{11}$/.test(x.key)&&/Trailer|Teaser/.test(x.type));
 const rank=x=>(x.iso_639_1==='es'&&['MX','AR','CO','CL','419'].includes(x.iso_3166_1)?3:x.iso_639_1==='es'&&x.iso_3166_1!=='ES'?2:x.iso_639_1==='es'?1:0)*10+(x.official?2:0)+(x.type==='Trailer'?1:0);
 return rows.sort((a,b)=>rank(b)-rank(a)).slice(0,4).map(x=>({id:x.key,title:x.name,channel:'TMDB',language:x.iso_639_1==='es'?'es':x.iso_639_1==='en'?'en':'und',latino:rank(x)>=20}))}
async function findTrailers(title,original,year){const results=await Promise.allSettled([tmdbTrailers(title,original,year),youtubeSearch(`${title} ${year} tráiler oficial español latino`,title,original,'es'),youtubeSearch(`${original||title} ${year} tráiler doblaje latino`,title,original,'es'),youtubeSearch(`${original||title} ${year} official trailer`,title,original,'en')]);
 const tmdb=results[0].status==='fulfilled'?results[0].value:[],latinTmdb=tmdb.filter(v=>v.latino),rest=results.slice(1).flatMap(r=>r.status==='fulfilled'?r.value:[]);
 const videos=[...new Map([...latinTmdb,...rest,...tmdb].map(r=>[r.id,r])).values()].sort((a,b)=>Number(b.language==='es')-Number(a.language==='es')).slice(0,8).map(({latino,...v})=>v);return {videos,source:'YouTube',unavailable:results.slice(1).every(r=>r.status==='rejected')&&!tmdb.length}}
function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff',...headers}})}
export default {async fetch(request){const url=new URL(request.url);if(!['GET','HEAD'].includes(request.method))return json({error:'Método no permitido'},405);
  if(url.pathname==='/api/trailer-search'){
    if(request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'Origen no permitido'},403);
    const title=(url.searchParams.get('title')||'').trim(),original=(url.searchParams.get('original')||'').trim(),year=url.searchParams.get('year')||'';
    if(!title||title.length>140||original.length>140||year&&!/^(18|19|20|21)\d{2}$/.test(year))return json({error:'Revisá el título y el año.'},400);
    const key=normalize(title)+'|'+normalize(original)+'|'+year,now=Date.now(),cached=trailerCache.get(key);if(cached&&cached.until>now)return json(cached.value);
    const client=request.headers.get('CF-Connecting-IP')||'site',bucket=rateBuckets.get(client);if(bucket&&now-bucket.start<60000&&bucket.count>=12)return json({error:'Esperá un momento para volver a buscar.'},429,{'Retry-After':'60'});rateBuckets.set(client,bucket&&now-bucket.start<60000?{...bucket,count:bucket.count+1}:{start:now,count:1});if(rateBuckets.size>500)rateBuckets.delete(rateBuckets.keys().next().value);
    let job=inflight.get(key);if(!job){job=findTrailers(title,original,year).finally(()=>inflight.delete(key));inflight.set(key,job)}
    try{const result=await job;if(!result.unavailable){trailerCache.set(key,{until:now+21600000,value:result});if(trailerCache.size>200)trailerCache.delete(trailerCache.keys().next().value)}return json(result,result.unavailable?503:200)}catch{return json({videos:[],unavailable:true},503)}
  }
  const path=url.pathname.replace(/\/$/,'')||'/',name=path==='/'?'index':path.replace(/^\//,'').replace(/\.html$/,'');const page=Object.hasOwn(SITE_PAGES,name)?SITE_PAGES[name]:null;if(page)return new Response(request.method==='HEAD'?null:page,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  if(path==='/favicon.ico')return new Response(null,{status:204});return new Response('No se encontró esta página.',{status:404});
}};
