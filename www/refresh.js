/* Site Inspector Content Refresh Planner (v1.23.0) — deterministic, model-free, works on any phone.
 *  Ranks the pages that deserve a rewrite/refresh FIRST, by combining:
 *   - Search Console signals (traffic decay vs. saved baseline, striking-distance queries, CTR gap)
 *   - on-page facts from the crawl (thin text, no sections, no FAQ, weak meta, stale year, missing schema, orphan)
 *  and turns each page into a concrete checklist plus a writer-ready brief (target queries, sections to add).
 * Suggestions only: nothing is applied here and no ranking/traffic result is promised. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./insight.js'), require('./pro.js'));
  else root.SI = root.SI || {}, root.SI.Refresh = factory(root.SI.Insight, root.SI.Pro);
})(typeof self !== 'undefined' ? self : this, function (Insight, Pro) {
  'use strict';
  const pathOf = Insight.pathOf;
  const latin = (s) => String(s || '').replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632));
  const headTitle = (t) => String(t || '').split(/\s[|\-–—·»]\s/)[0].trim();
  const okPage = (p) => p && p.status > 0 && p.status < 400 && !(p.facts && p.facts.noindex);
  const QWORD = /(^|\s)(چیست|چگونه|چطور|چرا|کدام|چه|آیا|چند|کی|کجا|مراحل|روش|تفاوت)(\s|$|؟)|\?|؟/;

  /** Years written in a title/H1 that are clearly in the past (Gregorian 20xx or Jalali 13xx/14xx). */
  function staleYears(text, now) {
    const d = now instanceof Date ? now : new Date(); const gy = d.getFullYear(); let jy = gy - 621;
    try { jy = Number(latin(new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' }).format(d))) || jy; } catch (e) {}
    const out = []; (latin(text).match(/(?<!\d)(20\d{2}|13\d{2}|14\d{2})(?!\d)/g) || []).forEach((m) => {
      const y = Number(m); if ((y >= 2000 && y <= gy - 1) || (y >= 1380 && y <= jy - 1)) if (!out.includes(m)) out.push(m);
    });
    return out;
  }

  /** Search Console rows grouped per page: top queries, question-like queries, striking-distance ones. */
  function queriesByPage(rows) {
    const m = new Map();
    (Array.isArray(rows) ? rows : []).forEach((r) => {
      if (!r) return; const ks = (r.keys && r.keys.length ? r.keys : String(r.key || '').split(' · ')).map(String);
      const page = ks.find((k) => /^https?:\/\//i.test(k)); const query = ks.find((k) => k !== page && k.trim());
      if (!page || !query) return; const k = pathOf(page); const a = m.get(k) || { qs: new Map() };
      const q = a.qs.get(query) || { query, clicks: 0, impressions: 0, posW: 0 };
      q.clicks += Number(r.clicks || 0); q.impressions += Number(r.impressions || 0); q.posW += Number(r.position || 0) * Number(r.impressions || 0);
      a.qs.set(query, q); m.set(k, a);
    });
    const out = new Map();
    m.forEach((a, k) => out.set(k, Array.from(a.qs.values()).map((q) => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, position: q.impressions ? Math.round((q.posW / q.impressions) * 10) / 10 : 0 })).sort((x, y) => y.impressions - x.impressions)));
    return out;
  }

  function planPage(p, ctx) {
    const f = p.facts || {}; const key = pathOf(p.url); const reasons = []; const actions = []; let score = 0; let effort = 0;
    const add = (code, w, label, action, e) => { score += w; reasons.push({ code, weight: w, label }); if (action) actions.push(action); effort += e || 0; };
    const qs = (ctx.queries.get(key) || []).slice(0, 30);
    const words = Number(f.words || 0);

    const dec = ctx.decay.get(key);
    if (dec) add('decay', Math.min(35, 15 + Math.round(Math.abs(dec.clicksChange) / 4)), 'افت کلیک ' + Math.abs(dec.clicksChange) + '٪ (' + dec.cause + ')', dec.fix, 2);

    const striking = qs.filter((q) => q.position > 3.5 && q.position <= 20 && q.impressions >= 30);
    if (striking.length) {
      const imp = striking.reduce((n, q) => n + q.impressions, 0);
      add('striking', Math.min(22, 8 + Math.round(Math.log10(imp + 1) * 4)), striking.length + ' عبارت نزدیک صفحهٔ اول (رتبه ۴ تا ۲۰)', 'عبارت‌های «' + striking.slice(0, 3).map((q) => q.query).join('، ') + '» را در عنوان، H2 و پاسخ‌های مستقیم صفحه پوشش بدهید.', 2);
    }

    if (okPage(p)) {
      if (words > 0 && words < 300) add('thin', 24, 'محتوای کم (' + words + ' واژه)', 'متن را با پاسخ به پرسش‌های واقعی کاربران کامل کنید؛ فقط با اطلاعات درست و قابل‌دفاع، نه پرکردن متن.', 3);
      else if (words >= 300 && words < 600 && striking.length) add('short', 8, 'متن کوتاه نسبت به عبارت‌های هدف (' + words + ' واژه)', 'بخش‌های پشتیبان (مثال، اشتباهات رایج، مقایسه) اضافه کنید.', 2);
      if (words >= 300 && !(f.h2 > 0)) add('nosections', 12, 'بدون زیرعنوان H2', 'متن را با زیرعنوان‌های پرسشی ساختار بدهید تا برای خواننده و موتورهای AI قابل‌استخراج شود.', 1);
      const qq = qs.filter((q) => QWORD.test(q.query) && q.impressions >= 10);
      if (qq.length && !f.hasFaq && !(f.questionHeadings > 0)) add('faq', 12, qq.length + ' پرسش واقعی جستجو بدون پاسخ مستقیم در صفحه', 'بخش پرسش‌وپاسخ با پاسخ کوتاه (۲ تا ۴ جمله) برای: ' + qq.slice(0, 3).map((q) => q.query).join('، ') + '.', 1);
      const stale = staleYears(headTitle(f.title) + ' ' + (f.h1Text || ''), ctx.now);
      if (stale.length) add('stale', 14, 'سال قدیمی در عنوان/H1 (' + stale.join('، ') + ')', 'محتوا را واقعاً به‌روز کنید، سپس سال را اصلاح کنید؛ فقط تغییر عدد سال کافی نیست.', 1);
      if (!f.description) add('nometa', 10, 'بدون توضیحات متا', 'توضیحات متای حدود ۷۰ تا ۱۶۰ نویسه با عبارت اصلی بنویسید.', 0.5);
      else if (f.titleLen && (f.titleLen < 25 || f.titleLen > 70)) add('title', 6, 'طول عنوان نامناسب (' + f.titleLen + ' نویسه)', 'عنوان را به حدود ۳۰ تا ۶۰ نویسه برسانید.', 0.5);
      if (words >= 300 && f.schema === 0) add('schema', 5, 'بدون داده‌ی ساختاریافته', 'اسکیمای مناسب (Article یا FAQ در صورت وجود پرسش‌وپاسخ) اضافه کنید.', 0.5);
      if (f.imagesNoAlt > 0) add('alt', 4, f.imagesNoAlt + ' تصویر بدون متن جایگزین', 'برای تصاویر مهم alt توصیفی بنویسید.', 0.5);
      if (ctx.orphans.has(key)) add('orphan', 8, 'هیچ صفحه‌ای به آن لینک نمی‌دهد', 'از دو یا سه صفحهٔ مرتبط با انکر طبیعی به آن لینک بدهید.', 1);
      if (ctx.cannibal.has(key)) add('cannibal', 9, 'رقابت داخلی با صفحهٔ دیگر روی یک عبارت', 'نقش این صفحه را مشخص کنید یا محتوای هم‌پوشان را ادغام و ریدایرکت کنید.', 2);
    }
    if (!reasons.length) return null;
    score = Math.min(100, Math.round(score));
    const level = effort <= 2 ? 'کم' : effort <= 5 ? 'متوسط' : 'زیاد';
    const targets = qs.filter((q) => q.impressions >= 10).slice(0, 6);
    return { url: p.url, path: key, title: headTitle(f.title), words, score, effort: level, priority: score >= 55 ? 'high' : score >= 30 ? 'medium' : 'low', reasons, actions, targetQueries: targets, brief: '' };
  }

  /** Writer-ready brief: facts only from the crawl and Search Console, no invented numbers. */
  function briefFor(item) {
    const L = ['موضوع صفحه: ' + (item.title || item.path), 'آدرس: ' + item.path, 'تعداد واژهٔ فعلی: ' + item.words, ''];
    if (item.targetQueries.length) L.push('عبارت‌های هدف (از Search Console):', ...item.targetQueries.map((q) => '- ' + q.query + ' (رتبه ' + q.position + '، نمایش ' + q.impressions + ')'), '');
    L.push('کارهای لازم:', ...item.actions.map((a) => '- ' + a), '', 'قواعد: فقط اطلاعات قابل‌تأیید بنویس؛ عدد، آمار یا ادعای تضمینی بدون منبع ننویس؛ متن موجود را کلمه‌به‌کلمه تکرار نکن؛ اگر اطلاعات کافی نیست، به‌جای حدس بنویس «نیازمند اطلاعات».');
    return L.join('\n');
  }

  function plan(report, opts) {
    const o = opts || {}; const pages = ((report && report.pages) || []);
    const res = { ready: false, items: [], summary: { high: 0, medium: 0, low: 0 }, snoozed: 0, note: pages.length ? '' : 'ابتدا یک بازرسی انجام دهید.', hasSearchData: false };
    const done = o.done && typeof o.done === 'object' ? o.done : {}; const cool = (o.cooldownDays || 30) * 86400000; const nowMs = (o.now instanceof Date ? o.now : new Date()).getTime();
    if (!pages.length) return res;
    const queries = queriesByPage(o.gscRows); res.hasSearchData = queries.size > 0;
    const decay = new Map(); try { const d = Pro.decay(o.baseRows, o.gscRows, report); if (d.ready) d.decaying.forEach((x) => decay.set(pathOf(x.page), x)); } catch (e) {}
    let st = o.structure; try { st = st || Insight.analyzeStructure(report); } catch (e) { st = null; }
    const orphans = new Set(((st && st.orphans) || []).map(pathOf));
    const cannibal = new Set(); try { const c = Insight.cannibalization(o.gscRows); if (c.ready) c.items.forEach((it) => (it.pages || []).forEach((pg) => { const u = pg.page || pg; if (pathOf(u) !== pathOf(it.primary || '')) cannibal.add(pathOf(u)); })); } catch (e) {}
    const ctx = { queries, decay, orphans, cannibal, now: o.now };
    pages.forEach((p) => { if (!p || p.status >= 400 || p.status === 0) return; if (pathOf(p.url) === '/' && !o.includeHome) return; const dAt = Number(done[pathOf(p.url)] || 0); if (dAt && nowMs - dAt < cool && nowMs >= dAt) { res.snoozed++; return; }
      const it = planPage(p, ctx); if (it) { it.brief = briefFor(it); res.items.push(it); } });
    res.items.sort((a, b) => b.score - a.score || a.words - b.words);
    res.items.forEach((i) => { res.summary[i.priority]++; });
    res.items = res.items.slice(0, o.limit || 12); res.ready = res.items.length > 0;
    res.note = res.hasSearchData ? '' : 'بدون داده‌ی Search Console فقط مشکلات داخل صفحه سنجیده شد؛ با اتصال Search Console اولویت‌بندی دقیق‌تر می‌شود.';
    return res;
  }

  function toMarkdown(planRes) {
    if (!planRes || !planRes.ready) return '';
    const L = ['# برنامهٔ تازه‌سازی محتوا', ''];
    planRes.items.forEach((i, n) => { L.push('## ' + (n + 1) + '. ' + (i.title || i.path) + ' — امتیاز ' + i.score + ' (تلاش: ' + i.effort + ')', '`' + i.path + '`', '', ...i.reasons.map((r) => '- ' + r.label), '', '**اقدام:**', ...i.actions.map((a) => '- ' + a), ''); });
    L.push('> این برنامه پیشنهادی است و بهبود رتبه یا ترافیک را تضمین نمی‌کند.');
    return L.join('\n');
  }

  /** Pre-fill values for the content agent form: matches the page to a real WordPress item by URL path (never guesses). */
  function agentPrefill(item, catalog) {
    if (!item) return null;
    const hit = (Array.isArray(catalog) ? catalog : []).find((c) => c && c.url && pathOf(c.url) === item.path);
    const q = item.targetQueries || [];
    const instr = 'بازنویسی برای تازه‌سازی محتوا. اقدام‌ها: ' + item.actions.join(' ؛ ') + (q.length ? ' . عبارت‌های هدف: ' + q.slice(0, 4).map((x) => x.query).join('، ') : '') + ' . فقط اطلاعات موجود در متن فعلی یا منبع معتبر را بنویس؛ عدد یا ادعای ساختگی ممنوع.';
    return { matched: !!hit, action: 'update', target_id: hit ? String(hit.id) : '', kind: hit ? hit.type : 'post', title: hit ? hit.title : item.title, keyword: q.length ? q[0].query : '', instructions: instr };
  }

  return { plan, planPage, agentPrefill, staleYears, queriesByPage, briefFor, toMarkdown };
});
