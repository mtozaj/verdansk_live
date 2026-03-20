from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ===== Models =====

class SessionCreate(BaseModel):
    host_name: str = Field(..., min_length=2)
    host_id: str
    title: str
    region: str = "NA"
    match_code: str
    platform: str = "Cross-play"


# Strict one-way status transitions (no going back)
VALID_STATUS_TRANSITIONS = {
    "filling": ["almost_full", "starting", "ended"],
    "almost_full": ["filling", "starting", "ended"],
    "starting": ["in_progress", "ended"],
    "in_progress": ["ended"],
}

# Strict one-way player state transitions
VALID_STATE_FORWARD = {
    "interested": ["joining"],
    "joining": ["in_lobby"],
    "in_lobby": [],
}


class SessionUpdate(BaseModel):
    match_code: Optional[str] = None
    status: Optional[str] = None


class PlayerAction(BaseModel):
    player_id: str
    nickname: str = Field(..., min_length=2)
    state: str = "interested"


class ChatMsg(BaseModel):
    player_id: str
    nickname: str = Field(..., min_length=2)
    message: str


# ===== WebSocket Manager =====

class WSManager:
    def __init__(self):
        self.rooms: Dict[str, List[WebSocket]] = {}
        self.presence: Dict[str, float] = {}  # player_id -> last_seen timestamp
        self.session_presence: Dict[str, Dict[str, float]] = {}
        self.presence_ttl = 30  # seconds before considered offline

    async def connect(self, room: str, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(room, []).append(ws)

    def heartbeat(self, player_id: str, session_id: Optional[str] = None):
        import time
        now = time.time()
        self.presence[player_id] = now
        if session_id:
            self.session_presence.setdefault(session_id, {})[player_id] = now

    def clear_session_presence(self, session_id: str, player_id: str):
        if session_id not in self.session_presence:
            return
        self.session_presence[session_id].pop(player_id, None)
        if not self.session_presence[session_id]:
            del self.session_presence[session_id]

    def stale_session_players(self, ttl_seconds: int) -> List[tuple[str, str]]:
        import time
        now = time.time()
        stale: List[tuple[str, str]] = []

        for session_id, players in list(self.session_presence.items()):
            stale_players = [player_id for player_id, ts in players.items() if now - ts > ttl_seconds]
            for player_id in stale_players:
                stale.append((session_id, player_id))
                del players[player_id]
            if not players:
                del self.session_presence[session_id]

        return stale

    def disconnect(self, room: str, ws: WebSocket):
        if room in self.rooms:
            self.rooms[room] = [c for c in self.rooms[room] if c != ws]
            if not self.rooms[room]:
                del self.rooms[room]

    async def broadcast(self, room: str, data: dict):
        dead = []
        for ws in self.rooms.get(room, []):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            if room in self.rooms and ws in self.rooms[room]:
                self.rooms[room].remove(ws)

    def online_count(self) -> int:
        import time
        now = time.time()
        # Clean up stale entries while counting
        stale = [pid for pid, ts in self.presence.items() if now - ts > self.presence_ttl]
        for pid in stale:
            del self.presence[pid]
        return len(self.presence)


mgr = WSManager()

LOBBY_EXPIRY_WINDOW = timedelta(minutes=30)


def parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(value)


def get_lobby_reset_datetime(session: dict) -> Optional[datetime]:
    return parse_iso_datetime(session.get("lobby_reset_at") or session.get("created_at"))


def get_lobby_expiry_datetime(session: dict) -> Optional[datetime]:
    lobby_reset_at = get_lobby_reset_datetime(session)
    if not lobby_reset_at:
        return None
    return lobby_reset_at + LOBBY_EXPIRY_WINDOW


def is_lobby_expired(session: Optional[dict], now: Optional[datetime] = None) -> bool:
    if not session or session.get("status") not in ("filling", "almost_full", "starting"):
        return False
    expires_at = get_lobby_expiry_datetime(session)
    if not expires_at:
        return False
    if now is None:
        now = datetime.now(timezone.utc)
    return now >= expires_at


async def reconcile_lobby_expiry(session: Optional[dict], broadcast: bool = False) -> Optional[dict]:
    if not session:
        return None

    now = datetime.now(timezone.utc)
    if not is_lobby_expired(session, now):
        return session

    updated_players = []
    players_changed = False
    for player in session.get("players", []):
        updated_player = dict(player)
        if (
            updated_player.get("player_id") != session.get("host_id")
            and updated_player.get("state") in ("joining", "in_lobby")
        ):
            updated_player["state"] = "interested"
            players_changed = True
        updated_players.append(updated_player)

    newly_expired = not session.get("lobby_expired_at")
    updates = {}
    if newly_expired:
        updates["lobby_expired_at"] = now.isoformat()
        updates["external_in_lobby"] = 0
    if players_changed:
        updates["players"] = updated_players
    if updates:
        updates["updated_at"] = now.isoformat()
        await db.sessions.update_one({"id": session["id"]}, {"$set": updates})
        if players_changed:
            await auto_update_status(session["id"])
        session = await db.sessions.find_one({"id": session["id"]})

        if broadcast:
            result = clean(dict(session))
            await mgr.broadcast(f"session:{session['id']}", {"type": "session_updated", "session": result})
            await mgr.broadcast("lobby", {"type": "session_updated", "session": result})
            if newly_expired:
                await mgr.broadcast(f"session:{session['id']}", {"type": "lobby_expired"})
                logger.info(f"Warzone lobby expired for session {session['id']} - reset players to interested")

    return session


def clean(doc):
    doc.pop("_id", None)
    ps = doc.get("players", [])
    max_players = doc.get("max_players", 152)
    doc["player_count"] = len(ps)
    doc["interested_count"] = sum(1 for p in ps if p.get("state") == "interested")
    doc["joining_count"] = sum(1 for p in ps if p.get("state") == "joining")
    doc["ready_count"] = sum(1 for p in ps if p.get("state") in ("joining", "in_lobby"))
    website_in_lobby = sum(1 for p in ps if p.get("state") == "in_lobby")
    external = min(doc.get("external_in_lobby", 0), max(max_players - website_in_lobby, 0))
    doc["website_in_lobby_count"] = website_in_lobby
    doc["external_in_lobby"] = external
    doc["in_lobby_count"] = website_in_lobby + external
    doc["host_inactive"] = doc.get("host_inactive", False)
    doc["host_last_heartbeat"] = doc.get("host_last_heartbeat")
    doc["lobby_reset_at"] = doc.get("lobby_reset_at", doc.get("created_at"))
    doc["lobby_expires_at"] = (
        get_lobby_expiry_datetime(doc).isoformat() if get_lobby_expiry_datetime(doc) else None
    )
    doc["lobby_expired_at"] = doc.get("lobby_expired_at")
    doc["lobby_expired"] = bool(doc.get("lobby_expired_at"))
    doc["code_updated_at"] = doc.get("code_updated_at")
    doc["server_now"] = datetime.now(timezone.utc).isoformat()
    return doc


async def auto_update_status(sid: str):
    """Auto-transition between filling <-> almost_full based on in-lobby capacity."""
    s = await db.sessions.find_one({"id": sid})
    if not s or s["status"] not in ("filling", "almost_full"):
        return
    ps = s.get("players", [])
    website_in_lobby = sum(1 for p in ps if p.get("state") == "in_lobby")
    external = min(s.get("external_in_lobby", 0), max(s.get("max_players", 152) - website_in_lobby, 0))
    in_lobby = website_in_lobby + external
    max_players = s.get("max_players", 152)
    threshold = max_players * 0.8

    new_status = None
    if s["status"] == "filling" and in_lobby >= threshold:
        new_status = "almost_full"
    elif s["status"] == "almost_full" and in_lobby < threshold:
        new_status = "filling"

    if new_status:
        await db.sessions.update_one(
            {"id": sid},
            {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )


# ===== REST Endpoints =====

@api_router.get("/")
async def root():
    return {"message": "Rally Point API"}


@api_router.post("/sessions")
async def create_session(data: SessionCreate):
    hs = await db.host_stats.find_one({"host_id": data.host_id}, {"_id": 0}) or {}
    hosted = hs.get("sessions_hosted", 0)
    launched = hs.get("successful_launches", 0)

    now = datetime.now(timezone.utc).isoformat()
    session = {
        "id": str(uuid.uuid4()),
        "host_name": data.host_name,
        "host_id": data.host_id,
        "title": data.title,
        "map_name": "Verdansk",
        "game_mode": "Battle Royale",
        "region": data.region,
        "match_code": data.match_code,
        "status": "filling",
        "min_players": 50,
        "max_players": 152,
        "platform": data.platform,
        "players": [
            {
                "player_id": data.host_id,
                "nickname": data.host_name,
                "state": "in_lobby",
                "joined_at": now,
            }
        ],
        "created_at": now,
        "updated_at": now,
        "code_updated_at": None,
        "lobby_reset_at": now,
        "lobby_expired_at": None,
        "host_last_heartbeat": now,
        "host_inactive": False,
        "external_in_lobby": 0,
        "host_sessions_count": hosted + 1,
        "host_success_rate": round(launched / max(hosted, 1), 2),
    }
    await db.sessions.insert_one(session)
    await db.host_stats.update_one(
        {"host_id": data.host_id}, {"$inc": {"sessions_hosted": 1}}, upsert=True
    )

    result = clean({k: v for k, v in session.items() if k != "_id"})
    await mgr.broadcast("lobby", {"type": "new_session", "session": result})
    return result


@api_router.get("/sessions")
async def list_sessions(
    region: Optional[str] = None,
    status: Optional[str] = None,
):
    q: dict = {"status": {"$nin": ["ended"]}}
    if region:
        q["region"] = region
    if status:
        q["status"] = status

    sessions = await db.sessions.find(q, {"_id": 0}).sort("updated_at", -1).to_list(100)
    results = []
    for session in sessions:
        reconciled = await reconcile_lobby_expiry(session, broadcast=True)
        results.append(clean(dict(reconciled)))
    return results


@api_router.get("/sessions/{sid}")
async def get_session(sid: str):
    s = await db.sessions.find_one({"id": sid}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Session not found")
    s = await reconcile_lobby_expiry(s, broadcast=True)
    return clean(dict(s))


@api_router.patch("/sessions/{sid}")
async def update_session(sid: str, data: SessionUpdate, host_id: str = Query(""), reset_timer: bool = Query(True)):
    s = await db.sessions.find_one({"id": sid})
    if not s:
        raise HTTPException(404, "Session not found")
    s = await reconcile_lobby_expiry(s, broadcast=True)
    if host_id and s["host_id"] != host_id:
        raise HTTPException(403, "Only host can update")

    upd = {"updated_at": datetime.now(timezone.utc).isoformat()}
    code_changed = False
    if data.match_code is not None:
        upd["match_code"] = data.match_code
        upd["code_updated_at"] = upd["updated_at"]
        code_changed = True
        if reset_timer:
            upd["lobby_reset_at"] = upd["updated_at"]
            upd["lobby_expired_at"] = None
            upd["external_in_lobby"] = 0
            current_status = s.get("status", "filling")
            # Reset status if in starting/in_progress
            if current_status in ("starting", "in_progress"):
                upd["status"] = "filling"
            # Always reset non-host players from in_lobby back to joining on code change
            updated_players = []
            for p in s.get("players", []):
                if p["player_id"] != s["host_id"] and p["state"] in ("joining", "in_lobby"):
                    p["state"] = "joining"
                    p["needs_reconfirm"] = True
                updated_players.append(p)
            upd["players"] = updated_players
    if data.status is not None:
        current_status = s.get("status", "filling")
        allowed_statuses = VALID_STATUS_TRANSITIONS.get(current_status, [])
        if data.status not in allowed_statuses:
            raise HTTPException(
                400,
                f"Cannot transition from '{current_status}' to '{data.status}'",
            )
        upd["status"] = data.status
        if data.status == "starting":
            await db.host_stats.update_one(
                {"host_id": s["host_id"]},
                {"$inc": {"successful_launches": 1}},
                upsert=True,
            )

    await db.sessions.update_one({"id": sid}, {"$set": upd})
    updated = await db.sessions.find_one({"id": sid}, {"_id": 0})
    result = clean(updated)
    await mgr.broadcast(f"session:{sid}", {"type": "session_updated", "session": result})
    await mgr.broadcast("lobby", {"type": "session_updated", "session": result})
    if code_changed:
        await mgr.broadcast(f"session:{sid}", {"type": "code_changed", "match_code": data.match_code})
    return result


@api_router.post("/sessions/{sid}/join")
async def join_session(sid: str, data: PlayerAction, leave_conflicting: str = Query("")):
    s = await db.sessions.find_one({"id": sid})
    if not s:
        raise HTTPException(404, "Session not found")
    s = await reconcile_lobby_expiry(s, broadcast=True)
    if s["status"] == "ended":
        raise HTTPException(400, "Session ended")

    now = datetime.now(timezone.utc).isoformat()
    existing = next(
        (p for p in s.get("players", []) if p["player_id"] == data.player_id), None
    )

    # Enforce single-lobby rule: if transitioning to "joining", check for in_lobby elsewhere
    target_state = data.state
    if existing:
        current_state = existing.get("state")
        is_advancing_to_joining = current_state == "interested" and target_state == "joining"
    else:
        is_advancing_to_joining = target_state == "joining"

    if is_advancing_to_joining:
        conflict = await db.sessions.find_one(
            {
                "id": {"$ne": sid},
                "status": {"$nin": ["ended"]},
                "players": {
                    "$elemMatch": {"player_id": data.player_id, "state": "in_lobby"}
                },
            },
            {"_id": 0, "id": 1, "title": 1},
        )
        if conflict:
            if leave_conflicting == conflict["id"]:
                await db.sessions.update_one(
                    {"id": conflict["id"]},
                    {
                        "$pull": {"players": {"player_id": data.player_id}},
                        "$set": {"updated_at": now},
                    },
                )
                mgr.clear_session_presence(conflict["id"], data.player_id)
                await auto_update_status(conflict["id"])
                c_updated = await db.sessions.find_one({"id": conflict["id"]}, {"_id": 0})
                if c_updated:
                    c_result = clean(c_updated)
                    await mgr.broadcast(f"session:{conflict['id']}", {"type": "session_updated", "session": c_result})
                    await mgr.broadcast("lobby", {"type": "session_updated", "session": c_result})
            else:
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=409,
                    content={
                        "detail": "already_in_lobby",
                        "conflicting_session_id": conflict["id"],
                        "conflicting_session_title": conflict.get("title", "Unknown"),
                    },
                )

    if existing:
        current_state = existing.get("state")
        allowed = VALID_STATE_FORWARD.get(current_state, [])
        if data.state != current_state and data.state not in allowed:
            raise HTTPException(
                400,
                f"Cannot transition from '{current_state}' to '{data.state}'",
            )
        await db.sessions.update_one(
            {"id": sid, "players.player_id": data.player_id},
            {
                "$set": {
                    "players.$.state": data.state,
                    "players.$.nickname": data.nickname,
                    "updated_at": now,
                },
                "$unset": {
                    "players.$.needs_reconfirm": "",
                },
            },
        )
    else:
        if len(s.get("players", [])) >= s.get("max_players", 152):
            raise HTTPException(400, "Session is full")
        if data.state not in ("interested", "joining"):
            data.state = "interested"
        await db.sessions.update_one(
            {"id": sid},
            {
                "$push": {
                    "players": {
                        "player_id": data.player_id,
                        "nickname": data.nickname,
                        "state": data.state,
                        "joined_at": now,
                    }
                },
                "$set": {"updated_at": now},
            },
        )

    await auto_update_status(sid)
    updated = await db.sessions.find_one({"id": sid}, {"_id": 0})
    result = clean(updated)
    await mgr.broadcast(f"session:{sid}", {"type": "session_updated", "session": result})
    await mgr.broadcast("lobby", {"type": "session_updated", "session": result})
    return result


@api_router.post("/sessions/{sid}/leave")
async def leave_session(sid: str, player_id: str = Query(...)):
    existing = await db.sessions.find_one({"id": sid})
    if not existing:
        raise HTTPException(404, "Session not found")
    await reconcile_lobby_expiry(existing, broadcast=True)
    now = datetime.now(timezone.utc).isoformat()
    await db.sessions.update_one(
        {"id": sid},
        {
            "$pull": {"players": {"player_id": player_id}},
            "$set": {"updated_at": now},
        },
    )
    mgr.clear_session_presence(sid, player_id)
    await auto_update_status(sid)
    updated = await db.sessions.find_one({"id": sid}, {"_id": 0})
    if not updated:
        raise HTTPException(404, "Session not found")
    result = clean(updated)
    await mgr.broadcast(f"session:{sid}", {"type": "session_updated", "session": result})
    await mgr.broadcast("lobby", {"type": "session_updated", "session": result})
    return result


@api_router.post("/sessions/{sid}/leave-if-interested")
async def leave_if_interested(sid: str, player_id: str = Query(...)):
    """Remove player only if their current DB state is 'interested'. Used on page
    unmount so viewers are cleaned up without affecting committed players."""
    existing = await db.sessions.find_one({"id": sid})
    if not existing:
        return {"ok": True}
    if existing.get("host_id") == player_id:
        return {"ok": True}
    result = await db.sessions.update_one(
        {
            "id": sid,
            "players": {
                "$elemMatch": {
                    "player_id": player_id,
                    "state": "interested",
                }
            },
        },
        {
            "$pull": {"players": {"player_id": player_id, "state": "interested"}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
        },
    )
    if result.modified_count:
        mgr.clear_session_presence(sid, player_id)
        await auto_update_status(sid)
        updated = await db.sessions.find_one({"id": sid}, {"_id": 0})
        if updated:
            cleaned = clean(updated)
            await mgr.broadcast(f"session:{sid}", {"type": "session_updated", "session": cleaned})
            await mgr.broadcast("lobby", {"type": "session_updated", "session": cleaned})
    return {"ok": True}


@api_router.post("/sessions/{sid}/exit-lobby")
async def exit_lobby(sid: str, data: PlayerAction):
    session = await db.sessions.find_one({"id": sid})
    if not session:
        raise HTTPException(404, "Session not found")

    session = await reconcile_lobby_expiry(session, broadcast=True)
    player = next(
        (p for p in session.get("players", []) if p.get("player_id") == data.player_id),
        None,
    )
    if not player:
        raise HTTPException(404, "Player not found in session")
    if player.get("player_id") == session.get("host_id"):
        raise HTTPException(403, "Host cannot exit lobby")
    if player.get("state") not in ("joining", "in_lobby"):
        raise HTTPException(400, "Only joining or in-lobby players can exit back to interested")

    now = datetime.now(timezone.utc).isoformat()
    await db.sessions.update_one(
        {"id": sid, "players.player_id": data.player_id},
        {
            "$set": {
                "players.$.state": "interested",
                "players.$.nickname": data.nickname,
                "updated_at": now,
            },
            "$unset": {
                "players.$.needs_reconfirm": "",
            },
        },
    )

    await auto_update_status(sid)
    updated = await db.sessions.find_one({"id": sid}, {"_id": 0})
    result = clean(updated)
    await mgr.broadcast(f"session:{sid}", {"type": "session_updated", "session": result})
    await mgr.broadcast("lobby", {"type": "session_updated", "session": result})
    return result



class ResetLobby(BaseModel):
    match_code: str


class ExternalCount(BaseModel):
    external_in_lobby: int


@api_router.post("/sessions/{sid}/reset-lobby")
async def reset_lobby(sid: str, data: ResetLobby, host_id: str = Query("")):
    s = await db.sessions.find_one({"id": sid})
    if not s:
        raise HTTPException(404, "Session not found")
    s = await reconcile_lobby_expiry(s, broadcast=True)
    if not host_id or s["host_id"] != host_id:
        raise HTTPException(403, "Only host can reset lobby")
    if s["status"] not in ("filling", "almost_full", "starting", "in_progress"):
        raise HTTPException(400, "Cannot reset an ended session")

    now = datetime.now(timezone.utc).isoformat()

    # Move in_lobby players back to joining and flag all joining players for reconfirm (except host)
    updated_players = []
    for p in s.get("players", []):
        if p["player_id"] != s["host_id"] and p["state"] in ("joining", "in_lobby"):
            p["state"] = "joining"
            p["needs_reconfirm"] = True
        updated_players.append(p)

    await db.sessions.update_one(
        {"id": sid},
        {
            "$set": {
                "players": updated_players,
                "match_code": data.match_code,
                "code_updated_at": now,
                "lobby_reset_at": now,
                "lobby_expired_at": None,
                "updated_at": now,
                "status": "filling",
                "external_in_lobby": 0,
            }
        },
    )

    await auto_update_status(sid)
    updated = await db.sessions.find_one({"id": sid}, {"_id": 0})
    result = clean(updated)
    await mgr.broadcast(f"session:{sid}", {"type": "session_updated", "session": result})
    await mgr.broadcast(f"session:{sid}", {"type": "code_changed", "match_code": data.match_code})
    await mgr.broadcast(f"session:{sid}", {"type": "lobby_reset"})
    await mgr.broadcast("lobby", {"type": "session_updated", "session": result})
    return result


@api_router.patch("/sessions/{sid}/external-count")
async def update_external_count(sid: str, data: ExternalCount, host_id: str = Query("")):
    s = await db.sessions.find_one({"id": sid})
    if not s:
        raise HTTPException(404, "Session not found")
    s = await reconcile_lobby_expiry(s, broadcast=True)
    if not host_id or s["host_id"] != host_id:
        raise HTTPException(403, "Only host can update external count")
    if s["status"] == "ended":
        raise HTTPException(400, "Session ended")

    ps = s.get("players", [])
    website_in_lobby = sum(1 for p in ps if p.get("state") == "in_lobby")
    max_players = s.get("max_players", 152)
    clamped = max(0, min(data.external_in_lobby, max_players - website_in_lobby))

    now = datetime.now(timezone.utc).isoformat()
    await db.sessions.update_one(
        {"id": sid},
        {"$set": {"external_in_lobby": clamped, "updated_at": now}},
    )
    await auto_update_status(sid)
    updated = await db.sessions.find_one({"id": sid}, {"_id": 0})
    result = clean(updated)
    await mgr.broadcast(f"session:{sid}", {"type": "session_updated", "session": result})
    await mgr.broadcast("lobby", {"type": "session_updated", "session": result})
    return result


@api_router.post("/sessions/{sid}/chat")
async def send_chat(sid: str, data: ChatMsg):
    s = await db.sessions.find_one({"id": sid})
    if not s:
        raise HTTPException(404, "Session not found")

    msg = {
        "id": str(uuid.uuid4()),
        "session_id": sid,
        "player_id": data.player_id,
        "nickname": data.nickname,
        "message": data.message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.chat_messages.insert_one(msg)
    msg.pop("_id", None)
    await mgr.broadcast(f"session:{sid}", {"type": "chat_message", "message": msg})
    return msg


@api_router.get("/sessions/{sid}/chat")
async def get_chat(sid: str, limit: int = 50):
    msgs = (
        await db.chat_messages.find({"session_id": sid}, {"_id": 0})
        .sort("timestamp", -1)
        .limit(limit)
        .to_list(limit)
    )
    msgs.reverse()
    return msgs


@api_router.get("/stats")
async def get_stats():
    active_filter = {
        "status": {"$nin": ["ended"]},
        "$or": [
            {"lobby_expired_at": {"$exists": False}},
            {"lobby_expired_at": None},
        ],
    }
    active = await db.sessions.count_documents(active_filter)
    pipeline = [
        {"$match": active_filter},
        {"$project": {"count": {"$size": {"$ifNull": ["$players", []]}}}},
        {"$group": {"_id": None, "total": {"$sum": "$count"}}},
    ]
    r = await db.sessions.aggregate(pipeline).to_list(1)
    return {
        "active_sessions": active,
        "total_players": r[0]["total"] if r else 0,
        "online_viewers": mgr.online_count(),
    }


# ===== WebSocket =====

@api_router.websocket("/ws/lobby")
async def ws_lobby(ws: WebSocket):
    await mgr.connect("lobby", ws)
    try:
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_json({"type": "pong"})
            else:
                try:
                    import json
                    msg = json.loads(data)
                    if msg.get("type") == "presence" and msg.get("player_id"):
                        mgr.heartbeat(msg["player_id"])
                except Exception:
                    pass
    except (WebSocketDisconnect, Exception):
        mgr.disconnect("lobby", ws)


@api_router.websocket("/ws/session/{sid}")
async def ws_session(ws: WebSocket, sid: str):
    room = f"session:{sid}"
    await mgr.connect(room, ws)
    try:
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_json({"type": "pong"})
            else:
                try:
                    import json
                    msg = json.loads(data)
                    if msg.get("type") == "host_heartbeat":
                        player_id = msg.get("player_id")
                        s = await db.sessions.find_one({"id": sid})
                        if s and s.get("host_id") == player_id:
                            now = datetime.now(timezone.utc).isoformat()
                            upd = {"host_last_heartbeat": now}
                            if s.get("host_inactive"):
                                upd["host_inactive"] = False
                            await db.sessions.update_one({"id": sid}, {"$set": upd})
                            if s.get("host_inactive"):
                                updated = await db.sessions.find_one({"id": sid}, {"_id": 0})
                                result = clean(updated)
                                await mgr.broadcast(room, {"type": "session_updated", "session": result})
                                await mgr.broadcast("lobby", {"type": "session_updated", "session": result})
                    elif msg.get("type") == "presence" and msg.get("player_id"):
                        mgr.heartbeat(msg["player_id"], sid)
                except Exception:
                    pass
    except (WebSocketDisconnect, Exception):
        mgr.disconnect(room, ws)


# ===== App Setup =====

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def staleness_cleanup():
    while True:
        try:
            now = datetime.now(timezone.utc)
            cutoff = (now - timedelta(minutes=30)).isoformat()
            interested_cutoff_seconds = 300

            for sid, player_id in mgr.stale_session_players(interested_cutoff_seconds):
                removal = await db.sessions.update_one(
                    {
                        "id": sid,
                        "players": {
                            "$elemMatch": {
                                "player_id": player_id,
                                "state": "interested",
                            }
                        },
                    },
                    {
                        "$pull": {"players": {"player_id": player_id, "state": "interested"}},
                        "$set": {"updated_at": now.isoformat()},
                    },
                )

                if removal.modified_count:
                    updated = await db.sessions.find_one({"id": sid}, {"_id": 0})
                    if updated:
                        result = clean(updated)
                        await mgr.broadcast(f"session:{sid}", {"type": "session_updated", "session": result})
                        await mgr.broadcast("lobby", {"type": "session_updated", "session": result})
                        logger.info(f"Removed inactive interested player {player_id} from session {sid}")

            expired_lobbies = await db.sessions.find(
                {
                    "status": {"$in": ["filling", "almost_full", "starting"]},
                    "lobby_reset_at": {"$lt": cutoff},
                    "$or": [
                        {"lobby_expired_at": {"$exists": False}},
                        {"lobby_expired_at": None},
                    ],
                },
                {"_id": 0},
            ).to_list(100)

            for session in expired_lobbies:
                await reconcile_lobby_expiry(session, broadcast=True)

            # Auto-end filling/almost_full sessions after 30 min inactivity
            await db.sessions.update_many(
                {
                    "status": {"$in": ["filling", "almost_full"]},
                    "updated_at": {"$lt": cutoff},
                },
                {"$set": {"status": "ended"}},
            )
            # Auto-end starting sessions after 30 min inactivity
            await db.sessions.update_many(
                {
                    "status": "starting",
                    "updated_at": {"$lt": cutoff},
                },
                {"$set": {"status": "ended"}},
            )
            # Auto-end in_progress sessions after 2 hours
            long_cutoff = (now - timedelta(hours=2)).isoformat()
            await db.sessions.update_many(
                {"status": "in_progress", "updated_at": {"$lt": long_cutoff}},
                {"$set": {"status": "ended"}},
            )

            # Host heartbeat check — flag inactive after 10 min
            heartbeat_cutoff = (now - timedelta(minutes=10)).isoformat()
            inactive_sessions = await db.sessions.find(
                {
                    "status": {"$nin": ["ended"]},
                    "host_inactive": {"$ne": True},
                    "host_last_heartbeat": {"$lt": heartbeat_cutoff},
                },
                {"_id": 0},
            ).to_list(100)

            for s in inactive_sessions:
                await db.sessions.update_one(
                    {"id": s["id"]},
                    {"$set": {"host_inactive": True}},
                )
                updated = await db.sessions.find_one({"id": s["id"]}, {"_id": 0})
                result = clean(updated)
                await mgr.broadcast(f"session:{s['id']}", {"type": "session_updated", "session": result})
                await mgr.broadcast("lobby", {"type": "session_updated", "session": result})
                logger.info(f"Flagged session {s['id']} as host_inactive")

        except Exception as e:
            logger.error(f"Staleness cleanup: {e}")
        await asyncio.sleep(60)


@app.on_event("startup")
async def startup():
    asyncio.create_task(staleness_cleanup())
    await db.sessions.create_index("id", unique=True)
    await db.sessions.create_index("status")
    await db.sessions.create_index("region")
    await db.chat_messages.create_index("session_id")


@app.on_event("shutdown")
async def shutdown():
    client.close()
