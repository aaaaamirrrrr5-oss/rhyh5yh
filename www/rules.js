/* Site Inspector — store rules (SI.Rules). Pure. The owner's own rules applied to every auto-fix before anything is written:
 * banned phrases (never in title/meta/excerpt/body), title prefix policy, brand suffix on/off. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else (root.SI = root.SI || {}).Rules = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DEFAULTS = { banned: [], buyPrefix: 'auto', brandSuffix: 'auto' }; // buyPrefix: auto | never | always ; brandSuffix: auto | never
  function normalize(raw) {
    const r = Object.assign({}, DEFAULTS, raw || {});
    r.banned = (Array.isArray(r.banned) ? r.banned : String(r.banned || '').split(/[,،\n]+/)).map((x) => String(x).trim()).filter((x) => x.length >= 2).slice(0, 40);
    if (!['auto', 'never', 'always'].includes(r.buyPrefix)) r.buyPrefix = 'auto'; if (!['auto', 'never'].includes(r.brandSuffix)) r.brandSuffix = 'auto';
    return r;
  }
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const norm = (s) => String(s || '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  const hit = (txt, banned) => banned.find((b) => norm(txt).includes(norm(b)));
  function stripBannedHtml(html, banned) {
    let removed = 0;
    const out = String(html).replace(/<(p|li)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (m, tag, attrs, inner) => {
      if (!hit(inner.replace(/<[^>]+>/g, ' '), banned)) return m;
      const parts = inner.split(/(?<=[.!؟?…])\s+/); const keep = parts.filter((s) => !hit(s.replace(/<[^>]+>/g, ' '), banned)); removed += parts.length - keep.length;
      const t = keep.join(' ').trim(); return t.replace(/<[^>]+>/g, '').trim() ? '<' + tag + attrs + '>' + t + '</' + tag + '>' : '';
    });
    return { html: out.replace(/<ul>\s*<\/ul>|<ol>\s*<\/ol>/gi, ''), removed };
  }
  /** fields = what would be written. Returns { fields, notes[] }; never adds anything the engine did not already produce. */
  function apply(fields, rawRules, ctx) {
    const R = normalize(rawRules); const f = Object.assign({}, fields); const notes = []; const c = ctx || {};
    if (f.seo_title != null) {
      let t = String(f.seo_title);
      if (R.buyPrefix === 'never' && /^خرید\s+/.test(t)) { t = t.replace(/^خرید\s+/, ''); notes.push('پیشوند «خرید» طبق قاعدهٔ فروشگاه حذف شد.'); }
      if (R.buyPrefix === 'always' && !/^خرید\s+/.test(t) && (c.kind || 'product') === 'product' && Array.from('خرید ' + t).length <= 60) { t = 'خرید ' + t; notes.push('پیشوند «خرید» طبق قاعدهٔ فروشگاه اضافه شد.'); }
      if (R.brandSuffix === 'never' && c.brand) { const re = new RegExp('\\s*[|–-]\\s*' + esc(c.brand) + '\\s*$'); if (re.test(t)) { t = t.replace(re, ''); notes.push('برند از انتهای عنوان حذف شد.'); } }
      f.seo_title = t.trim();
    }
    ['seo_title', 'meta_description', 'focus_keyword', 'excerpt'].forEach((k) => { if (f[k] != null && R.banned.length) { const b = hit(f[k], R.banned); if (b) { delete f[k]; notes.push('«' + b + '» ممنوع است؛ ' + k + ' نوشته نشد.'); } } });
    if (f.content != null && R.banned.length) { const s = stripBannedHtml(f.content, R.banned); if (s.removed) { f.content = s.html; notes.push(s.removed + ' جمله با عبارت ممنوع از متن حذف شد.'); } }
    return { fields: f, notes };
  }
  /** Real search query for a page (Search Console): most-shown query that is about the item's title (shares a title word, 2–6 words, >=10 impressions). */
  function gscFocus(agg, title) {
    const tw = norm(title).split(' ').filter((w) => w.length > 2); if (!agg || !Array.isArray(agg.queryStats)) return null;
    const ok = agg.queryStats.filter((x) => { const w = norm(x.q).split(' ').filter(Boolean); return w.length >= 2 && w.length <= 6 && x.impressions >= 10 && w.some((y) => tw.includes(y)); }).sort((a, b) => b.impressions - a.impressions);
    return ok.length ? ok[0].q.trim() : null;
  }
  return { DEFAULTS, normalize, apply, hit, stripBannedHtml, gscFocus };
});
