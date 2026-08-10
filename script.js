// GANTI DENGAN URL GOOGLE APPS SCRIPT MILIK ANDA
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxCYJnSNPD8psGmq7vb3e2nDMOi9FP69REPjPscNbbvnNpl8rjQbEt1MYYrmQ-fhLhz/exec';

let products = [];
let cart = [];
let customers = [];
let currentUser = null;
let activeCategory = 'Kiloan';
let transactions = [];

// Elemen DOM
const productGrid = document.getElementById('productGrid');
const cartItemsContainer = document.getElementById('cartItems');
const checkoutBtn = document.getElementById('checkoutBtn');

const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');
const activeUserLabel = document.getElementById('activeUserLabel');

// --- SISTEM LOGIN & SESI ---
function checkSession() {
    const savedUser = localStorage.getItem('purify_session');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        loginScreen.style.display = 'none';
        mainApp.style.display = 'block';
        
        activeUserLabel.innerText = `${currentUser.username} (${currentUser.role})`;
        
        const userRole = currentUser.role.toLowerCase(); 
        const menuAddService = document.getElementById('menuAddService');
        if (menuAddService) menuAddService.style.display = userRole === 'owner' ? 'flex' : 'none';
        
        const greeting = document.getElementById('welcomeGreeting');
        if (greeting) greeting.innerText = `Halo, ${currentUser.username} 👋`;

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
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, 
        body: JSON.stringify({ action: "login", username: u, pin: p })
    }).then(res => res.json()).then(data => {
        if (data.status === "success") {
            localStorage.setItem('purify_session', JSON.stringify({ username: u, role: data.role }));
            document.getElementById('loginUsername').value = ''; document.getElementById('loginPin').value = '';
            checkSession();
        } else msg.innerText = "Username atau PIN salah!";
    }).catch(() => msg.innerText = "Gagal terhubung.").finally(() => {
        btn.innerText = "Masuk Aplikasi"; btn.disabled = false;
    });
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    if(confirm("Keluar dari aplikasi?")) { localStorage.removeItem('purify_session'); currentUser = null; cart = []; checkSession(); }
});

// --- SISTEM PERPINDAHAN HALAMAN ---
window.switchView = function(viewId) {
    const views = ['dashboardView', 'posView', 'cashOutView', 'historyView'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });
    const targetView = document.getElementById(viewId);
    if(targetView) targetView.style.display = 'block';

    if (viewId === 'historyView') renderHistory();
    if (viewId === 'posView') renderCart(); // Tampilkan keranjang kosong saat buka kasir
};

window.openAddProductModal = function() {
    document.getElementById('newProductName').value = ''; 
    document.getElementById('newProductPrice').value = '';
    document.getElementById('addProductModal').style.display = 'flex';
};

// --- KATALOG & DATA PELANGGAN ---
function loadCatalogFromCloud() {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = '<p style="text-align:center; grid-column:1/-1; color:gray; font-size:13px; margin-top:20px;">Memuat data dari sistem...</p>';
    
    // Trik Cerdas: Tambahkan waktu saat ini ke URL agar HP tidak menggunakan Cache (memori lama)
    const urlAntiNyangkut = GOOGLE_SCRIPT_URL + "?t=" + new Date().getTime();
    
    fetch(urlAntiNyangkut)
        .then(res => res.json())
        .then(data => { 
            products = data.catalog || []; 
            customers = data.customers || []; 
            transactions = data.transactions || []; 
            
            renderProducts(); 
            populateCustomerList(); 
        })
        .catch((err) => {
            grid.innerHTML = `<p style="text-align:center; grid-column:1/-1; color:red; font-size:13px; margin-top:20px;">Gagal memuat. Periksa internet Anda.</p>`;
        });
}

