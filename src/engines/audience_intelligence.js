// Audience Intelligence Engine — Active, Engaged & Segment Analysis
const { posts } = require('../db/database');
const config = require('../config');

class AudienceIntelligenceEngine {
  // Analyze audience activity segments from recorded empirical metrics
  getAudienceSegments() {
    const allPosts = posts.list(500);
    const totalFollowers = config.meta.fallbackFollowers || 11000;

    let totalEngagedReactions = 0;
    let totalCommenters = 0;
    let totalSharers = 0;
    let totalVideoViewers = 0;

    allPosts.forEach(p => {
      totalEngagedReactions += p.reactions_count || 0;
      totalCommenters += p.comments_count || 0;
      totalSharers += p.shares_count || 0;
      totalVideoViewers += p.video_views || 0;
    });

    // Approximate unique active audience segments over last 30 days
    const estimatedActiveAudience = Math.min(Math.round(totalEngagedReactions * 0.45) + totalCommenters + totalSharers, totalFollowers);
    const dormantAudience = Math.max(totalFollowers - estimatedActiveAudience, 0);

    return {
      totalFollowers,
      segments: [
        {
          name: 'الجمهور النشط المتفاعل (Engaged Audience)',
          count: estimatedActiveAudience,
          percentage: +((estimatedActiveAudience / totalFollowers) * 100).toFixed(1),
          description: 'المتابعون الذين يضغطون إعجاباً أو يفتحون الروابط بانتظام'
        },
        {
          name: 'المشاركون وسفراء المحتوى (Sharers / Super Advocates)',
          count: totalSharers,
          percentage: +((totalSharers / totalFollowers) * 100).toFixed(1),
          description: 'الشريحة الذهبية التي تنقل المحتوى إلى صفحاتها ومجموعات فيسبوك'
        },
        {
          name: 'المستفسرون والمعلقون (Commenters / Inquirers)',
          count: totalCommenters,
          percentage: +((totalCommenters / totalFollowers) * 100).toFixed(1),
          description: 'من يسألون عن الأعراض، الأسعار، والمواعيد في خلدا'
        },
        {
          name: 'مشاهدو الفيديو التوضيحي (Video Viewers)',
          count: totalVideoViewers,
          percentage: +((totalVideoViewers / totalFollowers) * 100).toFixed(1),
          description: 'من يشاهدون عروض الكايروبراكتيك وحركات تحرير الفقرات'
        },
        {
          name: 'الجمهور الخامل (Dormant Audience)',
          count: dormantAudience,
          percentage: +((dormantAudience / totalFollowers) * 100).toFixed(1),
          description: 'متابعون لا تصلهم المنشورات بانتظام بسبب رتابة المحتوى أو خمول الخوارزمية'
        }
      ],
      retentionAdvice: 'لإيقاظ الجمهور الخامل (Dormant): يُنصح بنشر أسئلة تشخيصية مباشرة (Poll / Question Post) وإطلاق أدوات الفحص التفاعلية لإعادة تنشيط نقاط التفاعل.'
    };
  }
}

module.exports = new AudienceIntelligenceEngine();
