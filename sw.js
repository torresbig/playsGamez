const CACHE_NAME = 'playsgamez-v2';
const ASSETS = [
  './',
  './index.html',
  './lang.js',
  './styles/style_main.css',
  './manifest.json',
  // Spiele (alle HTML/JS/CSS werden gecacht, sobald sie angefragt werden)
  './gamez/pingpong/index.html',
  './gamez/pingpong/game.js',
  './gamez/pingpong/style.css',
  './gamez/tetris/index.html',
  './gamez/tetris/game.js',
  './gamez/tetris/style.css',
  './gamez/race/index.html',
  './gamez/race/game.js',
  './gamez/race/style.css',
  './gamez/shooter/index.html',
  './gamez/shooter/game.js',
  './gamez/shooter/style.css',
  './gamez/snake/index.html',
  './gamez/snake/game.js',
  './gamez/snake/style.css',
  './gamez/breakout/index.html',
  './gamez/breakout/game.js',
  './gamez/breakout/style.css',
  './gamez/flappy/index.html',
  './gamez/flappy/game.js',
  './gamez/flappy/style.css',
  './gamez/spiderman/index.html',
  './gamez/spiderman/game.js',
  './gamez/spiderman/style.css',
  './gamez/stone/index.html',
  './gamez/stone/game.js',
  './gamez/stone/style.css',
  './gamez/reaction/index.html',
  './gamez/reaction/game.js',
  './gamez/reaction/style.css',
  './gamez/spaceblaster/index.html',
  './gamez/spaceblaster/game.js',
  './gamez/spaceblaster/style.css',
  './gamez/ninjarush/index.html',
  './gamez/ninjarush/game.js',
  './gamez/ninjarush/style.css',
  './gamez/basketball/index.html',
  './gamez/basketball/game.js',
  './gamez/basketball/style.css',
  './gamez/football/index.html',
  './gamez/football/game.js',
  './gamez/football/style.css',
  './gamez/boxing/index.html',
  './gamez/boxing/game.js',
  './gamez/boxing/style.css',
  './gamez/crashderby/index.html',
  './gamez/crashderby/game.js',
  './gamez/crashderby/style.css',
  './gamez/skaterush/index.html',
  './gamez/skaterush/game.js',
  './gamez/skaterush/style.css',
  './gamez/archery/index.html',
  './gamez/archery/game.js',
  './gamez/archery/style.css',
  './gamez/aircombat/index.html',
  './gamez/aircombat/game.js',
  './gamez/aircombat/style.css',
  './gamez/tennissmash/index.html',
  './gamez/tennissmash/game.js',
  './gamez/tennissmash/style.css'
];

// Install – Core-Assets cachen
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate – alte Caches löschen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch – Cache First, dann Netzwerk
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Nur gleiche Origin cachen
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request)
      .then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            // Nur GET-Anfragen mit gültiger Antwort cachen
            if (response.status === 200 && response.type === 'basic') {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          });
      })
  );
});
