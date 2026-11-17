/* ==========================================================================
   ProjectVault - ProjectVault AI Asistan Modülü (ai-assistant.html)
   Proje Hatırlatma, Proje Özeti, Sonraki Adım, Doküman Analizi, Fikir & S/C
   ========================================================================== */

(function (global) {
  'use strict';

  const PV = (global.PV = global.PV || {});
  let ctx = null;
  let conversations = [];
  let activeConversationId = null;
  let projects = [];

  async function initAiAssistantPage() {
    ctx = await PV.sb.initAppShell('ai-assistant', 'ProjectVault AI Asistanı');
    if (!ctx) return;

    await loadInitialData();
    bindEvents();
    checkAiStatusBanner();
  }

  function checkAiStatusBanner() {
    const banner = document.getElementById('ai-status-banner');
    if (!banner) return;
    if (!PV.config.AI_CONFIGURED) {
      banner.classList.remove('hidden');
      banner.innerHTML = `
        <i data-lucide="alert-triangle" width="18" height="18" style="flex-shrink:0;"></i>
        <div>
          <strong>AI Sağlayıcısı Henüz Yapılandırılmadı:</strong> Netlify ortam değişkenlerinde <code>GEMINI_API_KEY</code> (veya alternatif sağlayıcı için <code>AI_API_KEY</code>) tanımlanmadığında AI yanıtları üretilmez ve sahte yanıt gösterilmez.
        </div>
      `;
      PV.utils.renderIcons();
    } else {
      banner.classList.add('hidden');
    }
  }

  async function loadInitialData() {
    const [projRes, convRes] = await Promise.all([
      ctx.sb.from('projects').select('id,title,category,status').eq('user_id', ctx.user.id).order('last_worked_at', { ascending: false }),
      ctx.sb.from('ai_conversations').select('*').eq('user_id', ctx.user.id).order('updated_at', { ascending: false })
    ]);

    projects = projRes.data || [];
    conversations = convRes.data || [];

    PV.utils.populateSelect(
      document.getElementById('ai-project-context'),
      projects.map((p) => ({ value: p.id, label: `${p.title} (${p.status})` })),
      'Tüm Projeler (Genel Hafıza)'
    );

    renderConversationsList();
    if (conversations.length) {
      await selectConversation(conversations[0].id);
    } else {
      renderWelcomeMessages();
    }
  }

  function renderConversationsList() {
    const listEl = document.getElementById('ai-conv-list');
    if (!listEl) return;

    if (!conversations.length) {
      listEl.innerHTML = `<div class="text-muted text-center" style="font-size:0.82rem;padding:1rem;">Henüz sohbet geçmişi yok.</div>`;
      return;
    }

    listEl.innerHTML = conversations.map((c) => `
      <div class="flex items-center justify-between gap-2 ai-conv-item" data-id="${c.id}"
        style="padding:0.65rem 0.75rem;border-radius:var(--radius-sm);cursor:pointer;border:1px solid ${c.id === activeConversationId ? 'var(--accent-cyan)' : 'var(--border-color)'};background:${c.id === activeConversationId ? 'rgba(6,182,212,0.1)' : 'var(--bg-tertiary)'};">
        <div style="min-width:0;flex:1;">
          <div class="truncate" style="font-size:0.84rem;font-weight:600;">${PV.utils.escapeHtml(c.title)}</div>
          <div class="text-muted" style="font-size:0.72rem;">${PV.utils.formatDate(c.updated_at)}</div>
        </div>
        <button type="button" class="btn-ghost btn-icon btn-sm ai-del-conv text-danger" data-id="${c.id}" title="Sohbeti Sil">
          <i data-lucide="trash-2" width="13" height="13"></i>
        </button>
      </div>
    `).join('');

    listEl.querySelectorAll('.ai-conv-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.ai-del-conv')) return;
        selectConversation(item.getAttribute('data-id'));
      });
    });

    listEl.querySelectorAll('.ai-del-conv').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        await ctx.sb.from('ai_conversations').delete().eq('id', id).eq('user_id', ctx.user.id);
        if (activeConversationId === id) activeConversationId = null;
        await loadInitialData();
      });
    });

    PV.utils.renderIcons();
  }

  async function selectConversation(convId) {
    activeConversationId = convId;
    renderConversationsList();

    const conv = conversations.find((c) => c.id === convId);
    const projSel = document.getElementById('ai-project-context');
    if (conv && projSel && conv.project_id) {
      projSel.value = conv.project_id;
    }

    const { data: msgs } = await ctx.sb
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', convId)
      .eq('user_id', ctx.user.id)
      .order('created_at', { ascending: true });

    const area = document.getElementById('ai-messages-area');
    if (!msgs || !msgs.length) {
      renderWelcomeMessages();
      return;
    }

    area.innerHTML = msgs.map((m) => renderMessageBubble(m)).join('');
    area.scrollTop = area.scrollHeight;
  }

  function renderWelcomeMessages() {
    const area = document.getElementById('ai-messages-area');
    if (!area) return;
    area.innerHTML = `
      <div class="ai-msg ai-msg-assistant">
        <div style="font-weight:700;margin-bottom:0.4rem;" class="text-cyan">ProjectVault AI Hafıza Asistanı</div>
        <p>Merhaba! Kişisel proje kayıtlarınız, günlük notlarınız, teknik sorunlarınız, görevleriniz ve dokümanlarınız üzerinden size yardımcı olabilirim.</p>
        <p class="text-secondary mt-2" style="font-size:0.84rem;">
          Örnek sorular: "En son hangi projede çalışmıştım?", "YOLO projemde hangi sorunlar vardı?", "Don önleme robotunun teknik bileşenleri nelerdi?", "Bu hafta hangi görevleri tamamlamalıyım?"
        </p>
      </div>
    `;
  }

  function renderMessageBubble(m) {
    const isUser = m.role === 'user';
    const sources = Array.isArray(m.sources) ? m.sources : [];
    return `
      <div class="ai-msg ${isUser ? 'ai-msg-user' : 'ai-msg-assistant'}">
        <div style="white-space:pre-wrap;">${PV.utils.escapeHtml(m.content)}</div>
        ${sources.length ? `
          <div class="ai-sources-box">
            <strong>Dayanak Kayıtlar:</strong>
            <div class="chip-list mt-1">${sources.map((s) => `<span class="tech-chip">${PV.utils.escapeHtml(s)}</span>`).join('')}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  function bindEvents() {
    document.getElementById('ai-new-chat-btn')?.addEventListener('click', () => {
      activeConversationId = null;
      renderConversationsList();
      renderWelcomeMessages();
      document.getElementById('ai-prompt-input')?.focus();
    });

    document.querySelectorAll('.ai-quick-prompt').forEach((btn) => {
      btn.addEventListener('click', () => {
        const promptText = btn.getAttribute('data-prompt');
        const input = document.getElementById('ai-prompt-input');
        if (input) {
          input.value = promptText;
          input.focus();
        }
      });
    });

    document.getElementById('ai-chat-form')?.addEventListener('submit', handleSendMessage);
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('ai-prompt-input');
    const sendBtn = document.getElementById('ai-send-btn');
    const text = input.value.trim();
    if (!text) return;

    const projectId = document.getElementById('ai-project-context').value || null;
    const area = document.getElementById('ai-messages-area');

    // İlk hoş geldin mesajını temizle (henüz kullanıcı mesajı yoksa)
    if (!area.querySelector('.ai-msg-user')) {
      area.innerHTML = '';
    }

    area.insertAdjacentHTML('beforeend', renderMessageBubble({ role: 'user', content: text, sources: [] }));
    const loadingId = `ai-loading-${Date.now()}`;
    area.insertAdjacentHTML('beforeend', `<div id="${loadingId}" class="ai-msg ai-msg-assistant flex items-center gap-2"><div class="spinner"></div><span>Kayıtlarınız taranıyor ve yanıt hazırlanıyor...</span></div>`);
    area.scrollTop = area.scrollHeight;

    input.value = '';
    sendBtn.disabled = true;

    try {
      const { data: sess } = await ctx.sb.auth.getSession();
      const res = await fetch('/.netlify/functions/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sess?.session?.access_token}`
        },
        body: JSON.stringify({
          conversationId: activeConversationId,
          projectId,
          message: text
        })
      });

      const data = await res.json();
      document.getElementById(loadingId)?.remove();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'AI servisine bağlanılamadı.');
      }

      activeConversationId = data.conversationId || activeConversationId;
      area.insertAdjacentHTML('beforeend', renderMessageBubble({
        role: 'assistant',
        content: data.content,
        sources: data.sources || []
      }));
      area.scrollTop = area.scrollHeight;

      const { data: convRes } = await ctx.sb.from('ai_conversations').select('*').eq('user_id', ctx.user.id).order('updated_at', { ascending: false });
      conversations = convRes || [];
      renderConversationsList();
    } catch (err) {
      document.getElementById(loadingId)?.remove();
      area.insertAdjacentHTML('beforeend', `
        <div class="alert alert-warning">
          <i data-lucide="alert-triangle" width="18" height="18" style="flex-shrink:0;"></i>
          <div>${PV.utils.escapeHtml(err.message)}</div>
        </div>
      `);
      PV.utils.renderIcons();
      area.scrollTop = area.scrollHeight;
    } finally {
      sendBtn.disabled = false;
    }
  }

  PV.aiAssistant = { initAiAssistantPage };
})(window);
