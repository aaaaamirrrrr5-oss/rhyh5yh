/* Site Inspector Long-form Article Writer (SEO + GEO + AEO).

   Pipeline: plan (intent-based, per-article variation) -> write section by section with the on-device model
   -> gate every piece (length, repetition, similarity, invented numbers, language, boilerplate) with feedback retries
   -> assemble answer-first HTML (lead, key takeaways, H2 sections, conclusion, visible FAQ, real internal links)
   -> final audit. It never pads text to reach a number: if the minimum cannot be reached honestly,
   the result is marked "incomplete" and the app refuses to save it. */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./agent.js'));
  else root.SI = root.SI || {}, root.SI.Writer = factory(root.SI.Agent);
})(typeof self !== 'undefined' ? self : this, function (Agent) {
  'use strict';

  const HARD_MIN_WORDS = 800;
  const PLANS = {
    short: { id: 'short', label: 'کوتاه', minWords: 800, sections: 4, faq: 3, sectionWords: 170 },
    standard: { id: 'standard', label: 'استاندارد', minWords: 1200, sections: 6, faq: 4, sectionWords: 170 },
    pillar: { id: 'pillar', label: 'جامع (ستون محتوا)', minWords: 2000, sections: 9, faq: 6, sectionWords: 190 },
  };

  /* ---------- small utilities ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const latinDigits = (s) => String(s || '').replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632));
  const normText = (s) => String(s || '').toLowerCase().replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/\u200c/g, ' ').replace(/\s+/g, ' ').trim();
  const stripTags = (s) => Agent.plain(s);
  const tokens = (s) => normText(stripTags(s)).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const countWords = (s) => tokens(s).length;
  const sentences = (s) => String(s || '').split(/(?<=[.!؟?۔])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
  function hash32(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const pick = (arr, r) => arr[Math.floor(r() * arr.length)];
  const clipWords = (s, n) => String(s || '').trim().split(/\s+/).slice(0, n).join(' ');

  /* ---------- intent + outline templates (per-article variation through a seed) ---------- */
  function detectIntent(title) {
    const t = normText(title);
    if (/چگونه|چطور|آموزش|روش|مراحل|نحوه/.test(t)) return 'howto';
    if (/بهترین|مقایسه|تفاوت| در برابر | یا |برتر/.test(' ' + t + ' ')) return 'compare';
    if (/خرید|راهنمای انتخاب|قیمت|انتخاب/.test(t)) return 'buying';
    if (/چیست|معرفی|تعریف|مفهوم|کاربرد/.test(t)) return 'whatis';
    return 'general';
  }
  const S = (key, core, goal, variants) => ({ key, core, goal, variants });
  const INTENTS = {
    howto: [
      S('what', true, 'تعریف دقیق، دامنهٔ موضوع و اینکه برای چه کسی و چه زمانی کاربرد دارد', ['{k} چیست و چرا اهمیت دارد؟', 'اصل ماجرای {k} چیست؟', 'قبل از شروع {k} چه چیزی را باید بدانیم؟']),
      S('prereq', false, 'پیش‌نیازها و آمادگی‌های لازم؛ فقط مواردی که واقعاً لازم‌اند', ['پیش‌نیازها و آمادگی برای {k}', 'برای {k} چه چیزهایی لازم است؟']),
      S('steps', true, 'مراحل ترتیبی و روشن انجام کار؛ هر مرحله یک خط فهرست', ['مراحل گام‌به‌گام {k}', '{k} را چطور انجام دهیم؟', 'روش درست انجام {k} چگونه است؟']),
      S('mistakes', true, 'اشتباهات رایج و دلیل آن‌ها و راه جلوگیری', ['اشتباهات رایج در {k}', 'چه خطاهایی نتیجهٔ {k} را خراب می‌کند؟']),
      S('tips', false, 'نکات عملی برای نتیجهٔ بهتر، بدون تکرار مراحل', ['نکاتی برای نتیجهٔ بهتر در {k}', 'چطور {k} را مؤثرتر انجام دهیم؟']),
      S('limits', false, 'شرایطی که روش مناسب نیست یا محدودیت دارد', ['چه زمانی {k} مناسب نیست؟', 'محدودیت‌ها و شرایط خاص {k}']),
      S('compare', false, 'تفاوت با روش‌ها یا گزینه‌های جایگزین به‌صورت منصفانه', ['{k} در مقایسه با گزینه‌های دیگر', 'تفاوت {k} با روش‌های جایگزین چیست؟']),
      S('example', false, 'یک سناریوی کاربردی و ملموس بدون ادعای آماری', ['یک مثال کاربردی از {k}', 'نمونهٔ واقعی {k} چه شکلی دارد؟']),
      S('trouble', false, 'مشکلات متداول حین کار و راه‌حل هر کدام', ['رفع مشکلات متداول {k}', 'اگر {k} جواب نداد چه کنیم؟']),
      S('checklist', false, 'چک‌لیست کوتاه پایانی برای اطمینان از انجام درست کار', ['چک‌لیست نهایی {k}', 'قبل از پایان {k} چه چیزهایی را بررسی کنیم؟']),
    ],
    whatis: [
      S('what', true, 'تعریف روشن و ساده با اجزای اصلی مفهوم', ['{k} چیست؟', 'تعریف {k} به زبان ساده', 'مفهوم {k} دقیقاً چیست؟']),
      S('how', true, 'سازوکار یا طرز کار؛ چگونه و چرا کار می‌کند', ['{k} چگونه کار می‌کند؟', 'سازوکار {k} چیست؟']),
      S('benefits', true, 'مزایای واقعی و قابل‌دفاع، بدون اغراق', ['مزایای {k} چیست؟', 'چرا {k} اهمیت دارد؟']),
      S('types', false, 'انواع یا دسته‌بندی‌های اصلی و تفاوت هر کدام', ['انواع {k}', '{k} چند دسته دارد؟']),
      S('use', true, 'کاربردها و موقعیت‌های استفاده', ['کاربردهای {k}', '{k} در چه مواردی به کار می‌آید؟']),
      S('myths', false, 'باورهای نادرست رایج و پاسخ درست', ['باورهای نادرست دربارهٔ {k}', 'چه تصورات غلطی دربارهٔ {k} وجود دارد؟']),
      S('choose', false, 'چگونه گزینهٔ مناسب را انتخاب کنیم', ['چطور {k} مناسب را انتخاب کنیم؟', 'معیارهای انتخاب {k}']),
      S('limits', false, 'محدودیت‌ها و نکاتی که باید مراقب آن‌ها بود', ['محدودیت‌ها و نکات مهم {k}', 'معایب و ملاحظات {k}']),
      S('example', false, 'یک مثال ملموس', ['یک مثال ساده از {k}', 'نمونهٔ کاربردی {k}']),
      S('start', false, 'از کجا شروع کنیم؛ گام‌های اولیه', ['برای شروع {k} از کجا آغاز کنیم؟', 'نخستین گام‌ها در {k}']),
    ],
    compare: [
      S('overview', true, 'معرفی کوتاه و منصفانهٔ گزینه‌ها و معیار مقایسه', ['نگاه کلی: {k}', 'گزینه‌ها و معیار مقایسه در {k}']),
      S('criteria', true, 'معیارهای مهم تصمیم‌گیری و اهمیت هرکدام', ['معیارهای مهم در {k}', 'برای مقایسه {k} به چه نکاتی توجه کنیم؟']),
      S('strengths', true, 'نقاط قوت هر گزینه', ['نقاط قوت هر گزینه در {k}', 'هر گزینه در {k} چه برتری‌هایی دارد؟']),
      S('weak', true, 'نقاط ضعف و محدودیت هر گزینه', ['نقاط ضعف و محدودیت‌ها در {k}', 'معایب هر گزینه در {k}']),
      S('who', true, 'هر گزینه برای چه کسی یا چه نیازی مناسب‌تر است', ['کدام گزینه برای چه کسی مناسب‌تر است؟', 'انتخاب مناسب در {k} به چه نیازی بستگی دارد؟']),
      S('mistakes', false, 'اشتباهات رایج هنگام تصمیم‌گیری', ['اشتباهات رایج در انتخاب {k}', 'چه خطاهایی در تصمیم دربارهٔ {k} رخ می‌دهد؟']),
      S('checklist', false, 'چک‌لیست تصمیم‌گیری', ['چک‌لیست تصمیم‌گیری در {k}', 'قبل از انتخاب چه چیزهایی را بسنجیم؟']),
      S('cost', false, 'عوامل هزینه و ارزش، بدون ذکر قیمت‌های ثبت‌نشده', ['عوامل مؤثر بر هزینه و ارزش در {k}', 'ارزش واقعی هر گزینه در {k}']),
      S('future', false, 'روندها و نکات بعد از انتخاب', ['بعد از انتخاب در {k} چه باید کرد؟', 'نگه‌داری و ارزیابی بعد از انتخاب {k}']),
    ],
    buying: [
      S('know', true, 'آنچه خریدار قبل از خرید باید بداند', ['قبل از خرید {k} چه چیزی را بدانیم؟', 'خرید {k} از کجا شروع می‌شود؟']),
      S('criteria', true, 'معیارهای فنی و کاربردی انتخاب', ['معیارهای انتخاب {k}', 'در انتخاب {k} به چه نکاتی دقت کنیم؟']),
      S('types', true, 'انواع و تفاوت‌های اصلی', ['انواع {k} و تفاوت آن‌ها', '{k} چه گونه‌هایی دارد؟']),
      S('fit', false, 'تناسب با نیاز و سبک استفاده', ['کدام {k} به نیاز ما می‌خورد؟', 'انتخاب {k} بر اساس نیاز']),
      S('price', false, 'عوامل مؤثر بر قیمت بدون ذکر عدد ثبت‌نشده', ['چه عواملی بر قیمت {k} اثر می‌گذارد؟', 'قیمت {k} از چه چیزهایی ساخته می‌شود؟']),
      S('mistakes', true, 'اشتباهات رایج خریداران', ['اشتباهات رایج هنگام خرید {k}', 'خریداران {k} چه خطاهایی می‌کنند؟']),
      S('care', false, 'نگهداری و استفادهٔ درست بعد از خرید', ['نگهداری و استفادهٔ درست از {k}', 'بعد از خرید {k} چه کنیم؟']),
      S('check', false, 'چک‌لیست سریع قبل از پرداخت', ['چک‌لیست سریع خرید {k}', 'قبل از پرداخت چه چیزهایی را بررسی کنیم؟']),
      S('alt', false, 'گزینه‌های جایگزین', ['جایگزین‌های {k} چیست؟', 'اگر {k} مناسب نبود چه کنیم؟']),
    ],
    general: [
      S('overview', true, 'معرفی دقیق موضوع و دامنهٔ آن', ['{k} در یک نگاه', 'مقدمه‌ای دقیق بر {k}']),
      S('key', true, 'نکات کلیدی که خواننده باید بداند', ['مهم‌ترین نکات دربارهٔ {k}', 'نکات کلیدی {k} چیست؟']),
      S('benefits', true, 'مزایا و ارزش واقعی', ['چرا {k} مهم است؟', 'مزایای {k}']),
      S('challenges', false, 'چالش‌ها و محدودیت‌ها', ['چالش‌های {k}', 'چه موانعی در {k} وجود دارد؟']),
      S('tips', true, 'توصیه‌های عملی', ['توصیه‌های عملی برای {k}', 'چطور در {k} بهتر عمل کنیم؟']),
      S('mistakes', false, 'اشتباهات رایج', ['اشتباهات رایج در {k}', 'چه خطاهایی در {k} رایج است؟']),
      S('example', false, 'مثال ملموس', ['یک مثال کاربردی از {k}', 'نمونه‌ای از {k} در عمل']),
      S('compare', false, 'مقایسه با گزینه‌های مرتبط', ['{k} در مقایسه با گزینه‌های مرتبط', 'تفاوت {k} با موضوعات مشابه']),
      S('next', false, 'گام‌های بعدی پیشنهادی', ['گام بعدی در {k} چیست؟', 'پس از آشنایی با {k} چه کنیم؟']),
    ],
  };



  /* keyword-free, natural question forms per slot — used only by the H2 repair when the keyword would otherwise be in every heading */
  const NEUTRAL = {
    howto: { prereq: ['قبل از شروع چه چیزهایی را باید آماده کنیم؟'], steps: ['مراحل انجام کار به ترتیب چیست؟'], mistakes: ['چه اشتباهاتی نتیجه را خراب می‌کند؟'], tips: ['چه نکاتی نتیجه را بهتر می‌کند؟'], limits: ['در چه شرایطی این روش مناسب نیست؟'], compare: ['تفاوت این روش با جایگزین‌ها چیست؟'], example: ['یک مثال کاربردی چه شکلی دارد؟'], trouble: ['اگر نتیجه مطلوب نبود چه کنیم؟'], checklist: ['پیش از پایان کار چه چیزهایی را بررسی کنیم؟'] },
    whatis: { how: ['سازوکار آن چگونه است و چطور کار می‌کند؟'], benefits: ['چه مزیت‌هایی دارد و چرا اهمیت دارد؟'], types: ['چه انواعی دارد و تفاوت‌شان چیست؟'], use: ['در چه موقعیت‌هایی به کار می‌آید؟'], myths: ['چه باورهای نادرستی رایج است؟'], choose: ['چطور گزینهٔ مناسب را انتخاب کنیم؟'], limits: ['چه محدودیت‌هایی را باید در نظر داشت؟'], example: ['یک مثال ساده چه شکلی دارد؟'], start: ['برای شروع از کجا آغاز کنیم؟'] },
    compare: { criteria: ['برای مقایسه به چه معیارهایی توجه کنیم؟'], strengths: ['هر گزینه چه برتری‌هایی دارد؟'], weak: ['هر گزینه چه محدودیت‌هایی دارد؟'], mistakes: ['چه اشتباهاتی هنگام تصمیم‌گیری رایج است؟'], checklist: ['پیش از انتخاب چه چیزهایی را بسنجیم؟'], cost: ['چه عواملی بر هزینه و ارزش اثر می‌گذارد؟'], future: ['بعد از انتخاب چه باید کرد؟'] },
    buying: { know: ['پیش از خرید چه چیزی را باید بدانیم؟'], criteria: ['در انتخاب به چه نکاتی دقت کنیم؟'], types: ['چه انواعی وجود دارد و تفاوتشان چیست؟'], fit: ['کدام گزینه به نیاز ما می‌خورد؟'], price: ['چه عواملی بر قیمت اثر می‌گذارد؟'], mistakes: ['خریداران چه اشتباهاتی می‌کنند؟'], care: ['بعد از خرید چطور نگهداری کنیم؟'], check: ['پیش از پرداخت چه چیزهایی را بررسی کنیم؟'], alt: ['اگر گزینهٔ اول مناسب نبود چه جایگزینی داریم؟'] },
    general: { key: ['مهم‌ترین نکات کدام است؟'], benefits: ['چرا این موضوع مهم است؟'], challenges: ['چه چالش‌هایی وجود دارد؟'], tips: ['چه توصیه‌های عملی‌ای مفید است؟'], mistakes: ['چه اشتباهاتی رایج است؟'], example: ['یک مثال کاربردی چه شکلی دارد؟'], compare: ['چه تفاوتی با موضوعات مشابه دارد؟'], next: ['گام بعدی چیست؟'] },
  };
  Object.keys(NEUTRAL).forEach((it) => INTENTS[it].forEach((sl) => { sl.neutral = (NEUTRAL[it][sl.key] || []).slice(); }));

  /* ---------- H2 audit + repair (SEO + AEO): searchable questions, keyword/synonym in SOME headings, no vague or duplicate ones ---------- */
  const Q_WORDS = new Set(['چیست', 'چطور', 'چگونه', 'چرا', 'چه', 'کدام', 'آیا', 'کی', 'کجا', 'چند', 'چقدر', 'کیست']);
  const H_STOP = new Set('در از به با برای و که را یا آیا چه این آن هر یک بر تا'.split(' '));
  const VAGUE_RE = /^(?:مقدمه|نتیجه ?گیری|جمع ?بندی|سخن ?(?:آخر|پایانی)|نکات|توضیحات|موارد(?: مهم)?|بخش(?: \d+)?|ادامه|خلاصه|منابع|متفرقه|سایر|اطلاعات(?: بیشتر)?|بیشتر بدانید)$/;
  const FILLER = new Set('این آن موضوع کار روش خرید انتخاب'.split(' '));
  const clean = (h) => normText(h).replace(/[؟?!.:،]/g, ' ').replace(/\s+/g, ' ').trim();
  const isQuestion = (h) => /[؟?]\s*$/.test(String(h)) || tokens(h).some((w) => Q_WORDS.has(w));
  const forms = (o) => [o.keyword].concat(o.synonyms || []).map(normText).filter(Boolean);
  const hasKw = (h, o) => { const t = normText(h); return forms(o).some((f) => t.includes(f)); };
  const kwTokens = (o) => new Set(forms(o).join(' ').split(' '));
  const contentTokens = (h, o) => { const kt = kwTokens(o); return tokens(clean(h)).filter((w) => !kt.has(w) && !H_STOP.has(w) && !Q_WORDS.has(w) && !FILLER.has(w) && [...w].length > 1); };
  const GENERIC_W = new Set('توضیحات نکات موارد اطلاعات تکمیلی مهم بیشتر اضافی کلی عمومی دربارهٔ دربارۀ درباره مورد پیرامون موضوع مطلب بخش ادامه خلاصه مقدمه نتیجه جمع بندی سخن پایانی آخر مروری'.split(' '));
  function isVague(h, o) {
    const c = clean(h); if ([...c].length < 10 || c.split(' ').length < 2 || VAGUE_RE.test(c)) return true;
    const kt0 = kwTokens(o); const rest = tokens(c).filter((w) => !kt0.has(w) && !H_STOP.has(w) && !Q_WORDS.has(w));
    if (rest.length && rest.every((w) => GENERIC_W.has(w))) return true; // only filler words around the topic («توضیحات تکمیلی دربارهٔ موضوع»)
    return !contentTokens(h, o).length && !isQuestion(h);
  }
  function isDup(h, others, o) {
    const a = new Set(contentTokens(h, o).concat(tokens(clean(h)).filter((w) => Q_WORDS.has(w) === false && !H_STOP.has(w) && kwTokens(o).has(w) === false)));
    return others.some((x) => {
      if (clean(x) === clean(h)) return true;
      const b = new Set(contentTokens(x, o).concat(tokens(clean(x)).filter((w) => !Q_WORDS.has(w) && !H_STOP.has(w) && !kwTokens(o).has(w))));
      if (!a.size || !b.size) return false; let k = 0; a.forEach((w) => { if (b.has(w)) k++; });
      return k / (a.size + b.size - k) >= 0.6;
    });
  }
  /** headings: array of strings. Returns the facts the rules are checked against. */
  function auditHeadings(headings, o) {
    o = o || {}; const hs = (headings || []).map((h) => String(h || '').trim()).filter(Boolean); const n = hs.length;
    const q = hs.filter(isQuestion).length; const kw = hs.filter((h) => hasKw(h, o)).length;
    const vague = hs.filter((h) => isVague(h, o)); const dup = hs.filter((h, i) => isDup(h, hs.slice(0, i), o));
    const needQ = Math.ceil(n / 3); const maxKw = Math.max(1, Math.ceil(n * 2 / 3)); const issues = [];
    if (q < needQ) issues.push('تیترهای پرسشی کم است (' + q + ' از ' + n + '؛ حداقل ' + needQ + ')');
    if (n >= 3 && kw === 0) issues.push('عبارت کلیدی یا مترادفش در هیچ تیتری نیست');
    if (n >= 3 && kw > maxKw) issues.push('عبارت کلیدی در بیش از حد تیترها آمده (' + kw + ' از ' + n + ')');
    if (vague.length) issues.push('تیتر مبهم: ' + vague.join(' | '));
    if (dup.length) issues.push('تیتر تکراری: ' + dup.join(' | '));
    return { total: n, questions: q, questionRatio: n ? +(q / n).toFixed(2) : 0, keywordHeadings: kw, vague, duplicates: dup, issues, ok: !issues.length };
  }
  /** Replaces weak headings automatically. Pool = other variants of the same slot, reserve headings, then unused slots (keyword form and neutral form). */
  function improveHeadings(outline, o) {
    o = o || {}; const intent = outline.intent; const slots = INTENTS[intent] || INTENTS.general;
    const syn = (o.synonyms || []).map((x) => String(x || '').trim()).filter(Boolean);
    const ctx = { keyword: o.keyword, synonyms: syn };
    const forSlot = (sl, withKw) => (withKw ? sl.variants.map((v) => v.replace(/\{k\}/g, o.keyword)).concat(syn.length ? sl.variants.map((v) => v.replace(/\{k\}/g, syn[0])) : []) : sl.neutral.slice());
    const main = outline.main.map((x) => Object.assign({}, x)); let reserve = outline.reserve.map((x) => Object.assign({}, x));
    const n = main.length; const needQ = Math.ceil(n / 3); const maxKw = Math.max(1, Math.ceil(n * 2 / 3));
    const before = auditHeadings(main.map((x) => x.heading), ctx); const replaced = [];
    const slotOf = (it) => slots.find((sl) => sl.key === it.key);
    const others = (i) => main.filter((_, j) => j !== i).map((x) => x.heading);
    const okFor = (h, i) => !isVague(h, ctx) && !isDup(h, others(i), ctx);
    const cands = (it, withKw) => {
      const out = []; const sl = slotOf(it);
      if (sl) forSlot(sl, withKw).forEach((h) => out.push({ key: sl.key, heading: h, goal: sl.goal }));
      reserve.forEach((r) => out.push({ key: r.key, heading: r.heading, goal: r.goal, fromReserve: true }));
      slots.forEach((x) => { if (!main.some((m) => m.key === x.key)) forSlot(x, withKw).forEach((h) => out.push({ key: x.key, heading: h, goal: x.goal })); });
      return out.filter((c) => withKw ? true : !hasKw(c.heading, ctx));
    };
    const swap = (i, c, why) => { replaced.push({ from: main[i].heading, to: c.heading, reason: why }); main[i] = { key: c.key, heading: c.heading, goal: c.goal }; if (c.fromReserve) reserve = reserve.filter((r) => r.heading !== c.heading); };
    // A) vague or duplicate headings
    main.forEach((it, i) => {
      const why = isVague(it.heading, ctx) ? 'مبهم' : (isDup(it.heading, main.slice(0, i).map((x) => x.heading), ctx) ? 'تکراری' : '');
      if (!why) return; const c = cands(it, hasKw(it.heading, ctx) || i === 0).find((x) => okFor(x.heading, i)); if (c) swap(i, c, why);
    });
    reserve = reserve.filter((r, i) => !isVague(r.heading, ctx) && !isDup(r.heading, main.map((x) => x.heading).concat(reserve.slice(0, i).map((x) => x.heading)), ctx));
    // B) keyword share: present in some headings, never in all
    let kw = main.filter((x) => hasKw(x.heading, ctx)).length;
    if (n >= 3 && kw === 0) { const c = cands(main[0], true).find((x) => hasKw(x.heading, ctx) && okFor(x.heading, 0)); if (c) swap(0, c, 'نبود عبارت کلیدی'); }
    for (let i = n - 1; i > 0 && main.filter((x) => hasKw(x.heading, ctx)).length > maxKw; i--) {
      if (!hasKw(main[i].heading, ctx)) continue;
      const c = cands(main[i], false).find((x) => !hasKw(x.heading, ctx) && okFor(x.heading, i) && (x.key === main[i].key || !main.some((m) => m.key === x.key)));
      if (c) swap(i, c, 'تراکم عبارت کلیدی در تیترها');
    }
    // C) at least one third of the headings are searchable questions
    for (let i = n - 1; i >= 1 && main.filter((x) => isQuestion(x.heading)).length < needQ; i--) {
      if (isQuestion(main[i].heading)) continue;
      const withKw = hasKw(main[i].heading, ctx);
      const c = cands(main[i], withKw).find((x) => isQuestion(x.heading) && hasKw(x.heading, ctx) === withKw && okFor(x.heading, i)) || cands(main[i], withKw).find((x) => isQuestion(x.heading) && okFor(x.heading, i));
      if (c) swap(i, c, 'تیتر غیرپرسشی');
    }
    // D) question headings end with «؟»
    const fixQ = (x) => (isQuestion(x.heading) && !/[؟?]\s*$/.test(x.heading) ? Object.assign({}, x, { heading: x.heading.replace(/[.:،]+\s*$/, '') + '؟' }) : x);
    const fm = main.map(fixQ); const fr = reserve.map(fixQ);
    const after = auditHeadings(fm.map((x) => x.heading), ctx);
    return { outline: { intent, main: fm, reserve: fr }, report: { before, after, replaced, synonyms: syn } };
  }

  function planOutline(input, plan) {
    const intent = input.intent && INTENTS[input.intent] ? input.intent : detectIntent(input.title);
    const pool = INTENTS[intent];
    const r = rng(hash32([input.seed || '', input.title, input.keyword].join('|')));
    const need = plan.sections + 3; // chosen + reserve for honest expansion
    const chosen = pool.map((slot, i) => ({ slot, i })).filter((x) => x.slot.core);
    const optional = pool.map((slot, i) => ({ slot, i })).filter((x) => !x.slot.core).sort(() => r() - 0.5);
    while (chosen.length < Math.min(need, pool.length) && optional.length) chosen.push(optional.shift());
    chosen.sort((a, b) => a.i - b.i);
    const items = chosen.map(({ slot }) => ({ key: slot.key, heading: pick(slot.variants, r).replace(/\{k\}/g, input.keyword), goal: slot.goal }));
    return { intent, main: items.slice(0, plan.sections), reserve: items.slice(plan.sections) };
  }

  /* ---------- prompts ---------- */
  const RULES = [
    'فقط به فارسی روان و طبیعی بنویس؛ هر جمله باید اطلاعات تازه بدهد و از جمله‌های پرکننده و تکرار پرهیز کن.',
    'هر عدد، درصد، تاریخ، قیمت، آمار، نام برند یا شخص و هر ادعای پزشکی، حقوقی یا مالی که در «داده‌های معتبر» نیست ننویس؛ اگر مطمئن نیستی، آن را حذف کن.',
    'ادعای تضمینی یا اغراق‌آمیز (مثل «تضمین»، «۱۰۰ درصد»، «بهترین در جهان») ننویس.',
    'تیتر، markdown، ستاره و شمارهٔ بخش ننویس. اگر فهرست لازم است هر مورد را در یک خط جدا با «- » شروع کن.',
  ];
  function pickFacts(chunks, query, n) {
    const q = new Set(tokens(query).filter((w) => w.length > 2));
    const scored = chunks.map((c, i) => ({ c, i, s: tokens(c).filter((w) => q.has(w)).length }));
    const top = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n);
    const lead = scored.slice(0, 2);
    const seen = new Set(); const out = [];
    top.concat(lead).sort((a, b) => a.i - b.i).forEach((x) => { if (!seen.has(x.i)) { seen.add(x.i); out.push(x.c); } });
    return out.join('\n');
  }
  function chunkFacts(facts) {
    const parts = String(facts || '').split(/\n{1,}|(?<=[.!؟])\s+/).map((x) => x.trim()).filter((x) => x.length > 15);
    const out = []; let cur = '';
    parts.forEach((p) => { if ((cur + ' ' + p).length > 420) { if (cur) out.push(cur); cur = p; } else cur = (cur + ' ' + p).trim(); });
    if (cur) out.push(cur);
    return out;
  }
  /* ---------- LSI / related terms: chosen ONLY from the real data (facts or terms the user supplied) ---------- */
  const hasTerm = (text, term) => { const t = normText(term); return !!t && normText(stripTags(text)).includes(t); };
  function lsiCandidates(title, keyword, factsRaw, extra, limit) {
    const own = new Set(tokens(keyword + ' ' + title).filter((w) => w.length > 2));
    const factsN = normText(stripTags(factsRaw));
    const pool = [];
    (Array.isArray(extra) ? extra : []).forEach((x) => { const t = String(x || '').trim(); if (t && !/\d/.test(t) && [...t].length <= 40) pool.push(t); });
    Agent.keywords('', factsRaw, 40).forEach((t) => pool.push(t));
    const WEAK = new Set('روی اثر تهیه شده شود شوند گذارد کند کنند دارد دارند باید بیشتر کمتر مانند مثل بین نیز همه برخی بسیار حتی هنوز وقتی زمانی'.split(' '));
    const bad = (w) => [...w].length < 4 || WEAK.has(w) || /^می/.test(w) || /ای$/.test(w);
    const out = []; const seen = new Set();
    pool.forEach((t) => {
      const n = normText(t); if (!n || seen.has(n) || /\d/.test(n)) return;
      if (n.split(' ').some(bad) && !(extra || []).some((x) => normText(x) === n)) return;
      const ws = n.split(' '); if (ws.every((w) => own.has(w))) return;              // nothing new vs. title/keyword
      if (ws.length === 1 && [...n].length < 4) return;
      if (!factsN.includes(n) && !(extra || []).some((x) => normText(x) === n)) return; // must really exist in the data
      if (out.some((o) => o.includes(n) || n.includes(o))) return;                      // no near-duplicates
      seen.add(n); out.push(n);
    });
    return out.slice(0, limit);
  }
  /** 1–2 terms per section: best topical fit first (co-occurrence with the section's own words), every term used, none repeated when there are enough. */
  function assignLsi(terms, sections, chunks) {
    const map = new Map(); sections.forEach((s) => map.set(s.heading, []));
    if (!terms.length || !sections.length) return map;
    const fit = (term, sec) => { const q = new Set(tokens(sec.heading + ' ' + sec.goal).filter((w) => w.length > 2)); let best = 0; chunks.forEach((c) => { if (normText(c).includes(term)) best = Math.max(best, tokens(c).filter((w) => q.has(w)).length + 1); }); return best; };
    const load = (sec) => map.get(sec.heading).length;
    const left = terms.slice();
    // pass 1: every section gets its best-fitting unused term (fewest-loaded sections first, so nothing starves)
    sections.forEach((sec) => { if (!left.length) return; left.sort((a, b) => fit(b, sec) - fit(a, sec) || terms.indexOf(a) - terms.indexOf(b)); map.get(sec.heading).push(left.shift()); });
    // pass 2: leftovers go to their best section that still has room (max 2)
    left.forEach((t) => { const room = sections.filter((x) => load(x) < 2).sort((a, b) => fit(t, b) - fit(t, a) || load(a) - load(b))[0]; if (room) map.get(room.heading).push(t); });
    // too few terms for the sections: reuse the strongest terms so each section still gets one
    sections.forEach((sec, i) => { if (!load(sec)) map.get(sec.heading).push(terms[i % terms.length]); });
    return map;
  }
  function sectionPrompt(ctx, sec, min, max, extra) {
    return ['[[TASK:section]]', 'نقش: نویسندهٔ حرفه‌ای محتوای فارسی با رعایت اصول SEO، GEO و AEO. فقط متن بخش را بنویس.',
      'موضوع مقاله: ' + ctx.title, 'عبارت کلیدی اصلی: ' + ctx.keyword, 'تیتر این بخش: ' + sec.heading, 'هدف بخش: ' + sec.goal,
      'طول: حداقل ' + min + ' و حداکثر ' + max + ' واژه، در ۲ تا ۴ پاراگراف کوتاه. جملهٔ اول مستقیم و حداکثر ۳۰ واژه، پاسخ تیتر باشد.',
      'قوانین:', ...RULES.map((x) => '- ' + x), '- عبارت کلیدی را حداکثر یک یا دو بار و فقط طبیعی بیاور.',
      sec.lsi && sec.lsi.length ? 'کلمه‌های مرتبط (LSI) این بخش — هرکدام را یک بار و فقط در جای طبیعی بیاور، بدون اینکه جمله را مصنوعی کنی: ' + sec.lsi.join('، ') : '',
      ctx.usedOpeners.length ? 'شروع بخش با این عبارت‌ها نباشد: ' + ctx.usedOpeners.slice(0, 14).join(' | ') : '',
      ctx.done.length ? 'تیترهای بخش‌های قبلی (محتوایشان را تکرار نکن): ' + ctx.done.map((d) => d.heading).join(' | ') : '',
      ctx.done.length ? 'خلاصهٔ بخش‌های قبلی: ' + ctx.done.slice(-5).map((d) => clipWords(d.text, 22)).join(' || ') : '',
      ctx.general ? 'توجه: داده‌ای از کاربر وجود ندارد؛ فقط از دانش عمومی پایدار و بدون عدد و ادعای حساس بنویس.' : 'داده‌های معتبر:\n' + pickFacts(ctx.chunks, sec.heading + ' ' + sec.goal, 4),
      extra ? 'اشکالات نوشتهٔ قبلی که باید رفع شود: ' + extra : '', 'اکنون فقط متن بخش را بنویس.'].filter(Boolean).join('\n');
  }

  /* ---------- parsing model output ---------- */
  function cleanModelText(raw) {
    return String(raw || '').replace(/\[\[[^\]]*\]\]/g, ' ').replace(/```[a-z]*/gi, ' ').replace(/<think>[\s\S]*?<\/think>/gi, ' ')
      .replace(/^\s{0,3}#{1,6}\s*/gm, '').replace(/\*\*|__/g, '').replace(/^\s*\*\s+/gm, '- ').replace(/^\s*[•·]\s+/gm, '- ').trim();
  }
  function bodyText(raw, heading) {
    let t = cleanModelText(raw);
    const lines = t.split('\n'); if (lines.length && normText(lines[0]).replace(/[؟?:]/g, '') === normText(heading).replace(/[؟?:]/g, '')) lines.shift();
    return lines.join('\n').trim();
  }
  function toHtml(text) {
    const blocks = String(text || '').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean); let html = '';
    blocks.forEach((b) => {
      const ls = b.split('\n').map((x) => x.trim()).filter(Boolean);
      if (ls.every((l) => /^-\s+/.test(l))) html += '<ul>' + ls.map((l) => '<li>' + esc(l.replace(/^-\s+/, '')) + '</li>').join('') + '</ul>';
      else {
        let para = []; const flush = () => { if (para.length) { html += '<p>' + esc(para.join(' ')) + '</p>'; para = []; } };
        ls.forEach((l) => { if (/^-\s+/.test(l)) { flush(); html += '<ul><li>' + esc(l.replace(/^-\s+/, '')) + '</li></ul>'; } else para.push(l); });
        flush();
      }
    });
    return html.replace(/<\/ul><ul>/g, '');
  }
  function parseJsonArray(raw) {
    const t = cleanModelText(raw); const a = t.indexOf('['); const b = t.lastIndexOf(']');
    if (a < 0 || b <= a) return null;
    try { const v = JSON.parse(t.slice(a, b + 1)); return Array.isArray(v) ? v : null; } catch (_) { return null; }
  }

  /* ---------- gates ---------- */
  const BOILERPLATE = [/به عنوان یک (مدل|هوش مصنوعی|دستیار)/, /as an ai/i, /من (یک )?(مدل|هوش)/, /نمی‌?توانم (این|کمک|پاسخ)/, /\[\[|\]\]|```/, /^در این (بخش|مقاله)/m, /در پایان (می‌?توان گفت|باید گفت)/, /بدون شک/];
  const ABSOLUTE = /(تضمین|صد در صد|۱۰۰ ?درصد|100 ?%|بدون هیچ (عیب|ایراد|مشکلی)|بهترین .{0,25} در (ایران|جهان|دنیا))/;
  function numbersIn(text) {
    const t = latinDigits(text); const out = new Set();
    (t.match(/\d+(?:[.,٫]\d+)?\s?%?/g) || []).forEach((m) => { const n = m.replace(/\s/g, ''); const core = parseFloat(n.replace(',', '.').replace('٫', '.')); if (/%|[.,٫]/.test(n) || core > 10) out.add(n.replace(/%$/, '')); });
    return out;
  }
  function repeatedTrigramRatio(text) {
    const t = tokens(text); if (t.length < 40) return 0;
    const seen = new Map(); let total = 0;
    for (let i = 0; i < t.length - 2; i++) { const k = t[i] + ' ' + t[i + 1] + ' ' + t[i + 2]; seen.set(k, (seen.get(k) || 0) + 1); total++; }
    let repeats = 0; seen.forEach((n) => { if (n > 1) repeats += n - 1; });
    return repeats / Math.max(1, total);
  }
  function sentenceStartRepeat(text) {
    const ss = sentences(text); if (ss.length < 6) return 0;
    const m = new Map(); ss.forEach((s) => { const k = tokens(s).slice(0, 2).join(' '); if (k) m.set(k, (m.get(k) || 0) + 1); });
    return Math.max(0, ...m.values());
  }
  function checkText(text, o) {
    const problems = []; const w = countWords(text);
    if (w < o.minWords) problems.push('کوتاه‌تر از حد لازم است (' + w + ' واژه؛ حداقل ' + o.minWords + ')');
    if (o.maxWords && w > o.maxWords) problems.push('بیش از حد طولانی و پرحاشیه است (' + w + ' واژه)');
    BOILERPLATE.forEach((re) => { if (re.test(text)) problems.push('عبارت قالبی یا بی‌ربط به‌کار رفته است'); });
    if (/[\u4e00-\u9fff\u0400-\u04ff\u3040-\u30ff]/.test(text)) problems.push('نویسه‌های غیرفارسی/غیرلاتین در متن هست');
    const letters = (text.match(/\p{L}/gu) || []).length; const fa = (text.match(/[\u0600-\u06ff]/g) || []).length;
    if (letters > 20 && fa / letters < 0.7) problems.push('متن به‌اندازهٔ کافی فارسی نیست');
    if (repeatedTrigramRatio(text) > 0.12) problems.push('عبارت‌های تکراری زیاد است');
    if (sentenceStartRepeat(text) >= 4) problems.push('جمله‌ها بارها با یک عبارت شروع شده‌اند');
    const allowed = o.allowedNumbers || new Set();
    const bad = [...numbersIn(text)].filter((n) => !allowed.has(n));
    if (bad.length) problems.push('عددهای بدون منبع: ' + bad.slice(0, 4).join('، '));
    if (ABSOLUTE.test(text) && !ABSOLUTE.test(o.factsText || '')) problems.push('ادعای تضمینی/اغراق‌آمیز بدون منبع');
    if (o.keyword) { const hits = normText(text).split(normText(o.keyword)).length - 1; if (hits > (o.maxKeyword || 2)) problems.push('عبارت کلیدی بیش از حد تکرار شده است'); }
    (o.compareTo || []).forEach((c) => { if (c.text && Agent.similarityScore(text, c.text) >= (c.limit || 30)) problems.push('بیش از حد شبیه ' + (c.label || 'متن دیگر') + ' است'); });
    const first3 = tokens(text).slice(0, 3).join(' ');
    if (first3 && (o.usedOpeners || []).includes(first3)) problems.push('شروع متن با یکی از متن‌های قبلی یکسان است');
    return problems;
  }

  /* ---------- generation steps (each with gated retries) ---------- */
  async function attempt(gen, makePrompt, check, tries, maxTokens, shouldStop) {
    let feedback = ''; let last = null; let lastProblems = ['خروجی خالی بود'];
    for (let i = 1; i <= tries; i++) {
      if (shouldStop && shouldStop()) throw new Error('نوشتن متوقف شد.');
      let raw = ''; try { raw = await gen(makePrompt(feedback), { maxTokens }); } catch (e) { throw e; }
      const parsed = check.parse(raw); last = parsed; lastProblems = parsed == null ? ['خروجی قابل‌استفاده نبود'] : check.problems(parsed);
      if (parsed != null && !lastProblems.length) return { value: parsed, attempts: i, problems: [], ok: true };
      feedback = lastProblems.join('؛ ');
    }
    return { value: last, attempts: tries, problems: lastProblems, ok: false };
  }

  async function writeArticle(input, deps) {
    input = input || {}; deps = deps || {};
    const gen = deps.gen; if (typeof gen !== 'function') throw new Error('مدل زبانی در دسترس نیست.');
    const progress = deps.onProgress || (() => {}); const shouldStop = deps.shouldStop || (() => false);
    const title = String(input.title || '').trim();
    if ([...title].length < 5) throw new Error('عنوان یا موضوع مقاله را وارد کن.');
    const factsRaw = String(input.facts || '').trim();
    const general = !!input.allowGeneralKnowledge && [...Agent.plain(factsRaw)].length < 80;
    if (!general && [...Agent.plain(factsRaw)].length < 80) throw new Error('برای مقالهٔ قابل‌اعتماد حداقل ۸۰ نویسه داده/منبع وارد کن، یا گزینهٔ «نوشتن از دانش عمومی مدل (نیازمند بازبینی دستی)» را روشن کن.');
    const plan = PLANS[input.plan] || PLANS.standard;
    const minWords = Math.max(HARD_MIN_WORDS, Number(input.minWords) || plan.minWords);
    const keyword = String(input.keyword || '').trim() || Agent.keywords(title, factsRaw, 1)[0] || title;
    const existing = (Array.isArray(input.existing) ? input.existing : []).map((x) => ({ id: x.id, title: x.title, url: x.url, text: stripTags(x.content || x.contentPreview || x.excerpt || '') })).filter((x) => x.text.length > 80).slice(0, 80);
    const ctx = { title, keyword, general, chunks: chunkFacts(factsRaw), usedOpeners: (input.usedOpeners || []).slice(-60), done: [] };
    const allowedNumbers = numbersIn(factsRaw + ' ' + title + ' ' + keyword);
    const factsText = factsRaw + ' ' + title;
    const gateBase = { allowedNumbers, factsText, keyword, usedOpeners: ctx.usedOpeners };
    const prevCompare = () => ctx.done.map((d) => ({ text: d.text, limit: 22, label: 'بخش «' + d.heading + '»' }));
    const siteCompare = existing.map((x) => ({ text: x.text, limit: 30, label: 'مطلب «' + x.title + '»' }));
    const secWords = plan.sectionWords; const secMin = Math.round(secWords * 0.8); const secMax = Math.round(secWords * 2.2);
    const outline0 = planOutline({ title, keyword, intent: input.intent, seed: input.seed }, plan);
    let outline = outline0;
    const totalSteps = plan.sections + 5; let step = 0; const tick = (label) => progress({ step: ++step, total: totalSteps, label });
    const metrics = { sections: [], problems: [], plan: plan.id, minWords, intent: outline0.intent, mode: general ? 'general-knowledge' : 'fact-grounded' };

    // 1) optional topic-specific headings from the model (validated); otherwise the intent templates are used
    if (input.useModelOutline !== false) {
      tick('طراحی سرفصل‌ها');
      try {
        const raw = await gen(['[[TASK:outline]]', 'برای مقاله‌ای با عنوان «' + title + '» و عبارت کلیدی «' + keyword + '»، دقیقاً ' + (plan.sections + 3) + ' تیتر H2 مجزا و مرتبط پیشنهاد بده.', 'هر تیتر ۳ تا ۱۲ واژه، به‌صورت پرسش یا عبارت جستجوپذیر، بدون تکرار و بدون شمارهٔ ترتیب. فقط یک آرایهٔ JSON از رشته‌ها بده.', general ? '' : 'موضوعات باید فقط از این داده‌ها قابل پوشش باشند:\n' + pickFacts(ctx.chunks, title, 6)].filter(Boolean).join('\n'), { maxTokens: 500 });
        const arr = parseJsonArray(raw);
        const good = arr && arr.map((x) => String(x || '').replace(/^\s*[\d۰-۹]+[.)\-–]\s*/, '').trim()).filter((h, i, a) => { const L = [...h].length; return L >= 12 && L <= 90 && !/[<>#*]/.test(h) && normText(h) !== normText(title) && a.findIndex((z) => normText(z) === normText(h)) === i; });
        if (good && good.length >= plan.sections) {
          const items = good.slice(0, plan.sections + 3).map((h) => ({ key: 'model', heading: h, goal: 'پاسخ کامل، دقیق و کاربردی به همین تیتر، بدون تکرار بخش‌های دیگر' }));
          outline = { intent: outline0.intent, main: items.slice(0, plan.sections), reserve: items.slice(plan.sections).concat(outline0.reserve) };
          metrics.outline = 'model';
        } else metrics.outline = 'template';
      } catch (e) { if (shouldStop()) throw e; metrics.outline = 'template'; }
    } else metrics.outline = 'template';

    // 1b) H2 audit: weak (vague/duplicate/no-question/keyword-stuffed) headings are replaced before anything is written
    const hf = improveHeadings(outline, { keyword, synonyms: input.synonyms });
    outline = hf.outline; metrics.headings = hf.report;

    // 2) lead paragraph: direct answer (AEO/featured-snippet style)
    tick('پاسخ مستقیم ابتدای مقاله');
    const leadRes = await attempt(gen, (fb) => ['[[TASK:lead]]', 'یک پاراگراف پاسخ مستقیم ۴۰ تا ۶۰ واژه‌ای برای ابتدای مقاله‌ای با عنوان «' + title + '» بنویس که بلافاصله بگوید موضوع چیست و خواننده چه چیزی یاد می‌گیرد. عبارت کلیدی «' + keyword + '» یک بار طبیعی بیاید.', ...RULES.map((x) => '- ' + x), 'با «در این مقاله» شروع نکن.', general ? '' : 'داده‌های معتبر:\n' + pickFacts(ctx.chunks, title, 3), fb ? 'اشکالات قبلی: ' + fb : '', 'فقط همان یک پاراگراف را بنویس.'].filter(Boolean).join('\n'),
      { parse: (raw) => bodyText(raw, title).replace(/\n+/g, ' ').trim() || null, problems: (t) => { const p = checkText(t, Object.assign({}, gateBase, { minWords: 35, maxWords: 80, usedOpeners: [] })); if (!normText(t).includes(normText(keyword).split(' ')[0])) p.push('پاسخ مستقیم به موضوع اشاره نمی‌کند'); return p; } }, 3, 320, shouldStop);
    const lead = leadRes.value || '';

    // 2b) LSI terms from real data, 1–2 per section (main + reserve), given to each section prompt
    const lsiTerms = lsiCandidates(title, keyword, factsRaw, input.relatedKeywords, Math.min(14, (outline.main.length + outline.reserve.length) * 2));
    const lsiMap = assignLsi(lsiTerms, outline.main.concat(outline.reserve), ctx.chunks);
    outline.main.concat(outline.reserve).forEach((sec) => { sec.lsi = lsiMap.get(sec.heading) || []; });
    if (!leadRes.ok) metrics.problems.push('پاراگراف پاسخ مستقیم به استاندارد نرسید: ' + leadRes.problems.join('؛ '));

    // 3) sections
    const written = []; const missing = [];
    const writeSection = async (sec, idx) => {
      tick('نوشتن بخش ' + (idx + 1) + ': ' + sec.heading);
      const res = await attempt(gen, (fb) => sectionPrompt(ctx, sec, secMin, secMax, fb),
        { parse: (raw) => bodyText(raw, sec.heading) || null, problems: (t) => checkText(t, Object.assign({}, gateBase, { minWords: secMin, maxWords: secMax, compareTo: prevCompare().concat(siteCompare) })) }, 3, Math.min(1500, secWords * 6), shouldStop);
      const w = res.value ? countWords(res.value) : 0;
      const hard = res.problems.filter((p) => /عددهای بدون منبع|ادعای تضمینی|قالبی|غیرفارسی|بیش از حد شبیه|شروع متن/.test(p));
      const rec = { heading: sec.heading, words: w, attempts: res.attempts, status: res.ok ? 'ok' : (!hard.length && w >= secMin * 0.75 ? 'weak' : 'missing'), problems: res.problems };
      metrics.sections.push(rec);
      if (rec.status === 'missing') { missing.push(rec); return null; }
      const item = { heading: sec.heading, text: res.value, html: toHtml(res.value), weak: rec.status === 'weak', sec };
      ctx.done.push(item); written.push(item); return item;
    };
    for (let i = 0; i < outline.main.length; i++) await writeSection(outline.main[i], i);

    // 3b) self-review: sections accepted as «weak» get ONE more pass with their own problems as feedback; replaced only if clearly better
    for (const item of written.filter((x) => x.weak)) {
      const rec = metrics.sections.find((m) => m.heading === item.heading && m.status === 'weak'); if (!rec) continue;
      tick('بازبینی بخش ضعیف: ' + item.heading);
      const sec = { heading: item.heading, goal: 'نسخهٔ بهتر و دقیق‌تر همین بخش؛ مشکلات قبلی را رفع کن', lsi: (item.sec && item.sec.lsi) || [] };
      const others = () => ctx.done.filter((d) => d !== item).map((d) => ({ text: d.text, limit: 22, label: 'بخش «' + d.heading + '»' }));
      const res = await attempt(gen, (fb) => sectionPrompt(Object.assign({}, ctx, { done: ctx.done.filter((d) => d !== item) }), sec, secMin, secMax, rec.problems.join('؛ ') + (fb ? '؛ ' + fb : '')),
        { parse: (raw) => bodyText(raw, sec.heading) || null, problems: (t) => checkText(t, Object.assign({}, gateBase, { minWords: secMin, maxWords: secMax, compareTo: others().concat(siteCompare) })) }, 2, Math.min(1500, secWords * 6), shouldStop);
      if (res.ok && res.value) { item.text = res.value; item.html = toHtml(res.value); item.weak = false; rec.status = 'ok'; rec.problems = []; rec.revised = true; rec.words = countWords(res.value); }
      else rec.revisionTried = true;
    }

    // 4) honest expansion with reserve sections until the minimum is reached (never padding)
    const bodyWords = () => written.reduce((n, s) => n + countWords(s.text), 0) + countWords(lead);
    const reserveBudget = 120 + plan.faq * 55; // words expected from key points, conclusion and FAQ
    let reserve = outline.reserve.slice();
    while (bodyWords() + reserveBudget < minWords && reserve.length) {
      const sec = reserve.shift(); const r = await writeSection(sec, written.length + missing.length); if (!r) continue;
    }

    // 4b) LSI coverage over the whole article body; a missing term rewrites ONLY the best-fitting section
    const bodyAll = () => lead + ' ' + written.map((x) => x.text).join(' ');
    const lsiInfo = { terms: lsiTerms.slice(), perSection: written.map((x) => ({ heading: x.heading, terms: (x.sec && x.sec.lsi) || [] })), repaired: [], missing: [], coverage: 100 };
    for (const term of lsiTerms.slice()) {
      if (shouldStop()) break; if (hasTerm(bodyAll(), term)) continue;
      const cands = written.filter((x) => x.sec).sort((a, b) => ((b.sec.lsi || []).includes(term) ? 1 : 0) - ((a.sec.lsi || []).includes(term) ? 1 : 0) || (a.repairedFor ? 1 : 0) - (b.repairedFor ? 1 : 0) || a.text.length - b.text.length);
      const item = cands[0]; if (!item) continue;
      tick('پوشش کلمهٔ مرتبط: ' + term);
      const need = [term].concat((item.sec.lsi || []).filter((t) => t !== term)).slice(0, 2);
      const sec = { heading: item.heading, goal: item.sec.goal, lsi: need };
      const others = () => ctx.done.filter((d) => d !== item).map((d) => ({ text: d.text, limit: 22, label: 'بخش «' + d.heading + '»' }));
      const rec = metrics.sections.find((m) => m.heading === item.heading);
      const res = await attempt(gen, (fb) => sectionPrompt(Object.assign({}, ctx, { done: ctx.done.filter((d) => d !== item) }), sec, secMin, secMax, 'کلمهٔ «' + term + '» در کل مقاله نیامده؛ در همین بخش طبیعی بیاورش' + (fb ? '؛ ' + fb : '')),
        { parse: (raw) => bodyText(raw, sec.heading) || null, problems: (t) => checkText(t, Object.assign({}, gateBase, { minWords: secMin, maxWords: secMax, compareTo: others().concat(siteCompare) })).concat(need.filter((n) => !hasTerm(t, n)).map((n) => 'کلمهٔ مرتبط «' + n + '» نیامده است')) }, 2, Math.min(1500, secWords * 6), shouldStop);
      if (res.ok && res.value) { item.text = res.value; item.html = toHtml(res.value); item.weak = false; item.repairedFor = term; item.sec = Object.assign({}, item.sec, { lsi: need }); if (rec) { rec.words = countWords(res.value); rec.lsiRevised = true; } lsiInfo.repaired.push({ term, heading: item.heading }); }
    }

    // 5) key takeaways (GEO: quotable summary) built only from what was written
    tick('نکات کلیدی');
    const tl = await attempt(gen, (fb) => ['[[TASK:takeaways]]', 'از روی بخش‌های نوشته‌شدهٔ زیر، ۳ تا ۵ نکتهٔ کلیدی کوتاه (هرکدام حداکثر ۲۵ واژه) بنویس. فقط از همین متن‌ها نتیجه بگیر و چیز جدید اضافه نکن؛ هر نکته در یک خط با «- » شروع شود.', ...written.map((s) => 'تیتر: ' + s.heading + '\nمتن: ' + clipWords(s.text, 70)), fb ? 'اشکالات قبلی: ' + fb : ''].filter(Boolean).join('\n'),
      { parse: (raw) => { const ls = cleanModelText(raw).split('\n').map((x) => x.trim()).filter((x) => /^-\s+/.test(x)).map((x) => x.replace(/^-\s+/, '')); return ls.length ? ls : null; }, problems: (ls) => { const p = []; if (ls.length < 3 || ls.length > 6) p.push('تعداد نکات باید ۳ تا ۵ باشد'); const bad = [...numbersIn(ls.join(' '))].filter((n) => !numbersIn(written.map((s) => s.text).join(' ') + ' ' + factsRaw).has(n)); if (bad.length) p.push('عددهای بدون منبع'); if (ls.some((x) => countWords(x) > 32)) p.push('نکته‌ها باید کوتاه باشند'); return p; } }, 2, 400, shouldStop);
    const takeaways = (tl.value || []).slice(0, 5);

    // 6) conclusion
    tick('جمع‌بندی');
    const conRes = await attempt(gen, (fb) => ['[[TASK:conclusion]]', 'یک جمع‌بندی ۶۰ تا ۱۰۰ واژه‌ای برای مقاله‌ای با عنوان «' + title + '» بنویس که فقط نکات نوشته‌شده را مرور کند و یک گام بعدی عملی پیشنهاد دهد. اطلاعات جدید اضافه نکن.', ...RULES.map((x) => '- ' + x), 'تیترهای مقاله: ' + written.map((s) => s.heading).join(' | '), fb ? 'اشکالات قبلی: ' + fb : '', 'فقط همان جمع‌بندی را بنویس.'].filter(Boolean).join('\n'),
      { parse: (raw) => bodyText(raw, 'جمع‌بندی').replace(/\n+/g, ' ').trim() || null, problems: (t) => checkText(t, Object.assign({}, gateBase, { minWords: 50, maxWords: 140, usedOpeners: [] })) }, 3, 450, shouldStop);
    const conclusion = conRes.value || '';

    // 7) FAQ (visible on the page so FAQPage schema stays truthful)
    tick('پرسش‌های متداول');
    const faqRes = await attempt(gen, (fb) => ['[[TASK:faq]]', 'برای مقاله‌ای با عنوان «' + title + '»، ' + plan.faq + ' پرسش واقعی که کاربران می‌پرسند و پاسخ کامل ۴۰ تا ۸۰ واژه‌ای هرکدام بنویس. پاسخ‌ها فقط از متن مقالهٔ زیر یا داده‌های معتبر برگرفته شود. فقط آرایهٔ JSON به شکل [{"q":"...؟","a":"..."}] بده.', 'پرسش‌ها نباید عین تیترهای مقاله باشند.', ...RULES.map((x) => '- ' + x), 'تیترها: ' + written.map((s) => s.heading).join(' | '), 'متن مقاله (خلاصه): ' + written.map((s) => clipWords(s.text, 45)).join(' || '), general ? '' : 'داده‌های معتبر:\n' + pickFacts(ctx.chunks, title, 3), fb ? 'اشکالات قبلی: ' + fb : ''].filter(Boolean).join('\n'),
      { parse: (raw) => { const a = parseJsonArray(raw); return a ? a.map((x) => ({ q: String(x && x.q || '').trim(), a: String(x && x.a || '').replace(/\s+/g, ' ').trim() })).filter((x) => x.q && x.a) : null; },
        problems: (rows) => { const p = []; const ok = rows.filter((r) => /[؟?]$/.test(r.q) && countWords(r.a) >= 30 && countWords(r.a) <= 110 && !checkText(r.a, Object.assign({}, gateBase, { minWords: 30, maxWords: 110, usedOpeners: [], keyword: '' })).length && !written.some((s) => normText(s.heading) === normText(r.q))); if (ok.length < Math.max(2, plan.faq - 1)) p.push('پرسش‌وپاسخ‌های معتبر کافی نیست'); return p; } }, 2, 1400, shouldStop);
    const faq = (faqRes.value || []).filter((r) => /[؟?]$/.test(r.q) && countWords(r.a) >= 30 && countWords(r.a) <= 110 && !checkText(r.a, Object.assign({}, gateBase, { minWords: 30, maxWords: 110, usedOpeners: [], keyword: '' })).length && !written.some((s) => normText(s.heading) === normText(r.q))).slice(0, plan.faq + 1);
    const faqOk = faq.length >= 2;

    // 8) assemble answer-first HTML with real internal links only
    const links = Agent.suggestInternalLinks ? Agent.suggestInternalLinks({ id: 0, title, content: factsRaw }, (input.existing || []).filter((x) => x && x.url && x.title), 3) : [];
    let html = '<p>' + esc(lead) + '</p>';
    if (takeaways.length) html += '<h2>خلاصهٔ سریع</h2><ul>' + takeaways.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>';
    written.forEach((s) => { html += '<h2>' + esc(s.heading) + '</h2>' + s.html; });
    if (conclusion) html += '<h2>جمع‌بندی</h2><p>' + esc(conclusion) + '</p>';
    if (faqOk) html += '<h2>پرسش‌های متداول</h2>' + faq.map((r) => '<h3>' + esc(r.q) + '</h3><p>' + esc(r.a) + '</p>').join('');
    if (links.length) html += '<h2>مطالب مرتبط</h2><ul>' + links.map((l) => '<li><a href="' + esc(l.url) + '">' + esc(l.title) + '</a></li>').join('') + '</ul>';

    // 9) final audit
    const text = stripTags(html); const words = countWords(text);
    const h2 = (html.match(/<h2>/g) || []).length;
    const ss = sentences(text); const avgSentence = ss.length ? Math.round(words / ss.length) : 0;
    const paras = (html.match(/<p>[\s\S]*?<\/p>/g) || []).map((p) => countWords(p)); const avgPara = paras.length ? Math.round(paras.reduce((a, b) => a + b, 0) / paras.length) : 0;
    const kw = normText(keyword); const hits = kw ? normText(text).split(kw).length - 1 : 0; const density = words ? +(hits * kw.split(' ').length / words * 100).toFixed(2) : 0;
    const first100 = normText(clipWords(text, 100)).includes(kw);
    const sim = existing.map((x) => ({ title: x.title, url: x.url, score: Agent.similarityScore(text, x.text) })).sort((a, b) => b.score - a.score)[0] || { score: 0 };
    const problems = metrics.problems.slice();
    metrics.headings.final = auditHeadings(written.map((x) => x.heading), { keyword, synonyms: input.synonyms });
    metrics.headings.final.issues.forEach((x) => problems.push('تیترها: ' + x));
    lsiInfo.missing = lsiTerms.filter((t) => !hasTerm(text, t)); lsiInfo.coverage = lsiTerms.length ? Math.round(100 * (lsiTerms.length - lsiInfo.missing.length) / lsiTerms.length) : 100;
    metrics.lsi = lsiInfo;
    if (lsiInfo.missing.length) problems.push('کلمه‌های مرتبط (LSI) در مقاله نیامد: ' + lsiInfo.missing.join('، '));
    if (words < minWords) problems.push('طول نهایی ' + words + ' واژه است و به حداقل ' + minWords + ' نرسید؛ داده یا منبع بیشتری اضافه کن یا موضوع را دقیق‌تر کن (متن برای رسیدن به عدد پر نمی‌شود).');
    if (missing.length) problems.push(missing.length + ' بخش به استاندارد کیفیت نرسید و حذف شد: ' + missing.map((m) => m.heading).join('، '));
    if (!lead) problems.push('پاراگراف پاسخ مستقیم تولید نشد.');
    if (!faqOk) problems.push('پرسش‌وپاسخ معتبر کافی ساخته نشد؛ FAQ در مقاله نیامد.');
    if (!first100) problems.push('عبارت کلیدی در ۱۰۰ واژهٔ ابتدایی نیست.');
    if (density > 2.5) problems.push('تراکم عبارت کلیدی زیاد است (' + density + '٪).');
    if (sim.score >= 30) problems.push('شباهت ' + sim.score + '٪ با «' + sim.title + '» وجود دارد.');
    if (h2 < Math.min(plan.sections, 4)) problems.push('تعداد تیترهای H2 کم است.');
    if (avgSentence > 30) problems.push('میانگین طول جمله زیاد است (' + avgSentence + ' واژه).');
    const weak = written.filter((s) => s.weak).length;
    let ruleBlock = false;
    try {
      const SRw = typeof module === 'object' && module.exports ? require('./seorules.js') : ((typeof self !== 'undefined' ? self : globalThis).SI || {}).SeoRules;
      if (SRw && SRw.lintDraft) { const s0 = Agent.makeSeo(title, text, input.brand || ''); const ld = SRw.lintDraft({ title, content: html, seo_title: s0.seo_title, meta_description: s0.meta_description, focus_keyword: keyword }, { kind: 'article' }); metrics.rules = { score: ld.score, failed: ld.failed.map((x) => x.rule) }; ld.issues.forEach((x) => { if (x.rule !== 'q04') problems.push(x.detail); if (x.severity === 'major') ruleBlock = true; }); }
    } catch (e) {}
    const hardBlock = ruleBlock || words < minWords || !lead || sim.score >= 40 || written.length < Math.min(3, plan.sections);
    const status = hardBlock ? 'incomplete' : (problems.length || weak || general ? 'needs_review' : 'ready');
    const seo = Agent.makeSeo(title, text, input.brand || '');
    const notes = ['پیش از انتشار تاریخ‌ها، اعداد، نام‌ها و ادعاهای تخصصی را با منبع اصلی تطبیق بده و لینک منابع را بیفزا.'];
    if (general) notes.push('این مقاله از دانش عمومی مدل نوشته شده و داده‌ای از شما نداشته؛ بازبینی تخصصی ضروری است.');
    if (weak) notes.push(weak + ' بخش با تأخیر یا کیفیت متوسط پذیرفته شد؛ بازخوانی کن.');
    Object.assign(metrics, { words, h2, avgSentence, avgPara, density, keywordInFirst100: first100, similarity: sim.score, faq: faq.length, links: links.length, weakSections: weak, revisedSections: metrics.sections.filter((x) => x.revised).length, missingSections: missing.length });
    return {
      title, content: html, excerpt: clipWords(lead, 45), seo_title: seo.seo_title, meta_description: seo.meta_description,
      focus_keyword: keyword, related_keywords: Agent.keywords(title, text, 8), faq: faqOk ? faq : [], links, notes, status, problems, metrics,
      openers: written.map((s) => tokens(s.text).slice(0, 3).join(' ')).filter(Boolean),
    };
  }

  return { PLANS, HARD_MIN_WORDS, detectIntent, planOutline, checkText, countWords, writeArticle, toHtml, numbersIn, lsiCandidates, assignLsi, auditHeadings, improveHeadings };
});
