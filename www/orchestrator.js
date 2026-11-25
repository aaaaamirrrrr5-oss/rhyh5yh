/* Site Inspector multi-agent orchestrator.
 * Agents share a single mission context, execute in a deterministic order,
 * checkpoint after every step, and never write to WordPress themselves.
 * A separate approval/apply flow remains responsible for all mutations.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SI = root.SI || {}, root.SI.Orchestrator = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const AGENTS = [
    { id: 'seo', name: 'SEO Agent', label: 'عامل سئو', role: 'تحلیل فنی و محتوایی SEO', scope: 'crawl, indexability, titles, descriptions, canonical, internal links, keyword intent', order: 10 },
    { id: 'geo', name: 'GEO Agent', label: 'عامل GEO', role: 'آماده‌سازی محتوا برای موتورهای پاسخ و جستجوی مولد', scope: 'source transparency, entity clarity, topical evidence, unique first-hand information, citations', order: 20 },
    { id: 'aeo', name: 'AEO Agent', label: 'عامل AEO', role: 'بهینه‌سازی پاسخ‌پذیری و قابلیت استناد', scope: 'direct answers, concise explanations, structured data validity, question coverage, bot access', order: 30 },
    { id: 'content', name: 'Content Agent', label: 'عامل محتوا', role: 'ارزیابی و برنامه‌ریزی تولید/بهبود محتوا', scope: 'articles, pages, product copy, content quality, duplication, editorial opportunities', order: 40 },
    { id: 'commerce', name: 'WooCommerce Agent', label: 'عامل فروشگاه', role: 'بررسی اطلاعات و کیفیت داده‌های محصولات', scope: 'product titles, descriptions, attributes, variants, category coverage, stock/pricing consistency checks', order: 50 },
    { id: 'competitor', name: 'Competitor Agent', label: 'عامل رقبا', role: 'تحلیل فرصت رقابتی و شکاف محتوایی', scope: 'competitor topics, keyword gaps, external source trends, opportunity prioritization', order: 60 },
    { id: 'technical', name: 'Technical Agent', label: 'عامل فنی', role: 'بررسی فنی، خزش و تجربه کاربری', scope: 'robots, sitemap, HTTP status, links, metadata, structured data, performance data', order: 70 },
    { id: 'analytics', name: 'Analytics Agent', label: 'عامل تحلیل داده', role: 'تفسیر داده‌های Search Console, Analytics and Webmaster', scope: 'clicks, impressions, CTR, positions, sessions, conversions, crawl metrics', order: 80 },
    { id: 'quality', name: 'Quality & Safety Agent', label: 'عامل کنترل کیفیت', role: 'بازبینی خروجی همهٔ عامل‌ها و کنترل ادعاها', scope: 'fact checking, source freshness, conflicts, confidence, risks, approval requirements', order: 90 },
  ];
  const SECRET_RE = /(api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|password|authorization|bearer\s+)/i;
  const now = () => new Date().toISOString();
  const id = () => 'si-mission-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  function safeText(value, max) {
    const s = String(value == null ? '' : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ').trim();
    if (SECRET_RE.test(s)) throw new Error('حافظهٔ بلندمدت اطلاعات محرمانه یا کلید دسترسی نمی‌پذیرد.');
    return s.slice(0, max || 2000);
  }
  function buildContextSummary(ctx) {
    ctx = ctx || {};
    const report = ctx.report || {};
    const counts = report.counts || {};
    const catalog = ctx.catalog || {};
    const items = Array.isArray(catalog.items) ? catalog.items : [];
    const crawl = ctx.crawlReport && !ctx.crawlReport.error ? ctx.crawlReport : null;
    const crawlIssues = crawl && Array.isArray(crawl.issues) ? crawl.issues : [];
    const knowledge = ctx.knowledgeStatus || null;
    const rawIntegrations = ctx.integrations || {};
    const gsc = rawIntegrations.gsc && rawIntegrations.gsc.connected ? rawIntegrations.gsc : null;
    const ga4 = rawIntegrations.ga4 && rawIntegrations.ga4.connected ? rawIntegrations.ga4 : null;
    const bing = rawIntegrations.bing && rawIntegrations.bing.connected ? rawIntegrations.bing : null;
    const psi = rawIntegrations.psi && rawIntegrations.psi.connected ? rawIntegrations.psi : null;
    const sum = (rows, key) => (Array.isArray(rows) ? rows : []).reduce((n, r) => n + Number(r[key] || 0), 0);
    const gaTotals = {};
    if (ga4 && Array.isArray(ga4.metricHeaders) && Array.isArray(ga4.rows)) {
      ga4.metricHeaders.forEach((name, i) => { gaTotals[name] = ga4.rows.reduce((n, row) => n + Number((row.metrics || [])[i] || 0), 0); });
    }
    const sources = ctx.research && Array.isArray(ctx.research.results) ? ctx.research.results.slice(0, 8).map((r) => ({ title: safeText(r.title || '', 180), domain: safeText(r.domain || r.source || '', 100), date: safeText(r.date || r.published_at || '', 40), url: safeText(r.url || r.link || '', 500) })) : [];
    return {
      site: safeText(report.site || ctx.site || '', 180),
      scannedPages: Number(report.pages && report.pages.length || report.pageCount || 0),
      catalogItems: Number(catalog.total || catalog.sampleSize || items.length || 0),
      catalogComplete: !!catalog.complete,
      severity: { critical: Number(counts.critical || 0), high: Number(counts.high || 0), medium: Number(counts.medium || 0), low: Number(counts.low || 0) },
      bridgeConnected: !!ctx.bridgeConnected,
      externalResearchCount: Number(ctx.research && ctx.research.results && ctx.research.results.length || 0),
      researchSources: sources,
      crawler: crawl ? {
        jobId: safeText(crawl.job_id || '', 80), status: safeText(crawl.status || '', 30),
        pages: Number(crawl.page_count || (Array.isArray(crawl.pages) ? crawl.pages.length : 0)),
        issues: crawlIssues.length, duplicateTitleGroups: (crawl.duplicate_groups && crawl.duplicate_groups.title || []).length,
        duplicateMetaGroups: (crawl.duplicate_groups && crawl.duplicate_groups.meta_description || []).length,
        duplicateContentGroups: (crawl.duplicate_groups && crawl.duplicate_groups.content_exact || []).length,
        statusCounts: crawl.status_counts || {},
      } : null,
      knowledge: knowledge ? { indexed: Number(knowledge.indexed || 0), total: Number(knowledge.total || 0), chunks: Number(knowledge.chunks || 0), mode: safeText(knowledge.mode || '', 30), sourceMode: safeText(knowledge.sourceMode || '', 40), error: !!knowledge.error } : null,
      integrations: {
        connected: Object.keys(rawIntegrations).filter((k) => rawIntegrations[k] && rawIntegrations[k].connected),
        gsc: gsc ? { dimension: gsc.dimension || '', range: gsc.range || null, rows: (gsc.rows || []).length, clicks: sum(gsc.rows, 'clicks'), impressions: sum(gsc.rows, 'impressions') } : null,
        ga4: ga4 ? { range: ga4.range || null, rows: (ga4.rows || []).length, metrics: gaTotals } : null,
        bing: bing ? { trafficRows: (bing.traffic || []).length, queryRows: (bing.queries || []).length, clicks: sum(bing.traffic, 'clicks'), impressions: sum(bing.traffic, 'impressions') } : null,
        pagespeed: psi ? { url: psi.url || '', strategy: psi.strategy || '', scores: psi.scores || {}, metrics: psi.metrics || {} } : null,
      },
    };
  }
  function chooseAgents(goal, context) {
    const q = String(goal || '').toLowerCase();
    if (/رقب|competit|gap|keyword research|تحقیق کلمه/.test(q)) return ['competitor', 'seo', 'content', 'analytics', 'quality'];
    if (/محصول|فروشگاه|woocommerce|ووکامرس/.test(q)) return ['commerce', 'seo', 'content', 'technical', 'quality'];
    if (/geo|aeo|هوش مصنوعی|پاسخ|استناد/.test(q)) return ['geo', 'aeo', 'seo', 'content', 'quality'];
    if (/فنی|سرعت|crawl|خزش|index|ایندکس/.test(q)) return ['technical', 'seo', 'analytics', 'quality'];
    return AGENTS.map((a) => a.id);
  }
  function planMission(input) {
    input = input || {};
    const goal = safeText(input.goal || 'بازرسی جامع و برنامهٔ رشد سایت', 500);
    const context = input.context || {};
    const summary = buildContextSummary(context);
    const selected = Array.isArray(input.agents) && input.agents.length ? input.agents : chooseAgents(goal, context);
    const steps = AGENTS.filter((a) => selected.includes(a.id)).sort((a, b) => a.order - b.order).map((a, i) => ({
      id: a.id, agent: a.name, label: a.label, role: a.role, scope: a.scope,
      priority: i === 0 ? 'high' : (a.id === 'quality' ? 'critical' : 'medium'),
      status: 'pending', startedAt: null, completedAt: null, findings: [], recommendations: [],
      confidence: 0, writesAllowed: false,
      approval: 'تمام تغییرات سایت باید از گردش‌کار جداگانهٔ تأیید/مجوز عبور کنند؛ این مأموریت فقط تحلیل و برنامه‌ریزی می‌کند.',
    }));
    return { id: id(), createdAt: now(), updatedAt: now(), goal, status: 'planned', context: summary, steps, report: null, checkpoint: 0 };
  }
  function localAudit(agentId, ctx) {
    ctx = ctx || {};
    const items = Array.isArray(ctx.catalog && ctx.catalog.items) ? ctx.catalog.items : [];
    const report = ctx.report || {};
    const issues = Array.isArray(report.issues) ? report.issues : (Array.isArray(report.pages) ? report.pages.flatMap((p) => p.issues || []) : []);
    const sev = report.counts || {};
    const findings = [], recommendations = [];
    if (agentId === 'seo') {
      const missingTitle = items.filter((x) => !x.seo_title && !x.meta_title).length;
      const missingDesc = items.filter((x) => !x.meta_description && !x.meta_desc).length;
      findings.push('تعداد محتوای موجود در کاتالوگ: ' + items.length, 'موارد فاقد عنوان SEO قابل‌مشاهده در دادهٔ دریافتی: ' + missingTitle, 'موارد فاقد توضیحات متا در دادهٔ دریافتی: ' + missingDesc);
      recommendations.push('صفحات مهم را بر اساس کلیک و قصد جستجو اولویت‌بندی کن؛ صرفاً تعداد نویسه معیار کیفیت نیست.', 'Canonical، robots، sitemap و پاسخ HTTP صفحات کلیدی را با دادهٔ زنده کنترل کن.');
    } else if (agentId === 'geo' || agentId === 'aeo') {
      const blocked = report.aiReadiness && report.aiReadiness.blocked || [];
      findings.push('گزارش خزش/ربات‌های AI در دسترس: ' + (!!report.aiReadiness), 'تعداد صفحه‌های تحلیل‌شده: ' + (report.pages || []).length, 'تعداد یافته‌های تحقیق خارجی ذخیره‌شده: ' + (ctx.research && ctx.research.results ? ctx.research.results.length : 0));
      if (blocked.length) findings.push('عامل‌های مسدودشده طبق تحلیل robots.txt: ' + blocked.join(', '));
      recommendations.push('برای ادعاهای تخصصی منبع اولیه، تاریخ، نویسنده و شواهد قابل‌بررسی درج کن.', 'به پرسش اصلی در ابتدای صفحه پاسخ روشن بده و سپس جزئیات، محدودیت‌ها و منابع را ارائه کن.');
    } else if (agentId === 'content') {
      const thin = items.filter((x) => String(x.contentPreview || x.excerpt || '').replace(/<[^>]+>/g, ' ').trim().length < 160).length;
      findings.push('محتواهای کم‌اطلاعات بر اساس خلاصهٔ دریافتی: ' + thin);
      if (ctx.knowledgeStatus) findings.push('حافظهٔ سایت: ' + Number(ctx.knowledgeStatus.indexed || 0) + ' از ' + Number(ctx.knowledgeStatus.total || 0) + ' محتوا؛ حالت ' + (ctx.knowledgeStatus.mode || 'واژگانی'));
      recommendations.push('برای هر صفحه قصد جستجوی مشخص و اطلاعات یکتا تعریف کن؛ متن تولیدی را پیش‌نویس نگه دار تا راستی‌آزمایی شود.');
    } else if (agentId === 'commerce') {
      const products = items.filter((x) => x.type === 'product');
      const noDesc = products.filter((x) => !String(x.contentPreview || x.excerpt || '').trim()).length;
      findings.push('محصولات شناسایی‌شده: ' + products.length, 'محصولات فاقد توضیح قابل‌مشاهده در کاتالوگ: ' + noDesc);
      recommendations.push('عنوان، توضیح بلند/کوتاه، ویژگی، تنوع، قیمت، موجودی و دادهٔ ساختاریافته را از منبع واقعی فروشگاه تطبیق بده.');
    } else if (agentId === 'competitor') {
      const research = ctx.research && ctx.research.results || [];
      findings.push('نتایج پژوهش خارجی موجود: ' + research.length);
      recommendations.push('برای شکاف واقعی رقبا، فهرست رقبای مشخص و دادهٔ Search Console/Bing یا نتایج جستجوی قابل‌استناد لازم است؛ RSS به‌تنهایی رتبه یا سهم بازار را ثابت نمی‌کند.');
    } else if (agentId === 'technical') {
      const crawl = ctx.crawlReport && !ctx.crawlReport.error ? ctx.crawlReport : null;
      const crawlIssues = crawl && Array.isArray(crawl.issues) ? crawl.issues : [];
      const duplicate = crawl && crawl.duplicate_groups || {};
      findings.push('مشکلات بحرانی ثبت‌شده: ' + Number(sev.critical || 0), 'مشکلات مهم ثبت‌شده: ' + Number(sev.high || 0), 'تعداد یافته‌های گزارش پایه: ' + issues.length);
      if (crawl) findings.push('خزش فنی: ' + (crawl.status || 'نامشخص') + ' · صفحات: ' + Number(crawl.page_count || 0) + ' · یافته‌ها: ' + crawlIssues.length, 'گروه عنوان تکراری: ' + (duplicate.title || []).length + ' · متای تکراری: ' + (duplicate.meta_description || []).length + ' · محتوای دقیقاً تکراری: ' + (duplicate.content_exact || []).length);
      else recommendations.push('خزش فنی همان دامنه را از بخش مرکز مأموریت اجرا کن تا دادهٔ واقعی HTTP، robots، canonical، لینک و تکرار به این تحلیل اضافه شود.');
      recommendations.push('خطاهای 4xx/5xx، redirect chain، canonical، sitemap، robots، اسکیما و Core Web Vitals را با ابزارهای زنده بررسی کن.');
    } else if (agentId === 'analytics') {
      const active = Object.keys(ctx.integrations || {}).filter((k) => ctx.integrations[k] && ctx.integrations[k].connected);
      findings.push('اتصالات دادهٔ معتبر در این مأموریت: ' + (active.join(', ') || 'هیچ اتصال رسمی تأییدشده‌ای ارائه نشده است.'));
      recommendations.push('برای سنجش عملکرد واقعی، دادهٔ Search Console و GA4 را وصل کن؛ دادهٔ خزش جایگزین کلیک، تبدیل و درآمد نیست.');
    } else if (agentId === 'quality') {
      findings.push('تعداد مشکلات بحرانی: ' + Number(sev.critical || 0), 'تعداد منابع پژوهشی: ' + (ctx.research && ctx.research.results ? ctx.research.results.length : 0));
      recommendations.push('هر ادعای عددی یا تغییر الگوریتم را با منبع رسمی و تاریخ بررسی کن.', 'هیچ اقدام نوشتنی را بدون پیش‌نمایش، نسخهٔ مورد انتظار، مجوز و مسیر بازگردانی اجرا نکن.');
    }
    return { findings, recommendations, confidence: ctx.report ? 55 : 25, evidence: ['تحلیل محلی بر پایهٔ داده‌هایی که در همین مأموریت به اپ تحویل شده‌اند؛ این نتیجه جایگزین دادهٔ کامل سرور یا ابزارهای رسمی نیست.'] };
  }
  async function executeMission(mission, options) {
    options = options || {};
    if (!mission || !Array.isArray(mission.steps)) throw new Error('ساختار مأموریت معتبر نیست.');
    const memory = Array.isArray(options.memory) ? options.memory.slice(0, 30) : [];
    const ctx = options.context || {};
    for (let i = mission.checkpoint || 0; i < mission.steps.length; i++) {
      const step = mission.steps[i]; step.status = 'running'; step.startedAt = now(); mission.status = 'running'; mission.updatedAt = now();
      if (typeof options.onProgress === 'function') options.onProgress(mission, step, i);
      let result;
      try {
        if (typeof options.llm === 'function') result = await options.llm(step, { goal: mission.goal, context: mission.context, memory, local: localAudit(step.id, ctx) });
        if (!result || !Array.isArray(result.findings) || !Array.isArray(result.recommendations)) result = localAudit(step.id, ctx);
        step.findings = result.findings.map((x) => safeText(x, 1200)).slice(0, 12);
        step.recommendations = result.recommendations.map((x) => safeText(x, 1200)).slice(0, 12);
        step.evidence = Array.isArray(result.evidence) ? result.evidence.map((x) => safeText(x, 800)).slice(0, 12) : [];
        step.confidence = Math.max(0, Math.min(100, Number(result.confidence || 0)));
        step.status = 'completed';
      } catch (e) {
        step.status = 'failed'; step.error = safeText(e && e.message || 'خطای نامشخص', 500);
        step.findings = localAudit(step.id, ctx).findings;
      }
      step.completedAt = now(); mission.checkpoint = i + 1; mission.updatedAt = now();
      if (typeof options.onCheckpoint === 'function') options.onCheckpoint(mission);
    }
    mission.status = mission.steps.some((s) => s.status === 'failed') ? 'partial' : 'completed';
    const recommendations = mission.steps.flatMap((s) => s.recommendations.map((text) => ({ agent: s.label, priority: s.priority, text, approved: false })));
    mission.report = { generatedAt: now(), completed: mission.steps.filter((s) => s.status === 'completed').length, failed: mission.steps.filter((s) => s.status === 'failed').length, recommendations, note: 'این گزارش تحلیلی است؛ هیچ تغییری در وردپرس توسط هماهنگ‌کننده اجرا نشده است.' };
    mission.updatedAt = now();
    if (typeof options.onCheckpoint === 'function') options.onCheckpoint(mission);
    return mission;
  }
  function createMemory(input) {
    input = input || {};
    const type = String(input.type || 'site_context');
    const allowed = ['site_context', 'brand_voice', 'strategy', 'content_rules', 'approved_decision', 'verified_fact', 'recurring_insight'];
    if (!allowed.includes(type)) throw new Error('نوع حافظه مجاز نیست.');
    const key = safeText(input.key || '', 100); const value = safeText(input.value || '', 3000);
    if (!key || !value) throw new Error('عنوان و محتوای حافظه الزامی است.');
    return { id: String(input.id || id()), type, key, value, source: safeText(input.source || 'user', 160), verified: !!input.verified, createdAt: input.createdAt || now(), updatedAt: now() };
  }
  function mergeMemory(items, entry, limit) {
    const list = Array.isArray(items) ? items.slice() : [];
    const at = list.findIndex((x) => x.id === entry.id || (x.type === entry.type && x.key === entry.key));
    if (at >= 0) list.splice(at, 1);
    list.unshift(entry); return list.slice(0, Math.max(1, Math.min(100, Number(limit || 50))));
  }
  function exportMissionText(mission) {
    const lines = ['# گزارش مأموریت Site Inspector', '', 'هدف: ' + mission.goal, 'وضعیت: ' + mission.status, ''];
    mission.steps.forEach((s) => { lines.push('## ' + s.label + ' — ' + s.status, 'اطمینان: ' + s.confidence + '٪', '', 'یافته‌ها:', ...s.findings.map((x) => '- ' + x), '', 'پیشنهادها:', ...s.recommendations.map((x) => '- ' + x), ''); });
    lines.push('یادآوری: این مأموریت فقط تحلیل کرده است و هیچ تغییری در سایت اعمال نکرده.');
    return lines.join('\n');
  }
  return { AGENTS, planMission, executeMission, localAudit, createMemory, mergeMemory, buildContextSummary, exportMissionText };
});
