/* Official first-party data connectors for Site Inspector.
 * Access tokens are passed in-memory by the caller and are never persisted by this module.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SI = root.SI || {}, root.SI.Integrations = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DEFAULT_FETCH = (...args) => fetch(...args);
  function need(value, label) { if (!String(value || '').trim()) throw new Error(label + ' وارد نشده است.'); return String(value).trim(); }
  function safeUrl(value) { try { const u = new URL(value); if (!/^https?:$/.test(u.protocol)) throw new Error(); return u.toString(); } catch (e) { throw new Error('نشانی سایت معتبر نیست.'); } }
  async function jsonRequest(url, init, fetcher) {
    const f = fetcher || DEFAULT_FETCH;
    const response = await f(url, init || {});
    let data = null; try { data = await response.json(); } catch (e) { data = null; }
    if (!response.ok) {
      const msg = data && (data.error && (data.error.message || data.error.code) || data.message) || ('HTTP ' + response.status);
      throw new Error('اتصال داده ناموفق بود: ' + String(msg).slice(0, 500));
    }
    if (!data || typeof data !== 'object') throw new Error('پاسخ سرویس معتبر نیست.');
    return data;
  }
  function dateRange(days) {
    const end = new Date(); end.setUTCDate(end.getUTCDate() - 3); // Search Console data can be delayed.
    const start = new Date(end); start.setUTCDate(start.getUTCDate() - Math.max(1, Math.min(90, Number(days || 28))));
    const fmt = (d) => d.toISOString().slice(0, 10);
    return { startDate: fmt(start), endDate: fmt(end) };
  }
  async function searchConsole(input, fetcher) {
    input = input || {}; const token = need(input.accessToken, 'توکن OAuth گوگل');
    const property = need(input.siteUrl, 'Property URL در Search Console');
    const range = dateRange(input.days || 28); const allowed = new Set(['query', 'page', 'country', 'device', 'date', 'searchAppearance']); const dimension = allowed.has(input.dimension) ? input.dimension : 'query';
    const url = 'https://searchconsole.googleapis.com/webmasters/v3/sites/' + encodeURIComponent(property) + '/searchAnalytics/query';
    const data = await jsonRequest(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...range, dimensions: [dimension], rowLimit: Math.max(1, Math.min(250, Number(input.limit || 100))), dataState: 'final' }) }, fetcher);
    return { provider: 'google-search-console', range, dimension, rows: Array.isArray(data.rows) ? data.rows.map((r) => ({ keys: (r.keys || []).map(String), key: (r.keys || []).join(' · '), clicks: Number(r.clicks || 0), impressions: Number(r.impressions || 0), ctr: Number(r.ctr || 0), position: Number(r.position || 0) })) : [], receivedAt: new Date().toISOString(), source: 'Google Search Console API' };
  }
  async function analytics(input, fetcher) {
    input = input || {}; const token = need(input.accessToken, 'توکن OAuth گوگل');
    const propertyId = need(input.propertyId, 'شناسه Property در GA4').replace(/^properties\//, '');
    if (!/^\d+$/.test(propertyId)) throw new Error('شناسهٔ Property باید فقط عدد باشد.');
    const days = Math.max(1, Math.min(90, Number(input.days || 28)));
    const metricNames = Array.isArray(input.metrics) && input.metrics.length ? input.metrics : [input.metric || 'sessions'];
    const dimNames = Array.isArray(input.dimensions) && input.dimensions.length ? input.dimensions : [input.dimension || 'date'];
    const allowedMetrics = new Set(['sessions', 'totalUsers', 'activeUsers', 'newUsers', 'keyEvents', 'conversions', 'purchaseRevenue', 'engagementRate', 'bounceRate']);
    const allowedDimensions = new Set(['date', 'country', 'deviceCategory', 'sessionDefaultChannelGroup', 'landingPagePlusQueryString', 'eventName']);
    if (metricNames.some((x) => !allowedMetrics.has(x)) || dimNames.some((x) => !allowedDimensions.has(x))) throw new Error('یکی از معیارها یا ابعاد GA4 در فهرست مجاز نیست.');
    const end = new Date(); end.setUTCDate(end.getUTCDate() - 1); const start = new Date(end); start.setUTCDate(start.getUTCDate() - days + 1);
    const fmt = (d) => d.toISOString().slice(0, 10);
    const url = 'https://analyticsdata.googleapis.com/v1beta/properties/' + propertyId + ':runReport';
    const data = await jsonRequest(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ dateRanges: [{ startDate: fmt(start), endDate: fmt(end) }], dimensions: dimNames.map((name) => ({ name })), metrics: metricNames.map((name) => ({ name })), limit: '250' }) }, fetcher);
    return { provider: 'google-analytics-4', propertyId, dimensionHeaders: (data.dimensionHeaders || []).map((x) => x.name), metricHeaders: (data.metricHeaders || []).map((x) => x.name), rows: (data.rows || []).map((r) => ({ dimensions: (r.dimensionValues || []).map((x) => x.value), metrics: (r.metricValues || []).map((x) => x.value) })), rowCount: Number(data.rowCount || (data.rows || []).length), receivedAt: new Date().toISOString(), source: 'Google Analytics Data API v1beta' };
  }
  async function pageSpeed(input, fetcher) {
    input = input || {}; const target = safeUrl(need(input.url, 'آدرس صفحه'));
    const strategy = input.strategy === 'desktop' ? 'desktop' : 'mobile';
    const api = new URL('https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed');
    api.searchParams.set('url', target); api.searchParams.set('strategy', strategy);
    ['performance', 'accessibility', 'best-practices', 'seo'].forEach((c) => api.searchParams.append('category', c));
    if (input.apiKey) api.searchParams.set('key', String(input.apiKey).trim());
    const data = await jsonRequest(api.toString(), { method: 'GET', headers: { Accept: 'application/json' } }, fetcher);
    const cats = data.lighthouseResult && data.lighthouseResult.categories || {};
    const audits = data.lighthouseResult && data.lighthouseResult.audits || {};
    const metrics = {};
    ['largest-contentful-paint', 'interaction-to-next-paint', 'cumulative-layout-shift', 'first-contentful-paint', 'speed-index', 'total-blocking-time'].forEach((key) => { if (audits[key]) metrics[key] = { displayValue: audits[key].displayValue || '', numericValue: audits[key].numericValue || null, score: audits[key].score }; });
    return { provider: 'pagespeed-insights', url: target, strategy, scores: Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, v && v.score == null ? null : Math.round(v.score * 100)])), metrics, receivedAt: new Date().toISOString(), source: 'Google PageSpeed Insights API v5' };
  }
  function bingStatus() {
    return {
      provider: 'bing-webmaster',
      status: 'json-http-supported',
      auth: 'api-key-or-oauth',
      message: 'Bing Webmaster API مسیر JSON/HTTP را مستند کرده است. APIهای قدیمی SOAP و POX از ۳۱ اوت ۲۰۲۶ بازنشسته شده‌اند؛ Site Inspector فقط از JSON/HTTP استفاده می‌کند و کلید را برای همان درخواست می‌فرستد.',
      docs: 'https://learn.microsoft.com/en-us/bingwebmaster/'
    };
  }
  function sourceLabels() { return { gsc: 'Google Search Console API', ga4: 'Google Analytics Data API v1beta', psi: 'Google PageSpeed Insights API v5', bing: 'Bing Webmaster JSON/HTTP API' }; }
  function summarize(input) {
    input = input || {}; const out = [];
    if (input.gsc) out.push('Search Console: ' + input.gsc.rows.length + ' ردیف؛ کلیک ' + input.gsc.rows.reduce((a, x) => a + x.clicks, 0) + '؛ نمایش ' + input.gsc.rows.reduce((a, x) => a + x.impressions, 0));
    if (input.ga4) out.push('GA4: ' + input.ga4.rowCount + ' ردیف داده؛ معیارها: ' + input.ga4.metricHeaders.join('، '));
    if (input.psi) out.push('PageSpeed: ' + Object.entries(input.psi.scores).map(([k, v]) => k + ' ' + (v == null ? 'نامشخص' : v + '/100')).join('، '));
    if (input.bing) out.push('Bing: ' + (input.bing.message || input.bing.status));
    return out;
  }
  return { dateRange, searchConsole, analytics, pageSpeed, bingStatus, sourceLabels, summarize };
});
