/* admin.js - admin login + dashboard (products, categories, orders, customers, inventory) */
let CATS = [], PRODS = [];
const SECTIONS = { dashboard: 'Dashboard', products: 'Products', categories: 'Categories', orders: 'Orders', customers: 'Customers', inventory: 'Inventory' };

document.addEventListener('DOMContentLoaded', async () => {
  if (!$('#admin-app')) return;
  if (Auth.token) { try { const { user } = await api('GET', '/auth/me'); if (user.role === 'admin') return startApp(); } catch (e) { Auth.clear(); } }
  $('#admin-login').classList.remove('hidden');
  const f = $('#admin-login-form'), box = $('#admin-login-alert');
  f.addEventListener('submit', async e => {
    e.preventDefault(); box.classList.add('hidden');
    if (!validate(f, { email: [V.email, 'Enter a valid email address.'], password: [v => v.length > 0, 'Enter your password.'] })) return;
    try {
      const { token, user } = await api('POST', '/auth/login', { email: f.elements.email.value.trim(), password: f.elements.password.value });
      if (user.role !== 'admin') { try { Auth.set(token, user); await api('POST', '/auth/logout'); } catch (x) { /* ignore */ } Auth.clear(); throw new Error('This account is not an administrator.'); }
      Auth.set(token, user); startApp();
    } catch (err) { showAlert(box, 'error', err.message); }
  });
});

