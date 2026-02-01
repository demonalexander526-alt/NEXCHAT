import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';

// Global State
let currentUser = null;
let currentView = 'upload'; // upload, browse, myads, cart, detail
let cartItems = [];
let allAds = [];
let currentDetailAd = null;
let userUID = null;
let userUsername = null;
let userEmail = null;
let userTokens = 0;

const DURATION_PLANS = {
  '48': { hours: 48, tokens: 100, label: '48 Hours' },
  '72': { hours: 72, tokens: 150, label: '72 Hours' },
  '144': { hours: 144, tokens: 300, label: '144 Hours (6 Days)' },
  '168': { hours: 168, tokens: 350, label: '168 Hours (7 Days)' }
};

// ============= INITIALIZATION =============
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    userUID = user.uid;
    userEmail = user.email || 'No email';

    try {
      const userRef = doc(db, 'users', userUID);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        userUsername = userData.username || 'Unknown User';
        userTokens = userData.tokens || 0;
      } else {
        userUsername = user.displayName || 'Unknown User';
        userTokens = 0;
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      userUsername = user.displayName || 'Unknown User';
      userTokens = 0;
    }

    // Update UI with user info
    const nexUserEl = document.getElementById('nexUsername');
    const userEmailEl = document.getElementById('userEmail');
    const userUIDEl = document.getElementById('userUID');
    if (nexUserEl) nexUserEl.value = userUsername;
    if (userEmailEl) userEmailEl.value = userEmail;
    if (userUIDEl) userUIDEl.value = userUID;

    updateTokenDisplay();
    loadAllAds();
    loadCartFromLocalStorage();
    checkExpiredAds();
    setInterval(checkExpiredAds, 600000); // Check every 10 mins
  } else {
    window.location.href = 'index.html';
  }
});

// ============= UI SETUP =============
document.addEventListener('DOMContentLoaded', () => {
  // Setup listeners for duration plans
  const radioButtons = document.querySelectorAll('input[name="durationPlan"]');
  radioButtons.forEach(radio => radio.addEventListener('change', updateTokenDisplay));

  // Nav buttons
  document.getElementById('backBtn')?.addEventListener('click', () => { window.location.href = 'chat.html'; });
  document.getElementById('cartBtn')?.addEventListener('click', () => showView('cart'));
  document.getElementById('myAdsBtn')?.addEventListener('click', () => showView('myads'));
  document.getElementById('searchBtn')?.addEventListener('click', () => showView('browse'));
  document.getElementById('createNewAdBtn')?.addEventListener('click', () => {
    showView('upload');
    document.getElementById('adForm')?.reset();
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('imageUploadArea').style.display = 'flex';
    updateTokenDisplay();
  });
  document.getElementById('continueShopping')?.addEventListener('click', () => showView('browse'));
  document.getElementById('backFromDetailBtn')?.addEventListener('click', () => showView('browse'));

  // Checkout button handling
  document.getElementById('checkoutBtn')?.addEventListener('click', () => {
    if (cartItems.length > 0) {
      // For checkout, we'll start a chat with the seller of the first item
      const item = cartItems[0];
      sessionStorage.setItem('targetUserUID', item.sellerUID);
      sessionStorage.setItem('targetUsername', item.sellerUsername);
      sessionStorage.setItem('productName', item.productName);
      sessionStorage.setItem('fromAdvertisement', 'true');

      showNotification('Redirecting to checkout chat...', 'success');
      setTimeout(() => {
        window.location.href = 'chat.html';
      }, 1000);
    }
  });

  // Image Upload
  document.getElementById('imageUploadArea')?.addEventListener('click', () => document.getElementById('productImage')?.click());
  document.getElementById('productImage')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showNotification('Max file size is 5MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        document.getElementById('previewImg').src = ev.target.result;
        document.getElementById('imagePreview').style.display = 'block';
        document.getElementById('imageUploadArea').style.display = 'none';
      };
      reader.readAsDataURL(file);
    }
  });

  document.getElementById('removeImageBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('productImage').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('imageUploadArea').style.display = 'flex';
  });

  // Search and Filter
  document.getElementById('searchAds')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allAds.filter(ad =>
      ad.productName.toLowerCase().includes(term) ||
      ad.productDescription.toLowerCase().includes(term)
    );
    displayAds(filtered);
  });

  document.getElementById('filterCategory')?.addEventListener('change', (e) => {
    const cat = e.target.value;
    const filtered = cat ? allAds.filter(ad => ad.productCategory === cat) : allAds;
    displayAds(filtered);
  });
});

