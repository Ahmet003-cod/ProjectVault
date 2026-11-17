'use strict';

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Cron-Secret',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    },
    body: JSON.stringify(payload)
  };
}

async function authenticateRequest(event) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Yerleşik yerel veritabanı motoru (database/local-db.json)
    const localDb = require('./local-db');
    const db = localDb.readDb();
    const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    let user = null;
    if (token.startsWith('local_')) {
      const uid = token.slice(6);
      user = (db.users || []).find((u) => u.id === uid) || null;
    }
    if (!user && db.users && db.users.length) {
      user = db.users[0];
    }
    if (!user) {
      const err = new Error('Yerel veritabanında kayıtlı kullanıcı bulunamadı.');
      err.statusCode = 401;
      throw err;
    }

    return {
      user,
      supabase: localDb.createServerLocalClient(),
      token: `local_${user.id}`,
      localMode: true
    };
  }

  const { createClient } = require('@supabase/supabase-js');
  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('Yetkisiz erişim: Geçerli oturum tokenı eksik.');
    err.statusCode = 401;
    throw err;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    const err = new Error('Yetkisiz erişim: Boş token.');
    err.statusCode = 401;
    throw err;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    const err = new Error('Oturum doğrulanamadı veya süresi dolmuş.');
    err.statusCode = 401;
    throw err;
  }

  return { user: data.user, supabase, token, localMode: false };
}

async function fetchUserContextData(supabase, userId, projectId = null) {
  if (!supabase || !userId) {
    return {
      contextText: JSON.stringify({
        note: 'Supabase henüz bağlanmadı (Önizleme Modu). Henüz kayıtlı proje verisi yok.',
        projects: [],
        tasks: [],
        journal_notes: [],
        technical_notes: [],
        documents: [],
        reminders: []
      }, null, 2),
      sources: ['Önizleme Modu (Supabase henüz bağlanmadı)'],
      counts: { projects: 0, tasks: 0, notes: 0, techNotes: 0, documents: 0 }
    };
  }
  const projQuery = supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('last_worked_at', { ascending: false });
  if (projectId) projQuery.eq('id', projectId);

  const taskQuery = supabase
    .from('tasks')
    .select('id,project_id,title,description,status,priority,due_date,completion_percentage')
    .eq('user_id', userId)
    .order('due_date', { ascending: true })
    .limit(50);
  if (projectId) taskQuery.eq('project_id', projectId);

  const notesQuery = supabase
    .from('project_notes')
    .select('id,project_id,note_date,title,content,tags')
    .eq('user_id', userId)
    .order('note_date', { ascending: false })
    .limit(40);
  if (projectId) notesQuery.eq('project_id', projectId);

  const techQuery = supabase
    .from('technical_notes')
    .select('id,project_id,title,note_type,content,is_resolved,tags')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (projectId) techQuery.eq('project_id', projectId);

  const docsQuery = supabase
    .from('documents')
    .select('id,project_id,file_name,file_type,category,description,ai_summary,extracted_text')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(25);
  if (projectId) docsQuery.eq('project_id', projectId);

  const remQuery = supabase
    .from('reminders')
    .select('id,project_id,title,next_remind_at,repeat_type,is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('next_remind_at', { ascending: true })
    .limit(20);
  if (projectId) remQuery.eq('project_id', projectId);

  const [projR, taskR, noteR, techR, docR, remR] = await Promise.all([
    projQuery,
    taskQuery,
    notesQuery,
    techQuery,
    docsQuery,
    remQuery
  ]);

  const projects = projR.data || [];
  const tasks = taskR.data || [];
  const notes = noteR.data || [];
  const techNotes = techR.data || [];
  const documents = docR.data || [];
  const reminders = remR.data || [];

  const sources = [];
  projects.forEach((p) => sources.push(`Proje: ${p.title}`));
  notes.slice(0, 8).forEach((n) => sources.push(`Günlük (${n.note_date}): ${n.title}`));
  techNotes.slice(0, 6).forEach((t) => sources.push(`Teknik Not: ${t.title}`));
  documents.slice(0, 6).forEach((d) => sources.push(`Doküman: ${d.file_name}`));

  const contextObject = {
    timezone: 'Europe/Istanbul',
    current_date: new Date().toISOString(),
    projects: projects.map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      status: p.status,
      priority: p.priority,
      progress: p.progress,
      technologies: p.technologies,
      short_description: p.short_description,
      purpose: p.purpose,
      origin_idea: p.origin_idea,
      motivation: p.motivation,
      work_done_summary: p.work_done_summary,
      technical_challenges: p.technical_challenges,
      resolved_issues: p.resolved_issues,
      unresolved_issues: p.unresolved_issues,
      last_stage: p.last_stage,
      next_steps: p.next_steps,
      last_worked_at: p.last_worked_at,
      target_end_date: p.target_end_date
    })),
    tasks,
    journal_notes: notes,
    technical_notes: techNotes,
    reminders,
    documents: documents.map((d) => ({
      id: d.id,
      project_id: d.project_id,
      file_name: d.file_name,
      file_type: d.file_type,
      category: d.category,
      description: d.description,
      ai_summary: d.ai_summary,
      extracted_text_preview: d.extracted_text ? d.extracted_text.slice(0, 2000) : null
    }))
  };

  return {
    contextText: JSON.stringify(contextObject, null, 2),
    sources: Array.from(new Set(sources)).slice(0, 12),
    counts: {
      projects: projects.length,
      tasks: tasks.length,
      notes: notes.length,
      techNotes: techNotes.length,
      documents: documents.length
    }
  };
}

module.exports = {
  jsonResponse,
  authenticateRequest,
  fetchUserContextData
};
