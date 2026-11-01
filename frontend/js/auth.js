/* auth.js - login + registration pages */
document.addEventListener('DOMContentLoaded', () => {
  $$('[data-toggle-pw]').forEach(b => b.addEventListener('click', () => { const i = b.previousElementSibling; const show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.textContent = show ? 'Hide' : 'Show'; }));
  const login = $('#login-form'), reg = $('#register-form');
  if (login) initLogin(login); if (reg) initRegister(reg);
});
function safeNext() { const n = params().get('next'); return n && /^[\w\-.]+\.html(\?[\w=&%.\-]*)?$/.test(n) ? n : null; }
function goAfterLogin(user) {
  const n = safeNext();
  if (user.role === 'admin') location.href = (IN_PAGES ? '' : 'pages/') + 'admin.html';
  else location.href = n ? (n === 'index.html' ? ROOT + 'index.html' : n) : ROOT + 'index.html';
}
function initLogin(form) {
  const box = $('#form-alert');
  if (Auth.token) requireAuth().then(u => { if (u) goAfterLogin(u); });
  if (params().get('registered')) showAlert(box, 'success', 'Account created. Log in to start shopping.');
  form.addEventListener('submit', async e => {
    e.preventDefault(); box.classList.add('hidden');
    if (!validate(form, { email: [V.email, 'Enter a valid email address.'], password: [v => v.length > 0, 'Enter your password.'] })) return;
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    try { const { token, user } = await api('POST', '/auth/login', { email: form.elements.email.value.trim(), password: form.elements.password.value }); Auth.set(token, user); toast('Welcome back, ' + user.name.split(' ')[0] + '!'); setTimeout(() => goAfterLogin(user), 500); }
    catch (err) { showAlert(box, 'error', err.message); btn.disabled = false; }
  });
}
function initRegister(form) {
  const box = $('#form-alert'), meter = $('#meter span'), hint = $('#pw-hint');
  form.elements.password.addEventListener('input', () => {
    const s = V.strength(form.elements.password.value); meter.style.width = (s * 20) + '%';
    meter.style.background = s < 3 ? 'var(--danger)' : s < 5 ? 'var(--warn)' : 'var(--secondary)';
    hint.textContent = form.elements.password.value ? ['', 'Very weak', 'Weak', 'Fair', 'Good', 'Strong'][s] : 'Use 8+ characters with upper and lower case, a number and a symbol.';
  });
  form.addEventListener('submit', async e => {
    e.preventDefault(); box.classList.add('hidden');
    if (!validate(form, {
      name: [V.name, 'Enter your full name.'], email: [V.email, 'Enter a valid email address.'], phone: [V.phone, 'Enter a 10-digit mobile number starting with 6-9.'],
      password: [V.password, 'Use 8+ characters with upper and lower case, a number and a symbol.'], confirmPassword: [(v, f) => v === f.elements.password.value && v !== '', 'Passwords do not match.']
    })) return;
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      await api('POST', '/auth/register', { name: form.elements.name.value.trim(), email: form.elements.email.value.trim(), phone: form.elements.phone.value.trim(), password: form.elements.password.value, confirmPassword: form.elements.confirmPassword.value });
      showAlert(box, 'success', 'Account created! Taking you to login...'); setTimeout(() => location.href = 'login.html?registered=1', 1000);
    } catch (err) { showAlert(box, 'error', err.message); btn.disabled = false; }
  });
}
