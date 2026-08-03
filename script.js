// Ganti URL di bawah dengan URL yang Anda salin dari Google Apps Script di Tahap 2
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxCYJnSNPD8psGmq7vb3e2nDMOi9FP69REPjPscNbbvnNpl8rjQbEt1MYYrmQ-fhLhz/exec';
// Data Contoh Produk/Layanan (Bisa disesuaikan nanti)
const products = [
    { id: 1, name: "Cuci Kiloan (Reguler)", price: 7000 },
    { id: 2, name: "Cuci Kiloan (Express)", price: 12000 },
    { id: 3, name: "Cuci Satuan (Selimut)", price: 20000 },
    { id: 4, name: "Cuci Sepatu (Sneakers)", price: 35000 },
    { id: 5, name: "Setrika Saja (Kiloan)", price: 5000 }
];

let cart = [];

// Elemen DOM
const productGrid = document.getElementById('productGrid');
const cartItemsContainer = document.getElementById('cartItems');
const totalPriceElement = document.getElementById('totalPrice');
const cashGivenInput = document.getElementById('cashGiven');
const changeAmountElement = document.getElementById('changeAmount');
const checkoutBtn = document.getElementById('checkoutBtn');

// 1. Tampilkan Produk ke Layar
function renderProducts() {
    productGrid.innerHTML = '';
    products.forEach(product => {
        const card = document.createElement('div');
        card.classList.add('product-card');
        card.innerHTML = `
            <h4>${product.name}</h4>
            <p>Rp ${product.price.toLocaleString('id-ID')}</p>
        `;
        card.addEventListener('click', () => addToCart(product));
        productGrid.appendChild(card);
    });
}

// 2. Tambah Produk ke Keranjang
function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    renderCart();
}

// 3. Render / Perbarui Tampilan Keranjang
function renderCart() {
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `<p class="empty-cart">Keranjang masih kosong</p>`;
        totalPriceElement.innerText = `Rp 0`;
        changeAmountElement.innerText = `Rp 0`;
        return;
    }

    cartItemsContainer.innerHTML = '';
    let total = 0;

    cart.forEach(item => {
        let subtotal = item.price * item.quantity;
        total += subtotal;

        const itemRow = document.createElement('div');
        itemRow.classList.add('cart-item-row');
        itemRow.innerHTML = `
            <span>${item.name} (x${item.quantity})</span>
            <span>Rp ${subtotal.toLocaleString('id-ID')}</span>
        `;
        cartItemsContainer.appendChild(itemRow);
    });

    totalPriceElement.innerText = `Rp ${total.toLocaleString('id-ID')}`;
    calculateChange(total);
}

// 4. Hitung Kembalian Uang
function calculateChange(totalPrice) {
    const cash = parseFloat(cashGivenInput.value) || 0;
    const change = cash - totalPrice;
    
    if (change >= 0) {
        changeAmountElement.innerText = `Rp ${change.toLocaleString('id-ID')}`;
        changeAmountElement.style.color = '#2e7d32';
    } else {
        changeAmountElement.innerText = `Kurang Rp ${Math.abs(change).toLocaleString('id-ID')}`;
        changeAmountElement.style.color = '#c62828';
    }
}

cashGivenInput.addEventListener('input', () => {
    let total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    calculateChange(total);
});

// 5. Tombol Selesaikan Transaksi
checkoutBtn.addEventListener('click', () => {
    if (cart.length === 0) {
        alert("Keranjang masih kosong!");
        return;
    }
    
    let total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let cash = parseFloat(cashGivenInput.value) || 0;

    if (cash < total) {
        alert("Uang tunai pelanggan kurang!");
        return;
    }

    // Merangkai rincian barang untuk dikirim ke Google Drive
    let itemDetails = cart.map(item => `${item.name} (${item.quantity}x)`).join(", ");

    let transactionData = {
        items: itemDetails,
        total: total,
        cash: cash,
        change: cash - total
    };

    // Ubah status tombol saat mengirim data
    checkoutBtn.innerText = "Menyimpan ke Google Drive...";
    checkoutBtn.disabled = true;

    // Mengirim data ke Google Drive / Sheets
    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // Mencegah error CORS di browser
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData)
    })
    .then(() => {
        alert("Transaksi Berhasil & Tersimpan di Google Drive!");
        
        // Reset Keranjang & Form
        cart = [];
        cashGivenInput.value = '';
        renderCart();
    })
    .catch(error => {
        alert("Gagal menyimpan ke Google Drive. Periksa koneksi internet.");
        console.error('Error:', error);
    })
    .finally(() => {
        checkoutBtn.innerText = "Selesaikan Transaksi";
        checkoutBtn.disabled = false;
    });
});

// Jalankan fungsi tampil produk saat halaman dimuat
renderProducts();
// Daftarkan Service Worker untuk PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker berhasil didaftarkan dengan scope: ', registration.scope);
      }, err => {
        console.log('Pendaftaran ServiceWorker gagal: ', err);
      });
  });
}