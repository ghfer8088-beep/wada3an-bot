# Project Audit — فحص وتقييم شامل للبنية الحالية
**مشروع:** وداعاً للألم (`30minutes30`) | منصة إدارة وتنمية صفحة فيسبوك ونظام النمو الذكي
**التاريخ:** 2026-09-29
**الفرع الحالي:** `main`

---

## 1. Current Architecture (البنية الحالية للمشروع)

يعمل المشروع حالياً كنظام متعدد الأجزاء يخدم عيادة/مركز **وداعاً للألم** (30minutes30) في عمّان (خلدا) ومحافظة الزرقاء، ويتكون من:

1. **الخادم الخلفي (Backend Server):**
   - ملف رئيسي: `server.js` (تطور عن `facebook_server.js`).
   - يعتمد على مكتبتي `express` و `body-parser` المذكورتين في `package.json` مع اعتماده على وحدة `https` المدمجة في Node.js.
   - يوفر Webhook لـ Meta Graph API (`/webhook` GET للتحقق و POST لاستقبال الأحداث).
   - يخزن المحادثات والمراجعين في الذاكرة الحية فقط (`userState` و `capturedLeads` في Array/Map مؤقتة تزول عند إعادة التشغيل).
   - يقدم ملفات ثابتة وواجهات ويب متعددة (`express.static(__dirname)`).
   - يوفر API بسيط لجلب منشورات الصفحة (`/api/page-posts`) ومعلومات المركز (`/api/page-info`).
   - يدير جلسات "Mission Control" عبر الذاكرة (`mcSession`) للتنسيق مع Bookmarklet متصفح.

2. **الواجهات الأمامية (Frontend Dashboards & Portals):**
   - `viral_hub.html` (125KB / 2136 سطر): واجهة الـ Hub الحالية، تتضمن 7 أقسام (خلية التفاعل Pod، مولد المنشورات الفيروسية، مصمم الإنفوجرافيك، استوديو الريلز، فاحص ما قبل النشر Pre-Flight، جدول المحتوى، دليل الخوارزمية).
   - `smart_check_hub.html`, `spine_age_calculator.html`, `tool_runner.html`: بوابات أدوات التشخيص السريرية (حاسبة عمر العمود الفقري، فاحص الأبهر، فاحص عرق النسا، وغيرها) وتعمل كمصائد لجذب المراجعين (Lead Magnets).
   - `royal_patients.html`: بوابة المراجعين الملكية، استخراج الأرقام وتصدير جهات الاتصال وإطلاق حملات WhatsApp.
   - `index.html`: محاكي ماسنجر وشات بوت مع فاحص الأرشيف.

3. **قاعدة البيانات والتخزين:**
   - تخزين محلي بالكامل في المتصفح عبر `localStorage` (مثل `vh_accs`, `vh_ses`, `vh_posts`).
   - لا توجد قاعدة بيانات دائمة مهيكلة (Persistent Relational Database) لحفظ المنشورات، Snapshots التوزيع، التجارب المخبرية، أو خوارزمية DNA.

---

## 2. Existing Features (الميزات والوظائف الموجودة حالياً)

- **تكامل الـ Webhook مع Meta:** استقبال رسائل ماسنجر وتحليل الشكوى السريرية والرد التلقائي عليها فيسبوكياً.
- **استدعاء المنشورات عبر Meta Graph API:** قراءة قائمة المنشورات بالـ `access_token` الخاص بالصفحة.
- **توليد المنشورات والريلز القائم على القوالب النفسية:** نصوص جاهزة معتمدة على مبادئ الإقناع الطبي والكايروبراكتيك.
- **مصمم إنفوجرافيك Canvas:** توليد بوسترات مقارنة (خرافة ❌ مقابل حقيقة ✅) وتصديرها كصورة بدقة 1080x1520.
- **محرك فحص ما قبل النشر (Pre-Flight):** كشف كلمات تقليل الوصول وحساب درجة توافق أولية.
- **أداة المساعد المتصفحي (Bookmarklet & Mission Control):** تمرير تعليقات لحسابات حقيقية للمساعدة في النشر اليدوي المنضبط.

---

## 3. Missing Features (الوظائف المفقودة المطلوب بناؤها)

وفق متطلبات نظام الـ Growth & Content Intelligence:
1. **قاعدة بيانات مهيكلة دائمة:** غير موجودة حالياً. نحتاج قاعدة بيانات سريعة ومتينة مدمجة ومستقلة (SQLite عبر `node:sqlite` المدمج في Node v24 أو SQLite engine موثوق) لحفظ المنشورات، الـ Snapshots، الـ DNA، التجارب، والتفاعل.
2. **Algorithm Research Engine:** غياب رصد السرعة اللحظية لتوزيع المحتوى (Distribution Velocity عند 15 دقيقة، 30 دقيقة، ساعة، 3 ساعات، إلخ).
3. **Expansion Detector:** عدم وجود محرك تحليلي يرصد انتقال المنشور بين الحالات (INITIAL TEST, WAITING, GROWING, EXPANDING, COOLING, SATURATED).
4. **Page Algorithm DNA:** عدم وجود منظومة استنتاج إحصائي مبنية على ثقة (Confidence Score) لتحديد أفضل (Hooks, Topics, Formats, Times).
5. **Experiment Lab (مختبر التجارب):** غياب نظام التجارب المعزولة (عزل المتغيرات، الفرضية، الشاهد، المتحور، حجم العينة، الاستنتاج).
6. **Audience Expansion Funnel:** غياب قياس تحويل غير المتابعين (Followers Reach vs Non-Follower Reach → Page Visits → New Followers).
7. **Content Recycler (Resurrection Engine):** غياب محرك تصنيف المحتوى التاريخي (Evergreen, Needs Update, Expired, High Potential).
8. **Comment Miner & Trend Radar:** غياب محرك تحليل تعليقات الجمهور لاكتشاف الأسئلة المتكررة والفجوات المعرفية.
9. **Fire Mode Workflow:** غياب سير عمل الـ 15 خطوة للضغط على زر "🔥 FIRE THE PAGE" مع مؤشرات حالة حية لكل خطوة.
10. **Human Amplification Panel:** تحويل نظام الـ Pod الحالي إلى لوحة إشعارات نظامية وامتثالية 100% بدون أي محاكاة تفاعل وهمي.

