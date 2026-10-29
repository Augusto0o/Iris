// Document scan like the iPhone's: find the sheet in the photo, let you move its four corners, straighten it
// (perspective correction) and clean it up (white paper, crisp ink). Pure functions over ImageData-like objects
// ({width,height,data}) so they can be tested without a browser.

// ---- Finding the sheet -----------------------------------------------------------------------------------
const lum=(d,i)=>.299*d[i]+.587*d[i+1]+.114*d[i+2];
function boxBlur(src,w,h,r){const out=new Float32Array(w*h),tmp=new Float32Array(w*h);
 for(let y=0;y<h;y++){let acc=0;for(let x=-r;x<=r;x++)acc+=src[y*w+Math.min(w-1,Math.max(0,x))];for(let x=0;x<w;x++){tmp[y*w+x]=acc/(2*r+1);acc+=src[y*w+Math.min(w-1,x+r+1)]-src[y*w+Math.max(0,x-r)]}}
 for(let x=0;x<w;x++){let acc=0;for(let y=-r;y<=r;y++)acc+=tmp[Math.min(h-1,Math.max(0,y))*w+x];for(let y=0;y<h;y++){out[y*w+x]=acc/(2*r+1);acc+=tmp[Math.min(h-1,y+r+1)*w+x]-tmp[Math.max(0,y-r)*w+x]}}
 return out}
function otsu(values){const hist=new Float64Array(256);for(const v of values)hist[Math.max(0,Math.min(255,v|0))]++;
 const n=values.length;let sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];let sumB=0,wB=0,best=0,threshold=128;
 for(let t=0;t<256;t++){wB+=hist[t];if(!wB)continue;const wF=n-wB;if(!wF)break;sumB+=t*hist[t];const mB=sumB/wB,mF=(sum-sumB)/wF,between=wB*wF*(mB-mF)**2;if(between>best){best=between;threshold=t}}
 return threshold}
