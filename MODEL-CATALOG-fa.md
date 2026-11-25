# فهرست مدل‌های محلی Site Inspector

مدل‌ها با URLهای revision-pinned دریافت و قبل از اجرا با اندازه و SHA-256 بررسی می‌شوند.

| شناسه | فایل | اندازه دقیق (byte) | RAM کل حداقل | RAM آزاد حداقل | SHA-256 |
|---|---|---:|---:|---:|---|
| gemma4-e4b | `gemma-4-E4B-it.litertlm` | 3659530240 | 8 GB | 6 GB | `0b2a8980ce155fd97673d8e820b4d29d9c7d99b8fa6806f425d969b145bd52e0` |
| gemma4-e2b | `gemma-4-E2B-it.litertlm` | 2588147712 | 6 GB | 4 GB | `181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c` |
| qwen3-0.6b | `Qwen3-0.6B_dynamic_wi4b32_afp32.litertlm` | 343490560 | 3 GB | 2 GB | `bf1aba9ce8d963124407353c6aa4cbf72eba78db21ae133de983eac672ce83e0` |
| embeddinggemma-270m | `embeddinggemma-2-text-270m.litertlm` | 164626432 | 2 GB | 1 GB | `2d079ee2f6f066b1f368e8d7c819f55214eaef1d0513b312321901f30ab286fb` |

آستانه‌های RAM، حداقل محافظه‌کارانهٔ پیاده‌سازی هستند؛ تضمین اجرا برای همهٔ گوشی‌ها نیستند. Android `lowMemory` یا telemetry ناقص، انتخاب خودکار را متوقف می‌کند.

## منبع مدل‌ها

- Gemma 4 E4B: `https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/28299f30ee4d43294517a4ac93abd6163412f07f/gemma-4-E4B-it.litertlm`
- Gemma 4 E2B: `https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/6e5c4f1e395deb959c494953478fa5cec4b8008f/gemma-4-E2B-it.litertlm`
- Qwen3 0.6B: `https://huggingface.co/litert-community/Qwen3-0.6B/resolve/2670e142a0d16a1b685be6604e5b4f2b31a826d7/Qwen3-0.6B_dynamic_wi4b32_afp32.litertlm`
- EmbeddingGemma: `https://huggingface.co/litert-community/embeddinggemma-2-text-270m-litert-lm/resolve/8c9f652b5233a80313d5c848f3656e492cf0397f/embeddinggemma-2-text-270m.litertlm`

مدل‌ها با APK توزیع نمی‌شوند. کاربر آن‌ها را از داخل اپ دانلود می‌کند. مجوز و notice کامل هر revision را پیش از توزیع عمومی دوباره در مخزن رسمی بررسی کن.
