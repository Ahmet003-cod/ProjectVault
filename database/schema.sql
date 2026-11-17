-- ==============================================================================
-- ProjectVault - Supabase PostgreSQL Veritabanı Şeması
-- Kişisel Proje Yönetimi, Bilgi Merkezi ve AI Hafıza Platformu
-- ==============================================================================

-- Gerekli eklentiler
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- ------------------------------------------------------------------------------
-- Yardımcı Tetikleyici Fonksiyon: updated_at Otomatik Güncelleme
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLOSU
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  username TEXT UNIQUE,
  avatar_url TEXT,
  theme_preference TEXT NOT NULL DEFAULT 'dark' CHECK (theme_preference IN ('dark', 'light')),
  timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
  notification_preferences JSONB NOT NULL DEFAULT '{"in_app": true, "web_push": true, "email": false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(LOWER(username));

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Yeni kullanıcı kaydında otomatik profil oluşturma
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_full_name TEXT;
BEGIN
  v_username := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'username', '')), '');
  v_full_name := TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.profiles (id, user_id, email, full_name, username)
  VALUES (NEW.id, NEW.id, NEW.email, v_full_name, v_username)
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = CASE WHEN public.profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
    username = COALESCE(public.profiles.username, EXCLUDED.username);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Kullanıcı adı ile giriş yapabilmek için güvenli e-posta sorgulama RPC fonksiyonu
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email
  FROM public.profiles
  WHERE LOWER(username) = LOWER(TRIM(p_username))
  LIMIT 1;

  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. PROJECTS TABLOSU (Proje Yönetimi + Proje Hafızası Alanları)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  short_description TEXT DEFAULT '',
  purpose TEXT DEFAULT '',
  origin_idea TEXT DEFAULT '',
  motivation TEXT DEFAULT '',
  technologies TEXT[] NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'Diğer' CHECK (category IN (
    'Yapay Zekâ',
    'Makine Öğrenmesi',
    'Derin Öğrenme',
    'Computer Vision',
    'Siber Güvenlik',
    'Agentic AI',
    'Web Geliştirme',
    'Mobil Uygulama',
    'Robotik',
    'Araştırma',
    'Diğer'
  )),
  status TEXT NOT NULL DEFAULT 'Fikir Aşamasında' CHECK (status IN (
    'Fikir Aşamasında',
    'Planlanıyor',
    'Geliştiriliyor',
    'Test Ediliyor',
    'Beklemede',
    'Tamamlandı',
    'Arşivlendi'
  )),
  priority TEXT NOT NULL DEFAULT 'Orta' CHECK (priority IN ('Düşük', 'Orta', 'Yüksek', 'Kritik')),
  start_date DATE,
  target_end_date DATE,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  tags TEXT[] NOT NULL DEFAULT '{}',
  cover_image_url TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  -- Proje Hafızası Modülü Alanları
  work_done_summary TEXT DEFAULT '',
  technical_challenges TEXT DEFAULT '',
  resolved_issues TEXT DEFAULT '',
  unresolved_issues TEXT DEFAULT '',
  last_stage TEXT DEFAULT '',
  next_steps TEXT DEFAULT '',
  roadmap_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_worked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_category ON public.projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_last_worked_at ON public.projects(last_worked_at DESC);

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 3. IDEAS TABLOSU (Fikir Havuzu)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Diğer' CHECK (category IN (
    'Yapay Zekâ',
    'Makine Öğrenmesi',
    'Derin Öğrenme',
    'Computer Vision',
    'Siber Güvenlik',
    'Agentic AI',
    'Web Geliştirme',
    'Mobil Uygulama',
    'Robotik',
    'Araştırma',
    'Diğer'
  )),
  priority TEXT NOT NULL DEFAULT 'Orta' CHECK (priority IN ('Düşük', 'Orta', 'Yüksek', 'Kritik')),
  estimated_difficulty TEXT NOT NULL DEFAULT 'Orta' CHECK (estimated_difficulty IN ('Kolay', 'Orta', 'Zor', 'Çok Zor')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  related_links TEXT[] NOT NULL DEFAULT '{}',
  ai_suggestions TEXT DEFAULT '',
  is_converted BOOLEAN NOT NULL DEFAULT false,
  converted_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ideas_user_id ON public.ideas(user_id);
CREATE INDEX IF NOT EXISTS idx_ideas_is_converted ON public.ideas(is_converted);

DROP TRIGGER IF EXISTS trg_ideas_updated_at ON public.ideas;
CREATE TRIGGER trg_ideas_updated_at
  BEFORE UPDATE ON public.ideas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 4. TASKS TABLOSU (Görev Yönetimi & Kanban)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  start_date DATE,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'Orta' CHECK (priority IN ('Düşük', 'Orta', 'Yüksek', 'Kritik')),
  status TEXT NOT NULL DEFAULT 'Yapılacak' CHECK (status IN ('Yapılacak', 'Devam Ediyor', 'Tamamlandı', 'Ertelendi')),
  completion_percentage INTEGER NOT NULL DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  position INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 5. REMINDERS TABLOSU (Alarm ve Hatırlatma Sistemi - Europe/Istanbul)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  remind_date DATE NOT NULL,
  remind_time TIME NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  next_remind_at TIMESTAMPTZ NOT NULL,
  repeat_type TEXT NOT NULL DEFAULT 'Tek seferlik' CHECK (repeat_type IN ('Tek seferlik', 'Günlük', 'Haftalık', 'Aylık')),
  notification_method TEXT NOT NULL DEFAULT 'Uygulama İçi' CHECK (notification_method IN ('Uygulama İçi', 'Web Push', 'E-posta', 'Tümü')),
  sound_type TEXT NOT NULL DEFAULT 'crystal',
  notification_status TEXT NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending', 'sent', 'completed', 'failed')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON public.reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_project_id ON public.reminders(project_id);
CREATE INDEX IF NOT EXISTS idx_reminders_next_remind ON public.reminders(is_active, next_remind_at);

DROP TRIGGER IF EXISTS trg_reminders_updated_at ON public.reminders;
CREATE TRIGGER trg_reminders_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tekrarlayan alarmların bir sonraki çalışma zamanını Europe/Istanbul diliminde hesapla
CREATE OR REPLACE FUNCTION public.calculate_next_reminder_time(current_remind TIMESTAMPTZ, r_type TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
AS $$
DECLARE
  local_ts TIMESTAMP;
BEGIN
  local_ts := current_remind AT TIME ZONE 'Europe/Istanbul';

  IF r_type = 'Günlük' THEN
    local_ts := local_ts + INTERVAL '1 day';
  ELSIF r_type = 'Haftalık' THEN
    local_ts := local_ts + INTERVAL '7 days';
  ELSIF r_type = 'Aylık' THEN
    local_ts := local_ts + INTERVAL '1 month';
  ELSE
    RETURN current_remind;
  END IF;

  RETURN local_ts AT TIME ZONE 'Europe/Istanbul';
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. DOCUMENTS TABLOSU (Doküman Yönetim Sistemi)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  file_size BIGINT NOT NULL DEFAULT 0,
  storage_bucket TEXT NOT NULL DEFAULT 'project-documents',
  storage_path TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Genel',
  extracted_text TEXT,
  ai_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON public.documents(project_id);

DROP TRIGGER IF EXISTS trg_documents_updated_at ON public.documents;
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 7. PROJECT_NOTES TABLOSU (Proje Günlüğü)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_notes_user_id ON public.project_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_project_id ON public.project_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_date ON public.project_notes(note_date DESC);

DROP TRIGGER IF EXISTS trg_project_notes_updated_at ON public.project_notes;
CREATE TRIGGER trg_project_notes_updated_at
  BEFORE UPDATE ON public.project_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 8. TECHNICAL_NOTES TABLOSU (Teknik Notlar & Sorun Çözüm Kayıtları)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.technical_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'Genel' CHECK (note_type IN ('Mimari', 'Sorun Çözümü', 'Kod Parçacığı', 'Araştırma', 'API / Yapılandırma', 'Genel')),
  content TEXT NOT NULL,
  code_snippet TEXT DEFAULT '',
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_technical_notes_user_id ON public.technical_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_technical_notes_project_id ON public.technical_notes(project_id);

DROP TRIGGER IF EXISTS trg_technical_notes_updated_at ON public.technical_notes;
CREATE TRIGGER trg_technical_notes_updated_at
  BEFORE UPDATE ON public.technical_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Günlük veya teknik not eklendiğinde/güncellendiğinde projenin son çalışma tarihini güncelle
CREATE OR REPLACE FUNCTION public.sync_project_last_worked_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    UPDATE public.projects
    SET last_worked_at = NOW(), updated_at = NOW()
    WHERE id = NEW.project_id AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_notes_sync_worked ON public.project_notes;
CREATE TRIGGER trg_project_notes_sync_worked
  AFTER INSERT OR UPDATE ON public.project_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_project_last_worked_at();

DROP TRIGGER IF EXISTS trg_technical_notes_sync_worked ON public.technical_notes;
CREATE TRIGGER trg_technical_notes_sync_worked
  AFTER INSERT OR UPDATE ON public.technical_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_project_last_worked_at();

-- ------------------------------------------------------------------------------
-- 9. AI_CONVERSATIONS TABLOSU
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Yeni Sohbet',
  provider TEXT NOT NULL DEFAULT 'gemini',
  model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON public.ai_conversations(user_id);

DROP TRIGGER IF EXISTS trg_ai_conversations_updated_at ON public.ai_conversations;
CREATE TRIGGER trg_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 10. AI_MESSAGES TABLOSU
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_user_id ON public.ai_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON public.ai_messages(conversation_id);

DROP TRIGGER IF EXISTS trg_ai_messages_updated_at ON public.ai_messages;
CREATE TRIGGER trg_ai_messages_updated_at
  BEFORE UPDATE ON public.ai_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 11. NOTIFICATIONS TABLOSU
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_id UUID REFERENCES public.reminders(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'reminder' CHECK (type IN ('reminder', 'system', 'task', 'ai')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  sent_via TEXT DEFAULT 'Uygulama İçi',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read);

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public.notifications;
CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 12. DOCUMENT_CHUNKS TABLOSU (Gelecek RAG & pgvector Mimarisi İçin Hazır)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  embedding vector(768),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_user_id ON public.document_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON public.document_chunks USING hnsw (embedding vector_cosine_ops);

DROP TRIGGER IF EXISTS trg_document_chunks_updated_at ON public.document_chunks;
CREATE TRIGGER trg_document_chunks_updated_at
  BEFORE UPDATE ON public.document_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
