/**
 * Meta Graph API Sync Engine & Data Import Fallback Center
 * Handles live sync and JSON/CSV historical export imports
 */

const { getDb } = require('./db');
const { ConversationAnalyzer } = require('./rulesEngine');
const MetaDiagnostic = require('./metaDiagnostic');

class SyncEngine {
  /**
   * Import historical conversations from JSON/CSV parsed structure
   * Supports standard Meta Business Suite Data Export formats
   */
  static async importParsedRecords(records, sourceName = 'Meta Data Export') {
    const db = getDb();
    const stats = {
      imported_conversations: 0,
      imported_messages: 0,
      duplicates_skipped: 0,
      errors: 0
    };

    for (const item of records) {
      try {
        const contactId = item.contact_id || `cnt_${Math.random().toString(36).substr(2, 9)}`;
        const convId = item.conversation_id || `conv_${Math.random().toString(36).substr(2, 9)}`;
        const metaConvId = item.meta_conversation_id || `meta_${convId}`;

        // 1. Insert Contact
        db.prepare(`
          INSERT OR IGNORE INTO contacts (id, meta_user_id, name, source, phone, city)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          contactId,
          item.meta_user_id || contactId,
          item.contact_name || 'مستخدم فيسبوك',
          item.source || sourceName,
          item.phone || null,
          item.city || 'عمان'
        );

        // 2. Prepare Messages
        const rawMessages = item.messages || [];
        const messagesToInsert = [];

        for (const m of rawMessages) {
          const msgId = m.id || `msg_${Math.random().toString(36).substr(2, 9)}`;
          const metaMsgId = m.meta_message_id || msgId;

          // Check duplicate
          const existing = db.prepare('SELECT id FROM messages WHERE meta_message_id = ?').get(metaMsgId);
          if (existing) {
            stats.duplicates_skipped++;
            continue;
          }

          messagesToInsert.push({
            id: msgId,
            conversation_id: convId,
            meta_message_id: metaMsgId,
            sender_type: m.sender_type || (m.is_from_page ? 'page' : 'user'),
            timestamp: m.timestamp || new Date().toISOString(),
            text: m.text || '',
            is_from_page: m.is_from_page ? 1 : 0
          });
        }

        // 3. Run Analysis
        const analysis = ConversationAnalyzer.analyze(
          { id: convId, source: item.source || sourceName },
          messagesToInsert
        );

        // 4. Insert Conversation (Parent Table)
        db.prepare(`
          INSERT OR REPLACE INTO conversations (
            id, meta_conversation_id, contact_id, channel, source, ad_name,
            first_message_at, last_message_at, message_count, status,
            lead_stage, intent, opportunity_score, appointment_intent_score,
            purchase_intent_score, recency_bracket, is_demo
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).run(
          convId,
          metaConvId,
          contactId,
          'messenger',
          item.source || sourceName,
          item.ad_name || null,
          messagesToInsert[0]?.timestamp || new Date().toISOString(),
          messagesToInsert[messagesToInsert.length - 1]?.timestamp || new Date().toISOString(),
          messagesToInsert.length,
          'open',
          analysis.lead_stage,
          analysis.intent,
          analysis.opportunity_score,
          analysis.appointment_intent_score,
          analysis.purchase_intent_score,
          analysis.recency_bracket
        );

        // 5. Insert non-duplicate messages (Child Table)
        const insertMsg = db.prepare(`
          INSERT OR REPLACE INTO messages (id, conversation_id, meta_message_id, sender_type, timestamp, text, is_from_page)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const msg of messagesToInsert) {
          insertMsg.run(
            msg.id,
            msg.conversation_id,
            msg.meta_message_id,
            msg.sender_type,
            msg.timestamp,
            msg.text,
            msg.is_from_page
          );
          stats.imported_messages++;
        }

        // 5. Store Analysis
        db.prepare(`
          INSERT OR REPLACE INTO analysis_results (
            id, conversation_id, intent, lead_score, purchase_intent,
            appointment_intent, summary, recommended_action, confidence, purchase_reasons
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          `ar_${convId}`,
          convId,
          analysis.intent,
          analysis.opportunity_score,
          analysis.purchase_intent_score,
          analysis.appointment_intent_score,
          analysis.summary,
          analysis.recommended_action,
          analysis.confidence,
          JSON.stringify(analysis.purchase_reasons)
        );

        stats.imported_conversations++;
      } catch (err) {
        console.error('Error importing record:', err);
        stats.errors++;
      }
    }

    return stats;
  }
}

module.exports = SyncEngine;
