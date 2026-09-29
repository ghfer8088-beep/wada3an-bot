// Human Amplification Panel — 100% Meta-Compliant Voluntary Team Notification
const { notifications, logAudit } = require('../db/database');

class HumanAmplificationPanel {
  constructor() {
    this.teamAccounts = [
      { id: 1, name: 'هدى (إشراف)', role: 'أخصائية تأهيل', status: 'READY' },
      { id: 2, name: 'محمد (متابعة)', role: 'أخصائي علاج طبيعي', status: 'READY' },
      { id: 3, name: 'أحمد (استقبال)', role: 'منسق المواعيد', status: 'READY' },
      { id: 4, name: 'سارة (تمريض)', role: 'رعاية مرضى', status: 'READY' },
      { id: 5, name: 'عمر (تأهيل حركي)', role: 'مدرب حركي', status: 'READY' },
      { id: 6, name: 'رنا (علاقات مراجعين)', role: 'خدمة عملاء', status: 'READY' },
      { id: 7, name: 'د. جمال (إدارة طبية)', role: 'استشاري كايروبراكتيك', status: 'READY' },
      { id: 8, name: 'محمود (تقييم)', role: 'فني أجهزة علاجية', status: 'READY' },
      { id: 9, name: 'ليلى (محتوى وتوعية)', role: 'تثقيف صحي', status: 'READY' },
      { id: 10, name: 'طارق (خدمات مساندة)', role: 'متابعة ميدانية', status: 'READY' },
      { id: 11, name: 'نور (استشارات)', role: 'استشارات هاتفية', status: 'READY' },
      { id: 12, name: 'خالد (علاقات عامة)', role: 'إعلام طبي', status: 'READY' }
    ];
  }

  // 1. Get List of all 12 Human Team Members
  getTeamList() {
    return {
      complianceStatement: 'نظام إشعارات بشري حقيقي ممتثل لسياسات Meta 100%؛ خالٍ تماماً من أي روبوتات أو أتمتة مصطنعة أو تلاعب بالبصمات.',
      totalMembers: this.teamAccounts.length,
      members: this.teamAccounts
    };
  }

  // 2. Dispatch a Voluntary Human Amplification Notification when a new post is live
  dispatchAmplificationAlert(postId, postUrl, topic) {
    const alertMessage = `📢 منشور جديد نشط بمركز وداعاً للألم: "${topic}". الرجاء الاطلاع والمشاركة الطوعية إن كان المحتوى يهمكم.`;

    const records = [];
    this.teamAccounts.forEach(member => {
      const notifId = notifications.create({
        user_id: member.name,
        notification_type: 'POST_ALERT',
        message: `${alertMessage} — الرابط: ${postUrl}`,
        related_post_id: postId
      });
      records.push({ memberName: member.name, status: 'NOTIFICATION_SENT', notifId });
    });

    logAudit('HUMAN_AMPLIFICATION_DISPATCHED', 'HUMAN_PANEL', {
      postId,
      recipientsCount: records.length,
      voluntaryParticipationPolicy: 'Strictly voluntary human engagement'
    });

    return {
      success: true,
      postId,
      dispatchedCount: records.length,
      policy: 'تم إرسال إشعارات الاطلاع لأعضاء الفريق الحقيقيين دون أي إجراء آلي نيابة عنهم.',
      records
    };
  }
}

module.exports = new HumanAmplificationPanel();
