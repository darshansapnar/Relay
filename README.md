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

# Neon Serverless PostgreSQL Configuration (keep secret, never expose to client)
# Pooled connection string (uses PgBouncer with -pooler hostname for web app traffic)
DATABASE_URL=postgresql://neondb_owner:<password>@<endpoint-id>-pooler.<region>.aws.neon.tech/relay?sslmode=require
# Direct connection string (unpooled host for schema migrations / DDL)
DATABASE_URL_UNPOOLED=postgresql://neondb_owner:<password>@<endpoint-id>.<region>.aws.neon.tech/relay?sslmode=require
```

> **Security Note**: LiveKit and Neon PostgreSQL credentials exist exclusively on the Express backend server (`apps/api/.env`). They are never exposed in frontend code, client builds, or browser bundles. Connection strings and passwords are never output in server logs or API health responses.

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

### 1. Health Status & Database Diagnostics

- **Method**: `GET`
- **Route**: `http://localhost:5000/api/health`
- **Response**:
  ```json
  {
    "status": "ok",
    "service": "relay-api",
    "uptime": 24.15,
    "timestamp": "2026-10-14T07:20:00.000Z",
    "environment": "development",
    "database": {
      "status": "connected",
      "responseTimeMs": 35,
      "database": "relay",
      "serverTime": "2026-10-14T07:20:00.000Z",
      "isPooled": true,
      "pool": {
        "total": 1,
        "idle": 1,
        "waiting": 0
      },
      "timestamp": "2026-10-14T07:20:00.000Z"
    }
  }
  ```

- **Method**: `GET`
- **Route**: `http://localhost:5000/api/health/db`
- **Response**: Returns the database health object directly (`200 OK` on connected or not_configured, `503 Service Unavailable` on database error).

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

### Phase 4: Meeting Recording & Audio Capture (Completed)

Meeting recording is **entirely browser-local**: no LiveKit Egress, no cloud upload, no backend route. The host's own browser mixes everyone's live audio with the Web Audio API and encodes it with `MediaRecorder`; the finished file downloads straight to the host's device.

- [x] **Browser-local Web Audio mixing (`utils/localAudioRecorder.js`)**: `LocalAudioMixRecorder` wires every current audio `MediaStreamTrack` (the host's own mic + every subscribed remote participant's mic) into one `AudioContext` → `MediaStreamAudioDestinationNode` graph, then records that mixed destination stream with `MediaRecorder` at `audio/webm;codecs=opus` -- audio-only; video is never touched.
- [x] **Live reconciliation, not a fixed snapshot**: `MeetingRoomLive.jsx` listens directly to LiveKit's `TrackSubscribed`/`TrackUnsubscribed`/`TrackMuted`/`TrackUnmuted`/`LocalTrackPublished`/`LocalTrackUnpublished`/`ParticipantConnected`/`ParticipantDisconnected`/`Reconnected` room events and re-syncs the mix on every one of them, so a participant joining, leaving, muting, unmuting, or reconnecting mid-recording is reflected within one event, not just at start time.
- [x] **Host-authorized controls, using the app's existing authoritative host identity**: the Start/Stop control is gated by the same server-assigned `participant.attributes.role === 'host'` flag (set once at token mint time, synced by LiveKit, not client-forgeable) used by every other host-only feature in this app. Since recording is 100% local to the host's own browser process, there is no separate network action for another participant to forge -- the UI gate _is_ the authorization boundary here.
- [x] **Consent & notification workflow**: starting requires an explicit confirmation dialog (`RecordingConsentDialog`) before anything records. The instant it starts, the host writes `localRecording`/`localRecordingStartedAt`/`localRecordingHostName` to their own LiveKit participant attributes via `localParticipant.setAttributes()` -- LiveKit syncs attributes to every participant on every change **and** as part of a joining participant's initial room-state sync, which is what lets someone who joins mid-recording see the "Recording" banner immediately, something a one-shot broadcast message cannot do.
- [x] **Consent can be withdrawn by anyone, at any time**: every non-host participant's banner has a "Withdraw Consent" action that sends a point-to-point decline message over LiveKit's data channel (`relay-local-recording` topic); the host's client reacts by stopping immediately, regardless of who clicked Start.
- [x] **Live status UI**: elapsed-time counter, who started it, for everyone; a "Recording stopped" confirmation (and, for the host, "...and saved to your device") afterward.
- [x] **Local-only download**: on stop, the mixed audio `Blob` is handed to the browser's own download flow (an `<a download>` click) as a `.webm` file -- never uploaded anywhere, never touches the Relay backend.
- [x] **Resource cleanup**: every audio node, `MediaStream`, and the `AudioContext` itself are torn down on stop, on the room disconnecting (host leaves/loses connection/ends the meeting), and on component unmount -- plus a `beforeunload` guard warning against closing the tab mid-recording.
- [x] **Browser capability detection**: `isLocalRecordingSupported()` checks for `AudioContext` + `MediaRecorder` + `MediaRecorder.isTypeSupported('audio/webm;codecs=opus')` up front; the Record control is disabled with an explanatory tooltip on browsers that can't produce that format (see Browser Compatibility below), instead of letting a click fail.

