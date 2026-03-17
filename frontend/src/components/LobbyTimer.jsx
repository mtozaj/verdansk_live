import { useState, useEffect } from "react";
import { Clock, AlertTriangle } from "lucide-react";

const LOBBY_DURATION = 30 * 60; // 30 minutes in seconds

export const LobbyTimer = ({
  lobbyResetAt,
  lobbyExpiresAt,
  lobbyExpired,
  serverNow,
  status,
}) => {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (!lobbyResetAt || !["filling", "almost_full"].includes(status)) {
      setRemaining(null);
      return;
    }

    if (lobbyExpired) {
      setRemaining(null);
      return;
    }

    if (!lobbyExpiresAt || !serverNow) {
      setRemaining(LOBBY_DURATION);
      return;
    }

    // Capture offset ONCE per effect run — not inside calc().
    // If recomputed every tick, Date.now() cancels itself out
    // and the countdown freezes at a constant value.
    const offset = new Date(serverNow).getTime() - Date.now();
    const calc = () => {
      const nowMs = Date.now() + offset;
      const expiresAtMs = new Date(lobbyExpiresAt).getTime();
      return Math.max(Math.floor((expiresAtMs - nowMs) / 1000), 0);
    };

    setRemaining(calc());
    const interval = setInterval(() => setRemaining(calc()), 1000);
    return () => clearInterval(interval);
  }, [lobbyResetAt, lobbyExpiresAt, lobbyExpired, serverNow, status]);

  if (remaining === null) return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const expired = remaining === 0;
  const urgent = remaining <= 300 && remaining > 0; // last 5 minutes

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 font-mono text-xs ${
        expired
          ? "bg-red-500/15 border border-red-500/30 text-red-400"
          : urgent
          ? "bg-yellow-500/10 border border-yellow-500/30 text-yellow-400"
          : "bg-white/[0.03] border border-white/5 text-muted-foreground"
      }`}
      data-testid="lobby-timer"
    >
      {expired ? (
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <Clock className={`w-3.5 h-3.5 shrink-0 ${urgent ? "animate-pulse" : ""}`} />
      )}
      <span className="uppercase tracking-wider">
        {expired
          ? "Warzone lobby expired"
          : `Lobby expires in ${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`}
      </span>
    </div>
  );
};
