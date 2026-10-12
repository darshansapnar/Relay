# Relay

> **Relay** is an AI-powered video conferencing platform with an intelligent in-meeting assistant that delivers automated transcription, real-time smart summaries, and proactive action item extraction.

---

## Architecture Overview

Relay is structured as an **npm workspaces monorepo**:

- **`apps/web`**: Modern React application built with Vite and Tailwind CSS using pure JavaScript ES modules (no TypeScript). Integrates LiveKit React components and WebRTC media tracks.
- **`apps/api`**: Modular Node.js Express API service utilizing native ES modules, LiveKit server SDK token minting, input validation, dotenv environment management, centralized error handling, and CORS.
- **`packages/shared`**: Shared JavaScript library containing constants and routing contracts across client and server.
- **`docs/`**: Technical engineering documentation covering architecture design and phase guides.

```text
Relay/
├── apps/
│   ├── web/               # React + Vite frontend (LiveKit client SDK)
│   └── api/               # Express backend API (LiveKit server SDK)
├── packages/
│   └── shared/            # Shared utilities & constants
├── docs/                  # Documentation & design specifications
│   ├── architecture.md
│   ├── phase-1-setup.md
│   ├── phase-2-meeting-room.md
│   └── phase-3-livekit.md
├── .gitignore
├── .prettierrc
├── eslint.config.js
├── package.json
└── README.md
```

---

## Getting Started

### 1. Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- **LiveKit Cloud Project** (or self-hosted LiveKit server)

### 2. Install Dependencies

Run from the root directory:

```bash
npm install
```

### 3. Environment Configuration

Copy the example environment files into local `.env` files:

```bash
# Backend
cp apps/api/.env.example apps/api/.env

# Frontend
cp apps/web/.env.example apps/web/.env
```

#### Backend Environment Variables (`apps/api/.env`):

```env
# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# LiveKit Server SDK Credentials (keep secret, never expose to client)
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
```

> **Security Note**: LiveKit API credentials exist exclusively on the Express backend server. They are never exposed in frontend code, client builds, or browser bundles.

---

## Application Routes

| Route              | View          | Description                                                                                                                         |
| :----------------- | :------------ | :---------------------------------------------------------------------------------------------------------------------------------- |
| `/`                | `LandingPage` | Product overview, feature showcase, interactive video preview, live backend health diagnostics, and room launch dialogs.            |
| `/meeting/:roomId` | `MeetingPage` | Pre-join media setup and live video conference workspace with real-time WebRTC audio, video, and screen sharing powered by LiveKit. |

---

## Available Commands

| Command                | Description                                                                       |
| :--------------------- | :-------------------------------------------------------------------------------- |
| `npm run dev`          | Runs both backend API (`:5000`) and frontend web app (`:5173`) concurrently       |
| `npm run dev:api`      | Starts only the Express API server with file watch mode (`http://localhost:5000`) |
| `npm run dev:web`      | Starts only the React Vite dev server (`http://localhost:5173`)                   |
| `npm run build`        | Builds the frontend production bundle                                             |
| `npm run lint`         | Runs ESLint across all packages and applications                                  |
| `npm run lint:fix`     | Automatically fixes ESLint errors across the workspace                            |
| `npm run format`       | Formats all code using Prettier                                                   |
| `npm run format:check` | Checks code formatting without writing changes                                    |

---

## API Endpoints

### 1. Health Status

- **Method**: `GET`
- **Route**: `http://localhost:5000/api/health`
- **Response**:
  ```json
  {
    "status": "ok",
    "service": "relay-api",
    "uptime": 24.15,
    "timestamp": "2026-10-13T01:10:00.000Z",
    "environment": "development"
  }
  ```

### 2. LiveKit Meeting Token Minting

- **Method**: `POST`
- **Route**: `http://localhost:5000/api/meetings/token`
- **Request Body**:
  ```json
  {
    "roomName": "rel-product-sync",
    "participantName": "Alex Rivers"
  }
  ```
- **Validation Rules**:
  - `roomName`: Required string, 1–64 characters, sanitized to alphanumeric, dashes, dots, and underscores.
  - `participantName`: Required string, 1–64 characters, sanitized against HTML/control characters.
  - Generates unique server-side participant identity (`user_${timestamp}_${uuid}`).
  - Scopes permissions strictly to the requested room (join, publish, subscribe, data).
  - Configures a short-lived token (2-hour TTL).
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "token": "<signed-jwt-access-token>",
    "url": "wss://your-project.livekit.cloud",
    "roomName": "rel-product-sync",
    "participantIdentity": "user_1791838080354_81f8a349",
    "participantName": "Alex Rivers"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Input validation failure (missing or invalid room/participant name).
  - `503 Service Unavailable`: Server environment missing LiveKit credentials.

