# Cemetery Management Backend

NestJS + TypeScript backend for the cemetery management system. The API uses PostgreSQL through raw `pg.Pool` queries and keeps the existing schema in `database/DBase.sql`.

The base schema and seed live in `database/DBase.sql`. Versioned migrations
live in `database/migrations` and run automatically during application startup.
The runner uses the `schema_migrations` ledger; see the migration README for
fresh and existing database notes. Do not add migrations under `src`.

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
npm run migration:run
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
DB_MIGRATIONS_ENABLED=true
JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=1d
FRONTEND_URL=http://localhost:5173
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_SENDER_EMAIL=your-account@gmail.com
```

Do not commit a real `.env` file.

Email is sent from a personal Gmail account through the Gmail HTTPS API. Enable
the Gmail API in Google Cloud, create an OAuth client of type `Desktop app`, set
the client ID/secret and sender address in `.env`, then authorize once:

```bash
npm run email:gmail:authorize
```

The command prints an authorization URL and stores the returned refresh token
directly in `.env` without printing the token to the terminal.

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
Keep the `database/migrations` directory in the deployment artifact because the
production startup runs pending migrations from it.

## API Documentation

See `API_DOCUMENTATION.md`.
