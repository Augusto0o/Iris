// lecta · drawing like Personal OS: pencil, marker, eraser, line, arrow, rectangle, oval, text and move, colours and
// thickness, undo/redo, a plain, squared or dotted page or a photo to draw on, and shapes that straighten themselves
// when you hold still at the end of a stroke (like iOS). The drawing keeps its shapes so it can be edited later.
(()=>{
'use strict';
if(typeof drawingForm!=='function'||typeof schemas==='undefined'||!schemas.drawings)return;
const host=()=>parent.EcosystemHost,W=1000,H=1300;
const validateBefore=schemas.drawings.validate;
schemas.drawings.validate=(v,old)=>{if(/^data:image\/jpeg;base64,/.test(v.image||'')){if(!String(v.name||'').trim())throw Error('Poné un nombre.');if(v.image.length>4_000_000)throw Error('El dibujo es demasiado grande.');return}return validateBefore(v,old)};
const COLORS=['#1f2430','#e5484d','#f5a524','#30a46c','#3e7bfa','#8e4ec6','#ffffff','#8a8f98'];
const TOOLS=[['pen','Lápiz','M4 20l4-1 11-11-3-3L5 16zM14 6l3 3'],['marker','Marcador','M5 19h6M7 15l8-8 3 3-8 8H7z'],['eraser','Borrador','M8 20h12M5 15l7-7 6 6-5 5H9z'],
 ['line','Línea','M5 19L19 5'],['arrow','Flecha','M5 19L19 5M10 5h9v9'],['rect','Rectángulo','M4 6h16v12H4z'],['ellipse','Óvalo','M12 6c4.4 0 8 2.7 8 6s-3.6 6-8 6-8-2.7-8-6 3.6-6 8-6z'],
 ['text','Texto','M5 6h14M12 6v13'],['move','Mover','M12 3v18M3 12h18M12 3l-3 3m3-3 3 3M12 21l-3-3m3 3 3-3M3 12l3-3m-3 3 3 3M21 12l-3-3m3 3-3 3']];
const svg=d=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
let st=null; // editor state
function snapshot(){return JSON.stringify(st.shapes)}
function push(){st.undo.push(snapshot());if(st.undo.length>80)st.undo.shift();st.redo=[]}
// ---- drawing ------------------------------------------------------------------------------------------------
function strokePath(ctx,pts){if(!pts.length)return;ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);if(pts.length===1){ctx.lineTo(pts[0][0]+.1,pts[0][1]);return}
 for(let i=1;i<pts.length-1;i++){const [x,y]=pts[i],[nx,ny]=pts[i+1];ctx.quadraticCurveTo(x,y,(x+nx)/2,(y+ny)/2)}const l=pts.at(-1);ctx.lineTo(l[0],l[1])}
function drawShape(ctx,s){
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=s.c||'#1f2430';ctx.fillStyle=s.c||'#1f2430';ctx.lineWidth=s.s||6;
 if(s.t==='pen'){strokePath(ctx,s.pts);ctx.stroke()}
 else if(s.t==='marker'){ctx.globalAlpha=.35;ctx.lineCap='square';strokePath(ctx,s.pts);ctx.stroke()}
 else if(s.t==='eraser'){ctx.globalCompositeOperation='destination-out';ctx.strokeStyle='#000';strokePath(ctx,s.pts);ctx.stroke()}
 else if(s.t==='line'||s.t==='arrow'){ctx.beginPath();ctx.moveTo(...s.a);ctx.lineTo(...s.b);ctx.stroke();
  if(s.t==='arrow'){const ang=Math.atan2(s.b[1]-s.a[1],s.b[0]-s.a[0]),len=Math.max(18,s.s*4);ctx.beginPath();ctx.moveTo(...s.b);ctx.lineTo(s.b[0]-len*Math.cos(ang-.45),s.b[1]-len*Math.sin(ang-.45));ctx.moveTo(...s.b);ctx.lineTo(s.b[0]-len*Math.cos(ang+.45),s.b[1]-len*Math.sin(ang+.45));ctx.stroke()}}
 else if(s.t==='rect'){const x=Math.min(s.a[0],s.b[0]),y=Math.min(s.a[1],s.b[1]);ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,Math.abs(s.b[0]-s.a[0]),Math.abs(s.b[1]-s.a[1]),Math.min(14,s.s*2)):ctx.rect(x,y,Math.abs(s.b[0]-s.a[0]),Math.abs(s.b[1]-s.a[1]));ctx.stroke()}
 else if(s.t==='ellipse'){ctx.beginPath();ctx.ellipse((s.a[0]+s.b[0])/2,(s.a[1]+s.b[1])/2,Math.max(1,Math.abs(s.b[0]-s.a[0])/2),Math.max(1,Math.abs(s.b[1]-s.a[1])/2),0,0,Math.PI*2);ctx.stroke()}
 else if(s.t==='text'){ctx.font=`600 ${s.size||40}px Inter,system-ui,sans-serif`;ctx.textBaseline='top';String(s.text).split('\n').forEach((line,i)=>ctx.fillText(line,s.x,s.y+i*(s.size||40)*1.25))}
 ctx.restore();
}
function bounds(s){if(s.pts){const xs=s.pts.map(p=>p[0]),ys=s.pts.map(p=>p[1]),m=(s.s||6)/2;return [Math.min(...xs)-m,Math.min(...ys)-m,Math.max(...xs)+m,Math.max(...ys)+m]}
 if(s.t==='text'){const lines=String(s.text).split('\n'),size=s.size||40,w=Math.max(...lines.map(l=>l.length))*size*.58;return [s.x,s.y,s.x+w,s.y+lines.length*size*1.25]}
 return [Math.min(s.a[0],s.b[0]),Math.min(s.a[1],s.b[1]),Math.max(s.a[0],s.b[0]),Math.max(s.a[1],s.b[1])]}
