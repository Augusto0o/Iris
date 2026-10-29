// foco · ambient sound for the concentration stage (classic script, injected into organizador only).
// Everything is synthesised on the device with the Web Audio API: no recordings, no network.
// All five scenes share one chain (warm reverb, soft top end, gentle compressor) and the same loudness,
// so switching scenes crossfades instead of jumping. Random events (birds, bells, waves, crackles) are
// scheduled a few seconds ahead, so nothing repeats as an obvious loop.
(function(){
'use strict';
const rand=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.floor(Math.random()*a.length)];

// ---- shared building blocks ------------------------------------------------------------------------
function noise(ctx,color,seconds=10){
 const len=Math.floor(ctx.sampleRate*seconds),buf=ctx.createBuffer(2,len,ctx.sampleRate);
 for(let ch=0;ch<2;ch++){const d=buf.getChannelData(ch);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,br=0;
  for(let i=0;i<len;i++){const w=Math.random()*2-1;
   if(color==='brown'){br=(br+.02*w)/1.02;d[i]=br*3.5}
   else{b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;d[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.11;b6=w*.115926}}
  // crossfade the ends so the loop point is inaudible
  const f=Math.floor(ctx.sampleRate*.05);for(let i=0;i<f;i++){const k=i/f;d[i]=d[i]*k+d[len-f+i]*(1-k)}}
 return buf;
}
function impulse(ctx,seconds=3.2){
 const len=Math.floor(ctx.sampleRate*seconds),buf=ctx.createBuffer(2,len,ctx.sampleRate);
 for(let ch=0;ch<2;ch++){const d=buf.getChannelData(ch);let lp=0;
  for(let i=0;i<len;i++){const t=i/len;lp+=(Math.random()*2-1-lp)*(.5-.42*t);d[i]=lp*Math.pow(1-t,2.6)}} // darker as it fades
 return buf;
}
// The chain every scene plays through. `out` is the node the volume control lives on.
function createEngine(ctx,out){
 const bus=ctx.createGain(),reverb=ctx.createConvolver(),wet=ctx.createGain(),tone=ctx.createBiquadFilter(),comp=ctx.createDynamicsCompressor();
 reverb.buffer=impulse(ctx);wet.gain.value=.9;tone.type='lowpass';tone.frequency.value=8500;tone.Q.value=.5;
 comp.threshold.value=-20;comp.knee.value=14;comp.ratio.value=3;comp.attack.value=.03;comp.release.value=.4;
 bus.connect(tone);reverb.connect(wet);wet.connect(tone);tone.connect(comp);comp.connect(out);
 return {ctx,bus,reverb,buffers:{pink:noise(ctx,'pink'),brown:noise(ctx,'brown')}};
}

// ---- one scene -------------------------------------------------------------------------------------
function voice(engine,scene){
 const ctx=engine.ctx,out=ctx.createGain(),send=ctx.createGain(),nodes=[],srcs=[];
 out.gain.value=0;out.connect(engine.bus);out.connect(send);send.connect(engine.reverb);
 const keep=n=>{nodes.push(n);return n};
 const gain=(v,to)=>{const g=keep(ctx.createGain());g.gain.value=v;if(to)g.connect(to);return g};
 const filter=(type,f,q=.7,to)=>{const n=keep(ctx.createBiquadFilter());n.type=type;n.frequency.value=f;n.Q.value=q;if(to)n.connect(to);return n};
 const panner=(x,to)=>{if(!ctx.createStereoPanner)return to;const p=keep(ctx.createStereoPanner());p.pan.value=x;p.connect(to);return p};
 const loop=(color,to,rate=1)=>{const s=ctx.createBufferSource();s.buffer=engine.buffers[color];s.loop=true;s.playbackRate.value=rate;s.loopStart=0;s.connect(to);s.start(ctx.currentTime,rand(0,9));srcs.push(s);return s};
 const lfo=(hz,depth,param)=>{const o=ctx.createOscillator(),g=gain(depth,param);o.frequency.value=hz;o.connect(g);o.start();srcs.push(o);return o};
 const osc=(type,hz,to,detune=0)=>{const o=ctx.createOscillator();o.type=type;o.frequency.value=hz;o.detune.value=detune;o.connect(to);o.start();srcs.push(o);return o};
 // short one-off sounds (birds, bells, crackles) clean themselves up
 const once=(src,t,dur)=>{src.start(t);src.stop(t+dur+.05)};
 const burst=(t,dur,to,offset=rand(0,9))=>{const s=ctx.createBufferSource();s.buffer=engine.buffers.pink;s.connect(to);s.start(t,offset,dur+.02)};

 let next=ctx.currentTime+rand(.6,2),level=1,events=()=>{};
 const SCENES={
  // Espacio: an open Dadd9 pad that breathes, soft air and a far bell now and then.
  space(){send.gain.value=.55;level=1.25;
   const pad=filter('lowpass',1500,.4,out);lfo(.021,450,pad.frequency);
   for(const [hz,v] of [[73.42,.03],[146.83,.05],[220,.045],[293.66,.035],[329.63,.025],[440,.02],[554.37,.01]]){
    const g=gain(v*.6,pad);lfo(rand(.013,.04),v*.4,g.gain);osc('sine',hz,g);osc('triangle',hz,gain(.35,g),rand(-6,6))}
   loop('pink',gain(.02,filter('lowpass',900,.5,out)),.5);
   const notes=[587.33,659.25,739.99,880,987.77,1174.66];
   events=t=>{const hz=pick(notes),g=gain(0,panner(rand(-.6,.6),out)),o=ctx.createOscillator(),o2=ctx.createOscillator();
    o.frequency.value=hz;o2.frequency.value=hz*2.01;const g2=gain(.18,g);o.connect(g);o2.connect(g2);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(rand(.012,.022),t+.04);g.gain.setTargetAtTime(0,t+.05,1.3);once(o,t,6);once(o2,t,6);return rand(6,13)}},
  // Bosque: wind in the leaves and sparse birds at different distances.
  forest(){send.gain.value=.35;level=5.2;
   const wind=gain(.1,filter('bandpass',420,.45,out));lfo(.045,.05,wind.gain);lfo(.011,.035,wind.gain);loop('pink',wind);
   const leaves=gain(.016,filter('lowpass',6500,.5,filter('highpass',2400,.5,out)));lfo(.08,.012,leaves.gain);loop('pink',leaves,.9);
   const chirp=(t,f0,f1,dur,v,to)=>{const o=ctx.createOscillator(),g=gain(0,to);o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur);o.connect(g);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+Math.min(.02,dur/3));g.gain.setTargetAtTime(0,t+dur*.6,dur/4);once(o,t,dur+.3)};
   const songs=[
    (t,v,to)=>{for(let i=0;i<3;i++)chirp(t+i*.19,4200,2900,.11,v,to)},                                        // falling triplet
    (t,v,to)=>{chirp(t,2550,2650,.28,v,to);chirp(t+.36,3150,3050,.24,v*.9,to);chirp(t+.7,2800,2850,.3,v*.8,to)}, // soft whistled phrase
    (t,v,to)=>{for(let i=0;i<6;i++)chirp(t+i*.065,i%2?3400:3800,i%2?3500:3700,.05,v*.7,to)},                  // quick trill
    (t,v,to)=>{chirp(t,1900,2600,.16,v,to);chirp(t+.22,2600,1900,.18,v*.85,to)}];                             // up and down
   events=t=>{const far=Math.random(),v=.006+.016*(1-far),to=panner(rand(-.8,.8),far>.6?filter('lowpass',3800,.5,out):out);
    pick(songs)(t,v,to);if(Math.random()<.35)pick(songs)(t+rand(1.2,2),v*.8,to);return rand(3,9)}},
  // Océano: slow waves that build and wash out, offset left and right, over a low swell.
  ocean(){send.gain.value=.22;level=2.1;
   loop('brown',gain(.05,filter('lowpass',140,.5,out)),.8);
   const layers=[-.45,.45].map((x,i)=>{const cut=filter('lowpass',300,.4,panner(x,out)),g=gain(.04,cut),foamG=gain(0,filter('highpass',1800,.4,filter('lowpass',5200,.4,panner(x*.7,out))));
    loop('brown',g,.9+i*.07);loop('pink',foamG,1.1);return {cut,g,foam:foamG}});
   let side=0;
   events=t=>{const w=layers[side++%2],rise=rand(2.8,4),fall=rand(4.5,6.5),peak=rand(.24,.36);
    w.g.gain.setTargetAtTime(peak,t,rise/3);w.cut.frequency.setTargetAtTime(rand(1300,1800),t,rise/3);
    w.foam.gain.setTargetAtTime(peak*.11,t+rise*.75,.5);
    w.g.gain.setTargetAtTime(.04,t+rise,fall/3);w.cut.frequency.setTargetAtTime(420,t+rise,fall/3);w.foam.gain.setTargetAtTime(0,t+rise+.4,fall/4);
    return rand(4.5,6.5)}},
  // Lluvia: a soft, even rain (no hiss), close drops on leaves and a distant rumble.
  rain(){send.gain.value=.25;level=4;
   const bed=gain(.11,filter('lowpass',3200,.5,filter('highpass',380,.5,out)));lfo(.03,.02,bed.gain);loop('pink',bed);
   const sizzle=gain(.018,filter('bandpass',5200,.6,out));loop('pink',sizzle,.8);
   loop('brown',gain(.05,filter('lowpass',170,.5,out)),.7);
   events=t=>{for(let i=0;i<6;i++){const at=t+rand(0,.5),hz=rand(1400,3600),o=ctx.createOscillator(),g=gain(0,panner(rand(-.9,.9),out));
     o.frequency.setValueAtTime(hz,at);o.frequency.exponentialRampToValueAtTime(hz*.6,at+.03);o.connect(g);
     g.gain.setValueAtTime(rand(.003,.012),at);g.gain.setTargetAtTime(0,at+.002,.012);once(o,at,.12)}return .5}},
  // Fogata: a low warm roar, flickering flame hiss and irregular crackles and pops.
  fire(){send.gain.value=.16;level=4.2;
   const roarCut=filter('lowpass',650,.5,out),roar=gain(.11,roarCut);lfo(.13,140,roarCut.frequency);lfo(.31,80,roarCut.frequency);lfo(.07,.05,roar.gain);loop('brown',roar);
   const flame=gain(.05,filter('bandpass',900,.4,out));lfo(.23,.018,flame.gain);loop('pink',flame);
   events=t=>{let at=t;const n=Math.random()<.18?Math.floor(rand(3,7)):1;
    for(let i=0;i<n;i++){at+=n>1?rand(.02,.09):0;const big=Math.random()<.12,g=gain(0,panner(rand(-.5,.5),filter('bandpass',big?rand(600,900):rand(1600,4200),big?.8:1.1,out))),dur=big?rand(.018,.03):rand(.003,.01);
     g.gain.setValueAtTime(big?rand(.45,.7):Math.pow(Math.random(),2)*.5+.08,at);g.gain.setTargetAtTime(0,at+dur*.3,dur/2.5);burst(at,dur*3,g)}
    return rand(.12,.6)}},
 };
 (SCENES[scene]||SCENES.space)();
 const v={scene,
  plan(until){while(next<until){next+=events(Math.max(next,ctx.currentTime))||1}},
  fadeIn(sec=1.6){out.gain.cancelScheduledValues(ctx.currentTime);out.gain.setValueAtTime(out.gain.value,ctx.currentTime);out.gain.setTargetAtTime(level,ctx.currentTime,sec/3)},
  fadeOut(sec=1.6){out.gain.cancelScheduledValues(ctx.currentTime);out.gain.setValueAtTime(out.gain.value,ctx.currentTime);out.gain.setTargetAtTime(0,ctx.currentTime,sec/4);
   setTimeout(()=>{for(const s of srcs)try{s.stop()}catch{}try{out.disconnect();send.disconnect()}catch{}},sec*1500)},
 };
 return v;
}
const api={createEngine,voice,scenes:['space','forest','ocean','rain','fire']};
window.nuboFocusSound=api;

