// Turns database rows into the exact JSON the frontend expects.
const availability = (stock, avail, thr) => (stock <= 0 || !avail) ? 'Out of Stock' : (stock <= thr ? 'Low Stock' : 'In Stock');
const PAY_LABEL = { PENDING: 'Pay on delivery or pickup', PAID_DEMO: 'Paid (demo, no real money)', PAID_COD: 'Paid (cash collected)' };

const PRODUCT_SELECT = `SELECT p.id, p.category_id AS categoryId, c.name AS categoryName, p.name, p.description, p.price, p.unit,
  p.image_url AS image, p.is_available AS available, p.is_featured AS featured, i.quantity AS stock, i.low_stock_threshold AS lowStockThreshold,
  p.created_at AS createdAt FROM products p JOIN categories c ON c.id = p.category_id JOIN inventory i ON i.product_id = p.id`;

const product = r => ({ id: r.id, name: r.name, categoryId: r.categoryId, categoryName: r.categoryName, description: r.description || '', price: r.price, unit: r.unit, image: r.image,
  stock: r.stock, lowStockThreshold: r.lowStockThreshold, available: !!r.available, featured: !!r.featured, availability: availability(r.stock, r.available, r.lowStockThreshold), createdAt: r.createdAt });
const user = r => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, role: r.role, createdAt: r.createdAt });
const address = r => ({ id: r.id, label: r.label, line1: r.line1, city: r.city, state: r.state, pin: r.pin_code });

/** Loads orders (with items and payment) matching a WHERE clause. conn can be the pool or a transaction connection. */
async function loadOrders(conn, where = '', params = [], tail = 'ORDER BY o.id DESC', lock = '') {
  const [rows] = await conn.query(`SELECT o.*, p.method AS pay_method, p.status AS pay_status FROM orders o JOIN payments p ON p.order_id = o.id ${where} ${tail} ${lock}`, params);
  if (!rows.length) return [];
  const [items] = await conn.query('SELECT * FROM order_items WHERE order_id IN (?) ORDER BY id', [rows.map(r => r.id)]);
  const byOrder = {}; items.forEach(i => (byOrder[i.order_id] = byOrder[i.order_id] || []).push({ productId: i.product_id, name: i.product_name, unit: i.unit, image: i.image_url, price: i.price, quantity: i.quantity, lineTotal: i.line_total }));
  return rows.map(o => ({
    id: o.id, orderNumber: o.order_number, userId: o.user_id, customerName: o.customer_name, phone: o.phone, email: o.email, fulfilment: o.fulfilment,
    address: o.fulfilment === 'HOME_DELIVERY' ? { line1: o.ship_line1, city: o.ship_city, state: o.ship_state, pin: o.ship_pin } : null,
    items: byOrder[o.id] || [], subtotal: o.subtotal, deliveryCharge: o.delivery_charge, discount: o.discount, total: o.total, status: o.status,
    payment: { method: o.pay_method, status: PAY_LABEL[o.pay_status] }, createdAt: o.created_at
  }));
}
module.exports = { PRODUCT_SELECT, product, user, address, loadOrders, availability };
