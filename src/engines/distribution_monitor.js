// Distribution Monitoring & Velocity Tracking Engine
const metaClient = require('../meta/metaClient');
const { posts, snapshots, logAudit } = require('../db/database');
const config = require('../config');

class DistributionMonitor {
  // 1. Sync posts from Meta API into the database
  async syncPosts(limit = 20) {
    const fetchRes = await metaClient.fetchPagePosts(limit);

    if (!fetchRes.success) {
      logAudit('POST_SYNC_SKIPPED', 'DISTRIBUTION', {
        reason: fetchRes.error,
        fallback: 'Serving existing database posts'
      });
      return {
        success: false,
        error: fetchRes.error,
        syncedCount: 0,
        currentDbCount: posts.list(50).length
      };
    }

    let synced = 0;
    for (const p of fetchRes.posts) {
      posts.upsert(p);
      synced++;
    }

    logAudit('POST_SYNC_SUCCESS', 'DISTRIBUTION', { syncedCount: synced });
    return {
      success: true,
      syncedCount: synced,
      totalInDb: posts.list(100).length
    };
  }

  // 2. Record Distribution Velocity Snapshot for a post
  recordSnapshot(postId, windowName, currentMetrics = {}) {
    const post = posts.getById(postId);
    if (!post) {
      return { success: false, error: 'Post not found in database' };
    }

    const windowMinutesMap = {
      '15m': 15,
      '30m': 30,
      '60m': 60,
      '3h': 180,
      '6h': 360,
      '12h': 720,
      '24h': 1440,
      '48h': 2880
    };

    const minutesSincePublish = windowMinutesMap[windowName] || 60;
    const existingSnapshots = snapshots.getByPostId(postId);
    const lastSnapshot = existingSnapshots[existingSnapshots.length - 1];

    const currentReach = currentMetrics.reach !== undefined ? currentMetrics.reach : post.reach;
    const currentReactions = currentMetrics.reactions !== undefined ? currentMetrics.reactions : post.reactions_count;
    const currentComments = currentMetrics.comments !== undefined ? currentMetrics.comments : post.comments_count;
    const currentShares = currentMetrics.shares !== undefined ? currentMetrics.shares : post.shares_count;
    const currentEngagement = currentReactions + currentComments + currentShares;

    // Calculate hourly velocity
    let velocityReachPerHour = 0;
    let velocityEngPerHour = 0;

    if (lastSnapshot) {
      const deltaMinutes = Math.max(minutesSincePublish - lastSnapshot.minutes_since_publish, 5);
      const deltaHours = deltaMinutes / 60;
      velocityReachPerHour = Math.max(0, +((currentReach - lastSnapshot.reach) / deltaHours).toFixed(1));
      const prevEng = lastSnapshot.reactions + lastSnapshot.comments + lastSnapshot.shares;
      velocityEngPerHour = Math.max(0, +((currentEngagement - prevEng) / deltaHours).toFixed(1));
    } else {
      const hours = Math.max(minutesSincePublish / 60, 0.25);
      velocityReachPerHour = +((currentReach / hours)).toFixed(1);
      velocityEngPerHour = +((currentEngagement / hours)).toFixed(1);
    }

    const snapshotData = {
      post_id: postId,
      snapshot_window: windowName,
      minutes_since_publish: minutesSincePublish,
      reach: currentReach,
      follower_reach: currentMetrics.follower_reach !== undefined ? currentMetrics.follower_reach : post.follower_reach,
      non_follower_reach: currentMetrics.non_follower_reach !== undefined ? currentMetrics.non_follower_reach : post.non_follower_reach,
      reactions: currentReactions,
      comments: currentComments,
      shares: currentShares,
      saves: currentMetrics.saves !== undefined ? currentMetrics.saves : post.saves_count,
      video_views: currentMetrics.video_views !== undefined ? currentMetrics.video_views : post.video_views,
      velocity_reach_per_hour: velocityReachPerHour,
      velocity_engagement_per_hour: velocityEngPerHour
    };

    snapshots.add(snapshotData);

    logAudit('SNAPSHOT_RECORDED', 'DISTRIBUTION', {
      postId,
      window: windowName,
      velocityReachPerHour,
      velocityEngPerHour
    });

    return {
      success: true,
      snapshot: snapshotData
    };
  }

  // 3. Get Velocity History for Visualization
  getVelocityHistory(postId) {
    const post = posts.getById(postId);
    if (!post) return { success: false, error: 'Post not found' };

    const snaps = snapshots.getByPostId(postId);
    return {
      success: true,
      post: {
        id: post.id,
        hook: post.hook,
        topic: post.topic,
        published_at: post.published_at,
        current_reach: post.reach
      },
      snapshotsCount: snaps.length,
      snapshots: snaps
    };
  }

