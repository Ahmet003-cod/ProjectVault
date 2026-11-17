/* ==========================================================================
   ProjectVault - Duolingo Tarzı AI Proje Yol Haritası Modülü
   AI, projenin mevcut aşamasına göre nereden başlanacağına ve hangi konuların
   çalışılacağına karar verir; tamamlanan bölümlerden sonraki adıma geçilir.
   ========================================================================== */

(function (global) {
  'use strict';

  const PV = (global.PV = global.PV || {});

  const STEP_OFFSETS = [0, -46, -68, -46, 0, 46, 68, 46];

  async function initRoadmapPage() {
    const ctx = await PV.sb.initAppShell('roadmap', 'AI Yol Haritası');
    if (!ctx) return;

    const mountEl = document.getElementById('roadmap-mount');
    const { data: projects, error } = await ctx.sb
      .from('projects')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('last_worked_at', { ascending: false });

    if (error) {
      mountEl.innerHTML = `<div class="alert alert-danger">${PV.utils.escapeHtml(error.message)}</div>`;
      return;
    }

    const list = (projects || []).filter((p) => !p.is_archived);
    if (!list.length) {
      mountEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i data-lucide="compass" width="28" height="28"></i></div>
          <h3>Henüz aktif projeniz bulunmuyor</h3>
          <p>AI destekli adım adım yol haritası oluşturmak için önce bir proje ekleyin.</p>
          <a href="projects.html" class="btn btn-primary">Projelere Git</a>
        </div>
      `;
      PV.utils.renderIcons();
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const paramId = params.get('projectId');
    let selectedProject = list.find((p) => p.id === paramId) || list[0];

    const renderPage = async () => {
      mountEl.innerHTML = `
        <div class="card mb-6">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div class="flex items-center gap-3 flex-wrap" style="flex:1;min-width:240px;">
              <label class="form-label mb-0" for="rm-project-select" style="white-space:nowrap;">Aktif Proje:</label>
              <select id="rm-project-select" class="form-control" style="max-width:340px;"></select>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <a href="project-detail.html?id=${encodeURIComponent(selectedProject.id)}" class="btn btn-secondary btn-sm">
                <i data-lucide="folder-open" width="15" height="15"></i> Proje Detayı
              </a>
            </div>
          </div>
        </div>
        <div id="rm-inner-mount"></div>
      `;

      const sel = document.getElementById('rm-project-select');
      PV.utils.populateSelect(sel, list.map((p) => ({ value: p.id, label: `${p.title} (${p.progress || 0}%)` })));
      sel.value = selectedProject.id;
      sel.addEventListener('change', async () => {
        selectedProject = list.find((p) => p.id === sel.value) || list[0];
        await renderPage();
      });

      await mountProjectRoadmap({
        containerEl: document.getElementById('rm-inner-mount'),
        sb: ctx.sb,
        userId: ctx.user.id,
        project: selectedProject,
        onProjectUpdated: (updated) => {
          selectedProject = updated;
          const idx = list.findIndex((p) => p.id === updated.id);
          if (idx !== -1) list[idx] = updated;
          const opt = sel.querySelector(`option[value="${updated.id}"]`);
          if (opt) opt.textContent = `${updated.title} (${updated.progress || 0}%)`;
        }
      });
    };

    await renderPage();
  }

  async function mountProjectRoadmap({ containerEl, sb, userId, project, onProjectUpdated }) {
    if (!containerEl || !project) return;

    let steps = Array.isArray(project.roadmap_steps) ? project.roadmap_steps : [];
    let aiSummaryText = '';

    const ensureNodeModal = () => {
      let modal = document.getElementById('pv-roadmap-step-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'pv-roadmap-step-modal';
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
          <div class="modal">
            <div class="modal-header">
              <h3 class="modal-title" id="pv-rm-modal-title">Aşama Detayı</h3>
              <button type="button" class="btn-ghost btn-icon btn-sm" id="pv-rm-modal-close"><i data-lucide="x" width="18" height="18"></i></button>
            </div>
            <div class="modal-body" id="pv-rm-modal-body"></div>
            <div class="modal-footer" id="pv-rm-modal-footer"></div>
          </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('pv-rm-modal-close').addEventListener('click', () => PV.sb.closeModal(modal));
      }
      return modal;
    };

    const generateRoadmapWithAI = async () => {
      const genBtn = containerEl.querySelector('#rm-generate-ai-btn');
      if (genBtn) {
        genBtn.disabled = true;
        genBtn.innerHTML = '<div class="spinner"></div> AI Analiz Ediyor...';
      }

      try {
        const { data: sess } = await sb.auth.getSession();
        const res = await fetch('/.netlify/functions/ai-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sess?.session?.access_token}`
          },
          body: JSON.stringify({ mode: 'project_roadmap', projectId: project.id })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || 'AI yol haritası oluşturulamadı.');

        steps = Array.isArray(data.roadmap) ? data.roadmap : [];
        aiSummaryText = data.summary || '';
        project.roadmap_steps = steps;
        if (typeof data.progress === 'number') project.progress = data.progress;
        if (typeof onProjectUpdated === 'function') onProjectUpdated(project);

        if (PV.sound) PV.sound.playSound('complete');
        PV.sb.showToast('AI yol haritanız projenizin mevcut aşamasına göre güncellendi!', 'success');
        renderPath();
      } catch (err) {
        PV.sb.showToast(err.message, 'warning');
      } finally {
        if (genBtn) {
          genBtn.disabled = false;
          genBtn.innerHTML = '<i data-lucide="sparkles" width="16" height="16"></i> AI ile Yol Haritası Oluştur';
          PV.utils.renderIcons();
        }
      }
    };

    const saveRoadmapSteps = async (nextSteps, completedStepTitle = '') => {
      // Sıradaki tamamlanmamış ilk adımı otomatik 'current' yap
      let foundCurrent = false;
      const normalized = nextSteps.map((s) => {
        if (s.status === 'completed') return s;
        if (!foundCurrent) {
          foundCurrent = true;
          return { ...s, status: 'current' };
        }
        return { ...s, status: 'locked' };
      });

      const doneCount = normalized.filter((s) => s.status === 'completed').length;
      const newProgress = normalized.length ? Math.round((doneCount / normalized.length) * 100) : (project.progress || 0);
      const currentNode = normalized.find((s) => s.status === 'current');

      const updates = {
        roadmap_steps: normalized,
        progress: newProgress,
        last_worked_at: new Date().toISOString()
      };
      if (completedStepTitle) {
        updates.last_stage = `${completedStepTitle} tamamlandı. ${currentNode ? 'Sıradaki aşama: ' + currentNode.title : 'Tüm aşamalar tamamlandı!'}`;
      }

      const { data, error } = await sb
        .from('projects')
        .update(updates)
        .eq('id', project.id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        PV.sb.showToast(`İlerleme kaydedilemedi: ${error.message}`, 'error');
        return;
      }

      steps = normalized;
      Object.assign(project, data || updates);
      if (typeof onProjectUpdated === 'function') onProjectUpdated(project);
      renderPath();
    };

    const openStepModal = (stepIndex) => {
      const step = steps[stepIndex];
      if (!step) return;

      const modal = ensureNodeModal();
      const titleEl = document.getElementById('pv-rm-modal-title');
      const bodyEl = document.getElementById('pv-rm-modal-body');
      const footerEl = document.getElementById('pv-rm-modal-footer');

      const statusBadge =
        step.status === 'completed' ? '<span class="badge badge-success">Tamamlandı</span>' :
        step.status === 'current' ? '<span class="badge badge-cyan">Şu Anki Aşama</span>' :
        '<span class="badge badge-neutral">Kilitli (Sıradaki)</span>';

      titleEl.innerHTML = `<i data-lucide="${PV.utils.escapeHtml(step.icon || 'sparkles')}" width="18" height="18" class="text-cyan"></i> ${PV.utils.escapeHtml(step.title)}`;

      const topics = Array.isArray(step.topics) ? step.topics : [];
      const actions = Array.isArray(step.action_items) ? step.action_items : [];

      bodyEl.innerHTML = `
        <div class="flex items-center justify-between gap-2 flex-wrap mb-4">
          <span class="badge badge-purple">${PV.utils.escapeHtml(step.unit_title || `Ünite ${step.unit}`)}</span>
          ${statusBadge}
        </div>

        <div class="memory-block mb-3">
          <div class="memory-block-title"><i data-lucide="book-open" width="15" height="15"></i> Çalışılacak Konular</div>
          ${topics.length
            ? `<ul style="padding-left:1.2rem;display:flex;flex-direction:column;gap:0.35rem;font-size:0.9rem;">${topics.map((t) => `<li>${PV.utils.escapeHtml(t)}</li>`).join('')}</ul>`
            : '<p class="text-muted" style="font-size:0.86rem;">Bu aşama için konu başlığı tanımlanmamış.</p>'}
        </div>

        <div class="memory-block mb-3">
          <div class="memory-block-title"><i data-lucide="check-square" width="15" height="15"></i> Uygulama Adımları</div>
          ${actions.length
            ? `<ul style="padding-left:1.2rem;display:flex;flex-direction:column;gap:0.35rem;font-size:0.9rem;">${actions.map((a) => `<li>${PV.utils.escapeHtml(a)}</li>`).join('')}</ul>`
            : '<p class="text-muted" style="font-size:0.86rem;">Somut adım listesi yok.</p>'}
        </div>

        ${step.ai_tip ? `
          <div class="alert alert-info">
            <i data-lucide="sparkles" width="18" height="18" style="flex-shrink:0;"></i>
            <div><strong>AI Rehber İpucu:</strong><br>${PV.utils.escapeHtml(step.ai_tip)}</div>
          </div>
        ` : ''}
      `;

      if (step.status === 'current') {
        footerEl.innerHTML = `
          <button type="button" class="btn btn-secondary" id="pv-rm-step-cancel">Kapat</button>
          <button type="button" class="btn btn-primary" id="pv-rm-step-complete">
            <i data-lucide="check-circle-2" width="16" height="16"></i> Bu Bölümü Tamamla ve Devam Et
          </button>
        `;
        document.getElementById('pv-rm-step-complete').onclick = async () => {
          const next = steps.map((s, idx) => (idx === stepIndex ? { ...s, status: 'completed' } : s));
          PV.sb.closeModal(modal);
          if (PV.sound) PV.sound.playSound('complete');
          await saveRoadmapSteps(next, step.title);
          PV.sb.showToast(`Tebrikler! "${step.title}" tamamlandı, sıradaki aşama açıldı.`, 'success');
        };
      } else if (step.status === 'completed') {
        footerEl.innerHTML = `
          <button type="button" class="btn btn-secondary" id="pv-rm-step-reopen">Tekrar Aktif Et</button>
          <button type="button" class="btn btn-primary" id="pv-rm-step-cancel">Tamam</button>
        `;
        document.getElementById('pv-rm-step-reopen').onclick = async () => {
          const next = steps.map((s, idx) => (idx >= stepIndex ? { ...s, status: 'pending' } : s));
          PV.sb.closeModal(modal);
          await saveRoadmapSteps(next);
          PV.sb.showToast('Aşama yeniden aktif edildi.', 'info');
        };
      } else {
        footerEl.innerHTML = `
          <button type="button" class="btn btn-secondary" id="pv-rm-step-jump">Bu Aşamaya Atla</button>
          <button type="button" class="btn btn-primary" id="pv-rm-step-cancel">Kapat</button>
        `;
        document.getElementById('pv-rm-step-jump').onclick = async () => {
          const next = steps.map((s, idx) => (idx < stepIndex ? { ...s, status: 'completed' } : { ...s, status: 'pending' }));
          PV.sb.closeModal(modal);
          await saveRoadmapSteps(next);
          PV.sb.showToast(`"${step.title}" aktif aşama olarak ayarlandı.`, 'info');
        };
      }

      document.getElementById('pv-rm-step-cancel').onclick = () => PV.sb.closeModal(modal);
      PV.sb.openModal(modal);
      PV.utils.renderIcons();
    };

    const renderPath = () => {
      const doneCount = steps.filter((s) => s.status === 'completed').length;
      const totalCount = steps.length;
      const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : (project.progress || 0);
      const currentStep = steps.find((s) => s.status === 'current');

      // Adımları üniteye göre grupla
      const units = [];
      steps.forEach((s, globalIdx) => {
        const uNum = Number(s.unit) || 1;
        let grp = units.find((u) => u.unit === uNum);
        if (!grp) {
          grp = { unit: uNum, title: s.unit_title || `${uNum}. Kısım`, items: [] };
          units.push(grp);
        }
        grp.items.push({ ...s, globalIdx });
      });

      containerEl.innerHTML = `
        <div class="duo-shell">
          <!-- Üst Durum Çubuğu (Duolingo tarzdaki seri/ilerleme barı) -->
          <div class="duo-stats-bar card mb-4">
            <div class="flex items-center gap-4 flex-wrap">
              <div class="duo-stat-pill">
                <i data-lucide="flame" width="18" height="18" class="text-warning"></i>
                <span><strong>${doneCount}</strong> / ${totalCount} Bölüm</span>
              </div>
              <div class="duo-stat-pill">
                <i data-lucide="target" width="18" height="18" class="text-cyan"></i>
                <span>İlerleme: <strong>%${pct}</strong></span>
              </div>
              ${currentStep ? `<span class="badge badge-purple">Sıradaki: ${PV.utils.escapeHtml(currentStep.title)}</span>` : (totalCount ? '<span class="badge badge-success">Tüm Bölümler Tamamlandı! 🎉</span>' : '')}
            </div>
            <button type="button" class="btn btn-primary btn-sm" id="rm-generate-ai-btn">
              <i data-lucide="sparkles" width="16" height="16"></i> ${totalCount ? 'AI ile Rotayı Yenile' : 'AI ile Yol Haritası Oluştur'}
            </button>
          </div>

          ${aiSummaryText ? `
            <div class="alert alert-info mb-4">
              <i data-lucide="sparkles" width="18" height="18" style="flex-shrink:0;"></i>
              <div><strong>AI Değerlendirmesi:</strong> ${PV.utils.escapeHtml(aiSummaryText)}</div>
            </div>
          ` : ''}

          ${!totalCount ? `
            <div class="empty-state">
              <div class="empty-state-icon"><i data-lucide="compass" width="28" height="28"></i></div>
              <h3>Bu proje için henüz AI Yol Haritası oluşturulmamış</h3>
              <p>Yukarıdaki <strong>"AI ile Yol Haritası Oluştur"</strong> butonuna tıklayın; yapay zekâ projenizin mevcut durumunu inceleyip hangi aşamadan başlamanız gerektiğini ve çalışmanız gereken konuları çıkarsın.</p>
            </div>
          ` : units.map((u) => `
            <section class="duo-unit-section mb-6">
              <div class="duo-unit-banner">
                <div>
                  <div class="duo-unit-kicker">${u.unit}. KISIM • PROJE ROTASI</div>
                  <h2 class="duo-unit-title">${PV.utils.escapeHtml(u.title.replace(/^\d+\.\s*Kısım:\s*/i, ''))}</h2>
                </div>
                <div class="duo-unit-guide-icon" title="Ünite Bilgisi">
                  <i data-lucide="notebook-text" width="22" height="22"></i>
                </div>
              </div>

              <div class="duo-path">
                ${u.items.map((node, localIdx) => {
                  const offset = STEP_OFFSETS[localIdx % STEP_OFFSETS.length];
                  const stateCls = node.status === 'completed' ? 'is-completed' : (node.status === 'current' ? 'is-current' : 'is-locked');
                  const pillText = doneCount > 0 ? 'DEVAM ET' : 'BAŞLA';
                  return `
                    <div class="duo-node ${stateCls}" style="transform: translateX(${offset}px);">
                      ${node.status === 'current' ? `<div class="duo-start-pill">${pillText}</div>` : ''}
                      <button type="button" class="duo-node-btn" data-step-idx="${node.globalIdx}" aria-label="${PV.utils.escapeHtml(node.title)}">
                        <i data-lucide="${node.status === 'completed' ? 'check' : (node.status === 'locked' ? 'lock' : PV.utils.escapeHtml(node.icon || 'sparkles'))}" width="26" height="26"></i>
                      </button>
                      <div class="duo-node-label">${PV.utils.escapeHtml(node.title)}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </section>
          `).join('')}
        </div>
      `;

      containerEl.querySelector('#rm-generate-ai-btn')?.addEventListener('click', generateRoadmapWithAI);
      containerEl.querySelectorAll('.duo-node-btn').forEach((btn) => {
        btn.addEventListener('click', () => openStepModal(Number(btn.getAttribute('data-step-idx'))));
      });
      PV.utils.renderIcons();
    };

    renderPath();
  }

  PV.roadmap = {
    initRoadmapPage,
    mountProjectRoadmap
  };
})(window);
