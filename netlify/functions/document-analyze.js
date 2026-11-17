'use strict';

const { jsonResponse, authenticateRequest } = require('./lib/supabase-auth');
const { getAiConfig, generateAiCompletion } = require('./lib/ai-provider');

const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'png', 'jpg', 'jpeg', 'txt', 'md', 'csv'
]);
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'METHOD_NOT_ALLOWED', message: 'Yalnızca POST desteklenir.' });
  }

  try {
    const { user, supabase } = await authenticateRequest(event);
    const body = JSON.parse(event.body || '{}');
    const documentId = body.documentId;

    if (!documentId) {
      return jsonResponse(400, { error: 'INVALID_INPUT', message: 'documentId zorunludur.' });
    }

    const { data: doc, error } = await supabase
      .from('documents')
      .select('*, projects(title)')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (error || !doc) {
      return jsonResponse(404, { error: 'NOT_FOUND', message: 'Doküman bulunamadı veya erişim izniniz yok.' });
    }

    // Sunucu tarafı dosya türü ve boyut doğrulaması
    const ext = String(doc.file_type || doc.file_name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return jsonResponse(400, { error: 'UNSUPPORTED_FILE_TYPE', message: `Desteklenmeyen dosya türü: ${ext}` });
    }
    if (Number(doc.file_size) > MAX_FILE_SIZE) {
      return jsonResponse(400, { error: 'FILE_TOO_LARGE', message: 'Dosya boyutu 25 MB sınırını aşıyor.' });
    }

    let extractedText = doc.extracted_text || '';
    const inlineParts = [];
    const aiCfg = getAiConfig();

    // Metin dosyaları için Storage'dan içerik oku
    if (!extractedText && ['txt', 'md', 'csv'].includes(ext)) {
      const { data: blobData, error: dlErr } = await supabase.storage
        .from(doc.storage_bucket || 'project-documents')
        .download(doc.storage_path);
      if (!dlErr && blobData) {
        extractedText = await blobData.text();
        await supabase
          .from('documents')
          .update({ extracted_text: extractedText.slice(0, 100000) })
          .eq('id', doc.id)
          .eq('user_id', user.id);
      }
    }

    // Gemini için PDF ve görselleri (<= 5MB) doğrudan multimodal analiz et
    if (!extractedText && ['pdf', 'png', 'jpg', 'jpeg'].includes(ext) && Number(doc.file_size) <= 5 * 1024 * 1024 && aiCfg.provider === 'gemini') {
      const { data: blobData, error: dlErr } = await supabase.storage
        .from(doc.storage_bucket || 'project-documents')
        .download(doc.storage_path);
      if (!dlErr && blobData) {
        const buf = Buffer.from(await blobData.arrayBuffer());
        const mime = doc.mime_type || (ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`);
        inlineParts.push({
          inlineData: {
            mimeType: mime,
            data: buf.toString('base64')
          }
        });
      }
    }

    if (!extractedText && !inlineParts.length) {
      return jsonResponse(422, {
        error: 'CONTENT_EXTRACTION_UNAVAILABLE',
        message: `Bu dosya biçimi (${ext.toUpperCase()}) için ham metin çıkarılmamış. Metin tabanlı dosyalar (TXT, MD, CSV), 5 MB altı PDF ve görseller doğrudan analiz edilebilir.`
      });
    }

    const systemPrompt = [
      'Sen ProjectVault AI doküman analistisin. Yanıtlarını Türkçe ver.',
      'Yalnızca verilen doküman içeriğini ve meta bilgilerini kullan; belgede yer almayan bilgileri uydurma.',
      'Çıktıyı şu başlıklarla düzenle:',
      '1. Doküman Özeti',
      '2. Öne Çıkan Teknik Noktalar / Bulgular',
      '3. Proje Açısından Önerilen Aksiyonlar'
    ].join('\n');

    const promptText = [
      `Dosya Adı: ${doc.file_name}`,
      `Tür: ${doc.file_type} | Kategori: ${doc.category}`,
      `İlişkili Proje: ${doc.projects?.title || 'Genel'}`,
      `Kullanıcı Açıklaması: ${doc.description || 'Yok'}`,
      extractedText ? `\nDoküman Metni:\n${extractedText.slice(0, 30000)}` : '\nEkli dosya içeriğini analiz et.'
    ].join('\n');

    const aiRes = await generateAiCompletion({
      systemPrompt,
      messages: [{ role: 'user', content: promptText }],
      inlineParts
    });

    await supabase
      .from('documents')
      .update({ ai_summary: aiRes.content })
      .eq('id', doc.id)
      .eq('user_id', user.id);

    return jsonResponse(200, {
      documentId: doc.id,
      summary: aiRes.content,
      provider: aiRes.provider,
      model: aiRes.model
    });
  } catch (err) {
    return jsonResponse(err.statusCode || 500, {
      error: err.code || 'DOCUMENT_ANALYZE_ERROR',
      message: err.message || 'Doküman analizi sırasında hata oluştu.'
    });
  }
};
