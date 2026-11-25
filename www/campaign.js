/* Site Inspector — campaign.js (v1.43.0)
 * SEO campaign engine: one project per site that walks phases 0..6 from zero to a measured result.
 * Step 1: project state, Phase 0 (site profile) and a prioritized task queue built from TechAudit / ContentAudit / LinkGraph.
 * Step 2: Phase 2 keyword map (KeyMap): one keyword + intent per page, cannibalization conflicts and content gaps become tasks.
 * Step 3: Phase 3 on-page optimizer (OnPage): title/meta/H1 issues and ready proposals (AUTO/APPROVE/REVIEW), export for Repair.
 * Step 4: Phase 4 content calendar (ContentPlan): scheduled briefs, draft skeletons with placeholders, link plan and a publish-readiness check.
 * No AI, no API, pure logic. UMD. Never invents facts: the profile uses only crawled data + what the owner typed. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./fatext.js'), require('./techaudit.js'), require('./contentaudit.js'), require('./linkgraph.js'), require('./keymap.js'), require('./onpage.js'), require('./contentplan.js'));
  else root.Campaign = factory(root.FaText, root.TechAudit, root.ContentAudit, root.LinkGraph, root.KeyMap, root.OnPage, root.ContentPlan);
})(typeof self !== 'undefined' ? self : this, function (F, T, C, L, K, O, P) {
  'use strict';
  const PHASES = [
    { id: 'p0', n: 0, title: 'شناخت سایت', goal: 'نوع کسب‌وکار، مخاطب، رقبا و هدف' },
    { id: 'p1', n: 1, title: 'پایهٔ تکنیکال', goal: 'ایندکس، canonical، ریدایرکت، sitemap، سرعت' },
    { id: 'p2', n: 2, title: 'نقشهٔ کلمات کلیدی', goal: 'یک کلمهٔ هدف و نیت برای هر صفحه' },
    { id: 'p3', n: 3, title: 'بهینه‌سازی صفحه‌ها', goal: 'title، meta، متن، سرفصل، لینک داخلی' },
    { id: 'p4', n: 4, title: 'محتوای جدید', goal: 'تقویم محتوا و پیش‌نویس' },
    { id: 'p5', n: 5, title: 'اعتبار و بک‌لینک', goal: 'فهرست فرصت‌ها (بدون ارسال انبوه)' },
    { id: 'p6', n: 6, title: 'اندازه‌گیری و تکرار', goal: 'سنجش قبل/بعد و کار بعدی' },
  ];
  const SEV_W = { critical: 10, high: 6, medium: 3, low: 1 };
  const REVIEW_RE = /redirect|canonical|noindex|robots|sitemap|hreflang|url_|http_[45]|soft_404|not_https|pagination/;
  const AUTO_RE = /^(anchor_empty|anchor_generic|empty_heading|h1_title_mismatch)$/;
  const PHASE_OF = (src) => (src === 'tech' ? 'p1' : 'p3');
  const TYPES = { shop: 'فروشگاهی', content: 'محتوایی/وبلاگ', service: 'خدماتی/شرکتی' };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const nowIso = () => new Date().toISOString();

  function create(opts) {
    opts = opts || {};
    const origin = String(opts.origin || '').replace(/\/+$/, '');
    if (!/^https?:\/\/[^/\s]+/i.test(origin)) throw new Error('origin نامعتبر است');
    const phases = {}; PHASES.forEach((p) => { phases[p.id] = { status: 'todo' }; });
    return { v: 1, id: 'c_' + Date.now().toString(36), origin, createdAt: nowIso(), goal: opts.goal || null, answers: {}, profile: null, phases, tasks: [], baseline: null, log: [] };
  }

  /* ---------- Phase 0: site profile ---------- */
  function persianRatio(text) {
    const s = String(text || '').slice(0, 20000); const fa = (s.match(/[\u0600-\u06FF]/g) || []).length, la = (s.match(/[A-Za-z]/g) || []).length;
    return fa + la ? fa / (fa + la) : 0;
  }
  function buildProfile(pages, answers) {
    answers = answers || {};
    const live = (pages || []).filter((p) => p && p.status === 200);
    const counts = {}; live.forEach((p) => { const t = C.pageType(p); counts[t] = (counts[t] || 0) + 1; });
    const n = live.length || 1, prod = counts.product || 0, art = counts.article || 0;
    const hasProductSchema = live.some((p) => (p.schemaTypes || []).indexOf('Product') >= 0);
    const kind = answers.kind || (prod / n >= 0.25 || hasProductSchema && prod ? 'shop' : art / n >= 0.4 ? 'content' : 'service');
    const text = live.slice(0, 40).map((p) => (p.title || '') + '. ' + (p.h1 || '')).join('\n');
    let phrases = []; try { phrases = F.keyPhrases(text, 12).map((x) => (typeof x === 'string' ? x : x.phrase || x.p || x.text || '')).filter(Boolean); } catch (e) { phrases = []; }
    const schemaPages = live.filter((p) => (p.schemaTypes || []).length).length;
    const sample = live.slice(0, 20).map((p) => p.text || '').join(' ');
    const fa = persianRatio(sample);
    const missing = ['audience', 'competitors', 'region', 'goal'].filter((k) => !answers[k] || (Array.isArray(answers[k]) && !answers[k].length));
    return {
      builtAt: nowIso(), pages: live.length, types: counts, kind, kindFa: TYPES[kind], language: fa >= 0.5 ? 'fa' : 'en', rtl: fa >= 0.5,
      topTopics: phrases.slice(0, 8), schemaCoverage: +(schemaPages / n).toFixed(2),
      goal: answers.goal || null, audience: answers.audience || null, region: answers.region || null,
      competitors: (answers.competitors || []).slice(0, 5), missing,
      complete: missing.length === 0,
    };
  }
  function questions(profile) {
    const Q = {
      goal: { q: 'هدف اصلی سایت چیست؟', options: ['فروش', 'جذب مشتری (لید)', 'ترافیک و دیده‌شدن', 'برند و اعتبار'] },
      audience: { q: 'مخاطب اصلی چه کسانی هستند؟', free: true },
      region: { q: 'بازار هدف کجاست؟', options: ['کل ایران', 'یک شهر/استان', 'فارسی‌زبانان جهان'] },
      competitors: { q: 'حداکثر ۳ سایت رقیب را بنویس', free: true },
    };
    return ((profile && profile.missing) || Object.keys(Q)).map((k) => Object.assign({ key: k }, Q[k]));
  }

  /* ---------- Phase 1/3: prioritized task queue ---------- */
  function tierOf(code) { return REVIEW_RE.test(code) ? 'review' : AUTO_RE.test(code) ? 'auto' : 'approve'; }
  function toTasks(issues, src) {
    return (issues || []).map((i) => {
      const effort = clamp(i.effort || 2, 1, 5), sev = SEV_W[i.severity] || 1;
      const score = +((sev * Math.log2(1 + (i.count || 1))) / effort).toFixed(2);
      return { id: src + ':' + i.code, src, phase: PHASE_OF(src), code: i.code, severity: i.severity, title: i.title, detail: i.detail || '', fix: i.fix || '', count: i.count || 0, urls: (i.urls || []).slice(0, 20), effort, score, tier: tierOf(i.code), status: 'open' };
    });
  }
  function runAudits(pages, site) {
    const tech = T.audit(pages, site), content = C.audit(pages, site), links = L.analyze(pages, site);
    const tasks = [].concat(toTasks(tech.issues, 'tech'), toTasks(content.issues, 'content'), toTasks(links.issues, 'links')).sort((a, b) => b.score - a.score);
    const scores = { tech: tech.score, content: content.score, links: links.score };
    const health = Math.round((scores.tech * 0.4 + scores.content * 0.35 + scores.links * 0.25));
    return { tasks, scores, health, stats: { tech: tech.stats, links: links.stats } };
  }

  /* ---------- project operations ---------- */
  function applyAudit(project, pages, site) {
    const r = runAudits(pages, site), done = new Map(project.tasks.filter((t) => t.src !== 'keymap' && t.src !== 'onpage' && t.src !== 'plan' && t.status !== 'open').map((t) => [t.id, t]));
    const kept = project.tasks.filter((t) => t.src === 'keymap' || t.src === 'onpage' || t.src === 'plan');
    project.tasks = r.tasks.map((t) => (done.has(t.id) ? Object.assign(t, { status: done.get(t.id).status }) : t)).concat(kept).sort((a, b) => b.score - a.score);
    const snap = { at: nowIso(), health: r.health, scores: r.scores, pages: (pages || []).filter((p) => p && p.status === 200).length, open: project.tasks.filter((t) => t.status === 'open').length };
    if (!project.baseline) project.baseline = snap;
    project.last = snap; project.log.push({ at: snap.at, ev: 'audit', health: snap.health, open: snap.open });
    if (project.log.length > 200) project.log = project.log.slice(-200);
    return project;
  }
  function keymapTasks(km) {
    const T2 = [], mk = (o) => Object.assign({ src: 'keymap', detail: '', fix: '', urls: [], effort: 3, status: 'open' }, o);
    km.conflicts.forEach((c) => {
      const sev = c.severity, score = +(((SEV_W[sev] || 1) * Math.log2(1 + c.pages)) / 3).toFixed(2);
      T2.push(mk({ id: 'keymap:conflict:' + c.keyword, phase: 'p2', code: 'keyword_conflict', severity: sev, title: 'چند صفحه یک کلمه را هدف گرفته‌اند: «' + c.keyword + '»', count: c.pages, urls: [c.winner].concat(c.others.map((o) => o.url)).slice(0, 20), score, tier: 'review', fix: c.action === 'merge_or_differentiate' ? 'صفحه‌ها را ادغام کن (با ریدایرکت ۳۰۱) یا برای هرکدام کلمهٔ طولانی‌دم جدا انتخاب کن. صفحهٔ اصلی: ' + c.winner : 'نیت جستجو فرق دارد؛ برای صفحه‌های فرعی کلمهٔ جدا انتخاب کن.' }));
    });
    const low = km.pages.filter((p) => p.confidence === 'low');
    if (low.length) T2.push(mk({ id: 'keymap:low_confidence', phase: 'p2', code: 'keyword_low_confidence', severity: 'low', title: 'کلمهٔ هدف این صفحه‌ها نامشخص است', count: low.length, urls: low.map((p) => p.url).slice(0, 20), score: +(Math.log2(1 + low.length) / 2).toFixed(2), tier: 'approve', effort: 2, fix: 'کلمهٔ هدف را خودت تعیین کن و آن را در title و H1 بیاور.' }));
    km.gaps.forEach((g) => T2.push(mk({ id: 'keymap:gap:' + g.topic, phase: 'p4', code: 'content_gap', severity: g.source === 'seed' ? 'medium' : 'low', title: 'موضوع بدون صفحهٔ اختصاصی: «' + g.topic + '»', count: 1, score: +((g.source === 'seed' ? 3 : 1) * 1 / 4).toFixed(2), tier: 'approve', effort: 4, fix: 'یک صفحهٔ اختصاصی (' + K.INTENT_FA[g.intent] + ') برای این موضوع بساز.' })));
    return T2;
  }
  function applyKeymap(project, pages) {
    const km = K.build(pages, { profile: project.profile, seeds: project.answers && project.answers.seeds, locked: project.lockedKeywords });
    const prev = new Map(project.tasks.filter((t) => t.src === 'keymap' && t.status !== 'open').map((t) => [t.id, t.status]));
    const fresh = keymapTasks(km).map((t) => (prev.has(t.id) ? Object.assign(t, { status: prev.get(t.id) }) : t));
    project.keymap = km; project.tasks = project.tasks.filter((t) => t.src !== 'keymap').concat(fresh).sort((a, b) => b.score - a.score);
    project.phases.p2.status = fresh.some((t) => t.phase === 'p2' && t.status === 'open') ? 'active' : 'done';
    project.log.push({ at: km.at, ev: 'keymap', mapped: km.stats.mapped, conflicts: km.conflicts.length, gaps: km.gaps.length });
    return project;
  }
  function onpageTasks(op) {
    const tierFor = (code, items) => (code.indexOf('h1_') === 0 || code === 'intro_no_kw' ? 'review' : items.some((it) => it.proposals.some((p) => p.tier === 'auto' && p.field === (code.indexOf('title_') === 0 ? 'seo_title' : 'meta_description') && it.codes.indexOf(code) >= 0)) ? 'auto' : 'approve');
    return op.issues.map((i) => ({ id: 'onpage:' + i.code, src: 'onpage', phase: 'p3', code: i.code, severity: i.severity, title: i.title, detail: '', fix: '', count: i.count, urls: i.urls, effort: i.code.indexOf('h1_') === 0 || i.code === 'intro_no_kw' ? 3 : 1, score: 0, tier: tierFor(i.code, op.items), status: 'open' }))
      .map((t) => Object.assign(t, { score: +(((SEV_W[t.severity] || 1) * Math.log2(1 + t.count)) / t.effort).toFixed(2) }));
  }
  function applyOnpage(project, pages) {
    if (!project.keymap) throw new Error('ابتدا نقشهٔ کلمات را بساز');
    const op = O.analyze(pages, project.keymap), prev = new Map(project.tasks.filter((t) => t.src === 'onpage' && t.status !== 'open').map((t) => [t.id, t.status]));
    const fresh = onpageTasks(op).map((t) => (prev.has(t.id) ? Object.assign(t, { status: prev.get(t.id) }) : t));
    project.onpage = { at: op.at, brand: op.brand, stats: op.stats, items: op.items.slice(0, 300) };
    project.tasks = project.tasks.filter((t) => t.src !== 'onpage').concat(fresh).sort((a, b) => b.score - a.score);
    project.log.push({ at: op.at, ev: 'onpage', issues: fresh.length, proposals: op.stats.proposals });
    return project;
  }
  function applyContentPlan(project, opts) {
    if (!project.keymap) throw new Error('ابتدا نقشهٔ کلمات را بساز');
    const briefs = P.plan(project.keymap, project.profile, opts), prev = new Map(project.tasks.filter((t) => t.src === 'plan' && t.status !== 'open').map((t) => [t.id, t.status]));
    const fresh = briefs.map((b) => ({ id: b.id, src: 'plan', phase: 'p4', code: 'new_content', severity: b.source === 'seed' ? 'medium' : 'low', title: 'بنویس (' + b.date + '): ' + b.title, detail: '', fix: 'نوع: ' + (b.type === 'category' ? 'صفحهٔ دسته' : 'مقاله') + ' — حداقل ' + b.minWords + ' واژه', count: 1, urls: b.linksIn.map((l) => l.from), effort: 4, score: +((b.source === 'seed' ? 3 : 1) / 4).toFixed(2), tier: 'approve', status: prev.get(b.id) || 'open' }));
    project.contentplan = { at: new Date().toISOString(), perWeek: (opts && opts.perWeek) || 2, briefs };
    project.tasks = project.tasks.filter((t) => t.src !== 'plan').concat(fresh).sort((a, b) => b.score - a.score);
    project.log.push({ at: project.contentplan.at, ev: 'contentplan', briefs: briefs.length });
    return project;
  }
  const briefOf = (project, id) => { const b = project.contentplan && project.contentplan.briefs.find((x) => x.id === id); if (!b) throw new Error('بریف پیدا نشد'); return b; };
  const draftFor = (project, id, facts) => P.skeleton(briefOf(project, id), facts);
  const checkDraft = (project, id, text) => P.check(text, briefOf(project, id));
  function setProfile(project, pages, answers) {
    project.answers = Object.assign({}, project.answers, answers || {});
    project.profile = buildProfile(pages, project.answers);
    project.phases.p0.status = project.profile.complete ? 'done' : 'active';
    project.log.push({ at: nowIso(), ev: 'profile', complete: project.profile.complete });
    return project;
  }
  function phaseProgress(project, id) {
    const ts = project.tasks.filter((t) => t.phase === id);
    if (!ts.length) return id === 'p0' ? (project.phases.p0.status === 'done' ? 1 : 0) : null;
    return +(ts.filter((t) => t.status !== 'open').length / ts.length).toFixed(2);
  }
  function setTask(project, id, status) {
    const t = project.tasks.find((x) => x.id === id); if (!t) return null;
    if (['open', 'done', 'skipped'].indexOf(status) < 0) throw new Error('وضعیت نامعتبر');
    t.status = status; project.log.push({ at: nowIso(), ev: 'task', id, status });
    ['p1', 'p2', 'p3', 'p4'].forEach((p) => { const pr = phaseProgress(project, p); if (pr !== null) project.phases[p].status = pr === 1 ? 'done' : pr > 0 ? 'active' : project.phases[p].status; });
    return t;
  }
  function nextAction(project) {
    if (!project.profile) return { phase: 'p0', kind: 'profile', text: 'ابتدا سایت را بخز تا پروفایلش ساخته شود.' };
    if (!project.profile.complete) return { phase: 'p0', kind: 'questions', text: 'به چند سؤال دربارهٔ سایتت پاسخ بده.', questions: questions(project.profile) };
    if (!project.last) return { phase: 'p1', kind: 'audit', text: 'بررسی تکنیکال و محتوایی را اجرا کن.' };
    const open = project.tasks.filter((t) => t.status === 'open');
    const p1 = open.filter((t) => t.phase === 'p1' && (t.severity === 'critical' || t.severity === 'high'));
    if (p1.length) return { phase: 'p1', kind: 'tasks', text: 'اول مشکل‌های تکنیکال جدی را درست کن.', tasks: p1.slice(0, 3) };
    if (!project.keymap) return { phase: 'p2', kind: 'keymap', text: 'نقشهٔ کلمات کلیدی را بساز (یک کلمه و نیت برای هر صفحه).' };
    if (open.length) return { phase: open[0].phase, kind: 'tasks', text: 'بهترین کارهای بعدی بر اساس اثر:', tasks: open.slice(0, 3) };
    return { phase: 'p4', kind: 'next-phase', text: 'کارهای فعلی تمام شد؛ مرحلهٔ بعد: تقویم محتوای جدید.' };
  }
  function summary(project) {
    const open = project.tasks.filter((t) => t.status === 'open');
    return { origin: project.origin, health: project.last ? project.last.health : null, delta: project.last && project.baseline ? project.last.health - project.baseline.health : 0, open: open.length, content: project.contentplan ? { briefs: project.contentplan.briefs.length, next: (project.contentplan.briefs[0] || {}).date || null } : null, onpage: project.onpage ? project.onpage.stats : null, keymap: project.keymap ? { mapped: project.keymap.stats.mapped, total: project.keymap.stats.total, conflicts: project.keymap.conflicts.length, gaps: project.keymap.gaps.length } : null, byTier: { auto: open.filter((t) => t.tier === 'auto').length, approve: open.filter((t) => t.tier === 'approve').length, review: open.filter((t) => t.tier === 'review').length }, phases: PHASES.map((p) => ({ id: p.id, n: p.n, title: p.title, status: project.phases[p.id].status, progress: phaseProgress(project, p.id) })) };
  }
  const serialize = (project) => JSON.stringify(project);
  function restore(json) {
    const p = typeof json === 'string' ? JSON.parse(json) : json;
    if (!p || p.v !== 1 || !p.origin || !p.phases) throw new Error('پروژهٔ نامعتبر');
    return p;
  }

  return { PHASES, create, buildProfile, questions, runAudits, applyAudit, setProfile, applyContentPlan, draftFor, checkDraft, applyKeymap, applyOnpage, decide: O.decide, plan: O.plan, setKeyword: K.setKeyword, setTask, phaseProgress, nextAction, summary, serialize, restore, tierOf };
});
