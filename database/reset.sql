-- DANGER: deletes the whole Arunai Sacred Soils database and all its data (users, orders, everything).
-- Use only to start over. After running this, run schema.sql (or: npm run db:setup, then npm run seed:admin).
DROP DATABASE IF EXISTS arunai_sacred_soils;
