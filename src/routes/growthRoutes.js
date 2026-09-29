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

// Ensure benchmark seed exists on startup
distributionMonitor.seedBenchmarkPostsIfEmpty();

// 1. Overview & Key Metrics
router.get('/overview', (req, res) => {
  const timeframe = req.query.timeframe || '30d';
  res.json(analyticsEngine.getOverview(timeframe));
});

// 2. Format & Topic Breakdowns
router.get('/format-performance', (req, res) => {
  res.json({ success: true, formats: analyticsEngine.getFormatPerformance() });
});

router.get('/topic-performance', (req, res) => {
  res.json({ success: true, topics: analyticsEngine.getTopicPerformance() });
});

router.get('/top-weak-posts', (req, res) => {
  res.json({ success: true, ...analyticsEngine.getTopAndWeakPosts() });
});

// 3. Audience Funnel & Segments
router.get('/expansion-funnel', (req, res) => {
  res.json({ success: true, ...audienceExpansion.getExpansionFunnel() });
});

router.get('/audience-segments', (req, res) => {
  res.json({ success: true, ...audienceIntelligence.getAudienceSegments() });
});

// 4. Algorithm Research & DNA
router.get('/algorithm-dna', (req, res) => {
  res.json({ success: true, rules: algorithmResearch.getDNARules() });
});

router.post('/evaluate-post', (req, res) => {
  const { postId } = req.body;
  if (!postId) return res.status(400).json({ success: false, error: 'postId is required' });
  res.json(algorithmResearch.evaluateExpansionStatus(postId));
});

// 5. Content Intelligence & Transformation
router.get('/content-fatigue', (req, res) => {
  res.json({ success: true, ...contentIntelligence.checkContentFatigue(14) });
});

router.post('/transform-idea', (req, res) => {
  const { coreConcept, topic } = req.body;
  if (!coreConcept) return res.status(400).json({ success: false, error: 'coreConcept is required' });
  res.json({ success: true, ...contentIntelligence.transformIdea(coreConcept, topic) });
});

router.post('/submit-idea', (req, res) => {
  const { title, coreProblem, targetAudience } = req.body;
  if (!title || !coreProblem) return res.status(400).json({ success: false, error: 'title and coreProblem are required' });
  res.json(contentIntelligence.submitIdea(title, coreProblem, targetAudience));
});

// 6. Content Recycler & Resurrection
router.get('/recycler-audit', (req, res) => {
  res.json({ success: true, ...contentRecycler.auditPostsForResurrection() });
});

router.post('/resurrect-post', (req, res) => {
  const { postId } = req.body;
  if (!postId) return res.status(400).json({ success: false, error: 'postId is required' });
  res.json(contentRecycler.resurrectPost(postId));
});

// 7. Trend Radar & Comment Miner
router.get('/trend-questions', (req, res) => {
  res.json({ success: true, ...trendRadar.minePatientQuestions() });
});

router.get('/content-gaps', (req, res) => {
  res.json({ success: true, gaps: trendRadar.detectContentGaps() });
});

// 8. Experiment Lab
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

// 9. Human Amplification Panel
router.get('/human-team', (req, res) => {
  res.json(humanAmplification.getTeamList());
});

router.post('/human-notify', (req, res) => {
  const { postId, postUrl, topic } = req.body;
  res.json(humanAmplification.dispatchAmplificationAlert(postId, postUrl, topic));
});

// 10. Fire Mode & 7-Day Growth Plan
router.post('/fire-the-page', async (req, res) => {
  const result = await growthCommand.fireThePage();
  res.json(result);
});

router.get('/weekly-plan', (req, res) => {
  res.json({ success: true, plan: growthCommand.generate7DayPlan() });
});

// 11. Meta Live Sync
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
