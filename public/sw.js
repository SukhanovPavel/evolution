/* Static public fallback only: never cache HTML containing sessions, API, or private data. */
const CACHE='evolution-public-v1';const PUBLIC=['/offline.html','/icon.svg','/icon-192.png','/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PUBLIC)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/'))return;if(PUBLIC.includes(url.pathname)){event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));return;}if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));}});
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() ?? {}; } catch {}
  const url = ['/today','/nutrition','/movement'].includes(payload.url) ? payload.url : '/today';
  event.waitUntil(self.registration.showNotification(typeof payload.title === 'string' ? payload.title.slice(0,120) : 'Evolution', {
    body: typeof payload.body === 'string' ? payload.body.slice(0,400) : '',
    icon: '/icon-192.png', badge: '/icon-192.png',
    tag: typeof payload.tag === 'string' ? payload.tag.slice(0,120) : 'evolution',
    data: { url },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const path = ['/today','/nutrition','/movement'].includes(event.notification.data?.url) ? event.notification.data.url : '/today';
  const url = new URL(path,self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type:'window',includeUncontrolled:true }).then(async windows => {
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
        await client.navigate(url); return client.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
