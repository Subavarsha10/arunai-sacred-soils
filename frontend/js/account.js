/* account.js - customer dashboard */
let ME = null;
document.addEventListener('DOMContentLoaded', async () => {
  if (!$('#account-root')) return;
  ME = await requireAuth(); if (!ME) return;
  $$('[data-tab]').forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
  $('#logout-btn').onclick = () => logout();
  fillProfile(); initProfile(); initPassword(); initAddresses(); loadRecent();
  show(location.hash.slice(1) || 'profile');
});
function show(tab) {
  if (!$('#tab-' + tab)) tab = 'profile';
  $$('.tab').forEach(t => t.classList.toggle('hidden', t.id !== 'tab-' + tab));
  $$('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  history.replaceState(null, '', '#' + tab);
}
function fillProfile() { const f = $('#profile-form'); f.elements.name.value = ME.name; f.elements.email.value = ME.email; f.elements.phone.value = ME.phone; $('#hello').textContent = 'Hello, ' + ME.name.split(' ')[0]; $('#member').textContent = 'Member since ' + new Date(ME.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); }
function initProfile() {
  const f = $('#profile-form'), box = $('#profile-alert');
  f.addEventListener('submit', async e => {
    e.preventDefault(); box.classList.add('hidden');
    if (!validate(f, { name: [V.name, 'Enter your full name.'], phone: [V.phone, 'Enter a valid 10-digit mobile number.'] })) return;
    try { ME = await api('PUT', '/users/profile', { name: f.elements.name.value.trim(), phone: f.elements.phone.value.trim() }); localStorage.setItem('ass_user', JSON.stringify(ME)); fillProfile(); renderChrome(); refreshCartCount(); showAlert(box, 'success', 'Profile saved.'); }
    catch (err) { showAlert(box, 'error', err.message); }
  });
}
function initPassword() {
  const f = $('#password-form'), box = $('#password-alert');
  f.addEventListener('submit', async e => {
    e.preventDefault(); box.classList.add('hidden');
    if (!validate(f, { currentPassword: [v => v.length > 0, 'Enter your current password.'], newPassword: [V.password, 'Use 8+ characters with upper and lower case, a number and a symbol.'], confirmPassword: [(v, fm) => v === fm.elements.newPassword.value && v !== '', 'Passwords do not match.'] })) return;
    try { await api('PUT', '/users/change-password', { currentPassword: f.elements.currentPassword.value, newPassword: f.elements.newPassword.value, confirmPassword: f.elements.confirmPassword.value }); f.reset(); showAlert(box, 'success', 'Password updated.'); }
    catch (err) { showAlert(box, 'error', err.message); }
  });
}
async function loadAddresses() {
  const box = $('#address-list');
  try {
    const list = await api('GET', '/users/addresses');
    box.innerHTML = list.length ? list.map(a => `<div class="addr-card"><div><b>${esc(a.label)}</b><br><span class="muted">${esc(a.line1)}, ${esc(a.city)}, ${esc(a.state)} - ${esc(a.pin)}</span></div><button class="remove" data-del="${a.id}">Remove</button></div>`).join('') : '<p class="muted">No saved addresses yet.</p>';
  } catch (e) { box.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
}
function initAddresses() {
  loadAddresses(); const f = $('#address-form'), box = $('#address-alert');
  f.addEventListener('submit', async e => {
    e.preventDefault(); box.classList.add('hidden');
    if (!validate(f, { line1: [v => v.trim().length >= 5, 'Enter the street address.'], city: [v => v.trim().length >= 2, 'Enter the city.'], state: [v => v.trim().length >= 2, 'Enter the state.'], pin: [V.pin, 'Enter a valid 6-digit PIN code.'] })) return;
    try { await api('POST', '/users/addresses', { label: f.elements.label.value.trim() || 'Home', line1: f.elements.line1.value.trim(), city: f.elements.city.value.trim(), state: f.elements.state.value.trim(), pin: f.elements.pin.value.trim() }); f.reset(); toast('Address saved.'); loadAddresses(); }
    catch (err) { showAlert(box, 'error', err.message); }
  });
  $('#address-list').addEventListener('click', async e => { const b = e.target.closest('[data-del]'); if (!b) return; try { await api('DELETE', '/users/addresses/' + b.dataset.del); toast('Address removed.'); loadAddresses(); } catch (err) { toast(err.message, 'error'); } });
}
async function loadRecent() {
  const box = $('#recent-orders');
  try {
    const o = (await api('GET', '/orders')).slice(0, 3);
    box.innerHTML = o.length ? `<div class="table-wrap"><table class="table"><tbody>${o.map(x => `<tr><td><b>${esc(x.orderNumber)}</b></td><td>${fmtDate(x.createdAt)}</td><td>${rupee(x.total)}</td><td>${statusBadge(x.status)}</td><td><a class="text-link" href="orders.html?id=${x.id}">Track</a></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">You have not placed any orders yet.</p>';
  } catch (e) { box.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
}
