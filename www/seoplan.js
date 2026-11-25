/* Site Inspector — seoplan.js (v1.124.0)  SI.SeoPlan
 * برنامهٔ سئوی سایت: (۱) پیشنهاد پیوند داخلی مقاله ← محصول فقط با «انکرِ واقعاً موجود در متن»، (۲) امتیاز کلی سایت و
 * فهرست کارهای اولویت‌دار از همهٔ بخش‌ها (کمبودهای سازندهٔ سئو، متای خالی/تکراری، پیوند داخلی).
 * v1.94: برنامهٔ کامل — رقابت داخلی (کلیدواژهٔ تکراری)، محتوای تکراری، صفحهٔ بدون پیوند ورودی، محتوای کم، نشانی‌های ناپاک،
 * طول عنوان/متا، مرحله‌بندی، پیگیری انجام‌شده‌ها، روند امتیاز و خروجی Markdown/CSV.
 * Pure، بدون DOM/شبکه؛ چیزی را خودش تغییر نمی‌دهد و متنی نمی‌سازد که در محتوا نباشد. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./fromname.js'), require('./seobuilder.js'), require('./seopolicy.js'));
  else (root.SI = root.SI || {}).SeoPlan = factory(root.SI && root.SI.FromName, root.SI && root.SI.SeoBuilder, root.SI && root.SI.SeoPolicy);
})(typeof self !== 'undefined' ? self : this, function (FromName, SeoBuilder, Policy) {
  'use strict';
  const fixc = (s) => String(s == null ? '' : s).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[ً-ٟ]/g, '');
  const plain = (s) => fixc(String(s == null ? '' : s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')).replace(/\s+/g, ' ').trim();
  const norm = (s) => plain(s).replace(/‌/g, ' ').toLowerCase();
  const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const GENERIC = new Set(['خرید', 'قیمت', 'مشخصات', 'محصول', 'مدل', 'نوع', 'ست', 'بسته', 'عدد', 'کالا', 'اصل', 'جدید']);
  const isArticle = (it) => (it.type || '') !== 'product' && (it.type || '') !== 'shop_order';
  const pathOf = (u) => { try { return new URL(u).pathname.replace(/\/+$/, ''); } catch (e) { return String(u || '').replace(/^https?:\/\/[^/]+/, '').replace(/\/+$/, ''); } };

  /** عبارت‌های قابل‌استفاده به‌عنوان انکر برای یک محصول، از قوی به ضعیف: عبارت کلیدی ثبت‌شده، نوع+ویژگی، نوع. */
  function anchorsOf(p) {
    const out = []; const add = (t, conf) => { t = plain(t); const ws = t.split(' ').filter(Boolean); if (ws.length < 2 || ws.length > 5 || t.length < 6) return; if (ws.every((w) => GENERIC.has(w))) return; if (!out.some((x) => norm(x.text) === norm(t))) out.push({ text: t, conf }); };
    if (p.focusKeyword) add(p.focusKeyword, 'high');
    try { const q = FromName.parseName(p.title, {}); add(FromName.focus(q), 'high'); if (q.type) add(q.type, 'medium'); } catch (e) { /* نام نامعتبر */ }
    out.slice().forEach((c) => { const ws = c.text.split(' '); if (ws.length >= 3) { add(ws.slice(0, 2).join(' '), 'medium'); add(ws.slice(0, ws.length - 1).join(' '), 'medium'); } });
    return out;
  }
  function findIn(text, phrase) { const re = new RegExp('(^|[\\s«»(،؛:.!؟])(' + phrase.split(/\s+/).map(reEsc).join('[\\s\\u200c]+') + ')(?=$|[\\s»)،؛:.!؟])', 'i'); const m = re.exec(text); return m ? { anchor: m[2], index: m.index + m[1].length } : null; }
  const sentenceAt = (text, i) => { const a = Math.max(text.lastIndexOf('.', i), text.lastIndexOf('؟', i), text.lastIndexOf('!', i)) + 1; let b = text.slice(i).search(/[.!؟?]/); b = b < 0 ? text.length : i + b + 1; let s = text.slice(a, b).trim(); if (s.length > 140) { const k = i - a; s = '…' + text.slice(Math.max(a, i - 60), Math.min(b, i + 70)).trim() + '…'; } return s; };

  /** items: ردیف‌های محتوا {id,type,title,url,focusKeyword,content|contentPreview}. هر مقاله حداکثر perArticle پیوند؛ هر انکر فقط به یک محصول. */
  /** فقط محتوای منتشرشده مقصد/منبع پیوند و هدف بررسی است. اگر وضعیت معلوم نبود (افزونهٔ قدیمی) منتشرشده فرض می‌شود.
   *  پیش‌نویس، خصوصی، زمان‌بندی‌شده و حذف‌شده برای بازدیدکننده ۴۰۴ است؛ پیوند به آن‌ها پیوند شکسته می‌سازد. */
  const isLive = (x) => { const st = String(x && x.status != null ? x.status : '').trim().toLowerCase(); return !st || st === 'publish'; };
  const live = (items) => (items || []).filter(isLive);
  function linkPlan(items, opts) {
    const o = opts || {}; const per = o.perArticle || 3; const list = live(items); const prods = list.filter((x) => x.type === 'product' && x.url && x.title);
    const arts = list.filter((x) => isArticle(x) && (x.content || x.contentPreview)); const sugg = []; const usedAnchor = new Map(); const prodAnchors = prods.map((p) => ({ p, a: anchorsOf(p) }));
    let withLinks = 0;
    arts.forEach((a) => {
      const html = String(a.content || a.contentPreview || ''); const text = plain(html); const linked = (html.match(/href\s*=\s*["']([^"']+)/gi) || []).map((h) => pathOf(h.replace(/^href\s*=\s*["']/i, '')));
      if (linked.length) withLinks++; const found = [];
      prodAnchors.forEach(({ p, a: anc }) => {
        if (linked.includes(pathOf(p.url))) return; /* همین حالا پیوند دارد */
        for (const c of anc) { const hit = findIn(text, c.text); if (!hit) continue; const key = norm(hit.anchor); if (usedAnchor.has(key) && usedAnchor.get(key) !== String(p.id)) continue; found.push({ articleId: a.id, articleTitle: a.title, articleUrl: a.url, productId: p.id, productTitle: p.title, productUrl: p.url, anchor: hit.anchor, context: sentenceAt(text, hit.index), confidence: c.conf, pos: hit.index, snippet: '<a href="' + p.url + '">' + hit.anchor + '</a>' }); break; }
      });
      found.sort((x, y) => (x.confidence === 'high' ? 0 : 1) - (y.confidence === 'high' ? 0 : 1) || y.anchor.length - x.anchor.length || x.pos - y.pos);
      const used = new Set(); found.filter((f) => { const k = norm(f.anchor); if (used.has(k)) return false; used.add(k); return true; }).slice(0, per).forEach((f) => { usedAnchor.set(norm(f.anchor), String(f.productId)); sugg.push(f); });
    });
    return { suggestions: sugg, articles: arts.length, products: prods.length, articlesWithLinks: withLinks, partialText: arts.some((x) => !x.content) };
  }

  function dupCount(items, key) { const m = new Map(); items.forEach((x) => { const k = norm(x[key]); if (k) m.set(k, (m.get(k) || 0) + 1); }); let n = 0; m.forEach((c) => { if (c > 1) n += c; }); return n; }

  /* ---------- v1.94: بررسی‌های تازهٔ ساختاری (همه فقط‌خواندنی و بر پایهٔ همان فهرست) ---------- */
  const brief = (x) => ({ id: x.id, title: String(x.title || ''), url: x.url || '', type: x.type || '' });
  const wordsOf = (html) => { const t = norm(html); return t ? t.split(' ').filter(Boolean) : []; };
  const hasFull = (x) => !!String(x.content || '').trim();
  const bodyOf = (x) => String(x.content || x.contentPreview || '');

  /** کلیدواژهٔ تکراری بین چند صفحه = رقابت داخلی. */
  function cannibalGroups(items) {
    const m = new Map(); live(items).forEach((x) => { const k = norm(x.focusKeyword); if (k && k.length >= 3) { if (!m.has(k)) m.set(k, { keyword: plain(x.focusKeyword), items: [] }); m.get(k).items.push(brief(x)); } });
    return Array.from(m.values()).filter((g) => g.items.length > 1).sort((a, b) => b.items.length - a.items.length);
  }
  /** شباهت متنی بین صفحه‌ها با شینگل ۴کلمه‌ای و نمایهٔ معکوس. شینگل‌های بسیار رایج (قالب مشترک) حذف می‌شوند. */
  function duplicateContent(items, opts) {
    const o = opts || {}; const th = o.threshold || 0.6, minWords = o.minWords || 40; const rows = []; let partial = false;
    live(items).forEach((x) => { const ws = wordsOf(bodyOf(x)); if (ws.length < minWords) return; if (!hasFull(x)) partial = true; const set = new Set(); for (let i = 0; i + 4 <= ws.length; i++) set.add(ws.slice(i, i + 4).join(' ')); rows.push({ it: x, set }); });
    const inv = new Map(); rows.forEach((r, i) => r.set.forEach((sh) => { if (!inv.has(sh)) inv.set(sh, []); inv.get(sh).push(i); }));
    const pair = new Map(); inv.forEach((ids) => { if (ids.length < 2 || ids.length > 8) return; for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) { const k = ids[a] + ':' + ids[b]; pair.set(k, (pair.get(k) || 0) + 1); } });
    const out = []; pair.forEach((c, k) => { const [a, b] = k.split(':').map(Number); const cont = c / Math.min(rows[a].set.size, rows[b].set.size); if (cont >= th) out.push({ a: brief(rows[a].it), b: brief(rows[b].it), pct: Math.round(cont * 100) }); });
    out.sort((x, y) => y.pct - x.pct); return { pairs: out, checked: rows.length, partial };
  }
  /** محصول‌هایی که هیچ پیوندی از متن صفحه‌های دیگر به آن‌ها نیست. منو، دسته و «محصولات مرتبط» حساب نمی‌شود. */
  function orphans(items) {
    const list = live(items); const withText = list.filter((x) => bodyOf(x).trim()); if (!withText.length) return { unknown: true, list: [], partial: false };
    const prods = list.filter((x) => x.type === 'product' && x.url); const inbound = new Map(); let partial = false;
    withText.forEach((x) => { if (!hasFull(x)) partial = true; (bodyOf(x).match(/href\s*=\s*["']([^"']+)/gi) || []).forEach((h) => { const pth = pathOf(h.replace(/^href\s*=\s*["']/i, '')); if (pth && pth !== pathOf(x.url)) inbound.set(pth, (inbound.get(pth) || 0) + 1); }); });
    return { unknown: false, partial, list: prods.filter((x) => !inbound.get(pathOf(x.url))).map(brief), scanned: withText.length };
  }
  /** محتوای کم؛ فقط برای مواردی که متن کامل دارند (پیش‌نمایش کوتاه به‌اشتباه «کم» حساب نمی‌شود). */
  function thinContent(items, opts) {
    const o = opts || {}; const minP = o.product || 60, minA = o.article || 300; const out = []; let known = 0;
    live(items).forEach((x) => { if (!hasFull(x)) return; known++; const w = wordsOf(x.content).length; const lim = x.type === 'product' ? minP : minA; if (w < lim) out.push(Object.assign(brief(x), { words: w, min: lim })); });
    return { list: out, known };
  }
  /** نشانی‌های ناپاک: query، حرف بزرگ، زیرخط، اسلاگ خیلی بلند یا فقط عددی. تغییر نشانی بدون ریدایرکت ۳۰۱ خطرناک است. */
  function urlIssues(items) {
    const out = []; live(items).forEach((x) => {
      const u = String(x.url || ''); if (!u) return; const why = []; let path = pathOf(u); try { path = decodeURIComponent(path); } catch (e) { /* رمزگذاری ناقص */ }
      const slug = path.split('/').filter(Boolean).pop() || '';
      if (/[?&]p=\d+|[?&]page_id=\d+|\?/.test(u)) why.push('پارامتر در نشانی'); if (/[A-Z]/.test(path)) why.push('حرف بزرگ'); if (/_/.test(slug)) why.push('زیرخط'); if (Array.from(slug).length > 75) why.push('اسلاگ بلند'); if (/^\d+$/.test(slug)) why.push('اسلاگ فقط عدد');
      if (why.length) out.push(Object.assign(brief(x), { why }));
    }); return out;
  }
  /** عنوان/متای موجود که بلندی/کوتاهی‌شان برای نمایش مشکل دارد (طبق SeoPolicy). */
  function lengthIssues(items) {
    if (!Policy || !Policy.LIMITS || !Policy.pixelWidth) return [];
    const L = Policy.LIMITS; const out = [];
    live(items).forEach((x) => { const why = []; const t = plain(x.metaTitle), m = plain(x.metaDescription);
      if (t) { const n = Array.from(t).length, px = Policy.pixelWidth(t); if (px > L.title.pxMax) why.push('عنوان بلند (بریده می‌شود)'); else if (n < L.title.min) why.push('عنوان کوتاه'); }
      if (m) { const n = Array.from(m).length; if (n > L.meta.max) why.push('متا بلند'); else if (n < L.meta.min) why.push('متا کوتاه'); }
      if (why.length) out.push(Object.assign(brief(x), { why })); });
    return out;
  }
  /** پوشش واقعی بررسی: «چیزی پیدا نشد» با «سنجیده نشد» فرق دارد. full=متن کامل، preview=فقط ابتدای متن، none=بدون متن. */
  function coverage(items) {
    const list = items || []; let full = 0, preview = 0, none = 0; list.forEach((x) => { if (hasFull(x)) full++; else if (String(x.contentPreview || '').trim()) preview++; else none++; });
    const notes = [];
    if (list.length && full < list.length) {
      if (!full && !preview) notes.push('هیچ متنی در فهرست نبود؛ بررسی‌های متنی (تکراری، کم‌محتوا، یتیم) اجرا نشد. «بررسی عمیق» را اجرا کن.');
      else {
        notes.push('محتوای کم فقط برای متن کامل سنجیده می‌شود؛ ' + (none + preview) + ' مورد (' + none + ' بدون متن، ' + preview + ' با پیش‌نمایش کوتاه) سنجیده نشدند.');
        if (preview) notes.push('تکراری‌بودن متن و پیوند ورودی برای ' + preview + ' مورد فقط روی ابتدای متن بود.');
      }
    }
    return { total: list.length, full, preview, none, pct: list.length ? Math.round((full / list.length) * 100) : 0, complete: list.length > 0 && full === list.length, notes };
  }
  /** پیشرفت کلی بر پایهٔ «انجام شد»های ذخیره‌شده: verified = علامت‌خورده و دیگر دیده نمی‌شود. */
  function progress(plan, saved) {
    const sv = saved || {}; const present = new Set((plan.actions || []).map((a) => a.id)); let verified = 0, pending = 0;
    Object.keys(sv).forEach((id) => { if (sv[id] && sv[id].done) { if (present.has(id)) pending++; else verified++; } });
    const total = (plan.actions || []).length + verified; return { total, verified, pending, open: total - verified - pending, pct: total ? Math.round((verified / total) * 100) : 100 };
  }
  /* ---------- v1.123: درج امن پیوند داخلی و جدول «چه چیزی خودکار می‌شود» ---------- */
  const LINK_BLOCK = new Set(['a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'script', 'style', 'code', 'pre', 'button', 'textarea', 'select', 'option', 'svg', 'iframe', 'noscript']);
  const attrEsc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  /** یک پیوند داخلی را روی اولین رخداد «سالمِ» انکر در متنِ HTML می‌گذارد؛ هیچ چیز دیگری عوض نمی‌شود.
   *  رد می‌کند: انکر کوتاه، نشانی نامعتبر (فقط http(s) یا مسیر نسبی)، پیوند تکراری، داخل a/تیتر/کد/اسکریپت، شورت‌کد، کامنت،
   *  وسط یک واژهٔ بزرگ‌تر (نیم‌فاصله و علامت‌های ترکیبی مثل «ٔ» هم ادامهٔ واژه حساب می‌شود). ی/ي و ک/ك و فاصله/نیم‌فاصله یکسان گرفته می‌شود. */
  function insertLink(html, anchor, url) {
    const src = String(html == null ? '' : html); const a = String(anchor == null ? '' : anchor).replace(/\s+/g, ' ').trim();
    if (Array.from(a).length < 3) return { ok: false, why: 'انکر خیلی کوتاه است.' };
    const u = String(url == null ? '' : url).trim(); if (!/^(https?:\/\/|\/(?![\/\\]))[^\s"'<>\\]+$/i.test(u)) return { ok: false, why: 'نشانی مقصد معتبر نیست.' };
    const have = (src.match(/href\s*=\s*["']([^"']+)/gi) || []).map((h) => pathOf(h.replace(/^href\s*=\s*["']/i, '')));
    if (have.includes(pathOf(u))) return { ok: false, why: 'همین پیوند از قبل در متن هست.' };
    const pat = a.split(' ').map((w) => Array.from(w).map((ch) => (ch === 'ی' || ch === 'ي' ? '[یي]' : ch === 'ک' || ch === 'ك' ? '[کك]' : ch === '\u200c' ? '[\u200c ]?' : ch.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'))).join('')).join('[ \u00a0\u200c]+');
    let g; try { g = new RegExp(pat, 'gu'); } catch (e) { return { ok: false, why: 'انکر قابل جست‌وجو نیست.' }; }
    const cont = (c) => !!c && /[\p{L}\p{N}\p{M}\u200c]/u.test(c); const parts = src.split(/(<!--[\s\S]*?-->|<[^>]*>|\[[^\]\n]{1,200}\])/); const open = {}; const blocked = () => Object.keys(open).some((k) => open[k] > 0);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (i % 2 === 1) { const m = /^<(\/?)([a-z][a-z0-9]*)/i.exec(p); if (m && LINK_BLOCK.has(m[2].toLowerCase()) && !/\/>$/.test(p)) { const tg = m[2].toLowerCase(); open[tg] = Math.max(0, (open[tg] || 0) + (m[1] ? -1 : 1)); } continue; }
      if (blocked()) continue; g.lastIndex = 0; let m;
      while ((m = g.exec(p))) {
        const prev = Array.from(p.slice(0, m.index)).pop(), next = Array.from(p.slice(m.index + m[0].length))[0]; if (cont(prev) || cont(next)) continue;
        const pre = p.slice(0, m.index), post = p.slice(m.index + m[0].length);
        parts[i] = pre + '<a href="' + attrEsc(u) + '">' + m[0] + '</a>' + post;
        return { ok: true, html: parts.join(''), anchorText: m[0], context: { pre: pre.slice(-70), hit: m[0], post: post.slice(0, 70) } };
      }
    }
    return { ok: false, why: 'انکر در جای مناسب متن پیدا نشد (فقط متن عادی؛ داخل تیتر، پیوند و کد گذاشته نمی‌شود).' };
  }
  /** کدام کار چقدر خودکار می‌شود؟ level: auto | partial | manual. acts: دکمه‌های اجرا (نام acts موجود در اپ). reason: چرا دستی است. */
  const AUTOMATION = {
    meta_empty: { level: 'auto', need: 'agent', acts: [{ act: 'repairSafePreview', label: 'پیش‌نمایش' }, { act: 'repairSafeRun', label: 'اجرا' }], note: 'فقط فیلد سئوی خالی را از متن خود همان محصول پر می‌کند.' },
    dups: { level: 'auto', need: 'rebuild', acts: [{ act: 'rebuildPreview', label: 'پیش‌نمایش' }, { act: 'rebuildNow', label: 'اجرا' }], note: 'عنوان/متای تکراری یا نامناسب را بازسازی می‌کند؛ پیش‌نمایش دارد.' },
    lengths: { level: 'auto', need: 'rebuild', acts: [{ act: 'rebuildPreview', label: 'پیش‌نمایش' }, { act: 'rebuildNow', label: 'اجرا' }], note: 'عنوان/متای بلند یا کوتاه را هم‌اندازه می‌کند؛ پیش‌نمایش دارد.' },
    thin: { level: 'partial', need: 'agent', acts: [{ act: 'repairFullRun', label: 'ترمیم خودکار کامل' }], note: 'فقط وقتی اطلاعات واقعی کافی در خود سایت باشد متن نوشته می‌شود؛ وگرنه رد می‌شود و ساختگی پر نمی‌شود.' },
    gap_body: { level: 'partial', need: 'agent', acts: [{ act: 'repairFullRun', label: 'ترمیم خودکار کامل' }], note: 'فقط وقتی اطلاعات واقعی کافی در خود سایت باشد متن نوشته می‌شود.' },
    links: { level: 'auto', need: 'links', acts: [{ act: 'planLinksPreview', label: 'پیش‌نمایش' }, { act: 'planLinksAll', label: 'افزودن پیوندهای اطمینان بالا' }], note: 'هر مقاله حداکثر یک بار ذخیره می‌شود؛ بعد از ذخیره دوباره خوانده و سنجیده می‌شود و اگر چیزی غیر از پیوند عوض شده باشد برمی‌گردد.' },
    orphans: { level: 'partial', need: 'links', acts: [{ act: 'planLinksPreview', label: 'پیش‌نمایش' }, { act: 'planLinksAll', label: 'افزودن پیوندهای اطمینان بالا' }], note: 'فقط برای محصول‌هایی که انکرِ مناسب در متن یک مقاله دارند؛ بقیه دستی است.' },
    cannibal: { level: 'manual', reason: 'انتخاب صفحهٔ اصلی و ادغام تصمیم کسب‌وکاری است؛ ادغام بدون ریدایرکت ۳۰۱ ترافیک و اعتبار را از بین می‌برد.' },
    dupcontent: { level: 'manual', reason: 'بازنویسی بدون اطلاعات واقعی یعنی ساختن محتوای ساختگی؛ متن را با مشخصات واقعی خودت بازنویسی کن.' },
    urls: { level: 'manual', reason: 'تغییر نشانی بدون ریدایرکت ۳۰۱ اعتبار را از بین می‌برد و فقط با ریدایرکت امن است.' },
    gap_brand: { level: 'manual', reason: 'نام و اطلاعات برند را فقط خودت می‌دانی.' },
    gap_headings: { level: 'manual', reason: 'ساختار تیترها به محتوای واقعی بستگی دارد.' },
    gap_links: { level: 'manual', reason: 'پیوند میان صفحه‌ها باید با نظر خودت و در جای طبیعی متن باشد.' },
  };
  function automation(action) {
    const id = action && action.id; const d = AUTOMATION[id] || (String(id || '').startsWith('gap_') ? { level: 'manual', reason: 'این مورد به اطلاعات واقعیِ دست خودت وابسته است.' } : { level: 'manual', reason: 'برای این مورد اصلاح خودکار امن تعریف نشده است.' });
    return Object.assign({ acts: [], note: '', reason: '', need: '' }, d);
  }
  /** خلاصهٔ «چند درصد برنامه خودکار قابل اجراست» (بر پایهٔ تعداد مورد، نه تضمین). */
  function automationSummary(plan) {
    let auto = 0, partial = 0, manual = 0; (plan.actions || []).forEach((a) => { const l = automation(a).level; const c = a.count || 0; if (l === 'auto') auto += c; else if (l === 'partial') partial += c; else manual += c; });
    const total = auto + partial + manual; return { auto, partial, manual, total, pct: total ? Math.round(((auto + partial) / total) * 100) : 0 };
  }

  const visText = (h) => String(h == null ? '' : h).replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\u200f]/g, ' ').replace(/\s+/g, ' ').trim();
  /** بعد از نوشتن: محتوایی که سایت واقعاً ذخیره کرده با «قبل + فقط همین پیوندها» می‌خواند؟
   *  exact: بعد از برداشتن پیوندهای افزوده‌شده دقیقاً برابر قبل · text: متن دیدنی برابر ولی نشانه‌گذاری بازسریال شده (بی‌خطر)
   *  missing: یک پیوند ذخیره نشده (افزونه/فیلتر حذفش کرده) · changed: متن دیدنی فرق کرده (باید برگردد). */
  function verifyLinkEdit(before, saved, urls) {
    const b = String(before == null ? '' : before), s = String(saved == null ? '' : saved); const list = (urls || []).map(String);
    const hrefs = (h) => (h.match(/href\s*=\s*["']([^"']+)/gi) || []).map((x) => pathOf(x.replace(/^href\s*=\s*["']/i, '')));
    const hb = hrefs(b), hs = hrefs(s);
    for (const u of list) { const pu = pathOf(u); if (hs.filter((x) => x === pu).length !== hb.filter((x) => x === pu).length + 1) return { ok: false, level: 'missing', why: 'پیوند به «' + u + '» در محتوای ذخیره‌شده نیست یا بیش از یک‌بار است.' }; }
    let stripped = s; list.forEach((u) => { const open = '<a href="' + attrEsc(u) + '">'; const at = stripped.indexOf(open); if (at >= 0) { const end = stripped.indexOf('</a>', at); if (end >= 0) stripped = stripped.slice(0, at) + stripped.slice(at + open.length, end) + stripped.slice(end + 4); } });
    if (stripped === b) return { ok: true, level: 'exact' };
    if (visText(stripped) === visText(b)) return { ok: true, level: 'text' };
    return { ok: false, level: 'changed', why: 'متن دیدنیِ ذخیره‌شده با متن قبل از درج فرق دارد.' };
  }

  /** پیشنهادهای پیوند را مرتب می‌کند: اول مقصدهایی که هیچ پیوند ورودی از متن صفحه‌ها ندارند (بیشترین سود)، بعد بقیه؛ ترتیب قبلی حفظ می‌شود. */
  function prioritizeLinks(sugg, items) {
    const orp = orphans(items || []); const set = new Set(orp.unknown ? [] : orp.list.map((x) => String(x.id)));
    const rows = (sugg || []).map((s, i) => Object.assign({}, s, { orphan: set.has(String(s.productId)), _i: i }));
    rows.sort((a, b) => (b.orphan - a.orphan) || (a._i - b._i)); rows.forEach((r) => { delete r._i; }); return rows;
  }
  const PHASES = [
    { id: 'now', label: 'مرحلهٔ ۱ — خودکار و کم‌ریسک', efforts: ['auto'], hint: 'با پیش‌نمایش و تأیید خودت اعمال می‌شود و قابل بازگردانی است.' },
    { id: 'content', label: 'مرحلهٔ ۲ — محتوا و اطلاعات (دست خودت)', efforts: ['studio', 'manual'], hint: 'چیزهایی که فقط تو می‌دانی یا متنی که باید نوشته شود؛ ساختگی پر نمی‌شود.' },
    { id: 'review', label: 'مرحلهٔ ۳ — بازبینی و ساختار', efforts: ['review'], hint: 'تصمیم‌های انسانی: پیوند، رقابت بین صفحه‌ها، ادغام.' },
  ];
  const phaseOf = (effort) => (PHASES.find((p) => p.efforts.includes(effort)) || PHASES[2]).id;

  /** خلاصهٔ سازنده + پیوندها + متا → امتیاز سایت و کارهای اولویت‌دار. summary: خروجی SeoBuilder.summarize. */
  function sitePlan(items, summary, links, opts) {
    const o = opts || {}; const list = items || []; const m = summary || { n: 0, avgBefore: 0, avgAfter: 0, gaps: [] }; const actions = []; const N = Math.max(1, list.length);
    const noMeta = list.filter((x) => !String(x.metaDescription || '').trim()).length; const noTitle = list.filter((x) => !String(x.metaTitle || '').trim()).length;
    const dT = dupCount(list, 'metaTitle'), dM = dupCount(list, 'metaDescription');
    if (noMeta || noTitle) actions.push({ id: 'meta_empty', title: 'عنوان/متای خالی', count: Math.max(noMeta, noTitle), impact: Math.max(noMeta, noTitle) * 12, effort: 'auto', how: 'ترمیم خودکار یا «اصلاح کامل یک محصول» — عنوان و متا از نام و مشخصات واقعی ساخته می‌شود.' });
    if (dT || dM) actions.push({ id: 'dups', title: 'عنوان/متای تکراری', count: Math.max(dT, dM), impact: Math.max(dT, dM) * 9, effort: 'auto', how: 'سازندهٔ سئو کاندیدای یکتا را انتخاب می‌کند.' });
    (m.gaps || []).forEach((g) => { if (['title', 'meta', 'title_unique', 'meta_unique', 'focus', 'focus_title', 'focus_meta'].includes(g.id) && (noMeta || dT)) return; actions.push({ id: 'gap_' + g.id, title: g.label, count: g.count, impact: g.weight, effort: g.fix, how: g.tip || '', pct: g.pct }); });
    const ls = (links && links.suggestions) || []; if (ls.length) actions.push({ id: 'links', title: 'پیوند داخلی مقاله ← محصول', count: ls.length, impact: ls.length * 4, effort: 'review', how: 'انکرها عیناً در متن مقاله هستند. «پیش‌نمایش» جای دقیق هر پیوند را نشان می‌دهد؛ با تأیید خودت (تکی، یا گروهی وقتی مدیر سایت اجرای خودکار را روشن کرده) افزوده می‌شود، یا می‌توانی در ویرایشگر وردپرس دستی اضافه کنی.' });
    const ex = o.extended === false ? null : extraActions(list); let extraItems = 0;
    if (ex) { ex.actions.forEach((a) => actions.push(a)); extraItems = ex.affected; }
    actions.forEach((a) => { a.phase = phaseOf(a.effort); });
    actions.sort((a, b) => b.impact - a.impact);
    const score = m.n ? m.avgBefore : 0; const penalty = Math.min(20, Math.round(((noMeta + dT) / N) * 20)); const extra = Math.min(12, Math.round((extraItems / N) * 12)); const final = Math.max(0, score - penalty - extra);
    return { score: final, potential: Math.max(final, m.avgAfter - extra), grade: SeoBuilder ? SeoBuilder.gradeOf(final) : null, actions, stats: Object.assign({ items: list.length, noMeta, noTitle, dupTitles: dT, dupMetas: dM }, ex ? ex.stats : {}), phases: schedule(actions), coverage: coverage(list) };
  }

  /** کارهای ساختاری از روی خود فهرست (بدون ماژول دیگر). affected: تعداد موردهای درگیر برای جریمهٔ امتیاز. */
  function extraActions(list) {
    const actions = []; const stats = {}; const sample = (arr, f) => arr.slice(0, 8).map(f || ((x) => x)); const affected = new Set();
    const cg = cannibalGroups(list); stats.cannibalGroups = cg.length;
    if (cg.length) { cg.forEach((g) => g.items.forEach((x) => affected.add(String(x.id)))); actions.push({ id: 'cannibal', title: 'کلیدواژهٔ تکراری بین چند صفحه (رقابت داخلی)', count: cg.length, impact: cg.length * 10, effort: 'review', how: 'برای هر گروه یک صفحهٔ اصلی انتخاب کن؛ بقیه را روی کلیدواژهٔ دیگری تنظیم یا ادغام کن (ادغام با ریدایرکت ۳۰۱).', groups: cg.slice(0, 8), items: sample(cg, (g) => ({ id: g.keyword, title: g.keyword + ' — ' + g.items.length + ' صفحه' })) }); }
    const dc = duplicateContent(list); stats.dupContentPairs = dc.pairs.length;
    if (dc.pairs.length) { dc.pairs.forEach((p) => { affected.add(String(p.a.id)); affected.add(String(p.b.id)); }); actions.push({ id: 'dupcontent', title: 'متن تقریباً تکراری بین صفحه‌ها', count: dc.pairs.length, impact: dc.pairs.length * 8, effort: 'studio', how: 'یکی از دو متن را با اطلاعات واقعی بازنویسی کن یا صفحه‌ها را ادغام کن.' + (dc.partial ? ' (بخشی از مقایسه روی ابتدای متن بود؛ «بررسی عمیق» دقیق‌تر است.)' : ''), pairs: dc.pairs.slice(0, 8), items: sample(dc.pairs, (p) => ({ id: p.a.id + '/' + p.b.id, title: p.a.title + ' ≈ ' + p.b.title + ' (' + p.pct + '٪)' })) }); }
    const th = thinContent(list); stats.thin = th.list.length;
    if (th.list.length) { th.list.forEach((x) => affected.add(String(x.id))); actions.push({ id: 'thin', title: 'محتوای کم', count: th.list.length, impact: th.list.length * 5, effort: 'studio', how: 'آستانه‌ها ابتکاری است (محصول کمتر از ۶۰ و مقاله کمتر از ۳۰۰ واژه). متن را با اطلاعات واقعی کامل کن؛ طولِ خالی مفید نیست.', items: sample(th.list, (x) => ({ id: x.id, title: x.title + ' — ' + x.words + ' واژه', url: x.url })) }); }
    const lg = lengthIssues(list); stats.lengthIssues = lg.length;
    if (lg.length) { lg.forEach((x) => affected.add(String(x.id))); actions.push({ id: 'lengths', title: 'طول عنوان یا متا مناسب نمایش نیست', count: lg.length, impact: lg.length * 6, effort: 'auto', how: 'سازندهٔ سئو عنوان/متای هم‌اندازه می‌سازد؛ با پیش‌نمایش اعمال کن.', items: sample(lg, (x) => ({ id: x.id, title: x.title + ' — ' + x.why.join('، '), url: x.url })) }); }
    const ou = urlIssues(list); stats.urlIssues = ou.length;
    if (ou.length) actions.push({ id: 'urls', title: 'نشانی‌های ناپاک', count: ou.length, impact: Math.round(ou.length * 1.5), effort: 'manual', how: 'تغییر نشانی بدون ریدایرکت ۳۰۱ ترافیک و اعتبار را از بین می‌برد؛ فقط برای محتوای جدید یا همراه ریدایرکت.', items: sample(ou, (x) => ({ id: x.id, title: x.title + ' — ' + x.why.join('، '), url: x.url })) });
    const orp = orphans(list); stats.orphans = orp.list.length; stats.orphansPartial = !!orp.partial;
    if (!orp.unknown && orp.list.length) actions.push({ id: 'orphans', title: 'محصول بدون پیوند ورودی از متن صفحه‌ها', count: orp.list.length, impact: Math.round(orp.list.length * (orp.partial ? 1 : 2)), effort: 'review', how: 'فقط پیوندهای داخل متن شمرده شد؛ منو، دسته‌ها و «محصولات مرتبط» حساب نمی‌شود. از یک مقاله یا صفحهٔ مرتبط پیوند بده.' + (orp.partial ? ' (متن‌ها ناقص خوانده شد.)' : ''), items: sample(orp.list, (x) => ({ id: x.id, title: x.title, url: x.url })) });
    return { actions, stats, affected: affected.size };
  }

  /** مرحله‌بندی برنامه: هر مرحله کارهایش، مجموع مورد و سهم اثر نسبی (نه وعدهٔ افزایش امتیاز). */
  function schedule(actions) {
    const total = (actions || []).reduce((a, x) => a + (x.impact || 0), 0) || 1;
    return PHASES.map((p) => { const acts = (actions || []).filter((x) => (x.phase || phaseOf(x.effort)) === p.id).sort((a, b) => b.impact - a.impact); const imp = acts.reduce((a, x) => a + (x.impact || 0), 0); return { id: p.id, label: p.label, hint: p.hint, actions: acts, count: acts.reduce((a, x) => a + (x.count || 0), 0), share: Math.round((imp / total) * 100) }; }).filter((p) => p.actions.length);
  }
  /** وضعیت هر کار با توجه به «انجام شد»های ذخیره‌شده: open | improved | worse | done_verified | done_pending. */
  function reconcile(plan, saved) {
    const sv = saved || {}; const st = {}; (plan.actions || []).forEach((a) => { const r = sv[a.id]; if (!r) { st[a.id] = { status: 'open' }; return; }
      const was = typeof r.count === 'number' ? r.count : null; let status = r.done ? 'done_pending' : 'open';
      if (!r.done && was != null) status = a.count < was ? 'improved' : a.count > was ? 'worse' : 'open';
      st[a.id] = { status, was, now: a.count, at: r.at || 0 }; });
    Object.keys(sv).forEach((id) => { if (!st[id] && sv[id] && sv[id].done) st[id] = { status: 'done_verified', was: sv[id].count, now: 0, at: sv[id].at || 0 }; });
    return st;
  }
  /** کار بعدی: اولین کار باز در ترتیب مرحله‌ها و اثر. */
  function nextStep(plan, saved) {
    const rec = reconcile(plan, saved); const order = []; (plan.phases || schedule(plan.actions)).forEach((p) => p.actions.forEach((a) => order.push(a)));
    return order.find((a) => rec[a.id] && (rec[a.id].status === 'open' || rec[a.id].status === 'worse')) || null;
  }
  /** عکس لحظه‌ای برای تاریخچه و مقایسهٔ بعدی. */
  function snapshot(plan, at) { const counts = {}; (plan.actions || []).forEach((a) => { counts[a.id] = a.count; }); return { at: at || Date.now(), score: plan.score, potential: plan.potential, items: plan.stats ? plan.stats.items : 0, counts }; }
  function mergeHistory(hist, snap, cap) { const h = (Array.isArray(hist) ? hist : []).filter((x) => x && typeof x.score === 'number'); h.push(snap); return h.slice(-(cap || 30)); }
  /** روند امتیاز نسبت به بررسی قبلی؛ اگر تعداد موردها خیلی فرق کرده باشد هشدار «مقایسه سخت است». */
  function trend(hist, snap) {
    const h = (Array.isArray(hist) ? hist : []).filter((x) => x && typeof x.score === 'number'); const prev = h.length ? h[h.length - 1] : null; if (!prev) return { first: true, series: [snap.score] };
    const sizeChanged = prev.items && snap.items ? Math.abs(snap.items - prev.items) / Math.max(prev.items, snap.items) > 0.25 : false;
    return { first: false, delta: snap.score - prev.score, prevAt: prev.at, prevCounts: prev.counts || {}, sizeChanged, series: h.slice(-9).map((x) => x.score).concat([snap.score]) };
  }
  const EFFORT_FA = { auto: 'خودکار', manual: 'ورود اطلاعات', studio: 'متن‌نویس', review: 'بازبینی' };
  function planToMarkdown(plan, links, opts) {
    const o = opts || {}; const L = ['# برنامهٔ سئوی سایت', '', 'امتیاز: ' + plan.score + ' ← ' + plan.potential + (plan.grade ? ' (' + plan.grade.label + ')' : '') + ' · موردها: ' + (plan.stats ? plan.stats.items : 0), '> امتیاز راهنمای ویرایش است، نه پیش‌بینی رتبه. نتیجهٔ نهایی را با Search Console بسنج.', ''];
    (plan.phases || schedule(plan.actions)).forEach((p) => { L.push('## ' + p.label + ' (سهم اثر نسبی ' + p.share + '٪)', p.hint, ''); p.actions.forEach((a, i) => { L.push((i + 1) + '. **' + a.title + '** — ' + a.count + ' مورد · ' + (EFFORT_FA[a.effort] || '')); if (a.how) L.push('   - ' + a.how); (a.items || []).slice(0, o.itemsPerAction || 5).forEach((x) => L.push('   - ' + x.title + (x.url ? ' ' + x.url : ''))); }); L.push(''); });
    if (links && links.suggestions && links.suggestions.length) { L.push('## پیوند داخلی پیشنهادی', linksToMarkdown(links), ''); }
    return L.join('\n').trim();
  }
  function planToCsv(plan) {
    const q = (v) => { let t = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
    const rows = [['phase', 'action_id', 'title', 'count', 'effort', 'impact', 'how'].map(q).join(',')];
    (plan.phases || schedule(plan.actions)).forEach((p) => p.actions.forEach((a) => rows.push([p.id, a.id, a.title, a.count, a.effort, a.impact, a.how].map(q).join(','))));
    return rows.join('\r\n');
  }

  function linksToMarkdown(links) { const s = (links && links.suggestions) || []; return s.length ? s.map((x) => '- «' + x.articleTitle + '» ← ' + x.productTitle + '\n  انکر: ' + x.anchor + '\n  بافت: ' + x.context + '\n  ' + x.snippet).join('\n') : 'پیشنهادی نیست.'; }

  return { linkPlan, sitePlan, linksToMarkdown, anchorsOf, cannibalGroups, duplicateContent, orphans, thinContent, urlIssues, lengthIssues, schedule, reconcile, nextStep, coverage, progress, insertLink, verifyLinkEdit, isLive, prioritizeLinks, automation, automationSummary, AUTOMATION, snapshot, mergeHistory, trend, planToMarkdown, planToCsv, PHASES };
});
