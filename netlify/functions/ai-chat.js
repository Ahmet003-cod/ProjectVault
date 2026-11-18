'use strict';

const { jsonResponse, authenticateRequest, fetchUserContextData } = require('./lib/supabase-auth');
const { getAiConfig, generateAiCompletion } = require('./lib/ai-provider');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(204, {});
  }

  // Frontend'in yalnızca public (anon) yapılandırmayı güvenli şekilde alması
  if (event.httpMethod === 'GET' && event.queryStringParameters?.action === 'public-config') {
    const aiCfg = getAiConfig();
    return jsonResponse(200, {
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
      aiProvider: aiCfg.provider,
      aiConfigured: aiCfg.configured
    });
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'METHOD_NOT_ALLOWED', message: 'Yalnızca POST desteklenir.' });
  }

  try {
    const { user, supabase } = await authenticateRequest(event, { allowUnconfiguredPreview: true });
    const body = JSON.parse(event.body || '{}');
    const message = String(body.message || '').trim();
    const projectId = body.projectId || null;
    let conversationId = body.conversationId || null;

    if (!message || message.length > 4000) {
      return jsonResponse(400, { error: 'INVALID_INPUT', message: 'Mesaj 1 ile 4000 karakter arasında olmalıdır.' });
    }

    // Kullanıcının yalnızca yetkili olduğu verileri getir (RLS korumalı)
    const ctx = await fetchUserContextData(supabase, user?.id, projectId);

    // Sohbet geçmişini yükle
    let history = [];
    if (supabase && user && conversationId) {
      const { data: conv } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (conv) {
        const { data: prevMsgs } = await supabase
          .from('ai_messages')
          .select('role,content')
          .eq('conversation_id', conversationId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(10);
        history = (prevMsgs || []).filter((m) => m.role === 'user' || m.role === 'assistant');
      } else {
        conversationId = null;
      }
    }

    const systemPrompt = [
      'Sen ProjectVault AI asistanısın. Kullanıcının kişisel proje yönetimi, teknik notları ve proje hafızası üzerinden Türkçe yardımcı olursun.',
      'KESİN KURALLAR:',
      '1. Yalnızca aşağıda JSON formatında verilen kullanıcının gerçek veritabanı kayıtlarını kullan.',
      '2. Kayıtlarda bulunmayan tarih, teknoloji, sorun veya sonucu ASLA tahmin etme ya da uydurma.',
      '3. Bir bilgi kayıtlarda yoksa açıkça "Veritabanı kayıtlarında buna dair bilgi bulunamadı." de.',
      '4. Yanıtının sonunda mümkün olduğunda hangi proje adlarına, günlük tarihlerine veya doküman adlarına dayandığını kısaca belirt.',
      '5. Zaman dilimi Europe/Istanbul olarak değerlendir.',
      '6. Yanıtını mobil ve masaüstü ekranda kolay okunacak şekilde düzenle: kısa başlıklar (##) ve madde işaretleri (-) kullan; geniş çok sütunlu Markdown tabloları ve tablo içinde <br> etiketi kullanma.',
      '',
      'KULLANICININ GERÇEK VERİTABANI KAYITLARI:',
      ctx.contextText
    ].join('\n');

    const aiRes = await generateAiCompletion({
      systemPrompt,
      messages: [...history, { role: 'user', content: message }]
    });

    // Sohbeti ve mesajları veritabanına kaydet (Supabase bağlı ise)
    if (supabase && user) {
      if (!conversationId) {
        const { data: newConv, error: cErr } = await supabase
          .from('ai_conversations')
          .insert({
            user_id: user.id,
            project_id: projectId,
            title: message.slice(0, 72),
            provider: aiRes.provider,
            model: aiRes.model
          })
          .select()
          .single();
        if (!cErr && newConv) conversationId = newConv.id;
      } else {
        await supabase
          .from('ai_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId)
          .eq('user_id', user.id);
      }

      if (conversationId) {
        await supabase.from('ai_messages').insert([
          {
            user_id: user.id,
            conversation_id: conversationId,
            role: 'user',
            content: message,
            sources: []
          },
          {
            user_id: user.id,
            conversation_id: conversationId,
            role: 'assistant',
            content: aiRes.content,
            sources: ctx.sources
          }
        ]);
      }
    }

    return jsonResponse(200, {
      conversationId,
      content: aiRes.content,
      sources: ctx.sources,
      provider: aiRes.provider,
      model: aiRes.model
    });
  } catch (err) {
    return jsonResponse(err.statusCode || 500, {
      error: err.code || 'AI_CHAT_ERROR',
      message: err.message || 'AI sohbet işlemi sırasında hata oluştu.'
    });
  }
};
