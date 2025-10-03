// =======================================
// KONFIGURASI
// =======================================
// Arahkan ke URL Cloudflare Worker kamu (bukan langsung ke /exec GAS).
// Worker ini meneruskan request ke GAS dan menambahkan header CORS.
const SCRIPT_URL = 'https://cors-proxy-apps-script.cyandiguna56.workers.dev/';
const GAS_DIRECT_URL = 'https://script.google.com/macros/s/AKfycbzYdYDoXyovrX2p13_Oph1uhLaJLlgYvN3C-mfOPtAcnZhc8jLEQigPVlZwbalIr-NWfg/exec';


// Daftar sheet sumber data
const SHEETS = ['MONITORING PISANG', 'MONITORING LOKAL', 'MONITORING FMCG', 'MONITORING IMPORT'];

// =======================================
// UTIL
// =======================================
const fmt = (v) => (v == null ? '' : String(v));

function normalizeType(u) {
  const t = (fmt(u.JENIS_MUATAN)).toUpperCase();
  if (t.includes('PISANG')) return 'PISANG';
  if (t.includes('LOKAL'))  return 'LOKAL';
  if (t.includes('FMCG'))   return 'FMCG';
  if (t.includes('IMPORT')) return 'IMPORT';
  const s = (u.__sheet || '').toUpperCase();
  if (s.includes('PISANG')) return 'PISANG';
  if (s.includes('LOKAL'))  return 'LOKAL';
  if (s.includes('FMCG'))   return 'FMCG';
  if (s.includes('IMPORT')) return 'IMPORT';
  return 'LOKAL';
}

