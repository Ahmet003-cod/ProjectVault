/* ==========================================================================
   ProjectVault - Fikir Havuzu Modülü (ideas.html)
   Tek Tıklamayla Projeye Dönüştürme + AI ile Fikir Geliştirme
   ========================================================================== */

(function (global) {
  'use strict';

  const PV = (global.PV = global.PV || {});
  let ctx = null;
  let allIdeas = [];

  async function initIdeasPage() {
    ctx = await PV.sb.initAppShell('ideas', 'Fikir Havuzu');
    if (!ctx) return;

    PV.utils.populateSelect(document.getElementById('filter-idea-cat'), PV.config.PROJECT_CATEGORIES, 'Tüm Kategoriler');
    PV.utils.populateSelect(document.getElementById('filter-idea-prio'), PV.config.PRIORITIES, 'Tüm Öncelikler');
    PV.utils.populateSelect(document.getElementById('filter-idea-diff'), PV.config.IDEA_DIFFICULTIES, 'Tüm Zorluklar');

    PV.utils.populateSelect(document.getElementById('idea-category'), PV.config.PROJECT_CATEGORIES);
    PV.utils.populateSelect(document.getElementById('idea-priority'), PV.config.PRIORITIES);
    PV.utils.populateSelect(document.getElementById('idea-difficulty'), PV.config.IDEA_DIFFICULTIES);

    document.getElementById('new-idea-btn')?.addEventListener('click', () => openIdeaModal());
    document.querySelectorAll('[data-close-idea-modal]').forEach((b) => {
      b.addEventListener('click', () => PV.sb.closeModal('idea-form-modal'));
    });

    const filterFn = PV.utils.debounce(renderIdeas, 200);
    ['filter-idea-search', 'filter-idea-cat', 'filter-idea-prio', 'filter-idea-diff', 'filter-idea-status'].forEach((id) => {
      const el = document.getElementById(id);
      el?.addEventListener('input', filterFn);
      el?.addEventListener('change', filterFn);
    });

    document.getElementById('idea-form')?.addEventListener('submit', handleIdeaSave);

    await loadIdeas();
  }

  async function loadIdeas() {
    const { data, error } = await ctx.sb
      .from('ideas')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      PV.sb.showToast(`Fikirler yüklenemedi: ${error.message}`, 'error');
      return;
    }
    allIdeas = data || [];
    renderIdeas();
  }

  function renderIdeas() {
    const grid = document.getElementById('ideas-grid');
    if (!grid) return;

    const q = (document.getElementById('filter-idea-search')?.value || '').trim().toLowerCase();
    const cat = document.getElementById('filter-idea-cat')?.value || '';
    const prio = document.getElementById('filter-idea-prio')?.value || '';
    const diff = document.getElementById('filter-idea-diff')?.value || '';
    const statusFilter = document.getElementById('filter-idea-status')?.value || '';

    const filtered = allIdeas.filter((i) => {
      if (cat && i.category !== cat) return false;
      if (prio && i.priority !== prio) return false;
      if (diff && i.estimated_difficulty !== diff) return false;
      if (statusFilter === 'pending' && i.is_converted) return false;
      if (statusFilter === 'converted' && !i.is_converted) return false;
      if (q) {
        const hay = `${i.title} ${i.description} ${(i.tags || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1 / -1;">
          <div class="empty-state-icon"><i data-lucide="lightbulb" width="26" height="26"></i></div>
          <h3>${allIdeas.length ? 'Filtrelere uyan fikir bulunamadı' : 'Fikir havuzunuz henüz boş'}</h3>
          <p>Aklınıza gelen proje fikirlerini buraya kaydedin; hazır olduğunuzda tek tıkla tam kapsamlı bir projeye dönüştürün.</p>
          <button type="button" class="btn btn-primary" id="empty-new-idea-btn"><i data-lucide="plus" width="16" height="16"></i> Yeni Fikir Ekle</button>
        </div>
      `;
      document.getElementById('empty-new-idea-btn')?.addEventListener('click', () => openIdeaModal());
      PV.utils.renderIcons();
      return;
    }

    grid.innerHTML = filtered.map((idea) => `
      <article class="card card-interactive flex-col justify-between gap-3">
        <div>
          <div class="flex items-center justify-between gap-2 flex-wrap mb-2">
            <span class="badge badge-cyan">${PV.utils.escapeHtml(idea.category)}</span>
            <div class="flex items-center gap-1">
              <span class="badge ${PV.utils.getPriorityBadgeClass(idea.priority)}">${PV.utils.escapeHtml(idea.priority)}</span>
              <span class="badge badge-neutral">${PV.utils.escapeHtml(idea.estimated_difficulty)}</span>
            </div>
          </div>
          <h3 style="font-size:1.05rem;font-weight:700;margin-bottom:0.35rem;">${PV.utils.escapeHtml(idea.title)}</h3>
          <p class="text-secondary" style="font-size:0.86rem;white-space:pre-wrap;">${PV.utils.escapeHtml(idea.description || 'Açıklama girilmemiş.')}</p>
          ${(idea.tags && idea.tags.length) ? `<div class="chip-list mt-3">${idea.tags.map((t) => `<span class="tech-chip">#${PV.utils.escapeHtml(t)}</span>`).join('')}</div>` : ''}
          ${(idea.related_links && idea.related_links.length) ? `
            <div class="mt-3 flex-col gap-1">
              ${idea.related_links.map((lnk) => `<a href="${PV.utils.escapeHtml(lnk)}" target="_blank" rel="noopener noreferrer" class="truncate" style="font-size:0.78rem;"><i data-lucide="external-link" width="12" height="12" style="display:inline;"></i> ${PV.utils.escapeHtml(lnk)}</a>`).join('')}
            </div>
          ` : ''}
          ${idea.ai_suggestions ? `
            <div class="alert alert-info mt-3" style="font-size:0.8rem;">
              <div><strong>AI Önerisi:</strong><br><span style="white-space:pre-wrap;">${PV.utils.escapeHtml(idea.ai_suggestions)}</span></div>
            </div>
          ` : ''}
        </div>
        <div style="border-top:1px solid var(--border-color);padding-top:0.85rem;">
          <div class="flex items-center justify-between text-muted mb-2" style="font-size:0.75rem;">
            <span>Oluşturulma: ${PV.utils.formatDate(idea.created_at)}</span>
            ${idea.is_converted ? '<span class="badge badge-success">Projeye Dönüştürüldü</span>' : ''}
          </div>
          <div class="flex items-center justify-between gap-2 flex-wrap">
            ${idea.is_converted && idea.converted_project_id
              ? `<a href="project-detail.html?id=${encodeURIComponent(idea.converted_project_id)}" class="btn btn-secondary btn-sm flex-1"><i data-lucide="folder-open" width="14" height="14"></i> Projeye Git</a>`
              : `<button type="button" class="btn btn-primary btn-sm flex-1 idea-convert-btn" data-id="${idea.id}"><i data-lucide="rocket" width="14" height="14"></i> Projeye Dönüştür</button>`
            }
            <button type="button" class="btn btn-memory btn-sm idea-ai-btn" data-id="${idea.id}" title="AI ile Fikri Geliştir">
              <i data-lucide="sparkles" width="14" height="14"></i>
            </button>
            <button type="button" class="btn btn-ghost btn-icon btn-sm idea-edit-btn" data-id="${idea.id}" title="Düzenle"><i data-lucide="pencil" width="14" height="14"></i></button>
            <button type="button" class="btn btn-ghost btn-icon btn-sm idea-del-btn text-danger" data-id="${idea.id}" title="Sil"><i data-lucide="trash-2" width="14" height="14"></i></button>
          </div>
        </div>
      </article>
    `).join('');

    grid.querySelectorAll('.idea-convert-btn').forEach((b) => {
      b.addEventListener('click', () => convertIdeaToProject(b.getAttribute('data-id')));
    });
    grid.querySelectorAll('.idea-ai-btn').forEach((b) => {
      b.addEventListener('click', () => expandIdeaWithAI(b.getAttribute('data-id'), b));
    });
    grid.querySelectorAll('.idea-edit-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const idea = allIdeas.find((i) => i.id === b.getAttribute('data-id'));
        if (idea) openIdeaModal(idea);
      });
    });
    grid.querySelectorAll('.idea-del-btn').forEach((b) => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        const ok = await PV.sb.confirmDialog({ title: 'Fikri Sil', message: 'Bu fikri kalıcı olarak silmek istediğinize emin misiniz?' });
        if (!ok) return;
        const { error } = await ctx.sb.from('ideas').delete().eq('id', id).eq('user_id', ctx.user.id);
        if (error) return PV.sb.showToast(error.message, 'error');
        PV.sb.showToast('Fikir silindi.', 'success');
        await loadIdeas();
      });
    });

    PV.utils.renderIcons();
  }

  async function convertIdeaToProject(ideaId) {
    const idea = allIdeas.find((i) => i.id === ideaId);
    if (!idea) return;

    const ok = await PV.sb.confirmDialog({
      title: 'Fikri Projeye Dönüştür',
      message: `"${idea.title}" fikri açıklaması, kategorisi, etiketleri ve bağlantıları korunarak yeni bir projeye dönüştürülecek. Onaylıyor musunuz?`,
      confirmText: 'Evet, Projeye Dönüştür',
      danger: false
    });
    if (!ok) return;

    try {
      const { data: newProj, error: projErr } = await ctx.sb
        .from('projects')
        .insert({
          user_id: ctx.user.id,
          title: idea.title,
          short_description: (idea.description || '').slice(0, 260),
          purpose: idea.description || '',
          origin_idea: idea.description || '',
          motivation: `Fikir Havuzundan dönüştürüldü (Tahmini Zorluk: ${idea.estimated_difficulty}).${idea.ai_suggestions ? '\n\nAI Teknik Önerileri:\n' + idea.ai_suggestions : ''}`,
          category: idea.category,
          priority: idea.priority,
          status: 'Planlanıyor',
          tags: idea.tags || [],
          start_date: PV.utils.getIstanbulDateString(),
          last_worked_at: new Date().toISOString()
        })
        .select()
        .single();

      if (projErr) throw projErr;

      // İlgili bağlantıları ve orijinal fikir detaylarını kaybetmemek için teknik not olarak da ekle
      if ((idea.related_links && idea.related_links.length) || idea.ai_suggestions) {
        await ctx.sb.from('technical_notes').insert({
          user_id: ctx.user.id,
          project_id: newProj.id,
          title: 'Fikir Havuzu Referansları ve Bağlantılar',
          note_type: 'Araştırma',
          content: [
            idea.description ? `Fikir Açıklaması:\n${idea.description}` : '',
            idea.related_links?.length ? `İlgili Bağlantılar:\n${idea.related_links.join('\n')}` : '',
            idea.ai_suggestions ? `AI Önerileri:\n${idea.ai_suggestions}` : ''
          ].filter(Boolean).join('\n\n'),
          tags: idea.tags || []
        });
      }

      const { error: ideaErr } = await ctx.sb
        .from('ideas')
        .update({ is_converted: true, converted_project_id: newProj.id })
        .eq('id', idea.id)
        .eq('user_id', ctx.user.id);

      if (ideaErr) throw ideaErr;

      PV.sb.showToast('Fikir başarıyla projeye dönüştürüldü!', 'success');
      await loadIdeas();
    } catch (err) {
      PV.sb.showToast(`Dönüştürme hatası: ${err.message}`, 'error');
    }
  }

  async function expandIdeaWithAI(ideaId, btn) {
    const idea = allIdeas.find((i) => i.id === ideaId);
    if (!idea) return;

    btn.disabled = true;
    try {
      const { data: sess } = await ctx.sb.auth.getSession();
      const res = await fetch('/.netlify/functions/ai-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sess?.session?.access_token}`
        },
        body: JSON.stringify({ mode: 'idea_expand', ideaId: idea.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'AI servisi şu anda kullanılamıyor.');

      await ctx.sb
        .from('ideas')
        .update({ ai_suggestions: data.content })
        .eq('id', idea.id)
        .eq('user_id', ctx.user.id);

      PV.sb.showToast('AI fikir analizi ve teknik öneriler kaydedildi.', 'success');
      await loadIdeas();
    } catch (err) {
      PV.sb.showToast(err.message, 'warning');
    } finally {
      btn.disabled = false;
    }
  }

  function openIdeaModal(idea = null) {
    document.getElementById('idea-form').reset();
    document.getElementById('idea-id').value = idea?.id || '';
    document.getElementById('idea-modal-title').textContent = idea ? 'Fikri Düzenle' : 'Yeni Fikir Ekle';

    if (idea) {
      document.getElementById('idea-title').value = idea.title || '';
      document.getElementById('idea-desc').value = idea.description || '';
      document.getElementById('idea-category').value = idea.category || 'Diğer';
      document.getElementById('idea-priority').value = idea.priority || 'Orta';
      document.getElementById('idea-difficulty').value = idea.estimated_difficulty || 'Orta';
      document.getElementById('idea-tags').value = (idea.tags || []).join(', ');
      document.getElementById('idea-links').value = (idea.related_links || []).join('\n');
    } else {
      document.getElementById('idea-category').value = 'Yapay Zekâ';
      document.getElementById('idea-priority').value = 'Orta';
      document.getElementById('idea-difficulty').value = 'Orta';
    }

    PV.sb.openModal('idea-form-modal');
  }

  async function handleIdeaSave(e) {
    e.preventDefault();
    const id = document.getElementById('idea-id').value;
    const linksRaw = document.getElementById('idea-links').value || '';
    const relatedLinks = linksRaw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);

    const payload = {
      user_id: ctx.user.id,
      title: document.getElementById('idea-title').value.trim(),
      description: document.getElementById('idea-desc').value.trim(),
      category: document.getElementById('idea-category').value,
      priority: document.getElementById('idea-priority').value,
      estimated_difficulty: document.getElementById('idea-difficulty').value,
      tags: PV.utils.parseCommaList(document.getElementById('idea-tags').value),
      related_links: relatedLinks
    };

    if (!payload.title) {
      PV.sb.showToast('Fikir başlığı zorunludur.', 'warning');
      return;
    }

    const btn = document.getElementById('idea-save-btn');
    btn.disabled = true;
    try {
      if (id) {
        const { error } = await ctx.sb.from('ideas').update(payload).eq('id', id).eq('user_id', ctx.user.id);
        if (error) throw error;
        PV.sb.showToast('Fikir güncellendi.', 'success');
      } else {
        const { error } = await ctx.sb.from('ideas').insert(payload);
        if (error) throw error;
        PV.sb.showToast('Fikir havuzuna eklendi.', 'success');
      }
      PV.sb.closeModal('idea-form-modal');
      await loadIdeas();
    } catch (err) {
      PV.sb.showToast(`Fikir kaydedilemedi: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  PV.ideas = { initIdeasPage };
})(window);
