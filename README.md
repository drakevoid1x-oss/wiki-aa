# ويكي

## التشغيل
```
node server.js
```
وافتح http://localhost:3000 (بدون npm install، السيرفر ما يحتاج مكتبات).

## الرفع على استضافة
- اختار استضافة تدعم Node.js (Render, Railway, Hostinger Node, cPanel Node App ...).
- ارفع المجلد كله، ملف التشغيل `server.js`، والأمر `npm start`.
- السيرفر يقرأ المنفذ من متغير `PORT` تلقائياً.
- الرسائل والحسابات تنحفظ بملف `data.json` (تأكد الاستضافة تحفظ الملفات، أو حدد مسار ثابت بمتغير `DATA_FILE`).
- شغله خلف HTTPS حتى يشتغل التطبيق بأمان.

## الهيكل
- `server.js` السيرفر والـ API
- `public/index.html` الواجهة
- `public/style.css` التصميم
- `public/app.js` منطق التطبيق
