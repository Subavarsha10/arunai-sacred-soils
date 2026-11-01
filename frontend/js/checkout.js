/* checkout.js - checkout page */
let CART = null, USER = null;
document.addEventListener('DOMContentLoaded', async () => {
  const form = $('#checkout-form'); if (!form) return;
  USER = await requireAuth(); if (!USER) return;
  try { CART = await api('GET', '/cart'); } catch (e) { toast(e.message, 'error'); return; }
  if (!CART.items.length) { location.href = 'cart.html'; return; }
  form.elements.fullName.value = USER.name; form.elements.phone.value = USER.phone; form.elements.email.value = USER.email;
  $('#co-items').innerHTML = CART.items.map(i => `<div class="mini-item"><span>${esc(i.name)} × ${i.quantity}<br><small class="muted">${rupee(i.price)} ${esc(i.unit)}</small></span><b>${rupee(i.lineTotal)}</b></div>`).join('');
  // saved addresses
  try {
    const addrs = await api('GET', '/users/addresses');
    if (addrs.length) {
      const sel = $('#saved-address'); sel.classList.remove('hidden'); sel.closest('.field').classList.remove('hidden');
      sel.innerHTML = '<option value="">Use a saved address...</option>' + addrs.map(a => `<option value='${esc(JSON.stringify(a))}'>${esc(a.label)}: ${esc(a.line1)}, ${esc(a.city)}</option>`).join('');
      sel.onchange = () => { if (!sel.value) return; const a = JSON.parse(sel.value); form.elements.address.value = a.line1; form.elements.city.value = a.city; form.elements.state.value = a.state; form.elements.pin.value = a.pin; };
    }
  } catch (e) { /* addresses are optional */ }
  $$('input[name=fulfilment]').forEach(r => r.addEventListener('change', sync));
  $$('input[name=paymentMethod]').forEach(r => r.addEventListener('change', sync));
  sync();
  form.addEventListener('submit', submit);
});
const fulfil = () => $('input[name=fulfilment]:checked').value;
function sync() {
  const home = fulfil() === 'HOME_DELIVERY', pay = $('input[name=paymentMethod]:checked').value;
  $('#address-block').classList.toggle('hidden', !home); $('#pickup-note').classList.toggle('hidden', home);
  $('#upi-block').classList.toggle('hidden', pay !== 'DEMO_UPI'); $('#card-block').classList.toggle('hidden', pay !== 'DEMO_CARD');
  const t = calcTotals(CART.subtotal, fulfil());
  $('#co-subtotal').textContent = rupee(t.subtotal); $('#co-delivery').textContent = t.delivery ? rupee(t.delivery) : 'Free';
  $('#co-discount').textContent = t.discount ? '− ' + rupee(t.discount) : '₹0'; $('#co-total').textContent = rupee(t.total);
  $('#co-discount-row').classList.toggle('disc', !!t.discount);
}
async function submit(e) {
  e.preventDefault(); const f = e.target, box = $('#form-alert'); box.classList.add('hidden');
  const home = fulfil() === 'HOME_DELIVERY', pay = f.elements.paymentMethod.value;
  const rules = { fullName: [V.name, 'Enter your full name.'], phone: [V.phone, 'Enter a 10-digit mobile number.'], email: [V.email, 'Enter a valid email address.'] };
  if (home) Object.assign(rules, { address: [v => v.trim().length >= 5, 'Enter your delivery address.'], city: [v => v.trim().length >= 2, 'Enter your city.'], state: [v => v.trim().length >= 2, 'Enter your state.'], pin: [V.pin, 'Enter a valid 6-digit PIN code.'] });
  if (pay === 'DEMO_UPI') rules.upiId = [v => /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(v.trim()), 'Enter a UPI ID like name@bank (demo only).'];
  if (pay === 'DEMO_CARD') Object.assign(rules, { cardNumber: [v => v.replace(/\s/g, '').length === 16 && /^\d+$/.test(v.replace(/\s/g, '')), 'Enter a 16-digit demo card number.'], cardExpiry: [v => /^(0[1-9]|1[0-2])\/\d{2}$/.test(v), 'Use MM/YY.'], cardCvv: [v => /^\d{3}$/.test(v), 'Enter a 3-digit CVV.'] });
  if (!validate(f, rules)) return;
  const btn = $('#place-order'); btn.disabled = true; btn.textContent = 'Placing order...';
  try {   // card and UPI details are never sent or stored: payments are demo only
    const o = await api('POST', '/orders', { fullName: f.elements.fullName.value.trim(), phone: f.elements.phone.value, email: f.elements.email.value.trim(), fulfilment: fulfil(), address: f.elements.address.value.trim(), city: f.elements.city.value.trim(), state: f.elements.state.value.trim(), pin: f.elements.pin.value.trim(), paymentMethod: pay });
    location.href = 'orders.html?id=' + o.id + '&placed=1';
  } catch (err) { showAlert(box, 'error', err.message); btn.disabled = false; btn.textContent = 'Place order'; box.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}
