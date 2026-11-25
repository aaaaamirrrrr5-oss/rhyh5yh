/* Site Inspector — seoextra.js (v1.44.0)
 * Extra SEO fields beyond Repair.ALLOWED: image alt (featured/gallery), Open Graph, slug, JSON-LD (Product/Breadcrumb/FAQ), product category/tag SEO.
 * Built ONLY from real product data (title, sku, price, attributes, categories). Nothing is invented; missing data → skipped with a reason.
 * These fields need Bridge support (see BRIDGE-EXTRA-fa.md): output is a plan the owner approves; nothing here writes by itself. UMD. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./polish.js'));
  else root.SI = root.SI || {}, root.SI.SeoExtra = factory(root.SI && root.SI.Polish);
})(typeof self !== 'undefined' ? self : this, function (Polish) {
  'use strict';
  const len = (s) => Array.from(String(s == null ? '' : s)).length;
  const plain = (v) => String(v == null ? '' : v).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const norm = (v) => plain(v).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\u200f]/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  const names = (arr) => (Array.isArray(arr) ? arr : []).map((x) => (x && typeof x === 'object' ? x.name || x.label : x)).map(plain).filter((x) => x && x.length < 60);
  const STOP = new Set(['و', 'یا', 'از', 'به', 'در', 'با', 'برای', 'که', 'را', 'این', 'آن', 'تا', 'بر', 'the', 'and', 'for', 'of', 'a', 'to', 'in']);

  /* ---------- image alt ---------- */
  function imagesOf(item) {
    const p = (item && item.product) || {}; const out = [];
    const add = (im, role) => { if (!im) return; const o = typeof im === 'string' ? { url: im } : im; const url = o.url || o.src || ''; const id = o.id != null ? o.id : o.image_id; if (!url && id == null) return; out.push({ id, url, alt: plain(o.alt || o.alt_text || ''), role }); };
    add(item.featured_image || p.featured_image || (item.image_url ? { url: item.image_url, id: item.featured_image_id } : null), 'featured');
    (Array.isArray(p.images) ? p.images : Array.isArray(item.images) ? item.images : []).forEach((im, i) => add(im, i === 0 && !out.length ? 'featured' : 'gallery'));
    const seen = new Set(); return out.filter((x) => { const k = String(x.id != null ? x.id : x.url); if (seen.has(k)) return false; seen.add(k); return true; });
  }
  /** alt = product name (+ "نمای N" for gallery images). Only EMPTY alts are filled (auto); existing alts untouched. */
  function planAlt(item) {
    const title = plain(item && item.title); if (!title) return { items: [], skipped: ['نام محصول خالی است.'] };
    let n = 1; const items = [];
    imagesOf(item).forEach((im) => { const gallery = im.role !== 'featured'; if (gallery) n++; if (im.alt) return; items.push({ image_id: im.id, url: im.url, current: '', proposed: gallery ? title + ' – نمای ' + n : title, tier: 'auto' }); });
    return { items, skipped: [] };
  }

  /* ---------- Open Graph ---------- */
  function planOg(item) {
    const t = plain(item.seo_title || item.metaTitle || item.title), d = plain(item.meta_description || item.metaDescription || item.excerpt);
    const f = {}; const have = (k) => plain(item[k] || (item.og && item.og[k.replace('og_', '')]) || '');
    if (!have('og_title') && len(t) >= 15) f.og_title = len(t) > 70 ? Array.from(t).slice(0, 67).join('').replace(/\s+\S*$/, '') + '…' : t;
    if (!have('og_description') && len(d) >= 50) f.og_description = len(d) > 200 ? Array.from(d).slice(0, 197).join('').replace(/\s+\S*$/, '') + '…' : d;
    return { fields: f, tiers: { og_title: 'auto', og_description: 'auto' } };
  }

  /* ---------- slug ---------- */
  function slugOf(url) { try { const parts = new URL(url).pathname.split('/').filter(Boolean); return decodeURIComponent(parts[parts.length - 1] || ''); } catch (e) { return String(url || '').split('/').filter(Boolean).pop() || ''; } }
  function diagnoseSlug(item) {
    const s = slugOf(item && item.url); const out = []; if (!s) return out;
    const words = s.split(/[-_]+/).filter(Boolean);
    if (len(s) > 75 || words.length > 9) out.push({ code: 'slug_long', label: 'اسلاگ بیش از حد طولانی است' });
    if (/-\d+$/.test(s) && !/\d{3,}$/.test(s)) out.push({ code: 'slug_suffix', label: 'اسلاگ با شمارهٔ تکراری (مثل -۲) تمام می‌شود' });
    if (/[A-Z]/.test(s)) out.push({ code: 'slug_upper', label: 'اسلاگ حروف بزرگ دارد' });
    if (words.length > 3 && words.filter((w) => STOP.has(w.toLowerCase())).length >= 3) out.push({ code: 'slug_stop', label: 'اسلاگ پر از حروف اضافه است' });
    if (/%[0-9a-f]{2}/i.test(s)) out.push({ code: 'slug_encoded', label: 'اسلاگ کدشده است' });
    return out;
  }
  /** Proposes a shorter slug from the focus keyword/title. ALWAYS needs a 301 redirect from the old URL → tier "review", never automatic. */
  function proposeSlug(item) {
    const issues = diagnoseSlug(item); if (!issues.length) return null;
    const base = plain(item.focus_keyword || item.focusKeyword || item.title); const w = base.replace(/[^\p{L}\p{N}\s\-‌]/gu, ' ').split(/[\s‌_\-]+/).filter((x) => x && !STOP.has(x.toLowerCase())).slice(0, 5);
    if (w.length < 1) return null; const slug = w.join('-').toLowerCase(); if (slug === slugOf(item.url).toLowerCase() || len(slug) < 3) return null;
    return { current: slugOf(item.url), proposed: slug, issues, needs_redirect: true, tier: 'review', why: 'پس از تغییر، تغییرمسیر ۳۰۱ از آدرس قدیمی الزامی است.' };
  }

  /* ---------- JSON-LD ---------- */
  function buildSchema(item, o) {
    const opt = o || {}; const p = (item && item.product) || {}; const skipped = []; const name = plain(item.title);
    if (!name) return { ok: false, skipped: ['نام محصول خالی است.'] };
    const doc = { '@context': 'https://schema.org', '@type': (item.type || 'product') === 'product' ? 'Product' : 'Article', name };
    const desc = plain(item.meta_description || item.metaDescription || item.excerpt || ''); if (len(desc) >= 40) doc.description = desc;
    if ((item.type || 'product') === 'product') {
      if (item.url) doc.url = item.url; if (p.sku) doc.sku = String(p.sku);
      const im = imagesOf(item).map((x) => x.url).filter(Boolean); if (im.length) doc.image = im.slice(0, 6);
      const price = Number(String(p.price != null ? p.price : '').replace(/[^\d.]/g, '')); const cur = p.currency || opt.currency || '';
      if (price > 0 && cur) { doc.offers = { '@type': 'Offer', price: String(price), priceCurrency: String(cur).toUpperCase(), availability: 'https://schema.org/' + ({ instock: 'InStock', outofstock: 'OutOfStock', onbackorder: 'BackOrder' }[String(p.stock_status || '').toLowerCase()] || 'InStock') }; if (!p.stock_status) skipped.push('وضعیت موجودی ثبت نشده؛ «موجود» فرض نشد و availability فقط پیش‌فرض ساده است.'); }
      else skipped.push('قیمت یا واحد پولی ثبت نشده؛ offers ساخته نشد (بدون آن Product schema برای Google کامل نیست).');
      const brand = plain(p.brand || opt.brand || ''); if (brand) doc.brand = { '@type': 'Brand', name: brand };
      if (!doc.offers) return { ok: false, jsonld: null, skipped };
    } else { if (item.date) doc.datePublished = item.date; if (item.modified) doc.dateModified = item.modified; }
    const out = { ok: true, jsonld: doc, skipped, tier: 'review' };
    const cats = names(item.categories || p.categories);
    if (cats.length && item.url) { try { const u = new URL(item.url); out.breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'خانه', item: u.origin + '/' }, { '@type': 'ListItem', position: 2, name: cats[0] }, { '@type': 'ListItem', position: 3, name }] }; } catch (e) {} }
    if (Polish && Polish.faqPairs) { const q = Polish.faqPairs(item).slice(0, 5); if (q.length >= 2) out.faq = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: q.map((x) => ({ '@type': 'Question', name: x[0], acceptedAnswer: { '@type': 'Answer', text: x[1] } })) }; }
    return out;
  }

  /* ---------- category / tag SEO ---------- */
  /** term: { id, name, description, seo_title, meta_description, count }; products: products of this term (titles only are used). */
  function planTerm(term, products, o) {
    const opt = o || {}; const name = plain(term && term.name); const skipped = []; const fields = {}, tiers = {};
    if (!name) return { fields, tiers, skipped: ['نام دسته خالی است.'] };
    const desc = plain(term.description); const list = (products || []).map((x) => plain(x.title)).filter(Boolean);
    if (!plain(term.seo_title)) { const base = name; const t = opt.brand && len(base + ' | ' + opt.brand) <= 60 ? base + ' | ' + opt.brand : base; if (len(t) >= 20) { fields.seo_title = t; tiers.seo_title = 'auto'; } else skipped.push('نام دسته کوتاه‌تر از ۲۰ نویسه است؛ نام کامل‌تری لازم است.'); }
    if (!plain(term.meta_description)) {
      let m = '';
      if (len(desc) >= 70) { const sent = desc.split(/(?<=[.!؟?])\s+/); m = sent[0]; for (let i = 1; i < sent.length && len(m + ' ' + sent[i]) <= 155; i++) m += ' ' + sent[i]; if (len(m) > 160) m = Array.from(m).slice(0, 155).join('').replace(/\s+\S*$/, '') + '…'; }
      else if (list.length >= 3 && Number(term.count || list.length) >= 3) { const Pq = (typeof module === 'object' && module.exports && typeof require === 'function') ? require('./seopolicy.js') : (typeof globalThis !== 'undefined' && globalThis.SI && globalThis.SI.SeoPolicy); for (const k of [3, 2, 1]) { const c = 'مشاهده و خرید ' + name + ' شامل ' + list.slice(0, k).join('، ') + ' و موارد دیگر.'; m = c; if (!Pq || (len(c) >= 70 && !Pq.lintField('meta', c, { evidence: name + ' ' + list.join(' ') }).length)) break; } }
      if (len(m) >= 70) { fields.meta_description = m; tiers.meta_description = 'auto'; } else skipped.push('داده‌ٔ واقعی کافی (توضیح دسته یا ۳ محصول) برای متای دسته نیست.');
    }
    // v1.77: عنوان/متای دسته هم با همان اصول گوگل سنجیده می‌شود (بریده‌شدن، کلیدواژه‌چینی، ادعای بی‌پشتوانه).
    try {
      const P = (typeof module === 'object' && module.exports && typeof require === 'function') ? require('./seopolicy.js') : (typeof globalThis !== 'undefined' && globalThis.SI && globalThis.SI.SeoPolicy);
      if (P) {
        const ev = name + ' ' + desc + ' ' + list.join(' ');
        if (fields.seo_title && (!P.checkTitle(fields.seo_title).ok || P.lintField('title', fields.seo_title, { evidence: ev }).length)) { delete fields.seo_title; delete tiers.seo_title; skipped.push('عنوان پیشنهادی دسته با اصول گوگل نمی‌خواند؛ مقدار فعلی حفظ شد.'); }
        if (fields.meta_description && (!P.checkMeta(fields.meta_description).ok || P.lintField('meta', fields.meta_description, { evidence: ev }).length)) { delete fields.meta_description; delete tiers.meta_description; skipped.push('متای پیشنهادی دسته با اصول گوگل نمی‌خواند؛ مقدار فعلی حفظ شد.'); }
      }
    } catch (e) { /* policy is optional here */ }
    return { fields, tiers, skipped };
  }

  /** Everything extra for one item, as a plan (never written here). */
  function plan(item, o) {
    const alt = planAlt(item), og = planOg(item), slug = proposeSlug(item), schema = buildSchema(item, o);
    return { id: item.id, url: item.url || '', requires: 'bridge_extra_fields', alt: alt.items, og: og.fields, slug, schema: schema.ok ? { product: schema.jsonld, breadcrumb: schema.breadcrumb || null, faq: schema.faq || null, tier: 'review' } : null, skipped: [].concat(alt.skipped, schema.skipped || []), count: alt.items.length + Object.keys(og.fields).length + (slug ? 1 : 0) + (schema.ok ? 1 : 0) };
  }
  return { imagesOf, planAlt, planOg, slugOf, diagnoseSlug, proposeSlug, buildSchema, planTerm, plan };
});
