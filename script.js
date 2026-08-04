// GANTI DENGAN URL GOOGLE APPS SCRIPT MILIK ANDA
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxCYJnSNPD8psGmq7vb3e2nDMOi9FP69REPjPscNbbvnNpl8rjQbEt1MYYrmQ-fhLhz/exec';

let products = [];
let cart = [];
let customers = []; // Variabel untuk menyimpan data pelanggan
let currentUser = null;
let activeCategory = 'Kiloan';
let transactions = []; // <-- TAMBAHKAN INI DI SINI

// Elemen DOM
const productGrid = document.getElementById('productGrid');
const cartItemsContainer = document.getElementById('cartItems');
const checkoutBtn = document.getElementById('checkoutBtn');
const addServiceBtn = document.getElementById('addServiceBtn');

// Elemen Floating Cart & Bottom Sheet
const floatingCart = document.getElementById('floatingCart');
const fcItemCount = document.getElementById('fcItemCount');
const fcTotal = document.getElementById('fcTotal');
const fcOpenBtn = document.getElementById('fcOpenBtn');
const checkoutOverlay = document.getElementById('checkoutOverlay');
const checkoutSheet = document.getElementById('checkoutSheet');
const closeSheetBtn = document.getElementById('closeSheetBtn');

// Elemen Login
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');
const activeUserLabel = document.getElementById('activeUserLabel');

// --- SISTEM LOGIN ---
function checkSession() {
    const savedUser = localStorage.getItem('purify_session');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        loginScreen.style.display = 'none';
        mainApp.style.display = 'block';
        activeUserLabel.innerText = `${currentUser.username} (${currentUser.role})`;
        
        // PERBAIKAN: Mengubah text role menjadi huruf kecil semua agar tidak error
        const userRole = currentUser.role.toLowerCase(); 
        addServiceBtn.style.display = userRole === 'owner' ? 'block' : 'none';
        
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
    }).catch(() => msg.innerText = "Gagal terhubung. Cek internet!").finally(() => {
        btn.innerText = "Masuk Aplikasi"; btn.disabled = false;
    });
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    if(confirm("Keluar dari aplikasi?")) { localStorage.removeItem('purify_session'); currentUser = null; cart = []; checkSession(); }
});

// --- SISTEM KATALOG ---
function loadCatalogFromCloud() {
    productGrid.innerHTML = '<p style="text-align:center; grid-column:1/-1; color:gray; font-size:13px; margin-top:20px;">Memuat data dari sistem...</p>';

    fetch(GOOGLE_SCRIPT_URL)
        .then(res => res.json())
        .then(data => { 
            products = data.catalog; 
            customers = data.customers || [];
            transactions = data.transactions || []; // <-- Tangkap data transaksi

            renderProducts(); 
            populateCustomerList(); 
            renderHistory(); // <-- Render daftar riwayat
        })
        .catch(() => productGrid.innerHTML = '<p style="text-align:center; grid-column:1/-1; color:red; font-size:13px;">Gagal memuat sistem.</p>');
}

// --- FUNGSI BARU: DAFTAR PELANGGAN & AUTO-FILL BERDASARKAN NAMA ---
function populateCustomerList() {
    const customerList = document.getElementById('customerList');
    if (!customerList) return;
    customerList.innerHTML = ''; // Kosongkan daftar sebelumnya
    
    // Memasukkan Nama pelanggan ke dalam pilihan saran pencarian
    customers.forEach(cust => {
        const option = document.createElement('option');
        option.value = cust.name; // Nilai utama yang diketik adalah Nama
        option.text = `WA: ${cust.wa}`; // Info tambahan di sebelah pilihan
        customerList.appendChild(option);
    });
}

// --- PENCARIAN PELANGGAN YANG LEBIH KUAT ---
document.getElementById('customerName').addEventListener('input', (e) => {
    checkAndFillCustomer(e.target.value);
});

document.getElementById('customerName').addEventListener('change', (e) => {
    checkAndFillCustomer(e.target.value);
});

function checkAndFillCustomer(typedName) {
    typedName = typedName.trim().toLowerCase();
    if (!typedName) return;

    // Cari pelanggan yang namanya cocok (mengabaikan huruf besar/kecil)
    const foundCustomer = customers.find(c => c.name && c.name.toLowerCase() === typedName);
    
    const waInput = document.getElementById('customerWA');
    if (foundCustomer) {
        waInput.value = foundCustomer.wa;
        waInput.style.borderColor = 'var(--primary)';
        waInput.style.backgroundColor = '#e0f2f1';
        setTimeout(() => {
            waInput.style.borderColor = 'var(--border-color)';
            waInput.style.backgroundColor = '#f8fafc';
        }, 1000);
    }
}
// Fitur Ajaib: Saat nomor WA diketik/dipilih, otomatis isi kolom Nama!
document.getElementById('customerWA').addEventListener('input', (e) => {
    const typedWA = e.target.value;
    const foundCustomer = customers.find(c => c.wa === typedWA);
    
    if (foundCustomer) {
        // Jika pelanggan ditemukan, otomatis isi nama dan berikan efek sorotan
        const nameInput = document.getElementById('customerName');
        nameInput.value = foundCustomer.name;
        nameInput.style.borderColor = 'var(--primary)';
        nameInput.style.backgroundColor = '#e0f2f1';
        setTimeout(() => {
            nameInput.style.borderColor = 'var(--border-color)';
            nameInput.style.backgroundColor = '#f8fafc';
        }, 1000);
    }
});

