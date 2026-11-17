'use strict';

/**
 * ProjectVault Modüler AI Sağlayıcı Adaptörü
 * Merkezi yapılandırma sayesinde Gemini, Qwen, Llama, Mistral veya
 * OpenAI uyumlu herhangi bir endpoint arasında kolayca geçiş yapılabilir.
 */

function getAiConfig() {
  const explicitProvider = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  const groqKey = (process.env.GROQ_API_KEY || '').trim();
  const genericKey = (process.env.AI_API_KEY || '').trim();
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();

  let provider = explicitProvider;
  if (!provider) {
    if (groqKey || genericKey.startsWith('gsk_')) provider = 'groq';
    else provider = 'gemini';
  }

  if (provider === 'gemini') {
    const model = (process.env.AI_MODEL || 'gemini-2.0-flash').trim();
    return {
      provider: 'gemini',
      model,
      apiKey: geminiKey,
      configured: Boolean(geminiKey)
    };
  }

  if (provider === 'groq') {
    const apiKey = groqKey || genericKey;
    const baseUrl = (process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1').trim().replace(/\/+$/, '');
    const model = (process.env.AI_MODEL || 'openai/gpt-oss-120b').trim();
    return {
      provider: 'groq',
      model,
      apiKey,
      baseUrl,
      configured: Boolean(apiKey)
    };
  }

  // OpenAI uyumlu diğer sağlayıcılar: qwen, llama, mistral, openrouter, ollama, openai_compatible
  const apiKey = genericKey || groqKey || geminiKey;
  const baseUrl = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
  const model = (process.env.AI_MODEL || 'gpt-4o-mini').trim();
  return {
    provider,
    model,
    apiKey,
    baseUrl,
    configured: Boolean(apiKey)
  };
}

async function generateAiCompletion({ systemPrompt, messages, inlineParts = [], temperature = 0.2 }) {
  const cfg = getAiConfig();

  if (!cfg.configured) {
    const err = new Error(
      'AI servisi henüz yapılandırılmamış. Lütfen GEMINI_API_KEY, GROQ_API_KEY veya AI_API_KEY ortam değişkenini tanımlayın.'
    );
    err.statusCode = 503;
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }

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

    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || `Gemini API hatası (${res.status})`;
      const err = new Error(msg);
      err.statusCode = res.status >= 500 ? 502 : res.status;
      throw err;
    }

    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n') || '';
    if (!text) {
      throw new Error('AI modelinden boş yanıt döndü.');
    }

    return {
      content: text,
      provider: cfg.provider,
      model: cfg.model
    };
  }

  // OpenAI Uyumlu Modüler Sağlayıcı (Qwen / Llama / Mistral / OpenRouter / Ollama)
  const endpoint = `${cfg.baseUrl}/chat/completions`;
  const payloadMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }))
  ];

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: payloadMessages,
      temperature
    })
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || `AI sağlayıcı hatası (${res.status})`;
    const err = new Error(msg);
    err.statusCode = res.status >= 500 ? 502 : res.status;
    throw err;
  }

  let text = data?.choices?.[0]?.message?.content || '';
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (!text) {
    throw new Error('AI sağlayıcısından boş yanıt döndü.');
  }

  return {
    content: text,
    provider: cfg.provider,
    model: cfg.model
  };
}

module.exports = {
  getAiConfig,
  generateAiCompletion
};
