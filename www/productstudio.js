/* Site Inspector — SI.ProductStudio (v1.63). Pure. "Only a name in → finished product page out."
 * From ONE product name it builds: long product description (HTML), short description, SEO title, meta description, focus keyword,
 * secondary keywords, slug, tags, image alt/title, Open Graph, FAQ, JSON-LD (Product + FAQPage + BreadcrumbList), internal-link block,
 * a self-check score and a list of facts the shop owner should still confirm.
 * Honesty rule (kept from the rest of the app): facts about THIS item come only from the name / data the shop supplies;
 * everything else is general advice about the product's category (SI.StudioData). No price, warranty, origin, "original", "best", ratings. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./fromname.js'), require('./studiodata.js'));
  else (root.SI = root.SI || {}).ProductStudio = factory(root.SI && root.SI.FromName, root.SI && root.SI.StudioData);
})(typeof self !== 'undefined' ? self : this, function (FromName, Data) {
  'use strict';
  const len = (s) => Array.from(String(s == null ? '' : s)).length;
  const fixc = (s) => String(s == null ? '' : s).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[ً-ٟ]/g, '');
  const plain = (s) => fixc(String(s == null ? '' : s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')).replace(/\s+/g, ' ').trim();
  const norm = (s) => plain(s).replace(/‌/g, ' ').toLowerCase();
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const latinDigits = (s) => String(s == null ? '' : s).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const fit = (s, max) => { s = String(s).replace(/\s+/g, ' ').trim(); if (len(s) <= max) return s; let acc = ''; for (const x of s.split(' ')) { const n = acc ? acc + ' ' + x : x; if (len(n) > max) break; acc = n; } return acc.replace(/[\s،؛:,\-–|]+$/, ''); };
  function hash32(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const pick = (arr, r) => arr[Math.floor(r() * arr.length)];
  const fill = (s, n, t) => String(s).replace(/\{n\}/g, n).replace(/\{t\}/g, t);
  const uniq = (a) => { const seen = new Set(); return a.filter((x) => { const k = norm(x); if (!k || seen.has(k)) return false; seen.add(k); return true; }); };
  const BANNED = ['ضمانت', 'اصل', 'اورجینال', 'بهترین', 'ارزان', 'تخفیف', 'تضمین', 'پرفروش', 'رایگان', 'تضمینی'];
  const BANNED_RE = new RegExp('(?<![\\p{L}])(?:' + BANNED.join('|') + ')(?![\\p{L}])', 'iu');
  const STOP = new Set(['و', 'با', 'برای', 'از', 'در', 'به', 'تا', 'یا', 'مدل', 'سری', 'خرید', 'قیمت', 'مشکی', 'سفید']);

  /* ---------- v1.67: fixed template sentences (single source; also used to tell shared boilerplate from product-specific text) ---------- */
  const TPL = {
    intro: ['{n} در این صفحه معرفی شده است. در ادامه دربارهٔ کاربرد این محصول، نکات انتخاب، روش استفاده و پرسش‌های رایج توضیح می‌دهیم تا با اطمینان بیشتری خرید کنید.',
      'اگر دنبال {n} هستید، این صفحه مشخصات ثبت‌شده، راهنمای انتخاب و نکات استفاده از {t} را یکجا در اختیار شما می‌گذارد.',
      'در این صفحه {n} را از نظر مشخصات، کاربرد و نکات خرید بررسی می‌کنیم تا بتوانید آن را با نیاز خود مقایسه کنید.',
      '{n} را در این صفحه با مشخصات ثبت‌شده و نکات کاربردی معرفی می‌کنیم؛ اگر دربارهٔ {t} تردید دارید، بخش‌های بعدی کمک می‌کنند.',
      'پیش از انتخاب {n}، خوب است کاربرد، ویژگی‌ها و روش استفاده از آن را بشناسید؛ همهٔ این موارد در ادامه آمده است.',
      'این صفحه برای کسانی نوشته شده که می‌خواهند {n} را دقیق‌تر بشناسند و با نیاز روزمرهٔ خود بسنجند.',
      '{n} یکی از گزینه‌های دستهٔ {t} است؛ در این متن مشخصات، راهنمای انتخاب و پرسش‌های رایج آن را مرور می‌کنیم.'],
    chooseHead: ['راهنمای انتخاب {t} و نکات قبل از خرید', 'قبل از خرید {t} به چه نکاتی توجه کنیم؟', 'چگونه {t} مناسب نیاز خود را انتخاب کنیم؟', 'نکات مهم هنگام انتخاب {t}', 'برای خرید {t} چه معیارهایی مهم است؟', 'معیارهای انتخاب {t}'],
    chooseLead: ['پیش از خرید {t} این نکات را در نظر بگیرید:', 'برای انتخاب آگاهانهٔ {t} این موارد را بررسی کنید:', 'این معیارها به مقایسهٔ {t} با نیاز شما کمک می‌کنند:', 'پیش از ثبت سفارش {t}، موارد زیر را مرور کنید:', 'هنگام مقایسهٔ {t} با گزینه‌های دیگر این نکات کمک می‌کند:', 'برای تصمیم‌گیری دربارهٔ {t} این معیارها را در نظر بگیرید:'],
    deliverHead: ['بررسی سفارش هنگام تحویل', 'هنگام دریافت محصول چه چیزهایی را کنترل کنیم؟', 'نکات تحویل و بازبینی سفارش', 'تحویل {n}: چه چیزهایی را بررسی کنیم؟', 'پیش از استفاده از {n} بسته را کنترل کنید', 'کنترل بسته پس از دریافت', 'قبل از باز کردن بسته چه کنیم؟', 'چک‌لیست دریافت سفارش'],
    deliver: ['سالم‌بودن بسته‌بندی و پلمب را هنگام تحویل بررسی کنید', 'مطابقت محصول دریافتی با نام، رنگ و اندازهٔ سفارش را کنترل کنید', 'فاکتور و اطلاعات تماس فروشگاه را تا پایان دورهٔ استفاده نگه دارید', 'در صورت هرگونه مغایرت، پیش از استفاده با فروشگاه تماس بگیرید', 'هنگام باز کردن بسته، در صورت امکان از آن فیلم یا عکس بگیرید', 'برچسب‌ها و کد روی بسته را با اطلاعات سفارش مقایسه کنید', 'اگر لوازم جانبی همراه محصول است، کامل‌بودن آن را بررسی کنید', 'ایرادهای ظاهری را همان لحظهٔ تحویل به فروشگاه اطلاع دهید', 'کد و شمارهٔ سفارش روی بسته را با فاکتور تطبیق دهید', 'اگر بسته آسیب دیده است، پیش از امضای رسید آن را به پیک نشان دهید', 'تاریخ و شمارهٔ فاکتور را همراه محصول نگه دارید', 'تعداد اقلام داخل بسته را با سفارش خود بشمارید', 'محصول را پیش از دور ریختن جعبه یک بار امتحان یا بررسی کنید', 'اگر قطعه‌ای کم یا شل به نظر می‌رسد، همان روز گزارش دهید', 'نام گیرنده و نشانی روی برچسب ارسال را کنترل کنید', 'دفترچهٔ راهنما و کارت‌های همراه را دور نریزید'],
    leadWho: ['این محصول بیشتر برای گروه‌های زیر مناسب است:', 'اگر در یکی از این گروه‌ها قرار دارید، {t} می‌تواند گزینهٔ مناسبی باشد:', '{t} معمولاً برای این دسته از کاربران در نظر گرفته می‌شود:'],
    leadUse: ['برای استفادهٔ بهتر از {t} این نکات را رعایت کنید.', 'استفادهٔ درست و نگهداری مناسب به حفظ کیفیت {t} کمک می‌کند.', 'پیش از اولین استفاده از {n}، موارد زیر را بخوانید.'],
    summary: ['برای دیدن قیمت و موجودی روز {n}، همین صفحه را بررسی کنید. اگر دربارهٔ مشخصات یا نحوهٔ استفاده سؤالی داشتید، پیش از ثبت سفارش از فروشگاه بپرسید.',
      'قیمت و موجودی روز {n} در همین صفحه نمایش داده می‌شود. اگر پیش از خرید ابهامی دارید، سؤال خود را از فروشگاه بپرسید.',
      'پس از مرور مشخصات و نکات بالا، {n} را با نیاز خود مقایسه کنید و برای قیمت و موجودی روز به همین صفحه سر بزنید.',
      'اگر {n} نیاز شما را پوشش می‌دهد، قیمت و موجودی امروز را در همین صفحه ببینید؛ برای هر پرسش دیگری با فروشگاه در ارتباط باشید.',
      'برای تصمیم نهایی دربارهٔ {n}، مشخصات بالا را مرور کنید و قیمت و موجودی روز را از همین صفحه بررسی کنید.',
      'قیمت و موجودی {n} ممکن است تغییر کند؛ آخرین وضعیت را همین‌جا ببینید و سؤال‌های خود را پیش از سفارش بپرسید.'],
    faqPrice: [['قیمت و موجودی این {t} را از کجا ببینم؟', 'قیمت و موجودی روز این محصول در همین صفحه نمایش داده می‌شود و ممکن است تغییر کند.'],
      ['آخرین قیمت و موجودی این {t} چقدر است؟', 'قیمت امروز و وضعیت موجودی {n} بالای همین صفحه دیده می‌شود؛ چون این مقدارها تغییر می‌کنند، پیش از سفارش یک بار دیگر آن‌ها را بررسی کنید.'],
      ['قیمت و موجودی این {t} را کجا می‌توان دید؟', 'وضعیت موجودی و قیمت روز در همین صفحه ثبت می‌شود؛ اگر دکمهٔ افزودن به سبد فعال است، سفارش‌دادن ممکن است.'],
      ['برای دانستن قیمت و موجودی این {t} چه کنم؟', 'همین صفحه را باز کنید؛ قیمت و موجودی فعلی کنار تصویر محصول نمایش داده می‌شود و هر زمان ممکن است به‌روز شود.'],
      ['قیمت و موجودی این {t} ثابت است؟', 'قیمت و موجودی ممکن است در طول زمان تغییر کند؛ مقدار معتبر همان است که هنگام سفارش در همین صفحه می‌بینید.']],
    faqOrder: [['چگونه این {t} را سفارش دهم؟', 'محصول را به سبد خرید اضافه کنید و مراحل ثبت سفارش و پرداخت را تکمیل کنید.'],
      ['مراحل سفارش این {t} چیست؟', 'پس از افزودن به سبد خرید، نشانی و روش ارسال را وارد کنید و پرداخت را نهایی کنید تا سفارش ثبت شود.'],
      ['سفارش این {t} را از کجا شروع کنم؟', 'از همین صفحه دکمهٔ افزودن به سبد را بزنید، سپس اطلاعات تحویل را کامل کنید و سفارش را ثبت کنید.'],
      ['ثبت سفارش این {t} چطور انجام می‌شود؟', 'ابتدا محصول را به سبد اضافه کنید، بعد اطلاعات گیرنده را بنویسید و پرداخت را انجام دهید؛ پس از ثبت، سفارش پیگیری می‌شود.'],
      ['اگر بخواهم این {t} را سفارش دهم چه مراحلی دارد؟', 'محصول را در سبد خرید قرار دهید، فرم تحویل را پر کنید و روش پرداخت را انتخاب کنید؛ پس از تأیید، سفارش شما ثبت می‌شود.']],
    faqFact: ['مقدار یا اندازهٔ این {t} چقدر است؟', 'این {t} در چه رنگی است؟', 'جنس این {t} چیست؟', 'مدل این {t} چیست؟', 'این {t} محصول کدام برند است؟'],
    nameWho: [[[], 'کسی که به دنبال {t} مناسب برای استفادهٔ روزمره است'], [['q'], 'کاربری که اندازهٔ {q} را برای {t} خود مناسب می‌داند'], [['m'], 'خریداری که {t} با جنس {m} را ترجیح می‌دهد'], [['c'], 'کسی که رنگ {c} را با فضای خود هماهنگ‌تر می‌بیند'], [['md'], 'کسی که مدل {md} را می‌شناسد و دنبال همان مدل است'], [['b'], 'مشتری‌ای که با برند {b} آشنایی دارد'], [[], 'کسی که پیش از خرید {t} مشخصات را با دقت مقایسه می‌کند']],
    nameBuy: [[[], 'کاربرد مورد نظر خود از {t} را مشخص کنید و با مشخصات {n} مقایسه کنید'], [['q'], 'مطمئن شوید اندازهٔ {q} با فضا و مصرف شما هماهنگ است'], [['m'], 'جنس {m} را با شرایط استفاده و روش شست‌وشوی خود تطبیق دهید'], [['c'], 'رنگ {c} را با تصویر و محیط استفاده مقایسه کنید'], [['md'], 'کد مدل {md} را با آنچه روی بسته نوشته شده تطبیق دهید'], [['b'], 'برای {t} برند {b} به برگهٔ همراه و خدمات فروشگاه توجه کنید'], [[], 'قیمت و موجودی {n} را همین‌جا ببینید و با نیاز خود بسنجید'], [[], 'اگر {t} را برای هدیه می‌خرید، مشخصات ثبت‌شده را با سلیقهٔ گیرنده مقایسه کنید']],
    nameUse: [[[], 'پیش از اولین استفاده از {n}، دستورالعمل همراه محصول را بخوانید'], [['m'], 'برای {t} {m} از وسایل و مواد مناسب جنس آن استفاده کنید'], [['q'], 'از ظرفیت یا اندازهٔ {q} فراتر نروید و آن را با مصرف واقعی تنظیم کنید'], [[], '{t} را طبق کاربرد پیش‌بینی‌شدهٔ آن به کار ببرید'], [['c'], 'برای حفظ ظاهر {t} {c}، توصیه‌های نگهداری را جدی بگیرید']],
    nameCare: [[[], '{n} را پس از استفاده تمیز و خشک نگه دارید'], [['m'], 'برای نگهداری {t} {m} از شوینده‌های ملایم استفاده کنید'], [['c'], 'برای حفظ ظاهر {t} {c} از تماس با مواد خشن دوری کنید'], [[], '{t} را در جای خشک و دور از دسترس کودکان نگه دارید'], [[], 'پیش از جابه‌جایی یا انبار کردن {n}، از سالم‌بودن آن مطمئن شوید']],
    compare: ['برای مقایسهٔ {n} با {t} دیگر، {bits} را کنار هم بگذارید و با نیاز خود بسنجید.', 'هنگام مقایسهٔ {n} با گزینه‌های هم‌دسته، {bits} را بررسی کنید.', 'اگر بین چند {t} مردد هستید، {bits} را برای {n} با بقیه مقایسه کنید.'],
    wordHead: ['ویژگی «{w}» در {n}', 'منظور از «{w}» در نام {n}', '«{w}» در {n} یعنی چه؟'],
    wordText: ['نام این محصول شامل «{w}» است؛ پیش از سفارش، توضیحات فروشگاه را برای روشن‌شدن معنای دقیق این ویژگی بخوانید.', 'عبارت «{w}» در نام {n} آمده است؛ اگر دربارهٔ آن سؤالی دارید، پیش از خرید از فروشگاه بپرسید.'],
    labels: ['خلاصهٔ ویژگی‌ها', 'جمع‌بندی', 'نکات استفاده', 'نگهداری', 'این {t} مناسب چه کسانی است؟', 'روش استفاده و نگهداری از {t}'],
  };

  /* ---------- v1.70 (step 25): wider pools so fixed sentences rarely repeat between products ---------- */
  TPL.intro.push('هر خریدی با شناخت محصول شروع می‌شود؛ این صفحه {n} را از نظر کاربرد، مشخصات و نکات استفاده معرفی می‌کند.',
    'اگر می‌خواهید پیش از سفارش {n} را بهتر بشناسید، مشخصات ثبت‌شده و راهنمای کوتاه {t} در همین صفحه آمده است.',
    '{n} در این متن به‌صورت خلاصه و کاربردی توضیح داده شده تا انتخاب {t} برای شما ساده‌تر شود.',
    'برای کسی که دربارهٔ {t} تحقیق می‌کند، مشخصات {n} و پرسش‌های رایج آن در ادامه یکجا آمده است.');
  TPL.leadWho.push('{t} را بیشتر این گروه‌ها می‌پسندند:', 'این محصول معمولاً برای کاربران زیر در نظر گرفته می‌شود:', 'اگر خودتان را در این فهرست می‌بینید، {t} می‌تواند به کارتان بیاید:');
  TPL.leadUse.push('چند نکتهٔ ساده برای استفادهٔ راحت‌تر از {t} در ادامه آمده است.', 'پیش از شروع، این توصیه‌ها دربارهٔ {t} را مرور کنید.', 'رعایت چند توصیهٔ ساده، تجربهٔ استفاده از {n} را راحت‌تر می‌کند.');
  TPL.chooseLead.push('پیش از آنکه {t} را به سبد اضافه کنید، این موارد را کنار هم بگذارید:', 'برای اینکه {t} مناسب‌تری برگزینید، از این فهرست کمک بگیرید:');
  TPL.deliver.push('بسته را زیر نور کافی باز کنید تا ایرادهای احتمالی دیده شود', 'اگر در بسته مهر یا برچسب ایمنی هست، سالم‌بودن آن را ببینید', 'نام و مشخصات روی محصول را با صفحهٔ سفارش در سایت مقایسه کنید', 'اگر چند محصول سفارش داده‌اید، هر کدام را جداگانه کنترل کنید', 'نخستین شکایت یا ایراد را همراه عکس به فروشگاه ارسال کنید', 'پیش از دور ریختن کارتن و پوشش‌ها، از سالم‌بودن محصول مطمئن شوید', 'شمارهٔ پیگیری مرسوله را تا پایان بررسی سفارش نگه دارید', 'بوی نامعمول، شکستگی یا نشتی احتمالی را فوراً اطلاع دهید', 'اگر محصول قابل‌شست‌وشو یا نصب است، پیش از آن ظاهر آن را بررسی کنید', 'گزارش مشکل را تا جای ممکن با ذکر شمارهٔ سفارش ارسال کنید', 'پس از تحویل، یک بار همهٔ اجزای محصول را کنار هم بگذارید', 'اگر دفترچه به زبان دیگری است، پیش از استفاده از فروشگاه راهنمایی بخواهید', 'سلامت درپوش‌ها، بست‌ها و بندهای بسته را کنترل کنید', 'تصویر سفارش را با ظاهر واقعی محصول مقایسه کنید', 'مدت زمان تحویل را با آنچه هنگام سفارش دیده بودید تطبیق دهید', 'سفارش را در حضور پیک یا بلافاصله پس از دریافت بررسی کنید');
  TPL.summary.push('{n} را با نیاز خود بسنجید و برای دیدن قیمت و موجودی همین امروز به بالای این صفحه نگاه کنید؛ اگر پرسشی ماند، از فروشگاه بپرسید.',
    'قیمت روز و وضعیت موجودی {n} کنار همین متن نمایش داده می‌شود؛ پیش از سفارش، مشخصات را یک بار دیگر مرور کنید.',
    'اگر هنوز بین چند گزینه مردد هستید، مشخصات {n} را با بقیه مقایسه و سپس قیمت و موجودی را بررسی کنید.',
    'برای ثبت سفارش {n}، ابتدا مشخصات را با نیاز خود تطبیق دهید، بعد به قیمت و موجودی روز همین صفحه توجه کنید.',
    'این صفحه خلاصه‌ای از مشخصات و نکات {n} است؛ جزئیات قیمت و موجودی را در بالای صفحه ببینید و پرسش‌هایتان را بپرسید.',
    'پس از خواندن این راهنما، تصمیم دربارهٔ {n} ساده‌تر می‌شود؛ قیمت و موجودی روز در همین صفحه است.');
  TPL.faqPrice.push(['قیمت و موجودی این {t} کجا نوشته شده است؟', 'قیمت و موجودی در بخش بالای همین صفحه، کنار نام {n} آمده و ممکن است به‌روز شود.'],
    ['پیش از سفارش، وضعیت موجودی این {t} را چطور بدانم؟', 'وضعیت موجودی و قیمت فعلی هنگام باز کردن همین صفحه نشان داده می‌شود؛ برای اطمینان بیشتر پیش از پرداخت دوباره آن را ببینید.'],
    ['قیمت امروز این {t} چقدر است؟', 'مبلغ روز و موجودی در همین صفحه درج می‌شود؛ چون ممکن است در طول زمان تغییر کند، به مقدار هنگام سفارش اعتماد کنید.']);
  TPL.faqOrder.push(['خرید این {t} چند مرحله دارد؟', 'محصول را به سبد اضافه می‌کنید، اطلاعات تحویل و روش پرداخت را کامل می‌کنید و سفارش را نهایی می‌کنید.'],
    ['برای سفارش این {t} چه اطلاعاتی لازم است؟', 'نام گیرنده، نشانی و شمارهٔ تماس را هنگام ثبت سفارش وارد می‌کنید و سپس پرداخت را انجام می‌دهید.'],
    ['ثبت سفارش {n} از کجا ممکن است؟', 'از همین صفحه با دکمهٔ افزودن به سبد؛ بعد مراحل تکمیل سفارش را دنبال کنید.']);
  TPL.nameBuy.push([[], 'پیش از ثبت سفارش، کاربرد موردنظر خود را با توضیحات {n} تطبیق دهید'], [[], 'نیاز واقعی خود را بنویسید و ببینید {n} کدام بخش آن را پوشش می‌دهد'], [[], 'تصاویر و مشخصات {n} را یک بار با دقت مرور کنید'], [[], 'اگر برای {t} محدودیت فضا یا بودجه دارید، آن را از قبل مشخص کنید'], [[], 'درخواست‌های خاص خود را پیش از سفارش با فروشگاه در میان بگذارید'], [[], 'با خواندن پرسش‌های همین صفحه، ابهام‌های رایج {t} را برطرف کنید'], [[], 'زمان و مکان استفاده از {t} را مشخص کنید تا انتخاب دقیق‌تر شود'], [[], 'ببینید {n} با وسایلی که از قبل دارید هماهنگ است یا نه'],
    [['q'], 'اندازهٔ {q} را با نیاز مصرف خود بسنجید تا برای دورهٔ موردنظر کافی باشد'], [['m'], 'جنس {m} را از نظر دوام و راحتی با کاربرد موردنظرتان مقایسه کنید'], [['c'], 'رنگ {c} را با سلیقه و وسایل اطراف خود هماهنگ کنید'], [['md'], 'کد {md} را در توضیحات و روی بسته بررسی کنید'], [['b'], 'اگر برند {b} را می‌شناسید، مشخصات آن را با تجربهٔ قبلی خود مقایسه کنید']);
  TPL.nameUse.push([[], 'پیش از شروع، توضیحات همراه {n} را یک بار بخوانید'], [[], 'در نخستین استفاده از {t} آرام و با احتیاط شروع کنید'], [[], '{t} را فقط برای کاربردی که برایش در نظر گرفته شده به کار ببرید'], [[], 'اگر روی بسته برچسب هشدار هست، پیش از استفاده آن را بخوانید'], [[], 'چند استفادهٔ اول، رفتار {t} را با دقت زیر نظر بگیرید'], [[], 'روش پیشنهادی سازنده را بر عادت‌های قبلی خود ترجیح دهید'], [['q'], 'مقدار مصرف را با اندازهٔ {q} هماهنگ کنید'], [['m'], 'با توجه به جنس {m}، از فشار یا حرارت نامناسب پرهیز کنید'], [['c'], 'پس از هر بار استفاده، ظاهر {t} {c} را بررسی کنید']);
  TPL.nameCare.push([[], 'بعد از هر بار استفاده، {n} را بررسی و در صورت نیاز تمیز کنید'], [[], '{t} را در محیطی بدون رطوبت و گرمای شدید نگه دارید'], [[], 'برای نگهداری طولانی، {t} را در جای مناسب و دور از گردوغبار بگذارید'], [[], 'اگر مدتی از {n} استفاده نمی‌کنید، آن را تمیز و خشک جمع کنید'], [[], 'از ضربه و افتادن {t} پرهیز کنید'], [[], 'سطح {n} را با پارچهٔ نرم پاک کنید'], [['m'], 'جنس {m} را با مواد شوینده یا نگهداری سازگار با آن نگه دارید'], [['q'], 'اگر {t} {q} را انبار می‌کنید، جای آن را با اندازه‌اش هماهنگ کنید']);
  TPL.nameWho.push([[], 'کسی که می‌خواهد {t} را با نیاز واقعی خود مقایسه و سپس انتخاب کند'], [[], 'خریداری که پیش از ثبت سفارش، مشخصات را مرور می‌کند'], [[], 'کاربری که برای استفادهٔ شخصی یا هدیه به {t} نیاز دارد'], [['q'], 'کسی که اندازهٔ {q} با مصرف او جور است'], [['c'], 'خریداری که رنگ {c} را ترجیح می‌دهد']);
  TPL.compare.push('اگر چند {t} را کنار هم می‌گذارید، برای {n} این موارد را بسنجید: {bits}.', '{bits} از مواردی است که هنگام مقایسهٔ {n} با گزینه‌های دیگر باید به آن توجه کنید.');
  TPL.faqHead = ['پرسش‌های متداول دربارهٔ {n}', 'سؤال‌های رایج دربارهٔ {n}', 'پرسش‌هایی که خریداران دربارهٔ {n} می‌پرسند', '{n}: پاسخ پرسش‌های پرتکرار', 'پرسش و پاسخ دربارهٔ {n}'];
  TPL.sumHead = ['جمع‌بندی', 'نکتهٔ پایانی', 'پیش از تصمیم نهایی', 'در یک نگاه', 'سخن آخر دربارهٔ {n}'];
  TPL.whatHead = ['معرفی {n}', '{n} چیست و چه کاربردی دارد؟', 'درباره {n}', '{n} برای چه مصرفی مناسب است؟', 'شناخت {n}'];
  /** Every fixed sentence the Studio can emit (family texts + the constants above) as regexes; the product name/type are wildcards. */
  let TPL_RE = null;
  function templateRegexes() {
    if (TPL_RE) return TPL_RE;
    const raw = []; const add = (x) => { if (typeof x === 'string') raw.push(x); else if (Array.isArray(x)) x.forEach(add); };
    [TPL.intro, TPL.nameBuy, TPL.nameUse, TPL.nameCare, TPL.nameWho, TPL.compare, TPL.wordText, TPL.leadWho, TPL.leadUse, TPL.chooseHead, TPL.chooseLead, TPL.deliverHead, TPL.deliver, TPL.summary, TPL.faqPrice, TPL.faqOrder, TPL.faqFact, TPL.labels, TPL.faqHead, TPL.sumHead, TPL.whatHead].forEach(add);
    ((Data && Data.FAMILIES) || []).concat(Data && Data.GENERIC ? [Data.GENERIC] : []).forEach((f) => { ['what', 'who', 'buy', 'use', 'care', 'faq'].forEach((k) => add(f[k])); });
    const esc2 = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    TPL_RE = raw.map((t) => norm(t)).filter((t) => t.length >= 18).sort((a, b) => b.length - a.length)
      .map((t) => new RegExp(esc2(t).replace(/\\\{n\\\}|\\\{t\\\}/g, '[^.؟!]{1,70}?'), 'g'));
    return TPL_RE;
  }
  /** Normalised text with every fixed Studio sentence removed: what remains is specific to the product. */
  function stripTemplate(text) { let t = norm(text); templateRegexes().forEach((re) => { t = t.replace(re, ' '); }); return t.replace(/\s+/g, ' ').trim(); }

  /* ---------- family detection (boundary-safe: «کت» must not match «کتری») ---------- */
  let COMPILED = null;
  function compiled() {
    if (COMPILED) return COMPILED;
    COMPILED = ((Data && Data.FAMILIES) || []).map((f) => ({ f, re: new RegExp('(?<![\\p{L}\\p{N}])(?:' + f.re.source + ')(?![\\p{L}\\p{N}])', 'iu') }));
    return COMPILED;
  }
  /** Most SPECIFIC match wins (the longest matched phrase), ties go to list order. «روغن موتور» beats «روغن»; «لپ‌تاپ» beats «تاپ». */
  function detectFamily(name) {
    const t = ' ' + norm(name).replace(/قهوه ?ای/g, ' ').replace(/لپ ?تاپ/g, 'لپتاپ') + ' '; // «قهوه‌ای» is a colour, not coffee
    let best = null; let bestLen = 0;
    for (const c of compiled()) {
      const g = c.g || (c.g = new RegExp(c.re.source, 'giu')); g.lastIndex = 0; let m; let top = 0;
      while ((m = g.exec(t))) { top = Math.max(top, Array.from(m[0]).length + (m.index <= 1 ? 5 : 0)); if (m[0] === '') g.lastIndex++; } // a match on the FIRST word is the head noun in Persian
      if (top > bestLen) { bestLen = top; best = c.f; }
    }
    return best || Data.GENERIC;
  }
  function slugify(name, maxWords) {
    const t = latinDigits(fixc(String(name || ''))).toLowerCase().replace(/[‌_]+/g, ' ').replace(/[^\p{L}\p{N}\s-]/gu, ' ');
    const w = t.split(/[\s-]+/).filter(Boolean).slice(0, maxWords || 7);
    return w.join('-');
  }
  function extraFacts(text) {
    return String(text || '').split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => { const m = l.match(/^([^:：=\-–]{2,30})\s*[:：=]\s*(.{1,120})$/); return m ? [plain(m[1]), plain(m[2])] : null; }).filter(Boolean);
  }
  const COMPOUND_TAIL = new Set(['بانک', 'دیسک', 'مموری', 'پد', 'کارت', 'باکس', 'کیت', 'استند', 'هولدر', 'اسپیکر', 'کنسول']);
  /** چگالی عبارت (تعداد دفعات ÷ کل واژه‌ها، ٪) روی متنِ تکه‌های HTML. */
  function phraseDensity(parts, phrase) {
    const k = norm(phrase); if (!k) return 0; const tx = norm(parts.join(' ').replace(/<[^>]+>/g, ' ')); const total = tx.split(' ').filter(Boolean).length; if (!total) return 0;
    let c = 0, p = 0; while ((p = tx.indexOf(k, p)) !== -1) { if (p === 0 || !/[\u0600-\u06ffa-z0-9]/.test(tx[p - 1])) c++; p += k.length; } return (c / total) * 100;
  }
  function thinKeyword(parts, n, T, maxPct) {
    const key = T || n; if (!key || phraseDensity(parts, key) <= maxPct) return parts;
    const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(?:این )?(?:' + [n, T].filter(Boolean).map((x) => escRe(esc(x))).join('|') + ')', 'g');
    for (let i = parts.length - 1; i >= 4 && phraseDensity(parts, key) > maxPct; i--) {
      const x = parts[i]; if (!/^<(?:p|li)>|^<ul>/.test(x) || /<a |<table|<h[1-6]/.test(x)) continue;
      parts[i] = x.replace(re, 'این محصول');
    }
    return parts;
  }
  /** آیا الگوی خانوادهٔ محصول، هر دو کلمهٔ نخست نوع را یک عبارت می‌گیرد؟ (اسم مرکب دوکلمه‌ای) */
  function famPhraseCovers(fam, w) {
    try {
      const c = compiled().find((x) => x.f === fam); if (!c || !w || w.length < 2) return false;
      const g = new RegExp(c.re.source, 'giu'); const s = ' ' + norm(w.slice(0, 2).join(' ')) + ' '; const a = norm(w[0]); const b = norm(w[1]); let m;
      while ((m = g.exec(s))) { const ph = norm(m[0]); if (ph.indexOf(a) >= 0 && ph.indexOf(b) > ph.indexOf(a)) return true; if (m[0] === '') g.lastIndex++; }
    } catch (e) {}
    return false;
  }
  function typeOf(p, fam) {
    const t = plain(p.type); if (/^[A-Za-z0-9\s.\-]+$/.test(t)) return fam.id === 'generic' ? 'محصول' : fam.label;
    if (fam.id === 'generic') return (t && len(t) <= 24 && !/\d/.test(t)) ? t : 'محصول';
    const w = t.split(' '); const compound = w.length > 1 && (COMPOUND_TAIL.has(norm(w[1])) || famPhraseCovers(fam, w)); /* v1.78: «فرنچ پرس»، «موکا پات»، «قهوه ساز» اسم دوکلمه‌ای‌اند؛ اگر الگوی خود خانواده کل عبارت را می‌گیرد، نوع کوتاه نشود */ return (t && len(t) <= 24 && !/\d/.test(t)) ? (w.length > 1 && len(w[0]) >= 3 && !compound ? w[0] : t) : fam.label; /* v1.69: «پاور بانک»، «هارد دیسک» stay whole */ // one-word type keeps the full keyphrase rare
  }

  const DANGLE = /^(?:\d+|کیلوگرم|کیلو|گرم|میلی‌?لیتر|میل|لیتر|سی‌?سی|عدد|تایی|بسته|جفت|سانتی‌?متر|میلی‌?متر|متر|وات|ولت|گیگابایت|گیگ|ترابایت|مگابایت|اینچ|لایه|نفره|رم|حافظه|مدل|سایز|برند|ضد|مخصوص|مناسب|ویژه|ظرفیت|توان|رنگ|جنس|طرح|نوع|اندازه|ابعاد|تعداد|میلی‌?آمپر|آمپر)$/;
  /** Shortens a long product name for title/meta at a clean word boundary (never ends on a dangling label, number or unit). */
  function compactName(n, max) {
    n = String(n).replace(/\s+/g, ' ').trim(); if (len(n) <= max) return n;
    const w = n.split(' '); let acc = []; for (const x of w) { if (len(acc.concat(x).join(' ')) > max) break; acc.push(x); }
    const modelNo = () => acc.length > 2 && /^[\d۰-۹]+$/.test(acc[acc.length - 1]) && /^[A-Za-z]{3,}$/.test(acc[acc.length - 2]); /* «Watch 4»: the number is part of the model */
    while (acc.length > 2 && !modelNo() && (DANGLE.test(latinDigits(norm(acc[acc.length - 1]))) || STOP.has(norm(acc[acc.length - 1])))) acc.pop();
    return acc.join(' ');
  }
  function pickTitle(n0, o, r, taken) {
    const n = compactName(n0, 42);
    const site = plain(o.site || ''); const c = [];
    if (site && len(site) <= 18) c.push('خرید ' + n + ' – مشخصات و قیمت | ' + site);
    c.push('خرید ' + n + ' – مشخصات و قیمت', 'خرید ' + n + ' | مشخصات و راهنما', 'خرید ' + n, n + ' | مشخصات', fit(n, 60));
    const ok = (v) => len(v) >= 20 && len(v) <= 60;
    let list = c.filter(ok); if (!list.length) list = [fit('خرید ' + n, 60)];
    let out = list.find((v) => !taken(norm(v))) || list[0];
    if (o.rules && o.rules.buyPrefix === 'never') out = out.replace(/^خرید\s+/, '');
    return out;
  }
  function pickMeta(n0, T, r, taken, bits) {
    const gen = (n) => {
    const c = (bits && bits.length ? [fit(n, 70) + ' (' + bits.slice(0, 2).join('، ') + '): مشخصات، راهنمای انتخاب ' + T + ' و نکات استفاده را بخوانید و با آگاهی سفارش دهید.'] : []).concat([
      n + '؛ مشخصات، راهنمای انتخاب ' + T + '، نکات استفاده و نگهداری را بخوانید و با آگاهی بیشتر سفارش دهید.',
      'مشخصات و قیمت ' + n + ' را ببینید؛ راهنمای انتخاب، روش استفاده و پرسش‌های متداول ' + T + ' در همین صفحه آمده است.',
      n + ' را با مشخصات ثبت‌شده، نکات خرید و راهنمای استفاده بررسی کنید و پیش از سفارش با نیاز خود مقایسه کنید.',
    ]);
      return c;
    };
    let n = compactName(n0, 70); let c = gen(n);
    if (c.some((v) => len(v.replace(/\s+/g, ' ')) > 160)) { n = compactName(n0, 40); c = gen(n); }
    const start = Math.floor(r() * c.length); const rot = c.slice(start).concat(c.slice(0, start)).map((v) => { v = v.replace(/\s+/g, ' '); return len(v) > 160 ? fit(v, 157).replace(/[،؛\s]+$/, '') + '.' : v; });
    return rot.find((v) => len(v) >= 70 && !taken(norm(v))) || rot.find((v) => len(v) >= 70) || rot[0];
  }
  function related(name, catalog, max) {
    const toks = (s) => norm(s).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
    const mine = new Set(toks(name)); const self = norm(name); const out = [];
    (Array.isArray(catalog) ? catalog : []).forEach((x) => {
      if (!x || !x.title || !x.url || norm(x.title) === self) return; let u; try { u = new URL(x.url); } catch (e) { return; } if (!/^https?:$/.test(u.protocol)) return;
      const sc = toks(x.title).filter((w) => mine.has(w)).length; if (sc >= 1) out.push({ title: plain(x.title), url: u.href, score: sc });
    });
    return out.sort((a, b) => b.score - a.score).slice(0, max || 4);
  }

  /** Main entry. opts: { site, siteUrl, brand, facts (text lines «کلید: مقدار»), categories, product, catalog, price, currency, sku, image, url, rules, takenTitle, takenMeta, seed } */
  function build(name, opts) {
    const o = opts || {}; const n = plain(name).replace(/^(?:خرید|قیمت|فروش|سفارش)\s+/, '').trim();
    if (len(n) < 3) return { ok: false, why: 'نام محصول خالی یا بسیار کوتاه است.' };
    if (len(n) > 140) return { ok: false, why: 'نام محصول بیش از حد طولانی است.' };
    const fam = detectFamily(n); const r = rng(hash32(n + '|' + (o.seed || '')));
    let p = FromName ? FromName.parseName(n, { brand: o.brand }) : { name: n, words: n.split(/\s+/), type: n.split(/\s+/).slice(0, 2).join(' '), brand: o.brand || '', models: [], qty: [], colors: [], materials: [] };
    if (p.words.length > 1 && p.colors.some((c) => norm(c) === norm(p.words[0]))) p = Object.assign({}, p, { words: p.words.slice(1), type: p.type.split(' ').slice(1).join(' ') }); // leading colour is not the product type
    const toFa = (x) => String(x).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
    if (p.qty && p.qty.length) p = Object.assign({}, p, { qty: p.qty.map((q) => Object.assign({}, q, { text: toFa(q.text) })) });
    const T = typeOf(p, fam); const focus = (FromName ? FromName.focus(p) : p.words.slice(0, 2).join(' ')) || n;
    const rows = (FromName ? FromName.factRows(p, { categories: o.categories, product: o.product }) : []).slice();
    extraFacts(o.facts).forEach(([k, v]) => { if (!rows.some((x) => x[0] === k)) rows.push([k, v]); });
    const szM = (latinDigits(fixc(n)).match(/(?:سایز|size)\s*[:：]?\s*(\d{2}(?:\.5)?|XXS|XS|S|M|L|XL|XXL|XXXL)(?![A-Za-z0-9])/i) || [])[1]; if (szM && !rows.some((x) => x[0] === 'سایز')) rows.push(['سایز', toFa(szM)]);
    const get = (k) => (rows.find((x) => x[0] === k) || [])[1];
    const nS = len(n) > 30 ? (T + (p.brand && !norm(T).includes(norm(p.brand)) ? ' ' + p.brand : '')) : n; // short name for body sentences
    const bits = ['جنس', 'رنگ', 'سایز', 'مقدار/اندازه', 'مدل', 'برند'].map((k) => get(k) && (k === 'مقدار/اندازه' ? 'اندازهٔ ' : k + ' ') + get(k)).filter(Boolean);
    extraFacts(o.facts).filter(([k, v]) => len(v) <= 24 && !['جنس', 'رنگ', 'سایز', 'مقدار/اندازه', 'مدل', 'برند', 'نوع محصول'].includes(k)).slice(0, 2).forEach(([k, v]) => bits.push(k + ' ' + v));
    const taken = (f) => (typeof f === 'function' ? f : () => false);
    const seo_title = pickTitle(n, o, r, taken(o.takenTitle)); const meta_description = pickMeta(n, T, r, taken(o.takenMeta), bits);
    const rot = (a) => { const s = Math.floor(r() * a.length); return a.slice(s).concat(a.slice(0, s)); };

    /* ----- FAQ: facts from the name first, then category-level answers ----- */
    const factFaq = [];
    if (get('مقدار/اندازه')) factFaq.push(['مقدار یا اندازهٔ این ' + T + ' چقدر است؟', 'طبق اطلاعات ثبت‌شده، مقدار یا اندازهٔ این محصول ' + get('مقدار/اندازه') + ' است؛ برای اطمینان از جزئیات، توضیحات و برچسب بسته را نیز بخوانید.']);
    if (get('سایز')) factFaq.push(['سایز این ' + T + ' چند است و چگونه سایز مناسب را انتخاب کنم؟', 'سایز ثبت‌شدهٔ این محصول ' + get('سایز') + ' است؛ اندازهٔ واقعی خود را با جدول سایز فروشگاه مقایسه کنید و اگر بین دو سایز مردد بودید پیش از سفارش بپرسید.']);
    if (get('رنگ')) factFaq.push(['این ' + T + ' در چه رنگی است؟', 'رنگ ثبت‌شدهٔ این محصول ' + get('رنگ') + ' است؛ ممکن است رنگ واقعی با تصویر در نمایشگرهای مختلف اندکی تفاوت داشته باشد.']);
    if (get('جنس')) factFaq.push(['جنس این ' + T + ' چیست؟', 'طبق اطلاعات ثبت‌شده، جنس این محصول ' + get('جنس') + ' است؛ برای نگهداری، دستورالعمل همراه بسته را دنبال کنید.']);
    if (get('مدل')) factFaq.push(['مدل این ' + T + ' چیست؟', 'مدل این محصول ' + get('مدل') + ' ثبت شده است؛ کد روی بسته را هنگام دریافت با آن مقایسه کنید.']);
    if (get('برند')) factFaq.push(['این ' + T + ' محصول کدام برند است؟', 'برند این محصول ' + get('برند') + ' ثبت شده است.']);
    const topicDup = (q) => factFaq.some((f) => ['سایز', 'رنگ', 'جنس', 'برند', 'مدل'].some((w) => f[0].includes(w) && q.includes(w)));
    const HANDLED = new Set(['نوع محصول', 'برند', 'مدل', 'جنس', 'رنگ', 'سایز', 'مقدار/اندازه', 'دسته‌بندی']);
    const extras = rows.filter((x) => !HANDLED.has(x[0]) && !/^مقدار \d/.test(x[0]) && len(x[1]) <= 120);
    extras.slice(0, 3).forEach(([k, v]) => factFaq.push(['«' + k + '» این ' + T + ' چیست؟', 'طبق اطلاعات ثبت‌شدهٔ فروشگاه، ' + k + ' این محصول «' + v + '» است؛ برای جزئیات بیشتر توضیحات و مشخصات همین صفحه را ببینید.']));
    const faqFam = rot(fam.faq).map(([q, a]) => [fill(q, n, T), fill(a, n, T)]).filter(([q]) => !topicDup(q));
    const faqFixed = [rot(TPL.faqPrice)[0], rot(TPL.faqOrder)[0]].map(([q, a]) => [fill(q, n, T), fill(a, n, T)]);
    const faqOut = factFaq.slice(0, 4).concat(faqFam.slice(0, Math.max(1, 5 - Math.min(4, factFaq.length) - 0))).concat(faqFixed).slice(0, 8);
    const faq = faqOut;

    /* ----- long description (HTML, no H1: the theme prints the title) ----- */
    const introV = TPL.intro.map((x) => fill(x, n, T));
    if (bits.length >= 2) introV.push(n + ' با ' + bits.slice(0, 3).join('، ') + ' در این صفحه معرفی شده است؛ مشخصات ثبت‌شده، نکات انتخاب و روش استفادهٔ ' + T + ' را در ادامه می‌خوانید.', 'اگر ' + T + ' با ' + bits.slice(0, 2).join(' و ') + ' می‌خواهید، ' + n + ' را با مشخصات، راهنمای خرید و پرسش‌های رایج در همین صفحه بررسی کنید.');
    const cut = (arr, k) => rot(arr).slice(0, k);
    const li = (a) => '<ul>' + a.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>';
    const h = [];
    const intro = pick(introV, r); h.push('<p>' + esc(intro) + '</p>');
    if (rows.length >= 2) h.push('<h2>خلاصهٔ ویژگی‌ها</h2>', li(rows.slice(0, 5).map((x) => x[0] + ': ' + x[1])));
    /* v1.68: every product gets sections built from ITS OWN facts + the owner's notes, and the order of the middle sections differs per product */
    const sec = {};
    const whatHead = fill(pick(TPL.whatHead, r), n, T);
    sec.what = ['<h2>' + esc(whatHead) + '</h2>', '<p>' + esc(fill(pick(fam.what, r), n, T)) + (bits.length ? ' بر اساس اطلاعات ثبت‌شده، این محصول با ' + esc(bits.slice(0, 4).join('، ')) + ' عرضه می‌شود.' : '') + '</p>'];
    if (rows.length >= 2) sec.specs = ['<h2>مشخصات ' + esc(T) + '</h2>', '<table><thead><tr><th>ویژگی</th><th>مقدار</th></tr></thead><tbody>' + rows.map((x) => '<tr><td>' + esc(x[0]) + '</td><td>' + esc(x[1]) + '</td></tr>').join('') + '</tbody></table>'];
    if (rows.filter((x) => x[0] !== 'نوع محصول').length >= 1) {
      const KL = (k) => (k === 'مقدار/اندازه' ? 'اندازه' : /^مقدار \d/.test(k) ? 'مقدار' : k);
      const FS = [(k, v) => k + ' ثبت‌شدهٔ ' + nS + ' «' + v + '» است.', (k, v) => 'در اطلاعات این محصول، ' + k + ' برابر «' + v + '» آمده است.', (k, v) => 'برای ' + nS + '، ' + k + ' «' + v + '» ثبت شده است.', (k, v) => k + ' این ' + T + ' «' + v + '» است؛ هنگام مقایسه با مدل‌های دیگر به آن توجه کنید.'];
      sec.facts = ['<h2>ویژگی‌های ثبت‌شدهٔ ' + esc(n) + '</h2>', '<p>' + rows.filter((x) => x[0] !== 'نوع محصول').slice(0, 6).map((x, i) => esc(FS[(Math.floor(r() * 97) + i) % FS.length](KL(x[0]), x[1]))).join(' ') + '</p>'];
    }
    /* v1.69: name-driven sections: one H2 per attribute found in the product name (size, colour, material, brand, model), each with its own long-tail phrase */
    const attrs = []; const q0 = p.qty && p.qty[0] && p.qty[0].text; const c0 = p.colors && p.colors[0]; const m0 = p.materials && p.materials[0]; const md0 = p.models && p.models[0];
    const A = (a, r2) => a[Math.floor(r2() * a.length)];
    const qu = p.qty && p.qty[0] ? norm(p.qty[0].unit || '').replace(/ /g, '') : '';
    const QC = /گیگ|ترابایت|مگابایت/.test(qu) ? 'st' : /آمپر/.test(qu) ? 'amp' : /لیتر|میل|سیسی/.test(qu) && !/میلیمتر/.test(qu) ? 'vol' : /گرم|کیلو/.test(qu) ? 'wt' : /متر|اینچ/.test(qu) ? 'len' : /وات|ولت/.test(qu) ? 'pw' : 'cnt';
    const QH = { st: [T + ' ' + q0 + ': ظرفیت چقدر کافی است؟', 'ظرفیت ثبت‌شده برای این ' + T + ' ' + q0 + ' است؛ آن را با حجم فایل‌ها، برنامه‌ها و نیاز چندساله‌ی خود مقایسه کنید و ظرفیت قابل‌استفاده را از توضیحات سازنده بررسی کنید.'],
      vol: [T + ' ' + q0 + ': حجم مناسب چه مصرفی است؟', 'حجم ثبت‌شده ' + q0 + ' است؛ دفعات مصرف و تعداد استفاده‌کنندگان را بسنجید تا ببینید این مقدار چند وقت کافی است و تاریخ مصرف را روی بسته بررسی کنید.'],
      wt: [T + ' ' + q0 + ': وزن یا مقدار مناسب', 'مقدار ثبت‌شده ' + q0 + ' است؛ آن را با مصرف ماهانه و شرایط نگهداری مقایسه کنید و تاریخ تولید و انقضا را روی بسته ببینید.'],
      len: [T + ' ' + q0 + ': اندازه با فضای شما هماهنگ است؟', 'اندازهٔ ثبت‌شده ' + q0 + ' است؛ پیش از سفارش، فضای محل استفاده و جای نگهداری را اندازه بگیرید تا با این ابعاد هماهنگ باشد.'],
      pw: [T + ' ' + q0 + ': توان و مصرف برق', 'توان یا ولتاژ ثبت‌شده ' + q0 + ' است؛ آن را با برق محل استفاده و ظرفیت پریز یا کابل‌کشی خود تطبیق دهید و برچسب فنی روی دستگاه را بخوانید.'],
      amp: [T + ' ' + q0 + ': چه دستگاهی را پوشش می‌دهد؟', 'مقدار ثبت‌شده ' + q0 + ' است؛ آن را با دستگاه‌هایی که می‌خواهید به کار ببرید مقایسه کنید و عدد دقیق را از برچسب فنی روی محصول بخوانید.'],
      cnt: [T + ' ' + q0 + ' برای چه مصرفی مناسب است؟', 'تعداد یا اندازهٔ ثبت‌شده ' + q0 + ' است؛ آن را با تعداد استفاده‌کنندگان و دفعات مصرف مقایسه کنید.'] };
    if (q0) attrs.push([QH[QC][0], QH[QC][1]]);
    const sz = (latinDigits(fixc(n)).match(/(?:سایز|size)\s*[:：]?\s*(\d{2}(?:\.5)?|XXS|XS|S|M|L|XL|XXL|XXXL)(?![A-Za-z0-9])/i) || [])[1];
    if (sz) attrs.push(['سایز ' + toFa(sz) + ' را چگونه انتخاب کنیم؟', 'سایز ثبت‌شدهٔ این ' + T + ' ' + toFa(sz) + ' است؛ جدول سایز فروشگاه را با اندازهٔ واقعی خود مقایسه کنید و اگر بین دو سایز مردد هستید، پیش از سفارش از فروشگاه راهنمایی بگیرید.']);
    if (m0) attrs.push([T + ' ' + m0 + ': نکات انتخاب و نگهداری', A(['در اطلاعات این محصول جنس «' + m0 + '» ثبت شده است؛ برای نگهداری ' + T + ' ' + m0 + ' دستورالعمل شست‌وشو و کاربرد را از بستهٔ محصول دنبال کنید.', 'اگر ' + T + ' ' + m0 + ' می‌خواهید، جنس ثبت‌شده را با شرایط استفادهٔ خود (دما، شست‌وشو، تماس با مواد غذایی یا پوست در صورت لزوم) مقایسه کنید.'], r)]);
    if (c0) attrs.push([T + ' ' + c0 + ' و هماهنگی با محیط', A(['رنگ ثبت‌شدهٔ این محصول ' + c0 + ' است؛ ممکن است رنگ واقعی با تصویر در نمایشگرهای مختلف اندکی تفاوت داشته باشد.', 'برای انتخاب ' + T + ' ' + c0 + ' به رنگ محیط استفاده و سایر وسایل کنار آن توجه کنید؛ رنگ ثبت‌شده «' + c0 + '» است.'], r)]);
    if (p.brand) attrs.push(['درباره برند ' + p.brand, 'این محصول با نام برند «' + p.brand + '» ثبت شده است؛ برای اطلاعات رسمی برند، گارانتی و خدمات پس از فروش به برگهٔ همراه محصول مراجعه کنید.']);
    if (md0) attrs.push(['مدل ' + md0 + ' را چگونه تشخیص دهیم؟', 'کد مدل ثبت‌شده ' + md0 + ' است؛ هنگام دریافت، کد روی بسته یا بدنهٔ محصول را با همین کد مقایسه کنید.']);
    if (attrs.length) sec.attr = [].concat.apply([], attrs.slice(0, 4).map(([hd, tx]) => ['<h2>' + esc(hd) + '</h2>', '<p>' + esc(tx) + '</p>']));
    const notes = String(o.notes || '').split(/\n+/).map((l) => plain(l)).filter((l) => len(l) >= 12).slice(0, 8);
    if (notes.length) sec.notes = ['<h2>' + esc(pick(['نکات اختصاصی ' + n, 'آنچه دربارهٔ ' + n + ' باید بدانید', 'توضیحات تکمیلی ' + n], r)) + '</h2>'].concat(notes.map((x) => '<p>' + esc(fit(x, 400)) + '</p>'));
    const attrV = { m: m0, c: c0, q: q0, md: md0, b: p.brand };
    const f2 = (t) => fill(t, nS, T).replace(/\{(m|c|q|md|b)\}/g, (x, k) => attrV[k] || '');
    const okReq = (e) => e[0].every((k) => attrV[k]);
    const nameItems = (pool) => rot(pool.filter(okReq).map((e) => f2(e[1])));
    const tokOK = (() => { const ws = (p.words || []).map(norm).filter((w) => len(w) >= 3 && !STOP.has(w)); ws.push(norm(T)); return (x) => { const t = norm(x); return ws.some((w) => t.includes(w)); }; })();
    const mix = (pool, famList, k) => { const okp = pool.filter(okReq); const spec = rot(okp.filter((e) => e[0].length).map((e) => f2(e[1]))); const gen = rot(okp.filter((e) => !e[0].length).map((e) => f2(e[1]))); const fm2 = rot(famList.map((x) => fill(x, nS, T)).filter(tokOK)); return uniq(spec.slice(0, Math.max(1, k - 2)).concat(fm2.slice(0, k - 1), gen)).slice(0, k); }; /* v1.70: product-specific lines first, then category lines, fixed generic lines only to fill */
    sec.who = ['<h2>این ' + esc(T) + ' مناسب چه کسانی است؟</h2>', '<p>' + esc(fill(pick(TPL.leadWho, r), n, T)) + '</p>', li(mix(TPL.nameWho, fam.who, 3))];
    sec.choose = ['<h2>' + esc(fill(pick(TPL.chooseHead, r), n, T)) + '</h2>', '<p>' + esc(fill(pick(TPL.chooseLead, r), n, T)) + '</p>', li(mix(TPL.nameBuy, fam.buy, 4))];
    sec.use = ['<h2>روش استفاده و نگهداری از ' + esc(T) + '</h2>', '<p>' + esc(fill(pick(TPL.leadUse, r), n, T)) + '</p>', '<h3>' + esc(pick(['نکات استفاده', 'روش استفاده', 'توصیه‌های کاربردی'], r)) + '</h3>', li(mix(TPL.nameUse, fam.use, 3)), '<h3>' + esc(pick(['نگهداری', 'مراقبت و نگهداری', 'نکات نگهداری'], r)) + '</h3>', li(mix(TPL.nameCare, fam.care, 3))];
    sec.deliver = ['<h2>' + esc(fill(pick(TPL.deliverHead, r), n, T)) + '</h2>', li(cut(TPL.deliver, 3))];
    if (bits.length) sec.compare = ['<h2>' + esc('مقایسهٔ ' + n + ' با ' + T + ' دیگر') + '</h2>', '<p>' + esc(fill(pick(TPL.compare, r), nS, T).replace('{bits}', bits.slice(0, 4).join('، '))) + '</p>'];
    const COLORS_SET = new Set(['مشکی', 'سفید', 'قرمز', 'آبی', 'سبز', 'زرد', 'طوسی', 'خاکستری', 'صورتی', 'بنفش', 'نارنجی', 'کرم', 'بژ']);
    const UNIT_W = /^(?:کیلوگرم|کیلو|گرم|میلی‌?لیتر|میل|لیتر|سی‌?سی|عدد|تایی|بسته|جفت|سانتی‌?متر|میلی‌?متر|متر|وات|ولت|گیگابایت|گیگ|ترابایت|مگابایت|اینچ|لایه|نفره)(?:ی)?$/;
    const brandNorm = norm(p.brand || '').split(/\s+/);
    const fm = n.match(/(?:ضد|مخصوص|مناسب|ویژه)\s+[\u0621-\u064A\u067E\u0686\u0698\u06A9\u06AF\u06CC\u200c]{2,}(?:\s+[\u0621-\u064A\u067E\u0686\u0698\u06A9\u06AF\u06CC\u200c]{2,})?/);
    let feat = fm ? fm[0].replace(/\s+/g, ' ').trim() : '';
    if (feat) { const parts = feat.split(' '); const keep = [parts[0]]; for (let i = 1; i < parts.length; i++) { const w = norm(parts[i]); if (STOP.has(w) || UNIT_W.test(w.replace(/ /g, '')) || COLORS_SET.has(w) || w === 'مدل' || w === 'برند' || brandNorm.includes(w)) break; keep.push(parts[i]); } feat = keep.length >= 2 ? keep.join(' ') : ''; }
    if (feat) sec.words = [
      '<h2>' + esc(pick([T + ' ' + feat + ': نکات انتخاب', T + ' ' + feat + ' را چگونه انتخاب کنیم؟', 'نکات مهم دربارهٔ ' + T + ' ' + feat], r)) + '</h2>',
      '<p>' + esc(pick(['در نام این محصول عبارت «' + feat + '» آمده است؛ برای اطمینان از ترکیبات یا مشخصات مرتبط با آن، توضیحات و برچسب روی بسته را بخوانید و در صورت نیاز از فروشگاه بپرسید.', 'ویژگی «' + feat + '» بخشی از معرفی این ' + T + ' است؛ جزئیات دقیق آن را از برگهٔ همراه محصول بررسی کنید و اگر شرایط خاصی دارید پیش از خرید مشورت بگیرید.'], r)) + '</p>'];
    const order = ['what', 'specs'].concat(rot(['attr', 'notes', 'compare', 'words', 'who', 'choose', 'use', 'deliver'].filter((k) => sec[k])));
    const orderFixed = notes.length ? ['what', 'notes', 'specs'].concat(rot(['attr', 'compare', 'words', 'who', 'choose', 'use', 'deliver'].filter((k) => sec[k]))) : order;
    orderFixed.filter((k) => sec[k]).forEach((k) => sec[k].forEach((x) => h.push(x)));
    const trust = [['ارسال', o.shipping], ['مرجوعی', o.returns], ['گارانتی', o.warranty]].map(([k, v]) => [k, plain(v)]).filter(([, v]) => len(v) >= 8);
    if (trust.length) h.push('<h2>ارسال، مرجوعی و گارانتی ' + esc(n) + '</h2>', '<ul>' + trust.map(([k, v]) => '<li><strong>' + k + ':</strong> ' + esc(fit(v, 300)) + '</li>').join('') + '</ul>');
    const rel = related(n, o.catalog, 4);
    if (rel.length) h.push('<h2>محصولات مرتبط با ' + esc(n) + '</h2>', '<ul>' + rel.map((x) => '<li><a href="' + esc(x.url) + '">' + esc(x.title) + '</a></li>').join('') + '</ul>');
    h.push('<h2>' + esc(fill(pick(TPL.faqHead, r), n, T)) + '</h2>'); faqOut.forEach(([q, a]) => h.push('<h3>' + esc(q) + '</h3>', '<p>' + esc(a) + '</p>'));
    const summary = fill(pick(TPL.summary, r), nS, T);
    h.push('<h2>' + esc(fill(pick(TPL.sumHead, r), nS, T)) + '</h2>', '<p>' + esc(summary) + '</p>');
    /* v1.78: چگالی عبارت نوع/نام (به‌ویژه اسم‌های دوکلمه‌ای مثل «فرنچ پرس») نباید به کلیدواژه‌چینی برسد؛ تکرارهای انتهای متن (پاراگراف/آیتم، نه تیتر/جدول/لینک) با «این محصول» عوض می‌شود. */
    thinKeyword(h, n, T, 2.4);
    const content = h.join('\n');

    /* ----- short description, keywords, tags, image, OG ----- */
    const exBits = bits.filter((b) => !norm(n).includes(norm(b.replace(/^(?:اندازهٔ|جنس|رنگ|مدل|برند)\s+/, ''))));
    let excerpt = n + (exBits.length ? ' با ' + exBits.slice(0, 3).join('، ') : '') + '. مشخصات، راهنمای انتخاب و پرسش‌های متداول در ادامهٔ همین صفحه آمده است.';
    if (len(excerpt) > 200) excerpt = fit(excerpt, 197) + '.';
    const lt = [feat ? T + ' ' + feat : '', q0 ? T + ' ' + q0 : '', m0 ? T + ' ' + m0 : '', c0 ? T + ' ' + c0 : '', m0 && c0 ? T + ' ' + m0 + ' ' + c0 : '', q0 && c0 ? T + ' ' + q0 + ' ' + c0 : '', md0 ? T + ' مدل ' + md0 : '', p.brand && md0 ? p.brand + ' ' + md0 : ''];
    const keywords = uniq([focus, 'خرید ' + focus, 'قیمت ' + focus, 'مشخصات ' + focus, 'راهنمای خرید ' + T, 'روش استفاده از ' + T, p.brand ? p.brand + ' ' + T : ''].concat(lt, lt.filter(Boolean).slice(0, 3).map((x) => 'خرید ' + x))).filter(Boolean).slice(0, 12);
    const tags = uniq([fam.id === 'generic' ? '' : T, p.brand, focus].concat(fam.tags)).filter((x) => x && len(x) <= 30).slice(0, 6);
    const colorBit = get('رنگ') ? ' رنگ ' + get('رنگ').split('،')[0] : '';
    const image_alt = fit(n + colorBit, 120); const slug = slugify(n, 7);

    /* ----- v1.68: images, category path, head tags, full JSON-LD. Only data the shop really supplies is emitted. ----- */
    const imgs = (Array.isArray(o.images) ? o.images : (o.image ? [o.image] : [])).map(String).filter((u) => /^https?:\/\//i.test(u)).slice(0, 8);
    const imageList = (imgs.length ? imgs : [null]).map((u, i) => ({ url: u, alt: i === 0 ? image_alt : fit(n + (i === 1 ? ' از نمای کنار' : ' تصویر ' + (i + 1)), 120), title: n, filename: slug + (i ? '-' + (i + 1) : '') + '.webp' }));
    const cats = (Array.isArray(o.categoryPath) ? o.categoryPath : []).map((c) => (typeof c === 'string' ? { name: c } : c)).filter((c) => c && plain(c.name)).slice(0, 4);
    const origin = (() => { try { return new URL(o.siteUrl).origin + '/'; } catch (e) { return ''; } })();
    const canonical = o.url ? String(o.url).replace(/[?#].*$/, '') : '';
    const price = o.price && Number(latinDigits(o.price).replace(/[^\d.]/g, ''));
    const nPlain = plain(h.slice(0, 3).join(' '));
    const product = { '@context': 'https://schema.org', '@type': 'Product', name: n, description: fit(excerpt, 300) };
    if (p.brand) product.brand = { '@type': 'Brand', name: p.brand };
    if (get('مدل')) product.model = get('مدل'); if (get('سایز')) product.size = get('سایز');
    const props = rows.filter((x) => !['نوع محصول', 'برند', 'مدل', 'جنس', 'رنگ', 'سایز', 'دسته‌بندی'].includes(x[0])).slice(0, 8).map(([k, v]) => ({ '@type': 'PropertyValue', name: /^مقدار\/اندازه$/.test(k) ? ({ st: 'ظرفیت', vol: 'حجم', wt: 'مقدار', len: 'اندازه', pw: 'توان/ولتاژ', cnt: 'تعداد' }[QC] || 'اندازه') : k, value: v }));
    if (props.length) product.additionalProperty = props; if (canonical) product.mainEntityOfPage = canonical;
    if (get('رنگ')) product.color = get('رنگ'); if (get('جنس')) product.material = get('جنس'); if (o.sku) product.sku = String(o.sku); if (canonical) product.url = canonical;
    if (o.gtin) product.gtin = String(latinDigits(o.gtin)).replace(/\D/g, ''); if (o.mpn) product.mpn = String(o.mpn);
    if (imgs.length) product.image = imgs.length === 1 ? imgs[0] : imgs;
    if (cats.length) product.category = cats.map((c) => plain(c.name)).join(' > ');
    if (price > 0) {
      product.offers = { '@type': 'Offer', price: String(price), priceCurrency: o.currency || 'IRR', availability: o.inStock === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', itemCondition: o.condition === 'used' ? 'https://schema.org/UsedCondition' : 'https://schema.org/NewCondition' };
      if (canonical) product.offers.url = canonical;
      if (o.priceValidUntil && /^\d{4}-\d{2}-\d{2}$/.test(String(o.priceValidUntil))) product.offers.priceValidUntil = String(o.priceValidUntil);
      if (o.site) product.offers.seller = { '@type': 'Organization', name: plain(o.site) };
    }
    const rv = o.reviews && Number(latinDigits(o.reviews.count)) >= 1 && Number(latinDigits(o.reviews.rating)) >= 1 && Number(latinDigits(o.reviews.rating)) <= 5 ? o.reviews : null; // real shop data only
    if (rv) product.aggregateRating = { '@type': 'AggregateRating', ratingValue: String(Number(latinDigits(rv.rating))), reviewCount: String(Number(latinDigits(rv.count))) };
    const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqOut.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
    let breadcrumb = null;
    if (origin) { const items = [{ '@type': 'ListItem', position: 1, name: plain(o.site) || 'خانه', item: origin }]; cats.forEach((c) => { const it = { '@type': 'ListItem', position: items.length + 1, name: plain(c.name) }; if (c.url && /^https?:\/\//i.test(c.url)) it.item = String(c.url); items.push(it); }); const last = { '@type': 'ListItem', position: items.length + 1, name: n }; if (canonical) last.item = canonical; items.push(last); breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items }; }
    const orgSchema = origin && o.site ? { '@context': 'https://schema.org', '@type': 'Organization', name: plain(o.site), url: origin } : null;
    const schema = { product, faq: faqSchema, breadcrumb, organization: orgSchema };
    const schemaJson = [product, faqSchema, breadcrumb, orgSchema].filter(Boolean).map((x) => '<script type="application/ld+json">' + JSON.stringify(x).replace(/</g, '\\u003c') + '</script>').join('\n');

    /* ----- indexability gate: a page with almost no real, product-specific data should not be indexed (thin content) ----- */
    const specific = rows.length + notes.length + trust.length;
    const indexable = o.forceIndex === true || specific >= 3;
    const robots = indexable ? 'index, follow, max-image-preview:large' : 'noindex, follow';
    const og = { og_title: seo_title.replace(/\s*\|\s*[^|]+$/, '') || seo_title, og_description: meta_description };
    const headTags = [];
    if (canonical) headTags.push('<link rel="canonical" href="' + esc(canonical) + '">');
    headTags.push('<meta name="robots" content="' + robots + '">');
    headTags.push('<meta property="og:type" content="product">', '<meta property="og:locale" content="fa_IR">', '<meta property="og:title" content="' + esc(og.og_title) + '">', '<meta property="og:description" content="' + esc(og.og_description) + '">');
    if (canonical) headTags.push('<meta property="og:url" content="' + esc(canonical) + '">');
    if (o.site) headTags.push('<meta property="og:site_name" content="' + esc(plain(o.site)) + '">');
    if (imgs[0]) headTags.push('<meta property="og:image" content="' + esc(imgs[0]) + '">', '<meta property="og:image:alt" content="' + esc(image_alt) + '">');
    if (price > 0) headTags.push('<meta property="product:price:amount" content="' + esc(String(price)) + '">', '<meta property="product:price:currency" content="' + esc(o.currency || 'IRR') + '">', '<meta property="product:availability" content="' + (o.inStock === false ? 'out of stock' : 'in stock') + '">');
    headTags.push('<meta name="twitter:card" content="' + (imgs[0] ? 'summary_large_image' : 'summary') + '">', '<meta name="twitter:title" content="' + esc(og.og_title) + '">', '<meta name="twitter:description" content="' + esc(og.og_description) + '">');
    if (imgs[0]) headTags.push('<meta name="twitter:image" content="' + esc(imgs[0]) + '">');
    const headHtml = headTags.join('\n');

    /* ----- what the owner should still confirm (never invented) ----- */
    const missing = []; if (!get('جنس')) missing.push('جنس یا ترکیب'); if (!rows.some((x) => /وزن|ابعاد|مقدار/.test(x[0]))) missing.push('اندازه، وزن یا حجم'); if (!get('برند')) missing.push('برند'); if (!imgs.length) missing.push('تصویر واقعی محصول (حداقل ۳ زاویه)'); if (!price) missing.push('قیمت و موجودی'); if (!o.gtin && !o.mpn) missing.push('بارکد (GTIN) یا کد قطعه (MPN)'); if (!notes.length) missing.push('نکات اختصاصی این محصول'); if (!rv) missing.push('نظر واقعی مشتریان (برای امتیاز ستاره‌ای)'); missing.push( 'گارانتی یا کشور سازنده (در صورت وجود)');

    const fields = { title: n, content, excerpt, seo_title, meta_description, focus_keyword: focus, related_keywords: keywords.join(', ') };
    const res = { ok: true, name: n, family: fam.id, familyLabel: fam.label, type: T, parsed: p, facts: rows, fields, keywords, tags, slug, image: { alt: image_alt, title: n, filename: slug + '.webp' }, images: imageList, og, head: { canonical, robots, html: headHtml }, indexable, faq: faqOut, schema, schemaJson, related: rel, missing, category: fam.cat };
    res.seoPlan = { focus, longTail: keywords.slice(1), title: seo_title, meta: meta_description, slug, h2: (content.match(/<h2>[\s\S]*?<\/h2>/g) || []).map((x) => plain(x)), imageAlts: imageList.map((x) => x.alt) }; res.parts = { intro, summary }; res.hasUrl = !!o.url;
    res.wordCount = plain(content).split(/\s+/).filter(Boolean).length;
    res.score = score(res);
    return res;
  }

  /* ---------- self-check: guidance score, NOT a Google ranking ---------- */
  function score(res) {
    const f = res.fields; const fk = norm(f.focus_keyword); const text = norm(f.content); const first = norm(plain(f.content).split(/\s+/).slice(0, 100).join(' '));
    const h2 = (f.content.match(/<h2>[\s\S]*?<\/h2>/g) || []).map(norm); const stripped = plain(f.content).split(res.name).join(' ');
    const c = [
      ['title_len', 'عنوان سئو ۲۰ تا ۶۰ نویسه', len(f.seo_title) >= 20 && len(f.seo_title) <= 60, 'عنوان را کوتاه یا بلندتر کنید.'],
      ['title_kw', 'عبارت کلیدی در عنوان سئو', norm(f.seo_title).includes(fk), 'عبارت کلیدی را به عنوان اضافه کنید.'],
      ['meta_len', 'متا دیسکریپشن ۷۰ تا ۱۶۰ نویسه', len(f.meta_description) >= 70 && len(f.meta_description) <= 160, 'طول متا را اصلاح کنید.'],
      ['meta_kw', 'عبارت کلیدی در متا', norm(f.meta_description).includes(fk), 'عبارت کلیدی را در متا بیاورید.'],
      ['kw_intro', 'عبارت کلیدی در ۱۰۰ واژهٔ اول', first.includes(fk), 'عبارت کلیدی را در پاراگراف اول بیاورید.'],
      ['kw_h2', 'عبارت کلیدی در حداقل یک H2', h2.some((x) => x.includes(fk)), 'یکی از زیرتیترها را با عبارت کلیدی بنویسید.'],
      ['words', 'حداقل ۴۰۰ واژه متن', res.wordCount >= 400, 'اطلاعات بیشتر (مشخصات واقعی) اضافه کنید.'],
      ['structure', 'دارای فهرست، زیرتیتر و جدول/پرسش‌وپاسخ', /<ul>/.test(f.content) && h2.length >= 4 && res.faq.length >= 3, 'ساختار متن را کامل کنید.'],
      ['alt', 'متن جایگزین تصویر دارای عبارت کلیدی', norm(res.image.alt).includes(fk), 'Alt تصویر را اصلاح کنید.'],
      ['claims', 'بدون ادعای تأییدنشده (اصل، ضمانت، بهترین…)', !BANNED_RE.test(norm(stripped + ' ' + f.seo_title + ' ' + f.meta_description)), 'ادعای تأییدنشده را حذف کنید.'],
      ['density', 'تراکم عبارت کلیدی بین ۰٫۳ تا ۳ درصد', (() => { const w = Math.max(1, res.wordCount); const k = text.split(fk).length - 1; const d = 100 * k / w; return d >= 0.3 && d <= 3; })(), 'عبارت کلیدی را کمتر یا بیشتر به‌کار ببرید.'],
      ['readability', 'جمله‌ها کوتاه و خوانا (میانگین حداکثر ۲۲ واژه)', (() => { const ss = f.content.replace(/<\/(?:li|p|h[1-6]|td|th|tr)>/g, '. ').replace(/<[^>]+>/g, ' ').split(/[.؟!]\s+/).filter((x) => x.length > 3); return ss.length && ss.reduce((a, x) => a + x.split(/\s+/).length, 0) / ss.length <= 22; })(), 'جمله‌های بلند را کوتاه کنید.'],
      ['unique', 'شباهت متن به محصول‌های دیگر کمتر از ۴۵٪', !res.similarity || res.similarity.max < 45, res.similarity ? 'شبیه «' + res.similarity.with + '» (' + res.similarity.max + '٪)؛ مشخصات واقعی و متمایز این محصول را اضافه کنید.' : ''],
      ['facts', 'حداقل ۲ مشخصهٔ واقعی ثبت‌شده', res.facts.length >= 2, 'جنس، اندازه یا برند را در فروشگاه ثبت کنید.'],
      ['longtail', 'عبارت بلندمدت برگرفته از نام در یکی از زیرتیترها', !res.seoPlan || !res.seoPlan.longTail.length || h2.some((x) => res.seoPlan.longTail.some((k) => x.includes(norm(k)))) || res.seoPlan.longTail.length < 3, 'در نام محصول ویژگی (اندازه، جنس، رنگ) بیاورید تا زیرتیتر اختصاصی ساخته شود.'],
      ['indexable', 'دادهٔ اختصاصی کافی برای ایندکس (حداقل ۳ مورد)', res.indexable !== false, 'مشخصه یا نکتهٔ اختصاصی بیشتری وارد کنید؛ تا آن زمان صفحه noindex می‌ماند.'],
    ].concat(res.head && res.head.canonical !== undefined && res.hasUrl ? [['canonical', 'آدرس canonical تنظیم شده', !!res.head.canonical, 'آدرس صفحهٔ محصول را وارد کنید.']] : []);
    const checks = c.map(([id, label, ok, tip]) => ({ id, label, ok: !!ok, tip: ok ? '' : tip }));
    return { value: Math.round(100 * checks.filter((x) => x.ok).length / checks.length), checks };
  }

  const shingles = (res) => { const t = norm(plain(res.fields.content).split(res.name).join(' ')).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean); const set = new Set(); for (let i = 0; i + 3 <= t.length; i++) set.add(t.slice(i, i + 3).join(' ')); return set; };
  const shingleText = (txt) => { const t = norm(txt).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean); const set = new Set(); for (let i = 0; i + 3 <= t.length; i++) set.add(t.slice(i, i + 3).join(' ')); return set; };
  const jacc = (a, b) => { if (!a.size || !b.size) return 0; let x = 0; a.forEach((v) => { if (b.has(v)) x++; }); return x / (a.size + b.size - x); };
  /** Thin/duplicate-content guard: 3-word shingle overlap against the other products in the batch and (optionally) existing shop texts. */
  function markSimilarity(results, existing) {
    const ok = results.filter((r) => r && r.ok); const sh = ok.map(shingles);
    const ex = (Array.isArray(existing) ? existing : []).filter((x) => x && x.text && len(plain(x.text)) > 200).slice(0, 300).map((x) => ({ title: plain(x.title), set: shingleText(x.text) }));
    ok.forEach((r, i) => { let max = 0, who = ''; sh.forEach((o, j) => { if (j === i) return; const v = jacc(sh[i], o); if (v > max) { max = v; who = ok[j].name; } }); ex.forEach((x) => { if (norm(x.title) === norm(r.name)) return; const v = jacc(sh[i], x.set); if (v > max) { max = v; who = x.title; } }); r.similarity = { max: Math.round(max * 100), with: who }; r.score = score(r); });
    return results;
  }
  /** Several names at once (one per line). Keeps titles/metas unique across the batch. */
  function buildMany(names, opts) {
    const o = Object.assign({}, opts || {}); const tt = new Set(), tm = new Set(); const seen = new Set(); const out = []; const prevSh = [];
    /* per-line facts: «نام محصول | ولتاژ: ۱۲ ولت؛ وزن: ۱ کیلوگرم» */
    const rawLines = (Array.isArray(names) ? names : String(names || '').split(/\n+/)).map((x) => String(x == null ? '' : x).trim()).filter(Boolean);
    const lineFacts = new Map(); const clean = rawLines.map((l) => { const i = l.indexOf('|'); if (i < 0) return l; const nm0 = l.slice(0, i).trim(); const fx = l.slice(i + 1).split(/[؛;]/).map((x) => x.trim()).filter(Boolean).join('\n'); if (fx) lineFacts.set(norm(plain(nm0)), fx); return nm0; });
    clean.map(plain).filter(Boolean).forEach((nm) => {
      const k = norm(nm); if (seen.has(k)) return; seen.add(k);
      const lf = lineFacts.get(k); const oo = lf ? Object.assign({}, o, { facts: [o.facts || '', lf].filter(Boolean).join('\n') }) : o;
      let r = null, rv = -1e9; for (let i = 0; i < 8; i++) { const c = build(nm, Object.assign({}, oo, { seed: String(o.seed || '') + (i ? '#' + i : ''), takenTitle: (v) => tt.has(v), takenMeta: (v) => tm.has(v) })); if (!c.ok) { r = c; break; } c.attempt = i + 1; const sh = shingles(c); let sim = 0; prevSh.forEach((x) => { const v = jacc(sh, x); if (v > sim) sim = v; }); c.pick = sh; const val = c.score.value - 80 * sim; if (!r || val > rv) { r = c; rv = val; } if (c.score.value >= 94 && sim < 0.2) break; }
      if (r.ok) { tt.add(norm(r.fields.seo_title)); tm.add(norm(r.fields.meta_description)); prevSh.push(r.pick); delete r.pick; } out.push(r);
    });
    return markSimilarity(out.slice(0, 50), o.existing);
  }
  /** Fields in the shape the Bridge agent/save endpoint already accepts. */
  function toSaveFields(res) { const f = res.fields; return { title: f.title, content: f.content, excerpt: f.excerpt, seo_title: f.seo_title, meta_description: f.meta_description, focus_keyword: f.focus_keyword, related_keywords: f.related_keywords, faq: res.faq.map(([q, a]) => ({ q, a })) }; }
  /** One copy-ready text package. */
  function toText(res) {
    const f = res.fields; return ['نام: ' + res.name, 'عبارت کلیدی: ' + f.focus_keyword, 'عنوان سئو: ' + f.seo_title, 'متا دیسکریپشن: ' + f.meta_description, 'اسلاگ: ' + res.slug, 'کلمات مرتبط: ' + f.related_keywords, 'برچسب‌ها: ' + res.tags.join('، '), 'توضیح کوتاه: ' + f.excerpt, 'Alt تصویر: ' + res.image.alt, 'نام فایل تصویر: ' + res.image.filename, 'عنوان Open Graph: ' + res.og.og_title, 'Robots: ' + (res.head ? res.head.robots : ''), 'کلمات بلندمدت (long-tail): ' + (res.seoPlan ? res.seoPlan.longTail.join('، ') : ''), '', '— تگ‌های head —', res.head ? res.head.html : '', '', '— توضیحات کامل (HTML) —', f.content, '', '— JSON-LD —', res.schemaJson].join('\n');
  }
  /** WooCommerce product-import CSV (draft, Yoast + Rank Math meta). Cells that could run as spreadsheet formulas are neutralised. */
  function toCsv(results) {
    const head = ['Type', 'Name', 'Published', 'Short description', 'Description', 'Tags', 'Meta: _yoast_wpseo_title', 'Meta: _yoast_wpseo_metadesc', 'Meta: _yoast_wpseo_focuskw', 'Meta: rank_math_title', 'Meta: rank_math_description', 'Meta: rank_math_focus_keyword'];
    const cell = (v) => { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    const rows = (results || []).filter((r) => r && r.ok).map((r) => { const f = r.fields; return ['simple', f.title, -1, f.excerpt, f.content, r.tags.join(', '), f.seo_title, f.meta_description, f.focus_keyword, f.seo_title, f.meta_description, f.focus_keyword]; });
    return [head].concat(rows).map((x) => x.map(cell).join(',')).join('\r\n');
  }
  const nums = (t) => (latinDigits(String(t)).match(/\d+(?:[.,]\d+)?/g) || []);
  /** Prompt for the optional on-device rewrite of the two free-text paragraphs only (facts, table, FAQ stay deterministic). */
  function polishPrompt(res) {
    const facts = res.facts.map((x) => x[0] + ': ' + x[1]).join('\n') || '(فقط نام)';
    return [{ role: 'system', content: 'تو سردبیر حرفه‌ای فروشگاه اینترنتی هستی. فقط فارسی روان، طبیعی و خوانا بنویس؛ جمله‌ها کوتاه و مشخص باشند و از کلیشه‌هایی مثل «در این صفحه معرفی می‌کنیم» پرهیز کن. فقط از واقعیت‌های فهرست‌شده استفاده کن؛ هیچ مشخصه، عدد، قیمت، گارانتی، کشور سازنده، ادعای «اصل/بهترین/ارزان» یا ویژگی خارج از فهرست نساز. فقط یک JSON معتبر برگردان: {"intro":"...","summary":"...","excerpt":"..."}' },
      { role: 'user', content: 'نام محصول: ' + res.name + '\nعبارت کلیدی: ' + res.fields.focus_keyword + '\nواقعیت‌های موجود:\n' + facts + '\n\nintro: یک پاراگراف ۲ تا ۳ جمله‌ای (۴۰ تا ۳۰۰ نویسه) که با عبارت کلیدی شروع یا آن را شامل شود و به‌جای ادعا، کاربرد و محتوای صفحه را روشن بگوید.\nsummary: ۲ جملهٔ پایانی (۴۰ تا ۳۰۰ نویسه) بدون تبلیغ که مشتری را به بررسی قیمت و موجودی و پرسیدن سؤال هدایت کند.\nexcerpt: توضیح کوتاه یک تا دو جمله‌ای (۶۰ تا ۱۹۰ نویسه) که نام یا عبارت کلیدی و مهم‌ترین مشخصهٔ واقعی را بگوید.' }];
  }
  /** Validates the model output; on any violation returns the untouched result (never fabricates). */
  function applyPolish(res, raw) {
    let j; try { j = JSON.parse(String(raw).replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, '$1')); } catch (e) { return { ok: false, why: 'خروجی مدل JSON معتبر نبود.' }; }
    const known = new Set(nums(res.name + ' ' + res.facts.map((x) => x.join(' ')).join(' '))); const fk = norm(res.fields.focus_keyword);
    for (const k of ['intro', 'summary']) {
      const v = plain(j && j[k]); if (len(v) < 40 || len(v) > 300) return { ok: false, why: 'طول ' + k + ' مجاز نیست.' };
      if (BANNED_RE.test(norm(v))) return { ok: false, why: 'ادعای تأییدنشده در ' + k + '.' };
      if (nums(v).some((x) => !known.has(x))) return { ok: false, why: 'عدد خارج از واقعیت‌ها در ' + k + '.' };
      if (/[<>{}\[\]]|https?:/i.test(v)) return { ok: false, why: 'نشانه‌گذاری غیرمجاز در ' + k + '.' };
    }
    if (!norm(j.intro).includes(fk)) return { ok: false, why: 'intro عبارت کلیدی ندارد.' };
    let ex = null;
    if (j.excerpt != null && String(j.excerpt).trim()) { const v = plain(j.excerpt); if (len(v) >= 50 && len(v) <= 200 && !BANNED_RE.test(norm(v)) && !nums(v).some((x) => !known.has(x)) && !/[<>{}\[\]]|https?:/i.test(v)) ex = v; }
    const c = res.fields.content.replace('<p>' + esc(res.parts.intro) + '</p>', '<p>' + esc(plain(j.intro)) + '</p>').replace('<p>' + esc(res.parts.summary) + '</p>', '<p>' + esc(plain(j.summary)) + '</p>');
    if (c === res.fields.content) return { ok: false, why: 'جایگزینی انجام نشد.' };
    const out = Object.assign({}, res, { fields: Object.assign({}, res.fields, { content: c }, ex ? { excerpt: ex } : {}), parts: { intro: plain(j.intro), summary: plain(j.summary) }, polished: true }); out.wordCount = plain(c).split(/\s+/).filter(Boolean).length; out.score = score(out);
    return { ok: true, res: out };
  }
  return { stripTemplate, TPL, markSimilarity, toCsv, polishPrompt, applyPolish, build, buildMany, detectFamily, slugify, score, toSaveFields, toText };
});