function startApp() {
  $('#admin-login').classList.add('hidden'); $('#admin-shell').classList.remove('hidden');
  $$('[data-sec]').forEach(b => b.addEventListener('click', () => go(b.dataset.sec)));
  $('#admin-logout').onclick = () => logout('admin.html');
  go(location.hash.slice(1) in SECTIONS ? location.hash.slice(1) : 'dashboard');
}
async function go(sec) {
  $$('[data-sec]').forEach(b => b.classList.toggle('active', b.dataset.sec === sec));
  $('#admin-title').textContent = SECTIONS[sec]; history.replaceState(null, '', '#' + sec);
  const main = $('#admin-content'); main.innerHTML = '<div class="skeleton" style="height:180px"></div>';
  try { await RENDER[sec](main); } catch (e) { main.innerHTML = `<div class="empty"><h3>Could not load ${SECTIONS[sec].toLowerCase()}</h3><p>${esc(e.message)}</p></div>`; }
}
const table = (heads, rows) => `<div class="table-wrap"><table class="table"><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${heads.length}" class="muted center">Nothing to show yet.</td></tr>`}</tbody></table></div>`;
const loadRef = async () => { [CATS, PRODS] = await Promise.all([api('GET', '/categories'), api('GET', '/products')]); };

const RENDER = {
  async dashboard(main) {
    const d = await api('GET', '/admin/dashboard');
    main.innerHTML = `<div class="stat-grid">
      <div class="stat"><span>Total products</span><strong>${d.totalProducts}</strong></div><div class="stat"><span>Total customers</span><strong>${d.totalCustomers}</strong></div><div class="stat"><span>Total orders</span><strong>${d.totalOrders}</strong></div>
      <div class="stat"><span>Total revenue (excl. cancelled)</span><strong>${rupee(d.totalRevenue)}</strong></div><div class="stat warn"><span>Low stock products</span><strong>${d.lowStockProducts.length}</strong></div><div class="stat warn"><span>Pending orders</span><strong>${d.pendingOrders}</strong></div></div>
      <div class="card-block"><h2>Low stock alerts</h2>${d.lowStockProducts.length ? table(['Product', 'Stock', 'Threshold', 'Status'], d.lowStockProducts.map(p => `<tr><td>${esc(p.name)}</td><td>${p.stock}</td><td>${p.lowStockThreshold}</td><td><span class="badge ${p.stock <= 0 ? 'out' : 'low'}">${esc(p.availability)}</span></td></tr>`)) : '<p class="muted">All products are well stocked.</p>'}</div>
      <div class="card-block"><h2>Recent orders</h2>${table(['Order', 'Customer', 'Total', 'Status'], d.recentOrders.map(o => `<tr><td><b>${esc(o.orderNumber)}</b></td><td>${esc(o.customerName)}</td><td>${rupee(o.total)}</td><td>${statusBadge(o.status)}</td></tr>`))}</div>`;
  },
  async products(main) {
    await loadRef();
    main.innerHTML = `<div class="card-block"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h2 style="margin:0">All products (${PRODS.length})</h2><button class="btn btn-sm" id="add-product">Add product</button></div>
      ${table(['Image', 'Name', 'Category', 'Price', 'Stock', 'Status', 'Actions'], PRODS.map(p => `<tr><td>${imgTag(p.image, p.name, 'thumb-sm')}</td><td><b>${esc(p.name)}</b><br><small class="muted">ID ${p.id}</small></td><td>${esc(p.categoryName)}</td><td>${rupee(p.price)}<br><small class="muted">${esc(p.unit)}</small></td><td>${p.stock}</td><td><span class="badge ${p.availability === 'In Stock' ? 'in' : p.availability === 'Low Stock' ? 'low' : 'out'}">${esc(p.availability)}</span></td>
      <td><div class="row-actions"><button class="btn btn-outline btn-sm" data-edit="${p.id}">Edit</button><button class="btn btn-danger btn-sm" data-del="${p.id}">Delete</button></div></td></tr>`))}</div>`;
    $('#add-product').onclick = () => productForm();
    main.onclick = async e => {
      const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
      if (ed) productForm(PRODS.find(p => p.id === +ed.dataset.edit));
      if (del && confirm('Delete this product? This cannot be undone.')) { try { await api('DELETE', '/products/' + del.dataset.del); toast('Product deleted.'); go('products'); } catch (err) { toast(err.message, 'error'); } }
    };
  },
  async categories(main) {
    CATS = await api('GET', '/categories');
    main.innerHTML = `<div class="card-block"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h2 style="margin:0">Categories (${CATS.length})</h2><button class="btn btn-sm" id="add-cat">Add category</button></div>
      ${table(['Image', 'Name', 'Description', 'Products', 'Actions'], CATS.map(c => `<tr><td>${imgTag(c.image, c.name, 'thumb-sm')}</td><td><b>${esc(c.name)}</b></td><td>${esc(c.description)}</td><td>${c.productCount}</td><td><div class="row-actions"><button class="btn btn-outline btn-sm" data-edit="${c.id}">Edit</button><button class="btn btn-danger btn-sm" data-del="${c.id}">Delete</button></div></td></tr>`))}</div>`;
    $('#add-cat').onclick = () => categoryForm();
    main.onclick = async e => {
      const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
      if (ed) categoryForm(CATS.find(c => c.id === +ed.dataset.edit));
      if (del && confirm('Delete this category?')) { try { await api('DELETE', '/categories/' + del.dataset.del); toast('Category deleted.'); go('categories'); } catch (err) { toast(err.message, 'error'); } }
    };
  },
  async orders(main) {
    const orders = await api('GET', '/admin/orders');
    main.innerHTML = `<div class="card-block"><h2>All orders (${orders.length})</h2>${table(['Order', 'Customer', 'Date', 'Total', 'Payment', 'Status', ''], orders.map(o => `<tr><td><b>${esc(o.orderNumber)}</b></td><td>${esc(o.customerName)}<br><small class="muted">${esc(o.phone)}</small></td><td>${fmtDate(o.createdAt)}</td><td>${rupee(o.total)}</td><td>${esc(o.payment.status)}</td>
      <td><select class="select-sm" data-status="${o.id}" ${['Cancelled', 'Delivered'].includes(o.status) ? 'disabled' : ''}>${ORDER_STATUSES.map(s => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td><td><button class="btn btn-outline btn-sm" data-view="${o.id}">Details</button></td></tr>`))}</div>`;
    main.onchange = async e => { const s = e.target.closest('[data-status]'); if (!s) return; try { await api('PUT', `/orders/${s.dataset.status}/status`, { status: s.value }); toast('Order status updated.'); go('orders'); } catch (err) { toast(err.message, 'error'); go('orders'); } };
    main.onclick = e => { const v = e.target.closest('[data-view]'); if (v) orderModal(orders.find(o => o.id === +v.dataset.view)); };
  },
  async customers(main) {
    const list = await api('GET', '/admin/customers');
    main.innerHTML = `<div class="card-block"><h2>Registered customers (${list.length})</h2>${table(['Name', 'Email', 'Phone', 'Joined', 'Orders', 'Spent', ''], list.map(c => `<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.email)}</td><td>${esc(c.phone)}</td><td>${new Date(c.createdAt).toLocaleDateString('en-IN')}</td><td>${c.orderCount}</td><td>${rupee(c.totalSpent)}</td><td><button class="btn btn-outline btn-sm" data-view="${c.id}">View</button></td></tr>`))}</div>`;
    main.onclick = async e => {
      const v = e.target.closest('[data-view]'); if (!v) return;
      try {
        const c = await api('GET', '/admin/customers/' + v.dataset.view);
        modal(`<h3>${esc(c.name)}</h3><p class="muted">${esc(c.email)} · ${esc(c.phone)}<br>Joined ${fmtDate(c.createdAt)}</p><h4 style="margin:16px 0 8px">Order history</h4>${table(['Order', 'Date', 'Total', 'Status'], c.orders.map(o => `<tr><td>${esc(o.orderNumber)}</td><td>${fmtDate(o.createdAt)}</td><td>${rupee(o.total)}</td><td>${statusBadge(o.status)}</td></tr>`))}<div class="modal-actions"><button class="btn btn-outline" data-close>Close</button></div>`);
      } catch (err) { toast(err.message, 'error'); }
    };
  },
  async inventory(main) {
    const list = await api('GET', '/admin/inventory'); const low = list.filter(p => p.stock <= p.lowStockThreshold);
    main.innerHTML = `${low.length ? `<div class="alert error"><b>${low.length} product${low.length > 1 ? 's' : ''} need restocking:</b> ${low.map(p => esc(p.name)).join(', ')}.</div>` : '<div class="alert success">All products are above their low-stock threshold.</div>'}
      <div class="card-block"><h2>Inventory</h2>${table(['Product', 'Status', 'Stock', 'Low-stock threshold', ''], list.map(p => `<tr><td><b>${esc(p.name)}</b><br><small class="muted">${esc(p.unit)}</small></td><td><span class="badge ${p.availability === 'In Stock' ? 'in' : p.availability === 'Low Stock' ? 'low' : 'out'}">${esc(p.availability)}</span></td>
      <td><input class="inline-input" type="number" min="0" step="1" value="${p.stock}" data-stock="${p.id}" aria-label="Stock for ${esc(p.name)}"></td><td><input class="inline-input" type="number" min="0" step="1" value="${p.lowStockThreshold}" data-thr="${p.id}" aria-label="Threshold for ${esc(p.name)}"></td><td><button class="btn btn-sm" data-save="${p.id}">Save</button></td></tr>`))}</div>`;
    main.onclick = async e => {
      const b = e.target.closest('[data-save]'); if (!b) return; const id = b.dataset.save;
      try { await api('PUT', '/admin/inventory/' + id, { stock: $(`[data-stock="${id}"]`).value, lowStockThreshold: $(`[data-thr="${id}"]`).value }); toast('Inventory updated.'); go('inventory'); } catch (err) { toast(err.message, 'error'); }
    };
  }
};

function orderModal(o) {
  modal(`<h3>${esc(o.orderNumber)}</h3><p>${statusBadge(o.status)} <span class="muted">${fmtDate(o.createdAt)}</span></p>
    <p style="margin-top:12px"><b>${esc(o.customerName)}</b><br><span class="muted">${esc(o.phone)} · ${esc(o.email)}</span></p>
    <p style="margin-top:10px"><b>${o.fulfilment === 'HOME_DELIVERY' ? 'Home delivery' : 'Store pickup'}</b><br><span class="muted">${o.address ? esc(o.address.line1) + ', ' + esc(o.address.city) + ', ' + esc(o.address.state) + ' - ' + esc(o.address.pin) : 'Customer collects from the store.'}</span></p>
    <h4 style="margin:16px 0 8px">Items</h4>${table(['Product', 'Qty', 'Price', 'Total'], o.items.map(i => `<tr><td>${esc(i.name)}</td><td>${i.quantity}</td><td>${rupee(i.price)}</td><td>${rupee(i.lineTotal)}</td></tr>`))}
    <div class="sum-row"><span>Subtotal</span><span>${rupee(o.subtotal)}</span></div><div class="sum-row"><span>Delivery</span><span>${rupee(o.deliveryCharge)}</span></div><div class="sum-row"><span>Discount</span><span>− ${rupee(o.discount)}</span></div><div class="sum-row total"><span>Total</span><span>${rupee(o.total)}</span></div>
    <p class="muted" style="margin-top:8px">Payment: ${esc(PAY_LABEL[o.payment.method] || o.payment.method)} · ${esc(o.payment.status)}</p><div class="modal-actions"><button class="btn btn-outline" data-close>Close</button></div>`);
}

function readImage(input, preview) {
  input.addEventListener('change', () => {
    const file = input.files[0]; if (!file) return;
    if (!(CONFIG.USE_MOCK ? /^image\/(png|jpe?g|webp|gif|svg\+xml)$/ : /^image\/(png|jpe?g|webp|gif)$/).test(file.type)) { toast('Choose a PNG, JPG, WEBP or GIF image.', 'error'); input.value = ''; return; }
    if (file.size > (CONFIG.USE_MOCK ? 300 * 1024 : 2 * 1024 * 1024)) { toast('Image is too large (max ' + (CONFIG.USE_MOCK ? '300 KB in demo mode' : '2 MB') + ').', 'error'); input.value = ''; return; }
    const r = new FileReader(); r.onload = () => { preview.src = r.result; preview.dataset.changed = '1'; preview.classList.remove('hidden'); }; r.readAsDataURL(file);
  });
}
function productForm(p) {
  const editing = !!p; p = p || { name: '', categoryId: CATS[0] && CATS[0].id, price: '', unit: 'per kg', stock: 0, lowStockThreshold: 10, description: '', available: true, featured: false, image: '' };
  modal(`<h3>${editing ? 'Edit product' : 'Add product'}</h3><form id="pform" novalidate>
    <div class="field"><label>Product name</label><input name="name" value="${esc(p.name)}"></div>
    <div class="form-row"><div class="field"><label>Category</label><select name="categoryId">${CATS.map(c => `<option value="${c.id}" ${c.id === p.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Unit</label><input name="unit" value="${esc(p.unit)}" placeholder="per kg"></div></div>
    <div class="form-row"><div class="field"><label>Price (₹)</label><input name="price" type="number" min="0" step="0.01" value="${p.price}"></div><div class="field"><label>Stock quantity</label><input name="stock" type="number" min="0" step="1" value="${p.stock}"></div></div>
    <div class="form-row"><div class="field"><label>Low-stock threshold</label><input name="lowStockThreshold" type="number" min="0" step="1" value="${p.lowStockThreshold}"></div><div class="field"><label>Availability</label><select name="available"><option value="1" ${p.available ? 'selected' : ''}>Available for sale</option><option value="0" ${!p.available ? 'selected' : ''}>Hidden / unavailable</option></select></div></div>
    <div class="field"><label>Description</label><textarea name="description" rows="3">${esc(p.description)}</textarea></div>
    <div class="field"><label>Product image</label><input type="file" name="imageFile" accept="image/*"><img class="img-preview ${p.image ? '' : 'hidden'}" id="img-prev" alt="Preview" src="${p.image ? esc(imgSrc(p.image)) : ''}"></div>
    <label class="choice" style="margin-bottom:6px"><input type="checkbox" name="featured" ${p.featured ? 'checked' : ''}><span>Show on the homepage as featured</span></label>
    <div class="alert error hidden" id="pform-alert" style="margin-top:12px"></div>
    <div class="modal-actions"><button type="button" class="btn btn-outline" data-close>Cancel</button><button class="btn" type="submit">${editing ? 'Save changes' : 'Add product'}</button></div></form>`, (back, close) => {
    const f = $('#pform', back), prev = $('#img-prev', back); readImage(f.elements.imageFile, prev);
    f.addEventListener('submit', async e => {
      e.preventDefault();
      if (!validate(f, { name: [V.name, 'Enter a product name.'], price: [v => +v > 0, 'Price must be above zero.'], stock: [v => /^\d+$/.test(v), 'Stock must be a whole number.'], unit: [v => v.trim().length > 0, 'Enter a unit.'] })) return;
      const body = { name: f.elements.name.value.trim(), categoryId: +f.elements.categoryId.value, unit: f.elements.unit.value.trim(), price: +f.elements.price.value, stock: +f.elements.stock.value, lowStockThreshold: +f.elements.lowStockThreshold.value, available: f.elements.available.value === '1', description: f.elements.description.value.trim(), featured: f.elements.featured.checked };
      if (prev.dataset.changed) body.image = prev.src; else if (!editing) body.image = 'assets/images/products/tomatoes.svg';
      try { await api(editing ? 'PUT' : 'POST', editing ? '/products/' + p.id : '/products', body); toast(editing ? 'Product updated.' : 'Product added.'); close(); go('products'); }
      catch (err) { showAlert($('#pform-alert', back), 'error', err.message); }
    });
  });
}
function categoryForm(c) {
  const editing = !!c; c = c || { name: '', description: '', image: '' };
  modal(`<h3>${editing ? 'Edit category' : 'Add category'}</h3><form id="cform" novalidate><div class="field"><label>Name</label><input name="name" value="${esc(c.name)}"></div><div class="field"><label>Description</label><textarea name="description" rows="3">${esc(c.description)}</textarea></div>
    <div class="field"><label>Category image</label><input type="file" name="imageFile" accept="image/*"><img class="img-preview ${c.image ? '' : 'hidden'}" id="img-prev" alt="Preview" src="${c.image ? esc(imgSrc(c.image)) : ''}"></div>
    <div class="alert error hidden" id="cform-alert"></div><div class="modal-actions"><button type="button" class="btn btn-outline" data-close>Cancel</button><button class="btn" type="submit">${editing ? 'Save changes' : 'Add category'}</button></div></form>`, (back, close) => {
    const f = $('#cform', back), prev = $('#img-prev', back); readImage(f.elements.imageFile, prev);
    f.addEventListener('submit', async e => {
      e.preventDefault(); if (!validate(f, { name: [V.name, 'Enter a category name.'] })) return;
      const body = { name: f.elements.name.value.trim(), description: f.elements.description.value.trim() }; if (prev.dataset.changed) body.image = prev.src;
      try { await api(editing ? 'PUT' : 'POST', editing ? '/categories/' + c.id : '/categories', body); toast('Category saved.'); close(); go('categories'); }
      catch (err) { showAlert($('#cform-alert', back), 'error', err.message); }
    });
  });
}
