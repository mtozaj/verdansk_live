import { useState, useEffect } from "react";
import { Clock, AlertTriangle } from "lucide-react";

const LOBBY_DURATION = 30 * 60; // 30 minutes in seconds

export const LobbyTimer = ({ lobbyResetAt, status }) => {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (!lobbyResetAt || !["filling", "almost_full"].includes(status)) {
      setRemaining(null);
      return;
    }

    const calc = () => {
      const start = new Date(lobbyResetAt).getTime();
      const elapsed = Math.floor((Date.now() - start) / 1000);
      return Math.max(LOBBY_DURATION - elapsed, 0);
    };

    setRemaining(calc());
    const interval = setInterval(() => setRemaining(calc()), 1000);
    return () => clearInterval(interval);
  }, [lobbyResetAt, status]);

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
