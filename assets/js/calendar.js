/* ==========================================================================
   ProjectVault - Takvim (FullCalendar) ve Alarm Yönetimi Modülü (calendar.html)
   Aylık, Haftalık, Günlük Takvim + Proje Teslim, Görev ve Alarm Entegrasyonu
   ========================================================================== */

(function (global) {
  'use strict';

  const PV = (global.PV = global.PV || {});
  let ctx = null;
  let calendarInstance = null;
  let projects = [];
  let tasks = [];
  let reminders = [];
  let remModalCtrl = null;

  async function initCalendarPage() {
    ctx = await PV.sb.initAppShell('calendar', 'Takvim ve Alarmlar');
    if (!ctx) return;

    await loadCalendarData();
    bindCalendarControls();
    initFullCalendar();
    renderRemindersList();

    global.addEventListener('pv:reminder-triggered', () => {
      refreshAll();
    });
  }

  async function loadCalendarData() {
    const [projRes, taskRes, remRes] = await Promise.all([
      ctx.sb.from('projects').select('id,title,start_date,target_end_date,status,category').eq('user_id', ctx.user.id),
      ctx.sb.from('tasks').select('id,title,start_date,due_date,status,priority,project_id,projects(title)').eq('user_id', ctx.user.id),
      ctx.sb.from('reminders').select('*, projects(title)').eq('user_id', ctx.user.id).order('next_remind_at', { ascending: true })
    ]);

    projects = projRes.data || [];
    tasks = taskRes.data || [];
    reminders = remRes.data || [];

    remModalCtrl = PV.reminders.ensureReminderModal(ctx.sb, ctx.user.id, projects, async () => {
      await refreshAll();
    });
  }

  async function refreshAll() {
    await loadCalendarData();
    if (calendarInstance) {
      calendarInstance.removeAllEvents();
      calendarInstance.addEventSource(buildCalendarEvents());
    }
    renderRemindersList();
  }

  function buildCalendarEvents() {
    const events = [];

    // Proje teslim ve başlangıç tarihleri
    projects.forEach((p) => {
      if (p.target_end_date) {
        events.push({
          id: `proj-end-${p.id}`,
          title: `🎯 Teslim: ${p.title}`,
          start: p.target_end_date,
          allDay: true,
          backgroundColor: '#8b5cf6',
          borderColor: '#7c3aed',
          extendedProps: { kind: 'project', record: p }
        });
      }
      if (p.start_date) {
        events.push({
          id: `proj-start-${p.id}`,
          title: `🚀 Başlangıç: ${p.title}`,
          start: p.start_date,
          allDay: true,
          backgroundColor: '#06b6d4',
          borderColor: '#0891b2',
          extendedProps: { kind: 'project_plan', record: p }
        });
      }
    });

    // Görev tarihleri
    tasks.forEach((t) => {
      const dateVal = t.due_date || t.start_date;
      if (dateVal) {
        const done = t.status === 'Tamamlandı';
        events.push({
          id: `task-${t.id}`,
          title: `${done ? '✅' : '📌'} ${t.title}`,
          start: dateVal,
          allDay: true,
          backgroundColor: done ? '#10b981' : '#3b82f6',
          borderColor: done ? '#059669' : '#2563eb',
          extendedProps: { kind: 'task', record: t }
        });
      }
    });

    // Alarmlar
    reminders.forEach((r) => {
      if (!r.next_remind_at) return;
      events.push({
        id: `rem-${r.id}`,
        title: `⏰ ${r.title}`,
        start: r.next_remind_at,
        allDay: false,
        backgroundColor: r.is_active ? '#f59e0b' : '#64748b',
        borderColor: r.is_active ? '#d97706' : '#475569',
        extendedProps: { kind: 'reminder', record: r }
      });
    });

    return events;
  }

  function initFullCalendar() {
    const calEl = document.getElementById('pv-fullcalendar');
    if (!calEl || !global.FullCalendar) return;

    calendarInstance = new global.FullCalendar.Calendar(calEl, {
      initialView: 'dayGridMonth',
      locale: 'tr',
      timeZone: 'Europe/Istanbul',
      height: 'auto',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
      },
      buttonText: {
        today: 'Bugün',
        month: 'Aylık',
        week: 'Haftalık',
        day: 'Günlük',
        list: 'Liste'
      },
      events: buildCalendarEvents(),
      dateClick: (info) => {
        openQuickDayCreateModal(info.dateStr.slice(0, 10));
      },
      eventClick: (info) => {
        openEventDetailModal(info.event);
      }
    });

    calendarInstance.render();
  }

  function bindCalendarControls() {
    document.getElementById('cal-add-reminder-btn')?.addEventListener('click', () => remModalCtrl.open());
    document.getElementById('cal-add-task-btn')?.addEventListener('click', () => openQuickTaskModal());
    document.getElementById('cal-test-alarm-btn')?.addEventListener('click', () => {
      PV.sb.triggerAlarmRingingUI({
        id: 'test-calendar-alarm',
        title: 'ProjectVault Sesli Alarm Testi',
        description: 'Alarm zamanı geldiğinde seçtiğiniz bu zil sesi çalar ve bildirim penceresi açılır.',
        sound_type: localStorage.getItem('pv_default_alarm_sound') || 'crystal',
        next_remind_at: new Date().toISOString()
      });
    });

    document.querySelectorAll('[data-close-cal-task]').forEach((b) => {
      b.addEventListener('click', () => PV.sb.closeModal('cal-task-modal'));
    });
    document.querySelectorAll('[data-close-event-detail]').forEach((b) => {
      b.addEventListener('click', () => PV.sb.closeModal('cal-event-detail-modal'));
    });
    document.querySelectorAll('[data-close-day-choice]').forEach((b) => {
      b.addEventListener('click', () => PV.sb.closeModal('cal-day-choice-modal'));
    });

    PV.utils.populateSelect(document.getElementById('cal-task-priority'), PV.config.PRIORITIES);

    document.getElementById('cal-task-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const projId = document.getElementById('cal-task-project').value || null;
      const payload = {
        user_id: ctx.user.id,
        project_id: projId,
        title: document.getElementById('cal-task-title').value.trim(),
        description: document.getElementById('cal-task-desc').value.trim(),
        due_date: document.getElementById('cal-task-date').value || null,
        priority: document.getElementById('cal-task-priority').value,
        status: 'Yapılacak',
        completion_percentage: 0
      };
      if (!payload.title) return;

      const { error } = await ctx.sb.from('tasks').insert(payload);
      if (error) return PV.sb.showToast(error.message, 'error');
      PV.sb.closeModal('cal-task-modal');
      PV.sb.showToast('Görev takvime eklendi.', 'success');
      await refreshAll();
    });
  }

  function openQuickDayCreateModal(dateStr) {
    const labelEl = document.getElementById('cal-day-choice-label');
    if (labelEl) labelEl.textContent = `${PV.utils.formatDate(dateStr)} tarihi için ne oluşturmak istersiniz?`;

    document.getElementById('cal-choice-reminder-btn').onclick = () => {
      PV.sb.closeModal('cal-day-choice-modal');
      remModalCtrl.open(null, dateStr);
    };
    document.getElementById('cal-choice-task-btn').onclick = () => {
      PV.sb.closeModal('cal-day-choice-modal');
      openQuickTaskModal(dateStr);
    };

    PV.sb.openModal('cal-day-choice-modal');
  }

  function openQuickTaskModal(presetDate = null) {
    document.getElementById('cal-task-form').reset();
    PV.utils.populateSelect(
      document.getElementById('cal-task-project'),
      projects.map((p) => ({ value: p.id, label: p.title })),
      'Genel (Proje Seçilmedi)'
    );
    document.getElementById('cal-task-date').value = presetDate || PV.utils.getIstanbulDateString();
    document.getElementById('cal-task-priority').value = 'Orta';
    PV.sb.openModal('cal-task-modal');
  }

  function openEventDetailModal(event) {
    const props = event.extendedProps || {};
    const r = props.record || {};
    const titleEl = document.getElementById('cal-ev-title');
    const bodyEl = document.getElementById('cal-ev-body');
    const footerEl = document.getElementById('cal-ev-footer');

    titleEl.textContent = event.title;

    if (props.kind === 'reminder') {
      bodyEl.innerHTML = `
        <div class="flex-col gap-2">
          <div><strong>Zaman:</strong> ${PV.utils.formatDateTime(r.next_remind_at)} (Europe/Istanbul)</div>
          <div><strong>Tekrarlama:</strong> <span class="badge badge-cyan">${PV.utils.escapeHtml(r.repeat_type)}</span></div>
          <div><strong>Bildirim Yöntemi:</strong> ${PV.utils.escapeHtml(r.notification_method)}</div>
          <div><strong>Durum:</strong> ${r.is_active ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-neutral">Tamamlandı / Pasif</span>'}</div>
          ${r.projects?.title ? `<div><strong>Proje:</strong> ${PV.utils.escapeHtml(r.projects.title)}</div>` : ''}
          ${r.description ? `<p class="text-secondary mt-2">${PV.utils.escapeHtml(r.description)}</p>` : ''}
        </div>
      `;
      footerEl.innerHTML = `
        <button type="button" class="btn btn-secondary" id="cal-ev-edit-rem">Düzenle</button>
        <button type="button" class="btn btn-danger" id="cal-ev-del-rem">Sil</button>
      `;
      document.getElementById('cal-ev-edit-rem').onclick = () => {
        PV.sb.closeModal('cal-event-detail-modal');
        remModalCtrl.open(r);
      };
      document.getElementById('cal-ev-del-rem').onclick = async () => {
        PV.sb.closeModal('cal-event-detail-modal');
        await deleteReminder(r.id);
      };
    } else if (props.kind === 'task') {
      bodyEl.innerHTML = `
        <div class="flex-col gap-2">
          <div><strong>Durum:</strong> <span class="badge ${PV.utils.getStatusBadgeClass(r.status)}">${PV.utils.escapeHtml(r.status)}</span></div>
          <div><strong>Öncelik:</strong> <span class="badge ${PV.utils.getPriorityBadgeClass(r.priority)}">${PV.utils.escapeHtml(r.priority)}</span></div>
          <div><strong>Son Teslim:</strong> ${PV.utils.formatDate(r.due_date)}</div>
          ${r.projects?.title ? `<div><strong>Proje:</strong> ${PV.utils.escapeHtml(r.projects.title)}</div>` : ''}
        </div>
      `;
      footerEl.innerHTML = r.project_id
        ? `<a href="project-detail.html?id=${encodeURIComponent(r.project_id)}&tab=tasks" class="btn btn-primary">Proje Görevlerine Git</a>`
        : '';
    } else {
      bodyEl.innerHTML = `
        <div class="flex-col gap-2">
          <div><strong>Kategori:</strong> ${PV.utils.escapeHtml(r.category)}</div>
          <div><strong>Durum:</strong> <span class="badge ${PV.utils.getStatusBadgeClass(r.status)}">${PV.utils.escapeHtml(r.status)}</span></div>
          <div><strong>Başlangıç:</strong> ${PV.utils.formatDate(r.start_date)}</div>
          <div><strong>Hedef Bitiş:</strong> ${PV.utils.formatDate(r.target_end_date)}</div>
        </div>
      `;
      footerEl.innerHTML = `<a href="project-detail.html?id=${encodeURIComponent(r.id)}" class="btn btn-primary">Projeyi Aç</a>`;
    }

    PV.sb.openModal('cal-event-detail-modal');
  }

  async function deleteReminder(id) {
    const ok = await PV.sb.confirmDialog({ title: 'Alarmı Sil', message: 'Bu alarmı silmek istediğinize emin misiniz?' });
    if (!ok) return;
    const { error } = await ctx.sb.from('reminders').delete().eq('id', id).eq('user_id', ctx.user.id);
    if (error) return PV.sb.showToast(error.message, 'error');
    PV.sb.showToast('Alarm silindi.', 'success');
    await refreshAll();
  }

  function renderRemindersList() {
    const el = document.getElementById('cal-reminders-list');
    if (!el) return;

    if (!reminders.length) {
      el.innerHTML = `
        <div class="empty-state" style="padding:2rem 1rem;">
          <p class="mb-2">Henüz oluşturulmuş alarm bulunmuyor.</p>
          <button type="button" class="btn btn-primary btn-sm" id="cal-empty-rem-btn">İlk Alarmı Kur</button>
        </div>
      `;
      document.getElementById('cal-empty-rem-btn')?.addEventListener('click', () => remModalCtrl.open());
      return;
    }

    el.innerHTML = reminders.map((r) => `
      <div class="card flex-col gap-2" style="padding:0.95rem;">
        <div class="flex items-start justify-between gap-2">
          <div style="min-width:0;">
            <div style="font-weight:600;font-size:0.92rem;">${PV.utils.escapeHtml(r.title)}</div>
            <div class="text-secondary" style="font-size:0.78rem;">
              ${PV.utils.formatDateTime(r.next_remind_at)}
              ${r.projects?.title ? ' • ' + PV.utils.escapeHtml(r.projects.title) : ''}
            </div>
          </div>
          <span class="badge ${r.is_active ? 'badge-warning' : 'badge-neutral'}">${r.is_active ? 'Aktif' : 'Pasif'}</span>
        </div>
        <div class="flex items-center justify-between gap-2 mt-1">
          <div class="flex items-center gap-1">
            <span class="badge badge-cyan">${PV.utils.escapeHtml(r.repeat_type)}</span>
            <span class="badge badge-neutral">${PV.utils.escapeHtml(r.notification_method)}</span>
          </div>
          <div class="flex items-center gap-1">
            <button type="button" class="btn btn-ghost btn-icon btn-sm rem-edit-btn" data-id="${r.id}" title="Düzenle"><i data-lucide="pencil" width="14" height="14"></i></button>
            <button type="button" class="btn btn-ghost btn-icon btn-sm rem-del-btn text-danger" data-id="${r.id}" title="Sil"><i data-lucide="trash-2" width="14" height="14"></i></button>
          </div>
        </div>
      </div>
    `).join('');

    el.querySelectorAll('.rem-edit-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const item = reminders.find((x) => x.id === b.getAttribute('data-id'));
        if (item) remModalCtrl.open(item);
      });
    });
    el.querySelectorAll('.rem-del-btn').forEach((b) => {
      b.addEventListener('click', () => deleteReminder(b.getAttribute('data-id')));
    });

    PV.utils.renderIcons();
  }

  PV.calendar = { initCalendarPage };
})(window);
