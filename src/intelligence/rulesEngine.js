/**
 * Rules-Based Conversation Intelligence & Intent Classification Engine
 * Implements ConversationAnalyzer Interface for pluggable AI / Rules execution
 */

const ArabicNLP = require('./arabicNlp');

// Normalized intent keyword patterns for Jordanian & regional Arabic medical inquiries
const INTENT_PATTERNS = {
  PRICE_INQUIRY: [
    'كم سعر', 'كم السعر', 'سعر جلسة', 'سعر الجلسة', 'بكم', 'شو السعر', 'شو الاسعار', 'كم بتكلف', 'تكلفة', 
    'كم الكشفية', 'سعر الكشفية', 'بكم الجلسه', 'قديش بتكلف', 'قديش السعر', 'كم تكلفة العلاج', 'اسعاركم',
    'قديش الجلسة', 'بكم الكشف', 'تكلفة الجلسة', 'سعر الفحص', 'اسعار الجلسات'
  ],
  APPOINTMENT_REQUEST: [
    'بدي احجز', 'اريد احجز', 'بدي موعد', 'اريد موعد', 'احجزلي', 'احجز موعد',
    'في موعد اليوم', 'متاح موعد', 'بدي اجي', 'متى عندكم موعد', 'ممكن موعد',
    'حجز موعد', 'سجلني موعد', 'بقدر اجي اليوم', 'بدي اخذ موعد', 'متى في فراغ'
  ],
  LOCATION_INQUIRY: [
    'وين العيادة', 'وين مكانكم', 'وين موقعكم', 'الموقع وين', 'اللوكيشن',
    'باي منطقة', 'بخلدا', 'وين بخلدا', 'في عمان', 'شارع وصفي التل',
    'عنوانكم', 'وين عنوان العيادة', 'مكانكم وين', 'ابعثلي اللوكيشن'
  ],
  HOURS_INQUIRY: [
    'ساعات الدوام', 'متى بتفتحوا', 'متى بتسكرو', 'اي ساعة بتفتحوا',
    'دوامكم', 'اوقات العمل', 'فاتحين اليوم', 'فاتحين الجمعة', 'متى موجود الدكتور'
  ],
  MEDICAL_PROBLEM: [
    'عرق النسا', 'ديسك', 'انزلاق غضروفي', 'ظهري بوجعني', 'وجع ظهر', 'الم بالظهر',
    'رقبتي بتوجعني', 'الم بالرقبة', 'تنميل بالرجل', 'تنميل باليد', 'صداع نصفي',
    'احتكاك ركبة', 'خشونة', 'الابهر', 'سياتيك', 'وجع مفاصل', 'فقرات قطنية',
    'فقرات عنقية', 'صورة رنين', 'اشعة', 'عملية جراحية', 'عصب مضغوط'
  ],
  SERVICE_INQUIRY: [
    'كايروبراكتيك', 'طقطقة', 'علاج طبيعي', 'سحب فقرات', 'تعديل فقرات',
    'شو بتعالجوا', 'كيف طريقة العلاج', 'شو نوع العلاج', 'هل العلاج مؤلم',
    'كم جلسة بحتاج', 'ابر صينية', 'حجامة طبية', 'علاج يدوي'
  ],
  EXISTING_CUSTOMER: [
    'كنت عندكم', 'راجعتكم', 'انا مراجع قديم', 'جلستي القادمة', 'الدكتور حكالي',
    'اخذت جلسة', 'اخذت موعد عندكم', 'الملف تبعي', 'كملت الجلسات'
  ],
  COMPLAINT: [
    'شكوى', 'ما حدا رد', 'تاخرتوا علي', 'ما استفدت', 'سوء معامله',
    'ما في مصداقية', 'خدمة سيئة', 'ما حد معبرني'
  ],
  SPAM: [
    'marketing', 'seo services', 'crypto', 'forex', 'telegram', 'click here',
    'تابعني', 'زيادة متابعين', 'تمويل قروض'
  ]
};

