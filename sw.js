const CACHE_NAME = 'cmv-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isShareTarget = event.request.method === 'POST' &&
    (url.pathname === '/dashboard-cmv/' || url.pathname === '/dashboard-cmv');

  if (isShareTarget) {
    event.respondWith(handleShare(event.request));
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

async function handleShare(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('pdf');

    if (file && file.type === 'application/pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // Convert to base64 in chunks to avoid stack overflow
      let binary = '';
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);

      // Send to all open app windows
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: 'SHARED_PDF', base64, name: file.name });
      }

      // If no window open, store for when app opens
      await storeSharedPDF(base64, file.name);
    }
  } catch (e) {
    console.error('Erro ao processar PDF compartilhado:', e);
  }

  return Response.redirect('/dashboard-cmv/', 303);
}

async function storeSharedPDF(base64, name) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = new Response(JSON.stringify({ base64, name, ts: Date.now() }), {
      headers: { 'Content-Type': 'application/json' }
    });
    await cache.put('/_shared_pdf', response);
  } catch (e) {}
}
