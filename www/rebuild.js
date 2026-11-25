/* Site Inspector SEO Auto-Rebuild engine.
 * Pure, testable pipeline: audit -> plan -> apply (revision-checked) -> journal -> verify -> rollback info.
 * Scope is deliberately limited to the fields the Bridge's safe autopilot accepts (seo_title, meta_description).
 * It never touches post body, prices, URLs, robots, theme or plugins, and never invents facts.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { const SI = require('./engine.js'); require('./brain.js')(SI); module.exports = factory(SI.Brain, require('./polish.js')); }
  else root.SI = root.SI || {}, root.SI.Rebuild = factory(root.SI && root.SI.Brain, root.SI && root.SI.Polish);
})(typeof self !== 'undefined' ? self : this, function (Brain, Polish) {
  'use strict';
  const SAFE_FIELDS = ['seo_title', 'meta_description'];
  // قوانین سئوی گوگل (SeoRules.fixSeoFields): برش امن عنوان > ۶۰ و متا > ۱۶۵ نویسه؛ چیزی اضافه نمی‌کند.
  const fixRules = (f) => { try { const SR = typeof module === 'object' && module.exports ? require('./seorules.js') : ((typeof self !== 'undefined' ? self : globalThis).SI || {}).SeoRules; return SR ? SR.fixSeoFields(f).fields : {}; } catch (e) { return {}; } };
  const INTERVALS = [6, 24, 168]; // hours
  const norm = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase();
  const len = (v) => Array.from(String(v == null ? '' : v)).length;

  const POL = () => { try { if (typeof module === 'object' && module.exports && typeof require === 'function') return require('./seopolicy.js'); } catch (e) {} return (typeof globalThis !== 'undefined' && globalThis.SI && globalThis.SI.SeoPolicy) || null; };
  /** Per-item metadata health, 0..100. Only checks what the rebuild can actually fix. */
  function scoreItem(item, dup) {
    const d = dup || {};
    const title = String(item.metaTitle || '');
    const desc = String(item.metaDescription || '');
    let s = 100;
    if (!title) s -= 15; else if (POL() ? !POL().checkTitle(title).ok : (len(title) < 20 || len(title) > 65)) s -= 20;
    if (!desc) s -= 40; else if (POL() ? !POL().checkMeta(desc).ok : (len(desc) < 70 || len(desc) > 170)) s -= 20;
    if (d.title) s -= 15;
    if (d.description) s -= 15;
    return Math.max(0, s);
  }

  /** Flags items sharing the same non-empty meta title / description. */
  function findDuplicates(items) {
    const t = new Map(), m = new Map(), out = {};
    (items || []).forEach((it) => {
      const id = String(it.id);
      const a = norm(it.metaTitle), b = norm(it.metaDescription);
      if (a) (t.get(a) || t.set(a, []).get(a)).push(id);
      if (b) (m.get(b) || m.set(b, []).get(b)).push(id);
    });
    t.forEach((ids) => { if (ids.length > 1) ids.forEach((id) => { (out[id] = out[id] || {}).title = true; }); });
    m.forEach((ids) => { if (ids.length > 1) ids.forEach((id) => { (out[id] = out[id] || {}).description = true; }); });
    return out;
  }

  function scoreSite(items) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return 0;
    const dup = findDuplicates(list);
    return Math.round(list.reduce((n, it) => n + scoreItem(it, dup[String(it.id)]), 0) / list.length);
  }

  /** Builds validated, safe proposals for one catalog page. Duplicates are regenerated from each item's own text. */
  function planPage(catalog, brief, opts) {
    const items = (catalog && catalog.items) || [];
    const dup = findDuplicates(items);
    const prepared = items.map((it) => {
      const d = dup[String(it.id)];
      if (!d) return it;
      const c = Object.assign({}, it, { issues: (it.issues || []).slice() });
      if (d.title && !c.issues.includes('short_title')) c.issues.push('short_title');
      if (d.description) c.metaDescription = '';
      return c;
    });
    const raw = Brain && Brain.proposeFixes ? Brain.proposeFixes({ catalog: Object.assign({}, catalog, { items: prepared }), brief, bridgeConnected: true }) : [];
    const only = (opts && opts.fields) || SAFE_FIELDS;
    const plan = [];
    const brand = (catalog && catalog.site && catalog.site.name) || (brief && brief.site && brief.site.name) || '';
    const raw2 = refine(items, dup, raw, brand);
    raw2.forEach((p) => {
      const changes = {};
      if (only.includes('seo_title') && typeof p.changes.seo_title === 'string') {
        const v = p.changes.seo_title.trim();
        const fv = fixRules({ seo_title: v }).seo_title || v;
        if ((POL() ? POL().titleAcceptable(fv) && !POL().lintField('title', fv, { evidence: (p.before && (p.before.seo_title || '')) + ' ' + (p.title || '') }).length : (len(fv) >= 5 && len(fv) <= 70)) && norm(fv) !== norm(p.before.seo_title)) changes.seo_title = fv;
      }
      if (only.includes('meta_description') && typeof p.changes.meta_description === 'string') {
        const v0 = p.changes.meta_description.replace(/\s+/g, ' ').trim(); const v = fixRules({ meta_description: v0 }).meta_description || v0;
        if ((POL() ? POL().metaAcceptable(v) && !POL().lintField('meta', v, { evidence: (p.before && (p.before.meta_description || '')) + ' ' + (p.title || '') }).length : (len(v) >= 70 && len(v) <= 200)) && norm(v) !== norm(p.before.meta_description)) changes.meta_description = v;
      }
      if (Object.keys(changes).length) plan.push(Object.assign({}, p, { changes }));
    });
    return plan;
  }

  /**
   * Quality pass over the proposals with the Polish engine: whole-sentence meta descriptions that contain the focus phrase, 20–60 char titles
   * that never cut a word, and titles/metas that are unique across the page (the old planner never fixed duplicate titles).
   * Only EMPTY, duplicated or badly sized values are replaced; a good human-written value is never overwritten.
   */
  function refine(items, dup, raw, brand) {
    if (!Polish) return raw;
    const t = new Map(), m = new Map();
    items.forEach((it) => { const a = norm(it.metaTitle), b = norm(it.metaDescription); if (a) t.set(a, (t.get(a) || 0) + 1); if (b) m.set(b, (m.get(b) || 0) + 1); });
    const byId = new Map(raw.map((p) => [String(p.id), p]));
    const out = [];
    items.forEach((it) => {
      const id = String(it.id); let p = byId.get(id);
      if (!it.id || !it.revision) return;
      const d = dup[id] || {}; const badTitle = !it.metaTitle || d.title || (p && typeof p.changes.seo_title === 'string');
      const badDesc = !it.metaDescription || d.description || (p && typeof p.changes.meta_description === 'string');
      if (!badTitle && !badDesc) { if (p) out.push(p); return; }
      const kind = it.type === 'product' ? 'product' : 'article';
      const g = Polish.seoFields(Object.assign({}, it, { content: it.contentPreview || it.excerpt || '' }), { brand, kind, takenTitle: (v) => (t.get(v) || 0) > 0 && v !== norm(it.metaTitle), takenMeta: (v) => (m.get(v) || 0) > 0 && v !== norm(it.metaDescription) });
      const changes = Object.assign({}, p ? p.changes : {});
      if (badTitle) { if (g.seo_title && len(g.seo_title) >= 20 && norm(g.seo_title) !== norm(it.metaTitle)) changes.seo_title = g.seo_title; else if (d.title) delete changes.seo_title; }
      if (badDesc) { if (g.meta_description && (POL() ? POL().metaAcceptable(g.meta_description) : len(g.meta_description) >= 70) && norm(g.meta_description) !== norm(it.metaDescription)) changes.meta_description = g.meta_description; else if (d.description) delete changes.meta_description; }
      ['seo_title', 'meta_description'].forEach((k) => { const v = changes[k]; if (v) { const key = norm(v); (k === 'seo_title' ? t : m).set(key, ((k === 'seo_title' ? t : m).get(key) || 0) + 1); } });
      if (!Object.keys(changes).length) return;
      if (p) { out.push(Object.assign({}, p, { changes })); return; }
      const labels = []; if (changes.seo_title) labels.push('عنوان سئو'); if (changes.meta_description) labels.push('توضیحات متا');
      out.push({ id: id, post_id: Number(it.id), type: it.type, title: it.title, url: it.url, revision: it.revision, modified: it.modified, changes, labels, excerpt: it.excerpt || '', before: { seo_title: it.metaTitle || '', meta_description: it.metaDescription || '', schema_mode: it.schemaEnabled ? 'auto' : 'off' }, reason: labels.join(' + '), schemaNote: '' });
    });
    // proposals that are not about title/meta (e.g. schema) stay untouched
    raw.forEach((p) => { if (!items.some((it) => String(it.id) === String(p.id))) out.push(p); });
    return out;
  }

  function isDue(state, now) {
    const s = state || {};
    if (!s.enabled) return false;
    const hours = INTERVALS.includes(Number(s.intervalHours)) ? Number(s.intervalHours) : 24;
    return (now || Date.now()) - Number(s.lastRun || 0) >= hours * 3600 * 1000;
  }

  /**
   * Runs one rebuild. `io` supplies: loadPage(offset) -> {items,total,hasMore,site?}, apply(payload) -> {applied,change_id,autopilot_remaining},
   * brief, remaining (daily quota), shouldStop(), onProgress(info).
   * Never throws on per-item failures: they are counted, and quota exhaustion stops cleanly.
   */
  async function run(io, opts) {
    const o = opts || {};
    const report = { at: Date.now(), dryRun: !!o.dryRun, total: 0, scanned: 0, planned: 0, applied: 0, skipped: 0, failed: 0, stoppedBy: '', scoreBefore: 0, scoreAfter: 0, journal: [], failures: [] };
    let remaining = Math.max(0, Number(io.remaining == null ? 0 : io.remaining));
    if (!o.dryRun && !remaining) { report.stoppedBy = 'quota'; return report; }
    const seen = [];
    const stats = { sumBefore: 0, sumAfter: 0, n: 0 };
    let offset = 0, page = await io.loadPage(0);
    report.total = Number(page.total || (page.items || []).length);
    while (page) {
      const items = page.items || [];
      const dup = findDuplicates(items);
      const plan = planPage(page, io.brief, o);
      const byId = new Map(plan.map((p) => [String(p.id), p]));
      for (const it of items) {
        const proposal = byId.get(String(it.id));
        const before = scoreItem(it, dup[String(it.id)]);
        let after = before;
        if (proposal) {
          report.planned++;
          if (o.dryRun) after = scoreItem(Object.assign({}, it, { metaTitle: proposal.changes.seo_title || it.metaTitle, metaDescription: proposal.changes.meta_description || it.metaDescription }), {});
          else if (report.stoppedBy !== 'quota' && !(io.shouldStop && io.shouldStop())) {
            try {
              const res = await io.apply({ post_id: proposal.post_id, expected_revision: proposal.revision, changes: proposal.changes });
              if (res && res.applied && Object.keys(res.applied).length) {
                report.applied++; remaining = res.autopilot_remaining != null ? Number(res.autopilot_remaining) : remaining - 1;
                report.journal.push({ post_id: proposal.post_id, title: proposal.title, url: proposal.url, change_id: res.change_id || '', before: proposal.before, after: res.applied });
                after = scoreItem(Object.assign({}, it, { metaTitle: res.applied.seo_title || it.metaTitle, metaDescription: res.applied.meta_description || it.metaDescription }), {});
              } else report.skipped++;
            } catch (err) {
              report.failed++;
              if (report.failures.length < 5) report.failures.push((proposal.title || proposal.id) + ': ' + (err && err.message ? err.message : 'خطا'));
              if (/سقف روزانه/.test(err && err.message || '')) report.stoppedBy = 'quota';
            }
          } else report.skipped++;
        }
        stats.sumBefore += before; stats.sumAfter += after; stats.n++;
        report.scanned++;
        if (!o.dryRun && remaining <= 0) report.stoppedBy = report.stoppedBy || 'quota';
        if (io.onProgress) io.onProgress({ scanned: report.scanned, total: report.total, applied: report.applied });
      }
      seen.push(...items.map((x) => x.id));
      if (report.stoppedBy || (io.shouldStop && io.shouldStop()) || !page.hasMore || !items.length) { if (!report.stoppedBy && io.shouldStop && io.shouldStop()) report.stoppedBy = 'user'; break; }
      offset += items.length; page = await io.loadPage(offset);
    }
    report.scoreBefore = stats.n ? Math.round(stats.sumBefore / stats.n) : 0;
    report.scoreAfter = stats.n ? Math.round(stats.sumAfter / stats.n) : 0;
    return report;
  }

  function summarize(r) {
    if (!r) return '';
    const stop = r.stoppedBy === 'quota' ? ' (به سقف روزانه رسید؛ اجرای بعدی ادامه می‌دهد)' : r.stoppedBy === 'user' ? ' (توسط کاربر متوقف شد)' : '';
    return (r.dryRun ? 'پیش‌نمایش' : 'بازسازی') + ': بررسی ' + r.scanned + ' از ' + r.total + ' · پیشنهاد ' + r.planned + ' · اعمال ' + r.applied + ' · خطا ' + r.failed + ' · سلامت متادیتا ' + r.scoreBefore + '٪ ← ' + r.scoreAfter + '٪' + stop;
  }

  return { SAFE_FIELDS, INTERVALS, scoreItem, scoreSite, findDuplicates, planPage, isDue, run, summarize };
});
