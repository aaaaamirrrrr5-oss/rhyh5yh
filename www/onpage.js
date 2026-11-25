/* Site Inspector — onpage.js (v1.42.0)
 * Phase 3 on-page optimizer: title / meta description / focus keyword / H1 / intro checks and ready proposals per page,
 * driven by the keyword map. Proposals are built ONLY from the page's own text + the chosen keyword (no invented facts, no claims).
 * Tiers: AUTO (fill an empty field) / APPROVE (replace a non-empty one) / REVIEW (H1, structural). No AI, no API. UMD. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./fatext.js'), require('./seopolicy.js'));
  else root.OnPage = factory(root.FaText, root.SI && root.SI.SeoPolicy);
})(typeof self !== 'undefined' ? self : this, function (F, Policy) {
  'use strict';
  const TITLE = { min: Policy ? Policy.LIMITS.title.min : 20, max: Policy ? Policy.LIMITS.title.target : 60 }, META = { min: Policy ? Policy.LIMITS.meta.min : 70, max: Policy ? Policy.LIMITS.meta.max : 160, target: Policy ? Policy.LIMITS.meta.target : 155 };
  const len = (s) => Array.from(String(s || '')).length;
  const sp = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const firstSeg = (t) => sp(String(t || '').split(/\s*[|–—•·»«]\s*|\s+-\s+/)[0]);
  const norm = (s) => F.tokens(s).join(' ');
  const hasKw = (text, kwToks) => { if (!kwToks.length) return true; const set = new Set(F.tokens(text)); return kwToks.every((t) => set.has(t)); };
  function cut(s, max) {
    s = sp(s); if (len(s) <= max) return s;
    let c = Array.from(s).slice(0, max).join(''); const i = c.lastIndexOf(' '); if (i > max * 0.6) c = c.slice(0, i);
    return c.replace(/[\s،,:;؛\-–|]+$/, '');
  }
  function detectBrand(pages) {
    const cnt = new Map(), live = pages.filter((p) => p && p.status === 200 && p.title);
    live.forEach((p) => { const parts = String(p.title).split(/\s*[|–—•·»«]\s*|\s+-\s+/).map(sp); if (parts.length > 1) { const b = parts[parts.length - 1]; if (b && len(b) <= 30) cnt.set(b, (cnt.get(b) || 0) + 1); } });
    const top = Array.from(cnt.entries()).sort((a, b) => b[1] - a[1])[0];
    return top && top[1] >= 3 && top[1] / Math.max(1, live.length) >= 0.5 ? top[0] : '';
  }
  function metaFrom(page, kwToks) {
    const ss = F.splitSentences(page.text || '').map(sp).filter((s) => len(s) >= 40 && len(s) <= 220 && !/https?:|www\.|کلیک|\bclick\b/i.test(s));
    if (!ss.length) return '';
    const i = Math.max(0, ss.findIndex((s) => hasKw(s, kwToks)));
    let m = ss[i]; if (len(m) < META.min && ss[i + 1]) m += ' ' + ss[i + 1];
    return cut(m, META.target);
  }
  function titleFrom(page, keyword, kwToks, brand) {
    const base = firstSeg(page.title) || sp(page.h1); if (!base && !keyword) return '';
    let core = base && hasKw(base, kwToks) ? base : (keyword && base ? keyword + ' | ' + base : keyword || base);
    if (brand && !core.includes(brand) && len(core) + 3 + len(brand) <= TITLE.max) core += ' | ' + brand;
    return len(core) > TITLE.max ? cut(core, TITLE.max) : core;
  }
  const ISSUES = {
    title_missing: ['high', 'عنوان سئو (title) ندارد'], title_long: ['medium', 'عنوان بیش از ۶۰ نویسه است'], title_short: ['low', 'عنوان کوتاه‌تر از ۲۵ نویسه است'],
    title_no_kw: ['medium', 'کلمهٔ هدف در عنوان نیست'], title_dup: ['high', 'عنوان با صفحهٔ دیگری یکی است'],
    meta_missing: ['medium', 'توضیح متا (meta description) ندارد'], meta_long: ['low', 'توضیح متا بیش از ۱۶۰ نویسه است'], meta_short: ['low', 'توضیح متا کوتاه‌تر از ۷۰ نویسه است'],
    meta_no_kw: ['low', 'کلمهٔ هدف در توضیح متا نیست'], meta_dup: ['medium', 'توضیح متا با صفحهٔ دیگری یکی است'],
    h1_missing: ['high', 'H1 ندارد'], h1_multiple: ['medium', 'بیش از یک H1 دارد'], h1_no_kw: ['medium', 'کلمهٔ هدف در H1 نیست'], intro_no_kw: ['low', 'کلمهٔ هدف در ۱۰۰ واژهٔ اول متن نیست'],
  };

  function analyze(pages, keymap, opts) {
    opts = opts || {}; const brand = opts.brand != null ? opts.brand : detectBrand(pages || []);
    const rows = new Map(((keymap && keymap.pages) || []).map((r) => [r.url, r]));
    const live = (pages || []).filter((p) => p && p.status === 200 && rows.has(p.url) && rows.get(p.url).keyword);
    const tCount = new Map(), mCount = new Map();
    live.forEach((p) => { const t = norm(p.title), m = norm(p.description); if (t) tCount.set(t, (tCount.get(t) || 0) + 1); if (m) mCount.set(m, (mCount.get(m) || 0) + 1); });
    const taken = new Set([...tCount.keys()]), takenM = new Set([...mCount.keys()]);
    const items = [], totals = {};
    live.slice(0, opts.max || 600).forEach((p) => {
      const r = rows.get(p.url), kwToks = F.tokens(r.keyword), codes = [], proposals = [];
      const title = sp(p.title), meta = sp(p.description), h1s = (p.headings || []).filter((h) => h.level === 1);
      if (!title) codes.push('title_missing'); else {
        if (len(title) > TITLE.max) codes.push('title_long'); else if (len(title) < TITLE.min) codes.push('title_short');
        if (!hasKw(title, kwToks)) codes.push('title_no_kw'); if (tCount.get(norm(title)) > 1) codes.push('title_dup');
      }
      if (!meta) codes.push('meta_missing'); else {
        if (len(meta) > META.max) codes.push('meta_long'); else if (len(meta) < META.min) codes.push('meta_short');
        if (!hasKw(meta, kwToks)) codes.push('meta_no_kw'); if (mCount.get(norm(meta)) > 1) codes.push('meta_dup');
      }
      if (!sp(p.h1) && !h1s.length) codes.push('h1_missing'); else { if (h1s.length > 1) codes.push('h1_multiple'); if (!hasKw(p.h1 || (h1s[0] && h1s[0].text), kwToks)) codes.push('h1_no_kw'); }
      if (p.words >= 100) { const intro = new Set(F.tokens(p.text || '').slice(0, 100)); if (!kwToks.every((t) => intro.has(t))) codes.push('intro_no_kw'); }

      const titleBad = codes.some((c) => c.indexOf('title_') === 0), metaBad = codes.some((c) => c.indexOf('meta_') === 0);
      const skip = [];
      if (titleBad) { const v = titleFrom(p, r.keyword, kwToks, brand), nv = norm(v);
        if (!v || nv === norm(title)) skip.push('عنوان بهتری از داده‌های صفحه ساخته نشد.');
        else if (taken.has(nv) && nv !== norm(title)) skip.push('عنوان پیشنهادی با صفحهٔ دیگری یکی می‌شود؛ باید متمایزتر شود.');
        else { taken.add(nv); proposals.push({ field: 'seo_title', current: title, proposed: v, tier: title ? 'approve' : 'auto', why: codes.filter((c) => c.indexOf('title_') === 0).map((c) => ISSUES[c][1]).join('، ') }); } }
      if (metaBad) { const v = metaFrom(p, kwToks), nv = norm(v);
        if (!v || nv === norm(meta)) skip.push('جملهٔ مناسب برای توضیح متا در متن صفحه پیدا نشد.');
        else if (takenM.has(nv) && nv !== norm(meta)) skip.push('توضیح متای پیشنهادی تکراری است.');
        else { takenM.add(nv); proposals.push({ field: 'meta_description', current: meta, proposed: v, tier: meta ? 'approve' : 'auto', why: codes.filter((c) => c.indexOf('meta_') === 0).map((c) => ISSUES[c][1]).join('، ') }); } }
      if (r.keyword) proposals.push({ field: 'focus_keyword', current: '', proposed: r.keyword, tier: 'auto', why: 'کلمهٔ هدف از نقشهٔ کلمات' });
      if (codes.indexOf('h1_no_kw') >= 0 || codes.indexOf('h1_missing') >= 0) { const base = firstSeg(p.title); if (base && hasKw(base, kwToks) && norm(base) !== norm(p.h1)) proposals.push({ field: 'h1', current: sp(p.h1), proposed: base, tier: 'review', why: 'H1 باید کلمهٔ هدف را داشته باشد' }); }
      codes.forEach((c) => { totals[c] = totals[c] || { count: 0, urls: [] }; totals[c].count++; if (totals[c].urls.length < 20) totals[c].urls.push(p.url); });
      if (codes.length || proposals.some((x) => x.field !== 'focus_keyword')) items.push({ url: p.url, keyword: r.keyword, intent: r.intent, codes, proposals, skipped: skip });
    });
    const issues = Object.keys(totals).map((c) => ({ code: c, severity: ISSUES[c][0], title: ISSUES[c][1], count: totals[c].count, urls: totals[c].urls }));
    return { at: new Date().toISOString(), brand, items, issues, stats: { checked: live.length, withIssues: items.filter((i) => i.codes.length).length, proposals: items.reduce((s, i) => s + i.proposals.length, 0) } };
  }

  /* owner decisions + export for the Repair engine (only allowed fields; H1 is never exported) */
  function decide(project, url, field, verdict) {
    if (['accepted', 'rejected', 'pending'].indexOf(verdict) < 0) throw new Error('تصمیم نامعتبر');
    project.decisions = project.decisions || {}; if (verdict === 'pending') delete project.decisions[url + '#' + field]; else project.decisions[url + '#' + field] = verdict; return project;
  }
  function plan(project, opts) {
    opts = opts || {}; const out = [], dec = project.decisions || {}, ok = ['seo_title', 'meta_description', 'focus_keyword'];
    ((project.onpage && project.onpage.items) || []).forEach((it) => {
      const fields = {}, tiers = {};
      it.proposals.forEach((p) => { if (ok.indexOf(p.field) < 0) return; const d = dec[it.url + '#' + p.field]; if (d === 'rejected') return; if (p.tier === 'auto' ? opts.auto !== false : d === 'accepted') { fields[p.field] = p.proposed; tiers[p.field] = p.tier; } });
      const gd = opts.guard ? opts.guard(it.url) : null;
      if (gd && gd.locked) ['seo_title', 'meta_description'].forEach((k) => { if (fields[k] && tiers[k] !== 'auto') { delete fields[k]; delete tiers[k]; } });
      if (Object.keys(fields).length) out.push({ url: it.url, fields, tiers, locked: !!(gd && gd.locked) });
    });
    return out;
  }
  return { analyze, decide, plan, detectBrand, ISSUES, TITLE, META };
});
