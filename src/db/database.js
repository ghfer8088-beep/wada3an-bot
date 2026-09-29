// Database Access Layer using Node.js built-in SQLite (node:sqlite)
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');

// Ensure data directory exists
const dbDir = path.dirname(config.db.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(config.db.path);
    // Enable foreign keys & WAL mode
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    initSchema();
  }
  return dbInstance;
}

function initSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    dbInstance.exec(schemaSql);
  }
  
  // Seed default page entry if not present
  const checkPage = dbInstance.prepare('SELECT id FROM pages WHERE id = ?').get(config.meta.pageId);
  if (!checkPage) {
    dbInstance.prepare(`
      INSERT INTO pages (id, name, username, followers_count, verification_status, access_token_status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      config.meta.pageId,
      config.clinic.name,
      config.meta.pageUsername,
      config.clinic.targetFollowers,
      'verified_clinic',
      'active'
    );
  }

  // Seed default content formats if empty
  const formatsCount = dbInstance.prepare('SELECT COUNT(*) as count FROM content_formats').get();
  if (formatsCount.count === 0) {
    const formats = [
      ['standard_post', 'منشور تفاعلي قياسي', '07:00 م - 09:30 م'],
      ['reel', 'فيديو ريلز قصير (Reel)', '08:00 م - 10:30 م'],
      ['story', 'قصة يومية (Story)', '12:00 م - 02:00 م'],
      ['carousel', 'إنفوجرافيك / ألبوم شرائح', '06:00 م - 08:30 م'],
      ['short_video', 'فيديو توعوي سريري', '07:30 م - 09:00 م'],
      ['question', 'سؤال مباشر للجمهور', '01:00 م - 04:00 م'],
      ['educational', 'مقال علمي مبسط (خرافة وحقيقة)', '08:00 ص - 10:00 ص'],
      ['follow_up', 'منشور متابعة واستشارة', '05:00 م - 07:00 م']
    ];
    const stmt = dbInstance.prepare('INSERT INTO content_formats (id, display_name, recommended_posting_window) VALUES (?, ?, ?)');
    for (const f of formats) {
      stmt.run(f[0], f[1], f[2]);
    }
  }
}

// Audit Logger Helper
function logAudit(action, category, details = '', status = 'SUCCESS', errorMessage = null) {
  try {
    const db = getDb();
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : String(details);
    db.prepare(`
      INSERT INTO audit_logs (action, category, details, status, error_message)
      VALUES (?, ?, ?, ?, ?)
    `).run(action, category, detailsStr, status, errorMessage);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// Export Database & DAOs
module.exports = {
  getDb,
  logAudit,
  
  // Pages
  pages: {
    get: (id) => getDb().prepare('SELECT * FROM pages WHERE id = ?').get(id),
    updateFollowers: (id, count) => getDb().prepare('UPDATE pages SET followers_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(count, id)
  },

  // Posts
  posts: {
    upsert: (post) => {
      const db = getDb();
      return db.prepare(`
        INSERT INTO posts (
          id, page_id, permalink_url, post_type, message, hook, topic, category,
          has_image, has_video, video_duration, published_at, reach, follower_reach,
          non_follower_reach, reactions_count, comments_count, shares_count, saves_count,
          video_views, watch_time_seconds, page_visits, new_followers,
          engagement_rate, share_rate, comment_rate, follower_conversion, non_follower_conversion,
          expansion_status, performance_tier, raw_meta_data, updated_at
        ) VALUES (
          @id, @page_id, @permalink_url, @post_type, @message, @hook, @topic, @category,
          @has_image, @has_video, @video_duration, @published_at, @reach, @follower_reach,
          @non_follower_reach, @reactions_count, @comments_count, @shares_count, @saves_count,
          @video_views, @watch_time_seconds, @page_visits, @new_followers,
          @engagement_rate, @share_rate, @comment_rate, @follower_conversion, @non_follower_conversion,
          @expansion_status, @performance_tier, @raw_meta_data, CURRENT_TIMESTAMP
        )
        ON CONFLICT(id) DO UPDATE SET
          reach = excluded.reach,
          follower_reach = excluded.follower_reach,
          non_follower_reach = excluded.non_follower_reach,
          reactions_count = excluded.reactions_count,
          comments_count = excluded.comments_count,
          shares_count = excluded.shares_count,
          saves_count = excluded.saves_count,
          engagement_rate = excluded.engagement_rate,
          share_rate = excluded.share_rate,
          comment_rate = excluded.comment_rate,
          expansion_status = excluded.expansion_status,
          performance_tier = excluded.performance_tier,
          updated_at = CURRENT_TIMESTAMP
      `).run(post);
    },
    getById: (id) => getDb().prepare('SELECT * FROM posts WHERE id = ?').get(id),
    list: (limit = 50, offset = 0) => getDb().prepare('SELECT * FROM posts ORDER BY published_at DESC LIMIT ? OFFSET ?').all(limit, offset),
    count: () => getDb().prepare('SELECT COUNT(*) as count FROM posts').get().count
  },

  // Snapshots
  snapshots: {
    add: (snapshot) => {
      const db = getDb();
      return db.prepare(`
        INSERT INTO post_snapshots (
          post_id, snapshot_window, minutes_since_publish, reach, follower_reach,
          non_follower_reach, reactions, comments, shares, saves, video_views,
          velocity_reach_per_hour, velocity_engagement_per_hour
        ) VALUES (
          @post_id, @snapshot_window, @minutes_since_publish, @reach, @follower_reach,
          @non_follower_reach, @reactions, @comments, @shares, @saves, @video_views,
          @velocity_reach_per_hour, @velocity_engagement_per_hour
        )
      `).run(snapshot);
    },
    getByPostId: (postId) => getDb().prepare('SELECT * FROM post_snapshots WHERE post_id = ? ORDER BY minutes_since_publish ASC').all(postId)
  },

  // Experiments
  experiments: {
    create: (exp) => {
      return getDb().prepare(`
        INSERT OR REPLACE INTO experiments (
          id, title, hypothesis, variable_isolated, control_description,
          variant_description, sample_size_target, status, start_date, end_date
        ) VALUES (
          @id, @title, @hypothesis, @variable_isolated, @control_description,
          @variant_description, @sample_size_target, @status, @start_date, @end_date
        )
      `).run(exp);
    },
    list: () => getDb().prepare('SELECT * FROM experiments ORDER BY created_at DESC').all(),
    getById: (id) => getDb().prepare('SELECT * FROM experiments WHERE id = ?').get(id),
    addResult: (res) => {
      return getDb().prepare(`
        INSERT INTO experiment_results (
          experiment_id, control_metric_value, variant_metric_value, metric_name,
          difference_percentage, confidence_level, conclusion, next_experiment_recommendation
        ) VALUES (
          @experiment_id, @control_metric_value, @variant_metric_value, @metric_name,
          @difference_percentage, @confidence_level, @conclusion, @next_experiment_recommendation
        )
      `).run(res);
    }
  },

  // Page Algorithm DNA
  dna: {
    saveRule: (rule) => {
      const sanitized = {
        page_id: rule.page_id,
        dna_key: rule.dna_key,
        dna_value: typeof rule.dna_value === 'string' ? rule.dna_value : JSON.stringify(rule.dna_value),
        evidence_type: rule.evidence_type || 'FACT',
        confidence_percentage: parseFloat(rule.confidence_percentage) || 0,
        sample_size: parseInt(rule.sample_size) || 0
      };
      return getDb().prepare(`
        INSERT INTO page_algorithm_dna (
          page_id, dna_key, dna_value, evidence_type, confidence_percentage, sample_size, last_evaluated_at
        ) VALUES (
          @page_id, @dna_key, @dna_value, @evidence_type, @confidence_percentage, @sample_size, CURRENT_TIMESTAMP
        )
      `).run(sanitized);
    },
    getAll: (pageId) => getDb().prepare('SELECT * FROM page_algorithm_dna WHERE page_id = ? ORDER BY last_evaluated_at DESC').all(pageId)
  },
  // Comments
  comments: {
    add: (c) => getDb().prepare(`
      INSERT INTO comments (
        id, post_id, sender_name, sender_id, comment_text, sentiment, is_question, extracted_problem
      ) VALUES (
        @id, @post_id, @sender_name, @sender_id, @comment_text, @sentiment, @is_question, @extracted_problem
      )
    `).run(c),
    list: (limit = 100) => getDb().prepare('SELECT * FROM comments ORDER BY created_at DESC LIMIT ?').all(limit)
  },

  // Ideas
  ideas: {
    create: (idea) => {
      const res = getDb().prepare(`
        INSERT INTO content_ideas (
          title, angle, target_audience, core_problem, curiosity_score, discussion_score,
          share_score, save_score, follower_conversion_score, non_follower_score,
          historical_similarity_note, status
        ) VALUES (
          @title, @angle, @target_audience, @core_problem, @curiosity_score, @discussion_score,
          @share_score, @save_score, @follower_conversion_score, @non_follower_score,
          @historical_similarity_note, @status
        )
      `).run(idea);
      return res.lastInsertRowid;
    },
    list: () => getDb().prepare('SELECT * FROM content_ideas ORDER BY created_at DESC').all()
  },

  // Notifications
  notifications: {
    create: (n) => {
      const res = getDb().prepare(`
        INSERT INTO notifications (
          user_id, notification_type, message, related_post_id
        ) VALUES (
          @user_id, @notification_type, @message, @related_post_id
        )
      `).run(n);
      return res.lastInsertRowid;
    },
    list: () => getDb().prepare('SELECT * FROM notifications ORDER BY created_at DESC').all()
  },

  // Audit Logs
  audit: {
    getRecent: (limit = 50) => getDb().prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?').all(limit)
  }
};

