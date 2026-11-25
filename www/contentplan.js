/* Site Inspector — contentplan.js (v1.43.0)
 * Phase 4: content calendar + brief + draft SKELETON for every keyword gap, with internal-link plan and a publish-readiness gate.
 * Never invents facts: skeletons contain structure and ⟦placeholders⟧ the owner must fill from real knowledge; a draft is not
 * "ready" while any placeholder remains. No AI, no API. UMD. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./fatext.js'), require('./contentaudit.js'));
  else root.ContentPlan = factory(root.FaText, root.ContentAudit);
})(typeof self !== 'undefined' ? self : this, function (F, C) {
  'use strict';
  const PH = '⟦', PH_END = '⟧';
  const TYPE_OF = { informational: 'article', commercial: 'article', transactional: 'category' };
  const SRC_W = { seed: 3, profile: 2, headings: 1 };
  const keyOf = (toks) => toks.slice().sort().join(' ');
  const jac = (a, b) => { const A = new Set(a), B = new Set(b); let i = 0; A.forEach((x) => { if (B.has(x)) i++; }); return i / (A.size + B.size - i || 1); };
  const ph = (hint) => PH + hint + PH_END;
  const dayIso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  function titleFor(kw, intent) {
    if (intent === 'transactional') return /خرید|\bbuy\b/i.test(kw) ? kw : 'خرید ' + kw;
    if (intent === 'commercial') return /مقایسه|بهترین|\bbest\b|\bvs\b/i.test(kw) ? kw : 'مقایسهٔ ' + kw;
    return /آموزش|راهنما|چیست|چگونه|\bhow\b|\bguide\b/i.test(kw) ? kw : 'راهنمای ' + kw;
  }
  function outlineFor(kw, intent) {
    if (intent === 'transactional') return [
      { h: 'معرفی ' + kw, hint: 'یک تا دو جملهٔ واقعی دربارهٔ این دسته؛ کلمهٔ هدف در ۱۰۰ واژهٔ اول' },
      { h: 'فهرست ' + kw, hint: 'محصولات واقعی فروشگاه با لینک' },
      { h: 'راهنمای انتخاب ' + kw, hint: 'معیارهایی که تجربهٔ واقعی تو نشان می‌دهد' },
      { h: 'ارسال، پرداخت و بازگشت کالا', hint: 'قوانین واقعی فروشگاه خودت' }];
    if (intent === 'commercial') return [
      { h: 'مقدمه', hint: 'مسئلهٔ خواننده و کلمهٔ هدف در ۱۰۰ واژهٔ اول' },
      { h: 'معیارهای مقایسهٔ ' + kw, hint: 'معیارهای واقعی و قابل‌اندازه‌گیری' },
      { h: 'جدول مقایسه', hint: 'داده‌های واقعی هر گزینه (قیمت، مشخصات)' },
      { h: 'کدام گزینه برای چه کسی مناسب است؟', hint: 'نتیجه‌گیری مبتنی بر تجربه یا داده' }];
    return [
      { h: 'مقدمه', hint: 'مسئلهٔ خواننده و کلمهٔ هدف در ۱۰۰ واژهٔ اول' },
      { h: kw + ' چیست؟', hint: 'تعریف روشن و درست' },
      { h: 'نکته‌های مهم دربارهٔ ' + kw, hint: 'نکته‌های عملی از تجربهٔ واقعی' },
      { h: 'مراحل یا روش کار', hint: 'گام‌های واقعی، به ترتیب' }];
  }
  const faqFor = (kw) => [kw + ' چیست؟', 'چگونه ' + kw + ' را انتخاب کنیم؟', 'رایج‌ترین اشتباه دربارهٔ ' + kw + ' چیست؟'];

  function related(kwToks, rows, selfKey) {
    return rows.filter((r) => r.keyword && r.key !== selfKey).map((r) => ({ r, s: jac(kwToks, F.tokens(r.keyword)) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.r);
  }
  function schedule(n, opts) {
    const per = Math.max(1, Math.min(5, opts.perWeek || 2)), days = (opts.days || [6, 1, 3, 4, 0]).slice(0, per), out = [];
    const d = new Date(opts.start ? opts.start + 'T00:00:00' : Date.now()); d.setHours(0, 0, 0, 0);
    while (out.length < n) { if (days.indexOf(d.getDay()) >= 0) out.push(dayIso(d)); d.setDate(d.getDate() + 1); if (out.length === 0 && d.getFullYear() > 2100) break; }
    return out;
  }

  function plan(keymap, profile, opts) {
    opts = opts || {}; const gaps = (keymap && keymap.gaps) || [], rows = (keymap && keymap.pages) || [], shop = profile && profile.kind === 'shop';
    const cand = gaps.map((g) => { const toks = F.tokens(g.topic), key = keyOf(toks); return { g, toks, key, w: (SRC_W[g.source] || 0) + (shop && g.intent === 'transactional' ? 1 : 0) }; })
      .filter((c) => c.toks.length).sort((a, b) => b.w - a.w).slice(0, opts.max || 12);
    const dates = schedule(cand.length, opts);
    return cand.map((c, i) => {
      const kw = c.g.topic, intent = c.g.intent, type = TYPE_OF[intent] || 'article', rel = related(c.toks, rows, c.key);
      return { id: 'plan:' + c.key, keyword: kw, intent, type, source: c.g.source, title: titleFor(kw, intent), date: dates[i], minWords: (C.MIN_WORDS[type] || [300])[0], outline: outlineFor(kw, intent), faq: faqFor(kw),
        linksOut: rel.map((r) => ({ url: r.url, anchor: r.keyword })), linksIn: rel.slice(0, 2).map((r) => ({ from: r.url, anchor: kw })), status: 'planned' };
    });
  }

  function skeleton(brief, facts) {
    const L = ['# ' + brief.title, '', ph('مقدمه: مسئلهٔ خواننده را بنویس و «' + brief.keyword + '» را در ۱۰۰ واژهٔ اول بیاور'), ''];
    (facts || []).filter(Boolean).forEach((f, i) => { if (i === 0) L.push('<!-- حقایق ارائه‌شده توسط مالک -->'); L.push('- ' + String(f).trim()); });
    if ((facts || []).filter(Boolean).length) L.push('');
    brief.outline.filter((s) => s.h !== 'مقدمه').forEach((s) => { L.push('## ' + s.h, '', ph(s.hint), ''); });
    L.push('## پرسش‌های متداول', ''); brief.faq.forEach((q) => { L.push('### ' + q, '', ph('پاسخ واقعی و کوتاه'), ''); });
    if (brief.linksOut.length) { L.push('## بیشتر بخوانید', ''); brief.linksOut.forEach((l) => L.push('- [' + l.anchor + '](' + l.url + ')')); }
    const md = L.join('\n'); return { markdown: md, placeholders: (md.match(new RegExp(PH, 'g')) || []).length };
  }

  function check(draft, brief) {
    const raw = String(draft || ''), problems = [];
    const firstLine = (raw.split('\n').find((l) => /^#\s|<h1/i.test(l)) || ''), kwToks = F.tokens(brief.keyword);
    const text = raw.replace(/<[^>]+>/g, ' ').replace(/^#+\s*/gm, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'), body = text.replace(new RegExp(PH + '[^' + PH_END + ']*' + PH_END, 'g'), ' ');
    const words = F.rawTokens(body).length, toks = F.tokens(body), set = (a) => new Set(a), has = (s) => kwToks.every((t) => s.has(t));
    const phCount = (raw.match(new RegExp(PH, 'g')) || []).length;
    if (!has(set(F.tokens(firstLine)))) problems.push('کلمهٔ هدف در H1 نیست');
    if (!has(set(toks.slice(0, 100)))) problems.push('کلمهٔ هدف در ۱۰۰ واژهٔ اول نیست');
    if (words < brief.minWords) problems.push('متن کوتاه است (' + words + ' از حداقل ' + brief.minWords + ' واژه)');
    if (phCount) problems.push(phCount + ' جای خالی ⟦…⟧ هنوز پر نشده');
    let hits = 0; for (let i = 0; i + kwToks.length <= toks.length; i++) { if (kwToks.every((t, j) => toks[i + j] === t)) hits++; }
    if (toks.length >= 100 && (hits * kwToks.length) / toks.length > 0.08) problems.push('تکرار بیش‌ازحد کلمهٔ هدف');
    return { ready: problems.length === 0, words, placeholders: phCount, problems };
  }
  return { plan, skeleton, check, schedule, titleFor, PH, PH_END };
});
