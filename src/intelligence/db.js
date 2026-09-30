/**
 * Intelligence Database Access Layer
 * Uses Node.js native SQLite (node:sqlite DatabaseSync)
 */

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const { ConversationAnalyzer } = require('./rulesEngine');
const { DEMO_CONVERSATIONS } = require('./demoData');

const DB_PATH = path.join(__dirname, '../../data/conversation_intelligence.sqlite');

// Ensure data folder exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
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

  // Seed default smart labels if empty
  const countLabels = dbInstance.prepare('SELECT COUNT(*) as count FROM labels').get();
  if (countLabels.count === 0) {
    const defaultLabels = [
      ['lbl_price', 'سأل عن السعر', '#3B82F6', 'استفسر عن كلفة الجلسة أو الكشفية', 1],
      ['lbl_appt', 'طلب موعد', '#10B981', 'أبدى رغبة مباشرة في حجز موعد', 1],
      ['lbl_medical', 'استفسار طبي', '#8B5CF6', 'ذكر أعراضاً مثل ديسك، عرق نسا، أو ألم ظهر', 1],
      ['lbl_loc', 'موقع العيادة', '#06B6D4', 'سأل عن العنوان أو اللوكيشن بخلدا', 1],
      ['lbl_nobook', 'لم يحجز', '#F59E0B', 'تواصل وأبدى اهتماماً لكنه لم يؤكد الحجز', 1],
      ['lbl_lost', 'عميل مفقود', '#EF4444', 'فرصة عالية القيمة انقطعت لأكثر من أسبوعين', 1],
      ['lbl_ad', 'إعلان ممول', '#EC4899', 'محادثة قادمة من إعلان ممول على فيسبوك', 1],
      ['lbl_phone', 'يوجد رقم هاتف', '#14B8A6', 'شارك رقم هاتفه المباشر', 1],
      ['lbl_prev', 'عميل سابق', '#6366F1', 'راجع العيادة أو تلقى جلسات سابقة', 1],
      ['lbl_complaint', 'شكوى', '#DC2626', 'أبدى استياءً أو عدم رضا', 1],
      ['lbl_spam', 'Spam', '#64748B', 'رسالة ترويجية خارجية أو غير مفيدة', 1]
    ];

    const insertLabel = dbInstance.prepare(`
      INSERT INTO labels (id, name, color, description, is_system) VALUES (?, ?, ?, ?, ?)
    `);
    for (const [id, name, color, desc, isSys] of defaultLabels) {
      insertLabel.run(id, name, color, desc, isSys);
    }
  }

  // Seed default rules if empty
  const countRules = dbInstance.prepare('SELECT COUNT(*) as count FROM analysis_rules').get();
  if (countRules.count === 0) {
    const defaultRules = [
      ['rule_price', 'قاعدة السؤال عن السعر', 'keyword_contains', 'كم السعر', 'PRICE_INQUIRY', 'سأل عن السعر', 25, 1],
      ['rule_appt', 'قاعدة طلب الحجز', 'keyword_contains', 'بدي احجز', 'APPOINTMENT_REQUEST', 'طلب موعد', 40, 1],
      ['rule_sciatica', 'قاعدة عرق النسا', 'keyword_contains', 'عرق النسا', 'MEDICAL_PROBLEM', 'استفسار طبي', 20, 1],
      ['rule_location', 'قاعدة موقع خلدا', 'keyword_contains', 'وين العيادة', 'LOCATION_INQUIRY', 'موقع العيادة', 15, 1]
    ];

    const insertRule = dbInstance.prepare(`
      INSERT INTO analysis_rules (id, name, condition_type, keyword, target_intent, target_label, score_impact, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of defaultRules) {
      insertRule.run(...item);
    }
  }

  // Seed Demo Conversations if empty
  const countConvs = dbInstance.prepare('SELECT COUNT(*) as count FROM conversations').get();
  if (countConvs.count === 0) {
    loadDemoDataset();
  }
}

function loadDemoDataset() {
  const db = getDb();
  for (const conv of DEMO_CONVERSATIONS) {
    // 1. Insert Contact
    db.prepare(`
      INSERT OR REPLACE INTO contacts (id, meta_user_id, name, source, phone, city)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      conv.contact.id,
      conv.contact.meta_user_id,
      conv.contact.name,
      conv.contact.source,
      conv.contact.phone,
      conv.contact.city
    );

    // 2. Analyze Conversation
    const analysis = ConversationAnalyzer.analyze(conv, conv.messages);

    // 3. Insert Conversation (Parent Table)
    db.prepare(`
      INSERT OR REPLACE INTO conversations (
        id, meta_conversation_id, contact_id, channel, source, ad_name,
        first_message_at, last_message_at, message_count, status,
        lead_stage, intent, opportunity_score, appointment_intent_score,
        purchase_intent_score, recency_bracket, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      conv.id,
      conv.meta_conversation_id,
      conv.contact.id,
      'messenger',
      conv.source,
      conv.ad_name,
      conv.first_message_at,
      conv.last_message_at,
      conv.messages.length,
      'open',
      conv.lead_stage || analysis.lead_stage,
      analysis.intent,
      analysis.opportunity_score,
      analysis.appointment_intent_score,
      analysis.purchase_intent_score,
      analysis.recency_bracket
    );

    // 4. Insert Messages (Child Table)
    const insertMsg = db.prepare(`
      INSERT OR REPLACE INTO messages (id, conversation_id, meta_message_id, sender_type, timestamp, text, is_from_page)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const m of conv.messages) {
      insertMsg.run(
        m.id,
        conv.id,
        m.id,
        m.sender_type,
        m.timestamp,
        m.text,
        m.sender_type === 'page' ? 1 : 0
      );
    }

    // 5. Insert Analysis Result
    db.prepare(`
      INSERT OR REPLACE INTO analysis_results (
        id, conversation_id, intent, lead_score, purchase_intent,
        appointment_intent, summary, recommended_action, confidence, purchase_reasons
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `ar_${conv.id}`,
      conv.id,
      analysis.intent,
      analysis.opportunity_score,
      analysis.purchase_intent_score,
      analysis.appointment_intent_score,
      analysis.summary,
      analysis.recommended_action,
      analysis.confidence,
      JSON.stringify(analysis.purchase_reasons)
    );

    // 6. Attach smart labels
    const getLabel = db.prepare('SELECT id FROM labels WHERE name = ?');
    const insertConvLabel = db.prepare(`
      INSERT OR IGNORE INTO conversation_labels (conversation_id, label_id, source)
      VALUES (?, ?, 'auto')
    `);
    for (const lblName of analysis.smart_labels) {
      const lbl = getLabel.get(lblName);
      if (lbl) {
        insertConvLabel.run(conv.id, lbl.id);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// QUERY & MUTATION SERVICES
// ─────────────────────────────────────────────────────────────

function getDashboardKPIs(isDemoOnly = null) {
  const db = getDb();
  let whereClause = '';
  const params = [];
  if (isDemoOnly !== null) {
    whereClause = 'WHERE is_demo = ?';
    params.push(isDemoOnly ? 1 : 0);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM conversations ${whereClause}`).get(...params).count;
  const leads = db.prepare(`SELECT COUNT(*) as count FROM conversations ${whereClause ? whereClause + ' AND' : 'WHERE'} opportunity_score >= 40`).get(...params).count;
  const qualified = db.prepare(`SELECT COUNT(*) as count FROM conversations ${whereClause ? whereClause + ' AND' : 'WHERE'} opportunity_score >= 70`).get(...params).count;
  const converted = db.prepare(`SELECT COUNT(*) as count FROM conversations ${whereClause ? whereClause + ' AND' : 'WHERE'} lead_stage = 'تم التحويل'`).get(...params).count;
  const lost = db.prepare(`SELECT COUNT(*) as count FROM conversations ${whereClause ? whereClause + ' AND' : 'WHERE'} lead_stage IN ('مفقود', 'لم يحجز')`).get(...params).count;
  const unqualified = db.prepare(`SELECT COUNT(*) as count FROM conversations ${whereClause ? whereClause + ' AND' : 'WHERE'} lead_stage = 'غير مؤهل'`).get(...params).count;
  const priceInquiries = db.prepare(`SELECT COUNT(*) as count FROM conversations ${whereClause ? whereClause + ' AND' : 'WHERE'} intent = 'PRICE_INQUIRY'`).get(...params).count;
  const apptRequests = db.prepare(`SELECT COUNT(*) as count FROM conversations ${whereClause ? whereClause + ' AND' : 'WHERE'} intent = 'APPOINTMENT_REQUEST'`).get(...params).count;
  const adOriginated = db.prepare(`SELECT COUNT(*) as count FROM conversations ${whereClause ? whereClause + ' AND' : 'WHERE'} source = 'Ad response'`).get(...params).count;
  const reactivationOpps = db.prepare(`
    SELECT COUNT(*) as count FROM conversations 
    ${whereClause ? whereClause + ' AND' : 'WHERE'} lead_stage IN ('مفقود', 'لم يحجز', 'سأل عن السعر') AND opportunity_score >= 50
  `).get(...params).count;

  return {
    totalConversations: total,
    leadsCount: leads,
    qualifiedCount: qualified,
    convertedCount: converted,
    lostCount: lost,
    unqualifiedCount: unqualified,
    priceInquiries,
    appointmentRequests: apptRequests,
    adOriginated,
    reactivationOpportunities: reactivationOpps,
    conversionRate: total > 0 ? ((converted / total) * 100).toFixed(1) : '0.0'
  };
}

