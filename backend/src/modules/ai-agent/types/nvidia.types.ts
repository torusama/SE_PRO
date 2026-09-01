export interface NvidiaToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface NvidiaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  /**
   * Some OpenAI-compatible reasoning models return their private scratch work
   * separately. It is telemetry/debug context only and must never be exposed as
   * the customer-facing answer or accepted as an executable plan.
   */
  reasoning_content?: string | null;
  tool_call_id?: string;
  tool_calls?: NvidiaToolCall[];
}

export interface NvidiaChatResponse {
  choices: Array<{
    message: NvidiaMessage;
    finish_reason?: string;
  }>;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}
