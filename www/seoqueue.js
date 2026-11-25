/* Site Inspector — seoqueue.js (v1.103.0)  SI.SeoQueue
 * «صف کار سئو»: خروجی متخصص سئو (عبارت‌های واقعی Search Console و محتوای دارای سال کهنه) را به یک صف
 * اولویت‌دار و مشخص‌به‌محصول تبدیل می‌کند: «کدام محصول، برای کدام عبارت، چه کاری».
 *  - هر کار حداکثر یک بار به‌ازای هر محصول می‌آید (با بالاترین اولویت).
 *  - اولویت عدد ۰ تا ۱۰۰ نسبی است (بیشترین فرصتِ همین صف = ۱۰۰)، نه پیش‌بینی کلیک یا رتبه.
 *  - عبارتی که هیچ محتوایی برایش نیست «ساخت محتوای جدید» می‌شود و محصولی به آن نسبت داده نمی‌شود.
 * منطق خالص: چیزی در سایت نوشته نمی‌شود؛ اجرای هر کار فقط باز کردن همان محصول در «بررسی و ترمیم» است
 * (پیش‌نمایش، تأیید و بازگشت‌پذیری همان مسیر). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.SI = root.SI || {}).SeoQueue = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DIG = '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩'; const MAX_DEFAULT = 25; const MATCH_MIN = 0.67; const STALE_RAW = 40;
  const clean = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  const nrm = (v) => clean(v).replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[۰-۹٠-٩]/g, (d) => String(DIG.indexOf(d) % 10)).replace(/\u200c/g, ' ').toLowerCase();
  const STOP = new Set(['خرید', 'قیمت', 'فروش', 'ارزان', 'بهترین', 'مدل', 'چیست', 'آنلاین', 'اصل', 'کیفیت', 'با', 'برای', 'از', 'در', 'به', 'و', 'یا', 'را', 'که', 'این', 'buy', 'price', 'best']);
  const core = (v) => nrm(v).split(/[^0-9a-z\u0600-\u06ff]+/).filter((t) => t.length >= 2 && !STOP.has(t));
  const live = (it) => it && it.status !== 'trash' && it.status !== 'auto-draft' && it.status !== 'draft';
  const KIND_FA = { gsc_boost: 'تقویت عبارت در محصول', gsc_ctr: 'بهبود عنوان و متا (کم‌کلیک)', gsc_new: 'ساخت محتوای جدید', stale: 'به‌روزرسانی سال کهنه' };
  const EFFORT_FA = { review: 'بازبینی تو (با پیش‌نمایش)', studio: 'نوشتن با اطلاعات واقعی' };

  /** بهترین محصول برای یک عبارت: همپوشانی واژه‌های اصلی ≥ ۶۷٪؛ تساوی ← سند کوتاه‌تر ← شناسهٔ کوچک‌تر. */
  function matchItem(query, docs) {
    const qt = core(query); if (!qt.length) return null; let best = null;
    docs.forEach((d) => {
      const hit = qt.filter((t) => d.set.has(t)).length; const ratio = hit / qt.length; if (ratio < MATCH_MIN) return;
      if (!best || ratio > best.ratio || (ratio === best.ratio && (d.set.size < best.size || (d.set.size === best.size && String(d.it.id) < String(best.d.it.id))))) best = { d, ratio, size: d.set.size };
    });
    return best ? best.d.it : null;
  }

  /**
   * ctx = { items, gscPicks (SeoSpecialist.brief().gsc.picks), stale (SeoSpecialist.staleItems)، done ({taskId:true})، max }
   * خروجی { tasks, open, doneCount, next, counts, total, honesty }.
   */
  function build(ctx) {
    const c = ctx || {}; const items = (Array.isArray(c.items) ? c.items : []).filter(live); const done = c.done && typeof c.done === 'object' ? c.done : {}; const max = c.max > 0 ? Math.floor(c.max) : MAX_DEFAULT;
    const docs = items.map((it) => ({ it, set: new Set(core(clean(it.title) + ' ' + clean(it.focusKeyword) + ' ' + clean(it.metaTitle))) }));
    const byId = new Map(items.map((it) => [String(it.id), it])); const raw = [];
    (Array.isArray(c.gscPicks) ? c.gscPicks : []).forEach((p) => {
      if (!p || !clean(p.query)) return; const imp = Number(p.impressions) || 0; const pos = Number(p.position) || 0; const ctr = Number(p.ctr) || 0; const it = matchItem(p.query, docs);
      const stat = 'نمایش ' + imp + ' · موقعیت ' + pos + ' · کلیک ' + (Number(p.clicks) || 0);
      if (p.kind === 'ctr') {
        raw.push({ kind: 'gsc_ctr', score: Math.max(0, imp * (0.02 - ctr) * 25), it, query: clean(p.query), effort: 'review', reason: 'در صفحهٔ اول است ولی کم‌کلیک (' + stat + ').', action: it ? 'عنوان و توضیح متای «' + clean(it.title) + '» را دقیق‌تر و جذاب‌تر کن؛ عبارت را در ابتدای عنوان بیاور.' : 'صفحهٔ مرتبط با این عبارت در فهرست پیدا نشد؛ آن را در Search Console (بُعد «عبارت + صفحه») ببین و عنوان/متایش را بهتر کن.' });
      } else if (it) {
        raw.push({ kind: 'gsc_boost', score: Math.max(0, imp * (31 - pos) / 20), it, query: clean(p.query), effort: 'review', reason: 'نزدیک صفحهٔ اول است (' + stat + ').', action: 'عبارت را در عنوان سئو، H1 و متن «' + clean(it.title) + '» تقویت کن و از محصولات/مقاله‌های مرتبط پیوند بده.' });
      } else {
        raw.push({ kind: 'gsc_new', score: Math.max(0, imp * (31 - pos) / 20), it: null, query: clean(p.query), effort: 'studio', reason: 'نزدیک صفحهٔ اول است و هیچ محتوایی با این واژه‌ها نیست (' + stat + ').', action: 'صفحه یا مقالهٔ اختصاصی با اطلاعات واقعی برای این عبارت بساز؛ ادعای ساختگی ننویس.' });
      }
    });
    (Array.isArray(c.stale) ? c.stale : []).forEach((s) => {
      const it = s && byId.get(String(s.id)); if (!it) return; const ys = (s.years || []).join('، ');
      raw.push({ kind: 'stale', score: STALE_RAW, it, query: '', effort: 'review', reason: 'سال گذشته در ' + (s.inMeta ? 'توضیح متا' : 'عنوان') + ' است (' + ys + ').', action: 'اول محتوا را واقعاً به‌روز کن، بعد سال را در عنوان/متا اصلاح کن.' });
    });

    // یک کار برای هر محصول: بالاترین امتیاز می‌ماند؛ کار حذف‌شدهٔ «سال کهنه» در توضیح می‌آید.
    raw.sort((a, b) => b.score - a.score || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));
    const taken = new Map(); const kept = [];
    raw.forEach((r) => {
      if (r.it) { const k = String(r.it.id); const prior = taken.get(k); if (prior) { if (r.kind === 'stale' && prior.kind !== 'stale') prior.reason += ' · سال کهنه هم در عنوان/متا هست.'; return; } taken.set(k, r); }
      kept.push(r);
    });
    const top = kept.reduce((m, r) => Math.max(m, r.score), 0);
    const tasks = kept.slice(0, max).map((r, i) => {
      const id = r.kind === 'gsc_new' || !r.it ? 'q:' + nrm(r.query || r.kind) : r.kind + ':' + r.it.id; const isDone = !!done[id];
      return { order: i + 1, id, kind: r.kind, kindFa: KIND_FA[r.kind], effort: r.effort, effortFa: EFFORT_FA[r.effort], priority: top > 0 ? Math.round(r.score / top * 100) : 0, itemId: r.it ? r.it.id : null, itemTitle: r.it ? clean(r.it.title) : '', url: r.it && r.it.url ? r.it.url : '', query: r.query, reason: r.reason, action: r.action, done: isDone };
    });
    const open = tasks.filter((t) => !t.done); const counts = {}; tasks.forEach((t) => { counts[t.kind] = (counts[t.kind] || 0) + 1; });
    return { tasks, open: open.length, doneCount: tasks.length - open.length, next: open[0] || null, counts, total: kept.length, truncated: kept.length > tasks.length,
      honesty: 'اولویت نسبی است (بیشترین فرصتِ همین صف = ۱۰۰) و پیش‌بینی کلیک یا رتبه نیست. هر کار فقط با بازبینی و تأیید خودت اجرا می‌شود.' };
  }

  const csvCell = (v) => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  function toCsv(q) {
    const head = ['اولویت', 'نوع', 'محصول', 'عبارت', 'دلیل', 'اقدام', 'نوع کار', 'انجام شد']; const rows = ((q && q.tasks) || []).map((t) => [t.priority, t.kindFa, t.itemTitle, t.query, t.reason, t.action, t.effortFa, t.done ? 'بله' : 'خیر']);
    return head.join(',') + '\r\n' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  }
  const cell = (v) => clean(v).replace(/[|\r\n]/g, ' ');
  function toMarkdown(q) {
    if (!q) return ''; const L = ['# صف کار سئو', '', '> ' + q.honesty, ''];
    if (!q.tasks.length) { L.push('کاری در صف نیست؛ داده‌ی Search Console یا محتوای کهنه‌ای پیدا نشد.'); return L.join('\n'); }
    q.tasks.forEach((t) => L.push(t.order + '. ' + (t.done ? '~~' : '') + '[' + t.priority + '] ' + cell(t.kindFa) + (t.itemTitle ? ' — ' + cell(t.itemTitle) : '') + (t.query ? ' — «' + cell(t.query) + '»' : '') + (t.done ? '~~' : '') + '\n   - ' + cell(t.reason) + '\n   - ' + cell(t.action)));
    if (q.truncated) L.push('', 'کارهای بیشتری در صف بود که نمایش داده نشد.'); return L.join('\n');
  }

  return { build, matchItem, toCsv, toMarkdown, KIND_FA, EFFORT_FA, MAX_DEFAULT, MATCH_MIN };
});
