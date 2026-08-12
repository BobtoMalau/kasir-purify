// GANTI DENGAN URL GOOGLE APPS SCRIPT MILIK ANDA
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxCYJnSNPD8psGmq7vb3e2nDMOi9FP69REPjPscNbbvnNpl8rjQbEt1MYYrmQ-fhLhz/exec';

let cashOuts = [];
let products = [];
let cart = [];
let customers = [];
let transactions = [];
let usersData = []; 
let currentUser = null;
let activeCategory = 'Kiloan';

const productGrid = document.getElementById('productGrid');
const cartItemsContainer = document.getElementById('cartItems');
const checkoutBtn = document.getElementById('checkoutBtn');
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');
const activeUserLabel = document.getElementById('activeUserLabel');

// --- SISTEM LOGIN & OTORISASI AKSES BERBASIS PERMISSIONS ---
function checkSession() {
    const savedUser = localStorage.getItem('purify_session');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        loginScreen.style.display = 'none';
        mainApp.style.display = 'block';
        
        activeUserLabel.innerText = `${currentUser.username} (${currentUser.role})`;
        const greeting = document.getElementById('welcomeGreeting');
        if (greeting) greeting.innerText = `Halo, ${currentUser.username} 👋`;

        // Ambil hak akses dari sesi
        const perms = currentUser.permissions ? currentUser.permissions.split(',') : [];
        const isOwner = currentUser.role.toLowerCase() === 'owner';

        // Fungsi cek akses: Jika Owner selalu TRUE, jika bukan cek centangan
        const hasAccess = (feature) => isOwner || perms.includes(feature);

        // Update Tampilan Panel Keuangan (Finance Card)
        const financeCard = document.getElementById('financeCard');
        if (financeCard) financeCard.style.display = hasAccess('finance') ? 'block' : 'none';

        // Update Tampilan Menu di Dashboard (Berdasarkan ID Card di index.html)
        const toggleCard = (cardId, permissionKey) => {
            const card = document.getElementById(cardId);
            if (card) card.style.display = hasAccess(permissionKey) ? 'flex' : 'none';
        };

        toggleCard('cardPos', 'pos');
        toggleCard('cardCashOut', 'cash_out');
        toggleCard('cardHistory', 'history');
        toggleCard('cardFinance', 'finance');
        toggleCard('cardAddService', 'catalog');
        toggleCard('cardSettings', 'settings');

        switchView('dashboardView');
        loadCatalogFromCloud();
    } else {
        loginScreen.style.display = 'flex';
        mainApp.style.display = 'none';
    }
}

document.getElementById('loginBtn').addEventListener('click', () => {
    const u = document.getElementById('loginUsername').value.trim();
    const p = document.getElementById('loginPin').value.trim();
    const msg = document.getElementById('loginMessage');
    const btn = document.getElementById('loginBtn');
    
    if (!u || !p) { msg.innerText = "Isi Username dan PIN!"; return; }
    btn.innerText = "Memeriksa..."; btn.disabled = true; msg.innerText = "";
    
    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' }, 
        body: JSON.stringify({ action: "login", username: u, pin: p })
    }).then(res => res.json()).then(data => {
        if (data.status === "success") {
            // Simpan sesi lengkap dengan data permissions
            localStorage.setItem('purify_session', JSON.stringify({ 
                username: u, 
                role: data.role, 
                permissions: data.permissions || "" 
            }));
            document.getElementById('loginUsername').value = ''; document.getElementById('loginPin').value = '';
            checkSession();
        } else msg.innerText = "Username atau PIN salah!";
    }).catch(() => msg.innerText = "Gagal terhubung.").finally(() => { btn.innerText = "Masuk Aplikasi"; btn.disabled = false; });
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    if(confirm("Keluar dari aplikasi?")) { localStorage.removeItem('purify_session'); currentUser = null; cart = []; checkSession(); }
});

// --- PERPINDAHAN HALAMAN ---
window.switchView = function(viewId) {
    const views = ['dashboardView', 'posView', 'cashOutView', 'historyView', 'settingsView'];
    views.forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; });
    const targetView = document.getElementById(viewId);
    if(targetView) targetView.style.display = 'block';

    if (viewId === 'historyView') renderHistory();
    if (viewId === 'posView') renderCart(); 
    if (viewId === 'settingsView') renderUsers(); 
};

