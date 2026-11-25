/* Site Inspector — seorules.js (v1.69.0)  SI.SeoRules
 * منطق کتابخانهٔ قوانین سئوی گوگل و GEO/AEO (دادهٔ قوانین در seorules-data.js).
 *  - جست‌وجو و پاسخ به پرسش دربارهٔ هر قانون، دسته یا خرافه
 *  - ممیزی تکمیلی صفحه / robots.txt / نقشهٔ سایت برای قوانینی که engine.js پوشش نمی‌دهد (بدون شبکه، بدون AI)
 *  - تطبیق نتیجهٔ بازرسی با قوانین: هر قانون «رعایت‌شده / نقض‌شده / دستی / مرجع»
 *  - خلاصهٔ فشرده برای prompt مدل زبانی (با هشدار خرافه‌ها)
 * هیچ‌چیز را اجرا یا تغییر نمی‌دهد؛ تضمین رتبه یا استناد نمی‌دهد. UMD. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(require('./seorules-data.js')); else (root.SI = root.SI || {}).SeoRules = factory(root.SI && root.SI.SeoRulesData); })(typeof self !== 'undefined' ? self : this, function (DATA) {
  'use strict';
  const FA = '۰۱۲۳۴۵۶۷۸۹';
  const norm = (s) => String(s || '').toLowerCase().replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/ة/g, 'ه').replace(/[أإ]/g, 'ا').replace(/ؤ/g, 'و').replace(/ئ/g, 'ی').replace(/[ً-ٟـ]/g, '')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => FA.indexOf(d)).replace(/‌/g, '').replace(/[؟?!,،؛:()«»"'‹›]/g, ' ').replace(/\.(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
  const AREAS = DATA.AREAS.map((a) => ({ id: a[0], name: a[1], icon: a[2] }));
  const KINDS = DATA.KINDS; const SOURCES = DATA.SOURCES;
  const RULES = DATA.RULES.map((r) => ({ id: r[0], area: r[1], kind: r[2], engine: r[3], sev: r[4], title: r[5], rule: r[6], fix: r[7], codes: r[8] || [], src: r[9], source: SOURCES[r[9]] ? { key: r[9], title: SOURCES[r[9]][0], url: SOURCES[r[9]][1] } : null, _n: norm(r[5] + ' ' + r[6]) }));
  const BY_ID = {}; RULES.forEach((r) => { BY_ID[r.id] = r; });
  const BY_CODE = {}; RULES.forEach((r) => r.codes.forEach((c) => { (BY_CODE[c] = BY_CODE[c] || []).push(r); }));
  const AREA_NAME = {}; AREAS.forEach((a) => { AREA_NAME[a.id] = a; });

  /* کدهایی که ممیزی (engine.js، app.js یا همین فایل) واقعاً می‌سنجد؛ قانون فقط با این‌ها «خودکار» حساب می‌شود. */
  const ENGINE_CODES = ['arabic_chars', 'arabic_digits', 'no_trust_pages', 'schema_duplicate', 'img_bad_filename', 'title_h1_unrelated', 'no_preconnect', 'font_display', 'aeo_format', 'article_schema_fields', 'big_dom', 'canonical_http', 'canonical_offsite', 'canonical_other', 'canonical_params', 'desc_equals_title', 'empty_h1', 'empty_links', 'faq_no_schema', 'generic_anchor', 'heading_skip', 'http_error', 'http_internal_links', 'img_alt', 'img_alt_filename', 'img_alt_long', 'img_dims', 'img_legacy_format', 'img_no_lazy', 'img_no_srcset', 'js_rendered', 'lang_mismatch', 'large_html', 'lcp_image_lazy', 'long_desc', 'long_h1', 'long_title', 'meta_refresh', 'missing_desc', 'missing_title', 'multi_canonical', 'multi_desc', 'multi_h1', 'multi_title', 'no_article_schema', 'no_author', 'no_breadcrumb', 'no_canonical', 'no_charset', 'no_date', 'no_external_links', 'no_extractable', 'no_favicon', 'no_h1', 'no_h2', 'no_lang', 'no_max_image_preview', 'no_og_image', 'no_org_schema', 'no_rtl', 'no_schema', 'no_twitter_card', 'no_viewport', 'nofollow_page', 'noindex', 'nosnippet', 'og', 'og_url_mismatch', 'product_no_rating', 'product_no_schema', 'product_schema_ids', 'product_schema_image', 'product_schema_offer', 'render_blocking_scripts', 'schema_invalid', 'short_desc', 'short_title', 'soft_404', 'stale_content', 'thin', 'title_px_long', 'title_stuffed', 'video_no_schema', 'dup_title', 'dup_desc', 'dup_h1', 'no_https', 'no_sitemap', 'no_robots', 'no_llms', 'few_internal', 'not_html', 'no_apple_touch_icon', 'many_links'];
  const OWN_CODES = ['robots_blocks_all', 'robots_blocks_css_js', 'robots_blocks_wp_assets', 'robots_blocks_images', 'robots_noindex_directive', 'robots_large', 'robots_no_sitemap', 'robots_crawl_delay', 'xrobots_noindex', 'sitemap_too_many', 'sitemap_ignored_tags', 'sitemap_fake_lastmod', 'mixed_content', 'uncrawlable_links', 'internal_nofollow', 'max_snippet_zero', 'hreflang_no_self', 'hreflang_bad_code', 'org_no_sameas', 'deprecated_schema', 'geo_no_structure', 'meta_keywords', 'ai_search_blocked'];
  const CHECKABLE = new Set(ENGINE_CODES.concat(OWN_CODES));

  /* ------------------------------------------------------------------ جست‌وجو */
  const ALIAS = { کانونیکال: 'canonical', کنونیکال: 'canonical', اسکیما: 'schema', 'داده ساختاریافته': 'schema', هرزنامه: 'اسپم', اسپم: 'اسپم', سرعت: 'core web vitals', 'سرعت سایت': 'core web vitals', 'ای ای ای تی': 'e-e-a-t', ایتی: 'e-e-a-t', ریدایرکت: '301', 'تغییر مسیر': '301', نقشه: 'sitemap', 'نقشه سایت': 'sitemap', 'ربات ها': 'robots', ربوتس: 'robots', خزنده: 'ربات', 'هوش مصنوعی': 'ai', 'موتور مولد': 'geo', 'تولید محتوا': 'scaled', 'محتوای تکراری': 'تکراری', 'هدینگ': 'h1', 'تیتر': 'h1', 'تایتل': 'title', 'عنوان صفحه': 'title', 'متا دیسکریپشن': 'توضیحات متا', 'ای ام پی': 'amp', 'اچ ریف لنگ': 'hreflang', 'اینپی': 'inp', 'ال سی پی': 'lcp', 'سی ال اس': 'cls', 'بک لینک': 'لینک', 'لینک سازی': 'لینک', 'گوگل مپ': 'business profile', 'سئوی محلی': 'محلی' };
  const AREA_KW = { crawl: ['خزش', 'ایندکس', 'نمایه', 'robots', 'canonical', 'sitemap', 'ریدایرکت', '301', 'noindex', 'کدوضعیت', '404', 'خزنده گوگل', 'crawl', 'index'], tech: ['سرعت', 'core web vitals', 'cwv', 'lcp', 'inp', 'cls', 'تجربه صفحه', 'page experience', 'پاپ آپ', 'interstitial'], content: ['محتوا', 'e e a t', 'eeat', 'e-e-a-t', 'کیفیت', 'helpful', 'مفید', 'نویسنده', 'تجربه', 'اعتماد', 'ymyl', 'core update', 'هسته'], onpage: ['عنوان', 'title', 'متا', 'h1', 'تیتر', 'تصویر', 'alt', 'انکر', 'لینک داخلی', 'on page', 'onpage', 'آن پیج'], schema: ['schema', 'اسکیما', 'json-ld', 'jsonld', 'ساختاریافته', 'rich result', 'ریچ', 'faqpage', 'howto'], spam: ['اسپم', 'spam', 'جریمه', 'پنالتی', 'penalty', 'cloaking', 'پنهان سازی', 'بک لینک خریداری', 'عمل دستی', 'manual action'], ecom: ['فروشگاه', 'محصول', 'ووکامرس', 'merchant', 'مرچنت', 'محلی', 'local', 'google business', 'nap'], intl: ['hreflang', 'چندزبانه', 'چند زبانه', 'زبان', 'موبایل', 'mobile', 'بین المللی'], geo: ['geo', 'aeo', 'generative', 'ai overview', 'ai mode', 'هوش مصنوعی', 'چت جی', 'chatgpt', 'perplexity', 'پاسخ مستقیم', 'answer engine', 'مولد'], bots: ['gptbot', 'claudebot', 'oai-searchbot', 'google-extended', 'ربات ai', 'ربات های ai', 'خزنده ai', 'perplexitybot', 'ccbot'], myth: ['خرافه', 'افسانه', 'باور غلط', 'اشتباه رایج', 'منسوخ', 'myth', 'واقعا', 'درسته که', 'آیا لازم'] };
  function detectArea(q) {
    const t = norm(q); let best = null, bs = 0;
    Object.keys(AREA_KW).forEach((a) => { let s = 0; AREA_KW[a].forEach((k) => { const nk = norm(k); if (nk && t.includes(nk)) s += nk.length > 4 ? 2 : 1; }); if (s > bs) { bs = s; best = a; } });
    return bs ? best : null;
  }
  function expand(t) { let out = t; Object.keys(ALIAS).forEach((k) => { const nk = norm(k); if (nk && t.includes(nk)) out += ' ' + norm(ALIAS[k]); }); return out; }
  const STOP = new Set(['و', 'در', 'به', 'از', 'که', 'را', 'با', 'این', 'آن', 'برای', 'است', 'یک', 'چیست', 'چی', 'چه', 'گوگل', 'قانون', 'قوانین', 'سئو', 'سایت', 'بگو', 'بده', 'درباره', 'مورد', 'هم', 'یا', 'آیا', 'لازم', 'میشه', 'باید', 'چطور', 'چگونه', 'the', 'is', 'of', 'a', 'to']);
  function search(query, limit, opts) {
    const o = opts || {}; const t = expand(norm(query)); const toks = Array.from(new Set(t.split(' ').filter((x) => x.length >= 2 && !STOP.has(x)))); if (!toks.length) return [];
    const out = []; const da = o.area ? null : detectArea(query);
    RULES.forEach((r) => {
      if (o.area && r.area !== o.area) return; if (o.kind && r.kind !== o.kind) return; if (o.engine && r.engine !== o.engine && r.engine !== 'both') return;
      let s = 0; const tn = norm(r.title); toks.forEach((k) => { if (tn.includes(k)) s += 4; else if (r._n.includes(k)) s += 1.5; if (r.codes.some((c) => c.replace(/_/g, ' ').includes(k) || k === c)) s += 3; });
      if (s > 0 && da && r.area === da) s += 2;
      if (s > 0) out.push({ rule: r, score: s + (r.sev === 'critical' ? 0.6 : r.sev === 'high' ? 0.4 : 0) });
    });
    return out.sort((a, b) => b.score - a.score).slice(0, limit || 6).map((x) => x.rule);
  }
  const byArea = (a, o) => RULES.filter((r) => r.area === a && (!o || !o.kind || r.kind === o.kind));
  const get = (id) => BY_ID[id] || null;
  const rulesForCode = (code) => (BY_CODE[code] || []).slice();
  function stats() {
    const k = {}; const a = {}; RULES.forEach((r) => { k[r.kind] = (k[r.kind] || 0) + 1; a[r.area] = (a[r.area] || 0) + 1; });
    return { total: RULES.length, byKind: k, byArea: a, checkable: RULES.filter((r) => r.codes.some((c) => CHECKABLE.has(c))).length };
  }

  /* ------------------------------------------------------------------ ممیزی‌های تکمیلی */
  const unesc = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'");
  function attrOf(tag, name) { const m = String(tag).match(new RegExp('\\b' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? unesc(m[1] != null ? m[1] : m[2] != null ? m[2] : m[3]) : null; }
  const hdr = (h, name) => { if (!h) return ''; if (typeof h.get === 'function') return String(h.get(name) || ''); const k = Object.keys(h).find((x) => x.toLowerCase() === name); return k ? String(h[k]) : ''; };
  function ldNodes(html) {
    const out = []; (String(html).match(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || []).forEach((b) => {
      let j; try { j = JSON.parse(b.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim()); } catch (e) { return; }
      const walk = (n) => { if (Array.isArray(n)) return n.forEach(walk); if (n && typeof n === 'object') { out.push(n); if (n['@graph']) walk(n['@graph']); } }; walk(j);
    });
    return out;
  }
  const typesOf = (n) => [].concat(n['@type'] || []).map(String);
  function hostOf(u) { try { return new URL(u).host.replace(/^www\./, ''); } catch (e) { return ''; } }

  /** rec = { url, status, headers?, html }. فقط قوانینی که engine.js ندارد؛ خروجی هم‌شکل با issues موتور. */
  function auditPage(rec) {
    const out = []; const url = String((rec && rec.url) || ''); const html = String((rec && rec.html) || ''); if (!html && !(rec && rec.headers)) return out;
    const add = (code, severity, title, detail) => out.push({ code, severity, title, detail, url, rule: (BY_CODE[code] || [])[0] ? BY_CODE[code][0].id : null });
    const xr = hdr(rec && rec.headers, 'x-robots-tag').toLowerCase();
    if (/(^|[\s,:])noindex\b/.test(xr)) add('xrobots_noindex', 'critical', 'هدر X-Robots-Tag روی noindex است', 'مقدار هدر: «' + xr.slice(0, 80) + '». این صفحه از نتایج گوگل و پاسخ‌های AI خارج می‌شود؛ اگر عمدی نیست، تنظیم سرور/افزونه را اصلاح کنید.');
    const clean = html.replace(/<!--[\s\S]*?-->/g, ' ');
    const metas = (clean.match(/<meta\b[^>]*>/gi) || []);
    const metaRobots = metas.filter((m) => /^(robots|googlebot)$/i.test(attrOf(m, 'name') || '')).map((m) => String(attrOf(m, 'content') || '').toLowerCase()).join(',');
    if (/max-snippet\s*:\s*0\b/.test(metaRobots) || /max-snippet\s*:\s*0\b/.test(xr)) add('max_snippet_zero', 'medium', 'max-snippet:0 فعال است', 'این مقدار مثل nosnippet عمل می‌کند و صفحه را از snippet و استفاده در AI Overviews/AI Mode محروم می‌کند.');
    if (metas.some((m) => /^keywords$/i.test(attrOf(m, 'name') || '') && (attrOf(m, 'content') || '').trim())) add('meta_keywords', 'low', 'متا keywords دارد', 'گوگل آن را نادیده می‌گیرد؛ فقط وقت می‌گیرد و فهرست کلمات شما را در معرض رقبا می‌گذارد. حذفش آسیبی ندارد.');
    if (/^https:/i.test(url)) {
      const body = clean.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (s) => (/\bsrc\s*=/i.test(s.slice(0, 300)) ? s.slice(0, 300) : ''));
      const mixed = (body.match(/\b(?:src|data-src)\s*=\s*["']?http:\/\/[^"']+/gi) || []).length + (clean.match(/<link\b[^>]*rel\s*=\s*["']?stylesheet[^>]*href\s*=\s*["']http:\/\//gi) || []).length;
      if (mixed) add('mixed_content', 'medium', 'منبع ناامن (http) در صفحهٔ https', mixed + ' منبع (تصویر/اسکریپت/استایل) با http بارگذاری می‌شود؛ قفل مرورگر خراب و منبع ممکن است مسدود شود. آدرس‌های قدیمی را در پایگاه‌داده جایگزین کنید.');
    }
    const anchors = (clean.match(/<a\b[^>]*>/gi) || []); const host = hostOf(url);
    const dead = anchors.filter((a) => { const h = attrOf(a, 'href'); return (h === null && /\bonclick\s*=/i.test(a)) || /^\s*javascript:/i.test(h || ''); }).length;
    if (dead >= 2) add('uncrawlable_links', dead >= 6 ? 'medium' : 'low', 'لینک‌های غیرقابل‌خزیدن', dead + ' لینک href واقعی ندارد (onclick یا javascript:)؛ گوگل آن‌ها را دنبال نمی‌کند. با <a href="/مسیر"> بسازید.');
    const SKIP = /(cart|checkout|login|logout|account|wp-login|register|wishlist|compare|سبد|پرداخت|ورود|حساب)/i;
    const nf = anchors.filter((a) => { const rel = (attrOf(a, 'rel') || '').toLowerCase(); const h = attrOf(a, 'href') || ''; if (!/\bnofollow\b/.test(rel) || SKIP.test(h) || /^(#|mailto:|tel:|javascript:)/i.test(h)) return false; const abs = /^https?:/i.test(h); return !abs || hostOf(h) === host; }).length;
    if (nf >= 3) add('internal_nofollow', 'low', 'لینک داخلی با nofollow', nf + ' لینک داخلی عادی nofollow دارد؛ اعتبار و کشف صفحه را می‌بُرد. nofollow را فقط برای لینک بیرونی غیرقابل‌تأیید یا صفحه‌های حساب/سبد نگه دارید.');
    const links = (clean.match(/<link\b[^>]*>/gi) || []); const alts = links.filter((l) => /\balternate\b/i.test(attrOf(l, 'rel') || '') && attrOf(l, 'hreflang'));
    if (alts.length) {
      const canon = links.filter((l) => /\bcanonical\b/i.test(attrOf(l, 'rel') || '')).map((l) => attrOf(l, 'href')).filter(Boolean)[0] || url; const nu = (x) => { try { const u = new URL(x, url); return u.host.replace(/^www\./, '') + u.pathname.replace(/\/+$/, ''); } catch (e) { return String(x); } };
      const bad = alts.map((l) => attrOf(l, 'hreflang')).filter((c) => !/^(x-default|[a-z]{2,3}(-[a-z]{4})?(-([a-z]{2}|\d{3}))?)$/i.test(c));
      if (bad.length) add('hreflang_bad_code', 'medium', 'کد hreflang نامعتبر', 'کدهای نامعتبر: ' + bad.slice(0, 4).join('، ') + '. شکل درست: fa، fa-IR، en-US یا x-default.');
      if (!alts.some((l) => nu(attrOf(l, 'href')) === nu(canon) || nu(attrOf(l, 'href')) === nu(url))) add('hreflang_no_self', 'medium', 'hreflang خودارجاع ندارد', 'هر نسخه باید به خودش هم در فهرست hreflang اشاره کند و بقیهٔ نسخه‌ها هم به آن لینک متقابل بدهند، وگرنه گوگل آن را نادیده می‌گیرد.');
    }
    const nodes = ldNodes(clean); const isHome = (() => { try { return /^\/?$/.test(new URL(url).pathname); } catch (e) { return false; } })();
    if (isHome) {
      const org = nodes.find((n) => typesOf(n).some((t) => /^(Organization|LocalBusiness|Store|OnlineStore|Corporation|NGO)$/.test(t)));
      if (org && !(org.sameAs && [].concat(org.sameAs).length)) add('org_no_sameas', 'low', 'اسکیمای سازمان sameAs ندارد', 'پیوند به پروفایل‌های رسمی برند (شبکه‌های اجتماعی، ویکی‌داده، Google Business) به گوگل و مدل‌های AI می‌گوید این برند همان موجودیت شناخته‌شده است.');
    }
    const dep = []; nodes.forEach((n) => { typesOf(n).forEach((t) => { if (/^(HowTo|ClaimReview|SpecialAnnouncement|EstimatedSalary)$/.test(t)) dep.push(t); }); const pa = [].concat(n.potentialAction || []); if (pa.some((p) => p && typesOf(p).includes('SearchAction'))) dep.push('SearchAction'); });
    if (dep.length) add('deprecated_schema', 'low', 'اسکیمای بی‌اثر در گوگل', Array.from(new Set(dep)).join('، ') + ' دیگر نتیجهٔ غنی در گوگل نمی‌دهد. لازم نیست حذف شود؛ فقط انتظار نمایش ویژه نداشته باشید.');
    const text = clean.replace(/<(script|style|noscript|template|svg|head)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = text ? text.split(' ').length : 0;
    if (words > 700 && !/<(ul|ol|table)\b/i.test(clean) && !(rec && rec.noStructure === false)) add('geo_no_structure', 'low', 'متن بلند بدون لیست یا جدول', 'بیش از ۷۰۰ واژه بدون هیچ لیست/جدول؛ ساختار ندادن به متن استخراج پاسخ (برای انسان و AI) را سخت می‌کند.');
    return out;
  }

  function auditRobots(text, opt) {
    const out = []; const src = String(text || ''); if (!src.trim()) return out; const add = (code, severity, title, detail) => out.push({ code, severity, title, detail, url: (opt && opt.url) || '/robots.txt', rule: (BY_CODE[code] || [])[0] ? BY_CODE[code][0].id : null });
    const lines = src.split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean); let agents = [], inRules = false; const groups = [];
    lines.forEach((l) => { const m = l.match(/^([A-Za-z-]+)\s*:\s*(.*)$/); if (!m) return; const k = m[1].toLowerCase(), v = m[2].trim();
      if (k === 'user-agent') { if (inRules) { agents = []; inRules = false; } agents.push(v.toLowerCase()); groups.push({ agents: agents.slice(), rules: [] }); groups[groups.length - 1].agents = agents; }
      else if (k === 'disallow' || k === 'allow') { inRules = true; const g = groups[groups.length - 1]; if (g) g.rules.push([k, v]); }
    });
    const mine = (g, re) => g.agents.some((a) => re.test(a));
    if (groups.some((g) => mine(g, /^(\*|googlebot)$/) && g.rules.some((r) => r[0] === 'disallow' && r[1] === '/') && !g.rules.some((r) => r[0] === 'allow' && r[1] && r[1] !== '/'))) add('robots_blocks_all', 'critical', 'robots.txt کل سایت را مسدود کرده است', 'Disallow: / برای همهٔ ربات‌ها (یا Googlebot)؛ گوگل و دستیارهای AI صفحه‌ها را نمی‌خزند. اگر سایت در حال راه‌اندازی نیست، آن را بردارید.');
    if (groups.some((g) => mine(g, /^(\*|googlebot)$/) && g.rules.some((r) => r[0] === 'disallow' && (/(\.css|\.js)\b/i.test(r[1]) || /^\/wp-(content|includes)\/?$/.test(r[1])) )) && !groups.some((g) => g.rules.some((r) => r[0] === 'allow' && /(\.css|\.js|uploads)/i.test(r[1])))) add('robots_blocks_css_js', 'medium', 'robots.txt فایل‌های رندر (CSS/JS) را مسدود کرده است', 'گوگل صفحه را مثل مرورگر رندر می‌کند؛ مسدودکردن /wp-content/، /wp-includes/ یا css/js دید گوگل از چیدمان و محتوا را خراب می‌کند.');
    if (/^\s*noindex\s*:/im.test(src)) add('robots_noindex_directive', 'low', 'دستور Noindex در robots.txt', 'گوگل از ۲۰۱۹ این دستور را پشتیبانی نمی‌کند؛ برای حذف از ایندکس از meta robots یا X-Robots-Tag استفاده کنید.');
    if (/^\s*crawl-delay\s*:/im.test(src)) add('robots_crawl_delay', 'low', 'Crawl-delay در robots.txt', 'گوگل Crawl-delay را نادیده می‌گیرد (برخی موتورها مثل Bing آن را می‌خوانند). نرخ خزش گوگل را از سرور و Search Console مدیریت کنید.');
    if (Buffer_len(src) > 500 * 1024) add('robots_large', 'medium', 'robots.txt بزرگ‌تر از ۵۰۰ کیلوبایت', 'گوگل فقط ۵۰۰ کیلوبایت اول فایل را می‌خواند؛ قاعده‌های بعدی نادیده می‌ماند.');
    if (!/^\s*sitemap\s*:/im.test(src)) add('robots_no_sitemap', 'low', 'نشانی نقشهٔ سایت در robots.txt نیست', 'یک خط Sitemap: https://… کشف نقشه را برای همهٔ موتورها و ربات‌های AI ساده می‌کند.');
    return out;
  }
  function Buffer_len(s) { try { return typeof Buffer !== 'undefined' ? Buffer.byteLength(s, 'utf8') : new Blob([s]).size; } catch (e) { return String(s).length; } }

  function auditSitemap(xml, opt) {
    const out = []; const s = String(xml || ''); if (!s.trim()) return out; const url = (opt && opt.url) || '/sitemap.xml'; const add = (code, severity, title, detail) => out.push({ code, severity, title, detail, url, rule: (BY_CODE[code] || [])[0] ? BY_CODE[code][0].id : null });
    const locs = (s.match(/<loc>/gi) || []).length; if (/<urlset\b/i.test(s) && locs > 50000) add('sitemap_too_many', 'medium', 'نقشهٔ سایت بیش از ۵۰٬۰۰۰ نشانی دارد', locs + ' نشانی؛ هر فایل حداکثر ۵۰٬۰۰۰ نشانی یا ۵۰ مگابایت است. با sitemap index بشکنید.');
    if (/<(priority|changefreq)>/i.test(s)) add('sitemap_ignored_tags', 'low', 'priority/changefreq در نقشهٔ سایت', 'گوگل این دو را نادیده می‌گیرد؛ می‌توانید حذف کنید. فقط lastmod دقیق به‌کار می‌آید.');
    const lm = (s.match(/<lastmod>\s*([^<\s]+)/gi) || []).map((x) => x.replace(/<lastmod>\s*/i, '').slice(0, 10)); if (lm.length >= 10 && new Set(lm).size === 1) add('sitemap_fake_lastmod', 'low', 'lastmod همهٔ نشانی‌ها یک تاریخ است', 'وقتی همه lastmod یکسان باشد (اغلب تاریخ تولید فایل)، گوگل به آن اعتماد نمی‌کند. lastmod باید فقط با تغییر معنادار عوض شود.');
    return out;
  }

  /* ------------------------------------------------------------------ تطبیق با نتیجهٔ بازرسی */
  const SEV_W = { critical: 5, high: 3, medium: 2, low: 1, info: 0 };
  function compliance(report, extra) {
    const hit = {}; const add = (i, u) => { if (!i || !i.code) return; (hit[i.code] = hit[i.code] || new Set()).add(u || i.url || '/'); };
    if (report) { (report.pages || []).forEach((p) => (p.issues || []).forEach((i) => add(i, i.url || p.url))); (report.siteIssues || []).forEach((i) => add(i)); }
    if (report && report.robots && report.robots.found && Array.isArray(report.robots.bots)) { const sb = report.robots.bots.filter((b) => b.purpose === 'search' && b.status === 'blocked').map((b) => b.id); if (sb.length) add({ code: 'ai_search_blocked', url: '/robots.txt' }, '/robots.txt'); }
    (extra || []).forEach((i) => add(i));
    const have = !!report || (extra && extra.length > 0);
    const rows = RULES.map((r) => {
      const auto = r.codes.filter((c) => CHECKABLE.has(c)); const failed = auto.filter((c) => hit[c]);
      const urls = Array.from(new Set(failed.flatMap((c) => Array.from(hit[c])))).slice(0, 12); const count = failed.reduce((n, c) => n + hit[c].size, 0);
      let state;
      if (r.kind === 'myth' || r.kind === 'dep' || r.kind === 'info') state = 'info';
      else if (!auto.length) state = 'manual';
      else if (!have) state = 'unknown';
      else state = failed.length ? 'fail' : 'pass';
      return { id: r.id, area: r.area, kind: r.kind, sev: r.sev, title: r.title, state, count, urls, codes: failed, hits: (r.kind === 'myth' || r.kind === 'dep') ? failed : [] };
    });
    const scored = rows.filter((x) => x.state === 'pass' || x.state === 'fail'); let w = 0, p = 0; scored.forEach((x) => { const k = SEV_W[x.sev] || 1; w += k; if (x.state === 'pass') p += k; });
    const sum = { total: rows.length, pass: rows.filter((x) => x.state === 'pass').length, fail: rows.filter((x) => x.state === 'fail').length, manual: rows.filter((x) => x.state === 'manual').length, info: rows.filter((x) => x.state === 'info').length, score: w ? Math.round((p / w) * 100) : null };
    const byArea = {}; AREAS.forEach((a) => { const rs = rows.filter((x) => x.area === a.id); byArea[a.id] = { pass: rs.filter((x) => x.state === 'pass').length, fail: rs.filter((x) => x.state === 'fail').length, manual: rs.filter((x) => x.state === 'manual').length, info: rs.filter((x) => x.state === 'info').length }; });
    return { rows, summary: sum, byArea, hasData: have };
  }


  /* ------------------------------------------------------------------ سنجش متن تولیدشده (استودیو/نویسنده) با قوانین */
  const plainT = (h) => String(h || '').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  /** c = { seoTitle, meta, html, keyword, kind: 'product'|'article' } → [{ rule, ok, label, tip }] (راهنما؛ رتبه را تضمین نمی‌کند) */
  function checkCopy(c) {
    c = c || {}; const out = []; const add = (rule, ok, label, tip) => out.push({ rule, ok: !!ok, label, tip: ok ? '' : tip });
    const kw = norm(c.keyword || ''); const t = String(c.seoTitle || ''); const m = String(c.meta || ''); const html = String(c.html || ''); const text = plainT(html); const words = text ? text.split(' ').length : 0;
    if (t) { add('o01', t.length >= 20 && t.length <= 65, 'عنوان سئو ۲۰ تا ۶۵ نویسه', 'عنوان را در همین بازه نگه دارید؛ بریده‌شدن یا کوتاهی بیش‌ازحد در نتیجه‌ها دیده می‌شود.'); if (kw) add('o01', norm(t).includes(kw), 'عبارت اصلی در عنوان', 'عبارت اصلی را نزدیک ابتدای عنوان بیاورید.'); }
    if (m) { add('o03', m.length >= 70 && m.length <= 165, 'توضیحات متا ۷۰ تا ۱۶۵ نویسه', 'خلاصه‌ای دقیق و دعوت‌کننده بنویسید.'); if (kw) add('o03', norm(m).includes(kw), 'عبارت اصلی در توضیحات متا', 'عبارت اصلی را طبیعی در متا بیاورید.'); }
    if (kw && words >= 80) { const hits = (norm(text).match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length; const dens = (hits * kw.split(' ').length) / words * 100; add('q11', dens <= 3.5, 'تکرار عبارت اصلی طبیعی است (' + dens.toFixed(1).replace('.', '٫') + '٪)', 'تراکم بیش از حدود ۳٫۵٪ شبیه keyword stuffing است؛ از مترادف استفاده کنید.'); }
    if (html) {
      const need = c.kind === 'product' ? 120 : 300; add('q05', words >= need, 'محتوا به‌اندازهٔ کفایت پاسخ', 'متن برای پاسخ کامل به نیت کاربر کوتاه است؛ ویژگی‌ها و راهنمای انتخاب واقعی بیفزایید.');
      const h2 = (html.match(/<h2\b/gi) || []).length; if (words >= 250) add('o05', h2 >= 2, 'ساختار با تیتر H2', 'بخش‌ها را با H2 توصیفی (ترجیحاً پرسشی) جدا کنید.');
      const firstP = (html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i) || [])[1]; if (firstP && words >= 150) { const fw = plainT(firstP).split(' ').length; add('g03', fw >= 15 && fw <= 90, 'پاسخ مستقیم در پاراگراف اول', 'پاراگراف اول را به یک پاسخ/خلاصهٔ ۱۵ تا ۹۰ واژه‌ای تبدیل کنید (Answer-first).'); }
      if (words >= 500) add('g05', /<(ul|ol|table)\b/i.test(html), 'لیست یا جدول برای استخراج راحت', 'مقایسه یا مراحل را در لیست/جدول بنویسید.');
      const imgs = html.match(/<img\b[^>]*>/gi) || []; if (imgs.length) add('o06', imgs.every((i) => /\balt\s*=\s*["'][^"']+["']/i.test(i)), 'همهٔ تصاویر alt دارند', 'برای هر تصویر alt توصیفی بنویسید.');
      add('q04', /(\d|۰|۱|۲|۳|۴|۵|۶|۷|۸|۹)/.test(text), 'عدد/مشخصهٔ واقعی در متن', 'مشخصات یا داده‌های واقعی و دقیق بیفزایید؛ متن کلی ارزش افزودهٔ کمی دارد.');
    }
    const score = out.length ? Math.round(out.filter((x) => x.ok).length / out.length * 100) : null;
    return { checks: out, score, failed: out.filter((x) => !x.ok) };
  }

  /* ------------------------------------------------------------------ رعایت قوانین هنگام نوشتن و اصلاح مطلب */
  const clean1 = (x) => plainT(String(x == null ? '' : x)).replace(/\s+/g, ' ').trim();
  const clen = (x) => Array.from(String(x || '')).length;
  const POLICY = (typeof module === 'object' && module.exports) ? require('./seopolicy.js') : ((typeof self !== 'undefined' ? self : this).SI || {}).SeoPolicy;
  function cutAt(str, max, seps) {
    const a = Array.from(str); if (a.length <= max) return str;
    let head = a.slice(0, max).join(''); let k = -1;
    seps.forEach((sp) => { const i = head.lastIndexOf(sp); if (i > k && i >= max * 0.55) k = i; });
    if (k > 0) head = head.slice(0, k); else { const i = head.lastIndexOf(' '); if (i >= max * 0.5) head = head.slice(0, i); }
    head = head.replace(/[\s|\-–—:،,؛;]+$/, '').trim(); for (let g = 0; g < 3; g++) head = head.replace(/\s+(و|با|برای|در|از|به|تا|که|یا|را)$/, '').trim();
    return head;
  }
  /** اصلاح قطعی و امن فیلدهای سئو (فقط برش و پاک‌سازی؛ هرگز واقعیت اضافه نمی‌کند). f = { seo_title, meta_description, excerpt, content } */
  function fixSeoFields(f, ctx) {
    f = f || {}; const fields = {}; const notes = [];
    if (f.seo_title != null && f.seo_title !== '') {
      let t = clean1(f.seo_title);
      if (POLICY ? !POLICY.checkTitle(t).ok && POLICY.checkTitle(t).status === 'long' : clen(t) > 62) { const n = cutAt(t, 60, [' | ', ' – ', ' - ', ' — ', '؛', ':']); if (n && n !== t) { t = n; notes.push('عنوان سئو برای نمایش کامل در نتایج به حدود ۶۰ نویسه کوتاه شد (قانون o01).'); } }
      if (t !== f.seo_title) fields.seo_title = t;
    }
    if (f.meta_description != null && f.meta_description !== '') {
      let m = clean1(f.meta_description);
      if (POLICY ? POLICY.checkMeta(m).status === 'long' : clen(m) > 165) { const a = Array.from(m).slice(0, 160).join(''); const i = Math.max(a.lastIndexOf('.'), a.lastIndexOf('؟'), a.lastIndexOf('!'), a.lastIndexOf('؛')); let n = i >= 90 ? a.slice(0, i + 1) : cutAt(m, 158, []); n = n.replace(/[\s،,:\-–—]+$/, '').trim(); if (n && n !== m) { m = n; notes.push('توضیحات متا به حدود ۱۶۰ نویسه کوتاه شد (قانون o03).'); } }
      else if (clen(m) < 70) { const lead = clean1(f.excerpt) || clean1(((String(f.content || '').match(/<p\b[^>]*>([\s\S]*?)<\/p>/i) || [])[1]) || ''); const sent = (lead.split(/(?<=[.!؟?])\s+/)[0] || '').trim(); if (sent && norm(m).indexOf(norm(sent).slice(0, 30)) === -1) { const joined = (m.replace(/[.!؟?\s]+$/, '') + '؛ ' + sent).trim(); if (clen(joined) <= 160 && clen(joined) >= 70) { m = joined; notes.push('توضیحات متای کوتاه با جملهٔ آغازین خود محتوا کامل شد (قانون o03).'); } } }
      if (m !== f.meta_description) fields.meta_description = m;
    }
    return { fields, notes };
  }
  const HIDDEN_RE = /(display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|text-indent\s*:\s*-\d{3,}|position\s*:\s*absolute[^"']*left\s*:\s*-\d{3,}|color\s*:\s*(#fff(?:fff)?|white)\b[^"']*background[^"']*(#fff(?:fff)?|white))/i;
  /** d = { title, content, excerpt, seo_title, meta_description, focus_keyword }; ctx = { kind: 'product'|'article' } → issues هم‌شکل با lintProductDraft */
  function lintDraft(d, ctx) {
    d = d || {}; ctx = ctx || {}; const issues = []; const html = String(d.content || '');
    const add = (rule, severity, detail) => issues.push({ code: 'rule_' + rule, rule, severity, detail });
    const k = checkCopy({ seoTitle: d.seo_title, meta: d.meta_description, html, keyword: d.focus_keyword, kind: ctx.kind });
    const MAJOR = { q11: 'major' }; k.failed.forEach((c) => add(c.rule, MAJOR[c.rule] || 'minor', 'قوانین سئو/GEO — ' + c.label + ': ' + c.tip));
    if (html) {
      if (/<h1\b/i.test(html)) add('o04', 'minor', 'قوانین سئو — داخل متن نباید H1 باشد؛ عنوان نوشته همان H1 صفحه است. از H2 و H3 استفاده کن.');
      const lv = (html.match(/<h([1-6])\b/gi) || []).map((x) => +x[2]); for (let i = 1; i < lv.length; i++) if (lv[i] - lv[i - 1] > 1) { add('o05', 'minor', 'قوانین سئو — سلسله‌مراتب تیترها پرش دارد (مثلاً H2 مستقیم به H4)؛ ترتیب را منطقی کن.'); break; }
      if (HIDDEN_RE.test(html)) add('p07', 'major', 'قوانین اسپم گوگل — متن یا لینک پنهان (display:none، اندازهٔ صفر و…) ممنوع است؛ حذف کن.');
      if (/<a\b[^>]*>\s*(اینجا|کلیک کنید|ادامه|بیشتر|click here|here)\s*<\/a>/i.test(html)) add('o07', 'minor', 'قوانین سئو — انکر لینک «اینجا/بیشتر» اطلاعاتی نمی‌دهد؛ متن لینک را توصیفی کن.');
      if (/\bsrc\s*=\s*["']http:\/\//i.test(html)) add('c14', 'minor', 'قوانین سئو — منبع تصویر/اسکریپت با http است؛ آدرس را https کن.');
      if (/(گارانتی\s*تضمینی\s*رتبه|رتبه\s*یک\s*گوگل|تضمین\s*(?:رتبه|فروش))/.test(html)) add('q01', 'major', 'قوانین گوگل — ادعای تضمین رتبه یا فروش اعتمادسوز و گمراه‌کننده است؛ حذف کن.');
    }
    return { issues, score: k.score, checks: k.checks, failed: k.failed };
  }
  /** مقایسهٔ قبل/بعد برای «اصلاح مطلب»: اصلاح نباید رعایت قوانین را بدتر کند. before/after = { seo_title, meta_description, content, focus_keyword } */
  function regressions(before, after) {
    before = before || {}; after = after || {}; const out = []; const add = (rule, detail) => out.push({ rule, detail });
    const okT = (t) => { const n = clen(t); return n >= 20 && n <= 65; }; const okM = (m) => { const n = clen(m); return n >= 70 && n <= 165; };
    if (before.seo_title && okT(before.seo_title) && after.seo_title != null && !okT(after.seo_title)) add('o01', 'عنوان سئو که در بازهٔ درست بود از ۲۰ تا ۶۵ نویسه بیرون رفت.');
    if (before.meta_description && okM(before.meta_description) && after.meta_description != null && !okM(after.meta_description)) add('o03', 'توضیحات متا که در بازهٔ درست بود از ۷۰ تا ۱۶۵ نویسه بیرون رفت.');
    const b = String(before.content || ''), a = String(after.content || '');
    if (b && a) {
      const cnt = (h, re) => (h.match(re) || []).length; const wb = plainT(b).split(' ').length, wa = plainT(a).split(' ').length;
      if (cnt(b, /<a\b[^>]*href/gi) > cnt(a, /<a\b[^>]*href/gi)) add('c15', 'تعداد لینک‌ها کم شد؛ لینک داخلی/منبع نباید هنگام اصلاح از بین برود.');
      if (cnt(b, /<img\b/gi) > cnt(a, /<img\b/gi)) add('o06', 'تصویرهای متن کم شد.');
      const altOk = (h) => (h.match(/<img\b[^>]*\balt\s*=\s*["'][^"']+["']/gi) || []).length; if (altOk(a) < altOk(b)) add('o06', 'تعداد تصویرهای دارای alt کم شد.');
      if (cnt(b, /<h2\b/gi) >= 2 && cnt(a, /<h2\b/gi) < Math.ceil(cnt(b, /<h2\b/gi) / 2)) add('o05', 'بیش از نیمی از تیترهای H2 حذف شد.');
      if (wb >= 200 && wa < wb * 0.6) add('q05', 'حجم متن بیش از ۴۰٪ کم شد؛ ممکن است محتوای مفید از بین رفته باشد.');
      if (/application\/ld\+json/i.test(b) && !/application\/ld\+json/i.test(a)) add('s01', 'داده ساختاریافته (JSON-LD) صفحه حذف شد.');
      if (!HIDDEN_RE.test(b) && HIDDEN_RE.test(a)) add('p07', 'متن/لینک پنهان به محتوا افزوده شد.');
      const kw = norm(after.focus_keyword || before.focus_keyword || ''); if (kw && wa >= 80 && wb >= 80) { const dens = (h) => ((norm(plainT(h)).split(kw).length - 1) * kw.split(' ').length) / (plainT(h).split(' ').length || 1) * 100; if (dens(a) > 3.5 && dens(a) > dens(b)) add('q11', 'تراکم عبارت کلیدی بیشتر شد و از حد طبیعی گذشت.'); }
    }
    return out;
  }
  /** بلوک فشرده‌ای که به پرامپت مدل افزوده می‌شود؛ kind: product | article | edit */
  function writingRules(kind) {
    const L = ['قوانین سئوی گوگل و GEO که در نوشتن باید رعایت شود (فقط موارد مستند؛ هیچ تضمین رتبه یا استنادی نده):',
      '۱) مردم‌محور بنویس: پاسخ مستقیم و کوتاه (۲ تا ۳ جمله) در همان ابتدای متن، بعد جزئیات.',
      '۲) تیترها H2/H3 توصیفی (ترجیحاً پرسشی) با ترتیب منطقی؛ داخل متن H1 نگذار.',
      '۳) عبارت اصلی طبیعی و کم‌تکرار (تراکم زیر ۲٫۵٪)؛ keyword stuffing و متن پنهان ممنوع.',
      '۴) seo_title حدود ۲۰ تا ۶۰ نویسه با عبارت اصلی نزدیک ابتدا؛ meta_description ۱۲۰ تا ۱۶۰ نویسه، دقیق و متفاوت از عنوان.',
      '۵) برای مقایسه جدول و برای مراحل یا ویژگی‌ها لیست بنویس؛ هر تصویر alt توصیفی و واقعی دارد.',
      '۶) تجربهٔ دست‌اول، عدد و مشخصهٔ واقعی را فقط از داده‌های منبع بیاور؛ آمار، تاریخ، نظر، نویسنده یا منبع جعل نکن و تاریخ به‌روزرسانی را دستکاری نکن.',
      '۷) ادعای «بهترین/تضمین رتبه/تضمین فروش» و ذکر یا نقد ساختگی ممنوع است (اسپم).',
      '۸) انکر لینک توصیفی بنویس نه «اینجا»؛ لینک‌ها فقط https و واقعی.'];
    if (kind === 'edit') L.push('۹) در اصلاح مطلب موجود: لینک‌ها، تصویرها، تیترهای مفید، JSON-LD و شورت‌کدها را حفظ کن و هیچ‌یک از قوانین بالا را نسبت به متن فعلی بدتر نکن.');
    return L.join('\n');
  }

  /* ------------------------------------------------------------------ خلاصه برای مدل زبانی */
  function digest(maxChars) {
    const pick = (ids) => ids.map((i) => BY_ID[i]).filter(Boolean).map((r) => '- ' + r.title);
    const lines = ['«پایگاه قوانین رسمی (نسخهٔ ۲۰۲۶)» — فقط همین‌ها را به‌عنوان قانون گوگل بگو؛ هرچه اینجا نیست قطعی ادعا نکن:',
      'موضع گوگل: GEO/AEO همان سئوست؛ برای AI Overviews/AI Mode فقط ایندکس‌بودن و واجد snippet بودن لازم است.', ...pick(['g02', 'o10', 'c05', 'c01', 'c12', 'c14', 'c16', 'q01', 'q04', 'p04', 'p13', 's01', 's03', 't01', 't02', 't03', 'b02', 'b03']),
      'باورهای نادرست که نباید تأیید کنی:', ...pick(['y01', 'y02', 'y03', 'y04', 'y05', 'y10', 'y15', 'y16']), '- FAQ rich result از ۷ مه ۲۰۲۶ برای همه حذف شده؛ مارکاپ FAQPage منسوخ/خطا نیست.',
      'هر ادعا را «قانون رسمی»، «توصیهٔ عملی» یا «خرافه» برچسب بزن و تضمین رتبه/استناد نده.'];
    let s = lines.join('\n'); const m = maxChars || 3200; if (s.length > m) s = s.slice(0, m).replace(/\n[^\n]*$/, ''); return s;
  }

  return { AREAS, KINDS, SOURCES, RULES, ENGINE_CODES, OWN_CODES, norm, search, detectArea, byArea, get, rulesForCode, stats, auditPage, auditRobots, auditSitemap, compliance, checkCopy, fixSeoFields, lintDraft, regressions, writingRules, digest };
});
