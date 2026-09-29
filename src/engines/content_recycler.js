// Content Resurrection & Evergreen Recycling Engine
const { posts, logAudit } = require('../db/database');

class ContentRecycler {
  // 1. Audit and classify all historical posts for resurrection
  auditPostsForResurrection() {
    const allPosts = posts.list(500);

    const categorized = {
      evergreen: [],
      needsUpdate: [],
      highPotential: [],
      expired: []
    };

    allPosts.forEach(p => {
      const msg = p.message || '';
      const shares = p.shares_count || 0;
      const reach = p.reach || 0;
      const reactions = p.reactions_count || 0;

      // Expired: Holiday greetings or specific date-based offers
      if (msg.includes('عيدكم مبارك') || msg.includes('عرض ينتهي اليوم') || msg.includes('جمعة مباركة فقط')) {
        categorized.expired.push({
          id: p.id,
          hook: p.hook,
          status: 'EXPIRED',
          reason: 'محتوى موسمي أو مناسباتي منتهي الصلاحية'
        });
      }
      // Evergreen: Educational, anatomy, sciatica, biomechanics
      else if (shares >= 25 || p.topic === 'عرق النسا والديسك' || p.topic === 'أدوات الفحص الذكية') {
        categorized.evergreen.push({
          id: p.id,
          hook: p.hook,
          topic: p.topic,
          originalReach: reach,
          originalShares: shares,
          status: 'EVERGREEN',
          resurrectionPlan: {
            suggestedAction: 'تحويل إلى فيديو ريلز قصير أو كاروسيل 5 بطاقات',
            suggestedNewHook: `إعادة طرح: ${p.hook.replace('هل تشعر', 'لماذا يتجاهل الكثيرون')}؟`,
            rule: 'ممنوع النسخ الحرفي؛ يجب إضافة قيمة تشخيصية جديدة وتحديث التصميم.'
          }
        });
      }
      // High Potential: High engagement rate but low reach due to bad timing
      else if (reactions >= 15 && reach < 2000) {
        categorized.highPotential.push({
          id: p.id,
          hook: p.hook,
          topic: p.topic,
          originalReach: reach,
          status: 'HIGH_POTENTIAL',
          resurrectionPlan: {
            suggestedAction: 'تغيير الـ Hook ليكون سؤالاً مباشراً وإعادة الجدولة في النافذة الذهبية (7:00 مساءً)',
            suggestedNewHook: 'سؤال سريري سريع: ' + p.hook,
            rule: 'فكرة واعدة ظُلمت بتوقيت النشر الأولي أو عنوان ضعيف.'
          }
        });
      }
      // Needs Update
      else {
        categorized.needsUpdate.push({
          id: p.id,
          hook: p.hook,
          topic: p.topic,
          status: 'NEEDS_UPDATE',
          resurrectionPlan: {
            suggestedAction: 'دمج النص مع فحص ذاتي عبر أدوات الفحص الذكية'
          }
        });
      }
    });

    logAudit('CONTENT_RECYCLER_AUDITED', 'CONTENT', {
      evergreenCount: categorized.evergreen.length,
      highPotentialCount: categorized.highPotential.length
    });

    return categorized;
  }

  // 2. Generate a Complete Resurrection Blueprint for a specific post
  resurrectPost(postId) {
    const post = posts.getById(postId);
    if (!post) return { success: false, error: 'Post not found' };

    return {
      success: true,
      originalPost: {
        id: post.id,
        hook: post.hook,
        topic: post.topic,
        message: post.message
      },
      resurrectionBlueprint: {
        newHookOption1: `⚠️ تحديث علمي مهم: ما الذي تغيّر في علاج ${post.topic || 'العمود الفقري'} هذا العام؟`,
        newHookOption2: `❌ توقف عن ارتكاب هذا الخطأ إذا كنت تعاني من ${post.topic || 'ألم الظهر'}!`,
        updatedValueAngle: 'شرح بيوميكانيكي يوضح ميكانيكا الضغط على العصب مع إضافة رابط أداة الفحص الذكي',
        visualTransformation: 'تصميم بوستر إنفوجرافيك مقارنة (خرافة ❌ مقابل حقيقة ✅) مع شعار المركز الدائري',
        recommendedFormat: 'فيديو ريلز عمودي (Reel) مدته 40 ثانية يختم بـ 0790360440',
        publishingWindowRecommendation: 'الخميس الساعة 7:00 مساءً'
      }
    };
  }
}

module.exports = new ContentRecycler();
