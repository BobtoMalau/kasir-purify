const GOOGLE_SCRIPT_URL = 'ISI_URL_WEP_APP_ANDA_DISINI';

let products = [], cart = [], transactions = [], cashOuts = [], usersData = [], currentUser = null;

// --- FUNGSI GLOBAL (Agar tombol onclick bekerja) ---
window.switchView = function(viewId) {
    ['dashboardView', 'posView', 'cashOutView', 'historyView', 'settingsView'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = (id === viewId) ? 'block' : 'none';
    });
};

window.openAddProductModal = function() { document.getElementById('addProductModal').style.display = 'flex'; };

window.setSaldoAwal = function() {
    let input = prompt("Saldo Awal (Rp):", localStorage.getItem('purify_saldo_awal') || 0);
    if (input) { localStorage.setItem('purify_saldo_awal', input); renderFinance(); }
};

// --- INISIALISASI ---
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    document.getElementById('loginBtn').addEventListener('click', loginUser);
});

// --- SISTEM LOGIN & OTORISASI ---
function checkSession() {
    currentUser = JSON.parse(localStorage.getItem('purify_session'));
    if (!currentUser) return;
    
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    const perms = currentUser.permissions ? currentUser.permissions.split(',') : [];
    const isOwner = currentUser.role.toLowerCase() === 'owner';
    const has = (f) => isOwner || perms.includes(f);

    // Tampilkan Menu Sesuai Izin
    const menus = { 'cardPos':'pos', 'cardCashOut':'cash_out', 'cardHistory':'history', 'cardFinance':'finance', 'cardAddService':'catalog', 'cardSettings':'settings' };
    Object.keys(menus).forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = has(menus[id]) ? 'flex' : 'none';
    });
    
    loadAllData();
}

function loginUser() {
    const u = document.getElementById('loginUsername').value, p = document.getElementById('loginPin').value;
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "login", username: u, pin: p }) })
    .then(res => res.json()).then(data => {
        if (data.status === "success") {
            localStorage.setItem('purify_session', JSON.stringify({ username: u, role: data.role, permissions: data.permissions }));
            checkSession();
        } else alert("Login Gagal");
    });
}

function loadAllData() {
    fetch(GOOGLE_SCRIPT_URL + "?t=" + new Date().getTime())
    .then(res => res.json()).then(data => {
        products = data.catalog || [];
        transactions = data.transactions || [];
        cashOuts = data.cashOuts || [];
        usersData = data.users || [];
        renderFinance();
        if(document.getElementById('userList')) renderUsers();
    });
}

// --- FUNGSI BISNIS (Printer, WA, Kasir) ---
// Masukkan fungsi checkoutBtn, printThermalReceipt, dan renderHistory dari kode asli Anda DI SINI.
// Pastikan tidak ada fungsi yang dihapus.