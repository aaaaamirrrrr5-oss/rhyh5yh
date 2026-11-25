/* Site Inspector — seoplus.js (v1.81.0)  SI.SeoPlus
 * بررسی‌های سئوی تکمیلی صفحه که قبلاً در موتور نبود. Pure، بدون DOM و شبکه، UMD.
 *  arabic_chars       : «ي/ك/ى» عربی در صفحهٔ فارسی (جست‌وجوی «کتاب» و «كتاب» را از هم جدا می‌کند)
 *  arabic_digits      : ارقام عربی-هندی (٠-٩) در صفحهٔ فارسی (به‌جای ۰-۹)
 *  no_trust_pages     : در صفحهٔ اصلی لینک تماس / درباره ما / حریم خصوصی نیست (اعتماد و E-E-A-T)
 *  schema_duplicate   : یک نوع اسکیما چندبار تعریف شده (معمولاً قالب + افزونهٔ سئو هر دو خروجی می‌دهند)
 *  img_bad_filename   : نام فایل تصاویر بی‌معنی است (IMG_1234، DSC_…، فقط عدد)
 *  title_h1_unrelated : عنوان و H1 هیچ واژهٔ مشترکی ندارند
 *  no_preconnect      : چند منبع شخص‌ثالث بدون preconnect/dns-prefetch
 *  font_display       : @font-face / Google Fonts بدون font-display (متن تا بارگذاری فونت دیده نمی‌شود)
 * فقط از آنچه واقعاً در HTML هست حکم می‌دهد و ادعای رتبه نمی‌کند. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.SI = root.SI || {}).SeoPlus = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const FA = '۰۱۲۳۴۵۶۷۸۹';
  const fa = (n) => String(n).replace(/\d/g, (d) => FA[d]);
  const arr = (x) => (x == null ? [] : [].concat(x));
  const count = (s, re) => (String(s || '').match(re) || []).length;
  const AR_LET = /[\u064A\u0643\u0649]/g;            // ي ك ى
  const FA_ONLY = /[\u067E\u0686\u0698\u06AF\u06A9\u06CC]/g; // پ چ ژ گ ک ی
  const AR_DIG = /[\u0660-\u0669]/g;
  const hostN = (h) => String(h || '').replace(/^www\./i, '').toLowerCase();

  /* ---- زبان فارسی (نه عربی): lang=fa یا حروف مخصوص فارسی ---- */
  function isPersianPage(c) { return !!c.rtlText && (/^fa\b/i.test(c.lang || '') || count(c.allText, FA_ONLY) >= 3 || count(c.title, FA_ONLY) >= 1); }

  function arabicChars(c, out) {
    if (!isPersianPage(c)) return;
    const seg = [['عنوان', c.title], ['توضیح متا', c.desc], ['H1', arr(c.h1).slice(0, 2).join(' ')]];
    const hit = seg.map(([n, s]) => [n, count(s, AR_LET)]).filter(([, k]) => k > 0);
    const body = count(c.allText, AR_LET); const letters = count(c.allText, /[\u0600-\u06FF]/g) || 1;
    if (hit.length) out.push({ code: 'arabic_chars', severity: 'medium', title: 'حروف عربی «ي/ك» در متن فارسی', detail: hit.map(([n, k]) => n + ' (' + fa(k) + ')').join('، ') + (body > 1 ? ' و حدود ' + fa(body) + ' مورد در متن' : '') + ' نویسهٔ عربی دارد؛ جست‌وجوی «کتاب» و «كتاب» برای موتورها و جست‌وجوی سایت یکسان نیست. «ي» را «ی» و «ك» را «ک» بنویسید (ابزار املا و پولیش اپ این کار را انجام می‌دهد).' });
    else if (body >= 5 && body / letters >= 0.003) out.push({ code: 'arabic_chars', severity: 'low', title: 'حروف عربی «ي/ك» در متن فارسی', detail: 'حدود ' + fa(body) + ' نویسهٔ عربی (ي/ك/ى) در متن هست؛ برای یکدستی جست‌وجو آن‌ها را به «ی/ک» تبدیل کنید (نقل‌قول عربی عمدی را نگه دارید).' });
  }
  function arabicDigits(c, out) {
    if (!isPersianPage(c)) return;
    const head = count(c.title, AR_DIG) + count(c.desc, AR_DIG) + count(arr(c.h1).join(' '), AR_DIG); const body = count(c.allText, AR_DIG);
    if (head > 0 || body >= 3) out.push({ code: 'arabic_digits', severity: 'low', title: 'ارقام عربی-هندی در صفحهٔ فارسی', detail: fa(head + body) + ' رقم از نوع ٠-٩ (عربی) پیدا شد؛ در فارسی از ۰-۹ یا ارقام لاتین استفاده کنید تا جست‌وجوی عددی و نمایش یکدست بماند.' });
  }
  function trustPages(c, out) {
    if (!c.isHome || c.jsRendered || !(Number(c.anchorCount) >= 5)) return;
    const t = c.trust || {}; const miss = []; if (!t.contact) miss.push('تماس با ما'); if (!t.about) miss.push('درباره ما'); if (!t.privacy) miss.push('حریم خصوصی/قوانین');
    if (miss.length) out.push({ code: 'no_trust_pages', severity: t.contact ? 'low' : 'medium', title: 'لینک صفحات اعتماد در صفحهٔ اصلی نیست', detail: 'در منو یا فوتر لینکی به این صفحه‌ها دیده نشد: ' + miss.join('، ') + '. شفافیت دربارهٔ «چه کسی و چگونه تماس بگیرم» از نشانه‌های اعتماد (E-E-A-T) و برای فروشگاه‌ها لازم است.' });
  }
  /* ---- اسکیما: گره‌های سطح بالا (ریشه یا @graph) را می‌شمارد، نه گره‌های تو در تو (publisher داخل Article) ---- */
  function topNodes(blocks) {
    const nodes = [];
    arr(blocks).forEach((b) => {
      const body = String(b).replace(/^<script\b[^>]*>/i, '').replace(/<\/script>\s*$/i, '').replace(/^\uFEFF/, '').replace(/<!\[CDATA\[|\]\]>/g, '').trim(); let j; try { j = JSON.parse(body); } catch (e) { return; }
      const take = (n) => { if (Array.isArray(n)) return n.forEach(take); if (!n || typeof n !== 'object') return; if (n['@graph']) return take(n['@graph']); if (n['@type']) nodes.push(n); };
      take(j);
    });
    return nodes;
  }
  const FAMILY = { Organization: 'Organization', WebSite: 'WebSite', BreadcrumbList: 'BreadcrumbList', Product: 'Product', Article: 'Article', BlogPosting: 'Article', NewsArticle: 'Article' };
  const FAM_FA = { Organization: 'Organization (سازمان)', WebSite: 'WebSite', BreadcrumbList: 'BreadcrumbList (مسیر راهنما)', Product: 'Product', Article: 'Article/BlogPosting' };
  function schemaDuplicate(c, out) {
    const nodes = topNodes(c.ldBlocks); if (nodes.length < 2) return;
    const groups = {};
    nodes.forEach((n) => { const fams = Array.from(new Set(arr(n['@type']).map((t) => FAMILY[String(t).replace(/^.*[\/#]/, '')]).filter(Boolean))); fams.forEach((f) => { (groups[f] = groups[f] || []).push(n); }); });
    const dups = [];
    Object.keys(groups).forEach((f) => {
      const seen = new Set(); const uniq = groups[f].filter((n) => { const id = n['@id'] ? String(n['@id']) : null; if (id) { if (seen.has(id)) return false; seen.add(id); } return true; });
      if (uniq.length < 2) return;
      if (f === 'Product' || f === 'Article') { const key = (n) => String(n.name || n.headline || '').trim().toLowerCase(); const by = {}; uniq.forEach((n) => { const k = key(n); if (k) by[k] = (by[k] || 0) + 1; }); if (!Object.values(by).some((v) => v >= 2)) return; } // چند محصول/مقالهٔ متفاوت لزوماً تکرار نیست
      dups.push([f, uniq.length]);
    });
    if (dups.length) out.push({ code: 'schema_duplicate', severity: dups.some(([f]) => f === 'Product' || f === 'Article' || f === 'Organization') ? 'medium' : 'low', title: 'اسکیمای تکراری در یک صفحه', detail: dups.map(([f, n]) => FAM_FA[f] + ' ' + fa(n) + ' بار').join('، ') + ' تعریف شده؛ معمولاً قالب و افزونهٔ سئو هر دو اسکیما می‌سازند و دادهٔ متناقض به گوگل می‌رسد. یکی از منبع‌ها را خاموش کنید.' });
  }
  const BAD_FILE = /^(?:img|image|dsc|dscn|dscf|pxl|photo|pic|picture|screenshot|screen[ _-]?shot|whatsapp[ _-]?image|wp[_-]?\d*|untitled|unnamed|download|capture|scan|\d{8}[_-]\d{6})[ _-]?[\d()._-]*$/i;
  function fileBase(src) { try { const p = decodeURIComponent(String(src).split(/[?#]/)[0]).split('/').pop() || ''; return p.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/-\d{2,4}x\d{2,4}$/, ''); } catch (e) { return ''; } }
  function imgFilenames(c, out) {
    const rows = arr(c.imgs).map((o) => o && (o.src || o['data-src'] || o['data-lazy-src'] || '')).filter((s) => s && !/^data:/i.test(s) && !/(logo|icon|avatar|sprite|favicon|placeholder|spacer|blank|loading)/i.test(s));
    if (rows.length < 2) return;
    const bad = rows.filter((s) => { const f = fileBase(s); return !!f && (BAD_FILE.test(f) || /^\d{5,}$/.test(f) || /^[0-9a-f]{16,}$/i.test(f)); });
    if (bad.length >= 2 && bad.length / rows.length >= 0.5) out.push({ code: 'img_bad_filename', severity: 'low', title: 'نام فایل تصاویر بی‌معنی است', detail: fa(bad.length) + ' از ' + fa(rows.length) + ' تصویر نامی مثل «' + fileBase(bad[0]) + '» دارند؛ نام توصیفی (مثلاً french-press-glass.webp) به جست‌وجوی تصویر کمک می‌کند. در رسانهٔ وردپرس نام را پیش از بارگذاری اصلاح کنید.' });
  }
  const TSTOP = new Set(['خرید', 'قیمت', 'مشخصات', 'و', 'در', 'به', 'از', 'برای', 'با', 'این', 'آن', 'یک', 'the', 'and', 'for', 'with', 'buy', 'price']);
  const stem = (w) => { let s = w; for (const suf of ['های', 'ها', 'ان', 'ات', 'ی']) { if (s.length > 4 && s.endsWith(suf)) { s = s.slice(0, -suf.length); break; } } return s; };
  const toks = (s) => String(s || '').toLowerCase().replace(/[\u200c\u200f]/g, '').split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !TSTOP.has(w)).map(stem);
  function titleH1(c, out) {
    if (c.isHome) return; const h1 = arr(c.h1)[0]; if (!c.title || !h1) return; const A = toks(c.title), B = toks(h1); if (A.length < 2 || B.length < 2) return;
    const rel = A.some((a) => B.some((b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)))));
    if (!rel) out.push({ code: 'title_h1_unrelated', severity: 'low', title: 'عنوان صفحه و H1 هیچ واژهٔ مشترکی ندارند', detail: 'عنوان: «' + String(c.title).slice(0, 60) + '» / H1: «' + String(h1).slice(0, 60) + '»؛ دو سیگنال اصلی موضوع صفحه باید با هم هم‌خوان باشند، وگرنه گوگل ممکن است عنوان را در نتایج بازنویسی کند.' });
  }
  function resourceHints(c, out) {
    const host = hostN(c.host); const html = String(c.bodyHtml || '') + ' ' + String(c.headPart || ''); const origins = new Set();
    (html.match(/<script\b[^>]*\bsrc\s*=\s*["'][^"']+["']/gi) || []).concat(html.match(/<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*>/gi) || []).forEach((tag) => { const m = tag.match(/(?:src|href)\s*=\s*["'](https?:)?\/\/([^\/"']+)/i); if (m && hostN(m[2]) !== host) origins.add(hostN(m[2])); });
    const hints = arr(c.linkList).some((o) => /(^|\s)(preconnect|dns-prefetch)(\s|$)/i.test((o && o.rel) || ''));
    if (origins.size >= 3 && !hints) out.push({ code: 'no_preconnect', severity: 'low', title: 'چند منبع بیرونی بدون preconnect', detail: fa(origins.size) + ' دامنهٔ بیرونی برای اسکریپت/استایل بارگذاری می‌شود (' + Array.from(origins).slice(0, 3).join('، ') + ') ولی preconnect یا dns-prefetch تعریف نشده؛ اتصال اولیه به آن‌ها صفحه را کند می‌کند.' });
    const styles = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []).join(' '); const faces = styles.match(/@font-face\s*\{[^}]*\}/gi) || []; const noDisp = faces.filter((f) => !/font-display\s*:/i.test(f)).length;
    const gf = (html.match(/<link\b[^>]*href\s*=\s*["'][^"']*fonts\.googleapis\.com[^"']*["']/gi) || []).filter((l) => !/display=/i.test(l)).length;
    if (noDisp + gf > 0) out.push({ code: 'font_display', severity: 'low', title: 'فونت بدون font-display', detail: fa(noDisp + gf) + ' تعریف فونت بدون font-display است؛ تا فونت نیامده متن نامرئی می‌ماند (FOIT) و LCP بدتر می‌شود. font-display: swap بگذارید.' });
  }
  /**
   * @param {{title:string, desc:?string, h1:string[], allText:string, isHome:boolean, rtlText:boolean, lang:string, trust:Object, anchorCount:number, jsRendered:boolean, ldBlocks:string[], imgs:Object[], linkList:Object[], bodyHtml:string, headPart:string, host:string}} c
   */
  function check(c) {
    c = c || {}; const out = [];
    [arabicChars, arabicDigits, trustPages, schemaDuplicate, imgFilenames, titleH1, resourceHints].forEach((f) => { try { f(c, out); } catch (e) { /* یک بررسی خراب نباید بقیه را از کار بیندازد */ } });
    return out;
  }
  return { check, topNodes, isPersianPage, CODES: ['arabic_chars', 'arabic_digits', 'no_trust_pages', 'schema_duplicate', 'img_bad_filename', 'title_h1_unrelated', 'no_preconnect', 'font_display'] };
});