---

## 4. Problems & Technical Debt (المشاكل الحالية والديون التقنية)

1. **الاعتماد على localStorage بالكامل في واجهة الـ Hub:** أي مسح للبيانات من المتصفح يمحو الحسابات والسجلات.
2. **عدم وجود طبقة Backend Services معيارية:** المنطق البرمجي مبعثر بين سكربتات مضمنة في HTML وخادم `server.js` وحيد.
3. **غياب إدارة التوكن والأخطاء المعيارية:** التوكن معرّف بشكل صلب في كود `server.js` دون نظام فحص الصلاحيات وسلامة الاتصال بـ Meta Graph API.
4. **البيانات الاستاتيكية والافتراضات غير المثبتة:** بعض شاشات Hub الحالية تعرض أرقاماً ثابتة أو افتراضات عامة (مثل "فيسبوك يعرض لـ 2-5% فقط") وهو ما يتعارض مباشرة مع مبدأ النظام التجريبي القائم على البيانات الفعلية.

---

## 5. Dependencies (الاعتماديات الحالية والمتاحة)

- **بيئة التشغيل:** Node.js v24.20.0 (متوفرة وتعمل محلياً عبر `node.cmd` و `agy-node`).
- **المكتبات المدمجة الجاهزة فورياً:** `node:sqlite` (SQLite عالي الأداء لا يحتاج تنصيب خارجي)، `node:fs`, `node:path`, `node:https`, `node:crypto`.
- **حزم Node.js الخارجية:** `express`, `body-parser`.
- **الأجهزة والمتصفحات:** يدعم كافة المتصفحات الحديثة، يدعم RTL واللغة العربية، ويدعم الشاشات المكتبية والجوال.

---

## 6. Risk Areas (مناطق الخطورة والتحذيرات)

1. **تحديثات وقيود Meta Graph API:** التغيرات في واجهات Meta (v19.0 / v20.0 / v21.0) وتطلب بعض المقاييس لصلاحيات معينة (مثل `read_insights`, `pages_read_engagement`).
   - *الإجراء الوقائي:* فحص نوع الصلاحية لكل طلب، وفي حال عدم توفر المقياس يظهر النظام رسالة صريحة "Not available through current Meta API" دون اختراع بيانات وهمية.
2. **سلامة الحسابات ومكافحة التفاعل المصطنع:** منع أي إجراء يشبه البوتات أو النشر الآلي الجماعي عبر الحسابات الـ 12 لتجنب حظر فيسبوك أو عقوبات الخوارزمية.
   - *الإجراء الوقائي:* جعل الـ Human Amplification Panel إشعارات تطوعية فقط مع تتبع القراءة والنقر يدوياً.
3. **الحفاظ التام على الكود الموجود وعدم كسر الملفات الحالية:**
   - *الإجراء الوقائي:* عدم حذف أو إعادة بناء ملفات العيادة من الصفر (`royal_patients.html`, `smart_check_hub.html`, etc.)، وربط النظام الجديد كطبقة متقدمة ومتكاملة فوق الأساس الحالي.

---

## 7. Recommended Architecture (البنية المعمارية الموصى بها)

تطوير البنية الحالية إلى نمط **Modular Intelligence Engine Architecture**:
```
wada3an_bot/
├── data/
│   └── growth_intelligence.db    <-- SQLite Persistent Database (node:sqlite)
├── src/
│   ├── config/                    <-- System Config, Meta Credentials & Permissions
│   ├── db/                        <-- Schemas, Migrations & DAOs
│   ├── engines/
│   │   ├── audience_intelligence.js
│   │   ├── algorithm_research.js
│   │   ├── content_intelligence.js
│   │   ├── viral_candidate.js
│   │   ├── distribution_monitor.js
│   │   ├── experiment_lab.js
│   │   ├── content_recycler.js
│   │   ├── audience_expansion.js
│   │   ├── trend_radar.js
│   │   ├── analytics_engine.js
│   │   ├── human_amplification.js
│   │   └── growth_command.js      <-- Fire Mode & 7-Day Plan Orchestrator
│   ├── meta/                      <-- Meta Graph API Client with Safe Fallbacks
│   └── routes/                    <-- REST API Endpoints for Dashboard
├── server.js                      <-- Upgraded server with Modular Engine Endpoints & Static Routes
└── viral_hub.html                 <-- Upgraded Growth Command Center & 12 Engines Interface (Arabic RTL)
```
