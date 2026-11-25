/* Site Inspector — verify.js (v1.44.0)
 * (1) verify-after-write: compare what was sent with what the site really stored (SEO plugins can drop/overwrite fields).
 * (2) impact monitor: snapshot GSC metrics when a change is saved, re-check after 14/28 days, flag changes that hurt (rollback candidates).
 * Pure logic, no network. UMD. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SI = root.SI || {}, root.SI.Verify = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DAY = 86400000;
  const FIELDS = ['seo_title', 'meta_description', 'focus_keyword', 'excerpt', 'content', 'related_keywords'];
  const plain = (v) => String(v == null ? '' : v).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\u200f]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const pick = (o, k) => { if (!o) return ''; const alt = { seo_title: 'metaTitle', meta_description: 'metaDescription', focus_keyword: 'focusKeyword', related_keywords: 'relatedKeywords' }[k]; return o[k] != null ? o[k] : (alt && o[alt] != null ? o[alt] : ''); };

  /** sent = fields object written; saved = item re-read from the site. Returns { ok, missing:[field], changed:[field] }. */
  function compareSaved(sent, saved) {
    const missing = [], changed = [];
    Object.keys(sent || {}).filter((k) => FIELDS.includes(k)).forEach((k) => {
      const want = plain(sent[k]), got = plain(pick(saved, k));
      if (want === got) return;
      if (k === 'content' && got && want && Math.abs(got.length - want.length) / want.length < 0.02) return; // minor re-serialisation
      (got ? changed : missing).push(k);
    });
    return { ok: !missing.length && !changed.length, missing, changed };
  }

  const nu = (u) => { try { const x = new URL(u); return (x.host + decodeURIComponent(x.pathname)).replace(/\/+$/, '').toLowerCase(); } catch (e) { return String(u || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase(); } };
  /** Sums GSC rows whose key/keys contain this page URL. Returns null when the URL has no rows (not enough data). */
  function metricsFor(rows, url) {
    const u = nu(url); if (!u) return null; let c = 0, i = 0, pos = 0, n = 0;
    (rows || []).forEach((r) => { const keys = (r.keys && r.keys.length ? r.keys : [r.key || '']).map(nu); if (!keys.some((k) => k === u)) return; c += Number(r.clicks || 0); i += Number(r.impressions || 0); if (r.position) { pos += Number(r.position) * Number(r.impressions || 1); n += Number(r.impressions || 1); } });
    if (!i && !c) return null;
    return { clicks: c, impressions: i, ctr: i ? c / i : 0, position: n ? pos / n : 0 };
  }

  /** Journal entry for one saved change; `before` = old values of the changed fields, `metrics` = GSC snapshot (may be null). */
  function makeEntry(o) {
    const fields = Object.keys(o.fields || {}).filter((k) => FIELDS.includes(k));
    const before = {}; fields.forEach((k) => { before[k] = String(pick(o.item, k) || '').slice(0, 2000); });
    return { id: o.id, url: o.url || '', title: o.title || '', change_id: o.change_id || '', at: o.at || Date.now(), fields, before, metrics: metricsFor(o.gscRows, o.url), verified: o.verified == null ? null : !!o.verified, checks: [] };
  }

  /** Verdict for one entry given fresh GSC rows. Needs 14+ days and enough baseline impressions. */
  function evaluate(entry, rows, now) {
    const t = now || Date.now(), age = Math.floor((t - entry.at) / DAY);
    const seoText = (entry.fields || []).some((k) => ['seo_title', 'meta_description'].includes(k));
    if (age < 14) return { verdict: 'waiting', age, days_left: 14 - age };
    const b = entry.metrics, a = metricsFor(rows, entry.url);
    if (!b || b.impressions < 50) return { verdict: 'insufficient', age, why: 'داده‌ٔ پایهٔ GSC (کمتر از ۵۰ نمایش) برای قضاوت کافی نیست.' };
    if (!a) return { verdict: 'insufficient', age, why: 'برای این آدرس داده‌ٔ جدید GSC دریافت نشد.' };
    const dC = (a.clicks - b.clicks) / Math.max(1, b.clicks), dI = (a.impressions - b.impressions) / b.impressions, dCtr = b.ctr ? (a.ctr - b.ctr) / b.ctr : 0, dPos = a.position && b.position ? a.position - b.position : 0;
    const d = { clicks: Math.round(dC * 100), impressions: Math.round(dI * 100), ctr: Math.round(dCtr * 100), position: Math.round(dPos * 10) / 10 };
    let verdict = 'neutral';
    if (seoText && dCtr <= -0.2 && dC <= -0.2 && dI > -0.3) verdict = 'worse';        // same exposure, fewer clicks → the new snippet hurt
    else if (dPos >= 3 && dI <= -0.3) verdict = 'worse';                                // lost ranking
    else if ((dCtr >= 0.1 || dC >= 0.15) && dI > -0.3) verdict = 'better';
    return { verdict, age, delta: d, rollback: verdict === 'worse' && !!entry.change_id && age <= 60 };
  }

  /** Runs evaluate over a journal; stores last result on each entry; returns summary. */
  function evaluateAll(journal, rows, now) {
    const out = { better: 0, worse: 0, neutral: 0, waiting: 0, insufficient: 0, rollback: [] };
    (journal || []).forEach((e) => { const r = evaluate(e, rows, now); e.last = Object.assign({ at: now || Date.now() }, r); out[r.verdict]++; if (r.rollback) out.rollback.push(e); });
    return out;
  }
  function summarize(s) { return 'اثر تغییرات: بهتر ' + s.better + ' · بدتر ' + s.worse + ' · بدون تغییر ' + s.neutral + ' · در انتظار ' + s.waiting + ' · داده ناکافی ' + s.insufficient; }
  /** Approximate rendered width (px, ~20px Google title font): Google truncates titles by pixels (~580), not by characters. */
  function pixelWidth(text) {
    try { const P = (typeof module === 'object' && module.exports) ? require('./seopolicy.js') : (typeof self !== 'undefined' && self.SI && self.SI.SeoPolicy); if (P) return P.pixelWidth(text); } catch (e) {}
    let w = 0; Array.from(String(text || '')).forEach((ch) => {
      if (/\s/.test(ch)) w += 5; else if (/[\u200c\u200f]/.test(ch)) w += 0; else if (/[A-Z]/.test(ch)) w += 12.5; else if (/[a-z]/.test(ch)) w += 10; else if (/[0-9\u06f0-\u06f9\u0660-\u0669]/.test(ch)) w += 11;
      else if (/[\u0600-\u06ff]/.test(ch)) w += /[\u064b-\u0652]/.test(ch) ? 0 : 9.5; else if (/[|\-–—:،.,!؟?؛]/.test(ch)) w += 6; else w += 11;
    }); return Math.round(w);
  }
  /** Ranking guard: a page that already earns clicks/impressions or ranks in the top 10 must not get its title/meta replaced automatically. */
  function guard(url, rows, o) {
    const x = Object.assign({ clicks: 5, impressions: 100, topPos: 10, minImpTop: 30 }, o || {}); const m = metricsFor(rows, url);
    if (!m) return { locked: false, metrics: null, reason: '' };
    const why = [];
    if (m.clicks >= x.clicks) why.push(m.clicks + ' کلیک');
    if (m.impressions >= x.impressions) why.push(m.impressions + ' نمایش');
    if (m.position && m.position <= x.topPos && m.impressions >= x.minImpTop) why.push('میانگین جایگاه ' + (Math.round(m.position * 10) / 10));
    return { locked: why.length > 0, metrics: m, reason: why.length ? 'این صفحه در Search Console دارد (' + why.join('، ') + ')؛ تغییر خودکار عنوان/متا قفل است.' : '' };
  }
  return { pixelWidth, guard, compareSaved, metricsFor, makeEntry, evaluate, evaluateAll, summarize };
});
