
# TacoExpress - Microservicios

Proyecto de ejemplo con 7 microservicios, frontend y base de datos PostgreSQL.

## Servicios

- api-gateway (Node/Express + http-proxy-middleware)
- auth-service (usuarios y JWT)
- catalog-service (restaurante, menú, productos)
- pricing-service (cálculo de totales)
- orders-service (pedidos)
- delivery-service (repartidores y asignaciones)
- notifications-service (logs de notificaciones)
- frontend (HTML + JS simple servido con Express)
- db (PostgreSQL)

## Ejecutar

Requisitos:
- Docker
- Docker Compose

```bash
docker compose up --build
```

Luego abre:

- Frontend: http://localhost:8080
- API Gateway: http://localhost:3000
