# WhatsApp Travel Planning Assistant

AI-powered WhatsApp agent for couples to plan trips end-to-end: destinations, itinerary, tasks, decisions, and reminders.

## Stack

- Backend: Node.js + Express 4 (Railway-ready)
- DB: Prisma ORM (PostgreSQL datasource)
- AI: Anthropic-compatible Messages API
- WhatsApp: Twilio Programmable Messaging webhook
- Scheduler: node-cron reminders
- Frontend simulator: React + Vite (Vercel-ready)

## Architecture

- WhatsApp user messages -> Twilio webhook `POST /api/webhook/whatsapp`
- Webhook -> message handler orchestrator -> AI + tool execution
- Tools read/write persisted trip memory via Prisma models
- API endpoints expose trips, tasks, itinerary, users, preferences
- Reminder service runs cron jobs and sends due task notifications
- Local simulator available via `POST /api/dev/simulate`

## Quick Start

1. Install backend dependencies:

```bash
npm install
```

2. Configure env:

```bash
cp .env.example .env
```

3. Set required variables in `.env`:

- `DATABASE_URL`
- `AI_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_NUMBER`

4. Initialize Prisma and DB:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

5. Start backend:

```bash
npm run dev
```

6. Start frontend simulator (separate terminal):

```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

### Webhook

- `POST /api/webhook/whatsapp` Twilio incoming message webhook
- `GET /api/webhook/whatsapp` webhook health check

### REST API

- `GET /api/health`
- `GET /api/trips?userId=X`
- `GET /api/trips/:id`
- `GET /api/trips/:id/tasks`
- `PATCH /api/tasks/:id/status`
- `GET /api/trips/:id/itinerary`
- `GET /api/users?phone=X`
- `GET /api/users/:id/preferences`

### Dev Simulator

- `POST /api/dev/simulate`
- `GET /api/dev/simulate`

## Deployment

### Railway backend

- Set `DATABASE_URL` to Railway Postgres
- Set all Twilio and AI env vars
- Deploy from repo root
- Start command: `npm run start`

### Vercel frontend

- Deploy `frontend` folder as separate project
- Set `VITE_API_BASE_URL` to Railway backend URL
- Build command: `npm run build`
- Output dir: `dist`

## Twilio Sandbox Setup

1. Join sandbox from Twilio console
2. Set incoming webhook to:

- `https://<your-backend-domain>/api/webhook/whatsapp`

3. Method: `POST`

## Tool Actions Supported by AI

- `create_trip`
- `update_trip`
- `add_destination`
- `remove_destination`
- `add_task`
- `complete_task`
- `add_itinerary_item`
- `set_preference`
- `log_decision`
