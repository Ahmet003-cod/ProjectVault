/* ==========================================================================
   ProjectVault - Doküman Yönetim Sistemi (Supabase Private Storage)
   13 Dosya Türü Desteği, Sürükle-Bırak Yükleme, Önizleme, İndirme ve AI Analizi
   ========================================================================== */

(function (global) {
  'use strict';

  const PV = (global.PV = global.PV || {});

  async function initDocumentsPage() {
    const ctx = await PV.sb.initAppShell('documents', 'Dokümanlar');
    if (!ctx) return;

    const mountEl = document.getElementById('documents-mount');
    await mountDocumentsView({
      containerEl: mountEl,
      sb: ctx.sb,
      userId: ctx.user.id,
      fixedProjectId: null
    });
  }

  async function mountDocumentsView({ containerEl, sb, userId, fixedProjectId = null }) {
    if (!containerEl) return;

    let selectedFiles = [];
    let projects = [];
    let documents = [];

    const fetchProjects = async () => {
      const { data } = await sb.from('projects').select('id,title').eq('user_id', userId).order('title');
      projects = data || [];
    };

    const fetchDocuments = async () => {
      let query = sb
        .from('documents')
        .select('*, projects(title)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (fixedProjectId) {
        query = query.eq('project_id', fixedProjectId);
      }
      const { data, error } = await query;
      if (error) {
        PV.sb.showToast(`Dokümanlar yüklenemedi: ${error.message}`, 'error');
        return;
      }
      documents = data || [];
    };

    const renderShell = () => {
      containerEl.innerHTML = `
        <div class="card mb-6">
          <div class="card-header">
            <div>
              <h3 class="card-title"><i data-lucide="upload-cloud" width="18" height="18" class="text-cyan"></i> Güvenli Doküman Yükleme</h3>
              <p class="card-subtitle">Desteklenen türler: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, PNG, JPG, JPEG, TXT, MD, CSV (Maks. 25 MB)</p>
            </div>
          </div>
          <div class="dropzone" id="pv-doc-dropzone">
            <i data-lucide="file-up" width="34" height="34" class="text-cyan" style="margin:0 auto 0.65rem;"></i>
            <div style="font-weight:600;">Dosyaları buraya sürükleyip bırakın veya seçmek için tıklayın</div>
            <div class="text-muted mt-1" style="font-size:0.82rem;">Dosyalar özel Supabase Storage alanında yalnızca sizin erişiminize açık olarak saklanır.</div>
            <input type="file" id="pv-doc-file-input" class="hidden" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt,.md,.csv">
          </div>
          <div id="pv-doc-pending-wrap" class="hidden mt-4">
            <div id="pv-doc-pending-list" class="mb-3 flex-col gap-2"></div>
            <div class="form-row">
              ${fixedProjectId ? '' : `
                <div class="form-group">
                  <label class="form-label" for="pv-doc-project">Bağlı Proje</label>
                  <select id="pv-doc-project" class="form-control"></select>
                </div>
              `}
              <div class="form-group">
                <label class="form-label" for="pv-doc-category">Kategori</label>
                <select id="pv-doc-category" class="form-control"></select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="pv-doc-desc">Doküman Açıklaması</label>
              <input type="text" id="pv-doc-desc" class="form-control" placeholder="Bu doküman projenin hangi aşamasıyla ilgili?">
            </div>
            <div class="flex items-center justify-end gap-2">
              <button type="button" class="btn btn-secondary btn-sm" id="pv-doc-clear-btn">Temizle</button>
              <button type="button" class="btn btn-primary btn-sm" id="pv-doc-upload-btn"><i data-lucide="upload" width="15" height="15"></i> Yüklemeyi Başlat</button>
            </div>
          </div>
        </div>

        <div class="filter-bar">
          <div class="search-input-wrap">
            <i data-lucide="search" width="16" height="16"></i>
            <input type="search" id="pv-doc-search" class="form-control" placeholder="Dosya adı veya açıklamada ara...">
          </div>
          ${fixedProjectId ? '' : `<select id="pv-doc-filter-project" class="form-control"></select>`}
          <select id="pv-doc-filter-cat" class="form-control"></select>
        </div>

        <div id="pv-doc-list-wrap"></div>
      `;

      if (!fixedProjectId) {
        const projOpts = projects.map((p) => ({ value: p.id, label: p.title }));
        PV.utils.populateSelect(document.getElementById('pv-doc-project'), projOpts, 'Proje Seçilmedi (Genel)');
        PV.utils.populateSelect(document.getElementById('pv-doc-filter-project'), projOpts, 'Tüm Projeler');
      }
      PV.utils.populateSelect(document.getElementById('pv-doc-category'), PV.config.DOCUMENT_CATEGORIES);
      PV.utils.populateSelect(document.getElementById('pv-doc-filter-cat'), PV.config.DOCUMENT_CATEGORIES, 'Tüm Kategoriler');

      const dropzone = document.getElementById('pv-doc-dropzone');
      const fileInput = document.getElementById('pv-doc-file-input');

      const acceptFiles = (fileList) => {
        const valid = [];
        for (const f of fileList) {
          const ext = (f.name.split('.').pop() || '').toLowerCase();
          if (!PV.config.ALLOWED_DOCUMENT_EXTENSIONS.includes(ext)) {
            PV.sb.showToast(`"${f.name}" desteklenmeyen dosya türü (.${ext}).`, 'warning');
            continue;
          }
          if (f.size > PV.config.MAX_FILE_SIZE_BYTES) {
            PV.sb.showToast(`"${f.name}" 25 MB sınırını aşıyor.`, 'warning');
            continue;
          }
          valid.push(f);
        }
        if (!valid.length) return;
        selectedFiles = [...selectedFiles, ...valid];
        renderPendingFiles();
      };

      const renderPendingFiles = () => {
        const wrap = document.getElementById('pv-doc-pending-wrap');
        const list = document.getElementById('pv-doc-pending-list');
        if (!selectedFiles.length) {
          wrap.classList.add('hidden');
          return;
        }
        wrap.classList.remove('hidden');
        list.innerHTML = selectedFiles.map((f, idx) => `
          <div class="flex items-center justify-between gap-2" style="padding:0.55rem 0.75rem;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);font-size:0.84rem;">
            <span class="truncate"><strong>${PV.utils.escapeHtml(f.name)}</strong> (${PV.utils.formatBytes(f.size)})</span>
            <button type="button" class="btn-ghost btn-icon btn-sm pv-pending-rem" data-idx="${idx}"><i data-lucide="x" width="14" height="14"></i></button>
          </div>
        `).join('');
        list.querySelectorAll('.pv-pending-rem').forEach((b) => {
          b.addEventListener('click', () => {
            selectedFiles.splice(Number(b.getAttribute('data-idx')), 1);
            renderPendingFiles();
          });
        });
        PV.utils.renderIcons();
      };

      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer?.files?.length) acceptFiles(e.dataTransfer.files);
      });
      fileInput.addEventListener('change', (e) => {
        if (e.target.files?.length) acceptFiles(e.target.files);
        fileInput.value = '';
      });

      document.getElementById('pv-doc-clear-btn').addEventListener('click', () => {
        selectedFiles = [];
        renderPendingFiles();
      });

      document.getElementById('pv-doc-upload-btn').addEventListener('click', async () => {
        if (!selectedFiles.length) return;
        const btn = document.getElementById('pv-doc-upload-btn');
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner"></div> Yükleniyor...';

        const projectId = fixedProjectId || (document.getElementById('pv-doc-project')?.value || null);
        const category = document.getElementById('pv-doc-category').value;
        const description = document.getElementById('pv-doc-desc').value.trim();

        try {
          for (const file of selectedFiles) {
            const ext = (file.name.split('.').pop() || '').toLowerCase();
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `${userId}/${projectId || 'general'}/${Date.now()}_${safeName}`;

            let extractedText = null;
            if (['txt', 'md', 'csv'].includes(ext) && file.size <= 1024 * 1024) {
              extractedText = await file.text();
            }

            const { error: upErr } = await sb.storage
              .from('project-documents')
              .upload(storagePath, file, { contentType: file.type || 'application/octet-stream' });

            if (upErr) throw upErr;

            const { error: dbErr } = await sb.from('documents').insert({
              user_id: userId,
              project_id: projectId || null,
              file_name: file.name,
              file_type: ext.toUpperCase(),
              mime_type: file.type || 'application/octet-stream',
              file_size: file.size,
              storage_bucket: 'project-documents',
              storage_path: storagePath,
              description,
              category,
              extracted_text: extractedText
            });

            if (dbErr) throw dbErr;
          }

          PV.sb.showToast(`${selectedFiles.length} doküman güvenle yüklendi.`, 'success');
          selectedFiles = [];
          document.getElementById('pv-doc-desc').value = '';
          renderPendingFiles();
          await fetchDocuments();
          renderDocumentsList();
        } catch (err) {
          PV.sb.showToast(`Yükleme hatası: ${err.message}`, 'error');
        } finally {
          btn.disabled = false;
          btn.innerHTML = '<i data-lucide="upload" width="15" height="15"></i> Yüklemeyi Başlat';
          PV.utils.renderIcons();
        }
      });

      const filterFn = PV.utils.debounce(renderDocumentsList, 180);
      document.getElementById('pv-doc-search')?.addEventListener('input', filterFn);
      document.getElementById('pv-doc-filter-project')?.addEventListener('change', filterFn);
      document.getElementById('pv-doc-filter-cat')?.addEventListener('change', filterFn);
    };

    const renderDocumentsList = () => {
      const wrap = document.getElementById('pv-doc-list-wrap');
      if (!wrap) return;

      const q = (document.getElementById('pv-doc-search')?.value || '').trim().toLowerCase();
      const projFilter = document.getElementById('pv-doc-filter-project')?.value || '';
      const catFilter = document.getElementById('pv-doc-filter-cat')?.value || '';

      const filtered = documents.filter((d) => {
        if (projFilter && d.project_id !== projFilter) return false;
        if (catFilter && d.category !== catFilter) return false;
        if (q && !`${d.file_name} ${d.description} ${d.category}`.toLowerCase().includes(q)) return false;
        return true;
      });

      if (!filtered.length) {
        wrap.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon"><i data-lucide="file-text" width="26" height="26"></i></div>
            <h3>Henüz doküman bulunmuyor</h3>
            <p>Projenize ait PDF, Word, Excel, sunum, görsel veya teknik markdown dosyalarını yukarıdan yükleyebilirsiniz.</p>
          </div>
        `;
        PV.utils.renderIcons();
        return;
      }

      wrap.innerHTML = `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Dosya Adı</th>
                <th>Tür</th>
                <th>Boyut</th>
                ${fixedProjectId ? '' : '<th>Proje</th>'}
                <th>Kategori</th>
                <th>Tarih</th>
                <th style="text-align:right;">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map((d) => `
                <tr>
                  <td>
                    <div style="font-weight:600;">${PV.utils.escapeHtml(d.file_name)}</div>
                    ${d.description ? `<div class="text-muted" style="font-size:0.78rem;">${PV.utils.escapeHtml(d.description)}</div>` : ''}
                    ${d.ai_summary ? `<div class="mt-1"><span class="badge badge-cyan">AI Özet Hazır</span></div>` : ''}
                  </td>
                  <td><span class="tech-chip">${PV.utils.escapeHtml(d.file_type)}</span></td>
                  <td class="text-secondary">${PV.utils.formatBytes(d.file_size)}</td>
                  ${fixedProjectId ? '' : `<td>${d.projects?.title ? PV.utils.escapeHtml(d.projects.title) : '<span class="text-muted">Genel</span>'}</td>`}
                  <td><span class="badge badge-neutral">${PV.utils.escapeHtml(d.category)}</span></td>
                  <td class="text-secondary">${PV.utils.formatDate(d.created_at)}</td>
                  <td style="text-align:right;">
                    <div class="flex items-center justify-end gap-1">
                      <button type="button" class="btn btn-secondary btn-sm doc-preview-btn" data-id="${d.id}" title="Görüntüle">
                        <i data-lucide="eye" width="14" height="14"></i>
                      </button>
                      <button type="button" class="btn btn-secondary btn-sm doc-download-btn" data-id="${d.id}" title="İndir">
                        <i data-lucide="download" width="14" height="14"></i>
                      </button>
                      <button type="button" class="btn btn-memory btn-sm doc-analyze-btn" data-id="${d.id}" title="AI ile Analiz Et">
                        <i data-lucide="sparkles" width="14" height="14"></i>
                      </button>
                      <button type="button" class="btn btn-ghost btn-icon btn-sm doc-del-btn text-danger" data-id="${d.id}" title="Sil">
                        <i data-lucide="trash-2" width="14" height="14"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      wrap.querySelectorAll('.doc-preview-btn').forEach((b) => {
        b.addEventListener('click', () => previewDocument(documents.find((x) => x.id === b.getAttribute('data-id'))));
      });
      wrap.querySelectorAll('.doc-download-btn').forEach((b) => {
        b.addEventListener('click', () => downloadDocument(documents.find((x) => x.id === b.getAttribute('data-id'))));
      });
      wrap.querySelectorAll('.doc-analyze-btn').forEach((b) => {
        b.addEventListener('click', () => analyzeDocumentWithAI(documents.find((x) => x.id === b.getAttribute('data-id')), b));
      });
      wrap.querySelectorAll('.doc-del-btn').forEach((b) => {
        b.addEventListener('click', async () => {
          const doc = documents.find((x) => x.id === b.getAttribute('data-id'));
          if (!doc) return;
          const ok = await PV.sb.confirmDialog({
            title: 'Dokümanı Sil',
            message: `"${doc.file_name}" dosyasını hem depolama alanından hem veritabanından silmek istiyor musunuz?`
          });
          if (!ok) return;
          await sb.storage.from(doc.storage_bucket || 'project-documents').remove([doc.storage_path]);
          const { error } = await sb.from('documents').delete().eq('id', doc.id).eq('user_id', userId);
          if (error) return PV.sb.showToast(error.message, 'error');
          PV.sb.showToast('Doküman silindi.', 'success');
          await fetchDocuments();
          renderDocumentsList();
        });
      });

      PV.utils.renderIcons();
    };

    const ensurePreviewModal = () => {
      let modal = document.getElementById('pv-doc-preview-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'pv-doc-preview-modal';
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
          <div class="modal modal-xl">
            <div class="modal-header">
              <h3 class="modal-title" id="pv-doc-prev-title">Doküman Önizleme</h3>
              <button type="button" class="btn-ghost btn-icon btn-sm" id="pv-doc-prev-close"><i data-lucide="x" width="18" height="18"></i></button>
            </div>
            <div class="modal-body" id="pv-doc-prev-body"></div>
          </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('pv-doc-prev-close').addEventListener('click', () => PV.sb.closeModal(modal));
      }
      return modal;
    };

    const previewDocument = async (doc) => {
      if (!doc) return;
      const modal = ensurePreviewModal();
      document.getElementById('pv-doc-prev-title').textContent = doc.file_name;
      const body = document.getElementById('pv-doc-prev-body');
      body.innerHTML = `<div class="flex items-center gap-2"><div class="spinner"></div><span>Güvenli bağlantı oluşturuluyor...</span></div>`;
      PV.sb.openModal(modal);

      const { data, error } = await sb.storage
        .from(doc.storage_bucket || 'project-documents')
        .createSignedUrl(doc.storage_path, 3600);

      if (error || !data?.signedUrl) {
        body.innerHTML = `<div class="alert alert-danger">Dosya bağlantısı oluşturulamadı: ${PV.utils.escapeHtml(error?.message || 'Bilinmeyen hata')}</div>`;
        return;
      }

      const ext = (doc.file_type || '').toLowerCase();
      let contentHtml = '';
      if (['png', 'jpg', 'jpeg'].includes(ext)) {
        contentHtml = `<img src="${PV.utils.escapeHtml(data.signedUrl)}" alt="${PV.utils.escapeHtml(doc.file_name)}" style="max-height:65vh;margin:0 auto;border-radius:10px;">`;
      } else if (ext === 'pdf') {
        contentHtml = `<iframe src="${PV.utils.escapeHtml(data.signedUrl)}" style="width:100%;height:65vh;border:none;border-radius:8px;"></iframe>`;
      } else if (['txt', 'md', 'csv'].includes(ext) && doc.extracted_text) {
        contentHtml = `<pre style="background:var(--bg-tertiary);padding:1rem;border-radius:8px;overflow:auto;max-height:55vh;font-size:0.84rem;white-space:pre-wrap;">${PV.utils.escapeHtml(doc.extracted_text)}</pre>`;
      } else {
        contentHtml = `
          <div class="empty-state">
            <p>Bu dosya türü (${PV.utils.escapeHtml(doc.file_type)}) tarayıcı içinde doğrudan önizlenemiyor. İndirerek görüntüleyebilirsiniz.</p>
            <a href="${PV.utils.escapeHtml(data.signedUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">Dosyayı İndir / Aç</a>
          </div>
        `;
      }

      if (doc.ai_summary) {
        contentHtml = `
          <div class="card mb-4" style="border-color:rgba(6,182,212,0.35);">
            <div class="card-header"><span class="card-title"><i data-lucide="sparkles" width="16" height="16" class="text-cyan"></i> AI Doküman Özeti</span></div>
            <div class="pv-markdown" style="font-size:0.88rem;">${PV.utils.renderMarkdown(doc.ai_summary)}</div>
          </div>
          ${contentHtml}
        `;
      }

      body.innerHTML = contentHtml;
      PV.utils.renderIcons();
    };

    const downloadDocument = async (doc) => {
      if (!doc) return;
      const { data, error } = await sb.storage
        .from(doc.storage_bucket || 'project-documents')
        .createSignedUrl(doc.storage_path, 300, { download: doc.file_name });
      if (error || !data?.signedUrl) {
        PV.sb.showToast(`İndirme bağlantısı alınamadı: ${error?.message || ''}`, 'error');
        return;
      }
      window.open(data.signedUrl, '_blank', 'noopener');
    };

    const analyzeDocumentWithAI = async (doc, btn) => {
      if (!doc) return;
      btn.disabled = true;
      try {
        const { data: sess } = await sb.auth.getSession();
        const res = await fetch('/.netlify/functions/document-analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sess?.session?.access_token}`
          },
          body: JSON.stringify({ documentId: doc.id })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || 'Doküman analizi gerçekleştirilemedi.');

        PV.sb.showToast('Doküman AI tarafından analiz edildi ve özet kaydedildi.', 'success');
        await fetchDocuments();
        renderDocumentsList();
        previewDocument(documents.find((d) => d.id === doc.id));
      } catch (err) {
        PV.sb.showToast(err.message, 'warning');
      } finally {
        btn.disabled = false;
      }
    };

    await fetchProjects();
    await fetchDocuments();
    renderShell();
    renderDocumentsList();
  }

  PV.documents = {
    initDocumentsPage,
    mountDocumentsView
  };
})(window);
