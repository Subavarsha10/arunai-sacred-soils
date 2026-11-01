const path = require('path'); const fs = require('fs');
const cfg = require('./config/env');
if (cfg.jwtSecret.length < 32) {
  console.error('\nJWT_SECRET is missing or shorter than 32 characters.\nOpen backend/.env and set it. Generate one with:\n  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n');
  process.exit(1);
}
const express = require('express'); const helmet = require('helmet'); const cors = require('cors'); const rateLimit = require('express-rate-limit');
const { pool } = require('./config/db'); const errorHandler = require('./middleware/error'); const { UPLOAD_DIR } = require('./utils/images');
const { AppError, ok } = require('./utils/helpers');

const app = express();
app.disable('x-powered-by');
// Content-Security-Policy: scripts only from this server, fonts from Google Fonts. Set CSP=off in .env to disable while debugging.
const csp = { useDefaults: false, directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ['https://fonts.gstatic.com'],
  imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'self'"], frameAncestors: ["'none'"], formAction: ["'self'"] } };
app.use(helmet({ contentSecurityPolicy: cfg.csp ? csp : false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: (origin, cb) => cb(null, !origin || cfg.cors.includes(origin)), methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '4mb' }));   // 4 MB: product images arrive as base64 (max 2 MB file)

const limiter = (windowMs, max) => rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, handler: (req, res) => res.status(429).json({ success: false, message: 'Too many requests. Please wait a moment and try again.' }) });
app.use('/api', limiter(60 * 1000, 600));
app.use('/api/auth/login', limiter(15 * 60 * 1000, cfg.rateLimitAuthMax));
app.use('/api/auth/register', limiter(15 * 60 * 1000, cfg.rateLimitAuthMax));
app.use('/api/newsletter', limiter(15 * 60 * 1000, cfg.rateLimitAuthMax));

app.get('/api/health', async (req, res) => {
  try { await pool.query('SELECT 1'); ok(res, { status: 'ok', database: 'up', time: new Date().toISOString() }); }
  catch (e) { res.status(503).json({ success: false, message: 'Database is not reachable.' }); }
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/newsletter', require('./routes/newsletter'));
app.use('/api', (req, res, next) => next(new AppError(404, 'Endpoint not found: ' + req.method + ' ' + req.originalUrl)));

app.use('/uploads', express.static(UPLOAD_DIR, { index: false, dotfiles: 'deny', maxAge: '7d' }));
const frontend = path.join(__dirname, '..', 'frontend');
if (cfg.serveFrontend && fs.existsSync(frontend)) app.use(express.static(frontend));
app.use(errorHandler);

async function start() {
  try { await pool.query('SELECT 1'); }
  catch (e) {
    console.error(`\nCould not connect to MySQL at ${cfg.db.host}:${cfg.db.port} as "${cfg.db.user}" (${e.code || e.message}).\nCheck DB_HOST, DB_USER and DB_PASSWORD in backend/.env, and that MySQL is running.\n`);
    process.exit(1);
  }
  try { await pool.query('SELECT 1 FROM products LIMIT 1'); }
  catch (e) { console.error('\nThe database tables are missing. Run:  npm run db:setup  (or run database/schema.sql in MySQL Workbench)\n'); process.exit(1); }
  app.listen(cfg.port, () => console.log(`Arunai Sacred Soils API running at http://localhost:${cfg.port}/api/health${cfg.serveFrontend ? `\nStorefront: http://localhost:${cfg.port}/` : ''}`));
}
if (require.main === module) start();
module.exports = app;
