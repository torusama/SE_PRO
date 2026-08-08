<div align="center">

# Vĩnh Phúc Viên

### Cemetery Management System & AI Concierge Platform

A web-based platform for digital cemetery plot management, family memorial records, cemetery services, administrative workflows, and AI-assisted consultation.

<p>
  <a href="./README.md"><img src="https://img.shields.io/badge/Language-English-1f6feb?style=for-the-badge" alt="English README" /></a>
  <a href="./README.vi.md"><img src="https://img.shields.io/badge/Ng%C3%B4n_ng%E1%BB%AF-Ti%E1%BA%BFng_Vi%E1%BB%87t-2f5b51?style=for-the-badge" alt="Vietnamese README" /></a>
</p>

<p>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=000" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=fff" alt="TypeScript" />
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=fff" alt="NestJS 11" />
  <img src="https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=flat-square&logo=postgresql&logoColor=fff" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/FastAPI-ML_Service-009688?style=flat-square&logo=fastapi&logoColor=fff" alt="FastAPI" />
  <img src="https://img.shields.io/badge/HCMUS-Software_Engineering_Project-0b6e4f?style=flat-square" alt="HCMUS Software Engineering Project" />
</p>

**Group 8 · University of Science, VNU-HCM (HCMUS)**

[Overview](#overview) · [Features](#features) · [Architecture](#architecture) · [Quick Start](#quick-start) · [AI Concierge](#ai-concierge) · [Documentation](#documentation)

</div>

---

## Overview

**Vĩnh Phúc Viên** is an academic software engineering project that digitalizes cemetery operations for both customers and administrators. The system brings plot information, reservations, contracts, memorial services, reminders, family/deceased records, and administrative monitoring into one web platform.

The repository has evolved beyond the original MVP proposal and currently contains three main applications:

- **Customer web portal** for exploring cemetery plots, managing owned plots, booking services, appointments, reminders, notifications, family/deceased records, and using the AI concierge.
- **Administrator portal** for plot/map management, requests, contracts, services, transfers, appointments, reminders, audit activity, dashboards, and AI knowledge/feedback review.
- **AI/ML layer** with an AI Cemetery Concierge, safe long-term memory/RAG, controlled knowledge learning, multi-provider LLM routing, and an optional PlotRanker ML service.

> The AI layer does **not** let a foundation model retrain itself from user messages. Business data remains authoritative in PostgreSQL; memory and corrections are validated before becoming reusable knowledge.

## Features

### Customer experience

- Account registration, login, profile completion, and role-based access.
- Interactive **2D cemetery map** with plot browsing and plot details.
- Plot reservation / purchase request workflow and owned-plot management.
- Cemetery service browsing, booking, status tracking, and completion evidence.
- Appointment scheduling and availability lookup.
- Memorial reminders and notification center.
- Transfer / inheritance-related workflows.
- Family and deceased-profile management connected to cemetery plots.
- Demo payment flow for project demonstration.
- AI-assisted plot consultation, comparison, map highlighting, and guided next steps.

### Administrator experience

- Dashboard and operational statistics.
- Plot CRUD, status management, pricing, and cemetery map management.
- Reservation / purchase request processing.
- Contract and ownership record management.
- Cemetery service order management.
- Transfer workflow management.
- Appointment and reminder administration.
- Notification management and administrative activity/audit history.
- AI Agent administration: feedback review, knowledge moderation, learning journal, and learning analytics.

### AI & learning capabilities

- Natural-language cemetery consultation with tool-backed business actions.
- Plot recommendation using **real database inventory**, not invented plot data.
- Comparison of recommended options and 2D-map highlighting.
- Optional Bát Tự / cultural direction guidance with a rule-based backend service.
- Short-term conversation history plus persistent user-scoped memory.
- Safe RAG over approved knowledge using PostgreSQL/pgvector-compatible storage and NVIDIA BGE-M3 embeddings when configured.
- Customer feedback and correction workflow with admin approval, versioning, and auditability.
- Multi-provider LLM routing with key rotation, timeout handling, cooldowns, and fallback behavior.
- Optional **PlotRanker** FastAPI service using a small Random Forest model; candidate models are not automatically activated.

## Architecture

```mermaid
flowchart TB
    C[Customer] --> FE[React + TypeScript Web App]
    A[Administrator] --> FE

    FE --> API[NestJS REST API]
    API --> DB[(PostgreSQL)]
    API --> FILES[Uploaded Documents / Evidence]
    API --> MAIL[Gmail API / Optional SMS]

    API --> AGENT[AI Cemetery Concierge]
    AGENT --> TOOLS[Trusted Backend Tools]
    TOOLS --> DB

    AGENT --> ROUTER[Multi-provider LLM Router]
    ROUTER --> OAI[OpenAI-compatible Route(s)]
    ROUTER --> NIM[NVIDIA NIM]

    AGENT --> RAG[Validated Memory & Knowledge RAG]
    RAG --> DB

    AGENT -. optional .-> ML[FastAPI PlotRanker]
    ML --> MODEL[Random Forest Candidate Model]
```

### Design principles

1. **Frontend renders; backend decides business truth.** Plot status, prices, contracts, services, and reservation state come from backend/database services.
2. **LLMs orchestrate conversation, not authority.** Tool calls are validated server-side and trusted fields cannot be freely overwritten by model output.
3. **Learning is controlled.** User feedback can produce quarantined proposals or corrections, but only validated/approved knowledge becomes active context.
4. **Memory is user-scoped.** Persistent preferences are isolated by user and are not shared across customer accounts.
5. **ML is optional.** PlotRanker is an experimental ranking component and falls back to deterministic/rule-based ranking when unavailable.

## Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Zustand, Axios | Customer/admin web application |
| Backend | NestJS 11, TypeScript, Node.js | REST APIs, authentication, workflows, business logic |
| Database | PostgreSQL, SQL migrations, pgvector-compatible RAG schema | Relational data, audit history, AI memory/knowledge |
| Authentication | JWT, bcrypt, guards/RBAC | Secure sessions and customer/admin authorization |
| AI | OpenAI-compatible APIs, NVIDIA NIM, tool orchestration | Natural-language concierge and failover routing |
| Embeddings / RAG | NVIDIA BGE-M3 when configured | Semantic retrieval of approved memory/knowledge |
| ML service | FastAPI, scikit-learn, Random Forest | Optional plot-ranking experiment |
| Email | Gmail HTTP API (OAuth 2.0) | Verification, reminders, service notifications |
| Testing | Jest, Vitest, Pytest | Backend, frontend, and ML tests |

## Repository Structure

```text
SE_PRO-main/
├── frontend/                         # React customer + admin application
│   ├── src/pages/customer/           # Customer workflows
│   ├── src/pages/admin/              # Admin workflows
│   └── src/pages/shared/             # Shared family/deceased screens
├── backend/                          # NestJS REST API
│   ├── src/modules/ai-agent/         # Concierge, RAG, feedback, learning
│   ├── src/modules/plots/            # Plot data and map-related logic
│   ├── src/modules/reservations/     # Reservation/purchase requests
│   ├── src/modules/contracts/        # Contracts and ownership workflow
│   ├── src/modules/cemetery-services/# Cemetery service workflow
│   ├── src/modules/reminders/        # Memorial reminders
│   ├── src/modules/appointments/     # Scheduling
│   ├── src/modules/transfers/        # Transfer workflow
│   ├── src/modules/deceased/         # Deceased/family records
│   └── database/                     # Base schema, seed, migrations
├── ml-service/                       # Optional FastAPI PlotRanker service
├── AI_AGENT_CODEX_README.md          # Deep AI implementation specification
├── HUONG_DAN_CHAY_BACKEND_LOCAL.md   # Detailed local backend guide (VI)
└── HUONG_DAN_DONG_BO_DATABASE_SAU_KHI_PULL.md
```

## Quick Start

### Prerequisites

- **Node.js 24+** and npm
- **PostgreSQL**
- **Python 3.10+** only if you want to run the optional ML service

### 1. Clone and install

```bash
git clone <your-repository-url>
cd SE_PRO-main
```

Backend:

```bash
cd backend
npm install
copy .env.example .env
```

Frontend:

```bash
cd ../frontend
npm install
```

### 2. Create the PostgreSQL database

From the repository root, create a database and load the base schema:

```bash
createdb cemetery_db
psql -d cemetery_db -f backend/database/DBase.sql
```

Then run versioned migrations:

```bash
cd backend
npm run migration:run
```

> The backend also supports startup migration execution when `DB_MIGRATIONS_ENABLED=true`.

### 3. Configure environment variables

Minimum backend configuration:

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:password@localhost:5432/cemetery_db
DB_MIGRATIONS_ENABLED=true
JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=1d
FRONTEND_URL=http://localhost:5173
```

Optional integrations are configured through environment variables for:

- Gmail OAuth / sender account
- SMS provider
- OpenAI-compatible API route(s)
- NVIDIA NIM
- RAG embeddings
- PlotRanker ML service

See [`backend/README.md`](./backend/README.md) for the current AI routing and RAG settings.

The frontend uses `http://localhost:3001/api` by default. To override it, create `frontend/.env`:

```env
VITE_API_URL=http://localhost:3001/api
```

### 4. Run the applications

Backend:

```bash
cd backend
npm run start:dev
```

Frontend (new terminal):

```bash
cd frontend
npm run dev
```

Default local endpoints:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001/api`

### 5. Optional: run PlotRanker ML service

```bash
cd ml-service
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The ML service is intentionally optional and is **not automatically trained or activated on startup**.

## AI Concierge

The AI Concierge is designed as a **tool-using assistant around trusted application data**.

A typical request follows this flow:

```text
User message
  -> trusted conversation state + saved preferences
  -> LLM planner or deterministic intent path
  -> validated backend tool
  -> PostgreSQL / service data
  -> structured result
  -> customer-facing response + quick actions
```

### Controlled learning flow

```text
User feedback / correction
  -> pending or quarantined record
  -> validation / admin review
  -> approve or reject
  -> versioned knowledge update
  -> optional embedding for RAG
  -> future conversations can retrieve the approved knowledge
```

This keeps the system auditable and avoids presenting unverified user claims as business facts.

> Bát Tự / spiritual-direction suggestions are cultural references only and should not be treated as mandatory or professional decision criteria.

## Database & Migrations

- Base schema and demo data: [`backend/database/DBase.sql`](./backend/database/DBase.sql)
- Seed script: [`backend/database/seed.sql`](./backend/database/seed.sql)
- Versioned migrations: [`backend/database/migrations/`](./backend/database/migrations/)
- Migration notes: [`backend/database/migrations/README.md`](./backend/database/migrations/README.md)

Do not place real credentials or secrets in SQL files or commits.

## Testing

Backend:

```bash
cd backend
npm test
npm run test:e2e
```

Frontend:

```bash
cd frontend
npm test
npm run build
```

ML service:

```bash
cd ml-service
python -m pytest -q
```

## Team

| Student ID | Member | Main responsibility in the project plan |
| --- | --- | --- |
| 24127318 | Võ Tấn An | Project Manager / Business Analyst / Documentation Lead |
| 24127147 | Mai Khánh Băng | Frontend — Customer Portal |
| 24127435 | Đoàn Võ Ngọc Lâm | Frontend — Admin Portal & 2D Map |
| 24127204 | Nguyễn Ngọc Minh | Backend — Core System & Database |
| 24127037 | Trần Minh Hiển | Backend — Services, Notifications, AI Agent & Deployment |

**Supervisor:** Trương Phước Lộc · Trần Duy Hoàng  
**Course:** Introduction to Software Engineering · Software Engineering Department · University of Science, VNU-HCM

## Documentation

- [Backend README](./backend/README.md)
- [Backend API Documentation](./backend/API_DOCUMENTATION.md)
- [AI Agent Technical Specification](./AI_AGENT_CODEX_README.md)
- [AI Agent v17 Test Guide](./backend/AI_AGENT_V17_TEST_GUIDE.md)
- [AI Agent v18 Test Guide](./backend/AI_AGENT_V18_TEST_GUIDE.md)
- [Run Backend Locally (Vietnamese)](./HUONG_DAN_CHAY_BACKEND_LOCAL.md)
- [Database Sync After Pull (Vietnamese)](./HUONG_DAN_DONG_BO_DATABASE_SAU_KHI_PULL.md)
- [ML Service README](./ml-service/README.md)

## Collaboration Guidelines

Recommended branch flow for the course project:

```text
main                  stable/demo branch
develop               integration branch
feature/<name>        feature development
fix/<name>            bug fixes
```

- Keep secrets out of Git. Commit `.env.example`, never a real `.env`.
- Use clear commits and pull requests instead of pushing unfinished work directly to `main`.
- Test the affected module before integration.
- Keep database changes in versioned migration files.

## Project Notice

This repository is an **academic software engineering project**. It currently does not include an open-source license. Third-party services, AI APIs, SMS, and payment behavior may be configured, limited, mocked, or disabled depending on the demonstration environment.

---

<div align="center">
  <strong>Vĩnh Phúc Viên</strong><br/>
  Digital cemetery management with respectful design, structured operations, and grounded AI assistance.
</div>
