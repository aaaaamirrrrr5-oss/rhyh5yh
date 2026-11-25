/* Site Inspector — fatext.js (v1.36.0)
 * Persian/English text analytics with NO AI model and NO API: normalization, stop-words, light stemming,
 * TF-IDF / BM25, cosine similarity, SimHash near-duplicate detection, key-phrase extraction, readability.
 * Pure logic, no DOM. UMD: works in the WebView and in Node tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FaText = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const ZWNJ = '\u200c';

  /* ---------- normalization ---------- */
  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩', FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  function normalize(s) {
    s = String(s == null ? '' : s);
    s = s.replace(/[\u064B-\u065F\u0670\u0640]/g, '')          // harakat + tatweel
      .replace(/ي/g, 'ی').replace(/ى/g, 'ی').replace(/ك/g, 'ک').replace(/[ۀة]/g, 'ه').replace(/[أإٱ]/g, 'ا')
      .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
      .replace(/[\u200b\u200d\u200e\u200f\u202a-\u202e\u00ad\ufeff]/g, '')
      .replace(/\u00a0/g, ' ');
    return s.replace(/\u200c{2,}/g, ZWNJ).replace(/[ \t]+/g, ' ');
  }

  /* ---------- stop-words ---------- */
  const FA_STOP = ('و در به از که این آن را با است برای بر هم یا اما اگر تا هر همه یک دو بود بود شد شده شود می نمی نیز هیچ چه چون پس بین روی زیر بعد قبل مثل مانند ولی بلکه' +
    ' من تو او ما شما ایشان آنها آن‌ها اینها این‌ها خود دیگر دیگری بسیار بیش بیشتر کم کمتر چند چنین چنان همین همان هنوز حتی فقط تنها باید می‌شود می‌کند کرد کرده کنید کنیم کنند کند دارد دارند داشت دارید' +
    ' هستند هست نیست نیستند بودن شدن کردن گرفت گیرد باشد باشند باشید بوده خواهد ها های ای ام اش ات یی تر ترین طور طریق مورد گونه نیز وی آنچه آنکه جا جای کجا کی کدام چرا چگونه چطور' +
    ' همچنین همچون زیرا بنابراین سپس درباره دربارهٔ توسط حدود طی ضمن علاوه لذا البته اینکه آنکه وقتی زمانی هنگامی').split(/\s+/).map((w) => normalize(w).split(ZWNJ).join(''));
  const EN_STOP = 'a an the and or but if then else of to in on at by for with from as is are was were be been being it its this that these those i you he she we they them his her our your not no do does did have has had will would can could should may might so such than too very just also into over under about up down out off more most other some any each every all both few'.split(' ');
  const STOP = new Set(FA_STOP.concat(EN_STOP));
  const isStop = (w) => STOP.has(w);

  /* ---------- stemming (light, conservative; suffix + prefix stripping) ---------- */
  const SUF_ZW = new Set(['ها', 'های', 'هایی', 'هایش', 'هایم', 'تر', 'ترین', 'ی', 'ام', 'ات', 'اش', 'مان', 'تان', 'شان', 'ایی', 'ان']);
  const SUF_JOIN = ['ترین', 'هایی', 'های', 'ها', 'ات', 'ان', 'تر'];
  function stemFa(tok) {
    if (tok.indexOf(ZWNJ) >= 0) {
      let parts = tok.split(ZWNJ).filter(Boolean);
      if (parts.length > 1 && (parts[0] === 'می' || parts[0] === 'نمی')) parts = parts.slice(1);           // می‌شود → شود
      while (parts.length > 1 && SUF_ZW.has(parts[parts.length - 1])) parts.pop();                           // کتاب‌ها → کتاب
      return parts.join('');
    }
    let w = tok;
    for (const s of SUF_JOIN) if (w.length - s.length >= 3 && w.endsWith(s)) { w = w.slice(0, -s.length); break; }
    if (w.length >= 5 && w.endsWith('ی') && !/[ایو]$/.test(w.slice(0, -1))) w = w.slice(0, -1);             // ماشینی → ماشین (not گویی)
    return w;
  }
  function stemEn(w) {
    if (w.length > 5 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
    if (w.length > 5 && /(ing|ers)$/.test(w)) return w.slice(0, -3);
    if (w.length > 4 && w.endsWith('es') && /(s|x|z|ch|sh)es$/.test(w)) return w.slice(0, -2);
    if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
    return w;
  }
  const isFa = (w) => /[\u0600-\u06ff]/.test(w);
  function stem(w) { return isFa(w) ? stemFa(w) : stemEn(w); }

  /* ---------- tokenizing ---------- */
  const TOKEN_RE = /[\p{L}\p{N}\u200c]+/gu;
  function rawTokens(text) {
    return (normalize(text).toLowerCase().match(TOKEN_RE) || []).map((t) => t.replace(/^\u200c+|\u200c+$/g, '')).filter(Boolean);
  }
  /* opts: stop (default true), stem (default true), min (default 2) */
  function tokens(text, opts) {
    const o = Object.assign({ stop: true, stem: true, min: 2 }, opts || {});
    const out = [];
    for (const t of rawTokens(text)) {
      const plain = t.split(ZWNJ).join('');
      if (/^\d+$/.test(plain) && plain.length < 2) continue;
      if (o.stop && (isStop(plain) || isStop(t))) continue;
      const s = o.stem ? stem(t) : plain;
      const w = s.split(ZWNJ).join('');
      if (w.length < o.min) continue;
      if (o.stop && isStop(w)) continue;
      out.push(w);
    }
    return out;
  }

  /* ---------- n-grams / key phrases ---------- */
  function keyPhrases(text, limit) {
    limit = limit || 10;
    const sentences = normalize(text).split(/[.!?؟؛\n،,:;]+/);
    const freq = new Map();
    for (const sen of sentences) {
      const raw = rawTokens(sen).map((t) => ({ w: stem(t).split(ZWNJ).join(''), p: t.split(ZWNJ).join('') }));
      for (let n = 2; n <= 3; n++) for (let i = 0; i + n <= raw.length; i++) {
        const g = raw.slice(i, i + n);
        if (isStop(g[0].p) || isStop(g[n - 1].p) || isStop(g[0].w) || isStop(g[n - 1].w) || g.some((x) => x.w.length < 2)) continue;
        const key = g.map((x) => x.w).join(' ');
        const e = freq.get(key) || { count: 0, shown: g.map((x) => x.p).join(' '), n };
        e.count++; freq.set(key, e);
      }
    }
    return Array.from(freq.entries()).filter(([, e]) => e.count >= 2)
      .sort((a, b) => (b[1].count * (b[1].n === 3 ? 1.3 : 1)) - (a[1].count * (a[1].n === 3 ? 1.3 : 1)))
      .slice(0, limit).map(([key, e]) => ({ phrase: e.shown, key, count: e.count, words: e.n }));
  }

  /* ---------- TF-IDF / BM25 corpus ---------- */
  function buildCorpus(docs) {
    const N = docs.length, df = new Map(), tf = new Map(), len = new Map(); let totalLen = 0;
    for (const d of docs) {
      const toks = d.tokens || tokens(d.text);
      const f = new Map(); for (const t of toks) f.set(t, (f.get(t) || 0) + 1);
      tf.set(d.id, f); len.set(d.id, toks.length); totalLen += toks.length;
      f.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1));
    }
    const idf = (t) => Math.log(1 + (N - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5));
    const avgdl = totalLen / Math.max(1, N);
    const vecCache = new Map();
    function vector(id) {
      if (vecCache.has(id)) return vecCache.get(id);
      const f = tf.get(id) || new Map(), L = Math.max(1, len.get(id) || 1), v = new Map(); let norm = 0;
      f.forEach((c, t) => { const w = (1 + Math.log(c)) * idf(t); v.set(t, w); norm += w * w; });
      norm = Math.sqrt(norm) || 1; v.forEach((w, t) => v.set(t, w / norm));
      vecCache.set(id, v); return v;
    }
    function cosine(a, b) {
      const A = vector(a), B = vector(b); let s = 0; const [S, T] = A.size < B.size ? [A, B] : [B, A];
      S.forEach((w, t) => { const x = T.get(t); if (x) s += w * x; });
      return s;
    }
    function topTerms(id, n) {
      const v = vector(id); return Array.from(v.entries()).sort((a, b) => b[1] - a[1]).slice(0, n || 10).map(([term, weight]) => ({ term, weight: +weight.toFixed(4), tf: (tf.get(id) || new Map()).get(term) || 0 }));
    }
    function bm25(queryTokens, id, k1, b) {
      k1 = k1 || 1.5; b = b == null ? 0.75 : b; const f = tf.get(id) || new Map(), L = len.get(id) || 0; let s = 0;
      for (const q of queryTokens) { const c = f.get(q) || 0; if (!c) continue; s += idf(q) * (c * (k1 + 1)) / (c + k1 * (1 - b + b * L / Math.max(1, avgdl))); }
      return s;
    }
    function search(query, limit) {
      const q = Array.isArray(query) ? query : tokens(query);
      return docs.map((d) => ({ id: d.id, score: bm25(q, d.id) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit || 10);
    }
    return { N, avgdl, idf, vector, cosine, topTerms, bm25, search, termFreq: (id, t) => (tf.get(id) || new Map()).get(t) || 0, length: (id) => len.get(id) || 0, df: (t) => df.get(t) || 0 };
  }

  /* ---------- SimHash (64-bit as two uint32) + shingles ---------- */
  function fnv(str, seed) { let h = (seed || 0x811c9dc5) >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
  function shingles(toks, k) { k = k || 4; const out = []; if (toks.length < k) return toks.length ? [toks.join(' ')] : []; for (let i = 0; i + k <= toks.length; i++) out.push(toks.slice(i, i + k).join(' ')); return out; }
  function simhash(text) {
    const toks = Array.isArray(text) ? text : tokens(text, { stop: false });
    const sh = shingles(toks, 3); const hi = new Array(32).fill(0), lo = new Array(32).fill(0);
    if (!sh.length) return null;
    for (const s of sh) { const a = fnv(s, 0x811c9dc5), b = fnv(s, 0x9747b28c); for (let i = 0; i < 32; i++) { hi[i] += (a >>> i) & 1 ? 1 : -1; lo[i] += (b >>> i) & 1 ? 1 : -1; } }
    let H = 0, L = 0; for (let i = 0; i < 32; i++) { if (hi[i] > 0) H |= 1 << i; if (lo[i] > 0) L |= 1 << i; }
    return [H >>> 0, L >>> 0];
  }
  const pop32 = (x) => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; };
  function hamming(a, b) { return a && b ? pop32((a[0] ^ b[0]) >>> 0) + pop32((a[1] ^ b[1]) >>> 0) : 64; }
  function jaccardShingles(a, b, k) {
    const A = new Set(shingles(Array.isArray(a) ? a : tokens(a, { stop: false }), k || 4)), B = new Set(shingles(Array.isArray(b) ? b : tokens(b, { stop: false }), k || 4));
    if (!A.size || !B.size) return 0; let n = 0; A.forEach((x) => { if (B.has(x)) n++; }); return n / (A.size + B.size - n);
  }

  /* ---------- readability (Persian-friendly heuristics) ---------- */
  function splitSentences(text) { return normalize(text).split(/(?<=[.!?؟])\s+|[\n]+/).map((s) => s.trim()).filter((s) => rawTokens(s).length >= 2); }
  function readability(text) {
    const sentences = splitSentences(text); const words = rawTokens(text);
    const paras = normalize(text).split(/\n{1,}/).map((p) => rawTokens(p).length).filter(Boolean);
    if (!sentences.length || words.length < 20) return { ok: false, words: words.length, sentences: sentences.length, score: null, notes: ['متن برای سنجش خوانایی خیلی کوتاه است.'] };
    const lens = sentences.map((s) => rawTokens(s).length); const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
    const longSent = lens.filter((n) => n > 30).length / lens.length;
    const longWords = words.filter((w) => w.split(ZWNJ).join('').length >= 9).length / words.length;
    const avgPara = paras.length ? paras.reduce((a, b) => a + b, 0) / paras.length : words.length;
    const longPara = paras.filter((n) => n > 150).length;
    let score = 100; const notes = [];
    if (avg > 18) { score -= Math.min(30, (avg - 18) * 2.5); notes.push('میانگین جمله ' + Math.round(avg) + ' واژه است؛ جمله‌ها را کوتاه‌تر کن (هدف ۱۲ تا ۱۸).'); }
    if (longSent > 0.15) { score -= Math.min(25, longSent * 60); notes.push(Math.round(longSent * 100) + '٪ جمله‌ها بیش از ۳۰ واژه‌اند.'); }
    if (longWords > 0.12) { score -= Math.min(15, longWords * 50); notes.push('واژه‌های بلند و سنگین زیاد است.'); }
    if (longPara) { score -= Math.min(15, longPara * 5); notes.push(longPara + ' پاراگراف بیش از ۱۵۰ واژه دارد؛ بشکن.'); }
    if (avg < 5) { score -= 10; notes.push('جمله‌ها بیش‌ازحد تکه‌تکه‌اند.'); }
    score = Math.max(0, Math.round(score));
    return { ok: true, score, level: score >= 80 ? 'عالی' : score >= 60 ? 'خوب' : score >= 40 ? 'متوسط' : 'ضعیف', words: words.length, sentences: sentences.length, avgSentence: +avg.toFixed(1), longSentenceRatio: +longSent.toFixed(2), avgParagraph: Math.round(avgPara), longParagraphs: longPara, notes };
  }

  /* ---------- HTML helpers ---------- */
  function htmlToText(html) {
    return String(html || '').replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote|br)>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/[ \t]+/g, ' ').replace(/ *\n[ \n]*/g, '\n').trim();
  }
  function textToCodeRatio(html) { html = String(html || ''); if (!html.length) return 0; return +(htmlToText(html).length / html.length).toFixed(3); }

  return { normalize, tokens, rawTokens, stem, isStop, keyPhrases, buildCorpus, simhash, hamming, jaccardShingles, shingles, readability, splitSentences, htmlToText, textToCodeRatio, ZWNJ };
});
