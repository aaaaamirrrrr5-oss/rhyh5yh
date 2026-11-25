/* Site Inspector — contentaudit.js (v1.38.0)
 * Content-quality audit across the whole site with classic algorithms only (TF-IDF, SimHash, shingles). No AI model, no API.
 * Input: pages from TechAudit.extractPage(). Pure logic, UMD. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./fatext.js'), require('./techaudit.js'));
  else root.ContentAudit = factory(root.FaText, root.TechAudit);
})(typeof self !== 'undefined' ? self : this, function (F, T) {
  'use strict';

  /* ---------- page type (URL + schema + signals); override with page.type ---------- */
  function pageType(p) {
    if (p.type) return p.type;
    let path = ''; try { path = decodeURIComponent(new URL(p.url).pathname); } catch (e) { path = p.url; }
    const st = (p.schemaTypes || []).join(' '), pl = path.toLowerCase();
    if (path === '/' || path === '') return 'home';
    if (/(^|\/)(cart|checkout|my-account|account|login|register|wp-login|lost-password|order-received|order-pay|wishlist|compare|thank-you|thanks|سبد-خرید|پرداخت|حساب-کاربری|ورود|ثبت-نام|مقایسه|علاقه-مندی|علاقه‌مندی)(\/|$)/i.test(pl)) return 'utility';
    if (/(^|\/)(tag|tags|برچسب|author|نویسنده|search|جستجو)(\/|$)|\/page\/\d+/i.test(pl)) return 'archive';
    if (/(^|\/)(product-category|category|categories|cat|دسته|دسته-بندی|دسته‌بندی|shop-category)(\/|$)/i.test(pl)) return 'category';
    if (/\bProduct\b/.test(st) || /(^|\/)(product|products|محصول|محصولات)(\/|$)/i.test(pl) || p.ogType === 'product') return 'product';
    if (/Article|BlogPosting|NewsArticle/.test(st) || p.ogType === 'article' || /(^|\/)(blog|news|article|articles|post|مقاله|مقالات|بلاگ|وبلاگ|اخبار|راهنما)(\/|$)|\/\d{4}\/\d{2}\//i.test(pl)) return 'article';
    return 'page';
  }
  /* minimum words: [thin (issue), weak (low)] */
  const MIN_WORDS = { home: [100, 250], product: [60, 150], category: [60, 150], article: [300, 600], page: [150, 300], archive: [0, 0], utility: [0, 0] };

  const idxOK = (p) => p.status === 200 && !p.noindex && (!p.canonical || T.urlKey(p.canonical) === T.urlKey(p.url));

  /* v1.66: فقط آرشیو برچسب/نویسنده/جستجو «کم‌ارزش» است؛ صفحه‌بندی عادی دسته و وبلاگ (/page/2/) طبیعی است و هشدار نمی‌گیرد. */
  function isTaxArchive(u) { let path = ''; try { path = decodeURIComponent(new URL(u).pathname); } catch (e) { path = u; } return /(^|\/)(tag|tags|برچسب|author|نویسنده|search|جستجو)(\/|$)/i.test(path.toLowerCase()); }

  /* ---------- union-find ---------- */
  function uf(n) { const a = Array.from({ length: n }, (_, i) => i); const f = (x) => (a[x] === x ? x : (a[x] = f(a[x]))); return { find: f, union: (x, y) => { a[f(x)] = f(y); } }; }
  const setJ = (A, B) => { if (!A.size || !B.size) return 0; let n = 0; A.forEach((x) => { if (B.has(x)) n++; }); return n / (A.size + B.size - n); };
  const hashStr = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h >>> 0; };

  /* ---------- main ---------- */
  function audit(pages, opts) {
    opts = opts || {}; const I = T.mkIssues();
    const live = pages.filter((p) => p.status === 200);
    const info = new Map(); const docs = [];
    live.forEach((p) => {
      const type = pageType(p), toks = F.tokens(p.text), titleToks = new Set(F.tokens((p.title || '') + ' ' + (p.h1 || '')));
      const bodyToks = F.tokens(p.h1 ? p.text.replace(p.h1, ' ') : p.text);     // H1 differs per page by design; ignore it when comparing bodies
      info.set(p.url, { type, toks, bodyToks, titleToks, words: p.words });
      docs.push({ id: p.url, tokens: toks });
    });
    const corpus = F.buildCorpus(docs);
    const perPage = {};

    /* --- per-page checks --- */
    live.forEach((p) => {
      const meta = info.get(p.url), { type, toks } = meta, u = p.url, w = p.words;
      const [thin, weak] = MIN_WORDS[type] || [150, 300];
      perPage[u] = { type, words: w, topTerms: corpus.topTerms(u, 6).map((t) => t.term) };
      if (type === 'utility' || p.noindex) return;
      if (type === 'archive') { if (!p.noindex && isTaxArchive(u)) I.add('archive_indexable', 'low', 'صفحهٔ آرشیو/برچسب/نویسنده قابل ایندکس', 'این صفحه‌ها معمولاً محتوای تکراری و کم‌ارزش‌اند.', u, { fix: 'noindex بگذار یا برای آن‌ها متن یکتا بنویس.', effort: 1 }); return; }
      if (w < thin) I.add('thin_content', type === 'article' ? 'high' : 'medium', 'محتوای کم (' + typeFa(type) + ')', w + ' واژه؛ حداقل پیشنهادی برای این نوع صفحه ' + thin + ' واژه است.', u, { fix: 'متن مفید و اختصاصی اضافه کن.', effort: 3 });
      else if (w < weak) I.add('weak_content', 'low', 'محتوای کمعمق (' + typeFa(type) + ')', w + ' واژه؛ برای رقابت بهتر است حدود ' + weak + ' واژه یا بیشتر باشد.', u, { fix: 'جزئیات، پرسش‌های متداول و مشخصات را کامل کن.', effort: 3 });

      if (w >= 100) {
        /* keyword stuffing + focus phrase presence */
        const cnt = new Map(); toks.forEach((t) => cnt.set(t, (cnt.get(t) || 0) + 1));
        const top = Array.from(cnt.entries()).filter(([t]) => t.length > 2).sort((a, b) => b[1] - a[1])[0];
        if (top && toks.length >= 100 && top[1] / toks.length > 0.045 && top[1] >= 8) I.add('keyword_stuffing', 'medium', 'تکرار بیش‌ازحد یک واژه', '«' + top[0] + '» ' + Math.round(top[1] / toks.length * 1000) / 10 + '٪ کل متن است.', u, { fix: 'از مترادف و جمله‌بندی طبیعی استفاده کن.', effort: 2 });
        const focus = Array.from(meta.titleToks).filter((t) => t.length > 2);
        if (focus.length >= 2) {
          const bt = meta.bodyToks, bc = new Set(bt);   // the H1 itself must not count as evidence
          const first = new Set(bt.slice(0, 120)), inBody = focus.filter((t) => bc.has(t)).length;
          if (inBody / focus.length < 0.34) I.add('title_not_in_content', 'medium', 'کلمه‌های عنوان در متن نیست', 'عنوان و متن دربارهٔ موضوعات متفاوتی‌اند؛ گوگل ممکن است عنوان را بازنویسی کند.', u, { fix: 'عنوان یا متن را هم‌موضوع کن.', effort: 2 });
          else if (type === 'article' && focus.filter((t) => first.has(t)).length === 0) I.add('focus_not_in_intro', 'low', 'موضوع اصلی در ۱۲۰ واژهٔ اول نیامده', 'مقدمه باید سریع به موضوع عنوان برسد.', u, { fix: 'جملهٔ اول را حاوی موضوع اصلی بنویس.', effort: 1 });
        }
      }
      /* headings */
      if (p.headings) {
        const h2 = p.headings.filter((h) => h.level === 2).length;
        if (type === 'article' && w >= 600 && h2 < 2) I.add('no_subheadings', 'medium', 'مقالهٔ بلند بدون زیرتیتر کافی', 'خواننده و گوگل ساختار نمی‌بینند.', u, { fix: 'هر ۲۰۰ تا ۳۰۰ واژه یک H2 با عبارت مرتبط بگذار.', effort: 2 });
        const emptyH = p.headings.filter((h) => !h.text).length; if (emptyH) I.add('empty_heading', 'low', 'تیتر خالی', emptyH + ' تیتر بدون متن.', u, { fix: 'تیتر خالی را حذف کن.', effort: 1 });
        if (p.h1 && p.title) { const a = new Set(F.tokens(p.title)), b = new Set(F.tokens(p.h1)); if (a.size && b.size && setJ(a, b) === 0) I.add('h1_title_mismatch', 'low', 'H1 و عنوان هیچ واژهٔ مشترکی ندارند', 'ناهماهنگی قصد صفحه را مبهم می‌کند.', u, { fix: 'H1 و title را هم‌موضوع کن.', effort: 1 }); }
      }
      /* readability (articles & pages only) */
      if ((type === 'article' || type === 'page') && w >= 150) { const r = F.readability(p.text); perPage[u].readability = r.score; if (r.ok && r.score < 50) I.add('hard_to_read', 'low', 'خوانایی ضعیف', r.notes.join(' '), u, { fix: 'جمله‌ها را کوتاه و پاراگراف‌ها را کوچک کن.', effort: 2 }); }
      /* text-to-code */
      if (p.htmlLength && p.htmlLength > 20000) { const ratio = p.text.length / p.htmlLength; perPage[u].textRatio = +ratio.toFixed(3); if (ratio < 0.06 && w >= thin) I.add('low_text_ratio', 'low', 'نسبت متن به کد خیلی کم', Math.round(ratio * 1000) / 10 + '٪؛ صفحه سنگین و متن کم است.', u, { fix: 'اسکریپت و سبک‌های اضافه را کم کن.', effort: 3 }); }
    });

    /* --- near-duplicate detection (SimHash → confirm with shingle Jaccard) --- */
    const cand = live.filter((p) => info.get(p.url).words >= 40 && info.get(p.url).type !== 'utility');
    const sh = cand.map((p) => F.simhash(info.get(p.url).bodyToks.length >= 5 ? info.get(p.url).bodyToks : F.tokens(p.text, { stop: false })));
    const dupPairs = []; const u1 = uf(cand.length);
    const buckets = new Map(); const bands = cand.length > 300;     // LSH-style bands for big sites
    const tryPair = (i, j) => {
      if (i === j) return; const a = cand[i], b = cand[j];
      if (a.canonical && T.urlKey(a.canonical) === T.urlKey(b.url)) return; if (b.canonical && T.urlKey(b.canonical) === T.urlKey(a.url)) return;
      const d = F.hamming(sh[i], sh[j]); if (d > 8) return;
      const jac = F.jaccardShingles(info.get(a.url).bodyToks, info.get(b.url).bodyToks, 3);
      if (jac >= 0.6) { dupPairs.push({ a: a.url, b: b.url, similarity: +jac.toFixed(2), exact: jac >= 0.9 || d === 0 }); u1.union(i, j); }
    };
    if (!bands) { for (let i = 0; i < cand.length; i++) for (let j = i + 1; j < cand.length; j++) if (sh[i] && sh[j]) tryPair(i, j); }
    else {                                                  // 9 bands × 7 bits: any pair within Hamming 8 shares at least one band (pigeonhole)
      const bits = (h, off) => { const w = off < 32 ? h[0] : h[1], o = off % 32; let v = (w >>> o) & 127; if (o > 25 && off < 32) v = ((w >>> o) | ((h[1] << (32 - o)) >>> 0)) & 127; return v; };
      cand.forEach((_, i) => { if (!sh[i]) return; for (let k = 0; k < 9; k++) { const key = k + ':' + bits(sh[i], k * 7); (buckets.get(key) || buckets.set(key, []).get(key)).push(i); } });
      const seen = new Set(); buckets.forEach((arr) => { if (arr.length > 250) return; for (let x = 0; x < arr.length; x++) for (let y = x + 1; y < arr.length; y++) { const k = arr[x] + '-' + arr[y]; if (seen.has(k)) continue; seen.add(k); tryPair(arr[x], arr[y]); } });
    }
    const dupGroups = new Map(); cand.forEach((p, i) => { const r = u1.find(i); if (!dupGroups.has(r)) dupGroups.set(r, []); dupGroups.get(r).push(p.url); });
    const duplicates = [];
    dupGroups.forEach((urls) => {
      if (urls.length < 2) return; const pairs = dupPairs.filter((x) => urls.indexOf(x.a) >= 0);
      duplicates.push({ urls, exact: pairs.some((x) => x.exact), maxSimilarity: Math.max(...pairs.map((x) => x.similarity)) });
      urls.forEach((u) => {
        const mine = pairs.filter((x) => x.a === u || x.b === u), exact = mine.some((x) => x.exact), minSim = Math.min(...mine.map((x) => x.similarity));
        I.add(exact ? 'duplicate_content' : 'near_duplicate', exact ? 'high' : 'medium', exact ? 'محتوای کاملاً تکراری' : 'محتوای نزدیک به تکراری', 'با ' + mine.length + ' صفحهٔ دیگر تا ' + Math.round(Math.max(...mine.map((x) => x.similarity)) * 100) + '٪ مشابه است.', u, { fix: 'یکی را نگه دار؛ بقیه را ادغام، canonical یا بازنویسی کن.', effort: 3 });
      });
    });

    /* --- shared (boilerplate / manufacturer-copied) paragraphs --- */
    const paraMap = new Map();
    live.forEach((p) => { if (info.get(p.url).type === 'utility') return; const seen = new Set(); p.text.split('\n').forEach((line) => { const nw = F.rawTokens(line).length; if (nw < 25) return; const h = hashStr(F.tokens(line, { stop: false }).join(' ')); if (seen.has(h)) return; seen.add(h); (paraMap.get(h) || paraMap.set(h, []).get(h)).push({ url: p.url, words: nw }); }); });
    const sharedWords = new Map();
    paraMap.forEach((arr) => { if (arr.length >= 3) arr.forEach((x) => sharedWords.set(x.url, (sharedWords.get(x.url) || 0) + x.words)); });
    sharedWords.forEach((sw, u) => { const w = info.get(u).words; if (w && sw / w >= 0.5 && sw >= 60) I.add('shared_paragraphs', 'medium', 'بیش از نیمی از متن در چند صفحهٔ دیگر هم تکرار شده', Math.round(sw / w * 100) + '٪ از متن (پاراگراف‌های بلند مشترک بین ≥۳ صفحه).', u, { fix: 'توضیحات اختصاصی بنویس؛ متن سازنده/کپی‌شده را کم کن.', effort: 3 }); });

    /* --- keyword cannibalization: same-type pages with overlapping title/H1 topic AND similar body vectors --- */
    const pool = live.filter((p) => idxOK(p) && ['product', 'article', 'category', 'page'].indexOf(info.get(p.url).type) >= 0 && info.get(p.url).titleToks.size >= 2 && info.get(p.url).words >= 80);
    const u2 = uf(pool.length), edges = [];
    for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
      const A = info.get(pool[i].url), B = info.get(pool[j].url); if (A.type !== B.type) continue;
      const tj = setJ(A.titleToks, B.titleToks); if (tj < 0.6) continue;
      const cs = corpus.cosine(pool[i].url, pool[j].url); if (cs < 0.3) continue;
      if (type_isVariant(pool[i], pool[j])) continue;
      u2.union(i, j); edges.push({ a: pool[i].url, b: pool[j].url, titleOverlap: +tj.toFixed(2), contentSimilarity: +cs.toFixed(2) });
    }
    const cg = new Map(); pool.forEach((p, i) => { const r = u2.find(i); (cg.get(r) || cg.set(r, []).get(r)).push(p); });
    const cannibalization = [];
    cg.forEach((arr) => {
      if (arr.length < 2) return; const urls = arr.map((p) => p.url);
      const rank = arr.map((p) => ({ url: p.url, score: p.words + (T.urlKey(p.url).length < 60 ? 10 : 0) })).sort((a, b) => b.score - a.score);
      const keep = rank[0].url, shared = sharedTerms(arr.map((p) => info.get(p.url).titleToks));
      cannibalization.push({ topic: shared.join(' '), keep, others: urls.filter((u) => u !== keep), type: info.get(keep).type, pages: urls.length });
      urls.forEach((u) => I.add('cannibalization', arr.length > 2 ? 'high' : 'medium', 'کانیبالیزیشن (چند صفحه برای یک موضوع)', 'این صفحه با ' + (arr.length - 1) + ' صفحهٔ دیگر برای «' + shared.join(' ') + '» رقابت می‌کند؛ پیشنهاد: ' + (u === keep ? 'این صفحه را نگه دار و تقویت کن' : 'ادغام در ' + keep + ' یا متمایزسازی قصد صفحه') + '.', u, { fix: 'صفحهٔ ضعیف‌تر را در صفحهٔ قوی‌تر ادغام و ۳۰۱ کن، یا قصد جستجوی هر کدام را جدا کن.', effort: 3 }));
    });

    /* --- per-type content stats --- */
    const byType = {};
    live.forEach((p) => { const t = info.get(p.url).type; const b = byType[t] || (byType[t] = { pages: 0, words: [] }); b.pages++; b.words.push(p.words); });
    Object.keys(byType).forEach((t) => { const ws = byType[t].words.sort((a, b) => a - b); byType[t] = { pages: byType[t].pages, medianWords: ws[Math.floor(ws.length / 2)] || 0 }; });

    const issues = I.list(), total = Math.max(1, live.length), W = { critical: 12, high: 7, medium: 3, low: 1 };
    let pen = 0; issues.forEach((i) => { pen += (W[i.severity] || 1) * (1 + 4 * Math.min(1, i.count / total)); });
    return { issues, score: Math.max(0, Math.round(100 - Math.min(100, pen * 1.2))), clusters: { cannibalization, duplicates, pairs: dupPairs, edges }, perPage, stats: { pages: live.length, byType } };
  }

  /* product variants such as «… ۲۵۰ گرمی» / «… ۵۰۰ گرمی» are intentional siblings, not cannibalization */
  function type_isVariant(a, b) {
    const x = F.rawTokens(a.title || ''), y = F.rawTokens(b.title || ''); const dx = x.filter((t) => y.indexOf(t) < 0), dy = y.filter((t) => x.indexOf(t) < 0);
    const num = (arr) => arr.length > 0 && arr.every((t) => /^\d+$|^(گرم|گرمی|کیلو|کیلویی|عدد|بسته|میلی|لیتر|لیتری|سانتی|متری|پک|سایز|رنگ)/.test(t));
    return num(dx) && num(dy) && (dx.length + dy.length) > 0;
  }
  function sharedTerms(sets) { const first = Array.from(sets[0]); return first.filter((t) => sets.every((s) => s.has(t))).slice(0, 6); }
  function typeFa(t) { return { home: 'صفحهٔ اصلی', product: 'محصول', category: 'دسته', article: 'مقاله', page: 'صفحه' }[t] || t; }

  return { audit, pageType, MIN_WORDS };
});
