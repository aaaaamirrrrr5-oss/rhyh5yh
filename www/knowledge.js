/* Local, source-attributed RAG store. IndexedDB first; memory fallback for tests/unsupported WebViews. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SI = root.SI || {}, root.SI.Knowledge = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DB_NAME = 'site-inspector-knowledge'; const DB_VERSION = 1; const STORE = 'chunks';
  const memory = new Map();
  const SECRET = /(api[_ -]?key\s*[:=]|access[_ -]?token\s*[:=]|refresh[_ -]?token\s*[:=]|client[_ -]?secret\s*[:=]|password\s*[:=]|authorization\s*[:=]|bearer\s+[a-z0-9._-]+)/i;
  function plain(s) { return String(s || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
  function normalize(s) { return plain(s).toLowerCase().replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim(); }
  function tokens(s) { return normalize(s).split(' ').filter((x) => x.length >= 2); }
  function checksum(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
  function safeSourceUrl(value) { const raw = String(value || '').trim(); if (!raw) return ''; let u; try { u = new URL(raw); } catch (_) { throw new Error('نشانی منبع در حافظه معتبر نیست.'); } if (!['http:','https:'].includes(u.protocol) || u.username || u.password) throw new Error('نشانی منبع باید HTTP/HTTPS و بدون اطلاعات ورود باشد.'); u.search = ''; u.hash = ''; return u.href.slice(0, 1000); }
  function splitChunks(text, maxChars, overlap) {
    const s = plain(text); const max = Math.max(250, Math.min(2400, Number(maxChars || 900))); const back = Math.max(0, Math.min(400, Number(overlap == null ? 120 : overlap)));
    if (!s) return [];
    const out = []; let start = 0;
    while (start < s.length) {
      let end = Math.min(s.length, start + max);
      if (end < s.length) { const cut = Math.max(s.lastIndexOf('. ', end), s.lastIndexOf('! ', end), s.lastIndexOf('؟ ', end), s.lastIndexOf('؛ ', end), s.lastIndexOf(' ', end)); if (cut > start + max * 0.55) end = cut + 1; }
      const part = s.slice(start, end).trim(); if (part) out.push(part);
      if (end >= s.length) break; start = Math.max(start + 1, end - back);
    }
    return out;
  }
  let dbPromise = null;
  function openDb() {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(STORE)) { const st = db.createObjectStore(STORE, { keyPath: 'id' }); st.createIndex('docId', 'docId', { unique: false }); st.createIndex('scope', 'scope', { unique: false }); } };
        req.onsuccess = () => resolve(req.result); req.onerror = () => resolve(null); req.onblocked = () => resolve(null);
      } catch (_) { resolve(null); }
    });
    return dbPromise;
  }
  async function allRows() {
    const db = await openDb(); if (!db) return Array.from(memory.values());
    return new Promise((resolve) => { try { const tx = db.transaction(STORE, 'readonly'); const req = tx.objectStore(STORE).getAll(); req.onsuccess = () => resolve(req.result || []); req.onerror = () => resolve([]); } catch (_) { resolve([]); } });
  }
  async function removeDoc(docId) {
    const id = String(docId || ''); const db = await openDb();
    if (!db) { for (const [k, v] of memory.entries()) if (v.docId === id) memory.delete(k); return; }
    return new Promise((resolve) => { try { const tx = db.transaction(STORE, 'readwrite'); const idx = tx.objectStore(STORE).index('docId'); const req = idx.openCursor(IDBKeyRange.only(id)); req.onsuccess = () => { const cur = req.result; if (cur) { cur.delete(); cur.continue(); } }; tx.oncomplete = resolve; tx.onerror = resolve; } catch (_) { resolve(); } });
  }
  async function removeDocs(docIds) {
    const ids = new Set((Array.isArray(docIds) ? docIds : []).map((x) => String(x || '')).filter(Boolean));
    if (!ids.size) return 0;
    const db = await openDb();
    if (!db) { let count = 0; for (const [key, row] of memory.entries()) if (ids.has(row.docId)) { memory.delete(key); count++; } return count; }
    return new Promise((resolve) => {
      let removed = 0;
      try {
        const tx = db.transaction(STORE, 'readwrite'); const req = tx.objectStore(STORE).openCursor();
        req.onsuccess = () => { const cur = req.result; if (!cur) return; if (ids.has(cur.value.docId)) { cur.delete(); removed++; } cur.continue(); };
        tx.oncomplete = () => resolve(removed); tx.onerror = () => resolve(removed); tx.onabort = () => resolve(removed);
      } catch (_) { resolve(0); }
    });
  }
  async function writeRows(rows) {
    const db = await openDb(); if (!db) { rows.forEach((r) => memory.set(r.id, r)); return rows.length; }
    return new Promise((resolve, reject) => { try { const tx = db.transaction(STORE, 'readwrite'); const st = tx.objectStore(STORE); rows.forEach((r) => st.put(r)); tx.oncomplete = () => resolve(rows.length); tx.onerror = () => reject(new Error('ذخیرهٔ حافظهٔ محلی ناموفق بود.')); } catch (_) { reject(new Error('حافظهٔ محلی در دسترس نیست.')); } });
  }
  async function upsertDocument(input, options) {
    input = input || {}; options = options || {};
    const docId = String(input.id || input.docId || '').trim(); const content = plain(input.content || input.text || '');
    if (!docId || content.length < 20) throw new Error('شناسه و متن معتبر برای ذخیره در دانش‌نامه لازم است.');
    if (SECRET.test(content) || SECRET.test(JSON.stringify(input.metadata || {}))) throw new Error('حافظهٔ پژوهشی کلید، توکن یا رمز را نمی‌پذیرد.');
    const sourceUrl = safeSourceUrl(input.url || '');
    const scope = String(input.scope || 'site').slice(0, 80); const chunks = splitChunks(content, options.maxChars || 900, options.overlap == null ? 120 : options.overlap);
    let vectors = [];
    if (options.llm && options.llm.embeddingModel && root.SI && root.SI.LLM) {
      try { vectors = await root.SI.LLM.embed(options.llm, chunks, options.fetcher, 'search result'); } catch (e) { if (options.requireEmbeddings) throw e; }
    }
    await removeDoc(docId);
    const meta = input.metadata || {}; const rows = chunks.map((text, i) => ({
      id: docId + ':' + i, docId, chunk: i, scope, title: String(input.title || '').slice(0, 250), url: sourceUrl,
      sourceType: String(meta.sourceType || input.sourceType || 'site-content').slice(0, 60), publishedAt: String(meta.publishedAt || input.publishedAt || '').slice(0, 50), verificationMethod: String(meta.verificationMethod || '').slice(0, 120),
      fetchedAt: String(meta.fetchedAt || new Date().toISOString()).slice(0, 50), verified: !!((meta.verified || input.verified) && String(meta.verificationMethod || '').trim()), confidence: Number.isFinite(Number(meta.confidence)) ? Math.max(0, Math.min(1, Number(meta.confidence))) : 0.5,
      content: text, checksum: checksum(text), embedding: Array.isArray(vectors[i]) ? vectors[i] : null,
    }));
    await writeRows(rows); return { docId, chunks: rows.length, embedded: rows.filter((r) => r.embedding).length, checksum: checksum(content) };
  }
  async function upsertDocuments(inputs, options) {
    options = options || {}; const list = Array.isArray(inputs) ? inputs.slice(0, Math.max(1, Math.min(20000, Number(options.maxDocuments || 10000)))) : [];
    const docs = []; const allChunks = []; const docIds = []; const seenDocIds = new Set(); let skipped = 0;
    for (const inputRaw of list) {
      const input = inputRaw || {}; const docId = String(input.id || input.docId || '').trim(); const content = plain(input.content || input.text || '');
      if (!docId || seenDocIds.has(docId) || content.length < 20 || SECRET.test(content) || SECRET.test(JSON.stringify(input.metadata || {}))) { skipped++; continue; }
      seenDocIds.add(docId);
      let sourceUrl = ''; try { sourceUrl = safeSourceUrl(input.url || ''); } catch (_) { skipped++; continue; }
      const chunks = splitChunks(content, options.maxChars || 900, options.overlap == null ? 120 : options.overlap);
      if (!chunks.length) { skipped++; continue; }
      const meta = input.metadata || {}; const start = allChunks.length;
      chunks.forEach((chunk, index) => allChunks.push({ docId, chunk: index, title: String(input.title || '').slice(0, 250), url: sourceUrl, scope: String(input.scope || 'site').slice(0, 80), content: chunk, sourceType: String(meta.sourceType || input.sourceType || 'site-content').slice(0, 60), publishedAt: String(meta.publishedAt || input.publishedAt || '').slice(0, 50), fetchedAt: String(meta.fetchedAt || new Date().toISOString()).slice(0, 50), verificationMethod: String(meta.verificationMethod || '').slice(0, 120), verified: !!((meta.verified || input.verified) && String(meta.verificationMethod || '').trim()), confidence: Number.isFinite(Number(meta.confidence)) ? Math.max(0, Math.min(1, Number(meta.confidence))) : 0.5, embedding: null, checksum: checksum(chunk) }));
      docs.push({ id: docId, start, count: chunks.length, checksum: checksum(content) }); docIds.push(docId);
    }
    if (!allChunks.length) return { documents: 0, chunks: 0, embedded: 0, skipped, checksums: [] };
    let embedded = 0;
    if (options.llm && options.llm.embeddingModel && root.SI && root.SI.LLM) {
      const batchSize = Math.max(1, Math.min(64, Number(options.embeddingBatchSize || 24)));
      for (let i = 0; i < allChunks.length; i += batchSize) {
        try {
          const vectors = await root.SI.LLM.embed(options.llm, allChunks.slice(i, i + batchSize).map((x) => x.content), options.fetcher, 'search result');
          vectors.forEach((vector, j) => { if (Array.isArray(vector) && vector.length) { allChunks[i + j].embedding = vector.map(Number); embedded++; } });
        } catch (e) { if (options.requireEmbeddings) throw e; }
      }
    }
    await removeDocs(docIds);
    const rows = allChunks.map((x) => ({ id: x.docId + ':' + x.chunk, docId: x.docId, chunk: x.chunk, scope: x.scope, title: x.title, url: x.url, sourceType: x.sourceType, publishedAt: x.publishedAt, fetchedAt: x.fetchedAt, verificationMethod: x.verificationMethod, verified: x.verified, confidence: x.confidence, content: x.content, checksum: x.checksum, embedding: x.embedding }));
    await writeRows(rows);
    return { documents: docs.length, chunks: rows.length, embedded, skipped, checksums: docs.map((x) => ({ id: x.id, checksum: x.checksum })) };
  }
  function lexicalScore(query, text) {
    const q = new Set(tokens(query)); const t = new Set(tokens(text)); if (!q.size || !t.size) return 0;
    let hit = 0; q.forEach((x) => { if (t.has(x)) hit++; }); return hit / q.size;
  }
  function cosine(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || !a.length || a.length !== b.length) return null;
    let dot = 0, aa = 0, bb = 0; for (let i = 0; i < a.length; i++) { const x = Number(a[i]), y = Number(b[i]); if (!Number.isFinite(x) || !Number.isFinite(y)) return null; dot += x * y; aa += x * x; bb += y * y; }
    return aa && bb ? dot / (Math.sqrt(aa) * Math.sqrt(bb)) : null;
  }
  async function search(query, options) {
    options = options || {}; const rows = await allRows(); const scope = options.scope ? String(options.scope) : null; const filtered = rows.filter((r) => (!scope || r.scope === scope) && (!options.excludeDocId || r.docId !== String(options.excludeDocId)));
    let qv = null; if (options.llm && options.llm.embeddingModel && root.SI && root.SI.LLM && filtered.some((r) => Array.isArray(r.embedding))) { try { qv = (await root.SI.LLM.embed(options.llm, [query], options.fetcher, 'search query'))[0]; } catch (_) {} }
    const scored = filtered.map((r) => { const sem = qv && r.embedding ? cosine(qv, r.embedding) : null; const lex = lexicalScore(query, r.content); const score = sem == null ? lex : Math.max(0, (sem + 1) / 2) * 0.8 + lex * 0.2; return { id: r.docId, title: r.title, url: r.url, sourceType: r.sourceType, publishedAt: r.publishedAt, fetchedAt: r.fetchedAt, verified: r.verified, confidence: r.confidence, chunk: r.chunk, content: r.content, score: Number(score.toFixed(4)), method: sem == null ? 'lexical-fallback' : 'embedding+lexical' }; });
    return scored.filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(20, Number(options.limit || 6))));
  }
  async function semanticCompare(source, candidates, options) {
    options = options || {}; const rows = (Array.isArray(candidates) ? candidates : []).filter((x) => x && String(x.text || '').trim()).slice(0, 12);
    if (!rows.length) return [];
    if (options.llm && options.llm.embeddingModel && root.SI && root.SI.LLM) {
      try { return await root.SI.LLM.compareSimilarity(options.llm, source, rows, options.fetcher); } catch (e) { if (options.requireEmbeddings) throw e; }
    }
    return rows.map((x) => ({ id: x.id || null, title: String(x.title || ''), url: String(x.url || ''), score: Math.round(lexicalScore(source, x.text) * 100), method: 'lexical-fallback' })).sort((a, b) => b.score - a.score);
  }
  async function clear(scope) {
    const rows = await allRows(); const targets = rows.filter((r) => !scope || r.scope === scope); const db = await openDb();
    if (!db) { targets.forEach((r) => memory.delete(r.id)); return targets.length; }
    await Promise.all([...new Set(targets.map((r) => r.docId))].map(removeDoc)); return targets.length;
  }
  return { plain, normalize, splitChunks, upsertDocument, upsertDocuments, removeDocs, search, semanticCompare, clear, cosine, lexicalScore, safeSourceUrl, _allRows: allRows };
});
