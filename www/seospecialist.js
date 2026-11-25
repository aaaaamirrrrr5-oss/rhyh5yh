/* Site Inspector — seospecialist.js (v1.102.0)  SI.SeoSpecialist
 * «متخصص سئو و به‌روزرسانی»: هر بار که سراغش می‌روی مثل یک متخصص گزارش می‌دهد:
 *  ۱) کلمات کلیدیِ تازه از آخرین بررسی (فرصت‌های KeyFinder که قبلاً ندیده بود)؛
 *  ۲) مسیر رسیدن به امتیاز ۱۰۰: کدام کارها را خود اپ با تأیید تو انجام می‌دهد و کدام‌ها دست انسان/اطلاعات واقعی می‌خواهد؛
 *  ۳) محتوایی که باید به‌روز شود (سال گذشته در عنوان) و اینکه کتابخانهٔ قوانین اپ چقدر قدیمی است؛
 *  ۴) (۱.۱۰۲) عبارت‌های واقعیِ Search Console: نزدیک صفحهٔ اول و پرنمایشِ کم‌کلیک، در صورت اتصال داده.
 * صادقانه: «۱۰۰» یعنی همهٔ بررسی‌های چک‌لیست خود اپ سالم است، نه تضمین رتبهٔ گوگل. اپ حجم جستجو و رتبه را نمی‌داند
 * و قوانین گوگل را خودکار از اینترنت به‌روز نمی‌کند. منطق خالص؛ چیزی در سایت نوشته نمی‌شود. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.SI = root.SI || {}).SeoSpecialist = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DAY = 86400000; const CHECK_EVERY_DAYS = 7; const RULES_AS_OF = '2026-05-15'; const SEEN_CAP = 400;
  const DIG = '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩';
  const clean = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  const nrm = (v) => clean(v).replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[۰-۹٠-٩]/g, (d) => String(DIG.indexOf(d) % 10)).replace(/\u200c/g, ' ').toLowerCase();
  const KIND = { auto: 'auto', manual: 'manual', review: 'review', studio: 'studio' };
  const KIND_FA = { auto: 'خودکار با تأیید تو', review: 'بازبینی تو', studio: 'نوشتن با اطلاعات واقعی', manual: 'دستی در وردپرس' };
  const STATUS_FA = { open: 'باز', improved: 'بهتر شد', worse: 'بدتر شد', done_pending: 'علامت‌خورده، هنوز باز' };

  /** سال‌های گذشته در متن: میلادی 20xx و شمسی 13xx/14xx که از امسال کوچک‌ترند. */
  function staleYears(text, now) {
    const d = now instanceof Date ? now : new Date(now || Date.now()); const gy = d.getFullYear(); let jy = gy - 621;
    try { const n = Number(nrm(new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' }).format(d))); if (n > 1300) jy = n; } catch (e) { /* approx */ }
    const out = []; (nrm(text).match(/(?<!\d)(20\d{2}|13\d{2}|14\d{2})(?!\d)/g) || []).forEach((m) => {
      const y = Number(m); if ((y >= 2000 && y <= gy - 1) || (y >= 1380 && y <= jy - 1)) if (!out.includes(m)) out.push(m);
    });
    return out;
  }
  const live = (it) => it && it.status !== 'trash' && it.status !== 'auto-draft' && it.status !== 'draft';

  function staleItems(items, now) {
    const out = [];
    (Array.isArray(items) ? items : []).forEach((it) => {
      if (!live(it)) return; const ys = staleYears(clean(it.title) + ' ' + clean(it.metaTitle), now); const ym = staleYears(clean(it.metaDescription), now).filter((y) => !ys.includes(y));
      if (ys.length || ym.length) out.push({ id: it.id, title: clean(it.title), url: it.url || '', years: ys.concat(ym), inMeta: !ys.length });
    });
    return out;
  }

  function monthsBetween(fromIso, now) {
    const a = new Date(fromIso + 'T00:00:00Z').getTime(); const b = (now instanceof Date ? now : new Date(now || Date.now())).getTime();
    return Math.max(0, Math.floor((b - a) / (DAY * 30)));
  }

  /** مرحله‌های برنامه به ترتیب اجرا (مرحله‌بندی خود SeoPlan، وگرنه بر پایهٔ اثر). */
  function orderedActions(plan) {
    const p = plan || {}; if (Array.isArray(p.phases) && p.phases.length) { const out = []; p.phases.forEach((ph) => (ph.actions || []).forEach((a) => out.push(a))); if (out.length) return out; }
    return (p.actions || []).slice().sort((a, b) => (b.impact || 0) - (a.impact || 0));
  }

  /* ---------- v1.102: عبارت‌های واقعی Search Console ---------- */
  const GSC_MIN_IMP = 20; const GSC_SEEN_CAP = 600; const GSC_SKIP = /^(mobile|desktop|tablet)$/i;
  const GSC_KIND_FA = { striking: 'نزدیک صفحهٔ اول', ctr: 'در صفحهٔ اول ولی کم‌کلیک' };
  const tokens = (v) => nrm(v).split(/[^0-9a-z\u0600-\u06ff]+/).filter((t) => t.length >= 2);
  const GSC_STOP = new Set(['خرید', 'قیمت', 'فروش', 'ارزان', 'بهترین', 'مدل', 'چیست', 'آنلاین', 'اصل', 'کیفیت', 'با', 'برای', 'از', 'در', 'به', 'و', 'یا', 'را', 'که', 'این', 'buy', 'price', 'best']);
  const coreTokens = (v) => tokens(v).filter((t) => !GSC_STOP.has(t));
  function gscKeywords(rows, o) {
    o = o || {}; const list = Array.isArray(rows) ? rows : []; const minImp = o.minImpressions > 0 ? o.minImpressions : GSC_MIN_IMP;
    const dim = clean(o.dimension).toLowerCase(); const out = { status: 'none', rows: list.length, total: 0, picks: [], newCount: 0, seen: [], first: !(o.prev && Array.isArray(o.prev.gscSeen)), minImpressions: minImp };
    if (!list.length) return out;
    if (dim && dim.indexOf('query') !== 0) { out.status = 'noquery'; return out; }
    const agg = new Map();
    list.forEach((r) => {
      if (!r) return; const keys = Array.isArray(r.keys) && r.keys.length ? r.keys : (r.key ? String(r.key).split(' · ') : []); const q = clean(keys[0]);
      if (!q || /^https?:\/\//i.test(q) || /^\d{4}-\d{2}-\d{2}$/.test(q) || GSC_SKIP.test(q)) return;
      const imp = Number(r.impressions) || 0; if (imp <= 0) return; const k = nrm(q); let a = agg.get(k); if (!a) { a = { query: q, impressions: 0, clicks: 0, posW: 0 }; agg.set(k, a); }
      a.impressions += imp; a.clicks += Number(r.clicks) || 0; a.posW += (Number(r.position) || 0) * imp;
    });
    if (!agg.size) { out.status = 'noquery'; return out; }
    out.status = 'ok'; out.total = agg.size;
    const seen = new Set(o.prev && Array.isArray(o.prev.gscSeen) ? o.prev.gscSeen.map(nrm) : []);
    const docs = (Array.isArray(o.items) ? o.items : []).filter(live).map((it) => new Set(tokens(clean(it.title) + ' ' + clean(it.focusKeyword) + ' ' + clean(it.metaTitle))));
    const picks = [];
    agg.forEach((a, k) => {
      if (a.impressions < minImp) return; const pos = a.posW / a.impressions; const ctr = a.clicks / a.impressions; let kind = null;
      if (pos > 10 && pos <= 30) kind = 'striking'; else if (pos > 0 && pos <= 10 && ctr < 0.02 && a.impressions >= minImp * 2) kind = 'ctr';
      if (!kind) return; const qt = coreTokens(a.query); const covered = qt.length > 0 && docs.some((d) => qt.every((t) => d.has(t)));
      const action = kind === 'ctr' ? 'عنوان و توضیح متای صفحهٔ مرتبط را دقیق‌تر و جذاب‌تر کن؛ نمایش هست ولی کلیک کم است.'
        : covered ? 'عبارت را در عنوان، H1 و متن صفحهٔ مرتبط تقویت کن و پیوند داخلی بده.' : 'صفحه یا مقالهٔ اختصاصی برای این عبارت بساز (در سایت عنوانی با این واژه‌ها دیده نشد).';
      picks.push({ query: a.query, impressions: Math.round(a.impressions), clicks: Math.round(a.clicks), ctr: Math.round(ctr * 1000) / 1000, position: Math.round(pos * 10) / 10, kind, kindFa: GSC_KIND_FA[kind], covered, isNew: !seen.has(k), action, _k: k });
    });
    picks.sort((x, y) => y.impressions - x.impressions);
    out.newCount = picks.filter((x) => x.isNew).length; out.seen = picks.map((x) => x._k).slice(0, GSC_SEEN_CAP);
    out.picks = picks.map((x) => { const y = Object.assign({}, x); delete y._k; return y; });
    return out;
  }

  /**
   * ctx = { plan (SeoPlan.sitePlan), kf (KeyFinder.find), items, saved ({id:{done}}), prev (snapshot قبلی)، now, gsc (ردیف‌های Search Console، اختیاری)، gscDimension }
   * خروجی گزارش متخصص؛ هیچ‌چیز ذخیره نمی‌شود (ذخیرهٔ مبنا با snapshotOf و تأیید کاربر).
   */
  function brief(ctx) {
    const c = ctx || {}; const plan = c.plan || null; const kf = c.kf || null; const prev = c.prev && typeof c.prev === 'object' ? c.prev : null; const now = c.now instanceof Date ? c.now : new Date(c.now || Date.now()); const saved = c.saved || {};
    const score = plan && typeof plan.score === 'number' ? plan.score : null; const potential = plan && typeof plan.potential === 'number' ? Math.max(plan.potential, score == null ? 0 : score) : null;

    const acts = orderedActions(plan); const have = new Set(acts.map((a) => a.id));
    const steps = acts.map((a, i) => {
      const kind = KIND[a.effort] || 'review'; const r = saved[a.id]; const was = r && typeof r.count === 'number' ? r.count : null; const count = a.count || 0;
      let status = r && r.done ? 'done_pending' : 'open'; if (r && !r.done && was != null) status = count < was ? 'improved' : count > was ? 'worse' : 'open';
      return { order: i + 1, id: a.id, title: a.title, count, kind, kindFa: KIND_FA[kind], how: a.how || '', marked: !!(r && r.done), status, statusFa: STATUS_FA[status], was };
    });
    const resolved = Object.keys(saved).filter((id) => saved[id] && saved[id].done && !have.has(id)).length; const next = steps.find((s) => s.status !== 'done_pending') || null;
    const tr = c.trend && typeof c.trend.delta === 'number' && !c.trend.first ? { delta: c.trend.delta, sizeChanged: !!c.trend.sizeChanged } : null;
    const autoSteps = steps.filter((s) => s.kind === 'auto'); const humanSteps = steps.filter((s) => s.kind !== 'auto');

    const seen = new Set(prev && Array.isArray(prev.seen) ? prev.seen.map(nrm) : []); const isFirst = !prev;
    const opps = kf && Array.isArray(kf.opportunities) ? kf.opportunities : [];
    const fresh = opps.filter((o) => o && o.keyword && !seen.has(nrm(o.keyword)));
    const newKeywords = fresh.slice(0, 15).map((o) => ({ keyword: o.keyword, intentFa: o.intentFa || '', score: o.score || 0, support: o.support || 0, action: o.action || '' }));

    const g = gscKeywords(c.gsc, { items: c.items, prev, dimension: c.gscDimension });
    const stale = staleItems(c.items, now);
    const at = prev && Number(prev.at) > 0 ? Number(prev.at) : 0; const daysSince = at ? Math.floor((now.getTime() - at) / DAY) : null;
    const due = !at || daysSince >= CHECK_EVERY_DAYS; const rulesMonths = monthsBetween(RULES_AS_OF, now);
    const freshness = {
      daysSince, due, nextCheckAt: at ? at + CHECK_EVERY_DAYS * DAY : now.getTime() + CHECK_EVERY_DAYS * DAY, everyDays: CHECK_EVERY_DAYS, rulesAsOf: RULES_AS_OF, rulesMonths,
      rulesNote: 'کتابخانهٔ قوانین اپ تا ' + RULES_AS_OF + ' به‌روز شده و خودکار از گوگل دریافت نمی‌شود' + (rulesMonths >= 3 ? ' (حدود ' + rulesMonths + ' ماه پیش)؛ تغییرات تازه را در صفحهٔ Search Central Updates گوگل ببین یا نسخهٔ تازهٔ اپ را بگیر.' : '؛ برای تغییرات تازه صفحهٔ Search Central Updates گوگل را ببین.')
    };

    let verdict = 'برای ارزیابی امتیاز، اول «بررسی محصولات» را اجرا کن.'; let ceiling = null;
    if (score != null) {
      if (score >= 100) verdict = 'امتیاز چک‌لیست اپ ۱۰۰ از ۱۰۰ است؛ فقط پایش دوره‌ای و کلمات تازه می‌ماند.';
      else {
        const reach = Math.min(100, potential); ceiling = reach;
        verdict = autoSteps.length ? 'امتیاز فعلی ' + score + ' است. با اجرای کارهای خودکار (با پیش‌نمایش و تأیید تو) حدود ' + reach + ' می‌شود' + (reach < 100 ? '؛ ' + (100 - reach) + ' امتیاز باقی‌مانده فقط با کار انسانی و اطلاعات واقعی ممکن است (' + humanSteps.length + ' کار).' : '.')
          : 'امتیاز فعلی ' + score + ' است و کار خودکاری نمانده؛ ' + (humanSteps.length ? 'باقی‌مانده ' + humanSteps.length + ' کار دستی/بازبینی است.' : 'مورد بازی دیده نشد.');
      }
    }
    return {
      score, potential, ceiling, verdict, honesty: '«۱۰۰» یعنی همهٔ بررسی‌های چک‌لیست خود اپ سالم است؛ رتبه و ترافیک گوگل را تضمین نمی‌کند و حجم جستجو برای اپ معلوم نیست.',
      steps, next, resolved, trend: tr, autoCount: autoSteps.length, humanCount: humanSteps.length, newKeywords, newKeywordCount: fresh.length, totalOpportunities: opps.length, isFirst,
      stale: stale.slice(0, 12), staleCount: stale.length, freshness,
      gscStatus: g.status, gscKeywords: g.picks.slice(0, 15), gscCount: g.picks.length, gscNewCount: g.newCount, gscFirst: g.first, gscTotal: g.total, gsc: g
    };
  }

  /** مبنای تازه برای «ثبت بررسی»: همهٔ عبارت‌های دیده‌شده تا امروز (سقف ثابت، تازه‌ترین‌ها می‌مانند). */
  function snapshotOf(b, kf, prev, now) {
    const t = now instanceof Date ? now.getTime() : Number(now) || Date.now(); const seen = []; const add = (k) => { const n = nrm(k); if (n && !seen.includes(n)) seen.push(n); };
    ((prev && Array.isArray(prev.seen)) ? prev.seen : []).forEach(add); ((kf && kf.opportunities) || []).forEach((o) => o && add(o.keyword));
    const gs = []; const addG = (k) => { const n = nrm(k); if (n && !gs.includes(n)) gs.push(n); };
    ((prev && Array.isArray(prev.gscSeen)) ? prev.gscSeen : []).forEach(addG); ((b && b.gsc && Array.isArray(b.gsc.seen)) ? b.gsc.seen : []).forEach(addG);
    const snap = { at: t, score: b && typeof b.score === 'number' ? b.score : null, seen: seen.slice(-SEEN_CAP) };
    if (gs.length || (prev && Array.isArray(prev.gscSeen))) snap.gscSeen = gs.slice(-GSC_SEEN_CAP);
    return snap;
  }

  const cell = (v) => clean(v).replace(/[|\r\n]/g, ' ');
  function toMarkdown(b) {
    if (!b) return ''; const L = ['# گزارش متخصص سئو و به‌روزرسانی', '', b.verdict, '', '> ' + b.honesty, ''];
    if (b.steps.length) { L.push('## مسیر رسیدن به امتیاز بالاتر'); b.steps.forEach((s) => L.push(s.order + '. ' + cell(s.title) + ' — ' + s.count + ' مورد · ' + s.kindFa + (s.status !== 'open' ? ' · ' + s.statusFa : '') + (s.how ? '\n   ' + cell(s.how) : ''))); L.push(''); }
    if (b.newKeywords.length) { L.push(b.isFirst ? '## کلمات کلیدی پیشنهادی (اولین بررسی)' : '## کلمات کلیدی تازه از آخرین بررسی'); b.newKeywords.forEach((k) => L.push('- ' + cell(k.keyword) + (k.intentFa ? ' (' + cell(k.intentFa) + ')' : '') + (k.action ? ' — ' + cell(k.action) : ''))); L.push(''); }
    if (b.gscKeywords && b.gscKeywords.length) { L.push(b.gscFirst ? '## عبارت‌های واقعی Search Console (اولین بررسی)' : '## عبارت‌های واقعی Search Console'); b.gscKeywords.forEach((k) => L.push('- ' + cell(k.query) + ' — ' + cell(k.kindFa) + ' · موقعیت ' + k.position + ' · نمایش ' + k.impressions + ' · کلیک ' + k.clicks + (k.isNew && !b.gscFirst ? ' · تازه' : '') + '\n   ' + cell(k.action))); L.push(''); }
    if (b.stale.length) { L.push('## محتوای نیازمند به‌روزرسانی (سال گذشته در عنوان)'); b.stale.forEach((s) => L.push('- ' + cell(s.title) + ' — ' + s.years.join('، '))); L.push(''); }
    if (b.trend) L.push('روند امتیاز نسبت به بررسی قبلی: ' + (b.trend.delta > 0 ? '+' : '') + b.trend.delta + (b.trend.sizeChanged ? ' (تعداد موردها بسیار فرق کرده؛ مقایسه سخت است)' : ''), '');
    L.push('## به‌روز بودن', b.freshness.rulesNote); return L.join('\n');
  }

  return { brief, snapshotOf, toMarkdown, gscKeywords, staleYears, staleItems, orderedActions, GSC_MIN_IMP, GSC_KIND_FA, CHECK_EVERY_DAYS, RULES_AS_OF, KIND_FA, STATUS_FA };
});
