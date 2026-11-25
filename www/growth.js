/* Site Inspector Growth Intelligence Lab.
 * Deterministic, evidence-bounded insights: merchant completeness, internal-link graph,
 * performance anomaly detection, event playbooks and preflight risk gates.
 * These are diagnostics, not Google ranking predictions.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SI = root.SI || {}, root.SI.Growth = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const STOP = new Set(('و یا از به در با برای که این آن را است هستند بود شود می تا بر یک هر خود همچنین اما اگر چون پس درباره ای های ها تر ترین محصول محصولات خرید فروش قیمت موجودی مشخصات ویژگی ویژگیها معرفی توضیحات توضیح کاربرد استفاده مناسب سایت صفحه مقاله متن محتوا راهنما جدید بهترین کامل').split(' '));
  const plain = (v) => String(v == null ? '' : v).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  function norm(v) { return plain(v).toLowerCase().replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim(); }
  function tokens(v) { return norm(v).split(' ').filter((x) => x.length > 2 && !STOP.has(x)); }
  function unique(arr) { return Array.from(new Set(arr)); }
  function jaccard(a, b) { const A = new Set(a), B = new Set(b); if (!A.size || !B.size) return 0; let n = 0; A.forEach((x) => { if (B.has(x)) n++; }); return n / (A.size + B.size - n); }
  function completeness(product) {
    const p = product || {}; const description = plain(p.description || p.content || ''); const short = plain(p.short_description || p.excerpt || '');
    const images = Array.isArray(p.images) ? p.images : []; const attrs = Array.isArray(p.attributes) ? p.attributes : [];
    const categories = Array.isArray(p.categories) ? p.categories : [];
    const checks = [
      ['name', !!String(p.name || p.title || '').trim(), 'نام محصول'],
      ['long_description', description.length >= 180, 'توضیحات کامل'],
      ['short_description', short.length >= 45, 'توضیح کوتاه'],
      ['sku', !!String(p.sku || '').trim(), 'شناسه SKU'],
      ['image', images.length > 0 || !!p.image, 'تصویر محصول'],
      ['image_alt', images.length ? images.some((x) => String(x.alt || '').trim()) : !!p.image_alt, 'متن جایگزین تصویر'],
      ['category', categories.length > 0, 'دسته‌بندی'],
      ['attributes', attrs.some((x) => (x.options || []).length > 0), 'ویژگی‌های محصول'],
      ['stock_status', !!String(p.stock_status || '').trim(), 'وضعیت موجودی'],
      ['price', p.price !== '' && p.price != null, 'قیمت'],
    ];
    const passed = checks.filter((x) => x[1]).length; const issues = checks.filter((x) => !x[1]).map((x) => ({ code: x[0], label: x[2] }));
    return { score: Math.round(passed / checks.length * 100), passed, total: checks.length, issues, checks: checks.map((x) => ({ code: x[0], label: x[2], ok: x[1] })) };
  }
  function auditCommerceCatalog(items) {
    const rows = (Array.isArray(items) ? items : []).filter((x) => x && (x.type === 'simple' || x.type === 'variable' || x.type === 'product' || x.post_type === 'product'));
    const results = rows.map((p) => ({ id: Number(p.id || 0), name: String(p.name || p.title || ''), url: String(p.url || p.permalink || ''), type: String(p.type || 'product'), ...completeness(p) }));
    const average = results.length ? Math.round(results.reduce((n, x) => n + x.score, 0) / results.length) : 0;
    const counts = {}; results.forEach((x) => x.issues.forEach((i) => { counts[i.code] = (counts[i.code] || 0) + 1; }));
    return { total: results.length, average, results: results.sort((a, b) => a.score - b.score), issueCounts: counts, evidenceLimited: !rows.some((p) => p.description || p.short_description || p.content) };
  }
  function buildKnowledgeGraph(items, research) {
    const source = (Array.isArray(items) ? items : []).slice(0, 500); const nodes = []; const edges = []; const byId = new Map(); const inverted = new Map();
    source.forEach((item) => {
      const id = String(item.id || item.url || ''); if (!id || byId.has(id)) return;
      const title = String(item.title || item.name || 'بدون عنوان'); const body = [item.title, item.name, item.excerpt, item.contentPreview, item.description, item.short_description, item.focusKeyword].filter(Boolean).join(' ');
      const ts = unique(tokens(body)).slice(0, 100); const node = { id, type: item.type || item.post_type || 'content', title, url: String(item.url || item.permalink || ''), tokens: ts, source: 'site' };
      nodes.push(node); byId.set(id, node); ts.forEach((t) => { if (!inverted.has(t)) inverted.set(t, []); inverted.get(t).push(id); });
    });
    const pairScores = new Map();
    inverted.forEach((ids, token) => {
      if (ids.length < 2 || ids.length > 80) return;
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const key = [ids[i], ids[j]].sort().join('|'); pairScores.set(key, (pairScores.get(key) || 0) + 1); }
    });
    pairScores.forEach((shared, key) => {
      const parts = key.split('|'); const a = byId.get(parts[0]), b = byId.get(parts[1]); if (!a || !b) return;
      const score = jaccard(a.tokens, b.tokens); if (score >= 0.18) edges.push({ from: a.id, to: b.id, type: 'topical-overlap', score: Number(score.toFixed(3)), sharedTerms: shared });
    });
    const external = (Array.isArray(research) ? research : []).slice(0, 100).map((r, i) => ({ id: 'research:' + i, type: 'external-source', title: String(r.title || r.name || ''), url: String(r.url || r.link || ''), source: 'research' })).filter((x) => x.url);
    external.forEach((n) => nodes.push(n));
    return { nodes: nodes.map(({ tokens: _tokens, ...n }) => n), edges: edges.sort((a, b) => b.score - a.score).slice(0, 1500), nodeCount: nodes.length, edgeCount: Math.min(edges.length, 1500), truncated: source.length >= 500 };
  }
  function suggestInternalLinks(item, catalog, limit) {
    const current = item || {}; const currentId = String(current.id || ''); const sourceTokens = unique(tokens([current.title, current.content, current.excerpt, current.focusKeyword].join(' ')));
    if (sourceTokens.length < 2) return [];
    return (Array.isArray(catalog) ? catalog : []).filter((x) => String(x.id || '') !== currentId && x.url)
      .map((x) => { const other = unique(tokens([x.title, x.name, x.excerpt, x.contentPreview, x.focusKeyword].join(' '))); const overlap = jaccard(sourceTokens, other); const exact = current.focusKeyword && x.focusKeyword && norm(current.focusKeyword) === norm(x.focusKeyword); return { id: x.id, title: x.title || x.name || '', url: x.url, score: Math.round(overlap * 100), sharedTerms: sourceTokens.filter((t) => other.includes(t)).slice(0, 8), conflictRisk: !!exact, reason: exact ? 'عبارت کلیدی اصلی یکسان است؛ پیش از لینک‌سازی، احتمال هم‌نوع‌خواری بررسی شود.' : 'هم‌پوشانی موضوعی؛ متن لنگر باید طبیعی و دقیق باشد.' }; })
      .filter((x) => x.score >= 18).sort((a, b) => (b.score - a.score) || Number(a.conflictRisk) - Number(b.conflictRisk)).slice(0, Math.max(1, Math.min(20, Number(limit || 8))));
  }
  function detectCannibalization(items) {
    const rows = (Array.isArray(items) ? items : []).filter((x) => x && x.focusKeyword && x.url); const groups = new Map();
    rows.forEach((x) => { const k = norm(x.focusKeyword); if (!k) return; if (!groups.has(k)) groups.set(k, []); groups.get(k).push({ id: x.id, title: x.title || x.name, url: x.url, type: x.type || x.post_type, keyword: x.focusKeyword }); });
    return Array.from(groups.entries()).filter(([, v]) => v.length > 1).map(([keyword, pages]) => ({ keyword, pages, count: pages.length, severity: pages.length >= 4 ? 'high' : 'medium', note: 'وجود کلمهٔ کلیدی مشترک فقط علامت بررسی است؛ قصد جستجو، نوع صفحه و عملکرد باید پیش از ادغام یا تغییر بررسی شود.' }));
  }
  function detectPerformanceAnomalies(snapshots, options) {
    options = options || {}; const minBase = Math.max(2, Number(options.minBaseline || 3)); const threshold = Math.max(5, Math.min(90, Number(options.thresholdPct || 25)));
    const rows = (Array.isArray(snapshots) ? snapshots : []).slice().sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0)); if (rows.length < minBase + 1) return { ready: false, required: minBase + 1, available: rows.length, anomalies: [], reason: 'برای مقایسهٔ قابل‌اعتماد حداقل چهار نمونهٔ زمانی لازم است.' };
    const latest = rows[rows.length - 1]; const serviceRows = rows.filter((r) => String(r.service || '') === String(latest.service || '')); if (serviceRows.length < minBase + 1) return { ready: false, required: minBase + 1, available: serviceRows.length, anomalies: [], reason: 'برای هر سرویس باید حداقل چهار نمونهٔ زمانی مستقل وجود داشته باشد.' }; const latestRow = serviceRows[serviceRows.length - 1]; const metrics = ['clicks', 'impressions', 'sessions', 'users', 'revenue', 'conversions']; const anomalies = [];
    metrics.forEach((metric) => {
      const values = serviceRows.slice(0, -1).map((r) => Number(r.metrics && r.metrics[metric])).filter((v) => Number.isFinite(v)); if (values.length < minBase) return;
      const sorted = values.slice().sort((a, b) => a - b); const median = sorted[Math.floor(sorted.length / 2)]; const current = Number(latestRow.metrics && latestRow.metrics[metric]);
      if (!Number.isFinite(current) || median <= 0) return; const deltaPct = ((current - median) / median) * 100;
      if (Math.abs(deltaPct) >= threshold) anomalies.push({ metric, baselineMedian: median, current, deltaPct: Number(deltaPct.toFixed(1)), direction: deltaPct < 0 ? 'drop' : 'rise', confidence: values.length >= 5 ? 'medium' : 'low', note: 'هشدار آماری بر پایهٔ میانهٔ نمونه‌های ذخیره‌شده است؛ فصل، کمپین، تغییر اندازه‌گیری و انتشار الگوریتم باید جداگانه بررسی شود.' });
    });
    return { ready: true, baselineCount: rows.length - 1, latestAt: latestRow.ts, service: latestRow.service, anomalies: anomalies.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct)), thresholdPct: threshold };
  }
  function buildEventPlaybook() {
    return [
      { event: 'product.created', label: 'محصول جدید', actions: ['دریافت مشخصات و تصاویر', 'ممیزی Merchant SEO', 'ساخت پیش‌نویس توضیح کوتاه/کامل', 'بررسی شباهت با محصولات موجود'], mode: 'draft-first' },
      { event: 'product.updated', label: 'ویرایش محصول', actions: ['بازبینی متادیتا و Schema', 'بررسی تغییر قیمت/موجودی', 'بازبینی لینک‌های مرتبط'], mode: 'analyze-only' },
      { event: 'content.published', label: 'انتشار محتوا', actions: ['کنترل عنوان و متا', 'بررسی لینک داخلی', 'بررسی Schema و indexability'], mode: 'analyze-only' },
      { event: 'media.changed', label: 'تغییر رسانه', actions: ['کنترل Alt و caption', 'بررسی ابعاد و حجم فایل'], mode: 'suggest-only' },
      { event: 'content.deleted', label: 'حذف محتوا', actions: ['یافتن لینک‌های ورودی', 'پیشنهاد مقصد ریدایرکت پس از تأیید'], mode: 'approval-required' },
    ];
  }
  function preflight(context) {
    context = context || {}; const caps = context.capabilities || {}; const checks = [
      { id: 'bridge', ok: !!context.bridgeConnected, label: 'اتصال افزونه' },
      { id: 'https', ok: !!context.https, label: 'انتقال امن HTTPS' },
      { id: 'backup', ok: !!context.backupReady, label: 'نسخهٔ پشتیبان قابل‌بازیابی' },
      { id: 'revision', ok: !!context.revisionControl, label: 'کنترل نسخهٔ محتوا' },
      { id: 'writeGrant', ok: !!caps.content_agent, label: 'مجوز عامل محتوا' },
      { id: 'autoGrant', ok: !!caps.content_agent_auto, label: 'مجوز اجرای خودکار' },
      { id: 'queue', ok: !!caps.background_agent, label: 'صف پایدار سرور' },
    ];
    const blocked = checks.filter((x) => !x.ok).map((x) => x.id); return { readyForAutomaticWrites: blocked.length === 0, checks, blocked, message: blocked.length ? 'اجرای خودکار کامل مجاز نیست؛ ابتدا موارد مسدودکننده را برطرف کن.' : 'پیش‌نیازهای پایه برقرارند؛ باز هم هر حوزه فقط در محدودهٔ مجوز خودش قابل اجراست.' };
  }
  function buildOpportunityReport(context) {
    context = context || {}; const products = auditCommerceCatalog(context.products || []); const pages = Array.isArray(context.catalog) ? context.catalog : [];
    const graph = buildKnowledgeGraph(pages, context.research || []); const cannibal = detectCannibalization(pages);
    const links = pages.slice(0, 30).flatMap((item) => suggestInternalLinks(item, pages, 3).map((x) => ({ source: item.title || item.name, ...x })));
    return { generatedAt: new Date().toISOString(), products, graph, cannibalization: cannibal, internalLinks: links.slice(0, 100), anomalies: detectPerformanceAnomalies(context.snapshots || []), playbook: buildEventPlaybook(), preflight: preflight(context) };
  }

  // ---- Local (on-device) growth autopilot: pacing, daily cap, failure back-off, history ----
  const LOCAL_CYCLE = { minIntervalMs: 6 * 3600000, dailyCap: 3, failureLimit: 3, failureBackoffMs: 12 * 3600000, maxHistory: 30 };
  function localCfg(o) { return Object.assign({}, LOCAL_CYCLE, o || {}); }
  function dayStart(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function localHistory(h) { return (Array.isArray(h) ? h : []).filter((x) => x && Number.isFinite(Number(x.at))).sort((a, b) => Number(a.at) - Number(b.at)); }
  function localCycleGate(history, now, opts) {
    const o = localCfg(opts), h = localHistory(history), manual = !!(opts && opts.manual);
    const today = dayStart(now), appliedToday = h.filter((x) => x.status === 'applied' && Number(x.at) >= today).length;
    if (appliedToday >= o.dailyCap) return { ok: false, code: 'daily_cap', nextAt: today + 86400000, appliedToday, message: 'سقف روزانهٔ چرخهٔ رشد محلی (' + o.dailyCap + ' صفحه) تمام شده است؛ فردا ادامه می‌دهد.' };
    if (manual) return { ok: true, appliedToday };
    const last = h.length ? Number(h[h.length - 1].at) : 0;
    if (last && now - last < o.minIntervalMs) return { ok: false, code: 'interval', nextAt: last + o.minIntervalMs, appliedToday, message: 'فاصلهٔ حداقلی بین چرخه‌ها هنوز تمام نشده است.' };
    let streak = 0; for (let i = h.length - 1; i >= 0 && h[i].status === 'failed'; i--) streak++;
    if (streak >= o.failureLimit && last && now - last < o.failureBackoffMs) return { ok: false, code: 'failure_backoff', nextAt: last + o.failureBackoffMs, appliedToday, streak, message: streak + ' شکست پیاپی؛ اجرای خودکار موقتاً متوقف شد. علت را در تاریخچه ببین یا دستی اجرا کن.' };
    return { ok: true, appliedToday, streak };
  }
  function recordLocalCycle(history, entry, now, opts) {
    const o = localCfg(opts); const st = ['applied', 'failed', 'skipped'].includes(entry && entry.status) ? entry.status : 'failed';
    const e = { at: Number(now) || Date.now(), status: st, post_id: entry && entry.post_id != null ? entry.post_id : null, title: String(entry && entry.title || '').slice(0, 120), url: String(entry && entry.url || '').slice(0, 300), fields: Array.isArray(entry && entry.fields) ? entry.fields.slice(0, 6) : [], change_id: String(entry && entry.change_id || ''), reason: String(entry && entry.reason || '').slice(0, 300), automatic: !!(entry && entry.automatic) };
    const n = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 1000) / 1000 : 0), b = entry && entry.baseline;
    if (b && typeof b === 'object') e.baseline = { impressions: n(b.impressions), clicks: n(b.clicks), ctr: n(b.ctr), position: n(b.position), at: Number(b.at) || e.at };
    if (entry && entry.before) e.before = { seo_title: String(entry.before.seo_title || '').slice(0, 200), meta_description: String(entry.before.meta_description || '').slice(0, 400) };
    if (entry && entry.after) e.after = { seo_title: String(entry.after.seo_title || '').slice(0, 200), meta_description: String(entry.after.meta_description || '').slice(0, 400) };
    if (entry && entry.attempts) e.attempts = Math.max(1, Math.min(5, Number(entry.attempts) || 1));
    if (entry && entry.score != null) e.score = n(entry.score);
    if (entry && entry.coverage != null) e.coverage = Math.max(0, Math.min(1, n(entry.coverage)));
    return localHistory(history).concat([e]).slice(-o.maxHistory);
  }
  function summarizeLocalHistory(history, now, opts) {
    const o = localCfg(opts), h = localHistory(history), today = dayStart(now);
    const count = (s) => h.filter((x) => x.status === s).length;
    const gate = localCycleGate(h, now, opts);
    return { total: h.length, applied: count('applied'), failed: count('failed'), skipped: count('skipped'), appliedToday: h.filter((x) => x.status === 'applied' && Number(x.at) >= today).length, dailyCap: o.dailyCap, last: h.length ? h[h.length - 1] : null, lastApplied: h.filter((x) => x.status === 'applied').pop() || null, nextAt: gate.ok ? 0 : gate.nextAt, blocked: gate.ok ? '' : gate.code, message: gate.ok ? '' : gate.message };
  }

  // ---- Smarter local autopilot: GSC aggregation, CTR-gap ranking, output validation, impact assessment ----
  function normUrl(u) { return String(u || '').trim().replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase(); }
  function aggregateGscByPage(rows) {
    const acc = {};
    (Array.isArray(rows) ? rows : []).forEach((r) => {
      const keys = Array.isArray(r && r.keys) ? r.keys : []; const page = keys.find((x) => /^https?:\/\//i.test(String(x))); if (!page) return;
      const k = normUrl(page), imp = Number(r.impressions || 0), clk = Number(r.clicks || 0), pos = Number(r.position || 0);
      const o = acc[k] || (acc[k] = { url: page, impressions: 0, clicks: 0, posWeighted: 0, rows: 0, wsum: 0, queryMap: {} });
      o.impressions += imp; o.clicks += clk; o.posWeighted += pos * Math.max(imp, 1); o.wsum += Math.max(imp, 1); o.rows++;
      const q = keys.find((x) => !/^https?:\/\//i.test(String(x))); if (q) { const m = o.queryMap[q] || (o.queryMap[q] = { imp: 0, clk: 0, pw: 0, w: 0 }); m.imp += imp; m.clk += clk; m.pw += pos * Math.max(imp, 1); m.w += Math.max(imp, 1); }
    });
    const out = {};
    Object.keys(acc).forEach((k) => { const o = acc[k];
      const qs = Object.keys(o.queryMap).sort((a, b) => o.queryMap[b].imp - o.queryMap[a].imp).slice(0, 12);
      out[k] = { url: o.url, impressions: o.impressions, clicks: o.clicks, ctr: o.impressions ? o.clicks / o.impressions : 0, position: o.posWeighted / o.wsum, queries: qs,
        queryStats: qs.map((q) => { const m = o.queryMap[q]; return { q, impressions: m.imp, clicks: m.clk, position: Math.round((m.pw / m.w) * 10) / 10 }; }) }; });
    return out;
  }
  const CTR_CURVE = [0, 0.28, 0.15, 0.10, 0.07, 0.05, 0.04, 0.03, 0.025, 0.02, 0.018];
  function expectedCtr(position) { const p = Number(position); if (!(p > 0)) return 0; if (p <= 10) { const lo = Math.floor(p), hi = Math.ceil(p), a = CTR_CURVE[Math.max(lo, 1)], b = CTR_CURVE[Math.min(hi, 10)]; return a + (b - a) * (p - lo); } return Math.max(0.002, 0.018 * Math.pow(0.82, p - 10)); }

  // ---- Query coverage: do the page's real top search queries appear in its title/meta? ----
  function queryCoverage(text, queryStats, limit) {
    const hay = norm(text), list = (Array.isArray(queryStats) ? queryStats : []).map((x) => (typeof x === 'string' ? { q: x, impressions: 1 } : x)).filter((x) => x && x.q).slice(0, limit || 5);
    const rows = list.map((x) => { const t = tokens(x.q); if (!t.length) return null; const hit = t.filter((w) => hay.includes(w)).length; return { q: x.q, impressions: Number(x.impressions || 0), coverage: hit / t.length }; }).filter(Boolean);
    const total = rows.reduce((a, r) => a + Math.max(r.impressions, 1), 0);
    const weighted = total ? rows.reduce((a, r) => a + r.coverage * Math.max(r.impressions, 1), 0) / total : 1;
    return { coverage: Math.round(weighted * 100) / 100, uncovered: rows.filter((r) => r.coverage < 0.6), rows };
  }

  // ---- Learning ledger: one compact record per page, survives the 30-entry history cap ----
  const LEDGER_MAX = 300;
  function ledgerOf(l) { return l && typeof l === 'object' && !Array.isArray(l) ? l : {}; }
  function updateLedger(ledger, entry, now) {
    const L = Object.assign({}, ledgerOf(ledger)); if (!entry || entry.post_id == null || entry.post_id === '') return L;
    const id = String(entry.post_id), cur = Object.assign({ post_id: entry.post_id, failures: [], applied: null }, L[id] || {}); const at = Number(now) || Date.now();
    cur.url = String(entry.url || cur.url || '').slice(0, 300); cur.title = String(entry.title || cur.title || '').slice(0, 120); cur.lastAt = at;
    if (entry.status === 'failed') cur.failures = (cur.failures || []).concat([at]).slice(-5);
    if (entry.status === 'applied') {
      cur.failures = [];
      const b = entry.baseline && typeof entry.baseline === 'object' ? { impressions: Number(entry.baseline.impressions) || 0, clicks: Number(entry.baseline.clicks) || 0, ctr: Number(entry.baseline.ctr) || 0, position: Number(entry.baseline.position) || 0 } : null;
      cur.applied = { at, status: 'applied', change_id: String(entry.change_id || ''), baseline: b, rolled_back: false, before: entry.before ? { seo_title: String(entry.before.seo_title || '').slice(0, 200) } : null, after: entry.after ? { seo_title: String(entry.after.seo_title || '').slice(0, 200), meta_description: String(entry.after.meta_description || '').slice(0, 300) } : null };
    }
    L[id] = cur;
    const keys = Object.keys(L); if (keys.length > LEDGER_MAX) keys.sort((a, b) => (L[a].lastAt || 0) - (L[b].lastAt || 0)).slice(0, keys.length - LEDGER_MAX).forEach((k) => { delete L[k]; });
    return L;
  }
  function ledgerMarkRolledBack(ledger, changeId) {
    const L = Object.assign({}, ledgerOf(ledger)); Object.keys(L).forEach((k) => { if (L[k].applied && L[k].applied.change_id === changeId) L[k] = Object.assign({}, L[k], { applied: Object.assign({}, L[k].applied, { rolled_back: true }) }); }); return L;
  }
  function ledgerVerdicts(ledger, perfByUrl, now, opts) {
    const L = ledgerOf(ledger), out = {};
    Object.keys(L).forEach((k) => { const r = L[k]; if (r.applied) out[k] = assessLocalImpact(Object.assign({ url: r.url }, r.applied), (perfByUrl || {})[normUrl(r.url)], now, opts); });
    return out;
  }
  // Adaptive per-page cooldown: leave winners alone, give neutral/declined pages time, stop retrying pages the model keeps failing on.
  const COOL = { improved: 60, declined: 45, neutral: 30, waiting: 14, other: 21, failure: 7 };
  function buildCooldowns(ledger, perfByUrl, now, opts) {
    const L = ledgerOf(ledger), v = ledgerVerdicts(L, perfByUrl, now, opts), out = {}, DAY = 86400000; const days = Object.assign({}, COOL, (opts && opts.days) || {});
    Object.keys(L).forEach((k) => { const r = L[k]; let until = 0, why = '', verdict = '';
      if (r.applied && !r.applied.rolled_back) {
        verdict = v[k] ? v[k].verdict : 'other'; const d = days[verdict] != null ? days[verdict] : days.other; until = r.applied.at + d * DAY;
        why = { improved: 'اصلاح قبلی جواب داد؛ دست نمی‌خورد', declined: 'اصلاح قبلی افت داشت؛ ابتدا بازگردانی/بررسی', neutral: 'اصلاح قبلی اثر معناداری نداشت؛ زمان بیشتر', waiting: 'هنوز اثر اصلاح قبلی سنجیده نشده' }[verdict] || 'اصلاح اخیر';
      }
      const recent = (r.failures || []).filter((t) => now - t < 14 * DAY);
      if (recent.length >= 2) { const f = recent[recent.length - 1] + days.failure * DAY; if (f > until) { until = f; why = 'مدل چند بار روی این صفحه ناموفق بود'; verdict = 'failing'; } }
      if (until > now) out[k] = { until, why, verdict };
    });
    return out;
  }
  // Short Persian lessons for the prompt: what happened last time on this page + style of what worked elsewhere.
  function buildLessons(ledger, postId, perfByUrl, now, opts) {
    const L = ledgerOf(ledger), v = ledgerVerdicts(L, perfByUrl, now, opts), parts = [], mine = L[String(postId)];
    if (mine && mine.applied && mine.applied.after && !mine.applied.rolled_back) {
      const vd = v[String(postId)] && v[String(postId)].verdict;
      if (vd === 'declined' || vd === 'neutral') parts.push('عنوان اصلاح‌شدهٔ قبلی همین صفحه («' + mine.applied.after.seo_title + '») ' + (vd === 'declined' ? 'باعث افت نرخ کلیک شد' : 'اثر معناداری نداشت') + '؛ زاویهٔ متفاوتی انتخاب کن و آن را تکرار نکن.');
    }
    const wins = Object.keys(L).filter((k) => k !== String(postId) && v[k] && v[k].verdict === 'improved' && L[k].applied && L[k].applied.after && L[k].applied.after.seo_title).sort((a, b) => (v[b].ctrChange || 0) - (v[a].ctrChange || 0)).slice(0, 2);
    if (wins.length) parts.push('نمونهٔ سبک عنوان‌هایی که روی همین سایت نرخ کلیک را بالا بردند (فقط سبک، نه کپی): ' + wins.map((k) => '«' + L[k].applied.after.seo_title + '»').join('، ') + '.');
    return parts.join(' ');
  }
  const GENERIC = new Set('بررسی آموزش نحوه روش مقایسه انتخاب سفارش ارسال ویژه معتبر اصلی راهنمای مدل مدلهای انواع نمونه تخفیف فروشگاه آنلاین ببینید ببینید. بخوانید مشاهده نکات اطلاعات'.split(' '));
  // Share of significant title/meta words that appear nowhere in the page text, queries or URL (hallucination guard).
  function groundingReport(text, source) {
    const nm = (v) => norm(v).replace(/[\u064B-\u065F\u0670]/g, ''); const hay = nm(source); const words = unique(nm(text).split(' ').filter((w) => w.length >= 4 && !STOP.has(w) && !GENERIC.has(w) && !/^[a-z0-9]+$/.test(w)));
    const miss = words.filter((w) => !hay.includes(w) && !(w.length > 5 && hay.includes(w.slice(0, w.length - 1))) && !(w.length > 5 && hay.includes(w.slice(0, w.length - 2))));
    return { total: words.length, missing: miss, ratio: words.length ? miss.length / words.length : 0 };
  }
  function isHealthy(perf, item) {
    if (!perf || !(perf.impressions >= 100)) return false;
    if (!item.seoTitle || !item.metaDescription) return false;
    return perf.position <= 3.5 && perf.ctr >= expectedCtr(perf.position) * 0.9;
  }
  function rankGrowthCandidates(items, perfByUrl, opts) {
    const o = Object.assign({ targets: [], keywords: [], lastRuns: {}, cooldowns: {}, now: Date.now(), cooldownMs: 21 * 86400000, minScore: 3 }, opts || {});
    const targets = o.targets.map(normUrl), kws = o.keywords.map((k) => String(k).toLowerCase()).filter(Boolean);
    return (Array.isArray(items) ? items : []).filter((it) => it && !(targets.length && !targets.includes(normUrl(it.url)))).map((item) => {
      const perf = (perfByUrl || {})[normUrl(item.url)] || null, reasons = []; let score = 0, fault = 0;
      const title = String(item.seoTitle || ''), meta = String(item.metaDescription || '');
      if (!title) { fault += 4; reasons.push('عنوان سئو خالی است'); } else if (title.length < 25 || title.length > 70) { fault += 2; reasons.push('طول عنوان سئو نامناسب است'); }
      if (!meta) { fault += 4; reasons.push('توضیح متا خالی است'); } else if (meta.length < 70 || meta.length > 180) { fault += 2; reasons.push('طول توضیح متا نامناسب است'); }
      let cov = null;
      if (perf && perf.queryStats && perf.queryStats.length && (title || meta)) {
        cov = queryCoverage(title + ' ' + meta, perf.queryStats, 5);
        if (cov.uncovered.length && perf.impressions >= 50) { fault += Math.min(6, 2 + (1 - cov.coverage) * 6); reasons.push('عبارت پرجستجوی «' + cov.uncovered[0].q + '» در عنوان/متا نیست'); }
      }
      score += fault;
      if (targets.length) { score += 20; reasons.push('جزو URLهای هدف'); }
      const hay = (String(item.title || '') + ' ' + String(item.focusKeyword || '')).toLowerCase();
      if (kws.some((k) => hay.includes(k))) { score += 10; reasons.push('مرتبط با کلمهٔ هدف'); }
      if (item.type === 'product') score += 2;
      let healthy = false;
      if (perf && perf.impressions > 0) {
        const lost = perf.impressions * (expectedCtr(perf.position) - perf.ctr);
        healthy = isHealthy(perf, item) && !targets.length;
        // Impression volume only raises priority when there is something to fix; a healthy high-traffic page is left alone.
        if (lost > 0 || fault > 0) score += Math.min(12, Math.log10(1 + perf.impressions) * 3);
        if (lost > 0) { const s = Math.min(25, Math.log10(1 + lost) * 8); score += s; if (s >= 6) reasons.push('کلیک کمتر از انتظار برای این رتبه (حدود ' + Math.round(lost) + ' کلیک از دست‌رفته)'); }
        if (perf.position > 8 && perf.position < 45 && (lost > 0 || fault > 0)) { score += 8; reasons.push('نزدیک به صفحهٔ اول (میانگین موقعیت ' + (Math.round(perf.position * 10) / 10) + ')'); }
      }
      const last = Number(o.lastRuns[item.id] || 0), cd = (o.cooldowns || {})[String(item.id)];
      const cooling = o.now - last < o.cooldownMs || !!(cd && cd.until > o.now);
      return { item, perf, score: Math.round(score * 100) / 100, reasons, last, cooling, healthy, coverage: cov, cooldown: cd || null };
    }).filter((x) => !x.cooling && !x.healthy && x.score >= o.minScore).sort((a, b) => b.score - a.score);
  }
  function parseJsonLoose(text) {
    const s = String(text || '').replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/i, '').trim();
    try { return JSON.parse(s); } catch (e) { const m = s.match(/\{[\s\S]*\}/); if (!m) return null; try { return JSON.parse(m[0]); } catch (e2) { return null; } }
  }
  const BAD_CLAIMS = [/ضمانت\s*(?:رتبه|صفحه|گوگل)/, /رتبه\s*(?:یک|۱|1)\s*گوگل/, /صفحه\s*(?:اول|۱)\s*گوگل/, /(?:بهترین|ارزان‌?ترین|ارزانترین)\s+(?:قیمت|در\s+ایران|در\s+جهان)/, /100\s*%|۱۰۰\s*(?:%|٪|درصد)/, /\bguarantee/i, /\b(?:best|cheapest)\s+price/i, /(?:لورم|lorem)/i];
  const PRICEY = /(\d[\d,٬.]*|[۰-۹][۰-۹,٬.]*)\s*(?:تومان|ریال|دلار|%|٪|درصد|\$|€)/;
  function validateMetaCandidate(c, ctx) {
    c = c || {}; ctx = ctx || {}; const problems = []; const title = String(c.seo_title || '').trim(), meta = String(c.meta_description || '').trim(), conf = Number(c.confidence || 0);
    const page = String(ctx.content || '') + ' ' + String(ctx.title || '');
    if (conf < 0.72) problems.push('اطمینان مدل کمتر از ۰٫۷۲ است');
    if (title.length < 25 || title.length > 70) problems.push('طول عنوان باید ۲۵ تا ۷۰ نویسه باشد (الان ' + title.length + ')');
    if (meta.length < 70 || meta.length > 180) problems.push('طول توضیح متا باید ۷۰ تا ۱۸۰ نویسه باشد (الان ' + meta.length + ')');
    [title, meta].forEach((s) => { if (BAD_CLAIMS.some((re) => re.test(s))) problems.push('ادعای بی‌مدرک یا تضمین رتبه/قیمت در متن وجود دارد'); });
    [title, meta].forEach((s) => { const m = s.match(PRICEY); if (m && !page.includes(m[0].trim())) problems.push('عدد/قیمت «' + m[0].trim() + '» در متن صفحه پیدا نشد'); });
    if (title && meta && (title === meta || meta.startsWith(title))) problems.push('توضیح متا نباید تکرار عنوان باشد');
    const words = tokens(title); const freq = {}; words.forEach((w) => { if (w.length > 2) freq[w] = (freq[w] || 0) + 1; });
    if (Object.keys(freq).some((w) => freq[w] > 2)) problems.push('کلمه‌ای در عنوان بیش از دو بار تکرار شده (پرکردن کلمهٔ کلیدی)');
    if (title && /[\u0600-\u06FF]/.test(String(ctx.content || '')) && !/[\u0600-\u06FF]/.test(title)) problems.push('عنوان باید فارسی باشد');
    if (/[<>{}\[\]]/.test(title + meta)) problems.push('نویسه‌های نامجاز (HTML/JSON) در خروجی هست');
    const qlist = (Array.isArray(ctx.queries) ? ctx.queries : []).map((x) => (typeof x === 'string' ? x : x && x.q)).filter(Boolean);
    const gr = groundingReport(title + ' ' + meta, page + ' ' + qlist.join(' ') + ' ' + String(ctx.focusKeyword || '') + ' ' + String(ctx.url || ''));
    if (gr.missing.length >= 3 && gr.ratio > 0.4) problems.push('کلمه‌هایی در عنوان/متا هست که در متن صفحه یا عبارت‌های جستجو نیست (' + gr.missing.slice(0, 4).join('، ') + ')؛ فقط از اطلاعات خود صفحه استفاده کن');
    const cov = ctx.queryStats && ctx.queryStats.length ? queryCoverage(title + ' ' + meta, ctx.queryStats, 3) : null;
    return { ok: problems.length === 0, problems: Array.from(new Set(problems)), grounding: Math.round((1 - gr.ratio) * 100) / 100, coverage: cov ? cov.coverage : null };
  }
  function assessLocalImpact(entry, perfNow, now, opts) {
    const o = Object.assign({ minDays: 14, minImpressions: 50, improveCtr: 0.15, declineCtr: 0.25, impressionsGuard: 0.7 }, opts || {});
    if (!entry || entry.status !== 'applied' || entry.rolled_back) return { verdict: 'n/a' };
    const b = entry.baseline; if (!b || !(b.impressions > 0)) return { verdict: 'no_baseline', message: 'پیش از اصلاح داده‌ای از Search Console برای این صفحه ثبت نشده بود.' };
    const days = Math.floor((now - Number(entry.at)) / 86400000); if (days < o.minDays) return { verdict: 'waiting', days, daysLeft: o.minDays - days, message: 'هنوز زود است؛ حدود ' + (o.minDays - days) + ' روز تا سنجش.' };
    if (!perfNow || !(perfNow.impressions >= o.minImpressions)) return { verdict: 'insufficient', days, message: 'دادهٔ تازهٔ Search Console کافی نیست؛ دریافت تازه لازم است.' };
    const ctrB = b.ctr || (b.clicks / b.impressions), ctrN = perfNow.ctr || (perfNow.clicks / perfNow.impressions);
    const ctrChange = ctrB > 0 ? (ctrN - ctrB) / ctrB : (ctrN > 0 ? 1 : 0), impRatio = perfNow.impressions / b.impressions, posDelta = (b.position || 0) - (perfNow.position || 0);
    const det = { days, ctrChange: Math.round(ctrChange * 1000) / 1000, impressionsRatio: Math.round(impRatio * 100) / 100, positionDelta: Math.round(posDelta * 10) / 10 };
    if (ctrChange >= o.improveCtr && impRatio >= o.impressionsGuard) return Object.assign({ verdict: 'improved', message: 'نرخ کلیک بهتر شد.' }, det);
    if (ctrChange <= -o.declineCtr && impRatio >= o.impressionsGuard) return Object.assign({ verdict: 'declined', message: 'نرخ کلیک افت کرد؛ بازگردانی را بررسی کن.' }, det);
    return Object.assign({ verdict: 'neutral', message: 'تغییر معناداری دیده نشد (نوسان فصلی یا کمبود داده هم ممکن است).' }, det);
  }
  function assessHistoryImpact(history, perfByUrl, now, opts) {
    const out = {}; localHistory(history).forEach((e) => { if (e.status === 'applied' && e.change_id) out[e.change_id] = assessLocalImpact(e, (perfByUrl || {})[normUrl(e.url)], now, opts); }); return out;
  }
  function buildRepairHint(problems) { return 'خروجی قبلی رد شد. این اشکال‌ها را رفع کن و فقط JSON برگردان: ' + (problems || []).join('؛ ') + '.'; }
  return { normUrl, queryCoverage, updateLedger, ledgerMarkRolledBack, ledgerVerdicts, buildCooldowns, buildLessons, groundingReport, isHealthy, aggregateGscByPage, expectedCtr, rankGrowthCandidates, parseJsonLoose, validateMetaCandidate, assessLocalImpact, assessHistoryImpact, buildRepairHint, LOCAL_CYCLE, localCycleGate, recordLocalCycle, summarizeLocalHistory, plain, norm, tokens, jaccard, completeness, auditCommerceCatalog, buildKnowledgeGraph, suggestInternalLinks, detectCannibalization, detectPerformanceAnomalies, buildEventPlaybook, preflight, buildOpportunityReport };
});
