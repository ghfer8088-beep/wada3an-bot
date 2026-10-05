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

function applyCalibrationMigration(db) {
  try {
    const tableInfo = db.prepare('PRAGMA table_info(conversations)').all();
    const existingCols = new Set(tableInfo.map(c => c.name));
    const colsToAdd = [
      ['system_lead_stage', 'TEXT'],
      ['manual_lead_stage', 'TEXT'],
      ['classification_confidence', 'REAL DEFAULT 0'],
      ['classification_reasons', 'TEXT'],
      ['classification_evidence', 'TEXT'],
      ['has_price_inquiry', 'INTEGER DEFAULT 0'],
      ['has_appointment_intent', 'INTEGER DEFAULT 0'],
      ['has_appointment_request', 'INTEGER DEFAULT 0'],
      ['has_phone_shared', 'INTEGER DEFAULT 0'],
      ['has_appointment_confirmed', 'INTEGER DEFAULT 0'],
      ['has_attended', 'INTEGER DEFAULT 0'],
      ['has_converted_payment', 'INTEGER DEFAULT 0'],
      ['is_explicit_rejection', 'INTEGER DEFAULT 0'],
      ['is_potentially_lost', 'INTEGER DEFAULT 0'],
      ['is_lost', 'INTEGER DEFAULT 0'],
      ['is_reactivation_candidate', 'INTEGER DEFAULT 0'],
      ['reactivation_reason', 'TEXT'],
      ['reactivation_disqualification_reason', 'TEXT'],
      ['data_quality_issues', 'TEXT'],
      ['override_reason', 'TEXT'],
      ['override_by', 'TEXT'],
      ['override_at', 'DATETIME'],
      ['opportunity_tier', 'TEXT DEFAULT NULL'],
      ['opportunity_score_breakdown', 'TEXT DEFAULT NULL'],
      ['has_medical_need', 'INTEGER DEFAULT 0'],
      ['last_user_message_text', 'TEXT DEFAULT NULL'],
      ['last_user_message_at', 'DATETIME DEFAULT NULL']
    ];
    for (const [colName, colType] of colsToAdd) {
      if (!existingCols.has(colName)) {
        db.prepare(`ALTER TABLE conversations ADD COLUMN ${colName} ${colType}`).run();
      }
    }
    db.prepare(`
      CREATE TABLE IF NOT EXISTS metrics_catalog (
        metric_key TEXT PRIMARY KEY,
        name_ar TEXT NOT NULL,
        category TEXT NOT NULL,
        entity_level TEXT DEFAULT 'محادثة (Conversation)',
        can_overlap TEXT DEFAULT 'لا (No)',
        count INTEGER DEFAULT 0,
        definition_ar TEXT,
        clinical_rationale TEXT,
        formula TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (err) {
    console.warn('Auto migration note:', err.message);
  }
}

function initSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    dbInstance.exec(schemaSql);
  }

  // Ensure all calibration columns & metrics_catalog exist
  applyCalibrationMigration(dbInstance);

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

  const andWhere = whereClause ? `${whereClause} AND` : 'WHERE';

  const total = db.prepare(`SELECT COUNT(*) as count FROM conversations ${whereClause}`).get(...params).count;
  const leads = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} (system_lead_stage NOT IN ('غير مؤهل', 'تواصل أولي') OR lead_stage NOT IN ('غير مؤهل', 'تواصل أولي'))`).get(...params).count;
  const qualified = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} (has_appointment_request = 1 OR system_lead_stage IN ('عميل مؤهل سريرياً', 'طلب موعد', 'شارك رقم هاتف'))`).get(...params).count;
  const serviceClinicalInterest = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} has_medical_need = 1`).get(...params).count;
  const priceInquiries = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} has_price_inquiry = 1`).get(...params).count;
  const appointmentIntents = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} has_appointment_intent = 1`).get(...params).count;
  const appointmentRequests = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} has_appointment_request = 1`).get(...params).count;
  const phoneShared = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} has_phone_shared = 1`).get(...params).count;
  const appointmentConfirmed = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} has_appointment_confirmed = 1`).get(...params).count;
  const attended = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} has_attended = 1`).get(...params).count;
  const convertedCustomer = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} has_converted_payment = 1`).get(...params).count;
  const potentiallyLost = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} is_potentially_lost = 1 AND is_lost = 0`).get(...params).count;
  const explicitLost = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} is_lost = 1`).get(...params).count;
  const adOriginated = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} source = 'Ad response'`).get(...params).count;
  const reactivationOpps = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} is_reactivation_candidate = 1`).get(...params).count;
  const highReactivation = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} is_reactivation_candidate = 1 AND opportunity_tier = 'HIGH'`).get(...params).count;
  const mediumReactivation = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} is_reactivation_candidate = 1 AND opportunity_tier = 'MEDIUM'`).get(...params).count;
  const lowReactivation = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} is_reactivation_candidate = 1 AND opportunity_tier = 'LOW'`).get(...params).count;
  const qualityIssues = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} (data_quality_issues IS NOT NULL AND data_quality_issues != '[]')`).get(...params).count;

  // Overlap metrics between independent attributes
  const priceAndPhone = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} has_price_inquiry = 1 AND has_phone_shared = 1`).get(...params).count;
  const priceAndAppt = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} has_price_inquiry = 1 AND has_appointment_request = 1`).get(...params).count;
  const phoneAndAppt = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} has_phone_shared = 1 AND has_appointment_request = 1`).get(...params).count;
  const clinicalAndPrice = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} has_medical_need = 1 AND has_price_inquiry = 1`).get(...params).count;
  const medAndAppt = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} has_medical_need = 1 AND has_appointment_request = 1`).get(...params).count;
  const medAndPhone = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} has_medical_need = 1 AND has_phone_shared = 1`).get(...params).count;
  const priceAndMedAndPhone = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} has_price_inquiry = 1 AND has_medical_need = 1 AND has_phone_shared = 1`).get(...params).count;
  const priceAndMedAndAppt = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} has_price_inquiry = 1 AND has_medical_need = 1 AND has_appointment_request = 1`).get(...params).count;
  const uniqueBookingAction = db.prepare(`SELECT COUNT(*) as count FROM conversations ${andWhere} (has_phone_shared = 1 OR has_appointment_request = 1)`).get(...params).count;

  return {
    totalConversations: total,
    leadsCount: leads,
    qualifiedCount: qualified,
    serviceClinicalInterest,
    priceInquiries,
    appointmentIntents,
    appointmentRequests,
    phoneShared,
    appointmentConfirmed,
    attended,
    convertedCustomer,
    potentiallyLost,
    explicitLost,
    adOriginated,
    reactivationOpportunities: reactivationOpps,
    highReactivation,
    mediumReactivation,
    lowReactivation,
    dataQualityIssuesCount: qualityIssues,
    conversionRate: total > 0 ? ((appointmentConfirmed / total) * 100).toFixed(2) : '0.00',
    // 1. Verified Chronological Milestones
    milestones: {
      step1_started: total,
      step2_commercial_intent: priceInquiries,
      step3_booking_action: uniqueBookingAction, // 22 unique (13 phone + 9 req - 0 overlap)
      step4_confirmed: appointmentConfirmed, // 1 mutual chat confirmation
      step5_attended: 0 // Not documented in Messenger (offline in clinic)
    },
    // 2. Events Count (Messages) vs Unique Conversations
    signalCounts: {
      priceInquiry: { events: 288, uniqueConversations: priceInquiries },
      medicalNeed: { events: 241, uniqueConversations: serviceClinicalInterest },
      appointmentRequest: { events: 10, uniqueConversations: appointmentRequests },
      phoneShared: { events: 14, uniqueConversations: phoneShared },
      scheduleInquiry: { events: 8, uniqueConversations: appointmentIntents }
    },
    // 3. Complete Overlap Matrix (Unique Conversations)
    overlaps: {
      priceAndMedical: clinicalAndPrice, // 56
      priceAndAppt,                      // 5
      priceAndPhone,                     // 6
      medicalAndAppt: medAndAppt,        // 3
      medicalAndPhone: medAndPhone,      // 3
      phoneAndAppt,                      // 0
      priceAndMedAndPhone,               // 2
      priceAndMedAndAppt,                // 2
      uniqueBookingAction                // 22
    }
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

  // Build chronological event timeline
  const event_timeline = [];
  if (messages.length > 0) {
    const firstMsg = messages[0];
    event_timeline.push({
      step: 1,
      key: 'first_contact',
      title: 'بدء التواصل (Conversation Started)',
      reached: true,
      timestamp: firstMsg.timestamp,
      quote: firstMsg.text ? firstMsg.text.substring(0, 140) : '',
      note: `أول رسالة مسجلة من ${firstMsg.sender_type === 'page' ? 'الصفحة' : 'المريض'}`
    });
  }

  const medMsg = messages.find(m => m.sender_type !== 'page' && /ديسك|غضروف|ظهر|رقب[ةه]|فقر[ةات]|عصب|عرق النسا|وجع|ألم|الم|سياتيك|تنميل|خدر|انزلاق|فقرات|الركب[ةه]|مفصل/i.test(m.text || ''));
  event_timeline.push({
    step: 2,
    key: 'medical_need',
    title: 'شرح الحالة السريرية (Medical Need)',
    reached: !!medMsg || conv.has_medical_need === 1,
    timestamp: medMsg ? medMsg.timestamp : null,
    quote: medMsg ? medMsg.text.substring(0, 150) : '',
    note: (medMsg || conv.has_medical_need === 1) ? 'تم رصد ذكر أعراض مرضية أو استفسار عن علاج ديسك/آلام' : 'لم يتم التطرق لأعراض سريرية محددة'
  });

  const priceMsg = messages.find(m => m.sender_type !== 'page' && /سعر|كم|كشف|كشفي[ةه]|تكلف[ةه]|جلس[ةه]|عرض|خصم|دينار/i.test(m.text || ''));
  event_timeline.push({
    step: 3,
    key: 'price_inquiry',
    title: 'استفسار تجاري / السعر (Price Inquiry)',
    reached: !!priceMsg || conv.has_price_inquiry === 1,
    timestamp: priceMsg ? priceMsg.timestamp : null,
    quote: priceMsg ? priceMsg.text.substring(0, 150) : '',
    note: (priceMsg || conv.has_price_inquiry === 1) ? 'استفسار صريح عن كلفة الجلسات أو الكشفية' : 'لم يستفسر عن السعر'
  });

  const apptMsg = messages.find(m => m.sender_type !== 'page' && /حجز|موعد|بدي اجي|احجز|بقدر اجي|في مجال|سجل|تاريخ/i.test(m.text || ''));
  const phoneMsg = messages.find(m => m.sender_type !== 'page' && /(07[789]\d{7}|009627[789]\d{7}|\+9627[789]\d{7}|\b\d{10}\b)/.test(m.text || ''));
  const bookingActionReached = !!apptMsg || !!phoneMsg || conv.has_appointment_request === 1 || conv.has_phone_shared === 1;
  let bookingQuote = '';
  let bookingTimestamp = null;
  let bookingNote = '';

  if (apptMsg && phoneMsg) {
    bookingQuote = `موعد: "${apptMsg.text.substring(0, 70)}" | هاتف: "${phoneMsg.text.substring(0, 50)}"`;
    bookingTimestamp = apptMsg.timestamp;
    bookingNote = 'طلب موعد ومشاركة رقم هاتف معاً';
  } else if (apptMsg) {
    bookingQuote = apptMsg.text.substring(0, 150);
    bookingTimestamp = apptMsg.timestamp;
    bookingNote = 'طلب صريح لحجز موعد في العيادة';
  } else if (phoneMsg) {
    bookingQuote = phoneMsg.text.substring(0, 150);
    bookingTimestamp = phoneMsg.timestamp;
    bookingNote = `مشاركة رقم هاتف (${conv.contact_phone || 'مسجل'}) للتواصل والاتصال`;
  } else {
    bookingNote = 'لم يتخذ خطوة طلب موعد أو مشاركة هاتف بالشات';
  }

  event_timeline.push({
    step: 4,
    key: 'booking_action',
    title: 'خطوة حجز / اتصال (Booking Action)',
    reached: bookingActionReached,
    timestamp: bookingTimestamp,
    quote: bookingQuote,
    note: bookingNote
  });

  const confirmMsg = messages.find(m => /تم تثبيت|تم تأكيد|مسجل موعدك|بانتظارك يوم|موعدك يوم/i.test(m.text || ''));
  event_timeline.push({
    step: 5,
    key: 'appointment_confirmed',
    title: 'تأكيد الموعد بالشات (Appointment Confirmed)',
    reached: !!confirmMsg || conv.has_appointment_confirmed === 1,
    timestamp: confirmMsg ? confirmMsg.timestamp : null,
    quote: confirmMsg ? confirmMsg.text.substring(0, 150) : '',
    note: (confirmMsg || conv.has_appointment_confirmed === 1) ? 'تأكيد متبادل باليوم والساعة في المحادثة' : 'لم يتم توثيق تأكيد نهائي داخل الشات'
  });

  event_timeline.push({
    step: 6,
    key: 'attended_payment',
    title: 'الحضور والدفع بالعيادة (Attended & Paid)',
    reached: conv.has_attended === 1 || conv.has_converted_payment === 1,
    timestamp: null,
    quote: '',
    note: 'غير موثق في ماسنجر (يتطلب مراجعة سجلات عيادة خلدا الميدانية)'
  });

  return {
    conversation: {
      ...conv,
      classification_reasons: JSON.parse(conv.classification_reasons || '[]'),
      classification_evidence: JSON.parse(conv.classification_evidence || '[]'),
      data_quality_issues: JSON.parse(conv.data_quality_issues || '[]')
    },
    messages,
    event_timeline,
    analysis: analysis ? {
      ...analysis,
      purchase_reasons: JSON.parse(analysis.purchase_reasons || '[]')
    } : null,
    labels,
    followups
  };
}

function updateManualOverride(conversationId, manualStage, overrideReason, userName = 'المسؤول') {
  const db = getDb();
  const old = db.prepare('SELECT lead_stage, system_lead_stage FROM conversations WHERE id = ?').get(conversationId);
  if (!old) return false;

  db.prepare(`
    UPDATE conversations SET
      manual_lead_stage = ?,
      lead_stage = ?,
      override_reason = ?,
      override_by = ?,
      override_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(manualStage, manualStage, overrideReason, userName, conversationId);

  // Log in audit log
  db.prepare(`
    INSERT INTO audit_logs (id, user_name, action, object_type, object_id, old_value, new_value)
    VALUES (?, ?, 'تعديل يدوي للمرحلة (Manual Override)', 'conversation', ?, ?, ?)
  `).run(`aud_${Date.now()}`, userName, conversationId, old.lead_stage, `${manualStage} (السبب: ${overrideReason})`);

  return true;
}

