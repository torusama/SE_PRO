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
  tool_call_id?: string;
  tool_calls?: NvidiaToolCall[];
}

export interface NvidiaChatResponse {
  choices: Array<{
    message: NvidiaMessage;
    finish_reason?: string;
  }>;
  model?: string;
}
