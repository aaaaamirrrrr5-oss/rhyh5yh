/* Site Inspector — product readiness 0–100 (SI.Score100). Pure. Unknown data (e.g. no image info from the site) is left out of the total, never guessed. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else (root.SI = root.SI || {}).Score100 = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const plain = (v) => String(v == null ? '' : v).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const len = (v) => Array.from(String(v || '')).length; const nrm = (v) => plain(v).replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, ' ').toLowerCase();
  const arr = (v) => (Array.isArray(v) ? v : []);
  const Policy = (typeof module === 'object' && module.exports) ? require('./seopolicy.js') : ((typeof self !== 'undefined' ? self : this).SI || {}).SeoPolicy;
  function evaluate(item) {
    const it = item || {}; const p = it.product || {}; const html = String(it.content || it.contentPreview || ''); const text = plain(html); const words = text.split(/\s+/).filter(Boolean).length;
    const imgs = it.images || p.images || it.gallery; const hasImgInfo = Array.isArray(imgs); const focus = nrm(it.focusKeyword);
    const attrs = arr(p.attributes).length + (p.weight ? 1 : 0) + (p.dimensions ? 1 : 0) + (p.material ? 1 : 0);
    const C = [];
    const add = (id, label, pts, ok, fix, hint, known) => { if (known !== false) C.push({ id, label, pts, ok: !!ok, fix, hint: ok ? '' : hint }); };
    add('title', 'عنوان سئو (یکتا، بدون بریده‌شدن در نتایج)', 10, Policy.checkTitle(it.metaTitle).ok, 'auto', 'اصلاح خودکار عنوان سئو می‌سازد.');
    add('meta', 'توضیحات متا (۷۰ تا ۱۶۰ نویسه)', 10, Policy.checkMeta(it.metaDescription).ok, 'auto', 'اصلاح خودکار از متن خود محصول می‌سازد.');
    add('focus', 'عبارت کلیدی در عنوان و ابتدای متن', 10, !!focus && nrm(it.title + ' ' + it.metaTitle).includes(focus) && nrm(text.split(/\s+/).slice(0, 120).join(' ')).includes(focus), 'auto', 'عبارت کلیدی باید در عنوان و ۱۲۰ واژهٔ اول باشد.');
    add('length', 'متن حداقل ۱۵۰ واژه', 15, words >= 150, 'auto', 'متن کوتاه است؛ اگر اطلاعات محصول کافی باشد خودکار نوشته می‌شود.');
    add('headings', 'زیرتیتر (H2) در متن بلند', 5, words < 300 || /<h2\b/i.test(html), 'auto', 'زیرتیتر اضافه می‌شود.');
    add('excerpt', 'توضیح کوتاه', 5, len(it.excerpt || it.short_description) >= 30, 'auto', 'از اول متن ساخته می‌شود.');
    add('faq', 'پرسش‌های متداول', 5, /<h[2-4][^>]*>[^<]*(پرس|سوال|سؤال)/i.test(html) || /FAQPage/i.test(html), 'auto', 'فقط اگر مشخصات ثبت‌شده کافی باشد ساخته می‌شود.');
    add('links', 'حداقل ۲ پیوند داخلی', 7, (html.match(/<a\b[^>]*href/gi) || []).length >= 2, 'auto', 'پیوند داخلی هوشمند اضافه می‌شود.');
    add('facts', 'مشخصات (ویژگی/وزن/ابعاد)', 10, attrs >= 2, 'manual', 'در وردپرس ویژگی‌ها، وزن و ابعاد را وارد کن.', it.type === 'product' || !!it.product);
    add('brand', 'برند', 4, !!(it.brand || p.brand), 'manual', 'برند را در وردپرس ثبت کن.', it.type === 'product' || !!it.product);
    add('category', 'دسته‌بندی', 4, arr(it.categories || p.categories).length > 0, 'manual', 'یک دستهٔ دقیق انتخاب کن.');
    add('price', 'قیمت و SKU', 5, !!(p.price || it.price) && !!(p.sku || it.sku), 'manual', 'قیمت و SKU را کامل کن.', it.type === 'product' || !!it.product);
    add('images', 'حداقل ۳ تصویر', 8, hasImgInfo && imgs.length >= 3, 'manual', 'تصاویر بیشتر از زوایای مختلف بگذار.', hasImgInfo);
    add('alt', 'متن جایگزین (alt) همهٔ تصاویر', 5, hasImgInfo && imgs.length > 0 && imgs.every((x) => x && (x.alt || x.alt_text)), 'auto', 'alt از نام محصول ساخته می‌شود.', hasImgInfo);
    const total = C.reduce((s, c) => s + c.pts, 0) || 1; const got = C.reduce((s, c) => s + (c.ok ? c.pts : 0), 0);
    return { score: Math.round((got / total) * 100), checks: C, missingAuto: C.filter((c) => !c.ok && c.fix === 'auto'), missingManual: C.filter((c) => !c.ok && c.fix === 'manual') };
  }
  return { evaluate };
});
