
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
    CREATE TABLE IF NOT EXISTS drivers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      is_active BOOLEAN DEFAULT true
    );
    CREATE TABLE IF NOT EXISTS driver_assignments (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL,
      driver_id INTEGER NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'ASSIGNED',
      assigned_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  await pool.query(sql);
  console.log('delivery-service: tables ready');

  const res = await pool.query('SELECT COUNT(*) FROM drivers');
  if (parseInt(res.rows[0].count, 10) === 0) {
    await pool.query("INSERT INTO drivers (name, is_active) VALUES ('Carlos Repartidor', true), ('Ana Rider', true);");
  }
}

app.get('/', (req, res) => {
  res.json({ service: 'delivery-service', status: 'ok' });
});

app.get('/delivery/drivers/available', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, is_active FROM drivers WHERE is_active = true');
    res.json(result.rows);
  } catch (err) {
    console.error('Error /delivery/drivers/available', err);
    res.status(500).json({ error: true, message: 'Error interno' });
  }
});

app.post('/delivery/assign', async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: true, message: 'orderId requerido' });

    const driversRes = await pool.query('SELECT id, name FROM drivers WHERE is_active = true LIMIT 1');
    if (driversRes.rows.length === 0) {
      return res.status(409).json({ error: true, message: 'No hay repartidores disponibles' });
    }
    const driver = driversRes.rows[0];

    const insertRes = await pool.query(
      'INSERT INTO driver_assignments (order_id, driver_id, status) VALUES ($1,$2,$3) RETURNING id, assigned_at',
      [orderId, driver.id, 'ASSIGNED']
    );

    res.status(201).json({
      assignmentId: insertRes.rows[0].id,
      orderId,
      driverId: driver.id,
      driverName: driver.name,
      status: 'ASSIGNED',
      etaMinutes: 30,
      assignedAt: insertRes.rows[0].assigned_at
    });
  } catch (err) {
    console.error('Error /delivery/assign', err);
    res.status(500).json({ error: true, message: 'Error interno' });
  }
});

app.get('/delivery/orders/:orderId', async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const result = await pool.query(
      `SELECT da.id, da.status, da.assigned_at, d.id as driver_id, d.name as driver_name
       FROM driver_assignments da
       JOIN drivers d ON da.driver_id = d.id
       WHERE da.order_id = $1
       ORDER BY da.assigned_at DESC
       LIMIT 1`,
      [orderId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'No hay asignación para este pedido' });
    }
    const r = result.rows[0];
    res.json({
      orderId: parseInt(orderId, 10),
      assignmentId: r.id,
      status: r.status,
      driver: {
        id: r.driver_id,
        name: r.driver_name
      },
      etaMinutes: 20
    });
  } catch (err) {
    console.error('Error /delivery/orders/:orderId', err);
    res.status(500).json({ error: true, message: 'Error interno' });
  }
});

const port = process.env.PORT || 3000;
initDb().then(() => {
  app.listen(port, () => console.log(`delivery-service listening on ${port}`));
}).catch(err => {
  console.error('Failed to init delivery-service DB', err);
  process.exit(1);
});
