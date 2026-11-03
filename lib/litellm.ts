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
}

export interface CompletionResult<T = any> {
  text: string;
  data?: T;
  model: string;
  totalTokens: number;
}

export async function executeLLM<T = any>(options: CompletionOptions): Promise<CompletionResult<T>> {
  const { alias = 'fast', messages, jsonMode = false, temperature = 0.2 } = options;

  const liteLLMBase = process.env.LITELLM_BASE_URL;
  const liteLLMKey = process.env.LITELLM_VIRTUAL_KEY || process.env.LITELLM_API_KEY;

  // 1. Try LiteLLM Gateway if configured
  if (liteLLMBase) {
    try {
      const payload: Record<string, any> = {
        model: alias,
        messages,
        temperature,
      };

      if (jsonMode) {
        payload.response_format = { type: 'json_object' };
      }

      const res = await axios.post(`${liteLLMBase.replace(/\/+$/, '')}/v1/chat/completions`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${liteLLMKey || 'default'}`,
        },
        timeout: 30000,
      });

      const rawText = res.data?.choices?.[0]?.message?.content || '';
      let data: T | undefined;
      if (jsonMode) {
        try {
          data = JSON.parse(rawText);
        } catch {
          const match = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match && match[1]) {
            data = JSON.parse(match[1]);
          }
        }
      }

      return {
        text: rawText,
        data,
        model: res.data?.model || alias,
        totalTokens: res.data?.usage?.total_tokens || 0,
      };
    } catch (err: any) {
      console.warn(`[LiteLLM] Gateway request failed (${err.message}), falling back to direct provider API.`);
    }
  }

  // 2. Direct Gemini Fallback (Ideal for Vercel serverless)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const systemInstruction = messages.find((m) => m.role === 'system')?.content;
      const userPrompt = messages.filter((m) => m.role !== 'system').map((m) => m.content).join('\n\n');

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
      const geminiBody: Record<string, any> = {
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature,
        },
      };

      if (systemInstruction) {
        geminiBody.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

      if (jsonMode) {
        geminiBody.generationConfig.responseMimeType = 'application/json';
      }

      const res = await axios.post(geminiUrl, geminiBody, { timeout: 30000 });
      const rawText = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      let data: T | undefined;
      if (jsonMode) {
        try {
          data = JSON.parse(rawText);
        } catch {
          const match = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match && match[1]) {
            data = JSON.parse(match[1]);
          }
        }
      }

      return {
        text: rawText,
        data,
        model: 'gemini-2.0-flash',
        totalTokens: res.data?.usageMetadata?.totalTokenCount || 0,
      };
    } catch (gErr: any) {
      console.warn(`[Gemini] Direct call failed: ${gErr.message}`);
    }
  }

  // 3. Direct Groq Fallback
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const groqModel = alias === 'writer' ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant';
      const payload: Record<string, any> = {
        model: groqModel,
        messages,
        temperature,
      };
      if (jsonMode) {
        payload.response_format = { type: 'json_object' };
      }

      const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`,
        },
        timeout: 30000,
      });

      const rawText = res.data?.choices?.[0]?.message?.content || '';
      let data: T | undefined;
      if (jsonMode) {
        try {
          data = JSON.parse(rawText);
        } catch {
          const match = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match && match[1]) {
            data = JSON.parse(match[1]);
          }
        }
      }

      return {
        text: rawText,
        data,
        model: groqModel,
        totalTokens: res.data?.usage?.total_tokens || 0,
      };
    } catch (groqErr: any) {
      console.warn(`[Groq] Direct call failed: ${groqErr.message}`);
    }
  }

  throw new Error('All LLM endpoints (LiteLLM, Gemini, Groq) failed or are missing API keys.');
}