function getConversations(filters = {}, page = 1, limit = 20) {
  const db = getDb();
  let conditions = [];
  let params = [];

  if (filters.search) {
    conditions.push('(c.name LIKE ? OR cv.last_message_at LIKE ? OR ar.summary LIKE ?)');
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }
  if (filters.lead_stage) {
    conditions.push('cv.lead_stage = ?');
    params.push(filters.lead_stage);
  }
  if (filters.intent) {
    conditions.push('cv.intent = ?');
    params.push(filters.intent);
  }
  if (filters.source) {
    conditions.push('cv.source = ?');
    params.push(filters.source);
  }
  if (filters.recency) {
    conditions.push('cv.recency_bracket = ?');
    params.push(filters.recency);
  }
  if (filters.min_score) {
    conditions.push('cv.opportunity_score >= ?');
    params.push(Number(filters.min_score));
  }
  if (filters.is_demo !== undefined) {
    conditions.push('cv.is_demo = ?');
    params.push(filters.is_demo ? 1 : 0);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const total = db.prepare(`
    SELECT COUNT(*) as count
    FROM conversations cv
    JOIN contacts c ON cv.contact_id = c.id
    LEFT JOIN analysis_results ar ON cv.id = ar.conversation_id
    ${whereSql}
  `).get(...params).count;

  const query = `
    SELECT 
      cv.id, cv.meta_conversation_id, cv.source, cv.ad_name,
      cv.first_message_at, cv.last_message_at, cv.message_count,
      cv.status, cv.lead_stage, cv.intent, cv.opportunity_score,
      cv.appointment_intent_score, cv.purchase_intent_score,
      cv.recency_bracket, cv.is_demo,
      c.id as contact_id, c.name as contact_name, c.phone as contact_phone, c.city as contact_city,
      ar.summary, ar.recommended_action
    FROM conversations cv
    JOIN contacts c ON cv.contact_id = c.id
    LEFT JOIN analysis_results ar ON cv.id = ar.conversation_id
    ${whereSql}
    ORDER BY cv.last_message_at DESC
    LIMIT ? OFFSET ?
  `;

  const rows = db.prepare(query).all(...params, limit, offset);

  // Fetch labels for each conversation
  const getLabels = db.prepare(`
    SELECT l.id, l.name, l.color
    FROM conversation_labels cl
    JOIN labels l ON cl.label_id = l.id
    WHERE cl.conversation_id = ?
  `);

  for (const r of rows) {
    r.labels = getLabels.all(r.id);
  }

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    data: rows
  };
}