---

## Implementation Status & Feature Matrix

### Phase 1: Foundation & Scaffold (Completed)

- [x] npm workspaces monorepo setup (`apps/*`, `packages/*`).
- [x] Express backend with ES modules, CORS, dotenv, and centralized error handling.
- [x] Landing page with dark SaaS aesthetic and live API diagnostics.

### Phase 2: Meeting Room UI & Layout (Completed)

- [x] Client-side routing with `react-router-dom` (`/` and `/meeting/:roomId`).
- [x] Modular meeting room UI components (`MeetingHeader`, `ParticipantGrid`, `MeetingControls`, `ParticipantsPanel`, `AssistantPanel`).
- [x] Responsive layout across desktop, tablet, and mobile (390px).

### Phase 3: Real-Time LiveKit Video & Audio (Completed)

- [x] **LiveKit Server Integration**:
  - Official `livekit-server-sdk` integrated into `apps/api`.
  - Token minting endpoint `POST /api/meetings/token` with strict parameter validation and sanitization.
  - Server-generated unique identities preventing identity spoofing.
  - Room-scoped permissions with short-lived 2-hour TTL.
  - Secrets strictly kept on backend; safe 503 response when configuration is missing.
- [x] **LiveKit Client Integration**:
  - Official `livekit-client` and `@livekit/components-react` integrated into `apps/web`.
  - Seamless connection flow through `<LiveKitRoom>` and `<RoomAudioRenderer>`.
  - **PreJoin Screen (`PreJoinScreen`)**: Collects user display name and media device preferences; offers clear error notices with a "Retry Connection" action.
  - **Real Participant Tracks (`LiveParticipantGrid`, `LiveParticipantTile`)**: Renders actual video tracks via `<VideoTrack>`, initials avatar when camera is off, and active speaker visual state with animated soundwaves.
  - **Real Media Toggles (`LiveMeetingControls`)**: Live microphone and camera hardware toggling.
  - **Screen Sharing**: Real-time display capture via LiveKit's `localParticipant.setScreenShareEnabled()` with dedicated stage layout.
  - **Participants Roster (`LiveParticipantsPanel`)**: Real-time list of connected participants, search filtering, and live mic/video statuses.
  - **Clean Disconnect**: Full track cleanup and unmounting on leave, with confirmation modal.

---

## Testing Real-Time Meetings (Two-Browser Verification)

Once your LiveKit Cloud credentials (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`) are saved in `apps/api/.env`:

1. **Start the application**:
   ```bash
   npm run dev
   ```
2. **Open Participant 1**:
   - Navigate to `http://localhost:5173/` in Browser Window 1 (e.g. Chrome).
   - Click **Create Meeting**, enter your name (e.g. "Alice"), and click **Create & Enter Room**.
   - Note the room ID (e.g. `rel-room-4821`).
   - Allow camera and microphone permissions when prompted by your browser.
3. **Open Participant 2**:
   - Open a separate browser window or Incognito window (e.g. Firefox or Chrome Incognito).
   - Navigate to `http://localhost:5173/` and click **Join Meeting**.
   - Enter the same room ID (`rel-room-4821`) and a distinct name (e.g. "Bob").
   - Click **Join Meeting Room** and confirm on the PreJoin screen.
4. **Verify Real-Time Media**:
   - Both participants appear in each other's participant grid with real video tracks.
   - Speaking triggers the animated audio soundwave indicator on the speaking tile.
   - Toggling mute updates the microphone badge on both screens.
   - Clicking **Share Screen** renders the screen capture in the main stage.
   - Clicking **End Call** confirms and disconnects cleanly.

> **Verification Note**: Two-browser testing with active WebRTC media exchange requires active LiveKit Cloud credentials configured in `apps/api/.env`. In local development without saved credentials, the token validation pipeline, error handling (503), PreJoin screen, and recovery mechanisms have been automatedly verified via browser agents.

---

## Known Limitations & Next Steps (Phase 4 Roadmap)

- **Audio Recording & Archiving**: Staged for upcoming cloud egress integration.
- **Real-Time Speech-to-Text Transcription**: Staged for Whisper / LiveKit agents integration in Phase 4.
- **AI Meeting Summaries & Action Items**: Relay Copilot UI empty states are ready; streaming LLM inference will connect in Phase 4.
- **Database Persistence**: Meeting rooms and participant logs are currently ephemeral in memory.
- **Production Authentication**: Future production releases will require session authentication (OAuth / JWT) to prevent token abuse.
