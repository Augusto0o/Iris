// Use drawable height only; never extend UI into a system-owned region.
// With the keyboard open keep the full layout height: iOS pans the page to show the field, and a shell shrunk
// to the visible height leaves an empty (white) area where it pans to.
export function viewportExtent({visible,layout,keyboard}){return keyboard&&layout?layout:visible;}
// Home-indicator clearance the bottom bar still has to add itself.
// iOS standalone apps can get a layout viewport shorter than the screen (WebKit bug 301994):
// the system paints the missing strip below the page, and that strip already clears the
// home indicator. Adding env(safe-area-inset-bottom) on top of it doubles the gap.
export function bottomClearance({inset,top=1,layout,visible,width,screenWidth,screenHeight,standalone,keyboard,homeIndicator=0}){
 if(keyboard)return 0;
 // iOS can report a 0 bottom inset to installed apps even on Face ID iPhones; fall back to the known indicator height.
 const safe=Math.max(0,Math.min(Math.max(inset||0,standalone?homeIndicator:0),34));
 // With an opaque status bar (top inset 0) iOS places the page below it: the missing height is at the top,
 // the page still reaches the home indicator and needs the full inset.
 if(!standalone||!(top>0))return safe;
 // Compare against the height the shell really draws (the visual viewport), not innerHeight:
 // iOS can report a full innerHeight while the visible area is still short.
 const drawn=Math.min(layout||Infinity,visible||Infinity);
 if(!Number.isFinite(drawn))return safe;
 const landscape=width>drawn,screen=landscape?Math.min(screenWidth,screenHeight):Math.max(screenWidth,screenHeight);
 const gap=screen-drawn;
 // Only a status-bar sized strip counts; bigger differences are split view or windowed apps.
 if(!(gap>0&&gap<=100))return safe;
 return Math.max(0,safe-gap);
}
// Measure iOS safe areas once in the top-level viewport, not in nested documents.
export function installViewport({document:doc=document,window:win=window,onChange=()=>{}}={}){
 const probe=doc.createElement('div');probe.setAttribute('aria-hidden','true');probe.style.cssText='position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px);';doc.body.append(probe);
 let latest={bottom:0,keyboard:false},metrics={};
 const measure=()=>{const css=win.getComputedStyle(probe),layout=win.innerHeight,visible=win.visualViewport?.height||layout,top=Math.max(0,Math.min(parseFloat(css.paddingTop)||0,80));
  const standalone=!!(win.navigator.standalone||win.matchMedia('(display-mode: standalone)').matches);
  const faceIdPhone=/iPhone/.test(win.navigator.userAgent||'')&&Math.max(win.screen.width,win.screen.height)>=812,homeIndicator=faceIdPhone?(win.innerWidth>win.innerHeight?21:34):0;
  const keyboard=layout-visible>150,bottom=bottomClearance({inset:parseFloat(css.paddingBottom)||0,top,layout,visible,width:win.innerWidth,screenWidth:win.screen.width,screenHeight:win.screen.height,standalone,keyboard,homeIndicator});
  const extent=viewportExtent({visible,layout,width:win.innerWidth,screenWidth:win.screen.width,screenHeight:win.screen.height,top,standalone,keyboard,scale:win.visualViewport?.scale||1});
  doc.documentElement.style.setProperty('--app-height',Math.round(extent)+'px');doc.documentElement.style.setProperty('--app-top',top+'px');doc.documentElement.style.setProperty('--app-offset',Math.round(win.visualViewport?.offsetTop||0)+'px');
  doc.documentElement.style.setProperty('--host-safe-bottom',bottom+'px');doc.documentElement.dataset.keyboard=keyboard?'open':'closed';doc.documentElement.dataset.standalone=standalone?'yes':'no';latest={bottom,keyboard,visible:Math.round(visible),offset:Math.round(win.visualViewport?.offsetTop||0)};metrics={screen:win.screen.width+'×'+win.screen.height,layout,visible:Math.round(visible),offset:Math.round(win.visualViewport?.offsetTop||0),insetTop:top,insetBottom:parseFloat(css.paddingBottom)||0,clearance:bottom,standalone,dpr:win.devicePixelRatio};onChange(latest);
 };
 win.addEventListener('resize',measure);win.addEventListener('orientationchange',measure);win.visualViewport?.addEventListener('resize',measure);win.visualViewport?.addEventListener('scroll',measure);measure();
 return {current:()=>latest,metrics:()=>({...metrics,nav:(()=>{const r=doc.getElementById('hostMobileNav')?.getBoundingClientRect();return r?Math.round(r.top)+'→'+Math.round(r.bottom):'—'})()})};
}
