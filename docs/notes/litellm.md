# LiteLLM Gateway Notes

## Repository
- **Upstream**: [BerriAI/litellm](https://github.com/BerriAI/litellm)
- **Role**: Unified OpenAI-compatible proxy gateway for all LLM calls.

## Key Decisions & Implementation
1. **Zero Secret Leakage**:
   - The application worker and web services **never receive or store** Gemini, Groq, or OpenRouter keys.
   - All upstream provider keys live solely inside the `litellm` Docker container environment.
   - The app talks to `http://litellm:4000/v1` with a virtual key (`LITELLM_VIRTUAL_KEY`).

2. **Aliases Defined**:
   - `fast`: Gemini 2.5 Flash -> Groq Llama 3.1 8B -> OpenRouter free -> local Ollama.
     - Used for: JSON parsing, classification, eligibility scoring, ATS filtering.
   - `writer`: Groq Llama 3.3 70B -> Gemini 2.5 Flash -> OpenRouter -> local Ollama.
     - Used for: caption drafting, hooks, viral copy generation.
   - `writer-local`: Local Ollama Llama 3.2 on host machine (`http://host.docker.internal:11434`).
     - Used for: offline emergency fallback.

3. **Database Logging**:
   - Every single completion call records:
     - `alias`, `model`, `promptTokens`, `completionTokens`, `totalTokens`, `costUsd`, `latencyMs`.
     - `promptPreview` and `responsePreview` are automatically scrubbed by `redactSensitive()`.
