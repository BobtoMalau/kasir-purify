// GANTI DENGAN URL GOOGLE APPS SCRIPT MILIK ANDA
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxCYJnSNPD8psGmq7vb3e2nDMOi9FP69REPjPscNbbvnNpl8rjQbEt1MYYrmQ-fhLhz/exec';

let products = [];
let cart = [];
let activeCategory = 'Kiloan'; // Kategori yang aktif saat pertama dibuka

// Elemen DOM Aplikasi Utama
const productGrid = document.getElementById('productGrid');
const cartItemsContainer = document.getElementById('cartItems');
const totalPriceElement = document.getElementById('totalPrice');
const cashGivenInput = document.getElementById('cashGiven');
const changeAmountElement = document.getElementById('changeAmount');
const checkoutBtn = document.getElementById('checkoutBtn');
const customerNameInput = document.getElementById('customerName');
const customerWAInput = document.getElementById('customerWA');
const addServiceBtn = document.getElementById('addServiceBtn');

// Elemen DOM Layar Login
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');
const loginUsername = document.getElementById('loginUsername');
const loginPin = document.getElementById('loginPin');
const loginBtn = document.getElementById('loginBtn');
const loginMessage = document.getElementById('loginMessage');
const activeUserLabel = document.getElementById('activeUserLabel');
const logoutBtn = document.getElementById('logoutBtn');

// --- SISTEM LOGIN & SESI ---

// 1. Cek apakah sebelumnya sudah login
function checkSession() {
    const savedUser = localStorage.getItem('purify_session');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        loginScreen.style.display = 'none';
        mainApp.style.display = 'flex';
        
        // Tampilkan nama dan role di pojok kanan atas
        activeUserLabel.innerText = `${currentUser.username} (${currentUser.role})`;
        
        // Atur izin (Role)
        applyRoleRestrictions();
        
        // Mulai tarik data dari Google Drive
        loadCatalogFromCloud();
    } else {
        loginScreen.style.display = 'flex';
        mainApp.style.display = 'none';
    }
}

// 2. Terapkan Izin (Owner vs Kasir)
function applyRoleRestrictions() {
    if (currentUser.role === 'kasir') {
        addServiceBtn.style.display = 'none'; // Sembunyikan tombol tambah layanan
    } else {
        addServiceBtn.style.display = 'inline-block'; // Owner bisa melihatnya
    }
}

// 3. Proses Login saat tombol Masuk diklik
loginBtn.addEventListener('click', () => {
    const u = loginUsername.value.trim();
    const p = loginPin.value.trim();
    
    if (!u || !p) {
        loginMessage.innerText = "Isi Username dan PIN!";
        return;
    }
    
    loginBtn.innerText = "Memeriksa...";
    loginBtn.disabled = true;
    loginMessage.innerText = "";
    
    // Perhatikan: Kita MENGHAPUS "mode: 'no-cors'" dan menggunakan 'text/plain' 
    // agar kita bisa membaca balasan JSON dari Google (Sukses/Gagal).
    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, 
        body: JSON.stringify({ action: "login", username: u, pin: p })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === "success") {
            // Simpan sesi ke memori HP
            localStorage.setItem('purify_session', JSON.stringify({
                username: u,
                role: data.role // 'owner' atau 'kasir'
            }));
            loginUsername.value = '';
            loginPin.value = '';
            checkSession(); // Masuk ke aplikasi utama
        } else {
            loginMessage.innerText = "Username atau PIN salah!";
        }
    })
    .catch(error => {
        loginMessage.innerText = "Gagal terhubung. Cek internet!";
        console.error(error);
    })
    .finally(() => {
        loginBtn.innerText = "Masuk Sekarang";
        loginBtn.disabled = false;
    });
});

// 4. Tombol Logout (Keluar)
logoutBtn.addEventListener('click', () => {
    if(confirm("Apakah Anda yakin ingin keluar?")) {
        localStorage.removeItem('purify_session');
        currentUser = null;
        cart = []; // Kosongkan keranjang
        checkSession();
    }
});


// --- SISTEM APLIKASI UTAMA (Katalog & Transaksi) ---

function loadCatalogFromCloud() {
    productGrid.innerHTML = '<p style="text-align:center; width:100%; color:gray; font-size:14px;">Memuat layanan dari sistem...</p>';
    
    fetch(GOOGLE_SCRIPT_URL)
        .then(response => response.json())
        .then(data => {
            products = data;
            renderProducts();
        })
        .catch(error => {
            productGrid.innerHTML = '<p style="text-align:center; width:100%; color:#e53e3e; font-size:14px;">Gagal memuat katalog.</p>';
        });
}

function renderProducts() {
    productGrid.innerHTML = '';

    // Menyaring produk berdasarkan Tab yang sedang aktif
    const filteredProducts = products.filter(p => (p.category || 'Kiloan') === activeCategory);

    if(filteredProducts.length === 0) {
        productGrid.innerHTML = `<p style="text-align:center; width:100%; color:gray; font-size:14px; margin-top:20px;">Belum ada layanan di kategori ${activeCategory}.</p>`;
        return;
    }

    const isOwner = currentUser && currentUser.role === 'owner';

    filteredProducts.forEach((product) => {
        const card = document.createElement('div');
        card.classList.add('product-card');

        card.innerHTML = `
            ${isOwner ? `<button class="delete-product-btn" onclick="deleteProduct(${product.id}, event)">X</button>` : ''}
            <h4>${product.name}</h4>
            <p>Rp ${product.price.toLocaleString('id-ID')}</p>
        `;
        card.addEventListener('click', () => addToCart(product));
        productGrid.appendChild(card);
    });
}

