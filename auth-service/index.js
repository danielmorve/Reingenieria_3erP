
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

async function initDb() {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  await pool.query(sql);
  console.log('auth-service: users table ready');
}

function generateToken(user) {
  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: true, message: 'Token requerido' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('JWT error', err.message);
    return res.status(401).json({ error: true, message: 'Token inválido' });
  }
}

app.get('/', (req, res) => {
  res.json({ service: 'auth-service', status: 'ok' });
});

app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: true, message: 'name, email y password son requeridos' });
    }
    const allowedRoles = ['CUSTOMER', 'ADMIN', 'DRIVER'];
    const finalRole = allowedRoles.includes(role) ? role : 'CUSTOMER';

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: true, message: 'El email ya está registrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const insertSql = `
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, role, created_at;
    `;
    const result = await pool.query(insertSql, [name, email, passwordHash, finalRole]);
    const user = result.rows[0];

    return res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.created_at
    });
  } catch (err) {
    console.error('Error in /auth/register', err);
    return res.status(500).json({ error: true, message: 'Error interno en registro' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: true, message: 'email y password son requeridos' });
    }
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: true, message: 'Credenciales inválidas' });
    }
    const user = userRes.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: true, message: 'Credenciales inválidas' });
    }
    const token = generateToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Error in /auth/login', err);
    return res.status(500).json({ error: true, message: 'Error interno en login' });
  }
});

app.get('/auth/me', authMiddleware, async (req, res) => {
  try {
    const userRes = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Usuario no encontrado' });
    }
    const user = userRes.rows[0];
    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.created_at
    });
  } catch (err) {
    console.error('Error in /auth/me', err);
    return res.status(500).json({ error: true, message: 'Error interno' });
  }
});
const port = process.env.PORT || 3000;

async function start() {
  const maxRetries = 10;
  let retries = maxRetries;

  while (retries > 0) {
    try {
      await initDb();
      app.listen(port, () => console.log(`auth-service listening on ${port}`));
      return;
    } catch (err) {
      retries -= 1;
      console.error(
        `Failed to init auth-service DB (retries left: ${retries})`,
        err.message
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  console.error('Could not init auth-service DB after several retries. Exiting.');
  process.exit(1);
}

start();
