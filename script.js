// GANTI DENGAN URL GOOGLE APPS SCRIPT MILIK ANDA
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxCYJnSNPD8psGmq7vb3e2nDMOi9FP69REPjPscNbbvnNpl8rjQbEt1MYYrmQ-fhLhz/exec';

let products = [];
let cart = [];

// Elemen DOM
const productGrid = document.getElementById('productGrid');
const cartItemsContainer = document.getElementById('cartItems');
const totalPriceElement = document.getElementById('totalPrice');
const cashGivenInput = document.getElementById('cashGiven');
const changeAmountElement = document.getElementById('changeAmount');
const checkoutBtn = document.getElementById('checkoutBtn');
const customerNameInput = document.getElementById('customerName');
const customerWAInput = document.getElementById('customerWA');
const addServiceBtn = document.getElementById('addServiceBtn');

// 1. AMBIL KATALOG DARI GOOGLE DRIVE SAAT APLIKASI DIBUKA
function loadCatalogFromCloud() {
    productGrid.innerHTML = '<p style="text-align:center; width:100%; color:gray;">Sedang memuat layanan dari Google Drive...</p>';
    
    fetch(GOOGLE_SCRIPT_URL)
        .then(response => response.json())
        .then(data => {
            products = data;
            renderProducts();
        })
        .catch(error => {
            console.error('Error memuat katalog:', error);
            productGrid.innerHTML = '<p style="text-align:center; width:100%; color:red;">Gagal memuat layanan. Cek koneksi internet.</p>';
        });
}

// 2. TAMPILKAN PRODUK KE LAYAR
function renderProducts() {
    productGrid.innerHTML = '';
    
    if(products.length === 0) {
        productGrid.innerHTML = '<p style="text-align:center; width:100%; color:gray;">Belum ada layanan. Silakan tambah layanan baru.</p>';
        return;
    }

    products.forEach((product) => {
        const card = document.createElement('div');
        card.classList.add('product-card');
        
        card.innerHTML = `
            <button class="delete-product-btn" onclick="deleteProduct(${product.id}, event)">X</button>
            <h4>${product.name}</h4>
            <p>Rp ${product.price.toLocaleString('id-ID')}</p>
        `;
        card.addEventListener('click', () => addToCart(product));
        productGrid.appendChild(card);
    });
}

// 3. TAMBAH LAYANAN BARU KE GOOGLE DRIVE
addServiceBtn.addEventListener('click', () => {
    const name = prompt("Masukkan Nama Layanan Baru\n(Contoh: Cuci Boneka Besar):");
    if (!name) return; 
    
    const priceStr = prompt(`Masukkan Harga untuk "${name}"\n(Angka saja tanpa titik, misal: 15000):`);
    if (!priceStr) return;
    
    const price = parseInt(priceStr);
    if (isNaN(price) || price <= 0) {
        alert("Harga tidak valid!"); return;
    }

    const newProduct = { id: Date.now(), name: name, price: price };
    
    // Langsung muncul di HP agar cepat
    products.push(newProduct);
    renderProducts();

    // Kirim ke Google Drive di latar belakang
    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "add_product", product: newProduct })
    });
});

// 4. HAPUS LAYANAN DARI GOOGLE DRIVE
function deleteProduct(id, event) {
    event.stopPropagation(); 
    if(confirm("Apakah Anda yakin ingin menghapus layanan ini dari katalog?")) {
        // Langsung hapus dari layar
        products = products.filter(p => p.id !== id);
        renderProducts();

        // Kirim perintah hapus ke Google Drive
        fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: "delete_product", productId: id })
        });
    }
}

// 5. TAMBAH PRODUK KE KERANJANG
function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    renderCart();
}

// 6. RENDER KERANJANG BELANJA
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

// 7. HITUNG KEMBALIAN
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

// 8. SELESAIKAN TRANSAKSI
checkoutBtn.addEventListener('click', () => {
    if (cart.length === 0) { alert("Keranjang kosong!"); return; }
    
    let total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let cash = parseFloat(cashGivenInput.value) || 0;

    if (cash < total) { alert("Uang tunai kurang!"); return; }

    let itemDetails = cart.map(item => `${item.name} (${item.quantity}x)`).join(", ");
    let transactionData = {
        action: "transaction", // Memberi tahu server bahwa ini adalah transaksi
        items: itemDetails,
        total: total,
        cash: cash,
        change: cash - total,
        customerName: customerNameInput ? customerNameInput.value : '',
        customerWA: customerWAInput ? customerWAInput.value : ''
    };

    checkoutBtn.innerText = "Menyimpan Data...";
    checkoutBtn.disabled = true;

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
    .catch(error => alert("Gagal koneksi."))
    .finally(() => {
        checkoutBtn.innerText = "Selesaikan Transaksi";
        checkoutBtn.disabled = false;
    });
});

// MULAI APLIKASI: Tarik data dari Google Drive
loadCatalogFromCloud();