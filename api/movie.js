// GET /api/movie?title=&original=&year= · one film's poster, synopsis in Spanish and where to watch it in Argentina.
// Sources, in order:
//  - TMDB, when TMDB_API_KEY is set in Vercel (free key at themoviedb.org → Settings → API; the v3 key or the
//    "read access token" both work): poster, Spanish synopsis, runtime, genres and the platforms in Argentina
//    (TMDB's watch providers, data by JustWatch).
//  - Apple's catalogue (iTunes) and Wikipedia, without a key: poster and, from Wikipedia in Spanish, the synopsis.
// Without TMDB the platforms can't be known for sure, so the answer carries a JustWatch search link instead.
const clip=(v,n)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
export const norm=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/^(the|el|la|los|las|a|an) /,'').trim();
const near=(a,b)=>!a||!b||Math.abs(+a-+b)<=1;
const sameTitle=(a,names)=>{const x=norm(a);return !!x&&names.some(n=>n&&(x===n||x.startsWith(n+' ')||n.startsWith(x+' ')))};
const IMG='https://image.tmdb.org/t/p/';

async function getJSON(fetch,url,init){const r=await fetch(url,init);if(!r.ok)throw Object.assign(Error('HTTP '+r.status),{status:r.status});return r.json()}

async function fromTMDB(q,{fetch,key}){
 const bearer=/^ey/.test(key),call=(path,params)=>{const u=new URL('https://api.themoviedb.org/3/'+path);for(const [k,v]of Object.entries(params))if(v)u.searchParams.set(k,v);if(!bearer)u.searchParams.set('api_key',key);
  return getJSON(fetch,u.toString(),{headers:bearer?{authorization:'Bearer '+key,accept:'application/json'}:{accept:'application/json'}})};
 const names=[norm(q.original),norm(q.title)].filter(Boolean);let hit=null;
 for(const [query,year]of [[q.original||q.title,q.year],[q.title,q.year],[q.original||q.title,'']]){if(!query)continue;
  const res=await call('search/movie',{query,year,language:'es-AR',include_adult:'false'});const rows=res.results||[];
  const match=rows.filter(r=>sameTitle(r.original_title,names)||sameTitle(r.title,names));
  hit=match.find(r=>near(String(r.release_date||'').slice(0,4),q.year))||(year&&rows.length===1?rows[0]:null);
  if(hit)break}
 if(!hit)return null;
 const d=await call('movie/'+hit.id,{language:'es-AR',append_to_response:'watch/providers'});
 let overview=d.overview;if(!overview){try{overview=(await call('movie/'+hit.id,{language:'en-US'})).overview}catch{}}
 const ar=d['watch/providers']?.results?.AR||{},seen=new Set(),providers=[];
 for(const [list,kind]of [['flatrate','stream'],['free','free'],['ads','free'],['rent','rent'],['buy','buy']])for(const p of ar[list]||[]){const id=p.provider_name+'|'+kind;if(seen.has(id))continue;seen.add(id);
  providers.push({name:clip(p.provider_name,60),logo:p.logo_path?IMG+'w92'+p.logo_path:'',kind})}
 return {source:'tmdb',tmdbId:d.id,title:clip(d.title,160),original:clip(d.original_title,160),year:String(d.release_date||'').slice(0,4),poster:d.poster_path?IMG+'w500'+d.poster_path:'',backdrop:d.backdrop_path?IMG+'w780'+d.backdrop_path:'',
  synopsis:clip(overview,1500),runtime:d.runtime||0,genres:(d.genres||[]).map(g=>g.name).slice(0,3),providers,link:ar.link||'',checked:true};
}

async function fromITunes(q,{fetch}){
 const names=[norm(q.original),norm(q.title)].filter(Boolean);
 for(const country of ['US','AR'])for(const term of [...new Set([q.original,q.title].filter(Boolean))]){try{
  const res=await getJSON(fetch,`https://itunes.apple.com/search?${new URLSearchParams({term,entity:'movie',limit:'10',country})}`);
  const hit=(res.results||[]).find(r=>sameTitle(r.trackName,names)&&near(String(r.releaseDate||'').slice(0,4),q.year));
  if(hit?.artworkUrl100)return {poster:String(hit.artworkUrl100).replace(/\/\d+x\d+bb\./,'/600x900bb.'),synopsis:'',url:hit.trackViewUrl||''}}catch{}}
 return null;
}