// ============= FUNCTIONS =============
function updateTokenDisplay() {
  const selectedRadio = document.querySelector('input[name="durationPlan"]:checked');
  if (!selectedRadio) return;
  const plan = DURATION_PLANS[selectedRadio.value];
  const warningEl = document.getElementById('tokenWarning');
  if (!warningEl) return;

  if (userTokens < plan.tokens) {
    warningEl.textContent = `⚠️ Insufficient tokens! Need ${plan.tokens}, have ${userTokens}.`;
    warningEl.className = 'token-warning error';
  } else {
    warningEl.textContent = `✅ Tokens available: ${userTokens} (${plan.tokens} will be used)`;
    warningEl.className = 'token-warning success';
  }
  warningEl.style.display = 'block';
}

function showView(view) {
  currentView = view;
  const views = {
    'upload': 'uploadSection',
    'browse': 'adsListSection',
    'myads': 'myAdsSection',
    'cart': 'cartSection',
    'detail': 'adDetailSection'
  };
  Object.keys(views).forEach(v => {
    const el = document.getElementById(views[v]);
    if (el) el.style.display = (v === view) ? 'block' : 'none';
  });
  if (view === 'browse') displayAds(allAds);
  if (view === 'myads') loadUserAds();
  if (view === 'cart') displayCart();
}