---

## Browser Compatibility (Local Recording)

| Browser                   |  Supported?   | Notes                                                                                                                                                                                 |
| :------------------------ | :-----------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Chrome / Edge (desktop)   |      ✅       | Full support for `AudioContext`, `MediaRecorder`, and `audio/webm;codecs=opus`. Verified live in this change.                                                                         |
| Firefox (desktop)         | ✅ (expected) | Firefox has supported `MediaRecorder` with `audio/webm;codecs=opus` for years; not verified live in this change -- please confirm in your own testing.                                |
| Safari (desktop & iOS)    |      ❌       | Safari's `MediaRecorder` does not support the WebM container. The Record button is disabled with an explanatory tooltip rather than silently failing or producing an unplayable file. |
| Chrome / Firefox (mobile) |  ⚠️ Untested  | Should work in principle (same APIs), but was not part of this change's testing scope.                                                                                                |

Recording is always **audio-only**, and always produces a `.webm` (Opus) file. There is no fallback to another container/codec in this phase -- per the requirements, downloads are only ever offered when the browser genuinely supports that specific format.

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

## In-Meeting Real-Time Chat (Everyone & Private Direct Messages)

Relay includes a complete Zoom-style in-meeting chat system powered by Socket.IO real-time delivery, Neon Serverless PostgreSQL persistence, cryptographically verified LiveKit access tokens, and strict server-side privacy boundaries.

### Architecture & Design

```text
┌─────────────────┐       Socket.IO Handshake (Verified LiveKit JWT)       ┌────────────────────────┐
│  Browser Client │ ─────────────────────────────────────────────────────► │ Relay Express Backend  │
│  (React + Vite) │ ◄───────────────────────────────────────────────────── │ (Socket.IO + REST API) │
└─────────────────┘                                                        └───────────┬────────────┘
         ▲                                                                             │
         │                        Message Dispatch & Filtering                         ▼
         │                 ┌────────────────────────────────────────────────────────────────────────┐
         └──────────────── │ • Everyone Chat: broadcast to room:roomName                            │
                           │ • Private DM: sent ONLY to user:room:recipient & user:room:sender       │
                           │ • History Query: filtered server-side (only authorized messages)        │
                           │ • Neon PostgreSQL: persistent chat_messages & meeting_memberships       │
                           │ • Rate Limiting: sliding window (max 5 msgs/2s per participant)        │
                           │ • Max Length: 2,000 characters with control-character sanitization     │
                           └───────────────────────────────────┬────────────────────────────────────┘
                                                               │
                                                               ▼
                                              ┌─────────────────────────────────┐
                                              │    Neon Serverless Postgres     │
                                              │   • chat_messages               │
                                              │   • meeting_memberships         │
                                              │   • chat_read_states            │
                                              │   • schema_migrations           │
                                              └─────────────────────────────────┘
```

