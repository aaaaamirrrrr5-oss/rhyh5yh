# مدل‌ها، منابع و مجوزها

این پرونده برای شفافیت دانلود مدل‌ها و نگهداری منبع artifactها است. قبل از انتشار عمومی یا توزیع تجاری، متن کامل مجوز هر نسخه را از مخزن اصلی همان مدل دوباره بررسی کن.

| مدل | مخزن | مجوز اعلام‌شده | استفاده |
|---|---|---|---|
| Gemma 4 E4B LiteRT | `litert-community/gemma-4-E4B-it-litert-lm` | Apache-2.0 در metadata نسخهٔ انتخاب‌شده | تولید و تحلیل متن |
| Gemma 4 E2B LiteRT | `litert-community/gemma-4-E2B-it-litert-lm` | Apache-2.0 در metadata نسخهٔ انتخاب‌شده | تولید و تحلیل متن |
| Qwen3 0.6B INT4 LiteRT | `litert-community/Qwen3-0.6B` | Apache-2.0 در metadata نسخهٔ انتخاب‌شده | مدل سبک جایگزین |
| EmbeddingGemma 270M LiteRT | `litert-community/embeddinggemma-2-text-270m-litert-lm` | Apache-2.0 در metadata نسخهٔ انتخاب‌شده | embedding و جستجوی معنایی |

## نکات توزیع

- فایل‌های مدل داخل APK قرار ندارند.
- مدل‌ها از artifactهای revision-pinned دانلود می‌شوند.
- پیش از بارگذاری، اندازه و SHA-256 بررسی می‌شود.
- فایل مدل را در APK یا مخزن سورس کپی نکن.
- هنگام توزیع مدل، متن مجوز و noticeهای لازم را از مخزن اصلی همان revision رعایت کن.
