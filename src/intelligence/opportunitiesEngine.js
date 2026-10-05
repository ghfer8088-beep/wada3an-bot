/**
 * Reactivation & Conversion Opportunity Engine
 * Manages 1,233 conversations as active reactivation opportunities
 * Generates natural suggested messages and reactivation angles grounded in real data
 */

const { getDb } = require('./db');

// Ensure database columns for opportunity workflow exist
function initOpportunityColumns() {
  const db = getDb();
  const info = db.prepare("PRAGMA table_info(conversations)").all();
  const colNames = info.map(c => c.name);

  if (!colNames.includes('opportunity_stage')) {
    db.prepare("ALTER TABLE conversations ADD COLUMN opportunity_stage TEXT DEFAULT 'لم يتم التواصل'").run();
  }
  if (!colNames.includes('custom_proposed_message')) {
    db.prepare("ALTER TABLE conversations ADD COLUMN custom_proposed_message TEXT").run();
  }
  if (!colNames.includes('last_action_at')) {
    db.prepare("ALTER TABLE conversations ADD COLUMN last_action_at DATETIME").run();
  }
  if (!colNames.includes('last_action_by')) {
    db.prepare("ALTER TABLE conversations ADD COLUMN last_action_by TEXT DEFAULT 'المسؤول'").run();
  }
  if (!colNames.includes('last_action_note')) {
    db.prepare("ALTER TABLE conversations ADD COLUMN last_action_note TEXT").run();
  }
}

// Friendly Arabic salutation and name formatting
function formatPersonName(fullName) {
  if (!fullName || fullName === 'مستخدم ماسنجر' || fullName.startsWith('مريض_')) return 'الكريم';
  const trimmed = fullName.trim();
  
  if (/^(أم|ام|أُم)\s+/i.test(trimmed)) {
    const parts = trimmed.split(/\s+/);
    return `أم ${parts[1] || ''}`.trim();
  }
  if (/^(om|um)\s+/i.test(trimmed)) {
    const parts = trimmed.split(/\s+/);
    return `أم ${parts[1] || ''}`.trim();
  }
  if (/^(أبو|ابو)\s+/i.test(trimmed)) {
    const parts = trimmed.split(/\s+/);
    return `أبو ${parts[1] || ''}`.trim();
  }
  if (/^(المهندس|مهندس)\s+/i.test(trimmed)) {
    const parts = trimmed.split(/\s+/);
    return `المهندس ${parts[1] || ''}`.trim();
  }
  if (/^(الدكتور|د\.|دكتور)\s+/i.test(trimmed)) {
    const parts = trimmed.split(/\s+/);
    return `دكتور ${parts[1] || ''}`.trim();
  }

  // First name fallback
  const first = trimmed.split(/\s+/)[0];
  return first || 'الكريم';
}

// Friendly duration calculation
function getInactivityDuration(dateStr) {
  if (!dateStr) return 'تاريخ غير مسجل';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  
  if (diffDays === 1) return 'منذ يوم واحد';
  if (diffDays === 2) return 'منذ يومين';
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  if (diffDays < 14) return 'منذ أسبوع';
  if (diffDays < 21) return 'منذ أسبوعين';
  if (diffDays < 30) return 'منذ 3 أسابيع';
  if (diffDays < 60) return 'منذ شهر';
  if (diffDays < 90) return 'منذ شهرين';
  if (diffDays < 365) return `منذ ${Math.floor(diffDays / 30)} أشهر`;
  
  const years = (diffDays / 365).toFixed(1);
  if (years === '1.0') return 'منذ سنة';
  if (years === '2.0') return 'منذ سنتين';
  return `منذ ${years} سنة`;
}

