// Same rules as the frontend (js/main.js), enforced again on the server.
const s = v => (typeof v === 'string' ? v : '');
module.exports = {
  name: v => { v = s(v).trim(); return v.length >= 2 && v.length <= 100; },
  email: v => { v = s(v).trim(); return v.length <= 190 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); },
  phone: v => /^[6-9]\d{9}$/.test(s(v)),
  pin: v => /^[1-9]\d{5}$/.test(s(v)),
  password: v => { v = s(v); return v.length >= 8 && v.length <= 72 && /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v); }
};
