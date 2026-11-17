'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE_PATH = path.resolve(__dirname, '..', '..', '..', 'database', 'local-db.json');

function createSeedDatabase() {
  const adminId = '11111111-1111-4111-8111-111111111111';
  const projDonId = '22222222-2222-4222-8222-222222222201';
  const projYoloId = '22222222-2222-4222-8222-222222222202';
  const projVaultId = '22222222-2222-4222-8222-222222222203';

  const now = new Date();
  const isoDaysAgo = (d) => new Date(now.getTime() - d * 86400000).toISOString();
  const dateDaysOffset = (d) => {
    const dt = new Date(now.getTime() + d * 86400000);
    return dt.toISOString().slice(0, 10);
  };

  return {
    users: [
      {
        id: adminId,
        email: 'admin@projectvault.local',
        password: process.env.LOCAL_DEFAULT_PASSWORD || '123456',
        user_metadata: { full_name: 'Proje Yöneticisi', username: 'admin' },
        created_at: isoDaysAgo(30)
      }
    ],
    profiles: [
      {
        id: adminId,
        user_id: adminId,
        email: 'admin@projectvault.local',
        full_name: 'Proje Yöneticisi',
        username: 'admin',
        avatar_url: null,
        theme_preference: 'dark',
        timezone: 'Europe/Istanbul',
        notification_preferences: { in_app: true, web_push: true, email: false },
        created_at: isoDaysAgo(30),
        updated_at: isoDaysAgo(1)
      }
    ],
    projects: [
      {
        id: projDonId,
        user_id: adminId,
        title: 'Don Önleme Robotu',
        short_description: 'Tarım arazilerinde don riskini önceden tahmin edip otomatik koruma başlatan otonom IoT ve robotik sistem.',
        purpose: 'İlkbahar geç donlarında meyve bahçelerindeki ürün kaybını %80 oranında azaltmak.',
        origin_idea: 'Bölgedeki üreticilerin gece ani sıcaklık düşüşlerinde manuel müdahalede geç kalması üzerine doğdu.',
        motivation: 'Gerçek saha problemini otonom sensör füzyonu ve düşük maliyetli donanımla çözmek.',
        technologies: ['ESP32', 'Python', 'MQTT', 'LoRaWAN', 'DHT22', 'FastAPI'],
        category: 'Robotik',
        status: 'Geliştiriliyor',
        priority: 'Yüksek',
        start_date: dateDaysOffset(-45),
        target_end_date: dateDaysOffset(45),
        progress: 50,
        tags: ['iot', 'tarım', 'otonom', 'don-önleme'],
        cover_image_url: null,
        is_favorite: true,
        is_archived: false,
        work_done_summary: 'ESP32 sensör düğümleri kuruldu, LoRaWAN üzerinden gateway iletişimi test edildi ve temel sıcaklık eşiği alarmı yazıldı.',
        technical_challenges: 'Soğuk havalarda LiFePO4 batarya voltaj düşüşü ve uzun mesafede paket kaybı.',
        resolved_issues: 'LoRa Spreading Factor SF10 ayarına çekilerek 1.2 km menzilde paket kaybı %2 altına indirildi.',
        unresolved_issues: 'Nem ve rüzgar hızı verilerini birleştiren çiy noktası (dew point) tahmin modeli henüz saha testine alınmadı.',
        last_stage: 'Gateway verilerinin zaman serisi tablosuna yazılması aşamasında kalındı.',
        next_steps: 'Dew point tahmin algoritmasını Python servisine entegre et ve 48 saatlik saha dayanıklılık testi yap.',
        roadmap_steps: [
          {
            id: 'don-1',
            unit: 1,
            unit_title: '1. Kısım: Donanım ve Sensör Altyapısı',
            title: 'ESP32 & DHT22 Sensör Düğümü',
            icon: 'cpu',
            status: 'completed',
            topics: ['ESP32 derin uyku modu', 'DHT22 sıcaklık ve bağıl nem okuma'],
            action_items: ['Sensör pin bağlantılarını doğrula', 'Seri porttan ham veriyi logla'],
            ai_tip: 'Soğuk havalarda LiFePO4 pil voltajını ADC üzerinden düzenli örnekleyin.'
          },
          {
            id: 'don-2',
            unit: 1,
            unit_title: '1. Kısım: Donanım ve Sensör Altyapısı',
            title: 'LoRaWAN SF10 Menzil Optimizasyonu',
            icon: 'layers',
            status: 'completed',
            topics: ['LoRa Spreading Factor ayarları', 'Gateway paket kaybı ölçümü'],
            action_items: ['1.2 km saha testini tamamla', 'SF10 ile paket kaybını %2 altına düşür'],
            ai_tip: 'Anten yüksekliğini en az 2.5m tutarak arazi engellerini azaltın.'
          },
          {
            id: 'don-3',
            unit: 2,
            unit_title: '2. Kısım: Çiy Noktası & Saha Otomasyonu',
            title: 'Gateway Zaman Serisi & Dew Point Servisi',
            icon: 'code-2',
            status: 'current',
            topics: ['Magnus çiy noktası formülü', 'FastAPI MQTT tüketici servisi', 'PostgreSQL zaman serisi yazımı'],
            action_items: ['Dew point algoritmasını Python servisine entegre et', 'Eşik aşımında röle uyarısını doğrula'],
            ai_tip: 'Şu an tam burada kaldınız: Gateway verilerini tabloya yazdıktan sonra 48 saatlik saha testine geçin.'
          },
          {
            id: 'don-4',
            unit: 2,
            unit_title: '2. Kısım: Çiy Noktası & Saha Otomasyonu',
            title: '48 Saatlik Saha Dayanıklılık Testi',
            icon: 'shield-check',
            status: 'locked',
            topics: ['Düşük sıcaklık batarya testi', 'Otomatik alarm tetikleme'],
            action_items: ['Saha prototipini 48 saat kesintisiz çalıştır', 'Sonuçları Proje Günlüğüne ekle'],
            ai_tip: 'Beklenmedik kopmalar için donanımsal watchdog timer aktif edin.'
          }
        ],
        last_worked_at: isoDaysAgo(3),
        created_at: isoDaysAgo(45),
        updated_at: isoDaysAgo(3)
      },
      {
        id: projYoloId,
        user_id: adminId,
        title: 'YOLO11 Bitki Hastalığı Tespiti',
        short_description: 'Yaprak görüntülerinden erken evre mantar ve bakteri hastalıklarını tespit eden bilgisayarla görü modeli.',
        purpose: 'Drone ve mobil kameralardan alınan görüntülerde milisaniyeler içinde hastalık sınıflandırması yapmak.',
        origin_idea: 'Tarla taramalarında uzman desteğini erken uyarı aşamasında hızlandırmak.',
        motivation: 'YOLO11 mimarisinin küçük lezyonlardaki başarımını gerçek saha veri setiyle doğrulamak.',
        technologies: ['Python', 'PyTorch', 'YOLO11', 'OpenCV', 'Albumentations', 'ONNX'],
        category: 'Computer Vision',
        status: 'Test Ediliyor',
        priority: 'Kritik',
        start_date: dateDaysOffset(-30),
        target_end_date: dateDaysOffset(20),
        progress: 50,
        tags: ['yolo11', 'vision', 'pytorch'],
        cover_image_url: null,
        is_favorite: true,
        is_archived: false,
        work_done_summary: '4.200 etiketli görüntü ile YOLO11m eğitimi tamamlandı.',
        technical_challenges: 'Güneş parlaması altındaki yapraklarda yanlış pozitif oranı yüksek çıkıyordu.',
        resolved_issues: 'Albumentations ile RandomBrightnessContrast ve HueSaturationValue artırmaları eklendi.',
        unresolved_issues: 'Kenar cihazda INT8 quantization sonrası %3.4 doğruluk kaybı optimize edilmeli.',
        last_stage: 'Validation seti üzerinde confusion matrix incelemesi yapıldı.',
        next_steps: 'Kalibrasyon veri seti ile ONNX/TensorRT FP16 dönüşümünü kıyasla.',
        roadmap_steps: [
          {
            id: 'yolo-1',
            unit: 1,
            unit_title: '1. Kısım: Veri Seti & Model Eğitimi',
            title: '4.200 Görüntülük Veri Artırma Pipeline',
            icon: 'database',
            status: 'completed',
            topics: ['Albumentations RandomBrightnessContrast', 'Güneş parlaması veri dengeleme'],
            action_items: ['Veri artırma parametrelerini sabitle', 'Etiket dağılımını kontrol et'],
            ai_tip: 'Farklı ışık koşullarındaki yaprak örneklerini doğrulama setinde ayrı tutun.'
          },
          {
            id: 'yolo-2',
            unit: 1,
            unit_title: '1. Kısım: Veri Seti & Model Eğitimi',
            title: 'YOLO11m 120 Epoch Eğitimi & mAP Analizi',
            icon: 'sparkles',
            status: 'completed',
            topics: ['Confusion matrix değerlendirme', 'mAP50 ve mAP50-95 metrikleri'],
            action_items: ['0.914 mAP50 sonucunu incele', 'Yanlış pozitif sınıfları listele'],
            ai_tip: 'Küçük lezyonlarda görüntü giriş çözünürlüğünü 640 yerine 960 deneyebilirsiniz.'
          },
          {
            id: 'yolo-3',
            unit: 2,
            unit_title: '2. Kısım: Kenar Cihaz Optimizasyonu',
            title: 'ONNX / TensorRT FP16 Dönüşümü',
            icon: 'rocket',
            status: 'current',
            topics: ['TensorRT FP16 vs INT8 quantization', 'Jetson Orin Nano FPS benchmark'],
            action_items: ['Kalibrasyon veri seti ile FP16/INT8 doğruluk farkını ölç', 'Hedef FPS değerini doğrula'],
            ai_tip: 'INT8 sonrası %3.4 kaybı düşürmek için en kritik 300 saha görüntüsüyle kalibrasyon yapın.'
          }
        ],
        last_worked_at: isoDaysAgo(1),
        created_at: isoDaysAgo(30),
        updated_at: isoDaysAgo(1)
      },
      {
        id: projVaultId,
        user_id: adminId,
        title: 'ProjectVault Bilgi Merkezi',
        short_description: 'Kişisel proje fikirleri, görevler, günlükler ve AI hafıza asistanı platformu.',
        purpose: 'Tüm projelerin amacını, teknik geçmişini ve son durumunu tek merkezde saklamak.',
        origin_idea: 'Aylar sonra açılan projelerde nerede kalındığını hızlıca hatırlama ihtiyacı.',
        motivation: 'Sürdürülebilir kişisel bilgi ve yapay zekâ hafızası oluşturmak.',
        technologies: ['HTML5', 'CSS3', 'Vanilla JS', 'Node.js', 'Groq AI'],
        category: 'Web Geliştirme',
        status: 'Geliştiriliyor',
        priority: 'Yüksek',
        start_date: dateDaysOffset(-5),
        target_end_date: dateDaysOffset(14),
        progress: 100,
        tags: ['projectvault', 'ai-memory'],
        cover_image_url: null,
        is_favorite: false,
        is_archived: false,
        work_done_summary: 'Tüm modüller, Kanban görev panosu, FullCalendar takvim ve Groq AI entegrasyonu tamamlandı.',
        technical_challenges: '',
        resolved_issues: 'Modüler AI sağlayıcı katmanı ile Groq entegrasyonu çözüldü.',
        unresolved_issues: '',
        last_stage: 'Yerel kalıcı veritabanı ile tam test aşaması.',
        next_steps: 'İlk gerçek projelerinizi ve günlük notlarınızı ekleyin.',
        last_worked_at: isoDaysAgo(0),
        created_at: isoDaysAgo(5),
        updated_at: isoDaysAgo(0)
      }
    ],
    ideas: [
      {
        id: '33333333-3333-4333-8333-333333333301',
        user_id: adminId,
        title: 'Sesli Komutla Çalışan Kod İnceleme Ajanı',
        description: 'Git diff çıktısını yerel veya hızlı LLM ile analiz edip güvenlik açıklarını özetleyen geliştirici aracı.',
        category: 'Agentic AI',
        priority: 'Yüksek',
        estimated_difficulty: 'Orta',
        tags: ['agentic-ai', 'cli', 'code-review'],
        related_links: ['https://modelcontextprotocol.io'],
        ai_suggestions: '',
        is_converted: false,
        converted_project_id: null,
        created_at: isoDaysAgo(4),
        updated_at: isoDaysAgo(4)
      }
    ],
    tasks: [
      {
        id: '44444444-4444-4444-8444-444444444401',
        user_id: adminId,
        project_id: projDonId,
        title: 'Çiy noktası hesaplama fonksiyonunu yaz',
        description: 'Sıcaklık ve bağıl nemden Magnus formülü ile çiy noktası hesapla.',
        start_date: dateDaysOffset(0),
        due_date: dateDaysOffset(0),
        priority: 'Yüksek',
        status: 'Devam Ediyor',
        completion_percentage: 50,
        position: 1,
        completed_at: null,
        created_at: isoDaysAgo(3),
        updated_at: isoDaysAgo(1)
      },
      {
        id: '44444444-4444-4444-8444-444444444402',
        user_id: adminId,
        project_id: projDonId,
        title: 'LoRa gateway muhafaza kutusunu IP65 testinden geçir',
        description: 'Saha montajı öncesi su sızdırmazlık kontrolü.',
        start_date: dateDaysOffset(-5),
        due_date: dateDaysOffset(-1),
        priority: 'Orta',
        status: 'Tamamlandı',
        completion_percentage: 100,
        position: 2,
        completed_at: isoDaysAgo(2),
        created_at: isoDaysAgo(6),
        updated_at: isoDaysAgo(2)
      },
      {
        id: '44444444-4444-4444-8444-444444444403',
        user_id: adminId,
        project_id: projYoloId,
        title: 'TensorRT FP16 model benchmarkını çalıştır',
        description: 'FPS ve mAP metriklerini kaydet.',
        start_date: dateDaysOffset(0),
        due_date: dateDaysOffset(2),
        priority: 'Kritik',
        status: 'Yapılacak',
        completion_percentage: 0,
        position: 1,
        completed_at: null,
        created_at: isoDaysAgo(2),
        updated_at: isoDaysAgo(2)
      },
      {
        id: '44444444-4444-4444-8444-444444444404',
        user_id: adminId,
        project_id: projYoloId,
        title: 'Veri artırma pipelineını dokümante et',
        description: 'Albumentations parametrelerini kaydet.',
        start_date: dateDaysOffset(-4),
        due_date: dateDaysOffset(-1),
        priority: 'Orta',
        status: 'Tamamlandı',
        completion_percentage: 100,
        position: 2,
        completed_at: isoDaysAgo(1),
        created_at: isoDaysAgo(4),
        updated_at: isoDaysAgo(1)
      }
    ],
    reminders: [
      {
        id: '55555555-5555-4555-8555-555555555501',
        user_id: adminId,
        project_id: projDonId,
        task_id: null,
        title: 'Don Önleme Robotu Saha Kontrolü',
        description: 'Dew point servisi ve saha batarya loglarını kontrol et.',
        remind_date: dateDaysOffset(1),
        remind_time: '10:00:00',
        remind_at: `${dateDaysOffset(1)}T10:00:00+03:00`,
        next_remind_at: `${dateDaysOffset(1)}T10:00:00+03:00`,
        repeat_type: 'Haftalık',
        notification_method: 'Uygulama İçi',
        notification_status: 'pending',
        is_active: true,
        last_sent_at: null,
        timezone: 'Europe/Istanbul',
        created_at: isoDaysAgo(2),
        updated_at: isoDaysAgo(2)
      }
    ],
    documents: [],
    project_notes: [
      {
        id: '66666666-6666-4666-8666-666666666601',
        user_id: adminId,
        project_id: projYoloId,
        note_date: dateDaysOffset(-1),
        title: 'YOLO11 Eğitim ve Augmentasyon Sonuçları',
        content: 'YOLO11m modeli üzerinde 120 epoch eğitim tamamlandı. mAP50 değeri 0.914 seviyesine ulaştı. Parlak ışık altındaki yapraklarda doğruluğu artırmak için veri artırma yöntemleri test edildi.',
        tags: ['yolo11', 'eğitim', 'augmentasyon'],
        created_at: isoDaysAgo(1),
        updated_at: isoDaysAgo(1)
      },
      {
        id: '66666666-6666-4666-8666-666666666602',
        user_id: adminId,
        project_id: projDonId,
        note_date: dateDaysOffset(-3),
        title: 'LoRaWAN Saha Menzil Testi',
        content: 'Açık alanda 1.2 km mesafede SF10 ve 125 kHz bant genişliği ile paket kaybı %1.8 ölçüldü.',
        tags: ['lorawan', 'test'],
        created_at: isoDaysAgo(3),
        updated_at: isoDaysAgo(3)
      }
    ],
    technical_notes: [
      {
        id: '77777777-7777-4777-8777-777777777701',
        user_id: adminId,
        project_id: projDonId,
        title: 'Magnus Formülü ile Çiy Noktası Hesabı',
        note_type: 'Kod Parçacığı',
        content: 'Don riski sadece hava sıcaklığına değil çiy noktasına da bağlıdır.',
        code_snippet: 'def dew_point(t, rh):\n    a, b = 17.27, 237.7\n    alpha = ((a * t) / (b + t)) + math.log(rh / 100.0)\n    return (b * alpha) / (a - alpha)',
        is_resolved: true,
        tags: ['python', 'algoritma'],
        created_at: isoDaysAgo(3),
        updated_at: isoDaysAgo(3)
      }
    ],
    ai_conversations: [],
    ai_messages: [],
    notifications: [
      {
        id: '88888888-8888-4888-8888-888888888801',
        user_id: adminId,
        reminder_id: null,
        project_id: projDonId,
        title: 'ProjectVault Yerleşik Veritabanı Hazır',
        message: 'Tüm verileriniz local-db.json dosyasında güvenle saklanıyor.',
        type: 'system',
        is_read: false,
        sent_via: 'Uygulama İçi',
        created_at: isoDaysAgo(0),
        updated_at: isoDaysAgo(0)
      }
    ],
    storage_objects: {}
  };
}

