/* ==========================================================================
   ProjectVault - Ana Dashboard Modülü
   6 KPI Kartı + Bölümler A..F (Tamamen Gerçek Supabase Verileriyle)
   ========================================================================== */

(function (global) {
  'use strict';

  const PV = (global.PV = global.PV || {});
  let progressChartInstance = null;

  async function initDashboard() {
    const ctx = await PV.sb.initAppShell('dashboard', 'Dashboard');
    if (!ctx) return;

    const { sb, user, profile } = ctx;
    const greetEl = document.getElementById('dash-greeting');
    if (greetEl) {
      greetEl.textContent = `Hoş geldin, ${profile.full_name || user.email.split('@')[0]}`;
    }

    await loadDashboardData(sb, user);

    document.getElementById('dash-ai-insights-btn')?.addEventListener('click', () => {
      fetchAiInsights(sb);
    });
  }

  async function loadDashboardData(sb, user) {
    try {
      const [projR, ideaR, taskR, remR, noteR] = await Promise.all([
        sb.from('projects').select('*').eq('user_id', user.id).order('last_worked_at', { ascending: false }),
        sb.from('ideas').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        sb.from('tasks').select('*, projects(title)').eq('user_id', user.id).order('due_date', { ascending: true }),
        sb.from('reminders').select('*, projects(title)').eq('user_id', user.id).eq('is_active', true).order('next_remind_at', { ascending: true }),
        sb.from('project_notes').select('*, projects(title)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(8)
      ]);

      const projects = projR.data || [];
      const ideas = ideaR.data || [];
      const tasks = taskR.data || [];
      const reminders = remR.data || [];
      const notes = noteR.data || [];

      renderKPIs(projects, ideas, tasks, reminders);
      renderTodayTasks(sb, user, tasks);
      renderUpcomingReminders(reminders);
      renderRecentActivities(projects, notes, tasks);
      renderProgressChart(projects);
      renderRecentProjects(projects);
      renderSmartSuggestions(projects, tasks, reminders, ideas);
      PV.utils.renderIcons();
    } catch (err) {
      PV.sb.showToast(`Dashboard verileri yüklenemedi: ${err.message}`, 'error');
    }
  }

  function renderKPIs(projects, ideas, tasks, reminders) {
    const activeProjects = projects.filter((p) => !p.is_archived && !['Tamamlandı', 'Arşivlendi'].includes(p.status));
    const completedProjects = projects.filter((p) => p.status === 'Tamamlandı');
    const unconvertedIdeas = ideas.filter((i) => !i.is_converted);
    const pendingTasks = tasks.filter((t) => !['Tamamlandı'].includes(t.status));

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    };

    setVal('kpi-total-projects', projects.length);
    setVal('kpi-active-projects', activeProjects.length);
    setVal('kpi-ideas-count', unconvertedIdeas.length);
    setVal('kpi-completed-projects', completedProjects.length);
    setVal('kpi-pending-tasks', pendingTasks.length);
    setVal('kpi-upcoming-reminders', reminders.length);
  }

  function renderTodayTasks(sb, user, tasks) {
    const el = document.getElementById('dash-today-tasks');
    if (!el) return;

    const todayStr = PV.utils.getIstanbulDateString();
    const todayTasks = tasks.filter((t) => {
      if (t.status === 'Tamamlandı') return false;
      if (!t.due_date) return false;
      return t.due_date <= todayStr;
    });

    if (!todayTasks.length) {
      el.innerHTML = `
        <div class="empty-state" style="padding:1.75rem 1rem;">
          <p class="mb-2">Bugün için vadesi gelen bekleyen göreviniz yok.</p>
          <a href="projects.html" class="btn btn-secondary btn-sm">Projelerden Görev Ekle</a>
        </div>
      `;
      return;
    }

    el.innerHTML = todayTasks.slice(0, 6).map((t) => `
      <div class="flex items-center justify-between gap-3" style="padding:0.7rem 0.85rem;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);">
        <label class="flex items-center gap-3" style="cursor:pointer;min-width:0;flex:1;">
          <input type="checkbox" class="dash-task-check" data-task-id="${t.id}" data-project-id="${t.project_id || ''}" style="width:17px;height:17px;accent-color:var(--accent-cyan);">
          <div style="min-width:0;">
            <div class="truncate" style="font-weight:600;font-size:0.88rem;">${PV.utils.escapeHtml(t.title)}</div>
            <div class="text-muted" style="font-size:0.76rem;">
              ${t.projects?.title ? PV.utils.escapeHtml(t.projects.title) + ' • ' : ''}Son: ${PV.utils.formatDate(t.due_date)}
            </div>
          </div>
        </label>
        <span class="badge ${PV.utils.getPriorityBadgeClass(t.priority)}">${PV.utils.escapeHtml(t.priority)}</span>
      </div>
    `).join('');

    el.querySelectorAll('.dash-task-check').forEach((chk) => {
      chk.addEventListener('change', async (e) => {
        const taskId = e.target.getAttribute('data-task-id');
        const projectId = e.target.getAttribute('data-project-id');
        await sb.from('tasks').update({
          status: 'Tamamlandı',
          completion_percentage: 100,
          completed_at: new Date().toISOString()
        }).eq('id', taskId).eq('user_id', user.id);

        if (projectId && PV.tasks?.recalculateProjectProgress) {
          await PV.tasks.recalculateProjectProgress(sb, user.id, projectId);
        }
        PV.sb.showToast('Görev tamamlandı olarak işaretlendi.', 'success');
        await loadDashboardData(sb, user);
      });
    });
  }

  function renderUpcomingReminders(reminders) {
    const el = document.getElementById('dash-upcoming-reminders');
    if (!el) return;

    if (!reminders.length) {
      el.innerHTML = `
        <div class="empty-state" style="padding:1.75rem 1rem;">
          <p class="mb-2">Yaklaşan aktif alarm veya hatırlatma bulunmuyor.</p>
          <a href="calendar.html" class="btn btn-secondary btn-sm">Alarm Kur</a>
        </div>
      `;
      return;
    }

    el.innerHTML = reminders.slice(0, 5).map((r) => `
      <div class="flex items-center justify-between gap-3" style="padding:0.7rem 0.85rem;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);">
        <div style="min-width:0;">
          <div class="truncate" style="font-weight:600;font-size:0.88rem;">${PV.utils.escapeHtml(r.title)}</div>
          <div class="text-secondary" style="font-size:0.77rem;">
            <i data-lucide="clock" width="12" height="12" style="display:inline;vertical-align:middle;"></i>
            ${PV.utils.formatDateTime(r.next_remind_at)}
            ${r.projects?.title ? ' • ' + PV.utils.escapeHtml(r.projects.title) : ''}
          </div>
        </div>
        <span class="badge badge-cyan">${PV.utils.escapeHtml(r.repeat_type)}</span>
      </div>
    `).join('');
  }

  function renderRecentActivities(projects, notes, tasks) {
    const el = document.getElementById('dash-recent-activities');
    if (!el) return;

    const activities = [];
    projects.slice(0, 5).forEach((p) => {
      activities.push({
        at: p.updated_at || p.created_at,
        icon: 'folder-kanban',
        badge: 'Proje',
        badgeClass: 'badge-purple',
        text: `${p.title} (${p.status})`,
        href: `project-detail.html?id=${p.id}`
      });
    });

    notes.slice(0, 5).forEach((n) => {
      activities.push({
        at: n.created_at,
        icon: 'book-open',
        badge: 'Günlük',
        badgeClass: 'badge-cyan',
        text: `${n.projects?.title ? n.projects.title + ': ' : ''}${n.title}`,
        href: `project-detail.html?id=${n.project_id}&tab=journal`
      });
    });

    tasks.filter((t) => t.status === 'Tamamlandı').slice(0, 5).forEach((t) => {
      activities.push({
        at: t.completed_at || t.updated_at,
        icon: 'check-circle-2',
        badge: 'Tamamlandı',
        badgeClass: 'badge-success',
        text: t.title,
        href: t.project_id ? `project-detail.html?id=${t.project_id}&tab=tasks` : 'calendar.html'
      });
    });

    activities.sort((a, b) => new Date(b.at) - new Date(a.at));

    if (!activities.length) {
      el.innerHTML = `<div class="text-muted text-center" style="padding:1.5rem;">Henüz aktivite kaydı yok.</div>`;
      return;
    }

    el.innerHTML = activities.slice(0, 8).map((a) => `
      <a href="${a.href}" class="flex items-center justify-between gap-3" style="padding:0.62rem 0.75rem;border-radius:var(--radius-sm);background:var(--bg-tertiary);border:1px solid var(--border-color);color:inherit;">
        <div class="flex items-center gap-2" style="min-width:0;">
          <i data-lucide="${a.icon}" width="15" height="15" class="text-cyan" style="flex-shrink:0;"></i>
          <span class="truncate" style="font-size:0.86rem;">${PV.utils.escapeHtml(a.text)}</span>
        </div>
        <div class="flex items-center gap-2" style="flex-shrink:0;">
          <span class="badge ${a.badgeClass}">${a.badge}</span>
          <span class="text-muted" style="font-size:0.74rem;">${PV.utils.formatDate(a.at)}</span>
        </div>
      </a>
    `).join('');
  }

  function renderProgressChart(projects) {
    const canvas = document.getElementById('dash-progress-chart');
    if (!canvas || !global.Chart) return;

    const topProjects = projects.filter((p) => !p.is_archived).slice(0, 7);
    if (progressChartInstance) {
      progressChartInstance.destroy();
    }

    if (!topProjects.length) {
      const parent = canvas.parentElement;
      parent.innerHTML = `<div class="empty-state" style="height:100%;display:flex;flex-direction:column;justify-content:center;"><p>İlerleme grafiği için henüz aktif proje eklenmedi.</p></div>`;
      return;
    }

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const textColor = isLight ? '#475569' : '#94a3b8';
    const gridColor = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(148,163,184,0.12)';

    progressChartInstance = new global.Chart(canvas, {
      type: 'bar',
      data: {
        labels: topProjects.map((p) => p.title.length > 22 ? p.title.slice(0, 22) + '…' : p.title),
        datasets: [{
          label: 'İlerleme (%)',
          data: topProjects.map((p) => Number(p.progress) || 0),
          backgroundColor: ['rgba(139,92,246,0.75)', 'rgba(59,130,246,0.75)', 'rgba(6,182,212,0.75)', 'rgba(16,185,129,0.75)', 'rgba(99,102,241,0.75)', 'rgba(14,165,233,0.75)', 'rgba(168,85,247,0.75)'],
          borderRadius: 8,
          maxBarThickness: 36
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { color: textColor, callback: (v) => `${v}%` },
            grid: { color: gridColor }
          },
          x: {
            ticks: { color: textColor },
            grid: { display: false }
          }
        }
      }
    });
  }

  function renderRecentProjects(projects) {
    const el = document.getElementById('dash-recent-projects');
    if (!el) return;

    const visible = projects.filter((p) => !p.is_archived).slice(0, 4);
    if (!visible.length) {
      el.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon"><i data-lucide="folder-plus" width="26" height="26"></i></div>
          <h3>Henüz proje eklemediniz</h3>
          <p>İlk projenizi oluşturarak amaçlarını, teknolojilerini, görevlerini ve proje hafızasını kaydetmeye başlayın.</p>
          <a href="projects.html" class="btn btn-primary">Yeni Proje Oluştur</a>
        </div>
      `;
      return;
    }

    el.innerHTML = visible.map((p) => {
      const days = PV.utils.daysSince(p.last_worked_at);
      return `
        <div class="card card-interactive flex-col justify-between gap-3">
          <div>
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="badge badge-purple">${PV.utils.escapeHtml(p.category)}</span>
              <span class="badge ${PV.utils.getStatusBadgeClass(p.status)}">${PV.utils.escapeHtml(p.status)}</span>
            </div>
            <h3 style="font-size:1.05rem;font-weight:700;margin-bottom:0.35rem;">${PV.utils.escapeHtml(p.title)}</h3>
            <p class="text-secondary" style="font-size:0.84rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
              ${PV.utils.escapeHtml(p.short_description || p.purpose || 'Açıklama eklenmemiş.')}
            </p>
          </div>
          <div>
            <div class="flex items-center justify-between text-secondary mb-1" style="font-size:0.78rem;">
              <span>İlerleme</span>
              <span><strong>${p.progress || 0}%</strong></span>
            </div>
            <div class="progress-bar-wrap mb-3">
              <div class="progress-bar-fill" style="width:${p.progress || 0}%;"></div>
            </div>
            <div class="text-muted mb-3" style="font-size:0.76rem;">
              Son çalışma: ${PV.utils.formatDate(p.last_worked_at)}${days !== null ? ` (${days} gün önce)` : ''}
            </div>
            <div class="flex items-center gap-2">
              <button type="button" class="btn btn-memory btn-sm flex-1 dash-remind-btn" data-project-id="${p.id}">
                <i data-lucide="brain" width="14" height="14"></i> Hatırlat
              </button>
              <a href="project-detail.html?id=${encodeURIComponent(p.id)}" class="btn btn-secondary btn-sm">Detay</a>
            </div>
          </div>
        </div>
      `;
    }).join('');

    el.querySelectorAll('.dash-remind-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        PV.sb.openProjectMemoryReminderModal(btn.getAttribute('data-project-id'));
      });
    });
  }

  function renderSmartSuggestions(projects, tasks, reminders, ideas) {
    const el = document.getElementById('dash-smart-suggestions');
    if (!el) return;

    const suggestions = [];
    const todayStr = PV.utils.getIstanbulDateString();

    const overdueTasks = tasks.filter((t) => t.status !== 'Tamamlandı' && t.due_date && t.due_date < todayStr);
    if (overdueTasks.length) {
      suggestions.push({
        icon: 'alert-triangle',
        color: 'text-warning',
        title: `${overdueTasks.length} gecikmiş görev bulunuyor`,
        desc: `En eski geciken görev: "${overdueTasks[0].title}". Öncelik sırasını gözden geçirebilirsiniz.`
      });
    }

    const staleProjects = projects.filter((p) => {
      if (p.is_archived || ['Tamamlandı', 'Arşivlendi'].includes(p.status)) return false;
      const d = PV.utils.daysSince(p.last_worked_at);
      return d !== null && d >= 14;
    });
    if (staleProjects.length) {
      const oldest = staleProjects[staleProjects.length - 1];
      suggestions.push({
        icon: 'history',
        color: 'text-cyan',
        title: `${staleProjects.length} proje 14+ gündür güncellenmedi`,
        desc: `"${oldest.title}" projesinde nerede kaldığınızı hatırlamak için Proje Hafızasını açabilirsiniz.`
      });
    }

    const incompleteMemory = projects.filter((p) => !p.is_archived && (!p.purpose || !p.next_steps));
    if (incompleteMemory.length) {
      suggestions.push({
        icon: 'brain',
        color: 'text-purple',
        title: 'Proje Hafızası alanlarını tamamlayın',
        desc: `"${incompleteMemory[0].title}" projesinde amaç veya sonraki adımlar alanı boş. Aylar sonra geri döndüğünüzde hatırlamanızı kolaylaştırır.`
      });
    }

    const unconverted = ideas.filter((i) => !i.is_converted && i.priority === 'Kritik');
    if (unconverted.length) {
      suggestions.push({
        icon: 'lightbulb',
        color: 'text-success',
        title: 'Kritik öncelikli fikriniz projeye dönüşmeyi bekliyor',
        desc: `"${unconverted[0].title}" fikrini Fikir Havuzundan tek tıkla projeye dönüştürebilirsiniz.`
      });
    }

    if (!suggestions.length) {
      suggestions.push({
        icon: 'check-circle-2',
        color: 'text-success',
        title: 'Çalışma düzeniniz dengeli görünüyor',
        desc: projects.length
          ? 'Gecikmiş göreviniz bulunmuyor. İsterseniz AI analizinden kişisel odak önerisi alabilirsiniz.'
          : 'Yeni bir proje veya fikir ekleyerek ProjectVault hafızanızı oluşturmaya başlayın.'
      });
    }

    el.innerHTML = suggestions.map((s) => `
      <div class="flex items-start gap-3" style="padding:0.75rem;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);">
        <i data-lucide="${s.icon}" width="18" height="18" class="${s.color}" style="flex-shrink:0;margin-top:2px;"></i>
        <div>
          <div style="font-weight:600;font-size:0.88rem;">${PV.utils.escapeHtml(s.title)}</div>
          <div class="text-secondary" style="font-size:0.81rem;">${PV.utils.escapeHtml(s.desc)}</div>
        </div>
      </div>
    `).join('');
  }

  async function fetchAiInsights(sb) {
    const box = document.getElementById('dash-ai-insights-result');
    if (!box) return;
    box.classList.remove('hidden');
    box.innerHTML = `<div class="alert alert-info"><div class="spinner"></div><span>ProjectVault AI kayıtlarınıza göre öneriler hazırlıyor...</span></div>`;

    try {
      const { data: sess } = await sb.auth.getSession();
      const res = await fetch('/.netlify/functions/ai-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sess?.session?.access_token}`
        },
        body: JSON.stringify({ mode: 'dashboard_insights' })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'AI servisi yapılandırılmamış.');
      }
      box.innerHTML = `
        <div class="alert alert-success" style="flex-direction:column;">
          <div class="flex items-center gap-2"><strong><i data-lucide="sparkles" width="15" height="15"></i> AI Stratejik Önerileri</strong></div>
          <div class="pv-markdown" style="font-size:0.88rem;">${PV.utils.renderMarkdown(data.content)}</div>
        </div>
      `;
      PV.utils.renderIcons();
    } catch (err) {
      box.innerHTML = `<div class="alert alert-warning"><i data-lucide="info" width="17" height="17"></i><div>${PV.utils.escapeHtml(err.message)}</div></div>`;
      PV.utils.renderIcons();
    }
  }

  PV.dashboard = { initDashboard };
})(window);