### Database Schema & Migrations

Chat data is persisted in Neon Serverless PostgreSQL. Database migrations are managed via versioned SQL files in [`apps/api/src/db/migrations/`](file:///e:/PROJECTS/Relay/apps/api/src/db/migrations/).

#### Migration Runner:
Migrations run automatically on server start or can be executed manually:
```bash
node apps/api/src/db/migrate.js
```

#### Tables:
1. **`meeting_memberships`**: Stores room participants, identities, display names, host flags, and join timestamps for access control after reconnects.
2. **`chat_messages`**: Stores message payloads (`id`, `client_message_id`, `room_name`, `target_type`, `sender_identity`, `sender_name`, `recipient_identity`, `recipient_name`, `content`, `created_at`).
   - `target_type`: `'everyone'` or `'direct'`.
   - Unique partial index on `(room_name, sender_identity, client_message_id)` for network-retry deduplication.
   - Partial indexes on `(room_name, created_at DESC) WHERE target_type = 'everyone'` and direct message sender/recipient indexes for fast queries.
3. **`chat_read_states`**: Tracks per-participant read positions for unread counter badges.
4. **`schema_migrations`**: Records applied migration versions idempotently.

### Socket.IO Real-Time Event Protocol

All Socket.IO connections are authenticated via LiveKit JWTs in the handshake (`auth: { token, roomName }`).

| Event | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `chat:send` | Client → Server | `{ content, targetType, recipientIdentity, recipientName, clientMessageId }` | Sends an everyone or private message. Returns ack `{ success, message }`. |
| `chat:message` | Server → Client | `{ id, content, senderIdentity, senderName, targetType, recipientIdentity, timestamp }` | Delivered to authorized meeting participants in real time. |
| `chat:getHistory` | Client → Server | `{ limit, before, targetType, peerIdentity }` | Paginated retrieval of authorized chat history. Returns `{ success, messages, hasMore, nextCursor, unread }`. |
| `chat:markRead` | Client → Server | `{ targetType, peerIdentity, lastReadMessageId }` | Updates read state. Returns `{ success, unread }`. |
| `chat:unreadUpdate` | Server → Client | `{ everyone, directTotal, directByPeer }` | Real-time push of updated unread counts. |
| `chat:error` | Server → Client | `{ error, code, retryAfterMs }` | Sent on validation, rate-limiting, or server error. |

### Security & Privacy Controls

1. **Cryptographic Identity Verification**:
   - Identity is derived exclusively from the signed LiveKit access token (`claims.sub`, `claims.name`, `claims.video.room`).
   - Client-supplied sender identities or host flags are never accepted or trusted.
2. **Strict Direct Message Isolation**:
   - Private messages are never broadcast to the room channel.
   - Socket routing delivers private messages strictly to `user:${roomName}:${recipientIdentity}` and `user:${roomName}:${senderIdentity}`.
   - PostgreSQL queries filter direct messages with parameterized SQL (`WHERE target_type = 'everyone' OR (target_type = 'direct' AND ($2 IN (sender_identity, recipient_identity)))`).
   - Third-party participants cannot access private messages through real-time events, REST endpoints, or history queries.
3. **Recipient Membership Validation**:
   - For direct messages, the backend verifies that the recipient is an authorized member of the meeting via `meeting_memberships` before persistence and delivery.
4. **Abuse Prevention**:
   - Input sanitization strips control characters while preserving standard unicode and emojis.
   - Message length is enforced up to 2,000 characters.
   - Sliding-window rate limiting restricts message flooding (max 5 messages per 2-second window).
5. **No Secrets in Logs or Client**:
   - Database connection strings and tokens are masked. Client never sees database credentials.

### Chat API Endpoints (REST Fallback)

#### 1. Retrieve Authorized Chat Messages

- **Method**: `GET`
- **Route**: `http://localhost:5000/api/meetings/:roomName/messages`
- **Header**: `Authorization: Bearer <livekit-access-token>`
- **Query Params**: `limit` (default 50), `before` (cursor), `targetType`, `peerIdentity`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "messages": [
      {
        "id": "msg_1728901234567_abc12345",
        "roomName": "rel-sync",
        "targetType": "everyone",
        "senderIdentity": "user_1728900000000_12345678",
        "senderName": "Alice",
        "recipientIdentity": null,
        "recipientName": null,
        "content": "Hello team!",
        "timestamp": 1728901234567,
        "createdAt": "2026-10-14T12:00:00.000Z"
      }
    ],
    "hasMore": false,
    "nextCursor": null,
    "unread": { "everyone": 0, "directTotal": 0, "directByPeer": {} },
    "participantIdentity": "user_1728900000000_12345678"
  }
  ```

#### 2. Send Message via REST Fallback

- **Method**: `POST`
- **Route**: `http://localhost:5000/api/meetings/:roomName/messages`
- **Header**: `Authorization: Bearer <livekit-access-token>`
- **Request Body**:
  ```json
  {
    "content": "Secret note for Bob",
    "targetType": "direct",
    "recipientIdentity": "user_1728900000000_87654321",
    "recipientName": "Bob"
  }
  ```