function paintBackground(ctx,w,h){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);
 if(st.bgImage){const i=st.bgImage,k=Math.max(w/i.width,h/i.height);ctx.drawImage(i,(w-i.width*k)/2,(h-i.height*k)/2,i.width*k,i.height*k)}
 else if(st.bg==='grid'||st.bg==='dots'){ctx.fillStyle=ctx.strokeStyle='#d9dde5';ctx.lineWidth=1.5;for(let x=50;x<w;x+=50)for(let y=50;y<h;y+=50){if(st.bg==='dots'){ctx.beginPath();ctx.arc(x,y,2.4,0,Math.PI*2);ctx.fill()}}
  if(st.bg==='grid'){ctx.beginPath();for(let x=50;x<w;x+=50){ctx.moveTo(x,0);ctx.lineTo(x,h)}for(let y=50;y<h;y+=50){ctx.moveTo(0,y);ctx.lineTo(w,y)}ctx.stroke()}}
 if(st.legacy)ctx.drawImage(st.legacy,0,0,w,h)}
function redraw(){if(!st)return;const {ctx,layer,lctx,dpr,k}=st;
 lctx.setTransform(1,0,0,1,0,0);lctx.clearRect(0,0,layer.width,layer.height);lctx.setTransform(dpr*k,0,0,dpr*k,0,0);
 for(const s of st.shapes)drawShape(lctx,s);if(st.current)drawShape(lctx,st.current);
 ctx.setTransform(dpr*k,0,0,dpr*k,0,0);paintBackground(ctx,W,H);ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(layer,0,0);
 if(st.selected!=null&&st.shapes[st.selected]){const b=bounds(st.shapes[st.selected]);ctx.setTransform(dpr*k,0,0,dpr*k,0,0);ctx.setLineDash([10,8]);ctx.strokeStyle='#3e7bfa';ctx.lineWidth=2/k;ctx.strokeRect(b[0]-8,b[1]-8,b[2]-b[0]+16,b[3]-b[1]+16);ctx.setLineDash([])}
 paintTools()}