function renderProducts() {
    productGrid.innerHTML = '';
    const filteredProducts = products.filter(p => (p.category || 'Kiloan') === activeCategory);
    if(filteredProducts.length === 0) {
        productGrid.innerHTML = `<p style="text-align:center; grid-column:1/-1; color:gray; font-size:13px; margin-top:20px;">Belum ada layanan di kategori ini.</p>`;
        return;
    }
    
    // PERBAIKAN: Mengecek role dengan mengabaikan huruf besar/kecil
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

function addToCart(product) {
    const existing = cart.find(item => item.id === product.id);
    if (existing) existing.quantity += 1; else cart.push({ ...product, quantity: 1 });
    renderCart();
}

function deleteProduct(id, event) {
    event.stopPropagation(); 
    if(confirm("Hapus layanan ini permanen?")) {
        products = products.filter(p => p.id !== id); renderProducts();
        fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: "delete_product", productId: id }) });
    }
}

// --- SISTEM KERANJANG & CHECKOUT SHEET ---
function renderCart() {
    let total = 0;
    let itemCount = 0;
    cartItemsContainer.innerHTML = '';

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `<p style="text-align:center; color:gray; font-size:13px; margin:20px 0;">Keranjang kosong</p>`;
        floatingCart.style.display = 'none'; 
        closeCheckoutSheet(); 
    } else {
        floatingCart.style.display = 'flex'; 
        cart.forEach((item, index) => {
            let subtotal = item.price * item.quantity;
            total += subtotal; itemCount += item.quantity;
            const itemRow = document.createElement('div');
            itemRow.classList.add('cart-item-row');
            itemRow.innerHTML = `
                <div class="cart-item-info">
                    <span style="color:var(--text-main); display:block; margin-bottom:4px;">${item.name}</span>
                    <div class="cart-item-qty">
                        <input type="number" min="0.1" step="0.1" class="qty-input" data-index="${index}" value="${item.quantity}">
                        <span style="font-size:12px; color:var(--text-muted);">x Rp ${item.price.toLocaleString('id-ID')}</span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight:700; font-size:14px;">Rp ${subtotal.toLocaleString('id-ID')}</span>
                    <button class="btn-remove" data-index="${index}">✕</button>
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

    fcItemCount.innerText = `${itemCount} Item`;
    fcTotal.innerText = `Rp ${total.toLocaleString('id-ID')}`;
    document.getElementById('totalPrice').innerText = `Rp ${total.toLocaleString('id-ID')}`;
    calculateChange(total);
}

function openCheckoutSheet() {
    checkoutOverlay.classList.add('active');
    checkoutSheet.classList.add('active');
}
function closeCheckoutSheet() {
    checkoutOverlay.classList.remove('active');
    checkoutSheet.classList.remove('active');
}
fcOpenBtn.addEventListener('click', openCheckoutSheet);
closeSheetBtn.addEventListener('click', closeCheckoutSheet);
checkoutOverlay.addEventListener('click', closeCheckoutSheet);

function calculateChange(totalPrice) {
    const cash = parseFloat(document.getElementById('cashGiven').value) || 0;
    const change = cash - totalPrice;
    const el = document.getElementById('changeAmount');
    if (change >= 0) { el.innerText = `Rp ${change.toLocaleString('id-ID')}`; el.style.color = 'var(--primary)'; } 
    else { el.innerText = `Kurang Rp ${Math.abs(change).toLocaleString('id-ID')}`; el.style.color = 'var(--danger)'; }
}
document.getElementById('cashGiven').addEventListener('input', () => { calculateChange(cart.reduce((s, i) => s + (i.price * i.quantity), 0)); });

// --- MODAL TAMBAH LAYANAN ---
const addProductModal = document.getElementById('addProductModal');
addServiceBtn.addEventListener('click', () => {
    document.getElementById('newProductName').value = ''; document.getElementById('newProductPrice').value = '';
    addProductModal.style.display = 'flex';
});
document.getElementById('cancelAddBtn').addEventListener('click', () => addProductModal.style.display = 'none');

document.getElementById('saveProductBtn').addEventListener('click', () => {
    const name = document.getElementById('newProductName').value.trim();
    const price = parseInt(document.getElementById('newProductPrice').value);
    const category = document.getElementById('newProductCategory').value;
    if (!name || isNaN(price) || price <= 0) { alert("Isi data dengan benar!"); return; }
    const newP = { id: Date.now(), name, price, category };
    products.push(newP); renderProducts(); addProductModal.style.display = 'none';
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: "add_product", product: newP }) });
});

// --- MESIN PEMBUAT NOMOR INVOICE OTOMATIS ---
function generateInvoiceNumber() {
    const date = new Date();
    const yy = String(date.getFullYear()).slice(-2); // Ambil 2 digit tahun
    const mm = String(date.getMonth() + 1).padStart(2, '0'); // Bulan
    const dd = String(date.getDate()).padStart(2, '0'); // Tanggal
    const randomNum = Math.floor(1000 + Math.random() * 9000); // 4 digit angka acak
    return `INV-${yy}${mm}${dd}-${randomNum}`;
}

// --- SELESAIKAN TRANSAKSI (DIPERBARUI DENGAN INVOICE) ---
checkoutBtn.addEventListener('click', () => {
    if (cart.length === 0) return;
    
    let total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    const paymentStatus = document.getElementById('paymentStatus').value;
    let cash = parseFloat(document.getElementById('cashGiven').value) || 0;

    // Validasi: Jika Lunas, uang tunai tidak boleh kurang dari total
    if (paymentStatus === 'Lunas' && cash < total) { 
        alert("Uang pembayaran kurang untuk status Lunas!"); 
        return; 
    }

    // Jika Belum Lunas, uang tunai diset 0
    if (paymentStatus === 'Belum Lunas') {
        cash = 0;
    }

    const invoiceNumber = generateInvoiceNumber();
    let itemDetails = cart.map(item => `${item.name} (${item.quantity}x)`).join(", ");
    
    let transactionData = {
        action: "transaction", 
        invoice: invoiceNumber, 
        items: itemDetails, 
        total: total, 
        cash: cash, 
        change: paymentStatus === 'Lunas' ? (cash - total) : 0,
        customerName: document.getElementById('customerName').value,
        customerWA: document.getElementById('customerWA').value,
        paymentStatus: paymentStatus // DATA STATUS BARU
    };

    checkoutBtn.innerText = "Memproses..."; 
    checkoutBtn.disabled = true;
    
    fetch(GOOGLE_SCRIPT_URL, { 
        method: 'POST', 
        mode: 'no-cors', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(transactionData) 
    })
    .then(() => {
        alert(`Transaksi Berhasil disimpan!\nNo. Invoice: ${invoiceNumber}\nStatus: ${paymentStatus}`);
        
        // Reset Keranjang & Form
        cart = []; 
        document.getElementById('cashGiven').value = '';
        document.getElementById('cashGiven.disabled') = false;
        document.getElementById('paymentStatus').value = 'Lunas'; // Reset ke Lunas
        document.getElementById('customerName').value = ''; 
        document.getElementById('customerWA').value = '';
        renderCart(); 
        closeCheckoutSheet();
    })
    .catch(() => alert("Koneksi gagal. Periksa internet Anda."))
    .finally(() => { 
        checkoutBtn.innerText = "Selesaikan Transaksi"; 
        checkoutBtn.disabled = false; 
    });
});
// --- ATURAN OTOMATIS STATUS PEMBAYARAN ---
document.getElementById('paymentStatus').addEventListener('change', (e) => {
    const status = e.target.value;
    const cashInput = document.getElementById('cashGiven');
    
    if (status === 'Belum Lunas') {
        cashInput.value = '0';
        cashInput.disabled = true; // Kunci input uang karena bayar nanti
        cashInput.style.background = '#e2e8f0';
    } else {
        cashInput.disabled = false; // Buka kembali jika Lunas
        cashInput.style.background = '#f8fafc';
    }
    let total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    calculateChange(total);
});
// --- LOGIKA PINDAH TAB (KASIR VS RIWAYAT) ---
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-target');

        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        e.currentTarget.classList.add('active');

        if (target === 'pos') {
            document.getElementById('posView').style.display = 'block';
            document.getElementById('historyView').style.display = 'none';
        } else if (target === 'history') {
            document.getElementById('posView').style.display = 'none';
            document.getElementById('historyView').style.display = 'block';
            renderHistory();
        }
    });
});

document.getElementById('refreshHistoryBtn').addEventListener('click', () => {
    loadCatalogFromCloud();
    alert("Data riwayat diperbarui!");
});

// --- RENDER HALAMAN RIWAYAT TRANSAKSI ---
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
        try {
            const d = new Date(trx.date);
            formattedDate = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        } catch(e) {}

        const isLunas = trx.status === 'Lunas';

        card.innerHTML = `
            <div class="hc-top">
                <span class="hc-inv">${trx.invoice || 'INV-XXXX'}</span>
                <span class="hc-date">${formattedDate}</span>
            </div>
            <div class="hc-middle">
                ${trx.items}
            </div>
            <div class="hc-bottom">
                <div>
                    <span class="hc-cust">👤 ${trx.name || 'Umum'} (${trx.wa || '-'})</span><br>
                    <span class="badge ${isLunas ? 'lunas' : 'belum'}">${trx.status}</span>
                </div>
                <div class="hc-total">
                    Rp ${Number(trx.total).toLocaleString('id-ID')}
                </div>
            </div>
        `;
        historyList.appendChild(card);
    });
}
// Pastikan checkSession() tetap ada di baris paling akhir file Anda
checkSession();