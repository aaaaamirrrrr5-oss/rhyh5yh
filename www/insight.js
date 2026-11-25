/* Site Inspector Insight — site-structure intelligence (v1.20.0).
 * Deterministic, model-free (any phone, any RAM). Reads the audit report + optional Search Console rows and finds what a
 * page-by-page checklist cannot see: orphan pages, broken internal links, click depth, duplicate titles/descriptions/H1,
 * internal-link opportunities, keyword cannibalization, content gaps and "fix-first" pages weighted by real search demand.
 * Everything is a diagnostic from the data it was given; nothing here predicts or guarantees Google rankings.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SI = root.SI || {}, root.SI.Insight = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const SEV_W = { critical: 12, high: 7, medium: 3, low: 1 };
  const STOP = new Set(('و در به از که این آن با برای را است هم یا تا بر هر یک های ها های شد شده می بود ما شما من او آنها ولی اما اگر چه چرا چگونه بهترین خرید قیمت راهنما نحوه ' +
    'the and for with that this from your you are how what why best buy price guide').split(/\s+/));
  const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const clean = (s) => String(s || '').toLowerCase().replace(/[‌‏‎]/g, ' ').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim();
  const tokens = (s) => (clean(s).match(/[\p{L}\p{N}]{3,}/gu) || []).filter((w) => !STOP.has(w));
  function pathOf(u) {
    try { const x = new URL(u, 'https://x.invalid'); return decodeURIComponent(x.pathname).replace(/\/+$/, '') || '/'; } catch (e) { return String(u || '').split(/[?#]/)[0].replace(/\/+$/, '') || '/'; }
  }
  const okPage = (p) => p && p.status > 0 && p.status < 400;
  const indexable = (p) => okPage(p) && !(p.facts && p.facts.noindex);
  const shortTitle = (t) => String(t || '').split(/\s[|\-–—·»]\s/)[0].trim();

  /* ---------- on-site structure ---------- */
  function analyzeStructure(report) {
    const pages = (report && report.pages) || [];
    const res = { ready: false, pages: pages.length, orphans: [], broken: [], deep: [], unreachable: [], hubs: [], duplicates: { title: [], description: [], h1: [] },
      mixed: [], canonicalElsewhere: [], suggestions: [], maxDepth: 0, score: 100, partial: false, note: '' };
    if (pages.length < 2) { res.note = 'برای تحلیل ساختار حداقل ۲ صفحهٔ خزیده‌شده لازم است.'; return res; }
    const byPath = new Map(); pages.forEach((p) => { byPath.set(pathOf(p.url), p); });
    const home = byPath.has('/') ? '/' : pathOf(pages[0].url);
    const hasLinks = pages.some((p) => p.facts && Array.isArray(p.facts.links));
    res.ready = true; res.partial = !hasLinks;

    /* duplicates (title / meta description / H1) */
    const dup = (get) => {
      const m = new Map();
      pages.filter(indexable).forEach((p) => { const v = clean(get(p.facts || {})); if (v && v.length > 3) { if (!m.has(v)) m.set(v, []); m.get(v).push(p.url); } });
      return Array.from(m.entries()).filter(([, u]) => u.length > 1).map(([value, urls]) => ({ value, urls })).sort((a, b) => b.urls.length - a.urls.length);
    };
    res.duplicates.title = dup((f) => f.title); res.duplicates.description = dup((f) => f.description); res.duplicates.h1 = dup((f) => f.h1Text);

    /* mixed content & canonical pointing elsewhere */
    pages.forEach((p) => {
      const f = p.facts || {};
      if (f.mixed > 0) res.mixed.push({ url: p.url, count: f.mixed });
      if (f.canonicalUrl && indexable(p)) {
        const to = pathOf(f.canonicalUrl); let sameHost = true; try { sameHost = new URL(f.canonicalUrl).host === new URL(p.url).host; } catch (e) {}
        if (!sameHost || to !== pathOf(p.url)) res.canonicalElsewhere.push({ url: p.url, canonical: f.canonicalUrl, external: !sameHost, targetScanned: byPath.has(to) });
      }
    });

    if (hasLinks) {
      const inl = new Map(); pages.forEach((p) => inl.set(pathOf(p.url), new Set()));
      const out = new Map();
      pages.forEach((p) => {
        const src = pathOf(p.url); const L = (p.facts && p.facts.links) || []; out.set(src, L);
        L.forEach((t) => { if (t !== src && inl.has(t)) inl.get(t).add(src); });
      });
      /* orphans: indexable pages that no scanned page links to (home excluded) */
      pages.forEach((p) => { const k = pathOf(p.url); if (k !== home && indexable(p) && inl.get(k).size === 0) res.orphans.push(p.url); });
      /* broken internal links */
      pages.forEach((p) => {
        const src = pathOf(p.url);
        ((p.facts && p.facts.links) || []).forEach((t) => { const tp = byPath.get(t); if (tp && tp.status >= 400 && t !== src) res.broken.push({ from: p.url, to: tp.url, status: tp.status }); });
      });
      /* click depth from home (BFS) */
      const depth = new Map([[home, 0]]); const q = [home];
      while (q.length) { const c = q.shift(); (out.get(c) || []).forEach((t) => { if (!depth.has(t) && byPath.has(t)) { depth.set(t, depth.get(c) + 1); q.push(t); } }); }
      pages.forEach((p) => { const d = depth.get(pathOf(p.url)); if (d === undefined) { if (pathOf(p.url) !== home && indexable(p)) res.unreachable.push(p.url); } else { res.maxDepth = Math.max(res.maxDepth, d); if (d > 3) res.deep.push({ url: p.url, depth: d }); } });
      /* hubs */
      res.hubs = pages.map((p) => ({ url: p.url, inlinks: inl.get(pathOf(p.url)).size })).filter((x) => x.inlinks > 0).sort((a, b) => b.inlinks - a.inlinks).slice(0, 5);
      res.suggestions = linkSuggestions(pages, inl, home);
    } else res.note = 'این گزارش قدیمی است و داده‌ی لینک‌ها را ندارد؛ یک بازرسی جدید بگیرید تا یتیم‌ها، لینک‌های شکسته و عمق کلیک هم بررسی شود.';

    /* structure score 0-100 */
    const n = Math.max(1, pages.length); let pen = 0;
    pen += Math.min(30, (res.orphans.length / n) * 60);
    pen += Math.min(25, res.broken.length * 5);
    pen += Math.min(20, res.duplicates.title.reduce((s, d) => s + d.urls.length, 0) * 4);
    pen += Math.min(10, res.duplicates.description.reduce((s, d) => s + d.urls.length, 0) * 2);
    pen += Math.min(10, ((res.deep.length + res.unreachable.length) / n) * 30);
    pen += Math.min(10, res.mixed.length * 5);
    res.score = Math.max(0, Math.round(100 - pen));
    return res;
  }

  /* internal-link opportunities: page A talks about the topic of page B but does not link to it. Orphans are favoured. */
  function linkSuggestions(pages, inl, home) {
    const cand = pages.filter((p) => indexable(p) && p.facts && (p.facts.words || 0) >= 120 && pathOf(p.url) !== home);
    const keys = new Map(); cand.forEach((p) => { const k = Array.from(new Set(tokens(shortTitle(p.facts.title) + ' ' + (p.facts.h1Text || '')))).slice(0, 6); if (k.length) keys.set(p.url, k); });
    const list = [];
    pages.filter(indexable).forEach((s) => {
      const sf = s.facts || {}; const sterms = new Set((sf.terms || []).map(clean)); const have = new Set(sf.links || []); const sp = pathOf(s.url);
      if (!sterms.size) return;
      cand.forEach((t) => {
        if (t.url === s.url) return; const tp = pathOf(t.url); if (have.has(tp)) return;
        const k = keys.get(t.url); if (!k) return;
        const hit = k.filter((w) => sterms.has(w)).length; const need = k.length === 1 ? 1 : 2; if (hit < need) return;
        const orphan = inl.get(tp) && inl.get(tp).size === 0;
        list.push({ from: s.url, to: t.url, anchor: shortTitle(t.facts.h1Text || t.facts.title).slice(0, 60), score: hit + (orphan ? 3 : 0) + Math.min(2, (sf.words || 0) / 800), toOrphan: !!orphan });
      });
    });
    const perFrom = {}; const perTo = {};
    return list.sort((a, b) => b.score - a.score).filter((x) => { perFrom[x.from] = (perFrom[x.from] || 0) + 1; perTo[x.to] = (perTo[x.to] || 0) + 1; return perFrom[x.from] <= 2 && perTo[x.to] <= 3; }).slice(0, 12);
  }

  /* ---------- Search Console based ---------- */
  const isUrl = (s) => /^https?:\/\//i.test(String(s || ''));
  function splitKeys(r) {
    const ks = (r.keys && r.keys.length ? r.keys : String(r.key || '').split(' · ')).map(String);
    const page = ks.find(isUrl) || ''; const query = ks.find((k) => !isUrl(k)) || ''; return { query: clean(query), page };
  }
  function normRows(rows) { return (Array.isArray(rows) ? rows : []).filter(Boolean).map((r) => Object.assign({ impressions: 0, clicks: 0, position: 0 }, r, splitKeys(r))); }

  /** Queries for which two or more of the site's own pages compete (needs Search Console rows with query+page). */
  function cannibalization(rows, opts) {
    const o = opts || {}; const minImp = o.minImpressions || 20; const R = normRows(rows).filter((r) => r.query && r.page);
    const res = { ready: R.length > 0, items: [], note: R.length ? '' : 'برای تشخیص رقابت داخلی صفحات، داده‌ی Search Console با بُعد «عبارت + صفحه» لازم است.' };
    const g = new Map(); R.forEach((r) => { if (!g.has(r.query)) g.set(r.query, new Map()); const m = g.get(r.query); const k = pathOf(r.page); const c = m.get(k) || { page: r.page, impressions: 0, clicks: 0, posW: 0 }; c.impressions += r.impressions; c.clicks += r.clicks; c.posW += r.position * r.impressions; m.set(k, c); });
    g.forEach((m, query) => {
      const arr = Array.from(m.values()).map((c) => ({ page: c.page, impressions: c.impressions, clicks: c.clicks, position: c.impressions ? Math.round((c.posW / c.impressions) * 10) / 10 : 0 })).filter((c) => c.impressions >= minImp);
      if (arr.length < 2) return; const total = arr.reduce((s, c) => s + c.impressions, 0); if (total < (o.minTotal || 100)) return;
      arr.sort((a, b) => b.clicks - a.clicks || a.position - b.position || b.impressions - a.impressions);
      const share2 = arr[1].impressions / total; if (share2 < 0.2) return;
      const close = Math.abs(arr[0].position - arr[1].position) <= 5 && arr[0].position <= 30;
      res.items.push({ query, pages: arr.slice(0, 4), totalImpressions: total, severity: close && total >= 300 ? 'high' : 'medium', primary: arr[0].page,
        action: 'صفحهٔ «' + pathOf(arr[0].page) + '» را صفحهٔ اصلی این عبارت بگیرید؛ محتوای مشابه صفحهٔ دیگر را ادغام یا آن را به این عبارت ننویسید و با لینک داخلی (انکر همین عبارت) به صفحهٔ اصلی لینک بدهید. اگر صفحهٔ دوم لازم نیست، ریدایرکت ۳۰۱ بزنید.' });
    });
    res.items.sort((a, b) => b.totalImpressions - a.totalImpressions); res.items = res.items.slice(0, o.limit || 10); return res;
  }

  const INTENT = [[/(خرید|قیمت|فروش|سفارش|ارزان|buy|price|order|shop)/i, 'خرید', 'صفحهٔ دسته/محصول با قیمت و CTA'], [/(چیست|چگونه|آموزش|روش|نحوه|راهنما|how|what|guide|tutorial)/i, 'آموزشی', 'مقالهٔ راهنمای کامل با FAQ'],
    [/(بهترین|مقایسه|یا |تفاوت|vs|best|compare)/i, 'مقایسه', 'مقالهٔ مقایسه با جدول'], [/(نزدیک|در تهران|شعبه|آدرس|near)/i, 'محلی', 'صفحهٔ محلی با آدرس و نقشه']];
  const intentOf = (q) => { for (const [re, name, fmt] of INTENT) if (re.test(q)) return { intent: name, format: fmt }; return { intent: 'عمومی', format: 'مقالهٔ تخصصی یا صفحهٔ موضوعی' }; };

  /** Queries people search (impressions) that none of the scanned pages targets in title/H1 → candidate new content. */
  function contentGaps(rows, report, opts) {
    const o = opts || {}; const minImp = o.minImpressions || 40; const pages = (report && report.pages) || [];
    const R = normRows(rows).filter((r) => r.query); const res = { ready: R.length > 0 && pages.length > 0, items: [], note: '' };
    if (!res.ready) { res.note = 'برای پیشنهاد محتوای جدید، داده‌ی عبارت‌های Search Console و یک بازرسی لازم است.'; return res; }
    const heads = pages.map((p) => new Set(tokens(((p.facts || {}).title || '') + ' ' + ((p.facts || {}).h1Text || '') + ' ' + pathOf(p.url).replace(/[-_/]/g, ' '))));
    const agg = new Map(); R.forEach((r) => { const a = agg.get(r.query) || { query: r.query, impressions: 0, clicks: 0, posW: 0 }; a.impressions += r.impressions; a.clicks += r.clicks; a.posW += r.position * r.impressions; agg.set(r.query, a); });
    agg.forEach((a) => {
      if (a.impressions < minImp) return; const pos = a.impressions ? a.posW / a.impressions : 0; if (pos < 8) return; /* already ranking well: not a gap */
      const qt = tokens(a.query); if (!qt.length) return;
      const best = heads.reduce((m, h) => Math.max(m, qt.filter((w) => h.has(w)).length / qt.length), 0);
      if (best >= 0.6) return; const it = intentOf(a.query);
      res.items.push({ query: a.query, impressions: a.impressions, clicks: a.clicks, position: Math.round(pos * 10) / 10, coverage: Math.round(best * 100), intent: it.intent, suggestion: it.format });
    });
    res.items.sort((a, b) => b.impressions - a.impressions); res.items = res.items.slice(0, o.limit || 10); return res;
  }

  /** Pages ordered by (real search demand × severity of their problems): what to fix first. Falls back to inbound-link weight without GSC. */
  function priorityPages(report, rows, opts) {
    const pages = (report && report.pages) || []; const R = normRows(rows).filter((r) => r.page);
    const demand = new Map(); R.forEach((r) => { const k = pathOf(r.page); const d = demand.get(k) || { impressions: 0, clicks: 0 }; d.impressions += r.impressions; d.clicks += r.clicks; demand.set(k, d); });
    const useDemand = demand.size > 0;
    const items = pages.filter((p) => p.issues && p.issues.length).map((p) => {
      const sev = p.issues.reduce((s, i) => s + (SEV_W[i.severity] || 1), 0); const d = demand.get(pathOf(p.url)) || { impressions: 0, clicks: 0 };
      const weight = useDemand ? Math.log10(10 + d.impressions) : 1;
      return { url: p.url, severityPoints: sev, impressions: d.impressions, clicks: d.clicks, score: Math.round(sev * weight * 10) / 10, top: p.issues.slice().sort((a, b) => (SEV_W[b.severity] || 1) - (SEV_W[a.severity] || 1)).slice(0, 3).map((i) => i.title) };
    }).sort((a, b) => b.score - a.score).slice(0, (opts && opts.limit) || 6);
    return { ready: items.length > 0, usesSearchDemand: useDemand, items };
  }

  /* ---------- orchestration ---------- */
  function buildInsights(report, gscRows, opts) {
    const structure = analyzeStructure(report);
    const cannibal = cannibalization(gscRows, opts); const gaps = contentGaps(gscRows, report, opts); const priority = priorityPages(report, gscRows, opts);
    const seo = report && report.scores ? report.scores.seo : null; const ai = report && report.scores ? report.scores.ai : null;
    const siteIQ = seo === null ? structure.score : Math.round(seo * 0.5 + (ai === null ? seo : ai) * 0.2 + structure.score * 0.3);
    const actions = [];
    const add = (code, severity, title, affected, fix, impact, effort) => { if (affected > 0) actions.push({ code, severity, title, affected, fix, impact, effort, area: 'structure' }); };
    add('st_broken_links', 'high', 'لینک داخلی به صفحهٔ خراب', structure.broken.length, 'لینک را اصلاح کنید یا صفحهٔ مقصد را با ریدایرکت ۳۰۱ به صفحهٔ جایگزین ببرید.', 8, 2);
    add('st_orphans', 'medium', 'صفحهٔ یتیم (بدون لینک ورودی)', structure.orphans.length, 'از صفحات مرتبط و منوی دسته‌ها به این صفحات لینک بدهید؛ پیشنهادهای لینک‌سازی پایین را ببینید.', 7, 2);
    add('st_dup_title', 'high', 'عنوان تکراری بین صفحات', structure.duplicates.title.reduce((s, d) => s + d.urls.length, 0), 'برای هر صفحه عنوان یکتا بنویسید؛ در صفحات مشابه تفاوت واقعی را در عنوان بیاورید.', 7, 3);
    add('st_dup_desc', 'low', 'توضیحات متای تکراری', structure.duplicates.description.reduce((s, d) => s + d.urls.length, 0), 'متای یکتا برای هر صفحه بنویسید یا خالی بگذارید تا موتور جستجو از متن همان صفحه بسازد.', 4, 3);
    add('st_deep', 'medium', 'صفحهٔ دور از صفحهٔ اول (بیش از ۳ کلیک)', structure.deep.length + structure.unreachable.length, 'صفحات مهم را از منو، فوتر یا صفحهٔ دسته لینک کنید تا حداکثر در ۳ کلیک برسند.', 6, 3);
    add('st_mixed', 'high', 'محتوای ناامن (HTTP) داخل صفحهٔ HTTPS', structure.mixed.length, 'آدرس تصاویر/اسکریپت‌ها را به https تغییر دهید (در وردپرس: جایگزینی آدرس در دیتابیس).', 7, 2);
    add('st_canonical', 'medium', 'canonical به صفحهٔ دیگر اشاره می‌کند', structure.canonicalElsewhere.length, 'مطمئن شوید این صفحه عمداً به صفحهٔ دیگر canonical شده؛ در غیر این صورت canonical را به خودش برگردانید.', 6, 2);
    add('st_cannibal', 'high', 'رقابت صفحات داخلی روی یک عبارت', cannibal.items.length, 'برای هر عبارت یک صفحهٔ اصلی انتخاب و بقیه را ادغام/لینک‌دهی کنید.', 7, 4);
    add('st_gap', 'medium', 'عبارت پرجستجو بدون صفحهٔ هدف', gaps.items.length, 'برای این عبارت‌ها محتوای تازه با نیت جستجوی درست بنویسید.', 6, 6);
    const w = { critical: 0, high: 1, medium: 2, low: 3 }; actions.sort((a, b) => w[a.severity] - w[b.severity] || (b.impact - b.effort) - (a.impact - a.effort));
    const headline = !structure.ready ? structure.note : actions.length ? 'شاخص سلامت کل ' + fa(siteIQ) + ' از ۱۰۰ · ' + fa(actions.length) + ' موضوع ساختاری برای رسیدگی' : 'شاخص سلامت کل ' + fa(siteIQ) + ' از ۱۰۰ · ساختار سایت مشکل مهمی ندارد ✓';
    return { structure, cannibal, gaps, priority, siteIQ, actions, headline };
  }

  function toMarkdown(ins, site) {
    const p = (u) => pathOf(u); const L = ['# گزارش ساختار سایت' + (site ? ' — ' + site : ''), '', ins.headline, ''];
    const S = ins.structure;
    if (S.broken.length) { L.push('## لینک‌های داخلی خراب'); S.broken.slice(0, 15).forEach((b) => L.push('- ' + p(b.from) + ' ← ' + p(b.to) + ' (' + b.status + ')')); L.push(''); }
    if (S.orphans.length) { L.push('## صفحات یتیم'); S.orphans.slice(0, 15).forEach((u) => L.push('- ' + p(u))); L.push(''); }
    if (S.duplicates.title.length) { L.push('## عنوان‌های تکراری'); S.duplicates.title.slice(0, 8).forEach((d) => L.push('- «' + d.value + '» در ' + d.urls.map(p).join('، '))); L.push(''); }
    if (S.suggestions.length) { L.push('## پیشنهاد لینک داخلی'); S.suggestions.forEach((s) => L.push('- از ' + p(s.from) + ' به ' + p(s.to) + ' با انکر «' + s.anchor + '»')); L.push(''); }
    if (ins.cannibal.items.length) { L.push('## رقابت داخلی صفحات'); ins.cannibal.items.forEach((c) => L.push('- «' + c.query + '»: ' + c.pages.map((x) => p(x.page) + ' (رتبه ' + x.position + ')').join(' / ') + ' → صفحهٔ اصلی: ' + p(c.primary))); L.push(''); }
    if (ins.gaps.items.length) { L.push('## فرصت محتوای جدید'); ins.gaps.items.forEach((g) => L.push('- «' + g.query + '» (' + g.impressions + ' نمایش، نیت: ' + g.intent + ') → ' + g.suggestion)); L.push(''); }
    L.push('> تحلیل تشخیصی بر پایه‌ی داده‌های همین بازرسی است و رتبه‌ای را تضمین نمی‌کند.'); return L.join('\n');
  }

  return { analyzeStructure, linkSuggestions, cannibalization, contentGaps, priorityPages, buildInsights, toMarkdown, intentOf, pathOf, tokens };
});
