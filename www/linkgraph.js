/* Site Inspector — linkgraph.js (v1.39.0)
 * Internal link graph: PageRank, anchor-text audit, weak/dead-end pages, link suggestions via TF-IDF. No AI, no API. UMD. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./fatext.js'), require('./techaudit.js'), require('./contentaudit.js'));
  else root.LinkGraph = factory(root.FaText, root.TechAudit, root.ContentAudit);
})(typeof self !== 'undefined' ? self : this, function (F, T, C) {
  'use strict';
  const GENERIC = /^(اینجا|این‌جا|همین‌جا|ادامه|ادامه مطلب|ادامه‌ی مطلب|بیشتر|بیشتر بخوانید|مشاهده|مشاهده بیشتر|کلیک کنید|کلیک|لینک|بخوانید|click here|here|read more|more|learn more|link|this|details|مشاهده جزئیات|جزئیات)$/i;
  const LINKABLE = { product: 1, category: 1, article: 1, page: 1 };

  function analyze(pages, opts) {
    opts = opts || {}; const I = T.mkIssues(), maxSug = opts.maxSuggestionsPerPage || 3;
    const live = pages.filter((p) => p.status === 200);
    const byKey = new Map(); pages.forEach((p) => { byKey.set(T.urlKey(p.url), p); if (p.requestedUrl) byKey.set(T.urlKey(p.requestedUrl), p); });
    const idx = new Map(); live.forEach((p, i) => idx.set(T.urlKey(p.url), i));
    const n = live.length, type = live.map((p) => C.pageType(p));
    const out = live.map(() => new Set()), inb = live.map(() => new Set()), anchors = live.map(() => []); // anchors[target] = [{from,text}]

    live.forEach((p, i) => {
      if (type[i] === 'utility') return;
      p.links.forEach((l) => {
        if (!l.internal) return; const k = T.urlKey(l.href), t = byKey.get(k); if (!t) return;
        const j = idx.get(T.urlKey(t.url)); if (j == null || j === i) return;
        const follow = !/nofollow/.test(l.rel);
        if (follow) { out[i].add(j); inb[j].add(i); }
        anchors[j].push({ from: i, text: (l.text || '').trim(), follow });
      });
    });

    /* PageRank */
    const d = 0.85; let pr = new Array(n).fill(1 / Math.max(1, n));
    for (let it = 0; it < 40; it++) {
      const nx = new Array(n).fill((1 - d) / Math.max(1, n)); let dang = 0;
      for (let i = 0; i < n; i++) { if (!out[i].size) dang += pr[i]; else { const s = d * pr[i] / out[i].size; out[i].forEach((j) => { nx[j] += s; }); } }
      const add = d * dang / Math.max(1, n); let diff = 0;
      for (let i = 0; i < n; i++) { nx[i] += add; diff += Math.abs(nx[i] - pr[i]); } pr = nx; if (diff < 1e-9) break;
    }
    const maxPr = Math.max(...pr, 1e-12), score = pr.map((x) => Math.round(x / maxPr * 100));
    const rank = {}; live.forEach((p, i) => { rank[p.url] = { pr: score[i], inbound: inb[i].size, outbound: out[i].size, type: type[i] }; });

    /* page-level issues */
    live.forEach((p, i) => {
      const u = p.url, t = type[i], home = t === 'home';
      if (p.noindex || t === 'utility') return;
      if (!out[i].size && !p.nofollow && p.words > 30) I.add('dead_end', 'medium', 'صفحهٔ بن‌بست (هیچ لینک داخلی خروجی ندارد)', 'کاربر و خزنده نمی‌توانند ادامه دهند و قدرت لینک هدر می‌رود.', u, { fix: 'لینک به صفحات مرتبط (دسته، محصول و مقالهٔ هم‌موضوع) اضافه کن.', effort: 1 });
      if (out[i].size > 150) I.add('too_many_links', 'low', 'بیش از ۱۵۰ لینک داخلی در یک صفحه', out[i].size + ' لینک؛ قدرت هر لینک رقیق می‌شود.', u, { fix: 'لینک‌های کم‌اهمیت منو/فوتر را کم کن.', effort: 2 });
      if (!home && LINKABLE[t] && inb[i].size <= 1 && n > 5) I.add(inb[i].size === 0 ? 'no_inbound' : 'weak_inbound', inb[i].size === 0 ? 'high' : 'medium', inb[i].size === 0 ? 'هیچ لینک داخلی ورودی ندارد' : 'فقط یک لینک داخلی ورودی دارد', 'گوگل ارزش کمی برای صفحه قائل می‌شود.', u, { fix: 'از صفحات پربازدید یا هم‌موضوع لینک بده.', effort: 1 });
      /* anchors pointing to this page */
      const a = anchors[i].filter((x) => x.follow);
      const gen = a.filter((x) => GENERIC.test(x.text)), empty = a.filter((x) => !x.text);
      if (empty.length) I.add('anchor_empty', 'low', 'لینک بدون متن (anchor خالی)', empty.length + ' لینک بدون متن یا alt به این صفحه می‌رود.', u, { fix: 'متن توصیفی یا alt تصویر بگذار.', effort: 1 });
      if (a.length >= 3 && gen.length / a.length >= 0.5) I.add('anchor_generic', 'low', 'بیشتر لینک‌های ورودی anchor عمومی دارند', gen.length + ' از ' + a.length + ' لینک «اینجا/ادامه/بیشتر» است.', u, { fix: 'از عبارت توصیفی مرتبط با موضوع صفحه استفاده کن.', effort: 1 });
      const named = a.filter((x) => x.text && !GENERIC.test(x.text)); const freq = new Map(); named.forEach((x) => { const k = F.normalize(x.text).toLowerCase(); freq.set(k, (freq.get(k) || 0) + 1); });
      const top = Array.from(freq.entries()).sort((x, y) => y[1] - x[1])[0];
      if (top && named.length >= 6 && top[1] / named.length >= 0.8 && new Set(named.map((x) => x.from)).size >= 5) I.add('anchor_overoptimized', 'low', 'anchor دقیق تکراری', '«' + top[0] + '» در ' + top[1] + ' از ' + named.length + ' لینک ورودی؛ تنوع طبیعی کمتر است.', u, { fix: 'از متن‌های متنوع و طبیعی استفاده کن.', effort: 1 });
    });
    /* equity leaking into noindex / errors */
    pages.forEach((t) => {
      if (t.status === 200 && !t.noindex) return; const k = T.urlKey(t.url); let ins = 0;
      live.forEach((p, i) => { if (p === t || type[i] === 'utility') return; if (p.links.some((l) => l.internal && !/nofollow/.test(l.rel) && T.urlKey(l.href) === k)) ins++; });
      if (ins >= 5 && t.status === 200) I.add('equity_to_noindex', 'low', 'لینک‌های داخلی زیاد به صفحهٔ noindex', ins + ' صفحه به آن لینک می‌دهند؛ قدرت لینک هدر می‌رود.', t.url, { fix: 'لینک‌ها را به صفحهٔ قابل‌ایندکس ببر یا nofollow کن.', effort: 2 });
    });

    /* suggestions (TF-IDF cosine; skip pairs already linked) */
    const corpus = F.buildCorpus(live.map((p) => ({ id: p.url, text: p.text })));
    const inv = new Map(); live.forEach((p, i) => corpus.topTerms(p.url, 8).forEach((x) => { (inv.get(x.term) || inv.set(x.term, []).get(x.term)).push(i); }));
    const suggestions = [];
    live.forEach((A, i) => {
      if (!LINKABLE[type[i]] || A.noindex || A.words < 80 || out[i].size >= 60) return;
      const cand = new Map();
      corpus.topTerms(A.url, 8).forEach((x) => { const arr = inv.get(x.term) || []; if (arr.length <= 120) arr.forEach((j) => { if (j !== i) cand.set(j, 1); }); });
      const aText = F.normalize(A.text).toLowerCase(), list = [];
      cand.forEach((_, j) => {
        const B = live[j]; if (!LINKABLE[type[j]] || B.noindex || out[i].has(j) || T.urlKey(B.canonical || B.url) !== T.urlKey(B.url)) return;
        const cs = corpus.cosine(A.url, B.url); if (cs < (opts.minSimilarity || 0.22)) return;
        const need = 1 / (1 + inb[j].size);                         // pages with few inbound links benefit most
        const phrase = [B.h1, B.title].map((s) => (s || '').trim()).filter((s) => s.length >= 6 && s.length <= 70).find((s) => aText.indexOf(F.normalize(s).toLowerCase()) >= 0);
        list.push({ from: A.url, to: B.url, anchor: phrase || (B.h1 || B.title || '').trim(), inText: !!phrase, similarity: +cs.toFixed(2), score: +(cs * (1 + need) * (phrase ? 1.25 : 1)).toFixed(3), reason: inb[j].size === 0 ? 'صفحهٔ هدف هیچ لینک ورودی ندارد' : 'هم‌موضوع (شباهت ' + Math.round(cs * 100) + '٪)' });
      });
      list.sort((x, y) => y.score - x.score).slice(0, maxSug).forEach((s) => suggestions.push(s));
    });
    suggestions.sort((x, y) => y.score - x.score);
    const sugTargets = new Set(suggestions.map((s) => s.to));
    live.forEach((p, i) => { if (inb[i].size === 0 && LINKABLE[type[i]] && !p.noindex && type[i] !== 'home' && !sugTargets.has(p.url) && n > 5) I.add('no_link_candidates', 'low', 'صفحهٔ بدون ورودی که صفحهٔ هم‌موضوع مناسبی برایش پیدا نشد', 'باید از منو/دسته یا صفحه‌ای دستی لینک شود.', p.url, { fix: 'از منو یا دستهٔ مرتبط لینک بده.', effort: 1 }); });

    const order = live.map((p, i) => ({ url: p.url, pr: score[i], inbound: inb[i].size, outbound: out[i].size, type: type[i] }));
    const issues = I.list(), W = { critical: 12, high: 7, medium: 3, low: 1 }; let pen = 0; issues.forEach((x) => { pen += (W[x.severity] || 1) * (1 + 4 * Math.min(1, x.count / Math.max(1, n))); });
    return { issues, score: Math.max(0, Math.round(100 - Math.min(100, pen * 1.2))), rank, suggestions, top: order.slice().sort((a, b) => b.pr - a.pr).slice(0, 10), weakest: order.filter((o) => LINKABLE[o.type]).sort((a, b) => a.pr - b.pr).slice(0, 10), stats: { pages: n, edges: out.reduce((s, x) => s + x.size, 0), avgOutbound: +(out.reduce((s, x) => s + x.size, 0) / Math.max(1, n)).toFixed(1) } };
  }
  return { analyze, GENERIC };
});
