/* ==========================================================================
   ProjectVault - İstatistikler & Performans Analitiği (statistics.html)
   Chart.js ile Gerçek Supabase Verilerinden Üretilen Grafikler
   ========================================================================== */

(function (global) {
  'use strict';

  const PV = (global.PV = global.PV || {});
  const charts = {};

  async function initStatisticsPage() {
    const ctx = await PV.sb.initAppShell('statistics', 'İstatistikler');
    if (!ctx) return;

    await loadAndRenderStats(ctx.sb, ctx.user.id);
  }

  async function loadAndRenderStats(sb, userId) {
    try {
      const [projR, taskR, ideaR, noteR, docR] = await Promise.all([
        sb.from('projects').select('*').eq('user_id', userId),
        sb.from('tasks').select('*').eq('user_id', userId),
        sb.from('ideas').select('*').eq('user_id', userId),
        sb.from('project_notes').select('*').eq('user_id', userId),
        sb.from('documents').select('id,file_size').eq('user_id', userId)
      ]);

      const projects = projR.data || [];
      const tasks = taskR.data || [];
      const ideas = ideaR.data || [];
      const notes = noteR.data || [];
      const docs = docR.data || [];

      const activeProjects = projects.filter((p) => !p.is_archived && !['Tamamlandı', 'Arşivlendi'].includes(p.status));
      const completedProjects = projects.filter((p) => p.status === 'Tamamlandı');
      const completedTasks = tasks.filter((t) => t.status === 'Tamamlandı');

      const setTxt = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(v);
      };

      setTxt('stat-total-proj', projects.length);
      setTxt('stat-active-proj', activeProjects.length);
      setTxt('stat-done-proj', completedProjects.length);
      setTxt('stat-done-tasks', completedTasks.length);
      setTxt('stat-total-notes', notes.length);
      setTxt('stat-total-ideas', ideas.length);
      setTxt('stat-total-docs', docs.length);

      renderCategoryChart(projects);
      renderStatusChart(projects);
      renderProjectProgressChart(projects);
      renderMonthlyTasksChart(tasks);
      renderWeeklyActivityChart(tasks, notes, projects);
    } catch (err) {
      PV.sb.showToast(`İstatistikler yüklenemedi: ${err.message}`, 'error');
    }
  }

  function themeColors() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return {
      text: isLight ? '#475569' : '#94a3b8',
      grid: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(148,163,184,0.12)',
      palette: ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#a855f7', '#64748b']
    };
  }

  function showEmptyCanvas(canvasId, msg) {
    const c = document.getElementById(canvasId);
    if (!c) return;
    c.parentElement.innerHTML = `<div class="empty-state" style="height:100%;display:flex;flex-direction:column;justify-content:center;"><p>${PV.utils.escapeHtml(msg)}</p></div>`;
  }

  function renderCategoryChart(projects) {
    if (!projects.length) return showEmptyCanvas('chart-categories', 'Henüz kategori dağılımı için proje yok.');
    const counts = {};
    projects.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });
    const tc = themeColors();
    const ctx = document.getElementById('chart-categories');
    if (charts.cat) charts.cat.destroy();
    charts.cat = new global.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(counts),
        datasets: [{ data: Object.values(counts), backgroundColor: tc.palette, borderWidth: 0 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: tc.text, boxWidth: 12 } } }
      }
    });
  }

  function renderStatusChart(projects) {
    if (!projects.length) return showEmptyCanvas('chart-statuses', 'Henüz durum dağılımı için proje yok.');
    const counts = {};
    projects.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1; });
    const tc = themeColors();
    const ctx = document.getElementById('chart-statuses');
    if (charts.status) charts.status.destroy();
    charts.status = new global.Chart(ctx, {
      type: 'pie',
      data: {
        labels: Object.keys(counts),
        datasets: [{ data: Object.values(counts), backgroundColor: ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#64748b', '#ec4899'], borderWidth: 0 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: tc.text, boxWidth: 12 } } }
      }
    });
  }

  function renderProjectProgressChart(projects) {
    const active = projects.filter((p) => !p.is_archived).slice(0, 10);
    if (!active.length) return showEmptyCanvas('chart-progress', 'İlerleme oranı gösterilecek proje bulunamadı.');
    const tc = themeColors();
    const ctx = document.getElementById('chart-progress');
    if (charts.progress) charts.progress.destroy();
    charts.progress = new global.Chart(ctx, {
      type: 'bar',
      data: {
        labels: active.map((p) => p.title.length > 24 ? p.title.slice(0, 24) + '…' : p.title),
        datasets: [{
          label: 'İlerleme (%)',
          data: active.map((p) => p.progress || 0),
          backgroundColor: 'rgba(6, 182, 212, 0.78)',
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, max: 100, ticks: { color: tc.text, callback: (v) => `${v}%` }, grid: { color: tc.grid } },
          y: { ticks: { color: tc.text }, grid: { display: false } }
        }
      }
    });
  }

  function renderMonthlyTasksChart(tasks) {
    const tc = themeColors();
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = new Intl.DateTimeFormat('tr-TR', { month: 'short', year: '2-digit' }).format(d);
      months.push({ key, label, count: 0 });
    }

    tasks.filter((t) => t.status === 'Tamamlandı').forEach((t) => {
      const dt = (t.completed_at || t.updated_at || '').slice(0, 7);
      const m = months.find((x) => x.key === dt);
      if (m) m.count += 1;
    });

    const ctx = document.getElementById('chart-monthly-tasks');
    if (charts.monthly) charts.monthly.destroy();
    charts.monthly = new global.Chart(ctx, {
      type: 'bar',
      data: {
        labels: months.map((m) => m.label),
        datasets: [{
          label: 'Tamamlanan Görevler',
          data: months.map((m) => m.count),
          backgroundColor: 'rgba(139, 92, 246, 0.78)',
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1, color: tc.text }, grid: { color: tc.grid } },
          x: { ticks: { color: tc.text }, grid: { display: false } }
        }
      }
    });
  }

  function renderWeeklyActivityChart(tasks, notes, projects) {
    const tc = themeColors();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = PV.utils.getIstanbulDateString(d);
      const label = new Intl.DateTimeFormat('tr-TR', { weekday: 'short', day: 'numeric' }).format(d);
      days.push({ key, label, tasksDone: 0, journalCount: 0 });
    }

    tasks.filter((t) => t.status === 'Tamamlandı').forEach((t) => {
      const key = (t.completed_at || t.updated_at || '').slice(0, 10);
      const day = days.find((d) => d.key === key);
      if (day) day.tasksDone += 1;
    });

    notes.forEach((n) => {
      const key = (n.note_date || n.created_at || '').slice(0, 10);
      const day = days.find((d) => d.key === key);
      if (day) day.journalCount += 1;
    });

    const ctx = document.getElementById('chart-weekly-activity');
    if (charts.weekly) charts.weekly.destroy();
    charts.weekly = new global.Chart(ctx, {
      type: 'line',
      data: {
        labels: days.map((d) => d.label),
        datasets: [
          {
            label: 'Tamamlanan Görev',
            data: days.map((d) => d.tasksDone),
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.16)',
            fill: true,
            tension: 0.35
          },
          {
            label: 'Günlük Kaydı',
            data: days.map((d) => d.journalCount),
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.16)',
            fill: true,
            tension: 0.35
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: tc.text } } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1, color: tc.text }, grid: { color: tc.grid } },
          x: { ticks: { color: tc.text }, grid: { color: tc.grid } }
        }
      }
    });
  }

  PV.statistics = { initStatisticsPage };
})(window);
