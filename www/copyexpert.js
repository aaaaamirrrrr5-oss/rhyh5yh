/* Site Inspector — copyexpert.js (v1.85.0 · پنل از v1.86.0 از سایت می‌خواند)  SI.CopyExpert
 * «استاد سئو و متن‌نویسی سئو»: ممیزی و آموزشِ متنِ فارسی، کاملاً آفلاین و بدون مدل زبانی.
 *  - نیت جستجوی کلیدواژه (اطلاعاتی / تجاری / تراکنشی / محلی / ناوبری) و نقشهٔ ساختار مناسب هر نیت
 *  - ممیزی متن: جای‌گیری کلیدواژه، سرآغاز (lead)، ساختار و تیتر، سبک و خوانایی، ادعاهای بی‌پشتوانه،
 *    عنوان و متا، نشانه‌های تجربه/شواهد (E-E-A-T)، پیوند و تصویر، نیم‌فاصله و نویسه‌های عربی
 *  - امتیاز ۰ تا ۱۰۰ + فهرست اصلاح‌های اولویت‌دار (هر مورد با «چرا» و «چطور»)
 *  - پیشنهاد عنوان و متا فقط با واقعیت‌هایی که کاربر می‌دهد؛ جای خالی در «برای تکمیل» می‌آید
 *  - بریف نوشتن (سرفصل‌های پیشنهادی، پرسش‌ها، واقعیت‌هایی که باید جمع شود)
 * اصل‌ها: هیچ عدد، سابقه، قیمت، گارانتی یا ادعایی ساخته نمی‌شود؛ هیچ رتبه‌ای تضمین نمی‌شود؛
 * امتیاز یک راهنمای ویرایش است نه پیش‌بینی گوگل. هیچ‌چیز در سایت نوشته نمی‌شود. UMD. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./fatext.js'), require('./seopolicy.js'));
  else (root.SI = root.SI || {}).CopyExpert = factory(root.FaText, root.SI && root.SI.SeoPolicy);
})(typeof self !== 'undefined' ? self : this, function (FaText, Policy) {
  'use strict';
  const ZW = '\u200c';
  const FA_D = '۰۱۲۳۴۵۶۷۸۹', AR_D = '٠١٢٣٤٥٦٧٨٩';

  /* ---------- ابزارهای متنی ---------- */
  const nz = (s) => String(s == null ? '' : s).replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[ۀة]/g, 'ه')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[٠-٩]/g, (d) => AR_D.indexOf(d)).replace(/[۰-۹]/g, (d) => FA_D.indexOf(d)).toLowerCase();
  /** متن تخت: نرمال‌شده، نیم‌فاصله و نشانه‌ها → فاصله. برای تطبیق عبارت‌ها. */
  const flat = (s) => nz(s).replace(/\u200c/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const words = (s) => { const f = flat(s); return f ? f.split(' ') : []; };
  const stem = (w) => { try { return String(FaText.stem(w)).split(ZW).join('') || w; } catch (e) { return w; } };
  const stems = (s) => words(s).map(stem);
  const has = (hay, phrase) => (' ' + flat(hay) + ' ').indexOf(' ' + flat(phrase) + ' ') >= 0;
  const hasAny = (hay, list) => list.some((p) => has(hay, p));
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const fa = (n) => String(n).replace(/\d/g, (d) => FA_D[d]);
  const STOPW = new Set(['و', 'در', 'از', 'به', 'با', 'برای', 'که', 'یک', 'این', 'آن', 'را', 'یا', 'تا', 'بر', 'هم', 'های', 'ها']);
  const contentStems = (s) => stems(s).filter((w) => w.length >= 2 && !STOPW.has(w));

  /** تعداد وقوع عبارت (ترتیب‌دار، مستقل از ریشهٔ ساده: ها/ی/ان …) در فهرست ریشه‌ها. */
  function countPhrase(textStems, kwStems) {
    if (!kwStems.length) return 0; let c = 0;
    for (let i = 0; i + kwStems.length <= textStems.length; i++) {
      let ok = true; for (let j = 0; j < kwStems.length; j++) if (textStems[i + j] !== kwStems[j]) { ok = false; break; }
      if (ok) { c++; i += kwStems.length - 1; }
    }
    return c;
  }
  /** عبارت کامل یا دست‌کم ۶۰٪ واژه‌های معنادار آن (برای تیتر و عنوان). */
  function mentions(text, kw) {
    const ts = stems(text), ks = stems(kw);
    if (countPhrase(ts, ks)) return 'exact';
    const need = contentStems(kw); if (!need.length) return '';
    const set = new Set(ts); const hit = need.filter((w) => set.has(w)).length;
    return hit / need.length >= 0.6 ? 'partial' : '';
  }

  /* ---------- پارس ورودی (HTML، Markdown ساده یا متن) ---------- */
  function parse(input) {
    const raw = String(input == null ? '' : input);
    const html = /<\/?(p|h[1-6]|ul|ol|li|div|a|img|table|section|article)\b/i.test(raw);
    const blocks = [], links = [], images = [];
    let tables = 0, lists = 0;
    const T = (h) => FaText.htmlToText(h).replace(/\s+/g, ' ').trim();
    if (html) {
      const re = /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>|<p\b[^>]*>([\s\S]*?)<\/p>|<li\b[^>]*>([\s\S]*?)<\/li>|<table\b/gi; let m;
      while ((m = re.exec(raw))) {
        if (m[1]) { const t = T(m[2]); if (t) blocks.push({ t: 'h', l: +m[1][1], text: t }); }
        else if (m[3] != null) { const t = T(m[3]); if (t) blocks.push({ t: 'p', text: t }); }
        else if (m[4] != null) { const t = T(m[4]); if (t) blocks.push({ t: 'li', text: t }); }
        else tables++;
      }
      lists = (raw.match(/<(ul|ol)\b/gi) || []).length;
      const ra = /<a\b[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi; let a;
      while ((a = ra.exec(raw))) links.push({ href: a[1].trim(), text: T(a[2]) });
      (raw.match(/<img\b[^>]*>/gi) || []).forEach((tag) => { const al = tag.match(/\balt\s*=\s*["']([^"']*)["']/i); images.push({ alt: al ? al[1].trim() : '' }); });
    } else {
      let buf = [];
      const flush = () => { if (buf.length) { blocks.push({ t: 'p', text: buf.join(' ').trim() }); buf = []; } };
      raw.split(/\r?\n/).forEach((line) => {
        const l = line.trim(); let m;
        if (!l) return flush();
        if ((m = l.match(/^(#{1,6})\s+(.+)$/))) { flush(); blocks.push({ t: 'h', l: m[1].length, text: m[2].trim() }); }
        else if (/^([-*•]|\d+[.)])\s+/.test(l)) { flush(); blocks.push({ t: 'li', text: l.replace(/^([-*•]|\d+[.)])\s+/, '') }); }
        else if (/^\|.*\|$/.test(l)) { flush(); if (!/^\|[\s:|-]+\|$/.test(l)) tables = Math.max(tables, 1); }
        else buf.push(l);
      });
      flush();
      for (let i = 1; i < blocks.length; i++) if (blocks[i].t === 'li' && blocks[i - 1].t !== 'li') lists++;
      if (blocks[0] && blocks[0].t === 'li') lists++;
      const rm = /\[([^\]]+)\]\(([^)\s]+)\)/g; let k; while ((k = rm.exec(raw))) links.push({ href: k[2], text: k[1] });
    }
    const body = blocks.filter((b) => b.t !== 'h').map((b) => b.text).join('\n');
    return { html, blocks, links, images, tables, lists, headings: blocks.filter((b) => b.t === 'h'), paragraphs: blocks.filter((b) => b.t === 'p'), body };
  }

  /* ---------- نیت جستجو ---------- */
  const INTENTS = {
    info: { label: 'اطلاعاتی', icon: '📘', hint: 'کاربر می‌خواهد بداند یا یاد بگیرد؛ پاسخ مستقیم و آموزش مرحله‌ای بنویس.' },
    commercial: { label: 'بررسی و مقایسه (پیش از خرید)', icon: '⚖️', hint: 'کاربر گزینه‌ها را می‌سنجد؛ معیار انتخاب، مقایسهٔ منصفانه و «مناسب چه کسی است» بنویس.' },
    transactional: { label: 'خرید و اقدام', icon: '🛒', hint: 'کاربر آمادهٔ اقدام است؛ مزیت واقعی، اعتمادسازی و دکمهٔ روشن بساز.' },
    local: { label: 'محلی', icon: '📍', hint: 'کاربر مکان یا خدمت نزدیک می‌خواهد؛ نشانی، ساعت و تماس واقعی بنویس.' },
    nav: { label: 'ناوبری', icon: '🧭', hint: 'کاربر دنبال یک سایت یا صفحهٔ مشخص است؛ نام برند و مسیر روشن بده.' },
  };
  const INTENT_WORDS = {
    info: ['چیست', 'چیه', 'چگونه', 'چطور', 'چطوری', 'آموزش', 'راهنما', 'علت', 'دلیل', 'چرا', 'تفاوت', 'معنی', 'مفهوم', 'فواید', 'مزایا', 'مضرات', 'عوارض', 'نحوه', 'روش', 'مراحل', 'کاربرد', 'تعریف', 'انواع', 'نکات', 'اصول', 'ترفند', 'آیا', 'چه کسی', 'کی', 'چند', 'how', 'what', 'why', 'guide', 'tutorial'],
    commercial: ['بهترین', 'مقایسه', 'بررسی', 'نقد', 'رتبه بندی', 'برترین', 'مناسب', 'راهنمای خرید', 'معرفی', 'مدل', 'برند', 'در برابر', 'یا', 'vs', 'review', 'best', 'top', 'جایگزین', 'مزایا و معایب'],
    transactional: ['خرید', 'قیمت', 'سفارش', 'فروش', 'تخفیف', 'ارزان', 'اقساطی', 'ثبت نام', 'دانلود', 'کد تخفیف', 'فروشگاه', 'خریداری', 'رزرو', 'نمایندگی', 'عمده', 'بلیط', 'buy', 'price', 'order', 'shop', 'coupon', 'download'],
    local: ['نزدیک من', 'نزدیک', 'آدرس', 'شعبه', 'تلفن', 'ساعت کاری', 'در تهران', 'در مشهد', 'در اصفهان', 'در شیراز', 'در تبریز', 'در کرج', 'در قم', 'در اهواز', 'در رشت', 'در یزد', 'در کرمان', 'در کیش', 'near me'],
    nav: ['سایت رسمی', 'ورود', 'لاگین', 'پنل کاربری', 'ثبت نام در', 'اپلیکیشن', 'login', 'official', 'سایت'],
  };
  function intent(keyword) {
    const f = flat(keyword); const score = { info: 0, commercial: 0, transactional: 0, local: 0, nav: 0 }; const signals = [];
    Object.keys(INTENT_WORDS).forEach((k) => INTENT_WORDS[k].forEach((w) => { if ((' ' + f + ' ').indexOf(' ' + flat(w) + ' ') >= 0) { score[k] += w.indexOf(' ') >= 0 ? 2 : 1; signals.push(w); } }));
    // «قیمت/خرید» همراه «بهترین» هنوز تراکنشی است؛ «بهترین … برای» تجاری.
    if (score.transactional && score.commercial && score.transactional >= score.commercial) score.commercial = Math.max(0, score.commercial - 1);
    const order = ['transactional', 'local', 'commercial', 'info', 'nav'];
    let best = 'info', bs = 0; order.forEach((k) => { if (score[k] > bs) { best = k; bs = score[k]; } });
    const total = Object.values(score).reduce((a, b) => a + b, 0);
    const conf = bs === 0 ? 0.3 : clamp01(bs / Math.max(1, total) * (bs >= 2 ? 1 : 0.8));
    const second = order.filter((k) => k !== best && score[k] > 0).sort((a, b) => score[b] - score[a])[0] || null;
    return { id: best, label: INTENTS[best].label, icon: INTENTS[best].icon, hint: INTENTS[best].hint, confidence: +conf.toFixed(2), signals, secondary: second, guessed: bs === 0, note: bs === 0 ? 'نشانهٔ روشنی در عبارت نیست؛ «اطلاعاتی» فرض شد. نتیجهٔ واقعی گوگل را برای همین عبارت نگاه کن.' : '' };
  }
  const BLUEPRINTS = {
    info: [['lead', 'پاسخ مستقیم در ۲۵ تا ۶۰ واژه (کلیدواژه در همین پاراگراف)', 'سرآغاز'], ['takeaways', 'نکته‌های کلیدی در فهرست کوتاه', 'اسکن‌پذیری'], ['sections', 'چند H2 که هرکدام یک زیرپرسش را کامل جواب دهد', 'عمق'], ['steps', 'اگر فرایند است: مراحل شمارهٔ‌دار با نتیجهٔ هر مرحله', 'کاربردی‌بودن'], ['evidence', 'عدد، مثال واقعی یا منبع معتبر کنار ادعاها', 'اعتماد'], ['faq', 'پرسش‌های متداول با پاسخ کوتاه زیر هر پرسش', 'AEO'], ['close', 'جمع‌بندی و قدم بعدی', 'پایان']],
    commercial: [['lead', 'برای چه کسی و چه معیاری مهم است (در ۲۵ تا ۶۰ واژه)', 'سرآغاز'], ['criteria', 'معیارهای انتخاب با توضیح اثر هرکدام', 'معیار'], ['compare', 'جدول مقایسهٔ منصفانه با ویژگی‌های واقعی', 'مقایسه'], ['proscons', 'مزایا و معایب هر گزینه (معایب را هم بنویس)', 'صداقت'], ['who', '«مناسب چه کسی است / مناسب چه کسی نیست»', 'تصمیم'], ['evidence', 'تجربهٔ واقعی، آزمون یا منبع', 'اعتماد'], ['faq', 'پرسش‌های پیش از خرید', 'AEO'], ['cta', 'قدم بعدی روشن', 'اقدام']],
    transactional: [['lead', 'مزیت اصلی و برای چه کسی (بدون ادعای تأییدنشده)', 'سرآغاز'], ['specs', 'مشخصات واقعی به‌صورت جدول یا فهرست', 'اطلاعات'], ['trust', 'ارسال، مرجوعی، گارانتی و پرداخت (فقط واقعیت‌های موجود)', 'اعتماد'], ['usecases', 'کاربردها و راهنمای انتخاب', 'تصمیم'], ['faq', 'پرسش‌های قبل از سفارش', 'AEO'], ['cta', 'دکمه و جملهٔ اقدام روشن', 'اقدام']],
    local: [['lead', 'چه خدمتی، کجا، برای چه کسی', 'سرآغاز'], ['nap', 'نشانی، تلفن و ساعت کاری واقعی (یکسان با نقشه و گوگل بیزینس)', 'NAP'], ['services', 'خدمات یا محصولات با جزئیات', 'اطلاعات'], ['proof', 'نمونه‌کار، نظر واقعی مشتری یا مجوز', 'اعتماد'], ['faq', 'پرسش‌های محلی (پارکینگ، رزرو، ساعت)', 'AEO'], ['cta', 'تماس یا مسیریابی', 'اقدام']],
    nav: [['lead', 'نام برند و کار آن در یک جمله', 'سرآغاز'], ['paths', 'پیوندهای روشن به بخش‌های اصلی', 'مسیر'], ['trust', 'اطلاعات تماس و هویت', 'اعتماد']],
  };

  /* ---------- فهرست‌های سبک و ادعا ---------- */
  const FILLER = ['در دنیای امروز', 'در دنیای امروزی', 'امروزه', 'در عصر حاضر', 'در عصر کنونی', 'همان طور که می دانید', 'همانطور که می دانید', 'همان گونه که می دانید', 'لازم به ذکر است', 'لازم به توضیح است', 'بدیهی است', 'بی شک', 'بدون شک', 'بدون تردید', 'نکته قابل توجه این است که', 'نکته جالب اینجاست که', 'در این مقاله می خواهیم', 'در این مقاله به بررسی', 'در این مطلب به بررسی', 'در ادامه مطلب با ما همراه باشید', 'با ما همراه باشید', 'تا انتها با ما باشید', 'شایان ذکر است', 'شایان توجه است', 'نیازی به گفتن نیست', 'کیفیت بی نظیر', 'همه ما می دانیم'];
  const LEAD_FILLER = ['امروزه', 'در دنیای امروز', 'در دنیای امروزی', 'در عصر حاضر', 'در عصر کنونی', 'همان طور که می دانید', 'همانطور که می دانید', 'همه ما می دانیم', 'در این مقاله', 'در این مطلب', 'سلام', 'خوش آمدید'];
  const CLAIMS = ['بهترین', 'ارزان ترین', 'با کیفیت ترین', 'برترین', 'بی نظیر', 'بی رقیب', 'بدون رقیب', 'رتبه یک', 'رتبه اول', 'شماره یک', 'تنها', 'تضمین', 'تضمینی', '100 درصد', '100', 'معجزه', 'اورجینال', 'کاملا اصل', 'اصل و اورجینال', 'بی عیب', 'بدون هیچ عیب'];
  const CLAIM_PHRASES = CLAIMS.filter((c) => c !== '100');
  const EVIDENCE_CUES = ['طبق', 'بر اساس', 'براساس', 'مطابق', 'آزمون', 'تست', 'گزارش', 'منبع', 'مستند', 'پژوهش', 'تحقیق', 'گواهی', 'استاندارد', 'آزمایش'];
  const CTA = ['بخرید', 'خرید کنید', 'سفارش دهید', 'سفارش بدهید', 'همین حالا', 'همین امروز', 'تماس بگیرید', 'مشاوره بگیرید', 'ثبت نام کنید', 'رزرو کنید', 'دریافت کنید', 'امتحان کنید', 'مشاهده کنید', 'ببینید', 'بخوانید', 'مشاوره رایگان', 'درخواست دهید', 'ثبت سفارش', 'اضافه کنید به سبد', 'شروع کنید'];
  const CLOSE_HEAD = ['نتیجه گیری', 'جمع بندی', 'سخن پایانی', 'خلاصه', 'سخن آخر', 'کلام آخر', 'در یک نگاه', 'پیشنهاد نهایی'];
  const GENERIC_ANCHOR = ['اینجا', 'کلیک کنید', 'کلیک', 'ادامه مطلب', 'بیشتر بخوانید', 'مشاهده', 'لینک', 'این لینک', 'بیشتر', 'click here', 'here', 'read more', 'more'];
  const EXP_CUES = ['تجربه', 'آزمایش کردیم', 'امتحان کردیم', 'بررسی کردیم', 'سنجیدیم', 'خودمان', 'در عمل', 'از نزدیک', 'مشتریان ما', 'در فروشگاه ما', 'در تجربه ما', 'در آزمون ما', 'نمونه واقعی', 'سال سابقه', 'سال است که', 'به کار گرفتیم', 'استفاده کردیم', 'نصب کردیم', 'خریدیم', 'ساختیم'];
  const SRC_CUES = ['طبق', 'بر اساس', 'براساس', 'مطابق', 'منبع', 'گزارش', 'پژوهش', 'تحقیق', 'مطالعه', 'آمار'];
  const FRESH_CUES = ['به روزرسانی', 'بروزرسانی', 'آخرین ویرایش', 'تاریخ انتشار', 'نویسنده', 'نوشته', 'تهیه شده', 'بازبینی'];
  const BAIT = ['شوکه', 'باور نمی کنید', 'باورنکردنی', 'فاش شد', 'قبل از اینکه دیر شود', 'حتما ببینید', 'بی نهایت', 'معجزه', 'اگر این را نخوانید', 'راز'];
  const POWER = ['راهنما', 'آموزش', 'مقایسه', 'قیمت', 'لیست', 'مرحله به مرحله', 'مرحله ای', 'کامل', 'رایگان', 'نکات', 'روش', 'روش ها', 'چک لیست', 'چیست', 'چگونه', 'انتخاب', 'خرید', 'مزایا', 'معایب', 'بررسی'];
  const META_ACTION = ['بخوانید', 'ببینید', 'بیاموزید', 'یاد بگیرید', 'بخرید', 'سفارش', 'مقایسه کنید', 'دریافت کنید', 'کشف کنید', 'مشاهده کنید', 'انتخاب کنید', 'بدانید', 'تماس بگیرید', 'رزرو کنید', 'مشاوره', 'همین حالا', 'جزئیات', 'مراحل'];
  const QUESTION_STARTS = ['چرا', 'چگونه', 'چطور', 'چیست', 'آیا', 'کدام', 'چه ', 'چند', 'کی ', 'کجا', 'چه کسی'];
  const isQuestion = (t) => /[؟?]\s*$/.test(String(t).trim()) || QUESTION_STARTS.some((q) => flat(t).split(' ').slice(0, 3).join(' ').indexOf(flat(q)) >= 0 || flat(t).endsWith(' چیست') || flat(t).endsWith(' چیه'));

  /* ---------- نیم‌فاصله و نویسه‌ها ---------- */
  const TYPO_RULES = [
    { id: 'ar_chars', label: 'ی/ک عربی (ي، ك)', re: /[يكى]/g },
    { id: 'mi_space', label: 'فاصله به‌جای نیم‌فاصله بعد از «می/نمی»', re: /(^|[\s(«"])(ن?می) (?=[\u0600-\u06FF])/g },
    { id: 'ha_space', label: 'فاصله پیش از «ها/های» (کتاب ها ← کتاب‌ها)', re: /([\u0600-\u06FF]) (ها|های|هایی|هایش|هایم|هایت|هایمان)(?=[\s.،؛:!؟)»"]|$)/g },
    { id: 'mixed_digits', label: 'ترکیب ارقام فارسی و لاتین در یک متن', test: (t) => /[۰-۹]/.test(t) && /[0-9]/.test(t) },
    { id: 'double_space', label: 'فاصلهٔ دوبل', re: / {2,}/g },
    { id: 'latin_punct', label: 'ویرگول/نقطه‌ویرگول لاتین بین واژه‌های فارسی', re: /[\u0600-\u06FF][,;]\s*(?=[\u0600-\u06FF])/g },
  ];
  function typography(text) {
    const t = String(text == null ? '' : text); const out = [];
    TYPO_RULES.forEach((r) => {
      let n = 0;
      if (r.test) n = r.test(t) ? 1 : 0; else { const m = t.match(r.re); n = m ? m.length : 0; }
      if (n) out.push({ id: r.id, label: r.label, count: n });
    });
    return out;
  }
  /** فقط اصلاح‌های بی‌خطر: ی/ک عربی، «می ‌» و «ها» با نیم‌فاصله، فاصلهٔ دوبل. ارقام و نشانه‌ها دست‌نخورده. */
  function fixTypography(text) {
    return String(text == null ? '' : text).replace(/ي/g, 'ی').replace(/ك/g, 'ک')
      .replace(/(^|[\s(«"])(ن?می) (?=[\u0600-\u06FF])/g, '$1$2' + ZW)
      .replace(/([\u0600-\u06FF]) (ها|های|هایی|هایش|هایم|هایت|هایمان)(?=[\s.،؛:!؟)»"]|$)/g, '$1' + ZW + '$2')
      .replace(/([^\s]) {2,}/g, '$1 ');
  }

  /* ---------- ممیزی ---------- */
  const CATS = { kw: 'جای‌گیری کلیدواژه', lead: 'سرآغاز و پایان', struct: 'ساختار و تیتر', style: 'سبک و خوانایی', claims: 'ادعاها و صداقت', serp: 'عنوان و متا', eeat: 'تجربه و شواهد', links: 'پیوند و تصویر' };

  function analyze(input) {
    const o = input || {}; const doc = parse(o.text || o.html || o.content || '');
    const kw = String(o.keyword || '').trim();
    const title = String(o.title || '').trim(), meta = String(o.meta || o.description || '').trim();
    const h1Block = doc.headings.find((h) => h.l === 1); const h1 = String(o.h1 || (h1Block && h1Block.text) || '').trim();
    const nWords = words(doc.body).length;
    const it = kw ? intent(kw) : null; const iid = it ? it.id : 'info';
    const checks = [], skipped = [];
    const add = (id, cat, w, pass, label, d) => { checks.push(Object.assign({ id, cat, w, pass: clamp01(pass), label }, d || {})); };
    const skip = (id, why) => skipped.push({ id, why });
    if (nWords < 30 && !title && !meta) return { ok: false, why: 'متن یا عنوان برای ممیزی کافی نیست؛ دست‌کم یک پاراگراف یا عنوان بده.', words: nWords };
    const thin = nWords < 120;

    const ks = stems(kw), allStems = stems(doc.body), bodyAll = doc.blocks.map((b) => b.text).join('\n');
    const kwCount = kw ? countPhrase(allStems, ks) : 0;
    const density = kw && nWords ? (kwCount * ks.length / nWords) * 100 : 0;
    const paras = doc.paragraphs; const firstP = paras[0] ? paras[0].text : '';
    const lead100 = words(doc.body).slice(0, 100).join(' ');

    /* — جای‌گیری کلیدواژه — */
    if (kw) {
      if (title) { const m = mentions(title, kw); const atStart = countPhrase(stems(title).slice(0, ks.length + 2), ks) > 0; add('kw_title', 'kw', 6, m === 'exact' ? 1 : m === 'partial' ? 0.6 : 0, 'کلیدواژه در عنوان سئو', { detail: m ? (atStart ? 'در ابتدای عنوان آمده؛ خوب است.' : 'در عنوان هست؛ نزدیک‌تر به ابتدا بهتر دیده می‌شود.') : 'در عنوان نیست.', how: 'کلیدواژهٔ اصلی را یک‌بار و طبیعی، ترجیحاً نزدیک ابتدای عنوان بیاور.', why: 'عنوان اولین چیزی است که گوگل و کاربر برای تطبیق نتیجه با جست‌وجو می‌بیند.' }); } else skip('kw_title', 'عنوان سئو داده نشد.');
      if (h1) { const m = mentions(h1, kw); add('kw_h1', 'kw', 4, m === 'exact' ? 1 : m === 'partial' ? 0.7 : 0, 'کلیدواژه در H1', { detail: m ? '' : 'H1 با کلیدواژه ارتباط روشنی ندارد.', how: 'H1 را طوری بنویس که موضوع اصلی را بدون تکرار مکانیکی نشان دهد.', why: 'H1 مرز موضوعی صفحه است؛ ناهمخوانی با عنوان کاربر را گیج می‌کند.' }); } else skip('kw_h1', 'H1 پیدا نشد.');
      if (meta) { const m = mentions(meta, kw); add('kw_meta', 'kw', 3, m === 'exact' ? 1 : m === 'partial' ? 0.6 : 0, 'کلیدواژه در متا', { detail: m ? '' : 'در متا نیست؛ گوگل واژه‌های جست‌وجو را در خلاصه پررنگ می‌کند.', how: 'در یک جملهٔ طبیعی کلیدواژه را بیاور و مزیت صفحه را بگو.', why: 'متای هم‌خوان با جست‌وجو می‌تواند کلیک را بیشتر کند (تأثیر مستقیم بر رتبه ندارد).' }); } else skip('kw_meta', 'متا داده نشد.');
      add('kw_lead', 'kw', 5, mentions(lead100, kw) ? 1 : 0, 'کلیدواژه در ۱۰۰ واژهٔ نخست', { detail: mentions(lead100, kw) ? '' : 'در آغاز متن نیامده.', how: 'پاراگراف اول را با پاسخ مستقیم به همان عبارت شروع کن.', why: 'کاربر و موتورهای پاسخ‌گو در همان ابتدا به‌دنبال تأیید موضوع‌اند.' });
      const hs = doc.headings.filter((h) => h.l >= 2 && h.l <= 3);
      if (hs.length) {
        const ex = hs.filter((h) => mentions(h.text, kw) === 'exact').length, pt = hs.filter((h) => mentions(h.text, kw)).length;
        add('kw_h2', 'kw', 3, pt ? 1 : 0, 'کلیدواژه یا هم‌خانوادهٔ آن در زیرتیترها', { detail: pt ? '' : 'هیچ زیرتیتری به موضوع اصلی اشاره نمی‌کند.', how: 'دست‌کم در یکی دو زیرتیتر، شکل‌های طبیعی و متفاوت عبارت را بیاور.', why: 'زیرتیترها ساختار موضوعی صفحه را برای خواننده و خزنده روشن می‌کنند.' });
        const over = hs.length >= 3 ? ex / hs.length : 0;
        add('kw_h2_over', 'kw', 3, over > 0.6 ? 0.2 : over > 0.4 ? 0.7 : 1, 'عدم تکرار مکانیکی عبارت در زیرتیترها', { detail: over > 0.4 ? fa(Math.round(over * 100)) + '٪ زیرتیترها عین عبارت را دارند.' : '', how: 'زیرتیترها را با زیرپرسش‌ها و واژه‌های هم‌معنی تنوع بده.', why: 'تکرار یکنواخت نشانهٔ کلمه‌چینی است و خواندن را خسته می‌کند.' });
      } else if (nWords >= 250) skip('kw_h2', 'زیرتیتر وجود ندارد (در بخش ساختار گزارش می‌شود).');
      const dPass = kwCount === 0 ? 0 : density < 0.4 ? 0.5 : density <= 2.5 ? 1 : density <= 3.5 ? 0.5 : 0;
      if (nWords >= 40) add('kw_density', 'kw', 4, dPass, 'تراکم کلیدواژه', { detail: kwCount ? 'تراکم ' + fa(density.toFixed(1)) + '٪ (' + fa(kwCount) + ' بار)؛ بازهٔ آرام ۰٫۴ تا ۲٫۵٪.' : 'عین عبارت در متن نیامده.', how: density > 2.5 ? 'برخی تکرارها را با ضمیر، هم‌معنی یا عبارت‌های وابسته عوض کن.' : 'عبارت را در سرآغاز، یکی دو بخش میانی و جمع‌بندی طبیعی بیاور.', why: 'تکرار بیش‌ازحد با سیاست اسپم گوگل (keyword stuffing) در تضاد است؛ نبودنش هم موضوع را مبهم می‌کند.' }); else skip('kw_density', 'متن برای سنجش تراکم کوتاه است.');
      const lastP = paras.length ? paras[paras.length - 1].text : '';
      if (nWords >= 250) add('kw_end', 'kw', 1, mentions(lastP, kw) || doc.headings.some((h) => hasAny(h.text, CLOSE_HEAD) && mentions(h.text, kw)) ? 1 : 0.5, 'یادآوری موضوع در پایان', { detail: '', how: 'جمع‌بندی را با اشاره‌ای طبیعی به موضوع اصلی ببند.', why: 'پایان روشن، بازگشت به نیت جست‌وجو را کامل می‌کند.' });
    } else skip('kw_*', 'کلیدواژه داده نشد؛ بخش جای‌گیری سنجیده نشد.');

    /* — سرآغاز و پایان — */
    if (paras.length) {
      const fw = words(firstP).length;
      add('lead_answer', 'lead', 5, fw >= 20 && fw <= 70 ? 1 : fw > 70 && fw <= 100 ? 0.6 : fw < 20 ? 0.5 : 0.2, 'پاراگراف اول پاسخ‌محور و کوتاه', { detail: 'پاراگراف اول ' + fa(fw) + ' واژه است (هدف ۲۰ تا ۷۰).', how: 'همان ابتدا بگو موضوع چیست و کاربر چه چیزی به دست می‌آورد؛ تاریخچه و مقدمه‌چینی را به بعد ببر.', why: 'پاسخ مستقیم در ابتدا هم رضایت خواننده را بالا می‌برد و هم متن را برای خلاصه‌های هوش مصنوعی و قطعهٔ برگزیده مناسب می‌کند.' });
      const lf = LEAD_FILLER.find((p) => (' ' + flat(firstP).split(' ').slice(0, 6).join(' ') + ' ').indexOf(' ' + flat(p) + ' ') >= 0);
      add('lead_filler', 'lead', 4, lf ? 0 : 1, 'شروع بدون مقدمهٔ کلیشه‌ای', { detail: lf ? 'آغاز با «' + lf + '».' : '', how: 'جملهٔ اول را مستقیم به موضوع بده؛ «امروزه» و «در این مقاله» را حذف کن.', why: 'مقدمه‌های تکراری ارزشی اضافه نمی‌کنند و خواننده را از همان ابتدا از دست می‌دهند.' });
      const tail = words(doc.body); const lastQuarter = tail.slice(Math.floor(tail.length * 0.75)).join(' ');
      const closeHead = doc.headings.some((h) => hasAny(h.text, CLOSE_HEAD)); const cta = hasAny(lastQuarter, CTA);
      const needCta = iid === 'transactional' || iid === 'commercial' || iid === 'local';
      if (nWords >= 150) add('close_cta', 'lead', needCta ? 4 : 2, needCta ? (cta ? 1 : closeHead ? 0.4 : 0) : (cta || closeHead ? 1 : 0.4), needCta ? 'فراخوان اقدام روشن در پایان' : 'جمع‌بندی یا قدم بعدی', { detail: needCta ? 'نیت «' + it.label + '» نیاز به اقدام روشن دارد.' : '', how: needCta ? 'یک جملهٔ اقدام صریح و صادق بنویس (مثلاً سفارش، تماس یا رزرو) و پیوندش را بده.' : 'با یک جمع‌بندی کوتاه یا «قدم بعدی» متن را ببند.', why: 'کاربر بدون مسیر بعدی از صفحه خارج می‌شود.' });
    } else skip('lead_*', 'پاراگرافی برای سنجش سرآغاز پیدا نشد.');

    /* — ساختار و تیتر — */
    const h2n = doc.headings.filter((h) => h.l === 2).length;
    if (nWords >= 250) {
      const expect = Math.max(2, Math.floor(nWords / 450));
      add('h2_count', 'struct', 4, h2n >= expect ? 1 : h2n / expect, 'تعداد کافی زیرتیتر (H2)', { detail: fa(h2n) + ' زیرتیتر برای ' + fa(nWords) + ' واژه؛ دست‌کم ' + fa(expect) + ' بهتر است.', how: 'متن را با H2‌هایی که هرکدام یک زیرپرسش را جواب می‌دهند تقسیم کن.', why: 'خواننده پیش از خواندن، متن را اسکن می‌کند؛ تیتر نقشهٔ آن است.' });
    } else skip('h2_count', 'متن کوتاه است.');
    if (doc.headings.length) {
      let skipLvl = 0, prev = 0; doc.headings.forEach((h) => { if (prev && h.l > prev + 1) skipLvl++; prev = h.l; });
      const h1n = doc.headings.filter((h) => h.l === 1).length;
      add('heading_order', 'struct', 2, skipLvl === 0 && h1n <= 1 ? 1 : skipLvl + (h1n > 1 ? 1 : 0) >= 2 ? 0 : 0.5, 'ترتیب منطقی تیترها', { detail: (skipLvl ? 'پرش از سطح ' + 'تیتر در ' + fa(skipLvl) + ' جا. ' : '') + (h1n > 1 ? fa(h1n) + ' عدد H1 دارد.' : ''), how: 'یک H1، سپس H2 و فقط در صورت نیاز H3 زیر هر H2 (بدون پرش).', why: 'سلسله‌مراتب درست دسترس‌پذیری و فهم ساختار را بهتر می‌کند.' });
    }
    if (paras.length >= 3) {
      const long = paras.filter((p) => words(p.text).length > 110).length / paras.length;
      add('para_len', 'struct', 3, long === 0 ? 1 : long < 0.34 ? 1 - long * 1.5 : 0, 'پاراگراف‌های کوتاه و اسکن‌پذیر', { detail: long ? fa(Math.round(long * 100)) + '٪ پاراگراف‌ها بیش از ۱۱۰ واژه‌اند.' : '', how: 'هر پاراگراف یک ایده؛ طولانی‌ها را بشکن.', why: 'توده‌های بلند متن روی موبایل خوانده نمی‌شوند.' });
    }
    if (nWords > 600) add('scannable', 'struct', 2, doc.lists + doc.tables > 0 ? 1 : 0.3, 'فهرست یا جدول برای اطلاعات مقایسه‌ای', { detail: doc.lists + doc.tables ? '' : 'متن بلند است و هیچ فهرست یا جدولی ندارد.', how: 'ویژگی‌ها، مراحل و مقایسه‌ها را به فهرست یا جدول تبدیل کن.', why: 'اطلاعات ساختارمند هم برای خواننده و هم برای استخراج پاسخ سریع‌تر است.' });
    const qH = doc.headings.filter((h) => h.l >= 2 && isQuestion(h.text));
    let aeoOk = 0; qH.forEach((h) => { const i = doc.blocks.indexOf(h); const nxt = doc.blocks.slice(i + 1).find((b) => b.t === 'p'); if (nxt) { const n = words(nxt.text).length; if (n >= 20 && n <= 80) aeoOk++; } });
    if (nWords >= 250) add('faq_aeo', 'struct', iid === 'info' || iid === 'commercial' ? 3 : 1, qH.length >= 2 ? (aeoOk >= Math.min(2, qH.length) ? 1 : 0.7) : qH.length === 1 ? 0.5 : 0, 'پرسش‌وپاسخ کوتاه (برای AEO/GEO)', { detail: qH.length ? fa(qH.length) + ' تیتر پرسشی؛ ' + fa(aeoOk) + ' مورد پاسخ ۲۰ تا ۸۰ واژه‌ای مستقیم دارد.' : 'تیتر پرسشی ندارد.', how: 'پرسش‌های واقعی کاربران را تیتر کن و بلافاصله زیرش پاسخ ۲۰ تا ۸۰ واژه‌ای بنویس.', why: 'پاسخ کوتاه و مستقل، احتمال نقل در خلاصه‌های AI و قطعهٔ برگزیده را بیشتر می‌کند (تضمینی نیست).' });

    /* — سبک و خوانایی — */
    if (nWords >= 40) {
      let rd = null; try { rd = FaText.readability(doc.body); } catch (e) { rd = null; }
      if (!thin && rd && rd.ok && rd.score != null) add('readability', 'style', 5, rd.score / 100, 'خوانایی', { detail: 'امتیاز ' + fa(Math.round(rd.score)) + ' از ۱۰۰. ' + (rd.notes || []).slice(0, 2).join(' '), how: 'جمله‌ها را به ۱۲ تا ۱۸ واژه برسان و واژه‌های سنگین را ساده کن.', why: 'خوانایی بالاتر، ماندگاری و درک بهتری می‌دهد.' });
      const sents = FaText.splitSentences(doc.body); const lens = sents.map((s) => words(s).length);
      if (lens.length >= 6) {
        const avg = lens.reduce((a, b) => a + b, 0) / lens.length; const sd = Math.sqrt(lens.reduce((a, b) => a + (b - avg) * (b - avg), 0) / lens.length);
        const starts = {}; sents.forEach((s) => { const w0 = words(s)[0]; if (w0) starts[w0] = (starts[w0] || 0) + 1; });
        const topStart = Object.entries(starts).sort((a, b) => b[1] - a[1])[0];
        const rep = topStart && topStart[1] >= 4 && topStart[1] / sents.length > 0.25;
        add('rhythm', 'style', 2, (sd >= 4 ? 1 : 0.5) * (rep ? 0.5 : 1), 'ریتم جمله‌ها', { detail: (sd < 4 ? 'طول جمله‌ها یکنواخت است. ' : '') + (rep ? fa(topStart[1]) + ' جمله با «' + topStart[0] + '» شروع شده‌اند.' : ''), how: 'جملهٔ کوتاه و بلند را تلفیق کن و آغاز جمله‌ها را متنوع بنویس.', why: 'ریتم یکنواخت متن را ماشینی و خسته‌کننده نشان می‌دهد.' });
      }
      const fl = FILLER.filter((p) => has(bodyAll, p)); const fCount = FILLER.reduce((a, p) => a + (((' ' + flat(bodyAll) + ' ').split(' ' + flat(p) + ' ').length) - 1), 0);
      const per1k = nWords ? fCount / nWords * 1000 : 0;
      add('filler', 'style', 4, fCount === 0 ? 1 : per1k <= 2 ? 0.75 : per1k <= 5 ? 0.4 : 0, 'عبارت‌های پرکننده و کلیشه‌ای', { detail: fCount ? fa(fCount) + ' مورد: ' + fl.slice(0, 5).map((x) => '«' + x + '»').join('، ') : '', how: 'این عبارت‌ها را حذف یا با یک جملهٔ مشخص و مفید عوض کن.', why: 'پرکننده‌ها ارزش اطلاعاتی ندارند و محتوا را شبیه متن‌های انبوه می‌کنند.', found: fl });
      const seen = new Map(); let dup = 0; sents.forEach((s) => { const k = flat(s); if (words(s).length >= 6) { if (seen.has(k)) dup++; else seen.set(k, 1); } });
      add('dup_sentences', 'style', 3, dup === 0 ? 1 : dup === 1 ? 0.5 : 0, 'عدم تکرار جمله‌ها', { detail: dup ? fa(dup) + ' جملهٔ عیناً تکراری.' : '', how: 'جمله‌های تکراری را حذف کن یا با اطلاعات تازه عوض کن.', why: 'تکرار عین جمله نشانهٔ پرکردن متن برای رسیدن به تعداد واژه است.' });
    } else skip('style_*', 'متن برای سنجش سبک کوتاه است (کمتر از ۴۰ واژه).');
    const ty = typography(bodyAll + ' ' + title + ' ' + meta); const tyN = ty.reduce((a, b) => a + b.count, 0);
    add('typography', 'style', 2, tyN === 0 ? 1 : tyN <= 3 ? 0.6 : 0, 'نیم‌فاصله و نویسه‌های فارسی', { detail: ty.map((x) => x.label + ' (' + fa(x.count) + ')').join('، '), how: 'از «اصلاح نیم‌فاصله» استفاده کن (فقط اصلاح‌های بی‌خطر).', why: 'نگارش درست اعتماد خواننده را بالا می‌برد و جست‌وجوی واژه‌ها را یکدست می‌کند.', issues: ty });

    /* — ادعاها — */
    const flagged = []; FaText.splitSentences(bodyAll + '\n' + title + '\n' + meta).forEach((s) => {
      const hit = CLAIM_PHRASES.filter((p) => has(s, p)); const fs = flat(s);
      const hundred = /(^| )100( |$)/.test(fs) && /(درصد|٪|%)/.test(s) ? ['۱۰۰٪'] : [];
      const all = hit.concat(hundred); if (!all.length) return;
      const supported = hasAny(s, EVIDENCE_CUES) && /\d/.test(nz(s));
      if (!supported) flagged.push({ phrase: all[0], sentence: s.length > 90 ? s.slice(0, 88) + '…' : s });
    });
    add('claims', 'claims', 5, flagged.length === 0 ? 1 : flagged.length === 1 ? 0.6 : flagged.length === 2 ? 0.3 : 0, 'ادعاهای برتری بدون سند', { detail: flagged.length ? fa(flagged.length) + ' جمله با ادعا: ' + [...new Set(flagged.map((f) => f.phrase))].slice(0, 4).map((x) => '«' + x + '»').join('، ') : '', how: 'ادعا را با عدد، آزمون، منبع یا گواهی واقعی همراه کن؛ وگرنه به توصیف مشخص تبدیل کن (مثلاً به‌جای «بهترین»، بگو برای چه کسی و چرا مناسب است).', why: 'ادعای تأییدنشده با رهنمود محتوای مفید و قوانین تبلیغات سازگار نیست و اعتماد را می‌سوزاند.', flagged });

    /* — عنوان و متا — */
    if (title) {
      const px = Policy && Policy.pixelWidth ? Policy.pixelWidth(title) : title.length * 9; const L = Policy.LIMITS.title; const n = Array.from(title).length;
      add('title_len', 'serp', 4, px <= L.pxMax && n >= L.min ? 1 : n < L.min ? 0.5 : 0.5, 'طول عنوان (پیکسل)', { detail: fa(n) + ' نویسه، ' + fa(Math.round(px)) + ' پیکسل (حداکثر ' + fa(L.pxMax) + ').', how: px > L.pxMax ? 'عنوان را کوتاه کن تا در نتایج بریده نشود.' : 'عنوان را کمی کامل‌تر و مشخص‌تر کن.', why: 'عنوان بریده‌شده پیام کامل را نمی‌رساند.' });
      const nrm = nz(title); const el = [/\d/.test(nrm) ? 'عدد' : '', /(13|14)\d\d|20\d\d/.test(nrm) ? 'سال' : '', hasAny(title, POWER) ? 'واژهٔ کاربردی' : '', /[|\-–—:؛]/.test(title) ? 'جداکنندهٔ برند/موضوع' : ''].filter(Boolean);
      add('title_power', 'serp', 3, el.length >= 2 ? 1 : el.length === 1 ? 0.6 : 0.2, 'جذابیت عنوان (عدد، سال، فایدهٔ مشخص)', { detail: el.length ? 'دارد: ' + el.join('، ') : 'عنوان مشخص و کلیک‌پذیر نیست.', how: 'یک وعدهٔ مشخص و راستین اضافه کن (راهنما، مقایسه، لیست، سال به‌روزرسانی) به شرط آنکه متن همان را بدهد.', why: 'عنوان مشخص نرخ کلیک را بهتر می‌کند؛ ولی عنوان باید وعدهٔ واقعی صفحه باشد.' });
      const bait = hasAny(title, BAIT) || /[!！]{2,}|!.*!/.test(title) || /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(title);
      add('title_bait', 'serp', 2, bait ? 0 : 1, 'عنوان بدون کلیک‌طعمه', { detail: bait ? 'نشانهٔ اغراق، علامت تعجب تکراری یا ایموجی.' : '', how: 'اغراق و علامت تعجب را بردار؛ وعدهٔ دقیق بنویس.', why: 'عنوان گمراه‌کننده برگشت سریع کاربر و بی‌اعتمادی می‌آورد.' });
    } else skip('title_*', 'عنوان سئو داده نشد.');
    if (meta) {
      const n = Array.from(meta).length; const M = Policy.LIMITS.meta;
      add('meta_len', 'serp', 3, n >= M.idealMin && n <= M.max ? 1 : n > M.max ? 0.5 : n >= M.min ? 0.7 : 0.3, 'طول متا', { detail: fa(n) + ' نویسه (هدف ' + fa(M.idealMin) + ' تا ' + fa(M.max) + ').', how: n > M.max ? 'متا را کوتاه کن.' : 'یک جملهٔ مفید دیگر اضافه کن.', why: 'متای خیلی کوتاه یا بلند اغلب توسط گوگل بازنویسی یا بریده می‌شود.' });
      add('meta_action', 'serp', 2, hasAny(meta, META_ACTION) ? 1 : 0.3, 'متا با فایده یا دعوت روشن', { detail: '', how: 'پایان متا را با یک فعل دعوت (بخوانید، مقایسه کنید، سفارش دهید) و فایدهٔ واقعی ببند.', why: 'متا فرصت کوتاه شما برای متقاعدکردن کاربر است.' });
      const tw = new Set(contentStems(title)), mw = new Set(contentStems(meta)); const inter = [...tw].filter((x) => mw.has(x)).length; const uni = new Set([...tw, ...mw]).size || 1;
      if (title) add('meta_not_title', 'serp', 2, flat(meta) === flat(title) ? 0 : inter / uni > 0.8 ? 0.3 : 1, 'متای متفاوت از عنوان', { detail: inter / uni > 0.8 ? 'متا تقریباً تکرار عنوان است.' : '', how: 'در متا چیزی بگو که در عنوان نیست.', why: 'تکرار عنوان فضای ارزشمند توضیح را هدر می‌دهد.' });
    } else skip('meta_*', 'متا داده نشد.');

    /* — تجربه و شواهد — */
    if (!thin) {
      const exp = EXP_CUES.filter((p) => has(bodyAll, p)).length;
      add('exp_signals', 'eeat', 4, exp >= 2 ? 1 : exp === 1 ? 0.5 : 0, 'نشانه‌های تجربهٔ مستقیم', { detail: exp ? fa(exp) + ' نشانه.' : 'روایتی از تجربهٔ واقعی دیده نمی‌شود.', how: 'اگر واقعاً تجربه دارید: آزمون، نمونهٔ واقعی یا نتیجهٔ خودتان را بنویسید (چیزی نسازید).', why: 'رهنمود محتوای مفید گوگل به تجربه، تخصص و اعتماد اشاره می‌کند؛ این‌ها نشانه‌اند، نه امتیاز رتبه.' });
      const ext = doc.links.filter((l) => /^https?:\/\//i.test(l.href) && !(o.siteUrl && l.href.indexOf(String(o.siteUrl).replace(/\/+$/, '')) === 0)).length;
      const numClaims = FaText.splitSentences(bodyAll).filter((s) => /\d/.test(nz(s)) && hasAny(s, SRC_CUES)).length;
      const ev = ext + numClaims;
      add('evidence', 'eeat', 4, ev >= 2 ? 1 : ev === 1 ? 0.5 : 0, 'شواهد و منبع', { detail: fa(ev) + ' مورد (پیوند بیرونی یا آمار همراه منبع).', how: 'برای عددها و ادعاهای مهم منبع معتبر یا داده‌ٔ خودتان را ذکر کن.', why: 'ادعای مستند قابل‌اعتمادتر است و نقل‌پذیری بیشتری دارد.' });
      add('freshness', 'eeat', 1, hasAny(bodyAll, FRESH_CUES) || /(13|14)\d\d|20\d\d/.test(nz(bodyAll)) ? 1 : 0.4, 'نشانهٔ نویسنده یا تاریخ', { detail: '', how: 'نام نویسنده و تاریخ به‌روزرسانی را نمایش بده (اگر قالب سایت نشان می‌دهد، نادیده بگیر).', why: 'برای موضوعات حساس یا زمان‌دار، شفافیت منبع مهم است.' });
    }

    /* — پیوند و تصویر — */
    const internal = doc.links.filter((l) => /^\//.test(l.href) || (o.siteUrl && l.href.indexOf(String(o.siteUrl).replace(/\/+$/, '')) === 0)).length;
    if (nWords >= 250 && (doc.html || doc.links.length)) {
      const want = Math.max(1, Math.min(5, Math.round(nWords / 400)));
      add('internal_links', 'links', 3, clamp01(internal / want), 'پیوند داخلی', { detail: fa(internal) + ' پیوند داخلی (حدود ' + fa(want) + ' مناسب است).', how: 'به صفحه‌های واقعاً مرتبط با متن توصیفی لینک بده.', why: 'پیوند داخلی به کشف صفحه‌ها و انتقال زمینهٔ موضوعی کمک می‌کند.' });
    } else if (nWords >= 250) skip('internal_links', 'پیوندی در ورودی نیست (متن ساده).');
    if (doc.links.length) {
      const bad = doc.links.filter((l) => hasAny(l.text, GENERIC_ANCHOR) && flat(l.text).split(' ').length <= 3).length / doc.links.length;
      add('anchor_quality', 'links', 3, bad === 0 ? 1 : bad < 0.3 ? 0.6 : 0, 'متن پیوند توصیفی', { detail: bad ? fa(Math.round(bad * 100)) + '٪ پیوندها «اینجا/ادامه مطلب» هستند.' : '', how: 'متن پیوند را توصیفی کن (مثلاً «راهنمای انتخاب قهوه‌ساز»).', why: 'متن پیوند به خواننده و گوگل می‌گوید مقصد دربارهٔ چیست.' });
    }
    if (doc.images.length) { const ok2 = doc.images.filter((i) => i.alt && Array.from(i.alt).length >= 4).length / doc.images.length; add('img_alt', 'links', 2, ok2, 'متن جایگزین تصویر', { detail: fa(Math.round(ok2 * 100)) + '٪ تصویرها alt معنادار دارند.', how: 'برای هر تصویر مهم، توصیف کوتاه و واقعی بنویس (بدون چپاندن کلیدواژه).', why: 'alt برای دسترس‌پذیری و جست‌وجوی تصویر لازم است.' }); }

    /* — امتیاز نهایی — */
    const W = checks.reduce((a, c) => a + c.w, 0) || 1; const got = checks.reduce((a, c) => a + c.w * c.pass, 0);
    const score = Math.round(got / W * 100);
    const cats = {}; Object.keys(CATS).forEach((k) => { const cs = checks.filter((c) => c.cat === k); if (cs.length) { const w = cs.reduce((a, c) => a + c.w, 0); cats[k] = { label: CATS[k], score: Math.round(cs.reduce((a, c) => a + c.w * c.pass, 0) / w * 100), checks: cs.length }; } });
    const fixes = checks.filter((c) => c.pass < 0.95).map((c) => ({ id: c.id, cat: c.cat, catLabel: CATS[c.cat], label: c.label, gain: +(c.w * (1 - c.pass)).toFixed(2), severity: c.pass < 0.35 ? 'high' : c.pass < 0.7 ? 'medium' : 'low', detail: c.detail || '', how: c.how, why: c.why })).sort((a, b) => b.gain - a.gain);
    const grade = score >= 85 ? 'عالی' : score >= 70 ? 'خوب' : score >= 50 ? 'نیازمند بهبود' : 'ضعیف';
    return { ok: true, score, grade, intent: it, thin, stats: { words: nWords, paragraphs: paras.length, headings: doc.headings.length, h2: h2n, lists: doc.lists, tables: doc.tables, links: doc.links.length, internalLinks: internal, images: doc.images.length, keywordCount: kwCount, density: +density.toFixed(2), questionHeadings: qH.length }, cats, checks, fixes, skipped, note: 'امتیاز راهنمای ویرایش است؛ رتبه یا نقل در پاسخ‌های AI را پیش‌بینی یا تضمین نمی‌کند.' };
  }

  /** موضوع بدون پسوند پرسشی («قهوه‌ساز چیست» ← «قهوه‌ساز»)؛ و اینکه عبارت از قبل «چگونگی/چرایی» است. */
  const topicOf = (kw) => String(kw || '').replace(/\s*(چیست|چیه|چی هست)\s*[؟?]*\s*$/, '').trim() || String(kw || '').trim();
  const isHow = (kw) => /(^| )(نحوه|چگونه|چطور|چطوری|آموزش|روش|مراحل|تفاوت|چرا|علت|دلیل|مقایسه)( |$)/.test(flat(kw));

  /* ---------- عنوان و متا (فقط با واقعیت‌های کاربر) ---------- */
  function headlines(keyword, facts) {
    const kw = String(keyword || '').trim(); const f = facts || {};
    if (!kw) return { ok: false, why: 'کلیدواژه را بنویس.' };
    const it = intent(kw); const year = String(f.year || '').trim(), n = String(f.number || '').trim(), brand = String(f.brand || '').trim(), ben = String(f.benefit || '').trim(), city = String(f.city || '').trim();
    const todo = []; const cand = [];
    const push = (text, kind, note) => { const t = text.replace(/\s+/g, ' ').trim(); if (t && !cand.some((c) => c.text === t)) cand.push({ text: t, kind, note: note || '' }); };
    const tail = brand ? ' | ' + brand : '';
    if (it.id === 'info') {
      const topic = topicOf(kw), how = isHow(kw), yr = year ? ' ' + year : '';
      if (!how) push(topic + ' چیست؟ راهنمای کامل' + yr + tail, 'تعریف', 'فقط اگر مقاله تعریف و راهنمای کامل می‌دهد.'); else push(topic + ': راهنمای کامل' + yr + tail, 'راهنما', 'فقط اگر مقاله همهٔ مراحل را کامل پوشش می‌دهد.');
      push(topic + '؛ راهنمای مرحله‌به‌مرحله' + tail, 'آموزشی', 'فقط اگر مقاله مراحل دارد.');
      if (n) push(how ? topic + ': ' + n + ' نکتهٔ کلیدی' + tail : n + ' نکتهٔ مهم دربارهٔ ' + topic + tail, 'فهرست', 'عدد باید با تعداد واقعی نکته‌ها برابر باشد.'); else todo.push('تعداد واقعی نکته‌ها (برای عنوان فهرستی)');
      if (ben) push(topic + ': ' + ben + tail, 'فایده');
    } else if (it.id === 'commercial') {
      push('مقایسه و راهنمای انتخاب ' + kw + (year ? ' (' + year + ')' : '') + tail, 'مقایسه', 'فقط اگر جدول یا معیار مقایسه دارید.');
      push(kw + '؛ چطور انتخاب کنیم؟' + tail, 'راهنمای انتخاب');
      push('بررسی ' + kw + ': مزایا، معایب و مناسب چه کسی است' + tail, 'بررسی', 'فقط اگر معایب را هم صادقانه نوشته‌اید.');
      if (n) push(n + ' معیار مهم برای انتخاب ' + kw + tail, 'فهرست'); else todo.push('تعداد واقعی معیارها');
    } else if (it.id === 'transactional') {
      push('خرید ' + kw.replace(/^خرید\s+/, '') + tail, 'خرید');
      if (ben) { push('خرید ' + kw.replace(/^خرید\s+/, '') + ' ' + ben + tail, 'خرید + مزیت'); push(kw + ': ' + ben + tail, 'مزیت'); } else todo.push('یک مزیت واقعی (مثلاً ارسال، گارانتی یا ویژگی واقعی محصول)');
      push('قیمت و سفارش ' + kw.replace(/^(قیمت|خرید)\s+/, '') + tail, 'قیمت', 'فقط اگر قیمت در صفحه نمایش داده می‌شود.');
    } else if (it.id === 'local') {
      if (city) push(kw.indexOf(city) >= 0 ? kw + tail : kw + ' در ' + city + tail, 'محلی'); else todo.push('نام شهر یا محله');
      if (ben) push(kw + ': ' + ben + tail, 'مزیت');
      push(kw + ' | نشانی، تلفن و ساعت کاری', 'اطلاعات تماس', 'فقط اگر همین اطلاعات روی صفحه است.');
    } else {
      push((brand || kw) + ' | ' + (brand ? kw : 'سایت رسمی'), 'برند');
      if (!brand) todo.push('نام برند');
    }
    const L = Policy.LIMITS.title; const titles = cand.map((c) => { const px = Policy.pixelWidth(c.text); const m = mentions(c.text, kw); const start = countPhrase(stems(c.text).slice(0, stems(kw).length + 2), stems(kw)) > 0;
      let s = 50 + (m === 'exact' ? 15 : 5) + (start ? 10 : 0) + (/\d/.test(c.text) ? 5 : 0) + (px <= L.pxTarget ? 15 : px <= L.pxMax ? 8 : -20) + (Array.from(c.text).length >= L.min ? 5 : -10);
      return Object.assign({}, c, { px: Math.round(px), chars: Array.from(c.text).length, fits: px <= L.pxMax, score: Math.max(0, Math.min(100, Math.round(s))) }); }).sort((a, b) => b.score - a.score);
    const ctaFor = { info: 'بخوانید و بدانید.', commercial: 'مقایسه کنید و انتخاب کنید.', transactional: 'همین حالا سفارش دهید.', local: 'تماس بگیرید یا مسیر را ببینید.', nav: 'وارد شوید.' }[it.id];
    const metas = [];
    if (ben || f.summary) {
      const core = String(f.summary || '').trim() || (kw + ': ' + ben + '.');
      const m1 = core.replace(/\s+/g, ' ').replace(/[.؟!]*$/, '.') + ' ' + ctaFor;
      metas.push({ text: m1, chars: Array.from(m1).length });
      if (f.audience) { const m2 = kw + ' برای ' + f.audience + ': ' + (ben || core.replace(/[.]*$/, '')) + '. ' + ctaFor; metas.push({ text: m2, chars: Array.from(m2).length }); }
    } else todo.push('یک جملهٔ خلاصهٔ واقعی از محتوای صفحه (برای متا)');
    metas.forEach((m) => { m.fits = m.chars >= Policy.LIMITS.meta.idealMin && m.chars <= Policy.LIMITS.meta.max; m.note = m.chars < Policy.LIMITS.meta.idealMin ? 'کوتاه است؛ جزئیات واقعی دیگری اضافه کن.' : m.chars > Policy.LIMITS.meta.max ? 'بلند است؛ کوتاه کن.' : ''; });
    return { ok: true, intent: it, titles, metas, todo, note: 'قالب‌ها فقط با اطلاعاتی که خودت دادی پر شده‌اند. پیش از استفاده مطمئن شو متن صفحه همین وعده را می‌دهد.' };
  }

  /* ---------- بریف نوشتن ---------- */
  function brief(keyword, facts) {
    const kw = String(keyword || '').trim(); if (!kw) return { ok: false, why: 'کلیدواژه را بنویس.' };
    const f = facts || {}; const it = intent(kw);
    const plan = BLUEPRINTS[it.id].map((b) => ({ role: b[0], section: b[1], purpose: b[2] }));
    const topic = topicOf(kw);
    const q = [isHow(kw) ? topic + ': از کجا شروع کنیم؟' : topic + ' چیست؟', topic + ' چه کاربردی دارد؟', topic + ' چه مزایا و محدودیت‌هایی دارد؟', 'اشتباه‌های رایج دربارهٔ ' + topic + ' کدام‌اند؟'];
    if (it.id === 'transactional' || it.id === 'commercial') q.push('چگونه ' + topic + ' را انتخاب کنیم؟', 'قیمت ' + topic + ' به چه عواملی بستگی دارد؟', 'پیش از خرید ' + topic + ' به چه نکته‌هایی توجه کنیم؟');
    if (it.id === 'local') q.push(kw + ' ساعت کاری و نشانی دقیق چیست؟');
    if (f.alt) q.push('تفاوت ' + kw + ' با ' + f.alt + ' چیست؟');
    const mustFill = ['نام و نقش نویسنده (برای اعتماد)', 'یک تجربه، آزمون یا نمونهٔ واقعی از خودتان', 'عددها و منبع‌هایی که واقعاً دارید'];
    if (it.id === 'transactional') mustFill.push('ارسال، مرجوعی، گارانتی و پرداخت (واقعی)', 'مشخصات فنی دقیق محصول');
    if (it.id === 'local') mustFill.push('نشانی، تلفن و ساعت کاری یکسان با نقشه');
    if (it.id === 'commercial') mustFill.push('معیارهای مقایسه و معایب واقعی هر گزینه');
    const wc = it.id === 'info' ? [900, 1600] : it.id === 'commercial' ? [900, 1500] : it.id === 'transactional' ? [250, 700] : [200, 600];
    return { ok: true, keyword: kw, intent: it, plan, questions: q, mustFill, targetWords: { min: wc[0], max: wc[1], note: 'راهنماست، نه قانون؛ طول را عمق پاسخ تعیین می‌کند، نه عدد.' }, avoid: ['مقدمهٔ کلیشه‌ای (امروزه، در دنیای امروز…)', 'ادعای برتری بدون سند', 'تکرار مکانیکی کلیدواژه', 'عدد یا سابقهٔ ساختگی'], note: 'سرفصل‌ها و پرسش‌ها ایده‌اند، نه داده‌ٔ جست‌وجوی واقعی؛ با Search Console و نتایج گوگل برای همین عبارت بسنج.' };
  }

  /* ---------- گزارش متنی ---------- */
  function report(res) {
    if (!res || !res.ok) return (res && res.why) || '';
    const L = ['گزارش استاد سئو و متن‌نویسی', 'امتیاز: ' + fa(res.score) + ' از ۱۰۰ (' + res.grade + ')'];
    if (res.intent) L.push('نیت جستجو: ' + res.intent.label);
    L.push('', 'حوزه‌ها:'); Object.values(res.cats).forEach((c) => L.push('- ' + c.label + ': ' + fa(c.score)));
    L.push('', 'اصلاح‌ها (به ترتیب اثر):'); res.fixes.slice(0, 12).forEach((x, i) => L.push(fa(i + 1) + '. ' + x.label + (x.detail ? ' — ' + x.detail : '') + '\n   چطور: ' + x.how));
    L.push('', res.note); return L.join('\n');
  }

  /* ---------- v1.89: شباهت متنی، مشکل‌های شایع و بازنویسی عنوان/متا با مدل (اعتبارسنجی سخت) ---------- */
  const plainWords = (x) => words(FaText.htmlToText ? FaText.htmlToText(String(x || '')) : String(x || '').replace(/<[^>]*>/g, ' '));
  const shingles = (ws, k) => { const set = new Set(); for (let i = 0; i + k <= ws.length; i++) set.add(ws.slice(i, i + k).join(' ')); return set; };
  /** شباهت دو متن با شینگل ۴کلمه‌ای. containment: چند درصد متنِ کوتاه‌تر در دیگری آمده است (کپی/بازنویسی سبک را می‌گیرد). */
  function similarity(a, b) {
    const wa = plainWords(a), wb = plainWords(b);
    if (Math.min(wa.length, wb.length) < 40) return { ok: false, why: 'متن برای مقایسه کوتاه است (کمتر از ۴۰ واژه).', jaccard: 0, containment: 0, level: 'none' };
    const A = shingles(wa, 4), B = shingles(wb, 4); let inter = 0; A.forEach((x) => { if (B.has(x)) inter++; });
    const jaccard = inter / (A.size + B.size - inter || 1), containment = inter / (Math.min(A.size, B.size) || 1);
    return { ok: true, jaccard: +jaccard.toFixed(3), containment: +containment.toFixed(3), level: containment >= 0.6 ? 'high' : containment >= 0.35 ? 'medium' : 'low' };
  }
  /** مشکل‌های سیستماتیک: اصلاح‌هایی که در چند مورد تکرار می‌شوند، به ترتیب (تعداد × میانگین اثر). */
  function commonIssues(rows, top) {
    const m = new Map(); let n = 0;
    (rows || []).forEach((r) => { if (r && Array.isArray(r.fixList)) { n++; r.fixList.forEach((f) => { const o = m.get(f.id) || { id: f.id, label: f.label, count: 0, gain: 0 }; o.count++; o.gain += Number(f.gain) || 0; m.set(f.id, o); }); } });
    return Array.from(m.values()).filter((o) => o.count >= 2).map((o) => ({ id: o.id, label: o.label, count: o.count, of: n, avgGain: +(o.gain / o.count).toFixed(1), weight: o.count * (o.gain / o.count) }))
      .sort((x, y) => y.weight - x.weight || y.count - x.count).slice(0, top || 3);
  }
  const nums = (x) => (nz(x).match(/\d+(?:[.,]\d+)?/g) || []).map((d) => d.replace(',', '.'));
  const UNGROUNDED = ['ارسال رایگان', 'رایگان', 'تخفیف', 'گارانتی', 'ضمانت', 'اورجینال', 'ارسال فوری', 'قیمت مناسب', 'ارزان'];
  /** پیام‌های مدل برای بازنویسی عنوان سئو و متا؛ فقط با متن و واقعیت‌های داده‌شده. */
  function rewritePrompt(o) {
    const L = Policy.LIMITS; const excerpt = String(FaText.htmlToText ? FaText.htmlToText(String(o.text || '')) : String(o.text || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, 700);
    return [{ role: 'system', content: 'تو سردبیر سئوی فارسی هستی. فقط فارسی روان بنویس. هیچ عدد، قیمت، سابقه، گارانتی، تخفیف، ارسال رایگان یا ادعای «بهترین/اصل/تضمین» نساز مگر در متن یا واقعیت‌های داده‌شده آمده باشد. فقط یک JSON معتبر برگردان: {"title":"...","meta":"..."}' },
      { role: 'user', content: 'کلیدواژه: ' + (o.keyword || '(ندارد)') + '\nعنوان فعلی: ' + (o.title || '(ندارد)') + '\nمتای فعلی: ' + (o.meta || '(ندارد)') + '\nواقعیت‌های داده‌شده: ' + (String(o.facts || '').trim() || '(ندارد)') + '\nآغاز متن صفحه: ' + excerpt + '\n\ntitle: بین ' + L.title.min + ' و ' + L.title.target + ' نویسه، کلیدواژه را یک‌بار و طبیعی بیاور.\nmeta: بین ' + L.meta.idealMin + ' و ' + L.meta.target + ' نویسه، خلاصهٔ صادقانهٔ همین صفحه با کلیدواژه، بدون کلیک‌طعمه.' }];
  }
  /** خروجی خام مدل را می‌سنجد؛ هر ایرادی = رد (متن قبلی می‌ماند). */
  function applyRewrite(o, raw) {
    let j; try { j = JSON.parse(String(raw).replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, '$1')); } catch (e) { return { ok: false, why: 'خروجی مدل JSON معتبر نبود.' }; }
    const L = Policy.LIMITS; const clean = (v) => fixTypography(String(v == null ? '' : v)).replace(/\s+/g, ' ').trim();
    const title = clean(j && j.title), meta = clean(j && j.meta); if (!title || !meta) return { ok: false, why: 'عنوان یا متا خالی بود.' };
    for (const [k, v] of [['عنوان', title], ['متا', meta]]) {
      if (/[<>{}\[\]]|https?:/i.test(v)) return { ok: false, why: 'نشانه‌گذاری غیرمجاز در ' + k + '.' };
      if (/[\u4e00-\u9fff\u0400-\u04ff]/.test(v)) return { ok: false, why: 'نویسهٔ غیرفارسی در ' + k + '.' };
    }
    const tn = Array.from(title).length, mn = Array.from(meta).length; const px = Policy.pixelWidth ? Policy.pixelWidth(title) : tn * 9;
    if (tn < L.title.min || tn > L.title.hard || px > L.title.pxMax) return { ok: false, why: 'طول عنوان مجاز نیست (' + fa(tn) + ' نویسه، ' + fa(Math.round(px)) + ' پیکسل).' };
    if (mn < L.meta.min || mn > L.meta.max) return { ok: false, why: 'طول متا مجاز نیست (' + fa(mn) + ' نویسه).' };
    const kw = String(o.keyword || '').trim();
    if (kw && !mentions(title, kw)) return { ok: false, why: 'کلیدواژه در عنوان نیست.' };
    if (kw && !mentions(meta, kw)) return { ok: false, why: 'کلیدواژه در متا نیست.' };
    const source = [o.text, o.title, o.meta, o.facts, kw].join(' '); const known = new Set(nums(source)); const outText = title + ' ' + meta;
    const bad = nums(outText).find((d) => !known.has(d)); if (bad) return { ok: false, why: 'عدد ' + fa(bad) + ' در متن یا واقعیت‌ها نیست.' };
    const claim = CLAIM_PHRASES.concat(UNGROUNDED).find((c) => has(outText, c) && !has(source, c)); if (claim) return { ok: false, why: 'ادعای بی‌پشتوانه: «' + claim + '».' };
    if (flat(title) === flat(meta)) return { ok: false, why: 'عنوان و متا یکی بودند.' };
    if (flat(title) === flat(o.title) && flat(meta) === flat(o.meta)) return { ok: false, why: 'پیشنهاد با وضعیت فعلی یکی بود.' };
    return { ok: true, title, meta, titleChars: tn, titlePx: Math.round(px), metaChars: mn, note: 'پیشنهاد مدل است؛ پیش از استفاده با متن صفحه تطبیق بده. چیزی در سایت نوشته نمی‌شود.' };
  }

  /* ---------- v1.94: بستهٔ سئو (ساخت کامل) و واژه‌های غالب متن ---------- */
  /** واژه‌ها و عبارت‌های پرتکرارِ خود متن (ریشه‌محور) + اینکه کلیدواژه با موضوع غالب متن می‌خواند یا نه. */
  const TERM_STOP = new Set(['است', 'بود', 'شود', 'شده', 'باشد', 'نیز', 'کند', 'کنید', 'کنیم', 'دارد', 'دارند', 'کرد', 'کرده', 'خود', 'همه', 'هیچ', 'برخی', 'بسیار', 'اما', 'ولی', 'اگر', 'چون', 'پس', 'باید', 'می‌توان', 'توان', 'ممکن', 'مثلا', 'مانند', 'بین', 'روی', 'زیر']);
  function topTerms(text, n, keyword) {
    const ws = plainWords(text); if (ws.length < 40) return { ok: false, why: 'متن برای استخراج واژه‌های غالب کوتاه است (کمتر از ۴۰ واژه).' };
    const keep = (w) => w.length >= 3 && !STOPW.has(w) && !TERM_STOP.has(w) && !/^\d+$/.test(w); const st = ws.map(stem); const surf = new Map(); const uni = new Map(), bi = new Map();
    st.forEach((w, i) => { if (!surf.has(w)) surf.set(w, ws[i]); if (keep(w)) uni.set(w, (uni.get(w) || 0) + 1); if (i + 1 < st.length && keep(w) && keep(st[i + 1])) { const k = w + ' ' + st[i + 1]; bi.set(k, (bi.get(k) || 0) + 1); } });
    const list = [];
    bi.forEach((c, k) => { if (c >= 3) { const [x, y] = k.split(' '); list.push({ term: surf.get(x) + ' ' + surf.get(y), count: c, kind: 'عبارت', w: c * 2 }); } });
    uni.forEach((c, k) => { if (c >= 3) list.push({ term: surf.get(k), count: c, kind: 'واژه', w: c }); });
    const top = list.sort((x, y) => y.w - x.w || y.count - x.count).slice(0, n || 8).map((x) => ({ term: x.term, count: x.count, kind: x.kind }));
    const out = { ok: true, top, words: ws.length };
    const kw = String(keyword || '').trim();
    if (kw) {
      const ks = stems(kw), need = contentStems(kw); out.keywordCount = countPhrase(st, ks);
      const topStems = new Set(Array.from(uni.entries()).sort((x, y) => y[1] - x[1]).slice(0, 15).map((e) => e[0])); const inTop = need.filter((w) => topStems.has(w)).length;
      out.keywordInTop = need.length ? inTop / need.length >= 0.5 : false;
      out.drift = out.keywordCount === 0 || (out.keywordCount < 2 && !out.keywordInTop);
      out.note = out.drift ? 'کلیدواژه در متن کم‌رنگ است و موضوع غالب متن چیز دیگری به نظر می‌رسد؛ یا متن را روی کلیدواژه متمرکز کن یا کلیدواژه را با موضوع واقعی متن هماهنگ کن.' : '';
    }
    return out;
  }
  const slugOf = (kw) => {
    let ws = flat(kw).split(' ').filter((w) => w && !STOPW.has(w)).slice(0, 6); let sl = ws.join('-');
    while (Array.from(sl).length > 75 && ws.length > 1) { ws = ws.slice(0, -1); sl = ws.join('-'); }
    if (Array.from(sl).length > 75) sl = Array.from(sl).slice(0, 75).join('').replace(/-+$/, '');
    return sl;
  };
  /** هستهٔ موضوع: واژه‌های نیت (خرید/قیمت/آموزش/چیست…) از سر و ته عبارت برداشته می‌شود تا ترکیب‌های فرعی تکراری نشود. */
  const baseOf = (kw, id) => {
    if (id === 'nav') return String(kw).trim(); let x = topicOf(kw).replace(/\s+/g, ' ').trim(); let prev;
    do { prev = x; x = x.replace(/^(خرید|قیمت|سفارش|فروش|مقایسه|آموزش|راهنمای خرید|راهنمای|نحوه|چگونه|چطور)\s+/, '').replace(/\s+(چیست|قیمت|نزدیک من)$/, '').trim(); } while (x !== prev && x);
    return x || String(kw).trim();
  };
  const MODS = { info: (b) => [b + ' چیست', 'آموزش ' + b, 'راهنمای ' + b], commercial: (b) => ['مقایسه ' + b, 'راهنمای خرید ' + b, 'مزایا و معایب ' + b], transactional: (b) => ['خرید ' + b, 'قیمت ' + b, 'سفارش ' + b], local: (b) => [b + ' نزدیک من'], nav: () => [] };
  const ldSafe = (o) => JSON.stringify(o, null, 2).replace(/</g, '\\u003c');
  /** بستهٔ کامل سئوی یک صفحه: عنوان، متا، H1، اسلاگ، کلیدواژه‌ها، اسکیما، پیوند داخلی، رقابت داخلی و چک‌لیست. هیچ واقعیتی ساخته نمی‌شود. */
  function seoPack(keyword, facts, ctx) {
    const kw = String(keyword || '').trim(); if (!kw) return { ok: false, why: 'کلیدواژه را بنویس.' };
    const f = facts || {}, c = ctx || {}; const it = intent(kw); const hd = headlines(kw, f); const br = brief(kw, { alt: f.alt }); if (!hd.ok) return hd;
    const brand = String(f.brand || '').trim(), city = String(f.city || '').trim(), summary = String(f.summary || '').trim(); const todo = hd.todo.slice();
    const title = hd.titles[0] || null, meta = hd.metas[0] || null;
    const tailRe = brand ? new RegExp('\\s*\\|\\s*' + brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$') : null;
    const h1s = []; hd.titles.slice(0, 3).forEach((t) => { const x = (tailRe ? t.text.replace(tailRe, '') : t.text).trim(); if (x && !h1s.includes(x)) h1s.push(x); });
    const base = baseOf(kw, it.id); const slug = slugOf(kw);
    const second = (MODS[it.id] && !(it.id === 'local' && city && has(base, city)) ? MODS[it.id](base) : []).concat(it.id === 'local' && city && !has(base, city) ? [base + ' ' + city] : []).filter((x) => flat(x) !== flat(kw) && !has(kw, x));
    const catalog = (c.catalog || []).filter((x) => x && x.title);
    const cannibal = []; catalog.forEach((x) => {
      const fk = String(x.focusKeyword || '').trim(); let level = '';
      if (fk && flat(fk) === flat(kw)) level = 'high'; else if (has(x.title, kw) || mentions(x.title, kw) === 'exact') level = 'medium';
      if (level) cannibal.push({ id: x.id, title: x.title, url: x.url || '', type: x.type || '', level, why: level === 'high' ? 'همین عبارت کلیدی را دارد' : 'عنوانش همین عبارت را دارد' });
    }); cannibal.sort((x, y) => (x.level === 'high' ? 0 : 1) - (y.level === 'high' ? 0 : 1)); const cannibalTop = cannibal.slice(0, 5);
    const need = contentStems(kw); const taken = new Set(cannibal.map((x) => String(x.id)));
    const links = []; if (need.length) catalog.forEach((x) => { if (taken.has(String(x.id))) return; const have = new Set(contentStems(x.title + ' ' + (x.focusKeyword || ''))); const hit = need.filter((w) => have.has(w)).length; if (hit && hit / need.length >= 0.34) links.push({ id: x.id, title: x.title, url: x.url || '', type: x.type || '', anchor: x.title, rel: +(hit / need.length).toFixed(2) }); });
    links.sort((x, y) => y.rel - x.rel); const linksTop = links.slice(0, 5);
    if (!catalog.length) todo.push('فهرست محتوای سایت (برای تشخیص رقابت داخلی و پیشنهاد پیوند داخلی)');
    // اسکیما
    const schemas = []; const t0 = title ? (tailRe ? title.text.replace(tailRe, '') : title.text) : '';
    if (it.id === 'transactional') { const o = { '@context': 'https://schema.org', '@type': 'Product', name: base }; if (brand) o.brand = { '@type': 'Brand', name: brand }; if (summary) o.description = summary; schemas.push({ type: 'Product', json: ldSafe(o), todo: ['قیمت واقعی و واحد پول (offers)', 'وضعیت موجودی', 'تصویر محصول', 'شناسهٔ کالا (sku یا gtin)', 'امتیاز و نظر فقط اگر واقعی و روی همین صفحه دیده می‌شود'] }); }
    else if (it.id === 'local') { if (brand) { const o = { '@context': 'https://schema.org', '@type': 'LocalBusiness', name: brand }; if (city) o.address = { '@type': 'PostalAddress', addressLocality: city }; schemas.push({ type: 'LocalBusiness', json: ldSafe(o), todo: ['نشانی کامل', 'تلفن', 'ساعت کاری'] }); } else todo.push('نام برند/کسب‌وکار (برای اسکیمای LocalBusiness)'); }
    else if (it.id === 'nav') { if (brand) schemas.push({ type: 'Organization', json: ldSafe({ '@context': 'https://schema.org', '@type': 'Organization', name: brand }), todo: ['نشانی سایت (url)', 'لوگو'] }); else todo.push('نام برند (برای اسکیمای Organization)'); }
    else { const o = { '@context': 'https://schema.org', '@type': 'Article', headline: t0 || kw, inLanguage: 'fa' }; if (meta && summary) o.description = meta.text; if (brand) o.publisher = { '@type': 'Organization', name: brand }; schemas.push({ type: 'Article', json: ldSafe(o), todo: ['تاریخ انتشار واقعی (datePublished)', 'نویسندهٔ واقعی (author)', 'تصویر شاخص (image)'] }); }
    // پرسش و پاسخ واقعی
    const faq = []; const faqBad = []; String(f.faq || '').split(/\n+/).map((l) => l.trim()).filter(Boolean).forEach((l) => { const i = l.indexOf('|'); const q = i > 0 ? l.slice(0, i).trim() : l, a2 = i > 0 ? l.slice(i + 1).trim() : ''; if (q.length >= 5 && a2.length >= 10) faq.push({ q, a: a2 }); else faqBad.push(q); });
    let faqJson = ''; if (faq.length) faqJson = ldSafe({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) });
    if (faqBad.length) todo.push('پاسخ واقعی برای ' + fa(faqBad.length) + ' پرسش (قالب هر خط: پرسش | پاسخ)');
    // چک‌لیست انتشار
    const slugHas = need.length ? need.every((w) => stems(slug.replace(/-/g, ' ')).includes(w)) : false;
    const checks = [
      { label: 'عنوان سئو در محدودهٔ پیکسل', ok: title ? title.fits : null }, { label: 'متا بین ۱۲۰ و ۱۶۰ نویسه', ok: meta ? meta.fits : null },
      { label: 'کلیدواژه در عنوان', ok: title ? !!mentions(title.text, kw) : null }, { label: 'کلیدواژه در H1', ok: h1s.length ? !!mentions(h1s[0], kw) : null },
      { label: 'کلیدواژه در اسلاگ', ok: slug ? slugHas : null }, { label: 'تضاد با صفحهٔ موجود (رقابت داخلی) ندارد', ok: catalog.length ? !cannibal.some((x) => x.level === 'high') : null },
      { label: 'پیوند داخلی مرتبط پیدا شد', ok: catalog.length ? linksTop.length > 0 : null },
    ];
    const out = { ok: true, keyword: kw, intent: it, title, titles: hd.titles, metas: hd.metas, h1s, slug, focus: kw, second, cannibal: cannibalTop, cannibalVerdict: cannibal.some((x) => x.level === 'high') ? 'high' : cannibal.length ? 'medium' : (catalog.length ? 'none' : 'unknown'), links: linksTop, schemas, faq, faqJson, checks, todo, brief: br,
      notes: ['همهٔ بخش‌ها فقط از واقعیت‌هایی که خودت دادی ساخته شده‌اند؛ جای خالی در «برای تکمیل» است.', 'کلیدواژه‌های فرعی ایده‌اند و حجم جست‌وجوی آن‌ها معلوم نیست؛ با Search Console بسنج.', 'اسلاگ فارسی در نشانی رمزگذاری می‌شود؛ اپ به لاتین ترجمه نمی‌کند تا غلط نسازد.'] };
    if (faq.length) out.notes.push('نمایش ویژهٔ پرسش‌وپاسخ در نتایج گوگل از ۲۰۲۳ به سایت‌های رسمی/سلامت محدود شده؛ این اسکیما بیشتر برای ساختار و فهم محتواست و نمایش ویژه را تضمین نمی‌کند.');
    if (c.text) { const tt = topTerms(c.text, 8, kw); if (tt.ok) out.terms = tt; }
    return out;
  }

  return { analyze, intent, headlines, brief, typography, fixTypography, report, parse, countPhrase, mentions, INTENTS, CATS, FILLER, CLAIMS: CLAIM_PHRASES, CTA, similarity, commonIssues, rewritePrompt, applyRewrite, topTerms, seoPack, slugOf };
});
