// Cloudflare Worker for Wada3an Lil Alam (30minutes30)
// Free 24/7 Serverless Webhook for Facebook Messenger & Instagram

const PAGE_ACCESS_TOKEN = 'EAAW983LxTGwBSiAMUElWiAEI98xDMsWlafjSRc7LVFCvo8Hr2up77xJCo9R5GoDf72vS1sAF7btHoTrVKGF3KFxGxKZBJmdD5omDZAQItXkKtid49qlZBdAZB7AKVIiZCdTWo1OpksV8TUZAD98gPDMmciwPf353DEMDM6sE55zOrgZA2JWOITfCqyAXdJ56n7ZBp19LZBeAQwlJW1QQoCMP0knOj';
const VERIFY_TOKEN = 'wada3an_pain_free_2026';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Meta Webhook Verification (GET /webhook or GET /)
    if (request.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        return new Response(challenge, { status: 200 });
      }
      return new Response('👑 وداعاً للألم (30minutes30) - خادم الذكاء الاصطناعي يعمل بنشاط 24/7', { status: 200 });
    }

    // 2. Incoming Messages (POST /webhook or POST /)
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        if (body.object === 'page' || body.object === 'instagram') {
          for (const entry of body.entry) {
            const webhookEvent = entry.messaging ? entry.messaging[0] : null;
            if (webhookEvent && webhookEvent.message && webhookEvent.message.text) {
              const senderPsid = webhookEvent.sender.id;
              const text = webhookEvent.message.text.trim();
              ctx.waitUntil(processAndReply(senderPsid, text));
            }
          }
          return new Response('EVENT_RECEIVED', { status: 200 });
        }
      } catch (err) {
        return new Response('Error', { status: 500 });
      }
      return new Response('Not Found', { status: 404 });
    }

    return new Response('Method Not Allowed', { status: 405 });
  }
};

async function processAndReply(senderPsid, text) {
  const reply = generateClinicalResponse(text);
  await sendMetaMessage(senderPsid, reply);
}

