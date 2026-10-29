// Applied to the shell and to every module document (same origin).
// 1) Blocks pinch zoom (Safari gesture events and two-finger moves).
// 2) While a dialog is open, a drag only scrolls a scrollable area inside that dialog; it never reaches the screen behind.
const OPEN='dialog[open],#focusStage';
function scrollableInside(target,root,dy,win){
 for(let el=target;el&&el!==root.parentNode;el=el.parentElement){
  if(el.nodeType!==1)continue;const s=win.getComputedStyle(el);
  if(/(auto|scroll)/.test(s.overflowY)&&el.scrollHeight>el.clientHeight+1){
   if(dy<0&&el.scrollTop+el.clientHeight<el.scrollHeight-1)return true; // finger up, content can go down
   if(dy>0&&el.scrollTop>0)return true;
   if(dy===0)return true;
  }
  if(el===root)break;
 }
 return false;
}
export function installTouchGuard(doc){
 const win=doc.defaultView;if(!win||doc.__touchGuard)return;doc.__touchGuard=true;
 const stop=e=>e.preventDefault();
 for(const type of ['gesturestart','gesturechange','gestureend'])doc.addEventListener(type,stop,{passive:false});
 let lastY=0;
 doc.addEventListener('touchstart',e=>{lastY=e.touches[0]?.clientY||0},{passive:true,capture:true});
 doc.addEventListener('touchmove',e=>{
  if(e.touches.length>1){e.preventDefault();return}
  const open=[...doc.querySelectorAll(OPEN)].pop();if(!open)return;
  const y=e.touches[0].clientY,dy=y-lastY;lastY=y;
  const target=e.target;
  if(target?.closest?.('input[type=range]'))return; // sliders are dragged, not scrolled
  if(target===open||!open.contains(target)||!scrollableInside(target,open,dy,win))e.preventDefault();
 },{passive:false,capture:true});
 doc.addEventListener('wheel',e=>{
  if(e.ctrlKey){e.preventDefault();return}
  const open=[...doc.querySelectorAll(OPEN)].pop();if(!open)return;
  if(e.target===open||!open.contains(e.target)||!scrollableInside(e.target,open,-e.deltaY,win))e.preventDefault();
 },{passive:false,capture:true});
}
