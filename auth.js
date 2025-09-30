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
        // Check if user already logged in
        if (this.isLoggedIn() && window.location.pathname.includes('login.html')) {
            this.redirectToDashboard();
            return;
        }

        // Bind login form jika di halaman login
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Check for logout action
        this.checkLogout();
    }

    handleLogin() {
        const username = document.getElementById('username').value.trim().toUpperCase();
        const password = document.getElementById('password').value;
        const errorAlert = document.getElementById('errorAlert');

        // Reset error
        errorAlert.classList.add('d-none');

        // Validate credentials
        if (this.authenticate(username, password)) {
            this.login(username);
        } else {
            errorAlert.textContent = 'Username atau password salah!';
            errorAlert.classList.remove('d-none');
        }
    }

    authenticate(username, password) {
        return USERS[username] && USERS[username] === password;
    }

    login(username) {
        // Save to localStorage
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('username', username);
        localStorage.setItem('loginTime', new Date().toISOString());

        // Redirect to dashboard
        this.redirectToDashboard();
    }

    logout() {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('username');
        localStorage.removeItem('loginTime');
        window.location.href = 'login.html';
    }

    isLoggedIn() {
        return localStorage.getItem('isLoggedIn') === 'true';
    }

    getCurrentUser() {
        return localStorage.getItem('username');
    }

    redirectToDashboard() {
        window.location.href = 'dashboard.html';
    }

    checkLogout() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('logout') === 'true') {
            this.logout();
        }
    }

    // Middleware untuk halaman yang diproteksi
    requireAuth() {
        if (!this.isLoggedIn()) {
            window.location.href = 'login.html';
            return false;
        }
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
const auth = new AuthSystem();