// Extract Opportunity Record attributes, angle, and personalized suggested message
function extractOpportunityData(conv, messages = []) {
  const formattedName = formatPersonName(conv.contact_name);
  const userMsgs = messages.filter(m => m.sender_type !== 'page');
  const lastUserMsg = userMsgs.length > 0 ? (userMsgs[userMsgs.length - 1].text || '') : (conv.last_user_message_text || '');
  const allUserText = userMsgs.map(m => m.text || '').join(' ') + ' ' + (conv.classification_evidence || '');

  // 1. Identify Specific Clinical Condition
  let specificSymptom = '';
  let symptomTopic = '';
  if (/عرق النسا|سياتيك|الرجل/i.test(allUserText)) {
    specificSymptom = 'علاج عرق النسا والآلام الممتدة للرجل';
    symptomTopic = 'عرق النسا والأعصاب';
  } else if (/انزلاق غضروفي|غضروف/i.test(allUserText)) {
    specificSymptom = 'علاج الانزلاق الغضروفي';
    symptomTopic = 'الانزلاق الغضروفي';
  } else if (/ديسك/i.test(allUserText)) {
    specificSymptom = 'علاج مشاكل وآلام الديسك';
    symptomTopic = 'ديسك الظهر';
  } else if (/رقب[ةه]|فقرات عنقية|صداع/i.test(allUserText)) {
    specificSymptom = 'آلام الرقبة والفقرات العنقية';
    symptomTopic = 'الفقرات العنقية والرقبة';
  } else if (/ركب[ةه]|خشون[ةه]|مفصل/i.test(allUserText)) {
    specificSymptom = 'علاج خشونة وآلام الركبة والمفاصل';
    symptomTopic = 'خشونة الركبة والمفاصل';
  } else if (/ظهر|فقرات قطنية/i.test(allUserText)) {
    specificSymptom = 'آلام أسفل الظهر والفقرات';
    symptomTopic = 'آلام الظهر';
  } else if (conv.has_medical_need === 1) {
    specificSymptom = 'المشكلة الصحية والآلام التي استفسرت عنها سابقاً';
    symptomTopic = 'حالة سريرية عامة';
  }

  // 2. Identify Last Topic
  let lastTopic = 'استفسار عام عن خدمات المركز';
  if (symptomTopic) {
    lastTopic = symptomTopic;
  } else if (conv.has_appointment_request === 1 || /حجز|موعد|بدي اجي/i.test(lastUserMsg)) {
    lastTopic = 'طلب حجز موعد كشفية';
  } else if (conv.has_phone_shared === 1 || /(07\d{8})/.test(lastUserMsg)) {
    lastTopic = 'مشاركة رقم الهاتف للاتصال';
  } else if (conv.has_price_inquiry === 1 || /سعر|كم|كشف|تكلف[ةه]|جلس[ةه]/i.test(lastUserMsg)) {
    lastTopic = 'استفسار عن كلفة وجلسات العلاج';
  } else if (/موقع|وين|خلدا|مكان/i.test(lastUserMsg)) {
    lastTopic = 'موقع العيادة في خلدا والدوام';
  }

  // 3. Last Question or Request by Customer
  let lastCustomerQuestion = lastUserMsg.trim() ? lastUserMsg.trim().substring(0, 110) : 'بدء محادثة أولية عبر ماسنجر';

  // 4. Reactivation Angle (Strictly grounded in facts)
  let angle = 'إعادة فتح الحوار بمتابعة ودية عامة (General Re-engagement)';
  let angleKey = 'general';

  if (specificSymptom) {
    angle = `متابعة مشكلة صحية ذكرها العميل (${symptomTopic})`;
    angleKey = 'medical';
  } else if (conv.has_appointment_request === 1) {
    angle = 'استكمال طلب حجز موعد كشفية';
    angleKey = 'appointment';
  } else if (conv.has_phone_shared === 1) {
    angle = 'متابعة رقم الهاتف المتروك للتواصل';
    angleKey = 'phone';
  } else if (conv.has_price_inquiry === 1) {
    angle = 'متابعة سؤال السعر وتكلفة الجلسات';
    angleKey = 'price';
  } else if (/موقع|وين|خلدا|دوام|ساعات/i.test(allUserText)) {
    angle = 'متابعة استفسار عن موقع العيادة والدوام';
    angleKey = 'location';
  } else {
    angle = 'إعادة فتح الحوار بمتابعة ودية عامة (General Re-engagement)';
    angleKey = 'general';
  }

  // 5. Suggested Reactivation Message (Natural, respectful, non-spam)
  let suggestedMessage = '';
  const salutation = (formattedName.startsWith('أم ') || formattedName.startsWith('أبو ') || formattedName.startsWith('المهندس ') || formattedName.startsWith('دكتور ')) 
    ? formattedName 
    : `أستاذ ${formattedName}`;

  if (conv.custom_proposed_message && conv.custom_proposed_message.trim()) {
    suggestedMessage = conv.custom_proposed_message;
  } else if (angleKey === 'medical') {
    suggestedMessage = `مرحباً بك ${salutation}، يسعد أوقاتك من مركز وداعاً للألم في خلدا. تواصلت معنا سابقاً بخصوص (${specificSymptom}). حبينا نتطمن على صحتك وكيف أصبحت الأمور معك الآن؟ وإذا ما زلت بحاجة لأي استشارة أو مساعدة فريقنا الطبي جاهز لخدمتك بكل سرور.`;
  } else if (angleKey === 'appointment') {
    suggestedMessage = `مرحباً ${salutation}، أهلاً بك من مركز وداعاً للألم بخلدا. تذكرنا رغبتك السابقة في حجز موعد للمعاينة، وحبينا نتأكد إذا بتحب ننسقلك موعد كشفية مناسب لك مع الفريق الطبي في فرع خلدا هذا الأسبوع؟`;
  } else if (angleKey === 'price') {
    suggestedMessage = `مرحباً ${salutation}، يسعد أوقاتك من مركز وداعاً للألم. تذكرنا استفسارك السابق بخصوص جلسات العلاج وتكلفتها، وحبينا نعرف إذا ما زلت مهتماً بالبدء معنا أو إذا بتحب نوضحلك أي تفاصيل إضافية عن خطط العلاج المتاحة في فرع خلدا.`;
  } else if (angleKey === 'phone') {
    suggestedMessage = `مرحباً ${salutation}، أهلاً بك من مركز وداعاً للألم. رقم هاتفك مسجل لدينا من تواصلك السابق، وحبينا نسأل إذا بتفضل نحدد وقت مناسب لنتصل بحضرتك ونوضحلك كل ما تحتاجه عن خدمات المركز.`;
  } else if (angleKey === 'location') {
    suggestedMessage = `مرحباً ${salutation}، يسعد أوقاتك من مركز وداعاً للألم في خلدا. تواصلت معنا سابقاً بخصوص موقع العيادة وساعات العمل، وحبينا نتأكد إذا كنت بحاجة للمساعدة بزيارتنا أو حجز موعد كشفية مناسب لك.`;
  } else {
    suggestedMessage = `مرحباً ${salutation}، أهلاً بك من مركز وداعاً للألم لعلاج العمود الفقري والمفاصل في خلدا. لاحظنا تواصلك السابق معنا، وحبينا نسأل بلطف إذا بنقدر نساعدك بأي استفسار أو استشارة بخصوص العلاج الطبيعي والتأهيلي.`;
  }

  // 6. Richness Score (for default ranking: highest contextual richness first)
  let richnessScore = 10;
  if (conv.has_medical_need === 1) richnessScore += 40;
  if (conv.has_price_inquiry === 1) richnessScore += 25;
  if (conv.has_appointment_request === 1) richnessScore += 25;
  if (conv.has_phone_shared === 1) richnessScore += 20;
  if (conv.message_count >= 4) richnessScore += 10;
  if (conv.source === 'Ad response') richnessScore += 5;

  return {
    formattedName,
    inactivityDuration: getInactivityDuration(conv.last_message_at),
    lastTopic,
    lastCustomerQuestion,
    reactivationAngle: angle,
    angleKey,
    suggestedMessage,
    richnessScore
  };
}