function readDb() {
  if (!fs.existsSync(DB_FILE_PATH)) {
    const seed = createSeedDatabase();
    writeDb(seed);
    return seed;
  }
  const raw = fs.readFileSync(DB_FILE_PATH, 'utf8');
  const db = JSON.parse(raw);

  // Mevcut projelerde roadmap_steps yoksa uyumluluk için tamamla
  if (Array.isArray(db.projects)) {
    let changed = false;
    const seed = createSeedDatabase();
    const seedMap = new Map((seed.projects || []).map((p) => [p.id, p]));
    db.projects = db.projects.map((p) => {
      if (!Array.isArray(p.roadmap_steps)) {
        changed = true;
        const seeded = seedMap.get(p.id);
        return { ...p, roadmap_steps: seeded ? seeded.roadmap_steps : [] };
      }
      return p;
    });
    if (changed) writeDb(db);
  }
  return db;
}

function writeDb(db) {
  const dir = path.dirname(DB_FILE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function toComparableValue(v) {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(v)) {
    const ms = Date.parse(v);
    if (!Number.isNaN(ms)) return ms;
  }
  return v;
}

function applyFilters(rows, filters) {
  return rows.filter((row) => {
    for (const f of filters) {
      const val = row[f.col];
      if (f.op === 'eq' && val !== f.val) return false;
      if (f.op === 'neq' && val === f.val) return false;
      if (f.op === 'lte') {
        if (val === null || val === undefined) return false;
        if (!(toComparableValue(val) <= toComparableValue(f.val))) return false;
      }
      if (f.op === 'gte') {
        if (val === null || val === undefined) return false;
        if (!(toComparableValue(val) >= toComparableValue(f.val))) return false;
      }
      if (f.op === 'is') {
        if (f.val === null && val !== null && val !== undefined) return false;
        if (f.val !== null && val !== f.val) return false;
      }
    }
    return true;
  });
}

function createServerLocalClient() {
  const makeQuery = (table, op = 'select', payload = null) => {
    const state = {
      table,
      op,
      payload,
      selectStr: '*',
      filters: [],
      orders: [],
      limitVal: null,
      singleMode: null
    };

    const execute = () => {
      const db = readDb();
      if (!Array.isArray(db[state.table])) db[state.table] = [];
      const nowIso = new Date().toISOString();

      if (state.op === 'select') {
        let rows = applyFilters(db[state.table], state.filters).map((r) => ({ ...r }));

        if (state.selectStr && state.selectStr.includes('projects(')) {
          const projMap = new Map((db.projects || []).map((p) => [p.id, p]));
          rows = rows.map((r) => ({
            ...r,
            projects: r.project_id && projMap.get(r.project_id) ? { title: projMap.get(r.project_id).title } : null
          }));
        }

        if (state.orders.length) {
          rows.sort((a, b) => {
            for (const o of state.orders) {
              const av = a[o.col] ?? '';
              const bv = b[o.col] ?? '';
              if (av < bv) return o.ascending ? -1 : 1;
              if (av > bv) return o.ascending ? 1 : -1;
            }
            return 0;
          });
        }

        if (state.limitVal !== null) rows = rows.slice(0, state.limitVal);

        if (state.singleMode === 'single') {
          if (!rows.length) return { data: null, error: { message: 'Kayıt bulunamadı.' } };
          return { data: rows[0], error: null };
        }
        if (state.singleMode === 'maybeSingle') {
          return { data: rows[0] || null, error: null };
        }
        return { data: rows, error: null };
      }

      if (state.op === 'insert') {
        const items = Array.isArray(state.payload) ? state.payload : [state.payload];
        const inserted = items.map((item) => ({
          id: item.id || crypto.randomUUID(),
          created_at: item.created_at || nowIso,
          updated_at: item.updated_at || nowIso,
          ...item
        }));
        db[state.table].push(...inserted);
        writeDb(db);
        if (state.singleMode) return { data: inserted[0] || null, error: null };
        return { data: inserted, error: null };
      }

      if (state.op === 'update') {
        const updated = [];
        db[state.table] = db[state.table].map((row) => {
          if (applyFilters([row], state.filters).length) {
            const next = { ...row, ...state.payload, updated_at: nowIso };
            updated.push(next);
            return next;
          }
          return row;
        });
        writeDb(db);
        if (state.singleMode) return { data: updated[0] || null, error: null };
        return { data: updated, error: null };
      }

      if (state.op === 'delete') {
        const deleted = applyFilters(db[state.table], state.filters);
        const delIds = new Set(deleted.map((r) => r.id));
        db[state.table] = db[state.table].filter((r) => !delIds.has(r.id));
        writeDb(db);
        return { data: deleted, error: null };
      }

      return { data: null, error: null };
    };

    const chain = {
      select: (s = '*') => { state.selectStr = s; return chain; },
      eq: (col, val) => { state.filters.push({ op: 'eq', col, val }); return chain; },
      neq: (col, val) => { state.filters.push({ op: 'neq', col, val }); return chain; },
      lte: (col, val) => { state.filters.push({ op: 'lte', col, val }); return chain; },
      gte: (col, val) => { state.filters.push({ op: 'gte', col, val }); return chain; },
      is: (col, val) => { state.filters.push({ op: 'is', col, val }); return chain; },
      order: (col, opts = {}) => { state.orders.push({ col, ascending: opts.ascending !== false }); return chain; },
      limit: (n) => { state.limitVal = n; return chain; },
      single: () => { state.singleMode = 'single'; return Promise.resolve(execute()); },
      maybeSingle: () => { state.singleMode = 'maybeSingle'; return Promise.resolve(execute()); },
      then: (resolve, reject) => Promise.resolve(execute()).then(resolve, reject)
    };
    return chain;
  };

  return {
    from: (table) => ({
      select: (s) => makeQuery(table, 'select').select(s),
      insert: (data) => makeQuery(table, 'insert', data),
      update: (data) => makeQuery(table, 'update', data),
      delete: () => makeQuery(table, 'delete')
    }),
    storage: {
      from: (bucket) => ({
        download: async (storagePath) => {
          const db = readDb();
          const dataUrl = db.storage_objects?.[`${bucket}/${storagePath}`];
          if (!dataUrl) return { data: null, error: { message: 'Dosya bulunamadı.' } };
          const base64Part = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
          const buf = Buffer.from(base64Part, 'base64');
          return {
            data: {
              text: async () => buf.toString('utf8'),
              arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
            },
            error: null
          };
        }
      })
    }
  };
}

module.exports = {
  DB_FILE_PATH,
  readDb,
  writeDb,
  createServerLocalClient
};