async function fromWikipedia(q,{fetch}){
 const names=[norm(q.original),norm(q.title)].filter(Boolean),out={};
 const clean=t=>norm(String(t).replace(/\s*\((\d{4} )?(film|pel[ií]cula)[^)]*\)$/i,''));
 try{const res=await getJSON(fetch,'https://en.wikipedia.org/w/api.php?'+new URLSearchParams({action:'query',generator:'search',gsrsearch:`${q.original||q.title} ${q.year||''} film`,gsrlimit:'5',prop:'pageimages|description',piprop:'thumbnail',pithumbsize:'600',pilicense:'any',format:'json',origin:'*'}));
  const pages=Object.values(res.query?.pages||{}).sort((a,b)=>a.index-b.index);
  const p=pages.find(p=>names.includes(clean(p.title))&&/film|movie/i.test(p.description||'')&&(!q.year||(p.title+' '+(p.description||'')).includes(q.year)||!/\d{4}/.test(p.description||'')))||pages.find(p=>names.includes(clean(p.title))&&/film/i.test(p.description||''));
  if(p?.thumbnail?.source)out.poster=p.thumbnail.source}catch{}
 try{const res=await getJSON(fetch,'https://es.wikipedia.org/w/api.php?'+new URLSearchParams({action:'query',generator:'search',gsrsearch:`${q.title} película ${q.year||''}`,gsrlimit:'5',prop:'extracts|pageimages',exintro:'1',explaintext:'1',exchars:'900',piprop:'thumbnail',pithumbsize:'600',format:'json',origin:'*'}));
  const pages=Object.values(res.query?.pages||{}).sort((a,b)=>a.index-b.index);
  const p=pages.find(p=>names.includes(clean(p.title))&&/pel[ií]cula|film/i.test(p.extract||'')&&(!q.year||(p.extract||'').includes(q.year)));
  if(p){out.synopsis=clip(String(p.extract||'').replace(/\s*\([^)]*\)/,''),900);if(!out.poster&&p.thumbnail?.source)out.poster=p.thumbnail.source}}catch{}
 return out.poster||out.synopsis?out:null;
}

export async function movieInfo(input,{fetch=globalThis.fetch,env={}}={}){
 const q={title:clip(input.title,160),original:clip(input.original,160),year:clip(input.year,4).replace(/\D/g,'')};
 if(!q.title&&!q.original)throw Object.assign(Error('Falta el título.'),{status:400});
 const search=`https://www.justwatch.com/ar/buscar?q=${encodeURIComponent(q.title||q.original)}`;
 let info=null;const key=String(env.TMDB_API_KEY||'').trim();
 if(key){try{info=await fromTMDB(q,{fetch,key})}catch{info=null}}
 info||={source:'open',providers:[],checked:false};
 if(!info.poster){const it=await fromITunes(q,{fetch});if(it?.poster){info.poster=it.poster;info.url||=it.url}}
 if(!info.poster||!info.synopsis){const w=await fromWikipedia(q,{fetch});if(w){info.poster||=w.poster||'';info.synopsis||=w.synopsis||''}}
 return {...info,poster:info.poster||'',synopsis:info.synopsis||'',providers:info.providers||[],link:info.link||search,search,tmdb:!!key};
}

export default async function handler(req,res){
 const send=(status,data,cache)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':cache||'no-store'});res.end(JSON.stringify(data))};
 if(req.method!=='GET')return send(405,{error:'Usá GET.'});
 try{const u=new URL(req.url,'https://nubo.local');
  send(200,await movieInfo(Object.fromEntries(u.searchParams),{env:process.env}),'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800')}
 catch(e){send(e.status||500,{error:e.status?e.message:'No se pudo buscar la película.'})}
}
