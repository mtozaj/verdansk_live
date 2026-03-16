from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel
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
    host_name: str
    host_id: str
    title: str
    map_name: str = "Verdansk"
    game_mode: str = "Battle Royale"
    region: str = "NA"
    match_code: str
    min_players: int = 24
    max_players: int = 150
    platform: str = "Cross-play"


class SessionUpdate(BaseModel):
    match_code: Optional[str] = None
    status: Optional[str] = None


class PlayerAction(BaseModel):
    player_id: str
    nickname: str
    state: str = "interested"


class ChatMsg(BaseModel):
    player_id: str
    nickname: str
    message: str


# ===== WebSocket Manager =====

class WSManager:
    def __init__(self):
        self.rooms: Dict[str, List[WebSocket]] = {}

    async def connect(self, room: str, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(room, []).append(ws)

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

    def count(self, room: str) -> int:
        return len(self.rooms.get(room, []))


mgr = WSManager()


def clean(doc):
    doc.pop("_id", None)
    ps = doc.get("players", [])
    doc["player_count"] = len(ps)
    doc["ready_count"] = sum(1 for p in ps if p.get("state") in ("ready", "joining", "in_lobby"))
    doc["in_lobby_count"] = sum(1 for p in ps if p.get("state") == "in_lobby")
    return doc


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
        "map_name": data.map_name,
        "game_mode": data.game_mode,
        "region": data.region,
        "match_code": data.match_code,
        "status": "filling",
        "min_players": data.min_players,
        "max_players": data.max_players,
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
    map_name: Optional[str] = None,
):
    q: dict = {"status": {"$nin": ["ended"]}}
    if region:
        q["region"] = region
    if status:
        q["status"] = status
    if map_name:
        q["map_name"] = map_name

    sessions = await db.sessions.find(q, {"_id": 0}).sort("updated_at", -1).to_list(100)
    return [clean(s) for s in sessions]


@api_router.get("/sessions/{sid}")
async def get_session(sid: str):
    s = await db.sessions.find_one({"id": sid}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Session not found")
    return clean(s)


@api_router.patch("/sessions/{sid}")
async def update_session(sid: str, data: SessionUpdate, host_id: str = Query("")):
    s = await db.sessions.find_one({"id": sid})
    if not s:
        raise HTTPException(404, "Session not found")
    if host_id and s["host_id"] != host_id:
        raise HTTPException(403, "Only host can update")

    upd = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.match_code is not None:
        upd["match_code"] = data.match_code
    if data.status is not None:
        upd["status"] = data.status
        if data.status in ("starting", "in_progress"):
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
    return result


@api_router.post("/sessions/{sid}/join")
async def join_session(sid: str, data: PlayerAction):
    s = await db.sessions.find_one({"id": sid})
    if not s:
        raise HTTPException(404, "Session not found")
    if s["status"] == "ended":
        raise HTTPException(400, "Session ended")

    now = datetime.now(timezone.utc).isoformat()
    existing = next(
        (p for p in s.get("players", []) if p["player_id"] == data.player_id), None
    )

    if existing:
        await db.sessions.update_one(
            {"id": sid, "players.player_id": data.player_id},
            {
                "$set": {
                    "players.$.state": data.state,
                    "players.$.nickname": data.nickname,
                    "updated_at": now,
                }
            },
        )
    else:
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

    updated = await db.sessions.find_one({"id": sid}, {"_id": 0})
    result = clean(updated)
    await mgr.broadcast(f"session:{sid}", {"type": "session_updated", "session": result})
    await mgr.broadcast("lobby", {"type": "session_updated", "session": result})
    return result


@api_router.post("/sessions/{sid}/leave")
async def leave_session(sid: str, player_id: str = Query(...)):
    now = datetime.now(timezone.utc).isoformat()
    await db.sessions.update_one(
        {"id": sid},
        {
            "$pull": {"players": {"player_id": player_id}},
            "$set": {"updated_at": now},
        },
    )
    updated = await db.sessions.find_one({"id": sid}, {"_id": 0})
    if not updated:
        raise HTTPException(404, "Session not found")
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
    active = await db.sessions.count_documents({"status": {"$nin": ["ended"]}})
    pipeline = [
        {"$match": {"status": {"$nin": ["ended"]}}},
        {"$project": {"count": {"$size": {"$ifNull": ["$players", []]}}}},
        {"$group": {"_id": None, "total": {"$sum": "$count"}}},
    ]
    r = await db.sessions.aggregate(pipeline).to_list(1)
    return {
        "active_sessions": active,
        "total_players": r[0]["total"] if r else 0,
        "online_viewers": mgr.count("lobby"),
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
            cutoff = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
            await db.sessions.update_many(
                {
                    "status": {"$in": ["filling", "almost_full"]},
                    "updated_at": {"$lt": cutoff},
                },
                {"$set": {"status": "ended"}},
            )
            long_cutoff = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
            await db.sessions.update_many(
                {"status": "in_progress", "updated_at": {"$lt": long_cutoff}},
                {"$set": {"status": "ended"}},
            )
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
