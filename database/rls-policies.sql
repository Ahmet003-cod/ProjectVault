-- ==============================================================================
-- ProjectVault - Row Level Security (RLS) & Storage Güvenlik Politikaları
-- Her kullanıcı yalnızca kendi verilerine ve dosyalarına erişebilir.
-- ==============================================================================

-- 1. TÜM TABLOLARDA RLS AKTİFLEŞTİRME
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. PROFILES POLİTİKALARI
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 3. PROJECTS POLİTİKALARI
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "projects_select_own" ON public.projects;
CREATE POLICY "projects_select_own" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
CREATE POLICY "projects_insert_own" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
CREATE POLICY "projects_update_own" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "projects_delete_own" ON public.projects;
CREATE POLICY "projects_delete_own" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 4. IDEAS POLİTİKALARI
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "ideas_select_own" ON public.ideas;
CREATE POLICY "ideas_select_own" ON public.ideas
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ideas_insert_own" ON public.ideas;
CREATE POLICY "ideas_insert_own" ON public.ideas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ideas_update_own" ON public.ideas;
CREATE POLICY "ideas_update_own" ON public.ideas
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ideas_delete_own" ON public.ideas;
CREATE POLICY "ideas_delete_own" ON public.ideas
  FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 5. TASKS POLİTİKALARI
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "tasks_select_own" ON public.tasks;
CREATE POLICY "tasks_select_own" ON public.tasks
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tasks_insert_own" ON public.tasks;
CREATE POLICY "tasks_insert_own" ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tasks_update_own" ON public.tasks;
CREATE POLICY "tasks_update_own" ON public.tasks
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tasks_delete_own" ON public.tasks;
CREATE POLICY "tasks_delete_own" ON public.tasks
  FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 6. REMINDERS POLİTİKALARI
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "reminders_select_own" ON public.reminders;
CREATE POLICY "reminders_select_own" ON public.reminders
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reminders_insert_own" ON public.reminders;
CREATE POLICY "reminders_insert_own" ON public.reminders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reminders_update_own" ON public.reminders;
CREATE POLICY "reminders_update_own" ON public.reminders
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reminders_delete_own" ON public.reminders;
CREATE POLICY "reminders_delete_own" ON public.reminders
  FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 7. DOCUMENTS POLİTİKALARI
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "documents_select_own" ON public.documents;
CREATE POLICY "documents_select_own" ON public.documents
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "documents_insert_own" ON public.documents;
CREATE POLICY "documents_insert_own" ON public.documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "documents_update_own" ON public.documents;
CREATE POLICY "documents_update_own" ON public.documents
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "documents_delete_own" ON public.documents;
CREATE POLICY "documents_delete_own" ON public.documents
  FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 8. PROJECT_NOTES POLİTİKALARI
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "project_notes_select_own" ON public.project_notes;
CREATE POLICY "project_notes_select_own" ON public.project_notes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "project_notes_insert_own" ON public.project_notes;
CREATE POLICY "project_notes_insert_own" ON public.project_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "project_notes_update_own" ON public.project_notes;
CREATE POLICY "project_notes_update_own" ON public.project_notes
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "project_notes_delete_own" ON public.project_notes;
CREATE POLICY "project_notes_delete_own" ON public.project_notes
  FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 9. TECHNICAL_NOTES POLİTİKALARI
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "technical_notes_select_own" ON public.technical_notes;
CREATE POLICY "technical_notes_select_own" ON public.technical_notes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "technical_notes_insert_own" ON public.technical_notes;
CREATE POLICY "technical_notes_insert_own" ON public.technical_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "technical_notes_update_own" ON public.technical_notes;
CREATE POLICY "technical_notes_update_own" ON public.technical_notes
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "technical_notes_delete_own" ON public.technical_notes;
CREATE POLICY "technical_notes_delete_own" ON public.technical_notes
  FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 10. AI_CONVERSATIONS POLİTİKALARI
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "ai_conversations_select_own" ON public.ai_conversations;
CREATE POLICY "ai_conversations_select_own" ON public.ai_conversations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_conversations_insert_own" ON public.ai_conversations;
CREATE POLICY "ai_conversations_insert_own" ON public.ai_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_conversations_update_own" ON public.ai_conversations;
CREATE POLICY "ai_conversations_update_own" ON public.ai_conversations
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_conversations_delete_own" ON public.ai_conversations;
CREATE POLICY "ai_conversations_delete_own" ON public.ai_conversations
  FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 11. AI_MESSAGES POLİTİKALARI
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "ai_messages_select_own" ON public.ai_messages;
CREATE POLICY "ai_messages_select_own" ON public.ai_messages
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_messages_insert_own" ON public.ai_messages;
CREATE POLICY "ai_messages_insert_own" ON public.ai_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_messages_update_own" ON public.ai_messages;
CREATE POLICY "ai_messages_update_own" ON public.ai_messages
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_messages_delete_own" ON public.ai_messages;
CREATE POLICY "ai_messages_delete_own" ON public.ai_messages
  FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 12. NOTIFICATIONS POLİTİKALARI
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert_own" ON public.notifications;
CREATE POLICY "notifications_insert_own" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 13. DOCUMENT_CHUNKS POLİTİKALARI (RAG Hazırlığı)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "document_chunks_select_own" ON public.document_chunks;
CREATE POLICY "document_chunks_select_own" ON public.document_chunks
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "document_chunks_insert_own" ON public.document_chunks;
CREATE POLICY "document_chunks_insert_own" ON public.document_chunks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "document_chunks_update_own" ON public.document_chunks;
CREATE POLICY "document_chunks_update_own" ON public.document_chunks
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "document_chunks_delete_own" ON public.document_chunks;
CREATE POLICY "document_chunks_delete_own" ON public.document_chunks
  FOR DELETE USING (auth.uid() = user_id);

-- ==============================================================================
-- 14. SUPABASE STORAGE BUCKET'LARI VE ERİŞİM POLİTİKALARI
-- Dosyalar herkese açık değildir; her kullanıcı yalnızca kendi klasörüne
-- (<user_id>/...) erişebilir.
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-documents',
  'project-documents',
  false,
  26214400, -- 25 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/csv'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-covers',
  'project-covers',
  false,
  5242880, -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage nesne politikaları: Klasör adının ilk parçası auth.uid() olmalıdır
DROP POLICY IF EXISTS "pv_storage_select_own" ON storage.objects;
CREATE POLICY "pv_storage_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('project-documents', 'project-covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "pv_storage_insert_own" ON storage.objects;
CREATE POLICY "pv_storage_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('project-documents', 'project-covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "pv_storage_update_own" ON storage.objects;
CREATE POLICY "pv_storage_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('project-documents', 'project-covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id IN ('project-documents', 'project-covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "pv_storage_delete_own" ON storage.objects;
CREATE POLICY "pv_storage_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('project-documents', 'project-covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
