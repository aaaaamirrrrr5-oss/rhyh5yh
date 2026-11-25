/* Transport and credential safety checks for the independent Site Inspector bridge. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SI = root.SI || {}, root.SI.Security = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function privateIPv4(host) {
    const parts = String(host || '').split('.');
    if (parts.length !== 4 || parts.some((x) => !/^\d{1,3}$/.test(x) || Number(x) > 255)) return false;
    const a = Number(parts[0]), b = Number(parts[1]);
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  function privateOrLoopbackHost(hostname) {
    const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
    if (host === 'localhost' || host.endsWith('.localhost') || privateIPv4(host)) return true;
    if (host === '::1' || (host.indexOf(':') >= 0 && /^f[cd][0-9a-f:]*$/i.test(host))) return true; // IPv6 loopback / unique-local
    return false;
  }
  function assertBridgeTransport(value) {
    let url;
    try { url = new URL(String(value || '').trim()); } catch (_) { throw new Error('آدرس اتصال Site Inspector معتبر نیست.'); }
    if (url.username || url.password) throw new Error('آدرس اتصال نباید نام کاربری یا رمز داخل URL داشته باشد.');
    if (url.protocol === 'https:') return url.origin;
    if (url.protocol === 'http:' && privateOrLoopbackHost(url.hostname)) return url.origin;
    if (url.protocol === 'http:') throw new Error('برای ارسال امن کلید Site Inspector، سایت عمومی باید HTTPS داشته باشد؛ HTTP فقط برای localhost یا IP خصوصی شبکهٔ محلی مجاز است.');
    throw new Error('پروتکل اتصال Site Inspector باید HTTPS باشد.');
  }
  // Signed requests: the key itself never leaves the device. Secret = SHA-256(key) (hex), which the plugin already stores as its key hash.
  function webCrypto() {
    const c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (!c || !c.subtle || !c.getRandomValues) throw new Error('رمزنگاری امن در این مرورگر در دسترس نیست؛ اپ را در HTTPS یا نسخهٔ اندروید باز کن.');
    return c;
  }
  function toHex(buf) { return Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, '0')).join(''); }
  async function sha256Hex(text) { return toHex(await webCrypto().subtle.digest('SHA-256', new TextEncoder().encode(String(text)))); }
  async function hmacHex(secret, message) {
    const c = webCrypto();
    const k = await c.subtle.importKey('raw', new TextEncoder().encode(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return toHex(await c.subtle.sign('HMAC', k, new TextEncoder().encode(String(message))));
  }
  /** Headers for one request. Every attempt (retry, fallback URL) needs a fresh call: the plugin accepts each nonce once. */
  async function signHeaders(key, method, route, body, nowMs, nonce) {
    const secret = await sha256Hex(String(key || ''));
    const ts = String(Math.floor((nowMs || Date.now()) / 1000));
    const n = nonce || toHex(webCrypto().getRandomValues(new Uint8Array(16)));
    const msg = [String(method || 'GET').toUpperCase(), String(route || ''), ts, n, await sha256Hex(body || '')].join('\n');
    return { 'X-SI-Time': ts, 'X-SI-Nonce': n, 'X-SI-Sig': await hmacHex(secret, msg) };
  }
  return { assertBridgeTransport, privateOrLoopbackHost, signHeaders, sha256Hex, hmacHex };
});
