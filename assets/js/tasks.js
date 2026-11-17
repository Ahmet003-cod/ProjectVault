/* ==========================================================================
   ProjectVault - Görev Yönetimi & Sürükle-Bırak Kanban Modülü
   Tamamlanan görevler otomatik olarak projenin ilerleme yüzdesine yansıtılır.
   ========================================================================== */

(function (global) {
  'use strict';

  const PV = (global.PV = global.PV || {});

  async function recalculateProjectProgress(sb, userId, projectId) {
    if (!projectId) return 0;
    const { data: tasks } = await sb
      .from('tasks')
      .select('status, completion_percentage')
      .eq('user_id', userId)
      .eq('project_id', projectId);

    if (!tasks || !tasks.length) return 0;

    const total = tasks.reduce((acc, t) => {
      if (t.status === 'Tamamlandı') return acc + 100;
      return acc + (Number(t.completion_percentage) || 0);
    }, 0);

    const avg = Math.round(total / tasks.length);
    await sb
      .from('projects')
      .update({ progress: avg, last_worked_at: new Date().toISOString() })
      .eq('id', projectId)
      .eq('user_id', userId);
    return avg;
  }

  function ensureTaskModal(sb, userId, projectId, onSaved) {
    let modal = document.getElementById('pv-task-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pv-task-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title" id="pv-task-modal-title">Görev Ekle</h3>
            <button type="button" class="btn-ghost btn-icon btn-sm" data-close-task-modal><i data-lucide="x" width="16" height="16"></i></button>
          </div>
          <form id="pv-task-form">
            <div class="modal-body">
              <input type="hidden" id="pv-task-id">
              <div class="form-group">
                <label class="form-label" for="pv-task-title">Görev Başlığı <span class="required">*</span></label>
                <input type="text" id="pv-task-title" class="form-control" required placeholder="Örn: YOLO11 veri artırma testlerini tamamla">
              </div>
              <div class="form-group">
                <label class="form-label" for="pv-task-desc">Açıklama</label>
                <textarea id="pv-task-desc" class="form-control" placeholder="Görevin teknik detayları..."></textarea>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="pv-task-start">Başlangıç Tarihi</label>
                  <input type="date" id="pv-task-start" class="form-control">
                </div>
                <div class="form-group">
                  <label class="form-label" for="pv-task-due">Son Teslim Tarihi</label>
                  <input type="date" id="pv-task-due" class="form-control">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="pv-task-priority">Öncelik</label>
                  <select id="pv-task-priority" class="form-control"></select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="pv-task-status">Durum</label>
                  <select id="pv-task-status" class="form-control"></select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="pv-task-pct">Tamamlanma Yüzdesi (%)</label>
                <input type="number" id="pv-task-pct" class="form-control" min="0" max="100" value="0">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-close-task-modal>İptal</button>
              <button type="submit" class="btn btn-primary" id="pv-task-save-btn">Kaydet</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
      PV.utils.populateSelect(document.getElementById('pv-task-priority'), PV.config.PRIORITIES);
      PV.utils.populateSelect(document.getElementById('pv-task-status'), PV.config.TASK_STATUSES);
      modal.querySelectorAll('[data-close-task-modal]').forEach((b) => {
        b.addEventListener('click', () => PV.sb.closeModal(modal));
      });
    }

    document.getElementById('pv-task-status').onchange = (e) => {
      const pct = document.getElementById('pv-task-pct');
      if (e.target.value === 'Tamamlandı') pct.value = 100;
      else if (e.target.value === 'Yapılacak' && Number(pct.value) === 100) pct.value = 0;
    };

    document.getElementById('pv-task-form').onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('pv-task-id').value;
      const status = document.getElementById('pv-task-status').value;
      const pct = status === 'Tamamlandı' ? 100 : Math.min(100, Math.max(0, Number(document.getElementById('pv-task-pct').value) || 0));

      const payload = {
        user_id: userId,
        project_id: projectId || null,
        title: document.getElementById('pv-task-title').value.trim(),
        description: document.getElementById('pv-task-desc').value.trim(),
        start_date: document.getElementById('pv-task-start').value || null,
        due_date: document.getElementById('pv-task-due').value || null,
        priority: document.getElementById('pv-task-priority').value,
        status,
        completion_percentage: pct,
        completed_at: status === 'Tamamlandı' ? new Date().toISOString() : null
      };

      if (!payload.title) {
        PV.sb.showToast('Görev başlığı zorunludur.', 'warning');
        return;
      }

      const btn = document.getElementById('pv-task-save-btn');
      btn.disabled = true;
      try {
        if (id) {
          const { error } = await sb.from('tasks').update(payload).eq('id', id).eq('user_id', userId);
          if (error) throw error;
          PV.sb.showToast('Görev güncellendi.', 'success');
        } else {
          const { error } = await sb.from('tasks').insert(payload);
          if (error) throw error;
          PV.sb.showToast('Görev oluşturuldu.', 'success');
        }

        const newPct = await recalculateProjectProgress(sb, userId, projectId);
        PV.sb.closeModal(modal);
        if (typeof onSaved === 'function') await onSaved(newPct);
      } catch (err) {
        PV.sb.showToast(`Görev kaydedilemedi: ${err.message}`, 'error');
      } finally {
        btn.disabled = false;
      }
    };

    return {
      open: (task = null) => {
        document.getElementById('pv-task-form').reset();
        document.getElementById('pv-task-id').value = task?.id || '';
        document.getElementById('pv-task-modal-title').textContent = task ? 'Görevi Düzenle' : 'Yeni Görev Oluştur';
        if (task) {
          document.getElementById('pv-task-title').value = task.title || '';
          document.getElementById('pv-task-desc').value = task.description || '';
          document.getElementById('pv-task-start').value = task.start_date || '';
          document.getElementById('pv-task-due').value = task.due_date || '';
          document.getElementById('pv-task-priority').value = task.priority || 'Orta';
          document.getElementById('pv-task-status').value = task.status || 'Yapılacak';
          document.getElementById('pv-task-pct').value = task.completion_percentage || 0;
        } else {
          document.getElementById('pv-task-priority').value = 'Orta';
          document.getElementById('pv-task-status').value = 'Yapılacak';
          document.getElementById('pv-task-pct').value = 0;
        }
        PV.sb.openModal(modal);
      }
    };
  }

  async function mountKanban({ containerEl, sb, userId, projectId, onProgressUpdated }) {
    if (!containerEl) return;

    const render = async () => {
      const { data: tasks, error } = await sb
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('project_id', projectId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        containerEl.innerHTML = `<div class="alert alert-danger">${PV.utils.escapeHtml(error.message)}</div>`;
        return;
      }

      const taskList = tasks || [];
      const modalCtrl = ensureTaskModal(sb, userId, projectId, async (newPct) => {
        if (typeof onProgressUpdated === 'function') onProgressUpdated(newPct);
        await render();
      });

      containerEl.innerHTML = `
        <div class="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 style="font-size:1.05rem;font-weight:700;">Görev Panosu (Kanban)</h3>
            <p class="text-secondary" style="font-size:0.84rem;">Görev kartlarını sürükleyip bırakarak sütunlar arasında taşıyabilirsiniz. Tamamlanan görevler proje ilerlemesini otomatik günceller.</p>
          </div>
          <button type="button" class="btn btn-primary btn-sm" id="kanban-add-task-btn">
            <i data-lucide="plus" width="15" height="15"></i> Yeni Görev Ekle
          </button>
        </div>
        <div class="kanban-board">
          ${PV.config.TASK_STATUSES.map((colStatus) => {
            const colTasks = taskList.filter((t) => t.status === colStatus);
            return `
              <div class="kanban-column" data-status="${PV.utils.escapeHtml(colStatus)}">
                <div class="kanban-column-header">
                  <span>${PV.utils.escapeHtml(colStatus)}</span>
                  <span class="badge ${PV.utils.getStatusBadgeClass(colStatus)}">${colTasks.length}</span>
                </div>
                <div class="flex-col gap-2 kanban-drop-list" style="flex:1;">
                  ${colTasks.length ? colTasks.map((t) => `
                    <div class="kanban-card" draggable="true" data-task-id="${t.id}">
                      <div class="flex items-center justify-between gap-2 mb-2">
                        <span class="badge ${PV.utils.getPriorityBadgeClass(t.priority)}">${PV.utils.escapeHtml(t.priority)}</span>
                        <div class="flex items-center gap-1">
                          <button type="button" class="btn-ghost btn-icon btn-sm task-edit-btn" data-id="${t.id}" title="Düzenle"><i data-lucide="pencil" width="13" height="13"></i></button>
                          <button type="button" class="btn-ghost btn-icon btn-sm task-del-btn text-danger" data-id="${t.id}" title="Sil"><i data-lucide="trash-2" width="13" height="13"></i></button>
                        </div>
                      </div>
                      <div style="font-weight:600;font-size:0.88rem;margin-bottom:0.35rem;">${PV.utils.escapeHtml(t.title)}</div>
                      ${t.description ? `<p class="text-secondary mb-2" style="font-size:0.78rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${PV.utils.escapeHtml(t.description)}</p>` : ''}
                      <div class="flex items-center justify-between text-muted" style="font-size:0.74rem;">
                        <span>${t.due_date ? 'Son: ' + PV.utils.formatDate(t.due_date) : 'Tarihsiz'}</span>
                        <span><strong>${t.completion_percentage || 0}%</strong></span>
                      </div>
                    </div>
                  `).join('') : `<div class="text-muted text-center" style="padding:1.5rem 0.5rem;font-size:0.8rem;">Bu sütunda görev yok</div>`}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      document.getElementById('kanban-add-task-btn')?.addEventListener('click', () => modalCtrl.open());

      containerEl.querySelectorAll('.task-edit-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const t = taskList.find((item) => item.id === btn.getAttribute('data-id'));
          if (t) modalCtrl.open(t);
        });
      });

      containerEl.querySelectorAll('.task-del-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          const ok = await PV.sb.confirmDialog({ title: 'Görevi Sil', message: 'Bu görevi silmek istediğinize emin misiniz?' });
          if (!ok) return;
          const { error: delErr } = await sb.from('tasks').delete().eq('id', id).eq('user_id', userId);
          if (delErr) return PV.sb.showToast(delErr.message, 'error');
          const newPct = await recalculateProjectProgress(sb, userId, projectId);
          if (typeof onProgressUpdated === 'function') onProgressUpdated(newPct);
          PV.sb.showToast('Görev silindi.', 'success');
          await render();
        });
      });

      // Sürükle - Bırak (Drag & Drop)
      let draggedTaskId = null;
      containerEl.querySelectorAll('.kanban-card').forEach((card) => {
        card.addEventListener('dragstart', () => {
          draggedTaskId = card.getAttribute('data-task-id');
          card.classList.add('dragging');
        });
        card.addEventListener('dragend', () => {
          card.classList.remove('dragging');
          draggedTaskId = null;
        });
      });

      containerEl.querySelectorAll('.kanban-column').forEach((col) => {
        col.addEventListener('dragover', (e) => {
          e.preventDefault();
          col.classList.add('drag-over');
        });
        col.addEventListener('dragleave', () => {
          col.classList.remove('drag-over');
        });
        col.addEventListener('drop', async (e) => {
          e.preventDefault();
          col.classList.remove('drag-over');
          const nextStatus = col.getAttribute('data-status');
          if (!draggedTaskId || !nextStatus) return;

          const draggedTask = taskList.find((t) => t.id === draggedTaskId);
          if (!draggedTask || draggedTask.status === nextStatus) return;

          let nextPct = draggedTask.completion_percentage || 0;
          if (nextStatus === 'Tamamlandı') nextPct = 100;
          else if (nextStatus === 'Devam Ediyor' && nextPct === 0) nextPct = 50;
          else if (nextStatus === 'Yapılacak' && nextPct === 100) nextPct = 0;

          const { error: upErr } = await sb.from('tasks').update({
            status: nextStatus,
            completion_percentage: nextPct,
            completed_at: nextStatus === 'Tamamlandı' ? new Date().toISOString() : null
          }).eq('id', draggedTaskId).eq('user_id', userId);

          if (upErr) {
            PV.sb.showToast(upErr.message, 'error');
            return;
          }

          const newPct = await recalculateProjectProgress(sb, userId, projectId);
          if (typeof onProgressUpdated === 'function') onProgressUpdated(newPct);
          PV.sb.showToast(`Görev "${nextStatus}" sütununa taşındı.`, 'success');
          await render();
        });
      });

      PV.utils.renderIcons();
    };

    await render();
  }

  PV.tasks = {
    mountKanban,
    recalculateProjectProgress
  };
})(window);