// ---- hold still to straighten a stroke into a line, rectangle or oval ------------------------------------------------
function recognise(pts){if(pts.length<8)return null;const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),diag=Math.hypot(x1-x0,y1-y0);if(diag<30)return null;
 const a=pts[0],b=pts.at(-1),chord=Math.hypot(b[0]-a[0],b[1]-a[1]);
 if(chord>diag*.8){let dev=0;for(const p of pts){dev=Math.max(dev,Math.abs((b[1]-a[1])*p[0]-(b[0]-a[0])*p[1]+b[0]*a[1]-b[1]*a[0])/Math.max(1,chord))}if(dev<chord*.09)return {t:'line',a:[...a],b:[...b]}}
 if(chord>diag*.35)return null; // open stroke: keep it as drawn
 const cx=(x0+x1)/2,cy=(y0+y1)/2,rx=Math.max(1,(x1-x0)/2),ry=Math.max(1,(y1-y0)/2);let ell=0,rect=0;
 for(const [x,y] of pts){ell+=Math.abs(Math.hypot((x-cx)/rx,(y-cy)/ry)-1);rect+=Math.min(Math.abs(x-x0),Math.abs(x-x1),Math.abs(y-y0),Math.abs(y-y1))/Math.min(rx,ry)}
 ell/=pts.length;rect/=pts.length;
 if(rect<ell*.8&&rect<.16)return {t:'rect',a:[x0,y0],b:[x1,y1]};if(ell<.22)return {t:'ellipse',a:[x0,y0],b:[x1,y1]};return null}
// ---- input ---------------------------------------------------------------------------------------------------------
function at(e){const r=st.canvas.getBoundingClientRect();return [Math.round((e.clientX-r.left)/st.k*10)/10,Math.round((e.clientY-r.top)/st.k*10)/10]}
function hit(p){for(let i=st.shapes.length-1;i>=0;i--){const s=st.shapes[i];if(s.t==='eraser')continue;const b=bounds(s);if(p[0]>=b[0]-20&&p[0]<=b[2]+20&&p[1]>=b[1]-20&&p[1]<=b[3]+20)return i}return null}
function down(e){if(!st||e.button>0)return;e.preventDefault();st.canvas.setPointerCapture(e.pointerId);const p=at(e),tool=st.tool;st.drag={start:p,last:p};
 if(tool==='text'){editText(p);return}
 if(tool==='move'){st.selected=hit(p);if(st.selected!=null){push();st.drag.moving=true}redraw();return}
 st.selected=null;
 if(['pen','marker','eraser'].includes(tool))st.current={t:tool,c:st.color,s:tool==='marker'?st.size*3:tool==='eraser'?st.size*3.5:st.size,pts:[p]};
 else st.current={t:tool,c:st.color,s:st.size,a:p,b:p};
 redraw();if(tool==='pen')armHold()}
function armHold(){clearTimeout(st.hold);st.hold=setTimeout(()=>{if(!st?.current||st.current.t!=='pen')return;const shape=recognise(st.current.pts);if(shape){st.current={...shape,c:st.current.c,s:st.current.s};st.snapped=true;redraw()}},550)}
function move(e){if(!st?.drag)return;e.preventDefault();const p=at(e),d=st.drag;
 if(d.moving&&st.selected!=null){const dx=p[0]-d.last[0],dy=p[1]-d.last[1],s=st.shapes[st.selected];if(s.pts)s.pts=s.pts.map(q=>[q[0]+dx,q[1]+dy]);else if(s.t==='text'){s.x+=dx;s.y+=dy}else{s.a=[s.a[0]+dx,s.a[1]+dy];s.b=[s.b[0]+dx,s.b[1]+dy]}d.last=p;redraw();return}
 const c=st.current;if(!c)return;
 if(c.pts){if(st.snapped)return;const l=c.pts.at(-1);if(Math.hypot(p[0]-l[0],p[1]-l[1])<1.5)return;c.pts.push(p);if(c.pts.length>4000)c.pts.shift();if(c.t==='pen'&&Math.hypot(p[0]-d.last[0],p[1]-d.last[1])>3){d.last=p;armHold()}}
 else{c.b=p;if(c.t==='rect'||c.t==='ellipse')if(e.shiftKey){const s=Math.max(Math.abs(p[0]-c.a[0]),Math.abs(p[1]-c.a[1]));c.b=[c.a[0]+Math.sign(p[0]-c.a[0])*s,c.a[1]+Math.sign(p[1]-c.a[1])*s]}}
 // after a snap, dragging keeps shaping the recognised figure
 redraw()}
