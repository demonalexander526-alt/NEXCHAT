import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, getDoc } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';

// Configuration and app initialization are handled in firebase-config.js
// We import the initialized services directly.

// Token prices for duration plans
const DURATION_PLANS = {
  '48': { hours: 48, tokens: 100, label: '48 Hours' },
  '72': { hours: 72, tokens: 150, label: '72 Hours' },
  '144': { hours: 144, tokens: 300, label: '144 Hours (6 Days)' },
  '168': { hours: 168, tokens: 350, label: '168 Hours (7 Days)' }
};

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

// ============= INITIALIZATION =============
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    userUID = user.uid;
    userEmail = user.email || 'No email';

    // Get user data from Firestore
    try {
      const userRef = doc(db, 'users', userUID);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        userUsername = userSnap.data().username || 'Unknown User';
        userTokens = userSnap.data().tokens || 0;
      } else {
        userUsername = user.displayName || 'Unknown User';
        userTokens = 0;
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      userUsername = user.displayName || 'Unknown User';
      userTokens = 0;
    }

    // Fill user info in form
    document.getElementById('nexUsername').value = userUsername;
    document.getElementById('userEmail').value = userEmail;
    document.getElementById('userUID').value = userUID;

    // Setup duration plan listeners
    setupDurationPlanListeners();

    // Load ads
    loadAllAds();
    loadCartFromLocalStorage();

    // Check for expired ads periodically
    checkExpiredAds();
    setInterval(checkExpiredAds, 60000); // Check every minute
  } else {
    window.location.href = 'login.html';
  }
});

// ============= DURATION PLAN SETUP =============
function setupDurationPlanListeners() {
  const radioButtons = document.querySelectorAll('input[name="durationPlan"]');
  radioButtons.forEach(radio => {
    radio.addEventListener('change', updateTokenDisplay);
  });

  // Initial display
  updateTokenDisplay();
}

function updateTokenDisplay() {
  const selected = document.querySelector('input[name="durationPlan"]:checked').value;
  const plan = DURATION_PLANS[selected];
  const warningEl = document.getElementById('tokenWarning');

  if (!plan) {
    warningEl.style.display = 'none';
    return;
  }

  if (userTokens < plan.tokens) {
    warningEl.textContent = `⚠️ Insufficient tokens! You need ${plan.tokens} tokens but only have ${userTokens}. You need ${plan.tokens - userTokens} more tokens.`;
    warningEl.className = 'token-warning error';
    warningEl.style.display = 'block';
  } else {
    warningEl.textContent = `✅ You have enough tokens! (${userTokens} available)`;
    warningEl.className = 'token-warning success';
    warningEl.style.display = 'block';
  }
}

// ============= NAVIGATION =============
document.getElementById('backBtn').addEventListener('click', () => {
  window.location.href = 'chat.html';
});

document.getElementById('cartBtn').addEventListener('click', () => {
  showView('cart');
});

document.getElementById('myAdsBtn').addEventListener('click', () => {
  showView('myads');
});

document.getElementById('searchBtn').addEventListener('click', () => {
  showView('browse');
});

document.getElementById('createNewAdBtn')?.addEventListener('click', () => {
  showView('upload');
  document.getElementById('adForm').reset();
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('imageUploadArea').style.display = 'flex';
  document.querySelector('input[name="durationPlan"][value="48"]').checked = true;
  updateTokenDisplay();
});

document.getElementById('continueShopping')?.addEventListener('click', () => {
  showView('browse');
});

function showView(view) {
  currentView = view;
  document.getElementById('uploadSection').style.display = view === 'upload' ? 'block' : 'none';
  document.getElementById('adsListSection').style.display = view === 'browse' ? 'block' : 'none';
  document.getElementById('myAdsSection').style.display = view === 'myads' ? 'block' : 'none';
  document.getElementById('cartSection').style.display = view === 'cart' ? 'block' : 'none';
  document.getElementById('adDetailSection').style.display = view === 'detail' ? 'block' : 'none';

  if (view === 'browse') {
    displayAds(allAds);
  } else if (view === 'myads') {
    loadUserAds();
  } else if (view === 'cart') {
    displayCart();
  }
}

// ============= IMAGE UPLOAD =============
document.getElementById('imageUploadArea')?.addEventListener('click', () => {
  document.getElementById('productImage').click();
});

document.getElementById('productImage')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    // Check file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      showNotification('File size must be less than 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      document.getElementById('previewImg').src = event.target.result;
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