---

## Testing Real-Time Chat (Manual Verification Instructions)

To verify Everyone chat, Private DMs, and strict privacy isolation:

1. **Launch the project**:
   ```bash
   npm run dev
   ```
2. **Open Window 1 (Host/Alice)**:
   - Navigate to `http://localhost:5173`.
   - Click **Create Meeting**, enter name **Alice**, and click **Join Meeting**.
   - Note the room ID from the URL or click **Copy Link**.
3. **Open Window 2 (Guest/Bob)**:
   - Open a private / incognito browser window.
   - Navigate to the room URL, enter name **Bob**, and join.
4. **Open Window 3 (Observer/Charlie)**:
   - Open a third browser window (or different browser, e.g. Edge).
   - Navigate to the room URL, enter name **Charlie**, and join.
5. **Verify Everyone Chat**:
   - In Window 1 (Alice), click the **Chat** icon in the bottom control bar to open the chat sidebar.
   - Ensure the tab is set to **Everyone**.
   - Send: `"Hello everyone!"`.
   - Verify: Windows 2 (Bob) and 3 (Charlie) receive the message in real time, with Alice's name and timestamp.
   - In Windows 2 and 3 with the chat sidebar closed, verify the **Chat** button displays a blue unread message badge (`1`).
6. **Verify Private Direct Messages**:
   - In Window 1 (Alice), click **Direct Messages** tab or select **To: Bob (Direct)** in the recipient dropdown.
   - Send: `"Hey Bob, this is a private message for you."`.
   - Verify: Window 2 (Bob) receives the direct message with a distinct amber `(Private)` badge.
   - Verify: If Bob's chat panel was closed, Bob's Chat button displays an amber/priority unread badge (`1`).
   - Verify in Window 3 (Charlie): Charlie's chat panel **does not** receive the message, Charlie's unread counter does **not** increment, and querying messages yields zero visibility of Alice & Bob's private message.
7. **Verify Quick Direct Message from Participants Panel**:
   - In Window 2 (Bob), open the **Participants** panel.
   - Next to Alice, click the **Message** button.
   - Verify the Chat panel opens automatically with Alice preselected for direct messaging.
8. **Verify Disconnection & History Restoration**:
   - Refresh Window 2 (Bob).
   - Re-open the Chat panel after reconnecting.
   - Verify that all previous Everyone messages and Alice's private message to Bob are fully restored from history, while remaining invisible to Charlie.
9. **Verify Input Validation & Rate Limiting**:
   - Try sending an empty message or whitespace only; verify the Send button is disabled.
   - Send more than 5 messages in 2 seconds; verify the inline rate-limit banner prompts to wait briefly before retrying.

---

Unlike a cloud-recording approach, this needs no external service to test -- just real LiveKit Cloud credentials (already required for any meeting) and two browser windows.

