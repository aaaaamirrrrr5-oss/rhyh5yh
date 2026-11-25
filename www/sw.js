/* Site Inspector service worker: offline app shell only.
 * Never intercepts cross-origin traffic (WordPress Bridge, scanned sites), so keys and site data are never cached here.
 * VERSION must match package.json (checked by tests/pwa.test.cjs); bump it on every release to refresh clients.
 */
'use strict';
const VERSION = '1.132.0';
const CACHE = 'si-shell-' + VERSION;
const SHELL = [
  './', 'index.html', 'app.css', 'manifest.webmanifest',
  'engine.js', 'brain.js', 'research.js', 'agent.js', 'writer.js', 'orchestrator.js', 'integrations.js', 'ondevice.js', 'llm.js',
  'knowledge.js', 'sites.js', 'quality.js', 'growth.js', 'seopolicy.js', 'seocenter.js', 'keyfinder.js', 'seospecialist.js', 'seoqueue.js', 'polish.js', 'diffview.js', 'rules.js', 'seorules-data.js', 'seorules.js', 'score100.js', 'changelog.js', 'rebuild.js', 'fromname.js', 'seobuilder.js', 'seoplan.js', 'chatskills.js', 'studiodata.js', 'productstudio.js', 'termstudio.js', 'repair.js', 'verify.js', 'seoextra.js', 'sitecheck.js', 'smart.js', 'insight.js', 'pro.js', 'refresh.js', 'scheduler.js', 'fatext.js', 'copyexpert.js', 'articlegate.js', 'seoplus.js', 'techaudit.js', 'contentaudit.js', 'linkgraph.js', 'keymap.js', 'onpage.js', 'contentplan.js', 'campaign.js', 'security.js', 'chatui.js', 'pwa.js', 'app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.indexOf('si-shell-') === 0 && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Bridge / external sites go straight to the network.
  if (req.mode === 'navigate') {
    // Network first so a new deploy is picked up; fall back to the cached shell when offline.
    event.respondWith(fetch(req).catch(() => caches.match('index.html').then((r) => r || caches.match('./'))));
    return;
  }
  event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
