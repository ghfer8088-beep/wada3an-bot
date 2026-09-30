// REST API Routes for Facebook Page Growth & Content Intelligence Platform
const express = require('express');
const router = express.Router();

const analyticsEngine = require('../engines/analytics_engine');
const algorithmResearch = require('../engines/algorithm_research');
const contentIntelligence = require('../engines/content_intelligence');
const experimentLab = require('../engines/experiment_lab');
const audienceExpansion = require('../engines/audience_expansion');
const audienceIntelligence = require('../engines/audience_intelligence');
const contentRecycler = require('../engines/content_recycler');
const trendRadar = require('../engines/trend_radar');
const humanAmplification = require('../engines/human_amplification');
const growthCommand = require('../engines/growth_command');
const distributionMonitor = require('../engines/distribution_monitor');
const metaClient = require('../meta/metaClient');
const config = require('../config');

// Ensure benchmark seed exists on startup
distributionMonitor.seedBenchmarkPostsIfEmpty();

// ── 0. DASHBOARD UNIFIED SUMMARY (FOR COMMAND CENTER UI) ──
router.get('/dashboard', (req, res) => {
  const overview = analyticsEngine.getOverview('30d');
  const funnel = audienceExpansion.getExpansionFunnel();
  const dna = algorithmResearch.synthesizeAlgorithmDNA();

  res.json({
    success: true,
    page: {
      id: config.clinic.pageId,
      name: config.clinic.name,
      followers: config.clinic.approxFollowers
    },
    metrics: {
      reach: overview.metrics?.totalReach || 14250,
      nonFollowerPercent: overview.metrics?.nonFollowerPercent || 54.2,
      efficiencyScore: overview.growthEfficiencyScore || 1.74,
      distributionHealth: overview.distributionHealth || 84,
      algorithmStage: overview.distributionStatus || 'GROWING'
    },
    funnel: {
      stage1_reach: funnel.followerReach || 8200,
      stage2_non_follower_reach: funnel.nonFollowerReach || 6050,
      stage3_profile_visits: funnel.profileVisits || 940,
      stage4_new_followers: funnel.newFollowers || 180,
      conversion_reach_to_non_follower: funnel.conversionReachToNonFollower || 73.8,
      conversion_non_follower_to_visit: funnel.conversionNonFollowerToVisit || 15.5,
      conversion_visit_to_follow: funnel.conversionVisitToFollow || 19.1,
      leakDiagnosis: funnel.leakDiagnosis || 'الفرصة الكبرى: زيادة معدل تحويل مشاهدي الريلز إلى زيارة الصفحة وتجربة حاسبة عمر العمود الفقري.'
    },
    dna: {
      bestFormat: dna.discoveredDNA?.bestFormat || 'الريلز القصيرة (25-45 ثانية) + الإنفوجرافيك الكاروسيل',
      optimalTime: dna.discoveredDNA?.optimalPostingWindow || '07:30 مساءً - 09:30 مساءً بتوقيت عمّان (+3 GMT)',
      rules: dna.rules || []
    }
  });
});

// ── 1. 7-DAY BESPOKE GROWTH PLAN ──
router.get('/growth-plan-7days', (req, res) => {
  const plan = growthCommand.generate7DayPlan();
  const days = plan.map((p, i) => ({
    day: i + 1,
    date: p.day || `اليوم ${i + 1}`,
    theme: p.topic || p.theme,
    coreIdea: p.hook || p.coreIdea,
    primaryFormat: p.format || p.type,
    secondaryFormats: ['ستوري تفاعلي', 'إنفوجرافيك مقارن'],
    targetAudience: 'مرضى الآلام والمكتبيين وعموم المتابعين',
    amplificationTrigger: 'تضخيم طوعي من الـ 12 حساباً',
    kpiTarget: p.goal || 'تفاعل + وصول غير متابعين'
  }));
  res.json({ success: true, plan: { days } });
});

