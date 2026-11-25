/* Site Inspector Polish engine (v1.26).
 * Deterministic, reversible "self-correcting text" + SEO-rule fixer. No language model, runs on any phone.
 *
 * What it does
 *  1. fixHtml / fixPlain  — Persian typography & spelling on TEXT NODES only: Arabic ي/ك/ى → ی/ک/ی, Arabic-Indic digits → Persian,
 *     tatweel, half-space (می‌شود، کتاب‌ها، بزرگ‌تر), punctuation spacing (، ؛ ؟ ! :), repeated punctuation, repeated function words,
 *     a small list of very common spelling mistakes (بصورت → به صورت …).
 *  2. fixMarkup — SEO structure rules on the HTML: one H1 only (page title is the H1), no skipped heading levels, no empty headings/paragraphs,
 *     images get alt text, target=_blank links get rel=noopener. Gutenberg block comments are kept consistent.
 *  3. seoFields — better focus keyword, SEO title (20–60 chars, brand, unique) and meta description (70–160 chars, whole sentences, keyword) built ONLY from the item's own text.
 *
 * Safety: every content change is verified (numbers, links, non-text tags, letter count are preserved). If verification fails the original is returned untouched.
 * It never invents facts, never touches prices/URLs/attributes other than alt/rel, and never edits code/pre/script/style/shortcodes/URLs.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./seopolicy.js'));
  else root.SI = root.SI || {}, root.SI.Polish = factory(root.SI && root.SI.SeoPolicy);
})(typeof self !== 'undefined' ? self : this, function (Policy) {
  'use strict';
  const FA = '\\u0621-\\u063A\\u0641-\\u064A\\u0671-\\u06D3\\u06D5'; // Persian/Arabic LETTERS only (no digits, no ، ؛ ؟)
  const ZW = '‌';
  const PD = '۰۱۲۳۴۵۶۷۸۹';
  const fa = (n) => String(n).replace(/\d/g, (d) => PD[+d]);
  const len = (v) => Array.from(String(v == null ? '' : v)).length;
  const digitsLatin = (s) => String(s == null ? '' : s).replace(/[۰-۹]/g, (d) => String(PD.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const plain = (v) => String(v == null ? '' : v).replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
  // Same normalisation as repair.js so uniqueness checks agree.
  const norm = (v) => digitsLatin(plain(v)).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[‌‏ً-ْ]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const escAttr = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* ------------------------------------------------------------------ typography & spelling */
  const DICT = [
    ['بصورت', 'به صورت'], ['بخاطر', 'به خاطر'], ['بدلیل', 'به دلیل'], ['بطور', 'به طور'], ['بعنوان', 'به عنوان'], ['بنظر', 'به نظر'], ['بجای', 'به جای'],
    ['برروی', 'بر روی'], ['درحال', 'در حال'], ['درمورد', 'در مورد'], ['دراین', 'در این'], ['بعلاوه', 'به علاوه'], ['علیرغم', 'علی‌رغم'], ['بدین‌ترتیب', 'بدین ترتیب'],
    ['ضمنا', 'ضمناً'], ['حتما', 'حتماً'], ['مثلا', 'مثلاً'], ['اصلا', 'اصلاً'], ['قطعا', 'قطعاً'], ['تقریبا', 'تقریباً'], ['معمولا', 'معمولاً'], ['کاملا', 'کاملاً'],
    ['صرفا', 'صرفاً'], ['لطفا', 'لطفاً'], ['نهایتا', 'نهایتاً'], ['عموما', 'عموماً'], ['احتمالا', 'احتمالاً'], ['ظاهرا', 'ظاهراً'], ['خصوصا', 'خصوصاً'],
    ['اساسا', 'اساساً'], ['واقعا', 'واقعاً'], ['اتفاقا', 'اتفاقاً'], ['عملا', 'عملاً'], ['غالبا', 'غالباً'], ['دقیقا', 'دقیقاً'], ['نسبتا', 'نسبتاً'], ['فعلا', 'فعلاً'],
  ].map(([from, to]) => ({ re: new RegExp('(?<![' + FA + ZW + '])' + from + '(?![' + FA + ZW + '\\u064B-\\u0652])', 'g'), to }));  // تنوین/اعراب بعد از واژه یعنی املای درست است (معمولاً نباید «معمولاًً» شود)
  const MI_STEMS = '(?:شو(?:د|ند|ید|یم|م|ی)?|کن(?:د|ند|ید|یم|م|ی)?|تو(?:ان(?:ست)?|اند|انید|انم|انی|انیم|انند)|باش(?:د|ند|ید|یم|م|ی)|خواه(?:د|ند|ید|یم|م|ی)|ده(?:د|ند|ید|یم|م|ی)|گیر(?:د|ند|ید|یم|م|ی)|رس(?:د|ند|ید|یم|م|ی)|گذر(?:د|ند|ید|یم|م|ی)|پرداز(?:د|ند|ید|یم|م|ی)|دار(?:د|ند|ید|یم|م|ی)|نویس(?:د|ند|ید|یم|م|ی)|بین(?:د|ند|ید|یم|م|ی)|ساز(?:د|ند|ید|یم|م|ی)|فروش(?:د|ند|ید|یم|م|ی)|یاب(?:د|ند|ید|یم|م|ی)|خور(?:د|ند|ید|یم|م|ی)|خوان(?:د|ند|ید|یم|م|ی)|آ(?:ید|یند|ورد|ورند|وری|ورم)|رو(?:د|ند|م|ی|ید|یم)|گو(?:ید|یند|یم|یی)|دان(?:م|د|ند|ید|یم)|مان(?:د|ند|م|ی|ید|یم))';
  const MI_GLUED = new RegExp('(?<![' + FA + ZW + '])(ن?می)(' + MI_STEMS + ')(?![' + FA + ZW + '])', 'g');
  const MI_SPACED = new RegExp('(?<![' + FA + ZW + '])(?<!ماه )(ن?می) (?=' + MI_STEMS + '(?![' + FA + ZW + ']))', 'g');
  const PLURAL = new RegExp('(?<=[' + FA + ']{2}) (ها|های|هایی|هایم|هایت|هایش|هایمان|هایتان|هایشان)(?![' + FA + ZW + '])', 'g');
  const ADJ = 'بزرگ|کوچک|ارزان|گران|سبک|سنگین|زیبا|قوی|ضعیف|سریع|جدید|قدیمی|مهم|مناسب|باکیفیت|پیشرفته|ساده|راحت|سخت|بلند|کوتاه|پهن|باریک|تازه|مرغوب|خوشمزه|خوش‌طعم|کم|زیاد|پایین|بالا|نرم|سفت|روشن|تیره|عمیق|کامل|دقیق';
  const COMPAR = new RegExp('(?<![' + FA + ZW + '])(' + ADJ + ') (تر|ترین)(?![' + FA + ZW + '])', 'g');
  const DUPW = new RegExp('(?<![' + FA + ZW + '])(و|در|از|که|را|با|این|آن|است|برای|تا|یا|هر)(\\s+)\\1(?![' + FA + ZW + '])', 'g');
  const PROTECT = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[\w.+-]+@[\w-]+\.[\w.-]+|\[\/?[A-Za-z_][^\]\n]{0,200}\]|&#?\w+;/g;

  /** Corrects one text fragment (no HTML). Returns { text, changes:{code:count} }. */
  function fixText(input) {
    let s = String(input == null ? '' : input); const ch = {};
    if (!/[؀-ۿ]/.test(s)) return { text: s, changes: ch };
    const keep = []; s = s.replace(PROTECT, (m) => { keep.push(m); return '' + (keep.length - 1) + ''; });
    const sub = (re, rep, code) => { let n = 0; s = s.replace(re, (...a) => { const out = typeof rep === 'function' ? rep(...a) : rep.replace(/\$(\d)/g, (_, i) => a[+i] == null ? '' : a[+i]); if (out !== a[0]) n++; return out; }); if (n) ch[code] = (ch[code] || 0) + n; };

    sub(/[يى]/g, 'ی', 'arabic_chars'); sub(/ك/g, 'ک', 'arabic_chars');
    sub(/[٠-٩]/g, (d) => String.fromCharCode(0x06F0 + d.charCodeAt(0) - 0x0660), 'arabic_digits');
    sub(new RegExp('(?<=[' + FA + '])ـ+(?=[' + FA + '])', 'g'), '', 'tatweel');
    sub(/​/g, '', 'zwnj');
    sub(/[ \t]{2,}/g, ' ', 'spaces');
    sub(/‌{2,}/g, ZW, 'zwnj'); sub(/‌+(?=\s)|(?<=\s)‌+/g, '', 'zwnj'); sub(/^‌+|‌+$/g, '', 'zwnj');
    DICT.forEach((d) => sub(d.re, d.to, 'spelling'));
    sub(MI_GLUED, '$1' + ZW + '$2', 'zwnj'); sub(MI_SPACED, '$1' + ZW, 'zwnj');
    sub(PLURAL, ZW + '$1', 'zwnj'); sub(COMPAR, '$1' + ZW + '$2', 'zwnj');
    sub(DUPW, '$1', 'repeated_word');
    // ASCII punctuation between Persian words → Persian punctuation
    sub(new RegExp('(?<=[' + FA + ']),(?=\\s|$)', 'g'), '،', 'punctuation');
    sub(new RegExp('(?<=[' + FA + ']);(?=\\s|$)', 'g'), '؛', 'punctuation');
    sub(new RegExp('(?<=[' + FA + '])\\?(?=\\s|$)', 'g'), '؟', 'punctuation');
    // spacing around punctuation
    sub(new RegExp('(?<=[' + FA + '])[ ]+(?=[،؛؟!:]|\\.(?![.\\d]))', 'g'), '', 'punctuation');
    sub(new RegExp('(?<=[' + FA + '])([،؛؟!])(?=[' + FA + '])', 'g'), '$1 ', 'punctuation');
    sub(new RegExp('(?<=[' + FA + ']{2})\\.(?=[' + FA + ']{2})', 'g'), '. ', 'punctuation');
    sub(/([!؟])\1+/g, '$1', 'punctuation'); sub(/،{2,}/g, '،', 'punctuation'); sub(/\.{4,}/g, '...', 'punctuation');
    sub(/\(\s+(?=[^\s)])/g, '(', 'punctuation'); sub(/(?<=[^\s(])\s+\)/g, ')', 'punctuation');
    sub(/«[ \t]+/g, '«', 'punctuation'); sub(/[ \t]+»/g, '»', 'punctuation');
    s = s.replace(/(\d+)/g, (_, i) => keep[+i]);
    return { text: s, changes: ch };
  }

  const SKIP_TAGS = /^(script|style|pre|code|textarea|kbd|samp|svg|math|noscript)$/i;
  function mapText(html, fn) {
    const re = /<!--[\s\S]*?-->|<([a-zA-Z][\w:-]*)\b[^>]*>|<\/([a-zA-Z][\w:-]*)\s*>/g; let out = '', last = 0, skip = null, m;
    while ((m = re.exec(html))) {
      const text = html.slice(last, m.index); out += skip ? text : fn(text); out += m[0]; last = re.lastIndex;
      if (m[0].charAt(1) !== '!') {
        if (m[1] && SKIP_TAGS.test(m[1]) && !/\/>$/.test(m[0])) skip = m[1].toLowerCase();
        else if (m[2] && skip && m[2].toLowerCase() === skip) skip = null;
      }
    }
    const tail = html.slice(last); return out + (skip ? tail : fn(tail));
  }
  const merge = (into, from) => { Object.keys(from || {}).forEach((k) => { into[k] = (into[k] || 0) + from[k]; }); return into; };
  const total = (changes) => Object.keys(changes || {}).reduce((n, k) => n + changes[k], 0);

  /** Corrects Persian typography/spelling in the text nodes of an HTML string. Tags and attributes are never touched. */
  function fixHtml(html) {
    const changes = {}; const out = mapText(String(html == null ? '' : html), (t) => { const r = fixText(t); merge(changes, r.changes); return r.text; });
    return { html: out, changes, count: total(changes) };
  }
  /** Same for a plain string (excerpt, SEO title, meta description). Whitespace is collapsed. */
  function fixPlain(value) {
    const src = String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); const r = fixText(src); return { text: r.text.trim(), changes: r.changes, count: total(r.changes) };
  }

  /* ------------------------------------------------------------------ SEO markup rules */
  const ANGLE = { front: 'نمای روبه‌رو', back: 'نمای پشت', side: 'نمای کنار', top: 'نمای بالا', bottom: 'نمای پایین', detail: 'جزئیات', closeup: 'نمای نزدیک', package: 'بسته‌بندی', packaging: 'بسته‌بندی', box: 'جعبه', inside: 'نمای داخل', open: 'حالت باز', size: 'اندازه' };
  /** v1.73: اولین تصویر = نام محصول. تصویر بعدی: اگر نام فایل زاویه/جزئیات معنادار دارد (front, side, detail…) همان؛ وگرنه شمارهٔ تصویر. هیچ‌وقت از نام فایل دوربین/هش چیزی ساخته نمی‌شود و کلیدواژه اضافه نمی‌شود (قانون o06). */
  function altFor(ctx, n, src) {
    const t = String(ctx && ctx.title || '').replace(/\s+/g, ' ').trim(); if (!t) return ''; if (n <= 1) return t;
    const base = String(src || '').split(/[?#]/)[0].split('/').pop().replace(/\.[a-z0-9]{2,5}$/i, '').toLowerCase(); const hit = base.split(/[^a-z]+/).map((w) => ANGLE[w]).find(Boolean);
    return hit ? t + ' - ' + hit : t + ' - تصویر ' + fa(n);
  }
  /** Structural SEO fixes. ctx: { title, headings:true|false (skipped levels), alt:true|false }. */
  function fixMarkup(html, ctx) {
    const c = ctx || {}; const ch = {}; const bump = (k, n) => { if (n) ch[k] = (ch[k] || 0) + n; };
    let s = String(html == null ? '' : html); if (!/[<]/.test(s)) return { html: s, changes: ch, count: 0 };
    // Page-builder shortcodes: structure belongs to the builder; leave it alone.
    if (/\[\/?(?:vc_|et_pb_|fusion_|elementor|su_)[^\]]*\]/i.test(s)) return { html: s, changes: ch, count: 0, skipped: 'builder' };

    // empty paragraphs (Gutenberg-aware)
    const EMPTY_P = /<!--\s*wp:paragraph(?:\s+\{[\s\S]*?\})?\s*-->\s*<p\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>\s*<!--\s*\/wp:paragraph\s*-->|<p\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi;
    let n = 0; s = s.replace(EMPTY_P, () => { n++; return ''; }); bump('empty_paragraph', n);

    // headings
    const HEAD = /(?:(<!--\s*wp:heading)(?:\s+(\{[\s\S]*?\}))?(\s*-->)(\s*))?<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\5\s*>(?:(\s*)(<!--\s*\/wp:heading\s*-->))?/gi;
    let prev = 1, h1 = 0, lv = 0, em = 0;
    s = s.replace(HEAD, (all, open, json, close, ws, lvl, attrs, inner, ws2, endc) => {
      if (!plain(inner) && !/<img\b/i.test(inner)) { em++; return ''; }
      let L = +lvl; const orig = L;
      if (L === 1) { L = 2; h1++; }
      if (c.headings !== false && L > prev + 1) { L = prev + 1; if (orig !== 1) lv++; }
      prev = L; if (L === orig) return all;
      let o = '';
      if (open) { let obj = {}; try { obj = json ? JSON.parse(json) : {}; } catch (e) { return all; } if (L === 2) delete obj.level; else obj.level = L; const j = Object.keys(obj).length ? ' ' + JSON.stringify(obj) : ''; o = open + j + close + (ws || ''); }
      return o + '<h' + L + attrs + '>' + inner + '</h' + L + '>' + (endc ? (ws2 || '') + endc : '');
    });
    bump('h1_to_h2', h1); bump('heading_levels', lv); bump('empty_heading', em);

    // images without alt text
    if (c.alt !== false && c.title) {
      let idx = 0, fixed = 0;
      s = s.replace(/<img\b[^>]*>/gi, (tag) => {
        idx++;
        if (/\b(?:role\s*=\s*["']?(?:presentation|none)|aria-hidden\s*=\s*["']?true)/i.test(tag)) return tag;
        const m = tag.match(/\salt\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
        if (m && String(m[1] != null ? m[1] : m[2]).trim()) return tag;
        const t = tag.match(/\stitle\s*=\s*(?:"([^"]+)"|'([^']+)')/i); const text = t ? String(t[1] || t[2]).trim() : altFor(c, idx, (tag.match(/\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i) || []).slice(1).find(Boolean)); if (!text) return tag;
        fixed++;
        if (m) return tag.replace(m[0], ' alt="' + escAttr(text) + '"');
        return tag.replace(/^<img\b/i, '<img alt="' + escAttr(text) + '"');
      });
      bump('img_alt', fixed);
    }
    // target=_blank without rel
    let rl = 0; s = s.replace(/<a\b([^>]*)>/gi, (tag, a) => { if (/\btarget\s*=\s*["']?_blank/i.test(a) && !/\brel\s*=/i.test(a)) { rl++; return '<a' + a + ' rel="noopener">'; } return tag; }); bump('link_rel', rl);
    return { html: s, changes: ch, count: total(ch) };
  }

  /* ------------------------------------------------------------------ verification */
  function fingerprint(html) {
    const h = String(html == null ? '' : html);
    const links = (h.match(/\b(?:href|src)\s*=\s*(?:"[^"]*"|'[^']*')/gi) || []).join('\n');
    const nums = (digitsLatin(plain(h)).match(/\d+/g) || []).join(',');
    const tags = {}; (h.replace(/<!--[\s\S]*?-->/g, '').match(/<([a-zA-Z][\w:-]*)\b/g) || []).forEach((t) => { const k = t.slice(1).toLowerCase(); if (/^(?:p|br|h[1-6])$/.test(k)) return; tags[k] = (tags[k] || 0) + 1; });
    const letters = (plain(h).match(/[؀-ۿ]/g) || []).filter((c) => c !== ZW).length;
    const shortcodes = (h.match(/\[\/?[A-Za-z_][^\]\n]{0,200}\]/g) || []).join('|');
    return { links, nums, tags: JSON.stringify(Object.keys(tags).sort().map((k) => [k, tags[k]])), letters, shortcodes };
  }
  /** True only when numbers, links, shortcodes and non-text tags are identical and the letter count moved by < 3%. */
  function verify(before, after) {
    const a = fingerprint(before), b = fingerprint(after);
    if (a.links !== b.links) return { ok: false, reason: 'پیوندها یا آدرس تصاویر تغییر می‌کرد.' };
    if (a.nums !== b.nums) return { ok: false, reason: 'اعداد متن تغییر می‌کرد.' };
    if (a.shortcodes !== b.shortcodes) return { ok: false, reason: 'شورت‌کدها تغییر می‌کرد.' };
    if (a.tags !== b.tags) return { ok: false, reason: 'ساختار برچسب‌ها تغییر می‌کرد.' };
    if (Math.abs(a.letters - b.letters) > Math.max(8, a.letters * 0.03)) return { ok: false, reason: 'حجم متن بیش از حد مجاز تغییر می‌کرد.' };
    return { ok: true };
  }

  const LABELS = { arabic_chars: 'حروف عربی (ي ك ى)', arabic_digits: 'ارقام عربی', tatweel: 'کشیدهٔ تزئینی', zwnj: 'نیم‌فاصله', spaces: 'فاصلهٔ اضافه', spelling: 'غلط املایی رایج', repeated_word: 'واژهٔ تکراری', punctuation: 'نشانه‌گذاری', empty_paragraph: 'پاراگراف خالی', h1_to_h2: 'H1 داخل متن', heading_levels: 'پرش سطح تیتر', empty_heading: 'تیتر خالی', img_alt: 'alt تصویر', link_rel: 'rel پیوند' };
  const TEXT_CODES = ['arabic_chars', 'arabic_digits', 'tatweel', 'zwnj', 'spaces', 'spelling', 'repeated_word', 'punctuation'];
  const MARKUP_CODES = ['empty_paragraph', 'h1_to_h2', 'heading_levels', 'empty_heading', 'img_alt', 'link_rel'];

  /**
   * Full content pass = typography + SEO markup, verified. opts: { title, markup:false, headings:false, alt:false }.
   * Returns { html, changed, changes, textCount, markupCount, rejected? }. On any safety failure the original is returned.
   */
  function polishContent(html, opts) {
    const o = opts || {}; const before = String(html == null ? '' : html);
    if (!before.trim()) return { html: before, changed: false, changes: {}, textCount: 0, markupCount: 0 };
    // markup first: removing empty blocks can join text nodes, so typography must see the final structure (keeps the pass idempotent)
    const m = o.markup === false ? { html: before, changes: {}, count: 0 } : fixMarkup(before, o); const t = fixHtml(m.html);
    const changes = merge(merge({}, t.changes), m.changes); const after = t.html;
    if (after === before) return { html: before, changed: false, changes: {}, textCount: 0, markupCount: 0 };
    const sum = (c, codes) => codes.reduce((n, k) => n + (c[k] || 0), 0);
    const v = verify(before, after);
    if (v.ok) return { html: after, changed: true, changes, textCount: sum(changes, TEXT_CODES), markupCount: sum(changes, MARKUP_CODES) };
    // v1.34 ladder: one unsafe edit must not cost the page every safe one. (2) text only, (3) block by block, each block verified alone.
    const t2 = fixHtml(before);
    if (t2.html !== before) { const v2 = verify(before, t2.html); if (v2.ok) return { html: t2.html, changed: true, changes: t2.changes, textCount: sum(t2.changes, TEXT_CODES), markupCount: 0, degraded: 'text_only', note: v.reason }; }
    const pp = polishPartial(before);
    if (pp.html !== before && verify(before, pp.html).ok) return { html: pp.html, changed: true, changes: pp.changes, textCount: sum(pp.changes, TEXT_CODES), markupCount: 0, degraded: 'partial', skippedBlocks: pp.skipped, note: v.reason };
    return { html: before, changed: false, changes: {}, textCount: 0, markupCount: 0, rejected: v.reason };
  }
  /** Typography per top-level block; a block whose fix would break the fingerprint is left exactly as it was. */
  function polishPartial(before) {
    const chunks = String(before).split(/(?<=<\/(?:p|h[1-6]|li|blockquote|figcaption|td|th|pre)>|-->)/i); const changes = {}; let skipped = 0, out = '';
    chunks.forEach((c) => { if (!c.trim()) { out += c; return; } const t = fixHtml(c); if (t.html === c) { out += c; return; } if (verify(c, t.html).ok) { out += t.html; merge(changes, t.changes); } else { out += c; skipped++; } });
    return { html: out, changes, skipped };
  }
  /** Human text for a changes map. */
  function describe(changes) { return Object.keys(changes || {}).filter((k) => changes[k]).map((k) => (LABELS[k] || k) + ' ' + fa(changes[k])).join('، '); }

  /* ------------------------------------------------------------------ SEO fields from the item's own text */
  const EDGE_STOP = new Set(['و', 'یا', 'از', 'به', 'در', 'با', 'برای', 'که', 'را', 'این', 'آن', 'تا', 'بر', 'the', 'and', 'for', 'of', 'a']);
  const BOILER = /^(?:خرید|قیمت|فروش|مشخصات|بررسی|معرفی|آموزش|بهترین)\s+/;
  const DANGLING = /(?:\s+(?:و|یا|با|از|به|در|که|را|برای|تا|بر|این|آن))+$/;
  const cutAtWord = (s, max) => { const a = Array.from(String(s).trim()); if (a.length <= max) return a.join(''); const cut = a.slice(0, max).join(''); const t = cut.replace(/\s+\S*$/, '').trim(); return t || cut.trim(); };
  const tidyEnd = (s) => String(s).replace(DANGLING, '').replace(/[\s،؛:|\-–—.,]+$/, '').trim();

  function cleanTitle(title, brand) {
    let t = plain(title).replace(/\s+/g, ' ').trim(); const parts = t.split(/\s*[|–—]\s*|\s+-\s+/).map((x) => x.trim()).filter(Boolean);
    if (parts.length > 1) { const nb = norm(brand); const keep = parts.filter((p) => !nb || norm(p) !== nb); t = keep[0] || parts[0]; }
    const stripped = t.replace(BOILER, '').trim(); if (stripped.split(' ').length >= 2) t = stripped;
    return t;
  }
  /** Best focus keyword: a 2–3 word phrase of the title that also occurs in the body (single word if the title has one). */
  function focusKeyword(title, text, brand) {
    const t = cleanTitle(title, brand); const w = t.split(' ').filter(Boolean); if (!w.length) return '';
    if (w.length === 1) return w[0];
    const body = norm(text); const cands = [];
    for (let n = Math.min(3, w.length); n >= 2; n--) for (let i = 0; i + n <= w.length; i++) {
      const g = w.slice(i, i + n); if (EDGE_STOP.has(norm(g[0])) || EDGE_STOP.has(norm(g[n - 1]))) continue;
      const k = norm(g.join(' ')); let c = 0, p = 0; if (body) while (c < 6 && (p = body.indexOf(k, p)) !== -1) { c++; p += k.length; }
      cands.push({ text: g.join(' '), score: c * 2 + n * 2.5 + (i === 0 ? 1 : 0), c });
    }
    if (!cands.length) return w.slice(0, 3).join(' ');
    cands.sort((a, b) => b.score - a.score); const top = cands[0];
    return (body && top.c === 0) ? w.slice(0, Math.min(3, w.length)).join(' ') : top.text;
  }

  // حدود از SeoPolicy (تنها مرجع)؛ مقدار پیش‌فرض فقط برای بارگذاری بدون آن.
  const LIM = Policy ? Policy.LIMITS : { title: { min: 20, target: 60 }, meta: { min: 70, max: 160 } };
  const TMIN = LIM.title.min, TMAX = LIM.title.target, DMIN = LIM.meta.min, DMAX = LIM.meta.max;
  function fitTitle(s) {
    s = String(s).replace(/\s+/g, ' ').trim(); if (len(s) <= TMAX) return s;
    const seg = s.split(/\s*[:：|–—]\s*|\s+-\s+/); let acc = ''; for (const p of seg) { const next = acc ? acc + ' – ' + p : p; if (len(next) <= TMAX) acc = next; else break; }
    if (len(acc) >= TMIN) return acc;
    return tidyEnd(cutAtWord(s, TMAX - 2));
  }
  // Very short names are lengthened with the 1–2 words that really follow the name in the item's own text ("چای" → "چای سیاه ایرانی").
  function extendFromText(base, text) {
    const lite = (x) => String(x).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\u200c/g, ' ').toLowerCase(); const src = plain(text); if (!src || len(base) >= TMIN) return '';
    const i = lite(src).indexOf(lite(base)); if (i < 0) return '';
    const rest = src.slice(i + base.length).trim().split(/\s+/).slice(0, 2); const out = [];
    for (const w of rest) { if (!new RegExp('^[' + FA + ZW + ']{2,}$').test(w) || EDGE_STOP.has(norm(w))) break; out.push(w); }
    return out.length ? base + ' ' + out.join(' ') : '';
  }
  /** SEO title 20–60 chars. Returns { value, why }. `taken(normTitle)` tells whether another item already uses it. */
  function buildTitle(item, o) {
    const opt = o || {}; const brand = String(opt.brand || '').trim(); const kind = opt.kind || (item && item.type === 'product' ? 'product' : 'article'); const taken = opt.taken || (() => false);
    const base = plain(item && item.title).replace(/\s+/g, ' ').trim(); if (!base) return { value: '', why: 'نام محتوا خالی است.' };
    const hasBrand = brand && norm(base).includes(norm(brand)); const list = [];
    const add = (v) => { v = fitTitle(v); if (v) list.push(v); };
    const intent = opt.intent || (kind === 'product' ? 'transactional' : 'informational'); const kw = String(opt.keyword || '').trim();
    const variants = [base]; if ((kind === 'product' || intent === 'transactional') && !/^خرید\s/.test(base) && intent !== 'informational') variants.push('خرید ' + base);
    if ((kind === 'article' || intent === 'informational') && !/راهنما/.test(base)) variants.push(base + ' – راهنمای کامل');
    if (kw && norm(base).indexOf(norm(kw)) < 0 && len(kw + ' | ' + base) <= TMAX) variants.push(kw + ' | ' + base);
    const ext = extendFromText(base, opt.text); if (ext) variants.splice(1, 0, ext);
    variants.forEach((v) => { if (brand && !hasBrand && len(v + ' | ' + brand) <= TMAX) add(v + ' | ' + brand); });
    variants.forEach((v) => add(v));
    const seen = new Set(); let tooShort = false; const ok = [];
    for (const v of list) { if (seen.has(v)) continue; seen.add(v); if (len(v) < TMIN) { tooShort = true; continue; } if (len(v) > TMAX) continue; if (Policy && !Policy.titleFits(v)) continue; if (Policy && Policy.lintField('title', v, { evidence: (opt.text || '') + ' ' + (item && item.title || '') + ' ' + (brand || '') }).length) continue; if (taken(norm(v))) continue; ok.push(v); }
    if (ok.length) return { value: ok.map((v) => ({ v, s: scoreTitle(v, { kw, brand, intent }) })).sort((x, y) => y.s - x.s)[0].v, why: '', candidates: ok.length };
    return { value: '', why: tooShort && !list.some((v) => len(v) >= TMIN) ? 'عنوان بسیار کوتاه است؛ نام کامل‌تری برای آن بگذار.' : 'عنوان سئوی یکتا ساخته نشد؛ نام باید متمایزتر باشد.' };
  }
  /** Scores a title candidate (0–100): keyword early, ideal length, intent fit, brand at the end, no repeated words. */
  function scoreTitle(v, o) {
    const x = o || {}; const n = norm(v); let sc = 50; const L = len(v);
    sc += L >= 35 && L <= 58 ? 15 : L >= 25 ? 8 : 0;
    if (x.kw) { const i = n.indexOf(norm(x.kw)); sc += i === 0 ? 20 : i > 0 ? (i <= 30 ? 12 : 5) : -15; }
    if (x.intent === 'transactional' && /^خرید\s/.test(v)) sc += 6; if (x.intent === 'informational' && /^خرید\s/.test(v)) sc -= 12; if (x.intent === 'informational' && /راهنما|آموزش|چیست/.test(v)) sc += 6;
    if (x.brand && norm(v).endsWith(norm(x.brand))) sc += 4;
    const w = n.split(' ').filter((t) => t.length > 2); if (w.length && new Set(w).size < w.length) sc -= 8;
    return sc;
  }

  const PLACE = /lorem|ipsum|\bTODO\b|\{\{|\[object|لورم|متن\s*(?:نمونه|آزمایشی)/i;
  /** Block ends are sentence ends: a paragraph/list item without a final period must not run into the next one (that produced meta descriptions cut mid-thought); headings are never sentences. */
  function blockSentences(t) { const h = String(t == null ? '' : t); return /<\/?[a-z]/i.test(h) ? h.replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi, ' ').replace(/([^.!؟?…:؛\s])\s*(<\/(?:p|li|div|td|blockquote)>)/gi, '$1.$2') : h; }
  function sentencesOf(text) {
    return plain(blockSentences(text)).split(/(?<=[.!؟?…])\s+/).map((x) => x.trim()).filter((x) => len(x) >= 20 && !PLACE.test(x) && !FILLER.test(x) && /[؀-ۿ]/.test(x));
  }
  // generic template sentences that say nothing about the product must never be a meta description or short description
  const FILLER = /(مشخصات بالا|پیش از (?:انتخاب|خرید)|تصمیم (?:خرید )?نگیرید|عبارت‌های تبلیغاتی|مشخصات ثبت‌شدهٔ (?:زیر|همین)|از فروشنده یا تولیدکننده)/;
  function cutClause(s, max) {
    const a = Array.from(s); if (a.length <= max) return s; const head = a.slice(0, max).join('');
    const i = Math.max(head.lastIndexOf('،'), head.lastIndexOf('؛'), head.lastIndexOf(':'), head.lastIndexOf(' - '), head.lastIndexOf(' – '));
    if (i >= 60) return head.slice(0, i).replace(/[\s،؛:–-]+$/, '') + '.';
    const w = tidyEnd(cutAtWord(s, max - 2)); return len(w) >= 60 ? w.replace(/[\s،؛:–-]+$/, '') + '.' : w + '…';
  }
  /** Meta description 70–160 chars made of the item's own whole sentences. Returns { value, why }. */
  function buildMeta(item, o) {
    const opt = o || {}; const taken = opt.taken || (() => false); const focus = String(opt.focus || '').trim();
    const rawSrc = (item && (item.content || item.contentPreview)) || ''; const src = plain(rawSrc) || plain(item && item.excerpt); const s = sentencesOf(rawSrc || (item && item.excerpt) || '').slice(0, 12);
    if (!s.length) return { value: '', why: 'جملهٔ کافی برای توضیحات متا در متن نیست.' };
    const hit = focus ? s.findIndex((x, i) => i < 6 && norm(x).includes(norm(focus))) : -1; const starts = []; if (hit > 0) starts.push(hit); starts.push(0); for (let i = 1; i < Math.min(s.length, 4); i++) if (i !== hit) starts.push(i);
    const title = plain(item && item.title); const cands = [];
    for (const st of starts) {
      let out = s[st]; let j = st + 1; while (j < s.length && len(out + ' ' + s[j]) <= 158) { out += ' ' + s[j]; j++; }
      if (len(out) > DMAX) out = cutClause(out, 155);
      if (len(out) < DMIN && title && !norm(out).startsWith(norm(title))) { const p = title + '؛ ' + out; if (len(p) <= DMAX) out = p; }
      if (len(out) < DMIN) continue;
      out = out.replace(/\s+/g, ' ').trim(); if (len(out) < DMIN || len(out) > 170) continue;
      if (taken(norm(out))) continue; if (Policy && Policy.lintField('meta', out, { evidence: src + ' ' + title }).length) continue; if (!cands.some((c) => c.v === out)) cands.push({ v: out, s: scoreMeta(out, focus, st) - (norm(src).includes(norm(out).replace(/[.…]+$/, '')) ? 0 : 25) });
    }
    if (cands.length) return { value: cands.sort((x, y) => y.s - x.s)[0].v, why: '', candidates: cands.length };
    return { value: '', why: 'توضیحات متای معتبر (۷۰ تا ۱۶۰ نویسه) و یکتا از متن فعلی ساخته نشد.' };
  }
  /** Scores a meta description: keyword early, concrete facts (numbers/units), ideal length, not a generic opener. */
  function scoreMeta(v, focus, start) {
    const n = norm(v); let sc = 50; const L = len(v); sc += L >= 120 && L <= 158 ? 15 : L >= 90 ? 8 : 0;
    if (focus) { const i = n.indexOf(norm(focus)); sc += i >= 0 ? (i <= 40 ? 18 : 10) : -12; }
    if (/\d/.test(n)) sc += 6; if (/(گرم|کیلو|سانت|میلی|لیتر|عددی|بسته|ارسال|ضمانت|جنس|ترکیب)/.test(v)) sc += 6;
    if (/^(?:در این|امروز|سلام|به نام خدا|همان‌طور|همانطور)/.test(v)) sc -= 12; sc -= (start || 0) * 2; return sc;
  }
  /** Everything for an item in one call. o: { brand, kind, takenTitle(norm), takenMeta(norm) }. Values are typography-corrected. */
  function seoFields(item, o) {
    const opt = o || {}; const text = plain((item && (item.content || item.contentPreview)) || '') || plain(item && item.excerpt);
    const focus = String(opt.keyword || '').trim() || focusKeyword(item && item.title, text, opt.brand);
    const t = buildTitle(item, { brand: opt.brand, kind: opt.kind, taken: opt.takenTitle, text, intent: opt.intent, keyword: opt.keyword });
    const d = buildMeta(item, { focus, taken: opt.takenMeta });
    return { seo_title: fixPlain(t.value).text, meta_description: fixPlain(d.value).text, focus_keyword: focus, title_why: t.why, meta_why: d.why };
  }

  /* ------------------------------------------------------------------ content audit (report only, never edits) */
  const AUDIT_LABELS = { kw_stuffing: 'تکرار بیش‌ازحد عبارت کلیدی', kw_missing_intro: 'عبارت کلیدی در ابتدای متن نیست', kw_missing_heading: 'عبارت کلیدی در هیچ زیرتیتری نیست', long_paragraph: 'پاراگراف بسیار بلند', long_sentence: 'جمله‌های بلند (خوانایی کم)', no_headings: 'متن بلند بدون زیرتیتر', no_links: 'متن بلند بدون پیوند داخلی/خارجی' };
  /** Reading/SEO quality of one body. Returns [{code,label,detail}]. Needs real HTML; short texts (< 80 words) are not judged. */
  function audit(html, o) {
    const opt = o || {}; const h = String(html == null ? '' : html); const text = plain(h); const words = text.split(/\s+/).filter(Boolean); const out = []; if (words.length < 80) return out;
    const add = (code, detail) => out.push({ code, label: AUDIT_LABELS[code], detail: detail || '' });
    const focus = String(opt.focus || '').trim() || focusKeyword(opt.title, text, opt.brand); const nf = norm(focus);
    if (nf) {
      const body = norm(text); let c = 0, p = 0; while ((p = body.indexOf(nf, p)) !== -1) { c++; p += nf.length; }
      const density = (c * nf.split(' ').length) / words.length * 100;
      if (words.length >= 100 && density > 3.5) add('kw_stuffing', 'چگالی حدود ' + fa(Math.round(density * 10) / 10) + '٪');
      if (!norm(words.slice(0, 120).join(' ')).includes(nf)) add('kw_missing_intro');
      const heads = (h.match(/<h[2-3]\b[^>]*>[\s\S]*?<\/h[2-3]>/gi) || []).map(plain); if (heads.length >= 3 && !heads.some((x) => norm(x).includes(nf))) add('kw_missing_heading');
    }
    const paras = (h.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || []).map(plain); const longP = paras.filter((x) => x.split(/\s+/).length > 150).length; if (longP) add('long_paragraph', fa(longP) + ' مورد');
    const sents = text.split(/(?<=[.!؟?])\s+/).filter((x) => x.length > 3); if (sents.length >= 4 && words.length / sents.length > 28) add('long_sentence', 'میانگین ' + fa(Math.round(words.length / sents.length)) + ' واژه');
    if (words.length > 300 && !/<h[2-4]\b/i.test(h)) add('no_headings');
    if (words.length > 300 && !/<a\b[^>]*href/i.test(h)) add('no_links');
    return out;
  }

  /* ------------------------------------------------------------------ FAQ from registered facts (completes existing text) */
  /** Q/A pairs built ONLY from the product's registered attributes/weight/dimensions. Each answer repeats the stored value verbatim. */
  function faqPairs(item) {
    const p = item && item.product && typeof item.product === 'object' ? item.product : {}; const pairs = [];
    (Array.isArray(p.attributes) ? p.attributes : []).forEach((a) => {
      const name = String(a && (a.label || a.name) || '').trim(); const opts = Array.isArray(a && a.options) ? a.options.map((v) => String(v).trim()).filter(Boolean) : [];
      if (name && opts.length && name.length <= 30) pairs.push([name + ' این محصول چیست؟', name + ' این محصول ' + opts.join('، ') + ' ثبت شده است.']);
    });
    if (p.weight) pairs.push(['وزن این محصول چقدر است؟', 'وزن ثبت‌شدهٔ این محصول ' + String(p.weight) + (p.weight_unit ? ' ' + String(p.weight_unit) : '') + ' است.']);
    const d = p.dimensions && typeof p.dimensions === 'object' ? ['length', 'width', 'height'].filter((k) => p.dimensions[k]).map((k) => ({ length: 'طول', width: 'عرض', height: 'ارتفاع' }[k] + ' ' + p.dimensions[k])) : [];
    if (d.length) pairs.push(['ابعاد این محصول چقدر است؟', 'ابعاد ثبت‌شده: ' + d.join('، ') + (p.dimensions.unit ? ' ' + String(p.dimensions.unit) : '') + '.']);
    return pairs.slice(0, 5);
  }
  /** Appends a "پرسش‌های متداول" section when the text has none and ≥2 registered facts exist. Returns { html, added }. */
  function enrichFaq(html, item) {
    const h = String(html == null ? '' : html); const pairs = faqPairs(item);
    if (pairs.length < 2 || plain(h).split(/\s+/).length < 25 || /پرسش‌های\s*متداول|سوالات\s*متداول|پرسش(?:‌|\s)?و(?:\s)?پاسخ/.test(plain(h)) || /\[\/?(?:vc_|et_pb_|fusion_|elementor)/i.test(h)) return { html: h, added: 0 };
    const gb = /<!--\s*wp:/.test(h); const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const head = gb ? '<!-- wp:heading -->\n<h2 class="wp-block-heading">پرسش‌های متداول</h2>\n<!-- /wp:heading -->' : '<h2>پرسش‌های متداول</h2>';
    const body = pairs.map(([q, a]) => gb ? '<!-- wp:heading {"level":3} -->\n<h3 class="wp-block-heading">' + esc(q) + '</h3>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>' + esc(a) + '</p>\n<!-- /wp:paragraph -->' : '<h3>' + esc(q) + '</h3>\n<p>' + esc(a) + '</p>').join('\n\n');
    return { html: h.replace(/\s+$/, '') + '\n\n' + head + '\n\n' + body + '\n', added: pairs.length };
  }

  /* ------------------------------------------------------------------ smart internal links */
  const reEsc = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /**
   * Adds up to `max` internal links where another page of the SAME site is already named in the text (target title or focus phrase, ≥ 2 words, exact match).
   * Only plain paragraph/list text is linked: never headings, existing links, code, shortcodes or page-builder content. Visible text is unchanged (verified).
   * targets: [{ id, url, title, focusKeyword }]. Returns { html, added:[{id,phrase}] }.
   */
  function addInternalLinks(html, self, targets, o) {
    const opt = o || {}; const src = String(html == null ? '' : html); const none = { html: src, added: [] };
    if (!src || /\[\/?(?:vc_|et_pb_|fusion_|elementor)/i.test(src) || plain(src).split(/\s+/).length < 80) return none;
    const existing = (src.match(/<a\b[^>]*href\s*=/gi) || []).length; const room = Math.min(opt.max || 3, Math.max(0, (opt.maxTotal || 4) - existing)); if (room <= 0) return none;
    const linked = new Set((src.match(/href\s*=\s*["']([^"']+)["']/gi) || []).map((x) => x.replace(/^href\s*=\s*["']|["']$/gi, '')));
    const cands = [];
    (targets || []).forEach((t) => {
      if (!t || !t.url || String(t.id) === String(self && self.id) || linked.has(t.url) || t.url === (self && self.url)) return;
      const phr = [t.focusKeyword, cleanTitle(t.title, opt.brand)].map((x) => String(x || '').replace(/\s+/g, ' ').trim()).filter((x) => x.split(' ').length >= 2 && len(x) >= 8);
      [...new Set(phr)].forEach((x) => cands.push({ t, phrase: x }));
    });
    cands.sort((a, b) => len(b.phrase) - len(a.phrase)); if (!cands.length) return none;
    const used = new Set(), added = []; const BLOCK = /^(a|h[1-6]|script|style|pre|code|kbd|samp|button|textarea|svg|math|noscript|figcaption)$/i;
    const re = /<!--[\s\S]*?-->|<([a-zA-Z][\w:-]*)\b[^>]*>|<\/([a-zA-Z][\w:-]*)\s*>/g; let out = '', last = 0, depth = 0, m;
    const inside = (text, idx) => text.lastIndexOf('[', idx) > text.lastIndexOf(']', idx) || /https?:\/\/\S*$/.test(text.slice(0, idx));
    const link = (text) => {
      if (depth > 0 || added.length >= room) return text;
      for (const c of cands) {
        if (added.length >= room) break; if (used.has(String(c.t.id))) continue;
        const rx = new RegExp('(?<![' + FA + ZW + '])' + reEsc(c.phrase) + '(?![' + FA + ZW + '])', 'g'); let mm, hit = null;
        while ((mm = rx.exec(text))) { if (!inside(text, mm.index)) { hit = mm; break; } }
        if (!hit) continue;
        used.add(String(c.t.id)); added.push({ id: c.t.id, phrase: hit[0], url: c.t.url });
        text = text.slice(0, hit.index) + '<a href="' + escAttr(c.t.url) + '">' + hit[0] + '</a>' + text.slice(hit.index + hit[0].length);
      }
      return text;
    };
    while ((m = re.exec(src))) {
      const text = src.slice(last, m.index); out += link(text) + m[0]; last = re.lastIndex;
      if (m[0].charAt(1) === '!') continue;
      if (m[1] && BLOCK.test(m[1]) && !/\/>$/.test(m[0])) depth++; else if (m[2] && BLOCK.test(m[2]) && depth > 0) depth--;
    }
    out += link(src.slice(last));
    const bare = (x) => String(x).replace(/<[^>]+>/g, ''); if (!added.length || bare(out) !== bare(src)) return none; // visible text must be identical
    return { html: out, added };
  }

  /* ------------------------------------------------------------------ grounding: self-review of model-written text */
  // Strong claims a small model likes to invent. They are allowed only when the provided facts already contain the same word.
  const CLAIM = ['بهترین', 'برترین', 'تضمین', 'ضمانت', 'گارانتی', 'اصل', 'اورجینال', 'جایزه', 'برنده', 'ایزو', 'iso', 'fda', 'استاندارد', 'مجوز', 'آزمایشگاه', 'پژوهش', 'تحقیقات', 'دانشمند', 'پزشک', 'درمان', 'ارگانیک', 'طبیعی', '۱۰۰٪', '100%', 'رایگان', 'تخفیف', 'پرفروش', 'محبوب‌ترین', 'ارسال فوری', 'بازگشت وجه'];
  const STOPW = new Set(['این', 'آن', 'برای', 'است', 'هستند', 'شود', 'کند', 'یک', 'های', 'ها', 'که', 'را', 'با', 'از', 'به', 'در', 'تا', 'یا', 'هم', 'نیز', 'بر', 'می', 'خود', 'همین', 'تمام', 'بسیار', 'بیشتر', 'کمتر', 'محصول', 'مقاله']);
  const toks = (x) => norm(x).split(/[^\u0621-\u063A\u0641-\u064A\u0671-\u06D3\u06D5a-z0-9]+/).filter((t) => t.length >= 3 && !STOPW.has(t));
  /** Problems found when comparing generated HTML with the facts it was allowed to use: [{ code, detail }]. */
  function groundingIssues(html, facts, title) {
    const out = []; const text = plain(html); if (!text) return out; const evid = norm(String(facts || '') + ' ' + String(title || ''));
    const nums = [...new Set((digitsLatin(text).match(/\d+(?:[.,٫]\d+)?/g) || []))].filter((n) => !evid.includes(n) && !/^\d{1,2}$/.test(n));
    if (nums.length) out.push({ code: 'ungrounded_number', detail: nums.slice(0, 6).join('، ') });
    const nt = norm(text); const claims = CLAIM.filter((c) => { const k = norm(c); return (nt.includes(k) && !evid.includes(k)); });
    if (claims.length) out.push({ code: 'unsupported_claim', detail: claims.slice(0, 6).join('، ') });
    const have = new Set(toks(evid)); const sents = text.split(/(?<=[.!؟?])\s+/).filter((x) => x.length > 25); const loose = sents.filter((x) => { const t = toks(x); return t.length >= 4 && !t.some((w) => have.has(w)); });
    if (sents.length >= 4 && loose.length / sents.length > 0.6) out.push({ code: 'ungrounded_text', detail: fa(loose.length) + ' از ' + fa(sents.length) + ' جمله هیچ ارتباطی با اطلاعات داده‌شده ندارد' });
    return out;
  }
  /** Removes sentences (inside p/li) that carry an unsupported claim or an ungrounded number; fixes typography. Returns { html, removed }. */
  function cleanGenerated(html, facts, title) {
    const evid = norm(String(facts || '') + ' ' + String(title || '')); let removed = 0; const bad = (sent) => {
      const n = norm(sent); if (CLAIM.some((c) => n.includes(norm(c)) && !evid.includes(norm(c)))) return true;
      return (digitsLatin(sent).match(/\d+(?:[.,٫]\d+)?/g) || []).some((x) => !evid.includes(x) && !/^\d{1,2}$/.test(x));
    };
    let out = String(html || '').replace(/<(p|li)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (all, tag, attrs, inner) => {
      if (/<(?:a|img|strong|em|ul|ol|table)\b/i.test(inner)) return all;
      const parts = inner.split(/(?<=[.!؟?])\s+/); const keep = parts.filter((x) => !bad(x)); if (keep.length === parts.length) return all;
      removed += parts.length - keep.length; return keep.length ? '<' + tag + attrs + '>' + keep.join(' ') + '</' + tag + '>' : '';
    });
    out = fixHtml(out).html; return { html: out, removed };
  }

  /** Cheap check used by the scanner: which Polish rule groups would change this text. */
  function detect(html, opts) {
    const r = polishContent(html, opts); if (!r.changed) return { text: 0, markup: 0, changes: {}, rejected: r.rejected || '' };
    return { text: r.textCount, markup: r.markupCount, changes: r.changes, rejected: '' };
  }

  /* ------------------------------------------------------------------ v1.34 quality evaluation (0..100, explained) */
  const PART_LABELS = { depth: 'عمق و حجم متن', typography: 'نگارش و املا', structure: 'ساختار و تیترها', seo: 'سئوی صفحه', readability: 'خوانایی', extras: 'پیوند، تصویر و پرسش‌ها' };
  const PART_MAX = { depth: 20, typography: 20, structure: 15, seo: 25, readability: 10, extras: 10 };
  const gradeOf = (n) => (n >= 85 ? 'عالی' : n >= 70 ? 'خوب' : n >= 50 ? 'نیازمند بهبود' : 'ضعیف');
  /**
   * Explained quality score of one item: { score, grade, parts:[{key,label,pts,max,note,fixable}], weakest }.
   * item: { title, content, metaTitle, metaDescription, focusKeyword, type }. Deterministic and cheap (no network, no model).
   * `fixable` marks parts the automatic polish can raise by itself (typography, markup structure); the rest need real information.
   */
  function score(item, o) {
    const it = item || {}; const opt = o || {}; const html = String(it.content == null ? '' : it.content); const text = plain(html);
    const words = text.split(/\s+/).filter(Boolean).length; const product = it.type === 'product'; const need = product ? 120 : 300;
    const parts = []; const add = (key, pts, note, fixable) => { const max = PART_MAX[key]; parts.push({ key, label: PART_LABELS[key], pts: Math.max(0, Math.min(max, Math.round(pts))), max, note: note || '', fixable: !!fixable }); };
    // depth
    add('depth', PART_MAX.depth * Math.min(1, words / need), words === 0 ? 'متن خالی است' : words < need ? 'فقط ' + fa(words) + ' واژه؛ حدود ' + fa(need) + ' لازم است' : '');
    // typography: issues per 1000 words
    let typo = 0, mk = 0; if (words) { const d = detect(html, { title: it.title }); typo = d.text; mk = d.markup; }
    const per1k = words ? typo / Math.max(1, words) * 1000 : 0;
    add('typography', PART_MAX.typography - Math.min(PART_MAX.typography, per1k * 3 + (typo ? 1 : 0)), typo ? fa(typo) + ' مورد قابل اصلاح' : '', typo > 0);
    // structure
    const h1 = (html.match(/<h1\b/gi) || []).length; let st = PART_MAX.structure - Math.min(10, mk * 2); const heads = (html.match(/<h[2-4]\b/gi) || []).length;
    const stNotes = []; if (mk) stNotes.push(fa(mk) + ' مشکل ساختاری قابل اصلاح'); if (words > 300 && !heads) { st -= 5; stNotes.push('بدون تیتر'); } if (h1 > 1) stNotes.push('چند H1');
    add('structure', st, stNotes.join('، '), mk > 0);
    // seo fields
    const title = String(it.metaTitle || '').trim(), meta = String(it.metaDescription || '').trim(); const focus = String(it.focusKeyword || '').trim() || (words ? focusKeyword(it.title, text, opt.brand) : '');
    const nf = norm(focus); let sc = 0; const sn = [];
    if (!title) sn.push('عنوان سئو خالی'); else if (len(title) >= TMIN && len(title) <= TMAX) sc += 8; else { sc += 3; sn.push('طول عنوان سئو مناسب نیست'); }
    if (!meta) sn.push('توضیحات متا خالی'); else if (len(meta) >= DMIN && len(meta) <= DMAX) sc += 8; else { sc += 3; sn.push('طول توضیحات متا مناسب نیست'); }
    if (nf) { sc += 4; if (title && norm(title).includes(nf)) sc += 3; else sn.push('عبارت کلیدی در عنوان نیست'); if (meta && norm(meta).includes(nf)) sc += 2; else sn.push('عبارت کلیدی در متا نیست'); } else sn.push('عبارت کلیدی مشخص نیست');
    add('seo', sc, sn.join('، '), sc < PART_MAX.seo);
    // readability from the same audit the report uses
    let au = []; try { au = audit(html, { title: it.title, focus, brand: opt.brand }); } catch (e) {} const rd = au.filter((a) => /^(?:long_paragraph|long_sentence|kw_stuffing)$/.test(a.code));
    add('readability', PART_MAX.readability - Math.min(PART_MAX.readability, rd.length * 4), rd.map((a) => a.label).join('، '));
    // extras: internal link, image alts, FAQ / headings
    let ex = 0; const en = [];
    if (words < 150 || /<a\b[^>]*href/i.test(html)) ex += 3; else en.push('بدون پیوند');
    const imgs = html.match(/<img\b[^>]*>/gi) || []; if (!imgs.length || imgs.every((x) => /\balt\s*=\s*"[^"]+"/i.test(x))) ex += 3; else en.push('تصویر بدون alt');
    if (product ? /پرسش|سوالات|سؤالات|FAQ/i.test(text) || words < 80 : heads > 0 || words < 200) ex += 4; else en.push(product ? 'بدون پرسش‌های متداول' : 'بدون تیتر');
    add('extras', ex, en.join('، '), false);
    let total = parts.reduce((n, x) => n + x.pts, 0); if (!words) total = Math.min(total, 35); else if (words < need / 3) total = Math.min(total, 55);
    const weakest = parts.slice().sort((a, b) => (a.pts / a.max) - (b.pts / b.max))[0];
    return { score: total, grade: gradeOf(total), parts, weakest: weakest && weakest.pts < weakest.max ? weakest.key : '', words };
  }
  /** Averages many score() results: { avg, n, parts:{key:avgPct}, weak:[{key,label,pct}] } sorted weakest first. */
  function scoreMany(list) {
    const L = (list || []).filter(Boolean); if (!L.length) return { avg: 0, n: 0, parts: {}, weak: [] };
    const acc = {}; L.forEach((r) => r.parts.forEach((p) => { const a = acc[p.key] || (acc[p.key] = { sum: 0, max: 0 }); a.sum += p.pts; a.max += p.max; }));
    const parts = {}; Object.keys(acc).forEach((k) => { parts[k] = Math.round(acc[k].sum / acc[k].max * 100); });
    const weak = Object.keys(parts).map((k) => ({ key: k, label: PART_LABELS[k], pct: parts[k] })).sort((a, b) => a.pct - b.pct);
    return { avg: Math.round(L.reduce((n, r) => n + r.score, 0) / L.length), n: L.length, parts, weak };
  }

  return { score, scoreMany, gradeOf, PART_LABELS, polishPartial, groundingIssues, cleanGenerated, addInternalLinks, faqPairs, enrichFaq, audit, AUDIT_LABELS, fixText, fixHtml, fixPlain, fixMarkup, polishContent, verify, detect, describe, focusKeyword, buildTitle, buildMeta, scoreTitle, scoreMeta, seoFields, cleanTitle, LABELS, TEXT_CODES, MARKUP_CODES, TMIN, TMAX, DMIN, DMAX };
});
