// Liquid drop for the island (the "gooey" effect of expo-dynamic-notifications, MIT, redone with an SVG filter).
// A blob attached to the top edge stretches a neck, lets go of a drop that falls and tints into the card colour;
// the island element then takes over from the drop. `rise` plays it backwards.
import {springAt} from './motion.js';

const NS='http://www.w3.org/2000/svg';

function mix(a,b,t){
 const pa=parse(a),pb=parse(b);if(!pa||!pb)return t<.5?a:b;
 return 'rgb('+pa.map((v,i)=>Math.round(v+(pb[i]-v)*t)).join(',')+')';
}
function parse(c){
 if(!c)return null;let m=/^#([0-9a-f]{6})$/i.exec(c);if(m)return [0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16));
 m=/rgba?\(([^)]+)\)/.exec(c);return m?m[1].split(',').slice(0,3).map(Number):null;
}
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));

export function createGoo(doc){
 const win=doc.defaultView;if(!win||typeof doc.createElementNS!=='function'||!win.requestAnimationFrame)return null;
 const svg=doc.createElementNS(NS,'svg');svg.id='islandGoo';svg.setAttribute('aria-hidden','true');
 svg.innerHTML='<defs><filter id="islandGooFilter" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">'
  +'<feGaussianBlur in="SourceGraphic" stdDeviation="6"/>'
  +'<feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10"/></filter></defs>'
  +'<g filter="url(#islandGooFilter)"><rect class="stub"/><ellipse class="drop"/></g>';
 svg.style.display='none';doc.body.append(svg);
 const stub=svg.querySelector('.stub'),drop=svg.querySelector('.drop');
 let job=0;

 function frame({x,top,toY,toR,fromColor,toColor},p,reverse){
  const s=reverse?1-p:p,e=springAt(clamp(s),.82);
  const r=4+(toR-4)*clamp(e*1.15),y=top+(toY-top)*e;
  const wobble=Math.sin(Math.PI*clamp(s));
  drop.setAttribute('cx',x);drop.setAttribute('cy',y.toFixed(1));
  drop.setAttribute('rx',(r*(1-.14*wobble)).toFixed(1));drop.setAttribute('ry',(r*(1+.38*wobble)).toFixed(1));
  const tint=clamp((s-.06)/(.88-.06));drop.setAttribute('fill',mix(fromColor,toColor,tint));
  // The stub is the island's lower edge; it bulges while the drop is close and lets go once it has fallen.
  const hold=clamp(1-s/.45);stub.setAttribute('height',(26+10*hold).toFixed(1));stub.setAttribute('y',(top-30).toFixed(1)); // hides above the edge once the drop lets go
 }
 function run(opts,duration,reverse){
  const mine=++job;
  const {x,top}=opts;
  svg.style.display='block';
  stub.setAttribute('x',x-42);stub.setAttribute('width',84);stub.setAttribute('rx',16);stub.setAttribute('fill',opts.fromColor);
  return new Promise(resolve=>{
   const t0=win.performance.now();
   const step=now=>{
    if(mine!==job){resolve(false);return}
    const p=clamp((now-t0)/duration);frame(opts,p,reverse);
    if(p<1)win.requestAnimationFrame(step);else{if(reverse)svg.style.display='none';resolve(true)}
   };
   frame(opts,0,reverse);win.requestAnimationFrame(step);
  });
 }
 return {
  // Falls from `top` (island edge) to the centre of the card, `toY`.
  drop:(opts,duration=520)=>run(opts,duration,false),
  rise:(opts,duration=420)=>run(opts,duration,true),
  hide(){job++;svg.style.display='none'},
  fadeOut(ms=160){if(svg.style.display==='none')return;const a=svg.animate?.([{opacity:1},{opacity:0}],{duration:ms,fill:'forwards'});const mine=job;if(a)a.onfinish=()=>{if(mine===job)svg.style.display='none';a.cancel()};else svg.style.display='none'}
 };
}
