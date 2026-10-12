# Phase 3: Real-Time Video & Audio with LiveKit

## Overview

Phase 3 integrates real-time WebRTC conferencing into Relay via **LiveKit**. The application now connects real audio and video tracks, supports camera/mic toggles, enables screen sharing, and synchronizes participant states.

---

## Architecture

```text
                               ┌──────────────────────────┐
                               │   Express API (:5000)    │
                               │  POST /api/meetings/token│
                               └────────────┬─────────────┘
                                            │ Issues short-lived
                                            │ room-scoped JWT token
                                            ▼
┌──────────────────────────┐   Connects via token   ┌──────────────────────────┐
│     Client 1 (Alice)     │ ◄────────────────────► │      LiveKit Cloud       │
│  http://localhost:5173   │   WebRTC SFU Media     │      (SFU Server)        │
└──────────────────────────┘                        └─────────────▲────────────┘
                                                                  │
                                                        WebRTC    │ WebRTC
                                                        Tracks    │ Tracks
                                                                  ▼
                                                    ┌──────────────────────────┐
                                                    │     Client 2 (Bob)       │
                                                    │  http://localhost:5173   │
                                                    └──────────────────────────┘
```

---

## Backend Implementation (`apps/api`)

- **Dependencies**: `livekit-server-sdk`
- **Controller**: `apps/api/src/controllers/meeting.controller.js`
  - Validates `roomName` (1–64 characters, sanitized to safe alphanumeric, dashes, dots, underscores).
  - Validates `participantName` (1–64 characters, stripped of unsafe control/HTML characters).
  - Generates secure server-side participant identity: `user_${Date.now()}_${randomUUID().substring(0, 8)}`.
  - Scopes access strictly to the requested room (`roomJoin: true`, `canPublish: true`, `canSubscribe: true`, `canPublishData: true`).
  - Sets a 2-hour TTL.
  - Returns only safe parameters (`token`, `url`, `roomName`, `participantIdentity`, `participantName`). Never returns or leaks API secrets.
  - Safe error handling: Returns HTTP 503 if backend environment variables (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`) are missing.

---

## Frontend Implementation (`apps/web`)

- **Dependencies**: `livekit-client`, `@livekit/components-react`
- **Components**:
  - `PreJoinScreen.jsx`: Collects participant display name and device preferences (mic/camera on/off) before joining. Handles error notifications and retry actions cleanly.
  - `MeetingRoomLive.jsx`: Wraps `<LiveKitRoom>` and renders `<RoomAudioRenderer />` for remote audio playback, header, stage grid, and side panels.
  - `LiveParticipantGrid.jsx`: Renders real participant camera tracks via `useTracks()`. When a screen share is active, automatically creates a dedicated main stage and arranges camera tiles along the bottom.
  - `LiveParticipantTile.jsx`: Renders real `<VideoTrack />` elements when video is active, or styled initials-based avatar when video is muted/off. Displays live active speaker waveform badges and microphone indicators.
  - `LiveMeetingControls.jsx`: Connects directly to `useLocalParticipant()`, managing real microphone, camera, and display capture (`getDisplayMedia`) screen sharing.
  - `LiveParticipantsPanel.jsx`: Connects to `useParticipants()`, listing all active participants with real-time mic/video statuses and search filtering.
  - `LeaveMeetingDialog.jsx`: Confirms meeting exit and calls `room.disconnect()` to cleanly unmount tracks and release hardware devices.

---

## Security Considerations

1. **Secret Isolation**: `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` are stored solely on the backend server.
2. **Minimal Scoping**: Tokens only authorize joining the single requested room.
3. **No Database Dependency**: Ephemeral access tokens require zero database storage in this phase.
4. **Production Recommendation**: When deploying to production, integrate user authentication (e.g. Session cookies or OAuth) to restrict token minting to authenticated users.
