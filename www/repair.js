/* Site Inspector Product Repair engine (v1.16).
 * Finds WooCommerce products that have no SEO, no description, or a WRONG description, and builds safe repair plans.
 *
 * Principles (same as the rest of the app):
 *  - Never invents facts. Missing/wrong text is rewritten only from real product data (WooCommerce fields + facts the owner typed).
 *  - Three tiers: AUTO (fill an EMPTY seo field from the product's own trustworthy text), APPROVE (replace a non-empty/bad value,
 *    owner confirms), REVIEW (content looks wrong: owner sees before/after and confirms). Wrong content is never auto-replaced.
 *  - Only ALLOWED fields can change. Title, price, URL, stock, theme and plugins are never touched.
 *  - Every write is revision-checked and journaled so it can be rolled back.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./agent.js'), require('./polish.js'), require('./fromname.js'), require('./seopolicy.js'), require('./seobuilder.js'));
  else root.SI = root.SI || {}, root.SI.Repair = factory(root.SI && root.SI.Agent, root.SI && root.SI.Polish, root.SI && root.SI.FromName, root.SI && root.SI.SeoPolicy, root.SI && root.SI.SeoBuilder);
})(typeof self !== 'undefined' ? self : this, function (Agent, Polish, FromName, Policy, SeoBuilder) {
  'use strict';
  const ALLOWED = ['content', 'excerpt', 'seo_title', 'meta_description', 'focus_keyword', 'related_keywords'];
  const TYPES = ['product', 'post'];
  const kindOf = (it) => (it && it.type === 'product' ? 'product' : 'article');
  const AUTO_FIELDS = ['seo_title', 'meta_description', 'focus_keyword'];
  const WRONG_CODES = ['placeholder', 'raw_markup', 'title_mismatch', 'foreign_product', 'duplicate_content', 'fact_conflict', 'wrong_language'];
  const STOP = new Set(['برای', 'این', 'است', 'های', 'یک', 'با', 'از', 'را', 'که', 'در', 'به', 'و', 'یا', 'تا', 'هم', 'بر', 'آن', 'شده', 'می', 'the', 'and', 'for', 'with', 'from', 'this', 'that']);

  const DEF = {
    seo_no_title:      { group: 'seo',     sev: 'medium',   pen: 10, fix: 'auto',    label: 'بدون عنوان سئو' },
    seo_title_len:     { group: 'seo',     sev: 'low',      pen: 6,  fix: 'approve', label: 'طول عنوان سئو نامناسب' },
    seo_no_meta:       { group: 'seo',     sev: 'high',     pen: 15, fix: 'auto',    label: 'بدون توضیحات متا' },
    seo_meta_len:      { group: 'seo',     sev: 'low',      pen: 6,  fix: 'approve', label: 'طول توضیحات متا نامناسب' },
    seo_no_focus:      { group: 'seo',     sev: 'low',      pen: 5,  fix: 'auto',    label: 'بدون عبارت کلیدی' },
    seo_dup_title:     { group: 'seo',     sev: 'medium',   pen: 8,  fix: 'approve', label: 'عنوان سئوی تکراری' },
    seo_dup_meta:      { group: 'seo',     sev: 'medium',   pen: 8,  fix: 'approve', label: 'توضیحات متای تکراری' },
    seo_focus_absent:  { group: 'wrong',   sev: 'medium',   pen: 8,  fix: 'approve', label: 'عبارت کلیدی در عنوان/متن نیست' },
    seo_meta_unrelated:{ group: 'wrong',   sev: 'medium',   pen: 10, fix: 'approve', label: 'توضیحات متا با محصول نمی‌خواند' },
    content_empty:     { group: 'content', sev: 'critical', pen: 40, fix: 'facts',   label: 'بدون توضیحات محصول' },
    content_thin:      { group: 'content', sev: 'high',     pen: 20, fix: 'facts',   label: 'توضیحات بسیار کوتاه' },
    excerpt_missing:   { group: 'content', sev: 'medium',   pen: 8,  fix: 'approve', label: 'بدون توضیح کوتاه' },
    placeholder:       { group: 'wrong',   sev: 'critical', pen: 35, fix: 'facts',   label: 'متن نمونه/جایگزین (placeholder)' },
    raw_markup:        { group: 'wrong',   sev: 'high',     pen: 20, fix: 'review',  label: 'کد یا شورت‌کد خام در متن' },
    title_mismatch:    { group: 'wrong',   sev: 'high',     pen: 25, fix: 'review',  label: 'متن به نام محصول ربطی ندارد' },
    foreign_product:   { group: 'wrong',   sev: 'critical', pen: 30, fix: 'review',  label: 'متن محتوای دیگری کپی شده' },
    duplicate_content: { group: 'wrong',   sev: 'high',     pen: 25, fix: 'review',  label: 'متن تقریباً تکراری' },
    fact_conflict:     { group: 'wrong',   sev: 'high',     pen: 25, fix: 'review',  label: 'مشخصات در متن (وزن/ابعاد/رنگ) با دادهٔ ثبت‌شده نمی‌خواند' },
    no_headings:       { group: 'content', sev: 'low',      pen: 4,  fix: 'manual',  label: 'مقالهٔ بلند بدون تیتر (H2/H3)' },
    wrong_language:    { group: 'wrong',   sev: 'high',     pen: 20, fix: 'review',  label: 'زبان متن با سایت نمی‌خواند' },
    typo_text:         { group: 'content', sev: 'low',      pen: 3,  fix: 'auto',    label: 'غلط املایی/نگارشی (حروف عربی، نیم‌فاصله، نشانه‌گذاری)' },
    seo_markup:        { group: 'seo',     sev: 'low',      pen: 4,  fix: 'auto',    label: 'ساختار سئوی متن (H1 تکراری، تیتر نامنظم، alt خالی، پاراگراف خالی)' },
  };
  // Codes fixed by the Polish engine (typography + markup); they never need generated text, only deterministic corrections.
  const POLISH_CODES = ['typo_text', 'seo_markup'];
  const PLACEHOLDERS = [
    /lorem\s+ipsum/i, /dolor\s+sit\s+amet/i, /لورم\s*ایپسوم/, /متن\s*(?:نمونه|آزمایشی|تستی|تست|ساختگی)/, /(?:sample|dummy|placeholder|test)\s+(?:text|description|product)/i,
    /\bTODO\b/, /\bTBD\b/, /coming\s+soon/i, /^\s*(?:توضیحات|شرح)\s*(?:محصول)?\s*[.…]*\s*$/, /به\s*زودی\s*(?:تکمیل|اضافه)/, /در\s*حال\s*(?:ویرایش|تکمیل)/, /\[?\s*(?:توضیحات|description)\s*(?:را|here)\s*(?:وارد|اینجا)/i,
    /\{\{[^}]*\}\}/, /\[object Object\]/, /\bundefined\b/, /\bNaN\b/, /(?:^|\s)null(?:\s|$)/,
  ];

  const digits = (s) => String(s == null ? '' : s).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const plain = (v) => String(v == null ? '' : v).replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const norm = (v) => digits(plain(v)).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\u200f\u064b-\u0652]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const len = (v) => Array.from(String(v == null ? '' : v)).length;
  const tokens = (v) => (norm(v).match(/[\p{L}\p{N}]{3,}/gu) || []).filter((t) => !STOP.has(t));
  const words = (v) => (norm(v).match(/[\p{L}\p{N}]+/gu) || []);
  const pxw = (t) => { try { const V = (typeof require === 'function' && typeof module === 'object') ? require('./verify.js') : (root.SI && root.SI.Verify); return V ? V.pixelWidth(t) : len(t) * 9; } catch (e) { return len(t) * 9; } };
  const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h >>> 0; };

  // v1.67: بدنهٔ محصولِ بدون متن (یا با متن بسیار کوتاه) را موتور «استودیوی محصول» می‌نویسد؛ پیش‌تر فقط یک متن سه‌خطی از «ساخت از نام» ساخته می‌شد و در ترمیم خودکار اصلاً نوشته نمی‌شد.
  const G = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : {});
  function studioLib() { try { if (typeof module === 'object' && module.exports && typeof require === 'function') return require('./productstudio.js'); } catch (e) {} return (G.SI && G.SI.ProductStudio) || null; }
  /** سهم جمله‌های قالبیِ استودیو در متن (۰ تا ۱). متنی که بیشترش نکات عمومی یک دسته است با محصول هم‌دستهٔ دیگر «کپی» حساب نمی‌شود؛ تفاوتش در نام و مشخصات واقعی است. */
  function templateShare(text) {
    try { const S = studioLib(); if (!S || !S.stripTemplate) return 0; const total = words(text).length; if (total < 60) return 0; const left = S.stripTemplate(text).split(' ').filter(Boolean).length; return Math.max(0, Math.min(1, 1 - left / total)); } catch (e) { return 0; }
  }
  function shingleSet(text, k) {
    const w = words(text), out = new Set(); k = k || 4;
    if (w.length < k + 4) return out;
    for (let i = 0; i + k <= w.length; i++) out.add(hash(w.slice(i, i + k).join(' ')));
    return out;
  }

  /** Builds an inverted shingle index to find near-duplicate product texts without O(n²) set comparisons. */
  function buildIndex(items) {
    const sets = new Map(), inv = new Map();
    (items || []).forEach((it) => {
      const id = String(it.id), s = shingleSet(it.content || it.contentPreview || '');
      if (!s.size) return; sets.set(id, s);
      s.forEach((h) => { let a = inv.get(h); if (!a) inv.set(h, a = []); a.push(id); });
    });
    const common = 25; // shingles present in many products are shared boilerplate (shipping/returns), not copying
    function similarTo(set, excludeId, limit) {
      const counts = new Map();
      set.forEach((h) => { const a = inv.get(h); if (!a || a.length > common) return; a.forEach((id) => { if (id !== String(excludeId)) counts.set(id, (counts.get(id) || 0) + 1); }); });
      const rows = [];
      counts.forEach((shared, id) => { const other = sets.get(id); const score = shared / (set.size + other.size - shared); if (score >= 0.35) rows.push({ id, score: Math.round(score * 100) }); });
      return rows.sort((a, b) => b.score - a.score).slice(0, limit || 3);
    }
    function add(id, text) { const s = shingleSet(text || ''); if (!s.size) return; const k = String(id); sets.set(k, s); s.forEach((h) => { let a = inv.get(h); if (!a) inv.set(h, a = []); if (!a.includes(k)) a.push(k); }); }
    return { sets, add, similarTo, dupOf(id) { const s = sets.get(String(id)); return s ? similarTo(s, id, 1)[0] || null : null; } };
  }

  function problem(code, detail, extra) { const d = DEF[code]; return Object.assign({ code, group: d.group, severity: d.sev, fix: d.fix, label: d.label, detail: detail || '' }, extra || {}); }

  function weightGrams(p) {
    if (!p || p.weight == null || p.weight === '') return null;
    const n = parseFloat(digits(p.weight).replace(',', '.')); if (!isFinite(n) || n <= 0) return null;
    const u = String(p.weight_unit || 'kg').toLowerCase();
    return u === 'g' || u === 'gr' ? n : u === 'kg' ? n * 1000 : u === 'lbs' || u === 'lb' ? n * 453.592 : u === 'oz' ? n * 28.3495 : null;
  }
  function weightMentions(text) {
    const t = digits(plain(text)).replace(/٫/g, '.').replace(/(\d),(\d)/g, '$1.$2'); const out = [];
    const re = /(\d+(?:\.\d+)?)\s*(کیلوگرم|کیلو|کگ|kg(?![a-z])|گرم|گر(?![\p{L}])|gr(?![a-z])|g(?![a-z]))/giu; let m;
    while ((m = re.exec(t))) { const n = parseFloat(m[1]); const u = m[2].toLowerCase(); out.push(/کیلو|کگ|kg/.test(u) ? n * 1000 : n); }
    return out;
  }

  const COLORS = ['قرمز', 'آبی', 'سبز', 'زرد', 'مشکی', 'سفید', 'قهوه‌ای', 'نارنجی', 'بنفش', 'صورتی', 'خاکستری', 'طوسی', 'کرم', 'طلایی', 'نقره‌ای'];
  function dimMentions(text) {
    const t = digits(plain(text)).replace(/٫/g, '.'); const out = []; const re = /(\d+(?:\.\d+)?)\s*(?:×|x|X|\*|در)\s*(\d+(?:\.\d+)?)(?:\s*(?:×|x|X|\*|در)\s*(\d+(?:\.\d+)?))?\s*(سانتی‌?متر|سانتی|سانت|cm|میلی‌?متر|میلی|mm)/gi; let m;
    while ((m = re.exec(t))) { const mm = /میلی|mm/i.test(m[4]); out.push([m[1], m[2], m[3]].filter(Boolean).map((x) => parseFloat(x) / (mm ? 10 : 1)).sort((a, b) => a - b)); }
    return out;
  }
  function dimsOf(p) { const d = p && p.dimensions; if (!d || typeof d !== 'object') return null; const v = ['length', 'width', 'height'].map((k) => parseFloat(digits(d[k]).replace(',', '.'))).filter((x) => isFinite(x) && x > 0); if (!v.length) return null; const u = String(p.dimension_unit || 'cm').toLowerCase(); const f = u === 'mm' ? 0.1 : u === 'm' ? 100 : u === 'in' ? 2.54 : 1; return v.map((x) => x * f).sort((a, b) => a - b); }
  /** Statements in `text` that contradict registered product data (weight, dimensions, colour). Returns [string]. Skipped for variable products. */
  function factConflicts(text, prod) {
    const out = []; if (!prod || Number(prod.variation_count || 0)) return out;
    const g = weightGrams(prod), m = weightMentions(text); if (g && m.length && !m.some((x) => Math.abs(x - g) / g <= 0.02)) out.push('در متن ' + m.map((x) => Math.round(x * 100) / 100 + ' گرم').slice(0, 3).join('، ') + ' آمده؛ وزن ثبت‌شده ' + Math.round(g * 100) / 100 + ' گرم است.');
    const dm = dimsOf(prod), dt = dimMentions(text); if (dm && dt.length && !dt.some((x) => x.length === dm.length ? x.every((v, i) => Math.abs(v - dm[i]) / dm[i] <= 0.05) : x.every((v) => dm.some((d) => Math.abs(v - d) / d <= 0.05)))) out.push('ابعاد در متن (' + dt[0].join('×') + ' سانتی‌متر) با ابعاد ثبت‌شده (' + dm.map((x) => Math.round(x * 10) / 10).join('×') + ') نمی‌خواند.');
    const ca = (Array.isArray(prod.attributes) ? prod.attributes : []).find((a) => /رنگ|colou?r/i.test(String(a && (a.label || a.name) || ''))); const opts = ca && Array.isArray(ca.options) ? ca.options.map((x) => norm(x)) : [];
    if (opts.length && opts.every((o) => COLORS.some((c) => o.includes(norm(c))))) { const tn = norm(text); const bad = COLORS.filter((c) => new RegExp('(?:^|\\s)' + norm(c) + '(?:\\s|$|[.،,])').test(tn) && !opts.some((o) => o.includes(norm(c)))); if (bad.length) out.push('رنگ «' + bad[0] + '» در متن آمده ولی در رنگ‌های ثبت‌شده نیست.'); }
    return out;
  }

  function persianRatio(text) { const letters = (String(text).match(/\p{L}/gu) || []); if (!letters.length) return 1; return letters.filter((c) => /[\u0600-\u06ff]/.test(c)).length / letters.length; }

  /**
   * Diagnoses one product. `ctx`: { products:[…other products…], index, dupMap, titleCounts, metaCounts, siteLang:'fa'|'any' }.
   * `item.content` (full text from /agent/item) is preferred over `contentPreview`; `item.product` enables fact checks.
   */
  function diagnose(item, ctx) {
    const c = ctx || {}; const p = [];
    const title = String(item.title || ''), text = plain(item.content || item.contentPreview || ''), excerpt = plain(item.excerpt || '');
    const mt = String(item.metaTitle || item.seo_title || ''), md = String(item.metaDescription || item.meta_description || ''), fk = String(item.focusKeyword || item.focus_keyword || '');
    const wc = words(text).length; const kind = kindOf(item); const minWords = kind === 'product' ? 40 : 150;
    const tk = tokens(title), tt = norm(text), nTitle = norm(title);

    // ---- content: missing / thin / placeholder
    if (text.length < 5) p.push(problem('content_empty', 'توضیحات کامل محصول خالی است.'));
    else if (wc < minWords) p.push(problem('content_thin', 'فقط ' + wc + ' واژه؛ برای ' + (kind === 'product' ? 'توضیح یک محصول' : 'یک مقاله') + ' کافی نیست.'));
    if (kind === 'article' && wc >= 400 && !/<h[2-4]\b/i.test(String(item.content || ''))  && item.content) p.push(problem('no_headings', 'مقاله ' + wc + ' واژه است ولی تیتر ندارد.'));
    if (excerpt.length < 45) p.push(problem('excerpt_missing', 'توضیح کوتاه خالی یا کمتر از ۴۵ نویسه است.'));
    if (text.length >= 5) {
      const hit = PLACEHOLDERS.find((re) => re.test(text));
      if (hit) p.push(problem('placeholder', 'الگوی متن نمونه یا مقدار تهی/خراب در توضیحات پیدا شد.'));
      else if (tokens(text).length >= 20 && new Set(tokens(text)).size / tokens(text).length < 0.25) p.push(problem('placeholder', 'متن بیش از حد تکراری است (احتمال متن پرکننده).'));
    }

    // ---- wrong content
    if (text.length >= 5) {
      const raw = String(item.content || item.contentPreview || '');
      if (/\[\/?(?:vc_|et_pb_|fusion_|elementor|su_|woocommerce_)[^\]]*\]/i.test(raw) && !item.protected_layout) p.push(problem('raw_markup', 'شورت‌کد صفحه‌ساز بدون رندر در متن دیده می‌شود.'));
      else { const o = (raw.match(/<(?:p|div|h[1-6]|ul|ol|li|span|strong|table)\b/gi) || []).length, cl = (raw.match(/<\/(?:p|div|h[1-6]|ul|ol|li|span|strong|table)>/gi) || []).length; if (Math.abs(o - cl) >= 3) p.push(problem('raw_markup', 'تگ‌های HTML ناقص یا نامتوازن‌اند (' + o + ' باز / ' + cl + ' بسته).')); }
      if (wc >= 25 && tk.length >= 2 && !tk.some((t) => tt.includes(t))) p.push(problem('title_mismatch', 'هیچ‌یک از واژه‌های اصلی نام محصول در توضیحات نیامده است.'));
      if (nTitle.length >= 3 && Array.isArray(c.products)) {
        const own = tt.includes(nTitle);
        const foreign = !own && kind && c.products.find((o) => String(o.id) !== String(item.id) && o.type === item.type && norm(o.title).length >= 10 && tokens(o.title).length >= 2 && tt.includes(norm(o.title)));
        if (foreign) p.push(problem('foreign_product', 'در متن نام «' + foreign.title + '» آمده، نه نام این محصول.', { otherId: foreign.id }));
      }
      const dup = c.dupMap ? c.dupMap.get(String(item.id)) : (c.index ? c.index.dupOf(item.id) : null);
      if (dup && dup.score >= 60 && templateShare(text) < 0.7) { const o = (c.products || []).find((x) => String(x.id) === String(dup.id)); p.push(problem('duplicate_content', dup.score + '٪ شباهت با ' + (o ? '«' + o.title + '»' : 'محصول دیگر'), { otherId: dup.id, score: dup.score })); }
      const prod = kind === 'product' ? item.product : null;
      if (prod && !Number(prod.variation_count || 0)) {
        const fc = factConflicts(text, prod); if (fc.length) p.push(problem('fact_conflict', fc.join(' ')));
      }
      if (c.siteLang === 'fa' && text.length >= 120 && persianRatio(nTitle || title) > 0.5 && persianRatio(text) < 0.15) p.push(problem('wrong_language', 'متن تقریباً کاملاً غیرفارسی است.'));
    }

    // ---- typography + SEO structure (deterministic, auto-fixable)
    if (Polish) {
      const rawAll = String(item.content || item.contentPreview || '');
      const pc = rawAll ? Polish.detect(rawAll, { title }) : { text: 0, markup: 0, changes: {} };
      let extra = 0; const ex = {};
      [['excerpt', item.excerpt], ['mt', mt], ['md', md]].forEach(([k, v]) => { const cur = String(v || '').trim(); if (cur) { const r = Polish.fixPlain(cur); if (r.count && r.text !== cur) { extra += r.count; Object.keys(r.changes).forEach((c) => { ex[c] = (ex[c] || 0) + r.changes[c]; }); } } });
      if (pc.text || extra) { const all = Object.assign({}, pc.changes); Object.keys(ex).forEach((c) => { all[c] = (all[c] || 0) + ex[c]; }); const tc = {}; Polish.TEXT_CODES.forEach((c) => { if (all[c]) tc[c] = all[c]; }); p.push(problem('typo_text', Polish.describe(tc))); }
      if (pc.markup) { const mc = {}; Polish.MARKUP_CODES.forEach((c) => { if (pc.changes[c]) mc[c] = pc.changes[c]; }); p.push(problem('seo_markup', Polish.describe(mc))); }
    }

    // ---- SEO
    if (!mt) p.push(problem('seo_no_title', 'عنوان سئو تنظیم نشده است.'));
    else { const tc = Policy.checkTitle(mt); if (!tc.ok) p.push(problem('seo_title_len', tc.reason, { rules: tc.rules })); }
    if (!md) p.push(problem('seo_no_meta', 'توضیحات متا تنظیم نشده است.'));
    else { const mc = Policy.checkMeta(md); if (!mc.ok) p.push(problem('seo_meta_len', mc.reason, { rules: mc.rules })); }
    if (!fk) p.push(problem('seo_no_focus', 'عبارت کلیدی اصلی تنظیم نشده است.'));
    if (c.titleCounts && mt && (c.titleCounts.get(norm(mt)) || 0) > 1) p.push(problem('seo_dup_title', 'چند محصول عنوان سئوی یکسان دارند.'));
    if (c.metaCounts && md && (c.metaCounts.get(norm(md)) || 0) > 1) p.push(problem('seo_dup_meta', 'چند محصول توضیحات متای یکسان دارند.'));
    if (fk && text.length >= 40 && !norm(title + ' ' + mt).includes(norm(fk)) && !tt.includes(norm(fk))) p.push(problem('seo_focus_absent', 'عبارت «' + fk + '» نه در عنوان است و نه در متن.'));
    if (md && text.length >= 40 && tk.length) { const mdt = new Set(tokens(md)); const base = new Set(tokens(title + ' ' + text.slice(0, 600))); let shared = 0; mdt.forEach((t) => { if (base.has(t)) shared++; }); if (mdt.size >= 5 && shared === 0) p.push(problem('seo_meta_unrelated', 'هیچ واژهٔ مشترکی با عنوان و متن محصول ندارد.')); }

    let score = 100; p.forEach((x) => { score -= DEF[x.code].pen; });
    const has = (g) => p.some((x) => x.group === g);
    return { id: item.id, title, url: item.url || '', type: item.type || 'product', status: item.status || 'publish', revision: item.revision || '', problems: p, score: Math.max(0, score), wrong: has('wrong') || p.some((x) => WRONG_CODES.includes(x.code)), noContent: p.some((x) => x.code === 'content_empty'), thin: p.some((x) => x.code === 'content_thin'), noSeo: p.some((x) => ['seo_no_title', 'seo_no_meta'].includes(x.code)) };
  }

  const isRepairable = (it) => it && TYPES.includes(it.type) && it.status !== 'trash' && it.status !== 'auto-draft';

  /** Scans a whole catalog. Returns per-product diagnoses (worst first) and a summary. */
  function scan(items, opts) {
    const o = opts || {}; const products = (items || []).filter(isRepairable);
    const index = buildIndex(products), dupMap = new Map(), titleCounts = new Map(), metaCounts = new Map();
    products.forEach((it) => { const d = index.dupOf(it.id); if (d) dupMap.set(String(it.id), d); const a = norm(it.metaTitle), b = norm(it.metaDescription); if (a) titleCounts.set(a, (titleCounts.get(a) || 0) + 1); if (b) metaCounts.set(b, (metaCounts.get(b) || 0) + 1); });
    const ctx = { products, index, dupMap, titleCounts, metaCounts, siteLang: o.siteLang || 'fa' };
    const results = products.map((it) => diagnose(it, ctx));
    const bad = results.filter((r) => r.problems.length).sort((a, b) => a.score - b.score);
    const byCode = {}; results.forEach((r) => r.problems.forEach((x) => { byCode[x.code] = (byCode[x.code] || 0) + 1; }));
    const summary = { products: products.filter((x) => x.type === 'product').length, articles: products.filter((x) => x.type !== 'product').length, total: products.length, healthy: results.length - bad.length, flagged: bad.length, noSeo: results.filter((r) => r.noSeo).length, typos: results.filter((r) => r.problems.some((x) => x.code === 'typo_text')).length, markup: results.filter((r) => r.problems.some((x) => x.code === 'seo_markup')).length, noContent: results.filter((r) => r.noContent).length, thin: results.filter((r) => r.thin).length, wrong: results.filter((r) => r.wrong).length, avgScore: results.length ? Math.round(results.reduce((n, r) => n + r.score, 0) / results.length) : 0, byCode };
    return { results: bad, all: results, summary, ctx };
  }

  /** True when the product's own text can be trusted as the base for SEO fields. */
  function textTrusted(diag, text) { return plain(text).length >= 70 && !diag.problems.some((x) => WRONG_CODES.includes(x.code)) && !diag.problems.some((x) => x.code === 'content_empty' || x.code === 'content_thin'); }

  /** Lines «کلید: مقدار» که صاحب فروشگاه در توضیح کوتاه نوشته، به‌عنوان مشخصهٔ واقعی به استودیو می‌رسد. */
  function studioFacts(item) {
    const out = [];
    [item && item.short_description, item && item.excerpt].forEach((v) => String(v || '').replace(/<\/(?:p|li|tr|div)>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').split(/\n+/).forEach((l) => {
      l = l.replace(/\s+/g, ' ').trim();
      if (/^[^:：=]{2,30}\s*[:：=]\s*\S/.test(l) && len(l) < 160 && !PROMO.test(l) && !PLACEHOLDERS.some((re) => re.test(l))) out.push(l);
    }));
    return [...new Set(out)].join('\n');
  }
  /** Full product body. A short but real existing text is KEPT at the top (never discarded). Returns { ok, content, excerpt, keywords, words, preserved } or { ok:false, why, unavailable }. */
  function studioBody(item, o) {
    const S = studioLib(); if (!S || !S.build) return { ok: false, unavailable: true, why: '' };
    const old = String(item.content || '').trim(); const keepOld = plain(old).length >= 20 && !PLACEHOLDERS.some((re) => re.test(plain(old)));
    const mk = (seed) => S.build(item.title, { brand: o.brand || '', site: o.site || '', categories: item.categories || (item.product && item.product.categories) || [], product: item.product || {}, facts: studioFacts(item), catalog: o.catalog || [], rules: o.rules, seed });
    // v1.76 یکتایی: تا ۸ نسخهٔ قطعی (seed) ساخته می‌شود و نسخه‌ای انتخاب می‌شود که کمترین شباهت را به بقیهٔ محصولات سایت (و متن‌هایی که همین اجرا نوشته) دارد و مانع گوگل ندارد.
    let r = null, html = '', sim = null, bestKey = null, tried = 0;
    for (let i = 0; i < 8; i++) {
      let c; try { c = mk(String(item.id || '') + (i ? '#' + i : '')); } catch (e) { return { ok: false, unavailable: true, why: '' }; }
      if (!c || !c.ok) { if (!r) return { ok: false, why: (c && c.why) || 'متن از نام محصول ساخته نشد.' }; break; }
      tried++; const h0 = String(c.fields.content || '').trim(); const h1 = keepOld ? old + '\n' + h0 : h0;
      const sh = o.index && o.index.similarTo ? shingleSet(h1) : null; const s0 = sh && sh.size ? o.index.similarTo(sh, item.id, 1)[0] : null; const score = s0 ? s0.score : 0;
      const blockers = Policy.auditContent(h1, { focus: c.fields.focus_keyword || item.focusKeyword || '', title: item.title, kind: 'product', evidence: [item.title, studioFacts(item), old].join(' ') }).blockers.length;
      const key = blockers * 1000 + score; if (bestKey == null || key < bestKey) { bestKey = key; r = c; html = h1; sim = s0; }
      if (key < 25) break;
    }
    let preserved = keepOld;
    if (plain(html).length < 120) return { ok: false, why: 'متن ساخته‌شده بسیار کوتاه بود.' };
    if (sim) { if (sim.score >= (o.maxSimilar || 60)) return { ok: false, why: 'متن ساخته‌شده ' + sim.score + '٪ با محصول دیگری یکی می‌شد؛ مشخصات واقعی و متمایز (جنس، ابعاد، برند) را در فروشگاه ثبت کنید.' }; }
    const google = Policy.auditContent(html, { focus: r.fields.focus_keyword || item.focusKeyword || '', title: item.title, kind: 'product', evidence: [item.title, studioFacts(item), old].join(' ') });
    const specifics = (r.facts || []).length; if (!r.indexable) google.warnings.push({ code: 'thin_facts', detail: 'این متن فقط از نام محصول ساخته شده (' + specifics + ' مشخصهٔ واقعی). برای متن حرفه‌ای‌تر و صفحهٔ قابل‌ایندکس، این‌ها را در فروشگاه وارد کنید: ' + ((r.missing || []).slice(0, 4).join('، ') || 'جنس، اندازه، برند') + '.', rule: 'o05' });
    return { ok: true, google, similarity: sim ? sim.score : 0, variants: tried, content: html, excerpt: r.fields.excerpt || '', keywords: r.fields.related_keywords || '', words: r.wordCount || plain(html).split(/\s+/).length, preserved, family: r.familyLabel || '' };
  }

  /** v1.90: سازندهٔ سئوی کامل با شمارندهٔ یکتایی همین اسکن (کلیدها با norm خود Repair — ارقام فارسی/لاتین یکی حساب می‌شوند). */
  function buildSeo(item, o) {
    const op = o || {}; if (!SeoBuilder || op.builder === false) return null;
    const takenR = (counts, current) => (v) => { const k = norm(v); return !!(counts && (counts.get(k) || 0) > 0 && k !== norm(current)); };
    try { return SeoBuilder.build(item, { brand: op.brand || '', siteName: op.site || '', rules: op.rules, currency: op.currency, takenTitle: takenR(op.titleCounts, item.metaTitle), takenMeta: takenR(op.metaCounts, item.metaDescription), takenFocus: op.takenFocus }); } catch (e) { return null; }
  }

  /** v1.59: no trustworthy text yet -> everything is built from the product NAME (+ shop data). Empty SEO fields are auto; replacing a value or writing the body needs approval. */
  function planFromName(item, diag, o) {
    const taken = (counts, current) => (v) => !!(counts && (counts.get(v) || 0) > 0 && v !== norm(current));
    const nf = FromName.build(item, { brand: o.brand || '', site: o.site || '', rules: o.rules, takenTitle: taken(o.titleCounts, item.metaTitle), takenMeta: taken(o.metaCounts, item.metaDescription) });
    if (!nf.ok) return { fields: {}, tiers: {}, blocked: 'content', skipped: [nf.why] };
    // v1.90: سازندهٔ سئوی یکپارچه — بهترین از میان چند کاندیدای سنجیده‌شده (پیکسل، یکتایی، ادعا، کلیدواژه) جای تک‌کاندیدای قدیمی می‌نشیند.
    const sbd = buildSeo(item, o);
    if (sbd && sbd.ok) { ['seo_title', 'meta_description', 'focus_keyword'].forEach((k) => { if (sbd.fields[k]) nf.fields[k] = sbd.fields[k]; }); }
    const codes = new Set(diag.problems.map((x) => x.code)); const fields = {}, tiers = {}, skipped = []; let studio = null, google = null;
    const put = (k, v, empty) => { v = String(v || '').replace(/\s+/g, ' ').trim(); if (!v) return; fields[k] = v; tiers[k] = empty ? 'auto' : 'approve'; };
    const emptyT = !plain(item.metaTitle), emptyM = !plain(item.metaDescription), emptyF = !plain(item.focusKeyword);
    const want = (list) => list.some((c) => codes.has(c));
    if (emptyT || want(['seo_title_len', 'seo_dup_title'])) { const v = nf.fields.seo_title; if (Policy.titleAcceptable(v) && !Policy.lintField('title', v, { evidence: item.title }).length && norm(v) !== norm(item.metaTitle)) put('seo_title', v, emptyT); else if (!v) skipped.push('عنوان سئوی یکتا از نام ساخته نشد؛ نام را کامل‌تر یا متمایزتر کنید.'); }
    if (emptyM || want(['seo_meta_len', 'seo_dup_meta', 'seo_meta_unrelated'])) { const v = nf.fields.meta_description; if (Policy.metaAcceptable(v) && !Policy.lintField('meta', v, { evidence: item.title }).length && norm(v) !== norm(item.metaDescription)) put('meta_description', v, emptyM); else if (!v) skipped.push('توضیحات متا از نام ساخته نشد.'); }
    if (emptyF || want(['seo_focus_absent'])) put('focus_keyword', nf.fields.focus_keyword, emptyF);
    const noBody = want(['content_empty', 'content_thin']);
    const wrongText = diag.problems.some((x) => WRONG_CODES.includes(x.code)); const isProduct = kindOf(item) === 'product';
    // قفل صفحه‌ساز: هرگز متن/خلاصه/کلمات مرتبط نوشته نمی‌شود؛ فقط فیلدهای سئو.
    if (o.locked && noBody) skipped.push('متن با صفحه‌ساز ساخته شده؛ متن و خلاصه تغییر نمی‌کنند.');
    // v1.67: بدنهٔ محصول با موتور استودیو. o.writeBody=true (ترمیم خودکار با «ساخت خودکار متن» روشن) → سطح «خودکار»؛ در غیر این صورت فقط پیشنهادِ نیازمند تأیید.
    if (noBody && !o.locked && !wrongText && isProduct) {
      const sb = studioBody(item, o); const tier = o.writeBody && (!sb.google || sb.google.ok) ? 'auto' : 'approve'; if (sb.google && !sb.google.ok) skipped.push('دروازهٔ کیفیت گوگل: ' + sb.google.blockers.map((b) => b.detail).join(' ') + ' (پیش‌نویس فقط با تأیید خودت اعمال می‌شود).');
      const set = (k, v) => { v = String(v || '').trim(); if (v) { fields[k] = v; tiers[k] = tier; } };
      if (sb.ok) { set('content', sb.content); if (!plain(item.excerpt)) set('excerpt', sb.excerpt || nf.fields.excerpt); set('related_keywords', sb.keywords || nf.fields.related_keywords); studio = { words: sb.words, preserved: sb.preserved, family: sb.family }; google = sb.google || null; }
      else if (sb.unavailable) { put('content', nf.fields.content, false); if (!plain(item.excerpt)) put('excerpt', nf.fields.excerpt, false); put('related_keywords', nf.fields.related_keywords, false); }
      else if (sb.why) skipped.push(sb.why);
    } else if (noBody && !o.locked && !wrongText && !isProduct) skipped.push('برای مقاله، متن بدون منبع و نکات واقعی نوشته نمی‌شود؛ نکات قطعی را وارد کنید.');
    else if (codes.has('excerpt_missing') && !o.locked) put('excerpt', nf.fields.excerpt, false);
    if (nf.missing.length) skipped.push('برای توضیح قوی‌تر این اطلاعات را در وردپرس وارد کنید: ' + nf.missing.join('، ') + '.');
    return { fields, tiers, blocked: '', skipped, google, fromName: true, studio, confidence: nf.confidence, missing: nf.missing, why: whyMap(fields), builder: sbd && sbd.ok ? { before: sbd.before.score, after: sbd.after.score, gain: sbd.gain, missing: sbd.missing.slice(0, 5) } : null };
  }

  /**
   * v1.75 دروازهٔ نهایی — همان طرح «ترمیم خودکار سایت» و «اصلاح کامل یک محصول» پیش از پیش‌نمایش/ذخیره از اینجا می‌گذرد.
   * هر مقداری که بعد از همهٔ مراحل (متن، پولیش، FAQ، لینک‌ها، قوانین کاربر، بازسازی عنوان/متا) ساخته شده با اصول Google سنجیده می‌شود.
   * عنوان/متا/عبارت کلیدی/خلاصه‌ای که مشکل دارد حذف می‌شود (مقدار فعلی سایت دست‌نخورده می‌ماند)؛ متن فقط وقتی حذف می‌شود که
   * مانعِ «تازه» (غیر از موارد موجود در متن قبلی) داشته باشد. خروجی: { fields, dropped:[{field,reason}], google, contentDropped }.
   */
  function finalGate(item, fields, opts) {
    const o = opts || {}; const out = Object.assign({}, fields || {}); const dropped = []; const drop = (k, reason) => { if (out[k] != null) { delete out[k]; dropped.push({ field: k, reason }); } };
    const ev = [item.title, item.contentPreview, plain(item.content || ''), item.excerpt, item.metaDescription].join(' ');
    if (out.seo_title != null) { const c = Policy.checkTitle(out.seo_title); const l = Policy.lintField('title', out.seo_title, { evidence: ev }); if (!Policy.titleAcceptable(out.seo_title)) drop('seo_title', 'عنوان سئوی پیشنهادی رد شد: ' + (c.reason || 'نامعتبر') + ' (مقدار فعلی سایت حفظ شد).'); else if (l.length) drop('seo_title', 'عنوان سئوی پیشنهادی رد شد: ' + l[0].detail); }
    if (out.meta_description != null) { const c = Policy.checkMeta(out.meta_description); const l = Policy.lintField('meta', out.meta_description, { evidence: ev }); if (!Policy.metaAcceptable(out.meta_description)) drop('meta_description', 'متای پیشنهادی رد شد: ' + (c.reason || 'نامعتبر') + ' (مقدار فعلی سایت حفظ شد).'); else if (l.length) drop('meta_description', 'متای پیشنهادی رد شد: ' + l[0].detail); }
    if (out.focus_keyword != null && (len(out.focus_keyword) > Policy.LIMITS.focus.maxChars || !String(out.focus_keyword).trim())) drop('focus_keyword', 'عبارت کلیدی نامعتبر بود.');
    if (out.excerpt != null) { const l = Policy.lintField('meta', out.excerpt, { evidence: ev }); if (l.length) drop('excerpt', 'خلاصهٔ پیشنهادی رد شد: ' + l[0].detail); }
    let google = null, contentDropped = false;
    const focus = out.focus_keyword != null ? out.focus_keyword : item.focusKeyword || '';
    if (out.content != null) {
      const kind = o.kind || ((item.type || 'product') === 'product' ? 'product' : 'article'); const ctx = { focus, title: item.title, kind, evidence: ev + ' ' + (o.facts || '') };
      const before = new Set(Policy.auditContent(item.content || '', ctx).blockers.map((b) => b.code)); const after = Policy.auditContent(out.content, ctx);
      const fresh = after.blockers.filter((b) => !before.has(b.code));
      if (fresh.length) { drop('content', 'متن پیشنهادی با اصول گوگل نمی‌خواند و ذخیره نشد: ' + fresh.map((b) => b.detail).join(' ')); contentDropped = true; google = Policy.auditContent(item.content || '', ctx); } else google = after;
    }
    return { fields: out, dropped, google, contentDropped };
  }

  /** برای هر فیلدی که نوشته می‌شود، اصل و منبعی که پشت آن است (نمایش در کارت تغییر). */
  function whyMap(fields) { const o = {}; Object.keys(fields || {}).forEach((k) => { const w = Policy.whyFor(k); if (w.length) o[k] = w; }); return o; }

  /** SEO field proposals from the product's own trusted text. Fields are tagged auto (was empty) or approve (replaces a value). */
  function planSeo(item, diag, opts) {
    const o = opts || {}; const text = plain(item.content || item.contentPreview || '');
    if (!textTrusted(diag, text)) {
      if (!FromName || o.fromName === false || plain(item.title).length < 3) return { fields: {}, tiers: {}, blocked: 'content', skipped: [] };
      return planFromName(item, diag, o);
    }
    const legacy = Agent && Agent.makeSeo ? Agent.makeSeo(item.title, text, o.brand || '') : {};
    const taken = (counts, current) => (v) => !!(counts && (counts.get(v) || 0) > 0 && v !== norm(current));
    const pg = Polish ? Polish.seoFields(item, { brand: o.brand || '', kind: kindOf(item), keyword: o.keyword || item.targetKeyword || '', intent: o.intent || item.intent || '', takenTitle: taken(o.titleCounts, item.metaTitle), takenMeta: taken(o.metaCounts, item.metaDescription) }) : null;
    const gen = pg ? { seo_title: pg.seo_title, meta_description: pg.meta_description, focus_keyword: pg.focus_keyword || legacy.focus_keyword } : legacy;
    const codes = new Set(diag.problems.map((x) => x.code)); const fields = {}, tiers = {}, skipped = [];
    const gd = o.guard && item.url ? o.guard(item.url) : null; const locked = !!(gd && gd.locked);
    const put = (field, value, cur, current) => { let v = String(value || '').replace(/\s+/g, ' ').trim(); try { const SR = typeof module === 'object' && module.exports ? require('./seorules.js') : ((typeof self !== 'undefined' ? self : globalThis).SI || {}).SeoRules; if (SR && v && (field === 'seo_title' || field === 'meta_description')) { const fx = SR.fixSeoFields({ [field]: v }).fields; if (fx[field]) v = fx[field]; } } catch (e) {} if (!v || norm(v) === norm(current)) return; fields[field] = v; tiers[field] = cur ? 'auto' : 'approve'; };
    if (['seo_no_title', 'seo_title_len', 'seo_dup_title'].some((k) => codes.has(k))) {
      const v = String(gen.seo_title || '').trim();
      if (Policy.titleAcceptable(v) && !Policy.lintField('title', v, { evidence: item.title + ' ' + text }).length) {
        if (!pg && o.titleCounts && (o.titleCounts.get(norm(v)) || 0) > 0 && norm(v) !== norm(item.metaTitle)) skipped.push('عنوان پیشنهادی با عنوان سئوی محصول دیگری یکی می‌شود؛ نام محصول باید متمایزتر شود.');
        else put('seo_title', v, codes.has('seo_no_title'), item.metaTitle);
      } else skipped.push((pg && pg.title_why) || 'عنوان سئوی معتبر از متن فعلی ساخته نشد.');
    }
    if (['seo_no_meta', 'seo_meta_len', 'seo_dup_meta', 'seo_meta_unrelated'].some((k) => codes.has(k))) {
      const v = String(gen.meta_description || '').trim();
      if (Policy.metaAcceptable(v) && !Policy.lintField('meta', v, { evidence: item.title + ' ' + text }).length) put('meta_description', v, codes.has('seo_no_meta'), item.metaDescription); else skipped.push((pg && pg.meta_why) || 'توضیحات متای معتبر (۷۰ تا ۱۷۰ نویسه) از متن فعلی ساخته نشد.');
    }
    if (codes.has('seo_no_focus') || codes.has('seo_focus_absent')) {
      const v = String(gen.focus_keyword || '').trim();
      if (v && len(v) <= 120) put('focus_keyword', v, codes.has('seo_no_focus'), item.focusKeyword); else skipped.push('عبارت کلیدی مطمئن پیدا نشد.');
    }
    if (locked) ['seo_title', 'meta_description'].forEach((k) => { if (fields[k] && tiers[k] !== 'auto') { delete fields[k]; delete tiers[k]; if (!skipped.includes(gd.reason)) skipped.push(gd.reason); } });
    if (codes.has('excerpt_missing')) {
      const ex = deriveExcerpt(text);
      if (ex) { fields.excerpt = ex; tiers.excerpt = 'approve'; } else skipped.push('خلاصهٔ کوتاه معتبر از متن فعلی ساخته نشد.');
    }
    return { fields, tiers, blocked: '', skipped, why: whyMap(fields) };
  }

  /**
   * Deterministic text/markup corrections for one loaded item (full content needed). `o.locked` = page-builder content: only plain fields are touched.
   * Returns { fields, changes, count, rejected }. Nothing is invented: the engine only fixes characters, spacing, punctuation, headings, alt and rel.
   */
  function planPolish(item, o) {
    const opt = o || {}; const out = { fields: {}, changes: {}, count: 0, rejected: '' }; if (!Polish || !item) return out;
    const add = (k, v, ch) => { out.fields[k] = v; Object.keys(ch || {}).forEach((c) => { out.changes[c] = (out.changes[c] || 0) + ch[c]; out.count += ch[c]; }); };
    if (!opt.locked && item.content != null && String(item.content).trim()) {
      const r = Polish.polishContent(String(item.content), { title: item.title, markup: opt.markup, headings: opt.headings, alt: opt.alt });
      if (r.changed) add('content', r.html, r.changes); else if (r.rejected) out.rejected = r.rejected;
    }
    const ex = String(item.excerpt || ''); if (ex.trim()) { const r = Polish.fixHtml(ex); if (r.count && r.html.trim() !== ex.trim()) add('excerpt', r.html.trim(), r.changes); }
    [['seo_title', item.metaTitle], ['meta_description', item.metaDescription]].forEach(([k, v]) => { const cur = String(v || '').trim(); if (cur) { const r = Polish.fixPlain(cur); if (r.count && r.text !== cur) add(k, r.text, r.changes); } });
    return out;
  }
  /** Keeps duplicate-detection maps current while a batch runs, so two items can never receive the same new title/meta. */
  function noteApplied(ctx, fields, id) {
    if (!ctx || !fields) return;
    if (fields.content && id != null && ctx.index && ctx.index.add) ctx.index.add(id, fields.content); // v1.76: the next product in this run is made different from this one
    if (fields.seo_title && ctx.titleCounts) { const k = norm(fields.seo_title); ctx.titleCounts.set(k, (ctx.titleCounts.get(k) || 0) + 1); }
    if (fields.meta_description && ctx.metaCounts) { const k = norm(fields.meta_description); ctx.metaCounts.set(k, (ctx.metaCounts.get(k) || 0) + 1); }
  }

  /** Short description = the first real sentences of the product's own text (no new claims). */
  function deriveExcerpt(text) {
    const sentences = plain(text).split(/(?<=[.!؟?])\s+/).map((x) => x.trim()).filter((x) => x.length > 15); let out = '';
    for (const x of sentences) { if (len(out + ' ' + x) > 280) break; out = (out ? out + ' ' : '') + x; if (len(out) >= 60) break; }
    return len(out) >= 45 ? out : '';
  }

  /**
   * v1.31 "text maker": gathers every real statement the site ALREADY holds about an item (own short text, excerpt, meta description,
   * categories/tags, and the old body only when it was not diagnosed as wrong). Product attributes/weight/dimensions are added later by Agent.productFacts.
   * Nothing is invented; the result is the evidence string handed to planContent.
   */
  // Sales copy is not a fact about the product: such lines (often the old meta description) must never become body text.
  const PROMO = /(ضمانت اصالت|ارسال سریع|ارسال رایگان|تهیه کن|خرید کن|همین حالا|سفارش دهید|سفارش بده|تخفیف|فروشگاه|با کیفیت بالا|بهترین قیمت|جزئیات را ببین)/;
  function harvestFacts(item, diag) {
    const wrongText = !!(diag && diag.problems.some((x) => WRONG_CODES.includes(x.code))); const lines = []; const t = norm(item.title);
    const add = (v) => plain(v).split(/[\n؛;•]+|(?<=[.!؟?])\s+/).map((x) => x.trim().replace(/[.!؟?؛:،\s]+$/, '')).filter((x) => len(x) > 12 && norm(x) !== t && !PLACEHOLDERS.some((re) => re.test(x)) && !PROMO.test(x)).forEach((x) => lines.push(x));
    add(item.short_description); add(item.excerpt); if (!wrongText) { add(item.metaDescription); add(item.content || item.contentPreview || ''); }
    const names = (arr) => (Array.isArray(arr) ? arr : []).map((x) => (x && typeof x === 'object' ? x.name || x.label : x)).map((x) => plain(x)).filter((x) => x && x.length < 60);
    const cats = names(item.categories || (item.product && item.product.categories)), tags = names(item.tags || (item.product && item.product.tags));
    if (cats.length) lines.push('دسته‌بندی: ' + cats.join('، ')); if (tags.length) lines.push('برچسب‌ها: ' + tags.join('، '));
    return [...new Set(lines)].join('\n');
  }

  /** What the owner should type so a product description can be written without guessing. */
  function factsChecklist(item) {
    const p = item && item.product || {}; const have = Agent && Agent.productFacts ? Agent.productFacts({ facts: '', product: p }) : [];
    const ask = kindOf(item) === 'product' ? ['جنس یا ترکیب', 'ابعاد یا وزن', 'کاربرد و روش استفاده', 'سازگاری یا مناسب چه کسی/چه چیزی است', 'شرایط نگهداری یا محدودیت‌ها'] : ['نکات و داده‌های قطعی مقاله (هر مورد در یک خط)', 'منبع یا لینک مرجع هر ادعای مهم', 'مخاطب و هدف مقاله', 'نتیجه‌گیری مدنظر'];
    return { have, ask };
  }

  /**
   * Builds a content repair draft. `io.generate({ title, facts, item })` must return { content, excerpt, seo_title, meta_description, focus_keyword, keywords }.
   * Old text is used as evidence only when it was not diagnosed as wrong. Returns { status: 'ready' | 'needs_facts' | 'rejected', … }.
   */
  async function planContent(item, diag, io, opts) {
    const o = opts || {}; const kind = kindOf(item); const wrongText = diag.problems.some((x) => WRONG_CODES.includes(x.code));
    const oldText = plain(item.content || item.contentPreview || '');
    const evidence = [o.facts || '', wrongText ? '' : oldText].filter(Boolean).join('\n');
    const rows = Agent && Agent.productFacts ? Agent.productFacts({ facts: evidence, product: item.product || {} }) : [];
    const evChars = plain(evidence).length;
    if (kind === 'product' ? (rows.length < 2 && evChars < 90) : (evChars < 300 && rows.length < 4)) return { status: 'needs_facts', reason: 'برای نوشتن توضیح درست، اطلاعات واقعی کافی نیست.', checklist: factsChecklist(item), have: rows, ignoredOldText: wrongText && oldText.length > 0 };
    let g; try { g = await io.generate({ title: item.title, facts: kind === 'article' ? plain(evidence) : rows.join('؛ '), item, kind }); } catch (e) { return { status: 'rejected', reason: String(e && e.message || e).slice(0, 220) }; }
    g = g || {}; const content = String(g.content || '').trim(); const reasons = [];
    if (plain(content).length < (kind === 'product' ? 120 : 500)) reasons.push('متن تولیدشده بسیار کوتاه است.');
    if (PLACEHOLDERS.some((re) => re.test(plain(content)))) reasons.push('متن تولیدشده الگوی placeholder دارد.');
    const tk = tokens(item.title); if (tk.length >= 2 && !tk.some((t) => norm(content).includes(t))) reasons.push('متن تولیدشده به نام محصول اشاره نمی‌کند.');
    let similar = [];
    if (o.index) { const s = shingleSet(content); if (s.size) similar = o.index.similarTo(s, item.id, 3); if (similar[0] && similar[0].score >= 50) reasons.push('متن تولیدشده ' + similar[0].score + '٪ به محصول دیگری شبیه است.'); }
    const prod = kind === 'product' ? item.product : null; if (prod) factConflicts(content, prod).forEach((x) => reasons.push('متن تولیدشده: ' + x));
    const google = Policy.auditContent(content, { focus: g.focus_keyword || item.focusKeyword || '', title: item.title, kind, evidence: evidence + ' ' + item.title }); google.blockers.forEach((b) => reasons.push('دروازهٔ کیفیت گوگل: ' + b.detail));
    if (reasons.length) return { status: 'rejected', reason: reasons.join(' '), similar };
    const fields = { content }; const tiers = { content: 'review' };
    const add = (k, v) => { const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); if (s) { fields[k] = s; tiers[k] = 'review'; } };
    if (plain(g.excerpt).length >= 45) add('excerpt', plain(g.excerpt));
    if (Policy.titleAcceptable(g.seo_title)) add('seo_title', g.seo_title);
    if (Policy.metaAcceptable(g.meta_description)) add('meta_description', g.meta_description);
    if (g.focus_keyword && len(g.focus_keyword) <= 120) add('focus_keyword', g.focus_keyword);
    if (Array.isArray(g.keywords) && g.keywords.length) add('related_keywords', g.keywords.slice(0, 10).join(', '));
    return { status: 'ready', google, fields: sanitize(fields), tiers, similar, notes: Array.isArray(g.notes) ? g.notes : [], quality: kind === 'article' ? (Agent && Agent.auditContent ? Agent.auditContent({ title: item.title, content, focusKeyword: fields.focus_keyword, kind: 'article' }) : null) : Agent && Agent.auditProductContent ? Agent.auditProductContent({ title: item.title, content, excerpt: fields.excerpt, focusKeyword: fields.focus_keyword, facts: rows.join('؛ '), product: item.product || {}, seoTitle: fields.seo_title, metaDescription: fields.meta_description }) : null };
  }

  /** Keeps only allowed, non-empty, bounded fields. */
  function sanitize(fields) {
    const out = {}; Object.keys(fields || {}).forEach((k) => {
      if (!ALLOWED.includes(k)) return; const v = String(fields[k] == null ? '' : fields[k]).trim(); if (!v) return;
      if (k === 'seo_title' && !Policy.titleAcceptable(v)) return; if (k === 'meta_description' && !Policy.metaAcceptable(v)) return; if (k === 'focus_keyword' && len(v) > Policy.LIMITS.focus.maxChars) return; if (k === 'content' && v.length > 170000) return;
      out[k] = v;
    }); return out;
  }

  /** Before/after rows for the review card. */
  function diffRows(current, fields) {
    const label = { content: 'توضیحات کامل', excerpt: 'توضیح کوتاه', seo_title: 'عنوان سئو', meta_description: 'توضیحات متا', focus_keyword: 'عبارت کلیدی', related_keywords: 'کلمات مرتبط' };
    const cur = { content: current.content || current.contentPreview || '', excerpt: current.excerpt || '', seo_title: current.metaTitle || '', meta_description: current.metaDescription || '', focus_keyword: current.focusKeyword || '', related_keywords: current.relatedKeywords || '' };
    return Object.keys(fields || {}).filter((k) => ALLOWED.includes(k)).map((k) => ({ field: k, label: label[k], why: Policy.whyFor(k), before: k === 'content' ? plain(cur[k]) : String(cur[k] || ''), after: k === 'content' ? plain(fields[k]) : fields[k], empty: !plain(cur[k]) }));
  }

  /**
   * Batch "safe fix": only fills EMPTY seo fields from each product's own trusted text. Never touches content or non-empty values.
   * io: { loadItem(id) -> detail, save(payload) -> { no_change, change_id, applied }, remaining, brand, shouldStop(), onProgress(info) }
   */
  async function runSafe(io, diagnoses, opts) {
    const o = opts || {}; const report = { at: Date.now(), dryRun: !!o.dryRun, total: diagnoses.length, scanned: 0, planned: 0, applied: 0, skipped: 0, blocked: 0, failed: 0, stoppedBy: '', journal: [], failures: [] };
    let consecFail = 0, consecUnver = 0;
    let remaining = Math.max(0, Number(io.remaining || 0)); if (!o.dryRun && !remaining) { report.stoppedBy = 'quota'; return report; }
    for (const d of diagnoses) {
      if (io.shouldStop && io.shouldStop()) { report.stoppedBy = 'user'; break; }
      if (!o.dryRun && remaining <= 0) { report.stoppedBy = 'quota'; break; }
      report.scanned++;
      try {
        if (!d.problems.some((x) => x.fix === 'auto' && !POLISH_CODES.includes(x.code))) { report.skipped++; continue; }
        const detail = await io.loadItem(d.id); if (!detail || !detail.revision) { report.skipped++; continue; }
        const item = Object.assign({}, detail, { metaTitle: detail.metaTitle != null ? detail.metaTitle : detail.seo_title, metaDescription: detail.metaDescription != null ? detail.metaDescription : detail.meta_description, focusKeyword: detail.focusKeyword != null ? detail.focusKeyword : detail.focus_keyword, type: detail.type || 'product' });
        const fresh = diagnose(item, o.ctx ? Object.assign({}, o.ctx, { dupMap: o.ctx.dupMap }) : {});
        const cx = o.ctx || {}; const plan = planSeo(item, fresh, { brand: io.brand, guard: io.guard, titleCounts: cx.titleCounts, metaCounts: cx.metaCounts, fromName: o.fromName });
        if (plan.blocked) { report.blocked++; continue; }
        const fields = {}; Object.keys(plan.fields).forEach((k) => { if (plan.tiers[k] === 'auto' && AUTO_FIELDS.includes(k)) fields[k] = plan.fields[k]; });
        if (!Object.keys(fields).length) { report.skipped++; continue; }
        report.planned++;
        if (o.dryRun) { if ((report.samples = report.samples || []).length < (o.sample || 5)) report.samples.push({ id: item.id, title: item.title, fields: Object.assign({}, fields) }); if (io.onProgress) io.onProgress({ scanned: report.scanned, total: report.total, applied: report.applied }); continue; }
        const res = await io.save({ action: 'update', mode: 'automatic', post_id: item.id, expected_revision: detail.revision, fields });
        if (res && !res.no_change) { report.applied++; remaining--; noteApplied(o.ctx, fields); const je = { post_id: item.id, title: item.title, url: item.url || '', change_id: res.change_id || '', fields: Object.keys(fields), before: {} }; Object.keys(fields).forEach((k) => { je.before[k] = String({ seo_title: item.metaTitle, meta_description: item.metaDescription, focus_keyword: item.focusKeyword }[k] || '').slice(0, 2000); }); if (io.snapshot) { try { je.metrics = io.snapshot(item.url || ''); } catch (e) {} } if (io.verify) { try { const v = await io.verify(item.id, fields); je.verified = v.ok; if (!v.ok) { report.unverified = (report.unverified || 0) + 1; je.verify_problem = v; consecUnver++; } else consecUnver = 0; } catch (e) { je.verified = null; } } report.journal.push(je); consecFail = 0; if (consecUnver >= 3) { report.stoppedBy = 'unverified'; break; } } else report.skipped++;
      } catch (err) {
        consecFail++;
        const msg = String(err && err.message || err); report.failed++; if (report.failures.length < 6) report.failures.push((d.title || d.id) + ': ' + msg);
        if (/سقف روزانه/.test(msg)) { report.stoppedBy = 'quota'; break; }
        if (consecFail >= 5) { report.stoppedBy = 'errors'; break; }
      }
      if (io.onProgress) io.onProgress({ scanned: report.scanned, total: report.total, applied: report.applied });
    }
    return report;
  }

  /** Brand for titles: an explicit owner value wins; the site name is used only when it is short and clean (a long tagline would pollute every title). */
  function resolveBrand(explicit, siteName) {
    const e = plain(explicit || '').trim(); if (e) return { brand: e, source: 'explicit' };
    const s = plain(siteName || '').split(/\s*[|–—•·»«:]\s*|\s+-\s+/)[0].trim(); if (s && len(s) <= 22 && s.split(' ').length <= 3) return { brand: s, source: 'site' };
    return { brand: '', source: s ? 'rejected' : 'none' };
  }

  function summarize(r) {
    if (!r) return '';
    const stop = r.stoppedBy === 'quota' ? ' (به سقف روزانه رسید؛ اجرای بعدی ادامه می‌دهد)' : r.stoppedBy === 'user' ? ' (توسط کاربر متوقف شد)' : '';
    return (r.dryRun ? 'پیش‌نمایش ترمیم امن' : 'ترمیم امن') + ': بررسی ' + r.scanned + ' از ' + r.total + ' · قابل‌اصلاح ' + r.planned + ' · اعمال ' + r.applied + ' · نیازمند متن درست ' + r.blocked + ' · خطا ' + r.failed + (r.unverified ? ' · ذخیره‌نشده در سایت ' + r.unverified : '') + stop;
  }

  return { finalGate, TYPES, kindOf, ALLOWED, AUTO_FIELDS, WRONG_CODES, POLISH_CODES, harvestFacts, planPolish, noteApplied, DEF, PLACEHOLDERS, plain, norm, tokens, buildIndex, shingleSet, templateShare, diagnose, scan, textTrusted, planSeo, buildSeo, deriveExcerpt, planContent, factsChecklist, sanitize, diffRows, runSafe, summarize, weightGrams, weightMentions, factConflicts, dimMentions, resolveBrand };
});
