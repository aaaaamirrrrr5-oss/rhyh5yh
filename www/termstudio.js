/* Site Inspector — SI.TermStudio (v1.67). Pure.
 * Persian copy for the things ProductStudio and the article writer do NOT cover:
 *   - product categories, tags and brands (term description + SEO title + meta + short intro + FAQ + JSON-LD)
 *   - fixed pages: about, contact, store FAQ
 * Honesty rule (same as the rest of the app): facts about THIS store/brand/category come only from what the owner supplies
 * (name, sub-categories, real product titles, «کلید: مقدار» facts). Everything else is general advice about the product family
 * (SI.StudioData). No price, warranty, origin, "original", "best", years of experience, customer counts, ratings.
 * Whatever is missing is returned in `missing` instead of being invented. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./productstudio.js'), require('./studiodata.js'), require('./fromname.js'));
  else (root.SI = root.SI || {}).TermStudio = factory(root.SI && root.SI.ProductStudio, root.SI && root.SI.StudioData, root.SI && root.SI.FromName);
})(typeof self !== 'undefined' ? self : this, function (PS, Data, FN) {
  'use strict';
  const len = (s) => Array.from(String(s == null ? '' : s)).length;
  const fixc = (s) => String(s == null ? '' : s).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[ً-ٟ]/g, '');
  const plain = (s) => fixc(String(s == null ? '' : s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')).replace(/\s+/g, ' ').trim();
  const norm = (s) => plain(s).replace(/‌/g, ' ').toLowerCase();
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fit = (s, max) => { s = String(s).replace(/\s+/g, ' ').trim(); if (len(s) <= max) return s; let acc = ''; for (const x of s.split(' ')) { const n = acc ? acc + ' ' + x : x; if (len(n) > max) break; acc = n; } return acc.replace(/[\s،؛:,\-–|]+$/, ''); };
  function hash32(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const pick = (arr, r) => arr[Math.floor(r() * arr.length)];
  const uniq = (a) => { const seen = new Set(); return a.filter((x) => { const k = norm(x); if (!k || seen.has(k)) return false; seen.add(k); return true; }); };
  const BANNED = ['ضمانت', 'اصل', 'اورجینال', 'بهترین', 'ارزان', 'تخفیف', 'تضمین', 'پرفروش', 'رایگان', 'تضمینی', 'معتبرترین', 'شماره یک', 'نخست ایران'];
  const BANNED_RE = new RegExp('(?<![\\p{L}])(?:' + BANNED.join('|') + ')(?![\\p{L}])', 'iu');
  const KINDS = { category: 'دستهٔ محصول', tag: 'برچسب', brand: 'برند' };

  /* «این کتری‌ها» reads wrong for a plural/collective category name, so a leading «این » before the term is dropped. */
  const fill = (s, n) => String(s).replace(/\{n\}|\{t\}/g, n).replace(new RegExp('(^|[\\s«(])این ' + reEsc(n), 'g'), '$1' + n);
  const li = (a) => '<ul>' + a.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>';
  const factRows = (text) => String(text || '').split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => { const m = l.match(/^([^:：=]{2,30})\s*[:：=]\s*(.{1,200})$/); return m ? [plain(m[1]), plain(m[2])] : null; }).filter(Boolean);
  const links = (items, max) => (Array.isArray(items) ? items : []).map((x) => { if (!x || !x.title) return null; let u = ''; if (x.url) { try { const p = new URL(x.url); if (/^https?:$/.test(p.protocol)) u = p.href; } catch (e) { /* ignore bad url */ } } return { title: plain(x.title), url: u }; }).filter(Boolean).slice(0, max || 8);
  const linkList = (items) => '<ul>' + items.map((x) => '<li>' + (x.url ? '<a href="' + esc(x.url) + '">' + esc(x.title) + '</a>' : esc(x.title)) + '</li>').join('') + '</ul>';

  function family(name) {
    if (/(ابزار|تجهیزات|لوازم)\s*(جانبی\s*)?(دم‌?آوری\s*)?قهوه/.test(norm(name))) { const g = ((Data && Data.FAMILIES) || []).find((f) => f.id === 'coffeegear'); if (g) return g; }
    return PS && PS.detectFamily ? PS.detectFamily(name) : Data.GENERIC;
  }
  const slugify = (name) => (PS && PS.slugify ? PS.slugify(name, 6) : plain(name).replace(/\s+/g, '-'));


  /* ---------- smart layer: learn from the shop's REAL titles (never from imagination) ---------- */
  const fa = (v) => String(v).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  /** Generic category name? vote with the families of its children / products. */
  function voteFamily(titles) {
    const tally = new Map();
    titles.forEach((t) => { const f = family(t); if (f && f.id !== 'generic') tally.set(f.id, (tally.get(f.id) || 0) + 1); });
    let best = null; tally.forEach((v, k) => { if (!best || v > best[1]) best = [k, v]; });
    if (!best || best[1] < Math.max(1, Math.ceil(titles.length * 0.4))) return null;
    return ((Data && Data.FAMILIES) || []).find((f) => f.id === best[0]) || null;
  }
  /** Brands / materials / colours / sizes that actually occur in ≥2 titles (frequency-ranked). */
  function mine(titles, selfName) {
    const cnt = { brand: new Map(), material: new Map(), color: new Map(), size: new Map() };
    const add = (m, k) => { k = plain(k); if (k) m.set(k, (m.get(k) || 0) + 1); };
    titles.forEach((t) => {
      if (!FN || !FN.parseName) return; const p = FN.parseName(t, {});
      if (p.brand && norm(p.brand) !== norm(selfName)) add(cnt.brand, p.brand);
      p.materials.forEach((x) => add(cnt.material, x)); p.colors.forEach((x) => add(cnt.color, x)); p.qty.forEach((x) => add(cnt.size, x.text));
    });
    const top = (m, k) => [...m.entries()].filter((x) => x[1] >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fa')).slice(0, k || 5).map((x) => x[0]);
    return { brands: top(cnt.brand), materials: top(cnt.material), colors: top(cnt.color), sizes: top(cnt.size, 4), n: titles.length };
  }
  const NUM_RE = /[\d۰-۹٠-٩]+(?:[.,٫][\d۰-۹٠-٩]+)?/g;
  const latin = (t) => String(t).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
  const nums = (t) => (latin(t).match(NUM_RE) || []).map((x) => x.replace(',', '.'));

  /* ---------- titles / meta ---------- */
  function termTitle(n, kind, site, r, taken) {
    const s = plain(site || ''); const c = [];
    if (kind === 'brand') { if (s && len(s) <= 18) c.push('محصولات ' + n + ' | ' + s); c.push('محصولات ' + n + ' – مشاهده و خرید', 'محصولات ' + n); }
    else if (kind === 'tag') { if (s && len(s) <= 18) c.push(n + ' | ' + s); c.push('محصولات مرتبط با ' + n, n + ' – محصولات و راهنما'); }
    else { if (s && len(s) <= 18) c.push('خرید ' + n + ' | ' + s); c.push('خرید ' + n + ' – انواع و راهنمای انتخاب', 'خرید ' + n + ' | راهنمای انتخاب', 'خرید ' + n); }
    const ok = (v) => len(v) >= 15 && len(v) <= 60; const list = c.filter(ok);
    return list.find((v) => !taken(norm(v))) || list[0] || fit(c[c.length - 1] || n, 60);
  }
  function termMeta(n, kind, T, count, r, taken) {
    const cnt = count > 0 ? ' (' + String(count).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]) + ' محصول ثبت‌شده)' : '';
    const c = kind === 'brand'
      ? ['محصولات ' + n + cnt + ' را در یک صفحه ببینید؛ مشخصات هر محصول، راهنمای انتخاب و پرسش‌های متداول در صفحهٔ هر کالا آمده است.', 'فهرست محصولات ' + n + cnt + ' را مرور کنید و با مشخصات ثبت‌شده و راهنمای خرید، گزینهٔ مناسب نیاز خود را پیدا کنید.']
      : kind === 'tag'
        ? ['محصولات مرتبط با ' + n + cnt + ' را یکجا ببینید و با راهنمای کوتاه انتخاب، گزینهٔ مناسب نیاز خود را پیدا کنید.', 'فهرست محصولات ' + n + cnt + ' همراه با نکات انتخاب و پرسش‌های متداول در این صفحه گردآوری شده است.']
        : ['انواع ' + n + cnt + ' را ببینید؛ راهنمای انتخاب، نکات استفاده و پرسش‌های متداول ' + n + ' در همین صفحه آمده است.', 'برای خرید ' + n + cnt + ' مشخصات را مقایسه کنید و با راهنمای انتخاب و نکات نگهداری، گزینهٔ مناسب خود را پیدا کنید.', n + cnt + ' را با راهنمای انتخاب، کاربردها و پرسش‌های متداول بررسی کنید و پیش از سفارش با نیاز خود مقایسه کنید.'];
    const start = Math.floor(r() * c.length); const rot = c.slice(start).concat(c.slice(0, start)).map((v) => { v = v.replace(/\s+/g, ' '); return len(v) > 160 ? fit(v, 157) + '.' : v; });
    return rot.find((v) => len(v) >= 70 && !taken(norm(v))) || rot.find((v) => len(v) >= 70) || rot[0];
  }

  /* ---------- terms: category / tag / brand ---------- */
  /** opts: { kind, site, siteUrl, facts, children:[{title,url}], products:[{title,url}], count, parent, catalog, seed, takenTitle, takenMeta } */
  function build(name, opts) {
    const o = opts || {}; const kind = KINDS[o.kind] ? o.kind : 'category';
    const n = plain(name).replace(/^(?:خرید|قیمت|فروش|دسته|برچسب|برند)\s+/, '').trim();
    if (len(n) < 2) return { ok: false, why: 'نام خالی یا بسیار کوتاه است.' };
    if (len(n) > 80) return { ok: false, why: 'نام بیش از حد طولانی است.' };
    const allTitles = (Array.isArray(o.products) ? o.products : []).concat(Array.isArray(o.children) ? o.children : []).map((x) => plain(x && x.title)).filter(Boolean).slice(0, 300);
    let fam = family(n); let inferred = false;
    if (fam.id === 'generic' && allTitles.length) { const v = voteFamily(allTitles); if (v) { fam = v; inferred = true; } }
    const generic = fam.id === 'generic'; const r = rng(hash32(kind + '|' + n + '|' + (o.seed || '')));
    const taken = (f) => (typeof f === 'function' ? f : () => false);
    const T = generic ? n : n; // the term name itself is the keyphrase
    const rows = factRows(o.facts); const children = links(o.children, 12); const products = links(o.products, 8);
    const count = Number(o.count) > 0 ? Math.round(Number(o.count)) : 0; const fk = n;
    const seo_title = termTitle(n, kind, o.site, r, taken(o.takenTitle)); const meta_description = termMeta(n, kind, T, count, r, taken(o.takenMeta));
    const rot = (a) => { const s = Math.floor(r() * a.length); return a.slice(s).concat(a.slice(0, s)); };
    const F = (s) => fill(s, n);

    /* short intro: the 1–2 sentences shown ABOVE the product grid (keep it short; the long text goes under the grid) */
    const introV = kind === 'brand'
      ? ['در این صفحه محصولات ' + n + ' را یکجا می‌بینید؛ برای هر کالا مشخصات و پرسش‌های متداول در صفحهٔ همان محصول آمده است.', 'فهرست محصولات ' + n + ' در این صفحه گردآوری شده است؛ برای مقایسه، مشخصات هر کالا را در صفحهٔ آن ببینید.']
      : kind === 'tag'
        ? ['محصولات مرتبط با «' + n + '» در این صفحه گردآوری شده‌اند؛ برای انتخاب، مشخصات هر کالا را مقایسه کنید.', 'اگر دنبال ' + n + ' هستید، فهرست محصولات مرتبط را در همین صفحه ببینید و مشخصات را مقایسه کنید.']
        : ['در این صفحه انواع ' + n + ' را می‌بینید؛ پیش از خرید، مشخصات را با نیاز خود مقایسه کنید و برای انتخاب دقیق‌تر، راهنمای پایین صفحه را بخوانید.', 'اگر دنبال خرید ' + n + ' هستید، همین‌جا گزینه‌ها را مرور کنید و با راهنمای انتخاب پایین صفحه تصمیم بگیرید.'];
    const intro = pick(introV, r);

    /* long description (HTML, no H1: the theme prints the term name) */
    const h = []; const sections = [];
    const sec = (title, body) => { h.push('<h2>' + esc(title) + '</h2>', body); sections.push(title); };
    h.push('<p>' + esc(intro) + '</p>');
    if (rows.length) sec('اطلاعات ثبت‌شده دربارهٔ ' + n, li(rows.slice(0, 6).map((x) => x[0] + ': ' + x[1])));
    if (kind === 'brand') {
      sec('محصولات ' + n + ' در فروشگاه', '<p>' + esc('این صفحه فهرست محصولات ' + n + ' را نشان می‌دهد' + (count ? ' و در حال حاضر ' + String(count).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]) + ' محصول از این برند ثبت شده است' : '') + '. مشخصات دقیق هر کالا در صفحهٔ خودش آمده و ممکن است با مدل‌های دیگر تفاوت داشته باشد.') + '</p>');
    } else if (!generic) {
      sec(pick(['دربارهٔ ' + n, n + ' چیست و چه کاربردی دارد؟', 'معرفی ' + n], r), '<p>' + esc(F(pick(fam.what, r))) + '</p>');
    }
    if (children.length) sec('انواع ' + n, '<p>' + esc('برای دیدن گزینه‌های هر گروه، یکی از زیردسته‌های زیر را باز کنید:') + '</p>' + linkList(children));
    if (!generic && kind !== 'tag') {
      sec(pick(['راهنمای انتخاب ' + n, 'قبل از خرید ' + n + ' به چه نکاتی توجه کنیم؟', 'چگونه ' + n + ' مناسب نیاز خود را انتخاب کنیم؟'], r), li(rot(fam.buy).slice(0, 5).map(F)));
      sec(n + ' مناسب چه کسانی است؟', li(rot(fam.who).slice(0, 3).map(F)));
    } else if (!generic) {
      sec('نکات انتخاب', li(rot(fam.buy).slice(0, 3).map(F)));
    } else {
      sec('راهنمای کلی انتخاب', li(Data.GENERIC.buy.map(F)));
    }
    if (!generic && kind === 'category') sec('نکات استفاده و نگهداری', li(rot(fam.use).slice(0, 2).concat(rot(fam.care).slice(0, 2)).map(F)));
    const mined = mine(allTitles, n);
    const mineBits = [];
    if (mined.n >= 3) {
      if (mined.brands.length && kind !== 'brand') mineBits.push('برندهای موجود: ' + mined.brands.join('، '));
      if (mined.materials.length) mineBits.push('جنس‌های رایج: ' + mined.materials.join('، '));
      if (mined.colors.length) mineBits.push('رنگ‌های رایج: ' + mined.colors.join('، '));
      if (mined.sizes.length) mineBits.push('اندازه‌ها و مقدارهای رایج: ' + mined.sizes.join('، '));
    }
    if (mineBits.length >= 1) sec('ویژگی‌های رایج محصولات ' + n, '<p>' + esc('بر اساس عنوان محصولاتی که اکنون در این بخش ثبت شده‌اند:') + '</p>' + li(mineBits));
    if (products.length) sec('نمونه‌ای از محصولات ' + n, '<p>' + esc('چند نمونه از محصولات این بخش:') + '</p>' + linkList(products));

    /* FAQ: owner facts first, then family-level answers, then store flow */
    const faq = [];
    if (count > 0) faq.push([n + ' چند محصول دارد؟', 'در حال حاضر ' + String(count).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]) + ' محصول در این بخش ثبت شده است؛ این تعداد با افزودن یا ناموجودشدن کالاها تغییر می‌کند.']);
    if (mined.n >= 3 && mined.materials.length) faq.push(['محصولات ' + n + ' از چه جنس‌هایی هستند؟', 'در محصولات ثبت‌شدهٔ این بخش جنس‌های ' + mined.materials.join('، ') + ' دیده می‌شود؛ جنس دقیق هر کالا در صفحهٔ خودش آمده است.']);
    if (mined.n >= 3 && mined.brands.length && kind !== 'brand') faq.push(['چه برندهایی در ' + n + ' موجود است؟', 'در محصولات ثبت‌شدهٔ این بخش برندهای ' + mined.brands.join('، ') + ' دیده می‌شود.']);
    if (children.length) faq.push([n + ' چه گروه‌هایی دارد؟', 'زیردسته‌های ثبت‌شده: ' + children.map((x) => x.title).join('، ') + '.']);
    if (!generic && kind !== 'brand') rot(fam.faq).slice(0, 3).forEach(([q, a]) => faq.push([F(q), F(a)]));
    faq.push(['قیمت و موجودی ' + n + ' را از کجا ببینم؟', 'قیمت و موجودی هر کالا در صفحهٔ همان محصول نمایش داده می‌شود و ممکن است تغییر کند.']);
    if (kind === 'brand') faq.push(['مشخصات محصولات ' + n + ' را کجا بخوانم؟', 'مشخصات، توضیحات و پرسش‌های متداول هر محصول در صفحهٔ خودش آمده است.']);
    const faqOut = faq.slice(0, 6);
    sec('پرسش‌های متداول دربارهٔ ' + n, faqOut.map(([q, a]) => '<h3>' + esc(q) + '</h3><p>' + esc(a) + '</p>').join(''));
    h.push('<p>' + esc(pick(['برای دیدن قیمت و موجودی روز ' + n + '، محصولات بالای همین صفحه را بررسی کنید. اگر پیش از خرید ابهامی دارید، از فروشگاه بپرسید.', 'پس از مرور راهنمای بالا، ' + n + ' را با نیاز خود مقایسه کنید و برای قیمت و موجودی روز به صفحهٔ هر محصول سر بزنید.'], r)) + '</p>');
    const description = h.join('\n');
    const wordCount = plain(description).split(/\s+/).filter(Boolean).length;

    /* thin-term guard (real SEO practice): tag pages with few products are usually noindex candidates */
    const advice = [];
    if (kind === 'tag' && count > 0 && count < 3) advice.push('این برچسب فقط ' + count + ' محصول دارد؛ صفحه‌های برچسب کم‌محتوا معمولاً بهتر است noindex شوند یا حذف/ادغام شوند.');
    if (kind === 'tag' && !count) advice.push('تعداد محصولات برچسب را وارد کن؛ برچسب‌های کم‌محصول بهتر است noindex شوند.');
    if (generic && kind !== 'brand') advice.push('این نام در هیچ خانوادهٔ شناخته‌شده‌ای نیست؛ متن عمومی‌تر است. با افزودن «زیردسته‌ها» و «نمونه محصولات» و اطلاعات واقعی دقیق‌تر می‌شود.');
    if (kind === 'category' && !children.length && !products.length) advice.push('اگر زیردسته یا نمونه محصول واقعی بدهی، بخش‌های «انواع» و «نمونه‌ها» با لینک داخلی واقعی ساخته می‌شود.');

    if (inferred) advice.push('نام «' + n + '» عمومی بود؛ نوع محتوا از روی عنوان محصولات واقعی («' + fam.label + '») تشخیص داده شد.');
    const clash = (Array.isArray(o.existingTerms) ? o.existingTerms : []).find((x) => x && norm(x.name || x) === norm(n) && (x.kind || kind) !== kind);
    if (clash) advice.push('«' + n + '» هم‌زمان نام یک ' + KINDS[clash.kind || kind] + ' دیگر هم هست؛ دو صفحه برای یک عبارت یکدیگر را تضعیف می‌کنند (کانیبالیزیشن). یکی را noindex یا ادغام کن.');
    const kw = uniq([n, 'خرید ' + n, 'قیمت ' + n, 'انواع ' + n, 'راهنمای خرید ' + n].concat(mined.materials.slice(0, 2).map((m) => n + ' ' + m), mined.brands.slice(0, 2).map((b) => n + ' ' + b))).slice(0, 8);
    const known = new Set(nums([n, o.facts, count, allTitles.join(' ')].join(' ')));

    /* JSON-LD: only facts that exist */
    const page = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: n, description: fit(plain(h.slice(0, 2).join(' ')), 300) };
    if (o.url) page.url = String(o.url);
    if (products.some((x) => x.url)) page.mainEntity = { '@type': 'ItemList', itemListElement: products.filter((x) => x.url).map((x, i) => ({ '@type': 'ListItem', position: i + 1, url: x.url, name: x.title })) };
    const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqOut.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
    let breadcrumb = null;
    if (o.siteUrl) { try { const base = new URL(o.siteUrl).origin + '/'; const list = [{ '@type': 'ListItem', position: 1, name: plain(o.site) || 'خانه', item: base }]; if (o.parent) list.push({ '@type': 'ListItem', position: 2, name: plain(o.parent) }); list.push({ '@type': 'ListItem', position: list.length + 1, name: n }); breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: list }; } catch (e) { /* ignore */ } }
    const schemaJson = [page, faqSchema, breadcrumb].filter(Boolean).map((x) => '<script type="application/ld+json">' + JSON.stringify(x).replace(/</g, '\\u003c') + '</script>').join('\n');

    const missing = [];
    if (!rows.length) missing.push(kind === 'brand' ? 'معرفی واقعی برند (کشور سازنده، سابقه فقط اگر مستند است)' : 'اطلاعات واقعی دسته');
    if (!count) missing.push('تعداد محصولات');
    missing.push('تصویر شاخص ' + KINDS[kind], 'بررسی نهایی متن توسط مدیر فروشگاه');
    const res = { ok: true, kind, name: n, family: fam.id, familyLabel: fam.label, slug: slugify(n), fields: { name: n, description, intro, seo_title, meta_description, focus_keyword: fk }, faq: faqOut, schema: { page, faq: faqSchema, breadcrumb }, schemaJson, sections, advice, missing, wordCount, facts: rows, children, products, mined, keywords: kw, inferred, known: [...known] };
    res.fields.related_keywords = kw.join(', ');
    res.score = score(res);
    return res;
  }

  /* ---------- self-check: guidance, NOT a Google ranking ---------- */
  function score(res) {
    const f = res.fields; const fk = norm(f.focus_keyword); const text = norm(f.description); const first = norm(plain(f.description).split(/\s+/).slice(0, 80).join(' '));
    const h2 = (f.description.match(/<h2>[\s\S]*?<\/h2>/g) || []).map(norm); const stripped = plain(f.description).split(res.name).join(' ');
    const minWords = res.kind === 'tag' ? 120 : 220;
    const c = [
      ['title_len', 'عنوان سئو ۱۵ تا ۶۰ نویسه', len(f.seo_title) >= 15 && len(f.seo_title) <= 60, 'عنوان را کوتاه یا بلندتر کنید.'],
      ['title_kw', 'نام در عنوان سئو', norm(f.seo_title).includes(fk), 'نام را به عنوان اضافه کنید.'],
      ['meta_len', 'متا دیسکریپشن ۷۰ تا ۱۶۰ نویسه', len(f.meta_description) >= 70 && len(f.meta_description) <= 160, 'طول متا را اصلاح کنید.'],
      ['meta_kw', 'نام در متا', norm(f.meta_description).includes(fk), 'نام را در متا بیاورید.'],
      ['kw_intro', 'نام در ۸۰ واژهٔ اول', first.includes(fk), 'نام را در پاراگراف اول بیاورید.'],
      ['kw_h2', 'نام در حداقل یک H2', h2.some((x) => x.includes(fk)), 'یکی از زیرتیترها را با نام بنویسید.'],
      ['words', 'حداقل ' + minWords + ' واژه', res.wordCount >= minWords, 'زیردسته، نمونه محصول یا اطلاعات واقعی اضافه کنید.'],
      ['max_words', 'نه بیش از ۹۰۰ واژه (متن دسته نباید محصولات را پایین ببرد)', res.wordCount <= 900, 'متن را کوتاه‌تر کنید.'],
      ['structure', 'زیرتیتر، فهرست و پرسش‌وپاسخ', /<ul>/.test(f.description) && h2.length >= 3 && res.faq.length >= 2, 'ساختار متن را کامل کنید.'],
      ['intro_short', 'مقدمهٔ بالای محصولات حداکثر ۲۵۰ نویسه', len(f.intro) <= 250, 'مقدمه را کوتاه کنید.'],
      ['claims', 'بدون ادعای تأییدنشده (اصل، ضمانت، بهترین…)', !BANNED_RE.test(norm(stripped + ' ' + f.seo_title + ' ' + f.meta_description)), 'ادعای تأییدنشده را حذف کنید.'],
      ['density', 'تراکم نام بین ۰٫۳ تا ۵ درصد', (() => { const w = Math.max(1, res.wordCount); const k = text.split(fk).length - 1; const d = 100 * k * fk.split(' ').length / w; return d >= 0.3 && d <= 5; })(), 'نام را کمتر یا بیشتر به‌کار ببرید.'],
      ['unique', 'شباهت متن به دسته‌های دیگر کمتر از ۶۰٪', !res.similarity || res.similarity.max < 60, res.similarity ? 'شبیه «' + res.similarity.with + '» (' + res.similarity.max + '٪)؛ اطلاعات واقعی و متمایز اضافه کنید.' : ''],
    ];
    const checks = c.map(([id, label, ok, tip]) => ({ id, label, ok: !!ok, tip: ok ? '' : tip }));
    return { value: Math.round(100 * checks.filter((x) => x.ok).length / checks.length), checks };
  }

  const sh = (res) => { const t = norm(plain(res.fields.description).split(res.name).join(' ')).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean); const set = new Set(); for (let i = 0; i + 3 <= t.length; i++) set.add(t.slice(i, i + 3).join(' ')); return set; };
  const jacc = (a, b) => { if (!a.size || !b.size) return 0; let x = 0; a.forEach((v) => { if (b.has(v)) x++; }); return x / (a.size + b.size - x); };
  /** Duplicate-content guard inside the batch (same family terms share template sentences, so the limit is looser than for products). */
  function markSimilarity(results) {
    const ok = results.filter((r) => r && r.ok); const s = ok.map(sh);
    ok.forEach((r, i) => { let max = 0; let who = ''; s.forEach((x, j) => { if (j === i) return; const v = jacc(s[i], x); if (v > max) { max = v; who = ok[j].name; } }); r.similarity = { max: Math.round(max * 100), with: who }; r.score = score(r); });
    return results;
  }
  /** Self-improvement loop: build with several seeds, keep the highest-scoring version (first wins ties, so output stays stable). */
  function best(make, tries) {
    let top = null;
    for (let i = 0; i < (tries || 6); i++) { const r = make(i); if (!r.ok) return r; r.attempt = i + 1; if (!top || r.score.value > top.score.value) top = r; if (top.score.value === 100) break; }
    return top;
  }
  /** Several names (one per line) of the same kind; titles/metas stay unique. */
  function buildMany(names, opts) {
    const o = Object.assign({}, opts || {}); const tt = new Set(); const tm = new Set(); const seen = new Set(); const out = [];
    (Array.isArray(names) ? names : String(names || '').split(/\n+/)).map(plain).filter(Boolean).forEach((nm) => {
      const k = norm(nm); if (seen.has(k)) return; seen.add(k);
      const r = best((seed) => build(nm, Object.assign({}, o, { seed: String(o.seed || '') + '#' + seed, takenTitle: (v) => tt.has(v), takenMeta: (v) => tm.has(v) })));
      if (r.ok) { tt.add(norm(r.fields.seo_title)); tm.add(norm(r.fields.meta_description)); } out.push(r);
    });
    return markSimilarity(out.slice(0, 50));
  }
  function toText(res) {
    const f = res.fields;
    return [KINDS[res.kind] + ': ' + res.name, 'عبارت کلیدی: ' + f.focus_keyword, 'عنوان سئو: ' + f.seo_title, 'متا دیسکریپشن: ' + f.meta_description, 'اسلاگ: ' + res.slug, '', 'مقدمهٔ بالای محصولات:', f.intro, '', 'توضیحات (HTML):', f.description, '', 'JSON-LD:', res.schemaJson].join('\n');
  }
  /** Spreadsheet-safe CSV for manual / plugin-based import of term descriptions + Yoast / Rank Math term meta. */
  function toCsv(results) {
    const head = ['Kind', 'Name', 'Slug', 'Description', 'Intro', 'SEO title', 'Meta description', 'Focus keyword'];
    const cell = (v) => { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    const rows = (results || []).filter((r) => r && r.ok).map((r) => [r.kind, r.name, r.slug, r.fields.description, r.fields.intro, r.fields.seo_title, r.fields.meta_description, r.fields.focus_keyword]);
    return [head].concat(rows).map((x) => x.map(cell).join(',')).join('\r\n');
  }


  /* ---------- optional on-device rewrite (validated; on any violation the deterministic text stays) ---------- */
  function polishPrompt(res) {
    const f = res.fields; const facts = res.facts.map((x) => x[0] + ': ' + x[1]).concat(res.mined && res.mined.n >= 3 ? ['برندها: ' + res.mined.brands.join('، '), 'جنس‌ها: ' + res.mined.materials.join('، ')].filter((x) => !/: $/.test(x)) : []).join('\n') || '(فقط نام)';
    return [{ role: 'system', content: 'تو سردبیر سئوی فروشگاه اینترنتی هستی. فقط فارسی روان و حرفه‌ای بنویس. هیچ عدد، قیمت، سابقه، کشور، گارانتی، ادعای «اصل/بهترین/ارزان» یا ویژگی خارج از واقعیت‌های داده‌شده نساز. فقط یک JSON معتبر برگردان: {"intro":"...","guide":"..."}' },
      { role: 'user', content: 'نوع صفحه: ' + KINDS[res.kind] + '\nنام: ' + res.name + '\nنوع کالا: ' + res.familyLabel + '\nواقعیت‌های موجود:\n' + facts + '\n\nintro: ۲ جمله (۶۰ تا ۲۵۰ نویسه) که نام را بیاورد و به خواننده بگوید این صفحه چه کمکی می‌کند.\nguide: یک پاراگراف ۲ تا ۴ جمله‌ای (۸۰ تا ۴۰۰ نویسه) دربارهٔ نکتهٔ مهم انتخاب این نوع کالا، کاملاً عمومی و بدون ادعا.' }];
  }
  function applyPolish(res, raw) {
    let j; try { j = JSON.parse(String(raw).replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, '$1')); } catch (e) { return { ok: false, why: 'خروجی مدل JSON معتبر نبود.' }; }
    const known = new Set((res.known || []).concat(nums(res.name)));
    const lim = { intro: [60, 250], guide: [80, 400] };
    for (const k of ['intro', 'guide']) {
      const v = plain(j && j[k]); if (len(v) < lim[k][0] || len(v) > lim[k][1]) return { ok: false, why: 'طول ' + k + ' مجاز نیست.' };
      if (BANNED_RE.test(norm(v))) return { ok: false, why: 'ادعای تأییدنشده در ' + k + '.' };
      if (nums(v).some((x) => !known.has(x))) return { ok: false, why: 'عدد خارج از واقعیت‌ها در ' + k + '.' };
      if (/[<>{}\[\]]|https?:/i.test(v)) return { ok: false, why: 'نشانه‌گذاری غیرمجاز در ' + k + '.' };
      if (/[\u4e00-\u9fff\u0400-\u04ff]/.test(v)) return { ok: false, why: 'نویسهٔ غیرفارسی در ' + k + '.' };
    }
    if (!norm(j.intro).includes(norm(res.name))) return { ok: false, why: 'intro نام را ندارد.' };
    const old = '<p>' + esc(res.fields.intro) + '</p>'; if (!res.fields.description.includes(old)) return { ok: false, why: 'جایگزینی انجام نشد.' };
    const d = res.fields.description.replace(old, '<p>' + esc(plain(j.intro)) + '</p>\n<p>' + esc(plain(j.guide)) + '</p>');
    const out = Object.assign({}, res, { fields: Object.assign({}, res.fields, { description: d, intro: plain(j.intro) }), polished: true });
    out.wordCount = plain(d).split(/\s+/).filter(Boolean).length; out.score = score(out); return { ok: true, res: out };
  }

  /* ---------- fixed pages: about / contact / store FAQ — built ONLY from owner facts ---------- */
  const PAGE_KINDS = { about: 'درباره ما', contact: 'تماس با ما', faq: 'پرسش‌های متداول فروشگاه', shipping: 'ارسال و مرجوعی', landing: 'صفحهٔ فرود' };
  const FACT_KEYS = {
    about: [['نام فروشگاه', /^(نام( فروشگاه)?|فروشگاه)$/], ['حوزه فعالیت', /حوزه|فعالیت|محصولات|تخصص/], ['شهر', /^(شهر|استان)$/], ['سال تأسیس', /تأسیس|تاسیس|شروع/], ['ارزش‌ها یا روش کار', /روش|ارزش|رویکرد|ماموریت|مأموریت/]],
    contact: [['تلفن', /تلفن|موبایل|شماره/], ['ایمیل', /ایمیل|email/i], ['نشانی', /نشانی|آدرس/], ['ساعت پاسخگویی', /ساعت/], ['شبکه اجتماعی', /اینستاگرام|تلگرام|واتساپ|ایتا|لینکدین/]],
  };
  const clean2 = (v) => String(v).replace(/[.؟!]+$/, '') + '.';
  const getFact = (rows, re) => (rows.find((x) => re.test(x[0])) || [])[1];
  /** buildPage(kind, { site, siteUrl, facts: «کلید: مقدار» lines, seed }) */
  function buildPage(kind, opts) {
    const o = opts || {}; if (!PAGE_KINDS[kind]) return { ok: false, why: 'نوع صفحه معتبر نیست.' };
    const rows = factRows(o.facts); const site = plain(o.site) || getFact(rows, /^(نام( فروشگاه)?|فروشگاه)$/) || '';
    if (kind !== 'faq' && !rows.length) return { ok: false, why: 'برای این صفحه حداقل چند اطلاعات واقعی «کلید: مقدار» لازم است؛ چیزی جعل نمی‌شود.' };
    if (!site && kind !== 'faq') return { ok: false, why: 'نام فروشگاه را وارد کن (مثلاً «نام فروشگاه: …»).' };
    const r = rng(hash32(kind + '|' + site + '|' + (o.seed || ''))); const h = []; const missing = []; const noun = site || 'فروشگاه';
    let faq = []; let seo_title; let meta_description; let focus;
    if (kind === 'about') {
      focus = 'درباره ' + noun; seo_title = fit('درباره ' + noun + ' | معرفی فروشگاه', 60);
      const field = getFact(rows, /حوزه|فعالیت|محصولات|تخصص/); const city = getFact(rows, /^(شهر|استان)$/); const year = getFact(rows, /تأسیس|تاسیس|شروع/); const way = getFact(rows, /روش|ارزش|رویکرد|ماموریت|مأموریت/);
      h.push('<p>' + esc(noun + ' ' + (field ? 'در حوزهٔ ' + field + ' فعالیت می‌کند' : 'یک فروشگاه اینترنتی است') + (city ? ' و از ' + city + ' خدمات می‌دهد' : '') + '. در این صفحه معرفی کوتاهی از فروشگاه و راه‌های ارتباط با ما آمده است.') + '</p>');
      if (field) h.push('<h2>' + esc('در ' + noun + ' چه محصولاتی عرضه می‌شود؟') + '</h2>', '<p>' + esc('محصولات ' + noun + ' در حوزهٔ ' + field + ' است. مشخصات هر کالا در صفحهٔ همان محصول ثبت شده و پیش از سفارش می‌توانید با فروشگاه تماس بگیرید.') + '</p>'); else missing.push('حوزه فعالیت');
      if (year) h.push('<h2>' + esc('سابقهٔ ' + noun) + '</h2>', '<p>' + esc('فعالیت ' + noun + ' از ' + year + ' آغاز شده است.') + '</p>'); else missing.push('سال تأسیس (فقط اگر مستند است)');
      if (way) h.push('<h2>' + esc('روش کار ما') + '</h2>', '<p>' + esc(way.replace(/[.؟!]+$/, '') + '.') + '</p>'); else missing.push('روش کار یا ارزش‌ها');
      if (!city) missing.push('شهر');
      h.push('<h2>' + esc('ارتباط با ' + noun) + '</h2>', '<p>' + esc('برای پرسش دربارهٔ محصولات یا سفارش، از بخش «تماس با ما» استفاده کنید.') + '</p>');
      meta_description = fit(noun + (field ? ' در حوزهٔ ' + field : '') + ' را بشناسید؛ معرفی فروشگاه، محصولات و راه‌های ارتباط با ما در این صفحه آمده است.', 158);
      faq = [['فروشگاه ' + noun + ' چه محصولاتی دارد؟', field ? 'محصولات ' + noun + ' در حوزهٔ ' + field + ' است.' : 'فهرست محصولات را در صفحهٔ فروشگاه ببینید.'], ['چطور با ' + noun + ' تماس بگیرم؟', 'از بخش «تماس با ما» راه‌های ارتباطی ثبت‌شده را ببینید.']];
    } else if (kind === 'contact') {
      focus = 'تماس با ' + noun; seo_title = fit('تماس با ' + noun + ' | راه‌های ارتباطی', 60);
      const tel = getFact(rows, /تلفن|موبایل|شماره/); const mail = getFact(rows, /ایمیل|email/i); const addr = getFact(rows, /نشانی|آدرس/); const hrs = getFact(rows, /ساعت/); const soc = rows.filter((x) => /اینستاگرام|تلگرام|واتساپ|ایتا|لینکدین/.test(x[0]));
      h.push('<p>' + esc('برای پرسش دربارهٔ محصولات، پیگیری سفارش یا مشاورهٔ خرید می‌توانید از راه‌های زیر با ' + noun + ' در ارتباط باشید.') + '</p>');
      const items = []; if (tel) items.push('تلفن: ' + tel); if (mail) items.push('ایمیل: ' + mail); if (addr) items.push('نشانی: ' + addr); soc.forEach((x) => items.push(x[0] + ': ' + x[1]));
      if (items.length) h.push('<h2>' + esc('راه‌های ارتباطی ' + noun) + '</h2>', li(items)); else missing.push('حداقل یک راه ارتباطی (تلفن، ایمیل یا نشانی)');
      if (hrs) h.push('<h2>' + esc('ساعت پاسخگویی') + '</h2>', '<p>' + esc('ساعت پاسخگویی: ' + hrs + '.') + '</p>'); else missing.push('ساعت پاسخگویی');
      h.push('<h2>' + esc('پیش از تماس') + '</h2>', li(['نام محصول و در صورت وجود کد سفارش را آماده داشته باشید', 'اگر دربارهٔ مشخصات سؤال دارید، نام دقیق محصول را بنویسید', 'برای پیگیری سفارش، شمارهٔ سفارش را اعلام کنید']));
      meta_description = fit('راه‌های ارتباط با ' + noun + (tel ? '، شمارهٔ تماس' : '') + (addr ? ' و نشانی' : '') + ' را ببینید و برای پرسش دربارهٔ محصولات و سفارش با ما در ارتباط باشید.', 158);
      faq = [['چطور با ' + noun + ' تماس بگیرم؟', items.length ? 'راه‌های ثبت‌شده: ' + items.join('، ') + '.' : 'راه‌های ارتباطی هنوز در این صفحه ثبت نشده است.'], ['برای پیگیری سفارش چه اطلاعاتی لازم است؟', 'نام و شمارهٔ سفارش را هنگام تماس اعلام کنید.']];
      if (!items.length) return { ok: false, why: 'برای صفحهٔ تماس حداقل یک راه ارتباطی واقعی (تلفن، ایمیل، نشانی) لازم است.' };
    } else if (kind === 'shipping') {
      focus = 'ارسال و مرجوعی ' + noun; seo_title = fit('شرایط ارسال و مرجوعی ' + noun, 60);
      const get = (re) => getFact(rows, re); const clean = (v) => v.replace(/[.؟!]+$/, '') + '.';
      const parts = [['ارسال', /ارسال|حمل/, 'روش و زمان ارسال'], ['هزینه ارسال', /هزینه/, 'هزینهٔ ارسال'], ['مناطق', /منطقه|شهر‌?ها|پوشش/, 'مناطق تحت پوشش'], ['مرجوعی', /مرجوع|بازگشت/, 'شرایط مرجوعی'], ['پرداخت', /پرداخت/, 'روش‌های پرداخت'], ['پیگیری', /پیگیری|رهگیری/, 'پیگیری سفارش']];
      h.push('<p>' + esc('شرایط ارسال، پرداخت و مرجوعی سفارش‌های ' + noun + ' در این صفحه آمده است. مفاد زیر همان است که فروشگاه ثبت کرده و ممکن است بسته به محصول متفاوت باشد.') + '</p>');
      parts.forEach(([, re, title]) => { const v = get(re); if (v) h.push('<h2>' + esc(title) + '</h2>', '<p>' + esc(clean(v)) + '</p>'); else missing.push(title); });
      if (h.length <= 1) return { ok: false, why: 'حداقل یک اطلاعات واقعی (ارسال، مرجوعی، پرداخت…) لازم است؛ شرایط حقوقی جعل نمی‌شود.' };
      missing.push('بررسی حقوقی نهایی شرایط');
      meta_description = fit('شرایط ارسال، پرداخت و مرجوعی سفارش از ' + noun + ' را پیش از خرید در این صفحه بخوانید و در صورت ابهام با فروشگاه تماس بگیرید.', 158);
      faq = parts.map(([, re, title]) => [title + ' چگونه است؟', get(re) ? clean(get(re)) : null]).filter((x) => x[1]);
    } else if (kind === 'landing') {
      const sub = getFact(rows, /^(موضوع|محصول|خدمت|خدمات|عنوان)$/); if (!sub) return { ok: false, why: 'برای صفحهٔ فرود «موضوع: …» (نام محصول یا خدمت) لازم است.' };
      focus = sub; seo_title = fit(sub + ' | ' + noun, 60); const ben = rows.filter((x) => /^(ویژگی|مزیت|نکته)/.test(x[0])).map((x) => x[1]); const who = getFact(rows, /مخاطب|مناسب/); const how = getFact(rows, /روش|مراحل|نحوه/); const cta = getFact(rows, /تماس|سفارش|اقدام/);
      const fam = family(sub);
      h.push('<p>' + esc(sub + ' را در ' + noun + ' ببینید. در این صفحه خلاصه‌ای از ویژگی‌ها و نکات انتخاب آمده است.') + '</p>');
      if (ben.length) h.push('<h2>' + esc('ویژگی‌های ' + sub) + '</h2>', li(ben.slice(0, 6))); else missing.push('ویژگی‌ها (چند خط «ویژگی: …»)');
      if (who) h.push('<h2>' + esc(sub + ' مناسب چه کسانی است؟') + '</h2>', '<p>' + esc(clean2(who)) + '</p>'); else if (fam.id !== 'generic') h.push('<h2>' + esc(sub + ' مناسب چه کسانی است؟') + '</h2>', li(fam.who.slice(0, 3).map((x) => fill(x, sub))));
      if (fam.id !== 'generic') h.push('<h2>' + esc('راهنمای انتخاب ' + sub) + '</h2>', li(fam.buy.slice(0, 4).map((x) => fill(x, sub))));
      if (how) h.push('<h2>' + esc('مراحل سفارش') + '</h2>', '<p>' + esc(clean2(how)) + '</p>'); else missing.push('مراحل سفارش');
      h.push('<h2>' + esc('سفارش و مشاوره') + '</h2>', '<p>' + esc(cta ? clean2(cta) : 'برای پرسش دربارهٔ ' + sub + ' یا ثبت سفارش، از بخش «تماس با ما» اقدام کنید.') + '</p>'); if (!cta) missing.push('دعوت به اقدام اختصاصی (تلفن/لینک سفارش)');
      meta_description = fit(sub + ' را با ویژگی‌ها، راهنمای انتخاب و پرسش‌های متداول در ' + noun + ' بررسی کنید و برای سفارش یا مشاوره با ما در ارتباط باشید.', 158);
      faq = (fam.id !== 'generic' ? fam.faq.slice(0, 3).map(([q, a]) => [fill(q, sub), fill(a, sub)]) : []).concat([['برای سفارش ' + sub + ' چه کنم؟', cta ? clean2(cta) : 'از بخش «تماس با ما» اقدام کنید.']]);
      faq.forEach(([q, a]) => h.push('<h3>' + esc(q) + '</h3>', '<p>' + esc(a) + '</p>'));
    } else {
      focus = 'پرسش‌های متداول ' + noun; seo_title = fit('پرسش‌های متداول خرید از ' + noun, 60);
      const pol = (re) => getFact(rows, re); const ship = pol(/ارسال|حمل/); const ret = pol(/مرجوع|بازگشت/); const pay = pol(/پرداخت/); const warr = pol(/گارانتی|ضمانت/);
      h.push('<p>' + esc('پاسخ رایج‌ترین پرسش‌ها دربارهٔ خرید از ' + noun + ' را اینجا می‌خوانید. اگر پاسخ خود را پیدا نکردید، از بخش «تماس با ما» بپرسید.') + '</p>');
      faq = [['چطور از ' + noun + ' سفارش بدهم؟', 'محصول را به سبد خرید اضافه کنید، اطلاعات ارسال را وارد کنید و مراحل پرداخت را تکمیل کنید.'], ['قیمت و موجودی کالا را از کجا ببینم؟', 'قیمت و موجودی روز در صفحهٔ هر محصول نمایش داده می‌شود و ممکن است تغییر کند.']];
      if (ship) faq.push(['روش و زمان ارسال چگونه است؟', ship.replace(/[.؟!]+$/, '') + '.']); else missing.push('شرایط ارسال');
      if (pay) faq.push(['روش‌های پرداخت چیست؟', pay.replace(/[.؟!]+$/, '') + '.']); else missing.push('روش‌های پرداخت');
      if (ret) faq.push(['شرایط مرجوعی چیست؟', ret.replace(/[.؟!]+$/, '') + '.']); else missing.push('شرایط مرجوعی');
      if (warr) faq.push(['گارانتی محصولات چگونه است؟', warr.replace(/[.؟!]+$/, '') + '.']); else missing.push('گارانتی (فقط اگر واقعاً وجود دارد)');
      faq.push(['اگر دربارهٔ مشخصات کالا سؤال داشتم چه کنم؟', 'پیش از ثبت سفارش، از راه‌های ارتباطی فروشگاه سؤال خود را بپرسید.']);
      faq.forEach(([q, a]) => h.push('<h2>' + esc(q) + '</h2>', '<p>' + esc(a) + '</p>'));
      meta_description = fit('پاسخ پرسش‌های رایج دربارهٔ سفارش، ارسال، پرداخت و پیگیری خرید از ' + noun + ' را در این صفحه بخوانید.', 158);
    }
    const content = h.join('\n'); const wordCount = plain(content).split(/\s+/).filter(Boolean).length;
    const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
    const checks = [['title_len', 'عنوان سئو ≤ ۶۰ نویسه', len(seo_title) <= 60], ['meta_len', 'متا ۷۰ تا ۱۶۰ نویسه', len(meta_description) >= 70 && len(meta_description) <= 160], ['claims', 'بدون ادعای تأییدنشده', !BANNED_RE.test(norm(content + ' ' + seo_title + ' ' + meta_description))], ['facts', 'مبتنی بر اطلاعات واقعی ثبت‌شده', kind === 'faq' || rows.length >= 1]].map(([id, label, ok]) => ({ id, label, ok }));
    return { ok: true, kind, label: PAGE_KINDS[kind], name: PAGE_KINDS[kind], fields: { title: PAGE_KINDS[kind], content, seo_title, meta_description, focus_keyword: focus }, faq, schemaJson: '<script type="application/ld+json">' + JSON.stringify(faqSchema).replace(/</g, '\\u003c') + '</script>', missing: uniq(missing), wordCount, score: { value: Math.round(100 * checks.filter((x) => x.ok).length / checks.length), checks } };
  }

  return { KINDS, PAGE_KINDS, build, buildMany, buildPage, score, toText, toCsv, markSimilarity, polishPrompt, applyPolish };
});
