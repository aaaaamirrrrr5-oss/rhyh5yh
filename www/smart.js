/* Site Inspector Smart Action Planner.
 * Deterministic and model-free (works on every phone, any RAM): turns an audit report into a prioritized action plan,
 * ready-to-paste files (llms.txt, robots.txt lines, JSON-LD), trend diffs between audits, and Search Console opportunities.
 * Estimates are diagnostics only; they are not Google ranking predictions.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SI = root.SI || {}, root.SI.Smart = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const SEV_W = { critical: 12, high: 7, medium: 3, low: 1 };
  /* impact 1-10 (benefit if fixed), effort 1-10 (work needed), area, fix = concrete next step, auto = fixable by the SEO rebuild engine */
  const KB = {
    robots_html: { impact: 7, effort: 2, area: 'tech', fix: 'robots.txt را به‌صورت متن ساده در ریشهٔ سایت بگذارید و فایروال/ریدایرکت را بررسی کنید.' },
    robots_large: { impact: 5, effort: 3, area: 'tech', fix: 'قواعد تکراری را حذف و robots.txt را زیر ۵۰۰ کیلوبایت نگه دارید.' },
    robots_blocks_wp_assets: { impact: 7, effort: 1, area: 'tech', fix: 'Disallow برای wp-content و wp-includes را بردارید (فقط /wp-admin/ بسته بماند).' },
    robots_blocks_images: { impact: 6, effort: 1, area: 'tech', fix: 'Disallow مربوط به /wp-content/uploads/ را بردارید.' },
    robots_crawl_delay: { impact: 2, effort: 1, area: 'tech', fix: 'Crawl-delay را حذف کنید مگر سرور واقعاً فشار می‌بیند.' },
    robots_noindex_directive: { impact: 2, effort: 1, area: 'tech', fix: 'خط Noindex را حذف کنید و از meta robots استفاده کنید.' },
    robots_http_sitemap: { impact: 2, effort: 1, area: 'tech', fix: 'نشانی Sitemap را با https بنویسید.' },
    title_px_long: { impact: 1, effort: 1, area: 'seo', auto: true, fix: 'عنوان را کمی کوتاه کنید تا مهم‌ترین کلمه‌ها در ابتدا و دیده‌شدنی بمانند.' },
    robots_blocks_all: { impact: 5, effort: 1, area: 'tech', fix: 'خط Disallow: / را از robots.txt حذف کنید (در وردپرس: تنظیمات ← خواندن ← «درخواست از موتورهای جستجو برای نمایه نکردن» خاموش باشد).' },
    robots_blocks_css_js: { impact: 3, effort: 1, area: 'tech', fix: 'قاعده‌های Disallow مربوط به .css و .js را بردارید یا برایشان Allow بگذارید.' },
    sitemap_blocked_by_robots: { impact: 4, effort: 2, area: 'tech', fix: 'مسیرهای بسته‌شده را از نقشهٔ سایت حذف کنید یا اگر باید نمایه شوند از robots.txt بردارید.' },
    sitemap_bad_lastmod: { impact: 1, effort: 1, area: 'tech', fix: 'قالب lastmod را W3C کنید (YYYY-MM-DD یا با ساعت و منطقهٔ زمانی).' },
    robots_unknown_directive: { impact: 2, effort: 1, area: 'tech', fix: 'غلط املایی دستورها را اصلاح کنید (User-agent، Disallow، Allow، Sitemap).' },
    sitemap_empty: { impact: 7, effort: 2, area: 'tech', fix: 'افزونهٔ نقشهٔ سایت را بررسی کنید که نوع‌های محتوا را شامل کند.' },
    sitemap_too_many: { impact: 6, effort: 3, area: 'tech', fix: 'نقشه را به چند فایل فرعی با sitemapindex بشکنید (هر فایل زیر ۵۰ هزار).' },
    sitemap_duplicate_urls: { impact: 2, effort: 2, area: 'tech', fix: 'دو افزونهٔ نقشهٔ سایت همزمان فعال نباشد؛ یکی را غیرفعال کنید.' },
    sitemap_http_urls: { impact: 4, effort: 2, area: 'tech', fix: 'آدرس سایت را در تنظیمات وردپرس https کنید و نقشه را بازسازی کنید.' },
    sitemap_foreign_host: { impact: 4, effort: 2, area: 'tech', fix: 'نشانی‌های دامنهٔ دیگر را از نقشه حذف کنید (تنظیمات افزونه).' },
    sitemap_junk_urls: { impact: 3, effort: 2, area: 'tech', fix: 'نشانی‌های پارامتری، فید، سبد و برچسب‌های کم‌ارزش را از نقشه خارج کنید.' },
    sitemap_no_lastmod: { impact: 2, effort: 2, area: 'tech', fix: 'افزونهٔ سئو را روی تولید lastmod واقعی تنظیم کنید.' },
    sitemap_fake_lastmod: { impact: 2, effort: 2, area: 'tech', fix: 'lastmod را از تاریخ ویرایش واقعی هر صفحه بگیرید، نه تاریخ تولید فایل.' },
    sitemap_future_lastmod: { impact: 2, effort: 1, area: 'tech', fix: 'منطقهٔ زمانی و ساعت سرور/وردپرس را اصلاح کنید.' },
    llms_no_title: { impact: 1, effort: 1, area: 'seo', fix: 'فایل را با «# نام سایت» شروع کنید و بعد یک خلاصهٔ کوتاه بنویسید.' },
    llms_no_links: { impact: 1, effort: 2, area: 'seo', fix: 'فهرست صفحه‌های مهم را به‌صورت [عنوان](نشانی) اضافه کنید.' },
    llms_thin: { impact: 1, effort: 2, area: 'seo', fix: 'معرفی کوتاه سایت و چند لینک کلیدی اضافه کنید.' },
    nofollow_page: { impact: 7, effort: 1, area: 'seo', fix: 'در افزونهٔ سئو گزینهٔ nofollow را برای این صفحه بردارید (تنظیمات پیشرفتهٔ صفحه).' },
    nosnippet: { impact: 6, effort: 1, area: 'seo', fix: 'nosnippet/max-snippet:0 را از meta robots بردارید؛ مقدار پیشنهادی max-snippet:-1.' },
    multi_title: { impact: 5, effort: 2, area: 'tech', fix: 'فقط یک منبع عنوان بماند: add_theme_support(\'title-tag\') در قالب و افزونهٔ سئو، نه هر دو.' },
    multi_desc: { impact: 3, effort: 2, area: 'tech', fix: 'تولید متا را به یک منبع (افزونهٔ سئو) بسپارید و تکرار قالب را حذف کنید.' },
    meta_refresh: { impact: 5, effort: 3, area: 'tech', fix: 'meta refresh را با ریدایرکت ۳۰۱ سمت سرور جایگزین کنید.' },
    canonical_params: { impact: 3, effort: 2, area: 'tech', fix: 'canonical را بدون پارامتر و به نشانی تمیز صفحه تنظیم کنید.' },
    og_url_mismatch: { impact: 2, effort: 1, area: 'seo', fix: 'og:url را برابر canonical بگذارید (در افزونهٔ سئو معمولاً خودکار است).' },
    arabic_chars: { impact: 4, effort: 1, area: 'seo', auto: true, fix: 'حروف عربی «ي/ك» را به «ی/ک» تبدیل کنید (ابزار پولیش املای اپ یا افزونهٔ «Persian Fixer» وردپرس).' },
    arabic_digits: { impact: 2, effort: 1, area: 'seo', fix: 'ارقام عربی-هندی (٠-٩) را به ۰-۹ تبدیل کنید؛ تنظیم کیبورد/ویرایشگر را اصلاح کنید.' },
    no_trust_pages: { impact: 5, effort: 2, area: 'content', fix: 'صفحه‌های «تماس با ما»، «درباره ما» و «حریم خصوصی/قوانین» را بسازید و در منو یا فوتر لینک دهید.' },
    schema_duplicate: { impact: 4, effort: 2, area: 'tech', fix: 'اسکیمای تکراری را پیدا کنید و یکی از منبع‌ها (قالب یا افزونهٔ سئو) را در تنظیمات خاموش کنید.' },
    img_bad_filename: { impact: 2, effort: 2, area: 'tech', fix: 'نام فایل تصاویر را توصیفی و لاتین/فارسی‌خوانا کنید (مثلاً french-press-glass.webp) و alt بنویسید.' },
    title_h1_unrelated: { impact: 3, effort: 1, area: 'seo', fix: 'عنوان (title) و H1 را دربارهٔ یک موضوع و با واژهٔ کلیدی مشترک بنویسید.' },
    no_preconnect: { impact: 2, effort: 2, area: 'tech', fix: 'برای دامنه‌های بیرونی مهم <link rel="preconnect" href="https://…"> اضافه کنید (افزونهٔ کش/قالب).' },
    font_display: { impact: 2, effort: 1, area: 'tech', fix: 'به @font-face مقدار font-display: swap بدهید یا پارامتر &display=swap را به آدرس Google Fonts اضافه کنید.' },
    no_apple_touch_icon: { impact: 1, effort: 1, area: 'tech', fix: 'نماد سایت ۵۱۲×۵۱۲ را در تنظیمات وردپرس بگذارید؛ apple-touch-icon خودکار ساخته می‌شود.' },
    long_h1: { impact: 2, effort: 1, area: 'seo', fix: 'H1 را به کمتر از ۷۰ نویسه برسانید و کلیدواژهٔ اصلی را در ابتدایش بیاورید.' },
    empty_links: { impact: 2, effort: 3, area: 'seo', fix: 'به لینک‌های آیکونی aria-label توصیفی بدهید یا متن/alt اضافه کنید.' },
    many_links: { impact: 2, effort: 5, area: 'seo', fix: 'لینک‌های کم‌اهمیت منو/فوتر/سایدبار را کم کنید.' },
    large_html: { impact: 5, effort: 5, area: 'tech', fix: 'محتوای اضافه، صفحه‌بندی نشده یا اسکریپت/استایل inline حجیم را خارج یا صفحه‌بندی کنید.' },
    big_dom: { impact: 3, effort: 5, area: 'tech', fix: 'المان‌های تودرتوی قالب/پیج‌بیلدر را ساده کنید یا لیست‌های بلند را صفحه‌بندی کنید.' },
    render_blocking_scripts: { impact: 3, effort: 3, area: 'tech', fix: 'به اسکریپت‌ها defer/async بدهید (افزونهٔ کش/بهینه‌ساز مثل WP Rocket یا Perfmatters).' },
    js_rendered: { impact: 8, effort: 7, area: 'tech', fix: 'SSR یا پیش‌رندر (SSG) فعال کنید تا HTML اولیه شامل متن اصلی باشد.' },
    img_no_srcset: { impact: 2, effort: 3, area: 'tech', fix: 'وردپرس srcset را خودکار می‌گذارد؛ قالب یا افزونهٔ تصویر را بررسی کنید.' },
    lcp_image_lazy: { impact: 3, effort: 1, area: 'tech', fix: 'برای تصویر اول صفحه loading=\'eager\' و fetchpriority=\'high\' بگذارید.' },
    product_schema_image: { impact: 5, effort: 2, area: 'seo', fix: 'تصویر شاخص محصول را در اسکیما (image) بگذارید؛ افزونهٔ سئو/ووکامرس معمولاً خودکار است.' },
    product_no_rating: { impact: 2, effort: 3, area: 'seo', fix: 'فقط در صورت وجود نظر واقعی، aggregateRating را با افزونهٔ نظرات فعال کنید.' },
    article_schema_fields: { impact: 3, effort: 2, area: 'seo', fix: 'headline، image، author و datePublished را در اسکیمای مقاله کامل کنید.' },
    faq_no_schema: { impact: 3, effort: 2, area: 'seo', fix: 'با بلوک FAQ افزونهٔ سئو همان پرسش‌وپاسخ‌های دیدنی صفحه را به FAQPage تبدیل کنید.' },
    video_no_schema: { impact: 3, effort: 3, area: 'seo', fix: 'اسکیمای VideoObject (عنوان، توضیح، thumbnail، uploadDate) اضافه کنید.' },
    stale_content: { impact: 3, effort: 5, area: 'seo', fix: 'مقاله را بازبینی و داده‌های قدیمی را به‌روز کنید؛ سپس تاریخ به‌روزرسانی واقعی ثبت شود.' },
    no_twitter_card: { impact: 2, effort: 1, area: 'seo', fix: 'در افزونهٔ سئو (Yoast/Rank Math) گزینهٔ Twitter Card را روی «summary_large_image» فعال کنید.' },
    no_og_image: { impact: 4, effort: 2, area: 'seo', fix: 'برای صفحه تصویر شاخص بگذارید و در افزونهٔ سئو یک تصویر پیش‌فرض Open Graph (۱۲۰۰×۶۳۰) تعریف کنید.' },
    no_favicon: { impact: 2, effort: 1, area: 'tech', fix: 'در وردپرس: نمایش ← سفارشی‌سازی ← هویت سایت ← «نماد سایت» (حداقل ۵۱۲×۵۱۲).' },
    no_charset: { impact: 2, effort: 1, area: 'tech', fix: 'meta charset=\"utf-8\" را اول head بگذارید (قالب وردپرس معمولاً خودکار دارد؛ قالب را بررسی کنید).' },
    img_alt_filename: { impact: 3, effort: 3, area: 'seo', fix: 'alt را از نام فایل به توصیف کوتاه تصویر تغییر دهید (مثلاً نام محصول + نمای تصویر).' },
    img_alt_long: { impact: 1, effort: 2, area: 'seo', fix: 'alt را به یک جملهٔ کوتاه (زیر ۱۲۵ نویسه) برسانید.' },
    img_no_lazy: { impact: 3, effort: 2, area: 'tech', fix: 'loading=\"lazy\" را برای تصاویر پایین صفحه فعال کنید (وردپرس ≥۵٫۵ پیش‌فرض دارد؛ افزونهٔ کش/قالب را بررسی کنید).' },
    img_legacy_format: { impact: 4, effort: 3, area: 'tech', fix: 'تصاویر را با افزونهٔ بهینه‌ساز (مثل ShortPixel/Imagify) به WebP یا AVIF تبدیل کنید.' },
    title_stuffed: { impact: 3, effort: 2, area: 'seo', auto: true, fix: 'عنوان را روان و یکتا بنویسید؛ هر واژه حداکثر یک بار و حداکثر یک جداکنندهٔ برند.' },
    desc_equals_title: { impact: 3, effort: 2, area: 'seo', auto: true, fix: 'متا را با یک واقعیت ملموس و دعوت به اقدام (۷۰ تا ۱۶۰ نویسه) بازنویسی کنید.' },
    no_org_schema: { impact: 3, effort: 2, area: 'seo', fix: 'در افزونهٔ سئو بخش «اطلاعات سازمان/وب‌سایت» را کامل کنید (نام، لوگو، شبکه‌های اجتماعی).' },
    no_article_schema: { impact: 3, effort: 2, area: 'seo', fix: 'نوع محتوا را در افزونهٔ سئو روی Article/BlogPosting بگذارید و نویسنده و تصویر شاخص را تکمیل کنید.' },
    no_h2: { impact: 3, effort: 3, area: 'seo', fix: 'متن را با چند H2 توصیفی به بخش‌ها تقسیم کنید.' },
    http_internal_links: { impact: 5, effort: 3, area: 'tech', fix: 'لینک‌های داخلی http را به https تغییر دهید (جستجو و جایگزینی در پایگاه‌داده با افزونهٔ Better Search Replace).' },
    no_external_links: { impact: 2, effort: 3, area: 'seo', fix: 'به یک یا دو منبع معتبر مرتبط در متن ارجاع دهید.' },
    no_max_image_preview: { impact: 2, effort: 1, area: 'seo', fix: 'در تنظیمات افزونهٔ سئو max-image-preview:large را فعال کنید (وردپرس ≥۵٫۷ پیش‌فرض دارد).' },
    canonical_offsite: { impact: 8, effort: 2, area: 'tech', fix: 'canonical را به نشانی خود صفحه برگردانید (تنظیم افزونهٔ سئو یا قالب را بررسی کنید).' },
    product_no_schema: { impact: 8, effort: 3, area: 'seo', fix: 'اسکیمای Product را با افزونهٔ سئو/ووکامرس فعال کنید؛ قیمت و موجودی باید خودکار از ووکامرس بیایند.' },
    product_schema_offer: { impact: 8, effort: 3, area: 'seo', fix: 'در اسکیمای Product فیلدهای offers با price و availability را کامل کنید.' },
    product_schema_ids: { impact: 3, effort: 3, area: 'seo', fix: 'برند و sku/gtin را فقط در صورت وجود واقعی در اسکیما اضافه کنید.' },
    short_desc: { impact: 3, effort: 2, area: 'seo', auto: true, fix: 'متا را به ۷۰ تا ۱۶۰ نویسه برسانید و یک واقعیت ملموس از صفحه در آن بگذارید.' },
    canonical_other: { impact: 3, effort: 2, area: 'tech', fix: 'اگر ارجاع canonical عمدی نیست، آن را به نشانی خود صفحه تغییر دهید.' },
    no_rtl: { impact: 3, effort: 1, area: 'tech', fix: 'زبان سایت را در وردپرس فارسی کنید یا dir=\"rtl\" را روی تگ html بگذارید.' },
    generic_anchor: { impact: 2, effort: 3, area: 'seo', fix: 'متن لینک‌ها را توصیفی کنید (نام صفحهٔ مقصد، نه «اینجا»).' },
    few_internal: { impact: 3, effort: 3, area: 'seo', fix: 'چند لینک داخلی مرتبط به محصول/مقالهٔ هم‌موضوع اضافه کنید.' },
    no_breadcrumb: { impact: 2, effort: 2, area: 'seo', fix: 'breadcrumb را در قالب یا افزونهٔ سئو فعال کنید.' },
    img_dims: { impact: 2, effort: 3, area: 'tech', fix: 'width و height تصاویر را مشخص کنید (وردپرس معمولاً خودکار می‌گذارد؛ قالب را بررسی کنید).' },
    no_https: { impact: 10, effort: 6, area: 'tech', fix: 'گواهی SSL را فعال و همهٔ نشانی‌ها را با ریدایرکت ۳۰۱ به HTTPS ببرید.' },
    http_error: { impact: 9, effort: 4, area: 'tech', fix: 'صفحات خطادار را درست یا با ریدایرکت ۳۰۱ به صفحهٔ جایگزین هدایت کنید.' },
    noindex: { impact: 9, effort: 2, area: 'seo', fix: 'اگر صفحه باید در گوگل باشد، تیک «عدم نمایه‌سازی» یا برچسب noindex را بردارید.' },
    missing_title: { impact: 9, effort: 2, area: 'seo', auto: true, fix: 'برای هر صفحه عنوان یکتای ۳۰ تا ۶۰ نویسه‌ای بنویسید (بازسازی خودکار می‌تواند پیشنهاد دهد).' },
    missing_desc: { impact: 7, effort: 2, area: 'seo', auto: true, fix: 'توضیحات متای ۷۰ تا ۱۶۰ نویسه‌ای بنویسید؛ «بازسازی خودکار سئو» این مورد را امن پر می‌کند.' },
    no_sitemap: { impact: 8, effort: 2, area: 'tech', fix: 'sitemap.xml بسازید (افزونه‌های سئو خودکار می‌سازند) و آن را در Search Console ثبت کنید.' },
    no_h1: { impact: 7, effort: 2, area: 'seo', fix: 'یک تیتر H1 شامل موضوع اصلی صفحه اضافه کنید.' },
    no_viewport: { impact: 8, effort: 1, area: 'tech', fix: 'تگ meta viewport را در هدر قالب اضافه کنید.' },
    multi_h1: { impact: 3, effort: 3, area: 'seo', fix: 'فقط یک H1 نگه دارید و بقیه را H2 کنید.' },
    thin: { impact: 6, effort: 7, area: 'seo', fix: 'محتوا را با پاسخ دقیق به سؤال‌های کاربر، مثال و جدول به حداقل ۳۰۰ واژه برسانید.' },
    long_title: { impact: 4, effort: 2, area: 'seo', auto: true, fix: 'عنوان را زیر ۶۰ نویسه کنید و کلمهٔ اصلی را در ابتدا بیاورید.' },
    short_title: { impact: 3, effort: 2, area: 'seo', auto: true, fix: 'عنوان را با کلمهٔ کلیدی و مزیت اصلی کامل‌تر کنید.' },
    long_desc: { impact: 2, effort: 2, area: 'seo', auto: true, fix: 'توضیحات را زیر ۱۶۰ نویسه خلاصه کنید.' },
    img_alt: { impact: 5, effort: 3, area: 'seo', fix: 'برای تصاویر مهم متن جایگزین توصیفی بنویسید (هم دسترس‌پذیری، هم سئو تصویر).' },
    no_canonical: { impact: 4, effort: 2, area: 'tech', fix: 'canonical خودارجاع را در افزونهٔ سئو فعال کنید.' },
    no_lang: { impact: 2, effort: 1, area: 'tech', fix: 'lang="fa" را روی تگ html بگذارید.' },
    og: { impact: 2, effort: 2, area: 'seo', fix: 'og:title و og:image را فعال کنید تا لینک در شبکه‌ها خوب نمایش داده شود.' },
    no_robots: { impact: 4, effort: 1, area: 'tech', fix: 'فایل robots.txt با آدرس نقشهٔ سایت بسازید (نمونهٔ آماده پایین هست).' },
    no_schema: { impact: 6, effort: 4, area: 'geo', fix: 'داده ساختاریافته JSON-LD (Organization، Article، Product) اضافه کنید؛ نمونهٔ آماده پایین هست.' },
    aeo_format: { impact: 6, effort: 4, area: 'aeo', fix: 'تیترهای پرسشی (؟) و زیر هر کدام پاسخ ۲ تا ۳ جمله‌ای بنویسید؛ سپس FAQPage اضافه کنید.' },
    no_author: { impact: 4, effort: 3, area: 'geo', fix: 'نام نویسنده را با بیوگرافی کوتاه و لینک صفحهٔ نویسنده نمایش دهید و در schema هم بگذارید.' },
    no_date: { impact: 3, effort: 2, area: 'geo', fix: 'تاریخ انتشار و آخرین به‌روزرسانی را با تگ time و schema نمایش دهید.' },
    no_extractable: { impact: 4, effort: 4, area: 'aeo', fix: 'متن را با زیرتیتر H2، فهرست و جدول خلاصه ساختار بدهید تا AI بتواند بخش‌ها را نقل کند.' },
    heading_skip: { impact: 2, effort: 2, area: 'seo', fix: 'سلسله‌مراتب تیترها را بدون پرش (H1، H2، H3) مرتب کنید.' },
    geo_no_org_schema: { impact: 6, effort: 3, area: 'geo', fix: 'JSON-LD سازمان و وب‌سایت را (دکمهٔ «کپی JSON-LD») در هدر سایت بگذارید تا هویت برند برای AI روشن شود.' },
    geo_no_trust_pages: { impact: 5, effort: 3, area: 'geo', fix: 'صفحات «دربارهٔ ما» و «تماس با ما» بسازید و از منوی اصلی یا فوتر لینک دهید؛ نشانهٔ اعتماد برای موتورهای پاسخ‌گوست.' },
    geo_no_sameas: { impact: 3, effort: 2, area: 'geo', fix: 'پروفایل‌های رسمی برند (اینستاگرام، لینکدین، نقشه و ...) را با sameAs در schema سازمان معرفی کنید.' },
    no_llms: { impact: 3, effort: 1, area: 'geo', fix: 'فایل llms.txt را از نمونهٔ آماده بسازید و در ریشهٔ سایت بگذارید.' }
  };
  const AREA = { seo: 'سئو', tech: 'فنی', geo: 'GEO (موتور مولد)', aeo: 'AEO (پاسخ‌محور)' };
  const fallbackRule = (sev) => ({ impact: sev === 'critical' ? 9 : sev === 'high' ? 7 : sev === 'medium' ? 4 : 2, effort: 4, area: 'seo', fix: '' });
  const uniq = (a) => Array.from(new Set(a));

  /** Groups every finding by code with the pages it touches. */
  function groupFindings(report) {
    const m = new Map();
    const take = (i, pages) => {
      const g = m.get(i.code) || { code: i.code, severity: i.severity, title: i.title, detail: i.detail, urls: [] };
      g.urls.push(i.url); m.set(i.code, g);
    };
    ((report && report.pages) || []).forEach((p) => (p.issues || []).forEach((i) => take(i)));
    ((report && report.siteIssues) || []).forEach((i) => take(i));
    return Array.from(m.values()).map((g) => Object.assign(g, { urls: uniq(g.urls) }));
  }


  /* ---------------- real-user-style speed findings from a PageSpeed result ---------------- */
  const SPEED = [
    ['largest-contentful-paint', 'LCP کند است', 2500, 4000, 'speed_lcp', 8, 6, 'تصویر اصلی بالای صفحه را فشرده (WebP/AVIF) و preload کنید، کش و CDN فعال باشد.'],
    ['cumulative-layout-shift', 'پرش چیدمان (CLS)', 0.1, 0.25, 'speed_cls', 6, 4, 'برای تصاویر، بنرها و فونت‌ها width/height یا فضای ثابت تعریف کنید.'],
    ['interaction-to-next-paint', 'پاسخ‌دهی ضعیف (INP)', 200, 500, 'speed_inp', 7, 7, 'اسکریپت‌های سنگین و افزونه‌های اضافی را کم یا به تعویق (defer) بیندازید.'],
    ['total-blocking-time', 'زمان مسدودی زیاد (TBT)', 200, 600, 'speed_tbt', 5, 6, 'جاوااسکریپت غیرضروری را حذف کنید و اسکریپت‌های شخص‌ثالث را دیرتر بارگذاری کنید.']
  ];
  function speedActions(psi) {
    if (!psi || !psi.metrics) return [];
    const out = [];
    SPEED.forEach(([key, title, warn, bad, code, impact, effort, fix]) => {
      const m = psi.metrics[key]; const v = m && Number(m.numericValue); if (!m || !Number.isFinite(v) || v <= warn) return;
      out.push({ code, title, detail: 'مقدار اندازه‌گیری‌شده: ' + (m.displayValue || v) + ' (حد مطلوب: ' + warn + ')', severity: v > bad ? 'high' : 'medium', area: 'tech', areaLabel: 'سرعت', affected: 1, urls: psi.url ? [psi.url] : [], impact, effort, fix, autoFixable: false, penalty: v > bad ? 7 : 3 });
    });
    const perf = psi.scores && psi.scores.performance;
    if (perf != null && perf < 50 && !out.length) out.push({ code: 'speed_score', title: 'امتیاز عملکرد پایین', detail: 'امتیاز PageSpeed: ' + perf + ' از ۱۰۰', severity: 'high', area: 'tech', areaLabel: 'سرعت', affected: 1, urls: psi.url ? [psi.url] : [], impact: 7, effort: 6, fix: 'تصاویر را بهینه کنید، کش و فشرده‌سازی را فعال کنید و افزونه‌های سنگین را بازبینی کنید.', autoFixable: false, penalty: 7 });
    return out;
  }


  /* ---------------- GEO / AEO professional audit ---------------- */
  const share = (pages, fn) => { const n = Math.max(1, pages.length); return pages.filter(fn).length / n; };
  /** Weighted GEO audit from audited facts only. parts: label, got, max, note. */
  function geoAudit(report) {
    const pages = ((report && report.pages) || []).filter((p) => p.status < 400 && p.facts);
    if (!pages.length) return { score: 0, parts: [], ready: false };
    const home = pages[0].facts; const robots = (report && report.robots) || { found: false, bots: [] }; const flags = (report && report.flags) || {};
    const searchBots = (robots.bots || []).filter((b) => b.purpose !== 'training'); const blocked = searchBots.filter((b) => b.status === 'blocked').length;
    const articles = pages.filter((p) => p.facts.words >= 400 && !/^https?:\/\/[^/]+\/?$/.test(p.url));
    const types = new Set(pages.flatMap((p) => p.facts.schemaTypes || []));
    const parts = [];
    const add = (label, ratio, max, note) => parts.push({ label, got: Math.round(Math.max(0, Math.min(1, ratio)) * max), max, note });
    add('دسترسی خزنده‌های AI', !robots.found ? 0.5 : blocked ? Math.max(0, 1 - blocked / Math.max(1, searchBots.length)) : 1, 20, blocked ? blocked + ' خزندهٔ جستجو مسدود است' : 'مسدودی مهمی نیست');
    add('کشف‌پذیری (sitemap و llms.txt)', ((flags.sitemap ? 1 : 0) + (flags.llms ? 1 : 0)) / 2, 10, (flags.sitemap ? '' : 'sitemap ندارد. ') + (flags.llms ? '' : 'llms.txt ندارد.'));
    add('هویت برند (Organization/WebSite)', ((types.has('Organization') || types.has('LocalBusiness') || types.has('Store') ? 0.6 : 0) + (types.has('WebSite') ? 0.2 : 0) + (pages.some((p) => p.facts.sameAs) ? 0.2 : 0)), 15, types.size ? 'انواع schema: ' + Array.from(types).slice(0, 6).join('، ') : 'schema پیدا نشد');
    add('پوشش داده ساختاریافته', share(pages, (p) => p.facts.schema > 0), 10, '');
    add('آمادگی پاسخ‌گویی (FAQ، تیتر پرسشی، ساختار)', (share(pages, (p) => p.facts.hasFaq || p.facts.questionHeadings > 0) * 0.5 + share(pages, (p) => p.facts.lists > 0 || p.facts.tables > 0 || p.facts.h2 >= 2) * 0.5), 20, '');
    const trust = home.trust || {}; add('اعتماد و تجربه (E-E-A-T)', ((trust.about ? 0.3 : 0) + (trust.contact ? 0.3 : 0) + (trust.privacy ? 0.1 : 0) + (articles.length ? share(articles, (p) => p.facts.hasAuthor) * 0.3 : 0.3)), 15, (trust.about ? '' : 'لینک «دربارهٔ ما» دیده نشد. ') + (trust.contact ? '' : 'لینک «تماس» دیده نشد.'));
    add('تازگی (تاریخ انتشار)', articles.length ? share(articles, (p) => p.facts.hasDate) : 0.5, 10, '');
    const score = parts.reduce((n, x) => n + x.got, 0);
    return { score, parts, ready: true };
  }
  /** Site-level GEO actions derived from audited facts (kept out of the crawl issue list so scans stay unchanged). */
  function geoActions(report) {
    const pages = ((report && report.pages) || []).filter((p) => p.status < 400 && p.facts); if (!pages.length) return [];
    const home = pages[0]; const trust = home.facts.trust || {}; const types = new Set(pages.flatMap((p) => p.facts.schemaTypes || [])); const out = [];
    const mk = (code, title, detail, severity) => { const r = KB[code]; return { code, title, detail, severity, area: r.area, areaLabel: AREA[r.area], affected: 1, urls: [home.url], impact: r.impact, effort: r.effort, fix: r.fix, autoFixable: false, penalty: SEV_W[severity] * 1.5 }; };
    if (!(types.has('Organization') || types.has('LocalBusiness') || types.has('Store'))) out.push(mk('geo_no_org_schema', 'هویت برند در schema تعریف نشده', 'نوع Organization در هیچ صفحه‌ای دیده نشد.', 'medium'));
    if (!trust.about || !trust.contact) out.push(mk('geo_no_trust_pages', 'لینک «دربارهٔ ما» یا «تماس» در صفحهٔ اصلی دیده نشد', 'نشانه‌های اعتماد برای موتورهای پاسخ‌گو ضعیف است.', 'medium'));
    if (types.has('Organization') && !pages.some((p) => p.facts.sameAs)) out.push(mk('geo_no_sameas', 'پروفایل‌های رسمی برند (sameAs) معرفی نشده', 'به AI کمک می‌کند برند را با منابع معتبر تطبیق دهد.', 'low'));
    return out;
  }
  /** One copy-paste pack with every generated GEO/SEO asset, each with placement instructions. */
  function buildRebuildPack(report, opts) {
    const o = opts || {}; const L = []; const robots = suggestRobots(report, o); const faq = generateFaqSchema(report);
    L.push('# بستهٔ بازسازی ' + report.site, '', 'هر بخش را در جای گفته‌شده بگذارید و پس از آن بازرسی را دوباره اجرا کنید.', '');
    L.push('## ۱) llms.txt (ریشهٔ سایت: /llms.txt)', '```', generateLlmsTxt(report, o).trim(), '```', '');
    L.push('## ۲) robots.txt (خطوط زیر را به فایل فعلی اضافه کنید)', '```', robots.lines.length ? robots.text.trim() : '# تغییری لازم نیست', '```', robots.notes.length ? '\n' + robots.notes.map((x) => '- ' + x).join('\n') : '', '');
    L.push('## ۳) JSON-LD سازمان و وب‌سایت (داخل <head> همهٔ صفحات)', '```html', generateSchema(report, o), '```', '');
    L.push('## ۴) FAQPage (هر بلوک فقط در صفحهٔ خودش)', faq.length ? faq.map((x) => '### ' + x.url + '\n```html\n' + x.schema + '\n```').join('\n\n') : 'صفحه‌ای با حداقل دو پرسش‌وپاسخ واقعی پیدا نشد؛ ابتدا تیتر پرسشی و پاسخ کوتاه بنویسید.', '');
    L.push('---', 'تولید خودکار از داده‌های واقعی بازرسی؛ چیزی از خودش اختراع نمی‌کند و رتبه را تضمین نمی‌کند.');
    return L.join('\n') + '\n';
  }

  /**
   * Priority = severity-weighted impact × reach (share of pages, site-wide = 1) ÷ effort.
   * Returns tiers: now (quick wins), week, later; plus the share of the penalty each action removes.
   */
  function buildActionPlan(report, opts) {
    const o = opts || {};
    const pages = Math.max(1, ((report && report.pages) || []).length);
    const groups = groupFindings(report);
    const siteCodes = new Set(((report && report.siteIssues) || []).map((i) => i.code));
    const actions = groups.map((g) => {
      const rule = KB[g.code] || fallbackRule(g.severity);
      const reach = siteCodes.has(g.code) ? 1 : Math.min(1, g.urls.length / pages);
      const sevBoost = (SEV_W[g.severity] || 1) / 12;
      const raw = (rule.impact * (0.4 + 0.6 * reach) * (0.6 + sevBoost)) / Math.max(1, rule.effort);
      const penalty = (SEV_W[g.severity] || 1) * (siteCodes.has(g.code) ? 1.5 : g.urls.length);
      return { code: g.code, title: g.title, detail: g.detail, severity: g.severity, area: rule.area, areaLabel: AREA[rule.area] || '', affected: g.urls.length, urls: g.urls.slice(0, 20),
        impact: rule.impact, effort: rule.effort, priority: Math.round(raw * 100) / 100, fix: rule.fix || g.detail, autoFixable: !!rule.auto, penalty };
    }).sort((a, b) => b.priority - a.priority || b.impact - a.impact);
    geoActions(report).forEach((a) => { a.priority = Math.round(((a.impact * (0.4 + 0.6) * (0.6 + (SEV_W[a.severity] || 1) / 12)) / a.effort) * 100) / 100; actions.push(a); });
    speedActions(o.psi).forEach((a) => { a.priority = Math.round(((a.impact * (a.severity === 'high' ? 1.0 : 0.8)) / a.effort) * 100) / 100; actions.push(a); });
    actions.sort((a, b) => b.priority - a.priority || b.impact - a.impact);
    const totalPenalty = actions.reduce((n, a) => n + a.penalty, 0) || 1;
    actions.forEach((a) => { a.shareOfProblems = Math.round((a.penalty / totalPenalty) * 100); });
    const tier = (a) => (a.effort <= 3 && a.impact >= 5) ? 'now' : (a.impact >= 5 || a.severity === 'critical' || a.severity === 'high') ? 'week' : 'later';
    const tiers = { now: [], week: [], later: [] };
    actions.forEach((a) => { a.tier = tier(a); tiers[a.tier].push(a); });
    const cur = report && report.scores ? Number(report.scores.seo) : 0;
    const nowShare = tiers.now.reduce((n, a) => n + a.shareOfProblems, 0);
    const potential = Math.min(100, Math.round(cur + (100 - cur) * (nowShare / 100)));
    return { total: actions.length, actions, tiers, currentScore: cur, potentialScoreAfterQuickWins: potential,
      autoFixable: actions.filter((a) => a.autoFixable).length, headline: headline(actions, tiers, cur, potential, o.site || (report && report.site)) };
  }

  function headline(actions, tiers, cur, potential, site) {
    if (!actions.length) return 'مشکل مهمی پیدا نشد؛ روی محتوا و لینک‌سازی داخلی تمرکز کنید.';
    const first = actions[0];
    let t = 'اول «' + first.title + '» را درست کنید';
    if (tiers.now.length > 1) t += ' و سپس ' + (tiers.now.length - 1) + ' کار سریع دیگر';
    if (potential > cur) t += '؛ تخمین امتیاز سئو ' + cur + ' ← حدود ' + potential + ' (تخمین تشخیصی، نه تضمین رتبه)';
    return t + '.';
  }

  /* ---------------- ready-to-use files ---------------- */
  const path = (u) => { try { const x = new URL(u); return x.pathname + x.search; } catch (e) { return String(u || ''); } };
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').replace(/[\r\n]/g, ' ').trim();

  /** llms.txt draft in the llmstxt.org layout from audited, indexable, healthy pages. */
  function generateLlmsTxt(report, opts) {
    const o = opts || {}; if (!report) return '';
    const good = (report.pages || []).filter((p) => p.status < 400 && !(p.facts && p.facts.noindex) && p.facts && p.facts.title);
    const home = good.find((p) => path(p.url) === '/') || good[0];
    const name = clean(o.name || (home && home.facts.title.split(/[|\-–—]/)[0]) || report.site);
    const summary = clean(o.summary || (home && home.facts.description) || '');
    const lines = ['# ' + name, ''];
    if (summary) lines.push('> ' + summary, '');
    lines.push('## صفحات مهم', '');
    good.filter((p) => p !== home).sort((a, b) => (b.facts.words || 0) - (a.facts.words || 0)).slice(0, o.max || 15).forEach((p) => {
      lines.push('- [' + clean(p.facts.title).replace(/[\[\]]/g, '') + '](' + p.url + ')' + (p.facts.description ? ': ' + clean(p.facts.description).slice(0, 140) : ''));
    });
    return lines.join('\n') + '\n';
  }

  /** robots.txt additions: unblock AI search bots (never training bots unless the owner opts in) + sitemap line. */
  function suggestRobots(report, opts) {
    const o = opts || {}; const r = report && report.robots; const out = { lines: [], notes: [] };
    if (!r || !r.found) { out.lines.push('User-agent: *', 'Allow: /'); out.notes.push('robots.txt وجود نداشت؛ حداقل نسخهٔ امن ساخته شد.'); }
    ((r && r.bots) || []).filter((b) => b.status === 'blocked').forEach((b) => {
      if (b.purpose === 'training' && !o.allowTraining) { out.notes.push(b.id + ' (آموزش مدل) عمداً بسته ماند؛ تصمیم با شماست.'); return; }
      out.lines.push('', 'User-agent: ' + b.id, 'Allow: /');
    });
    const sm = (r && r.sitemaps && r.sitemaps[0]) || (report && report.origin ? report.origin.replace(/\/?$/, '/') + 'sitemap.xml' : '');
    if (sm && !(r && r.sitemaps && r.sitemaps.length)) out.lines.push('', 'Sitemap: ' + sm);
    out.text = out.lines.join('\n').trim() + '\n';
    return out;
  }

  /** Organization + WebSite JSON-LD template filled only with audited facts (no invented data). */
  function generateSchema(report, opts) {
    const o = opts || {}; if (!report) return '';
    const home = (report.pages || [])[0] || { facts: {} };
    const name = clean(o.name || (home.facts.title || report.site).split(/[|\-–—]/)[0]);
    const base = report.origin || ('https://' + report.site + '/');
    const data = { '@context': 'https://schema.org', '@graph': [
      { '@type': 'Organization', '@id': base + '#org', name, url: base },
      { '@type': 'WebSite', '@id': base + '#site', url: base, name, inLanguage: home.facts.lang || 'fa', publisher: { '@id': base + '#org' } }
    ] };
    return '<script type="application/ld+json">\n' + JSON.stringify(data, null, 2) + '\n</script>';
  }


  /** FAQPage JSON-LD built only from question headings + the paragraph that really follows them on the page. */
  function generateFaqSchema(report, opts) {
    const o = opts || {}; const out = [];
    ((report && report.pages) || []).forEach((p) => {
      const qa = (p.facts && p.facts.qa) || []; if (qa.length < 2 || (p.facts && p.facts.noindex)) return;
      const data = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qa.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) };
      out.push({ url: p.url, count: qa.length, schema: '<script type="application/ld+json">\n' + JSON.stringify(data, null, 2) + '\n</script>' });
    });
    return out.slice(0, o.max || 20);
  }

  /** Worst pages first: weighted issue load per page, with the top fixes for each. */
  function worstPages(report, limit) {
    return ((report && report.pages) || []).map((p) => {
      const load = (p.issues || []).reduce((n, i) => n + (SEV_W[i.severity] || 1), 0);
      const top = (p.issues || []).slice().sort((a, b) => (SEV_W[b.severity] || 1) - (SEV_W[a.severity] || 1)).slice(0, 3).map((i) => i.title);
      return { url: p.url, load, issues: (p.issues || []).length, top };
    }).filter((x) => x.load > 0).sort((a, b) => b.load - a.load).slice(0, limit || 8);
  }

  /** Shareable Persian Markdown report: scores, action plan, worst pages, trend. */
  function exportMarkdown(report, opts) {
    const o = opts || {}; const plan = buildActionPlan(report); const L = [];
    L.push('# گزارش بازرسی ' + report.site, '', 'تاریخ: ' + new Date(report.at || Date.now()).toISOString().slice(0, 10), '',
      '- امتیاز سئو: ' + report.scores.seo + ' از ۱۰۰', '- آمادگی AI: ' + report.scores.ai + ' از ۱۰۰', '- صفحات بررسی‌شده: ' + (report.pages || []).length, '', '> ' + plan.headline, '');
    if (o.diff && o.diff.ready) L.push('## روند نسبت به بازرسی قبل', '', '- تغییر سئو: ' + o.diff.seoDelta, '- مشکل رفع‌شده: ' + o.diff.fixed.length, '- مشکل جدید: ' + o.diff.added.length, '');
    [['now', 'همین امروز'], ['week', 'این هفته'], ['later', 'بعداً']].forEach(([k, t]) => { if (!plan.tiers[k].length) return; L.push('## ' + t, ''); plan.tiers[k].forEach((a) => L.push('- **' + a.title + '** (' + a.affected + ' مورد، اثر ' + a.impact + '/۱۰، تلاش ' + a.effort + '/۱۰): ' + a.fix)); L.push(''); });
    const w = worstPages(report, 8); if (w.length) { L.push('## ضعیف‌ترین صفحات', ''); w.forEach((x) => L.push('- ' + x.url + ' — ' + x.top.join('، '))); L.push(''); }
    L.push('---', 'برآوردها تشخیصی‌اند و رتبهٔ گوگل را تضمین نمی‌کنند.');
    return L.join('\n') + '\n';
  }

  /* ---------------- trend between audits ---------------- */
  /** Compact snapshot stored in history: issue code -> affected count + scores. */
  function snapshot(report) {
    const issues = {}; groupFindings(report).forEach((g) => { issues[g.code] = g.urls.length; });
    return { at: report.at || Date.now(), seo: report.scores.seo, ai: report.scores.ai, pages: (report.pages || []).length, issues };
  }
  function diffSnapshots(prev, cur) {
    if (!prev || !cur) return { ready: false, fixed: [], added: [], improved: [], worsened: [], seoDelta: 0, aiDelta: 0 };
    const p = prev.issues || {}, c = cur.issues || {}; const fixed = [], added = [], improved = [], worsened = [];
    Object.keys(p).forEach((k) => { if (!(k in c)) fixed.push(k); else if (c[k] < p[k]) improved.push({ code: k, from: p[k], to: c[k] }); else if (c[k] > p[k]) worsened.push({ code: k, from: p[k], to: c[k] }); });
    Object.keys(c).forEach((k) => { if (!(k in p)) added.push(k); });
    return { ready: true, fixed, added, improved, worsened, seoDelta: cur.seo - prev.seo, aiDelta: cur.ai - prev.ai };
  }

  /* ---------------- Search Console opportunities ---------------- */
  const EXPECTED_CTR = [0.28, 0.15, 0.10, 0.07, 0.05, 0.04, 0.03, 0.025, 0.02, 0.018]; // typical organic CTR by position 1..10
  const expCtr = (pos) => EXPECTED_CTR[Math.min(9, Math.max(0, Math.round(pos) - 1))];
  /** rows: GSC rows {keys,key,clicks,impressions,ctr,position}. Finds striking-distance and CTR-gap queries. */
  function searchOpportunities(rows, opts) {
    const o = opts || {}; const minImp = o.minImpressions || 50;
    const list = (Array.isArray(rows) ? rows : []).filter((r) => r && r.impressions >= minImp && r.position > 0);
    const striking = list.filter((r) => r.position > 3.5 && r.position <= 20).map((r) => {
      const target = expCtr(Math.max(3, Math.round(r.position) - 3)); const gain = Math.max(0, Math.round(r.impressions * target - r.clicks));
      return { query: r.key || (r.keys || []).join(' · '), position: Math.round(r.position * 10) / 10, impressions: r.impressions, clicks: r.clicks, estimatedExtraClicks: gain,
        action: r.position <= 10 ? 'عنوان و توضیحات را جذاب‌تر و محتوا را کامل‌تر کنید تا به ۳ نتیجهٔ اول برسد.' : 'محتوای اختصاصی‌تر بنویسید و از صفحات مرتبط لینک داخلی بدهید تا به صفحهٔ اول برسد.' };
    }).sort((a, b) => b.estimatedExtraClicks - a.estimatedExtraClicks).slice(0, o.limit || 10);
    const ctrGap = list.filter((r) => r.position <= 10).map((r) => ({ r, gap: expCtr(r.position) - r.ctr })).filter((x) => x.gap >= 0.015 && x.r.ctr < expCtr(x.r.position) * 0.6).map((x) => ({
      query: x.r.key || (x.r.keys || []).join(' · '), position: Math.round(x.r.position * 10) / 10, ctr: Math.round(x.r.ctr * 1000) / 10, expectedCtr: Math.round(expCtr(x.r.position) * 1000) / 10,
      estimatedExtraClicks: Math.round(x.gap * x.r.impressions), action: 'عنوان/توضیحات متا با این عبارت هماهنگ و جذاب‌تر شود (مثلاً عدد، مزیت یا سال).' })).sort((a, b) => b.estimatedExtraClicks - a.estimatedExtraClicks).slice(0, o.limit || 10);
    return { ready: list.length > 0, striking, ctrGap, totalEstimatedExtraClicks: striking.reduce((n, x) => n + x.estimatedExtraClicks, 0) + ctrGap.reduce((n, x) => n + x.estimatedExtraClicks, 0), note: 'برآورد بر پایهٔ منحنی میانگین CTR است و تضمین نتیجه نیست.' };
  }


  /* ---------------- explanations: optional on-device model, always with a rule-based fallback ---------------- */
  const STEPS = {
    seo: ['صفحهٔ ویرایش را در پیشخوان باز کنید.', 'بخش سئو (Yoast/RankMath) را پیدا کنید.', 'مقدار پیشنهادی را بنویسید و ذخیره کنید.', 'پس از چند ساعت بازرسی را تکرار کنید تا رفع‌شدن را ببینید.'],
    tech: ['از سایت یک نسخهٔ پشتیبان بگیرید.', 'تنظیم را در قالب یا افزونهٔ مربوط اعمال کنید.', 'یک صفحه را در موبایل و آدرس‌بار بررسی کنید.', 'بازرسی را دوباره اجرا کنید.'],
    geo: ['نمونهٔ آمادهٔ همین برنامه را کپی کنید.', 'آن را در هدر سایت یا ریشهٔ هاست بگذارید.', 'با ابزار آزمون Rich Results گوگل اعتبارسنجی کنید.', 'بازرسی را دوباره اجرا کنید.'],
    aeo: ['برای سؤال‌های واقعی کاربران تیتر پرسشی بنویسید.', 'زیر هر تیتر پاسخ مستقیم ۲ تا ۳ جمله‌ای بگذارید.', 'سپس «کپی FAQ Schema» را بزنید و در صفحه قرار دهید.']
  };
  function explainFallback(a) {
    const ex = (a.urls || []).slice(0, 3).map((u) => '- ' + u).join('\n');
    return ['چرا مهم است: ' + (a.detail || a.title), 'چه کنید: ' + (a.fix || ''), 'گام‌ها:', (STEPS[a.area] || STEPS.seo).map((x, i) => (i + 1) + '. ' + x).join('\n'), ex ? 'نمونه صفحات:\n' + ex : ''].filter(Boolean).join('\n');
  }
  function explainMessages(a, site) {
    return [{ role: 'system', content: 'تو مشاور سئوی فارسی‌زبان هستی. کوتاه، دقیق و عملی بنویس. هیچ آمار یا وعدهٔ رتبه نساز و فقط از داده‌های داده‌شده استفاده کن.' },
      { role: 'user', content: 'سایت: ' + (site || '') + '\nمشکل: ' + a.title + '\nجزئیات: ' + (a.detail || '') + '\nتعداد صفحات درگیر: ' + a.affected + '\nنمونه نشانی‌ها:\n' + (a.urls || []).slice(0, 3).join('\n') + '\nراه‌حل پایه: ' + (a.fix || '') + '\n\nدر حداکثر ۶ خط فارسی توضیح بده چرا مهم است و دقیقاً چه کار کنم.' }];
  }


  /* ---------------- free auto-pilot: scheduling + digest (no API, no model required) ---------------- */
  const AP_INTERVALS = [6, 24, 168];
  function autoPilotDue(state, now) {
    const st = state || {}; if (!st.enabled) return false;
    const h = AP_INTERVALS.includes(Number(st.intervalHours)) ? Number(st.intervalHours) : 24;
    return (now || Date.now()) - Number(st.lastRun || 0) >= h * 3600 * 1000;
  }
  /** Plain-language digest of one automatic cycle. level: ok | warn | alert. */
  function buildDigest(ctx) {
    const c = ctx || {}; const L = []; let level = 'ok';
    if (c.error) return { level: 'alert', text: '⚠️ بازرسی خودکار انجام نشد: ' + c.error + '\nسایت یا اینترنت را بررسی کنید.', next: '' };
    const a = c.after, b = c.before; const plan = c.plan;
    if (b && a) { const d = a.scores.seo - b.scores.seo; L.push('امتیاز سئو: ' + b.scores.seo + ' ← ' + a.scores.seo + (d ? ' (' + (d > 0 ? '+' : '') + d + ')' : ' (بدون تغییر)')); if (d <= -5) level = 'alert'; }
    else if (a) L.push('امتیاز سئو: ' + a.scores.seo + ' · آمادگی AI: ' + a.scores.ai);
    const diff = c.diff; if (diff && diff.ready) { if (diff.added.length) { L.push('مشکل جدید: ' + diff.added.length); if (level === 'ok') level = 'warn'; } if (diff.fixed.length) L.push('مشکل رفع‌شده: ' + diff.fixed.length); }
    if (a && a.counts.critical > 0) { L.push('مشکل بحرانی: ' + a.counts.critical); level = 'alert'; }
    if (c.geo && c.geo.ready) L.push('امتیاز GEO/AEO: ' + c.geo.score + ' از ۱۰۰');
    if (c.rebuild) L.push(c.rebuild.applied ? 'بازسازی امن سئو: ' + c.rebuild.applied + ' اصلاح اعمال شد' : 'بازسازی امن سئو: موردی برای اصلاح نبود');
    const next = plan && plan.actions.length ? plan.actions[0] : null;
    if (next) L.push('مهم‌ترین قدم بعدی: ' + next.title + ' — ' + next.fix);
    else L.push('مشکل مهمی باقی نمانده است ✓');
    return { level, text: L.join('\n'), next: next ? next.code : '' };
  }

  /** Short plain-text brief, also usable as context for the (optional) on-device model. */
  function toBrief(plan, limit) {
    return plan.actions.slice(0, limit || 6).map((a, i) => (i + 1) + '. ' + a.title + ' (' + a.affected + ' مورد، اثر ' + a.impact + '/۱۰، تلاش ' + a.effort + '/۱۰): ' + a.fix).join('\n');
  }

  return { KB, buildActionPlan, groupFindings, generateLlmsTxt, suggestRobots, geoAudit, geoActions, buildRebuildPack, autoPilotDue, buildDigest, speedActions, explainFallback, explainMessages, generateSchema, generateFaqSchema, worstPages, exportMarkdown, snapshot, diffSnapshots, searchOpportunities, toBrief };
});
