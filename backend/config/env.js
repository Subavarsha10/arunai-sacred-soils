const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const e = process.env;
module.exports = {
  port: parseInt(e.PORT, 10) || 5000,
  env: e.NODE_ENV || 'development',
  db: { host: e.DB_HOST || 'localhost', port: parseInt(e.DB_PORT, 10) || 3306, user: e.DB_USER || 'root', password: e.DB_PASSWORD || '', database: e.DB_NAME || 'arunai_sacred_soils' },
  jwtSecret: e.JWT_SECRET || '',
  jwtExpires: e.JWT_EXPIRES_IN || '7d',
  cors: (e.CORS_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500,http://localhost:5000,http://127.0.0.1:5000').split(',').map(s => s.trim()).filter(Boolean),
  csp: e.CSP !== 'off',
  serveFrontend: e.SERVE_FRONTEND !== 'false',
  rateLimitAuthMax: parseInt(e.RATE_LIMIT_AUTH_MAX, 10) || 50
};
