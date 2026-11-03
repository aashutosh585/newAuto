/**
 * Utility to scrub sensitive secrets, API keys, and passwords
 * from logs, prompts, and database records.
 */

const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{20,}/g, // OpenAI/LiteLLM standard key shape
  /AIzaSy[a-zA-Z0-9_-]{33}/g, // Google Gemini key shape
  /gsk_[a-zA-Z0-9]{20,}/g, // Groq key shape
  /bot\d+:[A-Za-z0-9_-]{35}/g, // Telegram bot token
  /(password|secret|token|api[_-]?key)["']?\s*[:=]\s*["']?([^"',\s]+)/gi,
  /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi,
];

export function redactSensitive(text: string): string {
  if (!text) return text;
  let result = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, (match) => {
      if (match.toLowerCase().startsWith('bearer ')) {
        return 'Bearer [REDACTED_TOKEN]';
      }
      if (match.includes(':') || match.includes('=')) {
        const parts = match.split(/[:=]/);
        return `${parts[0]}: "[REDACTED]"`;
      }
      return '[REDACTED_SECRET]';
    });
  }
  return result;
}

export function redactObject<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  const jsonStr = JSON.stringify(obj);
  const redactedStr = redactSensitive(jsonStr);
  return JSON.parse(redactedStr);
}
