const express = require('express');
const bodyParser = require('body-parser');
const https = require('https');

const app = express();
app.use(bodyParser.json());

// Configuration
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || 'EAAW983LxTGwBSiAMUElWiAEI98xDMsWlafjSRc7LVFCvo8Hr2up77xJCo9R5GoDf72vS1sAF7btHoTrVKGF3KFxGxKZBJmdD5omDZAQItXkKtid49qlZBdAZB7AKVIiZCdTWo1OpksV8TUZAD98gPDMmciwPf353DEMDM6sE55zOrgZA2JWOITfCqyAXdJ56n7ZBp19LZBeAQwlJW1QQoCMP0knOj';
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'wada3an_pain_free_2026';
const PORT = process.env.PORT || 3000;

// In-memory conversation state & leads store
const userState = new Map();
const capturedLeads = [];
const recentLogs = [];

function addLog(type, data) {
  const entry = { time: new Date().toISOString(), type, data };
  console.log(`[${entry.time}] [${type}]`, JSON.stringify(data));
  recentLogs.unshift(entry);
  if (recentLogs.length > 50) recentLogs.pop();
}

// 1. Webhook Verification (GET /webhook)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  addLog('WEBHOOK_GET', { query: req.query });

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      addLog('WEBHOOK_VERIFY_SUCCESS', { challenge });
      res.status(200).send(challenge);
    } else {
      addLog('WEBHOOK_VERIFY_FAIL', { token, expected: VERIFY_TOKEN });
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// Logs endpoint
app.get('/logs', (req, res) => {
  res.json({
    status: 'online',
    server_time: new Date().toISOString(),
    logs_count: recentLogs.length,
    logs: recentLogs
  });
});

// Smart Check Tools Portal Homepage
app.get('/', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'smart_check_hub.html'));
});

app.get('/tools', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'smart_check_hub.html'));
});

app.get('/smart-check', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'smart_check_hub.html'));
});

// Serve Spine Age Calculator (Smart Check Tools)
app.get('/spine-age', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'spine_age_calculator.html'));
});

// Serve Logo
app.get('/logo.jpg', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'logo.jpg'));
});

// Serve Royal Patients Directory
app.get('/royal-patients', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'royal_patients.html'));
});

