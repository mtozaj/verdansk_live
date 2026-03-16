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
- Min players: 50 (hardcoded), Max: 150
- Strict one-way status transitions: filling → starting → in_progress → ended
- Strict one-way player states: interested → joining → in_lobby
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
- [x] 50 min players, 150 max (hardcoded)
- [x] Strict one-way status transitions (backend enforced)
- [x] Strict one-way player state transitions (backend enforced)
- [x] Match code locking (only visible to joining/in_lobby players)
- [x] Removed "ready" state (interested → joining → in_lobby)
- [x] Progressive readiness UI (shows only next action)
- [x] Simplified create session form (title, code, region only)

## Testing Results
- Backend: 100% (18/18 tests)
- Frontend: 100%
- Integration: 100%

## Prioritized Backlog
### P1
- Session sharing link with rich preview
- Sound alerts for session milestones
- "Watch this session" notification hooks

### P2
- Session history / recent sessions
- Player profiles
- Discord bot integration
