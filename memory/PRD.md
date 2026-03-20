# Rally Point - Warzone Private Match Coordination Hub

## Original Problem Statement
Build a real-time coordination website for Call of Duty: Warzone private matches, especially Verdansk lobbies. Replace Reddit chaos with live session boards showing actual momentum, player readiness, and match codes.

## Architecture
- **Backend**: FastAPI + MongoDB + WebSocket (real-time)
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Real-time**: WebSocket for lobby and per-session updates
- **Auth**: None - anonymous with nicknames (localStorage)

## Core Requirements (Static)
- Verdansk ONLY - no other maps
- Min players: 50 (hardcoded), Max: 152
- Strict one-way status transitions: filling -> starting -> in_progress -> ended
- Strict one-way player states: interested -> joining -> in_lobby
- Match code LOCKED until player commits to joining
- No "ready" state - simplified 3-state model

## What's Been Implemented
### Phase 1 (2026-03-16) - MVP
- [x] Full backend API with MongoDB
- [x] WebSocket real-time updates
- [x] Homepage with session board, filters, hero
- [x] Session detail with chat, player list, code

### Phase 2 (2026-03-16) - Hardening
- [x] Verdansk-only (removed map selection)
- [x] 50 min players, 152 max (hardcoded)
- [x] Strict one-way status transitions (backend enforced)
- [x] Strict one-way player state transitions (backend enforced)
- [x] Match code locking (only visible to joining/in_lobby players)
- [x] Removed "ready" state (interested -> joining -> in_lobby)
- [x] Progressive readiness UI (shows only next action)
- [x] Simplified create session form (title, code, region only)

### Phase 3 (2026-03-16) - Bug Fix
- [x] Fixed WelcomeRules scroll & button click (z-index conflict with NicknamePrompt portal)
- [x] Fixed NicknamePrompt not appearing after rules dismissal (React Hooks violation)
- [x] Fixed auto-scroll bug on SessionPage — ChatFeed's scrollIntoView was scrolling the entire page

### Phase 4 (2026-03-16) - Host Heartbeat & Staleness
- [x] Host heartbeat system — browser sends ping every 60s via WebSocket
- [x] Auto-flag sessions as "Host Inactive" after 5 min of no heartbeat
- [x] Yellow warning banner on session page when host is inactive
- [x] "Host Inactive" indicator on session cards in homepage
- [x] Host returning auto-clears the inactive flag
- [x] Fixed "starting" status sessions not being auto-expired (30 min timeout)
- [x] Updated page title & OG meta tags for proper link previews
- [x] Generated OG preview image for social sharing
- [x] Removed Emergent badge via MutationObserver

### Phase 5 (2026-03-16) - Warzone Lobby Timer & Reset
- [x] 30-minute countdown timer on session page (matches Warzone's lobby expiry)
- [x] Timer turns yellow in last 5 minutes, red when expired
- [x] "Lobby Expired" prompt for host with Reset Lobby button + new code input
- [x] "Lobby Expired -- Waiting for host" message for players
- [x] Reset Lobby endpoint: resets timer, updates code, moves in_lobby players back to joining
- [x] "NEW CODE" flashing green badge on match code display when code changes
- [x] Toast notifications for code changes and lobby resets
- [x] Manual code update also resets the 30-min timer
- Backend: 100% (18/18 tests)
- Frontend: 100%
- Integration: 100%

### Phase 5.5 - Chat, Host Controls, UI Refinements
- [x] @Mention system in chat with autocomplete dropdown, highlighting, toast notifications
- [x] Host Controls refactor: "Typo Correction" (pencil edit, no timer reset) vs "Reset Lobby" (full reset)
- [x] Status color system: Yellow (interested/filling) -> Blue (joining/starting) -> Green (in_lobby/in_progress)
- [x] Onboarding UX: replaced mandatory rules wall with on-demand help dialog
- [x] Chat bug fixes: instant message display for sender, long message overflow
- [x] iOS UX: resolved auto-zoom on inputs, background scroll-lock on modals
- [x] Data persistence fixes: player state cleanup on navigation, needs_reconfirm flag
- [x] OG image update with cache-busting
- [x] Active Sessions count excludes expired sessions
- [x] Numerous UI text updates for clarity

### Phase 6 (2026-02-XX) - Server-Side Cleanup Fix
- [x] Fixed "stuck interested player" bug — race condition between exitLobby and navigation cleanup
- [x] New backend endpoint `POST /sessions/{sid}/leave-if-interested` — atomically removes player only if DB state is "interested"
- [x] Simplified frontend cleanup: server decides whether to remove, no more stale closure issues
- [x] `pendingExitRef` stays true after exitLobby to ensure full `/leave` on navigation
- [x] Reset `pendingExitRef` when user takes a new action (rejoin)
- Backend: 100% (11/11 tests)
- Frontend: 100%

### Phase 6.1 (2026-02-XX) - Single-Lobby Enforcement
- [x] Players can only be in "in_lobby" state in one session at a time
- [x] Backend returns 409 with conflicting session info when trying to join while in_lobby elsewhere
- [x] `leave_conflicting` query param auto-removes from old session before joining new one
- [x] Frontend shows AlertDialog prompting user to leave the other lobby
- [x] "Stay" dismisses dialog, "Leave & Join This One" resolves conflict and proceeds
- [x] Joining as "interested" does NOT trigger conflict
- [x] "joining" state elsewhere is silently cleaned up (no dialog) when committing to a new session
- Backend: 100% (20/20 including regression)
- Frontend: 100%

### Phase 7 (2026-02-XX) - Session Sharing with Rich Preview
- [x] New backend endpoint `GET /api/share/{sid}` serves HTML with dynamic OG tags
- [x] OG title: `Join: "Session Title" — X/50 in lobby`
- [x] OG description: region, host, status, interested/joining counts
- [x] Static OG image (existing Rally Point branding)
- [x] Auto-redirects browsers to `/session/{id}` via meta refresh
- [x] "Share" button on session page copies the share link
- [x] HTML-escaped user content to prevent XSS

## Prioritized Backlog
### P1
- Session sharing link with rich preview
- Sound alerts for session milestones
- "Watch this session" notification hooks

### P2
- Session history / recent sessions
- Player profiles
- Discord bot integration

## Key API Endpoints
- `POST /api/sessions` - Create session
- `GET /api/sessions` - List sessions
- `GET /api/sessions/{sid}` - Get session
- `PATCH /api/sessions/{sid}` - Update session (query: host_id, reset_timer)
- `POST /api/sessions/{sid}/join` - Join/update state
- `POST /api/sessions/{sid}/leave` - Full player removal
- `POST /api/sessions/{sid}/leave-if-interested` - Conditional removal (only if interested)
- `POST /api/sessions/{sid}/exit-lobby` - Move joining/in_lobby back to interested
- `POST /api/sessions/{sid}/reset-lobby` - Reset expired lobby
- `PATCH /api/sessions/{sid}/external-count` - Update external player count
- `POST /api/sessions/{sid}/chat` - Send chat message
- `GET /api/sessions/{sid}/chat` - Get chat messages
- `WS /api/ws/lobby` - Lobby real-time updates
- `WS /api/ws/session/{sid}` - Session real-time updates
