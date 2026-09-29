// Content Intelligence Engine & Multi-Format Transformer
const { posts, ideas, logAudit } = require('../db/database');
const config = require('../config');

class ContentIntelligenceEngine {
  // 1. Transform a Core Clinical/Medical Idea into 8 High-Impact Formats
  transformIdea(coreConcept, topic = 'عرق النسا والديسك') {
    const clinicName = config.clinic.name;
    const phone = config.clinic.phone;
    const location = config.clinic.location;

    const formats = {
      // 1. Standard Post (منشور فيسبوك مفصل)
      post: {
        formatName: 'منشور فيسبوك تحليلي طويل',
        icon: '📝',
        hook: `هل تعلم أن 80% من آلام ${topic} ليست ناتجة عن مشكلة دائمة بل عن انضغاط موضعي يمكن تحريره؟`,
        body: `كثير من المراجعين براجعونا بالمركز بعد ما يكون قيل لهم "ما في حل غير العملية"!\n\nالحقيقة العلمية:\nفي مركز ${clinicName}، نعتمد على الكشف البيوميكانيكي الدقيق للعمود الفقري.\nعندما يتم تحديد موضع الضغط العصبي بدقة، نستطيع عبر جلسات الكايروبراكتيك والعلاج اليدوي المتخصص إعادة محاذاة الفقرات وتخفيف الضغط عن الجذور العصبية بأمان ودون جراحة.\n\n💡 نصيحة اليوم:\nلا تسكت على الألم وتعتمد على المسكنات فقط؛ المسكن يُخفي الإنذار ولكن لا يحل المشكلة.`,
        cta: `📞 للاستفسار وحجز موعد كشفية بمركزنا في ${location}:\nواتساب/اتصال: ${phone}`,
        estimatedReadTime: '45 ثانية'
      },

      // 2. Reel Script (سيناريو ريلز سريع وجاذب)
      reel: {
        formatName: 'فيديو ريلز عمودي (30-45 ثانية)',
        icon: '🎬',
        hook: 'توقف فوراً! ❌ هذه الحركة تفاقم وجع ظهرك وأنت لا تدري!',
        visualPrompt: 'الدكتور يقف في العيادة ويشير إلى مجسم العمود الفقري ثم يوضح الحركة الخاطئة مقابل الصحيحة.',
        script: [
          '⏱️ [0:00 - 0:03]: (صوت حازم + إشارة للعمود الفقري) كثير ناس لما يوجعهم ظهرهم بناموا بالفرشة لأيام!',
          '⏱️ [0:03 - 0:15]: النتيجة؟ العضلات بتضعف والغضروف بضل مضغوط والوجع بزيد!',
          '⏱️ [0:15 - 0:30]: الحل البديل؟ تمرين إطالة الكمثرية الخفيف وتحرير ميكانيكا الحوض.',
          '⏱️ [0:30 - 0:45]: (ختام) احفظ هذا الفيديو، وافحص عمر عمودك الفقري بالرابط في البايو أو راجعنا بخلدا.'
        ],
        cta: 'احفظ الريلز وشاركه مع شخص يعاني من نفس الألم 🔖'
      },

      // 3. Story Sequence (سلسلة ستوري تفاعلية واستفتاء)
      story: {
        formatName: 'ستوري تفاعلي مع استطلاع رأي',
        icon: '📱',
        frames: [
          { frame: 1, text: 'سؤال سريع لكل من يجلس ساعات طويلة خلف المكتب أو المقود 🚗👇' },
          { frame: 2, sticker: 'استفتاء: هل تحس بتنميل أو وخز بالرجل عند المشي؟ (نعم 🙋‍♂️ / أحياناً 🤔)' },
          { frame: 3, text: 'النتيجة: هذا غالباً تهيج بالعصب الوركي L4-S1 وليس مجرد شد عضلي عابر.' },
          { frame: 4, link: `احجز كشفيتك السريرية الآن عبر ${phone} في ${location}` }
        ]
      },

      // 4. Carousel (سلايدات إنفوجرافيك 5 بطاقات)
      carousel: {
        formatName: 'كاروسيل إنفوجرافيك تعليمي (5 بطاقات)',
        icon: '🎠',
        cards: [
          { card: 1, title: 'البطاقة 1 (الغلاف)', text: `5 علامات تدل أن وجعك سببه ${topic} وليس شداً عادياً` },
          { card: 2, title: 'البطاقة 2', text: 'العلامة 1: الألم يزداد مع الجلوس ويخف تدريجياً مع الوقوف الحذر' },
          { card: 3, title: 'البطاقة 3', text: 'العلامة 2: خدر وتنميل يمتد إلى ما بعد الركبة' },
          { card: 4, title: 'البطاقة 4', text: 'العلامة 3: شعور بلسعة كهربائية حادة عند السعال أو العطس' },
          { card: 5, title: 'البطاقة 5 (الختام)', text: `مركز ${clinicName} | ${location} — اتصل الآن: ${phone}` }
        ]
      },

      // 5. Short Video Breakdown (فيديو سريري تطبيقي)
      short_video: {
        formatName: 'فيديو سريري تطبيقي (60 ثانية)',
        icon: '📹',
        hook: 'كيف نميّز بين ديسك الفقرات القطنية ومتلازمة العضلة الكمثرية؟',
        keyPoints: [
          '1. فحص رفع الساق المستقيمة (SLR Test)',
          '2. الضغط الموضعي على العضلة الإليوية',
          '3. خطة العلاج اليدوي والكايروبراكتيك المحددة لكل حالة'
        ],
        cta: `للتشخيص السريري الدقيق: تواصل معنا على ${phone}`
      },

      // 6. Question Post (منشور سؤال تفاعلي يثير التعليقات)
      question: {
        formatName: 'منشور سؤال تفاعلي (Engagement Magnet)',
        icon: '❓',
        hook: 'سؤال لأصحاب المكاتب والسائقين: كم ساعة تقضي جالساً يومياً؟',
        body: 'أ) أقل من 4 ساعات 🚶‍♂️\nب) من 4 إلى 8 ساعات 💻\nج) أكثر من 8 ساعات 🚕\n\nعلّق برقم خيارك، وسنرسل لك في الردود تمرين فك ضغط الفقرات الأنسب لساعات جلوسك مجاناً!',
        cta: 'شاركنا رقمك بالتعليقات 👇'
      },

      // 7. Educational Anatomical Post (منشور تشريحي عميق)
      educational_post: {
        formatName: 'منشور تشريحي وتثقيفي عميق',
        icon: '🧠',
        hook: 'تشريحياً: لماذا يعتبر مفصل الحوض (SI Joint) هو الجندي المجهول لآلام الظهر؟',
        body: 'كثير من المراجعين يعالجون أسفل الظهر لشهور دون تحسن، ويكون السبب الحقيقي ميلاناً بسيطاً في عظام الحوض (Sacroiliac Joint).\nعندما يعاد ضبط المفصل بتقنيات الكايروبراكتيك، يزول الحمل الشاذ عن الفقرات فوراً.',
        cta: `مركز ${clinicName} — خبرة متخصصة بالعلاج اليدوي والتأهيل الحركي.`
      },

      // 8. Follow-up / FAQ Post (منشور الإجابة عن مخاوف المرضى)
      follow_up_post: {
        formatName: 'منشور إجابة عن أسئلة ومخاوف المرضى',
        icon: '💬',
        hook: 'أكثر سؤال يتردد في عيادتنا: "دكتور، هل طقطقة الفقرات والكايروبراكتيك مؤلمة أو خطيرة؟"',
        body: 'الجواب العلمي القاطع:\nالكايروبراكتيك عندما يتم بأيدي أخصائيين معتمدين هو إجراء آمن ومريح جداً.\nالصوت الذي تسمعه ليس تكسيراً للعظام، بل هو تحرر فقاعات غاز النيتروجين من داخل السائل المفصلي، ويعقبه شعور فوري بالخفة وزوال الشد والضغط.',
        cta: `زورونا في خلدا، عمّان | استفسار فوري: ${phone}`
      }
    };

    return {
      coreConcept,
      topic,
      formatsCount: 8,
      formats
    };
  }

