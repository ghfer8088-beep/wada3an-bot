/**
 * Database Schema Migration for Rigorous Logical Calibration
 * Adds granular stage columns, explainability evidence, manual override, and data quality flags.
 */

const { getDb } = require('./db');

function migrateSchema() {
  const db = getDb();
  console.log('🔄 Checking & applying database migration for logical calibration...');

  const tableInfo = db.prepare('PRAGMA table_info(conversations)').all();
  const existingCols = new Set(tableInfo.map(c => c.name));

  const colsToAdd = [
    ['system_lead_stage', 'TEXT'],
    ['manual_lead_stage', 'TEXT'],
    ['classification_confidence', 'REAL DEFAULT 0'],
    ['classification_reasons', 'TEXT'],
    ['classification_evidence', 'TEXT'],
    ['has_price_inquiry', 'INTEGER DEFAULT 0'],
    ['has_appointment_intent', 'INTEGER DEFAULT 0'],
    ['has_appointment_request', 'INTEGER DEFAULT 0'],
    ['has_phone_shared', 'INTEGER DEFAULT 0'],
    ['has_appointment_confirmed', 'INTEGER DEFAULT 0'],
    ['has_attended', 'INTEGER DEFAULT 0'],
    ['has_converted_payment', 'INTEGER DEFAULT 0'],
    ['is_explicit_rejection', 'INTEGER DEFAULT 0'],
    ['is_potentially_lost', 'INTEGER DEFAULT 0'],
    ['is_lost', 'INTEGER DEFAULT 0'],
    ['is_reactivation_candidate', 'INTEGER DEFAULT 0'],
    ['reactivation_reason', 'TEXT'],
    ['reactivation_disqualification_reason', 'TEXT'],
    ['data_quality_issues', 'TEXT'],
    ['override_reason', 'TEXT'],
    ['override_by', 'TEXT'],
    ['override_at', 'DATETIME'],
    ['opportunity_tier', 'TEXT DEFAULT NULL'],
    ['opportunity_score_breakdown', 'TEXT DEFAULT NULL'],
    ['has_medical_need', 'INTEGER DEFAULT 0'],
    ['last_user_message_text', 'TEXT DEFAULT NULL'],
    ['last_user_message_at', 'DATETIME DEFAULT NULL']
  ];

  for (const [colName, colType] of colsToAdd) {
    if (!existingCols.has(colName)) {
      console.log(`  + Adding column conversations.${colName} (${colType})`);
      db.prepare(`ALTER TABLE conversations ADD COLUMN ${colName} ${colType}`).run();
    }
  }

  // Create table for Analytics Audit Metric Catalog
  db.prepare(`
    CREATE TABLE IF NOT EXISTS metrics_catalog (
      metric_key TEXT PRIMARY KEY,
      name_ar TEXT NOT NULL,
      category TEXT NOT NULL,
      entity_level TEXT DEFAULT 'محادثة (Conversation)',
      can_overlap TEXT DEFAULT 'لا (No)',
      count INTEGER DEFAULT 0,
      definition_ar TEXT NOT NULL,
      calculation_ar TEXT NOT NULL,
      data_source TEXT NOT NULL,
      confidence_level TEXT NOT NULL,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Check if columns exist in metrics_catalog
  const mcInfo = db.prepare('PRAGMA table_info(metrics_catalog)').all();
  const mcCols = new Set(mcInfo.map(c => c.name));
  if (!mcCols.has('entity_level')) {
    db.prepare("ALTER TABLE metrics_catalog ADD COLUMN entity_level TEXT DEFAULT 'محادثة (Conversation)'").run();
  }
  if (!mcCols.has('can_overlap')) {
    db.prepare("ALTER TABLE metrics_catalog ADD COLUMN can_overlap TEXT DEFAULT 'لا (No)'").run();
  }

  // Create table for Definition Change Log
  db.prepare(`
    CREATE TABLE IF NOT EXISTS metric_change_logs (
      id TEXT PRIMARY KEY,
      metric_name TEXT NOT NULL,
      old_definition TEXT,
      new_definition TEXT,
      old_count INTEGER,
      new_count INTEGER,
      reason_for_change TEXT,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  console.log('✅ Schema migration completed.');
}

module.exports = { migrateSchema };

if (require.main === module) {
  migrateSchema();
}