function renderProducts() {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = '';
    
    // Antisipasi huruf besar/kecil (Kiloan = kiloan)
    const currentCat = activeCategory.toLowerCase();
    const filteredProducts = products.filter(p => {
        const pCat = (p.category || 'Kiloan').toLowerCase();
        return pCat === currentCat;
    });
    
    // Jika benar-benar kosong
    if(filteredProducts.length === 0) {
        grid.innerHTML = `<p style="text-align:center; grid-column:1/-1; color:gray; font-size:13px; margin-top:20px;">Belum ada layanan di kategori ini.</p>`;
        return;
    }
    
    // Keamanan cek role Owner
    const isOwner = currentUser && currentUser.role && currentUser.role.toLowerCase() === 'owner';
    
    filteredProducts.forEach((product) => {
        const card = document.createElement('div');
        card.classList.add('product-card');
        
        // Kita kunci desainnya dari JavaScript agar anti-berantakan
        card.style.cssText = "border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; background: #fff; cursor: pointer; position: relative; box-shadow: 0 2px 5px rgba(0,0,0,0.02);";
        
        card.innerHTML = `
            ${isOwner ? `<button class="delete-product-btn" onclick="deleteProduct(${product.id}, event)" style="position:absolute; top:8px; right:8px; background:#fee2e2; color:#991b1b; border:none; border-radius:4px; padding:2px 6px; font-size:12px; cursor:pointer;">✕</button>` : ''}
            <h4 style="margin: 0 0 5px 0; font-size: 13px; color: #0f172a; padding-right: 20px;">${product.name}</h4>
            <p style="margin: 0; font-size: 13px; font-weight: 700; color: #007770;">Rp ${Number(product.price).toLocaleString('id-ID')}</p>
        `;
        
        card.addEventListener('click', () => addToCart(product));
        grid.appendChild(card);
    });
}

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
    typedName = typedName.trim().toLowerCase();
    if (!typedName) return;
    const foundCustomer = customers.find(c => c.name && c.name.toLowerCase() === typedName);
    const waInput = document.getElementById('customerWA');
    if (foundCustomer) {
        waInput.value = foundCustomer.wa;
        waInput.style.borderColor = 'var(--primary)'; waInput.style.backgroundColor = '#e0f2f1';
        setTimeout(() => { waInput.style.borderColor = 'var(--border-color)'; waInput.style.backgroundColor = '#f8fafc'; }, 1000);
    }
}

document.getElementById('customerWA').addEventListener('input', (e) => {
    const typedWA = e.target.value;
    const foundCustomer = customers.find(c => c.wa === typedWA);
    if (foundCustomer) {
        const nameInput = document.getElementById('customerName');
        nameInput.value = foundCustomer.name;
        nameInput.style.borderColor = 'var(--primary)'; nameInput.style.backgroundColor = '#e0f2f1';
        setTimeout(() => { nameInput.style.borderColor = 'var(--border-color)'; nameInput.style.backgroundColor = '#f8fafc'; }, 1000);
    }
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        activeCategory = e.target.getAttribute('data-category');
        renderProducts();
    });
});

