/**
 * Automated Verification Suite for Meta Conversation Intelligence & Reactivation Engine
 */

const assert = require('assert');
const ArabicNLP = require('./src/intelligence/arabicNlp');
const { ConversationAnalyzer } = require('./src/intelligence/rulesEngine');
const MessagingCompliance = require('./src/intelligence/complianceEngine');
const MetaDiagnostic = require('./src/intelligence/metaDiagnostic');
const db = require('./src/intelligence/db');

async function runTests() {
  console.log('🧪 Starting Meta Conversation Intelligence Test Suite...\n');

  // ── TEST 1: Arabic NLP Normalization & Dialects ──
  console.log('▶ Test 1: Arabic NLP & Normalization');
  const rawText1 = 'كككككم السِّعْرُ لِجَلْسَةِ الْعِلاَجِ الطَّبِيعِيِّ بِخَلْدَا؟';
  const norm1 = ArabicNLP.normalize(rawText1);
  assert(norm1.includes('كم'), 'Should collapse repeated letters');
  assert(!norm1.includes('ِ'), 'Should strip diacritics');
  assert(norm1.includes('سعر'), 'Should match normal word');
  
  const jordanianDialect = 'بدي احجز موعد اليوم ضروري ظهري بوجعني وعندي عرق النسا';
  assert(ArabicNLP.containsAny(jordanianDialect, ['بدي احجز', 'اريد احجز']), 'Should detect Jordanian booking dialect');
  assert(ArabicNLP.containsAny(jordanianDialect, ['عرق النسا', 'ديسك']), 'Should detect medical symptom terms');

  const phoneText = 'تواصلوا معي على الرقم 0795123456 للتأكيد';
  const extractedPhone = ArabicNLP.extractPhoneNumber(phoneText);
  assert.strictEqual(extractedPhone, '0795123456', 'Should extract valid Jordanian mobile number');
  console.log('  ✓ Arabic NLP & Dialect tests passed.');

  // ── TEST 2: Rules Engine & Intent Scoring ──
  console.log('▶ Test 2: Rules Engine, Intent Classification & Lead Scoring');
  const mockConv = { id: 'test_c1', source: 'Ad response', created_at: '2026-09-30T10:00:00Z' };
  const mockMessages = [
    { sender_type: 'user', text: 'مرحبا، كم سعر جلسة الكايروبراكتيك؟ وبدي احجز موعد بكره إذا ممكن' },
    { sender_type: 'page', text: 'أهلاً بك، الكشفية 15 دينار والجلسة 35 دينار، متاح غداً الساعة 4 عصراً' },
    { sender_type: 'user', text: 'وين عيادتكم بخلدا بالظبط؟ وهذا رقمي 0791234567' }
  ];

  const analysis = ConversationAnalyzer.analyze(mockConv, mockMessages);
  assert(analysis.allIntents.includes('PRICE_INQUIRY'), 'Should detect price inquiry');
  assert(analysis.allIntents.includes('APPOINTMENT_REQUEST'), 'Should detect appointment request');
  assert(analysis.allIntents.includes('LOCATION_INQUIRY'), 'Should detect location inquiry');
  assert(analysis.appointment_intent_score >= 80, `Expected high appointment score, got ${analysis.appointment_intent_score}`);
  assert(analysis.purchase_intent_score >= 80, `Expected high purchase score, got ${analysis.purchase_intent_score}`);
  assert(analysis.lead_score >= 80, `Expected high opportunity score, got ${analysis.lead_score}`);
  assert.strictEqual(analysis.lead_stage, 'تم التحويل', 'Should mark stage as converted due to phone submission');
  assert.strictEqual(analysis.detected_phone, '0791234567');
  console.log('  ✓ Rules Engine intent and scoring tests passed.');

  // ── TEST 3: Messaging Compliance Layer ──
  console.log('▶ Test 3: Meta Messaging Policy & 24-Hour Window Compliance');
  // Sub-case A: Within 24 hours
  const recentTimestamp = new Date(Date.now() - (2 * 60 * 60 * 1000)).toISOString(); // 2 hours ago
  const compRecent = MessagingCompliance.evaluateOutboundCompliance(mockConv, recentTimestamp);
  assert.strictEqual(compRecent.isAllowed, true, 'Should allow standard messaging within 24 hours');
  assert.strictEqual(compRecent.status, 'ALLOWED_24H_WINDOW');

  // Sub-case B: Outside 24 hours without tag -> BLOCKED
  const oldTimestamp = '2024-05-10T12:00:00Z'; // 2 years ago
  const compOldBlocked = MessagingCompliance.evaluateOutboundCompliance(mockConv, oldTimestamp);
  assert.strictEqual(compOldBlocked.isAllowed, false, 'Should block standard promo messaging outside 24h window');
  assert.strictEqual(compOldBlocked.status, 'BLOCKED_24H_EXPIRED');

  // Sub-case C: Outside 24 hours with compliant tag -> ALLOWED WITH TAG
  const compOldWithTag = MessagingCompliance.evaluateOutboundCompliance(mockConv, oldTimestamp, 'CONFIRMED_EVENT_UPDATE');
  assert.strictEqual(compOldWithTag.isAllowed, true, 'Should allow sending with approved tag');
  assert.strictEqual(compOldWithTag.status, 'ALLOWED_WITH_TAG');
  console.log('  ✓ Compliance Layer tests passed.');

  // ── TEST 4: Meta Diagnostic Engine (Checks A to K) ──
  console.log('▶ Test 4: Meta Connection Diagnostic Suite (A to K)');
  const diag = await MetaDiagnostic.runDiagnostics('30minutes30', 'DEMO_TOKEN', true);
  assert.strictEqual(diag.summary.total_checks, 11, 'Should perform all 11 A-K checks');
  assert(diag.checks.A_page_access, 'Check A must exist');
  assert(diag.checks.B_messenger_access, 'Check B must exist');
  assert(diag.checks.J_messaging_rules, 'Check J must exist');
  assert(diag.checks.K_permissions_audit, 'Check K must exist');
  console.log(`  ✓ Diagnostic suite passed with status: ${diag.summary.status}`);

  // ── TEST 5: Database Operations & KPI aggregation ──
  console.log('▶ Test 5: Database Operations, Filtering & Bulk Operations');
  const kpis = db.getDashboardKPIs();
  assert(kpis.totalConversations > 0, 'Database should contain seeded demo conversations');
  assert(kpis.reactivationOpportunities > 0, 'Should calculate reactivation opportunities');
  console.log(`  ✓ Database KPIs: Total=${kpis.totalConversations}, Reactivations=${kpis.reactivationOpportunities}, Converted=${kpis.convertedCount}`);

  const convList = db.getConversations({}, 1, 10);
  assert(convList.data.length > 0, 'Should retrieve paginated conversations');

  // Test bulk stage update
  const firstId = convList.data[0].id;
  const updateResult = db.updateLeadStage(firstId, 'مؤهل', 'فاحص النظام');
  assert.strictEqual(updateResult, true, 'Should update lead stage');

  const auditLogs = db.getAuditLogs(5);
  assert(auditLogs.length > 0, 'Should record audit log event');
  console.log('  ✓ Database queries, updates, and audit logging passed.');

  console.log('\n🎉 ALL 5 TEST SUITES PASSED FLAWLESSLY!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
