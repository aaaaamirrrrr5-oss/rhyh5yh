/* Site Inspector — unified change log (SI.ChangeLog).
 * Pure and testable: merges every journal the app keeps (product repair, text polish, SEO rebuild, server-side agent history)
 * into ONE list of "what the app changed on the site", with grouping by day, filters, a plain-text report, and the
 * rollback plan (which endpoint can undo which entry). It never talks to the network itself.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SI = root.SI || {}, root.SI.ChangeLog = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const FIELD_LABELS = { seo_title: 'عنوان سئو', meta_description: 'توضیحات متا', focus_keyword: 'عبارت کلیدی', title: 'عنوان', excerpt: 'چکیده', content: 'متن', post_content: 'متن', description: 'توضیحات', short_description: 'توضیح کوتاه', alt: 'متن جایگزین تصویر', caption: 'کپشن', slug: 'نشانی', schema_mode: 'اسکیما', faq: 'پرسش‌های متداول', links: 'پیوند داخلی' };
  const SOURCES = { repair: 'ترمیم محصول/مقاله', rebuild: 'بازسازی سئو', agent: 'عامل محتوا', polish: 'اصلاح متن', growth: 'چرخهٔ رشد' };
  const TEXT_FIELDS = new Set(['content', 'post_content', 'description', 'short_description', 'excerpt', 'faq', 'links']);
  const SEO_FIELDS = new Set(['seo_title', 'meta_description', 'focus_keyword', 'schema_mode', 'title', 'slug']);
  const fieldLabel = (f) => FIELD_LABELS[f] || String(f);
  const toMs = (t) => { const n = Number(t) || 0; return n && n < 1e12 ? n * 1000 : n; };
  const kindOf = (fields) => { const f = fields || []; const t = f.some((x) => TEXT_FIELDS.has(x)); const s = f.some((x) => SEO_FIELDS.has(x)); return t ? 'text' : s ? 'seo' : f.length ? 'other' : 'unknown'; };

  /** repairJournal item -> entry. Items written by the polish/text-maker carry the same shape. */
  function fromRepair(j) {
    if (!j || !j.change_id) return null; const fields = Array.isArray(j.fields) ? j.fields : [];
    return { id: String(j.change_id), post_id: Number(j.post_id) || 0, title: j.title || '', url: j.url || '', at: toMs(j.at), source: 'repair', via: 'agent', fields, before: null, after: null, changes: Array.isArray(j.changes) ? j.changes : null, state: 'applied', kind: kindOf(fields) };
  }
  /** Rebuild (autopilot) item: keeps before/after of title and meta, and is undone through /autopilot/rollback. */
  function fromRebuild(j, at) {
    if (!j || !j.change_id) return null; const after = j.after || {}; const fields = Object.keys(after);
    return { id: String(j.change_id), post_id: Number(j.post_id) || 0, title: j.title || '', url: j.url || '', at: toMs(j.at || at), source: 'rebuild', via: 'autopilot', fields, before: j.before || null, after, state: 'applied', kind: kindOf(fields) };
  }
  /** Server-side agent history row (/agent/changes). `ts` is in seconds. */
  function fromAgent(c) {
    if (!c || !c.change_id) return null;
    return { id: String(c.change_id), post_id: Number(c.post_id) || 0, title: c.title || '', url: c.url || '', at: toMs(c.ts), source: 'agent', via: 'agent', fields: Array.isArray(c.fields) ? c.fields : [], before: null, after: null, state: c.state === 'rolled_back' ? 'rolled_back' : 'applied', kind: kindOf(c.fields), note: [c.action, c.post_type].filter(Boolean).join(' · '), auto: /auto/i.test(String(c.mode || '')) };
  }

  /** Merges by change id. Richer data wins (before/after, fields, url); a server "rolled_back" state is final. Newest first, capped. */
  function merge(existing, incoming, cap) {
    const map = new Map(); const take = (e) => {
      if (!e || !e.id) return; const o = map.get(e.id);
      if (!o) { map.set(e.id, Object.assign({}, e)); return; }
      const m = Object.assign({}, o);
      ['title', 'url', 'note'].forEach((k) => { if (!m[k] && e[k]) m[k] = e[k]; });
      if ((!m.fields || !m.fields.length) && e.fields && e.fields.length) m.fields = e.fields;
      if (!m.before && e.before) m.before = e.before; if (!m.after && e.after) m.after = e.after; if (!m.changes && e.changes) m.changes = e.changes;
      if (!m.at && e.at) m.at = e.at; if (!m.post_id && e.post_id) m.post_id = e.post_id;
      if (e.state === 'rolled_back') m.state = 'rolled_back';
      if (o.via === 'autopilot' || e.via === 'autopilot') m.via = 'autopilot';
      if (o.source === 'rebuild' || e.source === 'rebuild') m.source = 'rebuild';
      if (e.auto) m.auto = true; m.kind = kindOf(m.fields);
      map.set(e.id, m);
    };
    (existing || []).forEach(take); (incoming || []).forEach(take);
    return Array.from(map.values()).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, cap || 500);
  }

  function markRolledBack(list, ids, at) {
    const s = new Set((ids || []).map(String));
    return (list || []).map((e) => (s.has(e.id) ? Object.assign({}, e, { state: 'rolled_back', rolledAt: at || Date.now() }) : e));
  }

  const dayStart = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const FILTERS = [['all', 'همه'], ['today', 'امروز'], ['text', 'متن'], ['seo', 'سئو'], ['active', 'قابل برگشت'], ['rolled', 'برگشت‌خورده']];
  function filter(list, key, q, now) {
    const t0 = dayStart(now || Date.now()); const query = String(q || '').trim().toLowerCase();
    return (list || []).filter((e) => {
      if (key === 'today' && !(e.at >= t0)) return false;
      if (key === 'text' && e.kind !== 'text') return false;
      if (key === 'seo' && e.kind !== 'seo') return false;
      if (key === 'active' && e.state !== 'applied') return false;
      if (key === 'rolled' && e.state !== 'rolled_back') return false;
      if (query && !(String(e.title || '').toLowerCase().includes(query) || String(e.post_id).includes(query))) return false;
      return true;
    });
  }

  /** Groups into [{key,label,items}] by calendar day. `fmt(ms)` formats the absolute date. */
  function groupByDay(list, now, fmt) {
    const t0 = dayStart(now || Date.now()); const out = []; let cur = null;
    (list || []).forEach((e) => {
      const d0 = e.at ? dayStart(e.at) : 0; const label = !d0 ? 'بدون تاریخ' : d0 === t0 ? 'امروز' : d0 === t0 - 86400000 ? 'دیروز' : (fmt ? fmt(d0) : new Date(d0).toDateString());
      if (!cur || cur.key !== d0) { cur = { key: d0, label, items: [] }; out.push(cur); } cur.items.push(e);
    });
    return out;
  }

  function summarize(list, now) {
    const t0 = dayStart(now || Date.now()); const s = { total: 0, today: 0, applied: 0, rolled: 0, text: 0, seo: 0, pages: 0 }; const pages = new Set();
    (list || []).forEach((e) => { s.total++; if (e.at >= t0) s.today++; if (e.state === 'rolled_back') s.rolled++; else s.applied++; if (e.kind === 'text') s.text++; if (e.kind === 'seo') s.seo++; if (e.post_id) pages.add(e.post_id); });
    s.pages = pages.size; return s;
  }

  /** What to preview for the "before / after" view: only fields with a known value on both sides. */
  function diffRows(e) {
    const rows = []; const b = e.before || {}; const a = e.after || {};
    // exact changes recorded by the auto-fix (SI.Diff.compact): short fields as before/after, long text as collapsed hunks
    if (Array.isArray(e.changes) && e.changes.length) return e.changes.map((c) => (c.segs ? { field: c.field, label: fieldLabel(c.field), before: '', after: '', segs: c.segs, stats: c.stats } : { field: c.field, label: fieldLabel(c.field), before: String(c.before || ''), after: String(c.after || '') }));
    Object.keys(a).forEach((k) => {
      const bk = k === 'seo_title' || k === 'meta_description' || k in b ? k : k; const bv = b[bk]; const av = a[k];
      if (av == null || typeof av === 'object') return; rows.push({ field: k, label: fieldLabel(k), before: bv == null ? '' : String(bv), after: String(av) });
    });
    return rows;
  }

  /** Groups the entries that can be undone by the endpoint that undoes them (one /autopilot/rollback call for all autopilot ids). */
  function rollbackPlan(entries) {
    const plan = { autopilot: [], agent: [] };
    (entries || []).forEach((e) => { if (e.state !== 'applied' || !e.id) return; (e.via === 'autopilot' ? plan.autopilot : plan.agent).push(e); });
    return plan;
  }

  function toText(list, fmt) {
    const f = fmt || ((ms) => new Date(ms).toISOString());
    return (list || []).map((e) => [e.at ? f(e.at) : '—', SOURCES[e.source] || e.source, '#' + e.post_id, e.title || '', (e.fields || []).map(fieldLabel).join('+'), e.state === 'rolled_back' ? 'برگشت‌خورده' : 'اعمال‌شده', e.id].join(' | ')).join('\n');
  }

  return { FIELD_LABELS, SOURCES, FILTERS, fieldLabel, kindOf, fromRepair, fromRebuild, fromAgent, merge, markRolledBack, filter, groupByDay, summarize, diffRows, rollbackPlan, toText };
});
