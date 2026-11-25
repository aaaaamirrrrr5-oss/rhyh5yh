/* Site Inspector — keyfinder.js (v1.100.0)  SI.KeyFinder
 * «کشف کلمات کلیدی جدید» مثل یک متخصص سئو، فقط از روی دادهٔ واقعی خود سایت:
 *  ۱) واژگان واقعی محصولات (نوع محصول، برند/نام لاتین، جنس و ویژگی‌هایی که در عنوان‌ها تکرار شده) استخراج می‌شود؛
 *  ۲) از آن‌ها عبارت‌های خرید، قیمت، مقایسه و راهنما ساخته می‌شود (فقط با ترکیب‌هایی که واقعاً در محصولات هست)؛
 *  ۳) هر عبارت با عبارت‌های کلیدی/عنوان‌های موجود سنجیده می‌شود و فقط «فرصت‌های پوشش‌داده‌نشده» می‌ماند.
 * صادقانه: حجم جستجو، رقابت و رتبه را نمی‌داند (نه API دارد نه شبکه). امتیاز فقط «فرصت داخلی» است؛ با Search Console بسنج.
 * منطق خالص؛ چیزی در سایت نوشته نمی‌شود. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.SI = root.SI || {}).KeyFinder = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const clean = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  const DIG = '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩';
  const nrm = (v) => clean(v).replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[۰-۹٠-٩]/g, (d) => String(DIG.indexOf(d) % 10)).replace(/\u200c/g, ' ').toLowerCase();
  const STOP = new Set(['و', 'در', 'از', 'به', 'با', 'برای', 'که', 'یک', 'این', 'را', 'یا', 'تا', 'the', 'and', 'for', 'with', 'of', 'a', 'in', 'to']);
  const GENERIC = new Set(['مدل', 'نوع', 'سری', 'ست', 'بسته', 'عدد', 'گرم', 'کیلو', 'کیلوگرم', 'لیتر', 'سانتی', 'متر', 'میلی', 'جدید', 'اصل', 'اورجینال', 'ارزان', 'فروش', 'خرید', 'قیمت', 'مجموعه', 'کد', 'نسخه', 'رنگ', 'تایی', 'pro', 'plus', 'راهنمای', 'تفاوت', 'چیست']);
  const isNum = (w) => /^[\d.,/x×-]+$/.test(w) || /^\d+[a-z]{1,3}$/i.test(w);
  const isLatin = (w) => /^[a-z][a-z0-9&.'-]{2,}$/i.test(w);
  const keyOf = (t) => t.slice().sort().join(' ');
  const live = (it) => it && (it.type || 'product') === 'product' && it.status !== 'trash' && it.status !== 'auto-draft';

  /** عنوان محصول ← واژه‌های معنادار پشت‌سرهم (بخش پس از «|» و «–» حذف می‌شود). */
  function words(title) {
    const head = clean(title).split(/\s+[|–—•:]\s+/)[0];
    // نیم‌فاصله داخل واژه می‌ماند (قهوه‌ساز یک واژه است)
    return clean(head).replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[۰-۹٠-٩]/g, (d) => String(DIG.indexOf(d) % 10)).toLowerCase().split(/[^\p{L}\p{N}\u200c&.'-]+/u).filter(Boolean).map((w) => w.replace(/^[-.'\u200c]+|[-.'\u200c]+$/g, '')).filter(Boolean);
  }
  const meaningful = (w) => w.length >= 2 && !STOP.has(w) && !GENERIC.has(w) && !isNum(w);

  /** n-gramهای پیوستهٔ ۱ تا ۳ واژه با شمار محصولی که دارند. */
  function topics(prods) {
    const df = new Map(); const ids = new Map(); const hd = new Map();
    prods.forEach((p) => {
      const w = words(p.title); const seen = new Set();
      for (let n = 1; n <= 3; n++) for (let i = 0; i + n <= w.length; i++) {
        const g = w.slice(i, i + n); if (!meaningful(g[0]) || !meaningful(g[n - 1])) continue; if (g.some((x) => STOP.has(x) || isNum(x))) continue;
        if (n === 1 && (g[0].length < 3)) continue; const k = g.join(' '); if (seen.has(k)) continue; seen.add(k); if (i === 0) hd.set(k, (hd.get(k) || 0) + 1);
        df.set(k, (df.get(k) || 0) + 1); if (!ids.has(k)) ids.set(k, []); if (ids.get(k).length < 30) ids.get(k).push(p.id);
      }
    });
    // فقط عبارت‌هایی که دست‌کم در ۲ محصول آمده؛ اگر زیرعبارتی همان شمار والد بلندترش را دارد، والد را نگه می‌داریم
    let list = Array.from(df.entries()).filter(([, n]) => n >= 2).map(([k, n]) => ({ text: k, df: n, ids: ids.get(k), n: k.split(' ').length, head: (hd.get(k) || 0) / n }));
    const singles = list.filter((a) => a.n === 1).sort((a, b) => b.df - a.df); // پیش از حذف زیرعبارت‌ها؛ برای ترکیب «نوع + برند/ویژگی»
    list = list.filter((a) => !list.some((b) => b.n > a.n && b.df === a.df && (' ' + b.text + ' ').includes(' ' + a.text + ' ')));
    list = list.sort((a, b) => b.df - a.df || b.n - a.n); list.singles = singles; return list;
  }

  /** «نوع محصول»: عبارتی که در بیشتر عنوان‌هایش در ابتدای عنوان می‌آید (ویژگی‌هایی مثل جنس و رنگ معمولاً آخر عنوان‌اند). */
  const isType = (t) => t.head >= 0.6 && !isLatin(t.text);

  /** پوشش فعلی: عبارت‌های کلیدی و عنوان‌های ثبت‌شده. */
  function coverage(items) {
    const focus = []; const titles = [];
    (items || []).forEach((it) => { if (!it || it.status === 'trash') return; const f = nrm(it.focusKeyword); if (f) focus.push({ k: f, toks: f.split(' ') }); [it.metaTitle, it.title].forEach((t) => { const x = nrm(t); if (x) titles.push(x); }); });
    return { focus, titles };
  }
  function isCovered(cand, cov) {
    let c = nrm(cand); const pre = c.match(/^(خرید|قیمت|قیمت و خرید) (.+)$/); if (pre && cov.focus.some((f) => f.k === pre[2])) return 'focus'; // صفحه‌ای که روی خودِ موضوع تمرکز دارد، «خرید/قیمت» آن را هم می‌پوشاند
    const toks = c.split(' ');
    if (cov.focus.some((f) => f.k === c || (toks.length >= 2 && toks.every((t) => f.toks.includes(t)) && f.toks.length <= toks.length + 1))) return 'focus';
    if (toks.length >= 2 && cov.titles.some((t) => t.includes(c))) return 'title';
    return '';
  }

  const INTENT_FA = { transactional: 'خرید', commercial: 'مقایسه', informational: 'اطلاعاتی' };
  const ACTION = { category: 'صفحهٔ دستهٔ اختصاصی بساز یا عنوان دسته را اصلاح کن', optimize: 'عنوان و عبارت کلیدی همین محصول‌ها را با این عبارت هماهنگ کن', article: 'یک مقالهٔ راهنما بنویس و به صفحه‌های محصول پیوند بده', compare: 'یک مقالهٔ مقایسه بنویس؛ فقط با مشخصات واقعی محصول‌هایت' };

  /**
   * items: فهرست کاتالوگ. opts: { max (۴۰)، minDf (۲) }.
   * خروجی: { products, opportunities:[{keyword,intent,type,action,score,support,ids,from}], clusters, covered, topics, notes }.
   */
  function find(items, opts) {
    const o = opts || {}; const max = Number(o.max) || 40; const prods = (items || []).filter(live); const notes = [];
    if (prods.length < 3) return { products: prods.length, opportunities: [], clusters: [], covered: 0, topics: [], notes: ['برای کشف الگوی واژگان دست‌کم ۳ محصول لازم است.'] };
    const tp = topics(prods); const cov = coverage(items); const out = new Map(); let covered = 0;
    const add = (keyword, intent, type, from, support, ids, base) => {
      keyword = clean(keyword); const k = keyOf(nrm(keyword).split(' ')); if (out.has(k)) return;
      if (isCovered(keyword, cov)) { covered++; return; }
      const wc = keyword.split(' ').length; let sc = Math.min(40, Math.round(Math.log2(support + 1) * 14));
      sc += intent === 'transactional' ? 25 : intent === 'commercial' ? 18 : 15; sc += wc >= 2 && wc <= 3 ? 15 : wc === 1 ? 5 : 8; sc += 20; if (base >= 3) sc += 4;
      out.set(k, { keyword, intent, intentFa: INTENT_FA[intent], type, action: ACTION[type], score: Math.min(100, sc), support, ids: (ids || []).slice(0, 12), from });
    };
    // ۱) خرید/قیمت برای هر موضوعِ تکرارشده
    tp.filter((t) => t.n <= 3 && isType(t) && t.df >= (o.minDf || 2)).slice(0, 25).forEach((t) => {
      const t0 = t.text; add('خرید ' + t0, 'transactional', t.df >= 3 ? 'category' : 'optimize', 'موضوع تکرارشده در ' + t.df + ' محصول', t.df, t.ids, t.df);
      if (t.n <= 2 && t.df >= 3) add('قیمت ' + t0, 'transactional', 'optimize', 'موضوع تکرارشده در ' + t.df + ' محصول', t.df, t.ids, t.df);
      if (t.n <= 2 && t.df >= 3) { add(t0 + ' چیست', 'informational', 'article', 'موضوع اصلی ' + t.df + ' محصول', t.df, t.ids, t.df); add('راهنمای خرید ' + t0, 'informational', 'article', 'موضوع اصلی ' + t.df + ' محصول', t.df, t.ids, t.df); }
    });
    // ۲) نوع محصول + برند/نام لاتین یا ویژگی، فقط وقتی در دست‌کم ۲ عنوان کنار هم آمده‌اند
    const types = tp.filter((t) => t.n <= 2 && isType(t) && t.df >= 3).slice(0, 8);
    const singles = (tp.singles || []).filter((t) => t.df >= 2 && !isType(t)).slice(0, 40);
    const pw = new Map(prods.map((p) => [p.id, new Set(words(p.title))]));
    types.forEach((T) => singles.forEach((S) => {
      if (T.text.split(' ').includes(S.text)) return; const both = prods.filter((p) => T.ids.includes(p.id) && pw.get(p.id).has(S.text)); if (both.length < 2) return;
      const kind = isLatin(S.text) ? 'برند/نام' : 'ویژگی'; add(T.text + ' ' + S.text, 'transactional', 'optimize', kind + ' «' + S.text + '» در ' + both.length + ' محصول ' + T.text, both.length, both.map((p) => p.id), both.length);
      add('خرید ' + T.text + ' ' + S.text, 'transactional', 'category', kind + ' «' + S.text + '» در ' + both.length + ' محصول ' + T.text, both.length, both.map((p) => p.id), both.length);
    }));
    // ۳) مقایسه: فقط مقدارهایی که دقیقاً بعد از «نوع محصول» و در همان جایگاه عنوان می‌آیند (مثلاً دو برند)؛ جایگاه یکسان = ویژگی هم‌نوع
    types.slice(0, 4).forEach((T) => {
      const tw = T.text.split(' '); const after = new Map();
      prods.forEach((p) => { const w = words(p.title); for (let i = 0; i + tw.length < w.length; i++) { if (tw.every((x, k) => w[i + k] === x)) { const nx = w[i + tw.length]; if (meaningful(nx) && !isNum(nx)) { if (!after.has(nx)) after.set(nx, new Set()); after.get(nx).add(p.id); } break; } } });
      const alts = Array.from(after.entries()).filter(([, ids]) => ids.size >= 2).sort((a, b) => b[1].size - a[1].size).slice(0, 4);
      for (let a = 0; a < alts.length; a++) for (let b = a + 1; b < alts.length; b++) add('تفاوت ' + T.text + ' ' + alts[a][0] + ' و ' + alts[b][0], 'commercial', 'compare', 'هر دو بعد از «' + T.text + '» در عنوان‌های شما آمده‌اند', Math.min(alts[a][1].size, alts[b][1].size), [], 2);
    });
    const list = Array.from(out.values()).sort((a, b) => b.score - a.score || b.support - a.support).slice(0, max);
    const cl = new Map(); list.forEach((x) => { const h = words(x.keyword).find((w) => meaningful(w)) || x.keyword; if (!cl.has(h)) cl.set(h, []); cl.get(h).push(x); });
    const clusters = Array.from(cl.entries()).map(([head, arr]) => ({ head, count: arr.length, best: arr[0].score, keywords: arr.map((x) => x.keyword) })).sort((a, b) => b.best - a.best || b.count - a.count);
    notes.push('حجم جستجو، رقابت و رتبه در دست اپ نیست؛ امتیاز فقط «فرصتِ پوشش‌داده‌نشده» بر پایهٔ واژگان خود سایت است. هر عبارت را با Search Console یا ابزار کلیدواژه بسنج.');
    if (prods.length < 15) notes.push('تعداد محصول کم است؛ الگوهای تکرارشده کمتر مطمئن‌اند.');
    return { products: prods.length, opportunities: list, clusters, covered, topics: tp.slice(0, 15).map((t) => ({ text: t.text, df: t.df })), notes };
  }

  const csvCell = (v) => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  function toCsv(r) {
    const head = ['عبارت', 'نیت', 'اقدام پیشنهادی', 'امتیاز فرصت', 'تعداد محصول پشتیبان', 'منبع'];
    return head.join(',') + '\r\n' + ((r && r.opportunities) || []).map((x) => [x.keyword, x.intentFa, x.action, x.score, x.support, x.from].map(csvCell).join(',')).join('\r\n');
  }
  function toMarkdown(r) {
    const o = (r && r.opportunities) || []; let m = '# فرصت‌های کلمهٔ کلیدی سایت\n\n' + (r ? r.products : 0) + ' محصول بررسی شد؛ ' + o.length + ' فرصت پوشش‌داده‌نشده.\n\n';
    o.forEach((x, i) => { m += (i + 1) + '. **' + x.keyword + '** — ' + x.intentFa + ' · امتیاز ' + x.score + '\n   - ' + x.action + '\n   - منبع: ' + x.from + '\n'; });
    return m + '\n> ' + ((r && r.notes) || []).join('\n> ') + '\n';
  }
  return { find, topics, coverage, isCovered, toCsv, toMarkdown, INTENT_FA };
});
