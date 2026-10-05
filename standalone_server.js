/**
 * Zero-Dependency Standalone Server for Meta Conversation Intelligence & Reactivation Engine
 * Runs out-of-the-box on native Node.js (v18+) without requiring npm install / external packages
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

const db = require('./src/intelligence/db');
const opportunitiesEngine = require('./src/intelligence/opportunitiesEngine');
const MetaDiagnostic = require('./src/intelligence/metaDiagnostic');
const MessagingCompliance = require('./src/intelligence/complianceEngine');
const SyncEngine = require('./src/intelligence/syncEngine');
const config = require('./src/config');

const PORT = process.env.PORT || 3000;

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;
  const query = Object.fromEntries(reqUrl.searchParams.entries());
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // 1. Static UI Pages
  if (pathname === '/' || pathname === '/conversation-intelligence' || pathname === '/reactivation') {
    const htmlPath = path.join(__dirname, 'conversation_intelligence.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(htmlPath).pipe(res);
    }
  }

  if (pathname === '/viral-hub' || pathname === '/hub') {
    const htmlPath = path.join(__dirname, 'viral_hub.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(htmlPath).pipe(res);
    }
  }

  if (pathname === '/growth-engine' || pathname === '/metus' || pathname === '/suite') {
    const htmlPath = path.join(__dirname, 'growth_engine.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(htmlPath).pipe(res);
    }
  }

  if (pathname === '/spine-calculator' || pathname === '/spine-age' || pathname === '/calculator') {
    const htmlPath = path.join(__dirname, 'spine_age_calculator.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(htmlPath).pipe(res);
    }
  }

  // 2. Intelligence REST API
  if (pathname === '/api/intelligence/dashboard' && method === 'GET') {
    const isDemo = query.is_demo !== undefined ? (query.is_demo === 'true') : null;
    const kpis = db.getDashboardKPIs(isDemo);
    return sendJson(res, 200, {
      success: true,
      data: kpis,
      meta_status: {
        page_id: config.clinic?.pageId || '30minutes30',
        clinic_name: config.clinic?.name || 'وداعاً للألم',
        is_demo_mode: isDemo !== null ? isDemo : false
      }
    });
  }

  if (pathname === '/api/intelligence/transitions' && method === 'GET') {
    const transitions = db.getChronologicalTransitions();
    return sendJson(res, 200, { success: true, data: transitions });
  }

  if (pathname === '/api/intelligence/diagnostic' && method === 'GET') {
    const token = query.token || config.meta?.pageAccessToken;
    const pageId = query.page_id || config.meta?.pageId || '30minutes30';
    const isDemo = query.demo === 'true' || !token || token.startsWith('DEMO_') || token.startsWith('EAAW983');
    const diag = await MetaDiagnostic.runDiagnostics(pageId, token, isDemo);
    return sendJson(res, 200, { success: true, data: diag });
  }

  if (pathname === '/api/intelligence/conversations' && method === 'GET') {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 15;
    const filters = {
      search: query.search,
      lead_stage: query.lead_stage,
      intent: query.intent,
      source: query.source,
      recency: query.recency,
      min_score: query.min_score
    };
    const results = db.getConversations(filters, page, limit);
    return sendJson(res, 200, { success: true, ...results });
  }

  if (pathname.startsWith('/api/intelligence/conversations/') && method === 'GET') {
    const convId = pathname.split('/').pop();
    const details = db.getConversationDetails(convId);
    if (!details) return sendJson(res, 404, { success: false, error: 'المحادثة غير موجودة' });
    return sendJson(res, 200, { success: true, data: details });
  }

  if (pathname.startsWith('/api/intelligence/conversations/') && pathname.endsWith('/stage') && method === 'POST') {
    const parts = pathname.split('/');
    const convId = parts[parts.length - 2];
    const body = await parseBody(req);
    const success = db.updateLeadStage(convId, body.stage, body.user_name || 'المسؤول');
    return sendJson(res, 200, { success });
  }

  if (pathname.startsWith('/api/intelligence/conversations/') && pathname.endsWith('/override') && method === 'POST') {
    const parts = pathname.split('/');
    const convId = parts[parts.length - 2];
    const body = await parseBody(req);
    const success = db.updateManualOverride(convId, body.manual_stage, body.override_reason, body.user_name || 'المسؤول');
    return sendJson(res, 200, { success });
  }

  // ─── Reactivation & Conversion Opportunity Engine Routes ───
  if (pathname === '/api/intelligence/opportunities/pipeline' && method === 'GET') {
    const kpis = opportunitiesEngine.getOpportunityPipelineKPIs();
    return sendJson(res, 200, { success: true, data: kpis });
  }

  if (pathname === '/api/intelligence/opportunities' && method === 'GET') {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 25;
    const filters = {
      search: query.search,
      stage: query.stage,
      has_price: query.has_price,
      has_medical: query.has_medical,
      has_appt: query.has_appt,
      has_phone: query.has_phone,
      source: query.source
    };
    const sort = query.sort || 'richness';
    const result = opportunitiesEngine.getOpportunitiesList(filters, page, limit, sort);
    return sendJson(res, 200, { success: true, ...result });
  }

  if (pathname.startsWith('/api/intelligence/opportunities/') && pathname.endsWith('/update') && method === 'POST') {
    const parts = pathname.split('/');
    const oppId = parts[parts.length - 2];
    const body = await parseBody(req);
    const success = opportunitiesEngine.updateOpportunityRecord(oppId, body);
    return sendJson(res, 200, { success });
  }

  if (pathname.startsWith('/api/intelligence/opportunities/') && pathname.endsWith('/send') && method === 'POST') {
    const parts = pathname.split('/');
    const oppId = parts[parts.length - 2];
    const body = await parseBody(req);
    const detail = opportunitiesEngine.getOpportunityDetail(oppId);
    if (!detail) return sendJson(res, 404, { success: false, error: 'الفرصة غير موجودة' });

    const psid = (detail.opportunity.contact_id || '').replace('fb_', '');
    const messageText = body.message || detail.opportunity.custom_proposed_message || detail.opportunity.suggested_message;

    try {
      const https = require('node:https');
      const postData = JSON.stringify({
        recipient: { id: psid },
        message: { text: messageText }
      });
      const metaReq = https.request(`https://graph.facebook.com/v21.0/me/messages?access_token=${config.meta.pageAccessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, (metaRes) => {
        let raw = '';
        metaRes.on('data', chunk => raw += chunk);
        metaRes.on('end', () => {
          try {
            const metaJson = JSON.parse(raw);
            if (metaRes.statusCode === 200) {
              opportunitiesEngine.updateOpportunityRecord(oppId, { stage: 'تم التواصل', note: 'تم الإرسال آلياً عبر Meta API بنجاح' });
              return sendJson(res, 200, { success: true, meta_response: metaJson });
            } else {
              return sendJson(res, metaRes.statusCode, { success: false, error: metaJson.error?.message || 'خطأ من Meta', meta_error: metaJson.error });
            }
          } catch (e) {
            return sendJson(res, 500, { success: false, error: 'تعذر معالجة رد Meta' });
          }
        });
      });
      metaReq.on('error', (err) => {
        return sendJson(res, 500, { success: false, error: err.message });
      });
      metaReq.write(postData);
      metaReq.end();
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
    return;
  }

  // 3. Growth Engine & Stealth AI Generator
  if (pathname === '/api/growth-engine/generate-stealth-comment' && method === 'POST') {
    const body = await parseBody(req);
    const postText = body.post_text || '';
    const angle = body.angle || 'all';

    const comments = [
      {
        id: 1,
        type: 'تجربة شخصية واقعية (بحث مباشر عن الصفحة)',
        angle: 'story',
        text: 'والله يا جماعة الصحة وراحة البال نعمة ما بتتعوض.. والدي كان يعاني من نفس التعب ومشاكل الديسك وضغط الفقرات، وبعد حيرة وتجارب تابعنا "صفحة وداعاً للألم على الفيس بوك" وشوفنا تجارب الناس ورحنا على عيادتهم بخلدا، عمل جلسات علاج وسحب فقرات بدون أي عملية والحمد لله فرق السما عن الأرض هلا.. نصيحة من أختكم ابحثوا عنهم واستشيروهم وتمنياتي بالشفاء لكل مريض 🌸'
      },
      {
        id: 2,
        type: 'نصيحة توعوية وتوجيه للبحث في فيسبوك',
        angle: 'advice',
        text: 'كلام سليم بمكانه.. ضغوطات الحياة والجلوس الطويل بالشغل بتدمر العمود الفقري وإحنا مو منتبهين.. دايماً بنصح الناس لا يسكتوا على وجع الظهر وعرق النسا؛ في تقنيات حديثة بدون جراحة بينشروها بـ "صفحة وداعاً للألم على الفيس بوك" (موقعهم بخلدا)، شوفوا فيديوهاتهم ومعلوماتهم كثير بتفيد.. صحتكم أمانة وديروا بالكم على حالكم 🤲'
      },
      {
        id: 3,
        type: 'تفاعل اجتماعي راقٍ وإرشاد مباشر للبحث',
        angle: 'social',
        text: 'ما شاء الله كلام راقٍ وفي الصميم.. الله يديم العافية وراحة الجسد علينا جميعاً.. للي بيسألوا عن علاج آلام الظهر والانزلاق الغضروفي بدون جراحة، اكتبوا بالبحث "صفحة وداعاً للألم على الفيس بوك" (عيادتهم بخلدا) وبتلاقوا كل الفيديوهات والتفاصيل.. تحياتي الك ولأهلنا الكرام من عمّان الحبيبة 🌹'
      }
    ];

    return sendJson(res, 200, { success: true, comments });
  }

  // 3.1 Google Trends Jordan Endpoint (RSS Cache)
  if (pathname === '/api/growth-engine/google-trends-jordan' && method === 'GET') {
    const { execSync } = require('child_process');
    try {
      const xml = execSync('curl.exe -s -L "https://trends.google.com/trending/rss?geo=JO"', { encoding: 'utf8', timeout: 10000 });
      const trends = [];
      const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      itemMatches.forEach((m, idx) => {
        const block = m[1];
        const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
        const trafficMatch = block.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/);
        const pubDateMatch = block.match(/<pubDate>(.*?)<\/pubDate>/);
        const newsMatch = block.match(/<ht:news_item_title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/ht:news_item_title>/);
        if (titleMatch) {
          const tTitle = titleMatch[1].trim();
          trends.push({
            id: 'trend_jo_' + idx,
            title: tTitle,
            traffic: trafficMatch ? trafficMatch[1].trim() : 'نشط جداً',
            pubDate: pubDateMatch ? pubDateMatch[1].trim() : '',
            newsHeadline: newsMatch ? newsMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim() : '',
            fb_search_url: `https://www.facebook.com/search/posts/?q=${encodeURIComponent(tTitle)}&filters=rp_chrono:true`
          });
        }
      });
      return sendJson(res, 200, { success: true, country: 'JO', trends });
    } catch (err) {
      // Fallback curated active Jordan trends
      const fallbackTrends = [
        { id: 'f1', title: 'طقس الأردن وانخفاض درجات الحرارة', traffic: '10K+', newsHeadline: 'كتلة هوائية لطيفة تؤثر على المملكة', fb_search_url: 'https://www.facebook.com/search/posts/?q=%D8%B7%D9%82%D8%B3%20%D8%A7%D9%84%D8%A7%D8%B1%D8%AF%D9%86&filters=rp_chrono:true' },
        { id: 'f2', title: 'دوري المحترفين الأردني', traffic: '5K+', newsHeadline: 'مباريات الجولة الحاسمة في الدوري', fb_search_url: 'https://www.facebook.com/search/posts/?q=%D8%AF%D9%88%D8%B1%D9%8A%20%D8%A7%D9%84%D9%85%D8%AD%D8%AA%D8%B1%D9%81%D9%8A%D9%86%20%D8%A7%D9%84%D8%A7%D8%B1%D8%AF%D9%86%D9%8A&filters=rp_chrono:true' },
        { id: 'f3', title: 'فعاليات ونشاطات عمان', traffic: '2K+', newsHeadline: 'أبرز الفعاليات المجتمعية بالعاصمة عمان', fb_search_url: 'https://www.facebook.com/search/posts/?q=%D8%B9%D9%85%D8%A7%D9%86%20%D8%A7%D9%84%D8%A7%D8%B1%D8%AF%D9%86&filters=rp_chrono:true' }
      ];
      return sendJson(res, 200, { success: true, country: 'JO', trends: fallbackTrends });
    }
  }

  // 3.2 Meta Ads Library & Campaign Explorer
  if (pathname === '/api/growth-engine/meta-ads-library' && method === 'GET') {
    const campaigns = [
      {
        keyword: 'علاج طبيعي عمان',
        category: 'الصحة والعيادات',
        description: 'إعلانات وحملات مراكز العلاج الطبيعي والتأهيل في عمان',
        ads_library_url: 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=JO&q=%D8%B9%D9%84%D8%A7%D8%AC%20%D8%B7%D8%A8%D9%8A%D8%B9%D9%8A%20%D8%B9%D9%85%D8%A7%D9%86&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped'
      },
      {
        keyword: 'ديسك وعمود فقري الأردن',
        category: 'العمود الفقري والانزلاق',
        description: 'الحملات الأكثر ترويجاً لعلاج آلام الظهر والفقرات بالأردن',
        ads_library_url: 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=JO&q=%D8%AF%D9%8A%D8%B3%D9%83%20%D9%88%D8%B9%D9%85%D9%88%D8%AF%20%D9%81%D9%82%D8%B1%D9%8A&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped'
      },
      {
        keyword: 'عرق النسا بدون جراحة',
        category: 'الحالات العصبية',
        description: 'الإعلانات المستهدفة للمرضى الباحثين عن حلول بدون عمليات',
        ads_library_url: 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=JO&q=%D8%B9%D8%B1%D9%82%20%D8%A7%D9%84%D9%86%D8%B3%D8%A7&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped'
      },
      {
        keyword: 'عيادات خلدا وعمان الغربية',
        category: 'الموقع الجغرافي المستهدف',
        description: 'الإعلانات الممولة النشطة ضمن النطاق الجغرافي المباشر لخلدا',
        ads_library_url: 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=JO&q=%D8%B9%D9%8A%D8%A7%D8%AF%D8%A7%D8%AA%20%D8%AE%D9%84%D8%AF%D8%A7&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped'
      }
    ];
    return sendJson(res, 200, { success: true, country: 'JO', campaigns });
  }

  // 3.3 Jordan Sources & Hashtags Directory
  if (pathname === '/api/growth-engine/jordan-sources' && method === 'GET') {
    const data = {
      news_pages: [
        { name: 'رؤيا الإخباري (Roya News)', url: 'https://www.facebook.com/RoyaNews', followers: '6M+', note: 'أعلى تفاعل إخباري ولحظي في الأردن' },
        { name: 'قناة المملكة (Al Mamlaka TV)', url: 'https://www.facebook.com/AlMamlakaTV', followers: '3M+', note: 'تغطيات حية وتحقيقات محلية واسعة' },
        { name: 'موقع خبرني (Khaberni)', url: 'https://www.facebook.com/khaberni', followers: '2.5M+', note: 'أخبار مجتمعية سريعة وتفاعل شعبي كثيف' },
        { name: 'وكالة الأنباء الأردنية (بترا)', url: 'https://www.facebook.com/petranews', followers: '1M+', note: 'البيانات الرسمية والقرارات الحكومية' }
      ],
      groups: [
        { name: 'سكان وأهالي عمّان والخدمات', type: 'خدمات محلية', search_query: 'جروب سكان عمان' },
        { name: 'تجمع طلاب وخريجي الجامعات الأردنية', type: 'شبابي نشط', search_query: 'تجمع طلاب الجامعات الاردنية' },
        { name: 'وظائف وخدمات الأردن الكبرى', type: 'تفاعل مجتمعي', search_query: 'وظائف وخدمات الاردن' }
      ],
      hashtags: [
        { tag: 'الأردن', count: 'ملايين المنشورات', url: 'https://www.facebook.com/hashtag/الأردن' },
        { tag: 'عمان', count: 'تريند يومي', url: 'https://www.facebook.com/hashtag/عمان' },
        { tag: 'اخبار_الاردن', count: 'تفاعل لحظي', url: 'https://www.facebook.com/hashtag/اخبار_الاردن' },
        { tag: 'تريند_الاردن', count: 'أعلى وصول', url: 'https://www.facebook.com/hashtag/تريند_الاردن' },
        { tag: 'صحة_الاردن', count: 'جمهور مستهدف طبياً', url: 'https://www.facebook.com/hashtag/صحة_الاردن' }
      ]
    };
    return sendJson(res, 200, { success: true, data });
  }

  // 3.4 Live Multi-Account Registration & Sync
  if (pathname === '/api/growth-engine/register-active-account' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const dataDir = path.join(__dirname, 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      const accFile = path.join(dataDir, 'connected_accounts.json');
      let list = [];
      try {
        if (fs.existsSync(accFile)) list = JSON.parse(fs.readFileSync(accFile, 'utf8'));
      } catch (_) {}

      const uid = body.uid || ('uid_' + Date.now());
      let name = (body.name || '').trim();
      if (!name) name = 'حساب فيسبوك ' + uid.slice(-4);
      
      let role = body.role || 'support';
      let roleLabel = 'حساب داعم (تفاعل وإعجابات)';

      if (name.includes('وداعاً') || body.is_page) {
        role = 'clinic';
        roleLabel = 'الصفحة الرسمية (الرد والتأكيد بخلدا)';
      } else if (name.includes('هدى') || name.includes('Huda')) {
        role = 'inquirer';
        roleLabel = 'المتسائل (The Inquirer)';
      } else if (name.includes('رامي') || name.includes('عماد') || name.includes('ريم') || name.includes('غسان')) {
        role = 'booster';
        roleLabel = 'المُوصي والمُجرّب بخلدا (Social Proof)';
      }

      const accountObj = {
        id: 'acc_' + uid,
        uid: uid,
        name: name,
        avatar: body.avatar || `https://graph.facebook.com/${uid}/picture?type=large`,
        role: role,
        roleLabel: roleLabel,
        cookies: body.cookies || '',
        url: body.url || '',
        connectedAt: new Date().toISOString(),
        liveStatus: 'online'
      };

      const existingIdx = list.findIndex(a => a.uid === uid || a.name === name);
      if (existingIdx >= 0) {
        list[existingIdx] = { ...list[existingIdx], ...accountObj };
      } else {
        list.push(accountObj);
      }

      fs.writeFileSync(accFile, JSON.stringify(list, null, 2));
      return sendJson(res, 200, { success: true, account: accountObj, count: list.length });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 3.4 FB Groups Live Sync API (Per-Account Dynamic Architecture)
  if (pathname === '/api/growth-engine/sync-groups') {
    const accGroupsFile = path.join(__dirname, 'src', 'data', 'accounts_fb_groups.json');
    const groupsFile = path.join(__dirname, 'src', 'data', 'user_fb_groups.json');
    
    let accMap = {};
    try {
      if (fs.existsSync(accGroupsFile)) {
        accMap = JSON.parse(fs.readFileSync(accGroupsFile, 'utf8'));
      }
    } catch (_) {}

    if (method === 'GET') {
      try {
        const uid = query.uid || '100095020153634';
        let list = accMap[uid];
        if (!list) {
          if (fs.existsSync(groupsFile)) {
            list = JSON.parse(fs.readFileSync(groupsFile, 'utf8'));
          } else {
            list = [];
          }
        }
        return sendJson(res, 200, { success: true, uid, count: list.length, groups: list, accounts_map: accMap });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    if (method === 'POST') {
      try {
        const body = await parseBody(req);
        const incoming = Array.isArray(body.groups) ? body.groups : [];
        const uid = body.uid || query.uid || '100095020153634';
        if (incoming.length > 0) {
          accMap[uid] = incoming;
          const dir = path.join(__dirname, 'src', 'data');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(accGroupsFile, JSON.stringify(accMap, null, 2), 'utf8');
          fs.writeFileSync(groupsFile, JSON.stringify(incoming, null, 2), 'utf8');
          return sendJson(res, 200, { success: true, uid, count: incoming.length });
        }
        return sendJson(res, 400, { success: false, error: 'No groups provided' });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }
  }

  // 3.5 Record Live Comment Endpoint
  if (pathname === '/api/growth-engine/record-comment') {
    const commentsFile = path.join(__dirname, 'data', 'completed_comments.json');
    let list = [];
    try {
      if (fs.existsSync(commentsFile)) {
        list = JSON.parse(fs.readFileSync(commentsFile, 'utf8'));
      }
    } catch (_) {}

    if (method === 'GET') {
      return sendJson(res, 200, { success: true, count: list.length, comments: list });
    }

    if (method === 'POST') {
      try {
        const body = await parseBody(req);
        const record = {
          id: 'cm_' + Date.now(),
          groupId: body.groupId || body.group_id,
          groupName: body.groupName || body.group_name || 'مجموعة فيسبوك',
          postId: body.postId || body.post_id || null,
          permalinkUrl: body.permalinkUrl || body.permalink_url,
          commentText: body.commentText || body.comment_text,
          uid: body.uid || '100095020153634',
          timestamp: new Date().toISOString()
        };
        list.unshift(record);
        if (list.length > 200) list = list.slice(0, 200);
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(commentsFile, JSON.stringify(list, null, 2), 'utf8');
        return sendJson(res, 200, { success: true, record });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }
  }

  if (pathname === '/sync-fb-groups' && method === 'GET') {
    // Bookmarklet callback
    try {
      if (query.data) {
        const raw = Buffer.from(query.data, 'base64').toString('utf8');
        const groups = JSON.parse(raw);
        const groupsFile = path.join(__dirname, 'src', 'data', 'user_fb_groups.json');
        fs.writeFileSync(groupsFile, JSON.stringify(groups, null, 2), 'utf8');
      }
    } catch (_) {}
    res.writeHead(302, { 'Location': '/growth-engine' });
    return res.end();
  }

  if (pathname === '/connect-account' && method === 'GET') {
    const uid = query.uid || ('uid_' + Date.now());
    let name = (query.name || '').trim();
    if (!name) name = 'حساب فيسبوك ' + uid.slice(-4);

    let role = 'support';
    let roleLabel = 'حساب داعم (تفاعل وإعجابات)';

    if (name.includes('وداعاً') || query.is_page) {
      role = 'clinic';
      roleLabel = 'الصفحة الرسمية (الرد والتأكيد بخلدا)';
    } else if (name.includes('هدى') || name.includes('Huda')) {
      role = 'inquirer';
      roleLabel = 'المتسائل (The Inquirer)';
    } else if (name.includes('رامي') || name.includes('عماد') || name.includes('ريم') || name.includes('غسان')) {
      role = 'booster';
      roleLabel = 'المُوصي والمُجرّب بخلدا (Social Proof)';
    }

    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const accFile = path.join(dataDir, 'connected_accounts.json');
    let list = [];
    try {
      if (fs.existsSync(accFile)) list = JSON.parse(fs.readFileSync(accFile, 'utf8'));
    } catch (_) {}

    const accountObj = {
      id: 'acc_' + uid,
      uid: uid,
      name: name,
      avatar: `https://graph.facebook.com/${uid}/picture?type=large`,
      role: role,
      roleLabel: roleLabel,
      connectedAt: new Date().toISOString(),
      liveStatus: 'online'
    };

    const existingIdx = list.findIndex(a => a.uid === uid || a.name === name);
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...accountObj };
    } else {
      list.push(accountObj);
    }

    fs.writeFileSync(accFile, JSON.stringify(list, null, 2));

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>تم ربط الحساب بنجاح</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0fdf4; color: #166534; text-align: center; }
          .box { background: white; padding: 28px 36px; border-radius: 14px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border: 2px solid #86efac; max-width: 380px; }
        </style>
      </head>
      <body>
        <div class="box">
          <div style="font-size: 38px; margin-bottom: 8px;">🎉</div>
          <h2 style="margin: 0 0 10px; font-size: 20px; color: #059669;">تم ربط الحساب بنجاح!</h2>
          <div style="font-size: 15px; font-weight: 800; color: #1f2937; margin-bottom: 6px;">👤 ${name}</div>
          <div style="font-size: 12px; font-weight: 700; color: #2563eb; background: rgba(37,99,235,0.1); padding: 4px 10px; border-radius: 20px; display: inline-block; margin-bottom: 14px;">🎯 الدور: ${roleLabel}</div>
          <div style="font-size: 11px; color: #9ca3af;">سيتم إغلاق هذه النافذة تلقائياً والعودة لفيسبوك...</div>
        </div>
        <script>
          setTimeout(() => { window.close(); }, 1500);
        </script>
      </body>
      </html>
    `);
  }

  if (pathname === '/api/growth-engine/live-accounts' && method === 'GET') {
    const accFile = path.join(__dirname, 'data', 'connected_accounts.json');
    let list = [];
    try {
      if (fs.existsSync(accFile)) list = JSON.parse(fs.readFileSync(accFile, 'utf8'));
    } catch (_) {}
    return sendJson(res, 200, { success: true, count: list.length, accounts: list });
  }

  if (pathname === '/api/growth-engine/detected-chrome-accounts' && method === 'GET') {
    try {
      const localStatePath = path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', 'Local State');
      let accounts = [];
      if (fs.existsSync(localStatePath)) {
        const stateData = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
        const infoCache = stateData.profile && stateData.profile.info_cache ? stateData.profile.info_cache : {};
        
        let counter = 1;
        for (const [dir, pInfo] of Object.entries(infoCache)) {
          const rawName = pInfo.name || pInfo.gaia_name || dir;
          const email = pInfo.user_name || '';
          
          // Determine realistic role based on profile name and context
          let role = 'support';
          let roleLabel = 'حساب داعم (تفاعل وإعجابات)';
          let cleanName = rawName;

          if (rawName.includes('Huda') || rawName.includes('هدى')) {
            role = 'inquirer';
            roleLabel = 'المتسائل (The Inquirer)';
            cleanName = 'هدى فارس (Huda Fares)';
          } else if (rawName.includes('وداعاً') || dir === 'Default') {
            role = 'clinic';
            roleLabel = 'الصفحة الرسمية (الرد والتأكيد بخلدا)';
            cleanName = 'صفحة وداعاً للألم - خلدا';
          } else if (rawName.includes('رامي')) {
            role = 'booster';
            roleLabel = 'المُوصي والمُجرّب بخلدا (Social Proof)';
            cleanName = 'رامي العبدالله';
          } else if (rawName.includes('Abu Ali') || rawName.includes('عماد') || rawName.includes('Imod')) {
            role = 'booster';
            roleLabel = 'المُوصي الثاني (تجربة حقيقية)';
            cleanName = 'عماد (أبو علي)';
          } else if (rawName.includes('Reem') || rawName.includes('ريم')) {
            role = 'booster';
            roleLabel = 'المُوصي الثالث (سيدة متعافية)';
            cleanName = 'ريم عباس (Reem Abbas)';
          } else if (rawName.includes('غسان')) {
            role = 'booster';
            roleLabel = 'مراجع سابق مُشيد بالنتائج';
            cleanName = 'غسان حوراني';
          } else if (rawName.includes('نهى')) {
            role = 'support';
            roleLabel = 'مراجعة متفاعلة وداعمة';
            cleanName = 'نهى سلامة';
          } else if (rawName.includes('Ducaneh') || rawName.includes('Nasreen') || rawName.includes('نسرين')) {
            role = 'support';
            roleLabel = 'حساب داعم وتفاعل';
            cleanName = 'نسرين (Ducaneh)';
          } else if (rawName.includes('Sabreen') || rawName.includes('صابرين') || rawName.includes('دنيا')) {
            role = 'support';
            roleLabel = 'حساب داعم وتفاعل';
            cleanName = 'صابرين (Sabreen)';
          } else if (rawName.includes('قاسم') || rawName.includes('Qassim')) {
            role = 'support';
            roleLabel = 'حساب داعم وتفاعل';
            cleanName = 'قاسم عبدالسلام';
          } else if (rawName.includes('thaer') || rawName.includes('ثائر')) {
            role = 'support';
            roleLabel = 'حساب داعم وتفاعل';
            cleanName = 'ثائر جمال';
          }

          accounts.push({
            id: 'chrome_' + dir.toLowerCase().replace(/\s+/g, '_'),
            profileDir: dir,
            name: cleanName,
            email: email,
            role: role,
            roleLabel: roleLabel,
            isChromeProfile: true
          });
          counter++;
        }
      }

      // Ensure key personas are prioritized at the top
      accounts.sort((a, b) => {
        const order = { 'inquirer': 1, 'booster': 2, 'clinic': 3, 'support': 4 };
        return (order[a.role] || 99) - (order[b.role] || 99);
      });

      return sendJson(res, 200, { success: true, count: accounts.length, accounts });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 8-Account Dynamic Multi-Persona Dialogue & Execution Engine
  let activeRoleSwapPlan = null;

  if (pathname === '/api/growth-engine/multi-account-dialogue' && method === 'POST') {
    const body = await parseBody(req);
    const postTopic = (body.topic || 'علاج الديسك وآلام العمود الفقري بدون جراحة').trim();
    const postUrl = (body.post_url || '').trim();
    const snippet = (body.snippet || '').trim();

    // Load actual connected user accounts
    const accFile = path.join(__dirname, 'data', 'connected_accounts.json');
    let connectedAccounts = [];
    try {
      if (fs.existsSync(accFile)) connectedAccounts = JSON.parse(fs.readFileSync(accFile, 'utf8'));
    } catch (_) {}

    if (connectedAccounts.length === 0) {
      connectedAccounts = [
        { id: '1', name: 'Huda Faris', role: 'inquirer', roleLabel: 'المتسائل الأول (The Inquirer)' },
        { id: '2', name: 'رامي العبدالله', role: 'booster', roleLabel: 'المُوصي والمُجرّب بخلدا (Social Proof 1)' },
        { id: '3', name: 'Reem Abbas', role: 'booster', roleLabel: 'سيدة متعافية ومُوصية (Social Proof 2)' },
        { id: '4', name: 'Nesreen Waleed', role: 'support', roleLabel: 'حساب داعم ومستفسر إضافي' },
        { id: '5', name: 'Donia Mohmmad', role: 'support', roleLabel: 'حساب داعم ومساند' },
        { id: '6', name: 'عبدالعزيز الحسن', role: 'support', roleLabel: 'حساب داعم ومستفسر عن المواعيد' },
        { id: '7', name: 'رانيا فاخوري', role: 'support', roleLabel: 'حساب داعم وتفاعل إضافي' },
        { id: '8', name: 'وداعاً للألم', role: 'clinic', roleLabel: 'الصفحة الرسمية (الرد والتأكيد بخلدا)' }
      ];
    }

    // Dynamic Topic Detection Engine
    const combined = `${postTopic} ${snippet} ${postUrl}`.toLowerCase();

    let theme = 'disc_spine';
    let strategyName = 'سيمفونية التفاعل الكاملة: علاج الديسك والفقرات بدون جراحة';
    let objective = 'إشعال ثريد نقاشي حي يشارك فيه جميع حساباتك الثمانية المربوطة لإجبار فيسبوك على رفع المنشور لآلاف المتابعين';

    if (combined.includes('أداة') || combined.includes('فحص') || combined.includes('تشخيص') || combined.includes('حاسبة') || combined.includes('تقييم') || combined.includes('اختبار') || combined.includes('tool') || combined.includes('pfbid05gzlfssibr')) {
      theme = 'diagnostic_tool';
      strategyName = '🎯 سيناريو تنشيط أداة الفحص والتقييم الذاتي لآلام العمود الفقري';
      objective = 'تشجيع المتابعين على تجربة أداة الفحص الذاتي وتأكيد مصداقيتها عبر تجارب المتعافين لتوجيههم لحجز كشف فوري بعيادة خلدا';
    } else if (combined.includes('/videos/') || combined.includes('/reel/') || combined.includes('فيديو') || combined.includes('ريلز') || combined.includes('مقطع') || combined.includes('433626975581953')) {
      theme = 'video_explainer';
      strategyName = '🎥 سيناريو تنشيط الفيديو التوضيحي وبدائل التدخل الجراحي';
      objective = 'تعزيز مصداقية الفيديو وشرح أجهزة تفريغ الضغط وتأكيد نجاحها العملي لإنهاء تردد المرضى المتخوفين من العمليات وتثبيت البراغي';
    } else if (combined.includes('عرق النسا') || combined.includes('النسا') || combined.includes('خدران') || combined.includes('تنميل') || combined.includes('العصب الوركي') || combined.includes('pfbid03727hdu')) {
      theme = 'sciatica_nerve';
      strategyName = '⚡ سيناريو تنشيط إرشادات علاج عرق النسا وخدران الساقين';
      objective = 'طرح معاناة خدران وتنميل مسار العصب الوركي وإثبات علاج المشكلة بدون إبر كورتيزون وبدون جراحة في عيادة خلدا';
    } else if (combined.includes('ركبة') || combined.includes('ركب') || combined.includes('مفاصل') || combined.includes('احتكاك') || combined.includes('خشونة') || combined.includes('صابونة') || combined.includes('صعود الدرج')) {
      theme = 'knees_joints';
      strategyName = '🦵 سيناريو تنشيط علاج احتكاك وخشونة مفاصل الركبة';
      objective = 'معالجة مخاوف المرضى من عمليات تبديل المفصل وتأكيد إمكانية المشي وصعود الدرج بحرية عبر البروتوكول التحفظي بخلدا';
    } else if (combined.includes('رقبة') || combined.includes('عنق') || combined.includes('كتف') || combined.includes('أكتاف') || combined.includes('صداع') || combined.includes('الأبهر')) {
      theme = 'neck_cervical';
      strategyName = '💆 سيناريو تنشيط علاج ديسك وتشنج الرقبة والأكتاف والصداع';
      objective = 'إبراز التحسن السريع لآلام الرقبة وتنميل اليدين المزعج بدون مسكنات عبر أجهزة التمديد الميكانيكي بخلدا';
    } else if (postTopic && postTopic !== 'علاج الديسك وآلام العمود الفقري بدون جراحة' && postTopic.length > 5) {
      theme = 'custom_adaptive';
      strategyName = `🎯 سيناريو تنشيط مخصص: ${postTopic.slice(0, 45)}...`;
      objective = `بناء حوار اجتماعي ذكي مصاغ خصيصاً لمحتوى هذا المنشور وتوجيه المتابعين لعيادة وداعاً للألم بخلدا`;
    }

    // Dynamic tailored content for each category
    const contentMap = {
      diagnostic_tool: {
        inq: `يعطيكم العافية دكتور.. أنا دخلت على أداة الفحص الذاتي وطلعت النتيجة عندي اشتباه انزلاق غضروفي بالفقرات القطنية L4-L5 والشد واصل للرجل.. هل نتيجة الأداة كافية وإلا بتنصحوني أجيب صورة الرنين وأراجعكم بالعيادة بخلدا للكشف الدقيق؟`,
        b1: `أختي هدى أنا عملت الفحص على نفس الأداة قبل أسبوعين وكانت نتيجتي ضغط عصب قطني، أخذت صورة الرنين ورحت على عيادة وداعاً للألم بخلدا عند الدكتور.. طلع تشخيص الأداة دقيق جداً وبدأت معهم جلسات سحب ضغط الفقرات والحمد لله التحسن ملحوظ من أول 3 جلسات وبدون أي جراحة! احجزي وما تترددي 🌸`,
        b2: `أداة الفحص خطوة ممتازة صراحة بتوفر حيرة وتوتر كبير.. وأنا لما راجعتهم بخلدا الدكتور شرحلي كل التفاصيل برحابة صدر والأجهزة عندهم مريحة جداً للسيدات وبتفرق عن أي علاج تقليدي.. بالتوفيق للجميع.`,
        s1: `هل الأداة بتشمل كمان فحص وتحديد مشاكل احتكاك مفاصل الركبة وصعوبة صعود الدرج؟ حابة والدتي تجربها قبل ما نجيبها على العيادة بخلدا.`,
        s2: `فكرة الأداة التفاعلية فكرة عبقرية ومفيدة جداً للمرضى.. الله يجزيكم الخير عيادة وداعاً للألم بخلدا دايماً سباقين بالحلول المبتكرة وتسهيل الأمور على الناس 🤲`,
        s3: `يعطيكم العافية.. بعد ما عملت الفحص الذاتي بالأداة، كيف طريقة حجز الموعد عندكم بالعيادة بخلدا؟ هل يلزم حجز مسبق قبل ما أجي من المحافظات؟`,
        s4: `ما شاء الله جهود جبارة.. جربت الأداة وأعطتني توضيح رائع للأعراض، رح أتواصل معكم لحجز موعد استشارة ومعاينة إن شاء الله 🌹`,
        clinic: `أهلاً بكم جميعاً وسلامتكم ألف سلامة 🌹 نعم، أداة التقييم الذاتي صُممت لمساعدتكم في فهم شدة الأعراض وتوجيهكم للمسار الصحيح، لكنها خطوة استرشادية أولى يليها الفحص السريري المباشر ومراجعة صورة الرنين المغناطيسي (MRI) لتحديد البروتوكول الأنسب لحالتكم بدون أي جراحة. يسعدنا تشريفكم في عيادتنا الكائنة في: عمّان - خلدا. تفضلوا بالتواصل معنا عبر رسائل الصفحة أو الاتصال على 0790360440 لحجز موعد المعاينة، ونتمنى لكم دوام الصحة والعافية.`
      },
      video_explainer: {
        inq: `دكتور بالفيديو شرحت طريقة تفريغ ضغط الفقرات واستعادة مرونة الغضاريف.. والدتي عمرها ٥٨ سنة وعندها تضيق بالقناة الشوكية وانزلاق غضروفي والدكاترة خوفونا وحكوا لازم عملية تثبيت براغي وهي خايفة جداً.. هل الشرح بالفيديو بينطبق على حالتها وممكن تتحسن عندكم بدون أي تدخل جراحي وبكم جلسة؟`,
        b1: `أخت هدى، الشرح بالفيديو حقيقي ومطبق على أرض الواقع 100%.. أنا شخصياً شفت فيديوهاتهم ورحت على عيادة وداعاً للألم بخلدا، كنت مقرر عملية انزلاق غضروفي قطني، وبفضل الله بعد جلسات تفريغ الضغط اللي بالفيديو رجعت لحياتي وشغلي طبيعي وبدون أي عملية.. أنصحكم تراجعوهم فوراً وتتوكلوا على الله.`,
        b2: `الفيديو بيشرح تماماً التقنية اللي تعالجت فيها عندهم بخلدا.. كان عندي ديسك بالرقبة وصداع مستمر، وبفضل الأجهزة المتقدمة عندهم راح الضغط عن العصب من الجلسات الأولى وبراحة تامة للسيدات وبدون أدوية.. الفيديو كافي ووافي.`,
        s1: `الشرح بالفيديو مبسط ومطمئن جداً الله يجزيكم الخير دكتور.. هل نفس أجهزة وتقنيات تفريغ الضغط بالفيديو بتعالج كمان احتكاك وخشونة الركبة وصوت الطقطقة؟`,
        s2: `أسلوب علمي ومقنع جداً بالفيديو.. الله يبارك بعلمكم وبجهود عيادة وداعاً للألم بخلدا دايماً بتعطوا أمل حقيقي للمرضى بعيداً عن العمليات الجراحية 🌹`,
        s3: `شرح ممتاز دكتور بالفيديو.. بخصوص جلسات الأجهزة، كم مدة الجلسة تقريباً؟ وهل المريض بيقدر يرجع لبيته ويسوق سيارته مباشرة بعد الجلسة؟`,
        s4: `تسلم الأيادي دكتور على هذا التوضيح.. كثير محتاجين مثل هيك فيديوهات توعوية لنتجنب العمليات. رح أشارك الفيديو مع كل العائلة.`,
        clinic: `أهلاً بكم جميعاً وسلامتكم ألف سلامة 🌹 الهدف من هذا الفيديو هو توضيح كيف تنجح تقنيات تفريغ الضغط الميكانيكي واستعدال الفقرات في سحب الغضروف بعيداً عن الأعصاب، وهو ما يغني أكثر من 90% من المرضى عن الجراحة وتثبيت البراغي تماماً وبدون أي فترة نقاهة. نرحب بكم لمعاينة الحالة وصور الرنين في عيادتنا: عمّان - خلدا. تفضلوا بالتواصل معنا لحجز موعدكم على 0790360440 أو عبر رسائل الصفحة.`
      },
      sciatica_nerve: {
        inq: `يعطيكم العافية دكتور.. الإرشادات بالمنشور ممتازة، بس أنا الألم عندي بيبدأ من أسفل الظهر وبيمتد للفخذ والبطة مع خدران وتنميل بأصابع القدم وما بقدر أوقف 10 دقائق على بعضها.. هل هاد عرق نسا مؤكد وبيروح مع جلسات العيادة بدون إبر كورتيزون؟`,
        b1: `هذا عرق نسا ومضغوط العصب الوركي 100% مثل ما كان عندي تماماً.. كنت ما أقدر أنام ولا أسوق السيارة من الخدران والكهربا بالرجل. راجعت عيادة وداعاً للألم بخلدا ومن أول كورس جلسات تفريغ ضغط راح التنميل ورجع العصب لحالته الطبيعية بدون كورتيزون وبدون جراحة.. بنصحك تراجعيهم بخلدا بأسرع وقت.`,
        b2: `فعلاً وجع عرق النسا لا يحتمل وما حدا بحس فيه إلا اللي جربه.. الدكتور عندهم بخلدا بيفحص مسار العصب بدقة ويعطيك خطة علاج واضحة بدون أدوية كيماوية مرهقة للمعدة.. أنا تحسنت عندهم بنسبة 95% والحمد لله.`,
        s1: `هل التمارين المذكورة بالمنشور آمنة لأي شخص وإلا لازم فحص صورة الرنين أولاً عشان نتأكد من عدم وجود انزلاق غضروفي حاد؟`,
        s2: `الله يشفي كل مريض يا رب.. عرق النسا بهدّ الحيل، بس الحمد لله عيادة وداعاً للألم بخلدا معروفين بخبرتهم وتخفيف الألم من الجلسات الأولى 🤲`,
        s3: `لو سمحتوا هل موقع العيادة بخلدا قريب من دوار خلدا والبنك العربي؟ وهل متوفر مصفات سيارات للمرضى اللي بصعوبة بيمشوا؟`,
        s4: `منشور مفيد جداً.. والدتي بتعاني من نفس الخدران برجليها، رح أزوركم بخلدا معها قريباً بإذن الله.`,
        clinic: `أهلاً بكم جميعاً ونسأل الله لكم دوام العافية 🌹 آلام عرق النسا وخدران الساقين ناتجة عن انضغاط جذر العصب الوركي بسبب ديسك أو شد عضلي عميق في منطقة الحوض، وبروتوكولنا غير الجراحي يركز على سحب الضغط الميكانيكي وتحرير العصب ليعود التروية الدموية بدون أي إبر كورتيزون أو جراحة. يسعدنا استقبالكم في عيادتنا: عمّان - خلدا. تفضلوا بالتواصل معنا لحجز الاستشارة على 0790360440 أو عبر الرسائل.`
      },
      knees_joints: {
        inq: `دكتور يعطيكم العافية.. عندي خشونة واحتكاك بالركبة من الدرجة الثالثة والدكتور حكى لازم تبديل مفصل كامل وأنا متخوفة جداً من العملية ومضاعفاتها.. هل في أمل يتحسن المفصل وأرجع أمشي طبيعي بدون تبديل المفصل في عيادتكم بخلدا؟`,
        b1: `أختي والدتي كانت بنفس الوضع تماماً وصعوبة شديدة بصعود الدرج وأصوات طقطقة، راجعنا عيادة وداعاً للألم بخلدا وعملت كورس إعادة تأهيل وتخفيف احتكاك بدون أي عملية.. والحمد لله هسا بتمشي وتقضي مشاويرها براحة تامة.. احجزي لوالدتك وما تتأخري.`,
        b2: `بروتوكول الركبة والمفاصل عندهم ممتاز جداً ومريح.. بيعالجوا جذر المشكلة والالتهاب بدون ما يدخلوك بمتاهة العمليات والتبديل.. تجربة بتستحق كل الاحترام.`,
        s1: `هل الكورس بيتطلب فترات راحة طويلة بعد الجلسات وإلا المريض بيمارس حياته اليومية بشكل طبيعي؟`,
        s2: `ألف سلامة للجميع.. عيادة وداعاً للألم بخلدا سمعتهم ممتازة جداً ومشهود لهم بالأمانة الطبية 🤲`,
        s3: `لو سمحتوا هل يلزم إحضار صور أشعة عادية للركبة أم رنين مغناطيسي عند الحضور للعيادة بخلدا؟`,
        s4: `شكراً على طرح هذه الحلول البديلة.. كثير كبار سن بحاجة لتجنب العمليات.`,
        clinic: `أهلاً بكم جميعاً ونسأل الله الشفاء التام 🌹 خشونة واحتكاك مفاصل الركبة يمكن التعامل معها بنجاح كبير في أغلب الحالات من خلال تحسين التروية المفصلية، تقوية العضلات الداعمة، واستعادة المسافة المفصلية بتقنيات غير جراحية متطورة لتجنب استبدال المفصل قدر الإمكان. نرحب بكم في عيادتنا: عمّان - خلدا. للحجز والاستفسار يرجى التواصل عبر رسائل الصفحة أو الاتصال على 0790360440.`
      },
      neck_cervical: {
        inq: `مساء الخير دكتور.. عندي ألم شديد ومستمر بالرقبة ممتد للكتف الأيمن مع تنميل بأطراف الأصابع وصداع بأسفل الرأس، هل هذا ديسك عنقي وبيروح بجلسات سحب الضغط بدون مسكنات؟`,
        b1: `أختي أنا عانيت من نفس أعراض ديسك الرقبة وتنميل اليدين والكتف لأكثر من سنة، راجعت عيادة وداعاً للألم بخلدا وعملت كورس جلسات تفريغ ضغط الفقرات العنقية والحمد لله راح الصداع والتنميل تماماً بدون أي دواء!`,
        b2: `علاج الرقبة عندهم مريح جداً ومتقن، بيحددوا موقع الانضغاط بالملي ويفرغوا الضغط عن العصب.. بنصح كل حدا متألم يراجعهم بخلدا.`,
        s1: `هل الجلوس الطويل والمكتبي بيأثر على نتائج الجلسات وإلا بتعطوا إرشادات وتمارين وقائية؟`,
        s2: `عيادة وداعاً للألم بخلدا متميزين جداً بأمانتهم وتشخيصهم الدقيق، الله يباركلكم دايماً 🤲`,
        s3: `هل يلزم حجز مسبق قبل القدوم للعيادة بخلدا؟ وما هي أوقات الدوام؟`,
        s4: `معلومات قيمة جداً.. رح أحجز موعد فحص للرقبة قريباً إن شاء الله.`,
        clinic: `أهلاً بكم جميعاً وسلامتكم ألف سلامة 🌹 آلام الرقبة وتنميل الأيدي ناتجة في الغالب عن انزلاق غضروفي عنقي أو تشنج عضلي يضغط على الجذور العصبية، وتقنياتنا في عيادة وداعاً للألم بخلدا تركز على إعادة استقامة الفقرات وتخفيف الضغط العصبي تماماً بدون جراحة. تفضلوا بحجز موعد الكشف عبر رسائل الصفحة أو الاتصال على 0790360440.`
      },
      disc_spine: {
        inq: `مساء الخير دكتور.. المنشور بيوضح علاج الانزلاق الغضروفي بدون جراحة. هل البروتوكول بيصلح لديسك الفقرات الرقبية اللي مسبب وجع بالأكتاف وتنميل باليدين، وإلا فقط للفقرات القطنية وأسفل الظهر؟`,
        b1: `مساء الورد أخت هدى، البروتوكول عندهم مخصص للرقبة ولأسفل الظهر على حد سواء.. أنا كان عندي ديسك قطني وزميلي بالشغل راح عندهم بخلدا عشان ديسك الرقبة وتنميل إيده، والاثنين تحسنا بفضل الله بدون عمليات.. أجهزتهم حديثة ومدروسة جداً.`,
        b2: `أنا جربت علاج ديسك الرقبة عندهم بخلدا! كنت أصحى بالليل من وجع كتفي وإيدي، والحمد لله فرق السما عن الأرض بعد الجلسات بدون مسكنات.. بنصح أي حدا بيعاني من الديسك يزورهم بخلدا قبل التفكير بأي عملية.`,
        s1: `هل في حالات ديسك متقدمة راجعتكم وكانت مقررة عملية وتحسنت تماماً بالعيادة؟ بتمنى تطمنونا عشان نشجع المرضى المترددين.`,
        s2: `عيادة وداعاً للألم بخلدا عنوان للثقة والأمانة الطبية.. الله يوفقكم دايماً ويبارك بجهودكم بعلاج المرضى 🤲`,
        s3: `استفسار بخصوص مواعيد العيادة بخلدا: هل تفتحون بالفترة المسائية بعد انتهاء أوقات الدوام الرسمي؟`,
        s4: `شكراً على هذا التوضيح.. منشوراتكم دايماً بتبعث التفاؤل والراحة.`,
        clinic: `أهلاً وسهلاً بكم جميعاً 🌹 نعم بكل تأكيد، بروتوكولاتنا غير الجراحية مصممة لعلاج انزلاق غضاريف الرقبة (الفقرات العنقية) وأسفل الظهر (الفقرات القطنية)، عبر تقنيات تفريغ الضغط التدريجي وتحفيز التئام الغضروف وتخفيف الضغط العصبي. عيادتنا في خدمتكم في: عمّان - خلدا. تفضلوا بحجز موعد الاستشارة وفحص صورة الرنين عبر رسائل الصفحة أو هاتفياً على 0790360440.`
      },
      custom_adaptive: {
        inq: `يعطيكم العافية دكتور.. بخصوص الموضوع المطروح بالمنشور (${postTopic})، الوالد بيعاني من أعراض مشابهة جداً وتعب مستمر، هل في إمكانية يتعالج بدون جراحة وبكم جلسة بيبدأ يشعر بالفرق؟`,
        b1: `أنا حبيت أرد من واقع تجربة شخصية.. عانيت من نفس المشكلة وراجعت عيادة وداعاً للألم بخلدا، الدكتور كشف وعملت جلسات علاج وتأهيل بدون أي عملية والحمد لله التحسن كان ممتاز جداً.. بنصحكم تحجزوا موعد وتتوكلوا على الله.`,
        b2: `فعلاً كلام الأخ رامي بمكانه 100%.. تعاملهم بالعيادة في خلدا راقٍ جداً والأجهزة مريحة ومناسبة للسيدات وبتغني عن الأدوية والعمليات.. بنصح الكل يجربهم.`,
        s1: `هل العلاج بالعيادة مناسب لكبار السن اللي عندهم أمراض مزمنة مثل الضغط والسكري؟`,
        s2: `ما شاء الله تبارك الرحمن.. عيادة وداعاً للألم بخلدا معروفين بأمانتهم وتميزهم، ربنا يبارك بجهودكم ويشفي كل مريض 🤲`,
        s3: `لو سمحتوا موقع العيادة بخلدا وين بالضبط، وهل لازم حجز مسبق قبل الزيارة؟`,
        s4: `شكراً جزيلاً على هذه المعلومات القيمة والتوعية المستمرة 🌸`,
        clinic: `أهلاً بكم جميعاً وسلامتكم ألف سلامة 🌹 نعم بفضل الله تعالى نعتمد في عيادة وداعاً للألم - خلدا أحدث البروتوكولات الطبية غير الجراحية لعلاج آلام العمود الفقري، الانزلاق الغضروفي، والمفاصل بدون أي تداخل جراحي وبأعلى معايير الأمان. يسعدنا استقبالكم في عيادتنا: عمّان - خلدا. لحجز موعد الكشف والاستشارة يرجى التواصل معنا عبر رسائل الصفحة أو الاتصال على 0790360440.`
      }
    };

    const selectedContent = contentMap[theme] || contentMap.disc_spine;

    // Assign specific rich roles to all connected accounts
    const steps = [];
    let stepCounter = 1;

    // 1. Primary Inquirer (e.g. Huda)
    const inqAcc = connectedAccounts.find(a => a.role === 'inquirer') || connectedAccounts[0];
    steps.push({
      step: stepCounter++,
      account_id: inqAcc.id,
      account_name: inqAcc.name,
      account_uid: inqAcc.uid || '',
      role_title: `الخطوة 1: ${inqAcc.name} - طرح السؤال الحقيقي المشوق (The Inquirer)`,
      action: 'طرح استفسار طبي واقعي يجذب القراء ويشعل ثريد النقاش حول موضوع المنشور',
      delay_seconds: 0,
      timing_note: 'يُنشر أولاً بمجرد بدء التنشيط',
      comment_text: selectedContent.inq
    });

    // 2. Primary Booster (e.g. Rami)
    const booster1 = connectedAccounts.find(a => a.role === 'booster' && a.id !== inqAcc.id) || connectedAccounts[1] || connectedAccounts[0];
    steps.push({
      step: stepCounter++,
      account_id: booster1.id,
      account_name: booster1.name,
      account_uid: booster1.uid || '',
      role_title: `الخطوة 2: ${booster1.name} - الرد بتجربة شخصية مؤكدة بخلدا (Social Proof)`,
      action: `رد مباشر (Reply) على تعليق ${inqAcc.name} ومشاركة قصة الشفاء بدون جراحة`,
      delay_seconds: 180,
      timing_note: 'انتظر 2-3 دقائق، ضع لايك لتعليق هدى ثم انشر هذا الرد',
      comment_text: selectedContent.b1
    });

    // 3. Secondary Booster (e.g. Reem Abbas)
    const booster2 = connectedAccounts.find(a => a.id !== inqAcc.id && a.id !== booster1.id && (a.role === 'booster' || a.name.includes('Reem') || a.name.includes('ريم'))) || connectedAccounts[2];
    if (booster2 && booster2.id !== booster1.id && booster2.id !== inqAcc.id) {
      steps.push({
        step: stepCounter++,
        account_id: booster2.id,
        account_name: booster2.name,
        account_uid: booster2.uid || '',
        role_title: `الخطوة 3: ${booster2.name} - شهادة سيدة متعافية ودعم للتوصية`,
        action: 'تأكيد راحة السيدات والأجهزة المتقدمة بالعيادة لإزالة تردد المتابعات',
        delay_seconds: 300,
        timing_note: 'بعد 3-5 دقائق من رد رامي، ضع لايك وتعليق مساند',
        comment_text: selectedContent.b2
      });
    }

    // 4. Supportive Accounts (Nesreen / Donia / Abdulaziz / Rania / Others)
    const supportAccs = connectedAccounts.filter(a => a.id !== inqAcc.id && a.id !== booster1.id && (!booster2 || a.id !== booster2.id) && a.role !== 'clinic');
    const supportTexts = [selectedContent.s1, selectedContent.s2, selectedContent.s3, selectedContent.s4];
    const supportActions = [
      'توسيع نطاق التفاعل ليسأل عن الحالات المماثلة أو كبار السن لتشجيع مرضى آخرين',
      'إشادة بأمانة العيادة والدعاء بالشفاء لتعزيز المصداقية الشعبية للمنشور',
      'سؤال عملي عن الحجز وموقع العيادة بخلدا لتشجيع القراء على أخذ خطوة الحجز',
      'تفاعل إضافي وإشادة بالطرح الطبي لتغذية خوارزميات فيسبوك'
    ];

    supportAccs.forEach((supAcc, sIdx) => {
      const text = supportTexts[sIdx % supportTexts.length];
      const actionDesc = supportActions[sIdx % supportActions.length];
      steps.push({
        step: stepCounter++,
        account_id: supAcc.id,
        account_name: supAcc.name,
        account_uid: supAcc.uid || '',
        role_title: `الخطوة ${stepCounter - 1}: ${supAcc.name} - حساب داعم ومساند (${supAcc.roleLabel || 'دعم وتفاعل'})`,
        action: actionDesc,
        delay_seconds: 360 + (sIdx * 60),
        timing_note: `تعليق تفاعلي ومساند بعد ${sIdx + 5} دقائق`,
        comment_text: text
      });
    });

    // 5. Official Clinic Page (The Grand Closer)
    const clinicAcc = connectedAccounts.find(a => a.role === 'clinic' || a.name.includes('وداعاً')) || { id: 'clinic_official', name: 'صفحة وداعاً للألم - خلدا', uid: '102533574608295' };
    steps.push({
      step: stepCounter++,
      account_id: clinicAcc.id || 'clinic_official',
      account_name: clinicAcc.name,
      account_uid: clinicAcc.uid || '',
      role_title: `الخطوة الأخيرة: ${clinicAcc.name} - الرد الطبي الرسمي الموثق والتوجيه لخلدا`,
      action: 'الرد على جميع المتسائلين، توضيح الحلول الطبية بدون جراحة، ودعوة للحجز بخلدا',
      delay_seconds: 660,
      timing_note: 'الرد الرسمي الخاتم للحوار لغلق دائرة الثقة وتوجيه المتابعين للتواصل',
      comment_text: selectedContent.clinic
    });

    const plan = {
      strategy_name: strategyName,
      objective: objective,
      theme: theme,
      post_url: postUrl,
      steps: steps,
      algorithmic_tips: [
        '💡 عند تتابع تعليقات هدى ورامي وريم ونسرين، تصنف خوارزميات Meta المنشور كـ Meaningful Social Interaction فائق الأهمية.',
        '👍 قيام كل حساب بوضع لايك لتعليق الحساب السابق يرفع نسبة بقاء الثريد في أعلى التعليقات (Top Comments).',
        '🎯 استخدم زر "نسخ النص" السريع ثم افتح المنشور وأنت داخل متصفح الحساب المطلوب والصق التعليق فوراً.'
      ]
    };

    activeRoleSwapPlan = plan;

    // Persist active plan
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'active_role_plan.json'), JSON.stringify(plan, null, 2));

    return sendJson(res, 200, { success: true, plan });
  }

  // Get Role Task for Active Browser Session (Used by 1-Click Executor Bookmarklet)
  if (pathname === '/api/growth-engine/get-role-task' && method === 'GET') {
    const uid = (query.uid || '').trim();
    let name = (query.name || '').trim();
    const url = (query.url || '').trim();

    const planFile = path.join(__dirname, 'data', 'active_role_plan.json');
    let plan = activeRoleSwapPlan;
    if (!plan && fs.existsSync(planFile)) {
      try { plan = JSON.parse(fs.readFileSync(planFile, 'utf8')); } catch (_) {}
    }

    if (!plan || !plan.steps || plan.steps.length === 0) {
      return sendJson(res, 200, {
        success: false,
        message: 'يرجى فتح استوديو تبادل الأدوار في لوحة التحكم وتوليد السيناريو أولاً قبل الضغط على الزر.'
      });
    }

    // Match step by UID or Account Name
    let matchedStep = plan.steps.find(s => (uid && s.account_uid === uid) || (name && s.account_name && (name.includes(s.account_name) || s.account_name.includes(name))));

    // If not matched directly, check if it's the clinic page
    if (!matchedStep && (name.includes('وداعاً') || name.includes('30minutes30'))) {
      matchedStep = plan.steps.find(s => s.role_title.includes('الصفحة') || s.account_name.includes('وداعاً'));
    }

    // Fallback: match first unexecuted step or step 1
    if (!matchedStep) {
      const execFile = path.join(__dirname, 'data', 'role_executions.json');
      let execs = [];
      try { if (fs.existsSync(execFile)) execs = JSON.parse(fs.readFileSync(execFile, 'utf8')); } catch(_) {}
      matchedStep = plan.steps.find(s => !execs.some(e => e.step === s.step)) || plan.steps[0];
    }

    return sendJson(res, 200, {
      success: true,
      task: {
        step: matchedStep.step,
        accountId: matchedStep.account_id,
        accountName: matchedStep.account_name,
        roleLabel: matchedStep.role_title,
        text: matchedStep.comment_text,
        action: matchedStep.action
      }
    });
  }

  // Mark Role Step Executed on Facebook
  if (pathname === '/api/growth-engine/mark-role-executed' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const dataDir = path.join(__dirname, 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      const execFile = path.join(dataDir, 'role_executions.json');

      let execs = [];
      try { if (fs.existsSync(execFile)) execs = JSON.parse(fs.readFileSync(execFile, 'utf8')); } catch(_) {}

      const record = {
        step: body.step,
        uid: body.uid || '',
        name: body.name || '',
        post_url: body.post_url || '',
        timestamp: new Date().toISOString()
      };

      execs = execs.filter(e => !(e.step === body.step && e.post_url === body.post_url));
      execs.push(record);
      fs.writeFileSync(execFile, JSON.stringify(execs, null, 2));

      return sendJson(res, 200, { success: true, record });
    } catch(err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // Get Live Role Executions Status
  if (pathname === '/api/growth-engine/role-executions-status' && method === 'GET') {
    const postUrl = (query.url || '').trim();
    const execFile = path.join(__dirname, 'data', 'role_executions.json');
    let execs = [];
    try { if (fs.existsSync(execFile)) execs = JSON.parse(fs.readFileSync(execFile, 'utf8')); } catch(_) {}

    if (postUrl) {
      execs = execs.filter(e => e.post_url && e.post_url.includes(postUrl.split('?')[0]));
    }

    return sendJson(res, 200, { success: true, executions: execs });
  }

  // Import Real Page Posts from User's Facebook Page Tab
  if (pathname === '/import-page-posts' && method === 'GET') {
    try {
      const rawData = query.data || '[]';
      const parsed = JSON.parse(rawData);
      const dataDir = path.join(__dirname, 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      const file = path.join(dataDir, 'my_page_posts.json');
      
      let existing = [];
      try {
        if (fs.existsSync(file)) existing = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (_) {}

      parsed.forEach((p, idx) => {
        if (!existing.some(e => e.url === p.url)) {
          const cCount = typeof p.commentCount === 'number' ? p.commentCount : (p.commentCount ? parseInt(p.commentCount, 10) : 0);
          const rCount = typeof p.reactionCount === 'number' ? p.reactionCount : (p.reactionCount ? parseInt(p.reactionCount, 10) : 0);
          const isWeak = cCount < 10;
          existing.unshift({
            id: 'real_post_' + Date.now() + '_' + idx,
            type: p.url.includes('/reel/') ? 'reel' : (p.url.includes('/videos/') ? 'video' : 'post'),
            group_name: 'صفحة وداعاً للألم - خلدا',
            title: (p.title && p.title.trim().length > 3) ? p.title.trim() : 'منشور صفحة وداعاً للألم',
            snippet: p.snippet || p.title || 'منشور حقيقي من صفحة وداعاً للألم',
            url: p.url,
            commentCount: cCount,
            reactionCount: rCount,
            engagement: `💬 ${cCount} تعليق • 👍 ${rCount} تفاعل ${isWeak ? '(يحتاج تنشيط وتبادل أدوار ⚠️)' : '(تفاعل نشط 🔥)'}`,
            published_at: 'منشور حقيقي من صفحتك',
            needs_revitalization: isWeak,
            suggested_angle: 'role_swap'
          });
        }
      });

      fs.writeFileSync(file, JSON.stringify(existing, null, 2));

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
          <meta charset="utf-8">
          <title>تم سحب منشورات صفحتك بنجاح</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0fdf4; color: #166534; text-align: center; }
            .box { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 14px rgba(0,0,0,0.08); border: 1px solid #86efac; max-width: 360px; }
          </style>
        </head>
        <body>
          <div class="box">
            <div style="font-size: 32px; margin-bottom: 8px;">🎉</div>
            <h2 style="margin: 0 0 8px; color: #059669; font-size: 18px;">تم سحب منشورات صفحتك الحقيقية!</h2>
            <p style="margin: 0 0 10px; font-weight: bold;">تمت إضافة ${parsed.length} منشورات حقيقية من صفحتك للأداة.</p>
            <p style="font-size: 11px; color: #6b7280; margin: 0;">سيتم إغلاق هذه النافذة تلقائياً...</p>
          </div>
          <script>setTimeout(() => window.close(), 1400);</script>
        </body>
        </html>
      `);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // Save Full Account Session Vault
  if (pathname === '/api/growth-engine/save-full-account-session' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const dataDir = path.join(__dirname, 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      const vaultFile = path.join(dataDir, 'sessions_vault.json');
      let vault = [];
      try { if (fs.existsSync(vaultFile)) vault = JSON.parse(fs.readFileSync(vaultFile, 'utf8')); } catch (_) {}
      
      const existingIdx = vault.findIndex(v => v.uid === body.uid || v.name === body.name);
      if (existingIdx >= 0) {
        vault[existingIdx] = { ...vault[existingIdx], ...body, lastUpdated: new Date().toISOString() };
      } else {
        vault.push({ ...body, lastUpdated: new Date().toISOString() });
      }
      fs.writeFileSync(vaultFile, JSON.stringify(vault, null, 2));

      // Also ensure connected_accounts.json is updated
      const accFile = path.join(dataDir, 'connected_accounts.json');
      let accs = [];
      try { if (fs.existsSync(accFile)) accs = JSON.parse(fs.readFileSync(accFile, 'utf8')); } catch(_) {}
      const aIdx = accs.findIndex(a => a.uid === body.uid || a.name === body.name);
      if (aIdx >= 0) {
        accs[aIdx] = { ...accs[aIdx], uid: body.uid, name: body.name };
      } else {
        accs.push({ id: String(Date.now()), uid: body.uid, name: body.name, role: 'booster' });
      }
      fs.writeFileSync(accFile, JSON.stringify(accs, null, 2));

      return sendJson(res, 200, { success: true, count: vault.length });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // Get All Account Sessions Vault
  if (pathname === '/api/growth-engine/get-all-sessions' && method === 'GET') {
    const vaultFile = path.join(__dirname, 'data', 'sessions_vault.json');
    let vault = [];
    try { if (fs.existsSync(vaultFile)) vault = JSON.parse(fs.readFileSync(vaultFile, 'utf8')); } catch (_) {}
    return sendJson(res, 200, { success: true, sessions: vault });
  }

  // Save Custom Targeted Post from Page
  if (pathname === '/api/growth-engine/save-custom-page-post' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const postUrl = (body.url || '').trim();
      const postTitle = (body.title || 'منشور مستهدف من صفحة وداعاً للألم').trim();
      if (!postUrl) return sendJson(res, 400, { success: false, error: 'URL required' });

      const dataDir = path.join(__dirname, 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      const file = path.join(dataDir, 'my_page_posts.json');

      let existing = [];
      try {
        if (fs.existsSync(file)) existing = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (_) {}

      const customPost = {
        id: 'post_custom_' + Date.now(),
        type: postUrl.includes('/reel/') ? 'reel' : 'post',
        group_name: 'صفحة وداعاً للألم - خلدا',
        title: postTitle,
        snippet: 'منشور مستهدف مباشرة من صفحة وداعاً للألم - خلدا للتنشيط وتبادل الأدوار.',
        url: postUrl,
        commentCount: 2,
        reactionCount: 6,
        engagement: '💬 يحتاج تنشيط وتبادل أدوار ⚠️',
        published_at: 'منشور مستهدف من صفحتك',
        needs_revitalization: true,
        suggested_angle: 'role_swap'
      };

      existing.unshift(customPost);
      fs.writeFileSync(file, JSON.stringify(existing, null, 2));
      return sendJson(res, 200, { success: true, post: customPost });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (pathname === '/api/growth-engine/radar-posts' && method === 'GET') {
    const sourceType = query.source || 'my_page';
    if (sourceType === 'weak_posts' || sourceType === 'my_page') {
      const pageFile = path.join(__dirname, 'data', 'my_page_posts.json');
      let pagePosts = [];
      try {
        if (fs.existsSync(pageFile)) pagePosts = JSON.parse(fs.readFileSync(pageFile, 'utf8'));
      } catch (_) {}

      return sendJson(res, 200, { success: true, source: sourceType, posts: pagePosts });
    } else {
      const trendingPosts = [
        {
          id: 'trend_reel_01',
          type: 'reel',
          group_name: 'منشور ريلز إخباري ومجتمعي أردني',
          title: '🎬 ريلز منشور مباشر: تقلبات الطقس وبرودة الأجواء في الأردن وتأثيرها على آلام العظام والديسك',
          snippet: 'مقطع ريلز مباشر يفتح المنشور نفسه؛ يتحدث عن تأثير تيارات الهواء الباردة على تشنج العضلات وتجدد آلام الفقرات.',
          url: 'https://www.facebook.com/reel/479118901511883/',
          engagement: '🔥 ترند مباشر • آلاف المشاهدات والتعليقات',
          published_at: 'منشور مباشر نشط (أقل من 24 ساعة)',
          suggested_angle: 'advice'
        },
        {
          id: 'trend_reel_02',
          type: 'reel',
          group_name: 'منشور ريلز مجتمعي في الأردن',
          title: '🎬 ريلز منشور مباشر: ساعات الجلوس المكتبي والإرهاق الجسدي لرواد الأعمال والموظفين',
          snippet: 'مقطع مباشر يفتح المنشور مباشرة ويناقش مشاكل الرقبة والكتفين نتيجة العمل المستمر خلف المكاتب.',
          url: 'https://www.facebook.com/reel/519870333520825/',
          engagement: '🔥 نقاش وتفاعل قوي على المنشور نفسه',
          published_at: 'منشور مباشر نشط',
          suggested_angle: 'story'
        },
        {
          id: 'trend_reel_03',
          type: 'reel',
          group_name: 'منشور ريلز صحي وتوعوي',
          title: '🎬 ريلز منشور مباشر: العادات اليومية الخاطئة التي تدمر غضاريف الظهر دون أن نشعر',
          snippet: 'مقطع توعوي سريع يفتح المنشور نفسه مباشرة؛ يتناول حمل الأوزان بطريقة خاطئة وتأثيرها المباشر على الانزلاق الغضروفي.',
          url: 'https://www.facebook.com/reel/976601400398582/',
          engagement: '🎯 فرصة استهداف ذهبية • تفاعل نوعي',
          published_at: 'منشور مباشر نشط',
          suggested_angle: 'advice'
        },
        {
          id: 'trend_reel_04',
          type: 'reel',
          group_name: 'منشور ريلز محلي في عمّان',
          title: '🎬 ريلز منشور مباشر: يوميات أهالي وسكان عمّان ومواقف الزحام والشد العصبي والجسدي',
          snippet: 'مقطع ريلز رائج يفتح المنشور مباشرة؛ حصد آلاف التفاعلات من سكان مختلف أحياء العاصمة.',
          url: 'https://www.facebook.com/reel/710671784609139/',
          engagement: '🚀 تفاعل واسع ومباشر على المنشور',
          published_at: 'منشور مباشر نشط',
          suggested_angle: 'social'
        },
        {
          id: 'trend_reel_05',
          type: 'reel',
          group_name: 'منشور ريلز شبابي ورائج في الأردن',
          title: '🎬 ريلز منشور مباشر: لما يبدأ وجع أسفل الظهر في سن مبكرة بسبب الجلوس وقلة المشي',
          snippet: 'مقطع ريلز فكاهي واقعي واسع الانتشار يشارك فيه المعلقون تجاربهم مع آلام المفاصل والديسك.',
          url: 'https://www.facebook.com/reel/694867002170171/',
          engagement: '🔥 مئات التعليقات المباشرة على المنشور',
          published_at: 'منشور مباشر نشط',
          suggested_angle: 'story'
        },
        {
          id: 'trend_reel_06',
          type: 'reel',
          group_name: 'منشور ريلز حواري ومجتمعي',
          title: '🎬 ريلز منشور مباشر: استفسارات المتابعين حول أفضل الحلول الطبيعية لتخفيف آلام عرق النسا',
          snippet: 'مقطع مباشر يفتح المنشور ذاته؛ يجمع استفسارات أشخاص يعانون من ألم يمتد من أسفل الظهر إلى الساق.',
          url: 'https://www.facebook.com/reel/976417680873900/',
          engagement: '🎯 فرصة استهداف مباشرة لعملاء محتملين',
          published_at: 'منشور مباشر نشط',
          suggested_angle: 'story'
        },
        {
          id: 'trend_video_erem',
          type: 'video',
          group_name: 'منشور فيديو إخباري مجتمعي (إرم نيوز)',
          title: '🎥 فيديو منشور مباشر: تقرير عن صحة الأسرة والنشاط الحركي والوقاية من تآكل المفاصل',
          snippet: 'رابط فيديو مباشر يفتح المنشور نفسه؛ إرشادات حول تجنب تآكل غضاريف الركبة والحوض لكبار السن.',
          url: 'https://www.facebook.com/watch/EremNewsME/527044774750195/',
          engagement: '🔥 تفاعل وتعليقات نشطة ومباشرة',
          published_at: 'منشور فيديو مباشر',
          suggested_angle: 'advice'
        },
        {
          id: 'trend_video_amman_streets',
          type: 'video',
          group_name: 'منشور فيديو - شوارع العاصمة عمّان',
          title: '🎥 فيديو منشور مباشر: جولة في شوارع وأحياء غرب عمّان واحتفالات المواطنين',
          snippet: 'رابط فيديو مباشر يفتح المنشور نفسه؛ تفاعل ومشاركات كثيفة من أهالي غرب عمّان وصويلح وخلدا.',
          url: 'https://www.facebook.com/AJA.HKJordan/videos/1677869526719473/',
          engagement: '🔥 آلاف المشاهدات والتعليقات من سكان عمّان',
          published_at: 'منشور فيديو مباشر',
          suggested_angle: 'social'
        },
        {
          id: 'trend_video_heritage',
          type: 'video',
          group_name: 'منشور فيديو - أرشيف المجتمع الأردني',
          title: '🎥 فيديو منشور مباشر: لقاء حول الحياة اليومية والنشاط البدني الطبيعي لأهالي الأردن',
          snippet: 'رابط فيديو مباشر يفتح المنشور نفسه؛ يسترجع عادات الحركة اليومية والوقاية من خمول العصر الحديث.',
          url: 'https://www.facebook.com/JordanTv.Archive/videos/700198326278426/',
          engagement: '👍 تفاعل وتعليقات عائلية راقية',
          published_at: 'منشور فيديو مباشر',
          suggested_angle: 'social'
        },
        {
          id: 'trend_reel_wada3an_ref',
          type: 'reel',
          group_name: 'منشور ريلز ترويجي نشط في الأردن',
          title: '🎬 ريلز منشور مباشر: التخلص من ضغط الفقرات وتشنج عضلات الظهر بتقنيات غير جراحية',
          snippet: 'مقطع ريلز مباشر تم اختباره بنجاح على فيسبوك ويفتح المنشور نفسه فوراً للتعليق عليه.',
          url: 'https://www.facebook.com/reel/1581822053505841/',
          engagement: '🔥 تفاعل مؤكد ومختبر 100%',
          published_at: 'منشور مباشر نشط',
          suggested_angle: 'story'
        }
      ];
      return sendJson(res, 200, { success: true, source: 'trending', posts: trendingPosts });
    }
  }

  if (pathname.startsWith('/api/intelligence/opportunities/') && method === 'GET') {
    const oppId = pathname.split('/').pop();
    const result = opportunitiesEngine.getOpportunityDetail(oppId);
    if (!result) return sendJson(res, 404, { success: false, error: 'الفرصة غير موجودة' });
    return sendJson(res, 200, { success: true, data: result });
  }

  if (pathname === '/api/intelligence/audit/metrics' && method === 'GET') {
    const catalog = db.getMetricsCatalog();
    const changeLogs = db.getMetricChangeLogs();
    return sendJson(res, 200, { success: true, catalog, changeLogs });
  }

  if (pathname === '/api/intelligence/audit/logs' && method === 'GET') {
    const logs = db.getDb().prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').all();
    return sendJson(res, 200, { success: true, count: logs.length, data: logs });
  }

  if (pathname === '/api/intelligence/audit/conversions' && method === 'GET') {
    const ids = [
      't_1822597454958128', 't_1063602851266624', 't_122240524886089091',
      't_10160709551607513', 't_1311237532578661', 't_2367325373404378',
      't_1261548031868995', 't_666798251193414', 't_1083642796521775',
      't_2969998906624985', 't_932713525075767', 't_259024363578409',
      't_1832524767142887', 't_1724820887984016'
    ];
    const cases = ids.map(id => db.getConversationDetails(id)).filter(Boolean);
    return sendJson(res, 200, { success: true, count: cases.length, cases });
  }

  if (pathname === '/api/intelligence/conversations/bulk/stage' && method === 'POST') {
    const body = await parseBody(req);
    const count = db.bulkUpdateStage(body.ids || [], body.stage, body.user_name || 'المسؤول');
    return sendJson(res, 200, { success: true, updated_count: count });
  }

  if (pathname === '/api/intelligence/conversations/bulk/label' && method === 'POST') {
    const body = await parseBody(req);
    const count = db.bulkAddLabel(body.ids || [], body.label_id);
    return sendJson(res, 200, { success: true, applied_count: count });
  }

  if (pathname === '/api/intelligence/reactivations' && method === 'GET') {
    const limit = parseInt(query.limit) || 500;
    const tier = query.tier || null;
    const opps = db.getReactivationOpportunities(tier, limit);
    return sendJson(res, 200, { success: true, count: opps.length, data: opps });
  }

  if (pathname === '/api/intelligence/lost-leads' && method === 'GET') {
    const limit = parseInt(query.limit) || 30;
    const lost = db.getLostLeads(limit);
    return sendJson(res, 200, { success: true, count: lost.length, data: lost });
  }

  if (pathname === '/api/intelligence/compliance/check' && method === 'POST') {
    const body = await parseBody(req);
    const details = db.getConversationDetails(body.conversation_id);
    if (!details) return sendJson(res, 404, { success: false, error: 'المحادثة غير موجودة' });

    const userMsgs = details.messages.filter(m => !m.is_from_page && m.sender_type !== 'page');
    const lastUserTimestamp = userMsgs[userMsgs.length - 1]?.timestamp || details.conversation.last_message_at;

    const compliance = MessagingCompliance.evaluateOutboundCompliance(
      details.conversation,
      lastUserTimestamp,
      body.proposed_tag
    );
    return sendJson(res, 200, { success: true, data: compliance });
  }

  if (pathname === '/api/intelligence/followup/propose' && method === 'POST') {
    const body = await parseBody(req);
    const details = db.getConversationDetails(body.conversation_id);
    if (!details) return sendJson(res, 404, { success: false, error: 'المحادثة غير موجودة' });

    const userMsgs = details.messages.filter(m => !m.is_from_page && m.sender_type !== 'page');
    const lastUserTimestamp = userMsgs[userMsgs.length - 1]?.timestamp || details.conversation.last_message_at;

    const compliance = MessagingCompliance.evaluateOutboundCompliance(
      details.conversation,
      lastUserTimestamp,
      body.proposed_tag
    );

    const dbInst = db.getDb();
    const followupId = `flw_${Date.now()}`;
    dbInst.prepare(`
      INSERT INTO followups (
        id, conversation_id, type, status, proposed_message,
        policy_check_status, policy_reason
      ) VALUES (?, ?, 'reactivation', 'pending_approval', ?, ?, ?)
    `).run(
      followupId,
      body.conversation_id,
      body.proposed_message,
      compliance.status,
      compliance.reason
    );

    return sendJson(res, 200, {
      success: true,
      followup_id: followupId,
      compliance
    });
  }

  if (pathname === '/api/intelligence/export' && method === 'GET') {
    const format = query.format || 'json';
    const convs = db.getConversations({}, 1, 1000);

    if (format === 'csv') {
      const headers = ['المعرف', 'الاسم', 'الهاتف', 'المصدر', 'المرحلة', 'النية', 'الدرجة', 'آخر رسالة', 'الملخص'];
      const rows = convs.data.map(c => [
        c.id,
        `"${c.contact_name}"`,
        c.contact_phone || '',
        c.source,
        c.lead_stage,
        c.intent,
        c.opportunity_score,
        c.last_message_at,
        `"${(c.summary || '').replace(/"/g, '""')}"`
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="meta_conversations_export.csv"'
      });
      return res.end(csvContent);
    }

    return sendJson(res, 200, { success: true, count: convs.total, data: convs.data });
  }

  if (pathname === '/api/intelligence/import/json' && method === 'POST') {
    const body = await parseBody(req);
    const records = body.records;
    if (!Array.isArray(records)) {
      return sendJson(res, 400, { success: false, error: 'يجب أن يكون المدخل مصفوفة records صالحة' });
    }
    const result = await SyncEngine.importParsedRecords(records, body.source_name || 'استيراد يدوي');
    return sendJson(res, 200, { success: true, stats: result });
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found');
});

server.listen(PORT, () => {
  console.log(`🚀 Meta Conversation Intelligence Server running at http://localhost:${PORT}/conversation-intelligence`);
});
