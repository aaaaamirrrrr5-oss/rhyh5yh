# فیلدهای تکمیلی سئو (نسخهٔ ۱.۴۴) — نیاز به Bridge

`seoextra.js` فقط **طرح** می‌سازد و خودش چیزی نمی‌نویسد. برای اعمال، `/agent/save` در Bridge باید این فیلدها را بپذیرد (در صورت نبود، رد شوند، نه نادیده گرفته شوند):

| فیلد | سطح | توضیح |
|---|---|---|
| `image_alt[{image_id,alt}]` | auto (فقط alt خالی) | متا `_wp_attachment_image_alt` |
| `og_title`, `og_description` | auto (فقط خالی) | متای Yoast/RankMath؛ بسته به افزونهٔ سئو |
| `slug` | review | **همراه با ثبت تغییرمسیر ۳۰۱ از آدرس قدیمی**؛ بدون redirect ذخیره نشود |
| `schema_jsonld` | review | اعتبارسنجی JSON، حذف تکراری با خروجی Yoast/Woo، و escape با `wp_json_encode` |
| `term_seo{term_id,seo_title,meta_description}` | auto (فقط خالی) | برای `product_cat` و `product_tag` |

قوانین: revision-check و journal مثل بقیهٔ ذخیره‌ها؛ هر فیلد قابل rollback؛ اگر `capabilities.extra_fields` نبود، اپ این طرح‌ها را فقط نمایش/خروجی می‌دهد.
