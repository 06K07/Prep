'use strict';

const { HttpError } = require('../util/errors');

const SYSTEM_PROMPT = [
  'You are a restricted code-review assistant inside a timed C++ backend assessment.',
  'You can only READ the repository; you cannot edit it.',
  'Explain WHY a failing test fails and WHICH file/function/line region to look at.',
  'NEVER write fixed code, diffs, or corrected snippets. At most describe the idea of the fix',
  'in one short sentence. Reply in Hinglish, under 120 words.',
].join(' ');

const MAX_CONTEXT_CHARS = 60000;
const CODE_FENCE = /```[\s\S]*?```/g;

function buildPrompt({ question, files, testOutput }) {
  let context = Object.entries(files)
    .map(([name, content]) => `--- ${name} ---\n${content}`)
    .join('\n');
  if (context.length > MAX_CONTEXT_CHARS) context = context.slice(0, MAX_CONTEXT_CHARS);
  return `Repo:\n${context}\n\nLatest test output:\n${testOutput}\n\nQuestion: ${question}`;
}

/** Hint-only AI helper backed by Gemini or Claude (whichever key is configured). */
class AiService {
  /** @param {{config: ReturnType<import('../config').loadConfig>, logger: any, fetchImpl?: typeof fetch}} deps */
  constructor({ config, logger, fetchImpl = fetch }) {
    this.config = config;
    this.logger = logger;
    this.fetch = fetchImpl;
  }

  get provider() {
    if (this.config.geminiApiKey) return 'gemini';
    if (this.config.anthropicApiKey) return 'anthropic';
    return null;
  }

  async ask(input) {
    const prompt = buildPrompt(input);
    let text;
    if (this.provider === 'gemini') text = await this.#gemini(prompt);
    else if (this.provider === 'anthropic') text = await this.#anthropic(prompt);
    else throw new HttpError(503, 'ai_unavailable', 'AI helper is not configured on this server');
    // Defence in depth: the helper must give hints, not ready-made fixes.
    return text.replace(CODE_FENCE, '[code block removed - hints only]');
  }

  async #post(url, init) {
    let response;
    try {
      response = await this.fetch(url, {
        ...init,
        signal: AbortSignal.timeout(this.config.aiTimeoutMs),
      });
    } catch (err) {
      this.logger.warn('ai request failed', { error: err.message });
      throw new HttpError(502, 'ai_unreachable', 'AI provider did not respond in time');
    }
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      this.logger.warn('ai provider error', { status: response.status, body: json });
      throw new HttpError(
        502,
        'ai_error',
        `AI provider error (${response.status}). Check model name and key.`,
      );
    }
    return json;
  }

  async #gemini(prompt) {
    const { geminiModel, geminiApiKey } = this.config;
    const json = await this.#post(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiApiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 600 },
        }),
      },
    );
    const parts = json.candidates?.[0]?.content?.parts;
    if (!parts) throw new HttpError(502, 'ai_empty', 'AI returned no answer');
    return parts.map((p) => p.text || '').join('');
  }

  async #anthropic(prompt) {
    const json = await this.#post('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.config.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.anthropicModel,
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const text = json.content?.[0]?.text;
    if (!text) throw new HttpError(502, 'ai_empty', 'AI returned no answer');
    return text;
  }
}

module.exports = { AiService, buildPrompt, SYSTEM_PROMPT };
