# Relay Architecture Documentation

## Overview

**Relay** is an AI-powered video conferencing platform with an intelligent in-meeting assistant that provides real-time transcription, automated meeting notes, and action item detection.

This document describes the architectural layout established during **Phase 1: Foundation & Landing Page**.

---

## Monorepo Layout

The repository is organized as an **npm workspaces** monorepo:

```text
relay/
├── apps/
│   ├── web/                     # React + Vite frontend application
│   │   ├── src/
│   │   │   ├── components/      # UI, layout, modals, and landing sections
│   │   │   ├── App.jsx          # Root view composition
│   │   │   ├── index.css        # Tailwind directives and custom utility classes
│   │   │   └── main.jsx         # React DOM entrypoint
│   │   ├── index.html           # HTML5 entry with SEO tags & typography
│   │   ├── tailwind.config.js   # Custom dark navy/charcoal SaaS theme tokens
│   │   ├── vite.config.js       # Vite build & /api reverse proxy configuration
│   │   └── package.json
│   └── api/                     # Node.js + Express backend service
│       ├── src/
│       │   ├── config/          # Dotenv configuration & environment variables
│       │   ├── controllers/     # Route logic (health status, etc.)
│       │   ├── middlewares/     # Centralized error handler, 404, request logger
│       │   ├── routes/          # API route definitions
│       │   ├── app.js           # Express app instance and middleware pipeline
│       │   └── index.js         # HTTP server entrypoint and graceful shutdown
│       └── package.json
├── packages/
│   └── shared/                  # Common JavaScript utilities & constants
│       ├── src/
│       │   ├── constants.js     # Shared configuration, status enums, route paths
│       │   └── index.js         # Package export entry
│       └── package.json
├── docs/                        # Architecture & engineering documentation
│   ├── architecture.md
│   └── phase-1-setup.md
├── .gitignore                   # Workspace gitignore
├── .prettierrc                  # Prettier code formatting rules
├── eslint.config.js             # Flat ESLint configuration
├── package.json                 # Monorepo root workspaces config
└── README.md                    # Primary developer guide
```

---

## Service Boundaries & Communication

1. **Frontend (`@relay/web`)**:
   - Built with pure JavaScript (ES modules) and React 18 with Vite.
   - Tailored with Tailwind CSS using a dark navy/charcoal palette (`#070A10`, `#0C111C`, `#161F33`, with `#3B82F6` and `#8B5CF6` accents).
   - In development, Vite reverse-proxies `/api` requests directly to `http://localhost:5000` to prevent CORS issues.

2. **Backend (`@relay/api`)**:
   - Express 4.x running natively on Node.js using ES modules (`"type": "module"`).
   - CORS middleware configured with explicit whitelist supporting the Vite frontend origin (`http://localhost:5173`).
   - Centralized error handling catches all uncaught exceptions, formatting standardized JSON payloads while omitting internal stack traces in production.
   - Exposes `GET /api/health` providing service name, status, uptime, and environment.

3. **Shared (`@relay/shared`)**:
   - Contains immutable constants (port defaults, application metadata, meeting status lifecycle) utilized by both client and server packages.

---

## Future Phase Integration Points

- **Phase 2 (Video Infrastructure)**:
  - Integration of LiveKit SFU client SDK into `@relay/web`.
  - Token minting and room access control endpoints in `@relay/api`.
  - Interactive WebRTC video and audio rendering.
- **Phase 3 (AI Meeting Intelligence)**:
  - Real-time audio stream pipeline into transcription service.
  - Streaming LLM inference for agenda detection, topic clustering, and action items.
