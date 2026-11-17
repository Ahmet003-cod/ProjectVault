/* ==========================================================================
   ProjectVault - Proje Günlüğü Modülü (journal.html ve Proje Detayı)
   Tarih Bazlı Kronolojik Çalışma Notları & Otomatik Son Çalışma Tarihi
   ========================================================================== */

(function (global) {
  'use strict';

  const PV = (global.PV = global.PV || {});

  async function initJournalPage() {
    const ctx = await PV.sb.initAppShell('journal', 'Proje Günlüğü');
    if (!ctx) return;

    await mountJournalView({
      containerEl: document.getElementById('journal-mount'),
      sb: ctx.sb,
      userId: ctx.user.id,
      fixedProjectId: null
    });
  }

  async function mountJournalView({ containerEl, sb, userId, fixedProjectId = null, onEntrySaved }) {
    if (!containerEl) return;

    let projects = [];
    let entries = [];

    const loadData = async () => {
      const [projRes, noteRes] = await Promise.all([
        sb.from('projects').select('id,title').eq('user_id', userId).order('title'),
        (() => {
          let q = sb
            .from('project_notes')
            .select('*, projects(title)')
            .eq('user_id', userId)
            .order('note_date', { ascending: false })
            .order('created_at', { ascending: false });
          if (fixedProjectId) q = q.eq('project_id', fixedProjectId);
          return q;
        })()
      ]);
      projects = projRes.data || [];
      entries = noteRes.data || [];
    };

    const ensureJournalModal = () => {
      let modal = document.getElementById('pv-journal-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'pv-journal-modal';
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
          <div class="modal">
            <div class="modal-header">
              <h3 class="modal-title" id="pv-jrn-modal-title">Günlük Kaydı Ekle</h3>
              <button type="button" class="btn-ghost btn-icon btn-sm" data-close-jrn><i data-lucide="x" width="16" height="16"></i></button>
            </div>
            <form id="pv-jrn-form">
              <div class="modal-body">
                <input type="hidden" id="pv-jrn-id">
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="pv-jrn-date">Tarih <span class="required">*</span></label>
                    <input type="date" id="pv-jrn-date" class="form-control" required>
                  </div>
                  <div class="form-group" id="pv-jrn-proj-wrap">
                    <label class="form-label" for="pv-jrn-project">İlgili Proje <span class="required">*</span></label>
                    <select id="pv-jrn-project" class="form-control" required></select>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label" for="pv-jrn-title">Başlık <span class="required">*</span></label>
                  <input type="text" id="pv-jrn-title" class="form-control" required placeholder="Örn: YOLO11 Eğitim Sonuçları İncelendi">
                </div>
                <div class="form-group">
                  <label class="form-label" for="pv-jrn-content">Çalışma Notu / Açıklama <span class="required">*</span></label>
                  <textarea id="pv-jrn-content" class="form-control" style="min-height:130px;" required placeholder="Bugün projede neler yaptınız, hangi sorunları çözdünüz, bir sonraki adımda ne gerekiyor?"></textarea>
                </div>
                <div class="form-group">
                  <label class="form-label" for="pv-jrn-tags">Etiketler (virgülle ayırın)</label>
                  <input type="text" id="pv-jrn-tags" class="form-control" placeholder="yolo11, eğitim, test">
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-close-jrn>İptal</button>
                <button type="submit" class="btn btn-primary" id="pv-jrn-save-btn">Kaydet</button>
              </div>
            </form>
          </div>
        `;
        document.body.appendChild(modal);
        modal.querySelectorAll('[data-close-jrn]').forEach((b) => {
          b.addEventListener('click', () => PV.sb.closeModal(modal));
        });
      }

      const projWrap = document.getElementById('pv-jrn-proj-wrap');
      const projSelect = document.getElementById('pv-jrn-project');
      if (fixedProjectId) {
        projWrap.classList.add('hidden');
        projSelect.required = false;
      } else {
        projWrap.classList.remove('hidden');
        projSelect.required = true;
        PV.utils.populateSelect(projSelect, projects.map((p) => ({ value: p.id, label: p.title })), 'Proje Seçin');
      }

      document.getElementById('pv-jrn-form').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('pv-jrn-id').value;
        const projId = fixedProjectId || projSelect.value;
        if (!projId) {
          PV.sb.showToast('Lütfen bir proje seçin.', 'warning');
          return;
        }

        const payload = {
          user_id: userId,
          project_id: projId,
          note_date: document.getElementById('pv-jrn-date').value,
          title: document.getElementById('pv-jrn-title').value.trim(),
          content: document.getElementById('pv-jrn-content').value.trim(),
          tags: PV.utils.parseCommaList(document.getElementById('pv-jrn-tags').value)
        };

        const btn = document.getElementById('pv-jrn-save-btn');
        btn.disabled = true;
        try {
          if (id) {
            const { error } = await sb.from('project_notes').update(payload).eq('id', id).eq('user_id', userId);
            if (error) throw error;
            PV.sb.showToast('Günlük kaydı güncellendi.', 'success');
          } else {
            const { error } = await sb.from('project_notes').insert(payload);
            if (error) throw error;
            PV.sb.showToast('Günlük kaydı eklendi ve son çalışma tarihi güncellendi.', 'success');
          }
          // İlgili projenin last_worked_at alanını güncelle
          await sb.from('projects').update({ last_worked_at: new Date().toISOString() }).eq('id', projId).eq('user_id', userId);

          PV.sb.closeModal(modal);
          await loadData();
          renderEntries();
          if (typeof onEntrySaved === 'function') onEntrySaved();
        } catch (err) {
          PV.sb.showToast(`Kayıt hatası: ${err.message}`, 'error');
        } finally {
          btn.disabled = false;
        }
      };

      return {
        open: (entry = null) => {
          if (!fixedProjectId && !projects.length) {
            PV.sb.showToast('Günlük eklemeden önce en az bir proje oluşturmalısınız.', 'warning');
            return;
          }
          document.getElementById('pv-jrn-form').reset();
          document.getElementById('pv-jrn-id').value = entry?.id || '';
          document.getElementById('pv-jrn-modal-title').textContent = entry ? 'Günlük Kaydını Düzenle' : 'Yeni Günlük Kaydı';
          document.getElementById('pv-jrn-date').value = entry?.note_date || PV.utils.getIstanbulDateString();
          if (!fixedProjectId && entry?.project_id) {
            projSelect.value = entry.project_id;
          }
          if (entry) {
            document.getElementById('pv-jrn-title').value = entry.title || '';
            document.getElementById('pv-jrn-content').value = entry.content || '';
            document.getElementById('pv-jrn-tags').value = (entry.tags || []).join(', ');
          }
          PV.sb.openModal(modal);
        }
      };
    };

    const renderLayout = () => {
      containerEl.innerHTML = `
        <div class="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div class="filter-bar mb-0" style="flex:1;">
            <div class="search-input-wrap">
              <i data-lucide="search" width="16" height="16"></i>
              <input type="search" id="pv-jrn-search" class="form-control" placeholder="Günlük notlarında ara...">
            </div>
            ${fixedProjectId ? '' : '<select id="pv-jrn-filter-proj" class="form-control"></select>'}
          </div>
          <button type="button" class="btn btn-primary" id="pv-jrn-add-btn">
            <i data-lucide="plus" width="16" height="16"></i> Günlük Kaydı Ekle
          </button>
        </div>
        <div id="pv-jrn-list"></div>
      `;

      if (!fixedProjectId) {
        PV.utils.populateSelect(
          document.getElementById('pv-jrn-filter-proj'),
          projects.map((p) => ({ value: p.id, label: p.title })),
          'Tüm Projeler'
        );
      }

      const modalCtrl = ensureJournalModal();
      document.getElementById('pv-jrn-add-btn').addEventListener('click', () => modalCtrl.open());

      const filterFn = PV.utils.debounce(renderEntries, 180);
      document.getElementById('pv-jrn-search')?.addEventListener('input', filterFn);
      document.getElementById('pv-jrn-filter-proj')?.addEventListener('change', filterFn);
    };

    const renderEntries = () => {
      const listEl = document.getElementById('pv-jrn-list');
      if (!listEl) return;

      const q = (document.getElementById('pv-jrn-search')?.value || '').trim().toLowerCase();
      const projFilter = document.getElementById('pv-jrn-filter-proj')?.value || '';

      const filtered = entries.filter((e) => {
        if (projFilter && e.project_id !== projFilter) return false;
        if (q && !`${e.title} ${e.content} ${(e.tags || []).join(' ')}`.toLowerCase().includes(q)) return false;
        return true;
      });

      if (!filtered.length) {
        listEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon"><i data-lucide="book-open" width="26" height="26"></i></div>
            <h3>Henüz günlük kaydı eklenmemiş</h3>
            <p>Projelerinizde yaptığınız günlük ilerlemeleri, test sonuçlarını ve gözlemlerinizi tarih bazlı kaydedin.</p>
          </div>
        `;
        PV.utils.renderIcons();
        return;
      }

      const modalCtrl = ensureJournalModal();

      listEl.innerHTML = `<div class="timeline">${filtered.map((entry) => `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="flex items-start justify-between gap-3 flex-wrap mb-2">
            <div>
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <span class="badge badge-cyan">${PV.utils.formatDate(entry.note_date)}</span>
                ${!fixedProjectId && entry.projects?.title ? `<a href="project-detail.html?id=${encodeURIComponent(entry.project_id)}" class="badge badge-purple">${PV.utils.escapeHtml(entry.projects.title)}</a>` : ''}
              </div>
              <h4 style="font-size:1.02rem;font-weight:700;">${PV.utils.escapeHtml(entry.title)}</h4>
            </div>
            <div class="flex items-center gap-1">
              <button type="button" class="btn btn-ghost btn-icon btn-sm jrn-edit-btn" data-id="${entry.id}" title="Düzenle"><i data-lucide="pencil" width="14" height="14"></i></button>
              <button type="button" class="btn btn-ghost btn-icon btn-sm jrn-del-btn text-danger" data-id="${entry.id}" title="Sil"><i data-lucide="trash-2" width="14" height="14"></i></button>
            </div>
          </div>
          <p class="text-secondary" style="white-space:pre-wrap;font-size:0.9rem;line-height:1.6;">${PV.utils.escapeHtml(entry.content)}</p>
          ${(entry.tags && entry.tags.length) ? `<div class="chip-list mt-3">${entry.tags.map((t) => `<span class="tech-chip">#${PV.utils.escapeHtml(t)}</span>`).join('')}</div>` : ''}
        </div>
      `).join('')}</div>`;

      listEl.querySelectorAll('.jrn-edit-btn').forEach((b) => {
        b.addEventListener('click', () => {
          const item = entries.find((x) => x.id === b.getAttribute('data-id'));
          if (item) modalCtrl.open(item);
        });
      });

      listEl.querySelectorAll('.jrn-del-btn').forEach((b) => {
        b.addEventListener('click', async () => {
          const id = b.getAttribute('data-id');
          const ok = await PV.sb.confirmDialog({ title: 'Günlük Kaydını Sil', message: 'Bu günlük kaydını silmek istediğinize emin misiniz?' });
          if (!ok) return;
          const { error } = await sb.from('project_notes').delete().eq('id', id).eq('user_id', userId);
          if (error) return PV.sb.showToast(error.message, 'error');
          PV.sb.showToast('Günlük kaydı silindi.', 'success');
          await loadData();
          renderEntries();
        });
      });

      PV.utils.renderIcons();
    };

    await loadData();
    renderLayout();
    renderEntries();
  }

  PV.journal = {
    initJournalPage,
    mountJournalView
  };
})(window);
