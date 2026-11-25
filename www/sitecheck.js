/* Site Inspector — sitecheck.js (v1.62.0)
 * بررسی‌های سطح سایت (robots.txt، نقشهٔ سایت، llms.txt) و امتیاز جداگانه برای هر حوزهٔ سئو.
 * فقط از متن واقعاً دریافت‌شده نتیجه می‌گیرد؛ اگر فایلی دریافت نشده باشد دربارهٔ آن حکمی نمی‌دهد. UMD. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SI = root.SI || {}, root.SI.SiteCheck = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const hostN = (h) => String(h || '').replace(/^www\./i, '').toLowerCase();
  const KNOWN = new Set(['user-agent', 'allow', 'disallow', 'sitemap', 'crawl-delay', 'host', 'clean-param', 'noindex', 'request-rate', 'visit-time', 'content-signal']);

  /* v1.64: تطبیق robots مثل گوگل (گروه‌های هم‌نام ادغام، طولانی‌ترین قاعده، Allow در تساوی، * و $) */
  function rGroups(text) {
    const gs = []; let cur = null, last = false;
    String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).forEach((raw) => {
      const l = raw.replace(/#.*$/, '').trim(); const i = l.indexOf(':'); if (i < 0) return;
      const k = l.slice(0, i).trim().toLowerCase(), v = l.slice(i + 1).trim();
      if (k === 'user-agent') { if (!cur || !last) { cur = { agents: [], rules: [] }; gs.push(cur); } cur.agents.push(v.toLowerCase()); last = true; return; }
      last = false; if (cur && (k === 'allow' || k === 'disallow')) cur.rules.push({ type: k, path: v });
    });
    return gs;
  }
  function rRulesFor(gs, agent) {
    const exact = gs.filter((g) => g.agents.includes(agent)); const use = exact.length ? exact : gs.filter((g) => g.agents.includes('*'));
    return use.reduce((a, g) => a.concat(g.rules), []);
  }
  function rRe(p) { return new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$')); }
  function rAllowed(rules, path) {
    let best = null, bl = -1;
    rules.forEach((r) => { if (!r.path) return; let re; try { re = rRe(r.path); } catch (e) { return; } if (!re.test(path)) return; if (r.path.length > bl || (r.path.length === bl && r.type === 'allow')) { best = r; bl = r.path.length; } });
    return !best || best.type === 'allow';
  }
  const W3C_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

  function audit(o) {
    o = o || {}; const out = []; let origin = ''; try { origin = new URL(o.origin).origin; } catch (e) {}
    const add = (code, severity, title, detail, url) => out.push({ code, severity, title, detail, url: url || origin + '/' });
    const rob = o.robotsText == null ? null : String(o.robotsText); let gRules = null;
    if (rob !== null) {
      const ru = origin + '/robots.txt';
      if (/^\s*<(!doctype|html)/i.test(rob.slice(0, 200))) add('robots_html', 'medium', 'robots.txt به‌جای متن، صفحهٔ HTML برمی‌گرداند', 'احتمالاً خطای ۴۰۴ نرم، فایروال یا ریدایرکت است؛ موتورها قواعد شما را نمی‌بینند.', ru);
      else {
        if (new TextEncoder().encode(rob).length > 500 * 1024) add('robots_large', 'medium', 'حجم robots.txt بیش از ۵۰۰ کیلوبایت است', 'گوگل فقط ۵۰۰ کیلوبایت اول را می‌خواند و بقیهٔ قواعد نادیده گرفته می‌شود.', ru);
        const lines = rob.replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean);
        let curStar = false, lastAgent = false; const star = []; const unknown = []; let delay = false, noindex = false, httpSm = false;
        lines.forEach((l) => {
          const i = l.indexOf(':'); if (i < 0) { unknown.push(l.slice(0, 30)); return; }
          const k = l.slice(0, i).trim().toLowerCase(), v = l.slice(i + 1).trim();
          if (!KNOWN.has(k)) unknown.push(k);
          if (k === 'user-agent') { if (!lastAgent) curStar = false; if (v === '*') curStar = true; lastAgent = true; return; }
          lastAgent = false;
          if (k === 'crawl-delay') delay = true; if (k === 'noindex') noindex = true; if (k === 'sitemap' && /^http:\/\//i.test(v) && /^https:/i.test(origin)) httpSm = true;
          if (curStar && (k === 'disallow' || k === 'allow')) star.push({ k, v });
        });
        const dis = (re) => star.some((r) => r.k === 'disallow' && re.test(r.v)) && !star.some((r) => r.k === 'allow' && re.test(r.v));
        if (dis(/^\/wp-(content|includes)\/?$|^\/wp-content\/(themes|plugins)\/?$/i)) add('robots_blocks_wp_assets', 'medium', 'robots.txt پوشهٔ wp-content یا wp-includes را می‌بندد', 'گوگل برای رندر صفحه به CSS/JS این پوشه‌ها نیاز دارد؛ بستن آن‌ها رندر موبایل و رتبه را خراب می‌کند.', ru);
        if (dis(/^\/wp-content\/uploads\/?/i)) add('robots_blocks_images', 'medium', 'robots.txt پوشهٔ uploads (تصاویر) را می‌بندد', 'تصاویر محصول و مقاله در جستجوی تصویر گوگل نمایه نمی‌شوند.', ru);
        gRules = rRulesFor(rGroups(rob), 'googlebot');
        if (gRules.some((r) => r.type === 'disallow' && r.path) && !rAllowed(gRules, '/') && !gRules.some((r) => r.type === 'allow' && r.path && r.path !== '/' && r.path !== '/*')) add('robots_blocks_all', 'critical', 'robots.txt کل سایت را برای گوگل می‌بندد', 'قاعدهٔ Disallow: / ریشه را کاملاً بسته است؛ هیچ صفحه‌ای خزیده نمی‌شود و کم‌کم از نتایج حذف می‌شود. اگر سایت در حال توسعه نیست، فوراً اصلاح کنید.', ru);
        if (gRules.some((r) => r.type === 'disallow' && /\.(css|js)\$?$/i.test(r.path) && /[*$]/.test(r.path)) && !gRules.some((r) => r.type === 'allow' && /\.(css|js)\$?$/i.test(r.path))) add('robots_blocks_css_js', 'medium', 'robots.txt فایل‌های CSS یا JS را می‌بندد', 'گوگل برای رندر درست صفحه به این فایل‌ها نیاز دارد؛ بستن آن‌ها می‌تواند فهم موبایل‌فرندلی و ظاهر صفحه را خراب کند.', ru);
        if (delay) add('robots_crawl_delay', 'low', 'Crawl-delay تعریف شده است', 'گوگل آن را نادیده می‌گیرد ولی Bing و بعضی خزنده‌ها را کند می‌کند؛ فقط در صورت نیاز واقعی نگه دارید.', ru);
        if (noindex) add('robots_noindex_directive', 'low', 'دستور Noindex در robots.txt', 'گوگل از ۲۰۱۹ این دستور را پشتیبانی نمی‌کند؛ برای noindex از meta robots یا هدر X-Robots-Tag استفاده کنید.', ru);
        if (httpSm) add('robots_http_sitemap', 'low', 'نشانی Sitemap در robots.txt با http است', 'سایت HTTPS است ولی نقشهٔ سایت با http معرفی شده؛ نشانی https بگذارید.', ru);
        if (unknown.length) add('robots_unknown_directive', 'low', 'robots.txt دستور یا خط نامعتبر دارد', unknown.slice(0, 4).join('، ') + (unknown.length > 4 ? ' و ' + (unknown.length - 4) + ' مورد دیگر' : '') + ' — احتمال غلط املایی است و موتور آن را نادیده می‌گیرد.', ru);
      }
    }
    const sm = o.sitemapText == null ? null : String(o.sitemapText);
    if (sm !== null && /<(urlset|sitemapindex)/i.test(sm)) {
      const su = o.sitemapUrl || origin + '/sitemap.xml'; const isIndex = /<sitemapindex/i.test(sm);
      const blocks = isIndex ? [] : (sm.match(/<url\b[\s\S]*?<\/url>/gi) || []);
      const locs = []; sm.replace(/<loc>\s*([^<\s][^<]*?)\s*<\/loc>/gi, (_, u) => { locs.push(u.replace(/&amp;/g, '&').trim()); return ''; });
      if (!locs.length) add('sitemap_empty', 'high', 'نقشهٔ سایت هیچ نشانی ندارد', 'فایل معتبر است ولی خالی است؛ موتورها از آن چیزی کشف نمی‌کنند.', su);
      if (!isIndex) {
        if (locs.length > 50000) add('sitemap_too_many', 'high', 'نقشهٔ سایت بیش از ۵۰٬۰۰۰ نشانی دارد', 'حد مجاز هر فایل ۵۰ هزار نشانی است؛ آن را به چند نقشهٔ فرعی (sitemapindex) بشکنید.', su);
        const dup = locs.length - new Set(locs).size; if (dup) add('sitemap_duplicate_urls', 'low', 'نشانی تکراری در نقشهٔ سایت', dup + ' نشانی بیش از یک بار آمده است.', su);
        if (/^https:/i.test(origin)) { const h = locs.filter((u) => /^http:\/\//i.test(u)).length; if (h) add('sitemap_http_urls', 'medium', 'نقشهٔ سایت نشانی http دارد', h + ' نشانی با http است ولی سایت HTTPS است؛ باید https باشند.', su); }
        const oh = hostN(new URL(origin || 'https://x.invalid').host); const foreign = locs.filter((u) => { try { return hostN(new URL(u).host) !== oh; } catch (e) { return false; } }).length;
        if (origin && foreign) add('sitemap_foreign_host', 'medium', 'نقشهٔ سایت نشانی دامنهٔ دیگر دارد', foreign + ' نشانی متعلق به دامنهٔ دیگری است؛ موتورها آن‌ها را نادیده می‌گیرند.', su);
        const junk = locs.filter((u) => /[?#]|\/(feed|wp-json|cart|checkout|my-account|wp-admin|tag\/|author\/)/i.test(u)).length;
        if (locs.length >= 10 && junk / locs.length >= 0.1) add('sitemap_junk_urls', 'low', 'نقشهٔ سایت نشانی‌های کم‌ارزش دارد', junk + ' نشانی پارامتری، فید، سبد خرید یا برچسب؛ نقشه باید فقط صفحه‌های قابل‌نمایهٔ مهم را داشته باشد.', su);
        if (gRules) { const oh0 = hostN(new URL(origin || 'https://x.invalid').host); const blockedN = locs.filter((u) => { try { const x = new URL(u); if (hostN(x.host) !== oh0) return false; return !rAllowed(gRules, x.pathname + x.search); } catch (e) { return false; } }).length; if (blockedN) add('sitemap_blocked_by_robots', 'high', 'نشانی‌های نقشهٔ سایت در robots.txt بسته‌اند', blockedN + ' نشانی هم در نقشهٔ سایت هست و هم برای گوگل در robots.txt ممنوع است؛ این دو پیام متناقض است. یکی را اصلاح کنید.', su); }
        const badDates = blocks.map((b) => (b.match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/i) || [])[1]).filter((d) => d && !W3C_DATE.test(d)).length;
        if (badDates) add('sitemap_bad_lastmod', 'low', 'قالب lastmod استاندارد نیست', badDates + ' تاریخ با قالب W3C (مثل 2026-01-31 یا 2026-01-31T10:00:00+03:30) نوشته نشده و گوگل آن را نادیده می‌گیرد.', su);
        if (blocks.length >= 5) {
          const dates = blocks.map((b) => (b.match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/i) || [])[1]).filter(Boolean);
          if (!dates.length) add('sitemap_no_lastmod', 'low', 'نقشهٔ سایت lastmod ندارد', 'تاریخ آخرین تغییر به گوگل کمک می‌کند صفحه‌های تازه‌شده را زودتر دوباره بخزد.', su);
          else {
            if (blocks.length >= 10 && dates.length >= 10 && new Set(dates).size === 1) add('sitemap_fake_lastmod', 'low', 'همهٔ lastmodها یکسان است', 'همهٔ صفحه‌ها یک تاریخ دارند (احتمالاً تاریخ تولید فایل)؛ گوگل lastmod نادرست را نادیده می‌گیرد.', su);
            const fut = dates.filter((d) => { const t = Date.parse(d); return t && t > Date.now() + 2 * 864e5; }).length;
            if (fut) add('sitemap_future_lastmod', 'low', 'lastmod در آینده است', fut + ' صفحه تاریخ آینده دارد؛ تنظیم ساعت یا منطقهٔ زمانی سرور را بررسی کنید.', su);
          }
        }
      }
    }
    const ll = o.llmsText == null ? null : String(o.llmsText).trim();
    if (ll && ll.length > 20 && !/<html/i.test(ll.slice(0, 300))) {
      const lu = origin + '/llms.txt';
      if (!/^#\s+\S/.test(ll)) add('llms_no_title', 'low', 'llms.txt با عنوان (# نام سایت) شروع نمی‌شود', 'قالب استاندارد با یک تیتر سطح ۱ شروع می‌شود و بعد خلاصه و فهرست لینک‌ها می‌آید.', lu);
      if (!/\[[^\]]+\]\(https?:\/\/[^)]+\)/.test(ll)) add('llms_no_links', 'low', 'llms.txt لینک مارک‌داون ندارد', 'فهرست صفحه‌های مهم به‌صورت [عنوان](نشانی) باشد تا مدل‌ها مسیر محتوا را بیابند.', lu);
      if (ll.length < 120) add('llms_thin', 'low', 'llms.txt خیلی کوتاه است', 'کمتر از ۱۲۰ نویسه؛ معرفی کوتاه سایت و چند لینک کلیدی اضافه کنید.', lu);
    }
    return out;
  }

  /* ---------- امتیاز هر حوزه ---------- */
  const AREAS = {
    tech: ['فنی و خزش', 'http_error not_html soft_404 noindex canonical_http canonical_offsite canonical_other multi_canonical no_canonical canonical_params no_viewport no_lang lang_mismatch no_rtl no_charset no_favicon no_apple_touch_icon http_internal_links meta_refresh large_html big_dom render_blocking_scripts js_rendered nofollow_page nosnippet no_max_image_preview no_robots no_sitemap robots_blocks_all robots_blocks_css_js sitemap_blocked_by_robots sitemap_bad_lastmod no_https robots_html robots_large robots_blocks_wp_assets robots_blocks_images robots_crawl_delay robots_noindex_directive robots_http_sitemap robots_unknown_directive sitemap_empty sitemap_too_many sitemap_duplicate_urls sitemap_http_urls sitemap_foreign_host sitemap_junk_urls sitemap_no_lastmod sitemap_fake_lastmod sitemap_future_lastmod'],
    onpage: ['عنوان، متا و تیترها', 'missing_title long_title short_title title_px_long title_stuffed multi_title missing_desc long_desc short_desc desc_equals_title multi_desc no_h1 empty_h1 multi_h1 long_h1 no_h2 heading_skip dup_title dup_desc dup_h1 arabic_chars arabic_digits title_h1_unrelated'],
    content: ['محتوا و لینک‌دهی', 'thin no_author no_date stale_content no_external_links few_internal generic_anchor empty_links many_links no_breadcrumb no_trust_pages'],
    schema: ['داده ساختاریافته', 'no_schema schema_invalid product_no_schema product_schema_offer product_schema_ids product_schema_image product_no_rating no_org_schema no_article_schema article_schema_fields video_no_schema schema_duplicate'],
    media: ['تصاویر و سرعت', 'img_alt img_dims img_alt_filename img_alt_long img_no_lazy img_legacy_format img_no_srcset lcp_image_lazy img_bad_filename no_preconnect font_display'],
    social: ['اشتراک‌گذاری', 'og no_og_image no_twitter_card og_url_mismatch'],
    ai: ['آمادگی AI و AEO', 'no_llms llms_no_title llms_no_links llms_thin aeo_format no_extractable faq_no_schema']
  };
  const AREA_OF = {}; Object.keys(AREAS).forEach((a) => AREAS[a][1].split(/\s+/).forEach((c) => { AREA_OF[c] = a; }));
  const SEV_W = { critical: 12, high: 7, medium: 3, low: 1 };
  /** امتیاز ۰ تا ۱۰۰ برای هر حوزه با همان فرمول امتیاز کلی (فقط مشکل‌های همان حوزه). کدهای ناشناخته به «فنی» می‌روند. */
  function areaScores(rep) {
    const pages = (rep && rep.pages) || []; const n = Math.max(1, pages.length); const pen = {}; const cnt = {};
    Object.keys(AREAS).forEach((a) => { pen[a] = 0; cnt[a] = 0; });
    const take = (i, w) => { const a = AREA_OF[i.code] || 'tech'; pen[a] += (SEV_W[i.severity] || 1) * w; cnt[a]++; };
    pages.forEach((p) => (p.issues || []).forEach((i) => take(i, 1)));
    ((rep && rep.siteIssues) || []).forEach((i) => take(i, 1.5));
    return Object.keys(AREAS).map((a) => ({ id: a, label: AREAS[a][0], score: Math.max(0, Math.round(100 - Math.min(100, (pen[a] / n) * 2.2))), issues: cnt[a] }));
  }
  return { audit, areaScores, AREAS, areaOf: (c) => AREA_OF[c] || 'tech' };
});
