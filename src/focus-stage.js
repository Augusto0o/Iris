// foco · Concentración: new immersive stage and scenes. Loaded only in the foco app, after module-after.js.
// The timer logic, sound and scene preferences stay in the app; this file replaces how the stage looks:
// procedural scenes (drawOwnFocus), a progress ring, round glass controls and a scene picker.
(()=>{
 if(typeof drawOwnFocus!=='function'||typeof openFocusStage!=='function')return;
 const TAU=Math.PI*2;
 const rnd=i=>{const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x)};
 const rgba=(c,a)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`;
 function sky(c,w,h,stops,y0=0,y1=h){const g=c.createLinearGradient(0,y0,0,y1);for(const [o,col] of stops)g.addColorStop(o,col);c.fillStyle=g;c.fillRect(0,y0,w,y1-y0)}
 function glow(c,x,y,r,col,a){if(r<=0||a<=0)return;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,rgba(col,a));g.addColorStop(.45,rgba(col,a*.45));g.addColorStop(1,rgba(col,0));c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2)}
 function vignette(c,w,h,a=.5){const g=c.createRadialGradient(w/2,h*.45,Math.min(w,h)*.35,w/2,h*.45,Math.max(w,h)*.8);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,`rgba(0,0,0,${a})`);c.fillStyle=g;c.fillRect(0,0,w,h)}
 function stars(c,w,h,t,n,top,d,alpha=1){
  for(let i=0;i<n;i++){
   const x=rnd(i)*w,y=rnd(i+500)*h*top,s=(rnd(i+900)**3*1.9+.35)*d,tw=.35+.65*(.5+.5*Math.sin(t*(.5+rnd(i+77)*1.4)+i));
   c.fillStyle=`rgba(230,238,255,${(tw*alpha).toFixed(3)})`;c.beginPath();c.arc(x,y,s,0,TAU);c.fill();
   if(s>1.6*d){glow(c,x,y,s*6,[200,215,255],.18*tw*alpha)}
  }
 }

 const SCENES={
  // Deep space: drifting nebulae, twinkling stars, a planet rim and a shooting star now and then.
  space(c,w,h,t,S,d){
   sky(c,w,h,[[0,'#02030b'],[.55,'#0a0e28'],[1,'#191237']]);
   glow(c,w*(.74+.05*Math.sin(t*.05)),h*(.27+.03*Math.cos(t*.04)),S*.85,[124,77,196],.42);
   glow(c,w*(.16+.04*Math.cos(t*.035)),h*.52,S*.8,[32,140,150],.28);
   glow(c,w*.62,h*.6,S*.55,[196,72,130],.14);
   stars(c,w,h,t,240,.95,d);
   const k=Math.floor(t/11),ph=(t%11)/1.2;
   if(t>0&&ph<1){const x0=w*(.2+.55*rnd(k)),y0=h*(.06+.25*rnd(k+3)),len=S*.32,dx=Math.cos(2.65),dy=Math.sin(.42),hx=x0+dx*len*ph,hy=y0+dy*len*ph;
    const g=c.createLinearGradient(hx,hy,hx-dx*len*.5,hy-dy*len*.5);g.addColorStop(0,`rgba(255,255,255,${.85*(1-ph)})`);g.addColorStop(1,'rgba(255,255,255,0)');
    c.strokeStyle=g;c.lineWidth=1.4*d;c.lineCap='round';c.beginPath();c.moveTo(hx,hy);c.lineTo(hx-dx*len*.5,hy-dy*len*.5);c.stroke()}
   const R=S*.72,cx=w*.12,cy=h+R*.28;
   glow(c,cx,cy,R*1.25,[110,130,255],.22);
   const p=c.createRadialGradient(cx+R*.4,cy-R*.55,R*.05,cx,cy,R);p.addColorStop(0,'#3d4486');p.addColorStop(.55,'#161a3d');p.addColorStop(1,'#06070f');
   c.fillStyle=p;c.beginPath();c.arc(cx,cy,R,0,TAU);c.fill();
   c.strokeStyle='rgba(160,180,255,.45)';c.lineWidth=1.6*d;c.beginPath();c.arc(cx,cy,R,-Math.PI*.62,-Math.PI*.05);c.stroke();
   vignette(c,w,h,.45);
  },
  // Misty pine forest at dawn: light rays, layered ridges with atmospheric depth, fog and fireflies.
  forest(c,w,h,t,S,d){
   sky(c,w,h,[[0,'#0b1b19'],[.4,'#1d4337'],[.72,'#6a9b80'],[1,'#c6dabd']]);
   const sx=w*.7,sy=h*.36;glow(c,sx,sy,S*.95,[255,228,175],.5);glow(c,sx,sy,S*.25,[255,244,214],.6);
   c.save();c.globalCompositeOperation='lighter';
   for(let i=0;i<6;i++){const a=1.72+i*.17+.035*Math.sin(t*.18+i),sp=.045,L=h*1.2,al=.045+.03*Math.sin(t*.27+i*1.3);
    c.fillStyle=`rgba(255,240,205,${al.toFixed(3)})`;c.beginPath();c.moveTo(sx,sy);c.lineTo(sx+Math.cos(a-sp)*L,sy+Math.sin(a-sp)*L);c.lineTo(sx+Math.cos(a+sp)*L,sy+Math.sin(a+sp)*L);c.closePath();c.fill()}
   c.restore();
   const layers=['#5d8a74','#36614f','#1d3e33','#0b201b'];
   const pine=(x,base,H,W)=>{c.moveTo(x,base-H);for(const [f,k] of [[.62,.28],[.32,.42],[0,.5]]){c.lineTo(x+W*k,base-H*f);if(f)c.lineTo(x+W*k*.5,base-H*f)}for(const [f,k] of [[0,.5],[.32,.42],[.62,.28]]){if(f)c.lineTo(x-W*k*.5,base-H*f);c.lineTo(x-W*k,base-H*f)}c.closePath()};
   layers.forEach((col,L)=>{
    const base=h*(.6+L*.1),drift=Math.sin(t*.02+L)*w*.01*(L+1),n=7+L*3;
    c.fillStyle=col;c.beginPath();
    for(let j=0;j<n;j++){const x=(j+.5+(rnd(L*50+j)-.5)*.7)/n*w+drift,H=h*(.09+L*.035)*(.7+.6*rnd(L*90+j)),W=H*(.42+.12*rnd(j+L));pine(x,base+H*.05,H,W)}
    c.rect(-10,base,w+20,h-base);c.fill();
    if(L<3){const fx=((t*.012*(L+1))%1)*w;glow(c,fx,base+h*.01,S*.55,[230,240,232],.16);glow(c,fx-w,base+h*.01,S*.55,[230,240,232],.16);glow(c,fx+w*.5,base,S*.4,[230,240,232],.1)}
   });
   for(let i=0;i<22;i++){const x=(rnd(i)*w+Math.sin(t*.35+i)*22*d+w)%w,rise=(t*7*d*(.4+rnd(i+80)))%(h*.35),y=h*(.62+.33*rnd(i+40))-rise,a=.35+.45*(.5+.5*Math.sin(t*1.7+i*2.1));
    glow(c,x,y,7*d,[255,232,150],a*.55);c.fillStyle=`rgba(255,246,200,${a.toFixed(3)})`;c.beginPath();c.arc(x,y,1.2*d,0,TAU);c.fill()}
   vignette(c,w,h,.5);
  },
  // Ocean at dusk: low sun, soft clouds, a shimmering reflection and gentle swell lines.
  ocean(c,w,h,t,S,d){
   const hz=h*.66;
   sky(c,w,h,[[0,'#121d38'],[.38,'#4d4472'],[.56,'#c9796a'],[.66,'#f4bd86']],0,hz+2);
   const sx=w*.5,sy=hz-S*.035+Math.sin(t*.04)*S*.006;
   glow(c,sx,sy,S*1.05,[255,170,120],.45);glow(c,sx,sy,S*.3,[255,214,160],.7);
   for(let i=0;i<4;i++){const cx=((rnd(i+20)*w+t*S*.004*(1+i*.4))%(w*1.4))-w*.2,cy=h*(.2+.1*i);c.save();c.translate(cx,cy);c.scale(3.2,1);glow(c,0,0,S*.16,[78,52,98],.32);c.restore()}
   const sun=c.createRadialGradient(sx,sy,0,sx,sy,S*.085);sun.addColorStop(0,'#fff7df');sun.addColorStop(1,'#ffc48a');c.fillStyle=sun;c.beginPath();c.arc(sx,sy,S*.085,0,TAU);c.fill();
   sky(c,w,h,[[0,'#2f4467'],[.35,'#172a45'],[1,'#060f1c']],hz,h);
   c.save();c.globalCompositeOperation='lighter';
   for(let k=0;k<44;k++){const f=k/44,y=hz+f**1.5*(h-hz),wid=(S*.05+f*S*.32)*(.55+.45*Math.sin(t*1.4+k*1.7)),x=sx+Math.sin(t*.7+k*.9)*f*S*.05;
    c.fillStyle=`rgba(255,196,140,${(.55*(1-f)**1.3).toFixed(3)})`;c.fillRect(x-wid/2,y,wid,(1+f*2.2)*d)}
   c.restore();
   c.lineWidth=1*d;
   for(let k=0;k<28;k++){const f=k/28,y=hz+f**1.7*(h-hz)+4*d,amp=(1+f*5)*d;c.strokeStyle=`rgba(210,225,255,${(.04+.07*(1-f)).toFixed(3)})`;c.beginPath();
    for(let x=0;x<=w;x+=w/24){const yy=y+Math.sin(x/w*TAU*(2+f*3)+t*(.6+f)+k)*amp;x?c.lineTo(x,yy):c.moveTo(x,yy)}c.stroke()}
   vignette(c,w,h,.42);
  },
  // Rainy night behind glass: blurred city lights, slanted rain and drops sliding on the window.
  rain(c,w,h,t,S,d){
   sky(c,w,h,[[0,'#060a12'],[.55,'#0e1828'],[1,'#1a283c']]);
   const pal=[[255,184,108],[255,214,150],[118,168,255],[255,118,118],[150,224,255]];
   for(let i=0;i<46;i++){const x=rnd(i)*w,y=h*(.3+.62*rnd(i+11)),r=S*(.02+.065*rnd(i+22)),a=.14+.1*(.5+.5*Math.sin(t*.35+i*1.9)),col=pal[i%pal.length];
    const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,rgba(col,a));g.addColorStop(.72,rgba(col,a*.8));g.addColorStop(1,rgba(col,0));c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,TAU);c.fill()}
   c.strokeStyle='rgba(190,212,255,.2)';c.lineWidth=.9*d;c.lineCap='round';c.beginPath();
   for(let i=0;i<150;i++){const len=S*(.03+.045*rnd(i)),x=((rnd(i+1)*1.3*w+t*S*.08)%(w*1.3))-w*.15,y=((rnd(i+5)*h+t*S*(1.1+.7*rnd(i+9)))%(h*1.15))-h*.07;c.moveTo(x,y);c.lineTo(x-len*.2,y+len)}
   c.stroke();
   for(let i=0;i<30;i++){const x=rnd(i+700)*w,slide=rnd(i+3)<.3?t*S*.03*(.5+rnd(i+4)):t*S*.002,y=(rnd(i+800)*h+slide)%h,r=S*(.005+.011*rnd(i+900));
    c.fillStyle='rgba(205,222,255,.13)';c.beginPath();c.arc(x,y,r,0,TAU);c.fill();c.fillStyle='rgba(255,255,255,.4)';c.beginPath();c.arc(x-r*.35,y-r*.35,r*.28,0,TAU);c.fill()}
   vignette(c,w,h,.5);
  },
  // Campfire under a dark sky: flickering glow, layered flames and rising embers.
  fire(c,w,h,t,S,d){
   sky(c,w,h,[[0,'#06050a'],[.6,'#140a08'],[1,'#26110a']]);
   stars(c,w,h,t,70,.5,d,.55);
   const f=.86+.09*Math.sin(t*7.3)+.05*Math.sin(t*13.1+1),bx=w*.5,by=h*.79,k=.78; // between the controls and the scene picker
   glow(c,bx,by,S*1.05*f,[255,110,40],.42);glow(c,bx,by-S*.06,S*.42,[255,180,90],.45*f);
   c.save();c.translate(bx,by+S*.02);
   c.scale(k,k);for(const [rot,len] of [[.28,.36],[-.3,.34],[.05,.3]]){c.save();c.rotate(rot);const g=c.createLinearGradient(0,-S*.02,0,S*.03);g.addColorStop(0,'#5c2f19');g.addColorStop(1,'#1d0e08');c.fillStyle=g;c.beginPath();c.roundRect?c.roundRect(-S*len/2,-S*.022,S*len,S*.044,S*.022):c.rect(-S*len/2,-S*.022,S*len,S*.044);c.fill();c.restore()}
   c.restore();
   c.save();c.globalCompositeOperation='lighter';
   const tongue=(x,H,W,sway,c0,c1)=>{const g=c.createLinearGradient(0,by,0,by-H);g.addColorStop(0,c0);g.addColorStop(1,c1);c.fillStyle=g;c.beginPath();c.moveTo(x-W/2,by);c.quadraticCurveTo(x-W*.65,by-H*.45,x+sway,by-H);c.quadraticCurveTo(x+W*.65,by-H*.45,x+W/2,by);c.closePath();c.fill()};
   for(let i=0;i<5;i++){const x=bx+(i-2)*S*.045*k,H=k*S*(.2+.09*rnd(i))*(.82+.18*Math.sin(t*(5+i*.8)+i)),W=k*S*(.075+.025*rnd(i+3));tongue(x,H,W,Math.sin(t*(3+i*.7)+i)*W*.3,'rgba(255,170,70,.75)','rgba(255,70,20,0)')}
   for(let i=0;i<3;i++){const x=bx+(i-1)*S*.03*k,H=k*S*(.11+.04*rnd(i+9))*(.85+.15*Math.sin(t*(7+i)+i*2));tongue(x,H,S*.05*k,Math.sin(t*(4+i))*S*.01,'rgba(255,240,190,.85)','rgba(255,160,60,0)')}
   for(let i=0;i<46;i++){const p=(t*(.22+.3*rnd(i))+rnd(i+1))%1,x=bx+(rnd(i+2)-.5)*S*.22+Math.sin(t*2+i)*S*.04*p,y=by-S*.05-p*h*.55,a=(1-p)*.9,s=(1.1+2*rnd(i+3))*d*(1-p*.5);
    glow(c,x,y,s*4,[255,140,60],a*.4);c.fillStyle=`rgba(255,200,120,${a.toFixed(3)})`;c.beginPath();c.arc(x,y,s,0,TAU);c.fill()}
   c.restore();
   vignette(c,w,h,.55);
  },
 };
 drawOwnFocus=function(c,w,h,time,scene){const S=Math.min(w,h),d=S/400;(SCENES[scene]||SCENES.space)(c,w,h,time,S,d)};

 // ---- Stage UI ----------------------------------------------------------------------------------------
 const NAMES=(typeof FOCUS_SCENES!=='undefined'?FOCUS_SCENES:[['space','Espacio'],['forest','Bosque'],['ocean','Océano'],['rain','Lluvia'],['fire','Fogata']]);
 const SVG={soundOn:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
 soundOff:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5m0-5-5 5"/></svg>',
 motionOn:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 3 2M3 12c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 3 2"/><circle cx="17.5" cy="5.5" r="1.6"/></svg>',
 motionOff:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15h18M3 10h18"/><path d="M10 4v3m4-3v3"/></svg>',

  play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  pause:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3v14H8zM13 5h3v14h-3z"/></svg>',
  reset:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v4.5h4.5"/></svg>',
  next:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5.5v13l9-6.5z"/><path d="M18 5.5v13"/></svg>',
 };
 const openBefore=openFocusStage;
 openFocusStage=function(){
  openBefore();const stage=document.getElementById('focusStage');if(!stage||stage.classList.contains('nubo-stage'))return;
  stage.classList.add('nubo-stage');
  const grid=stage.querySelector('.focus-stage-grid');
  const center=document.createElement('div');center.className='ns-center';
  center.innerHTML=`<p class="ns-task" id="nsTask"></p>
   <div class="ns-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ns-track" cx="60" cy="60" r="54"/><circle class="ns-bar" id="nsBar" cx="60" cy="60" r="54" pathLength="1"/></svg>
    <div class="ns-face"><div class="ns-time" id="nsTime" role="timer"></div><span class="ns-status" id="nsStatus"></span></div></div>
   <div class="ns-controls"><button class="ns-round" id="nsReset" aria-label="Reiniciar">${SVG.reset}</button><button class="ns-round ns-primary" id="nsToggle"></button><button class="ns-round" id="nsNext"></button></div>
   <button type="button" class="ns-end" id="nsEnd">Terminar sesión</button>`;
  grid.append(center);
  center.querySelector('#nsToggle').onclick=()=>{toggleTimer();updateFocusStage()};
  center.querySelector('#nsReset').onclick=()=>{resetTimer();updateFocusStage()};
  // stop the session for good: the clock goes back to its start and the stage closes
  center.querySelector('#nsEnd').onclick=()=>{const t=ensureTimer();if(t.running)toggleTimer();resetTimer();closeFocusStage()};
  center.querySelector('#nsNext').onclick=()=>{setTimerMode(ensureTimer().mode==='focus'?'break':'focus');toggleTimer();updateFocusStage()};
  const dock=document.createElement('div');dock.className='ns-dock';
  const picker=document.createElement('div');picker.className='ns-scenes';picker.setAttribute('role','radiogroup');picker.setAttribute('aria-label','Ambiente');
  for(const [id,label] of NAMES){const b=document.createElement('button');b.type='button';b.className='ns-scene';b.dataset.scene=id;b.setAttribute('role','radio');b.innerHTML=`<i aria-hidden="true"></i><span>${label}</span>`;b.onclick=()=>setFocusScene(id);picker.append(b)}
  dock.append(picker);
  // Sound, volume and background: round controls with their names (the app's own text buttons stay hidden;
  // their functions are still the ones called).
  const audio=document.createElement('div');audio.className='ns-audio';
  audio.innerHTML=`<button type="button" class="ns-chip" id="nsSound"><span class="ns-chip-icon"></span><span class="ns-chip-label">Sonido</span></button>
   <label class="ns-volume" id="nsVolumeBox"><input id="nsVolume" type="range" min="0" max="80" step="1" aria-label="Volumen del ambiente"><span class="ns-chip-label">Volumen</span></label>
   <button type="button" class="ns-chip" id="nsMotion"><span class="ns-chip-icon"></span><span class="ns-chip-label">Fondo</span></button>`;
  dock.append(audio);
  let starting=false;const vol=audio.querySelector('#nsVolume');
  audio.querySelector('#nsSound').onclick=async()=>{if(starting)return;starting=true;try{await toggleFocusSound()}finally{starting=false;paintAudio()}};
  vol.oninput=()=>{setFocusVolume(vol.value);if(!S.prefs.focusSound&&!starting){starting=true;toggleFocusSound().finally(()=>{starting=false;paintAudio()})}paintAudio()};
  audio.querySelector('#nsMotion').onclick=()=>{toggleFocusMotion();paintAudio()};
  stage.append(dock);
  paintAudio(); // once it is on the page
  updateFocusStage();
 };
 function paintAudio(){
  const sound=document.getElementById('nsSound');if(!sound)return;const on=!!S.prefs.focusSound,moving=S.prefs.focusMotion!==false;
  sound.setAttribute('aria-pressed',String(on));sound.setAttribute('aria-label',on?'Apagar el sonido':'Encender el sonido');
  if(sound.dataset.on!==String(on)){sound.querySelector('.ns-chip-icon').innerHTML=on?SVG.soundOn:SVG.soundOff;sound.dataset.on=String(on)}
  const vol=document.getElementById('nsVolume'),value=Math.min(80,Math.max(0,Number(S.prefs.focusVolume??35)));
  if(document.activeElement!==vol)vol.value=String(value);vol.style.setProperty('--v',String(Number(vol.value)/80));
  document.getElementById('nsVolumeBox').classList.toggle('off',!on);
  const motion=document.getElementById('nsMotion');motion.setAttribute('aria-pressed',String(moving));motion.setAttribute('aria-label',moving?'Pausar el fondo animado':'Animar el fondo');
  if(motion.dataset.on!==String(moving)){motion.querySelector('.ns-chip-icon').innerHTML=moving?SVG.motionOn:SVG.motionOff;motion.dataset.on=String(moving)}
 }
 if(typeof paintFocusSoundButton==='function'){const before=paintFocusSoundButton;paintFocusSoundButton=function(){before();paintAudio()}}
 const updateBefore=updateFocusStage;
 updateFocusStage=function(){
  updateBefore();const stage=document.getElementById('focusStage');if(!stage?.classList.contains('nubo-stage'))return;
  const t=ensureTimer(),seconds=timerSeconds(),total=Math.max(1,t.minutes*60),progress=Math.min(1,Math.max(0,1-seconds/total));
  const $$=id=>document.getElementById(id);
  $$('nsBar').style.strokeDashoffset=String(1-progress);
  $$('nsTime').textContent=timerDisplay();
  const mode=$$('stageMode');if(mode)mode.textContent=t.mode==='break'?'Descanso':'Concentración';
  $$('nsTask').textContent=$$('stageTask')?.textContent||'';
  $$('nsStatus').textContent=$$('stageStatus')?.textContent||'';
  const toggle=$$('nsToggle');const label=t.running?'Pausar':seconds===0?'Empezar de nuevo':'Comenzar';
  if(toggle.dataset.state!==String(t.running)){toggle.innerHTML=t.running?SVG.pause:SVG.play;toggle.dataset.state=String(t.running)}toggle.setAttribute('aria-label',label);
  const next=$$('nsNext');next.hidden=t.running;const nextLabel=t.mode==='focus'?'Ir al descanso':'Volver a concentrarme';if(next.getAttribute('aria-label')!==nextLabel){next.setAttribute('aria-label',nextLabel);next.innerHTML=SVG.next}
  for(const b of stage.querySelectorAll('.ns-scene')){const on=b.dataset.scene===stage.dataset.scene;b.classList.toggle('selected',on);b.setAttribute('aria-checked',String(on))}
 };

 // ---- Concentración screen: a progress ring around the clock -------------------------------------------
 setInterval(()=>{const face=document.getElementById('timerFace');if(!face)return;const t=ensureTimer(),total=Math.max(1,t.minutes*60);face.style.setProperty('--p',String(Math.min(1,Math.max(0,1-timerSeconds()/total))))},500);
})();
