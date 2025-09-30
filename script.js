// KONFIGURASI - GUNAKAN URL SCRIPT WEBSITE ANDA
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzOHv6wLb9QzXaDtc0eKy1xYP1ojg5-GXzwsLmXxfLV0eGQH_MSTnpaazkVsrmKIXLy5w/exec';

class MonitoringSystem {
    constructor() {
        console.log('MonitoringSystem initialized');
        this.currentSheet = 'MONITORING LOKAL';
        this.isLoading = false;
        
        // Check authentication sebelum init
        if (typeof auth !== 'undefined' && !auth.isLoggedIn()) {
            console.log('User not authenticated, redirecting to login');
            window.location.href = 'login.html';
            return;
        }
        
        this.init();
    }

    init() {
        console.log('Initializing MonitoringSystem...');
        try {
            this.bindEvents();
            this.loadData();
        } catch (error) {
            console.error('Error in MonitoringSystem init:', error);
            this.showError('Error initializing system: ' + error.message);
        }
    }

    bindEvents() {
        console.log('Binding events...');
        
        const refreshBtn = document.getElementById('refreshBtn');
        const sheetSelect = document.getElementById('sheetSelect');
        
        // CHECK IF ELEMENTS EXIST
        if (!refreshBtn) {
            console.error('Refresh button not found');
            return;
        }
        if (!sheetSelect) {
            console.error('Sheet select not found');
            return;
        }
        
        refreshBtn.addEventListener('click', () => {
            console.log('Refresh button clicked');
            this.loadData();
        });

        sheetSelect.addEventListener('change', (e) => {
            console.log('Sheet changed to:', e.target.value);
            this.currentSheet = e.target.value;
            this.loadData();
        });
        
        console.log('Events bound successfully');
    }

    async loadData() {
        console.log('loadData called, isLoading:', this.isLoading);
        
        // Prevent multiple simultaneous loads
        if (this.isLoading) {
            console.log('Already loading, skipping...');
            return;
        }
        
        this.isLoading = true;
        this.showLoading(true);
        
        // Timeout protection - maksimal 30 detik
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout: Gagal memuat data dalam 30 detik')), 30000);
        });
        
        try {
            console.log('Starting data fetch...');
            const dataPromise = this.fetchData();
            const data = await Promise.race([dataPromise, timeoutPromise]);
            console.log('Data fetch completed, rendering table...');
            this.renderTable(data);
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Gagal memuat data: ' + error.message);
        } finally {
            console.log('loadData finished, setting isLoading to false');
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
            
            console.log('Attempting direct fetch...');
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Data received via direct fetch:', data);
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

    renderTable(data) {
        console.log('renderTable called with data:', data);
        
        if (!data || !Array.isArray(data) || data.length === 0) {
            console.log('No data to render');
            this.showError('Tidak ada data ditemukan');
            return;
        }

        const headers = Object.keys(data[0]);
        if (!headers || headers.length === 0) {
            console.log('No headers found in data');
            this.showError('Format data tidak valid');
            return;
        }
        
        console.log('Rendering table with headers:', headers);
        this.renderHeader(headers);
        this.renderBody(data, headers);
    }

    renderHeader(headers) {
        const headerRow = document.getElementById('tableHeader');
        if (!headerRow) {
            console.error('Table header element not found');
            return;
        }
        
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
        if (!tbody) {
            console.error('Table body element not found');
            return;
        }
        
        tbody.innerHTML = '';

        data.forEach((row, index) => {
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
        
        console.log('Table rendered with', data.length, 'rows');
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
        
        if (!loadingElement) {
            console.error('Loading element not found');
            return;
        }
        
        console.log('showLoading:', show);
        
        if (show) {
            loadingElement.style.display = 'block';
            if (tableElement) tableElement.classList.add('loading');
        } else {
            loadingElement.style.display = 'none';
            if (tableElement) tableElement.classList.remove('loading');
        }
    }

    showError(message) {
        console.log('Showing error:', message);
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
