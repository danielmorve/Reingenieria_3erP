require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.PGHOST || 'db',
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
  user: process.env.PGUSER || 'example',
  password: process.env.PGPASSWORD || 'example',
  database: process.env.PGDATABASE || 'tacoexpress'
});

const CATALOG_URL = process.env.CATALOG_URL || 'http://catalog-service:3000';
const PRICING_URL = process.env.PRICING_URL || 'http://pricing-service:3000';

async function initDb() {
  const sql = `
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      restaurant_id INTEGER NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'CREATED',
      subtotal NUMERIC(10,2) NOT NULL,
      delivery_fee NUMERIC(10,2) NOT NULL,
      discount NUMERIC(10,2) NOT NULL,
      total NUMERIC(10,2) NOT NULL,
      delivery_address VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      name VARCHAR(100) NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price NUMERIC(10,2) NOT NULL,
      total_price NUMERIC(10,2) NOT NULL
    );
  `;
  await pool.query(sql);
  console.log('orders-service: tables ready');
}

app.get('/', (req, res) => {
  res.json({ service: 'orders-service', status: 'ok' });
});

function getUserId(req) {
  const header = req.headers['x-user-id'];
  if (!header) return null;
  return parseInt(header, 10);
}

// Crear pedido
app.post('/orders', async (req, res) => {
  const userId = getUserId(req) || 1;
  try {
    const { restaurantId, items, deliveryAddress, couponCode } = req.body;
    if (!restaurantId || !Array.isArray(items) || items.length === 0 || !deliveryAddress) {
      return res.status(400).json({ error: true, message: 'restaurantId, items y deliveryAddress son requeridos' });
    }

    const enrichedItems = [];
    for (const item of items) {
      const productRes = await axios.get(`${CATALOG_URL}/catalog/products/${item.productId}`);
      const p = productRes.data;
      enrichedItems.push({
        productId: p.id,
        name: p.name,
        quantity: item.quantity,
        unitPrice: p.price
      });
    }

    const pricingRes = await axios.post(`${PRICING_URL}/pricing/calculate`, {
      items: enrichedItems.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice
      })),
      deliveryAddress,
      couponCode,
      userId,
      restaurantId
    });
    const pricing = pricingRes.data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insertOrderSql = `
        INSERT INTO orders (user_id, restaurant_id, status, subtotal, delivery_fee, discount, total, delivery_address)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id, created_at;
      `;
      const orderResult = await client.query(insertOrderSql, [
        userId,
        restaurantId,
        'CREATED',
        pricing.subtotal,
        pricing.deliveryFee,
        pricing.discount,
        pricing.total,
        deliveryAddress
      ]);
      const orderId = orderResult.rows[0].id;
      const createdAt = orderResult.rows[0].created_at;

      for (const item of enrichedItems) {
        const totalPrice = item.unitPrice * item.quantity;
        await client.query(
          `INSERT INTO order_items (order_id, product_id, name, quantity, unit_price, total_price)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [orderId, item.productId, item.name, item.quantity, item.unitPrice, totalPrice]
        );
      }

      await client.query('COMMIT');

      res.status(201).json({
        id: orderId,
        userId,
        restaurantId,
        status: 'CREATED',
        subtotal: pricing.subtotal,
        deliveryFee: pricing.deliveryFee,
        discount: pricing.discount,
        total: pricing.total,
        deliveryAddress,
        items: enrichedItems.map(i => ({
          productId: i.productId,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.unitPrice * i.quantity
        })),
        createdAt
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error /orders', err.response?.data || err.message);
    res.status(500).json({ error: true, message: 'Error interno al crear pedido' });
  }
});

// 🔹 PRIMERO: ruta para "mis pedidos"
app.get('/orders/my', async (req, res) => {
  const userId = getUserId(req) || 1;
  try {
    const result = await pool.query(
      'SELECT id, status, total, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      status: r.status,
      total: parseFloat(r.total),
      createdAt: r.created_at
    })));
  } catch (err) {
    console.error('Error /orders/my', err);
    res.status(500).json({ error: true, message: 'Error interno' });
  }
});

// 🔹 DESPUÉS: ruta por ID, restringida a números
app.get('/orders/:id(\\d+)', async (req, res) => {
  try {
    const id = req.params.id;
    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Pedido no encontrado' });
    }
    const order = orderRes.rows[0];
    const itemsRes = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
    res.json({
      id: order.id,
      userId: order.user_id,
      restaurantId: order.restaurant_id,
      status: order.status,
      subtotal: parseFloat(order.subtotal),
      deliveryFee: parseFloat(order.delivery_fee),
      discount: parseFloat(order.discount),
      total: parseFloat(order.total),
      deliveryAddress: order.delivery_address,
      items: itemsRes.rows.map(r => ({
        id: r.id,
        productId: r.product_id,
        name: r.name,
        quantity: r.quantity,
        unitPrice: parseFloat(r.unit_price),
        totalPrice: parseFloat(r.total_price)
      })),
      createdAt: order.created_at
    });
  } catch (err) {
    console.error('Error /orders/:id', err);
    res.status(500).json({ error: true, message: 'Error interno' });
  }
});

const port = process.env.PORT || 3000;
initDb().then(() => {
  app.listen(port, () => console.log(`orders-service listening on ${port}`));
}).catch(err => {
  console.error('Failed to init orders-service DB', err);
  process.exit(1);
});
