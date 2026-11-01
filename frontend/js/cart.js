/* cart.js - shopping cart page */
document.addEventListener('DOMContentLoaded', () => { if ($('#cart-items')) loadCart(); });

async function loadCart() {
  const list = $('#cart-items'), sum = $('#cart-summary');
  try { renderCart(await api('GET', '/cart')); }
  catch (e) {
    list.innerHTML = e.status === 401 ? `<div class="empty"><h3>Log in to see your cart</h3><p>Your cart is saved to your account.</p><a class="btn mt" href="login.html?next=cart.html">Log in</a></div>` : `<div class="empty"><h3>Could not load your cart</h3><p>${esc(e.message)}</p></div>`;
    sum.classList.add('hidden');
  }
}
function renderCart(c) {
  const list = $('#cart-items'), sum = $('#cart-summary');
  $('#cart-heading').textContent = c.itemCount ? `Your cart (${c.itemCount} ${c.itemCount === 1 ? 'item' : 'items'})` : 'Your cart';
  refreshCartCount();
  if (!c.items.length) { list.innerHTML = `<div class="empty"><h3>Your cart is empty</h3><p>Fresh vegetables, oils, honey and millets are waiting.</p><a class="btn mt" href="products.html">Browse products</a></div>`; sum.classList.add('hidden'); return; }
  sum.classList.remove('hidden');
  list.innerHTML = c.items.map(i => `<div class="cart-item" data-id="${i.id}">
    <a href="product-details.html?id=${i.productId}">${imgTag(i.image, i.name)}</a>
    <div><h4><a href="product-details.html?id=${i.productId}">${esc(i.name)}</a></h4><span class="muted">${rupee(i.price)} ${esc(i.unit)}</span>
      <div class="mt" style="margin-top:10px"><div class="qty"><button data-act="dec" aria-label="Decrease quantity of ${esc(i.name)}">−</button><span>${i.quantity}</span><button data-act="inc" aria-label="Increase quantity of ${esc(i.name)}">+</button></div>
      <button class="remove" data-act="rm">Remove</button></div></div>
    <div class="line">${rupee(i.lineTotal)}</div></div>`).join('');
  $('#sum-subtotal').textContent = rupee(c.subtotal); $('#sum-total').textContent = rupee(c.subtotal);
  const toFree = PRICING.freeDeliveryAbove - c.subtotal;
  $('#delivery-note').textContent = toFree > 0 ? `Add ${rupee(toFree)} more for free home delivery.` : 'You qualify for free home delivery.';
  c._byId = Object.fromEntries(c.items.map(i => [i.id, i])); window.__cart = c;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); const row = e.target.closest('.cart-item'); if (!b || !row) return;
  const id = +row.dataset.id, item = window.__cart._byId[id]; b.disabled = true;
  try {
    let c;
    if (b.dataset.act === 'rm') c = await api('DELETE', '/cart/items/' + id);
    else {
      const q = item.quantity + (b.dataset.act === 'inc' ? 1 : -1);
      if (q < 1) { c = await api('DELETE', '/cart/items/' + id); } else c = await api('PUT', '/cart/items/' + id, { quantity: q });
    }
    renderCart(c);
  } catch (err) { toast(err.message, 'error'); b.disabled = false; }
});