function renderProducts() {
    productGrid.innerHTML = '';
    const filteredProducts = products.filter(p => (p.category || 'Kiloan') === activeCategory);
    if(filteredProducts.length === 0) {
        productGrid.innerHTML = `<p style="text-align:center; grid-column:1/-1; color:gray; font-size:13px; margin-top:20px;">Belum ada layanan.</p>`;
        return;
    }
    const isOwner = currentUser && currentUser.role.toLowerCase() === 'owner';
    filteredProducts.forEach((product) => {
        const card = document.createElement('div');
        card.classList.add('product-card');
        card.innerHTML = `
            ${isOwner ? `<button class="delete-product-btn" onclick="deleteProduct(${product.id}, event)">✕</button>` : ''}
            <h4>${product.name}</h4>
            <p>Rp ${product.price.toLocaleString('id-ID')}</p>
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
    let total = 0;
    cartItemsContainer.innerHTML = '';

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `<p style="text-align:center; color:gray; font-size:13px; margin:15px 0; font-style:italic;">Belum ada layanan yang dipilih. Klik layanan di atas.</p>`;
    } else {
        cart.forEach((item, index) => {
            let subtotal = item.price * item.quantity;
            total += subtotal;
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
                    <button class="btn-remove" data-index="${index}" style="background:#fee2e2; color:#991b1b; border:none; border-radius:6px; padding:4px 8px; font-weight:bold; font-size:14px;">✕</button>
                </div>
            `;
            cartItemsContainer.appendChild(itemRow);
        });

        document.querySelectorAll('.qty-input').forEach(inp => {
            inp.addEventListener('change', (e) => {
                let newQty = parseFloat(e.target.value); if (newQty <= 0 || isNaN(newQty)) newQty = 1;
                cart[e.target.getAttribute('data-index')].quantity = newQty; renderCart(); 
            });
        });
        document.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', (e) => { cart.splice(e.target.getAttribute('data-index'), 1); renderCart(); });
        });
    }
    document.getElementById('totalPrice').innerText = `Rp ${total.toLocaleString('id-ID')}`;
    calculateChange(total);
}

function calculateChange(totalPrice) {
    const cash = parseFloat(document.getElementById('cashGiven').value) || 0;
    const change = cash - totalPrice;
    const el = document.getElementById('changeAmount');
    if (change >= 0) { el.innerText = `Rp ${change.toLocaleString('id-ID')}`; el.style.color = 'var(--primary)'; } 
    else { el.innerText = `Kurang Rp ${Math.abs(change).toLocaleString('id-ID')}`; el.style.color = 'var(--danger)'; }
}
document.getElementById('cashGiven').addEventListener('input', () => { calculateChange(cart.reduce((s, i) => s + (i.price * i.quantity), 0)); });

document.getElementById('paymentStatus').addEventListener('change', (e) => {
    const status = e.target.value;
    const cashInput = document.getElementById('cashGiven');
    if (status === 'Belum Lunas') {
        cashInput.value = '0'; cashInput.disabled = true; cashInput.style.background = '#e2e8f0';
    } else {
        cashInput.disabled = false; cashInput.style.background = '#f8fafc';
    }
    calculateChange(cart.reduce((s, i) => s + (i.price * i.quantity), 0));
});

// --- TRANSAKSI & INVOICE ---
function generateInvoiceNumber() {
    const date = new Date();
    const yy = String(date.getFullYear()).slice(-2); 
    const mm = String(date.getMonth() + 1).padStart(2, '0'); 
    const dd = String(date.getDate()).padStart(2, '0'); 
    const randomNum = Math.floor(1000 + Math.random() * 9000); 
    return `INV-${yy}${mm}${dd}-${randomNum}`;
}

function sendWhatsAppReceipt(invoice, wa, name, cartData, total, status) {
    let formattedWA = String(wa).replace(/\D/g, ''); 
    if (formattedWA.startsWith('0')) formattedWA = '62' + formattedWA.substring(1);
    else if (formattedWA.startsWith('8')) formattedWA = '62' + formattedWA; 

    let msg = `*PURIFY LAUNDRY*\n--------------------------------------\n`;
    msg += `*No. Nota:* ${invoice}\n*Pelanggan:* ${name || 'Umum'}\n*Status:* ${status}\n`;
    msg += `--------------------------------------\n*Rincian Pesanan:*\n`;
    cartData.forEach(item => { msg += `- ${item.name} (${item.quantity}x) : Rp ${(item.price * item.quantity).toLocaleString('id-ID')}\n`; });
    msg += `--------------------------------------\n*TOTAL TAGIHAN: Rp ${total.toLocaleString('id-ID')}*\n--------------------------------------\n`;
    msg += `Terima kasih telah mempercayakan cucian Anda di tempat kami! 🙏`;
    window.open(`https://wa.me/${formattedWA}?text=${encodeURIComponent(msg)}`, '_blank');
}

