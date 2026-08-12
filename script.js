// PASTIKAN URL INI BENAR (URL Web App dari Deploy Google Apps Script)
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxCYJnSNPD8psGmq7vb3e2nDMOi9FP69REPjPscNbbvnNpl8rjQbEt1MYYrmQ-fhLhz/exec';

let cashOuts = [], products = [], cart = [], customers = [], transactions = [], usersData = [], currentUser = null, activeCategory = 'Kiloan';

// --- FUNGSI GLOBAL (Agar bisa dipanggil dari index.html) ---
window.switchView = function(viewId) {
    ['dashboardView', 'posView', 'cashOutView', 'historyView', 'settingsView'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = (id === viewId) ? 'block' : 'none';
    });
    if (viewId === 'historyView') renderHistory();
    if (viewId === 'posView') renderCart();
    if (viewId === 'settingsView') renderUsers();
};

window.openAddProductModal = function() { document.getElementById('addProductModal').style.display = 'flex'; };

// --- INISIALISASI ---
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    // Tambahkan event listener untuk tombol yang ada di layar login
    if(document.getElementById('loginBtn')) document.getElementById('loginBtn').addEventListener('click', performLogin);
    if(document.getElementById('logoutBtn')) document.getElementById('logoutBtn').addEventListener('click', () => {
        if(confirm("Keluar dari aplikasi?")) { localStorage.removeItem('purify_session'); location.reload(); }
    });
});

// --- SISTEM LOGIN ---
function performLogin() {
    const u = document.getElementById('loginUsername').value.trim();
    const p = document.getElementById('loginPin').value.trim();
    const btn = document.getElementById('loginBtn');
    if (!u || !p) { alert("Isi Username dan PIN!"); return; }
    btn.innerText = "Memeriksa...";
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "login", username: u, pin: p }) })
    .then(res => res.json()).then(data => {
        if (data.status === "success") {
            localStorage.setItem('purify_session', JSON.stringify({ username: u, role: data.role, permissions: data.permissions || "" }));
            checkSession();
        } else alert("Login Gagal!");
    }).finally(() => btn.innerText = "Masuk Aplikasi");
}

function checkSession() {
    currentUser = JSON.parse(localStorage.getItem('purify_session'));
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    
    if (!currentUser) {
        if(loginScreen) loginScreen.style.display = 'flex';
        if(mainApp) mainApp.style.display = 'none';
        return;
    }
    
    if(loginScreen) loginScreen.style.display = 'none';
    if(mainApp) mainApp.style.display = 'block';
    
    const perms = currentUser.permissions ? currentUser.permissions.split(',') : [];
    const isOwner = currentUser.role.toLowerCase() === 'owner';
    const has = (f) => isOwner || perms.includes(f);

    // Tampilkan/Sembunyikan Menu
    const menus = { 'cardPos':'pos', 'cardCashOut':'cash_out', 'cardHistory':'history', 'cardFinance':'finance', 'cardAddService':'catalog', 'cardSettings':'settings' };
    Object.keys(menus).forEach(id => { const el = document.getElementById(id); if(el) el.style.display = has(menus[id]) ? 'flex' : 'none'; });
    
    loadCatalogFromCloud();
}

// --- DATA & RENDER (PENGATURAN USER) ---
function loadCatalogFromCloud() {
    fetch(GOOGLE_SCRIPT_URL + "?t=" + new Date().getTime())
    .then(res => res.json()).then(data => {
        products = data.catalog || []; customers = data.customers || []; 
        transactions = data.transactions || []; cashOuts = data.cashOuts || []; usersData = data.users || [];
        renderProducts(); renderFinance();
    });
}

function renderUsers() {
    const list = document.getElementById('userList');
    if (!list) return;
    list.innerHTML = '';
    usersData.forEach(user => {
        const card = document.createElement('div');
        card.classList.add('history-card');
        card.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;">
            <div>👤 ${user.username} <br><small>Role: ${user.role}</small></div>
            <button onclick="openEditUser('${user.username}', '${user.pin}', '${user.role}', '${user.permissions}')">Edit</button>
        </div>`;
        list.appendChild(card);
    });
}