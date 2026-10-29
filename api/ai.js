// POST /api/ai · AI for nubo (recommendations and questions about your own data).
// Vercel → Settings → Environment Variables (at least one key):
//   GROQ_API_KEY (Groq, free, console.groq.com) · GEMINI_API_KEY (Gemini, free tier, aistudio.google.com)
//   XAI_API_KEY (Grok) · ANTHROPIC_API_KEY (Claude) — all optional, at least one
//   AI_PROVIDERS (order, default "groq,gemini,grok,claude") · GROQ_MODEL / GEMINI_MODEL / XAI_MODEL / AI_MODEL (comma lists)
//   AI_ALLOWED_EMAILS (recommended: only these accounts can use it)
import config from '../src/public-config.json' with {type:'json'};
import {buildRequest,callAI,providersFrom,checkUser,transcribe} from './ai-core.mjs';

const buckets=new Map();
function limited(id){const now=Date.now(),hits=(buckets.get(id)||[]).filter(t=>now-t<60000);hits.push(now);buckets.set(id,hits);return hits.length>12}
async function readAudio(req){const parts=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4_400_000)throw Object.assign(Error('Ese pedazo de audio es demasiado grande.'),{status:413});parts.push(chunk)}return Buffer.concat(parts)}
async function readBody(req){if(req.body&&typeof req.body==='object')return req.body;if(typeof req.body==='string')return JSON.parse(req.body||'{}');
 let raw='';for await(const chunk of req)raw+=chunk;if(raw.length>200000)throw Object.assign(Error('Pedido demasiado grande.'),{status:413});return JSON.parse(raw||'{}')}
const send=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data))};

export default async function handler(req,res){
 if(req.method!=='POST')return send(res,405,{error:'Usá POST.'});
 try{
  const providers=providersFrom(process.env),audio=/^audio\//.test(String(req.headers['content-type']||''));
  if(!providers.length&&!audio)return send(res,503,{error:'Falta configurar la IA: agregá GROQ_API_KEY (Groq, gratis) o GEMINI_API_KEY (Gemini) en Vercel.'});
  const user=await checkUser(String(req.headers.authorization||'').replace(/^Bearer\s+/i,''),{
   url:process.env.PUBLIC_SUPABASE_URL||config.url,key:process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY||config.key,allowed:process.env.AI_ALLOWED_EMAILS||''});
  if(limited(user.id))return send(res,429,{error:'Muchos pedidos seguidos. Esperá un minuto.'});
  // a piece of a recording to turn into text
  if(audio)return send(res,200,await transcribe(await readAudio(req),{type:String(req.headers['content-type']).split(';')[0],env:process.env}));
  const request=buildRequest(await readBody(req));
  send(res,200,await callAI(request,{providers}));
 }catch(e){send(res,e.status||500,{error:e.status?e.message:'No se pudo completar el pedido a la IA.'})}
}
