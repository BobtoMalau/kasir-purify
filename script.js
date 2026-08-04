// GANTI DENGAN URL GOOGLE APPS SCRIPT MILIK ANDA
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxCYJnSNPD8psGmq7vb3e2nDMOi9FP69REPjPscNbbvnNpl8rjQbEt1MYYrmQ-fhLhz/exec';

let products = [];
let cart = [];
let currentUser = null;
let activeCategory = 'Kiloan';

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
    productGrid.innerHTML = '<p style="text-align:center; grid-column:1/-1; color:gray; font-size:13px; margin-top:20px;">Memuat layanan dari sistem...</p>';
    fetch(GOOGLE_SCRIPT_URL).then(res => res.json()).then(data => { products = data; renderProducts(); })
    .catch(() => productGrid.innerHTML = '<p style="text-align:center; grid-column:1/-1; color:red; font-size:13px;">Gagal memuat katalog.</p>');
}

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

// --- SELESAIKAN TRANSAKSI ---
checkoutBtn.addEventListener('click', () => {
    if (cart.length === 0) return;
    let total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    let cash = parseFloat(document.getElementById('cashGiven').value) || 0;
    if (cash < total) { alert("Uang pembayaran kurang!"); return; }

    let itemDetails = cart.map(item => `${item.name} (${item.quantity}x)`).join(", ");
    let transactionData = {
        action: "transaction", items: itemDetails, total, cash, change: cash - total,
        customerName: document.getElementById('customerName').value,
        customerWA: document.getElementById('customerWA').value
    };

    checkoutBtn.innerText = "Memproses..."; checkoutBtn.disabled = true;
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(transactionData) })
    .then(() => {
        alert("Transaksi Berhasil!");
        cart = []; document.getElementById('cashGiven').value = '';
        document.getElementById('customerName').value = ''; document.getElementById('customerWA').value = '';
        renderCart(); closeCheckoutSheet();
    })
    .catch(() => alert("Koneksi gagal."))
    .finally(() => { checkoutBtn.innerText = "Selesaikan Transaksi"; checkoutBtn.disabled = false; });
});

checkSession();