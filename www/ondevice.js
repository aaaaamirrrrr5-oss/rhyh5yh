/* Site Inspector fully on-device AI bridge. Model files are downloaded on demand and run inside Android. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else { root.SI = root.SI || {}; root.SI.OnDeviceAI = factory(root); }
})(typeof self !== 'undefined' ? self : globalThis, function (runtime) {
  'use strict';
  const MODELS = Object.freeze({
    'gemma4-e4b': { id: 'gemma4-e4b', name: 'Gemma 4 E4B · بیشترین کیفیت', description: 'قوی‌ترین مدل متنی این مجموعه برای گوشی‌های پرچم‌دار؛ نیازمند حافظه و فضای زیاد.', file: 'gemma-4-E4B-it.litertlm', repo: 'litert-community/gemma-4-E4B-it-litert-lm', sizeBytes: 3659530240, minBytes: 3659530240, displaySize: '۳٫۶۶ گیگابایت', ramRecommended: 12, minRam: 8, minAvailableRam: 6, sha256: '0b2a8980ce155fd97673d8e820b4d29d9c7d99b8fa6806f425d969b145bd52e0', revision: '28299f30ee4d43294517a4ac93abd6163412f07f', url: 'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/28299f30ee4d43294517a4ac93abd6163412f07f/gemma-4-E4B-it.litertlm', license: 'Apache-2.0', quality: 'high' },
    'gemma4-e2b': { id: 'gemma4-e2b', name: 'Gemma 4 E2B · متعادل', description: 'تعادل بهتر میان کیفیت، سرعت و حافظه برای بسیاری از گوشی‌های جدید.', file: 'gemma-4-E2B-it.litertlm', repo: 'litert-community/gemma-4-E2B-it-litert-lm', sizeBytes: 2588147712, minBytes: 2588147712, displaySize: '۲٫۵۹ گیگابایت', ramRecommended: 8, minRam: 6, minAvailableRam: 4, sha256: '181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c', revision: '6e5c4f1e395deb959c494953478fa5cec4b8008f', url: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/6e5c4f1e395deb959c494953478fa5cec4b8008f/gemma-4-E2B-it.litertlm', license: 'Apache-2.0', quality: 'balanced' },
    'qwen3-0.6b': { id: 'qwen3-0.6b', name: 'Qwen3 0.6B INT4 · کم‌حجم', description: 'گزینهٔ سبک برای گوشی‌های کم‌حافظه؛ کیفیت و توان استدلال آن پایین‌تر از Gemma 4 است.', file: 'Qwen3-0.6B_dynamic_wi4b32_afp32.litertlm', repo: 'litert-community/Qwen3-0.6B', sizeBytes: 343490560, minBytes: 343490560, displaySize: 'حدود ۳۴۳ مگابایت', ramRecommended: 6, minRam: 3, minAvailableRam: 2, sha256: 'bf1aba9ce8d963124407353c6aa4cbf72eba78db21ae133de983eac672ce83e0', revision: '2670e142a0d16a1b685be6604e5b4f2b31a826d7', url: 'https://huggingface.co/litert-community/Qwen3-0.6B/resolve/2670e142a0d16a1b685be6604e5b4f2b31a826d7/Qwen3-0.6B_dynamic_wi4b32_afp32.litertlm', license: 'Apache-2.0', quality: 'compact' }
  });
  const EMBEDDING = Object.freeze({ id: 'embeddinggemma-270m', name: 'EmbeddingGemma 2 · جستجوی معنایی', file: 'embeddinggemma-2-text-270m.litertlm', repo: 'litert-community/embeddinggemma-2-text-270m-litert-lm', sizeBytes: 164626432, minBytes: 164626432, displaySize: 'حدود ۱۶۵ مگابایت', sha256: '2d079ee2f6f066b1f368e8d7c819f55214eaef1d0513b312321901f30ab286fb', revision: '8c9f652b5233a80313d5c848f3656e492cf0397f', url: 'https://huggingface.co/litert-community/embeddinggemma-2-text-270m-litert-lm/resolve/8c9f652b5233a80313d5c848f3656e492cf0397f/embeddinggemma-2-text-270m.litertlm', license: 'Apache-2.0' });
  /** Errors that mean "this phone cannot run the language model right now"; callers fall back to the rule-based engine instead of failing. */
  const fb = (m) => Object.assign(new Error(m), { code: 'SI_FALLBACK_RULES' });
  function isFallbackError(e) { return !!(e && e.code === 'SI_FALLBACK_RULES'); }
  function plugin() {
    try {
      const cap = runtime && runtime.Capacitor;
      if (!cap || (typeof cap.isNativePlatform === 'function' && !cap.isNativePlatform())) return null;
      return cap.Plugins && cap.Plugins.SIOnDeviceAI ? cap.Plugins.SIOnDeviceAI : null;
    } catch (_) { return null; }
  }
  function isAvailable() { const p = plugin(); return !!(p && typeof p.getStatus === 'function' && typeof p.generate === 'function'); }
  function modelFitsDevice(id, device) {
    const d = device || {}; const spec = MODELS[id];
    if (!spec) return false;
    const total = Number(d.totalRamBytes || (Number(d.totalRam || 0) * 1024 ** 3));
    const available = Number(d.availableRamBytes || 0);
    // Automatic selection is conservative: never guess a model if Android did not provide memory telemetry.
    if (d.lowMemory === true || !Number.isFinite(total) || !Number.isFinite(available) || total <= 0 || available <= 0) return false;
    if (total < spec.minRam * 1024 ** 3) return false;
    if (available < spec.minAvailableRam * 1024 ** 3) return false;
    return true;
  }
  function recommend(device) {
    const d = device || {};
    for (const id of ['gemma4-e4b', 'gemma4-e2b', 'qwen3-0.6b']) if (modelFitsDevice(id, d)) return id;
    return null;
  }
  /** Which quality tier this phone can sustain right now. 'rules' needs no model and no RAM, so the assistant never dead-ends. */
  function tier(device) {
    const d = device || {}; const id = recommend(d);
    if (id === 'gemma4-e4b') return { tier: 'high', model: id, label: 'کامل · Gemma 4 E4B' };
    if (id === 'gemma4-e2b') return { tier: 'balanced', model: id, label: 'متعادل · Gemma 4 E2B' };
    if (id === 'qwen3-0.6b') return { tier: 'light', model: id, label: 'سبک · Qwen3 0.6B' };
    const total = Number(d.totalRamBytes || 0) / 1024 ** 3;
    const reason = d.lowMemory === true ? 'گوشی در حال حاضر حافظهٔ کم دارد' : !total ? 'اطلاعات RAM دستگاه در دسترس نیست' : total < 3 ? 'RAM کل گوشی کمتر از ۳ گیگابایت است' : 'RAM آزاد فعلی برای مدل کافی نیست';
    return { tier: 'rules', model: null, label: 'سبک خودکار · بدون مدل زبانی', reason };
  }
  /** Best installed, SHA-verified model that fits the phone's current memory; null means use the rule-based engine. */
  function usableModel(status) {
    const st = status || {}; const ok = new Set((st.models || []).filter((x) => x.installed && x.verified === true).map((x) => x.modelId));
    for (const id of ['gemma4-e4b', 'gemma4-e2b', 'qwen3-0.6b']) if (ok.has(id) && modelFitsDevice(id, st.device || {})) return id;
    return null;
  }
  async function getStatus() {
    const p = plugin();
    if (!p) throw fb('موتور هوش مصنوعی روی دستگاه در این محیط در دسترس نیست؛ اپ اندروید را نصب و اجرا کن.');
    return p.getStatus();
  }
  async function chooseModel(modelId, status) {
    const st = status || await getStatus();
    if (modelId && modelId !== 'auto') return modelId;
    const installed = new Set((st.models || []).filter((x) => x.installed && x.verified === true).map((x) => x.modelId));
    const rank = ['gemma4-e4b', 'gemma4-e2b', 'qwen3-0.6b'];
    for (const id of rank) if (installed.has(id) && modelFitsDevice(id, st.device || {})) return id;
    const fallback = recommend(st.device || {});
    if (!fallback) throw fb('حافظه RAM آزاد این دستگاه برای هیچ‌یک از مدل‌های فهرست‌شده کافی نیست. برنامه‌های دیگر را ببند یا از دستگاه سازگارتر استفاده کن.');
    return fallback;
  }
  async function downloadModel(modelId, options) {
    const p = plugin();
    if (!p || typeof p.downloadModel !== 'function') throw new Error('دانلود مدل فقط در نسخهٔ نصب‌شدهٔ اندروید پشتیبانی می‌شود.');
    const status = await getStatus();
    const id = modelId === 'auto' ? recommend(status.device || {}) : modelId;
    if (!id) throw new Error('هیچ مدل زبانی با RAM آزاد فعلی دستگاه سازگار نیست.');
    if (!MODELS[id] && id !== EMBEDDING.id) throw new Error('مدل انتخاب‌شده در فهرست امن مدل‌ها نیست.');
    const spec = id === EMBEDDING.id ? EMBEDDING : MODELS[id];
    const device = status.device || {};
    const free = Number(device.freeBytes || 0);
    if (id === EMBEDDING.id) {
      if (device.lowMemory === true || Number(device.totalRamBytes || 0) < 2 * 1024 ** 3 || Number(device.availableRamBytes || 0) < 1 * 1024 ** 3) throw new Error('گوشی در حال حاضر حداقل RAM لازم برای مدل جستجوی معنایی را ندارد.');
    } else if (!modelFitsDevice(id, device)) {
      throw new Error('مدل انتخاب‌شده با RAM کل و آزاد فعلی گوشی سازگار نیست؛ مدل متناسب را انتخاب کن.');
    }
    if (free && free < Number(spec.sizeBytes || 0) * 1.15) throw new Error('فضای آزاد کافی نیست؛ حداقل ۱۵٪ فضای اضافه برای دانلود و فایل‌های موقت لازم است.');
    const mirror = normalizeMirror(options && options.mirror);
    return p.downloadModel({ modelId: id, allowMobileData: !!(options && options.allowMobileData), mirror });
  }
  /** Optional download mirror (useful where huggingface.co is unreachable). Only https; the file is still SHA-256 verified, so a mirror cannot swap the model. */
  function normalizeMirror(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    let u; try { u = new URL(raw); } catch (_) { throw new Error('آدرس آینهٔ دانلود معتبر نیست؛ نمونه: https://hf-mirror.com'); }
    if (u.protocol !== 'https:') throw new Error('آدرس آینه باید با https شروع شود.');
    if (u.username || u.password || u.search || u.hash) throw new Error('آدرس آینه نباید نام کاربری، پارامتر یا # داشته باشد.');
    return (u.origin + u.pathname).replace(/\/+$/, '');
  }
  /** Import a model file the user already has (Telegram, Bluetooth, USB, SD card). The app copies it and verifies size + SHA-256 before it can run. */
  async function importModel(modelId) {
    const p = plugin();
    if (!p || typeof p.importModel !== 'function') throw new Error('وارد کردن فایل مدل فقط در نسخهٔ اندروید (نسخهٔ ۱.۱۷ به بعد) پشتیبانی می‌شود.');
    const id = String(modelId || '');
    if (!MODELS[id] && id !== EMBEDDING.id) throw new Error('مدل انتخاب‌شده در فهرست امن مدل‌ها نیست.');
    return p.importModel({ modelId: id });
  }
  async function cancelDownload(modelId) {
    const p = plugin(); if (!p || !p.cancelDownload) throw new Error('مدیریت دانلود در این دستگاه در دسترس نیست.');
    return p.cancelDownload({ modelId });
  }
  async function loadModel(modelId) {
    const p = plugin(); if (!p || !p.loadModel) throw new Error('موتور اجرای مدل در این دستگاه در دسترس نیست.');
    const st = await getStatus(); const id = await chooseModel(modelId || 'auto', st);
    if (!MODELS[id]) throw new Error('مدل تولید متن معتبر نیست.');
    const spec = MODELS[id];
    const ram = Number(st.device && st.device.totalRamBytes || 0);
    const available = Number(st.device && st.device.availableRamBytes || 0);
    if ((ram && ram < spec.minRam * 1024 ** 3) || (st.device && st.device.lowMemory) || (available && available < spec.minAvailableRam * 1024 ** 3)) throw new Error('RAM آزاد این گوشی برای اجرای پایدار این مدل کافی نیست؛ برنامه‌های دیگر را ببند یا مدل سبک‌تر را انتخاب کن.');
    const row = (st.models || []).find((x) => x.modelId === id);
    if (!row || !row.installed || row.verified !== true) throw new Error('مدل پیشنهادی هنوز دانلود و اعتبارسنجی SHA-256 نشده است؛ ابتدا دانلود و بررسی سلامت آن را کامل کن.');
    return p.loadModel({ modelId: id });
  }
  async function unloadModel() {
    const p = plugin(); if (!p || !p.unloadModel) return { ok: true };
    return p.unloadModel();
  }
  async function deleteModel(modelId) {
    const p = plugin(); if (!p || !p.deleteModel) throw new Error('حذف مدل در این دستگاه در دسترس نیست.');
    return p.deleteModel({ modelId });
  }
  async function generate(prompt, options) {
    const p = plugin(); if (!p || !p.generate) throw fb('موتور مدل روی دستگاه در دسترس نیست.');
    const opts = options || {};
    let modelId = String(opts.modelId || 'auto');
    if (modelId === 'auto') {
      const st = opts.status || await getStatus();
      modelId = await chooseModel('auto', st);
    }
    if (!MODELS[modelId]) throw fb('هیچ مدل زبانی مناسب RAM این گوشی انتخاب/دانلود نشده است.');
    const state = opts.status || await getStatus();
    if (!modelFitsDevice(modelId, state.device || {})) throw fb('مدل انتخاب‌شده با RAM آزاد فعلی گوشی برای اجرای پایدار سازگار نیست.');
    const installed = (state.models || []).some((x) => x.modelId === modelId && x.installed && x.verified === true);
    if (!installed) throw fb('مدل ' + (MODELS[modelId].name || modelId) + ' روی گوشی دانلود و با SHA-256 تأیید نشده است. از تنظیمات، دانلود و اعتبارسنجی مدل را کامل کن.');
    let result;
    try { result = await p.generate({ modelId, prompt: String(prompt || '').slice(0, 42000), maxTokens: Math.max(128, Math.min(4096, Number(opts.maxTokens || 2048))), thinking: opts.thinking !== false && modelId !== 'qwen3-0.6b' }); }
    catch (nativeError) { throw fb('اجرای مدل روی این گوشی ناموفق بود: ' + String(nativeError && nativeError.message || nativeError).slice(0, 140)); }
    if (!result || !String(result.text || '').trim()) throw fb('مدل روی گوشی پاسخ متنی تولید نکرد.');
    return Object.assign({}, result, { modelName: MODELS[modelId].name, protocol: 'litert-on-device' });
  }
  async function embed(texts, taskType) {
    const p = plugin(); if (!p || !p.embed) throw new Error('مدل embedding روی گوشی در دسترس نیست.');
    const rows = (Array.isArray(texts) ? texts : [texts]).map((x) => String(x || '').trim()).filter(Boolean).slice(0, 24);
    if (!rows.length) return [];
    const status = await getStatus();
    const device = status.device || {};
    const totalRam = Number(device.totalRamBytes || 0);
    const availableRam = Number(device.availableRamBytes || 0);
    if (device.lowMemory === true || totalRam < 2 * 1024 ** 3 || availableRam < 1 * 1024 ** 3) throw new Error('حافظهٔ RAM آزاد این گوشی برای اجرای مدل جستجوی معنایی کافی نیست.');
    if (!(status.embedding && status.embedding.installed && status.embedding.verified === true)) throw new Error('ابتدا مدل EmbeddingGemma را دانلود و اعتبارسنجی SHA-256 آن را کامل کن.');
    const validTasks = new Set(['search result', 'search query', 'sentence similarity', 'classification', 'clustering']);
    const task = validTasks.has(String(taskType || 'search query')) ? String(taskType || 'search query') : 'search query';
    const result = await p.embed({ modelId: EMBEDDING.id, texts: rows, taskType: task });
    if (!result || !Array.isArray(result.vectors) || result.vectors.length !== rows.length) throw new Error('خروجی مدل embedding ناقص است.');
    return result.vectors.map((v) => Array.isArray(v) ? v.map(Number) : []);
  }
  return { models: MODELS, embedding: EMBEDDING, plugin, isAvailable, isFallbackError, tier, usableModel, modelFitsDevice, recommend, chooseModel, getStatus, downloadModel, normalizeMirror, importModel, cancelDownload, loadModel, unloadModel, deleteModel, generate, embed };
});
