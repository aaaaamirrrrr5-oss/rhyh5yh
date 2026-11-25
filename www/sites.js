/* Site Inspector — sites.js (v1.129.0)
 * مدیریت چند سایت در یک اپ: هر سایت فضای ذخیره‌سازی جدا دارد.
 * سایت «default» همان کلیدهای قدیمی (si_<key>) را دارد، پس دادهٔ موجود دست نمی‌خورد؛
 * سایت‌های دیگر با پیشوند si_s_<id>_ جدا می‌شوند. کلیدهای عمومی (مدل، تب، سبک چت…) بین همه مشترک‌اند. UMD، بدون وابستگی. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SI = root.SI || {}, root.SI.Sites = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const GLOBAL = new Set(['ai', 'onDeviceStatus', 'modelMirror', 'tab', 'chatStyle', 'secOpen', 'sites', 'activeSite', 'days']);
  const DEFAULT_ID = 'default', DEFAULT_NAME = 'سایت اصلی', MAX = 12, PFX = 'si_';
  const clean = (n) => String(n == null ? '' : n).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);

  function create(ls) {
    const read = (k, d) => { try { const v = ls.getItem(PFX + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
    const write = (k, v) => { try { ls.setItem(PFX + k, JSON.stringify(v)); } catch (e) {} };
    const listRaw = () => { const l = read('sites', null); return Array.isArray(l) ? l.filter((x) => x && typeof x.id === 'string' && /^[a-z0-9]{3,12}$/.test(x.id)) : []; };
    const list = () => [{ id: DEFAULT_ID, name: (read('defaultSiteName', '') || DEFAULT_NAME) }].concat(listRaw());
    const active = () => { const a = read('activeSite', DEFAULT_ID); return list().some((x) => x.id === a) ? a : DEFAULT_ID; };
    const realKey = (id, k) => (GLOBAL.has(k) || id === DEFAULT_ID ? PFX + k : PFX + 's_' + id + '_' + k);
    const prefixOf = (id) => PFX + 's_' + id + '_';
    function newId() { const used = new Set(list().map((x) => x.id)); for (let i = 0; i < 50; i++) { const id = 'x' + Math.random().toString(36).slice(2, 8); if (!used.has(id)) return id; } return 'x' + Date.now().toString(36); }
    function add(name) {
      const n = clean(name); if (!n) return { ok: false, why: 'نام سایت خالی است.' };
      if (listRaw().length + 1 >= MAX) return { ok: false, why: 'حداکثر ' + MAX + ' سایت.' };
      if (list().some((x) => x.name === n)) return { ok: false, why: 'سایتی با این نام هست.' };
      const id = newId(); write('sites', listRaw().concat([{ id, name: n }])); return { ok: true, id };
    }
    function rename(id, name) {
      const n = clean(name); if (!n) return { ok: false, why: 'نام خالی است.' };
      if (list().some((x) => x.name === n && x.id !== id)) return { ok: false, why: 'سایتی با این نام هست.' };
      if (id === DEFAULT_ID) { write('defaultSiteName', n); return { ok: true }; }
      const l = listRaw(); const it = l.find((x) => x.id === id); if (!it) return { ok: false, why: 'سایت پیدا نشد.' };
      it.name = n; write('sites', l); return { ok: true };
    }
    function purge(id) { if (id === DEFAULT_ID) return 0; const p = prefixOf(id); let c = 0; try { Object.keys(ls).filter((k) => k.indexOf(p) === 0).forEach((k) => { ls.removeItem(k); c++; }); } catch (e) {} return c; }
    function remove(id) {
      if (id === DEFAULT_ID) return { ok: false, why: 'سایت اصلی حذف نمی‌شود (برای پاک‌سازی از «پاک‌کردن همهٔ داده‌ها» استفاده کن).' };
      if (!listRaw().some((x) => x.id === id)) return { ok: false, why: 'سایت پیدا نشد.' };
      const wasActive = active() === id; const n = purge(id); write('sites', listRaw().filter((x) => x.id !== id)); if (wasActive) write('activeSite', DEFAULT_ID); return { ok: true, removed: n, wasActive };
    }
    function select(id) { if (!list().some((x) => x.id === id)) return { ok: false, why: 'سایت پیدا نشد.' }; write('activeSite', id); return { ok: true }; }
    function nameOf(id) { const x = list().find((y) => y.id === id); return x ? x.name : DEFAULT_NAME; }
    const id0 = active();
    /** store سازگار با app.js که کلیدها را برای سایت فعالِ لحظهٔ بارگذاری جدا می‌کند. */
    const store = {
      get(k, d) { try { const v = ls.getItem(realKey(id0, k)); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
      set(k, v) { try { ls.setItem(realKey(id0, k), JSON.stringify(v)); } catch (e) {} },
    };
    return { list, active, add, rename, remove, select, nameOf, store, realKey, purge, isGlobal: (k) => GLOBAL.has(k), DEFAULT_ID };
  }
  return { create, clean, GLOBAL: Array.from(GLOBAL), DEFAULT_ID, MAX };
});
