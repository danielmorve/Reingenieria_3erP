
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ service: 'pricing-service', status: 'ok' });
});

app.post('/pricing/calculate', (req, res) => {
  try {
    const { items, couponCode } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: true, message: 'items requeridos' });
    }
    let subtotal = 0;
    for (const item of items) {
      subtotal += (item.unitPrice || 0) * (item.quantity || 0);
    }
    let deliveryFee = 40;
    let discount = 0;
    const appliedRules = ['BASE_DELIVERY_FEE'];

    if (couponCode && couponCode.toUpperCase() === 'TACO10') {
      discount = subtotal * 0.10;
      appliedRules.push('COUPON_TACO10_10_PERCENT');
    }

    const total = subtotal + deliveryFee - discount;

    res.json({
      subtotal,
      deliveryFee,
      discount,
      total,
      appliedRules
    });
  } catch (err) {
    console.error('Error /pricing/calculate', err);
    res.status(500).json({ error: true, message: 'Error interno' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`pricing-service listening on ${port}`));
