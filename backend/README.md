# Cemetery Management Backend

NestJS + TypeScript backend for the cemetery management system. The API uses PostgreSQL through raw `pg.Pool` queries and keeps the existing schema in `database/DBase.sql`.

## Requirements

- Node.js 24+
- PostgreSQL
- npm

## Local Setup

```bash
cd backend
npm install
copy .env.example .env
```

Edit `.env` and set `DATABASE_URL`.

Create and load the database:

```bash
createdb cemetery_db
psql -d cemetery_db -f database/DBase.sql
```

Run the API:

```bash
npm run start:dev
```

Local API base URL:

```txt
http://localhost:3001/api
```

## Important Environment Variables

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:password@localhost:5432/cemetery_db
JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=1d
FRONTEND_URL=http://localhost:3000
```

Do not commit a real `.env` file.

## Implemented MVP Modules

- Database module with `query`, `queryOne`, and `transaction`
- Auth with register/login/me/logout, JWT, bcrypt
- Role guards for `admin` and `customer`
- Users admin/customer endpoints
- Plots endpoints and `/plots/map` for the 2D map
- Reservations with draft, submit, cancel, admin approve/reject transactions
- Contracts and payment recording
- Cemetery service types/orders
- Notifications for polling
- Dashboard summary/statistics
- Rule-based AI recommendation prototype
- Upload placeholder endpoints for later Cloudinary integration

## Render Deploy

Render Web Service settings:

```txt
Root Directory: backend
Build Command: npm install && npm run build
Start Command: npm run start:prod
```

Set production env vars in Render, especially `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, and `PORT`.

## API Documentation

See `API_DOCUMENTATION.md`.