// ---- take over foco's sound functions (they keep their names; the app calls them as before) --------
if(typeof startFocusAudio!=='function'||typeof S==='undefined')return;
let live=null;
const tick=()=>{if(live?.voice)live.voice.plan(live.ctx.currentTime+4)};
stopFocusAudio=function(){focusAudioGeneration++;const l=live;live=null;focusAudio=null;if(!l)return;clearInterval(l.timer);
 try{l.out.gain.setTargetAtTime(0,l.ctx.currentTime,.12)}catch{}setTimeout(()=>l.ctx.close?.().catch(()=>{}),700)};
startFocusAudio=async function(){
 const scene=focusScene();if(!S.prefs.focusSound||!document.getElementById('focusStage'))return;
 const A=window.AudioContext||window.webkitAudioContext;
 if(!A){S.prefs.focusSound=false;paintFocusSoundButton();notify('El sonido ambiente no está disponible en este navegador.');return}
 try{
  if(!live){const ctx=new A({latencyHint:'playback'}),out=ctx.createGain();out.gain.value=0;out.connect(ctx.destination);
   live={ctx,out,engine:createEngine(ctx,out),voice:null,timer:0};focusAudio={ctx,gain:out,sources:[],scene:null}}
  const l=live;
  if(l.voice?.scene!==scene){l.voice?.fadeOut(2.4);l.voice=voice(l.engine,scene);l.voice.fadeIn(2.4);focusAudio.scene=scene}
  await l.ctx.resume();if(l!==live)return;
  tick();clearInterval(l.timer);l.timer=setInterval(tick,1000);syncFocusAudio();
 }catch{stopFocusAudio();S.prefs.focusSound=false;paintFocusSoundButton();notify('No se pudo activar el sonido. Tocá Sonido para reintentar.')}
};
// Play and pause fade in about a second instead of cutting.
syncFocusAudio=function(){if(!live)return;const on=S.prefs.focusSound&&!!document.getElementById('focusStage')&&!document.hidden; // plays as soon as it is on, also with the timer paused
 const v=Math.min(.8,Math.max(0,Number(S.prefs.focusVolume??35)/100));
 live.out.gain.setTargetAtTime(on?v:0,live.ctx.currentTime,on?.35:.18)};
})();