document.getElementById('adForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const imageFile = document.getElementById('productImage').files[0];
  if (!imageFile) { showNotification('Please upload an image', 'error'); return; }

  const selectedRadio = document.querySelector('input[name="durationPlan"]:checked');
  const plan = DURATION_PLANS[selectedRadio.value];

  if (userTokens < plan.tokens) {
    showNotification(`You need ${plan.tokens} tokens.`, 'error');
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  showStatus('Posting advertisement...', 'loading');

  try {
    const storeRef = ref(storage, `advertisements/${userUID}/${Date.now()}_${imageFile.name}`);
    const snap = await uploadBytes(storeRef, imageFile);
    const url = await getDownloadURL(snap.ref);
    const expiresAt = new Date(Date.now() + plan.hours * 60 * 60 * 1000);

    const adData = {
      productName: document.getElementById('productName').value,
      productDescription: document.getElementById('productDescription').value,
      productPrice: parseFloat(document.getElementById('productPrice').value),
      productCategory: document.getElementById('productCategory').value,
      imageURL: url,
      sellerUID: userUID,
      sellerUsername: userUsername,
      sellerEmail: userEmail,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      expiresAt: expiresAt,
      durationHours: plan.hours,
      durationTokens: plan.tokens,
      status: 'active'
    };

    await addDoc(collection(db, 'advertisements'), adData);
    await deductUserTokens(plan.tokens);

    showStatus('Ad posted!', 'success');
    showNotification('Success! Ad is now live.', 'success');
    document.getElementById('adForm').reset();
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('imageUploadArea').style.display = 'flex';

    await loadAllAds();
    setTimeout(() => showView('browse'), 1000);
  } catch (err) {
    console.error(err);
    showStatus('Error: ' + err.message, 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

async function deductUserTokens(amount) {
  const userRef = doc(db, 'users', userUID);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    const current = snap.data().tokens || 0;
    const val = Math.max(0, current - amount);
    await updateDoc(userRef, { tokens: val });
    userTokens = val;
    updateTokenDisplay();
  }
}

async function loadAllAds() {
  try {
    const snap = await getDocs(query(collection(db, 'advertisements'), where('status', '==', 'active')));
    allAds = [];
    const now = new Date();
    snap.forEach(d => {
      const data = d.data();
      const exp = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
      if (exp > now) allAds.push({ id: d.id, ...data });
    });
    allAds.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    if (currentView === 'browse') displayAds(allAds);
  } catch (err) { console.error(err); }
}

async function loadUserAds() {
  if (!userUID) return;
  try {
    const snap = await getDocs(query(collection(db, 'advertisements'), where('sellerUID', '==', userUID)));
    const userAds = [];
    snap.forEach(d => userAds.push({ id: d.id, ...d.data() }));
    displayUserAds(userAds);
  } catch (err) { console.error(err); }
}

function displayAds(ads) {
  const container = document.getElementById('adsList');
  if (!container) return;
  if (ads.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>📭</p><p>No ads found.</p></div>';
    return;
  }
  container.innerHTML = ads.map(ad => {
    const exp = ad.expiresAt?.toDate ? ad.expiresAt.toDate() : new Date(ad.expiresAt);
    const hours = Math.max(0, Math.ceil((exp - new Date()) / 3600000));
    return `
            <div class="ad-card" onclick="viewAdDetail('${ad.id}')">
                <img src="${ad.imageURL}" class="ad-card-image">
                <div class="ad-card-category">${getCategoryEmoji(ad.productCategory)} ${ad.productCategory}</div>
                <div class="ad-card-expiry">⏱️ ${hours}h</div>
                <div class="ad-card-content">
                    <h3 class="ad-card-name">${escapeHtml(ad.productName)}</h3>
                    <p class="ad-card-description">${escapeHtml(ad.productDescription)}</p>
                    <div class="ad-card-price">$${ad.productPrice.toFixed(2)}</div>
                    <div class="ad-card-seller">👤 ${escapeHtml(ad.sellerUsername)}</div>
                    <div class="ad-card-actions">
                        <button class="ad-card-btn cart-btn" onclick="addToCartFromCard(event, '${ad.id}')">🛒 Cart</button>
                        <button class="ad-card-btn" onclick="contactSeller(event, '${ad.id}')">💬 Chat</button>
                    </div>
                </div>
            </div>
        `;
  }).join('');
}

function displayUserAds(ads) {
  const container = document.getElementById('myAdsList');
  if (!container) return;
  if (ads.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>📭</p><p>No ads posted.</p></div>';
    return;
  }
  container.innerHTML = ads.map(ad => {
    const exp = ad.expiresAt?.toDate ? ad.expiresAt.toDate() : new Date(ad.expiresAt);
    const expired = exp <= new Date();
    return `
            <div class="ad-card ${expired ? 'expired' : ''}">
                <img src="${ad.imageURL}" class="ad-card-image">
                <div class="ad-card-category">${getCategoryEmoji(ad.productCategory)} ${ad.productCategory}</div>
                ${expired ? '<div class="ad-card-expired-badge">EXPIRED</div>' : ''}
                <div class="ad-card-content">
                    <h3 class="ad-card-name">${escapeHtml(ad.productName)}</h3>
                    <div class="ad-card-price">$${ad.productPrice.toFixed(2)}</div>
                    <div class="ad-card-actions">
                        <button class="ad-card-btn" onclick="viewAdDetail('${ad.id}')">👁️ View</button>
                        <button class="ad-card-btn delete-btn" style="background:#ff4d4d; color:white;" onclick="deleteAd(event, '${ad.id}')">🗑️ Delete</button>
                    </div>
                </div>
            </div>
        `;
  }).join('');
}

function viewAdDetail(adId) {
  currentDetailAd = allAds.find(ad => ad.id === adId) || null;
  if (!currentDetailAd) return;
  document.getElementById('detailImage').src = currentDetailAd.imageURL;
  document.getElementById('detailName').textContent = currentDetailAd.productName;
  document.getElementById('detailDescription').textContent = currentDetailAd.productDescription;
  document.getElementById('detailPrice').textContent = '$' + currentDetailAd.productPrice.toFixed(2);
  document.getElementById('detailCategory').textContent = currentDetailAd.productCategory;
  document.getElementById('detailCategoryBadge').textContent = getCategoryEmoji(currentDetailAd.productCategory) + ' ' + currentDetailAd.productCategory;
  document.getElementById('detailUsername').textContent = currentDetailAd.sellerUsername;
  document.getElementById('detailEmail').textContent = currentDetailAd.sellerEmail;
  document.getElementById('detailUID').textContent = currentDetailAd.sellerUID;
  showView('detail');
}

function addToCartFromCard(e, adId) {
  e.stopPropagation();
  const ad = allAds.find(a => a.id === adId);
  if (ad) {
    const exist = cartItems.find(i => i.id === ad.id);
    if (exist) exist.quantity++;
    else cartItems.push({ ...ad, quantity: 1 });
    updateCartBadge();
    saveCartToLocalStorage();
    showNotification('Added to cart', 'success');
  }
}

function updateCartBadge() {
  const count = cartItems.reduce((s, i) => s + i.quantity, 0);
  const el = document.getElementById('cartCount');
  if (el) el.textContent = count;
}

function displayCart() {
  const container = document.getElementById('cartItems');
  const summary = document.getElementById('cartSummary');
  if (!container) return;
  if (cartItems.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>🛒</p><p>Cart is empty.</p></div>';
    if (summary) summary.style.display = 'none';
    return;
  }
  container.innerHTML = cartItems.map(item => `
        <div class="cart-item">
            <img src="${item.imageURL}" class="cart-item-image">
            <div class="cart-item-content">
                <div class="cart-item-name">${escapeHtml(item.productName)}</div>
                <div class="cart-item-price">$${item.productPrice.toFixed(2)}</div>
            </div>
            <div class="cart-item-actions">
                <div class="qty-control">
                    <button class="qty-btn" onclick="updateCartItemQuantity('${item.id}', ${item.quantity - 1})">−</button>
                    <span class="qty-input">${item.quantity}</span>
                    <button class="qty-btn" onclick="updateCartItemQuantity('${item.id}', ${item.quantity + 1})">+</button>
                </div>
                <button class="remove-cart-btn" onclick="removeFromCart('${item.id}')">Remove</button>
            </div>
        </div>
    `).join('');
  const sub = cartItems.reduce((s, i) => s + (i.productPrice * i.quantity), 0);
  document.getElementById('subtotal').textContent = '$' + sub.toFixed(2);
  document.getElementById('totalAmount').textContent = '$' + (sub * 1.1).toFixed(2);
  if (summary) summary.style.display = 'block';
}

function updateCartItemQuantity(id, qty) {
  const item = cartItems.find(i => i.id === id);
  if (item) {
    item.quantity = Math.max(1, qty);
    updateCartBadge();
    saveCartToLocalStorage();
    displayCart();
  }
}

function removeFromCart(id) {
  cartItems = cartItems.filter(i => i.id !== id);
  updateCartBadge();
  saveCartToLocalStorage();
  displayCart();
}

async function deleteAd(e, id) {
  e.stopPropagation();
  if (confirm('Delete ad?')) {
    await deleteDoc(doc(db, 'advertisements', id));
    loadUserAds();
    loadAllAds();
  }
}

function contactSeller(e, id) {
  if (e) e.stopPropagation();
  const ad = id ? (allAds.find(a => a.id === id) || currentDetailAd) : currentDetailAd;
  if (ad) {
    sessionStorage.setItem('targetUserUID', ad.sellerUID);
    sessionStorage.setItem('targetUsername', ad.sellerUsername);
    sessionStorage.setItem('productName', ad.productName);
    sessionStorage.setItem('fromAdvertisement', 'true');
    window.location.href = 'chat.html';
  }
}

async function checkExpiredAds() {
  const snap = await getDocs(query(collection(db, 'advertisements'), where('status', '==', 'active')));
  const now = new Date();
  snap.forEach(async d => {
    const data = d.data();
    const exp = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
    if (exp <= now) await deleteDoc(d.ref);
  });
}

function saveCartToLocalStorage() { localStorage.setItem('nexchatCart', JSON.stringify(cartItems)); }
function loadCartFromLocalStorage() {
  const s = localStorage.getItem('nexchatCart');
  if (s) { cartItems = JSON.parse(s); updateCartBadge(); }
}

function getCategoryEmoji(cat) {
  const m = { 'electronics': '🖥️', 'clothing': '👕', 'books': '📚', 'food': '🍔' };
  return m[cat] || '📦';
}

function escapeHtml(t) {
  const m = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return t ? t.replace(/[&<>"']/g, x => m[x]) : '';
}

function showNotification(m, t = 'info') {
  const c = document.getElementById('notificationContainer');
  const n = document.createElement('div');
  n.className = `notification ${t}`;
  n.innerHTML = `<span>${m}</span>`;
  c.appendChild(n);
  setTimeout(() => n.remove(), 3000);
}

function showStatus(m, t = 'info') {
  const el = document.getElementById('uploadStatus');
  if (!el) return;
  el.textContent = m;
  el.className = `status-message ${t}`;
  el.style.display = 'block';
  if (t !== 'loading') setTimeout(() => el.style.display = 'none', 3000);
}

window.addToCartFromCard = addToCartFromCard;
window.contactSeller = contactSeller;
window.viewAdDetail = viewAdDetail;
window.deleteAd = deleteAd;
window.updateCartItemQuantity = updateCartItemQuantity;
window.removeFromCart = removeFromCart;

console.log('✅ Marketplace Initialized');