// ============= AD FORM SUBMISSION =============
document.getElementById('adForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const imageFile = document.getElementById('productImage').files[0];
  if (!imageFile) {
    showNotification('Please select an image', 'error');
    return;
  }

  // Get selected duration plan
  const selectedDuration = document.querySelector('input[name="durationPlan"]:checked').value;
  const plan = DURATION_PLANS[selectedDuration];

  // Check if user has enough tokens
  if (userTokens < plan.tokens) {
    showNotification(`Insufficient tokens! You need ${plan.tokens} but only have ${userTokens}`, 'error');
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  showStatus('Processing advertisement...', 'loading');

  try {
    // Upload image to Firebase Storage
    const storageRef = ref(storage, `advertisements/${userUID}/${Date.now()}_${imageFile.name}`);
    const snapshot = await uploadBytes(storageRef, imageFile);
    const imageURL = await getDownloadURL(snapshot.ref);

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + plan.hours * 60 * 60 * 1000);

    // Create ad document
    const adData = {
      productName: document.getElementById('productName').value,
      productDescription: document.getElementById('productDescription').value,
      productPrice: parseFloat(document.getElementById('productPrice').value),
      productCategory: document.getElementById('productCategory').value,
      imageURL: imageURL,
      sellerUID: userUID,
      sellerUsername: userUsername,
      sellerEmail: userEmail,
      createdAt: new Date(),
      expiresAt: expiresAt,
      durationHours: plan.hours,
      durationTokens: plan.tokens,
      updatedAt: new Date(),
      status: 'active'
    };

    // Add to Firestore
    const docRef = await addDoc(collection(db, 'advertisements'), adData);
    adData.id = docRef.id;

    // Deduct tokens from user
    await deductUserTokens(plan.tokens);

    showStatus('Advertisement posted successfully!', 'success');
    showNotification(`✅ Ad posted! ${plan.tokens} tokens deducted. Expires in ${plan.hours} hours.`, 'success');

    // Reset form
    document.getElementById('adForm').reset();
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('imageUploadArea').style.display = 'flex';
    document.querySelector('input[name="durationPlan"][value="48"]').checked = true;
    updateTokenDisplay();

    // Reload ads
    await loadAllAds();

    setTimeout(() => {
      showView('browse');
    }, 1500);
  } catch (error) {
    console.error('Error posting ad:', error);
    showStatus('Error posting advertisement: ' + error.message, 'error');
    showNotification('Failed to post advertisement', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

// ============= TOKEN MANAGEMENT =============
async function deductUserTokens(amount) {
  try {
    const userRef = doc(db, 'users', userUID);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const currentTokens = userSnap.data().tokens || 0;
      const newTokens = Math.max(0, currentTokens - amount);

      await updateDoc(userRef, {
        tokens: newTokens,
        lastTokenUpdate: new Date()
      });

      userTokens = newTokens;
      updateTokenDisplay();
    }
  } catch (error) {
    console.error('Error deducting tokens:', error);
    throw new Error('Failed to deduct tokens: ' + error.message);
  }
}

// ============= CHECK EXPIRED ADS =============
async function checkExpiredAds() {
  try {
    const now = new Date();

    const querySnapshot = await getDocs(query(
      collection(db, 'advertisements'),
      where('status', '==', 'active')
    ));

    for (const docSnapshot of querySnapshot.docs) {
      const ad = docSnapshot.data();

      if (ad.expiresAt) {
        const expirationDate = ad.expiresAt.toDate ? ad.expiresAt.toDate() : new Date(ad.expiresAt);

        if (expirationDate <= now) {
          // Ad has expired, delete it
          await deleteDoc(doc(db, 'advertisements', docSnapshot.id));

          console.log(`Ad expired and removed: ${ad.productName}`);
        }
      }
    }
  } catch (error) {
    console.error('Error checking expired ads:', error);
  }
}

// ============= LOAD ADS =============
async function loadAllAds() {
  try {
    const querySnapshot = await getDocs(query(
      collection(db, 'advertisements'),
      where('status', '==', 'active')
    ));

    allAds = [];
    querySnapshot.forEach((doc) => {
      const adData = doc.data();

      // Check if ad has expired
      if (adData.expiresAt) {
        const expirationDate = adData.expiresAt.toDate ? adData.expiresAt.toDate() : new Date(adData.expiresAt);
        const now = new Date();

        if (expirationDate > now) {
          allAds.push({
            id: doc.id,
            ...adData
          });
        }
      } else {
        allAds.push({
          id: doc.id,
          ...adData
        });
      }
    });

    allAds.sort((a, b) => b.createdAt?.toDate?.() - a.createdAt?.toDate?.());
  } catch (error) {
    console.error('Error loading ads:', error);
    showNotification('Failed to load advertisements', 'error');
  }
}

async function loadUserAds() {
  try {
    const querySnapshot = await getDocs(query(
      collection(db, 'advertisements'),
      where('sellerUID', '==', userUID)
    ));

    const userAds = [];
    querySnapshot.forEach((doc) => {
      const adData = doc.data();

      // Include expired ads in user's view but mark them
      userAds.push({
        id: doc.id,
        ...adData
      });
    });

    displayUserAds(userAds);
  } catch (error) {
    console.error('Error loading user ads:', error);
    showNotification('Failed to load your advertisements', 'error');
  }
}

// ============= DISPLAY ADS =============
function displayAds(ads) {
  const container = document.getElementById('adsList');

  if (ads.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>📭 No advertisements found</p>
        <p class="hint">Check back soon for new products!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = ads.map(ad => {
    const expiresAt = ad.expiresAt?.toDate ? ad.expiresAt.toDate() : new Date(ad.expiresAt);
    const timeLeft = Math.ceil((expiresAt - new Date()) / 3600000); // hours

    return `
    <div class="ad-card" onclick="viewAdDetail('${ad.id}')">
      <img src="${ad.imageURL}" alt="${ad.productName}" class="ad-card-image">
      <div class="ad-card-category">${getCategoryEmoji(ad.productCategory)} ${ad.productCategory}</div>
      <div class="ad-card-expiry">⏱️ ${timeLeft}h left</div>
      <div class="ad-card-content">
        <h3 class="ad-card-name">${escapeHtml(ad.productName)}</h3>
        <p class="ad-card-description">${escapeHtml(ad.productDescription.substring(0, 80))}...</p>
        <div class="ad-card-price">$${ad.productPrice.toFixed(2)}</div>
        <p class="ad-card-seller">👤 ${escapeHtml(ad.sellerUsername)}</p>
        <div class="ad-card-actions">
          <button class="ad-card-btn cart-btn" onclick="addToCartFromCard(event, '${ad.id}')">🛒 Cart</button>
          <button class="ad-card-btn" onclick="contactSeller(event, '${ad.id}')">💬 Contact</button>
        </div>
      </div>
    </div>
  `}).join('');
}

function displayUserAds(ads) {
  const container = document.getElementById('myAdsList');

  if (ads.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>📭 No advertisements yet</p>
        <p class="hint">Create your first advertisement</p>
      </div>
    `;
    return;
  }

  container.innerHTML = ads.map(ad => {
    const expiresAt = ad.expiresAt?.toDate ? ad.expiresAt.toDate() : new Date(ad.expiresAt);
    const now = new Date();
    const isExpired = expiresAt <= now;
    const timeLeft = Math.ceil((expiresAt - now) / 3600000); // hours

    return `
    <div class="ad-card ${isExpired ? 'expired' : ''}">
      <img src="${ad.imageURL}" alt="${ad.productName}" class="ad-card-image">
      <button class="ad-card-edit" onclick="deleteAd(event, '${ad.id}')">🗑️ Delete</button>
      <div class="ad-card-category">${getCategoryEmoji(ad.productCategory)} ${ad.productCategory}</div>
      ${isExpired ? '<div class="ad-card-expired-badge">EXPIRED</div>' : `<div class="ad-card-expiry">⏱️ ${timeLeft}h left</div>`}
      <div class="ad-card-content">
        <h3 class="ad-card-name">${escapeHtml(ad.productName)}</h3>
        <p class="ad-card-description">${escapeHtml(ad.productDescription.substring(0, 80))}...</p>
        <div class="ad-card-price">$${ad.productPrice.toFixed(2)}</div>
        <p class="ad-card-seller">👤 ${escapeHtml(ad.sellerUsername)}</p>
        <p class="ad-card-duration">⭐ ${ad.durationTokens} tokens · ${ad.durationHours}h duration</p>
        <div class="ad-card-actions">
          <button class="ad-card-btn" onclick="viewAdDetail('${ad.id}')">👁️ View</button>
          <button class="ad-card-btn" onclick="editAd(event, '${ad.id}')">✏️ Edit</button>
        </div>
      </div>
    </div>
  `}).join('');
}

// ============= AD DETAIL VIEW =============
function viewAdDetail(adId) {
  currentDetailAd = allAds.find(ad => ad.id === adId);
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

document.getElementById('backFromDetailBtn')?.addEventListener('click', () => {
  showView('browse');
});

document.getElementById('addToCartDetailBtn')?.addEventListener('click', () => {
  addToCart(currentDetailAd);
  showNotification('Added to cart!', 'success');
});

document.getElementById('contactSellerBtn')?.addEventListener('click', () => {
  // Redirect to chat with seller
  const sellerUID = currentDetailAd.sellerUID;
  const sellerUsername = currentDetailAd.sellerUsername;

  // Store in session and redirect
  sessionStorage.setItem('targetUserUID', sellerUID);
  sessionStorage.setItem('targetUsername', sellerUsername);
  sessionStorage.setItem('fromAdvertisement', 'true');

  window.location.href = 'chat.html';
});

// ============= CART MANAGEMENT =============
function addToCartFromCard(e, adId) {
  e.stopPropagation();
  const ad = allAds.find(a => a.id === adId);
  if (ad) {
    addToCart(ad);
    showNotification('Added to cart!', 'success');
  }
}

function addToCart(ad) {
  const existingItem = cartItems.find(item => item.id === ad.id);

  if (existingItem) {
    existingItem.quantity++;
  } else {
    cartItems.push({
      ...ad,
      quantity: 1
    });
  }

  updateCartBadge();
  saveCartToLocalStorage();
}

function removeFromCart(adId) {
  cartItems = cartItems.filter(item => item.id !== adId);
  updateCartBadge();
  saveCartToLocalStorage();
  displayCart();
}

function updateCartItemQuantity(adId, quantity) {
  const item = cartItems.find(item => item.id === adId);
  if (item) {
    item.quantity = Math.max(1, parseInt(quantity));
    updateCartBadge();
    saveCartToLocalStorage();
    displayCart();
  }
}

function updateCartBadge() {
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById('cartCount').textContent = totalItems;
}

function displayCart() {
  const container = document.getElementById('cartItems');
  const summary = document.getElementById('cartSummary');

  if (cartItems.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>🛒 Your cart is empty</p>
        <p class="hint">Add items to get started</p>
      </div>
    `;
    summary.style.display = 'none';
    return;
  }

  container.innerHTML = cartItems.map(item => `
    <div class="cart-item">
      <img src="${item.imageURL}" alt="${item.productName}" class="cart-item-image">
      <div class="cart-item-content">
        <div class="cart-item-name">${escapeHtml(item.productName)}</div>
        <div class="cart-item-price">$${item.productPrice.toFixed(2)}</div>
        <div class="cart-item-seller">👤 ${escapeHtml(item.sellerUsername)}</div>
      </div>
      <div class="cart-item-actions">
        <div class="qty-control">
          <button class="qty-btn" onclick="updateCartItemQuantity('${item.id}', ${item.quantity - 1})">−</button>
          <input type="number" class="qty-input" value="${item.quantity}" readonly>
          <button class="qty-btn" onclick="updateCartItemQuantity('${item.id}', ${item.quantity + 1})">+</button>
        </div>
        <button class="remove-cart-btn" onclick="removeFromCart('${item.id}')">Remove</button>
      </div>
    </div>
  `).join('');

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + (item.productPrice * item.quantity), 0);
  const tax = subtotal * 0.10;
  const total = subtotal + tax;

  document.getElementById('subtotal').textContent = '$' + subtotal.toFixed(2);
  document.getElementById('taxAmount').textContent = '$' + tax.toFixed(2);
  document.getElementById('totalAmount').textContent = '$' + total.toFixed(2);

  summary.style.display = 'block';
}

document.getElementById('checkoutBtn')?.addEventListener('click', () => {
  if (cartItems.length === 0) {
    showNotification('Cart is empty', 'error');
    return;
  }

  // Group by seller
  const sellers = {};
  cartItems.forEach(item => {
    if (!sellers[item.sellerUID]) {
      sellers[item.sellerUID] = [];
    }
    sellers[item.sellerUID].push(item);
  });

  // Redirect to first seller's chat with cart info
  const firstSellerUID = Object.keys(sellers)[0];
  const firstSellerItem = sellers[firstSellerUID][0];

  // Store cart and seller info in session
  sessionStorage.setItem('cartItems', JSON.stringify(cartItems));
  sessionStorage.setItem('targetUserUID', firstSellerUID);
  sessionStorage.setItem('targetUsername', firstSellerItem.sellerUsername);
  sessionStorage.setItem('fromAdvertisement', 'true');

  showNotification('Redirecting to chat...', 'success');
  setTimeout(() => {
    window.location.href = 'chat.html';
  }, 500);
});

// ============= LOCAL STORAGE =============
function saveCartToLocalStorage() {
  localStorage.setItem('nexchatCart', JSON.stringify(cartItems));
}

function loadCartFromLocalStorage() {
  const saved = localStorage.getItem('nexchatCart');
  if (saved) {
    try {
      cartItems = JSON.parse(saved);
      updateCartBadge();
    } catch (e) {
      console.error('Error loading cart:', e);
    }
  }
}

// ============= DELETE AD =============
async function deleteAd(e, adId) {
  e.stopPropagation();

  if (!confirm('Are you sure you want to delete this advertisement?')) {
    return;
  }

  try {
    await deleteDoc(doc(db, 'advertisements', adId));
    showNotification('Advertisement deleted', 'success');
    loadUserAds();
  } catch (error) {
    console.error('Error deleting ad:', error);
    showNotification('Failed to delete advertisement', 'error');
  }
}

function editAd(e, adId) {
  e.stopPropagation();
  // TODO: Implement edit functionality
  showNotification('Edit feature coming soon!', 'error');
}

// ============= SEARCH & FILTER =============
document.getElementById('searchAds')?.addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  const filtered = allAds.filter(ad =>
    ad.productName.toLowerCase().includes(term) ||
    ad.productDescription.toLowerCase().includes(term)
  );
  displayAds(filtered);
});

