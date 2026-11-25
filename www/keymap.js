/* Site Inspector — keymap.js (v1.41.0)
 * Keyword map: one target keyword + search intent per indexable page, cannibalization conflicts, content gaps.
 * No AI, no API. Uses only crawled text (title, H1, headings, slug, body) + what the owner typed. UMD. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./fatext.js'), require('./contentaudit.js'));
  else root.KeyMap = factory(root.FaText, root.ContentAudit);
})(typeof self !== 'undefined' ? self : this, function (F, C) {
  'use strict';
  const INTENT_FA = { informational: 'اطلاعاتی', commercial: 'مقایسه/بررسی', transactional: 'خرید', navigational: 'برند/ناوبری' };
  const RE = {
    transactional: /(خرید|قیمت|فروش|سفارش|ارزان|تخفیف|\b(buy|price|order|shop|sale|discount)\b)/i,
    commercial: /(بهترین|مقایسه|نقد و بررسی|بررسی|کدام|برترین|رتبه‌?بندی|\b(best|vs|review|top|compare)\b)/i,
    informational: /(آموزش|چیست|چگونه|راهنما|نحوه|روش|چرا|چطور|فواید|خواص|\b(how|what|guide|tutorial|why|tips)\b)/i,
  };
  const SKIP_TYPES = { utility: 1, archive: 1 };
  const slugOf = (url) => { try { return decodeURIComponent(new URL(url).pathname).replace(/[-_/+]+/g, ' '); } catch (e) { return ''; } };
  const firstSeg = (t) => { const s = String(t || '').split(/\s*[|–—•·»«]\s*|\s+-\s+/)[0].trim(); return s || String(t || ''); };
  const keyOf = (toks) => toks.slice().sort().join(' ');
  const contains = (arr, sub) => { if (!sub.length || sub.length > arr.length) return false; for (let i = 0; i + sub.length <= arr.length; i++) { let ok = true; for (let j = 0; j < sub.length; j++) if (arr[i + j] !== sub[j]) { ok = false; break; } if (ok) return true; } return false; };
  const count = (arr, sub) => { let c = 0; for (let i = 0; i + sub.length <= arr.length; i++) { let ok = true; for (let j = 0; j < sub.length; j++) if (arr[i + j] !== sub[j]) { ok = false; break; } if (ok) c++; } return c; };
  const jac = (a, b) => { const A = new Set(a), B = new Set(b); let i = 0; A.forEach((x) => { if (B.has(x)) i++; }); return i / (A.size + B.size - i || 1); };

  function intentOf(page, type) {
    if (type === 'home') return 'navigational';
    if (type === 'product') return 'transactional';
    if (type === 'category') return 'commercial';
    const s = (page.title || '') + ' ' + (page.h1 || '') + ' ' + slugOf(page.url);
    if (RE.transactional.test(s)) return 'transactional';
    if (RE.commercial.test(s)) return 'commercial';
    return 'informational';
  }

  function candidates(page) {
    const tTitle = F.tokens(firstSeg(page.title)), tH1 = F.tokens(page.h1 || ''), tSlug = F.tokens(slugOf(page.url));
    const body = F.tokens(String(page.text || '').slice(0, 12000)), intro = body.slice(0, 150);
    const h2 = (page.headings || []).filter((h) => h.level >= 2 && h.level <= 3).map((h) => F.tokens(h.text));
    const seen = new Map(), add = (toks, raw) => { if (!toks.length || toks.length > 4) return; const k = toks.join(' '); if (!seen.has(k)) seen.set(k, { toks, phrase: raw || toks.join(' ') }); };
    [tTitle, tH1].forEach((t) => { for (let n = 2; n <= 3; n++) for (let i = 0; i + n <= t.length; i++) add(t.slice(i, i + n)); if (t.length && t.length <= 2) add(t); });
    try { F.keyPhrases(page.text || '', 6).forEach((p) => add(F.tokens(p.phrase), p.phrase)); } catch (e) { /* ignore */ }
    const out = [];
    seen.forEach((c) => {
      const t = c.toks; let s = 0;
      if (contains(tTitle, t)) s += 4; if (contains(tH1, t)) s += 3; if (contains(tSlug, t)) s += 2; if (contains(intro, t)) s += 2;
      if (h2.some((h) => contains(h, t))) s += 1;
      s += Math.min(count(body, t), 6) * 0.5; if (t.length >= 2) s += 1; else s -= 1;
      out.push({ keyword: c.phrase, toks: t, key: keyOf(t), score: +s.toFixed(1) });
    });
    return out.sort((a, b) => b.score - a.score || b.toks.length - a.toks.length);
  }

  function build(pages, opts) {
    opts = opts || {}; const locked = opts.locked || {};
    const live = (pages || []).filter((p) => p && p.status === 200 && !p.noindex);
    const rows = [];
    live.forEach((p) => {
      const type = C.pageType(p); if (SKIP_TYPES[type]) return;
      const cands = candidates(p), lock = locked[p.url];
      let best = cands[0] || null;
      if (lock) { const toks = F.tokens(lock.keyword); best = { keyword: lock.keyword, toks, key: keyOf(toks), score: 99 }; }
      if (!best) { rows.push({ url: p.url, type, intent: intentOf(p, type), keyword: null, key: null, toks: [], alts: [], score: 0, confidence: 'low', locked: false, words: p.words || 0 }); return; }
      const intent = lock && lock.intent ? lock.intent : intentOf(p, type);
      rows.push({ url: p.url, type, intent, keyword: best.keyword, key: best.key, toks: best.toks, alts: cands.slice(1, 4).map((c) => ({ keyword: c.keyword, key: c.key, toks: c.toks, score: c.score })), score: best.score, confidence: lock ? 'high' : best.score >= 9 ? 'high' : best.score >= 6 ? 'medium' : 'low', locked: !!lock, words: p.words || 0 });
    });

    /* conflicts: same / near-same target keyword on different pages */
    const keyed = rows.filter((r) => r.toks.length), parent = keyed.map((_, i) => i);
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const inv = new Map(); keyed.forEach((r, i) => new Set(r.toks).forEach((t) => { if (!inv.has(t)) inv.set(t, []); inv.get(t).push(i); }));
    const tried = new Set();
    inv.forEach((ids) => { if (ids.length > 60) return; for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) { const i = ids[a], j = ids[b], k = i + ':' + j; if (tried.has(k)) continue; tried.add(k); const x = keyed[i], y = keyed[j]; if (x.key === y.key || (x.toks.length >= 2 && y.toks.length >= 2 && jac(x.toks, y.toks) >= 0.67)) parent[find(i)] = find(j); } });
    const groups = new Map(); keyed.forEach((r, i) => { const g = find(i); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(r); });
    const taken = new Set(rows.map((r) => r.key).filter(Boolean)); const conflicts = [];
    groups.forEach((g) => {
      if (g.length < 2) return;
      const pref = (r) => (r.intent === 'transactional' ? { product: 3, category: 2 } : r.intent === 'informational' ? { article: 3, page: 1 } : { category: 3, article: 2 })[r.type] || 0;
      const sorted = g.slice().sort((a, b) => pref(b) - pref(a) || b.words - a.words || b.score - a.score), win = sorted[0];
      const sameIntent = g.every((r) => r.intent === win.intent);
      const others = sorted.slice(1).map((r) => { const alt = r.alts.find((a) => !taken.has(a.key) && jac(a.toks, win.toks) < 0.5); if (alt) taken.add(alt.key); return { url: r.url, type: r.type, suggest: alt ? alt.keyword : null }; });
      conflicts.push({ keyword: win.keyword, intent: win.intent, winner: win.url, others, pages: g.length, action: sameIntent ? 'merge_or_differentiate' : 'differentiate', severity: sameIntent ? 'high' : 'medium' });
    });
    conflicts.sort((a, b) => b.pages - a.pages);

    /* gaps: topics (profile / seeds / repeated sub-headings) that no page targets */
    const targeted = rows.filter((r) => r.toks.length).map((r) => r.toks);
    const covered = (toks) => targeted.some((t) => toks.every((x) => t.indexOf(x) >= 0) || jac(t, toks) >= 0.75);
    const gaps = [], gapKeys = new Set();
    const addGap = (phrase, source) => { const toks = F.tokens(phrase); if (!toks.length || covered(toks)) return; const k = keyOf(toks); if (gapKeys.has(k)) return; gapKeys.add(k); gaps.push({ topic: phrase, source, intent: RE.transactional.test(phrase) ? 'transactional' : RE.commercial.test(phrase) ? 'commercial' : 'informational' }); };
    ((opts.profile && opts.profile.topTopics) || []).forEach((t) => addGap(t, 'profile'));
    (opts.seeds || []).forEach((t) => addGap(String(t), 'seed'));
    const hc = new Map();
    live.forEach((p) => { const seenP = new Set(); (p.headings || []).filter((h) => h.level === 2 || h.level === 3).forEach((h) => { const t = F.tokens(h.text); for (let i = 0; i + 2 <= t.length; i++) { const k = t.slice(i, i + 2).join(' '); if (!seenP.has(k)) { seenP.add(k); hc.set(k, (hc.get(k) || 0) + 1); } } }); });
    Array.from(hc.entries()).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k]) => addGap(k, 'headings'));

    const by = {}, conf = { high: 0, medium: 0, low: 0 }; rows.forEach((r) => { by[r.intent] = (by[r.intent] || 0) + 1; conf[r.confidence]++; });
    return { at: new Date().toISOString(), pages: rows.map((r) => ({ url: r.url, type: r.type, intent: r.intent, keyword: r.keyword, alts: r.alts.map((a) => a.keyword), confidence: r.confidence, locked: r.locked })), conflicts, gaps: gaps.slice(0, 20), stats: { mapped: rows.filter((r) => r.keyword).length, total: rows.length, byIntent: by, confidence: conf } };
  }

  function setKeyword(project, url, keyword, intent) {
    keyword = String(keyword || '').trim(); if (!keyword || !F.tokens(keyword).length) throw new Error('کلمهٔ کلیدی نامعتبر');
    if (intent && !INTENT_FA[intent]) throw new Error('نیت نامعتبر');
    project.lockedKeywords = project.lockedKeywords || {}; project.lockedKeywords[url] = { keyword, intent: intent || null };
    return project;
  }

  return { build, candidates, intentOf, setKeyword, INTENT_FA };
});
