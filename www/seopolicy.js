/* Site Inspector — seopolicy.js (v1.77.0)  SI.SeoPolicy
 * تنها مرجع «حدود و اصول» اصلاح سئو. پیش‌تر هر ماژول عدد خودش را داشت (۶۰ / ۶۵ / ۷۵ برای عنوان، ۱۶۰ / ۱۷۰ / ۲۰۰ برای متا)؛
 * حالا polish، repair، score100، onpage و seorules همه از اینجا می‌خوانند.
 *
 * اصول (هر کدام به قانون کتابخانهٔ seorules و منبع رسمی گوگل وصل است):
 *  o01  عنوان یکتا و توصیفی؛ بدون تکرار، بدون پر کردن با کلیدواژه.
 *  o02  گوگل برای عنوان «حد نویسه» ندارد؛ نمایش با عرض پیکسل بریده می‌شود (~۶۰۰px) و ممکن است عنوان را بازنویسی کند.
 *  o03  متا رتبه نمی‌دهد؛ خلاصهٔ دقیق و یکتا برای snippet است (~۱۲۰ تا ۱۶۰ نویسه) و گوگل ممکن است متن دیگری نشان دهد.
 *  o06  alt توصیفی و واقعی، نه تکرار کلمهٔ کلیدی.
 *  spam کلیدواژه‌چینی، ادعای بدون پشتوانه و عنوان/متای فریبنده ممنوع است.
 * Pure. هیچ‌چیز را اجرا یا تغییر نمی‌دهد. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else (root.SI = root.SI || {}).SeoPolicy = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const LIMITS = {
    title: { min: 20, target: 60, hard: 70, pxTarget: 580, pxMax: 600 }, // target = برای ساختن؛ pxMax = بالاتر از آن «بریده می‌شود»؛ hard = بالاتر از آن هرگز نوشته نمی‌شود
    meta: { min: 70, idealMin: 120, target: 155, max: 160, hard: 170 },
    focus: { maxChars: 120, maxWords: 6, warnDensity: 3, maxDensity: 4 },
  };
  const RULES = { title: ['o01', 'o02'], meta: ['o03'], alt: ['o06'], focus: ['o01'], h1: ['o04'], headings: ['o05'], excerpt: ['o03'], content: ['o05'] };
  const SOURCE = { o01: 'Google: Title links', o02: 'Google: Title links', o03: 'Google: Snippets & meta description', o04: 'Google: Search Essentials', o05: 'Google: Search Essentials', o06: 'Google: Image best practices', spam: 'Google: Spam policies', link: 'Google: Link best practices' };

  const len = (v) => Array.from(String(v == null ? '' : v)).length;
  /** عرض تقریبی نمایش (px، قلم ~۲۰px نتایج گوگل). گوگل عنوان را با پیکسل می‌برد، نه با تعداد نویسه. */
  function pixelWidth(text) {
    let w = 0; Array.from(String(text || '')).forEach((ch) => {
      if (/\s/.test(ch)) w += 5; else if (/[‌‏]/.test(ch)) w += 0; else if (/[A-Z]/.test(ch)) w += 12.5; else if (/[a-z]/.test(ch)) w += 10; else if (/[0-9۰-۹٠-٩]/.test(ch)) w += 11;
      else if (/[؀-ۿ]/.test(ch)) w += /[ً-ْ]/.test(ch) ? 0 : 9.5; else if (/[|\-–—:،.,!؟?؛]/.test(ch)) w += 6; else w += 11;
    }); return Math.round(w);
  }

  /** وضعیت عنوان: short | ok | long. «long» فقط وقتی است که واقعاً در نتایج بریده می‌شود (پیکسل)، نه به‌خاطر عدد نویسه. */
  function checkTitle(t) {
    const v = String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); const L = len(v), px = pixelWidth(v); const T = LIMITS.title;
    let status = 'ok', reason = '';
    if (!L) { status = 'missing'; reason = 'عنوان ندارد.'; }
    else if (L < T.min) { status = 'short'; reason = L + ' نویسه؛ برای توصیف موضوع کم است (حداقل ' + T.min + ').'; }
    else if (px > T.pxMax || L > T.hard) { status = 'long'; reason = L + ' نویسه / حدود ' + px + ' پیکسل؛ بیش از حدود ' + T.pxMax + ' پیکسل در نتایج بریده می‌شود.'; }
    return { status, ok: status === 'ok', len: L, px, reason, rules: RULES.title };
  }
  /** وضعیت متا: short | ok | long. بین ۷۰ تا ۱۲۰ مجاز ولی «کوتاه‌تر از ایده‌آل» است (idealShort). */
  function checkMeta(m) {
    const v = String(m == null ? '' : m).replace(/\s+/g, ' ').trim(); const L = len(v); const M = LIMITS.meta; let status = 'ok', reason = '';
    if (!L) { status = 'missing'; reason = 'متا ندارد.'; }
    else if (L < M.min) { status = 'short'; reason = L + ' نویسه؛ برای خلاصهٔ صفحه کم است (حداقل ' + M.min + ').'; }
    else if (L > M.max) { status = 'long'; reason = L + ' نویسه؛ بیش از حدود ' + M.max + ' نویسه در snippet بریده می‌شود.'; }
    return { status, ok: status === 'ok', len: L, idealShort: status === 'ok' && L < M.idealMin, reason, rules: RULES.meta };
  }
  /** برای «ساختن»: سخت‌گیرتر از تشخیص تا چیزی که می‌نویسیم خودش هیچ‌وقت مشکل‌دار نباشد. */
  const titleFits = (t) => { const c = checkTitle(t); return c.ok && c.len <= LIMITS.title.target && c.px <= LIMITS.title.pxMax; };
  const metaFits = (m) => { const c = checkMeta(m); return c.ok && c.len <= LIMITS.meta.max; };
  /** برای «پذیرش» متنی که منبع دیگری (مدل زبانی، موتور قدیمی) ساخته: کمی انعطاف تا سقف hard. */
  const titleAcceptable = (t) => { const c = checkTitle(t); return c.status !== 'short' && c.status !== 'missing' && c.len <= LIMITS.title.hard && c.px <= LIMITS.title.pxMax + 40; };
  const metaAcceptable = (m) => { const c = checkMeta(m); return c.status !== 'short' && c.status !== 'missing' && c.len <= LIMITS.meta.hard; };

  const norm = (s) => String(s || '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[‌‏]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const PROMO = /(بهترین|برترین|ارزان‌?ترین|تضمین(?:ی)?|۱۰۰٪|100%|رایگان|تخفیف ویژه|حراج|فقط امروز|پرفروش‌?ترین|شگفت‌?انگیز)/;
  const COMMON = new Set(['و', 'در', 'به', 'از', 'با', 'برای', 'یا', 'که', 'را', 'این', 'آن', 'the', 'and', 'for', 'with']);

  /**
   * کنترل اصول اسپم روی عنوان/متای «ساخته‌شده». [{code, detail, rule}] — خالی یعنی سالم.
   * ctx: { evidence: متنی که ادعاها باید از آن بیاید (عنوان+متن محصول) }.
   */
  function lintField(kind, value, ctx) {
    const v = String(value == null ? '' : value).trim(); const out = []; if (!v) return out; const c = ctx || {}; const n = norm(v);
    const words = n.split(/[\s|–—:،؛,.!؟?-]+/).filter((w) => w.length > 1 && !COMMON.has(w));
    const freq = {}; words.forEach((w) => { freq[w] = (freq[w] || 0) + 1; });
    const rep = Object.keys(freq).filter((w) => freq[w] >= 3);
    if (rep.length) out.push({ code: 'repeated_word', detail: '«' + rep[0] + '» ' + freq[rep[0]] + ' بار تکرار شده (کلیدواژه‌چینی).', rule: kind === 'title' ? 'o01' : 'o03' });
    if (kind === 'title' && (v.match(/[|–—]/g) || []).length > 2) out.push({ code: 'many_separators', detail: 'بیش از دو جداکننده در عنوان.', rule: 'o01' });
    if (/[!؟?]{2,}|[\u{1F300}-\u{1FAFF}☀-➿]/u.test(v)) out.push({ code: 'decorative', detail: 'علامت تکراری یا ایموجی در ' + (kind === 'title' ? 'عنوان' : 'متا') + '.', rule: kind === 'title' ? 'o01' : 'o03' });
    const ev = norm(c.evidence || '');
    const claim = (v.match(PROMO) || [])[0];
    if (claim && !ev.includes(norm(claim))) out.push({ code: 'unsupported_claim', detail: '«' + claim + '» در اطلاعات واقعی محصول/صفحه نیست.', rule: 'spam' });
    return out;
  }

  /** چگالی عبارت کلیدی (٪ = دفعات عبارت ÷ کل واژه‌ها). گوگل عدد رسمی ندارد؛ بالاتر از ~۳٪ در عمل کلیدواژه‌چینی است. */
  function keywordDensity(text, keyword) {
    const t = norm(String(text || '').replace(/<[^>]+>/g, ' ')); const k = norm(keyword); if (!k) return 0;
    const total = t.split(' ').filter(Boolean).length; if (!total) return 0; let c = 0, p = 0; while ((p = t.indexOf(k, p)) !== -1) { if (p === 0 || !/[\u0600-\u06ffa-z0-9]/.test(t[p - 1])) c++; p += k.length; }
    return Math.round((c / total) * 1000) / 10; /* تعداد دفعات عبارت ÷ کل واژه‌ها (همان روش رایج Yoast/RankMath) */
  }


  /* ---------- Google content gate: هر متنی که اپ می‌نویسد از این عبور می‌کند ---------- */
  const strip = (h) => String(h || '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const GENERIC_ANCHOR = /^(اینجا|این‌?جا|کلیک(?: کنید)?|کلیک اینجا|بیشتر|ادامه|ادامه مطلب|بیشتر بخوانید|مشاهده|لینک|click here|here|read more|more|link)$/i;
  const FAKE_SOCIAL = /(هزاران|صدها|میلیون‌?ها)\s+(مشتری|کاربر|نفر)|رضایت\s*[۱۰0]{2,3}\s*(درصد|٪|%)|(?:امتیاز|ستاره)\s*[۴۵4-5](?:[.٫]\d)?\s*از\s*[۵5]|پرفروش‌?ترین|محبوب‌?ترین|اورجینال\s*تضمین/;
  /**
   * بررسی متن تولیدشده با اصول Google (Search Essentials، spam policies، helpful content، link best practices).
   * blockers = نباید نوشته شود؛ warnings = نوشته می‌شود ولی به کاربر گفته می‌شود.
   * ctx: { focus, evidence (متن/مشخصات واقعی), kind: 'product'|'article'|'term', title }
   */
  function auditContent(html, ctx) {
    const c = ctx || {}; const h = String(html || ''); const text = strip(h); const words = text.split(/\s+/).filter(Boolean); const wc = words.length;
    const blockers = [], warnings = []; const B = (code, detail, rule) => blockers.push({ code, detail, rule: rule || 'o05' }); const W = (code, detail, rule) => warnings.push({ code, detail, rule: rule || 'o05' });
    // 1) spam: keyword stuffing + تکرار جمله
    if (c.focus) { const d = keywordDensity(text, c.focus); if (d > LIMITS.focus.maxDensity) B('keyword_stuffing', 'چگالی «' + c.focus + '» ' + d + '٪ است (بیش از ' + LIMITS.focus.maxDensity + '٪)؛ این کلیدواژه‌چینی است.', 'spam'); else if (d > LIMITS.focus.warnDensity) W('keyword_dense', 'چگالی «' + c.focus + '» ' + d + '٪ است؛ بهتر است زیر ' + LIMITS.focus.warnDensity + '٪ بماند.', 'spam'); }
    const sentences = text.split(/[.!؟?؛]\s*/).map((x) => norm(x)).filter((x) => x.split(' ').length >= 4); const seen = {}; let dup = 0; sentences.forEach((x) => { if (seen[x]) dup++; seen[x] = 1; });
    if (dup >= 2) B('repeated_sentences', dup + ' جملهٔ عیناً تکراری در یک متن (محتوای پرکننده).', 'spam');
    // 2) ادعا و اعتبارسازی جعلی
    const ev = norm(c.evidence || ''); const claims = [];
    (text.match(new RegExp(PROMO.source, 'g')) || []).forEach((m) => { if (!ev.includes(norm(m)) && !claims.includes(m)) claims.push(m); });
    if (claims.length) B('unsupported_claim', 'ادعای بدون پشتوانه در اطلاعات واقعی: «' + claims.slice(0, 3).join('، ') + '».', 'spam');
    const fs = text.match(FAKE_SOCIAL); if (fs && !ev.includes(norm(fs[0]))) B('fake_social_proof', '«' + fs[0] + '» اثبات اجتماعی است و در داده‌های واقعی نیست.', 'spam');
    // 3) ساختار
    if (/<h1[\s>]/i.test(h)) B('h1_in_body', 'H1 داخل متن؛ عنوان صفحه خودش H1 است و دو H1 ساختار را مبهم می‌کند.', 'o04');
    const lv = (h.match(/<h([1-6])[\s>]/gi) || []).map((x) => Number(x[2])); for (let i = 1; i < lv.length; i++) if (lv[i] > lv[i - 1] + 1) { W('heading_skip', 'پرش در سلسله‌مراتب تیترها (H' + lv[i - 1] + ' ← H' + lv[i] + ').', 'o05'); break; }
    if (wc > 300 && !/<h[2-3][\s>]/i.test(h)) W('no_subheadings', 'متن بلند بدون زیرتیتر؛ خواندن و اسکن سخت است.', 'o05');
    const longP = (h.match(/<p[\s>][\s\S]*?<\/p>/gi) || []).filter((p) => strip(p).split(/\s+/).length > 130).length; if (longP) W('long_paragraph', longP + ' پاراگراف بیش از ۱۳۰ واژه.', 'o05');
    // 4) عمق و موضوع
    const min = c.kind === 'article' ? 400 : c.kind === 'term' ? 80 : 120; if (wc < min) W('thin', wc + ' واژه؛ برای این نوع صفحه کم است (حداقل ~' + min + ').', 'o05');
    const tk = norm(c.title || '').split(' ').filter((w) => w.length > 2); if (tk.length && wc > 40 && !tk.some((w) => norm(words.slice(0, 100).join(' ')).includes(w))) W('off_topic_intro', 'در ۱۰۰ واژهٔ اول به موضوع صفحه اشاره نشده.', 'o05');
    // 5) لینک و تصویر
    const anchors = []; h.replace(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (m, href, inner) => { anchors.push({ href, text: strip(inner), tag: m }); return m; });
    const bad = anchors.filter((a) => GENERIC_ANCHOR.test(a.text) || /^https?:\/\//i.test(a.text)); if (bad.length) W('generic_anchor', bad.length + ' لینک با متن نامعنادار («' + (bad[0].text || bad[0].href).slice(0, 30) + '»)؛ متن لینک باید مقصد را توصیف کند.', 'link');
    const ext = anchors.filter((a) => /^https?:\/\//i.test(a.href) && /rel\s*=\s*["'][^"']*(sponsored|nofollow|ugc)/i.test(a.tag) === false && /(affiliate|aff=|ref=|utm_)/i.test(a.href)); if (ext.length) W('paid_link_rel', 'لینک پیگیری/همکاری بدون rel="sponsored".', 'link');
    if (anchors.length > 100) W('too_many_links', anchors.length + ' لینک در یک متن.', 'link');
    const noAlt = (h.match(/<img\b[^>]*>/gi) || []).filter((t) => !/\balt\s*=\s*["'][^"']+["']/i.test(t) && !/role\s*=\s*["']presentation/i.test(t)).length; if (noAlt) W('img_no_alt', noAlt + ' تصویر بدون alt.', 'o06');
    return { ok: !blockers.length, blockers, warnings, stats: { words: wc, links: anchors.length, density: c.focus ? keywordDensity(text, c.focus) : 0 } };
  }

  /** برچسب «چرا» برای کارت تغییر: فیلد → [{rule, source}] */
  function whyFor(field) { return (RULES[field === 'seo_title' ? 'title' : field === 'meta_description' ? 'meta' : field === 'focus_keyword' ? 'focus' : field] || []).map((r) => ({ rule: r, source: SOURCE[r] || '' })); }

  return { LIMITS, RULES, SOURCE, pixelWidth, checkTitle, checkMeta, titleFits, metaFits, titleAcceptable, metaAcceptable, lintField, keywordDensity, auditContent, whyFor };
});
