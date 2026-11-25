/* Site Inspector PWA layer: makes the same app installable and usable on any phone (iPhone, Android, tablet, desktop).
 * Pure helpers (platformInfo, installHelp) are unit-tested; browser wiring is guarded so Capacitor/Android and Node are untouched.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null);
  else root.SI = root.SI || {}, root.SI.PWA = factory(root);
})(typeof self !== 'undefined' ? self : this, function (win) {
  'use strict';

  /** Classifies the runtime so the UI can show the right install instructions. */
  function platformInfo(ua, standalone, native) {
    const u = String(ua || '');
    const ios = /iPhone|iPad|iPod/i.test(u) || (/Macintosh/i.test(u) && /Mobile/i.test(u));
    const android = /Android/i.test(u);
    const iosSafari = ios && /Safari/i.test(u) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(u);
    return {
      kind: ios ? 'ios' : android ? 'android' : 'desktop',
      native: !!native,
      installed: !!standalone || !!native,
      iosSafari,
      iosOtherBrowser: ios && !iosSafari
    };
  }

  /** Persian install instructions for the current platform; null when nothing to show. */
  function installHelp(info, canPrompt) {
    if (!info || info.installed) return null;
    if (canPrompt) return { mode: 'prompt', text: 'با یک لمس روی صفحهٔ اصلی گوشی نصب می‌شود و مثل یک اپ، تمام‌صفحه باز می‌شود.' };
    if (info.kind === 'ios') {
      if (info.iosOtherBrowser) return { mode: 'manual', text: 'روی iPhone نصب فقط از Safari ممکن است: این صفحه را در Safari باز کن، دکمهٔ «اشتراک‌گذاری» را بزن و «Add to Home Screen» را انتخاب کن.' };
      return { mode: 'manual', text: 'دکمهٔ «اشتراک‌گذاری» (مربع با فلش رو به بالا) را در Safari بزن، سپس «Add to Home Screen» (افزودن به صفحهٔ اصلی) را انتخاب کن.' };
    }
    if (info.kind === 'android') return { mode: 'manual', text: 'از منوی مرورگر (⋮) گزینهٔ «Install app» یا «Add to Home screen» را بزن.' };
    return { mode: 'manual', text: 'از نوار آدرس مرورگر گزینهٔ نصب (Install) را بزن.' };
  }

  if (!win || !win.document) return { platformInfo, installHelp };

  const nav = win.navigator || {};
  const native = !!(win.Capacitor && win.Capacitor.isNativePlatform && win.Capacitor.isNativePlatform());
  const standalone = !!((win.matchMedia && win.matchMedia('(display-mode: standalone)').matches) || nav.standalone);
  let info = platformInfo(nav.userAgent, standalone, native);
  let deferred = null; const listeners = [];
  const notify = () => listeners.forEach((fn) => { try { fn(); } catch (e) {} });

  win.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; notify(); });
  win.addEventListener('appinstalled', () => { deferred = null; info = Object.assign({}, info, { installed: true }); notify(); });

  async function promptInstall() {
    if (!deferred) return 'unavailable';
    const ev = deferred; deferred = null;
    try { await ev.prompt(); const choice = await ev.userChoice; notify(); return choice && choice.outcome === 'accepted' ? 'accepted' : 'dismissed'; }
    catch (e) { notify(); return 'unavailable'; }
  }

  function register() {
    if (native || !('serviceWorker' in nav) || !/^https?:$/.test(win.location.protocol)) return Promise.resolve(false);
    return nav.serviceWorker.register('sw.js', { scope: './' }).then(() => true).catch(() => false);
  }

  /** Asks the browser not to evict this app's local data (bridge connection, rebuild journal). Best effort. */
  function persistStorage() {
    try { if (nav.storage && nav.storage.persist) return nav.storage.persist().catch(() => false); } catch (e) {}
    return Promise.resolve(false);
  }

  /** Keeps the screen on while a long rebuild runs so mobile browsers do not suspend the page. Best effort. */
  let lock = null;
  async function keepAwake() {
    try { if (nav.wakeLock && nav.wakeLock.request) lock = await nav.wakeLock.request('screen'); } catch (e) { lock = null; }
    return !!lock;
  }
  function release() { try { if (lock) lock.release(); } catch (e) {} lock = null; }
  win.document.addEventListener('visibilitychange', () => { /* Wake Lock is auto-released when hidden; callers re-acquire per run. */ lock = lock && !lock.released ? lock : null; });

  register().then(() => persistStorage());

  return {
    platformInfo, installHelp, register, promptInstall, keepAwake, release,
    info: () => info,
    canPrompt: () => !!deferred,
    help: () => installHelp(info, !!deferred),
    onChange: (fn) => { listeners.push(fn); }
  };
});
