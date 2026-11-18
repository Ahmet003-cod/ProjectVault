'use strict';

const { jsonResponse, authenticateRequest, fetchUserContextData } = require('./lib/supabase-auth');
const { generateAiCompletion } = require('./lib/ai-provider');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'METHOD_NOT_ALLOWED', message: 'Yalnızca POST desteklenir.' });
  }

  try {
    const { user, supabase } = await authenticateRequest(event, { allowUnconfiguredPreview: true });
    const body = JSON.parse(event.body || '{}');
    const mode = String(body.mode || 'project_summary');
    const projectId = body.projectId || null;
    const ideaId = body.ideaId || null;

    if (mode === 'idea_expand') {
      if (!supabase || !user) {
        return jsonResponse(400, { error: 'SUPABASE_REQUIRED', message: 'Fikir analizi için önce Supabase bağlantısını yapılandırın.' });
      }
      if (!ideaId) {
        return jsonResponse(400, { error: 'INVALID_INPUT', message: 'ideaId zorunludur.' });
      }
      const { data: idea, error } = await supabase
        .from('ideas')
        .select('*')
        .eq('id', ideaId)
        .eq('user_id', user.id)
        .single();

      if (error || !idea) {
        return jsonResponse(404, { error: 'NOT_FOUND', message: 'Fikir kaydı bulunamadı.' });
      }

      const systemPrompt = 'Sen kıdemli bir yazılım ve sistem mimarısın. Kullanıcının proje fikrini Türkçe olarak teknik açıdan analiz edip uygulanabilir bir MVP yol haritası sun.';
      const userPrompt = [
        `Fikir Başlığı: ${idea.title}`,
        `Kategori: ${idea.category}`,
        `Öncelik: ${idea.priority} | Zorluk: ${idea.estimated_difficulty}`,
        `Açıklama: ${idea.description || 'Belirtilmemiş'}`,
        `Etiketler: ${(idea.tags || []).join(', ')}`,
        '',
        'Lütfen şu başlıklar altında net öneriler sun:',
        '1. Önerilen Teknoloji Yığını ve Mimari',
        '2. Dikkat Edilmesi Gereken Teknik Riskler',
        '3. İlk 3 Somut MVP Adımı'
      ].join('\n');

      const aiRes = await generateAiCompletion({
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      });

      return jsonResponse(200, {
        content: aiRes.content,
        sources: [`Fikir: ${idea.title}`],
        provider: aiRes.provider,
        model: aiRes.model
      });
    }

    // Proje veya genel dashboard bağlamı
    const ctx = await fetchUserContextData(supabase, user?.id, projectId);

    if (mode === 'project_roadmap') {
      if (!projectId || ctx.counts.projects === 0) {
        return jsonResponse(404, { error: 'NOT_FOUND', message: 'Yol haritası için seçili proje kaydı bulunamadı.' });
      }

      const { data: proj } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', user.id)
        .single();

      const { data: pTasks } = await supabase
        .from('tasks')
        .select('title,status,priority')
        .eq('project_id', projectId)
        .eq('user_id', user.id);

      const roadmapSystemPrompt = [
        'Sen Duolingo mantığında adım adım ilerleyen bir proje koçu ve kıdemli sistem mimarısın.',
        'Kullanıcının projesinin mevcut durumunu, yapılan çalışmaları, tamamlanan görevleri, kullanılacak teknolojileri ve açık sorunları analiz et.',
        'Kullanıcının projenin HANGİ AŞAMASINDAN başlaması gerektiğine ve HANGİ KONULARI sırayla çalışması gerektiğine karar ver.',
        'Eğer kullanıcı projenin ilk kısımlarını zaten tamamlamışsa (ör. work_done_summary veya progress > 0), tamamlanan bölümleri status="completed", kaldığı ve şu an başlaması gereken ilk adımı status="current", sonraki adımları status="locked" olarak işaretle.',
        'Sadece geçerli bir JSON nesnesi döndür; başka açıklama veya markdown metni ekleme.',
        'JSON şeması:',
        '{',
        '  "summary": "Kullanıcının nereden devam etmesi gerektiğini anlatan 2 cümlelik Türkçe özet",',
        '  "steps": [',
        '    {',
        '      "id": "step-1",',
        '      "unit": 1,',
        '      "unit_title": "Ünite Başlığı (örn: 1. Kısım: Temel Kurulum & Sensörler)",',
        '      "title": "Adım Başlığı",',
        '      "icon": "cpu | code-2 | database | shield-check | rocket | flask-conical | layers | sparkles",',
        '      "status": "completed | current | locked",',
        '      "topics": ["Çalışılacak konu 1", "Çalışılacak konu 2"],',
        '      "action_items": ["Somut yapılacak iş 1", "Somut yapılacak iş 2"],',
        '      "ai_tip": "Bu adım için net teknik ipucu"',
        '    }',
        '  ]',
        '}',
        'Toplam 6 ile 8 adım oluştur ve 2 veya 3 üniteye böl. Kesinlikle tam olarak bir tane step status="current" olsun (tüm adımlar bitmemişse).'
      ].join('\n');

      const roadmapUserPrompt = JSON.stringify({
        title: proj.title,
        category: proj.category,
        status: proj.status,
        progress: proj.progress,
        purpose: proj.purpose,
        technologies: proj.technologies,
        work_done_summary: proj.work_done_summary,
        technical_challenges: proj.technical_challenges,
        resolved_issues: proj.resolved_issues,
        unresolved_issues: proj.unresolved_issues,
        last_stage: proj.last_stage,
        next_steps: proj.next_steps,
        tasks: pTasks || []
      }, null, 2);

      const aiRes = await generateAiCompletion({
        systemPrompt: roadmapSystemPrompt,
        messages: [{ role: 'user', content: roadmapUserPrompt }],
        temperature: 0.2
      });

      let parsed = null;
      try {
        const cleaned = aiRes.content
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
          parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
        }
      } catch (_) {
        parsed = null;
      }

      let steps = Array.isArray(parsed?.steps) && parsed.steps.length ? parsed.steps : null;
      if (!steps) {
        const techs = (proj.technologies && proj.technologies.length) ? proj.technologies : ['Temel Mimari', 'Çekirdek Modül'];
        const doneCount = Number(proj.progress) >= 50 ? 2 : (Number(proj.progress) >= 20 ? 1 : 0);
        steps = [
          {
            id: 'step-1',
            unit: 1,
            unit_title: '1. Kısım: Temel Mimari & Altyapı',
            title: 'Proje Kapsamı ve Teknoloji Kurulumu',
            icon: 'layers',
            status: doneCount >= 1 ? 'completed' : 'current',
            topics: [proj.purpose || 'Proje mimarisi', ...techs.slice(0, 2)],
            action_items: ['Geliştirme ortamını hazırla', 'Temel veri modelini kur'],
            ai_tip: 'Her modülü küçük, test edilebilir parçalara bölerek ilerleyin.'
          },
          {
            id: 'step-2',
            unit: 1,
            unit_title: '1. Kısım: Temel Mimari & Altyapı',
            title: `${techs[0] || 'Çekirdek'} Prototipi`,
            icon: 'cpu',
            status: doneCount >= 2 ? 'completed' : (doneCount === 1 ? 'current' : 'locked'),
            topics: techs.slice(0, 3),
            action_items: [proj.work_done_summary || 'İlk çalışan prototipi geliştir'],
            ai_tip: 'Çalışan en sade prototipi çıkarıp erken doğrulama yapın.'
          },
          {
            id: 'step-3',
            unit: 2,
            unit_title: '2. Kısım: Geliştirme & Sorun Çözümü',
            title: proj.last_stage ? 'Kaldığın Yerden Devam Et' : 'Ana Özelliklerin Entegrasyonu',
            icon: 'code-2',
            status: doneCount >= 2 ? 'current' : 'locked',
            topics: [proj.unresolved_issues || 'Entegrasyon testleri', ...techs.slice(1, 3)],
            action_items: [proj.next_steps || 'Açık teknik sorunları gider ve modülleri bağla'],
            ai_tip: proj.last_stage || 'Son kaldığınız aşamayı küçük bir kontrol listesine bölün.'
          },
          {
            id: 'step-4',
            unit: 2,
            unit_title: '2. Kısım: Geliştirme & Sorun Çözümü',
            title: 'Doğrulama, Test ve Yayınlama',
            icon: 'rocket',
            status: 'locked',
            topics: ['Performans testi', 'Güvenlik ve son kontroller'],
            action_items: ['Uçtan uca test senaryolarını çalıştır', 'Sürümü yayınla'],
            ai_tip: 'Sonuçları Proje Günlüğüne kaydederek hafızayı güncel tutun.'
          }
        ];
      }

      // Durum tutarlılığını garantiye al (tam olarak ilk non-completed adım current olsun)
      let foundCurrent = false;
      steps = steps.map((s, idx) => {
        const rawStatus = s.status === 'completed' ? 'completed' : 'pending';
        let finalStatus = rawStatus;
        if (rawStatus !== 'completed') {
          if (!foundCurrent) {
            finalStatus = 'current';
            foundCurrent = true;
          } else {
            finalStatus = 'locked';
          }
        }
        return {
          id: s.id || `step-${idx + 1}`,
          unit: Number(s.unit) || (idx < 3 ? 1 : 2),
          unit_title: s.unit_title || (idx < 3 ? '1. Kısım: Temel Çalışmalar' : '2. Kısım: İleri Geliştirme'),
          title: s.title || `Adım ${idx + 1}`,
          icon: s.icon || 'sparkles',
          status: finalStatus,
          topics: Array.isArray(s.topics) ? s.topics : [],
          action_items: Array.isArray(s.action_items) ? s.action_items : [],
          ai_tip: s.ai_tip || ''
        };
      });

      const completedCount = steps.filter((s) => s.status === 'completed').length;
      const newProgress = Math.round((completedCount / steps.length) * 100);

      await supabase
        .from('projects')
        .update({
          roadmap_steps: steps,
          progress: newProgress,
          last_worked_at: new Date().toISOString()
        })
        .eq('id', projectId)
        .eq('user_id', user.id);

      return jsonResponse(200, {
        summary: parsed?.summary || 'Proje kayıtlarınıza göre AI çalışma rotanız oluşturuldu.',
        roadmap: steps,
        progress: newProgress,
        provider: aiRes.provider,
        model: aiRes.model
      });
    }

    if (['project_reminder', 'project_summary', 'next_steps'].includes(mode) && (!projectId || ctx.counts.projects === 0)) {
      return jsonResponse(404, { error: 'NOT_FOUND', message: 'Seçili proje kaydı bulunamadı.' });
    }

    let promptInstruction = '';
    if (mode === 'project_reminder') {
      promptInstruction = [
        'Kullanıcı bu projeyi aylar sonra yeniden açmış gibi kapsamlı bir hatırlatma brifingi hazırla.',
        'Şu 8 soruyu veritabanındaki GERÇEK kayıtlara dayanarak tek tek yanıtla (veride yoksa "Kayıt bulunamadı" yaz, asla uydurma):',
        '1. Projenin amacı nedir?',
        '2. Proje neden oluşturulmuştu?',
        '3. Hangi teknolojiler kullanılacaktı?',
        '4. Şimdiye kadar neler yapıldı?',
        '5. Son çalışma tarihi nedir?',
        '6. En son nerede kalındı?',
        '7. Hangi sorunlar hâlâ çözülmedi?',
        '8. Bir sonraki mantıklı adım nedir?'
      ].join('\n');
    } else if (mode === 'project_summary') {
      promptInstruction = 'Seçilen projenin amacını, kullanılan teknolojileri, bugüne kadar yapılan çalışmaları, ilerleme durumunu ve öne çıkan teknik notları özetle.';
    } else if (mode === 'next_steps') {
      promptInstruction = 'Seçilen projenin çözülmemiş sorunlarını, bekleyen görevlerini ve son kalındığı aşamayı inceleyerek öncelik sırasına göre en mantıklı sonraki adımları öner.';
    } else if (mode === 'dashboard_insights') {
      promptInstruction = 'Kullanıcının tüm aktif projelerini, uzun süredir güncellenmeyen projelerini, bekleyen/geciken görevlerini ve yaklaşan alarmlarını analiz ederek bu hafta odaklanması gereken en kritik 3-5 aksiyonu öner.';
    } else {
      return jsonResponse(400, { error: 'INVALID_MODE', message: 'Geçersiz AI özet modu.' });
    }

    const systemPrompt = [
      'Sen ProjectVault AI asistanısın. Tüm yanıtları Türkçe ver.',
      'Yalnızca aşağıdaki JSON içindeki gerçek veritabanı kayıtlarını esas al.',
      'Kayıtlarda olmayan bilgileri kesinlikle gerçekmiş gibi üretme; eksik alanlar için "Kayıt bulunmuyor" ifadesini kullan.',
      'Yanıtında hangi kayıt başlıklarına dayandığını açıkça belirt.',
      'Yanıtını mobil ve masaüstü ekranda kolay okunacak şekilde kısa başlıklar (##) ve madde işaretleriyle (-) düzenle; geniş çok sütunlu Markdown tabloları ve <br> etiketi kullanma.',
      '',
      'VERİTABANI KAYITLARI:',
      ctx.contextText
    ].join('\n');

    const aiRes = await generateAiCompletion({
      systemPrompt,
      messages: [{ role: 'user', content: promptInstruction }]
    });

    return jsonResponse(200, {
      content: aiRes.content,
      sources: ctx.sources,
      provider: aiRes.provider,
      model: aiRes.model
    });
  } catch (err) {
    return jsonResponse(err.statusCode || 500, {
      error: err.code || 'AI_SUMMARY_ERROR',
      message: err.message || 'AI özet işlemi sırasında hata oluştu.'
    });
  }
};
