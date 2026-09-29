// Audience Expansion Engine & Non-Follower Conversion Funnel
const { posts } = require('../db/database');
const config = require('../config');

class AudienceExpansionEngine {
  // 1. Build and calculate the full 4-stage Expansion Funnel
  getExpansionFunnel() {
    const allPosts = posts.list(500);

    let totalReach = 0;
    let followerReach = 0;
    let nonFollowerReach = 0;
    let totalPageVisits = 0;
    let totalNewFollowers = 0;

    allPosts.forEach(p => {
      totalReach += p.reach || 0;
      followerReach += p.follower_reach || 0;
      nonFollowerReach += p.non_follower_reach || 0;
      totalPageVisits += p.page_visits || 0;
      totalNewFollowers += p.new_followers || 0;
    });

    const nonFollowerReachRatio = totalReach > 0 ? +((nonFollowerReach / totalReach) * 100).toFixed(1) : 0;
    const visitFromNonFollowerRate = nonFollowerReach > 0 ? +((totalPageVisits / nonFollowerReach) * 100).toFixed(2) : 0;
    const followerFromVisitRate = totalPageVisits > 0 ? +((totalNewFollowers / totalPageVisits) * 100).toFixed(1) : 0;
    const contentToFollowerEfficiency = totalReach > 0 ? +((totalNewFollowers / totalReach) * 1000).toFixed(2) : 0;

    // Funnel Steps
    const funnelSteps = [
      {
        stage: 1,
        title: 'وصول المتابعين الحاليين (Follower Reach)',
        value: followerReach,
        percentageOfTotal: totalReach > 0 ? +((followerReach / totalReach) * 100).toFixed(1) : 0,
        description: 'الوصول الطبيعي لجمهور الصفحة الأساسي (حوالي 11,000 متابع)'
      },
      {
        stage: 2,
        title: 'وصول غير المتابعين (Non-Follower Reach)',
        value: nonFollowerReach,
        percentageOfTotal: nonFollowerReachRatio,
        description: 'المحتوى المقترح عبر الخوارزمية لجمهور جديد لم يسبق له متابعة الصفحة'
      },
      {
        stage: 3,
        title: 'زيارات الصفحة المكتسبة (Page Visits)',
        value: totalPageVisits,
        conversionFromPrevious: visitFromNonFollowerRate + '%',
        description: 'المستخدمون الذين نقروا على اسم المركز وتصفحوا الملف التعريفي والخدمات'
      },
      {
        stage: 4,
        title: 'متابعون جدد حقيقيون (New Followers)',
        value: totalNewFollowers,
        conversionFromPrevious: followerFromVisitRate + '%',
        description: 'تحول الزائر إلى متابع دائم في شبكة مركز وداعاً للألم'
      }
    ];

    // Identify which topics expand to non-followers best
    const topicExpansion = {};
    allPosts.forEach(p => {
      const topic = p.topic || 'عام';
      if (!topicExpansion[topic]) topicExpansion[topic] = { topic, nonFollower: 0, follower: 0, newFollowers: 0 };
      topicExpansion[topic].nonFollower += p.non_follower_reach || 0;
      topicExpansion[topic].follower += p.follower_reach || 0;
      topicExpansion[topic].newFollowers += p.new_followers || 0;
    });

    const topExpansionTopics = Object.values(topicExpansion).map(t => {
      const total = t.nonFollower + t.follower;
      return {
        topic: t.topic,
        nonFollowerRatio: total > 0 ? +((t.nonFollower / total) * 100).toFixed(1) : 0,
        newFollowersGained: t.newFollowers,
        expansionType: (t.nonFollower / Math.max(total, 1)) > 0.55 ? 'NON_FOLLOWER_MAGNET 🚀' : 'NURTURING_EXISTING 💙'
      };
    }).sort((a, b) => b.nonFollowerRatio - a.nonFollowerRatio);

    return {
      totalAudienceReached: totalReach,
      funnelSteps,
      conversionMetrics: {
        nonFollowerReachRatio: nonFollowerReachRatio + '%',
        visitConversionRate: visitFromNonFollowerRate + '%',
        followerConversionRate: followerFromVisitRate + '%',
        contentToFollowerPerThousand: contentToFollowerEfficiency + ' متابع لكل 1,000 وصول'
      },
      topExpansionTopics
    };
  }
}

module.exports = new AudienceExpansionEngine();
