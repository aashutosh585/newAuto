import axios from 'axios';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  alias?: 'fast' | 'writer' | 'writer-local';
  messages: ChatMessage[];
  jsonMode?: boolean;
  temperature?: number;
  runId?: string; // pass to log against a run in MongoDB
}

export interface CompletionResult<T = any> {
  text: string;
  data?: T;
  model: string;
  totalTokens: number;
  latencyMs: number;
}

/**
 * Extracts and cleans JSON from AI model outputs, stripping reasoning tokens (<think>...</think>)
 * and markdown code fences.
 */
function extractJson<T = any>(rawText: string): T | undefined {
  if (!rawText) return undefined;

  // 1. Strip reasoning blocks like <think>...</think>
  let cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Direct JSON parse attempt
  try {
    return JSON.parse(cleaned);
  } catch {}

  // 3. Extract from ```json ... ``` markdown block
  const markdownMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (markdownMatch && markdownMatch[1]) {
    try {
      return JSON.parse(markdownMatch[1].trim());
    } catch {}
  }

  // 4. Find first { ... } or [ ... ]
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    } catch {}
  }

  return undefined;
}

/**
 * Strips reasoning tokens from general text output
 */
function cleanModelOutput(text: string): string {
  if (!text) return '';
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

async function saveLlmLog(opts: {
  runId?: string;
  alias: string;
  prompt: string;
  response?: string;
  totalTokens?: number;
  latencyMs?: number;
  success: boolean;
  errorMessage?: string;
  provider?: string;
}) {
  try {
    const { default: connectToDatabase } = await import('./mongodb');
    const { default: LlmCall } = await import('../models/LlmCall');
    await connectToDatabase();
    const estimatedCostUsd = ((opts.totalTokens || 0) / 1_000_000) * 0.15;
    await LlmCall.create({
      runId: opts.runId,
      alias: opts.alias ? `${opts.alias} [${opts.provider || 'unknown'}]` : opts.provider,
      prompt: opts.prompt.slice(0, 4000),
      response: opts.response?.slice(0, 4000),
      totalTokens: opts.totalTokens,
      estimatedCostUsd,
      latencyMs: opts.latencyMs,
      success: opts.success,
      errorMessage: opts.errorMessage,
    });
  } catch {
    // Logging failure should never crash the caller
  }
}

export async function executeLLM<T = any>(options: CompletionOptions): Promise<CompletionResult<T>> {
  const { alias = 'fast', messages, jsonMode = false, temperature = 0.2, runId } = options;
  const promptText = messages.map((m) => `[${m.role}]: ${m.content}`).join('\n\n');
  const t0 = Date.now();

  const errors: string[] = [];

  // =========================================================================
  // 1. LiteLLM Gateway (if self-hosted)
  // =========================================================================
  const liteLLMBase = process.env.LITELLM_BASE_URL;
  const liteLLMKey = process.env.LITELLM_VIRTUAL_KEY || process.env.LITELLM_API_KEY;
  if (liteLLMBase) {
    try {
      const payload: Record<string, any> = { model: alias, messages, temperature };
      if (jsonMode) payload.response_format = { type: 'json_object' };

      const res = await axios.post(`${liteLLMBase.replace(/\/+$/, '')}/v1/chat/completions`, payload, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${liteLLMKey || 'default'}` },
        timeout: 25000,
      });

      const rawText = cleanModelOutput(res.data?.choices?.[0]?.message?.content || '');
      const data = jsonMode ? extractJson<T>(rawText) : undefined;
      const latencyMs = Date.now() - t0;
      const totalTokens = res.data?.usage?.total_tokens || 0;

      await saveLlmLog({ runId, alias, prompt: promptText, response: rawText, totalTokens, latencyMs, success: true, provider: 'litellm' });
      return { text: rawText, data, model: res.data?.model || alias, totalTokens, latencyMs };
    } catch (err: any) {
      errors.push(`LiteLLM: ${err.message}`);
    }
  }

  // =========================================================================
  // 2. Direct Gemini (Google 2.0 Flash - Fast & High Quota)
  // =========================================================================
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const systemInstruction = messages.find((m) => m.role === 'system')?.content;
      const userPrompt = messages.filter((m) => m.role !== 'system').map((m) => m.content).join('\n\n');

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
      const geminiBody: Record<string, any> = {
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature },
      };
      if (systemInstruction) geminiBody.systemInstruction = { parts: [{ text: systemInstruction }] };
      if (jsonMode) geminiBody.generationConfig.responseMimeType = 'application/json';

      const res = await axios.post(geminiUrl, geminiBody, { timeout: 25000 });
      const rawText = cleanModelOutput(res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '');
      const data = jsonMode ? extractJson<T>(rawText) : undefined;
      const latencyMs = Date.now() - t0;
      const totalTokens = res.data?.usageMetadata?.totalTokenCount || 0;

      await saveLlmLog({ runId, alias, prompt: promptText, response: rawText, totalTokens, latencyMs, success: true, provider: 'gemini' });
      return { text: rawText, data, model: 'gemini-2.0-flash', totalTokens, latencyMs };
    } catch (gErr: any) {
      errors.push(`Gemini: ${gErr.response?.data?.error?.message || gErr.message}`);
    }
  }

  // =========================================================================
  // 3. IteraCompute (Free Qwen 27B - is_free: true, 262k context window)
  // =========================================================================
  const iteraKey = process.env.ITERACOMPUTE_API_KEY;
  if (iteraKey) {
    try {
      const iteraModel = process.env.ITERACOMPUTE_MODEL || 'qwen/qwen3.8-27b';
      const payload: Record<string, any> = {
        model: iteraModel,
        messages,
        temperature,
        max_tokens: 1024,
        chat_template_kwargs: { enable_thinking: false },
      };
      if (jsonMode) {
        payload.response_format = { type: 'json_object' };
      }

      const res = await axios.post('https://api.iteracompute.com/v1/chat/completions', payload, {
        headers: {
          Authorization: `Bearer ${iteraKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 45000,
      });

      const choice = res.data?.choices?.[0];
      const rawText = cleanModelOutput(choice?.message?.content || choice?.message?.reasoning || '');
      const data = jsonMode ? extractJson<T>(rawText) : undefined;
      const latencyMs = Date.now() - t0;
      const totalTokens = res.data?.usage?.total_tokens || 0;

      if (rawText) {
        await saveLlmLog({ runId, alias, prompt: promptText, response: rawText, totalTokens, latencyMs, success: true, provider: `iteracompute:${iteraModel}` });
        return { text: rawText, data, model: iteraModel, totalTokens, latencyMs };
      }
    } catch (iErr: any) {
      errors.push(`IteraCompute: ${iErr.response?.data?.error?.message || iErr.message}`);
    }
  }

  // =========================================================================
  // 4. OpenRouter Multi-Model Free Fallback
  // Models: Nemotron 3.5 Lightning (1M context), XingChen 29B, Dots3, Gemma 4
  // =========================================================================
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    const freeOpenRouterModels = [
      'dots-studio/dots-3-note-preview:free',
      'nvidia/nemotron-3.5-lightning:free',
      'xingchen-agi/xing4.0-29b-a4b:free',
      'google/gemma-4-31b-it:free',
    ];

    for (const modelId of freeOpenRouterModels) {
      try {
        const payload: Record<string, any> = {
          model: modelId,
          messages,
          temperature,
          max_tokens: 1500,
        };
        if (jsonMode) {
          payload.response_format = { type: 'json_object' };
        }

        const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', payload, {
          headers: {
            Authorization: `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://dinomate.app',
            'X-Title': process.env.OPENROUTER_SITE_NAME || 'DinoMate Social Engine',
          },
          timeout: 25000,
        });

        const choice = res.data?.choices?.[0];
        const rawText = cleanModelOutput(choice?.message?.content || choice?.message?.reasoning || '');
        const data = jsonMode ? extractJson<T>(rawText) : undefined;
        const latencyMs = Date.now() - t0;
        const totalTokens = res.data?.usage?.total_tokens || 0;

        if (rawText) {
          await saveLlmLog({ runId, alias, prompt: promptText, response: rawText, totalTokens, latencyMs, success: true, provider: `openrouter:${modelId}` });
          return { text: rawText, data, model: modelId, totalTokens, latencyMs };
        }
      } catch (orErr: any) {
        errors.push(`OpenRouter (${modelId}): ${orErr.response?.data?.error?.message || orErr.message}`);
      }
    }
  }

  // =========================================================================
  // 5. Groq Fallback (Llama 3.3 70B / Llama 3.1 8B)
  // =========================================================================
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const groqModel = alias === 'writer' ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant';
      const payload: Record<string, any> = { model: groqModel, messages, temperature };
      if (jsonMode) payload.response_format = { type: 'json_object' };

      const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', payload, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
        timeout: 25000,
      });

      const rawText = cleanModelOutput(res.data?.choices?.[0]?.message?.content || '');
      const data = jsonMode ? extractJson<T>(rawText) : undefined;
      const latencyMs = Date.now() - t0;
      const totalTokens = res.data?.usage?.total_tokens || 0;

      await saveLlmLog({ runId, alias, prompt: promptText, response: rawText, totalTokens, latencyMs, success: true, provider: `groq:${groqModel}` });
      return { text: rawText, data, model: groqModel, totalTokens, latencyMs };
    } catch (groqErr: any) {
      errors.push(`Groq: ${groqErr.response?.data?.error?.message || groqErr.message}`);
    }
  }

  const latencyMs = Date.now() - t0;
  const errMsg = `All AI providers failed:\n${errors.join('\n')}`;
  await saveLlmLog({ runId, alias, prompt: promptText, latencyMs, success: false, errorMessage: errMsg, provider: 'none' });
  throw new Error(errMsg);
}