// --- LOGIKA TAB KATEGORI ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Hapus warna tombol aktif sebelumnya
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        // Beri warna pada tombol yang diklik
        e.target.classList.add('active');
        // Set kategori aktif dan perbarui layar
        activeCategory = e.target.getAttribute('data-category');
        renderProducts();
    });
});

// --- LOGIKA POP-UP TAMBAH LAYANAN ---
const addProductModal = document.getElementById('addProductModal');
const cancelAddBtn = document.getElementById('cancelAddBtn');
const saveProductBtn = document.getElementById('saveProductBtn');

// Buka Modal
addServiceBtn.addEventListener('click', () => {
    document.getElementById('newProductName').value = '';
    document.getElementById('newProductPrice').value = '';
    addProductModal.style.display = 'flex';
});

// Tutup Modal
cancelAddBtn.addEventListener('click', () => {
    addProductModal.style.display = 'none';
});

// Simpan Data dari Modal
saveProductBtn.addEventListener('click', () => {
    const name = document.getElementById('newProductName').value.trim();
    const priceStr = document.getElementById('newProductPrice').value;
    const category = document.getElementById('newProductCategory').value;

    const price = parseInt(priceStr);
    if (!name || isNaN(price) || price <= 0) { 
        alert("Nama dan Harga harus diisi dengan benar!"); return; 
    }

    const newProduct = { id: Date.now(), name: name, price: price, category: category };
    products.push(newProduct);
    renderProducts();
    addProductModal.style.display = 'none'; // Tutup modal

    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "add_product", product: newProduct })
    });
});

function deleteProduct(id, event) {
    event.stopPropagation(); 
    if(confirm("Yakin hapus layanan ini dari katalog seluruh sistem?")) {
        products = products.filter(p => p.id !== id);
        renderProducts();

        fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: "delete_product", productId: id })
        });
    }
}

function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    renderCart();
}

function renderCart() {
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `<div class="empty-state"><p>Keranjang belanja kosong</p></div>`;
        totalPriceElement.innerText = `Rp 0`;
        calculateChange(0);
        return;
    }

    cartItemsContainer.innerHTML = '';
    let total = 0;

    cart.forEach((item, index) => {
        let subtotal = item.price * item.quantity;
        total += subtotal;

        const itemRow = document.createElement('div');
        itemRow.classList.add('cart-item-row');
        itemRow.innerHTML = `
            <div class="cart-item-info">
                <span style="font-weight: 600; font-size: 14px; color: var(--text-main);">${item.name}</span>
                <div class="cart-item-qty">
                    <input type="number" min="0.1" step="0.1" class="qty-input" data-index="${index}" value="${item.quantity}">
                    <span style="font-size: 13px; color: var(--text-muted);">x Rp ${item.price.toLocaleString('id-ID')} =</span>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
                <span style="font-weight: 700; color: var(--text-main);">Rp ${subtotal.toLocaleString('id-ID')}</span>
                <button class="btn-remove" data-index="${index}">X</button>
            </div>
        `;
        cartItemsContainer.appendChild(itemRow);
    });

    document.querySelectorAll('.qty-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const index = e.target.getAttribute('data-index');
            let newQty = parseFloat(e.target.value);
            if (newQty <= 0 || isNaN(newQty)) newQty = 1;
            cart[index].quantity = newQty;
            renderCart(); 
        });
    });

    document.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = e.target.getAttribute('data-index');
            cart.splice(index, 1);
            renderCart();
        });
    });

    totalPriceElement.innerText = `Rp ${total.toLocaleString('id-ID')}`;
    calculateChange(total);
}

function calculateChange(totalPrice) {
    const cash = parseFloat(cashGivenInput.value) || 0;
    const change = cash - totalPrice;
    if (change >= 0) {
        changeAmountElement.innerText = `Rp ${change.toLocaleString('id-ID')}`;
        changeAmountElement.style.color = 'var(--success)';
    } else {
        changeAmountElement.innerText = `Kurang Rp ${Math.abs(change).toLocaleString('id-ID')}`;
        changeAmountElement.style.color = 'var(--danger)';
    }
}

cashGivenInput.addEventListener('input', () => {
    let total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    calculateChange(total);
});

checkoutBtn.addEventListener('click', () => {
    if (cart.length === 0) { alert("Keranjang kosong!"); return; }
    
    let total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let cash = parseFloat(cashGivenInput.value) || 0;

    if (cash < total) { alert("Uang tunai kurang!"); return; }

    let itemDetails = cart.map(item => `${item.name} (${item.quantity}x)`).join(", ");
    let transactionData = {
        action: "transaction",
        items: itemDetails,
        total: total,
        cash: cash,
        change: cash - total,
        customerName: customerNameInput ? customerNameInput.value : '',
        customerWA: customerWAInput ? customerWAInput.value : ''
    };

    checkoutBtn.innerText = "Menyimpan Data...";
    checkoutBtn.disabled = true;

    // Saat transaksi kita kembalikan mode: 'no-cors' agar tidak terblokir
    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionData)
    })
    .then(() => {
        alert("Transaksi Berhasil!");
        cart = [];
        cashGivenInput.value = '';
        if (customerNameInput) customerNameInput.value = '';
        if (customerWAInput) customerWAInput.value = '';
        renderCart();
    })
    .catch(error => alert("Gagal koneksi internet."))
    .finally(() => {
        checkoutBtn.innerText = "Selesaikan Transaksi";
        checkoutBtn.disabled = false;
    });
});

// JALANKAN SAAT APLIKASI DIBUKA PERTAMA KALI
checkSession();