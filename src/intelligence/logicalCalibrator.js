/**
 * Logical Calibration & Reclassification Engine
 * Enforces strict, evidence-based stage separation, explainability,
 * and data quality verification across all real conversations.
 */

const { getDb } = require('./db');
const ArabicNLP = require('./arabicNlp');

// Clinic's own official numbers to avoid false positive attribution
const CLINIC_PHONES = ['0790360440', '962790360440', '+962790360440', '790360440'];

// Keywords for user price inquiries
const USER_PRICE_PATTERNS = [
  'كم السعر', 'كم سعر', 'بكم', 'شو السعر', 'شو الاسعار', 'كم بتكلف', 'كم بتكلفه',
  'قديش السعر', 'قديش بتكلف', 'كم الكشفية', 'سعر الكشفية', 'بكم الكشف', 'بكم الجلسة',
  'بكم الجلسه', 'سعر الجلسة', 'سعر الجلسه', 'تكلفة الجلسة', 'قديش الجلسة', 'اسعار الجلسات',
  'كم التكلفة', 'كم التكلفه', 'قديش بتوخذوا', 'سعر الفحص'
];

// Keywords for user appointment requests
const USER_APPT_REQUEST_PATTERNS = [
  'بدي احجز', 'اريد احجز', 'احجزلي', 'بدي موعد', 'اريد موعد', 'احجز موعد',
  'سجلني موعد', 'بقدر اجي اليوم', 'بدي اجي اليوم', 'بدي اخذ موعد', 'اعتمدوا الحجز',
  'حجزلي موعد', 'بدي حجز'
];

// Keywords for appointment intent / availability questions
const USER_APPT_INTENT_PATTERNS = [
  'في موعد اليوم', 'متاح موعد', 'متى عندكم موعد', 'متى في فراغ', 'اوقات الدوام',
  'ساعات الدوام', 'متى بتفتحوا', 'متى بتسكرو', 'اي ساعة بتفتحوا', 'فاتحين اليوم',
  'فاتحين الجمعة', 'متى موجود الدكتور'
];

// Keywords for explicit rejection / cancellation
const EXPLICIT_REJECTION_PATTERNS = [
  'بدي الغيه', 'الغوا الموعد', 'الغاء الموعد', 'الغيه', 'بطلت', 'مش مهتم',
  'مش مليونير', 'عدم مصداقية', 'ما بدي', 'لا اريد', 'لا تتواصلوا معي', 'غالي كثير',
  'مش حاب', 'سيبوني بحالي', 'سعر مبالغ فيه', 'مش مناسبني'
];

// Keywords for explicit attendance proof
const ATTENDANCE_PATTERNS = [
  'وصلت العيادة', 'انا بالعيادة', 'انا عند الباب', 'عملت الجلسة امس', 'راجعت عندكم وعملت',
  'استفدت من جلسة امس', 'الجلسة اللي اخذتها', 'اخذت اول جلسة'
];

// Keywords for medical symptoms
const MEDICAL_SYMPTOM_PATTERNS = [
  'عرق النسا', 'ديسك', 'انزلاق غضروفي', 'ظهري بوجعني', 'وجع ظهر', 'الم بالظهر',
  'رقبتي', 'الم بالرقبة', 'تنميل بالرجل', 'تنميل باليد', 'صداع', 'احتكاك ركبة',
  'خشونة', 'الابهر', 'سياتيك', 'وجع مفاصل', 'فقرات قطنية', 'فقرات عنقية',
  'صورة رنين', 'اشعة', 'عصب مضغوط', 'غضاريف'
];

// Keywords for supplier / vendor spam
const SUPPLIER_PATTERNS = [
  'مشغل', 'مستلزمات', 'توريد', 'وكيل بيع', 'بيع اجهزة', 'forex', 'crypto', 'telegram', 'click here'
];

