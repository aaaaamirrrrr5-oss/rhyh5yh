/* Site Inspector — techaudit.js (v1.37.0)
 * Deep technical SEO audit from crawl data. No AI model, no external API.
 * Input per page = fetch record { url, status, finalUrl?, hops?: [{url,status}], headers?, html }.
 * Pure logic, UMD (WebView + Node). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./fatext.js'));
  else root.TechAudit = factory(root.FaText);
})(typeof self !== 'undefined' ? self : this, function (FaText) {
  'use strict';

  /* ---------- URL helpers ---------- */
  function parse(u, base) { try { return new URL(u, base); } catch (e) { return null; } }
  function normUrl(u, base) {
    const x = parse(u, base); if (!x) return null; x.hash = '';
    if ((x.protocol === 'https:' && x.port === '443') || (x.protocol === 'http:' && x.port === '80')) x.port = '';
    return x.href;
  }
  /* comparison key: ignores trailing slash and host case */
  function urlKey(u, base) { const x = parse(u, base); if (!x) return null; x.hash = ''; let p = x.pathname.replace(/\/+$/, '') || '/'; return x.protocol + '//' + x.host.toLowerCase() + p + x.search; }
  const pathOf = (u) => { const x = parse(u); return x ? (x.pathname + x.search) : ''; };
  const sameSite = (a, b) => { const x = parse(a), y = parse(b); return !!(x && y && x.host.replace(/^www\./, '') === y.host.replace(/^www\./, '')); };

  /* ---------- HTML extraction ---------- */
  const attr = (tag, name) => { const m = tag.match(new RegExp('\\b' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? (m[2] != null ? m[2] : m[3] != null ? m[3] : m[4]) : null; };
  const dec = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const HREFLANG_RE = /^(x-default|[a-z]{2,3}(-[A-Za-z]{4})?(-([A-Za-z]{2}|\d{3}))?)$/;

  function extractPage(rec) {
    const html = String(rec.html || ''), url = normUrl(rec.finalUrl || rec.url) || rec.url, headers = {};
    Object.keys(rec.headers || {}).forEach((k) => { headers[k.toLowerCase()] = rec.headers[k]; });
    const head = (html.match(/<head\b[\s\S]*?<\/head>/i) || [html.slice(0, 20000)])[0];
    const metas = head.match(/<meta\b[^>]*>/gi) || [];
    const meta = (n) => { for (const m of metas) { const nm = (attr(m, 'name') || attr(m, 'property') || '').toLowerCase(); if (nm === n) return dec(attr(m, 'content') || ''); } return null; };
    const links = head.match(/<link\b[^>]*>/gi) || [];
    const relLinks = (rel) => links.filter((l) => new RegExp('(^|\\s)' + rel + '(\\s|$)', 'i').test(attr(l, 'rel') || ''));
    const canons = relLinks('canonical').map((l) => normUrl(dec(attr(l, 'href') || ''), url)).filter(Boolean);
    const hreflangs = links.filter((l) => attr(l, 'hreflang')).map((l) => ({ lang: attr(l, 'hreflang').trim(), href: normUrl(dec(attr(l, 'href') || ''), url) })).filter((x) => x.href);
    const prev = relLinks('prev')[0], next = relLinks('next')[0];
    const robots = ((meta('robots') || '') + ',' + (meta('googlebot') || '') + ',' + (headers['x-robots-tag'] || '')).toLowerCase();
    const title = dec(((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').trim());
    const h1m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    const h1 = h1m ? FaText.htmlToText(h1m[1]).replace(/\s+/g, ' ').trim() : '';
    const body = html.replace(/<head\b[\s\S]*?<\/head>/i, '');
    const anchors = []; const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi; let m;
    while ((m = re.exec(body)) && anchors.length < 1500) {
      const href = attr(m[1], 'href'); if (!href || /^\s*(#|mailto:|tel:|javascript:|data:|sms:|whatsapp:)/i.test(href)) continue;
      const abs = normUrl(dec(href), url); if (!abs || !/^https?:/i.test(abs)) continue;
      const imgAlt = (m[2].match(/<img\b[^>]*>/i) || [])[0];
      anchors.push({ href: abs, text: FaText.htmlToText(m[2]).replace(/\s+/g, ' ').trim() || (imgAlt ? (attr(imgAlt, 'alt') || '') : ''), rel: (attr(m[1], 'rel') || '').toLowerCase(), internal: sameSite(abs, url) });
    }
    const assets = [];
    (html.match(/<link\b[^>]*rel\s*=\s*["']?stylesheet[^>]*>/gi) || []).forEach((l) => { const h = attr(l, 'href'); if (h) assets.push(normUrl(dec(h), url)); });
    (html.match(/<script\b[^>]*\bsrc\s*=[^>]*>/gi) || []).forEach((s) => { const h = attr(s, 'src'); if (h) assets.push(normUrl(dec(h), url)); });
    const imgTags = (body.match(/<img\b[^>]*>/gi) || []).slice(0, 400); const hasAttr = (t, n) => new RegExp('\\s' + n + '\\s*=', 'i').test(t);
    const imgs = { total: imgTags.length, noAlt: imgTags.filter((t) => !hasAttr(t, 'alt')).length, noDims: imgTags.filter((t) => !(hasAttr(t, 'width') && hasAttr(t, 'height'))).length };
    const text = FaText.htmlToText(body);
    const headings = []; { const hr = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi; let hm; while ((hm = hr.exec(body)) && headings.length < 80) headings.push({ level: +hm[1], text: FaText.htmlToText(hm[2]).replace(/\s+/g, ' ').trim() }); }
    const schemaTypes = Array.from(new Set(((html.match(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || []).join(' ').match(/"@type"\s*:\s*"([A-Za-z]+)"/g) || []).map((x) => x.replace(/.*:\s*"/, '').replace(/"/g, ''))));
    const product = (() => { const out = { has: false, missing: [] }; const blocks = html.match(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || [];
      const walk = (o, d) => { if (!o || typeof o !== 'object' || d > 6) return; if (Array.isArray(o)) { o.forEach((x) => walk(x, d + 1)); return; }
        const t = [].concat(o['@type'] || []); if (t.indexOf('Product') >= 0) { out.has = true; const of = [].concat(o.offers || [])[0] || {}; const miss = [];
          if (!o.name) miss.push('name'); if (!o.image) miss.push('image'); const price = of.price != null ? of.price : (of.priceSpecification && of.priceSpecification.price) != null ? of.priceSpecification.price : (of.lowPrice != null ? of.lowPrice : null);
          if (price === null || price === '') miss.push('offers.price'); if (!of.priceCurrency && !(of.priceSpecification && of.priceSpecification.priceCurrency)) miss.push('offers.priceCurrency'); if (!of.availability) miss.push('offers.availability');
          if (miss.length > out.missing.length) out.missing = miss; }
        Object.keys(o).forEach((k) => { if (k !== '@context') walk(o[k], d + 1); }); };
      blocks.forEach((b) => { try { walk(JSON.parse(b.replace(/^[\s\S]*?>/, '').replace(/<\/script>$/i, '').trim()), 0); } catch (e) { out.bad = true; } }); return out; })();
    return { url, requestedUrl: rec.url, status: rec.status || 200, hops: rec.hops || [], headers, title, description: meta('description'), h1, canonicals: canons, canonical: canons[0] || null,
      robots, noindex: /noindex|none/.test(robots), nofollow: /nofollow|none/.test(robots), hreflangs, prev: prev ? normUrl(dec(attr(prev, 'href') || ''), url) : null, next: next ? normUrl(dec(attr(next, 'href') || ''), url) : null,
      links: anchors, assets: assets.filter(Boolean), headings, schemaTypes, ogType: meta('og:type'), viewport: meta('viewport'), twitterCardOk: !!meta('twitter:card'), product, ogTitle: meta('og:title'), ogImage: meta('og:image'), twitterCard: meta('twitter:card'), imgs, htmlLength: html.length, lang: (html.match(/<html\b[^>]*\blang\s*=\s*["']?([a-zA-Z-]+)/i) || [])[1] || '', words: (FaText.rawTokens(text) || []).length, text,
      isHttps: /^https:/i.test(url), mixed: /^https:/i.test(url) ? (html.match(/\b(?:src|href)\s*=\s*["']http:\/\/(?!schema\.org|www\.w3\.org)[^"']+["']/gi) || []).filter((x) => /^src/i.test(x) || /\.(css|js)\b/i.test(x)).length : 0 };
  }

  /* ---------- robots.txt (Google-style matching: longest rule wins, Allow wins ties, * and $) ---------- */
  function parseRobots(text) {
    const groups = []; let cur = null, lastAgent = false; const sitemaps = [];
    String(text || '').split(/\r?\n/).forEach((raw) => {
      const line = raw.replace(/#.*$/, '').trim(); if (!line) return; const i = line.indexOf(':'); if (i < 0) return;
      const k = line.slice(0, i).trim().toLowerCase(), v = line.slice(i + 1).trim();
      if (k === 'sitemap') { sitemaps.push(v); return; }
      if (k === 'user-agent') { if (!cur || !lastAgent) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); lastAgent = true; return; }
      lastAgent = false; if (cur && (k === 'allow' || k === 'disallow')) cur.rules.push({ type: k, path: v });
    });
    return { groups, sitemaps };
  }
  function ruleRegex(p) { return new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$')); }
  function robotsAllows(parsed, agent, path) {
    agent = String(agent || '*').toLowerCase(); let best = null, bestLen = -1;
    const exact = parsed.groups.filter((g) => g.agents.some((a) => a !== '*' && agent === a));
    const use = exact.length ? exact : parsed.groups.filter((g) => g.agents.indexOf('*') >= 0);
    use.forEach((g) => g.rules.forEach((r) => {
      if (!r.path) return; let re; try { re = ruleRegex(r.path); } catch (e) { return; }
      if (re.test(path)) { const len = r.path.length; if (len > bestLen || (len === bestLen && r.type === 'allow')) { best = r; bestLen = len; } }
    }));
    return !best || best.type === 'allow';
  }

  /* ---------- issue builder ---------- */
  const SEV = ['critical', 'high', 'medium', 'low'];
  function mkIssues() {
    const map = new Map();
    return {
      add(code, severity, title, detail, url, meta) {
        let e = map.get(code); if (!e) { e = Object.assign({ code, severity, title, detail, urls: [], count: 0 }, meta || {}); map.set(code, e); }
        e.count++; if (url && e.urls.length < 200 && e.urls.indexOf(url) < 0) e.urls.push(url);
      },
      list() { return Array.from(map.values()).sort((a, b) => SEV.indexOf(a.severity) - SEV.indexOf(b.severity) || b.count - a.count); },
    };
  }
  const SOFT404 = /(\b404\b|not found|page not found|صفحه.{0,12}(یافت نشد|پیدا نشد|وجود ندارد|حذف)|یافت نشد|پیدا نشد)/i;
  const ASSET_PATH = /\/(wp-content|wp-includes|assets|static|build|dist)\//i;

  /* ---------- main audit ---------- */
  /* pages: extractPage() records. site: { origin, robotsTxt?, sitemapUrls?: string[], sitemapComplete?: bool } */
  function audit(pages, site) {
    site = site || {}; const I = mkIssues();
    const origin = site.origin || (pages[0] && pages[0].url) || '';
    const byKey = new Map(); pages.forEach((p) => { byKey.set(urlKey(p.url), p); if (p.requestedUrl) byKey.set(urlKey(p.requestedUrl), p); });
    const redirectedFrom = new Map(); // key of requested url -> final url (for pages that went through a redirect)
    pages.forEach((p) => { if (p.hops && p.hops.length) redirectedFrom.set(urlKey(p.requestedUrl || p.hops[0].url), p); });
    const indexable = (p) => p.status === 200 && !p.noindex;
    const robots = site.robotsTxt != null ? parseRobots(site.robotsTxt) : null;

    pages.forEach((p) => {
      const u = p.url;
      /* --- status / soft 404 --- */
      if (p.status >= 500) I.add('http_5xx', 'critical', 'خطای سرور (۵xx)', 'این صفحه خطای سرور می‌دهد و ایندکس نمی‌شود.', u, { fix: 'لاگ سرور و افزونه‌ها را بررسی کن.', effort: 3 });
      else if (p.status >= 400) I.add('http_4xx', 'high', 'صفحهٔ ۴xx (شکسته) در خزش', 'کد ' + p.status + '؛ اگر لینک داخلی به آن وجود دارد اصلاح یا ریدایرکت شود.', u, { fix: 'لینک ورودی را اصلاح کن یا ۳۰۱ به صفحهٔ مرتبط بگذار.', effort: 2 });
      else if (p.status === 200 && (p.words < 120 && SOFT404.test(p.title + ' ' + p.h1) || SOFT404.test(p.title) && p.words < 250)) I.add('soft_404', 'high', 'Soft 404 (وضعیت ۲۰۰ ولی صفحهٔ «یافت نشد»)', 'گوگل چنین صفحه‌ای را خطای نرم می‌شمارد.', u, { fix: 'کد وضعیت ۴۰۴ یا ۴۱۰ برگردان.', effort: 2 });

      /* --- redirects --- */
      if (p.hops && p.hops.length >= 2) I.add('redirect_chain', 'medium', 'زنجیرهٔ ریدایرکت (بیش از یک پرش)', p.hops.length + ' پرش تا رسیدن به مقصد؛ هر پرش سرعت و اعتبار لینک را کم می‌کند.', p.requestedUrl || u, { fix: 'ریدایرکت اول را مستقیم به مقصد نهایی بزن.', effort: 2 });
      if (p.hops && p.hops.length) {
        const seen = new Set(); let loop = false; p.hops.forEach((h) => { const k = urlKey(h.url); if (seen.has(k)) loop = true; seen.add(k); });
        if (loop) I.add('redirect_loop', 'critical', 'حلقهٔ ریدایرکت', 'صفحه به خودش یا چرخه‌ای از آدرس‌ها ریدایرکت می‌شود.', p.requestedUrl || u, { fix: 'قاعدهٔ ریدایرکت (htaccess / افزونه) را اصلاح کن.', effort: 3 });
        if (/^https:/i.test(p.requestedUrl || '') && /^http:/i.test(u)) I.add('redirect_to_http', 'high', 'ریدایرکت از HTTPS به HTTP', 'مقصد نهایی امن نیست.', p.requestedUrl, { fix: 'مقصد را HTTPS کن.', effort: 2 });
        if (p.hops.some((h) => h.status === 302 || h.status === 307) ) I.add('temp_redirect', 'low', 'ریدایرکت موقت (۳۰۲/۳۰۷) برای مسیر دائمی', 'اگر انتقال دائمی است از ۳۰۱ استفاده کن تا اعتبار منتقل شود.', p.requestedUrl || u, { fix: 'نوع ریدایرکت را به ۳۰۱ تغییر بده.', effort: 1 });
      }

      /* --- mobile / lang / images / social --- */
      if (p.status === 200 && !p.noindex) {
        if (p.viewport === null || p.viewport === undefined) I.add('no_viewport', 'high', 'متای viewport ندارد', 'بدون viewport صفحه در موبایل درست نمایش داده نمی‌شود و ایندکس موبایل‌اول آسیب می‌بیند.', u, { fix: '<meta name="viewport" content="width=device-width, initial-scale=1"> به head اضافه کن.', effort: 1 });
        if (!p.lang) I.add('no_lang', 'medium', 'صفتِ lang روی <html> نیست', 'زبان صفحه برای موتور جست‌وجو و صفحه‌خوان‌ها اعلام نشده.', u, { fix: 'برای فارسی lang="fa" (یا fa-IR) را روی <html> بگذار.', effort: 1 });
        else if (!/^fa\b/i.test(p.lang) && p.words > 60 && (String(p.text || '').slice(0, 3000).match(/[\u0600-\u06FF]/g) || []).length > 600) I.add('lang_mismatch', 'low', 'زبان اعلام‌شده با متن فارسی نمی‌خواند', 'lang="' + p.lang + '" ولی متن عمدتاً فارسی است.', u, { fix: 'lang را به fa تغییر بده.', effort: 1 });
        if (p.imgs && p.imgs.total >= 3 && p.imgs.noAlt > 0) I.add('img_no_alt', p.imgs.noAlt / p.imgs.total > 0.3 ? 'medium' : 'low', 'تصویر بدون صفتِ alt', p.imgs.noAlt + ' از ' + p.imgs.total + ' تصویر alt ندارد؛ برای دسترس‌پذیری و جست‌وجوی تصویر لازم است (alt="" فقط برای تصویر تزئینی).', u, { fix: 'برای تصاویر محتوایی alt توصیفی بنویس.', effort: 2 });
        if (p.imgs && p.imgs.total >= 3 && p.imgs.noDims / p.imgs.total > 0.5) I.add('img_no_dims', 'low', 'تصاویر بدون width/height', 'نبود ابعاد باعث جابه‌جایی چیدمان (CLS) می‌شود.', u, { fix: 'width و height را روی تصاویر بگذار.', effort: 2 });
        if (!p.ogTitle || !p.ogImage) I.add('no_og_basic', 'low', 'og:title یا og:image ناقص است', 'پیش‌نمایش اشتراک‌گذاری در شبکه‌های اجتماعی ضعیف می‌شود.', u, { fix: 'og:title و og:image را تنظیم کن (افزونه‌های سئو انجام می‌دهند).', effort: 1 });
      }
      if (p.status === 200 && !p.noindex) {
        if (p.product && p.product.has && p.product.missing.length) I.add('product_schema_incomplete', p.product.missing.some((m) => /price|availability/.test(m)) ? 'high' : 'medium', 'اسکیمای Product ناقص است', 'فیلدهای کم: ' + p.product.missing.join('، ') + ' — برای نمایش قیمت و موجودی در نتایج گوگل لازم است.', u, { fix: 'قیمت، واحد پول، موجودی و تصویر را در JSON-LD محصول کامل کن.', effort: 2 });
        if (p.product && p.product.bad) I.add('jsonld_invalid', 'medium', 'JSON-LD نامعتبر', 'یکی از بلوک‌های ld+json قابل خواندن نیست و گوگل آن را نادیده می‌گیرد.', u, { fix: 'نحو JSON-LD را اصلاح کن.', effort: 2 });
        if (p.ogTitle && p.ogImage && !p.twitterCardOk) I.add('no_twitter_card', 'low', 'twitter:card ندارد', 'پیش‌نمایش در X/توییتر بدون twitter:card ضعیف است.', u, { fix: 'twitter:card=summary_large_image را اضافه کن.', effort: 1 });
      }
      /* --- canonical --- */
      if (p.status === 200) {
        if (p.canonicals.length > 1 && new Set(p.canonicals.map((c) => urlKey(c))).size > 1) I.add('multi_canonical', 'high', 'چند canonical متناقض', 'گوگل canonical متناقض را نادیده می‌گیرد.', u, { fix: 'فقط یک canonical بگذار (معمولاً افزونهٔ سئو و قالب هر دو می‌گذارند).', effort: 2 });
        if (!p.canonical && !p.noindex) I.add('no_canonical', 'low', 'canonical تعریف نشده', 'برای جلوگیری از نسخه‌های تکراری بهتر است self-canonical باشد.', u, { fix: 'canonical خودارجاع اضافه کن.', effort: 1 });
        if (p.canonical) {
          const same = urlKey(p.canonical) === urlKey(u);
          if (!same) {
            const t = byKey.get(urlKey(p.canonical));
            if (!sameSite(p.canonical, u)) I.add('canonical_cross_host', 'medium', 'canonical به دامنهٔ دیگر', 'اعتبار صفحه به دامنهٔ دیگری منتقل می‌شود؛ اگر عمدی نیست اصلاح شود.', u, { fix: 'canonical را به همین دامنه بده.', effort: 1 });
            else if (t && t.status >= 300) I.add('canonical_to_error', 'high', 'canonical به صفحهٔ خطا/ریدایرکت', 'مقصد canonical با کد ' + t.status + ' پاسخ می‌دهد.', u, { fix: 'canonical را به آدرس نهایی ۲۰۰ بده.', effort: 1 });
            else if (t && t.noindex) I.add('canonical_to_noindex', 'high', 'canonical به صفحهٔ noindex', 'سیگنال متناقض: صفحه می‌گوید «این را نمایه کن» ولی مقصد noindex است.', u, { fix: 'یا noindex را بردار یا canonical را عوض کن.', effort: 1 });
            else if (t && t.canonical && urlKey(t.canonical) !== urlKey(t.url)) I.add('canonical_chain', 'medium', 'زنجیرهٔ canonical', 'مقصد canonical خودش به جای دیگری canonical است.', u, { fix: 'canonical را مستقیم به مقصد نهایی بده.', effort: 1 });
          }
          if (/^http:/i.test(p.canonical) && p.isHttps) I.add('canonical_http', 'high', 'canonical روی HTTP در صفحهٔ HTTPS', 'نسخهٔ نامن به‌عنوان اصلی معرفی شده.', u, { fix: 'canonical را HTTPS کن.', effort: 1 });
        }
        if (/[?&](utm_|fbclid|gclid|sort=|orderby=|filter|add-to-cart|replytocom|s=)/i.test(u) && !p.noindex && (!p.canonical || urlKey(p.canonical) === urlKey(u))) I.add('param_indexable', 'medium', 'URL پارامتری قابل ایندکس بدون canonical به نسخهٔ تمیز', 'پارامترهای ردیابی/فیلتر نسخهٔ تکراری می‌سازند.', u, { fix: 'canonical به آدرس بدون پارامتر یا noindex.', effort: 2 });
      }

      /* --- URL hygiene --- */
      const x = parse(u); if (x) {
        if (/[A-Z]/.test(x.pathname)) I.add('url_uppercase', 'low', 'حروف بزرگ در مسیر URL', 'می‌تواند نسخهٔ تکراری بسازد.', u, { fix: 'URL ها را lowercase و ریدایرکت کن.', effort: 2 });
        if (/_/.test(x.pathname)) I.add('url_underscore', 'low', 'زیرخط (_) در URL', 'گوگل خط‌تیره را جداکنندهٔ واژه می‌شناسد.', u, { fix: 'از - استفاده کن.', effort: 2 });
        if (u.length > 115) I.add('url_long', 'low', 'URL خیلی بلند', u.length + ' نویسه.', u, { fix: 'نامک (slug) را کوتاه کن.', effort: 2 });
        if (!p.isHttps) I.add('not_https', 'high', 'صفحه روی HTTP است', 'مرورگرها هشدار می‌دهند و رتبه ضعیف می‌شود.', u, { fix: 'گواهی SSL و ریدایرکت کلی به HTTPS.', effort: 3 });
      }
      if (p.mixed) I.add('mixed_content', 'medium', 'محتوای مخلوط (منبع HTTP در صفحهٔ HTTPS)', p.mixed + ' منبع ناامن.', u, { fix: 'آدرس منابع را HTTPS کن.', effort: 2 });

      /* --- hreflang --- */
      if (p.hreflangs.length) {
        const self = p.hreflangs.some((h) => urlKey(h.href) === urlKey(u));
        if (!self) I.add('hreflang_no_self', 'medium', 'hreflang بدون ارجاع به خود صفحه', 'هر نسخه باید خودش را هم در فهرست داشته باشد.', u, { fix: 'نشانی خود صفحه را با کد زبانش اضافه کن.', effort: 2 });
        if (!p.hreflangs.some((h) => h.lang.toLowerCase() === 'x-default')) I.add('hreflang_no_default', 'low', 'x-default در hreflang نیست', 'برای کاربرانی که زبانشان پوشش داده نشده لازم است.', u, { fix: 'یک x-default اضافه کن.', effort: 1 });
        p.hreflangs.forEach((h) => {
          if (!HREFLANG_RE.test(h.lang)) I.add('hreflang_bad_code', 'medium', 'کد زبان hreflang نامعتبر', 'مثل «' + h.lang + '»؛ قالب درست fa یا fa-IR است.', u, { fix: 'کد ISO 639-1 و در صورت نیاز ISO 3166-1 بگذار.', effort: 1 });
          if (urlKey(h.href) === urlKey(u)) return;
          const t = byKey.get(urlKey(h.href));
          if (t) {
            if (t.status !== 200) I.add('hreflang_to_error', 'high', 'hreflang به صفحهٔ غیر ۲۰۰', 'مقصد کد ' + t.status + ' دارد.', u, { fix: 'مقصد را درست کن یا از فهرست بردار.', effort: 1 });
            else if (t.noindex) I.add('hreflang_to_noindex', 'medium', 'hreflang به صفحهٔ noindex', 'مقصد نمایه نمی‌شود.', u, { fix: 'noindex را بردار یا ارجاع را حذف کن.', effort: 1 });
            else if (!t.hreflangs.some((b) => urlKey(b.href) === urlKey(u))) I.add('hreflang_no_return', 'high', 'hreflang یک‌طرفه (لینک بازگشتی ندارد)', 'مقصد به این صفحه برنمی‌گردد؛ گوگل ارجاع را نادیده می‌گیرد.', u, { fix: 'در صفحهٔ مقصد هم به این صفحه ارجاع بده.', effort: 2 });
          }
        });
      }

      /* --- pagination --- */
      const pg = /(?:\/page\/(\d+)|[?&](?:paged?|p)=(\d+))/i.exec(u);
      if (pg && Number(pg[1] || pg[2]) > 1 && p.status === 200) {
        if (p.canonical && urlKey(p.canonical) !== urlKey(u) && sameSite(p.canonical, u) && !/\/page\/\d+|[?&]paged?=\d+/.test(p.canonical)) I.add('pagination_canonical_page1', 'medium', 'canonical صفحه‌های بعدی به صفحهٔ اول', 'محتوای صفحات عمیق از دید گوگل پنهان می‌ماند.', u, { fix: 'هر صفحهٔ شماره‌دار canonical به خودش داشته باشد.', effort: 1 });
        if (p.noindex) I.add('pagination_noindex', 'low', 'صفحهٔ شماره‌دار noindex', 'اگر محصولات از مسیر دیگری قابل‌خزش نیستند، دیده نمی‌شوند.', u, { fix: 'noindex را فقط در صورت وجود مسیر جایگزین نگه دار.', effort: 1 });
      }
    });

    /* --- internal links to broken / redirected URLs --- */
    const linkTo = new Map(); const inbound = new Map(); pages.forEach((p) => inbound.set(urlKey(p.url), new Set()));
    pages.forEach((p) => {
      const seen = new Set();
      p.links.forEach((l) => {
        if (!l.internal) return; const k = urlKey(l.href); if (!k || k === urlKey(p.url) || seen.has(k)) return; seen.add(k);
        const redir = redirectedFrom.get(k), target = byKey.get(k);
        if (redir && redir.hops.length) I.add('link_to_redirect', 'medium', 'لینک داخلی به آدرس ریدایرکت‌شده', 'لینک باید مستقیم به مقصد نهایی برود.', p.url + '  →  ' + l.href, { fix: 'لینک را به آدرس نهایی تغییر بده.', effort: 1 });
        else if (target && target.status >= 400) I.add('link_to_broken', 'high', 'لینک داخلی شکسته', 'مقصد کد ' + target.status + ' می‌دهد.', p.url + '  →  ' + l.href, { fix: 'لینک را اصلاح یا حذف کن.', effort: 1 });
        if (!/nofollow/.test(l.rel) && target) { if (!inbound.has(urlKey(target.url))) inbound.set(urlKey(target.url), new Set()); inbound.get(urlKey(target.url)).add(urlKey(p.url)); }
        if (/nofollow/.test(l.rel) && target && target.status === 200) I.add('nofollow_internal', 'low', 'nofollow روی لینک داخلی', 'قدرت لینک داخلی هدر می‌رود.', p.url + '  →  ' + l.href, { fix: 'nofollow را از لینک داخلی بردار.', effort: 1 });
      });
    });

    /* --- click depth (BFS from home) + orphans --- */
    const home = pages.find((p) => { const x = parse(p.url); return x && (x.pathname === '/' || x.pathname === '') && !x.search; }) || pages[0];
    const depth = new Map(); const depthDist = {};
    if (home) {
      depth.set(urlKey(home.url), 0); const q = [home];
      while (q.length) {
        const p = q.shift(), d = depth.get(urlKey(p.url));
        if (p.nofollow) continue;
        p.links.forEach((l) => { if (!l.internal || /nofollow/.test(l.rel)) return; const k = urlKey(l.href), t = byKey.get(k); if (!t || depth.has(urlKey(t.url))) return; depth.set(urlKey(t.url), d + 1); q.push(t); });
      }
      pages.forEach((p) => {
        if (!indexable(p)) return; const d = depth.get(urlKey(p.url));
        if (d == null) { if (site.sitemapUrls && site.sitemapUrls.some((s) => urlKey(s) === urlKey(p.url))) I.add('orphan_page', 'high', 'صفحهٔ یتیم (در sitemap هست ولی هیچ لینک داخلی ندارد)', 'گوگل ارزش کمی برای آن قائل می‌شود و ممکن است دیرتر خزیده شود.', p.url, { fix: 'از صفحات مرتبط (دسته، مقالهٔ هم‌موضوع) لینک بده.', effort: 2 }); return; }
        depthDist[d] = (depthDist[d] || 0) + 1;
        if (d > 3) I.add('deep_page', d > 5 ? 'high' : 'medium', 'صفحهٔ عمیق (بیش از ۳ کلیک از خانه)', 'عمق ' + d + ' کلیک؛ صفحه‌های مهم باید نزدیک خانه باشند.', p.url, { fix: 'از منو، دسته‌ها یا صفحهٔ پرمخاطب لینک بده.', effort: 2 });
      });
    }

    /* --- sitemap vs reality --- */
    if (site.sitemapUrls && site.sitemapUrls.length) {
      const smKeys = new Set(site.sitemapUrls.map((s) => urlKey(s)));
      site.sitemapUrls.forEach((s) => {
        const p = byKey.get(urlKey(s)); if (!p) return;
        if (p.status >= 400) I.add('sitemap_error', 'high', 'آدرس خطادار در sitemap', 'کد ' + p.status + '.', s, { fix: 'از sitemap حذف کن.', effort: 1 });
        else if (p.hops && p.hops.length && urlKey(p.requestedUrl || s) === urlKey(s)) I.add('sitemap_redirect', 'medium', 'آدرس ریدایرکت‌شده در sitemap', 'sitemap باید فقط آدرس‌های نهایی ۲۰۰ داشته باشد.', s, { fix: 'آدرس نهایی را جایگزین کن.', effort: 1 });
        else if (p.noindex) I.add('sitemap_noindex', 'high', 'صفحهٔ noindex در sitemap', 'سیگنال متناقض.', s, { fix: 'یا از sitemap حذف یا noindex را بردار.', effort: 1 });
        else if (p.canonical && urlKey(p.canonical) !== urlKey(p.url) && sameSite(p.canonical, p.url)) I.add('sitemap_noncanonical', 'medium', 'آدرس غیرcanonical در sitemap', 'آدرس canonical آن متفاوت است.', s, { fix: 'آدرس canonical را در sitemap بگذار.', effort: 1 });
      });
      if (site.sitemapComplete) pages.forEach((p) => { if (indexable(p) && !smKeys.has(urlKey(p.url)) && (!p.canonical || urlKey(p.canonical) === urlKey(p.url)) && !/[?&]/.test(p.url)) I.add('missing_from_sitemap', 'low', 'صفحهٔ قابل‌ایندکس که در sitemap نیست', 'sitemap کامل نیست.', p.url, { fix: 'افزونهٔ سئو را برای افزودن این نوع صفحه تنظیم کن.', effort: 1 }); });
    }

    /* --- robots.txt --- */
    const rob = { found: !!robots, blockAll: false, blockedAssets: [], blockedPages: [] };
    if (robots) {
      if (!robotsAllows(robots, 'googlebot', '/') ) { rob.blockAll = true; I.add('robots_block_all', 'critical', 'robots.txt کل سایت را برای گوگل مسدود کرده', 'Disallow: / روی Googlebot اعمال می‌شود.', origin + '/robots.txt', { fix: 'قاعدهٔ Disallow: / را بردار.', effort: 1 }); }
      if (!robots.sitemaps.length) I.add('robots_no_sitemap', 'low', 'robots.txt آدرس sitemap ندارد', 'خط Sitemap: به کشف سریع‌تر کمک می‌کند.', origin + '/robots.txt', { fix: 'Sitemap: https://… را اضافه کن.', effort: 1 });
      const assetSeen = new Set();
      pages.forEach((p) => {
        if (p.status === 200 && !p.noindex && !robotsAllows(robots, 'googlebot', pathOf(p.url))) { rob.blockedPages.push(p.url); I.add('page_blocked_robots', 'high', 'صفحهٔ مهم توسط robots.txt مسدود است', 'گوگل نمی‌تواند محتوا را بخزد (نمایه می‌شود ولی بدون توضیح).', p.url, { fix: 'قاعدهٔ Disallow مربوط را بازبینی کن.', effort: 1 }); }
        p.assets.forEach((a) => { if (!sameSite(a, p.url) || assetSeen.has(a)) return; assetSeen.add(a); if (!robotsAllows(robots, 'googlebot', pathOf(a))) { rob.blockedAssets.push(a); I.add('asset_blocked_robots', 'high', 'CSS/JS توسط robots.txt مسدود است', 'گوگل صفحه را درست رندر نمی‌کند.', a, { fix: 'پوشه‌های wp-content و wp-includes را مسدود نکن.', effort: 1 }); } });
      });
    }

    /* --- site-wide duplicates of title / description / h1 --- */
    [['title', 'dup_title', 'high', 'عنوان (title) تکراری'], ['description', 'dup_desc', 'medium', 'توضیحات متا تکراری'], ['h1', 'dup_h1', 'low', 'H1 تکراری']].forEach(([f, code, sev, label]) => {
      const m = new Map();
      pages.forEach((p) => { if (!indexable(p)) return; if (p.canonical && urlKey(p.canonical) !== urlKey(p.url)) return; const v = FaText.normalize(p[f] || '').trim().toLowerCase(); if (v.length < 8) return; if (!m.has(v)) m.set(v, []); m.get(v).push(p.url); });
      m.forEach((urls, v) => { if (urls.length > 1) urls.forEach((u) => I.add(code, sev, label, 'این مقدار در چند صفحه یکسان است و گوگل نمی‌داند کدام را رتبه بدهد.', u, { fix: 'برای هر صفحه مقدار یکتا بنویس.', effort: 2 })); });
    });

    /* --- trailing slash / case duplicates (two live 200 URLs for one page) --- */
    const dupKey = new Map();
    pages.forEach((p) => { if (p.status !== 200) return; const k = p.url.replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase(); if (!dupKey.has(k)) dupKey.set(k, []); dupKey.get(k).push(p); });
    dupKey.forEach((arr) => { const distinct = new Set(arr.map((p) => p.url)); if (distinct.size > 1) distinct.forEach((u) => I.add('url_variants', 'medium', 'یک صفحه با چند آدرس (اسلش/حروف بزرگ)', 'هر دو نسخه ۲۰۰ می‌دهند.', u, { fix: 'یک نسخه را ۳۰۱ به نسخهٔ اصلی کن.', effort: 2 })); });

    const issues = I.list();
    const total = Math.max(1, pages.length), W = { critical: 12, high: 7, medium: 3, low: 1 };
    let pen = 0; issues.forEach((i) => { pen += (W[i.severity] || 1) * (1 + 4 * Math.min(1, i.count / total)); });
    return { issues, score: Math.max(0, Math.round(100 - Math.min(100, pen * 1.2))), stats: { pages: pages.length, depth: depthDist, maxDepth: Math.max(0, ...Object.keys(depthDist).map(Number)), robots: rob,
      statusCounts: pages.reduce((o, p) => { const c = p.status >= 500 ? '5xx' : p.status >= 400 ? '4xx' : p.status >= 300 ? '3xx' : '2xx'; o[c] = (o[c] || 0) + 1; return o; }, {}) } };
  }

  return { audit, extractPage, mkIssues, parseRobots, robotsAllows, normUrl, urlKey };
});