document.getElementById('filterCategory')?.addEventListener('change', (e) => {
  const category = e.target.value;
  const filtered = category ? allAds.filter(ad => ad.productCategory === category) : allAds;
  displayAds(filtered);
});

// ============= CONTACT SELLER =============
function contactSeller(e, adId) {
  e.stopPropagation();
  const ad = allAds.find(a => a.id === adId);
  if (!ad) return;

  sessionStorage.setItem('targetUserUID', ad.sellerUID);
  sessionStorage.setItem('targetUsername', ad.sellerUsername);
  sessionStorage.setItem('fromAdvertisement', 'true');
  sessionStorage.setItem('productName', ad.productName);
  sessionStorage.setItem('productPrice', ad.productPrice);

  window.location.href = 'chat.html';
}

// ============= UTILITY FUNCTIONS =============
function getCategoryEmoji(category) {
  const emojis = {
    'electronics': '🖥️',
    'clothing': '👕',
    'books': '📚',
    'sports': '⚽',
    'furniture': '🪑',
    'food': '🍔',
    'services': '🛠️',
    'other': '📦'
  };
  return emojis[category] || '📦';
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function showNotification(message, type = 'info') {
  const container = document.getElementById('notificationContainer');
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `<span>${message}</span>`;
  container.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('uploadStatus');
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
  statusEl.style.display = 'block';

  if (type !== 'loading') {
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  }
}

// ============= GLOBAL FUNCTIONS FOR INLINE HANDLERS =============
window.addToCartFromCard = addToCartFromCard;
window.contactSeller = contactSeller;
window.viewAdDetail = viewAdDetail;
window.deleteAd = deleteAd;
window.editAd = editAd;
window.removeFromCart = removeFromCart;
window.updateCartItemQuantity = updateCartItemQuantity;

// ============= OFFLINE SUPPORT =============
window.addEventListener('online', () => {
  document.getElementById('offlineIndicator').style.display = 'none';
});

window.addEventListener('offline', () => {
  document.getElementById('offlineIndicator').style.display = 'flex';
});

// ============= DARK MODE =============
function applyDarkMode(isDark) {
  if (isDark) {
    document.body.classList.remove('light-mode');
  } else {
    document.body.classList.add('light-mode');
  }
  localStorage.setItem('darkMode', isDark);
}

// Load dark mode preference
let savedDarkModeValue = localStorage.getItem('darkMode');
if (savedDarkModeValue !== null) {
  applyDarkMode(savedDarkModeValue === 'true');
}

console.log('Advertisement module loaded successfully');


// ============= INITIALIZATION =============
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    userUID = user.uid;
    userEmail = user.email || 'No email';

    // Get user data from Firestore
    try {
      const userRef = doc(db, 'users', userUID);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        userUsername = userSnap.data().username || 'Unknown User';
      } else {
        userUsername = user.displayName || 'Unknown User';
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      userUsername = user.displayName || 'Unknown User';
    }

    // Fill user info in form
    document.getElementById('nexUsername').value = userUsername;
    document.getElementById('userEmail').value = userEmail;
    document.getElementById('userUID').value = userUID;

    // Load ads
    loadAllAds();
    loadCartFromLocalStorage();
  } else {
    window.location.href = 'login.html';
  }
});