// 2. Incoming Messages Handler (POST /webhook)
app.post('/webhook', (req, res) => {
  const body = req.body;
  addLog('WEBHOOK_POST', body);

  if (body.object === 'page' || body.object === 'instagram') {
    if (body.entry && Array.isArray(body.entry)) {
      body.entry.forEach(entry => {
        const webhookEvent = entry.messaging ? entry.messaging[0] : null;
        if (webhookEvent && webhookEvent.message && webhookEvent.message.text) {
          const senderPsid = webhookEvent.sender.id;
          const text = webhookEvent.message.text.trim();
          addLog('INCOMING_MESSAGE', { senderPsid, text });
          handleUserMessage(senderPsid, text);
        }
      });
    }

    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// Core Clinical & Psychological Intelligence Engine
function handleUserMessage(senderPsid, text) {
  // Typing indicator
  sendSenderAction(senderPsid, 'typing_on');

  const history = userState.get(senderPsid) || { turns: 0, phone: null, name: null, complaint: null };
  history.turns += 1;
  const isFirstTurn = history.turns <= 1;

  const reply = generateClinicalResponse(text, isFirstTurn, history);
  userState.set(senderPsid, history);

  // Send message after realistic typing delay
  setTimeout(() => {
    sendTextMessage(senderPsid, reply);
  }, 1200);
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

function generateClinicalResponse(original, isFirstTurn, history) {
  const norm = normalizeArabic(original);

  // Treatment methods
  if (norm.includes("طريقه العلاج") || norm.includes("طرق العلاج") || norm.includes("كيف بتعالجوا") || norm.includes("شو بتعملوا") || norm.includes("شو بتسووا") || norm.includes("كيف العلاج")) {
    return (isFirstTurn ? "أهلاً بك 🌸 " : "") + `المعالج في وداعاً للألم متخصص كايروبراكتيك وتقويم يدوي للعمود الفقري والمفاصل وتأهيل حركي بدون جراحة وبدون أي أدوية 🌿\n\nالعلاج بيعتمد على فحص ميكانيكية الفقرات، وإعادة محاذاتها بلطف لإزالة الضغط عن الأعصاب المضغوطة، وفك التشنجات العضلية العميقة.\n\nتفضل خبرني، شو المشكلة أو الألم اللي بتشتكي منه لنفيدك بطريقة التعامل معه؟`;
  }

  // Identity
  if (norm.includes("كم عمرك") || norm.includes("شو اسمك") || norm.includes("مين انت") || norm.includes("مين معي") || norm.includes("انت دكتور") || norm.includes("انت روبوت") || norm.includes("ذكاء اصطناعي")) {
    return `أنا المساعد لـ **وداعاً للألم** في عمّان - خلدا 😊\nمهمتي أساعدك وأجاوبك على كافة استفسارات الديسك وعرق النسا والكايروبراكتيك وترتيب المواعيد بمقرنا بخلدا أو الزيارات المنزلية.\n\nتفضل خبرني، كيف بقدر أخدمك اليوم؟ 🌸`;
  }

  // Phone number extraction
  const phoneMatch = original.match(/(07[789]\d{7}|07\d{8})/);
  if (phoneMatch) {
    history.phone = phoneMatch[0];
    return `تسلم يا غالي، تم تسجيل رقمك (${history.phone}) بملف الحجز 🌿\nرح يتواصل معك المعالج عبر الواتساب لتثبيت أقرب موعد وتزويدك باللوكيشن لمقرنا بخلدا. وألف لا بأس عليك.`;
  }

  // Third party
  if (norm.includes("زوجي") || norm.includes("زوجتي") || norm.includes("والدتي") || norm.includes("امي") || norm.includes("والدي") || norm.includes("ابوي") || norm.includes("ابني") || norm.includes("بنتي") || norm.includes("اختي") || norm.includes("اخوي") || norm.includes("مش انا")) {
    let rel = "المريض";
    if (norm.includes("زوجي")) rel = "زوجك";
    else if (norm.includes("والدتي") || norm.includes("امي")) rel = "الوالدة";
    else if (norm.includes("والدي") || norm.includes("ابوي")) rel = "الوالد";
    else if (norm.includes("ابني")) rel = "ابنك";
    history.complaint = `حالة خاصة لـ (${rel})`;
    return `ألف لا بأس على ${rel} وربي يشفيه ويعافيه ويخفف عنه يا رب 🌸\n\nاحكيلي شو الأعراض اللي بشتكي منها بالتحديد؟ وهل بيقدر يجي لمقرنا بخلدا ولا الحركة والنزول صعبة عليه وبفضل زيارة منزلية؟`;
  }

  // Numbness
  if (norm.includes("خدر") || norm.includes("تنميل") || norm.includes("نمنمه") || norm.includes("وخز") || norm.includes("شكشكه")) {
    history.complaint = "خدر وتنميل بالأطراف";
    return (isFirstTurn ? "سلامتك وألف لا بأس عليك يا رب 🌿\n" : "") + `الخدر والتنميل هو إشارة من الجسم بوجود عصب مضغوط ومخنوق؛ إذا كان بالرقبة بيمتد للأصابع والإيدين، وإذا كان بالفقرات القطنية بيمتد للأرجل والقدمين.\n\nبالجلسة بنحدد مخرج العصب المضغوط وبنحرره يدوياً لترجع التروية والإحساس الطبيعي.\n\nطمني، التنميل متركز باليدين ولا بالأرجل؟ وكم صار له معك؟`;
  }

  // Greetings
  if (/^(مرحبا|مرحبتين|هلا|اهلين|سلام|السلام عليكم|سلام عليكم|صباح الخير|مساء الخير|يعطيك العافيه|يعطيكم العافيه|الو|مساء الورد|هاي)$/.test(norm)) {
    if (norm.includes("سلام عليكم") || norm.includes("السلام عليكم")) {
      return "وعليكم السلام ورحمة الله وبركاته 🌸\nيا هلا فيك وألف لا بأس عليك.. تفضل يا غالي كيف بنقدر نساعدك اليوم في وداعاً للألم؟ شو المشكلة أو الألم اللي بتشتكي منه؟";
    }
    return "يا هلا فيك وألف مرحباً 🌸\nسلامتك يا رب.. تفضل احكيلي شو الألم أو الاستفسار اللي عندك حتى نفيدك بالحل؟";
  }

  // Disc
  if (norm.includes("بتعالجوا الديسك") || norm.includes("علاج الديسك") || norm.includes("بتعالج الديسك") || norm.includes("بتعالجوه") || norm.includes("بتعالجو") || (norm.includes("ديسك") && norm.includes("علاج"))) {
    history.complaint = "انزلاق غضروفي (ديسك)";
    return (isFirstTurn ? "يا هلا فيك 🌸\n" : "") + `نعم بالتأكيد بنعالجه، المعالج في وداعاً للألم متخصص كايروبراكتيك لعلاج الديسك والانزلاق الغضروفي بتقويم الفقرات وإزالة الضغط عن العصب بدون جراحة وبدون أدوية 🌿\n\nوجع الديسك متعب وبأثر على النوم والقعدة الطويلة. طمني يا غالي، الوجع محصور بأسفل الظهر ولا بتحسه نازل ع الأرداف أو الأرجل؟ وهل عملت صورة رنين (MRI) من قبل؟`;
  }

  // Sciatica
  if (norm.includes("ارداف") || norm.includes("الارداف") || norm.includes("اليه") || norm.includes("ورك") || norm.includes("الوركه") || norm.includes("فخذ") || norm.includes("ساق") || norm.includes("كعب") || norm.includes("رجل") || norm.includes("كهربا") || norm.includes("كهرباء") || norm.includes("عرق النسا")) {
    history.complaint = "عرق النسا والعصب الوركي";
    return (isFirstTurn ? "سلامتك وألف لا بأس عليك يا رب 🌿\n" : "") + `شعور الكهربا ونزول الألم للأرداف وخلف الفخذ علامة واضحة لانضغاط عصب عرق النسا، وهذا الألم بعيق الحركة وبصحيك من النوم عند التقلب.\n\nالمسكنات هون ما بتنفع لأنها ما بترفع الفقرة عن العصب؛ المعالج عندنا بفك الضغط المباشر يدوياً لترجع تمشي براحة تامة بإذن الله.\n\nطمني، الوجع بيزيد معك مع المشي والوقفة ولا بالقعدة؟ وهل واصل لأصابع القدم؟`;
  }

  // Booking
  if (norm.includes("حجز") || norm.includes("موعد") || norm.includes("احجز") || norm.includes("رتبلي") || norm.includes("بدي اجي") || norm.includes("بدي موعد") || norm.includes("تواصل") || norm.includes("رقم تليفون") || norm.includes("رقم تلفون")) {
    return `بتشرفنا بأي وقت وألف سلامة عليك 🌸\nحتى يسجل المعالج اسمك ونثبت لك أقرب موعد مناسب للفحص والتقويم بمقرنا بخلدا أو نرتب زيارة منزلية، تفضل زودنا باسمك الكريم ورقم هاتفك، أو تواصل معنا مباشرة عبر الواتساب: 📲 0790360440`;
  }

  // Session count
  if (norm.includes("كم جلسه") || norm.includes("قديش جلسه") || norm.includes("عدد الجلسات") || norm.includes("بكم جلسه بطيب")) {
    return (isFirstTurn ? "يا هلا فيك أخي الكريم 🌸\n\n" : "") + `طبياً ومهنياً: **لا يوجد عدد جلسات ثابت كبصمة للجميع**؛ لأن استجابة الأنسجة ومستوى الضغط على العصب يختلف من شخص لآخر.\n\nفي **الجلسة الأولى** بنقوم بالفحص وتقويم الفقرات، وأغلب الحالات بتشعر بانشراح وزوال مباشر لثقل الألم من أول جلسة، والمعالج بحددلك بأمانة مدى حاجتك لمتابعة.\n\nشو المشكلة أو الألم اللي شاغل بالك حتى نفيدك بدقة؟`;
  }

  // Price
  if (norm.includes("سعر") || norm.includes("بكم") || norm.includes("تكلفه") || norm.includes("قديش") || norm.includes("كشفيتكم")) {
    return `سعر الجلسة المتكاملة في مقرنا بخلدا هو **20 دينار فقط** 🌿 (تشمل الفحص السريري، تقويم الكايروبراكتيك، فك التشنجات العضلية العميقة، والتأهيل الحركي).\n\nأما الزيارات المنزلية فسعرها يعتمد على موقعك في عمّان أو الزرقاء والوقت.\n\nبتحب نحددلك موعد بمقرنا بخلدا ليرتاح ظهرك؟`;
  }

  // Location
  if (norm.includes("وين موقعكم") || norm.includes("وين العياده") || norm.includes("عنوانكم") || norm.includes("موقعكم")) {
    return `مقرنا في **عمّان - منطقة خلدا** 📍\nوللزيارات المنزلية نحن بنغطي كافة مناطق عمّان ومحافظة الزرقاء بالكامل لمن يفضل الراحة في منزله.\n\nبتحب تشرفنا بمقرنا في خلدا ولا بتفضل نرتبلك زيارة منزلية؟`;
  }

  // General pain
  if (norm.includes("وجع") || norm.includes("الم") || norm.includes("تعبان") || norm.includes("ديسك")) {
    return (isFirstTurn ? "سلامتك وما تشوف شر 🌸\n" : "") + `المعالج في وداعاً للألم متخصص بتقويم العمود الفقري والمفاصل والتأهيل الحركي بمقرنا بخلدا وعندنا زيارات منزلية بعمان والزرقاء.\n\nهذا الألم ما لازم تسكت عليه عشان ما يزيد الضغط على العصب. خبرنا وين مكمن الوجع بالزبط، وهل هو مستمر ولا بيجي مع حركة معينة؟`;
  }

  return (isFirstTurn ? "سلامتك وألف لا بأس عليك يا غالي 🌸\n" : "") + `المعالج في وداعاً للألم متخصص بتقويم العمود الفقري (الكايروبراكتيك) والتأهيل الحركي في مقرنا بخلدا، وعندنا كمان زيارات منزلية بعمان والزرقاء.\n\nتفضل خبرني شو الأعراض اللي حاسس فيها حالياً حتى نفيدك بالخطوة الصح؟`;
}

// Meta Graph API Sender
function sendTextMessage(recipientId, messageText) {
  const messageData = {
    recipient: { id: recipientId },
    message: { text: messageText }
  };

  callSendApi(messageData);
}

function sendSenderAction(recipientId, action) {
  const actionData = {
    recipient: { id: recipientId },
    sender_action: action
  };
  callSendApi(actionData);
}

function callSendApi(payload) {
  const data = JSON.stringify(payload);
  const options = {
    hostname: 'graph.facebook.com',
    port: 443,
    path: `/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(data, 'utf8')
    }
  };

  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      if (res.statusCode !== 200) {
        addLog('META_SEND_ERROR', { statusCode: res.statusCode, body });
        console.error('Meta API Error:', res.statusCode, body);
      } else {
        addLog('META_SEND_SUCCESS', { statusCode: res.statusCode, body });
        console.log('Message delivered to Facebook user successfully.');
      }
    });
  });

  req.on('error', (e) => {
    addLog('META_REQUEST_ERROR', { error: e.message });
    console.error('HTTPS request error:', e);
  });

  req.write(Buffer.from(data, 'utf8'));
  req.end();
}

app.listen(PORT, () => {
  console.log(`🚀 Wada3an Facebook Bot Server running on port ${PORT}`);
});
