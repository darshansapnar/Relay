# Phase 1 Setup & Verification Guide

This document covers setup, development workflows, and verification details for **Phase 1: Project Setup and Initial Landing Page**.

---

## Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher (v11+ recommended)

---

## Installation

Install all monorepo dependencies across `apps/*` and `packages/*` using npm workspaces from the root directory:

```bash
npm install
```

---

## Environment Configuration

Both backend and frontend apps utilize `.env.example` templates.

### Backend (`apps/api/.env`)

```bash
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

### Frontend (`apps/web/.env`)

```bash
VITE_API_URL=http://localhost:5000/api
VITE_APP_TITLE=Relay
```

---

## Running the Applications

### Start Both Services (Recommended)

```bash
npm run dev
```

This boots:

- Express API server on `http://localhost:5000`
- React Vite frontend on `http://localhost:5173`

### Start Individual Services

```bash
# Start frontend only
npm run dev:web

# Start backend only
npm run dev:api
```

---

## Quality & Verification Commands

```bash
# Lint all workspaces
npm run lint

# Format code with Prettier
npm run format

# Build frontend production bundle
npm run build
```

---

## API Health Check

Query the running backend server:

```bash
curl http://localhost:5000/api/health
```

Expected JSON response:

```json
{
  "status": "ok",
  "service": "relay-api",
  "uptime": 12.34,
  "timestamp": "2026-10-13T01:10:00.000Z",
  "environment": "development"
}
```

---

## Phase 1 Scope & Implementation Status

| Feature / Requirement                 | Status     | Notes                                                         |
| :------------------------------------ | :--------- | :------------------------------------------------------------ |
| npm workspaces monorepo               | Completed  | Root `package.json` with `apps/*` & `packages/*`              |
| Express Backend with ES modules       | Completed  | Native ES modules, modular routers & controllers              |
| `GET /api/health`                     | Completed  | Returns structured health JSON with uptime & environment      |
| Centralized error handler & logger    | Completed  | Express middleware stack with morgan & error handler          |
| CORS Configuration                    | Completed  | Whitelists `http://localhost:5173`                            |
| React + Vite Frontend                 | Completed  | JavaScript ES modules (no TypeScript)                         |
| Tailwind CSS Dark SaaS Design         | Completed  | Custom palette (`relay-*`), subtle gradients & glowing badges |
| Landing Page: Hero, Preview, Features | Completed  | Includes interactive video preview & in-room AI copilot       |
| Create & Join Meeting buttons         | Staged     | Clear modal placeholders indicating Phase 2 readiness         |
| ESLint & Prettier                     | Configured | Flat config format supporting ES modules                      |
