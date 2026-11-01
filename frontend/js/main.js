/* main.js - shared helpers, validators, header/footer, cart badge, newsletter. Loaded on every page. */
const IN_PAGES = location.pathname.includes('/pages/');
const ROOT = IN_PAGES ? '../' : './';
const PG = IN_PAGES ? '' : 'pages/';                       // prefix to reach /pages from the current page
const ORDER_STATUSES = ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];
const PRICING = { freeDeliveryAbove: 500, deliveryCharge: 40, discountAbove: 1000, discountRate: 0.05 };
const PAY_LABEL = { COD: 'Cash on Delivery', DEMO_UPI: 'UPI (demo payment)', DEMO_CARD: 'Card (demo payment)' };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rupee = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const imgSrc = s => !s ? ROOT + 'assets/icons/leaf.svg'
  : /^(data:|https?:)/.test(s) ? s
  : (/^uploads\//.test(s) && !CONFIG.USE_MOCK) ? CONFIG.API_BASE.replace(/\/api$/, '') + '/' + s   // admin uploads are served by the backend
  : ROOT + s;
const imgTag = (s, alt, cls = '') => `<img class="${cls}" src="${esc(imgSrc(s))}" alt="${esc(alt)}" loading="lazy">`;
// broken image -> brand leaf icon (one global listener instead of inline onerror, so a strict CSP works)
document.addEventListener('error', e => { const i = e.target; if (i && i.tagName === 'IMG' && !i.dataset.fb) { i.dataset.fb = '1'; i.src = ROOT + 'assets/icons/leaf.svg'; } }, true);
const fmtDate = d => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const params = () => new URLSearchParams(location.search);

const V = {
  name: v => v.trim().length >= 2,
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
  phone: v => /^[6-9]\d{9}$/.test(v),
  pin: v => /^[1-9]\d{5}$/.test(v),
  password: v => v.length >= 8 && /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v),
  strength: v => [v.length >= 8, /[a-z]/.test(v), /[A-Z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length
};
function calcTotals(subtotal, fulfilment) {
  const delivery = fulfilment === 'HOME_DELIVERY' && subtotal > 0 && subtotal < PRICING.freeDeliveryAbove ? PRICING.deliveryCharge : 0;
  const discount = subtotal >= PRICING.discountAbove ? Math.round(subtotal * PRICING.discountRate) : 0;
  return { subtotal, delivery, discount, total: subtotal + delivery - discount };
}

/* ---------- form helpers ---------- */
function setErr(input, msg) {
  const f = input.closest('.field'); if (!f) return;
  f.classList.toggle('invalid', !!msg);
  let e = f.querySelector('.err');
  if (msg) { if (!e) { e = document.createElement('small'); e.className = 'err'; f.appendChild(e); } e.textContent = msg; } else if (e) e.remove();
}
/* rules: { fieldName: [testFn(value, form), 'message'] } -> returns true when all pass */
function validate(form, rules) {
  let ok = true, first = null;
  Object.entries(rules).forEach(([name, [fn, msg]]) => {
    const el = form.elements[name]; if (!el) return;
    const bad = !fn((el.value || '').toString(), form);
    setErr(el, bad ? msg : ''); if (bad) { ok = false; first = first || el; }
  });
  if (first) first.focus();
  return ok;
}
function showAlert(box, type, msg) { if (!box) return; box.className = 'alert ' + type; box.textContent = msg; box.classList.remove('hidden'); }
function toast(msg, type = '') {
  let root = $('#toast-root'); if (!root) { root = document.createElement('div'); root.id = 'toast-root'; document.body.appendChild(root); }
  const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; t.setAttribute('role', 'status'); root.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
function modal(html, onMount) {
  const back = document.createElement('div'); back.className = 'modal-back';
  back.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => back.remove();
  back.addEventListener('click', e => { if (e.target === back || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', k); } });
  document.body.appendChild(back); onMount && onMount(back, close); return close;
}
function statusBadge(s) { return `<span class="status ${esc(s)}">${esc(s)}</span>`; }

/* ---------- session ---------- */
async function requireAuth(role) {
  if (!Auth.token) { location.href = PG + 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search); return null; }
  try {
    const { user } = await api('GET', '/auth/me'); localStorage.setItem('ass_user', JSON.stringify(user));
    if (role && user.role !== role) { toast('You do not have access to that page.', 'error'); setTimeout(() => location.href = ROOT + 'index.html', 900); return null; }
    return user;
  } catch (e) { Auth.clear(); location.href = PG + 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop()); return null; }
}
async function logout(redirect = ROOT + 'index.html') { try { await api('POST', '/auth/logout'); } catch (e) { /* token may already be invalid */ } Auth.clear(); location.href = redirect; }

/* ---------- cart badge + add to cart ---------- */
async function refreshCartCount() {
  const b = $('#cart-count'); if (!b) return;
  try { const c = await api('GET', '/cart'); b.textContent = c.itemCount; b.classList.toggle('hidden', !c.itemCount); } catch (e) { b.classList.add('hidden'); }
}
async function addToCart(productId, quantity = 1) {
  try { await api('POST', '/cart/items', { productId, quantity }); toast('Added to your cart.'); refreshCartCount(); return true; }
  catch (e) {
    if (e.status === 401) { toast('Please log in to add items to your cart.', 'error'); setTimeout(() => location.href = PG + 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search), 900); }
    else toast(e.message, 'error');
    return false;
  }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-add]'); if (!b || b.disabled) return;
  b.disabled = true; addToCart(+b.dataset.add, 1).finally(() => { b.disabled = false; });
});

/* ---------- product card (used by home + listing + related) ---------- */
function productCard(p) {
  const out = p.availability === 'Out of Stock';
  const cls = out ? 'out' : p.availability === 'Low Stock' ? 'low' : 'in';
  return `<article class="product-card">
    <a class="thumb" href="${PG}product-details.html?id=${p.id}" aria-label="View ${esc(p.name)}">${imgTag(p.image, p.name)}<span class="badge ${cls}">${esc(p.availability)}${p.availability === 'Low Stock' ? ' (' + p.stock + ' left)' : ''}</span></a>
    <div class="body"><span class="cat">${esc(p.categoryName)}</span>
      <h3><a href="${PG}product-details.html?id=${p.id}">${esc(p.name)}</a></h3>
      <div class="row"><span class="price">${rupee(p.price)} <small>${esc(p.unit)}</small></span></div>
      <button class="btn btn-sm" data-add="${p.id}" ${out ? 'disabled' : ''}>${out ? 'Out of stock' : 'Add to cart'}</button>
    </div></article>`;
}

/* ---------- header / footer ---------- */
function renderChrome() {
  const a = $('#announce'); if (a) { a.className = 'announce'; a.textContent = 'Fresh from Nature, Delivered with Care ✨ Quality You Can Trust'; }
  const here = location.pathname.split('/').pop() || 'index.html';
  const u = Auth.user;
  const link = (href, label, key) => `<a href="${href}" class="${here === key ? 'active' : ''}">${label}</a>`;
  const h = $('#site-header');
  if (h) {
    h.className = 'site-header';
    h.innerHTML = `<div class="container nav">
      <a class="brand" href="${ROOT}index.html" aria-label="Arunai Sacred Soils home"><img src="${ROOT}assets/images/logo.jpg" alt="Arunai Sacred Soils"></a>
      <nav class="nav-links" id="nav-links" aria-label="Main">
        ${link(ROOT + 'index.html', 'Home', 'index.html')}${link(ROOT + 'index.html#categories', 'Categories', '#')}
        ${link(PG + 'products.html', 'Products', 'products.html')}${link(ROOT + 'index.html#about', 'About Us', '#')}${link(ROOT + 'index.html#contact', 'Contact', '#')}
      </nav>
      <div class="nav-actions">
        ${u ? `${u.role === 'admin' ? `<a class="link hide-sm" href="${PG}admin.html">Admin</a>` : `<a class="link" href="${PG}account.html">My Account</a>`}<a class="link hide-sm" href="#" id="logout-link">Logout</a>`
            : `<a class="link" href="${PG}login.html">Login</a><a class="btn btn-sm hide-sm" href="${PG}register.html" style="color:#fff">Register</a>`}
        <a class="cart-link" href="${PG}cart.html" aria-label="Shopping cart"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.3a1 1 0 0 0 1-.8L19.5 8H6"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/></svg><span class="cart-badge hidden" id="cart-count">0</span></a>
        <button class="menu-toggle" id="menu-toggle" aria-label="Open menu" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
      </div></div>`;
    $('#menu-toggle').addEventListener('click', e => { const n = $('#nav-links'); const open = n.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', open); });
    const lo = $('#logout-link'); if (lo) lo.addEventListener('click', e => { e.preventDefault(); logout(); });
  }
  const f = $('#site-footer');
  if (f) {
    f.className = 'footer'; f.id = 'contact';
    f.innerHTML = `<div class="container"><div class="footer-grid">
      <div><img class="flogo" src="${ROOT}assets/images/logo.jpg" alt="Arunai Sacred Soils"><p>Fresh farm produce, natural oils, honey, eggs, grains and millets, brought to your home with care.</p>
        <div class="socials"><a href="https://facebook.com" target="_blank" rel="noopener" aria-label="Facebook">f</a><a href="https://instagram.com" target="_blank" rel="noopener" aria-label="Instagram">ig</a><a href="https://wa.me/918618738007" target="_blank" rel="noopener" aria-label="WhatsApp">wa</a></div></div>
      <div><h4>Quick links</h4><ul><li><a href="${ROOT}index.html">Home</a></li><li><a href="${PG}products.html">All products</a></li><li><a href="${ROOT}index.html#categories">Categories</a></li><li><a href="${ROOT}index.html#about">About us</a></li></ul></div>
      <div><h4>Customer support</h4><ul><li><a href="${PG}account.html">My account</a></li><li><a href="${PG}orders.html">My orders</a></li><li><a href="${PG}cart.html">Cart</a></li></ul></div>
      <div><h4>Contact</h4><p>Phone: <a href="tel:+918618738007">+91 86187 38007</a><br>Email: <a href="mailto:arunaisacredsoils@gmail.com">arunaisacredsoils@gmail.com</a><br>Store: Kaikondrahalli, Bengaluru, Karnataka - 560035<br>Hours: Monday - Friday, 9:00 AM - 5:30 PM</p></div>
    </div><p class="copy">© ${new Date().getFullYear()} Arunai Sacred Soils. All rights reserved.</p></div>`;
  }
}

/* ---------- newsletter ---------- */
function initNewsletter() {
  const form = $('#newsletter-form'); if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault(); const email = form.elements.email;
    if (!validate(form, { email: [V.email, 'Enter a valid email address.'] })) return;
    try { await api('POST', '/newsletter', { email: email.value.trim() }); toast('Thanks for subscribing!'); form.reset(); }
    catch (err) { setErr(email, err.message); }
  });
}

document.addEventListener('DOMContentLoaded', () => { renderChrome(); refreshCartCount(); initNewsletter(); });