function statusFromRow(r) {
  const hasStart  = r.START  && String(r.START).trim()  !== '';
  const hasFinish = r.FINISH && String(r.FINISH).trim() !== '';
  if (!hasStart && !hasFinish) return 'STANDBY';
  if (hasStart && !hasFinish)  return 'PROSES';
  return 'SELESAI';
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// =======================================
// APP STATE
// =======================================
let currentMode = 'checker';           // 'checker' | 'receiving'
let currentFilter = 'ALL';             // filter di Checker
let currentReceivingFilter = 'PISANG'; // filter di Receiving
let allUnits = [];                     // gabungan 4 sheet

// =======================================
// APP
// =======================================
class MonitoringSystem {
  constructor() {
    this.bindNav();
    this.loadAllData();
  }

  bindNav() {
    const navRec    = document.getElementById('nav-receiving');
    const navChk    = document.getElementById('nav-checker');
    const reloadBtn = document.getElementById('reloadBtn');

    navRec.addEventListener('click', () => {
      currentMode = 'receiving';
      navRec.className = 'btn';
      navChk.className = 'btn-ghost';
      document.getElementById('receiving-page').classList.remove('hidden');
      document.getElementById('checker-page').classList.add('hidden');
      this.renderReceiving();
    });

    navChk.addEventListener('click', () => {
      currentMode = 'checker';
      navChk.className = 'btn';
      navRec.className = 'btn-ghost';
      document.getElementById('checker-page').classList.remove('hidden');
      document.getElementById('receiving-page').classList.add('hidden');
      this.renderChecker();
    });

    reloadBtn.addEventListener('click', () => this.loadAllData());

    // Receiving tabs (jenis muatan)
    document.querySelectorAll('[data-rec]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentReceivingFilter = btn.dataset.rec;
        document.querySelectorAll('[data-rec]').forEach(b => b.classList.remove('tab-active'));
        btn.classList.add('tab-active');
        document.getElementById('receiving-title').textContent = `Unit ${currentReceivingFilter}`;
        this.renderReceiving();
      });
    });

    // Checker filter (jenis muatan)
    document.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentFilter = btn.dataset.filter;
        document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('tab-active'));
        btn.classList.add('tab-active');
        this.renderChecker();
      });
    });

    // Checker tabs (status)
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab; // standby | proses | selesai
        document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('tab-active'));
        btn.classList.add('tab-active');
        ['standby', 'proses', 'selesai'].forEach(name => {
          document.getElementById(`${name}-section`).classList.toggle('hidden', name !== tab);
        });
      });
    });

    // backup logout
    document.querySelectorAll('.logout-btn').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Yakin ingin logout?')) auth.logout();
      });
    });
  }

  async loadAllData() {
    try {
      const results = await Promise.all(SHEETS.map(s => this.fetchSheet(s)));
      allUnits = [];
      results.forEach((rows, i) => {
        const sheet = SHEETS[i];
        rows.forEach(r => allUnits.push({ ...r, __sheet: sheet }));
      });
      this.updateCounts();
      (currentMode === 'checker') ? this.renderChecker() : this.renderReceiving();
    } catch (err) {
      console.error('Gagal memuat data:', err);
      alert('Gagal memuat data. Coba Reload.');
    }
  }

  async fetchSheet(sheetName) {
    // GET lewat Worker (CORS aman)
    const url = `${SCRIPT_URL}?sheet=${encodeURIComponent(sheetName)}`;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(to);
    if (!res.ok) throw new Error(`HTTP ${res.status} saat GET sheet ${sheetName}`);
    return await res.json();
  }

  // =========================
  // RECEIVING
  // =========================
  renderReceiving() {
    const container = document.getElementById('receiving-units');
    const empty     = document.getElementById('receiving-empty');
    container.innerHTML = '';

    const filtered = allUnits.filter(u => normalizeType(u) === currentReceivingFilter);
    if (filtered.length === 0) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    filtered.forEach(u => {
      const st = statusFromRow(u);
      const badgeCls = st === 'STANDBY' ? 'badge badge-standby' : (st === 'PROSES' ? 'badge badge-proses' : 'badge badge-selesai');
      const sjPreview = u.SURAT_JALAN_URL
        ? `<a href="${fmt(u.SURAT_JALAN_URL)}" target="_blank" class="text-sm" style="text-decoration:underline">Lihat Surat Jalan</a>`
        : `<span class="text-sm" style="color:#6b7280">Belum ada file</span>`;

      const card = el(`
        <div class="card">
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="text-sm text-[color:var(--ink-soft)]">${u.__sheet}</div>
              <div class="text-lg font-semibold">${fmt(u.NO_SURAT_JALAN) || '-'}</div>
              <div class="text-sm">${fmt(u.NO_KENDARAAN) || '-'}</div>
              <div class="text-sm mt-2">${sjPreview}</div>
            </div>
            <div class="text-right">
              <div class="${badgeCls}">${st}</div>
              <div class="mt-3 relative">
                <button class="btn-ghost" data-call="${fmt(u.NO_SURAT_JALAN)}" aria-haspopup="true" aria-expanded="false">PANGGIL ▾</button>
                <div class="hidden absolute right-0 mt-2 w-44 bg-white border border-[color:var(--line)] rounded shadow z-10 menu">
                  <button class="w-full text-left px-3 py-2 hover:bg-gray-100" data-call-action="BONGKAR" data-call-id="${fmt(u.NO_SURAT_JALAN)}">🚛 BONGKAR</button>
                  <button class="w-full text-left px-3 py-2 hover:bg-gray-100" data-call-action="AMBIL SURAT JALAN" data-call-id="${fmt(u.NO_SURAT_JALAN)}">📄 AMBIL SURAT JALAN</button>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-4 border-t border-[color:var(--line)] pt-4">
            <div class="text-sm font-medium mb-2">Upload Surat Jalan (jpg/png/pdf)</div>
            <div class="flex items-center gap-3 flex-wrap">
              <input type="file" accept=".jpg,.jpeg,.png,.pdf" class="file-input" data-sj="${fmt(u.NO_SURAT_JALAN)}" />
              <button class="btn" data-upload-sj="${fmt(u.NO_SURAT_JALAN)}" data-sheet="${u.__sheet}">Upload</button>
            </div>
          </div>
        </div>
      `);
      container.appendChild(card);
    });

    // toggle menu panggil
    container.querySelectorAll('[data-call]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const menu = e.currentTarget.parentElement.querySelector('.menu');
        container.querySelectorAll('.menu').forEach(m => { if (m !== menu) m.classList.add('hidden'); });
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        menu.classList.toggle('hidden');
      });
    });
    // aksi panggil
    container.querySelectorAll('[data-call-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.callId;
        const action = e.currentTarget.dataset.callAction;
        alert(`🔊 PANGGILAN: ${id} - ${action}`);
        container.querySelectorAll('.menu').forEach(m => m.classList.add('hidden'));
      });
    });
    // upload SJ
    container.querySelectorAll('[data-upload-sj]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const no = e.currentTarget.dataset.uploadSj;
        const sheet = e.currentTarget.dataset.sheet;
        const input = container.querySelector(`input[data-sj="${CSS.escape(no)}"]`);
        const file  = input?.files?.[0];
        if (!file) return alert('Pilih file terlebih dahulu.');
        await uploadFileToDrive({ sheet, no, kind: 'SURAT_JALAN', file, inputEl: input });   // <--- kirim elemen input });
        await sleep(700);
        await app.loadAllData();
      });
    });

    // close menu saat klik di luar
    document.addEventListener('click', (ev) => {
      if (!ev.target.closest('[data-call]') && !ev.target.closest('.menu')) {
        container.querySelectorAll('.menu').forEach(m => m.classList.add('hidden'));
      }
    }, { once: true });
  }

  // =========================
  // CHECKER
  // =========================
  renderChecker() {
    const qStandby = document.getElementById('standby-queue');
    const qProses  = document.getElementById('proses-queue');
    const qSelesai = document.getElementById('selesai-queue');
    const emptyStandby = document.getElementById('standby-empty');
    const emptyProses  = document.getElementById('proses-empty');
    const emptySelesai = document.getElementById('selesai-empty');

    qStandby.innerHTML = qProses.innerHTML = qSelesai.innerHTML = '';

    let list = allUnits;
    if (currentFilter !== 'ALL') list = list.filter(u => normalizeType(u) === currentFilter);

    const buckets = { STANDBY: [], PROSES: [], SELESAI: [] };
    list.forEach(u => buckets[statusFromRow(u)].push(u));

    const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

    const makeCard = (u) => {
      const st = statusFromRow(u);
      const badgeCls = st === 'STANDBY' ? 'badge badge-standby' : (st === 'PROSES' ? 'badge badge-proses' : 'badge badge-selesai');
      const fotoPreview = u.FOTO_UNIT_URL
        ? `<a href="${fmt(u.FOTO_UNIT_URL)}" target="_blank" class="text-sm" style="text-decoration:underline">Lihat Foto</a>`
        : `<span class="text-sm" style="color:#6b7280">Belum ada foto</span>`;
      const showStart  = fmt(u.START)  || '-';
      const showFinish = fmt(u.FINISH) || '-';

      return el(`
        <div class="card">
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="text-sm text-[color:var(--ink-soft)]">${u.__sheet}</div>
              <div class="text-lg font-semibold">${fmt(u.NO_SURAT_JALAN) || '-'}</div>
              <div class="text-sm">${fmt(u.NO_KENDARAAN) || '-'}</div>
              <div class="text-sm text-[color:var(--ink-soft)] mt-1">Tgl Kedatangan: ${fmt(u.TANGGAL_KEDATANGAN) || '-'}</div>
              <div class="text-sm mt-1">Start: <span style="font-family:${mono}">${showStart}</span> · Finish: <span style="font-family:${mono}">${showFinish}</span></div>
              <div class="text-sm mt-2">${fotoPreview}</div>
            </div>
            <div class="text-right">
              <div class="${badgeCls}">${st}</div>
              <div class="mt-3 flex gap-2">
                ${st === 'STANDBY' ? `<button class="btn" data-start="${fmt(u.NO_SURAT_JALAN)}" data-sheet="${u.__sheet}">START</button>` : ''}
                ${st === 'PROSES'  ? `<button class="btn" data-finish="${fmt(u.NO_SURAT_JALAN)}" data-sheet="${u.__sheet}">FINISH</button>
                                      <button class="btn-ghost" data-cancel="${fmt(u.NO_SURAT_JALAN)}" data-sheet="${u.__sheet}">CANCEL</button>` : ''}
              </div>
            </div>
          </div>
          <div class="mt-4 border-t border-[color:var(--line)] pt-4">
            <div class="text-sm font-medium mb-2">Upload Foto Unit (jpg/png)</div>
            <div class="flex items-center gap-3 flex-wrap">
              <input type="file" accept=".jpg,.jpeg,.png" class="file-input" data-foto="${fmt(u.NO_SURAT_JALAN)}" />
              <button class="btn" data-upload-foto="${fmt(u.NO_SURAT_JALAN)}" data-sheet="${u.__sheet}">Upload</button>
            </div>
          </div>
        </div>
      `);
    };

    buckets.STANDBY.forEach(u => qStandby.appendChild(makeCard(u)));
    buckets.PROSES.forEach(u  => qProses.appendChild(makeCard(u)));
    buckets.SELESAI.forEach(u => qSelesai.appendChild(makeCard(u)));

    emptyStandby.classList.toggle('hidden', buckets.STANDBY.length > 0);
    emptyProses .classList.toggle('hidden', buckets.PROSES.length > 0);
    emptySelesai.classList.toggle('hidden', buckets.SELESAI.length > 0);

    // START
    qStandby.querySelectorAll('[data-start]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const no = e.currentTarget.dataset.start;
        const sheet = e.currentTarget.dataset.sheet;
        await updateStatusOnServer({ sheet, no, which: 'START' });
        await sleep(600);
        await app.loadAllData();
      });
    });
    // FINISH
    qProses.querySelectorAll('[data-finish]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const no = e.currentTarget.dataset.finish;
        const sheet = e.currentTarget.dataset.sheet;
        await updateStatusOnServer({ sheet, no, which: 'FINISH' });
        await sleep(600);
        await app.loadAllData();
      });
    });
    // CANCEL
    qProses.querySelectorAll('[data-cancel]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const no = e.currentTarget.dataset.cancel;
        const sheet = e.currentTarget.dataset.sheet;
        if (!confirm('Batalkan START untuk kembali ke STANDBY?')) return;
        await updateStatusOnServer({ sheet, no, which: 'CANCEL' });
        await sleep(600);
        await app.loadAllData();
      });
    });

    // Upload Foto
    ;[qStandby, qProses, qSelesai].forEach(scope => {
      scope.querySelectorAll('[data-upload-foto]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const no = e.currentTarget.dataset.uploadFoto;
          const sheet = e.currentTarget.dataset.sheet;
          const input = scope.querySelector(`input[data-foto="${CSS.escape(no)}"]`);
          const file  = input?.files?.[0];
          if (!file) return alert('Pilih foto terlebih dahulu.');
          await uploadFileToDrive({ sheet, no, kind: 'FOTO_UNIT', file, inputEl: input });   // <--- kirim elemen input});
          await sleep(800);
          await app.loadAllData();
        });
      });
    });
  }

  updateCounts() {
    const counts = { PISANG: 0, LOKAL: 0, FMCG: 0, IMPORT: 0 };
    allUnits.forEach(u => {
      const t = normalizeType(u);
      if (counts[t] != null) counts[t]++;
    });
    document.getElementById('count-pisang').textContent = counts.PISANG || 0;
    document.getElementById('count-lokal').textContent  = counts.LOKAL  || 0;
    document.getElementById('count-fmcg').textContent   = counts.FMCG   || 0;
    document.getElementById('count-import').textContent = counts.IMPORT || 0;
  }
}

