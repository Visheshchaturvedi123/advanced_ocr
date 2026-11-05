import { GoogleGenAI } from '@google/genai';
import type {
  AICompletionOptions,
  AICompletionRequest,
  AICompletionResult,
  AIMessage,
  AIProviderId,
  AIProviderMeta,
  AIToolCall,
  AIToolCompletionResult,
} from './types';

export type { AIProviderId } from './types';

export const GEMINI_PRIMARY_MODEL = 'gemini-3.1-pro-preview';
export const GEMINI_FALLBACK_MODEL = 'gemini-3.8-flash';

const POOLSIDE_BASE_URL = 'https://inference.poolside.ai/v1';
const OLLAMA_CLOUD_BASE_URL = 'https://ollama.com/v1';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export const DEFAULT_PROVIDER_ORDER: AIProviderId[] = [
  'gemini',
  'poolside',
  'ollama-cloud',
  'openrouter',
];

export const AI_PROVIDERS: Record<AIProviderId, AIProviderMeta> = {
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    shortLabel: 'Gemini',
    model: 'Gemini 3.1 Pro',
    models: [GEMINI_PRIMARY_MODEL, GEMINI_FALLBACK_MODEL],
    placeholder: 'AIza...',
    helpUrl: 'https://aistudio.google.com/app/apikey',
    helpLabel: 'Get a Gemini API key at Google AI Studio',
    kind: 'gemini',
  },
  poolside: {
    id: 'poolside',
    label: 'Poolside Laguna',
    shortLabel: 'Poolside',
    model: 'Laguna S 2.1',
    models: ['poolside/laguna-s-2.1'],
    placeholder: 'Paste your Poolside API key',
    helpUrl: 'https://platform.poolside.ai',
    helpLabel: 'Get a Poolside API key at Poolside Platform',
    kind: 'openai',
  },
  'ollama-cloud': {
    id: 'ollama-cloud',
    label: 'Ollama Cloud',
    shortLabel: 'Ollama',
    model: 'GPT-OSS 120B',
    models: ['gpt-oss:120b', 'gemma4:31b', 'nemotron-3-ultra'],
    placeholder: 'Paste your Ollama Cloud API key',
    helpUrl: 'https://ollama.com/settings/keys',
    helpLabel: 'Create an Ollama Cloud API key at ollama.com',
    kind: 'openai',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    shortLabel: 'OpenRouter',
    model: 'Free Router',
    models: ['openrouter/free', 'openrouter/auto'],
    placeholder: 'sk-or-v1-...',
    helpUrl: 'https://openrouter.ai/keys',
    helpLabel: 'Create an OpenRouter API key at openrouter.ai',
    kind: 'openai',
  },
};

const PROVIDER_ORDER_KEY = 'brahma-ai-provider-order';
const ACTIVE_PROVIDER_KEY = 'brahma-ai-provider';
const modelStorageKey = (providerId: AIProviderId) => `brahma-ai-model-${providerId}`;
const keyStorageKey = (providerId: AIProviderId) => `brahma-user-api-key-${providerId}`;

export type AIProviderErrorKind =
  | 'missing_key'
  | 'invalid_key'
  | 'quota'
  | 'model_unavailable'
  | 'network'
  | 'server'
  | 'unknown';

export class AIProviderError extends Error {
  providerId: AIProviderId;
  kind: AIProviderErrorKind;
  status?: number;

  constructor(providerId: AIProviderId, kind: AIProviderErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'AIProviderError';
    this.providerId = providerId;
    this.kind = kind;
    this.status = status;
  }
}

const isProviderId = (value: unknown): value is AIProviderId =>
  typeof value === 'string' && value in AI_PROVIDERS;

export const getProviderOrder = (): AIProviderId[] => {
  try {
    const raw = localStorage.getItem(PROVIDER_ORDER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const seen = new Set<AIProviderId>();
        const ordered: AIProviderId[] = [];
        for (const id of parsed) {
          if (isProviderId(id) && !seen.has(id)) {
            seen.add(id);
            ordered.push(id);
          }
        }
        for (const id of DEFAULT_PROVIDER_ORDER) {
          if (!seen.has(id)) ordered.push(id);
        }
        return ordered;
      }
    }
  } catch {}
  return [...DEFAULT_PROVIDER_ORDER];
};

