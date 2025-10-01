// =======================================
// KONFIGURASI
// =======================================
// Gunakan Web App URL Anda (sudah ada di kode Anda sebelumnya):
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzOHv6wLb9QzXaDtc0eKy1xYP1ojg5-GXzwsLmXxfLV0eGQH_MSTnpaazkVsrmKIXLy5w/exec';

// Daftar sheet
const SHEETS = ['MONITORING PISANG', 'MONITORING LOKAL', 'MONITORING FMCG', 'MONITORING IMPORT'];

// =======================================
// UTIL
// =======================================
function normalizeType(u) {
  const t = (fmt(u.JENIS_MUATAN) || '').toUpperCase();
  if (t.includes('PISANG')) return 'PISANG';
  if (t.includes('LOKAL'))  return 'LOKAL';
  if (t.includes('FMCG'))   return 'FMCG';
  if (t.includes('IMPORT')) return 'IMPORT';

  // Fallback dari nama sheet
  const s = (u.__sheet || '').toUpperCase();
  if (s.includes('PISANG')) return 'PISANG';
  if (s.includes('LOKAL'))  return 'LOKAL';
  if (s.includes('FMCG'))   return 'FMCG';
  if (s.includes('IMPORT')) return 'IMPORT';

  return 'LOKAL'; // default aman
}

