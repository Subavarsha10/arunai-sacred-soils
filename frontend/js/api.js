/* ============================================================
   api.js - single gateway to the backend.
   MOCK MODE (CONFIG.USE_MOCK = true) -> a browser-side mock (localStorage) answers every
            call with the SAME URLs and JSON shapes the Express API will use in Phase 2.
   LIVE MODE (USE_MOCK = false, the default now) -> every call goes to API_BASE with the JWT in the header.
   ============================================================ */
// USE_MOCK = false: talk to the Express backend (Phase 2). Set true to run the browser-only demo (Phase 1).
// When the page is served by the backend itself (http://localhost:5000) the API is same-origin.
const CONFIG = { USE_MOCK: false, API_BASE: location.port === '5000' ? '/api' : 'http://localhost:5000/api' };

const Auth = {
  get token() { return localStorage.getItem('ass_token'); },
  get user() { try { return JSON.parse(localStorage.getItem('ass_user')); } catch (e) { return null; } },
  set(token, user) { localStorage.setItem('ass_token', token); localStorage.setItem('ass_user', JSON.stringify(user)); },
  clear() { localStorage.removeItem('ass_token'); localStorage.removeItem('ass_user'); }
};

async function api(method, path, body) {
  if (CONFIG.USE_MOCK) return Mock.handle(method, path, body);
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (Auth.token) headers.Authorization = 'Bearer ' + Auth.token;
  let res;
  try { res = await fetch(CONFIG.API_BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }); }
  catch (e) { throw Object.assign(new Error('Cannot reach the server. Is the backend running?'), { status: 0 }); }
  let json = {};
  try { json = await res.json(); } catch (e) { /* empty body */ }
  if (!res.ok) throw Object.assign(new Error(json.message || 'Request failed (' + res.status + ')'), { status: res.status });
  return json.data !== undefined ? json.data : json;
}

