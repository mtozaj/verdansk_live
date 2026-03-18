import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Check,
  MapPin,
  Users,
  Clock,
  Shield,
  CircleDot,
  Target,
  Radio,
  Play,
  Square,
  RefreshCw,
  Lock,
  AlertTriangle,
  RotateCcw,
  MessageSquare,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { usePlayer } from "@/hooks/usePlayer";
import { useWebSocket } from "@/hooks/useWebSocket";
import { ChatFeed } from "@/components/ChatFeed";
import { Header } from "@/components/Header";
import { LobbyTimer } from "@/components/LobbyTimer";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function timeAgo(dateStr) {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

const STATUS_MAP = {
  filling: { label: "Filling", color: "text-primary", bg: "bg-primary/20" },
  almost_full: {
    label: "Almost Full",
    color: "text-green-400",
    bg: "bg-green-500/20",
  },
  starting: {
    label: "Match Starting Soon",
    color: "text-green-300",
    bg: "bg-green-500/20",
  },
  in_progress: {
    label: "Match Started",
    color: "text-blue-400",
    bg: "bg-blue-500/20",
  },
  ended: {
    label: "Ended",
    color: "text-muted-foreground",
    bg: "bg-muted",
  },
};

const STATE_COLORS = {
  interested: "bg-yellow-500",
  joining: "bg-green-400",
  in_lobby: "bg-emerald-500",
};

function CodeRefreshedAgo({ timestamp }) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    const calc = () => {
      const secs = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
      if (secs < 60) return "just now";
      const mins = Math.floor(secs / 60);
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      return `${hrs}h ago`;
    };
    setLabel(calc());
    const interval = setInterval(() => setLabel(calc()), 30000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return (
    <p className="text-xs font-mono text-muted-foreground mt-2" data-testid="code-refreshed-ago">
      <RefreshCw className="w-3 h-3 inline mr-1" />
      Code refreshed {label}
    </p>
  );
}

function JoiningStatus({ onConfirm, onLeave, isHost, copied, codeChanged, matchCode }) {
  const [nudge, setNudge] = useState(false);

  // Auto-nudge 30s after code is copied
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setNudge(true), 30000);
    return () => clearTimeout(timer);
  }, [copied]);

  // Code was updated — show warning variant
  if (codeChanged) {
    return (
      <div className="space-y-3" data-testid="joining-status-code-updated">
        <div className="bg-primary/15 border border-primary/40 px-3 py-3">
          <p className="text-sm text-primary font-mono font-bold uppercase tracking-wider">
            Code Updated
          </p>
          <p className="text-xs text-primary/80 font-mono mt-1.5">
            The host has updated the match code. Re-enter the lobby with the new code and confirm below.
          </p>
          {matchCode && (
            <div className="mt-2 bg-black/40 border border-primary/30 px-3 py-2 font-mono text-lg tracking-widest text-primary font-bold">
              {matchCode}
            </div>
          )}
        </div>

        <Button
          onClick={onConfirm}
          className="uppercase tracking-widest font-bold text-sm active:scale-95 bg-emerald-600 hover:bg-emerald-700 text-white w-full h-12 shadow-lg shadow-emerald-600/20 animate-pulse hover:animate-none"
          data-testid="state-btn-in_lobby"
        >
          <Check className="w-4 h-4 mr-2" />
          I'm In The Lobby
        </Button>

        {!isHost && (
          <Button
            onClick={onLeave}
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive text-xs"
            data-testid="leave-session-btn"
          >
            Leave Session
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="joining-status">
      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest">
        <span className="text-emerald-500 line-through opacity-60">1. Copy code</span>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-emerald-500 line-through opacity-60">2. Join in Warzone</span>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-yellow-400 font-bold">3. Confirm below</span>
      </div>

      {/* Warning text */}
      <div className="bg-yellow-500/10 border border-yellow-500/25 px-3 py-2.5">
        <p className="text-xs text-yellow-400 font-mono font-bold">
          Please confirm once you've joined the private match lobby in Warzone.
        </p>
        <p className="text-[10px] text-yellow-400/60 font-mono mt-1">
          The host needs an accurate player count to know when to start.
        </p>
      </div>

      {/* Pulsing confirm button */}
      <Button
        onClick={onConfirm}
        className="uppercase tracking-widest font-bold text-sm active:scale-95 bg-emerald-600 hover:bg-emerald-700 text-white w-full h-12 shadow-lg shadow-emerald-600/20 animate-pulse hover:animate-none"
        data-testid="state-btn-in_lobby"
      >
        <Check className="w-4 h-4 mr-2" />
        I'm In The Lobby
      </Button>

      {/* Auto-nudge after 30s of copying */}
      {nudge && (
        <div className="bg-primary/10 border border-primary/25 px-3 py-2 animate-in fade-in" data-testid="lobby-nudge">
          <p className="text-xs text-primary font-mono font-bold">
            Are you in the lobby yet? Please confirm so the host has an accurate count.
          </p>
        </div>
      )}

      {!isHost && (
        <Button
          onClick={onLeave}
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive text-xs"
          data-testid="leave-session-btn"
        >
          Leave Session
        </Button>
      )}
    </div>
  );
}

export default function SessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { playerId, nickname } = usePlayer();

  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [copied, setCopied] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [codeChanged, setCodeChanged] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatVisible, setChatVisible] = useState(false);
  const [editingCode, setEditingCode] = useState(false);
  const [editCode, setEditCode] = useState("");
  const codeChangedTimer = useRef(null);
  const expiryToastShownRef = useRef(false);
  const chatSectionRef = useRef(null);

  const isHost = session?.host_id === playerId;
  const myPlayer = session?.players?.find((p) => p.player_id === playerId);
  const hasJoined = !!myPlayer;

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, cRes] = await Promise.all([
          axios.get(`${API}/sessions/${id}`),
          axios.get(`${API}/sessions/${id}/chat`),
        ]);
        setSession(sRes.data);
        setMessages(cRes.data);
      } catch {
        toast.error("Session not found");
        navigate("/");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, navigate]);

  const chatVisibleRef = useRef(false);

  // Track chat section visibility
  useEffect(() => {
    if (!chatSectionRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        chatVisibleRef.current = entry.isIntersecting;
        setChatVisible(entry.isIntersecting);
        if (entry.isIntersecting) setUnreadCount(0);
      },
      { threshold: 0.3 }
    );
    observer.observe(chatSectionRef.current);
    return () => observer.disconnect();
  }, [loading]);

  const handleWs = useCallback((data) => {
    if (data.type === "session_updated") {
      setSession(data.session);
      if (!data.session?.lobby_expired) {
        expiryToastShownRef.current = false;
      }
    }
    if (data.type === "chat_message") {
      setMessages((prev) => [...prev, data.message]);
      if (!chatVisibleRef.current) {
        setUnreadCount((prev) => prev + 1);
      }
      // Mention toast — notify if someone mentioned you and you didn't send it
      if (
        data.message.player_id !== playerId &&
        nickname &&
        data.message.message &&
        data.message.message.toLowerCase().includes(`@${nickname.toLowerCase()}`)
      ) {
        toast(`${data.message.nickname} mentioned you`, {
          description: data.message.message,
        });
      }
    }
    if (data.type === "code_changed") {
      toast.info("Match code has been updated!");
      setCodeChanged(true);
    }
    if (data.type === "lobby_reset") {
      toast.info("Lobby has been reset — check the new match code");
    }
    if (data.type === "lobby_expired" && !expiryToastShownRef.current) {
      expiryToastShownRef.current = true;
      toast.warning("Warzone lobby expired - all players reset to interested");
    }
  }, [playerId, nickname]);

  const { send: wsSend, connected: wsConnected } = useWebSocket(`/api/ws/session/${id}`, handleWs);

  // Host heartbeat — send every 60s while the host has the page open
  useEffect(() => {
    if (!wsConnected) return;
    if (!session || session.host_id !== playerId) return;
    if (session.status === "ended") return;

    // Send immediately when WebSocket connects
    wsSend({ type: "host_heartbeat", player_id: playerId });

    const interval = setInterval(() => {
      wsSend({ type: "host_heartbeat", player_id: playerId });
    }, 60000);

    return () => clearInterval(interval);
  }, [wsConnected, session?.host_id, session?.status, playerId, wsSend]);

  // Auto-dismiss "NEW CODE" badge after 30s or when copied
  useEffect(() => {
    if (!codeChanged) return;
    codeChangedTimer.current = setTimeout(() => setCodeChanged(false), 30000);
    return () => clearTimeout(codeChangedTimer.current);
  }, [codeChanged]);

  const copyCode = () => {
    if (session?.match_code) {
      navigator.clipboard.writeText(session.match_code);
      setCopied(true);
      setCodeChanged(false);
      toast.success("Code copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const editMatchCode = async () => {
    const code = editCode.trim();
    if (!code) return;
    try {
      const res = await axios.patch(
        `${API}/sessions/${id}?host_id=${playerId}&reset_timer=false`,
        { match_code: code.toUpperCase() }
      );
      setSession(res.data);
      setEditingCode(false);
      setEditCode("");
      toast.success("Code corrected (timer unchanged)");
    } catch {
      toast.error("Failed to update code");
    }
  };

  const resetLobby = async (codeOverride) => {
    const code = (codeOverride || resetCode).trim();
    if (!code) {
      toast.error("Enter the new match code");
      return;
    }
    try {
      const res = await axios.post(
        `${API}/sessions/${id}/reset-lobby?host_id=${playerId}`,
        { match_code: code.toUpperCase() }
      );
      setSession(res.data);
      setResetCode("");
      setNewCode("");
      toast.success("Lobby reset with new code!");
    } catch {
      toast.error("Failed to reset lobby");
    }
  };

  const joinSession = async (state = "interested") => {
    try {
      const res = await axios.post(`${API}/sessions/${id}/join`, {
        player_id: playerId,
        nickname,
        state,
      });
      setSession(res.data);
    } catch {
      toast.error("Failed to join");
    }
  };

  const leaveSession = async () => {
    try {
      const res = await axios.post(
        `${API}/sessions/${id}/leave?player_id=${playerId}`
      );
      setSession(res.data);
    } catch {
      // silent
    }
  };

  const updateState = async (state) => {
    try {
      const res = await axios.post(`${API}/sessions/${id}/join`, {
        player_id: playerId,
        nickname,
        state,
      });
      setSession(res.data);
    } catch {
      // silent
    }
  };

  const updateSessionStatus = async (status) => {
    try {
      const res = await axios.patch(
        `${API}/sessions/${id}?host_id=${playerId}`,
        { status }
      );
      setSession(res.data);
      const labels = {
        starting: "match starting soon",
        in_progress: "match started",
        ended: "ended",
      };
      toast.success(`Session ${labels[status] || status}!`);
    } catch {
      // silent
    }
  };

  const updateMatchCode = async () => {
    if (!newCode.trim()) return;
    try {
      const res = await axios.patch(
        `${API}/sessions/${id}?host_id=${playerId}`,
        { match_code: newCode.toUpperCase() }
      );
      setSession(res.data);
      setNewCode("");
      toast.success("Code updated");
    } catch {
      // silent
    }
  };

  const sendChat = async (message) => {
    try {
      await axios.post(`${API}/sessions/${id}/chat`, {
        player_id: playerId,
        nickname,
        message,
      });
    } catch {
      // silent
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="animate-pulse space-y-4">
            <div className="bg-card h-8 w-48" />
            <div className="bg-card h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const status = STATUS_MAP[session.status] || STATUS_MAP.filling;
  const progress = Math.min(
    (session.ready_count / session.min_players) * 100,
    100
  );
  const codeUnlocked =
    isHost ||
    myPlayer?.state === "joining" ||
    myPlayer?.state === "in_lobby" ||
    session?.status === "in_progress";

  return (
    <div className="min-h-screen" data-testid="session-page">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors duration-200"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-mono text-xs uppercase tracking-wider">
            Back to Lobby
          </span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Session header */}
            <div
              className="bg-card border border-white/5 p-5"
              data-testid="session-header"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {session.status !== "ended" && <div className="live-dot" />}
                    <span className="font-heading text-sm uppercase tracking-wide text-muted-foreground">
                      Verdansk Private Match
                    </span>
                  </div>
                  <h1
                    className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight text-foreground"
                    data-testid="session-title"
                  >
                    {session.title}
                  </h1>
                </div>
                <Badge
                  className={`${status.bg} ${status.color} border-0 font-mono text-xs uppercase`}
                  data-testid="session-status-badge"
                >
                  {status.label}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-4 text-xs font-mono text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {session.region}
                </div>
                <div className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  {session.host_name}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeAgo(session.created_at)}
                </div>
                <span>{session.platform}</span>
              </div>
            </div>

            {/* In Progress Warning */}
            {session.status === "in_progress" && (
              <div
                className="bg-red-500/10 border border-red-500/30 p-4 flex items-start gap-3"
                data-testid="in-progress-banner"
              >
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-heading text-sm uppercase tracking-wider text-red-400 font-bold">
                    Match Started
                  </p>
                  <p className="text-xs text-red-400/70 font-mono mt-1">
                    The match has started. The game is already in progress and you may not be able to join with the current code.
                  </p>
                </div>
              </div>
            )}

            {/* Host Inactive Warning */}
            {session.host_inactive && session.status !== "ended" && (
              <div
                className="bg-yellow-500/10 border border-yellow-500/30 p-4 flex items-start gap-3"
                data-testid="host-inactive-banner"
              >
                <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-heading text-sm uppercase tracking-wider text-yellow-500 font-bold">
                    Host Inactive
                  </p>
                  <p className="text-xs text-yellow-500/70 font-mono mt-1">
                    Last active: {session.host_last_heartbeat
                      ? timeAgo(session.host_last_heartbeat)
                      : "unknown"}. This session may no longer be running.
                  </p>
                </div>
              </div>
            )}

            {/* Lobby Timer */}
            <LobbyTimer
              lobbyResetAt={session.lobby_reset_at}
              lobbyExpiresAt={session.lobby_expires_at}
              lobbyExpired={session.lobby_expired}
              serverNow={session.server_now}
              status={session.status}
            />

            {/* Lobby Expired Reset Prompt */}
            {isHost && session.lobby_expired && ["filling", "almost_full", "starting"].includes(session.status) && (
              <div
                className="bg-red-500/10 border border-red-500/30 p-5"
                data-testid="lobby-expired-reset"
              >
                <div className="flex items-start gap-3 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-heading text-sm uppercase tracking-wider text-red-400 font-bold">
                      Lobby Expired
                    </p>
                    <p className="text-xs text-red-400/70 font-mono mt-1">
                      Warzone has kicked all players. Reset the current lobby with the new code.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="New match code"
                    className="bg-secondary/50 border-white/10 font-mono text-sm"
                    data-testid="reset-code-input"
                  />
                  <Button
                    onClick={() => resetLobby()}
                    className="uppercase tracking-widest font-bold text-xs bg-red-600 hover:bg-red-700 text-white shrink-0"
                    data-testid="reset-lobby-btn"
                  >
                    <RotateCcw className="w-3 h-3 mr-1.5" /> Reset Lobby
                  </Button>
                </div>
              </div>
            )}

            {/* Lobby Expired — Player View */}
            {!isHost && session.lobby_expired && ["filling", "almost_full", "starting"].includes(session.status) && (
              <div
                className="bg-red-500/10 border border-red-500/30 p-4 flex items-start gap-3"
                data-testid="lobby-expired-player"
              >
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-heading text-sm uppercase tracking-wider text-red-400 font-bold">
                    Lobby Expired
                  </p>
                  <p className="text-xs text-red-400/70 font-mono mt-1">
                    Warzone has kicked all players. Waiting for the host to reset the lobby with a new code.
                  </p>
                </div>
              </div>
            )}

            {/* Host Controls */}
            {isHost && session.status !== "ended" && (
              <div
                className="bg-card border border-primary/20 p-5"
                data-testid="host-controls"
              >
                <h3 className="font-heading text-sm uppercase tracking-wider text-primary mb-3">
                  Host Controls
                </h3>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      placeholder="New lobby? Enter new code and update."
                      className="bg-secondary/50 border-white/10 font-mono text-sm placeholder:text-[10px] sm:placeholder:text-sm"
                      disabled={session.lobby_expired}
                      data-testid="update-code-input"
                    />
                    <Button
                      onClick={updateMatchCode}
                      variant="outline"
                      size="sm"
                      disabled={session.lobby_expired}
                      className="border-primary/50 text-primary uppercase tracking-widest font-bold text-[10px] shrink-0"
                      data-testid="update-code-btn"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" /> Update
                    </Button>
                  </div>
                  <Separator className="bg-white/5" />
                  <div className="flex flex-wrap gap-2">
                    {!session.lobby_expired && (session.status === "filling" || session.status === "almost_full") && (
                      <Button
                        onClick={() => updateSessionStatus("starting")}
                        size="sm"
                        className="uppercase tracking-widest font-bold text-[10px] bg-green-600 hover:bg-green-700 text-white"
                        data-testid="start-session-btn"
                      >
                        <Play className="w-3 h-3 mr-1" /> Lobby Is Ready
                      </Button>
                    )}
                    {session.status === "starting" && (
                      <Button
                        onClick={() => updateSessionStatus("in_progress")}
                        size="sm"
                        className="uppercase tracking-widest font-bold text-[10px] bg-blue-600 hover:bg-blue-700 text-white"
                        data-testid="in-progress-btn"
                      >
                        <Play className="w-3 h-3 mr-1" /> Start Match
                      </Button>
                    )}
                    {(session.status === "starting" || session.status === "in_progress") && (
                      <Button
                        onClick={() => {
                          const code = newCode.trim();
                          if (!code) {
                            toast.error("Enter a new match code above first");
                            return;
                          }
                          resetLobby(code);
                        }}
                        size="sm"
                        className="uppercase tracking-widest font-bold text-[10px] bg-yellow-600 hover:bg-yellow-700 text-white"
                        data-testid="reset-lobby-host-btn"
                      >
                        <RotateCcw className="w-3 h-3 mr-1" /> Reset Lobby
                      </Button>
                    )}
                    <Button
                      onClick={() => updateSessionStatus("ended")}
                      variant="destructive"
                      size="sm"
                      className="uppercase tracking-widest font-bold text-[10px]"
                      data-testid="end-session-btn"
                    >
                      <Square className="w-3 h-3 mr-1" /> End Session
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Match Code */}
            <div
              className="bg-card border border-white/5 p-5"
              data-testid="match-code-section"
            >
              <div className="flex items-center gap-2 mb-3">
                <h3 className="font-heading text-sm uppercase tracking-wider text-muted-foreground">
                  Match Code
                </h3>
                {codeChanged && (
                  <Badge
                    className="bg-green-500/20 text-green-400 border-green-500/30 font-mono text-[10px] uppercase tracking-wider animate-pulse"
                    data-testid="new-code-badge"
                  >
                    New Code
                  </Badge>
                )}
              </div>
              {codeUnlocked ? (
                <div>
                  {editingCode ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={editCode}
                          onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                          placeholder="Corrected code"
                          className="bg-black/40 border-primary/30 font-mono text-lg tracking-widest text-primary font-bold h-12"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") editMatchCode();
                            if (e.key === "Escape") { setEditingCode(false); setEditCode(""); }
                          }}
                          data-testid="edit-code-input"
                        />
                        <Button
                          onClick={editMatchCode}
                          disabled={!editCode.trim()}
                          className="h-12 px-4 uppercase tracking-widest font-bold text-xs bg-green-600 hover:bg-green-700 text-white shrink-0"
                          data-testid="edit-code-save-btn"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => { setEditingCode(false); setEditCode(""); }}
                          variant="ghost"
                          className="h-12 px-3 text-muted-foreground shrink-0"
                          data-testid="edit-code-cancel-btn"
                        >
                          <Square className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-[10px] text-green-400 font-mono font-bold">
                        IMPORTANT: This will only correct the code, it will not reset the lobby timer and players.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex-1 bg-black/40 border px-4 py-3 font-mono text-xl md:text-2xl tracking-widest text-primary font-bold select-all ${
                            codeChanged ? "border-green-500/50" : "border-primary/30"
                          }`}
                          data-testid="match-code-display"
                        >
                          {session.match_code}
                        </div>
                        <Button
                          onClick={copyCode}
                          variant="outline"
                          className="border-primary/50 text-primary hover:bg-primary hover:text-black h-12 px-4 uppercase tracking-widest font-bold text-xs"
                          data-testid="copy-code-btn"
                        >
                          {copied ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                        {isHost && session.status !== "ended" && !session.lobby_expired && (
                          <Button
                            onClick={() => { setEditCode(session.match_code); setEditingCode(true); }}
                            variant="outline"
                            className="border-white/10 text-muted-foreground hover:text-primary hover:border-primary/50 h-12 px-4"
                            data-testid="edit-code-btn"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      {session.lobby_reset_at && session.lobby_reset_at !== session.created_at && (
                        <CodeRefreshedAgo timestamp={session.lobby_reset_at} />
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="bg-black/40 border border-white/10 px-4 py-6 text-center"
                  data-testid="match-code-locked"
                >
                  <Lock className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                  <p className="font-mono text-sm text-muted-foreground">
                    Code is locked
                  </p>
                  <p className="font-mono text-xs text-muted-foreground/60 mt-1">
                    Commit to joining to unlock the match code
                  </p>
                </div>
              )}
            </div>

            {/* Progress */}
            <div
              className="bg-card border border-white/5 p-5"
              data-testid="progress-section"
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-heading text-sm uppercase tracking-wider text-muted-foreground">
                  Session Progress
                </h3>
                <span className="font-mono text-sm">
                  <span className="text-foreground font-bold">
                    {session.ready_count}
                  </span>
                  <span className="text-muted-foreground">
                    /{session.min_players} ready
                  </span>
                </span>
              </div>
              <Progress
                value={progress}
                className="h-2.5 mb-2"
                data-testid="session-progress-bar"
              />
              <div className="flex justify-between text-xs font-mono text-muted-foreground">
                <span>{session.player_count} total joined</span>
                <span>{session.in_lobby_count} in lobby</span>
              </div>
            </div>

            {/* Readiness Controls */}
            {session.status !== "ended" && (
              <div
                className="bg-card border border-white/5 p-5"
                data-testid="readiness-section"
              >
                <h3 className="font-heading text-sm uppercase tracking-wider text-muted-foreground mb-3">
                  Your Status
                </h3>
                {session.lobby_expired ? (
                  <div className="space-y-3" data-testid="expired-readiness-state">
                    <div className="bg-red-500/10 border border-red-500/25 px-3 py-2.5">
                      <p className="text-xs text-red-400 font-mono font-bold">
                        {isHost
                          ? "This lobby has expired. Reset it with a new match code to continue."
                          : "This lobby has expired. Wait for the host to reset it with a new match code."}
                      </p>
                      <p className="text-[10px] text-red-400/60 font-mono mt-1">
                        {isHost
                          ? "Your server state is expired until you reset the lobby."
                          : "Your status has been reset to interested on the server."}
                      </p>
                    </div>
                    {!isHost && hasJoined && (
                      <Button
                        onClick={leaveSession}
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive text-xs"
                        data-testid="leave-session-btn"
                      >
                        Leave Session
                      </Button>
                    )}
                  </div>
                ) : !hasJoined ? (
                  session.status === "in_progress" ? (
                    <div className="space-y-2" data-testid="in-progress-no-join">
                      <div className="bg-red-500/10 border border-red-500/25 px-3 py-2.5">
                        <p className="text-xs text-red-400 font-mono font-bold">
                          This match has already started.
                        </p>
                        <p className="text-[10px] text-red-400/60 font-mono mt-1">
                          Wait for the next session or check other active lobbies.
                        </p>
                      </div>
                      <Button
                        disabled
                        className="uppercase tracking-widest font-bold text-xs opacity-40 cursor-not-allowed"
                        data-testid="join-session-btn-disabled"
                      >
                        I'm Interested
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Button
                        onClick={() => joinSession("interested")}
                        className="uppercase tracking-widest font-bold text-xs active:scale-95 glow-primary"
                        data-testid="join-session-btn"
                      >
                        I'm Interested
                      </Button>
                      <p className="text-xs text-muted-foreground font-mono">
                        Join to follow this session. Commit to joining to unlock
                        the match code.
                      </p>
                    </div>
                  )
                ) : myPlayer?.state === "interested" ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      <span className="font-mono text-xs text-yellow-500 uppercase tracking-wider">
                        Interested
                      </span>
                    </div>
                    <Button
                      onClick={() => updateState("joining")}
                      className="uppercase tracking-widest font-bold text-xs active:scale-95 bg-green-600 hover:bg-green-700 text-white"
                      data-testid="state-btn-joining"
                    >
                      <Lock className="w-3 h-3 mr-1.5" />
                      Commit to Joining — Unlock Code
                    </Button>
                    <p className="text-xs text-muted-foreground font-mono">
                      This will reveal the private match code to you.
                    </p>
                    {!isHost && (
                      <Button
                        onClick={leaveSession}
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive text-xs"
                        data-testid="leave-session-btn"
                      >
                        Leave Session
                      </Button>
                    )}
                  </div>
                ) : myPlayer?.state === "joining" ? (
                  <JoiningStatus
                    onConfirm={() => updateState("in_lobby")}
                    onLeave={leaveSession}
                    isHost={isHost}
                    copied={copied}
                    codeChanged={codeChanged}
                    matchCode={session?.match_code}
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="font-mono text-sm text-emerald-400 uppercase tracking-wider font-bold">
                        In The Lobby
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      You're in. Waiting for the host to start the match.
                    </p>
                    {!isHost && (
                      <Button
                        onClick={leaveSession}
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive text-xs"
                        data-testid="leave-session-btn"
                      >
                        Leave Session
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Player list */}
            <div
              className="bg-card border border-white/5 p-5"
              data-testid="player-list-section"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading text-sm uppercase tracking-wider text-muted-foreground">
                  Players ({session.player_count})
                </h3>
                <div className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-mono text-xs text-muted-foreground">
                    {session.in_lobby_count} in lobby
                  </span>
                </div>
              </div>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {session.players?.map((p) => (
                  <div
                    key={p.player_id}
                    className="flex items-center justify-between py-1.5 px-2 bg-white/[0.02] text-xs font-mono"
                    data-testid={`player-${p.player_id}`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          STATE_COLORS[p.state] || "bg-muted"
                        }`}
                      />
                      <span className="text-foreground truncate max-w-[120px]">
                        {p.nickname}
                      </span>
                      {p.player_id === session.host_id && (
                        <Badge
                          variant="outline"
                          className="text-[9px] border-primary/30 text-primary py-0 h-4"
                        >
                          HOST
                        </Badge>
                      )}
                    </div>
                    <span className="text-muted-foreground capitalize text-[10px]">
                      {p.state.replace("_", " ")}
                    </span>
                  </div>
                ))}
                {(!session.players || session.players.length === 0) && (
                  <p className="text-muted-foreground text-xs text-center py-4">
                    No players yet
                  </p>
                )}
              </div>
            </div>

            {/* Chat */}
            <div
              ref={chatSectionRef}
              className="bg-card border border-primary/20 p-5 h-80"
              data-testid="chat-section"
            >
              <ChatFeed
                messages={messages}
                onSend={sendChat}
                currentPlayerId={playerId}
                hostId={session?.host_id}
                unreadCount={unreadCount}
                players={session?.players || []}
              />
            </div>
          </div>
        </div>

        {/* Floating chat bubble — mobile only */}
        <button
          className={`lg:hidden fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-primary text-black flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-all duration-300 ${
            chatVisible ? "opacity-0 pointer-events-none scale-90" : "opacity-100 scale-100"
          }`}
          onClick={() => {
            chatSectionRef.current?.scrollIntoView({ behavior: "smooth" });
            setUnreadCount(0);
          }}
          data-testid="chat-fab"
        >
          <MessageSquare className="w-6 h-6" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse"
              data-testid="chat-fab-badge"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </main>
    </div>
  );
}
