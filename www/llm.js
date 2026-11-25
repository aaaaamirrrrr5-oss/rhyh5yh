/* Site Inspector local-only model gateway. Generation and embeddings run in Android LiteRT. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(globalThis);
  else root.SI = root.SI || {}, root.SI.LLM = factory(root);
})(typeof self !== 'undefined' ? self : globalThis, function (runtime) {
  'use strict';
  const MAX_TEXT = 24000;
  function localEngine() {
    const engine = runtime && runtime.SI && runtime.SI.OnDeviceAI;
    if (!engine || typeof engine.generate !== 'function' || typeof engine.embed !== 'function') {
      throw new Error('موتور هوش مصنوعی داخلی در دسترس نیست؛ نسخهٔ APK اندروید را نصب و مدل را از تنظیمات یک‌بار دانلود کن.');
    }
    return engine;
  }
  function normalizeMessages(messages) {
    return (Array.isArray(messages) ? messages : []).slice(-16).map((m) => ({
      role: ['system', 'assistant'].includes(m.role) ? m.role : 'user',
      content: String(m.content || '').slice(0, MAX_TEXT),
    }));
  }
  async function health(config) {
    config = config || {};
    if (config.provider === 'builtin') return { ok: true, protocol: 'rules-only', models: [], count: 0 };
    if (config.provider !== 'device-local') throw new Error('Site Inspector فقط از مدل داخلی روی دستگاه استفاده می‌کند؛ سرویس مدل خارجی پشتیبانی نمی‌شود.');
    return localEngine().getStatus();
  }
  async function chat(config, messages, options) {
    config = config || {}; options = options || {};
    if (config.provider !== 'device-local') throw new Error('تولید متن هوشمند فقط با مدل دانلودشده روی همین دستگاه انجام می‌شود.');
    const rows = normalizeMessages(messages);
    const prompt = rows.map((m) => (m.role === 'system' ? 'دستور سیستم: ' : m.role === 'assistant' ? 'دستیار: ' : 'کاربر: ') + m.content).join('\n\n');
    const out = await localEngine().generate(prompt, {
      modelId: config.model || 'auto',
      maxTokens: Math.max(128, Math.min(4096, Number(options.maxTokens || 2048))),
      thinking: options.thinking !== false,
    });
    return { content: String(out.text || ''), model: out.modelName || out.modelId || config.model || 'مدل روی دستگاه', done: true, protocol: 'litert-on-device' };
  }
  async function embed(config, texts, _fetcher, taskType) {
    config = config || {};
    if (config.provider !== 'device-local') throw new Error('Embedding فقط با مدل داخلی EmbeddingGemma روی دستگاه انجام می‌شود.');
    const input = (Array.isArray(texts) ? texts : [texts]).map((x) => String(x || '').trim().slice(0, 8000)).filter(Boolean).slice(0, 24);
    if (!input.length) return [];
    return localEngine().embed(input, taskType || 'search query');
  }
  function cosine(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || !a.length || a.length !== b.length) return null;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      const x = Number(a[i]), y = Number(b[i]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      dot += x * y; na += x * x; nb += y * y;
    }
    return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : null;
  }
  async function compareSimilarity(config, source, candidates) {
    const rows = (Array.isArray(candidates) ? candidates : []).filter((x) => x && String(x.text || '').trim()).slice(0, 12);
    if (!rows.length) return [];
    const vectors = await embed(config, [String(source || '').slice(0, 8000)].concat(rows.map((x) => String(x.text).slice(0, 8000))), null, 'sentence similarity');
    return rows.map((row, i) => ({
      id: row.id || null, title: String(row.title || ''), url: String(row.url || ''),
      score: Math.max(0, Math.min(100, Math.round((cosine(vectors[0], vectors[i + 1]) || 0) * 100))),
      method: 'embeddinggemma-cosine-on-device',
    })).sort((a, b) => b.score - a.score);
  }
  return { health, chat, embed, cosine, compareSimilarity, normalizeMessages };
});
