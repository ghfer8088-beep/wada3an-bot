# Implementation Plan — خطة التنفيذ الشاملة خطوة بخطوة
**نظام:** Facebook Page Growth & Content Intelligence Platform
**الصفحة المستهدفة:** وداعاً للألم (`30minutes30` / ID: `102533574608295`) — 11,000 متابع حقيقي

---

## المنهجية العامة
1. الحفاظ الصارم على الوظائف السابقة دون حذف أي ملف أو اختصار كود موجود.
2. عدم الاعتماد على بيانات وهمية أو أزرار غير فعالة؛ كل واجهة مرتبطة بمحرك برمجي حقيقي.
3. العمل مرحلة بمرحلة (Phase by Phase) مع التحقق والاختبار بعد كل مرحلة.

---

## جدول المراحل الـ 12

### Phase 1: Foundation (التأسيس وقاعدة البيانات والبنية المعيارية)
- **الأهداف:**
  - بناء طبقة قاعدة البيانات الدائمة باستخدام SQLite المدمج (`node:sqlite` في Node v24) بدون أي اعتماديات خارجية قد تفشل.
  - إنشاء الـ Schemas لكافة الجداول المحددة بالبرومبت:
    - `pages`, `posts`, `post_snapshots`, `content_ideas`, `experiments`, `experiment_results`, `audience_segments`, `topics`, `hooks`, `content_formats`, `growth_events`, `page_algorithm_dna`, `trends`, `comments`, `content_repurposing`, `notifications`, `users`, `settings`, `audit_logs`.
  - إنشاء محرك التوثيق والسجلات `audit_logs` والتعامل الآمن مع المتغيرات البيئية والتكوين.
  - إعداد بنية المجلدات المعيارية (`src/db`, `src/config`, `src/engines`, `src/routes`, `src/meta`).

### Phase 2: Meta Integration (تكامل واجهات Meta Graph API الآمن والذكي)
- **الأهداف:**
  - فحص أحدث إصدارات Meta Graph API (v19.0 - v21.0) والتحقق من التوكن وصلاحياته (`pages_show_list`, `pages_read_engagement`, `read_insights`, إلخ).
  - بناء وحدة `metaClient.js` المعزولة للتعامل مع Meta API:
    - فحص صلاحية التوكن وتاريخ انتهائه.
    - قراءة المنشورات وتفاصيلها (`fields=id,message,created_time,permalink_url,full_picture,shares,reactions.summary(true),comments.summary(true)`).
    - قراءة الرؤى والإحصاءات (`insights` للوصول الكلي، وصول غير المتابعين، تفاعل المنشورات).
    - التعامل الدقيق مع الحقول غير المتاحة وإرجاع "Data unavailable" بدلاً من اختلاق أرقام وهمية.

### Phase 3: Data Collection & Velocity Snapshots (جمع البيانات وتتبع السرعة)
- **الأهداف:**
  - بناء محرك المزامنة التلقائية واليدوية للمنشورات من الصفحة وتخزينها في جدول `posts`.
  - بناء آلية التقاط الـ Snapshots الزمنية للمنشورات الجديدة والنشطة:
    - (15m, 30m, 60m, 3h, 6h, 12h, 24h, 48h).
  - حساب مؤشرات السرعة اللحظية: `Reach Velocity`, `Engagement Velocity`, `Share Velocity`.

### Phase 4: Analytics Engine & Growth Metrics (محرك التحليلات ومقاييس النمو)
- **الأهداف:**
  - حساب المقاييس الحقيقية بدقة:
    - Reach over time, Follower Reach vs Non-Follower Reach.
    - Engagement Rate, Share Rate, Comment Rate.
    - New Followers & Page Visits (حسب توفرها رسمياً من الـ Insights).
    - حساب مؤشر الكفاءة الحقيقي: `Growth Efficiency Score` المفسر رياضياً (نسبة الوصول والتفاعل والمشاركات بالنسبة لعدد المتابعين وحجم النشر).
  - فلاتر الفترات الزمنية: (7 days, 30 days, 90 days, Custom).

