/**
 * Live Graph API Production Synchronization Script
 * Fetches ALL real Messenger conversations, participants, and message history
 * for Page: مركز وداعاً للألم (102533574608295)
 */

const https = require('node:https');
const db = require('./src/intelligence/db');
const { ConversationAnalyzer } = require('./src/intelligence/rulesEngine');
const ArabicNLP = require('./src/intelligence/arabicNlp');
const config = require('./src/config');

const PAGE_ID = '102533574608295';
const ACCESS_TOKEN = 'EAAW983LxTGwBSiAMUElWiAEI98xDMsWlafjSRc7LVFCvo8Hr2up77xJCo9R5GoDf72vS1sAF7btHoTrVKGF3KFxGxKZBJmdD5omDZAQItXkKtid49qlZBdAZB7AKVIiZCdTWo1OpksV8TUZAD98gPDMmciwPf353DEMDM6sE55zOrgZA2JWOITfCqyAXdJ56n7ZBp19LZBeAQwlJW1QQoCMP0knOj';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function syncAllRealConversations() {
  console.log('🚀 Starting Full Production Sync with Meta Graph API...');
  console.log(`Page: ${config.clinic.name} (${PAGE_ID})`);

  const dbInst = db.getDb();
  let nextUrl = `https://graph.facebook.com/v21.0/${PAGE_ID}/conversations?fields=id,updated_time,participants,messages.limit(50){id,message,created_time,from}&limit=25&access_token=${ACCESS_TOKEN}`;
  
  let pageCount = 0;
  let totalConversations = 0;
  let totalMessages = 0;
  let highOpportunityCount = 0;

  while (nextUrl) {
    pageCount++;
    console.log(`\n⏳ Fetching Batch ${pageCount}...`);

    let res;
    try {
      res = await fetchJson(nextUrl);
    } catch (err) {
      console.error('Fetch error:', err.message);
      break;
    }

    if (res.error) {
      console.error('Meta API Error:', JSON.stringify(res.error, null, 2));
      break;
    }

    const conversations = res.data || [];
    if (conversations.length === 0) {
      console.log('No more conversations found in this batch.');
      break;
    }

    for (const conv of conversations) {
      totalConversations++;

      // 1. Identify Contact / Participant
      const participants = conv.participants?.data || [];
      const userParticipant = participants.find(p => p.id !== PAGE_ID) || participants[0] || { id: 'unknown', name: 'مستخدم فيسبوك' };
      const contactId = `fb_${userParticipant.id}`;
      const contactName = userParticipant.name || 'مستخدم فيسبوك';

      // 2. Prepare Messages
      const rawMsgs = conv.messages?.data || [];
      // Sort messages chronologically
      rawMsgs.sort((a, b) => new Date(a.created_time) - new Date(b.created_time));

      const processedMsgs = [];
      let fullText = '';
      let detectedPhone = null;
      let isAdResponse = false;

      for (const m of rawMsgs) {
        const isFromPage = (m.from?.id === PAGE_ID || m.from?.name?.includes('وداعاً للألم'));
        const msgText = m.message || '';
        fullText += ' ' + msgText;

        if (msgText.includes('تم الرد على إعلان') || msgText.includes('إعلان بواسطة')) {
          isAdResponse = true;
        }

        const phone = ArabicNLP.extractPhoneNumber(msgText);
        if (phone && !isFromPage) {
          detectedPhone = phone;
        }

        processedMsgs.push({
          id: m.id,
          conversation_id: conv.id,
          meta_message_id: m.id,
          sender_type: isFromPage ? 'page' : 'user',
          timestamp: m.created_time,
          text: msgText,
          is_from_page: isFromPage ? 1 : 0
        });
      }

      totalMessages += processedMsgs.length;

      // 3. Upsert Contact
      dbInst.prepare(`
        INSERT OR REPLACE INTO contacts (id, meta_user_id, name, source, phone, city)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        contactId,
        userParticipant.id,
        contactName,
        isAdResponse ? 'Ad response' : 'Messenger',
        detectedPhone,
        'عمّان'
      );

      // 4. Run Arabic Rules & Opportunity Scoring
      const analysis = ConversationAnalyzer.analyze(
        { id: conv.id, source: isAdResponse ? 'Ad response' : 'Messenger' },
        processedMsgs
      );

      if (analysis.opportunity_score >= 60) {
        highOpportunityCount++;
      }

      const firstTime = processedMsgs[0]?.timestamp || conv.updated_time;
      const lastTime = processedMsgs[processedMsgs.length - 1]?.timestamp || conv.updated_time;

      // 5. Upsert Conversation (Parent Table)
      dbInst.prepare(`
        INSERT OR REPLACE INTO conversations (
          id, meta_conversation_id, contact_id, channel, source, ad_name,
          first_message_at, last_message_at, message_count, status,
          lead_stage, intent, opportunity_score, appointment_intent_score,
          purchase_intent_score, recency_bracket, is_demo, updated_at
        ) VALUES (?, ?, ?, 'messenger', ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
      `).run(
        conv.id,
        conv.id,
        contactId,
        isAdResponse ? 'Ad response' : 'Messenger',
        isAdResponse ? 'إعلان فيسبوك ممول' : null,
        firstTime,
        lastTime,
        processedMsgs.length,
        analysis.lead_stage,
        analysis.intent,
        analysis.opportunity_score,
        analysis.appointment_intent_score,
        analysis.purchase_intent_score,
        analysis.recency_bracket
      );

      // 6. Upsert Messages (Child Table)
      const insertMsg = dbInst.prepare(`
        INSERT OR REPLACE INTO messages (id, conversation_id, meta_message_id, sender_type, timestamp, text, is_from_page)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const msg of processedMsgs) {
        insertMsg.run(
          msg.id,
          conv.id,
          msg.meta_message_id,
          msg.sender_type,
          msg.timestamp,
          msg.text,
          msg.is_from_page
        );
      }

      // 7. Upsert Analysis Results
      dbInst.prepare(`
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

      // 8. Attach Smart Labels
      const getLabel = dbInst.prepare('SELECT id FROM labels WHERE name = ?');
      const insertConvLabel = dbInst.prepare(`
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

    console.log(`  ✓ Batch ${pageCount} synced (${conversations.length} conversations). Total so far: ${totalConversations}`);

    // Check pagination next
    nextUrl = res.paging?.next || null;

    // Safety pause to respect Meta rate limits
    await new Promise(r => setTimeout(r, 600));
  }

  console.log('\n════════════════════════════════════════════════════════');
  console.log('✅ SYNC COMPLETED SUCCESSFULLY!');
  console.log(`📊 Total Real Conversations Synced: ${totalConversations}`);
  console.log(`💬 Total Messages Analyzed: ${totalMessages}`);
  console.log(`🔥 High Opportunity Leads Identified: ${highOpportunityCount}`);
  console.log('════════════════════════════════════════════════════════\n');
}

syncAllRealConversations().catch(err => {
  console.error('Fatal Sync Error:', err);
  process.exit(1);
});
