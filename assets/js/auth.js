/* ==========================================================================
   ProjectVault - Kimlik Doğrulama Modülü (Giriş, Kayıt, Şifre Sıfırlama, Çıkış)
   ========================================================================== */

(function (global) {
  'use strict';

  const PV = (global.PV = global.PV || {});

  async function signOut() {
    const sb = PV.sb.getSupabaseClient() || (await PV.sb.initSupabase());
    if (sb) {
      await sb.auth.signOut();
    }
    sessionStorage.clear();
    window.location.href = 'login.html';
  }

  function setupPasswordToggles() {
    document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-toggle-password');
        const input = document.getElementById(targetId);
        if (!input) return;
        const isPass = input.type === 'password';
        input.type = isPass ? 'text' : 'password';
        btn.innerHTML = isPass
          ? '<i data-lucide="eye-off" width="18" height="18"></i>'
          : '<i data-lucide="eye" width="18" height="18"></i>';
        PV.utils.renderIcons();
      });
    });
  }

  function showAuthAlert(elId, message, type = 'danger') {
    const box = document.getElementById(elId);
    if (!box) return;
    box.className = `alert alert-${type} mb-4`;
    box.innerHTML = `<i data-lucide="${type === 'success' ? 'check-circle-2' : 'alert-circle'}" width="18" height="18" style="flex-shrink:0;"></i><div>${PV.utils.escapeHtml(message)}</div>`;
    box.classList.remove('hidden');
    PV.utils.renderIcons();
  }

  async function initLoginPage() {
    PV.sb.applyTheme(localStorage.getItem('pv_theme') || 'dark');
    setupPasswordToggles();

    const sb = await PV.sb.initSupabase();
    const configAlert = document.getElementById('auth-config-alert');
    const localDbInfo = document.getElementById('auth-local-db-info');
    const openCfgBtn = document.getElementById('open-sb-config-btn');

    openCfgBtn?.addEventListener('click', () => {
      PV.sb.openSupabaseConfigModal(() => window.location.reload());
    });

    if (!sb) {
      configAlert?.classList.remove('hidden');
      return;
    }

    if (!PV.sb.isSupabaseConfigured()) {
      localDbInfo?.classList.remove('hidden');
    }

    // Zaten giriş yapmışsa Dashboard'a yönlendir
    const { data: sess } = await sb.auth.getSession();
    if (sess?.session?.user && !window.location.hash.includes('type=recovery')) {
      window.location.href = 'dashboard.html';
      return;
    }

    // Şifre sıfırlama geri dönüşü (PASSWORD_RECOVERY)
    sb.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        PV.sb.openModal('reset-password-update-modal');
      }
    });

    // Beni hatırla kaydını doldur
    const remembered = localStorage.getItem('pv_remember_identifier');
    const identifierInput = document.getElementById('login-identifier');
    const rememberCheck = document.getElementById('login-remember');
    if (remembered && identifierInput) {
      identifierInput.value = remembered;
      if (rememberCheck) rememberCheck.checked = true;
    }

    const loginForm = document.getElementById('login-form');
    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('login-submit-btn');
      const identifier = identifierInput.value.trim();
      const password = document.getElementById('login-password').value;

      if (!identifier || !password) {
        showAuthAlert('login-alert', 'Lütfen e-posta/kullanıcı adı ve şifrenizi girin.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<div class="spinner"></div> Giriş Yapılıyor...';

      try {
        let emailToUse = identifier;
        if (!identifier.includes('@')) {
          const { data: resolvedEmail, error: rpcErr } = await sb.rpc('get_email_by_username', {
            p_username: identifier
          });
          if (rpcErr || !resolvedEmail) {
            throw new Error('Bu kullanıcı adına ait hesap bulunamadı.');
          }
          emailToUse = resolvedEmail;
        }

        const { data, error } = await sb.auth.signInWithPassword({
          email: emailToUse,
          password
        });

        if (error) {
          throw new Error(
            error.message === 'Invalid login credentials'
              ? 'E-posta/kullanıcı adı veya şifre hatalı.'
              : error.message
          );
        }

        if (rememberCheck?.checked) {
          localStorage.setItem('pv_remember_identifier', identifier);
        } else {
          localStorage.removeItem('pv_remember_identifier');
        }

        if (data?.user) {
          window.location.href = 'dashboard.html';
        }
      } catch (err) {
        showAuthAlert('login-alert', err.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-lucide="log-in" width="18" height="18"></i> Giriş Yap';
        PV.utils.renderIcons();
      }
    });

    // Şifremi Unuttum
    document.getElementById('forgot-password-trigger')?.addEventListener('click', (e) => {
      e.preventDefault();
      PV.sb.openModal('forgot-password-modal');
    });

    document.getElementById('forgot-password-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgot-email').value.trim();
      if (!email) return;
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        const redirectTo = `${window.location.origin}/login.html`;
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
        PV.sb.closeModal('forgot-password-modal');
        showAuthAlert('login-alert', 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.', 'success');
      } catch (err) {
        PV.sb.showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('reset-password-update-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const p1 = document.getElementById('recovery-new-password').value;
      if (p1.length < 6) {
        PV.sb.showToast('Şifre en az 6 karakter olmalıdır.', 'warning');
        return;
      }
      const { error } = await sb.auth.updateUser({ password: p1 });
      if (error) {
        PV.sb.showToast(error.message, 'error');
      } else {
        PV.sb.closeModal('reset-password-update-modal');
        showAuthAlert('login-alert', 'Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.', 'success');
      }
    });
  }

  async function initRegisterPage() {
    PV.sb.applyTheme(localStorage.getItem('pv_theme') || 'dark');
    setupPasswordToggles();

    const sb = await PV.sb.initSupabase();
    const configAlert = document.getElementById('auth-config-alert');
    document.getElementById('open-sb-config-btn')?.addEventListener('click', () => {
      PV.sb.openSupabaseConfigModal(() => window.location.reload());
    });

    if (!sb) {
      configAlert?.classList.remove('hidden');
      return;
    }

    const { data: sess } = await sb.auth.getSession();
    if (sess?.session?.user) {
      window.location.href = 'dashboard.html';
      return;
    }

    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = document.getElementById('reg-fullname').value.trim();
      const username = document.getElementById('reg-username').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const passwordConfirm = document.getElementById('reg-password-confirm').value;
      const submitBtn = document.getElementById('reg-submit-btn');

      if (!fullName || !email || !password) {
        showAuthAlert('register-alert', 'Lütfen zorunlu alanları doldurun.');
        return;
      }
      if (password.length < 6) {
        showAuthAlert('register-alert', 'Şifre en az 6 karakter olmalıdır.');
        return;
      }
      if (password !== passwordConfirm) {
        showAuthAlert('register-alert', 'Şifreler birbiriyle eşleşmiyor.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<div class="spinner"></div> Hesap Oluşturuluyor...';

      try {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              username: username || null
            },
            emailRedirectTo: `${window.location.origin}/dashboard.html`
          }
        });

        if (error) throw error;

        if (data?.session) {
          window.location.href = 'dashboard.html';
        } else {
          showAuthAlert(
            'register-alert',
            'Hesabınız oluşturuldu! Supabase e-posta doğrulaması açıksa gelen kutunuzdaki onay linkine tıklayıp giriş yapabilirsiniz.',
            'success'
          );
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i data-lucide="user-plus" width="18" height="18"></i> Hesap Oluştur';
          PV.utils.renderIcons();
        }
      } catch (err) {
        showAuthAlert('register-alert', err.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-lucide="user-plus" width="18" height="18"></i> Hesap Oluştur';
        PV.utils.renderIcons();
      }
    });
  }

  PV.auth = {
    signOut,
    initLoginPage,
    initRegisterPage
  };
})(window);
