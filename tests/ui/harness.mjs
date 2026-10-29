// Shared setup for the UI checks: serves dist/ and opens Nubo as it looks on an iPhone 402×874 installed app.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const root=path.resolve('dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};

export async function serve(){
 const server=http.createServer(async(req,res)=>{
  let file=path.join(root,decodeURIComponent(new URL(req.url,'http://x').pathname));
  if(!file.startsWith(root))return res.writeHead(403).end();
  try{if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html')}catch{file=path.join(root,'index.html')}
  try{res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(await fs.readFile(file))}catch{res.writeHead(404).end()}
 });
 await new Promise(r=>server.listen(0,r));
 return {url:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(r=>server.close(r))};
}

const IPHONE_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';

// mode: 'opaque' (status bar default: page below it, iOS reports 0/0 insets),
//       'translucent-short' (page under the status bar, 62 pt strip missing at the bottom),
//       'translucent-full' (page under the status bar, full height).
export const MODES={
 opaque:{height:812,top:0,bottom:0},
 'translucent-short':{height:812,top:62,bottom:34},
 'translucent-full':{height:874,top:62,bottom:34},
};

let browser;
// a fake camera (Chromium's test pattern) so the live scanner can be tried
export async function launch(){browser??=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});return browser}
export async function closeBrowser(){await browser?.close();browser=null}

export async function open(base,{mode='opaque',theme='light',hash='',width=402,clock=false}={}){
 const m=MODES[mode];
 const ctx=await (await launch()).newContext({viewport:{width,height:m.height},screen:{width,height:874},deviceScaleFactor:3,isMobile:true,hasTouch:true,userAgent:IPHONE_UA});
 await ctx.addInitScript(({top,bottom,theme})=>{
  Object.defineProperty(navigator,'standalone',{get:()=>true});
  try{localStorage.setItem('nubo-shell-theme',theme)}catch{}
  // Chromium has no safe areas: feed the values iOS reports to the probe that reads env(safe-area-inset-*).
  const real=window.getComputedStyle;
  window.getComputedStyle=function(el,...rest){const c=real.call(this,el,...rest);
   if(el?.getAttribute?.('aria-hidden')==='true'&&el.style?.cssText.includes('safe-area'))
    return new Proxy(c,{get:(t,k)=>k==='paddingTop'?top+'px':k==='paddingBottom'?bottom+'px':typeof t[k]==='function'?t[k].bind(t):t[k]});
   return c};
 },{top:m.top,bottom:m.bottom,theme});
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(clock)await page.clock.install(); // lets a test fast-forward the app's own timers
 await page.goto(base+'/'+hash);await page.waitForFunction(()=>[...document.querySelectorAll('iframe.module')].some(f=>!f.hidden&&f.contentDocument?.body),null,{timeout:15000});
 await page.waitForTimeout(600);
 if(theme==='dark')await page.evaluate(()=>{for(const f of document.querySelectorAll('iframe.module'))f.contentDocument?.body.classList.add('dark')});
 return {page,ctx,errors,close:()=>ctx.close()};
}
export const moduleDoc=`[...document.querySelectorAll('iframe.module')].find(f=>!f.hidden).contentDocument`;