// ============= NAVIGATION =============
document.getElementById('backBtn').addEventListener('click', () => {
  window.location.href = 'chat.html';
});

document.getElementById('cartBtn').addEventListener('click', () => {
  showView('cart');
});

document.getElementById('myAdsBtn').addEventListener('click', () => {
  showView('myads');
});

document.getElementById('searchBtn').addEventListener('click', () => {
  showView('browse');
});

document.getElementById('createNewAdBtn')?.addEventListener('click', () => {
  showView('upload');
  document.getElementById('adForm').reset();
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('imageUploadArea').style.display = 'flex';
});

document.getElementById('continueShopping')?.addEventListener('click', () => {
  showView('browse');
});

function showView(view) {
  currentView = view;
  document.getElementById('uploadSection').style.display = view === 'upload' ? 'block' : 'none';
  document.getElementById('adsListSection').style.display = view === 'browse' ? 'block' : 'none';
  document.getElementById('myAdsSection').style.display = view === 'myads' ? 'block' : 'none';
  document.getElementById('cartSection').style.display = view === 'cart' ? 'block' : 'none';
  document.getElementById('adDetailSection').style.display = view === 'detail' ? 'block' : 'none';

  if (view === 'browse') {
    displayAds(allAds);
  } else if (view === 'myads') {
    loadUserAds();
  } else if (view === 'cart') {
    displayCart();
  }
}

