class AppError extends Error { constructor(status, message) { super(message); this.status = status; this.expose = true; } }
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const ok = (res, data = {}, status = 200) => res.status(status).json({ success: true, data });
/** Strict integer parser: accepts numbers or numeric strings only. Returns null when invalid. */
function int(v, min, max) {
  if ((typeof v !== 'number' && typeof v !== 'string') || v === '') return null;
  const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null;
}
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const text = (v, max = 255) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
module.exports = { AppError, asyncHandler, ok, int, round2, text };
