-- ==============================================================================
-- ProjectVault - İsteğe Bağlı Örnek Başlangıç Verileri (Seed)
-- NOT: Bu dosya yalnızca Supabase Auth üzerinden en az 1 kullanıcı kayıt
-- olduktan sonra test/örnek veri eklemek istediğinizde SQL Editor'de çalıştırılır.
-- Uygulama kodu bu dosyadan veya sahte verilerden bağımsız çalışır.
-- ==============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_proj_don UUID := gen_random_uuid();
  v_proj_yolo UUID := gen_random_uuid();
  v_proj_sec UUID := gen_random_uuid();
BEGIN
  -- İlk kayıtlı kullanıcıyı al
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Kayıtlı kullanıcı bulunamadı. Önce register.html üzerinden bir hesap oluşturun, ardından seed.sql çalıştırın.';
    RETURN;
  END IF;

  -- Eğer kullanıcının zaten projeleri varsa tekrar ekleme
  IF EXISTS (SELECT 1 FROM public.projects WHERE user_id = v_user_id) THEN
    RAISE NOTICE 'Kullanıcı (%) için zaten veri mevcut, seed atlandı.', v_user_id;
    RETURN;
  END IF;

  -- Örnek Projeler
  INSERT INTO public.projects (
    id, user_id, title, short_description, purpose, origin_idea, motivation,
    technologies, category, status, priority, start_date, target_end_date, progress, tags,
    work_done_summary, technical_challenges, resolved_issues, unresolved_issues, last_stage, next_steps, last_worked_at
  ) VALUES
  (
    v_proj_don,
    v_user_id,
    'Don Önleme Robotu',
    'Tarım arazilerinde don riskini önceden tahmin edip otomatik koruma başlatan otonom IoT ve robotik sistem.',
    'İlkbahar geç donlarında meyve bahçelerindeki ürün kaybını %80 oranında azaltmak.',
    'Bölgedeki kayısı ve elma üreticilerinin gece ani sıcaklık düşüşlerinde manuel müdahalede geç kalması üzerine doğdu.',
    'Gerçek saha problemini otonom sensör füzyonu ve düşük maliyetli donanımla çözmek.',
    ARRAY['ESP32', 'Python', 'MQTT', 'LoRaWAN', 'DHT22', 'Termal Kamera', 'FastAPI'],
    'Robotik',
    'Geliştiriliyor',
    'Yüksek',
    CURRENT_DATE - INTERVAL '45 days',
    CURRENT_DATE + INTERVAL '60 days',
    60,
    ARRAY['iot', 'tarım', 'otonom', 'don-önleme'],
    'ESP32 sensör düğümleri kuruldu, LoRaWAN üzerinden gateway iletişimi test edildi ve temel sıcaklık eşiği alarmı yazıldı.',
    'Soğuk havalarda LiFePO4 batarya voltaj düşüşü ve uzun mesafede paket kaybı.',
    'LoRa Spreading Factor SF10 ayarına çekilerek 1.2 km menzilde paket kaybı %2 altına indirildi.',
    'Nem ve rüzgar hızı verilerini birleştiren çiy noktası (dew point) tahmin modeli henüz saha testine alınmadı.',
    'Gateway verilerinin PostgreSQL zaman serisi tablosuna yazılması aşamasında kalındı.',
    'Dew point tahmin algoritmasını Python servisine entegre et ve 48 saatlik saha dayanıklılık testi yap.',
    NOW() - INTERVAL '3 days'
  ),
  (
    v_proj_yolo,
    v_user_id,
    'YOLO11 Bitki Hastalığı Tespiti',
    'Yaprak görüntülerinden erken evre mantar ve bakteri hastalıklarını tespit eden bilgisayarla görü modeli.',
    'Mobil ve drone kameralarından alınan görüntülerde milisaniyeler içinde hastalık sınıflandırması yapmak.',
    'Tarla taramalarında uzman ziraat mühendisi ihtiyacını erken uyarı aşamasında desteklemek.',
    'YOLO11 mimarisinin küçük lezyonlardaki mAP50-95 başarımını gerçek veri setiyle doğrulamak.',
    ARRAY['Python', 'PyTorch', 'YOLO11', 'OpenCV', 'Albumentations', 'ONNX'],
    'Computer Vision',
    'Test Ediliyor',
    'Kritik',
    CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE + INTERVAL '25 days',
    75,
    ARRAY['yolo11', 'vision', 'tarım', 'pytorch'],
    'PlantVillage ve yerel saha fotoğraflarından oluşan 4.200 etiketli görüntü ile YOLO11m eğitimi tamamlandı.',
    'Güneş parlaması altındaki yapraklarda yanlış pozitif (false positive) oranı yüksek çıkıyordu.',
    'Albumentations ile RandomBrightnessContrast ve HueSaturationValue artırmaları eklendi.',
    'Kenar cihazda (Jetson Orin Nano) INT8 quantization sonrası doğruluk kaybı (%3.4) optimize edilmeli.',
    'Validation seti üzerinde confusion matrix incelemesi yapıldı.',
    'Kalibrasyon veri seti ile ONNX/TensorRT FP16 dönüşümünü kıyasla.',
    NOW() - INTERVAL '1 day'
  ),
  (
    v_proj_sec,
    v_user_id,
    'Sıfır Güven API Ağ Geçidi Prototipi',
    'Mikroservisler arası mTLS ve kısa ömürlü JWT doğrulaması yapan hafif güvenlik katmanı.',
    'Kişisel ve kurumsal API servislerinde token sızıntısı riskini en aza indirmek.',
    'Statik API anahtarlarının yönetim zorluğu ve denetim eksikliği.',
    'Modern siber güvenlik mimarilerini uygulamalı referans kodla öğrenmek.',
    ARRAY['Node.js', 'PostgreSQL', 'JWT', 'Docker', 'Nginx'],
    'Siber Güvenlik',
    'Planlanıyor',
    'Orta',
    CURRENT_DATE - INTERVAL '10 days',
    CURRENT_DATE + INTERVAL '90 days',
    25,
    ARRAY['zero-trust', 'api', 'security'],
    'Tehdit modeli ve rate-limit politikaları dokümante edildi.',
    'Dağıtık Redis olmadan yüksek hızda token iptal listesi (revocation) kontrolü.',
    'Henüz çözülmüş büyük blokaj yok.',
    'Kısa ömürlü token rotasyon stratejisinin netleştirilmesi gerekiyor.',
    'Mimari diyagram ve ilk politika taslağı oluşturuldu.',
    'JWT doğrulama ara katmanını (middleware) ve birim testlerini yaz.',
    NOW() - INTERVAL '7 days'
  );

  -- Örnek Görevler
  INSERT INTO public.tasks (user_id, project_id, title, description, start_date, due_date, priority, status, completion_percentage, position)
  VALUES
  (v_user_id, v_proj_don, 'Çiy noktası hesaplama fonksiyonunu yaz', 'Sıcaklık ve bağıl nemden Magnus formülü ile çiy noktası hesapla.', CURRENT_DATE, CURRENT_DATE, 'Yüksek', 'Devam Ediyor', 50, 1),
  (v_user_id, v_proj_don, 'LoRa gateway muhafaza kutusunu IP65 testinden geçir', 'Saha montajı öncesi su sızdırmazlık kontrolü.', CURRENT_DATE - 5, CURRENT_DATE - 1, 'Orta', 'Tamamlandı', 100, 2),
  (v_user_id, v_proj_don, 'Güneş paneli şarj kontrol devresini bağla', 'MPPT modülü ile batarya dengeleme.', CURRENT_DATE + 1, CURRENT_DATE + 5, 'Yüksek', 'Yapılacak', 0, 3),
  (v_user_id, v_proj_yolo, 'TensorRT FP16 model benchmarkını çalıştır', 'FPS ve mAP metriklerini kaydet.', CURRENT_DATE, CURRENT_DATE + 2, 'Kritik', 'Yapılacak', 0, 1),
  (v_user_id, v_proj_yolo, 'Veri artırma pipelineını dokümante et', 'Albumentations parametrelerini kaydet.', CURRENT_DATE - 3, CURRENT_DATE - 1, 'Orta', 'Tamamlandı', 100, 2);

  -- Örnek Proje Günlüğü Kayıtları
  INSERT INTO public.project_notes (user_id, project_id, note_date, title, content, tags)
  VALUES
  (v_user_id, v_proj_yolo, CURRENT_DATE - 1, 'YOLO11 Eğitim ve Augmentasyon Sonuçları', 'YOLO11m modeli üzerinde 120 epoch eğitim tamamlandı. mAP50 değeri 0.914 seviyesine ulaştı. Parlak ışık altındaki yapraklarda doğruluk artışı için veri artırma yöntemleri test edildi.', ARRAY['yolo11', 'eğitim', 'augmentasyon']),
  (v_user_id, v_proj_don, CURRENT_DATE - 3, 'LoRaWAN Saha Menzil Testi', 'Açık alanda 1.2 km mesafede SF10 ve 125 kHz bant genişliği ile paket kaybı %1.8 olarak ölçüldü. Bir sonraki adımda röle tetikleme gecikmesi ölçülecek.', ARRAY['lorawan', 'test']);

  -- Örnek Teknik Notlar
  INSERT INTO public.technical_notes (user_id, project_id, title, note_type, content, code_snippet, is_resolved, tags)
  VALUES
  (v_user_id, v_proj_don, 'Magnus Formülü ile Çiy Noktası Hesabı', 'Kod Parçacığı', 'Don riski sadece hava sıcaklığına değil çiy noktasına da bağlıdır.', 'def dew_point(t, rh):\n    a, b = 17.27, 237.7\n    alpha = ((a * t) / (b + t)) + math.log(rh / 100.0)\n    return (b * alpha) / (a - alpha)', true, ARRAY['python', 'algoritma']);

  -- Örnek Fikir Havuzu Kaydı
  INSERT INTO public.ideas (user_id, title, description, category, priority, estimated_difficulty, tags, related_links)
  VALUES
  (v_user_id, 'Sesli Komutla Çalışan Yerel Kod İnceleme Ajanı', 'Git diff çıktısını yerel LLM ile analiz edip güvenlik açıklarını özetleyen CLI aracı.', 'Agentic AI', 'Yüksek', 'Orta', ARRAY['agentic-ai', 'cli', 'code-review'], ARRAY['https://modelcontextprotocol.io']);

  -- Örnek Hatırlatma
  INSERT INTO public.reminders (
    user_id, project_id, title, description, remind_date, remind_time, remind_at, next_remind_at, repeat_type, notification_method
  ) VALUES (
    v_user_id,
    v_proj_don,
    'Don Önleme Robotu Haftalık Gözden Geçirme',
    'Dew point servisi ve saha batarya loglarını kontrol et.',
    CURRENT_DATE + 1,
    '10:00:00',
    ((CURRENT_DATE + 1) + TIME '10:00:00') AT TIME ZONE 'Europe/Istanbul',
    ((CURRENT_DATE + 1) + TIME '10:00:00') AT TIME ZONE 'Europe/Istanbul',
    'Haftalık',
    'Uygulama İçi'
  );

  RAISE NOTICE 'Örnek başlangıç verileri kullanıcı (%) için başarıyla eklendi.', v_user_id;
END $$;