/* ---------------- Mock backend (Phase 1 only) ---------------- */
const Mock = (() => {
  const KEY = 'ass_db_v1';
  const IMG = 'assets/images/products/', CIMG = 'assets/images/categories/';
  const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
  const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ass-demo-salt:' + s)))].map(b => b.toString(16).padStart(2, '0')).join('');
  const now = () => new Date().toISOString();

  function seed() {
    const cats = [
      [1, 'Fresh Vegetables', 'Farm-picked vegetables, harvested at peak freshness.', 'vegetables.svg'],
      [2, 'Coconut Products', 'Tender and mature coconuts from local groves.', 'coconut.svg'],
      [3, 'Farm Eggs', 'Free-range eggs gathered fresh every morning.', 'eggs.svg'],
      [4, 'Natural Oils', 'Cold pressed oils with nothing added.', 'oils.svg'],
      [5, 'Natural Honey', 'Raw, unprocessed honey straight from the hive.', 'honey.svg'],
      [6, 'Grains & Millets', 'Traditional rice, millets and whole grains.', 'grains.svg']
    ].map(([id, name, description, f]) => ({ id, name, description, image: CIMG + f }));
    const P = (id, name, categoryId, price, unit, stock, file, description, featured) =>
      ({ id, name, categoryId, price, unit, stock, lowStockThreshold: 10, available: true, featured: !!featured, image: IMG + file, description, createdAt: now() });
    const products = [
      P(1, 'Fresh Tomatoes', 1, 40, 'per kg', 120, 'tomatoes.svg', 'Juicy, sun-ripened tomatoes picked the same morning. Perfect for curries, chutneys and salads.', 1),
      P(2, 'Fresh Carrots', 1, 50, 'per kg', 90, 'carrots.svg', 'Crisp, sweet carrots grown in rich red soil. Enjoy them raw, in sambar or as a halwa.'),
      P(3, 'Fresh Coconut', 2, 35, 'per piece', 150, 'coconut.svg', 'Heavy, water-rich coconuts from nearby groves. Ideal for cooking, chutneys and temple offerings.', 1),
      P(4, 'Farm Fresh Eggs', 3, 96, 'per dozen', 60, 'eggs.svg', 'Eggs from free-range hens fed on natural grain, with deep golden yolks.', 1),
      P(5, 'Cold Pressed Coconut Oil', 4, 420, 'per litre', 45, 'coconut-oil.svg', 'Slow-pressed from sun-dried copra at low temperature. Aromatic and unrefined.', 1),
      P(6, 'Cold Pressed Groundnut Oil', 4, 380, 'per litre', 50, 'groundnut-oil.svg', 'Traditional wooden-press style groundnut oil with a rich nutty aroma. Great for frying and tempering.'),
      P(7, 'Natural Honey', 5, 450, 'per 500 g', 6, 'honey.svg', 'Raw, unheated forest honey. Nothing added, nothing removed.', 1),
      P(8, 'Organic Ragi', 6, 85, 'per kg', 80, 'ragi.svg', 'Whole finger millet grown without chemicals. Rich in calcium. Use for ragi mudde, dosa or porridge.', 1),
      P(9, 'Traditional Rice', 6, 72, 'per kg', 200, 'rice.svg', 'Unpolished traditional rice with full flavour and a pleasant bite.'),
      P(10, 'Pearl Millet', 6, 68, 'per kg', 70, 'pearl-millet.svg', 'Cleaned pearl millet (kambu / bajra). Good for rotis, koozh and porridge.'),
      P(11, 'Foxtail Millet', 6, 95, 'per kg', 55, 'foxtail-millet.svg', 'Golden foxtail millet (thinai), a light grain that cooks like rice.'),
      P(12, 'Little Millet', 6, 105, 'per kg', 0, 'little-millet.svg', 'Fine little millet (samai), easy to digest and great for upma and pongal.')
    ];
    return {
      categories: cats, products, users: [], orders: [], addresses: [], newsletter: [], carts: {},
      seq: { user: 2, category: 7, product: 13, order: 1, address: 1, cartItem: 1 },
      sessions: {}
    };
  }
  async function init() {
    if (localStorage.getItem(KEY)) return;
    const db = seed();
    db.users.push({ id: 1, name: 'Store Admin', email: 'admin@arunaisacredsoils.com', phone: '9000000000', role: 'admin', passwordHash: await sha('Admin@123'), createdAt: now() });
    save(db);
  }
  const load = () => JSON.parse(localStorage.getItem(KEY));
  const save = db => localStorage.setItem(KEY, JSON.stringify(db));
  const delay = () => new Promise(r => setTimeout(r, 120));

  const status = p => (p.stock <= 0 || !p.available) ? 'Out of Stock' : (p.stock <= p.lowStockThreshold ? 'Low Stock' : 'In Stock');
  const shape = (db, p) => ({ ...p, categoryName: (db.categories.find(c => c.id === p.categoryId) || {}).name || '', availability: status(p) });
  const pubUser = u => { const { passwordHash, ...rest } = u; return rest; };
  const token = (u) => btoa(JSON.stringify({ id: u.id, role: u.role, t: Date.now(), r: Math.random() }));
  const me = (db) => { const t = Auth.token; if (!t) return null; const id = db.sessions[t]; return db.users.find(u => u.id === id) || null; };
  const needUser = db => me(db) || fail(401, 'Please log in to continue.');
  const needAdmin = db => { const u = needUser(db); if (u.role !== 'admin') fail(403, 'Administrator access required.'); return u; };
  const cartKey = db => { const u = me(db); return u ? 'u' + u.id : 'guest'; };

  function cartView(db) {
    const items = (db.carts[cartKey(db)] || []).map(ci => {
      const p = db.products.find(x => x.id === ci.productId); if (!p) return null;
      return { id: ci.id, productId: p.id, name: p.name, price: p.price, unit: p.unit, image: p.image, quantity: ci.quantity, stock: p.stock, lineTotal: p.price * ci.quantity };
    }).filter(Boolean);
    return { items, itemCount: items.reduce((s, i) => s + i.quantity, 0), subtotal: items.reduce((s, i) => s + i.lineTotal, 0) };
  }
  function orderView(db, o) { return o; }
  function validateProductInput(db, b, partial) {
    const out = {};
    if (!partial || b.name !== undefined) { if (!b.name || b.name.trim().length < 2) fail(400, 'Product name is required.'); out.name = b.name.trim(); }
    if (!partial || b.categoryId !== undefined) { if (!db.categories.some(c => c.id === +b.categoryId)) fail(400, 'Choose a valid category.'); out.categoryId = +b.categoryId; }
    if (!partial || b.price !== undefined) { if (!(+b.price > 0)) fail(400, 'Price must be greater than zero.'); out.price = +b.price; }
    if (!partial || b.stock !== undefined) { if (!(Number.isInteger(+b.stock) && +b.stock >= 0)) fail(400, 'Stock must be a whole number, 0 or more.'); out.stock = +b.stock; }
    ['unit', 'description', 'image'].forEach(k => { if (b[k] !== undefined) out[k] = String(b[k]); });
    if (b.available !== undefined) out.available = !!b.available;
    if (b.featured !== undefined) out.featured = !!b.featured;
    if (b.lowStockThreshold !== undefined) out.lowStockThreshold = Math.max(0, parseInt(b.lowStockThreshold, 10) || 0);
    return out;
  }

  async function handle(method, fullPath, body) {
    await init(); await delay();
    const db = load();
    const [path, qs] = fullPath.split('?');
    const q = Object.fromEntries(new URLSearchParams(qs || ''));
    const m = (re) => path.match(re);
    let r;

    // ---------- health ----------
    if (method === 'GET' && path === '/health') return { status: 'ok (mock)' };

    // ---------- auth ----------
    if (method === 'POST' && path === '/auth/register') {
      const { name, email, phone, password, confirmPassword } = body || {};
      if (!V.name(name || '')) fail(400, 'Enter your full name.');
      if (!V.email(email || '')) fail(400, 'Enter a valid email address.');
      if (!V.phone(phone || '')) fail(400, 'Enter a valid 10-digit Indian mobile number.');
      if (!V.password(password || '')) fail(400, 'Password needs 8+ characters with upper, lower, number and symbol.');
      if (password !== confirmPassword) fail(400, 'Passwords do not match.');
      if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) fail(409, 'An account with this email already exists.');
      if (db.users.some(u => u.phone === phone)) fail(409, 'An account with this phone number already exists.');
      const u = { id: db.seq.user++, name: name.trim(), email: email.trim(), phone, role: 'customer', passwordHash: await sha(password), createdAt: now() };
      db.users.push(u); save(db);
      return { user: pubUser(u) };
    }
    if (method === 'POST' && path === '/auth/login') {
      const { email, password } = body || {};
      const u = db.users.find(x => x.email.toLowerCase() === String(email || '').toLowerCase());
      if (!u || u.passwordHash !== await sha(password || '')) fail(401, 'Incorrect email or password.');
      const t = token(u); db.sessions[t] = u.id;
      const g = db.carts.guest || [];                                    // merge guest cart into customer cart
      const key = 'u' + u.id; db.carts[key] = db.carts[key] || [];
      g.forEach(gi => { const ex = db.carts[key].find(i => i.productId === gi.productId); if (ex) ex.quantity += gi.quantity; else db.carts[key].push({ ...gi, id: db.seq.cartItem++ }); });
      db.carts.guest = []; save(db);
      return { token: t, user: pubUser(u) };
    }
    if (method === 'GET' && path === '/auth/me') return { user: pubUser(needUser(db)) };
    if (method === 'POST' && path === '/auth/logout') { delete db.sessions[Auth.token]; save(db); return { message: 'Logged out.' }; }

    // ---------- categories ----------
    if (method === 'GET' && path === '/categories') return db.categories.map(c => ({ ...c, productCount: db.products.filter(p => p.categoryId === c.id).length }));
    if (method === 'POST' && path === '/categories') {
      needAdmin(db); if (!body.name || body.name.trim().length < 2) fail(400, 'Category name is required.');
      if (db.categories.some(c => c.name.toLowerCase() === body.name.trim().toLowerCase())) fail(409, 'Category already exists.');
      const c = { id: db.seq.category++, name: body.name.trim(), description: body.description || '', image: body.image || CIMG + 'grains.svg' };
      db.categories.push(c); save(db); return c;
    }
    if ((r = m(/^\/categories\/(\d+)$/)) && (method === 'PUT' || method === 'DELETE')) {
      needAdmin(db); const c = db.categories.find(x => x.id === +r[1]); if (!c) fail(404, 'Category not found.');
      if (method === 'DELETE') {
        if (db.products.some(p => p.categoryId === c.id)) fail(409, 'Move or delete the products in this category first.');
        db.categories = db.categories.filter(x => x !== c); save(db); return { message: 'Category deleted.' };
      }
      if (!body.name || body.name.trim().length < 2) fail(400, 'Category name is required.');
      Object.assign(c, { name: body.name.trim(), description: body.description ?? c.description, image: body.image || c.image }); save(db); return c;
    }

    // ---------- products ----------
    if (method === 'GET' && path === '/products') {
      let list = db.products.map(p => shape(db, p));
      if (q.search) list = list.filter(p => p.name.toLowerCase().includes(q.search.toLowerCase()));
      if (q.category) list = list.filter(p => String(p.categoryId) === q.category);
      if (q.featured) list = list.filter(p => p.featured);
      const sorts = { price_asc: (a, b) => a.price - b.price, price_desc: (a, b) => b.price - a.price, name_asc: (a, b) => a.name.localeCompare(b.name), name_desc: (a, b) => b.name.localeCompare(a.name) };
      if (sorts[q.sort]) list.sort(sorts[q.sort]);
      return list;
    }
    if (method === 'POST' && path === '/products') {
      needAdmin(db); const d = validateProductInput(db, body, false);
      const p = { unit: 'per kg', description: '', image: IMG + 'tomatoes.svg', available: true, featured: false, lowStockThreshold: 10, ...d, id: db.seq.product++, createdAt: now() };
      db.products.push(p); save(db); return shape(db, p);
    }
    if ((r = m(/^\/products\/(\d+)$/))) {
      const p = db.products.find(x => x.id === +r[1]);
      if (method === 'GET') { if (!p) fail(404, 'Product not found.'); return shape(db, p); }
      needAdmin(db); if (!p) fail(404, 'Product not found.');
      if (method === 'PUT') { Object.assign(p, validateProductInput(db, body, true)); save(db); return shape(db, p); }
      if (method === 'DELETE') { db.products = db.products.filter(x => x !== p); Object.keys(db.carts).forEach(k => db.carts[k] = db.carts[k].filter(i => i.productId !== p.id)); save(db); return { message: 'Product deleted.' }; }
    }

    // ---------- cart ----------
    if (method === 'GET' && path === '/cart') return cartView(db);
    if (method === 'POST' && path === '/cart/items') {
      const p = db.products.find(x => x.id === +body.productId); if (!p) fail(404, 'Product not found.');
      const qty = parseInt(body.quantity, 10) || 1; if (qty < 1) fail(400, 'Quantity must be at least 1.');
      if (p.stock <= 0 || !p.available) fail(409, p.name + ' is out of stock.');
      const key = cartKey(db); db.carts[key] = db.carts[key] || [];
      let ci = db.carts[key].find(i => i.productId === p.id);
      const newQty = (ci ? ci.quantity : 0) + qty;
      if (newQty > p.stock) fail(409, 'Only ' + p.stock + ' of ' + p.name + ' available.');
      if (ci) ci.quantity = newQty; else db.carts[key].push({ id: db.seq.cartItem++, productId: p.id, quantity: qty });
      save(db); return cartView(db);
    }
    if ((r = m(/^\/cart\/items\/(\d+)$/))) {
      const key = cartKey(db); const list = db.carts[key] || []; const ci = list.find(i => i.id === +r[1]); if (!ci) fail(404, 'Cart item not found.');
      if (method === 'PUT') {
        const qty = parseInt(body.quantity, 10); const p = db.products.find(x => x.id === ci.productId);
        if (!(qty >= 1)) fail(400, 'Quantity must be at least 1.');
        if (qty > p.stock) fail(409, 'Only ' + p.stock + ' available.');
        ci.quantity = qty; save(db); return cartView(db);
      }
      if (method === 'DELETE') { db.carts[key] = list.filter(i => i !== ci); save(db); return cartView(db); }
    }

    // ---------- customer profile ----------
    if (method === 'GET' && path === '/users/profile') return pubUser(needUser(db));
    if (method === 'PUT' && path === '/users/profile') {
      const u = needUser(db);
      if (!V.name(body.name || '')) fail(400, 'Enter your full name.');
      if (!V.phone(body.phone || '')) fail(400, 'Enter a valid 10-digit mobile number.');
      if (db.users.some(x => x.id !== u.id && x.phone === body.phone)) fail(409, 'That phone number is already used by another account.');
      u.name = body.name.trim(); u.phone = body.phone; save(db); return pubUser(u);
    }
    if (method === 'PUT' && path === '/users/change-password') {
      const u = needUser(db);
      if (u.passwordHash !== await sha(body.currentPassword || '')) fail(400, 'Current password is incorrect.');
      if (!V.password(body.newPassword || '')) fail(400, 'New password is too weak.');
      if (body.newPassword !== body.confirmPassword) fail(400, 'New passwords do not match.');
      u.passwordHash = await sha(body.newPassword); save(db); return { message: 'Password updated.' };
    }
    if (method === 'GET' && path === '/users/addresses') { const u = needUser(db); return db.addresses.filter(a => a.userId === u.id); }
    if (method === 'POST' && path === '/users/addresses') {
      const u = needUser(db);
      if (!body.line1 || !body.city || !body.state || !V.pin(body.pin || '')) fail(400, 'Fill address, city, state and a valid 6-digit PIN code.');
      const a = { id: db.seq.address++, userId: u.id, label: body.label || 'Home', line1: body.line1, city: body.city, state: body.state, pin: body.pin };
      db.addresses.push(a); save(db); return a;
    }
    if ((r = m(/^\/users\/addresses\/(\d+)$/)) && method === 'DELETE') {
      const u = needUser(db); db.addresses = db.addresses.filter(a => !(a.id === +r[1] && a.userId === u.id)); save(db); return { message: 'Address removed.' };
    }

    // ---------- orders ----------
    if (method === 'POST' && path === '/orders') {
      const u = needUser(db); const b = body || {};
      const cart = db.carts['u' + u.id] || []; if (!cart.length) fail(400, 'Your cart is empty.');
      if (!V.name(b.fullName || '') || !V.phone(b.phone || '') || !V.email(b.email || '')) fail(400, 'Check your name, phone and email.');
      if (!['HOME_DELIVERY', 'STORE_PICKUP'].includes(b.fulfilment)) fail(400, 'Choose home delivery or store pickup.');
      if (!['COD', 'DEMO_UPI', 'DEMO_CARD'].includes(b.paymentMethod)) fail(400, 'Choose a payment method.');
      if (b.fulfilment === 'HOME_DELIVERY' && (!b.address || !b.city || !b.state || !V.pin(b.pin || ''))) fail(400, 'Enter a complete delivery address with a valid PIN code.');
      const items = cart.map(ci => { const p = db.products.find(x => x.id === ci.productId); if (!p) fail(409, 'A product in your cart is no longer available.'); if (ci.quantity > p.stock || !p.available) fail(409, p.name + ' has only ' + p.stock + ' left. Update your cart.'); return { p, qty: ci.quantity }; });
      const subtotal = items.reduce((s, i) => s + i.p.price * i.qty, 0); const t = calcTotals(subtotal, b.fulfilment);
      const d = new Date(); const pad = n => String(n).padStart(2, '0');
      const o = {
        id: db.seq.order++, orderNumber: 'ASS-' + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + String(Math.floor(1000 + Math.random() * 9000)),
        userId: u.id, customerName: b.fullName.trim(), phone: b.phone, email: b.email, fulfilment: b.fulfilment,
        address: b.fulfilment === 'HOME_DELIVERY' ? { line1: b.address, city: b.city, state: b.state, pin: b.pin } : null,
        items: items.map(i => ({ productId: i.p.id, name: i.p.name, unit: i.p.unit, image: i.p.image, price: i.p.price, quantity: i.qty, lineTotal: i.p.price * i.qty })),
        subtotal: t.subtotal, deliveryCharge: t.delivery, discount: t.discount, total: t.total, status: 'Pending',
        payment: { method: b.paymentMethod, status: b.paymentMethod === 'COD' ? 'Pay on delivery' : 'Paid (demo, no real money)' },
        history: [{ status: 'Pending', at: now() }], createdAt: now()
      };
      items.forEach(i => { i.p.stock -= i.qty; });
      db.orders.push(o); db.carts['u' + u.id] = []; save(db); return o;
    }
    if (method === 'GET' && path === '/orders') { const u = needUser(db); return db.orders.filter(o => o.userId === u.id).sort((a, b) => b.id - a.id); }
    if ((r = m(/^\/orders\/(\d+)$/)) && method === 'GET') {
      const u = needUser(db); const o = db.orders.find(x => x.id === +r[1]);
      if (!o || (o.userId !== u.id && u.role !== 'admin')) fail(404, 'Order not found.'); return orderView(db, o);
    }
    if ((r = m(/^\/orders\/(\d+)\/status$/)) && method === 'PUT') {
      const u = needUser(db); const o = db.orders.find(x => x.id === +r[1]); if (!o) fail(404, 'Order not found.');
      if (!ORDER_STATUSES.includes(body.status)) fail(400, 'Invalid status.');
      const cancelByOwner = u.role !== 'admin' && o.userId === u.id && body.status === 'Cancelled' && o.status === 'Pending';
      if (u.role !== 'admin' && !cancelByOwner) fail(403, 'You can only cancel orders that are still pending.');
      if (o.status === 'Cancelled' || o.status === 'Delivered') fail(409, 'This order is already ' + o.status.toLowerCase() + '.');
      if (body.status === 'Cancelled') o.items.forEach(i => { const p = db.products.find(x => x.id === i.productId); if (p) p.stock += i.quantity; });
      o.status = body.status; o.history.push({ status: body.status, at: now() });
      if (body.status === 'Delivered' && o.payment.method === 'COD') o.payment.status = 'Paid (cash collected)';
      save(db); return o;
    }

    // ---------- newsletter ----------
    if (method === 'POST' && path === '/newsletter') {
      if (!V.email(body.email || '')) fail(400, 'Enter a valid email address.');
      if (db.newsletter.includes(body.email.toLowerCase())) fail(409, 'You are already subscribed.');
      db.newsletter.push(body.email.toLowerCase()); save(db); return { message: 'Subscribed.' };
    }

    // ---------- admin ----------
    if (path.startsWith('/admin/')) {
      needAdmin(db);
      const customers = db.users.filter(u => u.role === 'customer');
      const live = db.orders.filter(o => o.status !== 'Cancelled');
      if (method === 'GET' && path === '/admin/dashboard') return {
        totalProducts: db.products.length, totalCustomers: customers.length, totalOrders: db.orders.length,
        totalRevenue: live.reduce((s, o) => s + o.total, 0), pendingOrders: db.orders.filter(o => o.status === 'Pending').length,
        lowStockProducts: db.products.filter(p => p.stock <= p.lowStockThreshold).map(p => shape(db, p)),
        recentOrders: [...db.orders].sort((a, b) => b.id - a.id).slice(0, 5)
      };
      if (method === 'GET' && path === '/admin/customers') return customers.map(u => ({ ...pubUser(u), orderCount: db.orders.filter(o => o.userId === u.id).length, totalSpent: db.orders.filter(o => o.userId === u.id && o.status !== 'Cancelled').reduce((s, o) => s + o.total, 0) }));
      if ((r = m(/^\/admin\/customers\/(\d+)$/)) && method === 'GET') { const u = customers.find(x => x.id === +r[1]); if (!u) fail(404, 'Customer not found.'); return { ...pubUser(u), orders: db.orders.filter(o => o.userId === u.id).sort((a, b) => b.id - a.id) }; }
      if (method === 'GET' && path === '/admin/orders') return [...db.orders].sort((a, b) => b.id - a.id);
      if (method === 'GET' && path === '/admin/inventory') return db.products.map(p => shape(db, p));
      if ((r = m(/^\/admin\/inventory\/(\d+)$/)) && method === 'PUT') {
        const p = db.products.find(x => x.id === +r[1]); if (!p) fail(404, 'Product not found.');
        Object.assign(p, validateProductInput(db, { stock: body.stock, lowStockThreshold: body.lowStockThreshold }, true)); save(db); return shape(db, p);
      }
    }
    fail(404, 'Endpoint not found: ' + method + ' ' + path);
  }
  return { handle, init };
})();
