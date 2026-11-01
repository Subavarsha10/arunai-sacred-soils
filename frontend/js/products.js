/* products.js - home page categories/featured, product listing, product details */
document.addEventListener('DOMContentLoaded', () => {
  if ($('#category-grid')) loadHomeCategories();
  if ($('#featured-grid')) loadFeatured();
  if ($('#product-grid')) initListing();
  if ($('#product-detail')) loadDetail();
});

const skeletons = n => Array.from({ length: n }, () => '<div class="skeleton"></div>').join('');
const errBox = (msg, retry) => `<div class="empty"><h3>Something went wrong</h3><p>${esc(msg)}</p>${retry ? `<button class="btn btn-sm mt" data-retry="${retry}">Try again</button>` : ''}</div>`;
document.addEventListener('click', e => { const b = e.target.closest('[data-retry]'); if (!b) return; ({ loadHomeCategories, loadFeatured, reload: () => location.reload() })[b.dataset.retry](); });

async function loadHomeCategories() {
  const grid = $('#category-grid'); grid.innerHTML = skeletons(6);
  try {
    const cats = await api('GET', '/categories');
    grid.innerHTML = cats.map(c => `<a class="category-card" href="${PG}products.html?category=${c.id}">
      <div class="thumb">${imgTag(c.image, c.name)}</div>
      <div class="body"><h3>${esc(c.name)}</h3><p>${esc(c.description)}</p><span class="text-link">Explore products</span></div></a>`).join('');
  } catch (e) { grid.innerHTML = errBox(e.message, 'loadHomeCategories'); }
}
async function loadFeatured() {
  const grid = $('#featured-grid'); grid.innerHTML = skeletons(4);
  try { const list = await api('GET', '/products?featured=true'); grid.innerHTML = list.map(productCard).join(''); }
  catch (e) { grid.innerHTML = errBox(e.message, 'loadFeatured'); }
}

function initListing() {
  const search = $('#f-search'), cat = $('#f-category'), sort = $('#f-sort'), grid = $('#product-grid'), count = $('#result-count');
  const qp = params(); if (qp.get('search')) search.value = qp.get('search'); if (qp.get('sort')) sort.value = qp.get('sort');
  async function load() {
    grid.innerHTML = skeletons(8);
    const q = new URLSearchParams(); if (search.value.trim()) q.set('search', search.value.trim()); if (cat.value) q.set('category', cat.value); if (sort.value) q.set('sort', sort.value);
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : ''));
    try {
      const list = await api('GET', '/products?' + q);
      count.textContent = list.length + (list.length === 1 ? ' product' : ' products');
      grid.innerHTML = list.length ? list.map(productCard).join('') : `<div class="empty" style="grid-column:1/-1"><h3>No products found</h3><p>Try a different name, or clear the category filter.</p><button class="btn btn-sm mt" id="clear-f">Clear filters</button></div>`;
      const c = $('#clear-f'); if (c) c.onclick = () => { search.value = ''; cat.value = ''; sort.value = ''; load(); };
    } catch (e) { grid.innerHTML = errBox(e.message, 'reload'); }
  }
  let t; search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 250); });
  cat.addEventListener('change', load); sort.addEventListener('change', load);
  api('GET', '/categories').then(cs => { cat.innerHTML = '<option value="">All categories</option>' + cs.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join(''); if (qp.get('category')) cat.value = qp.get('category'); load(); })
    .catch(e => { grid.innerHTML = errBox(e.message, 'reload'); });
}

async function loadDetail() {
  const box = $('#product-detail'); const id = params().get('id');
  if (!id) { box.innerHTML = errBox('No product selected.'); return; }
  box.innerHTML = skeletons(1);
  try {
    const p = await api('GET', '/products/' + encodeURIComponent(id));
    document.title = p.name + ' | Arunai Sacred Soils'; $('#crumb-name').textContent = p.name;
    const out = p.availability === 'Out of Stock', cls = out ? 'out' : p.availability === 'Low Stock' ? 'low' : 'in';
    let qty = 1;
    box.innerHTML = `<div class="detail"><div class="detail-img">${imgTag(p.image, p.name)}</div><div>
      <a class="text-link" href="${PG}products.html?category=${p.categoryId}">${esc(p.categoryName)}</a><h1>${esc(p.name)}</h1>
      <span class="badge ${cls}">${esc(p.availability)}</span>
      <div class="price">${rupee(p.price)} <small>${esc(p.unit)}</small></div><p class="desc">${esc(p.description)}</p>
      <ul class="meta-list"><li><b>Product ID:</b> ASS-${String(p.id).padStart(4, '0')}</li><li><b>Stock:</b> ${out ? 'None available right now' : p.stock + ' available'}</li><li><b>Delivery:</b> Free above ${rupee(PRICING.freeDeliveryAbove)}, or pick up at our store.</li></ul>
      <div class="buy-row"><div class="qty"><button id="q-minus" aria-label="Decrease quantity" ${out ? 'disabled' : ''}>−</button><span id="q-val">1</span><button id="q-plus" aria-label="Increase quantity" ${out ? 'disabled' : ''}>+</button></div>
      <button class="btn" id="add-btn" ${out ? 'disabled' : ''}>${out ? 'Out of stock' : 'Add to cart'}</button></div></div></div>`;
    if (!out) {
      $('#q-minus').onclick = () => { qty = Math.max(1, qty - 1); $('#q-val').textContent = qty; };
      $('#q-plus').onclick = () => { if (qty < p.stock) qty++; else toast('Only ' + p.stock + ' in stock.', 'error'); $('#q-val').textContent = qty; };
      $('#add-btn').onclick = async e => { e.target.disabled = true; await addToCart(p.id, qty); e.target.disabled = false; };
    }
    const rel = (await api('GET', '/products?category=' + p.categoryId)).filter(x => x.id !== p.id).slice(0, 4);
    if (rel.length) { $('#related-wrap').classList.remove('hidden'); $('#related-grid').innerHTML = rel.map(productCard).join(''); }
  } catch (e) { box.innerHTML = errBox(e.status === 404 ? 'This product could not be found.' : e.message); }
}
