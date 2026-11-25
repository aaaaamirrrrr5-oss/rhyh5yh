/* Site Inspector — articlegate.js (v1.81.0)  SI.ArticleGate
 * «دروازهٔ مقاله»: هیچ مقالهٔ خیلی ضعیف یا شبیه/تکراری نباید ذخیره (و در نتیجه منتشر) شود؛ چنین متنی «نگه‌داشته» می‌شود.
 *  - evaluate(draft, ctx)  : حکم یک پیش‌نویس → { verdict: ready | review | hold, score, reasons[], similar[], metrics }
 *  - auditSite(items, o)   : ممیزی همهٔ مقاله‌های سایت از روی فهرست (طول، شباهت به هم، عنوان/کلیدواژهٔ تکراری، متای خالی)
 *  - similarity / titleSimilarity : ابزار شباهت (شینگل ۴کلمه‌ای؛ بدون AI و بدون API)
 * Pure، بدون DOM، UMD. هیچ ادعایی دربارهٔ رتبه نمی‌کند؛ فقط ایرادهای قابل‌سنجش متن را گزارش می‌دهد. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { let P = null; try { P = require('./seopolicy.js'); } catch (e) {} module.exports = factory(require('./fatext.js'), P); }
  else { root.SI = root.SI || {}; root.SI.ArticleGate = factory(root.FaText || (root.SI && root.SI.FaText), root.SI && root.SI.SeoPolicy); }
})(typeof self !== 'undefined' ? self : this, function (F, Policy) {
  'use strict';
  const FA = '۰۱۲۳۴۵۶۷۸۹';
  const fa = (n) => String(n).replace(/\d/g, (d) => FA[d]);
  const LIMITS = {
    hardMinWords: 250, defaultMinWords: 600, shortSiteWords: 500,
    dupHold: 0.35, dupReview: 0.2,           // Jaccard شینگل‌های ۴کلمه‌ای (دو متن کامل)
    previewHold: 0.6, previewReview: 0.35,   // سهم شینگل‌های پیش‌نمایشِ مقالهٔ موجود که در پیش‌نویس هم هست
    repeatGramHold: 0.22, repeatGramReview: 0.12, repeatSentHold: 0.25, repeatSentReview: 0.12,
    ttrHold: 0.24, ttrReview: 0.32, titleSame: 0.85, titleNear: 0.6, holdScore: 45, readyScore: 75, previewCap: 500,
  };
  const HOLD_POLICY = new Set(['keyword_stuffing', 'fake_social_proof']); // فقط این‌ها خودکار «نگه‌دار» می‌شوند
  const FILLER = ['در این مقاله به بررسی', 'در این مطلب به بررسی', 'همان‌طور که گفته شد', 'همانطور که گفته شد', 'همان طور که گفته شد', 'امروزه', 'در دنیای امروز', 'به طور کلی', 'به‌طور کلی', 'لازم به ذکر است', 'نکتهٔ حائز اهمیت', 'نکته حائز اهمیت', 'بی‌شک', 'بدون شک', 'در ادامه خواهیم دید', 'همان‌گونه که می‌دانید', 'همانگونه که می‌دانید'];
  const NON_ARTICLE = new Set(['page', 'product', 'product_variation', 'attachment', 'nav_menu_item', 'wp_block', 'wp_template', 'wp_template_part', 'elementor_library', 'shop_order', 'shop_coupon', 'revision', 'custom_css', 'customize_changeset']);
  const isArticleType = (t) => !NON_ARTICLE.has(String(t || 'post').toLowerCase());
  const STATUS_FA = { publish: 'منتشرشده', draft: 'پیش‌نویس', pending: 'در انتظار بازبینی', future: 'زمان‌بندی‌شده', private: 'خصوصی' };

  const text = (html) => F.htmlToText(String(html == null ? '' : html));
  const raw = (s) => F.rawTokens(s);
  const normTitle = (s) => raw(s).join(' ');
  const squash = (s) => raw(s).join('').replace(/\u200c/g, ''); // «دم‌آوری» = «دم آوری» = «دمآوری» (فاصله/نیم‌فاصله نادیده)
  function shingleSet(s, k) { const out = new Set(); F.shingles(raw(s), k || 4).forEach((x) => out.add(x)); return out; }
  function jaccard(A, B) { if (!A.size || !B.size) return 0; let n = 0; const [S, L] = A.size < B.size ? [A, B] : [B, A]; S.forEach((x) => { if (L.has(x)) n++; }); return n / (A.size + B.size - n); }
  function containment(A, inB) { if (!A.size) return 0; let n = 0; A.forEach((x) => { if (inB.has(x)) n++; }); return n / A.size; } // سهم A که در B هست
  /** شباهت دو متن (۰..۱) با شینگل‌های ۴کلمه‌ای. */
  function similarity(a, b) { return jaccard(shingleSet(a), shingleSet(b)); }
  /** شباهت دو عنوان (ضریب Dice روی واژه‌های بدون اعراب/نیم‌فاصله). */
  function titleSimilarity(a, b) {
    if (squash(a) && squash(a) === squash(b)) return 1;
    const A = new Set(F.tokens(a, { stop: true, stem: true })), B = new Set(F.tokens(b, { stop: true, stem: true })); if (!A.size || !B.size) return 0;
    let n = 0; A.forEach((x) => { if (B.has(x)) n++; }); return (2 * n) / (A.size + B.size);
  }
  const kwNorm = (s) => raw(s).join(' ');

  function persianRatio(t) { const letters = (String(t).match(/[A-Za-z\u0600-\u06FF]/g) || []); if (!letters.length) return 0; return letters.filter((c) => /[\u0600-\u06FF]/.test(c)).length / letters.length; }

  /** معیارهای درونی متن (بدون مقایسه با سایر مقاله‌ها). */
  function metrics(html) {
    const t = text(html); const toks = raw(t); const words = toks.length;
    const sents = F.splitSentences(t); const seen = new Set(); let dup = 0; sents.forEach((s) => { const k = raw(s).join(' '); if (k.split(' ').length < 4) return; if (seen.has(k)) dup++; else seen.add(k); });
    const grams = F.shingles(toks, 4); const gset = new Set(grams); const repeatGrams = grams.length ? 1 - gset.size / grams.length : 0;
    const sample = F.tokens(t, { stop: false, stem: true }).slice(0, 500); const ttr = sample.length >= 120 ? new Set(sample).size / sample.length : null;
    const sentLens = sents.map((s) => raw(s).length); const avgSent = sentLens.length ? sentLens.reduce((a, b) => a + b, 0) / sentLens.length : 0;
    const h2 = (String(html).match(/<h2\b/gi) || []).length; const lead = (String(html).match(/<p\b[^>]*>([\s\S]*?)<\/p>/i) || [])[1]; const leadWords = lead ? raw(text(lead)).length : 0;
    const lt = ' ' + t.replace(/\s+/g, ' ') + ' '; let filler = 0; FILLER.forEach((f) => { let p = 0; while ((p = lt.indexOf(f, p)) !== -1) { filler++; p += f.length; } });
    return { words, sentences: sents.length, repeatSentRatio: sents.length ? dup / sents.length : 0, repeatGrams, ttr, avgSent: Math.round(avgSent * 10) / 10, h2, leadWords, filler, fillerPer1k: words ? Math.round((filler / words) * 10000) / 10 : 0, persian: persianRatio(t), placeholders: (String(html).match(/⟦[^⟧]*⟧/g) || []).length };
  }

  /**
   * حکم یک پیش‌نویس مقاله.
   * @param {{title:string, content:string, focus_keyword?:string, meta_description?:string}} draft
   * @param {{existing?:Array, batch?:Array, minWords?:number, selfId?:number, lang?:string, evidence?:string}} [ctx]
   * existing: آیتم‌های فهرست سایت { id, title, url, type, status, contentPreview, content?, words?, focusKeyword? }؛ batch: پیش‌نویس‌های هم‌دسته { title, content }
   */
  function evaluate(draft, ctx) {
    draft = draft || {}; ctx = ctx || {};
    const reasons = []; const add = (code, level, detail, pen) => reasons.push({ code, level, detail, pen: pen || 0 });
    const m = metrics(draft.content || ''); const title = String(draft.title || '').trim();
    const minWords = Math.max(LIMITS.hardMinWords, Number(ctx.minWords) || LIMITS.defaultMinWords);
    // ۱) ساختار و طول
    if (!title) add('no_title', 'hold', 'عنوان ندارد.', 40);
    if (m.words < LIMITS.hardMinWords) add('thin', 'hold', 'متن بسیار کوتاه است (' + fa(m.words) + ' واژه؛ حداقل ' + fa(LIMITS.hardMinWords) + ').', 45);
    else if (m.words < minWords) add('short', 'review', 'متن از حد انتظار کوتاه‌تر است (' + fa(m.words) + ' از ' + fa(minWords) + ' واژه).', 15);
    if (m.words >= 500 && m.h2 < 2) add('no_structure', 'review', 'مقالهٔ بلند بدون زیرتیتر (H2) کافی است؛ خواندن و اسکن آن سخت می‌شود.', 8);
    if (m.words >= 120 && m.leadWords < 25) add('weak_lead', 'review', 'پاراگراف آغازین کوتاه یا نامشخص است؛ پاسخ اصلی باید در ابتدای متن بیاید.', 5);
    if (m.placeholders) add('placeholders', 'hold', fa(m.placeholders) + ' جای‌خالی ⟦…⟧ هنوز پر نشده است.', 40);
    const lang = ctx.lang || 'fa';
    if (lang === 'fa' && m.words >= 40) { if (m.persian < 0.35) add('wrong_language', 'hold', 'متن عمدتاً فارسی نیست.', 40); else if (m.persian < 0.6) add('mixed_language', 'review', 'بخش زیادی از متن غیرفارسی است.', 8); }
    // ۲) تکرار و حشو
    if (m.words >= 120) {
      if (m.repeatGrams >= LIMITS.repeatGramHold || m.repeatSentRatio >= LIMITS.repeatSentHold) add('repetitive', 'hold', 'متن بیش از حد خودتکرار است (جمله‌ها/عبارت‌های تکراری)؛ شبیه پر کردن حجم است.', 35);
      else if (m.repeatGrams >= LIMITS.repeatGramReview || m.repeatSentRatio >= LIMITS.repeatSentReview) add('some_repetition', 'review', 'بخشی از جمله‌ها یا عبارت‌ها تکرار شده است.', 12);
      if (m.ttr != null) { if (m.ttr < LIMITS.ttrHold) add('low_diversity', 'hold', 'تنوع واژگان بسیار کم است (متن یک‌نواخت و کم‌محتوا).', 25); else if (m.ttr < LIMITS.ttrReview) add('low_diversity', 'review', 'تنوع واژگان پایین است.', 8); }
      if (m.fillerPer1k > 6) add('filler', 'review', 'عبارت‌های حشو و کلی‌گویی زیاد است (' + fa(m.filler) + ' مورد)؛ جمله‌ها را مشخص‌تر کنید.', 8);
      if (m.avgSent > 35) add('long_sentences', 'review', 'میانگین طول جمله زیاد است (' + fa(m.avgSent) + ' واژه)؛ جمله‌ها را کوتاه کنید.', 5);
    }
    // ۳) اصول گوگل (کلیدواژه‌چینی، ادعای بی‌پشتوانه…)
    if (Policy && Policy.auditContent && m.words >= 40) {
      try {
        const a = Policy.auditContent(draft.content || '', { focus: draft.focus_keyword || '', title, kind: 'article', evidence: ctx.evidence || '' });
        (a.blockers || []).filter((b) => b.code !== 'repeated_sentences').forEach((b) => { const hard = HOLD_POLICY.has(b.code); add('policy_' + b.code, hard ? 'hold' : 'review', b.detail, hard ? 30 : 10); }); // «بهترین» بی‌مدرک در مقالهٔ تحلیلی بازبینی می‌خواهد، نه توقف
        (a.warnings || []).filter((w) => !['thin', 'no_subheadings'].includes(w.code)).slice(0, 3).forEach((w) => add('policy_' + w.code, 'review', w.detail, 4));
      } catch (e) { /* بدون سیاست، بقیهٔ بررسی‌ها کافی است */ }
    }
    // ۴) شباهت به مقاله‌های موجود و هم‌دسته
    const similar = []; const D = shingleSet(text(draft.content || ''));
    const selfId = Number(ctx.selfId || 0); const dTitle = normTitle(title); const dKw = kwNorm(draft.focus_keyword || '');
    const pool = (Array.isArray(ctx.existing) ? ctx.existing : []).filter((x) => x && Number(x.id) !== selfId && (x.type == null || isArticleType(x.type)))
      .map((x) => ({ kind: 'existing', x })).concat((Array.isArray(ctx.batch) ? ctx.batch : []).filter(Boolean).map((x) => ({ kind: 'batch', x })));
    pool.forEach(({ kind, x }) => {
      const full = String(x.content || ''); const prev = String(x.contentPreview || x.excerpt || '');
      let sim = 0, basis = 'full';
      if (full && D.size) { sim = jaccard(D, shingleSet(text(full))); }
      else if (prev && D.size) { const P = shingleSet(text(prev)); if (P.size >= 8) { sim = containment(P, D); basis = 'preview'; } }
      const ts = title ? titleSimilarity(title, x.title || '') : 0; const sameTitle = !!dTitle && squash(title) === squash(x.title || '');
      const sameKw = !!dKw && dKw === kwNorm(x.focusKeyword || x.focus_keyword || '');
      const hold = basis === 'full' ? sim >= LIMITS.dupHold : sim >= LIMITS.previewHold; const rev = basis === 'full' ? sim >= LIMITS.dupReview : sim >= LIMITS.previewReview;
      if (hold || rev || sameTitle || (ts >= LIMITS.titleNear && sim >= 0.08) || (sameKw && ts >= 0.4 && sim >= 0.08)) {
        similar.push({ id: x.id != null ? Number(x.id) : null, title: String(x.title || ''), url: String(x.url || ''), source: kind, sim: Math.round(sim * 100), titleSim: Math.round(ts * 100), sameTitle, sameKeyword: sameKw, level: (hold || sameTitle || (ts >= LIMITS.titleSame && rev)) ? 'hold' : 'review' });
      }
    });
    similar.sort((a, b) => (b.level === 'hold') - (a.level === 'hold') || b.sim - a.sim || b.titleSim - a.titleSim);
    const top = similar[0];
    if (top) {
      const who = '«' + top.title + '»' + (top.source === 'batch' ? ' (مقالهٔ دیگر همین دسته)' : '');
      if (top.sameTitle) add('same_title', 'hold', 'عنوان دقیقاً مثل ' + who + ' است.', 40);
      else if (top.level === 'hold') add('duplicate', 'hold', 'محتوا با ' + who + ' بیش از حد شبیه است (' + fa(top.sim) + '٪)؛ انتشار آن محتوای یکسان و کانیبالیزیشن می‌سازد.', 50);
      else add('similar', 'review', 'محتوا تا ' + fa(top.sim) + '٪ با ' + who + ' هم‌پوشانی دارد' + (top.sameKeyword ? ' و عبارت کلیدی یکسان دارد' : '') + '؛ زاویهٔ متفاوت یا ادغام بهتر است.', 18);
      if (top.sameKeyword && top.level !== 'hold' && !top.sameTitle) add('same_keyword', 'review', 'عبارت کلیدی با ' + who + ' یکی است (رقابت داخلی).', 8);
    }
    // ۵) امتیاز و حکم
    const penalty = reasons.reduce((s, r) => s + r.pen, 0); const score = Math.max(0, Math.min(100, 100 - penalty));
    let verdict = 'ready';
    if (reasons.some((r) => r.level === 'hold') || score < LIMITS.holdScore) verdict = 'hold';
    else if (reasons.some((r) => r.level === 'review') || score < LIMITS.readyScore) verdict = 'review';
    return { verdict, score, reasons: reasons.map(({ code, level, detail }) => ({ code, level, detail })), similar: similar.slice(0, 5), metrics: m, minWords };
  }
  const VERDICT_FA = { ready: 'آمادهٔ ذخیره', review: 'نیازمند بازبینی', hold: 'نگه‌داشته شد' };

  /* ------------------------------------------------------------------ ممیزی مقاله‌های موجود سایت */
  const wordsOf = (x) => { if (Number.isFinite(Number(x.words)) && Number(x.words) > 0) return { n: Number(x.words), known: true }; const p = String(x.contentPreview || x.excerpt || ''); const n = raw(text(p)).length; return { n, known: p.length > 0 && p.length < LIMITS.previewCap }; };
  const ageMonths = (iso, now) => { const t = Date.parse(String(iso || '').replace(' ', 'T')); if (!Number.isFinite(t)) return null; return Math.max(0, Math.floor(((now || Date.now()) - t) / (30.4 * 86400000))); };
  /**
   * @param {Array} items  فهرست محتوای سایت (کل انواع)؛ فقط مقاله‌ها بررسی می‌شوند
   * @returns {{rows:Array, stats:Object}}
   */
  function auditSite(items, o) {
    o = o || {}; const now = o.now || Date.now();
    const arts = (Array.isArray(items) ? items : []).filter((x) => x && x.id != null && isArticleType(x.type) && x.title);
    const prep = arts.map((x) => { const prev = String(x.contentPreview || x.excerpt || ''); const set = shingleSet(text(prev)); return { x, set, w: wordsOf(x), prevLen: prev.length }; });
    // شاخص معکوس شینگل برای یافتن جفت‌های شبیه بدون O(n²) کامل
    const idx = new Map(); prep.forEach((p, i) => p.set.forEach((s) => { let a = idx.get(s); if (!a) idx.set(s, a = []); if (a.length < 60) a.push(i); }));
    const sims = prep.map(() => []);
    prep.forEach((p, i) => {
      if (p.set.size < 8) return; const cnt = new Map();
      p.set.forEach((s) => { (idx.get(s) || []).forEach((j) => { if (j > i) cnt.set(j, (cnt.get(j) || 0) + 1); }); });
      cnt.forEach((c, j) => { if (c < 3) return; const q = prep[j]; const jac = jaccard(p.set, q.set); const con = Math.max(containment(p.set, q.set), containment(q.set, p.set));
        const sim = Math.max(jac, con * 0.85); if (sim >= 0.3) { sims[i].push({ j, sim }); sims[j].push({ j: i, sim }); } });
    });
    const titleMap = new Map(); prep.forEach((p, i) => { const k = squash(p.x.title); if (!k) return; (titleMap.get(k) || titleMap.set(k, []).get(k)).push(i); });
    const kwMap = new Map(); prep.forEach((p, i) => { const k = kwNorm(p.x.focusKeyword || p.x.focus_keyword || ''); if (k && k.split(' ').length >= 1) (kwMap.get(k) || kwMap.set(k, []).get(k)).push(i); });
    const rows = prep.map((p, i) => {
      const x = p.x; const flags = []; const why = []; let pen = 0; const status = String(x.status || 'publish');
      if (p.w.known && p.w.n < LIMITS.hardMinWords) { flags.push('weak'); why.push('متن بسیار کوتاه است (' + fa(p.w.n) + ' واژه).'); pen += 45; }
      else if (p.w.known && p.w.n < LIMITS.shortSiteWords) { flags.push('short'); why.push('متن کوتاه است (' + fa(p.w.n) + ' واژه).'); pen += 18; }
      const similarTo = sims[i].sort((a, b) => b.sim - a.sim).slice(0, 3).map((s) => ({ id: Number(prep[s.j].x.id), title: String(prep[s.j].x.title), url: String(prep[s.j].x.url || ''), sim: Math.round(s.sim * 100) }));
      if (similarTo[0] && similarTo[0].sim >= 55) { flags.push('dup'); why.push('محتوا تا ' + fa(similarTo[0].sim) + '٪ با «' + similarTo[0].title + '» یکسان است.'); pen += 40; }
      else if (similarTo[0]) { flags.push('similar'); why.push('محتوا تا ' + fa(similarTo[0].sim) + '٪ با «' + similarTo[0].title + '» هم‌پوشانی دارد.'); pen += 15; }
      const sameT = (titleMap.get(squash(x.title)) || []).filter((j) => j !== i); if (sameT.length) { flags.push('dup_title'); why.push('عنوان با ' + fa(sameT.length) + ' مقالهٔ دیگر یکی است.'); pen += 25; }
      const k = kwNorm(x.focusKeyword || x.focus_keyword || ''); const sameK = k ? (kwMap.get(k) || []).filter((j) => j !== i) : []; if (sameK.length) { flags.push('dup_kw'); why.push('عبارت کلیدی «' + (x.focusKeyword || x.focus_keyword) + '» در ' + fa(sameK.length) + ' مقالهٔ دیگر هم هست (رقابت داخلی).'); pen += 10; }
      if (!String(x.metaDescription || x.meta_description || '').trim()) { flags.push('nometa'); why.push('توضیح متا ندارد.'); pen += 6; }
      const age = ageMonths(x.modified, now); if (age != null && age >= 24) { flags.push('stale'); why.push('حدود ' + fa(Math.floor(age / 12)) + ' سال از آخرین ویرایش گذشته است.'); pen += 5; }
      const score = Math.max(0, 100 - pen);
      const level = flags.some((f) => f === 'weak' || f === 'dup') ? 'bad' : flags.some((f) => f === 'short' || f === 'similar' || f === 'dup_title') ? 'warn' : flags.length ? 'note' : 'ok';
      return { id: Number(x.id), title: String(x.title), url: String(x.url || ''), type: String(x.type || 'post'), status, statusFa: STATUS_FA[status] || status, words: p.w.known || p.w.n ? p.w.n : null, wordsKnown: p.w.known, modified: x.modified || '', score, level, flags, why, similarTo, metaTitle: x.metaTitle || '', focus: x.focusKeyword || x.focus_keyword || '' };
    });
    const count = (f) => rows.filter(f).length;
    const stats = { total: rows.length, published: count((r) => r.status === 'publish'), draft: count((r) => r.status === 'draft' || r.status === 'pending' || r.status === 'future'),
      weak: count((r) => r.flags.includes('weak')), short: count((r) => r.flags.includes('short')), dup: count((r) => r.flags.includes('dup') || r.flags.includes('dup_title')), similar: count((r) => r.flags.includes('similar')),
      attention: count((r) => r.level === 'bad' || r.level === 'warn'), avg: rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0 };
    return { rows, stats };
  }
  /** پالایش/جست‌وجو/مرتب‌سازی ردیف‌های ممیزی برای نمایش. */
  function filterRows(rows, o) {
    o = o || {}; const f = o.filter || 'all'; const q = raw(o.q || '').join(' ');
    let out = (rows || []).filter((r) => {
      if (f === 'attention') return r.level === 'bad' || r.level === 'warn';
      if (f === 'weak') return r.flags.includes('weak') || r.flags.includes('short');
      if (f === 'dup') return r.flags.includes('dup') || r.flags.includes('similar') || r.flags.includes('dup_title') || r.flags.includes('dup_kw');
      if (f === 'draft') return r.status === 'draft' || r.status === 'pending' || r.status === 'future';
      if (f === 'publish') return r.status === 'publish';
      return true;
    });
    if (q) out = out.filter((r) => (normTitle(r.title) + ' ' + normTitle(r.focus)).indexOf(q) !== -1);
    const sort = o.sort || 'worst';
    const by = { worst: (a, b) => a.score - b.score || String(b.modified).localeCompare(String(a.modified)), newest: (a, b) => String(b.modified).localeCompare(String(a.modified)), longest: (a, b) => (b.words || 0) - (a.words || 0), similar: (a, b) => ((b.similarTo[0] || {}).sim || 0) - ((a.similarTo[0] || {}).sim || 0) };
    return out.slice().sort(by[sort] || by.worst);
  }

  return { evaluate, metrics, auditSite, filterRows, similarity, titleSimilarity, isArticleType, LIMITS, VERDICT_FA, STATUS_FA, FILLER };
});
