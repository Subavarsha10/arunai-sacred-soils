const { round2 } = require('./helpers');
const PRICING = { freeDeliveryAbove: 500, deliveryCharge: 40, discountAbove: 1000, discountRate: 0.05 };
function calcTotals(subtotal, fulfilment) {
  const delivery = fulfilment === 'HOME_DELIVERY' && subtotal > 0 && subtotal < PRICING.freeDeliveryAbove ? PRICING.deliveryCharge : 0;
  const discount = subtotal >= PRICING.discountAbove ? Math.round(subtotal * PRICING.discountRate) : 0;
  return { subtotal: round2(subtotal), delivery, discount, total: round2(subtotal + delivery - discount) };
}
module.exports = { PRICING, calcTotals };
