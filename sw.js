// Service worker do app Mutirão de Natal 2026.
// Estratégia "rede primeiro": sempre busca a versão mais nova e só usa o cache
// quando não há conexão. Pedidos a outros domínios (Firebase, fontes) passam direto.
const CACHE = 'mutirao-v1';
const ARQUIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './logo-mutirao-crop.png',
  './pix-icon.png',
  './whatsapp-icon.png',
  './7me-logo.png',
  './icon-192.png'
];

// Tocar na notificação abre (ou traz para frente) o app.
// Precisa ser registrado antes do Firebase, que interrompe os ouvintes seguintes.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL('./', self.location.href).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(janelas => {
      const aberta = janelas.find(j => j.url.startsWith(url));
      return aberta ? aberta.focus() : self.clients.openWindow(url);
    })
  );
});

// Avisos (Firebase Cloud Messaging): com o app fechado, o SDK mostra a notificação sozinho.
importScripts(
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js'
);
firebase.initializeApp({
  apiKey: 'AIzaSyBjIU_1ma0PP1B9yUskaP2FOr9pairwUv0',
  authDomain: 'acompanhamento-mutirao2026.firebaseapp.com',
  projectId: 'acompanhamento-mutirao2026',
  storageBucket: 'acompanhamento-mutirao2026.firebasestorage.app',
  messagingSenderId: '922912359615',
  appId: '1:922912359615:web:827762540abba6c52f720a'
});
firebase.messaging();

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(req, copia));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('./') : Response.error()))
      )
  );
});