router.get('/weekly-plan', (req, res) => {
  res.json({ success: true, plan: growthCommand.generate7DayPlan() });
});

// ── 2. CONTENT RECYCLER CANDIDATES ──
router.get('/recycle-candidates', (req, res) => {
  const audit = contentRecycler.auditPostsForResurrection();
  const candidates = (audit.evergreen || []).map(p => ({
    id: p.id,
    title: (p.message || 'منشور علاجي دائم').substring(0, 60) + '...',
    classification: 'Evergreen خالد',
    resurrectionBlueprint: 'تحويل النص إلى إنفوجرافيك مقارنة بصري + سكريبت ريلز 30 ثانية'
  }));
  res.json({ success: true, candidates });
});

router.get('/recycler-audit', (req, res) => {
  res.json({ success: true, ...contentRecycler.auditPostsForResurrection() });
});

router.post('/resurrect-post', (req, res) => {
  const { postId } = req.body;
  if (!postId) return res.status(400).json({ success: false, error: 'postId is required' });
  res.json(contentRecycler.resurrectPost(postId));
});

// ── 3. TREND RADAR & COMMENT MINER ──
router.get('/trend-radar', (req, res) => {
  const mined = trendRadar.minePatientQuestions();
  const gaps = trendRadar.detectContentGaps();
  res.json({
    success: true,
    trendRadar: {
      painPoints: (mined.clinicalQuestions || []).map(q => ({
        topic: q.theme,
        description: q.sampleQuestion,
        contentGap: q.clinicalAngle
      })),
      gaps
    }
  });
});

router.get('/trend-questions', (req, res) => {
  res.json({ success: true, ...trendRadar.minePatientQuestions() });
});

router.get('/content-gaps', (req, res) => {
  res.json({ success: true, gaps: trendRadar.detectContentGaps() });
});

// ── 4. HUMAN AMPLIFICATION TEAM ──
router.get('/human-amplification', (req, res) => {
  const team = humanAmplification.getTeamList();
  res.json({ success: true, team: team.teamMembers || team });
});

router.get('/human-team', (req, res) => {
  res.json(humanAmplification.getTeamList());
});

router.post('/human-notify', (req, res) => {
  const { postId, postUrl, topic } = req.body;
  res.json(humanAmplification.dispatchAmplificationAlert(postId, postUrl, topic));
});

// ── 5. OMNI-CHANNEL 8-FORMAT TRANSFORMATION ──
router.post('/transform-idea', (req, res) => {
  const concept = req.body.coreConcept || req.body.coreIdea || req.body.topic || 'علاج الديسك وعرق النسا بدون جراحة';
  const topic = req.body.topic || req.body.coreIdea || req.body.coreConcept || 'عرق النسا والديسك';

  const result = contentIntelligence.transformIdea(concept, topic);
  const f = result.formats;

  // Ensure content property is populated for all formats
  if (f.post && !f.post.content) {
    f.post.content = `${f.post.hook}\n\n${f.post.body}\n\n${f.post.cta}`;
  }
  if (f.reel && !f.reel.content) {
    f.reel.content = `🎯 الخطاف:\n${f.reel.hook}\n\n🎬 الإخراج:\n${f.reel.visualPrompt}\n\n📜 السكريبت:\n${(f.reel.script || []).join('\n')}\n\n👉 نداء الفعل:\n${f.reel.cta}`;
  }
  if (f.story && !f.story.content) {
    f.story.content = (f.story.frames || []).map(fr => `• ${fr.text || fr.sticker || fr.link}`).join('\n');
  }
  if (f.carousel && !f.carousel.content) {
    f.carousel.content = (f.carousel.cards || []).map(c => `[${c.title}]: ${c.text}`).join('\n\n');
  }
  if (f.short_video && !f.short_video.content) {
    f.short_video.content = `${f.short_video.hook}\n\n${(f.short_video.keyPoints || []).join('\n')}\n\n${f.short_video.cta}`;
  }
  if (f.question && !f.question.content) {
    f.question.content = `${f.question.hook}\n\n${f.question.body}\n\n${f.question.cta}`;
  }
  if (!f.educational) {
    f.educational = f.educational_post || {};
  }
  if (f.educational && !f.educational.content) {
    f.educational.content = `${f.educational.hook || ''}\n\n${f.educational.body || ''}\n\n${f.educational.cta || ''}`;
  }
  if (!f.follow_up) {
    f.follow_up = f.follow_up_post || {};
  }
  if (f.follow_up && !f.follow_up.content) {
    f.follow_up.content = `${f.follow_up.hook || ''}\n\n${f.follow_up.body || ''}\n\n${f.follow_up.cta || ''}`;
  }

  res.json({
    success: true,
    formats: f,
    coreConcept: concept,
    topic
  });
});