// Returns the four corners [tl,tr,br,bl] in the image's pixels, or a slightly inset full frame when no sheet stands out.
function regionQuad(img){
 const {width:W,height:H,data}=img,k=Math.min(1,240/Math.max(W,H)),w=Math.max(8,Math.round(W*k)),h=Math.max(8,Math.round(H*k));
 const g=new Float32Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=Math.min(W-1,Math.floor(x/k)),sy=Math.min(H-1,Math.floor(y/k));g[y*w+x]=lum(data,(sy*W+sx)*4)}
 const blur=boxBlur(g,w,h,2),t=otsu(blur),mask=new Uint8Array(w*h);for(let i=0;i<w*h;i++)mask[i]=blur[i]>t?1:0;
 // the biggest bright region is the paper
 const label=new Int32Array(w*h),stack=[];let best=0,bestSize=0,next=1;
 for(let i=0;i<w*h;i++){if(!mask[i]||label[i])continue;let size=0;label[i]=next;stack.push(i);
  while(stack.length){const p=stack.pop();size++;const x=p%w,y=(p/w)|0;for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(q>=0&&mask[q]&&!label[q]){label[q]=next;stack.push(q)}}
  if(size>bestSize){bestSize=size;best=next}next++}
 if(bestSize<w*h*.12)return null;
 // extreme points of the region along the diagonals are its corners
 let tl=null,tr=null,br=null,bl=null,touches=0;const edge={l:0,r:0,t:0,b:0};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(label[y*w+x]!==best)continue;
  if(x===0)edge.l++;if(x===w-1)edge.r++;if(y===0)edge.t++;if(y===h-1)edge.b++;
  if(!tl||x+y<tl.x+tl.y)tl={x,y};if(!br||x+y>br.x+br.y)br={x,y};if(!tr||x-y>tr.x-tr.y)tr={x,y};if(!bl||x-y<bl.x-bl.y)bl={x,y}}
 for(const [side,len] of [['l',h],['r',h],['t',w],['b',w]])if(edge[side]>len*.6)touches++;
 if(touches>=3)return null; // the "paper" is the whole frame: nothing to crop
 const quad=[tl,tr,br,bl].map(p=>({x:Math.round((p.x+.5)/k),y:Math.round((p.y+.5)/k)}));
 return quadArea(quad)<W*H*.1?null:quad;
}
// ---- Second method: the sheet's four straight edges (gradients + Hough lines) ------------------------------
// Works when paper and table are both light, or the sheet is lit unevenly, where the bright-region method fails.
function edgeMap(img,max=360){
 const {width:W,height:H,data}=img,k=Math.min(1,max/Math.max(W,H)),w=Math.max(16,Math.round(W*k)),h=Math.max(16,Math.round(H*k));
 const g=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=Math.min(W-1,Math.floor((x+.5)/k)),sy=Math.min(H-1,Math.floor((y+.5)/k));g[y*w+x]=lum(data,(sy*W+sx)*4)}
 const b=boxBlur(boxBlur(g,w,h,1),w,h,1),mag=new Float32Array(w*h),ang=new Float32Array(w*h);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x,gx=b[i-w+1]+2*b[i+1]+b[i+w+1]-b[i-w-1]-2*b[i-1]-b[i+w-1],gy=b[i+w-1]+2*b[i+w]+b[i+w+1]-b[i-w-1]-2*b[i-w]-b[i-w+1];mag[i]=Math.hypot(gx,gy);ang[i]=Math.atan2(gy,gx)}
 const sorted=Float32Array.from(mag).sort(),thr=Math.max(18,sorted[Math.floor(sorted.length*.9)]);
 return {w,h,k,mag,ang,thr};
}
function houghLines(E){
 const {w,h,mag,ang,thr}=E,T=120,diag=Math.hypot(w,h),R=Math.ceil(diag/2)*2+1,acc=new Float32Array(T*R),cos=[],sin=[];
 for(let t=0;t<T;t++){const th=t*Math.PI/T;cos.push(Math.cos(th));sin.push(Math.sin(th))}
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x,m=mag[i];if(m<thr)continue;
  // only vote near the gradient direction: an edge is perpendicular to it
  let a=ang[i];if(a<0)a+=Math.PI;const t0=Math.round(a/Math.PI*T);
  for(let dt=-4;dt<=4;dt++){const t=((t0+dt)%T+T)%T,r=Math.round((x*cos[t]+y*sin[t]+diag)/2);if(r>=0&&r<R)acc[t*R+r]+=m}}
 const peaks=[];for(let t=0;t<T;t++)for(let r=0;r<R;r++){const v=acc[t*R+r];if(v<=0)continue;let max=true;
  for(let dt=-3;dt<=3&&max;dt++)for(let dr=-4;dr<=4;dr++){if(!dt&&!dr)continue;const tt=((t+dt)%T+T)%T,rr=r+dr;if(rr>=0&&rr<R&&acc[tt*R+rr]>v){max=false;break}}
  if(max)peaks.push({t:t*Math.PI/T,rho:r*2-diag,v})}
 return peaks.sort((a,b)=>b.v-a.v).slice(0,28);
}
function cross(a,b){const d=Math.cos(a.t)*Math.sin(b.t)-Math.sin(a.t)*Math.cos(b.t);if(Math.abs(d)<1e-6)return null;
 return {x:(a.rho*Math.sin(b.t)-b.rho*Math.sin(a.t))/d,y:(b.rho*Math.cos(a.t)-a.rho*Math.cos(b.t))/d}}