window.openAddProductModal = function() {
    document.getElementById('newProductName').value = ''; document.getElementById('newProductPrice').value = '';
    document.getElementById('addProductModal').style.display = 'flex';
};

// --- MONITORING KEUANGAN ---
function renderFinance() {
    let saldoAwal = parseFloat(localStorage.getItem('purify_saldo_awal')) || 0;
    let totalLunas = transactions.filter(t => t.status === 'Lunas').reduce((sum, t) => sum + (Number(t.total) || 0), 0);
    let totalPiutang = transactions.filter(t => t.status === 'Belum Lunas').reduce((sum, t) => sum + (Number(t.total) || 0), 0);
    let totalPengeluaran = cashOuts.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    let saldoAktual = saldoAwal + totalLunas - totalPengeluaran;
    let saldoProyeksi = saldoAktual + totalPiutang;

    const elAktual = document.getElementById('saldoAktualTxt');
    const elProyeksi = document.getElementById('saldoProyeksiTxt');

    if(elAktual) elAktual.innerText = `Rp ${saldoAktual.toLocaleString('id-ID')}`;
    if(elProyeksi) elProyeksi.innerText = `Rp ${saldoProyeksi.toLocaleString('id-ID')}`;
}

window.setSaldoAwal = function() {
    let current = localStorage.getItem('purify_saldo_awal') || 0;
    let input = prompt("Masukkan jumlah Saldo Awal di Laci (Rp):", current);
    if (input !== null && !isNaN(input) && input.trim() !== '') {
        localStorage.setItem('purify_saldo_awal', parseFloat(input));
        renderFinance(); alert("Saldo awal berhasil disimpan!");
    }
};

// --- PUSAT PENARIKAN DATA ---
function loadCatalogFromCloud() {
    if(productGrid) productGrid.innerHTML = '<p style="text-align:center; grid-column:1/-1; color:gray; font-size:13px;">Memuat data dari sistem...</p>';
    const urlAntiNyangkut = GOOGLE_SCRIPT_URL + "?t=" + new Date().getTime();
    
    fetch(urlAntiNyangkut)
        .then(res => res.json())
        .then(data => { 
            products = data.catalog || []; customers = data.customers || []; 
            transactions = data.transactions || []; cashOuts = data.cashOuts || []; 
            usersData = data.users || []; 
            
            renderProducts(); populateCustomerList(); renderFinance(); 
            if(document.getElementById('settingsView').style.display === 'block') renderUsers();
        })
        .catch(() => { if(productGrid) productGrid.innerHTML = '<p style="text-align:center; grid-column:1/-1; color:red; font-size:13px;">Gagal memuat sistem.</p>'; });
}