// ─────────────────────────────────────────────────────────────
// OPPORTUNITY PIPELINE & METRICS
// ─────────────────────────────────────────────────────────────

function getOpportunityPipelineKPIs() {
  initOpportunityColumns();
  const db = getDb();

  const total = db.prepare('SELECT COUNT(*) as count FROM conversations').get().count;

  // Opportunity Stages Counts
  const stageRows = db.prepare(`
    SELECT COALESCE(opportunity_stage, 'لم يتم التواصل') as stage, COUNT(*) as count
    FROM conversations
    GROUP BY stage
  `).all();

  const stageCounts = {
    'لم يتم التواصل': 0,
    'تم التواصل': 0,
    'رد العميل': 0,
    'مهتم': 0,
    'طلب السعر': 0,
    'طلب موعد': 0,
    'تم تحديد موعد': 0,
    'أصبح عميلاً': 0,
    'غير مهتم': 0,
    'لم يرد': 0,
    'يحتاج متابعة': 0,
    'مغلق': 0
  };

  for (const r of stageRows) {
    if (stageCounts[r.stage] !== undefined) {
      stageCounts[r.stage] = r.count;
    } else {
      stageCounts['لم يتم التواصل'] += r.count;
    }
  }

  // Pipeline funnel stages:
  // 1. Total Opportunities: 1,233
  // 2. Ready for Reactivation: (لم يتم التواصل)
  // 3. Contacted: (تم التواصل + any subsequent active stage)
  // 4. Responded: (رد العميل + any subsequent active stage)
  // 5. Interested: (مهتم + طلب السعر + طلب موعد + تم تحديد موعد + أصبح عميلاً)
  // 6. Appointment Requested: (طلب موعد + تم تحديد موعد + أصبح عميلاً)
  // 7. Appointment Scheduled: (تم تحديد موعد + أصبح عميلاً)
  // 8. Became Customer: (أصبح عميلاً)

  const activeContacted = total - stageCounts['لم يتم التواصل'];
  const responded = stageCounts['رد العميل'] + stageCounts['مهتم'] + stageCounts['طلب السعر'] + stageCounts['طلب موعد'] + stageCounts['تم تحديد موعد'] + stageCounts['أصبح عميلاً'];
  const interested = stageCounts['مهتم'] + stageCounts['طلب السعر'] + stageCounts['طلب موعد'] + stageCounts['تم تحديد موعد'] + stageCounts['أصبح عميلاً'];
  const apptRequested = stageCounts['طلب موعد'] + stageCounts['تم تحديد موعد'] + stageCounts['أصبح عميلاً'];
  const apptScheduled = stageCounts['تم تحديد موعد'] + stageCounts['أصبح عميلاً'];
  const becameCustomer = stageCounts['أصبح عميلاً'];

  return {
    totalOpportunities: total,
    readyForReactivation: stageCounts['لم يتم التواصل'],
    contactedCount: activeContacted,
    respondedCount: responded,
    interestedCount: interested,
    apptRequestedCount: apptRequested,
    apptScheduledCount: apptScheduled,
    becameCustomerCount: becameCustomer,
    stageCounts,
    pipeline: [
      { name: 'إجمالي الفرص', count: total, key: 'total' },
      { name: 'جاهزة لإعادة التنشيط', count: stageCounts['لم يتم التواصل'], key: 'ready' },
      { name: 'تم التواصل', count: activeContacted, key: 'contacted' },
      { name: 'رد العميل', count: responded, key: 'responded' },
      { name: 'أبدى اهتماماً', count: interested, key: 'interested' },
      { name: 'طلب موعد', count: apptRequested, key: 'appt_req' },
      { name: 'موعد مؤكد', count: apptScheduled, key: 'appt_conf' },
      { name: 'أصبح عميلاً', count: becameCustomer, key: 'customer' }
    ]
  };
}