function normalizeArabic(text) {
  return (text || '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[،,.]/g, '')
    .toLowerCase()
    .trim();
}

function generateClinicalResponse(original) {
  const norm = normalizeArabic(original);

  if (norm.includes("طريقه العلاج") || norm.includes("طرق العلاج") || norm.includes("كيف بتعالجوا") || norm.includes("شو بتعملوا") || norm.includes("كيف العلاج")) {
    return `المعالج في وداعاً للألم متخصص كايروبراكتيك وتقويم يدوي للعمود الفقري والمفاصل وتأهيل حركي بدون جراحة وبدون أي أدوية 🌿\n\nالعلاج بيعتمد على فحص ميكانيكية الفقرات، وإعادة محاذاتها بلطف لإزالة الضغط عن الأعصاب المضغوطة، وفك التشنجات العضلية العميقة.\n\nتفضل خبرني، شو المشكلة أو الألم اللي بتشتكي منه لنفيدك بطريقة التعامل معه؟`;
  }

  const phoneMatch = original.match(/(07[789]\d{7}|07\d{8})/);
  if (phoneMatch) {
    return `تسلم يا غالي، تم تسجيل رقمك (${phoneMatch[0]}) بملف الحجز 🌿\nرح يتواصل معك المعالج عبر الواتساب لتثبيت أقرب موعد وتزويدك باللوكيشن لمقرنا بخلدا. وألف لا بأس عليك.`;
  }

  if (norm.includes("زوجي") || norm.includes("زوجتي") || norm.includes("والدتي") || norm.includes("امي") || norm.includes("ابوي") || norm.includes("ابني")) {
    return `ألف لا بأس عليه وربي يشفيه ويعافيه ويخفف عنه يا رب 🌸\nاحكيلي شو الأعراض اللي بشتكي منها بالتحديد؟ وهل بيقدر يجي لمقرنا بخلدا ولا الحركة والنزول صعبة عليه وبفضل زيارة منزلية؟`;
  }

  if (norm.includes("خدر") || norm.includes("تنميل") || norm.includes("نمنمه") || norm.includes("وخز")) {
    return `سلامتك وألف لا بأس عليك يا رب 🌿\nالخدر والتنميل هو إشارة من الجسم بوجود عصب مضغوط ومخنوق؛ إذا كان بالرقبة بيمتد للأصابع والإيدين، وإذا كان بالفقرات القطنية بيمتد للأرجل والقدمين.\n\nبالجلسة بنحدد مخرج العصب المضغوط وبنحرره يدوياً لترجع التروية والإحساس الطبيعي.\n\nطمني، التنميل متركز باليدين ولا بالأرجل؟ وكم صار له معك؟`;
  }

  if (/^(مرحبا|مرحبتين|هلا|اهلين|سلام|السلام عليكم|سلام عليكم|صباح الخير|مساء الخير|يعطيك العافيه|يعطيكم العافيه)$/.test(norm)) {
    return "يا هلا فيك وألف مرحباً 🌸\nسلامتك يا رب.. تفضل احكيلي شو الألم أو الاستفسار اللي عندك في وداعاً للألم حتى نفيدك بالحل؟";
  }

  if (norm.includes("ديسك") || norm.includes("انزلاق")) {
    return `يا هلا فيك 🌸\nنعم بالتأكيد بنعالجه، المعالج في وداعاً للألم متخصص كايروبراكتيك لعلاج الديسك والانزلاق الغضروفي بتقويم الفقرات وإزالة الضغط عن العصب بدون جراحة وبدون أدوية 🌿\n\nوجع الديسك متعب وبأثر على النوم والقعدة الطويلة. طمني يا غالي، الوجع محصور بأسفل الظهر ولا بتحسه نازل ع الأرداف أو الأرجل؟ وهل عملت صورة رنين (MRI) من قبل؟`;
  }

  if (norm.includes("ارداف") || norm.includes("الارداف") || norm.includes("كهربا") || norm.includes("عرق النسا") || norm.includes("فخذ") || norm.includes("رجل")) {
    return `سلامتك وألف لا بأس عليك يا رب 🌿\nشعور الكهربا ونزول الألم للأرداف وخلف الفخذ علامة واضحة لانضغاط عصب عرق النسا، وهذا الألم بعيق الحركة وبصحيك من النوم عند التقلب.\n\nالمسكنات هون ما بتنفع لأنها ما بترفع الفقرة عن العصب؛ المعالج عندنا بفك الضغط المباشر يدوياً لترجع تمشي براحة تامة بإذن الله.\n\nطمني، الوجع بيزيد معك مع المشي والوقفة ولا بالقعدة؟`;
  }

  if (norm.includes("حجز") || norm.includes("موعد") || norm.includes("احجز") || norm.includes("تواصل") || norm.includes("تلفون")) {
    return `بتشرفنا بأي وقت وألف سلامة عليك 🌸\nحتى يسجل المعالج اسمك ونثبت لك أقرب موعد مناسب للفحص والتقويم بمقرنا بخلدا أو نرتب زيارة منزلية، تفضل زودنا باسمك الكريم ورقم هاتفك، أو تواصل معنا مباشرة عبر الواتساب: 📲 0790360440`;
  }

  if (norm.includes("سعر") || norm.includes("بكم") || norm.includes("تكلفه") || norm.includes("قديش")) {
    return `سعر الجلسة المتكاملة في مقرنا بخلدا هو **20 دينار فقط** 🌿 (تشمل الفحص السريري، تقويم الكايروبراكتيك، فك التشنجات العضلية العميقة، والتأهيل الحركي).\n\nأما الزيارات المنزلية فسعرها يعتمد على موقعك في عمّان أو الزرقاء والوقت.\n\nبتحب نحددلك موعد بمقرنا بخلدا ليرتاح ظهرك؟`;
  }

  if (norm.includes("وين موقعكم") || norm.includes("عنوانكم") || norm.includes("موقعكم")) {
    return `مقرنا في **عمّان - منطقة خلدا** 📍\nوللزيارات المنزلية نحن بنغطي كافة مناطق عمّان ومحافظة الزرقاء بالكامل لمن يفضل الراحة في منزله.\n\nبتحب تشرفنا بمقرنا في خلدا ولا بتفضل نرتبلك زيارة منزلية؟`;
  }

  return `المعالج في وداعاً للألم متخصص بتقويم العمود الفقري (الكايروبراكتيك) والتأهيل الحركي بمقرنا بخلدا وعندنا كمان زيارات منزلية بعمان والزرقاء.\n\nتفضل خبرني شو الأعراض اللي حاسس فيها حالياً حتى نفيدك بالخطوة الصح؟ 🌸`;
}

async function sendMetaMessage(recipientId, text) {
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: text }
    })
  });
}
