// Service Worker do Portal da Consciência Universal
// Função: permitir instalação como app (PWA) e dar suporte offline básico.
// Não armazena em cache: chamadas de API (/api/*) nem áudios (para não pesar o celular).

const CACHE_VERSION = 'portal-v1';
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/favicon.svg'
];

// Instala e guarda o "esqueleto" do app em cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Remove caches antigos de versões anteriores
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function isApiCall(url) {
  return url.pathname.startsWith('/api/');
}

function isHeavyMedia(url) {
  return /\.(mp3|wav|mp4)$/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Só cuida de pedidos do próprio site (mesma origem) e do tipo GET
  if (url.origin !== self.location.origin || event.request.method !== 'GET') {
    return;
  }

  // Nunca armazena em cache chamadas de API (login, pagamentos, dados do usuário)
  // nem arquivos de áudio (evita lotar o armazenamento do celular)
  if (isApiCall(url) || isHeavyMedia(url)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match('/'))
      )
  );
});
