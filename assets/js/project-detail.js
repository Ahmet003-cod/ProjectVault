/* ==========================================================================
   ProjectVault - Proje Detay & Proje Hafızası Çalışma Alanı (project-detail.html)
   7 Sekme: Genel Bakış & Hafıza, Görevler (Kanban), Dokümanlar,
            Proje Günlüğü, Teknik Notlar, Zaman Çizelgesi, AI Analizi
   ========================================================================== */

(function (global) {
  'use strict';

  const PV = (global.PV = global.PV || {});
  let ctx = null;
  let project = null;
  let activeTab = 'overview';

  async function initProjectDetailPage() {
    ctx = await PV.sb.initAppShell('projects', 'Proje Detayı');
    if (!ctx) return;

    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('id');
    const initialTab = params.get('tab') || 'overview';

    if (!projectId) {
      document.getElementById('pd-root').innerHTML = `
        <div class="empty-state">
          <h3>Proje ID bulunamadı</h3>
          <p>Detaylarını görüntülemek için Projelerim sayfasından bir proje seçin.</p>
          <a href="projects.html" class="btn btn-primary">Projelere Dön</a>
        </div>
      `;
      return;
    }

    await loadProject(projectId);
    if (!project) return;

    activeTab = initialTab;
    renderHeader();
    bindTabs();
    await switchTab(activeTab);
  }

  async function loadProject(projectId) {
    const { data, error } = await ctx.sb
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', ctx.user.id)
      .maybeSingle();

    if (error || !data) {
      document.getElementById('pd-root').innerHTML = `
        <div class="empty-state">
          <h3>Proje bulunamadı veya erişim izniniz yok</h3>
          <p>${PV.utils.escapeHtml(error?.message || 'Kayıt mevcut değil.')}</p>
          <a href="projects.html" class="btn btn-primary">Projelere Dön</a>
        </div>
      `;
      return;
    }
    project = data;
  }

  function renderHeader() {
    const headerBox = document.getElementById('pd-header-box');
    if (!headerBox || !project) return;

    const days = PV.utils.daysSince(project.last_worked_at);

    headerBox.innerHTML = `
      <div class="flex items-start justify-between flex-wrap gap-4">
        <div style="flex:1;min-width:260px;">
          <div class="flex items-center gap-2 flex-wrap mb-2">
            <a href="projects.html" class="btn btn-ghost btn-sm" style="padding-left:0;"><i data-lucide="arrow-left" width="15" height="15"></i> Projeler</a>
            <span class="badge badge-purple">${PV.utils.escapeHtml(project.category)}</span>
            <span class="badge ${PV.utils.getStatusBadgeClass(project.status)}">${PV.utils.escapeHtml(project.status)}</span>
            <span class="badge ${PV.utils.getPriorityBadgeClass(project.priority)}">${PV.utils.escapeHtml(project.priority)}</span>
          </div>
          <h1 style="font-size:1.65rem;font-weight:800;letter-spacing:-0.02em;">${PV.utils.escapeHtml(project.title)}</h1>
          <p class="text-secondary mt-1">${PV.utils.escapeHtml(project.short_description || 'Kısa açıklama eklenmemiş.')}</p>
          <div class="flex items-center gap-4 flex-wrap mt-3 text-muted" style="font-size:0.82rem;">
            <span><strong>Son Çalışma:</strong> ${PV.utils.formatDateTime(project.last_worked_at)}${days !== null ? ` (${days} gün önce)` : ''}</span>
            <span><strong>Başlangıç:</strong> ${PV.utils.formatDate(project.start_date)}</span>
            <span><strong>Hedef Bitiş:</strong> ${PV.utils.formatDate(project.target_end_date)}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button type="button" class="btn btn-memory" id="pd-remind-me-btn">
            <i data-lucide="brain" width="17" height="17"></i> Bu Projeyi Bana Hatırlat
          </button>
          <button type="button" class="btn btn-secondary" id="pd-add-alarm-btn">
            <i data-lucide="alarm-clock" width="16" height="16"></i> Alarm Kur
          </button>
          <button type="button" class="btn btn-secondary btn-icon" id="pd-fav-btn" title="Favorilere Ekle/Çıkar">
            <i data-lucide="star" width="16" height="16" style="${project.is_favorite ? 'fill:#f59e0b;color:#f59e0b;' : ''}"></i>
          </button>
          <button type="button" class="btn btn-danger btn-icon" id="pd-delete-btn" title="Projeyi Sil">
            <i data-lucide="trash-2" width="16" height="16"></i>
          </button>
        </div>
      </div>
      <div class="mt-4">
        <div class="flex items-center justify-between text-secondary mb-1" style="font-size:0.8rem;">
          <span>Genel Proje İlerlemesi</span>
          <strong id="pd-progress-label">${project.progress || 0}%</strong>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" id="pd-progress-bar" style="width:${project.progress || 0}%;"></div>
        </div>
      </div>
    `;

    document.getElementById('pd-remind-me-btn').addEventListener('click', () => {
      PV.sb.openProjectMemoryReminderModal(project.id);
    });

    document.getElementById('pd-add-alarm-btn').addEventListener('click', () => {
      const remCtrl = PV.reminders.ensureReminderModal(ctx.sb, ctx.user.id, [project], () => {
        PV.sb.showToast('Proje alarmı kuruldu.', 'success');
      });
      remCtrl.open(null, null, project.id);
    });

    document.getElementById('pd-fav-btn').addEventListener('click', async () => {
      const { error } = await ctx.sb
        .from('projects')
        .update({ is_favorite: !project.is_favorite })
        .eq('id', project.id)
        .eq('user_id', ctx.user.id);
      if (error) return PV.sb.showToast(error.message, 'error');
      project.is_favorite = !project.is_favorite;
      renderHeader();
    });

    document.getElementById('pd-delete-btn').addEventListener('click', async () => {
      const ok = await PV.sb.confirmDialog({
        title: 'Projeyi Sil',
        message: `"${project.title}" projesini ve bağlı tüm kayıtları silmek istediğinize emin misiniz?`
      });
      if (!ok) return;
      const { error } = await ctx.sb.from('projects').delete().eq('id', project.id).eq('user_id', ctx.user.id);
      if (error) return PV.sb.showToast(error.message, 'error');
      window.location.href = 'projects.html';
    });

    PV.utils.renderIcons();
  }

  function bindTabs() {
    document.querySelectorAll('#pd-tabs-nav .tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        switchTab(btn.getAttribute('data-tab'));
      });
    });
  }

  async function switchTab(tabName) {
    activeTab = tabName;
    document.querySelectorAll('#pd-tabs-nav .tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    const contentEl = document.getElementById('pd-tab-content');
    if (!contentEl) return;

    if (tabName === 'overview') renderOverviewAndMemoryTab(contentEl);
    else if (tabName === 'tasks') await renderTasksTab(contentEl);
    else if (tabName === 'documents') await renderDocumentsTab(contentEl);
    else if (tabName === 'journal') await renderJournalTab(contentEl);
    else if (tabName === 'technical') await renderTechnicalNotesTab(contentEl);
    else if (tabName === 'timeline') await renderTimelineTab(contentEl);
    else if (tabName === 'ai') renderAiAnalysisTab(contentEl);
    else if (tabName === 'roadmap' && PV.roadmap) {
      await PV.roadmap.mountProjectRoadmap({
        containerEl: contentEl,
        sb: ctx.sb,
        userId: ctx.user.id,
        project,
        onProjectUpdated: (updated) => {
          project = updated;
          renderHeader();
        }
      });
    }

    PV.utils.renderIcons();
  }

  /* Sekme 1: Genel Bakış & Kapsamlı Proje Hafızası */
  function renderOverviewAndMemoryTab(el) {
    el.innerHTML = `
      <div class="dashboard-grid">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i data-lucide="info" width="18" height="18" class="text-cyan"></i> Genel Bakış</h3>
            <span class="badge ${PV.utils.getStatusBadgeClass(project.status)}">${PV.utils.escapeHtml(project.status)}</span>
          </div>
          <div class="flex-col gap-3" style="font-size:0.9rem;">
            <div>
              <div class="text-muted" style="font-size:0.78rem;">Proje Amacı</div>
              <p style="white-space:pre-wrap;">${PV.utils.escapeHtml(project.purpose || 'Belirtilmemiş')}</p>
            </div>
            <div>
              <div class="text-muted" style="font-size:0.78rem;">Kullanılan Teknolojiler</div>
              <div class="chip-list mt-1">
                ${(project.technologies && project.technologies.length)
                  ? project.technologies.map((t) => `<span class="tech-chip">${PV.utils.escapeHtml(t)}</span>`).join('')
                  : '<span class="text-muted">Teknoloji girilmemiş</span>'}
              </div>
            </div>
            <div>
              <div class="text-muted" style="font-size:0.78rem;">Etiketler</div>
              <div class="chip-list mt-1">
                ${(project.tags && project.tags.length)
                  ? project.tags.map((t) => `<span class="badge badge-neutral">#${PV.utils.escapeHtml(t)}</span>`).join('')
                  : '<span class="text-muted">Etiket yok</span>'}
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i data-lucide="sliders" width="18" height="18" class="text-purple"></i> Hızlı Durum Güncelleme</h3>
          </div>
          <form id="pd-quick-meta-form">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="pd-meta-status">Proje Durumu</label>
                <select id="pd-meta-status" class="form-control"></select>
              </div>
              <div class="form-group">
                <label class="form-label" for="pd-meta-priority">Öncelik</label>
                <select id="pd-meta-priority" class="form-control"></select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="pd-meta-progress">İlerleme Yüzdesi (%)</label>
              <input type="number" id="pd-meta-progress" class="form-control" min="0" max="100" value="${project.progress || 0}">
            </div>
            <button type="submit" class="btn btn-secondary btn-sm">Durumu Güncelle</button>
          </form>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title"><i data-lucide="brain" width="20" height="20" class="text-cyan"></i> Proje Hafızası Modülü</h3>
            <p class="card-subtitle">Aylar sonra projeye döndüğünüzde nerede kaldığınızı eksiksiz hatırlamanız için kalıcı teknik bellek.</p>
          </div>
        </div>
        <form id="pd-memory-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="mem-purpose">Projenin Amacı</label>
              <textarea id="mem-purpose" class="form-control" placeholder="Bu proje hangi problemi çözüyor?">${PV.utils.escapeHtml(project.purpose || '')}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="mem-origin">İlk Ortaya Çıkış Düşüncesi</label>
              <textarea id="mem-origin" class="form-control" placeholder="Fikir ilk kez nasıl doğdu?">${PV.utils.escapeHtml(project.origin_idea || '')}</textarea>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="mem-motivation">Neden Bu Projeyi Yapmak İstiyorum?</label>
              <textarea id="mem-motivation" class="form-control" placeholder="Kişisel veya teknik motivasyonunuz...">${PV.utils.escapeHtml(project.motivation || '')}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="mem-work-done">Şimdiye Kadar Yapılan Çalışmalar</label>
              <textarea id="mem-work-done" class="form-control" placeholder="Tamamlanan modüller, deneyler ve kurulumlar...">${PV.utils.escapeHtml(project.work_done_summary || '')}</textarea>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="mem-tech">Kullanılan Teknolojiler (virgülle ayırın)</label>
            <input type="text" id="mem-tech" class="form-control" value="${PV.utils.escapeHtml((project.technologies || []).join(', '))}" placeholder="Python, PyTorch, YOLO11, ESP32...">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="mem-challenges">Karşılaşılan Teknik Sorunlar</label>
              <textarea id="mem-challenges" class="form-control" placeholder="Geliştirme sürecinde karşılaşılan zorluklar...">${PV.utils.escapeHtml(project.technical_challenges || '')}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="mem-resolved">Çözülmüş Sorunlar</label>
              <textarea id="mem-resolved" class="form-control" placeholder="Hangi sorunları nasıl çözdünüz?">${PV.utils.escapeHtml(project.resolved_issues || '')}</textarea>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="mem-unresolved">Henüz Çözülmemiş Sorunlar</label>
              <textarea id="mem-unresolved" class="form-control" placeholder="Açık kalan buglar veya darboğazlar...">${PV.utils.escapeHtml(project.unresolved_issues || '')}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="mem-last-stage">En Son Hangi Aşamada Kalındı?</label>
              <textarea id="mem-last-stage" class="form-control" placeholder="Son çalışma oturumunuzda tam olarak neredeydiniz?">${PV.utils.escapeHtml(project.last_stage || '')}</textarea>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="mem-next-steps">Bundan Sonra Yapılması Gerekenler</label>
            <textarea id="mem-next-steps" class="form-control" placeholder="Projeyi açtığınızda atılacak ilk somut adımlar...">${PV.utils.escapeHtml(project.next_steps || '')}</textarea>
          </div>
          <div class="flex justify-end">
            <button type="submit" class="btn btn-primary" id="pd-mem-save-btn">
              <i data-lucide="save" width="16" height="16"></i> Proje Hafızasını Kaydet
            </button>
          </div>
        </form>
      </div>
    `;

    PV.utils.populateSelect(document.getElementById('pd-meta-status'), PV.config.PROJECT_STATUSES);
    PV.utils.populateSelect(document.getElementById('pd-meta-priority'), PV.config.PRIORITIES);
    document.getElementById('pd-meta-status').value = project.status;
    document.getElementById('pd-meta-priority').value = project.priority;

    document.getElementById('pd-quick-meta-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = document.getElementById('pd-meta-status').value;
      const priority = document.getElementById('pd-meta-priority').value;
      const progress = Math.min(100, Math.max(0, Number(document.getElementById('pd-meta-progress').value) || 0));

      const { data, error } = await ctx.sb
        .from('projects')
        .update({
          status,
          priority,
          progress,
          is_archived: status === 'Arşivlendi',
          last_worked_at: new Date().toISOString()
        })
        .eq('id', project.id)
        .eq('user_id', ctx.user.id)
        .select()
        .single();

      if (error) return PV.sb.showToast(error.message, 'error');
      project = data;
      renderHeader();
      PV.sb.showToast('Proje durumu güncellendi.', 'success');
    });

    document.getElementById('pd-memory-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('pd-mem-save-btn');
      btn.disabled = true;
      try {
        const updates = {
          purpose: document.getElementById('mem-purpose').value.trim(),
          origin_idea: document.getElementById('mem-origin').value.trim(),
          motivation: document.getElementById('mem-motivation').value.trim(),
          work_done_summary: document.getElementById('mem-work-done').value.trim(),
          technologies: PV.utils.parseCommaList(document.getElementById('mem-tech').value),
          technical_challenges: document.getElementById('mem-challenges').value.trim(),
          resolved_issues: document.getElementById('mem-resolved').value.trim(),
          unresolved_issues: document.getElementById('mem-unresolved').value.trim(),
          last_stage: document.getElementById('mem-last-stage').value.trim(),
          next_steps: document.getElementById('mem-next-steps').value.trim(),
          last_worked_at: new Date().toISOString()
        };

        const { data, error } = await ctx.sb
          .from('projects')
          .update(updates)
          .eq('id', project.id)
          .eq('user_id', ctx.user.id)
          .select()
          .single();

        if (error) throw error;
        project = data;
        renderHeader();
        PV.sb.showToast('Proje hafızası güvenle kaydedildi.', 'success');
      } catch (err) {
        PV.sb.showToast(`Kayıt hatası: ${err.message}`, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* Sekme 2: Görevler (Kanban) */
  async function renderTasksTab(el) {
    await PV.tasks.mountKanban({
      containerEl: el,
      sb: ctx.sb,
      userId: ctx.user.id,
      projectId: project.id,
      onProgressUpdated: (newPct) => {
        project.progress = newPct;
        const bar = document.getElementById('pd-progress-bar');
        const lbl = document.getElementById('pd-progress-label');
        if (bar) bar.style.width = `${newPct}%`;
        if (lbl) lbl.textContent = `${newPct}%`;
      }
    });
  }

  /* Sekme 3: Dokümanlar */
  async function renderDocumentsTab(el) {
    await PV.documents.mountDocumentsView({
      containerEl: el,
      sb: ctx.sb,
      userId: ctx.user.id,
      fixedProjectId: project.id
    });
  }

  /* Sekme 4: Proje Günlüğü */
  async function renderJournalTab(el) {
    await PV.journal.mountJournalView({
      containerEl: el,
      sb: ctx.sb,
      userId: ctx.user.id,
      fixedProjectId: project.id,
      onEntrySaved: async () => {
        await loadProject(project.id);
        renderHeader();
      }
    });
  }

  /* Sekme 5: Teknik Notlar */
  async function renderTechnicalNotesTab(el) {
    const { data: notes, error } = await ctx.sb
      .from('technical_notes')
      .select('*')
      .eq('user_id', ctx.user.id)
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    if (error) {
      el.innerHTML = `<div class="alert alert-danger">${PV.utils.escapeHtml(error.message)}</div>`;
      return;
    }

    const list = notes || [];

    el.innerHTML = `
      <div class="card mb-6">
        <div class="card-header">
          <h3 class="card-title"><i data-lucide="code-2" width="18" height="18" class="text-cyan"></i> Teknik Not Ekle</h3>
        </div>
        <form id="pd-tech-form">
          <input type="hidden" id="pd-tech-id">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="pd-tech-title">Not Başlığı <span class="required">*</span></label>
              <input type="text" id="pd-tech-title" class="form-control" required placeholder="Örn: Jetson Orin TensorRT Bellek Ayarı">
            </div>
            <div class="form-group">
              <label class="form-label" for="pd-tech-type">Not Türü</label>
              <select id="pd-tech-type" class="form-control"></select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="pd-tech-content">Teknik Açıklama / Çözüm <span class="required">*</span></label>
            <textarea id="pd-tech-content" class="form-control" required placeholder="Karşılaşılan teknik detaylar veya çözüm adımları..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="pd-tech-code">Kod Parçacığı / Komut (Opsiyonel)</label>
            <textarea id="pd-tech-code" class="form-control mono" placeholder="Komut veya kod bloğu..."></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="pd-tech-tags">Etiketler (virgülle)</label>
              <input type="text" id="pd-tech-tags" class="form-control" placeholder="cuda, tensorrt, bugfix">
            </div>
            <div class="form-group justify-center">
              <label class="checkbox-label mt-4">
                <input type="checkbox" id="pd-tech-resolved">
                <span>Sorun Çözüldü Olarak İşaretle</span>
              </label>
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn btn-secondary btn-sm hidden" id="pd-tech-cancel-btn">Düzenlemeyi İptal Et</button>
            <button type="submit" class="btn btn-primary btn-sm" id="pd-tech-save-btn">Teknik Notu Kaydet</button>
          </div>
        </form>
      </div>

      <div class="flex-col gap-3" id="pd-tech-list">
        ${list.length ? list.map((n) => `
          <div class="card">
            <div class="flex items-start justify-between gap-2 flex-wrap mb-2">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <span class="badge badge-purple">${PV.utils.escapeHtml(n.note_type)}</span>
                  <span class="badge ${n.is_resolved ? 'badge-success' : 'badge-warning'}">${n.is_resolved ? 'Çözüldü' : 'Açık / İnceleme'}</span>
                  <span class="text-muted" style="font-size:0.76rem;">${PV.utils.formatDateTime(n.created_at)}</span>
                </div>
                <h4 style="font-size:1.02rem;font-weight:700;">${PV.utils.escapeHtml(n.title)}</h4>
              </div>
              <div class="flex items-center gap-1">
                <button type="button" class="btn btn-ghost btn-icon btn-sm tech-toggle-res" data-id="${n.id}" title="Çözüm durumunu değiştir"><i data-lucide="check-circle" width="15" height="15"></i></button>
                <button type="button" class="btn btn-ghost btn-icon btn-sm tech-edit-btn" data-id="${n.id}" title="Düzenle"><i data-lucide="pencil" width="15" height="15"></i></button>
                <button type="button" class="btn btn-ghost btn-icon btn-sm tech-del-btn text-danger" data-id="${n.id}" title="Sil"><i data-lucide="trash-2" width="15" height="15"></i></button>
              </div>
            </div>
            <p class="text-secondary" style="white-space:pre-wrap;font-size:0.9rem;">${PV.utils.escapeHtml(n.content)}</p>
            ${n.code_snippet ? `<pre class="mt-3" style="background:var(--bg-tertiary);border:1px solid var(--border-color);padding:0.85rem;border-radius:8px;overflow-x:auto;font-size:0.82rem;"><code>${PV.utils.escapeHtml(n.code_snippet)}</code></pre>` : ''}
            ${(n.tags && n.tags.length) ? `<div class="chip-list mt-3">${n.tags.map((t) => `<span class="tech-chip">#${PV.utils.escapeHtml(t)}</span>`).join('')}</div>` : ''}
          </div>
        `).join('') : `<div class="empty-state"><p>Henüz teknik not eklenmedi.</p></div>`}
      </div>
    `;

    PV.utils.populateSelect(document.getElementById('pd-tech-type'), PV.config.TECH_NOTE_TYPES);

    document.getElementById('pd-tech-cancel-btn').addEventListener('click', () => {
      document.getElementById('pd-tech-form').reset();
      document.getElementById('pd-tech-id').value = '';
      document.getElementById('pd-tech-cancel-btn').classList.add('hidden');
    });

    document.getElementById('pd-tech-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('pd-tech-id').value;
      const payload = {
        user_id: ctx.user.id,
        project_id: project.id,
        title: document.getElementById('pd-tech-title').value.trim(),
        note_type: document.getElementById('pd-tech-type').value,
        content: document.getElementById('pd-tech-content').value.trim(),
        code_snippet: document.getElementById('pd-tech-code').value,
        is_resolved: document.getElementById('pd-tech-resolved').checked,
        tags: PV.utils.parseCommaList(document.getElementById('pd-tech-tags').value)
      };

      if (id) {
        const { error: uErr } = await ctx.sb.from('technical_notes').update(payload).eq('id', id).eq('user_id', ctx.user.id);
        if (uErr) return PV.sb.showToast(uErr.message, 'error');
        PV.sb.showToast('Teknik not güncellendi.', 'success');
      } else {
        const { error: iErr } = await ctx.sb.from('technical_notes').insert(payload);
        if (iErr) return PV.sb.showToast(iErr.message, 'error');
        PV.sb.showToast('Teknik not eklendi.', 'success');
      }
      await renderTechnicalNotesTab(el);
      PV.utils.renderIcons();
    });

    el.querySelectorAll('.tech-toggle-res').forEach((b) => {
      b.addEventListener('click', async () => {
        const item = list.find((x) => x.id === b.getAttribute('data-id'));
        if (!item) return;
        await ctx.sb.from('technical_notes').update({ is_resolved: !item.is_resolved }).eq('id', item.id).eq('user_id', ctx.user.id);
        await renderTechnicalNotesTab(el);
        PV.utils.renderIcons();
      });
    });

    el.querySelectorAll('.tech-edit-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const item = list.find((x) => x.id === b.getAttribute('data-id'));
        if (!item) return;
        document.getElementById('pd-tech-id').value = item.id;
        document.getElementById('pd-tech-title').value = item.title;
        document.getElementById('pd-tech-type').value = item.note_type;
        document.getElementById('pd-tech-content').value = item.content;
        document.getElementById('pd-tech-code').value = item.code_snippet || '';
        document.getElementById('pd-tech-tags').value = (item.tags || []).join(', ');
        document.getElementById('pd-tech-resolved').checked = Boolean(item.is_resolved);
        document.getElementById('pd-tech-cancel-btn').classList.remove('hidden');
        el.scrollIntoView({ behavior: 'smooth' });
      });
    });

    el.querySelectorAll('.tech-del-btn').forEach((b) => {
      b.addEventListener('click', async () => {
        const ok = await PV.sb.confirmDialog({ title: 'Teknik Notu Sil', message: 'Bu teknik notu silmek istediğinize emin misiniz?' });
        if (!ok) return;
        await ctx.sb.from('technical_notes').delete().eq('id', b.getAttribute('data-id')).eq('user_id', ctx.user.id);
        PV.sb.showToast('Teknik not silindi.', 'success');
        await renderTechnicalNotesTab(el);
        PV.utils.renderIcons();
      });
    });
  }

  /* Sekme 6: Zaman Çizelgesi */
  async function renderTimelineTab(el) {
    const [notesR, techR, taskR, docR, remR] = await Promise.all([
      ctx.sb.from('project_notes').select('*').eq('project_id', project.id).eq('user_id', ctx.user.id),
      ctx.sb.from('technical_notes').select('*').eq('project_id', project.id).eq('user_id', ctx.user.id),
      ctx.sb.from('tasks').select('*').eq('project_id', project.id).eq('user_id', ctx.user.id),
      ctx.sb.from('documents').select('*').eq('project_id', project.id).eq('user_id', ctx.user.id),
      ctx.sb.from('reminders').select('*').eq('project_id', project.id).eq('user_id', ctx.user.id)
    ]);

    const events = [
      { at: project.created_at, kind: 'Proje Oluşturuldu', badge: 'badge-purple', title: project.title, desc: project.purpose || project.short_description || '' }
    ];

    (notesR.data || []).forEach((n) => events.push({ at: n.note_date || n.created_at, kind: 'Günlük', badge: 'badge-cyan', title: n.title, desc: n.content }));
    (techR.data || []).forEach((n) => events.push({ at: n.created_at, kind: 'Teknik Not', badge: 'badge-blue', title: n.title, desc: n.content }));
    (taskR.data || []).forEach((t) => events.push({ at: t.completed_at || t.created_at, kind: `Görev (${t.status})`, badge: t.status === 'Tamamlandı' ? 'badge-success' : 'badge-neutral', title: t.title, desc: t.description || '' }));
    (docR.data || []).forEach((d) => events.push({ at: d.created_at, kind: 'Doküman', badge: 'badge-warning', title: d.file_name, desc: d.description || d.category }));
    (remR.data || []).forEach((r) => events.push({ at: r.next_remind_at, kind: 'Alarm', badge: 'badge-danger', title: r.title, desc: r.description || '' }));

    events.sort((a, b) => new Date(b.at) - new Date(a.at));

    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i data-lucide="git-commit-horizontal" width="18" height="18" class="text-cyan"></i> Proje Zaman Çizelgesi</h3>
        </div>
        <div class="timeline">
          ${events.map((ev) => `
            <div class="timeline-item">
              <div class="timeline-dot"></div>
              <div class="flex items-center justify-between gap-2 flex-wrap mb-1">
                <span class="badge ${ev.badge}">${PV.utils.escapeHtml(ev.kind)}</span>
                <span class="text-muted" style="font-size:0.78rem;">${PV.utils.formatDateTime(ev.at)}</span>
              </div>
              <h4 style="font-weight:600;">${PV.utils.escapeHtml(ev.title)}</h4>
              ${ev.desc ? `<p class="text-secondary mt-1" style="font-size:0.86rem;white-space:pre-wrap;">${PV.utils.escapeHtml(ev.desc)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /* Sekme 7: AI Analizi */
  function renderAiAnalysisTab(el) {
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title"><i data-lucide="sparkles" width="18" height="18" class="text-cyan"></i> ProjectVault AI Proje Analizi</h3>
            <p class="card-subtitle">Yanıtlar yalnızca bu projenin veritabanındaki kayıtları, günlükleri, teknik notları ve dokümanları esas alınarak üretilir.</p>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap mb-4">
          <button type="button" class="btn btn-primary btn-sm pd-ai-action" data-mode="project_summary">
            <i data-lucide="file-text" width="15" height="15"></i> Proje Geçmişini Özetle
          </button>
          <button type="button" class="btn btn-memory btn-sm pd-ai-action" data-mode="project_reminder">
            <i data-lucide="brain" width="15" height="15"></i> Detaylı Proje Hatırlatması
          </button>
          <button type="button" class="btn btn-secondary btn-sm pd-ai-action" data-mode="next_steps">
            <i data-lucide="arrow-right-circle" width="15" height="15"></i> Sonraki Adım Öner
          </button>
        </div>

        <form id="pd-ai-qa-form" class="flex gap-2 mb-4">
          <input type="text" id="pd-ai-question" class="form-control" placeholder="Bu proje hakkında soru sorun (Örn: Bu projede hangi teknik sorunlar yaşanmıştı?)">
          <button type="submit" class="btn btn-primary">Sor</button>
        </form>

        <div id="pd-ai-output">
          <div class="empty-state" style="padding:2rem;">
            <p>Yukarıdaki analiz butonlarından birini seçin veya proje geçmişiniz hakkında bir soru sorun.</p>
          </div>
        </div>
      </div>
    `;

    const runSummaryMode = async (mode) => {
      const out = document.getElementById('pd-ai-output');
      out.innerHTML = `<div class="alert alert-info"><div class="spinner"></div><span>ProjectVault AI proje kayıtlarını analiz ediyor...</span></div>`;
      try {
        const { data: sess } = await ctx.sb.auth.getSession();
        const res = await fetch('/.netlify/functions/ai-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess?.session?.access_token}` },
          body: JSON.stringify({ mode, projectId: project.id })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || 'AI servisi şu anda kullanılamıyor.');
        renderAiResult(out, data);
      } catch (err) {
        out.innerHTML = `<div class="alert alert-warning"><i data-lucide="alert-triangle" width="18" height="18"></i><div>${PV.utils.escapeHtml(err.message)}</div></div>`;
        PV.utils.renderIcons();
      }
    };

    el.querySelectorAll('.pd-ai-action').forEach((b) => {
      b.addEventListener('click', () => runSummaryMode(b.getAttribute('data-mode')));
    });

    document.getElementById('pd-ai-qa-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const q = document.getElementById('pd-ai-question').value.trim();
      if (!q) return;
      const out = document.getElementById('pd-ai-output');
      out.innerHTML = `<div class="alert alert-info"><div class="spinner"></div><span>Proje kayıtları taranıyor...</span></div>`;
      try {
        const { data: sess } = await ctx.sb.auth.getSession();
        const res = await fetch('/.netlify/functions/ai-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess?.session?.access_token}` },
          body: JSON.stringify({ message: q, projectId: project.id, mode: 'qa' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || 'AI servisi şu anda kullanılamıyor.');
        renderAiResult(out, data);
      } catch (err) {
        out.innerHTML = `<div class="alert alert-warning"><i data-lucide="alert-triangle" width="18" height="18"></i><div>${PV.utils.escapeHtml(err.message)}</div></div>`;
        PV.utils.renderIcons();
      }
    });
  }

  function renderAiResult(outEl, data) {
    const sourcesHtml = (data.sources && data.sources.length)
      ? `<div class="ai-sources-box"><strong>Dayanak Kayıtlar:</strong> ${data.sources.map((s) => `<span class="tech-chip">${PV.utils.escapeHtml(s)}</span>`).join(' ')}</div>`
      : '';
    outEl.innerHTML = `
      <div class="card" style="background:var(--bg-tertiary);">
        <div style="white-space:pre-wrap;font-size:0.92rem;line-height:1.65;">${PV.utils.escapeHtml(data.content)}</div>
        ${sourcesHtml}
      </div>
    `;
  }

  PV.projectDetail = { initProjectDetailPage };
})(window);