  // 4. Seed authentic clinical benchmark posts if DB is fresh
  seedBenchmarkPostsIfEmpty() {
    const existing = posts.list(5);
    if (existing.length >= 3) return;

    const benchmarks = [
      {
        id: 'post_benchmark_001',
        page_id: config.meta.pageId,
        permalink_url: 'https://facebook.com/30minutes30/posts/bench001',
        post_type: 'video',
        message: '🔴 هل تشعر بألم حاد أسفل الظهر يمتد لخلف الفخذ وكعب القدم؟ عرق النسا ليس مرضاً بحد ذاته بل عرض لانضغاط عصب!\nشاهد بالفيديو التوضيحي كيف يتم تحرير العصب الوركي بدون أي جراحة بمركز وداعاً للألم.',
        hook: 'هل تشعر بألم حاد أسفل الظهر يمتد لخلف الفخذ وكعب القدم؟',
        topic: 'عرق النسا والديسك',
        category: 'سريري وتوعوي',
        has_image: 0,
        has_video: 1,
        video_duration: 52.0,
        published_at: new Date(Date.now() - 3 * 86400000).toISOString(),
        reach: 7850,
        follower_reach: 2900,
        non_follower_reach: 4950,
        reactions_count: 285,
        comments_count: 74,
        shares_count: 62,
        saves_count: 45,
        video_views: 6100,
        watch_time_seconds: 98000,
        page_visits: 140,
        new_followers: 38,
        engagement_rate: 7.82,
        share_rate: 1.48,
        comment_rate: 1.76,
        follower_conversion: 0.48,
        non_follower_conversion: 0.77,
        expansion_status: 'EXPANDING',
        performance_tier: 'WINNER'
      },
      {
        id: 'post_benchmark_002',
        page_id: config.meta.pageId,
        permalink_url: 'https://facebook.com/30minutes30/posts/bench002',
        post_type: 'status',
        message: '🧠 خرافة طبية يصدقها 90% من الناس:\n"إذا عندك ديسك بالفقرات لازم ترتاح بالفرشة أسبوعين!"\nالعلم الحديث يثبت: الراحة التامة تضعف عضلات العمود الفقري وتزيد التصاق الغضاريف.. الحركة الموجهة هي العلاج.',
        hook: 'خرافة طبية يصدقها 90% من الناس عن علاج الديسك',
        topic: 'حقائق وخرافات الظهر',
        category: 'تعليمي',
        has_image: 1,
        has_video: 0,
        video_duration: 0,
        published_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        reach: 4200,
        follower_reach: 2400,
        non_follower_reach: 1800,
        reactions_count: 142,
        comments_count: 36,
        shares_count: 28,
        saves_count: 31,
        video_views: 0,
        watch_time_seconds: 0,
        page_visits: 55,
        new_followers: 14,
        engagement_rate: 5.12,
        share_rate: 0.71,
        comment_rate: 0.91,
        follower_conversion: 0.33,
        non_follower_conversion: 0.78,
        expansion_status: 'GROWING',
        performance_tier: 'NORMAL'
      },
      {
        id: 'post_benchmark_003',
        page_id: config.meta.pageId,
        permalink_url: 'https://facebook.com/30minutes30/posts/bench003',
        post_type: 'status',
        message: '📌 سؤال يحيّر الكثيرين: ما هو عمر عمودك الفقري الحقيقي مقارنة بعمرك الزمني؟\nطورنا أداة فحص سريري بيوميكانيكي مجانية تفحص وضعية فقراتك خلال دقيقة واحدة عبر الرابط أدناه 👇',
        hook: 'ما هو عمر عمودك الفقري الحقيقي مقارنة بعمرك الزمني؟',
        topic: 'أدوات الفحص الذكية',
        category: 'أدوات تفاعلية',
        has_image: 1,
        has_video: 0,
        video_duration: 0,
        published_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        reach: 9400,
        follower_reach: 3100,
        non_follower_reach: 6300,
        reactions_count: 340,
        comments_count: 112,
        shares_count: 88,
        saves_count: 54,
        video_views: 0,
        watch_time_seconds: 0,
        page_visits: 310,
        new_followers: 65,
        engagement_rate: 9.25,
        share_rate: 1.62,
        comment_rate: 2.06,
        follower_conversion: 0.69,
        non_follower_conversion: 1.03,
        expansion_status: 'EXPANDING',
        performance_tier: 'WINNER'
      }
    ];

    benchmarks.forEach(p => posts.upsert(p));

    // Seed snapshots for post 1
    this.recordSnapshot('post_benchmark_001', '15m', { reach: 800, reactions: 35, comments: 10, shares: 8 });
    this.recordSnapshot('post_benchmark_001', '60m', { reach: 2400, reactions: 95, comments: 26, shares: 20 });
    this.recordSnapshot('post_benchmark_001', '3h', { reach: 5200, reactions: 190, comments: 52, shares: 44 });
    this.recordSnapshot('post_benchmark_001', '24h', { reach: 7850, reactions: 285, comments: 74, shares: 62 });

    logAudit('BENCHMARK_POSTS_SEEDED', 'DISTRIBUTION', { count: benchmarks.length });
  }
}

module.exports = new DistributionMonitor();
