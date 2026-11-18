'use strict';

/**
 * ProjectVault Modüler AI Sağlayıcı Adaptörü ve Otomatik Yedekleme (Failover)
 *
 * Desteklenen ücretsiz / modüler sağlayıcılar:
 * - Groq (GROQ_API_KEY)
 * - Google Gemini (GEMINI_API_KEY)
 * - OpenRouter (OPENROUTER_API_KEY)
 * - Mistral AI (MISTRAL_API_KEY)
 * - Cerebras (CEREBRAS_API_KEY)
 * - Genel OpenAI uyumlu endpoint (AI_API_KEY + AI_BASE_URL)
 *
 * Birincil sağlayıcı kota/hız sınırına (429) veya sunucu hatasına takıldığında
 * sistem durmadan otomatik olarak sıradaki yapılandırılmış sağlayıcıya geçer.
 */

function cleanEnv(name) {
  return (process.env[name] || '').trim();
}

function buildProviderCatalog() {
  const explicitProvider = cleanEnv('AI_PROVIDER').toLowerCase();
  const explicitModel = cleanEnv('AI_MODEL');
  const explicitBaseUrl = cleanEnv('AI_BASE_URL').replace(/\/+$/, '');

  const groqKey = cleanEnv('GROQ_API_KEY');
  const geminiKey = cleanEnv('GEMINI_API_KEY');
  const openrouterKey = cleanEnv('OPENROUTER_API_KEY');
  const mistralKey = cleanEnv('MISTRAL_API_KEY');
  const cerebrasKey = cleanEnv('CEREBRAS_API_KEY');
  const genericKey = cleanEnv('AI_API_KEY');

  const candidates = [];

  const addIfConfigured = (entry) => {
    if (entry.apiKey) {
      candidates.push({ ...entry, configured: true });
    }
  };

  addIfConfigured({
    provider: 'groq',
    apiKey: groqKey || (genericKey.startsWith('gsk_') ? genericKey : ''),
    baseUrl: (explicitProvider === 'groq' && explicitBaseUrl) || 'https://api.groq.com/openai/v1',
    model: cleanEnv('GROQ_MODEL') || (explicitProvider === 'groq' && explicitModel) || 'openai/gpt-oss-120b'
  });

  addIfConfigured({
    provider: 'gemini',
    apiKey: geminiKey,
    model: cleanEnv('GEMINI_MODEL') || (explicitProvider === 'gemini' && explicitModel) || 'gemini-2.0-flash'
  });

  addIfConfigured({
    provider: 'openrouter',
    apiKey: openrouterKey,
    baseUrl: (explicitProvider === 'openrouter' && explicitBaseUrl) || 'https://openrouter.ai/api/v1',
    model: cleanEnv('OPENROUTER_MODEL') || (explicitProvider === 'openrouter' && explicitModel) || 'openrouter/free',
    extraHeaders: {
      'HTTP-Referer': cleanEnv('APP_URL') || 'https://projectvault.app',
      'X-Title': 'ProjectVault'
    }
  });

  addIfConfigured({
    provider: 'mistral',
    apiKey: mistralKey,
    baseUrl: (explicitProvider === 'mistral' && explicitBaseUrl) || 'https://api.mistral.ai/v1',
    model: cleanEnv('MISTRAL_MODEL') || (explicitProvider === 'mistral' && explicitModel) || 'mistral-small-latest'
  });

  addIfConfigured({
    provider: 'cerebras',
    apiKey: cerebrasKey,
    baseUrl: (explicitProvider === 'cerebras' && explicitBaseUrl) || 'https://api.cerebras.ai/v1',
    model: cleanEnv('CEREBRAS_MODEL') || (explicitProvider === 'cerebras' && explicitModel) || 'llama-3.3-70b'
  });

  if (genericKey && !genericKey.startsWith('gsk_')) {
    const customName =
      explicitProvider && !['groq', 'gemini', 'openrouter', 'mistral', 'cerebras'].includes(explicitProvider)
        ? explicitProvider
        : 'openai_compatible';
    addIfConfigured({
      provider: customName,
      apiKey: genericKey,
      baseUrl: explicitBaseUrl || 'https://api.openai.com/v1',
      model: explicitModel || 'gpt-4o-mini'
    });
  }

  if (explicitProvider) {
    const idx = candidates.findIndex((c) => c.provider === explicitProvider);
    if (idx > 0) {
      const [preferred] = candidates.splice(idx, 1);
      candidates.unshift(preferred);
    }
  }

  return candidates;
}

