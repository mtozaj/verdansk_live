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

### Phase 3 (2026-03-16) - Bug Fix
- [x] Fixed WelcomeRules scroll & button click (z-index conflict with NicknamePrompt portal)
- [x] Fixed NicknamePrompt not appearing after rules dismissal (React Hooks violation — usePlayer() called after early return)
- [x] Fixed auto-scroll bug on SessionPage — ChatFeed's scrollIntoView was scrolling the entire page on mobile/zoomed views

### Phase 4 (2026-03-16) - Host Heartbeat & Staleness
- [x] Host heartbeat system — browser sends ping every 60s via WebSocket
- [x] Auto-flag sessions as "Host Inactive" after 5 min of no heartbeat
- [x] Yellow warning banner on session page when host is inactive
- [x] "Host Inactive" indicator on session cards in homepage
- [x] Host returning auto-clears the inactive flag
- [x] Fixed "starting" status sessions not being auto-expired (30 min timeout)
- [x] Updated page title & OG meta tags for proper link previews (Rally Point branding)
- [x] Generated OG preview image for social sharing
- [x] Removed Emergent badge via MutationObserver
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