export const setProviderOrder = (order: AIProviderId[]) => {
  const seen = new Set<AIProviderId>();
  const clean: AIProviderId[] = [];
  for (const id of order) {
    if (isProviderId(id) && !seen.has(id)) {
      seen.add(id);
      clean.push(id);
    }
  }
  for (const id of DEFAULT_PROVIDER_ORDER) {
    if (!seen.has(id)) clean.push(id);
  }
  try {
    localStorage.setItem(PROVIDER_ORDER_KEY, JSON.stringify(clean));
  } catch {}
  return clean;
};

export const getActiveProvider = (): AIProviderId => {
  try {
    const saved = localStorage.getItem(ACTIVE_PROVIDER_KEY);
    if (isProviderId(saved)) return saved;
  } catch {}
  return getProviderOrder()[0] ?? 'gemini';
};

export const setActiveProvider = (providerId: AIProviderId): AIProviderId[] => {
  try {
    localStorage.setItem(ACTIVE_PROVIDER_KEY, providerId);
  } catch {}
  const next = [providerId, ...getProviderOrder().filter((id) => id !== providerId)];
  return setProviderOrder(next);
};

export const getProviderApiKey = (providerId: AIProviderId): string => {
  try {
    const own = localStorage.getItem(keyStorageKey(providerId));
    if (own) return own;
    if (providerId === 'gemini') return localStorage.getItem('brahma-user-api-key') || '';
  } catch {}
  return '';
};

export const saveProviderApiKey = (providerId: AIProviderId, apiKey: string) => {
  try {
    localStorage.setItem(keyStorageKey(providerId), apiKey);
    if (providerId === 'gemini') localStorage.setItem('brahma-user-api-key', apiKey);
  } catch {}
};

export const clearProviderApiKey = (providerId: AIProviderId) => {
  try {
    localStorage.removeItem(keyStorageKey(providerId));
    if (providerId === 'gemini') localStorage.removeItem('brahma-user-api-key');
  } catch {}
};

export const getProviderModel = (providerId: AIProviderId): string => {
  try {
    const saved = localStorage.getItem(modelStorageKey(providerId));
    if (saved && AI_PROVIDERS[providerId].models.includes(saved)) return saved;
  } catch {}
  return AI_PROVIDERS[providerId].models[0];
};

export const saveProviderModel = (providerId: AIProviderId, model: string) => {
  try {
    localStorage.setItem(modelStorageKey(providerId), model);
  } catch {}
};

export const getProviderModels = (providerId: AIProviderId, override?: string): string[] => {
  const configured = override || getProviderModel(providerId);
  const available = AI_PROVIDERS[providerId].models;
  const ordered = available.includes(configured)
    ? [configured, ...available.filter((model) => model !== configured)]
    : [configured, ...available];
  return [...new Set(ordered.filter(Boolean))];
};

export const getConfiguredProviderIds = (keys?: Partial<Record<AIProviderId, string>>): AIProviderId[] =>
  getProviderOrder().filter((id) => {
    const key = (keys?.[id] ?? getProviderApiKey(id)).trim();
    return !!key;
  });

export const hasConfiguredProvider = (keys?: Partial<Record<AIProviderId, string>>): boolean =>
  getConfiguredProviderIds(keys).length > 0;

const errorText = (status: number, providerId: AIProviderId, detail: string) => {
  const label = AI_PROVIDERS[providerId].label;
  const clean = detail.replace(/\s+/g, ' ').slice(0, 280);
  return `${label} API error ${status}: ${clean || 'Request failed.'}`;
};

const classifyStatus = (status: number, message: string): AIProviderErrorKind => {
  const lower = message.toLowerCase();
  if (status === 401 || status === 403 || lower.includes('invalid api key') || lower.includes('unauthorized')) {
    return 'invalid_key';
  }
  if (status === 429 || lower.includes('rate limit') || lower.includes('quota')) return 'quota';
  if (
    status === 404 ||
    lower.includes('model not found') ||
    lower.includes('does not exist') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('temporarily unavailable')
  ) {
    return 'model_unavailable';
  }
  if (status === 503) return 'model_unavailable';
  if (status >= 500) return 'server';
  return 'unknown';
};