// ─────────────────────────────────────────────────────────────
// QUERY OPPORTUNITIES LIST (PAGINATED, SORTED, FILTERED)
// ─────────────────────────────────────────────────────────────

function getOpportunitiesList(filters = {}, page = 1, limit = 25, sort = 'richness') {
  initOpportunityColumns();
  const db = getDb();

  let conditions = [];
  let params = [];

  if (filters.search) {
    conditions.push('(c.name LIKE ? OR cv.last_user_message_text LIKE ? OR c.phone LIKE ? OR cv.summary LIKE ?)');
    const term = `%${filters.search}%`;
    params.push(term, term, term, term);
  }

  if (filters.stage && filters.stage !== 'all') {
    conditions.push("COALESCE(cv.opportunity_stage, 'لم يتم التواصل') = ?");
    params.push(filters.stage);
  }

  if (filters.has_price !== undefined && filters.has_price !== '') {
    conditions.push('cv.has_price_inquiry = ?');
    params.push(filters.has_price === 'true' || filters.has_price === '1' ? 1 : 0);
  }

  if (filters.has_medical !== undefined && filters.has_medical !== '') {
    conditions.push('cv.has_medical_need = ?');
    params.push(filters.has_medical === 'true' || filters.has_medical === '1' ? 1 : 0);
  }

  if (filters.has_appt !== undefined && filters.has_appt !== '') {
    conditions.push('cv.has_appointment_request = ?');
    params.push(filters.has_appt === 'true' || filters.has_appt === '1' ? 1 : 0);
  }

  if (filters.has_phone !== undefined && filters.has_phone !== '') {
    conditions.push('cv.has_phone_shared = ?');
    params.push(filters.has_phone === 'true' || filters.has_phone === '1' ? 1 : 0);
  }

  if (filters.source && filters.source !== 'all') {
    conditions.push('cv.source = ?');
    params.push(filters.source);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total matches
  const total = db.prepare(`
    SELECT COUNT(*) as count
    FROM conversations cv
    JOIN contacts c ON cv.contact_id = c.id
    ${whereSql}
  `).get(...params).count;

  // Sorting logic
  let orderBy = 'cv.last_message_at DESC';
  if (sort === 'newest') orderBy = 'cv.last_message_at DESC';
  else if (sort === 'oldest') orderBy = 'cv.last_message_at ASC';
  else if (sort === 'has_price') orderBy = 'cv.has_price_inquiry DESC, cv.last_message_at DESC';
  else if (sort === 'has_medical') orderBy = 'cv.has_medical_need DESC, cv.last_message_at DESC';
  else if (sort === 'has_appt') orderBy = 'cv.has_appointment_request DESC, cv.last_message_at DESC';
  else if (sort === 'has_phone') orderBy = 'cv.has_phone_shared DESC, cv.last_message_at DESC';
  else if (sort === 'source') orderBy = 'cv.source DESC, cv.last_message_at DESC';
  else {
    // Default: 'richness' (rich contextual information first)
    orderBy = '(cv.has_medical_need * 40 + cv.has_price_inquiry * 25 + cv.has_appointment_request * 25 + cv.has_phone_shared * 20 + cv.message_count) DESC, cv.last_message_at DESC';
  }

  const offset = (page - 1) * limit;

  const rows = db.prepare(`
    SELECT 
      cv.id, cv.meta_conversation_id, cv.source, cv.ad_name,
      cv.first_message_at, cv.last_message_at, cv.message_count,
      cv.lead_stage, cv.system_lead_stage, cv.manual_lead_stage,
      cv.has_price_inquiry, cv.has_medical_need, cv.has_appointment_request,
      cv.has_phone_shared, cv.has_appointment_confirmed, cv.has_attended,
      cv.is_explicit_rejection, cv.classification_evidence,
      cv.last_user_message_text, cv.opportunity_stage, cv.custom_proposed_message,
      cv.last_action_at, cv.last_action_by, cv.last_action_note,
      c.id as contact_id, c.name as contact_name, c.phone as contact_phone, c.profile_url
    FROM conversations cv
    JOIN contacts c ON cv.contact_id = c.id
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  // Enrich each row with opportunity details
  const enriched = rows.map(r => {
    const opp = extractOpportunityData(r);
    return {
      id: r.id,
      meta_conversation_id: r.meta_conversation_id,
      contact_id: r.contact_id,
      contact_name: r.contact_name,
      formatted_name: opp.formattedName,
      contact_phone: r.contact_phone,
      profile_url: r.profile_url,
      source: r.source,
      ad_name: r.ad_name,
      first_message_at: r.first_message_at,
      last_message_at: r.last_message_at,
      inactivity_duration: opp.inactivityDuration,
      message_count: r.message_count,
      lead_stage: r.manual_lead_stage || r.system_lead_stage || r.lead_stage,
      has_price_inquiry: r.has_price_inquiry === 1,
      has_medical_need: r.has_medical_need === 1,
      has_appointment_request: r.has_appointment_request === 1,
      has_phone_shared: r.has_phone_shared === 1,
      has_appointment_confirmed: r.has_appointment_confirmed === 1,
      has_booking_visit_signal: (r.has_appointment_request === 1 || r.has_phone_shared === 1 || r.has_appointment_confirmed === 1),
      last_topic: opp.lastTopic,
      last_customer_question: opp.lastCustomerQuestion,
      reactivation_angle: opp.reactivationAngle,
      angle_key: opp.angleKey,
      suggested_message: opp.suggestedMessage,
      opportunity_stage: r.opportunity_stage || 'لم يتم التواصل',
      last_action_at: r.last_action_at,
      last_action_by: r.last_action_by,
      last_action_note: r.last_action_note,
      richness_score: opp.richnessScore
    };
  });

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    opportunities: enriched
  };
}

// ─────────────────────────────────────────────────────────────
// GET SINGLE OPPORTUNITY DETAILS (FULL TIMELINE + MESSAGES)
// ─────────────────────────────────────────────────────────────

function getOpportunityDetail(conversationId) {
  initOpportunityColumns();
  const db = getDb();

  const conv = db.prepare(`
    SELECT cv.*, c.name as contact_name, c.phone as contact_phone, c.city as contact_city, c.profile_url
    FROM conversations cv
    JOIN contacts c ON cv.contact_id = c.id
    WHERE cv.id = ?
  `).get(conversationId);

  if (!conv) return null;

  const messages = db.prepare(`
    SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC
  `).all(conversationId);

  const oppData = extractOpportunityData(conv, messages);

  // Timeline representation
  const timeline = [];
  if (messages.length > 0) {
    timeline.push({
      step: 1,
      title: 'بدء التواصل (Conversation Started)',
      timestamp: messages[0].timestamp,
      reached: true,
      quote: messages[0].text ? messages[0].text.substring(0, 100) : ''
    });
  }

  if (conv.has_medical_need === 1) {
    const medMsg = messages.find(m => m.sender_type !== 'page' && /ديسك|غضروف|ظهر|رقب[ةه]|فقر|عصب|عرق النسا|وجع|ألم/i.test(m.text || ''));
    timeline.push({
      step: 2,
      title: 'شرح مشكلة صحية (Medical Need)',
      timestamp: medMsg ? medMsg.timestamp : null,
      reached: true,
      quote: medMsg ? medMsg.text.substring(0, 120) : ''
    });
  }

  if (conv.has_price_inquiry === 1) {
    const priceMsg = messages.find(m => m.sender_type !== 'page' && /سعر|كم|كشف|كشفي|تكلف|جلس/i.test(m.text || ''));
    timeline.push({
      step: 3,
      title: 'استفسار عن السعر (Price Inquiry)',
      timestamp: priceMsg ? priceMsg.timestamp : null,
      reached: true,
      quote: priceMsg ? priceMsg.text.substring(0, 120) : ''
    });
  }

  if (conv.has_appointment_request === 1 || conv.has_phone_shared === 1) {
    const actMsg = messages.find(m => m.sender_type !== 'page' && (/حجز|موعد|بدي اجي/i.test(m.text || '') || /(07\d{8})/.test(m.text || '')));
    timeline.push({
      step: 4,
      title: conv.has_appointment_request === 1 ? 'طلب موعد كشفية' : 'مشاركة رقم الهاتف',
      timestamp: actMsg ? actMsg.timestamp : null,
      reached: true,
      quote: actMsg ? actMsg.text.substring(0, 120) : ''
    });
  }

  if (conv.has_appointment_confirmed === 1) {
    timeline.push({
      step: 5,
      title: 'موعد مؤكد بالشات',
      timestamp: null,
      reached: true,
      quote: 'تم تأكيد الموعد مسبقاً'
    });
  } else {
    timeline.push({
      step: timeline.length + 1,
      title: 'توقف العميل (Customer Stopped)',
      timestamp: conv.last_message_at,
      reached: true,
      quote: 'آخر تفاعل مسجل من العميل'
    });
  }

  return {
    opportunity: {
      ...conv,
      ...oppData,
      opportunity_stage: conv.opportunity_stage || 'لم يتم التواصل',
      why_in_opportunities: 'هذه المحادثة تحتوي على تفاعل سابق من العميل عبر الصفحة، ويمكن محاولة إعادة فتح الحوار بناءً على آخر نقطة توقف دون افتراض أي مسببات مسبقة.'
    },
    messages,
    timeline
  };
}

// ─────────────────────────────────────────────────────────────
// UPDATE OPPORTUNITY STAGE & PROPOSED MESSAGE
// ─────────────────────────────────────────────────────────────

function updateOpportunityRecord(conversationId, updateData) {
  initOpportunityColumns();
  const db = getDb();

  const old = db.prepare('SELECT opportunity_stage FROM conversations WHERE id = ?').get(conversationId);
  if (!old) return false;

  const stage = updateData.stage || old.opportunity_stage || 'لم يتم التواصل';
  const customMessage = updateData.custom_message !== undefined ? updateData.custom_message : null;
  const note = updateData.note || null;
  const userName = updateData.user_name || 'مسؤول المتابعة';

  db.prepare(`
    UPDATE conversations SET
      opportunity_stage = ?,
      custom_proposed_message = COALESCE(?, custom_proposed_message),
      last_action_note = COALESCE(?, last_action_note),
      last_action_at = CURRENT_TIMESTAMP,
      last_action_by = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(stage, customMessage, note, userName, conversationId);

  // Log in audit log
  db.prepare(`
    INSERT INTO audit_logs (id, user_name, action, object_type, object_id, old_value, new_value)
    VALUES (?, ?, 'تحديث مسار فرصة إعادة التنشيط', 'opportunity', ?, ?, ?)
  `).run(
    `aud_${Date.now()}`,
    userName,
    conversationId,
    old.opportunity_stage || 'لم يتم التواصل',
    `${stage}${note ? ` (ملاحظة: ${note})` : ''}`
  );

  return true;
}

module.exports = {
  initOpportunityColumns,
  getOpportunityPipelineKPIs,
  getOpportunitiesList,
  getOpportunityDetail,
  updateOpportunityRecord,
  extractOpportunityData,
  formatPersonName,
  getInactivityDuration
};
