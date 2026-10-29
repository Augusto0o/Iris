import test from 'node:test';import assert from 'node:assert/strict';
import {detectDocument,homography,outputSize,warp,enhance,rotate90,quadArea} from '../src/scan-crop.js';
const make=(w,h,fill=[40,40,40])=>{const d=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++){d[i*4]=fill[0];d[i*4+1]=fill[1];d[i*4+2]=fill[2];d[i*4+3]=255}return {width:w,height:h,data:d}};
const inside=(q,x,y)=>{let s=0;for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4],c=(b.x-a.x)*(y-a.y)-(b.y-a.y)*(x-a.x);s+=c>0?1:c<0?-1:0}return Math.abs(s)===4};
// a tilted sheet of paper on a dark table
const sheet=[{x:120,y:60},{x:520,y:90},{x:500,y:560},{x:90,y:520}];
const photo=()=>{const img=make(640,640);for(let y=0;y<640;y++)for(let x=0;x<640;x++)if(inside(sheet,x,y)){const i=(y*640+x)*4;img.data[i]=img.data[i+1]=img.data[i+2]=235}return img};

test('Finds the four corners of a sheet in the photo',()=>{
 const q=detectDocument(photo());
 q.forEach((p,i)=>assert.ok(Math.hypot(p.x-sheet[i].x,p.y-sheet[i].y)<14,`corner ${i}: ${JSON.stringify(p)} vs ${JSON.stringify(sheet[i])}`));
});
test('With no sheet standing out it keeps (almost) the whole photo',()=>{
 const q=detectDocument(make(300,200,[230,230,230]));assert.ok(quadArea(q)>300*200*.8);
});
test('Straightening maps the corners and fills the page with paper',()=>{
 const m=homography(100,50,sheet),map=(x,y)=>{const d=m[6]*x+m[7]*y+1;return [(m[0]*x+m[1]*y+m[2])/d,(m[3]*x+m[4]*y+m[5])/d]};
 for(const [i,[x,y]] of [[0,0],[100,0],[100,50],[0,50]].entries()){const [u,v]=map(x,y);assert.ok(Math.abs(u-sheet[i].x)<1e-6&&Math.abs(v-sheet[i].y)<1e-6)}
 const size=outputSize(sheet,300);assert.ok(size.height>size.width&&Math.max(size.width,size.height)===300);
 const out=warp(photo(),sheet,make(size.width,size.height,[0,0,0]));let paper=0;for(let i=0;i<out.data.length;i+=4)if(out.data[i]>200)paper++;
 assert.ok(paper/(size.width*size.height)>.97,'almost all paper: '+paper/(size.width*size.height));
});
test('Document filter turns shadowed paper white and keeps the ink dark',()=>{
 const img=make(200,200);for(let y=0;y<200;y++)for(let x=0;x<200;x++){const i=(y*200+x)*4,v=120+x*.5;img.data[i]=img.data[i+1]=img.data[i+2]=(x>90&&x<110&&y>40&&y<160)?30:v}
 enhance(img,'document');const at=(x,y)=>img.data[(y*200+x)*4];
 assert.ok(at(10,100)>235&&at(190,100)>235,'paper white on both sides: '+at(10,100)+' '+at(190,100));assert.ok(at(100,100)<80,'ink stays dark: '+at(100,100));
});
test('Rotating swaps the sides',()=>{const r=rotate90(make(30,10),(w,h)=>make(w,h));assert.equal(r.width,10);assert.equal(r.height,30)});

test('Document filter removes the paper tint',()=>{const img=make(60,60,[244,236,200]);enhance(img,'document');const [r,g,b]=img.data;assert.ok(r>235&&g>235&&b>235&&Math.max(r,g,b)-Math.min(r,g,b)<8,'white: '+[r,g,b])});
test('Finds a light sheet on a light, textured table (edges, not brightness)',()=>{
 const img=make(640,640,[200,196,188]);for(let i=0;i<img.data.length;i+=4){const v=(Math.sin(i*.37)+Math.sin(i*.011))*9;img.data[i]+=v;img.data[i+1]+=v;img.data[i+2]+=v}
 const sh=[{x:140,y:90},{x:500,y:120},{x:470,y:560},{x:110,y:530}];
 for(let y=0;y<640;y++)for(let x=0;x<640;x++)if(inside(sh,x,y)){const i=(y*640+x)*4,v=232-(x/640)*30;img.data[i]=img.data[i+1]=img.data[i+2]=v}
 const q=detectDocument(img);q.forEach((p,i)=>assert.ok(Math.hypot(p.x-sh[i].x,p.y-sh[i].y)<16,`corner ${i}: ${JSON.stringify(p)} vs ${JSON.stringify(sh[i])}`));
});
test('A sheet with dark printed lines inside is not cut at the lines',()=>{
 const img=photo();for(let y=150;y<460;y+=40)for(let x=170;x<460;x++){const i=(y*640+x)*4;img.data[i]=img.data[i+1]=img.data[i+2]=30}
 const q=detectDocument(img);q.forEach((p,i)=>assert.ok(Math.hypot(p.x-sheet[i].x,p.y-sheet[i].y)<16,`corner ${i}: ${JSON.stringify(p)}`));
});

test('findDocument says whether a sheet was found (the live camera only outlines real ones)',async()=>{
 const {findDocument}=await import('../src/scan-crop.js');
 const W=240,H=180,blank={width:W,height:H,data:new Uint8ClampedArray(W*H*4).fill(90)};
 const r=findDocument(blank);assert.equal(r.found,false);assert.equal(r.quad.length,4);
 const page={width:W,height:H,data:new Uint8ClampedArray(W*H*4)};for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,inside=x>50&&x<190&&y>30&&y<150;page.data[i]=page.data[i+1]=page.data[i+2]=inside?240:40;page.data[i+3]=255}
 const f=findDocument(page);assert.equal(f.found,true);assert.ok(Math.abs(f.quad[0].x-51)<8&&Math.abs(f.quad[0].y-31)<8,JSON.stringify(f.quad));
});