checkoutBtn.addEventListener('click', () => {
    if (cart.length === 0) { alert("Pilih minimal 1 layanan terlebih dahulu!"); return; }
    
    let total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    const paymentStatus = document.getElementById('paymentStatus').value;
    let cash = parseFloat(document.getElementById('cashGiven').value) || 0;

    if (paymentStatus === 'Lunas' && cash < total) { alert("Uang pembayaran kurang untuk status Lunas!"); return; }
    if (paymentStatus === 'Belum Lunas') cash = 0;

    const invoiceNumber = generateInvoiceNumber();
    let itemDetails = cart.map(item => `${item.name} (${item.quantity}x)`).join(", ");
    const custName = document.getElementById('customerName').value;
    const custWA = document.getElementById('customerWA').value;
    
    let transactionData = {
        action: "transaction", invoice: invoiceNumber, items: itemDetails, total: total, cash: cash, 
        change: paymentStatus === 'Lunas' ? (cash - total) : 0, customerName: custName, customerWA: custWA, paymentStatus: paymentStatus 
    };

    checkoutBtn.innerText = "Memproses..."; checkoutBtn.disabled = true;
    
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(transactionData) })
    .then(() => {
        if (custWA && custWA.length >= 9) {
            sendWhatsAppReceipt(invoiceNumber, custWA, custName, cart, total, paymentStatus);
        } else {
            alert(`Transaksi Berhasil!\nNo: ${invoiceNumber}\nStatus: ${paymentStatus}`);
        }
        
        // Reset Formulir dan kembali ke Dashboard
        cart = []; 
        document.getElementById('cashGiven').value = ''; document.getElementById('cashGiven').disabled = false; 
        document.getElementById('paymentStatus').value = 'Lunas'; 
        document.getElementById('customerName').value = ''; document.getElementById('customerWA').value = '';
        renderCart(); 
        loadCatalogFromCloud(); 
        switchView('dashboardView');
    })
    .catch(() => alert("Koneksi gagal."))
    .finally(() => { checkoutBtn.innerText = "Selesaikan Transaksi"; checkoutBtn.disabled = false; });
});

// --- RIWAYAT TRANSAKSI ---
document.getElementById('refreshHistoryBtn').addEventListener('click', () => {
    loadCatalogFromCloud(); alert("Data riwayat diperbarui!");
});

window.resendWA = function(invoice, wa, name, itemsStr, total, status) {
    let formattedWA = String(wa).replace(/\D/g, ''); 
    if (formattedWA.startsWith('0')) formattedWA = '62' + formattedWA.substring(1);
    else if (formattedWA.startsWith('8')) formattedWA = '62' + formattedWA; 
    let formattedItems = itemsStr.split(', ').join('\n- ');
    let msg = `*PURIFY LAUNDRY*\n--------------------------------------\n*No. Nota:* ${invoice}\n*Pelanggan:* ${name || 'Umum'}\n*Status:* ${status}\n--------------------------------------\n*Rincian Pesanan:*\n- ${formattedItems}\n--------------------------------------\n*TOTAL TAGIHAN: Rp ${Number(total).toLocaleString('id-ID')}*\n--------------------------------------\nTerima kasih telah mempercayakan cucian Anda di tempat kami! 🙏`;
    window.open(`https://wa.me/${formattedWA}?text=${encodeURIComponent(msg)}`, '_blank');
};

