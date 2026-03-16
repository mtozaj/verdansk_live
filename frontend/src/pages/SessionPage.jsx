import { useState, useEffect, useCallback } from "react";
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
    label: "Starting",
    color: "text-green-300",
    bg: "bg-green-500/20",
  },
  in_progress: {
    label: "In Progress",
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

export default function SessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { playerId, nickname } = usePlayer();

  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [copied, setCopied] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [loading, setLoading] = useState(true);

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

  const handleWs = useCallback((data) => {
    if (data.type === "session_updated") setSession(data.session);
    if (data.type === "chat_message")
      setMessages((prev) => [...prev, data.message]);
  }, []);

  useWebSocket(`/api/ws/session/${id}`, handleWs);

  const copyCode = () => {
    if (session?.match_code) {
      navigator.clipboard.writeText(session.match_code);
      setCopied(true);
      toast.success("Code copied!");
      setTimeout(() => setCopied(false), 2000);
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
        starting: "starting",
        in_progress: "in progress",
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
    myPlayer?.state === "in_lobby";

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
                  {session.host_success_rate > 0 && (
                    <span className="text-primary ml-1">
                      {Math.round(session.host_success_rate * 100)}% launch rate
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeAgo(session.created_at)}
                </div>
                <span>{session.platform}</span>
              </div>
            </div>

            {/* Match Code */}
            <div
              className="bg-card border border-white/5 p-5"
              data-testid="match-code-section"
            >
              <h3 className="font-heading text-sm uppercase tracking-wider text-muted-foreground mb-3">
                Match Code
              </h3>
              {codeUnlocked ? (
                <div className="flex items-center gap-3">
                  <div
                    className="flex-1 bg-black/40 border border-primary/30 px-4 py-3 font-mono text-xl md:text-2xl tracking-widest text-primary font-bold select-all"
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
                {!hasJoined ? (
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
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="font-mono text-xs text-green-400 uppercase tracking-wider">
                        Joining — Code Unlocked
                      </span>
                    </div>
                    <Button
                      onClick={() => updateState("in_lobby")}
                      className="uppercase tracking-widest font-bold text-xs active:scale-95 bg-emerald-600 hover:bg-emerald-700 text-white"
                      data-testid="state-btn-in_lobby"
                    >
                      <Check className="w-3 h-3 mr-1.5" />
                      I'm In The Lobby
                    </Button>
                    <p className="text-xs text-muted-foreground font-mono">
                      Confirm once you've entered the private match lobby.
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
                      placeholder="New match code"
                      className="bg-secondary/50 border-white/10 font-mono text-sm"
                      data-testid="update-code-input"
                    />
                    <Button
                      onClick={updateMatchCode}
                      variant="outline"
                      size="sm"
                      className="border-primary/50 text-primary uppercase tracking-widest font-bold text-[10px] shrink-0"
                      data-testid="update-code-btn"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" /> Update
                    </Button>
                  </div>
                  <Separator className="bg-white/5" />
                  <div className="flex flex-wrap gap-2">
                    {session.status === "filling" && (
                      <Button
                        onClick={() => updateSessionStatus("starting")}
                        size="sm"
                        className="uppercase tracking-widest font-bold text-[10px] bg-green-600 hover:bg-green-700 text-white"
                        data-testid="start-session-btn"
                      >
                        <Play className="w-3 h-3 mr-1" /> Start Match
                      </Button>
                    )}
                    {session.status === "starting" && (
                      <Button
                        onClick={() => updateSessionStatus("in_progress")}
                        size="sm"
                        className="uppercase tracking-widest font-bold text-[10px] bg-blue-600 hover:bg-blue-700 text-white"
                        data-testid="in-progress-btn"
                      >
                        <Play className="w-3 h-3 mr-1" /> In Progress
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
              className="bg-card border border-white/5 p-5 h-80"
              data-testid="chat-section"
            >
              <ChatFeed
                messages={messages}
                onSend={sendChat}
                currentPlayerId={playerId}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