  // 2. Content Fatigue Radar (Check if a topic/hook is overused and losing steam)
  checkContentFatigue(windowDays = 14) {
    const allPosts = posts.list(100);
    const now = Date.now();
    const cutoff = now - (windowDays * 86400000);

    const recentPosts = allPosts.filter(p => new Date(p.published_at).getTime() >= cutoff);
    const topicFrequency = {};

    recentPosts.forEach(p => {
      const topic = p.topic || 'عام';
      if (!topicFrequency[topic]) topicFrequency[topic] = { count: 0, totalReach: 0, posts: [] };
      topicFrequency[topic].count++;
      topicFrequency[topic].totalReach += p.reach || 0;
      topicFrequency[topic].posts.push(p);
    });

    const alerts = [];
    Object.entries(topicFrequency).forEach(([topic, data]) => {
      if (data.count >= 3) {
        const avgRecentReach = data.totalReach / data.count;
        alerts.push({
          topic,
          occurrencesIn14Days: data.count,
          avgReach: Math.round(avgRecentReach),
          status: 'FATIGUE_WARNING',
          alertMessage: `موضوع "${topic}" تم تكراره ${data.count} مرات خلال آخر 14 يوماً.`,
          recommendation: 'يُنصح بتغيير زاوية التناول (Angle)، والتحول إلى موضوع الرقبة والأبهر أو أدوات الفحص الذكية لكسر رتابة الخوارزمية.'
        });
      }
    });

    return {
      windowDays,
      analyzedPostsCount: recentPosts.length,
      hasFatigue: alerts.length > 0,
      alerts
    };
  }

  // 3. Save Idea with Human Approval Workflow
  submitIdea(title, coreProblem, targetAudience = 'مرضى الديسك وآلام المفاصل') {
    const transformation = this.transformIdea(coreProblem, title);
    const ideaId = ideas.create({
      title,
      angle: 'سريري إقناعي يربط الأعراض بحل المركز',
      target_audience: targetAudience,
      core_problem: coreProblem,
      curiosity_score: 8.5,
      discussion_score: 8.8,
      share_score: 9.1,
      save_score: 8.6,
      follower_conversion_score: 8.2,
      non_follower_score: 8.9,
      historical_similarity_note: 'يشبه منشورات عرق النسا الناجحة تاريخياً بمركز وداعاً للألم',
      status: 'IDEA'
    });

    logAudit('CONTENT_IDEA_SUBMITTED', 'CONTENT', { ideaId, title });

    return {
      success: true,
      ideaId,
      status: 'IDEA',
      approvalNote: 'تم إنشاء الفكرة بنجاح وتجهيز 8 أشكال متنوعة منها، وبانتظار الموافقة الإنسانية (Approval).',
      transformation
    };
  }
}

module.exports = new ContentIntelligenceEngine();