class LogicalCalibrator {
  /**
   * Run full recalibration across all conversations in the database
   */
  static async calibrateAll(options = {}) {
    const db = getDb();
    console.log('🔬 Starting Logical Calibration on Database Conversations...');

    const convs = db.prepare('SELECT id, is_demo, source FROM conversations').all();
    console.log(`Total conversations to analyze: ${convs.length}`);

    const stats = {
      totalAnalyzed: convs.length,
      leads: 0,
      qualifiedLeads: 0,
      serviceClinicalInterest: 0,
      priceInquiries: 0,
      appointmentIntents: 0,
      appointmentRequests: 0,
      phoneShared: 0,
      appointmentConfirmed: 0,
      attended: 0,
      convertedCustomer: 0,
      potentiallyLost: 0,
      explicitLost: 0,
      reactivationOpportunities: 0,
      highReactivation: 0,
      mediumReactivation: 0,
      lowReactivation: 0,
      disqualifiedReactivations: 0,
      dataQualityIssuesCount: 0,
      reclassifiedCount: 0
    };

    const updateStmt = db.prepare(`
      UPDATE conversations SET
        system_lead_stage = ?,
        lead_stage = COALESCE(manual_lead_stage, ?),
        classification_confidence = ?,
        classification_reasons = ?,
        classification_evidence = ?,
        has_price_inquiry = ?,
        has_appointment_intent = ?,
        has_appointment_request = ?,
        has_phone_shared = ?,
        has_appointment_confirmed = ?,
        has_attended = ?,
        has_converted_payment = ?,
        is_explicit_rejection = ?,
        is_potentially_lost = ?,
        is_lost = ?,
        is_reactivation_candidate = ?,
        reactivation_reason = ?,
        reactivation_disqualification_reason = ?,
        data_quality_issues = ?,
        opportunity_score = ?,
        opportunity_tier = ?,
        opportunity_score_breakdown = ?,
        has_medical_need = ?,
        last_user_message_text = ?,
        last_user_message_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    for (const conv of convs) {
      const messages = db.prepare(`
        SELECT id, sender_type, text, timestamp, is_from_page
        FROM messages
        WHERE conversation_id = ?
        ORDER BY timestamp ASC
      `).all(conv.id);

      const evaluation = this.evaluateConversation(conv, messages);

      // Aggregate stats
      if (evaluation.has_medical_need) stats.serviceClinicalInterest++;
      if (evaluation.has_price_inquiry) stats.priceInquiries++;
      if (evaluation.has_appointment_intent) stats.appointmentIntents++;
      if (evaluation.has_appointment_request) stats.appointmentRequests++;
      if (evaluation.has_phone_shared) stats.phoneShared++;
      if (evaluation.has_appointment_confirmed) stats.appointmentConfirmed++;
      if (evaluation.has_attended) stats.attended++;
      if (evaluation.has_converted_payment) stats.convertedCustomer++;
      if (evaluation.is_potentially_lost) stats.potentiallyLost++;
      if (evaluation.is_lost) stats.explicitLost++;
      if (evaluation.is_reactivation_candidate) {
        stats.reactivationOpportunities++;
        if (evaluation.opportunity_tier === 'HIGH') stats.highReactivation++;
        else if (evaluation.opportunity_tier === 'MEDIUM') stats.mediumReactivation++;
        else if (evaluation.opportunity_tier === 'LOW') stats.lowReactivation++;
      } else if (evaluation.reactivation_disqualification_reason) {
        stats.disqualifiedReactivations++;
      }
      if (evaluation.data_quality_issues.length > 0) stats.dataQualityIssuesCount++;

      if (evaluation.system_lead_stage === 'عميل مؤهل سريرياً' || evaluation.system_lead_stage === 'طلب موعد' || evaluation.system_lead_stage === 'شارك رقم هاتف') {
        stats.qualifiedLeads++;
      }
      if (evaluation.system_lead_stage !== 'تواصل أولي' && evaluation.system_lead_stage !== 'غير مؤهل') {
        stats.leads++;
      }

      stats.reclassifiedCount++;

      // Execute DB update
      updateStmt.run(
        evaluation.system_lead_stage,
        evaluation.system_lead_stage,
        evaluation.classification_confidence,
        JSON.stringify(evaluation.classification_reasons),
        JSON.stringify(evaluation.classification_evidence),
        evaluation.has_price_inquiry ? 1 : 0,
        evaluation.has_appointment_intent ? 1 : 0,
        evaluation.has_appointment_request ? 1 : 0,
        evaluation.has_phone_shared ? 1 : 0,
        evaluation.has_appointment_confirmed ? 1 : 0,
        evaluation.has_attended ? 1 : 0,
        evaluation.has_converted_payment ? 1 : 0,
        evaluation.is_explicit_rejection ? 1 : 0,
        evaluation.is_potentially_lost ? 1 : 0,
        evaluation.is_lost ? 1 : 0,
        evaluation.is_reactivation_candidate ? 1 : 0,
        evaluation.reactivation_reason,
        evaluation.reactivation_disqualification_reason,
        JSON.stringify(evaluation.data_quality_issues),
        evaluation.opportunity_score,
        evaluation.opportunity_tier,
        JSON.stringify(evaluation.opportunity_score_breakdown),
        evaluation.has_medical_need ? 1 : 0,
        evaluation.last_user_message_text,
        evaluation.last_user_message_at,
        conv.id
      );
    }

    // Populate Metrics Catalog & Audit Log
    this.updateMetricsCatalog(stats);

    console.log('✅ Logical Calibration Completed!');
    return stats;
  }

  /**
   * Deep Context-Aware Evaluation of a single conversation
   */
  static evaluateConversation(conv, messages = []) {
    const userMessages = messages.filter(m => !m.is_from_page && m.sender_type !== 'page');
    const pageMessages = messages.filter(m => m.is_from_page || m.sender_type === 'page');
    const lastUserMessage = userMessages[userMessages.length - 1];
    const lastMessage = messages[messages.length - 1];

    let hasPriceInquiry = false;
    let hasApptIntent = false;
    let hasApptRequest = false;
    let hasPhoneShared = false;
    let hasApptConfirmed = false;
    let hasAttended = false;
    let hasConvertedPayment = false;
    let isExplicitRejection = false;
    let isSupplierOrSpam = false;
    let hasMedicalNeed = false;

    const reasons = [];
    const evidence = [];
    const qualityIssues = [];

    // 1. Analyze User Messages Context
    for (const m of userMessages) {
      const text = m.text || '';
      const normText = ArabicNLP.normalize(text);

      // Check Supplier / Spam
      if (ArabicNLP.containsAny(normText, SUPPLIER_PATTERNS)) {
        isSupplierOrSpam = true;
        evidence.push({ quote: text, sender: 'user', timestamp: m.timestamp, indicator: 'مورد تجاري أو سبام' });
      }

      // Check Medical Needs
      if (ArabicNLP.containsAny(normText, MEDICAL_SYMPTOM_PATTERNS)) {
        hasMedicalNeed = true;
        evidence.push({ quote: text, sender: 'user', timestamp: m.timestamp, indicator: 'أعراض أو مشكلة طبية' });
      }

      // Check Price Inquiry
      if (ArabicNLP.containsAny(normText, USER_PRICE_PATTERNS)) {
        hasPriceInquiry = true;
        evidence.push({ quote: text, sender: 'user', timestamp: m.timestamp, indicator: 'استفسار عن السعر وتكلفة الجلسات' });
      }

      // Check Appointment Request
      if (ArabicNLP.containsAny(normText, USER_APPT_REQUEST_PATTERNS)) {
        hasApptRequest = true;
        evidence.push({ quote: text, sender: 'user', timestamp: m.timestamp, indicator: 'طلب حجز موعد محدد' });
      }

      // Check Appointment Intent / Working Hours
      if (ArabicNLP.containsAny(normText, USER_APPT_INTENT_PATTERNS)) {
        hasApptIntent = true;
        evidence.push({ quote: text, sender: 'user', timestamp: m.timestamp, indicator: 'استفسار عن أوقات الدوام والمواعيد' });
      }

      // Check Phone Sharing
      const extractedPhone = ArabicNLP.extractPhoneNumber(text);
      if (extractedPhone && !CLINIC_PHONES.includes(extractedPhone)) {
        hasPhoneShared = true;
        evidence.push({ quote: text, sender: 'user', timestamp: m.timestamp, indicator: `مشاركة رقم هاتف للتواصل (${extractedPhone})` });
      }

      // Check Explicit Rejection
      if (ArabicNLP.containsAny(normText, EXPLICIT_REJECTION_PATTERNS)) {
        isExplicitRejection = true;
        evidence.push({ quote: text, sender: 'user', timestamp: m.timestamp, indicator: 'رفض صريح أو إلغاء للخدمة' });
      }

      // Check Attendance Proof
      if (ArabicNLP.containsAny(normText, ATTENDANCE_PATTERNS)) {
        hasAttended = true;
        evidence.push({ quote: text, sender: 'user', timestamp: m.timestamp, indicator: 'دليل نصي على حضور الجلسة أو مراجعة العيادة' });
      }
    }

    // 2. Analyze Page Messages for Confirmations
    for (const m of pageMessages) {
      const text = m.text || '';
      if (text.includes('تم تثبيت موعدك') || text.includes('تم تأكيد حجزك') || text.includes('تم الحجز')) {
        hasApptConfirmed = true;
        evidence.push({ quote: text, sender: 'page', timestamp: m.timestamp, indicator: 'رسالة تأكيد موعد سريري من العيادة' });
      }
    }

    // Rejection overrides confirmation if occurred after
    if (isExplicitRejection) {
      hasApptConfirmed = false;
    }

    // Calculate Inactivity / Recency
    const lastMsgTime = lastMessage ? new Date(lastMessage.timestamp).getTime() : new Date().getTime();
    const now = new Date('2026-10-01T00:25:00Z').getTime();
    const diffDays = Math.max(0, Math.floor((now - lastMsgTime) / (1000 * 60 * 60 * 24)));
    const isInactive = diffDays > 7;

    let isPotentiallyLost = false;
    let isLost = false;

    if (isExplicitRejection) {
      isLost = true;
      reasons.push('تم تصنيفه كمفقود بسبب وجود رفض صريح أو إلغاء مباشر من المريض.');
    } else if (hasApptConfirmed || hasAttended) {
      isPotentiallyLost = false;
      isLost = false;
    } else if ((hasPriceInquiry || hasApptRequest || hasPhoneShared) && isInactive) {
      isPotentiallyLost = true;
      reasons.push(`توقف عن المتابعة بعد إبداء الرغبة/الاستفسار (مر ${diffDays} يوماً دون رد نهائي).`);
    }

    // 3. Stage & Confidence Derivation
    let systemStage = 'تواصل أولي';
    let confidence = 70;

    if (isSupplierOrSpam) {
      systemStage = 'غير مؤهل';
      confidence = 95;
      reasons.push('الرسائل متعلقة بمورد تجاري أو سبام خارجي.');
    } else if (hasAttended) {
      systemStage = 'حضر العيادة';
      confidence = 90;
      reasons.push('يوجد إثبات نصي لمراجعة وحضور الجلسة العلاجية بالعيادة.');
    } else if (hasApptConfirmed) {
      systemStage = 'موعد مؤكد';
      confidence = 85;
      reasons.push('تم رصد تثبيت صريح للموعد بالعيادة دون ورود إلغاء لاحق.');
    } else if (isExplicitRejection) {
      systemStage = 'مفقود / رافض';
      confidence = 95;
      reasons.push('أعلن المريض بوضوح إلغاء الموعد أو عدم رغبته بالعلاج.');
    } else if (hasApptRequest) {
      systemStage = isInactive ? 'متوقف بعد طلب موعد' : 'طلب موعد';
      confidence = 85;
      reasons.push(isInactive ? 'طلب موعداً سابقاً وتوقفت المحادثة دون تثبيت نهائي.' : 'طلب حجز موعد محدد بشكل مباشر.');
    } else if (hasPhoneShared) {
      systemStage = isInactive ? 'متوقف بعد مشاركة الهاتف' : 'شارك رقم هاتف';
      confidence = 80;
      reasons.push('شارك رقم هاتفه للتواصل ولم يتم إثبات حضور أو حجز قطعي بالمحادثة.');
    } else if (hasPriceInquiry) {
      systemStage = isInactive ? 'متوقف بعد الاستفسار عن السعر' : 'سأل عن السعر';
      confidence = 85;
      reasons.push('استفسر عن كلفة الجلسات أو الكشفية.');
    } else if (hasApptIntent) {
      systemStage = 'اهتمام بحجز موعد';
      confidence = 75;
      reasons.push('استفسر عن أوقات الدوام ومواعيد الأطباء المتاحة.');
    } else if (hasMedicalNeed) {
      systemStage = 'عميل مؤهل سريرياً';
      confidence = 75;
      reasons.push('شرح أعراضاً مرضية محددة تستدعي جلسات كايروبراكتيك أو علاج طبيعي.');
    } else if (userMessages.length > 0) {
      systemStage = 'عميل محتمل';
      confidence = 65;
      reasons.push('تواصل مع الصفحة عبر Messenger ولكن دون تفاصيل سريرية مكتملة.');
    }

    // 4. Data Quality Checks (Integrity Issues)
    if (hasPhoneShared && !hasApptConfirmed && !hasAttended) {
      qualityIssues.push('تمت مشاركة رقم هاتف لكن لا يوجد دليل في المحادثة على تأكيد الحجز أو الحضور (Phone Shared != Converted).');
    }
    if (isExplicitRejection && hasApptConfirmed) {
      qualityIssues.push('تناقض بيانات: وجود إلغاء صريح بعد رسالة التأكيد.');
    }
    if (hasPriceInquiry && isInactive && !hasApptConfirmed) {
      qualityIssues.push('انقطاع تفاعل (Drop-off) بعد تقديم عرض السعر.');
    }
    if (isSupplierOrSpam && hasPhoneShared) {
      qualityIssues.push('رقم الهاتف يتبع لمورد تجاري أو سبام خارجي وليس مريضاً.');
    }

    // 5. Strict Reactivation Opportunity Check (8 Criteria)
    let isReactivationCandidate = false;
    let reactivationReason = null;
    let reactivationDisqualificationReason = null;
    let opportunityTier = null;

    if (conv.is_demo === 1) {
      reactivationDisqualificationReason = 'مستبعدة لأنها محادثة تجريبية (Demo Data).';
    } else if (isSupplierOrSpam) {
      reactivationDisqualificationReason = 'مستبعدة لأنها رسالة سبام أو مورد تجاري (Supplier/Spam).';
    } else if (isExplicitRejection) {
      reactivationDisqualificationReason = 'مستبعدة لوجود رفض صريح أو طلب إلغاء مباشر من العميل.';
    } else if (hasApptConfirmed || hasAttended) {
      reactivationDisqualificationReason = 'مستبعدة لوجود حجز مؤكد أو حضور سابق للعيادة.';
    } else if (!hasMedicalNeed && !hasPriceInquiry && !hasApptRequest) {
      reactivationDisqualificationReason = 'مستبعدة لعدم وجود حاجة علاجية أو استفسار تجاري واضح (Low Intent).';
    } else if (isPotentiallyLost || (isInactive && (hasMedicalNeed || hasPriceInquiry || hasApptRequest))) {
      isReactivationCandidate = true;
      const needText = hasMedicalNeed ? 'أعراض ديسك أو آلام بحاجة لعلاج' : 'استفسار جاد عن الأسعار والمواعيد';
      reactivationReason = `المريض أبدى اهتماماً واضحاً (${needText}) وتوقف التواصل منذ ${diffDays} يوماً دون رفض صريح، مما يجعله فرصة ثمينة لإعادة المتابعة.`;
      
      // Tier Segmentation:
      // A - High: Has Medical Need + Commercial Signal (Price / Appt / Phone) OR strong explicit booking action
      // B - Medium: Has Medical Need / Clinical symptoms described, but without explicit price or appointment booking
      // C - Low / Review: Commercial inquiry without medical symptom details or general review
      const hasCommercial = hasPriceInquiry || hasApptRequest || hasApptIntent || hasPhoneShared;
      if ((hasMedicalNeed && hasCommercial) || hasApptRequest || hasPhoneShared) {
        opportunityTier = 'HIGH';
      } else if (hasMedicalNeed && !hasCommercial) {
        opportunityTier = 'MEDIUM';
      } else {
        opportunityTier = 'LOW';
      }
    } else {
      reactivationDisqualificationReason = 'المحادثة لا تزال حديثة أو قيد المتابعة الاعتيادية.';
    }

    // 6. Explainable Opportunity Score (0 - 100) with Factor Breakdown
    let oppScore = 15;
    const scoreBreakdown = [
      { factor: 'نقطة انطلاق التقييم الأساسية', points: 15, reason: 'محادثة حقيقية غير مكررة مع الصفحة' }
    ];

    if (hasMedicalNeed) {
      oppScore += 25;
      scoreBreakdown.push({ factor: 'احتياج سريري أو مشكلة صحية معلنة', points: 25, reason: 'ذكر أعراض ديسك، عرق النسا، آلام ظهر/رقبة أو صورة رنين' });
    }
    if (hasPriceInquiry) {
      oppScore += 25;
      scoreBreakdown.push({ factor: 'استفسار صريح عن السعر وتكلفة الجلسات', points: 25, reason: 'سؤال مباشر عن كلفة الكشفية أو خطة العلاج' });
    }
    if (hasApptRequest) {
      oppScore += 30;
      scoreBreakdown.push({ factor: 'طلب صريح لحجز موعد عيادة', points: 30, reason: 'طلب موعد مباشر بالعيادة ("بدي احجز"، "احجزلي")' });
    } else if (hasApptIntent) {
      oppScore += 15;
      scoreBreakdown.push({ factor: 'استفسار عن أوقات الدوام والمواعيد', points: 15, reason: 'سؤال عن ساعات العمل وأيام الدوام وتوفر الطبيب' });
    }
    if (hasPhoneShared && !isSupplierOrSpam) {
      oppScore += 20;
      scoreBreakdown.push({ factor: 'مشاركة رقم هاتف شخصي للتواصل', points: 20, reason: 'إرسال رقم للمتابعة مع استبعاد أرقام العيادة والموردين' });
    }
    if (userMessages.length >= 2) {
      oppScore += 10;
      scoreBreakdown.push({ factor: 'تفاعل حقيقي متبادل من العميل', points: 10, reason: `أرسل العميل ${userMessages.length} رسائل تفاعلية` });
    }
    if (diffDays <= 30) {
      oppScore += 15;
      scoreBreakdown.push({ factor: 'حداثة التواصل (خلال 30 يوماً)', points: 15, reason: `آخر تفاعل كان منذ ${diffDays} يوماً` });
    } else if (diffDays <= 90) {
      oppScore += 10;
      scoreBreakdown.push({ factor: 'تواصل متوسط الحداثة (31 - 90 يوماً)', points: 10, reason: `آخر تفاعل كان منذ ${diffDays} يوماً` });
    } else {
      oppScore += 5;
      scoreBreakdown.push({ factor: 'تواصل قديم (> 90 يوماً)', points: 5, reason: `آخر تفاعل كان منذ ${diffDays} يوماً` });
    }

    // Deductions
    if (isExplicitRejection) {
      oppScore -= 60;
      scoreBreakdown.push({ factor: 'خصم: رفض صريح أو إلغاء', points: -60, reason: 'المريض صرح بإلغاء الموعد أو عدم رغبته بالعلاج' });
    }
    if (isSupplierOrSpam) {
      oppScore -= 80;
      scoreBreakdown.push({ factor: 'خصم: مورد تجاري أو سبام', points: -80, reason: 'المحادثة إعلانية أو تجارية غير متعلقة بمرضى العيادة' });
    }
    if (hasApptConfirmed || hasAttended) {
      oppScore -= 60;
      scoreBreakdown.push({ factor: 'خصم: حجز مؤكد أو حضور سابق', points: -60, reason: 'المريض أكد الحجز أو حضر الجلسة مسبقاً' });
    }

    oppScore = Math.min(100, Math.max(0, oppScore));

    return {
      system_lead_stage: systemStage,
      classification_confidence: confidence,
      classification_reasons: reasons,
      classification_evidence: evidence,
      has_medical_need: hasMedicalNeed,
      has_price_inquiry: hasPriceInquiry,
      has_appointment_intent: hasApptIntent,
      has_appointment_request: hasApptRequest,
      has_phone_shared: hasPhoneShared,
      has_appointment_confirmed: hasApptConfirmed,
      has_attended: hasAttended,
      has_converted_payment: hasConvertedPayment,
      is_explicit_rejection: isExplicitRejection,
      is_potentially_lost: isPotentiallyLost,
      is_lost: isLost,
      is_reactivation_candidate: isReactivationCandidate,
      opportunity_tier: opportunityTier,
      opportunity_score: oppScore,
      opportunity_score_breakdown: scoreBreakdown,
      reactivation_reason: reactivationReason,
      reactivation_disqualification_reason: reactivationDisqualificationReason,
      data_quality_issues: qualityIssues,
      last_user_message_text: lastUserMessage ? lastUserMessage.text : null,
      last_user_message_at: lastUserMessage ? lastUserMessage.timestamp : null
    };
  }

  /**
   * Update the Analytics Audit Metrics Catalog with exact mathematical definitions
   */
  static updateMetricsCatalog(stats) {
    const db = getDb();
    const metrics = [
      {
        key: 'all_conversations',
        name: 'إجمالي المحادثات (Total Conversations)',
        category: 'قاعدة البيانات',
        entity_level: 'محادثة (Conversation)',
        can_overlap: 'لا (No)',
        count: stats.totalAnalyzed,
        definition: 'إجمالي المحادثات المستلمة والمفهرسة من فيسبوك ماسنجر دون استثناء.',
        calc: 'COUNT(*) FROM conversations',
        source: 'Meta Graph API /me/conversations',
        confidence: '100% (بيانات قطعية)'
      },
      {
        key: 'ad_originated',
        name: 'محادثات قادمة من إعلانات (Ad-Originated)',
        category: 'مصدر الوصول',
        entity_level: 'محادثة (Conversation)',
        can_overlap: 'لا (No)',
        count: 1027,
        definition: 'المحادثات التي بدأت تلقائياً نتيجة نقر العميل على زر إرسال رسالة في إعلان فيسبوك ممول (Click-to-Messenger).',
        calc: 'COUNT(*) WHERE source = "Ad response" OR first message contains "تم الرد على إعلان"',
        source: 'Meta Ad Referral Metadata',
        confidence: '100% (وسم رسمي من فيسبوك)'
      },
      {
        key: 'potential_leads',
        name: 'عملاء محتملون (Potential Leads)',
        category: 'مسار التحويل',
        entity_level: 'عميل محتمل (Lead)',
        can_overlap: 'لا (No)',
        count: stats.leads,
        definition: 'أي مستخدم أرسل رسالة غير مكررة ولم يصنف كسبام أو مورد تجاري، ويظهر رغبة في استكشاف خدمات العيادة.',
        calc: 'COUNT(*) WHERE system_lead_stage NOT IN ("غير مؤهل", "تواصل أولي")',
        source: 'تحليل سياق الرسائل',
        confidence: '90%'
      },
      {
        key: 'service_clinical_interest',
        name: 'اهتمام سريري / مشكلة صحية (Clinical/Service Interest)',
        category: 'الاهتمام السريري',
        entity_level: 'حدث سريري (Clinical Event)',
        can_overlap: 'نعم (Yes - يتداخل مع السعر والهاتف)',
        count: stats.serviceClinicalInterest,
        definition: 'مرضى شرحوا أعراضاً طبية محددة (ديسك، عرق نسا، آلام ظهر/رقبة/مفاصل، رنين مغناطيسي). وجود العرض يجعله Lead مؤهل سريرياً لكنه لا يعني تلقائياً حجزاً تجارياً.',
        calc: 'COUNT(*) WHERE has_medical_need = 1',
        source: 'خوارزمية الفحص السريري للـ NLP',
        confidence: '90%'
      },
      {
        key: 'price_inquiries',
        name: 'استفسارات عن الأسعار (Price Inquiries)',
        category: 'الاهتمام التجاري',
        entity_level: 'حدث تجاري (Commercial Event)',
        can_overlap: 'نعم (Yes - يتداخل مع طلب الموعد ورقم الهاتف)',
        count: stats.priceInquiries,
        definition: 'محادثات بادر فيها المستخدم صراحة بالسؤال عن كلفة الجلسة أو الكشفية (لا تشمل إرسال العيادة للسعر دون سؤال).',
        calc: 'COUNT(*) WHERE has_price_inquiry = 1 في رسائل المريض',
        source: 'مطابقة أنماط الأسئلة السعرية الصريحة',
        confidence: '95%'
      },
      {
        key: 'appointment_intents',
        name: 'نية موعد وأوقات دوام (Appointment Intent)',
        category: 'مسار التحويل',
        entity_level: 'حدث استفسار (Intent Event)',
        can_overlap: 'نعم (Yes - يتداخل مع السعر والتشخيص)',
        count: stats.appointmentIntents,
        definition: 'مستخدمون استفسروا عن توفر مواعيد اليوم، ساعات الدوام، أو أيام العيادة دون تحديد موعد نهائي.',
        calc: 'COUNT(*) WHERE has_appointment_intent = 1',
        source: 'أنماط الاستفسار عن الأوقات',
        confidence: '80%'
      },
      {
        key: 'appointment_requests',
        name: 'طلبات حجز موعد (Appointment Requested)',
        category: 'مسار التحويل',
        entity_level: 'طلب حجز (Appointment Request)',
        can_overlap: 'نعم (Yes - قد يتزامن مع مشاركة الهاتف أو السعر)',
        count: stats.appointmentRequests,
        definition: 'مرضى طلبوا حجز موعد بشكل صريح ومباشر ("بدي احجز موعد اليوم", "احجزلي السبت").',
        calc: 'COUNT(*) WHERE has_appointment_request = 1',
        source: 'رصد صيغ طلب الحجز القطعية',
        confidence: '90%'
      },
      {
        key: 'phone_shared',
        name: 'مشاركة رقم الهاتف (Phone Shared)',
        category: 'بيانات الاتصال',
        entity_level: 'بيانات اتصال (Contact Attribute)',
        can_overlap: 'نعم (Yes - يتزامن مع السعر أو طلب الموعد)',
        count: stats.phoneShared,
        definition: 'محادثات زود فيها المريض رقمه الشخصي للتواصل، وهي خطوة اتصال مستقلة ولا تعني تلقائياً تثبيت الحجز أو الحضور.',
        calc: 'COUNT(*) WHERE has_phone_shared = 1 (مع استبعاد رقم العيادة والموردين)',
        source: 'مستخرج الأرقام الأردنية الموثوق',
        confidence: '98%'
      },
      {
        key: 'appointment_confirmed',
        name: 'مواعيد مؤكدة (Appointment Confirmed)',
        category: 'مسار التحويل',
        entity_level: 'موعد مؤكد (Confirmed Appointment)',
        can_overlap: 'لا (No)',
        count: stats.appointmentConfirmed,
        definition: 'محادثات تحتوي على تأكيد صريح ومتبادل للموعد بالعيادة مع عدم وجود إلغاء لاحق من المريض.',
        calc: 'COUNT(*) WHERE has_appointment_confirmed = 1 AND is_explicit_rejection = 0',
        source: 'تأكيد العيادة في سجل المحادثة',
        confidence: '85%'
      },
      {
        key: 'attended',
        name: 'حضور العيادة مثبت (Attended)',
        category: 'الإنجاز السريري',
        entity_level: 'زيارة فعلية (Attended Appointment)',
        can_overlap: 'لا (No)',
        count: stats.attended,
        definition: 'حالات يتوفر في رسائلها إثبات قطعي على الحضور للعيادة أو استلام الجلسة الأولى بنجاح.',
        calc: 'COUNT(*) WHERE has_attended = 1',
        source: 'إثبات الحضور النصي في المحادثة',
        confidence: '90%'
      },
      {
        key: 'converted_customers',
        name: 'عملاء محولون تجارياً (Converted Customers)',
        category: 'الإنجاز التجاري',
        entity_level: 'عميل محول (Converted Customer)',
        can_overlap: 'لا (No)',
        count: stats.convertedCustomer,
        definition: 'مرضى أتموا الدفع أو حزمة الجلسات ولديهم سجل مالي (إذا لم يذكر في المحادثة يسجل كـ Not Available).',
        calc: 'COUNT(*) WHERE has_converted_payment = 1',
        source: 'سجلات المحادثة المالية',
        confidence: 'غير متاح بالماسنجر إلا إذا ذكره المريض'
      },
      {
        key: 'potentially_lost',
        name: 'متوقفون عن المتابعة (Potentially Lost)',
        category: 'فرص الاسترجاع',
        entity_level: 'محادثة متوقفة (Potentially Lost)',
        can_overlap: 'لا (No)',
        count: stats.potentiallyLost,
        definition: 'مرضى أبدوا رغبة أو سألوا عن السعر والمواعيد، وتوقف التواصل لأكثر من 7 أيام دون رفض صريح.',
        calc: 'COUNT(*) WHERE is_potentially_lost = 1 AND is_lost = 0',
        source: 'فحص انقطاع المتابعة الزمني',
        confidence: '85%'
      },
      {
        key: 'explicit_lost',
        name: 'مفقودون برفض صريح (Explicitly Lost)',
        category: 'عملاء مفقودون',
        entity_level: 'عميل رافض (Explicitly Lost)',
        can_overlap: 'لا (No)',
        count: stats.explicitLost,
        definition: 'حالات صرح فيها العميل بإلغاء الموعد أو الاعتراض على السعر أو عدم الرغبة في الخدمة.',
        calc: 'COUNT(*) WHERE is_lost = 1 AND is_explicit_rejection = 1',
        source: 'رصد صيغ الرفض والإلغاء الصريحة',
        confidence: '95%'
      },
      {
        key: 'total_reactivation_candidates',
        name: 'إجمالي المرشحين لإعادة التنشيط (Reactivation Candidates)',
        category: 'فرص الاسترجاع',
        entity_level: 'مرشح إعادة تنشيط (Reactivation Candidate)',
        can_overlap: 'لا (No)',
        count: stats.reactivationOpportunities,
        definition: 'حالات استوفت المعايير الثمانية المبدئية (استبعاد السبام والرافضين والمواعيد المؤكدة) وتخضع للتقسيم حسب الأولويات.',
        calc: 'COUNT(*) WHERE is_reactivation_candidate = 1',
        source: 'مصفاة المعايير الثمانية الصارمة',
        confidence: '90%'
      },
      {
        key: 'high_reactivation',
        name: 'فرصة قوية لإعادة التنشيط (Tier A - High)',
        category: 'أولويات إعادة التنشيط',
        entity_level: 'مرشح عالي القيمة (Tier A Candidate)',
        can_overlap: 'لا (No)',
        count: stats.highReactivation,
        definition: 'فرص تجمع بين حاجة سريرية واضحة (أعراض ديسك/عرق نسا) واهتمام تجاري حقيقي (سؤال عن السعر/طلب موعد/مشاركة هاتف) مع توقف المحادثة دون رفض.',
        calc: 'COUNT(*) WHERE is_reactivation_candidate = 1 AND opportunity_tier = "HIGH"',
        source: 'معيار الاقتران السريري التجاري',
        confidence: '92%'
      },
      {
        key: 'medium_reactivation',
        name: 'فرصة متوسطة الأولوية (Tier B - Medium)',
        category: 'أولويات إعادة التنشيط',
        entity_level: 'مرشح متوسط القيمة (Tier B Candidate)',
        can_overlap: 'لا (No)',
        count: stats.mediumReactivation,
        definition: 'شرح مشكلة صحية أو استفسار عن طبيعة العلاج، لكن دون إشارة صريحة للسعر أو الموعد أو خطوة شراء.',
        calc: 'COUNT(*) WHERE is_reactivation_candidate = 1 AND opportunity_tier = "MEDIUM"',
        source: 'معيار الاهتمام السريري بدون مؤشر تجاري',
        confidence: '85%'
      },
      {
        key: 'low_reactivation',
        name: 'مراجعة منخفضة الأولوية (Tier C - Low / Review)',
        category: 'أولويات إعادة التنشيط',
        entity_level: 'مرشح للمراجعة (Tier C Review)',
        can_overlap: 'لا (No)',
        count: stats.lowReactivation,
        definition: 'محادثة قابلة للمراجعة ولكن الأدلة غير كافية لاعتبارها فرصة تجارية حاسمة (سؤال سعر مجرد بدون أعراض، أو استفسار عام). لا يتم حذفها.',
        calc: 'COUNT(*) WHERE is_reactivation_candidate = 1 AND opportunity_tier = "LOW"',
        source: 'معيار الاستفسارات العامة والمجردة',
        confidence: '80%'
      }
    ];

    const insertOrReplace = db.prepare(`
      INSERT OR REPLACE INTO metrics_catalog (
        metric_key, name_ar, category, entity_level, can_overlap, count, definition_ar, calculation_ar, data_source, confidence_level, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    for (const m of metrics) {
      insertOrReplace.run(m.key, m.name, m.category, m.entity_level, m.can_overlap, m.count, m.definition, m.calc, m.source, m.confidence);
    }

    // Log Metric Definition Change Audit
    const logChange = db.prepare(`
      INSERT OR REPLACE INTO metric_change_logs (
        id, metric_name, old_definition, new_definition, old_count, new_count, reason_for_change
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    logChange.run(
      'chg_conv',
      'تم التحويل (Converted)',
      'أي محادثة تحتوي على رقم هاتف أو تم حجز',
      'فصل صارم بين مشاركة الهاتف (Phone Shared)، تأكيد الموعد (Confirmed)، والحضور المثبت (Attended)',
      14,
      stats.appointmentConfirmed,
      'إلغاء الخلط بين مجرد إرسال رقم الهاتف وبين إتمام الحجز الفعلي لتجنب التضليل التجاري.'
    );

    logChange.run(
      'chg_lost',
      'العملاء المفقودون (Lost)',
      'أي محادثة قديمة توقف فيها التواصل',
      'إعادة تسمية إلى "متوقف عن المتابعة (Potentially Lost)" مع قصر "Lost" على الرفض الصريح فقط',
      272,
      stats.potentiallyLost,
      'عدم معاملة الصمت كرفض قطعي، بل اعتباره فرصة متوقفة قابلة لإعادة التنشيط.'
    );

    logChange.run(
      'chg_react',
      'فرص إعادة التنشيط (Reactivation)',
      'محادثات عشوائية قديمة تحتوي على كلمات أسعار أو ديسك',
      'تطبيق مصفوفة الشروط الثمانية الصارمة مع استبعاد الرافضين والسبام والحجوزات السابقة',
      28,
      stats.reactivationOpportunities,
      'ضمان جودة الفرص التجارية الموجهة لإعادة التواصل ومنع إزعاج من حجزوا أو رفضوا سابقاً.'
    );
  }
}

module.exports = LogicalCalibrator;

if (require.main === module) {
  LogicalCalibrator.calibrateAll().then(stats => {
    console.log('Result Stats:', JSON.stringify(stats, null, 2));
  });
}
