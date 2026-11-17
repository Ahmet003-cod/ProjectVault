# ProjectVault — Kişisel Proje Yönetimi, Bilgi Merkezi ve AI Hafıza Platformu

![HTML5](https://img.shields.io/badge/Frontend-HTML5%20%7C%20CSS3%20%7C%20Vanilla%20JS-06b6d4?style=flat-square)
![Backend](https://img.shields.io/badge/Backend-Netlify%20Functions%20(Node.js)-8b5cf6?style=flat-square)
![Database](https://img.shields.io/badge/Database-Supabase%20PostgreSQL%20%2B%20pgvector-10b981?style=flat-square)
![AI](https://img.shields.io/badge/AI-Groq%20%7C%20Gemini%20%7C%20OpenAI%20Compatible-3b82f6?style=flat-square)

**ProjectVault**, aklınızdaki proje fikirlerini, devam eden projelerinizi, araştırmalarınızı, özel dokümanlarınızı, teknik notlarınızı, Kanban görevlerinizi, sesli alarmlarınızı ve günlük çalışma kayıtlarınızı tek bir merkezde toplayan; aylar sonra bir projeyi yeniden açtığınızda nerede kaldığınızı eksiksiz hatırlamanızı sağlayan **kişisel proje hafızası ve AI destekli yol haritası platformudur**.

> React, Vue veya Angular gibi ağır frontend framework'leri kullanılmadan; tamamen saf **HTML5, CSS3, modüler Vanilla JavaScript (ES6+)** ve **Netlify Functions** mimarisiyle geliştirilmiştir.

---

## Öne Çıkan Özellikler

### 1. Proje Hafızası & "Bu Projeyi Bana Hatırlat"
- Her proje için kalıcı teknik bellek alanları: **Projenin amacı**, **ilk ortaya çıkış fikri**, **motivasyon**, **şimdiye kadar yapılan çalışmalar**, **karşılaşılan/çözülen/çözülmemiş sorunlar**, **en son kalınan aşama** ve **sonraki adımlar**.
- **"Bu Projeyi Bana Hatırlat"** butonuyla veritabanındaki gerçek proje kayıtları, günlük notları, teknik notlar ve görevlerden derlenen 8 soruluk kapsamlı hatırlatma ekranı (kayıt bulunmayan alanlarda tahmin veya sahte veri üretmez).

### 2. Duolingo Tarzı AI Proje Yol Haritası (`roadmap.html`)
- Yapay zekâ, projenizin mevcut ilerlemesini, teknolojilerini, tamamlanan görevlerini ve açık sorunlarını analiz ederek **ünite ve adımlardan oluşan kıvrımlı bir çalışma rotası** oluşturur.
- Daha önce tamamladığınız aşamaları **Tamamlandı (✓)** olarak işaretler, tam devam etmeniz gereken noktaya **"DEVAM ET"** odağını yerleştirir.
- Her aşamada **Çalışılacak Konular**, **Uygulama Adımları** ve **AI Rehber İpucu** yer alır; bir bölümü tamamladığınızda başarı melodisi çalar, proje ilerleme yüzdesi otomatik güncellenir ve sıradaki aşama açılır.

### 3. ProjectVault AI Asistanı & Modüler AI Mimarisi
- **Groq Cloud**, **Google Gemini**, **OpenRouter**, **Mistral**, **Qwen/Llama** veya **Ollama** gibi sağlayıcılar arasında yalnızca ortam değişkenleriyle geçiş yapabilen modüler adaptör ([ai-provider.js](netlify/functions/lib/ai-provider.js)).
- Tüm AI çağrıları sunucu tarafında (`netlify/functions/`) çalışır; API anahtarları hiçbir zaman frontend koduna yazılmaz.
- Proje geçmişi soru-cevap, proje özeti, sonraki adım önerisi, fikir geliştirme ve doküman analizi özellikleri **yalnızca kullanıcının kendi veritabanı kayıtlarına dayanır** ve dayanak kaynakları listeler.
- Gelecekte tam **RAG (Retrieval-Augmented Generation)** ve anlamsal arama için `pgvector` destekli `document_chunks` tablosu şemada hazırdır.

### 4. Sesli Alarm, Takvim (FullCalendar) & Bildirim Sistemi
- **FullCalendar** ile aylık, haftalık, günlük ve liste görünümlerinde proje teslim tarihleri, başlangıç planları, görevler ve alarmlar renk kodlarıyla takip edilir.
- **Web Audio API** tabanlı yerleşik ses sentezleyicisi ile 4 farklı alarm tonu (`Kristal Çan`, `Klasik Dijital`, `Yumuşak Akor`, `Acil Nabız`) harici ses dosyası gerektirmeden çalışır.
- `Europe/Istanbul` zaman diliminde çalışan `Tek seferlik`, `Günlük`, `Haftalık`, `Aylık` alarmlar; **5 dk erteleme**, **susturma**, mükerrer gönderim koruması ve Netlify 5 dakikalık cron zamanlayıcısı (`process-reminders.js`).

### 5. Proje, Fikir Havuzu, Kanban, Dokümanlar & Günlük
- **Fikir Havuzu:** Fikirleri kategori, öncelik ve zorluğa göre yönetme, AI ile teknik yol haritası çıkarma ve **tek tıklamayla tüm verileri koruyarak projeye dönüştürme**.
- **Sürükle-Bırak Kanban Panosu:** `Yapılacak`, `Devam Ediyor`, `Tamamlandı`, `Ertelendi` sütunları arasında sürükle-bırak taşıma ve proje ilerleme yüzdesine otomatik yansıtma.
- **Doküman Yönetim Sistemi:** 13 dosya türü desteği (`PDF`, `DOC`, `DOCX`, `XLS`, `XLSX`, `PPT`, `PPTX`, `PNG`, `JPG`, `JPEG`, `TXT`, `MD`, `CSV`), sürükle-bırak yükleme, kullanıcıya özel (`public = false`) Supabase Storage politikaları ve AI doküman özetleme.
- **Proje Günlüğü & Teknik Notlar:** Tarih bazlı kronolojik çalışma kayıtları, kod parçacıkları ve otomatik son çalışma tarihi güncellemesi.
- **İstatistikler & Global Arama (`Ctrl + K`):** Chart.js ile 5 gerçek zamanlı analiz grafiği; proje, fikir, görev, günlük ve dokümanlarda anlık filtreli arama.
- **Mobil Uyumlu Tasarım & Koyu/Açık Tema:** Varsayılan modern antrasit/koyu lacivert tema, açık tema geçişi, mobilde parmakla kaydırılabilen yatay sekmeler ve sabit mobil alt gezinme çubuğu.

---

## Mimari Genel Bakış

```
Tarayıcı (HTML5 / CSS3 / Vanilla JS)
   │
   ├──► Supabase Auth & PostgreSQL (RLS + Private Storage)
   │       (Yerelde yapılandırılmamışsa yerleşik local-db.json motoru)
   │
   └──► Netlify Functions (Node.js)
           ├── /api/ai-chat          ──► JWT Doğrulama + Bağlam Çekme ──► Groq / Gemini / OpenAI API
           ├── /api/ai-summary       ──► Özet, Hatırlatma & Yol Haritası
           ├── /api/document-analyze ──► Storage Dosya Doğrulama & AI Özeti
           └── process-reminders     ──► 5 Dk Zamanlanmış Cron (Europe/Istanbul)
```

---

## Klasör Yapısı

```text
projectvault/
├── index.html                    # Oturum yönlendirici
├── login.html & register.html    # Kimlik doğrulama ekranları
├── dashboard.html                # Ana kontrol paneli (6 KPI + A–F bölümleri)
├── projects.html                 # Proje listesi ve yönetimi
├── project-detail.html           # 8 sekmeli proje detay & hafıza merkezi
├── roadmap.html                  # Duolingo tarzı AI proje yol haritası
├── ideas.html                    # Fikir havuzu ve tek tıkla projeye dönüştürme
├── calendar.html                 # FullCalendar takvim ve alarm yönetimi
├── documents.html                # Özel doküman deposu ve AI analiz
├── journal.html                  # Kronolojik proje günlüğü
├── ai-assistant.html             # ProjectVault AI sohbet ekranı
├── statistics.html               # Chart.js performans ve aktivite grafikleri
├── settings.html                 # Profil, tema, sesli alarm ve bağlantı ayarları
│
├── assets/
│   ├── css/                      # main.css, auth.css, components.css, dashboard.css
│   ├── images/                   # logo.svg, favicon.svg
│   └── js/                       # 15 modüler Vanilla JS dosyası
│
├── netlify/
│   └── functions/                # ai-chat.js, ai-summary.js, document-analyze.js, process-reminders.js
│       └── lib/                  # ai-provider.js, supabase-auth.js, local-db.js
│
├── database/
│   ├── schema.sql                # 12 tablo (pgvector dahil), trigger ve RPC fonksiyonları
│   ├── rls-policies.sql          # Row Level Security & Storage erişim politikaları
│   └── seed.sql                  # İsteğe bağlı örnek veriler
│
├── server.js                     # Yerel geliştirme sunucusu
├── netlify.toml                  # Netlify build, yönlendirme, güvenlik ve cron ayarları
├── .env.example                  # Ortam değişkenleri şablonu
└── package.json
```

---

## Kurulum ve Yerel Çalıştırma

### Gereksinimler
- **Node.js** `v18+`
- **Supabase** hesabı (bulut veritabanı, auth ve dosya depolama için)
- **Groq** veya **Google Gemini** API anahtarı

### 1. Bağımlılıkları Yükleyin
```bash
git clone https://github.com/KULLANICI_ADINIZ/projectvault.git
cd projectvault
npm install
```

### 2. Supabase Veritabanını Hazırlayın
1. [Supabase Dashboard](https://supabase.com/dashboard) üzerinden yeni bir proje oluşturun.
2. **SQL Editor** ekranında sırasıyla:
   - Önce [`database/schema.sql`](database/schema.sql) dosyasını yapıştırıp çalıştırın.
   - Ardından [`database/rls-policies.sql`](database/rls-policies.sql) dosyasını yapıştırıp çalıştırın.
3. *(Önerilen)* E-posta onay linki beklemeden kayıt olmak için **Authentication → Providers → Email** altından **Confirm email** seçeneğini kapatabilirsiniz.
4. **Project Settings → API** ekranından `Project URL`, `anon/publishable` key ve *(arka plan cron alarmları için)* `service_role` key bilgilerini alın.

### 3. Ortam Değişkenlerini Ayarlayın (`.env`)
`.env.example` dosyasını `.env` olarak kopyalayın ve kendi anahtarlarınızı girin:

```env
# Supabase
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Yapay Zekâ Sağlayıcısı (groq | gemini | openrouter | mistral | openai_compatible)
AI_PROVIDER=groq
GROQ_API_KEY=your-groq-api-key
AI_MODEL=openai/gpt-oss-120b

# Google Gemini kullanmak isterseniz:
# AI_PROVIDER=gemini
# GEMINI_API_KEY=your-gemini-api-key
# AI_MODEL=gemini-2.0-flash

TIMEZONE=Europe/Istanbul
```

### 4. Uygulamayı Başlatın
Yerel sunucu ile çalıştırmak için:
```bash
node server.js
# veya: npm start
```
Tarayıcıda **`http://127.0.0.1:8888`** adresini açın.
*(Alternatif olarak Netlify CLI ile `npx netlify-cli dev` komutunu da kullanabilirsiniz.)*

---

## GitHub → Netlify Otomatik Yayınlama (Deployment)

1. Projeyi GitHub deponuza gönderin (`.gitignore` dosyası `.env`, `node_modules/` ve `database/local-db.json` dosyalarını otomatik hariç tutar):
   ```bash
   git init
   git add .
   git commit -m "Initial commit: ProjectVault"
   git branch -M main
   git remote add origin https://github.com/KULLANICI_ADINIZ/projectvault.git
   git push -u origin main
   ```
2. [Netlify](https://app.netlify.com/) panelinde **Add new site → Import an existing project → GitHub** üzerinden deponuzu seçin (`netlify.toml` ayarları otomatik okunur).
3. **Site configuration → Environment variables** bölümüne `.env` içindeki değişkenleri (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AI_PROVIDER`, `GROQ_API_KEY` veya `GEMINI_API_KEY`, `AI_MODEL`, `TIMEZONE`) ekleyin.
4. **Deploy site** ile yayınlayın.
5. Oluşan canlı adresinizi (`https://siteniz.netlify.app`) Supabase panelinde **Authentication → URL Configuration → Site URL** ve **Redirect URLs** (`https://siteniz.netlify.app/**`) alanlarına ekleyin.

---

## Güvenlik İlkeleri

- Gizli API anahtarları (`GROQ_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) asla frontend kodunda tutulmaz; yalnızca Netlify Environment Variables üzerinden sunucu tarafında okunur.
- Tüm AI ve doküman analiz uç noktaları `Authorization: Bearer <token>` başlığını Supabase Auth ile doğrular ve sorguları kullanıcıya özel RLS bağlamında çalıştırır.
- Tüm tablolarda `auth.uid() = user_id` Row Level Security (RLS) kuralları aktiftir; yüklenen dosyalar özel (`public = false`) bucket'larda saklanır.
- Sunucu tarafında dosya türü (13 izinli uzantı) ve boyut (maks. 25 MB) doğrulaması yapılır.
- Tüm dinamik DOM çıktıları `PV.utils.escapeHtml()` ile XSS saldırılarına karşı temizlenir.

---

## Doğrulama ve Testler

Projede tüm frontend ve backend JavaScript dosyalarının sözdizimi bütünlüğünü doğrulamak için:
```bash
npm run test:syntax
```

---

## Geliştirici & Lisans

Bu proje **Ahmet Gün** tarafından **Google Gemini** yapay zekâ desteği kullanılarak geliştirilmiştir.

Proje **MIT Lisansı** ile lisanslanmıştır. Detaylar için [`LICENSE`](LICENSE) dosyasına bakabilirsiniz.

