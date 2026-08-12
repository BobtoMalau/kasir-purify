const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxCYJnSNPD8psGmq7vb3e2nDMOi9FP69REPjPscNbbvnNpl8rjQbEt1MYYrmQ-fhLhz/exec';

let cashOuts = [], products = [], cart = [], customers = [], transactions = [], usersData = [], currentUser = null, activeCategory = 'Kiloan';

const productGrid = document.getElementById('productGrid'), cartItemsContainer = document.getElementById('cartItems'), checkoutBtn = document.getElementById('checkoutBtn'), loginScreen = document.getElementById('loginScreen'), mainApp = document.getElementById('mainApp'), activeUserLabel = document.getElementById('activeUserLabel');

// --- SISTEM LOGIN & OTORISASI ---
function checkSession() {
    const savedUser = localStorage.getItem('purify_session');
    if (!savedUser) {
        loginScreen.style.display = 'flex';
        mainApp.style.display = 'none';
        return;
    }

    currentUser = JSON.parse(savedUser);
    loginScreen.style.display = 'none';
    mainApp.style.display = 'block';
    
    activeUserLabel.innerText = `${currentUser.username} (${currentUser.role})`;
    if (document.getElementById('welcomeGreeting')) {
        document.getElementById('welcomeGreeting').innerText = `Halo, ${currentUser.username} 👋`;
    }

    const perms = currentUser.permissions ? currentUser.permissions.split(',') : [];
    const isOwner = currentUser.role.toLowerCase() === 'owner';
    const hasAccess = (feature) => isOwner || perms.includes(feature);

    // Update Tampilan Panel Keuangan
    const financeCard = document.getElementById('financeCard');
    if (financeCard) financeCard.style.display = hasAccess('finance') ? 'block' : 'none';

    // Update Tampilan Menu (Dengan pengecekan elemen agar tidak error)
    const menus = [
        { id: 'cardPos', key: 'pos' },
        { id: 'cardCashOut', key: 'cash_out' },
        { id: 'cardHistory', key: 'history' },
        { id: 'cardFinance', key: 'finance' },
        { id: 'cardAddService', key: 'catalog' },
        { id: 'cardSettings', key: 'settings' }
    ];

    menus.forEach(m => {
        const el = document.getElementById(m.id);
        if (el) {
            el.style.display = hasAccess(m.key) ? 'flex' : 'none';
        }
    });

    switchView('dashboardView');
    loadCatalogFromCloud();
}

document.getElementById('loginBtn').addEventListener('click', () => {
    const u = document.getElementById('loginUsername').value.trim(), p = document.getElementById('loginPin').value.trim();
    if (!u || !p) { document.getElementById('loginMessage').innerText = "Isi Username dan PIN!"; return; }
    document.getElementById('loginBtn').innerText = "Memeriksa...";
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "login", username: u, pin: p }) })
    .then(res => res.json()).then(data => {
        if (data.status === "success") {
            localStorage.setItem('purify_session', JSON.stringify({ username: u, role: data.role, permissions: data.permissions || "" }));
            checkSession();
        } else document.getElementById('loginMessage').innerText = "Username/PIN salah!";
    }).finally(() => document.getElementById('loginBtn').innerText = "Masuk Aplikasi");
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    if(confirm("Keluar dari aplikasi?")) { localStorage.removeItem('purify_session'); location.reload(); }
});

// --- MANAJEMEN USER & PERMISSIONS ---
function renderUsers() {
    const list = document.getElementById('userList');
    if (!list) return;
    list.innerHTML = '';
    usersData.forEach(user => {
        const card = document.createElement('div');
        card.classList.add('history-card');
        card.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;">
            <div><span style="font-weight:700;">👤 ${user.username}</span><br><small>Role: ${user.role} | Izin: ${user.permissions || 'Tidak ada'}</small></div>
            <div style="display:flex; gap:5px;">
                <button onclick="openEditUser('${user.username}', '${user.pin}', '${user.role}', '${user.permissions}')" style="background:#e0f2f1; color:#007770; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;">Edit</button>
                ${user.username !== currentUser.username ? `<button onclick="deleteUser('${user.username}')" style="background:#fee2e2; color:#991b1b; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;">Hapus</button>` : ''}
            </div>
        </div>`;
        list.appendChild(card);
    });
}

window.openEditUser = function(u, p, r, perms) {
    document.getElementById('editUserLabel').innerText = u;
    document.getElementById('editUsername').value = u;
    document.getElementById('editUserPin').value = p;
    document.getElementById('editUserRole').value = r;
    const permsArr = perms ? perms.split(',') : [];
    const container = document.getElementById('editPermissionsContainer');
    container.innerHTML = ['pos', 'cash_out', 'history', 'finance', 'catalog', 'settings'].map(f => `
        <label><input type="checkbox" class="edit-perm" value="${f}" ${permsArr.includes(f) ? 'checked' : ''}> ${f.toUpperCase()}</label>
    `).join('');
    document.getElementById('editUserModal').style.display = 'flex';
};

document.getElementById('updateUserBtn').addEventListener('click', () => {
    const u = document.getElementById('editUsername').value, perms = Array.from(document.querySelectorAll('.edit-perm:checked')).map(cb => cb.value).join(',');
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: "update_user", username: u, pin: document.getElementById('editUserPin').value, role: document.getElementById('editUserRole').value, permissions: perms }) })
    .then(() => { alert("Update berhasil!"); document.getElementById('editUserModal').style.display = 'none'; loadCatalogFromCloud(); });
});

document.getElementById('saveUserBtn').addEventListener('click', () => {
    const uName = document.getElementById('newUsername').value, perms = Array.from(document.querySelectorAll('.perm-checkbox:checked')).map(cb => cb.value).join(',');
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: "add_user", username: uName, pin: document.getElementById('newUserPin').value, role: document.getElementById('newUserRole').value, permissions: perms }) })
    .then(() => { alert("User ditambahkan!"); document.getElementById('addUserModal').style.display = 'none'; loadCatalogFromCloud(); });
});

// --- FUNGSI LAIN (KASIR, TRANSAKSI, PRODUK) ---
window.switchView = function(viewId) {
    ['dashboardView', 'posView', 'cashOutView', 'historyView', 'settingsView'].forEach(id => document.getElementById(id).style.display = (id === viewId) ? 'block' : 'none');
    if (viewId === 'historyView') renderHistory();
    if (viewId === 'posView') renderCart();
    if (viewId === 'settingsView') renderUsers();
};

function loadCatalogFromCloud() {
    fetch(GOOGLE_SCRIPT_URL + "?t=" + new Date().getTime())
    .then(res => res.json()).then(data => {
        products = data.catalog || []; customers = data.customers || []; transactions = data.transactions || []; cashOuts = data.cashOuts || []; usersData = data.users || [];
        renderProducts(); renderFinance(); if(document.getElementById('settingsView').style.display === 'block') renderUsers();
    });
}

// (Fungsi render lainnya seperti renderProducts, renderCart, checkoutBtn, dll tetap sama seperti kode Anda sebelumnya)
// Pastikan fungsi-fungsi pendukung yang Anda miliki tidak terhapus.

checkSession();