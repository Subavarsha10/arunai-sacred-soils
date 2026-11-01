# Arunai Sacred Soils: API reference

Base URL: `http://localhost:5000/api`. All bodies are JSON. Protected routes need the header `Authorization: Bearer <token>` (the token comes from login).

Success: `{ "success": true, "data": ... }`. Error: `{ "success": false, "message": "Readable explanation" }`.

| Status | Meaning |
|---|---|
| 200, 201 | OK, created |
| 400 | Validation failed (the message says which field) |
| 401 | Not logged in, or the token is invalid or expired |
| 403 | Logged in but not allowed (for example a customer calling an admin route) |
| 404 | Not found, or not yours (other people's orders are reported as 404) |
| 409 | Conflict: duplicate email or phone, out of stock, order already final |
| 413 | Request or image too large |
| 429 | Too many requests (login, register and newsletter are limited per IP) |
| 500 | Server error (details are only in the server log) |

## Auth

**POST /auth/register**: `{ "name": "Varsha K", "email": "v@example.com", "phone": "9876543210", "password": "Test@1234", "confirmPassword": "Test@1234" }`
Returns 201 `{ "user": { "id", "name", "email", "phone", "role": "customer", "createdAt" } }`. Phone must be a 10-digit Indian mobile number. Password needs 8 to 72 characters with upper case, lower case, a digit and a symbol. A `role` field in the body is ignored.

**POST /auth/login**: `{ "email", "password" }` returns `{ "token": "eyJ...", "user": {...} }`. Wrong email or password gives the same 401 message either way. Login is limited to 50 attempts per 15 minutes per IP (`RATE_LIMIT_AUTH_MAX`).

**GET /auth/me** returns `{ "user": {...} }`. **POST /auth/logout** returns OK (tokens are stateless; the browser discards its token).

## Products and categories (public reads)

**GET /products** with optional `search` (name contains), `category` (id), `featured=true`, `sort` (`price_asc`, `price_desc`, `name_asc`, `name_desc`). Returns an array:
```json
{ "id": 7, "name": "Natural Honey", "categoryId": 5, "categoryName": "Natural Honey", "description": "...", "price": 450,
  "unit": "per 500 g", "image": "assets/images/products/honey.svg", "stock": 6, "lowStockThreshold": 10,
  "available": true, "featured": true, "availability": "Low Stock", "createdAt": "2026-11-01T07:00:00.000Z" }
```
`availability` is `In Stock`, `Low Stock` (stock at or below the threshold) or `Out of Stock` (zero stock or marked unavailable).

**GET /products/:id** returns one product. **GET /categories** returns `{ id, name, description, image, productCount }` for each category.

Admin only: **POST /products**, **PUT /products/:id** (send only the fields to change), **DELETE /products/:id**. Fields: `name, categoryId, price, unit, stock, lowStockThreshold, description, available, featured, image`. `image` is either an existing `assets/...` path or a PNG, JPG, WEBP or GIF data URL (max 2 MB, checked by file signature; SVG is refused). Uploads are saved in `backend/uploads` and served at `/uploads/...`. Admin only: **POST /categories**, **PUT /categories/:id**, **DELETE /categories/:id** (refused with 409 while it still has products).

## Cart (login required, one cart per user, stored in MySQL)

**GET /cart** returns `{ "items": [{ "id", "productId", "name", "price", "unit", "image", "quantity", "stock", "lineTotal" }], "itemCount", "subtotal" }`.
**POST /cart/items** `{ "productId": 1, "quantity": 2 }` adds or increases a line. 409 if it would exceed stock or the product is out of stock.
**PUT /cart/items/:id** `{ "quantity": 3 }`, **DELETE /cart/items/:id**. Both return the updated cart. You can only touch your own cart items.

## Orders (login required)

**POST /orders** places an order from your server-side cart:
```json
{ "fullName": "Varsha K", "phone": "9876543210", "email": "v@example.com", "fulfilment": "HOME_DELIVERY",
  "address": "12 Main Street", "city": "Vijayapura", "state": "Karnataka", "pin": "586101", "paymentMethod": "COD" }
```
`fulfilment` is `HOME_DELIVERY` or `STORE_PICKUP` (pickup needs no address). `paymentMethod` is `COD`, `DEMO_UPI` or `DEMO_CARD`; demo payments are marked paid-demo and no card or UPI data is accepted or stored. The server checks stock under a database lock, calculates every total, saves the order, items and payment, reduces inventory and empties the cart in one transaction. Returns 201:
```json
{ "id": 12, "orderNumber": "ASS-261101-4821", "status": "Pending", "fulfilment": "HOME_DELIVERY",
  "address": { "line1": "12 Main Street", "city": "Vijayapura", "state": "Karnataka", "pin": "586101" },
  "items": [{ "productId": 1, "name": "Fresh Tomatoes", "unit": "per kg", "price": 40, "quantity": 2, "lineTotal": 80 }],
  "subtotal": 80, "deliveryCharge": 40, "discount": 0, "total": 120,
  "payment": { "method": "COD", "status": "Pay on delivery or pickup" }, "customerName": "Varsha K", "createdAt": "..." }
```
Pricing: delivery Rs 40 under Rs 500 for home delivery, otherwise free. 5% discount from Rs 1,000.

**GET /orders** lists your orders, newest first. **GET /orders/:id** returns one (admins can read any). **PUT /orders/:id/status** `{ "status": "Confirmed" }`: admins can set any of `Pending, Confirmed, Preparing, Out for Delivery, Delivered, Cancelled`; a customer may only cancel their own Pending order. Cancelling returns the stock. Delivered and Cancelled orders are final (409). Delivering a cash-on-delivery order marks the payment as collected.

## Customer account (login required)

**GET /users/profile**, **PUT /users/profile** `{ "name", "phone" }` (email and role cannot be changed), **PUT /users/change-password** `{ "currentPassword", "newPassword", "confirmPassword" }`.
**GET /users/addresses**, **POST /users/addresses** `{ "label", "line1", "city", "state", "pin" }` (up to 10), **DELETE /users/addresses/:id**.

## Admin (admin role required for every route)

**GET /admin/dashboard** returns `{ totalProducts, totalCustomers, totalOrders, totalRevenue, pendingOrders, lowStockProducts: [...], recentOrders: [...] }`. Revenue excludes cancelled orders.
**GET /admin/customers** (with `orderCount` and `totalSpent`), **GET /admin/customers/:id** (with their orders), **GET /admin/orders**, **GET /admin/inventory**, **PUT /admin/inventory/:productId** `{ "stock": 40, "lowStockThreshold": 10 }`.

## Other

**POST /newsletter** `{ "email" }` returns 201, or 409 if already subscribed. **GET /health** returns `{ "status": "ok", "database": "up" }`, or 503 if MySQL is unreachable.
