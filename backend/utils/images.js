const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const { AppError } = require('./helpers');
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const MAGIC = { png: b => b.slice(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])), jpg: b => b[0] === 0xff && b[1] === 0xd8, gif: b => b.slice(0, 3).toString() === 'GIF', webp: b => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP' };

/** Accepts an existing safe path (assets/..., uploads/...) or a base64 data URL (saved to /uploads). */
function resolveImage(value) {
  if (typeof value !== 'string' || !value) throw new AppError(400, 'Invalid image.');
  const m = value.match(/^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (m) {
    const ext = TYPES[m[1]]; if (!ext) throw new AppError(400, 'Upload a PNG, JPG, WEBP or GIF image (SVG uploads are not accepted).');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > MAX_BYTES) throw new AppError(413, 'Image is too large (max 2 MB).');
    if (!MAGIC[ext](buf)) throw new AppError(400, 'The file is not a valid ' + ext.toUpperCase() + ' image.');
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const file = crypto.randomBytes(12).toString('hex') + '.' + ext;
    fs.writeFileSync(path.join(UPLOAD_DIR, file), buf);
    return 'uploads/' + file;
  }
  if (/^(assets|uploads)\/[A-Za-z0-9_\-./]+$/.test(value) && !value.includes('..') && value.length <= 255) return value;
  throw new AppError(400, 'Invalid image path.');
}
function removeUpload(p) {
  if (typeof p === 'string' && /^uploads\/[a-f0-9]+\.(png|jpg|webp|gif)$/.test(p)) fs.unlink(path.join(UPLOAD_DIR, path.basename(p)), () => {});
}
module.exports = { resolveImage, removeUpload, UPLOAD_DIR };