function up(){if(!st)return;clearTimeout(st.hold);const c=st.current;st.drag=null;
 if(c){const tiny=c.pts?false:Math.hypot(c.b[0]-c.a[0],c.b[1]-c.a[1])<4;if(!tiny){push();st.shapes.push(c)}st.current=null;st.snapped=false}
 redraw()}
function editText(p){const box=st.canvas.parentElement,input=document.createElement('textarea');input.className='dw-text';input.rows=2;input.placeholder='Escribí…';
 input.style.left=p[0]*st.k+'px';input.style.top=p[1]*st.k+'px';input.style.color=st.color;input.style.fontSize=Math.max(14,st.size*5*st.k)+'px';box.append(input);setTimeout(()=>input.focus(),0);
 const done=()=>{const text=input.value.trim();input.remove();if(text){push();st.shapes.push({t:'text',c:st.color,size:Math.max(20,st.size*5),x:p[0],y:p[1],text})}redraw()};
 input.onblur=done;input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();input.blur()}if(e.key==='Escape'){input.value='';input.blur()}}}
// ---- toolbar -----------------------------------------------------------------------------------------------------
function paintTools(){const f=document.getElementById('drawingForm');if(!f)return;
 f.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===st.tool)));
 f.querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===st.color)));
 f.querySelector('[data-act=undo]').disabled=!st.undo.length;f.querySelector('[data-act=redo]').disabled=!st.redo.length;
 f.querySelectorAll('[data-bg]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.bg===(st.bgImage?'photo':st.bg))));
 const del=f.querySelector('[data-act=delete]');del.hidden=st.selected==null}
