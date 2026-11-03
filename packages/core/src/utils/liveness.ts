import axios from 'axios';

export interface LivenessResult {
  isLive: boolean;
  statusCode?: number;
  finalUrl?: string;
  error?: string;
  latencyMs: number;
}

export async function checkUrlLiveness(url: string, timeoutMs = 8000): Promise<LivenessResult> {
  const start = Date.now();
  try {
    // Attempt HEAD request first to save bandwidth
    const headResponse = await axios.head(url, {
      timeout: timeoutMs,
      maxRedirects: 5,
      validateStatus: (status) => status < 400,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    return {
      isLive: true,
      statusCode: headResponse.status,
      finalUrl: headResponse.request?.res?.responseUrl || url,
      latencyMs: Date.now() - start,
    };
  } catch (headError) {
    // Some ATS sites block HEAD requests (e.g., 405 Method Not Allowed), retry with GET
    try {
      const getResponse = await axios.get(url, {
        timeout: timeoutMs,
        maxRedirects: 5,
        validateStatus: (status) => status < 400,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      return {
        isLive: true,
        statusCode: getResponse.status,
        finalUrl: getResponse.request?.res?.responseUrl || url,
        latencyMs: Date.now() - start,
      };
    } catch (getError) {
      return {
        isLive: false,
        statusCode: (getError as any)?.response?.status,
        error: getError instanceof Error ? getError.message : 'Unknown network failure',
        latencyMs: Date.now() - start,
      };
    }
  }
}

