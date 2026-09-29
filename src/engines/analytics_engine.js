// Analytics Engine & Mathematical Growth Metrics
const { posts, getDb } = require('../db/database');
const config = require('../config');

class AnalyticsEngine {
  // 1. Calculate Comprehensive Page Overview for a given timeframe
  getOverview(timeframe = '30d') {
    const daysMap = { '7d': 7, '30d': 30, '90d': 90, 'all': 9999 };
    const days = daysMap[timeframe] || 30;

    const allPosts = posts.list(500);
    const now = Date.now();
    const cutoff = days === 9999 ? 0 : now - (days * 86400000);

    const filtered = allPosts.filter(p => {
      const pubTime = new Date(p.published_at).getTime();
      return isNaN(pubTime) || pubTime >= cutoff;
    });

    if (filtered.length === 0) {
      return {
        timeframe,
        totalPosts: 0,
        followersCount: config.meta.fallbackFollowers,
        totalReach: 0,
        followerReach: 0,
        nonFollowerReach: 0,
        nonFollowerRatio: 0,
        totalReactions: 0,
        totalComments: 0,
        totalShares: 0,
        totalSaves: 0,
        totalPageVisits: 0,
        totalNewFollowers: 0,
        avgEngagementRate: 0,
        avgShareRate: 0,
        growthEfficiencyScore: 0,
        distributionHealth: 'WAITING_FOR_DATA',
        dataIntegrityNote: 'No posts published within the selected timeframe'
      };
    }

    let totalReach = 0;
    let followerReach = 0;
    let nonFollowerReach = 0;
    let totalReactions = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalSaves = 0;
    let totalVisits = 0;
    let totalNewFollowers = 0;

    filtered.forEach(p => {
      totalReach += p.reach || 0;
      followerReach += p.follower_reach || 0;
      nonFollowerReach += p.non_follower_reach || 0;
      totalReactions += p.reactions_count || 0;
      totalComments += p.comments_count || 0;
      totalShares += p.shares_count || 0;
      totalSaves += p.saves_count || 0;
      totalVisits += p.page_visits || 0;
      totalNewFollowers += p.new_followers || 0;
    });

    const totalEngagement = totalReactions + totalComments + totalShares;
    const avgReach = Math.round(totalReach / filtered.length);
    const nonFollowerRatio = totalReach > 0 ? +((nonFollowerReach / totalReach) * 100).toFixed(1) : 0;
    const avgEngagementRate = totalReach > 0 ? +((totalEngagement / totalReach) * 100).toFixed(2) : 0;
    const avgShareRate = totalEngagement > 0 ? +((totalShares / totalEngagement) * 100).toFixed(2) : 0;
    const followerConversionRate = totalVisits > 0 ? +((totalNewFollowers / totalVisits) * 100).toFixed(2) : 0;

    // Mathematical Growth Efficiency Score (0-100)
    // Weight factors:
    // 30% Engagement Rate (benchmarked against 5.0%)
    // 30% Share Rate (benchmarked against 1.5% — high viral power)
    // 25% Non-Follower Expansion Ratio (benchmarked against 50%)
    // 15% Conversion Rate to Followers (benchmarked against 10%)
    const scoreEng = Math.min((avgEngagementRate / 5.0) * 30, 30);
    const scoreShare = Math.min((avgShareRate / 1.5) * 30, 30);
    const scoreNonFollower = Math.min((nonFollowerRatio / 50.0) * 25, 25);
    const scoreConv = Math.min((followerConversionRate / 10.0) * 15, 15);
    const growthEfficiencyScore = Math.round(scoreEng + scoreShare + scoreNonFollower + scoreConv);

    let distributionHealth = 'HEALTHY';
    if (growthEfficiencyScore >= 75) distributionHealth = 'EXPANDING';
    else if (growthEfficiencyScore >= 50) distributionHealth = 'HEALTHY';
    else if (growthEfficiencyScore >= 30) distributionHealth = 'NEEDS_ATTENTION';
    else distributionHealth = 'COOLING';

    return {
      timeframe,
      totalPosts: filtered.length,
      followersCount: config.meta.fallbackFollowers,
      totalReach,
      avgReach,
      followerReach,
      nonFollowerReach,
      nonFollowerRatio,
      totalEngagement,
      totalReactions,
      totalComments,
      totalShares,
      totalSaves,
      totalPageVisits: totalVisits,
      totalNewFollowers,
      avgEngagementRate,
      avgShareRate,
      followerConversionRate,
      growthEfficiencyScore,
      distributionHealth,
      growthFormula: 'Score = (Engagement/5.0 * 30) + (ShareRate/1.5 * 30) + (NonFollower/50 * 25) + (Conversion/10 * 15)'
    };
  }

