export function installMeasureGrid(){
 const layer=document.createElement('div');layer.id='measureGrid';layer.setAttribute('aria-hidden','true');
 const lines=document.createElement('div'),panel=document.createElement('pre');panel.id='measureReadout';layer.append(lines,panel);
 const toggle=document.createElement('button');toggle.id='measureToggle';toggle.type='button';
 let enabled=sessionStorage.getItem('nubo-grid-m4')!=='off';
 const safe=document.createElement('div');safe.style.cssText='position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';document.body.append(safe,layer,toggle);
 const r=n=>Math.round(n||0);
 function draw(){
  layer.hidden=!enabled;toggle.textContent=enabled?'Ocultar medidas':'Mostrar medidas';toggle.setAttribute('aria-pressed',String(enabled));if(!enabled)return;
  const vv=window.visualViewport,nav=document.getElementById('hostMobileNav')?.getBoundingClientRect(),btn=document.querySelector('#hostMobileNav button')?.getBoundingClientRect(),css=getComputedStyle(safe),h=innerHeight;
  const extent=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-height'))||h;lines.replaceChildren();for(let y=0;y<=extent;y+=50){const line=document.createElement('div');line.className='measure-row';line.style.top=y+'px';line.textContent=y+' px';lines.append(line)}
  for(const [label,y,color]of [['NAV inicio',nav?.top,'#ffab00'],['NAV fin',nav?.bottom,'#ffab00'],['VISUAL fin',(vv?.offsetTop||0)+(vv?.height||h),'#05ffd0']]){if(y==null)continue;const line=document.createElement('div');line.className='measure-boundary';line.style.cssText='top:'+Math.min(y,extent-2)+'px;color:'+color;line.textContent=label+' '+r(y);lines.append(line)}
  panel.textContent='NUBO · MEDIDAS M4 · px CSS\nPantalla '+screen.width+'×'+screen.height+' · DPR '+devicePixelRatio+'\nVentana '+innerWidth+'×'+h+' · doc '+document.documentElement.clientHeight+'\nVisual '+r(vv?.width)+'×'+r(vv?.height)+' · Y '+r(vv?.offsetTop)+'\nSafe real ↑'+css.paddingTop+' ↓'+css.paddingBottom+'\nNav Y '+r(nav?.top)+' → '+r(nav?.bottom)+' · alto '+r(nav?.height)+'\nAlto aplicado '+extent+'\nBotones fin '+r(btn?.bottom)+' · resto '+r(extent-(btn?.bottom||extent))+'\nPWA '+(matchMedia('(display-mode: standalone)').matches||navigator.standalone?'sí':'no');
 }
 toggle.onclick=()=>{enabled=!enabled;sessionStorage.setItem('nubo-grid-m4',enabled?'on':'off');draw()};
 window.addEventListener('resize',draw);window.visualViewport?.addEventListener('resize',draw);setInterval(draw,1500);draw();
}
