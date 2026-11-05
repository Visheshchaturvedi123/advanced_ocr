export type AIProviderId = 'gemini' | 'poolside' | 'ollama-cloud' | 'openrouter';

export type AIProviderKind = 'gemini' | 'openai';

export interface AIProviderMeta {
  id: AIProviderId;
  label: string;
  shortLabel: string;
  model: string;
  models: string[];
  placeholder: string;
  helpUrl: string;
  helpLabel: string;
  kind: AIProviderKind;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionRequest {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: AIToolDefinition[];
  toolChoice?: 'auto' | 'none' | 'required';
}

export interface AICompletionResult {
  text: string;
  providerId: AIProviderId;
  model: string;
}

export interface AICompletionOptions {
  keys?: Partial<Record<AIProviderId, string>>;
  modelOverrides?: Partial<Record<AIProviderId, string>>;
  order?: AIProviderId[];
  exclude?: AIProviderId[];
  onAttempt?: (providerId: AIProviderId, model: string) => void;
}

export interface AIToolFunction {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface AIToolDefinition {
  type: 'function';
  function: AIToolFunction;
}

export interface AIToolCall {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AIToolCompletionResult extends AICompletionResult {
  toolCalls: AIToolCall[];
}