class ConversationAnalyzer {
  /**
   * Main analysis execution on conversation and message stream
   */
  static analyze(conversation, messages = []) {
    const textHistory = messages.map(m => m.text || '').join('\n');
    const userMessages = messages.filter(m => !m.is_from_page && m.sender_type !== 'page');
    const userText = userMessages.map(m => m.text || '').join('\n');
    const lastUserMessage = userMessages[userMessages.length - 1]?.text || '';
    const lastMessage = messages[messages.length - 1];

    // 1. Detect Matching Intents
    const matchedIntents = [];
    for (const [intentKey, patterns] of Object.entries(INTENT_PATTERNS)) {
      if (ArabicNLP.containsAny(userText, patterns)) {
        matchedIntents.push(intentKey);
      }
    }

    // Determine primary intent
    let primaryIntent = 'OTHER';
    if (matchedIntents.includes('SPAM')) primaryIntent = 'SPAM';
    else if (matchedIntents.includes('COMPLAINT')) primaryIntent = 'COMPLAINT';
    else if (matchedIntents.includes('EXISTING_CUSTOMER')) primaryIntent = 'EXISTING_CUSTOMER';
    else if (matchedIntents.includes('APPOINTMENT_REQUEST')) primaryIntent = 'APPOINTMENT_REQUEST';
    else if (matchedIntents.includes('PRICE_INQUIRY')) primaryIntent = 'PRICE_INQUIRY';
    else if (matchedIntents.includes('MEDICAL_PROBLEM')) primaryIntent = 'MEDICAL_PROBLEM';
    else if (matchedIntents.includes('SERVICE_INQUIRY')) primaryIntent = 'SERVICE_INQUIRY';
    else if (matchedIntents.includes('LOCATION_INQUIRY')) primaryIntent = 'LOCATION_INQUIRY';
    else if (matchedIntents.includes('HOURS_INQUIRY')) primaryIntent = 'HOURS_INQUIRY';
    else if (matchedIntents.length > 0) primaryIntent = matchedIntents[0];

    // Phone number detection indicates high intent & potential conversion
    const detectedPhone = ArabicNLP.extractPhoneNumber(userText);

    // 2. Calculate Appointment Intent Score (0 - 100)
    let appointmentScore = 0;
    if (matchedIntents.includes('APPOINTMENT_REQUEST')) appointmentScore += 50;
    if (matchedIntents.includes('HOURS_INQUIRY')) appointmentScore += 15;
    if (matchedIntents.includes('LOCATION_INQUIRY')) appointmentScore += 15;
    if (detectedPhone) appointmentScore += 25;
    if (matchedIntents.includes('MEDICAL_PROBLEM')) appointmentScore += 10;
    appointmentScore = Math.min(100, Math.max(0, appointmentScore));

    const appointmentConfidence = appointmentScore >= 70 ? 'عالية' : (appointmentScore >= 40 ? 'متوسطة' : 'منخفضة');

    // 3. Calculate Purchase Intent Score (0 - 100) and Reasons
    let purchaseScore = 0;
    const purchaseReasons = [];

    if (matchedIntents.includes('PRICE_INQUIRY')) {
      purchaseScore += 35;
      purchaseReasons.push('سأل عن السعر أو تكلفة الجلسة والكشفية');
    }
    if (matchedIntents.includes('APPOINTMENT_REQUEST')) {
      purchaseScore += 30;
      purchaseReasons.push('طلب حجز موعد محدد');
    }
    if (matchedIntents.includes('LOCATION_INQUIRY')) {
      purchaseScore += 15;
      purchaseReasons.push('استفسر عن عنوان وموقع العيادة للقدوم');
    }
    if (matchedIntents.includes('SERVICE_INQUIRY')) {
      purchaseScore += 10;
      purchaseReasons.push('استفسر عن تقنيات العلاج الطبيعي والكايروبراكتيك');
    }
    if (detectedPhone) {
      purchaseScore += 20;
      purchaseReasons.push('شارك رقم هاتفه للتواصل والمتابعة');
    }
    if (conversation.source === 'Ad response') {
      purchaseScore += 10;
      purchaseReasons.push('جاء عبر حملة إعلانية ممولة مدفوعة');
    }
    if (matchedIntents.includes('SPAM')) {
      purchaseScore = 0;
      purchaseReasons.length = 0;
      purchaseReasons.push('رسالة سبام غير ذات صلة');
    }
    purchaseScore = Math.min(100, Math.max(0, purchaseScore));

    // 4. Calculate Recency & Recency Bracket
    const lastMessageDate = lastMessage ? new Date(lastMessage.timestamp) : new Date(conversation.last_message_at || conversation.created_at);
    const now = new Date('2026-09-30T23:50:00Z');
    const diffDays = Math.max(0, Math.floor((now - lastMessageDate) / (1000 * 60 * 60 * 24)));

    let recencyBracket = '0-30 days';
    let recencyWeight = 15;
    if (diffDays <= 30) {
      recencyBracket = '0-30 days';
      recencyWeight = 15;
    } else if (diffDays <= 90) {
      recencyBracket = '31-90 days';
      recencyWeight = 12;
    } else if (diffDays <= 180) {
      recencyBracket = '91-180 days';
      recencyWeight = 9;
    } else if (diffDays <= 365) {
      recencyBracket = '181-365 days';
      recencyWeight = 6;
    } else if (diffDays <= 730) {
      recencyBracket = '1-2 years';
      recencyWeight = 4;
    } else {
      recencyBracket = '2+ years';
      recencyWeight = 2;
    }

    // 5. Commercial Opportunity / Lead Score (0 - 100)
    // Formula: Appointment (30%) + Purchase (30%) + Recency (15%) + Service Interest (15%) + Ad Origin (10%)
    let opportunityScore = Math.round(
      (appointmentScore * 0.30) +
      (purchaseScore * 0.30) +
      recencyWeight +
      ((matchedIntents.includes('SERVICE_INQUIRY') || matchedIntents.includes('MEDICAL_PROBLEM')) ? 15 : 0) +
      (conversation.source === 'Ad response' ? 10 : 0)
    );

    if (matchedIntents.includes('SPAM') || primaryIntent === 'SPAM') {
      opportunityScore = 0;
    }
    if (matchedIntents.includes('COMPLAINT')) {
      opportunityScore = Math.min(25, opportunityScore);
    }
    opportunityScore = Math.min(100, Math.max(0, opportunityScore));

    // 6. Lead Stage Derivation
    let leadStage = 'جديد';
    if (primaryIntent === 'SPAM') {
      leadStage = 'غير مؤهل';
    } else if (primaryIntent === 'EXISTING_CUSTOMER') {
      leadStage = 'عميل سابق';
    } else if (detectedPhone || userText.includes('تم الحجز') || textHistory.includes('تم تثبيت موعدك')) {
      leadStage = 'تم التحويل';
    } else if (matchedIntents.includes('APPOINTMENT_REQUEST')) {
      leadStage = diffDays > 3 ? 'لم يحجز' : 'طلب موعد';
    } else if (matchedIntents.includes('PRICE_INQUIRY')) {
      leadStage = diffDays > 7 ? 'مفقود' : 'سأل عن السعر';
    } else if (opportunityScore >= 70) {
      leadStage = diffDays > 14 ? 'مفقود' : 'مؤهل';
    } else if (matchedIntents.includes('MEDICAL_PROBLEM') || matchedIntents.includes('SERVICE_INQUIRY')) {
      leadStage = 'مهتم';
    } else if (userMessages.length > 0) {
      leadStage = 'استفسار';
    }

    // 7. Auto Labels Assignment
    const smartLabels = [];
    if (matchedIntents.includes('PRICE_INQUIRY')) smartLabels.push('سأل عن السعر');
    if (matchedIntents.includes('APPOINTMENT_REQUEST')) smartLabels.push('طلب موعد');
    if (matchedIntents.includes('MEDICAL_PROBLEM')) smartLabels.push('استفسار طبي');
    if (matchedIntents.includes('LOCATION_INQUIRY')) smartLabels.push('موقع العيادة');
    if (leadStage === 'لم يحجز') smartLabels.push('لم يحجز');
    if (leadStage === 'مفقود') smartLabels.push('عميل مفقود');
    if (conversation.source === 'Ad response') smartLabels.push('إعلان ممول');
    if (detectedPhone) smartLabels.push('يوجد رقم هاتف');
    if (primaryIntent === 'EXISTING_CUSTOMER') smartLabels.push('عميل سابق');
    if (primaryIntent === 'COMPLAINT') smartLabels.push('شكوى');
    if (primaryIntent === 'SPAM') smartLabels.push('Spam');

    // 8. Generate Concise Executive Summary & Next Action
    const symptomsSummary = matchedIntents.includes('MEDICAL_PROBLEM') ? 'ذكر أعراضاً أو آلاماً صحية تتطلب تدخلاً علاجياً.' : '';
    const priceSummary = matchedIntents.includes('PRICE_INQUIRY') ? 'سأل عن كلفة الفحص وسعر الجلسة.' : '';
    const apptSummary = matchedIntents.includes('APPOINTMENT_REQUEST') ? 'أبدى رغبة مباشرة في حجز موعد.' : '';
    const statusSummary = leadStage === 'تم التحويل' ? 'تم استلام بيانات الاتصال وتثبيت التفاعل بنجاح.' : 
                         (leadStage === 'مفقود' || leadStage === 'لم يحجز') ? 'انقطعت المحادثة دون تأكيد حجز الموعد النهائي.' : 'المحادثة لا تزال في طور الاستفسار الأولي.';

    const summary = `الشخص تواصل عبر ${conversation.source || 'Messenger'}. ${symptomsSummary} ${priceSummary} ${apptSummary} ${statusSummary}`.trim();

    let recommendedAction = 'المتابعة المباشرة عبر القنوات الرسمية لـ Meta';
    if (leadStage === 'مفقود' || leadStage === 'لم يحجز') {
      recommendedAction = 'إعادة تنشيط مدروسة مع فحص نافذة الـ 24 ساعة لسياسات Meta.';
    } else if (leadStage === 'طلب موعد') {
      recommendedAction = 'تأكيد الموعد واقتراح يوم وساعة محددين فوراً.';
    } else if (leadStage === 'تم التحويل') {
      recommendedAction = 'متابعة ما بعد الجلسة أو تأكيد الحضور عبر الواتساب المباشر.';
    } else if (leadStage === 'غير مؤهل') {
      recommendedAction = 'أرشفة المحادثة وإلغاء الاستهداف.';
    }

    return {
      intent: primaryIntent,
      allIntents: matchedIntents,
      appointment_intent_score: appointmentScore,
      appointment_confidence: appointmentConfidence,
      purchase_intent_score: purchaseScore,
      purchase_reasons: purchaseReasons,
      lead_score: opportunityScore,
      opportunity_score: opportunityScore,
      lead_stage: leadStage,
      recency_bracket: recencyBracket,
      diff_days: diffDays,
      smart_labels: smartLabels,
      detected_phone: detectedPhone,
      summary,
      recommended_action: recommendedAction,
      confidence: 'عالية'
    };
  }
}

module.exports = {
  ConversationAnalyzer,
  INTENT_PATTERNS
};