function statusFromRow(row) {
  const hasStart = row.START && String(row.START).trim() !== '';
  const hasFinish = row.FINISH && String(row.FINISH).trim() !== '';
  if (!hasStart && !hasFinish) return 'STANDBY';
  if (hasStart && !hasFinish) return 'PROSES';
  return 'SELESAI';
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function fmt(text) {
  return text == null ? '' : String(text);
}

// =======================================
// APP
// =======================================
let currentMode = 'checker';           // 'checker' | 'receiving'
let currentFilter = 'ALL';             // Jenis muatan filter (checker)
let currentfilterFilter = 'PISANG'; // Jenis muatan filter (filter)
let allUnits = [];                     // gabungan 4 sheet

class MonitoringSystem {
  constructor() {
    this.bindNav();
    this.loadAllData();
  }

  bindNav() {
    // Mode nav
    const navRec = document.getElementById('nav-filter');
    const navChk = document.getElementById('nav-checker');
    const reloadBtn = document.getElementById('reloadBtn');

    navRec.addEventListener('click', () => {
      currentMode = 'filter';
      navRec.className = 'btn';
      navChk.className = 'btn-ghost';
      document.getElementById('filter-page').classList.remove('hidden');
      document.getElementById('checker-page').classList.add('hidden');
      this.renderfilter();
    });

    navChk.addEventListener('click', () => {
      currentMode = 'checker';
      navChk.className = 'btn';
      navRec.className = 'btn-ghost';
      document.getElementById('checker-page').classList.remove('hidden');
      document.getElementById('filter-page').classList.add('hidden');
      this.renderChecker();
    });

    reloadBtn.addEventListener('click', () => this.loadAllData());

    // filter filter tabs
    document.querySelectorAll('[data-rec]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentfilterFilter = btn.dataset.rec;
        document.querySelectorAll('[data-rec]').forEach(b => b.classList.remove('tab-active'));
        btn.classList.add('tab-active');
        document.getElementById('filter-title').textContent = `Unit ${currentfilterFilter}`;
        this.renderfilter();
      });
    });

    // Checker: jenis muatan filter
    document.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentFilter = btn.dataset.filter;
        document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('tab-active'));
        btn.classList.add('tab-active');
        this.renderChecker();
      });
    });

    // Checker: tab status
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

    // Bind logout (backup selain yang di auth.js)
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
      // gabung + tandai sheet asal
      allUnits = [];
      results.forEach((rows, idx) => {
        const sheet = SHEETS[idx];
        rows.forEach(r => {
          allUnits.push({ ...r, __sheet: sheet });
        });
      });
      this.updateCounts();
      (currentMode === 'checker') ? this.renderChecker() : this.renderfilter();
    } catch (err) {
      console.error('Gagal memuat data:', err);
      alert('Gagal memuat data. Coba Reload.');
    }
  }

  async fetchSheet(sheetName) {
    const url = `${SCRIPT_URL}?sheet=${encodeURIComponent(sheetName)}`;
    // Direct fetch dengan fallback proxy (seperti versi Anda)
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(to);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      // fallback proxy
      const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const res2 = await fetch(proxy);
      if (!res2.ok) throw new Error(`Proxy HTTP ${res2.status}`);
      return await res2.json();
    }
  }

  // =========================
  // RENDER: filter
  // =========================
  renderfilter() {
    const container = document.getElementById('filter-units');
    const empty = document.getElementById('filter-empty');
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

      const suratPreview = u.SURAT_JALAN_URL
        ? `<a href="${fmt(u.SURAT_JALAN_URL)}" target="_blank" class="text-sm underline">Lihat Surat Jalan</a>`
        : `<span class="text-sm text-gray-500">Belum ada file</span>`;

      const card = el(`
        <div class="card">
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="text-sm text-[color:var(--ink-soft)]">${u.__sheet}</div>
              <div class="text-lg font-semibold">${fmt(u.NO_SURAT_JALAN) || '-'}</div>
              <div class="text-sm">${fmt(u.NO_KENDARAAN) || '-'}</div>
              <div class="mt-2">${suratPreview}</div>
            </div>
            <div class="text-right">
              <div class="${badgeCls}">${st}</div>
              <div class="mt-3 relative">
                <button class="btn-ghost" data-call="${fmt(u.NO_SURAT_JALAN)}">PANGGIL ▾</button>
                <div class="hidden absolute right-0 mt-2 w-44 bg-white border border-[color:var(--line)] rounded shadow z-10">
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

    // panggil menu toggle
    container.querySelectorAll('[data-call]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const menu = e.currentTarget.parentElement.querySelector('div.absolute');
        document.querySelectorAll('#receiving-units div.absolute').forEach(m => m.classList.add('hidden'));
        menu.classList.toggle('hidden');
      });
    });

    // panggil actions
    container.querySelectorAll('[data-call-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.callId;
        const action = e.currentTarget.dataset.callAction;
        alert(`🔊 PANGGILAN: ${id} - ${action}`);
        // close all
        document.querySelectorAll('#receiving-units div.absolute').forEach(m => m.classList.add('hidden'));
      });
    });

    // upload SJ
    container.querySelectorAll('[data-upload-sj]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const no = e.currentTarget.dataset.uploadSj;
        const sheet = e.currentTarget.dataset.sheet;
        const input = container.querySelector(`input[data-sj="${CSS.escape(no)}"]`);
        const file = input?.files?.[0];
        if (!file) return alert('Pilih file terlebih dahulu.');
        await uploadFileToDrive({ sheet, no, kind: 'SURAT_JALAN', file });
        await app.loadAllData();
      });
    });

    // close menu on outside click
    document.addEventListener('click', (ev) => {
      if (!ev.target.closest('[data-call]') && !ev.target.closest('div.absolute')) {
        document.querySelectorAll('#receiving-units div.absolute').forEach(m => m.classList.add('hidden'));
      }
    }, { once: true });
  }

  // =========================
  // RENDER: CHECKER
  // =========================
  renderChecker() {
    const qStandby = document.getElementById('standby-queue');
    const qProses = document.getElementById('proses-queue');
    const qSelesai = document.getElementById('selesai-queue');
    const emptyStandby = document.getElementById('standby-empty');
    const emptyProses = document.getElementById('proses-empty');
    const emptySelesai = document.getElementById('selesai-empty');

    qStandby.innerHTML = qProses.innerHTML = qSelesai.innerHTML = '';

    let list = allUnits;
    if (currentFilter !== 'ALL') list = list.filter(u => normalizeType(u) === currentFilter);

    const buckets = { STANDBY: [], PROSES: [], SELESAI: [] };
    list.forEach(u => buckets[statusFromRow(u)].push(u));

    const makeCard = (u) => {
      const st = statusFromRow(u);
      const badgeCls = st === 'STANDBY' ? 'badge badge-standby' : (st === 'PROSES' ? 'badge badge-proses' : 'badge badge-selesai');
      const fotoPreview = u.FOTO_UNIT_URL
        ? `<a href="${fmt(u.FOTO_UNIT_URL)}" target="_blank" class="text-sm underline">Lihat Foto</a>`
        : `<span class="text-sm text-gray-500">Belum ada foto</span>`;

      const showStart = fmt(u.START) || '-';
      const showFinish = fmt(u.FINISH) || '-';

      const card = el(`
        <div class="card">
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="text-sm text-[color:var(--ink-soft)]">${u.__sheet}</div>
              <div class="text-lg font-semibold">${fmt(u.NO_SURAT_JALAN) || '-'}</div>
              <div class="text-sm">${fmt(u.NO_KENDARAAN) || '-'}</div>
              <div class="mt-1 text-sm text-[color:var(--ink-soft)]">Tgl Kedatangan: ${fmt(u.TANGGAL_KEDATANGAN) || '-'}</div>
              <div class="mt-1 text-sm">Start: <span class="font-mono">${showStart}</span> · Finish: <span class="font-mono">${showFinish}</span></div>
              <div class="mt-2">${fotoPreview}</div>
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
      return card;
    };

    // Render tiap bucket
    buckets.STANDBY.forEach(u => qStandby.appendChild(makeCard(u)));
    buckets.PROSES.forEach(u => qProses.appendChild(makeCard(u)));
    buckets.SELESAI.forEach(u => qSelesai.appendChild(makeCard(u)));

    emptyStandby.classList.toggle('hidden', buckets.STANDBY.length > 0);
    emptyProses.classList.toggle('hidden', buckets.PROSES.length > 0);
    emptySelesai.classList.toggle('hidden', buckets.SELESAI.length > 0);

    // Bind actions
    qStandby.querySelectorAll('[data-start]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const no = e.currentTarget.dataset.start;
        const sheet = e.currentTarget.dataset.sheet;
        await updateStatusOnServer({ sheet, no, which: 'START' });
        await app.loadAllData();
      });
    });

    qProses.querySelectorAll('[data-finish]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const no = e.currentTarget.dataset.finish;
        const sheet = e.currentTarget.dataset.sheet;
        await updateStatusOnServer({ sheet, no, which: 'FINISH' });
        await app.loadAllData();
      });
    });

    qProses.querySelectorAll('[data-cancel]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const no = e.currentTarget.dataset.cancel;
        const sheet = e.currentTarget.dataset.sheet;
        if (!confirm('Batalkan START untuk kembali ke STANDBY?')) return;
        await updateStatusOnServer({ sheet, no, which: 'CANCEL' });
        await app.loadAllData();
      });
    });

    // Upload Foto
    [qStandby, qProses, qSelesai].forEach(scope => {
      scope.querySelectorAll('[data-upload-foto]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const no = e.currentTarget.dataset.uploadFoto;
          const sheet = e.currentTarget.dataset.sheet;
          const input = scope.querySelector(`input[data-foto="${CSS.escape(no)}"]`);
          const file = input?.files?.[0];
          if (!file) return alert('Pilih foto terlebih dahulu.');
          await uploadFileToDrive({ sheet, no, kind: 'FOTO_UNIT', file });
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
    document.getElementById('count-lokal').textContent = counts.LOKAL || 0;
    document.getElementById('count-fmcg').textContent = counts.FMCG || 0;
    document.getElementById('count-import').textContent = counts.IMPORT || 0;
  }
}

// =======================================
// SERVER CALLS (POST FormData untuk anti-CORS ribet)
// =======================================
async function updateStatusOnServer({ sheet, no, which }) {
  const fd = new FormData();
  fd.append('action', 'updateStatus');
  fd.append('sheet', sheet);
  fd.append('no_surat_jalan', no);
  fd.append('which', which); // START | FINISH | CANCEL
  const res = await fetch(SCRIPT_URL, { method: 'POST', body: fd });
  if (!res.ok) alert('Gagal mengirim perintah. Coba lagi.');
}

async function uploadFileToDrive({ sheet, no, kind, file }) {
  const fd = new FormData();
  fd.append('action', 'uploadImage');
  fd.append('sheet', sheet);
  fd.append('no_surat_jalan', no);
  fd.append('kind', kind); // SURAT_JALAN | FOTO_UNIT
  fd.append('file', file, file.name);
  const res = await fetch(SCRIPT_URL, { method: 'POST', body: fd });
  if (!res.ok) alert('Upload gagal.');
}