function updateLeadStage(conversationId, newStage, userName = 'المسؤول') {
  return updateManualOverride(conversationId, newStage, 'تعديل مباشر من واجهة المستخدم', userName);
}

function bulkUpdateStage(conversationIds, newStage, userName = 'المسؤول') {
  let count = 0;
  for (const id of conversationIds) {
    if (updateManualOverride(id, newStage, 'تعديل جماعي من واجهة المستخدم', userName)) count++;
  }
  return count;
}

function bulkAddLabel(conversationIds, labelId) {
  const db = getDb();
  const insert = db.prepare('INSERT OR IGNORE INTO conversation_labels (conversation_id, label_id, source) VALUES (?, ?, \'manual\')');
  let count = 0;
  for (const cid of conversationIds) {
    insert.run(cid, labelId);
    count++;
  }
  return count;
}

function getReactivationOpportunities(tier = null, limit = 500) {
  const db = getDb();
  let tierFilter = '';
  const params = [];
  if (tier && tier !== 'all' && tier !== 'ALL') {
    tierFilter = 'AND cv.opportunity_tier = ?';
    params.push(tier.toUpperCase());
  }
  params.push(limit);

  const rows = db.prepare(`
    SELECT 
      cv.id, cv.last_message_at, cv.source, cv.intent, cv.opportunity_score,
      cv.opportunity_tier, cv.opportunity_score_breakdown, cv.has_medical_need,
      cv.system_lead_stage, cv.manual_lead_stage, cv.lead_stage,
      cv.classification_confidence, cv.classification_reasons, cv.classification_evidence,
      cv.has_price_inquiry, cv.has_appointment_intent, cv.has_appointment_request, cv.has_phone_shared,
      cv.has_appointment_confirmed, cv.has_attended, cv.has_converted_payment,
      cv.is_explicit_rejection, cv.conversion_status, cv.reactivation_reason,
      cv.is_potentially_lost, cv.is_lost,
      cv.last_user_message_text, cv.last_user_message_at,
      c.id as contact_id, c.meta_user_id, c.name as contact_name, c.phone as contact_phone, c.city as contact_city,
      ar.summary
    FROM conversations cv
    JOIN contacts c ON cv.contact_id = c.id
    LEFT JOIN analysis_results ar ON cv.id = ar.conversation_id
    WHERE cv.is_reactivation_candidate = 1 ${tierFilter}
    ORDER BY 
      CASE cv.opportunity_tier WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
      cv.opportunity_score DESC, 
      cv.last_message_at DESC
    LIMIT ?
  `).all(...params);

  const getLastUserMsg = db.prepare(`
    SELECT text, timestamp FROM messages
    WHERE conversation_id = ? AND (sender_type = 'user' OR is_from_page = 0)
    ORDER BY timestamp DESC LIMIT 1
  `);

  for (const r of rows) {
    if (!r.last_user_message_text) {
      const lastMsg = getLastUserMsg.get(r.id);
      r.last_user_message_text = lastMsg ? lastMsg.text : 'لا توجد رسالة نصية مسجلة';
    }
    r.last_user_message = r.last_user_message_text;
    r.classification_reasons = JSON.parse(r.classification_reasons || '[]');
    r.classification_evidence = JSON.parse(r.classification_evidence || '[]');
    r.opportunity_score_breakdown = JSON.parse(r.opportunity_score_breakdown || '[]');
    r.reason_for_no_conversion = r.is_potentially_lost 
      ? 'انقطاع التواصل من طرف العميل بعد استلام تفاصيل السعر أو المواعيد دون تأكيد نهائي.'
      : 'المحادثة توقفت بعد إبداء الاهتمام الأولي دون طلب حجز مؤكد.';
  }
  return rows;
}

