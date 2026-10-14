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

> **Security Note**: LiveKit API credentials exist exclusively on the Express backend server. They are never exposed in frontend code, client builds, or browser bundles. Meeting recording (below) has no backend component at all -- it needs no additional configuration here.

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

## Testing Meeting Recording (Manual Verification)

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
- **Single recording device**: only the host who clicked Start produces a file; if you need every participant to have their own local copy, that would need to be a separate "everyone records their own audio" feature, not built here.
- **Not tested**: Firefox and mobile browsers (expected to work given their `MediaRecorder`/WebM support, but not exercised in this change's live testing -- see Browser Compatibility above), and a true browser-crash recovery scenario.
- **Production Authentication**: Future production releases will require session authentication (OAuth / JWT) to prevent token abuse.
