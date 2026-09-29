// Experiment Lab — Scientific Isolated Variable Testing
const { experiments, dna, logAudit } = require('../db/database');
const config = require('../config');

class ExperimentLab {
  // 1. Create a new controlled experiment with 1 isolated variable
  startExperiment({
    id,
    title,
    hypothesis,
    variableIsolated = 'Hook', // Hook, Format, Length, Time, CTA
    controlDescription,
    variantDescription,
    sampleSizeTarget = 6,
    startDate,
    endDate
  }) {
    const expId = id || `EXP-${String(Date.now()).slice(-4)}`;

    experiments.create({
      id: expId,
      title: title || 'تجربة علمية معزولة',
      hypothesis: hypothesis || 'فرضية اختبار معزولة',
      variable_isolated: variableIsolated || 'Hook',
      control_description: controlDescription || 'الشاهد (المحتوى القياسي)',
      variant_description: variantDescription || 'المتحور (المحتوى التجريبي)',
      sample_size_target: sampleSizeTarget || 6,
      status: 'ACTIVE',
      start_date: startDate || new Date().toISOString().split('T')[0],
      end_date: endDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
    });

    logAudit('EXPERIMENT_STARTED', 'EXPERIMENT', { expId, variableIsolated, hypothesis });

    return {
      success: true,
      experimentId: expId,
      status: 'ACTIVE',
      rule: 'تم عزل متغير واحد فقط لضمان النزاهة العلمية للنتائج وتجنب الخلط السببي.'
    };
  }

  // 2. Conclude Experiment, calculate statistical difference, and feed into Page Algorithm DNA
  concludeExperiment(expId, {
    metricName = 'shares_rate',
    controlMetricValue = 1,
    variantMetricValue = 1,
    conclusionText = 'اكتملت التجربة بنجاح',
    nextRecommendation = 'متابعة نتائج النشر'
  }) {
    const exp = experiments.getById(expId);
    if (!exp) return { success: false, error: 'Experiment not found' };

    const cVal = parseFloat(controlMetricValue) || 1;
    const vVal = parseFloat(variantMetricValue) || 1;
    const diffPct = +(((vVal - cVal) / Math.max(cVal, 0.001)) * 100).toFixed(1);

    // Calculate confidence level based on effect size
    let confidence = 70.0;
    if (Math.abs(diffPct) > 20) confidence = 85.0;
    if (Math.abs(diffPct) > 40) confidence = 92.5;

    experiments.addResult({
      experiment_id: expId,
      control_metric_value: cVal,
      variant_metric_value: vVal,
      metric_name: metricName || 'metric',
      difference_percentage: diffPct,
      confidence_level: confidence,
      conclusion: conclusionText || 'تم توثيق النتائج بنجاح',
      next_experiment_recommendation: nextRecommendation || 'لا توجد توصيات إضافية'
    });

    // Automatically feed conclusion into Page Algorithm DNA
    dna.saveRule({
      page_id: config.meta.pageId,
      dna_key: `exp_finding_${exp.variable_isolated.toLowerCase()}`,
      dna_value: JSON.stringify({
        experimentId: expId,
        variable: exp.variable_isolated,
        metric: metricName,
        difference: diffPct + '%',
        conclusion: conclusionText
      }),
      evidence_type: confidence >= 85 ? 'CORRELATION' : 'HYPOTHESIS',
      confidence_percentage: confidence,
      sample_size: exp.sample_size_target,
      display_fact: `التجربة ${expId}: المتحور حقق فرق ${diffPct}% في ${metricName}.`,
      display_recommendation: nextRecommendation
    });

    logAudit('EXPERIMENT_CONCLUDED', 'EXPERIMENT', { expId, diffPct, confidence });

    return {
      success: true,
      experimentId: expId,
      differencePercentage: diffPct + '%',
      confidenceLevel: confidence + '%',
      dnaUpdated: true,
      conclusion: conclusionText
    };
  }

  // 3. List all Experiments with their status and results
  getExperiments() {
    return experiments.list();
  }
}

module.exports = new ExperimentLab();