// --- PENGATURAN AKSES (MANAJEMEN PENGGUNA) ---
function renderUsers() {
    const list = document.getElementById('userList');
    if (!list) return;
    list.innerHTML = '';
    
    if (usersData.length === 0) {
        list.innerHTML = `<p style="text-align:center; color:gray; font-size:13px;">Belum ada data pengguna.</p>`; return;
    }

    usersData.forEach(user => {
        const card = document.createElement('div');
        card.classList.add('history-card');
        const isMe = user.username === currentUser.username;
        
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span style="font-weight:700; font-size:15px;">👤 ${user.username}</span><br>
                    <span style="font-size:12px; color:gray;">PIN: ${user.pin} | Role: <b>${user.role}</b></span>
                </div>
                ${!isMe ? `<button onclick="deleteUser('${user.username}')" style="background:#fee2e2; color:#991b1b; border:none; border-radius:6px; padding:6px 12px; font-weight:bold; cursor:pointer;">Hapus</button>` : `<span style="font-size:12px; color:var(--primary); font-weight:bold;">(Anda)</span>`}
            </div>
        `;
        list.appendChild(card);
    });
}

// SIMPAN PENGGUNA DENGAN CHECKBOX HAK AKSES
document.getElementById('saveUserBtn').addEventListener('click', () => {
    const uName = document.getElementById('newUsername').value.trim();
    const uPin = document.getElementById('newUserPin').value.trim();
    const uRole = document.getElementById('newUserRole').value.trim() || "Kasir";
    
    if (!uName || !uPin) { alert("Isi Username dan PIN dengan benar!"); return; }
    
    // Ambil semua centangan izin
    const checkboxes = document.querySelectorAll('.perm-checkbox:checked');
    const selectedPerms = Array.from(checkboxes).map(cb => cb.value).join(',');

    const exist = usersData.find(u => u.username.toLowerCase() === uName.toLowerCase());
    if (exist) { alert("Username sudah terdaftar!"); return; }

    const btn = document.getElementById('saveUserBtn');
    btn.innerText = "Menyimpan..."; btn.disabled = true;

    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "add_user", username: uName, pin: uPin, role: uRole, permissions: selectedPerms })
    }).then(() => {
        alert("Pengguna & Hak Akses berhasil disimpan!");
        document.getElementById('addUserModal').style.display = 'none';
        document.getElementById('newUsername').value = ''; document.getElementById('newUserPin').value = '';
        loadCatalogFromCloud();
    }).catch(() => alert("Koneksi error")).finally(() => { btn.innerText = "Simpan Pengguna"; btn.disabled = false; });
});

window.deleteUser = function(username) {
    if(confirm(`Yakin ingin menghapus akses untuk '${username}'?`)) {
        usersData = usersData.filter(u => u.username !== username);
        renderUsers();
        fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: "delete_user", username: username })
        });
    }
};

// --- DATA PELANGGAN & PRODUK ---
function populateCustomerList() {
    const customerList = document.getElementById('customerList');
    if (!customerList) return;
    customerList.innerHTML = ''; 
    customers.forEach(cust => {
        const option = document.createElement('option');
        option.value = cust.name; option.text = `WA: ${cust.wa}`; 
        customerList.appendChild(option);
    });
}

document.getElementById('customerName').addEventListener('input', (e) => { checkAndFillCustomer(e.target.value); });
document.getElementById('customerName').addEventListener('change', (e) => { checkAndFillCustomer(e.target.value); });
function checkAndFillCustomer(typedName) {
    typedName = typedName.trim().toLowerCase(); if (!typedName) return;
    const foundCustomer = customers.find(c => c.name && c.name.toLowerCase() === typedName);
    const waInput = document.getElementById('customerWA');
    if (foundCustomer) {
        waInput.value = foundCustomer.wa; waInput.style.borderColor = 'var(--primary)'; waInput.style.backgroundColor = '#e0f2f1';
        setTimeout(() => { waInput.style.borderColor = 'var(--border-color)'; waInput.style.backgroundColor = '#f8fafc'; }, 1000);
    }
}
document.getElementById('customerWA').addEventListener('input', (e) => {
    const typedWA = e.target.value; const foundCustomer = customers.find(c => c.wa === typedWA);
    if (foundCustomer) {
        const nameInput = document.getElementById('customerName');
        nameInput.value = foundCustomer.name; nameInput.style.borderColor = 'var(--primary)'; nameInput.style.backgroundColor = '#e0f2f1';
        setTimeout(() => { nameInput.style.borderColor = 'var(--border-color)'; nameInput.style.backgroundColor = '#f8fafc'; }, 1000);
    }
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active'); activeCategory = e.target.getAttribute('data-category'); renderProducts();
    });
});

function renderProducts() {
    if(!productGrid) return;
    productGrid.innerHTML = '';
    const currentCat = activeCategory.toLowerCase();
    const filteredProducts = products.filter(p => (p.category || 'Kiloan').toLowerCase() === currentCat);
    
    if(filteredProducts.length === 0) { productGrid.innerHTML = `<p style="text-align:center; grid-column:1/-1; color:gray; font-size:13px;">Belum ada layanan.</p>`; return; }
    
    const isOwner = currentUser && currentUser.role.toLowerCase() === 'owner';
    filteredProducts.forEach((product) => {
        const card = document.createElement('div');
        card.classList.add('product-card');
        card.style.cssText = "border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; background: #fff; cursor: pointer; position: relative; box-shadow: 0 2px 5px rgba(0,0,0,0.02);";
        card.innerHTML = `
            ${isOwner ? `<button onclick="deleteProduct(${product.id}, event)" style="position:absolute; top:8px; right:8px; background:#fee2e2; color:#991b1b; border:none; border-radius:4px; padding:2px 6px; font-size:12px; cursor:pointer;">✕</button>` : ''}
            <h4 style="margin: 0 0 5px 0; font-size: 13px; color: #0f172a; padding-right: 20px;">${product.name}</h4>
            <p style="margin: 0; font-size: 13px; font-weight: 700; color: #007770;">Rp ${Number(product.price).toLocaleString('id-ID')}</p>
        `;
        card.addEventListener('click', () => addToCart(product));
        productGrid.appendChild(card);
    });
}

window.deleteProduct = function(id, event) {
    event.stopPropagation(); 
    if(confirm("Hapus layanan ini permanen?")) {
        products = products.filter(p => p.id !== id); renderProducts();
        fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: "delete_product", productId: id }) });
    }
};

// --- FORMULIR KERANJANG TRANSAKSI ---
function addToCart(product) {
    const existing = cart.find(item => item.id === product.id);
    if (existing) existing.quantity += 1; else cart.push({ ...product, quantity: 1 });
    renderCart();
}

function renderCart() {
    let total = 0; if(!cartItemsContainer) return; cartItemsContainer.innerHTML = '';
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `<p style="text-align:center; color:gray; font-size:13px; margin:15px 0; font-style:italic;">Belum ada layanan yang dipilih. Klik layanan di atas.</p>`;
    } else {
        cart.forEach((item, index) => {
            let subtotal = item.price * item.quantity; total += subtotal;
            const itemRow = document.createElement('div');
            itemRow.classList.add('cart-item-row');
            itemRow.innerHTML = `
                <div class="cart-item-info">
                    <span style="color:var(--text-main); display:block; margin-bottom:4px; font-weight:600;">${item.name}</span>
                    <div class="cart-item-qty">
                        <input type="number" min="0.1" step="0.1" class="qty-input" data-index="${index}" value="${item.quantity}">
                        <span style="font-size:12px; color:var(--text-muted);">x Rp ${item.price.toLocaleString('id-ID')}</span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight:700; font-size:14px; color:var(--primary);">Rp ${subtotal.toLocaleString('id-ID')}</span>
                    <button class="btn-remove" data-index="${index}" style="background:#fee2e2; color:#991b1b; border:none; border-radius:6px; padding:4px 8px; font-weight:bold;">✕</button>
                </div>
            `;
            cartItemsContainer.appendChild(itemRow);
        });
        document.querySelectorAll('.qty-input').forEach(inp => { inp.addEventListener('change', (e) => { let newQty = parseFloat(e.target.value); if (newQty <= 0 || isNaN(newQty)) newQty = 1; cart[e.target.getAttribute('data-index')].quantity = newQty; renderCart(); }); });
        document.querySelectorAll('.btn-remove').forEach(btn => { btn.addEventListener('click', (e) => { cart.splice(e.target.getAttribute('data-index'), 1); renderCart(); }); });
    }
    document.getElementById('totalPrice').innerText = `Rp ${total.toLocaleString('id-ID')}`; calculateChange(total);
}

function calculateChange(totalPrice) {
    const cashInput = document.getElementById('cashGiven'); const el = document.getElementById('changeAmount');
    if(!cashInput || !el) return;
    const cash = parseFloat(cashInput.value) || 0; const change = cash - totalPrice;
    if (change >= 0) { el.innerText = `Rp ${change.toLocaleString('id-ID')}`; el.style.color = 'var(--primary)'; } 
    else { el.innerText = `Kurang Rp ${Math.abs(change).toLocaleString('id-ID')}`; el.style.color = 'var(--danger)'; }
}
document.getElementById('cashGiven').addEventListener('input', () => { calculateChange(cart.reduce((s, i) => s + (i.price * i.quantity), 0)); });
document.getElementById('paymentStatus').addEventListener('change', (e) => {
    const status = e.target.value; const cashInput = document.getElementById('cashGiven');
    if (status === 'Belum Lunas') { cashInput.value = '0'; cashInput.disabled = true; cashInput.style.background = '#e2e8f0'; } 
    else { cashInput.disabled = false; cashInput.style.background = '#f8fafc'; }
    calculateChange(cart.reduce((s, i) => s + (i.price * i.quantity), 0));
});

// --- TRANSAKSI, INVOICE, DAN PRINTER ---
function generateInvoiceNumber() {
    const d = new Date(); return `INV-${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
}

checkoutBtn.addEventListener('click', () => {
    if (cart.length === 0) { alert("Pilih minimal 1 layanan!"); return; }
    let total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    const paymentStatus = document.getElementById('paymentStatus').value;
    let cash = parseFloat(document.getElementById('cashGiven').value) || 0;

    if (paymentStatus === 'Lunas' && cash < total) { alert("Uang pembayaran kurang!"); return; }
    if (paymentStatus === 'Belum Lunas') cash = 0;

    const invoiceNumber = generateInvoiceNumber();
    let itemDetails = cart.map(item => `${item.name} (${item.quantity}x)`).join(", ");
    const custName = document.getElementById('customerName').value;
    const custWA = document.getElementById('customerWA').value;
    
    let transactionData = { action: "transaction", invoice: invoiceNumber, items: itemDetails, total: total, cash: cash, change: paymentStatus === 'Lunas' ? (cash - total) : 0, customerName: custName, customerWA: custWA, paymentStatus: paymentStatus };
    checkoutBtn.innerText = "Memproses..."; checkoutBtn.disabled = true;
    
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(transactionData) })
    .then(() => {
        if (custWA && custWA.length >= 9) window.resendWA(invoiceNumber, custWA, custName, itemDetails, total, paymentStatus);
        else alert(`Transaksi Berhasil!\nNo: ${invoiceNumber}\nStatus: ${paymentStatus}`);
        
        cart = []; document.getElementById('cashGiven').value = ''; document.getElementById('cashGiven').disabled = false; 
        document.getElementById('paymentStatus').value = 'Lunas'; document.getElementById('customerName').value = ''; document.getElementById('customerWA').value = '';
        renderCart(); loadCatalogFromCloud(); switchView('dashboardView');
    }).catch(() => alert("Koneksi gagal.")).finally(() => { checkoutBtn.innerText = "Selesaikan Transaksi"; checkoutBtn.disabled = false; });
});

document.getElementById('refreshHistoryBtn').addEventListener('click', () => { loadCatalogFromCloud(); alert("Data diperbarui!"); });

window.resendWA = function(invoice, wa, name, itemsStr, total, status) {
    let fWA = String(wa).replace(/\D/g, ''); if (fWA.startsWith('0')) fWA = '62' + fWA.substring(1); else if (fWA.startsWith('8')) fWA = '62' + fWA; 
    let msg = `*PURIFY LAUNDRY*\n--------------------------------------\n*No. Nota:* ${invoice}\n*Pelanggan:* ${name || 'Umum'}\n*Status:* ${status}\n--------------------------------------\n*Rincian Pesanan:*\n- ${itemsStr.split(', ').join('\n- ')}\n--------------------------------------\n*TOTAL TAGIHAN: Rp ${Number(total).toLocaleString('id-ID')}*\n--------------------------------------\nTerima kasih telah mempercayakan cucian Anda di tempat kami! 🙏`;
    window.open(`https://wa.me/${fWA}?text=${encodeURIComponent(msg)}`, '_blank');
};

window.printThermalReceipt = async function(invoice, name, itemsStr, total, cash, change, status) {
    try {
        const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455', '0000ff00-0000-1000-8000-00805f9b34fb'] });
        if (!device) return; const server = await device.gatt.connect(); const services = await server.getPrimaryServices();
        let tChar = null;
        for (const s of services) { for (const c of await s.getCharacteristics()) { if (c.properties.write || c.properties.writeWithoutResponse) { tChar = c; break; } } if (tChar) break; }
        if (!tChar) { alert("Gagal menemukan jalur printer."); return; }

        let enc = new TextEncoder(); let cmds = [];
        cmds.push(new Uint8Array([0x1B, 0x40]), enc.encode("\x1b\x61\x01"), enc.encode("PURIFY LAUNDRY\n--------------------------------\n"), enc.encode("\x1b\x61\x00"), enc.encode(`No Nota  : ${invoice}\nTanggal  : ${new Date().toLocaleString('id-ID')}\nPelanggan: ${name || 'Umum'}\nStatus   : ${status}\n--------------------------------\n`), enc.encode("RINCIAN PESANAN:\n"));
        itemsStr.split(', ').forEach(i => cmds.push(enc.encode(`- ${i}\n`)));
        cmds.push(enc.encode("--------------------------------\n"), enc.encode(`TOTAL    : Rp ${Number(total).toLocaleString('id-ID')}\n`));
        if (status === 'Lunas') cmds.push(enc.encode(`Bayar    : Rp ${Number(cash).toLocaleString('id-ID')}\n`), enc.encode(`Kembali  : Rp ${Number(change).toLocaleString('id-ID')}\n`));
        cmds.push(enc.encode("--------------------------------\n"), enc.encode("\x1b\x61\x01"), enc.encode("Terima Kasih Atas\nKepercayaan Anda!\n\n\n"), new Uint8Array([0x1D, 0x56, 0x42, 0x00])); 
        for (let cmd of cmds) await tChar.writeValue(cmd);
        alert("Nota berhasil dicetak!"); server.disconnect();
    } catch (e) { alert("Pencetakan dibatalkan."); }
};

function renderHistory() {
    const historyList = document.getElementById('historyList'); if (!historyList) return; historyList.innerHTML = '';
    if (transactions.length === 0) { historyList.innerHTML = `<p style="text-align:center; color:gray; font-size:13px; margin-top:30px;">Belum ada riwayat transaksi.</p>`; return; }
    transactions.forEach(trx => {
        const card = document.createElement('div'); card.classList.add('history-card');
        let fDate = trx.date; try { const d = new Date(trx.date); fDate = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; } catch(e) {}
        card.innerHTML = `<div class="hc-top"><span class="hc-inv">${trx.invoice || 'INV-XXXX'}</span><span class="hc-date">${fDate}</span></div><div class="hc-middle">${trx.items}</div><div class="hc-bottom"><div><span class="hc-cust">👤 ${trx.name || 'Umum'} (${trx.wa || '-'})</span><br><span class="badge ${trx.status === 'Lunas' ? 'lunas' : 'belum'}">${trx.status}</span></div><div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;"><div class="hc-total">Rp ${Number(trx.total).toLocaleString('id-ID')}</div><div style="display: flex; gap: 5px;"><button onclick="printThermalReceipt('${trx.invoice}', '${trx.name}', '${trx.items}', ${trx.total}, ${trx.cash || 0}, ${trx.change || 0}, '${trx.status}')" style="background:#0f766e; color:white; border:none; padding:6px 10px; border-radius:6px; font-size:11px; font-weight:700;">🖨️ Cetak</button>${(trx.wa && String(trx.wa).length > 8) ? `<button class="btn-wa" onclick="resendWA('${trx.invoice}', '${trx.wa}', '${trx.name}', '${trx.items}', ${trx.total}, '${trx.status}')">WA</button>` : ''}</div></div></div>`;
        historyList.appendChild(card);
    });
}

// --- PENCATATAN KAS KELUAR ---
const cashOutModal = document.getElementById('cashOutModal');
document.getElementById('openCashOutModal').addEventListener('click', () => { document.getElementById('coDescription').value = ''; document.getElementById('coAmount').value = ''; cashOutModal.style.display = 'flex'; });
document.getElementById('cancelCoBtn').addEventListener('click', () => { cashOutModal.style.display = 'none'; });
document.getElementById('saveCoBtn').addEventListener('click', () => {
    const desc = document.getElementById('coDescription').value.trim(); const amt = parseFloat(document.getElementById('coAmount').value);
    if (!desc || isNaN(amt) || amt <= 0) { alert("Masukkan data valid!"); return; }
    document.getElementById('saveCoBtn').innerText = "Menyimpan..."; document.getElementById('saveCoBtn').disabled = true;
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: "cash_out", date: new Date().toISOString(), description: desc, amount: amt, user: currentUser.username }) })
    .then(() => { alert("Kas keluar dicatat!"); cashOutModal.style.display = 'none'; loadCatalogFromCloud(); })
    .finally(() => { document.getElementById('saveCoBtn').innerText = "Simpan Pengeluaran"; document.getElementById('saveCoBtn').disabled = false; });
});

// --- TAMBAH PRODUK ---
document.getElementById('cancelAddBtn').addEventListener('click', () => document.getElementById('addProductModal').style.display = 'none');
document.getElementById('saveProductBtn').addEventListener('click', () => {
    const n = document.getElementById('newProductName').value.trim(); const p = parseInt(document.getElementById('newProductPrice').value); const c = document.getElementById('newProductCategory').value;
    if (!n || isNaN(p) || p <= 0) { alert("Isi data valid!"); return; }
    products.push({ id: Date.now(), name: n, price: p, category: c }); renderProducts(); document.getElementById('addProductModal').style.display = 'none';
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: "add_product", product: { id: Date.now(), name: n, price: p, category: c } }) });
});

checkSession();