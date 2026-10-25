// Receives background notifications even while the PWA is closed.
self.addEventListener('push',event=>{
 event.waitUntil((async()=>{
  let data={};try{data=event.data?.json()||{}}catch{}
  const url=typeof data.url==='string'&&/^\/#\/(centro|iris|mi-espacio|journal|organizador)\/[\w-]+$/.test(data.url)?data.url:'/#/centro/home';
  await self.registration.showNotification(String(data.title||'Nubo').slice(0,120),{body:String(data.body||'Tenés un recordatorio.').slice(0,240),icon:'/nubo-192.png',badge:'/nubo-192.png',tag:String(data.tag||'ecosystem').slice(0,180),data:{url}});
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();event.waitUntil((async()=>{
  const target=new URL(event.notification.data?.url||'/#/centro/home',self.location.origin);
  if(target.origin!==self.location.origin)return;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){if(new URL(client.url).origin===target.origin){await client.navigate(target.href);await client.focus();return}}
  await self.clients.openWindow(target.href);
 })());
});
