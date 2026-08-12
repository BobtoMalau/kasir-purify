const GOOGLE_SCRIPT_URL = 'ISI_URL_APPS_SCRIPT_ANDA_DISINI'; // PASTIKAN INI BENAR!

let cashOuts = [], products = [], cart = [], customers = [], transactions = [], usersData = [], currentUser = null;

// FUNGSI GLOBAL (Agar bisa dipanggil dari HTML)
window.switchView = function(viewId) {
    ['dashboardView', 'posView', 'cashOutView', 'historyView', 'settingsView'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = (id === viewId) ? 'block' : 'none';
    });
};

window.openAddProductModal = function() { document.getElementById('addProductModal').style.display = 'flex'; };

window.setSaldoAwal = function() {
    let input = prompt("Masukkan Saldo Awal (Rp):", localStorage.getItem('purify_saldo_awal') || 0);
    if (input) { localStorage.setItem('purify_saldo_awal', input); renderFinance(); }
};

// --- INISIALISASI ---
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    
    const loginBtn = document.getElementById('loginBtn');
    if(loginBtn) loginBtn.addEventListener('click', performLogin);
});

function performLogin() {
    const u = document.getElementById('loginUsername').value, p = document.getElementById('loginPin').value;
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "login", username: u, pin: p }) })
    .then(res => res.json()).then(data => {
        if (data.status === "success") {
            localStorage.setItem('purify_session', JSON.stringify({ username: u, role: data.role, permissions: data.permissions }));
            checkSession();
        } else alert("Login Gagal!");
    });
}

function checkSession() {
    currentUser = JSON.parse(localStorage.getItem('purify_session'));
    if (!currentUser) {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        return;
    }
    
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    const perms = currentUser.permissions ? currentUser.permissions.split(',') : [];
    const isOwner = currentUser.role.toLowerCase() === 'owner';
    const has = (f) => isOwner || perms.includes(f);

    // Tampilkan/Sembunyikan Menu
    const menus = { 'cardPos':'pos', 'cardCashOut':'cash_out', 'cardHistory':'history', 'cardFinance':'finance', 'cardAddService':'catalog', 'cardSettings':'settings' };
    Object.keys(menus).forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = has(menus[id]) ? 'flex' : 'none';
    });
    
    loadCatalogFromCloud();
}

function loadCatalogFromCloud() {
    fetch(GOOGLE_SCRIPT_URL + "?t=" + new Date().getTime())
    .then(res => res.json())
    .then(data => {
        products = data.catalog || [];
        usersData = data.users || [];
        // render lainnya...
    }).catch(err => console.error("URL Salah atau Server Error:", err));
}