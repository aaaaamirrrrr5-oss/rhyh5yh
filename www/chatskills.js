/* Site Inspector — chatskills.js (v1.95.0)  SI.ChatSkills
 * «مهارت‌های محلی» دستیار: پاسخ‌های قطعی و مستند از دادهٔ واقعی فروشگاه با سازندهٔ سئو و برنامهٔ سایت — بدون مدل، بدون شبکه.
 *  - تشخیص دقیق قصد (برنامهٔ سئو، ساخت سئوی یک محصول، پیوند داخلی)؛ جمله‌های عمومی را به موتور قدیمی/مدل وامی‌گذارد.
 *  - پیدا کردن محصول با تطبیق نام (و پرسیدن وقتی مبهم است)
 *  - خروجی: {text (Markdown امن), chips, actions:[{type,label,...}], note}
 * Pure + UMD. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./seobuilder.js'), require('./seoplan.js'), require('./keyfinder.js'), require('./seospecialist.js'), require('./seopolicy.js'));
  else (root.SI = root.SI || {}).ChatSkills = factory(root.SI && root.SI.SeoBuilder, root.SI && root.SI.SeoPlan, root.SI && root.SI.KeyFinder, root.SI && root.SI.SeoSpecialist, root.SI && root.SI.SeoPolicy);
})(typeof self !== 'undefined' ? self : this, function (SeoBuilder, SeoPlan, KeyFinder, Specialist, SeoPolicy) {
  'use strict';
  const FA = '۰۱۲۳۴۵۶۷۸۹'; const fa = (n) => String(n).replace(/\d/g, (d) => FA[d]);
  const N = (s) => String(s == null ? '' : s).toLowerCase().replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[ً-ٟـ‏]/g, '').replace(/‌/g, ' ').replace(/[۰-۹]/g, (d) => String(FA.indexOf(d))).replace(/[«»"'()]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = (s) => N(s).split(/[\s|–—:،؛,.!؟?\-]+/).filter((w) => w.length > 1);

  /** قصد کاربر؛ فقط الگوهای صریح. @returns {{id:'links'|'plan'|'product', arg?:string}|null} */
  /** ساده‌کردن جملهٔ محاوره‌ای به شکل دستوری که الگوها می‌شناسند: «میشه سئوی کتری رو برام بسازی؟» → «سئوی کتری را بساز».
   *  فقط حذف پرکننده‌ها و یکسان‌سازی فعل/املا؛ هیچ معنایی اضافه نمی‌شود و اگر چیزی عوض نشود همان متن برمی‌گردد. */
  const VERB = { 'بدی': 'بده', 'بدید': 'بده', 'بدین': 'بده', 'بکنی': 'بکن', 'بکنید': 'بکن', 'بزنی': 'بزن', 'بزنید': 'بزن', 'کنی': 'کن', 'کنید': 'کن', 'بسازی': 'بساز', 'بسازید': 'بساز', 'بنویسی': 'بنویس', 'بنویسید': 'بنویس', 'بگی': 'بگو', 'بگید': 'بگو', 'بگین': 'بگو', 'نشون': 'نشان', 'نشونم': 'نشان', 'ببینم': 'ببین', 'بدونم': 'بگو', 'بیاری': 'بیاور', 'بیارید': 'بیاور', 'پیدا': 'پیدا', 'کنین': 'کن', 'بکنین': 'بکن', 'بزنین': 'بزن', 'بدین': 'بده' };
  const WORD = { 'فروشگاهم': 'سایت', 'فروشگاهمو': 'سایت', 'سایتم': 'سایت', 'فروشگاه': 'سایت', 'چطوره': 'چطور است', 'کدومه': 'کدام است', 'ادرس': 'آدرس', 'ادرسای': 'آدرس‌های', 'ادرسها': 'آدرس‌ها', 'رو': 'را', 'کدوم': 'کدام', 'کدوما': 'کدام ها', 'کدومان': 'کدام اند', 'هستن': 'هستند', 'نیستن': 'نیستند', 'چیا': 'چه چیزهایی', 'کدومه': 'کدام است', 'کدومن': 'کدام اند', 'چیه': 'چیست', 'چیا': 'چه چیزهایی', 'کجاس': 'کجاست', 'کجاست': 'کجاست', 'اینو': 'این را', 'اونو': 'آن را', 'همینو': 'همین را', 'محصولارو': 'محصولات را', 'صفحه‌هارو': 'صفحه‌ها را', 'مشکلاتو': 'مشکلات را', 'بیشتر': 'بیشتر', 'سایتو': 'سایت را', 'سایتمو': 'سایت را', 'سئوشو': 'سئو را', 'سیو': 'سئو', 'سیئو': 'سئو', 'ضعیفترین': 'ضعیف‌ترین', 'ضعیفتر': 'ضعیف‌تر', 'پیوندا': 'پیوندها', 'لینکا': 'لینک‌ها', 'لینک': 'پیوند', 'لینک‌های': 'پیوندهای', 'لینکهای': 'پیوندهای', 'تایتل': 'عنوان', 'دسکریپشن': 'متا', 'کیورد': 'کلیدواژه', 'کی‌ورد': 'کلیدواژه', 'کیوردها': 'کلیدواژه‌ها' };
  const FILL = /(?:^|\s)(?:لطفا|لطفاً|ممنون|مرسی|خواهشا|خواهشاً|ببخشید|ببین|راستی|خب|خوب|پس|یعنی|آقا|داداش|جان|عزیزم|رفیق|دوست\s*عزیز|یه\s*لحظه|یک\s*لحظه|سلام|درود|اگه\s*میشه|اگر\s*می\s*شه|اگر\s*میشود|لطف\s*کن|زحمتش\s*با\s*تو|الان|همین\s*الان|یه\s*کم|یکم|برام|برایم|برای\s*من|بهم|به\s*من|واسم|واسه\s*من|ازت\s*میخوام\s*که|ازت\s*می\s*خوام|میخوام\s*که|می\s*خوام\s*که|میخوام|می\s*خوام|دوست\s*دارم\s*که|دوست\s*دارم|میشه\s*که|می\s*شه\s*که|میشه|می\s*شه|میتونی|می\s*تونی|میتونید|می\s*تونید|بتونی|بتونید|ممکنه|امکانش\s*هست|میشود|می\s*شود|لازم\s*دارم|احتیاج\s*دارم|بلدی|بلدید)(?=\s|$)/g;
  const VOCAB = ['ضعیف‌ترین', 'محصولات', 'یتیم', 'تکراری', 'ناپاک', 'پیوند', 'پیوندهای', 'بازرسی', 'همگام‌سازی', 'ترافیک', 'تغییرات', 'راهنما', 'برنامه', 'محتوا', 'عنوان', 'عنوان‌های', 'سئو', 'بساز', 'بنویس', 'پیشنهاد', 'کلیدواژه', 'اولویت', 'آدرس'];
  /** فاصلهٔ ویرایش ≤۱ (جایگزینی، حذف، درج، جابه‌جایی دو حرف مجاور). */
  function near1(a, b) {
    if (a === b) return true; const la = a.length, lb = b.length; if (Math.abs(la - lb) > 1) return false;
    if (la === lb) { let d = []; for (let i = 0; i < la; i++) if (a[i] !== b[i]) d.push(i); if (d.length === 1) return true; return d.length === 2 && d[1] === d[0] + 1 && a[d[0]] === b[d[1]] && a[d[1]] === b[d[0]]; }
    const [x, y] = la < lb ? [a, b] : [b, a]; let i = 0; while (i < x.length && x[i] === y[i]) i++; return x.slice(i) === y.slice(i + 1);
  }
  /** غلط تایپی تک‌حرفی در واژه‌های کلیدی فرمان را درست می‌کند (فقط واژه‌های ≥۵ حرف و فقط اگر دقیقاً یک واژهٔ فهرست نزدیک باشد). */
  function fixTypos(q) {
    return q.split(' ').map((w) => { if (w.length < 5 || VOCAB.indexOf(w) >= 0 || /[a-z0-9.]/.test(w)) return w; const c = VOCAB.filter((v) => near1(w, v)); return c.length === 1 ? c[0] : w; }).join(' ');
  }
  function humanize(text) {
    const orig = String(text == null ? '' : text); let q = N(orig).replace(/[؟?!,،؛]+/g, ' ').replace(/\.+(?=\s|$)/g, ' ').replace(/(.)\1{2,}/g, '$1$1').replace(/\s+/g, ' ').trim(); if (!q) return orig;
    q = q.replace(/\bمی\s+(\S+)/g, 'می$1');
    q = q.replace(/(^|\s)(?:آیا|ایا)(?=\s|$)/g, ' ');
    let prev; do { prev = q; q = q.replace(FILL, ' ').replace(/\s+/g, ' ').trim(); } while (q !== prev);
    q = q.split(' ').map((w) => { const m = /^((?:آدرس|عنوان|متا|محصول|صفحه|لینک|پیوند|مقاله|کلیدواژه|مشکل|نشانی|اسلاگ|توضیح|کلمه))(ا|ای|ارو|ام|هام|امو)$/.exec(w); if (!m) return w; return m[1] === 'محصول' ? (m[2] === 'ام' || m[2] === 'امو' ? 'محصولاتم' : 'محصولات') : m[1] + '‌های'; }).join(' ').split(' ').map((w) => (WORD[w] !== undefined ? WORD[w] : (VERB[w] !== undefined ? VERB[w] : w))).join(' ');
    q = q.replace(/^(?:ببین\s+)?(.+?)\s+(?:را)\s+(?:ببین)$/, '$1 را نشان بده').replace(/\s+/g, ' ').trim();
    q = q.replace(/(ها|های)(را|رو)(?=\s|$)/g, '$1 را').replace(/(\S+?)(?:رو)$/, (m, a) => (/(ها|ات|ان)$/.test(a) ? a + ' را' : m));
    q = fixTypos(q);
    return q || orig;
  }

  /** مسیریابی با مدل محلی (ابزارفراخوانی): مدل فقط یکی از ابزارهای مجاز را با آرگومان انتخاب می‌کند؛ اجرا همیشه با همان مهارت‌های قاعده‌محور و بازبینی‌شده است. */
  const TOOLS = [
    ['plan', 'برنامهٔ کلی سئوی سایت و امتیاز'], ['next', 'مهم‌ترین کار بعدی سئو'], ['worst', 'ضعیف‌ترین محصولات از نظر سئو'], ['links', 'پیشنهاد پیوند داخلی مقاله به محصول'],
    ['orphans', 'صفحه‌های بدون پیوند ورودی'], ['thin', 'محتوای کم'], ['dups', 'عنوان/کلیدواژه/متن تکراری'], ['urls', 'نشانی‌های ناپاک'], ['lengths', 'عنوان/متای بلند یا کوتاه'],
    ['specialist', 'متخصص سئو: کلیدواژه‌های تازه و پیشنهاد روزآمدسازی'], ['scope', 'وضعیت قفل محدودهٔ سئو'],
    ['product', 'ساخت/اصلاح عنوان و متا و سئوی کامل یک محصول؛ args: {"name": "نام محصول"}'],
    ['part', 'یک بخش از سئوی محصول؛ args: {"part": "keywords|alt|og|slug|schema|excerpt", "name": "نام محصول"}'],
    ['check', 'سنجش عنوان یا متای نوشته‌شدهٔ کاربر؛ args: {"field": "title|meta", "value": "متن"}'],
    ['nav', 'رفتن به یک تب؛ args: {"tab": "home|seo|ai|traffic|growth|changes|guide"}'], ['scansite', 'بازرسی یک سایت؛ args: {"url": "example.com"}'], ['sync', 'همگام‌سازی با وردپرس']
  ];
  const TOOL_IDS = new Set(TOOLS.map((t) => t[0]));
  function routePrompt(text, history) {
    const h = (history || []).slice(-4).map((m) => (m.role === 'assistant' ? 'دستیار: ' : 'کاربر: ') + String(m.content || '').replace(/<[^>]+>/g, ' ').replace(/\*\*/g, '').slice(0, 220)).join('\n');
    return 'تو مسیریاب یک دستیار سئوی فارسی هستی. بر اساس پیام کاربر فقط یکی از ابزارهای زیر را انتخاب کن و فقط یک خط JSON برگردان، بدون هیچ متن دیگر.\n' +
      'قالب: {"tool":"<id>","args":{...}} یا اگر هیچ ابزاری مناسب نیست {"tool":"none"}.\nابزارها:\n' + TOOLS.map((t) => '- ' + t[0] + ': ' + t[1]).join('\n') +
      '\nاگر کاربر چند کار خواست: {"steps":[{"tool":"..","args":{..}},…]} با حداکثر ۳ گام به ترتیب.\nقواعد: پرسش دانشی یا توضیحی («چرا»، «یعنی چه»، «چطور») ابزار ندارد → none. نام محصول را عیناً از پیام بردار. چیزی حدس نزن.\n' + (h ? '\nگفتگوی اخیر:\n' + h + '\n' : '') + '\nپیام کاربر: ' + String(text || '').slice(0, 300) + '\nJSON:';
  }
  function validRoute(o) {
    if (!o || typeof o.tool !== 'string' || !TOOL_IDS.has(o.tool)) return null; const a = o.args && typeof o.args === 'object' ? o.args : {}; const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n || 120);
    switch (o.tool) {
      case 'product': { const n = str(a.name); return n.length >= 3 ? { id: 'product', arg: n } : null; }
      case 'part': { const n = str(a.name); return ['keywords', 'alt', 'og', 'slug', 'schema', 'excerpt'].includes(a.part) && n.length >= 3 ? { id: 'part', part: a.part, arg: n } : null; }
      case 'check': { const v = str(a.value, 400); return (a.field === 'title' || a.field === 'meta') && v.length >= 4 ? { id: 'check', field: a.field, value: v } : null; }
      case 'nav': return TAB_FA[a.tab] ? { id: 'nav', tab: a.tab, label: TAB_FA[a.tab] } : null;
      case 'scansite': { const u = str(a.url, 200); return /^(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?$/i.test(u) ? { id: 'scansite', url: u } : null; }
      default: return { id: o.tool };
    }
  }
  function jsonOf(out) {
    const t = String(out || ''); const i = t.indexOf('{'); if (i < 0) return null;
    for (let j = t.length; j > i; j--) { if (t[j - 1] !== '}') continue; try { return JSON.parse(t.slice(i, j)); } catch (e) { /* کوتاه‌تر */ } }
    return null;
  }
  /** خروجی خام مدل → قصدِ معتبرِ اول یا null (سازگار با نسخهٔ قبل). */
  function parseRoute(out) { const r = parseRoutes(out); return r.length ? r[0] : null; }
  /** تا ۳ گام پشت‌سرهم: {"steps":[{tool,args},…]} یا یک {tool,args}. گام نامعتبر کل زنجیره را رد می‌کند (نیمه‌اجرا نداریم). */
  function parseRoutes(out) {
    const o = jsonOf(out); if (!o) return [];
    const raw = Array.isArray(o.steps) ? o.steps.slice(0, 3) : [o]; const res = [];
    for (const r of raw) { const v = validRoute(r); if (!v) return []; if (!res.some((x) => JSON.stringify(x) === JSON.stringify(v))) res.push(v); }
    return res;
  }
  /** تطبیق معنایی سبک و کاملاً محلی: شباهت کسینوسی n-gram نویسه‌ای (TF-IDF) با نمونه‌جمله‌های هر ابزار.
   *  نسبت به غلط املایی، پسوند و ترتیب واژه‌ها مقاوم است؛ فقط ابزارهای بدون آرگومان؛ پرسش‌های دانشی هرگز ربوده نمی‌شوند. */
  const EXEMPLARS = {
    plan: ['برنامه سئوی سایت', 'وضعیت کلی سئوی سایتم چطور است', 'یک نگاه کلی به سئوی فروشگاه بینداز', 'سلامت سئوی سایت', 'امتیاز سئوی سایت چند است', 'وضعیت سئو', 'گزارش سلامت سئوی سایت', 'سایتم از نظر سئو در چه حالی است'],
    next: ['کار بعدی سئو چیست', 'اول چه کاری برای سئو انجام بدهم', 'مهم ترین کار سئو الان چیست', 'اولویت سئوی من چیست', 'از کجای سئو شروع کنم', 'قدم بعدی برای بهتر شدن سئو'],
    worst: ['ضعیف ترین محصولات از نظر سئو', 'کدام محصولات سئوی بدی دارند', 'بدترین محصولات برای سئو', 'محصولاتی که سئویشان نیاز به اصلاح دارد', 'کم امتیاز ترین محصولات'],
    links: ['پیوند داخلی پیشنهاد بده', 'مقاله ها را به محصولات لینک کن', 'لینک سازی داخلی مقاله به محصول', 'کجا می شود از مقاله ها به محصول پیوند داد'],
    orphans: ['صفحه های یتیم', 'محصولاتی که هیچ پیوند ورودی ندارند', 'صفحه هایی که هیچ جا به آن ها لینک نشده'],
    thin: ['محتوای کم', 'صفحه هایی که متنشان کوتاه است', 'محصولات با توضیحات ناکافی', 'کجا متن کم دارم'],
    dups: ['عنوان های تکراری', 'کدام صفحه ها عنوان یکسان دارند', 'کلیدواژه تکراری بین صفحات', 'محتوای کپی شده و مشابه'],
    urls: ['آدرس های ناپاک', 'نشانی های بد و طولانی', 'اسلاگ های مشکل دار', 'کدام نشانی ها نیاز به اصلاح دارند'],
    lengths: ['عنوان های بلند', 'عنوان و متای بریده شده در گوگل', 'متاهای خیلی کوتاه', 'طول عنوان ها مناسب نیست'],
    specialist: ['متخصص سئو', 'کلیدواژه های جدید پیشنهاد بده', 'چه کلمات کلیدی تازه ای بگیرم', 'روزآمدسازی سئو'],
    scope: ['وضعیت قفل سئو', 'قفل محدوده فعال است', 'روی کدام محصول قفل است'],
    sync: ['همگام سازی با وردپرس', 'اطلاعات سایت را به روز کن', 'سایت را سینک کن']
  };
  const grams = (t) => { const out = []; String(t).split(' ').filter(Boolean).forEach((w) => { const p = '_' + w + '_'; for (let n = 2; n <= 3; n++) for (let i = 0; i + n <= p.length; i++) out.push(p.slice(i, i + n)); }); return out; };
  let SEM = null;
  function semIndex() {
    if (SEM) return SEM; const docs = []; Object.keys(EXEMPLARS).forEach((id) => EXEMPLARS[id].forEach((t) => docs.push({ id, g: grams(humanize(t) || N(t)) })));
    const df = new Map(); docs.forEach((d) => new Set(d.g).forEach((g) => df.set(g, (df.get(g) || 0) + 1))); const idf = (g) => Math.log(1 + docs.length / (1 + (df.get(g) || 0)));
    const vec = (g) => { const m = new Map(); g.forEach((x) => m.set(x, (m.get(x) || 0) + 1)); let n = 0; m.forEach((c, x) => { const w = c * idf(x); m.set(x, w); n += w * w; }); return { m, n: Math.sqrt(n) || 1 }; };
    docs.forEach((d) => { d.v = vec(d.g); }); SEM = { docs, vec, idf }; return SEM;
  }
  /** دروازهٔ مشترک تطبیق معنایی (n-gram و embedding): متن کوتاه، دارای واژهٔ دامنه، بدون پرسش دانشی و بدون قصد اختصاصی‌ترِ ممنوع. */
  function semanticGate(text) {
    const raw = N(text); if (!raw || raw.length > 80 || raw.split(' ').length < 2) return null; if (raw.split(' ').length <= 3 && /(?:چیه|چیست|چی\s*هست|یعنی)$/.test(raw)) return null; if (/(?:^|\s)(?:چرا|چگونه|تفاوت|فرق|آموزش|نحوه)(?=\s|$)|(?:^|\s)چطور(?=\s+(?!است(?:\s|$)|هست(?:\s|$))\S)|یعنی\s*چی|چیست\s*سئو/.test(raw)) return null;
    if (/(?:خودکار|اتوماتیک|ترمیم|لاگ|برگردان|بازگردانی|ربات|خزنده|ترافیک|گوگل|آنالیتیکس|رشد|هوش\s*مصنوعی|robots|sitemap|llms|آخرین\s*اجرا|اجرا|مدل|تنظیمات|کلید)/i.test(raw)) return null;
    if (!/(?:سئو|سایت|فروشگاه|محصول|صفحه|عنوان|متا|لینک|پیوند|آدرس|نشانی|اسلاگ|کلیدواژه|کلمات\s*کلیدی|مقاله|وردپرس|قفل|متن|محتوا)/.test(raw)) return null;
    return raw;
  }
  function semantic(text) {
    const raw = semanticGate(text); if (!raw) return null;
    const ix = semIndex(); const q = ix.vec(grams(humanize(text) || raw)); const best = {};
    ix.docs.forEach((d) => { let dot = 0; q.m.forEach((w, g) => { const o = d.v.m.get(g); if (o) dot += w * o; }); const sc = dot / (q.n * d.v.n); if (!best[d.id] || sc > best[d.id]) best[d.id] = sc; });
    const rank = Object.keys(best).sort((a, b) => best[b] - best[a]); const top = rank[0]; const gap = best[top] - (best[rank[1]] || 0);
    return best[top] >= 0.5 && gap >= 0.08 ? { id: top, semantic: Math.round(best[top] * 100) / 100 } : null;
  }
  /** تطبیق با embedding روی گوشی (EmbeddingGemma): نمونه‌ها یک‌بار بردار می‌شوند؛ این‌جا فقط بخش خالص (کسینوس + آستانه) است. */
  const EMB_MIN = 0.74, EMB_GAP = 0.035;
  function exemplarList() { const out = []; Object.keys(EXEMPLARS).forEach((id) => EXEMPLARS[id].forEach((t) => out.push({ id, text: t }))); return out; }
  const cosine = (a, b) => { let d = 0, x = 0, y = 0; const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return x && y ? d / Math.sqrt(x * y) : 0; };
  /** exVecs هم‌ترتیب exemplarList()؛ بهترین ابزار + فاصله از دومی؛ زیر آستانه ⇒ null. */
  function pickByVectors(qv, exVecs, opts) {
    const o = opts || {}; const ex = exemplarList(); if (!Array.isArray(qv) || !qv.length || !Array.isArray(exVecs) || exVecs.length !== ex.length) return null;
    const best = {}; ex.forEach((e, i) => { const sc = cosine(qv, exVecs[i] || []); if (!best[e.id] || sc > best[e.id]) best[e.id] = sc; });
    const rank = Object.keys(best).sort((a, b) => best[b] - best[a]); const top = rank[0]; const gap = best[top] - (best[rank[1]] || 0);
    return best[top] >= (o.min || EMB_MIN) && gap >= (o.gap || EMB_GAP) ? { id: top, semantic: Math.round(best[top] * 100) / 100, embed: true } : null;
  }
  /** دستورهای اجرایی اپ (ناوبری، بازرسی سایت با نشانی، همگام‌سازی)؛ همه بی‌خطر و فقط‌خواندنی‌اند. */
  const TAB_WORDS = [[/رادار|خانه|صفحه\s*اصلی/, 'home'], [/سئو/, 'seo'], [/خزنده|ربات/, 'ai'], [/ترافیک/, 'traffic'], [/رشد/, 'growth'], [/تغییرات/, 'changes'], [/راهنما|دسترسی/, 'guide']];
  const TAB_FA = { home: 'رادار', seo: 'سئو', ai: 'خزنده‌ها', traffic: 'ترافیک', growth: 'رشد', changes: 'تغییرات', guide: 'راهنما' };
  function appCommand(text) {
    const q = N(text); if (!q || q.length > 90) return null;
    let m = /^(?:لطفا\s*)?(?:برو|بپر|ببر\s*م[یِ]?|باز\s*کن|نشان\s*بده|نمایش\s*بده)\s*(?:به\s*)?(?:تب|بخش|صفحه(?:\s*ی)?)?\s*(.{2,25}?)\s*(?:را|رو)?$/.exec(q);
    if (m) { const w = m[1]; const hit = TAB_WORDS.find((x) => x[0].test(w) && w.split(' ').length <= 3); if (hit && !/(محصول|مقاله|برنامه|گزارش|قفل)/.test(w)) return { id: 'nav', tab: hit[1], label: TAB_FA[hit[1]] }; }
    m = /(https?:\/\/[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/.exec(q);
    if (m && /(?:بازرسی|اسکن|بررسی)\s*(?:کن|بزن|کنید)?$|^(?:بازرسی|اسکن|بررسی)\s*(?:کن\s*)?/.test(q) && /(کن|بزن|کنید)$/.test(q.replace(m[1], '').trim()) && !/(چطور|چگونه|چرا|چیست|آیا|\?|؟)/.test(q)) return { id: 'scansite', url: m[1] };
    if (/^(?:لطفا\s*)?(?:سایت\s*را\s*|وردپرس\s*را\s*|اطلاعات\s*(?:سایت|وردپرس)\s*را\s*)?(?:دوباره\s*)?(?:همگام\s*سازی|sync|سینک)\s*(?:کن|بزن|کنید)?$/.test(q)) return { id: 'sync' };
    if (/^(?:سایت(?:\s*را|\s*رو|و)?|وردپرس(?:\s*را|\s*رو|و)?|اطلاعات\s*سایت(?:\s*را|\s*رو)?)\s*(?:با\s*وردپرس\s*)?(?:به\s*|ب)?روز\s*(?:کن|رسانی\s*کن)(?:\s*با\s*وردپرس)?$/.test(q)) return { id: 'sync' };
    return null;
  }
  function detect(text, state) {
    const q = N(text); if (!q) return null;
    { const ac = appCommand(text); if (ac) return ac; }
    if (q.length <= 40) {
      const ms = /^(?:از\s*این\s*به\s*بعد\s*|همیشه\s*)?(کوتاه|مختصر|خلاصه|مفصل|کامل|رسمی|صمیمی|خودمانی|دوستانه)\s*(?:تر)?\s*(?:جواب|پاسخ)\s*(?:بده|بدی|بدید)$/.exec(q);
      if (ms) return { id: 'style', style: /کوتاه|مختصر|خلاصه/.test(ms[1]) ? 'short' : /مفصل|کامل/.test(ms[1]) ? 'detailed' : /رسمی/.test(ms[1]) ? 'formal' : 'friendly' };
      if (/^(?:سبک|لحن)\s*(?:پاسخ|جواب)?\s*(?:را|رو)?\s*(?:ریست|پیش\s*فرض|عادی)\s*(?:کن)?$|^به\s*حالت\s*عادی\s*(?:برگرد|جواب\s*بده)$/.test(q)) return { id: 'style', style: null };
    }
    if (q.length <= 34) {
      if (/^(?:خیلی\s*)?(?:مرسی|ممنون|تشکر|سپاس|دمت\s*گرم|دستت\s*درد\s*نکنه|عالی\s*بود|آفرین)(?:\s*(?:ازت|از\s*تو|دستیار|داداش|جان))*$/.test(q)) return { id: 'talk', kind: 'thanks' };
      if (/^(?:حالت|حال\s*شما)\s*(?:چطوره|چطور\s*است|خوبه)|^(?:چطوری|خوبی|چه\s*خبر|چخبر)$/.test(q)) return { id: 'talk', kind: 'howru' };
      if (/^(?:تو|شما)?\s*(?:کی|چی)\s*(?:هستی|هستید|هست)$|^اسمت\s*چیه$|^اسم\s*تو\s*چیست$|^(?:تو\s*)?کی\s*ساختت$/.test(q)) return { id: 'talk', kind: 'who' };
      if (/^(?:یه|یک)?\s*(?:جوک|لطیفه|داستان|شعر)\s*(?:بگو|بنویس|بخون)?$/.test(q)) return { id: 'talk', kind: 'creative' };
    }
    const st = state && state.kind === 'product' ? state : null;
    if (state && state.kind === 'list' && Array.isArray(state.titles) && q.length <= 50) {
      const ORD = { 'اولی': 0, 'اول': 0, 'اولین': 0, '1': 0, 'دومی': 1, 'دوم': 1, 'دومین': 1, '2': 1, 'سومی': 2, 'سوم': 2, 'سومین': 2, '3': 2, 'چهارمی': 3, 'چهارم': 3, '4': 3, 'پنجمی': 4, 'پنجم': 4, '5': 4, 'آخری': -1, 'آخر': -1, 'اخری': -1 };
      const m = /(?:^|\s)(?:شماره\s*)?(اولی|اولین|اول|دومی|دومین|دوم|سومی|سومین|سوم|چهارمی|چهارم|پنجمی|پنجم|آخری|اخری|آخر|[1-5])(?:\s*(?:را|رو))?(?=\s|$)/.exec(q);
      if (m && /(بساز|سئو|درست|اصلاح|بنویس|پیشنهاد|بررسی|ببین)/.test(q)) { const i = ORD[m[1]]; const t = state.titles[i < 0 ? state.titles.length - 1 : i]; if (t) return { id: 'product', arg: t }; }
    }
    if (st && q.length <= 45) {
      if (/^(?:یه|یک)?\s*(?:عنوان|تیتر|متا(?:ی)?|توضیحات|گزینه|پیشنهاد)\s*(?:دیگه|دیگر|دیگری|بعدی|جایگزین)(?:\s*بده)?$|^یکی\s*(?:دیگه|دیگر)(?:\s*بده)?$/.test(q)) return { id: 'alt', which: /متا|توضیحات/.test(q) ? 'meta' : 'title' };
      if (/کوتاه\s*ت(?:ر|رش)|کوتاهش\s*کن|کوتاه\s*کن/.test(q)) return { id: 'shorter' };
      if (/^(?:چرا|به چه دلیل)\s*(?:این|همین)\s*(?:عنوان|متا|کلیدواژه|عبارت)?/.test(q)) return { id: 'why' };
      if (/^(?:همین(?:ها)?\s*(?:را|رو)?\s*)?(?:اعمال|ذخیره|ثبت)\s*(?:کن|بکن|بزن)$/.test(q)) return { id: 'apply' };
    }
    if (/متخصص\s*سئو|(?:کلمه|کلمات|کلید\s*واژه|کلیدواژه)(?:\s*(?:ها|های))?\s*(?:کلیدی\s*)?(?:جدید|تازه)|(?:(?:به\s*)?روز\s*رسانی|آپدیت)\s*(?:سئو|سایت)|(?:سئو|سایت)(?:ی\s*سایت)?\s*(?:را|رو)?\s*(?:(?:به\s*)?روز\s*رسانی|آپدیت|بروز)\s*(?:کن|بکن)|رسیدن\s*به\s*(?:امتیاز\s*)?(?:۱۰۰|100|صد)|امتیاز\s*(?:۱۰۰|100|صد)\s*(?:سئو)?/.test(q) && !/(بساز|بنویس)\s+(?:سئو|عنوان)/.test(q)) return { id: 'specialist' };
    if (/(یتیم|بدون\s*پیوند\s*ورودی|پیوند\s*ورودی\s*ندار)/.test(q)) return { id: 'orphans' };
    if (/(محتوا(?:ی)?\s*(?:کم|ضعیف|ناکافی)|متن\s*(?:کم|کوتاه|ضعیف)|thin)/.test(q) && !/(بساز|بنویس)/.test(q)) return { id: 'thin' };
    if (/(?:عنوان|متا|محتوا|کلیدواژه|صفحه)(?:\s)?(?:ها|های)?\s*تکراری|تکراری\s*کدام|هم\s*خوار|کپی\s*شده/.test(q)) return { id: 'dups' };
    if (/(?:لینک|پیوند|صفحه)(?:\s)?(?:ها|های|ی)?\s*(?:شکسته|خراب|۴۰۴|404|ارور|خطا)|شکسته|۴۰۴|404/.test(q) && !/(بساز|بنویس)/.test(q)) return { id: 'crawl', arg: { kind: 'broken' } };
    if (/(?:صفحه|صفحات|صفحه‌ها)?.{0,12}(?:ایندکس\s*نشده|ایندکس\s*نمی\s*شود|نو\s*ایندکس|noindex|بدون\s*ایندکس|غیر\s*قابل\s*ایندکس)/.test(q) && !/(بساز|بنویس)/.test(q)) return { id: 'crawl', arg: { kind: 'index' } };
    if (/(?:نشانی|آدرس|اسلاگ|url)(?:\s)?(?:ها|های)?\s*(?:ناپاک|بد|مشکل|نامناسب|بلند)|مشکل\s*(?:نشانی|آدرس|اسلاگ)/.test(q)) return { id: 'urls' };
    if (/(?:عنوان|متا)(?:\s)?(?:ها|های)?\s*(?:بلند|کوتاه|بریده|طولانی)|طول\s*(?:عنوان|متا)/.test(q)) return { id: 'lengths' };
    if (/(?:قفل|محدوده)\s*(?:ی\s*)?(?:سئو|فعال|فعلی|خودکار)?.{0,12}(?:چیست|کدام|هست|فعال|وضعیت)|وضعیت\s*قفل|(?:چه|کدام)\s*محصول(?:ی)?\s*قفل/.test(q) && !/(بساز|بنویس)/.test(q)) return { id: 'scope' };
    if (/(?:کار|قدم|گام)\s*بعدی.{0,20}سئو|سئو.{0,20}(?:کار|قدم|گام)\s*بعدی|اول\s*(?:چه|چی)\s*(?:کاری|کار).{0,20}سئو/.test(q)) return { id: 'next' };
    if (/(ضعیف\s*ترین|بدترین|کم\s*امتیاز\s*ترین)\s*(?:محصول|محصولات)|کدام\s*محصول(?:ات|ها)?\s*(?:\S+\s+){0,3}(?:سئو|امتیاز).{0,12}(?:ضعیف|کم|بد)|اول\s*کدام\s*محصول(?:ات)?\s*را\s*(?:درست|اصلاح)/.test(q)) return { id: 'worst' };
    if (/(پیوند|لینک)\s*(ها|های)?\s*داخلی/.test(q) && !/(بشکن|خراب|مرده|شکسته)/.test(q)) return { id: 'links' };
    if (/برنامه\s*(ی|ٔ)?\s*سئو|کارهای?\s*اولویت\s*دار\s*سئو|امتیاز\s*سئو(ی)?\s*(محصولات|فروشگاه|سایت)\s*(من)?\s*(چنده|چقدر|چیست)?|سازنده\s*سئو/.test(q) && !/(بساز|بنویس)\s+(سئو|عنوان).+(برای|محصول)\s+\S+\s+\S+/.test(q)) return { id: 'plan' };
    { const mc = /^(?:این\s*)?(عنوان(?:\s*سئو)?|متا(?:ی)?(?:\s*توضیحات)?|توضیحات\s*متا)\s*را\s*(?:بسنج|چک\s*کن|بررسی\s*کن|ارزیابی\s*کن|تست\s*کن)\s*[:：]\s*([\s\S]{4,400})$/.exec(String(text || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim());
      if (mc) return { id: 'check', field: /^عنوان/.test(mc[1]) ? 'title' : 'meta', value: mc[2].replace(/^["«»“”]+|["«»“”]+$/g, '').trim() }; }
    { const mp = /^(کلیدواژه(?:\s*های)?|کلمات\s*مرتبط|متن\s*جایگزین(?:\s*تصاویر|\s*تصویر)?|alt(?:\s*text)?(?:\s*تصاویر|\s*تصویر)?|(?:عنوان\s*و\s*توضیح\s*)?(?:شبکه\s*های\s*اجتماعی|og|open\s*graph)|اسلاگ|نشانی\s*پیشنهادی|اسکیما|schema|خلاصه(?:\s*ی)?\s*محصول|گزیده)\s+برای\s+(?:محصول\s+)?(.{3,100}?)\s*(?:را|رو)?\s*(?:بده|بساز|بنویس|پیشنهاد\s*بده)?$/.exec(q);
      if (mp && !/^(کل|همه|تمام|سایت|فروشگاه|محصولات)(?:\s|$)/.test(mp[2])) { const w = mp[1]; const part = /کلیدواژه|کلمات/.test(w) ? 'keywords' : /جایگزین|alt/.test(w) ? 'alt' : /اجتماعی|og|graph/.test(w) ? 'og' : /اسلاگ|نشانی/.test(w) ? 'slug' : /اسکیما|schema/.test(w) ? 'schema' : 'excerpt'; return { id: 'part', part, arg: mp[2] }; } }
    let m = /(?:بساز|بنویس|پیشنهاد بده)\s+(?:سئو(?:ی)?|عنوان و متا|عنوان سئو|متا)\s+(?:برای|محصول)\s+(?:محصول\s+)?(.{3,120})$/.exec(q);
    if (!m) m = /^(?:سئو(?:ی)?|عنوان و متا(?:ی)?|عنوان سئو(?:ی)?|متا(?:ی)?)\s*(?:محصول\s+)?(.{3,120}?)\s*(?:را|رو)?\s*(?:بساز|بنویس|پیشنهاد بده|بده)$/.exec(q);
    const FIXV = '(?:اصلاح|درست|بهینه|بهتر|ارتقا|آپدیت|به\\s*روز|تنظیم|عوض|ریدیزاین|تغییر)\\s*(?:سازی\\s*)?(?:کن|بده|بکن)';
    if (!m) m = new RegExp('^(?:سئو(?:ی)?|عنوان و متا(?:ی)?|عنوان سئو(?:ی)?|متا(?:ی)?)\\s*(?:محصول\\s*)?(.{3,120}?)\\s*(?:را|رو)?\\s*' + FIXV + '$').exec(q);
    if (!m) m = new RegExp('^' + FIXV + '\\s+(?:سئو(?:ی)?|عنوان و متا(?:ی)?|عنوان سئو(?:ی)?|متا(?:ی)?)\\s*(?:محصول\\s*)?(.{3,120}?)\\s*(?:را|رو)?$').exec(q);
    if (!m) m = /^برای\s+(?:محصول\s+)?(.{3,100}?)\s+(?:سئو|عنوان و متا)\s*(?:بساز|بنویس|پیشنهاد بده)$/.exec(q);
    if (m) { const arg = m[1].replace(/\s*(را|رو)$/, '').trim(); if (arg.length >= 3 && !/^(?:کل|همه|تمام|سایت|فروشگاه|محصولات)(?:\s|$)/.test(arg)) return { id: 'product', arg }; }
    return null;
  }

  /** نزدیک‌ترین محصول(ها) به نام جست‌وجوشده: امتیاز = همپوشانی واژه‌ها (+ زیررشته). */
  /** چیپ‌های «سئوی X را اصلاح کن» برای محصولی که کاربر در پرسش نام برده (از روی فهرست محلی؛ بدون شبکه). */
  function fixChips(items, text, max) {
    const q = String(text || ''); if (!(items || []).length || q.length < 4) return [];
    const nq = N(q); const qw = new Set(words(q));
    return items.filter((x) => (x.type || 'product') === 'product' && x.title).map((x) => {
      const tw = words(x.title); if (tw.length < 2) return null; const hit = tw.filter((w) => qw.has(w)).length; const pre = tw.slice(0, Math.min(3, tw.length)).join(' ');
      const ok = hit / tw.length >= 0.7 || (hit >= 2 && nq.indexOf(pre) >= 0); return ok ? { x, hit, pre: nq.indexOf(pre) >= 0 ? 1 : 0 } : null;
    }).filter(Boolean).sort((p1, p2) => p2.pre - p1.pre || p2.hit - p1.hit).slice(0, max || 2).map((r) => 'سئوی ' + r.x.title + ' را اصلاح کن');
  }
  function findProducts(items, query) {
    const qs = words(query); if (!qs.length) return [];
    return (items || []).filter((x) => (x.type || 'product') === 'product' && x.title).map((x) => {
      const ts = words(x.title); const hit = qs.filter((w) => ts.some((t) => t === w || (w.length > 3 && t.includes(w)))).length; const cov = hit / qs.length; const prec = hit / Math.max(1, ts.length);
      const sub = N(x.title).includes(N(query)) ? 0.25 : 0; return { item: x, score: cov * 0.7 + prec * 0.3 + sub, cov };
    }).filter((r) => r.cov >= 0.6).sort((a, b) => b.score - a.score);
  }

  const bullets = (a) => a.map((x) => '- ' + x).join('\n');
  const EF = { auto: '⚙️', manual: '✋', studio: '✍️', review: '👁️' };

  const ordinal = (i, n) => fa(i + 1) + ' از ' + fa(n);
  function productCard(it, b, ti, mi, note) {
    const nT = Math.min(4, b.title.all.length), nM = Math.min(4, b.meta.all.length); ti = Math.max(0, Math.min(ti, nT - 1)); mi = Math.max(0, Math.min(mi, nM - 1));
    const T = b.title.all[ti] || {}, M = b.meta.all[mi] || {}, F = b.focus.all[0] || {}; const miss = b.missing.filter((m) => m.fix !== 'auto').slice(0, 3);
    const text = (note ? note + '\n\n' : '') + '**سئوی پیشنهادی «' + it.title + '»** — امتیاز ' + fa(b.before.score) + ' ← ' + fa(b.after.score) + ' (اطمینان ' + ({ high: 'بالا', medium: 'متوسط', low: 'کم' }[b.confidence]) + ')\n\n'
      + '**عنوان سئو' + (nT > 1 ? ' (' + ordinal(ti, nT) + ')' : '') + ':** ' + (T.text || b.title.best) + '\n<small>' + fa(T.chars || 0) + ' نویسه، ' + fa(T.px || 0) + ' پیکسل — ' + (T.reasons || []).join(' · ') + '</small>\n\n'
      + '**توضیحات متا' + (nM > 1 ? ' (' + ordinal(mi, nM) + ')' : '') + ':** ' + (M.text || b.meta.best) + '\n<small>' + fa(M.chars || 0) + ' نویسه — ' + (M.reasons || []).join(' · ') + '</small>\n\n'
      + '**عبارت کلیدی:** ' + b.focus.best + (F.reasons && F.reasons.length ? '\n<small>' + F.reasons.join(' · ') + '</small>' : '')
      + (b.keywords.length ? '\n\n**کلمات مرتبط:** ' + b.keywords.slice(0, 5).map((k) => k.text).join('، ') : '')
      + (miss.length ? '\n\n**آنچه فقط خودت می‌توانی کامل کنی:**\n' + bullets(miss.map((m) => EF[m.fix] + ' ' + m.label + (m.tip ? ' — ' + m.tip : ''))) : '')
      + '\n\n<small>همه از نام و مشخصات واقعی محصول ساخته شده و چیزی ذخیره نشد؛ برای اعمال، در ترمیم باز کن.</small>';
    const chips = ['یک عنوان دیگر بده', 'کوتاه‌ترش کن', 'چرا این عنوان؟']; if (nM > 1) chips.splice(1, 0, 'یک متای دیگر بده');
    return { text, chips: chips.slice(0, 4), actions: [{ type: 'repair', id: it.id, sel: { seo_title: ti, meta_description: mi }, label: 'باز کردن در ترمیم و اعمال' }, { type: 'copy', text: 'عنوان: ' + (T.text || b.title.best) + '\nمتا: ' + (M.text || b.meta.best) + '\nعبارت کلیدی: ' + b.focus.best, label: 'کپی' }], note: 'سازندهٔ سئو (محلی)', state: { kind: 'product', id: it.id, t: ti, m: mi } };
  }


  /** ممیزی‌های ساختاری (فقط‌خواندنی؛ همه از SeoPlan): فهرست کوتاه + صداقت دربارهٔ آنچه سنجیده نشد. */
  const li = (x) => '«' + x.title + '»';
  function auditCard(skill, items, ctx) {
    const list = items.slice(0, 400); const go = [{ type: 'goto', tab: 'seo', label: 'رفتن به ترمیم' }]; const src = 'برنامهٔ سئوی سایت (محلی)';
    const more = (n, k) => (n > k ? '\n\n… و ' + fa(n - k) + ' مورد دیگر.' : '');
    if (skill === 'orphans') {
      const r = SeoPlan.orphans(list); if (r.unknown) return { text: 'متن صفحه‌ها در فهرست نیست، پس نمی‌توانم بگویم کدام محصول پیوند ورودی ندارد. «بررسی عمیق» را در ترمیم اجرا کن.', chips: ['برنامهٔ سئوی سایت'], actions: go };
      if (!r.list.length) return { text: 'همهٔ محصولاتی که بررسی شدند دست‌کم یک پیوند از متن صفحه‌های دیگر دارند.' + (r.partial ? '\n\n<small>فقط ابتدای متن بعضی صفحه‌ها خوانده شد؛ نتیجه قطعی نیست.</small>' : ''), chips: ['پیوند داخلی پیشنهاد بده'], actions: go, note: src };
      return { text: '**' + fa(r.list.length) + ' محصول بدون پیوند ورودی** (از متن ' + fa(r.scanned) + ' صفحه)\n\n' + bullets(r.list.slice(0, 6).map(li)) + more(r.list.length, 6) + '\n\n<small>منو، دسته و «محصولات مرتبط» حساب نمی‌شود. ' + (r.partial ? 'فقط ابتدای متن بعضی صفحه‌ها خوانده شد؛ ممکن است پیوندی دیده نشده باشد. ' : '') + 'از مقاله‌ای مرتبط به آن‌ها پیوند بده.</small>', chips: ['پیوند داخلی پیشنهاد بده'], actions: go, note: src };
    }
    if (skill === 'thin') {
      const r = SeoPlan.thinContent(list); if (!r.known) return { text: 'متن کامل هیچ موردی در فهرست نیست، پس «محتوای کم» را نمی‌توانم بسنجم؛ پیش‌نمایش کوتاه به‌اشتباه «کم» حساب می‌شود. «بررسی عمیق» را اجرا کن.', chips: [], actions: go };
      if (!r.list.length) return { text: 'در ' + fa(r.known) + ' موردی که متن کامل داشت، محتوای کم پیدا نشد.', chips: [], actions: go, note: src };
      return { text: '**' + fa(r.list.length) + ' مورد با متن کم** (از ' + fa(r.known) + ' موردِ دارای متن کامل)\n\n' + bullets(r.list.slice(0, 6).map((x) => li(x) + ' — ' + fa(x.words) + ' واژه (حداقل ' + fa(x.min) + ')')) + more(r.list.length, 6) + '\n\n<small>برای محصول‌ها «استودیو/نویسنده» متن یکتا می‌سازد.</small>', chips: ['ضعیف‌ترین محصولات از نظر سئو کدامند؟'], actions: go, note: src };
    }
    if (skill === 'dups') {
      const g = SeoPlan.cannibalGroups(list); const d = SeoPlan.duplicateContent(list); const t = new Map(); list.forEach((x) => { const k = N(x.metaTitle); if (k.length > 8) { if (!t.has(k)) t.set(k, []); t.get(k).push(x); } }); const tg = Array.from(t.values()).filter((a) => a.length > 1);
      if (!g.length && !d.pairs.length && !tg.length) return { text: 'عنوان تکراری، کلیدواژهٔ تکراری یا متن بسیار مشابه پیدا نشد.' + (d.partial ? '\n\n<small>شباهت متن فقط روی بخشی از متن‌ها سنجیده شد.</small>' : ''), chips: [], actions: go, note: src };
      const parts = [];
      if (tg.length) parts.push('**عنوان سئوی تکراری (' + fa(tg.length) + ' گروه)**\n' + bullets(tg.slice(0, 3).map((a) => a.slice(0, 3).map(li).join(' ، '))));
      if (g.length) parts.push('**کلیدواژهٔ تکراری = رقابت داخلی (' + fa(g.length) + ' گروه)**\n' + bullets(g.slice(0, 3).map((x) => '«' + x.keyword + '» در ' + fa(x.items.length) + ' صفحه: ' + x.items.slice(0, 3).map(li).join(' ، '))));
      if (d.pairs.length) parts.push('**متن بسیار مشابه (' + fa(d.pairs.length) + ' جفت)**\n' + bullets(d.pairs.slice(0, 3).map((x) => li(x.a) + ' و ' + li(x.b) + ' — ' + fa(x.pct) + '٪')));
      return { text: parts.join('\n\n') + '\n\n<small>' + (d.partial ? 'شباهت متن فقط روی بخشی از متن‌ها سنجیده شد. ' : '') + 'سازندهٔ سئو برای عنوان تکراری، کاندیدای یکتا می‌سازد.</small>', chips: ['ضعیف‌ترین محصولات از نظر سئو کدامند؟'], actions: go, note: src };
    }
    if (skill === 'urls') {
      const r = SeoPlan.urlIssues(list); if (!r.length) return { text: 'نشانی ناپاکی (query، حرف بزرگ، زیرخط، اسلاگ بسیار بلند یا فقط عددی) پیدا نشد.', chips: [], actions: go, note: src };
      return { text: '**' + fa(r.length) + ' نشانی نیازمند بازبینی**\n\n' + bullets(r.slice(0, 6).map((x) => li(x) + ' — ' + (x.why || []).join('، '))) + more(r.length, 6) + '\n\n<small>⚠️ تغییر نشانی بدون ریدایرکت ۳۰۱ رتبه را از دست می‌دهد؛ اپ هرگز خودکار تغییرش نمی‌دهد.</small>', chips: [], actions: go, note: src };
    }
    if (skill === 'lengths') {
      const r = SeoPlan.lengthIssues(list); if (!r.length) return { text: 'عنوان یا متای بسیار بلند/کوتاهی پیدا نشد.', chips: [], actions: go, note: src };
      return { text: '**' + fa(r.length) + ' عنوان/متا با طول نامناسب**\n\n' + bullets(r.slice(0, 6).map((x) => li(x) + ' — ' + (x.why || []).join('، '))) + more(r.length, 6) + '\n\n<small>سنجش با همان پیکسل و حد گوگل سازندهٔ سئو.</small>', chips: ['برنامهٔ سئوی سایت'], actions: go, note: src };
    }
    const builds = list.map((it) => { try { return ctx.build(it); } catch (e) { return null; } }); const sum = SeoBuilder.summarize(builds); const pl = SeoPlan.sitePlan(list, sum, SeoPlan.linkPlan(list)); const a = pl.actions[0];
    if (!a) return { text: 'کار فوری‌ای پیدا نشد.', chips: [], actions: go };
    return { text: '**کار بعدی: ' + a.title + '** — ' + fa(a.count) + ' مورد ' + (EF[a.effort] || '') + (a.how ? '\n\n' + a.how : '') + '\n\n<small>اولویت از وزن اثر × تعداد محاسبه شده است.</small>', chips: ['برنامهٔ سئوی سایت', 'ضعیف‌ترین محصولات از نظر سئو کدامند؟'], actions: go, note: src };
  }


  /** «متخصص سئو و به‌روزرسانی» در چت: امتیاز، کار بعدی، کلمات تازه و محتوای کهنه — فقط‌خواندنی. */
  function specialistCard(items, ctx) {
    const go = [{ type: 'goto', tab: 'seo', label: 'رفتن به ترمیم' }]; if (!Specialist || !KeyFinder) return { text: 'ماژول متخصص سئو در این نسخه در دسترس نیست.', chips: [], actions: go };
    const list = items.slice(0, 400); const builds = list.map((it) => { try { return ctx.build(it); } catch (e) { return null; } }); const sum = SeoBuilder.summarize(builds); const pl = SeoPlan.sitePlan(list, sum, SeoPlan.linkPlan(list));
    let kf = null; try { kf = KeyFinder.find(list, { max: 60 }); } catch (e) { kf = null; }
    const b = Specialist.brief({ plan: pl, kf, items: list, saved: ctx.saved || {}, prev: ctx.prev || null, now: new Date() }); const parts = [];
    parts.push('**متخصص سئو — امتیاز ' + fa(b.score) + ' از ۱۰۰**\n\n' + b.verdict.replace(/\d+/g, fa));
    if (b.next) parts.push('**کار بعدی:** ' + b.next.title + ' — ' + fa(b.next.count) + ' مورد ' + (EF[b.next.kind] || '') + (b.next.how ? '\n\n' + b.next.how : ''));
    if (b.newKeywords.length) parts.push('**' + (b.isFirst ? 'کلمات کلیدی پیشنهادی (اولین بررسی)' : 'کلمات کلیدی تازه از آخرین بررسی') + ' (' + fa(b.newKeywordCount) + ')**\n\n' + bullets(b.newKeywords.slice(0, 5).map((k) => k.keyword + (k.intentFa ? ' — ' + k.intentFa : ''))) + (b.newKeywordCount > 5 ? '\n\n… و ' + fa(b.newKeywordCount - 5) + ' مورد دیگر.' : ''));
    else if (b.totalOpportunities) parts.push('کلمهٔ کلیدی تازه‌ای از آخرین بررسی پیدا نشد.');
    if (b.staleCount) parts.push('**' + fa(b.staleCount) + ' مورد با سال گذشته در عنوان/متا** — اول محتوا را واقعاً به‌روز کن، بعد سال را.');
    return { text: parts.join('\n\n') + '\n\n<small>' + b.honesty + (b.freshness.due ? ' وقت بررسی دوباره است.' : '') + '</small>', chips: ['برنامهٔ سئوی سایت', 'کار بعدی سئو چیست؟'], actions: go.concat([{ type: 'copy', text: Specialist.toMarkdown(b), label: 'کپی گزارش' }]), note: 'متخصص سئو (محلی)' };
  }

  /** ctx: {items, build(item)→SeoBuilder result, links?, state?, prev?, saved?}. */
  /** گزارش خزش بریج (فقط‌خواندنی): صفحه/پیوند شکسته و صفحه‌های غیرقابل‌ایندکس. */
  const BROKEN_RE = /^(http_4xx|http_5xx|soft_404|canonical_to_error|hreflang_to_error|broken|redirect_loop|redirect_chain)/;
  const INDEX_RE = /noindex|not_indexable|blocked|robots|canonical_to|canonical_mismatch|non_indexable/;
  function crawlCard(kind, rep) {
    const issues = rep && !rep.error && Array.isArray(rep.issues) ? rep.issues : null;
    if (!issues) return { needs: 'crawl', text: 'برای این کار گزارش خزش سایت لازم است. در بخش بریج «خزش سایت» را اجرا و گزارش را دریافت کن؛ بعد دوباره بپرس.', chips: [], actions: [] };
    const re = kind === 'index' ? INDEX_RE : BROKEN_RE; const hit = issues.filter((x) => re.test(String(x.code || '')));
    const title = kind === 'index' ? 'صفحه‌های غیرقابل‌ایندکس' : 'صفحه و پیوند شکسته';
    if (!hit.length) return { text: 'در گزارش خزش فعلی (' + fa(rep.page_count || (rep.pages || []).length || 0) + ' صفحه) موردی برای «' + title + '» ثبت نشده است.\n\n<small>این نتیجه فقط به همان گزارش خزش تکیه دارد؛ اگر قدیمی است دوباره خزش کن.</small>', chips: [], actions: [] };
    const total = hit.reduce((a, x) => a + (Number(x.count) || (x.urls || []).length || 1), 0);
    const lines = hit.slice(0, 6).map((x) => '**' + (x.title || x.code) + '** — ' + fa(Number(x.count) || (x.urls || []).length) + ' مورد' + ((x.urls || [])[0] ? ': ' + String(x.urls[0]).slice(0, 80) : '') + (x.fix ? '\n   ↳ ' + x.fix : ''));
    return { text: '**' + fa(total) + ' مورد در «' + title + '»**\n\n' + bullets(lines) + (hit.length > 6 ? '\n\n… و ' + fa(hit.length - 6) + ' مورد دیگر.' : '') + '\n\n<small>فقط‌خواندنی؛ برنامه چیزی را خودکار تغییر نمی‌دهد. اصلاح ریدایرکت/لینک با تأیید خودتان است.</small>', chips: ['وضعیت سئوی سایت'], actions: [] };
  }

  function run(skill, arg, ctx) {
    const r = runInner(skill, arg, ctx); const sc = ctx && ctx.scope;
    if (skill === 'scope') return r;
    if (sc && sc.on && r && !r.needs && ['plan', 'worst', 'links', 'orphans', 'thin', 'dups', 'urls', 'lengths', 'next', 'specialist'].includes(skill)) r.text = '🔒 **قفل محدودهٔ سئو روشن است** (' + sc.label + ')؛ فقط همین‌ها در فهرست‌اند و این نتیجه دربارهٔ کل سایت نیست.\n\n' + r.text;
    return r;
  }
  function runInner(skill, arg, ctx) {
    if (skill === 'style') { const FA = { short: 'کوتاه و مختصر', detailed: 'مفصل و مرحله‌به‌مرحله', formal: 'رسمی', friendly: 'صمیمی' }; const k = arg && arg.style; return { text: k ? 'باشد؛ از این به بعد **' + FA[k] + '** جواب می‌دهم. (در تنظیمات همین دستگاه ذخیره شد؛ با «سبک پاسخ را ریست کن» برمی‌گردد.)\n\n<small>این فقط طول و لحن را عوض می‌کند و روی دقت و ایمنی اثری ندارد؛ پاسخ‌های قاعده‌محور و کارت‌های سئو همان قالب ثابت را دارند و فقط پاسخ‌های مدل زبانی تغییر می‌کنند.</small>' : 'سبک پاسخ به حالت عادی برگشت.', chips: [], actions: [], note: 'تنظیمات محلی', setStyle: k || null }; }
    if (skill === 'talk') { const T = { thanks: 'خواهش می‌کنم! هر وقت خواستی، سئوی یک محصول یا برنامهٔ سایت را بپرس.', howru: 'من یک دستیار برنامه‌ام و حال ندارم 🙂 اما آماده‌ام. بگو از کجا شروع کنیم: «برنامهٔ سئوی سایت» یا «ضعیف‌ترین محصولات»؟', who: 'من دستیار داخلی «بازرس سایت» هستم؛ روی گوشی و بدون API کار می‌کنم، سایت و محصولات وردپرس را بررسی می‌کنم و برای سئو پیشنهاد می‌دهم. بدون مدل زبانی، فقط دستورهای شناخته‌شده را می‌فهمم.', creative: 'نوشتن آزاد (جوک، داستان، شعر) به مدل زبانی روی گوشی نیاز دارد که الان فعال نیست؛ از تنظیمات مدل را دانلود کن تا گفتگوی آزاد فعال شود. تا آن موقع می‌توانم دربارهٔ سئوی سایتت کمک کنم.' }; return { text: T[arg && arg.kind || 'thanks'] || T.thanks, chips: ['دستیار چه کارهایی بلد است؟'], actions: [], note: 'پاسخ محلی' }; }
    if (skill === 'scope') { const sc = ctx && ctx.scope; return sc && sc.on ? { text: '🔒 **قفل محدودهٔ سئو روشن است**\n\n' + bullets(['محدوده: ' + sc.label, 'تغییر خودکار و گروهی فقط روی همین‌ها انجام می‌شود؛ هر نوشتن بیرون از آن‌ها رد می‌شود.']) + '\n\n<small>برداشتن یا تغییر قفل در تب سئو انجام می‌شود؛ چت قفل را تغییر نمی‌دهد.</small>', chips: ['برنامهٔ سئوی سایت'], actions: [{ type: 'goto', tab: 'seo', label: 'رفتن به قفل محدوده' }], note: 'تنظیمات محلی اپ' } : { text: 'قفل محدوده خاموش است؛ سئوی خودکار و گروهی روی کل سایت اجرا می‌شود.\n\n<small>برای محدودکردن به یک محصول، در تب سئو «قفل محدودهٔ سئوی خودکار» را روشن کن.</small>', chips: [], actions: [{ type: 'goto', tab: 'seo', label: 'رفتن به تب سئو' }], note: 'تنظیمات محلی اپ' }; }
    if (skill === 'crawl') return crawlCard(arg && arg.kind, ctx && ctx.crawl);
    const items = (ctx && ctx.items) || [];
    if (!items.length) return { needs: 'items', text: 'برای این کار فهرست محصولات و مقالات سایت لازم است. افزونهٔ وردپرس را وصل کن و در تب «سئو ← ترمیم» گزینهٔ «بررسی همهٔ محصولات» را بزن؛ بعد دوباره بپرس.', chips: ['دستیار چه کارهایی بلد است؟'], actions: [{ type: 'goto', tab: 'seo', label: 'رفتن به ترمیم' }] };
    if (skill === 'specialist') return specialistCard(items, ctx);
    if (['orphans', 'thin', 'dups', 'urls', 'lengths', 'next'].includes(skill)) return auditCard(skill, items, ctx);
    if (skill === 'check') {
      if (!SeoPolicy) return { text: 'ماژول سنجش در این نسخه در دسترس نیست.', chips: [], actions: [] };
      const r = arg.field === 'title' ? SeoPolicy.checkTitle(arg.value) : SeoPolicy.checkMeta(arg.value); const lim = SeoPolicy.LIMITS || {};
      const verdict = r.ok ? '✅ **مناسب است**' : '⚠️ **نیاز به اصلاح**';
      return { text: verdict + ' — ' + (arg.field === 'title' ? 'عنوان' : 'توضیحات متا') + '\n\n«' + arg.value + '»\n\n' + bullets([fa(r.len) + ' نویسه' + (r.px ? '، ' + fa(r.px) + ' پیکسل' : ''), r.reason || 'در حد مجاز نمایش گوگل است.']) + '\n\n<small>سنجش با همان قواعد و پیکسل‌سنج سازندهٔ سئو؛ نتیجه برای نمایش در نتایج گوگل است و تضمین رتبه نیست.</small>', chips: ['برنامهٔ سئوی سایت'], actions: [], note: 'قواعد سئو (محلی)' };
    }
    if (skill === 'part') {
      const nm = arg && arg.arg; const found = findProducts(items, nm);
      if (!found.length) return { text: 'محصولی با نام «' + nm + '» پیدا نکردم. نام را دقیق‌تر بنویس.', chips: [], actions: [] };
      if (found.length > 1 && found[0].score - found[1].score < 0.12 && found[0].score < 1.2) return { text: 'چند محصول نزدیک به «' + nm + '» هست؛ کدام را می‌خواهی؟\n\n' + bullets(found.slice(0, 4).map((r) => '«' + r.item.title + '»')), chips: [], actions: [] };
      const it = found[0].item; const b = ctx.build(it); if (!b || !b.ok) return { text: 'ساخت پیشنهاد برای «' + it.title + '» ممکن نشد: ' + ((b && b.why) || 'دادهٔ ناکافی'), chips: [], actions: [] };
      const x = b.extra || {}; const p = arg.part; let body = '';
      if (p === 'keywords') body = '**کلمات کلیدی پیشنهادی**\n\n' + bullets([('اصلی: ' + b.focus.best)].concat((b.keywords || []).slice(0, 6).map((k) => k.text + ' (' + k.kind + ')'))) + '\n\n<small>همه از نام و مشخصات واقعی محصول ساخته شده؛ حجم جست‌وجو را این اپ نمی‌داند و ادعا نمی‌کند.</small>';
      else if (p === 'alt') { const al = (x.alt || []).filter((a) => a.proposed).slice(0, 6); body = al.length ? '**متن جایگزین (alt) پیشنهادی برای تصاویر**\n\n' + bullets(al.map((a) => '«' + String(a.url).split('/').pop() + '» ← ' + a.proposed)) + '\n\n<small>فقط تصاویری که alt ندارند؛ توضیح نمی‌سازم که در تصویر نیست.</small>' : 'برای این محصول تصویر بدون alt پیدا نشد (یا فهرست تصاویر در دسترس نیست).'; }
      else if (p === 'og') body = x.og ? '**عنوان و توضیح شبکه‌های اجتماعی (Open Graph)**\n\n' + bullets(['عنوان: ' + x.og.og_title, 'توضیح: ' + x.og.og_description]) : 'پیشنهاد Open Graph برای این محصول ساخته نشد.';
      else if (p === 'slug') body = x.slug ? '**نشانی (اسلاگ) پیشنهادی:** ' + (x.slug.proposed || x.slug.slug || JSON.stringify(x.slug)) + '\n\n<small>⚠️ تغییر نشانی بدون ریدایرکت ۳۰۱ رتبه را از دست می‌دهد؛ اپ هرگز خودکار تغییرش نمی‌دهد.</small>' : 'نشانی فعلی نیاز به تغییر ندارد (یا پیشنهاد امنی نداشتم).';
      else if (p === 'schema') body = x.schema ? '**اسکیمای Product ساخته شد** (' + fa(JSON.stringify(x.schema).length) + ' نویسه)؛ برای دیدن و اعمال، در ترمیم باز کن.' : 'اسکیما ساخته نشد.' + ((x.skipped || []).length ? '\n\n' + bullets(x.skipped.slice(0, 3)) : '');
      else body = '**خلاصهٔ پیشنهادی**\n\n' + (b.excerpt || 'ساخته نشد.');
      return { text: body + '\n\n<small>چیزی ذخیره نشد؛ برای اعمال «سئوی ' + it.title + ' را بساز» و دکمهٔ ترمیم.</small>', chips: ['سئوی ' + it.title + ' را بساز'], actions: [{ type: 'goto', tab: 'seo', label: 'رفتن به ترمیم' }], note: 'سازندهٔ سئو (محلی)' };
    }
    if (skill === 'product') {
      const found = findProducts(items, arg); if (!found.length) return { text: 'محصولی با نام «' + arg + '» پیدا نکردم. نام را دقیق‌تر بنویس (مثلاً بخشی از عنوان محصول).', chips: [] , actions: [] };
      if (found.length > 1 && found[0].score - found[1].score < 0.12 && found[0].score < 1.2) return { text: 'چند محصول نزدیک به «' + arg + '» هست؛ کدام را می‌خواهی؟\n\n' + bullets(found.slice(0, 4).map((r) => '«' + r.item.title + '»')), chips: found.slice(0, 3).map((r) => 'سئوی ' + r.item.title + ' را بساز'), actions: [] };
      const it = found[0].item; const b = ctx.build(it); if (!b || !b.ok) return { text: 'ساخت سئو برای «' + it.title + '» ممکن نشد: ' + ((b && b.why) || 'دادهٔ ناکافی'), chips: [], actions: [] };
      return productCard(it, b, 0, 0, '');
    }
    if (skill === 'alt' || skill === 'shorter' || skill === 'why' || skill === 'apply') {
      const st = ctx.state; const it = st && items.find((x) => String(x.id) === String(st.id)); if (!it) return { text: 'اول یک محصول را بساز (مثلاً «سئوی قهوه ترک را بساز») تا روی آن ادامه دهیم.', chips: [], actions: [] };
      const b = ctx.build(it); if (!b || !b.ok) return { text: 'دادهٔ این محصول دیگر در دسترس نیست.', chips: [], actions: [] };
      const nT = Math.min(4, b.title.all.length), nM = Math.min(4, b.meta.all.length); let ti = st.t || 0, mi = st.m || 0;
      if (skill === 'alt') { if (arg && arg.which === 'meta') { if (nM < 2) return Object.assign(productCard(it, b, ti, mi, 'برای این محصول متای جایگزین دیگری که معیارها را بگذراند نداشتم.'), {}); mi = (mi + 1) % nM; return productCard(it, b, ti, mi, 'متای جایگزین (همان معیارها)'); } if (nT < 2) return productCard(it, b, ti, mi, 'عنوان جایگزین دیگری که معیارها را بگذراند نداشتم.'); ti = (ti + 1) % nT; return productCard(it, b, ti, mi, 'عنوان جایگزین (همان معیارها)'); }
      if (skill === 'shorter') { const c = b.title.all.slice(0, 4).map((x, i) => ({ x, i })).sort((p, q) => (p.x.chars || 0) - (q.x.chars || 0))[0]; if (c.i === ti) return productCard(it, b, ti, mi, 'کوتاه‌ترین عنوان معتبر همین است.'); return productCard(it, b, c.i, mi, 'کوتاه‌ترین عنوانِ معتبر:'); }
      if (skill === 'why') { const T = b.title.all[ti] || {}, M = b.meta.all[mi] || {}; return { text: '**چرا این عنوان؟**\n' + bullets((T.reasons || ['سنجش‌شده با معیارهای گوگل'])) + '\n\n**چرا این متا؟**\n' + bullets((M.reasons || [])) + '\n\n<small>امتیاز هر کاندیدا از سنجش پیکسل، یکتایی، کلیدواژه و ادعاهای بی‌پشتوانه می‌آید.</small>', chips: ['یک عنوان دیگر بده', 'کوتاه‌ترش کن'], actions: [], note: 'سازندهٔ سئو (محلی)', state: st }; }
      return { text: 'من در چت چیزی در سایت نمی‌نویسم تا همه‌چیز پیش از ذخیره دیده و تأیید شود. دکمهٔ زیر همین انتخاب‌ها را در ترمیم باز می‌کند؛ آنجا پیش‌نمایش گوگل و «اعمال» هست.', chips: [], actions: [{ type: 'repair', id: it.id, sel: { seo_title: ti, meta_description: mi }, label: 'باز کردن در ترمیم و اعمال' }], note: 'سازندهٔ سئو (محلی)', state: st };
    }
    if (skill === 'worst') {
      const rows = items.filter((x) => (x.type || 'product') === 'product').slice(0, 400).map((it) => { let b = null; try { b = ctx.build(it); } catch (e) { b = null; } return b && b.ok ? { it, b } : null; }).filter(Boolean).sort((p, q) => p.b.before.score - q.b.before.score || q.b.gain - p.b.gain).slice(0, 5);
      if (!rows.length) return { text: 'محصولی برای ارزیابی پیدا نشد.', chips: [], actions: [] };
      const text = '**ضعیف‌ترین محصولات از نظر سئو** (با دادهٔ فهرست)\n\n' + rows.map((r, i) => fa(i + 1) + '. «' + r.it.title + '» — امتیاز ' + fa(r.b.before.score) + ' ← ' + fa(r.b.after.score) + (r.b.missing[0] ? '\n   <small>بزرگ‌ترین کمبود: ' + (EF[r.b.missing[0].fix] || '') + ' ' + r.b.missing[0].label + '</small>' : '')).join('\n') + '\n\n<small>یکی را انتخاب کن تا عنوان و متای پیشنهادی‌اش را بسازم.</small>';
      return { text, chips: rows.slice(0, 3).map((r) => 'سئوی ' + r.it.title + ' را بساز'), actions: [{ type: 'goto', tab: 'seo', label: 'رفتن به ترمیم' }], note: 'برنامهٔ سئوی سایت (محلی)', state: { kind: 'list', titles: rows.map((r) => r.it.title) } };
    }
    if (skill === 'links') {
      const lp = SeoPlan.linkPlan(items); const s = lp.suggestions;
      if (!lp.articles) return { text: 'مقاله‌ای (با متن) در فهرست نیست؛ پیوند داخلی از روی متن مقاله‌ها پیشنهاد می‌شود.', chips: [], actions: [] };
      if (!s.length) return { text: 'در ' + fa(lp.articles) + ' مقاله، عبارتی که عیناً نام یک محصول باشد و هنوز پیوند نداشته باشد پیدا نکردم.' + (lp.partialText ? '\n\n<small>فقط ابتدای متن مقاله‌ها خوانده شد.</small>' : ''), chips: ['برنامهٔ سئوی سایت'], actions: [] };
      const text = '**' + fa(s.length) + ' پیوند داخلی پیشنهادی** (از ' + fa(lp.articles) + ' مقاله)\n\n' + s.slice(0, 6).map((x) => '- «' + x.articleTitle + '» ← **' + x.productTitle + '**\n  انکر: «' + x.anchor + '» (اطمینان ' + (x.confidence === 'high' ? 'بالا' : 'متوسط') + ')\n  <small>' + x.context + '</small>').join('\n') + (s.length > 6 ? '\n\n… و ' + fa(s.length - 6) + ' مورد دیگر.' : '') + '\n\n<small>انکرها عیناً در متن مقاله‌اند. ' + (lp.partialText ? 'فقط ابتدای متن مقاله‌ها خوانده شد. ' : '') + 'در چت چیزی نوشته نشد. در «برنامهٔ سئوی سایت» (تب ترمیم) می‌توانی اول «پیش‌نمایش پیوندها» را ببینی و بعد هر پیوند را با تأیید خودت اضافه کنی؛ افزودن گروهی فقط وقتی مدیر سایت اجرای خودکار را روشن کرده و قفل محدودهٔ سئو خاموش است. یا در ویرایشگر وردپرس دستی اضافه کن.</small>';
      return { text, chips: ['برنامهٔ سئوی سایت'], actions: [{ type: 'copy', text: SeoPlan.linksToMarkdown(lp), label: 'کپی همهٔ پیشنهادها' }, { type: 'goto', tab: 'seo', label: 'رفتن به برنامه و پیش‌نمایش پیوندها' }], note: 'برنامهٔ سئوی سایت (محلی)' };
    }
    if (skill === 'plan') {
      const builds = items.slice(0, 400).map((it) => { try { return ctx.build(it); } catch (e) { return null; } }); const sum = SeoBuilder.summarize(builds); const lp = SeoPlan.linkPlan(items); const pl = SeoPlan.sitePlan(items.slice(0, 400), sum, lp);
      if (!sum.n) return { text: 'از فهرست فعلی چیزی برای ارزیابی ساخته نشد.', chips: [], actions: [] };
      const text = '**برنامهٔ سئوی سایت** — امتیاز ' + fa(pl.score) + ' ← ' + fa(pl.potential) + (pl.grade ? ' (' + pl.grade.label + ')' : '') + '\n<small>' + fa(sum.n) + ' مورد بررسی شد؛ پتانسیل یعنی پس از اعمال پیشنهادهای خودکار.</small>\n\n'
        + (pl.actions.length ? '**کارهای اولویت‌دار:**\n' + pl.actions.slice(0, 6).map((a, i) => fa(i + 1) + '. ' + (EF[a.effort] || '') + ' **' + a.title + '** — ' + fa(a.count) + ' مورد' + (a.how ? '\n   <small>' + a.how + '</small>' : '')).join('\n') : 'کار فوری‌ای پیدا نشد.')
        + (SeoPlan.nextStep(pl, {}) ? '\n\n👉 **کار بعدی:** ' + SeoPlan.nextStep(pl, {}).title : '')
        + (pl.coverage && pl.coverage.notes.length ? '\n\n<small>پوشش بررسی: ' + fa(pl.coverage.full) + ' از ' + fa(pl.coverage.total) + ' مورد متن کامل دارند. ' + fa(pl.coverage.notes.join(' ')) + '</small>' : '')
        + '\n\n<small>⚙️ خودکار · ✍️ متن‌نویس · ✋ ورود اطلاعات · 👁️ بازبینی. با دادهٔ خلاصهٔ فهرست؛ «بررسی عمیق» دقیق‌ترش می‌کند.</small>';
      return { text, chips: ['پیوند داخلی پیشنهاد بده'], actions: [{ type: 'goto', tab: 'seo', label: 'رفتن به ترمیم' }], note: 'برنامهٔ سئوی سایت (محلی)' };
    }
    return { text: '', chips: [], actions: [] };
  }

  /** تشخیص با متن اصلی و سپس شکل ساده‌شدهٔ محاوره‌ای. */
  const SEM_OK_BRAIN = new Set(['seo', 'summary', 'score', 'help', 'aipages', 'next', 'more']);
  /** brainId: برچسب قصد موتور پاسخ عمومی؛ اگر آن موتور یک قصد اختصاصی‌تر (وضعیت ترمیم، سئوی خودکار، برگرداندن…) شناخته باشد، تطبیق معنایی دخالت نمی‌کند. */
  function understand(text, state, brainId) { const d = detect(text, state); if (d) return d; const h = humanize(text); const d2 = h && h !== N(text) ? detect(h, state) : null; if (d2) return d2; if (brainId && !SEM_OK_BRAIN.has(brainId)) return null; return semantic(text); }
  return { detect, understand, humanize, findProducts, fixChips, run, appCommand, semantic, semanticGate, brainAllows: (id) => !id || SEM_OK_BRAIN.has(id), exemplarList, pickByVectors, routePrompt, parseRoute, parseRoutes, TOOLS };
});
