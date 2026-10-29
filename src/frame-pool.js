// Which hidden apps can be unloaded to save memory. iOS freezes or discards hidden frames under pressure;
// releasing them ourselves keeps the open one responsive. Their data lives in storage, so reopening restores them.
export const IDLE_MS=10*60*1000;
// Activities that keep an app alive while it is in the background (the Pomodoro, the kitchen timer).
const KEEPS={organizador:['organizador'],'mi-espacio':['kitchen']};
export function framesToRelease({ids,current,lastUsed,activities,now=Date.now(),idle=IDLE_MS}){
 return ids.filter(id=>id!==current&&now-(lastUsed.get(id)??now)>=idle&&!(KEEPS[id]||[]).some(source=>activities.has(source)));
}
