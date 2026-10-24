'use strict';
// TrickLog RC2 - compatible app-shell updates + offline emergency export.
// Keep old app caches during candidate evaluation; release cleanup is deliberate.
const production=self.location.hostname==='kensuke44.github.io'&&/^\/tricklog\//.test(self.location.pathname);
const CACHE=production?'tricklog-v1.3.0-rc2':'tricklog-phase7-rc-preview-v2';
const FILES=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest',
 './emergency-backup.html','./icons/icon-192-v111.png','./icons/icon-512-v111.png',
 './icons/icon-180-v111.png'];
const APP='./index.html';
const RESCUE='./emergency-backup.html';
self.addEventListener('install',event=>{
 // Complete the new cache while the previous SW controls existing pages.
 // No skipWaiting: activate only after old clients close, avoiding mixed-version tabs.
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))); // No skipWaiting: avoid old-tab/new-worker takeover.
});
self.addEventListener('activate',event=>{
 // Do not delete any prior TrickLog cache while release remains unapproved.
 event.waitUntil(self.clients.claim());
});
self.addEventListener('message',event=>{
 if(event.data?.type==='TRICKLOG_SW_VERSION'){
  event.source?.postMessage({type:'TRICKLOG_SW_VERSION',cache:CACHE});
 }
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin)return;
 const scope=new URL(self.registration.scope);
 if(!url.pathname.startsWith(scope.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const relative=url.pathname.slice(scope.pathname.length).replace(/^\/+/, '');
  if(req.mode==='navigate'){
   // Explicit rescue route works offline; never silently serve the normal app here.
   if(relative==='emergency-backup.html')
    return (await cache.match(RESCUE))||Response.error();
   // Only actual app routes fall back to shell; path spelling/query do not affect cache.
   if(relative===''||relative==='index.html')
    return (await cache.match(APP))||(await cache.match('./'))||Response.error();
   try{return await fetch(req);}catch{return Response.error();}
  }
  // Version-coherent cached shell. Network fetch for non-precache files (no caching).
  const cached=await cache.match(req,{ignoreSearch:true});
  if(cached)return cached;
  try{return await fetch(req);}catch{return Response.error();}
 })());
});