function renderHistory() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;
    historyList.innerHTML = '';
    if (transactions.length === 0) {
        historyList.innerHTML = `<p style="text-align:center; color:gray; font-size:13px; margin-top:30px;">Belum ada riwayat transaksi.</p>`;
        return;
    }
    transactions.forEach(trx => {
        const card = document.createElement('div');
        card.classList.add('history-card');
        let formattedDate = trx.date;
        try { const d = new Date(trx.date); formattedDate = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; } catch(e) {}
        const isLunas = trx.status === 'Lunas';
        const hasWA = trx.wa && String(trx.wa).length > 8;
        card.innerHTML = `
            <div class="hc-top"><span class="hc-inv">${trx.invoice || 'INV-XXXX'}</span><span class="hc-date">${formattedDate}</span></div>
            <div class="hc-middle">${trx.items}</div>
            <div class="hc-bottom">
                <div><span class="hc-cust">👤 ${trx.name || 'Umum'} (${trx.wa || '-'})</span><br><span class="badge ${isLunas ? 'lunas' : 'belum'}">${trx.status}</span></div>
                <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                    <div class="hc-total">Rp ${Number(trx.total).toLocaleString('id-ID')}</div>
                    
                    <div style="display: flex; gap: 5px;">
                        <!-- Tombol Cetak Bluetooth -->
                        <button class="btn-print" onclick="printThermalReceipt('${trx.invoice}', '${trx.name}', '${trx.items}', ${trx.total}, ${trx.cash || 0}, ${trx.change || 0}, '${trx.status}')" style="background:#0f766e; color:white; border:none; padding:6px 10px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">🖨️ Cetak</button>
                        
                        <!-- Tombol WA -->
                        ${hasWA ? `<button class="btn-wa" onclick="resendWA('${trx.invoice}', '${trx.wa}', '${trx.name}', '${trx.items}', ${trx.total}, '${trx.status}')">WA</button>` : ''}
                    </div>
                </div>
            </div>`;
        historyList.appendChild(card);
    });
}

// --- PENCATATAN KAS KELUAR ---
const cashOutModal = document.getElementById('cashOutModal');
const openCashOutBtn = document.getElementById('openCashOutModal');
if(openCashOutBtn) {
    openCashOutBtn.addEventListener('click', () => {
        document.getElementById('coDescription').value = ''; document.getElementById('coAmount').value = '';
        cashOutModal.style.display = 'flex';
    });
}
const cancelCoBtn = document.getElementById('cancelCoBtn');
if(cancelCoBtn) cancelCoBtn.addEventListener('click', () => { cashOutModal.style.display = 'none'; });

const saveCoBtn = document.getElementById('saveCoBtn');
if(saveCoBtn) {
    saveCoBtn.addEventListener('click', () => {
        const description = document.getElementById('coDescription').value.trim();
        const amount = parseFloat(document.getElementById('coAmount').value);
        if (!description || isNaN(amount) || amount <= 0) { alert("Masukkan keterangan dan nominal valid!"); return; }
        
        const coData = { action: "cash_out", date: new Date().toISOString(), description: description, amount: amount, user: currentUser ? currentUser.username : 'Unknown' };
        
        saveCoBtn.innerText = "Menyimpan..."; saveCoBtn.disabled = true;
        fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(coData) })
        .then(() => { alert("Kas keluar berhasil dicatat!"); cashOutModal.style.display = 'none'; })
        .catch(() => alert("Gagal menyimpan data."))
        .finally(() => { saveCoBtn.innerText = "Simpan Pengeluaran"; saveCoBtn.disabled = false; });
    });
}

// --- MODAL TAMBAH PRODUK ---
document.getElementById('cancelAddBtn').addEventListener('click', () => document.getElementById('addProductModal').style.display = 'none');
document.getElementById('saveProductBtn').addEventListener('click', () => {
    const name = document.getElementById('newProductName').value.trim();
    const price = parseInt(document.getElementById('newProductPrice').value);
    const category = document.getElementById('newProductCategory').value;
    if (!name || isNaN(price) || price <= 0) { alert("Isi data dengan benar!"); return; }
    const newP = { id: Date.now(), name, price, category };
    products.push(newP); renderProducts(); document.getElementById('addProductModal').style.display = 'none';
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: "add_product", product: newP }) });
});

