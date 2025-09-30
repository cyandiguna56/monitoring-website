// User credentials
const USERS = {
    'ADMIN': 'Receiving123456',
    'JAJA': 'JAJA123456',
    'DANI': 'DANI123456', 
    'TEGAR': 'TEGAR123456',
    'ATILAH': 'ATILAH123456',
    'IWAN': 'IWAN123456',
    'JIMI': 'JIMI123456',
    'DEDI': 'DEDI123456',
    'RIAN': 'RIAN123456'
};

class AuthSystem {
    constructor() {
        this.init();
    }

    init() {
        console.log('AuthSystem initialized on:', window.location.pathname);
        
        // Check if user already logged in
        if (this.isLoggedIn() && this.isLoginPage()) {
            console.log('User already logged in, redirecting to dashboard');
            this.redirectToDashboard();
            return;
        }

        // Bind login form jika di halaman login
        if (this.isLoginPage()) {
            this.bindLoginForm();
        }

        // Bind logout buttons hanya jika di dashboard
        if (this.isDashboardPage()) {
            this.bindLogoutButtons();
        }

        // Check for logout action
        this.checkLogout();
    }

    // METHOD BARU: Cek apakah di halaman login
    isLoginPage() {
        return window.location.pathname.includes('login.html') || 
               window.location.pathname === '/' ||
               window.location.pathname.includes('index.html');
    }

    // METHOD BARU: Cek apakah di halaman dashboard
    isDashboardPage() {
        return window.location.pathname.includes('dashboard.html');
    }

    // METHOD BARU: Bind login form terpisah
    bindLoginForm() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            console.log('Binding login form');
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }
    }

    // METHOD BARU: Bind semua tombol logout
    bindLogoutButtons() {
        console.log('Binding logout buttons');
        
        // Bind logout link di navbar
        const logoutLinks = document.querySelectorAll('a[href*="logout"], .logout-btn');
        logoutLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('Yakin ingin logout?')) {
                    this.logout();
                }
            });
        });
    }

    handleLogin() {
        const username = document.getElementById('username').value.trim().toUpperCase();
        const password = document.getElementById('password').value;
        const errorAlert = document.getElementById('errorAlert');

        console.log('Login attempt for:', username);

        // Reset error
        errorAlert.classList.add('d-none');

        // Validate credentials
        if (this.authenticate(username, password)) {
            console.log('Login successful');
            this.login(username);
        } else {
            console.log('Login failed');
            errorAlert.textContent = 'Username atau password salah!';
            errorAlert.classList.remove('d-none');
        }
    }

    authenticate(username, password) {
        return USERS[username] && USERS[username] === password;
    }

    login(username) {
        console.log('Logging in:', username);
        
        // Save to localStorage
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('username', username);
        localStorage.setItem('loginTime', new Date().toISOString());

        // Redirect to dashboard
        this.redirectToDashboard();
    }

    // METHOD LOGOUT YANG DIPERBAIKI
    logout() {
        console.log('Logging out user...');
        
        // Clear semua data auth
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('username');
        localStorage.removeItem('loginTime');
        
        // Redirect ke login page dengan cache busting
        window.location.href = 'login.html?logout=true&t=' + new Date().getTime();
    }

    isLoggedIn() {
        const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
        console.log('isLoggedIn check:', loggedIn);
        return loggedIn;
    }

    getCurrentUser() {
        return localStorage.getItem('username');
    }

    redirectToDashboard() {
        console.log('Redirecting to dashboard');
        window.location.href = 'dashboard.html';
    }

    checkLogout() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('logout') === 'true') {
            console.log('Logout parameter detected');
            // Tidak perlu panggil logout() di sini karena akan infinite loop
        }
    }

    // Middleware untuk halaman yang diproteksi
    requireAuth() {
        if (!this.isLoggedIn()) {
            console.log('Authentication required, redirecting to login');
            window.location.href = 'login.html';
            return false;
        }
        console.log('User authenticated:', this.getCurrentUser());
        return true;
    }

    // Update UI dengan info user
    updateUserInfo() {
        const userElement = document.getElementById('currentUser');
        if (userElement) {
            userElement.textContent = this.getCurrentUser();
        }
    }
}

// Initialize auth system
console.log('=== AUTH SYSTEM LOADED ===');
const auth = new AuthSystem();
