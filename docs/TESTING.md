# Testing checklist

Run the automated suites from the `backend` folder. `npm run test:api` needs the server running and the admin seeded. `npm run test:db` checks the database rules (unique keys, foreign keys, cascades, CHECK constraints, transactions, Tamil text) and does not need the server. `npm test` runs both. `npm run db:verify` is a quick health check of a live database. The UI items below are for you to click through at http://localhost:5000.

"Auto" means `tests/api.test.js` checks it against a real MySQL database. "UI" means click it yourself.

| # | Scenario | How | What to expect |
|---|---|---|---|
| 1 | Homepage loads | UI | Announcement bar, hero, 4 trust items, categories, featured products, about, testimonials (labelled demo), newsletter, footer |
| 2 | Six categories display | Auto + UI | `GET /categories` returns 6 with images; six cards on the homepage |
| 3 | 12 products display with images | Auto + UI | 12 products, 12 different image paths, no broken images |
| 4 | Search | Auto + UI | "millet" finds 3 products |
| 5 | Category filtering | Auto + UI | Natural Oils shows 2 products |
| 6 | Sorting | Auto + UI | Price low to high starts at Rs 35; A to Z starts with Cold Pressed Coconut Oil |
| 7 | Customer registration | Auto + UI | Account created, password stored as a bcrypt hash, role is customer |
| 8 | Duplicate registration prevented | Auto + UI | Same email or same phone gives a clear 409 message |
| 9 | Customer login | Auto + UI | Token returned, header shows My Account |
| 10 | Invalid login rejected | Auto + UI | Same message for wrong password and unknown email; injection strings rejected |
| 11 | Protected pages require login | Auto + UI | Cart API, orders, profile and all admin routes return 401 without a token; checkout and account pages redirect to login |
| 12 | Add to Cart | Auto + UI | Badge updates; out-of-stock and over-stock adds are refused |
| 13 | Quantity updates | Auto + UI | +/- and Remove update totals without a reload |
| 14 | Cart total is correct | Auto + UI | Subtotal equals the sum of price times quantity |
| 15 | Checkout works | Auto + UI | Home delivery, pickup, COD, demo UPI and demo card all complete; field validation shown |
| 16 | Orders saved in MySQL | Auto + UI | Rows in `orders`, `order_items`, `payments` (see `database/reports.sql`, query 3 and 4) |
| 17 | Inventory updates after orders | Auto + UI | Stock drops after an order and returns after a cancellation; never goes negative, even with two simultaneous buyers |
| 18 | Order history displays correctly | Auto + UI | Newest first, with tracking timeline and totals |
| 19 | Admin login works | Auto + UI | Admin sees the dashboard; a customer account is refused at the admin page |
| 20 | Admin product management | Auto + UI | Add (with image upload), edit, delete, availability, featured, stock |
| 21 | Admin order management | Auto + UI | Status changes, order details, payment status, cancel returns stock |
| 22 | Unauthorized admin access rejected | Auto | Customer token gets 403 on every admin route; no token gets 401 |

Extra checks included in the automated suite: category and customer admin screens, inventory updates and low-stock alerts, profile and password changes, saved addresses (and that other users cannot touch them), other users cannot read your orders (404), cancel rules, SVG and fake-image upload refusal, path traversal refused, malformed JSON, unknown endpoints, and security headers.
