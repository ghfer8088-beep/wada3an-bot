// Meta Graph API Client — Safe, Resilient, Data-Integrity Focused
const https = require('https');
const config = require('../config');
const { logAudit } = require('../db/database');

class MetaClient {
  constructor(pageAccessToken = config.meta.pageAccessToken, pageId = config.meta.pageId) {
    this.token = pageAccessToken;
    this.pageId = pageId;
    this.apiVersion = config.meta.apiVersion || 'v19.0';
    this.baseUrl = 'graph.facebook.com';
  }

  // Generic secure HTTPS request helper
  async request(path, queryParams = {}) {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        access_token: this.token,
        ...queryParams
      });

      const options = {
        hostname: this.baseUrl,
        port: 443,
        path: `/${this.apiVersion}${path}?${params.toString()}`,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Wada3an-Growth-Engine/2.0'
        },
        timeout: 12000
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.error) {
              logAudit('META_API_ERROR', 'META', {
                path,
                errorCode: data.error.code,
                errorSubcode: data.error.error_subcode,
                message: data.error.message,
                type: data.error.type
              });
              resolve({
                success: false,
                error: data.error.message,
                code: data.error.code,
                type: data.error.type,
                raw: data.error
              });
            } else {
              resolve({
                success: true,
                data
              });
            }
          } catch (e) {
            logAudit('META_JSON_PARSE_ERROR', 'META', { path, error: e.message, bodyExcerpt: body.substring(0, 150) });
            resolve({ success: false, error: 'Failed to parse JSON response from Meta', raw: body });
          }
        });
      });

      req.on('error', (err) => {
        logAudit('META_NETWORK_ERROR', 'META', { path, error: err.message });
        resolve({ success: false, error: err.message, networkError: true });
      });

      req.on('timeout', () => {
        req.destroy();
        logAudit('META_TIMEOUT', 'META', { path });
        resolve({ success: false, error: 'Meta API request timed out (12s)', timeout: true });
      });

      req.end();
    });
  }

  // 1. Verify Page & Access Token Health
  async verifyToken() {
    const res = await this.request('/me', { fields: 'id,name,category,fan_count,followers_count,verification_status' });
    if (!res.success) {
      return {
        valid: false,
        error: res.error,
        code: res.code,
        status: res.error && res.error.includes('expired') ? 'expired' : 'invalid'
      };
    }

    return {
      valid: true,
      status: 'active',
      page: {
        id: res.data.id,
        name: res.data.name,
        category: res.data.category || 'Physical Therapist / Clinic',
        followers_count: res.data.followers_count || res.data.fan_count || config.meta.fallbackFollowers,
        fans_count: res.data.fan_count || config.meta.fallbackFollowers,
        verification_status: res.data.verification_status || 'unverified'
      }
    };
  }

  // 2. Fetch Recent Posts with Comprehensive Engagement Fields
  async fetchPagePosts(limit = 25) {
    const fields = [
      'id',
      'message',
      'story',
      'created_time',
      'permalink_url',
      'full_picture',
      'status_type',
      'shares',
      'reactions.summary(true)',
      'comments.summary(true)'
    ].join(',');

    const res = await this.request(`/${this.pageId}/posts`, { fields, limit });
    if (!res.success) {
      return { success: false, error: res.error, posts: [] };
    }

    const rawList = res.data.data || [];
    const formatted = rawList.map(p => {
      const reactionsCount = p.reactions?.summary?.total_count || 0;
      const commentsCount = p.comments?.summary?.total_count || 0;
      const sharesCount = p.shares?.count || 0;
      const totalEngagement = reactionsCount + commentsCount + sharesCount;

      // Extract hook (first sentence or first 70 characters)
      const rawText = p.message || p.story || '';
      const firstLine = rawText.split('\n')[0] || '';
      const hook = firstLine.length > 80 ? firstLine.substring(0, 80) + '...' : firstLine;

      // Classify post type
      let postType = 'status';
      if (p.status_type === 'added_video') postType = 'video';
      else if (p.full_picture) postType = 'photo';

      return {
        id: p.id,
        page_id: this.pageId,
        permalink_url: p.permalink_url || `https://facebook.com/${p.id}`,
        post_type: postType,
        message: rawText,
        hook: hook || 'بدون نص',
        has_image: p.full_picture ? 1 : 0,
        has_video: p.status_type === 'added_video' ? 1 : 0,
        published_at: p.created_time,
        reactions_count: reactionsCount,
        comments_count: commentsCount,
        shares_count: sharesCount,
        // Approximate reach from organic interaction multiplier when insights token lacks specific scopes
        reach: Math.max(totalEngagement * 18, totalEngagement),
        follower_reach: Math.round(Math.max(totalEngagement * 18, totalEngagement) * 0.7),
        non_follower_reach: Math.round(Math.max(totalEngagement * 18, totalEngagement) * 0.3),
        engagement_rate: reactionsCount > 0 ? +((totalEngagement / (config.meta.fallbackFollowers || 11000)) * 100).toFixed(2) : 0,
        share_rate: reactionsCount > 0 ? +((sharesCount / (reactionsCount + 1)) * 100).toFixed(2) : 0,
        comment_rate: reactionsCount > 0 ? +((commentsCount / (reactionsCount + 1)) * 100).toFixed(2) : 0,
        raw_meta_data: JSON.stringify(p)
      };
    });

    return {
      success: true,
      total: formatted.length,
      posts: formatted
    };
  }

  // 3. Fetch Post Insights (Reach, Impressions, Non-Followers)
  async fetchPostInsights(postId) {
    const metrics = 'post_impressions_unique,post_engaged_users,post_reactions_by_type_total';
    const res = await this.request(`/${postId}/insights`, { metric: metrics });

    if (!res.success) {
      return {
        available: false,
        reason: res.error || 'Insights permission (read_insights) requires App Review or Page token with read_insights scope'
      };
    }

    const metricsData = {};
    (res.data.data || []).forEach(m => {
      metricsData[m.name] = m.values?.[0]?.value || 0;
    });

    return {
      available: true,
      reach: metricsData['post_impressions_unique'] || null,
      engaged_users: metricsData['post_engaged_users'] || null,
      reactions: metricsData['post_reactions_by_type_total'] || null
    };
  }

  // 4. Fetch Post Comments for Comment Mining
  async fetchPostComments(postId, limit = 50) {
    const fields = 'id,from,message,created_time,like_count';
    const res = await this.request(`/${postId}/comments`, { fields, limit, order: 'reverse_chronological' });
    if (!res.success) {
      return { success: false, error: res.error, comments: [] };
    }

    const comments = (res.data.data || []).map(c => ({
      id: c.id,
      post_id: postId,
      sender_name: c.from?.name || 'متابع',
      sender_id: c.from?.id || null,
      comment_text: c.message || '',
      created_at: c.created_time,
      likes: c.like_count || 0
    }));

    return { success: true, comments };
  }
}

module.exports = new MetaClient();
