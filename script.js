// KONFIGURASI - GUNAKAN URL SCRIPT WEBSITE ANDA
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzOHv6wLb9QzXaDtc0eKy1xYP1ojg5-GXzwsLmXxfLV0eGQH_MSTnpaazkVsrmKIXLy5w/exec';

class MonitoringSystem {
    constructor() {
        this.currentSheet = 'MONITORING LOKAL';
        this.isLoading = false;
        
        // Check authentication sebelum init
        if (typeof auth !== 'undefined' && !auth.isLoggedIn()) {
            window.location.href = 'login.html';
            return;
        }
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadData();
    }

    bindEvents() {
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadData();
        });

        document.getElementById('sheetSelect').addEventListener('change', (e) => {
            this.currentSheet = e.target.value;
            this.loadData();
        });
    }

    async loadData() {
        // Prevent multiple simultaneous loads
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading(true);
        
        // Timeout protection - maksimal 30 detik
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout: Gagal memuat data dalam 30 detik')), 30000);
        });
        
        try {
            const dataPromise = this.fetchData();
            const data = await Promise.race([dataPromise, timeoutPromise]);
            this.renderTable(data);
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Gagal memuat data: ' + error.message);
        } finally {
            this.isLoading = false;
            this.showLoading(false);
        }
    }

    async fetchData() {
        const url = `${SCRIPT_URL}?sheet=${encodeURIComponent(this.currentSheet)}`;
        console.log('Fetching from:', url);
        
        try {
            // Approach 1: Direct fetch dengan timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Data received:', data);
            return data;
            
        } catch (error) {
            console.error('Direct fetch failed:', error);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout - server tidak merespons');
            }
            
            // Approach 2: Coba dengan CORS proxy
            try {
                console.log('Trying with CORS proxy...');
                const proxyUrl = 'https://api.allorigins.win/raw?url=';
                const targetUrl = `${SCRIPT_URL}?sheet=${encodeURIComponent(this.currentSheet)}`;
                const proxyResponse = await fetch(proxyUrl + encodeURIComponent(targetUrl));
                
                if (proxyResponse.ok) {
                    const proxyData = await proxyResponse.json();
                    console.log('Data received via proxy:', proxyData);
                    return proxyData;
                } else {
                    throw new Error(`Proxy juga gagal. Status: ${proxyResponse.status}`);
                }
            } catch (proxyError) {
                throw new Error(`Semua method gagal. Error: ${error.message}`);
            }
        }
    }

    // ... (renderTable, formatHeader, dan method lainnya tetap sama)
    renderTable(data) {
        if (!data || data.length === 0) {
            this.showError('Tidak ada data ditemukan');
            return;
        }

        const headers = Object.keys(data[0]);
        this.renderHeader(headers);
        this.renderBody(data, headers);
    }

    renderHeader(headers) {
        const headerRow = document.getElementById('tableHeader');
        headerRow.innerHTML = '';

        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = this.formatHeader(header);
            th.scope = 'col';
            headerRow.appendChild(th);
        });
    }

    renderBody(data, headers) {
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = '';

        data.forEach(row => {
            const tr = document.createElement('tr');
            
            headers.forEach(header => {
                const td = document.createElement('td');
                const value = row[header];
                
                if (this.isDateColumn(header)) {
                    td.textContent = this.formatDate(value);
                } else if (this.isStatusColumn(header)) {
                    td.innerHTML = this.formatStatus(value);
                } else if (this.isNumberColumn(header)) {
                    td.textContent = this.formatNumber(value);
                    td.style.textAlign = 'right';
                } else {
                    td.textContent = value || '';
                }
                
                tr.appendChild(td);
            });
            
            tbody.appendChild(tr);
        });
    }

    formatHeader(header) {
        const headerMap = {
            'NO_SURAT_JALAN': 'NO SURAT JALAN',
            'TANGGAL_KELUAR_KEBUN': 'TANGGAL KELUAR KEBUN',
            'JAM_KELUAR_KEBUN': 'JAM KELUAR KEBUN',
            'TANGGAL_KEDATANGAN': 'TANGGAL KEDATANGAN',
            'LOADING_AREA': 'LOADING AREA',
            'NO_KENDARAAN': 'NO KENDARAAN',
            'JENIS_MUATAN': 'JENIS MUATAN',
            'QTY_SJ': 'QTY SJ',
            'JUMLAH_ITEM': 'JUMLAH ITEM'
        };
        
        return headerMap[header] || header.replace(/_/g, ' ');
    }

    isDateColumn(header) {
        return header.includes('TANGGAL') || header.includes('DATE');
    }

    isStatusColumn(header) {
        return header.includes('STATUS') || header.includes('JENIS_MUATAN');
    }

    isNumberColumn(header) {
        return header.includes('QTY') || header.includes('JUMLAH') || header.includes('PP');
    }

    formatDate(dateString) {
        if (!dateString) return '';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('id-ID');
        } catch {
            return dateString;
        }
    }

    formatStatus(status) {
        if (!status) return '';
        
        const statusMap = {
            'PISANG PALLETIZED': 'success',
            'PISANG CURAH': 'warning',
            'CAVCHIPS': 'info',
            'PEPAYA': 'primary',
            'GUAVA': 'success',
            'NANGKA': 'warning',
            'MANGGA': 'info',
            'NANAS': 'secondary'
        };
        
        const badgeType = statusMap[status] || 'secondary';
        return `<span class="badge bg-${badgeType} status-badge">${status}</span>`;
    }

    formatNumber(value) {
        if (!value || isNaN(value)) return value;
        return new Intl.NumberFormat('id-ID').format(value);
    }

    showLoading(show) {
        const loadingElement = document.getElementById('loading');
        const tableElement = document.getElementById('monitoringTable');
        
        if (show) {
            loadingElement.style.display = 'block';
            if (tableElement) tableElement.classList.add('loading');
        } else {
            loadingElement.style.display = 'none';
            if (tableElement) tableElement.classList.remove('loading');
        }
    }

    showError(message) {
        const tbody = document.getElementById('tableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="100" class="text-center text-danger py-4">
                        <i class="fas fa-exclamation-triangle me-2"></i>${message}
                    </td>
                </tr>
            `;
        }
        // Pastikan loading dihide ketika error
        this.showLoading(false);
    }
}
