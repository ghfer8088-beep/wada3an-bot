/**
 * Meta Messaging Policy & Compliance Layer
 * Enforces official 24-Hour Messaging Window & Message Tag specifications
 */

class MessagingCompliance {
  /**
   * Check whether a direct outbound message is permitted under Meta Platform Policies
   */
  static evaluateOutboundCompliance(conversation, lastUserMessageTimestamp, proposedTag = null) {
    if (!lastUserMessageTimestamp) {
      return {
        isAllowed: false,
        status: 'BLOCKED_NO_TIMESTAMP',
        reason: 'لا يتوفر تاريخ لآخر رسالة من المستخدم للتحقق من سياسة Meta.',
        recommendedSolution: 'يجب استيراد أو تحديث تواريخ الرسائل أولاً.',
        windowHoursRemaining: 0,
        requiresTag: true
      };
    }

    const lastMsgTime = new Date(lastUserMessageTimestamp).getTime();
    const now = new Date('2026-09-30T23:50:00Z').getTime();
    const diffHours = (now - lastMsgTime) / (1000 * 60 * 60);

    // 1. Within 24-Hour Standard Messaging Window
    if (diffHours <= 24) {
      const remainingHours = Math.max(0, Math.round((24 - diffHours) * 10) / 10);
      return {
        isAllowed: true,
        status: 'ALLOWED_24H_WINDOW',
        reason: `المحادثة ضمن نافذة الـ 24 ساعة الرسمية المسموحة لـ Meta (متبقي حوالي ${remainingHours} ساعة).`,
        recommendedSolution: 'يمكن إرسال رسالة متابعة أو استفسار بصورة قياسية.',
        windowHoursRemaining: remainingHours,
        requiresTag: false,
        suggestedTag: null
      };
    }

    // 2. Outside 24-Hour Window: Check Supported Meta Message Tags
    const VALID_TAGS = ['CONFIRMED_EVENT_UPDATE', 'POST_PURCHASE_UPDATE', 'ACCOUNT_UPDATE', 'HUMAN_AGENT'];

    if (proposedTag && VALID_TAGS.includes(proposedTag)) {
      if (proposedTag === 'CONFIRMED_EVENT_UPDATE') {
        return {
          isAllowed: true,
          status: 'ALLOWED_WITH_TAG',
          reason: 'مسموح بالإرسال خارج نافذة 24 ساعة باستخدام وسم Meta المعتمد: CONFIRMED_EVENT_UPDATE (تأكيد أو تذكير بموعد مسجل مسبقاً).',
          recommendedSolution: 'تأكد أن نص الرسالة يقتصر على تذكير أو تحديث الموعد الطبي ولا يحتوي على عروض ترويجية عشوائية.',
          windowHoursRemaining: 0,
          requiresTag: true,
          appliedTag: proposedTag
        };
      }

      if (proposedTag === 'HUMAN_AGENT' && diffHours <= (7 * 24)) {
        return {
          isAllowed: true,
          status: 'ALLOWED_HUMAN_AGENT',
          reason: 'مسموح بالإرسال بواسطة ممثل بشري (نافذة الـ 7 أيام لوسم HUMAN_AGENT).',
          recommendedSolution: 'إرسال رد مخصص للعميل بواسطة موظف العيادة للإجابة على استفساره السابق.',
          windowHoursRemaining: 0,
          requiresTag: true,
          appliedTag: proposedTag
        };
      }
    }

    // 3. Blocked: Outside 24h without compliant tag
    return {
      isAllowed: false,
      status: 'BLOCKED_24H_EXPIRED',
      reason: `انتهت نافذة الـ 24 ساعة المسموحة لـ Meta (مر على آخر تفاعل من العميل ${Math.floor(diffHours / 24)} يوم). إرسال رسالة عادية سيتسبب في حظر الصفحة أو رفض API برمز الخطأ (#10).`,
      recommendedSolution: '1. في حال توفر رقم هاتف، يتم التواصل مباشرة عبر الواتساب الرسمي للعيادة.\n2. إطلاق حملة Sponsored Message رسمية عبر Meta Ads لإعادة استهداف من راسلوا الصفحة.\n3. انتظار مبادرة العميل بالمراسلة لفتح نافذة 24 ساعة جديدة.',
      windowHoursRemaining: 0,
      requiresTag: true,
      suggestedTag: 'CONFIRMED_EVENT_UPDATE'
    };
  }
}

module.exports = MessagingCompliance;