const classifyGeminiError = (providerId: AIProviderId, err: any): AIProviderError => {
  if (err instanceof AIProviderError) return err;
  const message = String(err?.message || 'Gemini request failed.');
  const lower = message.toLowerCase();
  const statusMatch = message.match(/\b(\d{3})\b/);
  const status = typeof err?.status === 'number'
    ? err.status
    : typeof err?.code === 'number'
      ? err.code
      : statusMatch
        ? Number(statusMatch[1])
        : undefined;
  if (status === 401 || status === 403 || lower.includes('invalid api key') || lower.includes('unauthorized')) {
    return new AIProviderError(providerId, 'invalid_key', 'Gemini API key is invalid or unauthorized.', status);
  }
  if (lower.includes('resource_exhausted') || lower.includes('quota') || lower.includes('rate limit')) {
    return new AIProviderError(providerId, 'quota', 'Gemini quota or rate limit reached.', status);
  }
  if (
    status === 404 ||
    status === 503 ||
    lower.includes('not_found') ||
    lower.includes('not found') ||
    lower.includes('no longer available') ||
    lower.includes('unsupported model') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('temporarily unavailable')
  ) {
    return new AIProviderError(providerId, 'model_unavailable', 'Gemini model is unavailable.', status);
  }
  if (status && status >= 500) {
    return new AIProviderError(providerId, 'server', 'Gemini service is unavailable.', status);
  }
  return new AIProviderError(providerId, 'unknown', message, status);
};

const buildGeminiContents = (messages: AIMessage[]) => {
  const contents = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));
  if (contents.length > 0) return contents;
  return [{ role: 'user', parts: [{ text: 'Continue.' }] }];
};

const completeGemini = async (
  request: AICompletionRequest,
  providerId: AIProviderId,
  apiKey: string,
  model: string
): Promise<string> => {
  try {
    const client = new GoogleGenAI({ apiKey });
    const systemInstruction = request.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n');
    const response = await client.models.generateContent({
      model,
      contents: buildGeminiContents(request.messages),
      config: {
        ...(systemInstruction ? { systemInstruction } : {}),
        temperature: request.temperature ?? 0.4,
        maxOutputTokens: request.maxTokens ?? 512,
      },
    });
    const text = String(response.text || '').trim();
    if (!text) throw new AIProviderError(providerId, 'unknown', 'Gemini returned an empty response.');
    return text;
  } catch (err) {
    throw classifyGeminiError(providerId, err);
  }
};

const openAiBaseUrl = (providerId: AIProviderId) => {
  if (providerId === 'poolside') return POOLSIDE_BASE_URL;
  if (providerId === 'ollama-cloud') return OLLAMA_CLOUD_BASE_URL;
  if (providerId === 'openrouter') return OPENROUTER_BASE_URL;
  return '';
};

const extractOpenAiContent = (data: any): string => {
  const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part: any) => (typeof part === 'string' ? part : part?.text || ''))
      .join('')
      .trim();
  }
  return '';
};

const completeOpenAiCompatible = async (
  request: AICompletionRequest,
  providerId: AIProviderId,
  apiKey: string,
  model: string
): Promise<string> => {
  const baseUrl = openAiBaseUrl(providerId);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (providerId === 'openrouter') {
    headers['X-Title'] = 'Brahma';
  }
  const body: Record<string, unknown> = {
    model,
    messages: request.messages,
    temperature: request.temperature ?? 0.4,
    max_tokens: request.maxTokens ?? 512,
  };
  if (providerId === 'poolside') {
    body.chat_template_kwargs = { enable_thinking: false };
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    throw new AIProviderError(
      providerId,
      'network',
      `${AI_PROVIDERS[providerId].label} could not be reached. Check your connection.`
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    let message = detail;
    try {
      const parsed = JSON.parse(detail);
      message = parsed?.error?.message || parsed?.message || detail;
    } catch {}
    const kind = classifyStatus(response.status, String(message));
    throw new AIProviderError(
      providerId,
      kind,
      errorText(response.status, providerId, String(message || response.statusText)),
      response.status
    );
  }

  const data = await response.json().catch(() => null);
  const text = extractOpenAiContent(data);
  if (!text) throw new AIProviderError(providerId, 'unknown', 'The provider returned an empty response.');
  return text;
};

const normalizeToolArguments = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return { value: parsed };
    } catch {
      return { value: raw };
    }
  }
  return {};
};

