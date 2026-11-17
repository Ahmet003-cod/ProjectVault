'use strict';

const { jsonResponse, authenticateRequest } = require('./lib/supabase-auth');
const localDb = require('./lib/local-db');

/**
 * Europe/Istanbul zaman diliminde bir sonraki tekrarlama zamanını hesaplar.
 * Türkiye'de yaz/kış saati uygulaması olmadığından UTC+03:00 sabittir.
 */
function calculateNextRemindAt(currentIso, repeatType) {
  const istanbulOffsetMs = 3 * 60 * 60 * 1000;
  const localMs = new Date(currentIso).getTime() + istanbulOffsetMs;
  const d = new Date(localMs);

  if (repeatType === 'Günlük') {
    d.setUTCDate(d.getUTCDate() + 1);
  } else if (repeatType === 'Haftalık') {
    d.setUTCDate(d.getUTCDate() + 7);
  } else if (repeatType === 'Aylık') {
    d.setUTCMonth(d.getUTCMonth() + 1);
  } else {
    return currentIso;
  }

  return new Date(d.getTime() - istanbulOffsetMs).toISOString();
}

async function sendOptionalEmail(toEmail, subject, bodyText) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || !toEmail) return false;

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'ProjectVault <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendKey}`
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject,
      text: bodyText
    })
  });
  return res.ok;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {});

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let dbClient = null;
  let scopedUserId = null;

  if (!supabaseUrl) {
    // Yerleşik yerel veritabanı üzerinden alarmları işle
    dbClient = localDb.createServerLocalClient();
  } else {
    // 1) Netlify Scheduled Event veya CRON_SECRET ile yetkili çağrı
    const isScheduled = Boolean(event.headers?.['x-netlify-event'] === 'schedule' || event.body?.includes('"next_run"'));
    const cronSecret = process.env.CRON_SECRET;
    const providedSecret = event.headers?.['x-cron-secret'] || event.headers?.['X-Cron-Secret'];

    if (isScheduled || (cronSecret && providedSecret === cronSecret)) {
      if (!serviceRoleKey) {
        return jsonResponse(500, {
          error: 'MISSING_SERVICE_ROLE',
          message: 'Zamanlanmış alarm işleyici için SUPABASE_SERVICE_ROLE_KEY gereklidir.'
        });
      }
      const { createClient } = require('@supabase/supabase-js');
      dbClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
    } else {
      // 2) Oturum açmış kullanıcının kendi bekleyen alarmlarını tetiklemesi
      try {
        const auth = await authenticateRequest(event);
        dbClient = auth.supabase;
        scopedUserId = auth.user.id;
      } catch (err) {
        return jsonResponse(err.statusCode || 401, { error: 'UNAUTHORIZED', message: err.message });
      }
    }
  }

  try {
    const nowIso = new Date().toISOString();
    let query = dbClient
      .from('reminders')
      .select('*, projects(title)')
      .eq('is_active', true)
      .lte('next_remind_at', nowIso);

    if (scopedUserId) {
      query = query.eq('user_id', scopedUserId);
    }

    const { data: dueReminders, error: qErr } = await query;
    if (qErr) throw qErr;

    let processed = 0;
    const skipped = [];

    for (const r of dueReminders || []) {
      // Mükerrer gönderimi engelle: bu döngü için zaten gönderildiyse atla
      if (r.last_sent_at && new Date(r.last_sent_at) >= new Date(r.next_remind_at)) {
        skipped.push(r.id);
        continue;
      }

      const isOneTime = r.repeat_type === 'Tek seferlik';
      const nextAt = isOneTime ? r.next_remind_at : calculateNextRemindAt(r.next_remind_at, r.repeat_type);

      // Atomik kilitleme / güncelleme
      let updateQuery = dbClient
        .from('reminders')
        .update({
          last_sent_at: nowIso,
          next_remind_at: nextAt,
          is_active: !isOneTime,
          notification_status: isOneTime ? 'completed' : 'sent'
        })
        .eq('id', r.id)
        .eq('is_active', true);

      if (r.last_sent_at) {
        updateQuery = updateQuery.eq('last_sent_at', r.last_sent_at);
      } else {
        updateQuery = updateQuery.is('last_sent_at', null);
      }

      const { data: lockedRows, error: lockErr } = await updateQuery.select();
      if (lockErr || !lockedRows || !lockedRows.length) {
        skipped.push(r.id);
        continue;
      }

      let emailSent = false;
      if (r.notification_method === 'E-posta' || r.notification_method === 'Tümü') {
        const { data: profile } = await dbClient
          .from('profiles')
          .select('email, full_name')
          .eq('user_id', r.user_id)
          .maybeSingle();

        if (profile?.email) {
          emailSent = await sendOptionalEmail(
            profile.email,
            `[ProjectVault] Hatırlatma: ${r.title}`,
            `Merhaba ${profile.full_name || ''},\n\nPlanlanan alarm zamanınız geldi:\nBaşlık: ${r.title}\nProje: ${r.projects?.title || 'Genel'}\nAçıklama: ${r.description || '-'}\nZaman: ${r.next_remind_at} (Europe/Istanbul)`
          );
        }
      }

      await dbClient.from('notifications').insert({
        user_id: r.user_id,
        reminder_id: r.id,
        project_id: r.project_id,
        title: `⏰ Hatırlatma: ${r.title}`,
        message: r.description || (r.projects?.title ? `${r.projects.title} projesi için alarm zamanı.` : 'Planlanan alarm zamanı geldi.'),
        type: 'reminder',
        sent_via: emailSent ? `${r.notification_method} + E-posta` : r.notification_method
      });

      processed += 1;
    }

    return jsonResponse(200, {
      ok: true,
      processed,
      skippedCount: skipped.length,
      timestamp: nowIso,
      timezone: 'Europe/Istanbul'
    });
  } catch (err) {
    return jsonResponse(500, {
      error: 'PROCESS_REMINDERS_ERROR',
      message: err.message || 'Hatırlatmalar işlenirken hata oluştu.'
    });
  }
};