// --- FUNGSI CETAK NOTA KE PRINTER THERMAL BLUETOOTH ---
window.printThermalReceipt = async function(invoice, name, itemsStr, total, cash, change, status) {
    try {
        // 1. Minta browser mencari perangkat Bluetooth (Printer Thermal)
        // Menggunakan filter umum untuk printer thermal BLE / SPP
        const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455', '0000ff00-0000-1000-8000-00805f9b34fb']
        });

        if (!device) {
            alert("Tidak ada printer yang dipilih.");
            return;
        }

        // 2. Hubungkan ke Server GATT Printer
        const server = await device.gatt.connect();
        
        // Cari service utama printer (biasanya menggunakan UUID generik printer thermal)
        const services = await server.getPrimaryServices();
        let targetCharacteristic = null;

        for (const service of services) {
            const characteristics = await service.getCharacteristics();
            for (const characteristic of characteristics) {
                if (characteristic.properties.write || characteristic.properties.writeWithoutResponse) {
                    targetCharacteristic = characteristic;
                    break;
                }
            }
            if (targetCharacteristic) break;
        }

        if (!targetCharacteristic) {
            alert("Gagal menemukan jalur data printer. Pastikan printer kompatibel.");
            return;
        }

        // 3. Format Teks Nota (Perintah ESC/POS Sederhana)
        // \x1b\x40 = Initialize, \x1b\x61\x01 = Center, \x1b\x61\x00 = Left, \n = Baris baru
        let encoder = new TextEncoder();
        let commands = [];

        commands.push(new Uint8Array([0x1B, 0x40])); // Reset printer
        
        // Header (Center)
        commands.push(encoder.encode("\x1b\x61\x01")); // Center align
        commands.push(encoder.encode("PURIFY LAUNDRY\n"));
        commands.push(encoder.encode("--------------------------------\n"));
        
        // Info Nota (Left)
        commands.push(encoder.encode("\x1b\x61\x00")); // Left align
        commands.push(encoder.encode(`No Nota  : ${invoice}\n`));
        commands.push(encoder.encode(`Tanggal  : ${new Date().toLocaleString('id-ID')}\n`));
        commands.push(encoder.encode(`Pelanggan: ${name || 'Umum'}\n`));
        commands.push(encoder.encode(`Status   : ${status}\n`));
        commands.push(encoder.encode("--------------------------------\n"));
        
        // Rincian Item
        commands.push(encoder.encode("RINCIAN PESANAN:\n"));
        let itemsArray = itemsStr.split(', ');
        itemsArray.forEach(item => {
            commands.push(encoder.encode(`- ${item}\n`));
        });
        
        commands.push(encoder.encode("--------------------------------\n"));
        
        // Total & Pembayaran (Right/Left)
        commands.push(encoder.encode(`TOTAL    : Rp ${Number(total).toLocaleString('id-ID')}\n`));
        if (status === 'Lunas') {
            commands.push(encoder.encode(`Bayar    : Rp ${Number(cash).toLocaleString('id-ID')}\n`));
            commands.push(encoder.encode(`Kembali  : Rp ${Number(change).toLocaleString('id-ID')}\n`));
        }
        commands.push(encoder.encode("--------------------------------\n"));
        
        // Footer (Center)
        commands.push(encoder.encode("\x1b\x61\x01")); // Center align
        commands.push(encoder.encode("Terima Kasih Atas\nKepercayaan Anda!\n\n\n"));
        
        // Perintah potong kertas / feed (jika didukung printer)
        commands.push(new Uint8Array([0x1D, 0x56, 0x42, 0x00])); 

        // 4. Kirim data byte ke printer secara bertahap
        for (let cmd of commands) {
            await targetCharacteristic.writeValue(cmd);
        }

        alert("Nota berhasil dicetak!");
        server.disconnect();

    } catch (error) {
        console.error(error);
        alert("Pencetakan gagal atau koneksi Bluetooth dibatalkan: " + error.message);
    }
};

checkSession();