// =======================================
// SERVER CALLS (via Worker — CORS aman)
// =======================================
async function updateStatusOnServer({ sheet, no, which }) {
  // 1) Coba GET (fallback yang didukung doGet)
  const getUrl = `${SCRIPT_URL}?action=updateStatus&sheet=${encodeURIComponent(sheet)}&no_surat_jalan=${encodeURIComponent(no)}&which=${encodeURIComponent(which)}`;
  try {
    const r = await fetch(getUrl, { method: 'GET' });
    if (r.ok) {
      // optional: cek payload
      // const j = await r.json();
      return;
    }
    // jika GET gagal, lanjut coba POST
  } catch (_) {
    // lanjut ke POST
  }

  // 2) Coba POST (kalau Worker/GAS sudah siap menerima doPost)
  const fd = new FormData();
  fd.append('action', 'updateStatus');
  fd.append('sheet', sheet);
  fd.append('no_surat_jalan', no);
  fd.append('which', which);

  const res = await fetch(SCRIPT_URL, { method: 'POST', body: fd });
  if (!res.ok) {
    console.warn('POST updateStatus gagal, status:', res.status);
    alert('Gagal mengirim perintah ke server (updateStatus).');
  }
}

async function uploadFileToDrive({ sheet, no, kind, file, inputEl }) {
  // 1) Coba POST lewat Worker (CORS aman)
    try {
    const fd = new FormData();
    fd.append('action', 'uploadImage');
    fd.append('sheet', sheet);
    fd.append('no_surat_jalan', no);
    fd.append('kind', kind); // SURAT_JALAN | FOTO_UNIT
    fd.append('file', file, file.name);

    const res = await fetch(SCRIPT_URL, { method: 'POST', body: fd });
    if (res.ok) return; // selesai
    console.warn('Upload gagal, status:', res.status);
    // jatuh ke fallback
  } catch (e) {
    console.warn('Upload via Worker error:', e);
    // jatuh ke fallback
  }

  // 2) Fallback: POST langsung ke GAS via <form target=iframe> (bypass CORS, doPost pasti jalan)
    if (!inputEl || !(inputEl instanceof HTMLInputElement)) {
    alert('Upload gagal. Silakan pilih ulang file dan coba lagi.');
    return;
  }

    await new Promise((resolve) => {
    const iframeName = `uploadFrame_${Date.now()}`;
    const iframe = document.createElement('iframe');
    iframe.name = iframeName;
    iframe.style.display = 'none';

    const form = document.createElement('form');
    form.action = GAS_DIRECT_URL;            // langsung ke GAS /exec
    form.method = 'POST';
    form.enctype = 'multipart/form-data';
    form.target = iframeName;
    form.style.display = 'none';

    // hidden fields
    const hAction = document.createElement('input');
    hAction.type = 'hidden'; hAction.name = 'action'; hAction.value = 'uploadImage';
    const hSheet = document.createElement('input');
    hSheet.type = 'hidden'; hSheet.name = 'sheet'; hSheet.value = sheet;
    const hNo = document.createElement('input');
    hNo.type = 'hidden'; hNo.name = 'no_surat_jalan'; hNo.value = no;
    const hKind = document.createElement('input');
    hKind.type = 'hidden'; hKind.name = 'kind'; hKind.value = kind;

    form.appendChild(hAction);
    form.appendChild(hSheet);
    form.appendChild(hNo);
    form.appendChild(hKind);

    // PENTING: pindahkan input file yang dipakai user ke dalam form,
    // agar Browser mengirimkan file aslinya.
    const originalParent = inputEl.parentElement;
    const placeholder = document.createElement('span'); // penanda posisi
    originalParent.replaceChild(placeholder, inputEl);
    form.appendChild(inputEl);

    // selesai submit → kembalikan input ke UI (sebagai input baru yang kosong)
    iframe.addEventListener('load', () => {
      // bersihkan
      document.body.removeChild(iframe);
      document.body.removeChild(form);

      // buat input baru agar user bisa upload lagi berikutnya
      const newInput = document.createElement('input');
      newInput.type = 'file';
      newInput.className = 'file-input';
      newInput.accept = inputEl.accept || '.jpg,.jpeg,.png,.pdf';
      // pasang di tempat semula
      placeholder.replaceWith(newInput);
      resolve();
    });

      document.body.appendChild(iframe);
      document.body.appendChild(form);
      form.submit();
  });
}


// Expose class (dipanggil dari dashboard.html setelah auth)
window.MonitoringSystem = MonitoringSystem;
