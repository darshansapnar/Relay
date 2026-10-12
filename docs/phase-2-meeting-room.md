# Phase 2: Meeting Room UI & Client-Side Interactions

## Overview

Phase 2 introduces the complete in-meeting conference workspace at `/meeting/:roomId`. It delivers a polished, responsive video-conferencing UI inspired by modern SaaS standards while preserving Relay's dark charcoal identity.

---

## Component Architecture

```text
apps/web/src/
├── pages/
│   ├── LandingPage.jsx              # Extracted Phase 1 landing page
│   └── MeetingPage.jsx              # Main meeting room container (/meeting/:roomId)
│
├── components/
│   ├── meeting/
│   │   ├── MeetingHeader.jsx        # Room ID, status badge, 1P-4P grid switcher, copy link, leave
│   │   ├── ParticipantGrid.jsx      # Adaptive CSS grid arranging 1 to 4 tiles
│   │   ├── ParticipantTile.jsx      # Initials avatar, speaking soundwave indicator, mic badge
│   │   ├── MeetingControls.jsx      # Bottom bar: mic/cam toggles, screen demo, panel openers, leave
│   │   ├── ParticipantsPanel.jsx    # Right-side participant list with search and role badges
│   │   ├── AssistantPanel.jsx       # Right-side Relay AI Copilot panel with empty states
│   │   ├── MoreOptionsMenu.jsx      # Dropdown menu for device settings, shortcuts, and info
│   │   ├── ScreenShareModal.jsx     # Informational demo dialog for screen sharing
│   │   └── LeaveMeetingDialog.jsx   # Exit confirmation modal navigating back to /
│   │
│   ├── modals/
│   │   ├── CreateMeetingModal.jsx   # Generates demo room ID and routes into /meeting/:roomId
│   │   └── JoinMeetingModal.jsx     # Accepts custom code or suggested demo rooms and routes
│   │
│   ├── ui/
│   │   ├── Button.jsx               # Button variants (primary, secondary, danger, outline, ghost)
│   │   ├── Badge.jsx                # Badges with pulsing dots
│   │   └── Modal.jsx                # Accessible backdrop dialog
│   │
│   └── layout/
│       ├── Navbar.jsx               # Navigation bar with live backend health pill
│       └── Footer.jsx               # Global footer
│
└── data/
    └── mockParticipants.js         # Isolated participant state (You, Alex, Priya, Marcus)
```

---

## Implemented Behaviors & Testing Guide

1. **Room Generation & Entry**:
   - From `/`, clicking **Create Meeting** generates a fresh room code (e.g. `rel-demo-4821`). Submitting routes to `/meeting/rel-demo-4821`.
   - Clicking **Join Meeting** allows entering any code or choosing one of the demo chips (`rel-demo-4091`, `rel-product-sync`, `rel-team-standup`).

2. **Adaptive Participant Grid**:
   - **1 Participant**: Single large centered tile.
   - **2 Participants**: Dual columns on tablet/desktop, stacked on mobile.
   - **3 Participants**: Balanced triangular grid with centered bottom tile.
   - **4 Participants**: 2x2 symmetrical video matrix.
   - The switcher in the header (`1P`, `2P`, `3P`, `4P`) allows instant UI preview of each layout.

3. **In-Call Controls**:
   - **Microphone**: Toggles between green active and red muted states. Updates the local participant tile in the grid.
   - **Camera**: Toggles between camera on and camera off (displays "Camera Off" pill and centered avatar).
   - **Screen Share**: Triggers a demo explanation modal explaining WebRTC display capture will connect in future phases.
   - **Participants Panel**: Slides in from right, offering real-time roster search.
   - **AI Assistant Panel**: Slides in from right, showcasing Relay Copilot overview, executive summary, and action items empty states.
   - **Leave Meeting**: Displays confirmation prompt before smoothly navigating back to `/`.
