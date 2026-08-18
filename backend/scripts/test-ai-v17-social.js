const assert = require('assert');
const {
  AiAgentOrchestratorService,
} = require('../dist/modules/ai-agent/ai-agent-orchestrator.service.js');

const service = new AiAgentOrchestratorService(
  null,
  null,
  null,
  null,
  null,
  null,
  null,
);

function social(message) {
  return service.buildDeterministicSocialTurn(message);
}

const greeting = social('helo bgbi');
assert(greeting, 'typo greeting should be recognized');
assert(/Chào bạn/.test(greeting.assistantMessage));
assert(greeting.quickReplies.some((x) => /Gợi ý lô/.test(x.label)));

const angry = social('địt mẹ m');
assert(angry, 'pure frustration/profanity should be de-escalated');
assert(/xin lỗi/.test(angry.assistantMessage));
assert(/tôn trọng/.test(angry.assistantMessage));

const spiritual = social('tư vấn tâm linh i');
assert(spiritual, 'vague spiritual request should be understood');
assert(/Bát Tự/.test(spiritual.assistantMessage));
assert(spiritual.quickReplies.length >= 3);

assert.strictEqual(
  social('dịch vụ đéo gì mắc vậy'),
  null,
  'mixed frustration + real domain question should continue to semantic planner',
);
assert.strictEqual(
  social('hello cho tui coi lô A'),
  null,
  'greeting + real request should not be swallowed by greeting handler',
);

const thanks = social('cảm ơn nha');
assert(thanks && /Không có gì/.test(thanks.assistantMessage));

console.log('AI v17 social + quick-reply smoke tests: PASS');
