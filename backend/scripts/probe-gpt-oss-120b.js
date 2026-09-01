require('dotenv').config();

const { ConfigService } = require('@nestjs/config');
const { envConfig } = require('../dist/config/env.config.js');
const {
  OpenAiSecondaryService,
} = require('../dist/modules/ai-agent/openai.service.js');

async function main() {
  const effort = process.env.AI_PROBE_REASONING_EFFORT || 'low';
  const maxTokens = Number(process.env.AI_PROBE_MAX_TOKENS) || 1200;
  const timeoutMs = Number(process.env.AI_PROBE_TIMEOUT_MS) || 45000;
  const service = new OpenAiSecondaryService(
    new ConfigService(envConfig()),
  );
  const startedAt = Date.now();
  try {
    const response = await service.chat(
      [
        {
          role: 'system',
          content:
            'Trả lời bằng tiếng Việt. Luôn xuất câu trả lời cuối cùng, không chỉ reasoning.',
        },
        {
          role: 'user',
          content:
            'Tóm tắt trong 4 câu cách cân nhắc giữa giá, vị trí gần cổng, diện tích và hướng khi chọn lô nghĩa trang cho gia đình có người lớn tuổi.',
        },
      ],
      [],
      'auto',
      {
        maxTokens,
        temperature: 0.1,
        reasoningEffort: effort,
        timeoutMs,
        totalTimeoutMs: timeoutMs,
        routingKey: `gpt-oss-120b-probe-${Date.now()}`,
      },
    );
    const message = response.choices?.[0]?.message;
    console.log(
      JSON.stringify({
        ok: Boolean(message?.content?.trim()),
        model: response.model || service.model,
        latencyMs: Date.now() - startedAt,
        effort,
        maxTokens,
        contentLength: message?.content?.trim().length || 0,
        reasoningLength: message?.reasoning_content?.trim().length || 0,
        preview: message?.content?.trim().slice(0, 500) || '',
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        ok: false,
        model: service.model,
        latencyMs: Date.now() - startedAt,
        effort,
        maxTokens,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exitCode = 1;
  }
}

main();