const parseContentToolCalls = (text: string): AIToolCall[] => {
  const calls: AIToolCall[] = [];
  const blockPattern = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi;
  let block: RegExpExecArray | null;
  while ((block = blockPattern.exec(text))) {
    const inner = block[1].trim();
    if (!inner) continue;
    if (inner.startsWith('{')) {
      try {
        const parsed = JSON.parse(inner);
        const name = parsed?.name || parsed?.tool || parsed?.function?.name;
        if (name) {
          calls.push({
            name: String(name),
            arguments: normalizeToolArguments(parsed?.arguments ?? parsed?.args ?? parsed?.parameters ?? parsed?.function?.arguments),
          });
          continue;
        }
      } catch {}
    }
    const nameMatch = inner.match(/^([A-Za-z_][\w.-]*)/);
    if (!nameMatch) continue;
    const args: Record<string, unknown> = {};
    const argPattern = /<arg_key>\s*([\s\S]*?)\s*<\/arg_key>\s*<arg_value>\s*([\s\S]*?)\s*<\/arg_value>/gi;
    let arg: RegExpExecArray | null;
    while ((arg = argPattern.exec(inner))) {
      const key = arg[1].trim();
      const raw = arg[2].trim();
      let value: unknown = raw;
      try { value = JSON.parse(raw); } catch {}
      args[key] = value;
    }
    calls.push({ name: nameMatch[1], arguments: args });
  }
  if (calls.length) return calls;

  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const name = parsed?.name || parsed?.tool || parsed?.function?.name;
      if (name && (parsed?.arguments || parsed?.args || parsed?.parameters || parsed?.function?.arguments)) {
        return [{
          name: String(name),
          arguments: normalizeToolArguments(parsed?.arguments ?? parsed?.args ?? parsed?.parameters ?? parsed?.function?.arguments),
        }];
      }
    } catch {}
  }
  return [];
};

const completeOpenAiToolsCompatible = async (
  request: AICompletionRequest,
  providerId: AIProviderId,
  apiKey: string,
  model: string
): Promise<AIToolCompletionResult> => {
  const baseUrl = openAiBaseUrl(providerId);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (providerId === 'openrouter') headers['X-Title'] = 'Brahma';

  const makeBody = (withTools: boolean): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.4,
      max_tokens: request.maxTokens ?? 512,
    };
    if (providerId === 'poolside') body.chat_template_kwargs = { enable_thinking: false };
    if (withTools && request.tools?.length) {
      body.tools = request.tools;
      body.tool_choice = request.toolChoice || 'auto';
    }
    return body;
  };

  const post = async (body: Record<string, unknown>) => {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch {
      throw new AIProviderError(
        providerId,
        'network',
        `${AI_PROVIDERS[providerId].label} could not be reached. Check your connection.`
      );
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return { ok: false as const, response, detail };
    }
    const data = await response.json().catch(() => null);
    return { ok: true as const, response, data };
  };

  let outcome = await post(makeBody(Boolean(request.tools?.length)));
  if (
    !outcome.ok &&
    request.tools?.length &&
    [400, 404, 422].includes(outcome.response.status)
  ) {
    outcome = await post(makeBody(false));
  }

  if (!outcome.ok) {
    let message = outcome.detail;
    try {
      const parsed = JSON.parse(outcome.detail);
      message = parsed?.error?.message || parsed?.message || outcome.detail;
    } catch {}
    const kind = classifyStatus(outcome.response.status, String(message));
    throw new AIProviderError(
      providerId,
      kind,
      errorText(outcome.response.status, providerId, String(message || outcome.response.statusText)),
      outcome.response.status
    );
  }

  const data = outcome.data;
  const text = extractOpenAiContent(data);
  const rawCalls = data?.choices?.[0]?.message?.tool_calls;
  const toolCalls: AIToolCall[] = Array.isArray(rawCalls)
    ? rawCalls
        .map((call: any) => {
          const name = call?.function?.name || call?.name;
          if (!name) return null;
          return {
            id: typeof call?.id === 'string' ? call.id : undefined,
            name: String(name),
            arguments: normalizeToolArguments(call?.function?.arguments ?? call?.arguments),
          };
        })
        .filter((call: AIToolCall | null): call is AIToolCall => Boolean(call))
    : parseContentToolCalls(text);

  if (!toolCalls.length && !text) {
    throw new AIProviderError(providerId, 'unknown', 'The provider returned an empty response.');
  }
  return { text, toolCalls, providerId, model };
};

