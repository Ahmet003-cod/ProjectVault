/* ==========================================================================
   ProjectVault - Supabase İstemcisi, Ortak Uygulama Kabuğu (Sidebar/Header),
   Global Arama, Bildirim Merkezi, Tema Yönetimi ve Proje Hafızası Modalı
   ========================================================================== */

(function (global) {
  'use strict';

  const PV = (global.PV = global.PV || {});
  let supabaseInstance = null;
  let localDbInstance = null;
  let localDbCache = null;
  let currentUser = null;
  let currentProfile = null;
  let isLocalDbMode = false;

  const LOCAL_STORAGE_DB_KEY = 'pv_local_db_v1';
  const LOCAL_STORAGE_SESSION_KEY = 'pv_local_session_v1';

  function generateUuid() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function createDefaultClientDb() {
    return {
      users: [],
      profiles: [],
      projects: [],
      ideas: [],
      tasks: [],
      reminders: [],
      documents: [],
      project_notes: [],
      technical_notes: [],
      ai_conversations: [],
      ai_messages: [],
      notifications: [],
      storage_objects: {}
    };
  }

  async function loadLocalDbState() {
    if (localDbCache) return localDbCache;
    try {
      const res = await fetch('/api/local-db', { cache: 'no-store' });
      if (res.ok) {
        localDbCache = await res.json();
        localStorage.setItem(LOCAL_STORAGE_DB_KEY, JSON.stringify(localDbCache));
        return localDbCache;
      }
    } catch (_) {
      // Sunucu yoksa localStorage yedeğine geç
    }
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_DB_KEY);
      if (saved) {
        localDbCache = JSON.parse(saved);
        return localDbCache;
      }
    } catch (_) {}
    localDbCache = createDefaultClientDb();
    return localDbCache;
  }

  async function persistLocalDbState(db) {
    localDbCache = db;
    try {
      localStorage.setItem(LOCAL_STORAGE_DB_KEY, JSON.stringify(db));
    } catch (_) {}
    try {
      await fetch('/api/local-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(db)
      });
    } catch (_) {}
  }

  function toComparableValue(v) {
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(v)) {
      const ms = Date.parse(v);
      if (!Number.isNaN(ms)) return ms;
    }
    return v;
  }

  function applyLocalFilters(rows, filters) {
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

  async function createLocalDatabaseClient() {
    await loadLocalDbState();

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

      const execute = async () => {
        const db = await loadLocalDbState();
        if (!Array.isArray(db[state.table])) db[state.table] = [];
        const nowIso = new Date().toISOString();

        if (state.op === 'select') {
          let rows = applyLocalFilters(db[state.table], state.filters).map((r) => ({ ...r }));

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
          const inserted = items.map((item) => {
            const base = {
              id: item.id || generateUuid(),
              created_at: item.created_at || nowIso,
              updated_at: item.updated_at || nowIso,
              ...item
            };
            if (state.table === 'projects') {
              base.progress = base.progress ?? 0;
              base.is_favorite = Boolean(base.is_favorite);
              base.is_archived = Boolean(base.is_archived);
              base.technologies = base.technologies || [];
              base.tags = base.tags || [];
              base.last_worked_at = base.last_worked_at || nowIso;
            }
            return base;
          });

          db[state.table].push(...inserted);

          if (state.table === 'project_notes' || state.table === 'technical_notes') {
            inserted.forEach((n) => {
              const proj = (db.projects || []).find((p) => p.id === n.project_id && p.user_id === n.user_id);
              if (proj) proj.last_worked_at = nowIso;
            });
          }

          await persistLocalDbState(db);
          if (state.singleMode) return { data: inserted[0] || null, error: null };
          return { data: inserted, error: null };
        }

        if (state.op === 'update') {
          const updated = [];
          db[state.table] = db[state.table].map((row) => {
            if (applyLocalFilters([row], state.filters).length) {
              const next = { ...row, ...state.payload, updated_at: nowIso };
              updated.push(next);
              return next;
            }
            return row;
          });
          await persistLocalDbState(db);
          if (state.singleMode) return { data: updated[0] || null, error: null };
          return { data: updated, error: null };
        }

        if (state.op === 'delete') {
          const deleted = applyLocalFilters(db[state.table], state.filters);
          const delIds = new Set(deleted.map((r) => r.id));
          db[state.table] = db[state.table].filter((r) => !delIds.has(r.id));

          if (state.table === 'projects' && delIds.size) {
            ['tasks', 'project_notes', 'technical_notes'].forEach((t) => {
              if (Array.isArray(db[t])) db[t] = db[t].filter((r) => !delIds.has(r.project_id));
            });
            ['reminders', 'documents', 'notifications', 'ai_conversations'].forEach((t) => {
              if (Array.isArray(db[t])) {
                db[t] = db[t].map((r) => (delIds.has(r.project_id) ? { ...r, project_id: null } : r));
              }
            });
            if (Array.isArray(db.ideas)) {
              db.ideas = db.ideas.map((i) => (delIds.has(i.converted_project_id) ? { ...i, converted_project_id: null } : i));
            }
          }

          if (state.table === 'ai_conversations' && delIds.size && Array.isArray(db.ai_messages)) {
            db.ai_messages = db.ai_messages.filter((m) => !delIds.has(m.conversation_id));
          }

          await persistLocalDbState(db);
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
        single: () => { state.singleMode = 'single'; return execute(); },
        maybeSingle: () => { state.singleMode = 'maybeSingle'; return execute(); },
        then: (resolve, reject) => execute().then(resolve, reject),
        catch: (reject) => execute().catch(reject)
      };
      return chain;
    };

    const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Dosya okunamadı.'));
      reader.readAsDataURL(file);
    });

    const getStoredSession = () => {
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (_) {
        return null;
      }
    };

    return {
      from: (table) => ({
        select: (s) => makeQuery(table, 'select').select(s),
        insert: (data) => makeQuery(table, 'insert', data),
        update: (data) => makeQuery(table, 'update', data),
        delete: () => makeQuery(table, 'delete')
      }),
      rpc: async (fnName, args) => {
        if (fnName === 'get_email_by_username') {
          const db = await loadLocalDbState();
          const target = String(args?.p_username || '').trim().toLowerCase();
          const prof = (db.profiles || []).find((p) => String(p.username || '').toLowerCase() === target);
          return { data: prof ? prof.email : null, error: null };
        }
        return { data: null, error: { message: `Bilinmeyen RPC: ${fnName}` } };
      },
      storage: {
        from: (bucket) => ({
          upload: async (filePath, file) => {
            const db = await loadLocalDbState();
            db.storage_objects = db.storage_objects || {};
            db.storage_objects[`${bucket}/${filePath}`] = await readFileAsDataUrl(file);
            await persistLocalDbState(db);
            return { data: { path: filePath }, error: null };
          },
          createSignedUrl: async (filePath) => {
            const db = await loadLocalDbState();
            const url = db.storage_objects?.[`${bucket}/${filePath}`] || null;
            if (!url) return { data: null, error: { message: 'Dosya depolama alanında bulunamadı.' } };
            return { data: { signedUrl: url }, error: null };
          },
          remove: async (paths) => {
            const db = await loadLocalDbState();
            db.storage_objects = db.storage_objects || {};
            (paths || []).forEach((p) => { delete db.storage_objects[`${bucket}/${p}`]; });
            await persistLocalDbState(db);
            return { data: paths, error: null };
          }
        })
      },
      auth: {
        getSession: async () => {
          const sess = getStoredSession();
          if (!sess || !sess.user) return { data: { session: null }, error: null };
          const db = await loadLocalDbState();
          const exists = (db.users || []).find((u) => u.id === sess.user.id);
          if (!exists) {
            localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
            return { data: { session: null }, error: null };
          }
          return { data: { session: sess }, error: null };
        },
        getUser: async () => {
          const sess = getStoredSession();
          if (!sess || !sess.user) return { data: { user: null }, error: { message: 'Aktif oturum yok.' } };
          const db = await loadLocalDbState();
          const exists = (db.users || []).find((u) => u.id === sess.user.id);
          if (!exists) {
            localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
            return { data: { user: null }, error: { message: 'Kullanıcı hesabı silinmiş.' } };
          }
          return { data: { user: sess.user }, error: null };
        },
        signInWithPassword: async ({ email, password }) => {
          const db = await loadLocalDbState();
          const cleanEmail = String(email || '').trim().toLowerCase();
          const found = (db.users || []).find(
            (u) => u.email.toLowerCase() === cleanEmail && u.password === password
          );
          if (!found) {
            return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
          }
          const publicUser = { id: found.id, email: found.email, user_metadata: found.user_metadata || {} };
          const session = { access_token: `local_${found.id}`, user: publicUser };
          localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(session));
          return { data: { user: publicUser, session }, error: null };
        },
        signUp: async ({ email, password, options }) => {
          const db = await loadLocalDbState();
          const cleanEmail = String(email || '').trim().toLowerCase();
          const fullName = String(options?.data?.full_name || cleanEmail.split('@')[0]).trim();
          const username = options?.data?.username ? String(options.data.username).trim() : null;

          if ((db.users || []).some((u) => u.email.toLowerCase() === cleanEmail)) {
            return { data: { user: null, session: null }, error: { message: 'Bu e-posta adresi zaten kayıtlı.' } };
          }
          if (username && (db.profiles || []).some((p) => String(p.username || '').toLowerCase() === username.toLowerCase())) {
            return { data: { user: null, session: null }, error: { message: 'Bu kullanıcı adı zaten alınmış.' } };
          }

          const newId = generateUuid();
          const nowIso = new Date().toISOString();
          const newUser = {
            id: newId,
            email: cleanEmail,
            password,
            user_metadata: { full_name: fullName, username },
            created_at: nowIso
          };
          const newProfile = {
            id: newId,
            user_id: newId,
            email: cleanEmail,
            full_name: fullName,
            username,
            avatar_url: null,
            theme_preference: getSavedTheme(),
            timezone: 'Europe/Istanbul',
            notification_preferences: { in_app: true, web_push: true, email: false },
            created_at: nowIso,
            updated_at: nowIso
          };

          db.users = db.users || [];
          db.profiles = db.profiles || [];
          db.users.push(newUser);
          db.profiles.push(newProfile);
          await persistLocalDbState(db);

          const publicUser = { id: newId, email: cleanEmail, user_metadata: newUser.user_metadata };
          const session = { access_token: `local_${newId}`, user: publicUser };
          localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(session));
          return { data: { user: publicUser, session }, error: null };
        },
        signOut: async () => {
          localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
          return { error: null };
        },
        updateUser: async ({ password }) => {
          const sess = getStoredSession();
          if (!sess?.user) return { data: null, error: { message: 'Aktif oturum bulunamadı.' } };
          const db = await loadLocalDbState();
          const u = (db.users || []).find((x) => x.id === sess.user.id);
          if (!u) return { data: null, error: { message: 'Kullanıcı bulunamadı.' } };
          if (password) u.password = password;
          await persistLocalDbState(db);
          return { data: { user: sess.user }, error: null };
        },
        resetPasswordForEmail: async () => {
          return {
            data: null,
            error: { message: 'Yerleşik yerel modda şifre sıfırlama e-postası gönderilmez; giriş sonrası Ayarlar sayfasından şifrenizi değiştirebilirsiniz.' }
          };
        },
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
      }
    };
  }

  function isSupabaseConfigured() {
    return Boolean(
      PV.config.SUPABASE_URL &&
      PV.config.SUPABASE_ANON_KEY &&
      PV.config.SUPABASE_URL.startsWith('http') &&
      !PV.config.SUPABASE_URL.includes('your-project-id')
    );
  }

  async function initSupabase() {
    await PV.loadRuntimePublicConfig();
    if (!isSupabaseConfigured()) {
      isLocalDbMode = true;
      if (!localDbInstance) {
        localDbInstance = await createLocalDatabaseClient();
      }
      return localDbInstance;
    }

    isLocalDbMode = false;
    if (!global.supabase || typeof global.supabase.createClient !== 'function') {
      console.error('Supabase JS CDN yüklenemedi.');
      return null;
    }
    if (!supabaseInstance) {
      supabaseInstance = global.supabase.createClient(
        PV.config.SUPABASE_URL,
        PV.config.SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      );
    }
    return supabaseInstance;
  }

  function getSupabaseClient() {
    return supabaseInstance || localDbInstance;
  }

  function saveSupabaseCredentials(url, anonKey) {
    const cleanUrl = String(url || '').trim().replace(/\/+$/, '');
    const cleanKey = String(anonKey || '').trim();
    if (!cleanUrl || !cleanKey) {
      throw new Error('Supabase URL ve Anon Key boş bırakılamaz.');
    }
    localStorage.setItem('pv_supabase_url', cleanUrl);
    localStorage.setItem('pv_supabase_anon_key', cleanKey);
    PV.config.SUPABASE_URL = cleanUrl;
    PV.config.SUPABASE_ANON_KEY = cleanKey;
    supabaseInstance = null;
  }

  function clearSupabaseCredentials() {
    localStorage.removeItem('pv_supabase_url');
    localStorage.removeItem('pv_supabase_anon_key');
    PV.config.SUPABASE_URL = '';
    PV.config.SUPABASE_ANON_KEY = '';
    supabaseInstance = null;
  }

  /* ------------------------------------------------------------------------
     Tema Yönetimi (Varsayılan: Koyu Tema)
     ------------------------------------------------------------------------ */
  function getSavedTheme() {
    return localStorage.getItem('pv_theme') || 'dark';
  }

  function applyTheme(theme) {
    const t = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('pv_theme', t);
    const themeBtns = document.querySelectorAll('[data-theme-toggle]');
    themeBtns.forEach((btn) => {
      btn.innerHTML = t === 'dark'
        ? '<i data-lucide="sun" width="18" height="18"></i>'
        : '<i data-lucide="moon" width="18" height="18"></i>';
      btn.setAttribute('title', t === 'dark' ? 'Açık Temaya Geç' : 'Koyu Temaya Geç');
    });
    PV.utils.renderIcons();
  }

  async function toggleTheme() {
    const next = getSavedTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    if (supabaseInstance && currentUser) {
      await supabaseInstance
        .from('profiles')
        .update({ theme_preference: next })
        .eq('user_id', currentUser.id);
    }
  }

  /* ------------------------------------------------------------------------
     Toast Bildirim Sistemi
     ------------------------------------------------------------------------ */
  function ensureToastContainer() {
    let container = document.getElementById('pv-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'pv-toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast(message, type = 'info', duration = 4200) {
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const iconName =
      type === 'success' ? 'check-circle-2' :
      type === 'error' ? 'alert-octagon' :
      type === 'warning' ? 'alert-triangle' : 'info';

    toast.innerHTML = `
      <i data-lucide="${iconName}" width="18" height="18" style="flex-shrink:0;margin-top:2px;"></i>
      <div style="flex:1;">${PV.utils.escapeHtml(message)}</div>
      <button type="button" class="btn-ghost btn-icon btn-sm" aria-label="Kapat" style="width:24px;height:24px;">
        <i data-lucide="x" width="14" height="14"></i>
      </button>
    `;
    toast.querySelector('button').addEventListener('click', () => toast.remove());
    container.appendChild(toast);
    PV.utils.renderIcons();
    if (duration > 0) {
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, duration);
    }
  }

  /* ------------------------------------------------------------------------
     Modal ve Onay Penceresi Yardımcıları
     ------------------------------------------------------------------------ */
  function openModal(id) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (!el) return;
    el.classList.add('open');
    PV.utils.renderIcons();
  }

  function closeModal(id) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (!el) return;
    el.classList.remove('open');
  }

  function confirmDialog({ title = 'Emin misiniz?', message = 'Bu işlem geri alınamaz.', confirmText = 'Evet, Sil', cancelText = 'İptal', danger = true } = {}) {
    return new Promise((resolve) => {
      let backdrop = document.getElementById('pv-confirm-modal');
      if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'pv-confirm-modal';
        backdrop.className = 'modal-backdrop';
        backdrop.innerHTML = `
          <div class="modal modal-sm">
            <div class="modal-header">
              <h3 class="modal-title" id="pv-confirm-title"></h3>
              <button type="button" class="btn-ghost btn-icon btn-sm" data-confirm-cancel><i data-lucide="x" width="16" height="16"></i></button>
            </div>
            <div class="modal-body">
              <p id="pv-confirm-message" class="text-secondary"></p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-confirm-cancel id="pv-confirm-cancel-btn"></button>
              <button type="button" class="btn" id="pv-confirm-ok-btn"></button>
            </div>
          </div>
        `;
        document.body.appendChild(backdrop);
      }

      document.getElementById('pv-confirm-title').textContent = title;
      document.getElementById('pv-confirm-message').textContent = message;
      document.getElementById('pv-confirm-cancel-btn').textContent = cancelText;
      const okBtn = document.getElementById('pv-confirm-ok-btn');
      okBtn.textContent = confirmText;
      okBtn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;

      const cleanup = (result) => {
        closeModal(backdrop);
        okBtn.onclick = null;
        backdrop.querySelectorAll('[data-confirm-cancel]').forEach((b) => { b.onclick = null; });
        resolve(result);
      };

      okBtn.onclick = () => cleanup(true);
      backdrop.querySelectorAll('[data-confirm-cancel]').forEach((b) => {
        b.onclick = () => cleanup(false);
      });
      openModal(backdrop);
    });
  }

  /* ------------------------------------------------------------------------
     Supabase Bağlantı Ayar Modalı (Kurulum Kolaylığı İçin)
     ------------------------------------------------------------------------ */
  function openSupabaseConfigModal(onSaved) {
    let modal = document.getElementById('pv-supabase-config-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pv-supabase-config-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal modal-sm">
          <div class="modal-header">
            <h3 class="modal-title"><i data-lucide="database" width="18" height="18"></i> Supabase Bağlantısı</h3>
            <button type="button" class="btn-ghost btn-icon btn-sm" data-close-sb-modal><i data-lucide="x" width="16" height="16"></i></button>
          </div>
          <form id="pv-sb-config-form">
            <div class="modal-body">
              <div class="alert alert-info mb-4">
                <i data-lucide="shield-check" width="18" height="18" style="flex-shrink:0;"></i>
                <div>Yalnızca Supabase <strong>Project URL</strong> ve <strong>Anon (Public) Key</strong> bilgilerini girin. Service Role ve Gemini anahtarları sunucu tarafında (Netlify) tutulur.</div>
              </div>
              <div class="form-group">
                <label class="form-label" for="pv-cfg-sb-url">Supabase Project URL <span class="required">*</span></label>
                <input type="url" id="pv-cfg-sb-url" class="form-control" placeholder="https://xxxx.supabase.co" required>
              </div>
              <div class="form-group">
                <label class="form-label" for="pv-cfg-sb-key">Supabase Anon Key <span class="required">*</span></label>
                <input type="text" id="pv-cfg-sb-key" class="form-control" placeholder="eyJhbGciOiJIUzI1NiIs..." required>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-close-sb-modal>Kapat</button>
              <button type="submit" class="btn btn-primary">Kaydet ve Bağlan</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelectorAll('[data-close-sb-modal]').forEach((b) => {
        b.addEventListener('click', () => closeModal(modal));
      });
    }

    // Mevcut URL ve API anahtarını güvenlik için form alanlarına önceden doldurma
    document.getElementById('pv-cfg-sb-url').value = '';
    document.getElementById('pv-cfg-sb-key').value = '';

    const form = document.getElementById('pv-sb-config-form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        saveSupabaseCredentials(
          document.getElementById('pv-cfg-sb-url').value,
          document.getElementById('pv-cfg-sb-key').value
        );
        await initSupabase();
        closeModal(modal);
        showToast('Supabase bağlantısı kaydedildi.', 'success');
        if (typeof onSaved === 'function') {
          onSaved();
        } else {
          window.location.reload();
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    };

    openModal(modal);
  }

  /* ------------------------------------------------------------------------
     "Bu Projeyi Bana Hatırlat" Ortak Proje Hafızası Modalı (8 Zorunlu Soru)
     ------------------------------------------------------------------------ */
  async function openProjectMemoryReminderModal(projectId) {
    const sb = getSupabaseClient();
    if (!sb || !currentUser || !projectId) return;

    let modal = document.getElementById('pv-memory-reminder-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pv-memory-reminder-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal modal-xl">
          <div class="modal-header">
            <h3 class="modal-title"><i data-lucide="brain" width="20" height="20" class="text-cyan"></i> <span id="pv-mem-modal-title">Proje Hafızası Hatırlatması</span></h3>
            <button type="button" class="btn-ghost btn-icon btn-sm" id="pv-mem-modal-close"><i data-lucide="x" width="18" height="18"></i></button>
          </div>
          <div class="modal-body" id="pv-mem-modal-body"></div>
          <div class="modal-footer" id="pv-mem-modal-footer"></div>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById('pv-mem-modal-close').addEventListener('click', () => closeModal(modal));
    }

    const bodyEl = document.getElementById('pv-mem-modal-body');
    const footerEl = document.getElementById('pv-mem-modal-footer');
    bodyEl.innerHTML = `<div class="flex items-center gap-3"><div class="spinner"></div><span>Proje hafızası veritabanından yükleniyor...</span></div>`;
    footerEl.innerHTML = '';
    openModal(modal);

    try {
      const [projRes, notesRes, techRes, tasksRes] = await Promise.all([
        sb.from('projects').select('*').eq('id', projectId).eq('user_id', currentUser.id).single(),
        sb.from('project_notes').select('*').eq('project_id', projectId).eq('user_id', currentUser.id).order('note_date', { ascending: false }).limit(5),
        sb.from('technical_notes').select('*').eq('project_id', projectId).eq('user_id', currentUser.id).order('created_at', { ascending: false }),
        sb.from('tasks').select('*').eq('project_id', projectId).eq('user_id', currentUser.id).order('created_at', { ascending: false })
      ]);

      if (projRes.error || !projRes.data) {
        throw new Error('Proje kaydı bulunamadı.');
      }

      const p = projRes.data;
      const notes = notesRes.data || [];
      const techNotes = techRes.data || [];
      const tasks = tasksRes.data || [];

      const unresolvedTech = techNotes.filter((n) => !n.is_resolved).map((n) => `• ${n.title}: ${n.content}`);
      const pendingTasks = tasks.filter((t) => t.status !== 'Tamamlandı').map((t) => `• [${t.status}] ${t.title}${t.due_date ? ' (Son: ' + PV.utils.formatDate(t.due_date) + ')' : ''}`);
      const latestNote = notes[0];
      const lastWorkedDate = latestNote ? latestNote.note_date : p.last_worked_at;
      const daysAgo = PV.utils.daysSince(lastWorkedDate);

      document.getElementById('pv-mem-modal-title').textContent = `${p.title} — Proje Hafızası`;

      const safeText = (val, fallback = 'Veritabanında bu alan için henüz kayıt bulunmuyor.') =>
        val && String(val).trim() ? PV.utils.escapeHtml(val) : `<span class="text-muted">${fallback}</span>`;

      const workDoneCombined = [
        p.work_done_summary,
        notes.length ? `\nSon Günlük Kayıtları:\n${notes.map((n) => `• ${PV.utils.formatDate(n.note_date)} - ${n.title}: ${n.content}`).join('\n')}` : ''
      ].filter(Boolean).join('\n');

      const unresolvedCombined = [
        p.unresolved_issues,
        unresolvedTech.length ? `\nÇözülmemiş Teknik Notlar:\n${unresolvedTech.join('\n')}` : ''
      ].filter(Boolean).join('\n');

      const nextStepCombined = [
        p.next_steps,
        pendingTasks.length ? `\nBekleyen Görevler:\n${pendingTasks.slice(0, 5).join('\n')}` : ''
      ].filter(Boolean).join('\n');

      bodyEl.innerHTML = `
        <div class="alert alert-info mb-4">
          <i data-lucide="database" width="18" height="18" style="flex-shrink:0;"></i>
          <div>Bu özet, <strong>tahmin üretmeden</strong> yalnızca veritabanındaki gerçek proje kayıtları, günlükler, teknik notlar ve görevlerden derlenmiştir.</div>
        </div>
        <div class="memory-grid">
          <div class="memory-block">
            <div class="memory-block-title"><i data-lucide="target" width="15" height="15"></i> 1. Projenin amacı nedir?</div>
            <div class="memory-block-content">${safeText(p.purpose || p.short_description)}</div>
          </div>
          <div class="memory-block">
            <div class="memory-block-title"><i data-lucide="lightbulb" width="15" height="15"></i> 2. Proje neden oluşturulmuştu?</div>
            <div class="memory-block-content">${safeText([p.origin_idea, p.motivation].filter(Boolean).join('\n\n'))}</div>
          </div>
          <div class="memory-block">
            <div class="memory-block-title"><i data-lucide="cpu" width="15" height="15"></i> 3. Hangi teknolojiler kullanılacaktı?</div>
            <div class="memory-block-content">${(p.technologies && p.technologies.length) ? `<div class="chip-list">${p.technologies.map((t) => `<span class="tech-chip">${PV.utils.escapeHtml(t)}</span>`).join('')}</div>` : '<span class="text-muted">Teknoloji kaydı girilmemiş.</span>'}</div>
          </div>
          <div class="memory-block">
            <div class="memory-block-title"><i data-lucide="history" width="15" height="15"></i> 5. Son çalışma tarihi nedir?</div>
            <div class="memory-block-content"><strong>${PV.utils.formatDateTime(lastWorkedDate)}</strong>${daysAgo !== null ? ` <span class="badge badge-cyan">${daysAgo} gün önce</span>` : ''}</div>
          </div>
          <div class="memory-block">
            <div class="memory-block-title"><i data-lucide="check-square" width="15" height="15"></i> 4. Şimdiye kadar neler yapıldı?</div>
            <div class="memory-block-content">${safeText(workDoneCombined)}</div>
          </div>
          <div class="memory-block">
            <div class="memory-block-title"><i data-lucide="map-pin" width="15" height="15"></i> 6. En son nerede kalındı?</div>
            <div class="memory-block-content">${safeText(p.last_stage || (latestNote ? `${latestNote.title}: ${latestNote.content}` : ''))}</div>
          </div>
          <div class="memory-block">
            <div class="memory-block-title"><i data-lucide="alert-circle" width="15" height="15"></i> 7. Hangi sorunlar hâlâ çözülmedi?</div>
            <div class="memory-block-content">${safeText(unresolvedCombined, 'Kaydedilmiş açık/çözülmemiş sorun bulunmuyor.')}</div>
          </div>
          <div class="memory-block">
            <div class="memory-block-title"><i data-lucide="arrow-right-circle" width="15" height="15"></i> 8. Bir sonraki mantıklı adım nedir?</div>
            <div class="memory-block-content">${safeText(nextStepCombined)}</div>
          </div>
        </div>
        <div id="pv-mem-ai-box" class="mt-4 hidden"></div>
      `;

      footerEl.innerHTML = `
        <button type="button" class="btn btn-memory" id="pv-mem-ask-ai-btn">
          <i data-lucide="sparkles" width="16" height="16"></i> AI ile Hatırlatma Özeti Oluştur
        </button>
        <a href="project-detail.html?id=${encodeURIComponent(p.id)}" class="btn btn-primary">
          <i data-lucide="external-link" width="16" height="16"></i> Proje Detayına Git
        </a>
      `;

      document.getElementById('pv-mem-ask-ai-btn').addEventListener('click', async () => {
        const aiBox = document.getElementById('pv-mem-ai-box');
        aiBox.classList.remove('hidden');
        aiBox.innerHTML = `<div class="alert alert-info"><div class="spinner"></div><span>ProjectVault AI kayıtları analiz ediyor...</span></div>`;
        try {
          const { data: sess } = await sb.auth.getSession();
          const token = sess?.session?.access_token;
          const res = await fetch('/.netlify/functions/ai-summary', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ mode: 'project_reminder', projectId: p.id })
          });
          const result = await res.json();
          if (!res.ok) {
            throw new Error(result.message || result.error || 'AI servisi şu anda kullanılamıyor.');
          }
          aiBox.innerHTML = `
            <div class="card" style="border-color: rgba(6,182,212,0.4);">
              <div class="card-header">
                <span class="card-title"><i data-lucide="sparkles" width="16" height="16" class="text-cyan"></i> ProjectVault AI Hafıza Özeti</span>
              </div>
              <div style="white-space:pre-wrap;font-size:0.9rem;">${PV.utils.escapeHtml(result.content)}</div>
            </div>
          `;
          PV.utils.renderIcons();
        } catch (err) {
          aiBox.innerHTML = `<div class="alert alert-warning"><i data-lucide="alert-triangle" width="18" height="18"></i><div>${PV.utils.escapeHtml(err.message)}</div></div>`;
          PV.utils.renderIcons();
        }
      });

      PV.utils.renderIcons();
    } catch (err) {
      bodyEl.innerHTML = `<div class="alert alert-danger">${PV.utils.escapeHtml(err.message)}</div>`;
    }
  }

  /* ------------------------------------------------------------------------
     Global Arama Modalı (Projeler, Fikirler, Görevler, Günlükler, Dokümanlar)
     ------------------------------------------------------------------------ */
  function buildGlobalSearchModal() {
    if (document.getElementById('pv-global-search-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'pv-global-search-modal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal modal-lg">
        <div class="modal-header">
          <h3 class="modal-title"><i data-lucide="search" width="18" height="18"></i> Global Arama</h3>
          <button type="button" class="btn-ghost btn-icon btn-sm" id="pv-gs-close"><i data-lucide="x" width="16" height="16"></i></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <input type="search" id="pv-gs-input" class="form-control" placeholder="Projeler, fikirler, görevler, günlük notları ve dokümanlarda ara..." autocomplete="off">
          </div>
          <div class="form-row mb-4" style="grid-template-columns: repeat(4, minmax(0,1fr)); gap: 0.6rem;">
            <select id="pv-gs-cat" class="form-control"></select>
            <select id="pv-gs-status" class="form-control"></select>
            <select id="pv-gs-priority" class="form-control"></select>
            <input type="date" id="pv-gs-date" class="form-control" title="Tarihten itibaren">
          </div>
          <div id="pv-gs-results" class="flex-col gap-2">
            <p class="text-muted text-center" style="padding:1.5rem 0;">Aramak istediğiniz kelimeyi yazın veya filtre seçin.</p>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    PV.utils.populateSelect(document.getElementById('pv-gs-cat'), PV.config.PROJECT_CATEGORIES, 'Tüm Kategoriler');
    PV.utils.populateSelect(document.getElementById('pv-gs-status'), [...PV.config.PROJECT_STATUSES, ...PV.config.TASK_STATUSES], 'Tüm Durumlar');
    PV.utils.populateSelect(document.getElementById('pv-gs-priority'), PV.config.PRIORITIES, 'Tüm Öncelikler');

    document.getElementById('pv-gs-close').addEventListener('click', () => closeModal(modal));
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });

    const runSearch = PV.utils.debounce(async () => {
      const sb = getSupabaseClient();
      const resultsEl = document.getElementById('pv-gs-results');
      if (!sb || !currentUser) return;

      const q = document.getElementById('pv-gs-input').value.trim().toLowerCase();
      const cat = document.getElementById('pv-gs-cat').value;
      const status = document.getElementById('pv-gs-status').value;
      const priority = document.getElementById('pv-gs-priority').value;
      const dateFrom = document.getElementById('pv-gs-date').value;

      if (!q && !cat && !status && !priority && !dateFrom) {
        resultsEl.innerHTML = `<p class="text-muted text-center" style="padding:1.5rem 0;">Aramak istediğiniz kelimeyi yazın veya filtre seçin.</p>`;
        return;
      }

      resultsEl.innerHTML = `<div class="flex items-center justify-center gap-2" style="padding:1.5rem;"><div class="spinner"></div><span>Aranıyor...</span></div>`;

      try {
        const [projR, ideaR, taskR, noteR, docR] = await Promise.all([
          sb.from('projects').select('id,title,short_description,category,status,priority,created_at').eq('user_id', currentUser.id),
          sb.from('ideas').select('id,title,description,category,priority,created_at').eq('user_id', currentUser.id),
          sb.from('tasks').select('id,title,description,status,priority,due_date,project_id,created_at').eq('user_id', currentUser.id),
          sb.from('project_notes').select('id,title,content,note_date,project_id,created_at').eq('user_id', currentUser.id),
          sb.from('documents').select('id,file_name,description,category,project_id,created_at').eq('user_id', currentUser.id)
        ]);

        const hits = [];
        const matchDate = (dt) => !dateFrom || (dt && String(dt).slice(0, 10) >= dateFrom);

        (projR.data || []).forEach((p) => {
          if (cat && p.category !== cat) return;
          if (status && p.status !== status) return;
          if (priority && p.priority !== priority) return;
          if (!matchDate(p.created_at)) return;
          if (!q || `${p.title} ${p.short_description}`.toLowerCase().includes(q)) {
            hits.push({ type: 'Proje', title: p.title, meta: `${p.category} • ${p.status}`, href: `project-detail.html?id=${p.id}`, badge: 'badge-purple' });
          }
        });

        (ideaR.data || []).forEach((i) => {
          if (cat && i.category !== cat) return;
          if (priority && i.priority !== priority) return;
          if (status) return;
          if (!matchDate(i.created_at)) return;
          if (!q || `${i.title} ${i.description}`.toLowerCase().includes(q)) {
            hits.push({ type: 'Fikir', title: i.title, meta: `${i.category} • ${i.priority}`, href: 'ideas.html', badge: 'badge-cyan' });
          }
        });

        (taskR.data || []).forEach((t) => {
          if (cat) return;
          if (status && t.status !== status) return;
          if (priority && t.priority !== priority) return;
          if (!matchDate(t.due_date || t.created_at)) return;
          if (!q || `${t.title} ${t.description}`.toLowerCase().includes(q)) {
            hits.push({ type: 'Görev', title: t.title, meta: `${t.status} • ${t.priority}`, href: t.project_id ? `project-detail.html?id=${t.project_id}&tab=tasks` : 'calendar.html', badge: 'badge-blue' });
          }
        });

        (noteR.data || []).forEach((n) => {
          if (cat || status || priority) return;
          if (!matchDate(n.note_date)) return;
          if (!q || `${n.title} ${n.content}`.toLowerCase().includes(q)) {
            hits.push({ type: 'Günlük', title: n.title, meta: PV.utils.formatDate(n.note_date), href: n.project_id ? `project-detail.html?id=${n.project_id}&tab=journal` : 'journal.html', badge: 'badge-success' });
          }
        });

        (docR.data || []).forEach((d) => {
          if (status || priority) return;
          if (!matchDate(d.created_at)) return;
          if (!q || `${d.file_name} ${d.description} ${d.category}`.toLowerCase().includes(q)) {
            hits.push({ type: 'Doküman', title: d.file_name, meta: d.category, href: 'documents.html', badge: 'badge-warning' });
          }
        });

        if (!hits.length) {
          resultsEl.innerHTML = `<div class="empty-state" style="padding:2rem;"><p>Eşleşen kayıt bulunamadı.</p></div>`;
          return;
        }

        resultsEl.innerHTML = hits.slice(0, 30).map((h) => `
          <a href="${h.href}" class="card flex items-center justify-between gap-3" style="padding:0.85rem 1rem;text-decoration:none;color:inherit;">
            <div style="min-width:0;">
              <div style="font-weight:600;">${PV.utils.escapeHtml(h.title)}</div>
              <div class="text-secondary" style="font-size:0.8rem;">${PV.utils.escapeHtml(h.meta)}</div>
            </div>
            <span class="badge ${h.badge}">${PV.utils.escapeHtml(h.type)}</span>
          </a>
        `).join('');
      } catch (err) {
        resultsEl.innerHTML = `<div class="alert alert-danger">${PV.utils.escapeHtml(err.message)}</div>`;
      }
    }, 260);

    ['pv-gs-input', 'pv-gs-cat', 'pv-gs-status', 'pv-gs-priority', 'pv-gs-date'].forEach((id) => {
      document.getElementById(id).addEventListener('input', runSearch);
      document.getElementById(id).addEventListener('change', runSearch);
    });
  }

  function openGlobalSearch() {
    buildGlobalSearchModal();
    openModal('pv-global-search-modal');
    setTimeout(() => document.getElementById('pv-gs-input')?.focus(), 80);
  }

  /* ------------------------------------------------------------------------
     Bildirim Merkezi & İstemci Tarafı Açık Oturum Alarm Kontrolü
     ------------------------------------------------------------------------ */
  async function loadNotifications() {
    const sb = getSupabaseClient();
    if (!sb || !currentUser) return;

    const { data, error } = await sb
      .from('notifications')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(15);

    if (error) return;

    const listEl = document.getElementById('pv-notif-list');
    const badgeEl = document.getElementById('pv-notif-badge');
    const items = data || [];
    const unread = items.filter((n) => !n.is_read).length;

    if (badgeEl) {
      badgeEl.textContent = unread > 9 ? '9+' : String(unread);
      badgeEl.classList.toggle('hidden', unread === 0);
    }

    if (listEl) {
      if (!items.length) {
        listEl.innerHTML = `<div class="text-muted text-center" style="padding:1.5rem;font-size:0.85rem;">Henüz bildirim yok.</div>`;
      } else {
        listEl.innerHTML = items.map((n) => `
          <div class="notification-item ${n.is_read ? '' : 'unread'}">
            <div class="flex items-center justify-between gap-2">
              <strong>${PV.utils.escapeHtml(n.title)}</strong>
              <span class="text-muted" style="font-size:0.72rem;">${PV.utils.formatDateTime(n.created_at)}</span>
            </div>
            <div class="text-secondary">${PV.utils.escapeHtml(n.message)}</div>
          </div>
        `).join('');
      }
    }
  }

  /* ------------------------------------------------------------------------
     Sesli Alarm & Bildirim Sentezleyicisi (Web Audio API - Harici Dosya Gerektirmez)
     ------------------------------------------------------------------------ */
  let sharedAudioCtx = null;
  let alarmLoopTimer = null;

  function ensureAudioContext() {
    const AudioCtx = global.AudioContext || global.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  }

  // İlk kullanıcı etkileşiminde tarayıcı ses kilidini aç
  if (typeof document !== 'undefined') {
    const unlockAudio = () => {
      ensureAudioContext();
      document.removeEventListener('pointerdown', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };
    document.addEventListener('pointerdown', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });
  }

  function scheduleBeep(ctx, freq, startOffset, duration, type = 'sine', peakGain = 0.22) {
    const t0 = ctx.currentTime + startOffset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peakGain, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  function playSound(soundType = 'crystal') {
    const ctx = ensureAudioContext();
    if (!ctx) return;

    if (soundType === 'complete') {
      // Başarı / seviye atlama melodisi
      scheduleBeep(ctx, 523.25, 0.0, 0.14, 'triangle', 0.22);
      scheduleBeep(ctx, 659.25, 0.11, 0.14, 'triangle', 0.22);
      scheduleBeep(ctx, 783.99, 0.22, 0.28, 'triangle', 0.25);
      return;
    }

    if (soundType === 'digital') {
      scheduleBeep(ctx, 880, 0.0, 0.12, 'square', 0.14);
      scheduleBeep(ctx, 880, 0.18, 0.12, 'square', 0.14);
      scheduleBeep(ctx, 1174.66, 0.36, 0.22, 'square', 0.16);
      return;
    }

    if (soundType === 'chord') {
      scheduleBeep(ctx, 440, 0.0, 0.45, 'sine', 0.18);
      scheduleBeep(ctx, 554.37, 0.06, 0.45, 'sine', 0.16);
      scheduleBeep(ctx, 659.25, 0.12, 0.55, 'sine', 0.18);
      return;
    }

    if (soundType === 'urgent') {
      scheduleBeep(ctx, 987.77, 0.0, 0.14, 'sawtooth', 0.16);
      scheduleBeep(ctx, 783.99, 0.16, 0.14, 'sawtooth', 0.16);
      scheduleBeep(ctx, 987.77, 0.32, 0.14, 'sawtooth', 0.18);
      scheduleBeep(ctx, 1174.66, 0.48, 0.25, 'sawtooth', 0.18);
      return;
    }

    // Varsayılan: 'crystal'
    scheduleBeep(ctx, 659.25, 0.0, 0.22, 'sine', 0.24);
    scheduleBeep(ctx, 880.0, 0.16, 0.24, 'sine', 0.24);
    scheduleBeep(ctx, 1046.5, 0.32, 0.42, 'triangle', 0.24);
  }

  function stopAlarmLoop() {
    if (alarmLoopTimer) {
      clearInterval(alarmLoopTimer);
      alarmLoopTimer = null;
    }
  }

  function startAlarmLoop(soundType = 'crystal') {
    stopAlarmLoop();
    playSound(soundType);
    alarmLoopTimer = setInterval(() => {
      playSound(soundType);
    }, 2200);
  }

  function triggerAlarmRingingUI(reminder) {
    const soundType = reminder?.sound_type || localStorage.getItem('pv_default_alarm_sound') || 'crystal';
    startAlarmLoop(soundType);

    let modal = document.getElementById('pv-alarm-ring-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pv-alarm-ring-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal modal-sm">
          <div class="modal-header" style="background:linear-gradient(135deg,rgba(245,158,11,0.22),rgba(239,68,68,0.18));">
            <h3 class="modal-title"><i data-lucide="bell-ring" width="20" height="20" class="text-warning"></i> Alarm Çalıyor!</h3>
            <button type="button" class="btn-ghost btn-icon btn-sm" id="pv-alarm-close-x"><i data-lucide="x" width="16" height="16"></i></button>
          </div>
          <div class="modal-body text-center">
            <div class="alarm-pulse-icon mb-3"><i data-lucide="alarm-clock" width="32" height="32"></i></div>
            <h4 id="pv-alarm-ring-title" style="font-size:1.12rem;font-weight:700;margin-bottom:0.4rem;"></h4>
            <p id="pv-alarm-ring-desc" class="text-secondary mb-3" style="font-size:0.88rem;"></p>
            <div id="pv-alarm-ring-time" class="badge badge-warning"></div>
          </div>
          <div class="modal-footer" style="justify-content:center;">
            <button type="button" class="btn btn-secondary" id="pv-alarm-snooze-btn"><i data-lucide="clock" width="15" height="15"></i> 5 Dk Ertele</button>
            <button type="button" class="btn btn-primary" id="pv-alarm-dismiss-btn"><i data-lucide="volume-x" width="15" height="15"></i> Alarmı Sustur</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    document.getElementById('pv-alarm-ring-title').textContent = reminder?.title || 'ProjectVault Alarmı';
    document.getElementById('pv-alarm-ring-desc').textContent = reminder?.description || 'Planlanan hatırlatma zamanınız geldi.';
    document.getElementById('pv-alarm-ring-time').textContent = PV.utils.formatDateTime(reminder?.next_remind_at || new Date().toISOString());

    const dismiss = () => {
      stopAlarmLoop();
      closeModal(modal);
    };

    document.getElementById('pv-alarm-close-x').onclick = dismiss;
    document.getElementById('pv-alarm-dismiss-btn').onclick = dismiss;
    document.getElementById('pv-alarm-snooze-btn').onclick = async () => {
      stopAlarmLoop();
      closeModal(modal);
      const sb = getSupabaseClient();
      if (sb && currentUser && reminder?.id && !String(reminder.id).startsWith('test-')) {
        const snoozeAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        await sb.from('reminders').update({
          next_remind_at: snoozeAt,
          is_active: true,
          notification_status: 'pending'
        }).eq('id', reminder.id).eq('user_id', currentUser.id);
      }
      showToast('Alarm 5 dakika ertelendi.', 'info');
    };

    openModal(modal);
    PV.utils.renderIcons();
  }

  async function checkDueClientReminders() {
    const sb = getSupabaseClient();
    if (!sb || !currentUser) return;
    try {
      const nowIso = new Date().toISOString();
      const { data: due } = await sb
        .from('reminders')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('is_active', true)
        .lte('next_remind_at', nowIso);

      if (!due || !due.length) return;

      for (const r of due) {
        // Aynı alarmın mükerrer gönderimini engelle
        if (r.last_sent_at && new Date(r.last_sent_at) >= new Date(r.next_remind_at)) {
          continue;
        }
        const sentAt = new Date().toISOString();
        let nextAt = r.next_remind_at;
        let stillActive = true;
        let nextStatus = 'sent';

        if (r.repeat_type === 'Tek seferlik') {
          stillActive = false;
          nextStatus = 'completed';
        } else {
          const d = new Date(r.next_remind_at);
          if (r.repeat_type === 'Günlük') d.setUTCDate(d.getUTCDate() + 1);
          else if (r.repeat_type === 'Haftalık') d.setUTCDate(d.getUTCDate() + 7);
          else if (r.repeat_type === 'Aylık') d.setUTCMonth(d.getUTCMonth() + 1);
          nextAt = d.toISOString();
        }

        const { data: updated } = await sb
          .from('reminders')
          .update({
            last_sent_at: sentAt,
            next_remind_at: nextAt,
            is_active: stillActive,
            notification_status: nextStatus
          })
          .eq('id', r.id)
          .eq('user_id', currentUser.id)
          .select();

        if (updated && updated.length) {
          await sb.from('notifications').insert({
            user_id: currentUser.id,
            reminder_id: r.id,
            project_id: r.project_id,
            title: `⏰ Hatırlatma: ${r.title}`,
            message: r.description || 'Planlanan proje alarm zamanı geldi.',
            type: 'reminder',
            sent_via: r.notification_method
          });

          triggerAlarmRingingUI(r);
          showToast(`⏰ ${r.title}`, 'info', 7000);
          global.dispatchEvent(new CustomEvent('pv:reminder-triggered', { detail: r }));
          if (
            (r.notification_method === 'Web Push' || r.notification_method === 'Tümü') &&
            'Notification' in global &&
            Notification.permission === 'granted'
          ) {
            new Notification(`ProjectVault: ${r.title}`, {
              body: r.description || 'Planlanan hatırlatma zamanı geldi.',
              icon: 'assets/images/logo.svg'
            });
          }
        }
      }
      await loadNotifications();
    } catch (_) {
      // Sessiz hata yakalama
    }
  }

  /* ------------------------------------------------------------------------
     Ortak Uygulama Kabuğu (Sidebar + Header + Auth Guard)
     ------------------------------------------------------------------------ */
  const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: 'layout-dashboard' },
    { id: 'projects', label: 'Projelerim', href: 'projects.html', icon: 'folder-kanban' },
    { id: 'roadmap', label: 'AI Yol Haritası', href: 'roadmap.html', icon: 'compass' },
    { id: 'ideas', label: 'Fikir Havuzu', href: 'ideas.html', icon: 'lightbulb' },
    { id: 'calendar', label: 'Takvim ve Alarmlar', href: 'calendar.html', icon: 'calendar-clock' },
    { id: 'documents', label: 'Dokümanlar', href: 'documents.html', icon: 'file-text' },
    { id: 'journal', label: 'Proje Günlüğü', href: 'journal.html', icon: 'book-open' },
    { id: 'ai-assistant', label: 'AI Asistanı', href: 'ai-assistant.html', icon: 'sparkles' },
    { id: 'statistics', label: 'İstatistikler', href: 'statistics.html', icon: 'bar-chart-3' },
    { id: 'settings', label: 'Ayarlar', href: 'settings.html', icon: 'settings' }
  ];

  function clearAllAuthTokens() {
    try {
      localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
          localStorage.removeItem(k);
        }
      });
      sessionStorage.clear();
    } catch (_) {}
  }

  let sessionCheckInFlight = false;
  async function verifyActiveUserSession(sb, redirectOnFail = true) {
    if (!sb || sessionCheckInFlight) return null;
    sessionCheckInFlight = true;
    try {
      const { data: userRes, error: userErr } = await sb.auth.getUser();
      if (userErr || !userRes?.user) {
        await sb.auth.signOut({ scope: 'local' }).catch(() => {});
        clearAllAuthTokens();
        if (redirectOnFail) {
          window.location.replace('login.html?reason=session_ended');
        }
        return null;
      }

      if (!isLocalDbMode) {
        const { data: profCheck, error: profErr } = await sb
          .from('profiles')
          .select('id')
          .eq('user_id', userRes.user.id)
          .maybeSingle();
        if (!profErr && !profCheck) {
          await sb.auth.signOut({ scope: 'local' }).catch(() => {});
          clearAllAuthTokens();
          if (redirectOnFail) {
            window.location.replace('login.html?reason=session_ended');
          }
          return null;
        }
      }
      return userRes.user;
    } catch (_) {
      return currentUser;
    } finally {
      sessionCheckInFlight = false;
    }
  }

  async function initAppShell(activePage, pageTitle = 'ProjectVault') {
    applyTheme(getSavedTheme());
    const sb = await initSupabase();

    if (!sb) {
      window.location.replace('login.html?reason=config');
      return null;
    }

    const { data: sessData } = await sb.auth.getSession();
    if (!sessData || !sessData.session || !sessData.session.user) {
      clearAllAuthTokens();
      window.location.replace('login.html');
      return null;
    }

    const verifiedUser = await verifyActiveUserSession(sb, true);
    if (!verifiedUser) return null;

    currentUser = verifiedUser;

    const { data: prof } = await sb
      .from('profiles')
      .select('*')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    currentProfile = prof || {
      full_name: currentUser.user_metadata?.full_name || currentUser.email.split('@')[0],
      email: currentUser.email,
      theme_preference: getSavedTheme()
    };

    if (currentProfile.theme_preference) {
      applyTheme(currentProfile.theme_preference);
    }

    const sidebarMount = document.getElementById('pv-sidebar-mount');
    const headerMount = document.getElementById('pv-header-mount');

    const initials = (currentProfile.full_name || currentUser.email || 'PV')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    if (sidebarMount) {
      sidebarMount.innerHTML = `
        <div class="sidebar-backdrop" id="pv-sidebar-backdrop"></div>
        <aside class="sidebar" id="pv-sidebar" aria-label="Ana Menü">
          <div class="sidebar-brand">
            <a href="dashboard.html" class="sidebar-logo">
              <img src="assets/images/logo.svg" alt="ProjectVault Logo">
              <span>Project<span class="text-gradient">Vault</span></span>
            </a>
            <button type="button" class="btn-ghost btn-icon btn-sm mobile-menu-btn" id="pv-sidebar-close" aria-label="Menüyü Kapat">
              <i data-lucide="x" width="18" height="18"></i>
            </button>
          </div>
          <nav class="sidebar-nav">
            <div class="nav-section-label">Çalışma Alanı</div>
            ${NAV_ITEMS.slice(0, 7).map((item) => `
              <a href="${item.href}" class="nav-link ${activePage === item.id ? 'active' : ''}">
                <i data-lucide="${item.icon}" width="18" height="18"></i>
                <span>${item.label}</span>
              </a>
            `).join('')}
            <div class="nav-section-label">Zekâ & Analitik</div>
            ${NAV_ITEMS.slice(7).map((item) => `
              <a href="${item.href}" class="nav-link ${activePage === item.id ? 'active' : ''}">
                <i data-lucide="${item.icon}" width="18" height="18"></i>
                <span>${item.label}</span>
              </a>
            `).join('')}
          </nav>
          <div class="sidebar-footer">
            <div class="user-mini-card">
              <div class="user-avatar">${PV.utils.escapeHtml(initials)}</div>
              <div class="user-mini-info">
                <div class="user-mini-name">${PV.utils.escapeHtml(currentProfile.full_name || 'Kullanıcı')}</div>
                <div class="user-mini-email">${PV.utils.escapeHtml(currentUser.email)}</div>
              </div>
              <button type="button" class="btn-ghost btn-icon btn-sm" id="pv-logout-btn" title="Güvenli Çıkış">
                <i data-lucide="log-out" width="16" height="16"></i>
              </button>
            </div>
          </div>
        </aside>
      `;
    }

    if (headerMount) {
      headerMount.innerHTML = `
        <header class="top-header">
          <div class="header-left">
            <button type="button" class="btn btn-secondary btn-icon mobile-menu-btn" id="pv-mobile-menu-open" aria-label="Menüyü Aç">
              <i data-lucide="menu" width="18" height="18"></i>
            </button>
            <div class="header-page-title">${PV.utils.escapeHtml(pageTitle)}</div>
          </div>
          <div class="header-actions">
            <button type="button" class="global-search-trigger" id="pv-global-search-btn">
              <i data-lucide="search" width="16" height="16"></i>
              <span class="search-label">Proje, fikir, not ara...</span>
              <span class="kbd">Ctrl K</span>
            </button>
            <button type="button" class="btn btn-secondary btn-icon" data-theme-toggle title="Tema Değiştir"></button>
            <div class="notification-wrap">
              <button type="button" class="btn btn-secondary btn-icon" id="pv-notif-btn" aria-label="Bildirimler" title="Bildirimler">
                <i data-lucide="bell" width="18" height="18"></i>
                <span class="notification-badge hidden" id="pv-notif-badge">0</span>
              </button>
              <div class="notification-dropdown" id="pv-notif-dropdown">
                <div class="card-header" style="padding:0.75rem 1rem;margin:0;border-bottom:1px solid var(--border-color);">
                  <strong style="font-size:0.88rem;">Bildirimler</strong>
                  <button type="button" class="btn btn-ghost btn-sm" id="pv-notif-read-all">Tümünü Okundu İşaretle</button>
                </div>
                <div id="pv-notif-list" style="overflow-y:auto;max-height:340px;"></div>
              </div>
            </div>
          </div>
        </header>
      `;
    }

    // Etkileşimleri bağla
    applyTheme(getSavedTheme());
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.addEventListener('click', toggleTheme);
    });

    const sidebarEl = document.getElementById('pv-sidebar');
    const backdropEl = document.getElementById('pv-sidebar-backdrop');
    const toggleSidebar = (open) => {
      sidebarEl?.classList.toggle('open', open);
      backdropEl?.classList.toggle('open', open);
    };
    document.getElementById('pv-mobile-menu-open')?.addEventListener('click', () => toggleSidebar(true));
    document.getElementById('pv-sidebar-close')?.addEventListener('click', () => toggleSidebar(false));
    backdropEl?.addEventListener('click', () => toggleSidebar(false));

    document.getElementById('pv-global-search-btn')?.addEventListener('click', openGlobalSearch);
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openGlobalSearch();
      }
    });

    document.getElementById('pv-logout-btn')?.addEventListener('click', async () => {
      await PV.auth.signOut();
    });

    const notifBtn = document.getElementById('pv-notif-btn');
    const notifDrop = document.getElementById('pv-notif-dropdown');
    notifBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      notifDrop?.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (notifDrop && !notifDrop.contains(e.target) && e.target !== notifBtn) {
        notifDrop.classList.remove('open');
      }
    });
    document.getElementById('pv-notif-read-all')?.addEventListener('click', async () => {
      await sb.from('notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false);
      await loadNotifications();
    });

    PV.utils.renderIcons();
    await loadNotifications();
    await checkDueClientReminders();

    // Sekme açıkken her 4 saniyede bir gelen alarmları kontrol edip sesli çal
    setInterval(checkDueClientReminders, 4000);

    // Supabase'den hesap silinirse veya oturum iptal edilirse anında çıkış yap
    setInterval(() => verifyActiveUserSession(sb, true), 15000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        verifyActiveUserSession(sb, true);
      }
    });

    // Mobil alt gezinme çubuğu (Duolingo tarzı hızlı mobil erişim)
    if (!document.getElementById('pv-mobile-bottom-nav')) {
      const bottomNav = document.createElement('nav');
      bottomNav.id = 'pv-mobile-bottom-nav';
      bottomNav.className = 'mobile-bottom-nav';
      bottomNav.setAttribute('aria-label', 'Mobil Alt Menü');
      const mobileItems = [
        { id: 'dashboard', label: 'Ana', href: 'dashboard.html', icon: 'layout-dashboard' },
        { id: 'projects', label: 'Projeler', href: 'projects.html', icon: 'folder-kanban' },
        { id: 'roadmap', label: 'Rota', href: 'roadmap.html', icon: 'compass' },
        { id: 'calendar', label: 'Alarm', href: 'calendar.html', icon: 'alarm-clock' },
        { id: 'ai-assistant', label: 'AI', href: 'ai-assistant.html', icon: 'sparkles' }
      ];
      bottomNav.innerHTML = mobileItems.map((m) => `
        <a href="${m.href}" class="mobile-bottom-link ${activePage === m.id ? 'active' : ''}">
          <i data-lucide="${m.icon}" width="20" height="20"></i>
          <span>${m.label}</span>
        </a>
      `).join('');
      document.body.appendChild(bottomNav);
      PV.utils.renderIcons();
    }

    if (activePage === 'settings') {
      initSettingsPage();
    }

    return { sb, user: currentUser, profile: currentProfile };
  }

  /* ------------------------------------------------------------------------
     Ayarlar Sayfası Kontrolcüsü (settings.html)
     ------------------------------------------------------------------------ */
  async function initSettingsPage() {
    const sb = getSupabaseClient();
    if (!sb || !currentUser) return;

    const fullNameEl = document.getElementById('set-full-name');
    const usernameEl = document.getElementById('set-username');
    const emailEl = document.getElementById('set-email');
    const themeEl = document.getElementById('set-theme');
    const pushBtn = document.getElementById('set-webpush-btn');
    const aiStatusEl = document.getElementById('set-ai-status');
    const sbStatusEl = document.getElementById('set-sb-status');

    if (fullNameEl) fullNameEl.value = currentProfile.full_name || '';
    if (usernameEl) usernameEl.value = currentProfile.username || '';
    if (emailEl) emailEl.value = currentUser.email || '';
    if (themeEl) themeEl.value = getSavedTheme();

    if (sbStatusEl) {
      sbStatusEl.innerHTML = isLocalDbMode
        ? `<span class="badge badge-success">Yerleşik Kalıcı Veritabanı Aktif</span>`
        : `<span class="badge badge-success">Supabase Bağlı</span>`;
    }
    if (aiStatusEl) {
      aiStatusEl.innerHTML = PV.config.AI_CONFIGURED
        ? `<span class="badge badge-success">Yapılandırıldı (${PV.utils.escapeHtml(PV.config.AI_PROVIDER.toUpperCase())})</span>`
        : `<span class="badge badge-warning">GEMINI_API_KEY tanımlı değil (Netlify Env)</span>`;
    }

    document.getElementById('set-profile-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const updates = {
          full_name: fullNameEl.value.trim(),
          username: usernameEl.value.trim() || null,
          theme_preference: themeEl.value
        };
        const { error } = await sb.from('profiles').update(updates).eq('user_id', currentUser.id);
        if (error) throw error;
        applyTheme(updates.theme_preference);
        showToast('Profil ayarları güncellendi.', 'success');
      } catch (err) {
        showToast(`Profil güncellenemedi: ${err.message}`, 'error');
      }
    });

    document.getElementById('set-password-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPass = document.getElementById('set-new-password').value;
      const confirmPass = document.getElementById('set-confirm-password').value;
      if (newPass.length < 6) {
        showToast('Yeni şifre en az 6 karakter olmalıdır.', 'warning');
        return;
      }
      if (newPass !== confirmPass) {
        showToast('Şifreler eşleşmiyor.', 'warning');
        return;
      }
      const { error } = await sb.auth.updateUser({ password: newPass });
      if (error) {
        showToast(error.message, 'error');
      } else {
        e.target.reset();
        showToast('Şifreniz başarıyla güncellendi.', 'success');
      }
    });

    pushBtn?.addEventListener('click', async () => {
      if (!('Notification' in global)) {
        showToast('Tarayıcınız Web Bildirimlerini desteklemiyor.', 'warning');
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        showToast('Tarayıcı bildirim izni verildi.', 'success');
      } else {
        showToast('Bildirim izni reddedildi.', 'warning');
      }
    });

    document.getElementById('set-sb-edit-btn')?.addEventListener('click', () => {
      openSupabaseConfigModal();
    });

    const soundSel = document.getElementById('set-alarm-sound');
    if (soundSel) {
      PV.utils.populateSelect(soundSel, PV.config.ALARM_SOUNDS);
      soundSel.value = localStorage.getItem('pv_default_alarm_sound') || 'crystal';
      soundSel.addEventListener('change', () => {
        localStorage.setItem('pv_default_alarm_sound', soundSel.value);
        playSound(soundSel.value);
      });
    }

    document.getElementById('set-test-alarm-btn')?.addEventListener('click', () => {
      const sType = soundSel?.value || localStorage.getItem('pv_default_alarm_sound') || 'crystal';
      triggerAlarmRingingUI({
        id: 'test-alarm',
        title: 'Test Alarmı — ProjectVault',
        description: 'Sesli alarm bildirimi düzgün çalışıyor!',
        sound_type: sType,
        next_remind_at: new Date().toISOString()
      });
    });
  }

  PV.sound = {
    playSound,
    startAlarmLoop,
    stopAlarmLoop
  };

  PV.sb = {
    initSupabase,
    getSupabaseClient,
    isSupabaseConfigured,
    saveSupabaseCredentials,
    clearSupabaseCredentials,
    applyTheme,
    toggleTheme,
    showToast,
    openModal,
    closeModal,
    confirmDialog,
    openSupabaseConfigModal,
    openProjectMemoryReminderModal,
    openGlobalSearch,
    initAppShell,
    loadNotifications,
    triggerAlarmRingingUI,
    clearAllAuthTokens,
    verifyActiveUserSession,
    getCurrentUser: () => currentUser,
    getCurrentProfile: () => currentProfile
  };
})(window);
