// Spring curves for the Web Animations API.
// Timings and damping ratios are ported from expo-dynamic-notifications (MIT, src/conf/springs.ts
// and src/constants/notification.consts.ts) and expressed as CSS linear() easings.

// Position (0 → 1, may overshoot) of a spring that settles at t = 1.
export function springAt(t,dampingRatio){
 const z=Math.max(.05,Math.min(dampingRatio,1)),w=Math.log(1000)/z; // amplitude ≈ 0.1 % at t = 1
 if(z>=1)return 1-(1+w*t)*Math.exp(-w*t);
 const wd=w*Math.sqrt(1-z*z);
 return 1-Math.exp(-z*w*t)*(Math.cos(wd*t)+(z*w/wd)*Math.sin(wd*t));
}
export function springEasing(dampingRatio,samples=48){
 const points=[];for(let i=0;i<=samples;i++)points.push(+springAt(i/samples,dampingRatio).toFixed(4));
 points[samples]=1;return 'linear('+points.join(',')+')';
}
let linearSupport=null;
export function easing(dampingRatio,fallback='cubic-bezier(.2,.9,.25,1.1)'){
 if(linearSupport===null){try{linearSupport=!!globalThis.CSS?.supports?.('transition-timing-function','linear(0,1)')}catch{linearSupport=false}}
 return linearSupport?springEasing(dampingRatio):fallback;
}
export const SPRING={
 drop:{duration:900,ratio:.92},
 expand:{duration:800,ratio:.95},
 reveal:{duration:700,ratio:1},
 collapse:{duration:660,ratio:.92},
 fade:{duration:360,ratio:1},
 drag:{duration:560,ratio:.85},
 morph:{duration:480,ratio:1}, // expand/collapse: no overshoot, so it never looks bigger than where it lands
};
export const TIMING={enterExpand:340,enterReveal:560,exitCollapse:100,exitDrop:280,swipeDistance:-36,swipeVelocity:-420,expandDistance:24};
