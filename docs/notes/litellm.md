# 🧠 AI Gateway & Multi-Model Architecture

## Overview
The Social Engine features a resilient, serverless-native AI Gateway located in [`lib/litellm.ts`](../../lib/litellm.ts) designed for zero-cost operation and maximum uptime.

If any provider encounters rate limits (`429`), timeouts, or outages (`503`), the gateway automatically cascades to the next provider in the chain without crashing the pipeline.

---

## ⚡ Fallback Priority Chain

```
1. Google AI Studio (Gemini 2.0 Flash)
     │   • Ultra-fast (~1s latency)
     ▼   • High free-tier quota
2. MoonMath AI (DeepSeek v4.1 Flash & GLM 5.3 Flash)
     │   • 1,048,576 tokens (1M Context Window!)
     │   • 64,000 max output tokens
     ▼   • Native JSON mode & reasoning support
3. IteraCompute (qwen/qwen3.8-27b)
     │   • 100% Free ("is_free": true, $0 cost)
     ▼   • 262k context window, 8,192 max output tokens
4. OpenRouter Free Tier Rotation
     │   • dots-studio/dots-3-note-preview:free (512k context, clean JSON)
     │   • nvidia/nemotron-3.5-lightning:free (1M context, deep reasoning)
     │   • xingchen-agi/xing4.0-29b-a4b:free (262k context)
     ▼   • google/gemma-4-31b-it:free (262k context)
5. Groq Free Cloud (Llama 3.3 70B & 8B)
     │   • Fast inference fallback
     ▼
6. LiteLLM Proxy Gateway (if self-hosted)
```

---

## 🛡️ Key Features

1. **Reasoning Token Filtering**:
   - Advanced reasoning models (like Nemotron) emit `<think>...</think>` internal blocks.
   - The gateway automatically strips internal thoughts using `cleanModelOutput()` so social media captions and JSON payloads remain 100% clean and user-ready.

2. **Strict JSON Parsing**:
   - Robust `extractJson()` helper handles raw JSON, markdown-fenced code blocks (` ```json ... ``` `), and unescaped payloads seamlessly.

3. **MongoDB Audit Trail**:
   - Every single AI call automatically saves an entry to the `LlmCall` collection:
     - `alias`: e.g. `fast [iteracompute:qwen/qwen3.8-27b]`
     - `prompt`: Sanitized prompt text
     - `response`: Clean output text
     - `totalTokens`, `estimatedCostUsd`, `latencyMs`, `success`, `errorMessage`
   - Visible in real-time under the **AI Activity** tab of the dashboard.
