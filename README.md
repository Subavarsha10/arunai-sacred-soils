# Arunai Sacred Soils

Rooted in Nature. Delivered with Care.

Full-stack e-commerce site for farm products, built in three phases.

| Phase | Folder | Status |
|---|---|---|
| 1. Frontend (HTML, CSS, vanilla JS) | `frontend/` | Done |
| 2. Backend (Node.js, Express, JWT, bcrypt, MySQL) | `backend/` | Done |
| 3. Database, final integration, docs | `database/`, `docs/` | Done (this delivery) |

## Run it on Windows (VS Code, Node.js, MySQL Workbench)

1. Install **Node.js LTS** and **MySQL Server** (note the root password you set).
2. Open the project folder in VS Code, then open a terminal in `backend`:
   ```
   cd backend
   copy .env.example .env
   ```
3. Edit `backend\.env`: set `DB_PASSWORD` to your MySQL password and `JWT_SECRET` to a long random value. Generate one with:
   ```
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
4. Install, create the database, create the admin, start:
   ```
   npm install
   npm run db:setup
   npm run seed:admin
   npm start
   ```
   Then `npm run db:verify` confirms everything is in place. `npm run db:setup` runs `database/schema.sql`. You can instead open that file in MySQL Workbench and run it (lightning bolt). It is safe to run more than once and never deletes data.
5. Open **http://localhost:5000**. The backend also serves the `frontend` folder, so this one address is the whole site.

Admin sign in: `http://localhost:5000/pages/admin.html` with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env` (default `admin@arunaisacredsoils.com` / `Admin@123`). Change the password in `.env` and run `npm run seed:admin` again to reset it. Customers register on the site and can never become admins.

**Using VS Code Live Server instead** (port 5500): keep the backend running and open `frontend/index.html` with Live Server. The frontend then calls `http://localhost:5000/api`, and port 5500 is already allowed by `CORS_ORIGINS`. Opening the HTML file straight from disk will not work because browsers block those requests.

**Back to the browser-only demo:** set `USE_MOCK: true` at the top of `frontend/js/api.js`.

## Test it

With the server running (and `seed:admin` done), in a second terminal in `backend`:
```
npm run test:api
```
`npm test` runs the database test and then the API test. The API test makes about 130 checks (catalogue, auth, validation, cart, checkout, stock, orders in MySQL, cancel rules, admin CRUD, role protection, SQL injection attempts, upload checks, two buyers racing for the last item). It creates temporary users and orders, then removes them and restores the stock it changed.

The full checklist is in `docs/TESTING.md`.


## Documentation

* `docs/API.md`: every endpoint with request and response examples and status codes.
* `docs/TESTING.md`: the 22-scenario checklist and how each one is covered.
* `database/ER-DIAGRAM.md`: entity diagram and design decisions. `database/schema.sql`: tables and starter data. `database/reports.sql`: queries for Workbench demos. `database/reset.sql`: wipes everything to start over.
* `docs/DATA-DICTIONARY.md`: every column, key and index, generated from the live database (`npm run db:docs` regenerates it).
* Database commands (run in `backend`): `npm run db:setup` creates anything missing and keeps your data; `npm run db:verify` checks tables, foreign keys, unique constraints, starter data and order totals; `npm run test:db` proves the constraints, cascades and transactions really work; `npm run db:reset` **deletes the whole database** and rebuilds it (development only).

Pricing: home delivery is Rs 40 below Rs 500 and free above; pickup is free; a 5% discount applies from Rs 1,000. The server recalculates every total.

## What is secured, and what to know

* Passwords are hashed with bcrypt. Login errors do not reveal whether an email exists.
* Every SQL value uses `?` placeholders; `ORDER BY` comes from a fixed whitelist.
* The admin role is read from the database on every request, not from the token or the request body.
* Checkout runs in one transaction with row locks, so two buyers cannot take the last item.
* Helmet headers, CORS allow-list, login/register rate limits, and a 4 MB body limit are on. Uploaded images are checked by type, file signature and size; SVG uploads are refused.
* Payments are demo only. UPI and card details are never sent to the server or stored.
* Login tokens last 7 days (`JWT_EXPIRES_IN`) and live in the browser's `localStorage`. Before a real launch: serve over HTTPS, use a strong admin password, and consider httpOnly cookies.
* A Content-Security-Policy is on (scripts only from this server). If a page ever misbehaves after you edit it, set `CSP=off` in `.env` to check whether the policy is the cause.

## Pages

`index.html`, `pages/products.html`, `product-details.html`, `login.html`, `register.html`, `cart.html`, `checkout.html`, `account.html`, `orders.html`, `admin.html`.

## Images and logo

Artwork is local SVG so nothing breaks offline (`frontend/assets/generate_images.py` regenerates it). Swap in real photos by editing `image_url` in `database/schema.sql` seed data or through Admin > Products. Replace `frontend/assets/images/logo.svg` with your official logo.
