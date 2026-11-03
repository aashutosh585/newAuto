import axios from 'axios';
import { prisma } from '@social-engine/db';
import { LLMAlias } from '../types/index.js';
import { redactSensitive } from '../utils/redact.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  alias: LLMAlias;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  runId?: string;
  stageId?: string;
}

export interface CompletionResult<T = unknown> {
  text: string;
  data?: T;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
}

export class LiteLLMClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || process.env.LITELLM_BASE_URL || 'http://localhost:4000';
    this.apiKey = apiKey || process.env.LITELLM_VIRTUAL_KEY || process.env.LITELLM_API_KEY || 'default-virtual-key';
  }

  async complete<T = unknown>(options: CompletionOptions): Promise<CompletionResult<T>> {
    const { alias, messages, temperature = 0.2, maxTokens = 2048, jsonMode = false, runId, stageId } = options;
    const start = Date.now();

    const payload: Record<string, unknown> = {
      model: alias,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    if (jsonMode) {
      payload.response_format = { type: 'json_object' };
    }

    const promptPreview = messages.map((m) => `[${m.role}] ${m.content}`).join('\n');
    const sanitizedPrompt = redactSensitive(promptPreview.slice(0, 5000));

    try {
      const response = await axios.post(
        `${this.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 45000,
        }
      );

      const latencyMs = Date.now() - start;
      const choice = response.data?.choices?.[0];
      const rawText: string = choice?.message?.content || '';
      const modelUsed: string = response.data?.model || alias;
      const usage = response.data?.usage || {};
      const promptTokens = usage.prompt_tokens || 0;
      const completionTokens = usage.completion_tokens || 0;
      const totalTokens = usage.total_tokens || (promptTokens + completionTokens);
      // LiteLLM sends cost in response headers or usage
      const costUsd = parseFloat(response.headers['x-litellm-response-cost'] || response.data?.response_cost || '0.0');

      let parsedData: T | undefined;
      if (jsonMode) {
        try {
          parsedData = JSON.parse(rawText) as T;
        } catch {
          // If strict parse failed, try extracting JSON enclosed in markdown code fences
          const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            parsedData = JSON.parse(jsonMatch[1]) as T;
          }
        }
      }

      const sanitizedResponse = redactSensitive(rawText.slice(0, 5000));

      // Asynchronously log to DB
      try {
        await prisma.llmCall.create({
          data: {
            runId: runId || null,
            stageId: stageId || null,
            alias,
            model: modelUsed,
            promptTokens,
            completionTokens,
            totalTokens,
            costUsd,
            latencyMs,
            promptPreview: sanitizedPrompt,
            responsePreview: sanitizedResponse,
            status: 'success',
          },
        });
      } catch (dbErr) {
        console.error('[LiteLLMClient] Failed to log LLM call to DB:', dbErr);
      }

      return {
        text: rawText,
        data: parsedData,
        model: modelUsed,
        promptTokens,
        completionTokens,
        totalTokens,
        costUsd,
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const errorMsg = err.response?.data?.error?.message || err.message || 'LLM completion failed';

      try {
        await prisma.llmCall.create({
          data: {
            runId: runId || null,
            stageId: stageId || null,
            alias,
            model: alias,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            costUsd: 0,
            latencyMs,
            promptPreview: sanitizedPrompt,
            status: 'error',
            errorMessage: errorMsg.slice(0, 1000),
          },
        });
      } catch (dbErr) {
        console.error('[LiteLLMClient] Failed to log LLM error to DB:', dbErr);
      }

      throw new Error(`LiteLLM gateway error [${alias}]: ${errorMsg}`);
    }
  }
}

export const llmClient = new LiteLLMClient();
