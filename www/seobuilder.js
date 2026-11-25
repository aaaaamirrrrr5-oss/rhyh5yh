/* Site Inspector — seobuilder.js (v1.90.0)  SI.SeoBuilder
 * «سازندهٔ سئوی یکپارچه»: به‌جای یک عنوان و یک متای ثابت از نام محصول، چند کاندیدا می‌سازد، هرکدام را با اصول SeoPolicy
 * (پیکسل، یکتایی، ادعای بی‌پشتوانه، کلیدواژه‌چینی) می‌سنجد و بهترین را با دلیل برمی‌گزیند؛ جایگزین‌ها هم می‌ماند.
 * علاوه بر عنوان/متا/عبارت کلیدی، بستهٔ کامل را می‌سازد: خلاصه، کلمات مرتبط، اسلاگ، alt تصویر، Open Graph، Product/FAQ/Breadcrumb schema،
 * و «چک‌لیست ۱۰۰ امتیازی» قبل/بعد با فهرست اولویت‌دار آنچه فقط صاحب فروشگاه می‌تواند وارد کند.
 * هیچ چیز ساخته نمی‌شود که در نام یا دادهٔ ثبت‌شدهٔ محصول نباشد. Pure، بدون DOM و شبکه، UMD. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./fromname.js'), require('./seopolicy.js'), require('./seoextra.js'));
  else (root.SI = root.SI || {}).SeoBuilder = factory(root.SI && root.SI.FromName, root.SI && root.SI.SeoPolicy, root.SI && root.SI.SeoExtra);
})(typeof self !== 'undefined' ? self : this, function (FromName, Policy, SeoExtra) {
  'use strict';
  const len = (s) => Array.from(String(s == null ? '' : s)).length;
  const fixc = (s) => String(s == null ? '' : s).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[ً-ٟ]/g, '');
  const plain = (s) => fixc(String(s == null ? '' : s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')).replace(/\s+/g, ' ').trim();
  const norm = (s) => plain(s).replace(/‌/g, ' ').toLowerCase(); /* همان norm فرم‌نیم تا کلیدهای «تکراری‌بودن» یکی باشد */
  const words = (s) => norm(s).split(/[\s|–—:،؛,.!؟?\-()]+/).filter((w) => w.length > 1);
  const uniq = (a) => a.filter((x, i) => x && a.indexOf(x) === i);
  const faN = (v) => String(v).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const L = Policy.LIMITS;
  const fit = (s, max) => { s = String(s).replace(/\s+/g, ' ').trim(); if (len(s) <= max) return s; let acc = ''; for (const x of s.split(' ')) { const n = acc ? acc + ' ' + x : x; if (len(n) > max) break; acc = n; } return acc.replace(/[\s،؛:,\-–|]+$/, ''); };
  const has = (hay, needle) => !!needle && norm(hay).includes(norm(needle));
  const jaccard = (a, b) => { const A = new Set(words(a)), B = new Set(words(b)); if (!A.size || !B.size) return 0; let i = 0; A.forEach((w) => { if (B.has(w)) i++; }); return i / (A.size + B.size - i); };
  const isTaken = (fn, v) => { try { return !!(fn && fn(norm(v))); } catch (e) { return false; } };

  /** جملهٔ آغازین واقعی مقاله برای متا: از نخستین بندِ کافی، جمله‌به‌جمله تا ۱۵۰ نویسه (بدون زیرعنوان‌ها). */
  function leadOf(it) {
    const ex = plain(it.excerpt); const pick = (txt) => { let acc = ''; (txt.match(/[^.!؟?]+[.!؟?]?/g) || []).forEach((x) => { const n = (acc ? acc + ' ' : '') + x.trim(); if (len(n) <= 150 && !acc.endsWith('…')) acc = n; else if (!acc) acc = fit(x.trim(), 147); }); return acc; };
    if (len(ex) >= 70) return pick(ex);
    const ps = (String(it.content || '').match(/<p[^>]*>[\s\S]*?<\/p>/gi) || []).map(plain).filter((x) => len(x) >= 70); return ps.length ? pick(ps[0]) : '';
  }

  /* ---------- عبارت کلیدی ---------- */
  function focusCandidates(p, rows, o) {
    let base = FromName.focus(p); const out = [];
    if (o.kind === 'article') { const GEN = new Set(['راهنمای', 'آموزش', 'چگونه', 'نحوه', 'روش', 'همه', 'هر', 'آنچه', 'بهترین', 'معرفی']); const ws = plain(p.name).split(' ').filter(Boolean); while (ws.length > 2 && GEN.has(ws[0])) ws.shift(); base = ws.slice(0, 3).join(' '); } const nameN = norm(p.name);
    const row = (k) => (rows.find((r) => r[0] === k) || [])[1] || '';
    const type = p.type || (p.words || []).slice(0, 2).join(' '); const model = (p.models || [])[0] || ''; const brand = p.brand || '';
    const add = (kw, kind, why) => { kw = plain(kw).replace(/[&+|/\\<>=_*#@~^]+/g, ' ').replace(/^[\s\-–—:،؛,.!؟?()«»"']+|[\s\-–—:،؛,.!؟?()«»"']+$/g, '').replace(/\s+/g, ' ').trim().split(' ').filter((w, i, a) => i === 0 || norm(w) !== norm(a[i - 1])).join(' '); const n = kw.split(' ').length; if (len(kw) < 3 || n > L.focus.maxWords || len(kw) > L.focus.maxChars) return; if (!out.some((x) => norm(x.text) === norm(kw))) out.push({ text: kw, kind, why }); };
    add(base, 'اصلی', 'ترکیب نوع محصول و مشخصهٔ متمایز از نام');
    add(type, 'کلی', 'نوع محصول؛ پرجست‌وجو ولی رقابتی');
    if (model) add(type + ' ' + model, 'مدل', 'نوع + مدلِ نام محصول؛ هدف‌گیری دقیق');
    if (brand && type) add(brand + ' ' + type, 'برند', 'برند + نوع؛ مناسب جست‌وجوی برند‌محور');
    if (p.materials && p.materials[0] && type) add(type + ' ' + p.materials[0], 'ویژگی', 'نوع + جنس ثبت‌شده در نام');
    if (p.colors && p.colors[0] && type) add(type + ' ' + p.colors[0], 'ویژگی', 'نوع + رنگ ثبت‌شده در نام');
    const taken = o.takenFocus;
    return out.map((c, i) => {
      const n = c.text.split(' ').length; let s = 55; const why = [c.why];
      if (n >= 2 && n <= 3) { s += 12; why.push('۲ تا ۳ واژه (ایده‌آل)'); } else if (n === 1) { s -= 14; why.push('تک‌واژه بسیار کلی است'); } else if (n > 4) { s -= 10; }
      if (norm(c.text) === norm(base)) s += 8; if (nameN.includes(norm(c.text))) { s += 8; why.push('عیناً در نام محصول آمده'); }
      if (c.kind === 'مدل' || c.kind === 'برند') s += 3;
      if (isTaken(taken, c.text)) { s -= 35; why.push('کلیدواژهٔ محصول دیگر هم هست (هم‌خوارگی)'); } else if (taken) why.push('یکتا در فروشگاه');
      return Object.assign({}, c, { score: Math.round(s - i * 0.2), reasons: why });
    }).sort((a, b) => b.score - a.score);
  }

  /* ---------- عنوان سئو ---------- */
  function mkTitle(prefix, name, suffix, minName) {
    const make = (n) => (prefix + n + suffix).replace(/\s+/g, ' ').trim();
    let t = make(name); if (Policy.titleFits(t)) return { text: t, trimmed: false };
    const w = name.split(' '); while (w.length > minName) { w.pop(); const x = make(w.join(' ').replace(/[\s،؛:,\-–|]+$/, '')); if (Policy.titleFits(x)) return { text: x, trimmed: true }; }
    return null;
  }
  function titleCandidates(p, rows, focus, o) {
    const name = p.name; const brand = String(o.brand || p.brand || '').trim(); const hasBrand = brand && norm(name).includes(norm(brand));
    const site = String(o.siteName || '').trim(); const cat = ((rows.find((r) => r[0] === 'دسته‌بندی') || [])[1] || '').split('،')[0].trim();
    const never = (o.rules || {}).buyPrefix === 'never'; const B = never ? '' : 'خرید ';
    const minName = Math.max(1, Math.min(3, (focus || '').split(' ').length));
    const art = o.kind === 'article';
    const pats = art ? [['name', '', '', 'نام مقاله']] : [['buy', B, '', 'خرید + نام'], ['buy_spec', B, ' – مشخصات و قیمت', 'نام + مشخصات و قیمت'], ['spec', '', ' – مشخصات و قیمت', 'نام + مشخصات و قیمت'], ['price_buy', never ? 'قیمت ' : 'قیمت و خرید ', '', 'قیمت و خرید'], ['name_buy', '', ' | خرید و قیمت', 'نام | خرید و قیمت'], ['bare', '', '', 'فقط نام']];
    if (art) { if (site) pats.push(['site', '', ' | ' + site, 'نام سایت در انتها']); if (cat && !norm(name).includes(norm(cat)) && len(cat) < 25) pats.push(['cat', '', ' | ' + cat, 'دستهٔ مطلب در انتها']); }
    if (!art && brand && !hasBrand) pats.push(['buy_brand', B, ' | ' + brand, 'برند در انتها'], ['spec_brand', '', ' – مشخصات | ' + brand, 'مشخصات + برند']);
    if (!art && site && norm(site) !== norm(brand)) pats.push(['site', '', ' | ' + site, 'نام سایت در انتها'], ['buy_site', B, ' | ' + site, 'خرید + نام سایت']);
    if (!art && cat && !norm(name).includes(norm(cat)) && len(cat) < 25) pats.push(['cat', '', ' | ' + cat, 'دستهٔ محصول در انتها']);
    const out = [];
    pats.forEach((pt, i) => {
      const m = mkTitle(pt[1], name, pt[2], minName); if (!m) return; const t = m.text; if (out.some((x) => norm(x.text) === norm(t))) return;
      const lint = Policy.lintField('title', t, { evidence: name + ' ' + (o.evidence || '') }); if (lint.length) return;
      const c = Policy.checkTitle(t); let s = 50; const why = [];
      s += 12; why.push(c.len + ' نویسه / ' + c.px + ' پیکسل؛ بریده نمی‌شود'); if (c.px <= 540) s += 3;
      const f = norm(focus); if (f && !norm(t).includes(f)) { s -= 25; why.push('عبارت کلیدی در عنوان نیست'); } else if (f) { if (norm(t).startsWith(f) || norm(t).startsWith('خرید ' + f) || norm(t).startsWith('قیمت و خرید ' + f)) { s += 10; why.push('عبارت کلیدی در ابتدای عنوان'); } else { s += 4; why.push('عبارت کلیدی در عنوان'); } }
      if (brand && has(t, brand)) { s += 6; why.push('برند در عنوان'); }
      if ((p.models || []).some((x) => has(t, x))) { s += 5; why.push('مدل در عنوان'); }
      if (/(خرید|قیمت)/.test(t) && o.kind !== 'article') { s += 5; why.push('نیت خرید روشن'); }
      if (c.len >= 35 && c.len <= 58) s += 5;
      if (m.trimmed) { s -= 12; why.push('نام برای جا شدن کوتاه شد'); }
      const tk = isTaken(o.takenTitle, t); if (tk) { s -= 45; why.push('عنوان محصول دیگری است'); } else if (o.takenTitle) { s += 8; why.push('یکتا در فروشگاه'); }
      out.push({ text: t, pattern: pt[0], label: pt[3], chars: c.len, px: c.px, score: Math.round(s - i * 0.3), reasons: why, unique: !tk });
    });
    return out.sort((a, b) => b.score - a.score);
  }

  /* ---------- متا ---------- */
  function metaCandidates(p, rows, focus, title, o) {
    const name = p.name; const site = String(o.siteName || o.site || '').trim(); const get = (k) => (rows.find((r) => r[0] === k) || [])[1];
    /* فقط مشخصه‌هایی که در نام نیامده‌اند (از دادهٔ ثبت‌شدهٔ فروشگاه)؛ تکرار نام در متا ارزشی ندارد. */
    const inName = (r) => norm(name).includes(norm(r[1]));
    const bits = rows.filter((r) => !['نوع محصول', 'دسته‌بندی'].includes(r[0]) && !inName(r)).map((r) => r[0] + ' ' + r[1]);
    const attrs = bits, dims = [];
    const cat = (get('دسته‌بندی') || '').split('،')[0].trim();
    const T = [];
    T.push(['facts', name + (bits.length ? ' با ' + bits.slice(0, 3).join('، ') : '') + '؛ مشخصات، قیمت و جزئیات خرید را در همین صفحه ببینید.', 'مشخصات واقعی + دعوت به مرور']);
    T.push(['site', name + '؛ مشخصات کامل، قیمت و شرایط خرید' + (site ? ' از ' + site : '') + ' در این صفحه آمده است.' + (bits.length ? ' ' + bits[0] + '.' : ''), 'نام فروشگاه + مشخصات']);
    T.push(['compare', 'مشخصات و قیمت ' + name + (bits.length ? ' (' + bits.slice(0, 2).join('، ') + ')' : '') + ' را ببینید و با نیاز خود مقایسه کنید.', 'دعوت به مقایسه']);
    T.push(['plain', name + ' را با مشخصات ثبت‌شده، قیمت و جزئیات خرید در همین صفحه ببینید و با نیاز خود مقایسه کنید.', 'ساده و کامل']);
    if (cat) T.push(['cat', name + ' از دستهٔ ' + cat + (bits.length ? ' با ' + bits.slice(0, 2).join('، ') : '') + '؛ مشخصات و قیمت را پیش از خرید در این صفحه مرور کنید.', 'دسته + مشخصات']);
    if (bits.length >= 2) T.push(['review', 'پیش از خرید ' + name + '، مشخصات (' + bits.slice(0, 3).join('، ') + ') و قیمت را در این صفحه مرور کنید.', 'مرور پیش از خرید']);
    if (o.kind === 'article') {
      T.length = 0; const lead = plain(o.lead || '').replace(/\s+/g, ' '); const sites = site ? ' در ' + site : '';
      if (len(lead) >= 70) T.push(['lead', lead, 'از ابتدای خود متن مقاله']);
      T.push(['read', name + '؛ این مطلب را' + sites + ' بخوانید و با نیاز خود تطبیق دهید.', 'دعوت به خواندن']);
      T.push(['read2', 'مطلب «' + name + '»' + sites + '؛ برای مطالعهٔ کامل به این صفحه سر بزنید و بخش‌های مرتبط را ببینید.', 'مطالعهٔ کامل']);
      if (cat) T.push(['cat', name + '؛ مطلبی از دستهٔ ' + cat + sites + ' که در همین صفحه می‌توانید بخوانید.', 'دسته + دعوت']);
    }
    const out = [];
    T.forEach((tp, i) => {
      let v = tp[1].replace(/\s+/g, ' '); if (len(v) > L.meta.target) v = fit(v, L.meta.target - 3).replace(/[،؛\s]+$/, '') + '.';
      if (!Policy.metaFits(v) || out.some((x) => norm(x.text) === norm(v))) return;
      const lint = Policy.lintField('meta', v, { evidence: name + ' ' + (o.evidence || '') }); if (lint.length) return;
      const c = Policy.checkMeta(v); let s = 50; const why = [];
      if (c.len >= L.meta.idealMin && c.len <= L.meta.target) { s += 14; why.push(c.len + ' نویسه؛ در بازهٔ ایده‌آل'); } else if (c.len >= 100) { s += 6; why.push(c.len + ' نویسه؛ کمی کوتاه‌تر از ایده‌آل'); } else why.push(c.len + ' نویسه؛ کوتاه');
      if (focus && has(v, focus)) { s += 10; why.push('عبارت کلیدی در متا'); } else if (focus) { s -= 15; why.push('عبارت کلیدی در متا نیست'); }
      if (/(ببینید|مقایسه|مرور|پیش از خرید|بخوانید|مطالعه)/.test(v)) { s += 5; why.push('دعوت به اقدام'); }
      const used = bits.filter((b) => has(v, b)).length; if (tp[0] === 'lead') { s += 10; why.push('برگرفته از متن واقعی'); } if (used) { s += Math.min(12, used * 4); why.push(used + ' مشخصهٔ واقعی'); }
      const ov = jaccard(v, title || ''); if (ov > 0.8) { s -= 12; why.push('بیش از حد شبیه عنوان'); }
      const tk = isTaken(o.takenMeta, v); if (tk) { s -= 45; why.push('متای محصول دیگری است'); } else if (o.takenMeta) { s += 8; why.push('یکتا در فروشگاه'); }
      out.push({ text: v, pattern: tp[0], label: tp[2], chars: c.len, score: Math.round(s - i * 0.3), reasons: why, unique: !tk });
    });
    return out.sort((a, b) => b.score - a.score);
  }

  /* ---------- کلمات مرتبط (فقط از واقعیت‌ها) ---------- */
  function relatedKeywords(p, rows, focus, art) {
    const type = p.type || focus; const out = []; const add = (kw, kind) => { kw = plain(kw); if (len(kw) >= 3 && len(kw) <= 60 && !out.some((x) => norm(x.text) === norm(kw))) out.push({ text: kw, kind }); };
    add(focus, 'اصلی'); if (!art) { add('خرید ' + focus, 'تجاری'); add('قیمت ' + focus, 'تجاری'); } else if (!/^(راهنمای|آموزش)/.test(focus)) { add('راهنمای ' + focus, 'اطلاعاتی'); }
    if (p.brand && type) add(p.brand + ' ' + type, 'برند');
    (p.materials || []).slice(0, 1).forEach((m) => add(type + ' ' + m, 'ویژگی'));
    (p.colors || []).slice(0, 1).forEach((c) => add(type + ' ' + c, 'ویژگی'));
    (p.qty || []).slice(0, 1).forEach((q) => add(type + ' ' + q.text, 'ویژگی'));
    (p.models || []).slice(0, 1).forEach((m) => add(type + ' ' + m, 'مدل'));
    const cat = ((rows.find((r) => r[0] === 'دسته‌بندی') || [])[1] || '').split('،')[0].trim(); if (!art && cat && !norm(focus).includes(norm(cat))) add(cat + ' ' + (p.type || ''), 'دسته');
    return out.slice(0, 8);
  }

  /* ---------- چک‌لیست ۱۰۰ امتیازی ---------- */
  function imgInfo(item) { const im = SeoExtra && SeoExtra.imagesOf ? SeoExtra.imagesOf(item) : []; return { total: im.length, noAlt: im.filter((x) => !x.alt).length }; }
  function evaluate(st) {
    const tc = Policy.checkTitle(st.title), mc = Policy.checkMeta(st.meta); const F = norm(st.focus); const k = [];
    const C = (id, label, w, ok, fix, tip) => k.push({ id, label, weight: w, ok: !!ok, fix, tip: ok ? '' : tip });
    C('title', 'عنوان سئو معتبر و بدون بریدگی', 9, tc.ok, 'auto', 'عنوان سئو ' + (tc.reason || 'ندارد') );
    C('title_unique', 'عنوان سئو یکتا', 5, st.title && !st.titleTaken, 'auto', 'عنوان با محصول دیگری یکی است.');
    C('meta', 'توضیحات متا معتبر (۷۰ تا ۱۶۰ نویسه)', 8, mc.ok, 'auto', 'متا ' + (mc.reason || 'ندارد'));
    C('meta_unique', 'توضیحات متا یکتا', 4, st.meta && !st.metaTaken, 'auto', 'متا با محصول دیگری یکی است.');
    C('focus', 'عبارت کلیدی تعیین شده', 4, !!F, 'auto', 'عبارت کلیدی خالی است.');
    C('focus_title', 'عبارت کلیدی در عنوان سئو', 4, F && norm(st.title).includes(F), 'auto', 'عبارت کلیدی در عنوان سئو نیامده.');
    C('focus_meta', 'عبارت کلیدی در متا', 3, F && norm(st.meta).includes(F), 'auto', 'عبارت کلیدی در متا نیامده.');
    C('excerpt', 'خلاصهٔ کوتاه محصول', 3, plain(st.excerpt).length >= 45, 'auto', 'خلاصهٔ کوتاه ندارد.');
    C('slug', 'اسلاگ کوتاه و تمیز', 3, !st.slugIssues, 'review', 'اسلاگ مشکل دارد؛ تغییر آن نیازمند ریدایرکت ۳۰۱ است.');
    C('alt', 'متن جایگزین (alt) همهٔ تصویرها', 5, st.imgs.total > 0 && st.imgs.noAlt === 0, st.imgs.total ? 'auto' : 'manual', st.imgs.total ? faN(st.imgs.noAlt) + ' تصویر alt ندارد.' : 'محصول تصویر ندارد.');
    C('og', 'Open Graph (پیش‌نمایش اشتراک‌گذاری)', 2, st.og, 'auto', 'عنوان/توضیح Open Graph ثبت نشده.');
    const art = st.kind === 'article';
    if (art) {
      C('images', 'دست‌کم یک تصویر شاخص', 3, st.imgs.total >= 1, 'manual', 'تصویر ندارد.');
      C('body', 'متن مقاله (دست‌کم ۶۰۰ واژه)', 14, st.bodyWords >= 600, 'studio', 'متن ' + (st.bodyWords ? 'کوتاه است (' + faN(st.bodyWords) + ' واژه).' : 'ندارد.'));
      C('headings', 'ساختار با زیرعنوان (دست‌کم ۲ h2/h3)', 6, st.headings >= 2, 'studio', 'زیرعنوان کافی ندارد (' + faN(st.headings) + ').');
      C('links', 'دست‌کم یک پیوند داخلی', 5, st.links >= 1, 'manual', 'پیوند داخلی ندارد؛ به مطلب یا محصول مرتبط پیوند بده.');
      C('category', 'مطلب در دسته قرار دارد', 3, st.hasCat, 'manual', 'دسته‌بندی ثبت نشده.');
    } else {
    C('images', 'دست‌کم ۳ تصویر برای محصول', 3, st.imgs.total >= 3, 'manual', 'تصویر کافی نیست (' + faN(st.imgs.total) + ' عدد).');
    C('brand', 'برند محصول مشخص است', 4, st.brand, 'manual', 'برند در نام یا ویژگی‌های محصول نیست.');
    C('category', 'محصول در دسته قرار دارد', 3, st.hasCat, 'manual', 'دسته‌بندی ثبت نشده.');
    C('facts', 'دست‌کم ۴ مشخصهٔ واقعی ثبت‌شده', 8, st.facts >= 4, 'manual', 'فقط ' + faN(st.facts) + ' مشخصه ثبت شده؛ جنس، ابعاد/وزن، برند و کاربرد را وارد کن.');
    C('body', 'متن توضیح محصول (دست‌کم ۱۵۰ واژه)', 10, st.bodyWords >= 150, 'studio', 'متن توضیح ' + (st.bodyWords ? 'کوتاه است (' + faN(st.bodyWords) + ' واژه).' : 'ندارد.'));
    C('price', 'قیمت و واحد پول ثبت‌شده (برای schema)', 5, st.price, 'manual', 'قیمت یا واحد پول نیست؛ Product schema کامل نمی‌شود.');
    C('faq', 'پرسش‌های متداول (دست‌کم ۲ پرسش از واقعیت‌ها)', 3, st.faq >= 2, 'manual', 'واقعیت کافی برای FAQ نیست.');
    }
    C('crumb', 'مسیر ناوبری (Breadcrumb)', 2, st.hasCat && st.hasUrl, 'auto', 'بدون دسته یا آدرس، Breadcrumb ساخته نمی‌شود.');
    /* دادهٔ ناشناخته (ردیف فهرستِ خلاصه: بدون متن کامل/مشخصات/تصویر) گپ حساب نمی‌شود؛ «بررسی عمیق» یا باز کردن محصول آن‌ها را می‌سنجد. */
    const unk = new Set(st.unknown || []); const kk = k.filter((c) => !unk.has(c.id));
    const total = kk.reduce((a, c) => a + c.weight, 0), got = kk.filter((c) => c.ok).reduce((a, c) => a + c.weight, 0);
    return { score: total ? Math.round((got / total) * 100) : 0, checks: kk, unknown: Array.from(unk) };
  }
  const gradeOf = (n) => (n >= 85 ? { id: 'great', label: 'عالی' } : n >= 70 ? { id: 'good', label: 'خوب' } : n >= 50 ? { id: 'mid', label: 'متوسط' } : { id: 'weak', label: 'ضعیف' });

  /** سنجش یک متن دلخواه (مثلاً پیشنهاد مدل گوشی یا ویرایش دستی) با همان معیارهای سازنده. */
  function vet(field, text, ctx) {
    const c = ctx || {}; const v = plain(text); const issues = []; const warns = [];
    if (field === 'seo_title') { const k = Policy.checkTitle(v); if (!Policy.titleAcceptable(v)) issues.push(k.reason || 'عنوان نامعتبر'); Policy.lintField('title', v, { evidence: c.evidence }).forEach((x) => issues.push(x.detail)); if (c.focus && !has(v, c.focus)) warns.push('عبارت کلیدی در عنوان نیست.'); if (isTaken(c.takenTitle, v)) issues.push('عنوان محصول دیگری است.'); }
    else if (field === 'meta_description') { const k = Policy.checkMeta(v); if (!Policy.metaAcceptable(v)) issues.push(k.reason || 'متا نامعتبر'); Policy.lintField('meta', v, { evidence: c.evidence }).forEach((x) => issues.push(x.detail)); if (c.focus && !has(v, c.focus)) warns.push('عبارت کلیدی در متا نیست.'); if (isTaken(c.takenMeta, v)) issues.push('متا مربوط به محصول دیگری است.'); if (c.title && jaccard(v, c.title) > 0.8) warns.push('متا بیش از حد شبیه عنوان است.'); }
    else if (field === 'focus_keyword') { if (!v) issues.push('خالی است.'); else { if (v.split(' ').length > L.focus.maxWords) issues.push('بیش از ' + L.focus.maxWords + ' واژه.'); if (len(v) > L.focus.maxChars) issues.push('بیش از حد بلند.'); if (isTaken(c.takenFocus, v)) warns.push('محصول دیگری هم همین کلیدواژه را دارد.'); } }
    return { ok: !issues.length, issues, warns };
  }

  /** ورودی: item {title, categories, product, metaTitle, metaDescription, focusKeyword, content, excerpt, url, type, id}. */
  function build(item, opts) {
    const o = opts || {}; const it = item || {}; const title = plain(it.title);
    if (!FromName || len(title) < 3) return { ok: false, why: 'نام محصول خالی یا بسیار کوتاه است.' };
    const kind = (it.type || 'product') === 'product' ? 'product' : 'article';
    const p = FromName.parseName(title, { brand: o.brand }); const rows = FromName.factRows(p, it);
    const ev = [title, rows.map((r) => r[1]).join(' '), plain(it.content || ''), plain(it.excerpt || ''), o.siteName || ''].join(' ');
    const ctx = { lead: kind === 'article' ? leadOf(it) : '', brand: o.brand, siteName: o.siteName || o.site, rules: o.rules, takenTitle: o.takenTitle, takenMeta: o.takenMeta, takenFocus: o.takenFocus, evidence: ev, kind };
    const fc = focusCandidates(p, rows, ctx); const focus = (fc[0] && fc[0].text) || FromName.focus(p);
    const tc = titleCandidates(p, rows, focus, ctx); const bestTitle = (tc[0] || {}).text || '';
    const mcand = metaCandidates(p, rows, focus, bestTitle, ctx); const bestMeta = (mcand[0] || {}).text || '';
    const nf = FromName.build(it, { brand: o.brand, site: o.siteName || o.site, rules: o.rules }); const excerpt = (nf.ok && nf.fields.excerpt) || '';
    const merged = Object.assign({}, it, { seo_title: bestTitle || it.metaTitle, meta_description: bestMeta || it.metaDescription, focus_keyword: focus, excerpt: plain(it.excerpt) || excerpt });
    let extra = null; try { extra = SeoExtra ? SeoExtra.plan(merged, { brand: o.brand || p.brand, currency: o.currency }) : null; } catch (e) { extra = null; }
    const faq = extra && extra.schema && extra.schema.faq ? extra.schema.faq.mainEntity.length : (nf.ok ? (nf.faq || []).length : 0);
    const imgs = imgInfo(it); const prod = it.product || {}; const hasCat = rows.some((r) => r[0] === 'دسته‌بندی'); const bodyWords = plain(it.content || '').split(/\s+/).filter(Boolean).length;
    const ogHave = !!(plain(it.og_title) || (it.og && it.og.title)); const slugIssues = SeoExtra && it.url ? SeoExtra.diagnoseSlug(it).length : 0;
    const priceOk = Number(String(prod.price != null ? prod.price : '').replace(/[^\d.]/g, '')) > 0 && !!(prod.currency || o.currency);
    const deep = !!(it.product && typeof it.product === 'object'); const bodyKnown = typeof it.content === 'string';
    const unknown = []; if (!(deep || it.images)) unknown.push('images', 'alt', 'og'); if (!deep && kind === 'product') unknown.push('facts', 'price', 'faq'); if (!bodyKnown) unknown.push('body', 'headings', 'links'); if (!Array.isArray(it.categories) && !deep) unknown.push('category', 'crumb');
    const html = String(it.content || ''); const common = { unknown, kind, headings: (html.match(/<h[23][\s>]/gi) || []).length, links: (html.match(/<a\s[^>]*href=/gi) || []).length, imgs, brand: !!(p.brand || o.brand || rows.some((r) => r[0] === 'برند')), hasCat, facts: rows.length, bodyWords, price: kind !== 'product' || priceOk, faq, hasUrl: !!it.url, slugIssues, og: ogHave };
    const curTitle = plain(it.metaTitle), curMeta = plain(it.metaDescription);
    const before = evaluate(Object.assign({ title: curTitle, meta: curMeta, focus: plain(it.focusKeyword), excerpt: it.excerpt, titleTaken: false, metaTaken: false }, common));
    const after = evaluate(Object.assign({}, common, { title: bestTitle, meta: bestMeta, focus, excerpt: merged.excerpt, titleTaken: !(tc[0] || {}).unique && !!o.takenTitle && isTaken(o.takenTitle, bestTitle), metaTaken: !!o.takenMeta && isTaken(o.takenMeta, bestMeta), imgs: { total: imgs.total, noAlt: extra && extra.alt ? 0 : imgs.noAlt }, og: ogHave || !!(extra && Object.keys(extra.og || {}).length), slugIssues: slugIssues, hasCat: hasCat }));
    const missing = after.checks.filter((c) => !c.ok).sort((a, b) => b.weight - a.weight).map((c) => ({ id: c.id, label: c.label, gain: c.weight, fix: c.fix, tip: c.tip }));
    const strong = rows.length >= 4;
    return {
      ok: true, kind, parsed: p, facts: rows,
      focus: { best: focus, alternatives: fc.slice(1, 4), all: fc },
      title: { best: bestTitle, alternatives: tc.slice(1, 4), all: tc },
      meta: { best: bestMeta, alternatives: mcand.slice(1, 4), all: mcand },
      excerpt: merged.excerpt, keywords: relatedKeywords(p, rows, focus, kind === 'article'),
      extra, faq, content: nf.ok ? nf.fields.content : '',
      before: { score: before.score, grade: gradeOf(before.score) }, after: { score: after.score, grade: gradeOf(after.score), checks: after.checks }, beforeChecks: before.checks,
      gain: after.score - before.score, missing, unknown: after.unknown,
      confidence: strong && (tc[0] || {}).unique !== false ? 'high' : (rows.length >= 2 ? 'medium' : 'low'),
      fields: { seo_title: bestTitle, meta_description: bestMeta, focus_keyword: focus, excerpt: merged.excerpt, related_keywords: relatedKeywords(p, rows, focus, kind === 'article').map((x) => x.text).join(', ') },
      ctx: { evidence: ev, focus },
    };
  }

  /** انتخاب کاربر یا خودکار → طرح فیلد برای Repair/ذخیره: خالی = auto، جایگزینی مقدار فعلی = approve. sel: {seo_title:i, meta_description:i, focus_keyword:i} (۰=بهترین). */
  function plan(b, item, sel) {
    if (!b || !b.ok) return { fields: {}, tiers: {}, skipped: [(b && b.why) || 'ساخته نشد.'] };
    const s = sel || {}; const pick = (grp, i) => { const all = grp.all || []; return (all[i == null ? 0 : i] || all[0] || {}).text || ''; };
    const cur = { seo_title: plain(item.metaTitle), meta_description: plain(item.metaDescription), focus_keyword: plain(item.focusKeyword) };
    const want = { seo_title: pick(b.title, s.seo_title), meta_description: pick(b.meta, s.meta_description), focus_keyword: pick(b.focus, s.focus_keyword) };
    const fields = {}, tiers = {}, skipped = [];
    Object.keys(want).forEach((k) => { const v = want[k]; if (!v) { skipped.push('برای «' + k + '» کاندیدای معتبر ساخته نشد.'); return; } if (norm(v) === norm(cur[k])) return; fields[k] = v; tiers[k] = cur[k] ? 'approve' : 'auto'; });
    return { fields, tiers, skipped };
  }

  /** خلاصهٔ کل کاتالوگ: میانگین امتیاز قبل/بعد و «کمبودهای سیستماتیک» (مثلاً بیشتر محصولات برند یا وزن ثبت‌شده ندارند). builds: خروجی build برای هر محصول. */
  function summarize(builds) {
    const list = (builds || []).filter((b) => b && b.ok); const n = list.length; if (!n) return { n: 0, avgBefore: 0, avgAfter: 0, gaps: [], grades: {} };
    const avg = (f) => Math.round(list.reduce((a, b) => a + f(b), 0) / n); const gaps = new Map(); const grades = {};
    list.forEach((b) => { grades[b.after.grade.id] = (grades[b.after.grade.id] || 0) + 1; b.missing.forEach((m) => { const g = gaps.get(m.id) || { id: m.id, label: m.label, fix: m.fix, count: 0, gain: m.gain, tip: m.tip }; g.count++; gaps.set(m.id, g); }); });
    return { n, avgBefore: avg((b) => b.before.score), avgAfter: avg((b) => b.after.score), grades, gaps: Array.from(gaps.values()).map((g) => Object.assign(g, { pct: Math.round((g.count / n) * 100), weight: g.count * g.gain })).sort((a, b) => b.weight - a.weight || b.count - a.count) };
  }

  /** پرسش‌های «چرا این؟» برای نمایش کنار هر کاندیدا. */
  function explain(c) { return (c && c.reasons ? c.reasons : []).join(' · '); }

  return { build, plan, summarize, evaluate, vet, explain, focusCandidates, titleCandidates, metaCandidates, relatedKeywords, gradeOf };
});