// ============= IMAGE UPLOAD =============
document.getElementById('productImage')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    // Check file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      showNotification('File size must be less than 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      document.getElementById('previewImg').src = event.target.result;
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

// ============= AD FORM SUBMISSION =============
document.getElementById('adForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const imageFile = document.getElementById('productImage').files[0];
  if (!imageFile) {
    showNotification('Please select an image', 'error');
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  showStatus('Uploading advertisement...', 'loading');

  try {
    // Upload image to Firebase Storage
    const storageRef = ref(storage, `advertisements/${userUID}/${Date.now()}_${imageFile.name}`);
    const snapshot = await uploadBytes(storageRef, imageFile);
    const imageURL = await getDownloadURL(snapshot.ref);

    // Create ad document
    const adData = {
      productName: document.getElementById('productName').value,
      productDescription: document.getElementById('productDescription').value,
      productPrice: parseFloat(document.getElementById('productPrice').value),
      productCategory: document.getElementById('productCategory').value,
      imageURL: imageURL,
      sellerUID: userUID,
      sellerUsername: userUsername,
      sellerEmail: userEmail,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active'
    };

    // Add to Firestore
    const docRef = await addDoc(collection(db, 'advertisements'), adData);
    adData.id = docRef.id;

    showStatus('Advertisement posted successfully!', 'success');
    showNotification('Your ad is now live!', 'success');

    // Reset form
    document.getElementById('adForm').reset();
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('imageUploadArea').style.display = 'flex';

    // Reload ads
    await loadAllAds();

    setTimeout(() => {
      showView('browse');
    }, 1500);
  } catch (error) {
    console.error('Error posting ad:', error);
    showStatus('Error posting advertisement: ' + error.message, 'error');
    showNotification('Failed to post advertisement', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

// ============= LOAD ADS =============
async function loadAllAds() {
  try {
    const querySnapshot = await getDocs(query(
      collection(db, 'advertisements'),
      where('status', '==', 'active')
    ));

    allAds = [];
    querySnapshot.forEach((doc) => {
      allAds.push({
        id: doc.id,
        ...doc.data()
      });
    });

    allAds.sort((a, b) => b.createdAt?.toDate?.() - a.createdAt?.toDate?.());
  } catch (error) {
    console.error('Error loading ads:', error);
    showNotification('Failed to load advertisements', 'error');
  }
}

async function loadUserAds() {
  try {
    const querySnapshot = await getDocs(query(
      collection(db, 'advertisements'),
      where('sellerUID', '==', userUID)
    ));

    const userAds = [];
    querySnapshot.forEach((doc) => {
      userAds.push({
        id: doc.id,
        ...doc.data()
      });
    });

    displayUserAds(userAds);
  } catch (error) {
    console.error('Error loading user ads:', error);
    showNotification('Failed to load your advertisements', 'error');
  }
}

// ============= DISPLAY ADS =============
function displayAds(ads) {
  const container = document.getElementById('adsList');

  if (ads.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>📭 No advertisements found</p>
        <p class="hint">Check back soon for new products!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = ads.map(ad => `
    <div class="ad-card" onclick="viewAdDetail('${ad.id}')">
      <img src="${ad.imageURL}" alt="${ad.productName}" class="ad-card-image">
      <div class="ad-card-category">${getCategoryEmoji(ad.productCategory)} ${ad.productCategory}</div>
      <div class="ad-card-content">
        <h3 class="ad-card-name">${escapeHtml(ad.productName)}</h3>
        <p class="ad-card-description">${escapeHtml(ad.productDescription.substring(0, 80))}...</p>
        <div class="ad-card-price">$${ad.productPrice.toFixed(2)}</div>
        <p class="ad-card-seller">👤 ${escapeHtml(ad.sellerUsername)}</p>
        <div class="ad-card-actions">
          <button class="ad-card-btn cart-btn" onclick="addToCartFromCard(event, '${ad.id}')">🛒 Cart</button>
          <button class="ad-card-btn" onclick="contactSeller(event, '${ad.id}')">💬 Contact</button>
        </div>
      </div>
    </div>
  `).join('');
}

function displayUserAds(ads) {
  const container = document.getElementById('myAdsList');

  if (ads.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>📭 No advertisements yet</p>
        <p class="hint">Create your first advertisement</p>
      </div>
    `;
    return;
  }

  container.innerHTML = ads.map(ad => `
    <div class="ad-card">
      <img src="${ad.imageURL}" alt="${ad.productName}" class="ad-card-image">
      <button class="ad-card-edit" onclick="deleteAd(event, '${ad.id}')">🗑️ Delete</button>
      <div class="ad-card-category">${getCategoryEmoji(ad.productCategory)} ${ad.productCategory}</div>
      <div class="ad-card-content">
        <h3 class="ad-card-name">${escapeHtml(ad.productName)}</h3>
        <p class="ad-card-description">${escapeHtml(ad.productDescription.substring(0, 80))}...</p>
        <div class="ad-card-price">$${ad.productPrice.toFixed(2)}</div>
        <p class="ad-card-seller">👤 ${escapeHtml(ad.sellerUsername)}</p>
        <div class="ad-card-actions">
          <button class="ad-card-btn" onclick="viewAdDetail('${ad.id}')">👁️ View</button>
          <button class="ad-card-btn" onclick="editAd(event, '${ad.id}')">✏️ Edit</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ============= AD DETAIL VIEW =============
function viewAdDetail(adId) {
  currentDetailAd = allAds.find(ad => ad.id === adId);
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

document.getElementById('backFromDetailBtn')?.addEventListener('click', () => {
  showView('browse');
});

document.getElementById('addToCartDetailBtn')?.addEventListener('click', () => {
  addToCart(currentDetailAd);
  showNotification('Added to cart!', 'success');
});

document.getElementById('contactSellerBtn')?.addEventListener('click', () => {
  // Redirect to chat with seller
  const sellerUID = currentDetailAd.sellerUID;
  const sellerUsername = currentDetailAd.sellerUsername;

  // Store in session and redirect
  sessionStorage.setItem('targetUserUID', sellerUID);
  sessionStorage.setItem('targetUsername', sellerUsername);
  sessionStorage.setItem('fromAdvertisement', 'true');

  window.location.href = 'chat.html';
});

// ============= CART MANAGEMENT =============
function addToCartFromCard(e, adId) {
  e.stopPropagation();
  const ad = allAds.find(a => a.id === adId);
  if (ad) {
    addToCart(ad);
    showNotification('Added to cart!', 'success');
  }
}

function addToCart(ad) {
  const existingItem = cartItems.find(item => item.id === ad.id);

  if (existingItem) {
    existingItem.quantity++;
  } else {
    cartItems.push({
      ...ad,
      quantity: 1
    });
  }

  updateCartBadge();
  saveCartToLocalStorage();
}

function removeFromCart(adId) {
  cartItems = cartItems.filter(item => item.id !== adId);
  updateCartBadge();
  saveCartToLocalStorage();
  displayCart();
}

function updateCartItemQuantity(adId, quantity) {
  const item = cartItems.find(item => item.id === adId);
  if (item) {
    item.quantity = Math.max(1, parseInt(quantity));
    updateCartBadge();
    saveCartToLocalStorage();
    displayCart();
  }
}

function updateCartBadge() {
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById('cartCount').textContent = totalItems;
}

function displayCart() {
  const container = document.getElementById('cartItems');
  const summary = document.getElementById('cartSummary');

  if (cartItems.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>🛒 Your cart is empty</p>
        <p class="hint">Add items to get started</p>
      </div>
    `;
    summary.style.display = 'none';
    return;
  }

  container.innerHTML = cartItems.map(item => `
    <div class="cart-item">
      <img src="${item.imageURL}" alt="${item.productName}" class="cart-item-image">
      <div class="cart-item-content">
        <div class="cart-item-name">${escapeHtml(item.productName)}</div>
        <div class="cart-item-price">$${item.productPrice.toFixed(2)}</div>
        <div class="cart-item-seller">👤 ${escapeHtml(item.sellerUsername)}</div>
      </div>
      <div class="cart-item-actions">
        <div class="qty-control">
          <button class="qty-btn" onclick="updateCartItemQuantity('${item.id}', ${item.quantity - 1})">−</button>
          <input type="number" class="qty-input" value="${item.quantity}" readonly>
          <button class="qty-btn" onclick="updateCartItemQuantity('${item.id}', ${item.quantity + 1})">+</button>
        </div>
        <button class="remove-cart-btn" onclick="removeFromCart('${item.id}')">Remove</button>
      </div>
    </div>
  `).join('');

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + (item.productPrice * item.quantity), 0);
  const tax = subtotal * 0.10;
  const total = subtotal + tax;

  document.getElementById('subtotal').textContent = '$' + subtotal.toFixed(2);
  document.getElementById('taxAmount').textContent = '$' + tax.toFixed(2);
  document.getElementById('totalAmount').textContent = '$' + total.toFixed(2);

  summary.style.display = 'block';
}

document.getElementById('checkoutBtn')?.addEventListener('click', () => {
  if (cartItems.length === 0) {
    showNotification('Cart is empty', 'error');
    return;
  }

  // Group by seller
  const sellers = {};
  cartItems.forEach(item => {
    if (!sellers[item.sellerUID]) {
      sellers[item.sellerUID] = [];
    }
    sellers[item.sellerUID].push(item);
  });

  // Redirect to first seller's chat with cart info
  const firstSellerUID = Object.keys(sellers)[0];
  const firstSellerItem = sellers[firstSellerUID][0];

  // Store cart and seller info in session
  sessionStorage.setItem('cartItems', JSON.stringify(cartItems));
  sessionStorage.setItem('targetUserUID', firstSellerUID);
  sessionStorage.setItem('targetUsername', firstSellerItem.sellerUsername);
  sessionStorage.setItem('fromAdvertisement', 'true');

  showNotification('Redirecting to chat...', 'success');
  setTimeout(() => {
    window.location.href = 'chat.html';
  }, 500);
});

// ============= LOCAL STORAGE =============
function saveCartToLocalStorage() {
  localStorage.setItem('nexchatCart', JSON.stringify(cartItems));
}

function loadCartFromLocalStorage() {
  const saved = localStorage.getItem('nexchatCart');
  if (saved) {
    try {
      cartItems = JSON.parse(saved);
      updateCartBadge();
    } catch (e) {
      console.error('Error loading cart:', e);
    }
  }
}

// ============= DELETE AD =============
async function deleteAd(e, adId) {
  e.stopPropagation();

  if (!confirm('Are you sure you want to delete this advertisement?')) {
    return;
  }

  try {
    await deleteDoc(doc(db, 'advertisements', adId));
    showNotification('Advertisement deleted', 'success');
    loadUserAds();
  } catch (error) {
    console.error('Error deleting ad:', error);
    showNotification('Failed to delete advertisement', 'error');
  }
}

function editAd(e, adId) {
  e.stopPropagation();
  // TODO: Implement edit functionality
  showNotification('Edit feature coming soon!', 'error');
}

// ============= SEARCH & FILTER =============
document.getElementById('searchAds')?.addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  const filtered = allAds.filter(ad =>
    ad.productName.toLowerCase().includes(term) ||
    ad.productDescription.toLowerCase().includes(term)
  );
  displayAds(filtered);
});

document.getElementById('filterCategory')?.addEventListener('change', (e) => {
  const category = e.target.value;
  const filtered = category ? allAds.filter(ad => ad.productCategory === category) : allAds;
  displayAds(filtered);
});

// ============= CONTACT SELLER =============
function contactSeller(e, adId) {
  e.stopPropagation();
  const ad = allAds.find(a => a.id === adId);
  if (!ad) return;

  sessionStorage.setItem('targetUserUID', ad.sellerUID);
  sessionStorage.setItem('targetUsername', ad.sellerUsername);
  sessionStorage.setItem('fromAdvertisement', 'true');
  sessionStorage.setItem('productName', ad.productName);
  sessionStorage.setItem('productPrice', ad.productPrice);

  window.location.href = 'chat.html';
}

// ============= UTILITY FUNCTIONS =============
function getCategoryEmoji(category) {
  const emojis = {
    'electronics': '🖥️',
    'clothing': '👕',
    'books': '📚',
    'sports': '⚽',
    'furniture': '🪑',
    'food': '🍔',
    'services': '🛠️',
    'other': '📦'
  };
  return emojis[category] || '📦';
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function showNotification(message, type = 'info') {
  const container = document.getElementById('notificationContainer');
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `<span>${message}</span>`;
  container.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('uploadStatus');
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
  statusEl.style.display = 'block';

  if (type !== 'loading') {
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  }
}

// ============= GLOBAL FUNCTIONS FOR INLINE HANDLERS =============
window.addToCartFromCard = addToCartFromCard;
window.contactSeller = contactSeller;
window.viewAdDetail = viewAdDetail;
window.deleteAd = deleteAd;
window.editAd = editAd;
window.removeFromCart = removeFromCart;
window.updateCartItemQuantity = updateCartItemQuantity;

// ============= OFFLINE SUPPORT =============
window.addEventListener('online', () => {
  document.getElementById('offlineIndicator').style.display = 'none';
});

window.addEventListener('offline', () => {
  document.getElementById('offlineIndicator').style.display = 'flex';
});

// ============= DARK MODE =============
function applyDarkMode(isDark) {
  if (isDark) {
    document.body.classList.remove('light-mode');
  } else {
    document.body.classList.add('light-mode');
  }
  localStorage.setItem('darkMode', isDark);
}

// Load dark mode preference
const savedDarkMode = localStorage.getItem('darkMode');
if (savedDarkMode !== null) {
  applyDarkMode(savedDarkMode === 'true');
}

console.log('Advertisement module loaded successfully');
