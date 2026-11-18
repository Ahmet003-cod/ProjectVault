/* ==========================================================================
   ProjectVault - Merkezi Yapılandırma ve Yardımcı Fonksiyonlar
   Güvenlik Notu: Bu dosyada yalnızca public (anon) bilgiler yer alır.
   GEMINI_API_KEY veya SUPABASE_SERVICE_ROLE_KEY asla frontend'de bulunmaz.
   ========================================================================== */

(function (global) {
  'use strict';

  const PV = (global.PV = global.PV || {});

  const APP_CONFIG = {
    APP_NAME: 'ProjectVault',
    TIMEZONE: 'Europe/Istanbul',
    SUPABASE_URL: (global.PROJECTVAULT_ENV && global.PROJECTVAULT_ENV.SUPABASE_URL) || localStorage.getItem('pv_supabase_url') || '',
    SUPABASE_ANON_KEY: (global.PROJECTVAULT_ENV && global.PROJECTVAULT_ENV.SUPABASE_ANON_KEY) || localStorage.getItem('pv_supabase_anon_key') || '',
    AI_PROVIDER: 'gemini',
    AI_CONFIGURED: false,
    MAX_FILE_SIZE_BYTES: 25 * 1024 * 1024, // 25 MB

    PROJECT_CATEGORIES: [
      'Yapay Zekâ',
      'Makine Öğrenmesi',
      'Derin Öğrenme',
      'Computer Vision',
      'Siber Güvenlik',
      'Agentic AI',
      'Web Geliştirme',
      'Mobil Uygulama',
      'Robotik',
      'Araştırma',
      'Diğer'
    ],

    PROJECT_STATUSES: [
      'Fikir Aşamasında',
      'Planlanıyor',
      'Geliştiriliyor',
      'Test Ediliyor',
      'Beklemede',
      'Tamamlandı',
      'Arşivlendi'
    ],

    PRIORITIES: ['Düşük', 'Orta', 'Yüksek', 'Kritik'],

    TASK_STATUSES: ['Yapılacak', 'Devam Ediyor', 'Tamamlandı', 'Ertelendi'],

    IDEA_DIFFICULTIES: ['Kolay', 'Orta', 'Zor', 'Çok Zor'],

    REPEAT_TYPES: ['Tek seferlik', 'Günlük', 'Haftalık', 'Aylık'],

    NOTIFICATION_METHODS: ['Uygulama İçi', 'Web Push', 'E-posta', 'Tümü'],

    ALARM_SOUNDS: [
      { value: 'crystal', label: 'Kristal Çan (Önerilen)' },
      { value: 'digital', label: 'Klasik Dijital Alarm' },
      { value: 'chord', label: 'Yumuşak Akor Melodisi' },
      { value: 'urgent', label: 'Acil Nabız Uyarısı' }
    ],

    TECH_NOTE_TYPES: [
      'Mimari',
      'Sorun Çözümü',
      'Kod Parçacığı',
      'Araştırma',
      'API / Yapılandırma',
      'Genel'
    ],

    DOCUMENT_CATEGORIES: [
      'Genel',
      'Teknik Doküman',
      'Mimari & Tasarım',
      'Araştırma / Makale',
      'Veri Seti / CSV',
      'Sunum',
      'Rapor',
      'Diğer'
    ],

    ALLOWED_DOCUMENT_EXTENSIONS: [
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
      'png', 'jpg', 'jpeg', 'txt', 'md', 'csv'
    ]
  };

  let runtimeLoaded = false;

  async function loadRuntimePublicConfig() {
    if (runtimeLoaded) return APP_CONFIG;
    runtimeLoaded = true;
    try {
      const res = await fetch('/.netlify/functions/ai-chat?action=public-config', {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.supabaseUrl && !localStorage.getItem('pv_supabase_url')) {
          APP_CONFIG.SUPABASE_URL = data.supabaseUrl;
        }
        if (data.supabaseAnonKey && !localStorage.getItem('pv_supabase_anon_key')) {
          APP_CONFIG.SUPABASE_ANON_KEY = data.supabaseAnonKey;
        }
        if (data.aiProvider) APP_CONFIG.AI_PROVIDER = data.aiProvider;
        APP_CONFIG.AI_CONFIGURED = Boolean(data.aiConfigured);
      }
    } catch (_) {
      // Yerel statik sunucu veya offline durumda sessizce devam et
    }
    return APP_CONFIG;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return '—';
      return new Intl.DateTimeFormat('tr-TR', {
        timeZone: APP_CONFIG.TIMEZONE,
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(d);
    } catch (_) {
      return String(dateStr);
    }
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return '—';
      return new Intl.DateTimeFormat('tr-TR', {
        timeZone: APP_CONFIG.TIMEZONE,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(d);
    } catch (_) {
      return String(dateStr);
    }
  }

  function getIstanbulDateString(dateObj = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_CONFIG.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(dateObj);
    const map = {};
    parts.forEach((p) => { map[p.type] = p.value; });
    return `${map.year}-${map.month}-${map.day}`;
  }

  function buildIstanbulISO(dateStr, timeStr) {
    // Europe/Istanbul sabit UTC+03:00 (2016'dan beri DST yok)
    const cleanTime = (timeStr || '09:00').slice(0, 5);
    return `${dateStr}T${cleanTime}:00+03:00`;
  }

  function daysSince(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    const diff = Date.now() - d.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }

  function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(n) / Math.log(k));
    return `${parseFloat((n / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  function parseCommaList(value) {
    if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean);
    if (!value) return [];
    return String(value)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function debounce(fn, wait = 280) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function getStatusBadgeClass(status) {
    switch (status) {
      case 'Tamamlandı': return 'badge-success';
      case 'Geliştiriliyor':
      case 'Devam Ediyor': return 'badge-blue';
      case 'Test Ediliyor': return 'badge-cyan';
      case 'Planlanıyor': return 'badge-purple';
      case 'Beklemede':
      case 'Ertelendi': return 'badge-warning';
      case 'Arşivlendi': return 'badge-neutral';
      default: return 'badge-purple';
    }
  }

  function getPriorityBadgeClass(priority) {
    switch (priority) {
      case 'Kritik': return 'badge-danger';
      case 'Yüksek': return 'badge-warning';
      case 'Orta': return 'badge-blue';
      case 'Düşük': return 'badge-neutral';
      default: return 'badge-neutral';
    }
  }

  function renderIcons() {
    if (global.lucide && typeof global.lucide.createIcons === 'function') {
      global.lucide.createIcons();
    }
  }

  function populateSelect(selectEl, items, includeAllLabel = '') {
    if (!selectEl) return;
    const current = selectEl.value;
    let html = includeAllLabel ? `<option value="">${escapeHtml(includeAllLabel)}</option>` : '';
    items.forEach((item) => {
      const val = typeof item === 'object' ? item.value : item;
      const label = typeof item === 'object' ? item.label : item;
      html += `<option value="${escapeHtml(val)}">${escapeHtml(label)}</option>`;
    });
    selectEl.innerHTML = html;
    if (current) selectEl.value = current;
  }

  function renderMarkdown(rawText) {
    if (!rawText) return '';
    const codeBlocks = [];
    let escaped = escapeHtml(String(rawText).replace(/\r\n/g, '\n'));

    // Fenced code blocks
    escaped = escaped.replace(/```[\w-]*\n([\s\S]*?)```/g, (_, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push(`<pre class="md-code-block"><code>${code.trimEnd()}</code></pre>`);
      return `\n@@CODEBLOCK_${idx}@@\n`;
    });

    const formatInline = (line) => {
      return line
        .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
        .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
    };

    const lines = escaped.split('\n');
    const out = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        i++;
        continue;
      }

      if (/^@@CODEBLOCK_\d+@@$/.test(trimmed)) {
        out.push(trimmed);
        i++;
        continue;
      }

      // Markdown Table
      if (
        trimmed.startsWith('|') &&
        i + 1 < lines.length &&
        /^\s*\|?[\s:-]+\|[\s|:-]+\s*$/.test(lines[i + 1])
      ) {
        const parseCells = (rowStr) =>
          rowStr.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => formatInline(c.trim()));

        const headers = parseCells(trimmed);
        i += 2;
        const bodyRows = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          bodyRows.push(parseCells(lines[i]));
          i++;
        }

        out.push(
          `<div class="md-table-wrap"><table class="md-table"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${bodyRows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
        );
        continue;
      }

      // Headings
      const hMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
      if (hMatch) {
        const level = Math.min(4, hMatch[1].length + 1);
        out.push(`<h${level} class="md-heading">${formatInline(hMatch[2])}</h${level}>`);
        i++;
        continue;
      }

      // Horizontal Rule
      if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
        out.push('<hr class="md-hr">');
        i++;
        continue;
      }

      // Bullet List
      if (/^([-*•])\s+/.test(trimmed)) {
        const items = [];
        while (i < lines.length && /^([-*•])\s+/.test(lines[i].trim())) {
          items.push(`<li>${formatInline(lines[i].trim().replace(/^([-*•])\s+/, ''))}</li>`);
          i++;
        }
        out.push(`<ul class="md-list">${items.join('')}</ul>`);
        continue;
      }

      // Numbered List
      if (/^\d+\.\s+/.test(trimmed)) {
        const items = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
          items.push(`<li>${formatInline(lines[i].trim().replace(/^\d+\.\s+/, ''))}</li>`);
          i++;
        }
        out.push(`<ol class="md-list">${items.join('')}</ol>`);
        continue;
      }

      // Paragraph
      const para = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(#{1,4}\s+|[-*•]\s+|\d+\.\s+|\||@@CODEBLOCK_)/.test(lines[i].trim())
      ) {
        para.push(formatInline(lines[i].trim()));
        i++;
      }
      out.push(`<p class="md-p">${para.join('<br>')}</p>`);
    }

    let html = out.join('');
    codeBlocks.forEach((blk, idx) => {
      html = html.replace(`@@CODEBLOCK_${idx}@@`, blk);
    });
    return html;
  }

  PV.config = APP_CONFIG;
  PV.loadRuntimePublicConfig = loadRuntimePublicConfig;
  PV.utils = {
    escapeHtml,
    renderMarkdown,
    formatDate,
    formatDateTime,
    getIstanbulDateString,
    buildIstanbulISO,
    daysSince,
    formatBytes,
    parseCommaList,
    debounce,
    getStatusBadgeClass,
    getPriorityBadgeClass,
    renderIcons,
    populateSelect
  };
})(window);