function convex(q){let sign=0;for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4],c=q[(i+2)%4],z=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);if(Math.abs(z)<1e-9)return false;const s=Math.sign(z);if(sign&&s!==sign)return false;sign=s}return true}
// How well a quad sits on real edges: share of points along its sides that are on a strong edge parallel to the side.
function support(E,q){const {w,h,mag,ang,thr}=E;let hit=0,total=0;
 for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4],len=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(12,Math.round(len/4)),nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len;let side=0;
  for(let j=1;j<n;j++){const px=a.x+(b.x-a.x)*j/n,py=a.y+(b.y-a.y)*j/n;let ok=false;
   for(let o=-2;o<=2&&!ok;o++){const x=Math.round(px+nx*o),y=Math.round(py+ny*o);if(x<1||y<1||x>=w-1||y>=h-1)continue;const k=y*w+x;
    if(mag[k]>=thr*.7&&Math.abs(Math.cos(ang[k])*nx+Math.sin(ang[k])*ny)>.8)ok=true}
   if(ok)side++}
  const f=side/(n-1);hit+=Math.min(f,.95);total++;if(f<.25)return 0} // every side needs some real edge
 return hit/total;
}
function scoreQuad(E,q){if(!q||!convex(q))return 0;const {w,h}=E,area=quadArea(q)/(w*h);if(area<.12||area>1.02)return 0;
 for(const p of q)if(p.x<-w*.03||p.y<-h*.03||p.x>w*1.03||p.y>h*1.03)return 0;
 // corners near 90° (perspective allows some slack)
 let angles=0;for(let i=0;i<4;i++){const a=q[(i+3)%4],b=q[i],c=q[(i+1)%4],v1=[a.x-b.x,a.y-b.y],v2=[c.x-b.x,c.y-b.y],cs=(v1[0]*v2[0]+v1[1]*v2[1])/(Math.hypot(...v1)*Math.hypot(...v2));angles+=Math.abs(cs)}
 if(angles/4>.5)return 0;
 return support(E,q)*(.55+.45*Math.sqrt(Math.min(1,area)))*(1-.35*angles/4);
}
function order(q){const c={x:q.reduce((s,p)=>s+p.x,0)/4,y:q.reduce((s,p)=>s+p.y,0)/4};const s=[...q].sort((a,b)=>Math.atan2(a.y-c.y,a.x-c.x)-Math.atan2(b.y-c.y,b.x-c.x));
 let tl=0;for(let i=1;i<4;i++)if(s[i].x+s[i].y<s[tl].x+s[tl].y)tl=i;return [0,1,2,3].map(i=>s[(tl+i)%4])}
function edgeQuads(E){const lines=houghLines(E),horiz=[],vert=[];
 for(const l of lines){const deg=l.t*180/Math.PI;if(Math.abs(deg-90)<35)horiz.push(l);else if(deg<35||deg>145)vert.push(l)}
 const out=[],H8=horiz.slice(0,9),V8=vert.slice(0,9);
 for(let i=0;i<H8.length;i++)for(let j=i+1;j<H8.length;j++)for(let a=0;a<V8.length;a++)for(let b=a+1;b<V8.length;b++){
  const pts=[cross(H8[i],V8[a]),cross(H8[i],V8[b]),cross(H8[j],V8[b]),cross(H8[j],V8[a])];if(pts.some(p=>!p))continue;out.push(order(pts))}
 return out}
// Fine-tune each side with the edge points along it (least squares), then take the corners from the fitted lines.
function refine(E,q){const {w,h,mag,ang,thr}=E,lines=[];
 for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4],len=Math.hypot(b.x-a.x,b.y-a.y),nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len,pts=[];
  for(let j=2;j<len-2;j+=.7){const px=a.x+(b.x-a.x)*j/len,py=a.y+(b.y-a.y)*j/len;let bestM=0,bx=0,by=0;
   for(let o=-5;o<=5;o++){const x=Math.round(px+nx*o),y=Math.round(py+ny*o);if(x<1||y<1||x>=w-1||y>=h-1)continue;const k=y*w+x;
    if(mag[k]>bestM&&mag[k]>=thr*.6&&Math.abs(Math.cos(ang[k])*nx+Math.sin(ang[k])*ny)>.8){bestM=mag[k];bx=x;by=y}}
   if(bestM)pts.push([bx,by])}
  if(pts.length<8){lines.push(null);continue}
  const mx=pts.reduce((s,p)=>s+p[0],0)/pts.length,my=pts.reduce((s,p)=>s+p[1],0)/pts.length;let sxx=0,syy=0,sxy=0;for(const [x,y] of pts){sxx+=(x-mx)**2;syy+=(y-my)**2;sxy+=(x-mx)*(y-my)}
  const th=.5*Math.atan2(2*sxy,sxx-syy)+Math.PI/2;lines.push({t:th,rho:mx*Math.cos(th)+my*Math.sin(th)})}
 if(lines.some(l=>!l))return q;
 const out=[0,1,2,3].map(i=>cross(lines[(i+3)%4],lines[i]));return out.some(p=>!p||!Number.isFinite(p.x))?q:out}
