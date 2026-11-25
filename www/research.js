/* Built-in public-web research helpers. No AI API key: the WordPress Bridge supplies public RSS results. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.SI.Research = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const FA_STOP = new Set(['برای','از','در','به','با','و','یا','را','این','آن','یک','های','است','چیست','چگونه','چطور','درباره','آخرین','جدیدترین','اطلاعات','تحقیق','پژوهش','جستجو','منابع','خارجی']);
  const MAP = [
    [/جستجوی هوش مصنوعی|جستجو با هوش مصنوعی|هوش مصنوعی/gi, 'AI search'], [/بهینه سازی موتور پاسخ|موتور پاسخ/gi, 'answer engine optimization'],
    [/جی\s*ای\s*او|\bgeo\b/gi, 'GEO'], [/ای\s*ای\s*او|\baeo\b/gi, 'AEO'], [/سئو/gi, 'SEO'],
    [/داده ساختاریافته|اسکیما/gi, 'structured data schema'], [/کلمات کلیدی|تحقیق کلمه/gi, 'keyword research'],
    [/رقبا|رقیب/gi, 'competitor analysis'], [/کافی شاپ|کافه/gi, 'coffee shop'], [/قهوه/gi, 'coffee'],
    [/فروشگاه اینترنتی|فروشگاه آنلاین|ووکامرس/gi, 'ecommerce WooCommerce'], [/محتوا|مقاله/gi, 'content strategy'],
    [/لینک سازی/gi, 'link building'], [/جستجوی محلی|سئو محلی/gi, 'local SEO'], [/نمای کلی هوش مصنوعی/gi, 'Google AI Overviews'],
    [/گوگل/gi, 'Google'], [/بینگ/gi, 'Bing'],
  ];
  function normalizeQuery(s) {
    let q = String(s || '').trim(); MAP.forEach(([re, value]) => { q = q.replace(re, value); });
    q = q.replace(/[^\p{L}\p{N}"+\-\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    return q.slice(0, 180) || 'SEO GEO AEO AI search optimization';
  }
  function isCompareRequest(s) { return /(مقایسه|ربط.*سایت|وضعیت سایت|با سایت من|با داده های سایت|با داده‌های سایت)/i.test(String(s || '')); }
  function isRequest(s) {
    const t = String(s || '').toLowerCase();
    return /(تحقیق|پژوهش|جستجو|جمع آوری|جمع‌آوری).{0,35}(اینترنت|وب|خارجی|منبع|رقیب|بازار|ترند|اطلاعات|seo|geo|aeo)|منابع خارجی|سایت های خارجی|سایت‌های خارجی|از اینترنت|در اینترنت|آخرین تغییرات|جدیدترین اخبار|اطلاعات روز دنیا|تحلیل رقبا/.test(t)
      || /\b(research|web search|search the web|foreign sources|competitor research)\b/i.test(t);
  }
  function compare(data, report, brief, log) {
    const rows = Array.isArray(data && data.results) ? data.results : [];
    const lines = ['**مقایسهٔ یافته‌های خارجی با وضعیت سایت**'];
    if (!report) lines.push('هنوز گزارش فنی سایت در اپ وجود ندارد؛ ابتدا سایت را از بخش رادار اسکن کن تا این مقایسه از حالت عمومی به وضعیت واقعی سایت متصل شود.');
    else {
      if (report.scores) lines.push(`امتیازهای داخلی فعلی: SEO ${report.scores.seo ?? '—'}، AI/GEO ${report.scores.ai ?? '—'}؛ این‌ها شاخص‌های داخلی اپ هستند، نه رتبهٔ موتور جستجو.`);
      const issues = Array.isArray(report.pages) ? report.pages.flatMap((p) => (p.issues || []).map((i) => i.title || i.code)) : [];
      if (Array.isArray(report.siteIssues)) report.siteIssues.forEach((i) => issues.push(i.title || i.code));
      lines.push(issues.length ? `موارد فنی ثبت‌شده در سایت: ${Array.from(new Set(issues)).slice(0, 8).join('، ')}.` : 'در گزارش موجود، مشکل فنی برجسته‌ای ثبت نشده است.');
    }
    if (brief && brief.site) lines.push(`زمینهٔ وردپرس: ${brief.site.name || 'سایت متصل'}؛ این نام فقط از اطلاعات سایت خوانده شده است.`);
    if (rows.length) {
      lines.push('موضوعاتی که در منابع خارجیِ بازیابی‌شده بیشتر دیده می‌شوند:');
      rows.slice(0, 6).forEach((r, i) => lines.push(`${i + 1}. ${r.title} — ${r.source || r.domain || 'منبع خارجی'}`));
    } else lines.push('پژوهش قبلی نتیجه‌ای نداشت؛ ابتدا یک جستجوی وب انجام بده.');
    lines.push('**گام بعدی امن:** این موارد را به‌عنوان سرنخ تحقیق در نظر بگیر؛ هیچ موضوعی صرفاً به‌دلیل انتشار در یک منبع خارجی به صفحهٔ سایت اضافه یا به‌صورت خودکار اعمال نمی‌شود. برای تصمیم عملی باید متن منبع، ارتباط با مشتریان و داده‌های واقعی Search Console/Analytics بررسی شوند.');
    return lines.join('\n\n');
  }
  function summarize(data) {
    const rows = Array.isArray(data && data.results) ? data.results : [];
    const sources = Array.isArray(data && data.sources) ? data.sources : [];
    const dated = rows.filter((x) => x.published).length;
    const fresh = rows.filter((x) => x.published && Date.now() - Date.parse(x.published) < 30 * 86400000).length;
    const lines = [
      `**پژوهش وب انجام شد.** ${rows.length} نتیجه از ${sources.length} منبع/فید عمومی دریافت شد.`,
      `**موضوع جستجو:** ${data && data.query ? data.query : '—'}`,
      `**منابع بررسی‌شده:** ${sources.join('، ') || 'منبع قابل‌دسترسی نبود'}`,
    ];
    if (rows.length) {
      lines.push(`**تازگی داده‌ها:** ${fresh} نتیجه از ۳۰ روز اخیر؛ تاریخ انتشار برای ${dated} نتیجه قابل‌شناسایی بود.`);
      lines.push('**نتایج برجسته:**');
      rows.slice(0, 5).forEach((r, i) => lines.push(`${i + 1}. ${r.title} — ${r.source || r.domain || 'منبع خارجی'}${r.published ? ' (' + new Date(r.published).toLocaleDateString('fa-IR') + ')' : ''}`));
    } else lines.push('برای این عبارت، نتیجهٔ قابل‌نمایشی از فیدهای عمومی به دست نیامد. می‌توانی عبارت دقیق‌تر یا معادل انگلیسی آن را امتحان کنی.');
    if (data && Array.isArray(data.warnings) && data.warnings.length) lines.push('**محدودیت دریافت:** ' + data.warnings.slice(0, 5).join('؛ '));
    lines.push('**ملاحظه:** امتیاز ارتباط، تخمین محلی است؛ خلاصهٔ RSS جای خواندن مقالهٔ کامل را نمی‌گیرد. قبل از تبدیل هر یافته به تغییر سایت، منبع اصلی را باز کن و صحت، تاریخ و ارتباط آن با کسب‌وکار را بررسی کن.');
    return lines.join('\n\n');
  }
  return { normalizeQuery, isRequest, isCompareRequest, compare, summarize };
});