  // 2. Breakdown by Content Formats (Video, Photo, Status, Reel)
  getFormatPerformance() {
    const allPosts = posts.list(500);
    const formatStats = {};

    allPosts.forEach(p => {
      const type = p.post_type || 'status';
      if (!formatStats[type]) {
        formatStats[type] = {
          format: type,
          count: 0,
          totalReach: 0,
          totalShares: 0,
          totalEngagement: 0,
          totalNonFollowerReach: 0
        };
      }
      formatStats[type].count++;
      formatStats[type].totalReach += p.reach || 0;
      formatStats[type].totalShares += p.shares_count || 0;
      formatStats[type].totalEngagement += (p.reactions_count + p.comments_count + p.shares_count) || 0;
      formatStats[type].totalNonFollowerReach += p.non_follower_reach || 0;
    });

    return Object.values(formatStats).map(f => ({
      format: f.format,
      count: f.count,
      avgReach: Math.round(f.totalReach / f.count),
      avgShares: +(f.totalShares / f.count).toFixed(1),
      avgEngagement: +(f.totalEngagement / f.count).toFixed(1),
      avgNonFollowerReach: Math.round(f.totalNonFollowerReach / f.count),
      nonFollowerRate: f.totalReach > 0 ? +((f.totalNonFollowerReach / f.totalReach) * 100).toFixed(1) : 0
    })).sort((a, b) => b.avgReach - a.avgReach);
  }

  // 3. Breakdown by Topics (Sciatica, Tools, Neck, etc.)
  getTopicPerformance() {
    const allPosts = posts.list(500);
    const topicStats = {};

    allPosts.forEach(p => {
      const topic = p.topic || 'عام وطبيعي';
      if (!topicStats[topic]) {
        topicStats[topic] = {
          topic,
          count: 0,
          totalReach: 0,
          totalShares: 0,
          totalComments: 0,
          totalVisits: 0,
          totalNewFollowers: 0
        };
      }
      topicStats[topic].count++;
      topicStats[topic].totalReach += p.reach || 0;
      topicStats[topic].totalShares += p.shares_count || 0;
      topicStats[topic].totalComments += p.comments_count || 0;
      topicStats[topic].totalVisits += p.page_visits || 0;
      topicStats[topic].totalNewFollowers += p.new_followers || 0;
    });

    return Object.values(topicStats).map(t => ({
      topic: t.topic,
      count: t.count,
      avgReach: Math.round(t.totalReach / t.count),
      avgShares: +(t.totalShares / t.count).toFixed(1),
      avgComments: +(t.totalComments / t.count).toFixed(1),
      newFollowersAttributed: t.totalNewFollowers,
      conversionEfficiency: t.totalReach > 0 ? +((t.totalNewFollowers / t.totalReach) * 1000).toFixed(2) : 0
    })).sort((a, b) => b.avgReach - a.avgReach);
  }

  // 4. Identify Winners & Weak Posts with Concrete Empirical Rationales
  getTopAndWeakPosts() {
    const allPosts = posts.list(500);
    if (!allPosts.length) return { winners: [], weak: [] };

    const sortedByReach = [...allPosts].sort((a, b) => (b.reach || 0) - (a.reach || 0));

    const winners = sortedByReach.slice(0, 3).map(p => ({
      id: p.id,
      hook: p.hook,
      topic: p.topic,
      format: p.post_type,
      reach: p.reach,
      shares: p.shares_count,
      nonFollowerRatio: p.reach > 0 ? +((p.non_follower_reach / p.reach) * 100).toFixed(1) : 0,
      expansion_status: p.expansion_status,
      successRationale: p.has_video
        ? 'فيديو سريري واقعي يلمس مشكلة ألم واضحة ويدعو لفحص فوري'
        : 'طرح خرافة طبية شائعة مع تصحيح بيوميكانيكي يثير الفضول والمشاركة'
    }));

    const weak = sortedByReach.slice(-3).reverse().map(p => ({
      id: p.id,
      hook: p.hook,
      topic: p.topic,
      format: p.post_type,
      reach: p.reach,
      shares: p.shares_count,
      expansion_status: p.expansion_status || 'COOLING',
      improvementRationale: (p.shares_count < 5)
        ? 'معدل مشاركة منخفض؛ يحتاج Hook أكثر جرأة ونداء فعل (CTA) واضح'
        : 'نص إخباري عام يفتقر للزاوية العاطفية أو السريرية المعالجة'
    }));

    return { winners, weak };
  }
}

module.exports = new AnalyticsEngine();