1. **Open two browser windows** and join the same room as Host and Guest (see the two-browser steps above).
2. **Start recording**: as the host, click the record button in the control bar, confirm in the "Start Recording?" dialog. Verify:
   - Both windows show the red "Recording" banner with a live elapsed timer within a couple of seconds of each other.
   - The banner names the host who started it, and states that staying in the meeting means consenting to the recording.
   - The host's banner shows a "Stop Recording" action; the guest's banner shows "Withdraw Consent" instead.
3. **Speak from both windows** for at least 10–15 seconds each, so both participants' audio is captured.
4. **Join a third window mid-recording** and verify it shows the recording banner immediately on connecting, without needing to wait or refresh.
5. **Exercise mid-recording changes**: mute/unmute the guest's mic, and confirm nothing errors and the recording keeps running.
6. **Withdraw consent**: from a non-host window, click "Withdraw Consent" and verify the host's recording stops automatically (not just on that one participant's screen -- everyone's banner moves to "Recording stopped").
7. **Stop recording** (if not already stopped by the step above): host clicks "Stop Recording". Verify every window's banner moves to "Recording stopped" (the host's additionally says "...and saved to your device"), and that a `.webm` file download is triggered in the host's browser only.
8. **Play back the downloaded file** and confirm it contains audible speech from both participants, not just the host. This is the step that actually proves "records participant audio, not just the host's local microphone."
9. **Browser support gating**: open the app in Safari (or any browser without WebM/Opus `MediaRecorder` support) and confirm the Record button is disabled with an explanatory tooltip rather than failing after being clicked.

> **Status of this verification in this change**: this was tested live, end to end, with real LiveKit Cloud credentials and up to three simultaneous real browser tabs/participants (Chrome). Confirmed working: host-only gating, the consent dialog, the live elapsed-time banner, a late joiner seeing the recording notice immediately on connect (step 4), muting/unmuting mid-recording without errors, consent withdrawal auto-stopping the host's recording (step 6), and a clean `.webm` download on stop. The downloaded recording was decoded with the Web Audio API and confirmed to be a valid, continuous, non-silent audio file (~84s duration, 2-channel, matching the recorded wall-clock time), and the mixer's internal source list was directly inspected during recording and confirmed to contain **both** participants' tracks simultaneously. **What is explicitly NOT verified**: literally listening to the file and confirming two distinguishable human voices (step 8) -- this sandboxed testing environment uses Chrome's synthetic fake-microphone device for both simulated participants, which produces an identical synthetic tone per tab rather than distinguishable speech, so there is no way to audibly tell two "voices" apart here even though both tracks are proven to be mixed in. Run step 8 yourself with real microphones to complete that verification. Automated unit tests cover the mixer's reconciliation logic, the consent protocol, and the UI components in isolation -- see `apps/web/src/utils/localAudioRecorder.test.js`, `recordingProtocol.test.js`, and `apps/web/src/components/meeting/RecordingStatusBanner.test.jsx`/`LiveMeetingControls.test.jsx`.

---

## Known Limitations & Next Steps (Phase 5 Roadmap)

- **Real-Time Speech-to-Text Transcription**: Staged for Whisper / LiveKit agents integration.
- **AI Meeting Summaries & Action Items**: Relay Copilot UI empty states are ready; streaming LLM inference will connect in a later phase.
- **Database Persistence**: Meeting rooms and participant logs are currently ephemeral in memory.
- **Recording only captures what the host's browser can hear**: since mixing happens in the host's own browser from their own subscribed audio tracks, the recording's fidelity depends on the host's own network/CPU conditions. If the host's connection to a specific participant degrades, that participant's audio in the recording degrades too, independent of how that participant sounds to everyone else.
- **Recording is lost if the host's tab crashes outright**: `MediaRecorder` is configured to flush data every second (so a crash loses at most ~1 second, not the whole recording) and a `beforeunload` guard warns against closing the tab, but an actual browser/tab crash (not a normal close) cannot be intercepted -- whatever was flushed to that point is what would be recoverable, and this app does not currently implement any such recovery UI.
- **No recording history**: by design for this phase -- the file downloads directly to the host's device on stop; there's no in-app list of past recordings, since nothing is ever uploaded anywhere. Intentionally out of scope; see the Phase 4 requirements.
- **Production Authentication**: Future production releases will require session authentication (OAuth / JWT) to prevent token abuse.