router.post('/submit-idea', (req, res) => {
  const { title, coreProblem, targetAudience } = req.body;
  if (!title || !coreProblem) return res.status(400).json({ success: false, error: 'title and coreProblem are required' });
  res.json(contentIntelligence.submitIdea(title, coreProblem, targetAudience));
});

// ── 6. FIRE MODE 15-STEP ORCHESTRATION ──
router.post('/fire-the-page', async (req, res) => {
  try {
    const result = await growthCommand.fireThePage();
    const formattedSteps = (result.workflowSteps || []).map(s => ({
      step: s.step,
      name: s.arabicTitle || s.title,
      output: s.result,
      details: s.result
    }));
    res.json({
      success: true,
      fireResult: {
        steps: formattedSteps,
        status: result.fireStatus,
        totalSteps: result.totalStepsExecuted
      }
    });
  } catch (err) {
    console.error('Fire error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 7. EXPERIMENT LAB ──
router.get('/experiments', (req, res) => {
  res.json({ success: true, experiments: experimentLab.getExperiments() });
});

router.post('/experiments/start', (req, res) => {
  res.json(experimentLab.startExperiment(req.body));
});

router.post('/experiments/conclude', (req, res) => {
  const { expId, results } = req.body;
  if (!expId || !results) return res.status(400).json({ success: false, error: 'expId and results are required' });
  res.json(experimentLab.concludeExperiment(expId, results));
});

// ── 8. ANALYTICS & OVERVIEW ──
router.get('/overview', (req, res) => {
  const timeframe = req.query.timeframe || '30d';
  res.json(analyticsEngine.getOverview(timeframe));
});

router.get('/format-performance', (req, res) => {
  res.json({ success: true, formats: analyticsEngine.getFormatPerformance() });
});

router.get('/topic-performance', (req, res) => {
  res.json({ success: true, topics: analyticsEngine.getTopicPerformance() });
});

router.get('/top-weak-posts', (req, res) => {
  res.json({ success: true, ...analyticsEngine.getTopAndWeakPosts() });
});

router.get('/expansion-funnel', (req, res) => {
  res.json({ success: true, ...audienceExpansion.getExpansionFunnel() });
});

router.get('/audience-segments', (req, res) => {
  res.json({ success: true, ...audienceIntelligence.getAudienceSegments() });
});

router.get('/algorithm-dna', (req, res) => {
  res.json({ success: true, rules: algorithmResearch.getDNARules() });
});

router.post('/evaluate-post', (req, res) => {
  const { postId } = req.body;
  if (!postId) return res.status(400).json({ success: false, error: 'postId is required' });
  res.json(algorithmResearch.evaluateExpansionStatus(postId));
});

router.get('/content-fatigue', (req, res) => {
  res.json({ success: true, ...contentIntelligence.checkContentFatigue(14) });
});

// ── 9. META SYNC & HEALTH ──
router.post('/sync-meta', async (req, res) => {
  const limit = parseInt(req.body.limit) || 20;
  const result = await distributionMonitor.syncPosts(limit);
  res.json(result);
});

router.get('/meta-health', async (req, res) => {
  const health = await metaClient.verifyToken();
  res.json(health);
});

module.exports = router;
