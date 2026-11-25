/* Site Inspector — exact before/after (SI.Diff).
 * Pure and testable. Turns "what the auto-fix wants to write" into a precise, human-readable change list:
 *  - short fields (SEO title, meta, focus keyword, excerpt): old value -> new value
 *  - long fields (content): token-level diff of the HTML source with collapsed unchanged context, so a changed
 *    heading level, an added alt attribute or one fixed Persian character is visible as exactly that.
 * It never talks to the network and never changes anything.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SI = root.SI || {}, root.SI.Diff = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const LABELS = { seo_title: 'عنوان سئو', meta_description: 'توضیحات متا', focus_keyword: 'عبارت کلیدی', title: 'عنوان', excerpt: 'توضیح کوتاه', content: 'متن کامل' };
  const LONG = new Set(['content', 'post_content', 'description', 'short_description', 'faq']);
  const MAX_LCS = 2500; // tokens per side in the changed middle; beyond this a block is shown as one replacement
  const str = (v) => (v == null ? '' : String(v));

  /** HTML-aware tokens: a tag, a run of whitespace, a word, or one punctuation char. Joining the tokens gives back the exact input. */
  function tokenize(s) { return str(s).match(/<[^>]*>|\s+|[^\s<]+/g) || []; }

  /** Token diff -> [{t:'eq'|'del'|'ins', s}] with adjacent same-type pieces merged. */
  function diffTokens(a, b) {
    const A = tokenize(a), B = tokenize(b); let p = 0;
    while (p < A.length && p < B.length && A[p] === B[p]) p++;
    let ea = A.length, eb = B.length; while (ea > p && eb > p && A[ea - 1] === B[eb - 1]) { ea--; eb--; }
    const out = []; const push = (t, s) => { if (!s) return; const l = out[out.length - 1]; if (l && l.t === t) l.s += s; else out.push({ t, s }); };
    push('eq', A.slice(0, p).join(''));
    const MA = A.slice(p, ea), MB = B.slice(p, eb);
    if (MA.length && MB.length && MA.length <= MAX_LCS && MB.length <= MAX_LCS) {
      const n = MA.length, m = MB.length; const w = m + 1; const L = new Uint16Array((n + 1) * w);
      for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i * w + j] = MA[i] === MB[j] ? L[(i + 1) * w + j + 1] + 1 : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
      let i = 0, j = 0;
      while (i < n && j < m) { if (MA[i] === MB[j]) { push('eq', MA[i]); i++; j++; } else if (L[(i + 1) * w + j] >= L[i * w + j + 1]) { push('del', MA[i]); i++; } else { push('ins', MB[j]); j++; } }
      while (i < n) push('del', MA[i++]); while (j < m) push('ins', MB[j++]);
    } else { push('del', MA.join('')); push('ins', MB.join('')); }
    push('eq', A.slice(ea).join(''));
    return out;
  }

  /** Keeps every change plus `ctx` characters of unchanged text around it; longer unchanged runs become {t:'gap'}. */
  function collapse(segs, ctx) {
    const c = ctx == null ? 60 : ctx; const out = [];
    segs.forEach((g, i) => {
      if (g.t !== 'eq') { out.push(g); return; }
      const first = i === 0, last = i === segs.length - 1; const s = g.s;
      if (s.length <= c * 2 + 20 || (first && last)) { out.push(g); return; }
      if (first) out.push({ t: 'gap' }, { t: 'eq', s: s.slice(-c) });
      else if (last) out.push({ t: 'eq', s: s.slice(0, c) }, { t: 'gap' });
      else out.push({ t: 'eq', s: s.slice(0, c) }, { t: 'gap' }, { t: 'eq', s: s.slice(-c) });
    });
    return out;
  }

  function stats(segs) { const o = { added: 0, removed: 0, hunks: 0 }; let prev = ''; (segs || []).forEach((g) => { if (g.t === 'ins') o.added += g.s.length; if (g.t === 'del') o.removed += g.s.length; if ((g.t === 'ins' || g.t === 'del') && prev !== 'ins' && prev !== 'del') o.hunks++; prev = g.t; }); return o; }

  /** One field -> {field,label,kind,before,after,empty,segs?,stats?}. `kind` is 'text' for long fields, 'value' otherwise. */
  function fieldChange(field, before, after) {
    const b = str(before), a = str(after); const kind = LONG.has(field) ? 'text' : 'value';
    const r = { field, label: LABELS[field] || field, kind, before: b, after: a, empty: !b.trim(), same: b === a };
    if (kind === 'text') { r.segs = collapse(diffTokens(b, a)); r.stats = stats(r.segs); }
    return r;
  }

  const ITEM_KEY = { seo_title: 'metaTitle', meta_description: 'metaDescription', focus_keyword: 'focusKeyword' };
  /** `fields` = what would be written (API field names). `item` = the item as it is now. Only really-different fields are returned. */
  function fieldsDiff(item, fields) {
    const it = item || {}; const out = [];
    Object.keys(fields || {}).forEach((k) => { const cur = it[ITEM_KEY[k] || k]; const c = fieldChange(k, cur, fields[k]); if (!c.same) out.push(c); });
    const order = ['seo_title', 'meta_description', 'focus_keyword', 'excerpt', 'content'];
    return out.sort((x, y) => (order.indexOf(x.field) + 99) % 99 - (order.indexOf(y.field) + 99) % 99);
  }

  const escDefault = (s) => str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  /** Segments -> HTML. Source tags are shown as text (escaped), changes wrapped in <del>/<ins>. */
  function renderSegs(segs, esc) {
    const e = esc || escDefault;
    return (segs || []).map((g) => g.t === 'gap' ? '<span class="d-gap">…</span>' : g.t === 'del' ? '<del class="d-del">' + e(g.s) + '</del>' : g.t === 'ins' ? '<ins class="d-ins">' + e(g.s) + '</ins>' : e(g.s)).join('');
  }

  /** Small form of a field change that is safe to keep in localStorage: values capped, long fields stored as collapsed hunks only. */
  function compact(ch, cap) {
    const lim = cap || 1800; const c = { field: ch.field };
    if (ch.kind === 'text') {
      let used = 0; const segs = [];
      for (const g of ch.segs) { if (g.t === 'gap') { segs.push(g); continue; } const s = g.s.length > 700 ? g.s.slice(0, 700) + '…' : g.s; if (used + s.length > lim) { segs.push({ t: 'gap' }); break; } used += s.length; segs.push({ t: g.t, s }); }
      c.segs = segs; c.stats = ch.stats;
    } else { c.before = ch.before.slice(0, 500); c.after = ch.after.slice(0, 500); }
    return c;
  }
  function compactAll(changes, capTotal) { const n = Math.max(1, changes.length); return changes.map((c) => compact(c, Math.floor((capTotal || 3600) / n))); }

  /** Plain-text version for the chat report / copy. */
  function toText(changes) {
    return (changes || []).map((c) => c.kind === 'text'
      ? '• ' + c.label + ' (+' + c.stats.added + ' / −' + c.stats.removed + ' نویسه، ' + c.stats.hunks + ' نقطه)\n' + c.segs.map((g) => g.t === 'gap' ? ' … ' : g.t === 'del' ? '[-' + g.s + '-]' : g.t === 'ins' ? '{+' + g.s + '+}' : g.s).join('')
      : '• ' + c.label + ': ' + (c.empty ? '(خالی)' : '«' + c.before + '»') + ' ← «' + c.after + '»').join('\n');
  }

  return { LABELS, tokenize, diffTokens, collapse, stats, fieldChange, fieldsDiff, renderSegs, compact, compactAll, toText };
});