function getConversationDetails(conversationId) {
  const db = getDb();
  const conv = db.prepare(`
    SELECT 
      cv.*, c.name as contact_name, c.phone as contact_phone, c.city as contact_city, c.profile_url
    FROM conversations cv
    JOIN contacts c ON cv.contact_id = c.id
    WHERE cv.id = ?
  `).get(conversationId);

  if (!conv) return null;

  const messages = db.prepare(`
    SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC
  `).all(conversationId);

  const analysis = db.prepare(`
    SELECT * FROM analysis_results WHERE conversation_id = ?
  `).get(conversationId);

  const labels = db.prepare(`
    SELECT l.* FROM conversation_labels cl
    JOIN labels l ON cl.label_id = l.id
    WHERE cl.conversation_id = ?
  `).all(conversationId);

  const followups = db.prepare(`
    SELECT * FROM followups WHERE conversation_id = ? ORDER BY created_at DESC
  `).all(conversationId);

  return {
    conversation: conv,
    messages,
    analysis: analysis ? {
      ...analysis,
      purchase_reasons: JSON.parse(analysis.purchase_reasons || '[]')
    } : null,
    labels,
    followups
  };
}

function updateLeadStage(conversationId, newStage, userName = 'المسؤول') {
  const db = getDb();
  const old = db.prepare('SELECT lead_stage FROM conversations WHERE id = ?').get(conversationId);
  if (!old) return false;

  db.prepare('UPDATE conversations SET lead_stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStage, conversationId);

  // Log event & audit
  db.prepare(`
    INSERT INTO lead_events (id, conversation_id, event_type, old_value, new_value)
    VALUES (?, ?, 'stage_change', ?, ?)
  `).run(`evt_${Date.now()}`, conversationId, old.lead_stage, newStage);

  db.prepare(`
    INSERT INTO audit_logs (id, user_name, action, object_type, object_id, old_value, new_value)
    VALUES (?, ?, 'تغيير مرحلة العميل', 'conversation', ?, ?, ?)
  `).run(`aud_${Date.now()}`, userName, conversationId, old.lead_stage, newStage);

  return true;
}

function bulkUpdateStage(conversationIds, newStage, userName = 'المسؤول') {
  let count = 0;
  for (const id of conversationIds) {
    if (updateLeadStage(id, newStage, userName)) count++;
  }
  return count;
}

function bulkAddLabel(conversationIds, labelId) {
  const db = getDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO conversation_labels (conversation_id, label_id, source)
    VALUES (?, ?, 'manual')
  `);
  let count = 0;
  for (const cid of conversationIds) {
    insert.run(cid, labelId);
    count++;
  }
  return count;
}

function getReactivationOpportunities(limit = 50) {
  const db = getDb();
  return db.prepare(`
    SELECT 
      cv.id, cv.last_message_at, cv.source, cv.intent, cv.opportunity_score,
      cv.lead_stage, cv.recency_bracket,
      c.name as contact_name, c.phone as contact_phone, c.city as contact_city,
      ar.summary, ar.recommended_action
    FROM conversations cv
    JOIN contacts c ON cv.contact_id = c.id
    LEFT JOIN analysis_results ar ON cv.id = ar.conversation_id
    WHERE cv.lead_stage IN ('لم يحجز', 'مفقود', 'سأل عن السعر') AND cv.opportunity_score >= 50
    ORDER BY cv.opportunity_score DESC, cv.last_message_at DESC
    LIMIT ?
  `).all(limit);
}

function getLostLeads(limit = 50) {
  const db = getDb();
  return db.prepare(`
    SELECT 
      cv.id, cv.last_message_at, cv.source, cv.opportunity_score,
      cv.lead_stage, cv.recency_bracket,
      c.name as contact_name, c.phone as contact_phone,
      ar.summary, ar.recommended_action
    FROM conversations cv
    JOIN contacts c ON cv.contact_id = c.id
    LEFT JOIN analysis_results ar ON cv.id = ar.conversation_id
    WHERE cv.lead_stage = 'مفقود'
    ORDER BY cv.opportunity_score DESC
    LIMIT ?
  `).all(limit);
}

function getAuditLogs(limit = 50) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?
  `).all(limit);
}

function getSmartLabels() {
  const db = getDb();
  return db.prepare(`
    SELECT l.*, COUNT(cl.conversation_id) as attached_count
    FROM labels l
    LEFT JOIN conversation_labels cl ON l.id = cl.label_id
    GROUP BY l.id
    ORDER BY attached_count DESC
  `).all();
}

function getAnalysisRules() {
  const db = getDb();
  return db.prepare('SELECT * FROM analysis_rules ORDER BY created_at DESC').all();
}

module.exports = {
  getDb,
  getDashboardKPIs,
  getConversations,
  getConversationDetails,
  updateLeadStage,
  bulkUpdateStage,
  bulkAddLabel,
  getReactivationOpportunities,
  getLostLeads,
  getAuditLogs,
  getSmartLabels,
  getAnalysisRules,
  loadDemoDataset
};