// The sheet in a photo: {quad, score, found}. Used live by the camera (several times a second on a small frame).
export function findDocument(img){
 const {width:W,height:H}=img,inset=()=>{const m=Math.round(Math.min(W,H)*.04);return [{x:m,y:m},{x:W-m,y:m},{x:W-m,y:H-m},{x:m,y:H-m}]};
 const E=edgeMap(img),toSmall=q=>q.map(p=>({x:p.x*E.k,y:p.y*E.k})),toBig=q=>q.map(p=>({x:Math.round(Math.max(0,Math.min(W,p.x/E.k))),y:Math.round(Math.max(0,Math.min(H,p.y/E.k)))}));
 // candidates: the bright region and the best line-made quads; each is fine-tuned on its edges, then scored
 const region=regionQuad(img),cands=[];if(region)cands.push({q:toSmall(region),bonus:.03});
 for(const q of edgeQuads(E).map(q=>({q,sc:scoreQuad(E,q)})).filter(c=>c.sc>0).sort((a,b)=>b.sc-a.sc).slice(0,8))cands.push({q:q.q,bonus:0});
 let best=null,bestScore=0;
 for(const c of cands){const fine=refine(E,c.q),sf=scoreQuad(E,fine),sr=scoreQuad(E,c.q),[q,sc]=sf>=sr?[fine,sf]:[c.q,sr];if(sc+c.bonus>bestScore){bestScore=sc+c.bonus;best=toBig(q)}}
 if(!best&&region){best=region;bestScore=.3}
 return best&&bestScore>=.3?{quad:best,score:bestScore,found:true}:{quad:inset(),score:bestScore,found:false};
}
export function detectDocument(img){return findDocument(img).quad}
export function quadArea(q){let a=0;for(let i=0;i<4;i++){const p=q[i],n=q[(i+1)%4];a+=p.x*n.y-n.x*p.y}return Math.abs(a)/2}

// ---- Straightening --------------------------------------------------------------------------------------------
// Homography that takes the output rectangle (0,0)-(w,h) to the quad in the photo.
export function homography(w,h,q){
 const src=[[0,0],[w,0],[w,h],[0,h]],A=[],b=[];
 for(let i=0;i<4;i++){const [x,y]=src[i],{x:u,y:v}=q[i];A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v)}
 for(let c=0;c<8;c++){let p=c;for(let r=c+1;r<8;r++)if(Math.abs(A[r][c])>Math.abs(A[p][c]))p=r;[A[c],A[p]]=[A[p],A[c]];[b[c],b[p]]=[b[p],b[c]];
  for(let r=0;r<8;r++){if(r===c)continue;const f=A[r][c]/A[c][c];for(let k=c;k<8;k++)A[r][k]-=f*A[c][k];b[r]-=f*b[c]}}
 const m=b.map((v,i)=>v/A[i][i]);return [...m,1];
}
export function outputSize(q,max=1800){
 const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),w=Math.max(d(q[0],q[1]),d(q[3],q[2])),h=Math.max(d(q[0],q[3]),d(q[1],q[2])),k=Math.min(1,max/Math.max(w,h));
 return {width:Math.max(1,Math.round(w*k)),height:Math.max(1,Math.round(h*k))};
}
// Writes the straightened sheet into `out` (ImageData-like of the output size).
export function warp(img,q,out){
 const {width:W,height:H,data:s}=img,{width:w,height:h,data:o}=out,m=homography(w,h,q);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const den=m[6]*(x+.5)+m[7]*(y+.5)+1,u=(m[0]*(x+.5)+m[1]*(y+.5)+m[2])/den-.5,v=(m[3]*(x+.5)+m[4]*(y+.5)+m[5])/den-.5;
  const x0=Math.max(0,Math.min(W-1,Math.floor(u))),y0=Math.max(0,Math.min(H-1,Math.floor(v))),x1=Math.min(W-1,x0+1),y1=Math.min(H-1,y0+1),fx=Math.min(1,Math.max(0,u-x0)),fy=Math.min(1,Math.max(0,v-y0));
  const i00=(y0*W+x0)*4,i10=(y0*W+x1)*4,i01=(y1*W+x0)*4,i11=(y1*W+x1)*4,j=(y*w+x)*4;
  for(let c=0;c<3;c++)o[j+c]=(s[i00+c]*(1-fx)+s[i10+c]*fx)*(1-fy)+(s[i01+c]*(1-fx)+s[i11+c]*fx)*fy;o[j+3]=255}
 return out;
}