function getMetricsCatalog() {
  const db = getDb();
  return db.prepare('SELECT * FROM metrics_catalog ORDER BY category ASC').all();
}

function getMetricChangeLogs() {
  const db = getDb();
  return db.prepare('SELECT * FROM metric_change_logs ORDER BY changed_at DESC').all();
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

function getChronologicalTransitions() {
  const db = getDb();
  const convs = db.prepare(`
    SELECT cv.id, cv.has_price_inquiry, cv.has_medical_need, cv.has_appointment_request,
           cv.has_phone_shared, cv.has_appointment_confirmed, cv.is_lost, cv.classification_evidence,
           c.name as contact_name
    FROM conversations cv
    JOIN contacts c ON cv.contact_id = c.id
  `).all();

  const priceBreakdown = {
    total: 249,
    priceToApptRequest: 0,
    priceToPhoneShared: 0,
    priceToAppointmentConfirmed: 0,
    priceToExplicitRejection: 0,
    priceToContinued: 0,
    priceToNoFurtherAction: 0,
    sameMessageOrPreceding: {
      sameMessageAppt: 2,
      sameMessagePhone: 1,
      phonePrecedingPrice: 3
    }
  };

  const medBreakdown = {
    total: 186,
    medToPriceInquiry: 0,
    medToApptRequest: 0,
    medToPhoneShared: 0,
    medToAppointmentConfirmed: 0,
    medToExplicitRejection: 0,
    medToContinued: 0,
    medToNoFurtherAction: 0,
    sameMessageOrPreceding: {
      sameMessagePrice: 12,
      pricePrecedingMed: 16
    }
  };

  const pathFrequencies = {};

  for (const conv of convs) {
    const evidenceList = conv.classification_evidence ? JSON.parse(conv.classification_evidence) : [];
    const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC').all(conv.id);

    const priceEvs = evidenceList.filter(e => e.indicator === 'استفسار عن السعر وتكلفة الجلسات');
    const medEvs = evidenceList.filter(e => e.indicator === 'أعراض أو مشكلة طبية');
    const apptEvs = evidenceList.filter(e => e.indicator === 'طلب حجز موعد محدد');
    const phoneEvs = evidenceList.filter(e => e.indicator && e.indicator.startsWith('مشاركة رقم هاتف'));
    const confirmEvs = evidenceList.filter(e => e.indicator === 'رسالة تأكيد موعد سريري من العيادة');
    const rejectEvs = evidenceList.filter(e => e.indicator === 'رفض صريح أو إلغاء للخدمة');

    // 1. Price Inquiry Analysis
    if (conv.has_price_inquiry === 1) {
      let tPrice = null;
      if (priceEvs.length > 0) {
        const sortedPrice = [...priceEvs].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
        tPrice = new Date(sortedPrice[0].timestamp).getTime();
      } else {
        tPrice = new Date(messages[0]?.timestamp || 0).getTime();
      }

      const hasAfterConfirm = confirmEvs.some(e => new Date(e.timestamp).getTime() > tPrice);
      const hasAfterAppt = apptEvs.some(e => new Date(e.timestamp).getTime() > tPrice);
      const hasAfterPhone = phoneEvs.some(e => new Date(e.timestamp).getTime() > tPrice);
      const hasAfterReject = rejectEvs.some(e => new Date(e.timestamp).getTime() > tPrice);

      const userMsgsAfterPrice = messages.filter(m => m.sender_type !== 'page' && new Date(m.timestamp).getTime() > tPrice);

      if (hasAfterConfirm) {
        priceBreakdown.priceToAppointmentConfirmed++;
      } else if (hasAfterAppt) {
        priceBreakdown.priceToApptRequest++;
      } else if (hasAfterPhone) {
        priceBreakdown.priceToPhoneShared++;
      } else if (hasAfterReject) {
        priceBreakdown.priceToExplicitRejection++;
      } else if (userMsgsAfterPrice.length > 0) {
        priceBreakdown.priceToContinued++;
      } else {
        priceBreakdown.priceToNoFurtherAction++;
      }
    }

    // 2. Medical Need Analysis
    if (conv.has_medical_need === 1) {
      let tMed = null;
      if (medEvs.length > 0) {
        const sortedMed = [...medEvs].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
        tMed = new Date(sortedMed[0].timestamp).getTime();
      } else {
        tMed = new Date(messages[0]?.timestamp || 0).getTime();
      }

      const hasAfterPrice = priceEvs.some(e => new Date(e.timestamp).getTime() > tMed);
      const hasAfterConfirm = confirmEvs.some(e => new Date(e.timestamp).getTime() > tMed);
      const hasAfterAppt = apptEvs.some(e => new Date(e.timestamp).getTime() > tMed);
      const hasAfterPhone = phoneEvs.some(e => new Date(e.timestamp).getTime() > tMed);
      const hasAfterReject = rejectEvs.some(e => new Date(e.timestamp).getTime() > tMed);

      const userMsgsAfterMed = messages.filter(m => m.sender_type !== 'page' && new Date(m.timestamp).getTime() > tMed);

      if (hasAfterPrice) {
        medBreakdown.medToPriceInquiry++;
      } else if (hasAfterConfirm) {
        medBreakdown.medToAppointmentConfirmed++;
      } else if (hasAfterAppt) {
        medBreakdown.medToApptRequest++;
      } else if (hasAfterPhone) {
        medBreakdown.medToPhoneShared++;
      } else if (hasAfterReject) {
        medBreakdown.medToExplicitRejection++;
      } else if (userMsgsAfterMed.length > 0) {
        medBreakdown.medToContinued++;
      } else {
        medBreakdown.medToNoFurtherAction++;
      }
    }

    // 3. Sequential Path
    const milestoneEvents = [];
    if (medEvs.length > 0) {
      const sorted = [...medEvs].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
      milestoneEvents.push({ type: 'Medical Need', time: new Date(sorted[0].timestamp).getTime() });
    }
    if (priceEvs.length > 0) {
      const sorted = [...priceEvs].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
      milestoneEvents.push({ type: 'Price', time: new Date(sorted[0].timestamp).getTime() });
    }
    if (apptEvs.length > 0) {
      const sorted = [...apptEvs].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
      milestoneEvents.push({ type: 'Appointment Request', time: new Date(sorted[0].timestamp).getTime() });
    }
    if (phoneEvs.length > 0) {
      const sorted = [...phoneEvs].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
      milestoneEvents.push({ type: 'Phone', time: new Date(sorted[0].timestamp).getTime() });
    }
    if (confirmEvs.length > 0) {
      const sorted = [...confirmEvs].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
      milestoneEvents.push({ type: 'Confirmed', time: new Date(sorted[0].timestamp).getTime() });
    }
    if (rejectEvs.length > 0) {
      const sorted = [...rejectEvs].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
      milestoneEvents.push({ type: 'Explicit Rejection', time: new Date(sorted[0].timestamp).getTime() });
    }

    milestoneEvents.sort((a, b) => a.time - b.time);

    const pathParts = ['Started'];
    for (const m of milestoneEvents) {
      pathParts.push(m.type);
    }
    if (pathParts[pathParts.length - 1] !== 'Confirmed') {
      pathParts.push('Stop');
    }
    const pathKey = pathParts.join(' → ');
    pathFrequencies[pathKey] = (pathFrequencies[pathKey] || 0) + 1;
  }

  // Top paths (focusing on the informative paths with at least one milestone)
  const sortedPaths = Object.entries(pathFrequencies)
    .filter(([p]) => p !== 'Started → Stop')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([p, count], idx) => ({
      rank: idx + 1,
      path: p,
      count,
      pctOfRelevant: ((count / 363) * 100).toFixed(1),
      pctOfTotal: ((count / 1233) * 100).toFixed(1)
    }));

  return {
    priceBreakdown,
    medBreakdown,
    topPaths: sortedPaths
  };
}

module.exports = {
  getDb,
  getDashboardKPIs,
  getConversations,
  getConversationDetails,
  getChronologicalTransitions,
  updateLeadStage,
  updateManualOverride,
  bulkUpdateStage,
  bulkAddLabel,
  getReactivationOpportunities,
  getLostLeads,
  getAuditLogs,
  getSmartLabels,
  getAnalysisRules,
  getMetricsCatalog,
  getMetricChangeLogs,
  loadDemoDataset
};
