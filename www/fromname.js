/* Site Inspector — SI.FromName (v1.59). Pure. Builds a complete SEO set from the PRODUCT NAME (+ whatever the shop already holds:
 * categories, attributes, weight, dimensions). Nothing is invented: every sentence is made from a fact parsed out of the name or the shop data. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else (root.SI = root.SI || {}).FromName = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const len = (s) => Array.from(String(s == null ? '' : s)).length;
  const fixc = (s) => String(s == null ? '' : s).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u064B-\u065F]/g, '');
  const plain = (s) => fixc(String(s == null ? '' : s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')).replace(/\s+/g, ' ').trim();
  const norm = (s) => plain(s).replace(/\u200c/g, ' ').toLowerCase();
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const D = (s) => String(s).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const COLORS = ['مشکی', 'سفید', 'قرمز', 'آبی', 'سبز', 'زرد', 'نقره‌ای', 'طلایی', 'قهوه‌ای', 'طوسی', 'خاکستری', 'صورتی', 'بنفش', 'نارنجی', 'کرم', 'بژ', 'سرمه‌ای', 'مسی', 'رز گلد'];
  const MATERIALS = ['سرامیکی', 'استیل', 'استیل ضدزنگ', 'شیشه‌ای', 'پلاستیکی', 'چوبی', 'چرمی', 'فلزی', 'پنبه‌ای', 'مسی', 'آلومینیومی', 'سیلیکونی', 'فولادی', 'برنجی', 'چدنی', 'کتانی', 'پشمی', 'ابریشمی', 'کاغذی', 'بامبو', 'مخملی', 'نایلونی', 'پلی‌استر', 'سنگی', 'ایرانی', 'خارجی'];
  const MATERIAL_REAL = new Set(['سرامیکی', 'استیل', 'استیل ضدزنگ', 'شیشه‌ای', 'پلاستیکی', 'چوبی', 'چرمی', 'فلزی', 'پنبه‌ای', 'مسی', 'آلومینیومی', 'سیلیکونی', 'فولادی', 'برنجی', 'چدنی', 'کتانی', 'پشمی', 'ابریشمی', 'کاغذی', 'بامبو', 'مخملی', 'نایلونی', 'پلی‌استر', 'سنگی']);
  const UNITS = '(کیلوگرمی|کیلوگرم|میلی‌?لیتری|میلی‌?لیتر|میلی‌?آمپر|آمپر|کیلووات|میل|کیلویی|کیلو|گرمی|گرم|میلی‌?گرم|لیتری|لیتر|سی‌?سی|عددی|عدد|تایی|بسته‌?ای|بسته|جفتی|جفت|سانتی‌?متری|سانتی‌?متر|میلی‌?متری|میلی‌?متر|متری|متر|وات|ولت|گیگابایت|گیگ|ترابایت|مگابایت|اینچ|بار|لایه|نفره|کیسه‌?ای|ساشه|کپسول|قرص)';
  const QTY_RE = new RegExp('(\\d+(?:[.,٫]\\d+)?)\\s*' + UNITS + '(?=ی?(?![\\p{L}\\p{N}]))', 'gu'); /* v1.69: a unit must end at a word boundary («میل» is not the start of «میلی‌آمپر») */
  const STOP_EDGE = new Set(['و', 'با', 'برای', 'از', 'در', 'به', 'تا', 'یا', 'مدل', 'سری']);
  const TAIL_DROP = new Set(['یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه', 'ده', 'صد', 'هزار', 'طرح', 'رنگ', 'جنس', 'نوع', 'سایز', 'اندازه', 'تعداد', 'ابعاد']);
  const LEAD = /^(?:خرید|قیمت|فروش|سفارش)\s+/;
  const DESC_STOP = new Set(['ضد', 'مخصوص', 'مناسب', 'ویژه', 'برند', 'ساخت']);
  const BRANDS_FA = ['سامسونگ', 'اپل', 'شیائومی', 'هوآوی', 'هواوی', 'ایسوس', 'لنوو', 'اچ‌پی', 'ایسر', 'سونی', 'نوکیا', 'موتورولا', 'پاناسونیک', 'بوش', 'فیلیپس', 'براون', 'تفال', 'پارس‌خزر', 'اسنوا', 'ال‌جی', 'الجی', 'مایکروسافت', 'کانن', 'نیکون', 'جی‌بی‌ال', 'انکر', 'ریلمی', 'پوکو', 'وان‌پلاس', 'ناسیونال', 'کنوود', 'مولینکس', 'دلونگی', 'نایک', 'آدیداس', 'پوما', 'ریبوک', 'نیوبالانس', 'لاکچری', 'نیوآ', 'نیوا', 'داو', 'لورآل', 'ایزی', 'گلی', 'پمپرز', 'مولفیکس', 'سیمرغ', 'گلرنگ', 'لاجیتک', 'ریزر', 'کینگستون', 'سن‌دیسک', 'تی‌پی‌لینک', 'دی‌لینک', 'ای‌اس‌ای', 'جی‌پلاس', 'ایکس‌ویژن', 'اسنوا', 'دوو', 'پاکشوما', 'میدیا', 'هایسنس'];
  const BRAND_RE = new Map(BRANDS_FA.map((b) => [norm(b).replace(/ /g, ''), b]));

  /** Parses a product name into facts. */
  function parseName(title, o) {
    const opt = o || {}; const raw = plain(title).replace(LEAD, '').trim(); const t = D(raw);
    const qty = []; let m; QTY_RE.lastIndex = 0; while ((m = QTY_RE.exec(t))) qty.push({ text: raw.slice(m.index, m.index + m[0].length).trim(), n: m[1], unit: m[2].replace(/ی$/, '').replace(/(?<!میلی)گرمی/, 'گرم') });
    const words = raw.replace(/(?<![\p{L}])(ال ای دی|ال سی دی|ال جی|اچ پی|وان پلاس|نیو بالانس|جی بی ال)(?![\p{L}])/gu, (x) => x.replace(/ /g, '\u0001')).split(/\s+/).filter(Boolean).map((w) => w.replace(/\u0001/g, ' ')); const low = words.map(norm);
    const colors = COLORS.filter((c) => (' ' + low.slice(c === 'کرم' ? 1 : 0).join(' ') + ' ').includes(' ' + norm(c))); /* first-word «کرم» is a product, not a colour */  const materials = MATERIALS.filter((c) => MATERIAL_REAL.has(c) && (' ' + low.join(' ') + ' ').includes(' ' + norm(c) + ' '));
    const latin = words.filter((w) => /[A-Za-z]/.test(w)); const models = latin.filter((w) => /\d/.test(w) || /^[A-Z0-9\-]{2,}$/.test(w));
    const isNum = (w) => /^\d+$/.test(D(w || ''));
    const lineModels = []; words.forEach((w, i) => { if (/^[A-Za-z]{3,}$/.test(w) && isNum(words[i + 1]) && !models.includes(w + ' ' + words[i + 1])) { const pv = words[i - 1]; const lead = pv && /^[A-Za-z]{3,}$/.test(pv) && !models.includes(pv) && !BRAND_RE.has(norm(pv).replace(/ /g, '')) ? pv + ' ' : ''; lineModels.push(lead + w + ' ' + words[i + 1]); } }); /* v1.69: «Redmi Watch 4» is one model, not «Watch 4» */
    const lineWords = new Set([].concat.apply([], lineModels.map((x) => x.split(' ').slice(0, -1))));
    const brandLatin = latin.filter((w) => !models.includes(w) && !lineWords.has(w) && w.length >= 3 && !(words.indexOf(w) > 0 && (models.includes(words[words.indexOf(w) - 1]) || /\d/.test(words[words.indexOf(w) - 1]))));
    let faBrand = ''; let faIdx = -1; const bi = low.findIndex((w, i) => w === 'برند' && words[i + 1] && !/\d/.test(words[i + 1]));
    if (bi >= 0) { faBrand = words[bi + 1]; faIdx = bi; }
    if (!faBrand) low.some((w, i) => { const b = BRAND_RE.get(w.replace(/ /g, '')); if (b) { faBrand = words[i]; faIdx = i; return true; } return false; });
    const brand = String(opt.brand || '').trim() || faBrand || (brandLatin[0] || '');
    const descIdx = low.findIndex((w, i) => i > 0 && (COLORS.some((c) => norm(c) === w) || MATERIALS.some((c) => norm(c) === w) || /\d/.test(w) || /[A-Za-z]/.test(w) || STOP_EDGE.has(w) || DESC_STOP.has(w) || i === faIdx));
    const typeWords = words.slice(0, descIdx > 0 ? Math.min(descIdx, 3) : Math.min(words.length, 2));
    const typeWords2 = (models.length && descIdx >= 2 && /[A-Za-z]/.test(words[descIdx] || '')) ? words.slice(0, 1) : typeWords;
    const LEADW = new Set(['مجموعه', 'ست', 'پک']); let typeWords3 = typeWords2;
    if (LEADW.has(low[0]) && words.length > 2) { let st = 1; while (st < words.length - 1 && (/^\d/.test(D(words[st])) || /^(?:تایی|عددی|تکه|پارچه)$/.test(low[st]))) st++; const rest = words.slice(st); const k = rest.findIndex((w, i) => i > 0 && (COLORS.some((c) => norm(c) === norm(w)) || MATERIALS.some((c) => norm(c) === norm(w)) || /\d/.test(w) || /[A-Za-z]/.test(w) || STOP_EDGE.has(norm(w)) || DESC_STOP.has(norm(w)))); typeWords3 = rest.slice(0, k > 0 ? Math.min(k, 2) : Math.min(rest.length, 1)); }
    const type = typeWords3.filter((w, i) => !(i === typeWords3.length - 1 && (STOP_EDGE.has(norm(w)) || DESC_STOP.has(norm(w))))).join(' ');
    /* «مدل کلاسیک»: the word after «مدل» is the model */
    const mi = low.findIndex((w, i) => w === 'مدل' && words[i + 1] && !/^[\d]/.test(D(words[i + 1])) && !COLORS.some((c) => norm(c) === low[i + 1]) && !STOP_EDGE.has(low[i + 1]) && !/[A-Za-z]/.test(words[i + 1]));
    const faModel = mi >= 0 ? words[mi + 1] : '';
    const allModels = models.filter((m) => !lineModels.some((l) => l.split(' ').slice(0, -1).includes(m))).concat(lineModels, faModel ? [faModel] : []).filter((m, i, a) => a.indexOf(m) === i);
    return { name: raw, words, type, brand, models: allModels, qty, colors, materials };
  }
  const fit = (s, max) => { s = String(s).replace(/\s+/g, ' ').trim(); if (len(s) <= max) return s; const w = s.split(' '); let acc = ''; for (const x of w) { const n = acc ? acc + ' ' + x : x; if (len(n) > max) break; acc = n; } return acc.replace(/[\s،؛:,\-–|]+$/, ''); };

  /** Focus keyword: type + first distinguishing words (2–3 words), never starting with a stop word. */
  function focus(p) {
    if (p.words.length > 2 && /^(?:مجموعه|ست|پک)$/.test(norm(p.words[0]))) { let st = 1; while (st < p.words.length - 1 && (/^[\d۰-۹٠-٩]/.test(p.words[st]) || /^(?:تایی|عددی|تکه|پارچه)$/.test(norm(p.words[st])))) st++; p = Object.assign({}, p, { words: p.words.slice(st), type: p.type }); }
    const cut = p.words.findIndex((x, i) => i > 0 && /^[\d۰-۹٠-٩]/.test(x)); const w = cut > 0 ? p.words.slice(0, cut) : p.words; let out = w.slice(0, 3);
    while (out.length > 1 && (STOP_EDGE.has(norm(out[out.length - 1])) || TAIL_DROP.has(norm(out[out.length - 1])))) out.pop(); /* v1.69: never end on «سه»، «صد»، «طرح»، «رنگ» … */
    if (out.length === 3 && p.models.length && !out.some((x) => p.models.includes(x))) { const alt = [p.type || out[0], p.models[0]].filter(Boolean).join(' '); if (norm(p.name).includes(norm(alt))) out = alt.split(' '); }
    while (out.length > 1 && /^[\d۰-۹٠-٩]+$/.test(out[out.length - 1])) out.pop(); /* v1.73: عدد پایانی (اندازه/تعداد) مشخصهٔ نوع است، نه بخشی از عبارت کلیدی */
    return out.join(' ').trim();
  }
  function titleOf(p, o) {
    const taken = (o && o.taken) || (() => false); const brand = (o && o.brand) || p.brand; const nb = brand && !norm(p.name).includes(norm(brand)) ? brand : '';
    const c = []; const add = (v) => { v = fit(v, 60); if (len(v) >= 20 && !c.includes(v)) c.push(v); };
    if (nb) { add('خرید ' + p.name + ' | ' + nb); add(p.name + ' | ' + nb); }
    add('خرید ' + p.name); add(p.name + ' – مشخصات و قیمت'); add('خرید ' + p.name + ' – مشخصات و قیمت'); add(p.name + ' | خرید و قیمت');
    const ok = c.filter((v) => !taken(norm(v))); const pick = (ok.length ? ok : c).find((v) => len(v) <= 60 && len(v) >= 20) || '';
    const rules = (o && o.rules) || {}; return rules.buyPrefix === 'never' ? pick.replace(/^خرید\s+/, '') : pick;
  }
  /** Facts as short Persian phrases from name + shop data. */
  function factRows(p, item) {
    const rows = []; const prod = (item && item.product) || {}; const add = (k, v) => { v = plain(v); if (v && !rows.some((r) => r[0] === k)) rows.push([k, v]); };
    if (p.type) add('نوع محصول', p.type); if (p.brand) add('برند', p.brand); if (p.models.length) add('مدل', p.models.join(' ')); if (p.materials.length) add('جنس', p.materials.join('، ')); if (p.colors.length) add('رنگ', p.colors.join('، '));
    p.qty.forEach((q, i) => add(i ? 'مقدار ' + (i + 1) : 'مقدار/اندازه', q.text));
    const cats = (Array.isArray(item && item.categories) ? item.categories : (prod.categories || [])).map((x) => (x && typeof x === 'object' ? x.name || x.label : x)).map(plain).filter((x) => x && len(x) < 50); if (cats.length) add('دسته‌بندی', cats.slice(0, 3).join('، '));
    const attrs = Array.isArray(prod.attributes) ? prod.attributes : []; attrs.slice(0, 8).forEach((a) => { if (a && (a.name || a.label)) add(plain(a.name || a.label), Array.isArray(a.options) ? a.options.join('، ') : (a.value || a.option || '')); });
    const UNIT_FA = { g: 'گرم', gr: 'گرم', kg: 'کیلوگرم', lb: 'پوند', lbs: 'پوند', oz: 'اونس', cm: 'سانتی‌متر', mm: 'میلی‌متر', m: 'متر', in: 'اینچ' }; const unitFa = (u, dflt) => { const k = String(u || '').trim().toLowerCase(); return k ? (UNIT_FA[k] || String(u).trim()) : dflt; }; /* v1.90: «g/cm» لاتین در متن فارسی نیاید */
    if (prod.weight) add('وزن', D(prod.weight) + ' ' + unitFa(prod.weight_unit, 'کیلوگرم')); const d = prod.dimensions; if (d && typeof d === 'object') { const v = [d.length, d.width, d.height].filter((x) => x && Number(D(x))); if (v.length) add('ابعاد', v.join(' × ') + ' ' + unitFa(d.unit, 'سانتی‌متر')); }
    return rows;
  }
  function metaOf(p, rows, o) {
    const site = String((o && o.site) || '').trim(); const bits = rows.filter((r) => ['جنس', 'رنگ', 'مقدار/اندازه', 'برند', 'مدل'].includes(r[0])).map((r) => r[0] + ' ' + r[1]);
    const cands = [];
    const a = p.name + (bits.length ? ' با ' + bits.slice(0, 3).join('، ') : '') + '؛ مشخصات، قیمت و جزئیات خرید را در همین صفحه ببینید.';
    const b = p.name + '؛ مشخصات کامل، قیمت و شرایط خرید' + (site ? ' از ' + site : '') + ' در این صفحه آمده است.';
    const c = 'مشخصات و قیمت ' + p.name + (bits.length ? ' (' + bits.slice(0, 2).join('، ') + ')' : '') + ' را ببینید و با نیاز خود مقایسه کنید.';
    const d = p.name + ' را با مشخصات ثبت‌شده، قیمت و جزئیات خرید در همین صفحه ببینید و با نیاز خود مقایسه کنید.';
    [a, b, c, d].forEach((v) => { v = v.replace(/\s+/g, ' '); if (len(v) > 160) v = fit(v, 157).replace(/[،؛\s]+$/, '') + '.'; if (len(v) >= 70 && len(v) <= 160) cands.push(v); });
    const taken = (o && o.taken) || (() => false); return cands.find((v) => !taken(norm(v))) || cands[0] || '';
  }
  function faqRows(p, rows) {
    const q = []; const get = (k) => (rows.find((r) => r[0] === k) || [])[1];
    if (get('مقدار/اندازه')) q.push(['مقدار یا اندازهٔ ' + p.name + ' چقدر است؟', 'طبق نام محصول، مقدار/اندازه ' + get('مقدار/اندازه') + ' است.']);
    if (get('رنگ')) q.push(['' + p.name + ' در چه رنگی است؟', 'رنگ این محصول ' + get('رنگ') + ' است.']);
    if (get('جنس')) q.push(['جنس ' + p.name + ' چیست؟', 'این محصول ' + get('جنس') + ' است.']);
    if (get('مدل')) q.push(['مدل ' + p.name + ' چیست؟', 'مدل این محصول ' + get('مدل') + ' است.']);
    if (get('برند')) q.push(['' + p.name + ' محصول کدام برند است؟', 'برند این محصول ' + get('برند') + ' ثبت شده است.']);
    return q.slice(0, 4);
  }
  function contentOf(p, rows, faq) {
    const h = []; const intro = p.name + (rows.find((r) => r[0] === 'دسته‌بندی') ? ' در دستهٔ ' + rows.find((r) => r[0] === 'دسته‌بندی')[1] + ' قرار دارد' : ' در همین فروشگاه عرضه می‌شود') + '. ' + (rows.length > 1 ? 'مشخصات ثبت‌شدهٔ این محصول در جدول زیر آمده است.' : 'مشخصات بیشتر پس از ثبت در پروندهٔ محصول به این صفحه اضافه می‌شود.');
    h.push('<h2>معرفی ' + esc(p.name) + '</h2>', '<p>' + esc(intro) + '</p>');
    if (rows.length > 1) h.push('<h2>مشخصات ' + esc(p.type || p.name) + '</h2>', '<table><thead><tr><th>ویژگی</th><th>مقدار</th></tr></thead><tbody>' + rows.map((r) => '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>').join('') + '</tbody></table>');
    if (faq.length >= 2) { h.push('<h2>پرسش‌های متداول دربارهٔ ' + esc(p.name) + '</h2>'); faq.forEach(([q, a]) => h.push('<h3>' + esc(q) + '</h3>', '<p>' + esc(a) + '</p>')); }
    return h.join('\n');
  }
  /** Main entry. item: { title, categories, product }. opts: { brand, site, taken: {title(fn), meta(fn)}, rules }. */
  function build(item, opts) {
    const o = opts || {}; const title = plain(item && item.title); if (len(title) < 3) return { ok: false, why: 'نام محصول خالی یا بسیار کوتاه است.' };
    const p = parseName(title, o); const rows = factRows(p, item); const f = focus(p); const faq = faqRows(p, rows);
    const seo_title = titleOf(p, { taken: o.takenTitle, brand: o.brand, rules: o.rules }); const meta_description = metaOf(p, rows, { site: o.site, taken: o.takenMeta });
    const excerpt = p.name + (rows.filter((r) => r[0] !== 'نوع محصول').length ? ' با ' + rows.filter((r) => ['جنس', 'رنگ', 'مقدار/اندازه', 'مدل', 'برند'].includes(r[0])).slice(0, 3).map((r) => r[0] + ' ' + r[1]).join('، ') : '') + '. مشخصات کامل در ادامهٔ همین صفحه آمده است.';
    const missing = []; if (!p.materials.length && !rows.some((r) => r[0] === 'جنس')) missing.push('جنس یا ترکیب'); if (!rows.some((r) => /وزن|ابعاد|مقدار/.test(r[0]))) missing.push('وزن/ابعاد/حجم'); if (!rows.some((r) => r[0] === 'برند')) missing.push('برند'); missing.push('کاربرد و روش استفاده');
    const strong = rows.length >= 4;
    return { ok: true, parsed: p, facts: rows, fields: { seo_title, meta_description, focus_keyword: f, excerpt: len(excerpt) >= 45 ? excerpt : '', content: contentOf(p, rows, faq), related_keywords: [f, 'خرید ' + f, 'قیمت ' + f].join(', ') }, faq, confidence: strong ? 'medium' : 'low', missing };
  }
  return { parseName, build, focus, factRows };
});
