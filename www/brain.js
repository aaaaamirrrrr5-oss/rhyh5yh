/* Site Inspector built-in assistant ("brain"): an offline, rule-based Persian analyst.
   It is NOT a language model. It understands a fixed set of intents, reads the real scan / traffic / WordPress data
   and produces computed answers and ready-to-paste files. Works with no API key and no network. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory; else factory(root.SI); })(typeof self !== 'undefined' ? self : this, function (SI) {
  'use strict';
  const FA = '۰۱۲۳۴۵۶۷۸۹';
  const faOut = (t) => String(t).split(/(```[\s\S]*?```|`[^`\n]*`)/).map((p, i) => (i % 2 ? p : p.replace(/\d/g, (d) => FA[d]))).join('');
  const norm = (s) => String(s || '').toLowerCase().replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/ة/g, 'ه').replace(/[أإ]/g, 'ا').replace(/ؤ/g, 'و').replace(/ئ/g, 'ی').replace(/[ً-ٟـ]/g, '')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => FA.indexOf(d)).replace(/‌/g, '').replace(/[؟?!,،؛:()«»"'‹›]/g, ' ').replace(/\.(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
  const pathOf = (u) => { try { const x = new URL(u); return decodeURIComponent(x.pathname) + (x.search || ''); } catch (e) { return String(u).replace(/^https?:\/\/[^/]+/, '') || '/'; } };
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const SR = () => (SI && SI.SeoRules) || (typeof require === 'function' ? (function () { try { return require('./seorules.js'); } catch (e) { return null; } })() : null);
  const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
  const SEVF = { critical: '🔴', high: '🟠', medium: '🟡', low: '⚪' };

  /* ---------- knowledge: how to fix, impact ---------- */
  const IMPACT = { http_error: 5, noindex: 5, missing_title: 5, no_https: 5, no_sitemap: 4, no_h1: 4, missing_desc: 4, no_viewport: 4, thin: 3, no_schema: 3, aeo_format: 3, multi_h1: 2, img_alt: 2, long_title: 2, no_canonical: 2, no_robots: 3, short_title: 1, long_desc: 1, og: 1, no_lang: 1, no_llms: 2 };
  const EFFORT0 = { thin: 3, aeo_format: 2, no_schema: 2, one_channel: 3 };
  function plugHint(ctx, text) { const pl = ctx.brief && ctx.brief.site && ctx.brief.site.seoPlugin; return pl ? text.replace('{P}', pl) : ''; }
  const HOW = {
    arabic_chars: () => 'همهٔ «ي» و «ك» عربی را به «ی» و «ک» فارسی تبدیل کن: در وردپرس افزونهٔ تبدیل حروف (مثل Persian Fixer) یا همین ابزار «اصلاح املا و نگارش» اپ؛ در عنوان، متا و H1 دستی هم بررسی کن.',
    arabic_digits: () => 'ارقام عربی-هندی (٠-٩) را با ۰-۹ جایگزین کن؛ معمولاً از کیبورد یا کپی‌کردن متن می‌آید.',
    no_trust_pages: () => 'سه صفحه بساز و در منو یا فوتر لینک بده: «تماس با ما» (نشانی/تلفن/ایمیل واقعی)، «درباره ما» (چه کسی و چرا) و «حریم خصوصی/قوانین». برای فروشگاه «شرایط ارسال و مرجوعی» هم اضافه کن.',
    schema_duplicate: () => 'خروجی اسکیما را در ابزار «Rich Results Test» ببین؛ معمولاً قالب و افزونهٔ سئو هر دو Organization/Product/BreadcrumbList می‌سازند. در تنظیمات یکی را خاموش کن تا فقط یک نسخه بماند.',
    img_bad_filename: () => 'نام فایل را پیش از بارگذاری توصیفی کن (french-press-glass.webp نه IMG_1234.jpg) و برای تصاویر قبلی با افزونهٔ تغییر نام رسانه اصلاح و ریدایرکت کن.',
    title_h1_unrelated: () => 'عنوان (title) و H1 را دربارهٔ یک موضوع بنویس و عبارت اصلی را در هر دو بیاور؛ H1 می‌تواند کمی طبیعی‌تر از title باشد ولی نباید موضوع دیگری را بگوید.',
    no_preconnect: () => 'برای دامنه‌های بیرونی که زود لازم‌اند <link rel="preconnect" href="https://دامنه" crossorigin> بگذار؛ بیشتر افزونه‌های کش (مثل WP Rocket) گزینهٔ «Preconnect» دارند.',
    font_display: () => 'در @font-face مقدار font-display: swap بگذار؛ برای Google Fonts به آدرس &display=swap اضافه کن یا فونت را روی سرور خودت میزبانی کن.',
    http_error: () => 'علت خطای سرور (۴۰۴/۵۰۰) را پیدا کن؛ صفحهٔ حذف‌شده را ریدایرکت ۳۰۱ بده یا درستش کن و آن را از نقشهٔ سایت بردار.',
    missing_title: (c) => 'برای هر صفحه عنوان یکتای ۳۰ تا ۶۰ نویسه بنویس و عبارت اصلی را اول بیاور. ' + plugHint(c, 'در {P}: فیلد «SEO title».'),
    long_title: (c) => 'عنوان را به حداکثر ۶۰ نویسه برسان و نام برند را آخرش بگذار. ' + plugHint(c, 'در {P}: فیلد «SEO title».'),
    short_title: () => 'عنوان را با عبارت اصلی و یک مزیت کامل‌تر کن (۳۰ تا ۶۰ نویسه).',
    missing_desc: (c) => 'توضیحات متا ۱۲۰ تا ۱۶۰ نویسه با یک دعوت به اقدام بنویس. ' + plugHint(c, 'در {P}: فیلد «Meta description».'),
    long_desc: () => 'توضیحات متا را زیر ۱۶۰ نویسه نگه دار.',
    no_h1: () => 'هر صفحه دقیقاً یک H1 داشته باشد که موضوع صفحه را روشن بگوید.',
    multi_h1: () => 'فقط یک H1 نگه دار و بقیه را به H2 تبدیل کن.',
    img_alt: () => 'برای هر تصویر معنادار یک alt توصیفی بنویس؛ برای تصاویر تزئینی alt خالی (alt="") بگذار.',
    thin: () => 'محتوای صفحه را با پاسخ کامل به نیت جستجو (حداقل ۳۰۰ واژه، مثال، سؤال‌وجواب) گسترش بده یا با صفحهٔ مشابه ادغام کن.',
    no_canonical: (c) => 'برای هر صفحه یک canonical به آدرس اصلی خودش بگذار. ' + plugHint(c, '{P} این را معمولاً خودکار انجام می‌دهد؛ تنظیمش را بررسی کن.'),
    noindex: (c) => 'اگر صفحه باید در گوگل باشد، noindex را بردار. ' + plugHint(c, 'در {P}: بخش Advanced ← «Allow search engines to show this page».'),
    no_viewport: () => 'تگ <meta name="viewport" content="width=device-width, initial-scale=1"> را به head قالب اضافه کن.',
    no_lang: () => 'ویژگی lang="fa" را روی تگ <html> بگذار.',
    og: () => 'برچسب‌های og:title، og:description و og:image را اضافه کن تا اشتراک‌گذاری زیباتر شود.',
    no_schema: () => 'داده ساختاریافته JSON-LD اضافه کن (برای نمونه از من بخواه «اسکیما بساز»).',
    aeo_format: () => 'چند تیتر پرسشی (H2) با پاسخ مستقیم ۲ تا ۳ جمله‌ای زیرش و یک بخش «سؤالات متداول» اضافه کن.',
    no_robots: () => 'یک robots.txt بساز (از من بخواه «robots.txt بساز»).',
    no_sitemap: (c) => 'نقشهٔ سایت بساز و در Search Console ثبت کن. ' + (c.brief && c.brief.site && c.brief.site.coreSitemap ? 'وردپرس خودش /wp-sitemap.xml دارد.' : plugHint(c, '{P} نقشهٔ سایت را تولید می‌کند.')),
    no_llms: () => 'فایل llms.txt بساز (از من بخواه «llms.txt بساز»)؛ اختیاری ولی ارزان.',
    no_https: () => 'گواهی SSL فعال کن و همهٔ آدرس‌ها را با ریدایرکت ۳۰۱ به https ببر.',
  };
  const WHY = {
    robots_html: 'robots.txt که HTML برگرداند یعنی قواعد شما اصلاً خوانده نمی‌شود و ممکن است همه‌چیز خزیده شود.',
    robots_large: 'گوگل بعد از ۵۰۰ کیلوبایت robots.txt را نمی‌خواند؛ قواعد انتهایی بی‌اثر می‌شوند.',
    robots_blocks_wp_assets: 'گوگل صفحه را مثل کاربر رندر می‌کند؛ بدون CSS/JS رندر ناقص و رتبهٔ موبایل ضعیف می‌شود.',
    robots_blocks_images: 'تصاویر بسته‌شده در جستجوی تصویر گوگل دیده نمی‌شوند و ترافیک تصویری از دست می‌رود.',
    robots_crawl_delay: 'Crawl-delay خزش Bing و بعضی ربات‌ها را کند می‌کند و برای گوگل اثری ندارد.',
    robots_noindex_directive: 'دستور Noindex در robots.txt دیگر اثری ندارد و حس امنیت کاذب می‌دهد.',
    robots_http_sitemap: 'معرفی نقشهٔ سایت با http ریدایرکت اضافه می‌سازد و با HTTPS ناهماهنگ است.',
    title_px_long: 'گوگل عنوان را بر اساس عرض پیکسلی می‌برد؛ حروف پهن (مثل م، ش، حروف بزرگ لاتین) جای کمتری می‌گذارند و انتهای عنوان ممکن است با «…» حذف شود.',
    robots_blocks_all: 'با Disallow: / ریشه، گوگل هیچ صفحه‌ای را نمی‌خزد و سایت از نتایج جستجو ناپدید می‌شود؛ بحرانی‌ترین خطای robots.txt.',
    robots_blocks_css_js: 'گوگل صفحه را مثل مرورگر رندر می‌کند؛ بدون CSS/JS ظاهر و موبایل‌فرندلی بودن صفحه را درست نمی‌فهمد.',
    sitemap_blocked_by_robots: 'نقشهٔ سایت می‌گوید «بخز» و robots.txt می‌گوید «نخز»؛ گوگل این صفحه‌ها را نمایه‌نشده یا با اطلاعات ناقص نگه می‌دارد.',
    sitemap_bad_lastmod: 'lastmod با قالب نامعتبر نادیده گرفته می‌شود و مزیت خزش سریع‌تر صفحه‌های تازه‌شده را از دست می‌دهید.',
    robots_unknown_directive: 'دستور اشتباه نادیده گرفته می‌شود و قاعدهٔ موردنظر شما اعمال نمی‌شود.',
    sitemap_empty: 'نقشهٔ سایت خالی هیچ کمکی به کشف صفحه‌ها نمی‌کند.',
    sitemap_too_many: 'فایل بیش از حد مجاز ممکن است کامل پردازش نشود.',
    sitemap_duplicate_urls: 'نشانی تکراری بودجهٔ خزش را هدر می‌دهد و اعتماد به نقشه را کم می‌کند.',
    sitemap_http_urls: 'نشانی http در نقشهٔ سایت https سیگنال ناهمگن به موتور می‌دهد.',
    sitemap_foreign_host: 'نشانی دامنهٔ دیگر در نقشه نادیده گرفته می‌شود و معمولاً نشانهٔ خطای افزونه است.',
    sitemap_junk_urls: 'نقشهٔ پر از نشانی کم‌ارزش خزش را از صفحه‌های مهم منحرف می‌کند.',
    sitemap_no_lastmod: 'بدون lastmod موتور نمی‌داند کدام صفحه تازه شده و دیرتر دوباره می‌خزد.',
    sitemap_fake_lastmod: 'lastmod یکسان و ساختگی باعث می‌شود گوگل کل این سیگنال را نادیده بگیرد.',
    sitemap_future_lastmod: 'تاریخ آینده نشانهٔ تنظیم غلط ساعت است و اعتبار lastmod را از بین می‌برد.',
    llms_no_title: 'قالب استاندارد llms.txt با تیتر شروع می‌شود تا مدل‌ها هویت سایت را بفهمند.',
    llms_no_links: 'بدون لینک، llms.txt مسیری به محتوای مهم نشان نمی‌دهد.',
    llms_thin: 'llms.txt بسیار کوتاه ارزشی برای مدل‌های زبانی ندارد.',
    nofollow_page: 'nofollow کل صفحه یعنی هیچ اعتباری از آن به صفحه‌های بعدی نمی‌رسد؛ معمولاً اشتباه تنظیمات است.',
    nosnippet: 'بدون خلاصه در نتایج، نرخ کلیک و امکان نقل در پاسخ‌های AI از بین می‌رود.',
    multi_title: 'دو عنوان یعنی گوگل خودش یکی را برمی‌گزیند و ممکن است عنوان اشتباه نمایش دهد.',
    multi_desc: 'چند توضیحات متا ابهام ایجاد می‌کند و یکی از آن‌ها نادیده گرفته می‌شود.',
    meta_refresh: 'meta refresh کند است و اعتبار لینک را مثل ریدایرکت ۳۰۱ منتقل نمی‌کند.',
    canonical_params: 'canonical با پارامتر نسخه‌های تکراری را از بین نمی‌برد و سیگنال را پخش می‌کند.',
    og_url_mismatch: 'ناهمخوانی og:url و canonical آمار اشتراک و سیگنال نسخهٔ اصلی را دو تکه می‌کند.',
    arabic_chars: 'جست‌وجوی «کتاب» و «كتاب» برای موتور جستجو و جست‌وجوی سایت یکسان نیست؛ حروف عربی در متن فارسی سیگنال را دو تکه می‌کند و غیرحرفه‌ای دیده می‌شود.',
    arabic_digits: 'ارقام عربی-هندی در متن فارسی جست‌وجوی عددی را مختل و ظاهر متن را ناهمگون می‌کند.',
    no_trust_pages: 'بدون صفحهٔ تماس/درباره/حریم خصوصی، کاربر و ارزیاب‌ها نمی‌دانند پشت سایت چه کسی است؛ این از نشانه‌های اعتماد (E-E-A-T) است و برای فروشگاه‌ها لازم.',
    schema_duplicate: 'اسکیمای تکراری یا متناقض (مثلاً دو Product با قیمت متفاوت) گوگل را گیج می‌کند و ممکن است نتیجهٔ غنی را از دست بدهید.',
    img_bad_filename: 'نام فایل توصیفی به گوگل تصاویر می‌گوید تصویر دربارهٔ چیست؛ IMG_1234 هیچ اطلاعاتی نمی‌دهد.',
    title_h1_unrelated: 'وقتی عنوان و H1 موضوعشان یکی نیست، گوگل ممکن است عنوان را در نتایج بازنویسی کند و کاربر نتیجهٔ مبهمی می‌بیند.',
    no_preconnect: 'اتصال اولیه (DNS/TLS) به هر دامنهٔ بیرونی زمان می‌برد؛ preconnect آن را زودتر شروع می‌کند و بارگذاری سریع‌تر می‌شود.',
    font_display: 'بدون font-display تا رسیدن فونت، متن نامرئی می‌ماند (FOIT) و LCP و تجربهٔ کاربر بدتر می‌شود.',
    no_apple_touch_icon: 'بدون نماد iOS، افزودن سایت به صفحهٔ اصلی گوشی ظاهر ضعیفی دارد.',
    long_h1: 'H1 طولانی موضوع را مبهم می‌کند و در نتایج و مدل‌های زبانی بریده می‌شود.',
    empty_links: 'لینک بدون متن به موتور و کاربر نمی‌گوید مقصد چیست و دسترس‌پذیری را خراب می‌کند.',
    many_links: 'لینک‌های زیاد اعتبار صفحه را پخش می‌کند و تجربهٔ کاربر را شلوغ می‌کند.',
    large_html: 'HTML خیلی بزرگ کند بارگیری می‌شود و بخشی از آن ممکن است اصلاً خوانده نشود.',
    big_dom: 'DOM سنگین رندر را کند می‌کند و شاخص‌های سرعت (INP/LCP) را بد می‌کند.',
    render_blocking_scripts: 'اسکریپت مسدودکننده نمایش اولیه را عقب می‌اندازد و LCP را بدتر می‌کند.',
    js_rendered: 'خزنده‌هایی که JS اجرا نمی‌کنند (از جمله بیشتر ربات‌های AI) صفحه را خالی می‌بینند.',
    img_no_srcset: 'بدون srcset موبایل تصویر بزرگ دسکتاپ را دانلود می‌کند و سرعت افت می‌کند.',
    lcp_image_lazy: 'lazy کردن تصویر بالای صفحه نمایش محتوای اصلی را دیرتر می‌کند.',
    product_schema_image: 'گوگل برای نتایج غنی محصول تصویر را لازم می‌داند.',
    product_no_rating: 'ستارهٔ امتیاز واقعی نرخ کلیک را بالا می‌برد؛ فقط با نظرهای واقعی مجاز است.',
    article_schema_fields: 'اسکیمای ناقص مقاله شانس نمایش غنی و انتساب به نویسنده را کم می‌کند.',
    faq_no_schema: 'FAQPage پرسش و پاسخ را صریح در اختیار موتورهای پاسخ‌گو می‌گذارد.',
    video_no_schema: 'بدون VideoObject ویدیو در نتایج ویدیویی و پیش‌نمایش‌ها دیده نمی‌شود.',
    stale_content: 'محتوای قدیمی اعتماد و رتبه را کم می‌کند و کمتر در پاسخ‌های AI نقل می‌شود.',
    no_twitter_card: 'بدون Twitter Card، پیش‌نمایش لینک هنگام اشتراک‌گذاری ساده و بی‌جذابیت است و نرخ کلیک از شبکه‌های اجتماعی کم می‌شود.', no_og_image: 'لینک بدون og:image در تلگرام، واتساپ و شبکه‌های اجتماعی بی‌تصویر می‌ماند و کمتر کلیک می‌گیرد.',
    no_favicon: 'نماد سایت در نتایج موبایل گوگل و تب مرورگر دیده نمی‌شود و اعتماد برند کم می‌شود.', no_charset: 'بدون charset، متن فارسی ممکن است در بعضی مرورگرها و خزنده‌ها خراب خوانده شود.',
    img_alt_filename: 'alt شبیه نام فایل چیزی دربارهٔ تصویر نمی‌گوید و فرصت رتبه در جستجوی تصویر و دسترس‌پذیری از دست می‌رود.', img_alt_long: 'alt بسیار طولانی شبیه پر کردن کلیدواژه است و برای صفحه‌خوان‌ها آزاردهنده است.',
    img_no_lazy: 'بارگیری همزمان همهٔ تصاویر سرعت اولیهٔ صفحه را کم می‌کند و روی Core Web Vitals اثر منفی دارد.', img_legacy_format: 'WebP/AVIF حجم تصویر را کم می‌کند؛ صفحهٔ سبک‌تر در موبایل سریع‌تر باز می‌شود و LCP بهتر می‌شود.',
    title_stuffed: 'عنوان شلوغ یا با تکرار کلیدواژه نرخ کلیک را پایین می‌آورد و ممکن است گوگل آن را بازنویسی کند.', desc_equals_title: 'متنی که عیناً عنوان را تکرار کند اطلاعات جدیدی برای ترغیب کاربر به کلیک نمی‌دهد.',
    no_org_schema: 'اسکیمای Organization/WebSite هویت برند را به موتورها و مدل‌های زبانی معرفی می‌کند و به نمایش درست نام و لوگو کمک می‌کند.', no_article_schema: 'اسکیمای Article نویسنده، تاریخ و تصویر را رسماً اعلام می‌کند و شانس نمایش غنی و استناد را بالا می‌برد.',
    no_h2: 'زیرتیتر ساختار متن را برای کاربر و موتورها روشن می‌کند و امکان نمایش بخش‌ها در نتایج را بیشتر می‌کند.', http_internal_links: 'لینک داخلی ناامن هر بار ریدایرکت اضافه می‌کند و مصرف بودجهٔ خزش را بالا می‌برد.',
    no_external_links: 'ارجاع به منبع معتبر نشانهٔ پژوهش و اعتماد است؛ مقالهٔ بلند بدون هیچ منبعی کمتر قابل‌استناد دیده می‌شود.', no_max_image_preview: 'تصویر بزرگ‌تر در نتایج و Discover نرخ کلیک را بالاتر می‌برد.',
    short_desc: 'متای خیلی کوتاه فرصت جلب کلیک در نتایج جستجو را هدر می‌دهد.', canonical_offsite: 'canonical به دامنهٔ دیگر یعنی به گوگل می‌گویی نسخهٔ اصلی این صفحه جای دیگری است؛ صفحه نمایه نمی‌شود.',
    canonical_other: 'canonical به صفحهٔ دیگر اگر عمدی نباشد، رتبهٔ این صفحه را به صفحهٔ دیگری می‌دهد.', no_rtl: 'بدون dir=rtl چیدمان متن فارسی در مرورگر و ابزارهای خزنده/خوانا درست نیست.',
    generic_anchor: 'متن لینک کلی (مثل «اینجا») به موتور جستجو و AI نمی‌گوید مقصد دربارهٔ چیست.', few_internal: 'لینک داخلی کم یعنی اعتبار صفحه به بقیهٔ سایت نمی‌رسد و کاربر راهی برای ادامه ندارد.',
    no_breadcrumb: 'breadcrumb ساختار سایت را به موتور و کاربر نشان می‌دهد و در نتایج هم نمایش داده می‌شود.', img_dims: 'تصویر بدون width/height هنگام بارگذاری چیدمان را جابه‌جا می‌کند (CLS) و تجربهٔ موبایل را خراب می‌کند.',
    product_no_schema: 'بدون اسکیمای Product، قیمت و موجودی محصول در نتایج غنی و پاسخ‌های AI خوانده نمی‌شود.', product_schema_offer: 'اسکیمای Product بدون قیمت/موجودی (offers) برای نتایج غنی بی‌فایده است.',
    product_schema_ids: 'برند و شناسهٔ محصول (sku/gtin) به موتورها کمک می‌کند محصول را با فهرست‌های دیگر تطبیق دهند.',
    http_error: 'صفحهٔ خراب هم کاربر را از دست می‌دهد هم اعتبار خزش را.', noindex: 'موتورهای جستجو اصلاً صفحه را نمایه نمی‌کنند.', missing_title: 'عنوان مهم‌ترین سیگنال و اولین چیزی است که در نتایج دیده می‌شود.',
    no_https: 'مرورگر هشدار می‌دهد و رتبه و اعتماد پایین می‌آید.', no_sitemap: 'کشف و نمایهٔ صفحات کندتر می‌شود.', no_h1: 'ساختار موضوع صفحه برای موتورها و مدل‌های زبانی نامشخص می‌شود.',
    missing_desc: 'بدون متا، موتور خودش متن بی‌ربط انتخاب می‌کند و نرخ کلیک می‌افتد.', no_viewport: 'نمایش موبایل خراب می‌شود و گوگل اول-موبایل است.', thin: 'محتوای کم کمتر استناد و رتبه می‌گیرد.',
    no_schema: 'موتورها و AI معنی صفحه را دقیق‌تر می‌فهمند و ریچ‌ریزالت ممکن می‌شود.', aeo_format: 'پاسخ‌های کوتاه و پرسشی بیشتر در جواب‌های AI نقل می‌شوند.',
  };
  Object.assign(WHY, { img_alt: 'موتورهای جستجو و AI تصویر را از روی alt می‌فهمند؛ بدون آن در جستجوی تصویر دیده نمی‌شوی و دسترس‌پذیری کم می‌شود.', multi_h1: 'چند H1 موضوع اصلی صفحه را مبهم می‌کند.', no_canonical: 'نسخه‌های تکراری آدرس رتبه را بین خودشان تقسیم می‌کنند.', long_title: 'عنوان بلند در نتایج بریده می‌شود و پیام ناقص دیده می‌شود.', short_title: 'عنوان کوتاه فرصت جلب‌توجه و کلیدواژه را هدر می‌دهد.', long_desc: 'متای بلند در نتایج بریده می‌شود.', og: 'لینک در شبکه‌ها بدون تصویر و عنوان درست نمایش داده می‌شود.', no_lang: 'زبان صفحه به مرورگر و موتور جستجو اعلام نمی‌شود.', no_robots: 'بدون robots.txt کنترل خزنده‌ها در دست تو نیست.', no_llms: 'اختیاری است؛ معرفی صفحات مهم به مدل‌های زبانی را ساده‌تر می‌کند.' });
  function whyOf(code, title) { return WHY[code] || title; }

  /* ---------- derived facts ---------- */
  function trafficFacts(log) {
    if (!log) return null; const ty = log.types || {}; const total = sum(ty); const t = log.totals || {};
    const rejected = (log.ai || []).reduce((a, b) => a + (b.blocked || 0), 0), aiHits = t.aiBots || 0;
    const chans = Object.entries(ty).filter(([k]) => k !== 'internal').sort((a, b) => b[1] - a[1]);
    const half = (arr) => { if (!arr || arr.length < 6) return null; const n = Math.floor(arr.length / 2); const a = arr.slice(0, n).reduce((x, y) => x + y[1], 0), b = arr.slice(arr.length - n).reduce((x, y) => x + y[1], 0); return { before: a, after: b, change: a ? Math.round(((b - a) / a) * 100) : null, days: n }; };
    const landTotal = (log.landing || []).reduce((a, b) => a + b[1], 0);
    return { total, human: t.human || 0, aiHits, aiRefs: t.aiReferrals || 0, rejected, rejectRate: pct(rejected, aiHits), chans, top: chans[0] ? { type: chans[0][0], share: pct(chans[0][1], total) } : null,
      trend: half(log.daily), aiTrend: half(log.aiDaily), topLandShare: landTotal && log.landing[0] ? pct(log.landing[0][1], landTotal) : 0 };
  }
  const CH = { search: 'موتور جستجو', ai: 'دستیارهای AI', social: 'شبکه‌های اجتماعی', other: 'سایت‌های دیگر', direct: 'مستقیم/نامشخص' };
  function policy(rep) {
    const by = { search: [], user: [], training: [] }; (rep.robots.bots || []).forEach((b) => (by[b.purpose] || (by[b.purpose] = [])).push(b));
    const st = (arr, s) => arr.filter((b) => b.status === s).map((b) => b.id);
    return { found: rep.robots.found, searchBlocked: st(by.search, 'blocked'), userBlocked: st(by.user, 'blocked'), trainBlocked: st(by.training, 'blocked'), partial: (rep.robots.bots || []).filter((b) => b.status === 'partial').map((b) => b.id), by };
  }
  function scoreWithout(rep, code) {
    const pages = rep.pages.map((p) => ({ issues: p.issues.filter((i) => i.code !== code) })); const site = rep.siteIssues.filter((i) => i.code !== code);
    return SI.scoreIssues(pages, site);
  }

  /* ---------- plan items ---------- */
  function planItems(ctx) {
    const items = []; const r = ctx.report, l = ctx.log, b = ctx.brief; const tf = trafficFacts(l);
    if (b && b.site && b.site.searchEnginesDiscouraged) items.push({ id: 'wp_discourage', sev: 'critical', title: 'سایت از موتورهای جستجو «پنهان» شده است', why: 'تنظیم «از موتورهای جستجو بخواه این سایت را نمایه نکنند» روشن است؛ هیچ صفحه‌ای رتبه نمی‌گیرد.', how: 'وردپرس ← تنظیمات ← خواندن ← تیک «دیده‌نشدن توسط موتورهای جستجو» را بردار.', impact: 5, effort: 1, count: 1 });
    if (r) {
      const groups = SI.groupIssues(r); const codes = {}; [...r.pages.flatMap((p) => p.issues), ...r.siteIssues].forEach((i) => { codes[i.title] = i.code; });
      groups.forEach((g) => { const code = codes[g.title]; const n = new Set(g.urls).size; items.push({ id: code, sev: g.severity, title: g.title + (n > 1 ? ' (' + n + ' صفحه)' : ''), why: whyOf(code, g.detail), how: (HOW[code] || (() => g.detail))(ctx), urls: [...new Set(g.urls)], impact: IMPACT[code] || 2, effort: Math.min(5, (EFFORT0[code] || 1) + Math.ceil(n / 5)), count: n, code }); });
      const pol = policy(r); if (pol.searchBlocked.length) items.push({ id: 'ai_search_blocked', sev: 'high', title: 'خزنده‌های «جستجوی AI» مسدودند: ' + pol.searchBlocked.join('، '), why: 'با مسدودبودن این‌ها در پاسخ‌های ChatGPT/Claude/Perplexity کمتر دیده می‌شوی.', how: 'در robots.txt قاعدهٔ Disallow این ربات‌ها را بردار (از من بخواه «robots.txt بساز»).', impact: 4, effort: 1, count: 1 });
    }
    if (tf) {
      if (tf.rejectRate >= 20 && tf.aiHits >= 5) items.push({ id: 'bot_rejected', sev: 'high', title: tf.rejectRate + '٪ درخواست رباتان AI رد می‌شود', why: 'ربات‌ها می‌آیند ولی ۴xx/۵xx می‌گیرند؛ معمولاً فایروال، Cloudflare Bot Fight یا افزونهٔ امنیتی مقصر است.', how: 'قوانین WAF/افزونهٔ امنیتی را بررسی کن و ربات‌هایی را که می‌خواهی اجازه بده (allowlist بر اساس User-Agent و محدودهٔ IP رسمی).', impact: 4, effort: 2, count: 1 });
      if (tf.top && tf.top.share >= 65 && tf.total >= 30) items.push({ id: 'one_channel', sev: 'medium', title: 'وابستگی زیاد به یک کانال: ' + CH[tf.top.type] + ' (' + tf.top.share + '٪)', why: 'تغییر الگوریتم یا قطع آن کانال ترافیک را می‌خواباند.', how: 'یک کانال دوم (خبرنامهٔ ایمیلی، تلگرام/اینستاگرام، یا محتوای قابل‌استناد برای AI) را جدی کن.', impact: 3, effort: 4, count: 1 });
      if (tf.aiHits >= 10 && tf.aiRefs === 0) items.push({ id: 'ai_no_refs', sev: 'medium', title: 'رباتان AI می‌خوانند ولی بازدیدی از دستیارهای AI نمی‌آید', why: 'یعنی محتوا خوانده می‌شود اما در پاسخ‌ها نقل نمی‌شود.', how: 'سؤال‌وجواب مستقیم، تیتر پرسشی، داده ساختاریافته و منبع/آمار قابل‌استناد به صفحات پرمخاطب اضافه کن.', impact: 3, effort: 3, count: 1 });
      if (tf.trend && tf.trend.change !== null && tf.trend.change <= -25) items.push({ id: 'drop', sev: 'high', title: 'ترافیک ' + Math.abs(tf.trend.change) + '٪ افت کرده', why: 'نیمهٔ دوم بازه نسبت به نیمهٔ اول به‌طور محسوس کمتر است.', how: 'صفحات فرود پرافت را در Search Console بررسی کن؛ تغییر اخیر قالب، ریدایرکت یا noindex را چک کن.', impact: 4, effort: 3, count: 1 });
    }
    if (b && b.site && b.site.cachePlugin && l && tf && tf.aiHits < 3) items.push({ id: 'cache_note', sev: 'low', title: 'کش (' + b.site.cachePlugin + ') ممکن است ثبت رباتان را کم‌شمار کند', why: 'درخواستی که از کش پاسخ بگیرد به PHP نمی‌رسد.', how: 'برای قضاوت دقیق‌تر، لاگ سرور را هم یک‌بار در اپ وارد کن.', impact: 1, effort: 1, count: 1 });
    items.forEach((i) => { i.prio = i.impact * 3 - i.effort + (i.count >= 3 ? 1 : 0) + ({ critical: 2, high: 1, medium: 0, low: -1 }[i.sev] || 0); i.horizon = i.effort <= 2 ? 7 : i.effort === 3 ? 30 : 90; });
    return items.sort((a, b2) => b2.prio - a.prio);
  }

  /* ---------- generators ---------- */
  function genRobots(ctx, mode) {
    const r = ctx.report; const origin = (r && r.origin) || 'https://example.com/'; const wp = !!(ctx.brief || (r && r.flags && r.pages.some((p) => /wp-/.test(p.url))));
    const bots = SI.AI_BOTS; const grp = (p) => bots.filter((b) => b.purpose === p);
    const L = ['User-agent: *', 'Allow: /']; if (wp) L.push('Disallow: /wp-admin/', 'Allow: /wp-admin/admin-ajax.php'); L.push('');
    const block = (arr) => arr.forEach((b) => L.push('User-agent: ' + b.id, 'Disallow: /', ''));
    const allow = (arr) => arr.forEach((b) => L.push('User-agent: ' + b.id, 'Allow: /', ''));
    if (mode === 'open') { L.push('# همهٔ خزنده‌های AI مجازند'); allow(bots); }
    else if (mode === 'closed') { L.push('# همهٔ خزنده‌های AI مسدودند (دیده‌نشدن در پاسخ‌های AI)'); block(bots); }
    else { L.push('# جستجوی AI و درخواست مستقیم کاربر: مجاز (برای دیده‌شدن در پاسخ‌ها)'); allow(grp('search').concat(grp('user'))); L.push('# جمع‌آوری برای آموزش مدل: مسدود (انتخاب سیاستی)'); block(grp('training')); }
    L.push('Sitemap: ' + origin + (ctx.brief && ctx.brief.site && ctx.brief.site.coreSitemap ? 'wp-sitemap.xml' : 'sitemap.xml'));
    return L.join('\n').replace(/\n{3,}/g, '\n\n');
  }
  function genLlms(ctx) {
    const r = ctx.report; if (!r) return null; const name = (ctx.brief && ctx.brief.site && ctx.brief.site.name) || r.site;
    const ok = r.pages.filter((p) => p.status < 400 && !p.facts.noindex); const home = ok[0]; const desc = (home && home.facts.description) || 'توضیح کوتاه دربارهٔ سایت و کاری که انجام می‌دهد را اینجا بنویس.';
    const pages = ok.slice().sort((a, b) => b.facts.words - a.facts.words).slice(0, 15);
    const L = ['# ' + name, '', '> ' + desc, '', '## صفحات مهم', ''];
    pages.forEach((p) => L.push('- [' + (p.facts.title || pathOf(p.url)) + '](' + p.url + ')' + (p.facts.description ? ': ' + p.facts.description : '')));
    return L.join('\n');
  }
  function genSchema(ctx, kind) {
    const r = ctx.report; const origin = (r && r.origin) || 'https://example.com/'; const name = (ctx.brief && ctx.brief.site && ctx.brief.site.name) || (r && r.site) || 'نام سایت';
    const home = r && r.pages[0]; const wrap = (o) => '<script type="application/ld+json">\n' + JSON.stringify(Object.assign({ '@context': 'https://schema.org' }, o), null, 2) + '\n</script>';
    const T = {
      faq: { title: 'سؤالات متداول (FAQPage)', where: 'روی صفحه‌ای که واقعاً همین سؤال‌وجواب‌ها در متنش دیده می‌شود', o: { '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'سؤال اول؟', acceptedAnswer: { '@type': 'Answer', text: 'پاسخ کوتاه و مستقیم.' } }, { '@type': 'Question', name: 'سؤال دوم؟', acceptedAnswer: { '@type': 'Answer', text: 'پاسخ کوتاه و مستقیم.' } }] } },
      org: { title: 'سازمان (Organization)', where: 'صفحهٔ اصلی', o: { '@type': 'Organization', name, url: origin, logo: origin + 'logo.png', sameAs: ['https://instagram.com/…', 'https://t.me/…'] } },
      site: { title: 'وب‌سایت (WebSite)', where: 'صفحهٔ اصلی', o: { '@type': 'WebSite', name, url: origin, potentialAction: { '@type': 'SearchAction', target: origin + '?s={search_term_string}', 'query-input': 'required name=search_term_string' } } },
      article: { title: 'مقاله (Article)', where: 'قالب نوشته‌ها', o: { '@type': 'Article', headline: (home && home.facts.title) || 'عنوان مقاله', description: (home && home.facts.description) || 'خلاصهٔ مقاله', author: { '@type': 'Person', name: 'نام نویسنده' }, datePublished: '2026-01-01', dateModified: '2026-01-01', image: origin + 'cover.jpg', publisher: { '@type': 'Organization', name } } },
      product: { title: 'محصول (Product)', where: 'صفحهٔ هر محصول', o: { '@type': 'Product', name: 'نام محصول', image: origin + 'product.jpg', description: 'توضیح محصول', sku: 'SKU-001', offers: { '@type': 'Offer', priceCurrency: 'IRR', price: '0', availability: 'https://schema.org/InStock', url: origin + 'product' } } },
      local: { title: 'کسب‌وکار محلی (LocalBusiness)', where: 'صفحهٔ اصلی یا تماس', o: { '@type': 'LocalBusiness', name, url: origin, telephone: '+98…', address: { '@type': 'PostalAddress', addressLocality: 'شهر', streetAddress: 'نشانی', addressCountry: 'IR' }, openingHours: 'Sa-We 09:00-18:00' } },
    };
    const t = T[kind] || T.org; return { title: t.title, where: t.where, code: wrap(t.o) };
  }
  function slugWords(u) { const seg = pathOf(u).split('?')[0].split('/').filter(Boolean).pop() || ''; return decodeURIComponent(seg).replace(/\.[a-z0-9]+$/i, '').replace(/[-_+]+/g, ' ').trim(); }
  const cut = (s, n) => { s = String(s).trim(); if ([...s].length <= n) return s; const a = [...s].slice(0, n).join(''); const i = a.lastIndexOf(' '); return (i > n * 0.6 ? a.slice(0, i) : a).replace(/[\s،,:؛-]+$/, ''); };
  function suggestFor(p, brand) {
    const path = pathOf(p.url).toLowerCase(); const home = path === '/' || path === ''; const t0 = (p.facts.title || '').trim(); const topic = home ? brand : (slugWords(p.url) || t0 || brand);
    let title = t0 || topic; const suff = ' | ' + brand; title = cut(title.replace(/\s*[|\-–—]\s*[^|\-–—]*$/, '') || title, 60 - suff.length > 20 ? 60 - suff.length : 60); if (title !== brand && [...(title + suff)].length <= 60) title += suff;
    let meta; if (home) meta = brand + '؛ ' + (t0 && t0 !== brand ? t0 + '. ' : '') + 'خدمات و محصولات ما را ببینید و همین امروز شروع کنید.';
    else if (/blog|post|article|مقاله|news|اخبار|learn|آموزش/.test(path)) meta = topic + ' را در این راهنما گام‌به‌گام بررسی می‌کنیم؛ نکات کاربردی، اشتباهات رایج و توصیه‌های متخصصان. همین حالا بخوانید.';
    else if (/product|shop|store|محصول|فروشگاه|buy|خرید/.test(path)) meta = 'خرید ' + topic + ' با ضمانت اصالت و ارسال سریع. مشخصات، قیمت و نظرات کاربران را ببینید.';
    else if (/about|درباره/.test(path)) meta = 'با ' + brand + ' آشنا شوید: داستان ما، تیم و ارزش‌هایی که پشت خدمات ماست.';
    else if (/contact|تماس/.test(path)) meta = 'راه‌های ارتباط با ' + brand + ': تلفن، نشانی و فرم پیام. ما سریع پاسخ می‌دهیم.';
    else meta = topic + ' در ' + brand + ': اطلاعات کامل، پرسش‌های رایج و راهنمای انتخاب. همین حالا مشاهده کنید.';
    return { title: cut(title, 62), meta: cut(meta, 155) };
  }

  /* ---------- glossary ---------- */
  const GLOSS = [
    [['geo', 'generative engine'], '**GEO** (بهینه‌سازی برای موتورهای مولد) یعنی محتوا را طوری بنویسی که ChatGPT، Claude، Gemini و Perplexity بتوانند بخوانند، بفهمند و در پاسخ‌هایشان به تو استناد کنند: دسترسی خزنده‌ها، ساختار روشن، داده ساختاریافته و اطلاعات قابل‌اتکا.'],
    [['aeo', 'answer engine'], '**AEO** (بهینه‌سازی برای موتورهای پاسخ) یعنی پاسخ مستقیم و کوتاه به سؤال‌های واقعی کاربر: تیتر پرسشی، پاسخ ۲–۳ جمله‌ای زیرش، بخش FAQ و اسکیمای FAQPage.'],
    [['llms.txt', 'llms'], '**llms.txt** فایل متنی اختیاری در ریشهٔ سایت است که صفحات مهم را به‌صورت فهرست مارک‌داون به مدل‌های زبانی معرفی می‌کند. **گوگل صراحتاً می‌گوید برای ظاهرشدن در AI Overviews/AI Mode به آن نیازی نیست** و تأثیر رتبه ندارد؛ پشتیبانی قطعی سرویس‌های دیگر هم تأیید نشده. ساختنش ارزان است ولی اولویتش پایین‌تر از ایندکس‌بودن، محتوای غیرکالایی و باز‌گذاشتن ربات‌های جستجوی AI است.'],
    [['canonical', 'کنونیکال'], '**canonical** آدرس «اصلی» صفحه را به موتور جستجو می‌گوید تا نسخه‌های تکراری (با پارامتر، با/بدون www) رتبه را تقسیم نکنند.'],
    [['noindex'], '**noindex** دستوری است که به موتور جستجو می‌گوید این صفحه را نمایه نکن. برای صفحات مهم فاجعه است؛ برای صفحات داخلی/تشکر/جستجو مفید.'],
    [['schema', 'اسکیما', 'json-ld', 'داده ساختار'], '**داده ساختاریافته (Schema/JSON-LD)** کدی نامرئی است که نوع محتوا (مقاله، محصول، سؤال‌وجواب، کسب‌وکار) را صریح به موتورها می‌گوید و ریچ‌ریزالت و استناد AI را ممکن می‌کند.'],
    [['robots'], '**robots.txt** فایل ریشهٔ سایت است که به خزنده‌ها می‌گوید کدام بخش‌ها را بخوانند یا نخوانند. رعایتش داوطلبانه است؛ ربات‌های معتبر رعایت می‌کنند، بدخواه‌ها نه.'],
    [['sitemap', 'نقشه سایت'], '**نقشهٔ سایت (sitemap.xml)** فهرست صفحات مهم برای موتورهای جستجو است و کشف و نمایه را سریع‌تر می‌کند.'],
    [['h1'], '**H1** تیتر اصلی صفحه است؛ هر صفحه یک H1 روشن بخواهد که موضوع را بگوید.'],
    [['meta description', 'توضیحات متا', 'متا'], '**توضیحات متا** خلاصهٔ ۱۲۰–۱۶۰ نویسه‌ای زیر عنوان در نتایج گوگل است؛ مستقیم روی نرخ کلیک اثر دارد.'],
    [['referrer', 'ارجاع دهنده'], '**Referrer** آدرس صفحه‌ای است که کاربر از آن آمده. گوگل معمولاً عبارت جستجو را در آن نمی‌فرستد؛ برای کلمات کلیدی باید Search Console را دید.'],
    [['user-agent', 'یوزر ایجنت'], '**User-Agent** رشته‌ای است که هر مرورگر/ربات از خودش می‌فرستد. شناسایی رباتان AI بر پایهٔ آن است و قابل جعل است.'],
    [['utm'], '**UTM** پارامترهای انتهای لینک (utm_source و utm_medium) است که منبع کمپین را مشخص می‌کند.'],
    [['e-e-a-t', 'eeat'], '**E-E-A-T** یعنی تجربه، تخصص، اعتبار و اعتمادپذیری؛ معیار کیفیت گوگل. نویسندهٔ مشخص، منبع، تاریخ و صفحات «دربارهٔ ما/تماس» واقعی کمک می‌کند.'],
    [['gptbot'], '**GPTBot** خزندهٔ OpenAI برای جمع‌آوری داده‌ی آموزش مدل است. **OAI-SearchBot** برای جستجوی ChatGPT و **ChatGPT-User** برای درخواست لحظه‌ای کاربر است؛ مسدودکردن اولی روی دیده‌شدن در جستجو اثری ندارد.'],
    [["core web vitals", "cwv", "وایتال"], "**Core Web Vitals** سه معیار تجربهٔ واقعی کاربر در گوگل‌اند: **LCP** (سرعت نمایش بزرگ‌ترین عنصر؛ خوب ≤ ۲٫۵ ثانیه)، **INP** (پاسخ‌دهی به کلیک/لمس؛ خوب ≤ ۲۰۰ میلی‌ثانیه؛ از مارس ۲۰۲۴ جای FID نشسته) و **CLS** (جابه‌جایی ناگهانی چیدمان؛ خوب ≤ ۰٫۱). معیار، صدک ۷۵ بازدیدهای واقعی (داده میدانی) است، نه یک تست آزمایشگاهی. اندازه‌گیری: Search Console ← Core Web Vitals یا PageSpeed Insights. اثرش روی رتبه یک عامل کوچک است؛ اثر اصلی روی نرخ تبدیل و ریزش کاربر است."],
    [["lcp", "largest contentful"], "**LCP** زمان نمایش بزرگ‌ترین عنصر بالای صفحه (معمولاً تصویر هیرو یا تیتر) است. مهم‌ترین راه‌های بهبود: تصویر هیرو را WebP/AVIF و با اندازهٔ درست بده، `fetchpriority=high` و **بدون lazy-load** برای همان تصویر، کش صفحه و کاهش TTFB، حذف CSS/JS مسدودکنندهٔ رندر."],
    [["inp", "interaction to next paint"], "**INP** کندترین پاسخ صفحه به تعامل کاربر (کلیک، لمس، تایپ) را در کل بازدید می‌سنجد؛ خوب ≤ ۲۰۰ms. علت رایج در وردپرس: افزونه‌ها و اسکریپت‌های سنگین (چت، پیکسل‌ها، اسلایدر، صفحه‌ساز). راه‌حل: حذف/تأخیر اسکریپت‌های غیرضروری، کم‌کردن افزونه، شکستن کارهای طولانی جاوااسکریپت."],
    [["cls", "layout shift", "پرش صفحه"], "**CLS** یعنی عناصر صفحه هنگام بارگذاری جابه‌جا شوند (پرش). دلیل‌ها: تصویر/ویدیو/تبلیغ بدون width و height، فونت‌هایی که دیر لود می‌شوند، بنر کوکی که محتوا را هل می‌دهد. راه‌حل: ابعاد را در HTML بنویس، فضای تبلیغ را رزرو کن، `font-display: swap` با فونت هم‌اندازه."],
    [["ttfb", "سرعت پاسخ سرور", "time to first byte"], "**TTFB** زمان رسیدن اولین بایت پاسخ سرور است؛ راهنمای عملی ≤ ۸۰۰ms. در وردپرس بیشتر با کش صفحه (Page Cache)، PHP نسخهٔ جدید، OPcache، کوئری‌های سنگین دیتابیس و هاست ضعیف بد می‌شود. اگر مخاطبت ایران است، هاست داخل ایران یا CDN مناسب اغلب بیشترین اثر را دارد."],
    [["crawl budget", "بودجه خزش", "بودجه خزیدن"], "**Crawl budget** سقف صفحاتی است که گوگل در هر بازه از سایتت می‌خزد. برای سایت‌های زیر چند ده‌هزار صفحه معمولاً مشکل نیست. اگر فروشگاه بزرگ داری، خطر اصلی URLهای بی‌ارزش است: فیلتر و مرتب‌سازی با پارامتر، صفحات جستجوی داخلی، سشن/عدد تصادفی در لینک. این‌ها را با canonical، noindex یا disallow کنترل کن (ترکیب noindex و disallow هم‌زمان درست کار نمی‌کند؛ ربات باید صفحه را ببیند تا noindex را بخواند)."],
    [["hreflang", "چند زبانه", "چندزبانه"], "**hreflang** به گوگل می‌گوید هر نسخهٔ زبانی/منطقه‌ای صفحه کدام است. قوانین: هر نسخه باید به همهٔ نسخه‌ها (و خودش) اشاره کند (دوطرفه)، کد زبان درست (`fa`، `en`، `fa-IR`)، و یک `x-default`. اشتباه رایج: لینک یک‌طرفه یا canonical به نسخهٔ دیگر. در وردپرس معمولاً WPML/Polylang/TranslatePress این را می‌سازند."],
    [["301", "302", "ریدایرکت", "redirect", "تغییر مسیر"], "**ریدایرکت ۳۰۱** یعنی جابه‌جایی دائمی (سیگنال‌های رتبه منتقل می‌شود)، **۳۰۲/۳۰۷** یعنی موقت. هنگام تغییر آدرس همیشه ۳۰۱ بده، مستقیم به مقصد نهایی (زنجیرهٔ ریدایرکت بیش از ۱–۲ گام نشود)، و لینک‌های داخلی را به آدرس جدید اصلاح کن. صفحهٔ حذف‌شده بدون جایگزین: ۴۱۰ یا ۴۰۴؛ ریدایرکت همه به صفحهٔ اصلی «soft 404» حساب می‌شود."],
    [["404", "soft 404", "410"], "**۴۰۴** یعنی صفحه نیست؛ **۴۱۰** یعنی عمداً برای همیشه حذف شده (گوگل کمی سریع‌تر از نمایه خارج می‌کند). چند ۴۰۴ طبیعی است و جریمه نمی‌آورد؛ مشکل وقتی است که صفحات مهم یا دارای بک‌لینک ۴۰۴ شوند. در Search Console بخش Pages ← Not found را ببین و برای آدرس‌های ارزشمند ۳۰۱ بگذار."],
    [["internal link", "لینک داخلی", "لینک سازی داخلی", "لینک‌سازی داخلی"], "**لینک‌سازی داخلی** مهم‌ترین اهرم سئوی در اختیار توست: صفحات مهم باید از چند صفحهٔ مرتبط لینک بگیرند، با **انکر متن توصیفی** (نه «اینجا کلیک کنید»). الگوی کاربردی: هر مقاله به صفحهٔ دستهٔ مرتبط و ۲–۳ مقالهٔ هم‌موضوع لینک بدهد و صفحهٔ ستون موضوع (pillar) به همهٔ زیرمقالات. «صفحهٔ یتیم» (orphan) صفحه‌ای است که هیچ لینک داخلی ندارد و دیر یا هرگز خزیده می‌شود."],
    [["topical authority", "اقتدار موضوعی", "خوشه موضوعی", "topic cluster", "pillar"], "**اقتدار موضوعی** یعنی یک موضوع را کامل و عمیق پوشش بدهی: یک صفحهٔ ستون جامع + چندین مقالهٔ پشتیبان برای زیرپرسش‌ها، همه با لینک متقابل. به‌جای ۵۰ مقالهٔ پراکنده، ۸ خوشهٔ منسجم بساز. ابتدا پرسش‌های واقعی مخاطب را فهرست کن (Search Console، بخش «مردم همچنین می‌پرسند»، پرسش‌های پشتیبانی)."],
    [["cannibalization", "کانیبال", "هم پوشانی کلمه", "هم‌پوشانی کلمه"], "**Keyword cannibalization** یعنی چند صفحهٔ سایت خودت برای یک عبارت با هم رقابت کنند و هیچ‌کدام رتبهٔ خوبی نگیرد. تشخیص: در Search Console برای یک query چند URL می‌بینی. درمان: ادغام صفحات و ۳۰۱، یا تفکیک نیت (یکی آموزشی، یکی خرید)، یا canonical، و اصلاح لینک‌های داخلی به صفحهٔ هدف اصلی."],
    [["نیت جستجو", "search intent", "intent"], "**نیت جستجو** دلیل پشت عبارت است: اطلاعاتی («چطور…»)، تجاری-مقایسه‌ای («بهترین…»)، تراکنشی («خرید…») یا ناوبری (نام برند). اگر صفحه‌ات با نیت نخست‌صفحهٔ گوگل نخواند (مثلاً مقاله برای عبارتی که همه‌اش صفحهٔ محصول است)، رتبه نمی‌گیرد. پیش از نوشتن، ۵ نتیجهٔ اول را نگاه کن: قالب، طول و زاویهٔ مشترکشان را بفهم."],
    [["product schema", "اسکیما محصول", "merchant", "ریچ ریزالت", "rich result"], "برای محصول، **Product + Offer** را کامل بده: name، image، description، sku/gtin، brand، و در `offers`: price، priceCurrency، availability و (در صورت امکان) shippingDetails/hasMerchantReturnPolicy. قیمت/موجودی اسکیما باید دقیقاً با چیزی که کاربر در صفحه می‌بیند یکی باشد. ستارهٔ review فقط با نظرات واقعی کاربران و روی صفحهٔ همان محصول معنی دارد. ابزار اعتبارسنجی: Rich Results Test. افزونه‌هایی مثل Rank Math/Yoast WooCommerce این را می‌سازند؛ دو افزونه هم‌زمان اسکیمای تکراری تولید می‌کنند."],
    [["faq schema", "اسکیما سوالات", "faqpage", "سوالات متداول"], "**FAQPage**: گوگل نمایش rich result سؤال‌وجواب را در ۲۰۲۳ به سایت‌های دولتی و سلامت محدود و در **۷ مه ۲۰۲۶ برای همه حذف** کرد (گزارش آن از Search Console هم برداشته شد). خود نوع FAQPage منسوخ نشده و مارکاپ موجود خطا یا آسیب رتبه نمی‌سازد؛ گوگل برای فهم صفحه هنوز می‌خواندش. بخش FAQ واقعی روی صفحه برای کاربر، AEO و استناد دستیارهای AI مفید است؛ اسکیما فقط وقتی بگذار که همان متن عیناً روی صفحه دیده می‌شود."],
    [["breadcrumb", "breadcrumblist", "مسیر راهنما"], "**BreadcrumbList** مسیر صفحه (خانه ← دسته ← محصول) را به موتور می‌گوید و در نتیجهٔ جستجو به‌جای URL خام نمایش داده می‌شود. در Yoast/Rank Math فعالش کن و مطمئن شو ساختار دسته‌ها واقعاً سلسله‌مراتبی است."],
    [["hsts", "mixed content", "محتوای ترکیبی"], "**HTTPS کامل**: همهٔ نسخه‌ها (http و www/بدون‌www) با ۳۰۱ به یک نسخهٔ https بروند. **Mixed content** یعنی صفحهٔ https منابع http لود کند (قفل خراب می‌شود)؛ در وردپرس معمولاً از آدرس‌های قدیمی در محتوا/ابزارک می‌آید و با جست‌وجو-جایگزینی دیتابیس درست می‌شود. **HSTS** هدر امنیتی است که مرورگر را مجبور به https می‌کند؛ پس از اطمینان از https کامل فعالش کن."],
    [["pagination", "صفحه بندی", "صفحه‌بندی", "rel next"], "**صفحه‌بندی**: گوگل از ۲۰۱۹ `rel=prev/next` را نادیده می‌گیرد. هر صفحهٔ شماره‌دار canonical به خودش داشته باشد (نه به صفحهٔ ۱)، با لینک‌های قابل‌خزیدن، و محتوای مهم فقط پشت دکمهٔ «بارگذاری بیشتر» جاوااسکریپتی پنهان نباشد. صفحات عمیق را noindex نکن مگر محصولات از جای دیگری قابل‌دسترسی باشند."],
    [["faceted", "فیلتر محصول", "فیلتر ووکامرس", "فیلترها"], "**ناوبری فیلتری فروشگاه**: ترکیب فیلتر/مرتب‌سازی می‌تواند میلیون‌ها URL بی‌ارزش بسازد. قاعدهٔ عملی: فقط فیلترهایی با تقاضای جستجوی واقعی (مثلاً «کفش ورزشی مردانه سایز ۴۲») صفحهٔ قابل‌نمایه با عنوان و متن اختصاصی بگیرند؛ بقیه canonical به دستهٔ اصلی یا noindex,follow شوند و پارامترهای مرتب‌سازی (`orderby`) disallow شوند."],
    [["duplicate content", "محتوای تکراری", "thin content", "محتوای کم"], "**محتوای تکراری** جریمهٔ مستقیم ندارد ولی قدرت را بین نسخه‌ها پخش می‌کند. منبع‌های رایج: توضیح یکسان تأمین‌کننده برای محصولات، نسخه‌های وارییشن، برچسب‌ها/آرشیوها. **Thin content** صفحه‌ای است که ارزش یکتا ندارد. راه‌حل: توضیح اختصاصی برای محصولات پرفروش، canonical برای وارییشن‌ها، noindex برای آرشیو برچسب‌های بی‌ارزش."],
    [["backlink", "بک لینک", "بک‌لینک", "disavow", "لینک خارجی"], "**بک‌لینک** هنوز از قوی‌ترین سیگنال‌هاست، اما کیفیت و ارتباط مهم‌تر از تعداد است. راه‌های سالم: محتوای قابل‌ارجاع (داده، راهنمای جامع، ابزار)، معرفی در رسانه‌های هم‌حوزه، همکاری با تأمین‌کنندگان/برندها. خرید لینک و شبکه‌های خصوصی ریسک پنالتی دارد. ابزار Disavow فقط برای حملهٔ اسپم گسترده یا لینک‌های دستی بد است، نه برای کار روزمره."],
    [["indexnow", "ایندکس ناو"], "**IndexNow** پروتکلی است که تغییر صفحه را فوراً به موتورهای پشتیبان (Bing، Yandex، Seznam و…) اطلاع می‌دهد. گوگل از آن پشتیبانی نمی‌کند؛ برای گوگل ارسال sitemap و ابزار Inspect URL را در Search Console استفاده کن. افزونه‌های Rank Math و Yoast Premium گزینهٔ IndexNow دارند."],
    [["نیم فاصله", "نیم‌فاصله", "zwnj", "نگارش فارسی"], "**نگارش فارسی برای سئو**: از نیم‌فاصلهٔ درست (ZWNJ) در «می‌خواهم/کتاب‌ها» استفاده کن ولی یک عبارت را در عنوان و متن یک‌شکل بنویس؛ کاربران هر دو شکل را جستجو می‌کنند و گوگل معمولاً هر دو را یکی می‌گیرد. اعداد را در متن یک‌دست کن (فارسی یا لاتین) و از ی/ک عربی (ي/ك) پرهیز کن چون روی تطبیق جستجو اثر می‌گذارد."],
    [["slug", "اسلاگ", "پیوند یکتا", "permalink", "نشانی فارسی"], "**اسلاگ/پیوند یکتا**: کوتاه، توصیفی و بدون تاریخ (`/blog/seo-guide`). آدرس فارسی هم کار می‌کند ولی هنگام کپی به‌صورت %D8… درمی‌آید؛ بسیاری لاتین ساده را ترجیح می‌دهند. مهم‌تر از انتخاب، ثبات است: پس از انتشار تغییرش نده مگر با ۳۰۱. ساختار `/%postname%/` را در وردپرس بگذار و `?p=123` را حذف کن."],
    [["search console", "سرچ کنسول", "gsc"], "**Search Console** رایگان‌ترین و دقیق‌ترین منبع داده است. ۵ گزارش کلیدی: Performance (query/صفحه/کشور)، Pages (نمایه‌شدن و دلیل رد)، Sitemaps، Core Web Vitals، Manual actions/Security. روتین هفتگی: صفحات با نمایش بالا و CTR پایین را پیدا کن و عنوان/متای آن‌ها را بهتر کن؛ سریع‌ترین بردها همین‌جاست."],
  ];

  /* ---------- intents ---------- */
  const INTENTS = {
    greet: ['سلام', 'درود', 'hi', 'hello', 'وقت بخیر', 'صبح بخیر', 'عصر بخیر'],
    autofix: ['اصلاح و تغییرات خودکار', 'اصلاحات خودکار', 'اصلاح خودکار', 'پیشنهاد اصلاح', 'تغییرات پیشنهادی', 'بهینه سازی خودکار', 'بهینه‌سازی خودکار', 'اصلاح بعد از تایید', 'اصلاح بعد از تأیید', 'تایید و اعمال', 'تأیید و اعمال', 'خودت اصلاح کن', 'خودکار اصلاح کن', 'پیشنهادهای اصلاح', 'اصلاحات سایت', 'seo geo aeo', 'سئو geo aeo'],
    help: ['کمک', 'راهنما', 'چه کاری', 'چیکار میکنی', 'چکار میکنی', 'امکانات', 'قابلیت', 'توانایی', 'چه کارایی', 'چه سوالایی', 'چه کارهایی', 'بلد است', 'بلدی'],
    summary: ['گزارش', 'خلاصه', 'وضعیت', 'اجرایی', 'نمای کلی', 'سلامت سایت', 'overview', 'حال سایت', 'ارزیابی'],
    plan: ['برنامه', 'نقشه راه', 'اولویت', 'چیکار کنم', 'چکار کنم', 'چه کنم', 'چی کار کنم', 'قدم', 'گام', 'roadmap', 'از کجا شروع', 'اول چی', '7 روز', '30 روز', '90 روز', 'هفت روز', 'سی روز'],
    seo: ['سئو', 'seo', 'مشکل', 'ایراد', 'خطا', 'ضعف', 'canonical', 'noindex', 'یافته', 'تصویر', 'کم محتوا', 'alt', 'h1', 'مشکلات'],
    score: ['امتیاز', 'نمره', 'بالا ببرم', 'بالا بره', 'ببرم بالا', 'افزایش امتیاز', 'چرا کمه', 'چرا پایینه', 'score'],
    aibots: ['ربات', 'خزنده', 'gptbot', 'claudebot', 'perplexitybot', 'bytespider', 'ccbot', 'crawler', 'می بینند', 'نمیبینند', 'نمی بینند', 'میبینند', 'دیده میشم', 'دیده نمیشم', 'مسدود', 'بلاک', 'دسترسی ai'],
    robots: ['robots', 'ربوتس', 'robots.txt', 'فایل ربات'],
    llms: ['llms', 'ال ال ام', 'llm.txt'],
    schema: ['schema', 'اسکیما', 'json-ld', 'jsonld', 'داده ساختار', 'ریچ ریزالت', 'rich result', 'faqpage'],
    titles: ['عنوان پیشنهاد', 'متا پیشنهاد', 'بازنویسی', 'عنوان جدید', 'تایتل', 'توضیحات پیشنهاد', 'عنوان و متا', 'عنوان بده', 'متا بده', 'title'],
    traffic: ['ترافیک', 'بازدید', 'منبع', 'از کجا', 'ورودی', 'کانال', 'traffic', 'visitor', 'کاربرا', 'مخاطب'],
    keywords: ['کلمه کلیدی', 'کلمات کلیدی', 'کیورد', 'keyword', 'عبارت جستجو', 'چی سرچ'],
    aipages: ['کدام صفحه', 'کدوم صفحه', 'صفحاتی که', 'صفحه هایی که', 'صفحه ها رو'],
    airef: ['دستیارهای ai', 'دستیار های ai', 'chatgpt', 'چت جی', 'جمینای', 'gemini', 'پرپلکسیتی', 'perplexity', 'دستیار ai', 'ورودی از ai', 'بازدید از هوش مصنوعی', 'از هوش مصنوعی'],
    wp: ['وردپرس', 'wordpress', 'yoast', 'rank math', 'رنک مث', 'کش', 'cache', 'blog_public', 'دیده نشدن', 'افزونه سئو', 'ووکامرس', 'woocommerce'],
    trend: ['روند', 'رشد', 'افت', 'کاهش', 'افزایش', 'مقایسه', 'نسبت به', 'trend', 'کم شده', 'زیاد شده'],
    rules: ['قانون گوگل', 'قوانین گوگل', 'قوانین سئو', 'قانون سئو', 'قوانین geo', 'قوانین جئو', 'قوانین aeo', 'الگوریتم گوگل', 'رعایت قوانین', 'قوانین رسمی', 'e e a t', 'eeat', 'core web vitals', 'اسپم', 'خرافه', 'افسانه', 'باور غلط', 'منسوخ', 'hreflang', 'کانونیکال', 'canonical', 'helpful content', 'ai overview', 'ai mode', 'ایندکس نمیشه', 'اسپم'],
    glossary: ['چیست', 'یعنی چی', 'یعنی چه', 'معنی', 'what is', 'تعریف', 'توضیح بده'],
    more: ['بیشتر', 'ادامه', 'بعدی', 'more', 'بقیه', 'ادامه بده'],
  };
  const PRIORITY = ['more', 'rules', 'robots', 'llms', 'schema', 'titles', 'airef', 'aipages', 'keywords', 'aibots', 'score', 'plan', 'trend', 'traffic', 'wp', 'seo', 'summary', 'glossary', 'help', 'greet'];
  const KW = {}; Object.keys(INTENTS).forEach((k) => { KW[k] = INTENTS[k].map(norm); });
  function classify(t) {
    const sc = {}; let best = null, bs = 0;
    PRIORITY.forEach((id) => { let s = 0; KW[id].forEach((k) => { if (k && t.includes(k)) s += k.split(' ').length * 2 + (k.length > 5 ? 1 : 0); }); if (s) sc[id] = s; });
    const make = /(بساز|بنویس|تولید|نمونه|بده|درست کن|بسازش|generate)/.test(t);
    if (sc.robots && make) sc.robots += 6; if (sc.llms && make) sc.llms += 6; if (sc.schema && make) sc.schema += 4;
    if (sc.aibots && make && /(مسدود|بلاک|اجازه|robots|فایل)/.test(t)) sc.robots = (sc.robots || 0) + 7;
    if (sc.glossary && GLOSS.some((g) => g[0].some((k) => t.includes(norm(k))))) sc.glossary += 6;
    if (SR() && (/(قانون|قوانین|الگوریتم|دستورالعمل|guideline|rules?)/.test(t) && /(گوگل|google|سئو|seo|geo|جئو|aeo|ai|هوش مصنوعی)/.test(t))) sc.rules = (sc.rules || 0) + 12;
    if (SR() && /(خرافه|افسانه|باور غلط|اشتباه رایج|منسوخ|myth|درسته که|واقعا|اصلا لازم|لازم است|لازمه|تاثیر داره|اثر داره|جریمه میشم)/.test(t) && SR().search(t, 1).length) sc.rules = (sc.rules || 0) + 9;
    const defQ = /(چیست|یعنی چی|یعنی چه|معنی|تعریف|what is)/.test(t) && GLOSS.some((g) => g[0].some((k) => t.includes(norm(k)))) && !/(قانون|قوانین|خرافه|رعایت)/.test(t);
    if (!defQ && SR() && /(e e a t|eeat|core web vitals|\blcp\b|\binp\b|\bcls\b|hreflang|کانونیکال|spam|اسپم|helpful content|ai overview|ai mode|site reputation|scaled content|back button)/.test(t)) sc.rules = (sc.rules || 0) + 6;
    if (sc.rules && /(بساز|بنویس|تولید|درست کن)/.test(t) && (sc.robots || sc.llms || sc.schema)) sc.rules = Math.max(0, sc.rules - 8);
    if (t.includes('روند')) sc.trend = (sc.trend || 0) + 5;
    if (/\bai\b|هوش مصنوعی/.test(t) && /(بازدید|ورودی|ترافیک)/.test(t) && /(دستیار|چت|از ai|از هوش)/.test(t)) sc.airef = (sc.airef || 0) + 5;
    if (/^(بیشتر|ادامه|بعدی|بقیه)/.test(t)) sc.more = 20;
    if (/(چطور|چگونه|چطوری|آموزش)/.test(t) && codeIn(t) && !/(بساز|بنویس)/.test(t)) sc.fixhow = (sc.fixhow || 0) + 14;
    if (/(اگر|چند امتیاز|چقدر امتیاز)/.test(t) && /(امتیاز|نمره)/.test(t) && codeIn(t)) sc.whatif = (sc.whatif || 0) + 16;
    if (/(گزارش)/.test(t) && /(مشتری|مدیر|ارسال|رسمی|کامل)/.test(t)) sc.client = (sc.client || 0) + 8;
    if (/(سوال|پرسش)/.test(t) && /(متداول|جواب|پاسخ)/.test(t) && !/اسکیما|schema/.test(t)) sc.faq = (sc.faq || 0) + 6;
    if (/چرا/.test(t) && /(ترافیک|بازدید|کسی|رتبه|دیده)/.test(t)) sc.why = (sc.why || 0) + 6;
    PRIORITY.forEach((id) => { if (sc[id] > bs) { bs = sc[id]; best = id; } });
    return best || fuzzy(t);
  }

  /* ---------- answer builders ---------- */
  const chips = (...a) => a.filter(Boolean);
  const needReport = () => ({ text: 'برای این تحلیل هنوز نتیجهٔ بازرسی ندارم. از تب **رادار** نشانی سایت را وارد کن (یا «داده نمونه» را بزن) و بعد دوباره بپرس.', chips: ['دستیار چه کارهایی بلد است؟', 'GEO چیست؟'] });
  const needLog = (extra) => ({ text: 'برای این بخش داده‌ٔ ترافیک لازم است. یا افزونهٔ **Site Inspector Bridge** را از ⚙ وصل کن، یا فایل لاگ سرور را در تب ترافیک وارد کن.' + (extra ? '\n\n' + extra : ''), chips: ['robots.txt بساز', 'GEO چیست؟'] });
  const verdict = (s) => (s >= 80 ? 'خوب' : s >= 55 ? 'متوسط' : 'ضعیف');

  function aSummary(ctx) {
    const r = ctx.report, l = ctx.log; if (!r && !l) return needReport(); const out = []; const items = planItems(ctx);
    if (r) {
      out.push('**گزارش اجرایی ' + r.site + '**', '', '- سئو: **' + r.scores.seo + '** از ۱۰۰ (' + verdict(r.scores.seo) + ')', '- آمادگی برای AI: **' + r.scores.ai + '** از ۱۰۰ (' + verdict(r.scores.ai) + ')', '- صفحات سالم: **' + r.scores.ok + '٪** از ' + r.pages.length + ' صفحهٔ بررسی‌شده',
        '- یافته‌ها: ' + r.counts.critical + ' بحرانی، ' + r.counts.high + ' مهم، ' + r.counts.medium + ' متوسط، ' + r.counts.low + ' کم');
      const pol = policy(r); out.push('- خزنده‌های AI: ' + (pol.searchBlocked.length ? '⚠️ جستجوی AI مسدود (' + pol.searchBlocked.join('، ') + ')' : 'جستجوی AI باز است') + (pol.trainBlocked.length ? ' · آموزش مدل مسدود (' + pol.trainBlocked.length + ' ربات)' : ''));
    }
    const tf = trafficFacts(l);
    if (tf) { out.push('', '**ترافیک:** ' + tf.human + ' بازدید انسانی، ' + tf.aiHits + ' درخواست رباتان AI، ' + tf.aiRefs + ' ورودی از دستیارهای AI' + (tf.top ? '؛ بیشترین ورودی از «' + CH[tf.top.type] + '» (' + tf.top.share + '٪)' : '') + '.'); if (tf.trend && tf.trend.change !== null) out.push('روند: ' + (tf.trend.change >= 0 ? '+' : '') + tf.trend.change + '٪ نسبت به نیمهٔ اول بازه.'); }
    if (items.length) { out.push('', '**سه اقدام اول:**'); items.slice(0, 3).forEach((i, k) => out.push((k + 1) + '. ' + SEVF[i.sev] + ' ' + i.title)); }
    return { text: out.join('\n'), chips: chips('برنامهٔ اقدام بده', 'چرا امتیاز سئو این قدر است؟', 'رباتان AI من را می‌بینند؟') };
  }
  function aPlan(ctx, more, horizon) {
    if (!ctx.report && !ctx.log && !ctx.brief) return needReport(); let items = planItems(ctx); if (!items.length) return { text: 'با داده‌های فعلی مورد فوری پیدا نکردم. سایت را دوباره بازرسی کن یا لاگ/افزونه را وصل کن تا دقیق‌تر شوم.', chips: ['گزارش کلی بده'] };
    if (horizon) items = items.filter((i) => i.horizon <= horizon); const P = 6, page = items.slice(more * P, more * P + P);
    if (!page.length) return { text: 'مورد بیشتری نیست. ✅', chips: ['گزارش کلی بده'] };
    const out = ['**برنامهٔ اقدام' + (horizon ? ' (تا ' + horizon + ' روز)' : '') + '** — به ترتیب بیشترین اثر نسبت به زحمت:', ''];
    page.forEach((i, k) => out.push((more * P + k + 1) + '. ' + SEVF[i.sev] + ' **' + i.title + '** · ⏱ ' + i.horizon + ' روز', '   - چرا: ' + i.why, '   - چطور: ' + i.how));
    if (items.length > (more + 1) * P) out.push('', 'برای ادامهٔ فهرست بنویس «بیشتر».');
    return { text: out.join('\n'), chips: chips('بیشتر', 'robots.txt بساز', 'عنوان و متای پیشنهادی بده', 'اسکیما بساز'), more: true };
  }
  function aSeo(ctx, more) {
    const r = ctx.report; if (!r) return needReport(); const g = SI.groupIssues(r); if (!g.length) return { text: 'در ' + r.pages.length + ' صفحهٔ بررسی‌شده مشکلی پیدا نشد. 🎉', chips: ['گزارش کلی بده'] };
    const P = 6, page = g.slice(more * P, more * P + P); const out = ['**یافته‌های سئو** (' + g.length + ' نوع مشکل):', ''];
    page.forEach((x) => { const urls = [...new Set(x.urls)]; out.push(SEVF[x.severity] + ' **' + x.title + '** — ' + urls.length + ' مورد', '   ' + x.detail, '   نمونه: `' + pathOf(urls[0]) + '`'); });
    if (g.length > (more + 1) * P) out.push('', 'برای بقیه بنویس «بیشتر».');
    return { text: out.join('\n'), chips: chips('بیشتر', 'برنامهٔ اقدام بده', 'عنوان و متای پیشنهادی بده'), more: true };
  }
  function aScore(ctx) {
    const r = ctx.report; if (!r) return needReport(); const codes = {}; [...r.pages.flatMap((p) => p.issues), ...r.siteIssues].forEach((i) => { codes[i.code] = i.title; });
    const gains = Object.keys(codes).map((c) => ({ c, t: codes[c], d: scoreWithout(r, c) - r.scores.seo })).filter((x) => x.d > 0).sort((a, b) => b.d - a.d);
    const out = ['**امتیاز سئو: ' + r.scores.seo + '** — هر یافته با وزن شدتش (بحرانی ۱۲، مهم ۷، متوسط ۳، کم ۱) از ۱۰۰ کم می‌کند.', ''];
    if (gains.length) { out.push('اگر هر مورد را کامل رفع کنی، امتیاز این‌قدر بالا می‌رود:'); gains.slice(0, 6).forEach((x) => out.push('- ' + x.t + ': **+' + x.d + '**')); const all = gains.reduce((a, b) => a + b.d, 0); out.push('', 'مجموع بهبود ممکن: حدود +' + Math.min(100 - r.scores.seo, all) + ' (سقف ۱۰۰).'); } else out.push('هیچ یافتهٔ کم‌کننده‌ای نمانده است.');
    const lost = (r.aiParts || []).filter(([, v, m]) => v < m); out.push('', '**آمادگی AI: ' + r.scores.ai + '**'); if (lost.length) lost.forEach(([n, v, m]) => out.push('- ' + n + ': ' + v + ' از ' + m)); else out.push('- همهٔ بخش‌ها کامل است.');
    return { text: out.join('\n'), chips: chips('برنامهٔ اقدام بده', 'llms.txt بساز', 'robots.txt بساز') };
  }
  function aAIBots(ctx) {
    const r = ctx.report, l = ctx.log; if (!r && !l) return needReport(); const out = []; const tf = trafficFacts(l);
    if (r) {
      const pol = policy(r); out.push('**دسترسی خزنده‌های AI طبق robots.txt**' + (pol.found ? '' : ' (فایل robots.txt پیدا نشد؛ یعنی همه مجازند)'), '');
      const line = (name, arr, blocked) => out.push('- ' + name + ': ' + (blocked.length ? '🔴 مسدود: ' + blocked.join('، ') : '🟢 باز'));
      line('جستجوی AI (OAI-SearchBot، PerplexityBot …)', pol.by.search, pol.searchBlocked); line('درخواست مستقیم کاربر (ChatGPT-User …)', pol.by.user, pol.userBlocked); line('آموزش مدل (GPTBot، ClaudeBot …)', pol.by.training, pol.trainBlocked);
      if (pol.partial.length) out.push('- 🟡 محدودشده (بعضی مسیرها): ' + pol.partial.join('، '));
      if (pol.searchBlocked.length) out.push('', '⚠️ **مهم:** مسدودبودن گروه جستجوی AI یعنی در پاسخ‌های ChatGPT/Perplexity کم دیده می‌شوی. مسدودکردن «آموزش مدل» ولی روی دیده‌شدن اثری ندارد و انتخاب سیاستی است.');
    }
    if (tf && l.ai.length) {
      out.push('', '**بازدید واقعی رباتان (' + tf.aiHits + ' درخواست):**'); l.ai.slice(0, 6).forEach((b) => out.push('- ' + b.id + ' (' + b.vendor + '): ' + b.hits + ' بار' + (b.blocked ? '، ' + b.blocked + ' رد‌شده' : '')));
      if (tf.rejectRate >= 20) out.push('', '🟠 ' + tf.rejectRate + '٪ درخواست‌ها رد شده (۴xx/۵xx). معمولاً فایروال، Cloudflare Bot Fight یا افزونهٔ امنیتی مانع است.');
      if (r) { const pol = policy(r); const bl = new Set(pol.by.training.concat(pol.by.search, pol.by.user).filter((b) => b.status === 'blocked').map((b) => b.id)); const ig = l.ai.filter((b) => bl.has(b.id) && b.ok > 0); if (ig.length) out.push('', '🔴 این ربات‌ها در robots.txt مسدودند ولی همچنان صفحات را با موفقیت گرفته‌اند: ' + ig.map((b) => b.id).join('، ') + ' — robots.txt فقط درخواست مؤدبانه است؛ برای جلوگیری واقعی باید در سطح سرور/فایروال مسدود شوند.'); }
    } else if (l && !l.ai.length) out.push('', 'در داده‌های ترافیک فعلی بازدید رباتان AI ثبت نشده. اگر کش یا CDN داری ممکن است ثبت نشود.');
    else if (!l) out.push('', 'برای دیدن بازدید **واقعی** رباتان، افزونهٔ Bridge را وصل کن یا لاگ سرور را وارد کن.');
    return { text: out.join('\n'), chips: chips('robots.txt بساز', 'از دستیارهای AI چقدر بازدید دارم؟', 'کدام صفحه‌ها را AI دیده؟') };
  }
  function aRobots(ctx, state, t) {
    let mode = state.policy || 'balanced'; if (/(همه|هرچی).*(مجاز|اجازه|باز)|باز کن|open/.test(t)) mode = 'open'; else if (/(همه).*(مسدود|بلاک|ببند)|ببند|closed/.test(t)) mode = 'closed'; else if (/(آموزش|متعادل|پیشنهاد|فقط)/.test(t)) mode = 'balanced'; state.policy = mode;
    const names = { balanced: 'متعادل (پیشنهادی)', open: 'همه مجاز', closed: 'همه مسدود' };
    return { text: '**robots.txt — سیاست ' + names[mode] + '**\n\n```\n' + genRobots(ctx, mode) + '\n```\nاین را جایگزین/ادغام با فایل فعلی در ریشهٔ سایت کن' + (ctx.brief ? ' (در وردپرس: Yoast ← ابزارها ← ویرایشگر فایل، یا فایل فیزیکی robots.txt)' : '') + '. بعد از اعمال، دوباره بازرسی کن.\n\n' + (mode === 'balanced' ? 'منطق: ربات‌های جستجو و درخواست لحظه‌ای کاربر باز می‌مانند تا در پاسخ‌های AI دیده شوی؛ فقط جمع‌آوری برای آموزش مدل بسته می‌شود.' : mode === 'open' ? 'هشدار: محتوایت می‌تواند برای آموزش مدل‌ها هم استفاده شود.' : 'هشدار: با بستن همه، در پاسخ‌های AI تقریباً دیده نمی‌شوی.'), chips: chips('همهٔ رباتان AI را مجاز کن، robots.txt بساز', 'همه را مسدود کن robots.txt بساز', 'فقط آموزش مدل را مسدود کن robots.txt بساز', 'llms.txt بساز') };
  }
  function aLlms(ctx) { const g = genLlms(ctx); if (!g) return needReport(); return { text: '**llms.txt پیشنهادی** (از ' + ctx.report.pages.length + ' صفحهٔ بازرسی‌شده):\n\n```\n' + g + '\n```\nآن را با نام `llms.txt` در ریشهٔ سایت بگذار (`' + ctx.report.origin + 'llms.txt`). توضیح کوتاه بالا را با جملهٔ دقیق خودت جایگزین کن. تضمینی نیست AI از آن استفاده کند، ولی هزینه‌اش صفر است.', chips: ['robots.txt بساز', 'اسکیما بساز', 'برنامهٔ اقدام بده'] }; }
  function aSchema(ctx, t) {
    const k = /(faq|سوال|پرسش)/.test(t) ? 'faq' : /(محصول|product)/.test(t) ? 'product' : /(مقاله|article|نوشته|بلاگ)/.test(t) ? 'article' : /(محلی|local|مغازه|شعبه)/.test(t) ? 'local' : /(وب ?سایت|website|جستجو)/.test(t) ? 'site' : 'org'; const s = genSchema(ctx, k);
    return { text: '**' + s.title + '** — مناسب: ' + s.where + '\n\n```\n' + s.code + '\n```\nمقادیر نمونه را با اطلاعات واقعی عوض کن و کد را داخل `<head>` (یا فیلد سفارشی افزونهٔ سئو) بگذار. ' + (ctx.brief && ctx.brief.site && ctx.brief.site.seoPlugin ? ctx.brief.site.seoPlugin + ' بخشی از اسکیما را خودکار می‌سازد؛ از دوباره‌کاری و تکرار جلوگیری کن. ' : '') + 'حتماً با «Rich Results Test» گوگل بسنج. برای FAQPage فقط سؤال‌هایی بگذار که واقعاً در متن صفحه هست.', chips: ['اسکیما FAQ بساز', 'اسکیما مقاله بساز', 'اسکیما محصول بساز', 'llms.txt بساز'] };
  }
  function charCount(value) { return [...String(value || '')].length; }
  function trimAtWord(value, max) {
    let s = [...String(value || '').trim()].slice(0, max).join('');
    if (s.length && charCount(value) > max) s = s.replace(/\s+\S*$/, '').trim();
    return s.replace(/[،؛:|\-–—\s]+$/, '').trim();
  }
  function proposalTitle(item, brand) {
    const current = String(item.metaTitle || item.title || '').trim();
    let candidate = current;
    if (charCount(candidate) > 60) candidate = trimAtWord(candidate, 58);
    else if (charCount(candidate) < 15 && brand) {
      const add = ' | ' + String(brand).trim();
      if (charCount(candidate + add) <= 60) candidate += add;
    }
    return candidate && candidate !== String(item.metaTitle || '') ? candidate : '';
  }
  function proposalDescription(item) {
    if (item.metaDescription) return '';
    let source = String(item.excerpt || item.contentPreview || '').replace(/\s+/g, ' ').trim();
    if (charCount(source) < 70) return '';
    if (charCount(source) > 158) source = trimAtWord(source, 155);
    if (charCount(source) < 70) return '';
    return source;
  }
  function proposeFixes(ctx) {
    const catalog = ctx && ctx.catalog;
    if (!catalog || !Array.isArray(catalog.items)) return [];
    const brand = (catalog.site && catalog.site.name) || (ctx.brief && ctx.brief.site && ctx.brief.site.name) || '';
    const out = [];
    catalog.items.forEach((item) => {
      if (!item || !item.id || !item.revision) return;
      const changes = {};
      const issues = Array.isArray(item.issues) ? item.issues : [];
      if (issues.includes('long_title') || issues.includes('short_title')) {
        const title = proposalTitle(item, brand);
        if (title && charCount(title) >= 5 && charCount(title) <= 70) changes.seo_title = title;
      }
      if (issues.includes('no_meta_description') || !item.metaDescription) {
        const desc = proposalDescription(item);
        if (desc) changes.meta_description = desc;
      }
      if (item.schemaSupported && !item.schemaEnabled) changes.schema_mode = 'auto';
      if (!Object.keys(changes).length) return;
      const labels = [];
      if (changes.seo_title) labels.push('عنوان سئو');
      if (changes.meta_description) labels.push('توضیحات متا');
      if (changes.schema_mode) labels.push('اسکیما و ناشر سازمان');
      out.push({
        id: String(item.id), post_id: Number(item.id), type: item.type, title: item.title,
        url: item.url, revision: item.revision, modified: item.modified,
        changes, labels, excerpt: item.excerpt || '',
        before: { seo_title: item.metaTitle || '', meta_description: item.metaDescription || '', schema_mode: item.schemaEnabled ? 'auto' : 'off' },
        reason: labels.join(' + '),
        schemaNote: changes.schema_mode ? 'دادهٔ ساختاریافته از عنوان، نشانی، نویسنده و تاریخ همین محتوا ساخته می‌شود؛ اطلاعات ساختگی مثل آدرس یا تلفن اضافه نمی‌شود.' : '',
      });
    });
    return out;
  }
  function aFixes(ctx) {
    if (!ctx.bridgeConnected) return { text: 'برای پیشنهاد اصلاح و اعمال تأییدشده، اول افزونهٔ **Site Inspector Bridge** را از بخش تنظیمات به سایت وصل کن. تحلیل داخلی بدون API باقی می‌ماند؛ ارتباط با وردپرس فقط برای خواندن/نوشتن دادهٔ همان سایت است.', chips: ['دستیار چه کارهایی بلد است؟'] };
    if (!ctx.catalog) return { text: 'هنوز فهرست محتوای وردپرس دریافت نشده است. یک بار دیگر «اصلاحات خودکار» را بفرست تا صفحات و محصولات منتشرشده را تحلیل کنم.', chips: ['اصلاحات خودکار سایت'] };
    const proposals = proposeFixes(ctx);
    if (!proposals.length) return { text: 'در محتوای قابل‌ویرایش فعلی، اصلاح متادیتای مطمئن و بدون حدس پیدا نکردم. برای پیشنهاد دقیق‌تر، صفحات بیشتری را اسکن کن یا محتوای خالی/کم‌جزئیات را کامل کن.', chips: ['گزارش کلی بده', 'برنامهٔ اقدام بده'] };
    const lines = ['**پیشنهادهای قابل بررسی برای سایت**', '', 'از ' + (ctx.catalog.sampleSize || ctx.catalog.items.length) + ' محتوای منتشرشده، برای ' + proposals.length + ' مورد پیشنهاد مشخص دارم:', ''];
    proposals.slice(0, 8).forEach((p, i) => lines.push((i + 1) + '. **' + p.title + '** — ' + p.reason + (p.changes.schema_mode ? ' (AEO/GEO: اسکیما با ناشر سازمان)' : '')));
    if (proposals.length > 8) lines.push('', 'و ' + (proposals.length - 8) + ' مورد دیگر.');
    if (!ctx.catalog.canApply) lines.push('', '⚠️ امکان نوشتن هنوز خاموش است. در پیشخوان وردپرس ← Site Inspector ← تنظیمات، گزینهٔ «اصلاحات تأییدشده از اپ» را روشن کن.');
    else lines.push('', 'هر پیشنهاد در کارت جداگانه با مقدار فعلی و مقدار جدید نمایش داده می‌شود. هیچ تغییری بدون زدن دکمهٔ «تأیید و اعمال» انجام نمی‌شود.');
    lines.push('', 'محدودیت هوشمندی داخلی: پیشنهادها روی متن واقعی موجود ساخته می‌شوند و مدل زبانی ابری نیستند؛ اطلاعات تجاری، قیمت، آدرس یا ادعاهای ناموجود را حدس نمی‌زنم.');
    return { text: lines.join('\n'), chips: ['برنامهٔ اقدام بده', 'وضعیت GEO و AEO را گزارش کن'] };
  }

  function aTitles(ctx, page) {
    const r = ctx.report; if (!r) return needReport(); const brand = (ctx.brief && ctx.brief.site && ctx.brief.site.name) || r.site.replace(/^www\./, '').split('.')[0];
    let ps = page ? [page] : r.pages.filter((p) => p.issues.some((i) => ['missing_title', 'long_title', 'short_title', 'missing_desc', 'long_desc'].includes(i.code))).slice(0, 5);
    if (!ps.length) return { text: 'عنوان و متای صفحات بررسی‌شده مشکل مشخصی ندارد. ✅', chips: ['گزارش کلی بده'] };
    const out = ['**پیشنهاد عنوان و متا** (پیش‌نویس قالب‌محور؛ قبل از انتشار با زبان و هدف صفحه تطبیقش بده):', ''];
    ps.forEach((p) => { const s = suggestFor(p, brand); out.push('**`' + pathOf(p.url) + '`**', '- فعلی: ' + (p.facts.title ? '«' + p.facts.title + '» (' + p.facts.titleLen + ' نویسه)' : 'ندارد') + ' | متا: ' + (p.facts.description ? p.facts.descLen + ' نویسه' : 'ندارد'), '- عنوان پیشنهادی (' + [...s.title].length + '): ' + s.title, '- متای پیشنهادی (' + [...s.meta].length + '): ' + s.meta, ''); });
    return { text: out.join('\n').trim(), chips: ['برنامهٔ اقدام بده', 'اسکیما بساز'] };
  }
  function aTraffic(ctx, more) {
    const l = ctx.log; const tf = trafficFacts(l); if (!tf) return needLog(); if (!tf.total) return { text: 'بازدید انسانی در این داده نیست.', chips: ['رباتان AI من را می‌بینند؟'] };
    const out = ['**ترافیک (' + tf.human + ' بازدید انسانی' + (l.from ? '، ' + new Date(l.from).toISOString().slice(0, 10) + ' تا ' + new Date(l.to).toISOString().slice(0, 10) : '') + ')**', ''];
    tf.chans.slice(0, 5).forEach(([k, v]) => out.push('- ' + CH[k] + ': ' + v + ' (' + pct(v, tf.total) + '٪)'));
    if (l.sources.length) { out.push('', '**منابع برتر:**'); l.sources.slice(0, 5).forEach((s) => out.push('- ' + s.source + ': ' + s.visits)); }
    if (l.landing.length) { out.push('', '**صفحات فرود از منابع خارجی:**'); l.landing.slice(0, 4).forEach(([p, n]) => out.push('- `' + p + '`: ' + n)); }
    const adv = []; if (tf.top && tf.top.share >= 65) adv.push('بیش از دو سوم ورودی از «' + CH[tf.top.type] + '» است؛ وابستگی ریسک دارد.'); if (tf.aiHits >= 10 && !tf.aiRefs) adv.push('رباتان AI می‌آیند ولی بازدیدی از دستیارهای AI نیست؛ محتوا نقل نمی‌شود.'); if (tf.aiRefs) adv.push(tf.aiRefs + ' بازدید از دستیارهای AI داری؛ صفحات فرودشان را تقویت کن.'); if (tf.topLandShare >= 50) adv.push('بیش از نیمی از ورودی خارجی به یک صفحه می‌رود (' + tf.topLandShare + '٪).');
    if (adv.length) { out.push('', '**برداشت:**'); adv.forEach((a) => out.push('- ' + a)); }
    return { text: out.join('\n'), chips: chips('روند ترافیک چطور است؟', 'کلمات کلیدی ورودی', 'از دستیارهای AI چقدر بازدید دارم؟', 'برنامهٔ اقدام بده') };
  }
  function aKeywords(ctx) {
    const l = ctx.log; if (!l) return needLog(); const kw = l.keywords || [];
    return { text: kw.length ? '**کلمات کلیدی ثبت‌شده در ارجاع‌ها:**\n\n' + kw.slice(0, 10).map(([k, n]) => '- ' + k + ': ' + n).join('\n') + '\n\nاین‌ها فقط موتورهایی‌اند که عبارت جستجو را فرستاده‌اند (مثل بینگ).' : 'در داده‌ها کلمهٔ کلیدی‌ای ثبت نشده — طبیعی است.', chips: ['ترافیک من از کجاست؟'] , extra: '\n\nگوگل عبارت جستجو را در referrer نمی‌فرستد. برای کلمات کلیدی واقعی **Google Search Console ← Performance ← Queries** را ببین؛ اپ از بیرون به آن دسترسی ندارد.' };
  }
  function aAIRef(ctx) {
    const l = ctx.log; const tf = trafficFacts(l); if (!tf) return needLog(); const src = (l.sources || []).filter((s) => s.type === 'ai');
    const out = ['**بازدید از دستیارهای AI:** ' + tf.aiRefs + ' (' + pct(tf.aiRefs, tf.total) + '٪ از ورودی‌ها)', ''];
    if (src.length) src.forEach((s) => out.push('- ' + s.source + ': ' + s.visits)); else out.push('هیچ ورودی مستقیمی از ChatGPT/Perplexity/Gemini ثبت نشده.');
    if (tf.aiHits && !tf.aiRefs) out.push('', 'رباتان AI ' + tf.aiHits + ' بار آمده‌اند ولی کاربری از آن‌ها نیامده؛ یعنی **خوانده می‌شوی ولی نقل نمی‌شوی**. راه‌حل: پاسخ مستقیم زیر تیتر پرسشی، FAQ، اسکیما، آمار و منبع قابل‌استناد، و محتوای تخصصی‌تر از رقبا.');
    out.push('', 'نکته: بسیاری از کاربران AI بدون Referrer می‌آیند و در «مستقیم» دیده می‌شوند؛ عدد واقعی بیشتر است.');
    return { text: out.join('\n'), chips: ['اسکیما FAQ بساز', 'برنامهٔ اقدام بده', 'کدام صفحه‌ها را AI دیده؟'] };
  }
  function aAIPages(ctx) {
    const l = ctx.log; if (!l) return needLog(); if (!l.aiPages.length) return { text: 'صفحه‌ای که رباتان AI دیده باشند ثبت نشده است.', chips: ['رباتان AI من را می‌بینند؟'] };
    const out = ['**صفحاتی که رباتان AI بیشتر خوانده‌اند:**', '']; l.aiPages.slice(0, 8).forEach(([p, n]) => out.push('- `' + p + '`: ' + n + ' بار'));
    if (ctx.report) { const seen = new Set(l.aiPages.map((x) => x[0])); const unseen = ctx.report.pages.filter((p) => !seen.has(pathOf(p.url).split('?')[0]) && p.status < 400).slice(0, 5); if (unseen.length) out.push('', '**صفحات بازرسی‌شده‌ای که AI هنوز ندیده:**', ...unseen.map((p) => '- `' + pathOf(p.url) + '`')); out.push('', 'برای معرفی آن‌ها: لینک داخلی از صفحات پربازدید، حضور در نقشهٔ سایت و llms.txt.'); }
    return { text: out.join('\n'), chips: ['llms.txt بساز', 'برنامهٔ اقدام بده'] };
  }
  function aWP(ctx) {
    const b = ctx.brief; if (!b) return { text: 'اطلاعات وردپرس را وقتی دارم که افزونهٔ **Site Inspector Bridge** وصل باشد (⚙ ← اتصال به افزونه).', chips: ['GEO چیست؟'] };
    const s = b.site || {}; const out = ['**وضعیت وردپرس**', '', '- نسخه: ' + s.wordpress + ' · PHP ' + s.php + ' · زبان ' + s.language, '- HTTPS: ' + (s.https ? '✅' : '🔴 غیرفعال'), '- دیده‌نشدن در موتورهای جستجو: ' + (s.searchEnginesDiscouraged ? '🔴 **روشن است!**' : '✅ خاموش'), '- پیوند یکتا: ' + (s.pretty_permalinks ? '✅' : '🟠 ساده (بهتر است «نام نوشته» شود)'), '- نقشهٔ سایت هستهٔ وردپرس: ' + (s.coreSitemap ? '✅' : 'غیرفعال'), '- افزونهٔ سئو: ' + (s.seoPlugin || '🟠 ندارد'), '- افزونهٔ کش: ' + (s.cachePlugin || 'ندارد'), '- ووکامرس: ' + (s.woocommerce ? 'بله' : 'خیر')];
    const ic = b.issueCounts || {}; const keys = Object.keys(ic); if (keys.length) { const nm = { no_meta_description: 'بدون متا', noindex: 'noindex', thin_content: 'محتوای کم', images_without_alt: 'تصویر بدون alt', long_title: 'عنوان بلند', short_title: 'عنوان کوتاه', no_featured_image: 'بدون تصویر شاخص' }; out.push('', '**از ' + b.sampleSize + ' محتوای اخیر:**'); keys.forEach((k) => out.push('- ' + (nm[k] || k) + ': ' + ic[k])); }
    if ((b.weakestContent || []).length) { out.push('', '**ضعیف‌ترین‌ها:**'); b.weakestContent.slice(0, 5).forEach((w) => out.push('- ' + w.title + ' → ' + w.issues.join('، '))); }
    if (s.cachePlugin) out.push('', 'ℹ️ با ' + s.cachePlugin + ' ممکن است بخشی از بازدید رباتان ثبت نشود.');
    return { text: out.join('\n'), chips: ['برنامهٔ اقدام بده', 'عنوان و متای پیشنهادی بده'] };
  }
  function aTrend(ctx) {
    const tf = trafficFacts(ctx.log); if (!tf) return needLog(); const out = ['**روند**', '']; const f = (t, name) => { if (!t) return out.push('- ' + name + ': داده برای مقایسه کافی نیست (حداقل ۶ روز).'); out.push('- ' + name + ': ' + t.before + ' ← ' + t.after + (t.change === null ? '' : ' (' + (t.change >= 0 ? '+' : '') + t.change + '٪)') + ' — مقایسهٔ ' + t.days + ' روز اول با ' + t.days + ' روز آخر'); };
    f(tf.trend, 'بازدید انسانی'); f(tf.aiTrend, 'درخواست رباتان AI');
    if (tf.trend && tf.trend.change !== null) out.push('', tf.trend.change <= -25 ? '🔴 افت محسوس؛ تغییرات اخیر سایت (قالب، ریدایرکت، noindex) و Search Console را بررسی کن.' : tf.trend.change >= 25 ? '🟢 رشد خوب؛ ببین کدام صفحه/کانال محرک بوده و همان را تقویت کن.' : 'تغییر محسوسی نیست.');
    return { text: out.join('\n'), chips: ['ترافیک من از کجاست؟', 'برنامهٔ اقدام بده'] };
  }
  function aPage(ctx, p) {
    const f = p.facts; const out = ['**صفحه `' + pathOf(p.url) + '`**', '', '- عنوان: ' + (f.title ? '«' + f.title + '» (' + f.titleLen + ' نویسه)' : '🔴 ندارد'), '- متا: ' + (f.description ? f.descLen + ' نویسه' : '🔴 ندارد'), '- H1: ' + f.h1 + ' · H2: ' + f.h2, '- ' + f.words + ' واژه · ' + f.images + ' تصویر (' + f.imagesNoAlt + ' بدون alt)', '- لینک: ' + f.internalLinks + ' داخلی / ' + f.externalLinks + ' خارجی', '- اسکیما: ' + (f.schema ? 'دارد' : 'ندارد') + ' · FAQ/پرسشی: ' + (f.hasFaq || f.questionHeadings ? 'دارد' : 'ندارد')];
    if (p.issues.length) { out.push('', '**مشکلات و راه‌حل:**'); p.issues.forEach((i) => out.push(SEVF[i.severity] + ' ' + i.title + ' — ' + (HOW[i.code] ? HOW[i.code](ctx) : i.detail))); } else out.push('', 'مشکل مشخصی ندارد. ✅');
    return { text: out.join('\n'), chips: ['عنوان و متای پیشنهادی همین صفحه', 'برنامهٔ اقدام بده'], page: p.url };
  }
  /* ---------- قوانین سئوی گوگل و GEO/AEO (SI.SeoRules) ---------- */
  const RKIND = { rule: '🔵 قانون رسمی', best: '🟢 توصیهٔ عملی', myth: '🔴 باور نادرست', dep: '⚫ منسوخ/تغییرکرده', info: 'ℹ️ واقعیت مرجع' };
  const ruleCard = (r) => '**' + r.title + '** — ' + RKIND[r.kind] + (r.engine === 'geo' ? ' · GEO/AEO' : r.engine === 'both' ? ' · سئو + GEO' : '') + '\n' + r.rule + (r.fix ? '\n↳ ' + r.fix : '') + (r.source ? '\n_منبع: ' + r.source.title + '_' : '');
  function aRules(ctx, t, more) {
    const SRm = SR(); if (!SRm) return { text: 'ماژول قوانین در این نسخه بارگذاری نشده است.', chips: ['دستیار چه کارهایی بلد است؟'] };
    const st = SRm.stats(); const per = 5; const off = (more || 0) * per;
    const audit = /(رعایت|بسنج|چقدر|وضعیت|ممیزی|چک کن|سایت من|سایتم)/.test(t) && /(قانون|قوانین)/.test(t);
    if (audit) {
      if (!ctx.report) return needReport();
      const extra = ctx.rulesExtra || []; const c = SRm.compliance(ctx.report, extra); const sm = c.summary;
      const bad = c.rows.filter((x) => x.state === 'fail').sort((a, b) => ({ critical: 0, high: 1, medium: 2, low: 3, info: 4 }[a.sev] - { critical: 0, high: 1, medium: 2, low: 3, info: 4 }[b.sev]));
      const out = ['**رعایت قوانین سئوی گوگل و GEO — ' + ctx.report.site + '**', '', '- امتیاز رعایت قوانین قابل‌سنجش: **' + (sm.score == null ? '—' : sm.score) + '** از ۱۰۰ (' + sm.pass + ' رعایت‌شده، ' + sm.fail + ' نقض‌شده)', '- ' + sm.manual + ' قانون فقط دستی قابل‌بررسی است (مثل Search Console، تجربهٔ کاربر، کیفیت محتوا)', ''];
      if (bad.length) { out.push('**نقض‌ها به‌ترتیب اهمیت:**'); bad.slice(off, off + per + 3).forEach((x, i) => { const r = SRm.get(x.id); out.push((off + i + 1) + '. ' + SEVF[x.sev] + ' **' + r.title + '** (' + x.count + ' مورد)' + (x.urls[0] ? ' — مثلاً `' + pathOf(x.urls[0]) + '`' : '') + '\n   ↳ ' + r.fix); }); if (bad.length > off + per + 3) out.push('', 'برای بقیه بنویس «بیشتر».'); }
      else out.push('✅ در سنجش‌های خودکار نقضی پیدا نشد؛ موارد دستی را در تب «سئو ← کتابخانهٔ قوانین» ببین.');
      out.push('', '_اثر هر قانون احتمالی است و تضمین رتبه نیست._');
      return { text: out.join('\n'), chips: ['قوانین GEO', 'خرافه‌های سئو', 'برنامهٔ اقدام بده'] };
    }
    const wantMyth = /(خرافه|افسانه|باور غلط|اشتباه رایج|منسوخ|myth)/.test(t);
    const area = wantMyth ? 'myth' : SRm.detectArea(t); const listy = /(قوانین|قانون|فهرست|چک لیست|همه|کلی|تمام|لیست)/.test(t);
    let rows, head;
    if (area && (listy || wantMyth)) { rows = SRm.byArea(area); head = '**' + SRm.AREAS.find((a) => a.id === area).name + '** — ' + rows.length + ' مورد'; }
    else { rows = SRm.search(t, 12); head = rows.length ? '**نزدیک‌ترین قوانین به پرسش شما:**' : ''; }
    if (!rows.length) { return { text: 'قانون مرتبطی پیدا نکردم. ' + st.total + ' قانون در ' + SRm.AREAS.length + ' دسته دارم؛ مثلاً بپرس: «قوانین GEO»، «خرافه‌های سئو»، «اسپم گوگل»، «سرعت و Core Web Vitals»، «قوانین کانونیکال» یا «آیا llms.txt لازم است؟»', chips: ['قوانین GEO', 'قوانین اسپم گوگل', 'خرافه‌های سئو', 'قوانین فنی و سرعت'] }; }
    const slice = rows.slice(off, off + per); if (!slice.length) return { text: 'مورد بیشتری برای این موضوع نیست.', chips: ['قوانین GEO', 'خرافه‌های سئو'] };
    const out = [head, '']; slice.forEach((r) => { out.push(ruleCard(r), ''); });
    if (rows.length > off + per) out.push('برای ' + (rows.length - off - per) + ' مورد بعدی بنویس «بیشتر».');
    out.push('_«قانون رسمی» یعنی در مستندات یا سیاست‌های گوگل آمده؛ «توصیهٔ عملی» یعنی تجربه و پژوهش است و تضمین رتبه یا استناد نمی‌دهد._');
    return { text: out.join('\n'), chips: ['رعایت قوانین را بسنج', 'قوانین GEO', 'خرافه‌های سئو', 'قوانین اسپم گوگل'] };
  }
  function aGloss(t) {
    const hit = GLOSS.filter((g) => g[0].some((k) => t.includes(norm(k)))); if (!hit.length) return null; return { text: hit.slice(0, 2).map((g) => g[1]).join('\n\n'), chips: ['گزارش کلی بده', 'برنامهٔ اقدام بده'] };
  }
  function aHelp() {
    return { text: '**من دستیار داخلی بازرس سایت هستم** — بدون API و آفلاین کار می‌کنم. مدل زبانی نیستم؛ داده‌های واقعی سایتت را تحلیل می‌کنم و فایل آماده می‌سازم:\n\n- 📋 گزارش اجرایی و برنامهٔ اقدام اولویت‌دار (۷/۳۰/۹۰ روزه)\n- 🔎 توضیح مشکلات سئو و اینکه رفع هرکدام چند امتیاز می‌دهد\n- 🤖 تحلیل دسترسی و بازدید رباتان AI، و تناقض robots با رفتار واقعی\n- 📚 **قوانین سئوی گوگل و GEO/AEO:** «قوانین GEO»، «خرافه‌های سئو»، «رعایت قوانین را بسنج»، «آیا llms.txt لازم است؟»\n- 🧾 ساخت **robots.txt**، **llms.txt** و **اسکیمای JSON-LD**\n- ✍️ پیش‌نویس عنوان و متای صفحات ضعیف\n- 🛍️ **سازندهٔ سئو در چت (فقط‌خواندنی):** «سئوی <نام محصول> را بساز»، سپس «یک عنوان دیگر بده»، «کوتاه‌ترش کن»، «چرا این عنوان؟»، «همین را اعمال کن» (فقط ترمیم را با پیش‌نمایش باز می‌کند)\n- 🧩 **بخش‌های جزئی سئوی یک محصول:** «کلیدواژه‌ها برای <محصول>»، «alt تصاویر برای …»، «اسلاگ برای …»، «اسکیما برای …»، «خلاصهٔ محصول برای …»، «شبکه‌های اجتماعی برای …»؛ و سنجش متن خودت: «عنوان را بسنج: …» یا «متا را بسنج: …» (پیکسل و حد گوگل)\n- 🗺️ **برنامهٔ سایت:** «برنامهٔ سئوی سایت»، «کار بعدی سئو چیست؟»، «ضعیف‌ترین محصولات»، «پیوند داخلی پیشنهاد بده»\n- 🩺 **ممیزی ساختاری:** «صفحه‌های یتیم»، «محتوای کم»، «عنوان‌های تکراری»، «آدرس‌های ناپاک»، «عنوان‌های بلند»، «وضعیت قفل سئو»\n- 🔧 **اصلاح سئو در همان گفتگو:** «سئوی <محصول> را اصلاح کن/بهینه کن/درست کن» یا همین جمله را عامیانه بنویس؛ کارت عنوان/متا/اسکیما می‌آید و «اعمال» فقط با پیش‌نمایش و تأیید در ترمیم انجام می‌شود. وقتی دربارهٔ یک محصول سؤال کنی، پس از پاسخ مدل چیپ «سئوی … را اصلاح کن» هم می‌آید\n- ♻️ **«بهتر کن»:** زیر آخرین پاسخ مدل دکمهٔ «بهتر کن» هست؛ همان پرسش دوباره با خواستهٔ «دقیق‌تر و با شواهد بیشتر» پرسیده می‌شود و پاسخ جایگزین می‌شود\n- 🎚️ **سبک پاسخ:** «کوتاه جواب بده»، «مفصل‌تر جواب بده»، «رسمی/صمیمی جواب بده» و برگشت با «سبک پاسخ را ریست کن»؛ در همین دستگاه ذخیره می‌شود و فقط پاسخ‌های مدل زبانی را عوض می‌کند\n- 🔗 **چند کار در یک جمله:** «اول قفل را نشان بده بعد برو به رشد» تا ۳ گام پشت‌سرهم اجرا می‌شود (اگر یک گام نامعتبر باشد هیچ‌کدام اجرا نمی‌شود)؛ گفتگوهای بلند هم برای مدل خودکار خلاصه می‌شوند تا زمینه گم نشود\n- 🧠 **فهم هوشمند با مدل روی گوشی:** اگر جمله‌ات را الگوها نشناسند، مدل محلی یکی از ابزارهای امن فهرست‌شده (برنامه، ضعیف‌ترین‌ها، ساخت سئوی محصول، رفتن به تب…) را انتخاب می‌کند؛ فقط ابزارهای فقط‌خواندنی، و نوشتن روی سایت همچنان فقط با تأیید خودت\n- 🗣️ **گفتگوی آزاد (با مدل روی گوشی):** دربارهٔ هر چیزی غیر از سایت هم می‌توانی چت کنی: توضیح، نوشتن، ترجمه، ایده، کد ساده. بدون مدل دانلودشده فقط دستورهای سایت و احوال‌پرسی ساده کار می‌کند\n- 🧬 **فهم عمیق‌تر با EmbeddingGemma:** اگر مدل جستجوی معنایی روی گوشی نصب باشد، جمله‌هایی که هیچ‌کدام از الگوها نمی‌شناسند هم بر اساس «معنی» (نه شباهت حروف) به ابزار درست می‌رسند\n- 🧭 **فهم معنایی محلی:** حتی اگر عین دستور را ننویسی («وضعیت سئوی فروشگاهم چطوره؟»، «از کجا شروع کنم؟»، «عنوان هام یکسان شدن») با تطبیق شباهت نویسه‌ای، بدون مدل و بدون اینترنت، به ابزار درست می‌رسد؛ پرسش‌های دانشی (چطور/چرا/تفاوت) هیچ‌وقت به‌جای ابزار اجرا نمی‌شوند\n- 💬 **محاوره‌ای بنویس:** «میشه ضعیف‌ترین محصولامو نشونم بدی؟»، «آدرسای ناپاک کدوما هستن؟» یا «سلام داداش برو به تب ترافیک» هم فهمیده می‌شود\n- 🧭 **دستورهای اجرایی:** «برو به تب سئو/ترافیک/رشد/تغییرات»، «سایت example.com را بازرسی کن»، «همگام‌سازی کن»\n- 🔍 جستجو در همین گفتگو و در گفتگوهای قبلی، ☆ نشان‌دار کردن پیام‌های مهم، و ذخیرهٔ گفتگو به‌صورت فایل از دکمه‌های بالای چت\n- ⚡ **اجرای مستقیم:** «سئو را خودکار اجرا کن»، «محصولات را بررسی کن»، «محصولات را خودکار ترمیم کن»\n- 🧭 «قدم بعدی چیست؟» و «وضعیت محصولات / سئوی خودکار» از روی داده‌های واقعی\n- ✅ پیشنهاد اصلاح روی محتوای واقعی وردپرس و اعمال انتخابی فقط پس از تأیید تو (با فعال‌سازی دسترسی در افزونه)\n- 📈 ترافیک، منابع، روند و ورودی از دستیارهای AI\n- 📘 توضیح اصطلاحات (GEO، AEO، canonical، Core Web Vitals …)\n- ❓ ساخت بخش **سؤالات متداول** و **ساختار مقاله** برای هر موضوع\n- ✅ چک‌لیست انتشار مقاله، راه‌اندازی سایت و آمادگی AI\n- 🧭 «چرا ترافیک افت کرد؟»، «سریع‌ترین کارها»، «چطور رفعش کنم؟» و «اگر رفع کنم چند امتیاز؟»\n- 🛡️ قواعد .htaccess/Nginx و فایروال برای رباتان\n- 📄 گزارش قابل ارسال برای مشتری یا مدیر\n- 🔁 بعد از برنامه بنویس «مورد ۲ را توضیح بده»\n\nبرای نتیجهٔ بهتر اول سایت را در تب رادار بازرسی کن و افزونه را وصل کن.', chips: ['گزارش کلی بده', 'برنامهٔ اقدام بده', 'اصلاحات خودکار', 'GEO چیست؟'] };
  }
  function aFallback(ctx, t) {
    const g = aGloss(t); if (g) return g;
    const dym = didYouMean(t, 3);
    if (dym.length) return { text: 'دقیق متوجه نشدم؛ شاید منظورت یکی از این‌ها بود؟ یکی را بزن یا جمله‌ات را دقیق‌تر بنویس. (اگر دربارهٔ صفحهٔ مشخصی می‌پرسی، مسیرش را بنویس، مثلاً `/about`.)', chips: dym.concat(['دستیار چه کارهایی بلد است؟']).slice(0, 4) };
    return { text: 'دقیق متوجه نشدم. می‌توانم دربارهٔ این‌ها کمک کنم: گزارش کلی، برنامهٔ اقدام، مشکلات سئو، رباتان AI، ساخت robots.txt / llms.txt / اسکیما، عنوان و متا، ترافیک و منابع، یا معنی اصطلاحات. اگر دربارهٔ صفحهٔ مشخصی می‌پرسی، مسیرش را بنویس (مثلاً `/about`).', chips: ['گزارش کلی بده', 'برنامهٔ اقدام بده', 'رباتان AI من را می‌بینند؟', 'دستیار چه کارهایی بلد است؟'] };
  }

  function findPage(ctx, raw) {
    const r = ctx.report; if (!r) return null; const m = raw.match(/(?:https?:\/\/[^\s]+|\/[A-Za-z0-9؀-ۿ%_\-./]+)/g) || []; const t = norm(raw);
    for (const tok of m) { let x = tok; try { x = decodeURIComponent(tok); } catch (e) {} const path = x.replace(/^https?:\/\/[^/]+/, '').split('?')[0]; const hit = r.pages.find((p) => pathOf(p.url).split('?')[0] === path || pathOf(p.url).split('?')[0].replace(/\/$/, '') === path.replace(/\/$/, '')); if (hit && path !== '/') return hit; }
    return r.pages.find((p) => { const w = slugWords(p.url); return w.length >= 5 && t.includes(norm(w)); }) || null;
  }

  /* ---------- v2: extra knowledge ---------- */
  GLOSS.push(
    [['core web vitals', 'cwv', 'lcp', 'cls', 'inp'], '**Core Web Vitals** سه معیار سرعت و پایداری تجربهٔ کاربر است: **LCP** (سرعت نمایش بزرگ‌ترین بخش، زیر ۲٫۵ ثانیه)، **INP** (پاسخ‌دهی به کلیک، زیر ۲۰۰ میلی‌ثانیه) و **CLS** (پرش چیدمان، زیر ۰٫۱). در PageSpeed Insights و Search Console می‌بینی‌شان؛ من آن‌ها را اندازه نمی‌گیرم.'],
    [['بک لینک', 'backlink', 'لینک سازی'], '**بک‌لینک** لینکی از سایت دیگر به توست و یکی از سیگنال‌های اعتبار است. کیفیت و ارتباط موضوعی مهم‌تر از تعداد است؛ خرید انبوه لینک خطرناک است.'],
    [['anchor', 'انکر', 'متن لینک'], '**انکر تکست** متن قابل‌کلیک لینک است. توصیفی و مرتبط بنویس («راهنمای سئو») نه «اینجا کلیک کنید».'],
    [['hreflang'], '**hreflang** به موتور جستجو می‌گوید نسخهٔ زبانی/منطقه‌ای دیگر همین صفحه کجاست، تا کاربر نسخهٔ درست را ببیند. فقط برای سایت چندزبانه لازم است.'],
    [['breadcrumb', 'خرده نان', 'مسیر راهنما'], '**Breadcrumb** (ناوبری مسیر) مثل «خانه › وبلاگ › مقاله» ساختار سایت را روشن می‌کند و با اسکیمای BreadcrumbList در نتایج گوگل نشان داده می‌شود.'],
    [['301', 'ریدایرکت', 'redirect', 'تغییر مسیر'], '**ریدایرکت ۳۰۱** یعنی «این صفحه برای همیشه به آدرس دیگری رفته». اعتبار لینک‌ها را منتقل می‌کند. برای موقت از ۳۰۲ استفاده کن. زنجیرهٔ ریدایرکت (چند مرحله) را کوتاه نگه دار.'],
    [['404', 'صفحه پیدا نشد'], '**خطای ۴۰۴** یعنی صفحه وجود ندارد. برای صفحهٔ حذف‌شده‌ای که جایگزین دارد ۳۰۱ بده؛ برای واقعاً حذف‌شده‌ها ۴۰۴ یا ۴۱۰ طبیعی است ولی لینک داخلی به آن‌ها نباید بماند.'],
    [['crawl budget', 'بودجه خزش', 'بودجه خزیدن'], '**بودجهٔ خزش** تعداد صفحاتی است که گوگل در هر بازه از سایتت می‌خزد. روی سایت‌های کوچک مسئله نیست؛ روی سایت‌های بزرگ با صفحات تکراری و پارامتری مهم می‌شود.'],
    [['ایندکس', 'index', 'نمایه'], '**ایندکس** یعنی گوگل صفحه را در پایگاهش ذخیره کرده و می‌تواند نشانش دهد. وضعیتش را در Search Console ← Pages ببین؛ «خزیده شد ولی ایندکس نشد» معمولاً یعنی کیفیت یا تکراری‌بودن.'],
    [['serp'], '**SERP** صفحهٔ نتایج موتور جستجوست؛ شامل نتایج معمولی، ریچ‌ریزالت، تصاویر و پاسخ‌های AI.'],
    [['ctr', 'نرخ کلیک'], '**CTR** نسبت کلیک به نمایش در نتایج است. عنوان و متای جذاب‌تر بدون تغییر رتبه می‌تواند آن را بالا ببرد.'],
    [['bounce', 'نرخ پرش'], '**نرخ پرش** درصد بازدیدکنندگانی است که بدون تعامل بیشتر خارج می‌شوند. به‌تنهایی «بد» نیست؛ برای صفحهٔ پاسخ سریع طبیعی است.'],
    [['cdn', 'سی دی ان'], '**CDN** شبکهٔ توزیع محتواست که نسخهٔ سایت را نزدیک کاربر نگه می‌دارد و سرعت می‌دهد. توجه: قوانین فایروال آن می‌تواند رباتان AI را بدون خبر شما رد کند.'],
    [['lazy', 'تنبل', 'بارگذاری تنبل'], '**Lazy load** یعنی تصاویر پایین صفحه فقط وقتی لازم شوند بارگیری شوند. تصویر اول صفحه (LCP) را lazy نکن.'],
    [['open graph', 'og:'], '**Open Graph** برچسب‌هایی است که تعیین می‌کند لینک در تلگرام، واتساپ و شبکه‌ها با چه عنوان و تصویری نمایش داده شود.'],
    [['ttfb'], '**TTFB** زمان رسیدن اولین بایت پاسخ از سرور است. بالا بودنش معمولاً یعنی هاست کند، کش‌نکردن یا کوئری سنگین.'],
    [['nofollow', 'ugc', 'sponsored'], '**nofollow/sponsored/ugc** برچسب‌های rel لینک‌اند: به موتور می‌گویند این لینک را تأیید نمی‌کنم (تبلیغی، کامنت کاربران). لینک‌های تبلیغی را sponsored کن.'],
    [['duplicate', 'محتوای تکراری', 'تکراری'], '**محتوای تکراری** یعنی چند آدرس متن یکسان دارند. با canonical، ریدایرکت یا ادغام صفحات حل می‌شود تا اعتبار تقسیم نشود.'],
    [['rag', 'retrieval'], '**RAG** روشی است که دستیار AI هنگام پاسخ، ابتدا صفحات مرتبط را از وب می‌خواند و بعد جواب می‌سازد. به همین دلیل ربات‌های «جستجو» و «درخواست کاربر» برای دیده‌شدن مهم‌اند، نه ربات‌های آموزش.'],
    [['ai overview', 'ای آی اورویو', 'خلاصه گوگل'], '**AI Overviews** خلاصهٔ تولیدشدهٔ گوگل بالای نتایج است. برای حضور در آن: پاسخ مستقیم و دقیق، ساختار روشن، E-E-A-T و دسترسی Googlebot (نه ربات جداگانه).'],
  );
  Object.assign(INTENTS, {
    faq: ['سوالات متداول', 'سوال و جواب', 'پرسش و پاسخ', 'بخش faq', 'faq بساز', 'سوال جواب'],
    outline: ['ساختار مقاله', 'رئوس مطالب', 'اوتلاین', 'outline', 'طرح مقاله', 'سرفصل', 'ایده محتوا', 'ایده مقاله', 'برنامه محتوا', 'چی بنویسم', 'مقاله بنویسم', 'محتوا بنویسم', 'تقویم محتوا'],
    checklist: ['چک لیست', 'چکلیست', 'checklist', 'فهرست بررسی'],
    why: ['چرا ترافیک', 'چرا بازدید', 'دلیل افت', 'علت افت', 'چرا افت', 'چرا کم شد', 'چرا کم شده', 'چرا ریزش', 'ریزش', 'چرا نمیاد', 'چرا کسی نمیاد', 'چرا کسی نمی آید', 'چرا دیده نمیشم', 'چرا رتبه'],
    quick: ['سریع ترین', 'سریعترین', 'کار سریع', 'ساده ترین', 'کم زحمت', 'امروز چه', 'quick win', 'برد سریع', 'کارهای ساده', 'یک ساعته'],
    fixhow: ['چطور رفع', 'چگونه رفع', 'چطوری درست', 'آموزش رفع', 'چطور درست', 'چگونه درست', 'چطور اضافه', 'چگونه اضافه', 'چطور تنظیم', 'چگونه تنظیم', 'چطور بنویسم', 'how to fix'],
    whatif: ['چند امتیاز', 'چقدر امتیاز', 'اگر رفع کنم', 'اگر درست کنم', 'اگر اضافه کنم', 'چقدر بالا میره', 'چقدر بالا می رود'],
    server: ['htaccess', 'nginx', 'انجین', 'کلودفلر', 'cloudflare', 'فایروال', 'waf', 'قانون سرور', 'سطح سرور', 'بلاک در سرور', 'مسدود در سرور'],
    client: ['گزارش مشتری', 'گزارش برای مشتری', 'گزارش قابل ارسال', 'گزارش کامل', 'گزارش رسمی', 'گزارش مدیر', 'گزارش برای مدیر', 'خروجی گزارش'],
  });
  PRIORITY.unshift('autofix', 'client', 'whatif', 'fixhow', 'why', 'faq', 'outline', 'checklist', 'quick', 'server');
  ['faq', 'outline', 'checklist', 'why', 'quick', 'fixhow', 'whatif', 'server', 'client'].forEach((k) => { KW[k] = INTENTS[k].map(norm); });
  const CODEWORDS = [
    ['img_alt', ['alt', 'تصویر', 'عکس']], ['no_canonical', ['canonical', 'کنونیکال']], ['missing_title', ['عنوان', 'تایتل', 'title']], ['missing_desc', ['متا', 'توضیحات', 'description']],
    ['arabic_chars', ['حروف عربی', 'ی و ک عربی', 'ي ك', 'ك و ي']], ['no_trust_pages', ['صفحه تماس', 'صفحات اعتماد', 'درباره ما', 'حریم خصوصی']], ['schema_duplicate', ['اسکیمای تکراری', 'اسکیما تکراری', 'schema تکراری']], ['img_bad_filename', ['نام فایل تصاویر', 'نام تصاویر']], ['no_h1', ['h1', 'تیتر اصلی']], ['multi_h1', ['چند h1', 'h1 تکراری']], ['noindex', ['noindex', 'نو ایندکس']], ['no_schema', ['اسکیما', 'schema', 'json-ld']], ['no_https', ['https', 'ssl', 'گواهی']],
    ['no_sitemap', ['sitemap', 'نقشه سایت']], ['no_viewport', ['viewport', 'موبایل', 'ریسپانسیو']], ['thin', ['کم محتوا', 'محتوای کم', 'محتوا کم', 'thin']], ['no_lang', ['lang', 'زبان صفحه']],
    ['og', ['og', 'open graph', 'اشتراک']], ['aeo_format', ['aeo', 'تیتر پرسشی', 'پرسشی']], ['no_robots', ['robots']], ['no_llms', ['llms']], ['http_error', ['404', '500', 'خطای سرور', 'خرابی']],
  ];
  function codeIn(t) { for (const [c, ws] of CODEWORDS) if (ws.some((w) => t.includes(norm(w)))) return c; return null; }
  const TITLE_OF = { arabic_chars: 'حروف عربی ي/ك', arabic_digits: 'ارقام عربی', no_trust_pages: 'نبود صفحات اعتماد', schema_duplicate: 'اسکیمای تکراری', img_bad_filename: 'نام فایل بی‌معنی تصاویر', title_h1_unrelated: 'ناهم‌خوانی عنوان و H1', no_preconnect: 'نبود preconnect', font_display: 'نبود font-display', img_alt: 'تصاویر بدون alt', no_canonical: 'نبود canonical', missing_title: 'نبود عنوان', missing_desc: 'نبود توضیحات متا', no_h1: 'نبود H1', multi_h1: 'چند H1', noindex: 'noindex', no_schema: 'نبود داده ساختاریافته', no_https: 'نبود HTTPS', no_sitemap: 'نبود نقشهٔ سایت', no_viewport: 'نبود viewport', thin: 'محتوای کم', no_lang: 'نبود lang', og: 'برچسب‌های اشتراک‌گذاری', aeo_format: 'قالب پاسخ‌محور', no_robots: 'نبود robots.txt', no_llms: 'نبود llms.txt', http_error: 'خطای HTTP' };
  const ALIASES = { missing_desc: ['missing_description', 'no_meta_description'], img_alt: ['images_no_alt', 'no_alt'], thin: ['thin_content'] };
  const sameCode = (a, b) => a === b || (ALIASES[a] || []).includes(b) || (ALIASES[b] || []).includes(a);
  function affected(ctx, code) { const r = ctx.report; if (!r) return []; const set = new Set(); [...r.pages.map((p) => [p, p.issues]), ...[[null, r.siteIssues]]].forEach(([p, is]) => is.forEach((i) => { if (sameCode(i.code, code)) set.add(p ? pathOf(p.url) : '(کل سایت)'); })); return [...set]; }

  function topicOf(raw, ctx) {
    let m = raw.match(/[«"“]([^»"”]{3,80})[»"”]/); if (m) return m[1].trim();
    raw = raw.replace(/[ً-ٟ]/g, ''); m = raw.match(/(?:درباره‌?ی?|پیرامون|موضوع|برای)\s+(.{3,70}?)(?:\s+(?:بساز|بنویس|بده|می‌خواهم|میخوام|لازم|را|رو)(?=\s|$)|[.؟?!]|$)/); if (m) { const x = m[1].replace(/^(یک|یه)\s+/, '').trim(); if (x.length >= 3 && !/^(سایت|صفحه|من|ما)\s*$/.test(x)) return x; }
    const r = ctx.report; if (r) { const p = r.pages.filter((q) => q.status < 400).sort((a, b) => a.facts.words - b.facts.words)[0]; if (p) return slugWords(p.url) || p.facts.title; }
    return null;
  }

  function aFaq(ctx, raw) {
    const topic = topicOf(raw, ctx); const brand = (ctx.brief && ctx.brief.site && ctx.brief.site.name) || (ctx.report && ctx.report.site) || 'سایت شما';
    if (!topic) return { text: 'بگو دربارهٔ چه موضوعی؟ مثلاً: «سؤالات متداول دربارهٔ خرید کفش ورزشی بساز».', chips: ['سؤالات متداول دربارهٔ «ارسال سفارش» بساز'] };
    const Q = [['«' + topic + '» دقیقاً چیست؟', 'در ۲–۳ جمله تعریف روشن و بدون اصطلاح پیچیده بنویس.'], ['چه کسانی به ' + topic + ' نیاز دارند؟', 'مخاطب اصلی و موقعیت‌های رایج را نام ببر.'], ['قیمت یا هزینهٔ ' + topic + ' چقدر است؟', 'بازهٔ واقعی یا عوامل مؤثر بر قیمت را بگو؛ طفره نرو.'], ['چطور ' + topic + ' را انتخاب کنم؟', 'سه معیار مشخص بده (مثلاً کیفیت، ضمانت، پشتیبانی).'], ['چه اشتباهاتی در ' + topic + ' رایج است؟', 'دو یا سه اشتباه واقعی که از تجربه دیده‌ای.'], ['' + brand + ' چه تفاوتی دارد؟', 'یک مزیت قابل‌اثبات (ضمانت، سابقه، روش کار).'], ['چطور با ' + brand + ' تماس بگیرم؟', 'راه‌های تماس و ساعات پاسخ‌گویی.']];
    const body = Q.map(([q, a], i) => '### ' + q + '\n' + a).join('\n\n');
    const schema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: Q.map(([q]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: 'پاسخ کوتاه و دقیق خودت را اینجا بنویس.' } })) };
    return { text: '**بخش سؤالات متداول دربارهٔ «' + topic + '»** — قالب آمادهٔ صفحه (جواب‌ها را خودت بنویس؛ پاسخ ۲ تا ۳ جمله‌ای که مستقیم جواب بدهد در AI بیشتر نقل می‌شود):\n\n```\n' + body + '\n```\n\nاسکیمای متناظر (بعد از نوشتن جواب‌ها متن `text` را همان جواب‌ها بگذار):\n\n```\n<script type="application/ld+json">\n' + JSON.stringify(schema, null, 2) + '\n</script>\n```\nقانون: اسکیمای FAQ فقط وقتی معتبر است که همین سؤال‌وجواب‌ها در متن صفحه هم دیده شوند.', chips: ['اسکیما بساز', 'چک‌لیست انتشار مقاله', 'ساختار مقاله بده'] };
  }
  function aOutline(ctx, raw) {
    const topic = topicOf(raw, ctx); if (!topic) return { text: 'بگو دربارهٔ چه موضوعی؟ مثلاً: «ساختار مقاله دربارهٔ سئو سایت فروشگاهی».', chips: ['ساختار مقاله دربارهٔ «سئو برای مبتدی‌ها»'] };
    const brand = (ctx.brief && ctx.brief.site && ctx.brief.site.name) || (ctx.report && ctx.report.site) || 'سایت شما';
    const out = ['**ساختار پیشنهادی مقاله: «' + topic + '»**', '', '```', 'عنوان (H1): ' + cut(topic + ' — راهنمای کامل و کاربردی', 60), 'متا (۱۲۰–۱۶۰): ' + cut(topic + ' را گام‌به‌گام یاد بگیر: تعریف، مراحل، اشتباهات رایج و نکات کاربردی از تجربهٔ ' + brand + '.', 155), '', 'مقدمه: مشکل خواننده + قولی که مقاله می‌دهد (۳ جمله)', 'پاسخ کوتاه: جواب اصلی در ۲–۳ جمله (برای نقل در AI و Featured Snippet)', '', '## ' + topic + ' چیست؟', '## چرا ' + topic + ' مهم است؟', '## مراحل انجام ' + topic + ' (فهرست شماره‌دار)', '## اشتباهات رایج در ' + topic, '## مثال یا نمونهٔ واقعی', '## سؤالات متداول (۳ تا ۵ سؤال، پاسخ کوتاه)', '## جمع‌بندی و گام بعدی (CTA)', '```', '', '**نکات اجرایی:**', '- طول: حداقل ۸۰۰–۱۲۰۰ واژه؛ فقط اگر موضوع نیاز دارد، نه برای پرکردن.', '- تصاویر با alt توصیفی؛ حداقل یک جدول یا فهرست.', '- نویسنده، تاریخ به‌روزرسانی و منبع را نشان بده (E-E-A-T).', '- لینک داخلی به ۲–۳ صفحهٔ مرتبط سایت؛ اسکیمای Article و FAQPage.'];
    const r = ctx.report; if (r) { const rel = r.pages.filter((p) => p.status < 400 && pathOf(p.url) !== '/').slice(0, 3); if (rel.length) out.push('- صفحات پیشنهادی برای لینک‌دهی: ' + rel.map((p) => '`' + pathOf(p.url) + '`').join('، ')); }
    out.push('', 'متن خود مقاله را باید خودت بنویسی؛ من فقط اسکلت و قواعد را می‌دهم.');
    return { text: out.join('\n'), chips: ['سؤالات متداول دربارهٔ «' + topic + '» بساز', 'چک‌لیست انتشار مقاله', 'اسکیما مقاله بساز'] };
  }
  const CHECK = {
    publish: ['**چک‌لیست انتشار مقاله**', ['موضوع یک نیت جستجوی مشخص دارد (اطلاعاتی/خرید/مقایسه)', 'H1 یکتا و ۳۰–۶۰ نویسه با عبارت اصلی', 'توضیحات متا ۱۲۰–۱۶۰ نویسه با دعوت به اقدام', 'پاسخ مستقیم ۲–۳ جمله‌ای در ابتدا', 'H2های روشن، حداقل یکی پرسشی', 'تصاویر با alt توصیفی و حجم بهینه', '۲–۳ لینک داخلی و ۱ لینک خروجی معتبر', 'نویسنده، تاریخ انتشار و به‌روزرسانی', 'اسکیمای Article (و FAQPage اگر FAQ دارد)', 'canonical درست و بدون noindex', 'ثبت در نقشهٔ سایت و درخواست ایندکس در Search Console', 'نمایش درست روی موبایل']],
    launch: ['**چک‌لیست راه‌اندازی/انتقال سایت**', ['HTTPS فعال و ریدایرکت ۳۰۱ از http', 'در وردپرس: «از موتورهای جستجو بخواه این سایت را نمایه نکنند» خاموش باشد', 'robots.txt مسدودکنندهٔ کل سایت نباشد (Disallow: /)', 'نقشهٔ سایت ساخته و در Search Console ثبت شده', 'هر صفحه عنوان و متای یکتا دارد', 'ریدایرکت ۳۰۱ برای همهٔ آدرس‌های قدیمی (در انتقال)', 'canonical درست، بدون noindex اشتباه', 'صفحات ۴۰۴ سفارشی و بدون لینک خراب داخلی', 'سرعت موبایل در PageSpeed بررسی شده', 'اسکیمای Organization/WebSite در صفحهٔ اصلی', 'Search Console و آنالیتیکس نصب است', 'خزنده‌های AI مطابق سیاست تو در robots.txt تنظیم شده‌اند']],
    woo: ['**چک‌لیست سئوی فروشگاه ووکامرس (سطح متخصص)**', ['هر محصول: عنوان یکتا (نه توضیح تأمین‌کننده)، توضیح اختصاصی ≥ ۱۵۰ کلمه برای پرفروش‌ها، ۳+ تصویر با alt و WebP', 'اسکیمای Product + Offer کامل و منطبق با قیمت/موجودی صفحه (فقط یک افزونه تولیدکنندهٔ اسکیما)', 'دسته‌ها: توضیح اختصاصی بالای محصولات، عنوان/متا یکتا، لینک به زیردسته‌ها', 'فیلترها و `orderby` را مدیریت کن: canonical/noindex و disallow برای پارامترهای بی‌ارزش', 'وارییشن‌ها canonical به محصول اصلی؛ محصول ناموجود دائمی: ۳۰۱ به جایگزین یا ۴۱۰، نه حذف بی‌نشان', 'صفحات سبد، تسویه‌حساب و حساب کاربری: noindex و بیرون از sitemap', 'نظرات واقعی کاربران فعال + اسکیمای Review (فقط نظرات واقعی)', 'سرعت: کش صفحه، تصاویر بهینه، اسکریپت‌های اضافی افزونه‌ها را در صفحات غیرمرتبط خاموش کن (INP/LCP)', 'لینک داخلی: «محصولات مرتبط» و مقالهٔ راهنمای خرید → دستهٔ هدف', 'Google Merchant Center فید رایگان (merchant listings) در صورت پشتیبانی کشور هدف']],
    technical: ['**چک‌لیست ممیزی فنی سئو**', ['نمایه‌پذیری: robots.txt، meta robots و HTTP header هیچ صفحهٔ مهمی را مسدود نکرده (وردپرس: «از موتورهای جستجو بخواه…» خاموش)', 'Sitemap تمیز (فقط ۲۰۰ و canonical) و ثبت‌شده در Search Console', 'ساختار URL و canonical: یک نسخهٔ https/www، بدون ترکیب پارامتر', 'کدهای وضعیت: بدون زنجیرهٔ ریدایرکت، ۴۰۴ مهم‌ها اصلاح، بدون soft 404', 'Core Web Vitals: LCP ≤ ۲٫۵s، INP ≤ ۲۰۰ms، CLS ≤ ۰٫۱ (داده میدانی)', 'موبایل: viewport، متن خوانا، دکمه‌های قابل‌لمس؛ محتوای موبایل = دسکتاپ (mobile-first)', 'عمق کلیک ≤ ۳–۴ برای صفحات مهم؛ بدون صفحهٔ یتیم', 'هدینگ‌ها: یک H1، سلسله‌مراتب منطقی؛ تصاویر alt و ابعاد', 'داده ساختاریافته معتبر (Rich Results Test) بدون خطا', 'امنیت: https کامل، بدون mixed content، HSTS، به‌روزرسانی هسته/افزونه‌ها', 'لاگ سرور/Crawl stats: خطای ۵xx و زمان پاسخ را پایش کن']],
    content: ['**چک‌لیست استراتژی محتوا و اقتدار موضوعی**', ['۵–۸ موضوع اصلی کسب‌وکار را مشخص کن و برای هرکدام یک صفحهٔ ستون بساز', 'برای هر موضوع ۸–۲۰ پرسش واقعی مخاطب را فهرست کن (Search Console، پشتیبانی، رقبا)', 'هر پرسش = یک مقالهٔ مجزا با نیت مشخص؛ از دو صفحه برای یک عبارت پرهیز (cannibalization)', 'قالب پاسخ‌محور: تیتر پرسشی + پاسخ ۲–۳ جمله‌ای + جزئیات + مثال/داده یکتا', 'E-E-A-T: نام و سابقهٔ نویسنده، منبع‌دهی، تاریخ بازبینی، تجربهٔ دست‌اول', 'لینک داخلی دوطرفه بین ستون و مقالات؛ انکر توصیفی', 'هر ۶ ماه محتوای پرنمایش را بازبینی و به‌روز کن (refresh) به‌جای نوشتن همیشه جدید', 'پیگیری ماهانه: نمایش، CTR، رتبه، تبدیل برای هر خوشه']],
    geo: ['**چک‌لیست آمادگی برای دیده‌شدن در AI (GEO/AEO)**', ['خزنده‌های جستجوی AI (OAI-SearchBot، PerplexityBot، Claude-SearchBot) در robots.txt مسدود نیستند', 'فایروال/CDN رباتان معتبر را رد نمی‌کند (کد ۴۰۳/۴۲۹ در لاگ نیست)', 'محتوای اصلی در HTML اولیه است نه فقط با جاوااسکریپت', 'پاسخ مستقیم کوتاه زیر هر تیتر پرسشی', 'بخش FAQ واقعی با اسکیمای FAQPage', 'داده ساختاریافتهٔ Organization و Article', 'نام نویسنده، تخصص و منبع هر ادعا', 'تاریخ به‌روزرسانی روشن', 'فایل llms.txt (اختیاری)', 'نام برند در سایت‌ها و پروفایل‌های معتبر یکسان است', 'ورودی از دستیارهای AI را در ترافیک رصد می‌کنی']],
  };
  function aChecklist(ctx, t) {
    const k = /(راه اندازی|لانچ|انتقال|سایت جدید|launch|مهاجرت)/.test(t) ? 'launch' : /(ووکامرس|فروشگاه|محصول|woo)/.test(t) ? 'woo' : /(فنی|تکنیکال|technical|ممیزی|audit)/.test(t) ? 'technical' : /(استراتژی محتوا|اقتدار|خوشه|content strategy|موضوعی)/.test(t) ? 'content' : /(ai|geo|aeo|هوش مصنوعی|چت جی|دستیار)/.test(t) ? 'geo' : 'publish'; const c = CHECK[k];
    const out = [c[0], '', ...c[1].map((x) => '- [ ] ' + x)];
    if (ctx.report && k === 'launch') { const bad = affected(ctx, 'noindex'); if (bad.length) out.push('', '⚠️ در بازرسی اخیر ' + bad.length + ' صفحه noindex دارد: ' + bad.slice(0, 3).map((x) => '`' + x + '`').join('، ')); }
    return { text: out.join('\n'), chips: ['چک‌لیست ووکامرس', 'چک‌لیست ممیزی فنی', 'چک‌لیست استراتژی محتوا', 'چک‌لیست آمادگی AI'] };
  }
  function aWhy(ctx) {
    if (!ctx.report && !ctx.log && !ctx.brief) return needReport();
    const items = planItems(ctx).filter((i) => ['wp_discourage', 'noindex', 'http_error', 'ai_search_blocked', 'bot_rejected', 'drop', 'one_channel', 'ai_no_refs', 'cache_note', 'no_https', 'no_sitemap', 'no_robots'].includes(i.id));
    const tf = trafficFacts(ctx.log); const out = ['**چرا ترافیک/دیده‌شدن پایین است؟** — فقط بر پایهٔ داده‌ای که دارم:', ''];
    if (tf && tf.trend && tf.trend.change !== null) out.push('- روند بازدید انسانی: ' + tf.trend.before + ' ← ' + tf.trend.after + ' (' + (tf.trend.change > 0 ? '+' : '') + tf.trend.change + '٪)'); if (tf && tf.trend && tf.trend.change > 0) out.push('  (طبق این داده ترافیک افت نکرده و رو به رشد است؛ اگر افت را در جای دیگری می‌بینی، مثلاً Search Console، منبعش متفاوت است.)');
    if (items.length) { out.push('', '**علت‌های محتمل به‌ترتیب قوت:**'); items.slice(0, 5).forEach((i, k) => out.push((k + 1) + '. ' + SEVF[i.sev] + ' **' + i.title + '** — ' + i.why)); }
    else out.push('', 'در داده‌های فعلی مانع فنی آشکاری نمی‌بینم. پس علت احتمالاً بیرون از دید من است:');
    out.push('', '**چیزهایی که من نمی‌بینم و باید دستی بررسی کنی:**', '- Search Console ← Performance: افت نمایش (impression) یا افت رتبهٔ صفحات مشخص؟', '- Search Console ← Manual actions و Security issues', '- تغییر اخیر قالب، افزونه، آدرس‌ها یا ریدایرکت‌ها (زمانش را با زمان افت تطبیق بده)', '- به‌روزرسانی الگوریتم گوگل در همان بازه', '- رقبایی که محتوای بهتر یا تازه‌تری منتشر کرده‌اند', '', 'نتیجه قطعی نیست؛ این فهرست فرضیه‌های مرتب‌شده است نه حکم.');
    return { text: out.join('\n'), chips: ['برنامهٔ اقدام بده', 'روند ترافیک چطور است؟', 'سریع‌ترین کارها چیست؟'] };
  }
  function aQuick(ctx) {
    if (!ctx.report && !ctx.log && !ctx.brief) return needReport(); const q = planItems(ctx).filter((i) => i.effort <= 2).sort((a, b) => b.impact - a.impact || a.effort - b.effort).slice(0, 5);
    if (!q.length) return { text: 'کار سریع و پراثری پیدا نکردم؛ موارد باقی‌مانده زحمت بیشتری دارند.', chips: ['برنامهٔ اقدام بده'] };
    const out = ['**سریع‌ترین بردها** (اثر بالا، زحمت کم):', '']; q.forEach((i, k) => out.push((k + 1) + '. ' + SEVF[i.sev] + ' **' + i.title + '**', '   - چطور: ' + i.how));
    return { text: out.join('\n'), chips: ['برنامهٔ اقدام بده', 'robots.txt بساز', 'اسکیما بساز'] };
  }
  function aFixHow(ctx, t) {
    const c = codeIn(t); if (!c || !HOW[c]) return null; const pages = affected(ctx, c); const out = ['**' + (TITLE_OF[c] || c) + ' — چطور رفعش کنم؟**', '', '- چرا مهم است: ' + (WHY[c] || '—'), '- راه‌حل: ' + HOW[c](ctx)];
    if (ctx.report) out.push(pages.length ? '- در سایت تو: ' + pages.length + ' مورد، از جمله ' + pages.slice(0, 4).map((x) => '`' + x + '`').join('، ') : '- در بازرسی اخیر این مشکل پیدا نشد. ✅');
    const wp = ctx.brief && ctx.brief.site; if (wp) { const extra = { img_alt: 'در وردپرس: کتابخانهٔ رسانه ← تصویر ← «متن جایگزین».', no_https: 'در وردپرس: تنظیمات ← همگانی، هر دو آدرس را https کن و یک افزونهٔ ریدایرکت یا قاعدهٔ سرور بگذار.', noindex: 'در وردپرس: تنظیمات ← خواندن ← تیک «از موتورهای جستجو بخواه...» باید خاموش باشد.', no_sitemap: 'وردپرس هسته‌ای /wp-sitemap.xml دارد؛ در Search Console ثبتش کن.' }[c]; if (extra) out.push('- ' + extra); }
    return { text: out.join('\n'), chips: ['برنامهٔ اقدام بده', 'اگر ' + (TITLE_OF[c] || '') + ' را رفع کنم چند امتیاز می‌گیرم؟', 'سریع‌ترین کارها چیست؟'] };
  }
  function aWhatIf(ctx, t) {
    const r = ctx.report; if (!r) return needReport(); const c = codeIn(t); if (!c) return aScore(ctx);
    const present = [...new Set([...r.pages.flatMap((p) => p.issues), ...r.siteIssues].map((i) => i.code))].find((x) => sameCode(x, c));
    if (!present) return { text: 'این مشکل در بازرسی اخیر پیدا نشد؛ پس رفعش امتیازی اضافه نمی‌کند. ✅', chips: ['امتیاز سئو چرا این قدر است؟'] };
    const d = scoreWithout(r, present) - r.scores.seo; return { text: 'اگر «' + (TITLE_OF[c] || present) + '» را در همهٔ صفحات رفع کنی، امتیاز سئو از **' + r.scores.seo + '** به حدود **' + (r.scores.seo + d) + '** می‌رسد (**+' + d + '**).\n\nاین محاسبهٔ دقیق روی همین بازرسی است؛ بازرسی تازه ممکن است مورد دیگری پیدا کند.', chips: ['برنامهٔ اقدام بده', 'سریع‌ترین کارها چیست؟'] };
  }
  function aServer(ctx) {
    const pol = ctx.report ? policy(ctx.report) : null; const train = SI.AI_BOTS.filter((b) => b.purpose === 'training'); const ua = train.map((b) => b.id).join('|');
    const out = ['**کنترل رباتان AI در سطح سرور** (robots.txt داوطلبانه است؛ این قواعد اجباری‌اند و فقط برای رباتی که UA راست می‌فرستد کار می‌کنند):', '', '**Apache (.htaccess) — مسدودکردن ربات‌های آموزش مدل:**', '```', 'RewriteEngine On', 'RewriteCond %{HTTP_USER_AGENT} (' + ua + ') [NC]', 'RewriteRule .* - [F,L]', '```', '', '**Nginx — داخل بلاک server:**', '```', 'if ($http_user_agent ~* "(' + ua + ')") { return 403; }', '```', '', '**اگر رباتان جستجوی AI رد می‌شوند (۴۰۳/۴۲۹)** علت معمولاً فایروال است نه robots.txt:', '- در Cloudflare/ArvanCloud/فایروال هاست، قوانین «Bot Fight»، «Under Attack» و Rate Limit را بررسی کن و ربات‌های معتبر را مجاز کن.', '- در افزونه‌های امنیتی وردپرس (Wordfence و مشابه) فهرست مسدودی UA و محدودیت نرخ را ببین.', '- لاگ فایروال را با زمان درخواست‌های ردشده تطبیق بده.'];
    if (pol && pol.searchBlocked.length) out.push('', '⚠️ در robots.txt تو جستجوی AI مسدود است؛ اول آن را درست کن، سپس سرور را.');
    out.push('', 'هشدار: قاعدهٔ اشتباه می‌تواند کاربران یا گوگل را هم ببندد. قبل از اعمال روی سایت زنده تست کن و نسخهٔ پشتیبان بگیر.');
    return { text: out.join('\n'), chips: ['robots.txt بساز', 'رباتان AI من را می‌بینند؟', 'برنامهٔ اقدام بده'] };
  }
  function aClient(ctx) {
    const r = ctx.report, l = ctx.log; if (!r && !l) return needReport(); const out = []; const items = planItems(ctx); const day = new Date().toISOString().slice(0, 10);
    out.push('# گزارش وضعیت سئو و دیده‌شدن در AI' + (r ? ' — ' + r.site : ''), 'تاریخ: ' + day, '');
    if (r) { out.push('## خلاصه', '- امتیاز سئو: ' + r.scores.seo + ' از ۱۰۰ (' + verdict(r.scores.seo) + ')', '- آمادگی برای AI: ' + r.scores.ai + ' از ۱۰۰ (' + verdict(r.scores.ai) + ')', '- صفحات بررسی‌شده: ' + r.pages.length + '، سالم: ' + r.scores.ok + '٪', '- یافته‌ها: ' + r.counts.critical + ' بحرانی، ' + r.counts.high + ' مهم، ' + r.counts.medium + ' متوسط، ' + r.counts.low + ' کم', ''); const pol = policy(r); out.push('## خزنده‌های AI', '- جستجوی AI: ' + (pol.searchBlocked.length ? 'مسدود (' + pol.searchBlocked.join('، ') + ')' : 'باز'), '- آموزش مدل: ' + (pol.trainBlocked.length ? pol.trainBlocked.length + ' ربات مسدود' : 'باز'), ''); }
    const tf = trafficFacts(l); if (tf) out.push('## ترافیک', '- بازدید انسانی: ' + tf.human, '- درخواست رباتان AI: ' + tf.aiHits + (tf.rejectRate ? ' (' + tf.rejectRate + '٪ ردشده)' : ''), '- ورودی از دستیارهای AI: ' + tf.aiRefs, tf.top ? '- بیشترین منبع: ' + CH[tf.top.type] + ' (' + tf.top.share + '٪)' : '', tf.trend && tf.trend.change !== null ? '- روند: ' + (tf.trend.change > 0 ? '+' : '') + tf.trend.change + '٪' : '', '');
    if (items.length) { out.push('## اقدام‌های پیشنهادی (به‌ترتیب اولویت)'); items.slice(0, 8).forEach((i, k) => out.push((k + 1) + '. ' + i.title + ' — ' + i.how + ' (حدود ' + i.horizon + ' روز)')); out.push(''); }
    out.push('## محدودیت‌ها', '- تحلیل خودکار و بر پایهٔ نمونهٔ صفحات بازرسی‌شده است.', '- شناسایی رباتان بر پایهٔ User-Agent است و قابل جعل است؛ کش ممکن است بخشی از بازدیدها را پنهان کند.', '- کلمات کلیدی دقیق و رتبه‌ها فقط از Search Console به‌دست می‌آیند.');
    return { text: '**گزارش قابل ارسال** (با دکمهٔ کپی بردار و در سند خودت بچسبان):\n\n```\n' + out.filter((x) => x !== undefined).join('\n') + '\n```', chips: ['برنامهٔ اقدام بده', 'سریع‌ترین کارها چیست؟'] };
  }
  function aItem(ctx, n, state) {
    let items = planItems(ctx); if (state.horizon) items = items.filter((i) => i.horizon <= state.horizon); const i = items[n - 1]; if (!i) return null;
    const out = ['**مورد ' + n + ': ' + i.title + '**', '', '- شدت: ' + SEVF[i.sev] + ' · اثر: ' + i.impact + ' از ۵ · زحمت: ' + i.effort + ' از ۵ · حدود ' + i.horizon + ' روز', '- چرا: ' + i.why, '- چطور: ' + i.how]; if (i.urls && i.urls.length) out.push('- صفحات درگیر: ' + i.urls.slice(0, 6).map((u) => '`' + pathOf(u) + '`').join('، ') + (i.urls.length > 6 ? ' و ' + (i.urls.length - 6) + ' مورد دیگر' : ''));
    return { text: out.join('\n'), chips: ['برنامهٔ اقدام بده', 'سریع‌ترین کارها چیست؟'] };
  }
  /* typo tolerance: nearest intent keyword by edit distance */
  function lev(a, b) { if (a === b) return 0; if (Math.abs(a.length - b.length) > 2) return 3; const d = []; for (let i = 0; i <= a.length; i++) d[i] = [i]; for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
  function fuzzy(t) {
    const toks = t.split(' ').filter((x) => x.length >= 4); const vote = {};
    toks.forEach((tk) => PRIORITY.forEach((id) => KW[id].forEach((k) => { if (!k || k.includes(' ') || k.length < 4) return; const dist = lev(tk, k); if (dist <= (k.length >= 7 ? 2 : 1) && dist > 0) vote[id] = (vote[id] || 0) + 3 - dist; })));
    let best = null, bs = 0; Object.keys(vote).forEach((id) => { if (vote[id] > bs) { bs = vote[id]; best = id; } }); return best;
  }

  /** @returns {{text:string, chips:string[], state:object}} */
  function answer(text, ctx, state) {
    ctx = ctx || {}; state = Object.assign({ last: null, more: 0, policy: null, page: null, pending: null }, state || {}); const raw = finglish(String(text || '')); const t = norm(raw);
    const stop = stopIntent(text, state); if (stop) { state.pending = null; return { text: faOut(stop === 'decline' ? 'باشه، چیزی اجرا نمی‌کنم. هر وقت خواستی بگو.' : 'باشه، چیزی اجرا نمی‌کنم و تغییری روی سایت نمی‌دهم. اگر منظورت خاموش‌کردن زمان‌بندی خودکار است: تب **سئو ← بازسازی خودکار سئو** و اگر ترمیم محصولات را می‌خواهی متوقف کنی، در همان لحظه دکمهٔ «توقف» را بزن؛ تغییرات قبلی هم در ژورنال قابل بازگردانی‌اند.'), chips: ['وضعیت سئو خودکار چیست؟', 'قدم بعدی چیست؟'], state }; }
    let id = classify(t); let res; const page = findPage(ctx, raw);
    try {
      if (page && (!id || id === 'seo' || id === 'summary' || id === 'score')) id = 'page';
      if (id === 'more') { const last = state.last || 'help'; state.more = (state.more || 0) + 1; id = last === 'page' ? 'seo' : last; }
      else if (id) { if (id !== state.last) state.more = 0; }
      const more = state.more || 0;
      const im = t.match(/(?:مورد|شماره|اقدام|گام|قدم|ردیف)\s*(\d{1,2})/);
      if (im && state.last === 'plan' && !res) { const ir = aItem(ctx, +im[1], state); if (ir) { res = ir; id = 'plan'; } }
      if (res) { /* handled */ }
      else       if (/عنوان و متای پیشنهادی همین صفحه/.test(raw) && state.page) { const pp = ctx.report && ctx.report.pages.find((x) => x.url === state.page); res = pp ? aTitles(ctx, pp) : aTitles(ctx); id = 'titles'; }
      else switch (id) {
        case 'autofix': res = aFixes(ctx); break;
        case 'greet': res = { text: 'سلام! 👋 من دستیار داخلی بازرس سایت هستم. بدون API هم می‌توانم داده‌های سایتت را تحلیل کنم و برنامهٔ اقدام و فایل آماده بدهم. از کجا شروع کنیم؟', chips: ['گزارش کلی بده', 'برنامهٔ اقدام بده', 'دستیار چه کارهایی بلد است؟'] }; break;
        case 'help': res = aHelp(); break;
        case 'summary': res = aSummary(ctx); break;
        case 'plan': { const h = /(\b7\b|هفت|هفته)/.test(t) ? 7 : /(\b30\b|سی |ماه)/.test(t) ? 30 : /(\b90\b|نود)/.test(t) ? 90 : (more ? state.horizon || 0 : 0); state.horizon = h; res = aPlan(ctx, more, h); break; }
        case 'seo': res = aSeo(ctx, more); break;
        case 'score': res = aScore(ctx); break;
        case 'aibots': res = aAIBots(ctx); break;
        case 'robots': res = aRobots(ctx, state, t); break;
        case 'llms': res = aLlms(ctx); break;
        case 'schema': res = aSchema(ctx, t); break;
        case 'titles': res = aTitles(ctx, page); break;
        case 'traffic': res = aTraffic(ctx, more); break;
        case 'keywords': { res = aKeywords(ctx); if (res.extra) { res.text += res.extra; delete res.extra; } break; }
        case 'airef': res = aAIRef(ctx); break;
        case 'aipages': res = aAIPages(ctx); break;
        case 'wp': res = aWP(ctx); break;
        case 'trend': res = aTrend(ctx); break;
        case 'page': res = page ? aPage(ctx, page) : aFallback(ctx, t); if (page) state.page = page.url; break;
        case 'faq': res = aFaq(ctx, raw); break;
        case 'outline': res = aOutline(ctx, raw); break;
        case 'checklist': res = aChecklist(ctx, t); break;
        case 'why': res = aWhy(ctx); break;
        case 'quick': res = aQuick(ctx); break;
        case 'fixhow': res = aFixHow(ctx, t) || aFallback(ctx, t); break;
        case 'whatif': res = aWhatIf(ctx, t); break;
        case 'server': res = aServer(ctx); break;
        case 'repairstatus': res = aRepair(ctx); break;
        case 'autoseo': res = aAutoSeo(ctx); break;
        case 'next': res = aNext(ctx); break;
        case 'polishstatus': res = aPolishStatus(ctx); break;
        case 'features': res = aFeatures(ctx); break;
        case 'changelog': res = aChangeLog(ctx); break;
        case 'quality': res = aQuality(ctx); break;
        case 'client': res = aClient(ctx); break;
        case 'rules': res = aRules(ctx, t, more); break;
        case 'glossary': res = aGloss(t) || aFallback(ctx, t); break;
        default: res = aFallback(ctx, t);
      }
    } catch (e) { res = { text: 'در تحلیل این بخش خطایی رخ داد (' + (e && e.message || e) + '). یک بار دیگر بازرسی را اجرا کن.', chips: ['دستیار چه کارهایی بلد است؟'] }; id = null; }
    if (id && id !== 'greet') state.last = id;
    { const offered = (res.chips || []).map((c) => actionIntent(c)).find(Boolean); state.pending = offered ? { act: offered, at: Date.now() } : null; }
    return { text: faOut(res.text), chips: (res.chips || []).slice(0, 4), state };
  }


  /* ---------- v1.24: action-aware assistant (status of repair / auto-SEO, next best step, direct commands) ---------- */
  Object.assign(INTENTS, {
    repairstatus: ['وضعیت محصولات', 'محصولات مشکل', 'محصولات ناقص', 'محصولات خراب', 'محصول بدون', 'چند محصول', 'وضعیت ترمیم', 'محصولات بدون سئو', 'محصولات بدون توضیح', 'مقالات مشکل'],
    autoseo: ['وضعیت سئو خودکار', 'سئوی خودکار', 'سئو خودکار', 'اجرای خودکار سئو', 'آخرین اجرای خودکار', 'زمان بندی سئو', 'زمان‌بندی سئو', 'بازسازی خودکار', 'سئو خودکار کار کرد'],
    next: ['قدم بعدی', 'گام بعدی', 'الان چه کنم', 'الان چیکار کنم', 'الان چه کار کنم', 'از کجا شروع', 'اول چه کار', 'اولویت من', 'بعدش چی', 'چه کاری مهم‌تر', 'چه کاری مهم تر'],
  });
  PRIORITY.unshift('repairstatus', 'autoseo', 'next');
  ['repairstatus', 'autoseo', 'next'].forEach((k) => { KW[k] = INTENTS[k].map(norm); });

  /* ---------- v1.32: assistant knows the smart text features (polish, text maker, FAQ, internal links) ---------- */
  Object.assign(INTENTS, {
    polishstatus: ['آخرین اصلاح متن', 'آخرین اصلاح املا', 'نتیجه اصلاح متن', 'گزارش اصلاح متن', 'اصلاح متن چه شد', 'وضعیت اصلاح متن', 'وضعیت املا', 'غلط املایی چند'],
    features: ['قابلیت های هوشمند', 'قابلیت‌های هوشمند', 'امکانات هوشمند', 'تنظیمات هوشمند', 'پیوند داخلی هوشمند', 'پیوندسازی', 'وضعیت پیوند داخلی', 'سازنده متن', 'ساخت خودکار متن', 'متن خودکار محصول', 'پرسش های متداول خودکار', 'ویراستار خودکار', 'خود بازبینی'],
  });
  INTENTS.quality = ['امتیاز کیفیت', 'نمره کیفیت', 'کیفیت متن', 'کیفیت محتوا', 'کیفیت سایت', 'کیفیت متن ها', 'ارزیابی کیفیت', 'ارزیابی متن', 'ارزیابی محتوا', 'نمره متن', 'سلامت متن', 'متن ها چطور', 'وضعیت کیفیت', 'ضعیف ترین متن', 'کم امتیازترین'];
  INTENTS.changelog = ['لاگ تغییرات', 'تاریخچه تغییرات', 'تغییرات امروز', 'تغییرات سایت', 'چه تغییری دادی', 'چه تغییری دادید', 'چه چیزهایی عوض کردی', 'چه کارهایی روی سایت', 'چی عوض کردی', 'چی تغییر دادی', 'آخرین تغییر', 'چه چیزی تغییر کرد', 'صفحه تغییرات', 'گزارش تغییرات', 'چه تغییری', 'تغییری دادی', 'تغییر دادی', 'تغییرات اپ', 'کارهای اپ روی سایت'];
  PRIORITY.unshift('polishstatus', 'features', 'changelog', 'quality');
  ['polishstatus', 'features', 'changelog', 'quality'].forEach((k) => { KW[k] = INTENTS[k].map(norm); });
  const TOG_FEAT = [
    ['links', /(پیوند|لینک)\s?(های\s?)?داخلی/, 'پیوند داخلی هوشمند'],
    ['faq', /((پرسش|سوال|سؤال)\s?(های\s?)?متداول|\bfaq\b)/, 'تکمیل با پرسش‌های متداول'],
    ['write', /(ساخت|سازنده|تولید)\s?(خودکار\s?)?(ی\s)?متن/, 'ساخت خودکار متن'],
    ['polish', /((اصلاح|ویراست|ویرایش)\s?(خودکار\s?)?(متن|املا)|ویراستار)/, 'اصلاح خودکار متن'],
  ];
  /** "پیوند داخلی را خاموش کن" -> 'toggle:links:off'. Only an explicit on/off order about a known feature; questions and negations never match. */
  function toggleIntent(t) {
    if (/(نکن|نکنی|نباید|چطور|چگونه|چرا|چیست|آیا)/.test(t)) return null;
    const on = /(روشن|(?<!غیر)فعال)\s*(کن|بکن|کنی|کنید|بشه|شود|بزن)/.test(t); const off = /(خاموش|غیرفعال)\s*(کن|بکن|کنی|کنید|بشه|شود|بزن)/.test(t);
    if (on === off) return null;
    const f = TOG_FEAT.find((x) => x[1].test(t)); return f ? 'toggle:' + f[0] + ':' + (on ? 'on' : 'off') : null;
  }
  const TOG_LABEL = {}; TOG_FEAT.forEach((x) => { TOG_LABEL[x[0]] = x[2]; });

  /* ---------- v1.30: safer + smarter command understanding ---------- */
  // Finglish (Persian typed in Latin letters) -> Persian, only for text that has no Arabic-script letters at all.
  const FINGLISH = { seo: 'سئو', ejra: 'اجرا', khodkar: 'خودکار', mahsool: 'محصول', mahsoolat: 'محصولات', tarmim: 'ترمیم', barresi: 'بررسی', check: 'بررسی', scan: 'بررسی', kon: 'کن', bokon: 'بکن', konid: 'کنید', bede: 'بده', bedeh: 'بده', bezan: 'بزن', beza: 'بزن', ra: 'را', ro: 'را', hamin: 'همین', alan: 'الان', chetor: 'چطور', chetori: 'چطوری', chera: 'چرا', chist: 'چیست', gozaresh: 'گزارش', koli: 'کلی', barname: 'برنامه', eqdam: 'اقدام', moshkel: 'مشکل', moshkelat: 'مشکلات', nakon: 'نکن', nakonid: 'نکنید', na: 'نه', are: 'آره', ara: 'آره', bale: 'بله', baashe: 'باشه', bashe: 'باشه', ok: 'باشه', okay: 'باشه', yes: 'آره', no: 'نه', vaziat: 'وضعیت', ghadam: 'قدم', badi: 'بعدی', khamoosh: 'خاموش', motevaghef: 'متوقف', bazsazi: 'بازسازی', traffic: 'ترافیک', robot: 'ربات', robots: 'robots' };
  function finglish(raw) {
    const t = String(raw || ''); if (/[\u0600-\u06FF]/.test(t) || !/[a-z]/i.test(t)) return t;
    return t.replace(/[A-Za-z]+/g, (w) => { const k = w.toLowerCase().replace(/(.)\1{2,}/g, '$1$1'); return Object.prototype.hasOwnProperty.call(FINGLISH, k) ? FINGLISH[k] : w; });
  }
  const NEG_CMD = /(نکن|نکنی|نکنید|نباید|نمیخوا|نخواستم|بیخیال|منصرف|لغو|متوقف|توقف|خاموش|غیرفعال|قطع کن|استپ|\bstop\b|\bcancel\b|دست نزن|دست نزنی|اجرا نشه|اجرا نشود|انجام نشه|انجام نشود)/;
  const YES_CORE = new Set(['اره', 'بله', 'بلی', 'باشه', 'اوکی', 'اکی', 'ok', 'okay', 'حتما', 'موافقم', 'درسته', 'بفرما', 'yes', 'yep', 'انجام', 'انجامش', 'اجرا', 'اجراش', 'بزن', 'بزنش', 'شروع', 'همینو', 'همون', 'همونو']);
  const YES_FILL = new Set(['بده', 'کن', 'بره', 'رو', 'را', 'بشه', 'هم', 'همین', 'خب', 'پس', 'دیگه']);
  const NO_CORE = new Set(['نه', 'نخیر', 'بیخیال', 'ولش', 'فعلا', 'بعدا', 'نمیخوام']);
  const isYes = (b) => { const w = b.split(' ').filter(Boolean); return w.length > 0 && w.length <= 5 && w.some((x) => YES_CORE.has(x)) && w.every((x) => YES_CORE.has(x) || YES_FILL.has(x)); };
  const isNo = (b) => { const w = b.split(' ').filter(Boolean); return w.length > 0 && w.length <= 4 && NO_CORE.has(w[0]); };
  const PENDING_TTL = 15 * 60000;
  const POLITE = new Set(['لطفا', 'ممنون', 'مرسی', 'ممنونم']);
  const bare = (text) => norm(finglish(text)).replace(/آ/g, 'ا').split(' ').filter((w) => w && !POLITE.has(w)).join(' ');
  function pendingOf(state) { const p = state && state.pending; return p && p.act && Date.now() - Number(p.at || 0) < PENDING_TTL ? p : null; }
  /** Direct commands the app can execute (pure detection; the app decides whether it is allowed to run). Questions, negations and stop requests never match.
   *  With `state`, a short "yes" confirms the action the assistant just offered. */
  function actionIntent(text, state) {
    const raw = finglish(text); const t = norm(raw); if (!t) return null;
    const pend = pendingOf(state);
    if (pend && isYes(bare(text)) && !NEG_CMD.test(t)) return pend.act;
    { const tg = toggleIntent(t); if (tg) return tg; }
    if (NEG_CMD.test(t)) return null;
    if (/(چطور|چگونه|چرا|چیست|چی هست|یعنی چی|چه فرقی|فرق|آموزش|توضیح بده)/.test(t)) return null;
    if (/(پیشنهاد|بعد از تایید|بعد از تاییید|بعد از تأیید)/.test(t)) return null;
    if (/(برگردان|بازگردان|undo)/.test(t) && /(تغییر|آخرین)/.test(t) && !/(ترمیم|بازسازی|سئو)/.test(t.replace(/تغییر/g, ''))) return /(همه|تمام).{0,20}(امروز)/.test(t) ? 'undotoday' : /(همه|تمام)/.test(t) ? null : 'undolast';
    const verb = /(اجرا\s*کن|اجرا\s*بزن|اجرا\s*شو|انجام\s*بده|انجام\s*بدی|شروع\s*کن|بزن|کن(?![\u0600-\u06ff])|کنی(?![\u0600-\u06ff])|بکن|بده(?![\u0600-\u06ff])|بساز)/.test(t) || /(اجرای|انجام|شروع)\s/.test(t) && /(کن|بده)/.test(t);
    if (!verb) return null;
    if (/(برگردان|بازگردان|بازگرداندن|undo)/.test(t) && /(ترمیم|سئو|بازسازی)/.test(t)) return null;
    if (/(صفحه|لاگ|تاریخچه|گزارش)\s*(ی\s)?(تغییرات|تغییر)/.test(t) && /(باز|نشان|نمایش|ببین|برو|بیار)/.test(t)) return 'openlog';
    if (/(ارزیابی|بسنج|نمره\s?گیری|امتیازدهی|امتیاز بده)/.test(t) && /(متن|کیفیت|محتوا)/.test(t) && !/(محصول|مقاله)/.test(t)) return 'polishdry';
    if (/(پیش\s?نمایش|فقط گزارش|بدون تغییر|بدون اعمال|گزارش کیفیت)/.test(t) && /(متن|املا|غلط|نگارش|ویراست)/.test(t) && !/(محصول|مقاله)/.test(t)) return 'polishdry';
    // v1.26: typography / spelling / SEO-structure correction (no text rewriting) — checked before 'repair' so "غلط املایی ... اصلاح کن" never means "rewrite the products".
    if (/(املا|غلط|ویراست|نیم\s?فاصله|نگارش|تایپ|حروف عربی|نشانه\s?گذاری)/.test(t) || (/(اصلاح|ویرایش|درست|تصحیح|رفع)\s*(خودکار\s*)?(متن|نوشته)/.test(t) || /(متن|نوشته)(\s?ها)?.{0,14}(اصلاح|ویرایش|درست|تصحیح|رفع)/.test(t)) && !/(محصول|مقاله)/.test(t)) return 'polish';
    const seo = /(سئو|سیو|seo|عنوان و متا|متا)/.test(t); const repairWord = /(ترمیم)/.test(t); const prod = /(محصول|مقاله|محصولات|مقالات)/.test(t);
    if (/(بررسی|اسکن|چک)/.test(t) && prod && !repairWord) return 'scan';
    if (repairWord || (prod && /(درست|اصلاح|رفع|خودکار|بهینه)/.test(t))) return 'repair';
    if (seo && /(اجرا|بازسازی|خودکار|کامل|همین الان|الان|درست|اصلاح|بهینه|رفع|پر کن)/.test(t)) return 'autoseo';
    if (/بازسازی/.test(t)) return 'autoseo';
    return null;
  }
  /** "Don't do it" / "stop it" / "no thanks" — answered without running anything. */
  function stopIntent(text, state) {
    const t = norm(finglish(text)); if (!t) return null; const pend = pendingOf(state); const b = bare(text);
    if (pend && isNo(b)) return 'decline';
    if (!NEG_CMD.test(t)) return null;
    if (/(آیا|چرا|چیست|چطور|چگونه|کجا|کی |چه موقع|وضعیت)/.test(t + ' ')) return null; // a question about status, not an order
    if (!/(کن|کنی|کنید|بکن|بزن|بده|بشه|بشود|نشه|نشود|نخواستم|نمیخوا|بیخیال|منصرف|نباید|دست نز)/.test(t)) return null;
    if (/(سئو|سیو|seo|ترمیم|محصول|مقاله|بازسازی|خودکار|اجرا|انجام)/.test(t)) return 'stop';
    return null;
  }
  const CANON = { rules: 'قوانین سئوی گوگل و GEO چیست؟', summary: 'گزارش کلی بده', plan: 'برنامهٔ اقدام بده', seo: 'مشکلات سئو چیست؟', score: 'چرا امتیاز سئو این قدر است؟', aibots: 'رباتان AI من را می‌بینند؟', robots: 'robots.txt بساز', llms: 'llms.txt بساز', schema: 'اسکیما بساز', titles: 'عنوان و متای پیشنهادی بده', traffic: 'ترافیک من چطور است؟', trend: 'روند ترافیک من چطور است؟', wp: 'وضعیت وردپرس چطور است؟', repairstatus: 'وضعیت محصولات چیست؟', autoseo: 'وضعیت سئو خودکار چیست؟', next: 'قدم بعدی چیست؟', keywords: 'کلمات کلیدی من چیست؟', polishstatus: 'آخرین اصلاح متن چه بود؟', changelog: 'چه تغییری روی سایت دادی؟', quality: 'امتیاز کیفیت متن‌ها چقدر است؟', features: 'قابلیت‌های هوشمند متن چیست؟' };
  const TOK_STOP = new Set(['من', 'برای', 'این', 'آن', 'را', 'از', 'به', 'در', 'با', 'که', 'چی', 'چه', 'میشه', 'میخوام', 'بگو', 'بده', 'کن', 'است', 'هست', 'سایت']);
  /** Closest known questions for a message the classifier could not place (token overlap with a small typo tolerance). */
  function didYouMean(t, limit) {
    const toks = String(t || '').split(' ').filter((x) => x.length >= 3 && !TOK_STOP.has(x)); if (!toks.length) return [];
    const scored = Object.keys(CANON).map((id) => {
      const words = new Set(); (KW[id] || []).concat([norm(CANON[id])]).forEach((k) => String(k).split(' ').forEach((w) => { if (w.length >= 3 && !TOK_STOP.has(w)) words.add(w); }));
      let sc = 0; toks.forEach((tk) => { let best = 0; words.forEach((w) => { if (tk === w) best = Math.max(best, 3); else if (tk.length >= 4 && w.length >= 4 && (w.includes(tk) || tk.includes(w))) best = Math.max(best, 2); else if (tk.length >= 4 && w.length >= 4 && lev(tk, w) <= 1) best = Math.max(best, 2); }); sc += best; });
      return { id, sc };
    }).filter((x) => x.sc >= 2).sort((a, b) => b.sc - a.sc);
    return scored.slice(0, limit || 3).map((x) => CANON[x.id]);
  }

  const ago = (ms) => { if (!ms) return 'هرگز'; const m = Math.round((Date.now() - ms) / 60000); return m < 2 ? 'همین الان' : m < 90 ? m + ' دقیقه پیش' : m < 2880 ? Math.round(m / 60) + ' ساعت پیش' : Math.round(m / 1440) + ' روز پیش'; };
  function aRepair(ctx) {
    if (!ctx.bridgeConnected) return { text: 'برای بررسی محصولات باید افزونهٔ **Site Inspector Bridge** وصل باشد (⚙ تنظیمات).', chips: ['دستیار چه کارهایی بلد است؟'] };
    const r = ctx.repair;
    if (!r) return { text: 'هنوز محصولات و مقالات را بررسی نکرده‌ام. «بررسی محصولات» سئوی خالی، توضیح خالی/کوتاه و متن مشکوک (نمونه، کپی، تکراری، وزن ناهمخوان) را پیدا می‌کند و چیزی را تغییر نمی‌دهد.', chips: ['محصولات را بررسی کن', 'الان چه کار کنم؟'] };
    if (!r.flagged) return { text: '✅ از ' + r.total + ' محصول و مقاله، هیچ‌کدام مشکل تشخیص‌داده‌شده ندارد (میانگین سلامت ' + r.avgScore + '٪، آخرین بررسی ' + ago(r.at) + ').', chips: ['وضعیت سئو خودکار چیست؟', 'گزارش کلی بده'] };
    const parts = [['بدون سئو', r.noSeo], ['بدون توضیحات', r.noContent], ['توضیحات کوتاه', r.thin], ['متن اشتباه/مشکوک', r.wrong]].filter((x) => x[1]).map((x) => '- ' + x[0] + ': **' + x[1] + '**');
    const seoOnly = Math.max(0, r.flagged - r.noContent - r.thin - r.wrong);
    return { text: '**وضعیت محصولات و مقالات** (بررسی ' + ago(r.at) + ')\n\n**' + r.flagged + '** مورد از ' + r.total + ' نیاز به ترمیم دارد؛ میانگین سلامت ' + r.avgScore + '٪.\n\n' + parts.join('\n') + '\n\n**چه چیزی خودکار درست می‌شود؟** سئوی خالی یا ناقص از متن خود همان محصول پر می‌شود (' + (seoOnly ? 'حدود ' + seoOnly + ' مورد' : 'همین موارد') + '). متن خالی یا اشتباه فقط وقتی بازنویسی می‌شود که اطلاعات واقعی کافی یا مدل محلی داشته باشم؛ چیزی حدس زده نمی‌شود.', chips: ['محصولات را خودکار ترمیم کن', 'سئو را همین الان خودکار اجرا کن'] };
  }
  function aAutoSeo(ctx) {
    if (!ctx.bridgeConnected) return { text: 'اجرای خودکار سئو به افزونهٔ **Site Inspector Bridge** نیاز دارد؛ از ⚙ وصلش کن.', chips: ['دستیار چه کارهایی بلد است؟'] };
    const rb = ctx.rebuild || {}; const a = ctx.autoSeo; const L = ['**اجرای خودکار سئو**', ''];
    L.push('- زمان‌بندی: ' + (rb.enabled ? 'روشن، هر ' + (rb.intervalHours >= 168 ? 'هفته' : rb.intervalHours >= 24 ? 'روز' : rb.intervalHours + ' ساعت') + ' (هنگام باز بودن اپ)' : 'خاموش'));
    L.push('- مجوز افزونه: ' + (rb.ready ? 'آماده' : 'کامل نیست (مدیر باید «بازسازی خودکار متا» و HTTPS را فعال کند)'));
    if (a) { L.push('- آخرین اجرا: ' + ago(a.at)); if (a.rebuild) L.push('- عنوان/متا: ' + a.rebuild.applied + ' صفحه اصلاح شد از ' + a.rebuild.scanned + ' صفحه' + (a.rebuild.scoreBefore != null ? ' (سلامت متا ' + a.rebuild.scoreBefore + '٪ ← ' + a.rebuild.scoreAfter + '٪)' : '')); if (a.repair) L.push('- عبارت کلیدی/توضیح کوتاه/سئوی خالی/متن: ' + a.repair.applied + ' مورد اصلاح' + (a.repair.polished ? ' (که ' + a.repair.polished + ' مورد اصلاح املا/ساختار متن داشت)' : '') + '، ' + a.repair.skipped + ' رد شده، ' + a.repair.failed + ' خطا'); if (a.error) L.push('- ⚠️ ' + a.error); }
    else L.push('- هنوز اجرای کامل ثبت نشده است.');
    if (ctx.smart) L.push('- اصلاح متن: ' + onOff(ctx.smart.polish) + ' · ساخت متن: ' + onOff(ctx.smart.write) + ' · FAQ: ' + onOff(ctx.smart.faq) + ' · پیوند داخلی: ' + onOff(ctx.smart.links));
    if (!rb.enabled && rb.ready) L.push('\nبرای اینکه خودش بدون یادآوری اجرا شود، در «تب سئو ← بازسازی خودکار سئو» زمان‌بندی را روشن کن.');
    return { text: L.join('\n'), chips: ['سئو را همین الان خودکار اجرا کن', 'وضعیت محصولات چیست؟'] };
  }
  const onOff = (v) => (v === false ? 'خاموش' : 'روشن');
  function aFeatures(ctx) {
    const m = ctx.smart;
    const L = ['**قابلیت‌های هوشمند متن** (همه با تأیید خودکار ایمنی؛ متن صفحه‌ساز و متن اشتباه دست نمی‌خورد و همه چیز در ژورنال قابل بازگردانی است)', ''];
    const row = (k, desc) => '- **' + TOG_LABEL[k] + '**' + (m ? ' — ' + onOff(m[k]) : '') + ': ' + desc;
    L.push(row('polish', 'ی/ک عربی، ارقام، نیم‌فاصله، فاصله و نشانه‌گذاری، غلط‌های املایی رایج، یک H1، تیترهای پرش‌دار، alt تصویر'));
    L.push(row('write', 'برای محصول/مقالهٔ خالی یا کوتاه، فقط از مشخصات واقعی ثبت‌شده متن می‌سازد و عدد یا ادعای بی‌منبع را حذف می‌کند'));
    L.push(row('faq', 'بخش «پرسش‌های متداول» از ویژگی‌های ثبت‌شده، بدون اطلاعات ساختگی'));
    L.push(row('links', 'حداکثر ۳ پیوند جدید به صفحهٔ دقیقاً هم‌نام؛ متن قابل‌مشاهده عوض نمی‌شود'));
    if (!m) L.push('', 'وضعیت روشن/خاموش را وقتی افزونه وصل باشد نشان می‌دهم.');
    L.push('', 'برای تغییر بگو: «پیوند داخلی را خاموش کن» یا «ساخت خودکار متن را روشن کن».');
    return { text: L.join('\n'), chips: ['آخرین اصلاح متن چه بود؟', 'پیش‌نمایش اصلاح متن را بده', 'قدم بعدی چیست؟'] };
  }
  const gradeOf = (n) => (n >= 85 ? 'عالی' : n >= 70 ? 'خوب' : n >= 50 ? 'نیازمند بهبود' : 'ضعیف');
  function aQuality(ctx) {
    const q = ctx.quality;
    if (!q) return { text: 'هنوز ارزیابی کیفیت متن‌ها انجام نشده. «ارزیابی کیفیت متن‌ها را انجام بده» همهٔ متن‌ها را می‌خواند و برای هر کدام نمرهٔ ۰ تا ۱۰۰ با دلیل می‌دهد (چیزی تغییر نمی‌کند). نمره از این بخش‌ها ساخته می‌شود: عمق متن، نگارش و املا، ساختار و تیترها، سئوی صفحه، خوانایی، پیوند/تصویر/پرسش‌ها.', chips: ctx.bridgeConnected ? ['ارزیابی کیفیت متن‌ها را انجام بده'] : ['دستیار چه کارهایی بلد است؟'] };
    const cur = q.after != null ? q.after : q.before; const L = ['**امتیاز کیفیت متن‌ها: ' + cur + ' از ۱۰۰ (' + gradeOf(cur) + ')** · ' + q.n + ' مورد · ' + ago(q.at)];
    if (q.after != null && q.after !== q.before) L.push('', '- قبل از اصلاح ' + q.before + '، بعد از آن ' + q.after + '.');
    if (q.prev != null && q.prev !== cur) L.push('- نسبت به ارزیابی قبلی: ' + (cur > q.prev ? '+' : '') + (cur - q.prev) + ' امتیاز.');
    if (q.grades) L.push('- عالی ' + q.grades.great + ' · خوب ' + q.grades.good + ' · نیازمند بهبود ' + q.grades.mid + ' · ضعیف ' + q.grades.bad);
    if (q.weak && q.weak.length) L.push('- **ضعیف‌ترین بخش‌ها:** ' + q.weak.map((w) => w.label + ' (' + w.pct + '٪)').join('، '));
    if (q.worst && q.worst.length) { L.push('', '**کم‌امتیازترین‌ها:**'); q.worst.forEach((w) => L.push('- ' + w.title + ' — ' + w.score + (w.note ? ' (' + w.note + ')' : ''))); }
    L.push('', 'نگارش، ساختار و سئوی ناقص را اصلاح خودکار بالا می‌برد؛ عمق متن فقط از اطلاعات واقعی می‌آید (ساخت خودکار متن برای خالی/کوتاه‌ها).');
    return { text: L.join('\n'), chips: ['ارزیابی کیفیت متن‌ها را انجام بده', 'غلط‌های املایی متن‌ها را اصلاح کن', 'قدم بعدی چیست؟'] };
  }
  function aChangeLog(ctx) {
    const c = ctx.changes;
    if (!ctx.bridgeConnected && !(c && c.total)) return { text: 'تغییری ثبت نشده است؛ وقتی افزونه وصل باشد و اپ چیزی را روی سایت اصلاح کند، همین‌جا گزارش می‌دهم و می‌توانی هر مورد را برگردانی.', chips: ['دستیار چه کارهایی بلد است؟'] };
    if (!c || !c.total) return { text: 'تا الان هیچ تغییری روی سایتت ثبت نشده است. هر اصلاح بعدی (سئو، متن، محصول) با زمان و قبل/بعد در **صفحهٔ تغییرات** (آیکون ساعت بالای صفحه) ثبت می‌شود و قابل برگشت است.', chips: ['قدم بعدی چیست؟', 'سئو را همین الان خودکار اجرا کن'] };
    const L = ['**تغییراتی که اپ روی سایتت داده**', '', '- کل ثبت‌شده: **' + c.total + '** · فعال: **' + c.applied + '** · امروز: **' + c.today + '** · برگشت‌خورده: ' + c.rolled + ' · صفحهٔ درگیر: ' + c.pages];
    if (c.last && c.last.length) { L.push('', '**آخرین‌ها:**'); c.last.forEach((e) => L.push('- ' + (e.title || 'محتوا #' + e.post_id) + ' — ' + ago(e.at) + (e.label ? ' (' + e.label + ')' : '') + (e.state === 'rolled_back' ? ' ↩︎ برگشت‌خورده' : ''))); }
    L.push('', 'برای جزئیات «قبل و بعد» و برگرداندن، صفحهٔ تغییرات را باز کن. اگر بگویی «آخرین تغییر را برگردان» همین الان آخرینش را (با تأیید خودت) برمی‌گردانم.');
    return { text: L.join('\n'), chips: ['صفحهٔ تغییرات را باز کن', 'آخرین تغییر را برگردان', 'قدم بعدی چیست؟'] };
  }
  function aPolishStatus(ctx) {
    const m = ctx.smart; const l = m && m.last;
    if (!ctx.bridgeConnected) return { text: 'اصلاح متن به افزونهٔ **Site Inspector Bridge** نیاز دارد؛ از ⚙ وصلش کن. بعد می‌توانی بگویی «پیش‌نمایش اصلاح متن را بده» تا بدون تغییر ببینی چه چیزی اصلاح می‌شود.', chips: ['دستیار چه کارهایی بلد است؟'] };
    if (!l) return { text: 'هنوز بررسی کامل متن‌ها اجرا نشده است. «پیش‌نمایش اصلاح متن» همهٔ متن‌ها را می‌خواند و فقط گزارش می‌دهد (چیزی تغییر نمی‌کند).', chips: ['پیش‌نمایش اصلاح متن را بده', 'غلط‌های املایی متن‌ها را اصلاح کن'] };
    const L = ['**' + (l.dry ? 'آخرین پیش‌نمایش' : 'آخرین اصلاح') + ' متن** (' + ago(l.at) + ')', ''];
    L.push('- بررسی ' + l.scanned + ' از ' + l.total + ' مورد · ' + (l.dry ? 'نیازمند اصلاح ' : 'اصلاح‌شده ') + l.changed + ' · بدون نیاز ' + l.clean + (l.rejected ? ' · ردشده توسط بررسی ایمنی ' + l.rejected : '') + (l.failed ? ' · خطا ' + l.failed : ''));
    if (m.lastText) L.push('- ' + m.lastText);
    if (l.links) L.push('- پیوند داخلی: ' + l.links); if (l.faq) L.push('- پرسش‌های متداول: ' + l.faq + ' محصول');
    if (l.remaining) L.push('- ' + l.remaining + ' مورد هنوز دارای نکتهٔ باقی‌مانده است؛ بخشی‌اش نیاز به تصمیم انسانی دارد.');
    return { text: L.join('\n'), chips: [l.dry ? 'غلط‌های املایی متن‌ها را اصلاح کن' : 'پیش‌نمایش اصلاح متن را بده', 'قدم بعدی چیست؟'] };
  }
  function aNext(ctx) {
    const steps = []; const rep = ctx.report; const r = ctx.repair; const rb = ctx.rebuild || {}; const a = ctx.autoSeo;
    if (!rep) steps.push(['از تب **رادار** سایتت را بازرسی کن تا بر اساس داده واقعی تصمیم بگیرم.', ['دستیار چه کارهایی بلد است؟']]);
    if (ctx.bridgeConnected && !r) steps.push(['محصولات و مقالاتت هنوز بررسی نشده‌اند؛ اول «بررسی محصولات» بزن (چیزی تغییر نمی‌کند).', ['محصولات را بررسی کن']]);
    if (r && r.flagged) steps.push(['**' + r.flagged + '** محصول/مقاله نیاز به ترمیم دارد؛ سئوی خالی‌ها را می‌توانم همین الان خودکار پر کنم.', ['محصولات را خودکار ترمیم کن']]);
    if (ctx.bridgeConnected && rb.ready && (!a || Date.now() - a.at > 7 * 86400000)) steps.push(['آخرین اجرای کامل سئو ' + ago(a && a.at) + ' بوده؛ یک اجرا عنوان/متای ضعیف و تکراری را اصلاح می‌کند.', ['سئو را همین الان خودکار اجرا کن']]);
    if (ctx.bridgeConnected && rb.ready && !rb.enabled) steps.push(['زمان‌بندی خودکار خاموش است؛ با روشن‌کردنش دیگر لازم نیست یادت بماند.', ['وضعیت سئو خودکار چیست؟']]);
    if (ctx.quality && (ctx.quality.after != null ? ctx.quality.after : ctx.quality.before) < 70) steps.push(['امتیاز کیفیت متن‌ها ' + (ctx.quality.after != null ? ctx.quality.after : ctx.quality.before) + ' از ۱۰۰ است؛ اجرای کامل سئو و اصلاح متن آن را بالا می‌برد.', ['سئو را همین الان خودکار اجرا کن', 'امتیاز کیفیت متن‌ها چقدر است؟']]);
    { const m = ctx.smart; if (ctx.bridgeConnected && m && m.polish !== false && (!m.last || Date.now() - m.last.at > 14 * 86400000)) steps.push(['متن‌ها مدتی است برای املا و ساختار بررسی نشده‌اند؛ پیش‌نمایش اصلاح متن چیزی را تغییر نمی‌دهد.', ['پیش‌نمایش اصلاح متن را بده']]); }
    if (rep) { const s = rep.scores && rep.scores.seo; if (s != null && s < 70) steps.push(['امتیاز سئوی سایت ' + s + ' است؛ برنامهٔ اقدام اولویت‌دار را ببین.', ['برنامهٔ اقدام بده']]); }
    if (!steps.length) return { text: 'طبق داده‌های فعلی کار فوری باقی نمانده است ✅. پیشنهادم: چند روز بعد دوباره بازرسی بگیر تا تغییر ترافیک و رتبه را مقایسه کنم.', chips: ['گزارش کلی بده', 'روند ترافیک من چطور است؟'] };
    const top = steps[0]; const rest = steps.slice(1, 3).map((x) => '- ' + x[0]);
    return { text: '**قدم بعدی پیشنهادی:**\n\n' + top[0] + (rest.length ? '\n\nبعد از آن:\n' + rest.join('\n') : ''), chips: top[1].concat(steps[1] ? steps[1][1] : []).slice(0, 3) };
  }

  SI.Brain = { answer, toggleIntent, TOG_LABEL, actionIntent, stopIntent, didYouMean, finglish, norm, classify, planItems, genRobots, genLlms, genSchema, suggestFor, trafficFacts, proposeFixes };
  return SI.Brain;
});
