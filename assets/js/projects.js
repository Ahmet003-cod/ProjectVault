/* ==========================================================================
   ProjectVault - Proje Yönetimi Modülü (projects.html)
   ========================================================================== */

(function (global) {
  'use strict';

  const PV = (global.PV = global.PV || {});
  let allProjects = [];
  let ctx = null;

  async function initProjectsPage() {
    ctx = await PV.sb.initAppShell('projects', 'Projelerim');
    if (!ctx) return;

    populateProjectFiltersAndForm();
    bindProjectEvents();
    await loadProjects();
  }

  function populateProjectFiltersAndForm() {
    PV.utils.populateSelect(document.getElementById('filter-proj-category'), PV.config.PROJECT_CATEGORIES, 'Tüm Kategoriler');
    PV.utils.populateSelect(document.getElementById('filter-proj-status'), PV.config.PROJECT_STATUSES, 'Tüm Durumlar');
    PV.utils.populateSelect(document.getElementById('filter-proj-priority'), PV.config.PRIORITIES, 'Tüm Öncelikler');

    PV.utils.populateSelect(document.getElementById('proj-category'), PV.config.PROJECT_CATEGORIES);
    PV.utils.populateSelect(document.getElementById('proj-status'), PV.config.PROJECT_STATUSES);
    PV.utils.populateSelect(document.getElementById('proj-priority'), PV.config.PRIORITIES);
  }

  function bindProjectEvents() {
    document.getElementById('new-project-btn')?.addEventListener('click', () => openProjectFormModal());
    document.querySelectorAll('[data-close-project-modal]').forEach((b) => {
      b.addEventListener('click', () => PV.sb.closeModal('project-form-modal'));
    });

    const filterFn = PV.utils.debounce(renderProjectsGrid, 200);
    ['filter-proj-search', 'filter-proj-category', 'filter-proj-status', 'filter-proj-priority', 'filter-proj-fav', 'filter-proj-archived'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', filterFn);
        el.addEventListener('change', filterFn);
      }
    });

    document.getElementById('project-form')?.addEventListener('submit', handleProjectSave);
  }

  async function loadProjects() {
    const grid = document.getElementById('projects-grid');
    if (grid) {
      grid.innerHTML = `<div class="card skeleton" style="height:260px;"></div><div class="card skeleton" style="height:260px;"></div><div class="card skeleton" style="height:260px;"></div>`;
    }
    const { data, error } = await ctx.sb
      .from('projects')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('last_worked_at', { ascending: false });

    if (error) {
      PV.sb.showToast(`Projeler yüklenemedi: ${error.message}`, 'error');
      return;
    }

    allProjects = data || [];
    await renderProjectsGrid();
  }

  async function resolveCoverUrl(storagePathOrUrl) {
    if (!storagePathOrUrl) return '';
    if (storagePathOrUrl.startsWith('http://') || storagePathOrUrl.startsWith('https://')) {
      return storagePathOrUrl;
    }
    const { data } = await ctx.sb.storage.from('project-covers').createSignedUrl(storagePathOrUrl, 3600);
    return data?.signedUrl || '';
  }

  async function renderProjectsGrid() {
    const grid = document.getElementById('projects-grid');
    if (!grid) return;

    const q = (document.getElementById('filter-proj-search')?.value || '').trim().toLowerCase();
    const cat = document.getElementById('filter-proj-category')?.value || '';
    const status = document.getElementById('filter-proj-status')?.value || '';
    const prio = document.getElementById('filter-proj-priority')?.value || '';
    const favOnly = document.getElementById('filter-proj-fav')?.checked || false;
    const showArchived = document.getElementById('filter-proj-archived')?.checked || false;

    const filtered = allProjects.filter((p) => {
      if (!showArchived && (p.is_archived || p.status === 'Arşivlendi')) return false;
      if (favOnly && !p.is_favorite) return false;
      if (cat && p.category !== cat) return false;
      if (status && p.status !== status) return false;
      if (prio && p.priority !== prio) return false;
      if (q) {
        const hay = `${p.title} ${p.short_description} ${p.purpose} ${(p.technologies || []).join(' ')} ${(p.tags || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1 / -1;">
          <div class="empty-state-icon"><i data-lucide="folder-kanban" width="26" height="26"></i></div>
          <h3>${allProjects.length ? 'Filtrelerle eşleşen proje bulunamadı' : 'Henüz proje oluşturulmadı'}</h3>
          <p>Yeni bir proje oluşturarak projenin amacını, teknik detaylarını, görevlerini ve çalışma günlüğünü tek yerde yönetin.</p>
          <button type="button" class="btn btn-primary" id="empty-new-proj-btn"><i data-lucide="plus" width="16" height="16"></i> Yeni Proje Oluştur</button>
        </div>
      `;
      document.getElementById('empty-new-proj-btn')?.addEventListener('click', () => openProjectFormModal());
      PV.utils.renderIcons();
      return;
    }

    const coverUrls = await Promise.all(filtered.map((p) => resolveCoverUrl(p.cover_image_url)));

    grid.innerHTML = filtered.map((p, idx) => {
      const cover = coverUrls[idx];
      const techs = (p.technologies || []).slice(0, 4);
      return `
        <article class="card card-interactive project-card">
          <div class="project-cover">
            ${cover
              ? `<img src="${PV.utils.escapeHtml(cover)}" alt="${PV.utils.escapeHtml(p.title)}">`
              : `<div class="project-cover-placeholder"><i data-lucide="layers" width="38" height="38"></i></div>`
            }
            <button type="button" class="btn btn-secondary btn-icon btn-sm proj-fav-btn" data-id="${p.id}" title="Favorilere Ekle/Çıkar" style="position:absolute;top:10px;right:10px;">
              <i data-lucide="star" width="15" height="15" style="${p.is_favorite ? 'fill:#f59e0b;color:#f59e0b;' : ''}"></i>
            </button>
          </div>
          <div class="project-card-body">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <span class="badge badge-purple">${PV.utils.escapeHtml(p.category)}</span>
              <div class="flex items-center gap-1">
                <span class="badge ${PV.utils.getPriorityBadgeClass(p.priority)}">${PV.utils.escapeHtml(p.priority)}</span>
                <span class="badge ${PV.utils.getStatusBadgeClass(p.status)}">${PV.utils.escapeHtml(p.status)}</span>
              </div>
            </div>
            <div>
              <h3 style="font-size:1.08rem;font-weight:700;margin-bottom:0.3rem;">
                <a href="project-detail.html?id=${encodeURIComponent(p.id)}" style="color:inherit;">${PV.utils.escapeHtml(p.title)}</a>
              </h3>
              <p class="text-secondary" style="font-size:0.84rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
                ${PV.utils.escapeHtml(p.short_description || p.purpose || 'Kısa açıklama girilmemiş.')}
              </p>
            </div>
            ${techs.length ? `<div class="chip-list">${techs.map((t) => `<span class="tech-chip">${PV.utils.escapeHtml(t)}</span>`).join('')}</div>` : ''}
            <div style="margin-top:auto;">
              <div class="flex items-center justify-between text-secondary mb-1" style="font-size:0.78rem;">
                <span>İlerleme</span>
                <strong>${p.progress || 0}%</strong>
              </div>
              <div class="progress-bar-wrap">
                <div class="progress-bar-fill" style="width:${p.progress || 0}%;"></div>
              </div>
            </div>
          </div>
          <div class="project-card-footer">
            <div class="flex items-center gap-1">
              <button type="button" class="btn btn-memory btn-sm proj-remind-btn" data-id="${p.id}" title="Bu Projeyi Bana Hatırlat">
                <i data-lucide="brain" width="14" height="14"></i> Hatırlat
              </button>
              <a href="project-detail.html?id=${encodeURIComponent(p.id)}" class="btn btn-primary btn-sm">Detay</a>
            </div>
            <div class="flex items-center gap-1">
              <button type="button" class="btn btn-ghost btn-icon btn-sm proj-edit-btn" data-id="${p.id}" title="Düzenle">
                <i data-lucide="pencil" width="14" height="14"></i>
              </button>
              <button type="button" class="btn btn-ghost btn-icon btn-sm proj-archive-btn" data-id="${p.id}" title="${p.is_archived ? 'Arşivden Çıkar' : 'Arşivle'}">
                <i data-lucide="archive" width="14" height="14"></i>
              </button>
              <button type="button" class="btn btn-ghost btn-icon btn-sm proj-delete-btn text-danger" data-id="${p.id}" title="Sil">
                <i data-lucide="trash-2" width="14" height="14"></i>
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    grid.querySelectorAll('.proj-remind-btn').forEach((b) => {
      b.addEventListener('click', () => PV.sb.openProjectMemoryReminderModal(b.getAttribute('data-id')));
    });

    grid.querySelectorAll('.proj-edit-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const proj = allProjects.find((item) => item.id === b.getAttribute('data-id'));
        if (proj) openProjectFormModal(proj);
      });
    });

    grid.querySelectorAll('.proj-fav-btn').forEach((b) => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        const proj = allProjects.find((item) => item.id === id);
        if (!proj) return;
        const { error } = await ctx.sb.from('projects').update({ is_favorite: !proj.is_favorite }).eq('id', id).eq('user_id', ctx.user.id);
        if (error) return PV.sb.showToast(error.message, 'error');
        await loadProjects();
      });
    });

    grid.querySelectorAll('.proj-archive-btn').forEach((b) => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        const proj = allProjects.find((item) => item.id === id);
        if (!proj) return;
        const nextArchived = !proj.is_archived;
        const { error } = await ctx.sb.from('projects').update({
          is_archived: nextArchived,
          status: nextArchived ? 'Arşivlendi' : 'Planlanıyor'
        }).eq('id', id).eq('user_id', ctx.user.id);
        if (error) return PV.sb.showToast(error.message, 'error');
        PV.sb.showToast(nextArchived ? 'Proje arşivlendi.' : 'Proje arşivden çıkarıldı.', 'success');
        await loadProjects();
      });
    });

    grid.querySelectorAll('.proj-delete-btn').forEach((b) => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        const proj = allProjects.find((item) => item.id === id);
        const ok = await PV.sb.confirmDialog({
          title: 'Projeyi Sil',
          message: `"${proj?.title}" projesini ve ona bağlı görev/günlük/teknik not kayıtlarını silmek istediğinize emin misiniz?`
        });
        if (!ok) return;
        const { error } = await ctx.sb.from('projects').delete().eq('id', id).eq('user_id', ctx.user.id);
        if (error) return PV.sb.showToast(error.message, 'error');
        PV.sb.showToast('Proje silindi.', 'success');
        await loadProjects();
      });
    });

    PV.utils.renderIcons();
  }

  function openProjectFormModal(proj = null) {
    document.getElementById('project-form').reset();
    document.getElementById('proj-id').value = proj?.id || '';
    document.getElementById('project-modal-title').textContent = proj ? 'Projeyi Düzenle' : 'Yeni Proje Oluştur';

    if (proj) {
      document.getElementById('proj-title').value = proj.title || '';
      document.getElementById('proj-short-desc').value = proj.short_description || '';
      document.getElementById('proj-purpose').value = proj.purpose || '';
      document.getElementById('proj-origin-idea').value = proj.origin_idea || '';
      document.getElementById('proj-technologies').value = (proj.technologies || []).join(', ');
      document.getElementById('proj-category').value = proj.category || 'Diğer';
      document.getElementById('proj-start-date').value = proj.start_date || '';
      document.getElementById('proj-end-date').value = proj.target_end_date || '';
      document.getElementById('proj-priority').value = proj.priority || 'Orta';
      document.getElementById('proj-status').value = proj.status || 'Fikir Aşamasında';
      document.getElementById('proj-tags').value = (proj.tags || []).join(', ');
      document.getElementById('proj-cover-url').value = proj.cover_image_url || '';
    } else {
      document.getElementById('proj-category').value = 'Yapay Zekâ';
      document.getElementById('proj-priority').value = 'Orta';
      document.getElementById('proj-status').value = 'Fikir Aşamasında';
    }

    PV.sb.openModal('project-form-modal');
  }

  async function handleProjectSave(e) {
    e.preventDefault();
    const saveBtn = document.getElementById('proj-save-btn');
    const id = document.getElementById('proj-id').value.trim();
    const title = document.getElementById('proj-title').value.trim();

    if (!title) {
      PV.sb.showToast('Proje adı zorunludur.', 'warning');
      return;
    }

    saveBtn.disabled = true;
    try {
      let coverPathOrUrl = document.getElementById('proj-cover-url').value.trim() || null;
      const coverFile = document.getElementById('proj-cover-file')?.files[0];

      if (coverFile) {
        const ext = (coverFile.name.split('.').pop() || '').toLowerCase();
        if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
          throw new Error('Kapak görseli PNG, JPG veya WEBP formatında olmalıdır.');
        }
        if (coverFile.size > 5 * 1024 * 1024) {
          throw new Error('Kapak görseli 5 MB boyutunu aşamaz.');
        }
        const storagePath = `${ctx.user.id}/${Date.now()}-${coverFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: upErr } = await ctx.sb.storage.from('project-covers').upload(storagePath, coverFile);
        if (upErr) throw upErr;
        coverPathOrUrl = storagePath;
      }

      const payload = {
        user_id: ctx.user.id,
        title,
        short_description: document.getElementById('proj-short-desc').value.trim(),
        purpose: document.getElementById('proj-purpose').value.trim(),
        origin_idea: document.getElementById('proj-origin-idea').value.trim(),
        technologies: PV.utils.parseCommaList(document.getElementById('proj-technologies').value),
        category: document.getElementById('proj-category').value,
        start_date: document.getElementById('proj-start-date').value || null,
        target_end_date: document.getElementById('proj-end-date').value || null,
        priority: document.getElementById('proj-priority').value,
        status: document.getElementById('proj-status').value,
        tags: PV.utils.parseCommaList(document.getElementById('proj-tags').value),
        cover_image_url: coverPathOrUrl,
        is_archived: document.getElementById('proj-status').value === 'Arşivlendi',
        last_worked_at: new Date().toISOString()
      };

      if (id) {
        const { error } = await ctx.sb.from('projects').update(payload).eq('id', id).eq('user_id', ctx.user.id);
        if (error) throw error;
        PV.sb.showToast('Proje güncellendi.', 'success');
      } else {
        const { error } = await ctx.sb.from('projects').insert(payload);
        if (error) throw error;
        PV.sb.showToast('Yeni proje oluşturuldu.', 'success');
      }

      PV.sb.closeModal('project-form-modal');
      await loadProjects();
    } catch (err) {
      PV.sb.showToast(`Kayıt hatası: ${err.message}`, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  }

  PV.projects = { initProjectsPage };
})(window);
