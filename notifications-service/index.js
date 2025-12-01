
require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

async function initDb() {
  const sql = `
    CREATE TABLE IF NOT EXISTS notification_logs (
      id SERIAL PRIMARY KEY,
      type VARCHAR(20) NOT NULL,
      recipient VARCHAR(255),
      subject VARCHAR(255),
      message TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'SENT',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  await pool.query(sql);
  console.log('notifications-service: table ready');
}

app.get('/', (req, res) => {
  res.json({ service: 'notifications-service', status: 'ok' });
});

async function logNotification(type, recipient, subject, message) {
  await pool.query(
    'INSERT INTO notification_logs (type, recipient, subject, message) VALUES ($1,$2,$3,$4)',
    [type, recipient, subject, message]
  );
}

app.post('/notifications/order-created', async (req, res) => {
  try {
    const { orderId, userEmail, userName, total } = req.body;
    const subject = `Pedido #${orderId} creado`;
    const message = `Hola ${userName}, tu pedido #${orderId} por $${total} ha sido creado.`;
    console.log('[notifications] ' + message);
    await logNotification('EMAIL', userEmail, subject, message);
    res.json({ status: 'ENQUEUED' });
  } catch (err) {
    console.error('Error /notifications/order-created', err);
    res.status(500).json({ error: true, message: 'Error interno' });
  }
});

app.post('/notifications/order-status-changed', async (req, res) => {
  try {
    const { orderId, userEmail, userName, oldStatus, newStatus } = req.body;
    const subject = `Pedido #${orderId} actualizado`;
    const message = `Hola ${userName}, tu pedido #${orderId} cambió de estado ${oldStatus} -> ${newStatus}.`;
    console.log('[notifications] ' + message);
    await logNotification('EMAIL', userEmail, subject, message);
    res.json({ status: 'ENQUEUED' });
  } catch (err) {
    console.error('Error /notifications/order-status-changed', err);
    res.status(500).json({ error: true, message: 'Error interno' });
  }
});

const port = process.env.PORT || 3000;
initDb().then(() => {
  app.listen(port, () => console.log(`notifications-service listening on ${port}`));
}).catch(err => {
  console.error('Failed to init notifications-service DB', err);
  process.exit(1);
});
