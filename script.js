// GANTI DENGAN URL GOOGLE APPS SCRIPT MILIK ANDA
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxCYJnSNPD8psGmq7vb3e2nDMOi9FP69REPjPscNbbvnNpl8rjQbEt1MYYrmQ-fhLhz/exec';

let cashOuts = [], products = [], cart = [], customers = [], transactions = [], usersData = [], currentUser = null, activeCategory = 'Kiloan';

// --- FUNGSI UTAMA (Didefinisikan dulu agar tidak error "not defined") ---
window.switchView = function(viewId) {
    const views = ['dashboardView', 'posView', 'cashOutView', 'historyView', 'settingsView'];
    views.forEach(id => { 
        const el = document.getElementById(id); 
        if(el) el.style.display = (id === viewId) ? 'block' : 'none'; 
    });
    if (viewId === 'historyView') renderHistory();
    if (viewId === 'posView') renderCart(); 
    if (viewId === 'settingsView') renderUsers(); 
};

// ... (Pindahkan fungsi-fungsi Anda lainnya ke sini: renderFinance, loadCatalogFromCloud, dll) ...

// --- SISTEM LOGIN & OTORISASI ---
function checkSession() {
    const savedUser = localStorage.getItem('purify_session');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        if(document.getElementById('loginScreen')) document.getElementById('loginScreen').style.display = 'none';
        if(document.getElementById('mainApp')) document.getElementById('mainApp').style.display = 'block';
        
        if(document.getElementById('activeUserLabel')) activeUserLabel.innerText = `${currentUser.username} (${currentUser.role})`;
        if(document.getElementById('welcomeGreeting')) document.getElementById('welcomeGreeting').innerText = `Halo, ${currentUser.username} 👋`;

        const perms = currentUser.permissions ? currentUser.permissions.split(',') : [];
        const isOwner = currentUser.role.toLowerCase() === 'owner';
        const hasAccess = (feature) => isOwner || perms.includes(feature);

        // Update UI
        if (document.getElementById('financeCard')) document.getElementById('financeCard').style.display = hasAccess('finance') ? 'block' : 'none';
        ['cardPos', 'cardCashOut', 'cardHistory', 'cardFinance', 'cardAddService', 'cardSettings'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.style.display = hasAccess(id.replace('card','').toLowerCase().replace('pos','pos').replace('cashout','cash_out')) ? 'flex' : 'none';
        });

        window.switchView('dashboardView');
        loadCatalogFromCloud();
    } else {
        if(document.getElementById('loginScreen')) document.getElementById('loginScreen').style.display = 'flex';
        if(document.getElementById('mainApp')) document.getElementById('mainApp').style.display = 'none';
    }
}

// --- INISIALISASI (Dijalankan hanya setelah HTML siap) ---
document.addEventListener('DOMContentLoaded', () => {
    // Pasang listener hanya jika elemennya ada (mencegah error null)
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) loginBtn.addEventListener('click', () => { /* ... kode login Anda ... */ });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => { /* ... kode logout Anda ... */ });

    // Jalankan pengecekan sesi pertama kali
    checkSession();
});