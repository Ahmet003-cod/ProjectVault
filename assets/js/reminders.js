/* ==========================================================================
   ProjectVault - Alarm ve Hatırlatma Modülü (Europe/Istanbul Zaman Dilimi)
   Tek seferlik, Günlük, Haftalık, Aylık tekrarlama & Mükerrer gönderim koruması
   ========================================================================== */

(function (global) {
  'use strict';

  const PV = (global.PV = global.PV || {});

  function ensureReminderModal(sb, userId, projects, onSaved) {
    let modal = document.getElementById('pv-reminder-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pv-reminder-modal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title" id="pv-rem-modal-title"><i data-lucide="alarm-clock" width="18" height="18" class="text-cyan"></i> Alarm Kur</h3>
            <button type="button" class="btn-ghost btn-icon btn-sm" data-close-rem><i data-lucide="x" width="16" height="16"></i></button>
          </div>
          <form id="pv-rem-form">
            <div class="modal-body">
              <input type="hidden" id="pv-rem-id">
              <div class="form-group">
                <label class="form-label" for="pv-rem-title">Alarm Başlığı <span class="required">*</span></label>
                <input type="text" id="pv-rem-title" class="form-control" required placeholder="Örn: Don önleme robotu saha verilerini kontrol et">
              </div>
              <div class="form-group">
                <label class="form-label" for="pv-rem-desc">Açıklama</label>
                <textarea id="pv-rem-desc" class="form-control" placeholder="Hatırlatma detayları..."></textarea>
              </div>
              <div class="form-group">
                <label class="form-label" for="pv-rem-project">Bağlı Proje</label>
                <select id="pv-rem-project" class="form-control"></select>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="pv-rem-date">Tarih <span class="required">*</span></label>
                  <input type="date" id="pv-rem-date" class="form-control" required>
                </div>
                <div class="form-group">
                  <label class="form-label" for="pv-rem-time">Saat (Europe/Istanbul) <span class="required">*</span></label>
                  <input type="time" id="pv-rem-time" class="form-control" required>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="pv-rem-repeat">Tekrarlama Türü</label>
                  <select id="pv-rem-repeat" class="form-control"></select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="pv-rem-method">Bildirim Yöntemi</label>
                  <select id="pv-rem-method" class="form-control"></select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="pv-rem-sound">Alarm Sesi</label>
                <div class="flex gap-2">
                  <select id="pv-rem-sound" class="form-control flex-1"></select>
                  <button type="button" class="btn btn-secondary btn-sm" id="pv-rem-test-sound-btn" title="Seçili alarm sesini dinle">
                    <i data-lucide="volume-2" width="15" height="15"></i> Sesi Test Et
                  </button>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-close-rem>İptal</button>
              <button type="submit" class="btn btn-primary" id="pv-rem-save-btn">Alarmı Kaydet</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
      PV.utils.populateSelect(document.getElementById('pv-rem-repeat'), PV.config.REPEAT_TYPES);
      PV.utils.populateSelect(document.getElementById('pv-rem-method'), PV.config.NOTIFICATION_METHODS);
      PV.utils.populateSelect(document.getElementById('pv-rem-sound'), PV.config.ALARM_SOUNDS);
      document.getElementById('pv-rem-test-sound-btn')?.addEventListener('click', () => {
        const s = document.getElementById('pv-rem-sound')?.value || 'crystal';
        if (PV.sound) PV.sound.playSound(s);
      });
      modal.querySelectorAll('[data-close-rem]').forEach((b) => {
        b.addEventListener('click', () => PV.sb.closeModal(modal));
      });
    }

    PV.utils.populateSelect(
      document.getElementById('pv-rem-project'),
      (projects || []).map((p) => ({ value: p.id, label: p.title })),
      'Genel (Proje Bağlantısız)'
    );

    document.getElementById('pv-rem-form').onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('pv-rem-id').value;
      const dateStr = document.getElementById('pv-rem-date').value;
      const timeStr = document.getElementById('pv-rem-time').value;
      const remindIso = PV.utils.buildIstanbulISO(dateStr, timeStr);
      const method = document.getElementById('pv-rem-method').value;

      if ((method === 'Web Push' || method === 'Tümü') && 'Notification' in global && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      const payload = {
        user_id: userId,
        project_id: document.getElementById('pv-rem-project').value || null,
        title: document.getElementById('pv-rem-title').value.trim(),
        description: document.getElementById('pv-rem-desc').value.trim(),
        remind_date: dateStr,
        remind_time: timeStr,
        remind_at: remindIso,
        next_remind_at: remindIso,
        repeat_type: document.getElementById('pv-rem-repeat').value,
        notification_method: method,
        sound_type: document.getElementById('pv-rem-sound')?.value || 'crystal',
        notification_status: 'pending',
        is_active: true,
        timezone: 'Europe/Istanbul'
      };

      const btn = document.getElementById('pv-rem-save-btn');
      btn.disabled = true;
      try {
        if (id) {
          const { error } = await sb.from('reminders').update(payload).eq('id', id).eq('user_id', userId);
          if (error) throw error;
          PV.sb.showToast('Alarm güncellendi.', 'success');
        } else {
          const { error } = await sb.from('reminders').insert(payload);
          if (error) throw error;
          PV.sb.showToast('Alarm başarıyla kuruldu.', 'success');
        }
        PV.sb.closeModal(modal);
        if (typeof onSaved === 'function') await onSaved();
      } catch (err) {
        PV.sb.showToast(`Alarm kaydedilemedi: ${err.message}`, 'error');
      } finally {
        btn.disabled = false;
      }
    };

    return {
      open: (reminder = null, presetDate = null, presetProjectId = null) => {
        document.getElementById('pv-rem-form').reset();
        document.getElementById('pv-rem-id').value = reminder?.id || '';
        document.getElementById('pv-rem-modal-title').innerHTML = `<i data-lucide="alarm-clock" width="18" height="18" class="text-cyan"></i> ${reminder ? 'Alarmı Düzenle' : 'Yeni Alarm Kur'}`;

        if (reminder) {
          document.getElementById('pv-rem-title').value = reminder.title || '';
          document.getElementById('pv-rem-desc').value = reminder.description || '';
          document.getElementById('pv-rem-project').value = reminder.project_id || '';
          document.getElementById('pv-rem-date').value = reminder.remind_date || '';
          document.getElementById('pv-rem-time').value = (reminder.remind_time || '09:00').slice(0, 5);
          document.getElementById('pv-rem-repeat').value = reminder.repeat_type || 'Tek seferlik';
          document.getElementById('pv-rem-method').value = reminder.notification_method || 'Uygulama İçi';
          document.getElementById('pv-rem-sound').value = reminder.sound_type || localStorage.getItem('pv_default_alarm_sound') || 'crystal';
        } else {
          document.getElementById('pv-rem-date').value = presetDate || PV.utils.getIstanbulDateString();
          document.getElementById('pv-rem-time').value = '09:00';
          document.getElementById('pv-rem-project').value = presetProjectId || '';
          document.getElementById('pv-rem-repeat').value = 'Tek seferlik';
          document.getElementById('pv-rem-method').value = 'Uygulama İçi';
          document.getElementById('pv-rem-sound').value = localStorage.getItem('pv_default_alarm_sound') || 'crystal';
        }
        PV.sb.openModal(modal);
      }
    };
  }

  PV.reminders = {
    ensureReminderModal
  };
})(window);
