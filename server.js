const express = require('express');
const bodyParser = require('body-parser');
const https = require('https');

const app = express();
app.use(bodyParser.json());
app.use(express.static(__dirname));
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Mount Growth & Content Intelligence Platform REST APIs
const growthRoutes = require('./src/routes/growthRoutes');
app.use('/api/growth', growthRoutes);


// Configuration
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || 'EAAW983LxTGwBSnQsU1OY6nIEzbCqbExeDPkH3OlAuv9UZCMAh0FqMwNbmoMopTXY8ViWdOZBffTUuOUldj9ZAxCF1t6JeoCCK4KQPZAS1jSTnGdEo7N6B5Fl3x5o0RcGXcjSZBEOMCj21DtCvEeq6LhZATR8eODlagjme7WRNmtT8EAK9QBsS8m5hNfkpNirIqoocmQwAhtocbBuiM0uXNKNkAqJlBjiym9iIgF8lXuZAfdPVUEk7sYxwZDZD';
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

// Tools Metadata for Server-Side SEO & Social Share Preview (WhatsApp, Facebook, Twitter, iMessage)
const fs = require('fs');
const path = require('path');

const TOOLS_CONFIG = {
  'spine-age': {
    title: '🧬 حاسبة عمر العمود الفقري الحقيقي | فحص سريري بيوميكانيكي',
    desc: 'فحص سريري وبيوميكانيكي فوري يكشف العمر الحقيقي لفقراتك وتوازن قوامك الحركي بالتعاون مع مركز وداعاً للألم.',
    file: 'spine_age_calculator.html'
  },
  'abhar': {
    title: '📌 كاشف متلازمة الأبهر وعقد الأكتاف | فحص سريري تخصصي T3-T5',
    desc: 'فحص سريري لتحديد مواضع نقاط التحفيز العضلي الليفي (Trigger Points) ومستوى انضغاط الفقرات الصدرية T3-T5.',
    file: 'tool_runner.html'
  },
  'sheep-load': {
    title: '🐑 مؤشر الإجهاد العنقي والتحدب البيوميكانيكي | فحص سريري',
    desc: 'حساب بيوميكانيكي دقيق للأحمال الميكانيكية الزائدة الواقعة على فقرات العنق نتيجة زوايا الجلوس واستخدام الأجهزة.',
    file: 'tool_runner.html'
  },
  'sciatica': {
    title: '⚡ فاحص ضغط العصب الوركي وعرق النسا | تقييم سريري L4-S1',
    desc: 'تقييم سريري دقيق للتمييز بين متلازمة العضلة الكمثرية العضلية وانضغاط الجذور العصبية للفقرات القطنية L4-S1.',
    file: 'tool_runner.html'
  },
  'sleep-posture': {
    title: '🛌 مقياس إجهاد وضعيات النوم والتيبس الصباحي | فحص سريري',
    desc: 'فحص استقامة العمود الفقري والفقرات العنقية أثناء النوم، والكشف عن أسباب التيبس والصداع الصباحي.',
    file: 'tool_runner.html'
  },
  'driver-strain': {
    title: '🚗 فاحص الإجهاد العضلي والفقري أثناء القيادة | فحص سريري',
    desc: 'كشف تأثير اهتزازات السيارة والجلوس الطويل خلف المقود على الفقرات القطنية والعضلة الكمثرية.',
    file: 'tool_runner.html'
  },
  'uneven-shoulder': {
    title: '🎒 فاحص عدم تناظر الكتفين واعتلال القوام | فحص سريري',
    desc: 'فحص تماثل لوحي الكتف وميلان العمود الفقري ومحاذاة القوام الحركي نتيجة حمل الحقائب وعادات الحركة.',
    file: 'tool_runner.html'
  },
  'pelvic-balance': {
    title: '⚖️ مقياس توازن الحوض والديسك القطني | فحص سريري L5-S1',
    desc: 'فحص استقامة الحوض وتساوي توزيع الأحمال لحماية غضاريف الفقرات القطنية L4-L5 و L5-S1.',
    file: 'tool_runner.html'
  }
};

function renderToolWithMeta(req, res, toolKey) {
  const cfg = TOOLS_CONFIG[toolKey];
  const fileName = cfg ? cfg.file : (toolKey === 'spine-age' ? 'spine_age_calculator.html' : 'tool_runner.html');
  const filePath = path.join(__dirname, fileName);

  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err || !cfg) {
      return res.sendFile(filePath);
    }

    const host = req.get('host') || 'wada3an-bot.onrender.com';
    const protocol = req.protocol || 'https';
    const fullUrl = `${protocol}://${host}/${toolKey}`;
    const logoUrl = `${protocol}://${host}/logo.jpg`;

    const metaBlock = `
  <title>${cfg.title}</title>
  <meta name="description" content="${cfg.desc}">
  <!-- Tool-Specific Open Graph / WhatsApp Preview Tags -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${fullUrl}">
  <meta property="og:title" content="${cfg.title}">
  <meta property="og:description" content="${cfg.desc}">
  <meta property="og:image" content="${logoUrl}">
  <meta property="og:site_name" content="Smart Check Tools | مركز وداعاً للألم">
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${cfg.title}">
  <meta name="twitter:description" content="${cfg.desc}">
  <meta name="twitter:image" content="${logoUrl}">`;

    let customHtml = html.replace(/<title[\s\S]*?<\/title>/i, metaBlock);
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.send(customHtml);
  });
}

// Smart Check Tools Portal Homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'smart_check_hub.html'));
});

app.get('/tools', (req, res) => {
  res.sendFile(path.join(__dirname, 'smart_check_hub.html'));
});

