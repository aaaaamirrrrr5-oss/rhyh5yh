/* Site Inspector Pro tools (v1.21.0) — deterministic, model-free, works on any phone.
 *  1. redirectPlan     : best-match 301 targets for dead URLs/broken links + ready Apache/Nginx rules
 *  2. ctrBoost         : title variants for queries whose CTR is below expectation (Search Console), matched to the right page
 *  3. topicClusters    : groups pages into topics, picks the pillar, finds supporters that do not link to it and thin topics
 *  4. breadcrumbSchema : BreadcrumbList JSON-LD from real URL paths and real page titles
 *  5. decay            : pages whose clicks fell vs. a saved Search Console baseline, with the likely cause and fix
 * Suggestions only: nothing is applied to a site here and no ranking is promised.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./insight.js'), require('./smart.js'));
  else root.SI = root.SI || {}, root.SI.Pro = factory(root.SI.Insight, root.SI.Smart);
})(typeof self !== 'undefined' ? self : this, function (Insight, Smart) {
  'use strict';
  const pathOf = Insight.pathOf; const tokens = Insight.tokens;
  const okPage = (p) => p && p.status > 0 && p.status < 400 && !(p.facts && p.facts.noindex);
  const slugTokens = (path) => tokens(path.replace(/[-_/.]+/g, ' '));
  const headTitle = (t) => String(t || '').split(/\s[|\-–—·»]\s/)[0].trim();
  const brandOf = (t) => { const m = String(t || '').match(/\s([|\-–—·»])\s(.+)$/); return m ? ' ' + m[1] + ' ' + m[2].trim() : ''; };
  const safePath = (p) => /^\/[^\s"'<>\\^`{|}]*$/.test(p) ? p : (() => { try { return encodeURI(p); } catch (e) { return ''; } })();

  /* ---------- 1. 301 redirect plan ---------- */
  function redirectPlan(report, structure) {
    const pages = (report && report.pages) || []; const live = pages.filter(okPage);
    const dead = new Map();
    pages.filter((p) => p.status >= 400).forEach((p) => dead.set(pathOf(p.url), p.url));
    ((structure && structure.broken) || []).forEach((b) => dead.set(pathOf(b.to), b.to));
    const rules = [];
    dead.forEach((url, from) => {
      if (from === '/') return; const st = slugTokens(from); let best = null;
      live.forEach((p) => {
        const lp = pathOf(p.url); if (lp === from) return;
        const pt = new Set(tokens(headTitle((p.facts || {}).title) + ' ' + ((p.facts || {}).h1Text || '') + ' ' + lp.replace(/[-_/.]+/g, ' ')));
        const hit = st.filter((w) => pt.has(w)).length; if (!hit) return;
        const sc = hit / Math.max(st.length, 1) + Math.min(0.2, hit * 0.05); if (!best || sc > best.sc) best = { sc, to: lp };
      });
      let to = best && best.sc >= 0.34 ? best.to : null; let confidence = best ? (best.sc >= 0.66 ? 'high' : 'medium') : 'low';
      if (!to) { const parts = from.split('/').filter(Boolean); while (parts.length > 1 && !to) { parts.pop(); const par = '/' + parts.join('/'); if (live.some((p) => pathOf(p.url) === par)) { to = par; confidence = 'low'; } } }
      if (!to) { to = '/'; confidence = 'low'; }
      const f = safePath(from); const t = safePath(to); if (f && t && f !== t) rules.push({ from, to, confidence, status: (pages.find((p) => pathOf(p.url) === from) || {}).status || 404 });
    });
    const w = { high: 0, medium: 1, low: 2 }; rules.sort((a, b) => w[a.confidence] - w[b.confidence]);
    const apache = rules.map((r) => '# ' + r.confidence + '\nRedirect 301 ' + safePath(r.from) + ' ' + safePath(r.to)).join('\n');
    const nginx = rules.map((r) => 'rewrite ^' + safePath(r.from).replace(/[.+?()|[\]{}^$*\\]/g, '\\$&') + '/?$ ' + safePath(r.to) + ' permanent;').join('\n');
    return { ready: rules.length > 0, rules, apache, nginx, note: 'قوانین «کم‌اطمینان» را پیش از اعمال دستی ببینید؛ ریدایرکت به صفحهٔ بی‌ربط (soft-404) برای سئو بد است. اگر صفحهٔ جایگزین مناسبی نیست، کد 410 بهتر از ریدایرکت به خانه است.' };
  }

  /* ---------- 2. CTR boost ---------- */
  function jalaliYear() { try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' }).format(new Date()); } catch (e) { return ''; } }
  function titleVariants(query, currentTitle, opts) {
    const o = opts || {}; const year = o.year === undefined ? jalaliYear() : o.year; const q = String(query || '').trim(); if (!q) return [];
    const brand = brandOf(currentTitle); const it = Insight.intentOf(q).intent; const out = [];
    const push = (label, t) => { t = t.replace(/\s+/g, ' ').trim(); const full = [...(t + brand)].length <= 62 ? t + brand : t; if ([...full].length <= 70 && !out.some((x) => x.title === full)) out.push({ label, title: full }); };
    if (it === 'خرید') { push('مزیت + اقدام', q + ' | قیمت و خرید آنلاین'); push('سال', q + (year ? ' ' + year : '') + ' | راهنمای انتخاب و خرید'); push('پرسشی', 'کدام ' + q + ' بخریم؟'); }
    else if (it === 'آموزشی') { push('راهنمای کامل', q + ' | راهنمای کامل و گام‌به‌گام'); push('سال', q + (year ? ' (' + year + ')' : '') + ' | آموزش کاربردی'); push('پرسشی', q + ' چگونه است؟ پاسخ کوتاه و کامل'); }
    else if (it === 'مقایسه') { push('جدول مقایسه', q + ' | مقایسهٔ کامل با جدول'); push('سال', q + (year ? ' ' + year : '') + ' | کدام بهتر است؟'); push('تصمیم‌گیری', q + ': نکات انتخاب'); }
    else { push('راهنمای کامل', q + ' | راهنمای کامل'); push('سال', q + (year ? ' ' + year : '') + ' | به‌روز و کاربردی'); push('پرسشی', q + ' چیست و چه کاربردی دارد؟'); }
    return out.slice(0, 3);
  }
  function ctrBoost(gscRows, report, opts) {
    const o = opts || {}; const res = { ready: false, items: [], note: 'عنوان‌ها را دستی و یکی‌یکی آزمایش کنید و فقط چیزی را بنویسید که واقعاً در صفحه هست (عدد، سال یا مزیت ساختگی ننویسید).' };
    if (!Smart || !Array.isArray(gscRows)) return res;
    const opp = Smart.searchOpportunities(gscRows, { limit: 20 }); const pages = ((report && report.pages) || []).filter(okPage);
    const seen = new Set();
    opp.ctrGap.concat(opp.striking.filter((s) => s.position <= 10)).forEach((x) => {
      if (seen.has(x.query) || res.items.length >= (o.limit || 6)) return; seen.add(x.query);
      const qt = tokens(x.query); let best = null;
      pages.forEach((p) => { const pt = new Set(tokens(((p.facts || {}).title || '') + ' ' + ((p.facts || {}).h1Text || ''))); const hit = qt.filter((w) => pt.has(w)).length; if (hit && (!best || hit > best.hit)) best = { hit, p }; });
      const cur = best ? (best.p.facts || {}).title || '' : '';
      res.items.push({ query: x.query, position: x.position, ctr: x.ctr, expectedCtr: x.expectedCtr, extraClicks: x.estimatedExtraClicks, page: best ? best.p.url : '', currentTitle: cur, variants: titleVariants(x.query, cur, o) });
    });
    res.ready = res.items.length > 0; return res;
  }

  /* ---------- 3. topic clusters ---------- */
  function topicClusters(report, structure) {
    const pages = ((report && report.pages) || []).filter((p) => okPage(p) && p.facts && Array.isArray(p.facts.terms) && p.facts.terms.length);
    const res = { ready: pages.length >= 3, clusters: [], thin: [], note: pages.length >= 3 ? '' : 'برای نقشهٔ موضوعی حداقل ۳ صفحهٔ دارای متن لازم است.' };
    if (!res.ready) return res;
    const df = {}; pages.forEach((p) => new Set(p.facts.terms).forEach((t) => { df[t] = (df[t] || 0) + 1; }));
    const seed = (t) => df[t] >= 2 && df[t] <= Math.max(2, Math.floor(pages.length * 0.6));
    const P = pages.map((p) => ({ p, s: new Set(p.facts.terms.filter(seed)) }));
    const parent = P.map((_, i) => i); const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { let c = 0; P[i].s.forEach((t) => { if (P[j].s.has(t)) c++; }); if (c >= 3) parent[find(i)] = find(j); }
    const groups = {}; P.forEach((x, i) => { (groups[find(i)] = groups[find(i)] || []).push(x); });
    const inl = {}; (structure && structure.ready ? pages : []).forEach((p) => { inl[pathOf(p.url)] = 0; });
    pages.forEach((p) => (p.facts.links || []).forEach((t) => { if (t in inl && t !== pathOf(p.url)) inl[t]++; }));
    Object.values(groups).forEach((g) => {
      if (g.length < 2) { const x = g[0]; if ((x.p.facts.words || 0) >= 150 && pathOf(x.p.url) !== '/') res.thin.push({ url: x.p.url, title: headTitle(x.p.facts.title), topic: Array.from(x.s).slice(0, 3).join(' ') }); return; }
      const cnt = {}; g.forEach((x) => x.s.forEach((t) => { cnt[t] = (cnt[t] || 0) + 1; }));
      const label = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t]) => t).join(' ');
      const pillar = g.slice().sort((a, b) => (inl[pathOf(b.p.url)] || 0) - (inl[pathOf(a.p.url)] || 0) || (b.p.facts.words || 0) - (a.p.facts.words || 0))[0].p;
      const pp = pathOf(pillar.url); const missing = g.map((x) => x.p).filter((p) => p !== pillar && !(p.facts.links || []).includes(pp) && Array.isArray(p.facts.links)).map((p) => p.url);
      res.clusters.push({ label, size: g.length, pillar: pillar.url, pillarTitle: headTitle(pillar.facts.title), pages: g.map((x) => x.p.url), missingLinksToPillar: missing,
        advice: missing.length ? 'صفحات پشتیبان را با انکر طبیعی به صفحهٔ ستون «' + headTitle(pillar.facts.title) + '» لینک کنید.' : g.length < 3 ? 'این موضوع فقط ' + g.length + ' صفحه دارد؛ ۲ تا ۳ مقالهٔ پشتیبان دربارهٔ پرسش‌های واقعی مشتریان بنویسید.' : 'خوشه سالم است؛ در مقالات جدید به صفحهٔ ستون لینک بدهید.' });
    });
    res.clusters.sort((a, b) => b.missingLinksToPillar.length - a.missingLinksToPillar.length || b.size - a.size); res.thin = res.thin.slice(0, 8);
    res.ready = res.clusters.length > 0 || res.thin.length > 0; return res;
  }

  /* ---------- 4. BreadcrumbList JSON-LD ---------- */
  function breadcrumbSchema(report, url) {
    const pages = (report && report.pages) || []; const origin = String((report && report.origin) || '').replace(/\/$/, '');
    const byPath = new Map(pages.filter(okPage).map((p) => [pathOf(p.url), p]));
    const humanize = (seg) => { try { return decodeURIComponent(seg).replace(/[-_]+/g, ' '); } catch (e) { return seg; } };
    const build = (u) => {
      const parts = pathOf(u).split('/').filter(Boolean); if (!parts.length) return null; const items = [{ name: headTitle(((byPath.get('/') || {}).facts || {}).title) || 'خانه', item: origin + '/' }];
      let acc = ''; parts.forEach((seg) => { acc += '/' + seg; const pg = byPath.get(acc); items.push({ name: pg ? (headTitle(pg.facts.title) || humanize(seg)) : humanize(seg), item: origin + acc }); });
      return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, item: x.item })) };
    };
    if (url) { const j = build(url); return j ? '<script type="application/ld+json">' + JSON.stringify(j) + '</script>' : ''; }
    return pages.filter(okPage).map((p) => { const j = build(p.url); return j ? { url: p.url, jsonld: '<script type="application/ld+json">' + JSON.stringify(j) + '</script>' } : null; }).filter(Boolean);
  }

  /* ---------- 5. content decay: compare a saved baseline of page-level Search Console data with the latest ---------- */
  function aggPages(rows) {
    const m = new Map();
    (Array.isArray(rows) ? rows : []).forEach((r) => {
      const ks = (r.keys && r.keys.length ? r.keys : String(r.key || '').split(' · ')).map(String); const page = ks.find((k) => /^https?:\/\//i.test(k)); if (!page) return;
      const k = pathOf(page); const a = m.get(k) || { page, clicks: 0, impressions: 0, posW: 0 };
      a.clicks += Number(r.clicks || 0); a.impressions += Number(r.impressions || 0); a.posW += Number(r.position || 0) * Number(r.impressions || 0); m.set(k, a);
    });
    return m;
  }
  function compactPages(rows, limit) {
    return Array.from(aggPages(rows).values()).sort((a, b) => b.impressions - a.impressions).slice(0, limit || 300).map((a) => ({ keys: [a.page], clicks: a.clicks, impressions: a.impressions, position: a.impressions ? a.posW / a.impressions : 0 }));
  }
  function decay(baseRows, curRows, report, opts) {
    const o = opts || {}; const B = aggPages(baseRows), C = aggPages(curRows);
    const res = { ready: B.size > 0 && C.size > 0, decaying: [], rising: [], note: 'برای تشخیص افت، داده‌ی Search Console با بُعد «صفحه» یا «عبارت + صفحه» در دو زمان لازم است؛ اپ نسخهٔ قبلی را خودکار نگه می‌دارد.' };
    if (!res.ready) return res;
    const bad = new Map(((report && report.pages) || []).map((p) => [pathOf(p.url), p]));
    B.forEach((b, k) => {
      if (b.clicks < (o.minClicks || 10) && b.impressions < (o.minImpressions || 150)) return;
      const c = C.get(k) || { page: b.page, clicks: 0, impressions: 0, posW: 0 };
      const bp = b.impressions ? b.posW / b.impressions : 0; const cp = c.impressions ? c.posW / c.impressions : 0;
      const dc = b.clicks ? (c.clicks - b.clicks) / b.clicks : 0; const di = b.impressions ? (c.impressions - b.impressions) / b.impressions : 0;
      const item = { page: b.page, clicksBefore: b.clicks, clicksNow: c.clicks, clicksChange: Math.round(dc * 100), impressionsChange: Math.round(di * 100), positionBefore: Math.round(bp * 10) / 10, positionNow: Math.round(cp * 10) / 10 };
      if (dc <= -0.3 && b.clicks - c.clicks >= 5) {
        const pg = bad.get(k); const sev = pg && pg.issues ? pg.issues.filter((i) => i.severity === 'critical' || i.severity === 'high').map((i) => i.title) : [];
        let cause, fix;
        if (pg && pg.status >= 400) { cause = 'صفحه اکنون خطا می‌دهد'; fix = 'صفحه را برگردانید یا ریدایرکت ۳۰۱ بدهید.'; }
        else if (pg && pg.facts && pg.facts.noindex) { cause = 'صفحه noindex شده'; fix = 'اگر عمدی نیست، noindex را بردارید.'; }
        else if (cp - bp >= 1.5) { cause = 'رتبه ' + Math.round((cp - bp) * 10) / 10 + ' پله افت کرده'; fix = 'محتوا را به‌روز و کامل‌تر کنید، پرسش‌های تازه و منبع معتبر اضافه کنید و از صفحات مرتبط لینک بدهید.'; }
        else if (di > -0.15) { cause = 'نمایش ثابت ولی کلیک کمتر شده'; fix = 'عنوان و توضیحات متا را بازنویسی و نتیجهٔ جستجو را با رقبا مقایسه کنید.'; }
        else { cause = 'نمایش در جستجو کم شده (تقاضا، فصلی‌بودن یا نمایه‌سازی)'; fix = 'در Search Console وضعیت نمایه و روند فصلی عبارت‌ها را بررسی و محتوا را تازه کنید.'; }
        res.decaying.push(Object.assign(item, { cause, fix, knownIssues: sev.slice(0, 3), severity: dc <= -0.5 ? 'high' : 'medium' }));
      } else if (dc >= 0.5 && c.clicks - b.clicks >= 10) res.rising.push(item);
    });
    res.decaying.sort((a, b) => (b.clicksBefore - b.clicksNow) - (a.clicksBefore - a.clicksNow)); res.rising.sort((a, b) => (b.clicksNow - b.clicksBefore) - (a.clicksNow - a.clicksBefore));
    res.decaying = res.decaying.slice(0, o.limit || 8); res.rising = res.rising.slice(0, 5); return res;
  }

  return { decay, compactPages, redirectPlan, titleVariants, ctrBoost, topicClusters, breadcrumbSchema };
});
