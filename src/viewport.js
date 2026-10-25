// Use drawable height only; never extend UI into a system-owned region.
export function viewportExtent({visible}){return visible;}
// Home-indicator clearance the bottom bar still has to add itself.
// iOS standalone apps can get a layout viewport shorter than the screen (WebKit bug 301994):
// the system paints the missing strip below the page, and that strip already clears the
// home indicator. Adding env(safe-area-inset-bottom) on top of it doubles the gap.
export function bottomClearance({inset,layout,width,screenWidth,screenHeight,standalone,keyboard}){
 if(keyboard)return 0;
 const safe=Math.max(0,Math.min(inset||0,34));
 if(!standalone)return safe;
 const landscape=width>layout,screen=landscape?Math.min(screenWidth,screenHeight):Math.max(screenWidth,screenHeight);
 const gap=screen-layout;
 // Only a status-bar sized strip counts; bigger differences are split view or windowed apps.
 if(!(gap>0&&gap<=100))return safe;
 return Math.max(0,safe-gap);
}
// Measure iOS safe areas once in the top-level viewport, not in nested documents.
export function installViewport({document:doc=document,window:win=window,onChange=()=>{}}={}){
 const probe=doc.createElement('div');probe.setAttribute('aria-hidden','true');probe.style.cssText='position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px);';doc.body.append(probe);
 let latest={bottom:0,keyboard:false};
 const measure=()=>{const css=win.getComputedStyle(probe),layout=win.innerHeight,visible=win.visualViewport?.height||layout,top=Math.max(0,Math.min(parseFloat(css.paddingTop)||0,80));
  const standalone=!!(win.navigator.standalone||win.matchMedia('(display-mode: standalone)').matches);
  const keyboard=layout-visible>150,bottom=bottomClearance({inset:parseFloat(css.paddingBottom)||0,layout,width:win.innerWidth,screenWidth:win.screen.width,screenHeight:win.screen.height,standalone,keyboard});
  const extent=viewportExtent({visible,layout,width:win.innerWidth,screenWidth:win.screen.width,screenHeight:win.screen.height,top,standalone,keyboard,scale:win.visualViewport?.scale||1});
  doc.documentElement.style.setProperty('--app-height',Math.round(extent)+'px');doc.documentElement.style.setProperty('--app-top',top+'px');doc.documentElement.style.setProperty('--app-offset',Math.round(win.visualViewport?.offsetTop||0)+'px');
  doc.documentElement.style.setProperty('--host-safe-bottom',bottom+'px');doc.documentElement.dataset.keyboard=keyboard?'open':'closed';latest={bottom,keyboard};onChange(latest);
 };
 win.addEventListener('resize',measure);win.addEventListener('orientationchange',measure);win.visualViewport?.addEventListener('resize',measure);win.visualViewport?.addEventListener('scroll',measure);measure();
 return {current:()=>latest};
}