### Phase 5: Algorithm Research Engine & Expansion Detector (مختبر الخوارزمية واكتشاف التوسع)
- **الأهداف:**
  - بناء محرك كشف التوسع (Expansion Detector) الذي يصنف المنشور وفق سرعته:
    - `INITIAL TEST`, `WAITING`, `GROWING`, `EXPANDING`, `COOLING`, `SATURATED`.
  - استنتاج `Page Algorithm DNA` من البيانات الفعلية مع مؤشرات الثقة الإحصائية (`Confidence %`):
    - أفضل أوقات النشر الفعلية للصفحة (Best Posting Windows).
    - أفضل أطوال النصوص والفيديوهات.
    - أفضل أشكال الـ Hooks والـ Topics التي ارتبطت إحصائياً بأعلى انتشار.
  - التفريق الصارم في التقارير بين: `FACT`, `CORRELATION`, `HYPOTHESIS`, `RECOMMENDATION`.

### Phase 6: Content Intelligence & Multi-Format Transformer (ذكاء المحتوى والتحويل متعدد الأشكال)
- **الأهداف:**
  - محول الفكرة الواحدة إلى 8 قوالب وأشكال:
    - Post, Reel, Story, Carousel, Short video, Question, Educational post, Follow-up post.
  - نظام الاعتماد والموافقة الإنسانية (Approval Workflow) قبل أي نشر.
  - فاحص الإجهاد التكراري للمحتوى (Content Fatigue Alert) لتنبيه المستخدم عند استهلاك نفس الموضوع أو الزاوية وتراجع نتائجها.

### Phase 7: Experiment Lab (مختبر التجارب العلمية المعزولة)
- **الأهداف:**
  - واجهة ومحرك متكامل لإنشاء وإدارة التجارب العلمية:
    - الفرضية (Hypothesis).
    - عزل متغير واحد محدد (Hook, Format, Length, Time, CTA).
    - الشاهد (Control) والمتحور (Variant).
    - حجم العينة وفترة الاختبار والنتائج ومستوى الثقة الدلالي (Confidence).
  - ربط نتائج التجارب تلقائياً بتحديث `Page Algorithm DNA`.

### Phase 8: Audience Expansion Engine & Funnel (محرك توسيع الجمهور وقمع التحويل)
- **الأهداف:**
  - بناء وتتبع قمع النمو الفعلي:
    - Follower Reach → Non-Follower Reach → Page Visits → New Followers.
  - قياس معدلات التحويل الفعلية:
    - `Follower Conversion Rate`, `Non-Follower Conversion Rate`, `Content-to-Follower Efficiency`.
  - تقرير بالمحتوى الأقدر على جلب غير المتابعين مقابل المحتوى المخصص للمتابعين الحاليين.

### Phase 9: Content Recycler & Resurrection Engine (إحياء وإعادة تدوير المحتوى الرابح)
- **الأهداف:**
  - فحص وتحليل المنشورات القديمة وتصنيفها:
    - `Evergreen`, `Needs Update`, `Expired`, `High Potential`.
  - اقتراح زوايا تطوير ذكية دون نسخ حرفي:
    - Old Post → New Hook → Updated Value → New Visual/Reel/Story.

### Phase 10: Growth Command Center & Fire Mode (مركز قيادة النمو وزر الإطلاق)
- **الأهداف:**
  - تطوير الواجهة الرئيسية لتصبح `Growth Command Center` متكاملة باللغة العربية RTL.
  - تنفيذ زر الإطلاق الرئيسي: **🔥 FIRE THE PAGE**:
    - تشغيل سير العمل الـ 15 خطوة المترابط بالتتابع وعرض حالة كل خطوة لحظياً.
  - توليد الخطة الأسبوعية الذكية (7-Day Dynamic Growth Plan) المستندة على معطيات الصفحة الواقعية.
  - دمج الـ `Human Amplification Panel` الآمن والممتثل لـ 12 حساباً كلوحة إشعارات ومتابعة مشاركة تطوعية.

### Phase 11: Testing & Verification (الاختبار الشامل والتحقق)
- **الأهداف:**
  - اختبارات الوحدة والواجهات البرمجية (Unit & Integration Tests) لجميع محركات النظام الـ 12.
  - اختبار استجابة واجهات المستخدم ودقة الحسابات الإحصائية ومنع الأخطاء وحالات عدم توفر البيانات.
  - التأكد التام من استمرارية عمل كافة الصفحات القديمة دون أي خلل تراجعي (Zero Regression).

### Phase 12: Production Hardening & Security (التعزيز الأمني والجاهزية الإنتاجية)
- **الأهداف:**
  - عزل المتغيرات الحساسة والتوكنات في متغيرات بيئية مشفرة/آمنة.
  - سجلات تدقيق العمليات (Audit Logs) لجميع طلبات الـ API وسير العمل.
  - تجهيز الوثائق الإرشادية والتشغيلية المكتملة.
