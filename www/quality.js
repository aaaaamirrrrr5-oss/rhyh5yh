/* Independent quality gates for content, crawl reports and Schema.org JSON-LD. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SI = root.SI || {}, root.SI.Quality = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const plain = (s) => String(s || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const text = (v) => typeof v === 'string' ? v.trim() : '';
  const list = (v) => Array.isArray(v) ? v : (v == null ? [] : [v]);
  function collectNodes(node, out) {
    if (Array.isArray(node)) { node.forEach((x) => collectNodes(x, out)); return; }
    if (!node || typeof node !== 'object') return;
    if (node['@type']) out.push(node);
    if (Array.isArray(node['@graph'])) node['@graph'].forEach((x) => collectNodes(x, out));
    Object.keys(node).forEach((k) => { if (k !== '@graph' && node[k] && typeof node[k] === 'object') collectNodes(node[k], out); });
  }
  function parseJsonLd(html) {
    const source = String(html || ''); const blocks = []; const re = /<script\b[^>]*type\s*=\s*(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi; let m;
    while ((m = re.exec(source)) && blocks.length < 40) {
      const raw = m[2].trim(); if (!raw || raw.length > 500000) continue;
      try { blocks.push(JSON.parse(raw)); } catch (e) { blocks.push({ __invalid: true, raw: raw.slice(0, 300), error: String(e.message || e) }); }
    }
    return blocks;
  }
  function typesOf(node) { return list(node && node['@type']).map((x) => String(x)); }
  function hasAnyType(node, names) { return typesOf(node).some((x) => names.includes(x)); }
  function auditSchema(html, page) {
    page = page || {}; const blocks = parseJsonLd(html); const nodes = []; blocks.filter((x) => !x.__invalid).forEach((x) => collectNodes(x, nodes));
    const issues = []; const add = (code, severity, message, nodeType) => issues.push({ code, severity, message, type: nodeType || '' });
    blocks.filter((x) => x.__invalid).forEach(() => add('invalid_jsonld', 'high', 'یک بلوک JSON-LD قابل تجزیه نیست.'));
    const typed = nodes.map((n) => ({ node: n, types: typesOf(n) }));
    const products = typed.filter((x) => x.types.some((t) => ['Product','ProductGroup'].includes(t)));
    const articles = typed.filter((x) => x.types.some((t) => ['Article','BlogPosting','NewsArticle'].includes(t)));
    const breadcrumbs = typed.filter((x) => x.types.includes('BreadcrumbList'));
    const organizations = typed.filter((x) => x.types.some((t) => ['Organization','LocalBusiness','Store','Restaurant','CafeOrCoffeeShop'].includes(t)));
    products.forEach(({ node, types }) => {
      if (!text(node.name)) add('product_missing_name', 'high', 'Product فاقد name است.', types.join('/'));
      if (!node.image) add('product_missing_image', 'medium', 'Product فاقد image است.', types.join('/'));
      if (!text(node.description)) add('product_missing_description', 'medium', 'Product فاقد description است.', types.join('/'));
      if (!node.offers && !node.hasVariant) add('product_missing_offer_or_variant', 'medium', 'Product نه Offers دارد و نه hasVariant/گروه تنوع.', types.join('/'));
      const offers = list(node.offers); offers.forEach((offer) => { if (offer && typeof offer === 'object' && offer.price != null && !text(offer.priceCurrency)) add('offer_missing_currency', 'high', 'Offer دارای price است اما priceCurrency ندارد.', 'Offer'); });
      if (page.title && node.name && text(page.title).length > 0 && !text(page.title).toLowerCase().includes(text(node.name).toLowerCase()) && !text(node.name).toLowerCase().includes(text(page.title).toLowerCase())) add('product_name_page_mismatch', 'medium', 'نام Product با عنوان قابل‌مشاهدهٔ صفحه متفاوت است؛ هماهنگی را بررسی کن.', types.join('/'));
      if (page.price != null && node.offers && list(node.offers).some((o) => o && o.price != null && Number(o.price) !== Number(page.price))) add('product_price_mismatch', 'high', 'قیمت Schema با قیمت ثبت‌شدهٔ محصول در زمینه برابر نیست.', 'Product');
    });
    articles.forEach(({ node, types }) => {
      if (!text(node.headline || node.name)) add('article_missing_headline', 'medium', 'Article فاقد headline/name است.', types.join('/'));
      if (!node.author) add('article_missing_author', 'medium', 'Article فاقد author است.', types.join('/'));
      if (!node.datePublished) add('article_missing_date_published', 'low', 'Article فاقد datePublished است.', types.join('/'));
      if (!node.image) add('article_missing_image', 'low', 'Article فاقد image است.', types.join('/'));
    });
    breadcrumbs.forEach(({ node }) => { const items = list(node.itemListElement); if (!items.length) add('breadcrumb_empty', 'medium', 'BreadcrumbList فاقد itemListElement است.', 'BreadcrumbList'); items.forEach((it) => { if (!it || !it.position || !(it.item || it.name)) add('breadcrumb_item_incomplete', 'low', 'یکی از ردیف‌های BreadcrumbList فاقد position یا item/name است.', 'ListItem'); }); });
    organizations.forEach(({ node, types }) => { if (!text(node.name)) add('organization_missing_name', 'high', 'Organization/LocalBusiness فاقد name است.', types.join('/')); if (!text(node.url)) add('organization_missing_url', 'low', 'Organization/LocalBusiness فاقد URL است.', types.join('/')); });
    if (!nodes.length && blocks.length === 0) add('schema_absent', 'info', 'JSON-LD در HTML ارائه‌شده پیدا نشد؛ ممکن است داده ساختاریافته با microdata/RDFa یا سمت سرور تولید شود.');
    return { blocks: blocks.length, nodes: nodes.length, types: Array.from(new Set(typed.flatMap((x) => x.types))), issues, ok: !issues.some((x) => ['invalid_jsonld','product_missing_name','product_price_mismatch','offer_missing_currency'].includes(x.code)) };
  }
  function auditCrawlReport(report) {
    report = report || {}; const pages = Array.isArray(report.pages) ? report.pages : []; const issues = Array.isArray(report.issues) ? report.issues : [];
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    issues.forEach((x) => { const k = bySeverity[x.severity] == null ? 'info' : x.severity; bySeverity[k]++; });
    const duplicates = report.duplicate_groups || {};
    return { pages: pages.length || Number(report.page_count || 0), issues: issues.length, bySeverity, duplicateTitleGroups: (duplicates.title || []).length, duplicateMetaGroups: (duplicates.meta_description || []).length, duplicateContentGroups: (duplicates.content_exact || []).length, topIssues: issues.slice(0, 30), completeness: pages.length ? Math.round(pages.filter((p) => p.status >= 200 && p.status < 300).length / pages.length * 100) : 0 };
  }
  function sourceEvidence(input) {
    input = input || {}; const url = text(input.url); let parsed = null;
    try { parsed = new URL(url); } catch (_) {}
    if (!parsed || !['https:','http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('منبع باید URL معتبر HTTP/HTTPS داشته باشد.');
    ['token','access_token','refresh_token','api_key','key','password','secret','authorization','code'].forEach((key) => parsed.searchParams.delete(key));
    parsed.hash = '';
    const verificationMethod = text(input.verificationMethod).slice(0, 120);
    return { title: text(input.title).slice(0, 250), url: parsed.href, publisher: text(input.publisher || input.source).slice(0, 120), publishedAt: text(input.publishedAt).slice(0, 50), fetchedAt: text(input.fetchedAt || new Date().toISOString()).slice(0, 50), verified: !!input.verified && !!verificationMethod, verificationMethod, confidence: Math.max(0, Math.min(1, Number(input.confidence == null ? 0.5 : input.confidence))), claim: text(input.claim).slice(0, 1200) };
  }
  return { parseJsonLd, auditSchema, auditCrawlReport, sourceEvidence, plain };
});
