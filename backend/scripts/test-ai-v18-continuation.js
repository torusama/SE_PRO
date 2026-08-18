const assert = require('assert');
const { AiAgentOrchestratorService } = require('../dist/modules/ai-agent/ai-agent-orchestrator.service.js');
const { PlotRecommendationService } = require('../dist/modules/ai-agent/plot-recommendation.service.js');

const service = new AiAgentOrchestratorService(null,null,null,null,null,null,null);
const call = (name, ...args) => service[name](...args);

// Spiritual fallbacks are differentiated (only used when LLM providers fail).
const spiritual = call('buildDeterministicSocialTurn', 'tâm linh đi');
const bazi = call('buildDeterministicSocialTurn', 'bát tự');
assert(spiritual && bazi);
assert.notStrictEqual(spiritual.assistantMessage, bazi.assistantMessage);
assert(/ngày sinh/i.test(bazi.assistantMessage));

// A rejection of the most recent recommendation continues plot search and excludes shown plots.
const history = [
  {
    id: 1,
    role: 'assistant',
    content: 'Mình đã chọn 3 phương án lô A-01-01, A-01-02, A-01-03 để bạn cân nhắc.',
    metadata: {
      recommendations: [
        { optionId: 'OPT-001', plotIds: [11], plotCodes: ['A-01-01'] },
        { optionId: 'OPT-002', plotIds: [12], plotCodes: ['A-01-02'] },
        { optionId: 'OPT-003', plotIds: [13], plotCodes: ['A-01-03'] },
      ],
    },
  },
];
const context = call(
  'contextualizeClarificationReply',
  'hong thích đổi cái khác',
  history,
  { budgetMax: 200000000 },
  'general_question',
);
assert.strictEqual(context.intent, 'recommend_plots');
assert.deepStrictEqual(context.requirements.excludePlotIds, [11,12,13]);
assert.strictEqual(context.requirements.budgetMax, 200000000);
assert.strictEqual(context.requirements.numberOfPlots, 1);

const plan = call(
  'buildDeterministicPlotConsultationPlan',
  'hong thích đổi cái khác',
  context.intent,
  context.requirements,
  history,
);
assert(plan);
assert.strictEqual(plan.action, 'rank_plot_options');
assert.deepStrictEqual(plan.requirements.excludePlotIds, [11,12,13]);

// Recommendation SQL excludes previously shown plots.
let capturedSql = '';
let capturedParams = [];
const db = {
  query: async (sql, params) => {
    capturedSql = sql;
    capturedParams = params;
    return [];
  },
};
const rec = new PlotRecommendationService(db, null, null, null);
(async () => {
  await rec.searchAvailablePlots({
    budgetMax: 200000000,
    numberOfPlots: 1,
    excludePlotIds: [11,12,13],
  });
  assert(/NOT \(plot_id = ANY\(/.test(capturedSql));
  assert(capturedParams.some((x) => Array.isArray(x) && x.join(',') === '11,12,13'));
  console.log('AI v18 semantic continuation smoke tests: PASS');
})().catch((err) => { console.error(err); process.exit(1); });
