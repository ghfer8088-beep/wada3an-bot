/**
 * Zero-Dependency Standalone Server for Meta Conversation Intelligence & Reactivation Engine
 * Runs out-of-the-box on native Node.js (v18+) without requiring npm install / external packages
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

const db = require('./src/intelligence/db');
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

  // 2. Intelligence REST API
  if (pathname === '/api/intelligence/dashboard' && method === 'GET') {
    const isDemo = query.is_demo !== undefined ? (query.is_demo === 'true') : null;
    const kpis = db.getDashboardKPIs(isDemo);
    return sendJson(res, 200, {
      success: true,
      data: kpis,
      meta_status: {
        page_id: config.clinic?.pageId || '30minutes30',
        clinic_name: config.clinic?.name || 'مركز وداعاً للألم',
        is_demo_mode: isDemo !== null ? isDemo : true
      }
    });
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
    const limit = parseInt(query.limit) || 30;
    const opps = db.getReactivationOpportunities(limit);
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
