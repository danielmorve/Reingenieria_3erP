
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
    CREATE TABLE IF NOT EXISTS restaurants (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      address VARCHAR(255),
      phone VARCHAR(50),
      is_active BOOLEAN DEFAULT true
    );
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL
    );
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      restaurant_id INTEGER REFERENCES restaurants(id),
      category_id INTEGER REFERENCES categories(id),
      name VARCHAR(100) NOT NULL,
      description TEXT,
      price NUMERIC(10,2) NOT NULL,
      is_available BOOLEAN DEFAULT true,
      image_url TEXT
    );
  `;
  await pool.query(sql);
  console.log('catalog-service: tables ready');

  const res = await pool.query('SELECT COUNT(*) FROM restaurants');
  if (parseInt(res.rows[0].count, 10) === 0) {
    console.log('Seeding initial catalog data...');
    await pool.query("INSERT INTO restaurants (name, address, phone) VALUES ('La Casa de los Tacos', 'Calle 123, CDMX', '555-123-4567');");
    await pool.query("INSERT INTO categories (name) VALUES ('Tacos'), ('Bebidas');");
    await pool.query(`
      INSERT INTO products (restaurant_id, category_id, name, description, price, is_available)
      VALUES
      (1, 1, 'Taco al pastor', 'Taco clásico al pastor', 20.00, true),
      (1, 1, 'Taco de suadero', 'Taco de suadero', 22.00, true),
      (1, 2, 'Refresco', 'Refresco 355ml', 18.00, true);
    `);
  }
}

app.get('/', (req, res) => {
  res.json({ service: 'catalog-service', status: 'ok' });
});

app.get('/catalog/restaurants', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, address, phone, is_active FROM restaurants WHERE is_active = true');
    res.json(result.rows);
  } catch (err) {
    console.error('Error /catalog/restaurants', err);
    res.status(500).json({ error: true, message: 'Error interno' });
  }
});

app.get('/catalog/menu', async (req, res) => {
  try {
    const restaurantId = req.query.restaurantId || 1;
    const sql = `
      SELECT p.id, p.name, p.description, p.price, p.is_available, p.image_url,
             c.id as category_id, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.restaurant_id = $1 AND p.is_available = true
    `;
    const result = await pool.query(sql, [restaurantId]);
    const items = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      price: parseFloat(r.price),
      isAvailable: r.is_available,
      imageUrl: r.image_url,
      category: {
        id: r.category_id,
        name: r.category_name
      }
    }));
    res.json(items);
  } catch (err) {
    console.error('Error /catalog/menu', err);
    res.status(500).json({ error: true, message: 'Error interno' });
  }
});

app.get('/catalog/products/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const sql = `
      SELECT p.id, p.name, p.description, p.price, p.is_available, p.image_url,
             p.restaurant_id,
             c.id as category_id, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = $1
    `;
    const result = await pool.query(sql, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: true, message: 'Producto no encontrado' });
    const r = result.rows[0];
    res.json({
      id: r.id,
      name: r.name,
      description: r.description,
      price: parseFloat(r.price),
      isAvailable: r.is_available,
      imageUrl: r.image_url,
      restaurantId: r.restaurant_id,
      category: {
        id: r.category_id,
        name: r.category_name
      }
    });
  } catch (err) {
    console.error('Error /catalog/products/:id', err);
    res.status(500).json({ error: true, message: 'Error interno' });
  }
});

const port = process.env.PORT || 3000;
initDb().then(() => {
  app.listen(port, () => console.log(`catalog-service listening on ${port}`));
}).catch(err => {
  console.error('Failed to init catalog-service DB', err);
  process.exit(1);
});