drawingForm=function(id){
 const r=record('drawings',id);
 openModal(r?'Editar dibujo':'Nuevo dibujo',`<form class="form" id="drawingForm"><label>Nombre<input name="name" required maxlength="100" value="${esc(r?.name||'')}" placeholder="Un boceto, una idea…"></label>
  <div class="dw-tools" role="toolbar" aria-label="Herramientas">${TOOLS.map(([t,l,d])=>`<button type="button" data-tool="${t}" aria-label="${l}" title="${l}">${svg(d)}<span>${l}</span></button>`).join('')}</div>
  <div class="dw-row"><div class="dw-colors">${COLORS.map(c=>`<button type="button" data-color="${c}" aria-label="Color ${c}" style="--c:${c}"></button>`).join('')}<label class="dw-custom" aria-label="Otro color"><input type="color" value="#1f2430"></label></div>
   <label class="dw-size">Grosor<input type="range" min="2" max="30" value="6"></label></div>
  <div class="dw-row"><button type="button" data-act="undo" aria-label="Deshacer">↶ Deshacer</button><button type="button" data-act="redo" aria-label="Rehacer">↷ Rehacer</button><button type="button" data-act="delete" hidden>Borrar forma</button><button type="button" data-act="clear">Limpiar</button>
   <span class="dw-bg"><button type="button" data-bg="white">Blanco</button><button type="button" data-bg="grid">Cuadros</button><button type="button" data-bg="dots">Puntos</button><label class="dw-photo" data-bg="photo">Foto<input type="file" accept="image/*"></label></span></div>
  <div class="dw-stage"><canvas id="drawingCanvas" aria-label="Lienzo de dibujo"></canvas></div>
  <p class="small">Si mantenés el dedo quieto al terminar un trazo, se vuelve línea, rectángulo u óvalo.</p>
  <div class="form-actions"><button type="button" onclick="closeModal()">Cancelar</button><button class="primary">Guardar dibujo</button></div></form>`,true);
 const form=document.getElementById('drawingForm'),canvas=document.getElementById('drawingCanvas'),stage=canvas.parentElement;
 const cssW=Math.max(240,Math.min(stage.clientWidth||340,560)),k=Math.min(cssW/W,(innerHeight*.56)/H),dpr=Math.min(2.5,devicePixelRatio||1);
 canvas.style.width=W*k+'px';canvas.style.height=H*k+'px';canvas.width=Math.round(W*k*dpr);canvas.height=Math.round(H*k*dpr);
 const layer=document.createElement('canvas');layer.width=canvas.width;layer.height=canvas.height;
 st={canvas,ctx:canvas.getContext('2d'),layer,lctx:layer.getContext('2d'),k,dpr,tool:'pen',color:COLORS[0],size:6,shapes:Array.isArray(r?.shapes)?structuredClone(r.shapes):[],undo:[],redo:[],bg:r?.bg?.type||'white',bgImage:null,bgMedia:r?.bg?.media||null,legacy:null,selected:null,current:null};
 if(r?.image&&!Array.isArray(r.shapes)){const img=new Image();img.onload=()=>{if(st){st.legacy=img;redraw()}};img.src=r.image} // older drawings: their picture is the page
 if(st.bgMedia)host().scanURL(st.bgMedia).then(u=>{if(!u||!st)return;const img=new Image();img.onload=()=>{st.bgImage=img;redraw()};img.src=u});
 canvas.onpointerdown=down;canvas.onpointermove=move;canvas.onpointerup=canvas.onpointercancel=up;
 form.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{st.tool=b.dataset.tool;st.selected=null;redraw()});
 form.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{st.color=b.dataset.color;if(st.selected!=null){push();const s=st.shapes[st.selected];s.c=st.color}redraw()});
 form.querySelector('.dw-custom input').oninput=e=>{st.color=e.target.value;redraw()};
 form.querySelector('.dw-size input').oninput=e=>{st.size=Number(e.target.value)};
 form.querySelector('[data-act=undo]').onclick=()=>{if(!st.undo.length)return;st.redo.push(snapshot());st.shapes=JSON.parse(st.undo.pop());st.selected=null;redraw()};
 form.querySelector('[data-act=redo]').onclick=()=>{if(!st.redo.length)return;st.undo.push(snapshot());st.shapes=JSON.parse(st.redo.pop());redraw()};
 form.querySelector('[data-act=delete]').onclick=()=>{if(st.selected==null)return;push();st.shapes.splice(st.selected,1);st.selected=null;redraw()};
 form.querySelector('[data-act=clear]').onclick=()=>{if(!st.shapes.length&&!st.legacy)return;push();st.shapes=[];st.legacy=null;redraw()};
 form.querySelectorAll('button[data-bg]').forEach(b=>b.onclick=()=>{st.bg=b.dataset.bg;st.bgImage=null;st.bgMedia=null;redraw()});
 form.querySelector('.dw-photo input').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const img=await createImageBitmap(file,{imageOrientation:'from-image'}).catch(()=>null)||await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=URL.createObjectURL(file)});
  const scale=Math.min(1,1600/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  const blob=await new Promise(ok=>c.toBlob(ok,'image/jpeg',.85));st.bgMedia=await host().putMedia(blob);st.bgImage=c;st.bg='photo';redraw()}catch{notify('No se pudo usar esa foto.')}};
 form.onsubmit=e=>{e.preventDefault();try{
  const out=document.createElement('canvas');out.width=W;out.height=H;const o=out.getContext('2d');const keep={k:st.k,dpr:st.dpr};
  // export at full size: background, then the drawing layer
  const lay=document.createElement('canvas');lay.width=W;lay.height=H;const lc=lay.getContext('2d');for(const s of st.shapes)drawShape(lc,s);
  paintBackground(o,W,H);o.drawImage(lay,0,0);
  const photo=!!st.bgImage,image=photo?out.toDataURL('image/jpeg',.82):out.toDataURL('image/png');
  storeRecord('drawings',{name:new FormData(form).get('name').trim(),image,shapes:st.shapes,bg:{type:photo?'photo':st.bg,media:photo?st.bgMedia:null}},id);
  st=null;closeModal();save('Dibujo guardado')}catch(err){notify(err.message)}};
 redraw();
};
})();