app.get('/smart-check', (req, res) => {
  res.sendFile(path.join(__dirname, 'smart_check_hub.html'));
});

// MetaViral Hub 360° — Facebook Content Domination Platform
app.get('/viral-hub', (req, res) => {
  res.sendFile(path.join(__dirname, 'viral_hub.html'));
});
app.get('/hub', (req, res) => {
  res.sendFile(path.join(__dirname, 'viral_hub.html'));
});

// ══════════════════════════════════════════════════════
// MISSION CONTROL — Server-side session (single user)
// ══════════════════════════════════════════════════════
let mcSession = { active: false, queue: [], current: 0, postUrl: '', updatedAt: null };

// CORS for MC API (called from facebook.com by bookmarklet)
function mcCors(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.sendStatus(200); return; }
  next();
}

// GET: Bookmarklet fetches current active comment
app.get('/api/mc-status', mcCors, (req, res) => {
  if (!mcSession.active || mcSession.current >= mcSession.queue.length) {
    return res.json({ active: false, message: 'لا توجد جلسة نشطة' });
  }
  const item = mcSession.queue[mcSession.current];
  res.json({
    active: true,
    seq: `${mcSession.current + 1} من ${mcSession.queue.length}`,
    account: item.name,
    comment: item.comment,
    action: item.action,
    postUrl: mcSession.postUrl,
    current: mcSession.current,
    total: mcSession.queue.length
  });
});

// POST: Hub starts a new MC session
app.post('/api/mc-set', mcCors, (req, res) => {
  const { queue, postUrl } = req.body;
  if (!queue || !Array.isArray(queue)) return res.json({ success: false, error: 'Invalid queue' });
  mcSession = { active: true, queue, current: 0, postUrl: postUrl || '', updatedAt: new Date().toISOString() };
  res.json({ success: true, total: queue.length });
});

// POST: Bookmarklet or Hub advances to next account
app.post('/api/mc-advance', mcCors, (req, res) => {
  if (!mcSession.active) return res.json({ success: false, error: 'No active session' });
  if (mcSession.current < mcSession.queue.length - 1) {
    mcSession.current++;
    res.json({ success: true, current: mcSession.current, total: mcSession.queue.length, complete: false });
  } else {
    mcSession.active = false;
    res.json({ success: true, complete: true });
  }
});

// POST: End session
app.post('/api/mc-end', mcCors, (req, res) => {
  mcSession = { active: false, queue: [], current: 0, postUrl: '', updatedAt: null };
  res.json({ success: true });
});

// Target Page: وداعاً للألم | https://www.facebook.com/30minutes30
const TARGET_PAGE_ID = '30minutes30';

// API: Fetch Page Posts via Graph API (for MetaViral Hub)
app.get('/api/page-posts', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const fields = 'id,message,story,created_time,permalink_url,full_picture';
  const url = `https://graph.facebook.com/v17.0/${TARGET_PAGE_ID}/posts?fields=${fields}&limit=${limit}&access_token=${PAGE_ACCESS_TOKEN}`;
  https.get(url, (fbRes) => {
    let data = '';
    fbRes.on('data', chunk => data += chunk);
    fbRes.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.error) {
          // Fallback to /me/posts if page ID fails
          const fallbackUrl = `https://graph.facebook.com/v17.0/me/posts?fields=${fields}&limit=${limit}&access_token=${PAGE_ACCESS_TOKEN}`;
          https.get(fallbackUrl, (fbRes2) => {
            let data2 = '';
            fbRes2.on('data', c => data2 += c);
            fbRes2.on('end', () => {
              try {
                const json2 = JSON.parse(data2);
                if (json2.error) {
                  res.json({ success: false, error: json2.error.message, posts: [] });
                } else {
                  res.json({ success: true, posts: json2.data || [], total: (json2.data||[]).length, source: 'me' });
                }
              } catch(e) { res.json({ success: false, error: 'Parse error', posts: [] }); }
            });
          }).on('error', err => res.json({ success: false, error: err.message, posts: [] }));
        } else {
          res.json({ success: true, posts: json.data || [], total: (json.data||[]).length, source: TARGET_PAGE_ID });
        }
      } catch(e) {
        res.json({ success: false, error: 'خطأ في تحليل الاستجابة', posts: [] });
      }
    });
  }).on('error', err => {
    res.json({ success: false, error: err.message, posts: [] });
  });
});

// API: Page Info
app.get('/api/page-info', (req, res) => {
  res.json({
    name: 'وداعاً للألم',
    url: 'https://www.facebook.com/30minutes30',
    id: TARGET_PAGE_ID,
    phone: '0790360440',
    location: 'خلدا، عمّان'
  });
});


// Serve Spine Age Calculator with Custom Meta
app.get('/spine-age', (req, res) => {
  renderToolWithMeta(req, res, 'spine-age');
});

// Serve All 7 Specialized Diagnostic Tools with Distinct Meta
const diagnosticTools = [
  'abhar',
  'sheep-load',
  'sciatica',
  'sleep-posture',
  'driver-strain',
  'uneven-shoulder',
  'pelvic-balance'
];

diagnosticTools.forEach(toolRoute => {
  app.get(`/${toolRoute}`, (req, res) => {
    renderToolWithMeta(req, res, toolRoute);
  });
});

app.get('/tool', (req, res) => {
  const qId = req.query.id;
  if (qId && TOOLS_CONFIG[qId]) {
    renderToolWithMeta(req, res, qId);
  } else {
    res.sendFile(path.join(__dirname, 'tool_runner.html'));
  }
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