function getConfiguredProviders() {
  return buildProviderCatalog();
}

function getAiConfig() {
  const providers = getConfiguredProviders();
  if (providers.length > 0) {
    return {
      ...providers[0],
      availableProviders: providers.map((p) => p.provider)
    };
  }

  return {
    provider: cleanEnv('AI_PROVIDER').toLowerCase() || 'groq',
    model: cleanEnv('AI_MODEL') || 'openai/gpt-oss-120b',
    apiKey: '',
    baseUrl: cleanEnv('AI_BASE_URL').replace(/\/+$/, '') || 'https://api.groq.com/openai/v1',
    configured: false,
    availableProviders: []
  };
}

async function parseJsonSafe(res) {
  const raw = await res.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { error: { message: raw.slice(0, 300) } };
  }
}

async function callSingleProvider(cfg, { systemPrompt, messages, inlineParts = [], temperature = 0.2 }) {
  if (cfg.provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;

    const contents = messages.map((m, idx) => {
      const parts = [{ text: m.content }];
      if (idx === messages.length - 1 && inlineParts.length) {
        inlineParts.forEach((p) => parts.push(p));
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts
      };
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: 2048
        }
      })
    });

    const data = await parseJsonSafe(res);
    if (!res.ok) {
      const msg = data?.error?.message || `Gemini API hatası (${res.status})`;
      const err = new Error(msg);
      err.statusCode = res.status >= 500 ? 502 : res.status;
      throw err;
    }

    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n') || '';
    if (!text) {
      throw new Error('Gemini modelinden boş yanıt döndü.');
    }

    return {
      content: text,
      provider: cfg.provider,
      model: cfg.model
    };
  }

  // OpenAI Uyumlu Modüler Sağlayıcı (Groq / OpenRouter / Mistral / Cerebras / Ollama / Custom)
  const endpoint = `${cfg.baseUrl}/chat/completions`;
  const payloadMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }))
  ];

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cfg.apiKey}`,
    ...(cfg.extraHeaders || {})
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: cfg.model,
      messages: payloadMessages,
      temperature
    })
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) {
    const msg = data?.error?.message || `${cfg.provider} API hatası (${res.status})`;
    const err = new Error(msg);
    err.statusCode = res.status >= 500 ? 502 : res.status;
    throw err;
  }

  let text = data?.choices?.[0]?.message?.content || '';
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (!text) {
    throw new Error(`${cfg.provider} sağlayıcısından boş yanıt döndü.`);
  }

  return {
    content: text,
    provider: cfg.provider,
    model: cfg.model
  };
}

async function generateAiCompletion({ systemPrompt, messages, inlineParts = [], temperature = 0.2 }) {
  const providers = getConfiguredProviders();

  if (providers.length === 0) {
    const err = new Error(
      'AI servisi henüz yapılandırılmamış. Lütfen GROQ_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, MISTRAL_API_KEY veya CEREBRAS_API_KEY ortam değişkenlerinden en az birini tanımlayın.'
    );
    err.statusCode = 503;
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }

  const errors = [];
  const attemptedProviders = [];

  for (let i = 0; i < providers.length; i++) {
    const cfg = providers[i];
    attemptedProviders.push(cfg.provider);
    try {
      const result = await callSingleProvider(cfg, {
        systemPrompt,
        messages,
        inlineParts,
        temperature
      });
      return {
        ...result,
        fallbackUsed: i > 0,
        attemptedProviders
      };
    } catch (err) {
      const reason = err?.message || 'Bilinmeyen hata';
      errors.push(`${cfg.provider}: ${reason}`);
      console.warn(`[AI Failover] ${cfg.provider} (${cfg.model}) başarısız: ${reason}`);
    }
  }

  const finalError = new Error(
    providers.length > 1
      ? `Tüm AI sağlayıcıları başarısız oldu (${errors.join(' | ')})`
      : errors[0] || 'AI isteği başarısız oldu.'
  );
  finalError.statusCode = 502;
  throw finalError;
}

module.exports = {
  getAiConfig,
  getConfiguredProviders,
  generateAiCompletion
};