---

## AI Meeting Assistant (Relay Copilot)

Relay includes a complete, production-grade AI Meeting Assistant that provides automated live speech-to-text transcription, cumulative executive summaries, key discussion points, team decisions, and concrete action items with assignees.

### 1. Architecture & Provider Selection
- **Primary LLM**: **Groq** (`openai/gpt-oss-120b`), using `GROQ_API_KEY` and `GROQ_PRIMARY_MODEL`.
- **Fallback LLM**: **Google Gemini** (`gemini-3.5-flash-lite`), using `GEMINI_API_KEY` and `GEMINI_FALLBACK_MODEL`.
- **Speech-to-Text**: **Google Gemini** (`gemini-3.5-transcribe`), using `TRANSCRIPTION_PROVIDER=gemini` and `GEMINI_TRANSCRIPTION_MODEL=gemini-3.5-transcribe` (with Groq Whisper supported via `TRANSCRIPTION_PROVIDER=groq`).
- **Persistence**: **Neon PostgreSQL** stores finalized transcript segments (`meeting_transcripts`), versioned summaries (`meeting_summaries`), and room AI states (`meeting_ai_states`).
- **Real-Time Delivery**: Socket.IO events (`ai:statusUpdate`, `ai:transcriptChunk`, `ai:summaryUpdate`) stream updates to all authorized participants in the room.

### 2. Audio Capture Pipeline
- Captures audio from local mic and remote participant audio tracks in the browser.
- Slices audio chunks (5-7 seconds) per speaker with authenticated speaker attribution (`speakerIdentity`, `speakerName`).
- Transcribes audio into text without storing raw audio on cloud storage.

### 3. Cost Controls & Fallback Safeguards
- **Accumulation & Cooldown**: Only generates summaries after at least `AI_SUMMARY_MIN_CHARS` (default ~1,500 chars) of new discussion and a configurable cooldown (`AI_SUMMARY_COOLDOWN_MS`, default 5 minutes).
- **Hard Cost Limits**: Enforces `AI_MAX_SUMMARIES_PER_MEETING` (default 10), token limits, and `AI_ASSISTANT_ENABLED` global kill switch.
- **Provider Fallback**:
  - Attempts Groq first.
  - On transient errors (5xx/timeout), performs bounded retry with exponential backoff.
  - On rate limits (429) or quota exhaustion, smoothly falls back to Gemini.
  - When both free-tier limits are reached, pauses summarization gracefully and displays:
    `"AI summaries are paused because the free-tier limit has been reached. Your meeting can continue normally."`
  - If transcription quota is reached:
    `"AI transcription is paused because the free-tier limit has been reached."`
- **Zero Paid Surprises**: Never silently switches to paid tiers or incurs unexpected cloud costs.

### 4. Participant Consent & Non-Intrusive UX
- Before processing begins, informs participants and requires explicit confirmation.
- Shows visible "AI Assistant Active" pulsing badge in header and control bar.
- Includes tabs for **Live Transcript**, **Overview**, **Summary**, **Decisions**, and **Action Items**.
- Provides a clean "Stop" button to halt processing at any time.

### 5. Testing with Multiple Participants
1. Start API: `npm run dev -w @relay/api`
2. Start Web: `npm run dev -w @relay/web`
3. Join meeting room as Host in Browser 1.
4. Join meeting room as Guest in Browser 2.
5. In Browser 1, open AI Copilot (Sparkles icon in control bar).
6. Check participant consent and click **Enable AI Assistant**.
7. Speak from Browser 1 and Browser 2; verify transcripts appear with accurate speaker attribution.
8. Click **Generate Summary Now** or wait for cumulative summary update.
9. Verify both Browser 1 and Browser 2 receive real-time summary and action items.

