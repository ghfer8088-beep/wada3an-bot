/**
 * Representative Demo Dataset for Jordanian Medical Clinic (Wada3an Lil Alam - Khalda, Amman)
 * Clearly isolated with is_demo = 1
 */

const DEMO_CONVERSATIONS = [
  {
    id: 'demo_conv_1',
    meta_conversation_id: 't_10158472910481234',
    contact: {
      id: 'demo_usr_1',
      meta_user_id: 'usr_8829102481',
      name: 'طارق العبادي',
      phone: '0795123456',
      city: 'عمان - خلدا',
      source: 'Ad response'
    },
    source: 'Ad response',
    ad_name: 'حملة علاج عرق النسا بدون جراحة - فيديو عمّان',
    lead_stage: 'لم يحجز',
    first_message_at: '2025-04-12T14:22:00Z',
    last_message_at: '2025-04-13T10:15:00Z',
    messages: [
      { id: 'm1_1', sender_type: 'user', timestamp: '2025-04-12T14:22:00Z', text: 'السلام عليكم، شفت إعلانكم عن علاج عرق النسا والديسك. أنا عندي ألم شديد وتنميل نازل على رجلي اليسار من أسبوعين.' },
      { id: 'm1_2', sender_type: 'page', timestamp: '2025-04-12T14:30:00Z', text: 'وعليكم السلام ورحمة الله، ألف سلامة عليك أخي طارق. الأعراض تشير لضغط على العصب الوركي، ونحن في مركز وداعاً للألم نعالج هذا الانضغاط بالكايروبراكتيك وسحب الفقرات دون جراحة.' },
      { id: 'm1_3', sender_type: 'user', timestamp: '2025-04-12T14:45:00Z', text: 'ممتاز، طيب كم سعر الجلسة والكشفية؟ ووين مكانكم بخلدا بالظبط؟' },
      { id: 'm1_4', sender_type: 'page', timestamp: '2025-04-12T15:00:00Z', text: 'موقعنا بخلدا - شارع وصفي التل. الكشفية والفحص السريري 15 دينار، والجلسة العلاجية المتكاملة 35 دينار. هل تحب نسجلك موعد غداً لتقييم الحالة؟' },
      { id: 'm1_5', sender_type: 'user', timestamp: '2025-04-13T10:15:00Z', text: 'بدي أشوف وقت مناسب وأردلكم خبر إن شاء الله، شكراً.' }
    ]
  },
  {
    id: 'demo_conv_2',
    meta_conversation_id: 't_10158472910485678',
    contact: {
      id: 'demo_usr_2',
      meta_user_id: 'usr_9918237461',
      name: 'منى الحنيطي',
      phone: null,
      city: 'عمان - تلاع العلي',
      source: 'Messenger'
    },
    source: 'Messenger',
    ad_name: null,
    lead_stage: 'مفقود',
    first_message_at: '2024-11-05T18:10:00Z',
    last_message_at: '2024-11-06T12:00:00Z',
    messages: [
      { id: 'm2_1', sender_type: 'user', timestamp: '2024-11-05T18:10:00Z', text: 'مساء الخير، عندي انزلاق غضروفي بالفقرات العنقية مع صداع مستمر وتنميل بأطراف الأصابع. شو طبيعة العلاج عندكم؟' },
      { id: 'm2_2', sender_type: 'page', timestamp: '2024-11-05T18:35:00Z', text: 'مساء النور أخت منى. نستخدم بروتوكول تحرير العصب العنقي وتعديل القوام لتخفيف الضغط عن الأعصاب المسببة للصداع والتنميل.' },
      { id: 'm2_3', sender_type: 'user', timestamp: '2024-11-05T19:00:00Z', text: 'بدي احجز موعد، متى في موعد متاح هذا الأسبوع صباحاً؟ وكم التكلفة؟' },
      { id: 'm2_4', sender_type: 'page', timestamp: '2024-11-06T12:00:00Z', text: 'أهلاً بك، متاح يوم الخميس الساعة 11:00 صباحاً. هل نثبت الموعد؟' }
    ]
  },
  {
    id: 'demo_conv_3',
    meta_conversation_id: 't_10158472910489999',
    contact: {
      id: 'demo_usr_3',
      meta_user_id: 'usr_1238910247',
      name: 'المهندس خلدون الحديد',
      phone: '0790360440',
      city: 'عمان - دابوق',
      source: 'Messenger'
    },
    source: 'Messenger',
    ad_name: null,
    lead_stage: 'تم التحويل',
    first_message_at: '2026-09-28T09:00:00Z',
    last_message_at: '2026-09-28T11:40:00Z',
    messages: [
      { id: 'm3_1', sender_type: 'user', timestamp: '2026-09-28T09:00:00Z', text: 'مرحبا، معاي الديسك L4-L5 وعندي تقرير رنين مغناطيسي جاهز. بدي احجز موعد اليوم ضروري.' },
      { id: 'm3_2', sender_type: 'page', timestamp: '2026-09-28T09:15:00Z', text: 'أهلاً بك بشمهندس خلدون. متاح اليوم الساعة 4:30 عصراً مع أخصائي الكايروبراكتيك في فرعنا بخلدا. يرجى تزويدنا برقم الهاتف لتثبيت الحجز.' },
      { id: 'm3_3', sender_type: 'user', timestamp: '2026-09-28T10:05:00Z', text: 'تمام، رقمي 0790360440 واعتمدوا الحجز اليوم 4:30 إن شاء الله.' },
      { id: 'm3_4', sender_type: 'page', timestamp: '2026-09-28T11:40:00Z', text: 'تم تثبيت موعدك بنجاح اليوم 4:30 عصراً في مركز وداعاً للألم - خلدا. أهلاً وسهلاً بك.' }
    ]
  },
  {
    id: 'demo_conv_4',
    meta_conversation_id: 't_10158472910481111',
    contact: {
      id: 'demo_usr_4',
      meta_user_id: 'usr_7761928341',
      name: 'أم عبد الله المجالي',
      phone: null,
      city: 'الكرك / عمان',
      source: 'Facebook'
    },
    source: 'Facebook',
    ad_name: null,
    lead_stage: 'مهتم',
    first_message_at: '2025-08-14T16:00:00Z',
    last_message_at: '2025-08-14T17:20:00Z',
    messages: [
      { id: 'm4_1', sender_type: 'user', timestamp: '2025-08-14T16:00:00Z', text: 'يعطيكم العافية، الوالدة عمرها 72 سنة وعندها خشونة شديدة بالركبتين وصعوبة بالمشي. هل العلاج الطبيعي عندكم بلائم كبار السن بدون ألم؟' },
      { id: 'm4_2', sender_type: 'page', timestamp: '2025-08-14T16:40:00Z', text: 'الله يعافيك ويحفظ الوالدة. نعم بالتأكيد، لدينا أجهزة علاج يدوي متخصصة لكبار السن بدون أي ضغط مجهد لتليين المفاصل وتخفيف الاحتكاك.' },
      { id: 'm4_3', sender_type: 'user', timestamp: '2025-08-14T17:20:00Z', text: 'قديش بتكلف جلسات الركبة؟ وإذا بدنا نجي يوم السبت متى دوامكم؟' }
    ]
  },
  {
    id: 'demo_conv_5',
    meta_conversation_id: 't_10158472910482222',
    contact: {
      id: 'demo_usr_5',
      meta_user_id: 'usr_5541928372',
      name: 'أحمد القضاة',
      phone: null,
      city: 'عمان - الجبيهة',
      source: 'Ad response'
    },
    source: 'Ad response',
    ad_name: 'إعلان تصحيح القوام والأبهر وآلام الكتف',
    lead_stage: 'سأل عن السعر',
    first_message_at: '2026-01-10T11:00:00Z',
    last_message_at: '2026-01-10T12:00:00Z',
    messages: [
      { id: 'm5_1', sender_type: 'user', timestamp: '2026-01-10T11:00:00Z', text: 'كم سعر فحص الأبهر وطقطقة الظهر؟' },
      { id: 'm5_2', sender_type: 'page', timestamp: '2026-01-10T11:20:00Z', text: 'أهلاً بك أخي أحمد، الكشفية 15 دينار والجلسة المتكاملة 35 دينار وتشمل سحب وتعديل الفقرات والتدليك العلاجي.' },
      { id: 'm5_3', sender_type: 'user', timestamp: '2026-01-10T12:00:00Z', text: 'تمام، شكراً.' }
    ]
  },
  {
    id: 'demo_conv_6',
    meta_conversation_id: 't_10158472910483333',
    contact: {
      id: 'demo_usr_6',
      meta_user_id: 'usr_4431928312',
      name: 'د. سامر النجار',
      phone: '0788765432',
      city: 'عمان - عبدون',
      source: 'Messenger'
    },
    source: 'Messenger',
    ad_name: null,
    lead_stage: 'عميل سابق',
    first_message_at: '2024-03-15T10:00:00Z',
    last_message_at: '2024-03-20T14:30:00Z',
    messages: [
      { id: 'm6_1', sender_type: 'user', timestamp: '2024-03-15T10:00:00Z', text: 'مرحبا دكتور، أنا راجعت عندكم الأسبوع الماضي وعملت جلسة تعديل فقرات واستفدت كثير الحمد لله. بدي موعد للجلسة الثانية.' },
      { id: 'm6_2', sender_type: 'page', timestamp: '2024-03-15T10:30:00Z', text: 'أهلاً دكتور سامر، الحمد لله على سلامتك. نسجلك موعد يوم الثلاثاء القادم 5:00 مساءً؟' },
      { id: 'm6_3', sender_type: 'user', timestamp: '2024-03-15T11:00:00Z', text: 'نعم ممتاز، اعتمدوا الموعد.' },
      { id: 'm6_4', sender_type: 'page', timestamp: '2024-03-20T14:30:00Z', text: 'تمت الجلسة الثانية بنجاح، نتمنى لك دوام الصحة والعافية.' }
    ]
  },
  {
    id: 'demo_conv_7',
    meta_conversation_id: 't_10158472910484444',
    contact: {
      id: 'demo_usr_7',
      meta_user_id: 'usr_2211928319',
      name: 'يوسف شقير',
      phone: null,
      city: 'الزرقاء',
      source: 'Ad response'
    },
    source: 'Ad response',
    ad_name: 'حملة علاج عرق النسا بدون جراحة - فيديو عمّان',
    lead_stage: 'مفقود',
    first_message_at: '2025-06-20T15:00:00Z',
    last_message_at: '2025-06-20T16:30:00Z',
    messages: [
      { id: 'm7_1', sender_type: 'user', timestamp: '2025-06-20T15:00:00Z', text: 'بدي احجز موعد، عندي ألم ديسك بالظهر ومش قادر أوقف. كم بتكلف الجلسة كاملة؟' },
      { id: 'm7_2', sender_type: 'page', timestamp: '2025-06-20T15:45:00Z', text: 'سلامتك أخي يوسف، الكشفية 15 دينار والجلسة 35 دينار وموقعنا بخلدا. هل يناسبك موعد غداً السبت الساعة 2:00 ظهراً؟' },
      { id: 'm7_3', sender_type: 'user', timestamp: '2025-06-20T16:30:00Z', text: 'غداً بكون بالزرقاء، ممكن بعد بكرة؟' },
      { id: 'm7_4', sender_type: 'page', timestamp: '2025-06-20T16:50:00Z', text: 'نعم متاح الأحد الساعة 3:00 عصراً. أرسل رقمك لنثبت الحجز.' }
    ]
  },
  {
    id: 'demo_conv_8',
    meta_conversation_id: 't_10158472910488888',
    contact: {
      id: 'demo_usr_8',
      meta_user_id: 'usr_3321928300',
      name: 'Crypto Trading Alert',
      phone: null,
      city: 'Unknown',
      source: 'Messenger'
    },
    source: 'Messenger',
    ad_name: null,
    lead_stage: 'غير مؤهل',
    first_message_at: '2025-09-01T04:00:00Z',
    last_message_at: '2025-09-01T04:00:00Z',
    messages: [
      { id: 'm8_1', sender_type: 'user', timestamp: '2025-09-01T04:00:00Z', text: 'Hello admin, join our telegram forex group for guaranteed 500% profit click here: t.me/fakecrypto' }
    ]
  }
];

module.exports = {
  DEMO_CONVERSATIONS
};
