# Rally Point - Warzone Private Match Coordination Hub

## Original Problem Statement
Build a real-time coordination website for Call of Duty: Warzone private matches, especially Verdansk lobbies. Replace Reddit chaos with live session boards showing actual momentum, player readiness, and match codes.

## Architecture
- **Backend**: FastAPI + MongoDB + WebSocket (real-time)
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Real-time**: WebSocket for lobby and per-session updates
- **Auth**: None - anonymous with nicknames (localStorage)

## User Personas
1. **Host**: Creates private match sessions, shares codes, manages lobby lifecycle
2. **Player**: Browses active sessions, joins lobbies, coordinates with others
3. **Browser**: Lands on site to check if any sessions are active

## Core Requirements (Static)
- Real-time session board with live player counts
- Session lifecycle: filling → almost_full → starting → in_progress → ended
- Player readiness states: interested → ready → joining → in_lobby
- Match code sharing with one-click copy
- Session chat for lightweight coordination
- Host trust signals (launch rate, sessions hosted)
- Staleness detection (auto-expire inactive sessions)
- Browser push notifications + in-app toasts
- Mobile-first responsive design
- Region/map/status filters

## What's Been Implemented (2026-03-16)
- [x] Full backend API: Sessions CRUD, player management, chat, stats, WebSocket
- [x] WebSocket real-time: lobby updates, per-session updates, chat
- [x] Homepage: Hero section, filter bar, session board with live cards
- [x] Session detail: Match code, progress bar, readiness controls, player list, chat
- [x] Host controls: Update code, start/end session, status management
- [x] Nickname system: Anonymous identity with localStorage
- [x] Notification system: In-app toasts via Sonner, browser push notifications
- [x] Staleness cleanup: Background task auto-expires inactive sessions
- [x] Dark tactical UI: Barlow Condensed headings, JetBrains Mono data, orange primary
- [x] Mobile-responsive design

## Testing Results
- Backend: 100% (14/14 endpoints passing)
- Frontend: 95% (all critical flows working)

## Prioritized Backlog
### P0 (Critical)
- All P0 features implemented

### P1 (Important)
- Session sharing link (copy URL to clipboard)
- Sound alerts when session reaches threshold
- "Notify me" button for specific sessions
- Session search by title

### P2 (Nice to Have)
- Session history / recent sessions
- Player profiles with game stats
- Voice channel integration
- Multiple match code formats support
- Session templates for quick hosting
- Dark/light theme toggle (currently dark-only by design)

## Next Tasks
1. Add session share URL functionality
2. Implement sound alerts for session milestones
3. Add "Watch this session" notification hooks
4. Consider adding session categories/tags
