/**
 * Express REST API Routes for Meta Conversation Intelligence & Reactivation Engine
 */

const express = require('express');
const router = express.Router();

const db = require('../intelligence/db');
const MetaDiagnostic = require('../intelligence/metaDiagnostic');
const MessagingCompliance = require('../intelligence/complianceEngine');
const SyncEngine = require('../intelligence/syncEngine');
const config = require('../config');

// 1. Dashboard KPIs
router.get('/dashboard', (req, res) => {
  try {
    const isDemo = req.query.is_demo !== undefined ? (req.query.is_demo === 'true') : null;
    const kpis = db.getDashboardKPIs(isDemo);
    res.json({
      success: true,
      data: kpis,
      meta_status: {
        page_id: config.clinic?.pageId || '30minutes30',
        clinic_name: config.clinic?.name || 'مركز وداعاً للألم',
        is_demo_mode: isDemo !== null ? isDemo : true
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Meta Connection Diagnostic (A to K checks)
router.get('/diagnostic', async (req, res) => {
  try {
    const token = req.query.token || config.meta?.pageAccessToken || process.env.PAGE_ACCESS_TOKEN;
    const pageId = req.query.page_id || config.meta?.pageId || '30minutes30';
    const isDemo = req.query.demo === 'true' || !token || token.startsWith('DEMO_') || token.startsWith('EAAW983');

    const diagnostic = await MetaDiagnostic.runDiagnostics(pageId, token, isDemo);
    res.json({ success: true, data: diagnostic });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Conversations List with filters & pagination
router.get('/conversations', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const filters = {
      search: req.query.search,
      lead_stage: req.query.lead_stage,
      intent: req.query.intent,
      source: req.query.source,
      recency: req.query.recency,
      min_score: req.query.min_score,
      is_demo: req.query.is_demo !== undefined ? (req.query.is_demo === 'true') : undefined
    };

    const results = db.getConversations(filters, page, limit);
    res.json({ success: true, ...results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Conversation Details (Messages, analysis, timeline)
router.get('/conversations/:id', (req, res) => {
  try {
    const details = db.getConversationDetails(req.params.id);
    if (!details) {
      return res.status(404).json({ success: false, error: 'المحادثة غير موجودة' });
    }
    res.json({ success: true, data: details });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Update Lead Stage & Manual Override
router.post('/conversations/:id/stage', (req, res) => {
  try {
    const { stage, user_name } = req.body;
    if (!stage) return res.status(400).json({ success: false, error: 'المرحلة مطلوبة' });

    const success = db.updateLeadStage(req.params.id, stage, user_name || 'المسؤول');
    res.json({ success });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/conversations/:id/override', (req, res) => {
  try {
    const { manual_stage, override_reason, user_name } = req.body;
    if (!manual_stage) return res.status(400).json({ success: false, error: 'المرحلة اليدوية مطلوبة' });

    const success = db.updateManualOverride(
      req.params.id,
      manual_stage,
      override_reason || 'تعديل يدوي عبر لوحة التحكم',
      user_name || 'المسؤول'
    );
    res.json({ success });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Analytics Audit Metric Catalog
router.get('/audit/metrics', (req, res) => {
  try {
    const catalog = db.getMetricsCatalog();
    const changeLogs = db.getMetricChangeLogs();
    res.json({ success: true, catalog, changeLogs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Audit of the 14 conversions
router.get('/audit/conversions', (req, res) => {
  try {
    const ids = [
      't_1822597454958128', 't_1063602851266624', 't_122240524886089091',
      't_10160709551607513', 't_1311237532578661', 't_2367325373404378',
      't_1261548031868995', 't_666798251193414', 't_1083642796521775',
      't_2969998906624985', 't_932713525075767', 't_259024363578409',
      't_1832524767142887', 't_1724820887984016'
    ];
    const cases = ids.map(id => db.getConversationDetails(id)).filter(Boolean);
    res.json({ success: true, count: cases.length, cases });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Bulk Operations
router.post('/conversations/bulk/stage', (req, res) => {
  try {
    const { ids, stage, user_name } = req.body;
    if (!ids || !stage) return res.status(400).json({ success: false, error: 'البيانات غير مكتملة' });

    const count = db.bulkUpdateStage(ids, stage, user_name || 'المسؤول');
    res.json({ success: true, updated_count: count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/conversations/bulk/label', (req, res) => {
  try {
    const { ids, label_id } = req.body;
    if (!ids || !label_id) return res.status(400).json({ success: false, error: 'البيانات غير مكتملة' });

    const count = db.bulkAddLabel(ids, label_id);
    res.json({ success: true, applied_count: count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Reactivation Opportunities
router.get('/reactivations', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const tier = req.query.tier || null;
    const opps = db.getReactivationOpportunities(tier, limit);
    res.json({ success: true, count: opps.length, data: opps });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Lost Leads Recovery
router.get('/lost-leads', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const lost = db.getLostLeads(limit);
    res.json({ success: true, count: lost.length, data: lost });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Compliance Check Endpoint
router.post('/compliance/check', (req, res) => {
  try {
    const { conversation_id, proposed_tag } = req.body;
    const details = db.getConversationDetails(conversation_id);
    if (!details) return res.status(404).json({ success: false, error: 'المحادثة غير موجودة' });

    const userMsgs = details.messages.filter(m => !m.is_from_page && m.sender_type !== 'page');
    const lastUserTimestamp = userMsgs[userMsgs.length - 1]?.timestamp || details.conversation.last_message_at;

    const compliance = MessagingCompliance.evaluateOutboundCompliance(
      details.conversation,
      lastUserTimestamp,
      proposed_tag
    );

    res.json({ success: true, data: compliance });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Propose & Manual Approval Workflow
router.post('/followup/propose', (req, res) => {
  try {
    const { conversation_id, proposed_message, proposed_tag } = req.body;
    const details = db.getConversationDetails(conversation_id);
    if (!details) return res.status(404).json({ success: false, error: 'المحادثة غير موجودة' });

    const userMsgs = details.messages.filter(m => !m.is_from_page && m.sender_type !== 'page');
    const lastUserTimestamp = userMsgs[userMsgs.length - 1]?.timestamp || details.conversation.last_message_at;

    const compliance = MessagingCompliance.evaluateOutboundCompliance(
      details.conversation,
      lastUserTimestamp,
      proposed_tag
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
      conversation_id,
      proposed_message,
      compliance.status,
      compliance.reason
    );

    res.json({
      success: true,
      followup_id: followupId,
      compliance
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Labels & Rules
router.get('/labels', (req, res) => {
  try {
    const labels = db.getSmartLabels();
    res.json({ success: true, data: labels });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/rules', (req, res) => {
  try {
    const rules = db.getAnalysisRules();
    res.json({ success: true, data: rules });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/audit', (req, res) => {
  try {
    const logs = db.getAuditLogs();
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Fallback Import Center
router.post('/import/json', async (req, res) => {
  try {
    const records = req.body.records;
    if (!Array.isArray(records)) {
      return res.status(400).json({ success: false, error: 'يجب أن يكون المدخل مصفوفة records صالحة' });
    }
    const result = await SyncEngine.importParsedRecords(records, req.body.source_name || 'استيراد يدوي');
    res.json({ success: true, stats: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Data Export
router.get('/export', (req, res) => {
  try {
    const format = req.query.format || 'json';
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
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="meta_conversations_export.csv"');
      return res.send(csvContent);
    }

    res.json({ success: true, count: convs.total, data: convs.data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