const completeWithProvider = async (
  request: AICompletionRequest,
  providerId: AIProviderId,
  apiKey: string,
  model: string
): Promise<string> => {
  if (AI_PROVIDERS[providerId].kind === 'gemini') {
    return completeGemini(request, providerId, apiKey, model);
  }
  return completeOpenAiCompatible(request, providerId, apiKey, model);
};

export const completeWithFallback = async (
  request: AICompletionRequest,
  options: AICompletionOptions = {}
): Promise<AICompletionResult> => {
  const order = options.order ?? getProviderOrder();
  const exclude = new Set(options.exclude ?? []);
  const errors: AIProviderError[] = [];
  let attempted = 0;

  for (const providerId of order) {
    if (exclude.has(providerId)) continue;
    const apiKey = (options.keys?.[providerId] ?? getProviderApiKey(providerId)).trim();
    if (!apiKey) continue;
    attempted += 1;
    const models = getProviderModels(providerId, options.modelOverrides?.[providerId]);

    for (const model of models) {
      options.onAttempt?.(providerId, model);
      try {
        const text = await completeWithProvider(request, providerId, apiKey, model);
        return { text, providerId, model };
      } catch (err) {
        const providerError = err instanceof AIProviderError
          ? err
          : new AIProviderError(providerId, 'unknown', String((err as any)?.message || 'Provider failed.'));
        errors.push(providerError);
        if (providerError.kind === 'quota' || providerError.kind === 'model_unavailable') {
          continue;
        }
        break;
      }
    }
  }

  if (attempted === 0) {
    throw new AIProviderError(
      'gemini',
      'missing_key',
      'No AI provider key is configured. Add a key in Settings to start.'
    );
  }

  const last = errors[errors.length - 1];
  throw new AIProviderError(
    last?.providerId ?? order[0],
    last?.kind ?? 'unknown',
    last?.message || 'All configured AI providers failed.'
  );
};

export const completeWithToolsWithFallback = async (
  request: AICompletionRequest,
  options: AICompletionOptions = {}
): Promise<AIToolCompletionResult> => {
  const order = (options.order ?? getProviderOrder()).filter(
    (providerId) => AI_PROVIDERS[providerId].kind === 'openai'
  );
  const exclude = new Set(options.exclude ?? []);
  const errors: AIProviderError[] = [];
  let attempted = 0;

  for (const providerId of order) {
    if (exclude.has(providerId)) continue;
    const apiKey = (options.keys?.[providerId] ?? getProviderApiKey(providerId)).trim();
    if (!apiKey) continue;
    attempted += 1;
    const models = getProviderModels(providerId, options.modelOverrides?.[providerId]);

    for (const model of models) {
      options.onAttempt?.(providerId, model);
      try {
        return await completeOpenAiToolsCompatible(request, providerId, apiKey, model);
      } catch (err) {
        const providerError = err instanceof AIProviderError
          ? err
          : new AIProviderError(providerId, 'unknown', String((err as any)?.message || 'Provider failed.'));
        errors.push(providerError);
        if (providerError.kind === 'quota' || providerError.kind === 'model_unavailable') {
          continue;
        }
        break;
      }
    }
  }

  if (attempted === 0) {
    throw new AIProviderError(
      'poolside',
      'missing_key',
      'No OpenAI-compatible provider key is configured for browser tools. Add a Poolside, Ollama Cloud, or OpenRouter key in Settings.'
    );
  }

  const last = errors[errors.length - 1];
  throw new AIProviderError(
    last?.providerId ?? order[0] ?? 'poolside',
    last?.kind ?? 'unknown',
    last?.message || 'All tool-capable AI providers failed.'
  );
};
export const testProvider = async (
  providerId: AIProviderId,
  apiKey: string,
  model?: string
): Promise<AICompletionResult> => {
  const key = apiKey.trim();
  if (!key) {
    throw new AIProviderError(providerId, 'missing_key', `Add a ${AI_PROVIDERS[providerId].label} API key first.`);
  }
  const selectedModel = model || getProviderModel(providerId);
  const text = await completeWithProvider(
    {
      messages: [
        { role: 'system', content: 'You are a health check. Reply with exactly: OK' },
        { role: 'user', content: 'health check' },
      ],
      temperature: 0,
      maxTokens: 16,
    },
    providerId,
    key,
    selectedModel
  );
  return { text, providerId, model: selectedModel };
};