// ---- Cleaning up ----------------------------------------------------------------------------------------------
// 'document': paper turns white and keeps the colour of the ink · 'gray' · 'bw' (black and white) · 'color' (as shot)
export function enhance(img,mode='document'){
 if(mode==='color')return img;
 const {width:w,height:h,data:d}=img,k=Math.min(1,96/Math.max(w,h)),sw=Math.max(4,Math.round(w*k)),sh=Math.max(4,Math.round(h*k));
 // the paper's brightness everywhere (shadows included): a heavy blur of a small copy
 const small=new Float32Array(sw*sh);for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const sx=Math.min(w-1,Math.floor(x/k)),sy=Math.min(h-1,Math.floor(y/k));small[y*sw+x]=lum(d,(sy*w+sx)*4)}
 // take the brighter of the neighbourhood so ink does not darken the estimate
 const lifted=new Float32Array(sw*sh);for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){let mx=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const v=small[Math.min(sh-1,Math.max(0,y+dy))*sw+Math.min(sw-1,Math.max(0,x+dx))];if(v>mx)mx=v}lifted[y*sw+x]=mx}
 const bg=boxBlur(lifted,sw,sh,3);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const fx=Math.min(sw-1,x*k),fy=Math.min(sh-1,y*k),x0=fx|0,y0=fy|0,x1=Math.min(sw-1,x0+1),y1=Math.min(sh-1,y0+1),ax=fx-x0,ay=fy-y0;
  const b=Math.max(24,(bg[y0*sw+x0]*(1-ax)+bg[y0*sw+x1]*ax)*(1-ay)+(bg[y1*sw+x0]*(1-ax)+bg[y1*sw+x1]*ax)*ay),i=(y*w+x)*4;
  if(mode==='document'){for(let c=0;c<3;c++){const v=d[i+c]/b;d[i+c]=Math.max(0,Math.min(255,255*Math.pow(Math.min(1.25,v),1.6)))}
   // the paper's own tint (yellowish, bluish) goes away; the colour of the ink stays
   const L=lum(d,i),white=Math.max(0,Math.min(1,(L-150)/70));if(white>0)for(let c=0;c<3;c++)d[i+c]=d[i+c]+(Math.min(255,L*1.06)-d[i+c])*white}
  else{const v=Math.min(1.2,lum(d,i)/b);let g=255*Math.pow(v,1.8);if(mode==='bw')g=g>178?255:Math.max(0,(g-60)*1.4);g=Math.max(0,Math.min(255,g));d[i]=d[i+1]=d[i+2]=g}
 }
 return img;
}
export function rotate90(img,make){const {width:w,height:h,data:s}=img,out=make(h,w),o=out.data;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,j=(x*h+(h-1-y))*4;o[j]=s[i];o[j+1]=s[i+1];o[j+2]=s[i+2];o[j+3]=255}return out}
