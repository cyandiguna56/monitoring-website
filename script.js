// KONFIGURASI - GUNAKAN URL SCRIPT WEBSITE ANDA
const SCRIPT_URL = 'https://github.com/cyandiguna56/monitoring-website';

class MonitoringSystem {
    constructor() {
        this.currentSheet = 'MONITORING LOKAL';
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
        this.showLoading(true);
        
        try {
            const data = await this.fetchData();
            this.renderTable(data);
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Gagal memuat data: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async fetchData() {
        const url = `${SCRIPT_URL}?sheet=${encodeURIComponent(this.currentSheet)}`;
        console.log('Fetching from:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Data received:', data);
        return data;
    }

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
            tableElement.classList.add('loading');
        } else {
            loadingElement.style.display = 'none';
            tableElement.classList.remove('loading');
        }
    }

    showError(message) {
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="100" class="text-center text-danger py-4">
                    <i class="fas fa-exclamation-triangle me-2"></i>${message}
                </td>
            </tr>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MonitoringSystem();
});
