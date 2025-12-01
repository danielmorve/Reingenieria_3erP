
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.use(cors());

const AUTH_URL = process.env.AUTH_URL || 'http://auth-service:3000';
const CATALOG_URL = process.env.CATALOG_URL || 'http://catalog-service:3000';
const ORDERS_URL = process.env.ORDERS_URL || 'http://orders-service:3000';
const DELIVERY_URL = process.env.DELIVERY_URL || 'http://delivery-service:3000';

app.get('/', (req, res) => {
  res.json({ service: 'api-gateway', status: 'ok' });
});

app.use('/api/auth', createProxyMiddleware({
  target: AUTH_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '/auth' },
  logLevel: 'debug'
}));

app.use('/api/catalog', createProxyMiddleware({
  target: CATALOG_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/catalog': '/catalog' },
  logLevel: 'debug'
}));

function attachUser(req, res, next) {
  if (!req.headers['x-user-id']) {
    req.headers['x-user-id'] = '1';
  }
  next();
}

app.use('/api/orders', attachUser, createProxyMiddleware({
  target: ORDERS_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/orders': '/orders' },
  logLevel: 'debug'
}));

app.use('/api/delivery', createProxyMiddleware({
  target: DELIVERY_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/delivery': '/delivery' },
  logLevel: 'debug'
}));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`api-gateway listening on ${port}`));
