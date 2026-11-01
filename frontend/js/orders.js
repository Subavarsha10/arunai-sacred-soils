/* orders.js - order history, details and tracking */
const STEPS = ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered'];
document.addEventListener('DOMContentLoaded', async () => {
  const root = $('#orders-root'); if (!root) return;
  if (!await requireAuth()) return;
  const id = params().get('id');
  try { id ? renderDetail(root, await api('GET', '/orders/' + encodeURIComponent(id))) : renderList(root, await api('GET', '/orders')); }
  catch (e) { root.innerHTML = `<div class="empty"><h3>${e.status === 404 ? 'Order not found' : 'Could not load orders'}</h3><p>${esc(e.message)}</p><a class="btn mt" href="orders.html">Back to my orders</a></div>`; }
});
function renderList(root, orders) {
  $('#orders-title').textContent = 'My orders';
  if (!orders.length) { root.innerHTML = `<div class="empty"><h3>No orders yet</h3><p>When you place an order it will appear here.</p><a class="btn mt" href="products.html">Start shopping</a></div>`; return; }
  root.innerHTML = `<div class="panel table-wrap"><table class="table"><thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>${orders.map(o =>
    `<tr><td><b>${esc(o.orderNumber)}</b></td><td>${fmtDate(o.createdAt)}</td><td>${o.items.reduce((s, i) => s + i.quantity, 0)}</td><td>${rupee(o.total)}</td><td>${statusBadge(o.status)}</td><td><a class="text-link" href="orders.html?id=${o.id}">View and track</a></td></tr>`).join('')}</tbody></table></div>`;
}
function renderDetail(root, o) {
  $('#orders-title').textContent = 'Order ' + o.orderNumber;
  const placed = params().get('placed') ? `<div class="alert success"><b>Thank you, ${esc(o.customerName.split(' ')[0])}!</b> Your order ${esc(o.orderNumber)} has been placed. ${o.payment.method !== 'COD' ? 'This was a demo payment, so no money was charged.' : 'Please keep the amount ready for payment on delivery.'}</div>` : '';
  const idx = STEPS.indexOf(o.status);
  const track = o.status === 'Cancelled' ? `<div class="alert error">This order was cancelled.</div>` : `<div class="timeline">${STEPS.map((s, i) => `<div class="tl-step ${i <= idx ? 'done' : ''}"><i>${i <= idx ? '✓' : i + 1}</i>${s}</div>`).join('')}</div>`;
  root.innerHTML = `${placed}<p class="mt" style="margin:0 0 16px"><a class="text-link" href="orders.html">← All orders</a></p>
  <div class="panel"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px"><div><h2 style="margin:0">Order tracking</h2><span class="muted">Placed ${fmtDate(o.createdAt)}</span></div>${statusBadge(o.status)}</div>${track}
  ${o.status === 'Pending' ? '<button class="btn btn-danger btn-sm" id="cancel-order">Cancel order</button>' : ''}</div>
  <div class="cart-layout mt"><div class="panel"><h3>Items</h3>${o.items.map(i => `<div class="cart-item">${imgTag(i.image, i.name)}<div><h4>${esc(i.name)}</h4><span class="muted">${rupee(i.price)} ${esc(i.unit)} × ${i.quantity}</span></div><div class="line">${rupee(i.lineTotal)}</div></div>`).join('')}</div>
  <div class="panel"><h3>Summary</h3><div class="sum-row"><span>Subtotal</span><span>${rupee(o.subtotal)}</span></div><div class="sum-row"><span>Delivery</span><span>${o.deliveryCharge ? rupee(o.deliveryCharge) : 'Free'}</span></div>
  <div class="sum-row ${o.discount ? 'disc' : ''}"><span>Discount</span><span>${o.discount ? '− ' + rupee(o.discount) : '₹0'}</span></div><div class="sum-row total"><span>Total</span><span>${rupee(o.total)}</span></div>
  <hr style="border:none;border-top:1px solid var(--border);margin:16px 0"><p><b>${o.fulfilment === 'HOME_DELIVERY' ? 'Home delivery' : 'Store pickup'}</b><br><span class="muted">${o.address ? esc(o.address.line1) + ', ' + esc(o.address.city) + ', ' + esc(o.address.state) + ' - ' + esc(o.address.pin) : 'Collect from our store with your order number.'}</span></p>
  <p class="mt" style="margin-top:12px"><b>Payment:</b> ${PAY_LABEL[o.payment.method]}<br><span class="muted">${esc(o.payment.status)}</span></p>
  <p class="mt" style="margin-top:12px"><b>Contact:</b> ${esc(o.customerName)}<br><span class="muted">${esc(o.phone)} · ${esc(o.email)}</span></p></div></div>`;
  const c = $('#cancel-order');
  if (c) c.onclick = async () => { if (!confirm('Cancel this order?')) return; try { renderDetail(root, await api('PUT', '/orders/' + o.id + '/status', { status: 'Cancelled' })); toast('Order cancelled.'); } catch (e) { toast(e.message, 'error'); } };
}
